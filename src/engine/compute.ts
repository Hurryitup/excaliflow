import type {
  GraphModel,
  ScenarioResult,
  ServiceNode,
  QueueTopicNode,
  DatastoreNode,
  Edge,
  OpType,
} from '../graph/types'

const EPSILON = 1e-6

export type EngineConfig = {
  p95Multiplier: number
  queueThreshold: number
}

export const defaultEngineConfig: EngineConfig = {
  p95Multiplier: 2,
  queueThreshold: 0.7,
}

function serviceEffectiveTimeMs(svc: ServiceNode['dials']): number {
  const base = Math.max(svc.serviceTimeMs, EPSILON)
  const cacheHitRate = Math.max(0, Math.min(svc.cacheHitRate ?? 0, 1))
  const cacheHitMs = Math.max(0, svc.cacheHitMs ?? 0)
  return (1 - cacheHitRate) * base + cacheHitRate * cacheHitMs
}

// removed unused function

function edgeTransportLatencyMs(edge: Edge): number {
  return edge.protocol === 'Kafka' ? 0 : 0
}

function queuePenaltyMs(util: number, baseMs: number, config: EngineConfig): number {
  if (util <= config.queueThreshold) return 0
  return Math.pow(util, 3) * baseMs
}

function effectivePartitions(partitions: number, keySkew: number | undefined): number {
  const skew = Math.max(0, Math.min(1, keySkew ?? 0))
  const eff = Math.floor(partitions * (1 - skew * skew))
  return Math.max(1, eff)
}

function topicCapacityRps(topic: QueueTopicNode['dials']): number {
  return topic.partitions * topic.perPartitionThroughput
}

type EdgeIngress = { rps: number; opType?: OpType }

function datastoreCostedIngress(edges: EdgeIngress[], d: DatastoreNode['dials']) {
  const writeAmp = d.writeAmplification ?? 4
  let reads = 0, writes = 0, other = 0
  for (const e of edges) {
    const r = e.rps
    switch (e.opType) {
      case 'write': writes += r; break
      case 'read':  reads  += r; break
      default:      other  += r; break
    }
  }
  const costUnits = reads + writes * writeAmp + other
  return { reads, writes, other, costUnits }
}

export function computeScenario(graph: GraphModel, config: EngineConfig = defaultEngineConfig): ScenarioResult {
  const nodeStats: ScenarioResult['nodeStats'] = {}
  const edgeStats: ScenarioResult['edgeStats'] = {}
  const globalWarnings: string[] = []
  const bottlenecks: Array<{ id: string; reason: string }> = []

  // Seed incoming with zeros
  const incoming: Record<string, number> = {}
  for (const n of graph.nodes) incoming[n.id] = 0
  for (const n of graph.nodes) if (n.type === 'ApiEndpoint') incoming[n.id] += (n.dials.targetQps * (n.dials.burstFactor ?? 1))

  // Build graph helpers
  const outByNode = new Map<string, string[]>()
  const inDegree = new Map<string, number>()
  for (const n of graph.nodes) {
    outByNode.set(n.id, [])
    inDegree.set(n.id, 0)
  }
  for (const e of graph.edges) {
    outByNode.get(e.from)!.push(e.to)
    inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1)
  }

  // Kahn topological order (best-effort; if cycles, we still iterate all nodes once)
  const queue: string[] = []
  for (const [id, deg] of inDegree.entries()) if (deg === 0) queue.push(id)
  const ordered: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    ordered.push(id)
    for (const nxt of outByNode.get(id) || []) {
      const d = (inDegree.get(nxt) || 0) - 1
      inDegree.set(nxt, d)
      if (d === 0) queue.push(nxt)
    }
  }
  if (ordered.length < graph.nodes.length) {
    // fallback: append any remaining nodes
    for (const n of graph.nodes) if (!ordered.includes(n.id)) ordered.push(n.id)
  }

  // Precompute adjacency for convenience
  const edgesByFrom = new Map<string, Edge[]>()
  const edgesByTo = new Map<string, Edge[]>()
  for (const e of graph.edges) {
    if (!edgesByFrom.has(e.from)) edgesByFrom.set(e.from, [])
    if (!edgesByTo.has(e.to)) edgesByTo.set(e.to, [])
    edgesByFrom.get(e.from)!.push(e)
    edgesByTo.get(e.to)!.push(e)
  }

  // Compute node stats in order and propagate flows
  for (const nodeId of ordered) {
    const n = graph.nodes.find((x) => x.id === nodeId)!
    const ingress = incoming[nodeId] || 0

    if (n.type === 'Service') {
      let effectiveIngress = ingress
      // Join semantics
      const inEdges = (edgesByTo.get(n.id) ?? []).map((e) => ({ e, rps: edgeStats[e.id]?.flowRps ?? 0 }))
      const joinSpec = n.dials.join
      if (joinSpec && (joinSpec.type === 'waitAll' || joinSpec.type === 'windowed')) {
        const minIn = inEdges.length > 0 ? Math.min(...inEdges.map((x) => x.rps)) : 0
        const eff = joinSpec.joinEfficiency ?? 1
        effectiveIngress = minIn * eff
      }

      // Base capacity; when consuming from Kafka, clamp effective workers by available partitions
      const kafkaIn = (edgesByTo.get(n.id) ?? []).filter((e) => e.protocol === 'Kafka')
      let availablePartitions = 0
      for (const e of kafkaIn) {
        const fromNode = graph.nodes.find((x) => x.id === e.from)
        if (fromNode && fromNode.type === 'QueueTopic') availablePartitions += fromNode.dials.partitions
      }
      const workers = kafkaIn.length > 0 ? Math.min(n.dials.concurrency, availablePartitions) : n.dials.concurrency
      const eff = Math.max(0, Math.min(n.dials.parallelEfficiency ?? 1, 1))
      const t = serviceEffectiveTimeMs(n.dials)
      let capacity = workers * eff * (1000 / Math.max(t, EPSILON))
      // Apply node multipliers and optional caps
      const capMult = n.penalties?.capacityMultiplier ?? 1
      capacity *= capMult
      if (n.penalties?.fixedRpsCap != null) capacity = Math.min(capacity, n.penalties.fixedRpsCap)
      if (n.dials.maxInFlight != null) capacity = Math.min(capacity, n.dials.maxInFlight)
      // If consuming from a topic, also bound by consumer capacity
      let consumerCapForDetails: number | undefined
      if (kafkaIn.length > 0) {
        let consumerCap = Infinity
        for (const e of kafkaIn) {
          const fromNode = graph.nodes.find((x) => x.id === e.from)
          if (fromNode && fromNode.type === 'QueueTopic') {
            const part = fromNode.dials.partitions
            const perPart = fromNode.dials.perPartitionThroughput
            const consumerPar = n.dials.concurrency
            const consumerBound = Math.min(part, consumerPar) * perPart
            consumerCap = Math.min(consumerCap, consumerBound)
          }
        }
        consumerCapForDetails = consumerCap
        capacity = Math.min(capacity, consumerCap)
      }

      const rho = effectiveIngress / Math.max(capacity, EPSILON)
      const baseServiceMs = serviceEffectiveTimeMs(n.dials)
      const queueMs = queuePenaltyMs(rho, baseServiceMs, config)
      let p50 = baseServiceMs + queueMs
      p50 = p50 * (n.penalties?.latencyMultiplier ?? 1) + (n.penalties?.latencyMsAdd ?? 0)
      const p95 = p50 * defaultEngineConfig.p95Multiplier
      let egress = Math.min(effectiveIngress, capacity)
      egress = Math.min(egress, n.penalties?.fixedRpsCap ?? Infinity)
      egress = egress * (n.penalties?.throughputMultiplier ?? 1)
      const backlog = Math.max(0, effectiveIngress - capacity)
      // Wasted concurrency when consuming from Kafka topics vs partitions
      const incomingKafkaEdges = graph.edges.filter((e) => e.to === n.id && e.protocol === 'Kafka')
      let maxPartitions = 0
      for (const e of incomingKafkaEdges) {
        const fromNode = graph.nodes.find((x) => x.id === e.from)
        if (fromNode && fromNode.type === 'QueueTopic') {
          maxPartitions = Math.max(maxPartitions, fromNode.dials.partitions)
        }
      }
      let wastedConcurrency: number | undefined = undefined
      if (maxPartitions > 0) {
        const eff = Math.max(0, Math.min(n.dials.parallelEfficiency ?? 1, 1))
        const maxUseful = maxPartitions * eff
        const wasted = n.dials.concurrency - maxUseful
        wastedConcurrency = wasted > 0 ? wasted : undefined
      }
      const warnings: string[] = []
      if (rho >= 1) warnings.push(`Inbound ${effectiveIngress.toFixed(1)} RPS exceeds service capacity (${capacity.toFixed(1)}). Backlog growing by ${(effectiveIngress - capacity).toFixed(1)} RPS.`)
      else if (rho >= 0.85) warnings.push('High utilization (≥0.85)')
      else if (rho >= 0.7) warnings.push('Elevated utilization (≥0.70)')
      if (backlog > 0) bottlenecks.push({ id: n.id, reason: 'Capacity exceeded' })
      nodeStats[n.id] = {
        ingressRps: effectiveIngress,
        egressRps: egress,
        utilization: rho,
        modeledP50Ms: p50,
        modeledP95Ms: p95,
        backlogRps: backlog > 0 ? backlog : undefined,
        wastedConcurrency,
        warnings,
        details: { service: { joinMode: (n.dials.join?.type ?? 'none') as any, workers, availablePartitions: kafkaIn.length > 0 ? availablePartitions : undefined, consumerCap: consumerCapForDetails } },
      }
    } else if (n.type === 'QueueTopic') {
      const topic = n as QueueTopicNode
      let capacity = topicCapacityRps(topic.dials)
      capacity *= n.penalties?.capacityMultiplier ?? 1
      if (n.penalties?.fixedRpsCap != null) capacity = Math.min(capacity, n.penalties.fixedRpsCap)
      // Compute total consumer cap from downstream services
      const outs = edgesByFrom.get(n.id) ?? []
      let consumerCapTotal = 0
      for (const e of outs) {
        const down = graph.nodes.find((x) => x.id === e.to)
        if (down && down.type === 'Service') {
          const consumerPar = down.dials.concurrency
          consumerCapTotal += Math.min(topic.dials.partitions, consumerPar) * topic.dials.perPartitionThroughput
        }
      }
      let egress = Math.min(ingress, capacity, consumerCapTotal || Infinity)
      egress = Math.min(egress, n.penalties?.fixedRpsCap ?? Infinity)
      egress = egress * (n.penalties?.throughputMultiplier ?? 1)
      const consumerLagRps = Math.max(0, ingress - egress)
      nodeStats[n.id] = {
        ingressRps: ingress,
        egressRps: egress,
        utilization: ingress / Math.max(capacity, EPSILON),
        modeledP50Ms: 0,
        modeledP95Ms: 0,
        consumerLagRps: consumerLagRps > 0 ? consumerLagRps : undefined,
        warnings: [],
        details: { topic: { partitions: topic.dials.partitions, consumerCapTotal: consumerCapTotal || 0 } },
      }
    } else if (n.type === 'ApiEndpoint') {
      let egress = ingress
      if (n.penalties?.fixedRpsCap != null) egress = Math.min(egress, n.penalties.fixedRpsCap)
      egress = egress * (n.penalties?.throughputMultiplier ?? 1)
      const p50Base = n.dials.p50Ms ?? 0
      const p50 = p50Base * (n.penalties?.latencyMultiplier ?? 1) + (n.penalties?.latencyMsAdd ?? 0)
      const p95 = n.dials.p95Ms != null ? n.dials.p95Ms : p50 * defaultEngineConfig.p95Multiplier
      nodeStats[n.id] = { ingressRps: ingress, egressRps: egress, utilization: 0, modeledP50Ms: p50, modeledP95Ms: p95, warnings: [] }
    } else if (n.type === 'Datastore') {
      // Aggregate incoming edges by opType for cost units
      const inEdges = edgesByTo.get(n.id) ?? []
      const dsIngress = datastoreCostedIngress(
        inEdges.map((e) => ({ rps: edgeStats[e.id]?.flowRps ?? incoming[n.id] /* fallback */, opType: e.opType })),
        n.dials,
      )
      let capacity = n.dials.maxQps
      const pool = Math.max(1, n.dials.poolSize ?? Number.POSITIVE_INFINITY)
      const maxConc = Math.max(1, n.dials.maxConcurrent ?? Number.POSITIVE_INFINITY)
      const poolClamp = isFinite(pool) && isFinite(maxConc) ? pool * maxConc : isFinite(pool) ? pool : isFinite(maxConc) ? maxConc : Infinity
      if (isFinite(poolClamp)) capacity = Math.min(capacity, poolClamp)
      capacity *= n.penalties?.capacityMultiplier ?? 1
      if (n.penalties?.fixedRpsCap != null) capacity = Math.min(capacity, n.penalties.fixedRpsCap)
      const rho = dsIngress.costUnits / Math.max(capacity, EPSILON)
      let p50 = n.dials.p95Ms / 1.5
      // Inflate latency under writes proportionally
      if (dsIngress.writes > 0 && (n.dials.lockContentionFactor ?? 0) > 0) {
        const writeShare = dsIngress.writes / Math.max(dsIngress.costUnits, EPSILON)
        p50 = p50 * (1 + writeShare * (n.dials.lockContentionFactor ?? 0))
      }
      p50 = p50 * (n.penalties?.latencyMultiplier ?? 1) + (n.penalties?.latencyMsAdd ?? 0)
      const p95 = p50 * defaultEngineConfig.p95Multiplier
      // Egress in QPS terms is min(total ingress rps, capacity in cost units) approximated by scaling
      const totalIngressRps = ingress
      const capacityShare = Math.min(1, capacity / Math.max(dsIngress.costUnits, EPSILON))
      let egress = totalIngressRps * capacityShare
      egress = Math.min(egress, n.penalties?.fixedRpsCap ?? Infinity)
      egress = egress * (n.penalties?.throughputMultiplier ?? 1)
      const backlog = Math.max(0, dsIngress.costUnits - capacity)
      if (backlog > 0) bottlenecks.push({ id: n.id, reason: 'Datastore capacity limit' })
      nodeStats[n.id] = {
        ingressRps: totalIngressRps,
        egressRps: egress,
        utilization: rho,
        modeledP50Ms: p50,
        modeledP95Ms: p95,
        backlogRps: backlog > 0 ? backlog : undefined,
        warnings: [],
        details: { datastore: { reads: dsIngress.reads, writes: dsIngress.writes, costUnits: dsIngress.costUnits, capacity } },
      }
    }

    // After node egress is determined, compute acceptance ratio and annotate incoming edges with delivered vs blocked
    const inEdgesForNode = edgesByTo.get(nodeId) ?? []
    const ns = nodeStats[nodeId]
    const acceptanceRatio = ns.ingressRps > 0 ? Math.min(1, ns.egressRps / Math.max(ns.ingressRps, EPSILON)) : 1
    for (const ie of inEdgesForNode) {
      const es = edgeStats[ie.id]
      if (!es) continue
      const delivered = es.flowRps * acceptanceRatio
      const blocked = Math.max(0, es.flowRps - delivered)
      es.deliveredRps = delivered
      es.blockedRps = (es.blockedRps ?? 0) + blocked
      if (blocked > 0) es.warnings.push(`Target constrained: blocked ${blocked.toFixed(2)}/s`)
    }

    // Distribute egress across outgoing edges using weights, apply edge shapers, accumulate into targets
    const outs = edgesByFrom.get(nodeId) ?? []
    const fromStats = nodeStats[nodeId]
    const fromNode = graph.nodes.find((x) => x.id === nodeId)
    const duplicate = fromNode?.type === 'Service' && fromNode.dials.fanOut === 'duplicate'
    const totalWeight = outs.reduce((s, e) => s + (e.weight ?? 1), 0) || 1
    for (const e of outs) {
      let flow = duplicate ? fromStats.egressRps : fromStats.egressRps * ((e.weight ?? 1) / totalWeight)
      // Kafka producer bound when flowing into topic
      if (e.protocol === 'Kafka') {
        const toNode = graph.nodes.find((x) => x.id === e.to)
        const fromNode = graph.nodes.find((x) => x.id === e.from)
        if (toNode && toNode.type === 'QueueTopic') {
          const effParts = effectivePartitions(toNode.dials.partitions, e.keySkew)
          const perPart = toNode.dials.perPartitionThroughput
          const producerCap = effParts * perPart
          const producerPar = (fromNode && fromNode.type === 'Service') ? (fromNode.dials.concurrency) : Infinity
          const producerBound = Math.min(producerCap, (isFinite(producerPar) ? producerPar * perPart : Infinity))
          flow = Math.min(flow, producerBound)
        }
      }
      // Accumulate and record edge stats
      incoming[e.to] = (incoming[e.to] || 0) + flow
      const latencyMs = edgeTransportLatencyMs(e)
      const warnings: string[] = []
      edgeStats[e.id] = { flowRps: flow, modeledLatencyMs: latencyMs, deliveredRps: flow, blockedRps: 0, warnings }
    }
  }

  return { nodeStats, edgeStats, global: { warnings: globalWarnings, bottlenecks } }
}



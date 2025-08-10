import type {
  GraphModel,
  ScenarioResult,
  ServiceNode,
  QueueTopicNode,
  Edge,
} from '../graph/types'

const EPSILON = 1e-6

export type EngineConfig = {
  networkBaseMs: number
  linkMBps: number
  p95Multiplier: number
}

export const defaultEngineConfig: EngineConfig = {
  networkBaseMs: 4,
  linkMBps: 100,
  p95Multiplier: 2,
}

function effectiveServiceTimeMs(node: ServiceNode): number {
  const base = Math.max(node.dials.serviceTimeMs, EPSILON)
  const cacheHitRate = Math.max(0, Math.min(node.dials.cacheHitRate ?? 0, 1))
  const cacheHitMs = Math.max(0, node.dials.cacheHitMs ?? 0)
  const noCachePortion = 1 - cacheHitRate
  const coldStartRate = Math.max(0, Math.min(node.dials.coldStartRate ?? 0, 1))
  const coldStartMs = Math.max(0, node.dials.coldStartMs ?? 0)
  // Expected effective mean per request
  return noCachePortion * base + cacheHitRate * cacheHitMs + coldStartRate * coldStartMs
}

function serviceCapacityRps(node: ServiceNode): number {
  const eff = Math.max(0, Math.min(node.dials.parallelEfficiency ?? 1, 1))
  const serviceTime = effectiveServiceTimeMs(node)
  return node.dials.concurrency * eff * (1000 / Math.max(serviceTime, EPSILON))
}

function computeEdgeLatencyMs(edge: Edge, config: EngineConfig): number {
  if (edge.protocol === 'Kafka') return 0
  const payload = edge.dials.payloadBytes ?? 0
  const xferMs = (payload / (config.linkMBps * 1024 * 1024)) * 1000
  const base = config.networkBaseMs + xferMs
  const retries = Math.max(0, edge.dials.retries ?? 0)
  const retryBackoffMs = Math.max(0, edge.dials.retryBackoffMs ?? 0)
  const retryProb = Math.max(0, Math.min(edge.dials.errorRate ?? 0, 1))
  // Expected added latency from retries on the fraction that retry
  const retryCost = retries * (base + retryBackoffMs) * retryProb
  const latencyMultiplier = edge.penalties?.latencyMultiplier ?? 1
  const latencyAdd = edge.penalties?.latencyMsAdd ?? 0
  let total = (base + retryCost) * latencyMultiplier + latencyAdd
  const timeout = edge.dials.clientTimeoutMs
  if (timeout) total = Math.min(total, timeout)
  return total
}

export function computeScenario(graph: GraphModel, config: EngineConfig = defaultEngineConfig): ScenarioResult {
  const nodeStats: ScenarioResult['nodeStats'] = {}
  const edgeStats: ScenarioResult['edgeStats'] = {}
  const globalWarnings: string[] = []
  const bottlenecks: Array<{ id: string; reason: string }> = []

  // Seed incoming with API entrypoints
  const incoming: Record<string, number> = {}
  for (const n of graph.nodes) incoming[n.id] = 0
  for (const n of graph.nodes) if (n.type === 'ApiEndpoint') incoming[n.id] += n.dials.targetQps

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

  // Compute node stats in order and propagate flows
  for (const nodeId of ordered) {
    const n = graph.nodes.find((x) => x.id === nodeId)!
    const ingress = incoming[nodeId] || 0

    if (n.type === 'Service') {
      let capacity = serviceCapacityRps(n)
      // Apply penalties and optional caps
      const capMult = n.penalties?.capacityMultiplier ?? 1
      capacity *= capMult
      if (n.penalties?.fixedRpsCap != null) capacity = Math.min(capacity, n.penalties.fixedRpsCap)
      if (n.dials.maxInFlight != null) capacity = Math.min(capacity, n.dials.maxInFlight)
      const rho = ingress / Math.max(capacity, EPSILON)
      const baseServiceMs = effectiveServiceTimeMs(n)
      const queueMs = rho > 0.7 ? Math.pow(rho, 3) * baseServiceMs : 0
      let p50 = baseServiceMs + queueMs
      p50 = p50 * (n.penalties?.latencyMultiplier ?? 1) + (n.penalties?.latencyMsAdd ?? 0)
      const p95 = p50 * defaultEngineConfig.p95Multiplier
      let egress = Math.min(ingress, capacity)
      egress = Math.min(egress, n.penalties?.fixedRpsCap ?? Infinity)
      egress = egress * (n.penalties?.throughputMultiplier ?? 1)
      const backlog = Math.max(0, ingress - capacity)
      // Wasted concurrency when consuming from Kafka topics due to partition limits
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
      if (rho >= 1) warnings.push(`Inbound ${ingress.toFixed(1)} RPS exceeds service capacity (${capacity.toFixed(1)}). Backlog growing by ${(ingress - capacity).toFixed(1)} RPS.`)
      else if (rho >= 0.85) warnings.push('High utilization (≥0.85)')
      else if (rho >= 0.7) warnings.push('Elevated utilization (≥0.70)')
      if (backlog > 0) bottlenecks.push({ id: n.id, reason: 'Capacity exceeded' })
      nodeStats[n.id] = { ingressRps: ingress, egressRps: egress, utilization: rho, modeledP50Ms: p50, modeledP95Ms: p95, backlogRps: backlog > 0 ? backlog : undefined, wastedConcurrency, warnings }
    } else if (n.type === 'QueueTopic') {
      const topic = n as QueueTopicNode
      let capacity = topic.dials.partitions * topic.dials.perPartitionThroughput
      capacity *= n.penalties?.capacityMultiplier ?? 1
      if (n.penalties?.fixedRpsCap != null) capacity = Math.min(capacity, n.penalties.fixedRpsCap)
      let egress = Math.min(ingress, capacity)
      egress = Math.min(egress, n.penalties?.fixedRpsCap ?? Infinity)
      egress = egress * (n.penalties?.throughputMultiplier ?? 1)
      const consumerLagRps = Math.max(0, ingress - egress)
      nodeStats[n.id] = { ingressRps: ingress, egressRps: egress, utilization: ingress / Math.max(capacity, EPSILON), modeledP50Ms: 0, modeledP95Ms: 0, consumerLagRps: consumerLagRps > 0 ? consumerLagRps : undefined, warnings: [] }
    } else if (n.type === 'ApiEndpoint') {
      const burst = Math.max(0.0001, n.dials.burstFactor ?? 1)
      const effIngress = ingress * burst
      let egress = effIngress
      if (n.penalties?.fixedRpsCap != null) egress = Math.min(egress, n.penalties.fixedRpsCap)
      egress = egress * (n.penalties?.throughputMultiplier ?? 1)
      const p50Base = n.dials.p50Ms ?? 0
      const p50 = p50Base * (n.penalties?.latencyMultiplier ?? 1) + (n.penalties?.latencyMsAdd ?? 0)
      const p95 = n.dials.p95Ms != null ? n.dials.p95Ms : p50 * defaultEngineConfig.p95Multiplier
      nodeStats[n.id] = { ingressRps: effIngress, egressRps: egress, utilization: 0, modeledP50Ms: p50, modeledP95Ms: p95, warnings: [] }
    } else if (n.type === 'Datastore') {
      let capacity = n.dials.maxQps
      const pool = Math.max(1, n.dials.connectionPoolSize ?? Number.POSITIVE_INFINITY)
      const maxConc = Math.max(1, n.dials.maxConcurrentRequests ?? Number.POSITIVE_INFINITY)
      const poolClamp = isFinite(pool) && isFinite(maxConc) ? pool * maxConc : isFinite(pool) ? pool : isFinite(maxConc) ? maxConc : Infinity
      if (isFinite(poolClamp)) capacity = Math.min(capacity, poolClamp)
      capacity *= n.penalties?.capacityMultiplier ?? 1
      if (n.penalties?.fixedRpsCap != null) capacity = Math.min(capacity, n.penalties.fixedRpsCap)
      const rho = ingress / Math.max(capacity, EPSILON)
      let p50 = n.dials.p95Ms / 1.5
      p50 = p50 * (n.penalties?.latencyMultiplier ?? 1) + (n.penalties?.latencyMsAdd ?? 0)
      const p95 = p50 * defaultEngineConfig.p95Multiplier
      let egress = Math.min(ingress, capacity)
      egress = Math.min(egress, n.penalties?.fixedRpsCap ?? Infinity)
      egress = egress * (n.penalties?.throughputMultiplier ?? 1)
      const backlog = Math.max(0, ingress - capacity)
      if (backlog > 0) bottlenecks.push({ id: n.id, reason: 'Datastore QPS limit' })
      nodeStats[n.id] = { ingressRps: ingress, egressRps: egress, utilization: rho, modeledP50Ms: p50, modeledP95Ms: p95, backlogRps: backlog > 0 ? backlog : undefined, warnings: [] }
    }

    // Distribute egress evenly across outgoing edges and accumulate into targets
    const outs = graph.edges.filter((e) => e.from === nodeId)
    const fromStats = nodeStats[nodeId]
    const perEdge = outs.length > 0 ? fromStats.egressRps / outs.length : 0
    for (const e of outs) {
      let flow = perEdge
      if (e.protocol === 'Kafka') {
        const toNode = graph.nodes.find((x) => x.id === e.to)
        if (toNode && toNode.type === 'QueueTopic') {
          const partCap = toNode.dials.perPartitionThroughput
          const partitions = toNode.dials.partitions
          const keySkew = e.dials.keySkew ?? 0
          const penalty = keySkew * keySkew
          const producerCap = partitions * partCap * (1 - penalty)
          flow = Math.min(flow, producerCap)
        }
      }
      // Apply edge-level throughput penalties and caps
      if (e.penalties?.fixedRpsCap != null) flow = Math.min(flow, e.penalties.fixedRpsCap)
      flow = flow * (e.penalties?.throughputMultiplier ?? 1)
      incoming[e.to] = (incoming[e.to] || 0) + flow
      const latencyMs = computeEdgeLatencyMs(e, config)
      const warnings: string[] = []
      if (e.dials.clientTimeoutMs && latencyMs >= e.dials.clientTimeoutMs) warnings.push('Edge latency hits client timeout')
      edgeStats[e.id] = { flowRps: flow, modeledLatencyMs: latencyMs, warnings }
    }
  }

  return { nodeStats, edgeStats, global: { warnings: globalWarnings, bottlenecks } }
}



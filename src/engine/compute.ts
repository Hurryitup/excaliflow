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

function serviceCapacityRps(node: ServiceNode): number {
  return node.dials.concurrency * (1000 / Math.max(node.dials.serviceTimeMs, EPSILON))
}

function computeEdgeLatencyMs(edge: Edge, config: EngineConfig): number {
  if (edge.protocol === 'Kafka') return 0
  const payload = edge.dials.payloadBytes ?? 0
  const xferMs = (payload / (config.linkMBps * 1024 * 1024)) * 1000
  const total = config.networkBaseMs + xferMs
  const timeout = edge.dials.clientTimeoutMs
  return timeout ? Math.min(total, timeout) : total
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
      const capacity = serviceCapacityRps(n)
      const rho = ingress / Math.max(capacity, EPSILON)
      const queueMs = rho > 0.7 ? Math.pow(rho, 3) * n.dials.serviceTimeMs : 0
      const p50 = n.dials.serviceTimeMs + queueMs
      const p95 = p50 * defaultEngineConfig.p95Multiplier
      const egress = Math.min(ingress, capacity)
      const backlog = Math.max(0, ingress - capacity)
      const warnings: string[] = []
      if (rho >= 1) warnings.push(`Inbound ${ingress.toFixed(1)} RPS exceeds service capacity (${capacity.toFixed(1)}). Backlog growing by ${(ingress - capacity).toFixed(1)} RPS.`)
      else if (rho >= 0.85) warnings.push('High utilization (≥0.85)')
      else if (rho >= 0.7) warnings.push('Elevated utilization (≥0.70)')
      if (backlog > 0) bottlenecks.push({ id: n.id, reason: 'Capacity exceeded' })
      nodeStats[n.id] = { ingressRps: ingress, egressRps: egress, utilization: rho, modeledP50Ms: p50, modeledP95Ms: p95, backlogRps: backlog > 0 ? backlog : undefined, warnings }
    } else if (n.type === 'QueueTopic') {
      const topic = n as QueueTopicNode
      const capacity = topic.dials.partitions * topic.dials.perPartitionThroughput
      const egress = Math.min(ingress, capacity)
      nodeStats[n.id] = { ingressRps: ingress, egressRps: egress, utilization: ingress / Math.max(capacity, EPSILON), modeledP50Ms: 0, modeledP95Ms: 0, warnings: [] }
    } else if (n.type === 'ApiEndpoint') {
      nodeStats[n.id] = { ingressRps: ingress, egressRps: ingress, utilization: 0, modeledP50Ms: n.dials.p50Ms ?? 0, modeledP95Ms: n.dials.p95Ms ?? 0, warnings: [] }
    } else if (n.type === 'Datastore') {
      const capacity = n.dials.maxQps
      const rho = ingress / Math.max(capacity, EPSILON)
      const p50 = n.dials.p95Ms / 1.5
      const p95 = n.dials.p95Ms
      const egress = Math.min(ingress, capacity)
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
      incoming[e.to] = (incoming[e.to] || 0) + flow
      const latencyMs = computeEdgeLatencyMs(e, config)
      const warnings: string[] = []
      if (e.dials.clientTimeoutMs && latencyMs >= e.dials.clientTimeoutMs) warnings.push('Edge latency hits client timeout')
      edgeStats[e.id] = { flowRps: flow, modeledLatencyMs: latencyMs, warnings }
    }
  }

  return { nodeStats, edgeStats, global: { warnings: globalWarnings, bottlenecks } }
}



import type { Edge, GraphModel } from './types'

export function validateGraph(graph: GraphModel): string[] {
  const warnings: string[] = []

  // Edge protocol compatibility and Kafka constraints
  for (const edge of graph.edges) {
    const from = graph.nodes.find((n) => n.id === edge.from)
    const to = graph.nodes.find((n) => n.id === edge.to)
    if (!from || !to) continue
    if (edge.protocol === 'Kafka') {
      const ok =
        (from.type === 'Service' && to.type === 'QueueTopic') ||
        (from.type === 'QueueTopic' && to.type === 'Service')
      if (!ok) warnings.push(`Invalid Kafka edge ${edge.id}: ${from.type}→${to.type}`)
      // keySkew only valid when to is QueueTopic
      if (edge.keySkew != null && to.type !== 'QueueTopic') {
        warnings.push(`Edge ${edge.id} keySkew is only valid when target is a QueueTopic`)
      }
    }
  }

  // QueueTopic validations
  for (const node of graph.nodes) {
    if (node.type === 'QueueTopic') {
      if (node.dials.partitions <= 0 || !Number.isInteger(node.dials.partitions))
        warnings.push(`Topic ${node.label} partitions must be positive integers`)
      if (node.dials.perPartitionThroughput <= 0)
        warnings.push(`Topic ${node.label} per-partition throughput must be > 0`)
    }
  }

  // Kafka realism: service concurrency vs topic partitions when consuming
  for (const edge of graph.edges) {
    const from = graph.nodes.find((n) => n.id === edge.from)
    const to = graph.nodes.find((n) => n.id === edge.to)
    if (!from || !to) continue
    // Consuming from topic -> service
    if (edge.protocol === 'Kafka' && from.type === 'QueueTopic' && to.type === 'Service') {
      const partitions = from.dials.partitions
      const consumerPar = to.dials.concurrency
      const eff = Math.max(0, Math.min(to.dials.parallelEfficiency ?? 1, 1))
      const maxUseful = partitions * eff
      if (consumerPar > maxUseful) warnings.push(`Service ${to.label} concurrency (${consumerPar}) exceeds useful parallelism from partitions (${maxUseful.toFixed(2)}). Excess parallelism may be wasted.`)
    }
  }

  // Sanity: multipliers and probabilities bounds
  for (const node of graph.nodes) {
    const p = node.penalties
    if (p) {
      if ((p.capacityMultiplier ?? 1) < 0) warnings.push(`Negative capacity multiplier on ${node.label}`)
      if ((p.throughputMultiplier ?? 1) < 0) warnings.push(`Negative throughput multiplier on ${node.label}`)
      if ((p.latencyMultiplier ?? 1) < 0) warnings.push(`Negative latency multiplier on ${node.label}`)
      if ((p.fixedRpsCap ?? Infinity) < 0) warnings.push(`Negative fixedRpsCap on ${node.label}`)
    }
    if (node.type === 'Service') {
      const r = node.dials
      const pe = r.parallelEfficiency
      if (pe != null && (pe < 0 || pe > 1)) warnings.push(`Service ${node.label} parallelEfficiency must be 0..1`)
      const chr = r.cacheHitRate
      if (chr != null && (chr < 0 || chr > 1)) warnings.push(`Service ${node.label} cacheHitRate must be 0..1`)
    }
  }

  // Edge shaper sanity
  for (const edge of graph.edges) {
    const ks = edge.keySkew
    if (ks != null && (ks < 0 || ks > 1)) warnings.push(`Edge ${edge.id} keySkew must be 0..1`)
  }

  // Simple cycle detection through Kafka topics (disallow by default)
  const adjacency = new Map<string, string[]>()
  for (const n of graph.nodes) adjacency.set(n.id, [])
  for (const e of graph.edges) adjacency.get(e.from)?.push(e.to)

  const visiting = new Set<string>()
  const visited = new Set<string>()
  function dfs(nodeId: string): boolean {
    visiting.add(nodeId)
    for (const nxt of adjacency.get(nodeId) ?? []) {
      if (!visited.has(nxt)) {
        if (visiting.has(nxt)) return true
        if (dfs(nxt)) return true
      }
    }
    visiting.delete(nodeId)
    visited.add(nodeId)
    return false
  }

  for (const n of graph.nodes) {
    if (!visited.has(n.id) && dfs(n.id)) {
      warnings.push('Cycle detected in graph (Kafka cycles disabled by default)')
      break
    }
  }

  return warnings
}

export function edgeById(graph: GraphModel, id: string): Edge | undefined {
  return graph.edges.find((e) => e.id === id)
}



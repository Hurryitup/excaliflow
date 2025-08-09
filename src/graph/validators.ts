import type { Edge, GraphModel } from './types'

export function validateGraph(graph: GraphModel): string[] {
  const warnings: string[] = []

  // Edge protocol compatibility
  for (const edge of graph.edges) {
    const from = graph.nodes.find((n) => n.id === edge.from)
    const to = graph.nodes.find((n) => n.id === edge.to)
    if (!from || !to) continue
    if (edge.protocol === 'Kafka') {
      const ok =
        (from.type === 'Service' && to.type === 'QueueTopic') ||
        (from.type === 'QueueTopic' && to.type === 'Service')
      if (!ok) warnings.push(`Invalid Kafka edge ${edge.id}: ${from.type}→${to.type}`)
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



import { useCallback } from 'react'
import dagre from 'dagre'
import type { GraphModel } from '../graph/types'

export type LayoutDirection = 'TB' | 'LR'

export function useAutoLayout() {
  const run = useCallback((graph: GraphModel, direction: LayoutDirection = 'TB'): GraphModel => {
    const g = new dagre.graphlib.Graph()
    g.setGraph({ rankdir: direction, nodesep: 90, ranksep: 90 })
    g.setDefaultEdgeLabel(() => ({}))

    const sizeFor = (type: string) => {
      switch (type) {
        case 'ApiEndpoint':
          return { width: 180, height: 56 }
        case 'Service':
          return { width: 220, height: 56 }
        case 'QueueTopic':
          return { width: 260, height: 56 }
        case 'Datastore':
          return { width: 220, height: 56 }
        default:
          return { width: 200, height: 56 }
      }
    }

    for (const n of graph.nodes) {
      const sz = sizeFor(n.type)
      g.setNode(n.id, sz)
    }
    for (const e of graph.edges) {
      g.setEdge(e.from, e.to)
    }
    dagre.layout(g)

    const nodes = graph.nodes.map((n) => {
      const pos = g.node(n.id)
      const sz = sizeFor(n.type)
      return { ...n, position: { x: pos.x - sz.width / 2, y: pos.y - sz.height / 2 } }
    })
    return { ...graph, nodes }
  }, [])

  return { run }
}



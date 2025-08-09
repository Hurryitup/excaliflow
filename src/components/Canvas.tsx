import { useMemo, useCallback, useEffect, useRef } from 'react'
import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, ReactFlowProvider, MarkerType } from 'reactflow'
import type { Connection, Edge as RFEdge, Node as RFNode, NodeMouseHandler, EdgeMouseHandler, OnNodesDelete, OnEdgesDelete, NodeChange } from 'reactflow'
import 'reactflow/dist/style.css'

import { useGraphStore } from '../graph/store'
import type { GraphModel } from '../graph/types'
import ApiNode from './nodes/ApiNode'
import ServiceNode from './nodes/ServiceNode'
import TopicNode from './nodes/TopicNode'
import DatastoreNode from './nodes/DatastoreNode'

const NODE_TYPES = {
  ApiEndpoint: ApiNode,
  Service: ServiceNode,
  QueueTopic: TopicNode,
  Datastore: DatastoreNode,
} as const

function toRF(graph: GraphModel): { nodes: RFNode[]; edges: RFEdge[] } {
  const nodes: RFNode[] = graph.nodes.map((n) => ({
    id: n.id,
    position: n.position,
    data: { label: n.label, type: n.type },
    type: n.type as any,
  }))
  const edges: RFEdge[] = graph.edges.map((e) => ({ id: e.id, source: e.from, target: e.to, label: e.label }))
  return { nodes, edges }
}

function CanvasInner() {
  const graph = useGraphStore((s) => s.graph)
  const connectEdge = useGraphStore((s) => s.connectEdge)
  const select = useGraphStore((s) => s.select)
  const deleteNode = useGraphStore((s) => s.deleteNode)
  const deleteEdge = useGraphStore((s) => s.deleteEdge)
  const updateNode = useGraphStore((s) => s.updateNode)
  // no rfInstance usage for now; rely on React Flow callbacks

  const rf = useMemo(() => toRF(graph), [graph.nodes, graph.edges])
  const [nodes, setNodes, onNodesChange] = useNodesState(rf.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(rf.edges)
  const connectStartRef = useRef<{ nodeId: string; handleId?: string; handleType?: 'source' | 'target' } | null>(null)

  useEffect(() => {
    // preserve existing positions and only update labels/new items
    setNodes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]))
      return rf.nodes.map((n) => {
        const found = byId.get(n.id)
        return {
          ...(found ?? n),
          id: n.id,
          data: n.data,
          type: n.type,
          position: found?.position ?? n.position,
        }
      })
    })
    setEdges((prev) => {
      const byId = new Map(prev.map((e) => [e.id, e]))
      return rf.edges.map((e) => ({
        ...(byId.get(e.id) ?? e),
        label: e.label,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#111827' },
        sourceHandle: (graph.edges.find((ge) => ge.id === e.id)?.fromHandle as string | undefined) ?? undefined,
        targetHandle: (graph.edges.find((ge) => ge.id === e.id)?.toHandle as string | undefined) ?? undefined,
      }))
    })
  }, [rf.nodes, rf.edges, setNodes, setEdges])

  // Initial fit is handled by fitView; avoid auto-fitting on each update to preserve layout

  const onConnectStart = useCallback((_: unknown, params: any) => {
    connectStartRef.current = { nodeId: params?.nodeId, handleId: params?.handleId, handleType: params?.handleType as 'source' | 'target' | undefined }
  }, [])

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target) return
      const started = connectStartRef.current
      let from = c.source
      let to = c.target
      let fromHandle = c.sourceHandle ?? undefined
      let toHandle = c.targetHandle ?? undefined

      if (started && started.nodeId) {
        // Force actual start node as source
        if (started.nodeId === c.source) {
          from = c.source
          to = c.target
          fromHandle = c.sourceHandle ?? started.handleId ?? undefined
          toHandle = c.targetHandle ?? undefined
        } else if (started.nodeId === c.target) {
          from = c.target
          to = c.source
          fromHandle = c.targetHandle ?? started.handleId ?? undefined
          toHandle = c.sourceHandle ?? undefined
        } else {
          from = started.nodeId
          to = c.source
          fromHandle = started.handleId ?? undefined
          toHandle = c.sourceHandle ?? undefined
        }
      }

      const ensureType = (id: string | undefined, want: 'source' | 'target') => {
        if (!id) return id
        const suffix = id.endsWith('-source') ? 'source' : id.endsWith('-target') ? 'target' : undefined
        if (!suffix) return id
        if (suffix === want) return id
        return want === 'source' ? id.replace('-target', '-source') : id.replace('-source', '-target')
      }
      fromHandle = ensureType(fromHandle, 'source')
      toHandle = ensureType(toHandle, 'target')
      // Smart default protocol by actual from node
      const fromNode = graph.nodes.find((n) => n.id === from)
      const protocol: 'REST' | 'gRPC' | 'Kafka' = fromNode?.type === 'QueueTopic' ? 'Kafka' : 'REST'
      connectEdge({ id: crypto.randomUUID(), from, to, fromHandle, toHandle, protocol, dials: {} })
      connectStartRef.current = null
    },
    [connectEdge, graph.nodes],
  )

  const onNodeClick: NodeMouseHandler = useCallback((_, n) => {
    select(n.id)
  }, [select])

  const onEdgeClick: EdgeMouseHandler = useCallback((_, e) => {
    select(e.id)
  }, [select])

  // propagate moved node positions back into the store
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes)
      for (const ch of changes) {
        if (ch.type === 'position' && (ch as any).position) {
          const pos = (ch as any).position as { x: number; y: number }
          updateNode(ch.id, (n: any) => (n.position = pos))
        }
      }
    },
    [onNodesChange, updateNode],
  )

  const onNodesDelete: OnNodesDelete = useCallback((deleted) => {
    for (const n of deleted) deleteNode(n.id)
  }, [deleteNode])

  const onEdgesDelete: OnEdgesDelete = useCallback((deleted) => {
    for (const e of deleted) deleteEdge(e.id)
  }, [deleteEdge])

  return (
      <ReactFlow
      nodeTypes={NODE_TYPES}
      nodes={nodes}
      edges={edges}
        onNodesChange={handleNodesChange}
      onEdgesChange={onEdgesChange}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
      onConnectStart={onConnectStart}
      onConnect={onConnect}
      onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onSelectionChange={(sel) => {
          if (sel.edges.length > 0) select(sel.edges[0].id)
          else if (sel.nodes.length > 0) select(sel.nodes[0].id)
          else select(undefined)
        }}
      fitView
      snapToGrid
      snapGrid={[16, 16]}
        deleteKeyCode={["Backspace", "Delete"]}
    >
      <Background gap={16} />
      <MiniMap />
      <Controls />
    </ReactFlow>
  )
}

export default function Canvas() {
  const viewportVersion = useGraphStore((s) => s.viewportVersion)
  return (
    <div key={viewportVersion} style={{ width: '100%', height: '100%' }}>
      <ReactFlowProvider>
        <CanvasInner />
      </ReactFlowProvider>
    </div>
  )
}



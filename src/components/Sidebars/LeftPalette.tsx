import React from 'react'
import { useGraphStore } from '../../graph/store'
import type { ServiceNode, QueueTopicNode, ApiEndpointNode, DatastoreNode } from '../../graph/types'

function makeService(center: { x: number; y: number }): ServiceNode {
  return {
    id: crypto.randomUUID(),
    type: 'Service',
    label: 'Service',
    position: center,
    dials: { concurrency: 4, serviceTimeMs: 20, parallelEfficiency: 1 },
  }
}

function makeTopic(center: { x: number; y: number }): QueueTopicNode {
  return {
    id: crypto.randomUUID(),
    type: 'QueueTopic',
    label: 'Topic',
    position: center,
    dials: { partitions: 6, perPartitionThroughput: 200 },
  }
}

function makeApi(center: { x: number; y: number }): ApiEndpointNode {
  return {
    id: crypto.randomUUID(),
    type: 'ApiEndpoint',
    label: 'API',
    position: center,
    dials: { targetQps: 500, burstFactor: 1 },
  }
}

function makeStore(center: { x: number; y: number }): DatastoreNode {
  return {
    id: crypto.randomUUID(),
    type: 'Datastore',
    label: 'DB',
    position: center,
    dials: { maxQps: 1000, p95Ms: 30 },
  }
}

export default function LeftPalette() {
  const addNode = useGraphStore((s) => s.addNode)
  const select = useGraphStore((s) => s.select)
  const center = useGraphStore((s) => s.viewportCenter ?? { x: 0, y: 0 })
  const [open, setOpen] = React.useState(true)
  return (
    <div style={{ width: 240, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 12, background: 'rgba(255,255,255,.9)', border: '1px solid #e5e7eb', boxShadow: '0 4px 14px rgba(0,0,0,.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Nodes</h3>
        <button onClick={() => setOpen((v) => !v)} title={open ? 'Collapse' : 'Expand'}>{open ? '▾' : '▸'}</button>
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button style={{ border: '2px solid #3b82f6', background: '#eff6ff', color: '#0b4fbf' }} onClick={() => { const n = makeApi(center); addNode(n); select(n.id) }}>API Endpoint</button>
          <button style={{ border: '2px solid #10b981', background: '#ecfdf5', color: '#065f46' }} onClick={() => { const n = makeService(center); addNode(n); select(n.id) }}>Service</button>
          <button style={{ border: '2px dashed #f59e0b', background: '#fffbeb', color: '#92400e' }} onClick={() => { const n = makeTopic(center); addNode(n); select(n.id) }}>Queue/Topic</button>
          <button style={{ border: '2px solid #8b5cf6', background: '#f5f3ff', color: '#4c1d95' }} onClick={() => { const n = makeStore(center); addNode(n); select(n.id) }}>Datastore</button>
        </div>
      )}
    </div>
  )
}



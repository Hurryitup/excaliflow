import React from 'react'
import { useGraphStore } from '../../graph/store'
import type { ServiceNode, QueueTopicNode, ApiEndpointNode, DatastoreNode } from '../../graph/types'

function makeService(): ServiceNode {
  return {
    id: crypto.randomUUID(),
    type: 'Service',
    label: 'Service',
    position: { x: 100, y: 100 },
    dials: { concurrency: 4, serviceTimeMs: 20 },
  }
}

function makeTopic(): QueueTopicNode {
  return {
    id: crypto.randomUUID(),
    type: 'QueueTopic',
    label: 'Topic',
    position: { x: 100, y: 250 },
    dials: { partitions: 6, perPartitionThroughput: 200 },
  }
}

function makeApi(): ApiEndpointNode {
  return {
    id: crypto.randomUUID(),
    type: 'ApiEndpoint',
    label: 'API',
    position: { x: 100, y: 25 },
    dials: { targetQps: 500 },
  }
}

function makeStore(): DatastoreNode {
  return {
    id: crypto.randomUUID(),
    type: 'Datastore',
    label: 'DB',
    position: { x: 100, y: 400 },
    dials: { maxQps: 1000, p95Ms: 30 },
  }
}

export default function LeftPalette() {
  const addNode = useGraphStore((s) => s.addNode)
  const select = useGraphStore((s) => s.select)
  const [open, setOpen] = React.useState(true)
  return (
    <div style={{ width: 240, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 12, background: 'rgba(255,255,255,.9)', border: '1px solid #e5e7eb', boxShadow: '0 4px 14px rgba(0,0,0,.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Nodes</h3>
        <button onClick={() => setOpen((v) => !v)} title={open ? 'Collapse' : 'Expand'}>{open ? '▾' : '▸'}</button>
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button style={{ border: '2px solid #3b82f6', background: '#eff6ff', color: '#0b4fbf' }} onClick={() => { const n = makeApi(); addNode(n); select(n.id) }}>API Endpoint</button>
          <button style={{ border: '2px solid #10b981', background: '#ecfdf5', color: '#065f46' }} onClick={() => { const n = makeService(); addNode(n); select(n.id) }}>Service</button>
          <button style={{ border: '2px dashed #f59e0b', background: '#fffbeb', color: '#92400e' }} onClick={() => { const n = makeTopic(); addNode(n); select(n.id) }}>Queue/Topic</button>
          <button style={{ border: '2px solid #8b5cf6', background: '#f5f3ff', color: '#4c1d95' }} onClick={() => { const n = makeStore(); addNode(n); select(n.id) }}>Datastore</button>
        </div>
      )}
    </div>
  )
}



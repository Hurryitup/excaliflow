import React from 'react'
import { useGraphStore } from '../../graph/store'
import { dialTooltips } from '../../graph/help'
import type { Edge } from '../../graph/types'
import { edgeTooltips, genericEdgeHelp } from '../../graph/help'

export default function RightInspector() {
  const graph = useGraphStore((s) => s.graph)
  const selectedId = useGraphStore((s) => s.selectedId)
  const updateNode = useGraphStore((s) => s.updateNode)
  const updateEdge = useGraphStore((s) => s.updateEdge)
  const [advanced, setAdvanced] = React.useState<boolean>(() => {
    try {
      return JSON.parse(localStorage.getItem('inspector:advanced') ?? 'false') as boolean
    } catch {
      return false
    }
  })
  const toggle = () => {
    const next = !advanced
    setAdvanced(next)
    localStorage.setItem('inspector:advanced', JSON.stringify(next))
  }

  const node = graph.nodes.find((n) => n.id === selectedId)
  const edge = graph.edges.find((e) => e.id === selectedId)

  if (!node && !edge) return null

  if (node) return (
    <div style={{ width: 300, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.92)', border: '1px solid #e5e7eb', boxShadow: '0 4px 14px rgba(0,0,0,.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ marginTop: 0 }}>{node.label}</h3>
        <button onClick={toggle} title={advanced ? 'Switch to Simple' : 'Switch to Advanced'} style={{ fontSize: 11 }}>{advanced ? 'Advanced' : 'Simple'}</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, color: '#4b5563' }}>Label</div>
          <input
            value={node.label}
            onChange={(e) => updateNode(node.id, (n) => (n.label = e.target.value))}
            style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }}
          />
        </div>
        {node.type === 'Service' && (
          <>
            <div>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Fan-out</div>
              <select value={node.dials.fanOut ?? 'split'} onChange={(e) => updateNode(node.id, (n) => (n.dials.fanOut = e.target.value as any))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }}>
                <option value="split">split</option>
                <option value="duplicate">duplicate</option>
              </select>
            </div>
            <div title={dialTooltips.Service.concurrency}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Concurrency</div>
              <input type="number" value={node.dials.concurrency} min={1} onChange={(e) => updateNode(node.id, (n) => (n.dials.concurrency = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>
            {advanced && (
            <div title={dialTooltips.Service.parallelEfficiency}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Parallel efficiency (0..1)</div>
              <input type="number" value={node.dials.parallelEfficiency ?? 1} min={0} max={1} step={0.01} onChange={(e) => updateNode(node.id, (n) => (n.dials.parallelEfficiency = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>)}
            <div title={dialTooltips.Service.serviceTimeMs}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Service time (ms)</div>
              <input type="number" value={node.dials.serviceTimeMs} min={1} onChange={(e) => updateNode(node.id, (n) => (n.dials.serviceTimeMs = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>
            {advanced && (
            <div title={dialTooltips.Service.cacheHitRate}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Cache hit rate (0..1)</div>
              <input type="number" value={node.dials.cacheHitRate ?? 0} min={0} max={1} step={0.01} onChange={(e) => updateNode(node.id, (n) => (n.dials.cacheHitRate = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>)}
            {advanced && (
            <div title={dialTooltips.Service.cacheHitMs}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Cache hit ms</div>
              <input type="number" value={node.dials.cacheHitMs ?? 1} min={0} onChange={(e) => updateNode(node.id, (n) => (n.dials.cacheHitMs = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>)}
            {/* Kafka parallelism now modeled by concurrency only */}
          </>
        )}

        {node.type === 'QueueTopic' && (
          <>
            <div title={dialTooltips.QueueTopic.partitions}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Partitions</div>
              <input type="number" value={node.dials.partitions} min={1} onChange={(e) => updateNode(node.id, (n) => (n.dials.partitions = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>
            <div title={dialTooltips.QueueTopic.perPartitionThroughput}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Per-partition throughput (RPS)</div>
              <input type="number" value={node.dials.perPartitionThroughput} min={1} onChange={(e) => updateNode(node.id, (n) => (n.dials.perPartitionThroughput = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>
          </>
        )}

        {node.type === 'ApiEndpoint' && (
          <div title={dialTooltips.ApiEndpoint.targetQps}>
            <div style={{ fontSize: 12, color: '#4b5563' }}>Target QPS</div>
            <input type="number" value={node.dials.targetQps} min={0} onChange={(e) => updateNode(node.id, (n) => (n.dials.targetQps = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
          </div>
        )}

        {node.type === 'Datastore' && (
          <>
            <div title={dialTooltips.Datastore.maxQps}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Max QPS</div>
              <input type="number" value={node.dials.maxQps} min={1} onChange={(e) => updateNode(node.id, (n) => (n.dials.maxQps = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>
            <div title={dialTooltips.Datastore.p95Ms}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>P95 (ms)</div>
              <input type="number" value={node.dials.p95Ms} min={1} onChange={(e) => updateNode(node.id, (n) => (n.dials.p95Ms = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>
            {advanced && (<div title={dialTooltips.Datastore.writeAmplification}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Write amplification</div>
              <input type="number" value={node.dials.writeAmplification ?? 4} min={1} onChange={(e) => updateNode(node.id, (n) => (n.dials.writeAmplification = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>)}
            {advanced && (<div title={dialTooltips.Datastore.lockContentionFactor}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Lock contention factor</div>
              <input type="number" value={node.dials.lockContentionFactor ?? 0} min={0} step={0.1} onChange={(e) => updateNode(node.id, (n) => (n.dials.lockContentionFactor = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>)}
            {advanced && (<div title={dialTooltips.Datastore.poolSize}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Pool size</div>
              <input type="number" value={node.dials.poolSize ?? 1000000} min={1} onChange={(e) => updateNode(node.id, (n) => (n.dials.poolSize = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>)}
            {advanced && (<div title={dialTooltips.Datastore.maxConcurrent}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Max concurrent</div>
              <input type="number" value={node.dials.maxConcurrent ?? 1000000} min={1} onChange={(e) => updateNode(node.id, (n) => (n.dials.maxConcurrent = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>)}
          </>
        )}
      </div>
    </div>
  )

  // Edge inspector — styled consistently with node inputs
  return (
    <div style={{ width: 300, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.92)', border: '1px solid #e5e7eb', boxShadow: '0 4px 14px rgba(0,0,0,.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ marginTop: 0 }}>Edge</h3>
        <button onClick={toggle} title={advanced ? 'Switch to Simple' : 'Switch to Advanced'} style={{ fontSize: 11 }}>{advanced ? 'Advanced' : 'Simple'}</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, color: '#4b5563' }}>Label (optional)</div>
          <input
            value={edge?.label ?? ''}
            onChange={(e) => edge && updateEdge(edge.id, (ed: Edge) => (ed.label = e.target.value))}
            style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#4b5563' }}>Protocol</div>
          <select
            value={edge?.protocol}
            onChange={(e) => edge && updateEdge(edge.id, (ed: Edge) => (ed.protocol = e.target.value as any))}
            style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }}
          >
            <option value="REST">REST</option>
            <option value="gRPC">gRPC</option>
            <option value="Kafka">Kafka</option>
          </select>
        </div>
        {/* Generic edges have no latency/timeout fields now */}
        {edge?.protocol === 'Kafka' && (
          <div title={edgeTooltips.Kafka.keySkew}>
            <div style={{ fontSize: 12, color: '#4b5563' }}>Key skew (0..1)</div>
            <input type="number" value={edge?.keySkew ?? 0} min={0} max={1} step={0.01} onChange={(e) => edge && updateEdge(edge.id, (ed) => (ed.keySkew = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
          </div>
        )}
        <div title={genericEdgeHelp.opType}>
          <div style={{ fontSize: 12, color: '#4b5563' }}>Operation type</div>
          <select value={edge?.opType ?? ''} onChange={(e) => edge && updateEdge(edge.id, (ed) => (ed.opType = (e.target.value || undefined) as any))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }}>
            <option value="">—</option>
            <option value="read">read</option>
            <option value="write">write</option>
            <option value="bulk">bulk</option>
            <option value="stream">stream</option>
          </select>
        </div>
        {/* rate limits removed; node capacity governs throughput */}
        {advanced && (<div title={genericEdgeHelp.weight}>
          <div style={{ fontSize: 12, color: '#4b5563' }}>Weight</div>
          <input type="number" value={edge?.weight ?? 1} min={0} step={0.1} onChange={(e) => edge && updateEdge(edge.id, (ed) => (ed.weight = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
        </div>)}
      </div>
    </div>
  )
}



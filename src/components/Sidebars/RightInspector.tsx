import { useGraphStore } from '../../graph/store'
import { dialTooltips } from '../../graph/help'
import type { Edge } from '../../graph/types'
import { edgeTooltips } from '../../graph/help'

export default function RightInspector() {
  const graph = useGraphStore((s) => s.graph)
  const selectedId = useGraphStore((s) => s.selectedId)
  const updateNode = useGraphStore((s) => s.updateNode)
  const updateEdge = useGraphStore((s) => s.updateEdge)

  const node = graph.nodes.find((n) => n.id === selectedId)
  const edge = graph.edges.find((e) => e.id === selectedId)

  if (!node && !edge) return null

  if (node) return (
    <div style={{ width: 300, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.92)', border: '1px solid #e5e7eb', boxShadow: '0 4px 14px rgba(0,0,0,.08)' }}>
      <h3 style={{ marginTop: 0 }}>{node.label}</h3>
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
            <div title={dialTooltips.Service.concurrency}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Concurrency</div>
              <input type="number" value={node.dials.concurrency} min={1} onChange={(e) => updateNode(node.id, (n) => (n.dials.concurrency = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>
            <div title={dialTooltips.Service.parallelEfficiency}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Parallel efficiency (0..1)</div>
              <input type="number" value={node.dials.parallelEfficiency ?? 1} min={0} max={1} step={0.01} onChange={(e) => updateNode(node.id, (n) => (n.dials.parallelEfficiency = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>
            <div title={dialTooltips.Service.serviceTimeMs}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Service time (ms)</div>
              <input type="number" value={node.dials.serviceTimeMs} min={1} onChange={(e) => updateNode(node.id, (n) => (n.dials.serviceTimeMs = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>
            <div title={dialTooltips.Service.cacheHitRate}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Cache hit rate (0..1)</div>
              <input type="number" value={node.dials.cacheHitRate ?? 0} min={0} max={1} step={0.01} onChange={(e) => updateNode(node.id, (n) => (n.dials.cacheHitRate = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>
            <div title={dialTooltips.Service.cacheHitMs}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Cache hit ms</div>
              <input type="number" value={node.dials.cacheHitMs ?? 1} min={0} onChange={(e) => updateNode(node.id, (n) => (n.dials.cacheHitMs = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>
            <div title={dialTooltips.Service.coldStartRate}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Cold start rate (0..1)</div>
              <input type="number" value={node.dials.coldStartRate ?? 0} min={0} max={1} step={0.01} onChange={(e) => updateNode(node.id, (n) => (n.dials.coldStartRate = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>
            <div title={dialTooltips.Service.coldStartMs}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Cold start ms</div>
              <input type="number" value={node.dials.coldStartMs ?? 0} min={0} onChange={(e) => updateNode(node.id, (n) => (n.dials.coldStartMs = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>
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
            <div title={dialTooltips.QueueTopic.consumerGroupConcurrency}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Consumer group concurrency</div>
              <input type="number" value={node.dials.consumerGroupConcurrency ?? 1} min={1} onChange={(e) => updateNode(node.id, (n) => (n.dials.consumerGroupConcurrency = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
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
            <div title={dialTooltips.Datastore.connectionPoolSize}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Connection pool size</div>
              <input type="number" value={node.dials.connectionPoolSize ?? 1000000} min={1} onChange={(e) => updateNode(node.id, (n) => (n.dials.connectionPoolSize = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>
            <div title={dialTooltips.Datastore.maxConcurrentRequests}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Max concurrent requests</div>
              <input type="number" value={node.dials.maxConcurrentRequests ?? 1000000} min={1} onChange={(e) => updateNode(node.id, (n) => (n.dials.maxConcurrentRequests = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>
          </>
        )}
      </div>
    </div>
  )

  // Edge inspector — styled consistently with node inputs
  return (
    <div style={{ width: 300, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.92)', border: '1px solid #e5e7eb', boxShadow: '0 4px 14px rgba(0,0,0,.08)' }}>
      <h3 style={{ marginTop: 0 }}>Edge</h3>
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
        {edge?.protocol !== 'Kafka' && (
          <>
            <div title={edgeTooltips.REST.payloadBytes}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Payload bytes</div>
              <input type="number" value={edge?.dials.payloadBytes ?? 0} min={0} onChange={(e) => edge && updateEdge(edge.id, (ed) => (ed.dials.payloadBytes = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>
            <div title={edgeTooltips.REST.clientTimeoutMs}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Client timeout (ms)</div>
              <input type="number" value={edge?.dials.clientTimeoutMs ?? 0} min={0} onChange={(e) => edge && updateEdge(edge.id, (ed) => (ed.dials.clientTimeoutMs = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>
            <div title={edgeTooltips.REST.retries}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Retries</div>
              <input type="number" value={edge?.dials.retries ?? 0} min={0} onChange={(e) => edge && updateEdge(edge.id, (ed) => (ed.dials.retries = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>
            <div title={edgeTooltips.REST.retryBackoffMs}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Retry backoff (ms)</div>
              <input type="number" value={edge?.dials.retryBackoffMs ?? 0} min={0} onChange={(e) => edge && updateEdge(edge.id, (ed) => (ed.dials.retryBackoffMs = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>
            <div title={edgeTooltips.REST.errorRate}>
              <div style={{ fontSize: 12, color: '#4b5563' }}>Error rate (0..1)</div>
              <input type="number" value={edge?.dials.errorRate ?? 0} min={0} max={1} step={0.01} onChange={(e) => edge && updateEdge(edge.id, (ed) => (ed.dials.errorRate = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            </div>
          </>
        )}
        {edge?.protocol === 'Kafka' && (
          <div title={edgeTooltips.Kafka.keySkew}>
            <div style={{ fontSize: 12, color: '#4b5563' }}>Key skew (0..1)</div>
            <input type="number" value={edge?.dials.keySkew ?? 0} min={0} max={1} step={0.01} onChange={(e) => edge && updateEdge(edge.id, (ed) => (ed.dials.keySkew = Number(e.target.value)))} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #e5e7eb' }} />
          </div>
        )}
      </div>
    </div>
  )
}



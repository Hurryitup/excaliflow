
export type StageResult = {
  id: string
  name: string
  inRate: number
  effectiveCap: number
  utilization: number
  outRate: number
  extras?: { backlogRps?: number; consumerLagRps?: number }
}

function formatRate(n: number): string {
  if (!isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M/s'
  if (abs >= 1_000) return (n / 1_000).toFixed(2) + 'k/s'
  return n.toFixed(0) + '/s'
}

function CapacityBar({ utilization }: { utilization: number }) {
  const pct = Math.max(0, Math.min(utilization * 100, 200))
  let bg = '#22c55e'
  if (utilization >= 0.9 && utilization < 1) bg = '#eab308'
  if (utilization >= 1) bg = '#ef4444'
  return (
    <div style={{ height: 8, width: '100%', background: '#e5e7eb', borderRadius: 4 }}>
      <div style={{ height: 8, width: `${Math.min(pct, 100)}%`, background: bg, borderRadius: 4 }} />
    </div>
  )
}

import { metricTooltips } from '../graph/help'
import { useGraphStore } from '../graph/store'
import React from 'react'

function Info({ text }: { text: string }) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLSpanElement | null>(null)
  const [side, setSide] = React.useState<'left' | 'right'>('right')
  const POPOVER_WIDTH = 260
  React.useEffect(() => {
    if (!open || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const spaceLeft = rect.left
    const spaceRight = vw - rect.right
    if (spaceRight < POPOVER_WIDTH + 12 && spaceLeft >= POPOVER_WIDTH + 12) setSide('left')
    else setSide('right')
  }, [open])
  return (
    <span ref={containerRef} style={{ marginLeft: 6, position: 'relative' }}>
      <button onClick={() => setOpen((v) => !v)} title="Explain" style={{ border: '1px solid #d1d5db', background: '#f3f4f6', cursor: 'pointer', color: '#374151', borderRadius: 999, width: 18, height: 18, lineHeight: '16px', fontSize: 11, padding: 0 }}>?</button>
      {open && (
        <div style={{ position: 'absolute', zIndex: 10, top: 20, left: side === 'right' ? 0 : undefined, right: side === 'left' ? 0 : undefined, width: POPOVER_WIDTH, background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, boxShadow: '0 8px 20px rgba(0,0,0,.12)' }}>
          <div style={{ fontSize: 11, color: '#111827', whiteSpace: 'normal' }}>{text}</div>
        </div>
      )}
    </span>
  )
}

export default function StageCard({ r }: { r: StageResult }) {
  const node = useGraphStore((s) => s.graph.nodes.find((n) => n.id === r.id))
  const result = useGraphStore((s) => s.lastResult)
  const kind = ((node?.type as any) ?? 'Generic') as keyof typeof metricTooltips
  const saturated = r.utilization >= 1
  const chipBg = saturated ? '#fee2e2' : r.utilization >= 0.9 ? '#fef9c3' : '#dcfce7'
  const chipFg = saturated ? '#991b1b' : r.utilization >= 0.9 ? '#854d0e' : '#166534'
  const details = result?.nodeStats[r.id]?.details
  const nodeStats = result?.nodeStats[r.id]

  const inputExplain = (() => {
    if (!node) return ''
    if (node.type === 'ApiEndpoint') return `Input = targetQps × burst = ${node.dials.targetQps} × ${((node.dials as any).burstFactor ?? 1)}`
    return `Input = sum(incoming edges)`
  })()

  const capExplain = (() => {
    if (!node) return ''
    if (node.type === 'Service') {
      const d = node.dials
      const svc = details?.service
      const eff = (d.parallelEfficiency ?? 1)
      const base = (1 - (d.cacheHitRate ?? 0)) * d.serviceTimeMs + (d.cacheHitRate ?? 0) * (d.cacheHitMs ?? 0)
      const workers = svc?.workers ?? d.concurrency
      const parts = svc?.availablePartitions
      const consumerCap = svc?.consumerCap
      let s = `Cap = workers × eff × (1000 / t) = ${workers} × ${eff.toFixed(2)} × (1000 / ${base.toFixed(2)}ms)`
      if (parts != null) s += `, workers clamped by partitions = ${parts}`
      if (consumerCap != null) s += `, consumer cap = ${consumerCap.toFixed(0)}/s`
      return s
    }
    if (node.type === 'QueueTopic') {
      const d = node.dials
      const cons = details?.topic?.consumerCapTotal ?? 0
      return `Cap = partitions × perPartition = ${d.partitions} × ${d.perPartitionThroughput}/s; egress also ≤ consumerCapTotal ${cons}/s`
    }
    if (node.type === 'Datastore') {
      const d = node.dials as any
      const ds = details?.datastore
      return `Cap = min(maxQps=${d.maxQps}, poolClamp=${(d.poolSize ?? '∞')}×${(d.maxConcurrent ?? '∞')}) ⇒ used ${ds?.capacity ?? d.maxQps}`
    }
    return 'Cap = configured or derived per type'
  })()

  const outExplain = `Output = min(Input, Cap)`
  return (
    <div style={{ padding: 12, borderRadius: 12, border: '1px solid #e5e7eb', background: 'white', width: 280 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
        <div title={metricTooltips.Generic.utilization} style={{ fontSize: 11, padding: '2px 6px', borderRadius: 999, background: chipBg, color: chipFg }}>{
          (r.utilization * 100).toFixed(0)
        }%</div>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#4b5563' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} title={metricTooltips.Generic.input}>
          <span>Input</span>
          <span style={{ display: 'flex', alignItems: 'center' }}>
            {formatRate(r.inRate)}
            <Info text={inputExplain} />
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} title={metricTooltips[kind]?.effectiveCap ?? metricTooltips.Generic.effectiveCap}>
          <span>Effective cap</span>
          <span style={{ display: 'flex', alignItems: 'center' }}>
            {formatRate(r.effectiveCap)}
            <Info text={capExplain} />
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} title={metricTooltips.Generic.output}>
          <span>Output</span>
          <span style={{ display: 'flex', alignItems: 'center' }}>
            {formatRate(r.outRate)}
            <Info text={outExplain} />
          </span>
        </div>
        {(node?.type === 'Service' || node?.type === 'Datastore') && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <span>Latency p50/p95</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <span>{(nodeStats?.modeledP50Ms ?? 0).toFixed(1)}/{(nodeStats?.modeledP95Ms ?? 0).toFixed(1)} ms</span>
              <Info text={(() => {
                if (!node) return ''
                if (node.type === 'Service') {
                  const d = node.dials
                  const base = (1 - (d.cacheHitRate ?? 0)) * d.serviceTimeMs + (d.cacheHitRate ?? 0) * (d.cacheHitMs ?? 0)
                  const rho = r.inRate / Math.max(r.effectiveCap, 1e-9)
                  const queueMs = rho > 0.7 ? Math.pow(rho, 3) * base : 0
                  const mult = (node.penalties?.latencyMultiplier ?? 1)
                  const add = (node.penalties?.latencyMsAdd ?? 0)
                  const p50 = (base + queueMs) * mult + add
                  const p95 = p50 * 2
                  return `Service latency:
base t = (1−cacheHit)×serviceTime + cacheHit×cacheHitMs = ${base.toFixed(2)}ms; ρ=${rho.toFixed(2)} → queueMs=${queueMs.toFixed(2)}ms
p50 = (t + queueMs) × latencyMultiplier + latencyMsAdd = (${base.toFixed(2)} + ${queueMs.toFixed(2)}) × ${mult} + ${add} ≈ ${p50.toFixed(2)}ms; p95 ≈ ${p95.toFixed(2)}ms`
                }
                if (node.type === 'Datastore') {
                  const d: any = node.dials
                  const ds = details?.datastore
                  const base = d.p95Ms / 1.5
                  const writeShare = ds && ds.costUnits > 0 ? ds.writes / ds.costUnits : 0
                  const factor = 1 + writeShare * (d.lockContentionFactor ?? 0)
                  const mult = (node.penalties?.latencyMultiplier ?? 1)
                  const add = (node.penalties?.latencyMsAdd ?? 0)
                  const p50 = base * factor * mult + add
                  const p95 = p50 * 2
                  return `Datastore latency:
base p50 = p95/1.5 = ${(d.p95Ms / 1.5).toFixed(2)}ms; writeShare=${(writeShare * 100).toFixed(0)}% → contention× = ${factor.toFixed(2)}
p50 = base × contention × latencyMultiplier + latencyMsAdd = ${base.toFixed(2)} × ${factor.toFixed(2)} × ${mult} + ${add} ≈ ${p50.toFixed(2)}ms; p95 ≈ ${p95.toFixed(2)}ms`
                }
                return ''
              })()} />
            </span>
          </div>
        )}
      </div>
      <div style={{ marginTop: 8 }}><CapacityBar utilization={r.utilization} /></div>
      {(saturated || r.extras?.backlogRps || r.extras?.consumerLagRps) && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#991b1b' }}>
          {saturated && <div>Saturation detected — queue grows at {formatRate(r.inRate - r.effectiveCap)}</div>}
          {r.extras?.backlogRps ? <div>Backlog: {formatRate(r.extras.backlogRps)}</div> : null}
          {r.extras?.consumerLagRps ? <div>Consumer lag: {formatRate(r.extras.consumerLagRps)}</div> : null}
          {/* Impact line: if any incoming edge to this node was blocked, surface a short note */}
          {(() => {
            const res = useGraphStore.getState().lastResult
            if (!res) return null
            const incomingBlocked = Object.entries(res.edgeStats).filter(([_, es]) => es.blockedRps && es.blockedRps > 0).filter(([id]) => {
              const g = useGraphStore.getState().graph
              const e = g.edges.find((x) => x.id === id)
              return e?.to === r.id
            })
            if (incomingBlocked.length === 0) return null
            const totalBlocked = incomingBlocked.reduce((s, [, es]) => s + (es.blockedRps || 0), 0)
            return <div>Impact: blocking {formatRate(totalBlocked)} at this stage</div>
          })()}
        </div>
      )}
    </div>
  )
}



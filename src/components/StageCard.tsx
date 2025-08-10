
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

export default function StageCard({ r }: { r: StageResult }) {
  const node = useGraphStore((s) => s.graph.nodes.find((n) => n.id === r.id))
  const kind = ((node?.type as any) ?? 'Generic') as keyof typeof metricTooltips
  const saturated = r.utilization >= 1
  const chipBg = saturated ? '#fee2e2' : r.utilization >= 0.9 ? '#fef9c3' : '#dcfce7'
  const chipFg = saturated ? '#991b1b' : r.utilization >= 0.9 ? '#854d0e' : '#166534'
  return (
    <div style={{ padding: 12, borderRadius: 12, border: '1px solid #e5e7eb', background: 'white', width: 260 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
        <div title={metricTooltips.Generic.utilization} style={{ fontSize: 11, padding: '2px 6px', borderRadius: 999, background: chipBg, color: chipFg }}>{
          (r.utilization * 100).toFixed(0)
        }%</div>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#4b5563' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }} title={metricTooltips.Generic.input}><span>Input</span><span>{formatRate(r.inRate)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }} title={metricTooltips[kind]?.effectiveCap ?? metricTooltips.Generic.effectiveCap}><span>Effective cap</span><span>{formatRate(r.effectiveCap)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }} title={metricTooltips.Generic.output}><span>Output</span><span>{formatRate(r.outRate)}</span></div>
      </div>
      <div style={{ marginTop: 8 }}><CapacityBar utilization={r.utilization} /></div>
      {(saturated || r.extras?.backlogRps || r.extras?.consumerLagRps) && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#991b1b' }}>
          {saturated && <div>Saturation detected — queue grows at {formatRate(r.inRate - r.effectiveCap)}</div>}
          {r.extras?.backlogRps ? <div>Backlog: {formatRate(r.extras.backlogRps)}</div> : null}
          {r.extras?.consumerLagRps ? <div>Consumer lag: {formatRate(r.extras.consumerLagRps)}</div> : null}
        </div>
      )}
    </div>
  )
}



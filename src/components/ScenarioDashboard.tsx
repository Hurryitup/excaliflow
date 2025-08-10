import StageCard from './StageCard'
import type { StageResult as CardResult } from './StageCard'
import { useGraphStore } from '../graph/store'

export default function ScenarioDashboard() {
  const graph = useGraphStore((s) => s.graph)
  const result = useGraphStore((s) => s.lastResult)
  const hasCards = !!result && Object.keys(result.nodeStats ?? {}).length > 0
  if (!hasCards) {
    return (
      <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
        <div>{graph.nodes.length === 0 ? 'Add nodes to begin modeling. Your dashboard will appear here.' : 'Edit a dial or connect nodes to compute utilization and capacity.'}</div>
      </div>
    )
  }

  const idToLabel = new Map(graph.nodes.map((n) => [n.id, n.label]))
  const cards: CardResult[] = Object.entries(result.nodeStats).map(([id, s]) => {
    const effectiveCap = s.utilization > 0 ? s.ingressRps / Math.max(s.utilization, 1e-9) : s.egressRps
    return {
      id,
      name: idToLabel.get(id) ?? id,
      inRate: s.ingressRps,
      effectiveCap,
      utilization: s.utilization,
      outRate: s.egressRps,
      extras: {
        backlogRps: s.backlogRps,
        consumerLagRps: s.consumerLagRps,
      },
    }
  })

  // Sort by utilization desc to bubble up hot spots
  cards.sort((a, b) => b.utilization - a.utilization)

  return (
    <div style={{ overflowX: 'auto', padding: 8, scrollBehavior: 'smooth', width: '100vw' }}>
      <div style={{ display: 'flex', gap: 12, minHeight: 130, whiteSpace: 'nowrap', scrollSnapType: 'x mandatory' as any }}>
        {cards.map((c) => (
          <div key={c.id} style={{ flex: '0 0 auto', scrollSnapAlign: 'start' }}>
            <StageCard r={c} />
          </div>
        ))}
      </div>
    </div>
  )
}



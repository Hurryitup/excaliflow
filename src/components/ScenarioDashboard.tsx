import StageCard from './StageCard'
import type { StageResult as CardResult } from './StageCard'
import { useGraphStore } from '../graph/store'

import React from 'react'

export default function ScenarioDashboard() {
  const graph = useGraphStore((s) => s.graph)
  const result = useGraphStore((s) => s.lastResult)
  const [height, setHeight] = React.useState(150)
  const draggingRef = React.useRef(false)
  const startYRef = React.useRef(0)
  const startHRef = React.useRef(150)

  const onMouseDown = (e: React.MouseEvent) => {
    draggingRef.current = true
    startYRef.current = e.clientY
    startHRef.current = height
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }
  const onMouseMove = (e: MouseEvent) => {
    if (!draggingRef.current) return
    const dy = e.clientY - startYRef.current
    const next = Math.max(120, Math.min(280, startHRef.current + dy))
    setHeight(next)
  }
  const onMouseUp = () => {
    draggingRef.current = false
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }
  const hasCards = !!result && Object.keys(result.nodeStats ?? {}).length > 0
  const CARD_MIN_HEIGHT = 150
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
    <div style={{ position: 'relative', height }}>
      {/* Bottom resize handle */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 16, zIndex: 2, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', pointerEvents: 'none' }}>
        <div onMouseDown={onMouseDown} style={{ width: 40, height: 6, marginBottom: 4, borderRadius: 999, background: '#d1d5db', boxShadow: 'inset 0 0 0 1px #cbd5e1', cursor: 'row-resize', pointerEvents: 'auto' }} />
      </div>
      <div style={{ overflowX: 'auto', overflowY: height < CARD_MIN_HEIGHT ? 'auto' : 'hidden', padding: '12px 16px 8px', scrollBehavior: 'smooth', width: '100%', height: '100%' }}>
        <div style={{ display: 'flex', gap: 12, minHeight: CARD_MIN_HEIGHT, whiteSpace: 'nowrap', scrollSnapType: 'x mandatory' as any }}>
          {cards.map((c) => (
            <div key={c.id} style={{ flex: '0 0 auto', scrollSnapAlign: 'start' }}>
              <StageCard r={c} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}



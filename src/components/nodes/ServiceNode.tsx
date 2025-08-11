import type { CSSProperties } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { useGraphStore } from '../../graph/store'

const container: CSSProperties = {
  padding: '10px 16px',
  background: '#ecfdf5',
  border: '2px solid #10b981',
  color: '#065f46',
  borderRadius: 8,
  fontWeight: 600,
  minWidth: 160,
  textAlign: 'center',
}

export default function ServiceNode({ id, data, selected }: NodeProps<{ label: string; type?: string }>) {
  const node = useGraphStore((s) => s.graph.nodes.find((n) => n.id === id && n.type === 'Service')) as any
  const join = node?.dials?.join
  const badge = (() => {
    if (!join || join.type === 'none') return undefined
    if (join.type === 'all') return 'JOIN all'
    if (join.type === 'kOfN') return `JOIN k=${join.requiredStreams}`
    if (join.type === 'window') return `JOIN k=${join.requiredStreams} win`
    return undefined
  })()
  return (
    <div style={{ ...container, boxShadow: selected ? '0 0 0 3px rgba(16,185,129,.25)' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span>{data.label}</span>
        {badge && (
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: '#d1fae5', color: '#065f46', border: '1px solid #10b981' }}>{badge}</span>
        )}
      </div>
      <Handle id="top-target" type="target" position={Position.Top} />
      <Handle id="top-source" type="source" position={Position.Top} />
      <Handle id="bottom-source" type="source" position={Position.Bottom} />
      <Handle id="bottom-target" type="target" position={Position.Bottom} />
      <Handle id="right-source" type="source" position={Position.Right} />
      <Handle id="right-target" type="target" position={Position.Right} />
      <Handle id="left-target" type="target" position={Position.Left} />
      <Handle id="left-source" type="source" position={Position.Left} />
    </div>
  )
}



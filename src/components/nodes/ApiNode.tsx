import type { CSSProperties } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'

const container: CSSProperties = {
  padding: '10px 16px',
  background: '#eff6ff',
  border: '2px solid #3b82f6',
  color: '#0b4fbf',
  borderRadius: 9999,
  fontWeight: 600,
  minWidth: 140,
  textAlign: 'center',
}

export default function ApiNode({ data, selected }: NodeProps<{ label: string }>) {
  return (
    <div style={{ ...container, boxShadow: selected ? '0 0 0 3px rgba(59,130,246,.25)' : undefined }}>
      {data.label}
      {/* top */}
      <Handle id="top-target" type="target" position={Position.Top} />
      <Handle id="top-source" type="source" position={Position.Top} />
      {/* bottom */}
      <Handle id="bottom-source" type="source" position={Position.Bottom} />
      <Handle id="bottom-target" type="target" position={Position.Bottom} />
      {/* sides */}
      <Handle id="right-source" type="source" position={Position.Right} />
      <Handle id="right-target" type="target" position={Position.Right} />
      <Handle id="left-target" type="target" position={Position.Left} />
      <Handle id="left-source" type="source" position={Position.Left} />
    </div>
  )
}



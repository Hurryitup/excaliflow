import type { CSSProperties } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'

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

export default function ServiceNode({ data, selected }: NodeProps<{ label: string }>) {
  return (
    <div style={{ ...container, boxShadow: selected ? '0 0 0 3px rgba(16,185,129,.25)' : undefined }}>
      {data.label}
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



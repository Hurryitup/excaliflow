import type { CSSProperties } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'

const cylinder: CSSProperties = {
  padding: '14px 16px',
  background: '#f5f3ff',
  border: '2px solid #8b5cf6',
  color: '#4c1d95',
  borderRadius: 9999,
  borderTopLeftRadius: 9999,
  borderTopRightRadius: 9999,
  borderBottomLeftRadius: 9999,
  borderBottomRightRadius: 9999,
  position: 'relative',
  minWidth: 180,
  textAlign: 'center',
  fontWeight: 600,
}

export default function DatastoreNode({ data, selected }: NodeProps<{ label: string }>) {
  return (
    <div style={{ ...cylinder, boxShadow: selected ? '0 0 0 3px rgba(139,92,246,.25)' : undefined }}>
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



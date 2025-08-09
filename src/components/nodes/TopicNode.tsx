import type { CSSProperties } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'

const container: CSSProperties = {
  padding: '10px 16px',
  background: '#fffbeb',
  border: '2px dashed #f59e0b',
  color: '#92400e',
  borderRadius: 16,
  fontWeight: 600,
  minWidth: 200,
  textAlign: 'center',
}

export default function TopicNode({ data, selected }: NodeProps<{ label: string }>) {
  return (
    <div style={{ ...container, boxShadow: selected ? '0 0 0 3px rgba(245,158,11,.25)' : undefined }}>
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



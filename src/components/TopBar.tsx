import { useGraphStore } from '../graph/store'
import { validateGraph } from '../graph/validators'
import { useAutoLayout } from '../hooks/useAutoLayout'

export default function TopBar() {
  const graph = useGraphStore((s) => s.graph)
  const setGraph = useGraphStore((s) => s.setGraph)
  const undo = useGraphStore((s) => s.undo)
  const redo = useGraphStore((s) => s.redo)
  const { run } = useAutoLayout()
  const resetViewport = useGraphStore((s) => s.resetViewport)

  const newGraph = () => setGraph({ nodes: [], edges: [], metadata: { name: 'Untitled', createdAt: new Date().toISOString() } })

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${graph.metadata?.name ?? 'scenario'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const validate = () => {
    const warnings = validateGraph(graph)
    if (warnings.length) alert(warnings.join('\n'))
    else alert('No validation warnings')
  }

  const autoLayout = (direction: 'TB' | 'LR' = 'TB') => {
    setGraph(run(graph, direction))
    resetViewport()
  }

  const resetZoom = () => resetViewport()

  return (
    <div style={{ height: 48, borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
        <button onClick={newGraph} title="New scenario">+ New</button>
        <button onClick={undo} title="Undo">↶ Undo</button>
        <button onClick={redo} title="Redo">↷ Redo</button>
        <button onClick={() => autoLayout('TB')} title="Auto-layout vertical">↕︎ Layout</button>
        <button onClick={() => autoLayout('LR')} title="Auto-layout horizontal">↔︎ Layout</button>
        <button onClick={resetZoom} title="Reset zoom">⤿ Reset</button>
        <button onClick={validate} title="Validate graph">✓ Validate</button>
        <button onClick={exportJson} title="Export JSON">⤓ Export</button>
      </div>
    </div>
  )
}



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

  const STORAGE_KEY = 'excaliflow:graph'

  const newGraph = () => {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    setGraph({ nodes: [], edges: [], metadata: { name: 'Untitled', createdAt: new Date().toISOString() } })
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${graph.metadata?.name ?? 'scenario'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importJson = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const parsed = JSON.parse(text)
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
          setGraph(parsed)
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed)) } catch {}
        } else {
          alert('Invalid scenario file')
        }
      } catch (e) {
        alert('Failed to import scenario: ' + (e as Error).message)
      }
    }
    input.click()
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
        <button onClick={resetZoom} title="Reset zoom">⤿ Reset Zoom</button>
        <button onClick={validate} title="Validate graph">✓ Validate</button>
        <button onClick={exportJson} title="Export JSON">⤓ Export</button>
        <button onClick={importJson} title="Import JSON">⇪ Import</button>
      </div>
    </div>
  )
}



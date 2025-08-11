import Canvas from './components/Canvas'
import LeftPalette from './components/Sidebars/LeftPalette'
import RightInspector from './components/Sidebars/RightInspector'
import TopBar from './components/TopBar'
import EngineRunner from './components/EngineRunner'
import ScenarioDashboard from './components/ScenarioDashboard'
import { useEffect, useRef } from 'react'
import { useGraphStore } from './graph/store'
// styles imported in main.tsx

function App() {
  const graph = useGraphStore((s) => s.graph)
  const setGraph = useGraphStore((s) => s.setGraph)
  const STORAGE_KEY = 'excaliflow:graph'
  const hydratedRef = useRef(false)

  // Load from localStorage on first mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        setGraph(parsed)
      }
    } catch {
      // ignore corrupted data
    }
    hydratedRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist to localStorage on graph changes
  useEffect(() => {
    if (!hydratedRef.current) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(graph))
    } catch {
      // ignore quota errors
    }
  }, [graph])

  return (
    <div style={{ display: 'grid', gridTemplateRows: '48px auto 1fr', gridTemplateColumns: '1fr', height: '100vh', width: '100vw' }}>
      <div>
        <TopBar />
      </div>
      <div style={{ borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(180deg, #fafafa 0%, #ffffff 100%)', overflowX: 'hidden' }}>
        <ScenarioDashboard />
      </div>
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <EngineRunner />
        <Canvas />
        <div style={{ position: 'absolute', left: 16, top: 16, zIndex: 10 }}>
          <LeftPalette />
        </div>
        <div style={{ position: 'absolute', right: 16, top: 16, zIndex: 10 }}>
          <RightInspector />
        </div>
      </div>
    </div>
  )
}

export default App

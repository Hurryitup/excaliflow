import Canvas from './components/Canvas'
import LeftPalette from './components/Sidebars/LeftPalette'
import RightInspector from './components/Sidebars/RightInspector'
import TopBar from './components/TopBar'
import EngineRunner from './components/EngineRunner'
import ScenarioDashboard from './components/ScenarioDashboard'
// styles imported in main.tsx

function App() {
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

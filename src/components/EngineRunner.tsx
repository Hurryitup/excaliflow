import { useEffect, useRef } from 'react'
import { useGraphStore } from '../graph/store'
import type { GraphModel, ScenarioResult } from '../graph/types'
import WorkerUrl from '../engine/engineWorker?worker&url'

export default function EngineRunner() {
  const graph = useGraphStore((s) => s.graph)
  const setResult = useGraphStore((s) => s.setResult)
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(WorkerUrl, { type: 'module' })
      workerRef.current.onmessage = (e: MessageEvent<{ type: 'result'; result: ScenarioResult }>) => {
        if (e.data.type === 'result') setResult(e.data.result)
      }
    }
    if (graph.nodes.length === 0) {
      setResult({ nodeStats: {}, edgeStats: {}, global: { warnings: [], bottlenecks: [] } })
      return
    }
    workerRef.current.postMessage({ type: 'compute', graph } as { type: 'compute'; graph: GraphModel })
  }, [graph, setResult])

  return null
}



/// <reference lib="webworker" />
import { computeScenario, defaultEngineConfig } from './compute'
import type { GraphModel, ScenarioResult } from '../graph/types'

type MessageIn = { type: 'compute'; graph: GraphModel }
type MessageOut = { type: 'result'; result: ScenarioResult }

let lastTimer: number | undefined

self.onmessage = (e: MessageEvent<MessageIn>) => {
  const { data } = e
  if (data.type === 'compute') {
    if (lastTimer) clearTimeout(lastTimer)
    lastTimer = setTimeout(() => {
      const result = computeScenario(data.graph, defaultEngineConfig)
      const msg: MessageOut = { type: 'result', result }
      ;(self as unknown as Worker).postMessage(msg)
    }, 150) as unknown as number
  }
}



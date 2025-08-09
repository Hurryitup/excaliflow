import type { GraphModel } from '../graph/types'

export function importFromJson(text: string): GraphModel {
  const obj = JSON.parse(text)
  return obj as GraphModel
}



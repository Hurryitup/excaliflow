import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { produce } from 'immer'
import type {
  GraphModel,
  Edge,
  ServiceNode,
  QueueTopicNode,
  ApiEndpointNode,
  DatastoreNode,
} from './types'
import type { ScenarioResult } from './types'

export type GraphState = {
  graph: GraphModel
  history: GraphModel[]
  future: GraphModel[]
  selectedId?: string
  viewportVersion: number
  lastResult?: ScenarioResult
}

type Actions = {
  addNode: (node: ServiceNode | QueueTopicNode | ApiEndpointNode | DatastoreNode) => void
  connectEdge: (edge: Edge) => void
  updateNode: (id: string, updater: (n: any) => void) => void
  updateEdge: (id: string, updater: (e: Edge) => void) => void
  deleteNode: (id: string) => void
  deleteEdge: (id: string) => void
  select: (id?: string) => void
  undo: () => void
  redo: () => void
  setGraph: (graph: GraphModel) => void
  resetViewport: () => void
  setResult: (r: ScenarioResult) => void
}

const initialGraph: GraphModel = { nodes: [], edges: [], metadata: { name: 'Untitled' } }

const cloneGraph = (g: GraphModel): GraphModel => JSON.parse(JSON.stringify(g)) as GraphModel

export const useGraphStore = create<GraphState & Actions>()(
  devtools((set, get) => ({
    graph: initialGraph,
    history: [],
    future: [],
    selectedId: undefined,
    viewportVersion: 0,

    addNode: (node) =>
      set(
        produce((state: GraphState) => {
          const prev = get().graph
          state.history.push(cloneGraph(prev))
          state.future = []
          state.graph.nodes.push(node)
          state.selectedId = node.id
        }),
        false,
        'addNode',
      ),

    connectEdge: (edge) =>
      set(
        produce((state: GraphState) => {
          const prev = get().graph
          state.history.push(cloneGraph(prev))
          state.future = []
          state.graph.edges.push(edge)
          state.selectedId = edge.id
        }),
        false,
        'connectEdge',
      ),

    updateNode: (id, updater) =>
      set(
        produce((state: GraphState) => {
          const prev = get().graph
          state.history.push(cloneGraph(prev))
          state.future = []
          const node = state.graph.nodes.find((n) => n.id === id)
          if (node) {
            updater(node as any)
          }
        }),
        false,
        'updateNode',
      ),

    updateEdge: (id, updater) =>
      set(
        produce((state: GraphState) => {
          const prev = get().graph
          state.history.push(cloneGraph(prev))
          state.future = []
          const edge = state.graph.edges.find((e) => e.id === id)
          if (edge) updater(edge)
        }),
        false,
        'updateEdge',
      ),

    deleteNode: (id) =>
      set(
        produce((state: GraphState) => {
          const prev = get().graph
          state.history.push(cloneGraph(prev))
          state.future = []
          state.graph.nodes = state.graph.nodes.filter((n) => n.id !== id)
          state.graph.edges = state.graph.edges.filter((e) => e.from !== id && e.to !== id)
          if (state.selectedId === id) state.selectedId = undefined
        }),
        false,
        'deleteNode',
      ),

    deleteEdge: (id) =>
      set(
        produce((state: GraphState) => {
          const prev = get().graph
          state.history.push(cloneGraph(prev))
          state.future = []
          state.graph.edges = state.graph.edges.filter((e) => e.id !== id)
          if (state.selectedId === id) state.selectedId = undefined
        }),
        false,
        'deleteEdge',
      ),

    select: (id) => set({ selectedId: id }),

    undo: () =>
      set(
        produce((state: GraphState) => {
          const prev = state.history.pop()
          if (!prev) return
          state.future.push(cloneGraph(state.graph))
          state.graph = prev
        }),
        false,
        'undo',
      ),

    redo: () =>
      set(
        produce((state: GraphState) => {
          const next = state.future.pop()
          if (!next) return
          state.history.push(cloneGraph(state.graph))
          state.graph = next
        }),
        false,
        'redo',
      ),

    setGraph: (graph) =>
      set(
        produce((state: GraphState) => {
          const prev = get().graph
          state.history.push(cloneGraph(prev))
          state.future = []
          state.graph = graph
        }),
        false,
        'setGraph',
      ),

    resetViewport: () => set((s) => ({ viewportVersion: s.viewportVersion + 1 })),
    setResult: (r) => set({ lastResult: r }),
  })),
)



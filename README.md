## excaliflow — Local‑first dataflow designer and performance forecaster

excaliflow is a React + TypeScript application for designing microservice dataflows and forecasting utilization, capacity and simple latency. It is local‑first: all modeling happens in the browser. The goal is to provide fast iteration on “what‑if” scenarios without requiring a backend.

### Quick start
- npm install
- npm run dev — start the app with HMR
- npm run build — type-check and build for production
- npm test or npm run coverage — run unit tests when present

### High‑level architecture
- Canvas and graph editing are built with React Flow.
- App state (graph, selection, undo/redo) is in Zustand with Immer for ergonomic immutable updates.
- Calculations run in a Web Worker (debounced ~150ms) to keep the UI responsive.
- A small validation layer enforces simple graph constraints.
- A generic dashboard surfaces node utilization and capacity after each compute.

### Key technologies
- React 19, TypeScript 5, Vite 7
- React Flow for the editor surface (custom node types, minimap, snapping)
- Zustand + Immer for state and undo/redo
- Dagre for auto‑layout
- Recharts for lightweight time‑series in the bottom panel (optional)
- ESLint + TypeScript strict configuration

### Project structure
```
src/
  App.tsx                  // Shell layout: top bar, sidebars, canvas, dashboard, bottom panel
  main.tsx                 // Entry
  components/
    Canvas.tsx             // React Flow canvas and interactions
    TopBar.tsx             // New/Undo/Redo/Auto-layout/Validate/Export/Reset Zoom/Run Calc
    BottomPanel.tsx        // Simple time-series + global warnings
    ScenarioDashboard.tsx  // Post-compute node cards (utilization/capacity)
    Sidebars/
      LeftPalette.tsx      // Node palette
      RightInspector.tsx   // Dials with validation, tooltips, and editing
    nodes/                 // Custom React Flow nodes per type
  engine/
    compute.ts             // Pure compute (capacity/flow/latency)
    engineWorker.ts        // Debounced worker to run compute
  graph/
    types.ts               // GraphModel/Node/Edge types and dials
    store.ts               // Zustand store + undo/redo
    validators.ts          // Graph validation rules
    help.ts                // Tooltip copy for dials/metrics
  hooks/
    useAutoLayout.ts       // Dagre top‑to‑bottom layout with type-aware node sizes
  styles/
    index.css              // Global styles
```

### Data model essentials
- Nodes: `ApiEndpoint`, `Service`, `QueueTopic` (Kafka/topic), `Datastore`.
- Edges: directed; protocol: `Generic | Kafka`.
- Node‑level multipliers remain under `penalties` for advanced modeling: `{ capacityMultiplier, throughputMultiplier, latencyMsAdd, latencyMultiplier, fixedRpsCap }`.
- Each node type exposes “dials” (typed fields) edited in the Inspector. Examples:
  - ApiEndpoint: `targetQps`, `burstFactor`, optional `p50Ms`, `p95Ms` (informational)
  - Service: `concurrency`, `parallelEfficiency`, `serviceTimeMs`, `cacheHitRate`, `cacheHitMs`, optional `maxInFlight`, optional `join`, and `fanOut` (`split | duplicate`)
    - Join semantics:
      - `none` (default): merge inputs
      - `all`: 1-from-each; ingress = `min(streams) × efficiency`
      - `kOfN`: require k streams; ingress = `min(kth, sum/k) × efficiency`
      - `window`: windowed k-of-n; ingress = `min(kth, sum/k) × matchRate × efficiency`
  - QueueTopic: `partitions`, `perPartitionThroughput`
  - Datastore: `maxQps`, `p95Ms`, optional `writeAmplification`, `lockContentionFactor`, `poolSize`, `maxConcurrent`
  - Edge: `opType` (`read | write | bulk | stream`), `weight` (used when `fanOut=split`), and for Kafka edges only: `keySkew`

### Compute model
Simple, deterministic approximations designed for interactivity.
- Service effective service time: `t_eff = (1 − cacheHitRate) × serviceTimeMs + cacheHitRate × cacheHitMs`
- Service workers: if consuming from Kafka, `workers = min(concurrency, sum(upstreamTopic.partitions))`; otherwise `workers = concurrency`
- Service capacity: `capacity = workers × parallelEfficiency × (1000 / t_eff)`
- Service join (pre-capacity):
  - none: `Σ r_i`; all: `min_i r_i × efficiency`; kOfN: `min(kth, (Σ r_i)/k) × efficiency`; window: `min(kth, (Σ r_i)/k) × matchRate × efficiency`
- Apply node penalties: `capacity *= penalties.capacityMultiplier`; clamp by `penalties.fixedRpsCap` and `maxInFlight` when set
- Utilization: `ρ = ingress / max(capacity, ε)`; color bands: <0.7 green, 0.7–0.85 yellow, ≥1.0 red
- Queueing penalty (service): if `ρ > 0.7`, `queueMs = (ρ^3) × t_eff`
- Latency (service): `p50 = (t_eff + queueMs) × penalties.latencyMultiplier + penalties.latencyMsAdd`; `p95 = p50 × p95Multiplier`
- Topic capacity: `capacity = partitions × perPartitionThroughput × penalties.capacityMultiplier`, then clamp by `fixedRpsCap`; egress = `min(ingress, capacity)` × `throughputMultiplier`
- Datastore capacity: `capacity = min(maxQps, poolSize × maxConcurrent)` when set; apply `capacityMultiplier` and `fixedRpsCap`; `p50 = (p95Ms/1.5) × latencyMultiplier + latencyMsAdd`, adjusted by write contention `p50 *= (1 + writeShare × lockContentionFactor)`; `p95 = p50 × p95Multiplier`
- API ingress shaping: `effectiveIngress = targetQps × burstFactor`; penalties apply to throughput and latency similarly
- Kafka edge producer penalty: key skew penalty ≈ `skew^2`; producer cap = `min(effectivePartitions, service.concurrency) × perPartitionThroughput`
- Throughput penalties: node/edge egress multiply by `throughputMultiplier` and clamp by `fixedRpsCap` when set
- Flow propagation: topological order; `Service.fanOut=split` distributes egress by weights; `duplicate` sends full egress on each outgoing edge.
 - Backpressure accounting: per node, acceptance ratio = `egress/ingress`. Each incoming edge records delivered vs blocked RPS based on this ratio.

The compute worker contract:
```
// postMessage to worker
{ type: 'compute', graph: GraphModel }

// onmessage from worker
{ type: 'result', result: ScenarioResult }
```

### Validation rules (incremental)
- Disallow Kafka edges except `Service → QueueTopic` or `QueueTopic → Service`.
- Positive integer partitions; positive per‑partition throughput.
- Simple cycle detection; warns when cycles are present (Kafka cycles disabled by default in v1).
- Kafka realism: warn when `Service.concurrency` exceeds `QueueTopic.partitions × Service.parallelEfficiency` on `Topic → Service` edges (excess concurrency is likely wasted).
- Sanity: Probability fields must be 0..1; multipliers and fixed caps must be non-negative.

### UI/UX behaviors
- Drag‑and‑drop add nodes from the left palette.
- New node placement: newly added nodes are inserted at the current canvas center to match the user’s viewport location.
- Click to select; delete with Backspace/Delete (nodes and edges).
- Edge labels are optional (edited in Inspector on edge selection).
- Auto‑layout uses Dagre with type‑aware node sizes and generous spacing to avoid overlap. Two orientations are supported from the top bar: Vertical (TB) and Horizontal (LR).
- Inspector provides dial editing with explanatory tooltips (centralized in `graph/help.ts`).
- Dashboard cards summarize each node’s Input / Effective cap / Output / Utilization with tooltips. For Service and Datastore cards, p50/p95 latency is displayed; a “?” popover explains the exact computation and inputs.
- Dashboard cards also show a Limiter line indicating the active bottleneck and an Upstream hint when input was throttled earlier.
- Edge hover popovers on the canvas show modeled latency and delivered/blocked RPS.
- Compute is triggered from the top bar (Run Calc) and results are displayed via the dashboard cards. A lightweight runner component (`EngineRunner`) ensures worker communication without extra UI.

### Connection points, handles and edge direction
- Every node exposes four sides with both source and target handles:
  - Top: `top-source`, `top-target`
  - Bottom: `bottom-source`, `bottom-target`
  - Left: `left-source`, `left-target`
  - Right: `right-source`, `right-target`
- When a user drags to create an edge, the app uses `onConnectStart` to record the starting node/handle and enforces that node as the edge source. This prevents React Flow from flipping direction in some cross‑side cases.
- The edge model persists handle ids in `Edge.fromHandle` and `Edge.toHandle`. When rendering, these are passed to React Flow as `sourceHandle` and `targetHandle` so edges attach to the requested sides.
- Directional markers (closed arrowheads) are rendered on edge ends.
- Smart defaults: when creating an edge, if either endpoint is a `QueueTopic`, protocol is `Kafka`; otherwise `Generic`.
- Layout: both vertical (TB) and horizontal (LR) auto‑layout options are available. Cross‑side connections are respected by layout; spacing can be tuned in `hooks/useAutoLayout.ts` (`nodesep`, `ranksep`).


### Design decisions and patterns to keep
- Local‑first: no backend dependency for graph editing or compute.
- Deterministic pure compute: `engine/compute.ts` must remain side‑effect free and easily unit testable.
- Worker boundary: the UI never blocks on compute; debounce ~150ms and post results back.
- Store contract: actions in `graph/store.ts` are pure and named (e.g., `addNode`, `updateNode`, `connectEdge`), with undo/redo maintained by pushing a deep clone to history before every mutating edit.
- Type safety: strict TS everywhere; avoid `any` at boundaries; prefer type‑only imports.
- Readability: favor clear variable names and smaller pure functions; avoid deep nesting.
- React Flow usage: keep `nodeTypes` mapping stable (memoized/constant). Preserve user positions when syncing React Flow nodes from graph state.
- Validation first: show friendly warnings; never surprise‑mutate the user’s graph.

### Extensibility guide (for future agents)
- New node type:
  1) Extend `NodeBase` in `graph/types.ts` and add a discriminated `type` literal.
  2) Add a custom node component in `components/nodes/` and register it in `Canvas.tsx` `nodeTypes`.
  3) Add dials and tooltips in `RightInspector.tsx` and `graph/help.ts`.
  4) Extend `compute.ts` to model capacity/latency and how flows propagate through the new node.
- New edge protocol:
  1) Add to `Protocol` in `types.ts`.
  2) Extend `validators.ts` to constrain allowed endpoints.
  3) Update `compute.ts` to model throughput/latency and any timeout/backpressure.
- Edge flow weighting: supported via `edge.weight` (used when `fanOut=split`).
- Cycles: for feedback loops, use iterative relaxation per tick (cap iteration count) and detect convergence.

### Developer workflow
- npm run dev — live edit components; compute runs in a worker.
- Use the top bar to trigger Auto‑Layout and Run Calc while iterating.
- Linting/formatting follow the repo defaults (ESLint + TS strict). Keep `nodeTypes` and other large mappings stable (outside renders).

### Testing
- Unit tests should target `engine/compute.ts` and small store behaviors. Prefer pure functions.
- Snapshot tests for validators and for helper formatting functions are welcomed.

### Known limitations / next steps
- Equal egress split; add weights/fan‑out policies.
- Latency approximations are coarse; refine coefficients or switch to small queueing models per type.
- More validations (timeouts, payload sizes, max inflight backpressure) and richer warnings.
- PNG/SVG export, keyboard shortcuts, “Explain this bottleneck” popovers.

### Contribution guidelines (for future agents)
- Style: keep code small, pure, and explicit. Prefer descriptive names over comments. Follow the existing TypeScript strictness and lint rules.
- Changes that touch compute must stay deterministic and side‑effect free. Expose knobs via `EngineConfig` or typed dials rather than hidden constants.
- When introducing a new dial or metric:
  - Extend the type in `graph/types.ts`.
  - Add a tooltip string in `graph/help.ts`.
  - Add editable UI in `RightInspector.tsx`.
  - Update `compute.ts` to incorporate it, and update `ScenarioDashboard` or `StageCard` only if a new metric is surfaced.
- Keep `nodeTypes` mapping stable and outside renders; avoid recreating objects that React Flow expects to be referentially stable.
- For performance, prefer incremental UI updates and avoid deep copies outside the store’s history management.
- Add unit tests for compute changes and validations.

## Math appendix and tunable coefficients
This section documents the exact formulas currently implemented in `engine/compute.ts` and where to adjust them.

#### Service nodes
- Effective service time: `t_eff = (1 − cacheHitRate) × serviceTimeMs + cacheHitRate × cacheHitMs`
- Workers: if consuming from Kafka, `workers = min(concurrency, sum(upstreamTopic.partitions))`; else `workers = concurrency`
- Capacity (RPS): `capacity = workers × parallelEfficiency × (1000 / t_eff)`
- Utilization: `ρ = ingress / max(capacity, ε)`
- Queueing penalty: If `ρ > 0.7`, add `queueMs = (ρ^3) × t_eff`; otherwise `queueMs = 0`
- Latency: `p50 = (t_eff + queueMs) × latencyMultiplier + latencyMsAdd`; `p95 = p50 × p95Multiplier`
- Egress (RPS): `min(ingress, capacity)`, then apply `throughputMultiplier` and `fixedRpsCap` if present
- Backlog: `max(0, ingress − capacity)`
- Join semantics (pre-capacity): none, all, k-of-n, window as defined above.

Tunable: `p95Multiplier` (default 2) in `defaultEngineConfig`.

#### Queue/Topic nodes (Kafka/queues)
- Topic capacity: `capacity = partitions × perPartitionThroughput × capacityMultiplier`, clamped by `fixedRpsCap` if set
- Egress (RPS): `min(ingress, capacity, consumerCapTotal) × throughputMultiplier`, clamped by `fixedRpsCap`
- Utilization: `ingress / max(capacity, ε)`
- Consumer lag estimate: `max(0, ingress − egress)`

Kafka edge producer shaping (applied on edges entering a `QueueTopic`):
- Effective producer cap on the edge: `producerCap = partitions × perPartitionThroughput × (1 − keySkew^2)`
- Per‑edge flow is clamped by `producerCap` before accumulation into the topic’s ingress.
- Limiter selection: topic limiter is the smallest of `partitions`, `producer-partitions` (after skew), `consumer-parallelism`. Services report `service-compute` or join limiter; datastores report `datastore-capacity`. Kafka edges report `producer-partitions` if clamped.

#### Datastore nodes
- Base capacity (QPS): `maxQps`
- Pool clamp: if set, `poolClamp = poolSize × maxConcurrent`; `capacity = min(maxQps, poolClamp)`
- Apply `capacityMultiplier` and `fixedRpsCap` as clamps
- Utilization: `ingress / max(capacity, ε)`
- Latency: `p50 = (p95Ms/1.5) × latencyMultiplier + latencyMsAdd`, adjusted by write contention: `p50 *= (1 + writeShare × lockContentionFactor)`; `p95 = p50 × p95Multiplier`
- Egress (RPS): `min(ingress, capacity) × throughputMultiplier`, clamped by `fixedRpsCap`

#### Edges
- Generic edges add no latency; Kafka edges carry only `keySkew` shaping (producer side). Tunable: `p95Multiplier` (default 2).

#### Flow propagation
- Ingress seeding: sum of `ApiEndpoint.targetQps × burstFactor` per API node.
- Order: compute in a best‑effort topological order (Kahn). If cycles exist, remaining nodes are appended to ensure a pass over all nodes.
- Egress split: if multiple outgoing edges exist, egress is divided by weights (`fanOut=split`) or duplicated to each edge (`fanOut=duplicate`). Each Kafka edge may clamp flow by producer cap before accumulating into topic ingress.
- Backpressure: For each node, acceptance ratio `= egress/ingress`; each incoming edge records `deliveredRps` and `blockedRps`.

#### Validation (summarized)
- Kafka edges allowed only: `Service → QueueTopic` or `QueueTopic → Service`.
- `partitions` positive integers; `perPartitionThroughput` > 0.
- Simple cycle detection adds a warning (Kafka cycles disabled by default).

#### Where to adjust math
- Edge/network coefficients: `engine/compute.ts → defaultEngineConfig`.
- Queueing threshold/shape: `engine/compute.ts` (look for `ρ > 0.7` and `queueMs = ρ^3 × serviceTimeMs`).
- Kafka skew penalty: `penalty = keySkew^2` in `engine/compute.ts`.
- Topic/Service/Datastore capacity definitions: per‑type branches in `engine/compute.ts`.

### License
This project is intended as a local modeling tool. No license has been declared yet; update as appropriate.


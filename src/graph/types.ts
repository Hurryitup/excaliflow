export type Protocol = 'Generic' | 'Kafka'

// Keep node-level multipliers; edges are lean shapers only
export type Penalties = {
  capacityMultiplier?: number
  throughputMultiplier?: number
  latencyMsAdd?: number
  latencyMultiplier?: number
  fixedRpsCap?: number
}

export type NodeBase = {
  id: string
  type: 'Service' | 'QueueTopic' | 'ApiEndpoint' | 'Datastore'
  label: string
  notes?: string
  position: { x: number; y: number }
  penalties?: Penalties
}

export type JoinSemantics =
  | { type: 'none' }
  | { type: 'waitAll'; requiredStreams?: number; joinEfficiency?: number }
  | { type: 'windowed'; windowMs: number; requiredStreams?: number; joinEfficiency?: number }

export type ServiceNode = NodeBase & {
  type: 'Service'
  dials: {
    concurrency: number
    parallelEfficiency?: number // 0..1
    serviceTimeMs: number
    cacheHitRate?: number // 0..1
    cacheHitMs?: number
    maxInFlight?: number

    // Fan-in / ETL semantics
    join?: JoinSemantics

    // Fan-out semantics for outgoing edges
    fanOut?: 'split' | 'duplicate'
  }
}

export type QueueTopicNode = NodeBase & {
  type: 'QueueTopic'
  dials: {
    partitions: number
    perPartitionThroughput: number
    replicationFactor?: number
  }
}

export type ApiEndpointNode = NodeBase & {
  type: 'ApiEndpoint'
  dials: {
    targetQps: number
    p50Ms?: number
    p95Ms?: number
    burstFactor?: number // >0
  }
}

export type DatastoreNode = NodeBase & {
  type: 'Datastore'
  dials: {
    maxQps: number
    p95Ms: number
    writeAmplification?: number // default 4
    lockContentionFactor?: number // multiplies p95 under write load
    poolSize?: number
    maxConcurrent?: number
  }
}

export type OpType = 'read' | 'write' | 'bulk' | 'stream'

export type Edge = {
  id: string
  from: string
  to: string
  protocol: Protocol
  label?: string
  fromHandle?: string
  toHandle?: string
  // Shapers (lean edge model)
  opType?: OpType // interpreted by target nodes (e.g., Datastore)
  weight?: number // fan-out split; default equal if undefined
  keySkew?: number // 0..1; ONLY valid when `to` is QueueTopic
}

export type GraphModel = {
  nodes: Array<ServiceNode | QueueTopicNode | ApiEndpointNode | DatastoreNode>
  edges: Edge[]
  metadata?: { name?: string; createdAt?: string }
}

export type ScenarioResult = {
  nodeStats: Record<
    string,
    {
      ingressRps: number
      egressRps: number
      utilization: number
      modeledP50Ms: number
      modeledP95Ms: number
      backlogRps?: number
      consumerLagRps?: number
      wastedConcurrency?: number
      warnings: string[]
      details?: {
        service?: { joinMode?: 'none' | 'waitAll' | 'windowed'; workers?: number; availablePartitions?: number; consumerCap?: number }
        topic?: { partitions: number; consumerCapTotal: number }
        datastore?: { reads: number; writes: number; costUnits: number; capacity: number }
      }
    }
  >
  edgeStats: Record<
    string,
    {
      flowRps: number
      modeledLatencyMs: number
      deliveredRps?: number
      blockedRps?: number
      warnings: string[]
    }
  >
  global: {
    warnings: string[]
    bottlenecks: Array<{ id: string; reason: string }>
  }
}



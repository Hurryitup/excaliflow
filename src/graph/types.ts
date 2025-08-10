export type Protocol = 'REST' | 'gRPC' | 'Kafka'

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

export type ServiceNode = NodeBase & {
  type: 'Service'
  dials: {
    concurrency: number
    serviceTimeMs: number
    maxInFlight?: number
    retryPolicy?: { maxRetries: number; backoffMs: number }
    batchSize?: number
    parallelEfficiency?: number // 0..1
    cacheHitRate?: number // 0..1
    cacheHitMs?: number
    coldStartMs?: number
    coldStartRate?: number // 0..1
  }
}

export type QueueTopicNode = NodeBase & {
  type: 'QueueTopic'
  dials: {
    partitions: number
    perPartitionThroughput: number
    replicationFactor?: number
    retentionHours?: number
    batchBytes?: number
    lingerMs?: number
    // Optional: modeled consumer concurrency at the topic level (informational)
    consumerGroupConcurrency?: number
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
    readWriteMix?: { read: number; write: number }
    connectionPoolSize?: number
    maxConcurrentRequests?: number
  }
}

export type Edge = {
  id: string
  from: string
  to: string
  protocol: Protocol
  label?: string
  fromHandle?: string
  toHandle?: string
  penalties?: Penalties
  dials: {
    // REST/gRPC
    clientTimeoutMs?: number
    maxInflight?: number
    payloadBytes?: number
    retries?: number
    retryBackoffMs?: number
    errorRate?: number // 0..1 expected error rate

    // Kafka
    keySkew?: number // 0..1 (1=all to one partition)
    consumerParallelism?: number
    pollBatchSize?: number
    atLeastOnce?: boolean
  }
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
    }
  >
  edgeStats: Record<
    string,
    {
      flowRps: number
      modeledLatencyMs: number
      warnings: string[]
    }
  >
  global: {
    warnings: string[]
    bottlenecks: Array<{ id: string; reason: string }>
  }
}



export type Protocol = 'REST' | 'gRPC' | 'Kafka'

export type NodeBase = {
  id: string
  type: 'Service' | 'QueueTopic' | 'ApiEndpoint' | 'Datastore'
  label: string
  notes?: string
  position: { x: number; y: number }
}

export type ServiceNode = NodeBase & {
  type: 'Service'
  dials: {
    concurrency: number
    serviceTimeMs: number
    maxInFlight?: number
    retryPolicy?: { maxRetries: number; backoffMs: number }
    batchSize?: number
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
  }
}

export type ApiEndpointNode = NodeBase & {
  type: 'ApiEndpoint'
  dials: {
    targetQps: number
    p50Ms?: number
    p95Ms?: number
  }
}

export type DatastoreNode = NodeBase & {
  type: 'Datastore'
  dials: {
    maxQps: number
    p95Ms: number
    readWriteMix?: { read: number; write: number }
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
  dials: {
    // REST/gRPC
    clientTimeoutMs?: number
    maxInflight?: number
    payloadBytes?: number

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



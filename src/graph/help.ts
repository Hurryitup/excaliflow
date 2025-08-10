import type { ApiEndpointNode, DatastoreNode, QueueTopicNode, ServiceNode } from './types'

export type NodeKind = ServiceNode['type'] | QueueTopicNode['type'] | ApiEndpointNode['type'] | DatastoreNode['type']

export const dialTooltips: Record<NodeKind, Record<string, string>> = {
  ApiEndpoint: {
    targetQps: 'Entry traffic rate in requests per second for this API endpoint. Used as the ingress source for downstream flow.',
    p50Ms: 'Observed median latency for this entrypoint (optional, informational).',
    p95Ms: 'Observed p95 latency for this entrypoint (optional, informational).',
  },
  Service: {
    concurrency: 'Number of parallel workers/replicas/threads. Capacity = concurrency × parallelEfficiency × (1000 / serviceTimeMs).',
    serviceTimeMs: 'Mean processing time per item (ms). Higher values reduce capacity; queueing kicks in when utilization > ~70%.',
    parallelEfficiency: 'Efficiency of parallelism (0..1). Models coordination/affinity overheads that make extra concurrency less than linearly effective.',
    cacheHitRate: 'Fraction of requests served from cache (0..1). Reduces effective service time accordingly.',
    cacheHitMs: 'Latency for cache hits (ms). Used with cacheHitRate.',
    fanOut: 'How to route egress across multiple outgoing edges. split: divide by weights; duplicate: send full egress to each edge (read+write patterns).',
    // Kafka parallelism is modeled via concurrency directly
  },
  QueueTopic: {
    partitions: 'Kafka/queue partitions. Topic capacity ≈ partitions × per‑partition throughput.',
    perPartitionThroughput: 'Throughput per partition (msgs/s). Effective topic capacity scales with partitions.',
    replicationFactor: 'Replication factor (informational). Adjust per-partition throughput to reflect ISR/acks if needed.',
  },
  Datastore: {
    maxQps: 'Datastore maximum sustainable capacity in cost units per second. Reads count 1×, writes count more (write amplification).',
    p95Ms: 'Observed p95 latency for the datastore at nominal load.',
    writeAmplification: 'Each write consumes N “cost units” of capacity.',
    lockContentionFactor: 'Extra latency multiplier under write load due to lock contention.',
    poolSize: 'Connection pool size. Can clamp effective capacity when combined with maxConcurrent.',
    maxConcurrent: 'Upper bound on concurrent requests the datastore can process.',
  },
}

export const metricTooltips: Record<NodeKind | 'Generic', Record<string, string>> = {
  Generic: {
    input: 'Total ingress to this node (sum of incoming edges; for entrypoints, the configured target QPS).',
    effectiveCap: 'Modeled capacity used for utilization. For services: concurrency × parallelEfficiency × (1000 / serviceTimeMs). For topics: partitions × per-part cap. For datastores: min(maxQps, pool/limits).',
    output: 'Egress used for downstream flow. output = min(input, capacity).',
    utilization: 'Utilization = input / max(capacity, ε). Colors: green <70%, yellow 70–85%, red ≥100%.',
  },
  ApiEndpoint: {},
  Service: {
    effectiveCap: 'Service capacity = concurrency × parallelEfficiency × (1000 / serviceTimeMs).',
  },
  QueueTopic: {
    effectiveCap: 'Topic capacity ≈ partitions × per-partition throughput (adjusted by skew and producers on edges).',
  },
  Datastore: {
    effectiveCap: 'Datastore capacity = min(maxQps, pool/limits).',
  },
}

export const edgeTooltips: Record<'Kafka' | 'Generic', Record<string, string>> = {
  Generic: {},
  Kafka: {
    keySkew: 'Producer key imbalance; reduces effective partitions as ~(1−skew²).',
  },
}

// Additional edge help
export const genericEdgeHelp: Record<string, string> = {
  opType: 'Hint for the target node. Datastores charge writes heavier than reads.',
  rateLimitRps: 'Client/outbound shaping; caps throughput on this edge.',
  weight: 'Fan-out split weight. When multiple outgoing edges, traffic splits proportionally to weights.',
}



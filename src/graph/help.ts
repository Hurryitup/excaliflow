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
    maxInFlight: 'Optional upper bound on inflight items. If set and exceeded, upstream may backpressure.',
    batchSize: 'If the service batches messages, this is the average batch size used in per-item timing.',
    parallelEfficiency: 'Efficiency of parallelism (0..1). Models coordination/affinity overheads that make extra concurrency less than linearly effective.',
    cacheHitRate: 'Fraction of requests served from cache (0..1). Reduces effective service time accordingly.',
    cacheHitMs: 'Latency for cache hits (ms). Used with cacheHitRate.',
    coldStartMs: 'Additive latency for cold starts (ms). Applied to a fraction of requests given by coldStartRate.',
    coldStartRate: 'Probability of a cold start for any request (0..1).',
  },
  QueueTopic: {
    partitions: 'Kafka/queue partitions. Topic capacity ≈ partitions × per-partition throughput.',
    perPartitionThroughput: 'Throughput per partition (msgs/s). Effective topic capacity scales with partitions.',
    replicationFactor: 'Replication factor (informational). Adjust per-partition throughput to reflect ISR/acks if needed.',
    retentionHours: 'Retention setting (informational).',
    consumerGroupConcurrency: 'Number of consumer instances in the dominant consumer group (informational).',
  },
  Datastore: {
    maxQps: 'Datastore maximum sustainable QPS. Requests above this accumulate as backlog.',
    p95Ms: 'Observed p95 latency for the datastore at nominal load.',
    connectionPoolSize: 'Number of connections in the pool. May bound effective concurrency to the datastore.',
    maxConcurrentRequests: 'Upper bound on concurrent requests the datastore can process (per-connection or global).',
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

export const edgeTooltips: Record<'REST' | 'gRPC' | 'Kafka', Record<string, string>> = {
  REST: {
    payloadBytes: 'Approximate payload size sent over the network. Edge latency adds (payloadBytes / linkMBps) × 1000 ms.',
    clientTimeoutMs: 'Client timeout in ms. If modeled edge latency ≥ timeout, a timeout warning is surfaced.',
    maxInflight: 'Optional cap on in‑flight requests over this edge (not enforced in v1 compute; informational).',
    retries: 'Number of client retries on failure/timeouts. Adds retryBackoffMs per retry to latency of retried portion.',
    retryBackoffMs: 'Backoff delay between retries (ms).',
    errorRate: 'Expected error rate (0..1) on this edge. Can be used to approximate retry probability.',
  },
  gRPC: {
    payloadBytes: 'Approximate message size for the call; used in edge latency calculation.',
    clientTimeoutMs: 'Client deadline/timeout for the call. Used to surface a timeout warning.',
    maxInflight: 'Optional cap on in‑flight calls (informational in v1).',
    retries: 'Number of client retries on failure/timeouts. Adds retryBackoffMs per retry to latency of retried portion.',
    retryBackoffMs: 'Backoff delay between retries (ms).',
    errorRate: 'Expected error rate (0..1) on this edge. Can be used to approximate retry probability.',
  },
  Kafka: {
    keySkew: 'Skew of keys to partitions (0..1). Effective producer cap reduced by keySkew².',
  },
}



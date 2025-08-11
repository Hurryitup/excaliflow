import type { GraphModel } from '../graph/types'

export const FanInJoin: GraphModel = {
  nodes: [
    { id: 'api1', type: 'ApiEndpoint', label: 'API A', position: { x: 0, y: 0 }, dials: { targetQps: 300 } },
    { id: 'api2', type: 'ApiEndpoint', label: 'API B', position: { x: 0, y: 100 }, dials: { targetQps: 300 } },
    { id: 'api3', type: 'ApiEndpoint', label: 'API C', position: { x: 0, y: 200 }, dials: { targetQps: 300 } },
    {
      id: 'svc',
      type: 'Service',
      label: 'Joiner',
      position: { x: 400, y: 100 },
      dials: { concurrency: 4, serviceTimeMs: 20, parallelEfficiency: 1, join: { type: 'kOfN', requiredStreams: 3, efficiency: 1 } },
    },
  ],
  edges: [
    { id: 'e1', from: 'api1', to: 'svc', protocol: 'Generic' },
    { id: 'e2', from: 'api2', to: 'svc', protocol: 'Generic' },
    { id: 'e3', from: 'api3', to: 'svc', protocol: 'Generic' },
  ],
}

export const KafkaETL: GraphModel = {
  nodes: [
    { id: 'svc1', type: 'Service', label: 'Producer', position: { x: 0, y: 100 }, dials: { concurrency: 4, serviceTimeMs: 10 } },
    { id: 't', type: 'QueueTopic', label: 'Topic', position: { x: 300, y: 100 }, dials: { partitions: 12, perPartitionThroughput: 150 } },
    { id: 'svc2', type: 'Service', label: 'ETL', position: { x: 600, y: 100 }, dials: { concurrency: 4, serviceTimeMs: 20 } },
    { id: 'db', type: 'Datastore', label: 'Warehouse', position: { x: 900, y: 100 }, dials: { maxQps: 1200, p95Ms: 50 } },
  ],
  edges: [
    { id: 'e1', from: 'svc1', to: 't', protocol: 'Kafka', keySkew: 0.2 },
    { id: 'e2', from: 't', to: 'svc2', protocol: 'Kafka' },
    { id: 'e3', from: 'svc2', to: 'db', protocol: 'Generic', opType: 'write' },
  ],
}



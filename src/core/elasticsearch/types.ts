/**
 * Elasticsearch Types
 * 
 * Типы для компонента Elasticsearch.
 */

export type ClusterHealth = 'green' | 'yellow' | 'red';

export interface ElasticsearchNode {
  address: string;
  status: 'up' | 'down';
  load: number;
  shards: number;
}

export interface Index {
  name: string;
  docs: number;
  size: number; // bytes
  shards: number;
  replicas: number;
  health: ClusterHealth;
  mappings?: Record<string, any>;
  settings?: Record<string, any>;
}

export interface Shard {
  index: string;
  shard: number;
  primary: boolean;
  node: string;
  state: 'STARTED' | 'RELOCATING' | 'INITIALIZING' | 'UNASSIGNED';
  docs: number;
  size: number;
}

export interface Document {
  _id: string;
  _index: string;
  _source: Record<string, any>;
  _routing?: string;
  _version?: number;
  _seq_no?: number;
  _primary_term?: number;
}

export interface ElasticsearchConfig {
  clusterName?: string;
  nodes?: string[];
  indices?: Index[];
  defaultShards?: number;
  defaultReplicas?: number;
  refreshInterval?: string;
  enableSSL?: boolean;
  enableAuth?: boolean;
  username?: string;
  password?: string;
}

export interface ElasticsearchOperation {
  operation: 'index' | 'get' | 'search' | 'delete' | 'bulk' | 'update';
  index?: string;
  id?: string;
  document?: any;
  query?: any;
  routing?: string;
  latency?: number;
  success?: boolean;
  error?: string;
  hits?: number;
  took?: number;
  items?: number; // For bulk operations
  errors?: number; // For bulk operations
  version?: number; // Document version
  _source?: any; // Source filtering result
}

export interface OperationTypeMetrics {
  operationsPerSecond: number;
  averageLatency: number;
  p50Latency: number;
  p99Latency: number;
  errorRate: number;
  totalOperations: number;
  totalErrors: number;
}

export interface IndexMetrics {
  indexName: string;
  docs: number;
  size: number;
  shards: number;
  replicas: number;
  health: ClusterHealth;
  indexOperationsPerSecond: number;
  searchOperationsPerSecond: number;
  averageIndexLatency: number;
  averageSearchLatency: number;
  refreshOperationsPerSecond: number;
  pendingDocuments: number;
}

export interface ShardMetrics {
  index: string;
  shard: number;
  primary: boolean;
  node: string;
  state: 'STARTED' | 'RELOCATING' | 'INITIALIZING' | 'UNASSIGNED';
  docs: number;
  size: number;
  operationsPerSecond: number;
  averageLatency: number;
}

export interface NodeMetrics {
  address: string;
  status: 'up' | 'down';
  load: number;
  shards: number;
  operationsPerSecond: number;
  averageLatency: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface ElasticsearchMetrics {
  clusterHealth: ClusterHealth;
  totalNodes: number;
  healthyNodes: number;
  totalIndices: number;
  totalDocs: number;
  totalSize: number;
  activeShards: number;
  relocatingShards: number;
  initializingShards: number;
  unassignedShards: number;
  indexOperationsPerSecond: number;
  searchOperationsPerSecond: number;
  averageIndexLatency: number;
  averageSearchLatency: number;
  averageGetLatency: number;
  // Метрики по типам операций
  operationMetrics: {
    index: OperationTypeMetrics;
    search: OperationTypeMetrics;
    get: OperationTypeMetrics;
    delete: OperationTypeMetrics;
    bulk: OperationTypeMetrics;
    update: OperationTypeMetrics;
  };
  // Метрики по индексам
  indexMetrics: IndexMetrics[];
  // Метрики по шардам
  shardMetrics: ShardMetrics[];
  // Метрики по узлам
  nodeMetrics: NodeMetrics[];
}

/**
 * Elasticsearch Constants
 * 
 * Все константы для компонента Elasticsearch.
 * Используются вместо магических чисел и строк для улучшения читаемости и поддержки кода.
 */

// ============================================================================
// Default Values
// ============================================================================

/** Default Elasticsearch HTTP port */
export const DEFAULT_ELASTICSEARCH_PORT = 9200;

/** Default cluster name */
export const DEFAULT_CLUSTER_NAME = 'elasticsearch-cluster';

/** Default index name */
export const DEFAULT_INDEX_NAME = 'default-index';

/** Default number of primary shards */
export const DEFAULT_NUMBER_OF_SHARDS = 5;

/** Default number of replicas */
export const DEFAULT_NUMBER_OF_REPLICAS = 1;

/** Default refresh interval */
export const DEFAULT_REFRESH_INTERVAL = '1s';

/** Default node address */
export const DEFAULT_NODE_ADDRESS = 'localhost:9200';

/** Default username for authentication */
export const DEFAULT_USERNAME = 'elastic';

// ============================================================================
// Limits
// ============================================================================

/** Maximum number of shards per index */
export const MAX_SHARDS_PER_INDEX = 1024;

/** Maximum number of replicas */
export const MAX_REPLICAS = 10;

/** Maximum number of nodes in cluster */
export const MAX_CLUSTER_NODES = 1000;

// ============================================================================
// Performance Constants
// ============================================================================

/** Base latency for index operations (ms) */
export const BASE_INDEX_LATENCY_MS = 5;

/** Base latency for search operations (ms) */
export const BASE_SEARCH_LATENCY_MS = 10;

/** Base latency for get operations (ms) */
export const BASE_GET_LATENCY_MS = 2;

/** Latency per shard for search (ms) */
export const LATENCY_PER_SHARD_MS = 2;

/** Maximum additional latency for large result sets (ms) */
export const MAX_RESULT_SET_LATENCY_MS = 50;

/** Document size estimate (bytes) */
export const ESTIMATED_DOCUMENT_SIZE_BYTES = 1024;

/** Maximum document size factor for latency calculation */
export const MAX_DOC_COUNT_FACTOR = 20;

/** Document count threshold for latency calculation */
export const DOC_COUNT_THRESHOLD = 10000;

/** Random latency variance for index operations (ms) */
export const INDEX_LATENCY_VARIANCE_MS = 5;

/** Random latency variance for search operations (ms) */
export const SEARCH_LATENCY_VARIANCE_MS = 10;

/** Random latency variance for get operations (ms) */
export const GET_LATENCY_VARIANCE_MS = 3;

/** Result count threshold for latency calculation */
export const RESULT_COUNT_THRESHOLD = 100;

// ============================================================================
// Cluster Health States
// ============================================================================

export const CLUSTER_HEALTH_GREEN = 'green';
export const CLUSTER_HEALTH_YELLOW = 'yellow';
export const CLUSTER_HEALTH_RED = 'red';

// ============================================================================
// Shard States
// ============================================================================

export const SHARD_STATE_STARTED = 'STARTED';
export const SHARD_STATE_RELOCATING = 'RELOCATING';
export const SHARD_STATE_INITIALIZING = 'INITIALIZING';
export const SHARD_STATE_UNASSIGNED = 'UNASSIGNED';

// ============================================================================
// Operation Types
// ============================================================================

export const OPERATION_INDEX = 'index';
export const OPERATION_GET = 'get';
export const OPERATION_SEARCH = 'search';
export const OPERATION_DELETE = 'delete';
export const OPERATION_BULK = 'bulk';
export const OPERATION_UPDATE = 'update';

// ============================================================================
// History Limits
// ============================================================================

/** Maximum number of operations to keep in history */
export const MAX_OPERATION_HISTORY = 500;

/** Maximum number of recent queries to keep */
export const MAX_RECENT_QUERIES = 100;

// ============================================================================
// Metrics Update
// ============================================================================

/** Time window for calculating operations per second (ms) */
export const METRICS_TIME_WINDOW_MS = 1000;

// ============================================================================
// Node Load Simulation
// ============================================================================

/** Minimum node load (for simulation) */
export const MIN_NODE_LOAD = 0.3;

/** Maximum node load (for simulation) */
export const MAX_NODE_LOAD = 0.7;

/** Default node load (for simulation) */
export const DEFAULT_NODE_LOAD = 0.5;

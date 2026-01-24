/**
 * Cassandra Constants
 * 
 * Все константы для компонента Apache Cassandra.
 * Используются вместо магических чисел для улучшения читаемости и поддержки кода.
 */

// ============================================================================
// Default Values
// ============================================================================

/** Default Cassandra CQL port */
export const DEFAULT_CASSANDRA_PORT = 9042;

/** Default number of tokens per node (vnodes) */
export const DEFAULT_NODE_TOKENS = 256;

/** Default initial load for a node (0 = no load) */
export const DEFAULT_NODE_LOAD = 0;

/** Default replication factor */
export const DEFAULT_REPLICATION_FACTOR = 3;

/** Default consistency level */
export const DEFAULT_CONSISTENCY_LEVEL: 'QUORUM' = 'QUORUM';

/** Default datacenter name */
export const DEFAULT_DATACENTER = 'dc1';

/** Default rack name */
export const DEFAULT_RACK = 'rack1';

/** Default cluster name */
export const DEFAULT_CLUSTER_NAME = 'archiphoenix-cluster';

// ============================================================================
// Data Size Estimates
// ============================================================================

/** Estimated average row size in bytes (can be overridden per table) */
export const ESTIMATED_ROW_SIZE_BYTES = 1024;

/** Memtable flush threshold in bytes (50MB) */
export const MEMTABLE_FLUSH_THRESHOLD_BYTES = 50 * 1024 * 1024;

// ============================================================================
// Latency Calculations (milliseconds)
// ============================================================================

/** Base read latency in milliseconds */
export const BASE_READ_LATENCY_MS = 2;

/** Base write latency in milliseconds */
export const BASE_WRITE_LATENCY_MS = 5;

/** Multiplier for replica latency calculation */
export const REPLICA_LATENCY_MULTIPLIER = 3;

/** Maximum network jitter for read operations (milliseconds) */
export const NETWORK_JITTER_MAX_MS = 2;

/** Maximum network jitter for write operations (milliseconds) */
export const NETWORK_JITTER_MAX_WRITE_MS = 3;

// ============================================================================
// Timeouts and Intervals (milliseconds)
// ============================================================================

/** Hint TTL in milliseconds (3 hours) */
export const HINT_TTL_MS = 3 * 60 * 60 * 1000;

/** Gossip protocol exchange interval in milliseconds */
export const GOSSIP_INTERVAL_MS = 1000;

/** Heartbeat timeout before marking node as down (milliseconds) */
export const HEARTBEAT_TIMEOUT_MS = 10000;

/** Compaction check interval in milliseconds */
export const COMPACTION_INTERVAL_MS = 5000;

// ============================================================================
// Consistency Requirements
// ============================================================================

/** Consistency violation chance when all nodes are healthy (2%) */
export const CONSISTENCY_VIOLATION_CHANCE_HEALTHY = 0.02;

/** Consistency violation chance when some nodes are down (15%) */
export const CONSISTENCY_VIOLATION_CHANCE_UNHEALTHY = 0.15;

// ============================================================================
// Compaction
// ============================================================================

/** Minimum number of SSTables required for compaction */
export const MIN_SSTABLES_FOR_COMPACTION = 2;

/** Minimum number of rows to trigger flush */
export const MIN_ROWS_FOR_FLUSH = 50;

// ============================================================================
// Repair
// ============================================================================

/** Minimum number of nodes required for repair operation */
export const MIN_NODES_FOR_REPAIR = 2;

// ============================================================================
// Gossip
// ============================================================================

/** Number of gossip partners per node (typically 2-3) */
export const GOSSIP_PARTNERS_COUNT = 3;

// ============================================================================
// Token Ring
// ============================================================================

/** Maximum token value (2^63 - 1 for 64-bit signed integer) */
export const MAX_TOKEN = Math.pow(2, 63) - 1;

/** Default partitioner type */
export const DEFAULT_PARTITIONER: 'Murmur3Partitioner' | 'RandomPartitioner' = 'Murmur3Partitioner';

// ============================================================================
// Default Address Format
// ============================================================================

/** Default node address format */
export const DEFAULT_NODE_ADDRESS = `localhost:${DEFAULT_CASSANDRA_PORT}`;

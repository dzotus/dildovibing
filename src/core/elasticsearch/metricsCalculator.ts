/**
 * Elasticsearch Metrics Calculator
 * 
 * Расчет метрик производительности для операций Elasticsearch.
 * Учитывает различные факторы: количество шардов, размер данных, сложность запроса, нагрузку на кластер.
 */

import {
  BASE_INDEX_LATENCY_MS,
  BASE_SEARCH_LATENCY_MS,
  BASE_GET_LATENCY_MS,
  LATENCY_PER_SHARD_MS,
  MAX_RESULT_SET_LATENCY_MS,
  INDEX_LATENCY_VARIANCE_MS,
  SEARCH_LATENCY_VARIANCE_MS,
  GET_LATENCY_VARIANCE_MS,
  DOC_COUNT_THRESHOLD,
  MAX_DOC_COUNT_FACTOR,
  RESULT_COUNT_THRESHOLD,
} from './constants';

export interface LatencyFactors {
  shardCount?: number;
  resultCount?: number;
  documentCount?: number;
  queryComplexity?: number;
  clusterLoad?: number;
  indexSize?: number;
}

/**
 * Calculate latency for index operations
 */
export function calculateIndexLatency(factors: LatencyFactors = {}): number {
  const {
    documentCount = 0,
    clusterLoad = 0.5,
    indexSize = 0,
  } = factors;

  let latency = BASE_INDEX_LATENCY_MS;

  // Factor in document count (more documents = slightly higher latency)
  const docFactor = Math.min(
    MAX_DOC_COUNT_FACTOR,
    documentCount / DOC_COUNT_THRESHOLD
  );
  latency += docFactor;

  // Factor in cluster load (higher load = higher latency)
  const loadFactor = clusterLoad * 5; // 0-5ms additional latency based on load
  latency += loadFactor;

  // Factor in index size (larger index = slightly higher latency)
  const sizeFactor = Math.min(10, indexSize / (1024 * 1024 * 100)); // 10ms max for 100MB
  latency += sizeFactor;

  // Add random variance
  latency += Math.random() * INDEX_LATENCY_VARIANCE_MS;

  return Math.max(1, Math.round(latency * 100) / 100); // Round to 2 decimals, min 1ms
}

/**
 * Calculate latency for search operations
 */
export function calculateSearchLatency(factors: LatencyFactors = {}): number {
  const {
    shardCount = 1,
    resultCount = 0,
    queryComplexity = 1,
    clusterLoad = 0.5,
  } = factors;

  let latency = BASE_SEARCH_LATENCY_MS;

  // Factor in shard count (more shards = more parallel work, but also more coordination)
  const shardLatency = shardCount * LATENCY_PER_SHARD_MS;
  latency += shardLatency;

  // Factor in result count (more results = more processing)
  const resultLatency = Math.min(
    MAX_RESULT_SET_LATENCY_MS,
    (resultCount / RESULT_COUNT_THRESHOLD) * 10
  );
  latency += resultLatency;

  // Factor in query complexity (bool queries, aggregations, etc.)
  const complexityFactor = queryComplexity * 5; // 5ms per complexity unit
  latency += complexityFactor;

  // Factor in cluster load
  const loadFactor = clusterLoad * 10; // 0-10ms additional latency based on load
  latency += loadFactor;

  // Add random variance
  latency += Math.random() * SEARCH_LATENCY_VARIANCE_MS;

  return Math.max(1, Math.round(latency * 100) / 100);
}

/**
 * Calculate latency for get operations
 */
export function calculateGetLatency(factors: LatencyFactors = {}): number {
  const {
    clusterLoad = 0.5,
  } = factors;

  let latency = BASE_GET_LATENCY_MS;

  // Factor in cluster load (minimal impact for get operations)
  const loadFactor = clusterLoad * 2; // 0-2ms additional latency
  latency += loadFactor;

  // Add random variance
  latency += Math.random() * GET_LATENCY_VARIANCE_MS;

  return Math.max(1, Math.round(latency * 100) / 100);
}

/**
 * Calculate query complexity score
 * Higher score = more complex query = higher latency
 */
export function calculateQueryComplexity(query: any): number {
  if (!query || !query.query) {
    return 1; // match_all is simplest
  }

  let complexity = 1;

  const q = query.query;

  // Bool queries add complexity
  if (q.bool) {
    complexity += 2; // Base complexity for bool
    
    if (q.bool.must && Array.isArray(q.bool.must)) {
      complexity += q.bool.must.length;
    }
    if (q.bool.should && Array.isArray(q.bool.should)) {
      complexity += q.bool.should.length * 0.5;
    }
    if (q.bool.must_not && Array.isArray(q.bool.must_not)) {
      complexity += q.bool.must_not.length;
    }
    if (q.bool.filter && Array.isArray(q.bool.filter)) {
      complexity += q.bool.filter.length;
    }
  }

  // Range queries add complexity
  if (q.range) {
    complexity += 1.5;
  }

  // Wildcard queries add complexity
  if (q.wildcard) {
    complexity += 2;
  }

  // Aggregations add significant complexity
  if (query.aggs || query.aggregations) {
    const aggs = query.aggs || query.aggregations;
    complexity += Object.keys(aggs).length * 3;
  }

  // Sorting adds some complexity
  if (query.sort && Array.isArray(query.sort)) {
    complexity += query.sort.length * 0.5;
  }

  return Math.max(1, complexity);
}

/**
 * Calculate average cluster load from nodes
 */
export function calculateClusterLoad(nodeLoads: number[]): number {
  if (nodeLoads.length === 0) return 0.5; // Default

  const sum = nodeLoads.reduce((acc, load) => acc + load, 0);
  return sum / nodeLoads.length;
}

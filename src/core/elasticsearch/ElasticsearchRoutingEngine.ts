/**
 * Elasticsearch Routing Engine
 * Handles Elasticsearch operations: indexing, searching, cluster management, shard routing
 */

import {
  DEFAULT_CLUSTER_NAME,
  DEFAULT_INDEX_NAME,
  DEFAULT_NUMBER_OF_SHARDS,
  DEFAULT_NUMBER_OF_REPLICAS,
  DEFAULT_REFRESH_INTERVAL,
  DEFAULT_NODE_ADDRESS,
  DEFAULT_USERNAME,
  BASE_INDEX_LATENCY_MS,
  BASE_SEARCH_LATENCY_MS,
  BASE_GET_LATENCY_MS,
  LATENCY_PER_SHARD_MS,
  MAX_RESULT_SET_LATENCY_MS,
  ESTIMATED_DOCUMENT_SIZE_BYTES,
  MAX_DOC_COUNT_FACTOR,
  DOC_COUNT_THRESHOLD,
  INDEX_LATENCY_VARIANCE_MS,
  SEARCH_LATENCY_VARIANCE_MS,
  GET_LATENCY_VARIANCE_MS,
  RESULT_COUNT_THRESHOLD,
  CLUSTER_HEALTH_GREEN,
  CLUSTER_HEALTH_YELLOW,
  SHARD_STATE_STARTED,
  MAX_OPERATION_HISTORY,
  MAX_RECENT_QUERIES,
  METRICS_TIME_WINDOW_MS,
  MIN_NODE_LOAD,
  MAX_NODE_LOAD,
  DEFAULT_NODE_LOAD,
  OPERATION_BULK,
} from './constants';

import type {
  ClusterHealth,
  ElasticsearchNode,
  Index,
  Shard,
  Document,
  ElasticsearchConfig,
  ElasticsearchOperation,
  ElasticsearchMetrics,
} from './types';

import { parseAndExecuteQuery } from './queryParser';
import {
  calculateIndexLatency,
  calculateSearchLatency,
  calculateGetLatency,
  calculateQueryComplexity,
  calculateClusterLoad,
} from './metricsCalculator';

/**
 * Elasticsearch Routing Engine
 * Simulates Elasticsearch cluster behavior
 */
interface PendingDocument {
  doc: Document;
  indexedAt: number;
}

export class ElasticsearchRoutingEngine {
  private clusterName: string = DEFAULT_CLUSTER_NAME;
  private nodes: Map<string, ElasticsearchNode> = new Map();
  private indices: Map<string, Index> = new Map();
  private shards: Map<string, Shard[]> = new Map(); // index -> shards[]
  private documents: Map<string, Map<number, Document[]>> = new Map(); // index -> shard -> documents[]
  private pendingDocuments: Map<string, Map<number, PendingDocument[]>> = new Map(); // index -> shard -> pending documents[]
  private documentVersions: Map<string, Map<string, number>> = new Map(); // index -> docId -> version
  private documentSeqNos: Map<string, Map<string, number>> = new Map(); // index -> docId -> seq_no
  private documentPrimaryTerms: Map<string, Map<string, number>> = new Map(); // index -> docId -> primary_term
  private globalSeqNo: number = 0; // Global sequence number
  private defaultShards: number = DEFAULT_NUMBER_OF_SHARDS;
  private defaultReplicas: number = DEFAULT_NUMBER_OF_REPLICAS;
  private refreshInterval: string = DEFAULT_REFRESH_INTERVAL;
  private refreshIntervals: Map<string, number> = new Map(); // index -> refresh interval in ms
  private lastRefresh: Map<string, number> = new Map(); // index -> last refresh timestamp
  private refreshOperations: Array<{ timestamp: number; index: string; docsRefreshed: number }> = [];
  
  // Metrics
  private metrics: ElasticsearchMetrics = {
    clusterHealth: CLUSTER_HEALTH_GREEN,
    totalNodes: 0,
    healthyNodes: 0,
    totalIndices: 0,
    totalDocs: 0,
    totalSize: 0,
    activeShards: 0,
    relocatingShards: 0,
    initializingShards: 0,
    unassignedShards: 0,
    indexOperationsPerSecond: 0,
    searchOperationsPerSecond: 0,
    averageIndexLatency: BASE_INDEX_LATENCY_MS,
    averageSearchLatency: BASE_SEARCH_LATENCY_MS,
    averageGetLatency: BASE_GET_LATENCY_MS,
    operationMetrics: {
      index: {
        operationsPerSecond: 0,
        averageLatency: BASE_INDEX_LATENCY_MS,
        p50Latency: BASE_INDEX_LATENCY_MS,
        p99Latency: BASE_INDEX_LATENCY_MS,
        errorRate: 0,
        totalOperations: 0,
        totalErrors: 0,
      },
      search: {
        operationsPerSecond: 0,
        averageLatency: BASE_SEARCH_LATENCY_MS,
        p50Latency: BASE_SEARCH_LATENCY_MS,
        p99Latency: BASE_SEARCH_LATENCY_MS,
        errorRate: 0,
        totalOperations: 0,
        totalErrors: 0,
      },
      get: {
        operationsPerSecond: 0,
        averageLatency: BASE_GET_LATENCY_MS,
        p50Latency: BASE_GET_LATENCY_MS,
        p99Latency: BASE_GET_LATENCY_MS,
        errorRate: 0,
        totalOperations: 0,
        totalErrors: 0,
      },
      delete: {
        operationsPerSecond: 0,
        averageLatency: BASE_INDEX_LATENCY_MS,
        p50Latency: BASE_INDEX_LATENCY_MS,
        p99Latency: BASE_INDEX_LATENCY_MS,
        errorRate: 0,
        totalOperations: 0,
        totalErrors: 0,
      },
      bulk: {
        operationsPerSecond: 0,
        averageLatency: BASE_INDEX_LATENCY_MS,
        p50Latency: BASE_INDEX_LATENCY_MS,
        p99Latency: BASE_INDEX_LATENCY_MS,
        errorRate: 0,
        totalOperations: 0,
        totalErrors: 0,
      },
      update: {
        operationsPerSecond: 0,
        averageLatency: BASE_INDEX_LATENCY_MS,
        p50Latency: BASE_INDEX_LATENCY_MS,
        p99Latency: BASE_INDEX_LATENCY_MS,
        errorRate: 0,
        totalOperations: 0,
        totalErrors: 0,
      },
    },
    indexMetrics: [],
    shardMetrics: [],
    nodeMetrics: [],
  };

  // Operation tracking
  private indexOperations: Array<{ timestamp: number; latency: number; success: boolean }> = [];
  private searchOperations: Array<{ timestamp: number; latency: number; hits: number; success: boolean }> = [];
  private getOperations: Array<{ timestamp: number; latency: number; success: boolean }> = [];
  private deleteOperations: Array<{ timestamp: number; latency: number; success: boolean }> = [];
  private updateOperations: Array<{ timestamp: number; latency: number; success: boolean }> = [];
  private bulkOperations: Array<{ timestamp: number; latency: number; items: number; errors: number }> = [];
  private lastMetricsUpdate: number = Date.now();
  private recentQueries: ElasticsearchOperation[] = [];

  /**
   * Parse refresh interval string to milliseconds
   * Supports: "1s", "5m", "1h", "-1" (disabled)
   */
  private parseRefreshInterval(interval: string): number {
    if (interval === '-1') {
      return -1; // Disabled
    }

    const match = interval.match(/^(\d+)([smhd])$/);
    if (!match) {
      return this.parseRefreshInterval(DEFAULT_REFRESH_INTERVAL); // Default to 1s
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return this.parseRefreshInterval(DEFAULT_REFRESH_INTERVAL);
    }
  }

  /**
   * Initialize with Elasticsearch configuration
   */
  public initialize(config: ElasticsearchConfig): void {
    this.clusterName = config.clusterName || DEFAULT_CLUSTER_NAME;
    this.defaultShards = config.defaultShards || DEFAULT_NUMBER_OF_SHARDS;
    this.defaultReplicas = config.defaultReplicas || DEFAULT_NUMBER_OF_REPLICAS;
    this.refreshInterval = config.refreshInterval || DEFAULT_REFRESH_INTERVAL;

    // Initialize nodes
    this.nodes.clear();
    if (config.nodes && config.nodes.length > 0) {
      for (const nodeAddr of config.nodes) {
        this.nodes.set(nodeAddr, {
          address: nodeAddr,
          status: 'up',
          load: MIN_NODE_LOAD + Math.random() * (MAX_NODE_LOAD - MIN_NODE_LOAD),
          shards: 0,
        });
      }
    } else {
      // Default node
      this.nodes.set(DEFAULT_NODE_ADDRESS, {
        address: DEFAULT_NODE_ADDRESS,
        status: 'up',
        load: DEFAULT_NODE_LOAD,
        shards: 0,
      });
    }

    // Initialize indices
    this.indices.clear();
    this.shards.clear();
    this.documents.clear();
    this.pendingDocuments.clear();
    this.refreshIntervals.clear();
    this.lastRefresh.clear();
    this.documentVersions.clear();
    this.documentSeqNos.clear();
    this.documentPrimaryTerms.clear();
    this.globalSeqNo = 0;
    
    if (config.indices && config.indices.length > 0) {
      for (const index of config.indices) {
        const indexRefreshInterval = index.settings?.index?.refresh_interval || this.refreshInterval;
        this.refreshIntervals.set(index.name, this.parseRefreshInterval(indexRefreshInterval));
        this.lastRefresh.set(index.name, Date.now());
        this.createIndex(index.name, index.shards || this.defaultShards, index.replicas || this.defaultReplicas, index);
      }
    } else {
      // Default index
      this.refreshIntervals.set(DEFAULT_INDEX_NAME, this.parseRefreshInterval(this.refreshInterval));
      this.lastRefresh.set(DEFAULT_INDEX_NAME, Date.now());
      this.createIndex(DEFAULT_INDEX_NAME, this.defaultShards, this.defaultReplicas);
    }

    this.updateMetrics();
  }

  /**
   * Sync configuration from UI with runtime state
   */
  public syncFromConfig(config: Partial<ElasticsearchConfig>): void {
    if (config.clusterName) {
      this.clusterName = config.clusterName;
    }

    if (config.defaultShards !== undefined) {
      this.defaultShards = config.defaultShards;
    }

    if (config.defaultReplicas !== undefined) {
      this.defaultReplicas = config.defaultReplicas;
    }

    if (config.refreshInterval) {
      this.refreshInterval = config.refreshInterval;
      // Update refresh intervals for all indices
      for (const indexName of this.indices.keys()) {
        this.refreshIntervals.set(indexName, this.parseRefreshInterval(this.refreshInterval));
      }
    }

    // Update nodes
    if (config.nodes) {
      const existingNodes = new Set(this.nodes.keys());
      for (const nodeAddr of config.nodes) {
        if (!this.nodes.has(nodeAddr)) {
          // New node
          this.nodes.set(nodeAddr, {
            address: nodeAddr,
            status: 'up',
            load: MIN_NODE_LOAD + Math.random() * (MAX_NODE_LOAD - MIN_NODE_LOAD),
            shards: 0,
          });
        }
      }
      // Remove nodes that are no longer in config (optional - for safety we keep them)
    }

    // Update indices
    if (config.indices) {
      const existingIndices = new Set(this.indices.keys());
      for (const index of config.indices) {
        if (!this.indices.has(index.name)) {
          // New index
          this.createIndex(
            index.name,
            index.shards || this.defaultShards,
            index.replicas || this.defaultReplicas,
            index
          );
        } else {
          // Update existing index metadata, preserve runtime data
          const existingIndex = this.indices.get(index.name)!;
          const existingDocs = this.getTotalDocsForIndex(index.name);
          const existingSize = this.getTotalSizeForIndex(index.name);
          
          this.indices.set(index.name, {
            ...index,
            docs: existingIndex.docs || existingDocs,
            size: existingIndex.size || existingSize,
            health: this.calculateIndexHealth(index.name),
          });
        }
      }
    }

    this.updateMetrics();
  }

  /**
   * Create an index
   */
  public createIndex(name: string, shards: number = DEFAULT_NUMBER_OF_SHARDS, replicas: number = DEFAULT_NUMBER_OF_REPLICAS, indexConfig?: Partial<Index>): void {
    const index: Index = {
      name,
      docs: indexConfig?.docs || 0,
      size: indexConfig?.size || 0,
      shards,
      replicas,
      health: CLUSTER_HEALTH_YELLOW, // Will be updated
      mappings: indexConfig?.mappings,
      settings: indexConfig?.settings,
    };

    this.indices.set(name, index);

    // Create shards
    const shardList: Shard[] = [];
    const nodeAddresses = Array.from(this.nodes.keys());
    
    for (let shardNum = 0; shardNum < shards; shardNum++) {
      // Primary shard
      const primaryNode = nodeAddresses[shardNum % nodeAddresses.length];
      shardList.push({
        index: name,
        shard: shardNum,
        primary: true,
        node: primaryNode,
        state: SHARD_STATE_STARTED,
        docs: 0,
        size: 0,
      });

      // Replica shards
      for (let replicaNum = 0; replicaNum < replicas; replicaNum++) {
        const replicaNode = nodeAddresses[(shardNum + replicaNum + 1) % nodeAddresses.length];
        shardList.push({
          index: name,
          shard: shardNum,
          primary: false,
          node: replicaNode,
          state: SHARD_STATE_STARTED,
          docs: 0,
          size: 0,
        });
      }
    }

    this.shards.set(name, shardList);
    
    // Initialize document storage
    if (!this.documents.has(name)) {
      const docMap = new Map<number, Document[]>();
      for (let i = 0; i < shards; i++) {
        docMap.set(i, []);
      }
      this.documents.set(name, docMap);
    }

    // Initialize pending documents storage
    if (!this.pendingDocuments.has(name)) {
      const pendingMap = new Map<number, PendingDocument[]>();
      for (let i = 0; i < shards; i++) {
        pendingMap.set(i, []);
      }
      this.pendingDocuments.set(name, pendingMap);
    }

    // Initialize version tracking
    if (!this.documentVersions.has(name)) {
      this.documentVersions.set(name, new Map());
    }
    if (!this.documentSeqNos.has(name)) {
      this.documentSeqNos.set(name, new Map());
    }
    if (!this.documentPrimaryTerms.has(name)) {
      this.documentPrimaryTerms.set(name, new Map());
    }

    // Initialize refresh interval if not set
    if (!this.refreshIntervals.has(name)) {
      const indexRefreshInterval = indexConfig?.settings?.index?.refresh_interval || this.refreshInterval;
      this.refreshIntervals.set(name, this.parseRefreshInterval(indexRefreshInterval));
    }
    if (!this.lastRefresh.has(name)) {
      this.lastRefresh.set(name, Date.now());
    }

    // Update index health
    index.health = this.calculateIndexHealth(name);
    this.updateMetrics();
  }

  /**
   * Calculate which shard a document should be routed to
   * Formula: shard_num = hash(_routing || _id) % num_primary_shards
   */
  private routeToShard(index: string, routing: string): number {
    const indexData = this.indices.get(index);
    if (!indexData) return 0;

    // Simple hash function (similar to Elasticsearch's murmur3)
    let hash = 0;
    for (let i = 0; i < routing.length; i++) {
      const char = routing.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash) % indexData.shards;
  }

  /**
   * Refresh an index - move pending documents to searchable documents
   */
  private refreshIndex(index: string): number {
    const pendingMap = this.pendingDocuments.get(index);
    const docMap = this.documents.get(index);
    if (!pendingMap || !docMap) return 0;

    let totalRefreshed = 0;
    const now = Date.now();

    for (const [shardNum, pendingDocs] of pendingMap.entries()) {
      const shardDocs = docMap.get(shardNum) || [];
      let refreshed = 0;

      // Move documents that are ready for refresh
      const readyDocs: PendingDocument[] = [];
      const stillPending: PendingDocument[] = [];

      for (const pending of pendingDocs) {
        const refreshIntervalMs = this.refreshIntervals.get(index) || this.parseRefreshInterval(DEFAULT_REFRESH_INTERVAL);
        
        // If refresh is disabled (-1), documents are immediately available
        if (refreshIntervalMs === -1 || (now - pending.indexedAt) >= refreshIntervalMs) {
          readyDocs.push(pending);
        } else {
          stillPending.push(pending);
        }
      }

      // Move ready documents to searchable
      for (const pending of readyDocs) {
        const existingIndex = shardDocs.findIndex(d => d._id === pending.doc._id);
        if (existingIndex >= 0) {
          shardDocs[existingIndex] = pending.doc;
        } else {
          shardDocs.push(pending.doc);
        }
        refreshed++;
      }

      docMap.set(shardNum, shardDocs);
      pendingMap.set(shardNum, stillPending);
      totalRefreshed += refreshed;
    }

    if (totalRefreshed > 0) {
      this.lastRefresh.set(index, now);
      this.refreshOperations.push({
        timestamp: now,
        index,
        docsRefreshed: totalRefreshed,
      });
      
      // Keep last MAX_OPERATION_HISTORY refresh operations
      if (this.refreshOperations.length > MAX_OPERATION_HISTORY) {
        this.refreshOperations = this.refreshOperations.slice(-MAX_OPERATION_HISTORY);
      }

      // Update index metrics
      const indexData = this.indices.get(index);
      if (indexData) {
        indexData.docs = this.getTotalDocsForIndex(index);
        indexData.size = this.getTotalSizeForIndex(index);
      }
    }

    return totalRefreshed;
  }

  /**
   * Check and refresh all indices if needed
   */
  private checkAndRefreshIndices(): void {
    const now = Date.now();
    for (const indexName of this.indices.keys()) {
      const refreshIntervalMs = this.refreshIntervals.get(indexName);
      if (!refreshIntervalMs || refreshIntervalMs === -1) {
        // Refresh disabled or not set - refresh immediately
        this.refreshIndex(indexName);
        continue;
      }

      const lastRefreshTime = this.lastRefresh.get(indexName) || 0;
      if (now - lastRefreshTime >= refreshIntervalMs) {
        this.refreshIndex(indexName);
      }
    }
  }

  /**
   * Index a document
   */
  public indexDocument(index: string, id: string, document: any, routing?: string): ElasticsearchOperation {
    const startTime = Date.now();
    
    const indexData = this.indices.get(index);
    if (!indexData) {
      return {
        operation: 'index',
        index,
        id,
        document,
        routing,
        latency: Date.now() - startTime,
        success: false,
        error: `Index ${index} does not exist`,
      };
    }

    // Route to shard
    const routingKey = routing || id;
    const shardNum = this.routeToShard(index, routingKey);

    // Get or increment version
    const versionMap = this.documentVersions.get(index) || new Map();
    const seqNoMap = this.documentSeqNos.get(index) || new Map();
    const primaryTermMap = this.documentPrimaryTerms.get(index) || new Map();
    
    const existingVersion = versionMap.get(id);
    const newVersion = existingVersion !== undefined ? existingVersion + 1 : 1;
    const newSeqNo = this.globalSeqNo++;
    const primaryTerm = 1; // Simplified - in real ES this is per-primary-shard
    
    versionMap.set(id, newVersion);
    seqNoMap.set(id, newSeqNo);
    primaryTermMap.set(id, primaryTerm);
    
    this.documentVersions.set(index, versionMap);
    this.documentSeqNos.set(index, seqNoMap);
    this.documentPrimaryTerms.set(index, primaryTermMap);

    // Create document
    const doc: Document = {
      _id: id,
      _index: index,
      _source: document,
      _routing: routing,
      _version: newVersion,
      _seq_no: newSeqNo,
      _primary_term: primaryTerm,
    };

    // Check refresh interval - if disabled (-1), add directly to documents
    const refreshIntervalMs = this.refreshIntervals.get(index) || this.parseRefreshInterval(this.refreshInterval);
    
    if (refreshIntervalMs === -1) {
      // Refresh disabled - add directly to searchable documents
      const docMap = this.documents.get(index)!;
      const shardDocs = docMap.get(shardNum) || [];
      
      // Check if document already exists (update)
      const existingIndex = shardDocs.findIndex(d => d._id === id);
      if (existingIndex >= 0) {
        shardDocs[existingIndex] = doc;
      } else {
        shardDocs.push(doc);
      }
      
      docMap.set(shardNum, shardDocs);
      this.documents.set(index, docMap);
    } else {
      // Add to pending documents (will be refreshed later)
      const pendingMap = this.pendingDocuments.get(index)!;
      const pendingShardDocs = pendingMap.get(shardNum) || [];
      
      // Check if document already exists in pending (update)
      const existingPendingIndex = pendingShardDocs.findIndex(p => p.doc._id === id);
      if (existingPendingIndex >= 0) {
        pendingShardDocs[existingPendingIndex] = {
          doc,
          indexedAt: Date.now(),
        };
      } else {
        pendingShardDocs.push({
          doc,
          indexedAt: Date.now(),
        });
      }
      
      pendingMap.set(shardNum, pendingShardDocs);
      this.pendingDocuments.set(index, pendingMap);
    }

    // Update index metrics
    indexData.docs = this.getTotalDocsForIndex(index);
    indexData.size = this.getTotalSizeForIndex(index);
    indexData.health = this.calculateIndexHealth(index);

    // Update shard metrics
    const shardList = this.shards.get(index)!;
    for (const shard of shardList) {
      if (shard.index === index && shard.shard === shardNum && shard.primary) {
        shard.docs = shardDocs.length;
        shard.size = shardDocs.length * ESTIMATED_DOCUMENT_SIZE_BYTES;
      }
    }

    const latency = this.calculateIndexLatency();
    this.recordIndexOperation(latency, true);
    this.updateMetrics();

    return {
      operation: 'index',
      index,
      id,
      document,
      routing,
      latency,
      success: true,
      took: latency,
    };
  }

  /**
   * Get a document by ID with optional source filtering
   */
  public getDocument(index: string, id: string, routing?: string, sourceFilter?: string[] | boolean): ElasticsearchOperation {
    const startTime = Date.now();
    
    const indexData = this.indices.get(index);
    if (!indexData) {
      return {
        operation: 'get',
        index,
        id,
        routing,
        latency: Date.now() - startTime,
        success: false,
        error: `Index ${index} does not exist`,
      };
    }

    // Route to shard
    const routingKey = routing || id;
    const shardNum = this.routeToShard(index, routingKey);

    // Find document in shard
    const docMap = this.documents.get(index)!;
    const shardDocs = docMap.get(shardNum) || [];
    const doc = shardDocs.find(d => d._id === id);

    const latency = this.calculateGetLatency();
    const docFound = !!doc;
    this.recordGetOperation(latency, docFound);
    this.updateMetrics();

    if (!doc) {
      return {
        operation: 'get',
        index,
        id,
        routing,
        latency,
        success: false,
        error: `Document ${id} not found`,
        took: latency,
      };
    }

    // Apply source filtering
    let source = doc._source;
    if (sourceFilter !== undefined) {
      if (sourceFilter === false) {
        source = {};
      } else if (Array.isArray(sourceFilter)) {
        const filtered: Record<string, any> = {};
        for (const field of sourceFilter) {
          const value = this.getNestedField(source, field);
          if (value !== undefined) {
            this.setNestedField(filtered, field, value);
          }
        }
        source = filtered;
      }
    }

    return {
      operation: 'get',
      index,
      id,
      document: source,
      routing,
      latency,
      success: true,
      took: latency,
      version: doc._version,
      _source: source,
    };
  }

  /**
   * Update a document (partial update)
   * POST /{index}/_update/{id}
   */
  public updateDocument(
    index: string,
    id: string,
    updateDoc: any,
    routing?: string,
    ifSeqNo?: number,
    ifPrimaryTerm?: number
  ): ElasticsearchOperation {
    const startTime = Date.now();
    
    const indexData = this.indices.get(index);
    if (!indexData) {
      return {
        operation: 'update',
        index,
        id,
        latency: Date.now() - startTime,
        success: false,
        error: `Index ${index} does not exist`,
      };
    }

    // Route to shard
    const routingKey = routing || id;
    const shardNum = this.routeToShard(index, routingKey);

    // Find existing document
    const docMap = this.documents.get(index)!;
    const shardDocs = docMap.get(shardNum) || [];
    const existingDoc = shardDocs.find(d => d._id === id);

    if (!existingDoc) {
      // If doc doesn't exist and upsert is provided, create it
      if (updateDoc.upsert) {
        return this.indexDocument(index, id, updateDoc.upsert, routing);
      }
      return {
        operation: 'update',
        index,
        id,
        latency: Date.now() - startTime,
        success: false,
        error: `Document ${id} not found`,
      };
    }

    // Check optimistic concurrency control
    const seqNoMap = this.documentSeqNos.get(index) || new Map();
    const primaryTermMap = this.documentPrimaryTerms.get(index) || new Map();
    const currentSeqNo = seqNoMap.get(id);
    const currentPrimaryTerm = primaryTermMap.get(id);

    if (ifSeqNo !== undefined && currentSeqNo !== ifSeqNo) {
      return {
        operation: 'update',
        index,
        id,
        latency: Date.now() - startTime,
        success: false,
        error: `[version_conflict_engine_exception] [${id}]: version conflict, required seqNo [${ifSeqNo}], current seqNo [${currentSeqNo}]`,
      };
    }

    if (ifPrimaryTerm !== undefined && currentPrimaryTerm !== ifPrimaryTerm) {
      return {
        operation: 'update',
        index,
        id,
        latency: Date.now() - startTime,
        success: false,
        error: `[version_conflict_engine_exception] [${id}]: version conflict, required primaryTerm [${ifPrimaryTerm}], current primaryTerm [${currentPrimaryTerm}]`,
      };
    }

    // Merge update with existing document
    const doc = updateDoc.doc || updateDoc;
    const updatedSource = {
      ...existingDoc._source,
      ...doc,
    };

    // Update document
    const versionMap = this.documentVersions.get(index) || new Map();
    const newVersion = (versionMap.get(id) || 0) + 1;
    const newSeqNo = this.globalSeqNo++;
    const primaryTerm = primaryTermMap.get(id) || 1;

    versionMap.set(id, newVersion);
    seqNoMap.set(id, newSeqNo);
    primaryTermMap.set(id, primaryTerm);

    this.documentVersions.set(index, versionMap);
    this.documentSeqNos.set(index, seqNoMap);
    this.documentPrimaryTerms.set(index, primaryTermMap);

    const updatedDoc: Document = {
      ...existingDoc,
      _source: updatedSource,
      _version: newVersion,
      _seq_no: newSeqNo,
      _primary_term: primaryTerm,
    };

    const docIndex = shardDocs.findIndex(d => d._id === id);
    if (docIndex >= 0) {
      shardDocs[docIndex] = updatedDoc;
    } else {
      shardDocs.push(updatedDoc);
    }
    docMap.set(shardNum, shardDocs);
    this.documents.set(index, docMap);

    // Update index metrics
    indexData.docs = this.getTotalDocsForIndex(index);
    indexData.size = this.getTotalSizeForIndex(index);
    indexData.health = this.calculateIndexHealth(index);

    const latency = this.calculateIndexLatency();
    this.recordUpdateOperation(latency, true);
    this.updateMetrics();

    return {
      operation: 'update',
      index,
      id,
      document: updatedSource,
      routing,
      latency,
      success: true,
      took: latency,
      version: newVersion,
    };
  }

  /**
   * Get nested field value from object
   */
  private getNestedField(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }
    return current;
  }

  /**
   * Set nested field value in object
   */
  private setNestedField(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    current[parts[parts.length - 1]] = value;
  }

  /**
   * Search documents
   */
  public search(index: string, query: any): ElasticsearchOperation {
    const startTime = Date.now();
    
    const indexData = this.indices.get(index);
    if (!indexData) {
      return {
        operation: 'search',
        index,
        query,
        latency: Date.now() - startTime,
        success: false,
        error: `Index ${index} does not exist`,
      };
    }

    // Check and refresh index if needed before search
    this.checkAndRefreshIndices();

    // Search across all shards (only searchable documents, not pending)
    const docMap = this.documents.get(index)!;
    let allDocs: Document[] = [];
    
    for (let shardNum = 0; shardNum < indexData.shards; shardNum++) {
      const shardDocs = docMap.get(shardNum) || [];
      allDocs = allDocs.concat(shardDocs);
    }

    // Parse and execute query using queryParser
    let matchingDocs = parseAndExecuteQuery(query, allDocs);

    // Apply size limit
    const size = query?.size || 10;
    matchingDocs = matchingDocs.slice(0, size);

    const latency = this.calculateSearchLatency(indexData.shards, matchingDocs.length, query);
    this.recordSearchOperation(latency, matchingDocs.length, true);
    this.updateMetrics();

    // Store query in recent queries
    const operation: ElasticsearchOperation = {
      operation: 'search',
      index,
      query,
      latency,
      success: true,
      hits: matchingDocs.length,
      took: latency,
    };
    this.recentQueries.unshift(operation);
    if (this.recentQueries.length > MAX_RECENT_QUERIES) {
      this.recentQueries = this.recentQueries.slice(0, MAX_RECENT_QUERIES);
    }

    return operation;
  }

  /**
   * Delete a document
   */
  public deleteDocument(index: string, id: string, routing?: string): ElasticsearchOperation {
    const startTime = Date.now();
    
    const indexData = this.indices.get(index);
    if (!indexData) {
      return {
        operation: 'delete',
        index,
        id,
        routing,
        latency: Date.now() - startTime,
        success: false,
        error: `Index ${index} does not exist`,
      };
    }

    // Route to shard
    const routingKey = routing || id;
    const shardNum = this.routeToShard(index, routingKey);

    // Remove document from shard
    const docMap = this.documents.get(index)!;
    const shardDocs = docMap.get(shardNum) || [];
    const initialLength = shardDocs.length;
    const filteredDocs = shardDocs.filter(d => d._id !== id);
    docMap.set(shardNum, filteredDocs);
    this.documents.set(index, docMap);

    // Remove version tracking
    const versionMap = this.documentVersions.get(index);
    const seqNoMap = this.documentSeqNos.get(index);
    const primaryTermMap = this.documentPrimaryTerms.get(index);
    if (versionMap) versionMap.delete(id);
    if (seqNoMap) seqNoMap.delete(id);
    if (primaryTermMap) primaryTermMap.delete(id);

    // Update index metrics
    indexData.docs = this.getTotalDocsForIndex(index);
    indexData.size = this.getTotalSizeForIndex(index);
    indexData.health = this.calculateIndexHealth(index);

    // Update shard metrics
    const shardList = this.shards.get(index)!;
    for (const shard of shardList) {
      if (shard.index === index && shard.shard === shardNum && shard.primary) {
        shard.docs = filteredDocs.length;
        shard.size = filteredDocs.length * ESTIMATED_DOCUMENT_SIZE_BYTES;
      }
    }

    const latency = this.calculateIndexLatency();
    const deleted = filteredDocs.length !== initialLength;
    this.recordDeleteOperation(latency, deleted);
    this.updateMetrics();

    if (filteredDocs.length === initialLength) {
      return {
        operation: 'delete',
        index,
        id,
        routing,
        latency,
        success: false,
        error: `Document ${id} not found`,
        took: latency,
      };
    }

    return {
      operation: 'delete',
      index,
      id,
      routing,
      latency,
      success: true,
      took: latency,
    };
  }

  /**
   * Bulk operations - process multiple operations in a single request
   * Supports NDJSON format (newline-delimited JSON)
   * 
   * Format:
   * { "index": { "_index": "test", "_id": "1" } }
   * { "field": "value" }
   * { "delete": { "_index": "test", "_id": "2" } }
   * { "create": { "_index": "test", "_id": "3" } }
   * { "field": "value2" }
   * { "update": { "_index": "test", "_id": "4" } }
   * { "doc": { "field": "updated" } }
   */
  public bulk(bulkBody: string): ElasticsearchOperation {
    const startTime = Date.now();
    
    try {
      // Parse NDJSON format (newline-delimited JSON)
      const lines = bulkBody.split('\n').filter(line => line.trim().length > 0);
      if (lines.length === 0) {
        return {
          operation: 'bulk',
          latency: Date.now() - startTime,
          success: false,
          error: 'Empty bulk request',
        };
      }

      const results: Array<{ operation: string; index?: string; id?: string; success: boolean; error?: string }> = [];
      let itemsProcessed = 0;
      let errors = 0;

      // Process operations in pairs (action line + optional source line)
      for (let i = 0; i < lines.length; i++) {
        try {
          const actionLine = JSON.parse(lines[i]);
          const actionType = Object.keys(actionLine)[0]; // 'index', 'create', 'update', 'delete'
          const actionParams = actionLine[actionType];
          
          const index = actionParams?._index || actionParams?.index || DEFAULT_INDEX_NAME;
          const id = actionParams?._id || actionParams?.id;
          const routing = actionParams?._routing || actionParams?.routing;

          let result: ElasticsearchOperation;
          let success = false;

          switch (actionType) {
            case 'index':
            case 'create': {
              // Next line should be the document source
              if (i + 1 < lines.length) {
                i++;
                const document = JSON.parse(lines[i]);
                result = this.indexDocument(index, id || `bulk-${Date.now()}-${itemsProcessed}`, document, routing);
                success = result.success || false;
              } else {
                result = {
                  operation: actionType,
                  index,
                  id,
                  latency: 0,
                  success: false,
                  error: 'Missing document source for index/create operation',
                };
              }
              break;
            }

            case 'update': {
              // Next line should be the update document or script
              if (i + 1 < lines.length) {
                i++;
                const updateDoc = JSON.parse(lines[i]);
                const doc = updateDoc.doc || updateDoc;
                // For update, we'll do an index operation (upsert behavior)
                result = this.indexDocument(index, id || `bulk-${Date.now()}-${itemsProcessed}`, doc, routing);
                success = result.success || false;
              } else {
                result = {
                  operation: 'update',
                  index,
                  id,
                  latency: 0,
                  success: false,
                  error: 'Missing update document for update operation',
                };
              }
              break;
            }

            case 'delete': {
              if (!id) {
                result = {
                  operation: 'delete',
                  index,
                  id,
                  latency: 0,
                  success: false,
                  error: 'Delete operation requires id',
                };
              } else {
                result = this.deleteDocument(index, id, routing);
                success = result.success || false;
              }
              break;
            }

            default:
              result = {
                operation: actionType,
                index,
                id,
                latency: 0,
                success: false,
                error: `Unsupported bulk operation: ${actionType}`,
              };
          }

          results.push({
            operation: actionType,
            index: result.index,
            id: result.id,
            success,
            error: result.error,
          });

          itemsProcessed++;
          if (!success) {
            errors++;
          }
        } catch (parseError) {
          errors++;
          results.push({
            operation: 'unknown',
            success: false,
            error: parseError instanceof Error ? parseError.message : 'Failed to parse bulk operation',
          });
        }
      }

      // Calculate bulk latency (optimized for batch processing)
      const clusterLoad = calculateClusterLoad(Array.from(this.nodes.values()).map(n => n.load));
      const baseLatency = BASE_INDEX_LATENCY_MS;
      const perItemLatency = 1; // Reduced latency per item in bulk
      const latency = Math.max(
        baseLatency,
        baseLatency + (itemsProcessed * perItemLatency) + (clusterLoad * 10)
      );

      // Record bulk operation
      this.recordBulkOperation(latency, itemsProcessed, errors);
      this.updateMetrics();

      const bulkResult: ElasticsearchOperation = {
        operation: OPERATION_BULK,
        latency,
        success: errors === 0,
        took: latency,
        hits: itemsProcessed,
        error: errors > 0 ? `${errors} of ${itemsProcessed} operations failed` : undefined,
      };

      // Store in recent queries
      this.recentQueries.unshift(bulkResult);
      if (this.recentQueries.length > MAX_RECENT_QUERIES) {
        this.recentQueries = this.recentQueries.slice(0, MAX_RECENT_QUERIES);
      }

      return bulkResult;
    } catch (error) {
      return {
        operation: 'bulk',
        latency: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error parsing bulk request',
      };
    }
  }

  /**
   * Get cluster health
   * GET /_cluster/health
   */
  public getClusterHealth(): any {
    this.updateMetrics();
    const clusterHealth = this.calculateClusterHealth();
    
    // Count shards by state
    let activePrimaryShards = 0;
    let activeShards = 0;
    let relocatingShards = 0;
    let initializingShards = 0;
    let unassignedShards = 0;
    let delayedUnassignedShards = 0;
    
    for (const shardList of this.shards.values()) {
      for (const shard of shardList) {
        if (shard.primary) {
          switch (shard.state) {
            case 'STARTED':
              activePrimaryShards++;
              activeShards++;
              break;
            case 'RELOCATING':
              relocatingShards++;
              break;
            case 'INITIALIZING':
              initializingShards++;
              break;
            case 'UNASSIGNED':
              unassignedShards++;
              break;
          }
        } else {
          if (shard.state === 'STARTED') {
            activeShards++;
          }
        }
      }
    }
    
    const numberOfNodes = this.nodes.size;
    const numberOfDataNodes = Array.from(this.nodes.values()).filter(n => n.status === 'up').length;
    
    return {
      cluster_name: this.clusterName,
      status: clusterHealth,
      timed_out: false,
      number_of_nodes: numberOfNodes,
      number_of_data_nodes: numberOfDataNodes,
      active_primary_shards: activePrimaryShards,
      active_shards: activeShards,
      relocating_shards: relocatingShards,
      initializing_shards: initializingShards,
      unassigned_shards: unassignedShards,
      delayed_unassigned_shards: delayedUnassignedShards,
      number_of_pending_tasks: 0,
      number_of_in_flight_fetch: 0,
      task_max_waiting_in_queue_millis: 0,
      active_shards_percent_as_number: activeShards > 0 
        ? ((activeShards / (activeShards + unassignedShards)) * 100).toFixed(1)
        : '0.0',
    };
  }

  /**
   * Get cluster stats
   * GET /_cluster/stats
   */
  public getClusterStats(): any {
    this.updateMetrics();
    
    const nodes = Array.from(this.nodes.values());
    const healthyNodes = nodes.filter(n => n.status === 'up');
    
    // Calculate cluster-wide statistics
    let totalIndices = this.indices.size;
    let totalShards = 0;
    let totalDocs = 0;
    let totalSize = 0;
    
    for (const index of this.indices.values()) {
      totalDocs += index.docs;
      totalSize += index.size;
      const shardList = this.shards.get(index.name) || [];
      totalShards += shardList.length;
    }
    
    // Calculate node statistics
    const nodeStats = nodes.map(node => ({
      name: node.address,
      transport_address: node.address,
      host: node.address.split(':')[0],
      ip: node.address.split(':')[0],
      version: '8.0.0',
      roles: ['data', 'ingest', 'master'],
      attributes: {},
      jvm: {
        heap_used_percent: Math.round(node.load * 100),
        heap_max_in_bytes: 1073741824, // 1GB
        heap_used_in_bytes: Math.round(node.load * 1073741824),
      },
      process: {
        cpu: {
          percent: Math.round(node.load * 100),
        },
      },
    }));
    
    return {
      cluster_name: this.clusterName,
      cluster_uuid: 'simulated-cluster-uuid',
      timestamp: Date.now(),
      status: this.calculateClusterHealth(),
      indices: {
        count: totalIndices,
        shards: {
          total: totalShards,
          primaries: totalShards / (this.defaultReplicas + 1),
          replication: this.defaultReplicas,
          index: {
            shards: {
              min: this.defaultShards,
              max: this.defaultShards,
              avg: this.defaultShards,
            },
          },
        },
        docs: {
          count: totalDocs,
          deleted: 0,
        },
        store: {
          size_in_bytes: totalSize,
          size: this.formatBytes(totalSize),
        },
      },
      nodes: {
        count: {
          total: nodes.length,
          data: healthyNodes.length,
          coordinating_only: 0,
          master: healthyNodes.length,
          ingest: healthyNodes.length,
        },
        versions: ['8.0.0'],
        os: {
          available_processors: 4,
          allocated_processors: 4,
          names: [{ name: 'Linux', count: nodes.length }],
        },
        jvm: {
          version: ['17.0.0'],
          memory: {
            heap_used_in_bytes: nodes.reduce((sum, n) => sum + Math.round(n.load * 1073741824), 0),
            heap_max_in_bytes: nodes.length * 1073741824,
          },
        },
        fs: {
          total_in_bytes: nodes.length * 107374182400, // 100GB per node
          free_in_bytes: nodes.reduce((sum, n) => sum + Math.round((1 - n.load) * 107374182400), 0),
          available_in_bytes: nodes.reduce((sum, n) => sum + Math.round((1 - n.load) * 107374182400), 0),
        },
      },
    };
  }

  /**
   * Get nodes information
   * GET /_nodes
   */
  public getNodes(nodeIds?: string[]): any {
    this.updateMetrics();
    
    const nodes = Array.from(this.nodes.values());
    const filteredNodes = nodeIds 
      ? nodes.filter(n => nodeIds.includes(n.address))
      : nodes;
    
    const nodesData: Record<string, any> = {};
    
    for (const node of filteredNodes) {
      const shardList = Array.from(this.shards.values()).flat();
      const nodeShards = shardList.filter(s => s.node === node.address);
      
      nodesData[node.address] = {
        name: node.address,
        transport_address: node.address,
        host: node.address.split(':')[0],
        ip: node.address.split(':')[0],
        version: '8.0.0',
        roles: ['data', 'ingest', 'master'],
        attributes: {},
        settings: {
          node: {
            name: node.address,
          },
        },
        os: {
          name: 'Linux',
          arch: 'amd64',
          available_processors: 4,
          allocated_processors: 4,
        },
        jvm: {
          version: '17.0.0',
          vm_name: 'OpenJDK 64-Bit Server VM',
          vm_version: '17.0.0',
          heap_used_percent: Math.round(node.load * 100),
          heap_max_in_bytes: 1073741824,
          heap_used_in_bytes: Math.round(node.load * 1073741824),
        },
        process: {
          id: Math.floor(Math.random() * 10000),
          refresh_interval_in_millis: 1000,
          cpu: {
            percent: Math.round(node.load * 100),
          },
        },
        thread_pool: {},
        fs: {
          total_in_bytes: 107374182400,
          free_in_bytes: Math.round((1 - node.load) * 107374182400),
          available_in_bytes: Math.round((1 - node.load) * 107374182400),
        },
        network: {},
        transport: {},
        http: {
          bound_address: [node.address],
          publish_address: node.address,
        },
        plugins: [],
        modules: [],
        ingest: {},
      };
    }
    
    return {
      _nodes: {
        total: filteredNodes.length,
        successful: filteredNodes.filter(n => n.status === 'up').length,
        failed: filteredNodes.filter(n => n.status === 'down').length,
      },
      cluster_name: this.clusterName,
      nodes: nodesData,
    };
  }

  /**
   * Get node stats
   * GET /_nodes/stats
   */
  public getNodeStats(nodeIds?: string[], metric?: string[]): any {
    this.updateMetrics();
    
    const nodes = Array.from(this.nodes.values());
    const filteredNodes = nodeIds 
      ? nodes.filter(n => nodeIds.includes(n.address))
      : nodes;
    
    const nodesData: Record<string, any> = {};
    
    for (const node of filteredNodes) {
      const shardList = Array.from(this.shards.values()).flat();
      const nodeShards = shardList.filter(s => s.node === node.address);
      const nodeIndices = new Set(nodeShards.map(s => s.index));
      
      // Calculate node-level statistics
      let nodeDocs = 0;
      let nodeSize = 0;
      for (const shard of nodeShards) {
        nodeDocs += shard.docs;
        nodeSize += shard.size;
      }
      
      const nodeData: any = {
        timestamp: Date.now(),
        name: node.address,
        transport_address: node.address,
        host: node.address.split(':')[0],
        ip: node.address.split(':')[0],
        roles: ['data', 'ingest', 'master'],
        indices: {
          docs: {
            count: nodeDocs,
            deleted: 0,
          },
          store: {
            size_in_bytes: nodeSize,
            size: this.formatBytes(nodeSize),
          },
          indexing: {
            index_total: this.indexOperations.length,
            index_time_in_millis: this.indexOperations.reduce((sum, op) => sum + op.latency, 0),
            index_current: 0,
            index_failed: 0,
            delete_total: 0,
            delete_time_in_millis: 0,
            delete_current: 0,
            noop_update_total: 0,
            is_throttled: false,
            throttle_time_in_millis: 0,
          },
          search: {
            query_total: this.searchOperations.length,
            query_time_in_millis: this.searchOperations.reduce((sum, op) => sum + op.latency, 0),
            query_current: 0,
            fetch_total: this.searchOperations.length,
            fetch_time_in_millis: this.searchOperations.reduce((sum, op) => sum + op.latency, 0),
            fetch_current: 0,
            scroll_total: 0,
            scroll_time_in_millis: 0,
            scroll_current: 0,
            suggest_total: 0,
            suggest_time_in_millis: 0,
            suggest_current: 0,
          },
          segments: {
            count: nodeIndices.size,
            memory_in_bytes: nodeSize * 0.1,
            terms_memory_in_bytes: nodeSize * 0.05,
            stored_fields_memory_in_bytes: nodeSize * 0.03,
            term_vectors_memory_in_bytes: 0,
            norms_memory_in_bytes: nodeSize * 0.01,
            points_memory_in_bytes: nodeSize * 0.01,
            doc_values_memory_in_bytes: nodeSize * 0.01,
            index_writer_memory_in_bytes: nodeSize * 0.01,
            version_map_memory_in_bytes: 0,
            fixed_bit_set_memory_in_bytes: 0,
          },
          translog: {
            operations: nodeDocs,
            size_in_bytes: nodeSize * 0.1,
            uncommitted_operations: 0,
            uncommitted_size_in_bytes: 0,
            earliest_last_modified_age: 0,
          },
          request_cache: {
            memory_size_in_bytes: 0,
            evictions: 0,
            hit_count: 0,
            miss_count: 0,
          },
          recovery: {
            current_as_source: 0,
            current_as_target: 0,
            throttle_time_in_millis: 0,
          },
        },
        jvm: {
          timestamp: Date.now(),
          uptime_in_millis: Date.now() - (this.lastMetricsUpdate || Date.now()),
          mem: {
            heap_used_in_bytes: Math.round(node.load * 1073741824),
            heap_used_percent: Math.round(node.load * 100),
            heap_committed_in_bytes: 1073741824,
            heap_max_in_bytes: 1073741824,
            non_heap_used_in_bytes: 100000000,
            non_heap_committed_in_bytes: 100000000,
            pools: {
              young: {
                used_in_bytes: Math.round(node.load * 268435456),
                max_in_bytes: 268435456,
                peak_used_in_bytes: Math.round(node.load * 268435456),
                peak_max_in_bytes: 268435456,
              },
              old: {
                used_in_bytes: Math.round(node.load * 805306368),
                max_in_bytes: 805306368,
                peak_used_in_bytes: Math.round(node.load * 805306368),
                peak_max_in_bytes: 805306368,
              },
            },
          },
          threads: {
            count: 50,
            peak_count: 50,
          },
          gc: {
            collectors: {
              young: {
                collection_count: 0,
                collection_time_in_millis: 0,
              },
              old: {
                collection_count: 0,
                collection_time_in_millis: 0,
              },
            },
          },
          buffer_pools: {},
        },
        process: {
          timestamp: Date.now(),
          open_file_descriptors: 100,
          max_file_descriptors: 65535,
          cpu: {
            percent: Math.round(node.load * 100),
            total_in_millis: Date.now(),
          },
          mem: {
            total_virtual_in_bytes: 2147483648,
          },
        },
        fs: {
          timestamp: Date.now(),
          total: {
            total_in_bytes: 107374182400,
            free_in_bytes: Math.round((1 - node.load) * 107374182400),
            available_in_bytes: Math.round((1 - node.load) * 107374182400),
          },
          data: [{
            path: '/data',
            mount: '/',
            type: 'ext4',
            total_in_bytes: 107374182400,
            free_in_bytes: Math.round((1 - node.load) * 107374182400),
            available_in_bytes: Math.round((1 - node.load) * 107374182400),
          }],
        },
        transport: {
          server_open: 10,
          rx_count: this.indexOperations.length + this.searchOperations.length,
          rx_size_in_bytes: this.metrics.totalSize,
          tx_count: this.indexOperations.length + this.searchOperations.length,
          tx_size_in_bytes: this.metrics.totalSize,
        },
        http: {
          current_open: 5,
          total_opened: 100,
        },
        breaker: {},
        script: {},
        discovery: {},
        ingest: {},
      };
      
      nodesData[node.address] = nodeData;
    }
    
    return {
      _nodes: {
        total: filteredNodes.length,
        successful: filteredNodes.filter(n => n.status === 'up').length,
        failed: filteredNodes.filter(n => n.status === 'down').length,
      },
      cluster_name: this.clusterName,
      nodes: nodesData,
    };
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0b';
    const k = 1024;
    const sizes = ['b', 'kb', 'mb', 'gb', 'tb'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + sizes[i];
  }

  /**
   * Create index via API
   * PUT /{index}
   */
  public createIndexViaAPI(indexName: string, body?: any): any {
    const startTime = Date.now();
    
    if (this.indices.has(indexName)) {
      return {
        error: {
          root_cause: [{
            type: 'resource_already_exists_exception',
            reason: `index [${indexName}/${this.indices.get(indexName)?.name}] already exists`,
          }],
          type: 'resource_already_exists_exception',
          reason: `index [${indexName}/${this.indices.get(indexName)?.name}] already exists`,
        },
        status: 400,
      };
    }
    
    const settings = body?.settings || {};
    const mappings = body?.mappings || {};
    const shards = settings?.index?.number_of_shards || this.defaultShards;
    const replicas = settings?.index?.number_of_replicas || this.defaultReplicas;
    const refreshInterval = settings?.index?.refresh_interval || this.refreshInterval;
    
    const indexConfig: Partial<Index> = {
      mappings,
      settings: {
        index: {
          number_of_shards: shards,
          number_of_replicas: replicas,
          refresh_interval: refreshInterval,
          ...settings.index,
        },
        ...settings,
      },
    };
    
    this.createIndex(indexName, shards, replicas, indexConfig);
    
    return {
      acknowledged: true,
      shards_acknowledged: true,
      index: indexName,
    };
  }

  /**
   * Get index information
   * GET /{index}
   */
  public getIndexInfo(indexName: string): any {
    const index = this.indices.get(indexName);
    if (!index) {
      return {
        error: {
          root_cause: [{
            type: 'index_not_found_exception',
            reason: `no such index [${indexName}]`,
          }],
          type: 'index_not_found_exception',
          reason: `no such index [${indexName}]`,
        },
        status: 404,
      };
    }
    
    const shardList = this.shards.get(indexName) || [];
    
    return {
      [indexName]: {
        aliases: {},
        mappings: index.mappings || {},
        settings: {
          index: {
            creation_date: Date.now(),
            number_of_shards: index.shards.toString(),
            number_of_replicas: index.replicas.toString(),
            uuid: `simulated-${indexName}-uuid`,
            version: {
              created: '8000099',
            },
            provided_name: indexName,
            refresh_interval: this.refreshIntervals.get(indexName) 
              ? `${this.refreshIntervals.get(indexName)! / 1000}s`
              : this.refreshInterval,
            ...index.settings?.index,
          },
          ...index.settings,
        },
        defaults: {},
      },
    };
  }

  /**
   * Delete index via API
   * DELETE /{index}
   */
  public deleteIndexViaAPI(indexName: string): any {
    if (!this.indices.has(indexName)) {
      return {
        error: {
          root_cause: [{
            type: 'index_not_found_exception',
            reason: `no such index [${indexName}]`,
          }],
          type: 'index_not_found_exception',
          reason: `no such index [${indexName}]`,
        },
        status: 404,
      };
    }
    
    this.indices.delete(indexName);
    this.shards.delete(indexName);
    this.documents.delete(indexName);
    this.pendingDocuments.delete(indexName);
    this.refreshIntervals.delete(indexName);
    this.lastRefresh.delete(indexName);
    
    this.updateMetrics();
    
    return {
      acknowledged: true,
    };
  }

  /**
   * Get indices list (cat API format)
   * GET /_cat/indices
   */
  public getIndicesList(format: 'json' | 'text' = 'json'): any {
    const indices = Array.from(this.indices.values());
    
    if (format === 'text') {
      // Return text format (tab-separated)
      const headers = 'health status index uuid pri rep docs.count store.size pri.store.size';
      const rows = indices.map(index => {
        const shardList = this.shards.get(index.name) || [];
        const primaryShards = shardList.filter(s => s.primary);
        const totalSize = index.size;
        const primarySize = primaryShards.reduce((sum, s) => sum + s.size, 0);
        
        return `${index.health} open ${index.name} simulated-${index.name}-uuid ${index.shards} ${index.replicas} ${index.docs} ${this.formatBytes(totalSize)} ${this.formatBytes(primarySize)}`;
      });
      
      return [headers, ...rows].join('\n');
    }
    
    // Return JSON format
    return indices.map(index => {
      const shardList = this.shards.get(index.name) || [];
      const primaryShards = shardList.filter(s => s.primary);
      const totalSize = index.size;
      const primarySize = primaryShards.reduce((sum, s) => sum + s.size, 0);
      
      return {
        health: index.health,
        status: 'open',
        index: index.name,
        uuid: `simulated-${index.name}-uuid`,
        pri: index.shards,
        rep: index.replicas,
        'docs.count': index.docs,
        'store.size': this.formatBytes(totalSize),
        'pri.store.size': this.formatBytes(primarySize),
      };
    });
  }

  /**
   * Get index mapping
   * GET /{index}/_mapping
   */
  public getIndexMapping(indexName?: string): any {
    if (indexName) {
      const index = this.indices.get(indexName);
      if (!index) {
        return {
          error: {
            root_cause: [{
              type: 'index_not_found_exception',
              reason: `no such index [${indexName}]`,
            }],
            type: 'index_not_found_exception',
            reason: `no such index [${indexName}]`,
          },
          status: 404,
        };
      }
      
      return {
        [indexName]: {
          mappings: index.mappings || {},
        },
      };
    }
    
    // Return all indices mappings
    const result: Record<string, any> = {};
    for (const index of this.indices.values()) {
      result[index.name] = {
        mappings: index.mappings || {},
      };
    }
    
    return result;
  }

  /**
   * Update index mapping
   * PUT /{index}/_mapping
   */
  public updateIndexMapping(indexName: string, body: any): any {
    const index = this.indices.get(indexName);
    if (!index) {
      return {
        error: {
          root_cause: [{
            type: 'index_not_found_exception',
            reason: `no such index [${indexName}]`,
          }],
          type: 'index_not_found_exception',
          reason: `no such index [${indexName}]`,
        },
        status: 404,
      };
    }
    
    // Merge new mappings with existing
    const newMappings = body?.mappings || body || {};
    index.mappings = {
      ...index.mappings,
      ...newMappings,
      properties: {
        ...(index.mappings?.properties || {}),
        ...(newMappings.properties || {}),
      },
    };
    
    this.indices.set(indexName, index);
    
    return {
      acknowledged: true,
    };
  }

  /**
   * Get index settings
   * GET /{index}/_settings
   */
  public getIndexSettings(indexName?: string): any {
    if (indexName) {
      const index = this.indices.get(indexName);
      if (!index) {
        return {
          error: {
            root_cause: [{
              type: 'index_not_found_exception',
              reason: `no such index [${indexName}]`,
            }],
            type: 'index_not_found_exception',
            reason: `no such index [${indexName}]`,
          },
          status: 404,
        };
      }
      
      const refreshIntervalMs = this.refreshIntervals.get(indexName);
      
      return {
        [indexName]: {
          settings: {
            index: {
              creation_date: Date.now().toString(),
              number_of_shards: index.shards.toString(),
              number_of_replicas: index.replicas.toString(),
              uuid: `simulated-${indexName}-uuid`,
              version: {
                created: '8000099',
              },
              provided_name: indexName,
              refresh_interval: refreshIntervalMs 
                ? `${refreshIntervalMs / 1000}s`
                : this.refreshInterval,
              ...index.settings?.index,
            },
            ...index.settings,
          },
        },
      };
    }
    
    // Return all indices settings
    const result: Record<string, any> = {};
    for (const index of this.indices.values()) {
      const refreshIntervalMs = this.refreshIntervals.get(index.name);
      
      result[index.name] = {
        settings: {
          index: {
            creation_date: Date.now().toString(),
            number_of_shards: index.shards.toString(),
            number_of_replicas: index.replicas.toString(),
            uuid: `simulated-${index.name}-uuid`,
            version: {
              created: '8000099',
            },
            provided_name: index.name,
            refresh_interval: refreshIntervalMs 
              ? `${refreshIntervalMs / 1000}s`
              : this.refreshInterval,
            ...index.settings?.index,
          },
          ...index.settings,
        },
      };
    }
    
    return result;
  }

  /**
   * Execute Elasticsearch query (supports various API formats)
   * Supports Cluster API, Index Management API, Document API, and Search API
   */
  public executeQuery(queryString: string): ElasticsearchOperation | any {
    const startTime = Date.now();
    
    try {
      // Try to parse as Elasticsearch API call (HTTP method + path format)
      const lines = queryString.split('\n').filter(l => l.trim().length > 0);
      if (lines.length > 0) {
        const methodMatch = lines[0].match(/^(GET|POST|PUT|DELETE)\s+(.+)/);
        if (methodMatch) {
          const method = methodMatch[1];
          const path = methodMatch[2].trim().split('?')[0]; // Remove query params
          const body = lines.length > 1 ? lines.slice(1).join('\n') : '';
          
          // Cluster API
          if (method === 'GET' && path === '/_cluster/health') {
            return this.getClusterHealth();
          }
          if (method === 'GET' && path === '/_cluster/stats') {
            return this.getClusterStats();
          }
          if (method === 'GET' && path === '/_nodes') {
            const nodeIds = path.includes('?') ? path.split('?')[1].split('&').map(p => p.split('=')[1]) : undefined;
            return this.getNodes(nodeIds);
          }
          if (method === 'GET' && path === '/_nodes/stats') {
            const nodeIds = path.includes('?') ? path.split('?')[1].split('&').map(p => p.split('=')[1]) : undefined;
            return this.getNodeStats(nodeIds);
          }

          // Index Management API
          if (method === 'PUT' && path.match(/^\/[^\/]+$/) && !path.includes('_')) {
            const indexName = path.substring(1);
            const bodyObj = body ? JSON.parse(body) : {};
            return this.createIndexViaAPI(indexName, bodyObj);
          }
          if (method === 'GET' && path.match(/^\/[^\/]+$/) && !path.includes('_')) {
            const indexName = path.substring(1);
            return this.getIndexInfo(indexName);
          }
          if (method === 'DELETE' && path.match(/^\/[^\/]+$/) && !path.includes('_')) {
            const indexName = path.substring(1);
            return this.deleteIndexViaAPI(indexName);
          }
          if (method === 'GET' && path === '/_cat/indices') {
            const format = path.includes('format=json') ? 'json' : 'text';
            return this.getIndicesList(format);
          }
          if (method === 'GET' && path.match(/^\/[^\/]+\/_mapping$/)) {
            const indexName = path.match(/^\/([^\/]+)\/_mapping$/)?.[1];
            return this.getIndexMapping(indexName);
          }
          if (method === 'PUT' && path.match(/^\/[^\/]+\/_mapping$/)) {
            const indexName = path.match(/^\/([^\/]+)\/_mapping$/)?.[1];
            const bodyObj = body ? JSON.parse(body) : {};
            return this.updateIndexMapping(indexName || '', bodyObj);
          }
          if (method === 'GET' && path.match(/^\/[^\/]+\/_settings$/)) {
            const indexName = path.match(/^\/([^\/]+)\/_settings$/)?.[1];
            return this.getIndexSettings(indexName);
          }

          // Document API
          if (method === 'GET' && path.match(/\/[^\/]+\/_doc\/[^\/]+/)) {
            const match = path.match(/\/([^\/]+)\/_doc\/([^\/]+)/);
            if (match) {
              const sourceFilter = path.includes('_source=') 
                ? path.split('_source=')[1].split('&')[0].split(',')
                : undefined;
              return this.getDocument(match[1], match[2], undefined, sourceFilter);
            }
          }
          if (method === 'POST' && path.match(/\/[^\/]+\/_update\/[^\/]+/)) {
            const match = path.match(/\/([^\/]+)\/_update\/([^\/]+)/);
            if (match && body) {
              const bodyObj = JSON.parse(body);
              const ifSeqNo = path.includes('if_seq_no=') 
                ? parseInt(path.split('if_seq_no=')[1].split('&')[0])
                : undefined;
              const ifPrimaryTerm = path.includes('if_primary_term=') 
                ? parseInt(path.split('if_primary_term=')[1].split('&')[0])
                : undefined;
              return this.updateDocument(match[1], match[2], bodyObj, undefined, ifSeqNo, ifPrimaryTerm);
            }
          }
          if (method === 'GET' && path.includes('/_search')) {
            const query = body ? JSON.parse(body) : { query: { match_all: {} } };
            const indexMatch = path.match(/^\/([^\/]+)\/_search/);
            const index = indexMatch ? indexMatch[1] : '_all';
            return this.search(index, query);
          }
        }
      }

      // Try to parse as JSON (Elasticsearch DSL)
      try {
        const query = JSON.parse(queryString);
        
        // Default to search if query object provided
        if (query.query || query.match_all) {
          return this.search('_all', query);
        }
      } catch {
        // Not JSON, continue
      }

      return {
        operation: 'search',
        query: queryString,
        latency: Date.now() - startTime,
        success: false,
        error: 'Unsupported query format',
      };
    } catch (error) {
      return {
        operation: 'search',
        query: queryString,
        latency: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get metrics
   */
  public getMetrics(): ElasticsearchMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get indices
   */
  public getIndices(): Index[] {
    return Array.from(this.indices.values());
  }

  /**
   * Get shards for an index
   */
  public getShards(index: string): Shard[] {
    return this.shards.get(index) || [];
  }

  /**
   * Get recent queries
   */
  public getRecentQueries(limit: number = 10): ElasticsearchOperation[] {
    return this.recentQueries.slice(0, limit);
  }

  /**
   * Get operation history
   * Returns all operations with their details
   */
  public getOperationHistory(limit: number = 100): Array<{
    timestamp: number;
    operation: 'index' | 'get' | 'search' | 'delete' | 'bulk' | 'update';
    index?: string;
    id?: string;
    latency: number;
    success: boolean;
    hits?: number;
    items?: number;
    errors?: number;
  }> {
    const history: Array<{
      timestamp: number;
      operation: 'index' | 'get' | 'search' | 'delete' | 'bulk' | 'update';
      index?: string;
      id?: string;
      latency: number;
      success: boolean;
      hits?: number;
      items?: number;
      errors?: number;
    }> = [];

    // Add index operations
    this.indexOperations.forEach(op => {
      history.push({
        timestamp: op.timestamp,
        operation: 'index',
        latency: op.latency,
        success: op.success,
      });
    });

    // Add search operations
    this.searchOperations.forEach(op => {
      history.push({
        timestamp: op.timestamp,
        operation: 'search',
        latency: op.latency,
        success: op.success,
        hits: op.hits,
      });
    });

    // Add get operations
    this.getOperations.forEach(op => {
      history.push({
        timestamp: op.timestamp,
        operation: 'get',
        latency: op.latency,
        success: op.success,
      });
    });

    // Add delete operations
    this.deleteOperations.forEach(op => {
      history.push({
        timestamp: op.timestamp,
        operation: 'delete',
        latency: op.latency,
        success: op.success,
      });
    });

    // Add update operations
    this.updateOperations.forEach(op => {
      history.push({
        timestamp: op.timestamp,
        operation: 'update',
        latency: op.latency,
        success: op.success,
      });
    });

    // Add bulk operations
    this.bulkOperations.forEach(op => {
      history.push({
        timestamp: op.timestamp,
        operation: 'bulk',
        latency: op.latency,
        success: op.errors === 0,
        items: op.items,
        errors: op.errors,
      });
    });

    // Sort by timestamp (newest first) and limit
    return history
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Calculate index health
   */
  private calculateIndexHealth(index: string): ClusterHealth {
    const shardList = this.shards.get(index) || [];
    const unassigned = shardList.filter(s => s.state === 'UNASSIGNED').length;
    const initializing = shardList.filter(s => s.state === 'INITIALIZING').length;
    const relocating = shardList.filter(s => s.state === 'RELOCATING').length;

    if (unassigned > 0) return 'red';
    if (initializing > 0 || relocating > 0) return 'yellow';
    return 'green';
  }

  /**
   * Calculate cluster health
   */
  private calculateClusterHealth(): ClusterHealth {
    let hasRed = false;
    let hasYellow = false;

    for (const index of this.indices.values()) {
      if (index.health === 'red') {
        hasRed = true;
      } else if (index.health === 'yellow') {
        hasYellow = true;
      }
    }

    // Check node health
    const healthyNodes = Array.from(this.nodes.values()).filter(n => n.status === 'up').length;
    const totalNodes = this.nodes.size;
    
    if (healthyNodes === 0 || hasRed) return 'red';
    if (healthyNodes < totalNodes || hasYellow) return 'yellow';
    return 'green';
  }

  /**
   * Get total documents for an index
   */
  private getTotalDocsForIndex(index: string): number {
    const docMap = this.documents.get(index);
    if (!docMap) return 0;
    
    let total = 0;
    for (const docs of docMap.values()) {
      total += docs.length;
    }
    return total;
  }

  /**
   * Get total size for an index
   */
  private getTotalSizeForIndex(index: string): number {
    const docMap = this.documents.get(index);
    if (!docMap) return 0;
    
    let total = 0;
    for (const docs of docMap.values()) {
      total += docs.length * ESTIMATED_DOCUMENT_SIZE_BYTES;
    }
    return total;
  }

  /**
   * Calculate index latency
   */
  private calculateIndexLatency(): number {
    const clusterLoad = calculateClusterLoad(Array.from(this.nodes.values()).map(n => n.load));
    return calculateIndexLatency({
      documentCount: this.metrics.totalDocs,
      clusterLoad,
      indexSize: this.metrics.totalSize,
    });
  }

  /**
   * Calculate search latency
   */
  private calculateSearchLatency(shardCount: number, resultCount: number, query?: any): number {
    const clusterLoad = calculateClusterLoad(Array.from(this.nodes.values()).map(n => n.load));
    const queryComplexity = query ? calculateQueryComplexity(query) : 1;
    
    return calculateSearchLatency({
      shardCount,
      resultCount,
      queryComplexity,
      clusterLoad,
    });
  }

  /**
   * Calculate get latency
   */
  private calculateGetLatency(): number {
    const clusterLoad = calculateClusterLoad(Array.from(this.nodes.values()).map(n => n.load));
    return calculateGetLatency({
      clusterLoad,
    });
  }

  /**
   * Record index operation
   */
  private recordIndexOperation(latency: number, success: boolean = true): void {
    this.indexOperations.push({ timestamp: Date.now(), latency, success });
    // Keep last MAX_OPERATION_HISTORY operations
    if (this.indexOperations.length > MAX_OPERATION_HISTORY) {
      this.indexOperations = this.indexOperations.slice(-MAX_OPERATION_HISTORY);
    }
  }

  /**
   * Record search operation
   */
  private recordSearchOperation(latency: number, hits: number, success: boolean = true): void {
    this.searchOperations.push({ timestamp: Date.now(), latency, hits, success });
    // Keep last MAX_OPERATION_HISTORY operations
    if (this.searchOperations.length > MAX_OPERATION_HISTORY) {
      this.searchOperations = this.searchOperations.slice(-MAX_OPERATION_HISTORY);
    }
  }

  /**
   * Record get operation
   */
  private recordGetOperation(latency: number, success: boolean = true): void {
    this.getOperations.push({ timestamp: Date.now(), latency, success });
    // Keep last MAX_OPERATION_HISTORY operations
    if (this.getOperations.length > MAX_OPERATION_HISTORY) {
      this.getOperations = this.getOperations.slice(-MAX_OPERATION_HISTORY);
    }
  }

  /**
   * Record delete operation
   */
  private recordDeleteOperation(latency: number, success: boolean = true): void {
    this.deleteOperations.push({ timestamp: Date.now(), latency, success });
    // Keep last MAX_OPERATION_HISTORY operations
    if (this.deleteOperations.length > MAX_OPERATION_HISTORY) {
      this.deleteOperations = this.deleteOperations.slice(-MAX_OPERATION_HISTORY);
    }
  }

  /**
   * Record update operation
   */
  private recordUpdateOperation(latency: number, success: boolean = true): void {
    this.updateOperations.push({ timestamp: Date.now(), latency, success });
    // Keep last MAX_OPERATION_HISTORY operations
    if (this.updateOperations.length > MAX_OPERATION_HISTORY) {
      this.updateOperations = this.updateOperations.slice(-MAX_OPERATION_HISTORY);
    }
  }

  /**
   * Record bulk operation
   */
  private recordBulkOperation(latency: number, items: number, errors: number): void {
    this.bulkOperations.push({ timestamp: Date.now(), latency, items, errors });
    // Keep last MAX_OPERATION_HISTORY operations
    if (this.bulkOperations.length > MAX_OPERATION_HISTORY) {
      this.bulkOperations = this.bulkOperations.slice(-MAX_OPERATION_HISTORY);
    }
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) {
      return 0;
    }
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  /**
   * Calculate operation type metrics
   */
  private calculateOperationMetrics(
    operations: Array<{ timestamp: number; latency: number; success: boolean }>,
    timeWindow: number,
    now: number
  ): OperationTypeMetrics {
    const recentOps = operations.filter(op => now - op.timestamp < timeWindow);
    const latencies = recentOps.map(op => op.latency).sort((a, b) => a - b);
    const errors = recentOps.filter(op => !op.success).length;
    const totalOps = operations.length;
    const totalErrors = operations.filter(op => !op.success).length;

    const opsPerSecond = recentOps.length;
    const avgLatency = latencies.length > 0
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
      : 0;
    const p50Latency = this.calculatePercentile(latencies, 50);
    const p99Latency = this.calculatePercentile(latencies, 99);
    const errorRate = totalOps > 0 ? totalErrors / totalOps : 0;

    return {
      operationsPerSecond: opsPerSecond,
      averageLatency: avgLatency,
      p50Latency,
      p99Latency,
      errorRate,
      totalOperations: totalOps,
      totalErrors,
    };
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    const now = Date.now();
    const timeWindow = METRICS_TIME_WINDOW_MS;

    // Check and refresh indices if needed
    this.checkAndRefreshIndices();

    // Calculate operations per second
    const recentIndexOps = this.indexOperations.filter(op => now - op.timestamp < timeWindow);
    const recentSearchOps = this.searchOperations.filter(op => now - op.timestamp < timeWindow);
    const recentGetOps = this.getOperations.filter(op => now - op.timestamp < timeWindow);
    const recentDeleteOps = this.deleteOperations.filter(op => now - op.timestamp < timeWindow);
    const recentUpdateOps = this.updateOperations.filter(op => now - op.timestamp < timeWindow);
    const recentBulkOps = this.bulkOperations.filter(op => now - op.timestamp < timeWindow);

    // Count index operations including those from bulk
    const bulkIndexOps = recentBulkOps.reduce((sum, op) => sum + op.items, 0);
    this.metrics.indexOperationsPerSecond = recentIndexOps.length + bulkIndexOps;
    this.metrics.searchOperationsPerSecond = recentSearchOps.length;

    // Calculate average latencies
    if (recentIndexOps.length > 0) {
      this.metrics.averageIndexLatency = recentIndexOps.reduce((sum, op) => sum + op.latency, 0) / recentIndexOps.length;
    }
    if (recentSearchOps.length > 0) {
      this.metrics.averageSearchLatency = recentSearchOps.reduce((sum, op) => sum + op.latency, 0) / recentSearchOps.length;
    }
    if (recentGetOps.length > 0) {
      this.metrics.averageGetLatency = recentGetOps.reduce((sum, op) => sum + op.latency, 0) / recentGetOps.length;
    }

    // Calculate operation type metrics
    this.metrics.operationMetrics.index = this.calculateOperationMetrics(this.indexOperations, timeWindow, now);
    this.metrics.operationMetrics.search = this.calculateOperationMetrics(
      this.searchOperations.map(op => ({ timestamp: op.timestamp, latency: op.latency, success: op.success })),
      timeWindow,
      now
    );
    this.metrics.operationMetrics.get = this.calculateOperationMetrics(this.getOperations, timeWindow, now);
    this.metrics.operationMetrics.delete = this.calculateOperationMetrics(this.deleteOperations, timeWindow, now);
    this.metrics.operationMetrics.update = this.calculateOperationMetrics(this.updateOperations, timeWindow, now);
    
    // Calculate bulk metrics
    const bulkLatencies = recentBulkOps.map(op => op.latency).sort((a, b) => a - b);
    const bulkErrors = recentBulkOps.reduce((sum, op) => sum + op.errors, 0);
    const bulkTotalOps = this.bulkOperations.length;
    const bulkTotalErrors = this.bulkOperations.reduce((sum, op) => sum + op.errors, 0);
    this.metrics.operationMetrics.bulk = {
      operationsPerSecond: recentBulkOps.length,
      averageLatency: bulkLatencies.length > 0
        ? bulkLatencies.reduce((sum, l) => sum + l, 0) / bulkLatencies.length
        : 0,
      p50Latency: this.calculatePercentile(bulkLatencies, 50),
      p99Latency: this.calculatePercentile(bulkLatencies, 99),
      errorRate: bulkTotalOps > 0 ? bulkTotalErrors / bulkTotalOps : 0,
      totalOperations: bulkTotalOps,
      totalErrors: bulkTotalErrors,
    };

    // Update cluster metrics
    this.metrics.totalNodes = this.nodes.size;
    this.metrics.healthyNodes = Array.from(this.nodes.values()).filter(n => n.status === 'up').length;
    this.metrics.totalIndices = this.indices.size;
    this.metrics.totalDocs = Array.from(this.indices.values()).reduce((sum, idx) => sum + idx.docs, 0);
    this.metrics.totalSize = Array.from(this.indices.values()).reduce((sum, idx) => sum + idx.size, 0);

    // Calculate shard metrics
    let activeShards = 0;
    let relocatingShards = 0;
    let initializingShards = 0;
    let unassignedShards = 0;

    for (const shardList of this.shards.values()) {
      for (const shard of shardList) {
        if (shard.primary) {
          switch (shard.state) {
            case 'STARTED':
              activeShards++;
              break;
            case 'RELOCATING':
              relocatingShards++;
              break;
            case 'INITIALIZING':
              initializingShards++;
              break;
            case 'UNASSIGNED':
              unassignedShards++;
              break;
          }
        }
      }
    }

    this.metrics.activeShards = activeShards;
    this.metrics.relocatingShards = relocatingShards;
    this.metrics.initializingShards = initializingShards;
    this.metrics.unassignedShards = unassignedShards;

    // Calculate cluster health
    this.metrics.clusterHealth = this.calculateClusterHealth();

    // Update index health
    for (const index of this.indices.values()) {
      index.health = this.calculateIndexHealth(index.name);
    }

    // Calculate index metrics
    // Note: For simulation, we distribute operations across indices proportionally
    // In a real implementation, operations would be tracked per index
    this.metrics.indexMetrics = Array.from(this.indices.values()).map(index => {
      // Distribute operations proportionally based on index size
      const indexWeight = index.docs / Math.max(1, this.metrics.totalDocs);
      const recentIndexOpsForIndex = Math.floor(recentIndexOps.length * indexWeight);
      const recentSearchOpsForIndex = Math.floor(recentSearchOps.length * indexWeight);
      
      const pendingDocs = this.pendingDocuments.get(index.name);
      const pendingCount = pendingDocs
        ? Array.from(pendingDocs.values()).reduce((sum, docs) => sum + docs.length, 0)
        : 0;
      const refreshOps = this.refreshOperations.filter(op => op.index === index.name && now - op.timestamp < timeWindow);

      // Calculate average latencies from recent operations (simplified)
      const avgIndexLatency = recentIndexOps.length > 0
        ? recentIndexOps.reduce((sum, op) => sum + op.latency, 0) / recentIndexOps.length
        : 0;
      const avgSearchLatency = recentSearchOps.length > 0
        ? recentSearchOps.reduce((sum, op) => sum + op.latency, 0) / recentSearchOps.length
        : 0;

      return {
        indexName: index.name,
        docs: index.docs,
        size: index.size,
        shards: index.shards,
        replicas: index.replicas,
        health: index.health,
        indexOperationsPerSecond: recentIndexOpsForIndex,
        searchOperationsPerSecond: recentSearchOpsForIndex,
        averageIndexLatency: avgIndexLatency,
        averageSearchLatency: avgSearchLatency,
        refreshOperationsPerSecond: refreshOps.length,
        pendingDocuments: pendingCount,
      };
    });

    // Calculate shard metrics
    this.metrics.shardMetrics = [];
    for (const [indexName, shardList] of this.shards.entries()) {
      for (const shard of shardList) {
        const shardOps = this.indexOperations.filter(op => {
          // Approximate shard routing - in real implementation would track per shard
          return true; // Simplified for now
        });
        const recentShardOps = shardOps.filter(op => now - op.timestamp < timeWindow);
        
        this.metrics.shardMetrics.push({
          index: shard.index,
          shard: shard.shard,
          primary: shard.primary,
          node: shard.node,
          state: shard.state,
          docs: shard.docs,
          size: shard.size,
          operationsPerSecond: recentShardOps.length,
          averageLatency: recentShardOps.length > 0
            ? recentShardOps.reduce((sum, op) => sum + op.latency, 0) / recentShardOps.length
            : 0,
        });
      }
    }

    // Calculate node metrics
    this.metrics.nodeMetrics = Array.from(this.nodes.values()).map(node => {
      const nodeShards = Array.from(this.shards.values())
        .flat()
        .filter(shard => shard.node === node.address);
      const nodeOps = this.indexOperations.filter(op => {
        // Approximate node operations - in real implementation would track per node
        return true; // Simplified for now
      });
      const recentNodeOps = nodeOps.filter(op => now - op.timestamp < timeWindow);
      
      // Simulate memory and CPU usage based on load
      const memoryUsage = node.load * 0.8; // 80% of load is memory
      const cpuUsage = node.load * 0.6; // 60% of load is CPU

      return {
        address: node.address,
        status: node.status,
        load: node.load,
        shards: nodeShards.length,
        operationsPerSecond: recentNodeOps.length,
        averageLatency: recentNodeOps.length > 0
          ? recentNodeOps.reduce((sum, op) => sum + op.latency, 0) / recentNodeOps.length
          : 0,
        memoryUsage,
        cpuUsage,
      };
    });

    this.lastMetricsUpdate = now;
  }
}

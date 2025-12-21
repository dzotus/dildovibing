/**
 * Elasticsearch Routing Engine
 * Handles Elasticsearch operations: indexing, searching, cluster management, shard routing
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
  operation: 'index' | 'get' | 'search' | 'delete' | 'bulk';
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
}

/**
 * Elasticsearch Routing Engine
 * Simulates Elasticsearch cluster behavior
 */
export class ElasticsearchRoutingEngine {
  private clusterName: string = 'archiphoenix-cluster';
  private nodes: Map<string, ElasticsearchNode> = new Map();
  private indices: Map<string, Index> = new Map();
  private shards: Map<string, Shard[]> = new Map(); // index -> shards[]
  private documents: Map<string, Map<number, Document[]>> = new Map(); // index -> shard -> documents[]
  private defaultShards: number = 5;
  private defaultReplicas: number = 1;
  private refreshInterval: string = '1s';
  
  // Metrics
  private metrics: ElasticsearchMetrics = {
    clusterHealth: 'green',
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
    averageIndexLatency: 5,
    averageSearchLatency: 10,
    averageGetLatency: 2,
  };

  // Operation tracking
  private indexOperations: Array<{ timestamp: number; latency: number }> = [];
  private searchOperations: Array<{ timestamp: number; latency: number; hits: number }> = [];
  private getOperations: Array<{ timestamp: number; latency: number }> = [];
  private lastMetricsUpdate: number = Date.now();
  private recentQueries: ElasticsearchOperation[] = [];

  /**
   * Initialize with Elasticsearch configuration
   */
  public initialize(config: ElasticsearchConfig): void {
    this.clusterName = config.clusterName || 'archiphoenix-cluster';
    this.defaultShards = config.defaultShards || 5;
    this.defaultReplicas = config.defaultReplicas || 1;
    this.refreshInterval = config.refreshInterval || '1s';

    // Initialize nodes
    this.nodes.clear();
    if (config.nodes && config.nodes.length > 0) {
      for (const nodeAddr of config.nodes) {
        this.nodes.set(nodeAddr, {
          address: nodeAddr,
          status: 'up',
          load: 0.3 + Math.random() * 0.4, // 0.3-0.7
          shards: 0,
        });
      }
    } else {
      // Default node
      this.nodes.set('localhost:9200', {
        address: 'localhost:9200',
        status: 'up',
        load: 0.5,
        shards: 0,
      });
    }

    // Initialize indices
    this.indices.clear();
    this.shards.clear();
    this.documents.clear();
    
    if (config.indices && config.indices.length > 0) {
      for (const index of config.indices) {
        this.createIndex(index.name, index.shards || this.defaultShards, index.replicas || this.defaultReplicas, index);
      }
    } else {
      // Default index
      this.createIndex('archiphoenix-index', this.defaultShards, this.defaultReplicas);
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
            load: 0.3 + Math.random() * 0.4,
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
  public createIndex(name: string, shards: number = 5, replicas: number = 1, indexConfig?: Partial<Index>): void {
    const index: Index = {
      name,
      docs: indexConfig?.docs || 0,
      size: indexConfig?.size || 0,
      shards,
      replicas,
      health: 'yellow', // Will be updated
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
        state: 'STARTED',
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
          state: 'STARTED',
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

    // Create document
    const doc: Document = {
      _id: id,
      _index: index,
      _source: document,
      _routing: routing,
    };

    // Store in shard
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

    // Update index metrics
    indexData.docs = this.getTotalDocsForIndex(index);
    indexData.size = this.getTotalSizeForIndex(index);
    indexData.health = this.calculateIndexHealth(index);

    // Update shard metrics
    const shardList = this.shards.get(index)!;
    for (const shard of shardList) {
      if (shard.index === index && shard.shard === shardNum && shard.primary) {
        shard.docs = shardDocs.length;
        shard.size = shardDocs.length * 1024; // Estimate: 1KB per doc
      }
    }

    const latency = this.calculateIndexLatency();
    this.recordIndexOperation(latency);
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
   * Get a document by ID
   */
  public getDocument(index: string, id: string, routing?: string): ElasticsearchOperation {
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
    this.recordGetOperation(latency);
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

    return {
      operation: 'get',
      index,
      id,
      document: doc._source,
      routing,
      latency,
      success: true,
      took: latency,
    };
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

    // Search across all shards (simplified)
    const docMap = this.documents.get(index)!;
    let allDocs: Document[] = [];
    
    for (let shardNum = 0; shardNum < indexData.shards; shardNum++) {
      const shardDocs = docMap.get(shardNum) || [];
      allDocs = allDocs.concat(shardDocs);
    }

    // Simple query matching (simplified - in real ES this would be much more complex)
    let matchingDocs = allDocs;
    
    if (query && query.query) {
      // Simple match_all or match query simulation
      if (query.query.match_all) {
        matchingDocs = allDocs;
      } else if (query.query.match) {
        // Simple text matching simulation
        const matchField = Object.keys(query.query.match)[0];
        const matchValue = query.query.match[matchField];
        if (matchValue && typeof matchValue === 'string') {
          matchingDocs = allDocs.filter(doc => {
            const fieldValue = doc._source[matchField];
            return fieldValue && String(fieldValue).toLowerCase().includes(matchValue.toLowerCase());
          });
        }
      }
    }

    // Apply size limit
    const size = query?.size || 10;
    matchingDocs = matchingDocs.slice(0, size);

    const latency = this.calculateSearchLatency(indexData.shards, matchingDocs.length);
    this.recordSearchOperation(latency, matchingDocs.length);
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
    if (this.recentQueries.length > 100) {
      this.recentQueries = this.recentQueries.slice(0, 100);
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

    // Update index metrics
    indexData.docs = this.getTotalDocsForIndex(index);
    indexData.size = this.getTotalSizeForIndex(index);
    indexData.health = this.calculateIndexHealth(index);

    // Update shard metrics
    const shardList = this.shards.get(index)!;
    for (const shard of shardList) {
      if (shard.index === index && shard.shard === shardNum && shard.primary) {
        shard.docs = filteredDocs.length;
        shard.size = filteredDocs.length * 1024;
      }
    }

    const latency = this.calculateIndexLatency();
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
   * Execute Elasticsearch query (supports various API formats)
   */
  public executeQuery(queryString: string): ElasticsearchOperation {
    const startTime = Date.now();
    
    try {
      // Parse query string (could be JSON or Elasticsearch DSL)
      let query: any;
      try {
        query = JSON.parse(queryString);
      } catch {
        // Try to parse as Elasticsearch API call
        const lines = queryString.split('\n');
        if (lines.length >= 2) {
          const methodMatch = lines[0].match(/^(GET|POST|PUT|DELETE)\s+(.+)/);
          if (methodMatch) {
            const method = methodMatch[1];
            const path = methodMatch[2].trim();
            
            if (method === 'GET' && path.includes('/_search')) {
              query = lines.length > 1 ? JSON.parse(lines.slice(1).join('\n')) : { query: { match_all: {} } };
              const indexMatch = path.match(/^\/([^\/]+)\/_search/);
              const index = indexMatch ? indexMatch[1] : '_all';
              return this.search(index, query);
            } else if (method === 'GET' && path.match(/\/[^\/]+\/_doc\/[^\/]+/)) {
              const match = path.match(/\/([^\/]+)\/_doc\/([^\/]+)/);
              if (match) {
                return this.getDocument(match[1], match[2]);
              }
            }
          }
        }
        return {
          operation: 'search',
          query: queryString,
          latency: Date.now() - startTime,
          success: false,
          error: 'Invalid query format',
        };
      }

      // Default to search if query object provided
      if (query.query || query.match_all) {
        return this.search('_all', query);
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
      total += docs.length * 1024; // Estimate: 1KB per doc
    }
    return total;
  }

  /**
   * Calculate index latency
   */
  private calculateIndexLatency(): number {
    const baseLatency = 5; // Base latency for indexing
    const docCount = this.metrics.totalDocs;
    const docFactor = Math.min(20, docCount / 10000); // Up to 20ms for large indices
    return baseLatency + docFactor + Math.random() * 5;
  }

  /**
   * Calculate search latency
   */
  private calculateSearchLatency(shardCount: number, resultCount: number): number {
    const baseLatency = 10; // Base latency for search
    const shardLatency = shardCount * 2; // 2ms per shard (parallel search)
    const resultLatency = Math.min(50, resultCount / 100); // Up to 50ms for large result sets
    return baseLatency + shardLatency + resultLatency + Math.random() * 10;
  }

  /**
   * Calculate get latency
   */
  private calculateGetLatency(): number {
    const baseLatency = 2; // Base latency for get (direct shard access)
    return baseLatency + Math.random() * 3;
  }

  /**
   * Record index operation
   */
  private recordIndexOperation(latency: number): void {
    this.indexOperations.push({ timestamp: Date.now(), latency });
    // Keep last 500 operations
    if (this.indexOperations.length > 500) {
      this.indexOperations = this.indexOperations.slice(-500);
    }
  }

  /**
   * Record search operation
   */
  private recordSearchOperation(latency: number, hits: number): void {
    this.searchOperations.push({ timestamp: Date.now(), latency, hits });
    // Keep last 500 operations
    if (this.searchOperations.length > 500) {
      this.searchOperations = this.searchOperations.slice(-500);
    }
  }

  /**
   * Record get operation
   */
  private recordGetOperation(latency: number): void {
    this.getOperations.push({ timestamp: Date.now(), latency });
    // Keep last 500 operations
    if (this.getOperations.length > 500) {
      this.getOperations = this.getOperations.slice(-500);
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    const now = Date.now();
    const timeWindow = 1000; // 1 second

    // Calculate operations per second
    const recentIndexOps = this.indexOperations.filter(op => now - op.timestamp < timeWindow);
    const recentSearchOps = this.searchOperations.filter(op => now - op.timestamp < timeWindow);
    const recentGetOps = this.getOperations.filter(op => now - op.timestamp < timeWindow);

    this.metrics.indexOperationsPerSecond = recentIndexOps.length;
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

    this.lastMetricsUpdate = now;
  }
}


import { CanvasNode } from '@/types';
import { ClickHouseRoutingEngine, ClickHouseConfig, ClickHouseMetrics, QueryResult } from './ClickHouseRoutingEngine';

/**
 * Extended ClickHouse Metrics (corresponding to real ClickHouse metrics)
 * Based on system.metrics, system.events, system.asynchronous_metrics
 */
export interface ExtendedClickHouseMetrics extends ClickHouseMetrics {
  // Query metrics (from system.events)
  queries: number; // Total queries executed
  queries_per_second: number;
  slow_query_count: number; // queries > 1s
  failed_queries: number;
  
  // Memory metrics (from system.metrics)
  MemoryTracking: number; // bytes - main memory usage
  MemoryTrackingInBackgroundProcessingPool: number; // bytes - background processing memory
  MemoryTrackingInMerges: number; // bytes - memory used in merges
  MemoryTrackingInQueries: number; // bytes - memory used in queries
  
  // Merge metrics (from system.metrics)
  BackgroundMerges: number; // Number of background merges
  BackgroundMergesAndMutationsPoolTask: number; // Tasks in merge pool
  MergedRows: number; // Rows merged
  MergedUncompressedBytes: number; // bytes merged
  MergedCompressedBytes: number; // bytes merged (compressed)
  
  // Replication metrics (from system.metrics)
  ReplicatedFetches: number; // Number of fetches from replicas
  ReplicatedSends: number; // Number of sends to replicas
  ReplicatedChecks: number; // Number of consistency checks
  ReplicatedDataLoss: number; // Data loss events (should be 0)
  
  // Parts metrics (from system.metrics)
  PartsActive: number; // Active parts
  PartsCommitted: number; // Committed parts
  PartsOutdated: number; // Outdated parts (to be deleted)
  PartsDeleting: number; // Parts being deleted
  
  // Compression metrics (from system.metrics)
  CompressedReadBufferBytes: number; // bytes read (compressed)
  UncompressedReadBufferBytes: number; // bytes read (uncompressed)
  CompressedWriteBufferBytes: number; // bytes written (compressed)
  UncompressedWriteBufferBytes: number; // bytes written (uncompressed)
  
  // Query execution metrics
  SelectQuery: number; // SELECT queries executed
  InsertQuery: number; // INSERT queries executed
  AlterQuery: number; // ALTER queries executed
  CreateQuery: number; // CREATE queries executed
  DropQuery: number; // DROP queries executed
  
  // Network metrics (for cluster)
  NetworkReceiveBytes: number; // bytes received from network
  NetworkSendBytes: number; // bytes sent to network
  NetworkReceiveElapsedMicroseconds: number; // microseconds spent receiving
  NetworkSendElapsedMicroseconds: number; // microseconds spent sending
  
  // Disk metrics
  DiskReadBytes: number; // bytes read from disk
  DiskWriteBytes: number; // bytes written to disk
  DiskReadElapsedMicroseconds: number; // microseconds spent reading
  DiskWriteElapsedMicroseconds: number; // microseconds spent writing
}

/**
 * Query history entry for tracking
 */
interface QueryHistoryEntry {
  id: string;
  sql: string;
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
  queryType: 'SELECT' | 'INSERT' | 'ALTER' | 'CREATE' | 'DROP' | 'OTHER';
  rowsRead?: number;
  rowsWritten?: number;
}

/**
 * Merge operation tracking
 */
interface MergeOperation {
  id: string;
  table: string;
  parts: string[];
  startedAt: number;
  completedAt?: number;
  rowsMerged: number;
  bytesMerged: number;
}

/**
 * ClickHouse Emulation Engine
 * Simulates ClickHouse database behavior with realistic metrics
 */
export class ClickHouseEmulationEngine {
  private nodeId: string;
  private config: ClickHouseConfig;
  private routingEngine: ClickHouseRoutingEngine;
  
  // Query tracking
  private queryHistory: QueryHistoryEntry[] = [];
  private readonly MAX_QUERY_HISTORY = 10000;
  private queryCounter: number = 0;
  
  // Merge tracking
  private mergeOperations: MergeOperation[] = [];
  private mergeCounter: number = 0;
  
  // Metrics tracking
  private lastMetricsUpdate: number = Date.now();
  private metricsSnapshot: ExtendedClickHouseMetrics;
  
  // Operation counters (for metrics)
  private totalQueries: number = 0;
  private totalSelectQueries: number = 0;
  private totalInsertQueries: number = 0;
  private totalAlterQueries: number = 0;
  private totalCreateQueries: number = 0;
  private totalDropQueries: number = 0;
  private totalFailedQueries: number = 0;
  
  // Network and disk tracking
  private networkReceiveBytes: number = 0;
  private networkSendBytes: number = 0;
  private diskReadBytes: number = 0;
  private diskWriteBytes: number = 0;
  
  constructor(nodeId: string, config: ClickHouseConfig) {
    this.nodeId = nodeId;
    this.config = this.initializeConfig(config);
    this.routingEngine = new ClickHouseRoutingEngine();
    this.routingEngine.initialize(this.config);
    
    // Initialize metrics snapshot
    this.metricsSnapshot = this.createInitialMetrics();
  }

  /**
   * Initialize configuration with defaults
   */
  private initializeConfig(config: ClickHouseConfig): ClickHouseConfig {
    return {
      cluster: config.cluster || 'archiphoenix-cluster',
      replication: config.replication || false,
      clusterNodes: config.clusterNodes || (config.replication ? 3 : 1),
      shards: config.shards || 1,
      replicas: config.replicas || (config.replication ? 3 : 1),
      keeperNodes: config.keeperNodes || [],
      tables: Array.isArray(config.tables) ? config.tables : [],
      maxMemoryUsage: config.maxMemoryUsage || 10 * 1024 * 1024 * 1024, // 10GB
      compression: config.compression || 'LZ4',
    };
  }

  /**
   * Create initial metrics snapshot
   */
  private createInitialMetrics(): ExtendedClickHouseMetrics {
    const baseMetrics = this.routingEngine.getMetrics();
    
    return {
      ...baseMetrics,
      // Query metrics
      queries: 0,
      queries_per_second: 0,
      slow_query_count: 0,
      failed_queries: 0,
      
      // Memory metrics
      MemoryTracking: 0,
      MemoryTrackingInBackgroundProcessingPool: 0,
      MemoryTrackingInMerges: 0,
      MemoryTrackingInQueries: 0,
      
      // Merge metrics
      BackgroundMerges: 0,
      BackgroundMergesAndMutationsPoolTask: 0,
      MergedRows: 0,
      MergedUncompressedBytes: 0,
      MergedCompressedBytes: 0,
      
      // Replication metrics
      ReplicatedFetches: 0,
      ReplicatedSends: 0,
      ReplicatedChecks: 0,
      ReplicatedDataLoss: 0,
      
      // Parts metrics
      PartsActive: baseMetrics.partsCount,
      PartsCommitted: baseMetrics.partsCount,
      PartsOutdated: 0,
      PartsDeleting: 0,
      
      // Compression metrics
      CompressedReadBufferBytes: 0,
      UncompressedReadBufferBytes: 0,
      CompressedWriteBufferBytes: 0,
      UncompressedWriteBufferBytes: 0,
      
      // Query execution metrics
      SelectQuery: 0,
      InsertQuery: 0,
      AlterQuery: 0,
      CreateQuery: 0,
      DropQuery: 0,
      
      // Network metrics
      NetworkReceiveBytes: 0,
      NetworkSendBytes: 0,
      NetworkReceiveElapsedMicroseconds: 0,
      NetworkSendElapsedMicroseconds: 0,
      
      // Disk metrics
      DiskReadBytes: 0,
      DiskWriteBytes: 0,
      DiskReadElapsedMicroseconds: 0,
      DiskWriteElapsedMicroseconds: 0,
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ClickHouseConfig>): void {
    this.config = { ...this.config, ...config };
    this.routingEngine.initialize(this.config);
  }

  /**
   * Execute SQL query
   */
  public executeQuery(sql: string): QueryResult {
    const startTime = Date.now();
    const queryId = `query_${++this.queryCounter}_${startTime}`;
    
    // Determine query type
    const normalizedQuery = sql.trim().replace(/\s+/g, ' ');
    const upperQuery = normalizedQuery.toUpperCase();
    let queryType: 'SELECT' | 'INSERT' | 'ALTER' | 'CREATE' | 'DROP' | 'OTHER' = 'OTHER';
    
    if (upperQuery.startsWith('SELECT')) {
      queryType = 'SELECT';
      this.totalSelectQueries++;
    } else if (upperQuery.startsWith('INSERT')) {
      queryType = 'INSERT';
      this.totalInsertQueries++;
    } else if (upperQuery.startsWith('ALTER')) {
      queryType = 'ALTER';
      this.totalAlterQueries++;
    } else if (upperQuery.startsWith('CREATE TABLE')) {
      queryType = 'CREATE';
      this.totalCreateQueries++;
    } else if (upperQuery.startsWith('DROP TABLE')) {
      queryType = 'DROP';
      this.totalDropQueries++;
    }
    
    this.totalQueries++;
    
    // Execute query via routing engine
    const result = this.routingEngine.executeQuery(sql);
    
    // Track query in history
    const duration = result.latency || (Date.now() - startTime);
    const entry: QueryHistoryEntry = {
      id: queryId,
      sql,
      timestamp: startTime,
      duration,
      success: result.success || false,
      error: result.error,
      queryType,
      rowsRead: result.dataRead,
      rowsWritten: result.dataWritten,
    };
    
    this.queryHistory.push(entry);
    
    // Keep only recent history
    if (this.queryHistory.length > this.MAX_QUERY_HISTORY) {
      this.queryHistory.shift();
    }
    
    // Track failed queries
    if (!result.success) {
      this.totalFailedQueries++;
    }
    
    // Simulate network and disk I/O based on query type and data
    this.simulateIO(result, queryType);
    
    return result;
  }

  /**
   * Simulate I/O operations (network and disk)
   */
  private simulateIO(result: QueryResult, queryType: string): void {
    if (!result.success) {
      return;
    }
    
    const baseLatency = result.latency || 0;
    
    // For SELECT queries - simulate disk read and network send
    if (queryType === 'SELECT') {
      const dataRead = (result.dataRead || 0) * 100; // ~100 bytes per row average
      this.diskReadBytes += dataRead;
      this.diskReadElapsedMicroseconds += baseLatency * 1000 * 0.3; // 30% of latency is disk read
      
      // Network send (if cluster)
      if (this.config.clusterNodes && this.config.clusterNodes > 1) {
        const networkBytes = dataRead;
        this.networkSendBytes += networkBytes;
        this.networkSendElapsedMicroseconds += baseLatency * 1000 * 0.2; // 20% of latency is network
      }
    }
    
    // For INSERT queries - simulate network receive and disk write
    if (queryType === 'INSERT') {
      const dataWritten = (result.dataWritten || 0) * 100; // ~100 bytes per row average
      
      // Network receive (if cluster)
      if (this.config.clusterNodes && this.config.clusterNodes > 1) {
        const networkBytes = dataWritten;
        this.networkReceiveBytes += networkBytes;
        this.networkReceiveElapsedMicroseconds += baseLatency * 1000 * 0.2; // 20% of latency is network
      }
      
      this.diskWriteBytes += dataWritten;
      this.diskWriteElapsedMicroseconds += baseLatency * 1000 * 0.4; // 40% of latency is disk write
    }
  }

  /**
   * Update metrics
   */
  public updateMetrics(): void {
    const now = Date.now();
    const baseMetrics = this.routingEngine.getMetrics();
    
    // Calculate query metrics from history
    const recentQueries = this.queryHistory.filter(
      q => now - q.timestamp < 60000 // Last minute
    );
    const queriesLastSecond = this.queryHistory.filter(
      q => now - q.timestamp < 1000
    ).length;
    
    const slowQueries = recentQueries.filter(q => q.duration > 1000).length;
    const failedQueries = recentQueries.filter(q => !q.success).length;
    
    // Calculate memory metrics based on current usage
    const memoryTracking = baseMetrics.memoryUsage;
    const memoryInQueries = memoryTracking * 0.6; // 60% for queries
    const memoryInMerges = baseMetrics.pendingMerges > 0 ? memoryTracking * 0.2 : 0; // 20% for merges if active
    const memoryInBackground = memoryTracking * 0.1; // 10% for background
    
    // Calculate merge metrics
    const activeMerges = this.mergeOperations.filter(m => !m.completedAt).length;
    const totalRowsMerged = this.mergeOperations
      .filter(m => m.completedAt)
      .reduce((sum, m) => sum + m.rowsMerged, 0);
    const totalBytesMerged = this.mergeOperations
      .filter(m => m.completedAt)
      .reduce((sum, m) => sum + m.bytesMerged, 0);
    
    // Calculate compression metrics based on compression ratio
    const compressionRatio = baseMetrics.compressionRatio || 1.0;
    const uncompressedRead = this.diskReadBytes;
    const compressedRead = uncompressedRead / compressionRatio;
    const uncompressedWrite = this.diskWriteBytes;
    const compressedWrite = uncompressedWrite / compressionRatio;
    
    // Calculate replication metrics (if replication enabled)
    let replicatedFetches = 0;
    let replicatedSends = 0;
    let replicatedChecks = 0;
    
    if (this.config.replication && this.config.replicas && this.config.replicas > 1) {
      // Simulate replication activity based on queries
      replicatedSends = this.totalInsertQueries * (this.config.replicas - 1);
      replicatedFetches = this.totalSelectQueries * 0.1; // 10% of selects might fetch from replica
      replicatedChecks = Math.floor(this.totalQueries / 100); // Check every 100 queries
    }
    
    // Calculate parts metrics from routing engine
    const partsActive = baseMetrics.partsCount;
    const partsCommitted = partsActive; // Simplified - all active parts are committed
    const partsOutdated = Math.floor(partsActive * 0.05); // 5% outdated (simplified)
    const partsDeleting = 0; // Simplified - no parts currently deleting
    
    // Update metrics snapshot
    this.metricsSnapshot = {
      ...baseMetrics,
      // Query metrics
      queries: this.totalQueries,
      queries_per_second: queriesLastSecond,
      slow_query_count: slowQueries,
      failed_queries: this.totalFailedQueries,
      
      // Memory metrics
      MemoryTracking: memoryTracking,
      MemoryTrackingInBackgroundProcessingPool: memoryInBackground,
      MemoryTrackingInMerges: memoryInMerges,
      MemoryTrackingInQueries: memoryInQueries,
      
      // Merge metrics
      BackgroundMerges: activeMerges,
      BackgroundMergesAndMutationsPoolTask: activeMerges,
      MergedRows: totalRowsMerged,
      MergedUncompressedBytes: totalBytesMerged,
      MergedCompressedBytes: totalBytesMerged / compressionRatio,
      
      // Replication metrics
      ReplicatedFetches: replicatedFetches,
      ReplicatedSends: replicatedSends,
      ReplicatedChecks: replicatedChecks,
      ReplicatedDataLoss: 0, // Should always be 0 in healthy cluster
      
      // Parts metrics
      PartsActive: partsActive,
      PartsCommitted: partsCommitted,
      PartsOutdated: partsOutdated,
      PartsDeleting: partsDeleting,
      
      // Compression metrics
      CompressedReadBufferBytes: compressedRead,
      UncompressedReadBufferBytes: uncompressedRead,
      CompressedWriteBufferBytes: compressedWrite,
      UncompressedWriteBufferBytes: uncompressedWrite,
      
      // Query execution metrics
      SelectQuery: this.totalSelectQueries,
      InsertQuery: this.totalInsertQueries,
      AlterQuery: this.totalAlterQueries,
      CreateQuery: this.totalCreateQueries,
      DropQuery: this.totalDropQueries,
      
      // Network metrics
      NetworkReceiveBytes: this.networkReceiveBytes,
      NetworkSendBytes: this.networkSendBytes,
      NetworkReceiveElapsedMicroseconds: this.networkReceiveElapsedMicroseconds,
      NetworkSendElapsedMicroseconds: this.networkSendElapsedMicroseconds,
      
      // Disk metrics
      DiskReadBytes: this.diskReadBytes,
      DiskWriteBytes: this.diskWriteBytes,
      DiskReadElapsedMicroseconds: this.diskReadElapsedMicroseconds,
      DiskWriteElapsedMicroseconds: this.diskWriteElapsedMicroseconds,
    };
    
    this.lastMetricsUpdate = now;
  }

  /**
   * Get current metrics
   */
  public getMetrics(): ExtendedClickHouseMetrics {
    // Update metrics before returning
    this.updateMetrics();
    return { ...this.metricsSnapshot };
  }

  /**
   * Get routing engine (for direct access if needed)
   */
  public getRoutingEngine(): ClickHouseRoutingEngine {
    return this.routingEngine;
  }

  /**
   * Get query history
   */
  public getQueryHistory(limit?: number): QueryHistoryEntry[] {
    const history = [...this.queryHistory].reverse(); // Most recent first
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get merge operations
   */
  public getMergeOperations(limit?: number): MergeOperation[] {
    const operations = [...this.mergeOperations].reverse(); // Most recent first
    return limit ? operations.slice(0, limit) : operations;
  }
}

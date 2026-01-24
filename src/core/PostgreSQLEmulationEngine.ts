import { CanvasNode } from '@/types';
import { PostgreSQLQueryEngine } from './postgresql/QueryEngine';
import { PostgreSQLConnectionPool, ConnectionPoolConfig, ConnectionState } from './postgresql/ConnectionPool';
import {
  PostgreSQLTable,
  PostgreSQLView,
  PostgreSQLSchema,
  PostgreSQLIndex,
  PostgreSQLRow,
  QueryPlan,
  QueryExecutionResult,
} from './postgresql/types';

/**
 * PostgreSQL Configuration
 */
export interface PostgreSQLConfig {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  schemas?: PostgreSQLSchema[];
  tables?: PostgreSQLTable[];
  views?: PostgreSQLView[];
  roles?: Role[];
  currentSchema?: string;
  maxConnections?: number;
  minConnections?: number;
  idleTimeout?: number;
  maxLifetime?: number;
  connectionTimeout?: number;
  queryLatency?: number;
  metrics?: {
    enabled?: boolean;
    port?: number;
    path?: string;
  };
}

/**
 * Role definition
 */
export interface Role {
  name: string;
  login: boolean;
  superuser: boolean;
}

/**
 * Query execution history entry
 */
interface QueryHistoryEntry {
  id: string;
  sql: string;
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
  rowCount?: number;
  queryPlan?: QueryPlan;
  indexesUsed?: string[];
  connectionId?: string;
}

/**
 * Transaction state
 */
interface TransactionState {
  id: string;
  startedAt: number;
  queries: QueryHistoryEntry[];
  isolationLevel: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
  status: 'active' | 'committed' | 'rolled_back';
}

/**
 * Lock state
 */
interface LockState {
  id: string;
  table: string;
  schema: string;
  type: 'SHARE' | 'EXCLUSIVE' | 'ROW EXCLUSIVE' | 'SHARE ROW EXCLUSIVE' | 'ACCESS EXCLUSIVE';
  transactionId: string;
  acquiredAt: number;
  waitingQueries: string[]; // Query IDs waiting for this lock
}

/**
 * Table statistics (from pg_stat_user_tables)
 */
interface TableStatistics {
  tableName: string;
  schemaName: string;
  seqScans: number;
  seqScanTime: number; // Total time spent on seq scans (ms)
  indexScans: number;
  indexScanTime: number; // Total time spent on index scans (ms)
  tuplesFetched: number;
  tuplesInserted: number;
  tuplesUpdated: number;
  tuplesDeleted: number;
  deadTuples: number;
  liveTuples: number;
  lastVacuum?: number;
  lastAutoVacuum?: number;
  lastAnalyze?: number;
  lastAutoAnalyze?: number;
  tableSize: number; // bytes
}

/**
 * Vacuum operation
 */
interface VacuumOperation {
  id: string;
  table: string;
  schema: string;
  type: 'VACUUM' | 'AUTOVACUUM';
  startedAt: number;
  completedAt?: number;
  deadTuplesRemoved: number;
  pagesReclaimed: number;
}

/**
 * WAL (Write-Ahead Log) statistics
 */
interface WALStatistics {
  walWritten: number; // Total bytes written to WAL
  walArchived: number; // Total bytes archived
  walWrittenPerSecond: number;
  walArchivedPerSecond: number;
  lastCheckpoint: number;
  checkpointFrequency: number; // Checkpoints per hour
  walSize: number; // Current WAL size (bytes)
}

/**
 * PostgreSQL Metrics (corresponding to real PostgreSQL metrics)
 */
export interface PostgreSQLMetrics {
  // Connection metrics
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  totalConnections: number;
  maxConnections: number;
  connectionUtilization: number; // 0-1

  // Query metrics (from pg_stat_statements)
  queriesPerSecond: number;
  totalQueries: number;
  averageQueryTime: number;
  p50QueryTime: number;
  p95QueryTime: number;
  p99QueryTime: number;
  slowQueries: number; // queries > 1s
  topQueries?: Array<{
    sql: string;
    calls: number;
    totalTime: number;
    meanTime: number;
    minTime: number;
    maxTime: number;
  }>;

  // Database metrics (from pg_stat_database)
  transactionsPerSecond: number;
  commitsPerSecond: number;
  rollbacksPerSecond: number;
  databaseSize: number; // bytes
  bloatRatio: number; // 0-1, table bloat

  // Table metrics (from pg_stat_user_tables)
  totalTables: number;
  totalRows: number;
  totalIndexes: number;
  seqScansPerSecond: number;
  indexScansPerSecond: number;
  deadTuples: number;
  liveTuples: number;

  // Cache metrics
  cacheHitRatio: number; // 0-1, shared_buffers hit ratio
  indexCacheHitRatio: number; // 0-1

  // WAL metrics
  walWritten: number; // bytes per second
  walArchived: number; // bytes per second
  checkpointFrequency: number; // checkpoints per hour

  // Vacuum metrics
  autovacuumRunning: number;
  vacuumOperationsPerHour: number;
  lastVacuumTime: number;

  // Lock metrics
  activeLocks: number;
  blockedQueries: number;
  lockWaitTime: number; // ms

  // Replication metrics (if enabled)
  replicationLag: number; // ms
  replicationStatus: 'active' | 'inactive' | 'error';

  // Error metrics
  errorRate: number; // 0-1
  connectionErrors: number;
  queryErrors: number;
}

/**
 * PostgreSQL Emulation Engine
 * Simulates PostgreSQL database behavior with realistic metrics
 */
export class PostgreSQLEmulationEngine {
  private nodeId: string;
  private config: PostgreSQLConfig;
  private queryEngine: PostgreSQLQueryEngine;
  private connectionPool: PostgreSQLConnectionPool;
  private queryHistory: QueryHistoryEntry[] = [];
  private readonly MAX_QUERY_HISTORY = 10000;
  private transactions: Map<string, TransactionState> = new Map();
  private locks: Map<string, LockState> = new Map();
  private tableStatistics: Map<string, TableStatistics> = new Map(); // key: schema.table
  private vacuumOperations: VacuumOperation[] = [];
  private walStats: WALStatistics = {
    walWritten: 0,
    walArchived: 0,
    walWrittenPerSecond: 0,
    walArchivedPerSecond: 0,
    lastCheckpoint: Date.now(),
    checkpointFrequency: 0,
    walSize: 0,
  };
  private lastMetricsUpdate: number = Date.now();
  private lastCheckpointTime: number = Date.now();
  private readonly CHECKPOINT_INTERVAL = 300000; // 5 minutes
  private readonly AUTOVACUUM_THRESHOLD = 0.2; // 20% dead tuples triggers autovacuum
  private queryCounter: number = 0;
  private transactionCounter: number = 0;
  private lockCounter: number = 0;
  private vacuumCounter: number = 0;

  constructor(nodeId: string, config: PostgreSQLConfig) {
    this.nodeId = nodeId;
    this.config = this.initializeConfig(config);
    this.queryEngine = new PostgreSQLQueryEngine();
    this.connectionPool = new PostgreSQLConnectionPool({
      maxConnections: this.config.maxConnections || 100,
      minConnections: this.config.minConnections || 0,
      idleTimeout: this.config.idleTimeout || 300000,
      maxLifetime: this.config.maxLifetime || 3600000,
      connectionTimeout: this.config.connectionTimeout || 5000,
    });
    this.initializeTableStatistics();
  }

  /**
   * Initialize configuration with defaults
   */
  private initializeConfig(config: PostgreSQLConfig): PostgreSQLConfig {
    return {
      host: config.host || 'localhost',
      port: config.port || 5432,
      database: config.database || 'postgres',
      username: config.username || 'postgres',
      password: config.password || '',
      schemas: Array.isArray(config.schemas) ? config.schemas : [],
      tables: Array.isArray(config.tables) ? config.tables : [],
      views: Array.isArray(config.views) ? config.views : [],
      roles: Array.isArray(config.roles) ? config.roles : [],
      currentSchema: config.currentSchema || 'public',
      maxConnections: config.maxConnections || 100,
      minConnections: config.minConnections || 0,
      idleTimeout: config.idleTimeout || 300000,
      maxLifetime: config.maxLifetime || 3600000,
      connectionTimeout: config.connectionTimeout || 5000,
      queryLatency: config.queryLatency || 10,
      metrics: config.metrics || { enabled: true },
    };
  }

  /**
   * Initialize table statistics from tables
   */
  private initializeTableStatistics(): void {
    if (!Array.isArray(this.config.tables)) {
      return;
    }

    for (const table of this.config.tables) {
      const key = `${table.schema || 'public'}.${table.name}`;
      const rowCount = Array.isArray(table.data) ? table.data.length : 0;
      
      this.tableStatistics.set(key, {
        tableName: table.name,
        schemaName: table.schema || 'public',
        seqScans: 0,
        seqScanTime: 0,
        indexScans: 0,
        indexScanTime: 0,
        tuplesFetched: 0,
        tuplesInserted: 0,
        tuplesUpdated: 0,
        tuplesDeleted: 0,
        deadTuples: 0,
        liveTuples: rowCount,
        tableSize: this.calculateTableSize(table, rowCount),
      });
    }
  }

  /**
   * Calculate table size based on rows and columns
   */
  private calculateTableSize(table: PostgreSQLTable, rowCount: number): number {
    if (!Array.isArray(table.columns)) {
      return 0;
    }
    // Rough estimate: average 100 bytes per row
    return rowCount * 100;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<PostgreSQLConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update connection pool config
    if (config.maxConnections !== undefined || 
        config.minConnections !== undefined ||
        config.idleTimeout !== undefined ||
        config.maxLifetime !== undefined ||
        config.connectionTimeout !== undefined) {
      this.connectionPool.updateConfig({
        maxConnections: this.config.maxConnections || 100,
        minConnections: this.config.minConnections || 0,
        idleTimeout: this.config.idleTimeout || 300000,
        maxLifetime: this.config.maxLifetime || 3600000,
        connectionTimeout: this.config.connectionTimeout || 5000,
      });
    }

    // Update tables and statistics
    if (config.tables !== undefined) {
      this.config.tables = Array.isArray(config.tables) ? config.tables : [];
      this.initializeTableStatistics();
    }
  }

  /**
   * Execute SQL query
   */
  public executeQuery(sql: string, connectionId?: string): QueryExecutionResult {
    const startTime = Date.now();
    const queryId = `query_${++this.queryCounter}_${startTime}`;

    // Acquire connection if not provided
    let connId = connectionId;
    if (!connId) {
      connId = this.connectionPool.acquireConnection(sql);
      if (!connId) {
        // Pool exhausted
        const error: QueryExecutionResult = {
          success: false,
          error: 'Connection pool exhausted',
          executionTime: this.config.connectionTimeout || 5000,
        };
        this.recordQuery(queryId, sql, startTime, error, connId);
        return error;
      }
    }

    try {
      // Get tables, indexes, and views from config
      const tables = this.config.tables || [];
      const indexes = this.extractIndexesFromConfig();
      const views = this.config.views || [];

      // Execute query
      const result = this.queryEngine.execute(sql, tables, indexes, views);

      // Record query in history
      this.recordQuery(queryId, sql, startTime, result, connId);

      // Update table statistics based on query type
      this.updateTableStatistics(sql, result);

      // Simulate WAL write for write operations
      if (result.success && this.isWriteOperation(sql)) {
        this.simulateWALWrite(result);
      }

      // Release connection
      if (connId && !connectionId) {
        this.connectionPool.releaseConnection(connId, result.executionTime || 0);
      }

      return result;
    } catch (error) {
      const errorResult: QueryExecutionResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
      };
      this.recordQuery(queryId, sql, startTime, errorResult, connId);
      if (connId && !connectionId) {
        this.connectionPool.releaseConnection(connId, errorResult.executionTime || 0);
      }
      return errorResult;
    }
  }

  /**
   * Extract indexes from config
   */
  private extractIndexesFromConfig(): PostgreSQLIndex[] {
    const indexes: PostgreSQLIndex[] = [];
    if (!Array.isArray(this.config.tables)) {
      return indexes;
    }

    for (const table of this.config.tables) {
      if (Array.isArray(table.indexes)) {
        for (const indexName of table.indexes) {
          indexes.push({
            name: indexName,
            table: table.name,
            schema: table.schema || 'public',
            columns: [], // Simplified - would need to parse from index definition
            type: 'btree',
          });
        }
      }
    }

    return indexes;
  }

  /**
   * Check if query is a write operation
   */
  private isWriteOperation(sql: string): boolean {
    const upper = sql.trim().toUpperCase();
    return upper.startsWith('INSERT') || 
           upper.startsWith('UPDATE') || 
           upper.startsWith('DELETE') ||
           upper.startsWith('CREATE') ||
           upper.startsWith('DROP') ||
           upper.startsWith('ALTER');
  }

  /**
   * Record query in history
   */
  private recordQuery(
    queryId: string,
    sql: string,
    startTime: number,
    result: QueryExecutionResult,
    connectionId?: string
  ): void {
    const entry: QueryHistoryEntry = {
      id: queryId,
      sql,
      timestamp: startTime,
      duration: result.executionTime || 0,
      success: result.success || false,
      error: result.error,
      rowCount: result.rowCount,
      queryPlan: result.queryPlan,
      indexesUsed: result.indexesUsed,
      connectionId,
    };

    this.queryHistory.push(entry);

    // Keep only recent history
    if (this.queryHistory.length > this.MAX_QUERY_HISTORY) {
      this.queryHistory.shift();
    }
  }

  /**
   * Update table statistics based on query
   */
  private updateTableStatistics(sql: string, result: QueryExecutionResult): void {
    if (!result.success) {
      return;
    }

    const upper = sql.trim().toUpperCase();
    const now = Date.now();

    // Parse table name from SQL (simplified)
    const tableMatch = sql.match(/(?:FROM|INTO|UPDATE|DELETE\s+FROM)\s+["`]?(\w+)["`]?/i);
    if (!tableMatch) {
      return;
    }

    const tableName = tableMatch[1];
    const schemaName = 'public'; // Simplified - would need proper parsing

    const key = `${schemaName}.${tableName}`;
    const stats = this.tableStatistics.get(key);
    if (!stats) {
      return;
    }

    if (upper.startsWith('SELECT')) {
      // Check if index was used
      if (result.indexesUsed && result.indexesUsed.length > 0) {
        stats.indexScans++;
        stats.indexScanTime += result.executionTime || 0;
      } else {
        stats.seqScans++;
        stats.seqScanTime += result.executionTime || 0;
      }
      stats.tuplesFetched += result.rowCount || 0;
    } else if (upper.startsWith('INSERT')) {
      stats.tuplesInserted += result.rowCount || 0;
      stats.liveTuples += result.rowCount || 0;
      stats.tableSize = this.calculateTableSize(
        this.config.tables?.find(t => t.name === tableName) || {} as PostgreSQLTable,
        stats.liveTuples
      );
    } else if (upper.startsWith('UPDATE')) {
      stats.tuplesUpdated += result.rowCount || 0;
      // UPDATE creates dead tuples
      stats.deadTuples += result.rowCount || 0;
    } else if (upper.startsWith('DELETE')) {
      stats.tuplesDeleted += result.rowCount || 0;
      stats.liveTuples = Math.max(0, stats.liveTuples - (result.rowCount || 0));
      stats.deadTuples += result.rowCount || 0;
    }

    this.tableStatistics.set(key, stats);
  }

  /**
   * Simulate WAL write
   */
  private simulateWALWrite(result: QueryExecutionResult): void {
    // Estimate WAL size based on row count and operation
    const walSize = (result.rowCount || 0) * 50; // ~50 bytes per row in WAL
    this.walStats.walWritten += walSize;
    this.walStats.walSize += walSize;
  }

  /**
   * Update metrics (called on each simulation cycle)
   */
  public updateMetrics(): void {
    const now = Date.now();
    const timeDelta = (now - this.lastMetricsUpdate) / 1000; // seconds
    this.lastMetricsUpdate = now;

    // Update WAL per-second metrics
    if (timeDelta > 0) {
      this.walStats.walWrittenPerSecond = this.walStats.walWritten / timeDelta;
      this.walStats.walArchivedPerSecond = this.walStats.walArchived / timeDelta;
    }

    // Simulate checkpoint
    if (now - this.lastCheckpointTime > this.CHECKPOINT_INTERVAL) {
      this.simulateCheckpoint();
      this.lastCheckpointTime = now;
    }

    // Simulate autovacuum
    this.simulateAutovacuum();

    // Clean up old transactions
    this.cleanupTransactions();
  }

  /**
   * Simulate checkpoint
   */
  private simulateCheckpoint(): void {
    // Checkpoint writes WAL to disk and clears it
    this.walStats.walSize = 0;
    this.walStats.lastCheckpoint = Date.now();
    this.walStats.checkpointFrequency = 3600000 / this.CHECKPOINT_INTERVAL; // Checkpoints per hour
  }

  /**
   * Simulate autovacuum
   */
  private simulateAutovacuum(): void {
    if (!Array.isArray(this.config.tables)) {
      return;
    }

    for (const table of this.config.tables) {
      const key = `${table.schema || 'public'}.${table.name}`;
      const stats = this.tableStatistics.get(key);
      if (!stats) {
        continue;
      }

      // Check if autovacuum is needed
      const totalTuples = stats.liveTuples + stats.deadTuples;
      if (totalTuples > 0 && stats.deadTuples / totalTuples > this.AUTOVACUUM_THRESHOLD) {
        // Trigger autovacuum
        this.runVacuum(table.schema || 'public', table.name, true);
      }
    }
  }

  /**
   * Run vacuum operation
   */
  private runVacuum(schema: string, table: string, isAutovacuum: boolean): void {
    const key = `${schema}.${table}`;
    const stats = this.tableStatistics.get(key);
    if (!stats) {
      return;
    }

    const vacuumId = `vacuum_${++this.vacuumCounter}_${Date.now()}`;
    const vacuum: VacuumOperation = {
      id: vacuumId,
      table,
      schema,
      type: isAutovacuum ? 'AUTOVACUUM' : 'VACUUM',
      startedAt: Date.now(),
      deadTuplesRemoved: stats.deadTuples,
      pagesReclaimed: Math.floor(stats.deadTuples / 100), // Rough estimate
    };

    // Simulate vacuum duration (simplified)
    setTimeout(() => {
      vacuum.completedAt = Date.now();
      stats.deadTuples = 0;
      stats.lastAutoVacuum = vacuum.completedAt;
      this.tableStatistics.set(key, stats);
    }, 1000); // 1 second vacuum time

    this.vacuumOperations.push(vacuum);

    // Keep only recent vacuum operations
    if (this.vacuumOperations.length > 100) {
      this.vacuumOperations.shift();
    }
  }

  /**
   * Clean up old transactions
   */
  private cleanupTransactions(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    for (const [id, txn] of this.transactions.entries()) {
      if (now - txn.startedAt > maxAge && txn.status === 'active') {
        // Auto-rollback old transactions
        txn.status = 'rolled_back';
        this.transactions.delete(id);
      }
    }
  }

  /**
   * Get current metrics
   */
  public getMetrics(): PostgreSQLMetrics {
    const now = Date.now();
    const poolMetrics = this.connectionPool.getMetrics();

    // Calculate query metrics from history
    const recentQueries = this.queryHistory.filter(
      q => now - q.timestamp < 60000 // Last minute
    );
    const queriesLastSecond = this.queryHistory.filter(
      q => now - q.timestamp < 1000
    ).length;

    const successfulQueries = recentQueries.filter(q => q.success);
    const queryTimes = successfulQueries.map(q => q.duration).sort((a, b) => a - b);
    const slowQueries = successfulQueries.filter(q => q.duration > 1000).length;

    const averageQueryTime = queryTimes.length > 0
      ? queryTimes.reduce((sum, t) => sum + t, 0) / queryTimes.length
      : 0;

    const p50 = queryTimes.length > 0
      ? queryTimes[Math.floor(queryTimes.length * 0.5)]
      : 0;
    const p95 = queryTimes.length > 0
      ? queryTimes[Math.floor(queryTimes.length * 0.95)]
      : 0;
    const p99 = queryTimes.length > 0
      ? queryTimes[Math.floor(queryTimes.length * 0.99)]
      : 0;

    // Calculate transaction metrics
    const recentTransactions = Array.from(this.transactions.values()).filter(
      t => now - t.startedAt < 60000
    );
    const commits = recentTransactions.filter(t => t.status === 'committed').length;
    const rollbacks = recentTransactions.filter(t => t.status === 'rolled_back').length;
    const transactionsPerSecond = recentTransactions.length / 60;

    // Calculate table metrics
    let totalRows = 0;
    let totalDeadTuples = 0;
    let totalLiveTuples = 0;
    let seqScans = 0;
    let indexScans = 0;

    for (const stats of this.tableStatistics.values()) {
      totalRows += stats.liveTuples;
      totalDeadTuples += stats.deadTuples;
      totalLiveTuples += stats.liveTuples;
      seqScans += stats.seqScans;
      indexScans += stats.indexScans;
    }

    // Calculate bloat ratio
    const totalTuples = totalLiveTuples + totalDeadTuples;
    const bloatRatio = totalTuples > 0 ? totalDeadTuples / totalTuples : 0;

    // Calculate cache hit ratio (simplified - based on index usage)
    const totalScans = seqScans + indexScans;
    const cacheHitRatio = totalScans > 0 ? indexScans / totalScans : 0.95; // Default high cache hit
    const indexCacheHitRatio = cacheHitRatio; // Simplified

    // Calculate database size
    let databaseSize = 0;
    for (const stats of this.tableStatistics.values()) {
      databaseSize += stats.tableSize;
    }

    // Calculate vacuum metrics
    const runningVacuum = this.vacuumOperations.filter(
      v => !v.completedAt
    ).length;
    const vacuumLastHour = this.vacuumOperations.filter(
      v => v.completedAt && now - v.completedAt < 3600000
    ).length;
    const lastVacuum = this.vacuumOperations
      .filter(v => v.completedAt)
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))[0];
    const lastVacuumTime = lastVacuum?.completedAt || 0;

    // Calculate lock metrics
    const activeLocks = this.locks.size;
    let blockedQueries = 0;
    for (const lock of this.locks.values()) {
      blockedQueries += lock.waitingQueries.length;
    }

    // Top queries
    const queryCounts = new Map<string, { sql: string; calls: number; totalTime: number; times: number[] }>();
    for (const query of recentQueries) {
      const normalized = this.normalizeSQL(query.sql);
      const existing = queryCounts.get(normalized);
      if (existing) {
        existing.calls++;
        existing.totalTime += query.duration;
        existing.times.push(query.duration);
      } else {
        queryCounts.set(normalized, {
          sql: query.sql,
          calls: 1,
          totalTime: query.duration,
          times: [query.duration],
        });
      }
    }

    const topQueries = Array.from(queryCounts.values())
      .map(q => ({
        sql: q.sql,
        calls: q.calls,
        totalTime: q.totalTime,
        meanTime: q.totalTime / q.calls,
        minTime: Math.min(...q.times),
        maxTime: Math.max(...q.times),
      }))
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, 10);

    // Calculate error metrics
    const failedQueries = recentQueries.filter(q => !q.success).length;
    const errorRate = recentQueries.length > 0 ? failedQueries / recentQueries.length : 0;
    const connectionErrors = poolMetrics.waitingConnections > 0 ? 1 : 0; // Simplified
    const queryErrors = failedQueries;

    // Count indexes
    let totalIndexes = 0;
    if (Array.isArray(this.config.tables)) {
      for (const table of this.config.tables) {
        if (Array.isArray(table.indexes)) {
          totalIndexes += table.indexes.length;
        }
      }
    }

    return {
      // Connection metrics
      activeConnections: poolMetrics.activeConnections,
      idleConnections: poolMetrics.idleConnections,
      waitingConnections: poolMetrics.waitingConnections,
      totalConnections: poolMetrics.totalConnections,
      maxConnections: this.config.maxConnections || 100,
      connectionUtilization: poolMetrics.utilization,

      // Query metrics
      queriesPerSecond: queriesLastSecond,
      totalQueries: this.queryHistory.length,
      averageQueryTime,
      p50QueryTime: p50,
      p95QueryTime: p95,
      p99QueryTime: p99,
      slowQueries,
      topQueries: topQueries.length > 0 ? topQueries : undefined,

      // Database metrics
      transactionsPerSecond,
      commitsPerSecond: commits / 60,
      rollbacksPerSecond: rollbacks / 60,
      databaseSize,
      bloatRatio,

      // Table metrics
      totalTables: this.config.tables?.length || 0,
      totalRows,
      totalIndexes,
      seqScansPerSecond: seqScans / 60,
      indexScansPerSecond: indexScans / 60,
      deadTuples: totalDeadTuples,
      liveTuples: totalLiveTuples,

      // Cache metrics
      cacheHitRatio,
      indexCacheHitRatio,

      // WAL metrics
      walWritten: this.walStats.walWrittenPerSecond,
      walArchived: this.walStats.walArchivedPerSecond,
      checkpointFrequency: this.walStats.checkpointFrequency,

      // Vacuum metrics
      autovacuumRunning: runningVacuum,
      vacuumOperationsPerHour: vacuumLastHour,
      lastVacuumTime,

      // Lock metrics
      activeLocks,
      blockedQueries,
      lockWaitTime: activeLocks > 0 ? 100 : 0, // Simplified

      // Replication metrics (not implemented yet)
      replicationLag: 0,
      replicationStatus: 'inactive',

      // Error metrics
      errorRate,
      connectionErrors,
      queryErrors,
    };
  }

  /**
   * Normalize SQL for grouping similar queries
   */
  private normalizeSQL(sql: string): string {
    // Simple normalization - replace literals with placeholders
    return sql
      .replace(/\d+/g, '?')
      .replace(/'[^']*'/g, "'?'")
      .replace(/"[^"]*"/g, '"?"')
      .trim();
  }

  /**
   * Get active connections
   */
  public getActiveConnections(): ConnectionState[] {
    return this.connectionPool.getAllConnections();
  }

  /**
   * Get tables
   */
  public getTables(): PostgreSQLTable[] {
    return Array.isArray(this.config.tables) ? this.config.tables : [];
  }

  /**
   * Get views
   */
  public getViews(): PostgreSQLView[] {
    return Array.isArray(this.config.views) ? this.config.views : [];
  }

  /**
   * Get schemas
   */
  public getSchemas(): PostgreSQLSchema[] {
    return Array.isArray(this.config.schemas) ? this.config.schemas : [];
  }

  /**
   * Get roles
   */
  public getRoles(): Role[] {
    return Array.isArray(this.config.roles) ? this.config.roles : [];
  }

  /**
   * Get query history
   */
  public getQueryHistory(limit: number = 100): QueryHistoryEntry[] {
    return this.queryHistory.slice(-limit);
  }

  /**
   * Get table statistics
   */
  public getTableStatistics(): Map<string, TableStatistics> {
    return new Map(this.tableStatistics);
  }
}

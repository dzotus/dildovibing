/**
 * Connection Pool Manager for PostgreSQL
 * Simulates connection pooling behavior similar to PgBouncer or built-in PostgreSQL pooler
 */

export interface ConnectionState {
  id: string;
  status: 'idle' | 'active' | 'waiting' | 'terminated';
  createdAt: number;
  lastActivity: number;
  queryCount: number;
  currentQuery?: string;
}

export interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections?: number;
  idleTimeout?: number; // ms
  maxLifetime?: number; // ms
  connectionTimeout?: number; // ms
}

export interface ConnectionPoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  utilization: number; // 0-1
  averageQueryTime: number; // ms
  queriesPerSecond: number;
  connectionWaitTime: number; // ms
}

/**
 * Connection Pool Manager
 * Manages database connections and simulates pooling behavior
 */
export class PostgreSQLConnectionPool {
  private connections: Map<string, ConnectionState> = new Map();
  private config: ConnectionPoolConfig;
  private connectionCounter = 0;
  private queryHistory: Array<{ timestamp: number; duration: number }> = [];
  private readonly MAX_HISTORY = 1000;

  constructor(config: ConnectionPoolConfig) {
    this.config = {
      maxConnections: config.maxConnections || 100,
      minConnections: config.minConnections || 0,
      idleTimeout: config.idleTimeout || 300000, // 5 minutes
      maxLifetime: config.maxLifetime || 3600000, // 1 hour
      connectionTimeout: config.connectionTimeout || 5000, // 5 seconds
    };
  }

  /**
   * Acquire a connection from the pool
   * Returns connection ID or null if pool is exhausted
   */
  acquireConnection(query?: string): string | null {
    const now = Date.now();

    // Clean up idle connections that exceeded timeout
    this.cleanupIdleConnections(now);

    // Try to find an idle connection
    for (const [id, conn] of this.connections.entries()) {
      if (conn.status === 'idle') {
        // Reuse idle connection
        conn.status = 'active';
        conn.lastActivity = now;
        conn.currentQuery = query;
        conn.queryCount++;
        return id;
      }
    }

    // Check if we can create a new connection
    if (this.connections.size < this.config.maxConnections) {
      const newId = this.createConnection(query, now);
      return newId;
    }

    // Pool is exhausted - connection would wait
    // In real scenario, this would block or timeout
    return null;
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(connectionId: string, queryDuration?: number): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    conn.status = 'idle';
    conn.lastActivity = Date.now();
    conn.currentQuery = undefined;

    // Record query duration for metrics
    if (queryDuration !== undefined) {
      this.recordQuery(queryDuration);
    }
  }

  /**
   * Terminate a connection
   */
  terminateConnection(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    conn.status = 'terminated';
    this.connections.delete(connectionId);
  }

  /**
   * Create a new connection
   */
  private createConnection(query: string | undefined, timestamp: number): string {
    const id = `conn_${++this.connectionCounter}_${timestamp}`;
    const conn: ConnectionState = {
      id,
      status: 'active',
      createdAt: timestamp,
      lastActivity: timestamp,
      queryCount: 1,
      currentQuery: query,
    };
    this.connections.set(id, conn);
    return id;
  }

  /**
   * Clean up idle connections that exceeded timeout
   */
  private cleanupIdleConnections(now: number): void {
    const toRemove: string[] = [];

    for (const [id, conn] of this.connections.entries()) {
      if (conn.status === 'idle') {
        // Check idle timeout
        if (now - conn.lastActivity > this.config.idleTimeout!) {
          toRemove.push(id);
        }
        // Check max lifetime
        else if (now - conn.createdAt > this.config.maxLifetime!) {
          toRemove.push(id);
        }
      }
    }

    for (const id of toRemove) {
      this.connections.delete(id);
    }
  }

  /**
   * Record query execution time
   */
  private recordQuery(duration: number): void {
    const now = Date.now();
    this.queryHistory.push({ timestamp: now, duration });

    // Keep only recent history
    if (this.queryHistory.length > this.MAX_HISTORY) {
      this.queryHistory.shift();
    }
  }

  /**
   * Get current pool metrics
   */
  getMetrics(): ConnectionPoolMetrics {
    const now = Date.now();
    let active = 0;
    let idle = 0;
    let waiting = 0;

    for (const conn of this.connections.values()) {
      switch (conn.status) {
        case 'active':
          active++;
          break;
        case 'idle':
          idle++;
          break;
        case 'waiting':
          waiting++;
          break;
      }
    }

    const total = this.connections.size;
    const utilization = total > 0 ? active / this.config.maxConnections : 0;

    // Calculate average query time from recent history
    const recentQueries = this.queryHistory.filter(
      (q) => now - q.timestamp < 60000 // Last minute
    );
    const averageQueryTime =
      recentQueries.length > 0
        ? recentQueries.reduce((sum, q) => sum + q.duration, 0) / recentQueries.length
        : 0;

    // Calculate queries per second
    const queriesLastSecond = this.queryHistory.filter(
      (q) => now - q.timestamp < 1000
    ).length;
    const queriesPerSecond = queriesLastSecond;

    // Estimate connection wait time (simplified)
    // If pool is full, connections would wait
    const connectionWaitTime =
      total >= this.config.maxConnections ? this.config.connectionTimeout! / 2 : 0;

    return {
      totalConnections: total,
      activeConnections: active,
      idleConnections: idle,
      waitingConnections: waiting,
      utilization,
      averageQueryTime,
      queriesPerSecond,
      connectionWaitTime,
    };
  }

  /**
   * Get connection state by ID
   */
  getConnection(connectionId: string): ConnectionState | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections
   */
  getAllConnections(): ConnectionState[] {
    return Array.from(this.connections.values());
  }

  /**
   * Update connection pool configuration
   */
  updateConfig(config: Partial<ConnectionPoolConfig>): void {
    this.config = { ...this.config, ...config };

    // If max connections decreased, terminate excess connections
    if (config.maxConnections !== undefined && config.maxConnections < this.connections.size) {
      const excess = this.connections.size - config.maxConnections;
      const idleConnections = Array.from(this.connections.entries())
        .filter(([_, conn]) => conn.status === 'idle')
        .slice(0, excess);

      for (const [id] of idleConnections) {
        this.terminateConnection(id);
      }
    }
  }

  /**
   * Reset pool (terminate all connections)
   */
  reset(): void {
    this.connections.clear();
    this.connectionCounter = 0;
    this.queryHistory = [];
  }
}


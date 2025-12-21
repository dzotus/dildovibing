/**
 * Cassandra Routing Engine
 * Handles CQL operations, keyspace/table management, consistency levels, and cluster metrics
 */

export type ConsistencyLevel = 'ONE' | 'TWO' | 'THREE' | 'QUORUM' | 'ALL' | 'LOCAL_ONE' | 'LOCAL_QUORUM' | 'EACH_QUORUM' | 'SERIAL' | 'LOCAL_SERIAL';

export interface CassandraNode {
  address: string;
  status: 'up' | 'down';
  load: number;
  tokens: number;
}

export interface Keyspace {
  name: string;
  replication: number;
  replicationStrategy?: 'SimpleStrategy' | 'NetworkTopologyStrategy';
  tables: number;
  size: number;
  durableWrites?: boolean;
}

export interface TableColumn {
  name: string;
  type: string;
  primaryKey?: boolean;
}

export interface Table {
  name: string;
  keyspace: string;
  columns?: TableColumn[];
  rows?: number;
  size?: number;
}

export interface TableRow {
  [columnName: string]: any;
}

export interface CassandraConfig {
  clusterName?: string;
  nodes?: CassandraNode[];
  keyspaces?: Keyspace[];
  tables?: Table[];
  defaultConsistencyLevel?: ConsistencyLevel;
  defaultReplicationFactor?: number;
  enableCompaction?: boolean;
  compactionStrategy?: string;
  datacenter?: string;
}

export interface CQLResult {
  success: boolean;
  latency?: number;
  consistency?: string;
  rows?: any[];
  rowCount?: number;
  replicasQueried?: number;
  error?: string;
}

export interface CassandraMetrics {
  readLatency: number;
  writeLatency: number;
  totalNodes: number;
  healthyNodes: number;
  totalKeyspaces: number;
  totalTables: number;
  totalRows: number;
  totalSize: number;
  readOperationsPerSecond: number;
  writeOperationsPerSecond: number;
  readConsistencyViolations: number;
  writeConsistencyViolations: number;
  pendingCompactions: number;
  hintedHandoffs: number;
}

/**
 * Cassandra Routing Engine
 * Simulates Cassandra database behavior
 */
export class CassandraRoutingEngine {
  private clusterName: string = 'archiphoenix-cluster';
  private nodes: Map<string, CassandraNode> = new Map();
  private keyspaces: Map<string, Keyspace> = new Map();
  private tables: Map<string, Table> = new Map(); // key: "keyspace.table"
  private tableData: Map<string, TableRow[]> = new Map(); // key: "keyspace.table"
  private defaultConsistencyLevel: ConsistencyLevel = 'QUORUM';
  private defaultReplicationFactor: number = 3;
  private enableCompaction: boolean = true;
  private compactionStrategy: string = 'SizeTieredCompactionStrategy';
  private datacenter: string = 'dc1';

  // Metrics
  private metrics: CassandraMetrics = {
    readLatency: 5,
    writeLatency: 10,
    totalNodes: 0,
    healthyNodes: 0,
    totalKeyspaces: 0,
    totalTables: 0,
    totalRows: 0,
    totalSize: 0,
    readOperationsPerSecond: 0,
    writeOperationsPerSecond: 0,
    readConsistencyViolations: 0,
    writeConsistencyViolations: 0,
    pendingCompactions: 0,
    hintedHandoffs: 0,
  };

  // Operation tracking for metrics
  private readOperations: Array<{ timestamp: number; latency: number; violated: boolean }> = [];
  private writeOperations: Array<{ timestamp: number; latency: number; violated: boolean }> = [];
  private lastMetricsUpdate: number = Date.now();

  /**
   * Initialize with Cassandra configuration
   */
  public initialize(config: CassandraConfig): void {
    this.clusterName = config.clusterName || 'archiphoenix-cluster';
    this.defaultConsistencyLevel = (config.defaultConsistencyLevel as ConsistencyLevel) || 'QUORUM';
    this.defaultReplicationFactor = config.defaultReplicationFactor || 3;
    this.enableCompaction = config.enableCompaction ?? true;
    this.compactionStrategy = config.compactionStrategy || 'SizeTieredCompactionStrategy';
    this.datacenter = config.datacenter || 'dc1';

    // Initialize nodes
    this.nodes.clear();
    if (config.nodes) {
      for (const node of config.nodes) {
        this.nodes.set(node.address, { ...node });
      }
    } else {
      // Default node
      this.nodes.set('localhost:9042', {
        address: 'localhost:9042',
        status: 'up',
        load: 0.5,
        tokens: 256,
      });
    }

    // Initialize keyspaces
    this.keyspaces.clear();
    if (config.keyspaces) {
      for (const keyspace of config.keyspaces) {
        this.keyspaces.set(keyspace.name, { ...keyspace });
      }
    } else {
      // Default system keyspace
      this.keyspaces.set('system', {
        name: 'system',
        replication: 3,
        replicationStrategy: 'NetworkTopologyStrategy',
        tables: 0,
        size: 0,
        durableWrites: true,
      });
    }

    // Initialize tables
    this.tables.clear();
    this.tableData.clear();
    if (config.tables) {
      for (const table of config.tables) {
        const tableKey = `${table.keyspace}.${table.name}`;
        this.tables.set(tableKey, { ...table });
        this.tableData.set(tableKey, []);
      }
    }

    this.updateMetrics();
  }

  /**
   * Sync configuration from UI with runtime state
   */
  public syncFromConfig(config: Partial<CassandraConfig>): void {
    if (config.clusterName) {
      this.clusterName = config.clusterName;
    }

    if (config.defaultConsistencyLevel) {
      this.defaultConsistencyLevel = config.defaultConsistencyLevel as ConsistencyLevel;
    }

    if (config.defaultReplicationFactor !== undefined) {
      this.defaultReplicationFactor = config.defaultReplicationFactor;
    }

    if (config.nodes) {
      // Update existing nodes, add new ones
      for (const node of config.nodes) {
        this.nodes.set(node.address, { ...node });
      }
      // Remove nodes that are no longer in config (optional - for safety we keep them)
    }

    if (config.keyspaces) {
      // Update keyspaces from config
      const existingKeyspaces = new Set(this.keyspaces.keys());
      for (const keyspace of config.keyspaces) {
        this.keyspaces.set(keyspace.name, {
          ...keyspace,
          tables: this.countTablesInKeyspace(keyspace.name),
        });
      }
    }

    if (config.tables) {
      // Update tables from config
      for (const table of config.tables) {
        const tableKey = `${table.keyspace}.${table.name}`;
        const existingTable = this.tables.get(tableKey);
        
        if (existingTable) {
          // Update existing table metadata, preserve rows and size from runtime
          const currentRows = this.tableData.get(tableKey) || [];
          this.tables.set(tableKey, {
            ...table,
            rows: existingTable.rows || currentRows.length || 0,
            size: existingTable.size || (currentRows.length * 1024) || 0,
          });
        } else {
          // New table - initialize empty
          this.tables.set(tableKey, { ...table, rows: 0, size: 0 });
          if (!this.tableData.has(tableKey)) {
            this.tableData.set(tableKey, []);
          }
        }
      }
    }

    this.updateMetrics();
  }

  /**
   * Execute CQL query
   */
  public executeCQL(cqlQuery: string, consistencyLevel?: ConsistencyLevel): CQLResult {
    const startTime = Date.now();
    const consistency = consistencyLevel || this.defaultConsistencyLevel;
    
    try {
      // Normalize query
      const normalizedQuery = cqlQuery.trim().replace(/\s+/g, ' ');
      const upperQuery = normalizedQuery.toUpperCase();

      // Parse and execute based on query type
      if (upperQuery.startsWith('SELECT')) {
        return this.executeSelect(normalizedQuery, consistency, startTime);
      } else if (upperQuery.startsWith('INSERT')) {
        return this.executeInsert(normalizedQuery, consistency, startTime);
      } else if (upperQuery.startsWith('UPDATE')) {
        return this.executeUpdate(normalizedQuery, consistency, startTime);
      } else if (upperQuery.startsWith('DELETE')) {
        return this.executeDelete(normalizedQuery, consistency, startTime);
      } else if (upperQuery.startsWith('CREATE KEYSPACE')) {
        return this.executeCreateKeyspace(normalizedQuery, startTime);
      } else if (upperQuery.startsWith('CREATE TABLE')) {
        return this.executeCreateTable(normalizedQuery, startTime);
      } else if (upperQuery.startsWith('DROP TABLE')) {
        return this.executeDropTable(normalizedQuery, startTime);
      } else if (upperQuery.startsWith('DROP KEYSPACE')) {
        return this.executeDropKeyspace(normalizedQuery, startTime);
      } else {
        return {
          success: false,
          error: `Unsupported CQL statement: ${normalizedQuery}`,
          latency: Date.now() - startTime,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute SELECT query
   */
  private executeSelect(query: string, consistency: ConsistencyLevel, startTime: number): CQLResult {
    // Simple SELECT parsing: SELECT * FROM keyspace.table [WHERE ...] [LIMIT n]
    const fromMatch = query.match(/FROM\s+([\w.]+)/i);
    if (!fromMatch) {
      return {
        success: false,
        error: 'Invalid SELECT query: missing FROM clause',
        latency: Date.now() - startTime,
      };
    }

    const tableName = fromMatch[1].trim();
    const tableKey = this.normalizeTableKey(tableName);
    
    const table = this.tables.get(tableKey);
    if (!table) {
      return {
        success: false,
        error: `Table ${tableName} does not exist`,
        latency: Date.now() - startTime,
      };
    }

    const rows = this.tableData.get(tableKey) || [];
    
    // Parse LIMIT
    const limitMatch = query.match(/LIMIT\s+(\d+)/i);
    const limit = limitMatch ? parseInt(limitMatch[1], 10) : undefined;

    // Simple WHERE parsing (basic equality only)
    let filteredRows = [...rows];
    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+LIMIT|$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1].trim();
      // Simple equality: column = value
      const eqMatch = whereClause.match(/(\w+)\s*=\s*['"]?([^'"\s]+)['"]?/);
      if (eqMatch) {
        const column = eqMatch[1];
        const value = eqMatch[2];
        filteredRows = rows.filter(row => String(row[column]) === value);
      }
    }

    // Apply LIMIT
    if (limit !== undefined && limit > 0) {
      filteredRows = filteredRows.slice(0, limit);
    }

    const latency = this.calculateReadLatency(consistency);
    const violated = this.checkConsistencyViolation(consistency, table.keyspace);
    this.recordReadOperation(latency, violated);

    const replicasQueried = this.getRequiredReplicas(consistency, table.keyspace);

    return {
      success: true,
      latency,
      consistency,
      rows: filteredRows,
      rowCount: filteredRows.length,
      replicasQueried,
    };
  }

  /**
   * Execute INSERT query
   */
  private executeInsert(query: string, consistency: ConsistencyLevel, startTime: number): CQLResult {
    // Simple INSERT parsing: INSERT INTO keyspace.table (col1, col2) VALUES (val1, val2)
    const intoMatch = query.match(/INTO\s+([\w.]+)/i);
    if (!intoMatch) {
      return {
        success: false,
        error: 'Invalid INSERT query: missing INTO clause',
        latency: Date.now() - startTime,
      };
    }

    const tableName = intoMatch[1].trim();
    const tableKey = this.normalizeTableKey(tableName);
    
    let table = this.tables.get(tableKey);
    if (!table) {
      return {
        success: false,
        error: `Table ${tableName} does not exist`,
        latency: Date.now() - startTime,
      };
    }

    // Parse columns and values
    const columnsMatch = query.match(/\(([^)]+)\)\s*VALUES/i);
    const valuesMatch = query.match(/VALUES\s*\(([^)]+)\)/i);
    
    if (!columnsMatch || !valuesMatch) {
      return {
        success: false,
        error: 'Invalid INSERT query: missing columns or values',
        latency: Date.now() - startTime,
      };
    }

    const columns = columnsMatch[1].split(',').map(c => c.trim());
    const valuesStr = valuesMatch[1];
    
    // Parse values (handle quoted strings and numbers)
    const values = this.parseValueList(valuesStr);

    if (columns.length !== values.length) {
      return {
        success: false,
        error: 'Column count does not match value count',
        latency: Date.now() - startTime,
      };
    }

    // Create row object
    const row: TableRow = {};
    for (let i = 0; i < columns.length; i++) {
      row[columns[i]] = values[i];
    }

    // Add row to table
    const rows = this.tableData.get(tableKey) || [];
    rows.push(row);
    this.tableData.set(tableKey, rows);

    // Update table metadata
    table.rows = rows.length;
    // Estimate size: ~1KB per row
    table.size = rows.length * 1024;
    this.tables.set(tableKey, table);

    const latency = this.calculateWriteLatency(consistency, table.keyspace);
    const violated = this.checkConsistencyViolation(consistency, table.keyspace);
    this.recordWriteOperation(latency, violated);

    const replicasQueried = this.getRequiredReplicas(consistency, table.keyspace);

    this.updateMetrics();
    return {
      success: true,
      latency,
      consistency,
      rowCount: 1,
      replicasQueried,
    };
  }

  /**
   * Execute UPDATE query
   */
  private executeUpdate(query: string, consistency: ConsistencyLevel, startTime: number): CQLResult {
    // Simple UPDATE parsing: UPDATE keyspace.table SET col1=val1, col2=val2 WHERE ...
    const updateMatch = query.match(/UPDATE\s+([\w.]+)\s+SET/i);
    if (!updateMatch) {
      return {
        success: false,
        error: 'Invalid UPDATE query',
        latency: Date.now() - startTime,
      };
    }

    const tableName = updateMatch[1].trim();
    const tableKey = this.normalizeTableKey(tableName);
    
    const table = this.tables.get(tableKey);
    if (!table) {
      return {
        success: false,
        error: `Table ${tableName} does not exist`,
        latency: Date.now() - startTime,
      };
    }

    // Parse SET clause
    const setMatch = query.match(/SET\s+(.+?)(?:\s+WHERE|$)/i);
    if (!setMatch) {
      return {
        success: false,
        error: 'Invalid UPDATE query: missing SET clause',
        latency: Date.now() - startTime,
      };
    }

    const setClause = setMatch[1].trim();
    const updates: Record<string, any> = {};
    
    // Parse key=value pairs
    const pairs = setClause.split(',').map(p => p.trim());
    for (const pair of pairs) {
      const eqMatch = pair.match(/(\w+)\s*=\s*(.+)/);
      if (eqMatch) {
        const key = eqMatch[1].trim();
        const value = this.parseValue(eqMatch[2].trim());
        updates[key] = value;
      }
    }

    // Parse WHERE clause
    const whereMatch = query.match(/WHERE\s+(.+)/i);
    if (!whereMatch) {
      return {
        success: false,
        error: 'UPDATE requires WHERE clause',
        latency: Date.now() - startTime,
      };
    }

    const whereClause = whereMatch[1].trim();
    const eqMatch = whereClause.match(/(\w+)\s*=\s*['"]?([^'"\s]+)['"]?/);
    if (!eqMatch) {
      return {
        success: false,
        error: 'Unsupported WHERE clause format',
        latency: Date.now() - startTime,
      };
    }

    const whereColumn = eqMatch[1];
    const whereValue = eqMatch[2];

    // Update matching rows
    const rows = this.tableData.get(tableKey) || [];
    let updatedCount = 0;
    for (const row of rows) {
      if (String(row[whereColumn]) === whereValue) {
        Object.assign(row, updates);
        updatedCount++;
      }
    }

    // Update table metadata
    table.rows = rows.length;
    table.size = rows.length * 1024;
    this.tables.set(tableKey, table);

    const latency = this.calculateWriteLatency(consistency, table.keyspace);
    const violated = this.checkConsistencyViolation(consistency, table.keyspace);
    this.recordWriteOperation(latency, violated);

    const replicasQueried = this.getRequiredReplicas(consistency, table.keyspace);

    this.updateMetrics();
    return {
      success: true,
      latency,
      consistency,
      rowCount: updatedCount,
      replicasQueried,
    };
  }

  /**
   * Execute DELETE query
   */
  private executeDelete(query: string, consistency: ConsistencyLevel, startTime: number): CQLResult {
    // Simple DELETE parsing: DELETE FROM keyspace.table WHERE ...
    const fromMatch = query.match(/FROM\s+([\w.]+)/i);
    if (!fromMatch) {
      return {
        success: false,
        error: 'Invalid DELETE query: missing FROM clause',
        latency: Date.now() - startTime,
      };
    }

    const tableName = fromMatch[1].trim();
    const tableKey = this.normalizeTableKey(tableName);
    
    const table = this.tables.get(tableKey);
    if (!table) {
      return {
        success: false,
        error: `Table ${tableName} does not exist`,
        latency: Date.now() - startTime,
      };
    }

    // Parse WHERE clause
    const whereMatch = query.match(/WHERE\s+(.+)/i);
    if (!whereMatch) {
      return {
        success: false,
        error: 'DELETE requires WHERE clause',
        latency: Date.now() - startTime,
      };
    }

    const whereClause = whereMatch[1].trim();
    const eqMatch = whereClause.match(/(\w+)\s*=\s*['"]?([^'"\s]+)['"]?/);
    if (!eqMatch) {
      return {
        success: false,
        error: 'Unsupported WHERE clause format',
        latency: Date.now() - startTime,
      };
    }

    const whereColumn = eqMatch[1];
    const whereValue = eqMatch[2];

    // Delete matching rows
    const rows = this.tableData.get(tableKey) || [];
    const initialLength = rows.length;
    const filteredRows = rows.filter(row => String(row[whereColumn]) !== whereValue);
    this.tableData.set(tableKey, filteredRows);

    // Update table metadata
    table.rows = filteredRows.length;
    // Estimate size: ~1KB per row
    table.size = filteredRows.length * 1024;
    this.tables.set(tableKey, table);

    const deletedCount = initialLength - filteredRows.length;

    const latency = this.calculateWriteLatency(consistency, table.keyspace);
    const violated = this.checkConsistencyViolation(consistency, table.keyspace);
    this.recordWriteOperation(latency, violated);

    const replicasQueried = this.getRequiredReplicas(consistency, table.keyspace);

    this.updateMetrics();
    return {
      success: true,
      latency,
      consistency,
      rowCount: deletedCount,
      replicasQueried,
    };
  }

  /**
   * Execute CREATE KEYSPACE query
   */
  private executeCreateKeyspace(query: string, startTime: number): CQLResult {
    // Simple parsing: CREATE KEYSPACE name WITH replication = {...}
    const nameMatch = query.match(/KEYSPACE\s+(\w+)/i);
    if (!nameMatch) {
      return {
        success: false,
        error: 'Invalid CREATE KEYSPACE query',
        latency: Date.now() - startTime,
      };
    }

    const keyspaceName = nameMatch[1].trim();

    if (this.keyspaces.has(keyspaceName)) {
      return {
        success: false,
        error: `Keyspace ${keyspaceName} already exists`,
        latency: Date.now() - startTime,
      };
    }

    // Parse replication factor (simplified)
    let replication = this.defaultReplicationFactor;
    const replicationMatch = query.match(/replication.*?(\d+)/i);
    if (replicationMatch) {
      replication = parseInt(replicationMatch[1], 10);
    }

    this.keyspaces.set(keyspaceName, {
      name: keyspaceName,
      replication,
      replicationStrategy: 'NetworkTopologyStrategy',
      tables: 0,
      size: 0,
      durableWrites: true,
    });

    this.updateMetrics();
    return {
      success: true,
      latency: Date.now() - startTime,
      rowCount: 0,
    };
  }

  /**
   * Execute CREATE TABLE query
   */
  private executeCreateTable(query: string, startTime: number): CQLResult {
    // Simple parsing: CREATE TABLE keyspace.name (col1 type, col2 type, PRIMARY KEY(...))
    const tableMatch = query.match(/TABLE\s+([\w.]+)/i);
    if (!tableMatch) {
      return {
        success: false,
        error: 'Invalid CREATE TABLE query',
        latency: Date.now() - startTime,
      };
    }

    const tableName = tableMatch[1].trim();
    const tableKey = this.normalizeTableKey(tableName);
    
    if (this.tables.has(tableKey)) {
      return {
        success: false,
        error: `Table ${tableName} already exists`,
        latency: Date.now() - startTime,
      };
    }

    // Parse columns (simplified) - find column definitions before WITH clause
    // Extract everything between first ( and matching ) before WITH
    let queryWithoutWith = query;
    const withIndex = query.toUpperCase().indexOf(' WITH ');
    if (withIndex > 0) {
      queryWithoutWith = query.substring(0, withIndex);
    }
    
    const columnsMatch = queryWithoutWith.match(/\(([^)]+)\)/);
    if (!columnsMatch) {
      return {
        success: false,
        error: 'Invalid CREATE TABLE query: missing column definitions',
        latency: Date.now() - startTime,
      };
    }

    const columnsStr = columnsMatch[1];
    const columns: TableColumn[] = [];
    
    // Simple column parsing
    const columnParts = columnsStr.split(',').map(c => c.trim());
    for (const part of columnParts) {
      if (part.toUpperCase().includes('PRIMARY KEY')) continue;
      
      const colMatch = part.match(/(\w+)\s+(\w+)/);
      if (colMatch) {
        columns.push({
          name: colMatch[1],
          type: colMatch[2],
        });
      }
    }

    // Extract keyspace and table name
    const parts = tableName.split('.');
    const keyspace = parts.length > 1 ? parts[0] : 'system';
    const table = parts.length > 1 ? parts[1] : parts[0];

    if (!this.keyspaces.has(keyspace)) {
      return {
        success: false,
        error: `Keyspace ${keyspace} does not exist`,
        latency: Date.now() - startTime,
      };
    }

    const newTable: Table = {
      name: table,
      keyspace,
      columns,
      rows: 0,
      size: 0,
    };
    this.tables.set(tableKey, newTable);
    this.tableData.set(tableKey, []);

    // Update keyspace table count
    const ks = this.keyspaces.get(keyspace);
    if (ks) {
      ks.tables = this.countTablesInKeyspace(keyspace);
      this.keyspaces.set(keyspace, ks);
    }

    this.updateMetrics();
    return {
      success: true,
      latency: Date.now() - startTime,
      rowCount: 0,
    };
  }

  /**
   * Execute DROP TABLE query
   */
  private executeDropTable(query: string, startTime: number): CQLResult {
    const tableMatch = query.match(/TABLE\s+([\w.]+)/i);
    if (!tableMatch) {
      return {
        success: false,
        error: 'Invalid DROP TABLE query',
        latency: Date.now() - startTime,
      };
    }

    const tableName = tableMatch[1].trim();
    const tableKey = this.normalizeTableKey(tableName);
    
    if (!this.tables.has(tableKey)) {
      return {
        success: false,
        error: `Table ${tableName} does not exist`,
        latency: Date.now() - startTime,
      };
    }

    const table = this.tables.get(tableKey)!;
    this.tables.delete(tableKey);
    this.tableData.delete(tableKey);

    // Update keyspace table count
    const ks = this.keyspaces.get(table.keyspace);
    if (ks) {
      ks.tables = this.countTablesInKeyspace(table.keyspace);
      this.keyspaces.set(table.keyspace, ks);
    }

    this.updateMetrics();
    return {
      success: true,
      latency: Date.now() - startTime,
      rowCount: 0,
    };
  }

  /**
   * Execute DROP KEYSPACE query
   */
  private executeDropKeyspace(query: string, startTime: number): CQLResult {
    const nameMatch = query.match(/KEYSPACE\s+(\w+)/i);
    if (!nameMatch) {
      return {
        success: false,
        error: 'Invalid DROP KEYSPACE query',
        latency: Date.now() - startTime,
      };
    }

    const keyspaceName = nameMatch[1].trim();

    if (!this.keyspaces.has(keyspaceName)) {
      return {
        success: false,
        error: `Keyspace ${keyspaceName} does not exist`,
        latency: Date.now() - startTime,
      };
    }

    // Delete all tables in keyspace
    const tablesToDelete: string[] = [];
    for (const [tableKey, table] of this.tables.entries()) {
      if (table.keyspace === keyspaceName) {
        tablesToDelete.push(tableKey);
      }
    }

    for (const tableKey of tablesToDelete) {
      this.tables.delete(tableKey);
      this.tableData.delete(tableKey);
    }

    this.keyspaces.delete(keyspaceName);

    this.updateMetrics();
    return {
      success: true,
      latency: Date.now() - startTime,
      rowCount: 0,
    };
  }

  /**
   * Get all nodes
   */
  public getNodes(): CassandraNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all keyspaces
   */
  public getKeyspaces(): Keyspace[] {
    return Array.from(this.keyspaces.values());
  }

  /**
   * Get all tables
   */
  public getTables(): Table[] {
    return Array.from(this.tables.values());
  }

  /**
   * Get metrics
   */
  public getMetrics(): CassandraMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Calculate read latency based on consistency level
   */
  private calculateReadLatency(consistency: ConsistencyLevel): number {
    const baseLatency = 2; // ms base latency
    const replicasQueried = this.getRequiredReplicas(consistency, 'system');
    
    // More replicas = more latency, but not linear (parallel querying)
    const replicaLatency = Math.log(replicasQueried + 1) * 3;
    const networkLatency = Math.random() * 2; // 0-2ms network jitter
    
    return Math.round(baseLatency + replicaLatency + networkLatency);
  }

  /**
   * Calculate write latency based on consistency level
   */
  private calculateWriteLatency(consistency: ConsistencyLevel, keyspaceName: string): number {
    const baseLatency = 5; // ms base latency
    const replicasQueried = this.getRequiredReplicas(consistency, keyspaceName);
    
    // Write latency is typically higher and more linear
    const replicaLatency = replicasQueried * 2;
    const networkLatency = Math.random() * 3; // 0-3ms network jitter
    
    return Math.round(baseLatency + replicaLatency + networkLatency);
  }

  /**
   * Get required number of replicas for consistency level
   */
  private getRequiredReplicas(consistency: ConsistencyLevel, keyspaceName: string): number {
    const keyspace = this.keyspaces.get(keyspaceName);
    const replicationFactor = keyspace?.replication || this.defaultReplicationFactor;

    switch (consistency) {
      case 'ONE':
      case 'LOCAL_ONE':
        return 1;
      case 'TWO':
        return 2;
      case 'THREE':
        return 3;
      case 'QUORUM':
      case 'LOCAL_QUORUM':
        return Math.floor(replicationFactor / 2) + 1;
      case 'ALL':
      case 'EACH_QUORUM':
        return replicationFactor;
      case 'SERIAL':
      case 'LOCAL_SERIAL':
        return Math.floor(replicationFactor / 2) + 1;
      default:
        return Math.floor(replicationFactor / 2) + 1; // Default to QUORUM
    }
  }

  /**
   * Check if consistency violation occurred (simplified simulation)
   */
  private checkConsistencyViolation(consistency: ConsistencyLevel, keyspaceName: string): boolean {
    const healthyNodes = this.metrics.healthyNodes;
    const requiredReplicas = this.getRequiredReplicas(consistency, keyspaceName);
    
    // Violation occurs if we don't have enough healthy nodes
    const violationChance = healthyNodes < requiredReplicas ? 0.8 : 0.05;
    return Math.random() < violationChance;
  }

  /**
   * Record read operation for metrics
   */
  private recordReadOperation(latency: number, violated: boolean): void {
    const now = Date.now();
    this.readOperations.push({ timestamp: now, latency, violated });
    
    // Keep only last 1000 operations
    if (this.readOperations.length > 1000) {
      this.readOperations.shift();
    }

    if (violated) {
      this.metrics.readConsistencyViolations++;
    }
  }

  /**
   * Record write operation for metrics
   */
  private recordWriteOperation(latency: number, violated: boolean): void {
    const now = Date.now();
    this.writeOperations.push({ timestamp: now, latency, violated });
    
    // Keep only last 1000 operations
    if (this.writeOperations.length > 1000) {
      this.writeOperations.shift();
    }

    if (violated) {
      this.metrics.writeConsistencyViolations++;
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    const now = Date.now();
    const timeDelta = (now - this.lastMetricsUpdate) / 1000; // seconds

    // Node metrics
    this.metrics.totalNodes = this.nodes.size;
    this.metrics.healthyNodes = Array.from(this.nodes.values()).filter(n => n.status === 'up').length;

    // Keyspace and table metrics
    this.metrics.totalKeyspaces = this.keyspaces.size;
    this.metrics.totalTables = this.tables.size;

    // Count total rows and calculate size
    let totalRows = 0;
    let totalSize = 0;
    for (const [tableKey, rows] of this.tableData.entries()) {
      totalRows += rows.length;
      // Rough size estimation: assume 1KB per row
      totalSize += rows.length * 1024;
    }
    this.metrics.totalRows = totalRows;
    this.metrics.totalSize = totalSize;

    // Calculate read/write operations per second
    const oneSecondAgo = now - 1000;
    const recentReads = this.readOperations.filter(op => op.timestamp > oneSecondAgo);
    const recentWrites = this.writeOperations.filter(op => op.timestamp > oneSecondAgo);

    this.metrics.readOperationsPerSecond = recentReads.length;
    this.metrics.writeOperationsPerSecond = recentWrites.length;

    // Calculate average latencies
    if (recentReads.length > 0) {
      const avgReadLatency = recentReads.reduce((sum, op) => sum + op.latency, 0) / recentReads.length;
      this.metrics.readLatency = Math.round(avgReadLatency * 10) / 10;
    }

    if (recentWrites.length > 0) {
      const avgWriteLatency = recentWrites.reduce((sum, op) => sum + op.latency, 0) / recentWrites.length;
      this.metrics.writeLatency = Math.round(avgWriteLatency * 10) / 10;
    }

    // Read consistency violations are already counted in recordReadOperation
    // No need to recalculate here

    // Compaction simulation (increases with data size)
    this.metrics.pendingCompactions = Math.floor(this.metrics.totalSize / (10 * 1024 * 1024)); // 1 compaction per 10MB

    // Hinted handoffs (simulate based on unhealthy nodes)
    const unhealthyNodes = this.metrics.totalNodes - this.metrics.healthyNodes;
    this.metrics.hintedHandoffs = unhealthyNodes > 0 ? unhealthyNodes * 5 : 0;

    // Simulate node load changes based on operations
    const totalOpsPerSecond = this.metrics.readOperationsPerSecond + this.metrics.writeOperationsPerSecond;
    for (const node of this.nodes.values()) {
      if (node.status === 'up') {
        // Simulate load changes: increase with operations, decrease over time
        const targetLoad = Math.min(0.95, 0.3 + (totalOpsPerSecond / 100) * 0.3);
        // Smooth transition towards target load
        node.load = node.load * 0.9 + targetLoad * 0.1;
        // Add some randomness for realism
        node.load += (Math.random() - 0.5) * 0.05;
        node.load = Math.max(0.1, Math.min(0.95, node.load));
      }
    }

    this.lastMetricsUpdate = now;
  }

  /**
   * Count tables in a keyspace
   */
  private countTablesInKeyspace(keyspaceName: string): number {
    let count = 0;
    for (const table of this.tables.values()) {
      if (table.keyspace === keyspaceName) {
        count++;
      }
    }
    return count;
  }

  /**
   * Normalize table key (keyspace.table)
   */
  private normalizeTableKey(tableName: string): string {
    if (tableName.includes('.')) {
      return tableName;
    }
    // Default to 'system' keyspace if not specified
    return `system.${tableName}`;
  }

  /**
   * Parse value list from VALUES clause
   */
  private parseValueList(valuesStr: string): any[] {
    const values: any[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < valuesStr.length; i++) {
      const char = valuesStr[i];
      
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
        continue;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
        continue;
      }

      if (char === ',' && !inQuotes) {
        values.push(this.parseValue(current.trim()));
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      values.push(this.parseValue(current.trim()));
    }

    return values;
  }

  /**
   * Parse a single value (handle strings, numbers, null)
   */
  private parseValue(value: string): any {
    value = value.trim();
    
    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    // Try to parse as number
    if (/^-?\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    if (/^-?\d*\.\d+$/.test(value)) {
      return parseFloat(value);
    }

    // Boolean
    if (value.toUpperCase() === 'TRUE') return true;
    if (value.toUpperCase() === 'FALSE') return false;

    // Null
    if (value.toUpperCase() === 'NULL') return null;

    return value;
  }
}


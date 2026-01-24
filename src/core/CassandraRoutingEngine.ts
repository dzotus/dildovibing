/**
 * Cassandra Routing Engine
 * Handles CQL operations, keyspace/table management, consistency levels, and cluster metrics
 */

import { CassandraLatencyCalculator } from './cassandra/LatencyCalculator';
import { CassandraDataSizeCalculator } from './cassandra/DataSizeCalculator';
import { CassandraCompactionEngine, CompactionStrategy } from './cassandra/CompactionEngine';
import { ReplicaStateManager } from './cassandra/ReplicaStateManager';
import { CassandraTokenRing } from './cassandra/TokenRing';
import { createReplicationStrategy, ReplicationStrategy, ReplicationConfig } from './cassandra/ReplicationStrategy';
import { CassandraGossipEngine } from './cassandra/GossipEngine';
import { CassandraHintedHandoffManager } from './cassandra/HintedHandoffManager';
import { CQLParser, ParsedCQLQuery } from './cassandra/CQLParser';
import { TTLManager } from './cassandra/TTLManager';

export type ConsistencyLevel = 'ONE' | 'TWO' | 'THREE' | 'QUORUM' | 'ALL' | 'LOCAL_ONE' | 'LOCAL_QUORUM' | 'EACH_QUORUM' | 'SERIAL' | 'LOCAL_SERIAL';

export interface CassandraNode {
  address: string;
  status: 'up' | 'down';
  load: number;
  tokens: number;
  datacenter?: string;
  rack?: string;
}

export interface Keyspace {
  name: string;
  replication: number;
  replicationStrategy?: 'SimpleStrategy' | 'NetworkTopologyStrategy';
  datacenterReplication?: Record<string, number>; // For NetworkTopologyStrategy: { 'dc1': 3, 'dc2': 2 }
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
  applied?: boolean; // For lightweight transactions (IF EXISTS, IF NOT EXISTS)
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
  lightweightTransactionsTotal: number;
  lightweightTransactionsApplied: number;
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

  // New components for realistic simulation
  private latencyCalculator: CassandraLatencyCalculator;
  private dataSizeCalculator: CassandraDataSizeCalculator;
  private compactionEngine: CassandraCompactionEngine;
  private replicaStateManager: ReplicaStateManager;
  private tokenRing: CassandraTokenRing;
  private replicationStrategies: Map<string, ReplicationStrategy> = new Map();
  private gossipEngine: CassandraGossipEngine;
  private hintedHandoffManager: CassandraHintedHandoffManager;
  private ttlManager: TTLManager;
  private cqlParser: CQLParser;

  // Network latency map (can be populated from EmulationEngine)
  private networkLatencyMap: Map<string, number> = new Map();

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
    lightweightTransactionsTotal: 0,
    lightweightTransactionsApplied: 0,
  };

  // Operation tracking for metrics
  private readOperations: Array<{ timestamp: number; latency: number; violated: boolean }> = [];
  private writeOperations: Array<{ timestamp: number; latency: number; violated: boolean }> = [];
  private lastMetricsUpdate: number = Date.now();

  constructor() {
    // Initialize components
    this.latencyCalculator = new CassandraLatencyCalculator();
    this.dataSizeCalculator = new CassandraDataSizeCalculator();
    this.compactionEngine = new CassandraCompactionEngine();
    this.replicaStateManager = new ReplicaStateManager();
    this.tokenRing = new CassandraTokenRing();
    this.gossipEngine = new CassandraGossipEngine();
    this.hintedHandoffManager = new CassandraHintedHandoffManager();
    this.ttlManager = new TTLManager();
    this.cqlParser = new CQLParser();
  }

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

    // Initialize compaction engine with strategy
    this.compactionEngine.initialize(this.compactionStrategy as CompactionStrategy);

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
        datacenter: this.datacenter,
        rack: 'rack1',
      });
    }

    // Initialize token ring with nodes
    this.updateTokenRing();

    // Initialize gossip engine with nodes
    this.gossipEngine.initialize(this.nodes);

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

    if (config.compactionStrategy !== undefined) {
      this.compactionStrategy = config.compactionStrategy;
      this.compactionEngine.initialize(this.compactionStrategy as CompactionStrategy);
    }

    if (config.enableCompaction !== undefined) {
      this.enableCompaction = config.enableCompaction;
    }

    if (config.datacenter) {
      this.datacenter = config.datacenter;
    }

    if (config.nodes) {
      // Update existing nodes, add new ones
      for (const node of config.nodes) {
        this.nodes.set(node.address, { ...node });
      }
      // Remove nodes that are no longer in config (optional - for safety we keep them)
      // Update token ring when nodes change
      this.updateTokenRing();
      // Sync gossip engine with updated nodes
      this.gossipEngine.syncWithNodes(this.nodes);
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
      // Parse query using advanced parser
      const parsed = this.cqlParser.parse(cqlQuery);
      
      if (parsed.error) {
        return {
          success: false,
          error: parsed.error,
          latency: Date.now() - startTime,
        };
      }

      // Execute based on parsed query type
      switch (parsed.type) {
        case 'SELECT':
          return this.executeSelectFromParsed(parsed, consistency, startTime);
        case 'INSERT':
          return this.executeInsertFromParsed(parsed, consistency, startTime);
        case 'UPDATE':
          return this.executeUpdateFromParsed(parsed, consistency, startTime);
        case 'DELETE':
          return this.executeDeleteFromParsed(parsed, consistency, startTime);
        case 'CREATE_KEYSPACE':
          return this.executeCreateKeyspaceFromParsed(parsed, startTime);
        case 'CREATE_TABLE':
          return this.executeCreateTableFromParsed(parsed, startTime);
        case 'DROP_TABLE':
          return this.executeDropTableFromParsed(parsed, startTime);
        case 'DROP_KEYSPACE':
          return this.executeDropKeyspaceFromParsed(parsed, startTime);
        case 'BATCH':
          return this.executeBatchFromParsed(parsed, consistency, startTime);
        default:
          return {
            success: false,
            error: `Unsupported CQL statement: ${parsed.normalizedQuery}`,
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
   * Execute SELECT query from parsed CQL
   */
  private executeSelectFromParsed(parsed: ParsedCQLQuery, consistency: ConsistencyLevel, startTime: number): CQLResult {
    if (!parsed.fromTable) {
      return {
        success: false,
        error: 'Invalid SELECT query: missing FROM clause',
        latency: Date.now() - startTime,
      };
    }

    const tableKey = this.normalizeTableKey(parsed.fromTable);
    const table = this.tables.get(tableKey);
    if (!table) {
      return {
        success: false,
        error: `Table ${parsed.fromTable} does not exist`,
        latency: Date.now() - startTime,
      };
    }

    let rows = this.tableData.get(tableKey) || [];

    // Filter out expired rows (TTL) - expired rows should not be returned
    rows = rows.filter(row => {
      const rowKey = this.generateRowKey(tableKey, row);
      return !this.ttlManager.isExpired(rowKey);
    });

    // Apply WHERE clause filtering
    if (parsed.whereClause) {
      rows = this.applyWhereClause(rows, parsed.whereClause);
    }

    // Apply GROUP BY
    if (parsed.groupBy && parsed.groupBy.length > 0) {
      rows = this.applyGroupBy(rows, parsed.groupBy);
    }

    // Apply aggregate functions
    if (parsed.aggregateFunctions && parsed.aggregateFunctions.length > 0) {
      const aggregated = this.applyAggregateFunctions(rows, parsed.aggregateFunctions, parsed.groupBy);
      rows = aggregated;
    }

    // Apply ORDER BY
    if (parsed.orderBy && parsed.orderBy.length > 0) {
      rows = this.applyOrderBy(rows, parsed.orderBy);
    }

    // Apply LIMIT
    if (parsed.limit !== undefined && parsed.limit > 0) {
      rows = rows.slice(0, parsed.limit);
    }

    // Select specific columns
    if (parsed.selectColumns && !parsed.selectColumns.includes('*')) {
      rows = rows.map(row => {
        const selected: TableRow = {};
        for (const col of parsed.selectColumns!) {
          if (row.hasOwnProperty(col)) {
            selected[col] = row[col];
          }
        }
        return selected;
      });
    }

    // Get replica nodes for this keyspace
    const keyspace = this.keyspaces.get(table.keyspace);
    const replicationFactor = keyspace?.replication || this.defaultReplicationFactor;
    const replicaNodes = this.getReplicaNodes(table.keyspace, rows[0] || {});

    // Calculate latency using LatencyCalculator
    const latency = this.latencyCalculator.calculateReadLatency({
      consistency,
      replicationFactor,
      nodes: this.nodes,
      replicaNodes,
      operationType: 'read',
      datacenter: this.datacenter,
      networkLatencyMap: this.networkLatencyMap,
    });

    // Check consistency violation using ReplicaStateManager
    let violated = false;
    if (rows.length > 0) {
      const rowKey = this.generateRowKey(tableKey, rows[0]);
      violated = this.replicaStateManager.checkConsistencyViolation(
        rowKey,
        consistency,
        replicationFactor,
        this.nodes
      );

      // Perform read repair if violation detected
      if (violated) {
        this.replicaStateManager.performReadRepair(rowKey, this.nodes);
      }
    }

    this.recordReadOperation(latency, violated);

    const replicasQueried = this.getRequiredReplicas(consistency, table.keyspace);

    return {
      success: true,
      latency,
      consistency,
      rows,
      rowCount: rows.length,
      replicasQueried,
    };
  }

  /**
   * Execute SELECT query (legacy method for backward compatibility)
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

    let rows = this.tableData.get(tableKey) || [];
    
    // Filter out expired rows (TTL) - expired rows should not be returned
    rows = rows.filter(row => {
      const rowKey = this.generateRowKey(tableKey, row);
      return !this.ttlManager.isExpired(rowKey);
    });
    
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

    // Get replica nodes for this keyspace
    const keyspace = this.keyspaces.get(table.keyspace);
    const replicationFactor = keyspace?.replication || this.defaultReplicationFactor;
    const replicaNodes = this.getReplicaNodes(table.keyspace, filteredRows[0] || {});

    // Calculate latency using LatencyCalculator
    const latency = this.latencyCalculator.calculateReadLatency({
      consistency,
      replicationFactor,
      nodes: this.nodes,
      replicaNodes,
      operationType: 'read',
      datacenter: this.datacenter,
      networkLatencyMap: this.networkLatencyMap,
    });

    // Check consistency violation using ReplicaStateManager
    let violated = false;
    if (filteredRows.length > 0) {
      const rowKey = this.generateRowKey(tableKey, filteredRows[0]);
      violated = this.replicaStateManager.checkConsistencyViolation(
        rowKey,
        consistency,
        replicationFactor,
        this.nodes
      );

      // Perform read repair if violation detected
      if (violated) {
        this.replicaStateManager.performReadRepair(rowKey, this.nodes);
      }
    }

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

    // Calculate actual row size using DataSizeCalculator
    const keyspace = this.keyspaces.get(table.keyspace);
    const replicationFactor = keyspace?.replication || this.defaultReplicationFactor;
    const rowSize = this.dataSizeCalculator.calculateRowSize({
      row,
      columns: table.columns,
      compressionEnabled: false, // Can be made configurable
      replicationFactor,
    });

    // Add to memtable for compaction simulation
    if (this.enableCompaction) {
      this.compactionEngine.addToMemtable(tableKey, rowSize);
    }

    // Update table metadata with actual size
    table.rows = rows.length;
    const totalTableSize = this.dataSizeCalculator.calculateTableSize(
      rows,
      table.columns,
      replicationFactor,
      false, // compression
      0.5 // compression ratio
    );
    table.size = totalTableSize;
    this.tables.set(tableKey, table);

    // Get replica nodes for this keyspace (simplified: use first N nodes)
    const replicaNodes = this.getReplicaNodes(table.keyspace, row);
    
    // Calculate latency using LatencyCalculator
    const latency = this.latencyCalculator.calculateWriteLatency({
      consistency,
      replicationFactor,
      nodes: this.nodes,
      replicaNodes,
      operationType: 'write',
      datacenter: this.datacenter,
      networkLatencyMap: this.networkLatencyMap,
    });

    // Check consistency violation using ReplicaStateManager
    const rowKey = this.generateRowKey(tableKey, row);
    this.replicaStateManager.initializeReplicas(rowKey, replicaNodes, replicaNodes[0] || '');
    
    // Get healthy nodes from gossip engine
    const healthyNodes = this.gossipEngine.getHealthyNodes();
    
    // Write to replicas and create hints for unavailable nodes
    for (const nodeAddress of replicaNodes) {
      const node = this.nodes.get(nodeAddress);
      const isHealthy = healthyNodes.has(nodeAddress) && node?.status === 'up';
      
      if (isHealthy) {
        // Node is healthy - write succeeds
        this.replicaStateManager.updateReplica(rowKey, nodeAddress, true);
      } else {
        // Node is unavailable - create hint for hinted handoff
        this.hintedHandoffManager.createHint(
          nodeAddress,
          table.keyspace,
          table.name,
          rowKey,
          row
        );
        this.replicaStateManager.updateReplica(rowKey, nodeAddress, false);
      }
    }
    
    const violated = this.replicaStateManager.checkConsistencyViolation(
      rowKey,
      consistency,
      replicationFactor,
      this.nodes
    );
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

    // Update table metadata with actual size
    table.rows = rows.length;
    const keyspace = this.keyspaces.get(table.keyspace);
    const replicationFactor = keyspace?.replication || this.defaultReplicationFactor;
    const totalTableSize = this.dataSizeCalculator.calculateTableSize(
      rows,
      table.columns,
      replicationFactor,
      false,
      0.5
    );
    table.size = totalTableSize;
    this.tables.set(tableKey, table);

    // Get replica nodes
    const replicaNodes = updatedCount > 0 ? this.getReplicaNodes(table.keyspace, rows[0] || {}) : [];

    // Calculate latency using LatencyCalculator
    const latency = replicaNodes.length > 0 ? this.latencyCalculator.calculateWriteLatency({
      consistency,
      replicationFactor,
      nodes: this.nodes,
      replicaNodes,
      operationType: 'write',
      datacenter: this.datacenter,
      networkLatencyMap: this.networkLatencyMap,
    }) : 0;

    // Check consistency violation
    let violated = false;
    if (updatedCount > 0 && rows.length > 0) {
      const rowKey = this.generateRowKey(tableKey, rows[0]);
      violated = this.replicaStateManager.checkConsistencyViolation(
        rowKey,
        consistency,
        replicationFactor,
        this.nodes
      );
    }

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

    // Update table metadata with actual size
    table.rows = filteredRows.length;
    const keyspace = this.keyspaces.get(table.keyspace);
    const replicationFactor = keyspace?.replication || this.defaultReplicationFactor;
    const totalTableSize = this.dataSizeCalculator.calculateTableSize(
      filteredRows,
      table.columns,
      replicationFactor,
      false,
      0.5
    );
    table.size = totalTableSize;
    this.tables.set(tableKey, table);

    const deletedCount = initialLength - filteredRows.length;

    // Get replica nodes
    const replicaNodes = deletedCount > 0 ? this.getReplicaNodes(table.keyspace, {}) : [];

    // Calculate latency using LatencyCalculator
    const latency = replicaNodes.length > 0 ? this.latencyCalculator.calculateWriteLatency({
      consistency,
      replicationFactor,
      nodes: this.nodes,
      replicaNodes,
      operationType: 'write',
      datacenter: this.datacenter,
      networkLatencyMap: this.networkLatencyMap,
    }) : 0;

    // Check consistency violation
    let violated = false;
    if (deletedCount > 0) {
      // For delete, we check based on keyspace
      const requiredReplicas = this.getRequiredReplicas(consistency, table.keyspace);
      const healthyNodes = Array.from(this.nodes.values()).filter(n => n.status === 'up').length;
      violated = healthyNodes < requiredReplicas;
    }

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
   * Get token ring data for visualization
   */
  public getTokenRingData(): {
    tokenRanges: Array<{ start: number; end: number; nodeAddress: string }>;
    sortedTokens: Array<{ token: number; nodeAddress: string }>;
    nodeTokens: Array<{ address: string; tokens: number[]; datacenter?: string; rack?: string }>;
  } {
    const tokenRanges = this.tokenRing.getAllTokenRanges();
    const sortedTokens = this.tokenRing.getSortedTokens();
    const nodeTokens: Array<{ address: string; tokens: number[]; datacenter?: string; rack?: string }> = [];
    
    for (const nodeAddress of this.tokenRing.getNodes()) {
      const nodeInfo = this.tokenRing.getNodeInfo(nodeAddress);
      if (nodeInfo) {
        nodeTokens.push({
          address: nodeInfo.address,
          tokens: nodeInfo.tokens,
          datacenter: nodeInfo.datacenter,
          rack: nodeInfo.rack,
        });
      }
    }
    
    return { tokenRanges, sortedTokens, nodeTokens };
  }

  /**
   * Get metrics grouped by datacenter
   */
  public getDatacenterMetrics(): Map<string, {
    nodes: number;
    healthyNodes: number;
    totalSize: number;
    readLatency: number;
    writeLatency: number;
    readOpsPerSecond: number;
    writeOpsPerSecond: number;
    racks: Map<string, {
      nodes: number;
      healthyNodes: number;
    }>;
  }> {
    const datacenterMetrics = new Map<string, {
      nodes: number;
      healthyNodes: number;
      totalSize: number;
      readLatency: number;
      writeLatency: number;
      readOpsPerSecond: number;
      writeOpsPerSecond: number;
      racks: Map<string, { nodes: number; healthyNodes: number }>;
    }>();

    const healthyNodes = this.gossipEngine.getHealthyNodes();
    
    // Group nodes by datacenter
    for (const node of this.nodes.values()) {
      const datacenter = node.datacenter || 'default';
      const rack = node.rack || 'default';
      
      if (!datacenterMetrics.has(datacenter)) {
        datacenterMetrics.set(datacenter, {
          nodes: 0,
          healthyNodes: 0,
          totalSize: 0,
          readLatency: 0,
          writeLatency: 0,
          readOpsPerSecond: 0,
          writeOpsPerSecond: 0,
          racks: new Map(),
        });
      }
      
      const dcMetrics = datacenterMetrics.get(datacenter)!;
      dcMetrics.nodes++;
      if (healthyNodes.has(node.address)) {
        dcMetrics.healthyNodes++;
      }
      
      // Rack metrics
      if (!dcMetrics.racks.has(rack)) {
        dcMetrics.racks.set(rack, { nodes: 0, healthyNodes: 0 });
      }
      const rackMetrics = dcMetrics.racks.get(rack)!;
      rackMetrics.nodes++;
      if (healthyNodes.has(node.address)) {
        rackMetrics.healthyNodes++;
      }
    }
    
    // Calculate aggregated metrics per datacenter
    // (simplified - in real implementation would track per-datacenter metrics)
    const totalNodes = this.nodes.size;
    const totalHealthyNodes = healthyNodes.size;
    
    for (const [datacenter, metrics] of datacenterMetrics.entries()) {
      const nodeRatio = metrics.nodes / totalNodes;
      metrics.totalSize = this.metrics.totalSize * nodeRatio;
      metrics.readLatency = this.metrics.readLatency;
      metrics.writeLatency = this.metrics.writeLatency;
      metrics.readOpsPerSecond = this.metrics.readOperationsPerSecond * nodeRatio;
      metrics.writeOpsPerSecond = this.metrics.writeOperationsPerSecond * nodeRatio;
    }
    
    return datacenterMetrics;
  }

  /**
   * Get replica information for a partition key
   */
  public getReplicaInfo(keyspaceName: string, partitionKey: string): {
    primaryReplica: string | null;
    replicaNodes: string[];
    token: number;
    tokenRanges: Array<{ start: number; end: number; nodeAddress: string }>;
  } {
    const keyspace = this.keyspaces.get(keyspaceName);
    if (!keyspace) {
      return {
        primaryReplica: null,
        replicaNodes: [],
        token: 0,
        tokenRanges: [],
      };
    }
    
    // Generate partition key string
    const partitionKeyString = typeof partitionKey === 'string' ? partitionKey : JSON.stringify(partitionKey);
    const token = this.tokenRing.getToken(partitionKeyString);
    const primaryReplica = this.tokenRing.getPrimaryReplica(partitionKeyString);
    
    // Get replica nodes using replication strategy
    const strategyName = keyspace.replicationStrategy || 'NetworkTopologyStrategy';
    let strategy = this.replicationStrategies.get(strategyName);
    if (!strategy) {
      strategy = createReplicationStrategy(strategyName as 'SimpleStrategy' | 'NetworkTopologyStrategy');
      this.replicationStrategies.set(strategyName, strategy);
    }
    
    const healthyNodes = this.gossipEngine.getHealthyNodes();
    const replicationConfig: ReplicationConfig = {
      replicationFactor: keyspace.replication || this.defaultReplicationFactor,
      datacenterReplication: keyspace.datacenterReplication,
    };
    
    const replicaNodes = strategy.getReplicas(
      this.tokenRing,
      partitionKeyString,
      replicationConfig,
      healthyNodes
    );
    
    // Get token ranges for visualization
    const tokenRanges = this.tokenRing.getAllTokenRanges();
    
    return {
      primaryReplica,
      replicaNodes,
      token,
      tokenRanges,
    };
  }

  /**
   * Get TTL information for a table
   */
  public getTTLInfo(tableKey: string): {
    totalRows: number;
    rowsWithTTL: number;
    expiredRows: number;
    averageTTL: number;
  } {
    const rows = this.tableData.get(tableKey) || [];
    const ttlData = this.ttlManager.getTTLData(tableKey);
    
    let rowsWithTTL = 0;
    let totalTTL = 0;
    let expiredRows = 0;
    
    for (const [rowKey, ttlInfo] of ttlData.entries()) {
      if (ttlInfo.ttl > 0) {
        rowsWithTTL++;
        totalTTL += ttlInfo.ttl;
        
        if (ttlInfo.expiresAt && Date.now() > ttlInfo.expiresAt) {
          expiredRows++;
        }
      }
    }
    
    const averageTTL = rowsWithTTL > 0 ? totalTTL / rowsWithTTL : 0;
    
    return {
      totalRows: rows.length,
      rowsWithTTL,
      expiredRows,
      averageTTL,
    };
  }

  /**
   * Get replica nodes for a keyspace using token ring and replication strategy
   */
  private getReplicaNodes(keyspaceName: string, row: TableRow): string[] {
    const keyspace = this.keyspaces.get(keyspaceName);
    if (!keyspace) {
      return [];
    }

    // Generate partition key from row (use first column as partition key for simplicity)
    const partitionKey = this.generatePartitionKey(keyspaceName, row);
    
    // Get replication strategy
    const strategyName = keyspace.replicationStrategy || 'NetworkTopologyStrategy';
    let strategy = this.replicationStrategies.get(strategyName);
    if (!strategy) {
      strategy = createReplicationStrategy(strategyName as 'SimpleStrategy' | 'NetworkTopologyStrategy');
      this.replicationStrategies.set(strategyName, strategy);
    }

    // Get healthy nodes from gossip engine (more accurate than just checking status)
    const healthyNodes = this.gossipEngine.getHealthyNodes();

    // Build replication config
    const replicationConfig: ReplicationConfig = {
      replicationFactor: keyspace.replication || this.defaultReplicationFactor,
      datacenterReplication: keyspace.datacenterReplication,
    };

    // Get replicas using strategy
    const replicas = strategy.getReplicas(
      this.tokenRing,
      partitionKey,
      replicationConfig,
      healthyNodes
    );

    return replicas;
  }

  /**
   * Generate partition key from row data
   * Uses first column value as partition key (simplified)
   */
  private generatePartitionKey(keyspaceName: string, row: TableRow): string {
    // Try to use primary key columns if available
    const tableKey = this.findTableForRow(keyspaceName, row);
    if (tableKey) {
      const table = this.tables.get(tableKey);
      if (table?.columns) {
        // Find primary key columns
        const primaryKeyColumns = table.columns.filter(col => col.primaryKey);
        if (primaryKeyColumns.length > 0) {
          const keyParts = primaryKeyColumns.map(col => String(row[col.name] || ''));
          return `${tableKey}:${keyParts.join(':')}`;
        }
      }
    }

    // Fallback: use first column value
    const firstColumn = Object.keys(row)[0];
    return `${keyspaceName}:${firstColumn}:${row[firstColumn]}`;
  }

  /**
   * Find table key for a row (helper method)
   */
  private findTableForRow(keyspaceName: string, row: TableRow): string | null {
    for (const [tableKey, table] of this.tables.entries()) {
      if (table.keyspace === keyspaceName) {
        return tableKey;
      }
    }
    return null;
  }

  /**
   * Update token ring when nodes change
   */
  private updateTokenRing(): void {
    const nodes = Array.from(this.nodes.values()).map(node => ({
      address: node.address,
      tokens: node.tokens,
      datacenter: node.datacenter,
      rack: node.rack,
    }));
    this.tokenRing.initialize(nodes);
  }

  /**
   * Generate a row key for replica state tracking
   */
  private generateRowKey(tableKey: string, row: TableRow): string {
    // Use first column value as key (simplified)
    const firstColumn = Object.keys(row)[0];
    return `${tableKey}:${firstColumn}:${row[firstColumn]}`;
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
   * Record lightweight transaction for metrics
   */
  private recordLightweightTransaction(applied: boolean): void {
    this.metrics.lightweightTransactionsTotal++;
    if (applied) {
      this.metrics.lightweightTransactionsApplied++;
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    const now = Date.now();
    const timeDelta = (now - this.lastMetricsUpdate) / 1000; // seconds

    // Perform gossip exchange (periodic)
    this.gossipEngine.performGossipExchange(now);
    
    // Sync gossip engine with actual node states (in case nodes changed externally)
    this.gossipEngine.syncWithNodes(this.nodes);
    
    // Update gossip engine with current node load/status changes
    for (const [address, node] of this.nodes.entries()) {
      this.gossipEngine.updateNodeState(address, {
        status: node.status,
        load: node.load,
        tokens: node.tokens,
        datacenter: node.datacenter,
        rack: node.rack,
      });
    }

    // Node metrics - use gossip engine for accurate healthy node count
    this.metrics.totalNodes = this.nodes.size;
    const healthyNodes = this.gossipEngine.getHealthyNodes();
    this.metrics.healthyNodes = healthyNodes.size;

    // Keyspace and table metrics
    this.metrics.totalKeyspaces = this.keyspaces.size;
    this.metrics.totalTables = this.tables.size;

    // Count total rows and calculate size using DataSizeCalculator
    let totalRows = 0;
    let totalSize = 0;
    for (const [tableKey, rows] of this.tableData.entries()) {
      totalRows += rows.length;
      const table = this.tables.get(tableKey);
      if (table) {
        const keyspace = this.keyspaces.get(table.keyspace);
        const replicationFactor = keyspace?.replication || this.defaultReplicationFactor;
        const tableSize = this.dataSizeCalculator.calculateTableSize(
          rows,
          table.columns,
          replicationFactor,
          false,
          0.5
        );
        totalSize += tableSize;
      } else {
        // Fallback: estimate if table metadata not available
        totalSize += this.dataSizeCalculator.estimateRowSize(rows[0] || {}) * rows.length;
      }
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

    // Periodic compaction check
    if (this.enableCompaction) {
      this.compactionEngine.periodicCompactionCheck();
    }

    // Get compaction metrics from CompactionEngine
    const compactionMetrics = this.compactionEngine.getMetrics();
    this.metrics.pendingCompactions = compactionMetrics.pendingCompactions;

    // Cleanup expired hints
    this.hintedHandoffManager.cleanupExpiredHints();

    // Cleanup expired TTL records
    // First, get expired row keys before cleanup removes them
    const expiredRowKeys = this.ttlManager.getExpiredRowKeys();
    if (expiredRowKeys.length > 0) {
      // Group expired rows by table
      const expiredByTable = new Map<string, string[]>();
      for (const rowKey of expiredRowKeys) {
        const ttlRecord = this.ttlManager.getTTL(rowKey);
        if (ttlRecord) {
          const tableKey = ttlRecord.tableKey;
          if (!expiredByTable.has(tableKey)) {
            expiredByTable.set(tableKey, []);
          }
          expiredByTable.get(tableKey)!.push(rowKey);
        }
      }

      // Remove expired rows from tables
      for (const [tableKey, rowKeys] of expiredByTable.entries()) {
        const rows = this.tableData.get(tableKey) || [];
        const table = this.tables.get(tableKey);
        
        if (table) {
          // Filter out expired rows
          const filteredRows = rows.filter(row => {
            const rowKey = this.generateRowKey(tableKey, row);
            return !rowKeys.includes(rowKey);
          });
          
          this.tableData.set(tableKey, filteredRows);
          
          // Update table metadata
          table.rows = filteredRows.length;
          const keyspace = this.keyspaces.get(table.keyspace);
          const replicationFactor = keyspace?.replication || this.defaultReplicationFactor;
          const totalTableSize = this.dataSizeCalculator.calculateTableSize(
            filteredRows,
            table.columns,
            replicationFactor,
            false,
            0.5
          );
          table.size = totalTableSize;
          this.tables.set(tableKey, table);
        }
      }

      // Now cleanup expired records from TTL manager
      this.ttlManager.cleanupExpired();
    }

    // Deliver hints to nodes that came back online
    for (const nodeAddress of healthyNodes) {
      const node = this.nodes.get(nodeAddress);
      if (node && node.status === 'up') {
        const deliveredCount = this.hintedHandoffManager.deliverHintsToNode(nodeAddress);
        if (deliveredCount > 0) {
          // Hints were delivered - node just came back online
          // This is already handled by deliverHintsToNode
        }
      }
    }

    // Update hinted handoff metrics from actual hints
    const hintMetrics = this.hintedHandoffManager.getMetrics();
    this.metrics.hintedHandoffs = hintMetrics.pendingHints;

    // Simulate node load changes based on operations
    const totalOpsPerSecond = this.metrics.readOperationsPerSecond + this.metrics.writeOperationsPerSecond;
    for (const node of this.nodes.values()) {
      const isHealthy = healthyNodes.has(node.address);
      
      if (isHealthy && node.status === 'up') {
        // Simulate load changes: increase with operations, decrease over time
        const targetLoad = Math.min(0.95, 0.3 + (totalOpsPerSecond / 100) * 0.3);
        // Smooth transition towards target load
        node.load = node.load * 0.9 + targetLoad * 0.1;
        // Add some randomness for realism
        node.load += (Math.random() - 0.5) * 0.05;
        node.load = Math.max(0.1, Math.min(0.95, node.load));
      } else {
        // Mark node as down in replica state manager
        this.replicaStateManager.markNodeDown(node.address);
      }
    }

    // Update replica state manager when nodes come back up
    for (const node of this.nodes.values()) {
      const isHealthy = healthyNodes.has(node.address);
      if (isHealthy && node.status === 'up') {
        this.replicaStateManager.markNodeUp(node.address, this.nodes);
      }
    }

    this.lastMetricsUpdate = now;
  }

  /**
   * Set network latency map (can be called from EmulationEngine)
   */
  public setNetworkLatencyMap(latencyMap: Map<string, number>): void {
    this.networkLatencyMap = latencyMap;
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
   * Apply WHERE clause filtering to rows
   */
  private applyWhereClause(rows: TableRow[], whereClause: ParsedCQLQuery['whereClause']): TableRow[] {
    if (!whereClause || !whereClause.conditions || whereClause.conditions.length === 0) {
      return rows;
    }

    return rows.filter(row => {
      const results = whereClause.conditions.map(condition => this.evaluateWhereCondition(row, condition));
      
      // Apply AND/OR operator
      if (whereClause.operator === 'OR') {
        return results.some(r => r);
      } else {
        return results.every(r => r);
      }
    });
  }

  /**
   * Evaluate a single WHERE condition
   */
  private evaluateWhereCondition(row: TableRow, condition: ParsedCQLQuery['whereClause'] extends { conditions: infer C } ? C[number] : never): boolean {
    const columnValue = row[condition.column];
    
    switch (condition.operator) {
      case '=':
        return String(columnValue) === String(condition.value);
      case '!=':
      case '<>':
        return String(columnValue) !== String(condition.value);
      case '>':
        return Number(columnValue) > Number(condition.value);
      case '<':
        return Number(columnValue) < Number(condition.value);
      case '>=':
        return Number(columnValue) >= Number(condition.value);
      case '<=':
        return Number(columnValue) <= Number(condition.value);
      case 'IN':
        if (!condition.values) return false;
        return condition.values.some(v => String(columnValue) === String(v));
      case 'LIKE':
        // Simple LIKE pattern matching (supports % and _)
        const pattern = String(condition.value).replace(/%/g, '.*').replace(/_/g, '.');
        const regex = new RegExp(`^${pattern}$`, 'i');
        return regex.test(String(columnValue));
      default:
        return false;
    }
  }

  /**
   * Apply GROUP BY to rows
   */
  private applyGroupBy(rows: TableRow[], groupByColumns: string[]): TableRow[] {
    if (rows.length === 0 || groupByColumns.length === 0) {
      return rows;
    }

    const groups = new Map<string, TableRow[]>();
    
    for (const row of rows) {
      const groupKey = groupByColumns.map(col => String(row[col] || '')).join('|');
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(row);
    }

    // Return first row from each group (for aggregation, this will be processed separately)
    return Array.from(groups.values()).map(group => group[0]);
  }

  /**
   * Apply aggregate functions to rows
   */
  private applyAggregateFunctions(rows: TableRow[], functions: ParsedCQLQuery['aggregateFunctions'], groupBy?: string[]): TableRow[] {
    if (!functions || functions.length === 0) {
      return rows;
    }

    // If GROUP BY is used, aggregate per group
    if (groupBy && groupBy.length > 0) {
      const groups = new Map<string, TableRow[]>();
      
      for (const row of rows) {
        const groupKey = groupBy.map(col => String(row[col] || '')).join('|');
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(row);
      }

      return Array.from(groups.entries()).map(([groupKey, groupRows]) => {
        const result: TableRow = {};
        
        // Include group by columns
        const groupValues = groupKey.split('|');
        for (let i = 0; i < groupBy.length; i++) {
          result[groupBy[i]] = groupValues[i];
        }
        
        // Apply aggregate functions
        for (const func of functions) {
          const alias = func.alias || `${func.function.toLowerCase()}_${func.column || 'all'}`;
          result[alias] = this.calculateAggregate(groupRows, func);
        }
        
        return result;
      });
    } else {
      // Aggregate over all rows
      const result: TableRow = {};
      for (const func of functions) {
        const alias = func.alias || `${func.function.toLowerCase()}_${func.column || 'all'}`;
        result[alias] = this.calculateAggregate(rows, func);
      }
      return [result];
    }
  }

  /**
   * Calculate aggregate function value
   */
  private calculateAggregate(rows: TableRow[], func: ParsedCQLQuery['aggregateFunctions'] extends (infer F)[] ? F : never): any {
    if (rows.length === 0) {
      return func.function === 'COUNT' ? 0 : null;
    }

    switch (func.function) {
      case 'COUNT':
        return func.column ? rows.filter(r => r[func.column!] !== null && r[func.column!] !== undefined).length : rows.length;
      case 'SUM':
        if (!func.column) return null;
        return rows.reduce((sum, r) => sum + (Number(r[func.column!]) || 0), 0);
      case 'AVG':
        if (!func.column) return null;
        const sum = rows.reduce((s, r) => s + (Number(r[func.column!]) || 0), 0);
        return rows.length > 0 ? sum / rows.length : 0;
      case 'MIN':
        if (!func.column) return null;
        const minValues = rows.map(r => Number(r[func.column!])).filter(v => !isNaN(v));
        return minValues.length > 0 ? Math.min(...minValues) : null;
      case 'MAX':
        if (!func.column) return null;
        const maxValues = rows.map(r => Number(r[func.column!])).filter(v => !isNaN(v));
        return maxValues.length > 0 ? Math.max(...maxValues) : null;
      default:
        return null;
    }
  }

  /**
   * Apply ORDER BY to rows
   */
  private applyOrderBy(rows: TableRow[], orderBy: ParsedCQLQuery['orderBy']): TableRow[] {
    if (!orderBy || orderBy.length === 0) {
      return rows;
    }

    return [...rows].sort((a, b) => {
      for (const order of orderBy) {
        const aVal = a[order.column];
        const bVal = b[order.column];
        
        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        else if (aVal > bVal) comparison = 1;
        
        if (comparison !== 0) {
          return order.direction === 'ASC' ? comparison : -comparison;
        }
      }
      return 0;
    });
  }

  /**
   * Execute INSERT from parsed CQL
   */
  private executeInsertFromParsed(parsed: ParsedCQLQuery, consistency: ConsistencyLevel, startTime: number): CQLResult {
    if (!parsed.insertTable) {
      return {
        success: false,
        error: 'Invalid INSERT query: missing INTO clause',
        latency: Date.now() - startTime,
      };
    }

    const tableKey = this.normalizeTableKey(parsed.insertTable);
    let table = this.tables.get(tableKey);
    if (!table) {
      return {
        success: false,
        error: `Table ${parsed.insertTable} does not exist`,
        latency: Date.now() - startTime,
      };
    }

    // Create row object first to check partition key
    if (!parsed.insertColumns || !parsed.insertValues) {
      return {
        success: false,
        error: 'Invalid INSERT query: missing columns or values',
        latency: Date.now() - startTime,
      };
    }

    if (parsed.insertColumns.length !== parsed.insertValues.length) {
      return {
        success: false,
        error: 'Column count does not match value count',
        latency: Date.now() - startTime,
      };
    }

    const row: TableRow = {};
    for (let i = 0; i < parsed.insertColumns.length; i++) {
      row[parsed.insertColumns[i]] = parsed.insertValues[i];
    }

    // Check IF NOT EXISTS - check if row with same partition key exists
    if (parsed.ifNotExists) {
      const rowKey = this.generateRowKey(tableKey, row);
      const rows = this.tableData.get(tableKey) || [];
      const existingRow = rows.find(r => this.generateRowKey(tableKey, r) === rowKey);
      
      if (existingRow) {
        // Row already exists - lightweight transaction not applied
        this.recordLightweightTransaction(false);
        return {
          success: true,
          latency: Date.now() - startTime,
          rowCount: 0,
          consistency,
          applied: false,
        };
      }
    }


    // Set TTL if specified
    const rowKey = this.generateRowKey(tableKey, row);
    if (parsed.ttl !== undefined && parsed.ttl > 0) {
      this.ttlManager.setTTL(tableKey, rowKey, parsed.ttl);
    }

    // Add row to table
    const rows = this.tableData.get(tableKey) || [];
    rows.push(row);
    this.tableData.set(tableKey, rows);

    // Calculate actual row size using DataSizeCalculator
    const keyspace = this.keyspaces.get(table.keyspace);
    const replicationFactor = keyspace?.replication || this.defaultReplicationFactor;
    const rowSize = this.dataSizeCalculator.calculateRowSize({
      row,
      columns: table.columns,
      compressionEnabled: false,
      replicationFactor,
    });

    // Add to memtable for compaction simulation
    if (this.enableCompaction) {
      this.compactionEngine.addToMemtable(tableKey, rowSize);
    }

    // Update table metadata with actual size
    table.rows = rows.length;
    const totalTableSize = this.dataSizeCalculator.calculateTableSize(
      rows,
      table.columns,
      replicationFactor,
      false,
      0.5
    );
    table.size = totalTableSize;
    this.tables.set(tableKey, table);

    // Get replica nodes for this keyspace
    const replicaNodes = this.getReplicaNodes(table.keyspace, row);
    
    // Calculate latency using LatencyCalculator
    const latency = this.latencyCalculator.calculateWriteLatency({
      consistency,
      replicationFactor,
      nodes: this.nodes,
      replicaNodes,
      operationType: 'write',
      datacenter: this.datacenter,
      networkLatencyMap: this.networkLatencyMap,
    });

    // Check consistency violation using ReplicaStateManager
    this.replicaStateManager.initializeReplicas(rowKey, replicaNodes, replicaNodes[0] || '');
    
    // Get healthy nodes from gossip engine
    const healthyNodes = this.gossipEngine.getHealthyNodes();
    
    // Write to replicas and create hints for unavailable nodes
    for (const nodeAddress of replicaNodes) {
      const node = this.nodes.get(nodeAddress);
      const isHealthy = healthyNodes.has(nodeAddress) && node?.status === 'up';
      
      if (isHealthy) {
        this.replicaStateManager.updateReplica(rowKey, nodeAddress, true);
      } else {
        this.hintedHandoffManager.createHint(
          nodeAddress,
          table.keyspace,
          table.name,
          rowKey,
          row
        );
        this.replicaStateManager.updateReplica(rowKey, nodeAddress, false);
      }
    }
    
    const violated = this.replicaStateManager.checkConsistencyViolation(
      rowKey,
      consistency,
      replicationFactor,
      this.nodes
    );
    this.recordWriteOperation(latency, violated);

    const replicasQueried = this.getRequiredReplicas(consistency, table.keyspace);

    this.updateMetrics();
    
    // Record lightweight transaction if IF NOT EXISTS was used
    if (parsed.ifNotExists) {
      this.recordLightweightTransaction(true);
    }
    
    return {
      success: true,
      latency,
      consistency,
      rowCount: 1,
      replicasQueried,
      applied: parsed.ifNotExists ? true : undefined,
    };
  }

  /**
   * Execute UPDATE from parsed CQL
   */
  private executeUpdateFromParsed(parsed: ParsedCQLQuery, consistency: ConsistencyLevel, startTime: number): CQLResult {
    if (!parsed.updateTable || !parsed.updateSet || !parsed.updateWhere) {
      return {
        success: false,
        error: 'Invalid UPDATE query',
        latency: Date.now() - startTime,
      };
    }

    const tableKey = this.normalizeTableKey(parsed.updateTable);
    const table = this.tables.get(tableKey);
    if (!table) {
      return {
        success: false,
        error: `Table ${parsed.updateTable} does not exist`,
        latency: Date.now() - startTime,
      };
    }

    // Update matching rows
    const rows = this.tableData.get(tableKey) || [];
    let updatedCount = 0;
    let matchingRow: TableRow | null = null;
    
    for (const row of rows) {
      if (this.evaluateWhereClauseForRow(row, parsed.updateWhere)) {
        matchingRow = row;
        Object.assign(row, parsed.updateSet);
        
        // Update TTL if specified
        if (parsed.updateTTL !== undefined) {
          const rowKey = this.generateRowKey(tableKey, row);
          if (parsed.updateTTL > 0) {
            this.ttlManager.setTTL(tableKey, rowKey, parsed.updateTTL);
          } else {
            // Remove TTL if set to 0
            this.ttlManager.removeTTL(rowKey);
          }
        }
        
        updatedCount++;
      }
    }

    // Check IF EXISTS - verify that matching row was found
    if (parsed.ifExists) {
      if (updatedCount === 0 || !matchingRow) {
        // Row does not exist - lightweight transaction not applied
        this.recordLightweightTransaction(false);
        return {
          success: true,
          latency: Date.now() - startTime,
          rowCount: 0,
          consistency,
          applied: false,
        };
      }
    }

    // Update table metadata with actual size
    table.rows = rows.length;
    const keyspace = this.keyspaces.get(table.keyspace);
    const replicationFactor = keyspace?.replication || this.defaultReplicationFactor;
    const totalTableSize = this.dataSizeCalculator.calculateTableSize(
      rows,
      table.columns,
      replicationFactor,
      false,
      0.5
    );
    table.size = totalTableSize;
    this.tables.set(tableKey, table);

    // Get replica nodes
    const replicaNodes = updatedCount > 0 ? this.getReplicaNodes(table.keyspace, rows[0] || {}) : [];

    // Calculate latency using LatencyCalculator
    const latency = replicaNodes.length > 0 ? this.latencyCalculator.calculateWriteLatency({
      consistency,
      replicationFactor,
      nodes: this.nodes,
      replicaNodes,
      operationType: 'write',
      datacenter: this.datacenter,
      networkLatencyMap: this.networkLatencyMap,
    }) : 0;

    // Check consistency violation
    let violated = false;
    if (updatedCount > 0 && rows.length > 0) {
      const rowKey = this.generateRowKey(tableKey, rows[0]);
      violated = this.replicaStateManager.checkConsistencyViolation(
        rowKey,
        consistency,
        replicationFactor,
        this.nodes
      );
    }

    this.recordWriteOperation(latency, violated);

    const replicasQueried = this.getRequiredReplicas(consistency, table.keyspace);

    this.updateMetrics();
    
    // Record lightweight transaction if IF EXISTS was used
    if (parsed.ifExists) {
      this.recordLightweightTransaction(true);
    }
    
    return {
      success: true,
      latency,
      consistency,
      rowCount: updatedCount,
      replicasQueried,
      applied: parsed.ifExists ? true : undefined,
    };
  }

  /**
   * Evaluate WHERE clause for a single row
   */
  private evaluateWhereClauseForRow(row: TableRow, whereClause: ParsedCQLQuery['whereClause']): boolean {
    if (!whereClause || !whereClause.conditions || whereClause.conditions.length === 0) {
      return true;
    }

    const results = whereClause.conditions.map(condition => this.evaluateWhereCondition(row, condition));
    
    if (whereClause.operator === 'OR') {
      return results.some(r => r);
    } else {
      return results.every(r => r);
    }
  }

  /**
   * Execute DELETE from parsed CQL
   */
  private executeDeleteFromParsed(parsed: ParsedCQLQuery, consistency: ConsistencyLevel, startTime: number): CQLResult {
    if (!parsed.deleteTable || !parsed.deleteWhere) {
      return {
        success: false,
        error: 'Invalid DELETE query',
        latency: Date.now() - startTime,
      };
    }

    const tableKey = this.normalizeTableKey(parsed.deleteTable);
    const table = this.tables.get(tableKey);
    if (!table) {
      return {
        success: false,
        error: `Table ${parsed.deleteTable} does not exist`,
        latency: Date.now() - startTime,
      };
    }

    // Delete matching rows
    const rows = this.tableData.get(tableKey) || [];
    const initialLength = rows.length;
    const filteredRows = rows.filter(row => !this.evaluateWhereClauseForRow(row, parsed.deleteWhere));
    this.tableData.set(tableKey, filteredRows);

    // Update table metadata with actual size
    table.rows = filteredRows.length;
    const keyspace = this.keyspaces.get(table.keyspace);
    const replicationFactor = keyspace?.replication || this.defaultReplicationFactor;
    const totalTableSize = this.dataSizeCalculator.calculateTableSize(
      filteredRows,
      table.columns,
      replicationFactor,
      false,
      0.5
    );
    table.size = totalTableSize;
    this.tables.set(tableKey, table);

    const deletedCount = initialLength - filteredRows.length;

    // Get replica nodes
    const replicaNodes = deletedCount > 0 ? this.getReplicaNodes(table.keyspace, {}) : [];

    // Calculate latency using LatencyCalculator
    const latency = replicaNodes.length > 0 ? this.latencyCalculator.calculateWriteLatency({
      consistency,
      replicationFactor,
      nodes: this.nodes,
      replicaNodes,
      operationType: 'write',
      datacenter: this.datacenter,
      networkLatencyMap: this.networkLatencyMap,
    }) : 0;

    // Check consistency violation
    let violated = false;
    if (deletedCount > 0) {
      const requiredReplicas = this.getRequiredReplicas(consistency, table.keyspace);
      const healthyNodes = Array.from(this.nodes.values()).filter(n => n.status === 'up').length;
      violated = healthyNodes < requiredReplicas;
    }

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
   * Execute CREATE KEYSPACE from parsed CQL
   */
  private executeCreateKeyspaceFromParsed(parsed: ParsedCQLQuery, startTime: number): CQLResult {
    if (!parsed.keyspaceName) {
      return {
        success: false,
        error: 'Invalid CREATE KEYSPACE query',
        latency: Date.now() - startTime,
      };
    }

    if (this.keyspaces.has(parsed.keyspaceName)) {
      return {
        success: false,
        error: `Keyspace ${parsed.keyspaceName} already exists`,
        latency: Date.now() - startTime,
      };
    }

    const replicationConfig = parsed.replicationConfig || {
      strategy: 'SimpleStrategy',
      replicationFactor: this.defaultReplicationFactor,
    };

    this.keyspaces.set(parsed.keyspaceName, {
      name: parsed.keyspaceName,
      replication: replicationConfig.replicationFactor || this.defaultReplicationFactor,
      replicationStrategy: replicationConfig.strategy,
      datacenterReplication: replicationConfig.datacenterReplication,
      tables: 0,
      size: 0,
      durableWrites: parsed.durableWrites ?? true,
    });

    this.updateMetrics();
    return {
      success: true,
      latency: Date.now() - startTime,
      rowCount: 0,
    };
  }

  /**
   * Execute CREATE TABLE from parsed CQL
   */
  private executeCreateTableFromParsed(parsed: ParsedCQLQuery, startTime: number): CQLResult {
    if (!parsed.tableName || !parsed.tableColumns) {
      return {
        success: false,
        error: 'Invalid CREATE TABLE query',
        latency: Date.now() - startTime,
      };
    }

    const tableKey = this.normalizeTableKey(parsed.tableName);
    
    if (this.tables.has(tableKey)) {
      return {
        success: false,
        error: `Table ${parsed.tableName} already exists`,
        latency: Date.now() - startTime,
      };
    }

    // Extract keyspace and table name
    const parts = parsed.tableName.split('.');
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
      columns: parsed.tableColumns.map(col => ({
        name: col.name,
        type: col.type,
        primaryKey: col.primaryKey,
      })),
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
   * Execute DROP TABLE from parsed CQL
   */
  private executeDropTableFromParsed(parsed: ParsedCQLQuery, startTime: number): CQLResult {
    if (!parsed.tableName) {
      return {
        success: false,
        error: 'Invalid DROP TABLE query',
        latency: Date.now() - startTime,
      };
    }

    const tableKey = this.normalizeTableKey(parsed.tableName);
    
    if (!this.tables.has(tableKey)) {
      return {
        success: false,
        error: `Table ${parsed.tableName} does not exist`,
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
   * Execute DROP KEYSPACE from parsed CQL
   */
  private executeDropKeyspaceFromParsed(parsed: ParsedCQLQuery, startTime: number): CQLResult {
    if (!parsed.keyspaceName) {
      return {
        success: false,
        error: 'Invalid DROP KEYSPACE query',
        latency: Date.now() - startTime,
      };
    }

    if (!this.keyspaces.has(parsed.keyspaceName)) {
      return {
        success: false,
        error: `Keyspace ${parsed.keyspaceName} does not exist`,
        latency: Date.now() - startTime,
      };
    }

    // Delete all tables in keyspace
    const tablesToDelete: string[] = [];
    for (const [tableKey, table] of this.tables.entries()) {
      if (table.keyspace === parsed.keyspaceName) {
        tablesToDelete.push(tableKey);
      }
    }

    for (const tableKey of tablesToDelete) {
      this.tables.delete(tableKey);
      this.tableData.delete(tableKey);
    }

    this.keyspaces.delete(parsed.keyspaceName);

    this.updateMetrics();
    return {
      success: true,
      latency: Date.now() - startTime,
      rowCount: 0,
    };
  }

  /**
   * Execute BATCH from parsed CQL
   */
  private executeBatchFromParsed(parsed: ParsedCQLQuery, consistency: ConsistencyLevel, startTime: number): CQLResult {
    if (!parsed.batchStatements || parsed.batchStatements.length === 0) {
      return {
        success: false,
        error: 'Invalid BATCH query: no statements',
        latency: Date.now() - startTime,
      };
    }

    // Use batch consistency if specified, otherwise use provided consistency
    const batchConsistency = parsed.batchConsistency 
      ? (parsed.batchConsistency as ConsistencyLevel)
      : consistency;

    let totalLatency = 0;
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Execute all statements in batch
    for (const statement of parsed.batchStatements) {
      const result = this.executeCQL(statement.originalQuery, batchConsistency);
      totalLatency += result.latency || 0;
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
        if (result.error) {
          errors.push(result.error);
        }
      }
    }

    return {
      success: errorCount === 0,
      latency: totalLatency,
      consistency: batchConsistency,
      rowCount: successCount,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
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


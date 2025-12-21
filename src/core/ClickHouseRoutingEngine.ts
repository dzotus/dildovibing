/**
 * ClickHouse Routing Engine
 * Handles SQL operations, table management, MergeTree simulation, and cluster metrics
 */

export interface ClickHouseTable {
  name: string;
  database: string;
  engine: string; // MergeTree, ReplacingMergeTree, SummingMergeTree, etc.
  columns?: Array<{
    name: string;
    type: string;
  }>;
  rows: number;
  size: number; // in bytes
  partitions: number;
}

export interface ClickHouseTablePart {
  name: string;
  minDate: string;
  maxDate: string;
  rows: number;
  size: number;
  level: number;
}

export interface ClickHouseConfig {
  cluster?: string;
  replication?: boolean;
  tables?: ClickHouseTable[];
  maxMemoryUsage?: number; // bytes
  compression?: 'LZ4' | 'ZSTD' | 'LZ4HC' | 'None';
}

export interface QueryResult {
  success: boolean;
  latency?: number;
  rows?: any[];
  rowCount?: number;
  columns?: string[];
  error?: string;
  dataRead?: number; // rows read
  dataWritten?: number; // rows written
}

export interface ClickHouseMetrics {
  queryThroughput: number; // queries per second
  avgQueryTime: number; // milliseconds
  queriesPerSecond: number;
  readRowsPerSecond: number;
  writtenRowsPerSecond: number;
  totalRows: number;
  totalSize: number; // bytes
  compressionRatio: number;
  activeQueries: number;
  memoryUsage: number; // bytes
  memoryUsagePercent: number;
  partsCount: number;
  pendingMerges: number;
  totalTables: number;
  clusterNodes: number;
  healthyNodes: number;
}

/**
 * ClickHouse Routing Engine
 * Simulates ClickHouse columnar database behavior
 */
export class ClickHouseRoutingEngine {
  private cluster: string = 'archiphoenix-cluster';
  private replication: boolean = false;
  private tables: Map<string, ClickHouseTable> = new Map(); // key: "database.table"
  private tableData: Map<string, any[]> = new Map(); // key: "database.table", храним как строки для простоты, но эмулируем колоночное хранение
  private tableParts: Map<string, ClickHouseTablePart[]> = new Map(); // key: "database.table"
  private maxMemoryUsage: number = 10 * 1024 * 1024 * 1024; // 10GB default
  private compression: 'LZ4' | 'ZSTD' | 'LZ4HC' | 'None' = 'LZ4';
  
  // Metrics
  private metrics: ClickHouseMetrics = {
    queryThroughput: 0,
    avgQueryTime: 45,
    queriesPerSecond: 0,
    readRowsPerSecond: 0,
    writtenRowsPerSecond: 0,
    totalRows: 0,
    totalSize: 0,
    compressionRatio: 5.0,
    activeQueries: 0,
    memoryUsage: 0,
    memoryUsagePercent: 0,
    partsCount: 0,
    pendingMerges: 0,
    totalTables: 0,
    clusterNodes: 1,
    healthyNodes: 1,
  };

  // Operation tracking for metrics
  private queryOperations: Array<{ timestamp: number; latency: number; rowsRead: number; rowsWritten: number }> = [];
  private lastMetricsUpdate: number = Date.now();
  private activeQueriesSet: Set<string> = new Set();

  /**
   * Initialize with ClickHouse configuration
   */
  public initialize(config: ClickHouseConfig): void {
    this.cluster = config.cluster || 'archiphoenix-cluster';
    this.replication = config.replication || false;
    this.maxMemoryUsage = config.maxMemoryUsage || 10 * 1024 * 1024 * 1024;
    this.compression = config.compression || 'LZ4';

    // Initialize tables
    this.tables.clear();
    this.tableData.clear();
    this.tableParts.clear();
    
    if (config.tables) {
      for (const table of config.tables) {
        const tableKey = `${table.database || 'default'}.${table.name}`;
        this.tables.set(tableKey, { ...table });
        this.tableData.set(tableKey, []);
        this.tableParts.set(tableKey, []);
      }
    }

    this.updateMetrics();
  }

  /**
   * Sync configuration from UI with runtime state
   */
  public syncFromConfig(config: Partial<ClickHouseConfig>): void {
    if (config.cluster) {
      this.cluster = config.cluster;
    }

    if (config.replication !== undefined) {
      this.replication = config.replication;
    }

    if (config.maxMemoryUsage) {
      this.maxMemoryUsage = config.maxMemoryUsage;
    }

    if (config.compression) {
      this.compression = config.compression;
    }

    if (config.tables) {
      // Update tables from config
      for (const table of config.tables) {
        const tableKey = `${table.database || 'default'}.${table.name}`;
        const existingTable = this.tables.get(tableKey);
        const existingRows = this.tableData.get(tableKey) || [];
        
        if (existingTable) {
          // Update existing table metadata, preserve data from runtime
          this.tables.set(tableKey, {
            ...table,
            rows: existingTable.rows || existingRows.length || 0,
            size: existingTable.size || (existingRows.length * 512) || 0, // Rough estimate: 512 bytes per row
          });
        } else {
          // New table - initialize empty
          this.tables.set(tableKey, { ...table, rows: 0, size: 0 });
          if (!this.tableData.has(tableKey)) {
            this.tableData.set(tableKey, []);
            this.tableParts.set(tableKey, []);
          }
        }
      }
    }

    this.updateMetrics();
  }

  /**
   * Execute SQL query
   */
  public executeQuery(sql: string): QueryResult {
    const startTime = Date.now();
    const queryId = `query-${Date.now()}-${Math.random()}`;
    
    try {
      // Normalize query
      const normalizedQuery = sql.trim().replace(/\s+/g, ' ');
      const upperQuery = normalizedQuery.toUpperCase();

      // Mark query as active
      this.activeQueriesSet.add(queryId);
      this.metrics.activeQueries = this.activeQueriesSet.size;

      let result: QueryResult;

      // Parse and execute based on query type
      if (upperQuery.startsWith('SELECT')) {
        result = this.executeSelect(normalizedQuery, startTime);
      } else if (upperQuery.startsWith('INSERT')) {
        result = this.executeInsert(normalizedQuery, startTime);
      } else if (upperQuery.startsWith('ALTER')) {
        result = this.executeAlter(normalizedQuery, startTime);
      } else if (upperQuery.startsWith('CREATE TABLE')) {
        result = this.executeCreateTable(normalizedQuery, startTime);
      } else if (upperQuery.startsWith('DROP TABLE')) {
        result = this.executeDropTable(normalizedQuery, startTime);
      } else {
        result = {
          success: false,
          error: `Unsupported SQL statement: ${normalizedQuery}`,
          latency: Date.now() - startTime,
        };
      }

      // Record operation
      const latency = result.latency || (Date.now() - startTime);
      this.queryOperations.push({
        timestamp: Date.now(),
        latency,
        rowsRead: result.dataRead || 0,
        rowsWritten: result.dataWritten || 0,
      });

      // Remove from active queries
      this.activeQueriesSet.delete(queryId);
      this.metrics.activeQueries = this.activeQueriesSet.size;

      return result;
    } catch (error) {
      this.activeQueriesSet.delete(queryId);
      this.metrics.activeQueries = this.activeQueriesSet.size;
      
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
  private executeSelect(query: string, startTime: number): QueryResult {
    // Simple SELECT parsing: SELECT *|columns FROM database.table [WHERE ...] [GROUP BY ...] [ORDER BY ...] [LIMIT n]
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
    
    // Parse columns
    const selectMatch = query.match(/SELECT\s+(.+?)\s+FROM/i);
    const columns = selectMatch ? selectMatch[1].trim().split(',').map(c => c.trim()) : ['*'];
    
    // Parse WHERE
    let filteredRows = [...rows];
    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+GROUP\s+BY|\s+ORDER\s+BY|\s+LIMIT|$)/i);
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

    // Parse GROUP BY (simplified - just count groups)
    const groupByMatch = query.match(/GROUP\s+BY\s+(\w+)/i);
    if (groupByMatch) {
      const groupColumn = groupByMatch[1];
      const groups = new Map();
      filteredRows.forEach(row => {
        const key = String(row[groupColumn] || 'null');
        groups.set(key, (groups.get(key) || 0) + 1);
      });
      filteredRows = Array.from(groups.entries()).map(([key, count]) => ({
        [groupColumn]: key,
        count: count,
      }));
    }

    // Parse ORDER BY
    const orderByMatch = query.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
    if (orderByMatch) {
      const orderColumn = orderByMatch[1];
      const direction = (orderByMatch[2] || 'ASC').toUpperCase();
      filteredRows.sort((a, b) => {
        const aVal = a[orderColumn];
        const bVal = b[orderColumn];
        if (direction === 'DESC') {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      });
    }

    // Parse LIMIT
    const limitMatch = query.match(/LIMIT\s+(\d+)/i);
    const limit = limitMatch ? parseInt(limitMatch[1], 10) : undefined;
    if (limit !== undefined && limit > 0) {
      filteredRows = filteredRows.slice(0, limit);
    }

    // Calculate latency based on query complexity and data size
    const latency = this.calculateQueryLatency(query, table, filteredRows.length);

    // Filter columns if not SELECT *
    let resultRows = filteredRows;
    if (!columns.includes('*') && columns.length > 0) {
      resultRows = filteredRows.map(row => {
        const result: any = {};
        columns.forEach(col => {
          if (row.hasOwnProperty(col)) {
            result[col] = row[col];
          }
        });
        return result;
      });
    }

    return {
      success: true,
      latency,
      rows: resultRows,
      rowCount: resultRows.length,
      columns: columns.includes('*') ? Object.keys(rows[0] || {}) : columns,
      dataRead: rows.length,
    };
  }

  /**
   * Execute INSERT query
   */
  private executeInsert(query: string, startTime: number): QueryResult {
    // Simple INSERT parsing: INSERT INTO database.table (col1, col2) VALUES (val1, val2)
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

    // Parse VALUES
    const valuesMatch = query.match(/VALUES\s+(.+)/i);
    if (!valuesMatch) {
      return {
        success: false,
        error: 'Invalid INSERT query: missing VALUES clause',
        latency: Date.now() - startTime,
      };
    }

    // Simple parsing - assume single row for now
    const valuesStr = valuesMatch[1].trim();
    const values = this.parseValues(valuesStr);

    // Add row to table
    const rows = this.tableData.get(tableKey) || [];
    const newRow: any = {};
    
    // Parse columns if specified
    const columnsMatch = query.match(/\(([^)]+)\)\s+VALUES/i);
    const columns = columnsMatch ? columnsMatch[1].split(',').map(c => c.trim()) : [];
    
    if (columns.length > 0 && columns.length === values.length) {
      columns.forEach((col, idx) => {
        newRow[col] = values[idx];
      });
    } else {
      // Assume all values are for all columns in order
      values.forEach((val, idx) => {
        newRow[`column_${idx}`] = val;
      });
    }

    rows.push(newRow);
    this.tableData.set(tableKey, rows);
    
    // Update table metadata
    table.rows = rows.length;
    table.size = rows.length * 512; // Rough estimate
    this.tables.set(tableKey, table);

    // Calculate latency
    const latency = 10 + Math.random() * 5; // 10-15ms for insert

    // Simulate part creation for MergeTree
    this.simulatePartCreation(tableKey);

    this.updateMetrics();

    return {
      success: true,
      latency,
      rowCount: 1,
      dataWritten: 1,
    };
  }

  /**
   * Execute CREATE TABLE query
   */
  private executeCreateTable(query: string, startTime: number): QueryResult {
    // Simple CREATE TABLE parsing
    const tableMatch = query.match(/CREATE\s+TABLE\s+([\w.]+)/i);
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

    // Parse engine (default: MergeTree)
    const engineMatch = query.match(/ENGINE\s*=\s*(\w+)/i);
    const engine = engineMatch ? engineMatch[1] : 'MergeTree';

    // Parse database (default: default)
    const [database, name] = tableKey.split('.');
    
    const newTable: ClickHouseTable = {
      name,
      database: database || 'default',
      engine,
      rows: 0,
      size: 0,
      partitions: 0,
    };

    this.tables.set(tableKey, newTable);
    this.tableData.set(tableKey, []);
    this.tableParts.set(tableKey, []);

    this.updateMetrics();

    return {
      success: true,
      latency: Date.now() - startTime,
    };
  }

  /**
   * Execute DROP TABLE query
   */
  private executeDropTable(query: string, startTime: number): QueryResult {
    const tableMatch = query.match(/DROP\s+TABLE\s+([\w.]+)/i);
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

    this.tables.delete(tableKey);
    this.tableData.delete(tableKey);
    this.tableParts.delete(tableKey);

    this.updateMetrics();

    return {
      success: true,
      latency: Date.now() - startTime,
    };
  }

  /**
   * Execute ALTER TABLE query
   */
  private executeAlter(query: string, startTime: number): QueryResult {
    const tableMatch = query.match(/ALTER\s+TABLE\s+([\w.]+)/i);
    if (!tableMatch) {
      return {
        success: false,
        error: 'Invalid ALTER TABLE query',
        latency: Date.now() - startTime,
      };
    }

    const tableName = tableMatch[1].trim();
    const tableKey = this.normalizeTableKey(tableName);
    
    const table = this.tables.get(tableKey);
    if (!table) {
      return {
        success: false,
        error: `Table ${tableName} does not exist`,
        latency: Date.now() - startTime,
      };
    }

    // For now, just return success (ALTER operations are complex)
    return {
      success: true,
      latency: Date.now() - startTime,
    };
  }

  /**
   * Calculate query latency based on complexity and data size
   */
  private calculateQueryLatency(query: string, table: ClickHouseTable, rowsScanned: number): number {
    const baseLatency = 10; // ms
    
    // Factor from data size (columnar storage - read only needed columns)
    const dataFactor = (rowsScanned / 1000000) * 5; // 5ms per million rows
    
    // Factor from query complexity
    let complexityFactor = 1.0;
    const upperQuery = query.toUpperCase();
    
    if (upperQuery.includes('JOIN')) complexityFactor *= 2.0;
    if (upperQuery.includes('GROUP BY')) complexityFactor *= 1.5;
    if (upperQuery.includes('ORDER BY')) complexityFactor *= 1.3;
    if (upperQuery.includes('COUNT')) complexityFactor *= 0.8; // Optimized in columnar storage
    if (upperQuery.includes('SUM') || upperQuery.includes('AVG')) complexityFactor *= 0.9;
    
    // Factor from table parts (MergeTree)
    const parts = this.tableParts.get(`${table.database}.${table.name}`) || [];
    const partsFactor = Math.min(1.5, 1 + (parts.length / 100));
    
    return baseLatency + (dataFactor * complexityFactor * partsFactor);
  }

  /**
   * Parse VALUES clause
   */
  private parseValues(valuesStr: string): any[] {
    // Remove parentheses if present
    let clean = valuesStr.trim();
    if (clean.startsWith('(') && clean.endsWith(')')) {
      clean = clean.slice(1, -1);
    }
    
    // Simple parsing - split by comma, handle quoted strings
    const values: any[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < clean.length; i++) {
      const char = clean[i];
      
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      } else if (char === ',' && !inQuotes) {
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
   * Parse single value
   */
  private parseValue(valueStr: string): any {
    const trimmed = valueStr.trim();
    
    // Remove quotes
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }
    
    // Try number
    if (/^-?\d+$/.test(trimmed)) {
      return parseInt(trimmed, 10);
    }
    if (/^-?\d*\.\d+$/.test(trimmed)) {
      return parseFloat(trimmed);
    }
    
    // Boolean
    if (trimmed.toLowerCase() === 'true') return true;
    if (trimmed.toLowerCase() === 'false') return false;
    if (trimmed.toLowerCase() === 'null') return null;
    
    return trimmed;
  }

  /**
   * Normalize table key (database.table)
   */
  private normalizeTableKey(tableName: string): string {
    if (tableName.includes('.')) {
      return tableName;
    }
    return `default.${tableName}`;
  }

  /**
   * Simulate part creation for MergeTree
   */
  private simulatePartCreation(tableKey: string): void {
    const parts = this.tableParts.get(tableKey) || [];
    const now = new Date().toISOString().split('T')[0];
    
    // Create a new part
    const newPart: ClickHouseTablePart = {
      name: `${now}_${parts.length + 1}`,
      minDate: now,
      maxDate: now,
      rows: 1000, // Batch size
      size: 512 * 1000,
      level: 0,
    };
    
    parts.push(newPart);
    this.tableParts.set(tableKey, parts);
    
    // Simulate background merge (simplified)
    if (parts.length > 10) {
      // Merge some parts
      const toMerge = parts.splice(0, 5);
      const mergedPart: ClickHouseTablePart = {
        name: `merged_${Date.now()}`,
        minDate: toMerge[0].minDate,
        maxDate: toMerge[toMerge.length - 1].maxDate,
        rows: toMerge.reduce((sum, p) => sum + p.rows, 0),
        size: toMerge.reduce((sum, p) => sum + p.size, 0),
        level: Math.max(...toMerge.map(p => p.level)) + 1,
      };
      parts.unshift(mergedPart);
      this.tableParts.set(tableKey, parts);
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    const now = Date.now();
    const timeDelta = (now - this.lastMetricsUpdate) / 1000; // seconds

    // Table metrics
    this.metrics.totalTables = this.tables.size;

    // Count total rows and calculate size
    let totalRows = 0;
    let totalSize = 0;
    let totalParts = 0;
    
    for (const [tableKey, table] of this.tables.entries()) {
      totalRows += table.rows;
      totalSize += table.size;
      const parts = this.tableParts.get(tableKey) || [];
      totalParts += parts.length;
    }
    
    this.metrics.totalRows = totalRows;
    this.metrics.totalSize = totalSize;
    this.metrics.partsCount = totalParts;

    // Calculate queries per second
    const oneSecondAgo = now - 1000;
    const recentQueries = this.queryOperations.filter(op => op.timestamp > oneSecondAgo);
    
    this.metrics.queriesPerSecond = recentQueries.length;
    this.metrics.queryThroughput = recentQueries.length;

    // Calculate average query time
    if (recentQueries.length > 0) {
      const avgLatency = recentQueries.reduce((sum, op) => sum + op.latency, 0) / recentQueries.length;
      this.metrics.avgQueryTime = Math.round(avgLatency * 10) / 10;
      
      // Calculate read/write throughput
      const totalRowsRead = recentQueries.reduce((sum, op) => sum + op.rowsRead, 0);
      const totalRowsWritten = recentQueries.reduce((sum, op) => sum + op.rowsWritten, 0);
      
      this.metrics.readRowsPerSecond = Math.round(totalRowsRead / timeDelta);
      this.metrics.writtenRowsPerSecond = Math.round(totalRowsWritten / timeDelta);
    }

    // Memory usage (simplified - based on total size and compression)
    const compressedSize = totalSize / this.metrics.compressionRatio;
    this.metrics.memoryUsage = compressedSize;
    this.metrics.memoryUsagePercent = (compressedSize / this.maxMemoryUsage) * 100;

    // Pending merges (simplified - based on parts count)
    this.metrics.pendingMerges = Math.floor(totalParts / 10);

    // Cluster nodes (simplified)
    this.metrics.clusterNodes = this.replication ? 3 : 1;
    this.metrics.healthyNodes = this.metrics.clusterNodes;

    this.lastMetricsUpdate = now;
  }

  /**
   * Get current metrics
   */
  public getMetrics(): ClickHouseMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Insert data directly (for batch inserts)
   */
  public insertData(tableName: string, data: any[]): { success: boolean; rowsInserted: number; error?: string } {
    const tableKey = this.normalizeTableKey(tableName);
    const table = this.tables.get(tableKey);
    
    if (!table) {
      return { success: false, rowsInserted: 0, error: `Table ${tableName} does not exist` };
    }

    const rows = this.tableData.get(tableKey) || [];
    rows.push(...data);
    this.tableData.set(tableKey, rows);

    // Update table metadata
    table.rows = rows.length;
    table.size = rows.length * 512;
    this.tables.set(tableKey, table);

    // Simulate part creation
    this.simulatePartCreation(tableKey);

    this.updateMetrics();

    return { success: true, rowsInserted: data.length };
  }
}


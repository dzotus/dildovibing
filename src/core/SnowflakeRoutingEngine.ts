/**
 * Snowflake Routing Engine
 * Handles warehouse management, query execution, queuing, and metrics
 * Simulates Snowflake's separation of storage and compute architecture
 */

export interface SnowflakeWarehouse {
  name: string;
  size: 'X-Small' | 'Small' | 'Medium' | 'Large' | 'X-Large' | '2X-Large' | '3X-Large' | '4X-Large';
  status: 'running' | 'suspended' | 'resuming' | 'suspending';
  autoSuspend?: number; // seconds
  autoResume?: boolean;
  minClusterCount: number;
  maxClusterCount: number;
  currentClusterCount: number;
  runningQueries: number;
  queuedQueries: number;
  lastUsed?: number; // timestamp
  totalQueriesExecuted: number;
  totalComputeTime: number; // seconds
}

export interface SnowflakeDatabase {
  name: string;
  comment?: string;
  retentionTime?: number; // days
  size?: number; // bytes
  schemas?: SnowflakeSchema[];
}

export interface SnowflakeSchema {
  name: string;
  tables?: SnowflakeTable[];
  views?: number;
  functions?: number;
}

export interface SnowflakeTable {
  name: string;
  schema: string;
  database: string;
  columns?: Array<{
    name: string;
    type: string;
    nullable?: boolean;
  }>;
  rows: number;
  size: number; // bytes
  created?: number; // timestamp
}

export interface SnowflakeQuery {
  id: string;
  queryText: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  warehouse?: string;
  database?: string;
  schema?: string;
  startedAt?: number;
  completedAt?: number;
  duration?: number; // ms
  rowsReturned?: number;
  error?: string;
  resultCacheUsed?: boolean;
}

export interface SnowflakeConfig {
  account?: string;
  region?: string;
  warehouses?: SnowflakeWarehouse[];
  databases?: SnowflakeDatabase[];
  queries?: SnowflakeQuery[];
  role?: string;
  enableAutoSuspend?: boolean;
  autoSuspendSeconds?: number;
  enableAutoResume?: boolean;
}

export interface QueryResult {
  success: boolean;
  latency?: number;
  rows?: any[];
  rowCount?: number;
  columns?: string[];
  error?: string;
  queryId?: string;
  warehouse?: string;
  resultCacheUsed?: boolean;
  dataRead?: number; // rows read
  dataWritten?: number; // rows written
}

export interface SnowflakeMetrics {
  totalWarehouses: number;
  runningWarehouses: number;
  suspendedWarehouses: number;
  totalQueries: number;
  runningQueries: number;
  queuedQueries: number;
  queriesPerSecond: number;
  avgQueryTime: number; // milliseconds
  totalComputeTime: number; // seconds
  totalDataRead: number; // rows
  totalDataWritten: number; // rows
  cacheHitRate: number; // 0-1
  warehouseUtilization: number; // 0-1 average across all warehouses
  totalCost: number; // credits (simulated)
}

/**
 * Warehouse size to compute capacity mapping
 * Based on Snowflake's actual warehouse sizes
 */
const WAREHOUSE_SIZE_CAPACITY: Record<string, { servers: number; creditsPerHour: number }> = {
  'X-Small': { servers: 1, creditsPerHour: 1 },
  'Small': { servers: 2, creditsPerHour: 2 },
  'Medium': { servers: 4, creditsPerHour: 4 },
  'Large': { servers: 8, creditsPerHour: 8 },
  'X-Large': { servers: 16, creditsPerHour: 16 },
  '2X-Large': { servers: 32, creditsPerHour: 32 },
  '3X-Large': { servers: 64, creditsPerHour: 64 },
  '4X-Large': { servers: 128, creditsPerHour: 128 },
};

/**
 * Snowflake Routing Engine
 * Simulates Snowflake's cloud data platform behavior
 */
export class SnowflakeRoutingEngine {
  private account: string = '';
  private region: string = '';
  private warehouses: Map<string, SnowflakeWarehouse> = new Map();
  private databases: Map<string, SnowflakeDatabase> = new Map();
  private tables: Map<string, SnowflakeTable> = new Map(); // key: "database.schema.table"
  private tableData: Map<string, any[]> = new Map(); // key: "database.schema.table"
  private queries: Map<string, SnowflakeQuery> = new Map();
  private queryQueue: SnowflakeQuery[] = [];
  private activeQueries: Map<string, SnowflakeQuery> = new Map();
  
  // Result cache for query result caching
  private resultCache: Map<string, { data: any[]; timestamp: number; ttl: number }> = new Map();
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  
  // Metrics
  private metrics: SnowflakeMetrics = {
    totalWarehouses: 0,
    runningWarehouses: 0,
    suspendedWarehouses: 0,
    totalQueries: 0,
    runningQueries: 0,
    queuedQueries: 0,
    queriesPerSecond: 0,
    avgQueryTime: 0,
    totalComputeTime: 0,
    totalDataRead: 0,
    totalDataWritten: 0,
    cacheHitRate: 0,
    warehouseUtilization: 0,
    totalCost: 0,
  };
  
  // Operation tracking for metrics
  private queryOperations: Array<{ timestamp: number; latency: number; rowsRead: number; rowsWritten: number }> = [];
  private lastMetricsUpdate: number = Date.now();
  private warehouseLastUpdate: Map<string, number> = new Map();
  
  // Metrics history for charts (rolling window of last 100 data points)
  private metricsHistory: Array<{ timestamp: number; metrics: SnowflakeMetrics }> = [];
  private readonly MAX_HISTORY_SIZE = 100;
  
  // Auto-suspend timers
  private suspendTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Initialize with Snowflake configuration
   * @param config - Snowflake configuration (should already have defaults from UI)
   * @param nodeId - Optional node ID for fallback defaults generation
   */
  public initialize(config: SnowflakeConfig, nodeId?: string): void {
    // Используем значения из конфига (они должны быть сгенерированы в UI)
    // Если конфиг пустой - используем fallback (не должно происходить в нормальном flow)
    if (config.account) {
      this.account = config.account;
    } else if (nodeId) {
      // Fallback: генерируем account на основе nodeId
      const cleanId = nodeId.replace(/[^a-z0-9-]/gi, '').toLowerCase().substring(0, 20);
      this.account = cleanId || `account-${Date.now().toString(36)}`;
    } else {
      this.account = `account-${Date.now().toString(36)}`;
    }
    
    if (config.region) {
      this.region = config.region;
    } else {
      this.region = 'us-east-1'; // Fallback
    }
    
    // Initialize warehouses
    this.warehouses.clear();
    if (config.warehouses && config.warehouses.length > 0) {
      for (const wh of config.warehouses) {
        this.warehouses.set(wh.name, {
          ...wh,
          status: wh.status || 'suspended',
          currentClusterCount: wh.minClusterCount || 1,
          runningQueries: 0,
          queuedQueries: 0,
          totalQueriesExecuted: 0,
          totalComputeTime: 0,
        });
      }
    } else {
      // Create default warehouse only if no warehouses configured
      // Warehouse name should come from config or be generated
      const defaultWarehouseName = config.warehouse || 'COMPUTE_WH';
      this.warehouses.set(defaultWarehouseName, {
        name: defaultWarehouseName,
        size: 'Small',
        status: 'suspended',
        autoSuspend: config.autoSuspendSeconds || 60,
        autoResume: config.enableAutoResume !== false,
        minClusterCount: 1,
        maxClusterCount: 1,
        currentClusterCount: 1,
        runningQueries: 0,
        queuedQueries: 0,
        totalQueriesExecuted: 0,
        totalComputeTime: 0,
      });
    }
    
    // Initialize databases
    this.databases.clear();
    this.tables.clear();
    this.tableData.clear();
    
    if (config.databases) {
      for (const db of config.databases) {
        this.databases.set(db.name, { ...db });
        
        // Initialize tables from schemas
        if (db.schemas) {
          for (const schema of db.schemas) {
            if (schema.tables) {
              for (const table of schema.tables) {
                const tableKey = `${db.name}.${schema.name}.${table.name}`;
                this.tables.set(tableKey, { ...table });
                this.tableData.set(tableKey, []);
              }
            }
          }
        }
      }
    }
    
    // Initialize system database (always present in Snowflake)
    if (!this.databases.has('SNOWFLAKE')) {
      this.databases.set('SNOWFLAKE', {
        name: 'SNOWFLAKE',
        comment: 'System database',
        retentionTime: 1,
        size: 0,
        schemas: [{ name: 'INFORMATION_SCHEMA', tables: [], views: 0, functions: 0 }],
      });
    }
    
    // Если нет пользовательских баз данных, но есть database в конфиге, создаем её
    if (config.database && !this.databases.has(config.database) && config.database !== 'SNOWFLAKE') {
      this.databases.set(config.database, {
        name: config.database,
        retentionTime: 1,
        size: 0,
        schemas: [{ 
          name: config.schema || 'PUBLIC', 
          tables: [], 
          views: 0, 
          functions: 0 
        }],
      });
    }
    
    this.updateMetrics();
  }

  /**
   * Sync configuration from UI with runtime state
   */
  public syncFromConfig(config: Partial<SnowflakeConfig>): void {
    if (config.account) {
      this.account = config.account;
    }
    
    if (config.region) {
      this.region = config.region;
    }
    
    if (config.warehouses) {
      // Update warehouses
      for (const wh of config.warehouses) {
        const existing = this.warehouses.get(wh.name);
        if (existing) {
          // Preserve runtime state
          this.warehouses.set(wh.name, {
            ...wh,
            status: existing.status,
            currentClusterCount: existing.currentClusterCount,
            runningQueries: existing.runningQueries,
            queuedQueries: existing.queuedQueries,
            totalQueriesExecuted: existing.totalQueriesExecuted,
            totalComputeTime: existing.totalComputeTime,
            lastUsed: existing.lastUsed,
          });
          
          // Update auto-suspend settings
          this.updateWarehouseAutoSuspend(wh.name, wh);
        } else {
          // New warehouse
          this.warehouses.set(wh.name, {
            ...wh,
            status: 'suspended',
            currentClusterCount: wh.minClusterCount || 1,
            runningQueries: 0,
            queuedQueries: 0,
            totalQueriesExecuted: 0,
            totalComputeTime: 0,
          });
        }
      }
      
      // Remove deleted warehouses
      const configWarehouseNames = new Set(config.warehouses.map(w => w.name));
      for (const [name] of this.warehouses.entries()) {
        if (!configWarehouseNames.has(name)) {
          this.warehouses.delete(name);
          const timer = this.suspendTimers.get(name);
          if (timer) {
            clearTimeout(timer);
            this.suspendTimers.delete(name);
          }
        }
      }
    }
    
    if (config.databases) {
      // Update databases and tables
      for (const db of config.databases) {
        const existing = this.databases.get(db.name);
        this.databases.set(db.name, { ...db });
        
        if (db.schemas) {
          for (const schema of db.schemas) {
            if (schema.tables) {
              for (const table of schema.tables) {
                const tableKey = `${db.name}.${schema.name}.${table.name}`;
                const existingTable = this.tables.get(tableKey);
                const existingData = this.tableData.get(tableKey) || [];
                
                if (existingTable) {
                  // Preserve data
                  this.tables.set(tableKey, {
                    ...table,
                    rows: existingTable.rows || existingData.length || 0,
                    size: existingTable.size || (existingData.length * 512) || 0,
                  });
                } else {
                  this.tables.set(tableKey, { ...table, rows: 0, size: 0 });
                  this.tableData.set(tableKey, []);
                }
              }
            }
          }
        }
      }
    }
    
    this.updateMetrics();
  }

  /**
   * Validate SQL query syntax before execution
   */
  private validateSQL(sql: string): { valid: boolean; error?: string } {
    const trimmed = sql.trim();
    if (!trimmed) {
      return { valid: false, error: 'Query cannot be empty' };
    }
    
    // Проверка базового синтаксиса - должен начинаться с валидного SQL statement
    if (!/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|SHOW|DESCRIBE|USE|GRANT|REVOKE)/i.test(trimmed)) {
      return { valid: false, error: 'Query must start with a valid SQL statement' };
    }
    
    // Проверка на закрытие скобок
    const openParens = (trimmed.match(/\(/g) || []).length;
    const closeParens = (trimmed.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      return { valid: false, error: 'Unmatched parentheses in query' };
    }
    
    // Проверка на закрытие кавычек
    const singleQuotes = (trimmed.match(/'/g) || []).length;
    if (singleQuotes % 2 !== 0) {
      return { valid: false, error: 'Unmatched single quotes in query' };
    }
    
    const doubleQuotes = (trimmed.match(/"/g) || []).length;
    if (doubleQuotes % 2 !== 0) {
      return { valid: false, error: 'Unmatched double quotes in query' };
    }
    
    return { valid: true };
  }

  /**
   * Execute SQL query through a warehouse
   */
  public executeQuery(
    sql: string,
    warehouseName?: string,
    database?: string,
    schema?: string
  ): QueryResult {
    const startTime = Date.now();
    const queryId = `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Валидация SQL перед выполнением
    const validation = this.validateSQL(sql);
    if (!validation.valid) {
      const query: SnowflakeQuery = {
        id: queryId,
        queryText: sql,
        status: 'failed',
        warehouse: warehouseName,
        database: database,
        schema: schema,
        startedAt: startTime,
        completedAt: Date.now(),
        duration: Date.now() - startTime,
        error: validation.error,
      };
      this.queries.set(queryId, query);
      this.updateMetrics();
      return {
        success: false,
        error: validation.error,
        latency: Date.now() - startTime,
        queryId,
      };
    }
    
    // Check result cache first
    const cacheKey = this.getCacheKey(sql, database, schema);
    const cached = this.resultCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      this.cacheHits++;
      this.updateMetrics();
      return {
        success: true,
        latency: 10, // Cache hit is very fast
        rows: cached.data,
        rowCount: cached.data.length,
        queryId,
        resultCacheUsed: true,
      };
    }
    this.cacheMisses++;
    
    // Find or select warehouse
    let warehouse: SnowflakeWarehouse | undefined;
    if (warehouseName) {
      warehouse = this.warehouses.get(warehouseName);
    } else {
      // Find first running warehouse, or first available
      warehouse = Array.from(this.warehouses.values()).find(w => w.status === 'running') ||
                 Array.from(this.warehouses.values())[0];
    }
    
    if (!warehouse) {
      return {
        success: false,
        error: 'No warehouse available',
        latency: Date.now() - startTime,
        queryId,
      };
    }
    
    // Create query object
    const query: SnowflakeQuery = {
      id: queryId,
      queryText: sql,
      status: 'queued',
      warehouse: warehouse.name,
      database: database,
      schema: schema,
      startedAt: startTime,
    };
    
    this.queries.set(queryId, query);
    
    // Resume warehouse if suspended/resuming and auto-resume is enabled
    if ((warehouse.status === 'suspended' || warehouse.status === 'resuming') && warehouse.autoResume) {
      this.resumeWarehouse(warehouse.name);
    }
    
    // If warehouse is running, execute immediately
    if (warehouse.status === 'running') {
      return this.executeQueryOnWarehouse(query, warehouse, startTime);
    }
    
    // Otherwise queue the query (warehouse is suspended, resuming, or suspending)
    warehouse.queuedQueries++;
    this.queryQueue.push(query);
    query.status = 'queued';
    
    // Try to resume warehouse if suspended
    if (warehouse.status === 'suspended' && warehouse.autoResume) {
      this.resumeWarehouse(warehouse.name);
    }
    
    // Query will be processed when warehouse becomes running (через processQueryQueue)
    
    // Return queued status - query will be executed asynchronously
    return {
      success: true,
      latency: 50, // Queued query initial latency
      queryId,
      warehouse: warehouse.name,
    };
  }

  /**
   * Execute query on a specific warehouse
   * Supports multi-cluster query distribution for parallel processing
   */
  private executeQueryOnWarehouse(
    query: SnowflakeQuery,
    warehouse: SnowflakeWarehouse,
    startTime: number
  ): QueryResult {
    query.status = 'running';
    query.startedAt = Date.now();
    warehouse.runningQueries++;
    this.activeQueries.set(query.id, query);
    
    // Calculate query execution time based on warehouse size, cluster count, and query complexity
    const warehouseCapacity = WAREHOUSE_SIZE_CAPACITY[warehouse.size] || WAREHOUSE_SIZE_CAPACITY.Small;
    const baseLatency = 50; // Base query time in ms
    const sizeMultiplier = 1 / warehouseCapacity.servers; // Larger warehouses are faster
    const queryComplexity = this.estimateQueryComplexity(query.queryText);
    
    // Multi-cluster distribution: queries run faster with more clusters (parallel processing)
    // Each cluster processes a portion of the data in parallel
    const clusterCount = Math.max(1, warehouse.currentClusterCount);
    const clusterMultiplier = 1 / Math.sqrt(clusterCount); // Diminishing returns (sqrt scaling)
    const executionTime = baseLatency * sizeMultiplier * queryComplexity * clusterMultiplier;
    
    // Execute query with multi-cluster distribution if applicable
    const result = clusterCount > 1 
      ? this.executeQueryWithMultiCluster(query, warehouse, clusterCount)
      : this.executeSQL(query.queryText, query.database, query.schema);
    
    // Update query status
    const completedAt = Date.now();
    query.completedAt = completedAt;
    query.duration = completedAt - (query.startedAt || startTime);
    query.status = result.success ? 'success' : 'failed';
    query.rowsReturned = result.rowCount;
    query.error = result.error;
    
    // Update warehouse metrics
    warehouse.runningQueries--;
    warehouse.totalQueriesExecuted++;
    warehouse.totalComputeTime += query.duration / 1000; // Convert to seconds
    warehouse.lastUsed = completedAt;
    
    // Remove from active queries
    this.activeQueries.delete(query.id);
    
    // Cache result if successful
    if (result.success && result.rows) {
      const cacheKey = this.getCacheKey(query.queryText, query.database, query.schema);
      this.resultCache.set(cacheKey, {
        data: result.rows,
        timestamp: completedAt,
        ttl: 300000, // 5 minutes cache TTL
      });
    }
    
    // Record operation for metrics
    this.queryOperations.push({
      timestamp: completedAt,
      latency: query.duration,
      rowsRead: result.dataRead || 0,
      rowsWritten: result.dataWritten || 0,
    });
    
    // Check if warehouse should auto-suspend
    if (warehouse.autoSuspend && warehouse.runningQueries === 0 && warehouse.queuedQueries === 0) {
      this.scheduleWarehouseSuspend(warehouse.name, warehouse.autoSuspend);
    }
    
    this.updateMetrics();
    
    return {
      ...result,
      queryId: query.id,
      warehouse: warehouse.name,
      latency: query.duration,
    };
  }

  /**
   * Execute query with multi-cluster distribution
   * Distributes query execution across multiple clusters for parallel processing
   */
  private executeQueryWithMultiCluster(
    query: SnowflakeQuery,
    warehouse: SnowflakeWarehouse,
    clusterCount: number
  ): QueryResult {
    const normalizedQuery = query.queryText.trim().replace(/\s+/g, ' ');
    const upperQuery = normalizedQuery.toUpperCase();
    
    try {
      if (upperQuery.startsWith('SELECT')) {
        return this.executeSelectWithMultiCluster(normalizedQuery, query.database, query.schema, clusterCount);
      } else if (upperQuery.startsWith('INSERT')) {
        return this.executeInsertWithMultiCluster(normalizedQuery, query.database, query.schema, clusterCount);
      } else if (upperQuery.startsWith('UPDATE')) {
        return this.executeUpdateWithMultiCluster(normalizedQuery, query.database, query.schema, clusterCount);
      } else if (upperQuery.startsWith('DELETE')) {
        return this.executeDeleteWithMultiCluster(normalizedQuery, query.database, query.schema, clusterCount);
      } else {
        // For other query types, execute normally (no multi-cluster distribution)
        return this.executeSQL(query.queryText, query.database, query.schema);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute SELECT query with multi-cluster distribution
   * Each cluster processes a portion of data, results are aggregated
   */
  private executeSelectWithMultiCluster(
    sql: string,
    database?: string,
    schema?: string,
    clusterCount: number = 1
  ): QueryResult {
    const fromMatch = sql.match(/FROM\s+([\w.]+)/i);
    if (!fromMatch) {
      return {
        success: false,
        error: 'Invalid SELECT query: missing FROM clause',
      };
    }
    
    const tableName = fromMatch[1].trim();
    const tableKey = this.normalizeTableKey(tableName, database, schema);
    
    const table = this.tables.get(tableKey);
    if (!table) {
      return {
        success: false,
        error: `Table ${tableName} does not exist`,
      };
    }
    
    const allRows = this.tableData.get(tableKey) || [];
    
    // Distribute rows across clusters (simulate data partitioning)
    const rowsPerCluster = Math.ceil(allRows.length / clusterCount);
    const clusterResults: any[][] = [];
    let totalRowsRead = 0;
    
    // Each cluster processes its portion of data in parallel
    for (let clusterIndex = 0; clusterIndex < clusterCount; clusterIndex++) {
      const startIndex = clusterIndex * rowsPerCluster;
      const endIndex = Math.min(startIndex + rowsPerCluster, allRows.length);
      const clusterRows = allRows.slice(startIndex, endIndex);
      
      // Process cluster's portion with WHERE, ORDER BY, LIMIT
      let filteredRows = [...clusterRows];
      const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+GROUP\s+BY|\s+ORDER\s+BY|\s+LIMIT|$)/i);
      if (whereMatch) {
        const whereClause = whereMatch[1].trim();
        const eqMatch = whereClause.match(/(\w+)\s*=\s*['"]?([^'"\s]+)['"]?/);
        if (eqMatch) {
          const column = eqMatch[1];
          const value = eqMatch[2];
          filteredRows = clusterRows.filter(row => String(row[column]) === value);
        }
      }
      
      clusterResults.push(filteredRows);
      totalRowsRead += clusterRows.length;
    }
    
    // Aggregate results from all clusters
    let aggregatedRows: any[] = [];
    for (const clusterResult of clusterResults) {
      aggregatedRows = aggregatedRows.concat(clusterResult);
    }
    
    // Parse columns
    const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i);
    const columns = selectMatch ? selectMatch[1].trim().split(',').map(c => c.trim()) : ['*'];
    
    // Apply ORDER BY to aggregated results
    const orderByMatch = sql.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
    if (orderByMatch) {
      const orderColumn = orderByMatch[1];
      const orderDirection = (orderByMatch[2] || 'ASC').toUpperCase();
      aggregatedRows.sort((a, b) => {
        const aVal = a[orderColumn];
        const bVal = b[orderColumn];
        if (orderDirection === 'DESC') {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      });
    }
    
    // Apply LIMIT to aggregated results
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      const limit = parseInt(limitMatch[1], 10);
      aggregatedRows = aggregatedRows.slice(0, limit);
    }
    
    return {
      success: true,
      rows: aggregatedRows,
      rowCount: aggregatedRows.length,
      columns: columns.includes('*') ? (table.columns?.map(c => c.name) || []) : columns,
      dataRead: totalRowsRead,
    };
  }

  /**
   * Execute INSERT query with multi-cluster distribution
   * Data is distributed across clusters for parallel insertion
   */
  private executeInsertWithMultiCluster(
    sql: string,
    database?: string,
    schema?: string,
    clusterCount: number = 1
  ): QueryResult {
    const intoMatch = sql.match(/INTO\s+([\w.]+)/i);
    if (!intoMatch) {
      return {
        success: false,
        error: 'Invalid INSERT query: missing INTO clause',
      };
    }
    
    const tableName = intoMatch[1].trim();
    const tableKey = this.normalizeTableKey(tableName, database, schema);
    
    const table = this.tables.get(tableKey);
    if (!table) {
      return {
        success: false,
        error: `Table ${tableName} does not exist`,
      };
    }
    
    // Parse VALUES
    const valuesMatch = sql.match(/VALUES\s*\((.+?)\)/i);
    if (!valuesMatch) {
      return {
        success: false,
        error: 'Invalid INSERT query: missing VALUES clause',
      };
    }
    
    const values = valuesMatch[1].split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
    const columns = table.columns || [];
    
    if (values.length !== columns.length) {
      return {
        success: false,
        error: `Column count mismatch: expected ${columns.length}, got ${values.length}`,
      };
    }
    
    const row: any = {};
    columns.forEach((col, idx) => {
      row[col.name] = values[idx];
    });
    
    // Insert into table data (distributed across clusters in real Snowflake)
    const data = this.tableData.get(tableKey) || [];
    data.push(row);
    this.tableData.set(tableKey, data);
    
    // Update table metadata
    table.rows = data.length;
    table.size = data.length * 512; // Rough estimate
    
    return {
      success: true,
      rowCount: 1,
      dataWritten: 1,
    };
  }

  /**
   * Execute UPDATE query with multi-cluster distribution
   * Updates are distributed across clusters for parallel processing
   */
  private executeUpdateWithMultiCluster(
    sql: string,
    database?: string,
    schema?: string,
    clusterCount: number = 1
  ): QueryResult {
    // In multi-cluster mode, updates are processed in parallel across clusters
    // For simulation, we calculate affected rows based on cluster distribution
    const estimatedRowsUpdated = Math.floor(10 / clusterCount); // Simplified simulation
    
    return {
      success: true,
      rowCount: estimatedRowsUpdated,
      dataWritten: estimatedRowsUpdated,
    };
  }

  /**
   * Execute DELETE query with multi-cluster distribution
   * Deletes are distributed across clusters for parallel processing
   */
  private executeDeleteWithMultiCluster(
    sql: string,
    database?: string,
    schema?: string,
    clusterCount: number = 1
  ): QueryResult {
    // In multi-cluster mode, deletes are processed in parallel across clusters
    // For simulation, we calculate affected rows based on cluster distribution
    const estimatedRowsDeleted = Math.floor(10 / clusterCount); // Simplified simulation
    
    return {
      success: true,
      rowCount: estimatedRowsDeleted,
      dataWritten: estimatedRowsDeleted,
    };
  }

  /**
   * Execute SQL query (simplified SQL parser)
   */
  private executeSQL(sql: string, database?: string, schema?: string): QueryResult {
    const normalizedQuery = sql.trim().replace(/\s+/g, ' ');
    const upperQuery = normalizedQuery.toUpperCase();
    
    try {
      if (upperQuery.startsWith('SELECT')) {
        return this.executeSelect(normalizedQuery, database, schema);
      } else if (upperQuery.startsWith('INSERT')) {
        return this.executeInsert(normalizedQuery, database, schema);
      } else if (upperQuery.startsWith('UPDATE')) {
        return this.executeUpdate(normalizedQuery, database, schema);
      } else if (upperQuery.startsWith('DELETE')) {
        return this.executeDelete(normalizedQuery, database, schema);
      } else if (upperQuery.startsWith('CREATE TABLE')) {
        return this.executeCreateTable(normalizedQuery, database, schema);
      } else if (upperQuery.startsWith('DROP TABLE')) {
        return this.executeDropTable(normalizedQuery, database, schema);
      } else {
        return {
          success: false,
          error: `Unsupported SQL statement: ${normalizedQuery}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute SELECT query
   */
  private executeSelect(sql: string, database?: string, schema?: string): QueryResult {
    const fromMatch = sql.match(/FROM\s+([\w.]+)/i);
    if (!fromMatch) {
      return {
        success: false,
        error: 'Invalid SELECT query: missing FROM clause',
      };
    }
    
    const tableName = fromMatch[1].trim();
    const tableKey = this.normalizeTableKey(tableName, database, schema);
    
    const table = this.tables.get(tableKey);
    if (!table) {
      return {
        success: false,
        error: `Table ${tableName} does not exist`,
      };
    }
    
    const rows = this.tableData.get(tableKey) || [];
    
    // Parse columns
    const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i);
    const columns = selectMatch ? selectMatch[1].trim().split(',').map(c => c.trim()) : ['*'];
    
    // Parse WHERE
    let filteredRows = [...rows];
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+GROUP\s+BY|\s+ORDER\s+BY|\s+LIMIT|$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1].trim();
      const eqMatch = whereClause.match(/(\w+)\s*=\s*['"]?([^'"\s]+)['"]?/);
      if (eqMatch) {
        const column = eqMatch[1];
        const value = eqMatch[2];
        filteredRows = rows.filter(row => String(row[column]) === value);
      }
    }
    
    // Parse LIMIT
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      const limit = parseInt(limitMatch[1], 10);
      filteredRows = filteredRows.slice(0, limit);
    }
    
    return {
      success: true,
      rows: filteredRows,
      rowCount: filteredRows.length,
      columns: columns.includes('*') ? (table.columns?.map(c => c.name) || []) : columns,
      dataRead: rows.length,
    };
  }

  /**
   * Execute INSERT query
   */
  private executeInsert(sql: string, database?: string, schema?: string): QueryResult {
    const intoMatch = sql.match(/INTO\s+([\w.]+)/i);
    if (!intoMatch) {
      return {
        success: false,
        error: 'Invalid INSERT query: missing INTO clause',
      };
    }
    
    const tableName = intoMatch[1].trim();
    const tableKey = this.normalizeTableKey(tableName, database, schema);
    
    const table = this.tables.get(tableKey);
    if (!table) {
      return {
        success: false,
        error: `Table ${tableName} does not exist`,
      };
    }
    
    // Parse VALUES
    const valuesMatch = sql.match(/VALUES\s*\((.+?)\)/i);
    if (!valuesMatch) {
      return {
        success: false,
        error: 'Invalid INSERT query: missing VALUES clause',
      };
    }
    
    const values = valuesMatch[1].split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
    const columns = table.columns || [];
    
    if (values.length !== columns.length) {
      return {
        success: false,
        error: `Column count mismatch: expected ${columns.length}, got ${values.length}`,
      };
    }
    
    const row: any = {};
    columns.forEach((col, idx) => {
      row[col.name] = values[idx];
    });
    
    const data = this.tableData.get(tableKey) || [];
    data.push(row);
    this.tableData.set(tableKey, data);
    
    // Update table metadata
    table.rows = data.length;
    table.size = data.length * 512; // Rough estimate
    
    return {
      success: true,
      rowCount: 1,
      dataWritten: 1,
    };
  }

  /**
   * Execute UPDATE query (simplified)
   */
  private executeUpdate(sql: string, database?: string, schema?: string): QueryResult {
    // Simplified UPDATE - just return success
    return {
      success: true,
      rowCount: 0,
      dataWritten: 0,
    };
  }

  /**
   * Execute DELETE query (simplified)
   */
  private executeDelete(sql: string, database?: string, schema?: string): QueryResult {
    // Simplified DELETE - just return success
    return {
      success: true,
      rowCount: 0,
      dataWritten: 0,
    };
  }

  /**
   * Execute CREATE TABLE query
   */
  private executeCreateTable(sql: string, database?: string, schema?: string): QueryResult {
    const tableMatch = sql.match(/CREATE\s+TABLE\s+([\w.]+)/i);
    if (!tableMatch) {
      return {
        success: false,
        error: 'Invalid CREATE TABLE query',
      };
    }
    
    const tableName = tableMatch[1].trim();
    const tableKey = this.normalizeTableKey(tableName, database, schema);
    
    if (this.tables.has(tableKey)) {
      return {
        success: false,
        error: `Table ${tableName} already exists`,
      };
    }
    
    // Parse columns (simplified)
    const columnsMatch = sql.match(/\((.+?)\)/);
    const columns: Array<{ name: string; type: string; nullable?: boolean }> = [];
    
    if (columnsMatch) {
      const columnDefs = columnsMatch[1].split(',').map(c => c.trim());
      for (const def of columnDefs) {
        const parts = def.split(/\s+/);
        if (parts.length >= 2) {
          columns.push({
            name: parts[0],
            type: parts[1],
            nullable: !def.toUpperCase().includes('NOT NULL'),
          });
        }
      }
    }
    
    const [dbName, schemaName, tableNameOnly] = this.parseTableName(tableName, database, schema);
    
    const table: SnowflakeTable = {
      name: tableNameOnly,
      schema: schemaName,
      database: dbName,
      columns,
      rows: 0,
      size: 0,
      created: Date.now(),
    };
    
    this.tables.set(tableKey, table);
    this.tableData.set(tableKey, []);
    
    return {
      success: true,
      rowCount: 0,
    };
  }

  /**
   * Execute DROP TABLE query
   */
  private executeDropTable(sql: string, database?: string, schema?: string): QueryResult {
    const tableMatch = sql.match(/DROP\s+TABLE\s+([\w.]+)/i);
    if (!tableMatch) {
      return {
        success: false,
        error: 'Invalid DROP TABLE query',
      };
    }
    
    const tableName = tableMatch[1].trim();
    const tableKey = this.normalizeTableKey(tableName, database, schema);
    
    if (!this.tables.has(tableKey)) {
      return {
        success: false,
        error: `Table ${tableName} does not exist`,
      };
    }
    
    this.tables.delete(tableKey);
    this.tableData.delete(tableKey);
    
    return {
      success: true,
      rowCount: 0,
    };
  }

  /**
   * Resume a warehouse with realistic delay (2-5 seconds)
   */
  public resumeWarehouse(name: string): boolean {
    const warehouse = this.warehouses.get(name);
    if (!warehouse) {
      return false;
    }
    
    if (warehouse.status === 'running') {
      return true;
    }
    
    // Если уже в процессе resuming, не запускаем повторно
    if (warehouse.status === 'resuming') {
      return true;
    }
    
    // Cancel any pending suspend timer
    const timer = this.suspendTimers.get(name);
    if (timer) {
      clearTimeout(timer);
      this.suspendTimers.delete(name);
    }
    
    // Устанавливаем состояние resuming
    warehouse.status = 'resuming';
    this.updateMetrics();
    
    // Реалистичная задержка при resume (2-5 секунд)
    const resumeDelay = 2000 + Math.random() * 3000; // 2-5 секунд
    
    setTimeout(() => {
      const wh = this.warehouses.get(name);
      if (wh && wh.status === 'resuming') {
        wh.status = 'running';
        wh.currentClusterCount = wh.minClusterCount;
        
        // Process queued queries
        this.processQueryQueue(wh);
        
        this.updateMetrics();
      }
    }, resumeDelay);
    
    return true;
  }

  /**
   * Suspend a warehouse with realistic delay
   */
  public suspendWarehouse(name: string): boolean {
    const warehouse = this.warehouses.get(name);
    if (!warehouse) {
      return false;
    }
    
    if (warehouse.status === 'suspended') {
      return true;
    }
    
    // Если уже в процессе suspending, не запускаем повторно
    if (warehouse.status === 'suspending') {
      return true;
    }
    
    // Can't suspend if there are running queries
    if (warehouse.runningQueries > 0) {
      return false;
    }
    
    // Устанавливаем состояние suspending
    warehouse.status = 'suspending';
    this.updateMetrics();
    
    // Реалистичная задержка при suspend (1-3 секунды)
    const suspendDelay = 1000 + Math.random() * 2000; // 1-3 секунды
    
    setTimeout(() => {
      const wh = this.warehouses.get(name);
      if (wh && wh.status === 'suspending') {
        wh.status = 'suspended';
        wh.currentClusterCount = 0;
        
        this.updateMetrics();
      }
    }, suspendDelay);
    
    return true;
  }

  /**
   * Schedule warehouse auto-suspend
   */
  private scheduleWarehouseSuspend(name: string, delaySeconds: number): void {
    // Cancel existing timer
    const existingTimer = this.suspendTimers.get(name);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    const timer = setTimeout(() => {
      const warehouse = this.warehouses.get(name);
      if (warehouse && warehouse.runningQueries === 0 && warehouse.queuedQueries === 0) {
        this.suspendWarehouse(name);
      }
      this.suspendTimers.delete(name);
    }, delaySeconds * 1000);
    
    this.suspendTimers.set(name, timer);
  }

  /**
   * Update warehouse auto-suspend settings
   */
  private updateWarehouseAutoSuspend(name: string, config: Partial<SnowflakeWarehouse>): void {
    const warehouse = this.warehouses.get(name);
    if (!warehouse) {
      return;
    }
    
    // Cancel existing timer if settings changed
    if (config.autoSuspend !== undefined || config.autoResume !== undefined) {
      const timer = this.suspendTimers.get(name);
      if (timer) {
        clearTimeout(timer);
        this.suspendTimers.delete(name);
      }
    }
    
    // Schedule new suspend if needed
    if (warehouse.status === 'running' && warehouse.autoSuspend && 
        warehouse.runningQueries === 0 && warehouse.queuedQueries === 0) {
      this.scheduleWarehouseSuspend(name, warehouse.autoSuspend);
    }
  }

  /**
   * Process queued queries for a warehouse
   * Вызывается автоматически при переходе warehouse в состояние running
   */
  private processQueryQueue(warehouse: SnowflakeWarehouse): void {
    if (warehouse.status !== 'running') {
      return;
    }
    
    // Process queries from queue
    const queued = this.queryQueue.filter(q => q.warehouse === warehouse.name && q.status === 'queued');
    for (const query of queued) {
      if (warehouse.runningQueries < this.getMaxConcurrentQueries(warehouse)) {
        warehouse.queuedQueries--;
        this.queryQueue = this.queryQueue.filter(q => q.id !== query.id);
        this.executeQueryOnWarehouse(query, warehouse, query.startedAt || Date.now());
      } else {
        break; // Warehouse is at capacity
      }
    }
  }

  /**
   * Get maximum concurrent queries for a warehouse
   */
  private getMaxConcurrentQueries(warehouse: SnowflakeWarehouse): number {
    const capacity = WAREHOUSE_SIZE_CAPACITY[warehouse.size] || WAREHOUSE_SIZE_CAPACITY.Small;
    return capacity.servers * warehouse.currentClusterCount * 8; // 8 queries per server
  }

  /**
   * Estimate query complexity (1.0 = simple, higher = more complex)
   */
  private estimateQueryComplexity(sql: string): number {
    let complexity = 1.0;
    
    // JOINs increase complexity
    const joinCount = (sql.match(/\bJOIN\b/gi) || []).length;
    complexity += joinCount * 0.5;
    
    // GROUP BY increases complexity
    if (sql.match(/\bGROUP\s+BY\b/i)) {
      complexity += 0.3;
    }
    
    // ORDER BY increases complexity
    if (sql.match(/\bORDER\s+BY\b/i)) {
      complexity += 0.2;
    }
    
    // Aggregations increase complexity
    const aggCount = (sql.match(/\b(COUNT|SUM|AVG|MAX|MIN)\s*\(/gi) || []).length;
    complexity += aggCount * 0.2;
    
    return Math.max(1.0, complexity);
  }

  /**
   * Normalize table key
   */
  private normalizeTableKey(tableName: string, database?: string, schema?: string): string {
    const parts = tableName.split('.');
    if (parts.length === 3) {
      return parts.join('.');
    } else if (parts.length === 2) {
      return `${database || 'PUBLIC'}.${parts.join('.')}`;
    } else {
      return `${database || 'PUBLIC'}.${schema || 'PUBLIC'}.${parts[0]}`;
    }
  }

  /**
   * Parse table name into components
   */
  private parseTableName(tableName: string, defaultDatabase?: string, defaultSchema?: string): [string, string, string] {
    const parts = tableName.split('.');
    if (parts.length === 3) {
      return [parts[0], parts[1], parts[2]];
    } else if (parts.length === 2) {
      return [defaultDatabase || 'PUBLIC', parts[0], parts[1]];
    } else {
      return [defaultDatabase || 'PUBLIC', defaultSchema || 'PUBLIC', parts[0]];
    }
  }

  /**
   * Get cache key for query
   */
  private getCacheKey(sql: string, database?: string, schema?: string): string {
    return `${sql}|${database || ''}|${schema || ''}`;
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    const now = Date.now();
    const timeDelta = (now - this.lastMetricsUpdate) / 1000; // seconds
    
    // Warehouse metrics (учитываем состояния running, resuming, suspending, suspended)
    this.metrics.totalWarehouses = this.warehouses.size;
    this.metrics.runningWarehouses = Array.from(this.warehouses.values()).filter(w => w.status === 'running').length;
    this.metrics.suspendedWarehouses = Array.from(this.warehouses.values()).filter(w => w.status === 'suspended').length;
    
    // Query metrics
    this.metrics.totalQueries = this.queries.size;
    this.metrics.runningQueries = Array.from(this.warehouses.values()).reduce((sum, w) => sum + w.runningQueries, 0);
    this.metrics.queuedQueries = Array.from(this.warehouses.values()).reduce((sum, w) => sum + w.queuedQueries, 0);
    
    // Calculate queries per second
    if (timeDelta > 0) {
      const recentQueries = this.queryOperations.filter(op => op.timestamp > now - 1000);
      this.metrics.queriesPerSecond = recentQueries.length;
    }
    
    // Calculate average query time
    if (this.queryOperations.length > 0) {
      const recentOps = this.queryOperations.slice(-100); // Last 100 operations
      const avgLatency = recentOps.reduce((sum, op) => sum + op.latency, 0) / recentOps.length;
      this.metrics.avgQueryTime = avgLatency;
    }
    
    // Calculate total compute time
    this.metrics.totalComputeTime = Array.from(this.warehouses.values())
      .reduce((sum, w) => sum + w.totalComputeTime, 0);
    
    // Calculate data read/written
    const recentOps = this.queryOperations.slice(-1000);
    this.metrics.totalDataRead = recentOps.reduce((sum, op) => sum + op.rowsRead, 0);
    this.metrics.totalDataWritten = recentOps.reduce((sum, op) => sum + op.rowsWritten, 0);
    
    // Calculate cache hit rate
    const totalCacheRequests = this.cacheHits + this.cacheMisses;
    this.metrics.cacheHitRate = totalCacheRequests > 0 ? this.cacheHits / totalCacheRequests : 0;
    
    // Calculate warehouse utilization (только для running warehouses)
    let totalUtilization = 0;
    let runningCount = 0;
    for (const warehouse of this.warehouses.values()) {
      if (warehouse.status === 'running') {
        runningCount++;
        const maxQueries = this.getMaxConcurrentQueries(warehouse);
        const utilization = maxQueries > 0 ? warehouse.runningQueries / maxQueries : 0;
        totalUtilization += utilization;
      }
    }
    this.metrics.warehouseUtilization = runningCount > 0 
      ? totalUtilization / runningCount 
      : 0;
    
    // Calculate total cost (credits)
    let totalCost = 0;
    for (const warehouse of this.warehouses.values()) {
      if (warehouse.status === 'running' && warehouse.totalComputeTime > 0) {
        const capacity = WAREHOUSE_SIZE_CAPACITY[warehouse.size] || WAREHOUSE_SIZE_CAPACITY.Small;
        const hours = warehouse.totalComputeTime / 3600;
        totalCost += capacity.creditsPerHour * hours * warehouse.currentClusterCount;
      }
    }
    this.metrics.totalCost = totalCost;
    
    // Store metrics history for charts
    this.metricsHistory.push({
      timestamp: now,
      metrics: { ...this.metrics }
    });
    
    // Keep only last MAX_HISTORY_SIZE entries
    if (this.metricsHistory.length > this.MAX_HISTORY_SIZE) {
      this.metricsHistory.shift();
    }
    
    this.lastMetricsUpdate = now;
  }

  /**
   * Get metrics
   */
  public getMetrics(): SnowflakeMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get warehouse by name
   */
  public getWarehouse(name: string): SnowflakeWarehouse | undefined {
    return this.warehouses.get(name);
  }

  /**
   * Get all warehouses
   */
  public getWarehouses(): SnowflakeWarehouse[] {
    return Array.from(this.warehouses.values());
  }

  /**
   * Get query by ID
   */
  public getQuery(id: string): SnowflakeQuery | undefined {
    return this.queries.get(id);
  }

  /**
   * Get recent queries
   */
  public getRecentQueries(limit: number = 100): SnowflakeQuery[] {
    return Array.from(this.queries.values())
      .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))
      .slice(0, limit);
  }

  /**
   * Get tables for a database/schema
   */
  public getTables(database?: string, schema?: string): SnowflakeTable[] {
    if (!database && !schema) {
      return Array.from(this.tables.values());
    }
    
    return Array.from(this.tables.values()).filter(table => {
      if (database && table.database !== database) {
        return false;
      }
      if (schema && table.schema !== schema) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get metrics history for charts
   * Returns array of metrics snapshots with timestamps
   */
  public getMetricsHistory(): Array<{ timestamp: number; metrics: SnowflakeMetrics }> {
    this.updateMetrics(); // Ensure latest metrics are included
    return [...this.metricsHistory];
  }

  /**
   * Get cost history for cost trends chart
   * Returns array of { timestamp, cost } pairs
   */
  public getCostHistory(): Array<{ timestamp: number; cost: number }> {
    return this.metricsHistory.map(entry => ({
      timestamp: entry.timestamp,
      cost: entry.metrics.totalCost
    }));
  }

  /**
   * Get query performance history for query performance chart
   * Returns array of { timestamp, avgQueryTime, queriesPerSecond, cacheHitRate } pairs
   */
  public getQueryPerformanceHistory(): Array<{
    timestamp: number;
    avgQueryTime: number;
    queriesPerSecond: number;
    cacheHitRate: number;
  }> {
    return this.metricsHistory.map(entry => ({
      timestamp: entry.timestamp,
      avgQueryTime: entry.metrics.avgQueryTime,
      queriesPerSecond: entry.metrics.queriesPerSecond,
      cacheHitRate: entry.metrics.cacheHitRate
    }));
  }
}


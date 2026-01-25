/**
 * ClickHouse Routing Engine
 * Handles SQL operations, table management, MergeTree simulation, and cluster metrics
 */

import { ClickHouseCompressionCalculator, CompressionType } from './clickhouse/CompressionCalculator';
import { ClickHouseDataSizeCalculator } from './clickhouse/DataSizeCalculator';
import { ClickHouseLatencyCalculator } from './clickhouse/LatencyCalculator';
import { ClickHouseTableStorage } from './clickhouse/TableStorage';
import { ClickHouseTableEngine, TableEngineConfig } from './clickhouse/TableEngine';
import { MergeTreeEngine } from './clickhouse/engines/MergeTreeEngine';
import { ReplacingMergeTreeEngine } from './clickhouse/engines/ReplacingMergeTreeEngine';
import { SummingMergeTreeEngine } from './clickhouse/engines/SummingMergeTreeEngine';
import { AggregatingMergeTreeEngine } from './clickhouse/engines/AggregatingMergeTreeEngine';
import { ReplicatedMergeTreeEngine } from './clickhouse/engines/ReplicatedMergeTreeEngine';
import { DistributedEngine } from './clickhouse/engines/DistributedEngine';
import { ClickHouseSQLParser } from './clickhouse/SQLParser';
import { ClickHouseKeeper } from './clickhouse/Keeper';

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
  clusterNodes?: number; // количество узлов в кластере
  shards?: number; // количество шардов
  replicas?: number; // количество реплик на шард
  keeperNodes?: string[]; // узлы ClickHouse Keeper
  tables?: ClickHouseTable[];
  maxMemoryUsage?: number; // bytes
  compression?: 'LZ4' | 'ZSTD' | 'LZ4HC' | 'None';
  // Конфигурируемые параметры для симуляции (избегание хардкода)
  networkBandwidthMBps?: number; // пропускная способность сети в MB/s (по умолчанию 100 MB/s = ~100KB/ms)
  keeperBaseLatency?: number; // базовая задержка Keeper в ms (по умолчанию 10ms)
  keeperOperationLatencies?: { // задержки операций Keeper в ms
    INSERT?: number;
    MERGE?: number;
    MUTATION?: number;
    REPLICATE?: number;
  };
  baseOperationLatencies?: { // базовые задержки операций в ms
    SELECT?: number;
    INSERT?: number;
    ALTER?: number;
    CREATE?: number;
    DROP?: number;
  };
  averageArrayLength?: number; // средний размер массива для оценки размера данных (по умолчанию 10)
  sampleSize?: number; // размер выборки для анализа данных (по умолчанию 100)
  // Дополнительные конфигурируемые параметры для симуляции (избегание хардкода)
  latencyFactors?: { // факторы производительности для расчета latency
    compressionDecompressionMsPerMB?: number; // время декомпрессии на MB (по умолчанию 2ms/MB)
    networkLatencyPerNodeMs?: number; // network latency на узел кластера (по умолчанию 5ms)
    columnarReadFactor?: number; // фактор колоночного чтения (по умолчанию 0.3)
    indexSpeedupFactor?: number; // фактор ускорения от индексов (по умолчанию 0.5)
    partsOverheadMsPerPart?: number; // overhead на каждый part (по умолчанию 0.1ms)
    defaultColumnsCount?: number; // количество колонок по умолчанию для SELECT * (по умолчанию 10)
    writeTimeMsPer10KRows?: number; // время записи на 10K строк (по умолчанию 2ms)
    compressionTimeMsPer100KRows?: number; // время сжатия на 100K строк (по умолчанию 1ms)
  };
  replicationLatency?: { // задержки для репликации
    networkLatencyPerReplicaMs?: number; // задержка на реплику (по умолчанию 5ms)
    partsLatencyMsPerPart?: number; // задержка на part (по умолчанию 2ms)
  };
  distributionLatency?: { // задержки для распределенных запросов
    baseLatencyMs?: number; // базовая задержка (по умолчанию 5ms)
    networkLatencyPerShardMs?: number; // задержка на шард (по умолчанию 3ms)
    replicaLatencyMs?: number; // задержка на реплику (по умолчанию 1ms)
  };
  keeperConfig?: { // конфигурация Keeper
    quorumSize?: number; // минимальное количество реплик для quorum (по умолчанию 2)
    heartbeatIntervalMs?: number; // интервал heartbeat (по умолчанию 5000ms)
    operationTimeoutMs?: number; // таймаут операции (по умолчанию 30000ms)
    networkLatencyPerNodeMs?: number; // задержка на узел (по умолчанию 2ms)
  };
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
  private clusterNodes: number = 1; // количество узлов в кластере
  private shards: number = 1; // количество шардов
  private replicas: number = 1; // количество реплик на шард
  private keeperNodes: string[] = []; // узлы ClickHouse Keeper
  private tables: Map<string, ClickHouseTable> = new Map(); // key: "database.table"
  private tableStorage: Map<string, ClickHouseTableStorage> = new Map(); // key: "database.table", колоночное хранение данных
  private tableParts: Map<string, ClickHouseTablePart[]> = new Map(); // key: "database.table"
  private tableEngines: Map<string, ClickHouseTableEngine> = new Map(); // key: "database.table", движки таблиц
  private maxMemoryUsage: number = 10 * 1024 * 1024 * 1024; // 10GB default
  private compression: 'LZ4' | 'ZSTD' | 'LZ4HC' | 'None' = 'LZ4';
  
  // Конфигурируемые параметры для симуляции (избегание хардкода)
  private networkBandwidthMBps: number = 100; // пропускная способность сети в MB/s (по умолчанию 100 MB/s)
  private keeperBaseLatency: number = 10; // базовая задержка Keeper в ms
  private keeperOperationLatencies: { INSERT: number; MERGE: number; MUTATION: number; REPLICATE: number } = {
    INSERT: 2,
    MERGE: 10,
    MUTATION: 8,
    REPLICATE: 5,
  };
  private baseOperationLatencies: { SELECT: number; INSERT: number; ALTER: number; CREATE: number; DROP: number } = {
    SELECT: 5,
    INSERT: 10,
    ALTER: 50,
    CREATE: 20,
    DROP: 15,
  };
  private averageArrayLength: number = 10; // средний размер массива для оценки размера данных
  private sampleSize: number = 100; // размер выборки для анализа данных
  
  // Дополнительные конфигурируемые параметры для симуляции (избегание хардкода)
  private latencyFactors: {
    compressionDecompressionMsPerMB: number;
    networkLatencyPerNodeMs: number;
    columnarReadFactor: number;
    indexSpeedupFactor: number;
    partsOverheadMsPerPart: number;
    defaultColumnsCount: number;
    writeTimeMsPer10KRows: number;
    compressionTimeMsPer100KRows: number;
  };
  private replicationLatency: {
    networkLatencyPerReplicaMs: number;
    partsLatencyMsPerPart: number;
  };
  private distributionLatency: {
    baseLatencyMs: number;
    networkLatencyPerShardMs: number;
    replicaLatencyMs: number;
  };
  private keeperConfig: {
    quorumSize: number;
    heartbeatIntervalMs: number;
    operationTimeoutMs: number;
    networkLatencyPerNodeMs: number;
  };
  
  // Calculators для динамических расчетов
  private compressionCalculator: ClickHouseCompressionCalculator;
  private dataSizeCalculator: ClickHouseDataSizeCalculator;
  private latencyCalculator: ClickHouseLatencyCalculator;
  private sqlParser: ClickHouseSQLParser;
  
  // ClickHouse Keeper для координации реплик
  private keeper: ClickHouseKeeper;
  
  // Metrics
  private metrics: ClickHouseMetrics = {
    queryThroughput: 0,
    avgQueryTime: 45,
    queriesPerSecond: 0,
    readRowsPerSecond: 0,
    writtenRowsPerSecond: 0,
    totalRows: 0,
    totalSize: 0,
    compressionRatio: 1.0, // будет рассчитываться динамически
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

  constructor() {
    // Инициализируем калькуляторы
    this.compressionCalculator = new ClickHouseCompressionCalculator();
    this.dataSizeCalculator = new ClickHouseDataSizeCalculator();
    this.latencyCalculator = new ClickHouseLatencyCalculator();
    this.sqlParser = new ClickHouseSQLParser();
    
    // Инициализируем ClickHouse Keeper для координации реплик
    this.keeper = new ClickHouseKeeper();
  }

  /**
   * Initialize with ClickHouse configuration
   */
  public initialize(config: ClickHouseConfig): void {
    this.cluster = config.cluster || 'archiphoenix-cluster';
    this.replication = config.replication || false;
    this.clusterNodes = config.clusterNodes || (config.replication ? 3 : 1);
    this.shards = config.shards || 1;
    this.replicas = config.replicas || (config.replication ? 3 : 1);
    this.keeperNodes = config.keeperNodes || [];
    this.maxMemoryUsage = config.maxMemoryUsage || 10 * 1024 * 1024 * 1024;
    
    // Инициализируем узлы Keeper
    if (this.keeperNodes.length > 0) {
      for (let i = 0; i < this.keeperNodes.length; i++) {
        const node = this.keeperNodes[i];
        // Парсим host:port или используем дефолтный порт
        const [host, portStr] = node.includes(':') ? node.split(':') : [node, '2181'];
        const port = parseInt(portStr, 10) || 2181;
        this.keeper.addNode(`keeper-${i}`, host, port);
      }
    } else if (this.replication || this.replicas > 1) {
      // Если репликация включена, но узлы Keeper не указаны, создаем дефолтные
      this.keeper.addNode('keeper-1', 'localhost', 2181);
      if (this.replicas > 2) {
        this.keeper.addNode('keeper-2', 'localhost', 2182);
        this.keeper.addNode('keeper-3', 'localhost', 2183);
      }
    }
    this.compression = config.compression || 'LZ4';
    
    // Инициализируем конфигурируемые параметры (избегание хардкода)
    this.networkBandwidthMBps = config.networkBandwidthMBps || 100;
    this.keeperBaseLatency = config.keeperBaseLatency || 10;
    if (config.keeperOperationLatencies) {
      this.keeperOperationLatencies = {
        INSERT: config.keeperOperationLatencies.INSERT ?? 2,
        MERGE: config.keeperOperationLatencies.MERGE ?? 10,
        MUTATION: config.keeperOperationLatencies.MUTATION ?? 8,
        REPLICATE: config.keeperOperationLatencies.REPLICATE ?? 5,
      };
    }
    if (config.baseOperationLatencies) {
      this.baseOperationLatencies = {
        SELECT: config.baseOperationLatencies.SELECT ?? 5,
        INSERT: config.baseOperationLatencies.INSERT ?? 10,
        ALTER: config.baseOperationLatencies.ALTER ?? 50,
        CREATE: config.baseOperationLatencies.CREATE ?? 20,
        DROP: config.baseOperationLatencies.DROP ?? 15,
      };
    }
    this.averageArrayLength = config.averageArrayLength || 10;
    this.sampleSize = config.sampleSize || 100;
    
    // Инициализируем дополнительные конфигурируемые параметры
    this.latencyFactors = {
      compressionDecompressionMsPerMB: config.latencyFactors?.compressionDecompressionMsPerMB ?? 2,
      networkLatencyPerNodeMs: config.latencyFactors?.networkLatencyPerNodeMs ?? 5,
      columnarReadFactor: config.latencyFactors?.columnarReadFactor ?? 0.3,
      indexSpeedupFactor: config.latencyFactors?.indexSpeedupFactor ?? 0.5,
      partsOverheadMsPerPart: config.latencyFactors?.partsOverheadMsPerPart ?? 0.1,
      defaultColumnsCount: config.latencyFactors?.defaultColumnsCount ?? 10,
      writeTimeMsPer10KRows: config.latencyFactors?.writeTimeMsPer10KRows ?? 2,
      compressionTimeMsPer100KRows: config.latencyFactors?.compressionTimeMsPer100KRows ?? 1,
    };
    this.replicationLatency = {
      networkLatencyPerReplicaMs: config.replicationLatency?.networkLatencyPerReplicaMs ?? 5,
      partsLatencyMsPerPart: config.replicationLatency?.partsLatencyMsPerPart ?? 2,
    };
    this.distributionLatency = {
      baseLatencyMs: config.distributionLatency?.baseLatencyMs ?? 5,
      networkLatencyPerShardMs: config.distributionLatency?.networkLatencyPerShardMs ?? 3,
      replicaLatencyMs: config.distributionLatency?.replicaLatencyMs ?? 1,
    };
    this.keeperConfig = {
      quorumSize: config.keeperConfig?.quorumSize ?? 2,
      heartbeatIntervalMs: config.keeperConfig?.heartbeatIntervalMs ?? 5000,
      operationTimeoutMs: config.keeperConfig?.operationTimeoutMs ?? 30000,
      networkLatencyPerNodeMs: config.keeperConfig?.networkLatencyPerNodeMs ?? 2,
    };
    
    // Обновляем калькуляторы с конфигурируемыми параметрами
    this.latencyCalculator = new ClickHouseLatencyCalculator({
      baseSelectLatency: this.baseOperationLatencies.SELECT,
      baseInsertLatency: this.baseOperationLatencies.INSERT,
      baseAlterLatency: this.baseOperationLatencies.ALTER,
      baseCreateLatency: this.baseOperationLatencies.CREATE,
      baseDropLatency: this.baseOperationLatencies.DROP,
      compressionDecompressionMsPerMB: this.latencyFactors.compressionDecompressionMsPerMB,
      networkLatencyPerNodeMs: this.latencyFactors.networkLatencyPerNodeMs,
      columnarReadFactor: this.latencyFactors.columnarReadFactor,
      indexSpeedupFactor: this.latencyFactors.indexSpeedupFactor,
      partsOverheadMsPerPart: this.latencyFactors.partsOverheadMsPerPart,
      defaultColumnsCount: this.latencyFactors.defaultColumnsCount,
      writeTimeMsPer10KRows: this.latencyFactors.writeTimeMsPer10KRows,
      compressionTimeMsPer100KRows: this.latencyFactors.compressionTimeMsPer100KRows,
    });
    this.dataSizeCalculator = new ClickHouseDataSizeCalculator({
      averageArrayLength: this.averageArrayLength,
    });
    
    // Обновляем Keeper с конфигурируемыми параметрами
    this.keeper = new ClickHouseKeeper({
      baseLatency: this.keeperBaseLatency,
      operationLatencies: this.keeperOperationLatencies,
      quorumSize: this.keeperConfig.quorumSize,
      heartbeatInterval: this.keeperConfig.heartbeatIntervalMs,
      operationTimeout: this.keeperConfig.operationTimeoutMs,
      networkLatencyPerNode: this.keeperConfig.networkLatencyPerNodeMs,
    });

    // Initialize tables
    this.tables.clear();
    this.tableStorage.clear();
    this.tableParts.clear();
    this.tableEngines.clear();
    
    if (config.tables) {
      for (const table of config.tables) {
        const tableKey = `${table.database || 'default'}.${table.name}`;
        this.tables.set(tableKey, { ...table });
        
        // Initialize columnar storage
        if (table.columns && table.columns.length > 0) {
          const storage = new ClickHouseTableStorage({
            columns: table.columns,
            compressionType: this.compression,
            hasIndexes: true,
            sampleSize: this.sampleSize,
          });
          this.tableStorage.set(tableKey, storage);
        } else {
          // Fallback: create storage with empty columns (will be updated later)
          const storage = new ClickHouseTableStorage({
            columns: [],
            compressionType: this.compression,
            hasIndexes: true,
          });
          this.tableStorage.set(tableKey, storage);
        }
        
        this.tableParts.set(tableKey, []);
        
        // Initialize table engine
        this.initializeTableEngine(tableKey, table.engine || 'MergeTree', table.columns || []);
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

    if (config.clusterNodes !== undefined) {
      this.clusterNodes = config.clusterNodes;
    }

    if (config.shards !== undefined) {
      this.shards = config.shards;
    }

    if (config.replicas !== undefined) {
      this.replicas = config.replicas;
    }

    if (config.keeperNodes !== undefined) {
      this.keeperNodes = config.keeperNodes;
    }

    if (config.maxMemoryUsage) {
      this.maxMemoryUsage = config.maxMemoryUsage;
    }

    if (config.compression) {
      this.compression = config.compression;
    }
    
    // Синхронизируем конфигурируемые параметры (избегание хардкода)
    if (config.networkBandwidthMBps !== undefined) {
      this.networkBandwidthMBps = config.networkBandwidthMBps;
    }
    if (config.keeperBaseLatency !== undefined) {
      this.keeperBaseLatency = config.keeperBaseLatency;
      this.keeper.updateBaseLatency(this.keeperBaseLatency);
    }
    if (config.keeperOperationLatencies) {
      this.keeperOperationLatencies = {
        INSERT: config.keeperOperationLatencies.INSERT ?? this.keeperOperationLatencies.INSERT,
        MERGE: config.keeperOperationLatencies.MERGE ?? this.keeperOperationLatencies.MERGE,
        MUTATION: config.keeperOperationLatencies.MUTATION ?? this.keeperOperationLatencies.MUTATION,
        REPLICATE: config.keeperOperationLatencies.REPLICATE ?? this.keeperOperationLatencies.REPLICATE,
      };
      this.keeper.updateOperationLatencies(this.keeperOperationLatencies);
    }
    if (config.baseOperationLatencies) {
      this.baseOperationLatencies = {
        SELECT: config.baseOperationLatencies.SELECT ?? this.baseOperationLatencies.SELECT,
        INSERT: config.baseOperationLatencies.INSERT ?? this.baseOperationLatencies.INSERT,
        ALTER: config.baseOperationLatencies.ALTER ?? this.baseOperationLatencies.ALTER,
        CREATE: config.baseOperationLatencies.CREATE ?? this.baseOperationLatencies.CREATE,
        DROP: config.baseOperationLatencies.DROP ?? this.baseOperationLatencies.DROP,
      };
      this.latencyCalculator = new ClickHouseLatencyCalculator({
        baseSelectLatency: this.baseOperationLatencies.SELECT,
        baseInsertLatency: this.baseOperationLatencies.INSERT,
        baseAlterLatency: this.baseOperationLatencies.ALTER,
        baseCreateLatency: this.baseOperationLatencies.CREATE,
        baseDropLatency: this.baseOperationLatencies.DROP,
      });
    }
    if (config.averageArrayLength !== undefined) {
      this.averageArrayLength = config.averageArrayLength;
      this.dataSizeCalculator = new ClickHouseDataSizeCalculator({
        averageArrayLength: this.averageArrayLength,
      });
    }
    if (config.sampleSize !== undefined) {
      this.sampleSize = config.sampleSize;
    }
    
    // Синхронизируем дополнительные конфигурируемые параметры
    if (config.latencyFactors) {
      this.latencyFactors = {
        compressionDecompressionMsPerMB: config.latencyFactors.compressionDecompressionMsPerMB ?? this.latencyFactors.compressionDecompressionMsPerMB,
        networkLatencyPerNodeMs: config.latencyFactors.networkLatencyPerNodeMs ?? this.latencyFactors.networkLatencyPerNodeMs,
        columnarReadFactor: config.latencyFactors.columnarReadFactor ?? this.latencyFactors.columnarReadFactor,
        indexSpeedupFactor: config.latencyFactors.indexSpeedupFactor ?? this.latencyFactors.indexSpeedupFactor,
        partsOverheadMsPerPart: config.latencyFactors.partsOverheadMsPerPart ?? this.latencyFactors.partsOverheadMsPerPart,
        defaultColumnsCount: config.latencyFactors.defaultColumnsCount ?? this.latencyFactors.defaultColumnsCount,
        writeTimeMsPer10KRows: config.latencyFactors.writeTimeMsPer10KRows ?? this.latencyFactors.writeTimeMsPer10KRows,
        compressionTimeMsPer100KRows: config.latencyFactors.compressionTimeMsPer100KRows ?? this.latencyFactors.compressionTimeMsPer100KRows,
      };
      // Обновляем LatencyCalculator с новыми параметрами
      this.latencyCalculator = new ClickHouseLatencyCalculator({
        baseSelectLatency: this.baseOperationLatencies.SELECT,
        baseInsertLatency: this.baseOperationLatencies.INSERT,
        baseAlterLatency: this.baseOperationLatencies.ALTER,
        baseCreateLatency: this.baseOperationLatencies.CREATE,
        baseDropLatency: this.baseOperationLatencies.DROP,
        compressionDecompressionMsPerMB: this.latencyFactors.compressionDecompressionMsPerMB,
        networkLatencyPerNodeMs: this.latencyFactors.networkLatencyPerNodeMs,
        columnarReadFactor: this.latencyFactors.columnarReadFactor,
        indexSpeedupFactor: this.latencyFactors.indexSpeedupFactor,
        partsOverheadMsPerPart: this.latencyFactors.partsOverheadMsPerPart,
        defaultColumnsCount: this.latencyFactors.defaultColumnsCount,
        writeTimeMsPer10KRows: this.latencyFactors.writeTimeMsPer10KRows,
        compressionTimeMsPer100KRows: this.latencyFactors.compressionTimeMsPer100KRows,
      });
    }
    if (config.replicationLatency) {
      this.replicationLatency = {
        networkLatencyPerReplicaMs: config.replicationLatency.networkLatencyPerReplicaMs ?? this.replicationLatency.networkLatencyPerReplicaMs,
        partsLatencyMsPerPart: config.replicationLatency.partsLatencyMsPerPart ?? this.replicationLatency.partsLatencyMsPerPart,
      };
    }
    if (config.distributionLatency) {
      this.distributionLatency = {
        baseLatencyMs: config.distributionLatency.baseLatencyMs ?? this.distributionLatency.baseLatencyMs,
        networkLatencyPerShardMs: config.distributionLatency.networkLatencyPerShardMs ?? this.distributionLatency.networkLatencyPerShardMs,
        replicaLatencyMs: config.distributionLatency.replicaLatencyMs ?? this.distributionLatency.replicaLatencyMs,
      };
    }
    if (config.keeperConfig) {
      this.keeperConfig = {
        quorumSize: config.keeperConfig.quorumSize ?? this.keeperConfig.quorumSize,
        heartbeatIntervalMs: config.keeperConfig.heartbeatIntervalMs ?? this.keeperConfig.heartbeatIntervalMs,
        operationTimeoutMs: config.keeperConfig.operationTimeoutMs ?? this.keeperConfig.operationTimeoutMs,
        networkLatencyPerNodeMs: config.keeperConfig.networkLatencyPerNodeMs ?? this.keeperConfig.networkLatencyPerNodeMs,
      };
      // Обновляем Keeper с новыми параметрами (создаем новый экземпляр, так как параметры readonly)
      this.keeper = new ClickHouseKeeper({
        baseLatency: this.keeperBaseLatency,
        operationLatencies: this.keeperOperationLatencies,
        quorumSize: this.keeperConfig.quorumSize,
        heartbeatInterval: this.keeperConfig.heartbeatIntervalMs,
        operationTimeout: this.keeperConfig.operationTimeoutMs,
        networkLatencyPerNode: this.keeperConfig.networkLatencyPerNodeMs,
      });
    }

    if (config.tables) {
      // Update tables from config
      for (const table of config.tables) {
        const tableKey = `${table.database || 'default'}.${table.name}`;
        const existingTable = this.tables.get(tableKey);
        const existingStorage = this.tableStorage.get(tableKey);
        
        if (existingTable) {
          // Update existing table metadata, preserve data from runtime
          const rowCount = existingStorage ? existingStorage.getRowCount() : 0;
          
          // Рассчитываем размер динамически на основе колоночного хранения
          const calculatedSize = table.columns && rowCount > 0
            ? this.dataSizeCalculator.calculateTableSize({
                columns: table.columns,
                rows: rowCount,
                compressionType: this.compression,
                hasIndexes: true,
              })
            : existingTable.size || 0;
          
          this.tables.set(tableKey, {
            ...table,
            rows: rowCount,
            size: calculatedSize,
          });
          
          // Update storage if columns changed
          if (table.columns && table.columns.length > 0) {
            if (existingStorage) {
              existingStorage.updateConfig({
                columns: table.columns,
                compressionType: this.compression,
                hasIndexes: true,
              });
            } else {
              const storage = new ClickHouseTableStorage({
                columns: table.columns,
                compressionType: this.compression,
                hasIndexes: true,
              });
              this.tableStorage.set(tableKey, storage);
            }
          }

          // Update or create table engine
          if (!this.tableEngines.has(tableKey)) {
            this.initializeTableEngine(tableKey, table.engine || 'MergeTree', table.columns || []);
          }
        } else {
          // New table - initialize empty
          this.tables.set(tableKey, { ...table, rows: 0, size: 0 });
          
          if (!this.tableStorage.has(tableKey)) {
            const storage = new ClickHouseTableStorage({
              columns: table.columns || [],
              compressionType: this.compression,
              hasIndexes: true,
            });
            this.tableStorage.set(tableKey, storage);
            this.tableParts.set(tableKey, []);
          }

          // Initialize table engine
          if (!this.tableEngines.has(tableKey)) {
            this.initializeTableEngine(tableKey, table.engine || 'MergeTree', table.columns || []);
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
   * Execute SELECT query with columnar storage and column pruning
   */
  private executeSelect(query: string, startTime: number): QueryResult {
    // Use SQL parser for proper parsing
    const parseResult = this.sqlParser.parseSelect(query);
    
    if (!parseResult.success || !parseResult.result) {
      return {
        success: false,
        error: parseResult.error || 'Invalid SELECT query',
        latency: Date.now() - startTime,
      };
    }

    const parsed = parseResult.result;
    const tableName = parsed.from;
    const tableKey = this.normalizeTableKey(tableName);
    
    const table = this.tables.get(tableKey);
    if (!table) {
      return {
        success: false,
        error: `Table ${tableName} does not exist`,
        latency: Date.now() - startTime,
      };
    }

    const storage = this.tableStorage.get(tableKey);
    if (!storage) {
      return {
        success: false,
        error: `Table storage for ${tableName} is not initialized`,
        latency: Date.now() - startTime,
      };
    }

    // Parse columns for column pruning
    const columnNames = parsed.columns.includes('*') ? undefined : parsed.columns;
    
    // Parse PREWHERE clause (executed before WHERE for optimization)
    let prewhereFilterFunction: ((row: Record<string, any>) => boolean) | undefined;
    if (parsed.prewhere) {
      prewhereFilterFunction = this.buildFilterFunction(parsed.prewhere);
    }
    
    // Parse WHERE clause
    let filterFunction: ((row: Record<string, any>) => boolean) | undefined;
    if (parsed.where) {
      filterFunction = this.buildFilterFunction(parsed.where);
    }
    
    // Combine PREWHERE and WHERE filters
    const combinedFilter = prewhereFilterFunction && filterFunction
      ? (row: Record<string, any>) => prewhereFilterFunction!(row) && filterFunction!(row)
      : prewhereFilterFunction || filterFunction;

    // Use parsed ORDER BY, LIMIT, SAMPLE, FINAL
    const orderBy = parsed.orderBy && parsed.orderBy.length > 0 ? parsed.orderBy[0].column : undefined;
    const orderDirection = parsed.orderBy && parsed.orderBy.length > 0 ? parsed.orderBy[0].direction : undefined;
    const limit = parsed.limit;
    const sample = parsed.sample;
    const final = parsed.final || false;

    // Get or create table engine
    let engine = this.tableEngines.get(tableKey);
    if (!engine) {
      this.initializeTableEngine(tableKey, table.engine || 'MergeTree', table.columns || []);
      engine = this.tableEngines.get(tableKey)!;
    }

    // Use engine for SELECT with column pruning, SAMPLE, and FINAL support
    let resultRows: Record<string, any>[];
    
    // Check for GROUP BY
    if (parsed.groupBy && parsed.groupBy.length > 0) {
      // For GROUP BY, use engine to read rows with SAMPLE and FINAL support
      const allRows = engine.select({
        columnNames: columnNames,
        filter: combinedFilter,
        sample,
        final,
        storage,
      });
      
      const groupColumns = parsed.groupBy;
      const groups = new Map<string, number>();
      allRows.forEach(row => {
        const key = groupColumns.map(col => String(row[col] || 'null')).join('|');
        groups.set(key, (groups.get(key) || 0) + 1);
      });
      
      resultRows = Array.from(groups.entries()).map(([key, count]) => {
        const values = key.split('|');
        const result: Record<string, any> = { count };
        groupColumns.forEach((col, idx) => {
          result[col] = values[idx];
        });
        return result;
      });
      
      // Apply ORDER BY and LIMIT to grouped results
      if (orderBy) {
        resultRows.sort((a, b) => {
          const aVal = a[orderBy];
          const bVal = b[orderBy];
          if (orderDirection === 'DESC') {
            return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
          }
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        });
      }
      
      if (limit !== undefined && limit > 0) {
        resultRows = resultRows.slice(0, limit);
      }
    } else {
      // Regular SELECT with column pruning, SAMPLE, and FINAL support
      resultRows = engine.select({
        columnNames: columnNames, // Column pruning: read only requested columns
        filter: combinedFilter,
        orderBy: orderBy,
        orderDirection: orderDirection,
        limit: limit,
        sample,
        final,
        storage,
      });
    }

    // Calculate latency using LatencyCalculator
    // For column pruning, calculate data size based on columns read
    const columnsRead = columnNames ? columnNames.length : (table.columns?.length || 0);
    const queryComplexity = this.latencyCalculator.estimateQueryComplexity(query);
    const parts = this.tableParts.get(tableKey) || [];
    
    // Calculate data size for columns read (column pruning optimization)
    const dataSizeForColumns = columnNames && table.columns
      ? storage.getSizeForColumns(columnNames)
      : table.size;
    
    const latency = this.latencyCalculator.calculateLatency({
      operationType: 'SELECT',
      rowsScanned: storage.getRowCount(),
      columnsRead: columnsRead > 0 ? columnsRead : undefined,
      queryComplexity,
      partsCount: parts.length,
      hasIndexes: true,
      compressionEnabled: this.compression !== 'None',
      clusterNodes: this.clusterNodes,
      tableSize: dataSizeForColumns, // Use size of columns read (column pruning)
    });

    return {
      success: true,
      latency,
      rows: resultRows,
      rowCount: resultRows.length,
      columns: columnNames || (table.columns?.map(c => c.name) || []),
      dataRead: storage.getRowCount(),
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

    // Get or create storage
    let storage = this.tableStorage.get(tableKey);
    if (!storage) {
      // Create storage if it doesn't exist
      storage = new ClickHouseTableStorage({
        columns: table.columns || [],
        compressionType: this.compression,
        hasIndexes: true,
        sampleSize: this.sampleSize,
      });
      this.tableStorage.set(tableKey, storage);
    }

    // Simple parsing - assume single row for now
    const valuesStr = valuesMatch[1].trim();
    const values = this.parseValues(valuesStr);

    // Build row object
    const newRow: Record<string, any> = {};
    
    // Parse columns if specified
    const columnsMatch = query.match(/\(([^)]+)\)\s+VALUES/i);
    const columns = columnsMatch ? columnsMatch[1].split(',').map(c => c.trim()) : [];
    
    if (columns.length > 0 && columns.length === values.length) {
      columns.forEach((col, idx) => {
        newRow[col] = values[idx];
      });
    } else if (table.columns && table.columns.length > 0) {
      // Use table column definitions
      table.columns.forEach((col, idx) => {
        if (idx < values.length) {
          newRow[col.name] = values[idx];
        }
      });
    } else {
      // Fallback: assume all values are for all columns in order
      values.forEach((val, idx) => {
        newRow[`column_${idx}`] = val;
      });
    }

    // Get or create table engine
    let engine = this.tableEngines.get(tableKey);
    if (!engine) {
      this.initializeTableEngine(tableKey, table.engine || 'MergeTree', table.columns || []);
      engine = this.tableEngines.get(tableKey)!;
    }

    // Insert row using engine
    const newParts = engine.insert({
      rows: [newRow],
      storage,
      compressionType: this.compression,
    });

    // Update table parts
    const existingParts = this.tableParts.get(tableKey) || [];
    existingParts.push(...newParts);
    this.tableParts.set(tableKey, existingParts);

    // Update table metadata - размер рассчитывается динамически в storage
    table.rows = storage.getRowCount();
    table.size = storage.getTotalSize();
    this.tables.set(tableKey, table);

    // Calculate latency using LatencyCalculator
    const parts = this.tableParts.get(tableKey) || [];
    const latency = this.latencyCalculator.calculateLatency({
      operationType: 'INSERT',
      rowsWritten: 1,
      partsCount: parts.length,
      compressionEnabled: this.compression !== 'None',
      clusterNodes: this.clusterNodes,
    });

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
    // Use SQL parser for proper parsing
    const parseResult = this.sqlParser.parseCreateTable(query);
    
    if (!parseResult.success || !parseResult.result) {
      return {
        success: false,
        error: parseResult.error || 'Invalid CREATE TABLE query',
        latency: Date.now() - startTime,
      };
    }

    const parsed = parseResult.result;
    const tableKey = this.normalizeTableKey(
      parsed.database ? `${parsed.database}.${parsed.table}` : parsed.table
    );
    
    // Check IF NOT EXISTS
    if (this.tables.has(tableKey)) {
      if (parsed.ifNotExists) {
        // Table already exists, but IF NOT EXISTS was specified - return success
        return {
          success: true,
          latency: Date.now() - startTime,
        };
      }
      return {
        success: false,
        error: `Table ${parsed.database ? `${parsed.database}.` : ''}${parsed.table} already exists`,
        latency: Date.now() - startTime,
      };
    }

    // Validate column types
    for (const column of parsed.columns) {
      if (!this.sqlParser.validateType(column.type)) {
        return {
          success: false,
          error: `Invalid type for column ${column.name}: ${column.type}`,
          latency: Date.now() - startTime,
        };
      }
    }

    // Parse database (default: default)
    const database = parsed.database || 'default';
    const name = parsed.table;
    
    const newTable: ClickHouseTable = {
      name,
      database,
      engine: parsed.engine,
      columns: parsed.columns.map(c => ({ name: c.name, type: c.type })),
      rows: 0,
      size: 0,
      partitions: 0,
    };

    this.tables.set(tableKey, newTable);
    
    // Initialize columnar storage with parsed columns
    const storage = new ClickHouseTableStorage({
      columns: parsed.columns.map(c => ({ name: c.name, type: c.type })),
      compressionType: this.compression,
      hasIndexes: parsed.engineParams?.primaryKey !== undefined || parsed.engineParams?.orderBy !== undefined,
      sampleSize: this.sampleSize,
    });
    this.tableStorage.set(tableKey, storage);
    this.tableParts.set(tableKey, []);

    // Initialize table engine with parsed columns and engine params
    const engineConfig: TableEngineConfig = {
      orderBy: parsed.engineParams?.orderBy,
      partitionBy: parsed.engineParams?.partitionBy,
      primaryKey: parsed.engineParams?.primaryKey,
      sampleBy: parsed.engineParams?.sampleBy,
      ttl: parsed.engineParams?.ttl,
      settings: parsed.engineParams?.settings,
    };
    
    this.initializeTableEngine(tableKey, parsed.engine, parsed.columns.map(c => ({ name: c.name, type: c.type })), engineConfig);

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
    this.tableStorage.delete(tableKey);
    this.tableParts.delete(tableKey);
    this.tableEngines.delete(tableKey);

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
   * @deprecated Используйте latencyCalculator.calculateLatency вместо этого метода
   */
  private calculateQueryLatency(query: string, table: ClickHouseTable, rowsScanned: number): number {
    // Этот метод оставлен для обратной совместимости, но теперь использует LatencyCalculator
    const columnsRead = this.latencyCalculator.countColumnsInSelect(query);
    const queryComplexity = this.latencyCalculator.estimateQueryComplexity(query);
    const parts = this.tableParts.get(`${table.database}.${table.name}`) || [];
    
    return this.latencyCalculator.calculateLatency({
      operationType: 'SELECT',
      rowsScanned,
      columnsRead: columnsRead > 0 ? columnsRead : undefined,
      queryComplexity,
      partsCount: parts.length,
      hasIndexes: true,
      compressionEnabled: this.compression !== 'None',
      clusterNodes: this.clusterNodes,
      tableSize: table.size,
    });
  }

  /**
   * Build filter function from WHERE/PREWHERE clause
   */
  private buildFilterFunction(clause: string): ((row: Record<string, any>) => boolean) | undefined {
    if (!clause) return undefined;
    
    // Simple equality: column = value
    const eqMatch = clause.match(/(\w+)\s*=\s*['"]?([^'"\s]+)['"]?/);
    if (eqMatch) {
      const column = eqMatch[1];
      const value = eqMatch[2];
      return (row: Record<string, any>) => String(row[column]) === value;
    }
    
    // Simple inequality: column != value
    const neMatch = clause.match(/(\w+)\s*!=\s*['"]?([^'"\s]+)['"]?/);
    if (neMatch) {
      const column = neMatch[1];
      const value = neMatch[2];
      return (row: Record<string, any>) => String(row[column]) !== value;
    }
    
    // Simple comparison: column > value, column < value, etc.
    const gtMatch = clause.match(/(\w+)\s*>\s*['"]?([^'"\s]+)['"]?/);
    if (gtMatch) {
      const column = gtMatch[1];
      const value = parseFloat(gtMatch[2]);
      if (!isNaN(value)) {
        return (row: Record<string, any>) => parseFloat(String(row[column])) > value;
      }
    }
    
    const ltMatch = clause.match(/(\w+)\s*<\s*['"]?([^'"\s]+)['"]?/);
    if (ltMatch) {
      const column = ltMatch[1];
      const value = parseFloat(ltMatch[2]);
      if (!isNaN(value)) {
        return (row: Record<string, any>) => parseFloat(String(row[column])) < value;
      }
    }
    
    // Default: return true (no filter)
    return undefined;
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
   * Initialize table engine based on engine type
   */
  private initializeTableEngine(
    tableKey: string,
    engineType: string,
    columns: Array<{ name: string; type: string }>,
    providedConfig?: Partial<TableEngineConfig>
  ): void {
    let engine: ClickHouseTableEngine;

    // Create engine based on type
    switch (engineType.toUpperCase()) {
      case 'MERGETREE':
        engine = new MergeTreeEngine();
        break;
      case 'REPLACINGMERGETREE':
        engine = new ReplacingMergeTreeEngine();
        break;
      case 'SUMMINGMERGETREE':
        engine = new SummingMergeTreeEngine();
        break;
      case 'AGGREGATINGMERGETREE':
        engine = new AggregatingMergeTreeEngine();
        break;
      case 'REPLICATEDMERGETREE':
        engine = new ReplicatedMergeTreeEngine(this.keeper, {
          networkLatencyPerReplicaMs: this.replicationLatency.networkLatencyPerReplicaMs,
          partsLatencyMsPerPart: this.replicationLatency.partsLatencyMsPerPart,
        });
        break;
      case 'DISTRIBUTED':
        engine = new DistributedEngine({
          baseLatencyMs: this.distributionLatency.baseLatencyMs,
          networkLatencyPerShardMs: this.distributionLatency.networkLatencyPerShardMs,
          replicaLatencyMs: this.distributionLatency.replicaLatencyMs,
        });
        break;
      default:
        // Default to MergeTree for unknown engines
        engine = new MergeTreeEngine();
        break;
    }

    // Parse ORDER BY from provided config or use first column as default
    const orderBy = providedConfig?.orderBy || (columns.length > 0 ? [columns[0].name] : undefined);
    const primaryKey = providedConfig?.primaryKey || orderBy;

    // Initialize engine configuration
    // Передаем конфигурацию кластера через settings для движков, которые ее используют
    const [database, tableName] = tableKey.includes('.') ? tableKey.split('.') : ['default', tableKey];
    const engineConfig: TableEngineConfig = {
      engine: engineType,
      orderBy,
      primaryKey,
      partitionBy: providedConfig?.partitionBy,
      sampleBy: providedConfig?.sampleBy,
      ttl: providedConfig?.ttl,
      settings: {
        // Конфигурация кластера для ReplicatedMergeTree и Distributed
        cluster: this.cluster,
        database,
        table: tableName,
        replicas: this.replicas,
        shards: this.shards,
        keeperNodes: this.keeperNodes,
        clusterNodes: this.clusterNodes,
        tableName: tableName, // Передаем имя таблицы для формирования пути в Keeper
        shard: 0, // Можно улучшить в будущем для поддержки нескольких шардов
        replicaIndex: 0, // Можно улучшить в будущем для поддержки нескольких реплик на одной таблице
        networkBandwidthMBps: this.networkBandwidthMBps, // Пропускная способность сети для DistributedEngine
        // Merge provided settings with cluster settings
        ...providedConfig?.settings,
      },
    };

    engine.initialize(engineConfig);
    this.tableEngines.set(tableKey, engine);
  }

  /**
   * Simulate background merge operations
   * Вызывается периодически для объединения parts
   * Использует MergePolicy для выбора parts с учетом свободного места
   */
  public performBackgroundMerge(): void {
    // Рассчитываем процент свободного места на основе использования памяти
    const memoryUsagePercent = this.metrics.memoryUsagePercent || 0;
    const freeSpacePercent = Math.max(0, 100 - memoryUsagePercent);

    for (const [tableKey, engine] of this.tableEngines.entries()) {
      const storage = this.tableStorage.get(tableKey);
      if (!storage) continue;

      const parts = this.tableParts.get(tableKey) || [];
      if (parts.length < 2) continue; // Нужно минимум 2 parts для merge

      // Выполняем merge через движок с учетом свободного места
      // MergePolicy использует freeSpacePercent для определения лимитов merge
      const mergedParts = engine.merge({
        parts,
        storage,
        freeSpacePercent,
      });

      // Обновляем parts после merge
      if (mergedParts.length > 0) {
        // Для ReplicatedMergeTree обновляем parts в Keeper
        if (engine instanceof ReplicatedMergeTreeEngine) {
          engine.updatePartsInKeeper();
        }
        
        // Удаляем старые parts и добавляем объединенные
        // (движок уже обновил свои внутренние parts, нужно синхронизировать)
        const engineParts = engine.getParts();
        this.tableParts.set(tableKey, engineParts);
      }
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

    // Count total rows and calculate size using columnar storage
    let totalRows = 0;
    let totalSize = 0;
    let totalParts = 0;
    let totalUncompressedSize = 0;
    
    for (const [tableKey, table] of this.tables.entries()) {
      const storage = this.tableStorage.get(tableKey);
      
      if (storage) {
        // Use columnar storage metrics
        const rowCount = storage.getRowCount();
        const size = storage.getTotalSize();
        const uncompressedSize = storage.getTotalUncompressedSize();
        
        totalRows += rowCount;
        totalSize += size;
        totalUncompressedSize += uncompressedSize;
        
        // Update table metadata from storage
        table.rows = rowCount;
        table.size = size;
      } else {
        // Fallback if storage doesn't exist
        totalRows += table.rows;
        totalSize += table.size;
        totalUncompressedSize += table.size * (this.metrics.compressionRatio || 1.0);
      }
      
      const parts = this.tableParts.get(tableKey) || [];
      totalParts += parts.length;
    }
    
    this.metrics.totalRows = totalRows;
    this.metrics.totalSize = totalSize;
    this.metrics.partsCount = totalParts;
    
    // Рассчитываем compression ratio динамически
    if (totalUncompressedSize > 0 && totalSize > 0) {
      this.metrics.compressionRatio = totalUncompressedSize / totalSize;
    } else if (totalSize > 0) {
      // Если нет данных, рассчитываем на основе типа сжатия
      this.metrics.compressionRatio = this.compressionCalculator.calculateCompressionRatio({
        compressionType: this.compression,
        dataSize: totalSize,
        dataType: 'mixed',
      });
    }

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

    // Memory usage - используем рассчитанный compression ratio
    // totalSize уже с учетом сжатия, поэтому memoryUsage = totalSize
    this.metrics.memoryUsage = totalSize;
    this.metrics.memoryUsagePercent = (totalSize / this.maxMemoryUsage) * 100;

    // Pending merges - используем метрики из движков
    let totalPendingMerges = 0;
    for (const [tableKey, engine] of this.tableEngines.entries()) {
      const engineMetrics = engine.getMetrics();
      totalPendingMerges += engineMetrics.pendingMerges;
    }
    this.metrics.pendingMerges = totalPendingMerges;

    // Cluster nodes - используем конфигурацию
    this.metrics.clusterNodes = this.clusterNodes;
    // Рассчитываем здоровые узлы на основе Keeper статистики
    if (this.replication || this.replicas > 1) {
      const keeperStats = this.keeper.getStats();
      // Здоровые узлы = количество здоровых реплик в Keeper
      this.metrics.healthyNodes = keeperStats.healthyReplicasCount || this.clusterNodes;
    } else {
      this.metrics.healthyNodes = this.clusterNodes; // предполагаем все узлы здоровы
    }

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

    // Get or create storage
    let storage = this.tableStorage.get(tableKey);
    if (!storage) {
      storage = new ClickHouseTableStorage({
        columns: table.columns || [],
        compressionType: this.compression,
        hasIndexes: true,
        sampleSize: this.sampleSize,
      });
      this.tableStorage.set(tableKey, storage);
    }

    // Get or create table engine
    let engine = this.tableEngines.get(tableKey);
    if (!engine) {
      this.initializeTableEngine(tableKey, table.engine || 'MergeTree', table.columns || []);
      engine = this.tableEngines.get(tableKey)!;
    }

    // Insert rows using engine
    const newParts = engine.insert({
      rows: data,
      storage,
      compressionType: this.compression,
    });

    // Update table parts
    const existingParts = this.tableParts.get(tableKey) || [];
    existingParts.push(...newParts);
    this.tableParts.set(tableKey, existingParts);

    // Update table metadata - размер рассчитывается динамически в storage
    table.rows = storage.getRowCount();
    table.size = storage.getTotalSize();
    this.tables.set(tableKey, table);

    this.updateMetrics();

    return { success: true, rowsInserted: data.length };
  }
}


/**
 * Distributed Engine Implementation
 * 
 * Движок ClickHouse для распределенных таблиц в кластере.
 * Поддерживает:
 * - Распределение данных по шардам
 * - Распределение запросов по шардам
 * - Агрегацию результатов с шардов
 * - Выбор шарда для записи (sharding key)
 * - Network latency при распределении запросов
 */

import { BaseTableEngine, TableEngineConfig, InsertOptions, SelectOptions, MergeOptions } from '../TableEngine';
import { ClickHouseTablePart } from '../../ClickHouseRoutingEngine';
import { ClickHouseTableStorage } from '../TableStorage';
import { ClickHouseLatencyCalculator } from '../LatencyCalculator';

export interface DistributedEngineConfig extends TableEngineConfig {
  cluster?: string; // Имя кластера
  database?: string; // Имя базы данных
  table?: string; // Имя локальной таблицы на каждом шарде
  shardingKey?: string; // Колонка для распределения данных по шардам (опционально)
  shards?: number; // Количество шардов
  replicas?: number; // Количество реплик на шард
  clusterNodes?: number; // Общее количество узлов в кластере
  networkBandwidthMBps?: number; // Пропускная способность сети в MB/s (конфигурируемый параметр)
}

/**
 * Distributed Engine
 * 
 * Реализует логику Distributed движка ClickHouse:
 * - Распределяет INSERT запросы по шардам
 * - Распределяет SELECT запросы по шардам
 * - Агрегирует результаты с шардов
 * - Учитывает network latency при распределении
 * - Симулирует выбор шарда для записи
 */
export class DistributedEngine extends BaseTableEngine {
  private distributedConfig: DistributedEngineConfig;
  private cluster: string = 'archiphoenix-cluster';
  private database: string = 'default';
  private table: string = '';
  private shardingKey?: string;
  private shards: number = 1;
  private replicas: number = 1;
  private clusterNodes: number = 1;
  private networkBandwidthMBps: number = 100; // Пропускная способность сети в MB/s (конфигурируемый параметр)
  private latencyCalculator: ClickHouseLatencyCalculator;
  // Конфигурируемые параметры для распределения (избегание хардкода)
  private baseLatencyMs: number = 5; // базовая задержка
  private networkLatencyPerShardMs: number = 3; // задержка на шард
  private replicaLatencyMs: number = 1; // задержка на реплику
  
  // Симуляция локальных таблиц на каждом шарде
  // В реальном ClickHouse Distributed таблица ссылается на локальные таблицы на каждом шарде
  // Для симуляции храним данные локально, но симулируем распределение
  private shardStorages: Map<number, ClickHouseTableStorage> = new Map();
  private shardParts: Map<number, ClickHouseTablePart[]> = new Map();

  constructor(config?: { baseLatencyMs?: number; networkLatencyPerShardMs?: number; replicaLatencyMs?: number }) {
    super();
    this.latencyCalculator = new ClickHouseLatencyCalculator();
    this.distributedConfig = {
      engine: 'Distributed',
    };
    this.baseLatencyMs = config?.baseLatencyMs ?? 5;
    this.networkLatencyPerShardMs = config?.networkLatencyPerShardMs ?? 3;
    this.replicaLatencyMs = config?.replicaLatencyMs ?? 1;
  }

  public initialize(config: TableEngineConfig): void {
    super.initialize(config);
    
    // Извлекаем параметры распределения из settings
    const settings = (config.settings as any) || {};
    const cluster = settings.cluster || (config as any).cluster || 'archiphoenix-cluster';
    const database = settings.database || (config as any).database || 'default';
    const table = settings.table || (config as any).table || '';
    const shardingKey = settings.shardingKey || (config as any).shardingKey;
    const shards = settings.shards || (config as any).shards || 1;
    const replicas = settings.replicas || (config as any).replicas || 1;
    const clusterNodes = settings.clusterNodes || (config as any).clusterNodes || 1;
    const networkBandwidthMBps = settings.networkBandwidthMBps || (config as any).networkBandwidthMBps || 100;
    
    this.distributedConfig = {
      ...this.distributedConfig,
      ...config,
      engine: 'Distributed',
      cluster,
      database,
      table,
      shardingKey,
      shards,
      replicas,
      clusterNodes,
    };
    
    this.cluster = cluster;
    this.database = database;
    this.table = table;
    this.shardingKey = shardingKey;
    this.shards = shards;
    this.replicas = replicas;
    this.clusterNodes = clusterNodes;
    
    // Инициализируем хранилища для каждого шарда
    this.shardStorages.clear();
    this.shardParts.clear();
    for (let i = 0; i < this.shards; i++) {
      this.shardStorages.set(i, new ClickHouseTableStorage({
        columns: [],
        compressionType: 'LZ4',
        hasIndexes: true,
      }));
      this.shardParts.set(i, []);
    }
  }

  /**
   * Вставка данных с распределением по шардам
   * В реальном ClickHouse данные распределяются по шардам на основе sharding key
   */
  public insert(options: InsertOptions): ClickHouseTablePart[] {
    const { rows, storage, compressionType } = options;
    const allNewParts: ClickHouseTablePart[] = [];
    
    // Распределяем строки по шардам
    const rowsByShard = this.distributeRowsByShard(rows);
    
    // Вставляем данные в каждый шард
    for (const [shardIndex, shardRows] of rowsByShard.entries()) {
      if (shardRows.length === 0) continue;
      
      const shardStorage = this.shardStorages.get(shardIndex);
      if (!shardStorage) continue;
      
      // Вставляем данные в storage шарда
      shardStorage.insertRows(shardRows);
      
      // Создаем parts для шарда (упрощенная симуляция)
      // В реальном ClickHouse каждый шард имеет свою локальную таблицу с движком
      const shardParts = this.shardParts.get(shardIndex) || [];
      const newPart = this.createPartForShard(shardStorage, shardIndex, compressionType);
      shardParts.push(newPart);
      this.shardParts.set(shardIndex, shardParts);
      
      allNewParts.push(newPart);
    }
    
    // Симулируем network latency при распределении
    // В реальном ClickHouse запросы отправляются на удаленные шарды
    // Рассчитываем общий размер данных для более точного расчета latency
    const totalDataSize = allNewParts.reduce((sum, part) => sum + part.size, 0);
    const distributionLatency = this.calculateDistributionLatency(this.shards, totalDataSize);
    
    return allNewParts;
  }

  /**
   * Выборка данных с распределением по шардам и агрегацией результатов
   * В реальном ClickHouse запросы выполняются на всех шардах, результаты агрегируются
   */
  public select(options: SelectOptions): Record<string, any>[] {
    const { columnNames, filter, orderBy, orderDirection, limit, sample, final, storage } = options;
    
    // Выполняем запрос на каждом шарде
    const resultsByShard: Record<string, any>[][] = [];
    
    for (let shardIndex = 0; shardIndex < this.shards; shardIndex++) {
      const shardStorage = this.shardStorages.get(shardIndex);
      if (!shardStorage) continue;
      
      // Читаем данные из шарда
      const shardRows = shardStorage.selectRows({
        columnNames,
        filter,
        orderBy,
        orderDirection,
        limit: limit ? Math.ceil(limit / this.shards) : undefined, // Распределяем limit по шардам
      });
      
      resultsByShard.push(shardRows);
    }
    
    // Агрегируем результаты с шардов
    // В реальном ClickHouse это зависит от типа запроса (GROUP BY, ORDER BY, etc.)
    let aggregatedResults: Record<string, any>[] = [];
    
    // Простая агрегация: объединяем все результаты
    for (const shardResults of resultsByShard) {
      aggregatedResults = aggregatedResults.concat(shardResults);
    }
    
    // Применяем ORDER BY к агрегированным результатам
    if (orderBy) {
      aggregatedResults.sort((a, b) => {
        const aVal = a[orderBy];
        const bVal = b[orderBy];
        if (orderDirection === 'DESC') {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      });
    }
    
    // Применяем LIMIT к агрегированным результатам
    if (limit !== undefined && limit > 0) {
      aggregatedResults = aggregatedResults.slice(0, limit);
    }
    
    // Применяем SAMPLE к результатам
    if (sample !== undefined && sample > 0 && sample < 1) {
      const sampleCount = Math.floor(aggregatedResults.length * sample);
      aggregatedResults = aggregatedResults.slice(0, sampleCount);
    }
    
    // Симулируем network latency при распределении запросов
    // В реальном ClickHouse запросы отправляются на удаленные шарды
    // Рассчитываем размер данных для более точного расчета latency
    const totalDataSize = aggregatedResults.reduce((sum, row) => {
      // Примерный размер строки (можно улучшить с помощью DataSizeCalculator)
      return sum + JSON.stringify(row).length;
    }, 0);
    const distributionLatency = this.calculateDistributionLatency(this.shards, totalDataSize);
    
    return aggregatedResults;
  }

  /**
   * Объединение parts (merge)
   * В Distributed движке merge происходит на каждом шарде отдельно
   */
  public merge(options: MergeOptions): ClickHouseTablePart[] {
    const { freeSpacePercent = 100 } = options;
    const allMergedParts: ClickHouseTablePart[] = [];
    
    // Выполняем merge на каждом шарде отдельно
    for (let shardIndex = 0; shardIndex < this.shards; shardIndex++) {
      const shardParts = this.shardParts.get(shardIndex) || [];
      if (shardParts.length < 2) continue;
      
      // Определяем группы parts для merge
      const mergeGroups = this.getPartsToMerge(freeSpacePercent);
      
      // Объединяем каждую группу
      for (const group of mergeGroups) {
        const mergedPart = this.mergeParts(group);
        allMergedParts.push(mergedPart);
        
        // Удаляем старые parts и добавляем объединенный
        for (const oldPart of group) {
          const index = shardParts.findIndex(p => p.name === oldPart.name);
          if (index >= 0) {
            shardParts.splice(index, 1);
          }
        }
        shardParts.push(mergedPart);
      }
      
      this.shardParts.set(shardIndex, shardParts);
    }
    
    return allMergedParts;
  }

  /**
   * Распределить строки по шардам
   * В реальном ClickHouse это делается на основе sharding key
   */
  private distributeRowsByShard(rows: Record<string, any>[]): Map<number, Record<string, any>[]> {
    const rowsByShard = new Map<number, Record<string, any>[]>();
    
    // Инициализируем массивы для каждого шарда
    for (let i = 0; i < this.shards; i++) {
      rowsByShard.set(i, []);
    }
    
    // Распределяем строки по шардам
    for (const row of rows) {
      const shardIndex = this.getShardIndexForRow(row);
      const shardRows = rowsByShard.get(shardIndex) || [];
      shardRows.push(row);
      rowsByShard.set(shardIndex, shardRows);
    }
    
    return rowsByShard;
  }

  /**
   * Определить индекс шарда для строки
   * В реальном ClickHouse это делается на основе sharding key
   */
  private getShardIndexForRow(row: Record<string, any>): number {
    // Если указан sharding key, используем его значение для распределения
    if (this.shardingKey && row[this.shardingKey] !== undefined) {
      const shardingValue = row[this.shardingKey];
      // Используем хеш от значения для равномерного распределения
      const hash = this.hashString(String(shardingValue));
      return hash % this.shards;
    }
    
    // Если sharding key не указан, используем round-robin или случайное распределение
    // В реальном ClickHouse можно использовать различные стратегии
    // Для симуляции используем случайное распределение
    return Math.floor(Math.random() * this.shards);
  }

  /**
   * Простая хеш-функция для строк
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Создать part для шарда
   */
  private createPartForShard(
    storage: ClickHouseTableStorage,
    shardIndex: number,
    compressionType: 'LZ4' | 'ZSTD' | 'LZ4HC' | 'None'
  ): ClickHouseTablePart {
    const rowCount = storage.getRowCount();
    const totalSize = storage.getTotalSize();
    
    // Генерируем имя part с указанием шарда
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const partName = `part-shard${shardIndex}-${dateStr}-${timeStr}-${randomStr}`;
    
    const minDate = now.toISOString().split('T')[0];
    const maxDate = minDate;
    
    return {
      name: partName,
      minDate,
      maxDate,
      rows: rowCount,
      size: totalSize,
      level: 0,
    };
  }

  /**
   * Рассчитать latency распределения запросов
   * Учитывает количество шардов, реплик, network latency и размер данных
   */
  private calculateDistributionLatency(shards: number, dataSize?: number): number {
    // Базовый latency для распределения запроса (конфигурируемый)
    
    // Network latency между узлами кластера
    // В реальном ClickHouse это зависит от network topology и расстояния между узлами
    // Учитываем, что запросы могут выполняться параллельно на всех шардах
    const totalNetworkLatency = this.networkLatencyPerShardMs * Math.min(shards, 4); // Ограничиваем влияние большого количества шардов
    
    // Latency зависит от размера данных (больше данных = больше времени на передачу)
    let dataLatency = 0;
    if (dataSize !== undefined && dataSize > 0) {
      // Расчет на основе конфигурируемого network bandwidth
      // networkBandwidthMBps в MB/s, переводим в bytes/ms: (MB/s * 1024 * 1024) / 1000
      const bandwidthBytesPerMs = (this.networkBandwidthMBps * 1024 * 1024) / 1000;
      dataLatency = dataSize / bandwidthBytesPerMs; // ms
    }
    
    // Учитываем количество реплик (если есть репликация, может быть дополнительная задержка)
    const replicaLatency = this.replicas > 1 ? (this.replicas - 1) * this.replicaLatencyMs : 0;
    
    // Общий latency для распределения
    // В реальном ClickHouse запросы выполняются параллельно, поэтому latency не линейно зависит от количества шардов
    return this.baseLatencyMs + totalNetworkLatency + dataLatency + replicaLatency;
  }

  /**
   * Получить parts для всех шардов
   */
  public getParts(): ClickHouseTablePart[] {
    const allParts: ClickHouseTablePart[] = [];
    for (const parts of this.shardParts.values()) {
      allParts.push(...parts);
    }
    return allParts;
  }

  /**
   * Получить метрики движка
   */
  public getMetrics() {
    const allParts = this.getParts();
    const totalRows = allParts.reduce((sum, part) => sum + part.rows, 0);
    const totalSize = allParts.reduce((sum, part) => sum + part.size, 0);

    return {
      partsCount: allParts.length,
      pendingMerges: this.pendingMerges,
      totalRows,
      totalSize,
      lastMergeTime: this.lastMergeTime,
    };
  }

  /**
   * Получить конфигурацию Distributed
   */
  public getConfig(): DistributedEngineConfig {
    return { ...this.distributedConfig };
  }

  /**
   * Получить информацию о распределении
   */
  public getDistributionInfo(): {
    cluster: string;
    database: string;
    table: string;
    shardingKey?: string;
    shards: number;
    replicas: number;
    clusterNodes: number;
  } {
    return {
      cluster: this.cluster,
      database: this.database,
      table: this.table,
      shardingKey: this.shardingKey,
      shards: this.shards,
      replicas: this.replicas,
      clusterNodes: this.clusterNodes,
    };
  }
}

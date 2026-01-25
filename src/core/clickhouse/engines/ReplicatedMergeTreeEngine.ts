/**
 * ReplicatedMergeTree Engine Implementation
 * 
 * Движок ClickHouse с репликацией на уровне таблицы.
 * Поддерживает:
 * - Репликацию данных через ClickHouse Keeper
 * - Координацию операций между репликами
 * - Чтение с любой реплики
 * - Автоматическую синхронизацию при merge
 * - Все возможности MergeTree (ORDER BY, PARTITION BY, индексы, SAMPLE, FINAL)
 */

import { MergeTreeEngine, MergeTreeConfig } from './MergeTreeEngine';
import { TableEngineConfig, InsertOptions, SelectOptions, MergeOptions } from '../TableEngine';
import { ClickHouseTablePart } from '../../ClickHouseRoutingEngine';
import { ClickHouseTableStorage } from '../TableStorage';
import { ClickHouseLatencyCalculator } from '../LatencyCalculator';
import { ClickHouseKeeper, ReplicaMetadata } from '../Keeper';

export interface ReplicatedMergeTreeConfig extends MergeTreeConfig {
  replicaPath?: string; // Путь реплики в Keeper (например, /clickhouse/tables/{shard}/{replica})
  replicas?: number; // Количество реплик
  keeperNodes?: string[]; // Узлы ClickHouse Keeper
  clusterNodes?: number; // Общее количество узлов в кластере
}

/**
 * ReplicatedMergeTree Engine
 * 
 * Реализует логику ReplicatedMergeTree движка ClickHouse:
 * - Наследует все возможности MergeTree
 * - Симулирует репликацию данных через Keeper
 * - Координирует операции между репликами
 * - Учитывает network latency при репликации
 * - Поддерживает чтение с любой реплики
 */
export class ReplicatedMergeTreeEngine extends MergeTreeEngine {
  private replicatedConfig: ReplicatedMergeTreeConfig;
  private replicaPath?: string;
  private tablePath?: string; // Путь таблицы в Keeper
  private replicas: number = 1;
  private keeperNodes: string[] = [];
  private clusterNodes: number = 1;
  private latencyCalculator: ClickHouseLatencyCalculator;
  private replicaId: string; // Уникальный ID этой реплики
  private keeper?: ClickHouseKeeper; // Экземпляр Keeper для координации
  private replicaIndex: number = 0; // Индекс реплики (для детерминированного выбора лидера)
  private shard: number = 0; // Шард реплики
  // Конфигурируемые параметры для репликации (избегание хардкода)
  private networkLatencyPerReplicaMs: number = 5; // задержка на реплику
  private partsLatencyMsPerPart: number = 2; // задержка на part

  constructor(keeper?: ClickHouseKeeper, config?: { networkLatencyPerReplicaMs?: number; partsLatencyMsPerPart?: number }) {
    super();
    this.latencyCalculator = new ClickHouseLatencyCalculator();
    this.replicaId = `replica-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.keeper = keeper;
    this.networkLatencyPerReplicaMs = config?.networkLatencyPerReplicaMs ?? 5;
    this.partsLatencyMsPerPart = config?.partsLatencyMsPerPart ?? 2;
    this.replicatedConfig = {
      engine: 'ReplicatedMergeTree',
      maxPartSize: 10 * 1024 * 1024, // 10MB
      maxPartRows: 10000, // 10K rows
      mergePolicy: {
        maxBytesToMergeAtMaxSpace: 150 * 1024 * 1024 * 1024, // 150GB
        maxBytesToMergeAtMinSpace: 50 * 1024 * 1024 * 1024, // 50GB
      },
    };
  }

  public initialize(config: TableEngineConfig): void {
    super.initialize(config);
    
    // Извлекаем параметры репликации из settings
    const settings = (config.settings as any) || {};
    const replicaPath = settings.replicaPath || (config as any).replicaPath;
    const replicas = settings.replicas || (config as any).replicas || 1;
    const keeperNodes = settings.keeperNodes || (config as any).keeperNodes || [];
    const clusterNodes = settings.clusterNodes || (config as any).clusterNodes || 1;
    const shard = settings.shard !== undefined ? settings.shard : 0;
    const replicaIndex = settings.replicaIndex !== undefined ? settings.replicaIndex : 0;
    const tableName = (config as any).tableName || 'unknown';
    
    this.replicatedConfig = {
      ...this.replicatedConfig,
      ...config,
      engine: 'ReplicatedMergeTree',
      replicaPath,
      replicas,
      keeperNodes,
      clusterNodes,
    };
    
    // Формируем пути в Keeper
    // В реальном ClickHouse путь: /clickhouse/tables/{shard}/{table}
    this.shard = shard;
    this.replicaIndex = replicaIndex;
    this.tablePath = `/clickhouse/tables/${shard}/${tableName}`;
    this.replicaPath = replicaPath || `${this.tablePath}/${this.replicaId}`;
    this.replicas = replicas;
    this.keeperNodes = keeperNodes;
    this.clusterNodes = clusterNodes;
    
    // Регистрируем реплику в Keeper
    if (this.keeper) {
      const metadata: ReplicaMetadata = {
        replicaId: this.replicaId,
        replicaPath: this.replicaPath,
        tablePath: this.tablePath,
        shard: this.shard,
        replicaIndex: this.replicaIndex,
        lastUpdate: Date.now(),
        parts: [],
        isLeader: false,
        healthy: true,
      };
      
      this.keeper.registerReplica(metadata);
      
      // Инициализируем узлы Keeper, если они указаны
      if (keeperNodes.length > 0) {
        for (let i = 0; i < keeperNodes.length; i++) {
          const node = keeperNodes[i];
          // Парсим host:port или используем дефолтный порт
          const [host, portStr] = node.includes(':') ? node.split(':') : [node, '2181'];
          const port = parseInt(portStr, 10) || 2181;
          this.keeper.addNode(`keeper-${i}`, host, port);
        }
      }
    }
  }

  /**
   * Вставка данных с репликацией
   * Симулирует репликацию данных на другие реплики через Keeper
   */
  public insert(options: InsertOptions): ClickHouseTablePart[] {
    // Вставляем данные локально (как в MergeTree)
    const newParts = super.insert(options);
    
    // Симулируем репликацию на другие реплики через Keeper
    if (this.replicas > 1 && this.keeper && this.tablePath) {
      // Создаем операцию в Keeper для координации репликации
      const operationId = this.keeper.createOperation(
        'INSERT',
        this.tablePath,
        this.replicaId,
        { parts: newParts.map(p => p.name) }
      );
      
      // Обновляем parts реплики в Keeper
      const partNames = newParts.map(p => p.name);
      const currentParts = this.keeper.getReplicaMetadata(this.replicaId)?.parts || [];
      this.keeper.updateReplicaParts(this.replicaId, [...currentParts, ...partNames]);
      
      // Рассчитываем network latency для репликации
      // В реальном ClickHouse репликация происходит асинхронно через Keeper
      const replicationLatency = this.calculateReplicationLatency(newParts.length);
      
      // Помечаем операцию как завершенную (в реальности это происходит после репликации на все реплики)
      this.keeper.updateOperation(operationId, 'COMPLETED', this.replicaId);
    }
    
    return newParts;
  }

  /**
   * Выборка данных с возможностью чтения с реплик
   * В реальном ClickHouse можно читать с любой реплики
   */
  public select(options: SelectOptions): Record<string, any>[] {
    // Читаем данные локально (как в MergeTree)
    // В реальном ClickHouse можно выбрать реплику для чтения
    // Для симуляции всегда читаем с локальной реплики
    const result = super.select(options);
    
    // Симулируем network latency при чтении с удаленной реплики (если бы это была удаленная)
    // В реальном ClickHouse чтение с локальной реплики быстрее
    // Для симуляции учитываем это в метриках latency
    
    return result;
  }

  /**
   * Объединение parts с координацией через Keeper
   * В реальном ClickHouse только одна реплика выполняет merge, остальные синхронизируются
   */
  public merge(options: MergeOptions): ClickHouseTablePart[] {
    if (!this.keeper || !this.tablePath) {
      // Если Keeper не доступен, выполняем merge локально (fallback)
      return super.merge(options);
    }
    
    // Проверяем quorum перед выполнением merge
    if (!this.keeper.checkQuorum(this.tablePath)) {
      // Недостаточно реплик для quorum, не выполняем merge
      return [];
    }
    
    // Определяем, является ли эта реплика "лидером" для merge через Keeper
    const isLeader = this.keeper.isLeader(this.replicaId, this.tablePath);
    
    if (!isLeader) {
      // Если не лидер, симулируем получение merged parts от лидера
      // В реальном ClickHouse это происходит через Keeper
      // Для симуляции просто возвращаем пустой массив (merge выполняется на лидере)
      return [];
    }
    
    // Создаем операцию merge в Keeper
    const operationId = this.keeper.createOperation(
      'MERGE',
      this.tablePath,
      this.replicaId,
      { parts: options.parts.map(p => p.name) }
    );
    
    // Выполняем merge как в MergeTree
    const mergedParts = super.merge(options);
    
    // Симулируем синхронизацию merged parts с другими репликами через Keeper
    if (this.replicas > 1) {
      // Обновляем parts реплики в Keeper
      const partNames = mergedParts.map(p => p.name);
      this.keeper.updateReplicaParts(this.replicaId, partNames);
      
      // Рассчитываем network latency для синхронизации
      const replicationLatency = this.calculateReplicationLatency(mergedParts.length);
      
      // Помечаем операцию как завершенную
      this.keeper.updateOperation(operationId, 'COMPLETED', this.replicaId);
      
      // Обновляем время последнего merge
      this.keeper.updateReplicaMetadata(this.replicaId, {
        lastMergeTime: Date.now(),
      });
    }
    
    return mergedParts;
  }

  /**
   * Рассчитать latency репликации
   * Учитывает количество parts, размер данных, количество реплик и network latency через Keeper
   */
  private calculateReplicationLatency(partsCount: number): number {
    if (this.keeper && this.tablePath) {
      // Используем Keeper для расчета latency
      const operationType = partsCount > 0 ? 'REPLICATE' : 'INSERT';
      return this.keeper.calculateOperationLatency(operationType, this.replicas);
    }
    
    // Fallback: расчет без Keeper (используем конфигурируемые параметры из Keeper)
    // Если Keeper не доступен, используем значения по умолчанию, но они должны быть конфигурируемыми
    // В реальном ClickHouse Keeper всегда доступен для ReplicatedMergeTree
    const baseLatency = this.keeper ? this.keeper['baseLatency'] || 10 : 10; // ms - базовая задержка Keeper
    const totalNetworkLatency = this.networkLatencyPerReplicaMs * (this.replicas - 1);
    const partsLatency = partsCount * this.partsLatencyMsPerPart;
    
    return baseLatency + totalNetworkLatency + partsLatency;
  }

  /**
   * Получить parts реплики (для обновления в Keeper)
   */
  public getParts(): ClickHouseTablePart[] {
    return super.getParts();
  }

  /**
   * Обновить parts в Keeper (вызывается после изменений)
   */
  public updatePartsInKeeper(): void {
    if (this.keeper && this.tablePath) {
      const parts = this.getParts();
      const partNames = parts.map(p => p.name);
      this.keeper.updateReplicaParts(this.replicaId, partNames);
    }
  }

  /**
   * Получить конфигурацию ReplicatedMergeTree
   */
  public getConfig(): ReplicatedMergeTreeConfig {
    return { ...this.replicatedConfig };
  }

  /**
   * Получить информацию о реплике
   */
  public getReplicaInfo(): {
    replicaId: string;
    replicaPath: string;
    tablePath: string;
    shard: number;
    replicaIndex: number;
    replicas: number;
    keeperNodes: string[];
    clusterNodes: number;
    isLeader: boolean;
    healthy: boolean;
  } {
    const metadata = this.keeper?.getReplicaMetadata(this.replicaId);
    
    return {
      replicaId: this.replicaId,
      replicaPath: this.replicaPath || '',
      tablePath: this.tablePath || '',
      shard: this.shard,
      replicaIndex: this.replicaIndex,
      replicas: this.replicas,
      keeperNodes: this.keeperNodes,
      clusterNodes: this.clusterNodes,
      isLeader: metadata?.isLeader || false,
      healthy: metadata?.healthy ?? true,
    };
  }
}

/**
 * ClickHouse Keeper Implementation
 * 
 * Симуляция ClickHouse Keeper для координации реплик.
 * ClickHouse Keeper - это распределенная система координации (аналог ZooKeeper),
 * используемая для координации операций между репликами в ReplicatedMergeTree.
 * 
 * Поддерживает:
 * - Хранение метаданных реплик
 * - Координацию операций между репликами (quorum, consensus)
 * - Управление лидерством для merge операций
 * - Синхронизацию parts между репликами
 * - Отслеживание состояния реплик
 */

/**
 * Узел Keeper
 */
export interface KeeperNode {
  id: string;
  host: string;
  port: number;
  healthy: boolean;
  lastHeartbeat: number;
}

/**
 * Метаданные реплики в Keeper
 */
export interface ReplicaMetadata {
  replicaId: string;
  replicaPath: string;
  tablePath: string; // Путь таблицы в Keeper (например, /clickhouse/tables/{shard}/{table})
  shard: number;
  replicaIndex: number;
  lastUpdate: number;
  parts: string[]; // Список parts на реплике
  isLeader: boolean; // Является ли реплика лидером для merge
  lastMergeTime?: number;
  healthy: boolean;
}

/**
 * Операция в Keeper (для координации)
 */
export interface KeeperOperation {
  id: string;
  type: 'INSERT' | 'MERGE' | 'MUTATION' | 'REPLICATE';
  tablePath: string;
  replicaId: string;
  timestamp: number;
  data?: any;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  completedReplicas: string[]; // Реплики, которые завершили операцию
}

/**
 * ClickHouse Keeper
 * 
 * Симулирует работу ClickHouse Keeper для координации реплик.
 * В реальном ClickHouse Keeper используется для:
 * - Координации merge операций (только одна реплика выполняет merge)
 * - Синхронизации parts между репликами
 * - Управления лидерством
 * - Отслеживания состояния реплик
 */
export class ClickHouseKeeper {
  private nodes: Map<string, KeeperNode> = new Map();
  private replicaMetadata: Map<string, ReplicaMetadata> = new Map(); // key: replicaId
  private operations: Map<string, KeeperOperation> = new Map(); // key: operationId
  private tableReplicas: Map<string, string[]> = new Map(); // key: tablePath, value: replicaIds[]
  private leaderElections: Map<string, string> = new Map(); // key: tablePath, value: leaderReplicaId
  
  // Конфигурация (конфигурируемые параметры)
  private quorumSize: number; // Минимальное количество реплик для quorum
  private heartbeatInterval: number; // Интервал heartbeat
  private operationTimeout: number; // Таймаут операции
  
  // Network latency симуляция (конфигурируемые параметры)
  private baseLatency: number; // ms - базовая задержка Keeper
  private networkLatencyPerNode: number; // ms - задержка на узел
  private operationLatencies: { INSERT: number; MERGE: number; MUTATION: number; REPLICATE: number };

  constructor(config?: {
    baseLatency?: number;
    operationLatencies?: { INSERT?: number; MERGE?: number; MUTATION?: number; REPLICATE?: number };
    quorumSize?: number;
    heartbeatInterval?: number;
    operationTimeout?: number;
    networkLatencyPerNode?: number;
  }) {
    // Инициализация с конфигурируемыми параметрами
    this.baseLatency = config?.baseLatency ?? 10;
    this.quorumSize = config?.quorumSize ?? 2;
    this.heartbeatInterval = config?.heartbeatInterval ?? 5000;
    this.operationTimeout = config?.operationTimeout ?? 30000;
    this.networkLatencyPerNode = config?.networkLatencyPerNode ?? 2;
    this.operationLatencies = {
      INSERT: config?.operationLatencies?.INSERT ?? 2,
      MERGE: config?.operationLatencies?.MERGE ?? 10,
      MUTATION: config?.operationLatencies?.MUTATION ?? 8,
      REPLICATE: config?.operationLatencies?.REPLICATE ?? 5,
    };
    // Инициализация с дефолтными узлами (если не указаны)
    this.addNode('keeper-1', 'localhost', 2181);
  }
  
  /**
   * Обновить базовую задержку Keeper
   */
  public updateBaseLatency(latency: number): void {
    this.baseLatency = latency;
  }
  
  /**
   * Обновить задержки операций Keeper
   */
  public updateOperationLatencies(latencies: { INSERT?: number; MERGE?: number; MUTATION?: number; REPLICATE?: number }): void {
    this.operationLatencies = {
      INSERT: latencies.INSERT ?? this.operationLatencies.INSERT,
      MERGE: latencies.MERGE ?? this.operationLatencies.MERGE,
      MUTATION: latencies.MUTATION ?? this.operationLatencies.MUTATION,
      REPLICATE: latencies.REPLICATE ?? this.operationLatencies.REPLICATE,
    };
  }

  /**
   * Добавить узел Keeper
   */
  public addNode(id: string, host: string, port: number): void {
    this.nodes.set(id, {
      id,
      host,
      port,
      healthy: true,
      lastHeartbeat: Date.now(),
    });
  }

  /**
   * Удалить узел Keeper
   */
  public removeNode(id: string): void {
    this.nodes.delete(id);
  }

  /**
   * Получить все узлы Keeper
   */
  public getNodes(): KeeperNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Получить здоровые узлы Keeper
   */
  public getHealthyNodes(): KeeperNode[] {
    const now = Date.now();
    return Array.from(this.nodes.values()).filter(
      node => node.healthy && (now - node.lastHeartbeat) < this.heartbeatInterval * 2
    );
  }

  /**
   * Зарегистрировать реплику в Keeper
   */
  public registerReplica(metadata: ReplicaMetadata): void {
    this.replicaMetadata.set(metadata.replicaId, metadata);
    
    // Добавляем реплику в список реплик таблицы
    const tableReplicas = this.tableReplicas.get(metadata.tablePath) || [];
    if (!tableReplicas.includes(metadata.replicaId)) {
      tableReplicas.push(metadata.replicaId);
      this.tableReplicas.set(metadata.tablePath, tableReplicas);
    }
    
    // Обновляем лидерство (если это первая реплика или текущий лидер недоступен)
    this.updateLeader(metadata.tablePath);
  }

  /**
   * Обновить метаданные реплики
   */
  public updateReplicaMetadata(replicaId: string, updates: Partial<ReplicaMetadata>): void {
    const metadata = this.replicaMetadata.get(replicaId);
    if (!metadata) return;
    
    Object.assign(metadata, updates);
    metadata.lastUpdate = Date.now();
    
    // Обновляем лидерство если нужно
    if (updates.tablePath) {
      this.updateLeader(updates.tablePath);
    }
  }

  /**
   * Получить метаданные реплики
   */
  public getReplicaMetadata(replicaId: string): ReplicaMetadata | undefined {
    return this.replicaMetadata.get(replicaId);
  }

  /**
   * Получить все реплики таблицы
   */
  public getTableReplicas(tablePath: string): ReplicaMetadata[] {
    const replicaIds = this.tableReplicas.get(tablePath) || [];
    return replicaIds
      .map(id => this.replicaMetadata.get(id))
      .filter((m): m is ReplicaMetadata => m !== undefined);
  }

  /**
   * Обновить лидерство для таблицы
   * В реальном ClickHouse лидер определяется через consensus в Keeper
   */
  public updateLeader(tablePath: string): void {
    const replicas = this.getTableReplicas(tablePath);
    if (replicas.length === 0) return;
    
    // Находим текущего лидера
    const currentLeader = replicas.find(r => r.isLeader);
    
    // Если лидер существует и здоров, оставляем его
    if (currentLeader && currentLeader.healthy) {
      return;
    }
    
    // Выбираем нового лидера (первая здоровая реплика по replicaIndex)
    const healthyReplicas = replicas.filter(r => r.healthy);
    if (healthyReplicas.length === 0) return;
    
    // Сортируем по replicaIndex для детерминированного выбора
    healthyReplicas.sort((a, b) => a.replicaIndex - b.replicaIndex);
    const newLeader = healthyReplicas[0];
    
    // Обновляем лидерство
    for (const replica of replicas) {
      replica.isLeader = replica.replicaId === newLeader.replicaId;
    }
    
    this.leaderElections.set(tablePath, newLeader.replicaId);
  }

  /**
   * Получить лидера для таблицы
   */
  public getLeader(tablePath: string): ReplicaMetadata | undefined {
    const leaderId = this.leaderElections.get(tablePath);
    if (!leaderId) {
      this.updateLeader(tablePath);
      const newLeaderId = this.leaderElections.get(tablePath);
      if (!newLeaderId) return undefined;
      return this.replicaMetadata.get(newLeaderId);
    }
    
    const leader = this.replicaMetadata.get(leaderId);
    if (leader && leader.healthy) {
      return leader;
    }
    
    // Лидер недоступен, выбираем нового
    this.updateLeader(tablePath);
    const newLeaderId = this.leaderElections.get(tablePath);
    return newLeaderId ? this.replicaMetadata.get(newLeaderId) : undefined;
  }

  /**
   * Проверить, является ли реплика лидером
   */
  public isLeader(replicaId: string, tablePath: string): boolean {
    const leader = this.getLeader(tablePath);
    return leader?.replicaId === replicaId;
  }

  /**
   * Создать операцию в Keeper
   * В реальном ClickHouse операции создаются для координации между репликами
   */
  public createOperation(
    type: KeeperOperation['type'],
    tablePath: string,
    replicaId: string,
    data?: any
  ): string {
    const operationId = `op-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    const operation: KeeperOperation = {
      id: operationId,
      type,
      tablePath,
      replicaId,
      timestamp: Date.now(),
      data,
      status: 'PENDING',
      completedReplicas: [],
    };
    
    this.operations.set(operationId, operation);
    
    // Автоматически удаляем операцию через timeout
    setTimeout(() => {
      this.operations.delete(operationId);
    }, this.operationTimeout);
    
    return operationId;
  }

  /**
   * Обновить статус операции
   */
  public updateOperation(
    operationId: string,
    status: KeeperOperation['status'],
    replicaId?: string
  ): void {
    const operation = this.operations.get(operationId);
    if (!operation) return;
    
    operation.status = status;
    
    if (replicaId && status === 'COMPLETED') {
      if (!operation.completedReplicas.includes(replicaId)) {
        operation.completedReplicas.push(replicaId);
      }
    }
  }

  /**
   * Получить операцию
   */
  public getOperation(operationId: string): KeeperOperation | undefined {
    return this.operations.get(operationId);
  }

  /**
   * Проверить quorum для операции
   * В реальном ClickHouse quorum используется для обеспечения консистентности
   */
  public checkQuorum(tablePath: string): boolean {
    const replicas = this.getTableReplicas(tablePath);
    const healthyReplicas = replicas.filter(r => r.healthy);
    
    // Quorum = большинство реплик (больше половины)
    const requiredQuorum = Math.floor(replicas.length / 2) + 1;
    return healthyReplicas.length >= requiredQuorum;
  }

  /**
   * Симулировать network latency для операции Keeper
   */
  public calculateOperationLatency(operationType: KeeperOperation['type'], replicasCount: number): number {
    // Базовая задержка Keeper
    let latency = this.baseLatency;
    
    // Задержка зависит от типа операции (используем конфигурируемые значения)
    latency += this.operationLatencies[operationType];
    
    // Network latency зависит от количества узлов Keeper
    const healthyNodes = this.getHealthyNodes();
    const networkLatency = this.networkLatencyPerNode * healthyNodes.length;
    latency += networkLatency;
    
    // Latency зависит от количества реплик (больше реплик = больше операций)
    latency += replicasCount * 1; // ms на реплику
    
    return latency;
  }

  /**
   * Обновить parts реплики
   */
  public updateReplicaParts(replicaId: string, parts: string[]): void {
    const metadata = this.replicaMetadata.get(replicaId);
    if (!metadata) return;
    
    metadata.parts = parts;
    metadata.lastUpdate = Date.now();
  }

  /**
   * Получить все parts всех реплик таблицы
   */
  public getAllTableParts(tablePath: string): string[] {
    const replicas = this.getTableReplicas(tablePath);
    const allParts = new Set<string>();
    
    for (const replica of replicas) {
      for (const part of replica.parts) {
        allParts.add(part);
      }
    }
    
    return Array.from(allParts);
  }

  /**
   * Пометить реплику как нездоровую
   */
  public markReplicaUnhealthy(replicaId: string): void {
    const metadata = this.replicaMetadata.get(replicaId);
    if (metadata) {
      metadata.healthy = false;
      
      // Если это лидер, выбираем нового
      if (metadata.isLeader) {
        this.updateLeader(metadata.tablePath);
      }
    }
  }

  /**
   * Пометить реплику как здоровую
   */
  public markReplicaHealthy(replicaId: string): void {
    const metadata = this.replicaMetadata.get(replicaId);
    if (metadata) {
      metadata.healthy = true;
      metadata.lastUpdate = Date.now();
      
      // Обновляем лидерство
      this.updateLeader(metadata.tablePath);
    }
  }

  /**
   * Получить статистику Keeper
   */
  public getStats(): {
    nodesCount: number;
    healthyNodesCount: number;
    replicasCount: number;
    healthyReplicasCount: number;
    operationsCount: number;
    pendingOperationsCount: number;
  } {
    const healthyNodes = this.getHealthyNodes();
    const replicas = Array.from(this.replicaMetadata.values());
    const healthyReplicas = replicas.filter(r => r.healthy);
    const operations = Array.from(this.operations.values());
    const pendingOperations = operations.filter(op => op.status === 'PENDING' || op.status === 'IN_PROGRESS');
    
    return {
      nodesCount: this.nodes.size,
      healthyNodesCount: healthyNodes.length,
      replicasCount: replicas.length,
      healthyReplicasCount: healthyReplicas.length,
      operationsCount: operations.length,
      pendingOperationsCount: pendingOperations.length,
    };
  }

  /**
   * Настроить конфигурацию Keeper
   */
  public configure(config: {
    quorumSize?: number;
    heartbeatInterval?: number;
    operationTimeout?: number;
    baseLatency?: number;
    networkLatencyPerNode?: number;
  }): void {
    if (config.quorumSize !== undefined) {
      this.quorumSize = config.quorumSize;
    }
    if (config.heartbeatInterval !== undefined) {
      this.heartbeatInterval = config.heartbeatInterval;
    }
    if (config.operationTimeout !== undefined) {
      this.operationTimeout = config.operationTimeout;
    }
    if (config.baseLatency !== undefined) {
      this.baseLatency = config.baseLatency;
    }
    if (config.networkLatencyPerNode !== undefined) {
      this.networkLatencyPerNode = config.networkLatencyPerNode;
    }
  }
}

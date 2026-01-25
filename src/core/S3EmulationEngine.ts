/**
 * S3 Emulation Engine
 * Симулирует работу AWS S3 Data Lake с детальными метриками
 */

import { S3RoutingEngine, S3StorageClass, S3Metrics } from './S3RoutingEngine';

export interface S3DataLakeConfig {
  buckets?: Array<{
    name: string;
    region?: string;
    versioning?: boolean;
    encryption?: string;
    lifecycleEnabled?: boolean;
    lifecycleDays?: number;
    glacierEnabled?: boolean;
    glacierDays?: number;
    publicAccess?: boolean;
    lifecycleRules?: Array<{
      id: string;
      name: string;
      prefix?: string;
      status: 'Enabled' | 'Disabled';
      transitions?: Array<{
        days: number;
        storageClass: string;
      }>;
      expiration?: {
        days: number;
      };
    }>;
  }>;
  defaultRegion?: string;
  lifecycleRules?: Array<{
    id: string;
    name: string;
    prefix?: string;
    status: 'Enabled' | 'Disabled';
    transitions?: Array<{
      days: number;
      storageClass: string;
    }>;
    expiration?: {
      days: number;
    };
  }>;
}

export interface S3EmulationEngineMetrics {
  // Основные метрики
  totalBuckets: number;
  totalObjects: number;
  totalSize: number; // bytes
  totalVersions: number;
  
  // Операции
  totalOperations: number;
  putOperations: number;
  getOperations: number;
  deleteOperations: number;
  listOperations: number;
  headOperations: number;
  
  // Производительность
  averageLatency: number; // ms
  p50Latency: number;
  p99Latency: number;
  throughput: number; // ops/sec
  
  // Ошибки
  errorRate: number;
  totalErrors: number;
  
  // Storage classes
  standardObjects: number;
  standardIASize: number;
  glacierObjects: number;
  glacierSize: number;
  deepArchiveObjects: number;
  deepArchiveSize: number;
  
  // Lifecycle
  lifecycleTransitions: number;
  lifecycleExpirations: number;
  
  // Utilization
  storageUtilization: number; // 0-1
  operationsUtilization: number; // 0-1
  
  // Метрики по бакетам
  bucketMetrics: Map<string, S3BucketEmulationMetrics>;
}

export interface S3BucketEmulationMetrics {
  bucketName: string;
  objectCount: number;
  totalSize: number;
  versionsCount: number;
  putCount: number;
  getCount: number;
  deleteCount: number;
  listCount: number;
  errorCount: number;
  averageLatency: number;
  storageClassDistribution: {
    STANDARD: number;
    STANDARD_IA: number;
    GLACIER: number;
    DEEP_ARCHIVE: number;
  };
  lastOperation?: number;
}

/**
 * S3 Emulation Engine
 * Рассчитывает детальные метрики для S3 Data Lake на основе данных из S3RoutingEngine
 */
export class S3EmulationEngine {
  private config: S3DataLakeConfig | null = null;
  private routingEngine: S3RoutingEngine | null = null;
  
  // Метрики
  private metrics: S3EmulationEngineMetrics;
  
  // История для расчета процентилей
  private latencyHistory: number[] = [];
  private readonly MAX_LATENCY_HISTORY = 1000;
  
  // Трекинг операций для RPS
  private operationTimestamps: number[] = [];
  private lastUpdateTime: number = Date.now();
  
  // Lifecycle transition tracking
  private lifecycleTransitionHistory: Array<{
    bucket: string;
    key: string;
    fromClass: S3StorageClass;
    toClass: S3StorageClass;
    timestamp: number;
  }> = [];
  
  // Константы для расчета utilization (из конфигурации или дефолтные)
  private maxStoragePerBucket: number = 1024 * 1024 * 1024 * 1024; // 1TB по умолчанию
  private maxOpsPerBucket: number = 3500; // AWS S3 limit: 3500 PUT/POST/DELETE per second per bucket
  
  constructor() {
    this.metrics = this.initializeMetrics();
  }
  
  /**
   * Инициализация с конфигурацией
   */
  public initialize(config: S3DataLakeConfig, routingEngine: S3RoutingEngine): void {
    this.config = config;
    this.routingEngine = routingEngine;
    this.resetMetrics();
    
    // Можно расширить для получения maxStoragePerBucket из конфигурации
    // Пока используем дефолтные значения AWS S3
  }
  
  /**
   * Обновление метрик на основе данных из S3RoutingEngine
   */
  public updateMetrics(): void {
    if (!this.routingEngine) return;
    
    const now = Date.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000; // seconds
    
    // Получаем метрики из routing engine
    const allBucketMetrics = this.routingEngine.getAllBucketMetrics();
    const totalSize = this.routingEngine.getTotalStorageSize();
    const totalObjects = this.routingEngine.getTotalObjectCount();
    
    // Обновляем основные метрики
    this.metrics.totalBuckets = allBucketMetrics.size;
    this.metrics.totalObjects = totalObjects;
    this.metrics.totalSize = totalSize;
    
    // Агрегируем метрики по бакетам
    let totalPut = 0;
    let totalGet = 0;
    let totalDelete = 0;
    let totalList = 0;
    let totalHead = 0;
    let totalErrors = 0;
    let totalLatency = 0;
    let totalOps = 0;
    
    const bucketMetricsMap = new Map<string, S3BucketEmulationMetrics>();
    
    for (const [bucketName, bucketMetrics] of allBucketMetrics.entries()) {
      totalPut += bucketMetrics.putCount;
      totalGet += bucketMetrics.getCount;
      totalDelete += bucketMetrics.deleteCount;
      totalList += bucketMetrics.listCount;
      totalErrors += bucketMetrics.errorCount;
      totalLatency += bucketMetrics.averageLatency;
      totalOps += bucketMetrics.putCount + bucketMetrics.getCount + 
                  bucketMetrics.deleteCount + bucketMetrics.listCount;
      
      // Создаем детальные метрики для бакета
      bucketMetricsMap.set(bucketName, {
        bucketName,
        objectCount: bucketMetrics.objectCount,
        totalSize: bucketMetrics.totalSize,
        versionsCount: bucketMetrics.versionsCount,
        putCount: bucketMetrics.putCount,
        getCount: bucketMetrics.getCount,
        deleteCount: bucketMetrics.deleteCount,
        listCount: bucketMetrics.listCount,
        errorCount: bucketMetrics.errorCount,
        averageLatency: bucketMetrics.averageLatency,
        storageClassDistribution: this.calculateStorageClassDistribution(bucketName),
        lastOperation: bucketMetrics.lastOperation,
      });
    }
    
    this.metrics.putOperations = totalPut;
    this.metrics.getOperations = totalGet;
    this.metrics.deleteOperations = totalDelete;
    this.metrics.listOperations = totalList;
    this.metrics.headOperations = totalHead;
    this.metrics.totalOperations = totalOps;
    this.metrics.totalErrors = totalErrors;
    this.metrics.errorRate = totalOps > 0 ? totalErrors / totalOps : 0;
    this.metrics.averageLatency = totalOps > 0 ? totalLatency / totalOps : 0;
    this.metrics.bucketMetrics = bucketMetricsMap;
    
    // Рассчитываем процентили латентности
    this.updateLatencyPercentiles();
    
    // Рассчитываем throughput (ops/sec)
    this.updateThroughput();
    
    // Рассчитываем utilization
    this.updateUtilization();
    
    // Обновляем распределение по storage classes
    this.updateStorageClassDistribution();
    
    this.lastUpdateTime = now;
  }
  
  /**
   * Получить текущие метрики
   */
  public getMetrics(): S3EmulationEngineMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Получить метрики конкретного бакета
   */
  public getBucketMetrics(bucketName: string): S3BucketEmulationMetrics | undefined {
    return this.metrics.bucketMetrics.get(bucketName);
  }
  
  /**
   * Получить историю lifecycle transitions
   */
  public getLifecycleTransitionHistory(): Array<{
    bucket: string;
    key: string;
    fromClass: S3StorageClass;
    toClass: S3StorageClass;
    timestamp: number;
  }> {
    return [...this.lifecycleTransitionHistory];
  }
  
  // Приватные методы для расчета метрик
  private initializeMetrics(): S3EmulationEngineMetrics {
    return {
      totalBuckets: 0,
      totalObjects: 0,
      totalSize: 0,
      totalVersions: 0,
      totalOperations: 0,
      putOperations: 0,
      getOperations: 0,
      deleteOperations: 0,
      listOperations: 0,
      headOperations: 0,
      averageLatency: 0,
      p50Latency: 0,
      p99Latency: 0,
      throughput: 0,
      errorRate: 0,
      totalErrors: 0,
      standardObjects: 0,
      standardIASize: 0,
      glacierObjects: 0,
      glacierSize: 0,
      deepArchiveObjects: 0,
      deepArchiveSize: 0,
      lifecycleTransitions: 0,
      lifecycleExpirations: 0,
      storageUtilization: 0,
      operationsUtilization: 0,
      bucketMetrics: new Map(),
    };
  }
  
  private resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.latencyHistory = [];
    this.operationTimestamps = [];
    this.lifecycleTransitionHistory = [];
  }
  
  private updateLatencyPercentiles(): void {
    if (this.latencyHistory.length === 0) return;
    
    const sorted = [...this.latencyHistory].sort((a, b) => a - b);
    this.metrics.p50Latency = this.calculatePercentile(sorted, 50);
    this.metrics.p99Latency = this.calculatePercentile(sorted, 99);
  }
  
  private updateThroughput(): void {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    
    // Фильтруем операции за последнюю секунду
    const recentOps = this.operationTimestamps.filter(ts => ts > oneSecondAgo);
    this.metrics.throughput = recentOps.length;
    
    // Удаляем старые записи
    this.operationTimestamps = this.operationTimestamps.filter(ts => ts > oneSecondAgo);
  }
  
  private updateUtilization(): void {
    // Storage utilization
    const maxTotalStorage = this.maxStoragePerBucket * this.metrics.totalBuckets;
    this.metrics.storageUtilization = maxTotalStorage > 0 
      ? Math.min(1, this.metrics.totalSize / maxTotalStorage) 
      : 0;
    
    // Operations utilization
    const maxTotalOps = this.maxOpsPerBucket * this.metrics.totalBuckets;
    this.metrics.operationsUtilization = maxTotalOps > 0 
      ? Math.min(1, this.metrics.throughput / maxTotalOps) 
      : 0;
  }
  
  private updateStorageClassDistribution(): void {
    if (!this.routingEngine) return;
    
    let standardObjects = 0;
    let standardIASize = 0;
    let glacierObjects = 0;
    let glacierSize = 0;
    let deepArchiveObjects = 0;
    let deepArchiveSize = 0;
    
    // Получаем распределение по storage classes для всех бакетов
    const allBucketMetrics = this.routingEngine.getAllBucketMetrics();
    
    for (const bucketName of allBucketMetrics.keys()) {
      const countDistribution = this.routingEngine.getStorageClassDistribution(bucketName);
      const sizeDistribution = this.routingEngine.getStorageClassSizeDistribution(bucketName);
      
      standardObjects += countDistribution.STANDARD;
      standardIASize += sizeDistribution.STANDARD_IA;
      glacierObjects += countDistribution.GLACIER;
      glacierSize += sizeDistribution.GLACIER;
      deepArchiveObjects += countDistribution.DEEP_ARCHIVE;
      deepArchiveSize += sizeDistribution.DEEP_ARCHIVE;
    }
    
    this.metrics.standardObjects = standardObjects;
    this.metrics.standardIASize = standardIASize;
    this.metrics.glacierObjects = glacierObjects;
    this.metrics.glacierSize = glacierSize;
    this.metrics.deepArchiveObjects = deepArchiveObjects;
    this.metrics.deepArchiveSize = deepArchiveSize;
  }
  
  private calculateStorageClassDistribution(bucketName: string): {
    STANDARD: number;
    STANDARD_IA: number;
    GLACIER: number;
    DEEP_ARCHIVE: number;
  } {
    if (!this.routingEngine) {
      return {
        STANDARD: 0,
        STANDARD_IA: 0,
        GLACIER: 0,
        DEEP_ARCHIVE: 0,
      };
    }
    
    const distribution = this.routingEngine.getStorageClassDistribution(bucketName);
    return {
      STANDARD: distribution.STANDARD,
      STANDARD_IA: distribution.STANDARD_IA,
      GLACIER: distribution.GLACIER,
      DEEP_ARCHIVE: distribution.DEEP_ARCHIVE,
    };
  }
  
  private calculatePercentile(sorted: number[], percentile: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.floor((percentile / 100) * sorted.length);
    return sorted[index] || 0;
  }
}

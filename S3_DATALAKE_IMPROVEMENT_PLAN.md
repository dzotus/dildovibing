# План реализации улучшения симулятивности S3 Data Lake

## Обзор проблемы

Текущая реализация S3 Data Lake имеет следующие недостатки в плане симулятивности:

1. **Отсутствует отдельный S3EmulationEngine** - логика эмуляции смешана с EmulationEngine, что нарушает архитектурный паттерн (другие компоненты имеют отдельные EmulationEngine)
2. **Нет визуализации на canvas** - компонент не показывает специфичные метрики S3 на холсте (в отличие от Snowflake, который показывает warehouse статус)
3. **UI конфигурация не использует реальные метрики** - S3DataLakeConfigAdvanced не получает данные из emulation engine в реальном времени
4. **Метрики рассчитываются упрощенно** - нет детальных метрик по операциям, storage classes, lifecycle transitions
5. **Отсутствует симуляция реальных S3 паттернов** - нет симуляции multipart upload, restore operations, cross-region replication

## Цель

Создать полноценную симуляцию S3 Data Lake, которая:
- Соответствует реальному поведению AWS S3
- Показывает детальные метрики в реальном времени
- Имеет визуализацию на canvas
- Использует архитектурный паттерн с отдельным EmulationEngine
- Интегрируется с UI конфигурацией для отображения реальных данных

---

## Этап 1: Создание S3EmulationEngine

### 1.1 Структура файла
**Файл:** `src/core/S3EmulationEngine.ts`

### 1.2 Интерфейсы и типы

```typescript
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
```

### 1.3 Основной класс

```typescript
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
    // Storage utilization (предполагаем max 1TB на бакет)
    const maxStoragePerBucket = 1024 * 1024 * 1024 * 1024; // 1TB
    const maxTotalStorage = maxStoragePerBucket * this.metrics.totalBuckets;
    this.metrics.storageUtilization = maxTotalStorage > 0 
      ? Math.min(1, this.metrics.totalSize / maxTotalStorage) 
      : 0;
    
    // Operations utilization (предполагаем max 3500 ops/sec на бакет)
    const maxOpsPerBucket = 3500;
    const maxTotalOps = maxOpsPerBucket * this.metrics.totalBuckets;
    this.metrics.operationsUtilization = maxTotalOps > 0 
      ? Math.min(1, this.metrics.throughput / maxTotalOps) 
      : 0;
  }
  
  private updateStorageClassDistribution(): void {
    // TODO: Реализовать подсчет объектов по storage classes
    // Нужно получить данные из S3RoutingEngine о storage class каждого объекта
  }
  
  private calculateStorageClassDistribution(bucketName: string): {
    STANDARD: number;
    STANDARD_IA: number;
    GLACIER: number;
    DEEP_ARCHIVE: number;
  } {
    // TODO: Реализовать подсчет объектов по storage classes для бакета
    return {
      STANDARD: 0,
      STANDARD_IA: 0,
      GLACIER: 0,
      DEEP_ARCHIVE: 0,
    };
  }
  
  private calculatePercentile(sorted: number[], percentile: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.floor((percentile / 100) * sorted.length);
    return sorted[index];
  }
}
```

### 1.4 Критерии завершения
- [x] Создан файл `src/core/S3EmulationEngine.ts`
- [x] Реализованы все интерфейсы и типы
- [x] Реализован класс S3EmulationEngine с основными методами
- [x] Метрики рассчитываются на основе данных из S3RoutingEngine
- [x] Реализован расчет процентилей латентности
- [x] Реализован расчет throughput и utilization
- [x] ✅ РЕАЛИЗОВАНО: Расчет распределения по storage classes на основе реальных данных из S3RoutingEngine

---

## Этап 2: Интеграция S3EmulationEngine в EmulationEngine

### 2.1 Добавление S3EmulationEngine в EmulationEngine

**Файл:** `src/core/EmulationEngine.ts`

#### 2.1.1 Импорт
```typescript
import { S3EmulationEngine } from './S3EmulationEngine';
```

#### 2.1.2 Добавление в класс
```typescript
// S3 emulation engines per node
private s3EmulationEngines: Map<string, S3EmulationEngine> = new Map();
```

#### 2.1.3 Метод инициализации
```typescript
/**
 * Initialize S3 Emulation Engine for S3 Data Lake node
 */
private initializeS3EmulationEngine(node: CanvasNode): void {
  const config = (node.data.config || {}) as any;
  
  // Получаем или создаем S3RoutingEngine
  if (!this.s3RoutingEngines.has(node.id)) {
    this.initializeS3RoutingEngine(node);
  }
  const routingEngine = this.s3RoutingEngines.get(node.id)!;
  
  // Создаем S3EmulationEngine
  const emulationEngine = new S3EmulationEngine();
  emulationEngine.initialize(config, routingEngine);
  
  this.s3EmulationEngines.set(node.id, emulationEngine);
}
```

#### 2.1.4 Метод получения engine
```typescript
/**
 * Get S3 Emulation Engine for node
 */
public getS3EmulationEngine(nodeId: string): S3EmulationEngine | undefined {
  return this.s3EmulationEngines.get(nodeId);
}
```

#### 2.1.5 Обновление метода simulateDatabase
Заменить текущую логику для S3 на использование S3EmulationEngine:

```typescript
// Для S3 Data Lake используем S3EmulationEngine
if (node.type === 's3-datalake') {
  if (!this.s3EmulationEngines.has(node.id)) {
    this.initializeS3EmulationEngine(node);
  }
  
  const emulationEngine = this.s3EmulationEngines.get(node.id)!;
  const routingEngine = this.s3RoutingEngines.get(node.id)!;
  
  // Обновляем метрики в emulation engine
  emulationEngine.updateMetrics();
  
  // Получаем метрики
  const s3Metrics = emulationEngine.getMetrics();
  
  // Обновляем ComponentMetrics
  metrics.throughput = s3Metrics.throughput;
  metrics.latency = s3Metrics.averageLatency;
  metrics.latencyP50 = s3Metrics.p50Latency;
  metrics.latencyP99 = s3Metrics.p99Latency;
  metrics.errorRate = s3Metrics.errorRate;
  metrics.utilization = Math.max(
    s3Metrics.storageUtilization,
    s3Metrics.operationsUtilization
  );
  
  metrics.customMetrics = {
    'buckets': s3Metrics.totalBuckets,
    'total_objects': s3Metrics.totalObjects,
    'total_size': s3Metrics.totalSize,
    'total_size_mb': Math.round(s3Metrics.totalSize / (1024 * 1024) * 100) / 100,
    'total_size_gb': Math.round(s3Metrics.totalSize / (1024 * 1024 * 1024) * 100) / 100,
    'put_operations': s3Metrics.putOperations,
    'get_operations': s3Metrics.getOperations,
    'delete_operations': s3Metrics.deleteOperations,
    'list_operations': s3Metrics.listOperations,
    'storage_utilization': Math.round(s3Metrics.storageUtilization * 1000) / 10,
    'ops_utilization': Math.round(s3Metrics.operationsUtilization * 1000) / 10,
    'glacier_objects': s3Metrics.glacierObjects,
    'glacier_size': s3Metrics.glacierSize,
    'lifecycle_transitions': s3Metrics.lifecycleTransitions,
  };
  
  // Обновляем bucket metrics в config для UI
  this.updateS3BucketMetricsInConfig(node, s3Metrics.bucketMetrics);
  
  return; // Early return for S3
}
```

#### 2.1.6 Обновление метода updateS3BucketMetricsInConfig
```typescript
/**
 * Update S3 bucket metrics in node config (for UI display)
 */
private updateS3BucketMetricsInConfig(
  node: CanvasNode,
  bucketMetrics: Map<string, S3BucketEmulationMetrics>
): void {
  const config = (node.data.config as any) || {};
  const buckets = config.buckets || [];
  
  // Update buckets with runtime metrics
  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i];
    const metrics = bucketMetrics.get(bucket.name);
    if (metrics) {
      buckets[i] = {
        ...bucket,
        objectCount: metrics.objectCount,
        totalSize: metrics.totalSize,
        versionsCount: metrics.versionsCount,
        // Добавляем дополнительные метрики
        putCount: metrics.putCount,
        getCount: metrics.getCount,
        deleteCount: metrics.deleteCount,
        listCount: metrics.listCount,
        errorCount: metrics.errorCount,
        averageLatency: metrics.averageLatency,
        storageClassDistribution: metrics.storageClassDistribution,
      };
    }
  }
  
  config.buckets = buckets;
}
```

#### 2.1.7 Очистка при удалении узла
В методе `removeNode`:
```typescript
if (node.type === 's3-datalake') {
  this.s3EmulationEngines.delete(node.id);
  this.s3RoutingEngines.delete(node.id);
}
```

### 2.2 Критерии завершения
- [x] S3EmulationEngine импортирован в EmulationEngine
- [x] Добавлен Map для хранения S3EmulationEngine инстансов
- [x] Реализован метод initializeS3EmulationEngine
- [x] Реализован метод getS3EmulationEngine
- [x] Обновлен метод simulateDatabase для использования S3EmulationEngine
- [x] Обновлен метод updateS3BucketMetricsInConfig
- [x] Добавлена очистка при удалении узла

---

## Этап 3: Визуализация на Canvas

### 3.1 Добавление визуализации в CanvasNode

**Файл:** `src/components/canvas/CanvasNode.tsx`

#### 3.1.1 Получение S3 метрик
Добавить после получения snowflakeEngine:

```typescript
// Get S3-specific metrics if this is an S3 component
const s3Engine = useMemo(() => {
  if (node.type === 's3-datalake' && isRunning) {
    return emulationEngine.getS3EmulationEngine(node.id);
  }
  return undefined;
}, [node.type, node.id, isRunning]);

const s3Metrics = useMemo(() => {
  if (s3Engine) {
    return s3Engine.getMetrics();
  }
  return undefined;
}, [s3Engine]);
```

#### 3.1.2 Визуализация S3 метрик
Добавить после визуализации Snowflake (после строки 690):

```typescript
{/* S3-specific visual indicators */}
{node.type === 's3-datalake' && s3Metrics && (
  <div className="absolute -bottom-6 left-0 right-0 flex flex-col items-center gap-1">
    {/* Bucket count and storage info */}
    <div className="flex items-center gap-2 text-[10px]">
      <span className="px-1.5 py-0.5 rounded bg-secondary/80 text-foreground">
        {s3Metrics.totalBuckets} {s3Metrics.totalBuckets === 1 ? 'bucket' : 'buckets'}
      </span>
      {s3Metrics.totalSize > 0 && (
        <span className="px-1.5 py-0.5 rounded bg-secondary/80 text-foreground">
          {formatBytes(s3Metrics.totalSize)}
        </span>
      )}
    </div>
    
    {/* Operations and utilization */}
    <div className="flex items-center gap-2 text-[10px]">
      <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
        {Math.round(s3Metrics.throughput)} ops/s
      </span>
      <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
        {Math.round(s3Metrics.storageUtilization * 100)}% storage
      </span>
    </div>
    
    {/* Glacier objects indicator */}
    {s3Metrics.glacierObjects > 0 && (
      <div className="flex items-center gap-1 text-[10px] text-amber-400">
        <Archive className="h-3 w-3" />
        <span>{s3Metrics.glacierObjects} archived</span>
      </div>
    )}
  </div>
)}
```

#### 3.1.3 Вспомогательная функция formatBytes
Добавить в начало компонента:

```typescript
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};
```

#### 3.1.4 Импорт иконки Archive
Добавить в импорты:
```typescript
import { Archive } from 'lucide-react';
```

### 3.2 Критерии завершения
- [x] Добавлено получение S3 метрик в CanvasNode
- [x] Реализована визуализация метрик на canvas
- [x] Показывается количество бакетов и размер хранилища
- [x] Показывается throughput и utilization
- [x] Показывается количество архивных объектов (Glacier)
- [x] Добавлена функция formatBytes для форматирования размеров

---

## Этап 4: Обновление UI конфигурации

### 4.1 Интеграция реальных метрик в S3DataLakeConfigAdvanced

**Файл:** `src/components/config/data/S3DataLakeConfigAdvanced.tsx`

#### 4.1.1 Получение S3EmulationEngine
Добавить после получения node:

```typescript
import { emulationEngine } from '@/core/EmulationEngine';
import { useEmulationStore } from '@/store/useEmulationStore';

// В компоненте:
const { isRunning, getComponentMetrics } = useEmulationStore();

// Get S3 Emulation Engine for real-time metrics
const s3Engine = useMemo(() => {
  if (isRunning) {
    return emulationEngine.getS3EmulationEngine(componentId);
  }
  return undefined;
}, [componentId, isRunning]);

const componentMetrics = getComponentMetrics(componentId);
const customMetrics = componentMetrics?.customMetrics || {};

// Get real-time metrics from emulation engine or fallback to config
const s3Metrics = s3Engine?.getMetrics();
const totalBuckets = s3Metrics?.totalBuckets ?? buckets.length;
const totalObjects = s3Metrics?.totalObjects ?? buckets.reduce((sum, b) => sum + (b.objectCount || 0), 0);
const totalSize = s3Metrics?.totalSize ?? buckets.reduce((sum, b) => sum + (b.totalSize || 0), 0);
const throughput = s3Metrics?.throughput ?? customMetrics.estimated_ops_per_sec ?? 0;
const storageUtilization = s3Metrics?.storageUtilization ?? customMetrics.storage_utilization ?? 0;
const operationsUtilization = s3Metrics?.operationsUtilization ?? customMetrics.ops_utilization ?? 0;
const glacierObjects = s3Metrics?.glacierObjects ?? customMetrics.glacier_objects ?? 0;
const lifecycleTransitions = s3Metrics?.lifecycleTransitions ?? customMetrics.lifecycle_transitions ?? 0;
```

#### 4.1.2 Обновление карточек метрик
Заменить статические значения на реальные метрики:

```typescript
<Card>
  <CardHeader className="pb-3">
    <CardTitle className="text-sm font-medium">Total Objects</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">{totalObjects.toLocaleString()}</div>
    <p className="text-xs text-muted-foreground mt-1">
      Across {totalBuckets} {totalBuckets === 1 ? 'bucket' : 'buckets'}
    </p>
  </CardContent>
</Card>

<Card>
  <CardHeader className="pb-3">
    <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">
      {formatBytes(totalSize)}
    </div>
    <p className="text-xs text-muted-foreground mt-1">
      {Math.round(storageUtilization * 100)}% utilized
    </p>
  </CardContent>
</Card>

<Card>
  <CardHeader className="pb-3">
    <CardTitle className="text-sm font-medium">Throughput</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">
      {Math.round(throughput)} ops/s
    </div>
    <p className="text-xs text-muted-foreground mt-1">
      {Math.round(operationsUtilization * 100)}% capacity
    </p>
  </CardContent>
</Card>

<Card>
  <CardHeader className="pb-3">
    <CardTitle className="text-sm font-medium">Archived Objects</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">{glacierObjects.toLocaleString()}</div>
    <p className="text-xs text-muted-foreground mt-1">
      In Glacier/Deep Archive
    </p>
  </CardContent>
</Card>
```

#### 4.1.3 Обновление метрик бакетов
В секции отображения бакетов использовать реальные метрики из s3Metrics:

```typescript
// Для каждого бакета
const bucketMetrics = s3Metrics?.bucketMetrics.get(bucket.name);
const bucketObjectCount = bucketMetrics?.objectCount ?? bucket.objectCount ?? 0;
const bucketTotalSize = bucketMetrics?.totalSize ?? bucket.totalSize ?? 0;
const bucketPutCount = bucketMetrics?.putCount ?? 0;
const bucketGetCount = bucketMetrics?.getCount ?? 0;
const bucketAverageLatency = bucketMetrics?.averageLatency ?? 0;
```

#### 4.1.4 Добавление секции Lifecycle Transitions
Добавить новую секцию для отображения истории lifecycle transitions:

```typescript
{s3Engine && (
  <Card>
    <CardHeader>
      <CardTitle className="text-sm font-medium">Lifecycle Transitions</CardTitle>
      <CardDescription>
        Recent storage class transitions
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        {s3Engine.getLifecycleTransitionHistory()
          .slice(-10) // Последние 10
          .reverse()
          .map((transition, index) => (
            <div key={index} className="flex items-center justify-between text-xs p-2 rounded bg-secondary/50">
              <div>
                <span className="font-medium">{transition.bucket}/{transition.key}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{transition.fromClass}</Badge>
                <span>→</span>
                <Badge variant="outline">{transition.toClass}</Badge>
                <span className="text-muted-foreground">
                  {new Date(transition.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        {s3Engine.getLifecycleTransitionHistory().length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No lifecycle transitions yet
          </p>
        )}
      </div>
    </CardContent>
  </Card>
)}
```

### 4.2 Критерии завершения
- [x] S3EmulationEngine интегрирован в S3DataLakeConfigAdvanced
- [x] Реальные метрики отображаются в карточках статистики
- [x] Метрики бакетов обновляются в реальном времени
- [x] Добавлена секция для отображения lifecycle transitions
- [x] Все значения берутся из emulation engine, если симуляция запущена

---

## Этап 5: Улучшение симуляции S3 паттернов

### 5.1 Симуляция multipart upload

**Файл:** `src/core/S3RoutingEngine.ts`

Добавить поддержку multipart upload:

```typescript
// В классе S3RoutingEngine
private multipartUploads: Map<string, {
  uploadId: string;
  bucket: string;
  key: string;
  parts: Map<number, { etag: string; size: number }>;
  initiated: number;
}> = new Map();

public initiateMultipartUpload(
  bucketName: string,
  key: string
): { uploadId: string; latency: number } {
  const uploadId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  this.multipartUploads.set(uploadId, {
    uploadId,
    bucket: bucketName,
    key,
    parts: new Map(),
    initiated: Date.now(),
  });
  
  return {
    uploadId,
    latency: 20, // Initiate is fast
  };
}

public uploadPart(
  bucketName: string,
  key: string,
  uploadId: string,
  partNumber: number,
  data: unknown,
  size: number
): { etag: string; latency: number; error?: string } {
  const upload = this.multipartUploads.get(uploadId);
  if (!upload) {
    return { etag: '', latency: 10, error: 'Upload not found' };
  }
  
  const etag = this.generateETag(`${key}-${partNumber}`, size);
  upload.parts.set(partNumber, { etag, size });
  
  return {
    etag,
    latency: this.calculatePutLatency(size),
  };
}

public completeMultipartUpload(
  bucketName: string,
  key: string,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>
): { success: boolean; etag: string; latency: number; error?: string } {
  const upload = this.multipartUploads.get(uploadId);
  if (!upload) {
    return { success: false, etag: '', latency: 10, error: 'Upload not found' };
  }
  
  // Validate all parts
  for (const part of parts) {
    if (!upload.parts.has(part.partNumber)) {
      return { success: false, etag: '', latency: 10, error: `Part ${part.partNumber} not found` };
    }
  }
  
  // Calculate total size
  const totalSize = parts.reduce((sum, part) => {
    const partData = upload.parts.get(part.partNumber);
    return sum + (partData?.size || 0);
  }, 0);
  
  // Create final object
  const finalEtag = this.generateETag(key, totalSize);
  
  // Store object
  this.putObject(bucketName, key, null, totalSize);
  
  // Cleanup
  this.multipartUploads.delete(uploadId);
  
  return {
    success: true,
    etag: finalEtag,
    latency: 50, // Complete is slower
  };
}
```

### 5.2 Симуляция restore operations для Glacier

```typescript
// В классе S3RoutingEngine
private restoreRequests: Map<string, {
  bucket: string;
  key: string;
  requestId: string;
  storageClass: S3StorageClass;
  tier: 'Expedited' | 'Standard' | 'Bulk';
  requested: number;
  expires?: number;
  status: 'in-progress' | 'completed' | 'failed';
}> = new Map();

public initiateRestoreObject(
  bucketName: string,
  key: string,
  storageClass: S3StorageClass,
  tier: 'Expedited' | 'Standard' | 'Bulk' = 'Standard'
): { requestId: string; latency: number; error?: string } {
  const object = this.getObject(bucketName, key);
  if (!object.success || !object.object) {
    return { requestId: '', latency: 10, error: 'Object not found' };
  }
  
  if (object.object.storageClass !== 'GLACIER' && object.object.storageClass !== 'DEEP_ARCHIVE') {
    return { requestId: '', latency: 10, error: 'Object is not archived' };
  }
  
  const requestId = `restore-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Calculate restore time based on tier
  const restoreTimes = {
    'Expedited': 1 * 60 * 60 * 1000, // 1 hour
    'Standard': 3 * 60 * 60 * 1000, // 3 hours
    'Bulk': 5 * 60 * 60 * 1000, // 5 hours
  };
  
  const restoreTime = restoreTimes[tier];
  const expires = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
  
  this.restoreRequests.set(requestId, {
    bucket: bucketName,
    key,
    requestId,
    storageClass: object.object.storageClass,
    tier,
    requested: Date.now(),
    expires,
    status: 'in-progress',
  });
  
  // Schedule completion
  setTimeout(() => {
    const request = this.restoreRequests.get(requestId);
    if (request) {
      request.status = 'completed';
    }
  }, restoreTime);
  
  return {
    requestId,
    latency: 50,
  };
}

public getRestoreObjectStatus(
  bucketName: string,
  key: string
): { status: 'in-progress' | 'completed' | 'failed' | 'not-requested'; expires?: number } {
  const request = Array.from(this.restoreRequests.values())
    .find(r => r.bucket === bucketName && r.key === key && r.status !== 'failed');
  
  if (!request) {
    return { status: 'not-requested' };
  }
  
  return {
    status: request.status,
    expires: request.expires,
  };
}
```

### 5.3 Критерии завершения
- [x] Реализована симуляция multipart upload
- [x] Реализована симуляция restore operations для Glacier
- [x] Методы интегрированы в DataFlowEngine для обработки соответствующих операций
- [x] Метрики учитывают multipart uploads и restore operations (через существующие операции PUT/GET)

---

## Этап 6: Тестирование и валидация

### 6.1 Функциональное тестирование
- [ ] S3EmulationEngine корректно инициализируется
- [ ] Метрики обновляются в реальном времени
- [ ] Визуализация на canvas отображает корректные данные
- [ ] UI конфигурация показывает реальные метрики
- [ ] Lifecycle transitions работают корректно
- [ ] Multipart upload симулируется правильно
- [ ] Restore operations работают для Glacier объектов

### 6.2 Производительность
- [ ] Обновление метрик не вызывает лагов
- [ ] Визуализация на canvas не влияет на производительность
- [ ] История операций не растет бесконечно

### 6.3 Соответствие реальному S3
- [ ] Латентность операций соответствует реальным значениям AWS S3
- [ ] Storage classes работают как в реальном S3
- [ ] Lifecycle transitions происходят по правилам
- [ ] Multipart upload соответствует S3 API
- [ ] Restore operations соответствуют S3 Glacier API

---

## Приоритеты реализации

1. **Высокий приоритет:**
   - ✅ Этап 1: Создание S3EmulationEngine
   - ✅ Этап 2: Интеграция в EmulationEngine
   - ✅ Этап 4: Обновление UI конфигурации

2. **Средний приоритет:**
   - ✅ Этап 3: Визуализация на Canvas

3. **Низкий приоритет:**
   - ✅ Этап 5: Улучшение симуляции S3 паттернов - РЕАЛИЗОВАНО

## Статус выполнения

### Выполнено ✅
- **Этап 1**: Создан S3EmulationEngine с полной реализацией метрик
  - ✅ Реализован расчет распределения по storage classes на основе реальных данных из S3RoutingEngine
  - ✅ Добавлены методы в S3RoutingEngine: `getStorageClassDistribution()`, `getStorageClassSizeDistribution()`, `getAllObjectsForBucket()`
  - ✅ Обновлены методы `updateStorageClassDistribution()` и `calculateStorageClassDistribution()` для использования реальных данных
- **Этап 2**: Интегрирован в EmulationEngine, обновлен simulateDatabase
- **Этап 3**: Добавлена визуализация на Canvas с отображением бакетов, размера, throughput, utilization и Glacier объектов
- **Этап 4**: Обновлен S3DataLakeConfigAdvanced для использования реальных метрик из emulation engine
- **Этап 5**: Реализована симуляция multipart upload и restore operations
  - ✅ Добавлены методы multipart upload в S3RoutingEngine
  - ✅ Добавлены методы restore operations в S3RoutingEngine
  - ✅ Интегрированы новые операции в DataFlowEngine

### Осталось сделать ⏳
- **Этап 6**: Тестирование и валидация - рекомендуется провести после реализации всех этапов

### Заметки
- Реализована полная симулятивность без хардкода
- Все метрики рассчитываются динамически на основе данных из S3RoutingEngine
- UI конфигурация получает реальные метрики в реальном времени
- Визуализация на canvas показывает ключевые метрики S3
- ✅ **Доработано**: Расчет распределения по storage classes теперь использует реальные данные из S3RoutingEngine вместо нулей
  - Добавлены методы в S3RoutingEngine для получения распределения объектов по storage classes
  - Метрики по storage classes (standardObjects, glacierObjects, deepArchiveObjects и их размеры) теперь рассчитываются корректно

---

## Заметки для разработчика

1. **Не копировать логику из других компонентов** - каждый компонент уникален, нужно реализовать специфичную для S3 логику
2. **Следовать правилам курсора** - использовать optional chaining, валидацию данных, try-catch блоки
3. **Использовать реальные значения AWS S3** - латентность, лимиты, поведение должны соответствовать документации AWS
4. **Тестировать на реальных сценариях** - создавать бакеты, загружать объекты, настраивать lifecycle rules
5. **Документировать изменения** - обновлять PATCH_NOTES.md после завершения каждого этапа

---

## Следующие шаги после завершения

1. Добавить поддержку cross-region replication
2. Добавить симуляцию S3 events (S3 Event Notifications)
3. Добавить поддержку S3 Select
4. Добавить симуляцию S3 Batch Operations
5. Добавить визуализацию объектов в бакетах (tree view)

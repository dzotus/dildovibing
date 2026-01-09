import { CanvasNode, CanvasConnection } from '@/types';
import { JaegerSpan, TraceContext } from './JaegerEmulationEngine';

/**
 * GraphQL Query
 */
export interface GraphQLQuery {
  id: string;
  name?: string;
  query: string;
  variables?: Record<string, any>;
  operationName?: string;
  timestamp: number;
  duration?: number;
  success?: boolean;
  error?: string;
  complexity?: number;
  depth?: number;
}

/**
 * GraphQL Type Field
 */
export interface GraphQLField {
  name: string;
  type: string;
  description?: string;
  args?: Array<{
    name: string;
    type: string;
    defaultValue?: any;
  }>;
  resolver?: string; // ID of resolver node
}

/**
 * GraphQL Type
 */
export interface GraphQLType {
  name: string;
  kind: 'OBJECT' | 'SCALAR' | 'INTERFACE' | 'UNION' | 'ENUM' | 'INPUT_OBJECT';
  fields?: GraphQLField[];
  description?: string;
}

/**
 * GraphQL Schema
 */
export interface GraphQLSchema {
  types?: GraphQLType[];
  queries?: GraphQLType[];
  mutations?: GraphQLType[];
  subscriptions?: GraphQLType[];
}

/**
 * GraphQL Subscription Event
 */
export interface GraphQLSubscriptionEvent {
  id: string;
  type: 'create' | 'update' | 'delete' | 'custom';
  field: string;
  data: any;
  timestamp: number;
  sourceComponentId?: string; // ID компонента, который вызвал событие
  metadata?: Record<string, any>;
}

/**
 * GraphQL Subscription
 */
export interface GraphQLSubscription {
  id: string;
  query: string;
  variables?: Record<string, any>;
  timestamp: number;
  active: boolean;
  clientId?: string;
  lastEventTime?: number;
  eventCount?: number;
  filter?: {
    field?: string;
    type?: string[];
    sourceComponentId?: string;
  };
}

/**
 * GraphQL Resolver
 */
export interface GraphQLResolver {
  id: string;
  type: string;
  field: string;
  targetService?: string; // ID of target service node
  latency?: number; // ms
  enabled?: boolean;
  instances?: string[]; // Multiple instances for load balancing (IDs of target service nodes)
  connectionPoolSize?: number; // Max connections in pool for this resolver
}

/**
 * Connection Pool Configuration
 */
export interface ConnectionPoolConfig {
  enabled?: boolean;
  defaultPoolSize?: number; // Default max connections per resolver
  maxIdleTime?: number; // Max idle time before closing connection (ms)
  healthCheckInterval?: number; // Interval for health checks (ms)
  reconnectDelay?: number; // Delay before reconnecting (ms)
  maxReconnectAttempts?: number; // Max attempts to reconnect
}

/**
 * Load Balancing Configuration
 */
export interface LoadBalancingConfig {
  enabled?: boolean;
  strategy?: 'round-robin' | 'least-connections' | 'random' | 'weighted';
  weights?: Record<string, number>; // Weights for weighted strategy (instanceId -> weight)
}

/**
 * Rate Limit Configuration
 */
export interface RateLimitConfig {
  enabled?: boolean;
  queriesPerSecond?: number; // Limit for queries
  mutationsPerSecond?: number; // Limit for mutations
  subscriptionsPerSecond?: number; // Limit for subscriptions
  globalPerSecond?: number; // Global limit for all operations
  windowMs?: number; // Time window in milliseconds (default: 1000ms)
  identifyBy?: 'ip' | 'apiKey' | 'user' | 'all'; // How to identify clients
}

/**
 * Timeout Configuration
 */
export interface TimeoutConfig {
  enabled?: boolean;
  queryTimeout?: number; // Timeout for queries in ms
  mutationTimeout?: number; // Timeout for mutations in ms
  resolverTimeout?: number; // Timeout for individual resolvers in ms
  defaultTimeout?: number; // Default timeout in ms
}

/**
 * GraphQL Configuration
 */
export interface GraphQLConfig {
  endpoint?: string;
  schema?: GraphQLSchema;
  queries?: GraphQLQuery[];
  subscriptions?: GraphQLSubscription[];
  resolvers?: GraphQLResolver[];
  subscriptionsEnabled?: boolean;
  introspectionEnabled?: boolean;
  enableQueryComplexityAnalysis?: boolean;
  enableQueryDepthLimiting?: boolean;
  maxQueryDepth?: number;
  maxQueryComplexity?: number;
  enableCaching?: boolean;
  cacheTTL?: number; // seconds
  requestsPerSecond?: number;
  responseLatency?: number; // ms
  enableQueryBatching?: boolean; // Enable batch query processing
  enablePersistedQueries?: boolean; // Enable persisted queries
  persistedQueries?: PersistedQuery[]; // Stored persisted queries
  fieldComplexityWeights?: Record<string, number>; // Custom complexity weights for fields
  rateLimit?: RateLimitConfig; // Rate limiting configuration
  timeout?: TimeoutConfig; // Timeout configuration
  connectionPool?: ConnectionPoolConfig; // Connection pooling configuration
  loadBalancing?: LoadBalancingConfig; // Load balancing configuration
}

/**
 * Field-level Metrics
 */
export interface FieldMetrics {
  fieldName: string;
  typeName: string; // Query, Mutation, Subscription, или имя типа
  totalCalls: number;
  totalErrors: number;
  averageLatency: number;
  totalLatency: number;
  minLatency: number;
  maxLatency: number;
  lastCallTime?: number;
  errorRate: number;
  callsPerSecond: number;
}

/**
 * Type-level Metrics
 */
export interface TypeMetrics {
  typeName: 'Query' | 'Mutation' | 'Subscription';
  totalOperations: number;
  totalErrors: number;
  averageLatency: number;
  averageComplexity: number;
  averageDepth: number;
  errorRate: number;
  operationsPerSecond: number;
  lastOperationTime?: number;
}

/**
 * Operation-level Metrics
 */
export interface OperationMetrics {
  operationName: string; // Имя операции (например, "users", "createUser")
  operationType: 'query' | 'mutation' | 'subscription';
  totalCalls: number;
  totalErrors: number;
  averageLatency: number;
  averageComplexity: number;
  averageDepth: number;
  errorRate: number;
  callsPerSecond: number;
  lastCallTime?: number;
  history?: Array<{
    timestamp: number;
    latency: number;
    success: boolean;
    complexity?: number;
    depth?: number;
  }>;
}

/**
 * Error Category
 */
export type ErrorCategory = 'validation' | 'execution' | 'resolver' | 'timeout' | 'rate_limit' | 'complexity_limit' | 'depth_limit' | 'other';

/**
 * Error Metrics
 */
export interface ErrorMetrics {
  category: ErrorCategory;
  totalErrors: number;
  errorsPerSecond: number;
  lastErrorTime?: number;
  recentErrors?: Array<{
    timestamp: number;
    message: string;
    operationName?: string;
    operationType?: 'query' | 'mutation' | 'subscription';
  }>;
}

/**
 * Rate Limit Metrics
 */
export interface RateLimitMetrics {
  totalBlockedRequests: number;
  blockedRequestsPerSecond: number;
  totalRateLimitHits: number; // Total times rate limit was hit
  rateLimitHitsPerSecond: number;
  lastBlockedTime?: number;
  blockedByType?: {
    queries: number;
    mutations: number;
    subscriptions: number;
  };
}

/**
 * Timeout Metrics
 */
export interface TimeoutMetrics {
  totalTimeouts: number;
  timeoutsPerSecond: number;
  queryTimeouts: number;
  mutationTimeouts: number;
  resolverTimeouts: number;
  lastTimeoutTime?: number;
  averageTimeoutDuration?: number; // Average time before timeout
}

/**
 * Connection Pool Metrics
 */
export interface ConnectionPoolMetrics {
  totalConnections: number; // Total connections across all pools
  activeConnections: number; // Currently active connections
  idleConnections: number; // Currently idle connections
  maxConnections: number; // Max connections across all pools
  connectionUtilization: number; // Percentage of pool utilization (0-1)
  totalConnectionAttempts: number;
  failedConnectionAttempts: number;
  connectionFailureRate: number;
  averageConnectionWaitTime: number; // Average time waiting for connection (ms)
  poolMetricsByResolver?: Record<string, {
    poolSize: number;
    activeConnections: number;
    idleConnections: number;
    utilization: number;
    totalRequests: number;
    failedRequests: number;
  }>;
}

/**
 * Connection Health Metrics
 */
export interface ConnectionHealthMetrics {
  healthyConnections: number;
  unhealthyConnections: number;
  totalHealthChecks: number;
  failedHealthChecks: number;
  healthCheckFailureRate: number;
  totalReconnects: number;
  successfulReconnects: number;
  failedReconnects: number;
  reconnectSuccessRate: number;
  lastHealthCheckTime?: number;
  connectionsByHealth?: Record<string, {
    status: 'healthy' | 'unhealthy' | 'reconnecting';
    lastCheckTime: number;
    consecutiveFailures: number;
    reconnectAttempts: number;
  }>;
}

/**
 * Load Balancing Metrics
 */
export interface LoadBalancingMetrics {
  totalRequests: number;
  requestsByInstance?: Record<string, number>; // instanceId -> request count
  requestsByStrategy?: Record<string, number>; // strategy -> request count
  averageLoadDistribution: number; // Coefficient of variation (lower is better)
  instanceUtilization?: Record<string, number>; // instanceId -> utilization (0-1)
}

/**
 * GraphQL Metrics
 */
export interface GraphQLMetrics {
  queriesPerSecond: number;
  mutationsPerSecond: number;
  subscriptionsActive: number;
  averageResponseTime: number;
  totalQueries: number;
  totalMutations: number;
  totalErrors: number;
  errorRate: number;
  cacheHitRate: number;
  averageComplexity: number;
  averageDepth: number;
  resolverMetrics?: ResolverMetrics[];
  batchQueryMetrics?: BatchQueryMetrics;
  persistedQueriesCount?: number;
  persistedQueriesUsage?: number; // Total usage count
  introspectionMetrics?: IntrospectionMetrics;
  fieldMetrics?: FieldMetrics[];
  typeMetrics?: TypeMetrics[];
  operationMetrics?: OperationMetrics[];
  errorMetrics?: ErrorMetrics[];
  rateLimitMetrics?: RateLimitMetrics;
  timeoutMetrics?: TimeoutMetrics;
  connectionPoolMetrics?: ConnectionPoolMetrics;
  connectionHealthMetrics?: ConnectionHealthMetrics;
  loadBalancingMetrics?: LoadBalancingMetrics;
}

/**
 * GraphQL Load (for EmulationEngine)
 */
export interface GraphQLLoad {
  queriesPerSecond: number;
  mutationsPerSecond: number;
  averageLatency: number;
  errorRate: number;
  cpuUtilization: number;
  memoryUtilization: number;
}

/**
 * Resolver Metrics
 */
export interface ResolverMetrics {
  id: string;
  type: string;
  field: string;
  totalCalls: number;
  totalErrors: number;
  averageLatency: number;
  totalLatency: number;
  lastCallTime?: number;
  errorRate: number;
}

/**
 * Resolver Execution Result
 */
export interface ResolverExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  latency: number;
  resolverId: string;
}

/**
 * DataLoader Batch Request
 */
interface DataLoaderBatchRequest {
  key: string; // Unique key for the request (resolverId + variables hash)
  resolverId: string;
  variables: Record<string, any>;
  resolve: (data: any) => void;
  reject: (error: Error) => void;
}

/**
 * DataLoader Metrics
 */
export interface DataLoaderMetrics {
  totalBatches: number;
  totalRequests: number;
  totalBatchedRequests: number;
  averageBatchSize: number;
  deduplicationRate: number; // Percentage of requests that were deduplicated
  cacheHitRate: number; // Percentage of requests served from cache
  averageLatencyReduction: number; // Average latency reduction due to batching (ms)
}

/**
 * N+1 Problem Detection
 */
export interface NPlusOneProblem {
  field: string;
  resolverId: string;
  parentType: string;
  estimatedCalls: number; // Estimated number of calls if N+1 occurs
  severity: 'low' | 'medium' | 'high';
  detectedAt: number;
}

/**
 * Persisted Query
 */
export interface PersistedQuery {
  id: string;
  hash: string; // SHA-256 hash of the query
  query: string;
  operationName?: string;
  addedAt: number;
  lastUsedAt?: number;
  useCount: number;
}

/**
 * Batch Query Request
 */
export interface BatchQueryRequest {
  query?: string;
  variables?: Record<string, any>;
  operationName?: string;
  extensions?: {
    persistedQuery?: {
      version: number;
      sha256Hash: string;
    };
  };
}

/**
 * Batch Query Metrics
 */
export interface BatchQueryMetrics {
  totalBatches: number;
  totalBatchRequests: number;
  averageBatchSize: number;
  averageBatchLatency: number;
  totalBatchErrors: number;
  batchErrorRate: number;
}

/**
 * Schema Validation Error
 */
export interface SchemaValidationError {
  message: string;
  path?: string[];
  field?: string;
  type?: string;
}

/**
 * Schema Validation Result
 */
export interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaValidationError[];
}

/**
 * Introspection Metrics
 */
export interface IntrospectionMetrics {
  totalIntrospectionQueries: number;
  introspectionQueriesPerSecond: number;
  lastIntrospectionTime?: number;
}

/**
 * Schema Change
 */
export interface SchemaChange {
  id: string;
  changeType: 'field_added' | 'field_removed' | 'field_type_changed' | 'type_added' | 'type_removed' | 'argument_added' | 'argument_removed' | 'argument_type_changed';
  field?: string;
  typeName?: string; // Имя GraphQL типа
  oldValue?: any;
  newValue?: any;
  breaking: boolean;
  timestamp: number;
}

/**
 * Schema Version
 */
export interface SchemaVersion {
  version: string;
  schema: GraphQLSchema;
  timestamp: number;
  changes: SchemaChange[];
}

/**
 * GraphQL DataLoader
 * Реализует паттерн DataLoader для батчинга, дедупликации и кэширования запросов к резолверам
 */
class GraphQLDataLoader {
  private batchQueue: DataLoaderBatchRequest[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 10; // ms - задержка перед выполнением батча
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 1000; // ms - TTL для request-scoped cache
  
  // Метрики
  private totalBatches: number = 0;
  private totalRequests: number = 0;
  private totalBatchedRequests: number = 0;
  private totalDeduplicated: number = 0;
  private totalCacheHits: number = 0;
  private totalLatencyReduction: number = 0;
  
  constructor(
    private resolverId: string,
    private executeResolverFn: (
      resolverId: string,
      variables: Record<string, any>[],
      nodes: CanvasNode[],
      connections: CanvasConnection[]
    ) => Promise<ResolverExecutionResult[]>,
    private nodes: CanvasNode[],
    private connections: CanvasConnection[]
  ) {}
  
  /**
   * Загрузить данные через DataLoader (с батчингом и дедупликацией)
   */
  public async load(
    variables: Record<string, any>,
    useCache: boolean = true
  ): Promise<any> {
    this.totalRequests++;
    
    // Создаем ключ для кэша и дедупликации
    const cacheKey = this.getCacheKey(variables);
    
    // Проверяем кэш (request-scoped)
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
        this.totalCacheHits++;
        return cached.data;
      }
    }
    
    // Проверяем дедупликацию - есть ли уже такой запрос в очереди
    const existingRequest = this.batchQueue.find(r => r.key === cacheKey);
    if (existingRequest) {
      this.totalDeduplicated++;
      // Возвращаем тот же промис
      return new Promise((resolve, reject) => {
        existingRequest.resolve = (data: any) => {
          resolve(data);
          // Обновляем resolve для других ожидающих
          const otherRequests = this.batchQueue.filter(r => r.key === cacheKey && r !== existingRequest);
          otherRequests.forEach(r => r.resolve(data));
        };
        existingRequest.reject = reject;
      });
    }
    
    // Создаем новый запрос
    return new Promise((resolve, reject) => {
      this.batchQueue.push({
        key: cacheKey,
        resolverId: this.resolverId,
        variables,
        resolve: (data: any) => {
          // Сохраняем в кэш
          if (useCache) {
            this.cache.set(cacheKey, {
              data,
              timestamp: Date.now(),
            });
          }
          resolve(data);
        },
        reject,
      });
      
      // Запускаем таймер для батча, если его еще нет
      if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => {
          this.executeBatch();
        }, this.BATCH_DELAY);
      }
    });
  }
  
  /**
   * Выполнить батч запросов
   */
  private async executeBatch(): Promise<void> {
    if (this.batchQueue.length === 0) {
      this.batchTimeout = null;
      return;
    }
    
    // Очищаем таймер
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    
    // Группируем запросы по ключу (дедупликация)
    const uniqueRequests = new Map<string, DataLoaderBatchRequest>();
    for (const request of this.batchQueue) {
      if (!uniqueRequests.has(request.key)) {
        uniqueRequests.set(request.key, request);
      }
    }
    
    const batch = Array.from(uniqueRequests.values());
    this.batchQueue = [];
    
    if (batch.length === 0) return;
    
    this.totalBatches++;
    this.totalBatchedRequests += batch.length;
    
    // Извлекаем все уникальные переменные
    const variablesList = batch.map(r => r.variables);
    
    // Выполняем батч через резолвер
    try {
      const startTime = Date.now();
      const results = await this.executeResolverFn(
        this.resolverId,
        variablesList,
        this.nodes,
        this.connections
      );
      const batchLatency = Date.now() - startTime;
      
      // Рассчитываем экономию latency (один батч вместо N запросов)
      const singleRequestLatency = batch.length > 0 ? batchLatency / batch.length : 0;
      const estimatedSingleLatency = singleRequestLatency * 1.5; // Предполагаем, что одиночные запросы медленнее
      const latencyReduction = (estimatedSingleLatency - singleRequestLatency) * batch.length;
      this.totalLatencyReduction += Math.max(0, latencyReduction);
      
      // Распределяем результаты по запросам
      for (let i = 0; i < batch.length; i++) {
        const request = batch[i];
        const result = results[i];
        
        if (result && result.success) {
          request.resolve(result.data);
        } else {
          request.reject(new Error(result?.error || 'Resolver execution failed'));
        }
      }
    } catch (error) {
      // В случае ошибки отклоняем все запросы
      for (const request of batch) {
        request.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }
  
  /**
   * Получить ключ кэша для переменных
   */
  private getCacheKey(variables: Record<string, any>): string {
    return `${this.resolverId}:${JSON.stringify(variables)}`;
  }
  
  /**
   * Получить метрики DataLoader
   */
  public getMetrics(): {
    totalBatches: number;
    totalRequests: number;
    totalBatchedRequests: number;
    averageBatchSize: number;
    deduplicationRate: number;
    cacheHitRate: number;
    averageLatencyReduction: number;
  } {
    return {
      totalBatches: this.totalBatches,
      totalRequests: this.totalRequests,
      totalBatchedRequests: this.totalBatchedRequests,
      averageBatchSize: this.totalBatches > 0 ? this.totalBatchedRequests / this.totalBatches : 0,
      deduplicationRate: this.totalRequests > 0 ? (this.totalDeduplicated / this.totalRequests) * 100 : 0,
      cacheHitRate: this.totalRequests > 0 ? (this.totalCacheHits / this.totalRequests) * 100 : 0,
      averageLatencyReduction: this.totalBatches > 0 ? this.totalLatencyReduction / this.totalBatches : 0,
    };
  }
  
  /**
   * Очистить кэш
   */
  public clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * Очистить очередь (для завершения текущего запроса)
   */
  public clearQueue(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    // Выполняем оставшиеся запросы
    if (this.batchQueue.length > 0) {
      this.executeBatch();
    }
  }
}

/**
 * GraphQL Emulation Engine
 * Симулирует работу GraphQL сервера: обработка запросов, валидация, выполнение, метрики
 */
export class GraphQLEmulationEngine {
  private config: GraphQLConfig | null = null;
  
  // Метрики GraphQL
  private graphQLMetrics: GraphQLMetrics = {
    queriesPerSecond: 0,
    mutationsPerSecond: 0,
    subscriptionsActive: 0,
    averageResponseTime: 0,
    totalQueries: 0,
    totalMutations: 0,
    totalErrors: 0,
    errorRate: 0,
    cacheHitRate: 0,
    averageComplexity: 0,
    averageDepth: 0,
  };
  
  // История запросов для расчета метрик
  private queryHistory: GraphQLQuery[] = [];
  private readonly MAX_HISTORY_SIZE = 1000;
  
  // Кэш запросов
  private queryCache: Map<string, { data: any; timestamp: number }> = new Map();
  
  // Активные подписки
  private activeSubscriptions: Map<string, GraphQLSubscription> = new Map();
  
  // История latency для расчета среднего
  private latencyHistory: number[] = [];
  private readonly MAX_LATENCY_HISTORY = 500;
  
  // История сложности и глубины
  private complexityHistory: number[] = [];
  private depthHistory: number[] = [];
  
  // Временные метки для расчета RPS
  private lastSecondStart: number = Date.now();
  private queriesThisSecond: number = 0;
  private mutationsThisSecond: number = 0;
  
  // Метрики резолверов
  private resolverMetrics: Map<string, ResolverMetrics> = new Map();
  
  // ID GraphQL компонента (для поиска соединений)
  private componentId: string | null = null;
  
  // Tracing support
  private traceContexts: Map<string, TraceContext> = new Map(); // traceId -> TraceContext
  private traceIdCounter: number = 0;
  private spanIdCounter: number = 0;
  private activeSpans: Map<string, { span: JaegerSpan; startTime: number }> = new Map(); // spanId -> span info
  
  // DataLoader для батчинга запросов
  private dataLoaders: Map<string, GraphQLDataLoader> = new Map(); // resolverId -> DataLoader
  private dataLoaderMetrics: DataLoaderMetrics = {
    totalBatches: 0,
    totalRequests: 0,
    totalBatchedRequests: 0,
    averageBatchSize: 0,
    deduplicationRate: 0,
    cacheHitRate: 0,
    averageLatencyReduction: 0,
  };
  
  // N+1 проблемы
  private nPlusOneProblems: NPlusOneProblem[] = [];
  private readonly MAX_N_PLUS_ONE_HISTORY = 100;
  
  // Кэш DataLoader для текущего запроса (request-scoped cache)
  private requestCache: Map<string, any> = new Map();
  
  // Очередь событий для подписок
  private subscriptionEvents: GraphQLSubscriptionEvent[] = [];
  private readonly MAX_EVENTS_QUEUE = 1000;
  
  // Метрики подписок
  private subscriptionMetrics = {
    totalEvents: 0,
    eventsPerSecond: 0,
    averageDeliveryLatency: 0,
    totalDeliveryErrors: 0,
    deliveryErrorRate: 0,
    lastEventTime: 0,
  };
  
  // История latency доставки событий
  private deliveryLatencyHistory: number[] = [];
  private readonly MAX_DELIVERY_LATENCY_HISTORY = 500;
  
  // Счетчики событий за секунду
  private eventsThisSecond: number = 0;
  private lastEventSecondStart: number = Date.now();
  
  // Лимиты подписок
  private readonly MAX_SUBSCRIPTIONS = 1000;
  private readonly SUBSCRIPTION_TIMEOUT = 300000; // 5 минут неактивности
  
  // Persisted queries
  private persistedQueries: Map<string, PersistedQuery> = new Map(); // hash -> PersistedQuery
  private persistedQueriesUsage: number = 0;
  
  // Batch query metrics
  private batchQueryMetrics: BatchQueryMetrics = {
    totalBatches: 0,
    totalBatchRequests: 0,
    averageBatchSize: 0,
    averageBatchLatency: 0,
    totalBatchErrors: 0,
    batchErrorRate: 0,
  };
  
  // История latency для batch запросов
  private batchLatencyHistory: number[] = [];
  private readonly MAX_BATCH_LATENCY_HISTORY = 500;
  
  // Метрики introspection
  private introspectionMetrics: IntrospectionMetrics = {
    totalIntrospectionQueries: 0,
    introspectionQueriesPerSecond: 0,
  };
  private introspectionQueriesThisSecond: number = 0;
  private lastIntrospectionSecondStart: number = Date.now();
  
  // История изменений схемы
  private schemaChanges: SchemaChange[] = [];
  private readonly MAX_SCHEMA_CHANGES_HISTORY = 100;
  private schemaVersions: SchemaVersion[] = [];
  private readonly MAX_SCHEMA_VERSIONS = 50;
  private previousSchema: GraphQLSchema | null = null;
  
  // Расширенные метрики - Field-level
  private fieldMetrics: Map<string, FieldMetrics> = new Map(); // key: "typeName:fieldName"
  private readonly MAX_FIELD_METRICS_HISTORY = 1000;
  
  // Расширенные метрики - Type-level
  private typeMetrics: Map<'Query' | 'Mutation' | 'Subscription', TypeMetrics> = new Map();
  
  // Расширенные метрики - Operation-level
  private operationMetrics: Map<string, OperationMetrics> = new Map(); // key: operationName
  private readonly MAX_OPERATION_HISTORY = 100; // История для каждой операции
  private readonly MAX_OPERATIONS = 500; // Максимум отслеживаемых операций
  
  // Расширенные метрики - Error categorization
  private errorMetrics: Map<ErrorCategory, ErrorMetrics> = new Map();
  private readonly MAX_ERROR_HISTORY = 100; // История ошибок для каждой категории
  private errorHistory: Array<{
    timestamp: number;
    category: ErrorCategory;
    message: string;
    operationName?: string;
    operationType?: 'query' | 'mutation' | 'subscription';
  }> = [];
  private readonly MAX_TOTAL_ERROR_HISTORY = 500;
  
  // Счетчики для расчета per-second метрик
  private fieldCallsThisSecond: Map<string, number> = new Map();
  private typeOpsThisSecond: Map<'Query' | 'Mutation' | 'Subscription', number> = new Map();
  private operationCallsThisSecond: Map<string, number> = new Map();
  private errorCountsThisSecond: Map<ErrorCategory, number> = new Map();
  private lastMetricsSecondStart: number = Date.now();
  
  // Rate limiting
  private rateLimitCounters: Map<string, {
    count: number;
    resetAt: number;
    windowStart: number;
  }> = new Map(); // key: identifier:operationType -> counter
  private rateLimitMetrics: RateLimitMetrics = {
    totalBlockedRequests: 0,
    blockedRequestsPerSecond: 0,
    totalRateLimitHits: 0,
    rateLimitHitsPerSecond: 0,
    blockedByType: {
      queries: 0,
      mutations: 0,
      subscriptions: 0,
    },
  };
  private blockedRequestsThisSecond: number = 0;
  private rateLimitHitsThisSecond: number = 0;
  private lastRateLimitSecondStart: number = Date.now();
  
  // Timeout tracking
  private timeoutMetrics: TimeoutMetrics = {
    totalTimeouts: 0,
    timeoutsPerSecond: 0,
    queryTimeouts: 0,
    mutationTimeouts: 0,
    resolverTimeouts: 0,
  };
  private timeoutsThisSecond: number = 0;
  private lastTimeoutSecondStart: number = Date.now();
  private timeoutDurations: number[] = []; // История длительностей до таймаута
  private readonly MAX_TIMEOUT_HISTORY = 100;
  
  // Connection Pooling
  private connectionPools: Map<string, {
    connections: Array<{
      id: string;
      status: 'idle' | 'active' | 'unhealthy';
      createdAt: number;
      lastUsed: number;
      healthCheckTime?: number;
      consecutiveFailures: number;
    }>;
    maxSize: number;
    currentSize: number;
    waitingQueue: Array<{
      resolve: (connection: any) => void;
      reject: (error: Error) => void;
      timestamp: number;
    }>;
    totalRequests: number;
    failedRequests: number;
  }> = new Map(); // key: resolverId -> pool
  
  private connectionPoolMetrics: ConnectionPoolMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    maxConnections: 0,
    connectionUtilization: 0,
    totalConnectionAttempts: 0,
    failedConnectionAttempts: 0,
    connectionFailureRate: 0,
    averageConnectionWaitTime: 0,
  };
  
  private connectionWaitTimes: number[] = []; // История времени ожидания соединения
  private readonly MAX_WAIT_TIME_HISTORY = 100;
  
  // Connection Health
  private connectionHealth: Map<string, {
    status: 'healthy' | 'unhealthy' | 'reconnecting';
    lastCheckTime: number;
    consecutiveFailures: number;
    reconnectAttempts: number;
    lastReconnectTime?: number;
  }> = new Map(); // key: connectionId (resolverId:instanceId) -> health
  
  private connectionHealthMetrics: ConnectionHealthMetrics = {
    healthyConnections: 0,
    unhealthyConnections: 0,
    totalHealthChecks: 0,
    failedHealthChecks: 0,
    healthCheckFailureRate: 0,
    totalReconnects: 0,
    successfulReconnects: 0,
    failedReconnects: 0,
    reconnectSuccessRate: 0,
  };
  
  private healthCheckInterval: NodeJS.Timeout | null = null;
  
  // Load Balancing
  private loadBalancingState: Map<string, {
    strategy: 'round-robin' | 'least-connections' | 'random' | 'weighted';
    currentIndex: number; // For round-robin
    instanceConnections: Map<string, number>; // instanceId -> active connections count
    instanceWeights?: Map<string, number>; // instanceId -> weight
    totalRequests: number;
    requestsByInstance: Map<string, number>; // instanceId -> request count
  }> = new Map(); // key: resolverId -> load balancing state
  
  private loadBalancingMetrics: LoadBalancingMetrics = {
    totalRequests: 0,
    averageLoadDistribution: 0,
  };
  
  /**
   * Инициализирует конфигурацию GraphQL из конфига компонента
   */
  initializeConfig(node: CanvasNode): void {
    this.componentId = node.id;
    const config = (node.data.config || {}) as GraphQLConfig;
    this.config = {
      endpoint: config.endpoint || '/graphql',
      schema: config.schema || this.getDefaultSchema(),
      queries: config.queries || [],
      subscriptions: config.subscriptions || [],
      resolvers: config.resolvers || [],
      subscriptionsEnabled: config.subscriptionsEnabled ?? true,
      introspectionEnabled: config.introspectionEnabled ?? true,
      enableQueryComplexityAnalysis: config.enableQueryComplexityAnalysis ?? true,
      enableQueryDepthLimiting: config.enableQueryDepthLimiting ?? true,
      maxQueryDepth: config.maxQueryDepth ?? 15,
      maxQueryComplexity: config.maxQueryComplexity ?? 1000,
      enableCaching: config.enableCaching ?? false,
      cacheTTL: config.cacheTTL ?? 300,
      requestsPerSecond: config.requestsPerSecond || 100,
      responseLatency: config.responseLatency || 50,
      enableQueryBatching: config.enableQueryBatching ?? true,
      enablePersistedQueries: config.enablePersistedQueries ?? true,
      persistedQueries: config.persistedQueries || [],
      fieldComplexityWeights: config.fieldComplexityWeights || {},
      rateLimit: config.rateLimit || {
        enabled: false,
        queriesPerSecond: 100,
        mutationsPerSecond: 50,
        subscriptionsPerSecond: 10,
        globalPerSecond: 200,
        windowMs: 1000,
        identifyBy: 'ip',
      },
      timeout: config.timeout || {
        enabled: false,
        queryTimeout: 30000, // 30 seconds
        mutationTimeout: 60000, // 60 seconds
        resolverTimeout: 5000, // 5 seconds
        defaultTimeout: 30000, // 30 seconds
      },
      connectionPool: config.connectionPool || {
        enabled: false,
        defaultPoolSize: 10,
        maxIdleTime: 300000, // 5 minutes
        healthCheckInterval: 30000, // 30 seconds
        reconnectDelay: 1000, // 1 second
        maxReconnectAttempts: 3,
      },
      loadBalancing: config.loadBalancing || {
        enabled: false,
        strategy: 'round-robin',
      },
    };
    
    // Инициализируем connection pools для резолверов
    if (this.config.connectionPool?.enabled && this.config.resolvers) {
      for (const resolver of this.config.resolvers) {
        if (resolver.enabled !== false) {
          this.initializeConnectionPool(resolver);
        }
      }
    }
    
    // Инициализируем load balancing для резолверов с несколькими инстансами
    if (this.config.loadBalancing?.enabled && this.config.resolvers) {
      for (const resolver of this.config.resolvers) {
        if (resolver.instances && resolver.instances.length > 1) {
          this.initializeLoadBalancing(resolver);
        }
      }
    }
    
    // Запускаем health checks, если включены
    if (this.config.connectionPool?.enabled && this.config.connectionPool.healthCheckInterval) {
      this.startHealthChecks();
    }
    
    // Инициализируем persisted queries
    if (this.config.persistedQueries) {
      for (const pq of this.config.persistedQueries) {
        this.persistedQueries.set(pq.hash, pq);
      }
    }
    
    // Инициализируем активные подписки
    if (this.config.subscriptions) {
      for (const sub of this.config.subscriptions) {
        if (sub.active) {
          this.activeSubscriptions.set(sub.id, sub);
        }
      }
    }
    
    // Инициализируем метрики резолверов
    if (this.config.resolvers) {
      for (const resolver of this.config.resolvers) {
        if (!this.resolverMetrics.has(resolver.id)) {
          this.resolverMetrics.set(resolver.id, {
            id: resolver.id,
            type: resolver.type,
            field: resolver.field,
            totalCalls: 0,
            totalErrors: 0,
            averageLatency: 0,
            totalLatency: 0,
            errorRate: 0,
          });
        }
      }
    }
    
    // Обновляем метрики подписок
    this.graphQLMetrics.subscriptionsActive = this.activeSubscriptions.size;
    
    // Отслеживаем изменения схемы
    if (this.config.schema) {
      this.detectSchemaChanges(this.config.schema);
    }
  }

  /**
   * Получить пустую схему по умолчанию
   * Пользователь должен сам создавать схему для реалистичной симуляции
   */
  private getDefaultSchema(): GraphQLSchema {
    return {
      types: [],
      queries: [],
      mutations: [],
      subscriptions: [],
    };
  }

  /**
   * Вычислить SHA-256 hash для persisted query (упрощенная версия для симуляции)
   */
  private computeQueryHash(query: string): string {
    // В реальной системе используется SHA-256
    // Для симуляции используем простой hash
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Преобразуем в hex строку (имитация SHA-256)
    return Math.abs(hash).toString(16).padStart(64, '0').substring(0, 64);
  }

  /**
   * Получить persisted query по hash
   */
  private getPersistedQuery(hash: string): PersistedQuery | undefined {
    return this.persistedQueries.get(hash);
  }

  /**
   * Сохранить persisted query
   */
  public savePersistedQuery(query: string, operationName?: string): PersistedQuery {
    const hash = this.computeQueryHash(query);
    const existing = this.persistedQueries.get(hash);
    
    if (existing) {
      // Обновляем существующий
      existing.lastUsedAt = Date.now();
      existing.useCount++;
      return existing;
    }
    
    // Создаем новый
    const persistedQuery: PersistedQuery = {
      id: `pq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      hash,
      query,
      operationName,
      addedAt: Date.now(),
      lastUsedAt: Date.now(),
      useCount: 1,
    };
    
    this.persistedQueries.set(hash, persistedQuery);
    
    // Обновляем конфиг
    if (this.config) {
      this.config.persistedQueries = Array.from(this.persistedQueries.values());
    }
    
    return persistedQuery;
  }

  /**
   * Обработать batch запросы (массив запросов)
   */
  public async processBatchQueries(
    requests: BatchQueryRequest[],
    nodes?: CanvasNode[],
    connections?: CanvasConnection[]
  ): Promise<Array<{
    success: boolean;
    data?: any;
    errors?: Array<{ message: string; path?: string[] }>;
    latency: number;
    complexity?: number;
    depth?: number;
  }>> {
    if (!this.config?.enableQueryBatching) {
      return requests.map(req => ({
        success: false,
        errors: [{ message: 'Query batching is disabled' }],
        latency: 0,
      }));
    }
    
    const startTime = Date.now();
    this.batchQueryMetrics.totalBatches++;
    this.batchQueryMetrics.totalBatchRequests += requests.length;
    
    // Выполняем все запросы параллельно
    const results = await Promise.all(
      requests.map(req => this.processSingleBatchRequest(req, nodes, connections))
    );
    
    const batchLatency = Date.now() - startTime;
    
    // Обновляем метрики
    this.batchLatencyHistory.push(batchLatency);
    if (this.batchLatencyHistory.length > this.MAX_BATCH_LATENCY_HISTORY) {
      this.batchLatencyHistory.shift();
    }
    
    const sum = this.batchLatencyHistory.reduce((a, b) => a + b, 0);
    this.batchQueryMetrics.averageBatchLatency = sum / this.batchLatencyHistory.length;
    this.batchQueryMetrics.averageBatchSize = 
      this.batchQueryMetrics.totalBatchRequests / this.batchQueryMetrics.totalBatches;
    
    // Подсчитываем ошибки
    const errors = results.filter(r => !r.success).length;
    this.batchQueryMetrics.totalBatchErrors += errors;
    this.batchQueryMetrics.batchErrorRate = 
      this.batchQueryMetrics.totalBatchErrors / this.batchQueryMetrics.totalBatchRequests;
    
    return results;
  }

  /**
   * Обработать один запрос из batch
   */
  private async processSingleBatchRequest(
    request: BatchQueryRequest,
    nodes?: CanvasNode[],
    connections?: CanvasConnection[]
  ): Promise<{
    success: boolean;
    data?: any;
    errors?: Array<{ message: string; path?: string[] }>;
    latency: number;
    complexity?: number;
    depth?: number;
  }> {
    let query = request.query;
    
    // Проверяем persisted query
    if (!query && request.extensions?.persistedQuery) {
      const hash = request.extensions.persistedQuery.sha256Hash;
      const persistedQuery = this.getPersistedQuery(hash);
      
      if (persistedQuery) {
        query = persistedQuery.query;
        // Обновляем статистику
        persistedQuery.lastUsedAt = Date.now();
        persistedQuery.useCount++;
        this.persistedQueriesUsage++;
      } else {
        // Persisted query не найден
        return {
          success: false,
          errors: [{ message: `Persisted query not found: ${hash}` }],
          latency: 0,
        };
      }
    }
    
    if (!query) {
      return {
        success: false,
        errors: [{ message: 'Query is required' }],
        latency: 0,
      };
    }
    
    // Обрабатываем как обычный запрос
    return await this.processQuery(
      {
        query,
        variables: request.variables,
        operationName: request.operationName,
      },
      nodes,
      connections
    );
  }

  /**
   * Обработать GraphQL запрос
   */
  public async processQuery(
    request: {
      query?: string;
      variables?: Record<string, any>;
      operationName?: string;
      extensions?: {
        persistedQuery?: {
          version: number;
          sha256Hash: string;
        };
      };
      headers?: Record<string, string>; // Headers для идентификации клиента
    },
    nodes?: CanvasNode[],
    connections?: CanvasConnection[],
    getJaegerEngines?: () => Map<string, any> // Map<string, JaegerEmulationEngine>
  ): Promise<{
    success: boolean;
    data?: any;
    errors?: Array<{ message: string; path?: string[] }>;
    latency: number;
    complexity?: number;
    depth?: number;
    cached?: boolean;
  }> {
    const startTime = Date.now();
    
    let query = request.query;
    
    // Проверяем persisted query, если query не предоставлен
    if (!query && request.extensions?.persistedQuery && this.config?.enablePersistedQueries) {
      const hash = request.extensions.persistedQuery.sha256Hash;
      const persistedQuery = this.getPersistedQuery(hash);
      
      if (persistedQuery) {
        query = persistedQuery.query;
        // Обновляем статистику
        persistedQuery.lastUsedAt = Date.now();
        persistedQuery.useCount++;
        this.persistedQueriesUsage++;
      } else {
        // Persisted query не найден - возвращаем ошибку
        const latency = Date.now() - startTime;
        const endTime = Date.now() / 1000;
        const startTimeSeconds = startTime / 1000;
        const errorMessage = `Persisted query not found: ${hash}`;
        this.createQuerySpan(
          'persisted_query',
          'query',
          startTimeSeconds,
          endTime,
          false,
          undefined,
          undefined,
          errorMessage,
          undefined,
          getJaegerEngines
        );
        return {
          success: false,
          errors: [{ message: errorMessage }],
          latency,
        };
      }
    }
    
    if (!query) {
      const latency = Date.now() - startTime;
      const endTime = Date.now() / 1000;
      const startTimeSeconds = startTime / 1000;
      const errorMessage = 'Query is required';
      this.createQuerySpan(
        'unknown',
        'query',
        startTimeSeconds,
        endTime,
        false,
        undefined,
        undefined,
        errorMessage,
        undefined,
        getJaegerEngines
      );
      return {
        success: false,
        errors: [{ message: errorMessage }],
        latency,
      };
    }
    
    // Парсим запрос для получения operationType и fields (нужно для метрик)
    const parseResult = this.parseQuery(query);
    const operationType = parseResult.operationType || 'query';
    const fields = parseResult.fields;
    const operationName = request.operationName || (fields && fields.length > 0 ? fields[0].name : undefined);
    
    // Проверяем rate limit
    const clientIdentifier = this.getClientIdentifier(request.headers, request.variables);
    const rateLimitResult = this.checkRateLimit(operationType, clientIdentifier);
    if (!rateLimitResult.allowed) {
      const latency = Date.now() - startTime;
      const errorMessage = `Rate limit exceeded. Limit: ${rateLimitResult.limit}/${rateLimitResult.resetAt - Date.now()}ms. Reset at: ${new Date(rateLimitResult.resetAt).toISOString()}`;
      this.recordQuery(false, latency, 0, 0, false, operationName, operationType, fields, errorMessage);
      const endTime = Date.now() / 1000;
      const startTimeSeconds = startTime / 1000;
      this.createQuerySpan(
        operationName || 'unknown',
        operationType,
        startTimeSeconds,
        endTime,
        false,
        undefined,
        undefined,
        errorMessage,
        undefined,
        getJaegerEngines
      );
      return {
        success: false,
        errors: [{ message: errorMessage }],
        latency,
      };
    }
    
    // Проверяем кэш
    if (this.config?.enableCaching) {
      const cacheKey = this.getCacheKey({ query, variables: request.variables });
      const cached = this.queryCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < (this.config.cacheTTL! * 1000)) {
        const latency = Date.now() - startTime;
        this.recordQuery(true, latency, 0, 0, true, operationName, operationType, fields);
        return {
          success: true,
          data: cached.data,
          latency,
          cached: true,
        };
      }
    }
    
    // Проверяем, является ли это introspection запросом
    if (query.includes('__schema') || query.includes('__type') || query.includes('__typename')) {
      const introspectionResult = this.handleIntrospectionQuery(query);
      const latency = Date.now() - startTime;
      
      if (introspectionResult.success) {
        this.recordQuery(true, latency, 0, 0, false, '__introspection', 'query', fields);
        const endTime = Date.now() / 1000;
        const startTimeSeconds = startTime / 1000;
        this.createQuerySpan(
          '__introspection',
          'query',
          startTimeSeconds,
          endTime,
          true,
          undefined,
          undefined,
          undefined,
          undefined,
          getJaegerEngines
        );
        return {
          success: true,
          data: introspectionResult.data,
          latency,
        };
      } else {
        const errorMessage = introspectionResult.error || 'Introspection query failed';
        this.recordQuery(false, latency, 0, 0, false, '__introspection', 'query', fields, errorMessage);
        const endTime = Date.now() / 1000;
        const startTimeSeconds = startTime / 1000;
        this.createQuerySpan(
          '__introspection',
          'query',
          startTimeSeconds,
          endTime,
          false,
          undefined,
          undefined,
          errorMessage,
          undefined,
          getJaegerEngines
        );
        return {
          success: false,
          errors: [{ message: errorMessage }],
          latency,
        };
      }
    }
    
    // Парсим и валидируем запрос (если еще не распарсили)
    if (!parseResult.success) {
      const latency = Date.now() - startTime;
      const errorMessage = parseResult.error || 'Invalid query';
      this.recordQuery(false, latency, 0, 0, false, operationName, operationType, fields, errorMessage);
      const endTime = Date.now() / 1000;
      const startTimeSeconds = startTime / 1000;
      this.createQuerySpan(
        operationName || 'unknown',
        operationType,
        startTimeSeconds,
        endTime,
        false,
        undefined,
        undefined,
        errorMessage,
        undefined,
        getJaegerEngines
      );
      return {
        success: false,
        errors: [{ message: errorMessage }],
        latency,
      };
    }
    
    // Валидация запроса против схемы
    if (parseResult.operationType && parseResult.fields) {
      const validationResult = this.validateQueryAgainstSchema(
        parseResult.operation || '',
        parseResult.operationType,
        parseResult.fields,
        request.variables
      );
      
      if (!validationResult.valid) {
        const latency = Date.now() - startTime;
      const errorMessage = validationResult.errors[0]?.message || 'Validation failed';
      this.recordQuery(false, latency, 0, 0, false, operationName, operationType, fields, errorMessage);
      const endTime = Date.now() / 1000;
      const startTimeSeconds = startTime / 1000;
      this.createQuerySpan(
        operationName || 'unknown',
        operationType,
        startTimeSeconds,
        endTime,
        false,
        undefined,
        undefined,
        errorMessage,
        undefined,
        getJaegerEngines
      );
        return {
          success: false,
          errors: validationResult.errors.map(e => ({
            message: e.message,
            path: e.path,
          })),
          latency,
        };
      }
    }
    
    // Вычисляем сложность и глубину
    const complexity = this.calculateComplexity(parseResult.operation || '');
    const depth = this.calculateDepth(parseResult.operation || '');
    
    // Проверяем лимиты
    if (this.config?.enableQueryDepthLimiting && depth > (this.config.maxQueryDepth || 15)) {
      const latency = Date.now() - startTime;
      const errorMessage = `Query depth ${depth} exceeds maximum ${this.config.maxQueryDepth}`;
      this.recordQuery(false, latency, complexity, depth, false, operationName, operationType, fields, errorMessage);
      const endTime = Date.now() / 1000;
      const startTimeSeconds = startTime / 1000;
      this.createQuerySpan(
        operationName || 'unknown',
        operationType,
        startTimeSeconds,
        endTime,
        false,
        complexity,
        depth,
        errorMessage,
        undefined,
        getJaegerEngines
      );
      return {
        success: false,
        errors: [{ message: errorMessage }],
        latency,
        complexity,
        depth,
      };
    }
    
    if (this.config?.enableQueryComplexityAnalysis && complexity > (this.config.maxQueryComplexity || 1000)) {
      const latency = Date.now() - startTime;
      const errorMessage = `Query complexity ${complexity} exceeds maximum ${this.config.maxQueryComplexity}`;
      this.recordQuery(false, latency, complexity, depth, false, operationName, operationType, fields, errorMessage);
      const endTime = Date.now() / 1000;
      const startTimeSeconds = startTime / 1000;
      this.createQuerySpan(
        operationName || 'unknown',
        operationType,
        startTimeSeconds,
        endTime,
        false,
        complexity,
        depth,
        errorMessage,
        undefined,
        getJaegerEngines
      );
      return {
        success: false,
        errors: [{ message: errorMessage }],
        latency,
        complexity,
        depth,
      };
    }
    
    // Создаем trace context для запроса (если есть Jaeger engines)
    let traceContext: TraceContext | undefined;
    if (getJaegerEngines) {
      const jaegerEngines = getJaegerEngines();
      if (jaegerEngines.size > 0) {
        const traceId = this.generateTraceId();
        const spanId = this.generateSpanId();
        traceContext = {
          traceId,
          spanId,
          sampled: true,
        };
        this.traceContexts.set(traceId, traceContext);
      }
    }
    
    // Выполняем запрос с использованием резолверов (если доступны nodes и connections)
    // Используем await, так как executeQuery теперь может быть асинхронным
    // Обертываем в таймаут (только для query и mutation, не для subscription)
    const timeoutMs = operationType === 'subscription' ? 0 : this.getTimeoutForOperation(operationType);
    let data;
    try {
      if (nodes && connections && this.config?.resolvers && this.config.resolvers.length > 0) {
        if (timeoutMs > 0) {
          data = await this.executeWithTimeout(
            () => this.executeQuery(
              parseResult.operation || '',
              request.variables,
              nodes,
              connections,
              traceContext,
              getJaegerEngines
            ),
            timeoutMs,
            operationType === 'subscription' ? 'query' : operationType,
            operationName
          );
        } else {
          data = await this.executeQuery(
            parseResult.operation || '',
            request.variables,
            nodes,
            connections,
            traceContext,
            getJaegerEngines
          );
        }
      } else {
        if (timeoutMs > 0) {
          data = await this.executeWithTimeout(
            () => Promise.resolve(this.executeQuery(
              parseResult.operation || '',
              request.variables,
              nodes,
              connections,
              traceContext,
              getJaegerEngines
            )),
            timeoutMs,
            operationType === 'subscription' ? 'query' : operationType,
            operationName
          );
        } else {
          data = await Promise.resolve(this.executeQuery(
            parseResult.operation || '',
            request.variables,
            nodes,
            connections,
            traceContext,
            getJaegerEngines
          ));
        }
      }
    } catch (error: any) {
      // Обработка таймаута или других ошибок
      const latency = Date.now() - startTime;
      const errorMessage = error.message || 'Query execution failed';
      this.recordQuery(false, latency, 0, 0, false, operationName, operationType, fields, errorMessage);
      const endTime = Date.now() / 1000;
      const startTimeSeconds = startTime / 1000;
      this.createQuerySpan(
        operationName || 'unknown',
        operationType,
        startTimeSeconds,
        endTime,
        false,
        undefined,
        undefined,
        errorMessage,
        undefined,
        getJaegerEngines
      );
      return {
        success: false,
        errors: [{ message: errorMessage }],
        latency,
      };
    }
    const latency = Date.now() - startTime;
    
    // Сохраняем в кэш
    if (this.config?.enableCaching && data) {
      const cacheKey = this.getCacheKey({ query, variables: request.variables });
      this.queryCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });
    }
    
    // Автоматически сохраняем как persisted query, если включено
    if (this.config?.enablePersistedQueries && query) {
      this.savePersistedQuery(query, request.operationName);
    }
    
    // Записываем метрики
    this.recordQuery(true, latency, complexity, depth, false, operationName, operationType, fields);
    
    // Создаем span для запроса
    const endTime = Date.now() / 1000; // convert to seconds
    const startTimeSeconds = startTime / 1000;
    this.createQuerySpan(
      operationName || 'unknown',
      operationType,
      startTimeSeconds,
      endTime,
      true,
      complexity,
      depth,
      undefined,
      traceContext,
      getJaegerEngines
    );
    
    return {
      success: true,
      data,
      latency,
      complexity,
      depth,
    };
  }

  /**
   * Обработать GraphQL мутацию
   */
  public processMutation(request: {
    query: string;
    variables?: Record<string, any>;
    operationName?: string;
  }): {
    success: boolean;
    data?: any;
    errors?: Array<{ message: string; path?: string[] }>;
    latency: number;
  } {
    const startTime = Date.now();
    
    // Парсим и валидируем мутацию
    const parseResult = this.parseQuery(request.query);
    const fields = parseResult.fields;
    const operationName = request.operationName || (fields && fields.length > 0 ? fields[0].name : undefined);
    
    if (!parseResult.success) {
      const latency = Date.now() - startTime;
      const errorMessage = parseResult.error || 'Invalid mutation';
      this.recordMutation(false, latency, operationName, fields, errorMessage);
      return {
        success: false,
        errors: [{ message: errorMessage }],
        latency,
      };
    }
    
    // Выполняем мутацию (симуляция)
    const data = this.executeMutation(parseResult.operation || '', request.variables);
    const latency = Date.now() - startTime;
    
    // Записываем метрики
    this.recordMutation(true, latency, operationName, fields);
    
    return {
      success: true,
      data,
      latency,
    };
  }

  /**
   * Создать подписку
   */
  public createSubscription(request: {
    query: string;
    variables?: Record<string, any>;
    clientId?: string;
    filter?: {
      field?: string;
      type?: string[];
      sourceComponentId?: string;
    };
  }): {
    success: boolean;
    subscriptionId?: string;
    error?: string;
  } {
    if (!this.config?.subscriptionsEnabled) {
      return {
        success: false,
        error: 'Subscriptions are disabled',
      };
    }
    
    // Проверяем лимит подписок
    if (this.activeSubscriptions.size >= this.MAX_SUBSCRIPTIONS) {
      return {
        success: false,
        error: `Maximum subscriptions limit reached (${this.MAX_SUBSCRIPTIONS})`,
      };
    }
    
    const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const subscription: GraphQLSubscription = {
      id: subscriptionId,
      query: request.query,
      variables: request.variables,
      timestamp: Date.now(),
      active: true,
      clientId: request.clientId,
      lastEventTime: Date.now(),
      eventCount: 0,
      filter: request.filter,
    };
    
    this.activeSubscriptions.set(subscriptionId, subscription);
    this.graphQLMetrics.subscriptionsActive = this.activeSubscriptions.size;
    
    return {
      success: true,
      subscriptionId,
    };
  }

  /**
   * Отменить подписку
   */
  public cancelSubscription(subscriptionId: string): boolean {
    if (this.activeSubscriptions.delete(subscriptionId)) {
      this.graphQLMetrics.subscriptionsActive = this.activeSubscriptions.size;
      return true;
    }
    return false;
  }
  
  /**
   * Генерировать событие для подписок
   */
  public generateSubscriptionEvent(
    type: 'create' | 'update' | 'delete' | 'custom',
    field: string,
    data: any,
    sourceComponentId?: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.config?.subscriptionsEnabled) {
      return;
    }
    
    const event: GraphQLSubscriptionEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      field,
      data,
      timestamp: Date.now(),
      sourceComponentId,
      metadata,
    };
    
    // Добавляем событие в очередь
    this.subscriptionEvents.push(event);
    if (this.subscriptionEvents.length > this.MAX_EVENTS_QUEUE) {
      this.subscriptionEvents.shift();
    }
    
    // Обновляем метрики
    this.recordSubscriptionEvent();
    
    // Обрабатываем событие для активных подписок
    this.processSubscriptionEvent(event);
  }
  
  /**
   * Обработать событие для подписок
   */
  private processSubscriptionEvent(event: GraphQLSubscriptionEvent): void {
    const startTime = Date.now();
    
    // Находим подписки, которые должны получить это событие
    const matchingSubscriptions: GraphQLSubscription[] = [];
    
    for (const subscription of this.activeSubscriptions.values()) {
      if (!subscription.active) continue;
      
      // Проверяем фильтры подписки
      if (subscription.filter) {
        const filter = subscription.filter;
        
        // Фильтр по полю
        if (filter.field && filter.field !== event.field) {
          continue;
        }
        
        // Фильтр по типу
        if (filter.type && filter.type.length > 0 && !filter.type.includes(event.type)) {
          continue;
        }
        
        // Фильтр по источнику
        if (filter.sourceComponentId && filter.sourceComponentId !== event.sourceComponentId) {
          continue;
        }
      }
      
      matchingSubscriptions.push(subscription);
    }
    
    // Отправляем событие подписчикам
    for (const subscription of matchingSubscriptions) {
      this.deliverEventToSubscription(subscription, event);
    }
    
    const deliveryLatency = Date.now() - startTime;
    this.recordDeliveryLatency(deliveryLatency);
  }
  
  /**
   * Доставить событие подписке
   */
  private deliverEventToSubscription(
    subscription: GraphQLSubscription,
    event: GraphQLSubscriptionEvent
  ): void {
    try {
      // Обновляем статистику подписки
      subscription.lastEventTime = Date.now();
      subscription.eventCount = (subscription.eventCount || 0) + 1;
      
      // В реальной системе здесь была бы отправка через WebSocket
      // В симуляции мы просто записываем метрики
      
      // Можно также отправить через DataFlowEngine, если есть clientId
      if (subscription.clientId) {
        // Симуляция отправки через DataFlowEngine
        // В реальной системе это было бы асинхронной отправкой
      }
    } catch (error) {
      this.subscriptionMetrics.totalDeliveryErrors++;
      this.updateDeliveryErrorRate();
    }
  }
  
  /**
   * Обработать подписки (вызывается периодически)
   */
  public processSubscriptions(
    nodes?: CanvasNode[],
    connections?: CanvasConnection[]
  ): void {
    if (!this.config?.subscriptionsEnabled) {
      return;
    }
    
    const now = Date.now();
    
    // Очищаем неактивные подписки
    this.cleanupInactiveSubscriptions(now);
    
    // Генерируем события на основе изменений в компонентах
    if (nodes && connections) {
      this.generateEventsFromComponents(nodes, connections);
    }
    
    // Обрабатываем события из очереди
    this.processEventQueue();
  }
  
  /**
   * Очистить неактивные подписки
   */
  private cleanupInactiveSubscriptions(currentTime: number): void {
    const toRemove: string[] = [];
    
    for (const [id, subscription] of this.activeSubscriptions.entries()) {
      // Проверяем таймаут неактивности
      const lastEventTime = subscription.lastEventTime || subscription.timestamp;
      const inactiveTime = currentTime - lastEventTime;
      
      if (inactiveTime > this.SUBSCRIPTION_TIMEOUT) {
        toRemove.push(id);
      }
    }
    
    for (const id of toRemove) {
      this.activeSubscriptions.delete(id);
    }
    
    if (toRemove.length > 0) {
      this.graphQLMetrics.subscriptionsActive = this.activeSubscriptions.size;
    }
  }
  
  /**
   * Генерировать события на основе изменений в компонентах
   */
  private generateEventsFromComponents(
    nodes: CanvasNode[],
    connections: CanvasConnection[]
  ): void {
    // Находим компоненты, связанные с GraphQL через резолверы
    if (!this.config?.resolvers) return;
    
    for (const resolver of this.config.resolvers) {
      if (!resolver.enabled || !resolver.targetService) continue;
      
      // Находим целевой компонент
      const targetNode = nodes.find(n => n.id === resolver.targetService);
      if (!targetNode) continue;
      
      // Проверяем наличие соединения
      const connection = connections.find(
        c => c.source === this.componentId && c.target === resolver.targetService
      );
      if (!connection) continue;
      
      // Симулируем события на основе типа компонента
      this.simulateComponentEvents(targetNode, resolver);
    }
  }
  
  /**
   * Симулировать события компонента
   */
  private simulateComponentEvents(
    node: CanvasNode,
    resolver: GraphQLResolver
  ): void {
    // Генерируем события в зависимости от типа компонента
    // Частота событий зависит от активности компонента
    
    const now = Date.now();
    const lastEventKey = `lastEvent_${node.id}_${resolver.id}`;
    const lastEventTime = (this as any)[lastEventKey] || 0;
    const timeSinceLastEvent = now - lastEventTime;
    
    // Генерируем события с вероятностью (упрощенно)
    const eventProbability = 0.01; // 1% вероятность события за цикл
    const shouldGenerateEvent = Math.random() < eventProbability && timeSinceLastEvent > 1000; // Минимум 1 секунда между событиями
    
    if (shouldGenerateEvent) {
      // Определяем тип события на основе типа компонента
      let eventType: 'create' | 'update' | 'delete' | 'custom' = 'update';
      
      if (node.type === 'postgres' || node.type === 'mongodb' || node.type === 'redis') {
        // Для БД - случайный тип события
        const types: ('create' | 'update' | 'delete')[] = ['create', 'update', 'delete'];
        eventType = types[Math.floor(Math.random() * types.length)];
      }
      
      // Генерируем событие
      this.generateSubscriptionEvent(
        eventType,
        resolver.field,
        this.getFallbackDataForField(resolver.field, {}),
        node.id,
        {
          componentType: node.type,
          resolverId: resolver.id,
        }
      );
      
      (this as any)[lastEventKey] = now;
    }
  }
  
  /**
   * Обработать очередь событий
   */
  private processEventQueue(): void {
    // Обрабатываем события из очереди (если есть необработанные)
    // В реальной системе это было бы асинхронно
    const eventsToProcess = this.subscriptionEvents.filter(
      e => !(e as any).processed
    );
    
    for (const event of eventsToProcess) {
      this.processSubscriptionEvent(event);
      (event as any).processed = true;
    }
    
    // Очищаем старые обработанные события
    this.subscriptionEvents = this.subscriptionEvents.filter(
      e => !(e as any).processed || (Date.now() - e.timestamp) < 60000 // Храним 1 минуту
    );
  }
  
  /**
   * Записать метрики события подписки
   */
  private recordSubscriptionEvent(): void {
    const now = Date.now();
    
    // Обновляем счетчики за секунду
    if (now - this.lastEventSecondStart >= 1000) {
      this.subscriptionMetrics.eventsPerSecond = this.eventsThisSecond;
      this.eventsThisSecond = 0;
      this.lastEventSecondStart = now;
    }
    this.eventsThisSecond++;
    
    this.subscriptionMetrics.totalEvents++;
    this.subscriptionMetrics.lastEventTime = now;
  }
  
  /**
   * Записать latency доставки
   */
  private recordDeliveryLatency(latency: number): void {
    this.deliveryLatencyHistory.push(latency);
    if (this.deliveryLatencyHistory.length > this.MAX_DELIVERY_LATENCY_HISTORY) {
      this.deliveryLatencyHistory.shift();
    }
    
    const sum = this.deliveryLatencyHistory.reduce((a, b) => a + b, 0);
    this.subscriptionMetrics.averageDeliveryLatency = sum / this.deliveryLatencyHistory.length;
  }
  
  /**
   * Обновить error rate доставки
   */
  private updateDeliveryErrorRate(): void {
    if (this.subscriptionMetrics.totalEvents > 0) {
      this.subscriptionMetrics.deliveryErrorRate =
        this.subscriptionMetrics.totalDeliveryErrors / this.subscriptionMetrics.totalEvents;
    }
  }
  
  /**
   * Получить метрики подписок
   */
  public getSubscriptionMetrics(): typeof this.subscriptionMetrics {
    return { ...this.subscriptionMetrics };
  }

  /**
   * Парсинг GraphQL запроса (упрощенный)
   */
  private parseQuery(query: string): {
    success: boolean;
    operation?: string;
    error?: string;
    operationType?: 'query' | 'mutation' | 'subscription';
    fields?: Array<{ name: string; args?: Record<string, any>; nestedFields?: string[] }>;
  } {
    if (!query || !query.trim()) {
      return { success: false, error: 'Empty query' };
    }
    
    const trimmed = query.trim();
    
    // Определяем тип операции
    let operationType: 'query' | 'mutation' | 'subscription' | undefined;
    if (trimmed.startsWith('query')) {
      operationType = 'query';
    } else if (trimmed.startsWith('mutation')) {
      operationType = 'mutation';
    } else if (trimmed.startsWith('subscription')) {
      operationType = 'subscription';
    } else if (trimmed.startsWith('{')) {
      // Сокращенная форма query
      operationType = 'query';
    } else {
      return { success: false, error: 'Invalid query format' };
    }
    
    // Извлекаем поля из запроса
    const fields: Array<{ name: string; args?: Record<string, any>; nestedFields?: string[] }> = [];
    const fieldMatches = trimmed.match(/(\w+)\s*(\([^)]*\))?\s*\{/g);
    
    if (fieldMatches) {
      for (const match of fieldMatches) {
        const fieldNameMatch = match.match(/(\w+)/);
        if (fieldNameMatch) {
          const fieldName = fieldNameMatch[1];
          if (!['query', 'mutation', 'subscription'].includes(fieldName.toLowerCase())) {
            // Извлекаем аргументы
            const argsMatch = match.match(/\(([^)]*)\)/);
            const args: Record<string, any> = {};
            if (argsMatch && argsMatch[1]) {
              const argPairs = argsMatch[1].split(',').map(s => s.trim());
              for (const pair of argPairs) {
                const [key, value] = pair.split(':').map(s => s.trim());
                if (key && value) {
                  args[key] = value.replace(/^["']|["']$/g, '');
                }
              }
            }
            
            // Извлекаем вложенные поля (упрощенно)
            const nestedFields: string[] = [];
            const nestedMatch = trimmed.match(new RegExp(`${fieldName}\\s*[^{]*\\{([^}]+)\\}`, 's'));
            if (nestedMatch && nestedMatch[1]) {
              const nestedFieldMatches = nestedMatch[1].match(/(\w+)/g);
              if (nestedFieldMatches) {
                nestedFields.push(...nestedFieldMatches);
              }
            }
            
            fields.push({ name: fieldName, args: Object.keys(args).length > 0 ? args : undefined, nestedFields: nestedFields.length > 0 ? nestedFields : undefined });
          }
        }
      }
    }
    
    return {
      success: true,
      operation: trimmed,
      operationType,
      fields,
    };
  }
  
  /**
   * Валидация запроса против схемы
   */
  private validateQueryAgainstSchema(
    operation: string,
    operationType: 'query' | 'mutation' | 'subscription',
    fields: Array<{ name: string; args?: Record<string, any>; nestedFields?: string[] }>,
    variables?: Record<string, any>
  ): SchemaValidationResult {
    const errors: SchemaValidationError[] = [];
    
    if (!this.config?.schema) {
      return { valid: true, errors: [] }; // Если схемы нет, пропускаем валидацию
    }
    
    const schema = this.config.schema;
    
    // Определяем корневой тип операции
    let rootType: GraphQLType | undefined;
    if (operationType === 'query' && schema.queries) {
      rootType = schema.queries.find(t => t.name === 'Query');
    } else if (operationType === 'mutation' && schema.mutations) {
      rootType = schema.mutations.find(t => t.name === 'Mutation');
    } else if (operationType === 'subscription' && schema.subscriptions) {
      rootType = schema.subscriptions.find(t => t.name === 'Subscription');
    }
    
    if (!rootType) {
      errors.push({
        message: `Root type for ${operationType} not found in schema`,
        type: operationType,
      });
      return { valid: false, errors };
    }
    
    // Валидируем каждое поле
    for (const field of fields) {
      const schemaField = rootType.fields?.find(f => f.name === field.name);
      
      if (!schemaField) {
        errors.push({
          message: `Field "${field.name}" does not exist on type "${rootType.name}"`,
          field: field.name,
          type: rootType.name,
        });
        continue;
      }
      
      // Валидируем аргументы
      if (field.args && schemaField.args) {
        for (const [argName, argValue] of Object.entries(field.args)) {
          const schemaArg = schemaField.args.find(a => a.name === argName);
          if (!schemaArg) {
            errors.push({
              message: `Argument "${argName}" does not exist on field "${field.name}"`,
              field: field.name,
              path: [field.name, argName],
            });
          }
        }
        
        // Проверяем обязательные аргументы
        for (const schemaArg of schemaField.args) {
          const isRequired = schemaArg.type.endsWith('!');
          if (isRequired && !field.args[schemaArg.name] && schemaArg.defaultValue === undefined) {
            // Проверяем переменные
            const varName = field.args[`$${schemaArg.name}`] || variables?.[schemaArg.name];
            if (!varName) {
              errors.push({
                message: `Required argument "${schemaArg.name}" is missing on field "${field.name}"`,
                field: field.name,
                path: [field.name, schemaArg.name],
              });
            }
          }
        }
      } else if (schemaField.args && schemaField.args.length > 0) {
        // Проверяем обязательные аргументы, если они есть в схеме
        for (const schemaArg of schemaField.args) {
          const isRequired = schemaArg.type.endsWith('!');
          if (isRequired && schemaArg.defaultValue === undefined) {
            const varValue = variables?.[schemaArg.name];
            if (!varValue) {
              errors.push({
                message: `Required argument "${schemaArg.name}" is missing on field "${field.name}"`,
                field: field.name,
                path: [field.name, schemaArg.name],
              });
            }
          }
        }
      }
      
      // Валидируем вложенные поля (рекурсивно)
      if (field.nestedFields && schemaField.type) {
        const returnType = this.extractTypeName(schemaField.type);
        const returnTypeDef = this.findTypeInSchema(returnType, schema);
        
        if (returnTypeDef && returnTypeDef.kind === 'OBJECT') {
          for (const nestedField of field.nestedFields) {
            const nestedSchemaField = returnTypeDef.fields?.find(f => f.name === nestedField);
            if (!nestedSchemaField) {
              errors.push({
                message: `Field "${nestedField}" does not exist on type "${returnType}"`,
                field: nestedField,
                type: returnType,
                path: [field.name, nestedField],
              });
            }
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Извлечь имя типа из строки типа (например, "[User!]!" -> "User")
   */
  private extractTypeName(typeString: string): string {
    // Убираем списки и обязательные модификаторы
    let typeName = typeString.replace(/^\[|\]$/g, '').replace(/!$/, '');
    typeName = typeName.replace(/^\[|\]$/g, '').replace(/!$/, '');
    return typeName;
  }
  
  /**
   * Найти тип в схеме
   */
  private findTypeInSchema(typeName: string, schema: GraphQLSchema): GraphQLType | undefined {
    return schema.types?.find(t => t.name === typeName);
  }
  
  /**
   * Обработать introspection запрос
   */
  private handleIntrospectionQuery(query: string): { success: boolean; data?: any; error?: string } {
    if (!this.config?.introspectionEnabled) {
      return {
        success: false,
        error: 'Introspection is disabled',
      };
    }
    
    // Обновляем метрики
    const now = Date.now();
    if (now - this.lastIntrospectionSecondStart >= 1000) {
      this.introspectionMetrics.introspectionQueriesPerSecond = this.introspectionQueriesThisSecond;
      this.introspectionQueriesThisSecond = 0;
      this.lastIntrospectionSecondStart = now;
    }
    this.introspectionQueriesThisSecond++;
    this.introspectionMetrics.totalIntrospectionQueries++;
    this.introspectionMetrics.lastIntrospectionTime = now;
    
    // Проверяем тип introspection запроса
    if (query.includes('__schema') || query.includes('__type')) {
      // Возвращаем полную схему в формате GraphQL Introspection
      return {
        success: true,
        data: this.buildIntrospectionResponse(),
      };
    }
    
    // Если это обычный запрос, но с __typename или другими системными полями
    if (query.includes('__typename')) {
      // Это не introspection, но системное поле
      return { success: true, data: { __typename: 'Query' } };
    }
    
    return {
      success: false,
      error: 'Invalid introspection query',
    };
  }
  
  /**
   * Построить ответ introspection в формате GraphQL
   */
  private buildIntrospectionResponse(): any {
    if (!this.config?.schema) {
      return { __schema: null };
    }
    
    const schema = this.config.schema;
    
    // Строим полную схему для introspection
    const types = (schema.types || []).map(type => ({
      name: type.name,
      kind: type.kind,
      description: type.description,
      fields: type.fields?.map(field => ({
        name: field.name,
        description: field.description,
        type: {
          name: this.extractTypeName(field.type),
          kind: this.getTypeKind(field.type),
        },
        args: field.args?.map(arg => ({
          name: arg.name,
          type: {
            name: this.extractTypeName(arg.type),
            kind: this.getTypeKind(arg.type),
          },
          defaultValue: arg.defaultValue,
        })) || [],
      })) || [],
    }));
    
    // Добавляем корневые типы
    const queryType = schema.queries?.find(t => t.name === 'Query');
    const mutationType = schema.mutations?.find(t => t.name === 'Mutation');
    const subscriptionType = schema.subscriptions?.find(t => t.name === 'Subscription');
    
    return {
      __schema: {
        queryType: queryType ? {
          name: queryType.name,
          kind: queryType.kind,
          fields: queryType.fields?.map(f => ({
            name: f.name,
            type: { name: this.extractTypeName(f.type) },
          })),
        } : null,
        mutationType: mutationType ? {
          name: mutationType.name,
          kind: mutationType.kind,
        } : null,
        subscriptionType: subscriptionType ? {
          name: subscriptionType.name,
          kind: subscriptionType.kind,
        } : null,
        types,
      },
    };
  }
  
  /**
   * Определить kind типа по строке типа
   */
  private getTypeKind(typeString: string): string {
    const typeName = this.extractTypeName(typeString);
    const type = this.findTypeInSchema(typeName, this.config?.schema || {});
    return type?.kind || 'SCALAR';
  }
  
  /**
   * Обнаружить изменения в схеме
   */
  private detectSchemaChanges(newSchema: GraphQLSchema): SchemaChange[] {
    const changes: SchemaChange[] = [];
    
    if (!this.previousSchema) {
      // Первая инициализация - сохраняем схему
      this.previousSchema = JSON.parse(JSON.stringify(newSchema));
      return changes;
    }
    
    const oldSchema = this.previousSchema;
    
    // Сравниваем типы
    const oldTypes = new Map((oldSchema.types || []).map(t => [t.name, t]));
    const newTypes = new Map((newSchema.types || []).map(t => [t.name, t]));
    
    // Новые типы
    for (const [typeName, newType] of newTypes.entries()) {
      if (!oldTypes.has(typeName)) {
        changes.push({
          id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          changeType: 'type_added',
          typeName: typeName,
          breaking: false,
          timestamp: Date.now(),
        });
      } else {
        // Изменения в типах
        const oldType = oldTypes.get(typeName)!;
        const fieldChanges = this.detectFieldChanges(oldType, newType, typeName);
        changes.push(...fieldChanges);
      }
    }
    
    // Удаленные типы
    for (const [typeName] of oldTypes.entries()) {
      if (!newTypes.has(typeName)) {
        changes.push({
          id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          changeType: 'type_removed',
          typeName: typeName,
          breaking: true,
          timestamp: Date.now(),
        });
      }
    }
    
    // Сравниваем корневые типы (Query, Mutation, Subscription)
    this.detectRootTypeChanges(oldSchema.queries || [], newSchema.queries || [], 'Query', changes);
    this.detectRootTypeChanges(oldSchema.mutations || [], newSchema.mutations || [], 'Mutation', changes);
    this.detectRootTypeChanges(oldSchema.subscriptions || [], newSchema.subscriptions || [], 'Subscription', changes);
    
    // Сохраняем новую схему
    this.previousSchema = JSON.parse(JSON.stringify(newSchema));
    
    // Сохраняем изменения
    this.schemaChanges.push(...changes);
    if (this.schemaChanges.length > this.MAX_SCHEMA_CHANGES_HISTORY) {
      this.schemaChanges.shift();
    }
    
    // Создаем версию схемы, если есть breaking changes
    const hasBreakingChanges = changes.some(c => c.breaking);
    if (hasBreakingChanges || changes.length > 0) {
      this.createSchemaVersion(newSchema, changes);
    }
    
    return changes;
  }
  
  /**
   * Обнаружить изменения в полях типа
   */
  private detectFieldChanges(
    oldType: GraphQLType,
    newType: GraphQLType,
    typeName: string
  ): SchemaChange[] {
    const changes: SchemaChange[] = [];
    
    const oldFields = new Map((oldType.fields || []).map(f => [f.name, f]));
    const newFields = new Map((newType.fields || []).map(f => [f.name, f]));
    
    // Новые поля
    for (const [fieldName, newField] of newFields.entries()) {
      if (!oldFields.has(fieldName)) {
        changes.push({
          id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          changeType: 'field_added',
          field: fieldName,
          typeName: typeName,
          newValue: newField,
          breaking: false,
          timestamp: Date.now(),
        });
      } else {
        // Изменения в полях
        const oldField = oldFields.get(fieldName)!;
        
        // Изменение типа поля
        if (oldField.type !== newField.type) {
          changes.push({
            id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            changeType: 'field_type_changed',
            field: fieldName,
            typeName: typeName,
            oldValue: oldField.type,
            newValue: newField.type,
            breaking: true, // Изменение типа - breaking change
            timestamp: Date.now(),
          });
        }
        
        // Изменения в аргументах
        const argChanges = this.detectArgumentChanges(oldField, newField, typeName, fieldName);
        changes.push(...argChanges);
      }
    }
    
    // Удаленные поля
    for (const [fieldName, oldField] of oldFields.entries()) {
      if (!newFields.has(fieldName)) {
        changes.push({
          id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          changeType: 'field_removed',
          field: fieldName,
          typeName: typeName,
          oldValue: oldField,
          breaking: true,
          timestamp: Date.now(),
        });
      }
    }
    
    return changes;
  }
  
  /**
   * Обнаружить изменения в аргументах поля
   */
  private detectArgumentChanges(
    oldField: GraphQLField,
    newField: GraphQLField,
    typeName: string,
    fieldName: string
  ): SchemaChange[] {
    const changes: SchemaChange[] = [];
    
    const oldArgs = new Map((oldField.args || []).map(a => [a.name, a]));
    const newArgs = new Map((newField.args || []).map(a => [a.name, a]));
    
    // Новые аргументы
    for (const [argName, newArg] of newArgs.entries()) {
      if (!oldArgs.has(argName)) {
        changes.push({
          id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          changeType: 'argument_added',
          field: fieldName,
          typeName: typeName,
          newValue: newArg,
          breaking: newArg.type.endsWith('!') && newArg.defaultValue === undefined, // Обязательный аргумент - breaking
          timestamp: Date.now(),
        });
      } else {
        // Изменения в аргументах
        const oldArg = oldArgs.get(argName)!;
        if (oldArg.type !== newArg.type) {
          changes.push({
            id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            changeType: 'argument_type_changed',
            field: fieldName,
            typeName: typeName,
            oldValue: oldArg.type,
            newValue: newArg.type,
            breaking: true,
            timestamp: Date.now(),
          });
        }
      }
    }
    
    // Удаленные аргументы
    for (const [argName, oldArg] of oldArgs.entries()) {
      if (!newArgs.has(argName)) {
        changes.push({
          id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          changeType: 'argument_removed',
          field: fieldName,
          typeName: typeName,
          oldValue: oldArg,
          breaking: true,
          timestamp: Date.now(),
        });
      }
    }
    
    return changes;
  }
  
  /**
   * Обнаружить изменения в корневых типах
   */
  private detectRootTypeChanges(
    oldTypes: GraphQLType[],
    newTypes: GraphQLType[],
    rootTypeName: string,
    changes: SchemaChange[]
  ): void {
    const oldType = oldTypes.find(t => t.name === rootTypeName);
    const newType = newTypes.find(t => t.name === rootTypeName);
    
    if (!oldType && newType) {
      // Новый корневой тип
      changes.push({
        id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        changeType: 'type_added',
        typeName: rootTypeName,
        breaking: false,
        timestamp: Date.now(),
      });
    } else if (oldType && newType) {
      // Изменения в корневом типе
      const fieldChanges = this.detectFieldChanges(oldType, newType, rootTypeName);
      changes.push(...fieldChanges);
    } else if (oldType && !newType) {
      // Удален корневой тип
      changes.push({
        id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        changeType: 'type_removed',
        typeName: rootTypeName,
        breaking: true,
        timestamp: Date.now(),
      });
    }
  }
  
  /**
   * Создать версию схемы
   */
  private createSchemaVersion(schema: GraphQLSchema, changes: SchemaChange[]): void {
    const version: SchemaVersion = {
      version: `v${this.schemaVersions.length + 1}.0.0`,
      schema: JSON.parse(JSON.stringify(schema)),
      timestamp: Date.now(),
      changes: [...changes],
    };
    
    this.schemaVersions.push(version);
    if (this.schemaVersions.length > this.MAX_SCHEMA_VERSIONS) {
      this.schemaVersions.shift();
    }
  }

  /**
   * Вычисление сложности запроса (улучшенный алгоритм с учетом весов полей, вложенности и списков)
   */
  private calculateComplexity(query: string): number {
    // Базовая сложность
    let complexity = 1;
    
    // Извлекаем все поля из запроса
    const fieldMatches = query.match(/(\w+)\s*(\([^)]*\))?\s*\{/g);
    if (fieldMatches) {
      for (const match of fieldMatches) {
        // Извлекаем имя поля
        const fieldNameMatch = match.match(/(\w+)/);
        if (fieldNameMatch) {
          const fieldName = fieldNameMatch[1];
          
          // Пропускаем ключевые слова
          if (['query', 'mutation', 'subscription'].includes(fieldName.toLowerCase())) {
            continue;
          }
          
          // Используем кастомный вес поля, если задан
          const fieldWeight = this.config?.fieldComplexityWeights?.[fieldName] || 1;
          complexity += fieldWeight;
          
          // Проверяем, является ли поле списком (по типу в схеме или по паттерну)
          const isListField = this.isListField(fieldName);
          if (isListField) {
            // Списки увеличивают сложность больше
            complexity += fieldWeight * 2;
          }
        }
      }
    }
    
    // Подсчитываем вложенность (глубина влияет на сложность)
    const depth = this.calculateDepth(query);
    complexity += depth * 3;
    
    // Подсчитываем аргументы (аргументы увеличивают сложность)
    const argMatches = query.match(/\([^)]+\)/g);
    if (argMatches) {
      complexity += argMatches.length * 1.5;
    }
    
    // Проверяем наличие фрагментов (fragments увеличивают сложность)
    const fragmentMatches = query.match(/fragment\s+\w+/gi);
    if (fragmentMatches) {
      complexity += fragmentMatches.length * 2;
    }
    
    // Проверяем наличие inline fragments
    const inlineFragmentMatches = query.match(/\.\.\.\s*on\s+\w+/gi);
    if (inlineFragmentMatches) {
      complexity += inlineFragmentMatches.length * 1.5;
    }
    
    return Math.round(complexity);
  }

  /**
   * Проверить, является ли поле списком (по схеме или по паттерну)
   */
  private isListField(fieldName: string): boolean {
    if (!this.config?.schema) return false;
    
    // Ищем поле в схеме
    const queryType = this.config.schema.queries?.find(t => t.name === 'Query');
    if (queryType?.fields) {
      const field = queryType.fields.find(f => f.name === fieldName);
      if (field) {
        // Проверяем тип - если начинается с [ или содержит List, это список
        return field.type.startsWith('[') || field.type.includes('List');
      }
    }
    
    // Fallback: проверяем по паттерну в запросе (если поле используется в контексте списка)
    return false;
  }

  /**
   * Вычисление глубины запроса
   */
  private calculateDepth(query: string): number {
    let maxDepth = 0;
    let currentDepth = 0;
    
    for (const char of query) {
      if (char === '{') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === '}') {
        currentDepth--;
      }
    }
    
    return maxDepth;
  }

  /**
   * Получить идентификатор клиента для rate limiting
   */
  private getClientIdentifier(
    headers?: Record<string, string>,
    variables?: Record<string, any>
  ): string {
    if (!this.config?.rateLimit) {
      return 'default';
    }

    const identifyBy = this.config.rateLimit.identifyBy || 'ip';
    const identifiers: string[] = [];

    if (identifyBy === 'ip' || identifyBy === 'all') {
      const ip = headers?.['x-forwarded-for'] || 
                headers?.['x-real-ip'] || 
                headers?.['client-ip'] ||
                '0.0.0.0';
      identifiers.push(`ip:${ip.split(',')[0].trim()}`);
    }

    if (identifyBy === 'apiKey' || identifyBy === 'all') {
      const apiKey = headers?.['x-api-key'] || 
                    headers?.['authorization']?.replace(/^Bearer\s+/i, '') ||
                    variables?.['apiKey'];
      if (apiKey) {
        identifiers.push(`key:${apiKey.substring(0, 20)}`); // Первые 20 символов для безопасности
      }
    }

    if (identifyBy === 'user' || identifyBy === 'all') {
      const userId = headers?.['x-user-id'] || 
                    variables?.['userId'] ||
                    variables?.['user_id'];
      if (userId) {
        identifiers.push(`user:${userId}`);
      }
    }

    return identifiers.length > 0 ? identifiers.join('|') : 'default';
  }

  /**
   * Проверить rate limit для операции
   */
  private checkRateLimit(
    operationType: 'query' | 'mutation' | 'subscription',
    clientIdentifier: string
  ): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    limit: number;
  } {
    if (!this.config?.rateLimit?.enabled) {
      return {
        allowed: true,
        remaining: Infinity,
        resetAt: Date.now() + 1000,
        limit: Infinity,
      };
    }

    const rateLimitConfig = this.config.rateLimit;
    const windowMs = rateLimitConfig.windowMs || 1000;
    const now = Date.now();

    // Определяем лимит для типа операции
    let limit: number;
    if (operationType === 'query') {
      limit = rateLimitConfig.queriesPerSecond || 100;
    } else if (operationType === 'mutation') {
      limit = rateLimitConfig.mutationsPerSecond || 50;
    } else {
      limit = rateLimitConfig.subscriptionsPerSecond || 10;
    }

    // Проверяем глобальный лимит
    const globalLimit = rateLimitConfig.globalPerSecond;
    if (globalLimit) {
      const globalKey = `global:${clientIdentifier}`;
      const globalCounter = this.rateLimitCounters.get(globalKey);
      
      if (globalCounter) {
        if (now >= globalCounter.resetAt) {
          // Окно истекло, сбрасываем
          this.rateLimitCounters.set(globalKey, {
            count: 1,
            resetAt: now + windowMs,
            windowStart: now,
          });
        } else if (globalCounter.count >= globalLimit) {
          // Глобальный лимит превышен
          this.rateLimitMetrics.totalRateLimitHits++;
          this.rateLimitHitsThisSecond++;
          this.rateLimitMetrics.totalBlockedRequests++;
          this.blockedRequestsThisSecond++;
          this.rateLimitMetrics.blockedByType![operationType + 's' as 'queries' | 'mutations' | 'subscriptions']++;
          this.rateLimitMetrics.lastBlockedTime = now;
          
          return {
            allowed: false,
            remaining: 0,
            resetAt: globalCounter.resetAt,
            limit: globalLimit,
          };
        } else {
          globalCounter.count++;
        }
      } else {
        this.rateLimitCounters.set(globalKey, {
          count: 1,
          resetAt: now + windowMs,
          windowStart: now,
        });
      }
    }

    // Проверяем лимит для типа операции
    const key = `${clientIdentifier}:${operationType}`;
    const counter = this.rateLimitCounters.get(key);

    if (!counter || now >= counter.resetAt) {
      // Окно истекло или не существует, создаем новое
      this.rateLimitCounters.set(key, {
        count: 1,
        resetAt: now + windowMs,
        windowStart: now,
      });
      return {
        allowed: true,
        remaining: limit - 1,
        resetAt: now + windowMs,
        limit,
      };
    }

    if (counter.count >= limit) {
      // Лимит превышен
      this.rateLimitMetrics.totalRateLimitHits++;
      this.rateLimitHitsThisSecond++;
      this.rateLimitMetrics.totalBlockedRequests++;
      this.blockedRequestsThisSecond++;
      this.rateLimitMetrics.blockedByType![operationType + 's' as 'queries' | 'mutations' | 'subscriptions']++;
      this.rateLimitMetrics.lastBlockedTime = now;
      
      return {
        allowed: false,
        remaining: 0,
        resetAt: counter.resetAt,
        limit,
      };
    }

    // Увеличиваем счетчик
    counter.count++;
    return {
      allowed: true,
      remaining: limit - counter.count,
      resetAt: counter.resetAt,
      limit,
    };
  }

  /**
   * Выполнить операцию с таймаутом
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    operationType: 'query' | 'mutation' | 'resolver',
    operationName?: string
  ): Promise<T> {
    if (!this.config?.timeout?.enabled || timeoutMs <= 0) {
      return await operation();
    }

    const startTime = Date.now();
    
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          const duration = Date.now() - startTime;
          this.recordTimeout(operationType, duration, operationName);
          reject(new Error(`${operationType} timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  }

  /**
   * Записать таймаут в метрики
   */
  private recordTimeout(
    operationType: 'query' | 'mutation' | 'resolver',
    duration: number,
    operationName?: string
  ): void {
    this.timeoutMetrics.totalTimeouts++;
    this.timeoutsThisSecond++;
    
    if (operationType === 'query') {
      this.timeoutMetrics.queryTimeouts++;
    } else if (operationType === 'mutation') {
      this.timeoutMetrics.mutationTimeouts++;
    } else {
      this.timeoutMetrics.resolverTimeouts++;
    }
    
    this.timeoutMetrics.lastTimeoutTime = Date.now();
    
    // Сохраняем длительность
    this.timeoutDurations.push(duration);
    if (this.timeoutDurations.length > this.MAX_TIMEOUT_HISTORY) {
      this.timeoutDurations.shift();
    }
    
    // Обновляем среднюю длительность
    if (this.timeoutDurations.length > 0) {
      const sum = this.timeoutDurations.reduce((a, b) => a + b, 0);
      this.timeoutMetrics.averageTimeoutDuration = sum / this.timeoutDurations.length;
    }
    
    // Записываем ошибку
    this.recordError('timeout', `Timeout after ${duration}ms`, operationName, operationType === 'resolver' ? undefined : operationType);
  }

  /**
   * Получить таймаут для операции
   */
  private getTimeoutForOperation(operationType: 'query' | 'mutation' | 'subscription'): number {
    if (!this.config?.timeout?.enabled) {
      return 0; // Таймаут отключен
    }

    const timeoutConfig = this.config.timeout;
    
    if (operationType === 'query') {
      return timeoutConfig.queryTimeout || timeoutConfig.defaultTimeout || 30000;
    } else if (operationType === 'mutation') {
      return timeoutConfig.mutationTimeout || timeoutConfig.defaultTimeout || 60000;
    } else {
      return timeoutConfig.defaultTimeout || 30000;
    }
  }

  /**
   * Выполнение запроса с использованием резолверов
   */
  private async executeQuery(
    operation: string, 
    variables?: Record<string, any>,
    nodes?: CanvasNode[],
    connections?: CanvasConnection[],
    traceContext?: TraceContext,
    getJaegerEngines?: () => Map<string, any>
  ): Promise<any> {
    // Парсим запрос для определения нужных полей
    const requestedFields = this.extractRequestedFields(operation);
    
    // Если есть резолверы и доступ к nodes/connections, используем их
    if (this.config?.resolvers && this.config.resolvers.length > 0 && nodes && connections) {
      return await this.executeQueryWithResolvers(
        operation,
        variables,
        requestedFields,
        nodes,
        connections,
        traceContext,
        getJaegerEngines
      );
    }
    
    // Fallback к простой симуляции
    return this.executeQuerySimple(operation, variables);
  }

  /**
   * Выполнение запроса с использованием резолверов и DataLoader
   */
  private async executeQueryWithResolvers(
    operation: string,
    variables: Record<string, any> | undefined,
    requestedFields: string[],
    nodes: CanvasNode[],
    connections: CanvasConnection[],
    traceContext?: TraceContext,
    getJaegerEngines?: () => Map<string, any>
  ): Promise<any> {
    const result: any = {};
    
    // Очищаем request-scoped cache для нового запроса
    this.requestCache.clear();
    
    // Определяем тип операции (query, mutation)
    const isQuery = operation.trim().toLowerCase().startsWith('query');
    
    // Анализируем запрос на N+1 проблемы
    this.detectNPlusOneProblems(operation, requestedFields, isQuery ? 'Query' : 'Mutation');
    
    // Группируем поля по резолверам для батчинга
    const resolverGroups = new Map<string, { resolver: GraphQLResolver; fields: string[] }>();
    
    for (const field of requestedFields) {
      const resolver = this.findResolverForField(field, isQuery ? 'Query' : 'Mutation');
      
      if (resolver && resolver.enabled !== false && resolver.targetService) {
        const groupKey = resolver.id;
        if (!resolverGroups.has(groupKey)) {
          resolverGroups.set(groupKey, { resolver, fields: [] });
        }
        resolverGroups.get(groupKey)!.fields.push(field);
      }
    }
    
    // Выполняем резолверы с использованием DataLoader
    const resolverPromises: Promise<{ field: string; data: any }>[] = [];
    
    for (const [resolverId, group] of resolverGroups.entries()) {
      const { resolver, fields } = group;
      
      // Получаем или создаем DataLoader для этого резолвера
      let dataLoader = this.dataLoaders.get(resolverId);
      if (!dataLoader) {
        // Создаем обертку для executeResolverBatch с traceContext и getJaegerEngines
        const batchExecutor = async (
          resolverId: string,
          variablesList: Record<string, any>[],
          nodes: CanvasNode[],
          connections: CanvasConnection[]
        ) => {
          return this.executeResolverBatch(
            resolverId,
            variablesList,
            nodes,
            connections,
            traceContext,
            getJaegerEngines
          );
        };
        
        dataLoader = new GraphQLDataLoader(
          resolverId,
          batchExecutor,
          nodes,
          connections
        );
        this.dataLoaders.set(resolverId, dataLoader);
      }
      
      // Обновляем nodes и connections в DataLoader (на случай изменений)
      (dataLoader as any).nodes = nodes;
      (dataLoader as any).connections = connections;
      // Обновляем traceContext и getJaegerEngines для текущего запроса
      (dataLoader as any).traceContext = traceContext;
      (dataLoader as any).getJaegerEngines = getJaegerEngines;
      
      // Загружаем данные через DataLoader для каждого поля
      for (const field of fields) {
        const fieldVariables = this.extractFieldVariables(operation, field, variables);
        
        resolverPromises.push(
          dataLoader.load(fieldVariables, true).then(data => ({
            field,
            data,
          })).catch(error => {
            // В случае ошибки используем fallback
            return {
              field,
              data: this.getFallbackDataForField(field, variables),
            };
          })
        );
      }
    }
    
    // Обрабатываем поля без резолверов
    for (const field of requestedFields) {
      if (!resolverGroups.has(this.findResolverForField(field, isQuery ? 'Query' : 'Mutation')?.id || '')) {
        result[field] = this.getFallbackDataForField(field, variables);
      }
    }
    
    // Ждем выполнения всех резолверов
    const resolverResults = await Promise.all(resolverPromises);
    
    // Объединяем результаты
    for (const { field, data } of resolverResults) {
      result[field] = data;
    }
    
    // Завершаем все DataLoader батчи для этого запроса
    for (const dataLoader of this.dataLoaders.values()) {
      dataLoader.clearQueue();
    }
    
    return result;
  }
  
  /**
   * Извлечь переменные для конкретного поля из запроса
   */
  private extractFieldVariables(
    operation: string,
    fieldName: string,
    globalVariables?: Record<string, any>
  ): Record<string, any> {
    // Простой парсинг - ищем аргументы поля в запросе
    const fieldRegex = new RegExp(`${fieldName}\\s*\\(([^)]*)\\)`, 'i');
    const match = operation.match(fieldRegex);
    
    if (match && match[1]) {
      // Парсим аргументы (упрощенно)
      const args: Record<string, any> = {};
      const argPairs = match[1].split(',').map(s => s.trim());
      for (const pair of argPairs) {
        const [key, value] = pair.split(':').map(s => s.trim());
        if (key && value) {
          // Убираем кавычки
          args[key] = value.replace(/^["']|["']$/g, '');
        }
      }
      return { ...globalVariables, ...args };
    }
    
    return globalVariables || {};
  }
  
  /**
   * Выполнить батч резолверов (для DataLoader)
   */
  private async executeResolverBatch(
    resolverId: string,
    variablesList: Record<string, any>[],
    nodes: CanvasNode[],
    connections: CanvasConnection[],
    traceContext?: TraceContext,
    getJaegerEngines?: () => Map<string, any>
  ): Promise<ResolverExecutionResult[]> {
    const resolver = this.config?.resolvers?.find(r => r.id === resolverId);
    if (!resolver) {
      return variablesList.map(() => ({
        success: false,
        error: `Resolver not found: ${resolverId}`,
        latency: 0,
        resolverId,
      }));
    }
    
    const batchStartTime = Date.now();
    
    // Выполняем все запросы параллельно (симуляция батча)
    const results = await Promise.all(
      variablesList.map(variables =>
        this.executeResolver(resolver, variables, nodes, connections, traceContext, getJaegerEngines)
      )
    );
    
    const batchEndTime = Date.now();
    
    // Создаем span для DataLoader батча
    if (traceContext && getJaegerEngines && variablesList.length > 1) {
      const allSuccess = results.every(r => r.success);
      this.createDataLoaderBatchSpan(
        resolverId,
        variablesList.length,
        batchStartTime / 1000,
        batchEndTime / 1000,
        allSuccess,
        traceContext,
        getJaegerEngines
      );
    }
    
    return results;
  }
  
  /**
   * Обнаружить N+1 проблемы в запросе
   */
  private detectNPlusOneProblems(
    operation: string,
    requestedFields: string[],
    parentType: string
  ): void {
    // Анализируем структуру запроса на наличие списков с вложенными запросами
    // Это упрощенная версия - в реальности нужен более сложный парсинг
    
    for (const field of requestedFields) {
      const resolver = this.findResolverForField(field, parentType);
      
      if (resolver && resolver.enabled !== false) {
        // Проверяем, запрашивается ли это поле внутри списка
        // Ищем паттерн: field { nestedField }
        const listPattern = new RegExp(`\\[.*?${field}.*?\\{`, 's');
        const nestedPattern = new RegExp(`${field}\\s*\\{[^}]*\\}`, 's');
        
        if (listPattern.test(operation) && nestedPattern.test(operation)) {
          // Оцениваем количество вызовов (упрощенно)
          const listMatches = operation.match(/\[/g);
          const estimatedCalls = listMatches ? Math.pow(10, listMatches.length) : 10;
          
          // Определяем серьезность
          let severity: 'low' | 'medium' | 'high' = 'low';
          if (estimatedCalls > 100) {
            severity = 'high';
          } else if (estimatedCalls > 20) {
            severity = 'medium';
          }
          
          // Проверяем, не обнаружили ли мы уже эту проблему
          const existingProblem = this.nPlusOneProblems.find(
            p => p.field === field && p.resolverId === resolver.id
          );
          
          if (!existingProblem) {
            this.nPlusOneProblems.push({
              field,
              resolverId: resolver.id,
              parentType,
              estimatedCalls,
              severity,
              detectedAt: Date.now(),
            });
            
            // Ограничиваем размер истории
            if (this.nPlusOneProblems.length > this.MAX_N_PLUS_ONE_HISTORY) {
              this.nPlusOneProblems.shift();
            }
          }
        }
      }
    }
  }

  /**
   * Простое выполнение запроса (fallback)
   */
  private executeQuerySimple(operation: string, variables?: Record<string, any>): any {
    // Генерируем простой ответ на основе схемы
    if (operation.includes('users')) {
      return {
        users: [
          { id: '1', name: 'John Doe', email: 'john@example.com' },
          { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
        ],
      };
    }
    
    if (operation.includes('user')) {
      return {
        user: {
          id: variables?.id || '1',
          name: 'John Doe',
          email: 'john@example.com',
        },
      };
    }
    
    if (operation.includes('posts')) {
      return {
        posts: [
          { id: '1', title: 'Post 1', content: 'Content 1', author: { id: '1', name: 'John Doe' } },
          { id: '2', title: 'Post 2', content: 'Content 2', author: { id: '2', name: 'Jane Smith' } },
        ],
      };
    }
    
    return { data: null };
  }

  /**
   * Извлечь запрошенные поля из GraphQL запроса
   */
  private extractRequestedFields(operation: string): string[] {
    const fields: string[] = [];
    
    // Простой парсинг - ищем имена полей после query/mutation
    const fieldMatches = operation.match(/\b(\w+)\s*\{/g);
    if (fieldMatches) {
      for (const match of fieldMatches) {
        const fieldName = match.replace(/\s*\{/, '').trim();
        // Пропускаем ключевые слова
        if (!['query', 'mutation', 'subscription'].includes(fieldName.toLowerCase())) {
          fields.push(fieldName);
        }
      }
    }
    
    return fields;
  }

  /**
   * Найти резолвер для поля
   */
  private findResolverForField(fieldName: string, parentType: string): GraphQLResolver | undefined {
    if (!this.config?.resolvers) return undefined;
    
    return this.config.resolvers.find(
      r => r.field === fieldName && r.type === parentType && (r.enabled !== false)
    );
  }

  /**
   * Выполнить резолвер - симуляция запроса к целевому компоненту
   */
  private async executeResolver(
    resolver: GraphQLResolver,
    variables: Record<string, any> | undefined,
    nodes: CanvasNode[],
    connections: CanvasConnection[],
    traceContext?: TraceContext,
    getJaegerEngines?: () => Map<string, any>
  ): Promise<ResolverExecutionResult> {
    const startTime = Date.now();
    
    // Выбираем инстанс для load balancing (если включен)
    const selectedInstanceId = this.selectInstanceForLoadBalancing(resolver);
    const targetServiceId = selectedInstanceId || resolver.targetService;
    
    // Получаем соединение из пула
    let connectionInfo: { connectionId: string; instanceId: string } | null = null;
    try {
      connectionInfo = await this.getConnectionFromPool(resolver.id, targetServiceId);
    } catch (error: any) {
      const latency = Date.now() - startTime;
      const errorMessage = `Failed to get connection from pool: ${error.message}`;
      this.recordResolverCall(resolver.id, false, latency);
      return {
        success: false,
        error: errorMessage,
        latency,
        resolverId: resolver.id,
      };
    }
    
    // Находим целевой компонент
    const targetNode = nodes.find(n => n.id === targetServiceId);
    if (!targetNode) {
      // Освобождаем соединение
      if (connectionInfo) {
        this.releaseConnectionToPool(resolver.id, connectionInfo.connectionId, false);
        this.releaseInstanceFromLoadBalancing(resolver.id, connectionInfo.instanceId);
      }
      const latency = Date.now() - startTime;
      const endTime = Date.now();
      const errorMessage = `Target service not found: ${resolver.targetService}`;
      
      // Создаем span для ошибки резолвера
      if (traceContext && getJaegerEngines) {
        this.createResolverSpan(
          resolver,
          startTime / 1000,
          endTime / 1000,
          false,
          errorMessage,
          traceContext,
          getJaegerEngines
        );
      }
      
      this.recordResolverCall(resolver.id, false, latency);
      return {
        success: false,
        error: errorMessage,
        latency,
        resolverId: resolver.id,
      };
    }
    
    // Проверяем наличие соединения от GraphQL к целевому компоненту
    const connection = connections.find(
      c => c.source === this.componentId && c.target === targetServiceId
    );
    
    if (!connection) {
      // Освобождаем соединение
      if (connectionInfo) {
        this.releaseConnectionToPool(resolver.id, connectionInfo.connectionId, false);
        this.releaseInstanceFromLoadBalancing(resolver.id, connectionInfo.instanceId);
      }
      const latency = Date.now() - startTime;
      const endTime = Date.now();
      const errorMessage = `No connection found to target service: ${targetServiceId}`;
      
      // Создаем span для ошибки резолвера
      if (traceContext && getJaegerEngines) {
        this.createResolverSpan(
          resolver,
          startTime / 1000,
          endTime / 1000,
          false,
          errorMessage,
          traceContext,
          getJaegerEngines
        );
      }
      
      this.recordResolverCall(resolver.id, false, latency);
      return {
        success: false,
        error: errorMessage,
        latency,
        resolverId: resolver.id,
      };
    }
    
    // Симулируем выполнение запроса к целевому компоненту
    // Latency резолвера берем из конфига или используем базовую
    const resolverLatency = resolver.latency || this.config?.responseLatency || 50;
    
    // Получаем таймаут для резолвера
    const resolverTimeout = this.config?.timeout?.resolverTimeout || this.config?.timeout?.defaultTimeout || 5000;
    
    try {
      // Симулируем данные на основе типа целевого компонента с таймаутом
      const data = await this.executeWithTimeout(
        async () => {
          // Симулируем задержку выполнения резолвера
          await new Promise(resolve => setTimeout(resolve, resolverLatency));
          return this.simulateResolverData(targetNode, resolver, variables);
        },
        resolverTimeout,
        'resolver',
        `${resolver.type}.${resolver.field}`
      );
      
      const latency = Date.now() - startTime;
      const endTime = Date.now();
      
      // Создаем span для резолвера
      if (traceContext && getJaegerEngines) {
        this.createResolverSpan(
          resolver,
          startTime / 1000,
          endTime / 1000,
          true,
          undefined,
          traceContext,
          getJaegerEngines
        );
      }
      
      // Записываем метрики
      this.recordResolverCall(resolver.id, true, latency);
      
      // Освобождаем соединение
      if (connectionInfo) {
        this.releaseConnectionToPool(resolver.id, connectionInfo.connectionId, true);
        this.releaseInstanceFromLoadBalancing(resolver.id, connectionInfo.instanceId);
      }
      
      return {
        success: true,
        data,
        latency,
        resolverId: resolver.id,
      };
    } catch (error: any) {
      // Обработка таймаута резолвера
      const latency = Date.now() - startTime;
      const endTime = Date.now();
      const errorMessage = error.message || 'Resolver execution failed';
      
      // Освобождаем соединение
      if (connectionInfo) {
        this.releaseConnectionToPool(resolver.id, connectionInfo.connectionId, false);
        this.releaseInstanceFromLoadBalancing(resolver.id, connectionInfo.instanceId);
      }
      
      // Создаем span для ошибки резолвера
      if (traceContext && getJaegerEngines) {
        this.createResolverSpan(
          resolver,
          startTime / 1000,
          endTime / 1000,
          false,
          errorMessage,
          traceContext,
          getJaegerEngines
        );
      }
      
      this.recordResolverCall(resolver.id, false, latency);
      return {
        success: false,
        error: errorMessage,
        latency,
        resolverId: resolver.id,
      };
    }
  }

  /**
   * Инициализировать connection pool для резолвера
   */
  private initializeConnectionPool(resolver: GraphQLResolver): void {
    const poolSize = resolver.connectionPoolSize || 
                    this.config?.connectionPool?.defaultPoolSize || 
                    10;
    
    this.connectionPools.set(resolver.id, {
      connections: [],
      maxSize: poolSize,
      currentSize: 0,
      waitingQueue: [],
      totalRequests: 0,
      failedRequests: 0,
    });
  }

  /**
   * Инициализировать load balancing для резолвера
   */
  private initializeLoadBalancing(resolver: GraphQLResolver): void {
    if (!resolver.instances || resolver.instances.length <= 1) {
      return;
    }

    const strategy = this.config?.loadBalancing?.strategy || 'round-robin';
    const weights = this.config?.loadBalancing?.weights;
    
    const instanceWeights = new Map<string, number>();
    if (strategy === 'weighted' && weights) {
      for (const instanceId of resolver.instances) {
        instanceWeights.set(instanceId, weights[instanceId] || 1);
      }
    }

    this.loadBalancingState.set(resolver.id, {
      strategy,
      currentIndex: 0,
      instanceConnections: new Map(),
      instanceWeights: strategy === 'weighted' ? instanceWeights : undefined,
      totalRequests: 0,
      requestsByInstance: new Map(),
    });

    // Инициализируем счетчики соединений для каждого инстанса
    for (const instanceId of resolver.instances) {
      this.loadBalancingState.get(resolver.id)!.instanceConnections.set(instanceId, 0);
      this.loadBalancingState.get(resolver.id)!.requestsByInstance.set(instanceId, 0);
    }
  }

  /**
   * Получить соединение из пула
   */
  private async getConnectionFromPool(
    resolverId: string,
    instanceId?: string
  ): Promise<{ connectionId: string; instanceId: string }> {
    if (!this.config?.connectionPool?.enabled) {
      // Если pooling отключен, возвращаем виртуальное соединение
      return {
        connectionId: `${resolverId}:${instanceId || 'default'}`,
        instanceId: instanceId || 'default',
      };
    }

    const pool = this.connectionPools.get(resolverId);
    if (!pool) {
      // Пул не существует, создаем его
      const resolver = this.config?.resolvers?.find(r => r.id === resolverId);
      if (resolver) {
        this.initializeConnectionPool(resolver);
        return this.getConnectionFromPool(resolverId, instanceId);
      }
      throw new Error(`Connection pool not found for resolver: ${resolverId}`);
    }

    const startWaitTime = Date.now();
    this.connectionPoolMetrics.totalConnectionAttempts++;

    // Ищем свободное соединение
    const idleConnection = pool.connections.find(c => 
      c.status === 'idle' && 
      (!instanceId || c.id.includes(instanceId))
    );

    if (idleConnection) {
      idleConnection.status = 'active';
      idleConnection.lastUsed = Date.now();
      this.connectionPoolMetrics.activeConnections++;
      this.connectionPoolMetrics.idleConnections--;
      
      const waitTime = Date.now() - startWaitTime;
      this.connectionWaitTimes.push(waitTime);
      if (this.connectionWaitTimes.length > this.MAX_WAIT_TIME_HISTORY) {
        this.connectionWaitTimes.shift();
      }
      
      return {
        connectionId: idleConnection.id,
        instanceId: instanceId || idleConnection.id.split(':')[1] || 'default',
      };
    }

    // Если есть место в пуле, создаем новое соединение
    if (pool.currentSize < pool.maxSize) {
      const connectionId = `${resolverId}:${instanceId || 'default'}:${Date.now()}`;
      const connection = {
        id: connectionId,
        status: 'active' as const,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        consecutiveFailures: 0,
      };
      
      pool.connections.push(connection);
      pool.currentSize++;
      this.connectionPoolMetrics.totalConnections++;
      this.connectionPoolMetrics.activeConnections++;
      
      // Инициализируем health tracking
      const healthKey = `${resolverId}:${instanceId || 'default'}`;
      if (!this.connectionHealth.has(healthKey)) {
        this.connectionHealth.set(healthKey, {
          status: 'healthy',
          lastCheckTime: Date.now(),
          consecutiveFailures: 0,
          reconnectAttempts: 0,
        });
      }
      
      const waitTime = Date.now() - startWaitTime;
      this.connectionWaitTimes.push(waitTime);
      if (this.connectionWaitTimes.length > this.MAX_WAIT_TIME_HISTORY) {
        this.connectionWaitTimes.shift();
      }
      
      return {
        connectionId,
        instanceId: instanceId || 'default',
      };
    }

    // Пул заполнен, ждем освобождения соединения
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pool.waitingQueue = pool.waitingQueue.filter(w => w.reject !== reject);
        this.connectionPoolMetrics.failedConnectionAttempts++;
        reject(new Error('Connection pool timeout'));
      }, 5000); // 5 секунд таймаут ожидания

      pool.waitingQueue.push({
        resolve: (connection: { connectionId: string; instanceId: string }) => {
          clearTimeout(timeout);
          resolve(connection);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Вернуть соединение в пул
   */
  private releaseConnectionToPool(
    resolverId: string,
    connectionId: string,
    success: boolean
  ): void {
    if (!this.config?.connectionPool?.enabled) {
      return;
    }

    const pool = this.connectionPools.get(resolverId);
    if (!pool) {
      return;
    }

    const connection = pool.connections.find(c => c.id === connectionId);
    if (!connection) {
      return;
    }

    pool.totalRequests++;
    if (!success) {
      pool.failedRequests++;
      connection.consecutiveFailures++;
      
      // Если слишком много ошибок, помечаем как unhealthy
      if (connection.consecutiveFailures >= 3) {
        connection.status = 'unhealthy';
        const healthKey = connectionId.split(':').slice(0, 2).join(':');
        const health = this.connectionHealth.get(healthKey);
        if (health) {
          health.status = 'unhealthy';
          health.consecutiveFailures = connection.consecutiveFailures;
        }
      }
    } else {
      connection.consecutiveFailures = 0;
    }

    // Если соединение unhealthy, не возвращаем его в пул
    if (connection.status === 'unhealthy') {
      // Удаляем из пула
      pool.connections = pool.connections.filter(c => c.id !== connectionId);
      pool.currentSize--;
      this.connectionPoolMetrics.totalConnections--;
      this.connectionPoolMetrics.activeConnections--;
      
      // Пытаемся удовлетворить ожидающие запросы
      if (pool.waitingQueue.length > 0) {
        const waiting = pool.waitingQueue.shift();
        if (waiting) {
          // Создаем новое соединение для ожидающего запроса
          this.getConnectionFromPool(resolverId).then(conn => {
            waiting.resolve(conn);
          }).catch(err => {
            waiting.reject(err);
          });
        }
      }
      return;
    }

    // Возвращаем соединение в пул
    connection.status = 'idle';
    connection.lastUsed = Date.now();
    this.connectionPoolMetrics.activeConnections--;
    this.connectionPoolMetrics.idleConnections++;

    // Удовлетворяем ожидающие запросы
    if (pool.waitingQueue.length > 0) {
      const waiting = pool.waitingQueue.shift();
      if (waiting) {
        connection.status = 'active';
        connection.lastUsed = Date.now();
        this.connectionPoolMetrics.activeConnections++;
        this.connectionPoolMetrics.idleConnections--;
        waiting.resolve({
          connectionId: connection.id,
          instanceId: connection.id.split(':')[1] || 'default',
        });
      }
    }
  }

  /**
   * Выбрать инстанс для load balancing
   */
  private selectInstanceForLoadBalancing(resolver: GraphQLResolver): string | undefined {
    if (!this.config?.loadBalancing?.enabled || !resolver.instances || resolver.instances.length <= 1) {
      return resolver.targetService;
    }

    const state = this.loadBalancingState.get(resolver.id);
    if (!state) {
      return resolver.instances[0];
    }

    let selectedInstance: string = resolver.instances[0]; // Инициализируем значением по умолчанию

    switch (state.strategy) {
      case 'round-robin':
        selectedInstance = resolver.instances[state.currentIndex % resolver.instances.length];
        state.currentIndex = (state.currentIndex + 1) % resolver.instances.length;
        break;

      case 'least-connections':
        let minConnections = Infinity;
        selectedInstance = resolver.instances[0];
        for (const instanceId of resolver.instances) {
          const connections = state.instanceConnections.get(instanceId) || 0;
          if (connections < minConnections) {
            minConnections = connections;
            selectedInstance = instanceId;
          }
        }
        break;

      case 'random':
        selectedInstance = resolver.instances[Math.floor(Math.random() * resolver.instances.length)];
        break;

      case 'weighted':
        if (!state.instanceWeights) {
          selectedInstance = resolver.instances[0];
          break;
        }
        // Выбираем на основе весов
        const totalWeight = Array.from(state.instanceWeights.values()).reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;
        for (const instanceId of resolver.instances) {
          const weight = state.instanceWeights.get(instanceId) || 1;
          random -= weight;
          if (random <= 0) {
            selectedInstance = instanceId;
            break;
          }
        }
        if (!selectedInstance) {
          selectedInstance = resolver.instances[0];
        }
        break;

      default:
        selectedInstance = resolver.instances[0];
    }

    // Обновляем метрики
    state.totalRequests++;
    const currentCount = state.requestsByInstance.get(selectedInstance) || 0;
    state.requestsByInstance.set(selectedInstance, currentCount + 1);
    
    const connections = state.instanceConnections.get(selectedInstance) || 0;
    state.instanceConnections.set(selectedInstance, connections + 1);

    this.loadBalancingMetrics.totalRequests++;

    return selectedInstance;
  }

  /**
   * Освободить инстанс после использования
   */
  private releaseInstanceFromLoadBalancing(resolverId: string, instanceId: string): void {
    if (!this.config?.loadBalancing?.enabled) {
      return;
    }

    const state = this.loadBalancingState.get(resolverId);
    if (!state) {
      return;
    }

    const connections = state.instanceConnections.get(instanceId) || 0;
    if (connections > 0) {
      state.instanceConnections.set(instanceId, connections - 1);
    }
  }

  /**
   * Запустить health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      return; // Уже запущено
    }

    const interval = this.config?.connectionPool?.healthCheckInterval || 30000;
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, interval);
  }

  /**
   * Выполнить health checks для всех соединений
   */
  private performHealthChecks(): void {
    if (!this.config?.connectionPool?.enabled) {
      return;
    }

    const now = Date.now();
    this.connectionHealthMetrics.totalHealthChecks++;

    for (const [resolverId, pool] of this.connectionPools.entries()) {
      for (const connection of pool.connections) {
        const healthKey = connection.id.split(':').slice(0, 2).join(':');
        let health = this.connectionHealth.get(healthKey);
        
        if (!health) {
          health = {
            status: 'healthy',
            lastCheckTime: now,
            consecutiveFailures: 0,
            reconnectAttempts: 0,
          };
          this.connectionHealth.set(healthKey, health);
        }

        health.lastCheckTime = now;
        this.connectionHealthMetrics.lastHealthCheckTime = now;

        // Симулируем health check (в реальности это был бы реальный запрос)
        const isHealthy = Math.random() > 0.05; // 95% вероятность здорового соединения

        if (isHealthy) {
          if (health.status === 'unhealthy') {
            // Соединение восстановилось
            health.status = 'healthy';
            health.consecutiveFailures = 0;
            connection.status = connection.status === 'unhealthy' ? 'idle' : connection.status;
            this.connectionHealthMetrics.successfulReconnects++;
            this.connectionHealthMetrics.totalReconnects++;
          }
        } else {
          // Соединение нездорово
          this.connectionHealthMetrics.failedHealthChecks++;
          health.consecutiveFailures++;
          
          if (health.consecutiveFailures >= 3) {
            health.status = 'unhealthy';
            connection.status = 'unhealthy';
            this.connectionHealthMetrics.unhealthyConnections++;
            
            // Пытаемся переподключиться
            if (health.reconnectAttempts < (this.config.connectionPool?.maxReconnectAttempts || 3)) {
              health.status = 'reconnecting';
              health.reconnectAttempts++;
              this.connectionHealthMetrics.totalReconnects++;
              
              // Симулируем переподключение
              setTimeout(() => {
                const reconnectHealth = Math.random() > 0.3; // 70% вероятность успешного переподключения
                if (reconnectHealth) {
                  health!.status = 'healthy';
                  connection.status = 'idle';
                  health!.consecutiveFailures = 0;
                  this.connectionHealthMetrics.successfulReconnects++;
                } else {
                  health!.status = 'unhealthy';
                  this.connectionHealthMetrics.failedReconnects++;
                }
              }, this.config.connectionPool?.reconnectDelay || 1000);
            } else {
              this.connectionHealthMetrics.failedReconnects++;
            }
          }
        }
      }
    }

    // Обновляем счетчики здоровых/нездоровых соединений
    let healthy = 0;
    let unhealthy = 0;
    for (const health of this.connectionHealth.values()) {
      if (health.status === 'healthy') {
        healthy++;
      } else {
        unhealthy++;
      }
    }
    this.connectionHealthMetrics.healthyConnections = healthy;
    this.connectionHealthMetrics.unhealthyConnections = unhealthy;
    this.connectionHealthMetrics.healthCheckFailureRate = 
      this.connectionHealthMetrics.totalHealthChecks > 0
        ? this.connectionHealthMetrics.failedHealthChecks / this.connectionHealthMetrics.totalHealthChecks
        : 0;
    this.connectionHealthMetrics.reconnectSuccessRate =
      this.connectionHealthMetrics.totalReconnects > 0
        ? this.connectionHealthMetrics.successfulReconnects / this.connectionHealthMetrics.totalReconnects
        : 0;
  }

  /**
   * Симулировать данные резолвера на основе типа целевого компонента
   */
  private simulateResolverData(
    targetNode: CanvasNode,
    resolver: GraphQLResolver,
    variables: Record<string, any> | undefined
  ): any {
    // Генерируем данные в зависимости от типа целевого компонента
    switch (targetNode.type) {
      case 'postgres':
      case 'mongodb':
      case 'redis':
      case 'cassandra':
      case 'clickhouse':
      case 'snowflake':
      case 'elasticsearch':
        // Для БД - симулируем данные на основе схемы
        return this.simulateDatabaseResponse(resolver, variables);
      
      case 'rest':
      case 'grpc':
        // Для API - симулируем ответ API
        return this.simulateAPIResponse(resolver, variables);
      
      default:
        // Для других типов - используем fallback
        return this.getFallbackDataForField(resolver.field, variables);
    }
  }

  /**
   * Симулировать ответ базы данных
   */
  private simulateDatabaseResponse(
    resolver: GraphQLResolver,
    variables: Record<string, any> | undefined
  ): any {
    // Генерируем данные на основе имени поля
    const fieldName = resolver.field.toLowerCase();
    
    if (fieldName.includes('user')) {
      if (variables?.id) {
        return {
          id: variables.id,
          name: `User ${variables.id}`,
          email: `user${variables.id}@example.com`,
        };
      }
      return [
        { id: '1', name: 'User 1', email: 'user1@example.com' },
        { id: '2', name: 'User 2', email: 'user2@example.com' },
      ];
    }
    
    if (fieldName.includes('post')) {
      return [
        { id: '1', title: 'Post 1', content: 'Content 1' },
        { id: '2', title: 'Post 2', content: 'Content 2' },
      ];
    }
    
    return null;
  }

  /**
   * Симулировать ответ API
   */
  private simulateAPIResponse(
    resolver: GraphQLResolver,
    variables: Record<string, any> | undefined
  ): any {
    // Симулируем JSON ответ от REST/gRPC API
    return {
      data: this.getFallbackDataForField(resolver.field, variables),
      status: 'success',
    };
  }

  /**
   * Получить fallback данные для поля
   */
  private getFallbackDataForField(fieldName: string, variables?: Record<string, any>): any {
    const lowerField = fieldName.toLowerCase();
    
    if (lowerField.includes('user')) {
      if (variables?.id) {
        return {
          id: variables.id,
          name: `User ${variables.id}`,
          email: `user${variables.id}@example.com`,
        };
      }
      return [
        { id: '1', name: 'John Doe', email: 'john@example.com' },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
      ];
    }
    
    if (lowerField.includes('post')) {
      return [
        { id: '1', title: 'Post 1', content: 'Content 1' },
        { id: '2', title: 'Post 2', content: 'Content 2' },
      ];
    }
    
    return null;
  }

  /**
   * Записать вызов резолвера в метрики
   */
  private recordResolverCall(resolverId: string, success: boolean, latency: number): void {
    let metrics = this.resolverMetrics.get(resolverId);
    
    if (!metrics) {
      // Создаем метрики если их нет
      const resolver = this.config?.resolvers?.find(r => r.id === resolverId);
      if (!resolver) return;
      
      metrics = {
        id: resolverId,
        type: resolver.type,
        field: resolver.field,
        totalCalls: 0,
        totalErrors: 0,
        averageLatency: 0,
        totalLatency: 0,
        errorRate: 0,
      };
      this.resolverMetrics.set(resolverId, metrics);
    }
    
    // Обновляем метрики
    metrics.totalCalls++;
    metrics.totalLatency += latency;
    metrics.averageLatency = metrics.totalLatency / metrics.totalCalls;
    metrics.lastCallTime = Date.now();
    
    if (!success) {
      metrics.totalErrors++;
    }
    
    metrics.errorRate = metrics.totalErrors / metrics.totalCalls;
  }

  /**
   * Выполнение мутации (симуляция)
   */
  private executeMutation(operation: string, variables?: Record<string, any>): any {
    // Симуляция выполнения мутации
    if (operation.includes('createUser')) {
      return {
        createUser: {
          id: `user-${Date.now()}`,
          name: variables?.name || 'New User',
          email: variables?.email || 'newuser@example.com',
        },
      };
    }
    
    if (operation.includes('updateUser')) {
      return {
        updateUser: {
          id: variables?.id || '1',
          name: variables?.name || 'Updated User',
          email: variables?.email || 'updated@example.com',
        },
      };
    }
    
    if (operation.includes('deleteUser')) {
      return {
        deleteUser: true,
      };
    }
    
    return { data: null };
  }

  /**
   * Получить ключ кэша для запроса
   */
  private getCacheKey(request: { query: string; variables?: Record<string, any> }): string {
    const varsStr = request.variables ? JSON.stringify(request.variables) : '';
    return `${request.query}:${varsStr}`;
  }

  /**
   * Получить все persisted queries
   */
  public getPersistedQueries(): PersistedQuery[] {
    return Array.from(this.persistedQueries.values());
  }

  /**
   * Получить persisted query по hash
   */
  public getPersistedQueryByHash(hash: string): PersistedQuery | undefined {
    return this.persistedQueries.get(hash);
  }

  /**
   * Удалить persisted query
   */
  public deletePersistedQuery(hash: string): boolean {
    const deleted = this.persistedQueries.delete(hash);
    if (deleted && this.config) {
      this.config.persistedQueries = Array.from(this.persistedQueries.values());
    }
    return deleted;
  }

  /**
   * Получить метрики batch запросов
   */
  public getBatchQueryMetrics(): BatchQueryMetrics {
    return { ...this.batchQueryMetrics };
  }

  /**
   * Записать метрики запроса
   */
  private recordQuery(
    success: boolean,
    latency: number,
    complexity: number,
    depth: number,
    cached: boolean = false,
    operationName?: string,
    operationType: 'query' | 'mutation' | 'subscription' = 'query',
    fields?: Array<{ name: string; args?: Record<string, any>; nestedFields?: string[] }>,
    errorMessage?: string
  ): void {
    const now = Date.now();
    
    // Обновляем счетчики за секунду
    if (now - this.lastSecondStart >= 1000) {
      this.graphQLMetrics.queriesPerSecond = this.queriesThisSecond;
      this.queriesThisSecond = 0;
      this.lastSecondStart = now;
    }
    this.queriesThisSecond++;
    
    // Обновляем общие метрики
    this.graphQLMetrics.totalQueries++;
    if (!success) {
      this.graphQLMetrics.totalErrors++;
      
      // Записываем ошибку с категоризацией
      if (errorMessage) {
        const category = this.categorizeError(errorMessage, operationType);
        this.recordError(category, errorMessage, operationName, operationType);
      }
    }
    
    // Обновляем историю latency
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > this.MAX_LATENCY_HISTORY) {
      this.latencyHistory.shift();
    }
    
    // Обновляем среднюю latency
    const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
    this.graphQLMetrics.averageResponseTime = sum / this.latencyHistory.length;
    
    // Обновляем историю сложности и глубины
    if (complexity > 0) {
      this.complexityHistory.push(complexity);
      if (this.complexityHistory.length > this.MAX_LATENCY_HISTORY) {
        this.complexityHistory.shift();
      }
      const complexitySum = this.complexityHistory.reduce((a, b) => a + b, 0);
      this.graphQLMetrics.averageComplexity = complexitySum / this.complexityHistory.length;
    }
    
    if (depth > 0) {
      this.depthHistory.push(depth);
      if (this.depthHistory.length > this.MAX_LATENCY_HISTORY) {
        this.depthHistory.shift();
      }
      const depthSum = this.depthHistory.reduce((a, b) => a + b, 0);
      this.graphQLMetrics.averageDepth = depthSum / this.depthHistory.length;
    }
    
    // Обновляем error rate
    if (this.graphQLMetrics.totalQueries > 0) {
      this.graphQLMetrics.errorRate = this.graphQLMetrics.totalErrors / this.graphQLMetrics.totalQueries;
    }
    
    // Обновляем cache hit rate (упрощенно)
    if (cached) {
      // В реальности нужно отслеживать cache hits отдельно
    }
    
    // Записываем type-level метрики
    const typeName = operationType === 'query' ? 'Query' : operationType === 'mutation' ? 'Mutation' : 'Subscription';
    this.recordTypeMetrics(typeName, success, latency, complexity, depth);
    
    // Записываем operation-level метрики
    if (operationName) {
      this.recordOperationMetrics(operationName, operationType, success, latency, complexity, depth);
    }
    
    // Записываем field-level метрики
    if (fields) {
      for (const field of fields) {
        this.recordFieldMetrics(field.name, typeName, success, latency);
      }
    }
    
    // Добавляем в историю
    const query: GraphQLQuery = {
      id: `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      query: '',
      timestamp: now,
      duration: latency,
      success,
      complexity,
      depth,
      operationName,
    };
    
    this.queryHistory.push(query);
    if (this.queryHistory.length > this.MAX_HISTORY_SIZE) {
      this.queryHistory.shift();
    }
  }

  /**
   * Записать метрики мутации
   */
  private recordMutation(
    success: boolean,
    latency: number,
    operationName?: string,
    fields?: Array<{ name: string; args?: Record<string, any>; nestedFields?: string[] }>,
    errorMessage?: string
  ): void {
    const now = Date.now();
    
    // Обновляем счетчики за секунду
    if (now - this.lastSecondStart >= 1000) {
      this.graphQLMetrics.mutationsPerSecond = this.mutationsThisSecond;
      this.mutationsThisSecond = 0;
    }
    this.mutationsThisSecond++;
    
    // Обновляем общие метрики
    this.graphQLMetrics.totalMutations++;
    if (!success) {
      this.graphQLMetrics.totalErrors++;
      
      // Записываем ошибку с категоризацией
      if (errorMessage) {
        this.recordError(this.categorizeError(errorMessage, 'mutation'), errorMessage, operationName, 'mutation');
      }
    }
    
    // Обновляем error rate
    const totalOps = this.graphQLMetrics.totalQueries + this.graphQLMetrics.totalMutations;
    if (totalOps > 0) {
      this.graphQLMetrics.errorRate = this.graphQLMetrics.totalErrors / totalOps;
    }
    
    // Записываем type-level метрики
    this.recordTypeMetrics('Mutation', success, latency, 0, 0);
    
    // Записываем operation-level метрики
    if (operationName) {
      this.recordOperationMetrics(operationName, 'mutation', success, latency, 0, 0);
    }
    
    // Записываем field-level метрики
    if (fields) {
      for (const field of fields) {
        this.recordFieldMetrics(field.name, 'Mutation', success, latency);
      }
    }
  }

  /**
   * Записать field-level метрики
   */
  private recordFieldMetrics(
    fieldName: string,
    typeName: string,
    success: boolean,
    latency: number
  ): void {
    const key = `${typeName}:${fieldName}`;
    let metrics = this.fieldMetrics.get(key);
    
    if (!metrics) {
      metrics = {
        fieldName,
        typeName,
        totalCalls: 0,
        totalErrors: 0,
        averageLatency: 0,
        totalLatency: 0,
        minLatency: latency,
        maxLatency: latency,
        errorRate: 0,
        callsPerSecond: 0,
      };
      this.fieldMetrics.set(key, metrics);
    }
    
    // Обновляем метрики
    metrics.totalCalls++;
    metrics.totalLatency += latency;
    metrics.averageLatency = metrics.totalLatency / metrics.totalCalls;
    metrics.minLatency = Math.min(metrics.minLatency, latency);
    metrics.maxLatency = Math.max(metrics.maxLatency, latency);
    metrics.lastCallTime = Date.now();
    
    if (!success) {
      metrics.totalErrors++;
    }
    
    metrics.errorRate = metrics.totalErrors / metrics.totalCalls;
    
    // Обновляем счетчик за секунду
    const now = Date.now();
    if (now - this.lastMetricsSecondStart >= 1000) {
      // Обновляем callsPerSecond для всех полей
      this.updateFieldMetricsPerSecond();
      this.lastMetricsSecondStart = now;
    }
    
    const currentCount = this.fieldCallsThisSecond.get(key) || 0;
    this.fieldCallsThisSecond.set(key, currentCount + 1);
  }

  /**
   * Обновить callsPerSecond для field metrics
   */
  private updateFieldMetricsPerSecond(): void {
    for (const [key, count] of this.fieldCallsThisSecond.entries()) {
      const metrics = this.fieldMetrics.get(key);
      if (metrics) {
        metrics.callsPerSecond = count;
      }
    }
    this.fieldCallsThisSecond.clear();
  }

  /**
   * Записать type-level метрики
   */
  private recordTypeMetrics(
    typeName: 'Query' | 'Mutation' | 'Subscription',
    success: boolean,
    latency: number,
    complexity: number,
    depth: number
  ): void {
    let metrics = this.typeMetrics.get(typeName);
    
    if (!metrics) {
      metrics = {
        typeName,
        totalOperations: 0,
        totalErrors: 0,
        averageLatency: 0,
        averageComplexity: 0,
        averageDepth: 0,
        errorRate: 0,
        operationsPerSecond: 0,
      };
      this.typeMetrics.set(typeName, metrics);
    }
    
    // Обновляем метрики
    metrics.totalOperations++;
    if (!success) {
      metrics.totalErrors++;
    }
    
    // Обновляем средние значения (упрощенно - используем скользящее среднее)
    const alpha = 0.1; // Коэффициент для экспоненциального скользящего среднего
    metrics.averageLatency = metrics.averageLatency * (1 - alpha) + latency * alpha;
    if (complexity > 0) {
      metrics.averageComplexity = metrics.averageComplexity * (1 - alpha) + complexity * alpha;
    }
    if (depth > 0) {
      metrics.averageDepth = metrics.averageDepth * (1 - alpha) + depth * alpha;
    }
    
    metrics.errorRate = metrics.totalErrors / metrics.totalOperations;
    metrics.lastOperationTime = Date.now();
    
    // Обновляем счетчик за секунду
    const now = Date.now();
    if (now - this.lastMetricsSecondStart >= 1000) {
      this.updateTypeMetricsPerSecond();
    }
    
    const currentCount = this.typeOpsThisSecond.get(typeName) || 0;
    this.typeOpsThisSecond.set(typeName, currentCount + 1);
  }

  /**
   * Обновить operationsPerSecond для type metrics
   */
  private updateTypeMetricsPerSecond(): void {
    for (const [typeName, count] of this.typeOpsThisSecond.entries()) {
      const metrics = this.typeMetrics.get(typeName);
      if (metrics) {
        metrics.operationsPerSecond = count;
      }
    }
    this.typeOpsThisSecond.clear();
  }

  /**
   * Записать operation-level метрики
   */
  private recordOperationMetrics(
    operationName: string,
    operationType: 'query' | 'mutation' | 'subscription',
    success: boolean,
    latency: number,
    complexity: number,
    depth: number
  ): void {
    // Ограничиваем количество отслеживаемых операций
    if (this.operationMetrics.size >= this.MAX_OPERATIONS && !this.operationMetrics.has(operationName)) {
      // Удаляем наименее используемую операцию
      let leastUsed: string | null = null;
      let minCalls = Infinity;
      for (const [name, metrics] of this.operationMetrics.entries()) {
        if (metrics.totalCalls < minCalls) {
          minCalls = metrics.totalCalls;
          leastUsed = name;
        }
      }
      if (leastUsed) {
        this.operationMetrics.delete(leastUsed);
      }
    }
    
    let metrics = this.operationMetrics.get(operationName);
    
    if (!metrics) {
      metrics = {
        operationName,
        operationType,
        totalCalls: 0,
        totalErrors: 0,
        averageLatency: 0,
        averageComplexity: 0,
        averageDepth: 0,
        errorRate: 0,
        callsPerSecond: 0,
        history: [],
      };
      this.operationMetrics.set(operationName, metrics);
    }
    
    // Обновляем метрики
    metrics.totalCalls++;
    if (!success) {
      metrics.totalErrors++;
    }
    
    // Обновляем средние значения
    const alpha = 0.1;
    metrics.averageLatency = metrics.averageLatency * (1 - alpha) + latency * alpha;
    if (complexity > 0) {
      metrics.averageComplexity = metrics.averageComplexity * (1 - alpha) + complexity * alpha;
    }
    if (depth > 0) {
      metrics.averageDepth = metrics.averageDepth * (1 - alpha) + depth * alpha;
    }
    
    metrics.errorRate = metrics.totalErrors / metrics.totalCalls;
    metrics.lastCallTime = Date.now();
    
    // Добавляем в историю
    if (metrics.history) {
      metrics.history.push({
        timestamp: Date.now(),
        latency,
        success,
        complexity: complexity > 0 ? complexity : undefined,
        depth: depth > 0 ? depth : undefined,
      });
      
      // Ограничиваем размер истории
      if (metrics.history.length > this.MAX_OPERATION_HISTORY) {
        metrics.history.shift();
      }
    }
    
    // Обновляем счетчик за секунду
    const now = Date.now();
    if (now - this.lastMetricsSecondStart >= 1000) {
      this.updateOperationMetricsPerSecond();
    }
    
    const currentCount = this.operationCallsThisSecond.get(operationName) || 0;
    this.operationCallsThisSecond.set(operationName, currentCount + 1);
  }

  /**
   * Обновить callsPerSecond для operation metrics
   */
  private updateOperationMetricsPerSecond(): void {
    for (const [operationName, count] of this.operationCallsThisSecond.entries()) {
      const metrics = this.operationMetrics.get(operationName);
      if (metrics) {
        metrics.callsPerSecond = count;
      }
    }
    this.operationCallsThisSecond.clear();
  }

  /**
   * Записать error metrics
   */
  private recordError(
    category: ErrorCategory,
    message: string,
    operationName?: string,
    operationType?: 'query' | 'mutation' | 'subscription'
  ): void {
    let metrics = this.errorMetrics.get(category);
    
    if (!metrics) {
      metrics = {
        category,
        totalErrors: 0,
        errorsPerSecond: 0,
        recentErrors: [],
      };
      this.errorMetrics.set(category, metrics);
    }
    
    // Обновляем метрики
    metrics.totalErrors++;
    metrics.lastErrorTime = Date.now();
    
    // Добавляем в историю ошибок
    const errorEntry = {
      timestamp: Date.now(),
      category,
      message,
      operationName,
      operationType,
    };
    
    if (metrics.recentErrors) {
      metrics.recentErrors.push(errorEntry);
      if (metrics.recentErrors.length > this.MAX_ERROR_HISTORY) {
        metrics.recentErrors.shift();
      }
    }
    
    // Добавляем в общую историю ошибок
    this.errorHistory.push(errorEntry);
    if (this.errorHistory.length > this.MAX_TOTAL_ERROR_HISTORY) {
      this.errorHistory.shift();
    }
    
    // Обновляем счетчик за секунду
    const now = Date.now();
    if (now - this.lastMetricsSecondStart >= 1000) {
      this.updateErrorMetricsPerSecond();
    }
    
    const currentCount = this.errorCountsThisSecond.get(category) || 0;
    this.errorCountsThisSecond.set(category, currentCount + 1);
  }

  /**
   * Обновить errorsPerSecond для error metrics
   */
  private updateErrorMetricsPerSecond(): void {
    for (const [category, count] of this.errorCountsThisSecond.entries()) {
      const metrics = this.errorMetrics.get(category);
      if (metrics) {
        metrics.errorsPerSecond = count;
      }
    }
    this.errorCountsThisSecond.clear();
  }

  /**
   * Генерирует уникальный trace ID
   */
  private generateTraceId(): string {
    return `graphql-trace-${++this.traceIdCounter}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Генерирует уникальный span ID
   */
  private generateSpanId(): string {
    return `graphql-span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Создает и отправляет span в Jaeger engines
   */
  private sendSpanToJaeger(
    span: JaegerSpan,
    getJaegerEngines?: () => Map<string, any> // Map<string, JaegerEmulationEngine>
  ): void {
    if (!getJaegerEngines) return;
    
    const jaegerEngines = getJaegerEngines();
    if (jaegerEngines.size === 0) return;
    
    // Отправляем span во все Jaeger engines
    for (const [, jaegerEngine] of jaegerEngines) {
      if (jaegerEngine && typeof jaegerEngine.receiveSpan === 'function') {
        jaegerEngine.receiveSpan(span);
      }
    }
  }

  /**
   * Создает span для GraphQL запроса
   */
  private createQuerySpan(
    operationName: string,
    operationType: 'query' | 'mutation' | 'subscription',
    startTime: number,
    endTime: number,
    success: boolean,
    complexity?: number,
    depth?: number,
    errorMessage?: string,
    parentTraceContext?: TraceContext,
    getJaegerEngines?: () => Map<string, any>
  ): TraceContext | undefined {
    if (!getJaegerEngines) return undefined;
    
    const jaegerEngines = getJaegerEngines();
    if (jaegerEngines.size === 0) return undefined;
    
    // Создаем или используем существующий trace context
    let traceContext: TraceContext;
    
    if (parentTraceContext) {
      // Используем существующий trace, создаем новый span
      traceContext = {
        traceId: parentTraceContext.traceId,
        spanId: this.generateSpanId(),
        parentSpanId: parentTraceContext.spanId,
        sampled: parentTraceContext.sampled,
      };
    } else {
      // Создаем новый trace
      const traceId = this.generateTraceId();
      const spanId = this.generateSpanId();
      
      traceContext = {
        traceId,
        spanId,
        sampled: true,
      };
      
      this.traceContexts.set(traceId, traceContext);
    }
    
    const duration = (endTime - startTime) * 1000; // convert to microseconds
    const startTimeMicros = startTime * 1000; // convert to microseconds
    
    // Создаем span
    const span: JaegerSpan = {
      traceId: traceContext.traceId,
      spanId: traceContext.spanId,
      parentSpanId: traceContext.parentSpanId,
      operationName: `graphql.${operationType}.${operationName || 'unknown'}`,
      serviceName: this.componentId || 'graphql',
      startTime: startTimeMicros,
      duration,
      tags: [
        { key: 'component.type', value: 'graphql' },
        { key: 'graphql.operation.type', value: operationType },
        { key: 'graphql.operation.name', value: operationName || 'unknown' },
        { key: 'status', value: success ? 'success' : 'error' },
      ],
      logs: [],
    };
    
    // Добавляем метаданные
    if (complexity !== undefined) {
      span.tags.push({ key: 'graphql.complexity', value: complexity });
    }
    if (depth !== undefined) {
      span.tags.push({ key: 'graphql.depth', value: depth });
    }
    
    // Добавляем error tag и log если есть ошибка
    if (!success && errorMessage) {
      span.tags.push({ key: 'error', value: true });
      span.logs.push({
        timestamp: startTimeMicros + duration,
        fields: [
          { key: 'event', value: 'error' },
          { key: 'error.message', value: errorMessage },
        ],
      });
    }
    
    // Отправляем span
    this.sendSpanToJaeger(span, getJaegerEngines);
    
    return traceContext;
  }

  /**
   * Создает span для резолвера
   */
  private createResolverSpan(
    resolver: GraphQLResolver,
    startTime: number,
    endTime: number,
    success: boolean,
    errorMessage?: string,
    parentTraceContext?: TraceContext,
    getJaegerEngines?: () => Map<string, any>
  ): TraceContext | undefined {
    if (!getJaegerEngines || !parentTraceContext) return undefined;
    
    const jaegerEngines = getJaegerEngines();
    if (jaegerEngines.size === 0) return undefined;
    
    const spanId = this.generateSpanId();
    const duration = (endTime - startTime) * 1000; // convert to microseconds
    const startTimeMicros = startTime * 1000; // convert to microseconds
    
    // Создаем trace context для следующего span
    const traceContext: TraceContext = {
      traceId: parentTraceContext.traceId,
      spanId,
      parentSpanId: parentTraceContext.spanId,
      sampled: parentTraceContext.sampled,
    };
    
    // Создаем span
    const span: JaegerSpan = {
      traceId: traceContext.traceId,
      spanId: traceContext.spanId,
      parentSpanId: traceContext.parentSpanId,
      operationName: `graphql.resolver.${resolver.field}`,
      serviceName: resolver.targetService || 'unknown',
      startTime: startTimeMicros,
      duration,
      tags: [
        { key: 'component.type', value: 'graphql.resolver' },
        { key: 'graphql.resolver.id', value: resolver.id },
        { key: 'graphql.resolver.type', value: resolver.type },
        { key: 'graphql.resolver.field', value: resolver.field },
        { key: 'graphql.resolver.target', value: resolver.targetService || 'unknown' },
        { key: 'status', value: success ? 'success' : 'error' },
      ],
      logs: [],
    };
    
    // Добавляем error tag и log если есть ошибка
    if (!success && errorMessage) {
      span.tags.push({ key: 'error', value: true });
      span.logs.push({
        timestamp: startTimeMicros + duration,
        fields: [
          { key: 'event', value: 'error' },
          { key: 'error.message', value: errorMessage },
        ],
      });
    }
    
    // Отправляем span
    this.sendSpanToJaeger(span, getJaegerEngines);
    
    return traceContext;
  }

  /**
   * Создает span для DataLoader батча
   */
  private createDataLoaderBatchSpan(
    resolverId: string,
    batchSize: number,
    startTime: number,
    endTime: number,
    success: boolean,
    parentTraceContext?: TraceContext,
    getJaegerEngines?: () => Map<string, any>
  ): void {
    if (!getJaegerEngines || !parentTraceContext) return;
    
    const jaegerEngines = getJaegerEngines();
    if (jaegerEngines.size === 0) return;
    
    const spanId = this.generateSpanId();
    const duration = (endTime - startTime) * 1000; // convert to microseconds
    const startTimeMicros = startTime * 1000; // convert to microseconds
    
    // Создаем span
    const span: JaegerSpan = {
      traceId: parentTraceContext.traceId,
      spanId,
      parentSpanId: parentTraceContext.spanId,
      operationName: `graphql.dataloader.batch`,
      serviceName: this.componentId || 'graphql',
      startTime: startTimeMicros,
      duration,
      tags: [
        { key: 'component.type', value: 'graphql.dataloader' },
        { key: 'graphql.resolver.id', value: resolverId },
        { key: 'graphql.dataloader.batch.size', value: batchSize },
        { key: 'status', value: success ? 'success' : 'error' },
      ],
      logs: [],
    };
    
    // Отправляем span
    this.sendSpanToJaeger(span, getJaegerEngines);
  }

  /**
   * Определить категорию ошибки по сообщению
   */
  private categorizeError(message: string, operationType?: 'query' | 'mutation' | 'subscription'): ErrorCategory {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid') || lowerMessage.includes('schema')) {
      return 'validation';
    }
    
    if (lowerMessage.includes('resolver') || lowerMessage.includes('target service')) {
      return 'resolver';
    }
    
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return 'timeout';
    }
    
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
      return 'rate_limit';
    }
    
    if (lowerMessage.includes('complexity') && lowerMessage.includes('exceed')) {
      return 'complexity_limit';
    }
    
    if (lowerMessage.includes('depth') && lowerMessage.includes('exceed')) {
      return 'depth_limit';
    }
    
    if (lowerMessage.includes('execution') || lowerMessage.includes('execution failed')) {
      return 'execution';
    }
    
    return 'other';
  }

  /**
   * Получить метрики GraphQL
   */
  public getGraphQLMetrics(): GraphQLMetrics {
    // Агрегируем метрики DataLoader
    let totalBatches = 0;
    let totalRequests = 0;
    let totalBatchedRequests = 0;
    let totalDeduplicated = 0;
    let totalCacheHits = 0;
    let totalLatencyReduction = 0;
    
    for (const dataLoader of this.dataLoaders.values()) {
      const metrics = dataLoader.getMetrics();
      totalBatches += metrics.totalBatches;
      totalRequests += metrics.totalRequests;
      totalBatchedRequests += metrics.totalBatchedRequests;
      totalDeduplicated += metrics.deduplicationRate * metrics.totalRequests / 100;
      totalCacheHits += metrics.cacheHitRate * metrics.totalRequests / 100;
      totalLatencyReduction += metrics.averageLatencyReduction * metrics.totalBatches;
    }
    
    this.dataLoaderMetrics = {
      totalBatches,
      totalRequests,
      totalBatchedRequests,
      averageBatchSize: totalBatches > 0 ? totalBatchedRequests / totalBatches : 0,
      deduplicationRate: totalRequests > 0 ? (totalDeduplicated / totalRequests) * 100 : 0,
      cacheHitRate: totalRequests > 0 ? (totalCacheHits / totalRequests) * 100 : 0,
      averageLatencyReduction: totalBatches > 0 ? totalLatencyReduction / totalBatches : 0,
    };
    
    // Обновляем per-second метрики перед возвратом
    const now = Date.now();
    if (now - this.lastMetricsSecondStart >= 1000) {
      this.updateFieldMetricsPerSecond();
      this.updateTypeMetricsPerSecond();
      this.updateOperationMetricsPerSecond();
      this.updateErrorMetricsPerSecond();
      this.updateRateLimitMetricsPerSecond();
      this.updateTimeoutMetricsPerSecond();
      this.lastMetricsSecondStart = now;
    }
    
    return { 
      ...this.graphQLMetrics,
      resolverMetrics: this.getResolverMetrics(),
      batchQueryMetrics: this.batchQueryMetrics,
      persistedQueriesCount: this.persistedQueries.size,
      persistedQueriesUsage: this.persistedQueriesUsage,
      introspectionMetrics: this.getIntrospectionMetrics(),
      fieldMetrics: Array.from(this.fieldMetrics.values()),
      typeMetrics: Array.from(this.typeMetrics.values()),
      operationMetrics: Array.from(this.operationMetrics.values()),
      errorMetrics: Array.from(this.errorMetrics.values()),
      rateLimitMetrics: { ...this.rateLimitMetrics },
      timeoutMetrics: { ...this.timeoutMetrics },
      connectionPoolMetrics: this.getConnectionPoolMetrics(),
      connectionHealthMetrics: { ...this.connectionHealthMetrics },
      loadBalancingMetrics: this.getLoadBalancingMetrics(),
    };
  }
  
  /**
   * Получить метрики connection pool
   */
  private getConnectionPoolMetrics(): ConnectionPoolMetrics {
    // Обновляем метрики на основе текущего состояния пулов
    let totalConnections = 0;
    let activeConnections = 0;
    let idleConnections = 0;
    let maxConnections = 0;
    const poolMetricsByResolver: Record<string, any> = {};

    for (const [resolverId, pool] of this.connectionPools.entries()) {
      const active = pool.connections.filter(c => c.status === 'active').length;
      const idle = pool.connections.filter(c => c.status === 'idle').length;
      
      totalConnections += pool.currentSize;
      activeConnections += active;
      idleConnections += idle;
      maxConnections += pool.maxSize;

      poolMetricsByResolver[resolverId] = {
        poolSize: pool.maxSize,
        activeConnections: active,
        idleConnections: idle,
        utilization: pool.maxSize > 0 ? pool.currentSize / pool.maxSize : 0,
        totalRequests: pool.totalRequests,
        failedRequests: pool.failedRequests,
      };
    }

    // Обновляем среднее время ожидания
    if (this.connectionWaitTimes.length > 0) {
      const sum = this.connectionWaitTimes.reduce((a, b) => a + b, 0);
      this.connectionPoolMetrics.averageConnectionWaitTime = sum / this.connectionWaitTimes.length;
    }

    this.connectionPoolMetrics.totalConnections = totalConnections;
    this.connectionPoolMetrics.activeConnections = activeConnections;
    this.connectionPoolMetrics.idleConnections = idleConnections;
    this.connectionPoolMetrics.maxConnections = maxConnections;
    this.connectionPoolMetrics.connectionUtilization = maxConnections > 0 ? totalConnections / maxConnections : 0;
    this.connectionPoolMetrics.connectionFailureRate = 
      this.connectionPoolMetrics.totalConnectionAttempts > 0
        ? this.connectionPoolMetrics.failedConnectionAttempts / this.connectionPoolMetrics.totalConnectionAttempts
        : 0;
    this.connectionPoolMetrics.poolMetricsByResolver = poolMetricsByResolver;

    return { ...this.connectionPoolMetrics };
  }

  /**
   * Получить метрики load balancing
   */
  private getLoadBalancingMetrics(): LoadBalancingMetrics {
    const requestsByInstance: Record<string, number> = {};
    const instanceUtilization: Record<string, number> = {};
    const requestsByStrategy: Record<string, number> = {};

    for (const [resolverId, state] of this.loadBalancingState.entries()) {
      // Записываем запросы по инстансам
      for (const [instanceId, count] of state.requestsByInstance.entries()) {
        const key = `${resolverId}:${instanceId}`;
        requestsByInstance[key] = (requestsByInstance[key] || 0) + count;
      }

      // Записываем запросы по стратегии
      requestsByStrategy[state.strategy] = (requestsByStrategy[state.strategy] || 0) + state.totalRequests;

      // Рассчитываем utilization для каждого инстанса
      const resolver = this.config?.resolvers?.find(r => r.id === resolverId);
      if (resolver?.instances) {
        for (const instanceId of resolver.instances) {
          const connections = state.instanceConnections.get(instanceId) || 0;
          const requests = state.requestsByInstance.get(instanceId) || 0;
          const key = `${resolverId}:${instanceId}`;
          // Utilization = активные соединения / общее количество запросов (нормализовано)
          instanceUtilization[key] = Math.min(1, connections / Math.max(1, requests / 10));
        }
      }
    }

    // Рассчитываем коэффициент вариации для распределения нагрузки
    let averageLoadDistribution = 0;
    if (Object.keys(requestsByInstance).length > 0) {
      const values = Object.values(requestsByInstance);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      averageLoadDistribution = mean > 0 ? stdDev / mean : 0; // Coefficient of variation
    }

    this.loadBalancingMetrics.requestsByInstance = requestsByInstance;
    this.loadBalancingMetrics.instanceUtilization = instanceUtilization;
    this.loadBalancingMetrics.requestsByStrategy = requestsByStrategy;
    this.loadBalancingMetrics.averageLoadDistribution = averageLoadDistribution;

    return { ...this.loadBalancingMetrics };
  }
  
  /**
   * Обновить per-second метрики для rate limiting
   */
  private updateRateLimitMetricsPerSecond(): void {
    const now = Date.now();
    if (now - this.lastRateLimitSecondStart >= 1000) {
      this.rateLimitMetrics.blockedRequestsPerSecond = this.blockedRequestsThisSecond;
      this.rateLimitMetrics.rateLimitHitsPerSecond = this.rateLimitHitsThisSecond;
      this.blockedRequestsThisSecond = 0;
      this.rateLimitHitsThisSecond = 0;
      this.lastRateLimitSecondStart = now;
    }
  }
  
  /**
   * Обновить per-second метрики для таймаутов
   */
  private updateTimeoutMetricsPerSecond(): void {
    const now = Date.now();
    if (now - this.lastTimeoutSecondStart >= 1000) {
      this.timeoutMetrics.timeoutsPerSecond = this.timeoutsThisSecond;
      this.timeoutsThisSecond = 0;
      this.lastTimeoutSecondStart = now;
    }
  }
  
  /**
   * Получить метрики DataLoader
   */
  public getDataLoaderMetrics(): DataLoaderMetrics {
    return { ...this.dataLoaderMetrics };
  }
  
  /**
   * Получить обнаруженные N+1 проблемы
   */
  public getNPlusOneProblems(): NPlusOneProblem[] {
    return [...this.nPlusOneProblems];
  }

  /**
   * Получить метрики резолверов
   */
  public getResolverMetrics(): ResolverMetrics[] {
    return Array.from(this.resolverMetrics.values());
  }

  /**
   * Получить метрики конкретного резолвера
   */
  public getResolverMetricsById(resolverId: string): ResolverMetrics | undefined {
    return this.resolverMetrics.get(resolverId);
  }

  /**
   * Получить нагрузку для расчета метрик в EmulationEngine
   */
  public getLoad(): GraphQLLoad {
    const metrics = this.getGraphQLMetrics();
    const rps = this.config?.requestsPerSecond || 100;
    const baseLatency = this.config?.responseLatency || 50;
    
    // Рассчитываем utilization на основе throughput vs capacity
    const totalOpsPerSecond = metrics.queriesPerSecond + metrics.mutationsPerSecond;
    const cpuUtilization = Math.min(1, totalOpsPerSecond / rps);
    
    // Memory utilization зависит от количества активных подписок и размера кэша
    const memoryUtilization = Math.min(1, 
      (metrics.subscriptionsActive / 100) * 0.5 + // Подписки
      (this.queryCache.size / 1000) * 0.3 + // Кэш
      0.2 // Базовое использование
    );
    
    return {
      queriesPerSecond: metrics.queriesPerSecond,
      mutationsPerSecond: metrics.mutationsPerSecond,
      averageLatency: metrics.averageResponseTime || baseLatency,
      errorRate: metrics.errorRate,
      cpuUtilization,
      memoryUtilization,
    };
  }

  /**
   * Симуляция запросов (для расчета метрик без реальных запросов)
   */
  public simulateRequests(
    requestRate: number,
    nodes?: CanvasNode[],
    connections?: CanvasConnection[]
  ): void {
    if (requestRate <= 0) return;
    
    const now = Date.now();
    const deltaTime = now - (this.lastSecondStart || now);
    
    if (deltaTime <= 0) return;
    
    // Количество запросов за прошедшее время
    const requestsCount = Math.floor((requestRate * deltaTime) / 1000);
    
    if (requestsCount === 0) return;
    
    // Генерируем случайные запросы
    const sampleQueries = [
      'query { users { id name email } }',
      'query { user(id: "1") { id name email posts { id title } } }',
      'query { posts { id title author { name } } }',
    ];
    
    // Выполняем запросы (async, но в симуляции можем выполнять последовательно)
    for (let i = 0; i < requestsCount; i++) {
      const query = sampleQueries[Math.floor(Math.random() * sampleQueries.length)];
      // В симуляции выполняем синхронно для простоты
      // В реальной системе это было бы асинхронно
      const queryPromise = this.processQuery({ query }, nodes, connections);
      if (queryPromise instanceof Promise) {
        // Для симуляции ждем выполнения (в реальности это было бы через await)
        queryPromise.catch(() => {
          // Игнорируем ошибки в симуляции
        });
      }
    }
  }

  /**
   * Обновить конфигурацию
   */
  public updateConfig(config: Partial<GraphQLConfig>): void {
    if (!this.config) {
      this.config = {} as GraphQLConfig;
    }
    
    // Отслеживаем изменения схемы перед обновлением
    if (config.schema && this.config.schema) {
      this.detectSchemaChanges(config.schema);
    }
    
    this.config = { ...this.config, ...config };
    
    // Обновляем активные подписки если изменились настройки
    if (config.subscriptionsEnabled === false) {
      this.activeSubscriptions.clear();
      this.graphQLMetrics.subscriptionsActive = 0;
    }
    
    // Очищаем кэш если кэширование отключено
    if (config.enableCaching === false) {
      this.queryCache.clear();
    }
  }
  
  /**
   * Получить метрики introspection
   */
  public getIntrospectionMetrics(): IntrospectionMetrics {
    return { ...this.introspectionMetrics };
  }
  
  /**
   * Получить историю изменений схемы
   */
  public getSchemaChanges(limit?: number): SchemaChange[] {
    if (limit) {
      return this.schemaChanges.slice(-limit);
    }
    return [...this.schemaChanges];
  }
  
  /**
   * Получить версии схемы
   */
  public getSchemaVersions(limit?: number): SchemaVersion[] {
    if (limit) {
      return this.schemaVersions.slice(-limit);
    }
    return [...this.schemaVersions];
  }
  
  /**
   * Получить последнюю версию схемы
   */
  public getLatestSchemaVersion(): SchemaVersion | undefined {
    return this.schemaVersions.length > 0 
      ? this.schemaVersions[this.schemaVersions.length - 1]
      : undefined;
  }

  /**
   * Получить историю запросов
   */
  public getQueryHistory(limit?: number): GraphQLQuery[] {
    if (limit) {
      return this.queryHistory.slice(-limit);
    }
    return [...this.queryHistory];
  }

  /**
   * Получить активные подписки
   */
  public getActiveSubscriptions(): GraphQLSubscription[] {
    return Array.from(this.activeSubscriptions.values());
  }

  /**
   * Очистить метрики
   */
  public resetMetrics(): void {
    this.graphQLMetrics = {
      queriesPerSecond: 0,
      mutationsPerSecond: 0,
      subscriptionsActive: this.activeSubscriptions.size,
      averageResponseTime: 0,
      totalQueries: 0,
      totalMutations: 0,
      totalErrors: 0,
      errorRate: 0,
      cacheHitRate: 0,
      averageComplexity: 0,
      averageDepth: 0,
    };
    
    this.queryHistory = [];
    this.latencyHistory = [];
    this.complexityHistory = [];
    this.depthHistory = [];
    this.queriesThisSecond = 0;
    this.mutationsThisSecond = 0;
    this.lastSecondStart = Date.now();
    
    // Сбрасываем метрики rate limiting
    this.rateLimitMetrics = {
      totalBlockedRequests: 0,
      blockedRequestsPerSecond: 0,
      totalRateLimitHits: 0,
      rateLimitHitsPerSecond: 0,
      blockedByType: {
        queries: 0,
        mutations: 0,
        subscriptions: 0,
      },
    };
    this.blockedRequestsThisSecond = 0;
    this.rateLimitHitsThisSecond = 0;
    this.lastRateLimitSecondStart = Date.now();
    
    // Сбрасываем метрики таймаутов
    this.timeoutMetrics = {
      totalTimeouts: 0,
      timeoutsPerSecond: 0,
      queryTimeouts: 0,
      mutationTimeouts: 0,
      resolverTimeouts: 0,
    };
    this.timeoutsThisSecond = 0;
    this.lastTimeoutSecondStart = Date.now();
    this.timeoutDurations = [];
    
    // Сбрасываем метрики connection pooling
    this.connectionPoolMetrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      maxConnections: 0,
      connectionUtilization: 0,
      totalConnectionAttempts: 0,
      failedConnectionAttempts: 0,
      connectionFailureRate: 0,
      averageConnectionWaitTime: 0,
    };
    this.connectionWaitTimes = [];
    
    // Сбрасываем метрики connection health
    this.connectionHealthMetrics = {
      healthyConnections: 0,
      unhealthyConnections: 0,
      totalHealthChecks: 0,
      failedHealthChecks: 0,
      healthCheckFailureRate: 0,
      totalReconnects: 0,
      successfulReconnects: 0,
      failedReconnects: 0,
      reconnectSuccessRate: 0,
    };
    
    // Сбрасываем метрики load balancing
    this.loadBalancingMetrics = {
      totalRequests: 0,
      averageLoadDistribution: 0,
    };
    
    // Очищаем connection pools (но не удаляем их структуру)
    for (const pool of this.connectionPools.values()) {
      pool.connections = [];
      pool.currentSize = 0;
      pool.waitingQueue = [];
      pool.totalRequests = 0;
      pool.failedRequests = 0;
    }
    
    // Очищаем load balancing state
    for (const state of this.loadBalancingState.values()) {
      state.currentIndex = 0;
      state.instanceConnections.clear();
      state.totalRequests = 0;
      state.requestsByInstance.clear();
    }
    
    // Очищаем метрики DataLoader
    this.dataLoaderMetrics = {
      totalBatches: 0,
      totalRequests: 0,
      totalBatchedRequests: 0,
      averageBatchSize: 0,
      deduplicationRate: 0,
      cacheHitRate: 0,
      averageLatencyReduction: 0,
    };
    
    // Очищаем N+1 проблемы
    this.nPlusOneProblems = [];
    
    // Очищаем кэши DataLoader
    for (const dataLoader of this.dataLoaders.values()) {
      dataLoader.clearCache();
    }
    
    // Очищаем метрики подписок
    this.subscriptionMetrics = {
      totalEvents: 0,
      eventsPerSecond: 0,
      averageDeliveryLatency: 0,
      totalDeliveryErrors: 0,
      deliveryErrorRate: 0,
      lastEventTime: 0,
    };
    
    this.deliveryLatencyHistory = [];
    this.eventsThisSecond = 0;
    this.lastEventSecondStart = Date.now();
    this.subscriptionEvents = [];
    
    // Очищаем метрики batch запросов
    this.batchQueryMetrics = {
      totalBatches: 0,
      totalBatchRequests: 0,
      averageBatchSize: 0,
      averageBatchLatency: 0,
      totalBatchErrors: 0,
      batchErrorRate: 0,
    };
    
    this.batchLatencyHistory = [];
    
    // Очищаем persisted queries usage (но не сами persisted queries)
    this.persistedQueriesUsage = 0;
    
    // Очищаем метрики introspection
    this.introspectionMetrics = {
      totalIntrospectionQueries: 0,
      introspectionQueriesPerSecond: 0,
    };
    this.introspectionQueriesThisSecond = 0;
    this.lastIntrospectionSecondStart = Date.now();
    
    // Очищаем расширенные метрики
    this.fieldMetrics.clear();
    this.typeMetrics.clear();
    this.operationMetrics.clear();
    this.errorMetrics.clear();
    this.errorHistory = [];
    this.fieldCallsThisSecond.clear();
    this.typeOpsThisSecond.clear();
    this.operationCallsThisSecond.clear();
    this.errorCountsThisSecond.clear();
    this.lastMetricsSecondStart = Date.now();
  }
  
  /**
   * Получить field-level метрики
   */
  public getFieldMetrics(): FieldMetrics[] {
    return Array.from(this.fieldMetrics.values());
  }
  
  /**
   * Получить field-level метрики для конкретного поля
   */
  public getFieldMetricsByName(fieldName: string, typeName: string): FieldMetrics | undefined {
    const key = `${typeName}:${fieldName}`;
    return this.fieldMetrics.get(key);
  }
  
  /**
   * Получить type-level метрики
   */
  public getTypeMetrics(): TypeMetrics[] {
    return Array.from(this.typeMetrics.values());
  }
  
  /**
   * Получить type-level метрики для конкретного типа
   */
  public getTypeMetricsByName(typeName: 'Query' | 'Mutation' | 'Subscription'): TypeMetrics | undefined {
    return this.typeMetrics.get(typeName);
  }
  
  /**
   * Получить operation-level метрики
   */
  public getOperationMetrics(): OperationMetrics[] {
    return Array.from(this.operationMetrics.values());
  }
  
  /**
   * Получить operation-level метрики для конкретной операции
   */
  public getOperationMetricsByName(operationName: string): OperationMetrics | undefined {
    return this.operationMetrics.get(operationName);
  }
  
  /**
   * Получить error metrics
   */
  public getErrorMetrics(): ErrorMetrics[] {
    return Array.from(this.errorMetrics.values());
  }
  
  /**
   * Получить error metrics для конкретной категории
   */
  public getErrorMetricsByCategory(category: ErrorCategory): ErrorMetrics | undefined {
    return this.errorMetrics.get(category);
  }
  
  /**
   * Получить историю ошибок
   */
  public getErrorHistory(limit?: number): Array<{
    timestamp: number;
    category: ErrorCategory;
    message: string;
    operationName?: string;
    operationType?: 'query' | 'mutation' | 'subscription';
  }> {
    if (limit) {
      return this.errorHistory.slice(-limit);
    }
    return [...this.errorHistory];
  }
}


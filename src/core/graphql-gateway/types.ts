/**
 * Common types for GraphQL Gateway modules
 */

export interface GraphQLGatewayService {
  id: string;
  name: string;
  endpoint: string;
  status?: 'connected' | 'disconnected' | 'error';
  avgLatencyMs?: number;
  errorRate?: number;
}

export interface GraphQLGatewayFederationConfig {
  enabled: boolean;
  services: string[];
  supergraph?: string;
  version?: '1' | '2';
}

export interface GraphQLGatewayVariabilityConfig {
  /**
   * Множитель джиттера latency (0 = без джиттера).
   */
  latencyJitterMultiplier?: number;
  /**
   * Базовый уровень случайных ошибок поверх errorRate сервисов (0–1).
   */
  baseRandomErrorRate?: number;
  /**
   * Дополнительный overhead на федерацию (мс), который будет
   * добавляться к оценке плана.
   */
  federationOverheadMs?: number;
}

export interface GraphQLGatewayConfig {
  services?: GraphQLGatewayService[];
  federation?: GraphQLGatewayFederationConfig;

  // Cache / persisted queries
  cacheTtl?: number;
  persistQueries?: boolean;

  // Features
  subscriptions?: boolean;
  enableIntrospection?: boolean;
  enableQueryComplexityAnalysis?: boolean;
  enableRateLimiting?: boolean;

  // Limits
  maxQueryDepth?: number;
  maxQueryComplexity?: number;
  /**
   * Глобальный лимит запросов в минуту.
   */
  globalRateLimitPerMinute?: number;

  // Endpoint / identification
  endpoint?: string;

  // Контролируемая вариативность поведения
  variability?: GraphQLGatewayVariabilityConfig;
}

export interface GraphQLGatewayExecutionMetadata {
  /**
   * Оценка latency на этапе планирования (мс).
   */
  plannedLatency?: number;
  /**
   * Флаг, что ответ пришёл из кэша.
   */
  cacheHit?: boolean;
  /**
   * Флаг, что запрос был отклонён rate limiter'ом.
   */
  rateLimited?: boolean;
  /**
   * Флаг, что запрос был отклонён по ограничениям сложности/глубины.
   */
  complexityRejected?: boolean;
  /**
   * Сервисы, участвовавшие в выполнении запроса.
   */
  usedServices?: string[];
  /**
   * Признак, что запрос шёл через федерацию.
   */
  federated?: boolean;
}

export interface GraphQLGatewayRequest {
  query: string;
  variables?: Record<string, unknown>;
  headers?: Record<string, string>;
  operationName?: string;
}

export interface GraphQLGatewayResponse extends GraphQLGatewayExecutionMetadata {
  status: number;
  /**
   * Фактическая измеренная latency (мс).
   */
  latency: number;
  /**
   * Текст ошибки для неуспешных запросов.
   */
  error?: string;
}

export interface ParsedQuery {
  operationName?: string;
  operationType: 'query' | 'mutation' | 'subscription';
  fields: string[];
  depth: number;
  complexity: number;
  rawQuery: string;
}

export interface QueryPlan {
  subqueries: SubQuery[];
  requiresFederation: boolean;
  estimatedLatency: number;
}

export interface SubQuery {
  serviceId: string;
  serviceName: string;
  endpoint: string;
  query: string;
  fields: string[];
  estimatedLatency: number;
}

export interface ServiceRuntimeState {
  id: string;
  name: string;
  endpoint: string;
  avgLatencyMs: number;
  errorRate: number;
  status: 'connected' | 'disconnected' | 'error';
  rollingLatency: number[];
  rollingErrors: number[];
}

/**
 * Агрегированные метрики gateway, которые может хранить и обновлять
 * EmulationEngine для отображения в UI.
 */
export interface GraphQLGatewayMetrics {
  // Общие показатели
  requestsTotal: number;
  errorsTotal: number;
  rateLimitedTotal: number;
  complexityRejectedTotal: number;

  // Latency (мс)
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  averageLatency: number;

  // Кэш
  cacheHitCount: number;
  cacheMissCount: number;
  cacheSize: number;

  // Федерация
  federatedRequestCount: number;
  lastFederationStatus?: 'ok' | 'error' | 'degraded';

  // RPS
  requestsPerSecond: number;
}

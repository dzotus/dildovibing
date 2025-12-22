import { CanvasNode } from '@/types';
import { DataMessage } from './DataFlowEngine';

/**
 * Jaeger Span (OpenTracing format)
 */
export interface JaegerSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTime: number; // microseconds
  duration: number; // microseconds
  tags: Array<{ key: string; value: string | number | boolean }>;
  logs: Array<{ timestamp: number; fields: Array<{ key: string; value: string }> }>;
  references?: Array<{
    refType: 'CHILD_OF' | 'FOLLOWS_FROM';
    traceId: string;
    spanId: string;
  }>;
}

/**
 * Jaeger Trace (collection of spans)
 */
export interface JaegerTrace {
  traceId: string;
  spans: JaegerSpan[];
  startTime: number; // earliest span start time
  duration: number; // total trace duration
  serviceCount: number;
  spanCount: number;
  hasErrors: boolean;
  rootService?: string;
  rootOperation?: string;
}

/**
 * Trace Context (for propagation)
 */
export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled: boolean;
  baggage?: Record<string, string>;
}

/**
 * Sampling Decision
 */
export interface SamplingDecision {
  sample: boolean;
  tags?: Array<{ key: string; value: string }>;
}

/**
 * Jaeger Configuration
 */
export interface JaegerEmulationConfig {
  serverUrl?: string;
  agentEndpoint?: string;
  collectorEndpoint?: string;
  queryEndpoint?: string;
  samplingType?: 'probabilistic' | 'ratelimiting' | 'peroperation';
  samplingParam?: number; // probability (0-1) or rate limit (spans/sec)
  storageBackend?: 'elasticsearch' | 'cassandra' | 'kafka' | 'memory';
  storageUrl?: string;
  enableUIGraphQL?: boolean;
  enableMetrics?: boolean;
  metricsBackend?: 'prometheus' | 'statsd';
  metricsUrl?: string;
  maxTraces?: number; // max traces in storage
  traceTTL?: number; // TTL in milliseconds
}

/**
 * Service Statistics
 */
export interface ServiceStats {
  name: string;
  tracesTotal: number;
  errorsTotal: number;
  avgDuration: number; // microseconds
  spansTotal: number;
  lastTraceTime: number;
}

/**
 * Query Parameters
 */
export interface TraceQueryParams {
  service?: string;
  operation?: string;
  tags?: Record<string, string>;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

/**
 * Jaeger Metrics
 */
export interface JaegerMetrics {
  // Collector metrics
  spansReceivedTotal: number;
  spansDroppedTotal: number;
  spansProcessedTotal: number;
  samplingDecisionsTotal: number;
  samplingErrorsTotal: number;
  
  // Storage metrics
  tracesStoredTotal: number;
  tracesDroppedTotal: number;
  storageSizeBytes: number;
  
  // Query metrics
  queryRequestsTotal: number;
  queryErrorsTotal: number;
  queryDurationTotal: number;
  
  // Agent metrics
  spansSentTotal: number;
  spansFailedTotal: number;
}

/**
 * Jaeger Emulation Engine
 * Симулирует работу Jaeger: сбор трассировок, sampling, хранение, запросы, расчет нагрузки
 */
export class JaegerEmulationEngine {
  private config: JaegerEmulationConfig | null = null;
  
  // Storage: traces by traceId
  private traces: Map<string, JaegerTrace> = new Map();
  
  // Service statistics
  private serviceStats: Map<string, ServiceStats> = new Map();
  
  // Metrics
  private jaegerMetrics: JaegerMetrics = {
    spansReceivedTotal: 0,
    spansDroppedTotal: 0,
    spansProcessedTotal: 0,
    samplingDecisionsTotal: 0,
    samplingErrorsTotal: 0,
    tracesStoredTotal: 0,
    tracesDroppedTotal: 0,
    storageSizeBytes: 0,
    queryRequestsTotal: 0,
    queryErrorsTotal: 0,
    queryDurationTotal: 0,
    spansSentTotal: 0,
    spansFailedTotal: 0,
  };
  
  // Sampling state
  private samplingState: {
    probabilistic?: { probability: number };
    rateLimiting?: { maxTracesPerSecond: number; bucket: { tokens: number; lastRefill: number } };
    perOperation?: Map<string, { maxTracesPerSecond: number; bucket: { tokens: number; lastRefill: number } }>;
  } = {};
  
  // Query history
  private queryHistory: Array<{ params: TraceQueryParams; timestamp: number; duration: number; resultsCount: number }> = [];
  private readonly MAX_QUERY_HISTORY = 100;
  
  // Trace TTL cleanup
  private lastCleanupTime: number = 0;
  private readonly CLEANUP_INTERVAL = 60000; // 1 minute

  /**
   * Инициализирует конфигурацию Jaeger из конфига компонента
   */
  initializeConfig(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;
    
    this.config = {
      serverUrl: config.serverUrl || 'http://jaeger:16686',
      agentEndpoint: config.agentEndpoint || 'http://jaeger-agent:6831',
      collectorEndpoint: config.collectorEndpoint || 'http://jaeger-collector:14268',
      queryEndpoint: config.queryEndpoint || 'http://jaeger-query:16686',
      samplingType: config.samplingType || 'probabilistic',
      samplingParam: config.samplingParam ?? 0.001,
      storageBackend: config.storageBackend || 'elasticsearch',
      storageUrl: config.storageUrl || 'http://elasticsearch:9200',
      enableUIGraphQL: config.enableUIGraphQL ?? true,
      enableMetrics: config.enableMetrics ?? true,
      metricsBackend: config.metricsBackend || 'prometheus',
      metricsUrl: config.metricsUrl || 'http://prometheus:9090',
      maxTraces: config.maxTraces || 10000,
      traceTTL: config.traceTTL || 86400000, // 24 hours
    };
    
    // Инициализируем sampling state
    this.initializeSampling();
  }

  /**
   * Инициализирует sampling механизм
   */
  private initializeSampling(): void {
    if (!this.config) return;
    
    const { samplingType, samplingParam } = this.config;
    
    switch (samplingType) {
      case 'probabilistic':
        this.samplingState.probabilistic = {
          probability: Math.max(0, Math.min(1, samplingParam || 0.001)),
        };
        break;
        
      case 'ratelimiting':
        this.samplingState.rateLimiting = {
          maxTracesPerSecond: Math.max(1, samplingParam || 10),
          bucket: {
            tokens: samplingParam || 10,
            lastRefill: Date.now(),
          },
        };
        break;
        
      case 'peroperation':
        this.samplingState.perOperation = new Map();
        // Per-operation sampling требует конфигурации операций
        // Будет инициализироваться динамически при получении spans
        break;
    }
  }

  /**
   * Принимает span от Agent (симуляция получения от приложений)
   */
  receiveSpan(span: JaegerSpan): SamplingDecision {
    if (!this.config) {
      return { sample: false };
    }
    
    this.jaegerMetrics.spansReceivedTotal++;
    
    // Применяем sampling
    const decision = this.makeSamplingDecision(span);
    this.jaegerMetrics.samplingDecisionsTotal++;
    
    if (!decision.sample) {
      this.jaegerMetrics.spansDroppedTotal++;
      return decision;
    }
    
    // Обрабатываем span
    this.processSpan(span);
    
    return decision;
  }

  /**
   * Принимает spans от DataFlowEngine (на основе реальных запросов)
   */
  receiveSpansFromDataFlow(spans: JaegerSpan[]): void {
    for (const span of spans) {
      this.receiveSpan(span);
    }
  }

  /**
   * Применяет sampling к span
   */
  private makeSamplingDecision(span: JaegerSpan): SamplingDecision {
    if (!this.config) {
      return { sample: false };
    }
    
    const { samplingType } = this.config;
    
    try {
      switch (samplingType) {
        case 'probabilistic':
          return this.probabilisticSampling(span);
          
        case 'ratelimiting':
          return this.rateLimitingSampling(span);
          
        case 'peroperation':
          return this.perOperationSampling(span);
          
        default:
          return { sample: true };
      }
    } catch (error) {
      this.jaegerMetrics.samplingErrorsTotal++;
      return { sample: false };
    }
  }

  /**
   * Probabilistic sampling
   */
  private probabilisticSampling(span: JaegerSpan): SamplingDecision {
    const state = this.samplingState.probabilistic;
    if (!state) {
      return { sample: true };
    }
    
    const sample = Math.random() < state.probability;
    
    return {
      sample,
      tags: sample ? [{ key: 'sampler.type', value: 'probabilistic' }, { key: 'sampler.param', value: state.probability.toString() }] : undefined,
    };
  }

  /**
   * Rate limiting sampling
   */
  private rateLimitingSampling(span: JaegerSpan): SamplingDecision {
    const state = this.samplingState.rateLimiting;
    if (!state) {
      return { sample: true };
    }
    
    const now = Date.now();
    const elapsed = now - state.bucket.lastRefill;
    
    // Refill tokens (1 token per 1000ms / maxTracesPerSecond)
    const refillInterval = 1000 / state.maxTracesPerSecond;
    const tokensToAdd = Math.floor(elapsed / refillInterval);
    
    if (tokensToAdd > 0) {
      state.bucket.tokens = Math.min(state.maxTracesPerSecond, state.bucket.tokens + tokensToAdd);
      state.bucket.lastRefill = now;
    }
    
    if (state.bucket.tokens > 0) {
      state.bucket.tokens--;
      return {
        sample: true,
        tags: [{ key: 'sampler.type', value: 'ratelimiting' }, { key: 'sampler.param', value: state.maxTracesPerSecond.toString() }],
      };
    }
    
    return { sample: false };
  }

  /**
   * Per-operation sampling
   */
  private perOperationSampling(span: JaegerSpan): SamplingDecision {
    if (!this.samplingState.perOperation) {
      this.samplingState.perOperation = new Map();
    }
    
    const operationKey = `${span.serviceName}:${span.operationName}`;
    let operationState = this.samplingState.perOperation.get(operationKey);
    
    if (!operationState) {
      // Инициализируем с дефолтным лимитом
      const defaultLimit = this.config?.samplingParam || 10;
      operationState = {
        maxTracesPerSecond: defaultLimit,
        bucket: {
          tokens: defaultLimit,
          lastRefill: Date.now(),
        },
      };
      this.samplingState.perOperation.set(operationKey, operationState);
    }
    
    const now = Date.now();
    const elapsed = now - operationState.bucket.lastRefill;
    const refillInterval = 1000 / operationState.maxTracesPerSecond;
    const tokensToAdd = Math.floor(elapsed / refillInterval);
    
    if (tokensToAdd > 0) {
      operationState.bucket.tokens = Math.min(operationState.maxTracesPerSecond, operationState.bucket.tokens + tokensToAdd);
      operationState.bucket.lastRefill = now;
    }
    
    if (operationState.bucket.tokens > 0) {
      operationState.bucket.tokens--;
      return {
        sample: true,
        tags: [{ key: 'sampler.type', value: 'peroperation' }, { key: 'sampler.param', value: operationState.maxTracesPerSecond.toString() }],
      };
    }
    
    return { sample: false };
  }

  /**
   * Обрабатывает span (добавляет в trace, обновляет статистику)
   */
  private processSpan(span: JaegerSpan): void {
    this.jaegerMetrics.spansProcessedTotal++;
    
    // Находим или создаем trace
    let trace = this.traces.get(span.traceId);
    
    if (!trace) {
      trace = {
        traceId: span.traceId,
        spans: [],
        startTime: span.startTime,
        duration: span.duration,
        serviceCount: 0,
        spanCount: 0,
        hasErrors: false,
      };
      this.traces.set(span.traceId, trace);
      this.jaegerMetrics.tracesStoredTotal++;
    }
    
    // Добавляем span в trace
    trace.spans.push(span);
    trace.spanCount = trace.spans.length;
    
    // Обновляем время начала (если span раньше)
    if (span.startTime < trace.startTime) {
      trace.startTime = span.startTime;
    }
    
    // Обновляем общую длительность
    const traceEndTime = Math.max(...trace.spans.map(s => s.startTime + s.duration));
    trace.duration = traceEndTime - trace.startTime;
    
    // Определяем root span (без parentSpanId)
    if (!span.parentSpanId && !trace.rootService) {
      trace.rootService = span.serviceName;
      trace.rootOperation = span.operationName;
    }
    
    // Проверяем на ошибки
    const hasError = span.tags.some(tag => tag.key === 'error' && tag.value === true) ||
                     span.logs.some(log => log.fields.some(f => f.key === 'error'));
    if (hasError) {
      trace.hasErrors = true;
    }
    
    // Обновляем статистику сервисов
    this.updateServiceStats(span, trace);
    
    // Проверяем лимит traces
    if (this.config && this.traces.size > this.config.maxTraces!) {
      this.evictOldestTraces();
    }
  }

  /**
   * Обновляет статистику сервисов
   */
  private updateServiceStats(span: JaegerSpan, trace: JaegerTrace): void {
    let stats = this.serviceStats.get(span.serviceName);
    
    if (!stats) {
      stats = {
        name: span.serviceName,
        tracesTotal: 0,
        errorsTotal: 0,
        avgDuration: 0,
        spansTotal: 0,
        lastTraceTime: 0,
      };
      this.serviceStats.set(span.serviceName, stats);
    }
    
    stats.spansTotal++;
    stats.lastTraceTime = Math.max(stats.lastTraceTime, span.startTime / 1000); // convert to ms
    
    // Обновляем среднюю длительность
    const totalDuration = stats.avgDuration * (stats.spansTotal - 1) + span.duration;
    stats.avgDuration = totalDuration / stats.spansTotal;
    
    // Если это новый trace для этого сервиса
    if (trace.spans.length === 1 || trace.spans[0].serviceName === span.serviceName) {
      stats.tracesTotal++;
      
      if (trace.hasErrors) {
        stats.errorsTotal++;
      }
    }
  }

  /**
   * Удаляет старые traces (TTL и лимит)
   */
  private evictOldestTraces(): void {
    if (!this.config) return;
    
    const now = Date.now() * 1000; // convert to microseconds
    const ttl = this.config.traceTTL! * 1000; // convert to microseconds
    const maxTraces = this.config.maxTraces!;
    
    const tracesToDelete: string[] = [];
    
    // Собираем traces для удаления (TTL)
    for (const [traceId, trace] of this.traces.entries()) {
      const traceAge = now - trace.startTime;
      if (traceAge > ttl) {
        tracesToDelete.push(traceId);
      }
    }
    
    // Если все еще превышаем лимит, удаляем самые старые
    if (this.traces.size - tracesToDelete.length > maxTraces) {
      const sortedTraces = Array.from(this.traces.entries())
        .filter(([id]) => !tracesToDelete.includes(id))
        .sort(([, a], [, b]) => a.startTime - b.startTime);
      
      const toDelete = sortedTraces.slice(0, this.traces.size - tracesToDelete.length - maxTraces);
      tracesToDelete.push(...toDelete.map(([id]) => id));
    }
    
    // Удаляем traces
    for (const traceId of tracesToDelete) {
      const trace = this.traces.get(traceId);
      if (trace) {
        // Обновляем статистику сервисов
        for (const span of trace.spans) {
          const stats = this.serviceStats.get(span.serviceName);
          if (stats) {
            stats.tracesTotal = Math.max(0, stats.tracesTotal - 1);
            if (trace.hasErrors) {
              stats.errorsTotal = Math.max(0, stats.errorsTotal - 1);
            }
          }
        }
        
        // Обновляем метрики storage
        const traceSize = this.calculateTraceSize(trace);
        this.jaegerMetrics.storageSizeBytes = Math.max(0, this.jaegerMetrics.storageSizeBytes - traceSize);
        this.jaegerMetrics.tracesDroppedTotal++;
        
        this.traces.delete(traceId);
      }
    }
  }

  /**
   * Выполняет cleanup старых traces (периодически)
   */
  performCleanup(currentTime: number): void {
    if (currentTime - this.lastCleanupTime < this.CLEANUP_INTERVAL) {
      return;
    }
    
    this.lastCleanupTime = currentTime;
    this.evictOldestTraces();
  }

  /**
   * Выполняет запрос трассировок (Query Service)
   */
  queryTraces(params: TraceQueryParams): {
    traces: JaegerTrace[];
    total: number;
    limit: number;
    errors?: string[];
  } {
    const startTime = performance.now();
    this.jaegerMetrics.queryRequestsTotal++;
    
    try {
      let results = Array.from(this.traces.values());
      
      // Фильтруем по service
      if (params.service) {
        results = results.filter(trace =>
          trace.spans.some(span => span.serviceName === params.service)
        );
      }
      
      // Фильтруем по operation
      if (params.operation) {
        results = results.filter(trace =>
          trace.spans.some(span => span.operationName === params.operation)
        );
      }
      
      // Фильтруем по tags
      if (params.tags) {
        results = results.filter(trace =>
          trace.spans.some(span =>
            Object.entries(params.tags!).every(([key, value]) =>
              span.tags.some(tag => tag.key === key && String(tag.value) === String(value))
            )
          )
        );
      }
      
      // Фильтруем по времени
      if (params.startTime) {
        const startTimeUs = params.startTime * 1000; // convert to microseconds
        results = results.filter(trace => trace.startTime >= startTimeUs);
      }
      
      if (params.endTime) {
        const endTimeUs = params.endTime * 1000; // convert to microseconds
        results = results.filter(trace => trace.startTime + trace.duration <= endTimeUs);
      }
      
      // Сортируем по времени (новые первыми)
      results.sort((a, b) => b.startTime - a.startTime);
      
      // Применяем лимит
      const limit = params.limit || 20;
      const total = results.length;
      results = results.slice(0, limit);
      
      const duration = performance.now() - startTime;
      this.jaegerMetrics.queryDurationTotal += duration;
      
      // Сохраняем в историю
      this.queryHistory.push({ params, timestamp: Date.now(), duration, resultsCount: results.length });
      if (this.queryHistory.length > this.MAX_QUERY_HISTORY) {
        this.queryHistory.shift();
      }
      
      return {
        traces: results,
        total,
        limit,
      };
    } catch (error) {
      this.jaegerMetrics.queryErrorsTotal++;
      return {
        traces: [],
        total: 0,
        limit: params.limit || 20,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Получает статистику сервисов
   */
  getServiceStats(): ServiceStats[] {
    return Array.from(this.serviceStats.values());
  }

  /**
   * Получает последние traces
   */
  getRecentTraces(limit: number = 20): JaegerTrace[] {
    const traces = Array.from(this.traces.values());
    traces.sort((a, b) => b.startTime - a.startTime);
    return traces.slice(0, limit);
  }

  /**
   * Получает trace по ID
   */
  getTraceById(traceId: string): JaegerTrace | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Получает метрики Jaeger
   */
  getJaegerMetrics(): JaegerMetrics {
    return { ...this.jaegerMetrics };
  }

  /**
   * Рассчитывает размер trace в байтах (приблизительно)
   */
  private calculateTraceSize(trace: JaegerTrace): number {
    let size = 0;
    
    for (const span of trace.spans) {
      size += 100; // базовый размер span
      size += span.operationName.length;
      size += span.serviceName.length;
      size += span.tags.length * 50; // приблизительно
      size += span.logs.length * 100; // приблизительно
    }
    
    return size;
  }

  /**
   * Рассчитывает нагрузку на Jaeger
   */
  calculateLoad(): {
    spansPerSecond: number;
    tracesPerSecond: number;
    samplingRate: number;
    storageUtilization: number;
    queryLatency: number;
    errorRate: number;
  } {
    const totalSpans = this.jaegerMetrics.spansReceivedTotal;
    const totalTraces = this.jaegerMetrics.tracesStoredTotal;
    const droppedSpans = this.jaegerMetrics.spansDroppedTotal;
    const totalQueries = this.jaegerMetrics.queryRequestsTotal;
    const totalQueryDuration = this.jaegerMetrics.queryDurationTotal;
    const queryErrors = this.jaegerMetrics.queryErrorsTotal;
    
    // Упрощенный расчет (в реальности нужен временной интервал)
    const samplingRate = totalSpans > 0 ? 1 - (droppedSpans / totalSpans) : 0;
    const queryLatency = totalQueries > 0 ? totalQueryDuration / totalQueries : 0;
    const errorRate = totalQueries > 0 ? queryErrors / totalQueries : 0;
    
    // Storage utilization (процент от maxTraces)
    const maxTraces = this.config?.maxTraces || 10000;
    const storageUtilization = this.traces.size / maxTraces;
    
    // Приблизительные значения per second (нужен реальный временной интервал)
    const spansPerSecond = totalSpans / 60; // предполагаем 1 минуту работы
    const tracesPerSecond = totalTraces / 60;
    
    return {
      spansPerSecond,
      tracesPerSecond,
      samplingRate,
      storageUtilization,
      queryLatency,
      errorRate,
    };
  }

  /**
   * Получает конфигурацию
   */
  getConfig(): JaegerEmulationConfig | null {
    return this.config ? { ...this.config } : null;
  }
}



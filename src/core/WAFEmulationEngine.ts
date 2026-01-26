import { CanvasNode } from '@/types';
import { WAFRoutingEngine, WAFConfig, WAFStats, WAFThreat } from './WAFRoutingEngine';

/**
 * WAF Emulation Config (синхронизирован с WAFConfigAdvanced / SECURITY_PROFILES)
 */
export interface WAFEmulationConfig {
  mode?: 'detection' | 'prevention' | 'logging';
  enableOWASP?: boolean;
  owaspRuleset?: string;
  enableRateLimiting?: boolean;
  rateLimitPerMinute?: number;
  rateLimitStrategy?: 'fixed-window' | 'sliding-window' | 'token-bucket';
  rateLimitBurst?: number;
  enableGeoBlocking?: boolean;
  blockedCountries?: string[];
  enableIPWhitelist?: boolean;
  whitelistedIPs?: string[];
  ipBlacklist?: string[];
  enableDDoSProtection?: boolean;
  ddosThreshold?: number;
  rules?: Array<{
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    action: 'allow' | 'block' | 'log' | 'challenge';
    priority: number;
    conditions?: Array<{
      type: 'ip' | 'uri' | 'header' | 'body' | 'method' | 'country' | 'user-agent';
      operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'in' | 'not-in';
      value: string;
    }>;
  }>;
  // API Shield functions
  schemaValidation?: {
    enabled: boolean;
    schemaType: 'json-schema' | 'openapi';
    schema: string;
    validateRequest: boolean;
    validateResponse: boolean;
  };
  jwtValidation?: {
    enabled: boolean;
    secret?: string;
    publicKey?: string;
    algorithm?: 'HS256' | 'RS256' | 'ES256';
    issuer?: string;
    audience?: string[];
    requireExpiration?: boolean;
  };
  apiKeyValidation?: {
    enabled: boolean;
    keys: Array<{
      id: string;
      key: string;
      enabled: boolean;
      allowedPaths?: string[];
      rateLimit?: number;
    }>;
    headerName?: string;
  };
  graphQLProtection?: {
    enabled: boolean;
    maxDepth?: number;
    maxComplexity?: number;
    maxAliases?: number;
    blockIntrospection?: boolean;
  };
  // Real functions
  botDetection?: {
    enabled: boolean;
    methods: Array<'user-agent' | 'behavioral' | 'fingerprint'>;
    blockKnownBots?: boolean;
    challengeSuspicious?: boolean;
  };
  anomalyDetection?: {
    enabled: boolean;
    threshold?: number;
    windowSize?: number;
  };
}

/**
 * Внутренние метрики WAF
 */
export interface WAFEngineMetrics {
  requestsTotal: number;
  requestsAllowed: number;
  requestsBlocked: number;
  threatsDetected: number;
  threatsBlocked: number;
  rateLimitHits: number;
  geoBlockHits: number;
  ipBlockHits: number;
  owaspHits: number;
  customRuleHits: number;
  activeRules: number;
  averageLatency: number;
}

/**
 * Агрегированные показатели нагрузки для EmulationEngine
 */
export interface WAFLoad {
  requestsPerSecond: number;
  averageLatency: number;
  errorRate: number;
  blockRate: number;
  threatDetectionRate: number;
}

/**
 * WAF Emulation Engine
 * Симулирует работу WAF: фильтрация запросов, обнаружение угроз, расчет метрик.
 */
export class WAFEmulationEngine {
  private config: WAFEmulationConfig | null = null;
  private routingEngine: WAFRoutingEngine;

  private metrics: WAFEngineMetrics = {
    requestsTotal: 0,
    requestsAllowed: 0,
    requestsBlocked: 0,
    threatsDetected: 0,
    threatsBlocked: 0,
    rateLimitHits: 0,
    geoBlockHits: 0,
    ipBlockHits: 0,
    owaspHits: 0,
    customRuleHits: 0,
    activeRules: 0,
    averageLatency: 0,
  };

  // Для оценки RPS и средней латентности
  private firstRequestTime: number | null = null;
  private lastRequestTime: number | null = null;
  private latencyHistory: number[] = [];
  private readonly MAX_LATENCY_HISTORY = 200;

  // Симуляция входящих запросов (для расчета метрик без реальных запросов)
  private simulatedRequestRate: number = 0;
  private lastSimulationTime: number = Date.now();

  constructor() {
    this.routingEngine = new WAFRoutingEngine();
  }

  /**
   * Инициализация конфигурации из узла WAF
   */
  public initializeConfig(node: CanvasNode): void {
    const raw = (node.data.config || {}) as any;

    this.config = {
      mode: raw.mode || 'detection',
      enableOWASP: raw.enableOWASP ?? true,
      owaspRuleset: raw.owaspRuleset || '3.3',
      enableRateLimiting: raw.enableRateLimiting ?? true,
      rateLimitPerMinute: raw.rateLimitPerMinute || 100,
      rateLimitStrategy: raw.rateLimitStrategy || 'fixed-window',
      rateLimitBurst: raw.rateLimitBurst || (raw.rateLimitPerMinute || 100),
      enableGeoBlocking: raw.enableGeoBlocking ?? false,
      blockedCountries: Array.isArray(raw.blockedCountries) ? raw.blockedCountries : [],
      enableIPWhitelist: raw.enableIPWhitelist ?? false,
      whitelistedIPs: Array.isArray(raw.whitelistedIPs) ? raw.whitelistedIPs : [],
      ipBlacklist: Array.isArray(raw.ipBlacklist) ? raw.ipBlacklist : [],
      enableDDoSProtection: raw.enableDDoSProtection ?? true,
      ddosThreshold: raw.ddosThreshold || 1000,
      rules: Array.isArray(raw.rules) ? raw.rules : [],
      // API Shield functions
      schemaValidation: raw.schemaValidation,
      jwtValidation: raw.jwtValidation,
      apiKeyValidation: raw.apiKeyValidation,
      graphQLProtection: raw.graphQLProtection,
      // Real functions
      botDetection: raw.botDetection,
      anomalyDetection: raw.anomalyDetection,
    };

    // Инициализируем routing engine
    this.routingEngine.initializeConfig(node);

    // Обновляем метрики
    this.updateMetricsFromStats();
  }

  /**
   * Обработка запроса через WAF (вызывается из DataFlowEngine)
   */
  public processRequest(request: {
    path: string;
    method: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: unknown;
    sourceIP?: string;
    country?: string;
    userAgent?: string;
  }): {
    success: boolean;
    blocked: boolean;
    latency: number;
    threatDetected?: boolean;
    error?: string;
  } {
    const startTime = performance.now();

    // Создаем WAF request
    // Используем реальные данные из сообщения, без генерации случайных значений
    const wafRequest = {
      path: request.path || '/',
      method: request.method || 'GET',
      headers: request.headers,
      query: request.query,
      body: request.body,
      sourceIP: request.sourceIP || '0.0.0.0', // Fallback вместо генерации случайного IP
      country: request.country, // undefined если не указано - не генерируем случайную страну
      userAgent: request.userAgent || 'Mozilla/5.0',
      timestamp: Date.now(),
    };

    // Обрабатываем через routing engine
    const response = this.routingEngine.processRequest(wafRequest);

    const latency = performance.now() - startTime + response.latency;

    // Обновляем историю латентности
    this.recordLatency(latency);

    // Обновляем метрики
    this.metrics.requestsTotal++;
    if (response.allowed) {
      this.metrics.requestsAllowed++;
    } else {
      this.metrics.requestsBlocked++;
      if (response.blocked) {
        this.metrics.threatsBlocked++;
      }
    }

    if (response.threatDetected) {
      this.metrics.threatsDetected++;
      const stats = this.routingEngine.getStats();
      this.metrics.rateLimitHits = stats.rateLimitHits;
      this.metrics.geoBlockHits = stats.geoBlockHits;
      this.metrics.ipBlockHits = stats.ipBlockHits;
      this.metrics.owaspHits = stats.owaspHits;
      this.metrics.customRuleHits = stats.threatsDetected - stats.owaspHits - stats.rateLimitHits - stats.geoBlockHits - stats.ipBlockHits;
    }

    // Обновляем временные метки
    const now = Date.now();
    if (!this.firstRequestTime) {
      this.firstRequestTime = now;
    }
    this.lastRequestTime = now;

    return {
      success: response.allowed,
      blocked: response.blocked,
      latency,
      threatDetected: !!response.threatDetected,
      error: response.error,
    };
  }

  /**
   * Симуляция обработки запросов (для расчета метрик без реальных запросов)
   * УДАЛЕНО: generateRandomRequest - используем только реальные запросы из потока данных
   * Если нет реальных запросов, метрики будут рассчитываться на основе нагрузки из upstream компонентов
   */
  public simulateRequests(requestRate: number): void {
    // Сохраняем скорость запросов для расчета метрик
    this.simulatedRequestRate = requestRate;
    
    // Не генерируем случайные запросы - используем только реальные из потока данных
    // Метрики будут рассчитываться на основе реальной нагрузки
    this.updateMetricsFromStats();
  }

  /**
   * Запись латентности в историю
   */
  private recordLatency(latency: number): void {
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > this.MAX_LATENCY_HISTORY) {
      this.latencyHistory.shift();
    }

    // Обновляем среднюю латентность
    const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
    this.metrics.averageLatency = sum / this.latencyHistory.length;
  }

  /**
   * Обновление метрик из stats routing engine
   */
  private updateMetricsFromStats(): void {
    const stats = this.routingEngine.getStats();
    this.metrics.requestsTotal = stats.totalRequests;
    this.metrics.requestsAllowed = stats.allowedRequests;
    this.metrics.requestsBlocked = stats.blockedRequests;
    this.metrics.threatsDetected = stats.threatsDetected;
    this.metrics.rateLimitHits = stats.rateLimitHits;
    this.metrics.geoBlockHits = stats.geoBlockHits;
    this.metrics.ipBlockHits = stats.ipBlockHits;
    this.metrics.owaspHits = stats.owaspHits;
    this.metrics.activeRules = stats.activeRules;
    this.metrics.customRuleHits = stats.threatsDetected - stats.owaspHits - stats.rateLimitHits - stats.geoBlockHits - stats.ipBlockHits;
  }

  /**
   * Расчет нагрузки на основе метрик
   */
  public calculateLoad(): WAFLoad {
    const now = Date.now();
    let requestsPerSecond = 0;

    if (this.firstRequestTime && this.lastRequestTime && this.lastRequestTime > this.firstRequestTime) {
      const timeWindow = (this.lastRequestTime - this.firstRequestTime) / 1000; // seconds
      if (timeWindow > 0) {
        requestsPerSecond = this.metrics.requestsTotal / timeWindow;
      }
    }

    // Если нет реальных запросов, используем симулированную скорость
    if (requestsPerSecond === 0 && this.simulatedRequestRate > 0) {
      requestsPerSecond = this.simulatedRequestRate;
    }

    const averageLatency = this.metrics.averageLatency || 5; // default 5ms

    // Error rate = блокированные запросы / общее количество
    const errorRate = this.metrics.requestsTotal > 0
      ? this.metrics.requestsBlocked / this.metrics.requestsTotal
      : 0;

    // Block rate = процент заблокированных запросов
    const blockRate = this.metrics.requestsTotal > 0
      ? this.metrics.requestsBlocked / this.metrics.requestsTotal
      : 0;

    // Threat detection rate = процент обнаруженных угроз
    const threatDetectionRate = this.metrics.requestsTotal > 0
      ? this.metrics.threatsDetected / this.metrics.requestsTotal
      : 0;

    return {
      requestsPerSecond,
      averageLatency,
      errorRate,
      blockRate,
      threatDetectionRate,
    };
  }

  /**
   * Получить метрики
   */
  public getMetrics(): WAFEngineMetrics {
    return { ...this.metrics };
  }

  /**
   * Получить конфигурацию
   */
  public getConfig(): WAFEmulationConfig | null {
    return this.config;
  }

  /**
   * Получить угрозы
   */
  public getThreats(limit: number = 100): WAFThreat[] {
    return this.routingEngine.getThreats(limit);
  }

  /**
   * Получить статистику
   */
  public getStats(): WAFStats {
    return this.routingEngine.getStats();
  }

  /**
   * Установить симулированную скорость запросов
   */
  public setSimulatedRequestRate(rate: number): void {
    this.simulatedRequestRate = rate;
  }

  /**
   * Сброс метрик
   */
  public resetMetrics(): void {
    this.metrics = {
      requestsTotal: 0,
      requestsAllowed: 0,
      requestsBlocked: 0,
      threatsDetected: 0,
      threatsBlocked: 0,
      rateLimitHits: 0,
      geoBlockHits: 0,
      ipBlockHits: 0,
      owaspHits: 0,
      customRuleHits: 0,
      activeRules: this.metrics.activeRules,
      averageLatency: 0,
    };
    this.latencyHistory = [];
    this.firstRequestTime = null;
    this.lastRequestTime = null;
    this.routingEngine.resetStats();
  }
}


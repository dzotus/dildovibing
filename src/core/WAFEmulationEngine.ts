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
  enableGeoBlocking?: boolean;
  blockedCountries?: string[];
  enableIPWhitelist?: boolean;
  whitelistedIPs?: string[];
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
      enableGeoBlocking: raw.enableGeoBlocking ?? false,
      blockedCountries: Array.isArray(raw.blockedCountries) ? raw.blockedCountries : [],
      enableIPWhitelist: raw.enableIPWhitelist ?? false,
      whitelistedIPs: Array.isArray(raw.whitelistedIPs) ? raw.whitelistedIPs : [],
      enableDDoSProtection: raw.enableDDoSProtection ?? true,
      ddosThreshold: raw.ddosThreshold || 1000,
      rules: Array.isArray(raw.rules) ? raw.rules : [],
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
    const wafRequest = {
      path: request.path || '/',
      method: request.method || 'GET',
      headers: request.headers,
      query: request.query,
      body: request.body,
      sourceIP: request.sourceIP || this.generateRandomIP(),
      country: request.country || this.generateRandomCountry(),
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
   */
  public simulateRequests(requestRate: number): void {
    const now = Date.now();
    const deltaTime = now - this.lastSimulationTime;
    this.lastSimulationTime = now;

    if (deltaTime <= 0 || requestRate <= 0) {
      return;
    }

    // Количество запросов за прошедшее время
    const requestsCount = Math.floor((requestRate * deltaTime) / 1000);

    if (requestsCount === 0) {
      return;
    }

    // Генерируем случайные запросы
    for (let i = 0; i < requestsCount; i++) {
      const request = this.generateRandomRequest();
      this.processRequest(request);
    }

    // Обновляем метрики из stats
    this.updateMetricsFromStats();
  }

  /**
   * Генерация случайного запроса для симуляции
   */
  private generateRandomRequest(): {
    path: string;
    method: string;
    headers?: Record<string, string>;
    body?: unknown;
    sourceIP?: string;
    country?: string;
    userAgent?: string;
  } {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    const paths = ['/api/users', '/api/products', '/api/orders', '/api/auth', '/api/data'];
    const countries = ['US', 'GB', 'DE', 'FR', 'CN', 'RU', 'JP'];
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    ];

    // Иногда генерируем подозрительные запросы (для симуляции угроз)
    const isSuspicious = Math.random() < 0.05; // 5% подозрительных запросов

    let path = paths[Math.floor(Math.random() * paths.length)];
    let body: unknown = null;

    if (isSuspicious) {
      // SQL injection attempt
      if (Math.random() < 0.5) {
        path += "?id=1' OR '1'='1";
        body = { query: "SELECT * FROM users WHERE id = '1' OR '1'='1'" };
      } else {
        // XSS attempt
        body = { content: '<script>alert("XSS")</script>' };
      }
    } else {
      // Нормальный запрос
      if (Math.random() < 0.3) {
        body = { data: Math.random().toString(36).substring(7) };
      }
    }

    return {
      path,
      method: methods[Math.floor(Math.random() * methods.length)],
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
      },
      body,
      sourceIP: this.generateRandomIP(),
      country: countries[Math.floor(Math.random() * countries.length)],
      userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
    };
  }

  /**
   * Генерация случайного IP адреса
   */
  private generateRandomIP(): string {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  /**
   * Генерация случайной страны
   */
  private generateRandomCountry(): string {
    const countries = ['US', 'GB', 'DE', 'FR', 'CN', 'RU', 'JP', 'BR', 'IN', 'AU'];
    return countries[Math.floor(Math.random() * countries.length)];
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


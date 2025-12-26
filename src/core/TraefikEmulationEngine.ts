import { CanvasNode } from '@/types';
import { 
  TraefikRoutingEngine, 
  TraefikRouter, 
  TraefikService, 
  TraefikMiddleware, 
  TraefikEntryPoint,
  TraefikRequest,
  TraefikStats
} from './TraefikRoutingEngine';

/**
 * Traefik Emulation Config (синхронизирован с TraefikConfigAdvanced)
 */
export interface TraefikEmulationConfig {
  routers?: TraefikRouter[];
  services?: TraefikService[];
  middlewares?: TraefikMiddleware[];
  entryPoints?: TraefikEntryPoint[];
  enableDashboard?: boolean;
  enableAPI?: boolean;
  autoDiscoverServices?: boolean;
  maxConnections?: number;
  idleTimeout?: number;
  responseTimeout?: number;
}

/**
 * Внутренние метрики Traefik
 */
export interface TraefikEngineMetrics {
  requestsTotal: number;
  responsesTotal: number;
  errorsTotal: number;
  activeRouters: number;
  totalRouters: number;
  totalServices: number;
  totalMiddlewares: number;
  totalServers: number;
  healthyServers: number;
  activeConnections: number;
  totalBytesIn: number;
  totalBytesOut: number;
  averageLatency: number;
  errorRate: number;
}

/**
 * Агрегированные показатели нагрузки для EmulationEngine
 */
export interface TraefikLoad {
  requestsPerSecond: number;
  averageLatency: number;
  errorRate: number;
  utilization: number;
}

/**
 * Traefik Emulation Engine
 * Симулирует работу Traefik: маршрутизация запросов, балансировка нагрузки, применение middlewares.
 */
export class TraefikEmulationEngine {
  private config: TraefikEmulationConfig | null = null;
  private routingEngine: TraefikRoutingEngine;

  private metrics: TraefikEngineMetrics = {
    requestsTotal: 0,
    responsesTotal: 0,
    errorsTotal: 0,
    activeRouters: 0,
    totalRouters: 0,
    totalServices: 0,
    totalMiddlewares: 0,
    totalServers: 0,
    healthyServers: 0,
    activeConnections: 0,
    totalBytesIn: 0,
    totalBytesOut: 0,
    averageLatency: 0,
    errorRate: 0,
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
    this.routingEngine = new TraefikRoutingEngine();
  }

  /**
   * Инициализация конфигурации из узла Traefik
   */
  public initializeConfig(node: CanvasNode): void {
    const raw = (node.data.config || {}) as any;

    // Преобразуем конфигурацию из UI формата в формат роутинга
    const routers: TraefikRouter[] = Array.isArray(raw.routers) 
      ? raw.routers.map((r: any) => ({
          id: r.id || r.name,
          name: r.name,
          rule: r.rule || `Host(\`${r.name || 'example.com'}\`)`,
          service: r.service,
          entryPoints: Array.isArray(r.entryPoints) ? r.entryPoints : ['web'],
          middlewares: Array.isArray(r.middlewares) ? r.middlewares : [],
          tls: r.tls ? { enabled: r.tls === true || r.tls.enabled === true } : undefined,
          priority: r.priority || 0,
          requests: r.requests || 0,
          responses: r.responses || 0,
          errors: r.errors || 0,
        }))
      : [];

    const services: TraefikService[] = Array.isArray(raw.services)
      ? raw.services.map((s: any) => ({
          id: s.id || s.name,
          name: s.name,
          loadBalancer: {
            servers: Array.isArray(s.servers) 
              ? s.servers.map((server: any) => ({
                  url: server.url || server.address || `http://localhost:8080`,
                  weight: server.weight || 1,
                }))
              : s.url 
                ? [{ url: s.url, weight: 1 }]
                : [],
            strategy: s.loadBalancer || 'roundRobin',
            healthCheck: s.healthCheck?.enabled ? {
              enabled: true,
              path: s.healthCheck.path || '/health',
              interval: s.healthCheck.interval || 10,
              timeout: s.healthCheck.timeout || 5,
            } : undefined,
          },
          totalRequests: s.totalRequests || 0,
          totalResponses: s.totalResponses || 0,
        }))
      : [];

    const middlewares: TraefikMiddleware[] = Array.isArray(raw.middlewares)
      ? raw.middlewares.map((m: any) => ({
          id: m.id || m.name,
          name: m.name,
          type: m.type || 'headers',
          config: m.config || {},
        }))
      : [];

    const entryPoints: TraefikEntryPoint[] = Array.isArray(raw.entryPoints)
      ? raw.entryPoints.map((ep: string | TraefikEntryPoint) => 
          typeof ep === 'string'
            ? { name: ep, address: ep.includes(':') ? ep : `:${ep === 'web' ? '80' : ep === 'websecure' ? '443' : '80'}` }
            : ep
        )
      : [
          { name: 'web', address: ':80' },
          { name: 'websecure', address: ':443' },
        ];

    this.config = {
      routers,
      services,
      middlewares,
      entryPoints,
      enableDashboard: raw.enableDashboard ?? true,
      enableAPI: raw.enableAPI ?? true,
      autoDiscoverServices: raw.autoDiscoverServices ?? true,
      maxConnections: raw.maxConnections || 10000,
      idleTimeout: raw.idleTimeout || 180000,
      responseTimeout: raw.responseTimeout || 30000,
    };

    // Инициализируем routing engine
    this.routingEngine.initialize({
      routers,
      services,
      middlewares,
      entryPoints,
      globalConfig: {
        maxConnections: this.config.maxConnections,
        idleTimeout: this.config.idleTimeout,
        responseTimeout: this.config.responseTimeout,
      },
    });

    // Обновляем метрики
    this.updateMetricsFromStats();
  }

  /**
   * Обработка запроса через Traefik (вызывается из DataFlowEngine)
   */
  public processRequest(request: {
    path: string;
    method: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: unknown;
    clientIP?: string;
    protocol?: 'http' | 'https';
    host?: string;
    entryPoint?: string;
  }): {
    success: boolean;
    latency: number;
    status: number;
    serviceTarget?: string;
    serverTarget?: string;
    routerMatched?: string;
    error?: string;
  } {
    const startTime = performance.now();

    // Создаем Traefik request
    const traefikRequest: TraefikRequest = {
      path: request.path || '/',
      method: request.method || 'GET',
      headers: request.headers,
      query: request.query,
      body: request.body,
      clientIP: request.clientIP || this.generateRandomIP(),
      protocol: request.protocol || 'http',
      host: request.host || request.headers?.['Host'] || 'localhost',
      entryPoint: request.entryPoint || 'web',
    };

    // Обрабатываем через routing engine
    const routingResult = this.routingEngine.routeRequest(traefikRequest);

    const latency = performance.now() - startTime + (routingResult.response.latency || 0);

    // Обновляем историю латентности
    this.recordLatency(latency);

    // Обновляем временные метки
    const now = Date.now();
    if (!this.firstRequestTime) {
      this.firstRequestTime = now;
    }
    this.lastRequestTime = now;

    // Обновляем метрики
    this.updateMetricsFromStats();

    return {
      success: routingResult.response.status >= 200 && routingResult.response.status < 400,
      latency,
      status: routingResult.response.status,
      serviceTarget: routingResult.response.serviceTarget,
      serverTarget: routingResult.response.serverTarget,
      routerMatched: routingResult.response.routerMatched,
      error: routingResult.response.error,
    };
  }

  /**
   * Обновление метрик из статистики роутинга
   */
  private updateMetricsFromStats(): void {
    const stats = this.routingEngine.getStats();
    
    this.metrics.requestsTotal = stats.totalRequests;
    this.metrics.responsesTotal = stats.totalResponses;
    this.metrics.activeRouters = stats.activeRouters;
    this.metrics.totalRouters = stats.routers;
    this.metrics.totalServices = stats.services;
    this.metrics.totalMiddlewares = stats.middlewares;
    this.metrics.totalServers = stats.totalServers;
    this.metrics.healthyServers = stats.healthyServers;
    this.metrics.activeConnections = stats.activeConnections;
    this.metrics.totalBytesIn = stats.totalBytesIn;
    this.metrics.totalBytesOut = stats.totalBytesOut;
    this.metrics.averageLatency = stats.averageLatency;
    this.metrics.errorRate = stats.errorRate;
    
    // Подсчитываем ошибки
    this.metrics.errorsTotal = Math.floor(stats.totalRequests * stats.errorRate);
  }

  /**
   * Получить метрики для EmulationEngine
   */
  public getMetrics(): TraefikEngineMetrics {
    return { ...this.metrics };
  }

  /**
   * Получить статистику роутинга
   */
  public getStats(): TraefikStats {
    return this.routingEngine.getStats();
  }

  /**
   * Получить нагрузку для расчета метрик в EmulationEngine
   */
  public getLoad(): TraefikLoad {
    const stats = this.getStats();
    const maxConnections = this.config?.maxConnections || 10000;
    
    // Рассчитываем RPS из времени между запросами или используем симулированное значение
    let requestsPerSecond = this.simulatedRequestRate;
    
    if (this.firstRequestTime && this.lastRequestTime) {
      const timeSpan = (this.lastRequestTime - this.firstRequestTime) / 1000; // seconds
      if (timeSpan > 0) {
        requestsPerSecond = stats.totalRequests / timeSpan;
      }
    }

    // Используем симулированное значение если нет реальных запросов
    if (requestsPerSecond === 0 && this.simulatedRequestRate > 0) {
      requestsPerSecond = this.simulatedRequestRate;
    }

    // Utilization = активные соединения / максимальные соединения
    const utilization = maxConnections > 0 
      ? Math.min(1, stats.activeConnections / maxConnections)
      : 0;

    return {
      requestsPerSecond,
      averageLatency: stats.averageLatency || 0,
      errorRate: stats.errorRate || 0,
      utilization,
    };
  }

  /**
   * Симуляция запросов (для расчета метрик когда нет реальных запросов)
   */
  public simulateRequests(ratePerSecond: number): void {
    this.simulatedRequestRate = ratePerSecond;
    const now = Date.now();
    const timeDelta = (now - this.lastSimulationTime) / 1000; // seconds
    this.lastSimulationTime = now;

    if (ratePerSecond <= 0 || timeDelta <= 0) {
      return;
    }

    // Генерируем запросы с заданной частотой
    const requestsToGenerate = Math.floor(ratePerSecond * timeDelta);
    
    for (let i = 0; i < requestsToGenerate; i++) {
      const randomPath = this.generateRandomPath();
      const randomMethod = ['GET', 'POST', 'PUT', 'DELETE'][Math.floor(Math.random() * 4)];
      
      this.processRequest({
        path: randomPath,
        method: randomMethod,
        headers: {
          'Host': 'example.com',
          'User-Agent': 'Mozilla/5.0',
        },
        clientIP: this.generateRandomIP(),
        protocol: Math.random() > 0.5 ? 'https' : 'http',
        host: 'example.com',
        entryPoint: Math.random() > 0.5 ? 'websecure' : 'web',
      });
    }
  }

  /**
   * Записать латентность в историю
   */
  private recordLatency(latency: number): void {
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > this.MAX_LATENCY_HISTORY) {
      this.latencyHistory.shift();
    }
  }

  /**
   * Генерация случайного IP
   */
  private generateRandomIP(): string {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  /**
   * Генерация случайного пути
   */
  private generateRandomPath(): string {
    const paths = ['/', '/api', '/api/users', '/api/products', '/health', '/status', '/docs'];
    return paths[Math.floor(Math.random() * paths.length)];
  }

  /**
   * Обновить конфигурацию (вызывается при изменении конфига в UI)
   */
  public updateConfig(node: CanvasNode): void {
    this.initializeConfig(node);
  }

  /**
   * Сброс статистики
   */
  public resetStats(): void {
    this.routingEngine.resetStats();
    this.firstRequestTime = null;
    this.lastRequestTime = null;
    this.latencyHistory = [];
    this.updateMetricsFromStats();
  }
}


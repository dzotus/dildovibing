/**
 * CDN Emulation Engine
 * Simulates CDN behavior: caching, edge locations, distributions, metrics
 */

import { CanvasNode } from '@/types';
import { 
  CDNRoutingEngine, 
  CDNDistribution, 
  EdgeLocation,
  CDNStats 
} from './CDNRoutingEngine';

/**
 * CDN Emulation Config (синхронизирован с CDNConfigAdvanced)
 */
export interface CDNEmulationConfig {
  cdnProvider?: 'cloudflare' | 'cloudfront' | 'fastly' | 'akamai';
  distributions?: CDNDistribution[];
  edgeLocations?: EdgeLocation[];
  enableCaching?: boolean;
  cacheTTL?: number;
  enableCompression?: boolean;
  compressionType?: 'gzip' | 'brotli' | 'zstd';
  enableSSL?: boolean;
  enableHTTP2?: boolean;
  enableHTTP3?: boolean;
  enablePurge?: boolean;
  enableGeoRouting?: boolean;
  enableDDoSProtection?: boolean;
  defaultTTL?: number;
  maxTTL?: number;
  cachePolicy?: 'cache-first' | 'origin-first' | 'bypass';
}

/**
 * Внутренние метрики CDN
 */
export interface CDNEngineMetrics {
  totalDistributions: number;
  activeDistributions: number;
  totalEdgeLocations: number;
  activeEdgeLocations: number;
  totalRequests: number;
  totalCacheHits: number;
  totalCacheMisses: number;
  totalBandwidth: number; // bytes
  averageCacheHitRate: number;
  averageLatency: number;
  requestsPerSecond: number;
  bandwidthPerSecond: number; // bytes/sec
  errorRate: number;
}

/**
 * Агрегированные показатели нагрузки для EmulationEngine
 */
export interface CDNLoad {
  requestsPerSecond: number;
  bandwidthPerSecond: number;
  averageLatency: number;
  errorRate: number;
  utilization: number;
  cacheHitRate: number;
}

/**
 * CDN Emulation Engine
 * Симулирует работу CDN: кэширование, edge locations, distributions
 */
export class CDNEmulationEngine {
  private config: CDNEmulationConfig | null = null;
  private routingEngine: CDNRoutingEngine;

  private metrics: CDNEngineMetrics = {
    totalDistributions: 0,
    activeDistributions: 0,
    totalEdgeLocations: 0,
    activeEdgeLocations: 0,
    totalRequests: 0,
    totalCacheHits: 0,
    totalCacheMisses: 0,
    totalBandwidth: 0,
    averageCacheHitRate: 0,
    averageLatency: 0,
    requestsPerSecond: 0,
    bandwidthPerSecond: 0,
    errorRate: 0,
  };

  // Симуляция входящих запросов (для расчета метрик без реальных запросов)
  private simulatedRequestRate: number = 0;
  private lastSimulationTime: number = Date.now();

  constructor() {
    this.routingEngine = new CDNRoutingEngine();
  }

  /**
   * Инициализация конфигурации из узла CDN
   */
  public initializeConfig(node: CanvasNode): void {
    const raw = (node.data.config || {}) as any;

    this.config = {
      cdnProvider: raw.cdnProvider || 'cloudflare',
      distributions: Array.isArray(raw.distributions) ? raw.distributions : [],
      edgeLocations: Array.isArray(raw.edgeLocations) ? raw.edgeLocations : [],
      enableCaching: raw.enableCaching ?? true,
      cacheTTL: raw.cacheTTL || 3600,
      enableCompression: raw.enableCompression ?? true,
      compressionType: raw.compressionType || 'gzip',
      enableSSL: raw.enableSSL ?? true,
      enableHTTP2: raw.enableHTTP2 ?? true,
      enableHTTP3: raw.enableHTTP3 ?? false,
      enablePurge: raw.enablePurge ?? true,
      enableGeoRouting: raw.enableGeoRouting ?? false,
      enableDDoSProtection: raw.enableDDoSProtection ?? true,
      defaultTTL: raw.defaultTTL || 3600,
      maxTTL: raw.maxTTL || 86400,
      cachePolicy: raw.cachePolicy || 'cache-first',
    };

    // Инициализируем routing engine
    this.routingEngine.initializeConfig(node);

    // Обновляем метрики
    this.updateMetricsFromStats();
  }

  /**
   * Обработка запроса через CDN (вызывается из DataFlowEngine)
   */
  public processRequest(request: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS';
    path: string;
    domain: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: any;
    clientIP?: string;
    userAgent?: string;
  }): {
    success: boolean;
    cacheHit: boolean;
    latency: number;
    error?: string;
    size: number;
  } {
    const startTime = performance.now();

    const cdnRequest = {
      id: `req-${Date.now()}-${Math.random()}`,
      method: request.method,
      path: request.path,
      domain: request.domain,
      headers: request.headers,
      query: request.query,
      body: request.body,
      clientIP: request.clientIP,
      userAgent: request.userAgent,
      timestamp: Date.now(),
    };

    const response = this.routingEngine.processRequest(cdnRequest);

    const latency = performance.now() - startTime;

    // Обновляем метрики
    this.updateMetricsFromStats();

    return {
      success: response.status < 400,
      cacheHit: response.cacheHit,
      latency: response.latency,
      error: response.status >= 400 ? `HTTP ${response.status}` : undefined,
      size: response.size,
    };
  }

  /**
   * Получить конфигурацию
   */
  public getConfig(): CDNEmulationConfig | null {
    return this.config ? { ...this.config } : null;
  }

  /**
   * Получить метрики
   */
  public getMetrics(): CDNEngineMetrics {
    return { ...this.metrics };
  }

  /**
   * Получить routing engine (для DataFlowEngine)
   */
  public getRoutingEngine(): CDNRoutingEngine {
    return this.routingEngine;
  }

  /**
   * Рассчитать нагрузку для EmulationEngine
   */
  public calculateLoad(): CDNLoad {
    const stats = this.routingEngine.getStats();
    const distributions = this.routingEngine.getDistributions();
    const edgeLocations = this.routingEngine.getEdgeLocations();

    // Requests per second
    const requestsPerSecond = stats.requestsPerSecond || this.simulatedRequestRate;

    // Bandwidth per second
    const bandwidthPerSecond = stats.bandwidthPerSecond || (requestsPerSecond * 1024); // Estimate 1KB per request

    // Average latency
    const averageLatency = stats.averageLatency || 50;

    // Error rate
    const errorRate = stats.errorRate || 0;

    // Cache hit rate
    const cacheHitRate = stats.averageCacheHitRate || 0;

    // Utilization based on:
    // - Active distributions vs total
    // - Active edge locations vs total
    // - Request rate vs capacity
    const activeDistributions = distributions.filter(d => d.status === 'deployed').length;
    const totalDistributions = distributions.length || 1;
    const distributionUtilization = activeDistributions / totalDistributions;

    const activeEdgeLocations = edgeLocations.filter(l => l.status === 'active').length;
    const totalEdgeLocations = edgeLocations.length || 1;
    const edgeLocationUtilization = activeEdgeLocations / totalEdgeLocations;

    // Capacity utilization (requests vs edge location capacity)
    const totalCapacity = edgeLocations.reduce((sum, loc) => sum + (loc.capacity || 10000), 0);
    const capacityUtilization = totalCapacity > 0
      ? Math.min(1, requestsPerSecond / totalCapacity)
      : 0;

    // Overall utilization
    const utilization = Math.min(0.95,
      0.1 + // Base utilization
      distributionUtilization * 0.2 +
      edgeLocationUtilization * 0.2 +
      capacityUtilization * 0.5
    );

    return {
      requestsPerSecond,
      bandwidthPerSecond,
      averageLatency,
      errorRate,
      utilization,
      cacheHitRate,
    };
  }

  /**
   * Обновить метрики из статистики routing engine
   */
  private updateMetricsFromStats(): void {
    const stats = this.routingEngine.getStats();
    const distributions = this.routingEngine.getDistributions();
    const edgeLocations = this.routingEngine.getEdgeLocations();

    this.metrics = {
      totalDistributions: distributions.length,
      activeDistributions: distributions.filter(d => d.status === 'deployed').length,
      totalEdgeLocations: edgeLocations.length,
      activeEdgeLocations: edgeLocations.filter(l => l.status === 'active').length,
      totalRequests: stats.totalRequests,
      totalCacheHits: stats.totalCacheHits,
      totalCacheMisses: stats.totalCacheMisses,
      totalBandwidth: stats.totalBandwidth,
      averageCacheHitRate: stats.averageCacheHitRate,
      averageLatency: stats.averageLatency,
      requestsPerSecond: stats.requestsPerSecond,
      bandwidthPerSecond: stats.bandwidthPerSecond,
      errorRate: stats.errorRate,
    };
  }

  /**
   * Симулировать входящий трафик (для расчета метрик без реальных запросов)
   */
  public simulateIncomingTraffic(requestRate: number): void {
    this.simulatedRequestRate = requestRate;
    this.lastSimulationTime = Date.now();

    // Generate simulated requests
    if (requestRate > 0) {
      const distributions = this.routingEngine.getDistributions();
      const activeDistributions = distributions.filter(d => d.status === 'deployed');

      if (activeDistributions.length > 0) {
        // Simulate requests across distributions
        const requestsPerDistribution = requestRate / activeDistributions.length;

        for (const dist of activeDistributions) {
          // Simulate GET requests (cacheable)
          const getRequests = Math.floor(requestsPerDistribution * 0.8); // 80% GET
          for (let i = 0; i < getRequests; i++) {
            this.routingEngine.processRequest({
              id: `sim-${Date.now()}-${Math.random()}`,
              method: 'GET',
              path: `/api/resource/${Math.floor(Math.random() * 100)}`,
              domain: dist.domain,
              timestamp: Date.now(),
              clientIP: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            });
          }

          // Simulate POST requests (non-cacheable)
          const postRequests = Math.floor(requestsPerDistribution * 0.2); // 20% POST
          for (let i = 0; i < postRequests; i++) {
            this.routingEngine.processRequest({
              id: `sim-${Date.now()}-${Math.random()}`,
              method: 'POST',
              path: '/api/update',
              domain: dist.domain,
              timestamp: Date.now(),
              clientIP: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            });
          }
        }
      }
    }
  }

  /**
   * Purge cache
   */
  public purgeCache(distributionId?: string, path?: string): number {
    return this.routingEngine.purgeCache(distributionId, path);
  }

  /**
   * Получить distributions
   */
  public getDistributions(): CDNDistribution[] {
    return this.routingEngine.getDistributions();
  }

  /**
   * Получить edge locations
   */
  public getEdgeLocations(): EdgeLocation[] {
    return this.routingEngine.getEdgeLocations();
  }
}


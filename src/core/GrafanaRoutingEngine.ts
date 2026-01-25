import { CanvasNode, CanvasConnection } from '@/types';
import { GrafanaPanelQuery, GrafanaDataSource } from './GrafanaEmulationEngine';
import { ServiceDiscovery } from '@/services/connection/ServiceDiscovery';
import { PrometheusEmulationEngine } from './PrometheusEmulationEngine';
import { PromQLEvaluator } from './PromQLEvaluator';
import { ComponentMetrics } from './EmulationEngine';
import { DataFlowEngine, DataMessage } from './DataFlowEngine';

/**
 * Результат маршрутизации query
 */
export interface GrafanaQueryResult {
  success: boolean;
  latency: number;
  data?: any;
  error?: string;
  cacheHit?: boolean;
}

/**
 * Grafana Routing Engine
 * Маршрутизирует HTTP запросы от Grafana к datasources (Prometheus, Loki и т.д.)
 */
export class GrafanaRoutingEngine {
  private serviceDiscovery: ServiceDiscovery;
  private grafanaNode: CanvasNode;
  private allNodes: CanvasNode[] = [];
  private connections: CanvasConnection[] = [];
  private dataFlowEngine?: DataFlowEngine; // Для визуализации HTTP запросов
  
  // Кэш для queries (в реальности Grafana кэширует результаты)
  private queryCache: Map<string, {
    data: any;
    timestamp: number;
    ttl: number;
  }> = new Map();
  
  // Round-robin счетчики для балансировки нагрузки между множественными instances
  private prometheusRoundRobinIndex: Map<string, number> = new Map(); // datasource URL -> index
  private lokiRoundRobinIndex: Map<string, number> = new Map(); // datasource URL -> index
  
  // Функция для выполнения Prometheus queries
  private executePrometheusQuery?: (
    prometheusNodeId: string,
    query: string,
    queryType: 'instant' | 'range',
    timeRange?: { from: number; to: number; step?: number }
  ) => Promise<{ success: boolean; data?: any; latency: number; error?: string }>;
  
  // Функция для выполнения Loki queries
  private executeLokiQuery?: (
    lokiNodeId: string,
    query: string,
    startTime?: number,
    endTime?: number,
    limit?: number
  ) => Promise<{ success: boolean; data?: any; latency: number; error?: string }>;

  constructor(
    serviceDiscovery: ServiceDiscovery,
    grafanaNode: CanvasNode
  ) {
    this.serviceDiscovery = serviceDiscovery;
    this.grafanaNode = grafanaNode;
  }

  /**
   * Обновляет список nodes и connections (вызывается из EmulationEngine)
   */
  updateNodesAndConnections(nodes: CanvasNode[], connections: CanvasConnection[]): void {
    this.allNodes = nodes;
    this.connections = connections;
  }

  /**
   * Устанавливает DataFlowEngine для визуализации HTTP запросов
   */
  setDataFlowEngine(dataFlowEngine: DataFlowEngine): void {
    this.dataFlowEngine = dataFlowEngine;
  }

  /**
   * Устанавливает функцию для выполнения Prometheus queries
   */
  setPrometheusQueryExecutor(
    executor: (
      prometheusNodeId: string,
      query: string,
      queryType: 'instant' | 'range',
      timeRange?: { from: number; to: number; step?: number }
    ) => Promise<{ success: boolean; data?: any; latency: number; error?: string }>
  ): void {
    this.executePrometheusQuery = executor;
  }

  /**
   * Устанавливает функцию для выполнения Loki queries
   */
  setLokiQueryExecutor(
    executor: (
      lokiNodeId: string,
      query: string,
      startTime?: number,
      endTime?: number,
      limit?: number
    ) => Promise<{ success: boolean; data?: any; latency: number; error?: string }>
  ): void {
    this.executeLokiQuery = executor;
  }

  /**
   * Маршрутизирует query к datasource
   */
  async routeQuery(
    query: GrafanaPanelQuery,
    datasource: GrafanaDataSource,
    timeRange?: { from: number; to: number; step?: number },
    isRangeQuery: boolean = false
  ): Promise<GrafanaQueryResult> {
    const startTime = Date.now();

    // Проверяем кэш (для instant queries)
    if (!isRangeQuery) {
      const cacheKey = this.getCacheKey(query, datasource);
      const cached = this.queryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        return {
          success: true,
          latency: 5, // Кэш hit - очень быстрый ответ
          data: cached.data,
          cacheHit: true,
        };
      }
    }

    // Маршрутизируем в зависимости от типа datasource
    let result: GrafanaQueryResult;
    
    switch (datasource.type) {
      case 'prometheus':
        result = await this.routePrometheusQuery(query, datasource, timeRange, isRangeQuery);
        break;
      case 'loki':
        result = await this.routeLokiQuery(query, datasource, timeRange);
        break;
      default:
        result = {
          success: false,
          latency: Date.now() - startTime,
          error: `Unsupported datasource type: ${datasource.type}`,
        };
    }

    // Кэшируем результат (только для instant queries)
    if (result.success && !isRangeQuery && result.data) {
      const cacheKey = this.getCacheKey(query, datasource);
      const ttl = 5000; // 5 секунд TTL для кэша
      this.queryCache.set(cacheKey, {
        data: result.data,
        timestamp: Date.now(),
        ttl,
      });
    }

    return result;
  }

  /**
   * Маршрутизирует Prometheus query
   */
  private async routePrometheusQuery(
    query: GrafanaPanelQuery,
    datasource: GrafanaDataSource,
    timeRange?: { from: number; to: number; step?: number },
    isRangeQuery: boolean = false
  ): Promise<GrafanaQueryResult> {
    const startTime = Date.now();

    // Находим Prometheus node по URL datasource
    const prometheusNode = this.findPrometheusNode(datasource);
    if (!prometheusNode) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: `Prometheus node not found for datasource: ${datasource.url}`,
      };
    }

    // Находим connection между Grafana и Prometheus
    const connection = this.connections.find(
      c => (c.source === this.grafanaNode.id && c.target === prometheusNode.id) ||
           (c.source === prometheusNode.id && c.target === this.grafanaNode.id)
    );

    // Получаем latency соединения
    const connectionLatency = connection?.data?.latency || 0;

    // Выполняем query через Prometheus executor
    if (!this.executePrometheusQuery) {
      return {
        success: false,
        latency: Date.now() - startTime + connectionLatency,
        error: 'Prometheus query executor not set',
      };
    }

    try {
      const queryType = isRangeQuery ? 'range' : 'instant';
      
      // Создаем визуализацию HTTP запроса (если DataFlowEngine доступен)
      if (this.dataFlowEngine) {
        const queryUrl = isRangeQuery 
          ? `/api/v1/query_range?query=${encodeURIComponent(query.expr)}&start=${timeRange?.from || Date.now() - 3600000}&end=${timeRange?.to || Date.now()}&step=${timeRange?.step || 15}`
          : `/api/v1/query?query=${encodeURIComponent(query.expr)}&time=${timeRange?.to || Date.now()}`;
        
        const queryPayload = JSON.stringify({
          query: query.expr,
          queryType,
          timeRange,
        });
        
        this.dataFlowEngine.addMessage({
          source: this.grafanaNode.id,
          target: prometheusNode.id,
          format: 'json',
          payload: queryPayload,
          size: queryPayload.length,
          metadata: {
            contentType: 'application/json',
            operation: `Prometheus ${queryType} query`,
            query: query.expr,
            url: queryUrl,
          },
          latency: connectionLatency,
        });
      }
      
      const result = await this.executePrometheusQuery(
        prometheusNode.id,
        query.expr,
        queryType,
        timeRange
      );

      // Общая latency = latency соединения + latency выполнения query
      const totalLatency = connectionLatency + result.latency;

      // Создаем визуализацию ответа (если DataFlowEngine доступен)
      if (this.dataFlowEngine && result.success) {
        const responsePayload = JSON.stringify(result.data || {});
        this.dataFlowEngine.addMessage({
          source: prometheusNode.id,
          target: this.grafanaNode.id,
          format: 'json',
          payload: responsePayload,
          size: responsePayload.length,
          metadata: {
            contentType: 'application/json',
            operation: `Prometheus ${queryType} response`,
            query: query.expr,
          },
          latency: result.latency,
        });
      }

      return {
        success: result.success,
        latency: totalLatency,
        data: result.data,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime + connectionLatency,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Маршрутизирует Loki query
   */
  private async routeLokiQuery(
    query: GrafanaPanelQuery,
    datasource: GrafanaDataSource,
    timeRange?: { from: number; to: number; step?: number }
  ): Promise<GrafanaQueryResult> {
    const startTime = Date.now();

    // Находим Loki node по URL datasource
    const lokiNode = this.findLokiNode(datasource);
    if (!lokiNode) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: `Loki node not found for datasource: ${datasource.url}`,
      };
    }

    // Находим connection между Grafana и Loki
    const connection = this.connections.find(
      c => (c.source === this.grafanaNode.id && c.target === lokiNode.id) ||
           (c.source === lokiNode.id && c.target === this.grafanaNode.id)
    );

    // Получаем latency соединения
    const connectionLatency = connection?.data?.latency || 0;

    // Выполняем query через Loki executor
    if (!this.executeLokiQuery) {
      return {
        success: false,
        latency: Date.now() - startTime + connectionLatency,
        error: 'Loki query executor not set',
      };
    }

    try {
      const startTimeMs = timeRange?.from || Date.now() - 3600000; // Last hour by default
      const endTimeMs = timeRange?.to || Date.now();
      const limit = 100; // Default limit

      // Создаем визуализацию HTTP запроса (если DataFlowEngine доступен)
      if (this.dataFlowEngine) {
        const queryUrl = `/loki/api/v1/query_range?query=${encodeURIComponent(query.expr)}&start=${startTimeMs}&end=${endTimeMs}&limit=${limit}`;
        
        const queryPayload = JSON.stringify({
          query: query.expr,
          startTime: startTimeMs,
          endTime: endTimeMs,
          limit,
        });
        
        this.dataFlowEngine.addMessage({
          source: this.grafanaNode.id,
          target: lokiNode.id,
          format: 'json',
          payload: queryPayload,
          size: queryPayload.length,
          metadata: {
            contentType: 'application/json',
            operation: 'Loki query',
            query: query.expr,
            url: queryUrl,
          },
          latency: connectionLatency,
        });
      }

      const result = await this.executeLokiQuery(
        lokiNode.id,
        query.expr,
        startTimeMs,
        endTimeMs,
        limit
      );

      // Общая latency = latency соединения + latency выполнения query
      const totalLatency = connectionLatency + result.latency;

      // Создаем визуализацию ответа (если DataFlowEngine доступен)
      if (this.dataFlowEngine && result.success) {
        const responsePayload = JSON.stringify(result.data || {});
        this.dataFlowEngine.addMessage({
          source: lokiNode.id,
          target: this.grafanaNode.id,
          format: 'json',
          payload: responsePayload,
          size: responsePayload.length,
          metadata: {
            contentType: 'application/json',
            operation: 'Loki response',
            query: query.expr,
          },
          latency: result.latency,
        });
      }

      return {
        success: result.success,
        latency: totalLatency,
        data: result.data,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime + connectionLatency,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Находит Prometheus node по URL datasource с поддержкой балансировки нагрузки
   */
  private findPrometheusNode(datasource: GrafanaDataSource): CanvasNode | null {
    // Проверяем placeholder URL (для миграции старого формата)
    if (datasource.url.startsWith('prometheus://')) {
      // Placeholder URL - ищем любой доступный Prometheus node
      // Имя datasource может быть в URL после prometheus://
      const datasourceName = datasource.url.replace('prometheus://', '');
      
      // Собираем все Prometheus nodes для балансировки
      const allPrometheusNodes = this.allNodes.filter(node => node.type === 'prometheus');
      
      if (allPrometheusNodes.length === 0) {
        return null;
      }
      
      // Если только один node, возвращаем его
      if (allPrometheusNodes.length === 1) {
        return allPrometheusNodes[0];
      }
      
      // Балансировка нагрузки: round-robin
      const cacheKey = datasource.url || datasourceName || 'default';
      const currentIndex = this.prometheusRoundRobinIndex.get(cacheKey) || 0;
      const selectedNode = allPrometheusNodes[currentIndex % allPrometheusNodes.length];
      
      // Обновляем индекс для следующего запроса
      this.prometheusRoundRobinIndex.set(cacheKey, (currentIndex + 1) % allPrometheusNodes.length);
      
      return selectedNode;
    }
    
    // Парсим обычный URL datasource
    let targetHost: string | null = null;
    let targetPort: number | null = null;

    try {
      const url = new URL(datasource.url);
      targetHost = url.hostname;
      targetPort = parseInt(url.port) || 9090; // Default Prometheus port
    } catch {
      // Если не валидный URL, пытаемся извлечь host:port напрямую
      const match = datasource.url.match(/^https?:\/\/([^\/]+)/);
      if (match) {
        const parts = match[1].split(':');
        targetHost = parts[0];
        targetPort = parts[1] ? parseInt(parts[1]) : 9090;
      }
    }

    // Собираем все подходящие Prometheus nodes
    const matchingNodes: CanvasNode[] = [];
    
    for (const node of this.allNodes) {
      if (node.type === 'prometheus') {
        const host = this.serviceDiscovery.getHost(node);
        const port = this.serviceDiscovery.getPort(node, 'main');
        
        if (targetHost && targetPort) {
          // Сравниваем host и port
          if (host === targetHost && port === targetPort) {
            matchingNodes.push(node);
          }
        } else {
          // Если не можем распарсить URL, добавляем все Prometheus nodes для балансировки
          matchingNodes.push(node);
        }
      }
    }

    if (matchingNodes.length === 0) {
      return null;
    }

    // Если только один node, возвращаем его
    if (matchingNodes.length === 1) {
      return matchingNodes[0];
    }

    // Балансировка нагрузки: round-robin между множественными instances
    const cacheKey = datasource.url || 'default';
    const currentIndex = this.prometheusRoundRobinIndex.get(cacheKey) || 0;
    const selectedNode = matchingNodes[currentIndex % matchingNodes.length];
    
    // Обновляем индекс для следующего запроса
    this.prometheusRoundRobinIndex.set(cacheKey, (currentIndex + 1) % matchingNodes.length);
    
    return selectedNode;
  }

  /**
   * Находит Loki node по URL datasource с поддержкой балансировки нагрузки
   */
  private findLokiNode(datasource: GrafanaDataSource): CanvasNode | null {
    // Парсим URL datasource
    let targetHost: string | null = null;
    let targetPort: number | null = null;

    try {
      const url = new URL(datasource.url);
      targetHost = url.hostname;
      targetPort = parseInt(url.port) || 3100; // Default Loki port
    } catch {
      // Если не валидный URL, пытаемся извлечь host:port напрямую
      const match = datasource.url.match(/^https?:\/\/([^\/]+)/);
      if (match) {
        const parts = match[1].split(':');
        targetHost = parts[0];
        targetPort = parts[1] ? parseInt(parts[1]) : 3100;
      }
    }

    // Собираем все подходящие Loki nodes
    const matchingNodes: CanvasNode[] = [];
    
    for (const node of this.allNodes) {
      if (node.type === 'loki') {
        const host = this.serviceDiscovery.getHost(node);
        const port = this.serviceDiscovery.getPort(node, 'main');
        
        if (targetHost && targetPort) {
          // Сравниваем host и port
          if (host === targetHost && port === targetPort) {
            matchingNodes.push(node);
          }
        } else {
          // Если не можем распарсить URL, добавляем все Loki nodes для балансировки
          matchingNodes.push(node);
        }
      }
    }

    if (matchingNodes.length === 0) {
      return null;
    }

    // Если только один node, возвращаем его
    if (matchingNodes.length === 1) {
      return matchingNodes[0];
    }

    // Балансировка нагрузки: round-robin между множественными instances
    const cacheKey = datasource.url || 'default';
    const currentIndex = this.lokiRoundRobinIndex.get(cacheKey) || 0;
    const selectedNode = matchingNodes[currentIndex % matchingNodes.length];
    
    // Обновляем индекс для следующего запроса
    this.lokiRoundRobinIndex.set(cacheKey, (currentIndex + 1) % matchingNodes.length);
    
    return selectedNode;
  }

  /**
   * Генерирует ключ для кэша
   */
  private getCacheKey(query: GrafanaPanelQuery, datasource: GrafanaDataSource): string {
    return `${datasource.name}:${datasource.type}:${query.expr}`;
  }

  /**
   * Очищает кэш (вызывается периодически)
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.queryCache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.queryCache.delete(key);
      }
    }
  }

  /**
   * Получает статистику кэша
   */
  getCacheStats(): { size: number; entries: number } {
    return {
      size: this.queryCache.size,
      entries: this.queryCache.size,
    };
  }
}

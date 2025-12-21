import { CanvasNode } from '@/types';

/**
 * Grafana Panel Query
 */
export interface GrafanaPanelQuery {
  refId: string;
  expr: string; // PromQL or LogQL query
  legendFormat?: string;
  step?: string;
}

/**
 * Grafana Panel
 */
export interface GrafanaPanel {
  id: string;
  title: string;
  type: 'graph' | 'table' | 'stat' | 'gauge' | 'piechart' | 'bargraph';
  datasource: string;
  queries: GrafanaPanelQuery[];
  gridPos: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

/**
 * Grafana Dashboard
 */
export interface GrafanaDashboard {
  id: string;
  name: string;
  panels: GrafanaPanel[];
  tags: string[];
  variables?: Array<{
    name: string;
    type: 'query' | 'custom' | 'constant';
    query?: string;
    current: { value: string; text: string };
  }>;
  refresh?: string; // e.g., "30s", "1m", "5m"
  timeRange?: {
    from: string;
    to: string;
  };
}

/**
 * Grafana Alert Rule
 */
export interface GrafanaAlertRule {
  id: string;
  name: string;
  condition: {
    query: string; // PromQL query
    evaluator: {
      type: 'gt' | 'lt' | 'eq' | 'ne';
      params: number[];
    };
    reducer: {
      type: 'avg' | 'sum' | 'min' | 'max' | 'last';
      params: string[];
    };
  };
  for: string; // Duration like "5m"
  annotations: {
    summary: string;
    description?: string;
  };
  labels?: Record<string, string>;
  notificationChannels: string[];
}

/**
 * Grafana DataSource
 */
export interface GrafanaDataSource {
  name: string;
  type: 'prometheus' | 'loki' | 'influxdb' | 'elasticsearch' | 'postgres' | 'mysql';
  url: string;
  access: 'proxy' | 'direct';
  isDefault?: boolean;
  basicAuth?: boolean;
  basicAuthUser?: string;
  basicAuthPassword?: string;
  jsonData?: Record<string, any>;
}

/**
 * Grafana Configuration
 */
export interface GrafanaConfig {
  adminUser?: string;
  adminPassword?: string;
  datasources?: GrafanaDataSource[] | string[]; // Поддержка старого формата
  dashboards?: GrafanaDashboard[] | Array<{ id: string; name: string; panels: number; tags: string[] }>; // Поддержка старого формата
  alerts?: GrafanaAlertRule[];
  defaultDashboard?: string;
  enableAuth?: boolean;
  authProvider?: string;
  enableAlerting?: boolean;
  alertNotificationChannels?: string[];
  theme?: string;
}

/**
 * Grafana Metrics
 */
export interface GrafanaMetrics {
  queriesPerSecond: number;
  dashboardRefreshesPerSecond: number;
  alertEvaluationsPerSecond: number;
  datasourceErrors: number;
  activeDashboards: number;
  activePanels: number;
  totalQueries: number;
  cachedQueries: number;
  queryLatency: number; // Average query latency in ms
  renderingLatency: number; // Average panel rendering latency in ms
}

/**
 * Grafana Emulation Engine
 * Симулирует работу Grafana: выполнение queries, обновление dashboards, оценка alerts
 */
export class GrafanaEmulationEngine {
  private config: GrafanaConfig | null = null;
  private lastRefreshTimes: Map<string, number> = new Map(); // Dashboard ID -> last refresh time
  private lastAlertEvaluationTimes: Map<string, number> = new Map(); // Alert ID -> last evaluation time
  
  // Метрики Grafana
  private grafanaMetrics: GrafanaMetrics = {
    queriesPerSecond: 0,
    dashboardRefreshesPerSecond: 0,
    alertEvaluationsPerSecond: 0,
    datasourceErrors: 0,
    activeDashboards: 0,
    activePanels: 0,
    totalQueries: 0,
    cachedQueries: 0,
    queryLatency: 0,
    renderingLatency: 0,
  };
  
  // История query latencies для расчета среднего
  private queryLatencyHistory: number[] = [];
  private readonly MAX_LATENCY_HISTORY = 100;

  /**
   * Инициализирует конфигурацию Grafana из конфига компонента
   */
  initializeConfig(node: CanvasNode): void {
    const config = (node.data.config || {}) as GrafanaConfig;
    this.config = config;
    
    // Инициализируем времена обновления
    this.initializeRefreshTimes();
    this.initializeAlertEvaluationTimes();
  }

  /**
   * Инициализирует времена обновления dashboards
   */
  private initializeRefreshTimes(): void {
    this.lastRefreshTimes.clear();
    
    if (!this.config?.dashboards) return;
    
    const dashboards = this.normalizeDashboards(this.config.dashboards);
    for (const dashboard of dashboards) {
      this.lastRefreshTimes.set(dashboard.id, 0);
    }
  }

  /**
   * Инициализирует времена оценки alerts
   */
  private initializeAlertEvaluationTimes(): void {
    this.lastAlertEvaluationTimes.clear();
    
    if (!this.config?.alerts || !this.config.enableAlerting) return;
    
    for (const alert of this.config.alerts) {
      this.lastAlertEvaluationTimes.set(alert.id, 0);
    }
  }

  /**
   * Нормализует dashboards (конвертирует старый формат в новый)
   */
  private normalizeDashboards(dashboards: GrafanaConfig['dashboards']): GrafanaDashboard[] {
    if (!dashboards || !Array.isArray(dashboards)) return [];
    
    return dashboards.map((d: any) => {
      if (d && typeof d === 'object') {
        // Проверяем, это новый формат или старый
        if (typeof d.panels === 'number') {
          // Старый формат: panels - это число
          return {
            id: d.id || String(Date.now()),
            name: d.name || 'Dashboard',
            panels: [],
            tags: Array.isArray(d.tags) ? d.tags : [],
            refresh: d.refresh || '30s',
          };
        } else if (Array.isArray(d.panels)) {
          // Новый формат
          return {
            id: d.id || String(Date.now()),
            name: d.name || 'Dashboard',
            panels: d.panels.map((p: any) => ({
              id: p.id || `panel-${Date.now()}`,
              title: p.title || 'Panel',
              type: p.type || 'graph',
              datasource: p.datasource || 'Prometheus',
              queries: Array.isArray(p.queries) ? p.queries : [{ refId: 'A', expr: 'up' }],
              gridPos: p.gridPos || { x: 0, y: 0, w: 12, h: 8 },
            })),
            tags: Array.isArray(d.tags) ? d.tags : [],
            variables: d.variables,
            refresh: d.refresh || '30s',
            timeRange: d.timeRange,
          };
        }
      }
      return d;
    }).filter((d: any) => d && typeof d === 'object' && d.id) as GrafanaDashboard[];
  }

  /**
   * Выполняет один цикл обновления Grafana
   * Должен вызываться периодически в EmulationEngine
   */
  performUpdate(
    currentTime: number,
    prometheusAvailable: boolean = true,
    lokiQueryExecutor?: (query: string, startTime?: number, endTime?: number, limit?: number) => { success: boolean; latency: number; resultsCount: number; error?: string }
  ): void {
    if (!this.config) return;

    // Обновляем dashboards
    this.updateDashboards(currentTime, prometheusAvailable, lokiQueryExecutor);
    
    // Оцениваем alerts
    if (this.config.enableAlerting) {
      this.evaluateAlerts(currentTime, prometheusAvailable);
    }
    
    // Обновляем метрики
    this.updateMetrics();
  }

  /**
   * Обновляет dashboards (выполняет queries)
   */
  private updateDashboards(
    currentTime: number,
    prometheusAvailable: boolean,
    lokiQueryExecutor?: (query: string, startTime?: number, endTime?: number, limit?: number) => { success: boolean; latency: number; resultsCount: number; error?: string }
  ): void {
    if (!this.config?.dashboards) return;
    
    const dashboards = this.normalizeDashboards(this.config.dashboards);
    let totalQueries = 0;
    let totalQueryLatency = 0;
    
    for (const dashboard of dashboards) {
      const refreshInterval = this.parseDuration(dashboard.refresh || '30s');
      const lastRefresh = this.lastRefreshTimes.get(dashboard.id) || 0;
      
      // Проверяем, нужно ли обновлять dashboard
      if (currentTime - lastRefresh >= refreshInterval) {
        this.lastRefreshTimes.set(dashboard.id, currentTime);
        
        // Выполняем queries для всех panels
        for (const panel of dashboard.panels) {
          // Определяем datasource для panel
          const datasource = panel.datasource;
          const isLokiQuery = datasource && this.isLokiDatasource(datasource);
          
          for (const query of panel.queries) {
            totalQueries++;
            
            // Симулируем выполнение query
            const queryLatency = this.simulateQueryExecution(
              query,
              prometheusAvailable,
              isLokiQuery,
              lokiQueryExecutor
            );
            totalQueryLatency += queryLatency;
            
            // Добавляем в историю для расчета среднего
            this.queryLatencyHistory.push(queryLatency);
            if (this.queryLatencyHistory.length > this.MAX_LATENCY_HISTORY) {
              this.queryLatencyHistory.shift();
            }
          }
          
          // Симулируем rendering панели
          const renderingLatency = this.simulatePanelRendering(panel);
          // Обновляем средний rendering latency
          const currentRendering = this.grafanaMetrics.renderingLatency;
          this.grafanaMetrics.renderingLatency = 
            (currentRendering * 0.9) + (renderingLatency * 0.1); // Exponential moving average
        }
      }
    }
    
    // Обновляем счетчики
    this.grafanaMetrics.totalQueries += totalQueries;
    if (totalQueries > 0) {
      this.grafanaMetrics.queryLatency = totalQueryLatency / totalQueries;
    }
    
    // Обновляем ошибки datasource (только для Prometheus queries)
    // Loki errors обрабатываются в simulateQueryExecution
  }

  /**
   * Проверяет, является ли datasource Loki
   */
  private isLokiDatasource(datasource: string): boolean {
    if (!this.config?.datasources) return false;
    
    const datasources = Array.isArray(this.config.datasources)
      ? this.config.datasources
      : [];
    
    const ds = datasources.find((d: any) => 
      (typeof d === 'string' ? d === datasource : d.name === datasource)
    );
    
    if (typeof ds === 'object' && ds.type) {
      return ds.type === 'loki';
    }
    
    return false;
  }

  /**
   * Оценивает alerts
   */
  private evaluateAlerts(currentTime: number, prometheusAvailable: boolean): void {
    if (!this.config?.alerts) return;
    
    for (const alert of this.config.alerts) {
      // Парсим evaluation interval из "for" или используем дефолтный
      const evaluationInterval = this.parseDuration(alert.for || '1m');
      const lastEvaluation = this.lastAlertEvaluationTimes.get(alert.id) || 0;
      
      // Проверяем, нужно ли оценивать alert
      if (currentTime - lastEvaluation >= evaluationInterval) {
        this.lastAlertEvaluationTimes.set(alert.id, currentTime);
        
        // Симулируем evaluation alert query
        this.simulateQueryExecution(
          { refId: 'A', expr: alert.condition.query },
          prometheusAvailable
        );
        
        if (!prometheusAvailable) {
          this.grafanaMetrics.datasourceErrors++;
        }
      }
    }
  }

  /**
   * Симулирует выполнение query
   */
  private simulateQueryExecution(
    query: GrafanaPanelQuery,
    prometheusAvailable: boolean,
    isLokiQuery: boolean = false,
    lokiQueryExecutor?: (query: string, startTime?: number, endTime?: number, limit?: number) => { success: boolean; latency: number; resultsCount: number; error?: string }
  ): number {
    // Если это LogQL query, выполняем через Loki
    if (isLokiQuery && lokiQueryExecutor) {
      try {
        const startTime = Date.now() - 3600000; // Last hour
        const endTime = Date.now();
        const result = lokiQueryExecutor(query.expr, startTime, endTime, 100);
        
        if (!result.success) {
          this.grafanaMetrics.datasourceErrors++;
        }
        
        return result.latency;
      } catch (error) {
        this.grafanaMetrics.datasourceErrors++;
        return 1000; // High latency для ошибки
      }
    }
    
    // PromQL query
    if (!prometheusAvailable) {
      // Datasource недоступен - ошибка
      this.grafanaMetrics.datasourceErrors++;
      return 1000; // High latency для ошибки
    }
    
    // Базовый latency для PromQL query
    let baseLatency = 50; // 50ms базовый latency
    
    // Увеличиваем latency в зависимости от complexity query
    const queryComplexity = this.estimateQueryComplexity(query.expr);
    baseLatency += queryComplexity * 10; // +10ms за единицу complexity
    
    // Добавляем случайную вариацию
    const jitter = (Math.random() - 0.5) * 20; // ±10ms
    
    return Math.max(10, baseLatency + jitter);
  }

  /**
   * Оценивает complexity query (упрощенная оценка)
   */
  private estimateQueryComplexity(query: string): number {
    if (!query) return 0;
    
    let complexity = 1; // Базовая complexity
    
    // Range queries (с []) сложнее instant queries
    if (query.includes('[')) {
      complexity += 2;
    }
    
    // Агрегации увеличивают complexity
    const aggregations = ['sum', 'avg', 'max', 'min', 'count', 'rate', 'irate', 'increase'];
    for (const agg of aggregations) {
      if (query.toLowerCase().includes(agg)) {
        complexity += 1;
      }
    }
    
    // Множественные queries (через |) увеличивают complexity
    const pipeCount = (query.match(/\|/g) || []).length;
    complexity += pipeCount;
    
    return complexity;
  }

  /**
   * Симулирует rendering панели
   */
  private simulatePanelRendering(panel: GrafanaPanel): number {
    // Базовый latency для rendering зависит от типа панели
    const baseLatencies: Record<GrafanaPanel['type'], number> = {
      'stat': 5,
      'gauge': 10,
      'piechart': 15,
      'bargraph': 20,
      'table': 25,
      'graph': 30,
    };
    
    const baseLatency = baseLatencies[panel.type] || 20;
    
    // Больше queries = больше времени на rendering
    const queryMultiplier = Math.sqrt(panel.queries.length);
    
    return baseLatency * queryMultiplier;
  }

  /**
   * Обновляет метрики Grafana
   */
  private updateMetrics(): void {
    if (!this.config) return;
    
    const dashboards = this.normalizeDashboards(this.config.dashboards);
    
    // Подсчитываем активные dashboards и panels
    this.grafanaMetrics.activeDashboards = dashboards.length;
    this.grafanaMetrics.activePanels = dashboards.reduce(
      (sum, d) => sum + d.panels.length,
      0
    );
    
    // Рассчитываем queries per second на основе refresh intervals
    let totalQueriesPerSecond = 0;
    let totalRefreshesPerSecond = 0;
    
    for (const dashboard of dashboards) {
      const refreshInterval = this.parseDuration(dashboard.refresh || '30s');
      const refreshPerSecond = 1000 / refreshInterval;
      totalRefreshesPerSecond += refreshPerSecond;
      
      // Количество queries в dashboard
      const queriesInDashboard = dashboard.panels.reduce(
        (sum, p) => sum + p.queries.length,
        0
      );
      
      totalQueriesPerSecond += refreshPerSecond * queriesInDashboard;
    }
    
    this.grafanaMetrics.queriesPerSecond = totalQueriesPerSecond;
    this.grafanaMetrics.dashboardRefreshesPerSecond = totalRefreshesPerSecond;
    
    // Рассчитываем alert evaluations per second
    if (this.config.enableAlerting && this.config.alerts) {
      let totalEvaluationsPerSecond = 0;
      
      for (const alert of this.config.alerts) {
        const evaluationInterval = this.parseDuration(alert.for || '1m');
        const evaluationsPerSecond = 1000 / evaluationInterval;
        totalEvaluationsPerSecond += evaluationsPerSecond;
      }
      
      this.grafanaMetrics.alertEvaluationsPerSecond = totalEvaluationsPerSecond;
    } else {
      this.grafanaMetrics.alertEvaluationsPerSecond = 0;
    }
    
    // Обновляем средний query latency из истории
    if (this.queryLatencyHistory.length > 0) {
      const avgLatency = this.queryLatencyHistory.reduce((a, b) => a + b, 0) / this.queryLatencyHistory.length;
      this.grafanaMetrics.queryLatency = avgLatency;
    }
  }

  /**
   * Парсит duration строку (30s, 1m, 5m, etc.) в миллисекунды
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 30000; // Default 30s

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 30000;
    }
  }

  /**
   * Получает метрики Grafana
   */
  getGrafanaMetrics(): GrafanaMetrics {
    return { ...this.grafanaMetrics };
  }

  /**
   * Рассчитывает нагрузку на Grafana
   */
  calculateLoad(): {
    queriesPerSecond: number;
    dashboardRefreshesPerSecond: number;
    alertEvaluationsPerSecond: number;
    averageQueryLatency: number;
    averageRenderingLatency: number;
    errorRate: number;
    cpuUtilization: number;
    memoryUtilization: number;
  } {
    const metrics = this.grafanaMetrics;
    
    // CPU utilization зависит от количества queries и их complexity
    // Базовое использование + нагрузка от queries
    const baseCpuUtil = 0.1; // 10% базовое использование
    const queryCpuUtil = Math.min(0.7, metrics.queriesPerSecond / 100); // До 70% от queries
    const alertCpuUtil = Math.min(0.1, metrics.alertEvaluationsPerSecond / 10); // До 10% от alerts
    const renderingCpuUtil = Math.min(0.1, metrics.activePanels / 100); // До 10% от rendering
    
    const cpuUtilization = Math.min(0.95, baseCpuUtil + queryCpuUtil + alertCpuUtil + renderingCpuUtil);
    
    // Memory utilization зависит от количества dashboards и cached queries
    const baseMemoryUtil = 0.2; // 20% базовое использование
    const dashboardMemoryUtil = Math.min(0.4, metrics.activeDashboards / 50); // До 40% от dashboards
    const cacheMemoryUtil = Math.min(0.3, metrics.cachedQueries / 1000); // До 30% от кэша
    
    const memoryUtilization = Math.min(0.95, baseMemoryUtil + dashboardMemoryUtil + cacheMemoryUtil);
    
    // Error rate
    const totalOperations = metrics.totalQueries + metrics.alertEvaluationsPerSecond;
    const errorRate = totalOperations > 0 
      ? metrics.datasourceErrors / totalOperations 
      : 0;
    
    return {
      queriesPerSecond: metrics.queriesPerSecond,
      dashboardRefreshesPerSecond: metrics.dashboardRefreshesPerSecond,
      alertEvaluationsPerSecond: metrics.alertEvaluationsPerSecond,
      averageQueryLatency: metrics.queryLatency,
      averageRenderingLatency: metrics.renderingLatency,
      errorRate,
      cpuUtilization,
      memoryUtilization,
    };
  }

  /**
   * Получает список активных datasources
   */
  getActiveDatasources(): GrafanaDataSource[] {
    if (!this.config?.datasources) return [];
    
    // Конвертируем старый формат
    if (this.config.datasources.length > 0 && typeof this.config.datasources[0] === 'string') {
      return this.config.datasources.map((ds: string) => ({
        name: ds,
        type: 'prometheus' as const,
        url: 'http://localhost:9090',
        access: 'proxy' as const,
        isDefault: ds === this.config!.datasources![0],
      }));
    }
    
    return this.config.datasources.filter(
      (ds: any) => ds && typeof ds === 'object' && ds.name
    ) as GrafanaDataSource[];
  }

  /**
   * Проверяет доступность Prometheus datasource
   */
  isPrometheusAvailable(prometheusNode: CanvasNode | null): boolean {
    if (!prometheusNode) return false;
    
    const datasources = this.getActiveDatasources();
    const prometheusDs = datasources.find(ds => ds.type === 'prometheus');
    
    if (!prometheusDs) return false;
    
    // В реальной системе здесь была бы проверка доступности
    // В симуляции просто проверяем наличие Prometheus node
    return true;
  }
}


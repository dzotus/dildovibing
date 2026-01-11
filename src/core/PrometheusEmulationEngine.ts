import { CanvasNode, CanvasConnection } from '@/types';
import { ComponentMetrics } from './EmulationEngine';
import { PrometheusMetricsExporter } from './PrometheusMetricsExporter';

/**
 * Scrape Target Status
 */
export interface ScrapeTargetStatus {
  job: string;
  endpoint: string;
  lastScrape: number;
  lastSuccess: number | null;
  lastError: string | null;
  scrapeDuration: number | null;
  up: boolean;
  labels?: Record<string, string>;
}

/**
 * Prometheus Scrape Configuration (соответствует реальному формату)
 */
export interface ScrapeConfig {
  job_name: string;
  scrape_interval?: string;
  scrape_timeout?: string;
  metrics_path?: string;
  static_configs?: Array<{
    targets: string[];
    labels?: Record<string, string>;
  }>;
  // Для service discovery можно добавить позже
  kubernetes_sd_configs?: any[];
  consul_sd_configs?: any[];
}

/**
 * Prometheus Configuration
 */
export interface PrometheusEmulationConfig {
  global: {
    scrape_interval?: string;
    evaluation_interval?: string;
    external_labels?: Record<string, string>;
  };
  scrape_configs: ScrapeConfig[];
  alerting?: {
    alertmanagers: Array<{
      static_configs: Array<{
        targets: string[];
      }>;
    }>;
  };
  remote_write?: Array<{
    url: string;
  }>;
}

/**
 * Prometheus Emulation Engine
 * Симулирует работу Prometheus: scraping метрик, хранение, расчет нагрузки
 */
export class PrometheusEmulationEngine {
  private config: PrometheusEmulationConfig | null = null;
  private targetStatuses: Map<string, ScrapeTargetStatus> = new Map();
  private scrapedMetrics: Map<string, ComponentMetrics> = new Map();
  private lastScrapeTimes: Map<string, number> = new Map();
  
  // Метрики самого Prometheus
  private prometheusMetrics: {
    scrapeRequestsTotal: number;
    scrapeErrorsTotal: number;
    scrapeDurationTotal: number;
    targetsUp: number;
    targetsDown: number;
    samplesScraped: number;
  } = {
    scrapeRequestsTotal: 0,
    scrapeErrorsTotal: 0,
    scrapeDurationTotal: 0,
    targetsUp: 0,
    targetsDown: 0,
    samplesScraped: 0,
  };

  /**
   * Инициализирует конфигурацию Prometheus из конфига компонента
   */
  initializeConfig(node: CanvasNode): void {
    const config = node.data.config || {};
    
    // Преобразуем scrapeInterval в строку, если это число
    const scrapeIntervalStr = typeof config.scrapeInterval === 'number' 
      ? `${config.scrapeInterval / 1000}s` 
      : (config.scrapeInterval || '15s');
    const evaluationIntervalStr = typeof config.evaluationInterval === 'number'
      ? `${config.evaluationInterval / 1000}s`
      : (config.evaluationInterval || '15s');
    
    this.config = {
      global: {
        scrape_interval: scrapeIntervalStr,
        evaluation_interval: evaluationIntervalStr,
        external_labels: {
          prometheus: 'archiphoenix',
        },
      },
      scrape_configs: this.buildScrapeConfigs(config),
      alerting: config.enableAlertmanager ? {
        alertmanagers: [{
          static_configs: [{
            targets: [config.alertmanagerUrl || 'http://alertmanager:9093'].map(url => {
              // Извлекаем host:port из URL
              const match = url.match(/^https?:\/\/([^\/]+)/);
              return match ? match[1] : url;
            }),
          }],
        }],
      } : undefined,
      remote_write: config.enableRemoteWrite && config.remoteWrite 
        ? config.remoteWrite.map((ep: any) => ({ url: ep.url }))
        : undefined,
    };

    // Инициализируем статусы targets
    this.initializeTargetStatuses();
  }

  /**
   * Строит scrape_configs из конфига
   */
  private buildScrapeConfigs(config: any): ScrapeConfig[] {
    // Приоритет: используем новую структуру scrape_configs, если она есть
    if (config.scrape_configs && Array.isArray(config.scrape_configs)) {
      // Копируем scrape_configs как есть (они уже в правильном формате)
      return config.scrape_configs.map((sc: any) => ({
        job_name: sc.job_name,
        scrape_interval: sc.scrape_interval,
        scrape_timeout: sc.scrape_timeout,
        metrics_path: sc.metrics_path,
        static_configs: sc.static_configs || [],
      }));
    }

    // Обратная совместимость: конвертируем старую структуру targets
    const scrapeConfigs: ScrapeConfig[] = [];
    const globalInterval = config.scrapeInterval || '15s';

    if (config.targets && Array.isArray(config.targets)) {
      // Группируем targets по job_name
      const targetsByJob = new Map<string, any[]>();
      
      for (const target of config.targets) {
        const jobName = target.job || 'default';
        if (!targetsByJob.has(jobName)) {
          targetsByJob.set(jobName, []);
        }
        targetsByJob.get(jobName)!.push(target);
      }

      // Создаем scrape_config для каждого job
      for (const [jobName, targets] of targetsByJob.entries()) {
        const firstTarget = targets[0];
        const scrapeInterval = firstTarget.scrapeInterval || firstTarget.interval || globalInterval;
        const metricsPath = firstTarget.metricsPath || '/metrics';

        // Извлекаем targets (host:port) из endpoints или используем готовый массив targets
        const staticTargets: string[] = [];
        
        for (const t of targets) {
          // Если у target есть массив targets (новая структура)
          if (Array.isArray(t.targets)) {
            staticTargets.push(...t.targets);
          }
          // Если у target есть endpoint (старая структура)
          else if (t.endpoint) {
            try {
              const url = new URL(t.endpoint);
              staticTargets.push(`${url.hostname}${url.port ? ':' + url.port : ''}`);
            } catch {
              // Если не валидный URL, пытаемся извлечь напрямую
              const match = t.endpoint.match(/^https?:\/\/([^\/]+)/);
              staticTargets.push(match ? match[1] : t.endpoint);
            }
          }
          // Если target - это просто строка
          else if (typeof t === 'string') {
            staticTargets.push(t);
          }
        }

        scrapeConfigs.push({
          job_name: jobName,
          scrape_interval: scrapeInterval,
          metrics_path: metricsPath,
          static_configs: [{
            targets: staticTargets,
            labels: firstTarget.labels || {},
          }],
        });
      }
    }

    return scrapeConfigs;
  }

  /**
   * Инициализирует статусы всех targets
   */
  private initializeTargetStatuses(): void {
    this.targetStatuses.clear();
    
    if (!this.config) return;

    for (const scrapeConfig of this.config.scrape_configs) {
      if (scrapeConfig.static_configs) {
        for (const staticConfig of scrapeConfig.static_configs) {
          for (const target of staticConfig.targets) {
            const endpoint = scrapeConfig.metrics_path 
              ? `http://${target}${scrapeConfig.metrics_path}`
              : `http://${target}/metrics`;
            
            const key = `${scrapeConfig.job_name}:${target}`;
            this.targetStatuses.set(key, {
              job: scrapeConfig.job_name,
              endpoint,
              lastScrape: 0,
              lastSuccess: null,
              lastError: null,
              scrapeDuration: null,
              up: false,
              labels: staticConfig.labels,
            });
          }
        }
      }
    }
  }

  /**
   * Выполняет один цикл scraping
   * Должен вызываться периодически в EmulationEngine
   */
  performScraping(
    currentTime: number,
    allNodes: CanvasNode[],
    allMetrics: Map<string, ComponentMetrics>
  ): void {
    if (!this.config) return;

    const globalInterval = this.parseDuration(this.config.global.scrape_interval || '15s');
    
    // Обновляем метрики Prometheus
    this.prometheusMetrics.targetsUp = 0;
    this.prometheusMetrics.targetsDown = 0;

    for (const [key, status] of this.targetStatuses.entries()) {
      const lastScrape = this.lastScrapeTimes.get(key) || 0;
      const scrapeInterval = this.getScrapeIntervalForTarget(status.job);
      const intervalMs = this.parseDuration(scrapeInterval);

      // Проверяем, нужно ли скрейпить
      if (currentTime - lastScrape >= intervalMs) {
        this.scrapeTarget(key, status, currentTime, allNodes, allMetrics);
        this.lastScrapeTimes.set(key, currentTime);
      }

      // Обновляем счетчики
      if (status.up) {
        this.prometheusMetrics.targetsUp++;
      } else {
        this.prometheusMetrics.targetsDown++;
      }
    }
  }

  /**
   * Выполняет scraping для одного target
   */
  private scrapeTarget(
    key: string,
    status: ScrapeTargetStatus,
    currentTime: number,
    allNodes: CanvasNode[],
    allMetrics: Map<string, ComponentMetrics>
  ): void {
    const startTime = performance.now();
    this.prometheusMetrics.scrapeRequestsTotal++;

    try {
      // Ищем соответствующий компонент по endpoint
      const node = this.findNodeByEndpoint(status.endpoint, allNodes);
      
      if (!node) {
        throw new Error(`Target not found: ${status.endpoint}`);
      }

      const metrics = allMetrics.get(node.id);
      
      if (!metrics) {
        throw new Error(`Metrics not available for component: ${node.id}`);
      }

      // Симулируем получение метрик в Prometheus format
      const prometheusFormat = PrometheusMetricsExporter.exportMetrics(node, metrics);
      
      // Обновляем статус
      status.lastScrape = currentTime;
      status.lastSuccess = currentTime;
      status.lastError = null;
      status.up = true;
      const duration = performance.now() - startTime;
      status.scrapeDuration = duration;
      this.prometheusMetrics.scrapeDurationTotal += duration;
      this.prometheusMetrics.samplesScraped += this.countSamples(prometheusFormat);

      // Сохраняем метрики
      this.scrapedMetrics.set(key, metrics);

    } catch (error) {
      const duration = performance.now() - startTime;
      status.lastScrape = currentTime;
      status.lastSuccess = null;
      status.lastError = error instanceof Error ? error.message : String(error);
      status.up = false;
      status.scrapeDuration = duration;
      this.prometheusMetrics.scrapeErrorsTotal++;
    }
  }

  /**
   * Находит node по endpoint
   */
  private findNodeByEndpoint(endpoint: string, nodes: CanvasNode[]): CanvasNode | null {
    // Парсим endpoint для извлечения host и port
    try {
      const url = new URL(endpoint);
      const hostname = url.hostname;
      const port = url.port ? parseInt(url.port) : null;

      // Ищем node по hostname (label) или port
      for (const node of nodes) {
        const config = node.data.config || {};
        const nodePort = config.port || config.metricsPort || config.metrics?.port;
        const nodeLabel = node.data.label?.toLowerCase().replace(/\s+/g, '-');

        if (nodeLabel === hostname || (port && nodePort === port)) {
          return node;
        }
      }
    } catch (e) {
      // Invalid URL, skip
    }

    return null;
  }

  /**
   * Получает scrape interval для конкретного job
   */
  private getScrapeIntervalForTarget(jobName: string): string {
    if (!this.config) return '15s';

    const scrapeConfig = this.config.scrape_configs.find(c => c.job_name === jobName);
    return scrapeConfig?.scrape_interval || this.config.global.scrape_interval || '15s';
  }

  /**
   * Парсит duration строку (15s, 1m, etc.) в миллисекунды
   */
  private parseDuration(duration: string | number): number {
    // Если это уже число (миллисекунды), возвращаем как есть
    if (typeof duration === 'number') return duration;
    
    // Если это строка, парсим её
    if (typeof duration !== 'string') return 15000; // Default 15s
    
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 15000; // Default 15s

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 15000;
    }
  }

  /**
   * Подсчитывает количество samples в Prometheus format
   */
  private countSamples(prometheusFormat: string): number {
    // Считаем строки, которые не являются комментариями и не пустые
    return prometheusFormat
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .length;
  }

  /**
   * Получает статус всех targets
   */
  getTargetStatuses(): ScrapeTargetStatus[] {
    return Array.from(this.targetStatuses.values());
  }

  /**
   * Получает метрики самого Prometheus
   */
  getPrometheusMetrics(): typeof this.prometheusMetrics {
    return { ...this.prometheusMetrics };
  }

  /**
   * Рассчитывает нагрузку на Prometheus
   */
  calculateLoad(): {
    scrapeRequestsPerSecond: number;
    averageScrapeDuration: number;
    errorRate: number;
    samplesPerSecond: number;
  } {
    const totalRequests = this.prometheusMetrics.scrapeRequestsTotal;
    const totalErrors = this.prometheusMetrics.scrapeErrorsTotal;
    const totalDuration = this.prometheusMetrics.scrapeDurationTotal;
    const totalSamples = this.prometheusMetrics.samplesScraped;

    // Для расчета per second нужен временной интервал, упростим
    // Предполагаем, что это средние значения за период работы
    
    const scrapeCount = this.targetStatuses.size;
    const avgInterval = this.parseDuration(this.config?.global.scrape_interval || '15s');
    const requestsPerSecond = scrapeCount > 0 ? (1000 / avgInterval) * scrapeCount : 0;
    const avgDuration = totalRequests > 0 ? totalDuration / totalRequests : 0;
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
    const samplesPerSecond = requestsPerSecond * (totalSamples / totalRequests || 0);

    return {
      scrapeRequestsPerSecond: requestsPerSecond,
      averageScrapeDuration: avgDuration,
      errorRate,
      samplesPerSecond,
    };
  }
}


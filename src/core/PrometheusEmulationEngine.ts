import { CanvasNode, CanvasConnection } from '@/types';
import { ComponentMetrics } from './EmulationEngine';
import { PrometheusMetricsExporter } from './PrometheusMetricsExporter';
import { KubernetesSD, KubernetesSDConfig, KubernetesSDTarget } from './serviceDiscovery/KubernetesSD';
import { ConsulSD, ConsulSDConfig, ConsulSDTarget } from './serviceDiscovery/ConsulSD';
import { FileSD, FileSDConfig, FileSDTarget } from './serviceDiscovery/FileSD';
import { DNSSD, DNSSDConfig, DNSSDTarget } from './serviceDiscovery/DNSSD';
import { ServiceDiscovery } from '@/services/connection/ServiceDiscovery';
import { KubernetesEmulationEngine } from './KubernetesEmulationEngine';
import { PrometheusRelabeling, RelabelConfig, RelabelInput } from './PrometheusRelabeling';
import { PromQLEvaluator, PromQLResult } from './PromQLEvaluator';

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
  retryCount: number;
  lastRetryTime: number | null;
  samplesScraped: number;
}

/**
 * Prometheus Scrape Configuration (соответствует реальному формату)
 */
export interface ScrapeConfig {
  job_name: string;
  scrape_interval?: string;
  scrape_timeout?: string;
  metrics_path?: string;
  scheme?: 'http' | 'https';
  basic_auth?: {
    username?: string;
    password?: string;
  };
  bearer_token?: string;
  bearer_token_file?: string;
  tls_config?: {
    insecure_skip_verify?: boolean;
    ca_file?: string;
    cert_file?: string;
    key_file?: string;
  };
  relabel_configs?: RelabelConfig[];
  static_configs?: Array<{
    targets: string[];
    labels?: Record<string, string>;
  }>;
  // Service Discovery configs
  kubernetes_sd_configs?: any[];
  consul_sd_configs?: any[];
  file_sd_configs?: any[];
  dns_sd_configs?: any[];
}

/**
 * Alerting Rule (соответствует реальному формату Prometheus)
 */
export interface AlertingRule {
  name: string;
  expr: string;
  for?: string; // Duration (например, "5m")
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  severity?: 'critical' | 'warning' | 'info';
}

/**
 * Recording Rule (соответствует реальному формату Prometheus)
 */
export interface RecordingRule {
  name: string;
  expr: string;
  labels?: Record<string, string>;
}

/**
 * Alert State
 */
export interface AlertState {
  ruleName: string;
  state: 'pending' | 'firing' | 'inactive';
  activeSince: number; // Когда alert стал активным (pending или firing)
  lastEvaluation: number; // Время последней evaluation
  lastEvaluationDuration: number; // Длительность последней evaluation
  value: number | null; // Значение выражения
  labels: Record<string, string>;
  annotations: Record<string, string>;
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
  alerting_rules?: AlertingRule[];
  recording_rules?: RecordingRule[];
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
  
  // Service Discovery
  private serviceDiscovery: ServiceDiscovery;
  private kubernetesSDs: Map<string, KubernetesSD> = new Map(); // key: job_name
  private consulSDs: Map<string, ConsulSD> = new Map(); // key: job_name
  private fileSDs: Map<string, FileSD> = new Map(); // key: job_name
  private dnsSDs: Map<string, DNSSD> = new Map(); // key: job_name
  private allNodes: CanvasNode[] = [];
  private kubernetesEngine: KubernetesEmulationEngine | null = null;
  
  // Alerting
  private alertStates: Map<string, AlertState> = new Map(); // key: rule name
  private lastEvaluationTime: number = 0;
  private recordingRuleResults: Map<string, number> = new Map(); // key: rule name -> value

  // Метрики самого Prometheus
  private prometheusMetrics: {
    scrapeRequestsTotal: number;
    scrapeErrorsTotal: number;
    scrapeDurationTotal: number;
    targetsUp: number;
    targetsDown: number;
    samplesScraped: number;
    // TSDB метрики
    tsdbHeadSamples: number;
    tsdbHeadSeries: number;
    tsdbCompactionsTotal: number;
    tsdbWalCorruptionsTotal: number;
    tsdbStorageBlocksBytes: number;
    // Config метрики
    configLastReloadSuccessTimestamp: number;
    configLastReloadSuccessful: number;
    // Target метрики (для каждого target)
    targetScrapesExceededSampleLimitTotal: number;
    targetScrapePoolSyncTotal: number;
    // Alerting метрики
    alertingRulesLastEvaluationTimestamp: number;
    alertingRulesLastEvaluationDurationSeconds: number;
    notificationsTotal: number;
    notificationsFailedTotal: number;
  } = {
    scrapeRequestsTotal: 0,
    scrapeErrorsTotal: 0,
    scrapeDurationTotal: 0,
    targetsUp: 0,
    targetsDown: 0,
    samplesScraped: 0,
    tsdbHeadSamples: 0,
    tsdbHeadSeries: 0,
    tsdbCompactionsTotal: 0,
    tsdbWalCorruptionsTotal: 0,
    tsdbStorageBlocksBytes: 0,
    configLastReloadSuccessTimestamp: Date.now(),
    configLastReloadSuccessful: 1,
    targetScrapesExceededSampleLimitTotal: 0,
    targetScrapePoolSyncTotal: 0,
    alertingRulesLastEvaluationTimestamp: 0,
    alertingRulesLastEvaluationDurationSeconds: 0,
    notificationsTotal: 0,
    notificationsFailedTotal: 0,
  };

  // Retry конфигурация
  private readonly maxRetries = 3;
  private readonly retryBackoffMs = 1000; // Начальная задержка 1 секунда

  constructor(serviceDiscovery: ServiceDiscovery) {
    this.serviceDiscovery = serviceDiscovery;
  }

  /**
   * Обновляет список nodes (вызывается при изменении canvas)
   */
  updateNodes(allNodes: CanvasNode[]): void {
    this.allNodes = allNodes;
    
    // Обновляем Service Discovery
    for (const kubernetesSD of this.kubernetesSDs.values()) {
      kubernetesSD.updateNodes(allNodes);
    }
    for (const consulSD of this.consulSDs.values()) {
      consulSD.updateNodes(allNodes);
    }
    for (const fileSD of this.fileSDs.values()) {
      fileSD.updateNodes(allNodes);
    }
    for (const dnsSD of this.dnsSDs.values()) {
      dnsSD.updateNodes(allNodes);
    }
  }

  /**
   * Обновляет Kubernetes engine (вызывается из EmulationEngine)
   */
  updateKubernetesEngine(engine: KubernetesEmulationEngine | null): void {
    this.kubernetesEngine = engine;
    
    // Обновляем Kubernetes SD
    for (const kubernetesSD of this.kubernetesSDs.values()) {
      kubernetesSD.updateKubernetesEngine(engine);
    }
  }

  /**
   * Инициализирует конфигурацию Prometheus из конфига компонента
   */
  initializeConfig(node: CanvasNode, allNodes: CanvasNode[] = []): void {
    this.allNodes = allNodes;
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
      alerting_rules: config.alertingRules || [],
      recording_rules: config.recordingRules || [],
      remote_write: config.enableRemoteWrite && config.remoteWrite 
        ? config.remoteWrite.map((ep: any) => ({ url: ep.url }))
        : undefined,
    };

    // Инициализируем Service Discovery
    this.initializeServiceDiscovery(config);
    
    // Инициализируем статусы targets
    this.initializeTargetStatuses();
    
    // Обновляем config метрики
    this.prometheusMetrics.configLastReloadSuccessTimestamp = Date.now();
    this.prometheusMetrics.configLastReloadSuccessful = 1;

    // Инициализируем alert states
    this.initializeAlertStates();
  }

  /**
   * Инициализирует Service Discovery для всех scrape_configs
   */
  private initializeServiceDiscovery(config: any): void {
    // Очищаем старые SD
    this.kubernetesSDs.clear();
    this.consulSDs.clear();
    this.fileSDs.clear();
    this.dnsSDs.clear();

    if (!config.scrape_configs || !Array.isArray(config.scrape_configs)) {
      return;
    }

    for (const scrapeConfig of config.scrape_configs) {
      // Kubernetes SD
      if (scrapeConfig.kubernetes_sd_configs && Array.isArray(scrapeConfig.kubernetes_sd_configs)) {
        for (const k8sSDConfig of scrapeConfig.kubernetes_sd_configs) {
          const kubernetesSD = new KubernetesSD(this.serviceDiscovery);
          kubernetesSD.initialize(
            k8sSDConfig as KubernetesSDConfig,
            this.allNodes,
            this.kubernetesEngine,
            this.allNodes.find(n => n.type === 'kubernetes') || undefined
          );
          this.kubernetesSDs.set(scrapeConfig.job_name, kubernetesSD);
        }
      }

      // Consul SD
      if (scrapeConfig.consul_sd_configs && Array.isArray(scrapeConfig.consul_sd_configs)) {
        for (const consulSDConfig of scrapeConfig.consul_sd_configs) {
          const consulSD = new ConsulSD(this.serviceDiscovery);
          consulSD.initialize(
            consulSDConfig as ConsulSDConfig,
            this.allNodes
          );
          this.consulSDs.set(scrapeConfig.job_name, consulSD);
        }
      }

      // File SD
      if (scrapeConfig.file_sd_configs && Array.isArray(scrapeConfig.file_sd_configs)) {
        for (const fileSDConfig of scrapeConfig.file_sd_configs) {
          const fileSD = new FileSD(this.serviceDiscovery);
          fileSD.initialize(
            fileSDConfig as FileSDConfig,
            this.allNodes
          );
          this.fileSDs.set(scrapeConfig.job_name, fileSD);
        }
      }

      // DNS SD
      if (scrapeConfig.dns_sd_configs && Array.isArray(scrapeConfig.dns_sd_configs)) {
        for (const dnsSDConfig of scrapeConfig.dns_sd_configs) {
          const dnsSD = new DNSSD(this.serviceDiscovery);
          dnsSD.initialize(
            dnsSDConfig as DNSSDConfig,
            this.allNodes
          );
          this.dnsSDs.set(scrapeConfig.job_name, dnsSD);
        }
      }
    }
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
        scheme: sc.scheme || 'http',
        basic_auth: sc.basic_auth,
        bearer_token: sc.bearer_token,
        bearer_token_file: sc.bearer_token_file,
        tls_config: sc.tls_config,
        relabel_configs: sc.relabel_configs || [],
        static_configs: sc.static_configs || [],
        kubernetes_sd_configs: sc.kubernetes_sd_configs || [],
        consul_sd_configs: sc.consul_sd_configs || [],
        file_sd_configs: sc.file_sd_configs || [],
        dns_sd_configs: sc.dns_sd_configs || [],
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
          scheme: firstTarget.scheme || 'http',
          basic_auth: firstTarget.basic_auth,
          bearer_token: firstTarget.bearer_token,
          relabel_configs: firstTarget.relabel_configs,
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
   * Включает static_configs и Service Discovery targets
   */
  private initializeTargetStatuses(): void {
    this.targetStatuses.clear();
    
    if (!this.config) return;

    for (const scrapeConfig of this.config.scrape_configs) {
      // Static configs
      if (scrapeConfig.static_configs) {
        for (const staticConfig of scrapeConfig.static_configs) {
          for (const target of staticConfig.targets) {
            const scheme = scrapeConfig.scheme || 'http';
            const endpoint = scrapeConfig.metrics_path 
              ? `${scheme}://${target}${scrapeConfig.metrics_path}`
              : `${scheme}://${target}/metrics`;
            
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
              retryCount: 0,
              lastRetryTime: null,
              samplesScraped: 0,
            });
          }
        }
      }

      // Kubernetes SD targets
      const kubernetesSD = this.kubernetesSDs.get(scrapeConfig.job_name);
      if (kubernetesSD) {
        const k8sTargets = kubernetesSD.getTargets(true); // Force refresh
        for (const target of k8sTargets) {
          const address = target.__address__ || '';
          const metricsPath = target.__metrics_path__ || scrapeConfig.metrics_path || '/metrics';
          const scheme = target.__scheme__ || 'http';
          const endpoint = `${scheme}://${address}${metricsPath}`;
          
          const key = `${scrapeConfig.job_name}:${address}`;
          
          // Преобразуем мета-метки в обычные labels
          const labels: Record<string, string> = {};
          for (const [key, value] of Object.entries(target)) {
            if (key.startsWith('__meta_') && typeof value === 'string') {
              labels[key] = value;
            }
          }
          
          this.targetStatuses.set(key, {
            job: scrapeConfig.job_name,
            endpoint,
            lastScrape: 0,
            lastSuccess: null,
            lastError: null,
            scrapeDuration: null,
            up: false,
            labels,
            retryCount: 0,
            lastRetryTime: null,
            samplesScraped: 0,
          });
        }
      }

      // Consul SD targets
      const consulSD = this.consulSDs.get(scrapeConfig.job_name);
      if (consulSD) {
        const consulTargets = consulSD.getTargets(true); // Force refresh
        for (const target of consulTargets) {
          const address = target.__address__ || '';
          const metricsPath = target.__metrics_path__ || scrapeConfig.metrics_path || '/metrics';
          const scheme = target.__scheme__ || 'http';
          const endpoint = `${scheme}://${address}${metricsPath}`;
          
          const key = `${scrapeConfig.job_name}:${address}`;
          
          // Преобразуем мета-метки в обычные labels
          const labels: Record<string, string> = {};
          for (const [key, value] of Object.entries(target)) {
            if (key.startsWith('__meta_') && typeof value === 'string') {
              labels[key] = value;
            }
          }
          
          this.targetStatuses.set(key, {
            job: scrapeConfig.job_name,
            endpoint,
            lastScrape: 0,
            lastSuccess: null,
            lastError: null,
            scrapeDuration: null,
            up: false,
            labels,
            retryCount: 0,
            lastRetryTime: null,
            samplesScraped: 0,
          });
        }
      }

      // File SD targets
      const fileSD = this.fileSDs.get(scrapeConfig.job_name);
      if (fileSD) {
        const fileTargets = fileSD.getTargets(true); // Force refresh
        for (const target of fileTargets) {
          const address = target.__address__ || '';
          const metricsPath = target.__metrics_path__ || scrapeConfig.metrics_path || '/metrics';
          const scheme = target.__scheme__ || 'http';
          const endpoint = `${scheme}://${address}${metricsPath}`;
          
          const key = `${scrapeConfig.job_name}:${address}`;
          
          // Преобразуем мета-метки и другие labels
          const labels: Record<string, string> = {};
          for (const [key, value] of Object.entries(target)) {
            if (key !== '__address__' && key !== '__metrics_path__' && key !== '__scheme__' && typeof value === 'string') {
              labels[key] = value;
            }
          }
          
          this.targetStatuses.set(key, {
            job: scrapeConfig.job_name,
            endpoint,
            lastScrape: 0,
            lastSuccess: null,
            lastError: null,
            scrapeDuration: null,
            up: false,
            labels,
            retryCount: 0,
            lastRetryTime: null,
            samplesScraped: 0,
          });
        }
      }

      // DNS SD targets
      const dnsSD = this.dnsSDs.get(scrapeConfig.job_name);
      if (dnsSD) {
        const dnsTargets = dnsSD.getTargets(true); // Force refresh
        for (const target of dnsTargets) {
          const address = target.__address__ || '';
          const metricsPath = target.__metrics_path__ || scrapeConfig.metrics_path || '/metrics';
          const scheme = target.__scheme__ || 'http';
          const endpoint = `${scheme}://${address}${metricsPath}`;
          
          const key = `${scrapeConfig.job_name}:${address}`;
          
          // Преобразуем мета-метки в обычные labels
          const labels: Record<string, string> = {};
          for (const [key, value] of Object.entries(target)) {
            if (key.startsWith('__meta_') && typeof value === 'string') {
              labels[key] = value;
            } else if (key !== '__address__' && key !== '__metrics_path__' && key !== '__scheme__' && typeof value === 'string') {
              labels[key] = value;
            }
          }
          
          this.targetStatuses.set(key, {
            job: scrapeConfig.job_name,
            endpoint,
            lastScrape: 0,
            lastSuccess: null,
            lastError: null,
            scrapeDuration: null,
            up: false,
            labels,
            retryCount: 0,
            lastRetryTime: null,
            samplesScraped: 0,
          });
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

    // Обновляем nodes для Service Discovery
    if (this.allNodes !== allNodes) {
      this.updateNodes(allNodes);
    }

    // Обновляем targets из Service Discovery (периодически)
    // В реальном Prometheus это происходит каждые 30-60 секунд
    const shouldRefreshSD = currentTime % 30000 < 100; // Примерно каждые 30 секунд
    if (shouldRefreshSD) {
      this.initializeTargetStatuses(); // Обновляем targets из SD
      this.prometheusMetrics.targetScrapePoolSyncTotal++;
    }

    // Обновляем TSDB метрики (симуляция роста данных)
    this.updateTSDBMetrics(currentTime);

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

    // Выполняем evaluation alerting rules (согласно evaluation_interval)
    const evaluationInterval = this.parseDuration(this.config.global.evaluation_interval || '15s');
    if (currentTime - this.lastEvaluationTime >= evaluationInterval) {
      this.evaluateAlertingRules(currentTime, allNodes, allMetrics);
      this.lastEvaluationTime = currentTime;
    }

    // Выполняем evaluation recording rules
    this.evaluateRecordingRules(currentTime, allNodes, allMetrics);
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

    // Получаем scrape config для этого job
    const scrapeConfig = this.getScrapeConfigForJob(status.job);
    if (!scrapeConfig) {
      const duration = performance.now() - startTime;
      status.lastScrape = currentTime;
      status.lastError = 'Scrape config not found';
      status.up = false;
      status.scrapeDuration = duration;
      this.prometheusMetrics.scrapeErrorsTotal++;
      return;
    }

    try {
      // Проверяем retry логику
      if (status.retryCount > 0 && status.lastRetryTime) {
        const backoffMs = this.retryBackoffMs * Math.pow(2, status.retryCount - 1);
        if (currentTime - status.lastRetryTime < backoffMs) {
          // Еще не время для retry
          return;
        }
      }

      // Симулируем HTTP GET запрос с authentication
      const authResult = this.simulateAuthentication(scrapeConfig);
      if (!authResult.success) {
        throw new Error(`Authentication failed: ${authResult.error}`);
      }

      // Симулируем HTTPS latency если используется HTTPS
      // В реальности это добавляет задержку, но в симуляции мы просто учитываем это в duration
      const sslLatency = scrapeConfig.scheme === 'https' ? 10 + Math.random() * 20 : 0; // 10-30ms для HTTPS

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
      let prometheusFormat = PrometheusMetricsExporter.exportMetrics(node, metrics);
      
      // Применяем relabeling если есть relabel_configs
      if (scrapeConfig.relabel_configs && scrapeConfig.relabel_configs.length > 0) {
        const relabelInput: RelabelInput = {
          labels: status.labels || {},
          __address__: this.extractAddressFromEndpoint(status.endpoint),
          __metrics_path__: scrapeConfig.metrics_path || '/metrics',
          __scheme__: scrapeConfig.scheme || 'http',
        };

        const relabelResult = PrometheusRelabeling.applyRelabeling(relabelInput, scrapeConfig.relabel_configs);
        
        // Если target должен быть отброшен, не сохраняем метрики
        if (!relabelResult.keep) {
          status.up = false;
          status.lastError = 'Target dropped by relabeling';
          status.lastScrape = currentTime;
          this.prometheusMetrics.scrapeErrorsTotal++;
          return;
        }

        // Обновляем labels после relabeling
        status.labels = relabelResult.labels;
      }
      
      // Обновляем статус
      status.lastScrape = currentTime;
      status.lastSuccess = currentTime;
      status.lastError = null;
      status.up = true;
      status.retryCount = 0;
      status.lastRetryTime = null;
      const duration = performance.now() - startTime + sslLatency;
      status.scrapeDuration = duration;
      this.prometheusMetrics.scrapeDurationTotal += duration;
      
      const samplesCount = this.countSamples(prometheusFormat);
      status.samplesScraped = samplesCount;
      this.prometheusMetrics.samplesScraped += samplesCount;
      this.prometheusMetrics.tsdbHeadSamples += samplesCount;
      this.prometheusMetrics.tsdbHeadSeries += this.countSeries(prometheusFormat);

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

      // Retry логика
      if (status.retryCount < this.maxRetries) {
        status.retryCount++;
        status.lastRetryTime = currentTime;
      }
    }
  }

  /**
   * Получает scrape config для job
   */
  private getScrapeConfigForJob(jobName: string): ScrapeConfig | null {
    if (!this.config) return null;
    return this.config.scrape_configs.find(c => c.job_name === jobName) || null;
  }

  /**
   * Симулирует authentication
   */
  private simulateAuthentication(scrapeConfig: ScrapeConfig): { success: boolean; error?: string } {
    // Basic Auth
    if (scrapeConfig.basic_auth) {
      if (!scrapeConfig.basic_auth.username || !scrapeConfig.basic_auth.password) {
        return { success: false, error: 'Basic auth credentials incomplete' };
      }
      // Симулируем проверку (в реальности это HTTP 401 если неверно)
      // В симуляции считаем что если есть credentials, то успешно
    }

    // Bearer Token
    if (scrapeConfig.bearer_token) {
      if (!scrapeConfig.bearer_token || scrapeConfig.bearer_token.trim() === '') {
        return { success: false, error: 'Bearer token is empty' };
      }
      // Симулируем проверку токена
    }

    // TLS Config
    if (scrapeConfig.tls_config) {
      if (scrapeConfig.tls_config.insecure_skip_verify) {
        // Пропускаем проверку сертификата
      } else {
        // В реальности проверяли бы сертификат
        // В симуляции считаем что если tls_config указан, то успешно
      }
    }

    return { success: true };
  }

  /**
   * Извлекает address из endpoint
   */
  private extractAddressFromEndpoint(endpoint: string): string {
    try {
      const url = new URL(endpoint);
      return `${url.hostname}${url.port ? ':' + url.port : ''}`;
    } catch {
      return endpoint;
    }
  }

  /**
   * Подсчитывает количество series в Prometheus format
   */
  private countSeries(prometheusFormat: string): number {
    const seriesSet = new Set<string>();
    const lines = prometheusFormat.split('\n');
    
    for (const line of lines) {
      if (line.trim() && !line.startsWith('#')) {
        // Извлекаем имя метрики и labels
        const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\{/);
        if (match) {
          seriesSet.add(match[1]);
        }
      }
    }
    
    return seriesSet.size;
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
   * Обновляет TSDB метрики (симуляция роста данных и compaction)
   */
  private updateTSDBMetrics(currentTime: number): void {
    // Симулируем рост samples (увеличиваем на основе scraped samples)
    // В реальности samples накапливаются, но мы симулируем это упрощенно
    
    // Симулируем compaction каждые 2 часа (7200000ms)
    const compactionInterval = 7200000;
    const lastCompaction = this.prometheusMetrics.tsdbCompactionsTotal * compactionInterval;
    if (currentTime - lastCompaction >= compactionInterval) {
      // Compaction уменьшает количество samples (симуляция)
      this.prometheusMetrics.tsdbHeadSamples = Math.floor(this.prometheusMetrics.tsdbHeadSamples * 0.8);
      this.prometheusMetrics.tsdbCompactionsTotal++;
      
      // После compaction увеличиваем storage blocks
      this.prometheusMetrics.tsdbStorageBlocksBytes += this.prometheusMetrics.tsdbHeadSamples * 100; // ~100 bytes per sample
    }

    // Симулируем редкие WAL corruptions (вероятность 0.001% на каждый scrape)
    if (Math.random() < 0.00001) {
      this.prometheusMetrics.tsdbWalCorruptionsTotal++;
    }
  }

  /**
   * Получает метрики самого Prometheus
   */
  getPrometheusMetrics(): typeof this.prometheusMetrics {
    return { ...this.prometheusMetrics };
  }

  /**
   * Экспортирует метрики Prometheus в Prometheus format
   */
  exportPrometheusMetrics(): string {
    const lines: string[] = [];
    const timestamp = Date.now();

    // Scraping метрики
    lines.push('# HELP prometheus_scrape_requests_total Total number of scrape requests');
    lines.push('# TYPE prometheus_scrape_requests_total counter');
    lines.push(`prometheus_scrape_requests_total ${this.prometheusMetrics.scrapeRequestsTotal} ${timestamp}`);

    lines.push('# HELP prometheus_scrape_errors_total Total number of scrape errors');
    lines.push('# TYPE prometheus_scrape_errors_total counter');
    lines.push(`prometheus_scrape_errors_total ${this.prometheusMetrics.scrapeErrorsTotal} ${timestamp}`);

    // TSDB метрики
    lines.push('# HELP prometheus_tsdb_head_samples Number of samples in the head block');
    lines.push('# TYPE prometheus_tsdb_head_samples gauge');
    lines.push(`prometheus_tsdb_head_samples ${this.prometheusMetrics.tsdbHeadSamples} ${timestamp}`);

    lines.push('# HELP prometheus_tsdb_head_series Number of series in the head block');
    lines.push('# TYPE prometheus_tsdb_head_series gauge');
    lines.push(`prometheus_tsdb_head_series ${this.prometheusMetrics.tsdbHeadSeries} ${timestamp}`);

    lines.push('# HELP prometheus_tsdb_compactions_total Total number of compactions');
    lines.push('# TYPE prometheus_tsdb_compactions_total counter');
    lines.push(`prometheus_tsdb_compactions_total ${this.prometheusMetrics.tsdbCompactionsTotal} ${timestamp}`);

    lines.push('# HELP prometheus_tsdb_wal_corruptions_total Total number of WAL corruptions');
    lines.push('# TYPE prometheus_tsdb_wal_corruptions_total counter');
    lines.push(`prometheus_tsdb_wal_corruptions_total ${this.prometheusMetrics.tsdbWalCorruptionsTotal} ${timestamp}`);

    lines.push('# HELP prometheus_tsdb_storage_blocks_bytes Size of storage blocks in bytes');
    lines.push('# TYPE prometheus_tsdb_storage_blocks_bytes gauge');
    lines.push(`prometheus_tsdb_storage_blocks_bytes ${this.prometheusMetrics.tsdbStorageBlocksBytes} ${timestamp}`);

    // Config метрики
    lines.push('# HELP prometheus_config_last_reload_success_timestamp Timestamp of last successful config reload');
    lines.push('# TYPE prometheus_config_last_reload_success_timestamp gauge');
    lines.push(`prometheus_config_last_reload_success_timestamp ${this.prometheusMetrics.configLastReloadSuccessTimestamp} ${timestamp}`);

    lines.push('# HELP prometheus_config_last_reload_successful Whether the last config reload was successful');
    lines.push('# TYPE prometheus_config_last_reload_successful gauge');
    lines.push(`prometheus_config_last_reload_successful ${this.prometheusMetrics.configLastReloadSuccessful} ${timestamp}`);

    // Target метрики
    lines.push('# HELP prometheus_target_scrapes_exceeded_sample_limit_total Total number of scrapes that exceeded sample limit');
    lines.push('# TYPE prometheus_target_scrapes_exceeded_sample_limit_total counter');
    lines.push(`prometheus_target_scrapes_exceeded_sample_limit_total ${this.prometheusMetrics.targetScrapesExceededSampleLimitTotal} ${timestamp}`);

    lines.push('# HELP prometheus_target_scrape_pool_sync_total Total number of scrape pool syncs');
    lines.push('# TYPE prometheus_target_scrape_pool_sync_total counter');
    lines.push(`prometheus_target_scrape_pool_sync_total ${this.prometheusMetrics.targetScrapePoolSyncTotal} ${timestamp}`);

    // Метрики для каждого target
    for (const [key, status] of this.targetStatuses.entries()) {
      const labels = `job="${status.job}",instance="${this.extractAddressFromEndpoint(status.endpoint)}"`;
      
      lines.push(`# HELP up Whether the target is up`);
      lines.push(`# TYPE up gauge`);
      lines.push(`up{${labels}} ${status.up ? 1 : 0} ${timestamp}`);

      if (status.scrapeDuration !== null) {
        lines.push(`# HELP scrape_duration_seconds Duration of the scrape`);
        lines.push(`# TYPE scrape_duration_seconds gauge`);
        lines.push(`scrape_duration_seconds{${labels}} ${status.scrapeDuration / 1000} ${timestamp}`);
      }

      lines.push(`# HELP scrape_samples_scraped Number of samples scraped`);
      lines.push(`# TYPE scrape_samples_scraped gauge`);
      lines.push(`scrape_samples_scraped{${labels}} ${status.samplesScraped} ${timestamp}`);
    }

    // Alerting метрики
    lines.push('# HELP prometheus_alerting_rules_last_evaluation_timestamp Timestamp of last alerting rules evaluation');
    lines.push('# TYPE prometheus_alerting_rules_last_evaluation_timestamp gauge');
    lines.push(`prometheus_alerting_rules_last_evaluation_timestamp ${this.prometheusMetrics.alertingRulesLastEvaluationTimestamp} ${timestamp}`);

    lines.push('# HELP prometheus_alerting_rules_last_evaluation_duration_seconds Duration of last alerting rules evaluation in seconds');
    lines.push('# TYPE prometheus_alerting_rules_last_evaluation_duration_seconds gauge');
    lines.push(`prometheus_alerting_rules_last_evaluation_duration_seconds ${this.prometheusMetrics.alertingRulesLastEvaluationDurationSeconds} ${timestamp}`);

    lines.push('# HELP prometheus_notifications_total Total number of notifications sent');
    lines.push('# TYPE prometheus_notifications_total counter');
    lines.push(`prometheus_notifications_total ${this.prometheusMetrics.notificationsTotal} ${timestamp}`);

    lines.push('# HELP prometheus_notifications_failed_total Total number of failed notifications');
    lines.push('# TYPE prometheus_notifications_failed_total counter');
    lines.push(`prometheus_notifications_failed_total ${this.prometheusMetrics.notificationsFailedTotal} ${timestamp}`);

    return lines.join('\n') + '\n';
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

  /**
   * Инициализирует alert states для всех alerting rules
   */
  private initializeAlertStates(): void {
    this.alertStates.clear();
    
    if (!this.config?.alerting_rules) return;

    for (const rule of this.config.alerting_rules) {
      this.alertStates.set(rule.name, {
        ruleName: rule.name,
        state: 'inactive',
        activeSince: 0,
        lastEvaluation: 0,
        lastEvaluationDuration: 0,
        value: null,
        labels: rule.labels || {},
        annotations: rule.annotations || {},
      });
    }
  }

  /**
   * Выполняет evaluation alerting rules
   */
  private evaluateAlertingRules(
    currentTime: number,
    allNodes: CanvasNode[],
    allMetrics: Map<string, ComponentMetrics>
  ): void {
    if (!this.config?.alerting_rules || this.config.alerting_rules.length === 0) return;

    const startTime = performance.now();

    // Создаем evaluator
    const nodesMap = new Map<string, CanvasNode>();
    for (const node of allNodes) {
      nodesMap.set(node.id, node);
    }

    const targetLabelsMap = new Map<string, Record<string, string>>();
    for (const [key, status] of this.targetStatuses.entries()) {
      targetLabelsMap.set(key, status.labels || {});
    }

    const evaluator = new PromQLEvaluator(this.scrapedMetrics, nodesMap, targetLabelsMap);

    // Оцениваем каждое правило
    for (const rule of this.config.alerting_rules) {
      const alertState = this.alertStates.get(rule.name);
      if (!alertState) continue;

      try {
        // Выполняем PromQL запрос
        const result = evaluator.evaluate(rule.expr);
        alertState.value = result.value;
        alertState.lastEvaluation = currentTime;

        // Проверяем условие (value > 0 означает true для сравнений)
        const isActive = result.success && result.value !== null && result.value > 0;

        if (isActive) {
          // Alert активен
          if (alertState.state === 'inactive') {
            // Переход из inactive в pending
            alertState.state = 'pending';
            alertState.activeSince = currentTime;
          } else if (alertState.state === 'pending') {
            // Проверяем "for" duration
            const forDuration = rule.for ? this.parseDuration(rule.for) : 0;
            if (forDuration > 0 && currentTime - alertState.activeSince >= forDuration) {
              // Переход из pending в firing
              alertState.state = 'firing';
              // Отправляем alert в Alertmanager
              this.sendAlertToAlertmanager(rule, alertState, currentTime);
            }
          } else if (alertState.state === 'firing') {
            // Alert уже firing, продолжаем отправлять
            this.sendAlertToAlertmanager(rule, alertState, currentTime);
          }
        } else {
          // Alert неактивен
          if (alertState.state === 'firing' || alertState.state === 'pending') {
            // Переход в inactive
            alertState.state = 'inactive';
            alertState.activeSince = 0;
          }
        }
      } catch (error) {
        // Ошибка при evaluation
        alertState.value = null;
        alertState.lastEvaluation = currentTime;
        if (alertState.state !== 'inactive') {
          alertState.state = 'inactive';
          alertState.activeSince = 0;
        }
      }
    }

    const duration = performance.now() - startTime;
    this.prometheusMetrics.alertingRulesLastEvaluationTimestamp = currentTime;
    this.prometheusMetrics.alertingRulesLastEvaluationDurationSeconds = duration / 1000;
  }

  /**
   * Выполняет evaluation recording rules
   */
  private evaluateRecordingRules(
    currentTime: number,
    allNodes: CanvasNode[],
    allMetrics: Map<string, ComponentMetrics>
  ): void {
    if (!this.config?.recording_rules || this.config.recording_rules.length === 0) return;

    // Создаем evaluator
    const nodesMap = new Map<string, CanvasNode>();
    for (const node of allNodes) {
      nodesMap.set(node.id, node);
    }

    const targetLabelsMap = new Map<string, Record<string, string>>();
    for (const [key, status] of this.targetStatuses.entries()) {
      targetLabelsMap.set(key, status.labels || {});
    }

    const evaluator = new PromQLEvaluator(this.scrapedMetrics, nodesMap, targetLabelsMap);

    // Оцениваем каждое правило
    for (const rule of this.config.recording_rules) {
      try {
        const result = evaluator.evaluate(rule.expr);
        if (result.success && result.value !== null) {
          // Сохраняем результат как новую метрику
          this.recordingRuleResults.set(rule.name, result.value);
        }
      } catch (error) {
        // Ошибка при evaluation - игнорируем
      }
    }
  }

  /**
   * Отправляет alert в Alertmanager (симуляция)
   */
  private sendAlertToAlertmanager(
    rule: AlertingRule,
    alertState: AlertState,
    currentTime: number
  ): void {
    if (!this.config?.alerting?.alertmanagers || this.config.alerting.alertmanagers.length === 0) {
      return;
    }

    // Симулируем отправку alert в Alertmanager
    // В реальности это HTTP POST запрос к Alertmanager API
    // В симуляции мы просто увеличиваем счетчики метрик

    this.prometheusMetrics.notificationsTotal++;

    // Симулируем возможную ошибку отправки (вероятность 1%)
    if (Math.random() < 0.01) {
      this.prometheusMetrics.notificationsFailedTotal++;
    }
  }

  /**
   * Получает состояние всех алертов
   */
  getAlertStates(): AlertState[] {
    return Array.from(this.alertStates.values());
  }

  /**
   * Получает результаты recording rules
   */
  getRecordingRuleResults(): Map<string, number> {
    return new Map(this.recordingRuleResults);
  }
}


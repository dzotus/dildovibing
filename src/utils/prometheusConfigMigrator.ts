/**
 * Prometheus Config Migrator
 * Конвертирует старую структуру конфига (targets) в новую (scrape_configs)
 */

interface ScrapeTarget {
  job: string;
  endpoint: string;
  interval?: string;
  metricsPath?: string;
  scrapeTimeout?: string;
  labels?: Record<string, string>;
  status?: 'up' | 'down';
}

interface StaticConfig {
  targets: string[];
  labels?: Record<string, string>;
}

interface ScrapeConfig {
  job_name: string;
  scrape_interval?: string;
  scrape_timeout?: string;
  metrics_path?: string;
  static_configs: StaticConfig[];
}

/**
 * Извлекает host:port из endpoint URL
 */
function extractHostPort(endpoint: string): string | null {
  try {
    const url = new URL(endpoint);
    if (url.port) {
      return `${url.hostname}:${url.port}`;
    }
    // Если порт не указан, используем стандартный для протокола
    if (url.protocol === 'https:') {
      return `${url.hostname}:443`;
    }
    return `${url.hostname}:80`;
  } catch {
    // Если не валидный URL, пытаемся извлечь напрямую
    const match = endpoint.match(/^https?:\/\/([^\/]+)/);
    return match ? match[1] : null;
  }
}

/**
 * Извлекает путь метрик из endpoint
 */
function extractMetricsPath(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    return url.pathname || '/metrics';
  } catch {
    // Если не валидный URL, пытаемся найти путь
    const match = endpoint.match(/^https?:\/\/[^\/]+(\/.*)/);
    return match ? match[1] : '/metrics';
  }
}

/**
 * Конвертирует старые targets в новую структуру scrape_configs
 */
export function migrateTargetsToScrapeConfigs(
  oldTargets: ScrapeTarget[],
  globalScrapeInterval: string = '15s'
): ScrapeConfig[] {
  if (!oldTargets || oldTargets.length === 0) {
    return [];
  }

  // Группируем targets по job
  const targetsByJob = new Map<string, ScrapeTarget[]>();
  
  for (const target of oldTargets) {
    const jobName = target.job || 'default';
    if (!targetsByJob.has(jobName)) {
      targetsByJob.set(jobName, []);
    }
    targetsByJob.get(jobName)!.push(target);
  }

  // Создаем scrape_configs для каждого job
  const scrapeConfigs: ScrapeConfig[] = [];

  for (const [jobName, targets] of targetsByJob.entries()) {
    // Группируем targets по labels (для создания нескольких static_configs)
    const targetsByLabels = new Map<string, ScrapeTarget[]>();
    
    for (const target of targets) {
      const labelsKey = JSON.stringify(target.labels || {});
      if (!targetsByLabels.has(labelsKey)) {
        targetsByLabels.set(labelsKey, []);
      }
      targetsByLabels.get(labelsKey)!.push(target);
    }

    const staticConfigs: StaticConfig[] = [];
    let scrapeInterval: string | undefined;
    let metricsPath: string | undefined;
    let scrapeTimeout: string | undefined;

    // Создаем static_config для каждой группы labels
    for (const [labelsKey, groupedTargets] of targetsByLabels.entries()) {
      const labels = JSON.parse(labelsKey);
      const targetHosts: string[] = [];

      for (const target of groupedTargets) {
        const hostPort = extractHostPort(target.endpoint);
        if (hostPort) {
          targetHosts.push(hostPort);
        }

        // Берем параметры из первого target (они должны быть одинаковые для одного job)
        if (!scrapeInterval && target.interval) {
          scrapeInterval = target.interval;
        }
        if (!metricsPath && target.metricsPath) {
          metricsPath = target.metricsPath;
        } else if (!metricsPath) {
          // Извлекаем путь из endpoint
          metricsPath = extractMetricsPath(target.endpoint);
        }
        if (!scrapeTimeout && target.scrapeTimeout) {
          scrapeTimeout = target.scrapeTimeout;
        }
      }

      if (targetHosts.length > 0) {
        staticConfigs.push({
          targets: targetHosts,
          labels: Object.keys(labels).length > 0 ? labels : undefined,
        });
      }
    }

    if (staticConfigs.length > 0) {
      const scrapeConfig: ScrapeConfig = {
        job_name: jobName,
        static_configs: staticConfigs,
      };

      // Добавляем параметры только если они отличаются от глобальных
      if (scrapeInterval && scrapeInterval !== globalScrapeInterval) {
        scrapeConfig.scrape_interval = scrapeInterval;
      }
      if (metricsPath && metricsPath !== '/metrics') {
        scrapeConfig.metrics_path = metricsPath;
      }
      if (scrapeTimeout) {
        scrapeConfig.scrape_timeout = scrapeTimeout;
      }

      scrapeConfigs.push(scrapeConfig);
    }
  }

  return scrapeConfigs;
}

/**
 * Проверяет, нужно ли мигрировать конфиг (есть старая структура)
 */
export function needsMigration(config: any): boolean {
  return config.targets && Array.isArray(config.targets) && config.targets.length > 0 && !config.scrape_configs;
}

/**
 * Выполняет миграцию конфига (если нужно)
 */
export function migrateConfigIfNeeded(config: any): any {
  if (!needsMigration(config)) {
    return config;
  }

  const scrapeConfigs = migrateTargetsToScrapeConfigs(
    config.targets,
    config.scrapeInterval || '15s'
  );

  // Создаем новый конфиг с мигрированными данными
  const migrated = {
    ...config,
    scrape_configs: scrapeConfigs,
    // Оставляем targets для обратной совместимости, но помечаем как deprecated
    // Можно удалить после полной миграции
  };

  return migrated;
}


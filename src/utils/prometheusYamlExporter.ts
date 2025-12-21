/**
 * Prometheus YAML Exporter
 * Экспортирует конфигурацию Prometheus в YAML формат (как реальный prometheus.yml)
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

interface AlertingRule {
  name: string;
  expr: string;
  for?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  severity?: 'critical' | 'warning' | 'info';
}

interface RecordingRule {
  name: string;
  expr: string;
  labels?: Record<string, string>;
}

interface ServiceDiscovery {
  type: 'kubernetes' | 'consul' | 'static' | 'file' | 'dns';
  config: Record<string, any>;
}

interface RemoteWriteEndpoint {
  url: string;
  auth?: string;
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

interface PrometheusConfig {
  version?: string;
  scrapeInterval?: string;
  evaluationInterval?: string;
  retentionTime?: string;
  storagePath?: string;
  enableRemoteWrite?: boolean;
  remoteWrite?: RemoteWriteEndpoint[];
  alertmanagerUrl?: string;
  enableAlertmanager?: boolean;
  // Новая структура (приоритет)
  scrape_configs?: ScrapeConfig[];
  // Старая структура (для обратной совместимости)
  targets?: ScrapeTarget[];
  alertingRules?: AlertingRule[];
  recordingRules?: RecordingRule[];
  serviceDiscovery?: ServiceDiscovery[];
}

/**
 * Конвертирует endpoint в target (host:port)
 */
function endpointToTarget(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    if (url.port) {
      return `${url.hostname}:${url.port}`;
    }
    return url.hostname;
  } catch {
    // Если не валидный URL, пытаемся извлечь host:port напрямую
    const match = endpoint.match(/^https?:\/\/([^\/]+)/);
    return match ? match[1] : endpoint;
  }
}

/**
 * Группирует targets по job
 */
function groupTargetsByJob(targets: ScrapeTarget[]): Map<string, ScrapeTarget[]> {
  const grouped = new Map<string, ScrapeTarget[]>();
  
  for (const target of targets) {
    const job = target.job || 'default';
    if (!grouped.has(job)) {
      grouped.set(job, []);
    }
    grouped.get(job)!.push(target);
  }
  
  return grouped;
}

/**
 * Экспортирует конфиг Prometheus в YAML формат
 */
export function exportPrometheusConfig(config: PrometheusConfig): string {
  const lines: string[] = [];
  
  // Global configuration
  lines.push('global:');
  if (config.scrapeInterval) {
    lines.push(`  scrape_interval: ${config.scrapeInterval}`);
  }
  if (config.evaluationInterval) {
    lines.push(`  evaluation_interval: ${config.evaluationInterval}`);
  }
  if (config.storagePath) {
    // storagePath не является стандартным полем в prometheus.yml
    // но можно добавить как комментарий
    lines.push(`  # storage.tsdb.path: ${config.storagePath}`);
  }
  if (config.retentionTime) {
    lines.push(`  # storage.tsdb.retention.time: ${config.retentionTime}`);
  }
  lines.push('');

  // Scrape configurations
  const globalInterval = config.scrapeInterval || '15s';
  
  if (config.scrape_configs && config.scrape_configs.length > 0) {
    // Используем новую структуру
    lines.push('scrape_configs:');
    
    for (const scrapeConfig of config.scrape_configs) {
      lines.push(`  - job_name: '${escapeYamlString(scrapeConfig.job_name)}'`);
      
      if (scrapeConfig.scrape_interval && scrapeConfig.scrape_interval !== globalInterval) {
        lines.push(`    scrape_interval: ${scrapeConfig.scrape_interval}`);
      }
      
      if (scrapeConfig.scrape_timeout) {
        lines.push(`    scrape_timeout: ${scrapeConfig.scrape_timeout}`);
      }
      
      if (scrapeConfig.metrics_path && scrapeConfig.metrics_path !== '/metrics') {
        lines.push(`    metrics_path: '${escapeYamlString(scrapeConfig.metrics_path)}'`);
      }
      
      // Static configs
      lines.push('    static_configs:');
      
      for (const staticConfig of scrapeConfig.static_configs || []) {
        lines.push('      - targets:');
        
        for (const target of staticConfig.targets || []) {
          lines.push(`          - '${escapeYamlString(target)}'`);
        }
        
        if (staticConfig.labels && Object.keys(staticConfig.labels).length > 0) {
          lines.push('        labels:');
          for (const [key, value] of Object.entries(staticConfig.labels)) {
            lines.push(`          ${key}: '${escapeYamlString(String(value))}'`);
          }
        }
      }
      
      lines.push('');
    }
  } else if (config.targets && config.targets.length > 0) {
    // Обратная совместимость: конвертируем старую структуру
    lines.push('scrape_configs:');
    const targetsByJob = groupTargetsByJob(config.targets);
    
    for (const [jobName, targets] of targetsByJob.entries()) {
      const firstTarget = targets[0];
      const scrapeInterval = firstTarget.interval || globalInterval;
      const metricsPath = firstTarget.metricsPath || '/metrics';
      const scrapeTimeout = firstTarget.scrapeTimeout;
      
      lines.push(`  - job_name: '${escapeYamlString(jobName)}'`);
      
      if (scrapeInterval !== globalInterval) {
        lines.push(`    scrape_interval: ${scrapeInterval}`);
      }
      
      if (scrapeTimeout) {
        lines.push(`    scrape_timeout: ${scrapeTimeout}`);
      }
      
      if (metricsPath !== '/metrics') {
        lines.push(`    metrics_path: '${escapeYamlString(metricsPath)}'`);
      }
      
      lines.push('    static_configs:');
      
      // Группируем targets с одинаковыми labels
      const targetsByLabels = new Map<string, ScrapeTarget[]>();
      for (const target of targets) {
        const labelsKey = JSON.stringify(target.labels || {});
        if (!targetsByLabels.has(labelsKey)) {
          targetsByLabels.set(labelsKey, []);
        }
        targetsByLabels.get(labelsKey)!.push(target);
      }
      
      for (const [labelsKey, groupedTargets] of targetsByLabels.entries()) {
        const labels = JSON.parse(labelsKey);
        lines.push('      - targets:');
        
        for (const target of groupedTargets) {
          const targetStr = endpointToTarget(target.endpoint);
          lines.push(`          - '${escapeYamlString(targetStr)}'`);
        }
        
        if (Object.keys(labels).length > 0) {
          lines.push('        labels:');
          for (const [key, value] of Object.entries(labels)) {
            lines.push(`          ${key}: '${escapeYamlString(String(value))}'`);
          }
        }
      }
      
      lines.push('');
    }
  } else {
    lines.push('scrape_configs: []');
    lines.push('');
  }

  // Alerting configuration
  if (config.enableAlertmanager && config.alertmanagerUrl) {
    lines.push('alerting:');
    lines.push('  alertmanagers:');
    lines.push('    - static_configs:');
    lines.push('        - targets:');
    const alertmanagerTarget = endpointToTarget(config.alertmanagerUrl);
    lines.push(`            - '${escapeYamlString(alertmanagerTarget)}'`);
    lines.push('');
  }

  // Remote write configuration
  if (config.enableRemoteWrite && config.remoteWrite && config.remoteWrite.length > 0) {
    lines.push('remote_write:');
    for (const endpoint of config.remoteWrite) {
      lines.push('  - url:');
      lines.push(`      '${escapeYamlString(endpoint.url)}'`);
      if (endpoint.auth) {
        lines.push('    # Authorization header should be configured via file or environment');
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Экспортирует alerting rules в отдельный YAML файл
 */
export function exportAlertingRules(rules: AlertingRule[]): string {
  if (rules.length === 0) {
    return '';
  }

  const lines: string[] = ['groups:'];
  lines.push('  - name: alerts');
  lines.push('    rules:');
  
  for (const rule of rules) {
    lines.push(`      - alert: ${rule.name}`);
    lines.push(`        expr: ${rule.expr}`);
    
    if (rule.for) {
      lines.push(`        for: ${rule.for}`);
    }
    
    if (rule.labels && Object.keys(rule.labels).length > 0) {
      lines.push('        labels:');
      for (const [key, value] of Object.entries(rule.labels)) {
        lines.push(`          ${key}: '${escapeYamlString(String(value))}'`);
      }
    }
    
    if (rule.annotations && Object.keys(rule.annotations).length > 0) {
      lines.push('        annotations:');
      for (const [key, value] of Object.entries(rule.annotations)) {
        lines.push(`          ${key}: '${escapeYamlString(String(value))}'`);
      }
    }
    
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Экспортирует recording rules в отдельный YAML файл
 */
export function exportRecordingRules(rules: RecordingRule[]): string {
  if (rules.length === 0) {
    return '';
  }

  const lines: string[] = ['groups:'];
  lines.push('  - name: recording_rules');
  lines.push('    rules:');
  
  for (const rule of rules) {
    lines.push(`      - record: ${rule.name}`);
    lines.push(`        expr: ${rule.expr}`);
    
    if (rule.labels && Object.keys(rule.labels).length > 0) {
      lines.push('        labels:');
      for (const [key, value] of Object.entries(rule.labels)) {
        lines.push(`          ${key}: '${escapeYamlString(String(value))}'`);
      }
    }
    
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Экранирует строку для YAML
 */
function escapeYamlString(str: string): string {
  // Экранируем специальные символы
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/\n/g, '\\n');
}


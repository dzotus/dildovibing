import { CanvasNode, CanvasConnection } from '@/types';
import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';

/**
 * Получить порт метрик для компонента
 */
function getMetricsPort(node: CanvasNode, discovery: ServiceDiscovery): number | undefined {
  const config = node.data.config || {};
  
  // Проверяем конфиг на наличие порта метрик
  if (config.metrics?.port) {
    return config.metrics.port;
  }
  
  if (config.metricsPort) {
    return config.metricsPort;
  }
  
  // Для Service Mesh проверяем controlPlanePort
  if (node.type === 'service-mesh' || node.type === 'istio') {
    if (config.metrics?.controlPlanePort) {
      return config.metrics.controlPlanePort;
    }
  }
  
  // Проверяем через ServiceDiscovery
  return discovery.getPort(node, 'metrics');
}

/**
 * Получить путь метрик для компонента
 */
function getMetricsPath(node: CanvasNode): string {
  const config = node.data.config || {};
  
  // Проверяем конфиг на наличие пути метрик
  if (config.metrics?.path) {
    return config.metrics.path;
  }
  
  if (config.metricsPath) {
    return config.metricsPath;
  }
  
  // Специальные пути для некоторых компонентов
  if (node.type === 'envoy') {
    return config.metrics?.prometheusPath || '/stats/prometheus';
  }
  
  // Дефолтный путь
  return '/metrics';
}

/**
 * Получить job name для scrape target
 */
function getJobName(source: CanvasNode): string {
  if (source.data.label) {
    return source.data.label.toLowerCase().replace(/\s+/g, '-');
  }
  return `${source.type}-${source.id.slice(0, 8)}`;
}

/**
 * Получить endpoint для scrape target (полный URL, для обратной совместимости)
 */
function getScrapeEndpoint(source: CanvasNode, discovery: ServiceDiscovery): string | null {
  const host = discovery.getHost(source);
  const metricsPort = getMetricsPort(source, discovery);
  
  if (!metricsPort) {
    // Если нет порта метрик, используем основной порт
    const mainPort = discovery.getPort(source, 'main');
    if (!mainPort) {
      return null;
    }
    const path = getMetricsPath(source);
    return `http://${host}:${mainPort}${path}`;
  }
  
  const path = getMetricsPath(source);
  return `http://${host}:${metricsPort}${path}`;
}

/**
 * Получить host:port для scrape target (новая структура)
 */
function getScrapeTarget(source: CanvasNode, discovery: ServiceDiscovery): string | null {
  const host = discovery.getHost(source);
  const metricsPort = getMetricsPort(source, discovery);
  
  if (!metricsPort) {
    const mainPort = discovery.getPort(source, 'main');
    if (!mainPort) {
      return null;
    }
    return `${host}:${mainPort}`;
  }
  
  return `${host}:${metricsPort}`;
}

/**
 * Правило для Component -> Prometheus
 * Автоматически добавляет scrape target в Prometheus при создании связи
 */
export function createPrometheusRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: '*', // Любой компонент может подключаться к Prometheus
    targetTypes: ['prometheus'],
    priority: 5,
    
    updateTargetConfig: (source, prometheus, connection, metadata) => {
      // Обновляем конфиг Prometheus (target)
      const config = prometheus.data.config || {};
      const scrapeConfigs = config.scrape_configs || [];
      const scrapeInterval = config.scrapeInterval || '15s';
      const metricsPath = getMetricsPath(source);
      
      // Получаем target (host:port) и job name
      const target = getScrapeTarget(source, discovery);
      if (!target) {
        // Если не можем определить target, пропускаем
        return null;
      }
      
      const jobName = getJobName(source);
      const labels = {
        component: source.type,
        componentId: source.id,
      };
      
      // Ищем существующий scrape_config с таким job_name
      const existingConfigIndex = scrapeConfigs.findIndex((sc: any) => sc.job_name === jobName);
      
      if (existingConfigIndex >= 0) {
        // Job уже существует, проверяем есть ли уже такой target
        const existingConfig = scrapeConfigs[existingConfigIndex];
        
        // Проверяем все static_configs
        let targetExists = false;
        for (const staticConfig of existingConfig.static_configs || []) {
          if (staticConfig.targets && staticConfig.targets.includes(target)) {
            targetExists = true;
            break;
          }
          // Также проверяем по labels (componentId)
          if (staticConfig.labels?.componentId === source.id) {
            // Добавляем target в этот static_config если его там нет
            if (!staticConfig.targets.includes(target)) {
              staticConfig.targets.push(target);
            }
            targetExists = true;
            break;
          }
        }
        
        if (!targetExists) {
          // Добавляем новый static_config с этим target и labels
          const updatedConfigs = [...scrapeConfigs];
          const updatedStaticConfigs = [...(existingConfig.static_configs || [])];
          updatedStaticConfigs.push({
            targets: [target],
            labels,
          });
          updatedConfigs[existingConfigIndex] = {
            ...existingConfig,
            static_configs: updatedStaticConfigs,
          };
          
          return {
            scrape_configs: updatedConfigs,
          };
        }
        
        // Target уже существует
        return null;
      }
      
      // Создаем новый scrape_config
      const newScrapeConfig = {
        job_name: jobName,
        scrape_interval: scrapeInterval !== '15s' ? scrapeInterval : undefined,
        metrics_path: metricsPath !== '/metrics' ? metricsPath : undefined,
        static_configs: [{
          targets: [target],
          labels,
        }],
      };
      
      return {
        scrape_configs: [...scrapeConfigs, newScrapeConfig],
      };
    },
    
    extractMetadata: (source, prometheus, connection) => {
      return discovery.getConnectionMetadata(source, prometheus, connection);
    },
    
    // Cleanup: удаление scrape target при удалении связи
    cleanupTargetConfig: (source, prometheus, connection, metadata) => {
      const config = prometheus.data.config || {};
      const scrapeConfigs = config.scrape_configs || [];
      
      if (!scrapeConfigs || scrapeConfigs.length === 0) {
        return null;
      }
      
      // Получаем target и job name для источника
      const target = getScrapeTarget(source, discovery);
      const jobName = getJobName(source);
      const sourceId = source.id;
      
      let hasChanges = false;
      const updatedConfigs = scrapeConfigs.map((scrapeConfig: any) => {
        // Если job_name не совпадает, пропускаем
        if (scrapeConfig.job_name !== jobName) {
          return scrapeConfig;
        }
        
        // Фильтруем static_configs
        const filteredStaticConfigs = (scrapeConfig.static_configs || []).map((staticConfig: any) => {
          // Проверяем по componentId в labels
          if (staticConfig.labels?.componentId === sourceId) {
            hasChanges = true;
            return null; // Удаляем этот static_config
          }
          
          // Проверяем по target
          if (target && staticConfig.targets && staticConfig.targets.includes(target)) {
            const filteredTargets = staticConfig.targets.filter((t: string) => t !== target);
            if (filteredTargets.length === 0) {
              hasChanges = true;
              return null; // Удаляем static_config если targets пуст
            }
            hasChanges = true;
            return {
              ...staticConfig,
              targets: filteredTargets,
            };
          }
          
          return staticConfig;
        }).filter((sc: any) => sc !== null);
        
        // Если все static_configs удалены, удаляем весь scrape_config
        if (filteredStaticConfigs.length === 0) {
          hasChanges = true;
          return null;
        }
        
        return {
          ...scrapeConfig,
          static_configs: filteredStaticConfigs,
        };
      }).filter((sc: any) => sc !== null);
      
      if (!hasChanges) {
        return null;
      }
      
      return {
        scrape_configs: updatedConfigs,
      };
    },
  };
}

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
 * Получить endpoint для scrape target
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
      const targets = config.targets || [];
      const scrapeInterval = config.scrapeInterval || '15s';
      
      // Получаем endpoint для метрик
      const endpoint = getScrapeEndpoint(source, discovery);
      if (!endpoint) {
        // Если не можем определить endpoint, пропускаем
        return null;
      }
      
      // Получаем job name
      const jobName = getJobName(source);
      
      // Проверяем, есть ли уже такой target
      const existingTarget = targets.find((target: any) => 
        target.endpoint === endpoint || 
        (target.job === jobName && target.endpoint?.includes(discovery.getHost(source)))
      );
      
      if (existingTarget) {
        // Target уже существует, обновляем его
        return null;
      }
      
      // Создаем новый scrape target
      const newTarget = {
        job: jobName,
        endpoint: endpoint,
        interval: scrapeInterval,
        metricsPath: getMetricsPath(source),
        status: 'up' as const,
        labels: {
          component: source.type,
          componentId: source.id,
        },
      };
      
      return {
        targets: [...targets, newTarget],
      };
    },
    
    extractMetadata: (source, prometheus, connection) => {
      return discovery.getConnectionMetadata(source, prometheus, connection);
    },
    
    // Cleanup: удаление scrape target при удалении связи
    cleanupTargetConfig: (source, prometheus, connection, metadata) => {
      const config = prometheus.data.config || {};
      const targets = config.targets || [];
      
      if (!targets || targets.length === 0) {
        return null;
      }
      
      // Получаем endpoint для метрик источника
      const endpoint = getScrapeEndpoint(source, discovery);
      const jobName = getJobName(source);
      const sourceHost = discovery.getHost(source);
      
      // Удаляем target, который соответствует источнику
      const filteredTargets = targets.filter((target: any) => {
        // Проверяем по endpoint
        if (endpoint && target.endpoint === endpoint) {
          return false;
        }
        
        // Проверяем по job name и host
        if (target.job === jobName && target.endpoint?.includes(sourceHost)) {
          return false;
        }
        
        // Проверяем по componentId в labels
        if (target.labels?.componentId === source.id) {
          return false;
        }
        
        return true;
      });
      
      // Если ничего не изменилось, возвращаем null
      if (filteredTargets.length === targets.length) {
        return null;
      }
      
      return {
        targets: filteredTargets,
      };
    },
  };
}

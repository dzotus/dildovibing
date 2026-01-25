import { CanvasNode } from '@/types';
import { ServiceDiscovery } from '@/services/connection/ServiceDiscovery';

/**
 * Consul Service Discovery Target
 * Соответствует формату Prometheus consul_sd_configs
 */
export interface ConsulSDTarget {
  __meta_consul_node?: string;
  __meta_consul_service_id?: string;
  __meta_consul_service_name?: string;
  __meta_consul_service_address?: string;
  __meta_consul_service_port?: string;
  __meta_consul_dc?: string;
  __meta_consul_service_health?: string;
  
  // Final target (host:port)
  __address__?: string;
  __metrics_path__?: string;
  __scheme__?: string;
  
  // Dynamic metadata and tags (using index signature)
  // Format: __meta_consul_service_metadata_<key> or __meta_consul_service_tag_<index>
  [key: string]: string | undefined;
}

/**
 * Consul Service Discovery Configuration
 * Соответствует формату Prometheus consul_sd_configs
 */
export interface ConsulSDConfig {
  server?: string;
  token?: string;
  datacenter?: string;
  scheme?: 'http' | 'https';
  services?: string[]; // Filter by service names
  tags?: string[]; // Filter by tags
  node_meta?: Record<string, string>; // Filter by node metadata
  allow_stale?: boolean;
  // Дополнительные настройки для симуляции
  consul_node_id?: string; // ID компонента Consul на canvas
}

/**
 * Consul Service Discovery
 * Симулирует работу Prometheus Consul Service Discovery
 * Периодически опрашивает Consul API для получения списка сервисов
 */
export class ConsulSD {
  private config: ConsulSDConfig | null = null;
  private consulNode: CanvasNode | null = null;
  private allNodes: CanvasNode[] = [];
  private discovery: ServiceDiscovery;
  
  // Кэш для targets
  private cachedTargets: ConsulSDTarget[] = [];
  private lastDiscoveryTime: number = 0;
  private discoveryInterval: number = 30000; // 30 секунд (как в реальном Prometheus)
  
  // Метрики
  private metrics = {
    targetsDiscovered: 0,
    lastDiscoveryDuration: 0,
    discoveryErrors: 0,
  };

  constructor(discovery: ServiceDiscovery) {
    this.discovery = discovery;
  }

  /**
   * Инициализирует Consul Service Discovery
   */
  initialize(
    config: ConsulSDConfig,
    allNodes: CanvasNode[]
  ): void {
    this.config = config;
    this.allNodes = allNodes;
    this.lastDiscoveryTime = 0;
    
    // Находим Consul компонент если он есть
    if (config.consul_node_id) {
      this.consulNode = allNodes.find(n => n.id === config.consul_node_id) || null;
    } else {
      // Ищем первый Consul компонент
      this.consulNode = allNodes.find(n => n.type === 'consul') || null;
    }
    
    // Выполняем первичное discovery
    this.discoverTargets();
  }

  /**
   * Обновляет список nodes (вызывается при изменении canvas)
   */
  updateNodes(allNodes: CanvasNode[]): void {
    this.allNodes = allNodes;
    
    // Находим Consul компонент если он есть
    if (this.config?.consul_node_id) {
      this.consulNode = allNodes.find(n => n.id === this.config!.consul_node_id) || null;
    } else {
      // Ищем первый Consul компонент
      this.consulNode = allNodes.find(n => n.type === 'consul') || null;
    }
  }

  /**
   * Выполняет discovery targets
   * Симулирует опрос Consul API
   */
  discoverTargets(): ConsulSDTarget[] {
    if (!this.config) {
      return [];
    }

    const startTime = performance.now();
    
    try {
      const targets: ConsulSDTarget[] = [];
      
      // Симулируем получение сервисов из Consul
      // В реальности это HTTP запрос к Consul API: GET /v1/catalog/services
      // Для симуляции мы ищем компоненты на canvas, которые могут экспортировать метрики
      
      // Ищем компоненты, которые могут быть зарегистрированы в Consul
      // (любые компоненты, которые экспортируют метрики)
      for (const node of this.allNodes) {
        // Пропускаем сам Consul и Prometheus
        if (node.type === 'consul' || node.type === 'prometheus') {
          continue;
        }

        // Проверяем, есть ли у компонента метрики
        const metricsPort = this.discovery.getPort(node, 'metrics');
        const mainPort = this.discovery.getPort(node, 'main');
        
        if (!metricsPort && !mainPort) {
          continue;
        }

        const host = this.discovery.getHost(node);
        const port = metricsPort || mainPort || 8080;
        
        // Получаем конфигурацию компонента для получения metadata/tags
        const config = node.data.config || {};
        const serviceName = node.data.label || `${node.type}-${node.id.slice(0, 8)}`;
        const serviceId = `${serviceName}-${node.id}`;
        
        // Применяем фильтры по services
        if (this.config.services && this.config.services.length > 0) {
          if (!this.config.services.includes(serviceName)) {
            continue;
          }
        }
        
        // Применяем фильтры по tags (если есть в конфиге)
        const tags = config.tags || [];
        if (this.config.tags && this.config.tags.length > 0) {
          const hasMatchingTag = this.config.tags.some(tag => tags.includes(tag));
          if (!hasMatchingTag) {
            continue;
          }
        }

        const target: ConsulSDTarget = {
          __meta_consul_node: host,
          __meta_consul_service_id: serviceId,
          __meta_consul_service_name: serviceName,
          __meta_consul_service_address: host,
          __meta_consul_service_port: String(port),
          __meta_consul_dc: this.config.datacenter || 'dc1',
          __meta_consul_service_health: 'passing', // Упрощение - все сервисы healthy
          __address__: `${host}:${port}`,
          __metrics_path__: config.metrics?.path || config.metricsPath || '/metrics',
          __scheme__: config.metrics?.scheme || 'http',
        };

        // Добавляем metadata из конфига
        if (config.metadata) {
          for (const [key, value] of Object.entries(config.metadata)) {
            target[`__meta_consul_service_metadata_${key.replace(/[^a-zA-Z0-9_]/g, '_')}` as keyof ConsulSDTarget] = String(value);
          }
        }

        // Добавляем tags
        for (let i = 0; i < tags.length; i++) {
          target[`__meta_consul_service_tag_${i}` as keyof ConsulSDTarget] = String(tags[i]);
        }

        targets.push(target);
      }

      this.cachedTargets = targets;
      this.lastDiscoveryTime = Date.now();
      this.metrics.targetsDiscovered = targets.length;
      this.metrics.lastDiscoveryDuration = performance.now() - startTime;

      return targets;
    } catch (error) {
      this.metrics.discoveryErrors++;
      console.error('Consul SD discovery error:', error);
      return [];
    }
  }

  /**
   * Получает кэшированные targets (если прошло меньше discoveryInterval)
   */
  getTargets(forceRefresh: boolean = false): ConsulSDTarget[] {
    const now = Date.now();
    
    if (forceRefresh || now - this.lastDiscoveryTime >= this.discoveryInterval) {
      return this.discoverTargets();
    }
    
    return this.cachedTargets;
  }

  /**
   * Получает метрики discovery
   */
  getMetrics() {
    return { ...this.metrics };
  }
}

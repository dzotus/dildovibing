import { CanvasNode } from '@/types';
import { ServiceDiscovery } from '@/services/connection/ServiceDiscovery';

/**
 * DNS Service Discovery Target
 * Соответствует формату Prometheus dns_sd_configs
 */
export interface DNSSDTarget {
  __meta_dns_srv_name?: string;
  __meta_dns_srv_target?: string;
  __meta_dns_srv_port?: string;
  
  // Final target (host:port)
  __address__?: string;
  __metrics_path__?: string;
  __scheme__?: string;
  
  // Дополнительные labels
  [key: string]: string | undefined;
}

/**
 * DNS Service Discovery Configuration
 * Соответствует формату Prometheus dns_sd_configs
 */
export interface DNSSDConfig {
  names: string[]; // DNS имена для запроса (A, AAAA, SRV записи)
  type?: 'A' | 'AAAA' | 'SRV'; // Тип DNS записи (по умолчанию SRV)
  port?: number; // Порт для A/AAAA записей (если не указан в SRV)
  refresh_interval?: string; // Интервал обновления (по умолчанию 30s)
}

/**
 * DNS Service Discovery
 * Симулирует работу Prometheus DNS Service Discovery
 * Периодически выполняет DNS запросы для обнаружения сервисов
 */
export class DNSSD {
  private config: DNSSDConfig | null = null;
  private allNodes: CanvasNode[] = [];
  private discovery: ServiceDiscovery;
  
  // Кэш для targets
  private cachedTargets: DNSSDTarget[] = [];
  private lastDiscoveryTime: number = 0;
  private discoveryInterval: number = 30000; // 30 секунд (по умолчанию в Prometheus)
  
  // Метрики
  private metrics = {
    targetsDiscovered: 0,
    lastDiscoveryDuration: 0,
    discoveryErrors: 0,
    dnsQueries: 0,
  };

  constructor(discovery: ServiceDiscovery) {
    this.discovery = discovery;
  }

  /**
   * Инициализирует DNS Service Discovery
   */
  initialize(
    config: DNSSDConfig,
    allNodes: CanvasNode[]
  ): void {
    this.config = config;
    this.allNodes = allNodes;
    this.lastDiscoveryTime = 0;
    
    // Парсим refresh_interval
    if (config.refresh_interval) {
      this.discoveryInterval = this.parseDuration(config.refresh_interval);
    }
    
    // Выполняем первичное discovery
    this.discoverTargets();
  }

  /**
   * Обновляет список nodes (вызывается при изменении canvas)
   */
  updateNodes(allNodes: CanvasNode[]): void {
    this.allNodes = allNodes;
  }

  /**
   * Парсит duration строку (например, "30s", "5m") в миллисекунды
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 30000; // 30 секунд по умолчанию
    }
    
    const value = parseInt(match[1], 10);
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
   * Выполняет discovery targets через DNS запросы
   * Симулирует DNS resolution (A, AAAA, SRV записи)
   */
  discoverTargets(): DNSSDTarget[] {
    if (!this.config || !this.config.names || this.config.names.length === 0) {
      return [];
    }

    const startTime = performance.now();
    
    try {
      const targets: DNSSDTarget[] = [];
      const dnsType = this.config.type || 'SRV';
      
      for (const dnsName of this.config.names) {
        this.metrics.dnsQueries++;
        
        // Симулируем DNS resolution
        // В реальности Prometheus делает DNS запросы
        // В симуляторе ищем компоненты, которые соответствуют DNS имени
        
        if (dnsType === 'SRV') {
          // SRV записи: _service._protocol.name (например, _http._tcp.example.com)
          // Формат SRV: priority weight port target
          // В симуляторе ищем компоненты по имени или типу
          
          const resolvedTargets = this.resolveSRV(dnsName);
          targets.push(...resolvedTargets);
        } else if (dnsType === 'A' || dnsType === 'AAAA') {
          // A/AAAA записи: просто IP адреса
          // В симуляторе ищем компоненты по hostname
          
          const resolvedTargets = this.resolveA(dnsName, dnsType);
          targets.push(...resolvedTargets);
        }
      }

      this.cachedTargets = targets;
      this.lastDiscoveryTime = Date.now();
      this.metrics.targetsDiscovered = targets.length;
      this.metrics.lastDiscoveryDuration = performance.now() - startTime;

      return targets;
    } catch (error) {
      this.metrics.discoveryErrors++;
      console.error('DNS SD discovery error:', error);
      return [];
    }
  }

  /**
   * Разрешает SRV запись
   * Формат: _service._protocol.name
   */
  private resolveSRV(dnsName: string): DNSSDTarget[] {
    const targets: DNSSDTarget[] = [];
    
    // Парсим SRV имя
    // Примеры: _http._tcp.example.com, _metrics._tcp.services.local
    const srvMatch = dnsName.match(/^_([^.]+)\._([^.]+)\.(.+)$/);
    const serviceName = srvMatch ? srvMatch[1] : null;
    const protocol = srvMatch ? srvMatch[2] : null;
    const baseName = srvMatch ? srvMatch[3] : dnsName;
    
    // Ищем компоненты, которые соответствуют DNS имени
    // В реальности это был бы DNS SRV запрос
    for (const node of this.allNodes) {
      if (node.type === 'prometheus') {
        continue;
      }

      const host = this.discovery.getHost(node);
      const nodeLabel = node.data.label || '';
      
      // Проверяем соответствие по hostname или label
      // В реальности DNS вернул бы список target:port пар
      const matchesName = host.includes(baseName) || 
                         nodeLabel.toLowerCase().includes(baseName.toLowerCase()) ||
                         baseName === '*' || // Wildcard
                         baseName === 'localhost' ||
                         baseName === 'services';
      
      if (!matchesName) {
        continue;
      }

      // Если указан service name - проверяем тип компонента
      if (serviceName && serviceName !== 'metrics' && serviceName !== 'http') {
        // Можно добавить более сложную логику сопоставления
        const nodeTypeMatches = node.type.toLowerCase().includes(serviceName.toLowerCase());
        if (!nodeTypeMatches) {
          continue;
        }
      }

      const metricsPort = this.discovery.getPort(node, 'metrics');
      const mainPort = this.discovery.getPort(node, 'main');
      const port = metricsPort || mainPort || 8080;
      
      const target: DNSSDTarget = {
        __meta_dns_srv_name: dnsName,
        __meta_dns_srv_target: host,
        __meta_dns_srv_port: String(port),
        __address__: `${host}:${port}`,
        __metrics_path__: (node.data.config?.metrics?.path || node.data.config?.metricsPath || '/metrics') as string,
        __scheme__: (node.data.config?.metrics?.scheme || 'http') as string,
        job: node.data.label || node.type,
        instance: `${host}:${port}`,
      };
      
      targets.push(target);
    }
    
    return targets;
  }

  /**
   * Разрешает A/AAAA запись (IPv4/IPv6 адреса)
   */
  private resolveA(dnsName: string, type: 'A' | 'AAAA'): DNSSDTarget[] {
    const targets: DNSSDTarget[] = [];
    const port = this.config?.port || 8080;
    
    // Ищем компоненты по hostname
    for (const node of this.allNodes) {
      if (node.type === 'prometheus') {
        continue;
      }

      const host = this.discovery.getHost(node);
      const nodeLabel = node.data.label || '';
      
      // Проверяем соответствие по hostname или label
      const matchesName = host === dnsName ||
                         host.includes(dnsName) ||
                         nodeLabel.toLowerCase() === dnsName.toLowerCase() ||
                         dnsName === '*' ||
                         dnsName === 'localhost';
      
      if (!matchesName) {
        continue;
      }

      const metricsPort = this.discovery.getPort(node, 'metrics');
      const mainPort = this.discovery.getPort(node, 'main');
      const targetPort = metricsPort || mainPort || port;
      
      const target: DNSSDTarget = {
        __address__: `${host}:${targetPort}`,
        __metrics_path__: (node.data.config?.metrics?.path || node.data.config?.metricsPath || '/metrics') as string,
        __scheme__: (node.data.config?.metrics?.scheme || 'http') as string,
        job: node.data.label || node.type,
        instance: `${host}:${targetPort}`,
      };
      
      targets.push(target);
    }
    
    return targets;
  }

  /**
   * Получает кэшированные targets (если прошло меньше discoveryInterval)
   */
  getTargets(forceRefresh: boolean = false): DNSSDTarget[] {
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

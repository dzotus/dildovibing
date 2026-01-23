import { CanvasNode, CanvasConnection } from '@/types';
import { ComponentCapabilities, ConnectionMetadata } from './types';

/**
 * Дефолтные порты для разных типов компонентов
 */
const DEFAULT_PORTS: Record<string, number> = {
  // Databases
  postgres: 5432,
  mongodb: 27017,
  redis: 6379,
  cassandra: 9042,
  clickhouse: 8123,
  elasticsearch: 9200,
  
  // APIs
  rest: 8080,
  grpc: 50051,
  graphql: 4000,
  websocket: 8080,
  webhook: 8080,
  soap: 8080,
  
  // Infrastructure
  nginx: 80,
  envoy: 80,
  haproxy: 80,
  traefik: 80,
  docker: 2375,
  kubernetes: 6443,
  
  // Messaging
  kafka: 9092,
  rabbitmq: 5672,
  activemq: 61616,
  'aws-sqs': 9324,
  
  // Observability
  prometheus: 9090,
  grafana: 3000,
  loki: 3100,
  jaeger: 16686,
  
  // Security
  keycloak: 8080,
  'secrets-vault': 8200,
  
  // Business
  crm: 8080,
  erp: 8080,
  'payment-gateway': 443,
};

/**
 * Порты для метрик
 */
const METRICS_PORTS: Record<string, number> = {
  'api-gateway': 9100,
  postgres: 9187,
  redis: 9121,
  'service-mesh': 15014,
  istio: 15014,
  envoy: 9901,
  cdn: 9101,
  'aws-sqs': 9102,
};

/**
 * Service Discovery - автоматическое разрешение имен и портов компонентов
 */
export class ServiceDiscovery {
  /**
   * Получить хост компонента из его label или ID
   */
  getHost(node: CanvasNode): string {
    if (node.data.label) {
      // Преобразуем label в hostname: lowercase, заменяем пробелы на дефисы
      return node.data.label
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    }
    // Если нет label, используем ID (первые 8 символов)
    return node.id.slice(0, 8);
  }

  /**
   * Получить порт компонента
   */
  getPort(node: CanvasNode, purpose: 'main' | 'metrics' | 'admin'): number | undefined {
    const config = node.data.config || {};
    
    switch (purpose) {
      case 'main':
        // Сначала проверяем конфиг, потом дефолтный порт
        return config.port || config.host?.split(':')[1] || DEFAULT_PORTS[node.type];
      
      case 'metrics':
        // Порты для метрик
        return config.metricsPort || 
               config.metrics?.port || 
               METRICS_PORTS[node.type];
      
      case 'admin':
        // Админ порты
        return config.adminPort || 
               config.admin?.port;
    }
  }

  /**
   * Получить полный endpoint для подключения
   */
  getEndpoint(node: CanvasNode, purpose: 'main' | 'metrics' | 'admin' = 'main'): string {
    const host = this.getHost(node);
    const port = this.getPort(node, purpose);
    
    if (!port) {
      throw new Error(`Port not found for ${node.type}:${purpose}`);
    }
    
    return `${host}:${port}`;
  }

  /**
   * Получить URL для подключения (с протоколом)
   */
  getURL(node: CanvasNode, purpose: 'main' | 'metrics' | 'admin' = 'main', protocol: string = 'http'): string {
    const endpoint = this.getEndpoint(node, purpose);
    return `${protocol}://${endpoint}`;
  }

  /**
   * Получить метаданные для связи между компонентами
   */
  getConnectionMetadata(
    source: CanvasNode,
    target: CanvasNode,
    connection: CanvasConnection
  ): ConnectionMetadata {
    const sourceHost = this.getHost(source);
    const targetHost = this.getHost(target);
    const sourcePort = this.getPort(source, 'main');
    const targetPort = this.getPort(target, 'main');
    
    // Determine protocol from connection (priority: connection.type > connection.data.protocol > target type)
    let protocol: ConnectionMetadata['protocol'] = 'http';
    
    // First, check connection.type or connection.data.protocol
    const connectionProtocol = connection.type || connection.data?.protocol;
    if (connectionProtocol) {
      if (['rest', 'graphql', 'soap', 'grpc', 'websocket', 'webhook', 'http'].includes(connectionProtocol)) {
        protocol = connectionProtocol as ConnectionMetadata['protocol'];
      } else if (connectionProtocol === 'async') {
        protocol = 'async';
      } else if (connectionProtocol === 'sync') {
        protocol = 'sync';
      }
    }
    
    // Fallback to target type for messaging/brokers (if protocol not set in connection)
    if (!connectionProtocol || protocol === 'http') {
      if (target.type === 'kafka') {
        protocol = 'kafka';
      } else if (target.type === 'rabbitmq' || target.type === 'activemq') {
        protocol = 'rabbitmq';
      }
    }
    
    return {
      protocol,
      sourceHost,
      targetHost,
      sourcePort,
      targetPort,
      endpoint: targetPort ? `${targetHost}:${targetPort}` : undefined,
    };
  }

  /**
   * Получить capabilities компонента
   */
  getCapabilities(node: CanvasNode): ComponentCapabilities {
    return {
      defaultPort: this.getPort(node, 'main'),
      metricsPort: this.getPort(node, 'metrics'),
      adminPort: this.getPort(node, 'admin'),
      getHost: (n) => this.getHost(n),
      getPort: (n, purpose) => this.getPort(n, purpose),
    };
  }
}

import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';
import { CanvasNode, CanvasConnection } from '@/types';

/**
 * Правило для подключения к OpenTelemetry Collector (Receiver)
 * Любой компонент может отправлять данные в OpenTelemetry Collector
 */
export function createOTelCollectorReceiverRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: '*', // Любой компонент может отправлять данные
    targetTypes: ['otel-collector'],
    priority: 10,
    
    updateSourceConfig: (source, otelCollector, connection, metadata) => {
      // Не требуется обновление конфига источника
      // Данные отправляются автоматически через DataFlowEngine
      return null;
    },
    
    updateTargetConfig: (source, otelCollector, connection, metadata) => {
      // Автоматически создаем receiver для source типа
      return updateOTelCollectorReceiverConfig(source, otelCollector, connection, metadata, discovery);
    },
    
    extractMetadata: (source, otelCollector, connection) => {
      // Извлекаем metadata для подключения к OpenTelemetry Collector
      const targetHost = discovery.getHost(otelCollector);
      const config = (otelCollector.data.config || {}) as any;
      
      // Определяем endpoint на основе конфигурации receivers
      let targetPort: number | undefined;
      let endpoint: string | undefined;
      
      // Ищем OTLP receiver (наиболее универсальный)
      const receivers = Array.isArray(config.receivers) ? config.receivers : [];
      const otlpReceiver = receivers.find((r: any) => r.type === 'otlp' && r.enabled !== false);
      
      if (otlpReceiver?.endpoint) {
        // Извлекаем порт из endpoint (например, "0.0.0.0:4317" -> 4317)
        const portMatch = otlpReceiver.endpoint.match(/:(\d+)/);
        if (portMatch) {
          targetPort = parseInt(portMatch[1], 10);
        }
      }
      
      // Если порт не найден, используем дефолтный OTLP порт
      if (!targetPort) {
        targetPort = discovery.getPort(otelCollector, 'main') || 4317; // OTLP gRPC default
      }
      
      endpoint = `${targetHost}:${targetPort}`;
      
      return {
        protocol: 'grpc', // OTLP использует gRPC
        sourceHost: discovery.getHost(source),
        targetHost,
        sourcePort: discovery.getPort(source, 'main'),
        targetPort,
        endpoint,
      };
    },
    
    validateConnection: (source, target, connection) => {
      // Валидация: OpenTelemetry Collector может принимать данные от любых компонентов
      if (!source?.data || !target?.data) {
        return { valid: false, error: 'Source or target node missing data' };
      }
      
      if (target.type !== 'otel-collector') {
        return { valid: false, error: 'Target must be OpenTelemetry Collector component' };
      }
      
      return { valid: true };
    },
  };
}

/**
 * Правило для экспорта из OpenTelemetry Collector (Exporter)
 * OpenTelemetry Collector может экспортировать в различные backends
 */
export function createOTelCollectorExporterRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: 'otel-collector',
    targetTypes: ['prometheus', 'jaeger', 'loki', 'grafana', '*'], // Может экспортировать в разные backends
    priority: 10,
    
    updateSourceConfig: (otelCollector, target, connection, metadata) => {
      // Автоматически создаем exporter для target типа
      return updateOTelCollectorExporterConfig(otelCollector, target, connection, metadata, discovery);
    },
    
    updateTargetConfig: (otelCollector, target, connection, metadata) => {
      // Не требуется обновление конфига target
      // Backends принимают данные автоматически
      return null;
    },
    
    extractMetadata: (otelCollector, target, connection) => {
      // Извлекаем metadata для экспорта
      const sourceHost = discovery.getHost(otelCollector);
      const targetHost = discovery.getHost(target);
      const targetPort = discovery.getPort(target, 'main');
      
      let endpoint: string | undefined;
      
      // Формируем endpoint на основе типа target
      if (targetPort) {
        const targetConfig = (target.data.config || {}) as any;
        
        // Для Prometheus используем remote_write endpoint
        if (target.type === 'prometheus') {
          const remoteWriteUrl = targetConfig.remoteWriteUrl || `http://${targetHost}:${targetPort}/api/v1/write`;
          endpoint = remoteWriteUrl;
        }
        // Для Jaeger используем collector endpoint
        else if (target.type === 'jaeger') {
          const collectorEndpoint = targetConfig.collectorEndpoint || `http://${targetHost}:14268`;
          endpoint = collectorEndpoint;
        }
        // Для Loki используем push endpoint
        else if (target.type === 'loki') {
          endpoint = `http://${targetHost}:${targetPort}/loki/api/v1/push`;
        }
        // Для других используем дефолтный endpoint
        else {
          endpoint = `http://${targetHost}:${targetPort}`;
        }
      }
      
      return {
        protocol: 'http',
        sourceHost,
        targetHost,
        sourcePort: discovery.getPort(otelCollector, 'main'),
        targetPort,
        endpoint,
      };
    },
    
    validateConnection: (source, target, connection) => {
      // Валидация: OpenTelemetry Collector может экспортировать в различные backends
      if (!source?.data || !target?.data) {
        return { valid: false, error: 'Source or target node missing data' };
      }
      
      if (source.type !== 'otel-collector') {
        return { valid: false, error: 'Source must be OpenTelemetry Collector component' };
      }
      
      return { valid: true };
    },
  };
}

/**
 * Обновляет конфигурацию OpenTelemetry Collector для приема данных (receiver)
 */
function updateOTelCollectorReceiverConfig(
  source: CanvasNode,
  otelCollector: CanvasNode,
  connection: CanvasConnection,
  metadata: ConnectionMetadata,
  discovery: ServiceDiscovery
): Partial<any> | null {
  const config = (otelCollector.data.config || {}) as any;
  const receivers = Array.isArray(config.receivers) ? [...config.receivers] : [];
  const pipelines = Array.isArray(config.pipelines) ? [...config.pipelines] : [];

  // Определяем тип receiver на основе типа source
  let receiverType: 'otlp' | 'prometheus' | 'jaeger' | 'zipkin' | 'kafka' | 'filelog' = 'otlp';
  
  if (source.type === 'prometheus') {
    receiverType = 'prometheus';
  } else if (source.type === 'jaeger') {
    receiverType = 'jaeger';
  } else if (source.type?.includes('zipkin')) {
    receiverType = 'zipkin';
  } else {
    // По умолчанию используем OTLP (универсальный)
    receiverType = 'otlp';
  }

  // Определяем endpoint
  const targetHost = metadata.targetHost || discovery.getHost(otelCollector);
  let targetPort = metadata.targetPort;
  
  if (!targetPort) {
    // Дефолтные порты для разных типов receivers
    switch (receiverType) {
      case 'otlp':
        targetPort = 4317; // OTLP gRPC
        break;
      case 'prometheus':
        targetPort = 8888; // Prometheus receiver
        break;
      case 'jaeger':
        targetPort = 14250; // Jaeger gRPC
        break;
      default:
        targetPort = 4317;
    }
  }
  
  const endpoint = `${targetHost}:${targetPort}`;

  // Ищем существующий receiver
  const receiverId = `${receiverType}-${source.id}`;
  let existingReceiver = receivers.find((rec: any) => 
    rec.id === receiverId || 
    (rec.type === receiverType && rec.endpoint === endpoint)
  );

  if (!existingReceiver) {
    // Создаем новый receiver
    existingReceiver = {
      id: receiverId,
      type: receiverType,
      enabled: true,
      endpoint,
      config: {},
    };
    receivers.push(existingReceiver);
  } else {
    // Обновляем существующий receiver
    existingReceiver.enabled = true;
    existingReceiver.endpoint = endpoint;
  }

  // Определяем тип pipeline на основе типа данных
  let pipelineType: 'traces' | 'metrics' | 'logs' = 'traces';
  if (source.type === 'prometheus' || source.type?.includes('metric')) {
    pipelineType = 'metrics';
  } else if (source.type === 'loki' || source.type?.includes('log')) {
    pipelineType = 'logs';
  } else if (source.type === 'jaeger' || source.type?.includes('trace')) {
    pipelineType = 'traces';
  }

  // Находим или создаем соответствующий pipeline
  let pipeline = pipelines.find((p: any) => p.type === pipelineType);
  if (!pipeline) {
    pipeline = {
      id: `${pipelineType}-pipeline`,
      name: `${pipelineType}-pipeline`,
      type: pipelineType,
      receivers: [],
      processors: [],
      exporters: [],
    };
    pipelines.push(pipeline);
  }

  // Добавляем receiver в pipeline, если его там нет
  if (!pipeline.receivers.includes(receiverId)) {
    pipeline.receivers = [...pipeline.receivers, receiverId];
  }

  return {
    receivers,
    pipelines,
  };
}

/**
 * Обновляет конфигурацию OpenTelemetry Collector для экспорта данных (exporter)
 */
function updateOTelCollectorExporterConfig(
  otelCollector: CanvasNode,
  target: CanvasNode,
  connection: CanvasConnection,
  metadata: ConnectionMetadata,
  discovery: ServiceDiscovery
): Partial<any> | null {
  const config = (otelCollector.data.config || {}) as any;
  const exporters = Array.isArray(config.exporters) ? [...config.exporters] : [];
  const pipelines = Array.isArray(config.pipelines) ? [...config.pipelines] : [];

  // Определяем тип exporter на основе типа target
  let exporterType: 'otlp' | 'prometheus' | 'jaeger' | 'zipkin' | 'logging' | 'file' = 'otlp';
  
  if (target.type === 'prometheus') {
    exporterType = 'prometheus';
  } else if (target.type === 'jaeger') {
    exporterType = 'jaeger';
  } else if (target.type === 'loki') {
    exporterType = 'logging'; // Loki можно экспортировать через logging exporter
  } else {
    exporterType = 'otlp'; // По умолчанию OTLP
  }

  // Определяем endpoint
  const targetHost = metadata.targetHost || discovery.getHost(target);
  let endpoint: string | undefined;
  
  // Получаем endpoint из конфигурации target или metadata
  const targetConfig = (target.data.config || {}) as any;
  
  if (target.type === 'prometheus') {
    endpoint = targetConfig.remoteWriteUrl || metadata.endpoint || `http://${targetHost}:9090/api/v1/write`;
  } else if (target.type === 'jaeger') {
    endpoint = targetConfig.collectorEndpoint || metadata.endpoint || `http://${targetHost}:14268`;
  } else if (target.type === 'loki') {
    endpoint = metadata.endpoint || `http://${targetHost}:3100/loki/api/v1/push`;
  } else {
    endpoint = metadata.endpoint || `http://${targetHost}:${metadata.targetPort || 4317}`;
  }

  // Ищем существующий exporter
  const exporterId = `${exporterType}-${target.id}`;
  let existingExporter = exporters.find((exp: any) => 
    exp.id === exporterId || 
    (exp.type === exporterType && exp.endpoint === endpoint)
  );

  if (!existingExporter) {
    // Создаем новый exporter
    existingExporter = {
      id: exporterId,
      type: exporterType,
      enabled: true,
      endpoint,
      config: {},
    };
    exporters.push(existingExporter);
  } else {
    // Обновляем существующий exporter
    existingExporter.enabled = true;
    existingExporter.endpoint = endpoint;
  }

  // Определяем тип pipeline на основе типа target
  let pipelineType: 'traces' | 'metrics' | 'logs' = 'traces';
  if (target.type === 'prometheus' || target.type?.includes('metric')) {
    pipelineType = 'metrics';
  } else if (target.type === 'loki' || target.type?.includes('log')) {
    pipelineType = 'logs';
  } else if (target.type === 'jaeger' || target.type?.includes('trace')) {
    pipelineType = 'traces';
  }

  // Находим или создаем соответствующий pipeline
  let pipeline = pipelines.find((p: any) => p.type === pipelineType);
  if (!pipeline) {
    pipeline = {
      id: `${pipelineType}-pipeline`,
      name: `${pipelineType}-pipeline`,
      type: pipelineType,
      receivers: [],
      processors: [],
      exporters: [],
    };
    pipelines.push(pipeline);
  }

  // Добавляем exporter в pipeline, если его там нет
  if (!pipeline.exporters.includes(exporterId)) {
    pipeline.exporters = [...pipeline.exporters, exporterId];
  }

  return {
    exporters,
    pipelines,
  };
}

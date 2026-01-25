import { ConnectionRule, ConnectionMetadata } from '../types';
import { ServiceDiscovery } from '../ServiceDiscovery';
import { CanvasNode, CanvasConnection } from '@/types';

/**
 * Правило для Component -> Jaeger
 * Любой компонент может отправлять spans в Jaeger
 * OpenTelemetry Collector может экспортировать traces в Jaeger
 */
export function createJaegerRule(discovery: ServiceDiscovery): ConnectionRule {
  return {
    sourceType: '*', // Любой компонент может отправлять spans
    targetTypes: ['jaeger'],
    priority: 5,
    
    // Обновляем конфиг источника для OpenTelemetry Collector
    // Для других компонентов spans отправляются автоматически через DataFlowEngine
    updateSourceConfig: (source, jaeger, connection, metadata) => {
      // Специальная обработка для OpenTelemetry Collector
      if (source.type === 'otel-collector') {
        return this.updateOTelCollectorConfig(source, jaeger, connection, metadata, discovery);
      }
      // Для других компонентов не требуется обновление конфига
      return null;
    },
    
    updateTargetConfig: (source, jaeger, connection, metadata) => {
      // Jaeger не требует предварительной настройки для приема spans
      // Spans принимаются автоматически через Agent/Collector endpoints
      // Можно добавить автоматическую настройку endpoints если нужно
      return null;
    },
    
    extractMetadata: (source, jaeger, connection) => {
      // Извлекаем metadata для подключения к Jaeger
      const targetHost = discovery.getHost(jaeger);
      const config = (jaeger.data.config || {}) as any;
      
      // Определяем endpoint на основе конфигурации
      // По умолчанию используем Agent endpoint (UDP/gRPC)
      let targetPort: number | undefined;
      let endpoint: string | undefined;
      
      // Проверяем конфиг на наличие явно указанных endpoints
      if (config.agentEndpoint) {
        // Извлекаем порт из agentEndpoint (например, "http://jaeger:6831" -> 6831)
        const urlMatch = config.agentEndpoint.match(/:(\d+)/);
        if (urlMatch) {
          targetPort = parseInt(urlMatch[1], 10);
        }
      }
      
      // Если порт не найден, используем дефолтные порты Jaeger
      if (!targetPort) {
        // Agent endpoint: 6831 (UDP), 14250 (gRPC)
        // Collector endpoint: 14268 (HTTP), 14250 (gRPC)
        // Query endpoint: 16686 (HTTP), 16685 (gRPC)
        // По умолчанию используем Agent UDP порт
        targetPort = discovery.getPort(jaeger, 'main') || 6831;
      }
      
      endpoint = `${targetHost}:${targetPort}`;
      
      return {
        protocol: 'http', // Jaeger использует HTTP/gRPC/UDP
        sourceHost: discovery.getHost(source),
        targetHost,
        sourcePort: discovery.getPort(source, 'main'),
        targetPort,
        endpoint,
      };
    },
    
    validateConnection: (source, target, connection) => {
      // Валидация: Jaeger может принимать spans от любых компонентов
      if (!source?.data || !target?.data) {
        return { valid: false, error: 'Source or target node missing data' };
      }
      
      if (target.type !== 'jaeger') {
        return { valid: false, error: 'Target must be Jaeger component' };
      }
      
      // Проверяем что Jaeger engine инициализирован
      // (это проверяется в EmulationEngine)
      
      return { valid: true };
    },
  };
}

/**
 * Обновляет конфигурацию OpenTelemetry Collector для экспорта в Jaeger
 */
function updateOTelCollectorConfig(
  otelCollector: CanvasNode,
  jaeger: CanvasNode,
  connection: CanvasConnection,
  metadata: ConnectionMetadata,
  discovery: ServiceDiscovery
): Partial<any> | null {
  const config = (otelCollector.data.config || {}) as any;
  const exporters = Array.isArray(config.exporters) ? [...config.exporters] : [];
  const pipelines = Array.isArray(config.pipelines) ? [...config.pipelines] : [];

  // Получаем Jaeger endpoint из конфигурации или metadata
  const jaegerConfig = (jaeger.data.config || {}) as any;
  let jaegerEndpoint: string | undefined;
  
  // Приоритет: collectorEndpoint > agentEndpoint > metadata endpoint
  if (jaegerConfig.collectorEndpoint) {
    jaegerEndpoint = jaegerConfig.collectorEndpoint;
  } else if (jaegerConfig.agentEndpoint) {
    jaegerEndpoint = jaegerConfig.agentEndpoint;
  } else if (metadata.endpoint) {
    jaegerEndpoint = metadata.endpoint;
  } else {
    // Формируем endpoint из metadata
    const targetHost = metadata.targetHost || discovery.getHost(jaeger);
    const targetPort = metadata.targetPort || discovery.getPort(jaeger, 'main') || 14268;
    jaegerEndpoint = `http://${targetHost}:${targetPort}`;
  }

  // Ищем существующий Jaeger exporter
  const jaegerExporterId = `jaeger-${jaeger.id}`;
  let existingExporter = exporters.find((exp: any) => 
    exp.id === jaegerExporterId || 
    (exp.type === 'jaeger' && exp.endpoint === jaegerEndpoint)
  );

  if (!existingExporter) {
    // Создаем новый Jaeger exporter
    existingExporter = {
      id: jaegerExporterId,
      type: 'jaeger',
      enabled: true,
      endpoint: jaegerEndpoint,
      config: {},
    };
    exporters.push(existingExporter);
  } else {
    // Обновляем существующий exporter
    existingExporter.enabled = true;
    existingExporter.endpoint = jaegerEndpoint;
  }

  // Находим или создаем traces pipeline
  let tracesPipeline = pipelines.find((p: any) => p.type === 'traces');
  if (!tracesPipeline) {
    tracesPipeline = {
      id: 'traces-pipeline',
      name: 'traces',
      type: 'traces',
      receivers: [],
      processors: [],
      exporters: [],
    };
    pipelines.push(tracesPipeline);
  }

  // Добавляем Jaeger exporter в traces pipeline, если его там нет
  if (!tracesPipeline.exporters.includes(jaegerExporterId)) {
    tracesPipeline.exporters = [...tracesPipeline.exporters, jaegerExporterId];
  }

  return {
    exporters,
    pipelines,
  };
}

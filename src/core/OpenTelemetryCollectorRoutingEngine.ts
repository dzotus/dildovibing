import { CanvasNode } from '@/types';
import { JaegerSpan } from './JaegerEmulationEngine';
import { DataMessage } from './DataFlowEngine';

/**
 * Receiver Configuration
 */
export interface OtelReceiver {
  id: string;
  type: 'otlp' | 'prometheus' | 'jaeger' | 'zipkin' | 'kafka' | 'filelog';
  enabled: boolean;
  endpoint?: string;
  config?: Record<string, any>;
}

/**
 * Processor Configuration
 */
export interface OtelProcessor {
  id: string;
  type: 'batch' | 'memory_limiter' | 'filter' | 'transform' | 'resource' | 'attributes';
  enabled: boolean;
  config?: Record<string, any>;
}

/**
 * Exporter Configuration
 */
export interface OtelExporter {
  id: string;
  type: 'otlp' | 'prometheus' | 'jaeger' | 'zipkin' | 'logging' | 'file';
  enabled: boolean;
  endpoint?: string;
  config?: Record<string, any>;
}

/**
 * Pipeline Configuration
 */
export interface OtelPipeline {
  id: string;
  name: string;
  type: 'traces' | 'metrics' | 'logs';
  receivers: string[]; // receiver IDs
  processors: string[]; // processor IDs
  exporters: string[]; // exporter IDs
}

/**
 * OpenTelemetry Collector Configuration
 */
export interface OtelCollectorConfig {
  receivers?: OtelReceiver[];
  processors?: OtelProcessor[];
  exporters?: OtelExporter[];
  pipelines?: OtelPipeline[];
}

/**
 * Telemetry Data Types
 */
export interface OtelTrace {
  traceId: string;
  spans: OtelSpan[];
  resource?: Record<string, any>;
}

export interface OtelSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind?: string;
  startTime: number; // nanoseconds
  endTime?: number; // nanoseconds
  duration?: number; // nanoseconds
  attributes?: Record<string, any>;
  events?: Array<{
    time: number;
    name: string;
    attributes?: Record<string, any>;
  }>;
  links?: Array<{
    traceId: string;
    spanId: string;
    attributes?: Record<string, any>;
  }>;
  status?: {
    code: number;
    message?: string;
  };
  resource?: Record<string, any>;
}

export interface OtelMetric {
  name: string;
  description?: string;
  unit?: string;
  type: 'gauge' | 'sum' | 'histogram' | 'summary';
  dataPoints: Array<{
    time: number;
    value: number | Record<string, number>;
    attributes?: Record<string, any>;
  }>;
  resource?: Record<string, any>;
}

export interface OtelLog {
  timestamp: number; // nanoseconds
  severity?: string;
  severityNumber?: number;
  body?: string | Record<string, any>;
  attributes?: Record<string, any>;
  resource?: Record<string, any>;
  traceId?: string;
  spanId?: string;
}

/**
 * Batch State for Batch Processor
 */
interface BatchState {
  traces: OtelTrace[];
  metrics: OtelMetric[];
  logs: OtelLog[];
  lastBatchTime: number;
  count: number;
}

/**
 * Memory State for Memory Limiter
 */
interface MemoryState {
  currentUsage: number; // bytes
  limitBytes: number;
  droppedCount: number;
}

/**
 * OpenTelemetry Collector Metrics
 */
export interface OtelCollectorMetrics {
  // Receivers metrics
  tracesReceivedTotal: number;
  metricsReceivedTotal: number;
  logsReceivedTotal: number;
  
  // Processing metrics
  tracesProcessedTotal: number;
  metricsProcessedTotal: number;
  logsProcessedTotal: number;
  
  // Processor metrics
  tracesDroppedByMemoryLimiter: number;
  metricsDroppedByMemoryLimiter: number;
  logsDroppedByMemoryLimiter: number;
  batchesCreated: number;
  
  // Exporters metrics
  tracesExportedTotal: number;
  metricsExportedTotal: number;
  logsExportedTotal: number;
  exportErrorsTotal: number;
  
  // Pipeline metrics
  pipelineLatencyMs: number; // average latency through pipeline
  currentMemoryUsage: number; // bytes
}

/**
 * OpenTelemetry Collector Routing Engine
 * Реализует обработку телеметрии через receivers → processors → exporters pipelines
 */
export class OpenTelemetryCollectorRoutingEngine {
  private config: OtelCollectorConfig | null = null;
  private node: CanvasNode | null = null;
  
  // Maps for quick lookup
  private receiversMap: Map<string, OtelReceiver> = new Map();
  private processorsMap: Map<string, OtelProcessor> = new Map();
  private exportersMap: Map<string, OtelExporter> = new Map();
  private pipelinesByType: Map<'traces' | 'metrics' | 'logs', OtelPipeline[]> = new Map();
  
  // Batch processors state (per pipeline)
  private batchStates: Map<string, BatchState> = new Map();
  
  // Memory limiter state
  private memoryState: MemoryState = {
    currentUsage: 0,
    limitBytes: 512 * 1024 * 1024, // 512 MB default
    droppedCount: 0,
  };
  
  // Metrics
  private metrics: OtelCollectorMetrics = {
    tracesReceivedTotal: 0,
    metricsReceivedTotal: 0,
    logsReceivedTotal: 0,
    tracesProcessedTotal: 0,
    metricsProcessedTotal: 0,
    logsProcessedTotal: 0,
    tracesDroppedByMemoryLimiter: 0,
    metricsDroppedByMemoryLimiter: 0,
    logsDroppedByMemoryLimiter: 0,
    batchesCreated: 0,
    tracesExportedTotal: 0,
    metricsExportedTotal: 0,
    logsExportedTotal: 0,
    exportErrorsTotal: 0,
    pipelineLatencyMs: 0,
    currentMemoryUsage: 0,
  };
  
  // Pipeline latency history
  private latencyHistory: number[] = [];
  private readonly MAX_LATENCY_HISTORY = 100;

  /**
   * Инициализирует конфигурацию из node config
   */
  initializeConfig(node: CanvasNode): void {
    this.node = node;
    const config = (node.data.config || {}) as any;
    
    this.config = {
      receivers: config.receivers || [],
      processors: config.processors || [],
      exporters: config.exporters || [],
      pipelines: config.pipelines || [],
    };
    
    // Build maps for quick lookup
    this.buildMaps();
    
    // Initialize memory limiter from processors
    this.initializeMemoryLimiter();
    
    // Initialize batch processors
    this.initializeBatchProcessors();
  }

  /**
   * Строит maps для быстрого поиска
   */
  private buildMaps(): void {
    if (!this.config) return;
    
    // Build receivers map
    this.receiversMap.clear();
    if (this.config.receivers) {
      for (const receiver of this.config.receivers) {
        this.receiversMap.set(receiver.id, receiver);
      }
    }
    
    // Build processors map
    this.processorsMap.clear();
    if (this.config.processors) {
      for (const processor of this.config.processors) {
        this.processorsMap.set(processor.id, processor);
      }
    }
    
    // Build exporters map
    this.exportersMap.clear();
    if (this.config.exporters) {
      for (const exporter of this.config.exporters) {
        this.exportersMap.set(exporter.id, exporter);
      }
    }
    
    // Build pipelines by type
    this.pipelinesByType.clear();
    if (this.config.pipelines) {
      for (const pipeline of this.config.pipelines) {
        if (!this.pipelinesByType.has(pipeline.type)) {
          this.pipelinesByType.set(pipeline.type, []);
        }
        this.pipelinesByType.get(pipeline.type)!.push(pipeline);
      }
    }
  }

  /**
   * Инициализирует memory limiter из конфигурации
   */
  private initializeMemoryLimiter(): void {
    if (!this.config?.processors) return;
    
    // Find memory_limiter processor
    const memoryLimiter = this.config.processors.find(p => p.type === 'memory_limiter' && p.enabled);
    if (memoryLimiter?.config?.limit_mib) {
      this.memoryState.limitBytes = memoryLimiter.config.limit_mib * 1024 * 1024;
    } else if (memoryLimiter?.config?.limit_bytes) {
      this.memoryState.limitBytes = memoryLimiter.config.limit_bytes;
    }
  }

  /**
   * Инициализирует batch processors
   */
  private initializeBatchProcessors(): void {
    if (!this.config?.pipelines) return;
    
    this.batchStates.clear();
    for (const pipeline of this.config.pipelines) {
      if (pipeline.processors.some(id => {
        const proc = this.processorsMap.get(id);
        return proc?.type === 'batch' && proc.enabled;
      })) {
        this.batchStates.set(pipeline.id, {
          traces: [],
          metrics: [],
          logs: [],
          lastBatchTime: Date.now(),
          count: 0,
        });
      }
    }
  }

  /**
   * Обрабатывает входящее сообщение (вызывается из DataFlowEngine)
   */
  processMessage(message: DataMessage, sourceNode?: CanvasNode): {
    success: boolean;
    error?: string;
    latency: number;
  } {
    const startTime = performance.now();
    
    try {
      // Определяем тип данных из payload
      const dataType = this.detectDataType(message);
      
      if (!dataType) {
        return {
          success: false,
          error: 'Unknown telemetry data type',
          latency: performance.now() - startTime,
        };
      }
      
      // Находим подходящие pipelines для этого типа
      const pipelines = this.pipelinesByType.get(dataType) || [];
      if (pipelines.length === 0) {
        return {
          success: false,
          error: `No pipelines configured for type: ${dataType}`,
          latency: performance.now() - startTime,
        };
      }
      
      // Извлекаем данные из message
      const telemetryData = this.extractTelemetryData(message, dataType);
      if (!telemetryData) {
        return {
          success: false,
          error: 'Failed to extract telemetry data',
          latency: performance.now() - startTime,
        };
      }
      
      // Обрабатываем через каждый pipeline
      let processed = false;
      for (const pipeline of pipelines) {
        if (this.isReceiverEnabled(pipeline, sourceNode)) {
          const result = this.processPipeline(telemetryData, pipeline, dataType);
          if (result.success) {
            processed = true;
          }
        }
      }
      
      // Обновляем метрики
      this.updateReceiveMetrics(dataType);
      
      const latency = performance.now() - startTime;
      this.recordLatency(latency);
      
      return {
        success: processed,
        latency,
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        latency: performance.now() - startTime,
      };
    }
  }

  /**
   * Определяет тип данных из сообщения
   */
  private detectDataType(message: DataMessage): 'traces' | 'metrics' | 'logs' | null {
    const payload = message.payload as any;
    
    // Проверяем metadata
    if (message.metadata?.telemetryType) {
      const type = message.metadata.telemetryType as string;
      if (['traces', 'metrics', 'logs'].includes(type)) {
        return type as 'traces' | 'metrics' | 'logs';
      }
    }
    
    // Проверяем payload структуру
    if (payload?.traces || payload?.spans || payload?.traceId) {
      return 'traces';
    }
    if (payload?.metrics || payload?.metric || payload?.dataPoints) {
      return 'metrics';
    }
    if (payload?.logs || payload?.log || payload?.entries || payload?.values) {
      return 'logs';
    }
    
    // Проверяем формат сообщения
    if (message.format === 'protobuf') {
      // OTLP protobuf обычно содержит traces или metrics
      return 'traces'; // default для protobuf
    }
    
    return null;
  }

  /**
   * Извлекает телеметрические данные из сообщения
   */
  private extractTelemetryData(
    message: DataMessage,
    dataType: 'traces' | 'metrics' | 'logs'
  ): any {
    const payload = message.payload as any;
    
    switch (dataType) {
      case 'traces':
        return this.extractTraces(payload);
      case 'metrics':
        return this.extractMetrics(payload);
      case 'logs':
        return this.extractLogs(payload);
      default:
        return null;
    }
  }

  /**
   * Извлекает traces из payload
   */
  private extractTraces(payload: any): OtelTrace[] | null {
    // OTLP format
    if (payload?.resourceSpans) {
      return payload.resourceSpans.map((rs: any) => ({
        traceId: rs.traceId || this.generateTraceId(),
        spans: (rs.spans || []).map((s: any) => this.convertToOtelSpan(s)),
        resource: rs.resource?.attributes || {},
      }));
    }
    
    // Jaeger format
    if (payload?.spans && Array.isArray(payload.spans)) {
      const tracesMap = new Map<string, OtelSpan[]>();
      for (const span of payload.spans as JaegerSpan[]) {
        const traceId = span.traceId;
        if (!tracesMap.has(traceId)) {
          tracesMap.set(traceId, []);
        }
        tracesMap.get(traceId)!.push(this.convertJaegerSpanToOtel(span));
      }
      return Array.from(tracesMap.entries()).map(([traceId, spans]) => ({
        traceId,
        spans,
        resource: {},
      }));
    }
    
    // Single span
    if (payload?.traceId && payload?.spanId) {
      return [{
        traceId: payload.traceId,
        spans: [this.convertToOtelSpan(payload)],
        resource: payload.resource || {},
      }];
    }
    
    return null;
  }

  /**
   * Извлекает metrics из payload
   */
  private extractMetrics(payload: any): OtelMetric[] | null {
    // OTLP format
    if (payload?.resourceMetrics) {
      return payload.resourceMetrics.flatMap((rm: any) => 
        (rm.metrics || []).map((m: any) => this.convertToOtelMetric(m, rm.resource?.attributes))
      );
    }
    
    // Prometheus format (text)
    if (typeof payload === 'string' && payload.includes('HELP')) {
      return this.parsePrometheusMetrics(payload);
    }
    
    // Direct metric object
    if (payload?.name && payload?.dataPoints) {
      return [this.convertToOtelMetric(payload)];
    }
    
    return null;
  }

  /**
   * Извлекает logs из payload
   */
  private extractLogs(payload: any): OtelLog[] | null {
    // OTLP format
    if (payload?.resourceLogs) {
      return payload.resourceLogs.flatMap((rl: any) =>
        (rl.logs || []).map((l: any) => this.convertToOtelLog(l, rl.resource?.attributes))
      );
    }
    
    // Loki format
    if (payload?.streams || payload?.values) {
      return this.convertLokiToOtelLogs(payload);
    }
    
    // Single log entry
    if (payload?.timestamp || payload?.body) {
      return [this.convertToOtelLog(payload)];
    }
    
    return null;
  }

  /**
   * Конвертирует Jaeger span в OTLP span
   */
  private convertJaegerSpanToOtel(jaegerSpan: JaegerSpan): OtelSpan {
    return {
      traceId: jaegerSpan.traceId,
      spanId: jaegerSpan.spanId,
      parentSpanId: jaegerSpan.parentSpanId,
      name: jaegerSpan.operationName,
      startTime: jaegerSpan.startTime * 1000, // microseconds to nanoseconds
      duration: jaegerSpan.duration * 1000, // microseconds to nanoseconds
      attributes: this.convertTagsToAttributes(jaegerSpan.tags),
      events: jaegerSpan.logs.map(log => ({
        time: log.timestamp * 1000, // microseconds to nanoseconds
        name: log.fields.find(f => f.key === 'event')?.value || 'log',
        attributes: this.convertLogFieldsToAttributes(log.fields),
      })),
      status: {
        code: jaegerSpan.tags.some(t => t.key === 'error' && t.value === true) ? 2 : 1, // ERROR : OK
      },
    };
  }

  /**
   * Конвертирует tags в attributes
   */
  private convertTagsToAttributes(tags: Array<{ key: string; value: string | number | boolean }>): Record<string, any> {
    const attrs: Record<string, any> = {};
    for (const tag of tags) {
      attrs[tag.key] = tag.value;
    }
    return attrs;
  }

  /**
   * Конвертирует log fields в attributes
   */
  private convertLogFieldsToAttributes(fields: Array<{ key: string; value: string }>): Record<string, any> {
    const attrs: Record<string, any> = {};
    for (const field of fields) {
      attrs[field.key] = field.value;
    }
    return attrs;
  }

  /**
   * Конвертирует в OTLP span (generic)
   */
  private convertToOtelSpan(span: any): OtelSpan {
    return {
      traceId: span.traceId || this.generateTraceId(),
      spanId: span.spanId || this.generateSpanId(),
      parentSpanId: span.parentSpanId,
      name: span.name || span.operationName || 'unknown',
      kind: span.kind,
      startTime: span.startTime || Date.now() * 1000000, // nanoseconds
      endTime: span.endTime,
      duration: span.duration,
      attributes: span.attributes || span.tags || {},
      events: span.events || span.logs || [],
      status: span.status,
      resource: span.resource || {},
    };
  }

  /**
   * Конвертирует в OTLP metric (generic)
   */
  private convertToOtelMetric(metric: any, resource?: Record<string, any>): OtelMetric {
    return {
      name: metric.name || 'unknown',
      description: metric.description,
      unit: metric.unit,
      type: metric.type || 'gauge',
      dataPoints: metric.dataPoints || [],
      resource: resource || metric.resource || {},
    };
  }

  /**
   * Парсит Prometheus metrics text format
   */
  private parsePrometheusMetrics(text: string): OtelMetric[] {
    // Simplified parsing - в реальности нужен полноценный парсер
    const metrics: OtelMetric[] = [];
    const lines = text.split('\n');
    let currentMetric: OtelMetric | null = null;
    
    for (const line of lines) {
      if (line.startsWith('# HELP')) {
        const match = line.match(/# HELP\s+(\w+)\s+(.+)/);
        if (match) {
          currentMetric = {
            name: match[1],
            description: match[2],
            type: 'gauge',
            dataPoints: [],
          };
        }
      } else if (line.startsWith('# TYPE')) {
        const match = line.match(/# TYPE\s+(\w+)\s+(\w+)/);
        if (match && currentMetric) {
          currentMetric.type = this.mapPrometheusTypeToOtel(match[2]);
        }
      } else if (line && !line.startsWith('#') && currentMetric) {
        const match = line.match(/^(\w+)(?:\{([^}]+)\})?\s+([\d.]+)/);
        if (match) {
          const value = parseFloat(match[3]);
          const attributes = this.parsePrometheusLabels(match[2]);
          currentMetric.dataPoints.push({
            time: Date.now() * 1000000, // nanoseconds
            value,
            attributes,
          });
        }
      }
      
      if (currentMetric && line === '') {
        metrics.push(currentMetric);
        currentMetric = null;
      }
    }
    
    if (currentMetric) {
      metrics.push(currentMetric);
    }
    
    return metrics;
  }

  /**
   * Мапит Prometheus тип в OTLP тип
   */
  private mapPrometheusTypeToOtel(promType: string): 'gauge' | 'sum' | 'histogram' | 'summary' {
    switch (promType.toLowerCase()) {
      case 'counter':
        return 'sum';
      case 'gauge':
        return 'gauge';
      case 'histogram':
        return 'histogram';
      case 'summary':
        return 'summary';
      default:
        return 'gauge';
    }
  }

  /**
   * Парсит Prometheus labels
   */
  private parsePrometheusLabels(labelsStr?: string): Record<string, any> {
    if (!labelsStr) return {};
    const attrs: Record<string, any> = {};
    const matches = labelsStr.matchAll(/(\w+)="([^"]+)"/g);
    for (const match of matches) {
      attrs[match[1]] = match[2];
    }
    return attrs;
  }

  /**
   * Конвертирует Loki logs в OTLP logs
   */
  private convertLokiToOtelLogs(lokiData: any): OtelLog[] {
    const logs: OtelLog[] = [];
    
    const streams = lokiData.streams || (lokiData.values ? [{ values: lokiData.values, stream: lokiData.stream || {} }] : []);
    
    for (const stream of streams) {
      const labels = stream.stream || stream.labels || {};
      const values = stream.values || [];
      
      for (const [timestamp, line] of values) {
        logs.push({
          timestamp: parseInt(timestamp),
          body: String(line),
          attributes: labels,
        });
      }
    }
    
    return logs;
  }

  /**
   * Конвертирует в OTLP log (generic)
   */
  private convertToOtelLog(log: any, resource?: Record<string, any>): OtelLog {
    return {
      timestamp: log.timestamp || Date.now() * 1000000, // nanoseconds
      severity: log.severity || log.level,
      severityNumber: log.severityNumber,
      body: log.body || log.line || log.message,
      attributes: log.attributes || log.labels || {},
      resource: resource || log.resource || {},
      traceId: log.traceId,
      spanId: log.spanId,
    };
  }

  /**
   * Проверяет, включен ли receiver для этого источника
   */
  private isReceiverEnabled(pipeline: OtelPipeline, sourceNode?: CanvasNode): boolean {
    if (!this.config) return false;
    
    // Проверяем, есть ли enabled receivers в pipeline
    for (const receiverId of pipeline.receivers) {
      const receiver = this.receiversMap.get(receiverId);
      if (receiver?.enabled) {
        // Для OTLP receiver принимаем все
        if (receiver.type === 'otlp') {
          return true;
        }
        // Для других типов можно добавить дополнительную логику
        return true;
      }
    }
    
    return false;
  }

  /**
   * Обрабатывает данные через pipeline
   */
  private processPipeline(
    telemetryData: any,
    pipeline: OtelPipeline,
    dataType: 'traces' | 'metrics' | 'logs'
  ): { success: boolean; error?: string } {
    try {
      // Применяем processors
      let processedData = telemetryData;
      
      let batchProcessorApplied = false;
      for (const processorId of pipeline.processors) {
        const processor = this.processorsMap.get(processorId);
        if (!processor?.enabled) continue;
        
        // Если это batch processor, запоминаем
        if (processor.type === 'batch') {
          batchProcessorApplied = true;
        }
        
        processedData = this.applyProcessor(processedData, processor, pipeline.id, dataType);
        
        // Для batch processor null означает что данные сохранены в batch (это нормально)
        if (!processedData && processor.type !== 'batch') {
          return { success: false, error: `Processor ${processor.type} dropped data` };
        }
        
        // Если batch processor вернул null, данные сохранены и будут отправлены позже при flush
        if (!processedData && processor.type === 'batch') {
          this.updateProcessMetrics(dataType);
          return { success: true }; // Успех - данные сохранены в batch
        }
      }
      
      // Отправляем через exporters
      let exported = false;
      for (const exporterId of pipeline.exporters) {
        const exporter = this.exportersMap.get(exporterId);
        if (!exporter?.enabled) continue;
        
        const result = this.sendToExporter(processedData, exporter, dataType);
        if (result.success) {
          exported = true;
          this.updateExportMetrics(dataType);
        } else {
          this.metrics.exportErrorsTotal++;
        }
      }
      
      this.updateProcessMetrics(dataType);
      
      return { success: exported };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Применяет processor к данным
   */
  private applyProcessor(
    data: any,
    processor: OtelProcessor,
    pipelineId: string,
    dataType: 'traces' | 'metrics' | 'logs'
  ): any {
    switch (processor.type) {
      case 'batch':
        return this.applyBatchProcessor(data, processor, pipelineId, dataType);
      case 'memory_limiter':
        return this.applyMemoryLimiter(data, dataType);
      case 'filter':
        return this.applyFilterProcessor(data, processor);
      case 'transform':
        return this.applyTransformProcessor(data, processor);
      case 'resource':
        return this.applyResourceProcessor(data, processor);
      case 'attributes':
        return this.applyAttributesProcessor(data, processor);
      default:
        return data;
    }
  }

  /**
   * Применяет batch processor
   */
  private applyBatchProcessor(
    data: any,
    processor: OtelProcessor,
    pipelineId: string,
    dataType: 'traces' | 'metrics' | 'logs'
  ): any {
    const batchState = this.batchStates.get(pipelineId);
    if (!batchState) {
      // Нет batch state - создаем новый
      const newBatchState: BatchState = {
        traces: [],
        metrics: [],
        logs: [],
        lastBatchTime: Date.now(),
        count: 0,
      };
      this.batchStates.set(pipelineId, newBatchState);
      return this.applyBatchProcessor(data, processor, pipelineId, dataType);
    }
    
    // Добавляем данные в batch
    const config = processor.config || {};
    const timeout = this.parseDuration(config.timeout || config.batchTimeout || '1s');
    const batchSize = config.send_batch_size || config.batchSize || 8192;
    const now = Date.now();
    
    // Добавляем в соответствующий массив
    if (dataType === 'traces') {
      const traces = Array.isArray(data) ? data : [data];
      batchState.traces.push(...traces);
    } else if (dataType === 'metrics') {
      const metrics = Array.isArray(data) ? data : [data];
      batchState.metrics.push(...metrics);
    } else if (dataType === 'logs') {
      const logs = Array.isArray(data) ? data : [data];
      batchState.logs.push(...logs);
    }
    
    batchState.count++;
    
    // Проверяем условия для отправки батча
    const shouldFlush = 
      batchState.count >= batchSize ||
      (now - batchState.lastBatchTime) >= timeout;
    
    if (shouldFlush) {
      // Отправляем batch
      const batchData = {
        traces: batchState.traces,
        metrics: batchState.metrics,
        logs: batchState.logs,
      };
      
      // Очищаем batch state
      batchState.traces = [];
      batchState.metrics = [];
      batchState.logs = [];
      batchState.lastBatchTime = now;
      batchState.count = 0;
      
      this.metrics.batchesCreated++;
      
      return batchData;
    }
    
    // Batch еще не готов - возвращаем null (данные сохранены в batch)
    return null;
  }

  /**
   * Применяет memory limiter
   */
  private applyMemoryLimiter(
    data: any,
    dataType: 'traces' | 'metrics' | 'logs'
  ): any {
    // Оцениваем размер данных (упрощенная оценка)
    const estimatedSize = this.estimateDataSize(data);
    
    // Проверяем лимит
    if (this.memoryState.currentUsage + estimatedSize > this.memoryState.limitBytes) {
      // Превышен лимит - отбрасываем данные
      this.memoryState.droppedCount++;
      this.updateDroppedMetrics(dataType);
      return null; // Drop data
    }
    
    // Обновляем использование памяти
    this.memoryState.currentUsage += estimatedSize;
    this.metrics.currentMemoryUsage = this.memoryState.currentUsage;
    
    return data;
  }

  /**
   * Оценивает размер данных в байтах (упрощенная оценка)
   */
  private estimateDataSize(data: any): number {
    // Упрощенная оценка - в реальности нужен более точный расчет
    return JSON.stringify(data).length;
  }

  /**
   * Применяет filter processor
   */
  private applyFilterProcessor(data: any, processor: OtelProcessor): any {
    // Упрощенная реализация - в реальности нужна полноценная фильтрация по условиям
    const config = processor.config || {};
    
    // Если есть условия фильтрации, применяем их
    if (config.spans && config.spans.include) {
      // Фильтруем spans по условиям
      // Упрощенная реализация
    }
    
    return data;
  }

  /**
   * Применяет transform processor
   */
  private applyTransformProcessor(data: any, processor: OtelProcessor): any {
    // Упрощенная реализация - в реальности нужна полноценная трансформация
    const config = processor.config || {};
    
    // Применяем трансформации из конфига
    if (config.transforms) {
      // Применяем трансформации
    }
    
    return data;
  }

  /**
   * Применяет resource processor
   */
  private applyResourceProcessor(data: any, processor: OtelProcessor): any {
    const config = processor.config || {};
    const attributes = config.attributes || {};
    
    // Добавляем resource attributes к данным
    if (Array.isArray(data)) {
      return data.map(item => ({
        ...item,
        resource: { ...item.resource, ...attributes },
      }));
    }
    
    return {
      ...data,
      resource: { ...data.resource || {}, ...attributes },
    };
  }

  /**
   * Применяет attributes processor
   */
  private applyAttributesProcessor(data: any, processor: OtelProcessor): any {
    // Упрощенная реализация
    return data;
  }

  /**
   * Отправляет данные через exporter
   */
  private sendToExporter(
    data: any,
    exporter: OtelExporter,
    dataType: 'traces' | 'metrics' | 'logs'
  ): { success: boolean; error?: string } {
    // В реальной системе здесь была бы отправка в целевые системы
    // В симуляции мы просто отмечаем успех и обновляем метрики
    
    // Можно добавить интеграцию с другими emulation engines
    // Например, отправка в JaegerEmulationEngine, PrometheusEmulationEngine, etc.
    
    return { success: true };
  }

  /**
   * Парсит duration строку (1s, 5m, etc.) в миллисекунды
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 1000; // default 1s
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 1000;
    }
  }

  /**
   * Обновляет метрики приема
   */
  private updateReceiveMetrics(dataType: 'traces' | 'metrics' | 'logs'): void {
    switch (dataType) {
      case 'traces':
        this.metrics.tracesReceivedTotal++;
        break;
      case 'metrics':
        this.metrics.metricsReceivedTotal++;
        break;
      case 'logs':
        this.metrics.logsReceivedTotal++;
        break;
    }
  }

  /**
   * Обновляет метрики обработки
   */
  private updateProcessMetrics(dataType: 'traces' | 'metrics' | 'logs'): void {
    switch (dataType) {
      case 'traces':
        this.metrics.tracesProcessedTotal++;
        break;
      case 'metrics':
        this.metrics.metricsProcessedTotal++;
        break;
      case 'logs':
        this.metrics.logsProcessedTotal++;
        break;
    }
  }

  /**
   * Обновляет метрики экспорта
   */
  private updateExportMetrics(dataType: 'traces' | 'metrics' | 'logs'): void {
    switch (dataType) {
      case 'traces':
        this.metrics.tracesExportedTotal++;
        break;
      case 'metrics':
        this.metrics.metricsExportedTotal++;
        break;
      case 'logs':
        this.metrics.logsExportedTotal++;
        break;
    }
  }

  /**
   * Обновляет метрики отброшенных данных
   */
  private updateDroppedMetrics(dataType: 'traces' | 'metrics' | 'logs'): void {
    switch (dataType) {
      case 'traces':
        this.metrics.tracesDroppedByMemoryLimiter++;
        break;
      case 'metrics':
        this.metrics.metricsDroppedByMemoryLimiter++;
        break;
      case 'logs':
        this.metrics.logsDroppedByMemoryLimiter++;
        break;
    }
  }

  /**
   * Записывает latency
   */
  private recordLatency(latency: number): void {
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > this.MAX_LATENCY_HISTORY) {
      this.latencyHistory.shift();
    }
    
    // Обновляем среднюю latency
    const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
    this.metrics.pipelineLatencyMs = sum / this.latencyHistory.length;
  }

  /**
   * Обрабатывает batch flush (должно вызываться периодически)
   */
  processBatchFlush(): void {
    const now = Date.now();
    
    for (const [pipelineId, batchState] of this.batchStates.entries()) {
      const pipeline = this.config?.pipelines?.find(p => p.id === pipelineId);
      if (!pipeline) continue;
      
      const processor = pipeline.processors
        .map(id => this.processorsMap.get(id))
        .find(p => p?.type === 'batch' && p.enabled);
      
      if (!processor) continue;
      
      const config = processor.config || {};
      const timeout = this.parseDuration(config.timeout || config.batchTimeout || '1s');
      
      // Проверяем timeout
      if (now - batchState.lastBatchTime >= timeout && batchState.count > 0) {
        // Flush batch
        const batchData = {
          traces: batchState.traces,
          metrics: batchState.metrics,
          logs: batchState.logs,
        };
        
        // Обрабатываем через оставшиеся processors и exporters
        this.processBatchData(batchData, pipeline);
        
        // Очищаем batch state
        batchState.traces = [];
        batchState.metrics = [];
        batchState.logs = [];
        batchState.lastBatchTime = now;
        batchState.count = 0;
        
        this.metrics.batchesCreated++;
      }
    }
  }

  /**
   * Обрабатывает batch data через pipeline
   */
  private processBatchData(batchData: any, pipeline: OtelPipeline): void {
    // Находим индекс batch processor
    const batchIndex = pipeline.processors.findIndex(id => {
      const proc = this.processorsMap.get(id);
      return proc?.type === 'batch' && proc.enabled;
    });
    
    // Применяем оставшиеся processors (после batch)
    let processedData = batchData;
    for (let i = batchIndex + 1; i < pipeline.processors.length; i++) {
      const processorId = pipeline.processors[i];
      const processor = this.processorsMap.get(processorId);
      if (!processor?.enabled) continue;
      
      // Применяем к каждому типу данных
      if (processedData.traces?.length > 0) {
        processedData.traces = this.applyProcessor(processedData.traces, processor, pipeline.id, 'traces');
      }
      if (processedData.metrics?.length > 0) {
        processedData.metrics = this.applyProcessor(processedData.metrics, processor, pipeline.id, 'metrics');
      }
      if (processedData.logs?.length > 0) {
        processedData.logs = this.applyProcessor(processedData.logs, processor, pipeline.id, 'logs');
      }
    }
    
    // Отправляем через exporters
    for (const exporterId of pipeline.exporters) {
      const exporter = this.exportersMap.get(exporterId);
      if (!exporter?.enabled) continue;
      
      if (processedData.traces?.length > 0) {
        this.sendToExporter(processedData.traces, exporter, 'traces');
        this.updateExportMetrics('traces');
      }
      if (processedData.metrics?.length > 0) {
        this.sendToExporter(processedData.metrics, exporter, 'metrics');
        this.updateExportMetrics('metrics');
      }
      if (processedData.logs?.length > 0) {
        this.sendToExporter(processedData.logs, exporter, 'logs');
        this.updateExportMetrics('logs');
      }
    }
  }

  /**
   * Генерирует trace ID
   */
  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Генерирует span ID
   */
  private generateSpanId(): string {
    return `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Получает метрики
   */
  getMetrics(): OtelCollectorMetrics {
    return { ...this.metrics };
  }

  /**
   * Получает конфигурацию
   */
  getConfig(): OtelCollectorConfig | null {
    return this.config;
  }

  /**
   * Очищает память (для memory limiter)
   */
  releaseMemory(bytes: number): void {
    this.memoryState.currentUsage = Math.max(0, this.memoryState.currentUsage - bytes);
    this.metrics.currentMemoryUsage = this.memoryState.currentUsage;
  }
}


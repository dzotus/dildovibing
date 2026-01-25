/**
 * OpenTelemetry Collector Routing Engine
 * Handles OpenTelemetry data processing: receivers, processors, exporters, pipelines
 */

import { CanvasNode } from '@/types';
import { DataMessage } from './DataFlowEngine';
import { JaegerEmulationEngine, JaegerSpan } from './JaegerEmulationEngine';

export interface OpenTelemetryCollectorReceiver {
  id: string;
  type: 'otlp' | 'prometheus' | 'jaeger' | 'zipkin' | 'kafka' | 'filelog';
  enabled: boolean;
  endpoint?: string;
  config?: Record<string, any>;
}

export interface OpenTelemetryCollectorProcessor {
  id: string;
  type: 'batch' | 'memory_limiter' | 'filter' | 'transform' | 'resource' | 'attributes';
  enabled: boolean;
  config?: Record<string, any>;
}

export interface OpenTelemetryCollectorExporter {
  id: string;
  type: 'otlp' | 'prometheus' | 'jaeger' | 'zipkin' | 'logging' | 'file';
  enabled: boolean;
  endpoint?: string;
  config?: Record<string, any>;
}

export interface OpenTelemetryCollectorPipeline {
  id: string;
  name: string;
  type: 'traces' | 'metrics' | 'logs';
  receivers: string[]; // Receiver IDs
  processors: string[]; // Processor IDs
  exporters: string[]; // Exporter IDs
}

export interface OpenTelemetryCollectorConfig {
  receivers?: OpenTelemetryCollectorReceiver[];
  processors?: OpenTelemetryCollectorProcessor[];
  exporters?: OpenTelemetryCollectorExporter[];
  pipelines?: OpenTelemetryCollectorPipeline[];
}

export interface ProcessMessageResult {
  success: boolean;
  latency: number;
  error?: string;
}

/**
 * OpenTelemetry Collector Routing Engine
 * Simulates OpenTelemetry Collector data processing
 */
export class OpenTelemetryCollectorRoutingEngine {
  private config: OpenTelemetryCollectorConfig | null = null;
  private receivers: Map<string, OpenTelemetryCollectorReceiver> = new Map();
  private processors: Map<string, OpenTelemetryCollectorProcessor> = new Map();
  private exporters: Map<string, OpenTelemetryCollectorExporter> = new Map();
  private pipelines: Map<string, OpenTelemetryCollectorPipeline> = new Map();

  // Metrics tracking
  private metricsReceived: number = 0;
  private tracesReceived: number = 0;
  private logsReceived: number = 0;
  private metricsExported: number = 0;
  private tracesExported: number = 0;
  private logsExported: number = 0;

  // Callback for getting Jaeger engines (injected from EmulationEngine)
  private getJaegerEnginesCallback?: () => Map<string, JaegerEmulationEngine>;

  /**
   * Set callback for getting Jaeger engines
   */
  public setGetJaegerEnginesCallback(callback: () => Map<string, JaegerEmulationEngine>): void {
    this.getJaegerEnginesCallback = callback;
  }

  /**
   * Initialize OpenTelemetry Collector configuration from node
   */
  public initializeConfig(node: CanvasNode): void {
    const raw = (node.data.config || {}) as any;

    this.config = {
      receivers: Array.isArray(raw.receivers) ? raw.receivers : [],
      processors: Array.isArray(raw.processors) ? raw.processors : [],
      exporters: Array.isArray(raw.exporters) ? raw.exporters : [],
      pipelines: Array.isArray(raw.pipelines) ? raw.pipelines : [],
    };

    // Load receivers
    this.receivers.clear();
    if (this.config.receivers) {
      for (const receiver of this.config.receivers) {
        if (receiver.id) {
          this.receivers.set(receiver.id, receiver);
        }
      }
    }

    // Load processors
    this.processors.clear();
    if (this.config.processors) {
      for (const processor of this.config.processors) {
        if (processor.id) {
          this.processors.set(processor.id, processor);
        }
      }
    }

    // Load exporters
    this.exporters.clear();
    if (this.config.exporters) {
      for (const exporter of this.config.exporters) {
        if (exporter.id) {
          this.exporters.set(exporter.id, exporter);
        }
      }
    }

    // Load pipelines
    this.pipelines.clear();
    if (this.config.pipelines) {
      for (const pipeline of this.config.pipelines) {
        if (pipeline.id) {
          this.pipelines.set(pipeline.id, pipeline);
        }
      }
    }
  }

  /**
   * Process message through OpenTelemetry Collector pipelines
   */
  public processMessage(message: DataMessage, sourceNode?: CanvasNode): ProcessMessageResult {
    const startTime = Date.now();
    
    try {
      // Determine data type from message content or source node
      const dataType = this.determineDataType(message, sourceNode);
      
      // Find matching pipelines for this data type
      const matchingPipelines = Array.from(this.pipelines.values())
        .filter(p => p.type === dataType && p.enabled !== false);

      if (matchingPipelines.length === 0) {
        // No matching pipeline, just pass through
        return {
          success: true,
          latency: Date.now() - startTime,
        };
      }

      // Process through each matching pipeline
      for (const pipeline of matchingPipelines) {
        // Process through receivers (should already be received, but validate)
        const enabledReceivers = pipeline.receivers
          .map(id => this.receivers.get(id))
          .filter(r => r && r.enabled) as OpenTelemetryCollectorReceiver[];

        if (enabledReceivers.length === 0) {
          continue; // Skip pipeline if no enabled receivers
        }

        // Process through processors
        let processedData = message.payload;
        const enabledProcessors = pipeline.processors
          .map(id => this.processors.get(id))
          .filter(p => p && p.enabled) as OpenTelemetryCollectorProcessor[];

        for (const processor of enabledProcessors) {
          processedData = this.applyProcessor(processor, processedData);
        }

        // Process through exporters
        const enabledExporters = pipeline.exporters
          .map(id => this.exporters.get(id))
          .filter(e => e && e.enabled) as OpenTelemetryCollectorExporter[];

        for (const exporter of enabledExporters) {
          this.applyExporter(exporter, processedData, dataType);
        }

        // Update metrics based on data type
        if (dataType === 'metrics') {
          this.metricsReceived++;
          this.metricsExported += enabledExporters.length;
        } else if (dataType === 'traces') {
          this.tracesReceived++;
          this.tracesExported += enabledExporters.length;
        } else if (dataType === 'logs') {
          this.logsReceived++;
          this.logsExported += enabledExporters.length;
        }
      }

      return {
        success: true,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Determine data type from message or source node
   */
  private determineDataType(message: DataMessage, sourceNode?: CanvasNode): 'traces' | 'metrics' | 'logs' {
    // Try to determine from source node type
    if (sourceNode) {
      const nodeType = sourceNode.type?.toLowerCase() || '';
      if (nodeType.includes('prometheus') || nodeType.includes('metric')) {
        return 'metrics';
      }
      if (nodeType.includes('jaeger') || nodeType.includes('trace')) {
        return 'traces';
      }
      if (nodeType.includes('loki') || nodeType.includes('log')) {
        return 'logs';
      }
    }

    // Try to determine from message format or content
    if (message.format) {
      const format = message.format.toLowerCase();
      if (format.includes('prometheus') || format.includes('metric')) {
        return 'metrics';
      }
      if (format.includes('jaeger') || format.includes('trace') || format.includes('zipkin')) {
        return 'traces';
      }
      if (format.includes('log')) {
        return 'logs';
      }
    }

    // Default to traces (most common for OTLP)
    return 'traces';
  }

  /**
   * Apply processor to data
   */
  private applyProcessor(processor: OpenTelemetryCollectorProcessor, data: any): any {
    // Simulate processor transformations
    // In real implementation, this would apply actual processor logic
    
    switch (processor.type) {
      case 'batch':
        // Batch processor would batch multiple items, but we process one at a time
        return data;
      
      case 'memory_limiter':
        // Memory limiter would check memory usage
        return data;
      
      case 'filter':
        // Filter processor would filter data based on conditions
        return data;
      
      case 'transform':
        // Transform processor would transform data
        return data;
      
      case 'resource':
        // Resource processor would add resource attributes
        return data;
      
      case 'attributes':
        // Attributes processor would modify attributes
        return data;
      
      default:
        return data;
    }
  }

  /**
   * Apply exporter to data (simulate export)
   */
  private applyExporter(exporter: OpenTelemetryCollectorExporter, data: any, dataType: 'traces' | 'metrics' | 'logs'): void {
    // Simulate export operation
    // In real implementation, this would send data to the configured endpoint
    
    switch (exporter.type) {
      case 'otlp':
        // OTLP exporter sends to OTLP backend
        break;
      
      case 'prometheus':
        // Prometheus exporter sends metrics to Prometheus
        break;
      
      case 'jaeger':
        // Jaeger exporter sends traces to Jaeger
        if (dataType === 'traces') {
          this.exportToJaeger(exporter, data);
        }
        break;
      
      case 'zipkin':
        // Zipkin exporter sends traces to Zipkin
        break;
      
      case 'logging':
        // Logging exporter just logs the data
        break;
      
      case 'file':
        // File exporter writes to file
        break;
    }
  }

  /**
   * Export traces to Jaeger
   * Converts OTLP traces to Jaeger spans and sends them to Jaeger engines
   */
  private exportToJaeger(exporter: OpenTelemetryCollectorExporter, otlpData: any): void {
    if (!this.getJaegerEnginesCallback) {
      return; // No callback set, cannot export
    }

    const jaegerEngines = this.getJaegerEnginesCallback();
    if (jaegerEngines.size === 0) {
      return; // No Jaeger engines available
    }

    // Convert OTLP traces to Jaeger spans
    const jaegerSpans = this.convertOTLPToJaeger(otlpData);
    if (jaegerSpans.length === 0) {
      return;
    }

    // Find target Jaeger engine based on exporter endpoint
    // If endpoint is specified, try to find matching Jaeger by endpoint
    // Otherwise, send to all Jaeger engines
    if (exporter.endpoint) {
      // Try to find Jaeger engine matching the endpoint
      for (const [nodeId, jaegerEngine] of jaegerEngines.entries()) {
        // Check if endpoint matches (simplified - in real implementation would parse URL)
        // For now, send to all if endpoint is specified
        for (const span of jaegerSpans) {
          jaegerEngine.receiveSpan(span);
        }
        break; // Send to first matching engine
      }
    } else {
      // No endpoint specified, send to all Jaeger engines
      for (const jaegerEngine of jaegerEngines.values()) {
        for (const span of jaegerSpans) {
          jaegerEngine.receiveSpan(span);
        }
      }
    }
  }

  /**
   * Convert OTLP trace data to Jaeger spans
   * Supports both OTLP JSON format and simplified trace format
   */
  private convertOTLPToJaeger(otlpData: any): JaegerSpan[] {
    const spans: JaegerSpan[] = [];

    try {
      // Handle OTLP ResourceSpans format (from OTLP JSON)
      if (otlpData.resourceSpans && Array.isArray(otlpData.resourceSpans)) {
        for (const resourceSpan of otlpData.resourceSpans) {
          if (resourceSpan.scopeSpans && Array.isArray(resourceSpan.scopeSpans)) {
            for (const scopeSpan of resourceSpan.scopeSpans) {
              if (scopeSpan.spans && Array.isArray(scopeSpan.spans)) {
                for (const otlpSpan of scopeSpan.spans) {
                  const jaegerSpan = this.convertOTLPSpanToJaeger(otlpSpan, resourceSpan.resource);
                  if (jaegerSpan) {
                    spans.push(jaegerSpan);
                  }
                }
              }
            }
          }
        }
      }
      // Handle simplified trace format (array of spans)
      else if (Array.isArray(otlpData)) {
        for (const otlpSpan of otlpData) {
          const jaegerSpan = this.convertOTLPSpanToJaeger(otlpSpan);
          if (jaegerSpan) {
            spans.push(jaegerSpan);
          }
        }
      }
      // Handle single span object
      else if (otlpData && typeof otlpData === 'object') {
        const jaegerSpan = this.convertOTLPSpanToJaeger(otlpData);
        if (jaegerSpan) {
          spans.push(jaegerSpan);
        }
      }
    } catch (error) {
      console.warn('Failed to convert OTLP to Jaeger:', error);
    }

    return spans;
  }

  /**
   * Convert single OTLP span to Jaeger span
   */
  private convertOTLPSpanToJaeger(otlpSpan: any, resource?: any): JaegerSpan | null {
    try {
      // Extract trace ID (OTLP uses byte array, convert to hex string)
      const traceId = this.convertBytesToHex(otlpSpan.traceId) || this.generateTraceId();
      
      // Extract span ID
      const spanId = this.convertBytesToHex(otlpSpan.spanId) || this.generateSpanId();
      
      // Extract parent span ID
      const parentSpanId = otlpSpan.parentSpanId 
        ? this.convertBytesToHex(otlpSpan.parentSpanId)
        : undefined;

      // Extract service name from resource attributes or span attributes
      let serviceName = 'unknown-service';
      if (resource?.attributes) {
        const serviceAttr = resource.attributes.find((attr: any) => 
          attr.key === 'service.name' || attr.key === 'serviceName'
        );
        if (serviceAttr) {
          serviceName = String(serviceAttr.value?.stringValue || serviceAttr.value || 'unknown-service');
        }
      }
      if (serviceName === 'unknown-service' && otlpSpan.attributes) {
        const serviceAttr = otlpSpan.attributes.find((attr: any) => 
          attr.key === 'service.name' || attr.key === 'serviceName'
        );
        if (serviceAttr) {
          serviceName = String(serviceAttr.value?.stringValue || serviceAttr.value || 'unknown-service');
        }
      }

      // Extract operation name from span name
      const operationName = otlpSpan.name || 'unknown-operation';

      // Convert start time (OTLP uses nanoseconds, Jaeger uses microseconds)
      const startTime = otlpSpan.startTimeUnixNano 
        ? Math.floor(otlpSpan.startTimeUnixNano / 1000) // Convert nanoseconds to microseconds
        : Date.now() * 1000; // Fallback to current time in microseconds

      // Convert duration (OTLP uses nanoseconds, Jaeger uses microseconds)
      const duration = otlpSpan.endTimeUnixNano && otlpSpan.startTimeUnixNano
        ? Math.floor((otlpSpan.endTimeUnixNano - otlpSpan.startTimeUnixNano) / 1000)
        : 0;

      // Convert attributes to tags
      const tags: Array<{ key: string; value: string | number | boolean }> = [];
      if (otlpSpan.attributes && Array.isArray(otlpSpan.attributes)) {
        for (const attr of otlpSpan.attributes) {
          if (attr.key && attr.value) {
            const value = this.extractAttributeValue(attr.value);
            if (value !== null && value !== undefined) {
              tags.push({ key: String(attr.key), value });
            }
          }
        }
      }

      // Convert events to logs
      const logs: Array<{ timestamp: number; fields: Array<{ key: string; value: string }> }> = [];
      if (otlpSpan.events && Array.isArray(otlpSpan.events)) {
        for (const event of otlpSpan.events) {
          const eventTime = event.timeUnixNano 
            ? Math.floor(event.timeUnixNano / 1000)
            : startTime;
          
          const fields: Array<{ key: string; value: string }> = [
            { key: 'event', value: event.name || 'event' }
          ];
          
          if (event.attributes && Array.isArray(event.attributes)) {
            for (const attr of event.attributes) {
              if (attr.key && attr.value) {
                const value = this.extractAttributeValue(attr.value);
                if (value !== null && value !== undefined) {
                  fields.push({ key: String(attr.key), value: String(value) });
                }
              }
            }
          }
          
          logs.push({ timestamp: eventTime, fields });
        }
      }

      // Convert links to references
      const references: Array<{
        refType: 'CHILD_OF' | 'FOLLOWS_FROM';
        traceId: string;
        spanId: string;
      }> = [];
      if (otlpSpan.links && Array.isArray(otlpSpan.links)) {
        for (const link of otlpSpan.links) {
          if (link.traceId && link.spanId) {
            references.push({
              refType: link.traceState === 'FOLLOWS_FROM' ? 'FOLLOWS_FROM' : 'CHILD_OF',
              traceId: this.convertBytesToHex(link.traceId) || traceId,
              spanId: this.convertBytesToHex(link.spanId) || spanId,
            });
          }
        }
      }

      return {
        traceId,
        spanId,
        parentSpanId,
        operationName,
        serviceName,
        startTime,
        duration,
        tags,
        logs,
        references: references.length > 0 ? references : undefined,
      };
    } catch (error) {
      console.warn('Failed to convert OTLP span to Jaeger span:', error);
      return null;
    }
  }

  /**
   * Convert OTLP attribute value to JavaScript value
   */
  private extractAttributeValue(value: any): string | number | boolean | null {
    if (!value) return null;
    
    if (value.stringValue !== undefined) return String(value.stringValue);
    if (value.intValue !== undefined) return Number(value.intValue);
    if (value.doubleValue !== undefined) return Number(value.doubleValue);
    if (value.boolValue !== undefined) return Boolean(value.boolValue);
    if (value.arrayValue !== undefined) {
      // Convert array to JSON string
      return JSON.stringify(value.arrayValue.values || []);
    }
    
    // Fallback: try to use value directly
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    
    return null;
  }

  /**
   * Convert byte array to hex string
   */
  private convertBytesToHex(bytes: any): string | null {
    if (!bytes) return null;
    
    // If already a string, return it
    if (typeof bytes === 'string') {
      // If it's a hex string, return as is
      if (/^[0-9a-fA-F]+$/.test(bytes)) {
        return bytes;
      }
      return null;
    }
    
    // If it's an array of numbers (bytes)
    if (Array.isArray(bytes)) {
      return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // If it's a Uint8Array
    if (bytes instanceof Uint8Array) {
      return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    return null;
  }

  /**
   * Generate random trace ID (16 bytes = 32 hex chars)
   */
  private generateTraceId(): string {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  /**
   * Generate random span ID (8 bytes = 16 hex chars)
   */
  private generateSpanId(): string {
    return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  /**
   * Get metrics
   */
  public getMetrics() {
    return {
      metricsReceived: this.metricsReceived,
      tracesReceived: this.tracesReceived,
      logsReceived: this.logsReceived,
      metricsExported: this.metricsExported,
      tracesExported: this.tracesExported,
      logsExported: this.logsExported,
      receiversCount: this.receivers.size,
      processorsCount: this.processors.size,
      exportersCount: this.exporters.size,
      pipelinesCount: this.pipelines.size,
    };
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metricsReceived = 0;
    this.tracesReceived = 0;
    this.logsReceived = 0;
    this.metricsExported = 0;
    this.tracesExported = 0;
    this.logsExported = 0;
  }
}

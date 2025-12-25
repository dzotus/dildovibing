/**
 * OpenTelemetry Collector Routing Engine
 * Handles OpenTelemetry data processing: receivers, processors, exporters, pipelines
 */

import { CanvasNode } from '@/types';
import { DataMessage } from './DataFlowEngine';

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

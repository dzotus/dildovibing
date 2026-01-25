/**
 * OpenTelemetry Collector Emulation Engine
 * Calculates component metrics based on routing engine activity
 */

import { CanvasNode } from '@/types';
import { ComponentMetrics } from './EmulationEngine';
import {
  OpenTelemetryCollectorRoutingEngine,
  OpenTelemetryCollectorConfig,
} from './OpenTelemetryCollectorRoutingEngine';

export interface OpenTelemetryCollectorEmulationMetrics {
  throughput: number; // messages/sec through all pipelines
  latency: number; // average processing latency (ms)
  latencyP50: number; // 50th percentile latency (ms)
  latencyP99: number; // 99th percentile latency (ms)
  errorRate: number; // error rate (0-1)
  utilization: number; // utilization (0-1) based on memory usage and throughput
  memoryUsage: number; // current memory usage (MiB)
  memoryLimit: number; // memory limit from memory_limiter processors (MiB)
  activePipelines: number; // number of active pipelines
  activeReceivers: number; // number of active receivers
  activeProcessors: number; // number of active processors
  activeExporters: number; // number of active exporters
}

/**
 * OpenTelemetry Collector Emulation Engine
 * Calculates component metrics based on routing engine activity
 */
export class OpenTelemetryCollectorEmulationEngine {
  private config: OpenTelemetryCollectorConfig | null = null;
  private routingEngine: OpenTelemetryCollectorRoutingEngine;
  
  // Metrics tracking
  private metrics: OpenTelemetryCollectorEmulationMetrics = {
    throughput: 0,
    latency: 0,
    latencyP50: 0,
    latencyP99: 0,
    errorRate: 0,
    utilization: 0,
    memoryUsage: 0,
    memoryLimit: 0,
    activePipelines: 0,
    activeReceivers: 0,
    activeProcessors: 0,
    activeExporters: 0,
  };
  
  // History for percentile calculations
  private latencyHistory: number[] = [];
  private readonly MAX_HISTORY_SIZE = 1000;
  
  // Batch queues for each pipeline (simulated)
  private batchQueues: Map<string, {
    items: any[];
    lastFlush: number;
    timeout: number; // ms
    size: number; // max batch size
  }> = new Map();
  
  // Memory tracking
  private memoryCheckpoint: number = 0;
  private memoryCheckpointInterval: number = 100; // ms
  private lastUpdateTime: number = Date.now();
  
  // Metrics history for per-second calculations
  private metricsHistory: Array<{
    timestamp: number;
    metricsReceived: number;
    tracesReceived: number;
    logsReceived: number;
    metricsExported: number;
    tracesExported: number;
    logsExported: number;
  }> = [];
  private readonly METRICS_HISTORY_SIZE = 60; // Keep last 60 seconds
  
  // Error tracking
  private errorsTotal: number = 0;
  private messagesTotal: number = 0;
  
  constructor(routingEngine: OpenTelemetryCollectorRoutingEngine) {
    this.routingEngine = routingEngine;
    this.lastUpdateTime = Date.now();
  }
  
  /**
   * Initialize configuration from node
   */
  public initializeConfig(node: CanvasNode): void {
    const raw = (node.data.config || {}) as any;
    
    this.config = {
      receivers: Array.isArray(raw.receivers) ? raw.receivers : [],
      processors: Array.isArray(raw.processors) ? raw.processors : [],
      exporters: Array.isArray(raw.exporters) ? raw.exporters : [],
      pipelines: Array.isArray(raw.pipelines) ? raw.pipelines : [],
    };
    
    // Initialize batch queues for pipelines with batch processors
    this.initializeBatchQueues();
    
    // Calculate memory limit from memory_limiter processors
    this.calculateMemoryLimit();
  }
  
  /**
   * Initialize batch queues for pipelines
   */
  private initializeBatchQueues(): void {
    if (!this.config) return;
    
    this.batchQueues.clear();
    
    for (const pipeline of (this.config.pipelines || [])) {
      if (!pipeline.enabled && pipeline.enabled !== undefined) continue;
      
      // Find batch processor in pipeline
      const batchProcessor = pipeline.processors
        .map(id => this.config?.processors?.find(p => p.id === id))
        .find(p => p && p.type === 'batch' && p.enabled);
      
      if (batchProcessor) {
        const timeout = this.parseTimeout(batchProcessor.config?.timeout || batchProcessor.config?.batchTimeout || '1s');
        const size = batchProcessor.config?.send_batch_size || batchProcessor.config?.batchSize || 8192;
        
        this.batchQueues.set(pipeline.id, {
          items: [],
          lastFlush: Date.now(),
          timeout,
          size,
        });
      }
    }
  }
  
  /**
   * Parse timeout string (e.g., "1s", "5m") to milliseconds
   */
  private parseTimeout(timeoutStr: string): number {
    const match = timeoutStr.match(/^(\d+)([smh])$/);
    if (!match) return 1000; // default 1s
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return 1000;
    }
  }
  
  /**
   * Calculate memory limit from memory_limiter processors
   */
  private calculateMemoryLimit(): void {
    if (!this.config) {
      this.metrics.memoryLimit = 512; // default 512 MiB
      return;
    }
    
    // Find the minimum memory limit from all memory_limiter processors
    const memoryLimits: number[] = [];
    
    for (const processor of (this.config.processors || [])) {
      if (processor.type === 'memory_limiter' && processor.enabled) {
        const limit = processor.config?.limit_mib || processor.config?.memoryLimit || 512;
        memoryLimits.push(Number(limit));
      }
    }
    
    if (memoryLimits.length > 0) {
      this.metrics.memoryLimit = Math.min(...memoryLimits);
    } else {
      this.metrics.memoryLimit = 512; // default 512 MiB
    }
  }
  
  /**
   * Calculate component metrics
   */
  public calculateComponentMetrics(): ComponentMetrics {
    const routingMetrics = this.routingEngine.getMetrics();
    
    // Calculate throughput from metrics history
    const throughput = this.calculateThroughput();
    
    // Calculate latency from history
    const latency = this.calculateLatency();
    const latencyP50 = this.calculatePercentile(50);
    const latencyP99 = this.calculatePercentile(99);
    
    // Calculate error rate
    const errorRate = this.calculateErrorRate();
    
    // Calculate utilization
    const utilization = this.calculateUtilization();
    
    // Update active components count
    this.updateActiveComponents();
    
    // Update memory usage
    this.updateMemoryUsage();
    
    return {
      id: '', // Will be set by caller
      type: 'otel-collector',
      throughput,
      latency,
      latencyP50,
      latencyP99,
      errorRate,
      utilization,
      timestamp: Date.now(),
      customMetrics: {
        memoryUsage: this.metrics.memoryUsage,
        memoryLimit: this.metrics.memoryLimit,
        activePipelines: this.metrics.activePipelines,
        activeReceivers: this.metrics.activeReceivers,
        activeProcessors: this.metrics.activeProcessors,
        activeExporters: this.metrics.activeExporters,
        metricsReceived: routingMetrics.metricsReceived,
        tracesReceived: routingMetrics.tracesReceived,
        logsReceived: routingMetrics.logsReceived,
        metricsExported: routingMetrics.metricsExported,
        tracesExported: routingMetrics.tracesExported,
        logsExported: routingMetrics.logsExported,
      },
    };
  }
  
  /**
   * Perform update (called every 100ms)
   */
  public performUpdate(deltaTime: number): void {
    const now = Date.now();
    
    // Flush batch queues by timeout
    this.flushBatchQueues(now);
    
    // Update memory checkpoint
    if (now - this.memoryCheckpoint >= this.memoryCheckpointInterval) {
      this.updateMemoryUsage();
      this.memoryCheckpoint = now;
    }
    
    // Update metrics history
    this.updateMetricsHistory(now);
    
    // Clean old history
    this.cleanOldHistory(now);
  }
  
  /**
   * Flush batch queues by timeout
   */
  private flushBatchQueues(now: number): void {
    for (const [pipelineId, queue] of this.batchQueues.entries()) {
      if (queue.items.length > 0 && (now - queue.lastFlush >= queue.timeout)) {
        // Flush batch
        queue.items = [];
        queue.lastFlush = now;
      }
    }
  }
  
  /**
   * Update metrics history
   */
  private updateMetricsHistory(now: number): void {
    const routingMetrics = this.routingEngine.getMetrics();
    
    this.metricsHistory.push({
      timestamp: now,
      metricsReceived: routingMetrics.metricsReceived,
      tracesReceived: routingMetrics.tracesReceived,
      logsReceived: routingMetrics.logsReceived,
      metricsExported: routingMetrics.metricsExported,
      tracesExported: routingMetrics.tracesExported,
      logsExported: routingMetrics.logsExported,
    });
    
    // Keep only last METRICS_HISTORY_SIZE entries
    if (this.metricsHistory.length > this.METRICS_HISTORY_SIZE) {
      this.metricsHistory.shift();
    }
  }
  
  /**
   * Clean old history
   */
  private cleanOldHistory(now: number): void {
    const cutoffTime = now - 60000; // 60 seconds
    
    // Clean latency history
    this.latencyHistory = this.latencyHistory.filter(() => true); // Keep all for now
    
    // Clean metrics history (already handled in updateMetricsHistory)
    this.metricsHistory = this.metricsHistory.filter(m => m.timestamp >= cutoffTime);
  }
  
  /**
   * Calculate throughput (messages per second)
   */
  private calculateThroughput(): number {
    if (this.metricsHistory.length < 2) {
      return 0;
    }
    
    const now = Date.now();
    const cutoffTime = now - 1000; // Last 1 second
    
    const recentHistory = this.metricsHistory.filter(m => m.timestamp >= cutoffTime);
    if (recentHistory.length < 2) {
      return 0;
    }
    
    const first = recentHistory[0];
    const last = recentHistory[recentHistory.length - 1];
    
    const timeDelta = (last.timestamp - first.timestamp) / 1000; // seconds
    if (timeDelta <= 0) {
      return 0;
    }
    
    const metricsDelta = last.metricsReceived - first.metricsReceived;
    const tracesDelta = last.tracesReceived - first.tracesReceived;
    const logsDelta = last.logsReceived - first.logsReceived;
    
    const totalDelta = metricsDelta + tracesDelta + logsDelta;
    
    return totalDelta / timeDelta;
  }
  
  /**
   * Calculate average latency
   */
  private calculateLatency(): number {
    if (this.latencyHistory.length === 0) {
      return 0;
    }
    
    const sum = this.latencyHistory.reduce((acc, val) => acc + val, 0);
    return sum / this.latencyHistory.length;
  }
  
  /**
   * Calculate percentile latency
   */
  private calculatePercentile(percentile: number): number {
    if (this.latencyHistory.length === 0) {
      return 0;
    }
    
    const sorted = [...this.latencyHistory].sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * sorted.length);
    return sorted[index] || 0;
  }
  
  /**
   * Record latency (called from routing engine or externally)
   */
  public recordLatency(latency: number): void {
    this.latencyHistory.push(latency);
    
    // Keep only last MAX_HISTORY_SIZE entries
    if (this.latencyHistory.length > this.MAX_HISTORY_SIZE) {
      this.latencyHistory.shift();
    }
  }
  
  /**
   * Record error (called from routing engine or externally)
   */
  public recordError(): void {
    this.errorsTotal++;
    this.messagesTotal++;
  }
  
  /**
   * Record success (called from routing engine or externally)
   */
  public recordSuccess(): void {
    this.messagesTotal++;
  }
  
  /**
   * Calculate error rate
   */
  private calculateErrorRate(): number {
    if (this.messagesTotal === 0) {
      return 0;
    }
    
    return this.errorsTotal / this.messagesTotal;
  }
  
  /**
   * Calculate utilization
   */
  private calculateUtilization(): number {
    // Utilization based on:
    // 1. Memory usage / memory limit (0-0.6)
    // 2. Throughput / max throughput (0-0.4)
    
    const memoryFactor = Math.min(0.6, (this.metrics.memoryUsage / this.metrics.memoryLimit) * 0.6);
    const throughputFactor = Math.min(0.4, (this.metrics.throughput / 1000) * 0.4); // Assume max 1000 msg/sec
    
    return Math.min(0.95, memoryFactor + throughputFactor);
  }
  
  /**
   * Update active components count
   */
  private updateActiveComponents(): void {
    if (!this.config) {
      this.metrics.activePipelines = 0;
      this.metrics.activeReceivers = 0;
      this.metrics.activeProcessors = 0;
      this.metrics.activeExporters = 0;
      return;
    }
    
    // Count active pipelines
    this.metrics.activePipelines = (this.config.pipelines || []).filter(
      p => p.enabled !== false
    ).length;
    
    // Count active receivers
    this.metrics.activeReceivers = (this.config.receivers || []).filter(
      r => r.enabled !== false
    ).length;
    
    // Count active processors
    this.metrics.activeProcessors = (this.config.processors || []).filter(
      p => p.enabled !== false
    ).length;
    
    // Count active exporters
    this.metrics.activeExporters = (this.config.exporters || []).filter(
      e => e.enabled !== false
    ).length;
  }
  
  /**
   * Update memory usage
   */
  private updateMemoryUsage(): void {
    if (!this.config) {
      this.metrics.memoryUsage = 0;
      return;
    }
    
    // Calculate memory usage based on:
    // 1. Items in batch queues
    // 2. Number of active pipelines
    // 3. Throughput (more messages = more memory)
    
    let queueMemory = 0;
    for (const queue of this.batchQueues.values()) {
      // Estimate: each item ~1KB
      queueMemory += queue.items.length * 0.001; // MiB
    }
    
    const pipelineMemory = this.metrics.activePipelines * 10; // 10 MiB per pipeline
    const throughputMemory = this.metrics.throughput * 0.01; // 0.01 MiB per msg/sec
    
    this.metrics.memoryUsage = Math.min(
      this.metrics.memoryLimit,
      queueMemory + pipelineMemory + throughputMemory
    );
  }
  
  /**
   * Get emulation metrics
   */
  public getMetrics(): OpenTelemetryCollectorEmulationMetrics {
    return { ...this.metrics };
  }
}

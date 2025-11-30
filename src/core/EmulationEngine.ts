import { CanvasNode, CanvasConnection } from '@/types';
import { prometheusExporter } from './PrometheusMetricsExporter';

/**
 * Component runtime state with real-time metrics
 */
export interface ComponentMetrics {
  id: string;
  type: string;
  throughput: number; // msgs/sec or requests/sec
  latency: number; // ms (average)
  latencyP50?: number; // 50th percentile latency
  latencyP99?: number; // 99th percentile latency
  errorRate: number; // 0-1
  utilization: number; // 0-1 (CPU/Memory/Queue usage)
  timestamp: number;
  customMetrics?: Record<string, number>;
}

/**
 * Connection runtime state with traffic simulation
 */
export interface ConnectionMetrics {
  id: string;
  source: string;
  target: string;
  traffic: number; // bytes/sec
  latency: number; // ms (average)
  latencyP50?: number; // 50th percentile latency
  latencyP99?: number; // 99th percentile latency
  errorRate: number; // 0-1
  utilization: number; // 0-1
  timestamp: number;
  // Interaction calculations
  throughputDependency: number; // 0-1 - how much target depends on source throughput
  backpressure: number; // 0-1 - pressure from target back to source
  bottleneck: boolean; // is this connection a bottleneck?
  effectiveThroughput: number; // actual throughput considering constraints
  congestion: number; // 0-1 - network congestion level
}

/**
 * Component configuration with emulation parameters
 */
export interface ComponentConfig {
  // Common
  enabled?: boolean;
  
  // Messaging (Kafka, RabbitMQ)
  topicCount?: number;
  partitions?: number;
  replicationFactor?: number;
  throughputMsgs?: number; // msgs/sec
  
  // Database
  maxConnections?: number;
  queryLatency?: number; // ms
  indexCount?: number;
  
  // Infrastructure (NGINX, Docker, K8s)
  workerThreads?: number;
  cacheSize?: number; // MB
  
  // APIs (REST, gRPC, WebSocket)
  requestsPerSecond?: number;
  avgPayloadSize?: number; // bytes
  responseLatency?: number; // ms
  
  // Custom
  [key: string]: any;
}

export class EmulationEngine {
  private nodes: CanvasNode[] = [];
  private connections: CanvasConnection[] = [];
  private metrics: Map<string, ComponentMetrics> = new Map();
  private connectionMetrics: Map<string, ConnectionMetrics> = new Map();
  private isRunning: boolean = false;
  private simulationTime: number = 0;
  private baseTime: number = Date.now();
  private updateInterval: number = 100; // ms
  private intervalId: NodeJS.Timeout | null = null;
  
  // Latency history for percentile calculations (rolling window)
  private latencyHistory: Map<string, number[]> = new Map(); // component latencies
  private connectionLatencyHistory: Map<string, number[]> = new Map(); // connection latencies
  private readonly HISTORY_SIZE = 500; // Keep last 500 samples for percentile calculation

  constructor() {
    this.initializeMetrics();
  }
  
  /**
   * Calculate percentiles from a sorted array of numbers
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }
  
  /**
   * Update latency history and calculate percentiles for a component
   */
  private updateLatencyPercentiles(id: string, currentLatency: number, metrics: ComponentMetrics) {
    // Get or initialize history
    let history = this.latencyHistory.get(id);
    if (!history) {
      history = [];
      this.latencyHistory.set(id, history);
    }
    
    // Add current latency to history
    history.push(currentLatency);
    
    // Keep only last HISTORY_SIZE samples (rolling window)
    if (history.length > this.HISTORY_SIZE) {
      history.shift();
    }
    
    // Calculate percentiles from sorted values
    if (history.length > 0) {
      const sorted = [...history].sort((a, b) => a - b);
      metrics.latencyP50 = this.calculatePercentile(sorted, 50);
      metrics.latencyP99 = this.calculatePercentile(sorted, 99);
    }
  }
  
  /**
   * Update latency history and calculate percentiles for a connection
   */
  private updateConnectionLatencyPercentiles(id: string, currentLatency: number, metrics: ConnectionMetrics) {
    // Get or initialize history
    let history = this.connectionLatencyHistory.get(id);
    if (!history) {
      history = [];
      this.connectionLatencyHistory.set(id, history);
    }
    
    // Add current latency to history
    history.push(currentLatency);
    
    // Keep only last HISTORY_SIZE samples (rolling window)
    if (history.length > this.HISTORY_SIZE) {
      history.shift();
    }
    
    // Calculate percentiles from sorted values
    if (history.length > 0) {
      const sorted = [...history].sort((a, b) => a - b);
      metrics.latencyP50 = this.calculatePercentile(sorted, 50);
      metrics.latencyP99 = this.calculatePercentile(sorted, 99);
    }
  }

  /**
   * Initialize emulation engine with diagram nodes and connections
   */
  public initialize(nodes: CanvasNode[], connections: CanvasConnection[]) {
    this.nodes = nodes;
    this.connections = connections;
    this.initializeMetrics();
  }

  /**
   * Start the emulation simulation
   */
  public start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.baseTime = Date.now();
    
    this.intervalId = setInterval(() => {
      this.simulate();
    }, this.updateInterval);
  }

  /**
   * Stop the emulation simulation
   */
  public stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Run one simulation step
   */
  private simulate() {
    this.simulationTime = Date.now() - this.baseTime;
    
    // Update component metrics based on their configuration
    for (const node of this.nodes) {
      this.updateComponentMetrics(node);
    }
    
    // Update connection metrics based on source/target throughput
    for (const connection of this.connections) {
      this.updateConnectionMetrics(connection);
    }
    
    // Update Prometheus exporter with latest metrics
    prometheusExporter.updateMetrics(this.metrics, this.connectionMetrics, this.nodes);
  }

  /**
   * Update metrics for a single component based on its config
   */
  private updateComponentMetrics(node: CanvasNode) {
    const config = (node.data.config || {}) as ComponentConfig;
    const metrics = this.metrics.get(node.id) || this.createDefaultMetrics(node.id, node.type);
    
    // Apply component-specific logic
    switch (node.type) {
      case 'kafka':
        this.simulateKafka(node, config, metrics);
        break;
      case 'rabbitmq':
        this.simulateRabbitMQ(node, config, metrics);
        break;
      case 'postgres':
      case 'mongodb':
      case 'redis':
        this.simulateDatabase(node, config, metrics);
        break;
      case 'nginx':
        this.simulateNginx(node, config, metrics);
        break;
      case 'docker':
      case 'kubernetes':
        this.simulateInfrastructure(node, config, metrics);
        break;
      case 'rest':
      case 'grpc':
      case 'websocket':
        this.simulateAPI(node, config, metrics);
        break;
    }
    
    // Update latency percentiles (p50/p99) from history
    this.updateLatencyPercentiles(node.id, metrics.latency, metrics);
    
    metrics.timestamp = Date.now();
    this.metrics.set(node.id, metrics);
  }

  /**
   * Update metrics for a connection based on source/target throughput
   */
  private updateConnectionMetrics(connection: CanvasConnection) {
    const sourceMetrics = this.metrics.get(connection.source);
    const targetMetrics = this.metrics.get(connection.target);
    
    if (!sourceMetrics || !targetMetrics) return;
    
    const connMetrics = this.connectionMetrics.get(connection.id) || {
      id: connection.id,
      source: connection.source,
      target: connection.target,
      traffic: 0,
      latency: 0,
      errorRate: 0,
      utilization: 0,
      timestamp: Date.now(),
      throughputDependency: 0,
      backpressure: 0,
      bottleneck: false,
      effectiveThroughput: 0,
      congestion: 0,
    };
    
    const sourceNode = this.nodes.find(n => n.id === connection.source);
    const targetNode = this.nodes.find(n => n.id === connection.target);
    const payloadSize = (sourceNode?.data.config?.avgPayloadSize || 1024); // bytes
    
    // Traffic from source throughput (with payload size)
    connMetrics.traffic = (sourceMetrics.throughput * payloadSize) / 1024; // KB/sec
    
    // Latency depends on connection type and network characteristics
    connMetrics.latency = this.calculateConnectionLatency(connection, sourceMetrics, targetMetrics);
    
    // Error rate propagates from source
    connMetrics.errorRate = sourceMetrics.errorRate * 0.1; // reduced by 90%
    
    // Calculate interaction metrics
    this.calculateInteractionMetrics(connection, connMetrics, sourceMetrics, targetMetrics, sourceNode, targetNode);
    
    // Update connection latency percentiles (p50/p99) from history
    this.updateConnectionLatencyPercentiles(connection.id, connMetrics.latency, connMetrics);
    
    connMetrics.timestamp = Date.now();
    this.connectionMetrics.set(connection.id, connMetrics);
  }
  
  /**
   * Calculate interaction metrics: throughput dependencies, backpressure, bottlenecks
   */
  private calculateInteractionMetrics(
    connection: CanvasConnection,
    connMetrics: ConnectionMetrics,
    sourceMetrics: ComponentMetrics,
    targetMetrics: ComponentMetrics,
    sourceNode: CanvasNode | undefined,
    targetNode: CanvasNode | undefined
  ) {
    // Get connection configuration
    const connConfig = connection.data || {};
    const bandwidthMbps = connConfig.bandwidthMbps || 1000; // Default 1 Gbps
    const bandwidthBytesPerSec = (bandwidthMbps * 1024 * 1024) / 8;
    
    // Get component capacities
    const sourceCapacity = this.getComponentCapacity(sourceNode);
    const targetCapacity = this.getComponentCapacity(targetNode);
    
    // Calculate effective throughput (limited by bandwidth and target capacity)
    const sourceThroughput = sourceMetrics.throughput;
    const payloadSize = (sourceNode?.data.config?.avgPayloadSize || 1024);
    const requestedBytesPerSec = sourceThroughput * payloadSize;
    
    // Bandwidth constraint
    const bandwidthLimited = Math.min(requestedBytesPerSec, bandwidthBytesPerSec);
    
    // Target capacity constraint (msgs/sec → bytes/sec)
    const targetCapacityBytes = targetCapacity * payloadSize;
    const targetLimited = Math.min(bandwidthLimited, targetCapacityBytes);
    
    connMetrics.effectiveThroughput = targetLimited / payloadSize; // msgs/sec
    
    // Throughput dependency: how much target depends on source
    // Higher when target receives significant portion of its load from this source
    const incomingConnections = this.connections.filter(c => c.target === connection.target);
    const totalIncomingThroughput = incomingConnections.reduce((sum, conn) => {
      const srcMetrics = this.metrics.get(conn.source);
      return sum + (srcMetrics?.throughput || 0);
    }, 0);
    
    connMetrics.throughputDependency = totalIncomingThroughput > 0 
      ? sourceThroughput / totalIncomingThroughput 
      : 0;
    
    // Backpressure: when target is overwhelmed or connection is saturated
    const targetUtilization = targetMetrics.utilization;
    const bandwidthUtilization = requestedBytesPerSec / bandwidthBytesPerSec;
    const capacityUtilization = sourceThroughput / targetCapacity;
    
    // Backpressure increases when:
    // 1. Target is highly utilized (processing at capacity)
    // 2. Bandwidth is saturated
    // 3. Packet loss occurs
    const packetLoss = (connConfig.packetLossPercent || 0) / 100;
    connMetrics.backpressure = Math.min(1, 
      (targetUtilization * 0.4) + 
      (bandwidthUtilization * 0.3) + 
      (capacityUtilization * 0.2) + 
      (packetLoss * 0.1)
    );
    
    // Bottleneck detection: is this connection limiting system throughput?
    // A connection is a bottleneck when:
    // 1. Source can produce more than connection can deliver
    // 2. Bandwidth utilization > 80%
    // 3. High backpressure (> 0.7)
    const isSourceLimited = requestedBytesPerSec > bandwidthBytesPerSec * 0.8;
    const isTargetLimited = sourceThroughput > targetCapacity * 0.8;
    const hasHighBackpressure = connMetrics.backpressure > 0.7;
    
    connMetrics.bottleneck = isSourceLimited || isTargetLimited || hasHighBackpressure;
    
    // Congestion: network-level congestion (latency + packet loss + utilization)
    const baseLatency = this.getBaseLatency(connection.type);
    const excessLatency = Math.max(0, connMetrics.latency - baseLatency) / baseLatency;
    
    connMetrics.congestion = Math.min(1,
      (bandwidthUtilization * 0.4) +
      (excessLatency * 0.3) +
      (packetLoss * 0.3)
    );
    
    // Utilization based on effective throughput vs theoretical capacity
    connMetrics.utilization = Math.min(1, 
      connMetrics.effectiveThroughput / targetCapacity
    );
  }
  
  /**
   * Get component capacity (msgs/sec or requests/sec)
   */
  private getComponentCapacity(node: CanvasNode | undefined): number {
    if (!node) return 1000; // default
    
    const config = node.data.config || {};
    
    switch (node.type) {
      case 'kafka':
      case 'rabbitmq':
        return config.throughputMsgs || 1000;
      case 'postgres':
      case 'mongodb':
      case 'redis':
        return config.maxConnections ? (config.maxConnections * 10) : 1000;
      case 'nginx':
      case 'rest':
      case 'grpc':
      case 'websocket':
        return config.requestsPerSecond || 1000;
      case 'docker':
      case 'kubernetes':
        return (config.workerThreads || 1) * 500;
      default:
        return 1000;
    }
  }
  
  /**
   * Get base latency for connection type (ms)
   */
  private getBaseLatency(type: string): number {
    const baseLatencies: Record<string, number> = {
      'sync': 5,
      'async': 2,
      'http': 10,
      'grpc': 5,
      'websocket': 3,
    };
    return baseLatencies[type] || 10;
  }

  /**
   * Kafka broker emulation
   */
  private simulateKafka(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics) {
    const topicCount = config.topicCount || 5;
    const partitions = config.partitions || 3;
    const throughputMsgs = config.throughputMsgs || 1000; // msgs/sec
    const replicationFactor = config.replicationFactor || 1;
    
    // Throughput varies slightly with a sine wave pattern (realistic broker behavior)
    const variation = 0.2 * Math.sin(this.simulationTime / 1000);
    metrics.throughput = throughputMsgs * (1 + variation);
    
    // Latency 5-50ms depending on partition count and replication
    metrics.latency = 5 + partitions * 2 + replicationFactor * 3;
    
    // Error rate increases with replication factor complexity
    metrics.errorRate = Math.max(0, 0.001 * replicationFactor);
    
    // Utilization based on topic/partition count
    metrics.utilization = Math.min(1, (topicCount * partitions) / 100);
    
    // Custom metrics
    metrics.customMetrics = {
      'topics': topicCount,
      'partitions': partitions,
      'replication': replicationFactor,
      'lag': Math.random() * 100, // message lag in broker
    };
  }

  /**
   * RabbitMQ broker emulation
   */
  private simulateRabbitMQ(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics) {
    const throughputMsgs = config.throughputMsgs || 1000; // msgs/sec
    const replicationFactor = config.replicationFactor || 1;
    
    // Throughput with random jitter
    const jitter = (Math.random() - 0.5) * 0.1;
    metrics.throughput = throughputMsgs * (1 + jitter);
    
    // Latency 2-20ms
    metrics.latency = 2 + replicationFactor * 5 + Math.random() * 10;
    
    // Error rate for queue delivery failures
    metrics.errorRate = 0.0005;
    
    // Utilization based on message queue backlog
    const queueBacklog = Math.random() * 10000; // simulated queue size
    metrics.utilization = Math.min(1, queueBacklog / 100000);
    
    metrics.customMetrics = {
      'queue_depth': Math.round(queueBacklog),
      'connections': Math.floor(Math.random() * 50) + 10,
      'replication': replicationFactor,
    };
  }

  /**
   * Database emulation (PostgreSQL, MongoDB, Redis)
   */
  private simulateDatabase(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics) {
    const maxConnections = config.maxConnections || 100;
    const queryLatency = config.queryLatency || 10; // ms
    const indexCount = config.indexCount || 5;
    
    // Throughput (queries/sec)
    const activeConnections = Math.floor(maxConnections * Math.random());
    metrics.throughput = activeConnections * (1000 / (queryLatency + Math.random() * 20));
    
    // Latency increases with active connections
    metrics.latency = queryLatency + (activeConnections / maxConnections) * 50;
    
    // Error rate from transaction failures
    metrics.errorRate = 0.001;
    
    // Utilization
    metrics.utilization = activeConnections / maxConnections;
    
    metrics.customMetrics = {
      'active_connections': activeConnections,
      'max_connections': maxConnections,
      'indexes': indexCount,
      'cache_hit_ratio': Math.random() * 0.8 + 0.2, // 20-100%
    };
  }

  /**
   * NGINX load balancer emulation
   */
  private simulateNginx(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics) {
    const workerThreads = config.workerThreads || 4;
    const throughputReqs = config.requestsPerSecond || 10000;
    
    // Throughput with load variation
    const loadVariation = 0.5 * Math.sin(this.simulationTime / 2000) + 0.5;
    metrics.throughput = throughputReqs * loadVariation;
    
    // Latency 1-5ms for balancing
    metrics.latency = 1 + (1 - loadVariation) * 4;
    
    // Very low error rate
    metrics.errorRate = 0.00001;
    
    // Utilization based on worker threads
    metrics.utilization = Math.min(1, (metrics.throughput / throughputReqs) * (workerThreads / 4));
    
    metrics.customMetrics = {
      'worker_threads': workerThreads,
      'active_connections': Math.floor(metrics.throughput * 0.1),
      'cache_hits': Math.floor(Math.random() * 10000),
      'cache_misses': Math.floor(Math.random() * 1000),
    };
  }

  /**
   * Docker/Kubernetes infrastructure emulation
   */
  private simulateInfrastructure(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics) {
    const workerCount = config.workerThreads || 1;
    
    // Throughput (container events/sec)
    metrics.throughput = 100 * workerCount + Math.random() * 50;
    
    // Latency for orchestration
    metrics.latency = 50 + Math.random() * 100;
    
    // Low error rate
    metrics.errorRate = 0.0001;
    
    // Utilization of resources
    metrics.utilization = Math.random() * 0.8; // typically 0-80%
    
    metrics.customMetrics = {
      'replicas': workerCount,
      'cpu_percent': Math.random() * 80,
      'memory_percent': Math.random() * 70,
    };
  }

  /**
   * API (REST, gRPC, WebSocket) emulation
   */
  private simulateAPI(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics) {
    const rps = config.requestsPerSecond || 100;
    const responseLatency = config.responseLatency || 50;
    
    // Throughput with slight variation
    const variation = Math.sin(this.simulationTime / 1500) * 0.1 + 1;
    metrics.throughput = rps * variation;
    
    // Latency
    metrics.latency = responseLatency + Math.random() * 30;
    
    // API error rate (typical 0.5%)
    metrics.errorRate = 0.005;
    
    // Utilization
    metrics.utilization = (metrics.throughput / rps) * Math.random();
    
    metrics.customMetrics = {
      'rps': rps,
      'p50_latency': Math.round(responseLatency * 0.5),
      'p99_latency': Math.round(responseLatency * 2),
      'errors': Math.round(metrics.throughput * metrics.errorRate),
    };
  }

  /**
   * Calculate connection latency based on type, network characteristics, and component metrics
   */
  private calculateConnectionLatency(
    conn: CanvasConnection,
    sourceMetrics: ComponentMetrics,
    targetMetrics: ComponentMetrics
  ): number {
    const baseLatency: Record<string, number> = {
      'sync': 5,
      'async': 2,
      'http': 10,
      'grpc': 5,
      'websocket': 3,
    };
    
    const connLatency = baseLatency[conn.type] || 10;
    const sourceLatency = sourceMetrics.latency || 0;
    const targetLatency = targetMetrics.latency || 0;
    
    // Network latency from connection config
    const connConfig = conn.data || {};
    const configuredLatency = connConfig.latencyMs || 0;
    const jitter = (connConfig.jitterMs || 0) * (Math.random() - 0.5);
    
    // Network latency (2-10ms base)
    const networkLatency = 2 + Math.random() * 8 + configuredLatency + jitter;
    
    return connLatency + (sourceLatency + targetLatency) / 2 + networkLatency;
  }

  /**
   * Create default metrics for a component
   */
  private createDefaultMetrics(id: string, type: string): ComponentMetrics {
    return {
      id,
      type,
      throughput: 0,
      latency: 0,
      errorRate: 0,
      utilization: 0,
      timestamp: Date.now(),
    };
  }

  /**
   * Initialize metrics for all nodes
   */
  private initializeMetrics() {
    this.metrics.clear();
    this.connectionMetrics.clear();
    this.latencyHistory.clear();
    this.connectionLatencyHistory.clear();
    
    for (const node of this.nodes) {
      this.metrics.set(node.id, this.createDefaultMetrics(node.id, node.type));
    }
  }

  /**
   * Get metrics for a component
   */
  public getComponentMetrics(nodeId: string): ComponentMetrics | undefined {
    return this.metrics.get(nodeId);
  }

  /**
   * Get metrics for a connection
   */
  public getConnectionMetrics(connectionId: string): ConnectionMetrics | undefined {
    return this.connectionMetrics.get(connectionId);
  }

  /**
   * Get all component metrics
   */
  public getAllComponentMetrics(): ComponentMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get all connection metrics
   */
  public getAllConnectionMetrics(): ConnectionMetrics[] {
    return Array.from(this.connectionMetrics.values());
  }

  /**
   * Check if emulation is running
   */
  public getIsRunning(): boolean {
    return this.isRunning;
  }

  /**\n   * Get current simulation time (ms)
   */
  public getSimulationTime(): number {
    return this.simulationTime;
  }
}

export const emulationEngine = new EmulationEngine();

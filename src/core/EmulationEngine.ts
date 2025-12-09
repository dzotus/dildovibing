import { CanvasNode, CanvasConnection } from '@/types';
import { dataFlowEngine } from './DataFlowEngine';
import { componentStateEngine } from './ComponentStateEngine';
import { RabbitMQRoutingEngine } from './RabbitMQRoutingEngine';
import { ActiveMQRoutingEngine } from './ActiveMQRoutingEngine';

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
  
  // Custom - используем unknown для безопасности типов
  [key: string]: unknown;
}

export class EmulationEngine {
  private nodes: CanvasNode[] = [];
  private connections: CanvasConnection[] = [];
  private metrics: Map<string, ComponentMetrics> = new Map();
  private connectionMetrics: Map<string, ConnectionMetrics> = new Map();
  private isRunning: boolean = false;
  private simulationTime: number = 0;
  private baseTime: number = Date.now();
  private pausedTime: number = 0; // Time accumulated before pause
  private updateInterval: number = 100; // ms
  private intervalId: NodeJS.Timeout | null = null;
  
  // Latency history for percentile calculations (rolling window)
  private latencyHistory: Map<string, number[]> = new Map(); // component latencies
  private connectionLatencyHistory: Map<string, number[]> = new Map(); // connection latencies
  private readonly HISTORY_SIZE = 500; // Keep last 500 samples for percentile calculation
  
  // RabbitMQ routing engines per node
  private rabbitMQRoutingEngines: Map<string, RabbitMQRoutingEngine> = new Map();
  private lastRabbitMQUpdate: Map<string, number> = new Map();
  
  // ActiveMQ routing engines per node
  private activeMQRoutingEngines: Map<string, ActiveMQRoutingEngine> = new Map();
  private lastActiveMQUpdate: Map<string, number> = new Map();

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
    
    // Initialize data flow engine
    dataFlowEngine.initialize(nodes, connections);
  }

  /**
   * Update nodes and connections without resetting metrics
   * (useful when canvas is modified during simulation)
   */
  public updateNodesAndConnections(nodes: CanvasNode[], connections: CanvasConnection[]) {
    this.nodes = nodes;
    this.connections = connections;
    
    // Update metrics for new nodes
    for (const node of nodes) {
      if (!this.metrics.has(node.id)) {
        this.metrics.set(node.id, this.createDefaultMetrics(node.id, node.type));
      }
      
      // Initialize RabbitMQ routing engine for RabbitMQ nodes
      if (node.type === 'rabbitmq') {
        this.initializeRabbitMQRoutingEngine(node);
      }
      
      // Initialize ActiveMQ routing engine for ActiveMQ nodes
      if (node.type === 'activemq') {
        this.initializeActiveMQRoutingEngine(node);
      }
    }
    
    // Remove metrics for deleted nodes
    const nodeIds = new Set(nodes.map(n => n.id));
    for (const [nodeId] of this.metrics.entries()) {
      if (!nodeIds.has(nodeId)) {
        this.metrics.delete(nodeId);
        this.rabbitMQRoutingEngines.delete(nodeId);
        this.activeMQRoutingEngines.delete(nodeId);
        this.lastRabbitMQUpdate.delete(nodeId);
        this.lastActiveMQUpdate.delete(nodeId);
      }
    }
    
    // Update connection metrics for new connections
    for (const connection of connections) {
      if (!this.connectionMetrics.has(connection.id)) {
        this.connectionMetrics.set(connection.id, this.createDefaultConnectionMetrics(connection));
      }
    }
    
    // Remove metrics for deleted connections
    const connectionIds = new Set(connections.map(c => c.id));
    for (const [connId] of this.connectionMetrics.entries()) {
      if (!connectionIds.has(connId)) {
        this.connectionMetrics.delete(connId);
      }
    }
    
    // Update data flow engine
    dataFlowEngine.updateNodesAndConnections(nodes, connections);
  }

  /**
   * Start the emulation simulation
   */
  public start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    // Continue from where we paused, not from 0
    this.baseTime = Date.now() - this.pausedTime;
    
    // Start data flow engine
    dataFlowEngine.start();
    
    this.intervalId = setInterval(() => {
      this.simulate();
    }, this.updateInterval);
  }

  /**
   * Stop the emulation simulation
   */
  public stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    // Save current simulation time so we can resume later
    this.pausedTime = this.simulationTime;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Stop data flow engine
    dataFlowEngine.stop();
  }
  
  /**
   * Reset the simulation to initial state
   */
  public resetSimulation() {
    this.stop();
    this.simulationTime = 0;
    this.pausedTime = 0;
    this.baseTime = Date.now();
    this.initializeMetrics();
  }

  /**
   * Run one simulation step
   */
  private simulate() {
    this.simulationTime = Date.now() - this.baseTime;
    
    // Process RabbitMQ consumption (before updating metrics)
    const now = Date.now();
    for (const [nodeId, routingEngine] of this.rabbitMQRoutingEngines.entries()) {
      const lastUpdate = this.lastRabbitMQUpdate.get(nodeId) || now;
      const deltaTime = now - lastUpdate;
      if (deltaTime > 0) {
        routingEngine.processConsumption(deltaTime);
        this.lastRabbitMQUpdate.set(nodeId, now);
      }
    }
    
    // Process ActiveMQ consumption (before updating metrics)
    for (const [nodeId, routingEngine] of this.activeMQRoutingEngines.entries()) {
      const lastUpdate = this.lastActiveMQUpdate.get(nodeId) || now;
      const deltaTime = now - lastUpdate;
      if (deltaTime > 0) {
        routingEngine.processConsumption(deltaTime);
        this.lastActiveMQUpdate.set(nodeId, now);
      }
    }
    
    // Update component metrics based on their configuration
    for (const node of this.nodes) {
      this.updateComponentMetrics(node);
    }
    
    // Update connection metrics based on source/target throughput
    for (const connection of this.connections) {
      this.updateConnectionMetrics(connection);
    }
  }

  /**
   * Update metrics for a single component based on its config
   */
  private updateComponentMetrics(node: CanvasNode) {
    const config = (node.data.config || {}) as ComponentConfig;
    const metrics = this.metrics.get(node.id) || this.createDefaultMetrics(node.id, node.type);
    
    // Check if component has incoming connections (receives data)
    const hasIncomingConnections = this.connections.some(conn => conn.target === node.id);
    // Check if component has outgoing connections (sends data)
    const hasOutgoingConnections = this.connections.some(conn => conn.source === node.id);
    // Component is active if it has connections
    const isActive = hasIncomingConnections || hasOutgoingConnections;
    
    // Only generate metrics for components with connections
    // Components without connections should have zero metrics
    if (!isActive) {
      // Reset to default (zero) metrics for unconnected components
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0;
      metrics.customMetrics = {};
    } else {
      // Apply component-specific logic only for connected components
      switch (node.type) {
        case 'kafka':
          this.simulateKafka(node, config, metrics, hasIncomingConnections);
          break;
        case 'rabbitmq':
          this.simulateRabbitMQ(node, config, metrics, hasIncomingConnections);
          break;
        case 'activemq':
          this.simulateActiveMQ(node, config, metrics, hasIncomingConnections);
          break;
        case 'postgres':
        case 'mongodb':
        case 'redis':
          this.simulateDatabase(node, config, metrics, hasIncomingConnections);
          break;
        case 'nginx':
          this.simulateNginx(node, config, metrics, hasIncomingConnections);
          break;
        case 'docker':
        case 'kubernetes':
          this.simulateInfrastructure(node, config, metrics, hasIncomingConnections);
          break;
        case 'rest':
        case 'grpc':
        case 'websocket':
          this.simulateAPI(node, config, metrics, hasIncomingConnections);
          break;
      }
    }
    
    // Apply cascade effects from dependencies
    this.applyCascadeEffects(node, metrics);
    
    // Apply manual state control (enabled/disabled/degraded)
    const stateEffects = componentStateEngine.applyStateEffects(node.id, {
      throughput: metrics.throughput,
      latency: metrics.latency,
      errorRate: metrics.errorRate,
      utilization: metrics.utilization,
    });
    
    metrics.throughput = stateEffects.throughput;
    metrics.latency = stateEffects.latency;
    metrics.errorRate = stateEffects.errorRate;
    metrics.utilization = stateEffects.utilization;
    
    // Update latency percentiles (p50/p99) from history
    this.updateLatencyPercentiles(node.id, metrics.latency, metrics);
    
    metrics.timestamp = Date.now();
    this.metrics.set(node.id, metrics);
  }

  /**
   * Apply cascade effects from dependent components
   * Errors and delays propagate through the dependency chain
   */
  private applyCascadeEffects(node: CanvasNode, metrics: ComponentMetrics) {
    // Find all incoming connections (dependencies)
    const incomingConnections = this.connections.filter(c => c.target === node.id);
    
    if (incomingConnections.length === 0) return; // No dependencies, no cascade
    
    let totalCascadeErrorRate = 0;
    let totalCascadeLatency = 0;
    let totalDependencyWeight = 0;
    
    // Store base latency before cascade effects (the latency set by component-specific simulation)
    const baseLatency = metrics.latency;
    
    for (const conn of incomingConnections) {
      const sourceMetrics = this.metrics.get(conn.source);
      const connMetrics = this.connectionMetrics.get(conn.id);
      
      if (!sourceMetrics || !connMetrics) continue;
      
      // Calculate dependency weight based on throughput dependency
      const weight = connMetrics.throughputDependency || 0.5;
      totalDependencyWeight += weight;
      
      // Cascade error rate: errors from source propagate to target
      // Higher dependency = more error propagation
      const cascadeError = sourceMetrics.errorRate * weight * 0.3; // 30% of source errors cascade
      totalCascadeErrorRate += cascadeError * weight;
      
      // Cascade latency: use only the BASE latency portion from source to avoid accumulation
      // We estimate base latency as min(sourceLatency, 500) to avoid using already-accumulated values
      const sourceBaseLatency = Math.min(sourceMetrics.latency, 500);
      const cascadeLatency = sourceBaseLatency * weight * 0.2; // 20% of source latency cascades
      totalCascadeLatency += cascadeLatency * weight;
      
      // If source is down or critical, significantly affect target
      if (sourceMetrics.errorRate > 0.5 || sourceMetrics.utilization > 0.95) {
        // Source is failing, cascade more errors
        totalCascadeErrorRate += 0.1 * weight;
        totalCascadeLatency += 100 * weight; // Add significant delay
      }
    }
    
    // Normalize by total weight
    if (totalDependencyWeight > 0) {
      totalCascadeErrorRate /= totalDependencyWeight;
      totalCascadeLatency /= totalDependencyWeight;
    }
    
    // Cap cascade latency to prevent unbounded growth
    const maxCascadeLatency = 500; // Maximum 500ms of cascade latency
    totalCascadeLatency = Math.min(totalCascadeLatency, maxCascadeLatency);
    
    // Apply cascade effects to metrics
    // Error rate: add cascade errors (capped at reasonable level)
    metrics.errorRate = Math.min(1, metrics.errorRate + totalCascadeErrorRate);
    
    // Latency: add cascade delays to base latency (not accumulated)
    // This ensures latency = baseLatency + cascadeEffect, not infinite accumulation
    metrics.latency = baseLatency + totalCascadeLatency;
    
    // Cap total latency to a reasonable maximum
    const maxTotalLatency = 10000; // Maximum 10 seconds
    metrics.latency = Math.min(metrics.latency, maxTotalLatency);
    
    // Utilization: if dependencies are slow, this component may wait
    // This increases effective utilization
    if (totalCascadeLatency > 50) {
      metrics.utilization = Math.min(1, metrics.utilization + 0.1);
    }
    
    // Throughput: if dependencies are failing, reduce effective throughput
    if (totalCascadeErrorRate > 0.1) {
      metrics.throughput = metrics.throughput * (1 - totalCascadeErrorRate * 0.5);
    }
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
      case 'activemq':
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
   * Kafka broker emulation with realistic simulation based on actual configuration
   */
  private simulateKafka(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    // Extract real Kafka configuration from node.data.config
    const kafkaConfig = node.data.config as any;
    const brokers = kafkaConfig?.brokers || ['localhost:9092'];
    const topics = kafkaConfig?.topics || [];
    const consumerGroups = kafkaConfig?.consumerGroups || [];
    
    // Fallback to generic config if Kafka-specific config not available
    const topicCount = topics.length || config.topicCount || 5;
    const totalPartitions = topics.reduce((sum: number, topic: any) => sum + (topic.partitions || 3), 0) || config.partitions || 3;
    const avgReplicationFactor = topics.length > 0 
      ? topics.reduce((sum: number, topic: any) => sum + (topic.replication || 1), 0) / topics.length 
      : config.replicationFactor || 1;
    
    // Calculate incoming throughput from connections
    const incomingConnections = this.connections.filter(c => c.target === node.id);
    let incomingThroughput = 0;
    for (const conn of incomingConnections) {
      const sourceMetrics = this.metrics.get(conn.source);
      if (sourceMetrics) {
        incomingThroughput += sourceMetrics.throughput || 0;
      }
    }
    
    // Use configured throughput or calculate from incoming connections
    const baseThroughputMsgs = config.throughputMsgs || Math.max(1000, incomingThroughput);
    
    if (!hasIncomingConnections && baseThroughputMsgs <= 0) {
      // No incoming data, reset metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0;
      
      // Reset topic metrics
      if (topics.length > 0) {
        for (const topic of topics) {
          topic.messages = topic.messages || 0;
          topic.size = topic.size || 0;
        }
      }
      
      // Reset consumer group lag
      for (const group of consumerGroups) {
        group.lag = 0;
      }
      
      metrics.customMetrics = {
        'topics': topicCount,
        'partitions': totalPartitions,
        'replication': Math.round(avgReplicationFactor * 10) / 10,
        'brokers': brokers.length,
        'consumer_groups': consumerGroups.length,
        'total_lag': 0,
      };
      return;
    }
    
    // Throughput varies slightly with a sine wave pattern (realistic broker behavior)
    const variation = 0.2 * Math.sin(this.simulationTime / 1000);
    metrics.throughput = baseThroughputMsgs * (1 + variation);
    
    // Calculate latency based on realistic factors
    // Base latency: 2-5ms for broker processing
    // Partition overhead: ~1ms per 10 partitions
    // Replication overhead: ~2-5ms per replication write (network + disk)
    // Compression overhead: varies by type
    const baseLatency = 3;
    const partitionOverhead = Math.min(totalPartitions / 10, 10); // Max 10ms
    const replicationNetworkLatency = Math.max(1, (avgReplicationFactor - 1) * 2); // 2ms per additional replica
    const replicationDiskLatency = Math.max(0, (avgReplicationFactor - 1) * 1); // 1ms per additional replica
    
    // Compression type affects latency (decompression on read)
    const compressionOverhead = this.calculateCompressionOverhead(topics);
    
    metrics.latency = baseLatency + partitionOverhead + replicationNetworkLatency + replicationDiskLatency + compressionOverhead;
    
    // Add network latency between brokers (if multiple brokers)
    if (brokers.length > 1) {
      const interBrokerLatency = Math.min(5, brokers.length * 0.5); // ~0.5ms per additional broker
      metrics.latency += interBrokerLatency;
    }
    
    // Error rate based on replication and under-replicated partitions
    const underReplicatedPartitions = this.calculateUnderReplicatedPartitions(topics, brokers.length);
    const replicationComplexity = avgReplicationFactor > 1 ? (avgReplicationFactor - 1) * 0.0005 : 0;
    const underReplicationErrorRate = underReplicatedPartitions > 0 ? underReplicatedPartitions * 0.001 : 0;
    
    // Check ACL permissions for producers (Write operations)
    const acls = kafkaConfig?.acls || [];
    let aclErrorRate = 0;
    let aclBlockedThroughput = 0;
    
    // Check each incoming connection (producer) for Write permissions
    for (const conn of incomingConnections) {
      const sourceNode = this.nodes.find(n => n.id === conn.source);
      if (!sourceNode) continue;
      
      // Get producer principal (clientId or component ID)
      const producerConfig = sourceNode.data.config || {};
      const producerPrincipal = producerConfig.messaging?.producerId || 
                                producerConfig.clientId || 
                                `User:${sourceNode.id.slice(0, 8)}`;
      
      // Get target topic from connection metadata or default
      const targetTopic = producerConfig.messaging?.topic || 
                         topics[0]?.name || 
                         'default-topic';
      
      // Check if producer has Write permission for this topic
      const hasWritePermission = this.checkACLPermission(
        acls,
        producerPrincipal,
        'Topic',
        targetTopic,
        'Write'
      );
      
      if (!hasWritePermission) {
        // Producer doesn't have Write permission - block writes
        const sourceMetrics = this.metrics.get(conn.source);
        if (sourceMetrics) {
          // Block 90% of throughput, add to error rate
          aclBlockedThroughput += sourceMetrics.throughput * 0.9;
          aclErrorRate += 0.45; // 45% error rate for denied writes
        }
      }
    }
    
    // Adjust throughput based on ACL denials
    if (aclBlockedThroughput > 0) {
      metrics.throughput = Math.max(0, metrics.throughput - aclBlockedThroughput);
    }
    
    metrics.errorRate = Math.max(0, Math.min(0.1, replicationComplexity + underReplicationErrorRate + aclErrorRate + 0.0001));
    
    // Utilization based on topic/partition count and throughput
    const maxThroughput = 10000; // Estimated max throughput for broker
    const throughputUtilization = Math.min(1, metrics.throughput / maxThroughput);
    const partitionUtilization = Math.min(1, totalPartitions / 200); // Assume 200 partitions max per broker
    metrics.utilization = Math.min(1, (throughputUtilization * 0.7) + (partitionUtilization * 0.3));
    
    // Update topic-level metrics (messages, size)
    const avgMessageSize = (config.avgPayloadSize || 1024); // bytes
    const timeDelta = this.updateInterval / 1000; // seconds
    
    for (const topic of topics) {
      // Update messages based on throughput distribution
      const topicThroughput = metrics.throughput / topicCount; // Distribute evenly across topics
      const messagesIncrement = topicThroughput * timeDelta;
      topic.messages = (topic.messages || 0) + messagesIncrement;
      
      // Update size (with compression consideration)
      const compressionRatio = this.getCompressionRatio(topic.config?.compressionType);
      const sizeIncrement = messagesIncrement * avgMessageSize * compressionRatio;
      topic.size = (topic.size || 0) + sizeIncrement;
      
      // Apply retention policy (cleanup old messages)
      if (topic.config?.retentionMs && topic.config.retentionMs > 0) {
        // Retention cleanup would happen periodically in real Kafka
        // For simulation, we can reduce messages proportionally based on age
        // This is simplified - in real Kafka, segments are deleted
        const retentionSec = topic.config.retentionMs / 1000;
        const messagesPerSec = topicThroughput;
        const maxMessages = messagesPerSec * retentionSec;
        if (topic.messages > maxMessages) {
          const excess = topic.messages - maxMessages;
          topic.messages = maxMessages;
          topic.size = Math.max(0, topic.size - (excess * avgMessageSize * compressionRatio));
        }
      }
      
      // Apply retention bytes if configured
      if (topic.config?.retentionBytes && topic.config.retentionBytes > 0 && topic.size > topic.config.retentionBytes) {
        const excessRatio = 1 - (topic.config.retentionBytes / topic.size);
        topic.size = topic.config.retentionBytes;
        topic.messages = Math.max(0, topic.messages * (1 - excessRatio));
      }
      
      // Apply cleanup policy (delete vs compact)
      // For compact topics, we simulate log compaction (removes duplicate keys, keeps latest)
      // This affects the actual message count vs logical message count
      if (topic.config?.cleanupPolicy === 'compact' || topic.config?.cleanupPolicy === 'delete,compact') {
        // Log compaction reduces message count (removes duplicates)
        // In real Kafka, compaction runs periodically
        // For simulation, we apply a compaction ratio
        const compactionRatio = 0.85; // 15% reduction due to compaction
        const compactionInterval = 300000; // 5 minutes
        
        // Simulate periodic compaction
        if (this.simulationTime % compactionInterval < this.updateInterval) {
          const compactedMessages = Math.round(topic.messages * compactionRatio);
          const messagesRemoved = topic.messages - compactedMessages;
          topic.messages = compactedMessages;
          topic.size = Math.max(0, topic.size - (messagesRemoved * avgMessageSize * compressionRatio));
        }
      }
      
      // Apply min.insync.replicas to error rate
      // If not enough replicas are in sync, writes may fail
      if (topic.config?.minInsyncReplicas) {
        const minISR = topic.config.minInsyncReplicas;
        const actualISR = this.getAverageISRCount(topic, brokers.length);
        
        if (actualISR < minISR) {
          // Not enough replicas in sync - increase error rate
          const isrDeficit = minISR - actualISR;
          metrics.errorRate += isrDeficit * 0.01; // 1% error rate per missing ISR
        }
      }
      
      // Apply max.message.bytes constraint
      if (topic.config?.maxMessageBytes && avgMessageSize > topic.config.maxMessageBytes) {
        // Messages exceed max size - simulate rejection
        const rejectionRate = Math.min(0.1, (avgMessageSize - topic.config.maxMessageBytes) / topic.config.maxMessageBytes);
        metrics.errorRate += rejectionRate * 0.5; // Up to 5% additional error rate
      }
    }
    
    // Calculate consumer group lag dynamically with partition assignment
    let totalLag = 0;
    for (const group of consumerGroups) {
      const groupTopic = topics.find((t: any) => t.name === group.topic);
      if (!groupTopic) continue;
      
      // Partition assignment logic
      const members = group.members || 1;
      const topicPartitions = groupTopic.partitions || 1;
      
      // Calculate partition assignment (range assignment strategy)
      const partitionAssignment = this.assignPartitionsToConsumers(members, topicPartitions);
      
      // Calculate consumption rate per partition
      // Each partition can be consumed at ~200-500 msgs/sec (depends on consumer performance)
      const consumptionRatePerPartition = 300; // msgs/sec per partition
      
      // Total consumption rate = sum of consumption rates for assigned partitions
      let totalConsumptionRate = 0;
      for (const assignment of partitionAssignment) {
        const partitionsAssigned = assignment.partitions.length;
        totalConsumptionRate += partitionsAssigned * consumptionRatePerPartition;
      }
      
      // If there are more consumers than partitions, some consumers are idle
      // If there are fewer consumers than partitions, some consumers handle multiple partitions
      const effectiveConsumptionRate = Math.min(totalConsumptionRate, members * consumptionRatePerPartition);
      
      // Calculate topic throughput (produce rate) - distributed across partitions
      const topicThroughput = (metrics.throughput / topicCount) || 0;
      const throughputPerPartition = topicThroughput / topicPartitions;
      
      // Check ACL permissions for consumer group (Read operations)
      // Consumer principal = groupId (in real Kafka, groupId is the principal)
      const consumerPrincipal = group.id || `Group:${group.id}`;
      
      // Check Read permission for topic
      const hasTopicReadPermission = this.checkACLPermission(
        acls,
        consumerPrincipal,
        'Topic',
        group.topic,
        'Read'
      );
      
      // Check Read permission for consumer group
      const hasGroupReadPermission = this.checkACLPermission(
        acls,
        consumerPrincipal,
        'Group',
        group.id,
        'Read'
      );
      
      // If no Read permission, block consumption completely
      let effectiveConsumptionRateWithACL = effectiveConsumptionRate;
      if (!hasTopicReadPermission || !hasGroupReadPermission) {
        // Consumer doesn't have Read permission - block all consumption
        effectiveConsumptionRateWithACL = 0;
      }
      
      // Lag calculation per partition
      // Lag increases when production > consumption
      const productionRate = topicThroughput;
      const consumptionRate = effectiveConsumptionRateWithACL;
      
      // Lag increment (if production exceeds consumption)
      const lagIncrement = Math.max(0, (productionRate - consumptionRate) * timeDelta);
      
      // Current lag
      const currentLag = group.lag || 0;
      
      // Update lag: add increment and try to consume
      const newLag = Math.max(0, currentLag + lagIncrement - (consumptionRate * timeDelta));
      group.lag = newLag;
      
      totalLag += newLag;
      
      // Simulate rebalancing effects (if members changed recently)
      // In real Kafka, rebalancing causes temporary pause in consumption
      // We can simulate this by reducing consumption rate during rebalance
      if (this.isRebalancing(node.id, group.id)) {
        // Reduce consumption during rebalance (30-50% reduction)
        group.lag = Math.min(newLag * 1.2, newLag + (productionRate * timeDelta * 0.3));
        totalLag += (newLag * 0.2); // Additional lag during rebalance
      }
    }
    
    // Custom metrics with detailed information
    metrics.customMetrics = {
      'topics': topicCount,
      'partitions': totalPartitions,
      'replication': Math.round(avgReplicationFactor * 10) / 10,
      'brokers': brokers.length,
      'consumer_groups': consumerGroups.length,
      'total_lag': Math.round(totalLag),
      'avg_topic_messages': topicCount > 0 ? Math.round(topics.reduce((sum: number, t: any) => sum + (t.messages || 0), 0) / topicCount) : 0,
      'total_topic_size_mb': Math.round(topics.reduce((sum: number, t: any) => sum + (t.size || 0), 0) / 1024 / 1024 * 100) / 100,
      'under_replicated_partitions': underReplicatedPartitions,
    };
  }
  
  /**
   * Calculate compression overhead based on compression types used in topics
   */
  private calculateCompressionOverhead(topics: any[]): number {
    if (topics.length === 0) return 0;
    
    const compressionOverheads: Record<string, number> = {
      'uncompressed': 0,
      'gzip': 2,
      'snappy': 0.5,
      'lz4': 0.3,
      'zstd': 1,
    };
    
    let totalOverhead = 0;
    let topicsWithCompression = 0;
    
    for (const topic of topics) {
      const compressionType = topic.config?.compressionType || 'gzip';
      const overhead = compressionOverheads[compressionType] || 0;
      if (overhead > 0) {
        totalOverhead += overhead;
        topicsWithCompression++;
      }
    }
    
    return topicsWithCompression > 0 ? totalOverhead / topicsWithCompression : 0;
  }
  
  /**
   * Get compression ratio for size calculations
   */
  private getCompressionRatio(compressionType?: string): number {
    const ratios: Record<string, number> = {
      'uncompressed': 1.0,
      'gzip': 0.3, // ~70% compression
      'snappy': 0.5, // ~50% compression
      'lz4': 0.4, // ~60% compression
      'zstd': 0.25, // ~75% compression
    };
    return ratios[compressionType || 'gzip'] || 0.3;
  }
  
  /**
   * Calculate number of under-replicated partitions
   * In real Kafka, partitions are under-replicated if not all replicas are in ISR
   */
  private calculateUnderReplicatedPartitions(topics: any[], brokerCount: number): number {
    let underReplicated = 0;
    
    for (const topic of topics) {
      const replicationFactor = topic.replication || 1;
      const partitions = topic.partitions || 1;
      
      // Check partitionInfo if available
      if (topic.partitionInfo && Array.isArray(topic.partitionInfo)) {
        for (const partitionInfo of topic.partitionInfo) {
          const expectedReplicas = replicationFactor;
          const actualReplicas = partitionInfo.isr?.length || partitionInfo.replicas?.length || 1;
          
          if (actualReplicas < expectedReplicas) {
            underReplicated++;
          }
        }
      } else {
        // Estimate: if replication factor > available brokers, some partitions will be under-replicated
        if (replicationFactor > brokerCount) {
          underReplicated += partitions * Math.max(0, 1 - (brokerCount / replicationFactor));
        }
        
        // Random chance of under-replication (network issues, broker failures)
        // This simulates transient issues
        if (Math.random() < 0.05 && replicationFactor > 1) { // 5% chance
          underReplicated += partitions * 0.1; // ~10% of partitions affected
        }
      }
    }
    
    return Math.round(underReplicated);
  }
  
  /**
   * Assign partitions to consumers using range assignment strategy
   * This simulates Kafka's partition assignment algorithm
   */
  private assignPartitionsToConsumers(memberCount: number, partitionCount: number): Array<{ consumerId: number; partitions: number[] }> {
    if (memberCount === 0 || partitionCount === 0) return [];
    
    const assignment: Array<{ consumerId: number; partitions: number[] }> = [];
    
    // Range assignment: partitions are assigned in ranges to consumers
    // Example: 10 partitions, 3 consumers
    // Consumer 0: partitions 0-3 (4 partitions)
    // Consumer 1: partitions 4-6 (3 partitions)
    // Consumer 2: partitions 7-9 (3 partitions)
    
    const partitionsPerConsumer = Math.floor(partitionCount / memberCount);
    const extraPartitions = partitionCount % memberCount;
    
    let partitionIndex = 0;
    for (let consumerId = 0; consumerId < memberCount; consumerId++) {
      const assignedPartitions: number[] = [];
      const countForThisConsumer = partitionsPerConsumer + (consumerId < extraPartitions ? 1 : 0);
      
      for (let i = 0; i < countForThisConsumer; i++) {
        if (partitionIndex < partitionCount) {
          assignedPartitions.push(partitionIndex);
          partitionIndex++;
        }
      }
      
      assignment.push({ consumerId, partitions: assignedPartitions });
    }
    
    return assignment;
  }
  
  /**
   * Track rebalancing state for consumer groups
   * Stores previous member counts to detect changes
   */
  private consumerGroupMemberCounts: Map<string, number> = new Map();
  private rebalancingGroups: Map<string, number> = new Map(); // group key -> end time
  
  /**
   * Check if a consumer group is currently rebalancing
   */
  private isRebalancing(nodeId: string, groupId: string): boolean {
    const key = `${nodeId}:${groupId}`;
    const rebalanceEndTime = this.rebalancingGroups.get(key);
    
    if (rebalanceEndTime && Date.now() < rebalanceEndTime) {
      return true;
    }
    
    // Check if member count changed (triggering rebalance)
    const currentMembers = this.getCurrentGroupMembers(nodeId, groupId);
    const previousMembers = this.consumerGroupMemberCounts.get(key);
    
    if (previousMembers !== undefined && currentMembers !== previousMembers) {
      // Member count changed - start rebalancing
      const rebalanceDuration = 2000; // 2 seconds rebalance time
      this.rebalancingGroups.set(key, Date.now() + rebalanceDuration);
      this.consumerGroupMemberCounts.set(key, currentMembers);
      return true;
    }
    
    // Update member count
    if (previousMembers === undefined || currentMembers !== previousMembers) {
      this.consumerGroupMemberCounts.set(key, currentMembers);
    }
    
    return false;
  }
  
  /**
   * Get current member count for a consumer group
   */
  private getCurrentGroupMembers(nodeId: string, groupId: string): number {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return 0;
    
    const kafkaConfig = node.data.config as any;
    const consumerGroups = kafkaConfig?.consumerGroups || [];
    const group = consumerGroups.find((g: any) => g.id === groupId);
    
    return group?.members || 0;
  }
  
  /**
   * Get average ISR count for a topic
   * ISR (In-Sync Replicas) = replicas that are up-to-date
   */
  private getAverageISRCount(topic: any, brokerCount: number): number {
    if (!topic.partitionInfo || !Array.isArray(topic.partitionInfo) || topic.partitionInfo.length === 0) {
      // No partition info - estimate based on replication factor
      const replicationFactor = topic.replication || 1;
      // Assume most replicas are in sync (90-100%)
      return Math.min(replicationFactor, brokerCount) * 0.95;
    }
    
    // Calculate average ISR count from partitionInfo
    let totalISR = 0;
    let partitionCount = 0;
    
    for (const partitionInfo of topic.partitionInfo) {
      const isrCount = partitionInfo.isr?.length || partitionInfo.replicas?.length || 1;
      totalISR += isrCount;
      partitionCount++;
    }
    
    return partitionCount > 0 ? totalISR / partitionCount : 1;
  }
  
  /**
   * Check ACL permission for a principal
   * Implements Kafka ACL logic: Deny takes precedence, then Allow
   * Supports Literal, Prefixed, and Match pattern types
   */
  private checkACLPermission(
    acls: any[],
    principal: string,
    resourceType: 'Topic' | 'Group' | 'Cluster' | 'TransactionalId' | 'DelegationToken',
    resourceName: string,
    operation: 'Read' | 'Write' | 'Create' | 'Delete' | 'Alter' | 'Describe' | 'AlterConfigs' | 'DescribeConfigs' | 'ClusterAction' | 'IdempotentWrite' | 'All',
    host?: string
  ): boolean {
    if (!acls || acls.length === 0) {
      // No ACLs configured - default allow (Kafka default: allow if no ACLs)
      return true;
    }
    
    // Normalize principal format (User:name or Group:name)
    const normalizedPrincipal = principal.includes(':') ? principal : `User:${principal}`;
    
    // Find matching ACLs
    const matchingACLs = acls.filter((acl: any) => {
      // Check principal match
      const aclPrincipal = acl.principal || '';
      if (aclPrincipal !== normalizedPrincipal && aclPrincipal !== '*' && !normalizedPrincipal.includes(aclPrincipal)) {
        return false;
      }
      
      // Check resource type match
      if (acl.resourceType !== resourceType) {
        return false;
      }
      
      // Check resource name match based on pattern type
      const patternType = acl.resourcePatternType || 'Literal';
      const aclResourceName = acl.resourceName || '';
      
      let resourceMatches = false;
      
      switch (patternType) {
        case 'Literal':
          // Exact match
          resourceMatches = aclResourceName === resourceName || aclResourceName === '*';
          break;
          
        case 'Prefixed':
          // Prefix match (resourceName starts with ACL pattern)
          if (aclResourceName === '*') {
            resourceMatches = true;
          } else if (aclResourceName.endsWith('*')) {
            const prefix = aclResourceName.slice(0, -1);
            resourceMatches = resourceName.startsWith(prefix);
          } else {
            resourceMatches = resourceName.startsWith(aclResourceName);
          }
          break;
          
        case 'Match':
          // Wildcard pattern match (simplified: * matches anything)
          if (aclResourceName === '*') {
            resourceMatches = true;
          } else {
            // Convert simple wildcard pattern to regex
            const regexPattern = aclResourceName
              .replace(/\./g, '\\.')
              .replace(/\*/g, '.*');
            const regex = new RegExp(`^${regexPattern}$`);
            resourceMatches = regex.test(resourceName);
          }
          break;
          
        default:
          // Default to Literal
          resourceMatches = aclResourceName === resourceName || aclResourceName === '*';
      }
      
      if (!resourceMatches) {
        return false;
      }
      
      // Check operation match (operation or 'All')
      if (acl.operation !== operation && acl.operation !== 'All') {
        return false;
      }
      
      // Check host match (if specified)
      if (acl.host && acl.host !== '*' && host && acl.host !== host) {
        return false;
      }
      
      return true;
    });
    
    if (matchingACLs.length === 0) {
      // No matching ACLs - default deny in Kafka (if ACLs are enabled)
      return false;
    }
    
    // Kafka ACL logic: Deny takes precedence over Allow
    // Check for any Deny rules first
    const denyACLs = matchingACLs.filter((acl: any) => acl.permission === 'Deny');
    if (denyACLs.length > 0) {
      return false; // Denied
    }
    
    // Check for Allow rules
    const allowACLs = matchingACLs.filter((acl: any) => acl.permission === 'Allow');
    if (allowACLs.length > 0) {
      return true; // Allowed
    }
    
    // No explicit Allow or Deny (shouldn't happen, but default deny)
    return false;
  }

  /**
   * RabbitMQ broker emulation
   */
  private simulateRabbitMQ(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    // Initialize routing engine if not exists
    if (!this.rabbitMQRoutingEngines.has(node.id)) {
      this.initializeRabbitMQRoutingEngine(node);
    }
    
    const routingEngine = this.rabbitMQRoutingEngines.get(node.id)!;
    const rabbitMQConfig = (node.data.config as any) || {};
    
    if (!hasIncomingConnections) {
      // No incoming data, reset metrics but keep queue state
      metrics.throughput = 0;
      metrics.latency = 2; // Base latency even with no traffic
      metrics.errorRate = 0;
      
      // Calculate utilization from existing queue depth
      const totalQueueDepth = routingEngine.getTotalQueueDepth();
      metrics.utilization = Math.min(1, totalQueueDepth / 100000);
      
      const allQueueMetrics = routingEngine.getAllQueueMetrics();
      const connections = routingEngine.getActiveConnections();
      
      metrics.customMetrics = {
        'queue_depth': totalQueueDepth,
        'connections': connections,
        'replication': config.replicationFactor || 1,
      };
      
      // Update queue metrics in config
      this.updateQueueMetricsInConfig(node, allQueueMetrics);
      return;
    }
    
    // Calculate incoming throughput from connections
    const incomingConnections = this.connections.filter(c => c.target === node.id);
    let totalIncomingThroughput = 0;
    
    for (const conn of incomingConnections) {
      const connMetrics = this.connectionMetrics.get(conn.id);
      if (connMetrics) {
        // Estimate messages per second from connection traffic
        // Assume average message size of 1KB
        const avgMessageSize = 1024;
        const msgPerSec = connMetrics.traffic / avgMessageSize;
        totalIncomingThroughput += msgPerSec;
      }
    }
    
    // Use configured throughput if available, otherwise use calculated
    const throughputMsgs = config.throughputMsgs || totalIncomingThroughput || 1000;
    const replicationFactor = config.replicationFactor || 1;
    
    // Throughput with random jitter
    const jitter = (Math.random() - 0.5) * 0.1;
    metrics.throughput = throughputMsgs * (1 + jitter);
    
    // Latency based on queue depth and replication
    const totalQueueDepth = routingEngine.getTotalQueueDepth();
    const baseLatency = 2; // Base routing latency
    const queueLatency = Math.min(50, totalQueueDepth / 1000); // 1ms per 1000 messages, max 50ms
    metrics.latency = baseLatency + replicationFactor * 5 + queueLatency + Math.random() * 5;
    
    // Error rate for queue delivery failures (increases with queue depth)
    const baseErrorRate = 0.0005;
    const depthErrorRate = Math.min(0.01, totalQueueDepth / 1000000); // 0.01% per 100k messages
    metrics.errorRate = baseErrorRate + depthErrorRate;
    
    // Utilization based on message queue backlog
    metrics.utilization = Math.min(1, totalQueueDepth / 100000);
    
    // Get queue metrics
    const allQueueMetrics = routingEngine.getAllQueueMetrics();
    const connections = routingEngine.getActiveConnections();
    
    // Calculate total consumers
    let totalConsumers = 0;
    for (const queueMetrics of allQueueMetrics.values()) {
      totalConsumers += queueMetrics.consumers;
    }
    
    metrics.customMetrics = {
      'queue_depth': totalQueueDepth,
      'connections': connections,
      'replication': replicationFactor,
      'queues': allQueueMetrics.size,
      'consumers': totalConsumers,
    };
    
    // Update queue metrics in node config (for UI display)
    this.updateQueueMetricsInConfig(node, allQueueMetrics);
  }
  
  /**
   * Initialize RabbitMQ routing engine for a node
   */
  private initializeRabbitMQRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config as any) || {};
    const routingEngine = new RabbitMQRoutingEngine();
    
    routingEngine.initialize({
      queues: config.queues || [],
      exchanges: config.exchanges || [
        { name: 'amq.direct', type: 'direct', durable: true, autoDelete: false, internal: false },
        { name: 'amq.topic', type: 'topic', durable: true, autoDelete: false, internal: false },
        { name: 'amq.fanout', type: 'fanout', durable: true, autoDelete: false, internal: false },
      ],
      bindings: config.bindings || [],
    });
    
    this.rabbitMQRoutingEngines.set(node.id, routingEngine);
    this.lastRabbitMQUpdate.set(node.id, Date.now());
  }
  
  /**
   * Update queue metrics in node config (for UI display)
   */
  private updateQueueMetricsInConfig(
    node: CanvasNode,
    queueMetrics: Map<string, { messages: number; ready: number; unacked: number; consumers: number }>
  ): void {
    const config = (node.data.config as any) || {};
    const queues = config.queues || [];
    
    for (let i = 0; i < queues.length; i++) {
      const queue = queues[i];
      const metrics = queueMetrics.get(queue.name);
      if (metrics) {
        queues[i] = {
          ...queue,
          messages: metrics.messages,
          ready: metrics.ready,
          unacked: metrics.unacked,
          consumers: metrics.consumers,
        };
      }
    }
    
    // Update node config (this will be reflected in UI)
    config.queues = queues;
  }

  /**
   * ActiveMQ broker emulation
   */
  private simulateActiveMQ(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    // Initialize routing engine if not exists
    if (!this.activeMQRoutingEngines.has(node.id)) {
      this.initializeActiveMQRoutingEngine(node);
    }
    
    const routingEngine = this.activeMQRoutingEngines.get(node.id)!;
    const activeMQConfig = (node.data.config as any) || {};
    
    // Get protocol for latency calculation
    const protocol = activeMQConfig.protocol || 'openwire';
    const persistenceEnabled = activeMQConfig.persistenceEnabled ?? true;
    const maxConnections = activeMQConfig.maxConnections || 1000;
    const memoryLimit = activeMQConfig.memoryLimit || 1024;
    const storeUsage = activeMQConfig.storeUsage || 0;
    const tempUsage = activeMQConfig.tempUsage || 0;
    const connections = activeMQConfig.connections || [];
    
    if (!hasIncomingConnections) {
      // No incoming data, reset metrics but keep queue/topic state
      metrics.throughput = 0;
      metrics.latency = this.getProtocolBaseLatency(protocol);
      metrics.errorRate = 0;
      
      // Calculate utilization from existing queue/topic depth
      const totalQueueDepth = routingEngine.getTotalQueueDepth();
      const totalTopicMessages = routingEngine.getTotalTopicMessages();
      const totalMessages = totalQueueDepth + totalTopicMessages;
      metrics.utilization = Math.min(1, totalMessages / 100000);
      
      const allQueueMetrics = routingEngine.getAllQueueMetrics();
      const allTopicMetrics = routingEngine.getAllTopicMetrics();
      const activeConnections = routingEngine.getActiveConnections();
      
      // Calculate total consumers and subscribers
      let totalConsumers = 0;
      for (const queueMetrics of allQueueMetrics.values()) {
        totalConsumers += queueMetrics.consumerCount;
      }
      
      let totalSubscribers = 0;
      for (const topicMetrics of allTopicMetrics.values()) {
        totalSubscribers += topicMetrics.subscriberCount;
      }
      
      metrics.customMetrics = {
        'queue_depth': totalQueueDepth,
        'topic_messages': totalTopicMessages,
        'connections': activeConnections,
        'queues': allQueueMetrics.size,
        'topics': allTopicMetrics.size,
        'consumers': totalConsumers,
        'subscribers': totalSubscribers,
        'memory_usage': storeUsage + tempUsage,
        'memory_percent': memoryLimit > 0 ? ((storeUsage + tempUsage) / memoryLimit * 100) : 0,
      };
      
      // Update metrics in config
      this.updateActiveMQMetricsInConfig(node, allQueueMetrics, allTopicMetrics);
      return;
    }
    
    // Calculate incoming throughput from connections
    const incomingConnections = this.connections.filter(c => c.target === node.id);
    let totalIncomingThroughput = 0;
    
    for (const conn of incomingConnections) {
      const connMetrics = this.connectionMetrics.get(conn.id);
      if (connMetrics) {
        // Estimate messages per second from connection traffic
        // Assume average message size of 1KB
        const avgMessageSize = 1024;
        const msgPerSec = connMetrics.traffic / avgMessageSize;
        totalIncomingThroughput += msgPerSec;
      }
    }
    
    // Use configured throughput if available, otherwise use calculated
    const throughputMsgs = config.throughputMsgs || totalIncomingThroughput || 1000;
    
    // Throughput with random jitter
    const jitter = (Math.random() - 0.5) * 0.1;
    metrics.throughput = throughputMsgs * (1 + jitter);
    
    // Latency based on queue depth, protocol, and persistence
    const totalQueueDepth = routingEngine.getTotalQueueDepth();
    const totalTopicMessages = routingEngine.getTotalTopicMessages();
    const totalMessages = totalQueueDepth + totalTopicMessages;
    
    const protocolLatency = this.getProtocolBaseLatency(protocol);
    const persistenceLatency = persistenceEnabled ? 5 : 0; // 5ms for persistence
    const queueLatency = Math.min(50, totalMessages / 1000); // 1ms per 1000 messages, max 50ms
    const memoryPressureLatency = memoryLimit > 0 && (storeUsage + tempUsage) > memoryLimit * 0.8 
      ? 10 : 0; // Additional latency when memory is high
    
    metrics.latency = protocolLatency + persistenceLatency + queueLatency + memoryPressureLatency + Math.random() * 5;
    
    // Check ACL permissions for producers (Write operations) and consumers (Read operations)
    const acls = activeMQConfig.acls || [];
    let aclErrorRate = 0;
    let aclBlockedThroughput = 0;
    
    // Check each incoming connection for ACL permissions
    for (const conn of incomingConnections) {
      const sourceNode = this.nodes.find(n => n.id === conn.source);
      if (!sourceNode) continue;
      
      const sourceConfig = sourceNode.data.config as any;
      const messagingConfig = sourceConfig?.messaging || {};
      
      // Get principal from source component or use broker username as fallback
      // In real ActiveMQ, principal comes from authentication (username/password)
      const principal = sourceConfig?.username || 
                       sourceConfig?.clientId || 
                       activeMQConfig.username || // Use broker username if source doesn't have one
                       `user-${conn.source.slice(0, 8)}`;
      
      // Check if sending to queue
      if (messagingConfig.queue) {
        const hasWritePermission = this.checkActiveMQACLPermission(
          acls,
          principal,
          `queue://${messagingConfig.queue}`,
          'write'
        );
        
        if (!hasWritePermission) {
          // Producer doesn't have Write permission - block writes
          const sourceMetrics = this.metrics.get(conn.source);
          if (sourceMetrics) {
            aclBlockedThroughput += sourceMetrics.throughput * 0.9; // Block 90% of throughput
            aclErrorRate += 0.45; // 45% error rate for denied writes
          }
        }
      }
      
      // Check if publishing to topic
      if (messagingConfig.topic) {
        const hasWritePermission = this.checkActiveMQACLPermission(
          acls,
          principal,
          `topic://${messagingConfig.topic}`,
          'write'
        );
        
        if (!hasWritePermission) {
          // Producer doesn't have Write permission - block writes
          const sourceMetrics = this.metrics.get(conn.source);
          if (sourceMetrics) {
            aclBlockedThroughput += sourceMetrics.throughput * 0.9;
            aclErrorRate += 0.45;
          }
        }
      }
    }
    
    // Check ACL for consumers (Read operations on queues)
    for (const queue of queues) {
      if (queue.consumerCount && queue.consumerCount > 0) {
        // Simplified: check if any principal has read permission for this queue
        // In real ActiveMQ, each consumer would have its own principal
        const hasReadPermission = this.checkActiveMQACLPermission(
          acls,
          activeMQConfig.username || 'admin',
          `queue://${queue.name}`,
          'read'
        );
        
        if (!hasReadPermission) {
          // Consumers don't have Read permission - reduce consumption
          // This will be handled by routing engine (consumption rate = 0)
          aclErrorRate += 0.1; // Add error rate for denied reads
        }
      }
    }
    
    // Error rate for delivery failures
    const baseErrorRate = 0.0005;
    const depthErrorRate = Math.min(0.01, totalMessages / 1000000); // 0.01% per 100k messages
    const memoryErrorRate = memoryLimit > 0 && (storeUsage + tempUsage) > memoryLimit 
      ? 0.01 : 0; // Error when memory is full
    const connectionErrorRate = connections.length >= maxConnections ? 0.005 : 0; // Error when max connections reached
    
    // Adjust throughput based on ACL denials
    if (aclBlockedThroughput > 0) {
      metrics.throughput = Math.max(0, metrics.throughput - aclBlockedThroughput);
    }
    
    metrics.errorRate = Math.min(1, baseErrorRate + depthErrorRate + memoryErrorRate + connectionErrorRate + aclErrorRate);
    
    // Utilization based on message backlog and memory
    const messageUtilization = Math.min(1, totalMessages / 100000);
    const memoryUtilization = memoryLimit > 0 ? Math.min(1, (storeUsage + tempUsage) / memoryLimit) : 0;
    const connectionUtilization = Math.min(1, connections.length / maxConnections);
    metrics.utilization = Math.max(messageUtilization, memoryUtilization, connectionUtilization);
    
    // Get queue and topic metrics
    const allQueueMetrics = routingEngine.getAllQueueMetrics();
    const allTopicMetrics = routingEngine.getAllTopicMetrics();
    const activeConnections = routingEngine.getActiveConnections();
    
    // Calculate total consumers and subscribers
    let totalConsumers = 0;
    for (const queueMetrics of allQueueMetrics.values()) {
      totalConsumers += queueMetrics.consumerCount;
    }
    
    let totalSubscribers = 0;
    for (const topicMetrics of allTopicMetrics.values()) {
      totalSubscribers += topicMetrics.subscriberCount;
    }
    
    metrics.customMetrics = {
      'queue_depth': totalQueueDepth,
      'topic_messages': totalTopicMessages,
      'connections': activeConnections,
      'queues': allQueueMetrics.size,
      'topics': allTopicMetrics.size,
      'consumers': totalConsumers,
      'subscribers': totalSubscribers,
      'memory_usage': storeUsage + tempUsage,
      'memory_percent': memoryLimit > 0 ? ((storeUsage + tempUsage) / memoryLimit * 100) : 0,
      'protocol': protocol,
    };
    
    // Update metrics in node config (for UI display)
    this.updateActiveMQMetricsInConfig(node, allQueueMetrics, allTopicMetrics);
  }

  /**
   * Check ActiveMQ ACL permission
   * ActiveMQ ACL format: resource = "queue://*", "topic://orders", etc.
   * Operations: "read", "write", "admin", "create"
   * Permission: "allow" or "deny"
   * ActiveMQ logic: Deny takes precedence over Allow
   */
  private checkActiveMQACLPermission(
    acls: Array<{
      principal: string;
      resource: string;
      operation: string;
      permission: 'allow' | 'deny';
    }>,
    principal: string,
    resource: string, // Format: "queue://name" or "topic://name"
    operation: string // "read", "write", "admin", "create"
  ): boolean {
    if (!acls || acls.length === 0) {
      // No ACLs configured - default allow (ActiveMQ default: allow if no ACLs)
      return true;
    }
    
    // Find matching ACLs
    const matchingACLs = acls.filter((acl) => {
      // Check principal match (supports wildcard *)
      const aclPrincipal = acl.principal || '';
      if (aclPrincipal !== principal && aclPrincipal !== '*' && !principal.includes(aclPrincipal)) {
        return false;
      }
      
      // Check resource match (supports wildcard * and patterns like "queue://*", "topic://*")
      const aclResource = acl.resource || '';
      let resourceMatches = false;
      
      if (aclResource === '*' || aclResource === resource) {
        resourceMatches = true;
      } else if (aclResource.endsWith('*')) {
        // Pattern match: "queue://*" matches "queue://orders"
        const prefix = aclResource.slice(0, -1);
        resourceMatches = resource.startsWith(prefix);
      } else if (aclResource.includes('://')) {
        // Full resource match: "queue://orders" matches "queue://orders"
        resourceMatches = aclResource === resource;
      } else {
        // Simple name match: "orders" matches "queue://orders" or "topic://orders"
        resourceMatches = resource.includes(aclResource);
      }
      
      if (!resourceMatches) {
        return false;
      }
      
      // Check operation match (supports "read", "write", "admin", "create", or "all")
      const aclOperation = (acl.operation || '').toLowerCase();
      const normalizedOperation = operation.toLowerCase();
      
      if (aclOperation !== normalizedOperation && aclOperation !== 'all' && aclOperation !== '*') {
        return false;
      }
      
      return true;
    });
    
    if (matchingACLs.length === 0) {
      // No matching ACLs - default allow (if ACLs are configured but none match, allow)
      return true;
    }
    
    // ActiveMQ ACL logic: Deny takes precedence over Allow
    const denyACLs = matchingACLs.filter((acl) => acl.permission === 'deny');
    if (denyACLs.length > 0) {
      return false; // Denied
    }
    
    const allowACLs = matchingACLs.filter((acl) => acl.permission === 'allow');
    if (allowACLs.length > 0) {
      return true; // Allowed
    }
    
    // Default: allow if no explicit deny
    return true;
  }

  /**
   * Get base latency for protocol (ms)
   */
  private getProtocolBaseLatency(protocol: string): number {
    const protocolLatencies: Record<string, number> = {
      'openwire': 2,   // Native protocol, fastest
      'amqp': 5,
      'mqtt': 8,
      'stomp': 10,
      'ws': 12,        // WebSocket, slowest
    };
    return protocolLatencies[protocol] || 5; // Default to AMQP latency
  }

  /**
   * Initialize ActiveMQ routing engine for a node
   */
  private initializeActiveMQRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config as any) || {};
    const routingEngine = new ActiveMQRoutingEngine();
    
    routingEngine.initialize({
      queues: config.queues || [],
      topics: config.topics || [],
      subscriptions: config.subscriptions || [],
    });
    
    this.activeMQRoutingEngines.set(node.id, routingEngine);
    this.lastActiveMQUpdate.set(node.id, Date.now());
  }

  /**
   * Update ActiveMQ metrics in node config (for UI display)
   */
  private updateActiveMQMetricsInConfig(
    node: CanvasNode,
    queueMetrics: Map<string, { queueSize: number; consumerCount: number; enqueueCount: number; dequeueCount: number }>,
    topicMetrics: Map<string, { subscriberCount: number; enqueueCount: number; dequeueCount: number }>
  ): void {
    const config = (node.data.config as any) || {};
    const activeMQConfig = config;
    
    // Update queue metrics
    const queues = config.queues || [];
    for (let i = 0; i < queues.length; i++) {
      const queue = queues[i];
      const metrics = queueMetrics.get(queue.name);
      if (metrics) {
        queues[i] = {
          ...queue,
          queueSize: metrics.queueSize,
          consumerCount: metrics.consumerCount,
          enqueueCount: metrics.enqueueCount,
          dequeueCount: metrics.dequeueCount,
        };
      }
    }
    config.queues = queues;
    
    // Update topic metrics
    const topics = config.topics || [];
    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      const metrics = topicMetrics.get(topic.name);
      if (metrics) {
        topics[i] = {
          ...topic,
          subscriberCount: metrics.subscriberCount,
          enqueueCount: metrics.enqueueCount,
          dequeueCount: metrics.dequeueCount,
        };
      }
    }
    config.topics = topics;
    
    // Create connections dynamically from incoming canvas connections
    // In real ActiveMQ, connections are created automatically when clients connect
    const incomingConnections = this.connections.filter(c => c.target === node.id);
    const connections: Array<{
      id: string;
      remoteAddress?: string;
      clientId?: string;
      userName?: string;
      connectedSince?: string;
      messageCount?: number;
      protocol?: 'OpenWire' | 'AMQP' | 'MQTT' | 'STOMP' | 'WebSocket';
    }> = [];
    
    for (const conn of incomingConnections) {
      const sourceNode = this.nodes.find(n => n.id === conn.source);
      if (!sourceNode) continue;
      
      const sourceConfig = sourceNode.data.config as any;
      const messagingConfig = sourceConfig?.messaging || {};
      const protocol = activeMQConfig.protocol || 'openwire';
      
      // Get connection metrics to estimate message count
      const connMetrics = this.connectionMetrics.get(conn.id);
      const estimatedMessages = connMetrics ? Math.floor(connMetrics.traffic / 1024) : 0; // Rough estimate
      
      connections.push({
        id: conn.id,
        remoteAddress: `${sourceNode.label || sourceNode.id}`,
        clientId: `client-${conn.source.slice(0, 8)}`,
        userName: activeMQConfig.username || 'admin',
        connectedSince: new Date().toISOString(),
        messageCount: estimatedMessages,
        protocol: protocol === 'openwire' ? 'OpenWire' : 
                  protocol === 'amqp' ? 'AMQP' :
                  protocol === 'mqtt' ? 'MQTT' :
                  protocol === 'stomp' ? 'STOMP' :
                  protocol === 'ws' ? 'WebSocket' : 'OpenWire',
      });
    }
    
    config.connections = connections;
    
    // Create subscriptions dynamically based on topics and incoming connections
    // In real ActiveMQ, subscriptions are created when clients subscribe to topics
    const subscriptions: Array<{
      id: string;
      destination: string;
      clientId: string;
      selector?: string;
      pendingQueueSize?: number;
      dispatchedQueueSize?: number;
      dispatchedCounter?: number;
      enqueueCounter?: number;
      dequeueCounter?: number;
    }> = [];
    
    // For each topic, create subscriptions for connected consumers
    for (const topic of topics) {
      // Find connections that might be subscribing to this topic
      // (simplified: assume all incoming connections can subscribe to topics)
      for (const conn of incomingConnections) {
        const sourceNode = this.nodes.find(n => n.id === conn.source);
        if (!sourceNode) continue;
        
        const sourceConfig = sourceNode.data.config as any;
        const messagingConfig = sourceConfig?.messaging || {};
        
        // Check if this connection is for a topic (not a queue)
        if (messagingConfig.topic === topic.name || !messagingConfig.queue) {
          const topicMetricsData = topicMetrics.get(topic.name);
          subscriptions.push({
            id: `sub-${conn.id}-${topic.name}`,
            destination: topic.name,
            clientId: `client-${conn.source.slice(0, 8)}`,
            pendingQueueSize: 0, // Will be updated by routing engine
            dispatchedQueueSize: 0,
            dispatchedCounter: topicMetricsData?.enqueueCount || 0,
            enqueueCounter: topicMetricsData?.enqueueCount || 0,
            dequeueCounter: topicMetricsData?.dequeueCount || 0,
          });
        }
      }
    }
    
    config.subscriptions = subscriptions;
  }

  /**
   * Database emulation (PostgreSQL, MongoDB, Redis)
   */
  private simulateDatabase(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    if (!hasIncomingConnections) {
      // No incoming queries, reset metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0;
      metrics.customMetrics = {};
      return;
    }
    
    const maxConnections = config.maxConnections || 100;
    const queryLatency = config.queryLatency || 10; // ms
    
    // Для MongoDB считаем реальное количество индексов из коллекций
    let indexCount = config.indexCount || 5;
    if (node.type === 'mongodb') {
      const mongoConfig = node.data.config as any;
      const collections = mongoConfig?.collections || [];
      // Считаем общее количество индексов во всех коллекциях
      indexCount = collections.reduce((total: number, collection: any) => {
        return total + (collection.indexes?.length || 0);
      }, 0);
      // Если индексов нет, используем дефолтное значение
      if (indexCount === 0) {
        indexCount = 1; // Минимум один индекс _id_ для каждой коллекции
      }
    }
    
    // Throughput (queries/sec) - based on incoming connections
    const incomingConnections = this.connections.filter(conn => conn.target === node.id);
    const totalIncomingThroughput = incomingConnections.reduce((sum, conn) => {
      const sourceMetrics = this.metrics.get(conn.source);
      return sum + (sourceMetrics?.throughput || 0);
    }, 0);
    
    // Active connections based on incoming throughput
    const activeConnections = Math.min(maxConnections, Math.floor(totalIncomingThroughput / 10) || Math.floor(maxConnections * 0.3));
    metrics.throughput = activeConnections * (1000 / (queryLatency + Math.random() * 20));
    
    // Latency increases with active connections, but decreases with more indexes (better query performance)
    // Больше индексов = лучше производительность запросов = меньше латентность
    const indexPerformanceBoost = Math.min(0.3, indexCount * 0.02); // До 30% улучшения
    metrics.latency = queryLatency + (activeConnections / maxConnections) * 50 * (1 - indexPerformanceBoost);
    
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
    
    // Для MongoDB добавляем дополнительную информацию о коллекциях
    if (node.type === 'mongodb') {
      const mongoConfig = node.data.config as any;
      const collections = mongoConfig?.collections || [];
      
      // Подсчитываем коллекции с валидацией
      const collectionsWithValidation = collections.filter((c: any) => 
        c.validation && c.validation.validationLevel !== 'off'
      ).length;
      
      // Если есть валидация, увеличиваем базовый errorRate (валидация может отклонять документы)
      if (collectionsWithValidation > 0) {
        // Базовая вероятность ошибки валидации (1-5% в зависимости от количества правил)
        const validationErrorRate = Math.min(0.05, collectionsWithValidation * 0.01);
        metrics.errorRate = Math.max(metrics.errorRate, validationErrorRate);
      }
      
      // Replication влияние на метрики
      const enableReplicaSet = mongoConfig?.enableReplicaSet || false;
      const replicaSetMembers = mongoConfig?.replicaSetMembers || [];
      if (enableReplicaSet && replicaSetMembers.length > 1) {
        // Replication улучшает availability (снижает errorRate при сбоях)
        // Больше реплик = лучше доступность
        const replicaCount = replicaSetMembers.length;
        const availabilityBoost = Math.min(0.3, (replicaCount - 1) * 0.1); // До 30% улучшения
        metrics.errorRate = Math.max(0, metrics.errorRate * (1 - availabilityBoost));
        
        // Небольшое увеличение latency из-за репликации
        metrics.latency = metrics.latency * (1 + 0.05 * (replicaCount - 1));
      }
      
      // Sharding влияние на метрики
      const enableSharding = mongoConfig?.enableSharding || false;
      const shardConfig = mongoConfig?.shardConfig;
      if (enableSharding && shardConfig?.shards) {
        const shardCount = shardConfig.shards.length;
        // Sharding улучшает throughput (распределение нагрузки)
        const throughputBoost = 1 + (shardCount - 1) * 0.3; // До 90% улучшения для 4 шардов
        metrics.throughput = metrics.throughput * throughputBoost;
        
        // Небольшое увеличение latency из-за распределения запросов
        metrics.latency = metrics.latency * (1 + 0.02 * (shardCount - 1));
      }
      
      metrics.customMetrics = {
        ...metrics.customMetrics,
        'collections': collections.length,
        'collections_with_validation': collectionsWithValidation,
        'total_documents': collections.reduce((total: number, collection: any) => {
          return total + (collection.documentCount || 0);
        }, 0),
        'replica_set_enabled': enableReplicaSet,
        'replica_members': enableReplicaSet ? replicaSetMembers.length : 0,
        'sharding_enabled': enableSharding,
        'shard_count': enableSharding ? (shardConfig?.shards?.length || 0) : 0,
      };
    }
  }

  /**
   * NGINX load balancer emulation
   */
  private simulateNginx(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    if (!hasIncomingConnections) {
      // No incoming requests, reset metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0;
      return;
    }
    
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
  private simulateInfrastructure(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    if (!hasIncomingConnections) {
      // No incoming requests, reset metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0;
      return;
    }
    
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
  private simulateAPI(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    if (!hasIncomingConnections) {
      // No incoming requests, reset metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0;
      return;
    }
    
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
   * Create default metrics for a connection
   */
  private createDefaultConnectionMetrics(connection: CanvasConnection): ConnectionMetrics {
    return {
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
   * Get RabbitMQ routing engine for a node
   */
  public getRabbitMQRoutingEngine(nodeId: string): RabbitMQRoutingEngine | undefined {
    return this.rabbitMQRoutingEngines.get(nodeId);
  }

  /**
   * Get ActiveMQ routing engine for a node
   */
  public getActiveMQRoutingEngine(nodeId: string): ActiveMQRoutingEngine | undefined {
    return this.activeMQRoutingEngines.get(nodeId);
  }

  /**
   * Check ActiveMQ ACL permission (public method for DataFlowEngine)
   */
  public checkActiveMQACLPermissionPublic(
    acls: Array<{
      principal: string;
      resource: string;
      operation: string;
      permission: 'allow' | 'deny';
    }>,
    principal: string,
    resource: string,
    operation: string
  ): boolean {
    return this.checkActiveMQACLPermission(acls, principal, resource, operation);
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

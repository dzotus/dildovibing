import { CanvasNode, CanvasConnection } from '@/types';
import { dataFlowEngine } from './DataFlowEngine';
import { componentStateEngine } from './ComponentStateEngine';
import { RabbitMQRoutingEngine } from './RabbitMQRoutingEngine';
import { ActiveMQRoutingEngine } from './ActiveMQRoutingEngine';
import { SQSRoutingEngine } from './SQSRoutingEngine';
import { AzureServiceBusRoutingEngine } from './AzureServiceBusRoutingEngine';
import { PubSubRoutingEngine } from './PubSubRoutingEngine';
import { KongRoutingEngine } from './KongRoutingEngine';
import { ApigeeRoutingEngine } from './ApigeeRoutingEngine';
import { MuleSoftRoutingEngine } from './MuleSoftRoutingEngine';
import { GraphQLGatewayRoutingEngine } from './GraphQLGatewayRoutingEngine';
import { BFFRoutingEngine } from './BFFRoutingEngine';
import { WebhookRelayRoutingEngine } from './WebhookRelayRoutingEngine';
import { RedisRoutingEngine } from './RedisRoutingEngine';
import { CassandraRoutingEngine } from './CassandraRoutingEngine';
import { ClickHouseRoutingEngine } from './ClickHouseRoutingEngine';
import { SnowflakeRoutingEngine } from './SnowflakeRoutingEngine';
import { ElasticsearchRoutingEngine } from './ElasticsearchRoutingEngine';
import { S3RoutingEngine } from './S3RoutingEngine';
import { PostgreSQLConnectionPool, ConnectionPoolConfig } from './postgresql/ConnectionPool';
import { PrometheusEmulationEngine } from './PrometheusEmulationEngine';
import { GrafanaEmulationEngine } from './GrafanaEmulationEngine';

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
  
  // SQS routing engines per node
  private sqsRoutingEngines: Map<string, SQSRoutingEngine> = new Map();
  private lastSQSUpdate: Map<string, number> = new Map();
  
  // Azure Service Bus routing engines per node
  private azureServiceBusRoutingEngines: Map<string, AzureServiceBusRoutingEngine> = new Map();
  private lastAzureServiceBusUpdate: Map<string, number> = new Map();
  
  // Pub/Sub routing engines per node
  private pubSubRoutingEngines: Map<string, PubSubRoutingEngine> = new Map();
  private lastPubSubUpdate: Map<string, number> = new Map();
  
  // Kong Gateway routing engines per node
  private kongRoutingEngines: Map<string, KongRoutingEngine> = new Map();
  
  // Apigee Gateway routing engines per node
  private apigeeRoutingEngines: Map<string, ApigeeRoutingEngine> = new Map();
  
  // MuleSoft routing engines per node
  private mulesoftRoutingEngines: Map<string, MuleSoftRoutingEngine> = new Map();

  // GraphQL Gateway routing engines per node
  private graphQLGatewayRoutingEngines: Map<string, GraphQLGatewayRoutingEngine> = new Map();
  private lastGraphQLGatewayUpdate: Map<string, number> = new Map();

  // BFF Service routing engines per node
  private bffRoutingEngines: Map<string, BFFRoutingEngine> = new Map();

  // Webhook Relay routing engines per node
  private webhookRelayRoutingEngines: Map<string, WebhookRelayRoutingEngine> = new Map();
  
  // Redis routing engines per node
  private redisRoutingEngines: Map<string, RedisRoutingEngine> = new Map();
  
  // Cassandra routing engines per node
  private cassandraRoutingEngines: Map<string, CassandraRoutingEngine> = new Map();
  
  // ClickHouse routing engines per node
  private clickHouseRoutingEngines: Map<string, ClickHouseRoutingEngine> = new Map();
  
  // Snowflake routing engines per node
  private snowflakeRoutingEngines: Map<string, SnowflakeRoutingEngine> = new Map();
  
  // Elasticsearch routing engines per node
  private elasticsearchRoutingEngines: Map<string, ElasticsearchRoutingEngine> = new Map();
  
  // S3 routing engines per node
  private s3RoutingEngines: Map<string, S3RoutingEngine> = new Map();
  
  // PostgreSQL connection pools per node
  private postgresConnectionPools: Map<string, PostgreSQLConnectionPool> = new Map();
  
  // Prometheus emulation engines per node
  private prometheusEngines: Map<string, PrometheusEmulationEngine> = new Map();
  
  // Grafana emulation engines per node
  private grafanaEngines: Map<string, GrafanaEmulationEngine> = new Map();

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
    
      // Initialize routing engines for messaging components
      for (const node of nodes) {
        if (node.type === 'rabbitmq') {
          this.initializeRabbitMQRoutingEngine(node);
        }
        if (node.type === 'activemq') {
          this.initializeActiveMQRoutingEngine(node);
        }
        if (node.type === 'aws-sqs') {
          this.initializeSQSRoutingEngine(node);
        }
        if (node.type === 'azure-service-bus') {
          this.initializeAzureServiceBusRoutingEngine(node);
        }
        if (node.type === 'gcp-pubsub') {
          this.initializePubSubRoutingEngine(node);
        }
        if (node.type === 'kong') {
          this.initializeKongRoutingEngine(node);
        }
        if (node.type === 'apigee') {
          this.initializeApigeeRoutingEngine(node);
        }
        if (node.type === 'mulesoft') {
          this.initializeMuleSoftRoutingEngine(node);
        }
        if (node.type === 'graphql-gateway') {
          this.initializeGraphQLGatewayRoutingEngine(node);
        }
        if (node.type === 'bff-service') {
          this.initializeBFFRoutingEngine(node);
        }
        if (node.type === 'webhook-relay') {
          this.initializeWebhookRelayRoutingEngine(node);
        }
        if (node.type === 'postgres') {
          this.initializePostgreSQLConnectionPool(node);
        }
        if (node.type === 'redis') {
          this.initializeRedisRoutingEngine(node);
        }
        if (node.type === 'cassandra') {
          this.initializeCassandraRoutingEngine(node);
        }
        if (node.type === 'clickhouse') {
          this.initializeClickHouseRoutingEngine(node);
        }
        if (node.type === 'snowflake') {
          this.initializeSnowflakeRoutingEngine(node);
        }
        if (node.type === 'elasticsearch') {
          this.initializeElasticsearchRoutingEngine(node);
        }
        if (node.type === 's3-datalake') {
          this.initializeS3RoutingEngine(node);
        }
        if (node.type === 'prometheus') {
          this.initializePrometheusEngine(node);
        }
        if (node.type === 'grafana') {
          this.initializeGrafanaEngine(node);
        }
      }
      
      // Update existing PostgreSQL pools if config changed
      for (const node of nodes) {
        if (node.type === 'postgres') {
          const existingPool = this.postgresConnectionPools.get(node.id);
          if (existingPool) {
            const config = node.data.config as any;
            existingPool.updateConfig({
              maxConnections: config.maxConnections || 100,
              minConnections: config.minConnections || 0,
              idleTimeout: config.idleTimeout || 300000,
              maxLifetime: config.maxLifetime || 3600000,
              connectionTimeout: config.connectionTimeout || 5000,
            });
          }
        }
      }
    
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
      
      // Initialize or reinitialize SQS routing engine for SQS nodes
      // Always reinitialize to pick up config changes
      if (node.type === 'aws-sqs') {
        this.initializeSQSRoutingEngine(node);
      }
      
      // Initialize Azure Service Bus routing engine for Azure Service Bus nodes
      if (node.type === 'azure-service-bus') {
        this.initializeAzureServiceBusRoutingEngine(node);
      }
      
      // Initialize Pub/Sub routing engine for Pub/Sub nodes
      if (node.type === 'gcp-pubsub') {
        this.initializePubSubRoutingEngine(node);
      }
      
      // Initialize Kong routing engine for Kong Gateway nodes
      if (node.type === 'kong') {
        this.initializeKongRoutingEngine(node);
      }
      
      // Initialize Apigee routing engine for Apigee Gateway nodes
      if (node.type === 'apigee') {
        this.initializeApigeeRoutingEngine(node);
      }
      
      // Initialize MuleSoft routing engine for MuleSoft nodes
      if (node.type === 'mulesoft') {
        this.initializeMuleSoftRoutingEngine(node);
      }

      // Initialize GraphQL Gateway routing engine for GraphQL Gateway nodes
      if (node.type === 'graphql-gateway') {
        this.initializeGraphQLGatewayRoutingEngine(node);
      }

      // Initialize BFF routing engine for BFF Service nodes
      if (node.type === 'bff-service') {
        this.initializeBFFRoutingEngine(node);
      }

      // Initialize Webhook Relay routing engine for Webhook Relay nodes
      if (node.type === 'webhook-relay') {
        this.initializeWebhookRelayRoutingEngine(node);
      }
      
      // Initialize ClickHouse routing engine for ClickHouse nodes
      if (node.type === 'clickhouse') {
        this.initializeClickHouseRoutingEngine(node);
      }
      
      // Initialize Snowflake routing engine for Snowflake nodes
      if (node.type === 'snowflake') {
        this.initializeSnowflakeRoutingEngine(node);
      }
    }
    
    // Remove metrics for deleted nodes
    const nodeIds = new Set(nodes.map(n => n.id));
    for (const [nodeId] of this.metrics.entries()) {
      if (!nodeIds.has(nodeId)) {
        this.metrics.delete(nodeId);
        this.rabbitMQRoutingEngines.delete(nodeId);
        this.activeMQRoutingEngines.delete(nodeId);
        this.sqsRoutingEngines.delete(nodeId);
        this.azureServiceBusRoutingEngines.delete(nodeId);
        this.pubSubRoutingEngines.delete(nodeId);
        this.kongRoutingEngines.delete(nodeId);
        this.apigeeRoutingEngines.delete(nodeId);
        this.mulesoftRoutingEngines.delete(nodeId);
        this.graphQLGatewayRoutingEngines.delete(nodeId);
        this.bffRoutingEngines.delete(nodeId);
        this.webhookRelayRoutingEngines.delete(nodeId);
        this.redisRoutingEngines.delete(nodeId);
        this.cassandraRoutingEngines.delete(nodeId);
        this.clickHouseRoutingEngines.delete(nodeId);
        this.snowflakeRoutingEngines.delete(nodeId);
        this.elasticsearchRoutingEngines.delete(nodeId);
        this.s3RoutingEngines.delete(nodeId);
        this.graphQLGatewayRoutingEngines.delete(nodeId);
        this.lastRabbitMQUpdate.delete(nodeId);
        this.lastActiveMQUpdate.delete(nodeId);
        this.lastSQSUpdate.delete(nodeId);
        this.lastAzureServiceBusUpdate.delete(nodeId);
        this.lastPubSubUpdate.delete(nodeId);
        this.lastGraphQLGatewayUpdate.delete(nodeId);
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
    
    // Process SQS consumption (before updating metrics)
    for (const [nodeId, routingEngine] of this.sqsRoutingEngines.entries()) {
      const lastUpdate = this.lastSQSUpdate.get(nodeId) || now;
      const deltaTime = now - lastUpdate;
      if (deltaTime > 0) {
        routingEngine.processConsumption(deltaTime);
        this.lastSQSUpdate.set(nodeId, now);
      }
    }
    
    // Process Azure Service Bus consumption (before updating metrics)
    for (const [nodeId, routingEngine] of this.azureServiceBusRoutingEngines.entries()) {
      const lastUpdate = this.lastAzureServiceBusUpdate.get(nodeId) || now;
      const deltaTime = now - lastUpdate;
      if (deltaTime > 0) {
        routingEngine.processConsumption(deltaTime);
        this.lastAzureServiceBusUpdate.set(nodeId, now);
      }
    }
    
    // Process Pub/Sub consumption (before updating metrics)
    for (const [nodeId, routingEngine] of this.pubSubRoutingEngines.entries()) {
      const lastUpdate = this.lastPubSubUpdate.get(nodeId) || now;
      const deltaTime = now - lastUpdate;
      if (deltaTime > 0) {
        routingEngine.processConsumption(deltaTime);
        this.lastPubSubUpdate.set(nodeId, now);
      }
    }
    
    // Update component metrics based on their configuration
    for (const node of this.nodes) {
      this.updateComponentMetrics(node);
    }
    
    // Perform Prometheus scraping (after metrics are updated)
    for (const [nodeId, prometheusEngine] of this.prometheusEngines.entries()) {
      prometheusEngine.performScraping(now, this.nodes, this.metrics);
    }
    
    // Perform Grafana updates (queries, dashboard refreshes, alert evaluations)
    for (const [nodeId, grafanaEngine] of this.grafanaEngines.entries()) {
      // Проверяем доступность Prometheus для этого Grafana
      const grafanaNode = this.nodes.find(n => n.id === nodeId);
      if (grafanaNode) {
        const prometheusAvailable = this.isPrometheusAvailableForGrafana(grafanaNode);
        grafanaEngine.performUpdate(now, prometheusAvailable);
      }
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
        case 'aws-sqs':
          this.simulateSQS(node, config, metrics, hasIncomingConnections);
          break;
        case 'azure-service-bus':
          this.simulateAzureServiceBus(node, config, metrics, hasIncomingConnections);
          break;
        case 'gcp-pubsub':
          this.simulatePubSub(node, config, metrics, hasIncomingConnections);
          break;
        case 'postgres':
        case 'mongodb':
        case 'redis':
        case 'cassandra':
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
        case 'kong':
          this.simulateKong(node, config, metrics, hasIncomingConnections);
          break;
        
        case 'apigee':
          this.simulateApigee(node, config, metrics, hasIncomingConnections);
          break;
        case 'mulesoft':
          this.simulateMuleSoft(node, config, metrics, hasIncomingConnections);
          break;
        case 'bff-service':
          this.simulateBFF(node, config, metrics, hasIncomingConnections);
          break;
        case 'prometheus':
          this.simulatePrometheus(node, config, metrics, hasIncomingConnections);
          break;
        case 'grafana':
          this.simulateGrafana(node, config, metrics, hasIncomingConnections);
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
      const producerConfig = (sourceNode.data.config || {}) as any;
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
    const queues = activeMQConfig.queues || [];
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
        remoteAddress: `${sourceNode.data.label || sourceNode.id}`,
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
   * Azure Service Bus emulation
   */
  private simulateAzureServiceBus(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    // Initialize routing engine if not exists
    if (!this.azureServiceBusRoutingEngines.has(node.id)) {
      this.initializeAzureServiceBusRoutingEngine(node);
    }
    
    const routingEngine = this.azureServiceBusRoutingEngines.get(node.id)!;
    const serviceBusConfig = (node.data.config as any) || {};
    
    if (!hasIncomingConnections) {
      // No incoming data, reset metrics but keep queue/topic state
      metrics.throughput = 0;
      metrics.latency = 5; // Base latency for Azure Service Bus (cloud service)
      metrics.errorRate = 0;
      
      // Calculate utilization from existing queue/topic depth
      const totalQueueDepth = routingEngine.getTotalQueueDepth();
      const totalSubscriptionMessages = routingEngine.getTotalSubscriptionMessages();
      const totalMessages = totalQueueDepth + totalSubscriptionMessages;
      metrics.utilization = Math.min(1, totalMessages / 100000);
      
      const allQueueMetrics = routingEngine.getAllQueueMetrics();
      const allSubscriptionMetrics = routingEngine.getAllSubscriptionMetrics();
      const connections = routingEngine.getActiveConnections();
      
      metrics.customMetrics = {
        'queue_depth': totalQueueDepth,
        'subscription_messages': totalSubscriptionMessages,
        'connections': connections,
        'queues': serviceBusConfig.queues?.length || 0,
        'topics': serviceBusConfig.topics?.length || 0,
      };
      
      // Update queue and subscription metrics in config
      this.updateAzureServiceBusMetricsInConfig(node, allQueueMetrics, allSubscriptionMetrics);
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
    
    // Latency based on queue depth and Azure Service Bus characteristics
    const totalQueueDepth = routingEngine.getTotalQueueDepth();
    const totalSubscriptionMessages = routingEngine.getTotalSubscriptionMessages();
    const totalMessages = totalQueueDepth + totalSubscriptionMessages;
    
    const baseLatency = 5; // Base Azure Service Bus latency (cloud service)
    const queueLatency = Math.min(50, totalMessages / 1000); // 1ms per 1000 messages, max 50ms
    const lockLatency = 2; // Peek-lock overhead
    metrics.latency = baseLatency + queueLatency + lockLatency + Math.random() * 5;
    
    // Get queue and subscription metrics
    const allQueueMetrics = routingEngine.getAllQueueMetrics();
    const allSubscriptionMetrics = routingEngine.getAllSubscriptionMetrics();
    const connections = routingEngine.getActiveConnections();
    
    // Error rate for delivery failures (increases with queue depth and delivery count)
    const baseErrorRate = 0.0005;
    const depthErrorRate = Math.min(0.01, totalMessages / 1000000); // 0.01% per 100k messages
    
    // Check for dead letter messages (failed deliveries)
    let totalDeadLetterMessages = 0;
    for (const queueMetrics of allQueueMetrics.values()) {
      totalDeadLetterMessages += queueMetrics.deadLetterMessageCount || 0;
    }
    for (const subMetrics of allSubscriptionMetrics.values()) {
      totalDeadLetterMessages += subMetrics.deadLetterMessageCount || 0;
    }
    const dlqErrorRate = totalDeadLetterMessages > 0 ? Math.min(0.05, totalDeadLetterMessages / 10000) : 0;
    
    metrics.errorRate = Math.min(1, baseErrorRate + depthErrorRate + dlqErrorRate);
    
    // Utilization based on message queue backlog
    metrics.utilization = Math.min(1, totalMessages / 100000);
    
    // Calculate total subscriptions
    let totalSubscriptions = 0;
    const topics = serviceBusConfig.topics || [];
    for (const topic of topics) {
      totalSubscriptions += (topic.subscriptions || []).length;
    }
    
    metrics.customMetrics = {
      'queue_depth': totalQueueDepth,
      'subscription_messages': totalSubscriptionMessages,
      'dead_letter_messages': totalDeadLetterMessages,
      'connections': connections,
      'queues': serviceBusConfig.queues?.length || 0,
      'topics': serviceBusConfig.topics?.length || 0,
      'subscriptions': totalSubscriptions,
    };
    
    // Update queue and subscription metrics in node config (for UI display)
    this.updateAzureServiceBusMetricsInConfig(node, allQueueMetrics, allSubscriptionMetrics);
  }
  
  /**
   * Initialize Azure Service Bus routing engine for a node
   */
  private initializeAzureServiceBusRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config as any) || {};
    const routingEngine = new AzureServiceBusRoutingEngine();
    
    // Convert UI queue format to routing engine format
    const queues = (config.queues || []).map((q: any) => ({
      name: q.name,
      namespace: q.namespace || config.namespace || 'archiphoenix.servicebus.windows.net',
      maxSizeInMegabytes: q.maxSizeInMegabytes || 1024,
      defaultMessageTimeToLive: q.defaultMessageTimeToLive || 2592000,
      lockDuration: q.lockDuration || 30,
      maxDeliveryCount: q.maxDeliveryCount || 10,
      enablePartitioning: q.enablePartitioning || false,
      enableDeadLetteringOnMessageExpiration: q.enableDeadLetteringOnMessageExpiration !== undefined 
        ? q.enableDeadLetteringOnMessageExpiration 
        : true,
      enableSessions: q.enableSessions || false,
      activeMessageCount: q.activeMessageCount || 0,
      deadLetterMessageCount: q.deadLetterMessageCount || 0,
      scheduledMessageCount: q.scheduledMessageCount || 0,
    }));
    
    // Convert UI topic format to routing engine format
    const topics = (config.topics || []).map((t: any) => ({
      name: t.name,
      namespace: t.namespace || config.namespace || 'archiphoenix.servicebus.windows.net',
      maxSizeInMegabytes: t.maxSizeInMegabytes || 1024,
      defaultMessageTimeToLive: t.defaultMessageTimeToLive || 2592000,
      enablePartitioning: t.enablePartitioning || false,
      subscriptions: (t.subscriptions || []).map((sub: any) => ({
        name: sub.name,
        maxDeliveryCount: sub.maxDeliveryCount || 10,
        lockDuration: sub.lockDuration || 30,
        enableDeadLetteringOnMessageExpiration: sub.enableDeadLetteringOnMessageExpiration !== undefined
          ? sub.enableDeadLetteringOnMessageExpiration
          : true,
        activeMessageCount: sub.activeMessageCount || 0,
      })),
    }));
    
    routingEngine.initialize({
      queues: queues,
      topics: topics,
    });
    
    this.azureServiceBusRoutingEngines.set(node.id, routingEngine);
    this.lastAzureServiceBusUpdate.set(node.id, Date.now());
  }

  /**
   * Update Azure Service Bus metrics in node config (for UI display)
   */
  private updateAzureServiceBusMetricsInConfig(
    node: CanvasNode,
    queueMetrics: Map<string, {
      activeMessageCount: number;
      deadLetterMessageCount: number;
      scheduledMessageCount: number;
      sentCount: number;
      receivedCount: number;
      completedCount: number;
      abandonedCount: number;
    }>,
    subscriptionMetrics: Map<string, {
      activeMessageCount: number;
      deadLetterMessageCount: number;
      sentCount: number;
      receivedCount: number;
      completedCount: number;
      abandonedCount: number;
    }>
  ): void {
    const config = (node.data.config as any) || {};
    
    // Update queue metrics
    const queues = config.queues || [];
    for (let i = 0; i < queues.length; i++) {
      const queue = queues[i];
      const metrics = queueMetrics.get(queue.name);
      if (metrics) {
        queues[i] = {
          ...queue,
          activeMessageCount: metrics.activeMessageCount,
          deadLetterMessageCount: metrics.deadLetterMessageCount,
          scheduledMessageCount: metrics.scheduledMessageCount,
        };
      }
    }
    config.queues = queues;
    
    // Update topic subscription metrics
    const topics = config.topics || [];
    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      const subscriptions = topic.subscriptions || [];
      for (let j = 0; j < subscriptions.length; j++) {
        const subscription = subscriptions[j];
        const subscriptionId = `${topic.name}/subscriptions/${subscription.name}`;
        const metrics = subscriptionMetrics.get(subscriptionId);
        if (metrics) {
          subscriptions[j] = {
            ...subscription,
            activeMessageCount: metrics.activeMessageCount,
          };
        }
      }
      topics[i] = {
        ...topic,
        subscriptions: subscriptions,
      };
    }
    config.topics = topics;
  }

  /**
   * Google Pub/Sub broker emulation
   * 
   * Key differences from Kafka/RabbitMQ:
   * - Managed service: automatic scaling, no partitions/replication to configure
   * - No partition overhead: simpler model (topics → subscriptions)
   * - Push/Pull subscriptions: unique delivery model
   * - Ack deadlines: messages auto-returned after deadline expires
   * - Lower latency: managed infrastructure, optimized for cloud
   * - Automatic scaling: utilization less sensitive to message backlog
   * - Message ordering keys: simpler than Kafka partitions (per-key ordering)
   */
  private simulatePubSub(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    // Initialize routing engine if not exists
    if (!this.pubSubRoutingEngines.has(node.id)) {
      this.initializePubSubRoutingEngine(node);
    }
    
    const routingEngine = this.pubSubRoutingEngines.get(node.id)!;
    const pubSubConfig = (node.data.config as any) || {};
    const topics = pubSubConfig.topics || [];
    const subscriptions = pubSubConfig.subscriptions || [];
    
    if (!hasIncomingConnections) {
      // No incoming data, reset metrics but keep topic/subscription state
      metrics.throughput = 0;
      metrics.latency = 3; // Base latency for Google Pub/Sub (cloud service)
      metrics.errorRate = 0;
      
      // Calculate utilization from existing message depth
      const totalTopicMessages = routingEngine.getTotalTopicMessages();
      const totalUnackedMessages = routingEngine.getTotalUnackedMessages();
      const totalMessages = totalTopicMessages + totalUnackedMessages;
      metrics.utilization = Math.min(1, totalMessages / 100000);
      
      const allTopicMetrics = routingEngine.getAllTopicMetrics();
      const allSubscriptionMetrics = routingEngine.getAllSubscriptionMetrics();
      const connections = routingEngine.getActiveConnections();
      
      metrics.customMetrics = {
        'topic_messages': totalTopicMessages,
        'unacked_messages': totalUnackedMessages,
        'connections': connections,
        'topics': topics.length,
        'subscriptions': subscriptions.length,
      };
      
      // Update metrics in config
      this.updatePubSubMetricsInConfig(node, allTopicMetrics, allSubscriptionMetrics);
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
    
    // Latency based on Pub/Sub characteristics (managed service - no partitions/replication overhead)
    const totalTopicMessages = routingEngine.getTotalTopicMessages();
    const totalUnackedMessages = routingEngine.getTotalUnackedMessages();
    const totalMessages = totalTopicMessages + totalUnackedMessages;
    
    // Google Pub/Sub is a fully managed service - very low and stable latency
    // No partition/replication overhead like Kafka
    // Automatic scaling reduces queue depth impact
    const baseLatency = 3; // Base Google Pub/Sub latency (cloud managed service)
    
    // Message depth has less impact due to automatic scaling (Pub/Sub scales automatically)
    // Much less sensitive than self-managed brokers (Kafka/RabbitMQ)
    const messageLatency = Math.min(15, totalMessages / 10000); // 1ms per 10k messages, max 15ms (less than Kafka)
    
    // Push subscriptions have higher latency (HTTP POST overhead)
    const pushSubscriptions = subscriptions.filter((sub: any) => sub.pushEndpoint).length;
    const pushLatencyOverhead = pushSubscriptions > 0 ? 2 : 0; // ~2ms overhead for push delivery
    
    // Ack tracking overhead (minimal for managed service)
    const ackLatency = totalUnackedMessages > 0 ? 0.5 : 0;
    
    // Managed service has very stable latency (less jitter)
    metrics.latency = baseLatency + messageLatency + pushLatencyOverhead + ackLatency + Math.random() * 2;
    
    // Get topic and subscription metrics
    const allTopicMetrics = routingEngine.getAllTopicMetrics();
    const allSubscriptionMetrics = routingEngine.getAllSubscriptionMetrics();
    const connections = routingEngine.getActiveConnections();
    
    // Error rate for delivery failures (Pub/Sub has very low error rate as managed service)
    const baseErrorRate = 0.0001; // Very low base error rate for managed service (better than self-managed)
    
    // Message depth has minimal impact due to automatic scaling
    // Pub/Sub scales automatically, so errors don't increase much with load
    const depthErrorRate = Math.min(0.001, totalMessages / 5000000); // Much lower than Kafka/RabbitMQ
    
    // Push subscription failures (HTTP endpoint errors)
    const pushFailureRate = pushSubscriptions > 0 && totalUnackedMessages > 0
      ? Math.min(0.002, totalUnackedMessages / 100000) // Push endpoints can fail
      : 0;
    
    // Check for expired ack deadlines (unacked messages that exceeded deadline)
    // This is specific to Pub/Sub model (not present in Kafka)
    const avgAckDeadlineSeconds = subscriptions.length > 0
      ? subscriptions.reduce((sum: number, sub: any) => sum + (sub.ackDeadlineSeconds || 10), 0) / subscriptions.length
      : 10;
    const expiredAckRate = totalUnackedMessages > 0 && avgAckDeadlineSeconds < 60 
      ? Math.min(0.005, totalUnackedMessages / 100000) // Expired acks increase error rate
      : 0;
    
    metrics.errorRate = Math.min(1, baseErrorRate + depthErrorRate + pushFailureRate + expiredAckRate);
    
    // Utilization: Pub/Sub auto-scales, so utilization is more stable
    // Less sensitive to message backlog than self-managed brokers
    // Utilization reflects actual service usage, not queue depth
    const throughputUtilization = Math.min(1, metrics.throughput / 100000); // Throughput-based (Pub/Sub scales)
    const backlogUtilization = Math.min(0.3, totalMessages / 500000); // Backlog has less impact (capped at 30%)
    metrics.utilization = Math.min(1, throughputUtilization * 0.7 + backlogUtilization * 0.3);
    
    // Calculate pull subscriptions (pushSubscriptions already calculated above for latency)
    const pullSubscriptions = subscriptions.length - pushSubscriptions;
    
    metrics.customMetrics = {
      'topic_messages': totalTopicMessages,
      'unacked_messages': totalUnackedMessages,
      'connections': connections,
      'topics': topics.length,
      'subscriptions': subscriptions.length,
      'push_subscriptions': pushSubscriptions,
      'pull_subscriptions': pullSubscriptions,
      'total_bytes': Array.from(allTopicMetrics.values()).reduce((sum, m) => sum + m.byteCount, 0),
    };
    
    // Update metrics in node config (for UI display)
    this.updatePubSubMetricsInConfig(node, allTopicMetrics, allSubscriptionMetrics);
  }
  
  /**
   * Initialize Pub/Sub routing engine for a node
   */
  private initializePubSubRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config as any) || {};
    const routingEngine = new PubSubRoutingEngine();
    
    // Convert UI format to routing engine format
    const topics = (config.topics || []).map((t: any) => ({
      name: t.name,
      projectId: t.projectId || config.projectId || 'archiphoenix-lab',
      messageRetentionDuration: t.messageRetentionDuration || 604800, // Default 7 days
      labels: t.labels || {},
      messageCount: t.messageCount || 0,
      byteCount: t.byteCount || 0,
    }));
    
    const subscriptions = (config.subscriptions || []).map((sub: any) => ({
      name: sub.name,
      topic: sub.topic,
      projectId: sub.projectId || config.projectId || 'archiphoenix-lab',
      ackDeadlineSeconds: sub.ackDeadlineSeconds || 10,
      messageRetentionDuration: sub.messageRetentionDuration,
      enableMessageOrdering: sub.enableMessageOrdering || false,
      pushEndpoint: sub.pushEndpoint,
      pushAttributes: sub.pushAttributes || {},
      messageCount: sub.messageCount || 0,
      unackedMessageCount: sub.unackedMessageCount || 0,
    }));
    
    routingEngine.initialize({
      topics: topics,
      subscriptions: subscriptions,
    });
    
    this.pubSubRoutingEngines.set(node.id, routingEngine);
    this.lastPubSubUpdate.set(node.id, Date.now());
  }

  /**
   * Update Pub/Sub metrics in node config (for UI display)
   */
  private updatePubSubMetricsInConfig(
    node: CanvasNode,
    topicMetrics: Map<string, {
      messageCount: number;
      byteCount: number;
      publishedCount: number;
    }>,
    subscriptionMetrics: Map<string, {
      messageCount: number;
      unackedMessageCount: number;
      deliveredCount: number;
      acknowledgedCount: number;
      nackedCount: number;
    }>
  ): void {
    const config = (node.data.config as any) || {};
    
    // Update topic metrics
    const topics = config.topics || [];
    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      const metrics = topicMetrics.get(topic.name);
      if (metrics) {
        topics[i] = {
          ...topic,
          messageCount: metrics.messageCount,
          byteCount: metrics.byteCount,
        };
      }
    }
    config.topics = topics;
    
    // Update subscription metrics
    const subscriptions = config.subscriptions || [];
    for (let i = 0; i < subscriptions.length; i++) {
      const subscription = subscriptions[i];
      const metrics = subscriptionMetrics.get(subscription.name);
      if (metrics) {
        subscriptions[i] = {
          ...subscription,
          messageCount: metrics.messageCount,
          unackedMessageCount: metrics.unackedMessageCount,
        };
      }
    }
    config.subscriptions = subscriptions;
  }

  /**
   * SQS emulation
   */
  private simulateSQS(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    // Initialize routing engine if not exists
    if (!this.sqsRoutingEngines.has(node.id)) {
      this.initializeSQSRoutingEngine(node);
    }
    
    const routingEngine = this.sqsRoutingEngines.get(node.id)!;
    const sqsConfig = (node.data.config as any) || {};
    
    if (!hasIncomingConnections) {
      // No incoming data, reset metrics but keep queue state
      metrics.throughput = 0;
      metrics.latency = 5; // Base latency for SQS (AWS API latency)
      metrics.errorRate = 0;
      
      // Calculate utilization from existing queue depth
      const totalQueueDepth = routingEngine.getTotalQueueDepth();
      metrics.utilization = Math.min(1, totalQueueDepth / 100000);
      
      const allQueueMetrics = routingEngine.getAllQueueMetrics();
      const connections = routingEngine.getActiveConnections();
      
      metrics.customMetrics = {
        'queue_depth': totalQueueDepth,
        'connections': connections,
        'queues': allQueueMetrics.size,
      };
      
      // Update queue metrics in config
      this.updateSQSQueueMetricsInConfig(node, allQueueMetrics);
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
    
    // Latency based on queue depth and AWS region
    const totalQueueDepth = routingEngine.getTotalQueueDepth();
    const baseLatency = 5; // Base AWS API latency
    const queueLatency = Math.min(50, totalQueueDepth / 1000); // 1ms per 1000 messages, max 50ms
    metrics.latency = baseLatency + queueLatency + Math.random() * 5;
    
    // Error rate for queue delivery failures (increases with queue depth)
    const baseErrorRate = 0.0005;
    const depthErrorRate = Math.min(0.01, totalQueueDepth / 1000000); // 0.01% per 100k messages
    metrics.errorRate = baseErrorRate + depthErrorRate;
    
    // Utilization based on message queue backlog
    metrics.utilization = Math.min(1, totalQueueDepth / 100000);
    
    // Get queue metrics
    const allQueueMetrics = routingEngine.getAllQueueMetrics();
    const connections = routingEngine.getActiveConnections();
    
    metrics.customMetrics = {
      'queue_depth': totalQueueDepth,
      'connections': connections,
      'queues': allQueueMetrics.size,
    };
    
    // Update queue metrics in node config (for UI display)
    this.updateSQSQueueMetricsInConfig(node, allQueueMetrics);
  }
  
  /**
   * Initialize SQS routing engine for a node
   */
  private initializeSQSRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config as any) || {};
    const routingEngine = new SQSRoutingEngine();
    
    // Convert UI queue format to SQS routing engine format
    const queues = (config.queues || []).map((q: any) => ({
      name: q.name,
      type: q.type || 'standard',
      region: q.region || config.defaultRegion || 'us-east-1',
      visibilityTimeout: q.visibilityTimeout || 30,
      messageRetention: q.messageRetention || 4,
      delaySeconds: q.delaySeconds || 0,
      maxReceiveCount: q.maxReceiveCount,
      deadLetterQueue: q.deadLetterQueue,
      contentBasedDedup: q.contentBasedDedup,
      fifoThroughputLimit: q.fifoThroughputLimit || 'perQueue',
    }));
    
    routingEngine.initialize({
      queues: queues,
    });
    
    this.sqsRoutingEngines.set(node.id, routingEngine);
    this.lastSQSUpdate.set(node.id, Date.now());
  }

  /**
   * Update SQS queue metrics in node config (for UI display)
   */
  private updateSQSQueueMetricsInConfig(
    node: CanvasNode,
    queueMetrics: Map<string, {
      approximateMessages: number;
      approximateMessagesNotVisible: number;
      approximateMessagesDelayed: number;
      sentCount: number;
      receivedCount: number;
      deletedCount: number;
      dlqCount: number;
    }>
  ): void {
    const config = (node.data.config as any) || {};
    const queues = config.queues || [];
    
    for (let i = 0; i < queues.length; i++) {
      const queue = queues[i];
      const metrics = queueMetrics.get(queue.name);
      if (metrics) {
        queues[i] = {
          ...queue,
          approximateMessages: metrics.approximateMessages,
          approximateMessagesNotVisible: metrics.approximateMessagesNotVisible,
          approximateMessagesDelayed: metrics.approximateMessagesDelayed,
        };
      }
    }
    
    // Update node config (this will be reflected in UI)
    config.queues = queues;
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
      
      // Reset connection pool if exists
      if (node.type === 'postgres') {
        const pool = this.postgresConnectionPools.get(node.id);
        if (pool) {
          pool.reset();
        }
      }
      return;
    }
    
    const maxConnections = config.maxConnections || 100;
    const queryLatency = config.queryLatency || 10; // ms
    
    // Для PostgreSQL используем Connection Pool
    if (node.type === 'postgres') {
      const pool = this.postgresConnectionPools.get(node.id);
      if (pool) {
        // Simulate queries coming in
        const incomingConnections = this.connections.filter(conn => conn.target === node.id);
        const totalIncomingThroughput = incomingConnections.reduce((sum, conn) => {
          const sourceMetrics = this.metrics.get(conn.source);
          return sum + (sourceMetrics?.throughput || 0);
        }, 0);

        // Simulate acquiring connections for queries
        const queriesPerSecond = Math.min(totalIncomingThroughput, maxConnections * 10);
        const queriesThisUpdate = (queriesPerSecond * this.updateInterval) / 1000;
        
        for (let i = 0; i < Math.floor(queriesThisUpdate); i++) {
          const connId = pool.acquireConnection('SELECT');
          if (connId) {
            // Simulate query execution time
            const queryDuration = queryLatency + Math.random() * 20;
            setTimeout(() => {
              pool.releaseConnection(connId, queryDuration);
            }, queryDuration);
          }
        }

        // Get pool metrics
        const poolMetrics = pool.getMetrics();
        
        metrics.throughput = poolMetrics.queriesPerSecond;
        metrics.latency = poolMetrics.averageQueryTime || queryLatency;
        metrics.utilization = poolMetrics.utilization;
        metrics.errorRate = poolMetrics.waitingConnections > 0 ? 0.01 : 0.001; // Higher error rate if pool exhausted
        
        // Calculate index count for PostgreSQL
        const pgConfig = node.data.config as any;
        const tables = pgConfig.tables || [];
        let indexCount = 0;
        for (const table of tables) {
          indexCount += (table.indexes || []).length;
        }
        if (indexCount === 0) indexCount = 5; // Default

        // Cache hit ratio calculation (will be improved later)
        const cacheHitRatio = this.calculateCacheHitRatio(node, poolMetrics.queriesPerSecond);
        
        metrics.customMetrics = {
          'active_connections': poolMetrics.activeConnections,
          'idle_connections': poolMetrics.idleConnections,
          'waiting_connections': poolMetrics.waitingConnections,
          'total_connections': poolMetrics.totalConnections,
          'max_connections': maxConnections,
          'indexes': indexCount,
          'cache_hit_ratio': cacheHitRatio,
          'connection_wait_time': poolMetrics.connectionWaitTime,
        };
        
        return; // Early return for PostgreSQL
      }
    }
    
    // Для Redis используем RedisRoutingEngine
    if (node.type === 'redis') {
      if (!this.redisRoutingEngines.has(node.id)) {
        this.initializeRedisRoutingEngine(node);
      }
      
      const routingEngine = this.redisRoutingEngines.get(node.id)!;
      const redisConfig = node.data.config as any;
      
      // Sync keys from UI configuration with runtime state
      if (redisConfig?.keys) {
        routingEngine.syncKeysFromConfig(redisConfig.keys);
      }
      
      const redisMetrics = routingEngine.getMetrics();
      
      // Throughput based on incoming connections
      const incomingConnections = this.connections.filter(conn => conn.target === node.id);
      const totalIncomingThroughput = incomingConnections.reduce((sum, conn) => {
        const sourceMetrics = this.metrics.get(conn.source);
        return sum + (sourceMetrics?.throughput || 0);
      }, 0);
      
      // Redis is very fast - operations per second
      metrics.throughput = Math.max(redisMetrics.operationsPerSecond, totalIncomingThroughput);
      
      // Redis latency is very low (sub-millisecond for in-memory operations)
      // But increases with memory pressure and number of keys
      const baseLatency = 0.5; // 0.5ms base latency
      const memoryPressure = redisMetrics.memoryUsagePercent / 100;
      const keyCountFactor = Math.min(1, redisMetrics.totalKeys / 100000); // Factor based on key count
      metrics.latency = baseLatency + (memoryPressure * 2) + (keyCountFactor * 1);
      
      // Error rate is very low for Redis
      metrics.errorRate = memoryPressure > 0.95 ? 0.01 : 0.001;
      
      // Utilization based on memory usage
      metrics.utilization = redisMetrics.memoryUsagePercent / 100;
      
      metrics.customMetrics = {
        'total_keys': redisMetrics.totalKeys,
        'keys_string': redisMetrics.keysByType.string,
        'keys_hash': redisMetrics.keysByType.hash,
        'keys_list': redisMetrics.keysByType.list,
        'keys_set': redisMetrics.keysByType.set,
        'keys_zset': redisMetrics.keysByType.zset,
        'keys_stream': redisMetrics.keysByType.stream,
        'memory_usage': redisMetrics.memoryUsage,
        'memory_usage_percent': redisMetrics.memoryUsagePercent,
        'operations_per_second': redisMetrics.operationsPerSecond,
        'hit_count': redisMetrics.hitCount,
        'miss_count': redisMetrics.missCount,
        'hit_rate': redisMetrics.hitRate,
        'expired_keys': redisMetrics.expiredKeys,
        'evicted_keys': redisMetrics.evictedKeys,
        'connected_clients': redisMetrics.connectedClients,
      };
      
      return; // Early return for Redis
    }
    
    // Для Cassandra используем CassandraRoutingEngine
    if (node.type === 'cassandra') {
      if (!this.cassandraRoutingEngines.has(node.id)) {
        this.initializeCassandraRoutingEngine(node);
      }
      
      const routingEngine = this.cassandraRoutingEngines.get(node.id)!;
      const cassandraConfig = node.data.config as any;
      
      // Sync configuration from UI with runtime state
      if (cassandraConfig) {
        routingEngine.syncFromConfig({
          clusterName: cassandraConfig.clusterName,
          nodes: cassandraConfig.nodes,
          keyspaces: cassandraConfig.keyspaces,
          tables: cassandraConfig.tables,
          defaultConsistencyLevel: cassandraConfig.consistencyLevel,
          defaultReplicationFactor: cassandraConfig.replicationFactor,
        });
      }
      
      const cassandraMetrics = routingEngine.getMetrics();
      
      // Throughput based on incoming connections
      const incomingConnections = this.connections.filter(conn => conn.target === node.id);
      const totalIncomingThroughput = incomingConnections.reduce((sum, conn) => {
        const sourceMetrics = this.metrics.get(conn.source);
        return sum + (sourceMetrics?.throughput || 0);
      }, 0);
      
      // Cassandra throughput combines reads and writes
      metrics.throughput = Math.max(
        cassandraMetrics.readOperationsPerSecond + cassandraMetrics.writeOperationsPerSecond,
        totalIncomingThroughput
      );
      
      // Latency depends on consistency level and replication
      // Average of read and write latency weighted by operations
      const totalOps = cassandraMetrics.readOperationsPerSecond + cassandraMetrics.writeOperationsPerSecond;
      if (totalOps > 0) {
        const readWeight = cassandraMetrics.readOperationsPerSecond / totalOps;
        const writeWeight = cassandraMetrics.writeOperationsPerSecond / totalOps;
        metrics.latency = (cassandraMetrics.readLatency * readWeight) + (cassandraMetrics.writeLatency * writeWeight);
      } else {
        metrics.latency = (cassandraMetrics.readLatency + cassandraMetrics.writeLatency) / 2;
      }
      
      // Error rate increases with consistency violations
      const consistencyErrors = cassandraMetrics.readConsistencyViolations + cassandraMetrics.writeConsistencyViolations;
      metrics.errorRate = Math.min(0.1, consistencyErrors / Math.max(1, totalOps)) || 0.001;
      
      // Utilization based on healthy nodes vs total nodes
      // More healthy nodes = lower utilization per node (better capacity)
      // Also factor in pending compactions as workload indicator
      const nodeUtilizationFactor = cassandraMetrics.totalNodes > 0
        ? (cassandraMetrics.totalNodes - cassandraMetrics.healthyNodes) / cassandraMetrics.totalNodes
        : 0;
      const compactionLoad = Math.min(1, cassandraMetrics.pendingCompactions / 100);
      metrics.utilization = Math.min(1, nodeUtilizationFactor * 0.7 + compactionLoad * 0.3);
      
      metrics.customMetrics = {
        'total_nodes': cassandraMetrics.totalNodes,
        'healthy_nodes': cassandraMetrics.healthyNodes,
        'total_keyspaces': cassandraMetrics.totalKeyspaces,
        'total_tables': cassandraMetrics.totalTables,
        'total_rows': cassandraMetrics.totalRows,
        'total_size_gb': cassandraMetrics.totalSize / (1024 * 1024 * 1024),
        'read_latency_ms': cassandraMetrics.readLatency,
        'write_latency_ms': cassandraMetrics.writeLatency,
        'read_ops_per_sec': cassandraMetrics.readOperationsPerSecond,
        'write_ops_per_sec': cassandraMetrics.writeOperationsPerSecond,
        'pending_compactions': cassandraMetrics.pendingCompactions,
        'read_consistency_violations': cassandraMetrics.readConsistencyViolations,
        'write_consistency_violations': cassandraMetrics.writeConsistencyViolations,
        'hinted_handoffs': cassandraMetrics.hintedHandoffs,
      };
      
      return; // Early return for Cassandra
    }
    
    // Для ClickHouse используем ClickHouseRoutingEngine
    if (node.type === 'clickhouse') {
      if (!this.clickHouseRoutingEngines.has(node.id)) {
        this.initializeClickHouseRoutingEngine(node);
      }
      
      const routingEngine = this.clickHouseRoutingEngines.get(node.id)!;
      const clickHouseConfig = node.data.config as any;
      
      // Sync configuration from UI with runtime state
      if (clickHouseConfig) {
        routingEngine.syncFromConfig({
          cluster: clickHouseConfig.cluster,
          replication: clickHouseConfig.replication,
          tables: clickHouseConfig.tables?.map((t: any) => ({
            name: t.name,
            database: clickHouseConfig.database || 'default',
            engine: t.engine || 'MergeTree',
            rows: t.rows || 0,
            size: t.size || 0,
            partitions: t.partitions || 0,
            columns: t.columns || [],
          })),
          maxMemoryUsage: clickHouseConfig.maxMemoryUsage,
          compression: clickHouseConfig.compression,
        });
      }
      
      const clickHouseMetrics = routingEngine.getMetrics();
      
      // Throughput based on incoming connections
      const incomingConnections = this.connections.filter(conn => conn.target === node.id);
      const totalIncomingThroughput = incomingConnections.reduce((sum, conn) => {
        const sourceMetrics = this.metrics.get(conn.source);
        return sum + (sourceMetrics?.throughput || 0);
      }, 0);
      
      // ClickHouse throughput is queries per second
      metrics.throughput = Math.max(clickHouseMetrics.queriesPerSecond, totalIncomingThroughput);
      
      // Latency from routing engine
      metrics.latency = clickHouseMetrics.avgQueryTime;
      
      // Error rate is very low for ClickHouse (analytical database is optimized)
      // Increase slightly with memory pressure
      const memoryPressure = clickHouseMetrics.memoryUsagePercent / 100;
      metrics.errorRate = memoryPressure > 0.95 ? 0.01 : 0.001;
      
      // Utilization based on memory usage and active queries
      const queryUtilization = Math.min(1, clickHouseMetrics.activeQueries / 10); // Max 10 concurrent queries
      const memoryUtilization = memoryPressure;
      metrics.utilization = Math.max(queryUtilization, memoryUtilization);
      
      metrics.customMetrics = {
        'total_tables': clickHouseMetrics.totalTables,
        'total_rows': clickHouseMetrics.totalRows,
        'total_size_gb': clickHouseMetrics.totalSize / (1024 * 1024 * 1024),
        'queries_per_sec': clickHouseMetrics.queriesPerSecond,
        'read_rows_per_sec': clickHouseMetrics.readRowsPerSecond,
        'written_rows_per_sec': clickHouseMetrics.writtenRowsPerSecond,
        'avg_query_time_ms': clickHouseMetrics.avgQueryTime,
        'active_queries': clickHouseMetrics.activeQueries,
        'memory_usage_bytes': clickHouseMetrics.memoryUsage,
        'memory_usage_percent': clickHouseMetrics.memoryUsagePercent,
        'parts_count': clickHouseMetrics.partsCount,
        'pending_merges': clickHouseMetrics.pendingMerges,
        'compression_ratio': clickHouseMetrics.compressionRatio,
        'cluster_nodes': clickHouseMetrics.clusterNodes,
        'healthy_nodes': clickHouseMetrics.healthyNodes,
      };
      
      return; // Early return for ClickHouse
    }
    
    // Для Snowflake используем SnowflakeRoutingEngine
    if (node.type === 'snowflake') {
      if (!this.snowflakeRoutingEngines.has(node.id)) {
        this.initializeSnowflakeRoutingEngine(node);
      }
      
      const routingEngine = this.snowflakeRoutingEngines.get(node.id)!;
      const snowflakeConfig = node.data.config as any;
      
      // Sync configuration from UI with runtime state
      if (snowflakeConfig) {
        routingEngine.syncFromConfig({
          account: snowflakeConfig.account,
          region: snowflakeConfig.region,
          warehouses: snowflakeConfig.warehouses,
          databases: snowflakeConfig.databases,
          role: snowflakeConfig.role,
          enableAutoSuspend: snowflakeConfig.enableAutoSuspend,
          autoSuspendSeconds: snowflakeConfig.autoSuspendSeconds,
          enableAutoResume: snowflakeConfig.enableAutoResume,
        });
      }
      
      const snowflakeMetrics = routingEngine.getMetrics();
      
      // Throughput based on incoming connections
      const incomingConnections = this.connections.filter(conn => conn.target === node.id);
      const totalIncomingThroughput = incomingConnections.reduce((sum, conn) => {
        const sourceMetrics = this.metrics.get(conn.source);
        return sum + (sourceMetrics?.throughput || 0);
      }, 0);
      
      // Snowflake throughput is queries per second
      metrics.throughput = Math.max(snowflakeMetrics.queriesPerSecond, totalIncomingThroughput);
      
      // Latency from routing engine
      metrics.latency = snowflakeMetrics.avgQueryTime;
      
      // Error rate is very low for Snowflake
      metrics.errorRate = 0.001;
      
      // Utilization based on warehouse utilization
      metrics.utilization = snowflakeMetrics.warehouseUtilization;
      
      metrics.customMetrics = {
        'total_warehouses': snowflakeMetrics.totalWarehouses,
        'running_warehouses': snowflakeMetrics.runningWarehouses,
        'suspended_warehouses': snowflakeMetrics.suspendedWarehouses,
        'total_queries': snowflakeMetrics.totalQueries,
        'running_queries': snowflakeMetrics.runningQueries,
        'queued_queries': snowflakeMetrics.queuedQueries,
        'queries_per_sec': snowflakeMetrics.queriesPerSecond,
        'avg_query_time_ms': snowflakeMetrics.avgQueryTime,
        'total_compute_time_sec': snowflakeMetrics.totalComputeTime,
        'total_data_read': snowflakeMetrics.totalDataRead,
        'total_data_written': snowflakeMetrics.totalDataWritten,
        'cache_hit_rate': snowflakeMetrics.cacheHitRate,
        'warehouse_utilization': snowflakeMetrics.warehouseUtilization,
        'total_cost_credits': snowflakeMetrics.totalCost,
      };
      
      return; // Early return for Snowflake
    }
    
    // Для Elasticsearch используем ElasticsearchRoutingEngine
    if (node.type === 'elasticsearch') {
      if (!this.elasticsearchRoutingEngines.has(node.id)) {
        this.initializeElasticsearchRoutingEngine(node);
      }
      
      const routingEngine = this.elasticsearchRoutingEngines.get(node.id)!;
      const elasticsearchConfig = node.data.config as any;
      
      // Sync configuration from UI with runtime state
      if (elasticsearchConfig) {
        routingEngine.syncFromConfig({
          clusterName: elasticsearchConfig.clusterName,
          nodes: elasticsearchConfig.nodes,
          indices: elasticsearchConfig.indices,
          defaultShards: elasticsearchConfig.shards,
          defaultReplicas: elasticsearchConfig.replicas,
          refreshInterval: elasticsearchConfig.refreshInterval,
        });
      }
      
      const elasticsearchMetrics = routingEngine.getMetrics();
      
      // Throughput based on incoming connections
      const incomingConnections = this.connections.filter(conn => conn.target === node.id);
      const totalIncomingThroughput = incomingConnections.reduce((sum, conn) => {
        const sourceMetrics = this.metrics.get(conn.source);
        return sum + (sourceMetrics?.throughput || 0);
      }, 0);
      
      // Elasticsearch throughput combines index and search operations
      metrics.throughput = Math.max(
        elasticsearchMetrics.indexOperationsPerSecond + elasticsearchMetrics.searchOperationsPerSecond,
        totalIncomingThroughput
      );
      
      // Latency depends on operation type (weighted average)
      const totalOps = elasticsearchMetrics.indexOperationsPerSecond + elasticsearchMetrics.searchOperationsPerSecond;
      if (totalOps > 0) {
        const indexWeight = elasticsearchMetrics.indexOperationsPerSecond / totalOps;
        const searchWeight = elasticsearchMetrics.searchOperationsPerSecond / totalOps;
        metrics.latency = (elasticsearchMetrics.averageIndexLatency * indexWeight) + 
                          (elasticsearchMetrics.averageSearchLatency * searchWeight);
      } else {
        metrics.latency = elasticsearchMetrics.averageSearchLatency || 10;
      }
      
      // Error rate is very low for Elasticsearch
      // Increase slightly if cluster health is not green
      const healthFactor = elasticsearchMetrics.clusterHealth === 'red' ? 0.01 : 
                          elasticsearchMetrics.clusterHealth === 'yellow' ? 0.002 : 0.001;
      metrics.errorRate = healthFactor;
      
      // Utilization based on cluster health and shard status
      const shardUtilization = elasticsearchMetrics.unassignedShards > 0 ? 1.0 :
                               elasticsearchMetrics.relocatingShards > 0 ? 0.7 :
                               elasticsearchMetrics.initializingShards > 0 ? 0.5 : 0.3;
      const nodeUtilization = elasticsearchMetrics.healthyNodes / elasticsearchMetrics.totalNodes;
      metrics.utilization = Math.max(shardUtilization, 1 - nodeUtilization);
      
      // Update metrics in node config (for UI display)
      this.updateElasticsearchMetricsInConfig(node, elasticsearchMetrics);
      
      metrics.customMetrics = {
        'cluster_health': elasticsearchMetrics.clusterHealth === 'green' ? 1 : 
                          elasticsearchMetrics.clusterHealth === 'yellow' ? 0.5 : 0,
        'total_nodes': elasticsearchMetrics.totalNodes,
        'healthy_nodes': elasticsearchMetrics.healthyNodes,
        'total_indices': elasticsearchMetrics.totalIndices,
        'total_docs': elasticsearchMetrics.totalDocs,
        'total_size_gb': elasticsearchMetrics.totalSize / (1024 * 1024 * 1024),
        'active_shards': elasticsearchMetrics.activeShards,
        'relocating_shards': elasticsearchMetrics.relocatingShards,
        'initializing_shards': elasticsearchMetrics.initializingShards,
        'unassigned_shards': elasticsearchMetrics.unassignedShards,
        'index_ops_per_sec': elasticsearchMetrics.indexOperationsPerSecond,
        'search_ops_per_sec': elasticsearchMetrics.searchOperationsPerSecond,
        'avg_index_latency_ms': elasticsearchMetrics.averageIndexLatency,
        'avg_search_latency_ms': elasticsearchMetrics.averageSearchLatency,
        'avg_get_latency_ms': elasticsearchMetrics.averageGetLatency,
      };
      
      return; // Early return for Elasticsearch
    }
    
    // Для S3 Data Lake используем S3RoutingEngine
    if (node.type === 's3-datalake') {
      if (!this.s3RoutingEngines.has(node.id)) {
        this.initializeS3RoutingEngine(node);
      }
      
      const routingEngine = this.s3RoutingEngines.get(node.id)!;
      
      // Process lifecycle transitions periodically
      routingEngine.processLifecycleTransitions();
      
      if (!hasIncomingConnections) {
        // No incoming data, reset metrics but keep bucket state
        metrics.throughput = 0;
        metrics.latency = 50; // Base latency for S3 (AWS API latency)
        metrics.errorRate = 0;
        
        // Calculate utilization from storage usage
        const bucketMetrics = routingEngine.getAllBucketMetrics();
        const totalSize = routingEngine.getTotalStorageSize();
        const totalObjects = routingEngine.getTotalObjectCount();
        
        // Utilization based on storage (assuming max 1TB per bucket)
        const maxStoragePerBucket = 1024 * 1024 * 1024 * 1024; // 1TB
        const bucketCount = bucketMetrics.size;
        const maxTotalStorage = maxStoragePerBucket * bucketCount;
        metrics.utilization = maxTotalStorage > 0 ? Math.min(1, totalSize / maxTotalStorage) : 0;
        
        metrics.customMetrics = {
          'buckets': bucketCount,
          'total_objects': totalObjects,
          'total_size': totalSize,
          'total_size_mb': Math.round(totalSize / (1024 * 1024) * 100) / 100,
        };
        
        // Update bucket metrics in config
        this.updateS3BucketMetricsInConfig(node, bucketMetrics);
        return;
      }
      
      // Calculate incoming throughput from connections
      const incomingConnections = this.connections.filter(c => c.target === node.id);
      let totalThroughput = 0;
      let totalTraffic = 0;
      
      for (const conn of incomingConnections) {
        const connMetrics = this.connectionMetrics.get(conn.id);
        if (connMetrics) {
          totalThroughput += connMetrics.traffic / 1024; // Convert bytes/sec to KB/sec
          totalTraffic += connMetrics.traffic;
        }
      }
      
      // Estimate operations per second based on traffic
      // Assume average object size of 1MB
      const avgObjectSize = 1024 * 1024; // 1MB
      const estimatedOpsPerSec = totalTraffic > 0 ? totalTraffic / avgObjectSize : 0;
      
      metrics.throughput = Math.max(0, estimatedOpsPerSec);
      metrics.latency = 50 + (estimatedOpsPerSec > 100 ? (estimatedOpsPerSec - 100) * 0.1 : 0); // Increase latency with load
      metrics.errorRate = 0.001; // Very low error rate for S3
      
      // Utilization based on storage and operations
      const bucketMetrics = routingEngine.getAllBucketMetrics();
      const totalSize = routingEngine.getTotalStorageSize();
      const totalObjects = routingEngine.getTotalObjectCount();
      const bucketCount = bucketMetrics.size;
      
      // Storage utilization (assuming max 1TB per bucket)
      const maxStoragePerBucket = 1024 * 1024 * 1024 * 1024; // 1TB
      const maxTotalStorage = maxStoragePerBucket * bucketCount;
      const storageUtilization = maxTotalStorage > 0 ? Math.min(1, totalSize / maxTotalStorage) : 0;
      
      // Operations utilization (assuming max 3500 PUT/POST/DELETE per second per bucket)
      const maxOpsPerBucket = 3500;
      const maxTotalOps = maxOpsPerBucket * bucketCount;
      const opsUtilization = maxTotalOps > 0 ? Math.min(1, estimatedOpsPerSec / maxTotalOps) : 0;
      
      metrics.utilization = Math.max(storageUtilization, opsUtilization);
      
      metrics.customMetrics = {
        'buckets': bucketCount,
        'total_objects': totalObjects,
        'total_size': totalSize,
        'total_size_mb': Math.round(totalSize / (1024 * 1024) * 100) / 100,
        'total_size_gb': Math.round(totalSize / (1024 * 1024 * 1024) * 100) / 100,
        'estimated_ops_per_sec': Math.round(estimatedOpsPerSec * 100) / 100,
        'storage_utilization': Math.round(storageUtilization * 1000) / 10,
        'ops_utilization': Math.round(opsUtilization * 1000) / 10,
      };
      
      // Update bucket metrics in config
      this.updateS3BucketMetricsInConfig(node, bucketMetrics);
      
      return; // Early return for S3
    }
    
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
   * Kong Gateway emulation
   */
  private simulateKong(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    if (!hasIncomingConnections) {
      // No incoming requests, reset metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0;
      return;
    }

    // Get Kong routing engine
    const routingEngine = this.kongRoutingEngines.get(node.id);
    if (!routingEngine) {
      // No routing engine, use default API-like behavior
      this.simulateAPI(node, config, metrics, hasIncomingConnections);
      return;
    }

    // Get Kong config
    const kongConfig = (config as any) || {};
    const requestsPerSecond = kongConfig.requestsPerSecond || config.requestsPerSecond || 450;
    const stats = routingEngine.getStats();

    // Calculate throughput based on incoming connections and rate limits
    const loadVariation = 0.5 * Math.sin(this.simulationTime / 2000) + 0.5;
    let baseThroughput = requestsPerSecond * loadVariation;

    // Apply rate limiting effects from plugins
    const rateLimitPlugins = (kongConfig.plugins || []).filter((p: any) => 
      p.name === 'rate-limiting' && p.enabled
    );
    
    if (rateLimitPlugins.length > 0) {
      // Rate limiting reduces effective throughput
      const minLimit = Math.min(...rateLimitPlugins.map((p: any) => 
        p.config?.minute || 1000
      ));
      baseThroughput = Math.min(baseThroughput, minLimit * loadVariation);
    }

    metrics.throughput = baseThroughput;

    // Latency: base gateway latency (1-5ms) + plugin overhead
    const baseLatency = 2 + Math.random() * 3;
    const pluginOverhead = stats.plugins * 0.5; // Each plugin adds ~0.5ms
    const upstreamLatency = 10 + Math.random() * 40; // Simulated upstream latency
    metrics.latency = baseLatency + pluginOverhead + upstreamLatency;

    // Error rate: base + plugin rejections
    const baseErrorRate = 0.001; // 0.1% base error rate
    const authErrorRate = stats.consumers > 0 ? 0.02 : 0; // 2% auth failures if consumers configured
    metrics.errorRate = Math.min(1, baseErrorRate + authErrorRate);

    // Utilization based on throughput vs capacity
    metrics.utilization = Math.min(1, metrics.throughput / requestsPerSecond);

    metrics.customMetrics = {
      'services': stats.services,
      'routes': stats.routes,
      'upstreams': stats.upstreams,
      'consumers': stats.consumers,
      'plugins': stats.plugins,
      'requests_per_second': requestsPerSecond,
      'gateway_latency': baseLatency + pluginOverhead,
      'upstream_latency': upstreamLatency,
    };
  }

  /**
   * Apigee Gateway emulation
   */
  private simulateApigee(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    if (!hasIncomingConnections) {
      // No incoming requests, reset metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0;
      return;
    }

    // Get Apigee routing engine
    const routingEngine = this.apigeeRoutingEngines.get(node.id);
    if (!routingEngine) {
      // No routing engine, use default API-like behavior
      this.simulateAPI(node, config, metrics, hasIncomingConnections);
      return;
    }

    // Get Apigee config
    const apigeeConfig = (config as any) || {};
    const proxies = apigeeConfig.proxies || [];
    const requestsPerSecond = apigeeConfig.requestsPerSecond || config.requestsPerSecond || 500;
    const stats = routingEngine.getStats();

    // Calculate throughput based on incoming connections and rate limits
    const loadVariation = 0.5 * Math.sin(this.simulationTime / 2000) + 0.5;
    let baseThroughput = requestsPerSecond * loadVariation;

    // Apply quota limits from proxies
    const deployedProxies = proxies.filter((p: any) => p.status !== 'undeployed');
    if (deployedProxies.length > 0) {
      // Find minimum quota limit across all proxies
      const quotaLimits = deployedProxies
        .filter((p: any) => p.quota && p.quotaInterval)
        .map((p: any) => (p.quota / p.quotaInterval) * loadVariation);
      
      if (quotaLimits.length > 0) {
        const minQuotaRate = Math.min(...quotaLimits);
        baseThroughput = Math.min(baseThroughput, minQuotaRate);
      }

      // Apply spike arrest limits
      const spikeArrestLimits = deployedProxies
        .filter((p: any) => p.spikeArrest && p.spikeArrest > 0)
        .map((p: any) => p.spikeArrest);
      
      if (spikeArrestLimits.length > 0) {
        const minSpikeArrest = Math.min(...spikeArrestLimits);
        baseThroughput = Math.min(baseThroughput, minSpikeArrest * loadVariation);
      }
    }

    metrics.throughput = baseThroughput;

    // Latency: base gateway latency (2-5ms) + policy overhead + upstream latency
    const baseLatency = 3 + Math.random() * 2;
    const policyOverhead = stats.policies * 0.8; // Each policy adds ~0.8ms
    const upstreamLatency = 15 + Math.random() * 35; // Simulated upstream latency
    metrics.latency = baseLatency + policyOverhead + upstreamLatency;

    // Error rate: base + auth failures + quota/spike arrest rejections
    const baseErrorRate = 0.001; // 0.1% base error rate
    const authErrorRate = stats.policies > 0 ? 0.015 : 0; // 1.5% auth failures if policies configured
    const quotaErrorRate = stats.totalErrors > 0 ? (stats.totalErrors / Math.max(stats.totalRequests, 1)) * 0.1 : 0;
    metrics.errorRate = Math.min(1, baseErrorRate + authErrorRate + quotaErrorRate);

    // Utilization based on throughput vs capacity
    metrics.utilization = Math.min(1, metrics.throughput / requestsPerSecond);

    metrics.customMetrics = {
      'proxies': stats.proxies,
      'policies': stats.policies,
      'total_requests': stats.totalRequests,
      'total_errors': stats.totalErrors,
      'avg_latency': Math.round(stats.avgLatency),
      'requests_per_second': requestsPerSecond,
      'gateway_latency': baseLatency + policyOverhead,
      'upstream_latency': upstreamLatency,
    };
  }

  /**
   * MuleSoft Integration Platform emulation
   */
  private simulateMuleSoft(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    if (!hasIncomingConnections) {
      // No incoming requests, reset metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0;
      return;
    }

    // Get MuleSoft routing engine
    const routingEngine = this.mulesoftRoutingEngines.get(node.id);
    if (!routingEngine) {
      // No routing engine, use default API-like behavior
      this.simulateAPI(node, config, metrics, hasIncomingConnections);
      return;
    }

    // Get MuleSoft config
    const mulesoftConfig = (config as any) || {};
    const applications = mulesoftConfig.applications || [];
    const stats = routingEngine.getStats();

    // Calculate throughput based on running applications and workers
    const loadVariation = 0.5 * Math.sin(this.simulationTime / 2000) + 0.5;
    
    // Base throughput: sum of all running applications' capacity
    // Each worker can handle ~50-100 requests/sec (depending on complexity)
    let totalCapacity = 0;
    let totalWorkers = 0;
    
    for (const app of applications) {
      if (app.status === 'running') {
        const workerCount = app.workerCount || 2;
        totalWorkers += workerCount;
        // Each worker handles ~50-100 req/sec, but depends on connector types
        const workerCapacity = 75; // Average capacity per worker
        totalCapacity += workerCount * workerCapacity;
      }
    }
    
    // If no running applications, use default
    if (totalCapacity === 0) {
      totalCapacity = 100; // Default capacity
    }
    
    let baseThroughput = totalCapacity * loadVariation;

    // Apply limits from applications (if configured)
    // MuleSoft doesn't have built-in rate limiting like API Gateways,
    // but applications can have their own limits
    
    metrics.throughput = baseThroughput;

    // Latency: base runtime latency + connector latency + transformation overhead
    const baseLatency = 5 + Math.random() * 10; // Mule Runtime base: 5-15ms
    const connectorOverhead = stats.enabledConnectors * 2; // Each connector adds ~2ms overhead
    const transformationOverhead = 3 + Math.random() * 5; // DataWeave transformation: 3-8ms
    const connectorLatency = 15 + Math.random() * 25; // Connector-specific latency: 15-40ms
    
    metrics.latency = baseLatency + connectorOverhead + transformationOverhead + connectorLatency;

    // Error rate: base + connector errors + application errors
    const baseErrorRate = 0.002; // 0.2% base error rate
    const connectorErrorRate = stats.totalErrors > 0 
      ? (stats.totalErrors / Math.max(stats.totalRequests, 1)) * 0.15 
      : 0;
    const applicationErrorRate = stats.runningApplications > 0 ? 0.005 : 0.01; // 0.5% if apps running, 1% if not
    
    metrics.errorRate = Math.min(1, baseErrorRate + connectorErrorRate + applicationErrorRate);

    // Utilization based on throughput vs capacity and worker utilization
    const workerUtilization = totalWorkers > 0 
      ? Math.min(1, metrics.throughput / (totalWorkers * 75))
      : 0.5;
    metrics.utilization = Math.min(1, workerUtilization);

    metrics.customMetrics = {
      'applications': stats.applications,
      'running_applications': stats.runningApplications,
      'connectors': stats.connectors,
      'enabled_connectors': stats.enabledConnectors,
      'total_requests': stats.totalRequests,
      'total_errors': stats.totalErrors,
      'avg_latency': Math.round(stats.avgLatency),
      'total_workers': totalWorkers,
      'runtime_latency': baseLatency,
      'connector_latency': connectorLatency,
      'transformation_latency': transformationOverhead,
    };
  }

  /**
   * Grafana emulation
   */
  private simulateGrafana(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    // Get Grafana emulation engine
    const grafanaEngine = this.grafanaEngines.get(node.id);
    
    if (!grafanaEngine) {
      // No engine initialized, use default metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0.1; // Minimal utilization when idle
      return;
    }

    // Get Grafana metrics (query load, etc.)
    const grafanaMetrics = grafanaEngine.getGrafanaMetrics();
    const load = grafanaEngine.calculateLoad();
    
    // Grafana throughput = queries per second + alert evaluations per second
    metrics.throughput = load.queriesPerSecond + load.alertEvaluationsPerSecond;
    
    // Grafana latency = average query latency + rendering latency
    metrics.latency = load.averageQueryLatency + load.averageRenderingLatency;
    
    // Error rate from datasource errors
    metrics.errorRate = load.errorRate;
    
    // Utilization based on CPU and memory utilization
    // Используем среднее между CPU и memory utilization
    metrics.utilization = (load.cpuUtilization + load.memoryUtilization) / 2;
    
    // Custom metrics
    metrics.customMetrics = {
      'queries_per_second': load.queriesPerSecond,
      'dashboard_refreshes_per_second': load.dashboardRefreshesPerSecond,
      'alert_evaluations_per_second': load.alertEvaluationsPerSecond,
      'average_query_latency': load.averageQueryLatency,
      'average_rendering_latency': load.averageRenderingLatency,
      'datasource_errors': grafanaMetrics.datasourceErrors,
      'active_dashboards': grafanaMetrics.activeDashboards,
      'active_panels': grafanaMetrics.activePanels,
      'total_queries': grafanaMetrics.totalQueries,
      'cpu_utilization': load.cpuUtilization,
      'memory_utilization': load.memoryUtilization,
    };
  }

  /**
   * Prometheus emulation
   */
  private simulatePrometheus(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    // Get Prometheus emulation engine
    const prometheusEngine = this.prometheusEngines.get(node.id);
    
    if (!prometheusEngine) {
      // No engine initialized, use default metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0.1; // Minimal utilization when idle
      return;
    }

    // Get Prometheus metrics (scrape load, etc.)
    const promMetrics = prometheusEngine.getPrometheusMetrics();
    const load = prometheusEngine.calculateLoad();
    
    // Prometheus throughput = scrape requests per second
    metrics.throughput = load.scrapeRequestsPerSecond;
    
    // Prometheus latency = average scrape duration
    metrics.latency = load.averageScrapeDuration;
    
    // Error rate from scraping
    metrics.errorRate = load.errorRate;
    
    // Utilization based on number of targets and scrape frequency
    // More targets and shorter intervals = higher utilization
    const targetCount = prometheusEngine.getTargetStatuses().length;
    const utilization = Math.min(0.95, 0.1 + (targetCount / 100) * 0.5 + (load.scrapeRequestsPerSecond / 10) * 0.2);
    metrics.utilization = utilization;
    
    // Custom metrics
    metrics.customMetrics = {
      'scrape_requests_total': promMetrics.scrapeRequestsTotal,
      'scrape_errors_total': promMetrics.scrapeErrorsTotal,
      'targets_up': promMetrics.targetsUp,
      'targets_down': promMetrics.targetsDown,
      'samples_scraped': promMetrics.samplesScraped,
      'scrape_requests_per_second': load.scrapeRequestsPerSecond,
      'samples_per_second': load.samplesPerSecond,
    };
  }

  /**
   * BFF Service emulation
   */
  private simulateBFF(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    if (!hasIncomingConnections) {
      // No incoming requests, reset metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0;
      return;
    }

    // Get BFF routing engine
    const routingEngine = this.bffRoutingEngines.get(node.id);
    if (!routingEngine) {
      // No routing engine, use default API-like behavior
      this.simulateAPI(node, config, metrics, hasIncomingConnections);
      return;
    }

    // Get BFF config
    const bffConfig = (config as any) || {};
    const endpoints = bffConfig.endpoints || [];
    const backends = bffConfig.backends || [];

    // Calculate incoming throughput from connections
    const incomingConnections = this.connections.filter(c => c.target === node.id);
    let totalIncomingThroughput = 0;

    for (const conn of incomingConnections) {
      const connMetrics = this.connectionMetrics.get(conn.id);
      if (connMetrics) {
        // Estimate requests per second from connection traffic
        // Assume average request size of 2KB
        const avgRequestSize = 2048;
        const reqPerSec = connMetrics.traffic / avgRequestSize;
        totalIncomingThroughput += reqPerSec;
      }
    }

    // Use configured throughput if available, otherwise use calculated
    const baseThroughput = config.requestsPerSecond || totalIncomingThroughput || 100;

    // Get stats from routing engine
    const stats = routingEngine.getStats();

    // Throughput with variation
    const loadVariation = 0.3 * Math.sin(this.simulationTime / 2000) + 0.7;
    metrics.throughput = baseThroughput * loadVariation;

    // Latency calculation based on aggregation strategy
    // For BFF, latency depends on:
    // - Parallel: max latency of all backends
    // - Sequential: sum of all backend latencies
    // - Merge: max latency of all backends (parallel execution)
    let baseLatency = stats.averageLatency || 100;
    
    // Add overhead for aggregation (5-15ms)
    const aggregationOverhead = 5 + Math.random() * 10;
    
    // Cache hit reduces latency significantly
    const cacheHitRate = stats.cacheHitRate || 0;
    const cacheLatencyReduction = cacheHitRate * 0.8; // 80% reduction on cache hit
    
    // Calculate effective latency
    const effectiveLatency = baseLatency * (1 - cacheLatencyReduction) + aggregationOverhead;
    metrics.latency = effectiveLatency + Math.random() * 20;

    // Error rate from backend failures
    const baseErrorRate = stats.totalRequests > 0 
      ? stats.totalErrors / stats.totalRequests 
      : 0.005;
    
    // Add error rate from circuit breakers and timeouts
    const circuitBreakerErrorRate = 0.001; // Small chance of circuit breaker open
    metrics.errorRate = Math.min(1, baseErrorRate + circuitBreakerErrorRate);

    // Utilization based on concurrent requests
    const maxConcurrent = bffConfig.maxConcurrentRequests || 100;
    const estimatedConcurrent = metrics.throughput * (metrics.latency / 1000);
    metrics.utilization = Math.min(1, estimatedConcurrent / maxConcurrent);

    // Calculate endpoint-specific metrics
    const totalEndpointRequests = endpoints.reduce((sum: number, e: any) => sum + (e.requests || 0), 0);
    const connectedBackends = backends.filter((b: any) => b.status === 'connected').length;

    metrics.customMetrics = {
      'endpoints': endpoints.length,
      'backends': backends.length,
      'connected_backends': connectedBackends,
      'total_requests': stats.totalRequests,
      'total_errors': stats.totalErrors,
      'avg_latency': Math.round(stats.averageLatency),
      'cache_hit_rate': Math.round(cacheHitRate * 100) / 100,
      'endpoint_requests': totalEndpointRequests,
      'aggregation_overhead': Math.round(aggregationOverhead),
      'concurrent_requests': Math.round(estimatedConcurrent),
    };
  }

  /**
   * Initialize Kong routing engine for a node
   */
  private initializeKongRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;
    
    const routingEngine = new KongRoutingEngine();
    
    routingEngine.initialize({
      services: config.services || [],
      routes: config.routes || [],
      upstreams: config.upstreams || [],
      consumers: config.consumers || [],
      plugins: config.plugins || [],
    });
    
    this.kongRoutingEngines.set(node.id, routingEngine);
  }

  /**
   * Initialize Apigee routing engine for a node
   */
  private initializeApigeeRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;
    
    const routingEngine = new ApigeeRoutingEngine();
    
    routingEngine.initialize({
      organization: config.organization,
      environment: config.environment,
      proxies: config.proxies || [],
      policies: config.policies || [],
    });
    
    this.apigeeRoutingEngines.set(node.id, routingEngine);
  }

  /**
   * Initialize MuleSoft routing engine for a node
   */
  private initializeMuleSoftRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;
    
    const routingEngine = new MuleSoftRoutingEngine();
    
    // Convert applications from config format to routing engine format
    const applications = (config.applications || []).map((app: any) => ({
      name: app.name,
      runtimeVersion: app.runtimeVersion || '4.6.0',
      workerCount: app.workerCount || 2,
      status: app.status || 'stopped',
      connectors: app.connectors || [],
      errorStrategy: app.errorStrategy || 'continue',
      reconnectionStrategy: app.reconnectionStrategy || 'exponential',
      auditLogging: app.auditLogging || false,
      flows: app.flows || [],
    }));
    
    // Convert connectors from config format to routing engine format
    const connectors = (config.connectors || []).map((conn: any) => ({
      name: conn.name,
      type: conn.type || 'api',
      enabled: conn.enabled !== false,
      config: conn.config || {},
      targetComponentType: conn.targetComponentType,
      targetComponentId: conn.targetComponentId,
    }));
    
    routingEngine.initialize({
      organization: config.organization,
      environment: config.environment,
      applications,
      connectors,
    });
    
    this.mulesoftRoutingEngines.set(node.id, routingEngine);
  }

  /**
   * Initialize GraphQL Gateway routing engine for a node
   */
  private initializeGraphQLGatewayRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;
    const routingEngine = new GraphQLGatewayRoutingEngine();

    routingEngine.initialize({
      services: config.services || [],
      federation: config.federation,
      cacheTtl: config.cacheTtl,
      persistQueries: config.persistQueries,
      subscriptions: config.subscriptions,
      enableIntrospection: config.enableIntrospection,
      enableQueryComplexityAnalysis: config.enableQueryComplexityAnalysis,
      enableRateLimiting: config.enableRateLimiting,
      maxQueryDepth: config.maxQueryDepth,
      maxQueryComplexity: config.maxQueryComplexity,
      endpoint: config.endpoint,
    });

    this.graphQLGatewayRoutingEngines.set(node.id, routingEngine);
    this.lastGraphQLGatewayUpdate.set(node.id, Date.now());
  }

  /**
   * Initialize BFF routing engine for a node
   */
  private initializeBFFRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;
    const routingEngine = new BFFRoutingEngine();

    // Find Redis component if cacheMode is 'redis'
    let redisEngine = null;
    let redisNodeId = '';
    if (config.cacheMode === 'redis') {
      // Find Redis component connected to this BFF
      const redisConnection = this.connections.find(
        conn => (conn.source === node.id || conn.target === node.id) && 
        (this.nodes.find(n => n.id === (conn.source === node.id ? conn.target : conn.source))?.type === 'redis')
      );
      
      if (redisConnection) {
        const redisNode = this.nodes.find(
          n => n.id === (redisConnection.source === node.id ? redisConnection.target : redisConnection.source)
        );
        
        if (redisNode && redisNode.type === 'redis') {
          // Initialize Redis engine if not already initialized
          if (!this.redisRoutingEngines.has(redisNode.id)) {
            this.initializeRedisRoutingEngine(redisNode);
          }
          redisEngine = this.redisRoutingEngines.get(redisNode.id);
          redisNodeId = redisNode.id;
        }
      }
    }

    routingEngine.initialize({
      backends: config.backends || [],
      endpoints: config.endpoints || [],
      enableCaching: config.enableCaching ?? true,
      enableRequestBatching: config.enableRequestBatching ?? false,
      enableResponseCompression: config.enableResponseCompression ?? true,
      defaultTimeout: config.defaultTimeout || 5000,
      maxConcurrentRequests: config.maxConcurrentRequests || 100,
      cacheMode: config.cacheMode || 'memory',
      cacheTtl: config.cacheTtl || 5,
      fallbackEnabled: config.fallbackEnabled ?? true,
      fallbackComponent: config.fallbackComponent,
      redisEngine: redisEngine || undefined,
      redisNodeId: redisNodeId || undefined,
    });

    this.bffRoutingEngines.set(node.id, routingEngine);
  }

  /**
   * Initialize Webhook Relay routing engine for a node
   */
  private initializeWebhookRelayRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;
    const routingEngine = new WebhookRelayRoutingEngine();

    routingEngine.initialize({
      relays: config.relays || [],
      enableRetryOnFailure: config.enableRetryOnFailure ?? true,
      enableSignatureVerification: config.enableSignatureVerification ?? true,
      enableRequestLogging: config.enableRequestLogging ?? true,
      maxRetryAttempts: config.maxRetryAttempts || 3,
      retryDelay: config.retryDelay || 5,
      timeout: config.timeout || 30,
    });

    this.webhookRelayRoutingEngines.set(node.id, routingEngine);
  }

  /**
   * Initialize Redis routing engine for a node
   */
  private initializeRedisRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;
    const routingEngine = new RedisRoutingEngine();

    routingEngine.initialize({
      host: config.host || 'localhost',
      port: config.port || 6379,
      password: config.password || '',
      database: config.database || 0,
      maxMemory: config.maxMemory || '256mb',
      maxMemoryPolicy: config.maxMemoryPolicy || 'noeviction',
      enablePersistence: config.enablePersistence ?? true,
      persistenceType: config.persistenceType || 'rdb',
      enableCluster: config.enableCluster ?? false,
      clusterNodes: config.clusterNodes || [],
      keys: config.keys || [],
    });

    this.redisRoutingEngines.set(node.id, routingEngine);
  }

  /**
   * Initialize Cassandra routing engine for a node
   */
  private initializeCassandraRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;
    const routingEngine = new CassandraRoutingEngine();

    routingEngine.initialize({
      clusterName: config.clusterName || 'archiphoenix-cluster',
      nodes: config.nodes || [],
      keyspaces: config.keyspaces || [],
      tables: config.tables || [],
      defaultConsistencyLevel: config.consistencyLevel || 'QUORUM',
      defaultReplicationFactor: config.replicationFactor || 3,
      datacenter: config.datacenter || 'dc1',
    });

    this.cassandraRoutingEngines.set(node.id, routingEngine);
  }

  /**
   * Initialize ClickHouse routing engine for a node
   */
  private initializeClickHouseRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;
    const routingEngine = new ClickHouseRoutingEngine();

    routingEngine.initialize({
      cluster: config.cluster || 'archiphoenix-cluster',
      replication: config.replication || false,
      tables: config.tables?.map((t: any) => ({
        name: t.name,
        database: config.database || 'default',
        engine: t.engine || 'MergeTree',
        rows: t.rows || 0,
        size: t.size || 0,
        partitions: t.partitions || 0,
        columns: t.columns || [],
      })) || [],
      maxMemoryUsage: config.maxMemoryUsage || 10 * 1024 * 1024 * 1024,
      compression: config.compression || 'LZ4',
    });

    this.clickHouseRoutingEngines.set(node.id, routingEngine);
  }

  private initializeSnowflakeRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;
    const routingEngine = new SnowflakeRoutingEngine();

    routingEngine.initialize({
      account: config.account || 'archiphoenix',
      region: config.region || 'us-east-1',
      warehouses: config.warehouses?.map((w: any) => ({
        name: w.name,
        size: w.size || 'Small',
        status: w.status || 'suspended',
        autoSuspend: w.autoSuspend || (config.enableAutoSuspend ? config.autoSuspendSeconds : undefined),
        autoResume: w.autoResume !== undefined ? w.autoResume : (config.enableAutoResume !== false),
        minClusterCount: w.minClusterCount || 1,
        maxClusterCount: w.maxClusterCount || 1,
        currentClusterCount: w.minClusterCount || 1,
        runningQueries: 0,
        queuedQueries: 0,
        totalQueriesExecuted: 0,
        totalComputeTime: 0,
      })) || [],
      databases: config.databases?.map((db: any) => ({
        name: db.name,
        comment: db.comment,
        retentionTime: db.retentionTime,
        size: db.size,
        schemas: db.schemas?.map((s: any) => ({
          name: s.name,
          tables: s.tables || [],
          views: s.views || 0,
          functions: s.functions || 0,
        })) || [],
      })) || [],
      role: config.role || 'ACCOUNTADMIN',
      enableAutoSuspend: config.enableAutoSuspend,
      autoSuspendSeconds: config.autoSuspendSeconds,
      enableAutoResume: config.enableAutoResume,
    });

    this.snowflakeRoutingEngines.set(node.id, routingEngine);
  }

  /**
   * Initialize Elasticsearch routing engine for a node
   */
  private initializeElasticsearchRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;
    const routingEngine = new ElasticsearchRoutingEngine();

    routingEngine.initialize({
      clusterName: config.clusterName || 'archiphoenix-cluster',
      nodes: config.nodes || ['localhost:9200'],
      indices: config.indices || [],
      defaultShards: config.shards || 5,
      defaultReplicas: config.replicas || 1,
      refreshInterval: config.refreshInterval || '1s',
      enableSSL: config.enableSSL ?? false,
      enableAuth: config.enableAuth ?? false,
      username: config.username || 'elastic',
      password: config.password || '',
    });

    this.elasticsearchRoutingEngines.set(node.id, routingEngine);
  }

  /**
   * Initialize S3 Routing Engine for S3 Data Lake node
   */
  private initializeS3RoutingEngine(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;
    const routingEngine = new S3RoutingEngine();

    // Convert UI bucket format to S3 routing engine format
    const buckets = (config.buckets || []).map((b: any) => ({
      name: b.name,
      region: b.region || config.defaultRegion || 'us-east-1',
      versioning: b.versioning || false,
      encryption: b.encryption || 'AES256',
      lifecycleEnabled: b.lifecycleEnabled || false,
      lifecycleDays: b.lifecycleDays,
      glacierEnabled: b.glacierEnabled || false,
      glacierDays: b.glacierDays,
      publicAccess: b.publicAccess || false,
      lifecycleRules: config.lifecycleRules || [], // Share lifecycle rules across buckets or use bucket-specific rules
    }));

    routingEngine.initialize({
      buckets: buckets,
      defaultRegion: config.defaultRegion || 'us-east-1',
    });

    this.s3RoutingEngines.set(node.id, routingEngine);
  }

  /**
   * Initialize PostgreSQL Connection Pool for a node
   */
  /**
   * Initialize Prometheus Emulation Engine for Prometheus node
   */
  private initializePrometheusEngine(node: CanvasNode): void {
    const prometheusEngine = new PrometheusEmulationEngine();
    prometheusEngine.initializeConfig(node);
    this.prometheusEngines.set(node.id, prometheusEngine);
  }

  /**
   * Initialize Grafana Emulation Engine for Grafana node
   */
  private initializeGrafanaEngine(node: CanvasNode): void {
    const grafanaEngine = new GrafanaEmulationEngine();
    grafanaEngine.initializeConfig(node);
    this.grafanaEngines.set(node.id, grafanaEngine);
  }

  /**
   * Проверяет доступность Prometheus для Grafana
   */
  private isPrometheusAvailableForGrafana(grafanaNode: CanvasNode): boolean {
    // Ищем связь Grafana -> Prometheus
    const grafanaToPrometheus = this.connections.find(
      conn => conn.source === grafanaNode.id && 
      this.nodes.find(n => n.id === conn.target)?.type === 'prometheus'
    );
    
    if (!grafanaToPrometheus) {
      return false;
    }
    
    // Проверяем, что Prometheus node существует и имеет метрики
    const prometheusNode = this.nodes.find(n => n.id === grafanaToPrometheus.target);
    if (!prometheusNode) {
      return false;
    }
    
    // Проверяем, что Prometheus имеет engine и работает
    const prometheusEngine = this.prometheusEngines.get(prometheusNode.id);
    if (!prometheusEngine) {
      return false;
    }
    
    // Проверяем метрики Prometheus (если error rate высокий, считаем недоступным)
    const prometheusMetrics = this.metrics.get(prometheusNode.id);
    if (prometheusMetrics && prometheusMetrics.errorRate > 0.5) {
      return false;
    }
    
    return true;
  }

  private initializePostgreSQLConnectionPool(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;
    
    const poolConfig: ConnectionPoolConfig = {
      maxConnections: config.maxConnections || 100,
      minConnections: config.minConnections || 0,
      idleTimeout: config.idleTimeout || 300000,
      maxLifetime: config.maxLifetime || 3600000,
      connectionTimeout: config.connectionTimeout || 5000,
    };
    
    const pool = new PostgreSQLConnectionPool(poolConfig);
    this.postgresConnectionPools.set(node.id, pool);
  }

  /**
   * Update Elasticsearch metrics in node config (for UI display)
   */
  private updateElasticsearchMetricsInConfig(
    node: CanvasNode,
    metrics: {
      clusterHealth: 'green' | 'yellow' | 'red';
      totalIndices: number;
      totalDocs: number;
      totalSize: number;
      activeShards: number;
      relocatingShards: number;
      initializingShards: number;
    }
  ): void {
    const config = (node.data.config as any) || {};
    
    // Update cluster health
    config.clusterHealth = metrics.clusterHealth;
    
    // Update shard metrics
    config.activeShards = metrics.activeShards;
    config.relocatingShards = metrics.relocatingShards;
    config.initializingShards = metrics.initializingShards;
    
    // Update indices with runtime metrics
    const indices = config.indices || [];
    const engineIndices = this.elasticsearchRoutingEngines.get(node.id)?.getIndices() || [];
    
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i];
      const engineIndex = engineIndices.find(ei => ei.name === index.name);
      if (engineIndex) {
        indices[i] = {
          ...index,
          docs: engineIndex.docs,
          size: engineIndex.size,
          health: engineIndex.health,
        };
      }
    }
    
    config.indices = indices;
    config.totalDocs = metrics.totalDocs;
    config.totalSize = metrics.totalSize;
  }

  /**
   * Update S3 bucket metrics in node config (for UI display)
   */
  private updateS3BucketMetricsInConfig(
    node: CanvasNode,
    bucketMetrics: Map<string, { bucket: string; objectCount: number; totalSize: number; versionsCount: number; putCount: number; getCount: number; deleteCount: number; listCount: number; errorCount: number; averageLatency: number; lastOperation?: number }>
  ): void {
    const config = (node.data.config as any) || {};
    const buckets = config.buckets || [];
    
    // Update buckets with runtime metrics
    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];
      const metrics = bucketMetrics.get(bucket.name);
      if (metrics) {
        buckets[i] = {
          ...bucket,
          objectCount: metrics.objectCount,
          totalSize: metrics.totalSize,
        };
      }
    }
    
    config.buckets = buckets;
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
   * Calculate cache hit ratio for PostgreSQL
   * Returns a value between 0 and 1 representing the cache hit ratio
   */
  private calculateCacheHitRatio(node: CanvasNode, queriesPerSecond: number): number {
    // Base cache hit ratio depends on query patterns and workload
    // Higher query throughput with repeated patterns = better cache hit ratio
    // Very high throughput might overwhelm cache = lower hit ratio
    
    // Base cache hit ratio (typical PostgreSQL shared_buffers cache hit ratio is 95-99%)
    let baseRatio = 0.95;
    
    // Adjust based on query throughput
    // Moderate throughput (100-1000 qps) = optimal cache utilization
    if (queriesPerSecond > 0 && queriesPerSecond < 100) {
      // Low throughput: cache might not be fully utilized
      baseRatio = 0.90 + Math.random() * 0.05; // 90-95%
    } else if (queriesPerSecond >= 100 && queriesPerSecond < 1000) {
      // Moderate throughput: optimal cache utilization
      baseRatio = 0.95 + Math.random() * 0.04; // 95-99%
    } else if (queriesPerSecond >= 1000) {
      // High throughput: cache might be overwhelmed
      baseRatio = 0.92 + Math.random() * 0.05; // 92-97%
    }
    
    // Add some variation based on simulation time (cache warming effect)
    const timeVariation = Math.sin(this.simulationTime / 10000) * 0.02; // ±2% variation
    
    // Ensure ratio stays within reasonable bounds (85-99%)
    return Math.max(0.85, Math.min(0.99, baseRatio + timeVariation));
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

  public getSQSRoutingEngine(nodeId: string): SQSRoutingEngine | undefined {
    return this.sqsRoutingEngines.get(nodeId);
  }

  public getAzureServiceBusRoutingEngine(nodeId: string): AzureServiceBusRoutingEngine | undefined {
    return this.azureServiceBusRoutingEngines.get(nodeId);
  }

  public getPubSubRoutingEngine(nodeId: string): PubSubRoutingEngine | undefined {
    return this.pubSubRoutingEngines.get(nodeId);
  }

  /**
   * Get Redis routing engine for a node
   */
  public getRedisRoutingEngine(nodeId: string): RedisRoutingEngine | undefined {
    return this.redisRoutingEngines.get(nodeId);
  }

  /**
   * Get Cassandra routing engine for a node
   */
  public getCassandraRoutingEngine(nodeId: string): CassandraRoutingEngine | undefined {
    return this.cassandraRoutingEngines.get(nodeId);
  }

  /**
   * Get ClickHouse routing engine for a node
   */
  public getClickHouseRoutingEngine(nodeId: string): ClickHouseRoutingEngine | undefined {
    return this.clickHouseRoutingEngines.get(nodeId);
  }

  /**
   * Get Snowflake routing engine for a node
   */
  public getSnowflakeRoutingEngine(nodeId: string): SnowflakeRoutingEngine | undefined {
    return this.snowflakeRoutingEngines.get(nodeId);
  }

  public getElasticsearchRoutingEngine(nodeId: string): ElasticsearchRoutingEngine | undefined {
    return this.elasticsearchRoutingEngines.get(nodeId);
  }

  /**
   * Get Kong routing engine for a node
   */
  public getKongRoutingEngine(nodeId: string): KongRoutingEngine | undefined {
    return this.kongRoutingEngines.get(nodeId);
  }

  /**
   * Get Apigee routing engine for a node
   */
  public getApigeeRoutingEngine(nodeId: string): ApigeeRoutingEngine | undefined {
    return this.apigeeRoutingEngines.get(nodeId);
  }

  /**
   * Get MuleSoft routing engine for a node
   */
  public getMuleSoftRoutingEngine(nodeId: string): MuleSoftRoutingEngine | undefined {
    return this.mulesoftRoutingEngines.get(nodeId);
  }

  /**
   * Get GraphQL Gateway routing engine for a node
   */
  public getGraphQLGatewayRoutingEngine(nodeId: string): GraphQLGatewayRoutingEngine | undefined {
    return this.graphQLGatewayRoutingEngines.get(nodeId);
  }

  /**
   * Get BFF routing engine for a node
   */
  public getBFFRoutingEngine(nodeId: string): BFFRoutingEngine | undefined {
    return this.bffRoutingEngines.get(nodeId);
  }

  /**
   * Get Webhook Relay routing engine for a node
   */
  public getWebhookRelayRoutingEngine(nodeId: string): WebhookRelayRoutingEngine | undefined {
    return this.webhookRelayRoutingEngines.get(nodeId);
  }

  /**
   * Check SQS IAM policy permission (public method for DataFlowEngine)
   */
  public checkSQSIAMPolicy(
    policies: Array<{
      id: string;
      principal: string;
      action: string;
      resource: string;
      effect: 'Allow' | 'Deny';
    }>,
    principal: string,
    queueName: string,
    action: string
  ): boolean {
    if (!policies || policies.length === 0) {
      return true; // No policies configured, default allow
    }
    
    // Find matching policies
    const matchingPolicies = policies.filter((policy) => {
      // Check principal match (supports wildcard *)
      const policyPrincipal = policy.principal || '';
      if (policyPrincipal !== principal && policyPrincipal !== '*' && !principal.includes(policyPrincipal)) {
        return false;
      }
      
      // Check resource match (supports wildcard * and ARN patterns)
      const policyResource = policy.resource || '';
      let resourceMatches = false;
      
      if (policyResource === '*' || policyResource === queueName) {
        resourceMatches = true;
      } else if (policyResource.endsWith('*')) {
        // Pattern match: "arn:aws:sqs:*:*:orders-*" matches "orders-queue"
        const prefix = policyResource.slice(0, -1);
        resourceMatches = queueName.startsWith(prefix.replace(/.*:/, '')); // Extract queue name from ARN
      } else if (policyResource.includes('sqs:') || policyResource.includes('arn:aws:sqs')) {
        // ARN format: extract queue name
        const arnQueueName = policyResource.split(':').pop() || policyResource.split('/').pop() || '';
        resourceMatches = arnQueueName === queueName || arnQueueName === '*' || queueName.includes(arnQueueName);
      } else {
        // Simple name match
        resourceMatches = queueName.includes(policyResource) || policyResource === '*';
      }
      
      if (!resourceMatches) {
        return false;
      }
      
      // Check action match (supports wildcard *)
      const policyAction = policy.action || '';
      if (policyAction !== action && policyAction !== '*' && !policyAction.includes(action)) {
        return false;
      }
      
      return true;
    });
    
    if (matchingPolicies.length === 0) {
      // No matching policies - default allow (if policies are configured but none match, allow)
      return true;
    }
    
    // AWS IAM logic: Deny takes precedence over Allow
    const denyPolicies = matchingPolicies.filter((policy) => policy.effect === 'Deny');
    if (denyPolicies.length > 0) {
      return false; // Denied
    }
    
    const allowPolicies = matchingPolicies.filter((policy) => policy.effect === 'Allow');
    if (allowPolicies.length > 0) {
      return true; // Allowed
    }
    
    // Default: allow if no explicit deny
    return true;
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

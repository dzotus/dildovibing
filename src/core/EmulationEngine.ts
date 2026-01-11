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
import { NginxRoutingEngine } from './NginxRoutingEngine';
import { HAProxyRoutingEngine } from './HAProxyRoutingEngine';
import { EnvoyRoutingEngine } from './EnvoyRoutingEngine';
import { GraphQLGatewayRoutingEngine } from './GraphQLGatewayRoutingEngine';
import { BFFRoutingEngine } from './BFFRoutingEngine';
import { RestApiRoutingEngine } from './RestApiRoutingEngine';
import { GRPCRoutingEngine } from './GRPCRoutingEngine';
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
import { LokiEmulationEngine } from './LokiEmulationEngine';
import { JaegerEmulationEngine } from './JaegerEmulationEngine';
import { GraphQLEmulationEngine } from './GraphQLEmulationEngine';
import { SOAPEmulationEngine } from './SOAPEmulationEngine';
import { WebSocketEmulationEngine } from './WebSocketEmulationEngine';
import { OpenTelemetryCollectorRoutingEngine } from './OpenTelemetryCollectorRoutingEngine';
import { PagerDutyEmulationEngine, PagerDutyIncident, PagerDutyEngineMetrics } from './PagerDutyEmulationEngine';
import { alertSystem } from './AlertSystem';
import { KeycloakEmulationEngine } from './KeycloakEmulationEngine';
import { WAFEmulationEngine } from './WAFEmulationEngine';
import { FirewallEmulationEngine } from './FirewallEmulationEngine';
import { IDSIPSEmulationEngine } from './IDSIPSEmulationEngine';
import { VaultEmulationEngine } from './VaultEmulationEngine';
import { VPNEmulationEngine } from './VPNEmulationEngine';
import { CDNEmulationEngine } from './CDNEmulationEngine';
import { JenkinsEmulationEngine } from './JenkinsEmulationEngine';
import { GitLabCIEmulationEngine } from './GitLabCIEmulationEngine';
import { ArgoCDEmulationEngine } from './ArgoCDEmulationEngine';
import { TerraformEmulationEngine } from './TerraformEmulationEngine';
import { HarborEmulationEngine } from './HarborEmulationEngine';
import { DockerEmulationEngine } from './DockerEmulationEngine';
import { KubernetesEmulationEngine } from './KubernetesEmulationEngine';
import { AnsibleEmulationEngine } from './AnsibleEmulationEngine';
import { TraefikEmulationEngine } from './TraefikEmulationEngine';
import { IstioRoutingEngine } from './IstioRoutingEngine';
import { ServiceMeshRoutingEngine } from './ServiceMeshRoutingEngine';
import { errorCollector } from './ErrorCollector';
import { CloudAPIGatewayEmulationEngine } from './api-gateway/CloudAPIGatewayEmulationEngine';
import type { BaseAPIGatewayConfig } from './api-gateway/types';

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
  
  // Cloud API Gateway emulation engines per node
  private cloudAPIGatewayEngines: Map<string, CloudAPIGatewayEmulationEngine> = new Map();
  
  // NGINX routing engines per node
  private nginxRoutingEngines: Map<string, NginxRoutingEngine> = new Map();
  
  // HAProxy routing engines per node
  private haproxyRoutingEngines: Map<string, HAProxyRoutingEngine> = new Map();
  
  // Envoy Proxy routing engines per node
  private envoyRoutingEngines: Map<string, EnvoyRoutingEngine> = new Map();
  
  // Istio Service Mesh routing engines per node
  private istioRoutingEngines: Map<string, IstioRoutingEngine> = new Map();
  
  // Service Mesh routing engines per node
  private serviceMeshRoutingEngines: Map<string, ServiceMeshRoutingEngine> = new Map();
  
  // Apigee Gateway routing engines per node
  private apigeeRoutingEngines: Map<string, ApigeeRoutingEngine> = new Map();
  
  // MuleSoft routing engines per node
  private mulesoftRoutingEngines: Map<string, MuleSoftRoutingEngine> = new Map();

  // GraphQL Gateway routing engines per node
  private graphQLGatewayRoutingEngines: Map<string, GraphQLGatewayRoutingEngine> = new Map();
  private lastGraphQLGatewayUpdate: Map<string, number> = new Map();

  // BFF Service routing engines per node
  private bffRoutingEngines: Map<string, BFFRoutingEngine> = new Map();

  // REST API routing engines per node
  private restApiRoutingEngines: Map<string, RestApiRoutingEngine> = new Map();

  // gRPC routing engines per node
  private grpcRoutingEngines: Map<string, GRPCRoutingEngine> = new Map();

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

  // GraphQL emulation engines per node
  private graphQLEngines: Map<string, GraphQLEmulationEngine> = new Map();
  
  // SOAP emulation engines per node
  private soapEngines: Map<string, SOAPEmulationEngine> = new Map();
  
  // WebSocket emulation engines per node
  private websocketEngines: Map<string, WebSocketEmulationEngine> = new Map();

  // Loki emulation engines per node
  private lokiEngines: Map<string, LokiEmulationEngine> = new Map();
  
  // Jaeger emulation engines per node
  private jaegerEngines: Map<string, JaegerEmulationEngine> = new Map();
  
  // OpenTelemetry Collector routing engines per node
  private otelCollectorEngines: Map<string, OpenTelemetryCollectorRoutingEngine> = new Map();

  // PagerDuty emulation engines per node
  private pagerDutyEngines: Map<string, PagerDutyEmulationEngine> = new Map();

  // Keycloak emulation engines per node
  private keycloakEngines: Map<string, KeycloakEmulationEngine> = new Map();

  // Vault emulation engines per node
  private vaultEngines: Map<string, VaultEmulationEngine> = new Map();

  // WAF emulation engines per node
  private wafEngines: Map<string, WAFEmulationEngine> = new Map();

  // Firewall emulation engines per node
  private firewallEngines: Map<string, FirewallEmulationEngine> = new Map();

  // VPN emulation engines per node
  private vpnEngines: Map<string, VPNEmulationEngine> = new Map();

  // CDN emulation engines per node
  private cdnEngines: Map<string, CDNEmulationEngine> = new Map();

  // IDS/IPS emulation engines per node
  private idsIpsEngines: Map<string, IDSIPSEmulationEngine> = new Map();

  // Jenkins emulation engines per node
  private jenkinsEngines: Map<string, JenkinsEmulationEngine> = new Map();

  // GitLab CI emulation engines per node
  private gitlabCIEngines: Map<string, GitLabCIEmulationEngine> = new Map();

  // Argo CD emulation engines per node
  private argoCDEngines: Map<string, ArgoCDEmulationEngine> = new Map();

  // Terraform emulation engines per node
  private terraformEngines: Map<string, TerraformEmulationEngine> = new Map();

  // Harbor emulation engines per node
  private harborEngines: Map<string, HarborEmulationEngine> = new Map();

  // Docker emulation engines per node
  private dockerEngines: Map<string, DockerEmulationEngine> = new Map();

  // Kubernetes emulation engines per node
  private kubernetesEngines: Map<string, KubernetesEmulationEngine> = new Map();

  // Ansible emulation engines per node
  private ansibleEngines: Map<string, AnsibleEmulationEngine> = new Map();

  // Traefik emulation engines per node
  private traefikEngines: Map<string, TraefikEmulationEngine> = new Map();

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
        if (node.type === 'api-gateway') {
          this.initializeCloudAPIGatewayEngine(node);
        }
        if (node.type === 'nginx') {
          this.initializeNginxRoutingEngine(node);
        }
        if (node.type === 'haproxy') {
          this.initializeHAProxyRoutingEngine(node);
        }
        if (node.type === 'envoy') {
          this.initializeEnvoyRoutingEngine(node);
        }
        if (node.type === 'istio') {
          this.initializeIstioRoutingEngine(node);
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
        if (node.type === 'rest') {
          this.initializeRestApiRoutingEngine(node);
        }
        if (node.type === 'grpc') {
          this.initializeGRPCRoutingEngine(node);
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
        if (node.type === 'graphql') {
          this.initializeGraphQLEngine(node);
        }
        if (node.type === 'jaeger') {
          this.initializeJaegerEngine(node);
        }
        if (node.type === 'otel-collector') {
          this.initializeOpenTelemetryCollectorEngine(node);
        }
        if (node.type === 'pagerduty') {
          this.initializePagerDutyEngine(node);
        }
        if (node.type === 'keycloak') {
          try {
            this.initializeKeycloakEngine(node);
          } catch (error) {
            errorCollector.addError(error as Error, {
              severity: 'critical',
              source: 'initialization',
              componentId: node.id,
              componentLabel: node.data.label,
              componentType: node.type,
              context: { operation: 'initializeKeycloakEngine' },
            });
          }
        }
        if (node.type === 'secrets-vault') {
          try {
            this.initializeVaultEngine(node);
          } catch (error) {
            errorCollector.addError(error as Error, {
              severity: 'critical',
              source: 'initialization',
              componentId: node.id,
              componentLabel: node.data.label,
              componentType: node.type,
              context: { operation: 'initializeVaultEngine' },
            });
          }
        }
        if (node.type === 'waf') {
          try {
            this.initializeWAFEngine(node);
          } catch (error) {
            errorCollector.addError(error as Error, {
              severity: 'critical',
              source: 'initialization',
              componentId: node.id,
              componentLabel: node.data.label,
              componentType: node.type,
              context: { operation: 'initializeWAFEngine' },
            });
          }
        }
        if (node.type === 'firewall') {
          try {
            this.initializeFirewallEngine(node);
          } catch (error) {
            errorCollector.addError(error as Error, {
              severity: 'critical',
              source: 'initialization',
              componentId: node.id,
              componentLabel: node.data.label,
              componentType: node.type,
              context: { operation: 'initializeFirewallEngine' },
            });
          }
        }
        if (node.type === 'ids-ips') {
          try {
            this.initializeIDSIPSEngine(node);
          } catch (error) {
            errorCollector.addError(error as Error, {
              severity: 'critical',
              source: 'initialization',
              componentId: node.id,
              componentLabel: node.data.label,
              componentType: node.type,
              context: { operation: 'initializeIDSIPSEngine' },
            });
          }
        }
        if (node.type === 'jenkins') {
          this.initializeJenkinsEngine(node);
        }
        if (node.type === 'gitlab-ci') {
          this.initializeGitLabCIEngine(node);
        }
        if (node.type === 'argo-cd') {
          this.initializeArgoCDEngine(node);
        }
        if (node.type === 'terraform') {
          this.initializeTerraformEngine(node);
        }
        if (node.type === 'ansible') {
          if (!this.ansibleEngines.has(node.id)) {
            this.initializeAnsibleEngine(node);
          } else {
            // Update config if engine already exists
            const engine = this.ansibleEngines.get(node.id)!;
            engine.updateConfig(node);
          }
        }
        // Initialize Harbor emulation engine for Harbor nodes
        if (node.type === 'harbor') {
          if (!this.harborEngines.has(node.id)) {
            this.initializeHarborEngine(node);
          } else {
            // Update config if engine already exists
            const engine = this.harborEngines.get(node.id)!;
            engine.updateConfig(node);
          }
        }
        if (node.type === 'docker') {
          if (!this.dockerEngines.has(node.id)) {
            this.initializeDockerEngine(node);
          } else {
            // Update config if engine already exists
            const engine = this.dockerEngines.get(node.id)!;
            engine.updateConfig(node);
          }
        }
        if (node.type === 'kubernetes') {
          if (!this.kubernetesEngines.has(node.id)) {
            this.initializeKubernetesEngine(node);
          } else {
            // Update config if engine already exists
            const engine = this.kubernetesEngines.get(node.id)!;
            engine.updateConfig(node);
          }
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
      
      // Initialize NGINX routing engine for NGINX nodes
      if (node.type === 'nginx') {
        this.initializeNginxRoutingEngine(node);
      }
      
      // Initialize HAProxy routing engine for HAProxy nodes
      if (node.type === 'haproxy') {
        this.initializeHAProxyRoutingEngine(node);
      }
      
      // Initialize Envoy routing engine for Envoy Proxy nodes
      if (node.type === 'envoy') {
        this.initializeEnvoyRoutingEngine(node);
      }
      
      // Initialize Istio routing engine for Istio Service Mesh nodes
      if (node.type === 'istio') {
        this.initializeIstioRoutingEngine(node);
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

      // Initialize REST API routing engine for REST API nodes
      // Always reinitialize to pick up config changes
      if (node.type === 'rest') {
        this.initializeRestApiRoutingEngine(node);
      }

      // Initialize gRPC routing engine for gRPC nodes
      // Always reinitialize to pick up config changes
      if (node.type === 'grpc') {
        this.initializeGRPCRoutingEngine(node);
      }

      // Initialize GraphQL emulation engine for GraphQL nodes
      // Always reinitialize to pick up config changes
      if (node.type === 'graphql') {
        if (!this.graphQLEngines.has(node.id)) {
          this.initializeGraphQLEngine(node);
        } else {
          const engine = this.graphQLEngines.get(node.id)!;
          engine.updateConfig((node.data.config || {}) as any);
        }
      }

      // Initialize SOAP emulation engine for SOAP nodes
      // Always reinitialize to pick up config changes
      if (node.type === 'soap') {
        if (!this.soapEngines.has(node.id)) {
          this.initializeSOAPEngine(node);
        } else {
          const engine = this.soapEngines.get(node.id)!;
          engine.updateConfig((node.data.config || {}) as any);
        }
      }

      // Initialize WebSocket emulation engine for WebSocket nodes
      // Always reinitialize to pick up config changes
      if (node.type === 'websocket') {
        if (!this.websocketEngines.has(node.id)) {
          this.initializeWebSocketEngine(node);
        } else {
          const engine = this.websocketEngines.get(node.id)!;
          engine.updateConfig((node.data.config || {}) as any);
        }
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
      
      // Initialize WAF emulation engine for WAF nodes
      if (node.type === 'waf') {
        try {
          if (!this.wafEngines.has(node.id)) {
            this.initializeWAFEngine(node);
          } else {
            const engine = this.wafEngines.get(node.id)!;
            engine.initializeConfig(node);
          }
        } catch (error) {
          errorCollector.addError(error as Error, {
            severity: 'critical',
            source: 'initialization',
            componentId: node.id,
            componentLabel: node.data.label,
            componentType: node.type,
            context: { operation: 'initializeWAFEngine' },
          });
        }
      }
      
      // Initialize Firewall emulation engine for Firewall nodes
      if (node.type === 'firewall') {
        try {
          if (!this.firewallEngines.has(node.id)) {
            this.initializeFirewallEngine(node);
          } else {
            const engine = this.firewallEngines.get(node.id)!;
            engine.initializeConfig(node); // FirewallEmulationEngine uses initializeConfig for updates
          }
        } catch (error) {
          errorCollector.addError(error as Error, {
            severity: 'critical',
            source: 'initialization',
            componentId: node.id,
            componentLabel: node.data.label,
            componentType: node.type,
            context: { operation: 'initializeFirewallEngine' },
          });
        }
      }
      
      // Initialize VPN emulation engine for VPN nodes
      if (node.type === 'vpn') {
        try {
          if (!this.vpnEngines.has(node.id)) {
            this.initializeVPNEngine(node);
          } else {
            const engine = this.vpnEngines.get(node.id)!;
            engine.initializeConfig(node); // VPNEmulationEngine uses initializeConfig for updates
          }
        } catch (error) {
          errorCollector.addError(error as Error, {
            severity: 'critical',
            source: 'initialization',
            componentId: node.id,
            componentLabel: node.data.label,
            componentType: node.type,
            context: { operation: 'initializeVPNEngine' },
          });
        }
      }
      
      // Initialize IDS/IPS emulation engine for IDS/IPS nodes
      if (node.type === 'ids-ips') {
        try {
          if (!this.idsIpsEngines.has(node.id)) {
            this.initializeIDSIPSEngine(node);
          } else {
            const engine = this.idsIpsEngines.get(node.id)!;
            engine.initializeConfig(node);
          }
        } catch (error) {
          errorCollector.addError(error as Error, {
            severity: 'critical',
            source: 'initialization',
            componentId: node.id,
            componentLabel: node.data.label,
            componentType: node.type,
            context: { operation: 'initializeIDSIPSEngine' },
          });
        }
      }
      
      // Initialize Jenkins emulation engine for Jenkins nodes
      if (node.type === 'jenkins') {
        if (!this.jenkinsEngines.has(node.id)) {
          this.initializeJenkinsEngine(node);
        } else {
          // Update config if engine already exists
          const engine = this.jenkinsEngines.get(node.id)!;
          engine.updateConfig(node);
        }
      }
      
      // Initialize GitLab CI emulation engine for GitLab CI nodes
      if (node.type === 'gitlab-ci') {
        if (!this.gitlabCIEngines.has(node.id)) {
          this.initializeGitLabCIEngine(node);
        } else {
          // Update config if engine already exists
          const engine = this.gitlabCIEngines.get(node.id)!;
          engine.updateConfig(node);
        }
      }
      
      // Initialize Argo CD emulation engine for Argo CD nodes
      if (node.type === 'argo-cd') {
        if (!this.argoCDEngines.has(node.id)) {
          this.initializeArgoCDEngine(node);
        } else {
          // Update config if engine already exists
          const engine = this.argoCDEngines.get(node.id)!;
          engine.initializeConfig(node);
        }
      }
      
      // Initialize Terraform emulation engine for Terraform nodes
      if (node.type === 'terraform') {
        if (!this.terraformEngines.has(node.id)) {
          this.initializeTerraformEngine(node);
        } else {
          // Update config if engine already exists
          const engine = this.terraformEngines.get(node.id)!;
          engine.updateConfig(node);
        }
      }
      
      // Initialize Ansible emulation engine for Ansible nodes
      if (node.type === 'ansible') {
        if (!this.ansibleEngines.has(node.id)) {
          this.initializeAnsibleEngine(node);
        } else {
          // Update config if engine already exists
          const engine = this.ansibleEngines.get(node.id)!;
          engine.updateConfig(node);
        }
      }
      
      // Initialize Traefik emulation engine for Traefik nodes
      if (node.type === 'traefik') {
        if (!this.traefikEngines.has(node.id)) {
          this.initializeTraefikEngine(node);
        } else {
          // Update config if engine already exists
          const engine = this.traefikEngines.get(node.id)!;
          engine.updateConfig(node);
        }
      }
      
      // Initialize CDN emulation engine for CDN nodes
      if (node.type === 'cdn') {
        try {
          if (!this.cdnEngines.has(node.id)) {
            this.initializeCDNEngine(node);
          } else {
            const engine = this.cdnEngines.get(node.id)!;
            engine.initializeConfig(node);
          }
        } catch (error) {
          errorCollector.addError(error as Error, {
            severity: 'critical',
            source: 'initialization',
            componentId: node.id,
            componentLabel: node.data.label,
            componentType: node.type,
            context: { operation: 'initializeCDNEngine' },
          });
        }
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
        this.nginxRoutingEngines.delete(nodeId);
        this.haproxyRoutingEngines.delete(nodeId);
        this.envoyRoutingEngines.delete(nodeId);
        this.istioRoutingEngines.delete(nodeId);
        this.apigeeRoutingEngines.delete(nodeId);
        this.mulesoftRoutingEngines.delete(nodeId);
        this.graphQLGatewayRoutingEngines.delete(nodeId);
        this.bffRoutingEngines.delete(nodeId);
        this.restApiRoutingEngines.delete(nodeId);
        this.grpcRoutingEngines.delete(nodeId);
        this.webhookRelayRoutingEngines.delete(nodeId);
        this.redisRoutingEngines.delete(nodeId);
        this.cassandraRoutingEngines.delete(nodeId);
        this.clickHouseRoutingEngines.delete(nodeId);
        this.snowflakeRoutingEngines.delete(nodeId);
        this.elasticsearchRoutingEngines.delete(nodeId);
        this.s3RoutingEngines.delete(nodeId);
        this.graphQLGatewayRoutingEngines.delete(nodeId);
        this.keycloakEngines.delete(nodeId);
        this.vaultEngines.delete(nodeId);
        this.wafEngines.delete(nodeId);
        this.firewallEngines.delete(nodeId);
        this.vpnEngines.delete(nodeId);
        this.cdnEngines.delete(nodeId);
        this.idsIpsEngines.delete(nodeId);
        this.jenkinsEngines.delete(nodeId);
        this.gitlabCIEngines.delete(nodeId);
        this.argoCDEngines.delete(nodeId);
        this.terraformEngines.delete(nodeId);
        this.ansibleEngines.delete(nodeId);
        this.traefikEngines.delete(nodeId);
        this.harborEngines.delete(nodeId);
        this.prometheusEngines.delete(nodeId);
        this.grafanaEngines.delete(nodeId);
        this.graphQLEngines.delete(nodeId);
        this.soapEngines.delete(nodeId);
        this.websocketEngines.delete(nodeId);
        this.lokiEngines.delete(nodeId);
        this.jaegerEngines.delete(nodeId);
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
    console.log('EmulationEngine.start() called', { isRunning: this.isRunning, hasInterval: !!this.intervalId });
    
    // If already running but interval is missing, stop first to fix inconsistent state
    if (this.isRunning && !this.intervalId) {
      console.log('Inconsistent state detected: isRunning=true but no interval, stopping first...');
      this.stop();
    }
    
    if (this.isRunning) {
      console.log('Already running, returning early');
      return;
    }
    
    console.log('Setting isRunning to true and creating interval...');
    this.isRunning = true;
    // Continue from where we paused, not from 0
    this.baseTime = Date.now() - this.pausedTime;
    
    // Start data flow engine
    console.log('Starting data flow engine...');
    dataFlowEngine.start();
    
    console.log('Creating simulation interval...');
    this.intervalId = setInterval(() => {
      try {
        this.simulate();
      } catch (error) {
        console.error('Error in simulation step:', error);
        // Записываем ошибку в ErrorCollector
        errorCollector.addError(error as Error, {
          severity: 'critical',
          source: 'emulation-engine',
          context: { simulationTime: this.simulationTime },
        });
        // Don't stop simulation on error, just log it
      }
    }, this.updateInterval);
    
    console.log('EmulationEngine.start() complete', { intervalId: !!this.intervalId });
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

    // Analyze system alerts based on fresh metrics
    try {
      alertSystem.analyze(
        this.nodes,
        this.metrics,
        this.connectionMetrics,
        [] // dependency statuses are provided from DependencyGraphEngine in UI layer
      );
    } catch (error) {
      errorCollector.addError(error as Error, {
        severity: 'critical',
        source: 'alert-system',
        context: { operation: 'analyze' },
      });
    }

    const currentAlerts = alertSystem.getAlerts();

    // Feed alerts into PagerDuty engines and advance incident lifecycle
    for (const [nodeId, pagerDutyEngine] of this.pagerDutyEngines.entries()) {
      pagerDutyEngine.processAlerts(now, currentAlerts);
      pagerDutyEngine.advanceTime(now);
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
        
        // Создаем функцию для выполнения LogQL queries через Loki
        const lokiQueryExecutor = this.createLokiQueryExecutor(grafanaNode);
        
        grafanaEngine.performUpdate(now, prometheusAvailable, lokiQueryExecutor);
      }
    }
    
    // Perform Loki retention (cleanup old logs)
    for (const [nodeId, lokiEngine] of this.lokiEngines.entries()) {
      lokiEngine.performRetention(now);
    }
    
    // Perform Jaeger cleanup (TTL and trace limits)
    for (const [nodeId, jaegerEngine] of this.jaegerEngines.entries()) {
      jaegerEngine.performCleanup(now);
    }
    
    // Perform Jenkins updates (builds, pipelines, executors)
    for (const [nodeId, jenkinsEngine] of this.jenkinsEngines.entries()) {
      try {
        const node = this.nodes.find(n => n.id === nodeId);
        jenkinsEngine.performUpdate(now);
        
        // Update component metrics based on Jenkins metrics
        const jenkinsMetrics = jenkinsEngine.calculateComponentMetrics();
        const componentMetrics = this.metrics.get(nodeId);
        if (componentMetrics && jenkinsMetrics) {
          componentMetrics.throughput = jenkinsMetrics.throughput || componentMetrics.throughput;
          componentMetrics.latency = jenkinsMetrics.latency || componentMetrics.latency;
          componentMetrics.utilization = (jenkinsMetrics.utilization || 0) / 100; // Convert to 0-1
          componentMetrics.errorRate = (jenkinsMetrics.errorRate || 0) / 100; // Convert to 0-1
          componentMetrics.timestamp = now;
        }
      } catch (error) {
        const node = this.nodes.find(n => n.id === nodeId);
        errorCollector.addError(error as Error, {
          severity: 'warning',
          source: 'component-engine',
          componentId: nodeId,
          componentLabel: node?.data.label,
          componentType: node?.type,
          context: { engine: 'jenkins', operation: 'performUpdate' },
        });
      }
    }
    
    // Perform GitLab CI updates (pipelines, jobs, runners)
    for (const [nodeId, gitlabCIEngine] of this.gitlabCIEngines.entries()) {
      try {
        const node = this.nodes.find(n => n.id === nodeId);
        gitlabCIEngine.performUpdate(now);
        
        // Update component metrics based on GitLab CI metrics
        const gitlabMetrics = gitlabCIEngine.getMetrics();
        const componentMetrics = this.metrics.get(nodeId);
        if (componentMetrics && gitlabMetrics) {
          // Throughput: pipelines per hour converted to per second
          componentMetrics.throughput = gitlabMetrics.pipelinesPerHour / 3600;
          // Latency: average pipeline duration
          componentMetrics.latency = gitlabMetrics.averagePipelineDuration || 0;
          // Error rate: failed pipelines / total pipelines
          const totalPipelines = gitlabMetrics.pipelinesSuccess + gitlabMetrics.pipelinesFailed;
          componentMetrics.errorRate = totalPipelines > 0 ? gitlabMetrics.pipelinesFailed / totalPipelines : 0;
          // Utilization: running pipelines / total pipelines
          componentMetrics.utilization = gitlabMetrics.pipelinesTotal > 0 
            ? gitlabMetrics.pipelinesRunning / gitlabMetrics.pipelinesTotal 
            : 0;
          componentMetrics.customMetrics = {
            pipelinesTotal: gitlabMetrics.pipelinesTotal,
            pipelinesRunning: gitlabMetrics.pipelinesRunning,
            jobsRunning: gitlabMetrics.jobsRunning,
            runnersOnline: gitlabMetrics.runnersOnline,
          };
        }
      } catch (error) {
        const node = this.nodes.find(n => n.id === nodeId);
        errorCollector.addError(error as Error, {
          severity: 'warning',
          source: 'component-engine',
          componentId: nodeId,
          componentLabel: node?.data.label,
          componentType: node?.type,
          context: { engine: 'gitlab-ci', operation: 'performUpdate' },
        });
      }
    }
    
    // Perform Argo CD updates (applications, sync operations, health checks)
    for (const [nodeId, argoCDEngine] of this.argoCDEngines.entries()) {
      try {
        const node = this.nodes.find(n => n.id === nodeId);
        argoCDEngine.performUpdate(now);
        
        // Update component metrics based on Argo CD metrics
        const argoMetrics = argoCDEngine.getMetrics();
        const componentMetrics = this.metrics.get(nodeId);
        if (componentMetrics && argoMetrics) {
          // Throughput: sync operations per hour converted to per second
          componentMetrics.throughput = argoMetrics.syncRate / 3600;
          // Latency: average sync duration
          componentMetrics.latency = argoMetrics.averageSyncDuration || 0;
          // Error rate: failed syncs / total syncs
          const totalSyncs = argoMetrics.syncOperationsSuccess + argoMetrics.syncOperationsFailed;
          componentMetrics.errorRate = totalSyncs > 0 
            ? argoMetrics.syncOperationsFailed / totalSyncs 
            : 0;
          // Utilization: running syncs / total applications
          componentMetrics.utilization = argoMetrics.applicationsTotal > 0
            ? argoMetrics.syncOperationsRunning / argoMetrics.applicationsTotal
            : 0;
          componentMetrics.customMetrics = {
            applicationsTotal: argoMetrics.applicationsTotal,
            applicationsSynced: argoMetrics.applicationsSynced,
            applicationsOutOfSync: argoMetrics.applicationsOutOfSync,
            syncOperationsRunning: argoMetrics.syncOperationsRunning,
            repositoriesConnected: argoMetrics.repositoriesConnected,
          };
        }
      } catch (error) {
        const node = this.nodes.find(n => n.id === nodeId);
        errorCollector.addError(error as Error, {
          severity: 'warning',
          source: 'component-engine',
          componentId: nodeId,
          componentLabel: node?.data.label,
          componentType: node?.type,
          context: { engine: 'argo-cd', operation: 'performUpdate' },
        });
      }
    }
    
    // Perform Harbor updates (push/pull operations, scans, replication, GC)
    for (const [nodeId, harborEngine] of this.harborEngines.entries()) {
      try {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) continue;
        
        const hasIncomingConnections = this.connections.some(conn => conn.target === nodeId);
        harborEngine.performUpdate(now, hasIncomingConnections);
        
        // Metrics are already updated in simulateHarbor method
        // which is called from updateComponentMetrics
      } catch (error) {
        const node = this.nodes.find(n => n.id === nodeId);
        errorCollector.addError(error as Error, {
          severity: 'warning',
          source: 'component-engine',
          componentId: nodeId,
          componentLabel: node?.data.label,
          componentType: node?.type,
          context: { engine: 'harbor', operation: 'performUpdate' },
        });
      }
    }
    
    // Perform Docker updates (container operations, image operations, resource updates)
    for (const [nodeId, dockerEngine] of this.dockerEngines.entries()) {
      try {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) continue;
        
        const hasIncomingConnections = this.connections.some(conn => conn.target === nodeId);
        dockerEngine.performUpdate(now, hasIncomingConnections);
        
        // Metrics are already updated in simulateDocker method
        // which is called from updateComponentMetrics
      } catch (error) {
        const node = this.nodes.find(n => n.id === nodeId);
        errorCollector.addError(error as Error, {
          severity: 'warning',
          source: 'component-engine',
          componentId: nodeId,
          componentLabel: node?.data.label,
          componentType: node?.type,
          context: { engine: 'docker', operation: 'performUpdate' },
        });
      }
    }
    
    // Perform Kubernetes updates (pod lifecycle, deployment reconciliation, node metrics)
    for (const [nodeId, kubernetesEngine] of this.kubernetesEngines.entries()) {
      try {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) continue;
        
        kubernetesEngine.simulateStep();
        
        // Metrics are already updated in simulateKubernetes method
        // which is called from updateComponentMetrics
      } catch (error) {
        const node = this.nodes.find(n => n.id === nodeId);
        errorCollector.addError(error as Error, {
          severity: 'warning',
          source: 'component-engine',
          componentId: nodeId,
          componentLabel: node?.data.label,
          componentType: node?.type,
          context: { engine: 'kubernetes', operation: 'simulateStep' },
        });
      }
    }
    
    // Perform Ansible updates (jobs, schedules, metrics)
    for (const [nodeId, ansibleEngine] of this.ansibleEngines.entries()) {
      try {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) continue;
        
        ansibleEngine.performUpdate(now);
        
        // Update component metrics based on Ansible metrics
        const ansibleMetrics = ansibleEngine.getMetrics();
        const componentMetrics = this.metrics.get(nodeId);
        if (componentMetrics && ansibleMetrics) {
          // Update throughput based on jobs per hour
          componentMetrics.throughput = ansibleMetrics.jobsPerHour / 3600; // jobs per second
          // Update latency based on average job duration
          componentMetrics.latency = ansibleMetrics.averageJobDuration * 1000; // convert to ms
        }
      } catch (error) {
        const node = this.nodes.find(n => n.id === nodeId);
        errorCollector.addError(error as Error, {
          severity: 'warning',
          source: 'component-engine',
          componentId: nodeId,
          componentLabel: node?.data.label,
          componentType: node?.type,
          context: { engine: 'ansible', operation: 'performUpdate' },
        });
      }
    }
    
    // Process OpenTelemetry Collector batch flush
    for (const [nodeId, otelEngine] of this.otelCollectorEngines.entries()) {
      try {
        const node = this.nodes.find(n => n.id === nodeId);
        // Note: OpenTelemetry Collector processes messages individually, batch flush is handled internally
      } catch (error) {
        const node = this.nodes.find(n => n.id === nodeId);
        errorCollector.addError(error as Error, {
          severity: 'warning',
          source: 'component-engine',
          componentId: nodeId,
          componentLabel: node?.data.label,
          componentType: node?.type,
          context: { engine: 'opentelemetry', operation: 'processBatchFlush' },
        });
      }
    }
    
    // Update connection metrics based on source/target throughput
    for (const connection of this.connections) {
      try {
        this.updateConnectionMetrics(connection);
      } catch (error) {
        errorCollector.addError(error as Error, {
          severity: 'warning',
          source: 'emulation-engine',
          context: { operation: 'updateConnectionMetrics', connectionId: connection.id },
        });
      }
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
        case 'haproxy':
          this.simulateHAProxy(node, config, metrics, hasIncomingConnections);
          break;
        case 'traefik':
          this.simulateTraefik(node, config, metrics, hasIncomingConnections);
          break;
        case 'envoy':
          this.simulateEnvoy(node, config, metrics, hasIncomingConnections);
          break;
        case 'istio':
          this.simulateIstio(node, config, metrics, hasIncomingConnections);
          break;
        case 'service-mesh':
          this.simulateServiceMesh(node, config, metrics, hasIncomingConnections);
          break;
        case 'docker':
          this.simulateDocker(node, config, metrics, hasIncomingConnections);
          break;
        case 'kubernetes':
          this.simulateKubernetes(node, config, metrics, hasIncomingConnections);
          break;
        case 'rest':
        case 'grpc':
        case 'graphql':
        case 'websocket':
          this.simulateAPI(node, config, metrics, hasIncomingConnections);
          break;
        case 'soap':
          this.simulateSOAP(node, config, metrics, hasIncomingConnections);
          break;
        case 'kong':
          this.simulateKong(node, config, metrics, hasIncomingConnections);
          break;
        case 'api-gateway':
          this.simulateAPIGateway(node, config, metrics, hasIncomingConnections);
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
        case 'loki':
          this.simulateLoki(node, config, metrics, hasIncomingConnections);
          break;
        case 'keycloak':
          this.simulateKeycloak(node, config, metrics, hasIncomingConnections);
          break;
        case 'secrets-vault':
          this.simulateVault(node, config, metrics, hasIncomingConnections);
          break;
        case 'pagerduty':
          this.simulatePagerDuty(node, config, metrics, hasIncomingConnections);
          break;
        case 'waf':
          this.simulateWAF(node, config, metrics, hasIncomingConnections);
          break;
        case 'firewall':
          this.simulateFirewall(node, config, metrics, hasIncomingConnections);
          break;
        case 'vpn':
          this.simulateVPN(node, config, metrics, hasIncomingConnections);
          break;
        case 'cdn':
          this.simulateCDN(node, config, metrics, hasIncomingConnections);
          break;
        case 'ids-ips':
          this.simulateIDSIPS(node, config, metrics, hasIncomingConnections);
          break;
        case 'argo-cd':
          this.simulateArgoCD(node, config, metrics, hasIncomingConnections);
          break;
        case 'terraform':
          this.simulateTerraform(node, config, metrics, hasIncomingConnections);
          break;
        case 'ansible':
          this.simulateAnsible(node, config, metrics, hasIncomingConnections);
          break;
        case 'harbor':
          this.simulateHarbor(node, config, metrics, hasIncomingConnections);
          break;
        case 'docker':
          this.simulateDocker(node, config, metrics, hasIncomingConnections);
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
      case 'haproxy':
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
   * Update WebSocket metrics in node config (for UI display)
   */
  private updateWebSocketMetricsInConfig(
    node: CanvasNode,
    wsEngine: WebSocketEmulationEngine
  ): void {
    const config = (node.data.config as any) || {};
    
    // Update connections
    const activeConnections = wsEngine.getActiveConnections();
    config.connections = activeConnections;
    config.totalConnections = wsEngine.getWebSocketMetrics().connectionsTotal;
    config.activeConnections = wsEngine.getWebSocketMetrics().connectionsActive;
    
    // Update rooms
    const rooms = wsEngine.getRooms();
    config.rooms = rooms;
    
    // Update subscriptions
    const subscriptions = wsEngine.getSubscriptions();
    config.subscriptions = subscriptions;
    
    // Update messages (limited history)
    const messages = wsEngine.getMessageHistory(100);
    config.messages = messages;
    config.totalMessages = wsEngine.getWebSocketMetrics().messagesTotal;
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
    
    // Get NGINX routing engine
    const routingEngine = this.nginxRoutingEngines.get(node.id);
    if (!routingEngine) {
      // No routing engine, use default behavior
      const workerThreads = config.workerThreads || (config as any).maxWorkers || 4;
      const throughputReqs = config.requestsPerSecond || 10000;
      
      const loadVariation = 0.5 * Math.sin(this.simulationTime / 2000) + 0.5;
      metrics.throughput = throughputReqs * loadVariation;
      metrics.latency = 1 + (1 - loadVariation) * 4;
      metrics.errorRate = 0.00001;
      metrics.utilization = Math.min(1, (metrics.throughput / throughputReqs) * (workerThreads / 4));
      
      metrics.customMetrics = {
        'worker_threads': workerThreads,
        'active_connections': Math.floor(metrics.throughput * 0.1),
      };
      return;
    }

    // Get NGINX config
    const nginxConfig = (config as any) || {};
    const maxWorkers = nginxConfig.maxWorkers || 4;
    const requestsPerSecond = nginxConfig.requestsPerSecond || 10000;
    const enableCache = nginxConfig.enableCache ?? true;
    const enableGzip = nginxConfig.enableGzip ?? true;
    
    // Get stats from routing engine
    const stats = routingEngine.getStats();
    
    // Calculate throughput with load variation
    const loadVariation = 0.5 * Math.sin(this.simulationTime / 2000) + 0.5;
    let baseThroughput = requestsPerSecond * loadVariation;
    
    // Apply rate limiting effects
    if (stats.rateLimitBlocks > 0) {
      // Rate limiting reduces effective throughput
      const blockRate = Math.min(0.1, stats.rateLimitBlocks / Math.max(1, stats.requests));
      baseThroughput = baseThroughput * (1 - blockRate);
    }
    
    metrics.throughput = baseThroughput;
    
    // Latency calculation (1-10ms base + upstream latency)
    const baseLatency = 1 + (1 - loadVariation) * 4;
    const upstreamLatency = 10 + Math.random() * 90; // Simulated upstream latency
    metrics.latency = baseLatency + (upstreamLatency * 0.3); // NGINX adds ~30% of upstream latency
    
    // Error rate (very low for NGINX, but can increase with rate limiting)
    const rateLimitErrorRate = stats.rateLimitBlocks > 0 ? 
      Math.min(0.05, stats.rateLimitBlocks / Math.max(1, stats.requests)) : 0;
    metrics.errorRate = 0.00001 + rateLimitErrorRate;
    
    // Utilization based on worker threads and throughput
    const workerUtilization = Math.min(1, (metrics.throughput / requestsPerSecond) * (maxWorkers / 4));
    metrics.utilization = workerUtilization;
    
    // Custom metrics
    metrics.customMetrics = {
      'worker_threads': maxWorkers,
      'active_connections': Math.floor(metrics.throughput * 0.1),
      'cache_hits': stats.cacheHits,
      'cache_misses': stats.cacheMisses,
      'cache_hit_rate': Math.round(stats.cacheHitRate * 100) / 100,
      'rate_limit_blocks': stats.rateLimitBlocks,
      'locations': stats.locations,
      'upstreams': stats.upstreams,
      'ssl_enabled': nginxConfig.enableSSL ? 1 : 0,
      'gzip_enabled': enableGzip ? 1 : 0,
    };
  }

  /**
   * HAProxy load balancer emulation
   */
  private simulateHAProxy(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    if (!hasIncomingConnections) {
      // No incoming requests, reset metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0;
      return;
    }
    
    // Get HAProxy routing engine
    const routingEngine = this.haproxyRoutingEngines.get(node.id);
    if (!routingEngine) {
      // No routing engine, use default behavior
      const maxConnections = (config as any).maxConnections || 4096;
      const throughputReqs = (config as any).requestsPerSecond || 10000;
      
      const loadVariation = 0.5 * Math.sin(this.simulationTime / 2000) + 0.5;
      metrics.throughput = throughputReqs * loadVariation;
      metrics.latency = 1 + (1 - loadVariation) * 4;
      metrics.errorRate = 0.00001;
      metrics.utilization = Math.min(1, (metrics.throughput / throughputReqs) * (maxConnections / 4096));
      
      metrics.customMetrics = {
        'max_connections': maxConnections,
        'active_connections': Math.floor(metrics.throughput * 0.1),
      };
      return;
    }

    // Get HAProxy config
    const haproxyConfig = (config as any) || {};
    const maxConnections = haproxyConfig.maxConnections || 4096;
    const requestsPerSecond = haproxyConfig.requestsPerSecond || 10000;
    
    // Get stats from routing engine
    const stats = routingEngine.getStats();
    
    // Calculate throughput with load variation
    const loadVariation = 0.5 * Math.sin(this.simulationTime / 2000) + 0.5;
    let baseThroughput = requestsPerSecond * loadVariation;
    
    // Adjust based on healthy servers
    const healthyRatio = stats.totalServers > 0 ? stats.upServers / stats.totalServers : 1;
    baseThroughput = baseThroughput * healthyRatio;
    
    metrics.throughput = baseThroughput;
    
    // Latency calculation (1-10ms base + upstream latency)
    const baseLatency = 1 + (1 - loadVariation) * 4;
    const upstreamLatency = 10 + Math.random() * 90; // Simulated upstream latency
    metrics.latency = baseLatency + (upstreamLatency * 0.3); // HAProxy adds ~30% of upstream latency
    
    // Error rate based on stats
    metrics.errorRate = stats.errorRate || 0.00001;
    
    // Utilization based on connections
    const connectionUtilization = Math.min(1, stats.activeConnections / maxConnections);
    metrics.utilization = connectionUtilization;
    
    // Custom metrics
    metrics.customMetrics = {
      'max_connections': maxConnections,
      'active_connections': stats.activeConnections,
      'frontends': stats.frontends,
      'backends': stats.backends,
      'total_servers': stats.totalServers,
      'up_servers': stats.upServers,
      'down_servers': stats.downServers,
      'total_requests': stats.totalRequests,
      'total_responses': stats.totalResponses,
      'total_bytes_in': stats.totalBytesIn,
      'total_bytes_out': stats.totalBytesOut,
    };
  }

  /**
   * Envoy Proxy emulation
   */
  private simulateEnvoy(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    if (!hasIncomingConnections) {
      // No incoming requests, reset metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0;
      return;
    }
    
    // Get Envoy routing engine
    const routingEngine = this.envoyRoutingEngines.get(node.id);
    if (!routingEngine) {
      // No routing engine, use default behavior
      const maxConnections = (config as any).maxConnections || 1024;
      const throughputReqs = (config as any).requestsPerSecond || 10000;
      
      const loadVariation = 0.5 * Math.sin(this.simulationTime / 2000) + 0.5;
      metrics.throughput = throughputReqs * loadVariation;
      metrics.latency = 1 + (1 - loadVariation) * 4;
      metrics.errorRate = 0.00001;
      metrics.utilization = Math.min(1, (metrics.throughput / throughputReqs) * (maxConnections / 1024));
      
      metrics.customMetrics = {
        'max_connections': maxConnections,
        'active_connections': Math.floor(metrics.throughput * 0.1),
      };
      return;
    }

    // Get Envoy config
    const envoyConfig = (config as any) || {};
    const maxConnections = envoyConfig.maxConnections || 1024;
    const requestsPerSecond = envoyConfig.requestsPerSecond || 10000;
    
    // Get stats from routing engine
    const stats = routingEngine.getStats();
    
    // Calculate throughput with load variation
    const loadVariation = 0.5 * Math.sin(this.simulationTime / 2000) + 0.5;
    let baseThroughput = requestsPerSecond * loadVariation;
    
    // Adjust based on healthy endpoints
    const healthyRatio = stats.totalEndpoints > 0 ? stats.healthyEndpoints / stats.totalEndpoints : 1;
    baseThroughput = baseThroughput * healthyRatio;
    
    metrics.throughput = baseThroughput;
    
    // Latency calculation (1-10ms base + upstream latency)
    const baseLatency = 1 + (1 - loadVariation) * 4;
    const upstreamLatency = 10 + Math.random() * 90; // Simulated upstream latency
    metrics.latency = baseLatency + (upstreamLatency * 0.2); // Envoy adds ~20% of upstream latency
    
    // Error rate based on stats
    metrics.errorRate = stats.errorRate || 0.00001;
    
    // Utilization based on connections
    const connectionUtilization = Math.min(1, stats.activeConnections / maxConnections);
    metrics.utilization = connectionUtilization;
    
    // Custom metrics
    metrics.customMetrics = {
      'max_connections': maxConnections,
      'active_connections': stats.activeConnections,
      'clusters': stats.clusters,
      'listeners': stats.listeners,
      'routes': stats.routes,
      'total_endpoints': stats.totalEndpoints,
      'healthy_endpoints': stats.healthyEndpoints,
      'unhealthy_endpoints': stats.unhealthyEndpoints,
      'total_requests': stats.totalRequests,
      'total_responses': stats.totalResponses,
      'total_bytes_in': stats.totalBytesIn,
      'total_bytes_out': stats.totalBytesOut,
      'rate_limit_blocks': stats.rateLimitBlocks || 0,
      'timeout_errors': stats.timeoutErrors || 0,
      'circuit_breaker_trips': stats.circuitBreakerTrips || 0,
    };
  }

  /**
   * Service Mesh emulation
   */
  private simulateServiceMesh(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    if (!hasIncomingConnections) {
      // No incoming requests, reset metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0;
      return;
    }
    
    // Get Service Mesh routing engine
    const routingEngine = this.serviceMeshRoutingEngines.get(node.id);
    if (!routingEngine) {
      // No routing engine, use default behavior
      const maxConnections = (config as any).maxConnections || 10000;
      const throughputReqs = (config as any).requestsPerSecond || 5000;
      
      const loadVariation = 0.5 * Math.sin(this.simulationTime / 2000) + 0.5;
      metrics.throughput = throughputReqs * loadVariation;
      metrics.latency = 5 + (1 - loadVariation) * 10;
      metrics.errorRate = 0.0001;
      metrics.utilization = Math.min(1, (metrics.throughput / throughputReqs) * (maxConnections / 10000));
      
      metrics.customMetrics = {
        'max_connections': maxConnections,
        'active_connections': Math.floor(metrics.throughput * 0.1),
        'services': (config as any).services?.length || 0,
      };
      return;
    }

    // Get Service Mesh config
    const meshConfig = (config as any) || {};
    const maxConnections = meshConfig.maxConnections || 10000;
    const requestsPerSecond = meshConfig.requestsPerSecond || 5000;
    
    // Get stats from routing engine
    const stats = routingEngine.getStats();
    
    // Calculate throughput with load variation
    const loadVariation = 0.5 * Math.sin(this.simulationTime / 2000) + 0.5;
    let baseThroughput = requestsPerSecond * loadVariation;
    
    // Adjust based on service health
    const serviceCount = stats.services;
    const healthyRatio = serviceCount > 0 ? Math.min(1, serviceCount / Math.max(1, (meshConfig.services?.length || serviceCount))) : 1;
    baseThroughput = baseThroughput * healthyRatio;
    
    metrics.throughput = baseThroughput;
    
    // Latency calculation (5-15ms base + upstream latency + mTLS overhead)
    const baseLatency = 5 + (1 - loadVariation) * 10;
    const upstreamLatency = 10 + Math.random() * 90; // Simulated upstream latency
    const mtlsOverhead = meshConfig.enableMTLS ? 2 : 0; // mTLS adds ~2ms overhead
    metrics.latency = baseLatency + (upstreamLatency * 0.15) + mtlsOverhead; // Service Mesh adds ~15% of upstream latency
    
    // Error rate based on stats
    metrics.errorRate = stats.errorRate || 0.0001;
    
    // Utilization based on connections
    const connectionUtilization = Math.min(1, stats.activeConnections / maxConnections);
    metrics.utilization = connectionUtilization;
    
    // Custom metrics
    metrics.customMetrics = {
      'max_connections': maxConnections,
      'active_connections': stats.activeConnections,
      'services': stats.services,
      'virtual_services': stats.virtualServices,
      'destination_rules': stats.destinationRules,
      'gateways': stats.gateways,
      'total_requests': stats.totalRequests,
      'total_responses': stats.totalResponses,
      'total_errors': stats.totalErrors,
      'total_bytes_in': stats.totalBytesIn,
      'total_bytes_out': stats.totalBytesOut,
      'mtls_connections': stats.mtlsConnections,
      'circuit_breaker_trips': stats.circuitBreakerTrips,
      'retry_attempts': stats.retryAttempts,
      'timeout_errors': stats.timeoutErrors,
      'rate_limit_blocks': stats.rateLimitBlocks,
      'average_latency': Math.round(stats.averageLatency),
    };
  }

  /**
   * Istio Service Mesh emulation
   */
  private simulateIstio(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    if (!hasIncomingConnections) {
      // No incoming requests, reset metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0;
      return;
    }
    
    // Get Istio routing engine
    const routingEngine = this.istioRoutingEngines.get(node.id);
    if (!routingEngine) {
      // No routing engine, use default behavior
      const maxConnections = (config as any).maxConnections || 10000;
      const throughputReqs = (config as any).requestsPerSecond || 5000;
      
      const loadVariation = 0.5 * Math.sin(this.simulationTime / 2000) + 0.5;
      metrics.throughput = throughputReqs * loadVariation;
      metrics.latency = 5 + (1 - loadVariation) * 10;
      metrics.errorRate = 0.0001;
      metrics.utilization = Math.min(1, (metrics.throughput / throughputReqs) * (maxConnections / 10000));
      
      metrics.customMetrics = {
        'max_connections': maxConnections,
        'active_connections': Math.floor(metrics.throughput * 0.1),
        'services': (config as any).services?.length || 0,
      };
      return;
    }

    // Get Istio config
    const istioConfig = (config as any) || {};
    const maxConnections = istioConfig.maxConnections || 10000;
    const requestsPerSecond = istioConfig.requestsPerSecond || 5000;
    
    // Get stats from routing engine
    const stats = routingEngine.getStats();
    
    // Calculate throughput with load variation
    const loadVariation = 0.5 * Math.sin(this.simulationTime / 2000) + 0.5;
    let baseThroughput = requestsPerSecond * loadVariation;
    
    // Adjust based on service health
    const serviceCount = stats.services;
    const healthyRatio = serviceCount > 0 ? Math.min(1, serviceCount / Math.max(1, (istioConfig.services?.length || serviceCount))) : 1;
    baseThroughput = baseThroughput * healthyRatio;
    
    metrics.throughput = baseThroughput;
    
    // Latency calculation (5-15ms base + upstream latency + mTLS overhead)
    const baseLatency = 5 + (1 - loadVariation) * 10;
    const upstreamLatency = 10 + Math.random() * 90; // Simulated upstream latency
    const mtlsOverhead = istioConfig.enableMTLS ? 2 : 0; // mTLS adds ~2ms overhead
    metrics.latency = baseLatency + (upstreamLatency * 0.15) + mtlsOverhead; // Istio adds ~15% of upstream latency
    
    // Error rate based on stats
    metrics.errorRate = stats.errorRate || 0.0001;
    
    // Utilization based on connections
    const connectionUtilization = Math.min(1, stats.activeConnections / maxConnections);
    metrics.utilization = connectionUtilization;
    
    // Custom metrics
    metrics.customMetrics = {
      'max_connections': maxConnections,
      'active_connections': stats.activeConnections,
      'services': stats.services,
      'virtual_services': stats.virtualServices,
      'destination_rules': stats.destinationRules,
      'gateways': stats.gateways,
      'total_requests': stats.totalRequests,
      'total_responses': stats.totalResponses,
      'total_errors': stats.totalErrors,
      'total_bytes_in': stats.totalBytesIn,
      'total_bytes_out': stats.totalBytesOut,
      'mtls_connections': stats.mtlsConnections,
      'circuit_breaker_trips': stats.circuitBreakerTrips,
      'retry_attempts': stats.retryAttempts,
      'timeout_errors': stats.timeoutErrors,
      'rate_limit_blocks': stats.rateLimitBlocks,
      'average_latency': Math.round(stats.averageLatency),
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
      
      // Reset routing engine metrics if exists
      if (node.type === 'rest') {
        const routingEngine = this.restApiRoutingEngines.get(node.id);
        if (routingEngine) {
          // Clear endpoint metrics
          const stats = routingEngine.getStats();
          // Metrics will be reset on next request
        }
      }
      return;
    }
    
    // For REST API, use routing engine if available
    if (node.type === 'rest') {
      const routingEngine = this.restApiRoutingEngines.get(node.id);
      if (routingEngine) {
        const stats = routingEngine.getStats();
        const endpointStats = routingEngine.getAllEndpointStats();
        
        // Calculate metrics from routing engine stats
        const totalRequests = stats.totalRequests;
        const totalErrors = stats.totalErrors;
        const avgLatency = stats.averageLatency;
        
        // Simulate current throughput based on incoming connections
        const rps = config.requestsPerSecond || 100;
        const variation = Math.sin(this.simulationTime / 1500) * 0.1 + 1;
        metrics.throughput = rps * variation;
        
        // Use routing engine latency if available, otherwise use config
        metrics.latency = avgLatency > 0 ? avgLatency : (config.responseLatency || 50) + Math.random() * 30;
        
        // Calculate error rate from routing engine stats
        if (totalRequests > 0) {
          metrics.errorRate = totalErrors / totalRequests;
        } else {
          metrics.errorRate = 0.005; // Default 0.5%
        }
        
        // Utilization based on throughput vs capacity
        metrics.utilization = Math.min(1, metrics.throughput / rps);
        
        // Custom metrics from routing engine
        const enabledEndpoints = stats.enabledEndpoints;
        const endpointMetrics: Record<string, number> = {};
        
        for (const [endpointId, endpointStat] of Object.entries(endpointStats)) {
          if (endpointStat) {
            endpointMetrics[`endpoint_${endpointId}_requests`] = endpointStat.requestCount;
            endpointMetrics[`endpoint_${endpointId}_errors`] = endpointStat.errorCount;
            endpointMetrics[`endpoint_${endpointId}_latency`] = endpointStat.averageLatency;
          }
        }
        
        metrics.customMetrics = {
          'rps': metrics.throughput,
          'total_requests': totalRequests,
          'total_errors': totalErrors,
          'p50_latency': Math.round(metrics.latency * 0.5),
          'p99_latency': Math.round(metrics.latency * 2),
          'errors': Math.round(metrics.throughput * metrics.errorRate),
          'endpoints': stats.totalEndpoints,
          'enabled_endpoints': enabledEndpoints,
          ...endpointMetrics,
        };
        
        return;
      }
    }
    
    // For gRPC, use routing engine if available
    if (node.type === 'grpc') {
      const routingEngine = this.grpcRoutingEngines.get(node.id);
      if (routingEngine) {
        const stats = routingEngine.getStats();
        const methodStats = routingEngine.getAllMethodStats();
        const connectionState = routingEngine.getConnectionState();
        
        // Calculate metrics from routing engine stats
        const totalRequests = stats.totalRequests;
        const totalErrors = stats.totalErrors;
        const avgLatency = stats.averageLatency;
        
        // Simulate current throughput based on incoming connections
        const rps = config.requestsPerSecond || 100;
        const variation = Math.sin(this.simulationTime / 1500) * 0.1 + 1;
        metrics.throughput = rps * variation;
        
        // Use routing engine latency if available, otherwise use config
        metrics.latency = avgLatency > 0 ? avgLatency : (config.responseLatency || 20) + Math.random() * 15; // gRPC is faster
        
        // Calculate error rate from routing engine stats
        if (totalRequests > 0) {
          metrics.errorRate = totalErrors / totalRequests;
        } else {
          metrics.errorRate = 0.002; // Default 0.2% for gRPC (lower than REST)
        }
        
        // Utilization based on throughput vs capacity and connections
        const maxConnections = connectionState.totalConnections || 100;
        const connectionUtilization = Math.min(1, (connectionState.activeConnections + connectionState.idleConnections) / maxConnections);
        metrics.utilization = Math.min(1, (metrics.throughput / rps) * 0.7 + connectionUtilization * 0.3);
        
        // Custom metrics from routing engine
        const methodMetrics: Record<string, number> = {};
        
        for (const [methodKey, methodStat] of Object.entries(methodStats)) {
          if (methodStat) {
            methodMetrics[`method_${methodKey}_requests`] = methodStat.requestCount;
            methodMetrics[`method_${methodKey}_errors`] = methodStat.errorCount;
            methodMetrics[`method_${methodKey}_latency`] = methodStat.averageLatency;
            if (methodStat.streamingConnections) {
              methodMetrics[`method_${methodKey}_streaming_connections`] = methodStat.streamingConnections;
            }
          }
        }
        
        metrics.customMetrics = {
          'rps': metrics.throughput,
          'total_requests': totalRequests,
          'total_errors': totalErrors,
          'p50_latency': Math.round(metrics.latency * 0.5),
          'p99_latency': Math.round(metrics.latency * 1.8), // gRPC has better tail latency
          'errors': Math.round(metrics.throughput * metrics.errorRate),
          'services': stats.totalServices,
          'enabled_services': stats.enabledServices,
          'methods': stats.totalMethods,
          'enabled_methods': stats.enabledMethods,
          'active_connections': connectionState.activeConnections,
          'idle_connections': connectionState.idleConnections,
          'total_connections': connectionState.totalConnections,
          ...methodMetrics,
        };
        
        return;
      }
    }
    
    // For GraphQL, use emulation engine if available
    if (node.type === 'graphql') {
      const graphQLEngine = this.graphQLEngines.get(node.id);
      if (graphQLEngine) {
        const load = graphQLEngine.getLoad();
        const graphQLMetrics = graphQLEngine.getGraphQLMetrics();
        
        // Simulate requests if no incoming connections
        if (!hasIncomingConnections) {
          const rps = config.requestsPerSecond || 100;
          graphQLEngine.simulateRequests(rps, this.nodes, this.connections);
        }
        
        // Process subscriptions (generate and deliver events)
        graphQLEngine.processSubscriptions(this.nodes, this.connections);
        
        // Get updated load after simulation
        const updatedLoad = graphQLEngine.getLoad();
        
        // Calculate metrics from GraphQL engine
        metrics.throughput = updatedLoad.queriesPerSecond + updatedLoad.mutationsPerSecond;
        metrics.latency = updatedLoad.averageLatency;
        metrics.errorRate = updatedLoad.errorRate;
        metrics.utilization = (updatedLoad.cpuUtilization + updatedLoad.memoryUtilization) / 2;
        
        // Custom metrics from GraphQL engine
        metrics.customMetrics = {
          'queries_per_second': graphQLMetrics.queriesPerSecond,
          'mutations_per_second': graphQLMetrics.mutationsPerSecond,
          'subscriptions_active': graphQLMetrics.subscriptionsActive,
          'total_queries': graphQLMetrics.totalQueries,
          'total_mutations': graphQLMetrics.totalMutations,
          'total_errors': graphQLMetrics.totalErrors,
          'average_response_time': graphQLMetrics.averageResponseTime,
          'average_complexity': graphQLMetrics.averageComplexity,
          'average_depth': graphQLMetrics.averageDepth,
          'cache_hit_rate': graphQLMetrics.cacheHitRate,
          'error_rate': graphQLMetrics.errorRate,
          'cpu_utilization': updatedLoad.cpuUtilization,
          'memory_utilization': updatedLoad.memoryUtilization,
        };
        
        // Add subscription metrics
        const subscriptionMetrics = graphQLEngine.getSubscriptionMetrics();
        metrics.customMetrics = {
          ...metrics.customMetrics,
          'subscription_events_total': subscriptionMetrics.totalEvents,
          'subscription_events_per_second': subscriptionMetrics.eventsPerSecond,
          'subscription_avg_delivery_latency': subscriptionMetrics.averageDeliveryLatency,
          'subscription_delivery_errors': subscriptionMetrics.totalDeliveryErrors,
          'subscription_delivery_error_rate': subscriptionMetrics.deliveryErrorRate,
        };
        
        return;
      }
    }
    
    // For SOAP, use emulation engine if available
    if (node.type === 'soap') {
      const soapEngine = this.soapEngines.get(node.id);
      if (soapEngine) {
        const soapMetrics = soapEngine.getSOAPMetrics();
        
        // Calculate metrics from SOAP engine
        metrics.throughput = soapMetrics.requestsPerSecond;
        metrics.latency = soapMetrics.averageLatency;
        metrics.errorRate = soapMetrics.errorRate / 100; // Convert from percentage
        metrics.utilization = Math.min(1, metrics.throughput / (config.requestsPerSecond || 100));
        
        // Custom metrics from SOAP engine
        const soapConfig = config as any;
        metrics.customMetrics = {
          'requests_per_second': soapMetrics.requestsPerSecond,
          'total_requests': soapMetrics.totalRequests,
          'total_errors': soapMetrics.totalErrors,
          'average_response_time': soapMetrics.averageResponseTime,
          'average_latency': soapMetrics.averageLatency,
          'error_rate': soapMetrics.errorRate,
          'success_rate': soapMetrics.successRate,
          'services_count': soapConfig?.services?.length || 0,
          'operations_count': soapConfig?.services?.reduce((sum: number, s: any) => sum + (s.operations?.length || 0), 0) || 0,
        };
        
        // Add operation metrics
        if (soapMetrics.operationMetrics) {
          for (const opMetric of soapMetrics.operationMetrics) {
            metrics.customMetrics![`operation_${opMetric.operationName}_calls`] = opMetric.totalCalls;
            metrics.customMetrics![`operation_${opMetric.operationName}_latency`] = opMetric.averageLatency;
            metrics.customMetrics![`operation_${opMetric.operationName}_errors`] = opMetric.totalErrors;
          }
        }
        
        // Add service metrics
        if (soapMetrics.serviceMetrics) {
          for (const svcMetric of soapMetrics.serviceMetrics) {
            metrics.customMetrics![`service_${svcMetric.serviceName}_requests`] = svcMetric.totalRequests;
            metrics.customMetrics![`service_${svcMetric.serviceName}_latency`] = svcMetric.averageLatency;
            metrics.customMetrics![`service_${svcMetric.serviceName}_errors`] = svcMetric.totalErrors;
          }
        }
        
        // Add rate limit metrics
        if (soapMetrics.rateLimitMetrics) {
          metrics.customMetrics!['rate_limit_blocked'] = soapMetrics.rateLimitMetrics.totalBlockedRequests;
          metrics.customMetrics!['rate_limit_hits_per_sec'] = soapMetrics.rateLimitMetrics.rateLimitHitsPerSecond;
        }
        
        // Add timeout metrics
        if (soapMetrics.timeoutMetrics) {
          metrics.customMetrics!['timeouts_total'] = soapMetrics.timeoutMetrics.totalTimeouts;
          metrics.customMetrics!['timeouts_per_sec'] = soapMetrics.timeoutMetrics.timeoutsPerSecond;
        }
        
        return;
      }
    }
    
    // For WebSocket, use emulation engine if available
    if (node.type === 'websocket') {
      const wsEngine = this.websocketEngines.get(node.id);
      if (wsEngine) {
        wsEngine.updateMetrics(hasIncomingConnections, this.simulationTime);
        const wsMetrics = wsEngine.getWebSocketMetrics();
        
        // Calculate metrics from WebSocket engine
        metrics.throughput = wsMetrics.messagesPerSecond;
        metrics.latency = wsMetrics.averageLatency;
        metrics.latencyP50 = wsMetrics.latencyP50;
        metrics.latencyP99 = wsMetrics.latencyP99;
        metrics.errorRate = wsMetrics.errorRate;
        metrics.utilization = wsMetrics.utilization;
        
        // Custom metrics from WebSocket engine
        metrics.customMetrics = {
          'connections_total': wsMetrics.connectionsTotal,
          'connections_active': wsMetrics.connectionsActive,
          'connections_per_second': wsMetrics.connectionsPerSecond,
          'messages_per_second': wsMetrics.messagesPerSecond,
          'messages_total': wsMetrics.messagesTotal,
          'messages_sent': wsMetrics.messagesSent,
          'messages_received': wsMetrics.messagesReceived,
          'bytes_sent': wsMetrics.bytesSent,
          'bytes_received': wsMetrics.bytesReceived,
          'average_latency': wsMetrics.averageLatency,
          'latency_p50': wsMetrics.latencyP50 || 0,
          'latency_p95': wsMetrics.latencyP95 || 0,
          'latency_p99': wsMetrics.latencyP99 || 0,
          'error_rate': wsMetrics.errorRate,
          'connection_error_rate': wsMetrics.connectionErrorRate,
          'ping_pong_success_rate': wsMetrics.pingPongSuccessRate,
          'compression_ratio': wsMetrics.compressionRatio,
          'rooms_count': wsMetrics.roomsCount,
          'subscriptions_count': wsMetrics.subscriptionsCount,
          'avg_connections_per_room': wsMetrics.averageConnectionsPerRoom,
          'avg_subscriptions_per_connection': wsMetrics.averageSubscriptionsPerConnection,
        };
        
        // Update connections, rooms, subscriptions in config
        this.updateWebSocketMetricsInConfig(node, wsEngine);
        
        return;
      }
    }
    
    // Default behavior for other APIs
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
   * Cloud API Gateway emulation
   */
  private simulateAPIGateway(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    if (!hasIncomingConnections) {
      // No incoming requests, reset metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0;
      
      // Reset engine metrics
      const engine = this.cloudAPIGatewayEngines.get(node.id);
      if (engine) {
        engine.resetMetrics();
      }
      return;
    }

    // Get Cloud API Gateway engine
    const gatewayEngine = this.cloudAPIGatewayEngines.get(node.id);
    if (!gatewayEngine) {
      // No engine initialized, use default API-like behavior
      this.simulateAPI(node, config, metrics, hasIncomingConnections);
      return;
    }

    // Get gateway config
    const gatewayConfig = (node.data.config || {}) as unknown as BaseAPIGatewayConfig;
    const apis = gatewayConfig.apis || [];
    
    // Calculate metrics from engine
    const engineMetrics = gatewayEngine.calculateMetrics();
    
    // Apply metrics
    metrics.throughput = engineMetrics.throughput;
    metrics.latency = engineMetrics.latency;
    metrics.latencyP50 = engineMetrics.latencyP50;
    metrics.latencyP99 = engineMetrics.latencyP99;
    metrics.errorRate = engineMetrics.errorRate;
    metrics.utilization = engineMetrics.utilization;
    
    // Add custom metrics
    metrics.customMetrics = {
      ...engineMetrics.customMetrics,
      'apis_count': apis.length,
      'keys_count': gatewayConfig.keys?.length || 0,
      'provider': gatewayConfig.provider === 'aws' ? 1 : gatewayConfig.provider === 'azure' ? 2 : 3,
      'auth_enabled': gatewayConfig.enableAuthentication ? 1 : 0,
      'rate_limiting_enabled': gatewayConfig.enableRateLimiting ? 1 : 0,
      'caching_enabled': gatewayConfig.enableCaching ? 1 : 0,
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
   * Keycloak emulation
   * Использует KeycloakEmulationEngine для преобразования конфигурации Keycloak
   * и статистики auth-запросов в общие метрики компонента.
   */
  private simulateKeycloak(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    const engine = this.keycloakEngines.get(node.id);

    if (!engine) {
      // Если двигатель не инициализирован, считаем, что Keycloak простаивает
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0.1;
      return;
    }

    const load = engine.calculateLoad();
    const kMetrics = engine.getMetrics();
    const cfg = engine.getConfig();

    // Throughput = все auth-запросы в секунду
    metrics.throughput = load.requestsPerSecond;

    // Latency = средняя латентность auth-запроса
    metrics.latency = load.averageLatency;

    // Error rate = доля неуспешных запросов
    metrics.errorRate = load.errorRate;

    // Utilization — функция от активных сессий, RPS и сложности политики
    const sessionsFactor = Math.min(0.6, (load.activeSessions || 0) / 500);
    const rpsFactor = Math.min(0.3, load.requestsPerSecond / 200);
    const policyCost =
      cfg?.passwordPolicy ? this.estimateKeycloakPolicyComplexity(cfg.passwordPolicy) : 0;
    const policyFactor = Math.min(0.2, policyCost / 100);

    metrics.utilization = Math.min(0.95, 0.1 + sessionsFactor + rpsFactor + policyFactor);

    metrics.customMetrics = {
      ...(metrics.customMetrics || {}),
      keycloak_login_requests_total: kMetrics.loginRequestsTotal,
      keycloak_login_errors_total: kMetrics.loginErrorsTotal,
      keycloak_token_refresh_total: kMetrics.tokenRefreshTotal,
      keycloak_introspection_requests_total: kMetrics.introspectionRequestsTotal,
      keycloak_userinfo_requests_total: kMetrics.userInfoRequestsTotal,
      keycloak_sessions_active: kMetrics.activeSessions,
      keycloak_sessions_created_total: kMetrics.sessionsCreatedTotal,
      keycloak_sessions_expired_total: kMetrics.sessionsExpiredTotal,
      keycloak_auth_success_rate: load.authSuccessRate,
      keycloak_clients_configured: cfg?.clients.length ?? 0,
      keycloak_users_configured: cfg?.users.length ?? 0,
    };
  }

  /**
   * Vault emulation
   * Использует VaultEmulationEngine для преобразования конфигурации Vault
   * и статистики операций с секретами в общие метрики компонента.
   */
  private simulateVault(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    const engine = this.vaultEngines.get(node.id);

    if (!engine) {
      // Если двигатель не инициализирован, считаем, что Vault простаивает
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0.1;
      return;
    }

    const load = engine.calculateLoad();
    const vMetrics = engine.getMetrics();
    const cfg = engine.getConfig();

    // Throughput = все операции в секунду (read, write, auth, encrypt, decrypt)
    metrics.throughput = load.requestsPerSecond;

    // Latency = средняя латентность операций
    metrics.latency = load.averageLatency;

    // Error rate = доля неуспешных запросов
    metrics.errorRate = load.errorRate;

    // Utilization — функция от количества секретов, активных токенов, RPS и включенных движков
    const secretsFactor = Math.min(0.4, (load.secretsCount || 0) / 1000);
    const tokensFactor = Math.min(0.3, (load.activeTokens || 0) / 500);
    const rpsFactor = Math.min(0.2, load.requestsPerSecond / 300);
    const enginesFactor = Math.min(0.1, (load.enginesEnabled || 0) / 10);

    metrics.utilization = Math.min(0.95, 0.1 + secretsFactor + tokensFactor + rpsFactor + enginesFactor);

    metrics.customMetrics = {
      ...(metrics.customMetrics || {}),
      vault_read_requests_total: vMetrics.readRequestsTotal,
      vault_write_requests_total: vMetrics.writeRequestsTotal,
      vault_delete_requests_total: vMetrics.deleteRequestsTotal,
      vault_list_requests_total: vMetrics.listRequestsTotal,
      vault_auth_requests_total: vMetrics.authRequestsTotal,
      vault_auth_errors_total: vMetrics.authErrorsTotal,
      vault_token_issued_total: vMetrics.tokenIssuedTotal,
      vault_token_renewed_total: vMetrics.tokenRenewedTotal,
      vault_token_revoked_total: vMetrics.tokenRevokedTotal,
      vault_tokens_active: vMetrics.activeTokens,
      vault_secrets_total: vMetrics.secretsTotal,
      vault_encryption_operations_total: vMetrics.encryptionOperationsTotal,
      vault_decryption_operations_total: vMetrics.decryptionOperationsTotal,
      vault_engines_enabled: load.enginesEnabled,
    };
  }

  /**
   * Оценка «сложности» password policy Keycloak
   * (используется только для расчёта utilization).
   */
  private estimateKeycloakPolicyComplexity(policy: string): number {
    if (!policy) return 0;
    let score = 0;
    const lower = policy.toLowerCase();

    if (lower.includes('length(')) score += 20;
    if (lower.includes('digits(')) score += 25;
    if (lower.includes('special(')) score += 30;
    if (lower.includes('uppercase(')) score += 15;
    if (lower.includes('lowercase(')) score += 10;

    const rules = (policy.match(/\)/g) || []).length;
    score += rules * 5;

    return score;
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
   * WAF emulation
   */
  private simulateWAF(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    const engine = this.wafEngines.get(node.id);

    if (!engine) {
      // Если двигатель не инициализирован, считаем, что WAF простаивает
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0.1;
      return;
    }

    const load = engine.calculateLoad();
    const wafMetrics = engine.getMetrics();
    const stats = engine.getStats();

    // Throughput = все запросы в секунду
    metrics.throughput = load.requestsPerSecond;

    // Latency = средняя латентность обработки запроса
    metrics.latency = load.averageLatency;

    // Error rate = доля заблокированных запросов (в режиме prevention)
    // В режиме detection/logging ошибок нет, только логирование
    const wafConfig = engine.getConfig();
    if (wafConfig?.mode === 'prevention') {
      metrics.errorRate = load.blockRate;
    } else {
      // В режиме detection/logging ошибок нет, но есть метрики блокировок
      metrics.errorRate = 0;
    }

    // Utilization — функция от количества правил, RPS и сложности проверок
    const rulesFactor = Math.min(0.4, (wafMetrics.activeRules || 0) / 50);
    const rpsFactor = Math.min(0.3, load.requestsPerSecond / 1000);
    const owaspFactor = wafConfig?.enableOWASP ? 0.15 : 0;
    const rateLimitFactor = wafConfig?.enableRateLimiting ? 0.1 : 0;
    const geoBlockFactor = wafConfig?.enableGeoBlocking ? 0.05 : 0;

    metrics.utilization = Math.min(0.95, 0.1 + rulesFactor + rpsFactor + owaspFactor + rateLimitFactor + geoBlockFactor);

    metrics.customMetrics = {
      ...(metrics.customMetrics || {}),
      waf_requests_total: wafMetrics.requestsTotal,
      waf_requests_allowed: wafMetrics.requestsAllowed,
      waf_requests_blocked: wafMetrics.requestsBlocked,
      waf_threats_detected: wafMetrics.threatsDetected,
      waf_threats_blocked: wafMetrics.threatsBlocked,
      waf_rate_limit_hits: wafMetrics.rateLimitHits,
      waf_geo_block_hits: wafMetrics.geoBlockHits,
      waf_ip_block_hits: wafMetrics.ipBlockHits,
      waf_owasp_hits: wafMetrics.owaspHits,
      waf_custom_rule_hits: wafMetrics.customRuleHits,
      waf_active_rules: wafMetrics.activeRules,
      waf_block_rate: load.blockRate,
      waf_threat_detection_rate: load.threatDetectionRate,
      waf_average_latency: load.averageLatency,
    };

    // Симулируем запросы, если есть входящие соединения
    if (hasIncomingConnections) {
      // Оцениваем скорость запросов на основе входящих соединений
      const incomingConnections = this.connections.filter(c => c.target === node.id);
      let estimatedRPS = 0;

      for (const conn of incomingConnections) {
        const sourceMetrics = this.metrics.get(conn.source);
        if (sourceMetrics) {
          estimatedRPS += sourceMetrics.throughput || 0;
        }
      }

      // Если нет реальных запросов, симулируем их
      if (estimatedRPS > 0) {
        engine.setSimulatedRequestRate(estimatedRPS);
        engine.simulateRequests(estimatedRPS);
      }
    }
  }

  /**
   * Firewall emulation
   */
  private simulateFirewall(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    const engine = this.firewallEngines.get(node.id);

    if (!engine) {
      // Если двигатель не инициализирован, считаем, что Firewall простаивает
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0.1;
      return;
    }

    const load = engine.calculateLoad();
    const firewallMetrics = engine.getMetrics();
    const stats = engine.getStats();

    // Throughput = все пакеты в секунду
    metrics.throughput = load.packetsPerSecond;

    // Latency = средняя латентность обработки пакета
    metrics.latency = load.averageLatency;

    // Error rate = доля заблокированных/отклоненных пакетов
    metrics.errorRate = load.blockRate + load.rejectionRate;

    // Utilization — функция от количества правил, PPS и сложности проверок
    const rulesFactor = Math.min(0.3, (firewallMetrics.activeRules || 0) / 100);
    const ppsFactor = Math.min(0.3, load.packetsPerSecond / 10000);
    const statefulFactor = engine.getConfig()?.enableStatefulInspection ? 0.2 : 0;
    const intrusionDetectionFactor = engine.getConfig()?.enableIntrusionDetection ? 0.2 : 0;

    metrics.utilization = Math.min(0.95, 0.1 + rulesFactor + ppsFactor + statefulFactor + intrusionDetectionFactor);

    metrics.customMetrics = {
      ...(metrics.customMetrics || {}),
      firewall_packets_total: firewallMetrics.packetsTotal,
      firewall_packets_allowed: firewallMetrics.packetsAllowed,
      firewall_packets_blocked: firewallMetrics.packetsBlocked,
      firewall_packets_rejected: firewallMetrics.packetsRejected,
      firewall_active_rules: firewallMetrics.activeRules,
      firewall_total_connections: firewallMetrics.totalConnections,
      firewall_active_connections: firewallMetrics.activeConnections,
      firewall_block_rate: load.blockRate,
      firewall_rejection_rate: load.rejectionRate,
      firewall_average_latency: load.averageLatency,
    };

    // Симулируем пакеты, если есть входящие соединения
    if (hasIncomingConnections) {
      // Оцениваем скорость пакетов на основе входящих соединений
      const incomingConnections = this.connections.filter(c => c.target === node.id);
      let estimatedPPS = 0;

      for (const conn of incomingConnections) {
        const sourceMetrics = this.metrics.get(conn.source);
        if (sourceMetrics) {
          // Преобразуем throughput в пакеты в секунду (примерно)
          estimatedPPS += sourceMetrics.throughput || 0;
        }
      }

      // Если нет реальных пакетов, симулируем их
      if (estimatedPPS > 0) {
        engine.setSimulatedPacketRate(estimatedPPS);
        engine.simulatePackets(estimatedPPS);
      }
    }

    // Очистка старых соединений
    engine.cleanup();
  }

  /**
   * VPN emulation
   */
  private simulateVPN(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    const engine = this.vpnEngines.get(node.id);

    if (!engine) {
      // Если двигатель не инициализирован, считаем, что VPN простаивает
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0.1;
      return;
    }

    const load = engine.calculateLoad();
    const vpnMetrics = engine.getMetrics();
    const cfg = engine.getConfig();

    // Throughput = пакеты в секунду через VPN
    metrics.throughput = load.packetsPerSecond;

    // Latency = средняя латентность обработки пакета (включая шифрование)
    metrics.latency = load.averageLatency;

    // Error rate = доля неуспешных соединений
    metrics.errorRate = load.errorRate;

    // Utilization — функция от активных соединений, туннелей, трафика и операций шифрования
    const connectionsFactor = Math.min(0.3, load.utilization * 0.5);
    const tunnelsFactor = Math.min(0.2, (vpnMetrics.activeTunnels || 0) / 10);
    const trafficFactor = Math.min(0.3, load.bytesPerSecond / (100 * 1024 * 1024)); // 100 MB/s max
    const encryptionFactor = Math.min(0.2, (vpnMetrics.encryptionOperations || 0) / 10000);

    metrics.utilization = Math.min(0.95, 
      0.1 + // Base utilization
      connectionsFactor +
      tunnelsFactor +
      trafficFactor +
      encryptionFactor
    );

    metrics.customMetrics = {
      ...(metrics.customMetrics || {}),
      vpn_total_connections: vpnMetrics.totalConnections,
      vpn_active_connections: vpnMetrics.activeConnections,
      vpn_total_tunnels: vpnMetrics.totalTunnels,
      vpn_active_tunnels: vpnMetrics.activeTunnels,
      vpn_bytes_in: vpnMetrics.totalBytesIn,
      vpn_bytes_out: vpnMetrics.totalBytesOut,
      vpn_packets_in: vpnMetrics.totalPacketsIn,
      vpn_packets_out: vpnMetrics.totalPacketsOut,
      vpn_encryption_operations: vpnMetrics.encryptionOperations,
      vpn_compression_operations: vpnMetrics.compressionOperations,
      vpn_failed_connections: vpnMetrics.failedConnections,
      vpn_average_latency: load.averageLatency,
      vpn_connections_per_second: load.connectionsPerSecond,
      vpn_bytes_per_second: load.bytesPerSecond,
    };

    // Симулируем трафик, если есть входящие соединения
    if (hasIncomingConnections) {
      // Оцениваем скорость пакетов на основе входящих соединений
      const incomingConnections = this.connections.filter(c => c.target === node.id);
      let estimatedPPS = 0;
      let estimatedBPS = 0;

      for (const conn of incomingConnections) {
        const sourceMetrics = this.metrics.get(conn.source);
        if (sourceMetrics) {
          estimatedPPS += sourceMetrics.throughput || 0;
          // Оцениваем bytes per second из throughput (примерно 1500 bytes per packet)
          estimatedBPS += (sourceMetrics.throughput || 0) * 1500;
        }
      }

      // Если нет реального трафика, симулируем его
      if (estimatedPPS > 0) {
        engine.simulateIncomingTraffic(estimatedPPS, load.connectionsPerSecond);
      }
    }

    // Очистка устаревших соединений
    engine.cleanupStaleConnections();
  }

  /**
   * CDN emulation
   */
  private simulateCDN(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    const engine = this.cdnEngines.get(node.id);

    if (!engine) {
      // Если двигатель не инициализирован, считаем, что CDN простаивает
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0.1;
      return;
    }

    const load = engine.calculateLoad();
    const cdnMetrics = engine.getMetrics();
    const cfg = engine.getConfig();

    // Throughput = запросы в секунду через CDN
    metrics.throughput = load.requestsPerSecond;

    // Latency = средняя латентность обработки запроса
    metrics.latency = load.averageLatency;

    // Error rate = доля неуспешных запросов
    metrics.errorRate = load.errorRate;

    // Utilization — функция от активных distributions, edge locations, и capacity
    const distributionsFactor = Math.min(0.2, cdnMetrics.activeDistributions / Math.max(1, cdnMetrics.totalDistributions));
    const edgeLocationsFactor = Math.min(0.2, cdnMetrics.activeEdgeLocations / Math.max(1, cdnMetrics.totalEdgeLocations));
    const capacityFactor = Math.min(0.5, load.utilization * 0.5);
    const cacheFactor = load.cacheHitRate > 0.8 ? 0.1 : 0; // Cache reduces load

    metrics.utilization = Math.min(0.95,
      0.1 + // Base utilization
      distributionsFactor +
      edgeLocationsFactor +
      capacityFactor -
      cacheFactor
    );

    metrics.customMetrics = {
      ...(metrics.customMetrics || {}),
      cdn_total_distributions: cdnMetrics.totalDistributions,
      cdn_active_distributions: cdnMetrics.activeDistributions,
      cdn_total_edge_locations: cdnMetrics.totalEdgeLocations,
      cdn_active_edge_locations: cdnMetrics.activeEdgeLocations,
      cdn_total_requests: cdnMetrics.totalRequests,
      cdn_total_cache_hits: cdnMetrics.totalCacheHits,
      cdn_total_cache_misses: cdnMetrics.totalCacheMisses,
      cdn_total_bandwidth: cdnMetrics.totalBandwidth,
      cdn_average_cache_hit_rate: cdnMetrics.averageCacheHitRate,
      cdn_average_latency: load.averageLatency,
      cdn_requests_per_second: load.requestsPerSecond,
      cdn_bandwidth_per_second: load.bandwidthPerSecond,
      cdn_error_rate: load.errorRate,
      cdn_cache_hit_rate: load.cacheHitRate,
    };

    // Симулируем трафик, если есть входящие соединения
    if (hasIncomingConnections) {
      // Оцениваем скорость запросов на основе входящих соединений
      const incomingConnections = this.connections.filter(c => c.target === node.id);
      let estimatedRPS = 0;

      for (const conn of incomingConnections) {
        const sourceMetrics = this.metrics.get(conn.source);
        if (sourceMetrics) {
          estimatedRPS += sourceMetrics.throughput || 0;
        }
      }

      // Если нет реального трафика, симулируем его
      if (estimatedRPS > 0) {
        engine.simulateIncomingTraffic(estimatedRPS);
      }
    }
  }

  /**
   * Argo CD emulation
   */
  private simulateArgoCD(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    const engine = this.argoCDEngines.get(node.id);
    
    if (!engine) {
      // If engine not initialized, use default metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0;
      return;
    }
    
    // Metrics are updated in simulate() method after performUpdate()
    // This method is called before performUpdate, so we use current metrics
    const argoMetrics = engine.getMetrics();
    
    // Throughput: sync operations per hour converted to per second
    metrics.throughput = argoMetrics.syncRate / 3600;
    
    // Latency: average sync duration
    metrics.latency = argoMetrics.averageSyncDuration || 0;
    
    // Error rate: failed syncs / total syncs
    const totalSyncs = argoMetrics.syncOperationsSuccess + argoMetrics.syncOperationsFailed;
    metrics.errorRate = totalSyncs > 0 
      ? argoMetrics.syncOperationsFailed / totalSyncs 
      : 0;
    
    // Utilization: running syncs / total applications
    metrics.utilization = argoMetrics.applicationsTotal > 0
      ? argoMetrics.syncOperationsRunning / argoMetrics.applicationsTotal
      : 0;
    
    metrics.customMetrics = {
      applicationsTotal: argoMetrics.applicationsTotal,
      applicationsSynced: argoMetrics.applicationsSynced,
      applicationsOutOfSync: argoMetrics.applicationsOutOfSync,
      syncOperationsRunning: argoMetrics.syncOperationsRunning,
      repositoriesConnected: argoMetrics.repositoriesConnected,
    };
  }

  /**
   * Terraform emulation
   */
  private simulateTerraform(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    const engine = this.terraformEngines.get(node.id);
    
    if (!engine) {
      // If engine not initialized, use default metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0;
      return;
    }
    
    // Metrics are updated in simulate() method after performUpdate()
    // This method is called before performUpdate, so we use current metrics
    const terraformMetrics = engine.getMetrics();
    
    // Throughput: runs per hour converted to per second
    metrics.throughput = terraformMetrics.runsPerHour / 3600;
    
    // Latency: average run duration
    metrics.latency = terraformMetrics.averageRunDuration || 0;
    
    // Error rate: failed runs / total runs
    const totalRuns = terraformMetrics.runsSuccess + terraformMetrics.runsFailed;
    metrics.errorRate = totalRuns > 0 
      ? terraformMetrics.runsFailed / totalRuns 
      : 0;
    
    // Utilization: running runs / total workspaces
    metrics.utilization = terraformMetrics.workspacesTotal > 0
      ? Math.min(1, terraformMetrics.runsRunning / terraformMetrics.workspacesTotal)
      : 0;
    
    metrics.customMetrics = {
      workspacesTotal: terraformMetrics.workspacesTotal,
      runsTotal: terraformMetrics.runsTotal,
      runsRunning: terraformMetrics.runsRunning,
      runsPending: terraformMetrics.runsPending,
      runsSuccess: terraformMetrics.runsSuccess,
      runsFailed: terraformMetrics.runsFailed,
      statesTotal: terraformMetrics.statesTotal,
      resourcesManaged: terraformMetrics.resourcesManaged,
      runsPerHour: terraformMetrics.runsPerHour,
      averageRunDuration: terraformMetrics.averageRunDuration,
    };
  }

  /**
   * Traefik emulation
   */
  private simulateTraefik(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    if (!hasIncomingConnections) {
      // No incoming requests, reset metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0;
      return;
    }
    
    const engine = this.traefikEngines.get(node.id);
    
    if (!engine) {
      // No engine, use default behavior
      const maxConnections = (config as any).maxConnections || 10000;
      const throughputReqs = (config as any).requestsPerSecond || 10000;
      
      const loadVariation = 0.5 * Math.sin(this.simulationTime / 2000) + 0.5;
      metrics.throughput = throughputReqs * loadVariation;
      metrics.latency = 1 + (1 - loadVariation) * 4;
      metrics.errorRate = 0.00001;
      metrics.utilization = Math.min(1, (metrics.throughput / throughputReqs) * (maxConnections / 10000));
      
      metrics.customMetrics = {
        'max_connections': maxConnections,
        'active_connections': Math.floor(metrics.throughput * 0.1),
      };
      return;
    }

    // Get stats from routing engine
    const stats = engine.getStats();
    const load = engine.getLoad();
    
    // Simulate requests if no real traffic
    if (hasIncomingConnections && stats.totalRequests === 0) {
      const traefikConfig = (config as any) || {};
      const simulatedRPS = traefikConfig.requestsPerSecond || 100;
      engine.simulateRequests(simulatedRPS);
    }
    
    // Use load metrics
    metrics.throughput = load.requestsPerSecond;
    metrics.latency = load.averageLatency;
    metrics.errorRate = load.errorRate;
    metrics.utilization = load.utilization;
    
    // Custom metrics
    metrics.customMetrics = {
      'routers': stats.routers,
      'active_routers': stats.activeRouters,
      'services': stats.services,
      'middlewares': stats.middlewares,
      'entry_points': stats.entryPoints,
      'total_servers': stats.totalServers,
      'healthy_servers': stats.healthyServers,
      'total_requests': stats.totalRequests,
      'total_responses': stats.totalResponses,
      'active_connections': stats.activeConnections,
      'total_bytes_in': stats.totalBytesIn,
      'total_bytes_out': stats.totalBytesOut,
      'error_rate': stats.errorRate,
      'average_latency': stats.averageLatency,
    };
  }

  /**
   * Ansible emulation
   */
  private simulateAnsible(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    const engine = this.ansibleEngines.get(node.id);
    
    if (!engine) {
      // If engine not initialized, use default metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0;
      return;
    }
    
    // Metrics are updated in simulate() method after performUpdate()
    // This method is called before performUpdate, so we use current metrics
    const ansibleMetrics = engine.getMetrics();
    
    // Throughput: jobs per hour converted to per second
    metrics.throughput = ansibleMetrics.jobsPerHour / 3600;
    
    // Latency: average job duration in milliseconds
    metrics.latency = ansibleMetrics.averageJobDuration * 1000;
    
    // Error rate: failed jobs / total jobs
    const totalJobs = ansibleMetrics.jobsSuccess + ansibleMetrics.jobsFailed;
    metrics.errorRate = totalJobs > 0 
      ? ansibleMetrics.jobsFailed / totalJobs 
      : 0;
    
    // Utilization: running jobs / enabled templates (or total templates if no enabled)
    const enabledTemplates = ansibleMetrics.jobTemplatesEnabled || ansibleMetrics.jobTemplatesTotal || 1;
    metrics.utilization = Math.min(1, ansibleMetrics.jobsRunning / enabledTemplates);
    
    metrics.customMetrics = {
      inventoriesTotal: ansibleMetrics.inventoriesTotal,
      projectsTotal: ansibleMetrics.projectsTotal,
      credentialsTotal: ansibleMetrics.credentialsTotal,
      jobTemplatesTotal: ansibleMetrics.jobTemplatesTotal,
      jobTemplatesEnabled: ansibleMetrics.jobTemplatesEnabled,
      jobsTotal: ansibleMetrics.jobsTotal,
      jobsSuccess: ansibleMetrics.jobsSuccess,
      jobsFailed: ansibleMetrics.jobsFailed,
      jobsRunning: ansibleMetrics.jobsRunning,
      jobsPending: ansibleMetrics.jobsPending,
      jobsPerHour: ansibleMetrics.jobsPerHour,
      averageJobDuration: ansibleMetrics.averageJobDuration,
      hostsTotal: ansibleMetrics.hostsTotal,
      hostsOk: ansibleMetrics.hostsOk,
      hostsChanged: ansibleMetrics.hostsChanged,
      hostsFailed: ansibleMetrics.hostsFailed,
      hostsUnreachable: ansibleMetrics.hostsUnreachable,
      schedulesTotal: ansibleMetrics.schedulesTotal,
      schedulesEnabled: ansibleMetrics.schedulesEnabled,
      requestsTotal: ansibleMetrics.requestsTotal,
      requestsErrors: ansibleMetrics.requestsErrors,
    };
  }

  /**
   * Harbor emulation
   */
  private simulateHarbor(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    const engine = this.harborEngines.get(node.id);

    if (!engine) {
      // If engine not initialized, use default metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0.1;
      return;
    }

    const load = engine.calculateLoad();
    const harborMetrics = engine.getMetrics();

    // Throughput = все операции в секунду (push, pull, scan, replication)
    metrics.throughput = load.throughput;

    // Latency = средняя латентность операций
    metrics.latency = load.averageLatency;

    // Error rate = доля неуспешных операций
    metrics.errorRate = load.errorRate;

    // Utilization = среднее использование ресурсов (CPU, память, хранилище, сеть)
    metrics.utilization = (load.cpuUtilization + load.memoryUtilization + load.storageUtilization + load.networkUtilization) / 4;

    metrics.customMetrics = {
      ...(metrics.customMetrics || {}),
      harbor_push_ops_per_sec: harborMetrics.pushOperationsPerSecond,
      harbor_pull_ops_per_sec: harborMetrics.pullOperationsPerSecond,
      harbor_scan_ops_per_sec: harborMetrics.scanOperationsPerSecond,
      harbor_replication_ops_per_sec: harborMetrics.replicationOperationsPerSecond,
      harbor_avg_push_latency: harborMetrics.averagePushLatency,
      harbor_avg_pull_latency: harborMetrics.averagePullLatency,
      harbor_avg_scan_latency: harborMetrics.averageScanLatency,
      harbor_storage_used: harborMetrics.storageUsed,
      harbor_storage_total: harborMetrics.storageTotal,
      harbor_projects_total: harborMetrics.totalProjects,
      harbor_repositories_total: harborMetrics.totalRepositories,
      harbor_tags_total: harborMetrics.totalTags,
      harbor_vulnerabilities_total: harborMetrics.totalVulnerabilities,
      harbor_scans_completed: harborMetrics.scansCompleted,
      harbor_scans_running: harborMetrics.scansRunning,
      harbor_scans_failed: harborMetrics.scansFailed,
      harbor_replication_policies_enabled: harborMetrics.replicationPoliciesEnabled,
      harbor_active_replications: harborMetrics.activeReplications,
      harbor_gc_operations_total: harborMetrics.gcOperationsTotal,
      harbor_gc_storage_freed: harborMetrics.gcStorageFreed,
      harbor_cpu_utilization: load.cpuUtilization,
      harbor_memory_utilization: load.memoryUtilization,
      harbor_storage_utilization: load.storageUtilization,
      harbor_network_utilization: load.networkUtilization,
    };
  }

  /**
   * Docker emulation
   */
  private simulateDocker(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    const engine = this.dockerEngines.get(node.id);

    if (!engine) {
      // If engine not initialized, use default metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0.1;
      return;
    }

    const load = engine.calculateLoad();
    const dockerMetrics = engine.getMetrics();

    // Throughput = все операции в секунду (container ops, image ops)
    metrics.throughput = load.throughput;

    // Latency = средняя латентность операций
    metrics.latency = load.averageLatency;

    // Error rate = доля неуспешных операций
    metrics.errorRate = load.errorRate;

    // Utilization = среднее использование ресурсов (CPU, память, сеть, диск)
    metrics.utilization = (load.cpuUtilization + load.memoryUtilization + load.networkUtilization + load.diskUtilization) / 4;

    metrics.customMetrics = {
      ...(metrics.customMetrics || {}),
      docker_containers_total: dockerMetrics.containersTotal,
      docker_containers_running: dockerMetrics.containersRunning,
      docker_containers_stopped: dockerMetrics.containersStopped,
      docker_containers_paused: dockerMetrics.containersPaused,
      docker_images_total: dockerMetrics.imagesTotal,
      docker_images_size: dockerMetrics.imagesSize,
      docker_networks_total: dockerMetrics.networksTotal,
      docker_volumes_total: dockerMetrics.volumesTotal,
      docker_volumes_size: dockerMetrics.volumesSize,
      docker_ops_per_sec: dockerMetrics.operationsPerSecond,
      docker_avg_operation_latency: dockerMetrics.averageOperationLatency,
      docker_total_cpu_usage: dockerMetrics.totalCpuUsage,
      docker_total_memory_usage: dockerMetrics.totalMemoryUsage,
      docker_total_memory_limit: dockerMetrics.totalMemoryLimit,
      docker_total_network_rx: dockerMetrics.totalNetworkRx,
      docker_total_network_tx: dockerMetrics.totalNetworkTx,
      docker_build_ops_per_sec: dockerMetrics.buildOperationsPerSecond,
      docker_pull_ops_per_sec: dockerMetrics.pullOperationsPerSecond,
      docker_push_ops_per_sec: dockerMetrics.pushOperationsPerSecond,
      docker_cpu_utilization: load.cpuUtilization,
      docker_memory_utilization: load.memoryUtilization,
      docker_network_utilization: load.networkUtilization,
      docker_disk_utilization: load.diskUtilization,
    };
  }

  /**
   * Kubernetes emulation
   */
  private simulateKubernetes(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    const engine = this.kubernetesEngines.get(node.id);

    if (!engine) {
      // If engine not initialized, use default metrics
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0.1;
      return;
    }

    const load = engine.getLoad();
    const kubernetesMetrics = engine.getMetrics();

    // Throughput = pod operations per second
    metrics.throughput = load.throughput;

    // Latency = average scheduling and pod creation latency
    metrics.latency = load.averageLatency;

    // Error rate = failed pods / total pods
    metrics.errorRate = load.errorRate;

    // Utilization = average resource utilization (CPU, memory, pods, network, disk)
    metrics.utilization = (load.cpuUtilization + load.memoryUtilization + load.podUtilization + load.networkUtilization + load.diskUtilization) / 5;

    metrics.customMetrics = {
      ...(metrics.customMetrics || {}),
      k8s_pods_total: kubernetesMetrics.podsTotal,
      k8s_pods_running: kubernetesMetrics.podsRunning,
      k8s_pods_pending: kubernetesMetrics.podsPending,
      k8s_pods_failed: kubernetesMetrics.podsFailed,
      k8s_pods_succeeded: kubernetesMetrics.podsSucceeded,
      k8s_deployments_total: kubernetesMetrics.deploymentsTotal,
      k8s_deployments_ready: kubernetesMetrics.deploymentsReady,
      k8s_deployments_not_ready: kubernetesMetrics.deploymentsNotReady,
      k8s_services_total: kubernetesMetrics.servicesTotal,
      k8s_services_clusterip: kubernetesMetrics.servicesClusterIP,
      k8s_services_nodeport: kubernetesMetrics.servicesNodePort,
      k8s_services_loadbalancer: kubernetesMetrics.servicesLoadBalancer,
      k8s_nodes_total: kubernetesMetrics.nodesTotal,
      k8s_nodes_ready: kubernetesMetrics.nodesReady,
      k8s_nodes_not_ready: kubernetesMetrics.nodesNotReady,
      k8s_namespaces_total: kubernetesMetrics.namespacesTotal,
      k8s_configmaps_total: kubernetesMetrics.configMapsTotal,
      k8s_secrets_total: kubernetesMetrics.secretsTotal,
      k8s_total_cpu_usage: kubernetesMetrics.totalCpuUsage,
      k8s_total_memory_usage: kubernetesMetrics.totalMemoryUsage,
      k8s_total_memory_capacity: kubernetesMetrics.totalMemoryCapacity,
      k8s_cpu_utilization: load.cpuUtilization,
      k8s_memory_utilization: load.memoryUtilization,
      k8s_pod_utilization: load.podUtilization,
      k8s_network_utilization: load.networkUtilization,
      k8s_disk_utilization: load.diskUtilization,
    };
  }

  /**
   * IDS/IPS emulation
   */
  private simulateIDSIPS(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    const engine = this.idsIpsEngines.get(node.id);

    if (!engine) {
      // Если двигатель не инициализирован, считаем, что IDS/IPS простаивает
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0.1;
      return;
    }

    const load = engine.calculateLoad();
    const idsIpsMetrics = engine.getMetrics();
    const stats = engine.getStats();

    // Throughput = все пакеты в секунду
    metrics.throughput = load.packetsPerSecond;

    // Latency = средняя латентность обработки пакета
    metrics.latency = load.averageLatency;

    // Error rate = доля заблокированных пакетов (в IPS режиме)
    // В IDS режиме ошибок нет, только обнаружение
    const idsIpsConfig = engine.getConfig();
    if (idsIpsConfig?.mode === 'ips') {
      metrics.errorRate = load.blockRate;
    } else {
      // В IDS режиме ошибок нет, только метрики обнаружения
      metrics.errorRate = 0;
    }

    // Utilization — функция от количества сигнатур, PPS и сложности проверок
    const signaturesFactor = Math.min(0.3, (idsIpsMetrics.activeSignatures || 0) / 100);
    const ppsFactor = Math.min(0.3, load.packetsPerSecond / 10000);
    const signatureDetectionFactor = idsIpsConfig?.enableSignatureDetection ? 0.15 : 0;
    const anomalyDetectionFactor = idsIpsConfig?.enableAnomalyDetection ? 0.15 : 0;
    const behavioralAnalysisFactor = idsIpsConfig?.enableBehavioralAnalysis ? 0.1 : 0;

    metrics.utilization = Math.min(0.95, 0.1 + signaturesFactor + ppsFactor + signatureDetectionFactor + anomalyDetectionFactor + behavioralAnalysisFactor);

    metrics.customMetrics = {
      ...(metrics.customMetrics || {}),
      idsips_packets_total: idsIpsMetrics.packetsTotal,
      idsips_packets_analyzed: idsIpsMetrics.packetsAnalyzed,
      idsips_alerts_generated: idsIpsMetrics.alertsGenerated,
      idsips_alerts_blocked: idsIpsMetrics.alertsBlocked,
      idsips_signature_matches: idsIpsMetrics.signatureMatches,
      idsips_anomaly_detections: idsIpsMetrics.anomalyDetections,
      idsips_behavioral_detections: idsIpsMetrics.behavioralDetections,
      idsips_active_signatures: idsIpsMetrics.activeSignatures,
      idsips_blocked_ips: idsIpsMetrics.blockedIPs,
      idsips_alert_rate: load.alertRate,
      idsips_block_rate: load.blockRate,
    };

    // Обновляем percentiles
    this.updateLatencyPercentiles(node.id, metrics.latency, metrics);

    // Симуляция входящих пакетов, если нет реальных соединений
    if (!hasIncomingConnections) {
      const incomingConnections = this.connections.filter(c => c.target === node.id);
      let estimatedPPS = 0;

      for (const conn of incomingConnections) {
        const sourceMetrics = this.metrics.get(conn.source);
        if (sourceMetrics) {
          // Преобразуем throughput в пакеты в секунду (примерно)
          estimatedPPS += sourceMetrics.throughput || 0;
        }
      }

      // Если нет реальных пакетов, симулируем их
      if (estimatedPPS > 0) {
        engine.setSimulatedPacketRate(estimatedPPS);
        engine.simulatePackets(estimatedPPS);
      }
    }
  }

  /**
   * PagerDuty emulation
   */
  private simulatePagerDuty(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    const pagerDutyEngine = this.pagerDutyEngines.get(node.id);

    if (!pagerDutyEngine) {
      metrics.throughput = 0;
      metrics.latency = 0;
      metrics.errorRate = 0;
      metrics.utilization = 0.1;
      return;
    }

    const load = pagerDutyEngine.calculateLoad();
    const engineMetrics = pagerDutyEngine.getMetrics();

    metrics.throughput = load.throughput;
    metrics.latency = load.latency;
    metrics.errorRate = load.errorRate;
    metrics.utilization = load.utilization;

    metrics.customMetrics = {
      'incidents_total': engineMetrics.incidentsTotal,
      'incidents_active': engineMetrics.incidentsActive,
      'incidents_resolved': engineMetrics.incidentsResolved,
      'notifications_sent': engineMetrics.notificationsSent,
      'escalations_triggered': engineMetrics.escalationsTriggered,
      'acknowledgements': engineMetrics.acknowledgements,
      'average_ack_latency_ms': engineMetrics.averageAckLatency,
      'average_resolve_latency_ms': engineMetrics.averageResolveLatency,
      'api_requests_per_second': engineMetrics.apiRequestsPerSecond,
      'webhooks_per_second': engineMetrics.webhooksPerSecond,
      'cpu_utilization': engineMetrics.cpuUtilization,
      'memory_utilization': engineMetrics.memoryUtilization,
    };
  }

  /**
   * Loki emulation
   */
  private simulateLoki(node: CanvasNode, config: ComponentConfig, metrics: ComponentMetrics, hasIncomingConnections: boolean) {
    // Initialize Loki engine if not exists
    if (!this.lokiEngines.has(node.id)) {
      const lokiEngine = new LokiEmulationEngine();
      lokiEngine.initializeConfig(node);
      this.lokiEngines.set(node.id, lokiEngine);
    }

    const lokiEngine = this.lokiEngines.get(node.id)!;
    
    // Process ingestion from incoming connections
    if (hasIncomingConnections) {
      this.processLokiIngestion(node, lokiEngine);
    }

    // Get Loki metrics (ingestion load, query load, etc.)
    const lokiMetrics = lokiEngine.getLokiMetrics();
    const load = lokiEngine.calculateLoad();
    
    // Loki throughput = ingestion lines per second + query requests per second
    metrics.throughput = load.ingestionLinesPerSecond + load.queriesPerSecond;
    
    // Loki latency = average ingestion latency + average query latency (weighted)
    const ingestionWeight = load.ingestionLinesPerSecond / (load.ingestionLinesPerSecond + load.queriesPerSecond || 1);
    const queryWeight = 1 - ingestionWeight;
    metrics.latency = load.averageIngestionLatency * ingestionWeight + load.averageQueryLatency * queryWeight;
    
    // Error rate from ingestion and queries
    metrics.errorRate = (load.ingestionErrorRate * ingestionWeight) + (load.queryErrorRate * queryWeight);
    
    // Utilization based on storage and stream count
    const streamUtilization = Math.min(1, load.streamCount / (config.maxStreams as number || 10000));
    metrics.utilization = Math.max(load.storageUtilization, streamUtilization);
    
    // Custom metrics
    metrics.customMetrics = {
      'ingestion_lines_per_second': load.ingestionLinesPerSecond,
      'ingestion_bytes_per_second': load.ingestionBytesPerSecond,
      'ingestion_requests_total': lokiMetrics.ingestionRequestsTotal,
      'ingestion_errors_total': lokiMetrics.ingestionErrorsTotal,
      'ingestion_lines_total': lokiMetrics.ingestionLinesTotal,
      'ingestion_bytes_total': lokiMetrics.ingestionBytesTotal,
      'queries_per_second': load.queriesPerSecond,
      'query_requests_total': lokiMetrics.queryRequestsTotal,
      'query_errors_total': lokiMetrics.queryErrorsTotal,
      'average_query_latency': load.averageQueryLatency,
      'average_ingestion_latency': load.averageIngestionLatency,
      'active_streams': load.streamCount,
      'total_storage_size': lokiMetrics.totalStorageSize,
      'storage_utilization': load.storageUtilization,
      'retention_deletions': lokiMetrics.retentionDeletions,
    };
  }

  /**
   * Process ingestion logs from incoming connections to Loki
   */
  private processLokiIngestion(node: CanvasNode, lokiEngine: LokiEmulationEngine): void {
    const incomingConnections = this.connections.filter(c => c.target === node.id);
    
    for (const conn of incomingConnections) {
      const sourceNode = this.nodes.find(n => n.id === conn.source);
      if (!sourceNode) continue;

      const connMetrics = this.connectionMetrics.get(conn.id);
      if (!connMetrics || connMetrics.traffic === 0) continue;

      // Estimate log lines per second from connection traffic
      // Assume average log line size of 200 bytes
      const avgLogLineSize = 200;
      const estimatedLinesPerSecond = connMetrics.traffic / avgLogLineSize;
      
      // Generate log entries based on source component type
      const logs = this.generateLogsFromComponent(sourceNode, estimatedLinesPerSecond);
      
      if (logs.length > 0) {
        lokiEngine.processIngestion(logs, sourceNode.id);
      }
    }
  }

  /**
   * Generate log entries from component (simulates log generation)
   */
  private generateLogsFromComponent(
    node: CanvasNode,
    linesPerSecond: number
  ): Array<{ stream: Record<string, string>; values: Array<[string, string]> }> {
    const logs: Array<{ stream: Record<string, string>; values: Array<[string, string]> }> = [];
    
    // Generate logs based on component type
    const componentType = node.type;
    const componentLabel = node.data.label || node.id;
    
    // Create stream labels based on component
    const streamLabels: Record<string, string> = {
      app: componentLabel.toLowerCase().replace(/\s+/g, '-'),
      component: componentType,
      source: node.id.slice(0, 8),
    };

    // Get component metrics to generate realistic logs
    const metrics = this.metrics.get(node.id);
    
    // Generate log entries (simplified - in real system would be more sophisticated)
    const numBatches = Math.ceil(linesPerSecond / 100); // Batch size of 100 lines
    const linesPerBatch = Math.floor(linesPerSecond / numBatches) || 1;
    
    for (let i = 0; i < numBatches && i < 10; i++) { // Limit to 10 batches per cycle
      const values: Array<[string, string]> = [];
      
      for (let j = 0; j < linesPerBatch; j++) {
        const timestamp = Date.now() * 1000000 + j; // nanoseconds
        const logLevel = this.getLogLevel(metrics);
        const logMessage = this.generateLogMessage(componentType, componentLabel, logLevel, metrics);
        
        values.push([timestamp.toString(), logMessage]);
      }
      
      if (values.length > 0) {
        logs.push({
          stream: { ...streamLabels, level: this.getLogLevel(metrics) },
          values,
        });
      }
    }
    
    return logs;
  }

  /**
   * Get log level based on component metrics
   */
  private getLogLevel(metrics?: ComponentMetrics): string {
    if (!metrics) return 'info';
    
    if (metrics.errorRate > 0.1) return 'error';
    if (metrics.errorRate > 0.05) return 'warn';
    if (metrics.utilization > 0.9) return 'warn';
    return 'info';
  }

  /**
   * Generate log message based on component
   */
  private generateLogMessage(
    componentType: string,
    componentLabel: string,
    level: string,
    metrics?: ComponentMetrics
  ): string {
    const timestamp = new Date().toISOString();
    
    if (level === 'error' && metrics) {
      return `[${timestamp}] ERROR ${componentType}: Request failed, error rate: ${(metrics.errorRate * 100).toFixed(2)}%`;
    }
    
    if (level === 'warn' && metrics) {
      return `[${timestamp}] WARN ${componentType}: High utilization: ${(metrics.utilization * 100).toFixed(2)}%`;
    }
    
    return `[${timestamp}] INFO ${componentType}: ${componentLabel} processing requests, throughput: ${metrics?.throughput.toFixed(2) || 0}/s`;
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
   * Initialize Cloud API Gateway emulation engine for a node
   */
  private initializeCloudAPIGatewayEngine(node: CanvasNode): void {
    const config = (node.data.config || {}) as unknown as BaseAPIGatewayConfig;
    
    // Ensure provider is set
    if (!config.provider) {
      config.provider = 'aws'; // Default provider
    }
    
    const gatewayEngine = new CloudAPIGatewayEmulationEngine(config);
    this.cloudAPIGatewayEngines.set(node.id, gatewayEngine);
  }

  /**
   * Initialize NGINX routing engine for a node
   */
  private initializeNginxRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;
    
    const routingEngine = new NginxRoutingEngine();
    
    routingEngine.initialize({
      locations: config.locations || [],
      upstreams: config.upstreams || [],
      rateLimitZones: config.rateLimitZones || [],
      sslCertificates: config.sslCertificates || [],
      enableSSL: config.enableSSL,
      sslPort: config.sslPort,
      enableGzip: config.enableGzip,
      enableCache: config.enableCache,
      maxWorkers: config.maxWorkers,
    });
    
    this.nginxRoutingEngines.set(node.id, routingEngine);
  }

  /**
   * Initialize HAProxy routing engine for a node
   */
  private initializeHAProxyRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;
    
    const routingEngine = new HAProxyRoutingEngine();
    
    // Transform config format from UI to routing engine format
    const frontends = (config.frontends || []).map((fe: any) => ({
      id: fe.id,
      name: fe.name,
      bind: fe.bind,
      mode: fe.mode,
      defaultBackend: fe.backends && fe.backends.length > 0 ? fe.backends[0] : undefined,
      backends: fe.backends,
      ssl: fe.ssl,
      requests: fe.requests || 0,
      responses: fe.responses || 0,
      bytesIn: fe.bytesIn || 0,
      bytesOut: fe.bytesOut || 0,
    }));
    
    const backends = (config.backends || []).map((be: any) => ({
      id: be.id,
      name: be.name,
      mode: be.mode,
      balance: be.balance,
      servers: be.servers || [],
      healthCheck: be.healthCheck,
      stickTable: be.stickTable,
    }));
    
    routingEngine.initialize({
      frontends,
      backends,
    });
    
    this.haproxyRoutingEngines.set(node.id, routingEngine);
  }

  /**
   * Initialize Envoy routing engine for a node
   */
  private initializeEnvoyRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;
    
    const routingEngine = new EnvoyRoutingEngine();
    
    // Transform config format from UI to routing engine format
    const clusters = (config.clusters || []).map((cluster: any) => ({
      name: cluster.name,
      type: cluster.type || 'STRICT_DNS',
      endpoints: (cluster.hosts || []).map((host: any) => ({
        address: host.address,
        port: host.port,
        weight: host.weight || 1,
        healthStatus: host.healthStatus || 'unknown',
      })),
      connectTimeout: cluster.connectTimeout || 5000,
      healthCheck: cluster.healthChecks ? {
        enabled: true,
        interval: cluster.healthCheckInterval || 10000,
        timeout: cluster.healthCheckTimeout || 5000,
        path: cluster.healthCheckPath || '/health',
        healthyThreshold: cluster.healthCheckHealthyThreshold || 1,
        unhealthyThreshold: cluster.healthCheckUnhealthyThreshold || 2,
      } : undefined,
      circuitBreaker: cluster.circuitBreaker ? {
        enabled: true,
        maxConnections: cluster.circuitBreakerMaxConnections,
        maxRequests: cluster.circuitBreakerMaxRequests,
        maxRetries: cluster.circuitBreakerMaxRetries,
        consecutiveErrors: cluster.circuitBreakerConsecutiveErrors || 5,
      } : undefined,
      loadBalancingPolicy: cluster.loadBalancingPolicy || 'ROUND_ROBIN',
      outlierDetection: cluster.outlierDetection ? {
        enabled: true,
        consecutiveErrors: cluster.outlierDetectionConsecutiveErrors || 5,
        interval: cluster.outlierDetectionInterval || 10000,
        baseEjectionTime: cluster.outlierDetectionBaseEjectionTime || 30000,
        maxEjectionPercent: cluster.outlierDetectionMaxEjectionPercent || 50,
      } : undefined,
    }));
    
    const listeners = (config.listeners || []).map((listener: any) => ({
      name: listener.name,
      address: listener.address || '0.0.0.0',
      port: listener.port,
      protocol: listener.protocol || 'HTTP',
      filters: (listener.filters || []).map((filter: string | any) => 
        typeof filter === 'string' ? {
          name: filter,
          type: filter,
        } : filter
      ),
    }));
    
    const routes = (config.routes || []).map((route: any) => ({
      name: route.name,
      match: {
        prefix: route.match?.startsWith('/') ? route.match : undefined,
        path: route.match && !route.match.includes('*') && !route.match.startsWith('/') ? route.match : undefined,
        regex: route.match?.includes('*') ? route.match.replace(/\*/g, '.*') : undefined,
      },
      cluster: route.cluster,
      priority: route.priority || 0,
      timeout: route.timeout,
      retryPolicy: route.retryPolicy,
    }));
    
    routingEngine.initialize({
      clusters,
      listeners,
      routes,
      globalConfig: {
        maxConnections: config.maxConnections || 1024,
        connectTimeout: config.connectTimeout || 5000,
        requestTimeout: config.requestTimeout || 15000,
        drainTime: config.drainTime || 600,
        rateLimit: config.enableRateLimiting ? {
          enabled: true,
          rate: config.rateLimitPerSecond || 100,
          burst: config.rateLimitBurst || 10,
        } : undefined,
        tracing: config.enableTracing ? {
          enabled: true,
          provider: config.tracingProvider || 'jaeger',
        } : undefined,
      },
    });
    
    this.envoyRoutingEngines.set(node.id, routingEngine);
  }

  /**
   * Initialize Service Mesh routing engine for a node
   */
  private initializeServiceMeshRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;
    
    const routingEngine = new ServiceMeshRoutingEngine();
    
    // Initialize with service mesh config
    routingEngine.initialize({
      services: config.services || [],
      virtualServices: config.virtualServices || [],
      destinationRules: config.destinationRules || [],
      gateways: config.gateways || [],
      peerAuthentications: config.peerAuthentications || [],
      authorizationPolicies: config.authorizationPolicies || [],
      serviceEntries: config.serviceEntries || [],
      sidecars: config.sidecars || [],
      globalConfig: {
        enableMTLS: config.enableMTLS,
        mtlsMode: config.mtlsMode,
        enableTracing: config.enableTracing,
        tracingProvider: config.tracingProvider,
        enableMetrics: config.enableMetrics,
        metricsProvider: config.metricsProvider,
        enableAccessLog: config.enableAccessLog,
        maxConnections: config.maxConnections,
        defaultTimeout: config.defaultTimeout,
        defaultRetryAttempts: config.defaultRetryAttempts,
        defaultLoadBalancer: config.defaultLoadBalancer,
      },
    });
    
    this.serviceMeshRoutingEngines.set(node.id, routingEngine);
  }

  /**
   * Initialize Istio routing engine for a node
   */
  private initializeIstioRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;
    
    const routingEngine = new IstioRoutingEngine();
    
    // Transform config format from UI to routing engine format
    const services = (config.services || []).map((service: any) => ({
      id: service.id || service.name,
      name: service.name,
      namespace: service.namespace || 'default',
      host: service.host || `${service.name}.${service.namespace || 'default'}.svc.cluster.local`,
      ports: service.ports || [{ number: 80, protocol: 'HTTP' as const }],
      labels: service.labels || {},
      requests: service.requests || 0,
      errors: service.errors || 0,
      latency: service.latency || 0,
      pods: service.pods || 1,
      healthyPods: service.healthyPods || service.pods || 1,
    }));
    
    const virtualServices = (config.virtualServices || []).map((vs: any) => ({
      id: vs.id || vs.name,
      name: vs.name,
      namespace: vs.namespace || 'default',
      hosts: vs.hosts || [],
      gateways: vs.gateways || [],
      http: vs.http || [],
      tcp: vs.tcp || [],
      tls: vs.tls || [],
    }));
    
    const destinationRules = (config.destinationRules || []).map((dr: any) => ({
      id: dr.id || dr.name,
      name: dr.name,
      namespace: dr.namespace || 'default',
      host: dr.host,
      subsets: dr.subsets || [],
      trafficPolicy: dr.trafficPolicy || {},
    }));
    
    const gateways = (config.gateways || []).map((gw: any) => ({
      id: gw.id || gw.name,
      name: gw.name,
      namespace: gw.namespace || 'default',
      selector: gw.selector || {},
      servers: gw.servers || [],
    }));
    
    const peerAuthentications = (config.peerAuthentications || []).map((pa: any) => ({
      id: pa.id || pa.name,
      name: pa.name,
      namespace: pa.namespace || 'default',
      selector: pa.selector || {},
      mtls: pa.mtls || { mode: 'PERMISSIVE' as const },
      portLevelMtls: pa.portLevelMtls || {},
    }));
    
    const authorizationPolicies = (config.authorizationPolicies || []).map((ap: any) => ({
      id: ap.id || ap.name,
      name: ap.name,
      namespace: ap.namespace || 'default',
      selector: ap.selector || {},
      action: ap.action || 'ALLOW' as const,
      rules: ap.rules || [],
    }));
    
    const serviceEntries = (config.serviceEntries || []).map((se: any) => ({
      id: se.id || se.name,
      name: se.name,
      namespace: se.namespace || 'default',
      hosts: se.hosts || [],
      addresses: se.addresses || [],
      ports: se.ports || [],
      location: se.location || 'MESH_EXTERNAL' as const,
      resolution: se.resolution || 'DNS' as const,
      endpoints: se.endpoints || [],
    }));
    
    const sidecars = (config.sidecars || []).map((sc: any) => ({
      id: sc.id || sc.name,
      name: sc.name,
      namespace: sc.namespace || 'default',
      workloadSelector: sc.workloadSelector || {},
      egress: sc.egress || [],
      ingress: sc.ingress || [],
    }));
    
    routingEngine.initialize({
      services,
      virtualServices,
      destinationRules,
      gateways,
      peerAuthentications,
      authorizationPolicies,
      serviceEntries,
      sidecars,
      globalConfig: {
        enableMTLS: config.enableMTLS ?? true,
        mtlsMode: config.mtlsMode || 'PERMISSIVE',
        enableTracing: config.enableTracing ?? true,
        tracingProvider: config.tracingProvider || 'jaeger',
        enableMetrics: config.enableMetrics ?? true,
        metricsProvider: config.metricsProvider || 'prometheus',
        enableAccessLog: config.enableAccessLog ?? true,
        maxConnections: config.maxConnections || 10000,
        defaultTimeout: config.defaultTimeout || '30s',
        defaultRetryAttempts: config.defaultRetryAttempts || 3,
      },
    });
    
    this.istioRoutingEngines.set(node.id, routingEngine);
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
   * Initialize REST API routing engine for a node
   */
  private initializeRestApiRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;
    const routingEngine = new RestApiRoutingEngine();

    routingEngine.initialize({
      baseUrl: config.baseUrl || 'https://api.example.com',
      version: config.version || 'v1',
      title: config.title || 'REST API',
      description: config.description || 'RESTful API service',
      endpoints: (config.endpoints || []).map((endpoint: any) => ({
        id: endpoint.id || `${endpoint.method}:${endpoint.path}`,
        path: endpoint.path,
        method: endpoint.method,
        description: endpoint.description,
        summary: endpoint.summary,
        tags: endpoint.tags,
        parameters: endpoint.parameters,
        requestBody: endpoint.requestBody,
        responseExample: endpoint.responseExample,
        targetService: endpoint.targetService,
        enabled: endpoint.enabled !== false,
        timeout: endpoint.timeout,
        rateLimit: endpoint.rateLimit,
      })),
      authentication: config.authentication || { type: 'none' },
      rateLimit: config.rateLimit,
      cors: config.cors,
    });

    this.restApiRoutingEngines.set(node.id, routingEngine);
  }

  /**
   * Initialize gRPC routing engine for a node
   */
  private initializeGRPCRoutingEngine(node: CanvasNode): void {
    const config = (node.data.config || {}) as any;
    const routingEngine = new GRPCRoutingEngine();

    routingEngine.initialize({
      endpoint: config.endpoint || 'localhost:50051',
      services: (config.services || []).map((service: any) => ({
        name: service.name,
        methods: (service.methods || []).map((method: any) => ({
          name: method.name,
          inputType: method.inputType || 'google.protobuf.Empty',
          outputType: method.outputType || 'google.protobuf.Empty',
          streaming: method.streaming || 'unary',
          enabled: method.enabled !== false,
          timeout: method.timeout,
          rateLimit: method.rateLimit,
          retryPolicy: method.retryPolicy,
        })),
        enabled: service.enabled !== false,
      })),
      reflectionEnabled: config.reflectionEnabled ?? true,
      enableTLS: config.enableTLS ?? false,
      enableCompression: config.enableCompression ?? true,
      maxMessageSize: config.maxMessageSize || 4,
      keepAliveTime: config.keepAliveTime || 30,
      keepAliveTimeout: config.keepAliveTimeout || 5,
      maxConnectionIdle: config.maxConnectionIdle || 300,
      maxConnectionAge: config.maxConnectionAge || 3600,
      maxConnectionAgeGrace: config.maxConnectionAgeGrace || 5,
      authentication: config.authentication || { type: 'none' },
      rateLimit: config.rateLimit,
      loadBalancing: config.loadBalancing,
    });

    this.grpcRoutingEngines.set(node.id, routingEngine);
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
   * Initialize GraphQL Emulation Engine for GraphQL node
   */
  private initializeGraphQLEngine(node: CanvasNode): void {
    const graphQLEngine = new GraphQLEmulationEngine();
    graphQLEngine.initializeConfig(node);
    this.graphQLEngines.set(node.id, graphQLEngine);
  }

  /**
   * Initialize SOAP Emulation Engine for SOAP node
   */
  private initializeSOAPEngine(node: CanvasNode): void {
    const soapEngine = new SOAPEmulationEngine();
    soapEngine.initializeConfig(node);
    this.soapEngines.set(node.id, soapEngine);
  }

  /**
   * Initialize WebSocket Emulation Engine for WebSocket node
   */
  private initializeWebSocketEngine(node: CanvasNode): void {
    const wsEngine = new WebSocketEmulationEngine();
    wsEngine.initialize(node, async (sourceId, targetId, message) => {
      return await dataFlowEngine.sendMessage(sourceId, targetId, message);
    });
    this.websocketEngines.set(node.id, wsEngine);
  }

  /**
   * Initialize Jaeger Emulation Engine for Jaeger node
   */
  private initializeJaegerEngine(node: CanvasNode): void {
    const jaegerEngine = new JaegerEmulationEngine();
    jaegerEngine.initializeConfig(node);
    this.jaegerEngines.set(node.id, jaegerEngine);
  }

  /**
   * Initialize OpenTelemetry Collector Routing Engine for otel-collector node
   */
  private initializeOpenTelemetryCollectorEngine(node: CanvasNode): void {
    if (!this.otelCollectorEngines.has(node.id)) {
      const otelEngine = new OpenTelemetryCollectorRoutingEngine();
      otelEngine.initializeConfig(node);
      this.otelCollectorEngines.set(node.id, otelEngine);
    } else {
      // Update config if engine already exists
      const otelEngine = this.otelCollectorEngines.get(node.id)!;
      otelEngine.initializeConfig(node);
    }
  }

  /**
   * Initialize PagerDuty Emulation Engine for PagerDuty node
   */
  private initializePagerDutyEngine(node: CanvasNode): void {
    const engine = new PagerDutyEmulationEngine();
    engine.initializeFromNode(node);
    this.pagerDutyEngines.set(node.id, engine);
  }

  /**
   * Initialize Keycloak Emulation Engine for Keycloak node
   */
  private initializeKeycloakEngine(node: CanvasNode): void {
    const engine = new KeycloakEmulationEngine();
    engine.initializeConfig(node);
    this.keycloakEngines.set(node.id, engine);
  }

  /**
   * Initialize Vault Emulation Engine for Vault node
   */
  private initializeVaultEngine(node: CanvasNode): void {
    const engine = new VaultEmulationEngine();
    engine.initializeConfig(node);
    this.vaultEngines.set(node.id, engine);
  }

  /**
   * Initialize WAF emulation engine for a node
   */
  private initializeWAFEngine(node: CanvasNode): void {
    const engine = new WAFEmulationEngine();
    engine.initializeConfig(node);
    this.wafEngines.set(node.id, engine);
  }

  /**
   * Initialize Firewall emulation engine for a node
   */
  private initializeFirewallEngine(node: CanvasNode): void {
    const engine = new FirewallEmulationEngine();
    engine.initializeConfig(node);
    this.firewallEngines.set(node.id, engine);
  }

  /**
   * Initialize VPN emulation engine for a node
   */
  private initializeVPNEngine(node: CanvasNode): void {
    const engine = new VPNEmulationEngine();
    engine.initializeConfig(node);
    this.vpnEngines.set(node.id, engine);
  }

  /**
   * Initialize CDN emulation engine for a node
   */
  private initializeCDNEngine(node: CanvasNode): void {
    const engine = new CDNEmulationEngine();
    engine.initializeConfig(node);
    this.cdnEngines.set(node.id, engine);
  }

  /**
   * Initialize IDS/IPS emulation engine for a node
   */
  private initializeIDSIPSEngine(node: CanvasNode): void {
    const engine = new IDSIPSEmulationEngine();
    engine.initializeConfig(node);
    this.idsIpsEngines.set(node.id, engine);
  }

  /**
   * Initialize Jenkins Emulation Engine for Jenkins node
   */
  private initializeJenkinsEngine(node: CanvasNode): void {
    const engine = new JenkinsEmulationEngine();
    engine.initializeConfig(node);
    this.jenkinsEngines.set(node.id, engine);
  }

  /**
   * Initialize GitLab CI Emulation Engine for GitLab CI node
   */
  private initializeGitLabCIEngine(node: CanvasNode): void {
    const engine = new GitLabCIEmulationEngine();
    engine.initializeConfig(node);
    this.gitlabCIEngines.set(node.id, engine);
  }

  private initializeArgoCDEngine(node: CanvasNode): void {
    const engine = new ArgoCDEmulationEngine();
    engine.initializeConfig(node);
    this.argoCDEngines.set(node.id, engine);
  }

  /**
   * Initialize Terraform Emulation Engine for Terraform node
   */
  private initializeTerraformEngine(node: CanvasNode): void {
    const engine = new TerraformEmulationEngine();
    engine.initializeConfig(node);
    this.terraformEngines.set(node.id, engine);
  }

  /**
   * Initialize Ansible Emulation Engine for Ansible node
   */
  private initializeAnsibleEngine(node: CanvasNode): void {
    const engine = new AnsibleEmulationEngine();
    engine.initializeConfig(node);
    this.ansibleEngines.set(node.id, engine);
  }

  /**
   * Initialize Traefik Emulation Engine for Traefik node
   */
  private initializeTraefikEngine(node: CanvasNode): void {
    const engine = new TraefikEmulationEngine();
    engine.initializeConfig(node);
    this.traefikEngines.set(node.id, engine);
  }

  /**
   * Initialize Harbor Emulation Engine for Harbor node
   */
  private initializeHarborEngine(node: CanvasNode): void {
    const engine = new HarborEmulationEngine();
    engine.initializeConfig(node);
    this.harborEngines.set(node.id, engine);
  }

  /**
   * Initialize Docker Emulation Engine for Docker node
   */
  private initializeDockerEngine(node: CanvasNode): void {
    const engine = new DockerEmulationEngine();
    engine.initializeConfig(node);
    this.dockerEngines.set(node.id, engine);
  }

  /**
   * Initialize Kubernetes Emulation Engine for Kubernetes node
   */
  private initializeKubernetesEngine(node: CanvasNode): void {
    const engine = new KubernetesEmulationEngine();
    engine.initializeConfig(node);
    this.kubernetesEngines.set(node.id, engine);
  }

  /**
   * Проверяет доступность Prometheus для Grafana
   */
  /**
   * Создает функцию для выполнения LogQL queries через Loki
   */
  private createLokiQueryExecutor(grafanaNode: CanvasNode): ((query: string, startTime?: number, endTime?: number, limit?: number) => { success: boolean; latency: number; resultsCount: number; error?: string }) | undefined {
    const grafanaConfig = (grafanaNode.data.config as any) || {};
    const datasources = grafanaConfig.datasources || [];
    
    // Находим Loki datasource
    const lokiDatasource = datasources.find((ds: any) => {
      if (typeof ds === 'string') return false;
      return ds.type === 'loki';
    });
    
    if (!lokiDatasource || typeof lokiDatasource === 'string') {
      return undefined; // No Loki datasource configured
    }
    
    // Находим Loki node по URL
    const lokiUrl = lokiDatasource.url || '';
    const lokiNode = this.nodes.find(n => {
      if (n.type !== 'loki') return false;
      const config = (n.data.config as any) || {};
      const nodeUrl = config.serverUrl || 'http://loki:3100';
      return nodeUrl === lokiUrl || lokiUrl.includes(n.id) || lokiUrl.includes(n.data.label || '');
    });
    
    if (!lokiNode) {
      return undefined; // Loki node not found
    }
    
    const lokiEngine = this.lokiEngines.get(lokiNode.id);
    if (!lokiEngine) {
      return undefined; // Loki engine not initialized
    }
    
    // Возвращаем функцию для выполнения queries
    return (query: string, startTime?: number, endTime?: number, limit?: number) => {
      const result = lokiEngine.executeQuery(query, startTime, endTime, limit);
      return {
        success: result.success,
        latency: result.latency,
        resultsCount: result.resultsCount,
        error: result.error,
      };
    };
  }

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
   * Get Cloud API Gateway emulation engine for a node
   */
  public getCloudAPIGatewayEngine(nodeId: string): CloudAPIGatewayEmulationEngine | undefined {
    return this.cloudAPIGatewayEngines.get(nodeId);
  }

  /**
   * Get NGINX routing engine for a node
   */
  public getNginxRoutingEngine(nodeId: string): NginxRoutingEngine | undefined {
    return this.nginxRoutingEngines.get(nodeId);
  }

  /**
   * Get HAProxy routing engine for a node
   */
  public getHAProxyRoutingEngine(nodeId: string): HAProxyRoutingEngine | undefined {
    return this.haproxyRoutingEngines.get(nodeId);
  }

  public getTraefikEmulationEngine(nodeId: string): TraefikEmulationEngine | undefined {
    return this.traefikEngines.get(nodeId);
  }

  /**
   * Get Envoy routing engine for a node
   */
  public getEnvoyRoutingEngine(nodeId: string): EnvoyRoutingEngine | undefined {
    return this.envoyRoutingEngines.get(nodeId);
  }

  /**
   * Get Istio routing engine for a node
   */
  public getIstioRoutingEngine(nodeId: string): IstioRoutingEngine | undefined {
    return this.istioRoutingEngines.get(nodeId);
  }

  /**
   * Get Service Mesh routing engine for a node
   */
  public getServiceMeshRoutingEngine(nodeId: string): ServiceMeshRoutingEngine | undefined {
    return this.serviceMeshRoutingEngines.get(nodeId);
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
   * Get REST API routing engine for a node
   */
  public getRestApiRoutingEngine(nodeId: string): RestApiRoutingEngine | undefined {
    return this.restApiRoutingEngines.get(nodeId);
  }

  /**
   * Get gRPC routing engine for a node
   */
  public getGRPCRoutingEngine(nodeId: string): GRPCRoutingEngine | undefined {
    return this.grpcRoutingEngines.get(nodeId);
  }

  /**
   * Get Webhook Relay routing engine for a node
   */
  public getWebhookRelayRoutingEngine(nodeId: string): WebhookRelayRoutingEngine | undefined {
    return this.webhookRelayRoutingEngines.get(nodeId);
  }

  /**
   * Get Loki emulation engine for a node
   */
  public getLokiEmulationEngine(nodeId: string): LokiEmulationEngine | undefined {
    return this.lokiEngines.get(nodeId);
  }

  /**
   * Get Keycloak emulation engine for a node
   */
  public getKeycloakEmulationEngine(nodeId: string): KeycloakEmulationEngine | undefined {
    return this.keycloakEngines.get(nodeId);
  }

  /**
   * Get Jenkins emulation engine for a node
   */
  public getJenkinsEmulationEngine(nodeId: string): JenkinsEmulationEngine | undefined {
    return this.jenkinsEngines.get(nodeId);
  }

  /**
   * Get GitLab CI emulation engine for a node
   */
  public getGitLabCIEmulationEngine(nodeId: string): GitLabCIEmulationEngine | undefined {
    return this.gitlabCIEngines.get(nodeId);
  }

  /**
   * Get Argo CD emulation engine for a node
   */
  public getArgoCDEmulationEngine(nodeId: string): ArgoCDEmulationEngine | undefined {
    return this.argoCDEngines.get(nodeId);
  }

  /**
   * Get Terraform emulation engine for a node
   */
  public getTerraformEmulationEngine(nodeId: string): TerraformEmulationEngine | undefined {
    return this.terraformEngines.get(nodeId);
  }

  /**
   * Get Ansible emulation engine for a node
   */
  public getAnsibleEmulationEngine(nodeId: string): AnsibleEmulationEngine | undefined {
    return this.ansibleEngines.get(nodeId);
  }

  /**
   * Get Harbor emulation engine for a node
   */
  public getHarborEmulationEngine(nodeId: string): HarborEmulationEngine | undefined {
    return this.harborEngines.get(nodeId);
  }

  /**
   * Get Docker emulation engine for a node
   */
  public getDockerEmulationEngine(nodeId: string): DockerEmulationEngine | undefined {
    return this.dockerEngines.get(nodeId);
  }

  public getKubernetesEmulationEngine(nodeId: string): KubernetesEmulationEngine | undefined {
    return this.kubernetesEngines.get(nodeId);
  }

  /**
   * Get Vault emulation engine for a node
   */
  public getVaultEmulationEngine(nodeId: string): VaultEmulationEngine | undefined {
    return this.vaultEngines.get(nodeId);
  }

  /**
   * Get WAF emulation engine for a node
   */
  public getWAFEmulationEngine(nodeId: string): WAFEmulationEngine | undefined {
    return this.wafEngines.get(nodeId);
  }

  /**
   * Get Firewall emulation engine for a node
   */
  public getFirewallEmulationEngine(nodeId: string): FirewallEmulationEngine | undefined {
    return this.firewallEngines.get(nodeId);
  }

  /**
   * Get VPN emulation engine for a node
   */
  public getVPNEmulationEngine(nodeId: string): VPNEmulationEngine | undefined {
    return this.vpnEngines.get(nodeId);
  }

  /**
   * Get CDN emulation engine for a node
   */
  public getCDNEmulationEngine(nodeId: string): CDNEmulationEngine | undefined {
    return this.cdnEngines.get(nodeId);
  }

  /**
   * Get IDS/IPS emulation engine for a node
   */
  public getIDSIPSEmulationEngine(nodeId: string): IDSIPSEmulationEngine | undefined {
    return this.idsIpsEngines.get(nodeId);
  }

  /**
   * Get GraphQL emulation engine for a node
   */
  public getGraphQLEmulationEngine(nodeId: string): GraphQLEmulationEngine | undefined {
    return this.graphQLEngines.get(nodeId);
  }

  /**
   * Get SOAP emulation engine for a node
   */
  public getSOAPEmulationEngine(nodeId: string): SOAPEmulationEngine | undefined {
    return this.soapEngines.get(nodeId);
  }

  /**
   * Get WebSocket emulation engine for a node
   */
  public getWebSocketEmulationEngine(nodeId: string): WebSocketEmulationEngine | undefined {
    return this.websocketEngines.get(nodeId);
  }

  /**
   * Get Jaeger emulation engine for a node
   */
  public getJaegerEmulationEngine(nodeId: string): JaegerEmulationEngine | undefined {
    return this.jaegerEngines.get(nodeId);
  }

  /**
   * Get all Jaeger emulation engines
   */
  public getAllJaegerEngines(): Map<string, JaegerEmulationEngine> {
    return new Map(this.jaegerEngines);
  }

  /**
   * Get OpenTelemetry Collector routing engine for a node
   */
  public getOpenTelemetryCollectorRoutingEngine(nodeId: string): OpenTelemetryCollectorRoutingEngine | undefined {
    return this.otelCollectorEngines.get(nodeId);
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
   * Get PagerDuty incidents for a specific PagerDuty node
   */
  public getPagerDutyIncidents(nodeId: string): PagerDutyIncident[] {
    const engine = this.pagerDutyEngines.get(nodeId);
    if (!engine) return [];
    return engine.getIncidents();
  }

  /**
   * Get PagerDuty engine metrics for a specific PagerDuty node
   */
  public getPagerDutyMetrics(nodeId: string): PagerDutyEngineMetrics | null {
    const engine = this.pagerDutyEngines.get(nodeId);
    if (!engine) return null;
    return engine.getMetrics();
  }

  /**
   * Manually acknowledge a PagerDuty incident
   */
  public acknowledgePagerDutyIncident(nodeId: string, incidentId: string): void {
    const engine = this.pagerDutyEngines.get(nodeId);
    if (!engine) return;
    engine.acknowledgeIncident(Date.now(), incidentId);
  }

  /**
   * Manually resolve a PagerDuty incident
   */
  public resolvePagerDutyIncident(nodeId: string, incidentId: string): void {
    const engine = this.pagerDutyEngines.get(nodeId);
    if (!engine) return;
    engine.resolveIncidentManually(Date.now(), incidentId);
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

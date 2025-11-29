export type ComponentCategory =
  | 'messaging'
  | 'integration'
  | 'data'
  | 'observability'
  | 'security'
  | 'devops'
  | 'infrastructure'
  | 'edge'
  | 'api'
  | 'ml'
  | 'business';

export interface ComponentType {
  id: string;
  type: string;
  label: string;
  icon: string;
  color: string;
  category: ComponentCategory;
  tags?: string[];
  vendor?: string;
  description?: string;
}

export interface CanvasNode {
  id: string;
  type: ComponentType['type'];
  position: { x: number; y: number };
  data: {
    label: string;
    config?: ComponentConfig;
  };
  selected?: boolean;
}

export interface ComponentConfig {
  // Common
  enabled?: boolean;
  
  // Messaging (Kafka, RabbitMQ)
  topicCount?: number;
  partitions?: number;
  replicationFactor?: number;
  throughputMsgs?: number;
  
  // Database
  maxConnections?: number;
  queryLatency?: number;
  indexCount?: number;
  
  // Infrastructure (NGINX, Docker, K8s)
  workerThreads?: number;
  cacheSize?: number;
  
  // APIs (REST, gRPC, WebSocket)
  requestsPerSecond?: number;
  avgPayloadSize?: number;
  responseLatency?: number;
  
  // Custom
  [key: string]: any;
}

// Percentile metrics for performance analysis
export interface PercentileMetrics {
  p50: number; // 50th percentile (median)
  p99: number; // 99th percentile
  min: number; // minimum value
  max: number; // maximum value
}

export interface CanvasConnection {
  id: string;
  source: string;
  target: string;
  type: 'sync' | 'async' | 'http' | 'grpc' | 'websocket';
  label?: string;
  data?: ConnectionConfig;
  selected?: boolean;
}

export interface ConnectionConfig {
  // Network parameters
  latencyMs?: number;
  bandwidthMbps?: number;
  packetLossPercent?: number;
  jitterMs?: number;
  
  // Traffic characteristics
  priorityLevel?: 'low' | 'medium' | 'high' | 'critical';
  retryCount?: number;
  timeoutMs?: number;
  
  // Monitoring
  enableMonitoring?: boolean;
  
  // Custom
  [key: string]: any;
}

export interface Tab {
  id: string;
  title: string;
  type: 'component' | 'diagram';
  componentId?: string;
  componentType?: ComponentType['type'];
  active: boolean;
}

export interface DiagramState {
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  zoom: number;
  pan: { x: number; y: number };
}

export interface ComponentCollection {
  id: string;
  name: string;
  componentIds: string[];
}
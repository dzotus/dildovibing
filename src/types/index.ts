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
  zIndex?: number; // For z-order management (higher = on top)
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
  
  // Custom - используем unknown для безопасности типов
  [key: string]: unknown;
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
  sourcePort?: number; // Index of connection point on source node (0-15)
  targetPort?: number; // Index of connection point on target node (0-15)
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
  
  // Custom - используем unknown для безопасности типов
  [key: string]: unknown;
}

export interface Tab {
  id: string;
  title: string;
  type: 'component' | 'diagram';
  componentId?: string;
  componentType?: ComponentType['type'];
  active: boolean;
}

export interface ComponentGroup {
  id: string;
  name: string;
  nodeIds: string[];
  color?: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  showName?: boolean; // Whether to show group name on canvas
}

export interface DiagramState {
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  groups: ComponentGroup[];
  zoom: number;
  pan: { x: number; y: number };
}

export interface ComponentCollection {
  id: string;
  name: string;
  componentIds: string[];
}
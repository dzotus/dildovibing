export type ComponentCategory =
  | 'messaging'
  | 'integration'
  | 'data'
  | 'observability'
  | 'security'
  | 'devops'
  | 'infrastructure'
  | 'edge'
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
  type: 'sync' | 'async' | 'rest' | 'graphql' | 'soap' | 'grpc' | 'websocket' | 'webhook' | 'http';
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
  
  // Protocol-specific settings
  protocol?: 'rest' | 'graphql' | 'soap' | 'grpc' | 'websocket' | 'webhook';
  protocolConfig?: {
    // REST-specific
    httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    contentType?: 'json' | 'xml' | 'form-data';
    headers?: Record<string, string>;
    
    // GraphQL-specific
    query?: string;
    operationName?: string;
    variables?: Record<string, any>;
    
    // SOAP-specific
    soapAction?: string;
    wsdlUrl?: string;
    namespace?: string;
    
    // gRPC-specific
    serviceName?: string;
    methodName?: string;
    metadata?: Record<string, string>;
    
    // WebSocket-specific
    wsProtocol?: string;
    subprotocols?: string[];
    binaryType?: 'blob' | 'arraybuffer';
    
    // Webhook-specific
    webhookEvent?: string;
    signatureHeader?: string;
    secret?: string;
  };
  
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
import { CanvasNode, CanvasConnection, ComponentConfig } from '@/types';
import { emulationEngine } from './EmulationEngine';
import { PostgreSQLQueryEngine } from './postgresql/QueryEngine';
import { PostgreSQLTable, PostgreSQLIndex } from './postgresql/types';
import { JaegerSpan, TraceContext } from './JaegerEmulationEngine';

/**
 * Data message format for transmission between components
 */
export interface DataMessage {
  id: string;
  timestamp: number;
  source: string;
  target: string;
  connectionId: string;
  format: 'json' | 'xml' | 'binary' | 'protobuf' | 'text' | 'custom';
  payload: unknown; // Actual data payload - используем unknown для безопасности типов
  size: number; // bytes
  metadata?: {
    contentType?: string;
    encoding?: string;
    compression?: boolean;
    schema?: string;
    version?: string;
    [key: string]: unknown;
  };
  status: 'pending' | 'in-transit' | 'delivered' | 'failed' | 'transformed';
  error?: string;
  latency?: number; // ms
}

/**
 * Component data handler interface
 */
export interface ComponentDataHandler {
  /**
   * Generate data from this component (for sources)
   */
  generateData?(node: CanvasNode, config: ComponentConfig): DataMessage[] | null;
  
  /**
   * Process incoming data (for targets)
   */
  processData?(node: CanvasNode, message: DataMessage, config: ComponentConfig): DataMessage | null;
  
  /**
   * Transform data format if needed
   */
  transformData?(node: CanvasNode, message: DataMessage, targetType: string, config: ComponentConfig): DataMessage | null;
  
  /**
   * Get supported data formats
   */
  getSupportedFormats?(node: CanvasNode): string[];
}

/**
 * Data Flow Engine - manages data transmission between components
 */
export class DataFlowEngine {
  private nodes: CanvasNode[] = [];
  private connections: CanvasConnection[] = [];
  private handlers: Map<string, ComponentDataHandler> = new Map();
  private postgresQueryEngine: PostgreSQLQueryEngine | null = null;
  private messageQueue: Map<string, DataMessage[]> = new Map(); // connectionId -> messages
  private messageHistory: DataMessage[] = [];
  private isRunning: boolean = false;
  private updateInterval: number = 200; // ms - how often to process messages
  private intervalId: NodeJS.Timeout | null = null;
  private messageIdCounter: number = 0;
  private readonly MAX_HISTORY = 1000; // Keep last 1000 messages
  
  // Trace context tracking (traceId -> context)
  private traceContexts: Map<string, TraceContext> = new Map();
  private traceIdCounter: number = 0;

  constructor() {
    this.registerDefaultHandlers();
  }

  /**
   * Register default data handlers for component types
   */
  private registerDefaultHandlers() {
    // Business applications - generate business data
    this.registerHandler('crm', this.createBusinessDataHandler('crm'));
    this.registerHandler('erp', this.createBusinessDataHandler('erp'));
    this.registerHandler('payment-gateway', this.createBusinessDataHandler('payment'));
    
    // Databases - store and retrieve data
    this.registerHandler('postgres', this.createDatabaseHandler('postgres'));
    this.registerHandler('mongodb', this.createDatabaseHandler('mongodb'));
    this.registerHandler('redis', this.createDatabaseHandler('redis'));
    this.registerHandler('cassandra', this.createDatabaseHandler('cassandra'));
    this.registerHandler('clickhouse', this.createDatabaseHandler('clickhouse'));
    this.registerHandler('snowflake', this.createDatabaseHandler('snowflake'));
    this.registerHandler('elasticsearch', this.createDatabaseHandler('elasticsearch'));
    
    // Storage - object storage
    this.registerHandler('s3-datalake', this.createStorageHandler('s3-datalake'));
    
    // Message brokers - pass through messages
    this.registerHandler('kafka', this.createMessageBrokerHandler('kafka'));
    this.registerHandler('rabbitmq', this.createMessageBrokerHandler('rabbitmq'));
    this.registerHandler('activemq', this.createMessageBrokerHandler('activemq'));
    this.registerHandler('aws-sqs', this.createMessageBrokerHandler('aws-sqs'));
    this.registerHandler('gcp-pubsub', this.createMessageBrokerHandler('gcp-pubsub'));
    
    // APIs - transform and route data
    this.registerHandler('rest', this.createAPIHandler('rest'));
    this.registerHandler('grpc', this.createAPIHandler('grpc'));
    this.registerHandler('graphql', this.createAPIHandler('graphql'));
    this.registerHandler('websocket', this.createAPIHandler('websocket'));
    
    // Integration - transform formats
    this.registerHandler('kong', this.createIntegrationHandler('kong'));
    this.registerHandler('api-gateway', this.createIntegrationHandler('api-gateway'));
    this.registerHandler('nginx', this.createIntegrationHandler('nginx'));
    this.registerHandler('haproxy', this.createIntegrationHandler('haproxy'));
    this.registerHandler('traefik', this.createIntegrationHandler('traefik'));
    this.registerHandler('envoy', this.createIntegrationHandler('envoy'));
    this.registerHandler('cdn', this.createIntegrationHandler('cdn'));
    this.registerHandler('apigee', this.createIntegrationHandler('apigee'));
    this.registerHandler('mulesoft', this.createIntegrationHandler('mulesoft'));
    this.registerHandler('graphql-gateway', this.createIntegrationHandler('graphql-gateway'));
    this.registerHandler('bff-service', this.createIntegrationHandler('bff-service'));
    this.registerHandler('webhook-relay', this.createIntegrationHandler('webhook-relay'));
    
    // Observability - logs and metrics
    this.registerHandler('loki', this.createLokiHandler());
    this.registerHandler('otel-collector', this.createOpenTelemetryCollectorHandler());

    // Security & IAM
    this.registerHandler('keycloak', this.createKeycloakHandler());
    this.registerHandler('secrets-vault', this.createVaultHandler());
    this.registerHandler('waf', this.createWAFHandler());
    this.registerHandler('firewall', this.createFirewallHandler());
    this.registerHandler('ids-ips', this.createIDSIPSHandler());
    
    // CI/CD
    this.registerHandler('jenkins', this.createJenkinsHandler());
    this.registerHandler('gitlab-ci', this.createGitLabCIHandler());
    this.registerHandler('argo-cd', this.createArgoCDHandler());
    this.registerHandler('terraform', this.createTerraformHandler());
    this.registerHandler('harbor', this.createHarborHandler());
    this.registerHandler('docker', this.createDockerHandler());
  }

  /**
   * Register a data handler for a component type
   */
  public registerHandler(type: string, handler: ComponentDataHandler) {
    this.handlers.set(type, handler);
  }

  /**
   * Initialize with nodes and connections
   */
  public initialize(nodes: CanvasNode[], connections: CanvasConnection[]) {
    this.nodes = nodes;
    this.connections = connections;
    this.messageQueue.clear();
    this.messageHistory = [];
    
    // Initialize message queues for each connection
    for (const conn of connections) {
      this.messageQueue.set(conn.id, []);
    }
  }

  /**
   * Update nodes and connections without clearing message queue
   * (useful when canvas is modified during simulation)
   */
  public updateNodesAndConnections(nodes: CanvasNode[], connections: CanvasConnection[]) {
    this.nodes = nodes;
    this.connections = connections;
    
    // Remove message queues for deleted connections
    const currentConnectionIds = new Set(connections.map(c => c.id));
    for (const [connId] of this.messageQueue.entries()) {
      if (!currentConnectionIds.has(connId)) {
        this.messageQueue.delete(connId);
      }
    }
    
    // Initialize message queues for new connections
    for (const conn of connections) {
      if (!this.messageQueue.has(conn.id)) {
        this.messageQueue.set(conn.id, []);
      }
    }
  }

  /**
   * Start data flow simulation
   */
  public start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.processDataFlow();
    }, this.updateInterval);
  }

  /**
   * Stop data flow simulation
   */
  public stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Process one step of data flow
   */
  private processDataFlow() {
    // 1. Generate data from source components
    this.generateSourceData();
    
    // 2. Process messages in transit
    this.processInTransitMessages();
    
    // 3. Deliver messages to targets
    this.deliverMessages();
  }

  /**
   * Generate data from source components (business apps, APIs, etc.)
   */
  private generateSourceData() {
    for (const connection of this.connections) {
      const sourceNode = this.nodes.find(n => n.id === connection.source);
      if (!sourceNode) continue;
      
      const handler = this.handlers.get(sourceNode.type);
      if (!handler?.generateData) continue;
      
      const config = sourceNode.data.config || {};
      const messages = handler.generateData(sourceNode, config);
      
      if (messages && messages.length > 0) {
        const queue = this.messageQueue.get(connection.id) || [];
        for (const msg of messages) {
          // Set connection and target
          msg.connectionId = connection.id;
          msg.target = connection.target;
          msg.status = 'pending';
          msg.id = `msg-${++this.messageIdCounter}`;
          msg.timestamp = Date.now();
          
          queue.push(msg);
        }
        this.messageQueue.set(connection.id, queue);
      }
    }
  }

  /**
   * Process messages that are in transit
   */
  private processInTransitMessages() {
    for (const [connectionId, messages] of this.messageQueue.entries()) {
      const connection = this.connections.find(c => c.id === connectionId);
      if (!connection) continue;
      
      const sourceNode = this.nodes.find(n => n.id === connection.source);
      const targetNode = this.nodes.find(n => n.id === connection.target);
      if (!sourceNode || !targetNode) continue;
      
      // Process pending messages
      for (const message of messages) {
        if (message.status === 'pending') {
          // Check if we need to transform data format
          const transformed = this.transformMessageIfNeeded(
            message,
            sourceNode,
            targetNode,
            connection
          );
          
          if (transformed) {
            message.status = 'in-transit';
            message.latency = this.calculateTransitTime(connection);
          }
        } else if (message.status === 'in-transit') {
          // Check if message has reached target (based on latency)
          const elapsed = Date.now() - message.timestamp;
          if (message.latency && elapsed >= message.latency) {
            message.status = 'delivered';
          }
        }
      }
    }
  }

  /**
   * Deliver messages to target components
   */
  private deliverMessages() {
    for (const [connectionId, messages] of this.messageQueue.entries()) {
      const connection = this.connections.find(c => c.id === connectionId);
      if (!connection) continue;
      
      const targetNode = this.nodes.find(n => n.id === connection.target);
      if (!targetNode) continue;
      
      const handler = this.handlers.get(targetNode.type);
      if (!handler?.processData) continue;
      
      const config = targetNode.data.config || {};
      
      // Process delivered messages
      const delivered = messages.filter(m => m.status === 'delivered');
      for (const message of delivered) {
        try {
          // Get source node for trace generation
          const sourceNode = this.nodes.find(n => n.id === connection.source);
          
          const result = handler.processData(targetNode, message, config);
          if (result) {
            // Generate trace for this message
            if (sourceNode) {
              this.generateTraceForMessage(message, sourceNode, targetNode, connection, result);
            }
            
            // Message was processed, add to history and remove from queue
            this.addToHistory(message);
            messages.splice(messages.indexOf(message), 1);
          }
        } catch (error) {
          message.status = 'failed';
          message.error = error instanceof Error ? error.message : 'Unknown error';
          
          // Generate trace for failed message
          const sourceNode = this.nodes.find(n => n.id === connection.source);
          if (sourceNode) {
            this.generateTraceForMessage(message, sourceNode, targetNode, connection, message);
          }
          
          this.addToHistory(message);
          messages.splice(messages.indexOf(message), 1);
        }
      }
      
      this.messageQueue.set(connectionId, messages);
    }
  }

  /**
   * Transform message if source and target have different format requirements
   */
  private transformMessageIfNeeded(
    message: DataMessage,
    sourceNode: CanvasNode,
    targetNode: CanvasNode,
    connection: CanvasConnection
  ): DataMessage | null {
    const sourceHandler = this.handlers.get(sourceNode.type);
    const targetHandler = this.handlers.get(targetNode.type);
    
    // Check if transformation is needed
    const sourceFormats = sourceHandler?.getSupportedFormats?.(sourceNode) || [message.format];
    const targetFormats = targetHandler?.getSupportedFormats?.(targetNode) || [message.format];
    
    // If formats match, no transformation needed
    if (targetFormats.includes(message.format)) {
      return message;
    }
    
    // Try to find a compatible format
    const compatibleFormat = targetFormats.find(f => sourceFormats.includes(f));
    if (compatibleFormat) {
      // Type assertion: getSupportedFormats should only return valid format types
      message.format = compatibleFormat as DataMessage['format'];
      message.status = 'transformed';
      return message;
    }
    
    // Use integration handler if available
    const integrationHandler = this.findIntegrationHandler(connection);
    if (integrationHandler?.transformData) {
      const transformed = integrationHandler.transformData(
        sourceNode,
        message,
        targetNode.type,
        sourceNode.data.config || {}
      );
      if (transformed) {
        return transformed;
      }
    }
    
    // Default: try to transform using source handler
    if (sourceHandler?.transformData) {
      const transformed = sourceHandler.transformData(
        sourceNode,
        message,
        targetNode.type,
        sourceNode.data.config || {}
      );
      if (transformed) {
        return transformed;
      }
    }
    
    // If no transformation possible, mark as failed
    message.status = 'failed';
    message.error = `Format ${message.format} not supported by target ${targetNode.type}`;
    return null;
  }

  /**
   * Find integration handler in the connection path
   */
  private findIntegrationHandler(connection: CanvasConnection): ComponentDataHandler | null {
    // Check if there's an integration component in the path
    // For now, check direct connection
    const sourceNode = this.nodes.find(n => n.id === connection.source);
    if (sourceNode && ['kong', 'api-gateway', 'apigee', 'mulesoft', 'bff-service'].includes(sourceNode.type)) {
      return this.handlers.get(sourceNode.type) || null;
    }
    return null;
  }

  /**
   * Calculate transit time based on connection characteristics
   */
  private calculateTransitTime(connection: CanvasConnection): number {
    const config = connection.data || {};
    const baseLatency = config.latencyMs || 10;
    const jitter = (config.jitterMs || 0) * (Math.random() - 0.5);
    return Math.max(1, baseLatency + jitter);
  }

  /**
   * Генерирует трассировку для сообщения
   */
  private generateTraceForMessage(
    message: DataMessage,
    sourceNode: CanvasNode,
    targetNode: CanvasNode,
    connection: CanvasConnection,
    result: DataMessage
  ): void {
    // Получаем все Jaeger engines
    const jaegerEngines = emulationEngine.getAllJaegerEngines();
    if (jaegerEngines.size === 0) return;
    
    // Получаем или создаем trace context
    let traceContext = message.metadata?.traceContext as TraceContext | undefined;
    
    if (!traceContext) {
      // Создаем новый trace
      const traceId = this.generateTraceId();
      const spanId = this.generateSpanId();
      
      traceContext = {
        traceId,
        spanId,
        sampled: true, // По умолчанию sampled, Jaeger применит sampling
      };
      
      this.traceContexts.set(traceId, traceContext);
    }
    
    // Создаем span для передачи сообщения
    const startTime = message.timestamp * 1000; // convert to microseconds
    const endTime = (message.timestamp + (message.latency || 0)) * 1000; // convert to microseconds
    const duration = endTime - startTime;
    
    // Определяем operation name
    const operationName = this.getOperationName(message, sourceNode, targetNode);
    
    // Создаем span
    const span: JaegerSpan = {
      traceId: traceContext.traceId,
      spanId: traceContext.spanId,
      parentSpanId: traceContext.parentSpanId,
      operationName,
      serviceName: sourceNode.data.label || sourceNode.type,
      startTime,
      duration,
      tags: [
        { key: 'component.type', value: sourceNode.type },
        { key: 'target.component', value: targetNode.data.label || targetNode.type },
        { key: 'target.type', value: targetNode.type },
        { key: 'message.format', value: message.format },
        { key: 'message.size', value: message.size },
        { key: 'connection.id', value: connection.id },
        { key: 'status', value: result.status },
      ],
      logs: [],
    };
    
    // Добавляем error tag если есть ошибка
    if (result.status === 'failed' || result.error) {
      span.tags.push({ key: 'error', value: true });
      span.logs.push({
        timestamp: endTime,
        fields: [
          { key: 'event', value: 'error' },
          { key: 'error.message', value: result.error || 'Unknown error' },
        ],
      });
    }
    
    // Добавляем metadata как tags
    if (message.metadata) {
      for (const [key, value] of Object.entries(message.metadata)) {
        if (key !== 'traceContext' && value !== undefined && value !== null) {
          span.tags.push({ key: `metadata.${key}`, value: String(value) });
        }
      }
    }
    
    // Отправляем span во все Jaeger engines
    for (const [, jaegerEngine] of jaegerEngines) {
      jaegerEngine.receiveSpan(span);
    }
    
    // Обновляем trace context для следующего span (если сообщение продолжает путь)
    if (result.status === 'delivered' && targetNode) {
      const nextSpanId = this.generateSpanId();
      const nextTraceContext: TraceContext = {
        traceId: traceContext.traceId,
        spanId: nextSpanId,
        parentSpanId: traceContext.spanId,
        sampled: traceContext.sampled,
      };
      
      // Сохраняем в metadata результата для propagation
      if (!result.metadata) {
        result.metadata = {};
      }
      result.metadata.traceContext = nextTraceContext;
    }
  }

  /**
   * Генерирует уникальный trace ID
   */
  private generateTraceId(): string {
    return `trace-${++this.traceIdCounter}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Генерирует уникальный span ID
   */
  private generateSpanId(): string {
    return `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Определяет operation name для span
   */
  private getOperationName(
    message: DataMessage,
    sourceNode: CanvasNode,
    targetNode: CanvasNode
  ): string {
    // Пытаемся определить из metadata
    if (message.metadata?.operation) {
      return String(message.metadata.operation);
    }
    
    // Определяем по типу компонентов
    if (sourceNode.type === 'api-gateway' || sourceNode.type === 'kong' || sourceNode.type === 'apigee') {
      return `HTTP ${message.metadata?.method || 'REQUEST'}`;
    }
    
    if (sourceNode.type.includes('database') || sourceNode.type === 'postgres' || sourceNode.type === 'mongodb') {
      return `DB ${message.metadata?.queryType || 'QUERY'}`;
    }
    
    if (sourceNode.type.includes('queue') || sourceNode.type === 'rabbitmq' || sourceNode.type === 'kafka') {
      return `MQ ${message.metadata?.queue || 'SEND'}`;
    }
    
    // Дефолтное имя
    return `${sourceNode.type} -> ${targetNode.type}`;
  }

  /**
   * Add message to history
   */
  private addToHistory(message: DataMessage) {
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.MAX_HISTORY) {
      this.messageHistory.shift();
    }
  }

  /**
   * Get messages for a connection
   */
  public getConnectionMessages(connectionId: string): DataMessage[] {
    return this.messageQueue.get(connectionId) || [];
  }

  /**
   * Get message history
   */
  public getMessageHistory(limit?: number): DataMessage[] {
    const history = [...this.messageHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get messages for a component (incoming or outgoing)
   */
  public getComponentMessages(nodeId: string): DataMessage[] {
    const allMessages: DataMessage[] = [];
    
    for (const messages of this.messageQueue.values()) {
      for (const msg of messages) {
        if (msg.source === nodeId || msg.target === nodeId) {
          allMessages.push(msg);
        }
      }
    }
    
    return allMessages;
  }

  // ========== Handler Factory Methods ==========

  /**
   * Create handler for business applications
   */
  private createBusinessDataHandler(type: string): ComponentDataHandler {
    return {
      generateData: (node, config) => {
        const messages: DataMessage[] = [];
        const generateInterval = config.generateInterval || 2000; // ms
        const lastGenerate = (node as any)._lastGenerate || 0;
        const now = Date.now();
        
        if (now - lastGenerate < generateInterval) {
          return null;
        }
        
        (node as any)._lastGenerate = now;
        
        switch (type) {
          case 'crm':
            messages.push(this.createCRMDataMessage(node));
            break;
          case 'erp':
            messages.push(this.createERPDataMessage(node));
            break;
          case 'payment':
            messages.push(this.createPaymentDataMessage(node));
            break;
        }
        
        return messages;
      },
      
      getSupportedFormats: () => ['json', 'xml'],
    };
  }

  /**
   * Validate document against MongoDB JSON Schema
   * Simplified validation for simulation purposes
   */
  private validateMongoDBSchema(document: any, schema: any): { valid: boolean; error?: string } {
    if (!schema || !schema.$jsonSchema) {
      return { valid: true };
    }

    const jsonSchema = schema.$jsonSchema;

    // Check required fields
    if (jsonSchema.required && Array.isArray(jsonSchema.required)) {
      for (const field of jsonSchema.required) {
        if (!(field in document) || document[field] === undefined || document[field] === null) {
          return { valid: false, error: `Required field "${field}" is missing` };
        }
      }
    }

    // Check properties types
    if (jsonSchema.properties) {
      for (const [field, fieldSchema] of Object.entries(jsonSchema.properties)) {
        if (field in document) {
          const value = document[field];
          const propSchema = fieldSchema as any;

          // Type validation
          if (propSchema.type) {
            const expectedType = propSchema.type;
            const actualType = Array.isArray(value) ? 'array' : typeof value;

            if (expectedType === 'string' && actualType !== 'string') {
              return { valid: false, error: `Field "${field}" must be of type string` };
            }
            if (expectedType === 'number' && actualType !== 'number') {
              return { valid: false, error: `Field "${field}" must be of type number` };
            }
            if (expectedType === 'boolean' && actualType !== 'boolean') {
              return { valid: false, error: `Field "${field}" must be of type boolean` };
            }
            if (expectedType === 'array' && actualType !== 'array') {
              return { valid: false, error: `Field "${field}" must be of type array` };
            }
            if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(value))) {
              return { valid: false, error: `Field "${field}" must be of type object` };
            }
          }
        }
      }
    }

    return { valid: true };
  }

  /**
   * Create handler for databases
   */
  private createDatabaseHandler(type: string): ComponentDataHandler {
    return {
      processData: (node, message, config) => {
        // PostgreSQL specific: if payload contains SQL query, use Query Engine
        if (type === 'postgres' && message.payload?.sql) {
          return this.processPostgreSQLQuery(node, message, config);
        }

        // Redis specific: if payload contains Redis command, use RedisRoutingEngine
        if (type === 'redis') {
          return this.processRedisCommand(node, message, config);
        }

        // Cassandra specific: if payload contains CQL query, use CassandraRoutingEngine
        if (type === 'cassandra') {
          return this.processCQLQuery(node, message, config);
        }

        // ClickHouse specific: if payload contains SQL query, use ClickHouseRoutingEngine
        if (type === 'clickhouse') {
          return this.processClickHouseQuery(node, message, config);
        }

        // Snowflake specific: if payload contains SQL query, use SnowflakeRoutingEngine
        if (type === 'snowflake') {
          return this.processSnowflakeQuery(node, message, config);
        }

        // Elasticsearch specific: if payload contains Elasticsearch query or document, use ElasticsearchRoutingEngine
        if (type === 'elasticsearch') {
          return this.processElasticsearchOperation(node, message, config);
        }

        // Simulate database operations
        const operation = message.payload?.operation || 'insert';
        
        switch (operation) {
          case 'insert':
          case 'update': {
            // Simulate processing time
            const latency = config.queryLatency || 10;
            message.latency = latency;

            // MongoDB specific processing
            if (type === 'mongodb') {
              const mongoConfig = node.data.config as any;
              const collections = mongoConfig?.collections || [];
              
              // Extract collection name from payload or use first collection
              const payload = message.payload as any;
              let collectionName = payload?.collection;
              
              // If no collection specified, try to infer from payload structure
              if (!collectionName && collections.length > 0) {
                // Try to match by data type or use first collection
                if (payload?.type) {
                  const matchingCollection = collections.find((c: any) => 
                    c.name.toLowerCase().includes(payload.type.toLowerCase())
                  );
                  collectionName = matchingCollection?.name || collections[0].name;
                } else {
                  collectionName = collections[0].name;
                }
              }
              
              if (collectionName) {
                const collection = collections.find((c: any) => c.name === collectionName);
                
                if (collection) {
                  // Schema validation
                  if (collection.validation) {
                    const validation = collection.validation;
                    
                    // Skip validation if level is 'off'
                    if (validation.validationLevel !== 'off') {
                      // Extract document from payload
                      const document = payload?.document || payload?.data || payload;
                      
                      // Skip _id field for validation (it's auto-generated)
                      const docForValidation = { ...document };
                      delete docForValidation._id;
                      
                      const validationResult = this.validateMongoDBSchema(docForValidation, validation.validator);

                      if (!validationResult.valid) {
                        if (validation.validationAction === 'error') {
                          // Reject invalid document
                          message.status = 'failed';
                          message.error = `Schema validation failed for collection "${collectionName}": ${validationResult.error}`;
                          return message;
                        } else if (validation.validationAction === 'warn') {
                          // Warn but allow (could log this in real scenario)
                          message.metadata = {
                            ...message.metadata,
                            validationWarning: validationResult.error,
                            collection: collectionName
                          };
                        }
                      }
                    }
                  }
                  
                  // Simulate document storage (update document count)
                  if (operation === 'insert') {
                    // In real scenario, this would increment documentCount
                    // For simulation, we just mark it as processed
                    message.metadata = {
                      ...message.metadata,
                      collection: collectionName,
                      documentStored: true
                    };
                  } else if (operation === 'update') {
                    message.metadata = {
                      ...message.metadata,
                      collection: collectionName,
                      documentUpdated: true
                    };
                  }
                } else {
                  // Collection not found
                  message.status = 'failed';
                  message.error = `Collection "${collectionName}" not found`;
                  return message;
                }
              }
            }

            message.status = 'delivered';
            return message;
          }
          case 'delete':
            // Simulate processing time
            const latency = config.queryLatency || 10;
            message.latency = latency;
            message.status = 'delivered';
            return message;
          case 'query': {
            // Return query results
            let results: Record<string, unknown>[] = [];
            
            // MongoDB specific: use documents from collections if available
            if (type === 'mongodb') {
              const mongoConfig = node.data.config as any;
              const collections = mongoConfig?.collections || [];
              const payload = message.payload as any;
              const collectionName = payload?.collection || collections[0]?.name;
              
              if (collectionName) {
                const collection = collections.find((c: any) => c.name === collectionName);
                
                if (collection?.documents && collection.documents.length > 0) {
                  // Return actual documents from collection (simulate query)
                  results = collection.documents.map((doc: any) => ({ ...doc }));
                  
                  // Apply simple filtering if query filter provided
                  if (payload?.filter) {
                    try {
                      const filter = typeof payload.filter === 'string' 
                        ? JSON.parse(payload.filter) 
                        : payload.filter;
                      
                      results = results.filter((doc: any) => {
                        for (const [key, value] of Object.entries(filter)) {
                          if (doc[key] !== value) return false;
                        }
                        return true;
                      });
                    } catch (e) {
                      // Invalid filter, return all
                    }
                  }
                  
                  // Limit results
                  const limit = payload?.limit || 100;
                  results = results.slice(0, limit);
                } else {
                  // No documents in collection, generate mock results
                  results = this.generateQueryResults(type, payload?.query);
                }
              } else {
                results = this.generateQueryResults(type, payload?.query);
              }
            } else {
              results = this.generateQueryResults(type, (message.payload as any)?.query);
            }
            
            message.payload = {
              ...message.payload,
              results,
            };
            message.status = 'delivered';
            return message;
          }
          default:
            message.status = 'failed';
            message.error = `Unknown operation: ${operation}`;
            return message;
        }
      },
      
      getSupportedFormats: () => ['json', 'binary'],
    };
  }

  /**
   * Process ClickHouse SQL query using ClickHouseRoutingEngine
   */
  private processClickHouseQuery(
    node: CanvasNode,
    message: DataMessage,
    config: ComponentConfig
  ): DataMessage {
    const payload = message.payload as any;
    
    // Get ClickHouseRoutingEngine from emulationEngine
    const clickHouseEngine = emulationEngine.getClickHouseRoutingEngine(node.id);
    if (!clickHouseEngine) {
      message.status = 'failed';
      message.error = 'ClickHouse Routing Engine not initialized';
      return message;
    }

    // Extract SQL query from payload
    let sqlQuery: string;

    if (payload?.sql) {
      // Explicit SQL format: { sql: "SELECT * FROM table" }
      sqlQuery = payload.sql;
    } else if (payload?.query) {
      // Alternative format: { query: "SELECT * FROM table" }
      sqlQuery = payload.query;
    } else if (typeof payload === 'string') {
      // String format: "SELECT * FROM table"
      sqlQuery = payload;
    } else {
      // Try to infer from operation
      const operation = payload?.operation || 'select';
      const clickHouseConfig = node.data.config as any;
      const database = payload?.database || clickHouseConfig?.database || 'default';
      const table = payload?.table || 'default_table';
      
      switch (operation.toLowerCase()) {
        case 'select':
        case 'read':
        case 'query':
          sqlQuery = `SELECT * FROM ${database}.${table}`;
          if (payload?.where) {
            sqlQuery += ` WHERE ${payload.where}`;
          }
          if (payload?.limit) {
            sqlQuery += ` LIMIT ${payload.limit}`;
          }
          break;
        case 'insert':
        case 'write':
          const columns = payload?.columns ? Object.keys(payload.columns).join(', ') : 'id, data';
          const values = payload?.columns 
            ? Object.values(payload.columns).map((v: any) => `'${v}'`).join(', ')
            : `${Date.now()}, 'data'`;
          sqlQuery = `INSERT INTO ${database}.${table} (${columns}) VALUES (${values})`;
          break;
        default:
          message.status = 'failed';
          message.error = `Unknown ClickHouse operation: ${operation}`;
          return message;
      }
    }

    // Execute SQL query
    const result = clickHouseEngine.executeQuery(sqlQuery);

    if (result.success) {
      message.status = 'delivered';
      message.latency = result.latency || 45; // ClickHouse latency
      message.payload = {
        ...(message.payload as any),
        sql: sqlQuery,
        rows: result.rows || [],
        rowCount: result.rowCount || 0,
        columns: result.columns || [],
        dataRead: result.dataRead,
        dataWritten: result.dataWritten,
        clickHouseResult: result.rows,
      };
      message.metadata = {
        ...message.metadata,
        clickHouseQuery: sqlQuery,
        rowsRead: result.dataRead,
        rowsWritten: result.dataWritten,
      };
    } else {
      message.status = 'failed';
      message.error = result.error || 'ClickHouse query execution failed';
      message.latency = result.latency || 0;
    }

    return message;
  }

  /**
   * Process Snowflake SQL query using SnowflakeRoutingEngine
   */
  private processSnowflakeQuery(
    node: CanvasNode,
    message: DataMessage,
    config: ComponentConfig
  ): DataMessage {
    const payload = message.payload as any;
    
    // Get SnowflakeRoutingEngine from emulationEngine
    const snowflakeEngine = emulationEngine.getSnowflakeRoutingEngine(node.id);
    if (!snowflakeEngine) {
      message.status = 'failed';
      message.error = 'Snowflake Routing Engine not initialized';
      return message;
    }

    // Extract SQL query from payload
    let sqlQuery: string;
    let warehouseName: string | undefined;
    let database: string | undefined;
    let schema: string | undefined;

    if (payload?.sql) {
      // Explicit SQL format: { sql: "SELECT * FROM table" }
      sqlQuery = payload.sql;
      warehouseName = payload.warehouse;
      database = payload.database;
      schema = payload.schema;
    } else if (payload?.query) {
      // Alternative format: { query: "SELECT * FROM table" }
      sqlQuery = payload.query;
      warehouseName = payload.warehouse;
      database = payload.database;
      schema = payload.schema;
    } else if (typeof payload === 'string') {
      // String format: "SELECT * FROM table"
      sqlQuery = payload;
    } else {
      // Try to infer from operation
      const operation = payload?.operation || 'select';
      const snowflakeConfig = node.data.config as any;
      database = payload?.database || snowflakeConfig?.database || 'PUBLIC';
      schema = payload?.schema || snowflakeConfig?.schema || 'PUBLIC';
      warehouseName = payload?.warehouse || snowflakeConfig?.warehouse;
      const table = payload?.table || 'default_table';
      
      switch (operation.toLowerCase()) {
        case 'select':
        case 'read':
        case 'query':
          sqlQuery = `SELECT * FROM ${database}.${schema}.${table}`;
          if (payload?.where) {
            sqlQuery += ` WHERE ${payload.where}`;
          }
          if (payload?.limit) {
            sqlQuery += ` LIMIT ${payload.limit}`;
          }
          break;
        case 'insert':
        case 'write':
          const columns = payload?.columns ? Object.keys(payload.columns).join(', ') : 'id, data';
          const values = payload?.columns 
            ? Object.values(payload.columns).map((v: any) => `'${v}'`).join(', ')
            : `${Date.now()}, 'data'`;
          sqlQuery = `INSERT INTO ${database}.${schema}.${table} (${columns}) VALUES (${values})`;
          break;
        default:
          message.status = 'failed';
          message.error = `Unknown Snowflake operation: ${operation}`;
          return message;
      }
    }

    // Execute SQL query through warehouse
    const result = snowflakeEngine.executeQuery(sqlQuery, warehouseName, database, schema);

    if (result.success) {
      message.status = 'delivered';
      message.latency = result.latency || 50; // Snowflake latency
      message.payload = {
        ...(message.payload as any),
        sql: sqlQuery,
        rows: result.rows || [],
        rowCount: result.rowCount || 0,
        columns: result.columns || [],
        dataRead: result.dataRead,
        dataWritten: result.dataWritten,
        snowflakeResult: result.rows,
        queryId: result.queryId,
        warehouse: result.warehouse,
        resultCacheUsed: result.resultCacheUsed,
      };
      message.metadata = {
        ...message.metadata,
        snowflakeQuery: sqlQuery,
        rowsRead: result.dataRead,
        rowsWritten: result.dataWritten,
        warehouse: result.warehouse,
        queryId: result.queryId,
        cacheHit: result.resultCacheUsed || false,
      };
    } else {
      message.status = 'failed';
      message.error = result.error || 'Snowflake query execution failed';
      message.latency = result.latency || 0;
    }

    return message;
  }

  /**
   * Process Elasticsearch operation using ElasticsearchRoutingEngine
   */
  private processElasticsearchOperation(
    node: CanvasNode,
    message: DataMessage,
    config: ComponentConfig
  ): DataMessage {
    const payload = message.payload as any;
    
    // Get ElasticsearchRoutingEngine from emulationEngine
    const elasticsearchEngine = emulationEngine.getElasticsearchRoutingEngine(node.id);
    if (!elasticsearchEngine) {
      message.status = 'failed';
      message.error = 'Elasticsearch Routing Engine not initialized';
      return message;
    }

    // Extract operation from payload
    const operation = payload?.operation || payload?.method || 'index';
    const index = payload?.index || payload?._index || (node.data.config as any)?.index || 'archiphoenix-index';
    const id = payload?.id || payload?._id;
    const document = payload?.document || payload?._source || payload?.body || payload;
    const query = payload?.query;
    const routing = payload?.routing || payload?._routing;

    let result: any;

    switch (operation.toLowerCase()) {
      case 'index':
      case 'create':
      case 'update':
        if (!id || !document) {
          message.status = 'failed';
          message.error = 'Index operation requires id and document';
          return message;
        }
        result = elasticsearchEngine.indexDocument(index, id, document, routing);
        break;

      case 'get':
      case 'read':
        if (!id) {
          message.status = 'failed';
          message.error = 'Get operation requires id';
          return message;
        }
        result = elasticsearchEngine.getDocument(index, id, routing);
        break;

      case 'search':
      case 'query':
        if (query) {
          result = elasticsearchEngine.search(index, query);
        } else if (payload?.queryString) {
          // Try to parse query string
          result = elasticsearchEngine.executeQuery(payload.queryString);
        } else {
          // Default match_all query
          result = elasticsearchEngine.search(index, { query: { match_all: {} } });
        }
        break;

      case 'delete':
        if (!id) {
          message.status = 'failed';
          message.error = 'Delete operation requires id';
          return message;
        }
        result = elasticsearchEngine.deleteDocument(index, id, routing);
        break;

      default:
        // Try to execute as query string
        if (typeof payload === 'string' || payload?.queryString) {
          const queryString = typeof payload === 'string' ? payload : payload.queryString;
          result = elasticsearchEngine.executeQuery(queryString);
        } else {
          message.status = 'failed';
          message.error = `Unsupported Elasticsearch operation: ${operation}`;
          return message;
        }
    }

    if (result.success) {
      message.status = 'delivered';
      message.latency = result.latency || result.took || 10;
      message.payload = {
        ...(message.payload as any),
        operation: result.operation,
        index: result.index,
        id: result.id,
        document: result.document,
        hits: result.hits,
        took: result.took,
        elasticsearchResult: result,
      };
      message.metadata = {
        ...message.metadata,
        elasticsearchOperation: result.operation,
        index: result.index,
        hits: result.hits,
        took: result.took,
      };
    } else {
      message.status = 'failed';
      message.error = result.error || 'Elasticsearch operation failed';
      message.latency = result.latency || result.took || 0;
    }

    return message;
  }

  /**
   * Create handler for storage components (S3, etc.)
   */
  private createStorageHandler(type: string): ComponentDataHandler {
    if (type === 's3-datalake') {
      return {
        processData: (node, message, config) => {
          return this.processS3Operation(node, message, config);
        },
        
        getSupportedFormats: () => ['json', 'binary', 'text', 'xml'],
      };
    }
    
    // Default storage handler
    return {
      processData: (node, message, config) => {
        // Generic storage processing
        message.status = 'delivered';
        message.latency = 50;
        return message;
      },
      
      getSupportedFormats: () => ['json', 'binary', 'text'],
    };
  }

  /**
   * Process S3 operation using S3RoutingEngine
   */
  private processS3Operation(
    node: CanvasNode,
    message: DataMessage,
    config: ComponentConfig
  ): DataMessage {
    const payload = message.payload as any;
    
    // Get S3RoutingEngine from emulationEngine
    const s3Engine = emulationEngine.getS3RoutingEngine(node.id);
    if (!s3Engine) {
      message.status = 'failed';
      message.error = 'S3 Routing Engine not initialized';
      return message;
    }

    // Extract operation from payload
    const operation = payload?.operation || payload?.method || 'PUT';
    const bucketName = payload?.bucket || payload?.bucketName || (node.data.config as any)?.buckets?.[0]?.name || 'default-bucket';
    const key = payload?.key || payload?.objectKey || message.metadata?.key as string;
    const versionId = payload?.versionId || message.metadata?.versionId as string;
    
    let result: any;

    switch (operation.toUpperCase()) {
      case 'PUT':
      case 'UPLOAD':
        if (!key || !message.payload) {
          message.status = 'failed';
          message.error = 'PUT operation requires key and payload';
          return message;
        }
        
        const data = payload?.data || payload?.body || message.payload;
        const contentType = payload?.contentType || message.metadata?.contentType as string;
        const metadata = payload?.metadata || message.metadata as Record<string, string>;
        
        result = s3Engine.putObject(
          bucketName,
          key,
          data,
          message.size,
          metadata,
          contentType
        );
        break;

      case 'GET':
      case 'DOWNLOAD':
        if (!key) {
          message.status = 'failed';
          message.error = 'GET operation requires key';
          return message;
        }
        result = s3Engine.getObject(bucketName, key, versionId);
        break;

      case 'DELETE':
        if (!key) {
          message.status = 'failed';
          message.error = 'DELETE operation requires key';
          return message;
        }
        result = s3Engine.deleteObject(bucketName, key, versionId);
        break;

      case 'LIST':
        const prefix = payload?.prefix || message.metadata?.prefix as string;
        const maxKeys = payload?.maxKeys || payload?.maxKeys || 1000;
        result = s3Engine.listObjects(bucketName, prefix, maxKeys);
        break;

      case 'HEAD':
        if (!key) {
          message.status = 'failed';
          message.error = 'HEAD operation requires key';
          return message;
        }
        result = s3Engine.headObject(bucketName, key);
        break;

      default:
        message.status = 'failed';
        message.error = `Unsupported S3 operation: ${operation}`;
        return message;
    }

    if (result.success) {
      message.status = 'delivered';
      message.latency = result.latency || 50;
      
      // Update payload with operation result
      if (result.object) {
        message.payload = {
          ...(message.payload as any),
          operation: operation.toUpperCase(),
          bucket: bucketName,
          key: key,
          object: result.object,
          etag: result.object.etag,
          versionId: result.versionId || result.object.versionId,
          size: result.object.size,
          storageClass: result.object.storageClass,
        };
      } else if (result.objects) {
        message.payload = {
          ...(message.payload as any),
          operation: 'LIST',
          bucket: bucketName,
          objects: result.objects,
          count: result.objects.length,
        };
      } else {
        message.payload = {
          ...(message.payload as any),
          operation: operation.toUpperCase(),
          bucket: bucketName,
          key: key,
          success: true,
          versionId: result.versionId,
          deleteMarker: result.deleteMarker,
        };
      }
      
      message.metadata = {
        ...message.metadata,
        s3Operation: operation.toUpperCase(),
        bucket: bucketName,
        key: key,
        latency: result.latency,
      };
    } else {
      message.status = 'failed';
      message.error = result.error || `S3 ${operation} operation failed`;
      message.latency = result.latency || 0;
    }

    return message;
  }

  /**
   * Process PostgreSQL SQL query using Query Engine
   */
  private processPostgreSQLQuery(
    node: CanvasNode,
    message: DataMessage,
    config: ComponentConfig
  ): DataMessage {
    if (!this.postgresQueryEngine) {
      message.status = 'failed';
      message.error = 'PostgreSQL Query Engine not initialized';
      return message;
    }

    const sql = (message.payload as any)?.sql;
    if (!sql || typeof sql !== 'string') {
      message.status = 'failed';
      message.error = 'No SQL query provided';
      return message;
    }

    // Get tables, indexes, and views from config
    const pgConfig = node.data.config as any;
    const tables: PostgreSQLTable[] = pgConfig.tables || [];
    const indexes: PostgreSQLIndex[] = this.extractIndexesFromConfig(pgConfig, tables);
    const views = pgConfig.views || [];

    // Execute query
    const result = this.postgresQueryEngine.execute(sql, tables, indexes, views);

    if (result.success) {
      message.status = 'delivered';
      message.latency = result.executionTime || (config.queryLatency as number) || 10;
      message.payload = {
        ...(message.payload as any),
        results: result.rows || [],
        rowCount: result.rowCount || 0,
        queryPlan: result.queryPlan,
        indexesUsed: result.indexesUsed || [],
      };
    } else {
      message.status = 'failed';
      message.error = result.error || 'Query execution failed';
      message.latency = result.executionTime || 0;
    }

    return message;
  }

  /**
   * Process Redis command using RedisRoutingEngine
   */
  private processRedisCommand(
    node: CanvasNode,
    message: DataMessage,
    config: ComponentConfig
  ): DataMessage {
    const payload = message.payload as any;
    
    // Get RedisRoutingEngine from emulationEngine
    const redisEngine = emulationEngine.getRedisRoutingEngine(node.id);
    if (!redisEngine) {
      message.status = 'failed';
      message.error = 'Redis Routing Engine not initialized';
      return message;
    }

    // Check if payload contains Redis command
    let command: string;
    let args: string[];

    if (payload?.command) {
      // Explicit Redis command format: { command: "GET", args: ["key"] }
      command = payload.command;
      args = payload.args || [];
    } else if (payload?.redisCommand) {
      // Alternative format: { redisCommand: "GET key" }
      const parts = String(payload.redisCommand).trim().split(/\s+/);
      command = parts[0];
      args = parts.slice(1);
    } else if (typeof payload === 'string') {
      // String format: "GET key"
      const parts = payload.trim().split(/\s+/);
      command = parts[0];
      args = parts.slice(1);
    } else {
      // Try to infer from operation
      const operation = payload?.operation || 'get';
      switch (operation.toLowerCase()) {
        case 'get':
          command = 'GET';
          args = [payload?.key || 'default:key'];
          break;
        case 'set':
          command = 'SET';
          args = [
            payload?.key || 'default:key',
            typeof payload?.value === 'string' ? payload.value : JSON.stringify(payload?.value || '')
          ];
          if (payload?.ttl) {
            args.push('EX', String(payload.ttl));
          }
          break;
        case 'delete':
        case 'del':
          command = 'DEL';
          args = Array.isArray(payload?.keys) ? payload.keys : [payload?.key || 'default:key'];
          break;
        case 'exists':
          command = 'EXISTS';
          args = Array.isArray(payload?.keys) ? payload.keys : [payload?.key || 'default:key'];
          break;
        default:
          message.status = 'failed';
          message.error = `Unknown Redis operation: ${operation}`;
          return message;
      }
    }

    // Execute command
    const result = redisEngine.executeCommand(command, args);

    if (result.success) {
      message.status = 'delivered';
      message.latency = result.latency || 1; // Redis is very fast
      message.payload = {
        ...(message.payload as any),
        command,
        args,
        result: result.value,
        redisResult: result.value,
      };
    } else {
      message.status = 'failed';
      message.error = result.error || 'Redis command execution failed';
      message.latency = result.latency || 0;
    }

    return message;
  }

  /**
   * Process CQL query using CassandraRoutingEngine
   */
  private processCQLQuery(
    node: CanvasNode,
    message: DataMessage,
    config: ComponentConfig
  ): DataMessage {
    const payload = message.payload as any;
    
    // Get CassandraRoutingEngine from emulationEngine
    const cassandraEngine = emulationEngine.getCassandraRoutingEngine(node.id);
    if (!cassandraEngine) {
      message.status = 'failed';
      message.error = 'Cassandra Routing Engine not initialized';
      return message;
    }

    // Extract CQL query from payload
    let cqlQuery: string;
    let consistencyLevel: string | undefined;

    if (payload?.cql) {
      // Explicit CQL format: { cql: "SELECT * FROM keyspace.table", consistency: "QUORUM" }
      cqlQuery = payload.cql;
      consistencyLevel = payload.consistency;
    } else if (payload?.query) {
      // Alternative format: { query: "SELECT * FROM keyspace.table" }
      cqlQuery = payload.query;
      consistencyLevel = payload.consistency;
    } else if (typeof payload === 'string') {
      // String format: "SELECT * FROM keyspace.table"
      cqlQuery = payload;
    } else {
      // Try to infer from operation
      const operation = payload?.operation || 'select';
      const cassandraConfig = node.data.config as any;
      const keyspace = payload?.keyspace || cassandraConfig?.keyspace || 'system';
      const table = payload?.table || 'default_table';
      
      switch (operation.toLowerCase()) {
        case 'select':
        case 'read':
          cqlQuery = `SELECT * FROM ${keyspace}.${table}`;
          if (payload?.limit) {
            cqlQuery += ` LIMIT ${payload.limit}`;
          }
          break;
        case 'insert':
        case 'write':
          const columns = payload?.columns ? Object.keys(payload.columns).join(', ') : 'id, data';
          const values = payload?.columns 
            ? Object.values(payload.columns).map((v: any) => `'${v}'`).join(', ')
            : `${Date.now()}, 'data'`;
          cqlQuery = `INSERT INTO ${keyspace}.${table} (${columns}) VALUES (${values})`;
          break;
        case 'update':
          const updateCols = payload?.columns || {};
          const setClause = Object.entries(updateCols)
            .map(([k, v]) => `${k} = '${v}'`)
            .join(', ');
          cqlQuery = `UPDATE ${keyspace}.${table} SET ${setClause}`;
          if (payload?.where) {
            cqlQuery += ` WHERE ${payload.where}`;
          }
          break;
        case 'delete':
          cqlQuery = `DELETE FROM ${keyspace}.${table}`;
          if (payload?.where) {
            cqlQuery += ` WHERE ${payload.where}`;
          }
          break;
        default:
          message.status = 'failed';
          message.error = `Unknown CQL operation: ${operation}`;
          return message;
      }
    }

    // Get consistency level from config if not provided
    if (!consistencyLevel) {
      const cassandraConfig = node.data.config as any;
      consistencyLevel = cassandraConfig?.consistencyLevel || 'QUORUM';
    }

    // Execute CQL query
    const result = cassandraEngine.executeCQL(cqlQuery, consistencyLevel as any);

    if (result.success) {
      message.status = 'delivered';
      message.latency = result.latency || 5; // Cassandra latency
      message.payload = {
        ...(message.payload as any),
        cql: cqlQuery,
        consistency: result.consistency,
        rows: result.rows || [],
        rowCount: result.rowCount || 0,
        replicasQueried: result.replicasQueried,
        cqlResult: result.rows,
      };
      message.metadata = {
        ...message.metadata,
        cassandraConsistency: result.consistency,
        cassandraReplicasQueried: result.replicasQueried,
      };
    } else {
      message.status = 'failed';
      message.error = result.error || 'CQL query execution failed';
      message.latency = result.latency || 0;
    }

    return message;
  }

  /**
   * Extract indexes from PostgreSQL config
   */
  private extractIndexesFromConfig(
    config: any,
    tables: PostgreSQLTable[]
  ): PostgreSQLIndex[] {
    const indexes: PostgreSQLIndex[] = [];

    // Extract indexes from table definitions
    for (const table of tables) {
      for (const indexName of table.indexes || []) {
        // Try to parse index definition (simplified)
        // Format: "CREATE INDEX idx_name ON table (col1, col2)"
        const match = indexName.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(\w+)\s+ON\s+\w+\s*\(([^)]+)\)/i);
        if (match) {
          indexes.push({
            name: match[1],
            table: table.name,
            schema: table.schema,
            columns: match[2].split(',').map((c) => c.trim()),
            unique: indexName.toUpperCase().includes('UNIQUE'),
          });
        } else {
          // Simple index name, assume single column
          indexes.push({
            name: indexName,
            table: table.name,
            schema: table.schema,
            columns: [indexName.replace(/^idx_|^index_/i, '')], // Guess column from index name
          });
        }
      }
    }

    return indexes;
  }

  /**
   * Create handler for message brokers
   */
  private createMessageBrokerHandler(type: string): ComponentDataHandler {
    if (type === 'rabbitmq') {
      return {
        processData: (node, message, config) => {
          // Get routing engine from emulation engine
          const routingEngine = emulationEngine.getRabbitMQRoutingEngine(node.id);
          
          if (!routingEngine) {
            // No routing engine, just pass through
            message.status = 'delivered';
            return message;
          }
          
          // Extract exchange and routing key from message metadata or config
          const messagingConfig = (config as any)?.messaging || message.metadata?.messaging || {};
          const exchange = messagingConfig.exchange || 'amq.topic';
          const routingKey = messagingConfig.routingKey || message.metadata?.routingKey || 'default';
          const headers = message.metadata?.headers;
          const priority = message.metadata?.priority;
          
          // Route message through exchange
          const targetQueues = routingEngine.routeMessage(
            exchange,
            routingKey,
            message.payload,
            message.size,
            headers,
            priority
          );
          
          if (targetQueues.length > 0) {
            message.status = 'delivered';
            // Store routing info in metadata
            message.metadata = {
              ...message.metadata,
              routedQueues: targetQueues,
              exchange,
              routingKey,
            };
          } else {
            // No queues matched, message is lost (or could go to DLX)
            message.status = 'failed';
            message.error = `No queues bound to exchange '${exchange}' with routing key '${routingKey}'`;
          }
          
          return message;
        },
        
        getSupportedFormats: () => ['json', 'binary', 'text'],
      };
    }
    
    if (type === 'activemq') {
      return {
        processData: (node, message, config) => {
          // Get routing engine from emulation engine
          const routingEngine = emulationEngine.getActiveMQRoutingEngine(node.id);
          
          if (!routingEngine) {
            // No routing engine, just pass through
            message.status = 'delivered';
            return message;
          }
          
          // Extract queue or topic from message metadata or config
          const messagingConfig = (config as any)?.messaging || message.metadata?.messaging || {};
          const queue = messagingConfig.queue;
          const topic = messagingConfig.topic;
          const headers = message.metadata?.headers;
          const priority = message.metadata?.priority;
          
          let routed = false;
          let destination = '';
          
          // Check ACL permissions before routing
          const activeMQConfig = (node.data.config as any) || {};
          const acls = activeMQConfig.acls || [];
          
          // Get principal from source component config or message metadata
          const sourceNode = this.nodes.find(n => n.id === message.source);
          const sourceConfig = sourceNode?.data.config as any;
          const principal = message.metadata?.principal || 
                           sourceConfig?.username || 
                           sourceConfig?.clientId ||
                           activeMQConfig.username || // Fallback to broker username
                           `user-${message.source.slice(0, 8)}`;
          
          // Route to queue (point-to-point)
          if (queue) {
            // Check Write permission for queue
            const hasPermission = emulationEngine.checkActiveMQACLPermissionPublic?.(
              acls,
              principal,
              `queue://${queue}`,
              'write'
            ) ?? true; // Default allow if method doesn't exist
            
            if (!hasPermission) {
              message.status = 'failed';
              message.error = `Access denied: principal '${principal}' does not have write permission for queue '${queue}'`;
              return message;
            }
            
            const success = routingEngine.routeToQueue(
              queue,
              message.payload,
              message.size,
              headers,
              priority
            );
            if (success) {
              routed = true;
              destination = queue;
            }
          }
          
          // Publish to topic (publish-subscribe)
          if (topic) {
            // Check Write permission for topic
            const hasPermission = emulationEngine.checkActiveMQACLPermissionPublic?.(
              acls,
              principal,
              `topic://${topic}`,
              'write'
            ) ?? true; // Default allow if method doesn't exist
            
            if (!hasPermission) {
              message.status = 'failed';
              message.error = `Access denied: principal '${principal}' does not have write permission for topic '${topic}'`;
              return message;
            }
            
            const subscriptionIds = routingEngine.publishToTopic(
              topic,
              message.payload,
              message.size,
              headers,
              priority
            );
            if (subscriptionIds.length > 0) {
              routed = true;
              destination = topic;
            }
          }
          
          if (routed) {
            message.status = 'delivered';
            // Store routing info in metadata
            message.metadata = {
              ...message.metadata,
              destination,
              queue: queue || undefined,
              topic: topic || undefined,
            };
          } else {
            // No queue or topic matched, message is lost
            message.status = 'failed';
            message.error = `No queue or topic found. Queue: '${queue || 'none'}', Topic: '${topic || 'none'}'`;
          }
          
          return message;
        },
        
        getSupportedFormats: () => ['json', 'binary', 'text'],
      };
    }
    
    if (type === 'aws-sqs') {
      return {
        processData: (node, message, config) => {
          // Get routing engine from emulation engine
          const routingEngine = emulationEngine.getSQSRoutingEngine(node.id);
          
          if (!routingEngine) {
            // No routing engine, just pass through
            message.status = 'delivered';
            return message;
          }
          
          // Extract queue name from message metadata or config
          const messagingConfig = (config as any)?.messaging || message.metadata?.messaging || {};
          const queueUrl = messagingConfig.queueUrl;
          const queueName = messagingConfig.queueName || 
            (queueUrl ? queueUrl.split('/').pop() : null) ||
            message.metadata?.queueName || 
            'default-queue';
          
          // Check IAM policies before sending message
          const sqsConfig = (node.data.config as any) || {};
          const iamPolicies = sqsConfig.iamPolicies || [];
          
          // Get principal from source component config or message metadata
          const sourceNode = this.nodes.find(n => n.id === message.source);
          const sourceConfig = sourceNode?.data.config as any;
          const principal = message.metadata?.principal || 
                           sourceConfig?.accessKeyId || 
                           sourceConfig?.clientId ||
                           sqsConfig.accessKeyId || // Fallback to SQS access key
                           `arn:aws:iam::123456789012:user/${message.source.slice(0, 8)}`;
          
          // Check if principal has SendMessage permission
          const hasPermission = emulationEngine.checkSQSIAMPolicy?.(
            iamPolicies,
            principal,
            queueName,
            'sqs:SendMessage'
          ) ?? true; // Default allow if method doesn't exist
          
          if (!hasPermission) {
            message.status = 'failed';
            message.error = `Access denied: principal '${principal}' does not have sqs:SendMessage permission for queue '${queueName}'`;
            return message;
          }
          
          // Extract message attributes
          const messageGroupId = message.metadata?.messageGroupId;
          const messageDeduplicationId = message.metadata?.messageDeduplicationId;
          const attributes = message.metadata?.attributes;
          
          // Send message to queue
          const messageId = routingEngine.sendMessage(
            queueName,
            message.payload,
            message.size,
            attributes,
            messageGroupId,
            messageDeduplicationId
          );
          
          if (messageId) {
            message.status = 'delivered';
            // Store routing info in metadata
            message.metadata = {
              ...message.metadata,
              queueName,
              messageId,
              queueUrl: queueUrl || `https://sqs.${sqsConfig.defaultRegion || 'us-east-1'}.amazonaws.com/.../${queueName}`,
            };
          } else {
            // Queue not found
            message.status = 'failed';
            message.error = `Queue '${queueName}' not found`;
          }
          
          return message;
        },
        
        getSupportedFormats: () => ['json', 'binary', 'text'],
      };
    }
    
    if (type === 'azure-service-bus') {
      return {
        processData: (node, message, config) => {
          // Get routing engine from emulation engine
          const routingEngine = emulationEngine.getAzureServiceBusRoutingEngine(node.id);
          
          if (!routingEngine) {
            // No routing engine, just pass through
            message.status = 'delivered';
            return message;
          }
          
          // Extract queue or topic from message metadata or config
          const messagingConfig = (config as any)?.messaging || message.metadata?.messaging || {};
          const queue = messagingConfig.queue;
          const topic = messagingConfig.topic;
          const properties = message.metadata?.properties || message.metadata?.headers;
          const sessionId = message.metadata?.sessionId;
          const scheduledEnqueueTime = message.metadata?.scheduledEnqueueTime;
          
          let routed = false;
          let destination = '';
          let messageIds: string[] = [];
          
          // Route to queue (point-to-point)
          if (queue) {
            const messageId = routingEngine.sendToQueue(
              queue,
              message.payload,
              message.size,
              properties,
              sessionId,
              scheduledEnqueueTime
            );
            
            if (messageId) {
              routed = true;
              destination = queue;
              messageIds.push(messageId);
            }
          }
          
          // Publish to topic (publish-subscribe)
          if (topic) {
            const ids = routingEngine.publishToTopic(
              topic,
              message.payload,
              message.size,
              properties,
              scheduledEnqueueTime
            );
            
            if (ids.length > 0) {
              routed = true;
              destination = topic;
              messageIds = ids;
            }
          }
          
          if (routed) {
            message.status = 'delivered';
            // Store routing info in metadata
            message.metadata = {
              ...message.metadata,
              destination,
              queue: queue || undefined,
              topic: topic || undefined,
              messageIds,
              sessionId: sessionId || undefined,
            };
          } else {
            // No queue or topic matched, message is lost
            message.status = 'failed';
            message.error = `No queue or topic found. Queue: '${queue || 'none'}', Topic: '${topic || 'none'}'`;
          }
          
          return message;
        },
        
        getSupportedFormats: () => ['json', 'binary', 'text'],
      };
    }
    
    if (type === 'gcp-pubsub') {
      return {
        processData: (node, message, config) => {
          // Get routing engine from emulation engine
          const routingEngine = emulationEngine.getPubSubRoutingEngine(node.id);
          
          if (!routingEngine) {
            // No routing engine, just pass through
            message.status = 'delivered';
            return message;
          }
          
          // Extract topic from message metadata or config
          const messagingConfig = (config as any)?.messaging || message.metadata?.messaging || {};
          const topicName = messagingConfig.topic || message.metadata?.topic;
          const orderingKey = messagingConfig.orderingKey || message.metadata?.orderingKey;
          const attributes = message.metadata?.attributes || message.metadata?.headers;
          
          // If no topic specified, try to use first topic from config
          const pubSubConfig = (node.data.config as any) || {};
          const finalTopicName = topicName || (pubSubConfig.topics && pubSubConfig.topics[0]?.name) || null;
          
          if (!finalTopicName) {
            message.status = 'failed';
            message.error = 'No topic specified for Pub/Sub message';
            return message;
          }
          
          // Publish to topic
          const messageId = routingEngine.publishToTopic(
            finalTopicName,
            message.payload,
            message.size,
            attributes,
            orderingKey
          );
          
          if (messageId) {
            message.status = 'delivered';
            // Store routing info in metadata
            message.metadata = {
              ...message.metadata,
              topic: finalTopicName,
              messageId,
              orderingKey: orderingKey || undefined,
            };
          } else {
            // Topic not found
            message.status = 'failed';
            message.error = `Topic '${finalTopicName}' not found`;
          }
          
          return message;
        },
        
        getSupportedFormats: () => ['json', 'binary', 'text'],
      };
    }
    
    // Default handler for other message brokers (Kafka, etc.)
    return {
      processData: (node, message, config) => {
        // Message broker just passes through messages
        message.status = 'delivered';
        return message;
      },
      
      getSupportedFormats: () => ['json', 'binary', 'text'],
    };
  }

  /**
   * Create handler for APIs
   */
  private createAPIHandler(type: string): ComponentDataHandler {
    // Special handling for REST API with routing engine
    if (type === 'rest') {
      return {
        processData: (node, message, config) => {
          // Get REST API routing engine from emulation engine
          const routingEngine = emulationEngine.getRestApiRoutingEngine(node.id);
          
          if (!routingEngine) {
            // No routing engine, use default behavior
            const response = {
              status: 'success',
              data: message.payload,
              timestamp: Date.now(),
            };
            message.payload = response;
            message.status = 'delivered';
            return message;
          }

          // Extract request information from message
          const payload = message.payload as any;
          const path = payload?.path || message.metadata?.path || '/';
          const method = (payload?.method || message.metadata?.method || 'GET') as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
          const headers = payload?.headers || message.metadata?.headers || {};
          const query = payload?.query || message.metadata?.query || {};
          const body = payload?.body || payload || message.payload;
          const clientIP = payload?.clientIP || message.metadata?.clientIP;

          // Route request through REST API
          const routeResult = routingEngine.routeRequest({
            path,
            method,
            headers,
            query,
            body,
            clientIP,
          });

          if (routeResult.status >= 200 && routeResult.status < 300) {
            message.status = 'delivered';
            message.latency = routeResult.latency;
            message.payload = routeResult.data;
            // Update metadata with routing info
            message.metadata = {
              ...message.metadata,
              restApiEndpoint: routeResult.endpoint,
              restApiStatus: routeResult.status,
              restApiHeaders: routeResult.headers,
            };
          } else {
            message.status = 'failed';
            message.error = routeResult.error || `HTTP ${routeResult.status}`;
            message.latency = routeResult.latency;
            message.metadata = {
              ...message.metadata,
              restApiEndpoint: routeResult.endpoint,
              restApiStatus: routeResult.status,
            };
          }

          return message;
        },
        
        transformData: (node, message, targetType, config) => {
          // REST API transforms to JSON
          if (message.format !== 'json') {
            message.format = 'json';
            message.status = 'transformed';
          }
          return message;
        },
        
        getSupportedFormats: () => ['json', 'xml'],
      };
    }
    
    // Special handling for gRPC with routing engine
    if (type === 'grpc') {
      return {
        processData: (node, message, config) => {
          // Get gRPC routing engine from emulation engine
          const routingEngine = emulationEngine.getGRPCRoutingEngine(node.id);
          
          if (!routingEngine) {
            // No routing engine, use default behavior
            const response = {
              status: 'OK',
              data: message.payload,
              timestamp: Date.now(),
            };
            message.payload = response;
            message.status = 'delivered';
            return message;
          }

          // Extract request information from message
          const payload = message.payload as any;
          const service = payload?.service || message.metadata?.service || '';
          const method = payload?.method || message.metadata?.method || '';
          const grpcPayload = payload?.payload || payload?.body || payload || message.payload;
          const metadata = payload?.metadata || message.metadata || {};
          const timeout = payload?.timeout || message.metadata?.timeout;
          const clientIP = payload?.clientIP || message.metadata?.clientIP;

          // Route request through gRPC service
          const routeResult = routingEngine.routeRequest({
            service,
            method,
            payload: grpcPayload,
            metadata,
            timeout,
            clientIP,
          });

          if (routeResult.status === 'OK') {
            message.status = 'delivered';
            message.latency = routeResult.latency;
            message.payload = routeResult.data;
            // Update metadata with routing info
            message.metadata = {
              ...message.metadata,
              grpcService: routeResult.service,
              grpcMethod: routeResult.method,
              grpcStatus: routeResult.status,
              grpcMetadata: routeResult.metadata,
            };
          } else {
            message.status = 'failed';
            message.error = routeResult.error || `gRPC ${routeResult.status}`;
            message.latency = routeResult.latency;
            message.metadata = {
              ...message.metadata,
              grpcService: routeResult.service,
              grpcMethod: routeResult.method,
              grpcStatus: routeResult.status,
            };
          }

          return message;
        },
        
        transformData: (node, message, targetType, config) => {
          // gRPC transforms to protobuf
          if (message.format !== 'protobuf' && message.format !== 'binary') {
            message.format = 'protobuf';
            message.status = 'transformed';
          }
          return message;
        },
        
        getSupportedFormats: () => ['protobuf', 'binary'],
      };
    }
    
    // GraphQL handler
    if (type === 'graphql') {
      return {
        processData: (node, message, config) => {
          // Get GraphQL emulation engine
          const graphQLEngine = emulationEngine.getGraphQLEmulationEngine(node.id);
          
          if (!graphQLEngine) {
            // No engine, just pass through
            message.status = 'delivered';
            return message;
          }
          
          // Extract GraphQL query from message
          const payload = message.payload as any;
          
          // Check if this is a batch request (array of requests)
          if (Array.isArray(payload)) {
            // Process batch requests
            // Note: processBatchQueries doesn't support tracing yet, but we can add it later
            const batchPromise = graphQLEngine.processBatchQueries(
              payload,
              this.nodes,
              this.connections
            );
            
            // Handle async batch processing
            let resolved = false;
            let resolvedValue: any = null;
            (batchPromise as Promise<any>).then((value) => {
              resolvedValue = value;
              resolved = true;
            }).catch(() => {
              resolved = true;
            });
            
            const startWait = Date.now();
            while (!resolved && (Date.now() - startWait) < 500) {
              // Wait for batch processing
            }
            
            const batchResults = resolvedValue || [];
            
            // Update message with batch results
            message.payload = batchResults;
            message.status = batchResults.every((r: any) => r.success) ? 'delivered' : 'error';
            if (!message.status || message.status === 'error') {
              message.error = 'Some batch queries failed';
            }
            
            return message;
          }
          
          // Single request processing
          const query = payload?.query || payload?.body?.query || message.metadata?.query;
          const variables = payload?.variables || payload?.body?.variables || message.metadata?.variables;
          const operationName = payload?.operationName || payload?.body?.operationName || message.metadata?.operationName;
          const extensions = payload?.extensions || payload?.body?.extensions || message.metadata?.extensions;
          
          // Determine if it's a mutation or query
          const isMutation = query && query.trim().toLowerCase().startsWith('mutation');
          
          // Process through GraphQL engine with nodes and connections for resolver execution
          // Note: processQuery is async, but DataFlowEngine processData is synchronous
          // For simulation, we'll handle the promise synchronously using a workaround
          let result: any;
          if (isMutation) {
            result = graphQLEngine.processMutation({
              query,
              variables,
              operationName,
            });
          } else {
            // processQuery is async, but we need synchronous result
            // In simulation, we can use a synchronous wrapper
            // Pass getJaegerEngines for tracing support
            const getJaegerEngines = () => emulationEngine.getAllJaegerEngines();
            const queryPromise = graphQLEngine.processQuery({
              query,
              variables,
              operationName,
              extensions,
            }, this.nodes, this.connections, getJaegerEngines);
            
            // For simulation: if it's a promise, we'll resolve it immediately
            // This is a simplification for the simulation engine
            if (queryPromise && typeof (queryPromise as any).then === 'function') {
              // Synchronous promise resolution for simulation
              let resolved = false;
              let resolvedValue: any = null;
              (queryPromise as Promise<any>).then((value) => {
                resolvedValue = value;
                resolved = true;
              }).catch(() => {
                resolved = true;
              });
              
              // Wait synchronously (only works in simulation context)
              // In real async system, this would need to be handled differently
              const startWait = Date.now();
              while (!resolved && (Date.now() - startWait) < 100) {
                // Small timeout to prevent infinite loop
                // In real system, this would be handled asynchronously
              }
              
              result = resolvedValue || {
                success: false,
                errors: [{ message: 'Query execution timeout' }],
                latency: Date.now() - startWait,
              };
            } else {
              result = queryPromise;
            }
          }
          
          // Update message with GraphQL response
          if (result.success) {
            message.payload = {
              data: result.data,
              extensions: result.complexity !== undefined ? {
                complexity: result.complexity,
                depth: result.depth,
              } : undefined,
            };
            message.metadata = {
              ...message.metadata,
              latency: result.latency,
              complexity: result.complexity,
              depth: result.depth,
              cached: result.cached,
            };
            message.status = 'delivered';
          } else {
            message.payload = {
              errors: result.errors,
            };
            message.status = 'error';
            message.error = result.errors?.[0]?.message || 'GraphQL query failed';
          }
          
          return message;
        },
        
        transformData: (node, message, targetType, config) => {
          // GraphQL uses JSON format
          if (message.format !== 'json') {
            message.format = 'json';
            message.status = 'transformed';
          }
          return message;
        },
        
        getSupportedFormats: () => ['json'],
      };
    }
    
    // Special handling for SOAP with emulation engine
    if (type === 'soap') {
      return {
        processData: (node, message, config) => {
          // Get SOAP emulation engine
          const soapEngine = emulationEngine.getSOAPEmulationEngine(node.id);
          
          if (!soapEngine) {
            // No engine, just pass through
            message.status = 'delivered';
            return message;
          }
          
          // Extract SOAP envelope from message
          const payload = message.payload as any;
          const envelope = payload?.envelope || payload?.body || (typeof payload === 'string' ? payload : '');
          const operation = payload?.operation || message.metadata?.operation;
          const service = payload?.service || message.metadata?.service;
          const headers = payload?.headers || message.metadata?.headers || {};
          const clientIP = payload?.clientIP || message.metadata?.clientIP;
          
          if (!envelope) {
            message.status = 'error';
            message.error = 'SOAP envelope is required';
            return message;
          }
          
          // Get Jaeger engines for tracing
          const getJaegerEngines = () => {
            const engines = new Map();
            for (const n of this.nodes) {
              if (n.type === 'jaeger') {
                const jaegerEngine = emulationEngine.getJaegerEmulationEngine(n.id);
                if (jaegerEngine) {
                  engines.set(n.id, jaegerEngine);
                }
              }
            }
            return engines;
          };
          
          // Process SOAP request
          const soapResponse = soapEngine.processRequest(
            {
              envelope,
              operation,
              service,
              headers,
              clientIP,
            },
            this.nodes,
            this.connections,
            getJaegerEngines
          );
          
          // Update message with SOAP response
          if (soapResponse.success) {
            message.payload = {
              envelope: soapResponse.envelope,
              status: soapResponse.status,
            };
            message.metadata = {
              ...message.metadata,
              latency: soapResponse.latency,
              soapVersion: (config as any)?.soapVersion || '1.1',
            };
            message.status = 'delivered';
            message.latency = soapResponse.latency;
          } else {
            message.payload = {
              envelope: soapResponse.envelope,
              fault: soapResponse.fault,
              error: soapResponse.error,
            };
            message.status = 'error';
            message.error = soapResponse.error || soapResponse.fault?.string || 'SOAP request failed';
            message.latency = soapResponse.latency;
          }
          
          return message;
        },
        
        transformData: (node, message, targetType, config) => {
          // SOAP uses XML format
          if (message.format !== 'xml') {
            message.format = 'xml';
            message.status = 'transformed';
          }
          return message;
        },
        
        getSupportedFormats: () => ['xml', 'json'],
      };
    }
    
    // Special handling for WebSocket
    if (type === 'websocket') {
      return {
        processData: (node, message, config) => {
          // Get WebSocket emulation engine
          const wsEngine = emulationEngine.getWebSocketEmulationEngine(node.id);
          
          if (wsEngine) {
            // WebSocket handles bidirectional communication
            // Messages are processed and can trigger responses or broadcasts
            const wsConfig = (config as any) || {};
            const connectionId = (message.metadata?.connectionId as string) || `conn-${Date.now()}`;
            
            // Обрабатываем входящее сообщение через движок эмуляции
            // Это включает broadcast в комнаты, доставку подписчикам и отправку в целевые компоненты
            const processResult = wsEngine.processIncomingMessage(
              connectionId,
              message.payload,
              message.metadata
            );
            
            // Проверяем, была ли ошибка при обработке
            if (!processResult.processed) {
              // Формируем ответ с ошибкой
              const errorResponse = {
                status: 'error',
                type: 'websocket',
                connectionId,
                data: message.payload,
                timestamp: Date.now(),
                processed: false,
                error: processResult.error || 'Failed to process message',
              };
              
              message.payload = errorResponse;
              message.status = 'error';
              return message;
            }
            
            // Формируем ответ с информацией о обработке
            const response = {
              status: 'success',
              type: 'websocket',
              connectionId,
              data: message.payload,
              timestamp: Date.now(),
              processed: processResult.processed,
              broadcastToRoom: processResult.broadcastToRoom,
              deliveredToSubscriptions: processResult.deliveredToSubscriptions,
              forwarded: processResult.forwarded,
            };
            
            message.payload = response;
            message.status = 'delivered';
            return message;
          }
          
          // Fallback if engine not available
          const response = {
            status: 'success',
            data: message.payload,
            timestamp: Date.now(),
          };
          
          message.payload = response;
          message.status = 'delivered';
          return message;
        },
        
        transformData: (node, message, targetType, config) => {
          // WebSocket can transform between formats
          const wsConfig = (config as any) || {};
          
          // If target expects different format, transform
          if (targetType === 'rest' && message.format === 'binary') {
            // Convert binary to JSON for REST
            message.format = 'json';
            message.payload = { data: 'Binary data converted to JSON' };
          } else if (targetType === 'grpc' && message.format === 'text') {
            // Convert text to JSON for gRPC
            message.format = 'json';
            message.payload = { message: message.payload };
          }
          
          return message;
        },
        
        getSupportedFormats: () => ['json', 'text', 'binary'],
      };
    }
    
    // Default handler for other API types
    return {
      processData: (node, message, config) => {
        // APIs process requests and return responses
        const response = {
          status: 'success',
          data: message.payload,
          timestamp: Date.now(),
        };
        
        message.payload = response;
        message.status = 'delivered';
        return message;
      },
      
      transformData: (node, message, targetType, config) => {
        // Transform based on API type
        return message;
      },
      
      getSupportedFormats: () => {
        return ['json'];
      },
    };
  }

  /**
   * Create handler for integration components
   */
  private createIntegrationHandler(type: string): ComponentDataHandler {
    if (type === 'kong') {
      return {
        processData: (node, message, config) => {
          // Get Kong routing engine from emulation engine
          const routingEngine = emulationEngine.getKongRoutingEngine(node.id);
          
          if (!routingEngine) {
            // No routing engine, just pass through
            message.status = 'delivered';
            return message;
          }

          // Extract request information from message
          const payload = message.payload as any;
          const path = payload?.path || message.metadata?.path || '/';
          const method = payload?.method || message.metadata?.method || 'GET';
          const headers = payload?.headers || message.metadata?.headers || {};
          const query = payload?.query || message.metadata?.query || {};
          const apiKey = headers['apikey'] || headers['X-API-Key'] || query['apikey'];
          const consumerId = message.metadata?.consumerId;

          // Route request through Kong Gateway
          const routeResult = routingEngine.routeRequest({
            path,
            method,
            headers,
            query,
            body: payload?.body,
            consumerId,
            apiKey,
          });

          if (routeResult.response.status >= 200 && routeResult.response.status < 300) {
            message.status = 'delivered';
            message.latency = routeResult.response.latency;
            // Update metadata with routing info
            message.metadata = {
              ...message.metadata,
              kongRoute: routeResult.match?.route.id,
              kongService: routeResult.match?.service.id,
              kongTarget: routeResult.target,
              kongResponseStatus: routeResult.response.status,
            };
          } else {
            message.status = 'failed';
            message.error = routeResult.response.error || `HTTP ${routeResult.response.status}`;
            message.latency = routeResult.response.latency;
          }

          return message;
        },
        
        transformData: (node, message, targetType, config) => {
          // Kong can transform requests/responses
          const targetFormats = this.getTargetFormats(targetType);
          if (targetFormats.length > 0 && !targetFormats.includes(message.format)) {
            message.format = targetFormats[0];
            message.status = 'transformed';
          }
          return message;
        },
        
        getSupportedFormats: () => ['json', 'xml', 'binary'],
      };
    }

    if (type === 'api-gateway') {
      return {
        processData: (node, message, config) => {
          // Get Cloud API Gateway engine from emulation engine
          const gatewayEngine = emulationEngine.getCloudAPIGatewayEngine(node.id);
          
          if (!gatewayEngine) {
            // No gateway engine, just pass through
            message.status = 'delivered';
            return message;
          }

          // Extract request information from message
          const payload = message.payload as any;
          const path = payload?.path || message.metadata?.path || '/';
          const method = payload?.method || message.metadata?.method || 'GET';
          const headers = payload?.headers || message.metadata?.headers || {};
          const query = payload?.query || message.metadata?.query || {};
          const apiKey = headers['x-api-key'] || 
                        headers['X-API-Key'] || 
                        headers['ocp-apim-subscription-key'] ||
                        query['key'] ||
                        query['subscription-key'] ||
                        query['apikey'];

          // Create gateway request
          const gatewayRequest = {
            path,
            method: method.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL',
            headers,
            query,
            body: payload?.body,
            apiKey,
          };

          // Process request through gateway
          const gatewayResponse = gatewayEngine.processRequest(gatewayRequest);

          // Handle gateway response
          if (gatewayResponse.status >= 200 && gatewayResponse.status < 300) {
            message.status = 'delivered';
            message.latency = (message.latency || 0) + gatewayResponse.latency;
            
            // Update metadata with gateway info
            message.metadata = {
              ...message.metadata,
              gatewayProvider: gatewayResponse.metadata?.gatewayProvider,
              gatewayApiId: gatewayResponse.metadata?.apiId,
              gatewayKeyId: gatewayResponse.metadata?.keyId,
              gatewayCacheHit: gatewayResponse.metadata?.cacheHit || false,
              gatewayRateLimitRemaining: gatewayResponse.metadata?.rateLimitRemaining,
              gatewayResponseStatus: gatewayResponse.status,
            };

            // If cache hit, don't forward to backend
            if (gatewayResponse.metadata?.cacheHit) {
              message.status = 'delivered';
              message.payload = gatewayResponse.body || message.payload;
              return message;
            }
          } else {
            // Gateway rejected request (auth, rate limit, etc.)
            message.status = 'failed';
            message.error = gatewayResponse.error || `HTTP ${gatewayResponse.status}`;
            message.latency = (message.latency || 0) + gatewayResponse.latency;
            
            // Add gateway error metadata
            message.metadata = {
              ...message.metadata,
              gatewayProvider: gatewayResponse.metadata?.gatewayProvider,
              gatewayApiId: gatewayResponse.metadata?.apiId,
              gatewayError: gatewayResponse.error,
              gatewayResponseStatus: gatewayResponse.status,
            };

            return message;
          }

          return message;
        },
        
        transformData: (node, message, targetType, config) => {
          // Cloud API Gateway can transform requests/responses
          const targetFormats = this.getTargetFormats(targetType);
          if (targetFormats.length > 0 && !targetFormats.includes(message.format)) {
            message.format = targetFormats[0];
            message.status = 'transformed';
          }
          return message;
        },
        
        getSupportedFormats: () => ['json', 'xml', 'binary'],
      };
    }

    if (type === 'nginx') {
      return {
        processData: (node, message, config) => {
          // Get NGINX routing engine from emulation engine
          const routingEngine = emulationEngine.getNginxRoutingEngine(node.id);
          
          if (!routingEngine) {
            // No routing engine, just pass through
            message.status = 'delivered';
            return message;
          }

          // Extract request information from message
          const payload = message.payload as any;
          const path = payload?.path || message.metadata?.path || '/';
          const method = payload?.method || message.metadata?.method || 'GET';
          const headers = payload?.headers || message.metadata?.headers || {};
          const query = payload?.query || message.metadata?.query || {};
          const clientIP = headers['X-Real-IP'] || headers['X-Forwarded-For'] || message.metadata?.clientIP;
          const protocol = headers['X-Forwarded-Proto'] === 'https' || message.metadata?.protocol === 'https' ? 'https' : 'http';

          // Route request through NGINX
          const routeResult = routingEngine.routeRequest({
            path,
            method,
            headers,
            query,
            body: payload?.body,
            clientIP,
            protocol,
          });

          if (routeResult.response.status >= 200 && routeResult.response.status < 300) {
            message.status = 'delivered';
            message.latency = routeResult.response.latency;
            // Update metadata with routing info
            message.metadata = {
              ...message.metadata,
              nginxLocation: routeResult.match?.location.path,
              nginxUpstream: routeResult.upstreamTarget,
              nginxResponseStatus: routeResult.response.status,
              nginxCacheHit: routeResult.response.cacheHit,
            };
            // Update payload if response has body
            if (routeResult.response.body) {
              message.payload = routeResult.response.body;
            }
          } else {
            message.status = 'failed';
            message.error = routeResult.response.error || `HTTP ${routeResult.response.status}`;
            message.latency = routeResult.response.latency;
          }

          return message;
        },
        
        transformData: (node, message, targetType, config) => {
          // NGINX can transform requests/responses (gzip, etc.)
          const nginxConfig = (node.data.config as any) || {};
          if (nginxConfig.enableGzip && message.metadata?.nginxCacheHit) {
            // Gzip compression is handled by NGINX
            message.metadata = {
              ...message.metadata,
              contentEncoding: 'gzip',
            };
          }
          
          const targetFormats = this.getTargetFormats(targetType);
          if (targetFormats.length > 0 && !targetFormats.includes(message.format)) {
            message.format = targetFormats[0];
            message.status = 'transformed';
          }
          return message;
        },
        
        getSupportedFormats: () => ['json', 'xml', 'binary', 'text'],
      };
    }

    if (type === 'envoy') {
      return {
        processData: (node, message, config) => {
          // Get Envoy routing engine from emulation engine
          const routingEngine = emulationEngine.getEnvoyRoutingEngine(node.id);
          
          if (!routingEngine) {
            // No routing engine, just pass through
            message.status = 'delivered';
            return message;
          }

          // Extract request information from message
          const payload = message.payload as any;
          const path = payload?.path || message.metadata?.path || '/';
          const method = payload?.method || message.metadata?.method || 'GET';
          const headers = payload?.headers || message.metadata?.headers || {};
          const query = payload?.query || message.metadata?.query || {};
          const clientIP = headers['X-Real-IP'] || headers['X-Forwarded-For'] || message.metadata?.clientIP;
          const protocol = headers['X-Forwarded-Proto'] === 'https' || message.metadata?.protocol === 'https' ? 'https' : 'http';
          const host = headers['Host'] || message.metadata?.host;

          // Route request through Envoy Proxy
          const routeResult = routingEngine.routeRequest({
            path,
            method,
            headers,
            query,
            body: payload?.body,
            clientIP,
            protocol,
            host,
          });

          if (routeResult.response.status >= 200 && routeResult.response.status < 300) {
            message.status = 'delivered';
            message.latency = (message.latency || 0) + (routeResult.response.latency || 0);
            // Update metadata with routing info
            message.metadata = {
              ...message.metadata,
              envoyListener: routeResult.listener?.name,
              envoyRoute: routeResult.route?.name,
              envoyCluster: routeResult.cluster?.name,
              envoyEndpoint: routeResult.endpointTarget,
              envoyResponseStatus: routeResult.response.status,
            };
            // Update payload if response has body
            if (routeResult.response.body) {
              message.payload = routeResult.response.body;
            }
          } else {
            message.status = 'failed';
            message.error = routeResult.response.error || `HTTP ${routeResult.response.status}`;
            message.latency = (message.latency || 0) + (routeResult.response.latency || 0);
          }

          return message;
        },
        
        transformData: (node, message, targetType, config) => {
          // Envoy can transform requests/responses (protocol upgrades, etc.)
          const targetFormats = this.getTargetFormats(targetType);
          if (targetFormats.length > 0 && !targetFormats.includes(message.format)) {
            message.format = targetFormats[0];
            message.status = 'transformed';
          }
          return message;
        },
        
        getSupportedFormats: () => ['json', 'xml', 'binary', 'text', 'grpc'],
      };
    }

    if (type === 'haproxy') {
      return {
        processData: (node, message, config) => {
          // Get HAProxy routing engine from emulation engine
          const routingEngine = emulationEngine.getHAProxyRoutingEngine(node.id);
          
          if (!routingEngine) {
            // No routing engine, just pass through
            message.status = 'delivered';
            return message;
          }

          // Extract request information from message
          const payload = message.payload as any;
          const path = payload?.path || message.metadata?.path || '/';
          const method = payload?.method || message.metadata?.method || 'GET';
          const headers = payload?.headers || message.metadata?.headers || {};
          const query = payload?.query || message.metadata?.query || {};
          const clientIP = headers['X-Real-IP'] || headers['X-Forwarded-For'] || message.metadata?.clientIP;
          const protocol = headers['X-Forwarded-Proto'] === 'https' || message.metadata?.protocol === 'https' ? 'https' : 'http';
          const host = headers['Host'] || message.metadata?.host;

          // Route request through HAProxy
          const routeResult = routingEngine.routeRequest({
            path,
            method,
            headers,
            query,
            body: payload?.body,
            clientIP,
            protocol,
            host,
          });

          if (routeResult.response.status >= 200 && routeResult.response.status < 300) {
            message.status = 'delivered';
            message.latency = routeResult.response.latency;
            // Update metadata with routing info
            message.metadata = {
              ...message.metadata,
              haproxyFrontend: routeResult.frontend?.name,
              haproxyBackend: routeResult.backendTarget,
              haproxyServer: routeResult.serverTarget,
              haproxyResponseStatus: routeResult.response.status,
            };
            // Update payload if response has body
            if (routeResult.response.body) {
              message.payload = routeResult.response.body;
            }
          } else {
            message.status = 'failed';
            message.error = routeResult.response.error || `HTTP ${routeResult.response.status}`;
            message.latency = routeResult.response.latency;
          }

          return message;
        },
        
        transformData: (node, message, targetType, config) => {
          // HAProxy can transform requests/responses
          const haproxyConfig = (node.data.config as any) || {};
          
          const targetFormats = this.getTargetFormats(targetType);
          if (targetFormats.length > 0 && !targetFormats.includes(message.format)) {
            message.format = targetFormats[0];
            message.status = 'transformed';
          }
          return message;
        },
        
        getSupportedFormats: () => ['json', 'xml', 'binary', 'text'],
      };
    }

    if (type === 'traefik') {
      return {
        processData: (node, message, config) => {
          // Get Traefik emulation engine from emulation engine
          const traefikEngine = emulationEngine.getTraefikEmulationEngine(node.id);
          
          if (!traefikEngine) {
            // No engine, just pass through
            message.status = 'delivered';
            return message;
          }

          // Extract request information from message
          const payload = message.payload as any;
          const path = payload?.path || message.metadata?.path || '/';
          const method = payload?.method || message.metadata?.method || 'GET';
          const headers = payload?.headers || message.metadata?.headers || {};
          const query = payload?.query || message.metadata?.query || {};
          const clientIP = headers['X-Real-IP'] || headers['X-Forwarded-For'] || message.metadata?.clientIP;
          const protocol = headers['X-Forwarded-Proto'] === 'https' || message.metadata?.protocol === 'https' ? 'https' : 'http';
          const host = headers['Host'] || message.metadata?.host;
          const entryPoint = message.metadata?.entryPoint || (protocol === 'https' ? 'websecure' : 'web');

          // Process request through Traefik
          const routeResult = traefikEngine.processRequest({
            path,
            method,
            headers,
            query,
            body: payload?.body,
            clientIP,
            protocol,
            host,
            entryPoint,
          });

          if (routeResult.success) {
            message.status = 'delivered';
            message.latency = routeResult.latency;
            // Update metadata with routing info
            message.metadata = {
              ...message.metadata,
              traefikRouter: routeResult.routerMatched,
              traefikService: routeResult.serviceTarget,
              traefikServer: routeResult.serverTarget,
              traefikResponseStatus: routeResult.status,
            };
            // Update payload if response has body
            if (payload?.body) {
              message.payload = payload.body;
            }
          } else {
            message.status = 'failed';
            message.error = routeResult.error || `HTTP ${routeResult.status}`;
            message.latency = routeResult.latency;
          }

          return message;
        },
        
        transformData: (node, message, targetType, config) => {
          // Traefik can transform requests/responses through middlewares
          const traefikConfig = (node.data.config as any) || {};
          
          const targetFormats = this.getTargetFormats(targetType);
          if (targetFormats.length > 0 && !targetFormats.includes(message.format)) {
            message.format = targetFormats[0];
            message.status = 'transformed';
          }
          return message;
        },
        
        getSupportedFormats: () => ['json', 'xml', 'binary', 'text'],
      };
    }

    if (type === 'cdn') {
      return {
        processData: (node, message, config) => {
          // Get CDN emulation engine from emulation engine
          const cdnEngine = emulationEngine.getCDNEmulationEngine(node.id);
          
          if (!cdnEngine) {
            // No engine, just pass through
            message.status = 'delivered';
            return message;
          }

          // Extract request information from message
          const payload = message.payload as any;
          const path = payload?.path || message.metadata?.path || '/';
          const method = payload?.method || message.metadata?.method || 'GET';
          const headers = payload?.headers || message.metadata?.headers || {};
          const query = payload?.query || message.metadata?.query || {};
          const clientIP = headers['X-Real-IP'] || headers['X-Forwarded-For'] || message.metadata?.clientIP;
          const userAgent = headers['User-Agent'] || message.metadata?.userAgent;
          
          // Get domain from headers or config
          const cdnConfig = (node.data.config as any) || {};
          const distributions = cdnConfig.distributions || [];
          const domain = headers['Host'] || message.metadata?.host || (distributions.length > 0 ? distributions[0].domain : 'cdn.example.com');

          // Process request through CDN
          const cdnResult = cdnEngine.processRequest({
            method: method.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS',
            path,
            domain,
            headers,
            query,
            body: payload?.body,
            clientIP,
            userAgent,
          });

          if (cdnResult.success) {
            message.status = 'delivered';
            message.latency = (message.latency || 0) + cdnResult.latency;
            // Update metadata with CDN info
            message.metadata = {
              ...message.metadata,
              cdnCacheHit: cdnResult.cacheHit,
              cdnLatency: cdnResult.latency,
              cdnSize: cdnResult.size,
            };
            // If cache hit, don't forward to origin
            if (cdnResult.cacheHit) {
              message.payload = { status: 'ok', cached: true };
            }
          } else {
            message.status = 'failed';
            message.error = cdnResult.error || 'CDN request failed';
            message.latency = (message.latency || 0) + cdnResult.latency;
          }

          return message;
        },
        
        transformData: (node, message, targetType, config) => {
          // CDN can compress responses
          const cdnConfig = (node.data.config as any) || {};
          if (cdnConfig.enableCompression && message.metadata?.cdnCacheHit) {
            message.metadata = {
              ...message.metadata,
              contentEncoding: cdnConfig.compressionType || 'gzip',
            };
          }
          
          const targetFormats = this.getTargetFormats(targetType);
          if (targetFormats.length > 0 && !targetFormats.includes(message.format)) {
            message.format = targetFormats[0];
            message.status = 'transformed';
          }
          return message;
        },
        
        getSupportedFormats: () => ['json', 'xml', 'binary', 'text', 'html'],
      };
    }

    if (type === 'service-mesh') {
      return {
        processData: (node, message, config) => {
          // Get Service Mesh routing engine from emulation engine
          const routingEngine = emulationEngine.getServiceMeshRoutingEngine(node.id);
          
          if (!routingEngine) {
            // No routing engine, just pass through
            message.status = 'delivered';
            return message;
          }

          // Extract request information from message
          const payload = message.payload as any;
          const path = payload?.path || message.metadata?.path || '/';
          const method = payload?.method || message.metadata?.method || 'GET';
          const headers = payload?.headers || message.metadata?.headers || {};
          const query = payload?.query || message.metadata?.query || {};
          const clientIP = headers['X-Real-IP'] || headers['X-Forwarded-For'] || message.metadata?.clientIP;
          const protocol = headers['X-Forwarded-Proto'] === 'https' || message.metadata?.protocol === 'https' ? 'https' : 'http';
          const host = headers['Host'] || message.metadata?.host;
          const authority = headers['Host'] || message.metadata?.authority;
          const sourcePrincipal = headers['X-Source-Principal'] || message.metadata?.sourcePrincipal;
          const destinationPrincipal = headers['X-Destination-Principal'] || message.metadata?.destinationPrincipal;

          // Route request through Service Mesh
          const routeResult = routingEngine.routeRequest({
            path,
            method,
            headers,
            query,
            body: payload?.body,
            clientIP,
            protocol: protocol === 'https' ? 'https' : (protocol === 'grpc' ? 'grpc' : 'http'),
            host,
            authority,
            sourcePrincipal,
            destinationPrincipal,
          });

          if (routeResult.response.status >= 200 && routeResult.response.status < 300) {
            message.status = 'delivered';
            message.latency = routeResult.response.latency;
            // Update metadata with routing info
            message.metadata = {
              ...message.metadata,
              serviceMeshVirtualService: routeResult.virtualService?.name,
              serviceMeshDestinationRule: routeResult.destinationRule?.name,
              serviceMeshService: routeResult.serviceTarget,
              serviceMeshSubset: routeResult.subsetTarget,
              serviceMeshEndpoint: routeResult.endpointTarget,
              serviceMeshResponseStatus: routeResult.response.status,
              serviceMeshRetryAttempts: routeResult.response.retryAttempts,
              serviceMeshCircuitBreakerOpen: routeResult.response.circuitBreakerOpen,
            };
            // Update payload if response has body
            if (routeResult.response.body) {
              message.payload = routeResult.response.body;
            }
          } else {
            message.status = 'failed';
            message.error = routeResult.response.error || `HTTP ${routeResult.response.status}`;
            message.latency = routeResult.response.latency;
            // Update metadata even on failure
            message.metadata = {
              ...message.metadata,
              serviceMeshVirtualService: routeResult.virtualService?.name,
              serviceMeshDestinationRule: routeResult.destinationRule?.name,
              serviceMeshService: routeResult.serviceTarget,
              serviceMeshSubset: routeResult.subsetTarget,
              serviceMeshEndpoint: routeResult.endpointTarget,
              serviceMeshResponseStatus: routeResult.response.status,
              serviceMeshError: routeResult.response.error,
              serviceMeshRetryAttempts: routeResult.response.retryAttempts,
              serviceMeshCircuitBreakerOpen: routeResult.response.circuitBreakerOpen,
            };
          }

          return message;
        },
        
        transformData: (node, message, targetType, config) => {
          // Service Mesh can transform requests/responses through VirtualService rewrites
          const meshConfig = (node.data.config as any) || {};
          
          const targetFormats = this.getTargetFormats(targetType);
          if (targetFormats.length > 0 && !targetFormats.includes(message.format)) {
            message.format = targetFormats[0];
            message.status = 'transformed';
          }
          return message;
        },
        
        getSupportedFormats: () => ['json', 'xml', 'binary', 'text'],
      };
    }

    if (type === 'istio') {
      return {
        processData: (node, message, config) => {
          // Get Istio routing engine from emulation engine
          const routingEngine = emulationEngine.getIstioRoutingEngine(node.id);
          
          if (!routingEngine) {
            // No routing engine, just pass through
            message.status = 'delivered';
            return message;
          }

          // Extract request information from message
          const payload = message.payload as any;
          const path = payload?.path || message.metadata?.path || '/';
          const method = payload?.method || message.metadata?.method || 'GET';
          const headers = payload?.headers || message.metadata?.headers || {};
          const query = payload?.query || message.metadata?.query || {};
          const clientIP = headers['X-Real-IP'] || headers['X-Forwarded-For'] || message.metadata?.clientIP;
          const protocol = headers['X-Forwarded-Proto'] === 'https' || message.metadata?.protocol === 'https' ? 'https' : 'http';
          const host = headers['Host'] || message.metadata?.host;
          const authority = headers['Host'] || message.metadata?.authority;
          const sourcePrincipal = headers['X-Source-Principal'] || message.metadata?.sourcePrincipal;
          const destinationPrincipal = headers['X-Destination-Principal'] || message.metadata?.destinationPrincipal;

          // Route request through Istio
          const routeResult = routingEngine.routeRequest({
            path,
            method,
            headers,
            query,
            body: payload?.body,
            clientIP,
            protocol: protocol === 'https' ? 'https' : (protocol === 'grpc' ? 'grpc' : 'http'),
            host,
            authority,
            sourcePrincipal,
            destinationPrincipal,
          });

          if (routeResult.response.status >= 200 && routeResult.response.status < 300) {
            message.status = 'delivered';
            message.latency = routeResult.response.latency;
            // Update metadata with routing info
            message.metadata = {
              ...message.metadata,
              istioVirtualService: routeResult.virtualService?.name,
              istioDestinationRule: routeResult.destinationRule?.name,
              istioService: routeResult.serviceTarget,
              istioSubset: routeResult.subsetTarget,
              istioEndpoint: routeResult.endpointTarget,
              istioResponseStatus: routeResult.response.status,
              istioRetryAttempts: routeResult.response.retryAttempts,
              istioCircuitBreakerOpen: routeResult.response.circuitBreakerOpen,
            };
            // Update payload if response has body
            if (routeResult.response.body) {
              message.payload = routeResult.response.body;
            }
          } else {
            message.status = 'failed';
            message.error = routeResult.response.error || `HTTP ${routeResult.response.status}`;
            message.latency = routeResult.response.latency;
            // Update metadata even on failure
            message.metadata = {
              ...message.metadata,
              istioVirtualService: routeResult.virtualService?.name,
              istioDestinationRule: routeResult.destinationRule?.name,
              istioService: routeResult.serviceTarget,
              istioSubset: routeResult.subsetTarget,
              istioEndpoint: routeResult.endpointTarget,
              istioResponseStatus: routeResult.response.status,
              istioError: routeResult.response.error,
              istioRetryAttempts: routeResult.response.retryAttempts,
              istioCircuitBreakerOpen: routeResult.response.circuitBreakerOpen,
            };
          }

          return message;
        },
        
        transformData: (node, message, targetType, config) => {
          // Istio can transform requests/responses through VirtualService rewrites
          const istioConfig = (node.data.config as any) || {};
          
          const targetFormats = this.getTargetFormats(targetType);
          if (targetFormats.length > 0 && !targetFormats.includes(message.format)) {
            message.format = targetFormats[0];
            message.status = 'transformed';
          }
          return message;
        },
        
        getSupportedFormats: () => ['json', 'xml', 'binary', 'text', 'grpc'],
      };
    }

    if (type === 'apigee') {
      return {
        processData: (node, message, config) => {
          // Get Apigee routing engine from emulation engine
          const routingEngine = emulationEngine.getApigeeRoutingEngine(node.id);
          
          if (!routingEngine) {
            // No routing engine, just pass through
            message.status = 'delivered';
            return message;
          }

          // Extract request information from message
          const payload = message.payload as any;
          const path = payload?.path || message.metadata?.path || '/';
          const method = payload?.method || message.metadata?.method || 'GET';
          const headers = payload?.headers || message.metadata?.headers || {};
          const query = payload?.query || message.metadata?.query || {};
          const apiKey = headers['apikey'] || headers['X-API-Key'] || query['apikey'];
          const authHeader = headers['Authorization'] || '';
          const oauthToken = authHeader.startsWith('OAuth ') ? authHeader.replace('OAuth ', '') : undefined;
          const jwtToken = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : headers['X-JWT-Token'];

          // Route request through Apigee Gateway
          const routeResult = routingEngine.routeRequest({
            path,
            method,
            headers,
            query,
            body: payload?.body,
            apiKey,
            oauthToken,
            jwtToken,
          });

          if (routeResult.response.status >= 200 && routeResult.response.status < 300) {
            message.status = 'delivered';
            message.latency = routeResult.response.latency;
            // Update metadata with routing info
            message.metadata = {
              ...message.metadata,
              apigeeProxy: routeResult.match?.proxy.name,
              apigeeTarget: routeResult.target,
              apigeeResponseStatus: routeResult.response.status,
              apigeeEnvironment: routeResult.match?.proxy.environment,
            };
          } else {
            message.status = 'failed';
            message.error = routeResult.response.error || `HTTP ${routeResult.response.status}`;
            message.latency = routeResult.response.latency;
          }

          return message;
        },
        
        transformData: (node, message, targetType, config) => {
          // Apigee can transform requests/responses (XML to JSON, etc.)
          const targetFormats = this.getTargetFormats(targetType);
          if (targetFormats.length > 0 && !targetFormats.includes(message.format)) {
            message.format = targetFormats[0];
            message.status = 'transformed';
          }
          return message;
        },
        
        getSupportedFormats: () => ['json', 'xml', 'binary'],
      };
    }

    if (type === 'graphql-gateway') {
      return {
        processData: (node, message, config) => {
          const routingEngine = emulationEngine.getGraphQLGatewayRoutingEngine(node.id);

          if (!routingEngine) {
            message.status = 'delivered';
            return message;
          }

          const payload = message.payload as any;
          const query = payload?.query || payload?.body || message.metadata?.query;
          const variables = payload?.variables || message.metadata?.variables;
          const operationName = payload?.operationName || message.metadata?.operationName;
          const headers = payload?.headers || message.metadata?.headers || {};

          const result = routingEngine.routeRequest({
            query: query || '',
            variables,
            headers,
            operationName,
          });

          message.latency = result.latency;

          if (result.status >= 200 && result.status < 300) {
            message.status = 'delivered';
            // Get executed endpoints from routing engine if available
            const serviceRegistry = routingEngine.getServiceRegistry();
            const connectedServices = serviceRegistry.getConnectedServices();
            const endpoints = connectedServices.map(s => s.endpoint);
            
            message.metadata = {
              ...message.metadata,
              graphqlGatewayStatus: result.status,
              graphqlGatewayEndpoints: endpoints,
            };
          } else {
            message.status = 'failed';
            message.error = result.error || `HTTP ${result.status}`;
          }

          return message;
        },

        transformData: (node, message, targetType, config) => {
          // Gateway outputs JSON; transform if needed for target
          const targetFormats = this.getTargetFormats(targetType);
          if (targetFormats.length > 0 && !targetFormats.includes(message.format)) {
            message.format = targetFormats[0];
            message.status = 'transformed';
          }
          return message;
        },

        getSupportedFormats: () => ['json'],
      };
    }

    if (type === 'mulesoft') {
      return {
        processData: (node, message, config) => {
          // Get MuleSoft routing engine from emulation engine
          const routingEngine = emulationEngine.getMuleSoftRoutingEngine(node.id);
          
          if (!routingEngine) {
            // No routing engine, just pass through
            message.status = 'delivered';
            return message;
          }

          // Extract request information from message
          const payload = message.payload as any;
          const sourceNode = this.nodes.find(n => n.id === message.source);
          const targetNode = this.nodes.find(n => n.id === message.target);

          // Process data through MuleSoft
          const processResult = routingEngine.processData({
            path: payload?.path || message.metadata?.path,
            method: payload?.method || message.metadata?.method || 'POST',
            headers: payload?.headers || message.metadata?.headers || {},
            query: payload?.query || message.metadata?.query || {},
            body: payload?.body || payload || message.payload,
            format: message.format,
            sourceComponentType: sourceNode?.type,
            sourceComponentId: sourceNode?.id,
            targetComponentType: targetNode?.type,
            targetComponentId: targetNode?.id,
          });

          if (processResult.response.status === 'success') {
            message.status = 'delivered';
            message.latency = processResult.response.latency;
            message.payload = processResult.response.data;
            if (processResult.response.format) {
              message.format = processResult.response.format;
            }
            // Update metadata with routing info
            message.metadata = {
              ...message.metadata,
              mulesoftApplication: processResult.response.application,
              mulesoftFlow: processResult.response.flow,
              mulesoftConnector: processResult.response.connector,
            };
          } else {
            message.status = 'failed';
            message.error = processResult.response.error || 'MuleSoft processing failed';
            message.latency = processResult.response.latency || 0;
          }

          return message;
        },
        
        transformData: (node, message, targetType, config) => {
          // MuleSoft can transform data formats (DataWeave)
          const targetFormats = this.getTargetFormats(targetType);
          if (targetFormats.length > 0 && !targetFormats.includes(message.format)) {
            message.format = targetFormats[0];
            message.status = 'transformed';
          }
          return message;
        },
        
        getSupportedFormats: () => ['json', 'xml', 'binary', 'text'],
      };
    }

    if (type === 'bff-service') {
      return {
        processData: (node, message, config) => {
          // Get BFF routing engine from emulation engine
          const routingEngine = emulationEngine.getBFFRoutingEngine(node.id);
          
          if (!routingEngine) {
            // No routing engine, just pass through
            message.status = 'delivered';
            return message;
          }

          // Extract request information from message
          const payload = message.payload as any;
          const path = payload?.path || message.metadata?.path || '/';
          const method = (payload?.method || message.metadata?.method || 'GET') as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
          const headers = payload?.headers || message.metadata?.headers || {};
          const query = payload?.query || message.metadata?.query || {};
          const body = payload?.body || payload || message.payload;

          // Route request through BFF
          const routeResult = routingEngine.routeRequest({
            path,
            method,
            headers,
            query,
            body,
          });

          if (routeResult.status >= 200 && routeResult.status < 300) {
            message.status = 'delivered';
            message.latency = routeResult.latency;
            message.payload = routeResult.data;
            // Update metadata with routing info
            message.metadata = {
              ...message.metadata,
              bffCacheHit: routeResult.cacheHit,
              bffBackendResponses: routeResult.backendResponses.length,
              bffStatus: routeResult.status,
            };
          } else {
            message.status = 'failed';
            message.error = routeResult.error || `HTTP ${routeResult.status}`;
            message.latency = routeResult.latency;
          }

          return message;
        },
        
        transformData: (node, message, targetType, config) => {
          // BFF can transform data formats
          const targetFormats = this.getTargetFormats(targetType);
          if (targetFormats.length > 0 && !targetFormats.includes(message.format)) {
            message.format = targetFormats[0];
            message.status = 'transformed';
          }
          return message;
        },
        
        getSupportedFormats: () => ['json'],
      };
    }

    if (type === 'webhook-relay') {
      return {
        processData: (node, message, config) => {
          // Get Webhook Relay routing engine from emulation engine
          const routingEngine = emulationEngine.getWebhookRelayRoutingEngine(node.id);
          
          if (!routingEngine) {
            // No routing engine, just pass through
            message.status = 'delivered';
            return message;
          }

          // Extract webhook request information from message
          const payload = message.payload as any;
          const url = payload?.url || message.metadata?.url || payload?.path || '/';
          const method = (payload?.method || message.metadata?.method || 'POST') as string;
          const headers = payload?.headers || message.metadata?.headers || {};
          const body = payload?.body || payload || message.payload;
          const ip = payload?.ip || message.metadata?.ip || headers['x-forwarded-for']?.split(',')[0]?.trim();
          const event = payload?.event || message.metadata?.event || headers['x-event'] || headers['x-github-event'] || '';

          // Route webhook through relay
          const relayResult = routingEngine.relayWebhook({
            url,
            method,
            headers,
            body,
            ip,
            event,
          });

          if (relayResult.success) {
            message.status = 'delivered';
            message.latency = relayResult.latency;
            // Update metadata with relay info
            message.metadata = {
              ...message.metadata,
              webhookRelayId: relayResult.relayId,
              webhookDeliveryId: relayResult.deliveryId,
              webhookAttempts: relayResult.attempts,
              webhookStatus: relayResult.status,
            };
          } else {
            message.status = 'failed';
            message.error = relayResult.error || `Webhook relay failed (HTTP ${relayResult.status})`;
            message.latency = relayResult.latency;
            message.metadata = {
              ...message.metadata,
              webhookRelayId: relayResult.relayId,
              webhookDeliveryId: relayResult.deliveryId,
              webhookAttempts: relayResult.attempts,
              webhookStatus: relayResult.status,
            };
          }

          return message;
        },
        
        transformData: (node, message, targetType, config) => {
          // Webhook Relay can transform payloads
          const targetFormats = this.getTargetFormats(targetType);
          if (targetFormats.length > 0 && !targetFormats.includes(message.format)) {
            message.format = targetFormats[0];
            message.status = 'transformed';
          }
          return message;
        },
        
        getSupportedFormats: () => ['json', 'text', 'binary'],
      };
    }

    if (type === 'vpn') {
      return {
        processData: (node, message, config) => {
          // Get VPN emulation engine from emulation engine
          const vpnEngine = emulationEngine.getVPNEmulationEngine(node.id);
          
          if (!vpnEngine) {
            // No engine, just pass through
            message.status = 'delivered';
            return message;
          }

          // Extract packet information from message
          const payload = message.payload as any;
          const source = payload?.source || message.metadata?.source || message.source || '0.0.0.0';
          const destination = payload?.destination || message.metadata?.destination || message.target || '0.0.0.0';
          const protocol = (payload?.protocol || message.metadata?.protocol || 'tcp') as 'tcp' | 'udp';
          const port = payload?.port || message.metadata?.port;
          const sourcePort = payload?.sourcePort || message.metadata?.sourcePort;
          const encrypted = payload?.encrypted || message.metadata?.encrypted || false;
          const connectionId = payload?.connectionId || message.metadata?.connectionId;
          const tunnelId = payload?.tunnelId || message.metadata?.tunnelId;

          // Process packet through VPN
          const processResult = vpnEngine.processPacket({
            source,
            destination,
            protocol,
            port,
            sourcePort,
            payload: message.payload,
            encrypted,
            connectionId,
            tunnelId,
          });

          if (processResult.success) {
            message.status = 'delivered';
            message.latency = (message.latency || 0) + processResult.latency;
            // Update metadata with VPN info
            message.metadata = {
              ...message.metadata,
              vpnEncrypted: processResult.encrypted,
              vpnConnectionId: processResult.connectionId,
              vpnTunnelId: processResult.tunnelId,
              vpnBytesProcessed: processResult.bytesProcessed,
            };
            // Mark payload as encrypted if it was encrypted
            if (processResult.encrypted) {
              message.metadata = {
                ...message.metadata,
                encrypted: true,
              };
            }
          } else {
            message.status = 'failed';
            message.error = processResult.error || 'VPN processing failed';
            message.latency = (message.latency || 0) + processResult.latency;
          }

          return message;
        },
        
        transformData: (node, message, targetType, config) => {
          // VPN can encrypt/decrypt data
          const targetFormats = this.getTargetFormats(targetType);
          if (targetFormats.length > 0 && !targetFormats.includes(message.format)) {
            message.format = targetFormats[0];
            message.status = 'transformed';
          }
          return message;
        },
        
        getSupportedFormats: () => ['json', 'xml', 'binary', 'text'],
      };
    }

    return {
      transformData: (node, message, targetType, config) => {
        // Integration components transform data formats
        const targetFormats = this.getTargetFormats(targetType);
        if (targetFormats.length > 0 && !targetFormats.includes(message.format)) {
          message.format = targetFormats[0];
          message.status = 'transformed';
        }
        return message;
      },
      
      getSupportedFormats: () => ['json', 'xml', 'binary'],
    };
  }

  /**
   * Get supported formats for a target component type
   */
  private getTargetFormats(type: string): string[] {
    const handler = this.handlers.get(type);
    return handler?.getSupportedFormats?.({ type } as CanvasNode) || ['json'];
  }

  /**
   * Create handler for Loki
   */
  private createLokiHandler(): ComponentDataHandler {
    return {
      processData: (node, message, config) => {
        // Get Loki emulation engine from emulation engine
        const lokiEngine = emulationEngine.getLokiEmulationEngine(node.id);
        
        if (!lokiEngine) {
          // No engine, just pass through
          message.status = 'delivered';
          return message;
        }

        const payload = message.payload as any;
        
        // Check if this is a LogQL query or log ingestion
        if (payload?.query || payload?.logql) {
          // This is a LogQL query
          const query = payload.query || payload.logql;
          const startTime = payload.startTime || payload.start;
          const endTime = payload.endTime || payload.end;
          const limit = payload.limit || 100;
          
          const result = lokiEngine.executeQuery(query, startTime, endTime, limit);
          
          if (result.success) {
            message.status = 'delivered';
            message.latency = result.latency;
            message.payload = {
              ...(message.payload as any),
              query,
              results: result.result || [],
              resultsCount: result.resultsCount,
            };
          } else {
            message.status = 'failed';
            message.error = result.error || 'LogQL query execution failed';
            message.latency = result.latency || 0;
          }
        } else {
          // This is log ingestion (push API format)
          // Convert message payload to Loki push format
          const logs: Array<{ stream: Record<string, string>; values: Array<[string, string]> }> = [];
          
          // Extract stream labels from metadata or payload
          const streamLabels = payload?.stream || payload?.labels || message.metadata?.labels || {
            app: node.data.label?.toLowerCase().replace(/\s+/g, '-') || 'unknown',
            source: message.source.slice(0, 8),
          };
          
          // Extract log entries
          let values: Array<[string, string]> = [];
          
          if (payload?.values && Array.isArray(payload.values)) {
            // Already in Loki format
            values = payload.values;
          } else if (payload?.logs && Array.isArray(payload.logs)) {
            // Array of log strings
            const timestamp = Date.now() * 1000000; // nanoseconds
            values = payload.logs.map((log: string, index: number) => [
              (timestamp + index).toString(),
              String(log),
            ]);
          } else if (payload?.log) {
            // Single log string
            const timestamp = Date.now() * 1000000;
            values = [[timestamp.toString(), String(payload.log)]];
          } else if (typeof payload === 'string') {
            // Plain string
            const timestamp = Date.now() * 1000000;
            values = [[timestamp.toString(), payload]];
          } else {
            // Try to extract from JSON payload
            const logLine = JSON.stringify(payload);
            const timestamp = Date.now() * 1000000;
            values = [[timestamp.toString(), logLine]];
          }
          
          if (values.length > 0) {
            logs.push({ stream: streamLabels, values });
            
            const result = lokiEngine.processIngestion(logs, message.source);
            
            if (result.success) {
              message.status = 'delivered';
              message.latency = 10; // Ingestion latency
              message.payload = {
                ...(message.payload as any),
                ingestedLines: result.ingestedLines,
                ingestedBytes: result.ingestedBytes,
              };
            } else {
              message.status = 'failed';
              message.error = result.error || 'Log ingestion failed';
            }
          } else {
            message.status = 'failed';
            message.error = 'No log entries found in payload';
          }
        }
        
        return message;
      },
      
      getSupportedFormats: () => ['json', 'text'],
    };
  }

  /**
   * Create handler for Keycloak (IAM)
   * Обрабатывает auth-запросы и делегирует расчёт нагрузки KeycloakEmulationEngine.
   */
  private createKeycloakHandler(): ComponentDataHandler {
    return {
      processData: (node, message, config) => {
        const engine = emulationEngine.getKeycloakEmulationEngine(node.id);

        if (!engine) {
          // Если движок не инициализирован, считаем, что Keycloak недоступен
          message.status = 'failed';
          message.error = 'Keycloak engine not initialized';
          return message;
        }

        const payload = (message.payload || {}) as any;

        // Определяем тип auth-запроса
        const operation: string | undefined =
          message.metadata?.operation || payload.operation || payload.action || payload.grant_type;

        let type: 'login' | 'refresh' | 'introspect' | 'userinfo' = 'login';

        if (typeof operation === 'string') {
          const opLower = operation.toLowerCase();
          if (opLower.includes('refresh') || opLower === 'refresh_token') {
            type = 'refresh';
          } else if (opLower.includes('introspect')) {
            type = 'introspect';
          } else if (opLower.includes('userinfo') || opLower.includes('user_info')) {
            type = 'userinfo';
          } else {
            type = 'login';
          }
        }

        const clientId: string | undefined =
          payload.clientId || payload.client_id || (message.metadata as any)?.clientId;

        const username: string | undefined =
          payload.username || payload.user || (message.metadata as any)?.username;

        const subject: string | undefined =
          payload.sub || payload.subject || (message.metadata as any)?.subject || username;

        const result = engine.processAuthRequest(type, {
          clientId,
          username,
          subject,
          grantType: typeof operation === 'string' ? operation : undefined,
        });

        message.latency = result.latency;

        if (!result.success) {
          message.status = 'failed';
          message.error = result.error || 'Keycloak auth failed';
        } else {
          message.status = 'delivered';

          // Обогащаем payload "токеноподобным" ответом (для downstream-компонентов)
          message.payload = {
            ...(payload || {}),
            keycloak: {
              realm: result.realm,
              clientId: result.clientId,
              subject: result.subject,
              tokenType: result.tokenType,
              expiresIn: result.expiresIn,
            },
          };

          // Обновляем metadata для дальнейших хопов (трассировка auth-контекста)
          message.metadata = {
            ...message.metadata,
            authRealm: result.realm,
            authClientId: result.clientId,
            authSubject: result.subject,
            authResult: 'success',
          };
        }

        return message;
      },

      getSupportedFormats: () => ['json', 'text'],
    };
  }

  /**
   * Create handler for Jenkins (CI/CD)
   * Обрабатывает webhook триггеры и API запросы, делегирует расчёт нагрузки JenkinsEmulationEngine.
   */
  private createJenkinsHandler(): ComponentDataHandler {
    return {
      processData: (node, message, config) => {
        const engine = emulationEngine.getJenkinsEmulationEngine(node.id);

        if (!engine) {
          // Если движок не инициализирован, считаем, что Jenkins недоступен
          message.status = 'failed';
          message.error = 'Jenkins engine not initialized';
          return message;
        }

        const payload = (message.payload || {}) as any;
        const operation: string | undefined =
          message.metadata?.operation || payload.operation || payload.action || 'webhook';

        // Определяем тип операции
        if (operation === 'webhook' || payload.ref || payload.branch || payload.commit) {
          // Webhook trigger - реально запускаем build через engine
          const pipelineId = payload.pipelineId || payload.pipeline || payload.job;
          const branch = payload.branch || payload.ref?.replace('refs/heads/', '') || 'main';
          const commit = payload.commit || payload.sha || undefined;

          if (pipelineId) {
            // Реально триггерим build через engine
            const result = engine.triggerWebhook(pipelineId, branch, commit);
            if (result.success) {
              message.status = 'delivered';
              message.latency = 50; // Webhook processing latency
              message.payload = {
                ...(payload || {}),
                jenkins: {
                  webhookReceived: true,
                  pipelineId,
                  branch,
                  commit,
                  triggered: true,
                },
              };
            } else {
              message.status = 'failed';
              message.error = result.reason || 'Failed to trigger build';
              message.latency = 50;
            }
          } else {
            // Если pipelineId не указан, просто отмечаем получение webhook
            message.status = 'delivered';
            message.latency = 50;
            message.payload = {
              ...(payload || {}),
              jenkins: {
                webhookReceived: true,
                branch,
                commit,
                triggered: false,
                reason: 'No pipeline ID specified',
              },
            };
          }
        } else if (operation === 'getBuildStatus' || payload.buildId || payload.buildNumber) {
          // API запрос для получения статуса build
          const buildId = payload.buildId || payload.buildNumber;
          const pipelineId = payload.pipelineId || payload.pipeline;

          // Получаем реальный статус build из engine
          const build = engine.getBuildById(buildId || `${pipelineId}-${payload.buildNumber}`);
          const buildStatus = build?.status || 'unknown';
          
          message.status = 'delivered';
          message.latency = 20; // API latency
          message.payload = {
            ...(payload || {}),
            jenkins: {
              buildId,
              pipelineId,
              status: buildStatus,
              progress: build?.progress,
              duration: build?.duration,
            },
          };
        } else {
          // Общий API запрос
          message.status = 'delivered';
          message.latency = 30;
          message.payload = {
            ...(payload || {}),
            jenkins: {
              processed: true,
              operation,
            },
          };
        }

        // Обновляем метрики Jenkins (requests)
        engine.processRequest(message.status === 'delivered');

        return message;
      },

      getSupportedFormats: () => ['json', 'text'],
    };
  }

  /**
   * Create handler for GitLab CI (CI/CD)
   * Обрабатывает webhook триггеры и API запросы, делегирует расчёт нагрузки GitLabCIEmulationEngine.
   */
  private createGitLabCIHandler(): ComponentDataHandler {
    return {
      processData: (node, message, config) => {
        const engine = emulationEngine.getGitLabCIEmulationEngine(node.id);

        if (!engine) {
          // Если движок не инициализирован, считаем, что GitLab CI недоступен
          message.status = 'failed';
          message.error = 'GitLab CI engine not initialized';
          return message;
        }

        const payload = (message.payload || {}) as any;
        const operation: string | undefined =
          message.metadata?.operation || payload.operation || payload.action || 'webhook';

        // Определяем тип операции
        if (operation === 'webhook' || payload.ref || payload.branch || payload.commit) {
          // Webhook trigger - реально запускаем pipeline через engine
          const ref = payload.ref || payload.branch?.replace('refs/heads/', '') || 'main';
          const variables = payload.variables || {};

          // Триггерим pipeline через engine
          const result = engine.triggerWebhook(ref, variables);
          if (result.success) {
            message.status = 'delivered';
            message.latency = 50; // Webhook processing latency
            message.payload = {
              ...(payload || {}),
              gitlab: {
                webhookReceived: true,
                pipelineId: result.pipelineId,
                ref,
                variables,
                triggered: true,
              },
            };
          } else {
            message.status = 'failed';
            message.error = result.reason || 'Failed to trigger pipeline';
            message.latency = 50;
          }
        } else if (operation === 'getPipelineStatus' || payload.pipelineId || payload.pipelineIid) {
          // API запрос для получения статуса pipeline
          const pipelineId = payload.pipelineId || payload.pipelineIid?.toString();
          const pipeline = engine.getPipeline(pipelineId || '');

          message.status = 'delivered';
          message.latency = 20; // API latency
          message.payload = {
            ...(payload || {}),
            gitlab: {
              pipelineId,
              status: pipeline?.status || 'unknown',
              duration: pipeline?.duration,
              stages: pipeline?.stages.map(s => ({
                name: s.name,
                status: s.status,
                duration: s.duration,
              })),
            },
          };
        } else if (operation === 'getJobStatus' || payload.jobId) {
          // API запрос для получения статуса job
          const jobId = payload.jobId;
          const job = engine.getJob(jobId || '');

          message.status = 'delivered';
          message.latency = 20;
          message.payload = {
            ...(payload || {}),
            gitlab: {
              jobId,
              status: job?.status || 'unknown',
              progress: job?.progress,
              duration: job?.duration,
              logs: job?.logs?.slice(-10), // Last 10 log lines
            },
          };
        } else if (operation === 'cancelPipeline' || payload.cancel) {
          // Отмена pipeline
          const pipelineId = payload.pipelineId;
          const result = engine.cancelPipeline(pipelineId || '');

          message.status = result.success ? 'delivered' : 'failed';
          message.error = result.reason;
          message.latency = 30;
          message.payload = {
            ...(payload || {}),
            gitlab: {
              pipelineId,
              canceled: result.success,
            },
          };
        } else {
          // Общий API запрос
          message.status = 'delivered';
          message.latency = 30;
          message.payload = {
            ...(payload || {}),
            gitlab: {
              processed: true,
              operation,
            },
          };
        }

        // Обновляем метрики GitLab CI (requests)
        engine.processRequest(message.status === 'delivered');

        return message;
      },

      getSupportedFormats: () => ['json', 'text'],
    };
  }

  /**
   * Create handler for Argo CD (GitOps)
   * Обрабатывает webhook триггеры, API запросы и операции синхронизации, делегирует расчёт нагрузки ArgoCDEmulationEngine.
   */
  private createArgoCDHandler(): ComponentDataHandler {
    return {
      processData: (node, message, config) => {
        const engine = emulationEngine.getArgoCDEmulationEngine(node.id);

        if (!engine) {
          // Если движок не инициализирован, считаем, что Argo CD недоступен
          message.status = 'failed';
          message.error = 'Argo CD engine not initialized';
          return message;
        }

        const payload = (message.payload || {}) as any;
        const operation: string | undefined =
          message.metadata?.operation || payload.operation || payload.action || 'webhook';

        // Определяем тип операции
        if (operation === 'webhook' || payload.ref || payload.branch || payload.commit || payload.repository) {
          // Webhook trigger - может триггерить синхронизацию приложения
          const repository = payload.repository || payload.repo || '';
          const ref = payload.ref || payload.branch || payload.commit || 'main';
          const applicationName = payload.application || payload.app || '';

          // Если указано приложение, запускаем синхронизацию
          if (applicationName) {
            const success = engine.startSync(applicationName);
            if (success) {
              message.status = 'delivered';
              message.latency = 50; // Webhook processing latency
              message.payload = {
                ...(payload || {}),
                argocd: {
                  webhookReceived: true,
                  application: applicationName,
                  repository,
                  ref,
                  syncTriggered: true,
                },
              };
            } else {
              message.status = 'failed';
              message.error = 'Failed to trigger sync or application already syncing';
              message.latency = 50;
            }
          } else {
            // Просто отмечаем получение webhook
            message.status = 'delivered';
            message.latency = 30;
            message.payload = {
              ...(payload || {}),
              argocd: {
                webhookReceived: true,
                repository,
                ref,
                syncTriggered: false,
                reason: 'No application specified',
              },
            };
          }
        } else if (operation === 'sync' || operation === 'startSync') {
          // Явный запрос на синхронизацию
          const applicationName = payload.application || payload.app || message.metadata?.application;
          if (!applicationName) {
            message.status = 'failed';
            message.error = 'Application name is required for sync operation';
            return message;
          }

          const success = engine.startSync(applicationName);
          if (success) {
            message.status = 'delivered';
            message.latency = 50;
            message.payload = {
              ...(payload || {}),
              argocd: {
                operation: 'sync',
                application: applicationName,
                syncStarted: true,
              },
            };
          } else {
            message.status = 'failed';
            message.error = 'Failed to start sync or application already syncing';
            message.latency = 50;
          }
        } else if (operation === 'getApplicationStatus' || operation === 'getAppStatus' || payload.application) {
          // API запрос для получения статуса приложения
          const applicationName = payload.application || payload.app || '';
          const app = engine.getApplication(applicationName);

          message.status = 'delivered';
          message.latency = 20; // API latency
          message.payload = {
            ...(payload || {}),
            argocd: {
              application: applicationName,
              status: app?.status || 'unknown',
              health: app?.health || 'unknown',
              lastSync: app?.lastSync,
              lastSyncDuration: app?.lastSyncDuration,
              revision: app?.revision,
              sourceRevision: app?.sourceRevision,
            },
          };
        } else if (operation === 'getSyncStatus' || payload.syncOperationId) {
          // API запрос для получения статуса операции синхронизации
          const syncOperationId = payload.syncOperationId || payload.operationId;
          const syncOps = engine.getSyncOperations();
          const syncOp = syncOps.find(op => op.id === syncOperationId);

          message.status = 'delivered';
          message.latency = 20;
          message.payload = {
            ...(payload || {}),
            argocd: {
              syncOperationId,
              status: syncOp?.status || 'unknown',
              phase: syncOp?.phase,
              startedAt: syncOp?.startedAt,
              finishedAt: syncOp?.finishedAt,
              error: syncOp?.error,
            },
          };
        } else if (operation === 'getMetrics' || operation === 'getStats') {
          // API запрос для получения метрик
          const metrics = engine.getMetrics();
          const stats = engine.getStats();

          message.status = 'delivered';
          message.latency = 15;
          message.payload = {
            ...(payload || {}),
            argocd: {
              metrics,
              stats,
            },
          };
        } else {
          // Общий API запрос
          message.status = 'delivered';
          message.latency = 30;
          message.payload = {
            ...(payload || {}),
            argocd: {
              processed: true,
              operation,
            },
          };
        }

        // Обновляем метрики Argo CD (requests)
        engine.processRequest(message.status === 'delivered');

        return message;
      },

      getSupportedFormats: () => ['json', 'text'],
    };
  }

  /**
   * Create handler for Terraform (IaC)
   * Обрабатывает webhook триггеры, API запросы для запуска runs, получения статусов, делегирует расчёт нагрузки TerraformEmulationEngine.
   */
  private createTerraformHandler(): ComponentDataHandler {
    return {
      processData: (node, message, config) => {
        const engine = emulationEngine.getTerraformEmulationEngine(node.id);

        if (!engine) {
          // Если движок не инициализирован, считаем, что Terraform недоступен
          message.status = 'failed';
          message.error = 'Terraform engine not initialized';
          return message;
        }

        const payload = (message.payload || {}) as any;
        const operation: string | undefined =
          message.metadata?.operation || payload.operation || payload.action || 'webhook';

        // Определяем тип операции
        if (operation === 'webhook' || payload.ref || payload.branch || payload.commit || payload.repository) {
          // VCS webhook trigger - запускаем run для workspace
          const workspaceName = payload.workspace || payload.workspaceId || '';
          const workspaceId = payload.workspaceId || payload.workspace;
          const branch = payload.ref?.replace('refs/heads/', '') || payload.branch || 'main';
          const commit = payload.commit || payload.sha || undefined;

          if (workspaceName || workspaceId) {
            // Находим workspace по имени или ID
            const workspaces = engine.getWorkspaces();
            const workspace = workspaceId 
              ? workspaces.find(w => w.id === workspaceId)
              : workspaces.find(w => w.name === workspaceName);
            
            if (workspace) {
              const result = engine.triggerRun(workspace.id, { 
                planOnly: payload.planOnly ?? false,
                source: 'vcs',
                triggeredBy: 'vcs-webhook'
              });
              
              if (result.success) {
                message.status = 'delivered';
                message.latency = 50; // Webhook processing latency
                message.payload = {
                  ...(payload || {}),
                  terraform: {
                    webhookReceived: true,
                    workspaceId: workspace.id,
                    workspaceName: workspace.name,
                    branch,
                    commit,
                    runTriggered: true,
                    runId: result.runId,
                  },
                };
              } else {
                message.status = 'failed';
                message.error = result.reason || 'Failed to trigger run';
                message.latency = 50;
              }
            } else {
              message.status = 'failed';
              message.error = 'Workspace not found';
              message.latency = 50;
            }
          } else {
            // Просто отмечаем получение webhook
            message.status = 'delivered';
            message.latency = 30;
            message.payload = {
              ...(payload || {}),
              terraform: {
                webhookReceived: true,
                branch,
                commit,
                runTriggered: false,
                reason: 'No workspace specified',
              },
            };
          }
        } else if (operation === 'triggerRun' || operation === 'createRun' || operation === 'run') {
          // Явный запрос на запуск run
          const workspaceId = payload.workspaceId || payload.workspace || message.metadata?.workspaceId;
          const planOnly = payload.planOnly ?? false;

          if (!workspaceId) {
            message.status = 'failed';
            message.error = 'Workspace ID is required for run operation';
            return message;
          }

          const result = engine.triggerRun(workspaceId, {
            planOnly,
            source: 'api',
            triggeredBy: payload.triggeredBy || 'user'
          });
          
          if (result.success) {
            message.status = 'delivered';
            message.latency = 50;
            message.payload = {
              ...(payload || {}),
              terraform: {
                operation: 'triggerRun',
                workspaceId,
                planOnly,
                runId: result.runId,
                runTriggered: true,
              },
            };
          } else {
            message.status = 'failed';
            message.error = result.reason || 'Failed to trigger run';
            message.latency = 50;
          }
        } else if (operation === 'cancelRun' || operation === 'cancel') {
          // Запрос на отмену run
          const runId = payload.runId || payload.run || message.metadata?.runId;

          if (!runId) {
            message.status = 'failed';
            message.error = 'Run ID is required for cancel operation';
            return message;
          }

          const result = engine.cancelRun(runId);
          
          if (result.success) {
            message.status = 'delivered';
            message.latency = 30;
            message.payload = {
              ...(payload || {}),
              terraform: {
                operation: 'cancelRun',
                runId,
                canceled: true,
              },
            };
          } else {
            message.status = 'failed';
            message.error = result.reason || 'Failed to cancel run';
            message.latency = 30;
          }
        } else if (operation === 'getRunStatus' || operation === 'getRun' || payload.runId) {
          // API запрос для получения статуса run
          const runId = payload.runId || payload.run || '';
          const run = engine.getRun(runId);

          message.status = 'delivered';
          message.latency = 20; // API latency
          message.payload = {
            ...(payload || {}),
            terraform: {
              runId,
              status: run?.status || 'unknown',
              workspaceId: run?.workspaceId,
              workspaceName: run?.workspaceName,
              createdAt: run?.createdAt,
              startedAt: run?.startedAt,
              finishedAt: run?.finishedAt,
              duration: run?.duration,
              planOnly: run?.planOnly,
              message: run?.message,
              error: run?.error,
              hasChanges: run?.hasChanges,
              resourceAdditions: run?.resourceAdditions,
              resourceChanges: run?.resourceChanges,
              resourceDestructions: run?.resourceDestructions,
            },
          };
        } else if (operation === 'getWorkspaceStatus' || operation === 'getWorkspace' || payload.workspaceId) {
          // API запрос для получения статуса workspace
          const workspaceId = payload.workspaceId || payload.workspace || '';
          const workspace = engine.getWorkspace(workspaceId);
          const state = workspace ? engine.getStateForWorkspace(workspaceId) : undefined;

          message.status = 'delivered';
          message.latency = 20;
          message.payload = {
            ...(payload || {}),
            terraform: {
              workspaceId,
              workspace: workspace ? {
                id: workspace.id,
                name: workspace.name,
                description: workspace.description,
                terraformVersion: workspace.terraformVersion,
                autoApply: workspace.autoApply,
                lastRun: workspace.lastRun,
              } : null,
              state: state ? {
                version: state.version,
                serial: state.serial,
                resources: state.resources,
                updatedAt: state.updatedAt,
              } : null,
            },
          };
        } else if (operation === 'getMetrics' || operation === 'getStats') {
          // API запрос для получения метрик
          const metrics = engine.getMetrics();

          message.status = 'delivered';
          message.latency = 20;
          message.payload = {
            ...(payload || {}),
            terraform: {
              metrics: {
                workspacesTotal: metrics.workspacesTotal,
                runsTotal: metrics.runsTotal,
                runsSuccess: metrics.runsSuccess,
                runsFailed: metrics.runsFailed,
                runsRunning: metrics.runsRunning,
                runsPending: metrics.runsPending,
                runsPerHour: metrics.runsPerHour,
                averageRunDuration: metrics.averageRunDuration,
                statesTotal: metrics.statesTotal,
                resourcesManaged: metrics.resourcesManaged,
              },
            },
          };
        } else {
          // Общий API запрос
          message.status = 'delivered';
          message.latency = 30;
          message.payload = {
            ...(payload || {}),
            terraform: {
              processed: true,
              operation,
            },
          };
        }

        // Обновляем метрики Terraform (requests)
        engine.processRequest(message.status === 'delivered');

        return message;
      },

      getSupportedFormats: () => ['json', 'text'],
    };
  }

  /**
   * Create handler for Harbor (Container Registry)
   * Обрабатывает push/pull операций, сканирование уязвимостей, репликацию
   */
  private createHarborHandler(): ComponentDataHandler {
    return {
      processData: (node, message, config) => {
        const engine = emulationEngine.getHarborEmulationEngine(node.id);

        if (!engine) {
          message.status = 'failed';
          message.error = 'Harbor engine not initialized';
          return message;
        }

        const payload = (message.payload || {}) as any;
        const operation: string | undefined =
          message.metadata?.operation || payload.operation || payload.action || 'pull';

        // Harbor operations: push, pull, scan
        if (operation === 'push') {
          // Push operation - store image
          message.status = 'delivered';
          message.latency = 500 + Math.random() * 1500; // 500-2000ms
          message.payload = {
            ...(payload || {}),
            harbor: {
              operation: 'push',
              repository: payload.repository || 'unknown',
              tag: payload.tag || 'latest',
              size: payload.size || 0,
              status: 'completed',
            },
          };
        } else if (operation === 'pull') {
          // Pull operation - retrieve image
          message.status = 'delivered';
          message.latency = 200 + Math.random() * 800; // 200-1000ms
          message.payload = {
            ...(payload || {}),
            harbor: {
              operation: 'pull',
              repository: payload.repository || 'unknown',
              tag: payload.tag || 'latest',
              status: 'completed',
            },
          };
        } else if (operation === 'scan') {
          // Scan operation - vulnerability scan
          message.status = 'delivered';
          message.latency = 5000 + Math.random() * 15000; // 5-20 seconds
          message.payload = {
            ...(payload || {}),
            harbor: {
              operation: 'scan',
              repository: payload.repository || 'unknown',
              tag: payload.tag || 'latest',
              status: 'completed',
            },
          };
        } else {
          // Unknown operation
          message.status = 'delivered';
          message.latency = 100 + Math.random() * 200;
          message.payload = {
            ...(payload || {}),
            harbor: {
              operation: operation || 'unknown',
              status: 'completed',
            },
          };
        }

        return message;
      },
      getSupportedFormats: () => ['json', 'binary'],
    };
  }

  /**
   * Create handler for Docker (Container Management)
   * Обрабатывает операции с контейнерами, образами, сетями, томами
   */
  private createDockerHandler(): ComponentDataHandler {
    return {
      processData: (node, message, config) => {
        const engine = emulationEngine.getDockerEmulationEngine(node.id);

        if (!engine) {
          message.status = 'failed';
          message.error = 'Docker engine not initialized';
          return message;
        }

        const payload = (message.payload || {}) as any;
        const operation: string | undefined =
          message.metadata?.operation || payload.operation || payload.action || 'container-operation';

        // Docker operations: container (create, start, stop, etc.), image (pull, push, build), network, volume
        if (operation.startsWith('container-')) {
          // Container operations
          const containerOp = operation.replace('container-', '');
          message.status = 'delivered';
          
          switch (containerOp) {
            case 'create':
              message.latency = 500 + Math.random() * 1000; // 500-1500ms
              break;
            case 'start':
              message.latency = 200 + Math.random() * 500; // 200-700ms
              break;
            case 'stop':
              message.latency = 100 + Math.random() * 300; // 100-400ms
              break;
            case 'restart':
              message.latency = 300 + Math.random() * 700; // 300-1000ms
              break;
            default:
              message.latency = 100 + Math.random() * 200;
          }
          
          message.payload = {
            ...(payload || {}),
            docker: {
              operation: containerOp,
              containerId: payload.containerId || 'unknown',
              status: 'completed',
            },
          };
        } else if (operation.startsWith('image-')) {
          // Image operations
          const imageOp = operation.replace('image-', '');
          message.status = 'delivered';
          
          switch (imageOp) {
            case 'pull':
              message.latency = 2000 + Math.random() * 8000; // 2-10 seconds
              break;
            case 'push':
              message.latency = 3000 + Math.random() * 10000; // 3-13 seconds
              break;
            case 'build':
              message.latency = 5000 + Math.random() * 15000; // 5-20 seconds
              break;
            default:
              message.latency = 1000 + Math.random() * 2000;
          }
          
          message.payload = {
            ...(payload || {}),
            docker: {
              operation: imageOp,
              imageId: payload.imageId || 'unknown',
              status: 'completed',
            },
          };
        } else {
          // Default: pass through
          message.status = 'delivered';
          message.latency = 100 + Math.random() * 200;
          message.payload = {
            ...(payload || {}),
            docker: {
              operation: operation || 'unknown',
              status: 'completed',
            },
          };
        }

        return message;
      },
      getSupportedFormats: () => ['json', 'text'],
    };
  }

  /**
   * Create handler for Vault (Secrets Management)
   * Обрабатывает запросы к секретам и делегирует расчёт нагрузки VaultEmulationEngine.
   */
  private createVaultHandler(): ComponentDataHandler {
    return {
      processData: (node, message, config) => {
        const engine = emulationEngine.getVaultEmulationEngine(node.id);

        if (!engine) {
          // Если движок не инициализирован, считаем, что Vault недоступен
          message.status = 'failed';
          message.error = 'Vault engine not initialized';
          return message;
        }

        const payload = (message.payload || {}) as any;

        // Определяем тип операции Vault
        const operation: string | undefined =
          message.metadata?.operation || payload.operation || payload.action || 'read';

        const path = payload?.path || message.metadata?.path || 'secret/default';
        const token = payload?.token || message.metadata?.token;

        let result;

        if (typeof operation === 'string') {
          const opLower = operation.toLowerCase();

          if (opLower.includes('write') || opLower === 'create' || opLower === 'update') {
            // Write operation
            const data = payload?.data || payload?.value || {};
            result = engine.processWriteRequest(path, data, token);
          } else if (opLower.includes('delete') || opLower === 'remove') {
            // Delete operation
            result = engine.processDeleteRequest(path, token);
          } else if (opLower.includes('encrypt')) {
            // Encryption operation (Transit engine)
            const plaintext = payload?.plaintext || payload?.data || '';
            const keyName = payload?.key || payload?.keyName || 'default';
            result = engine.processEncryptRequest(plaintext, keyName, token);
          } else if (opLower.includes('decrypt')) {
            // Decryption operation (Transit engine)
            const ciphertext = payload?.ciphertext || payload?.data || '';
            const keyName = payload?.key || payload?.keyName || 'default';
            result = engine.processDecryptRequest(ciphertext, keyName, token);
          } else if (opLower.includes('auth') || opLower === 'login' || opLower === 'authenticate') {
            // Authentication operation
            const authMethod = payload?.method || payload?.authMethod || 'token';
            result = engine.processAuthRequest(
              authMethod as 'token' | 'approle' | 'ldap' | 'aws',
              payload
            );
          } else {
            // Default: read operation
            const key = payload?.key;
            result = engine.processReadRequest(path, key, token);
          }
        } else {
          // Default: read operation
          const key = payload?.key;
          result = engine.processReadRequest(path, key, token);
        }

        message.latency = (message.latency || 0) + result.latency;

        if (!result.success) {
          message.status = 'failed';
          message.error = result.error || 'Vault operation failed';
        } else {
          message.status = 'delivered';
          // Обновляем payload с результатом операции
          message.payload = {
            ...(payload || {}),
            vault: {
              path,
              data: result.data,
              token: result.token,
              policies: result.policies,
            },
          };

          // Обновляем metadata для дальнейших хопов
          if (result.token) {
            message.metadata = {
              ...message.metadata,
              vaultToken: result.token,
              vaultPolicies: result.policies,
            };
          }
        }

        return message;
      },

      getSupportedFormats: () => ['json', 'text'],
    };
  }

  /**
   * Create handler for WAF
   */
  private createWAFHandler(): ComponentDataHandler {
    return {
      processData: (node, message, config) => {
        const engine = emulationEngine.getWAFEmulationEngine(node.id);

        if (!engine) {
          // Если движок не инициализирован, пропускаем запрос
          message.status = 'delivered';
          return message;
        }

        const payload = (message.payload || {}) as any;

        // Извлекаем информацию о запросе из сообщения
        const path = payload?.path || message.metadata?.path || '/';
        const method = payload?.method || message.metadata?.method || 'GET';
        const headers = payload?.headers || message.metadata?.headers || {};
        const query = payload?.query || message.metadata?.query || {};
        const body = payload?.body || payload;
        const sourceIP = payload?.sourceIP || message.metadata?.sourceIP || headers['x-forwarded-for'] || headers['x-real-ip'];
        const country = payload?.country || message.metadata?.country || headers['cf-ipcountry'];
        const userAgent = payload?.userAgent || message.metadata?.userAgent || headers['user-agent'];

        // Обрабатываем запрос через WAF
        const result = engine.processRequest({
          path,
          method,
          headers,
          query,
          body,
          sourceIP,
          country,
          userAgent,
        });

        message.latency = (message.latency || 0) + result.latency;

        if (result.blocked) {
          // Запрос заблокирован
          message.status = 'failed';
          message.error = result.error || `Request blocked by WAF: ${result.threatDetected ? 'Threat detected' : 'Rule matched'}`;
          
          // Добавляем информацию об угрозе в metadata
          if (result.threatDetected) {
            message.metadata = {
              ...message.metadata,
              wafBlocked: true,
              wafThreatDetected: true,
              wafAction: 'block',
            };
          }
        } else if (!result.success && result.action === 'challenge') {
          // Challenge (например, CAPTCHA)
          message.status = 'pending';
          message.metadata = {
            ...message.metadata,
            wafChallenge: true,
            wafAction: 'challenge',
          };
        } else {
          // Запрос разрешен
          message.status = 'delivered';
          
          // Добавляем информацию о проверке в metadata
          message.metadata = {
            ...message.metadata,
            wafChecked: true,
            wafAllowed: true,
            wafLatency: result.latency,
          };

          // Если была обнаружена угроза, но запрос не заблокирован (режим detection)
          if (result.threatDetected) {
            message.metadata.wafThreatDetected = true;
            message.metadata.wafAction = 'log';
          }
        }

        return message;
      },

      getSupportedFormats: () => ['json', 'text', 'xml'],
    };
  }

  /**
   * Create handler for Firewall
   */
  private createFirewallHandler(): ComponentDataHandler {
    return {
      processData: (node, message, config) => {
        const engine = emulationEngine.getFirewallEmulationEngine(node.id);

        if (!engine) {
          // Если движок не инициализирован, пропускаем пакет
          message.status = 'delivered';
          return message;
        }

        const payload = (message.payload || {}) as any;

        // Извлекаем информацию о пакете из сообщения
        const source = payload?.source || message.metadata?.sourceIP || payload?.sourceIP || '0.0.0.0';
        const destination = payload?.destination || message.metadata?.destinationIP || payload?.destinationIP || '10.0.0.1';
        const protocol = payload?.protocol || message.metadata?.protocol || 'tcp';
        const port = payload?.port || message.metadata?.port || payload?.destinationPort;
        const sourcePort = payload?.sourcePort || message.metadata?.sourcePort;

        // Обрабатываем пакет через Firewall
        const result = engine.processPacket({
          source,
          destination,
          protocol: protocol as 'tcp' | 'udp' | 'icmp' | 'all',
          port,
          sourcePort,
        });

        message.latency = (message.latency || 0) + result.latency;

        if (result.blocked) {
          // Пакет заблокирован
          message.status = 'failed';
          message.error = result.error || `Packet ${result.action} by Firewall: ${result.matchedRule?.name || 'Default policy'}`;
          
          // Добавляем информацию о блокировке в metadata
          message.metadata = {
            ...message.metadata,
            firewallBlocked: true,
            firewallAction: result.action,
            firewallRuleId: result.matchedRule?.id,
            firewallRuleName: result.matchedRule?.name,
          };
        } else {
          // Пакет разрешен
          message.status = 'delivered';
          
          // Добавляем информацию о проверке в metadata
          message.metadata = {
            ...message.metadata,
            firewallChecked: true,
            firewallAllowed: true,
            firewallLatency: result.latency,
            firewallRuleId: result.matchedRule?.id,
            firewallRuleName: result.matchedRule?.name,
          };
        }

        return message;
      },

      getSupportedFormats: () => ['json', 'text', 'binary'],
    };
  }

  /**
   * Create handler for IDS/IPS
   */
  private createIDSIPSHandler(): ComponentDataHandler {
    return {
      processData: (node, message, config) => {
        const engine = emulationEngine.getIDSIPSEmulationEngine(node.id);

        if (!engine) {
          // Если движок не инициализирован, пропускаем пакет
          message.status = 'delivered';
          return message;
        }

        const payload = (message.payload || {}) as any;

        // Извлекаем информацию о пакете из сообщения
        const source = payload?.source || message.metadata?.sourceIP || payload?.sourceIP || '0.0.0.0';
        const destination = payload?.destination || message.metadata?.destinationIP || payload?.destinationIP || '10.0.0.1';
        const protocol = payload?.protocol || message.metadata?.protocol || 'tcp';
        const port = payload?.port || message.metadata?.port || payload?.destinationPort;
        const sourcePort = payload?.sourcePort || message.metadata?.sourcePort;
        const packetPayload = payload?.payload || payload?.body || (typeof payload === 'string' ? payload : JSON.stringify(payload));

        // Обрабатываем пакет через IDS/IPS
        const result = engine.processPacket({
          source,
          destination,
          protocol: protocol as 'tcp' | 'udp' | 'icmp' | 'all',
          port,
          sourcePort,
          payload: packetPayload,
        });

        message.latency = (message.latency || 0) + result.latency;

        if (result.blocked) {
          // Пакет заблокирован (IPS режим)
          message.status = 'failed';
          message.error = result.error || `Packet blocked by IDS/IPS: Intrusion detected`;
          
          // Добавляем информацию о блокировке в metadata
          message.metadata = {
            ...message.metadata,
            idsipsBlocked: true,
            idsipsAlertGenerated: result.alertGenerated,
            idsipsAction: 'block',
          };

          if (result.alertGenerated) {
            message.metadata.idsipsAlertType = 'intrusion';
          }
        } else {
          // Пакет разрешен (или только обнаружен в IDS режиме)
          message.status = 'delivered';
          
          // Добавляем информацию о проверке в metadata
          message.metadata = {
            ...message.metadata,
            idsipsChecked: true,
            idsipsAllowed: true,
            idsipsLatency: result.latency,
            idsipsAlertGenerated: result.alertGenerated,
          };

          // Если был сгенерирован алерт (IDS режим)
          if (result.alertGenerated) {
            message.metadata.idsipsAction = 'alert';
            message.metadata.idsipsAlertType = 'intrusion';
          }
        }

        return message;
      },

      getSupportedFormats: () => ['json', 'text', 'binary'],
    };
  }

  /**
   * Create handler for OpenTelemetry Collector
   */
  private createOpenTelemetryCollectorHandler(): ComponentDataHandler {
    return {
      processData: (node, message, config) => {
        // Get OpenTelemetry Collector routing engine from emulation engine
        const otelEngine = emulationEngine.getOpenTelemetryCollectorRoutingEngine(node.id);
        
        if (!otelEngine) {
          // No engine, just pass through
          message.status = 'delivered';
          return message;
        }

        // Get source node for context
        const sourceNode = this.nodes.find(n => n.id === message.source);
        
        // Process message through OpenTelemetry Collector
        const result = otelEngine.processMessage(message, sourceNode || undefined);
        
        if (result.success) {
          message.status = 'delivered';
          message.latency = result.latency;
        } else {
          message.status = 'failed';
          message.error = result.error || 'OpenTelemetry Collector processing failed';
          message.latency = result.latency;
        }
        
        return message;
      },
      
      getSupportedFormats: () => ['json', 'protobuf', 'binary', 'text'],
    };
  }

  // ========== Data Generation Methods ==========

  private createCRMDataMessage(node: CanvasNode): DataMessage {
    const config = node.data.config || {};
    const contacts = config.contacts || [];
    const deals = config.deals || [];
    
    // Generate random business data
    const dataType = Math.random() > 0.5 ? 'contact' : 'deal';
    let payload: Record<string, unknown>;
    
    if (dataType === 'contact' && contacts.length > 0) {
      const contact = contacts[Math.floor(Math.random() * contacts.length)];
      payload = {
        operation: 'create',
        type: 'contact',
        data: {
          name: contact.name,
          email: contact.email,
          company: contact.company,
          status: contact.status,
        },
      };
    } else if (deals.length > 0) {
      const deal = deals[Math.floor(Math.random() * deals.length)];
      payload = {
        operation: 'update',
        type: 'deal',
        data: {
          id: deal.id,
          name: deal.name,
          value: deal.value,
          stage: deal.stage,
        },
      };
    } else {
      // Default data if no contacts/deals
      payload = {
        operation: 'create',
        type: 'contact',
        data: {
          name: `Contact ${Date.now()}`,
          email: `contact${Date.now()}@example.com`,
        },
      };
    }
    
    const payloadStr = JSON.stringify(payload);
    
    return {
      id: '',
      timestamp: Date.now(),
      source: node.id,
      target: '',
      connectionId: '',
      format: 'json',
      payload,
      size: new Blob([payloadStr]).size,
      metadata: {
        contentType: 'application/json',
        operation: payload.operation,
      },
      status: 'pending',
    };
  }

  private createERPDataMessage(node: CanvasNode): DataMessage {
    const config = node.data.config || {};
    const orders = config.orders || [];
    const inventory = config.inventory || [];
    
    const dataType = Math.random() > 0.5 ? 'order' : 'inventory';
    let payload: Record<string, unknown>;
    
    if (dataType === 'order' && orders.length > 0) {
      const order = orders[Math.floor(Math.random() * orders.length)];
      payload = {
        operation: 'create',
        type: 'order',
        data: {
          orderNumber: order.orderNumber,
          customer: order.customer,
          total: order.total,
          items: order.items,
        },
      };
    } else if (inventory.length > 0) {
      const item = inventory[Math.floor(Math.random() * inventory.length)];
      payload = {
        operation: 'update',
        type: 'inventory',
        data: {
          sku: item.sku,
          quantity: item.quantity,
          status: item.status,
        },
      };
    } else {
      payload = {
        operation: 'create',
        type: 'order',
        data: {
          orderNumber: `ORD-${Date.now()}`,
          total: Math.random() * 1000,
        },
      };
    }
    
    const payloadStr = JSON.stringify(payload);
    
    return {
      id: '',
      timestamp: Date.now(),
      source: node.id,
      target: '',
      connectionId: '',
      format: 'json',
      payload,
      size: new Blob([payloadStr]).size,
      metadata: {
        contentType: 'application/json',
        operation: payload.operation,
      },
      status: 'pending',
    };
  }

  private createPaymentDataMessage(node: CanvasNode): DataMessage {
    const config = node.data.config || {};
    const transactions = config.transactions || [];
    
    let payload: Record<string, unknown>;
    if (transactions.length > 0) {
      const txn = transactions[Math.floor(Math.random() * transactions.length)];
      payload = {
        operation: 'process',
        type: 'transaction',
        data: {
          id: txn.id,
          amount: txn.amount,
          currency: txn.currency,
          status: txn.status,
        },
      };
    } else {
      payload = {
        operation: 'process',
        type: 'transaction',
        data: {
          amount: Math.random() * 1000,
          currency: 'USD',
        },
      };
    }
    
    const payloadStr = JSON.stringify(payload);
    
    return {
      id: '',
      timestamp: Date.now(),
      source: node.id,
      target: '',
      connectionId: '',
      format: 'json',
      payload,
      size: new Blob([payloadStr]).size,
      metadata: {
        contentType: 'application/json',
        operation: payload.operation,
      },
      status: 'pending',
    };
  }

  private generateQueryResults(dbType: string, query?: string): Record<string, unknown>[] {
    // Generate mock query results based on database type
    const count = Math.floor(Math.random() * 10) + 1;
    const results: Record<string, unknown>[] = [];
    
    for (let i = 0; i < count; i++) {
      results.push({
        id: i + 1,
        name: `Record ${i + 1}`,
        value: Math.random() * 100,
        timestamp: new Date().toISOString(),
      });
    }
    
    return results;
  }
}

export const dataFlowEngine = new DataFlowEngine();


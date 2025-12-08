import { CanvasNode, CanvasConnection, ComponentConfig } from '@/types';
import { emulationEngine } from './EmulationEngine';

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
  private messageQueue: Map<string, DataMessage[]> = new Map(); // connectionId -> messages
  private messageHistory: DataMessage[] = [];
  private isRunning: boolean = false;
  private updateInterval: number = 200; // ms - how often to process messages
  private intervalId: NodeJS.Timeout | null = null;
  private messageIdCounter: number = 0;
  private readonly MAX_HISTORY = 1000; // Keep last 1000 messages

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
    
    // Message brokers - pass through messages
    this.registerHandler('kafka', this.createMessageBrokerHandler('kafka'));
    this.registerHandler('rabbitmq', this.createMessageBrokerHandler('rabbitmq'));
    
    // APIs - transform and route data
    this.registerHandler('rest', this.createAPIHandler('rest'));
    this.registerHandler('grpc', this.createAPIHandler('grpc'));
    this.registerHandler('graphql', this.createAPIHandler('graphql'));
    this.registerHandler('websocket', this.createAPIHandler('websocket'));
    
    // Integration - transform formats
    this.registerHandler('kong', this.createIntegrationHandler('kong'));
    this.registerHandler('mulesoft', this.createIntegrationHandler('mulesoft'));
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
          const result = handler.processData(targetNode, message, config);
          if (result) {
            // Message was processed, add to history and remove from queue
            this.addToHistory(message);
            messages.splice(messages.indexOf(message), 1);
          }
        } catch (error) {
          message.status = 'failed';
          message.error = error instanceof Error ? error.message : 'Unknown error';
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
      message.format = compatibleFormat;
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
    if (sourceNode && ['kong', 'mulesoft', 'apigee', 'bff-service'].includes(sourceNode.type)) {
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
        if (type === 'rest' && message.format !== 'json') {
          message.format = 'json';
          message.status = 'transformed';
        } else if (type === 'grpc' && message.format !== 'protobuf') {
          message.format = 'protobuf';
          message.status = 'transformed';
        }
        return message;
      },
      
      getSupportedFormats: () => {
        switch (type) {
          case 'rest':
            return ['json', 'xml'];
          case 'grpc':
            return ['protobuf', 'binary'];
          case 'graphql':
            return ['json'];
          case 'websocket':
            return ['json', 'text', 'binary'];
          default:
            return ['json'];
        }
      },
    };
  }

  /**
   * Create handler for integration components
   */
  private createIntegrationHandler(type: string): ComponentDataHandler {
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


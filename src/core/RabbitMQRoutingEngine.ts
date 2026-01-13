/**
 * RabbitMQ Routing Engine
 * Handles message routing through exchanges to queues based on bindings
 */

export interface Queue {
  name: string;
  durable: boolean;
  exclusive: boolean;
  autoDelete: boolean;
  messages?: number;
  consumers?: number;
  ready?: number;
  unacked?: number;
  arguments?: Record<string, any>;
  deadLetterExchange?: string;
  deadLetterRoutingKey?: string;
  messageTtl?: number;
  maxLength?: number;
  maxPriority?: number;
  queueType?: 'classic' | 'quorum' | 'stream'; // x-queue-type
  singleActiveConsumer?: boolean; // x-single-active-consumer
}

export interface Exchange {
  name: string;
  type: 'direct' | 'topic' | 'fanout' | 'headers';
  durable: boolean;
  autoDelete: boolean;
  internal: boolean;
  arguments?: Record<string, any>;
  alternateExchange?: string; // Exchange to route messages when no bindings match
}

export interface Binding {
  id: string;
  source: string; // exchange name
  destination: string; // queue name
  routingKey: string;
  arguments?: Record<string, any>;
}

export interface QueuedMessage {
  id: string;
  timestamp: number;
  routingKey: string;
  exchange: string;
  payload: unknown;
  size: number;
  priority?: number;
  headers?: Record<string, unknown>;
  ttl?: number; // expiration timestamp
}

/**
 * RabbitMQ Routing Engine
 * Simulates RabbitMQ message routing behavior
 */
export class RabbitMQRoutingEngine {
  private queues: Map<string, Queue> = new Map();
  private exchanges: Map<string, Exchange> = new Map();
  private bindings: Map<string, Binding[]> = new Map(); // exchange -> bindings
  private queueMessages: Map<string, QueuedMessage[]> = new Map(); // queue -> ready messages
  private unackedMessages: Map<string, QueuedMessage[]> = new Map(); // queue -> unacked messages (delivered to consumers)
  private queueState: Map<string, {
    ready: number;
    unacked: number;
    total: number;
    lastUpdate: number;
  }> = new Map();
  private consumptionRate: number = 10; // messages per second per consumer (default: 10)
  private processingTime: number = 100; // milliseconds per message (default: 100)

  /**
   * Initialize with RabbitMQ configuration
   */
  public initialize(config: {
    queues?: Queue[];
    exchanges?: Exchange[];
    bindings?: Binding[];
    consumptionRate?: number;
    processingTime?: number;
  }) {
    // Set consumption rate and processing time if provided
    if (config.consumptionRate !== undefined) {
      this.consumptionRate = config.consumptionRate;
    }
    if (config.processingTime !== undefined) {
      this.processingTime = config.processingTime;
    }
    // Clear previous state
    this.queues.clear();
    this.exchanges.clear();
    this.bindings.clear();
    this.queueMessages.clear();
    this.unackedMessages.clear();
    this.queueState.clear();

    // Initialize queues
    if (config.queues) {
      for (const queue of config.queues) {
        this.queues.set(queue.name, { ...queue });
        this.queueMessages.set(queue.name, []);
        this.unackedMessages.set(queue.name, []);
        this.queueState.set(queue.name, {
          ready: queue.ready || 0,
          unacked: queue.unacked || 0,
          total: queue.messages || 0,
          lastUpdate: Date.now(),
        });
      }
    }

    // Initialize exchanges
    if (config.exchanges) {
      for (const exchange of config.exchanges) {
        this.exchanges.set(exchange.name, { ...exchange });
        this.bindings.set(exchange.name, []);
      }
    }

    // Initialize bindings
    if (config.bindings) {
      for (const binding of config.bindings) {
        const exchangeBindings = this.bindings.get(binding.source) || [];
        exchangeBindings.push(binding);
        this.bindings.set(binding.source, exchangeBindings);
      }
    }
  }

  /**
   * Route a message through an exchange to queues
   */
  public routeMessage(
    exchangeName: string,
    routingKey: string,
    payload: unknown,
    size: number,
    headers?: Record<string, unknown>,
    priority?: number
  ): string[] {
    const exchange = this.exchanges.get(exchangeName);
    if (!exchange) {
      return []; // Exchange not found
    }

    const bindings = this.bindings.get(exchangeName) || [];
    const targetQueues: string[] = [];

    for (const binding of bindings) {
      if (this.shouldRouteToQueue(exchange, binding, routingKey, headers)) {
        targetQueues.push(binding.destination);
      }
    }

    // If no queues matched and alternate exchange is configured, route to alternate exchange
    if (targetQueues.length === 0 && exchange.alternateExchange) {
      return this.routeMessage(exchange.alternateExchange, routingKey, payload, size, headers, priority);
    }

    // Add message to target queues
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    for (const queueName of targetQueues) {
      const queue = this.queues.get(queueName);
      if (!queue) continue;

      // Check maxLength
      if (queue.maxLength) {
        const currentMessages = this.queueMessages.get(queueName) || [];
        if (currentMessages.length >= queue.maxLength) {
          // Queue is full, send to DLX if configured
          if (queue.deadLetterExchange) {
            this.routeToDeadLetterExchange(
              queue.deadLetterExchange,
              queue.deadLetterRoutingKey || routingKey,
              payload,
              size,
              headers,
              priority
            );
          }
          continue; // Skip adding to this queue
        }
      }

      // Create queued message
      const queuedMessage: QueuedMessage = {
        id: messageId,
        timestamp: now,
        routingKey,
        exchange: exchangeName,
        payload,
        size,
        priority: priority || queue.maxPriority ? (priority || 0) : undefined,
        headers,
        ttl: queue.messageTtl ? now + queue.messageTtl : undefined,
      };

      const messages = this.queueMessages.get(queueName) || [];
      messages.push(queuedMessage);
      
      // Sort by priority if maxPriority is set
      if (queue.maxPriority && queuedMessage.priority !== undefined) {
        messages.sort((a, b) => (b.priority || 0) - (a.priority || 0));
      }
      
      this.queueMessages.set(queueName, messages);
    }

    return targetQueues;
  }

  /**
   * Check if message should be routed to queue based on exchange type and binding
   */
  private shouldRouteToQueue(
    exchange: Exchange,
    binding: Binding,
    routingKey: string,
    headers?: Record<string, unknown>
  ): boolean {
    switch (exchange.type) {
      case 'direct':
        // Direct: exact routing key match
        return binding.routingKey === routingKey;

      case 'topic':
        // Topic: wildcard pattern matching
        return this.matchTopicPattern(binding.routingKey, routingKey);

      case 'fanout':
        // Fanout: all bound queues receive message
        return true;

      case 'headers':
        // Headers: match based on headers with x-match (all/any) support
        if (!headers || !binding.arguments) return false;
        
        // Get x-match mode (default: 'all')
        const xMatch = (binding.arguments['x-match'] as string) || 'all';
        
        // Filter out x-match and x-match-type from comparison
        const headerKeys = Object.keys(binding.arguments).filter(key => !key.startsWith('x-'));
        
        if (headerKeys.length === 0) {
          // No headers to match, route to queue
          return true;
        }
        
        if (xMatch === 'all') {
          // All specified headers must match
          for (const key of headerKeys) {
            const bindingValue = binding.arguments[key];
            const headerValue = headers[key];
            if (headerValue !== bindingValue) {
              return false;
            }
          }
          return true;
        } else if (xMatch === 'any') {
          // At least one header must match
          for (const key of headerKeys) {
            const bindingValue = binding.arguments[key];
            const headerValue = headers[key];
            if (headerValue === bindingValue) {
              return true;
            }
          }
          return false;
        }
        
        return false;

      default:
        return false;
    }
  }

  /**
   * Match topic pattern (supports * and # wildcards)
   */
  private matchTopicPattern(pattern: string, routingKey: string): boolean {
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.') // Escape dots
      .replace(/\*/g, '[^.]+') // * matches one word
      .replace(/#/g, '.*'); // # matches zero or more words
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(routingKey);
  }

  /**
   * Route message to Dead Letter Exchange
   */
  private routeToDeadLetterExchange(
    dlxName: string,
    dlxRoutingKey: string,
    payload: unknown,
    size: number,
    headers?: Record<string, unknown>,
    priority?: number
  ): void {
    // Recursively route to DLX
    this.routeMessage(dlxName, dlxRoutingKey, payload, size, headers, priority);
  }

  /**
   * Process queue consumption (simulate consumers)
   */
  public processConsumption(deltaTimeMs: number): void {
    const now = Date.now();

    for (const [queueName, queue] of this.queues.entries()) {
      let readyMessages = this.queueMessages.get(queueName) || [];
      let unackedMessages = this.unackedMessages.get(queueName) || [];
      const state = this.queueState.get(queueName) || {
        ready: 0,
        unacked: 0,
        total: 0,
        lastUpdate: now,
      };

      // Remove expired messages from ready queue (TTL)
      readyMessages = readyMessages.filter(msg => {
        if (msg.ttl && now > msg.ttl) {
          // Message expired, send to DLX if configured
          if (queue.deadLetterExchange) {
            this.routeToDeadLetterExchange(
              queue.deadLetterExchange,
              queue.deadLetterRoutingKey || msg.routingKey,
              msg.payload,
              msg.size,
              msg.headers,
              msg.priority
            );
          }
          return false;
        }
        return true;
      });
      this.queueMessages.set(queueName, readyMessages);

      // Calculate consumption rate
      const consumers = queue.consumers || 0;
      const consumptionRate = consumers * this.consumptionRate; // msgs/sec per consumer (configurable)
      const consumptionDelta = (consumptionRate * deltaTimeMs) / 1000;

      // Consume messages: move from ready queue to unacked (delivered to consumers)
      const toConsume = Math.min(consumptionDelta, readyMessages.length);
      const consumed = readyMessages.splice(0, toConsume);
      unackedMessages.push(...consumed);
      this.unackedMessages.set(queueName, unackedMessages);
      
      // Simulate ack: remove from unacked after processing
      // In real RabbitMQ, messages are acked after processing
      // Simplified: unacked messages are acked over time (processing time configurable)
      const ackRate = (deltaTimeMs / this.processingTime) * unackedMessages.length; // Process unacked messages
      const acked = Math.min(ackRate, unackedMessages.length);
      unackedMessages.splice(0, Math.floor(acked)); // Remove acked messages
      this.unackedMessages.set(queueName, unackedMessages);
      
      // Update state
      state.ready = readyMessages.length;
      state.unacked = unackedMessages.length;
      state.total = readyMessages.length + unackedMessages.length; // Total = ready + unacked
      state.lastUpdate = now;

      this.queueState.set(queueName, state);
    }
  }

  /**
   * Get queue metrics
   */
  public getQueueMetrics(queueName: string): {
    messages: number;
    ready: number;
    unacked: number;
    consumers: number;
  } | null {
    const queue = this.queues.get(queueName);
    if (!queue) return null;

    const readyMessages = this.queueMessages.get(queueName) || [];
    const unackedMessages = this.unackedMessages.get(queueName) || [];
    const state = this.queueState.get(queueName) || {
      ready: 0,
      unacked: 0,
      total: 0,
      lastUpdate: Date.now(),
    };

    // Ready = messages in queue (available to consume)
    // Unacked = messages delivered to consumers but not yet acked
    // Total = ready + unacked
    const ready = readyMessages.length;
    const unacked = unackedMessages.length;
    const total = ready + unacked;

    return {
      messages: total,
      ready: ready,
      unacked: unacked,
      consumers: queue.consumers || 0,
    };
  }

  /**
   * Get all queue metrics
   */
  public getAllQueueMetrics(): Map<string, {
    messages: number;
    ready: number;
    unacked: number;
    consumers: number;
  }> {
    const metrics = new Map();
    for (const queueName of this.queues.keys()) {
      const queueMetrics = this.getQueueMetrics(queueName);
      if (queueMetrics) {
        metrics.set(queueName, queueMetrics);
      }
    }
    return metrics;
  }

  /**
   * Get total queue depth (sum of all queue messages: ready + unacked)
   */
  public getTotalQueueDepth(): number {
    let total = 0;
    for (const readyMessages of this.queueMessages.values()) {
      total += readyMessages.length;
    }
    for (const unackedMessages of this.unackedMessages.values()) {
      total += unackedMessages.length;
    }
    return total;
  }

  /**
   * Get active connections count (estimated from producers/consumers)
   */
  public getActiveConnections(): number {
    let connections = 0;
    for (const queue of this.queues.values()) {
      if (queue.consumers) {
        connections += queue.consumers;
      }
    }
    // Add estimated producer connections (at least 1 per exchange with bindings)
    connections += this.exchanges.size;
    return Math.max(1, connections);
  }

  /**
   * Update queue configuration (e.g., consumers count)
   */
  public updateQueue(queueName: string, updates: Partial<Queue>): void {
    const queue = this.queues.get(queueName);
    if (queue) {
      Object.assign(queue, updates);
      this.queues.set(queueName, queue);
    }
  }
}


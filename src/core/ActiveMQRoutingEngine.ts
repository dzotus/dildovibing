/**
 * ActiveMQ Routing Engine
 * Handles message routing to queues (point-to-point) and topics (publish-subscribe)
 */

export interface ActiveMQQueue {
  name: string;
  queueSize?: number;
  consumerCount?: number;
  enqueueCount?: number;
  dequeueCount?: number;
  memoryUsage?: number;
  memoryPercent?: number;
}

export interface ActiveMQTopic {
  name: string;
  subscriberCount?: number;
  enqueueCount?: number;
  dequeueCount?: number;
  memoryUsage?: number;
  memoryPercent?: number;
}

export interface ActiveMQSubscription {
  id: string;
  destination: string;
  clientId: string;
  selector?: string;
  pendingQueueSize?: number;
  dispatchedQueueSize?: number;
  dispatchedCounter?: number;
  enqueueCounter?: number;
  dequeueCounter?: number;
}

export interface QueuedMessage {
  id: string;
  timestamp: number;
  destination: string; // queue or topic name
  payload: unknown;
  size: number;
  headers?: Record<string, unknown>;
  priority?: number;
  ttl?: number; // expiration timestamp
}

/**
 * ActiveMQ Routing Engine
 * Simulates ActiveMQ message routing behavior
 */
export class ActiveMQRoutingEngine {
  private queues: Map<string, ActiveMQQueue> = new Map();
  private topics: Map<string, ActiveMQTopic> = new Map();
  private subscriptions: Map<string, ActiveMQSubscription[]> = new Map(); // topic -> subscriptions
  private queueMessages: Map<string, QueuedMessage[]> = new Map(); // queue -> messages
  private topicMessages: Map<string, QueuedMessage[]> = new Map(); // topic -> messages (for non-durable subscriptions)
  private subscriptionMessages: Map<string, QueuedMessage[]> = new Map(); // subscriptionId -> messages (for durable subscriptions)
  private queueState: Map<string, {
    queueSize: number;
    consumerCount: number;
    enqueueCount: number;
    dequeueCount: number;
    lastUpdate: number;
  }> = new Map();
  private topicState: Map<string, {
    subscriberCount: number;
    enqueueCount: number;
    dequeueCount: number;
    lastUpdate: number;
  }> = new Map();

  /**
   * Initialize with ActiveMQ configuration
   */
  public initialize(config: {
    queues?: ActiveMQQueue[];
    topics?: ActiveMQTopic[];
    subscriptions?: ActiveMQSubscription[];
  }) {
    // Clear previous state
    this.queues.clear();
    this.topics.clear();
    this.subscriptions.clear();
    this.queueMessages.clear();
    this.topicMessages.clear();
    this.subscriptionMessages.clear();
    this.queueState.clear();
    this.topicState.clear();

    // Initialize queues
    if (config.queues) {
      for (const queue of config.queues) {
        this.queues.set(queue.name, { ...queue });
        this.queueMessages.set(queue.name, []);
        this.queueState.set(queue.name, {
          queueSize: queue.queueSize || 0,
          consumerCount: queue.consumerCount || 0,
          enqueueCount: queue.enqueueCount || 0,
          dequeueCount: queue.dequeueCount || 0,
          lastUpdate: Date.now(),
        });
      }
    }

    // Initialize topics
    if (config.topics) {
      for (const topic of config.topics) {
        this.topics.set(topic.name, { ...topic });
        this.topicMessages.set(topic.name, []);
        this.subscriptions.set(topic.name, []);
        this.topicState.set(topic.name, {
          subscriberCount: topic.subscriberCount || 0,
          enqueueCount: topic.enqueueCount || 0,
          dequeueCount: topic.dequeueCount || 0,
          lastUpdate: Date.now(),
        });
      }
    }

    // Initialize subscriptions
    if (config.subscriptions) {
      for (const subscription of config.subscriptions) {
        const topicSubscriptions = this.subscriptions.get(subscription.destination) || [];
        topicSubscriptions.push(subscription);
        this.subscriptions.set(subscription.destination, topicSubscriptions);
        this.subscriptionMessages.set(subscription.id, []);
      }
    }
  }

  /**
   * Route a message to a queue (point-to-point)
   */
  public routeToQueue(
    queueName: string,
    payload: unknown,
    size: number,
    headers?: Record<string, unknown>,
    priority?: number
  ): boolean {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return false; // Queue not found
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const queuedMessage: QueuedMessage = {
      id: messageId,
      timestamp: now,
      destination: queueName,
      payload,
      size,
      headers,
      priority,
    };

    const messages = this.queueMessages.get(queueName) || [];
    messages.push(queuedMessage);
    
    // Sort by priority if priority is set
    if (priority !== undefined) {
      messages.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }
    
    this.queueMessages.set(queueName, messages);

    // Update state
    const state = this.queueState.get(queueName) || {
      queueSize: 0,
      consumerCount: 0,
      enqueueCount: 0,
      dequeueCount: 0,
      lastUpdate: now,
    };
    state.queueSize = messages.length;
    state.enqueueCount = (state.enqueueCount || 0) + 1;
    state.lastUpdate = now;
    this.queueState.set(queueName, state);

    return true;
  }

  /**
   * Publish a message to a topic (publish-subscribe)
   */
  public publishToTopic(
    topicName: string,
    payload: unknown,
    size: number,
    headers?: Record<string, unknown>,
    priority?: number
  ): string[] {
    const topic = this.topics.get(topicName);
    if (!topic) {
      return []; // Topic not found
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    const subscriptions = this.subscriptions.get(topicName) || [];
    const matchedSubscriptionIds: string[] = [];

    // Create message
    const message: QueuedMessage = {
      id: messageId,
      timestamp: now,
      destination: topicName,
      payload,
      size,
      headers,
      priority,
    };

    // For each subscription, check selector and add message
    for (const subscription of subscriptions) {
      // Check selector if present
      if (subscription.selector && !this.matchesSelector(subscription.selector, headers)) {
        continue; // Skip this subscription
      }

      // Add message to subscription queue
      const subMessages = this.subscriptionMessages.get(subscription.id) || [];
      subMessages.push(message);
      this.subscriptionMessages.set(subscription.id, subMessages);
      matchedSubscriptionIds.push(subscription.id);

      // Update subscription state
      subscription.pendingQueueSize = (subscription.pendingQueueSize || 0) + 1;
      subscription.enqueueCounter = (subscription.enqueueCounter || 0) + 1;
    }

    // If no durable subscriptions, store in topic messages (for non-durable)
    if (subscriptions.length === 0) {
      const topicMessages = this.topicMessages.get(topicName) || [];
      topicMessages.push(message);
      this.topicMessages.set(topicName, topicMessages);
    }

    // Update topic state
    const state = this.topicState.get(topicName) || {
      subscriberCount: 0,
      enqueueCount: 0,
      dequeueCount: 0,
      lastUpdate: now,
    };
    state.enqueueCount = (state.enqueueCount || 0) + 1;
    state.lastUpdate = now;
    this.topicState.set(topicName, state);

    return matchedSubscriptionIds;
  }

  /**
   * Check if message matches subscription selector (simplified SQL-like selector)
   */
  private matchesSelector(selector: string, headers?: Record<string, unknown>): boolean {
    if (!headers || !selector) return true; // No selector or headers, match all

    // Simplified selector parsing - supports basic expressions like:
    // "priority > 5", "type = 'order'", "status IN ('pending', 'processing')"
    // This is a simplified implementation, real ActiveMQ selectors are more complex
    
    try {
      // Remove whitespace
      const cleanSelector = selector.trim();
      
      // Simple equality check: "key = 'value'"
      const equalityMatch = cleanSelector.match(/^(\w+)\s*=\s*['"]([^'"]+)['"]$/);
      if (equalityMatch) {
        const key = equalityMatch[1];
        const value = equalityMatch[2];
        return headers[key] === value;
      }

      // Simple comparison: "key > number" or "key < number"
      const comparisonMatch = cleanSelector.match(/^(\w+)\s*([><=]+)\s*(\d+)$/);
      if (comparisonMatch) {
        const key = comparisonMatch[1];
        const operator = comparisonMatch[2];
        const value = Number(comparisonMatch[3]);
        const headerValue = Number(headers[key]);
        
        if (isNaN(headerValue)) return false;
        
        switch (operator) {
          case '>': return headerValue > value;
          case '<': return headerValue < value;
          case '>=': return headerValue >= value;
          case '<=': return headerValue <= value;
          case '=': return headerValue === value;
          default: return false;
        }
      }

      // Default: if selector contains key from headers, consider it a match
      // This is a fallback for complex selectors
      for (const key in headers) {
        if (cleanSelector.includes(key)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      // If selector parsing fails, default to true (match all)
      return true;
    }
  }

  /**
   * Process queue consumption (simulate consumers)
   */
  public processConsumption(deltaTimeMs: number): void {
    const now = Date.now();

    // Process queues
    for (const [queueName, queue] of this.queues.entries()) {
      let messages = this.queueMessages.get(queueName) || [];
      const state = this.queueState.get(queueName) || {
        queueSize: 0,
        consumerCount: 0,
        enqueueCount: 0,
        dequeueCount: 0,
        lastUpdate: now,
      };

      // Remove expired messages (TTL)
      messages = messages.filter(msg => {
        if (msg.ttl && now > msg.ttl) {
          return false; // Message expired
        }
        return true;
      });
      this.queueMessages.set(queueName, messages);

      // Calculate consumption rate
      const consumers = queue.consumerCount || state.consumerCount || 0;
      const consumptionRate = consumers * 10; // 10 msgs/sec per consumer (configurable)
      const consumptionDelta = (consumptionRate * deltaTimeMs) / 1000;

      // Consume messages
      const toConsume = Math.min(consumptionDelta, messages.length);
      const consumed = messages.splice(0, Math.floor(toConsume));
      this.queueMessages.set(queueName, messages);

      // Update state
      state.queueSize = messages.length;
      state.dequeueCount = (state.dequeueCount || 0) + consumed.length;
      state.lastUpdate = now;
      this.queueState.set(queueName, state);
    }

    // Process topic subscriptions
    for (const [topicName, subscriptions] of this.subscriptions.entries()) {
      for (const subscription of subscriptions) {
        let messages = this.subscriptionMessages.get(subscription.id) || [];

        // Remove expired messages
        messages = messages.filter(msg => {
          if (msg.ttl && now > msg.ttl) {
            return false;
          }
          return true;
        });

        // Simulate consumption (simplified: 10 msgs/sec per subscription)
        const consumptionRate = 10; // msgs/sec per subscription
        const consumptionDelta = (consumptionRate * deltaTimeMs) / 1000;
        const toConsume = Math.min(consumptionDelta, messages.length);
        const consumed = messages.splice(0, Math.floor(toConsume));

        // Update subscription state
        subscription.pendingQueueSize = messages.length;
        subscription.dispatchedQueueSize = (subscription.dispatchedQueueSize || 0) + consumed.length;
        subscription.dequeueCounter = (subscription.dequeueCounter || 0) + consumed.length;

        this.subscriptionMessages.set(subscription.id, messages);
      }

      // Update topic state
      const state = this.topicState.get(topicName);
      if (state) {
        state.dequeueCount = subscriptions.reduce((sum, sub) => sum + (sub.dequeueCounter || 0), 0);
        state.lastUpdate = now;
      }
    }
  }

  /**
   * Get queue metrics
   */
  public getQueueMetrics(queueName: string): {
    queueSize: number;
    consumerCount: number;
    enqueueCount: number;
    dequeueCount: number;
  } | null {
    const queue = this.queues.get(queueName);
    if (!queue) return null;

    const state = this.queueState.get(queueName);
    if (!state) return null;

    return {
      queueSize: state.queueSize,
      consumerCount: state.consumerCount,
      enqueueCount: state.enqueueCount,
      dequeueCount: state.dequeueCount,
    };
  }

  /**
   * Get topic metrics
   */
  public getTopicMetrics(topicName: string): {
    subscriberCount: number;
    enqueueCount: number;
    dequeueCount: number;
  } | null {
    const topic = this.topics.get(topicName);
    if (!topic) return null;

    const state = this.topicState.get(topicName);
    if (!state) return null;

    return {
      subscriberCount: state.subscriberCount,
      enqueueCount: state.enqueueCount,
      dequeueCount: state.dequeueCount,
    };
  }

  /**
   * Get all queue metrics
   */
  public getAllQueueMetrics(): Map<string, {
    queueSize: number;
    consumerCount: number;
    enqueueCount: number;
    dequeueCount: number;
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
   * Get all topic metrics
   */
  public getAllTopicMetrics(): Map<string, {
    subscriberCount: number;
    enqueueCount: number;
    dequeueCount: number;
  }> {
    const metrics = new Map();
    for (const topicName of this.topics.keys()) {
      const topicMetrics = this.getTopicMetrics(topicName);
      if (topicMetrics) {
        metrics.set(topicName, topicMetrics);
      }
    }
    return metrics;
  }

  /**
   * Get total queue depth (sum of all queue messages)
   */
  public getTotalQueueDepth(): number {
    let total = 0;
    for (const messages of this.queueMessages.values()) {
      total += messages.length;
    }
    return total;
  }

  /**
   * Get total topic messages (sum of all subscription messages)
   */
  public getTotalTopicMessages(): number {
    let total = 0;
    for (const messages of this.subscriptionMessages.values()) {
      total += messages.length;
    }
    for (const messages of this.topicMessages.values()) {
      total += messages.length;
    }
    return total;
  }

  /**
   * Get active connections count (estimated from consumers/subscribers)
   */
  public getActiveConnections(): number {
    let connections = 0;
    
    // Count consumers
    for (const queue of this.queues.values()) {
      if (queue.consumerCount) {
        connections += queue.consumerCount;
      }
    }
    
    // Count subscribers
    for (const subscriptions of this.subscriptions.values()) {
      connections += subscriptions.length;
    }
    
    // Add estimated producer connections (at least 1)
    return Math.max(1, connections + 1);
  }

  /**
   * Update queue configuration (e.g., consumerCount)
   */
  public updateQueue(queueName: string, updates: Partial<ActiveMQQueue>): void {
    const queue = this.queues.get(queueName);
    if (queue) {
      Object.assign(queue, updates);
      this.queues.set(queueName, queue);
      
      // Update state
      const state = this.queueState.get(queueName);
      if (state && updates.consumerCount !== undefined) {
        state.consumerCount = updates.consumerCount;
      }
    }
  }

  /**
   * Update topic configuration
   */
  public updateTopic(topicName: string, updates: Partial<ActiveMQTopic>): void {
    const topic = this.topics.get(topicName);
    if (topic) {
      Object.assign(topic, updates);
      this.topics.set(topicName, topic);
      
      // Update state
      const state = this.topicState.get(topicName);
      if (state && updates.subscriberCount !== undefined) {
        state.subscriberCount = updates.subscriberCount;
      }
    }
  }
}




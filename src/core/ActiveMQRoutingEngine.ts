/**
 * ActiveMQ Routing Engine
 * Handles message routing to queues (point-to-point) and topics (publish-subscribe)
 */

export interface RedeliveryPolicy {
  maxRedeliveries?: number; // Maximum number of redelivery attempts before sending to DLQ (default: 6)
  initialRedeliveryDelay?: number; // Initial delay before redelivery in milliseconds (default: 1000)
  maximumRedeliveryDelay?: number; // Maximum delay before redelivery in milliseconds (default: 60000)
  useExponentialBackOff?: boolean; // Use exponential backoff for redelivery delay (default: false)
  backOffMultiplier?: number; // Multiplier for exponential backoff (default: 2)
}

export interface ActiveMQQueue {
  name: string;
  queueSize?: number;
  consumerCount?: number;
  enqueueCount?: number;
  dequeueCount?: number;
  memoryUsage?: number;
  memoryPercent?: number;
  memoryLimit?: number; // Memory limit in MB for this queue
  prefetch?: number; // Prefetch size for consumers
  defaultPriority?: number; // Default message priority (0-9)
  defaultTTL?: number; // Default message TTL in seconds
  maxRedeliveries?: number; // Maximum number of redelivery attempts before sending to DLQ (default: 6) - DEPRECATED: use redeliveryPolicy
  redeliveryPolicy?: RedeliveryPolicy; // Redelivery policy configuration
}

export interface ActiveMQTopic {
  name: string;
  subscriberCount?: number;
  enqueueCount?: number;
  dequeueCount?: number;
  memoryUsage?: number;
  memoryPercent?: number;
  memoryLimit?: number; // Memory limit in MB for this topic
  defaultPriority?: number; // Default message priority (0-9)
  defaultTTL?: number; // Default message TTL in seconds
  maxRedeliveries?: number; // Maximum number of redelivery attempts before sending to DLQ (default: 6) - DEPRECATED: use redeliveryPolicy
  redeliveryPolicy?: RedeliveryPolicy; // Redelivery policy configuration
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
  durable?: boolean; // Whether this is a durable subscription
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
  deliveryCount?: number; // Number of delivery attempts
  redelivered?: boolean; // Whether message was redelivered
  redeliveryTime?: number; // Timestamp when message should be redelivered (for redelivery delay)
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
  private deadLetterQueue: QueuedMessage[] = []; // Dead Letter Queue messages
  private deadLetterQueueName: string = 'DLQ'; // Default DLQ name
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
  private consumptionRate: number = 10; // messages per second per consumer (default: 10, configurable)

  /**
   * Initialize with ActiveMQ configuration
   */
  public initialize(config: {
    queues?: ActiveMQQueue[];
    topics?: ActiveMQTopic[];
    subscriptions?: ActiveMQSubscription[];
    consumptionRate?: number; // messages per second per consumer
    deadLetterQueue?: string; // Dead Letter Queue name (default: 'DLQ')
  }) {
    // Set consumption rate if provided
    if (config.consumptionRate !== undefined) {
      this.consumptionRate = config.consumptionRate;
    }
    // Set DLQ name if provided
    if (config.deadLetterQueue !== undefined) {
      this.deadLetterQueueName = config.deadLetterQueue;
    }
    // Clear previous state
    this.queues.clear();
    this.topics.clear();
    this.subscriptions.clear();
    this.queueMessages.clear();
    this.topicMessages.clear();
    this.subscriptionMessages.clear();
    this.deadLetterQueue = [];
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
    priority?: number,
    ttl?: number // TTL in seconds (if provided, overrides defaultTTL)
  ): boolean {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return false; // Queue not found
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    // Apply defaultPriority if priority not provided
    const messagePriority = priority !== undefined ? priority : (queue.defaultPriority !== undefined ? queue.defaultPriority : undefined);
    
    // Apply defaultTTL if ttl not provided
    const messageTTL = ttl !== undefined ? ttl : (queue.defaultTTL !== undefined ? queue.defaultTTL : undefined);
    
    // Calculate expiration timestamp if TTL is set
    const expirationTime = messageTTL && messageTTL > 0 ? now + (messageTTL * 1000) : undefined;

    // Check memory limit before adding message
    const messages = this.queueMessages.get(queueName) || [];
    const currentMemoryUsage = messages.reduce((sum, msg) => sum + msg.size, 0);
    const memoryLimitBytes = queue.memoryLimit ? queue.memoryLimit * 1024 * 1024 : undefined; // Convert MB to bytes
    
    if (memoryLimitBytes && (currentMemoryUsage + size) > memoryLimitBytes) {
      // Memory limit reached - move to DLQ or reject
      const dlqMessage: QueuedMessage = {
        id: messageId,
        timestamp: now,
        destination: this.deadLetterQueueName,
        payload,
        size,
        headers: {
          ...headers,
          'originalDestination': queueName,
          'reason': 'memoryLimitExceeded',
          'memoryUsage': currentMemoryUsage,
          'memoryLimit': memoryLimitBytes,
          'movedToDLQAt': now,
        },
        priority: messagePriority,
        ttl: expirationTime,
      };
      this.deadLetterQueue.push(dlqMessage);
      return false; // Message rejected due to memory limit
    }

    const queuedMessage: QueuedMessage = {
      id: messageId,
      timestamp: now,
      destination: queueName,
      payload,
      size,
      headers,
      priority: messagePriority,
      ttl: expirationTime,
    };

    messages.push(queuedMessage);
    
    // Sort by priority (higher priority first)
    messages.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
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
    priority?: number,
    ttl?: number // TTL in seconds (if provided, overrides defaultTTL)
  ): string[] {
    const topic = this.topics.get(topicName);
    if (!topic) {
      return []; // Topic not found
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    const subscriptions = this.subscriptions.get(topicName) || [];
    const matchedSubscriptionIds: string[] = [];

    // Apply defaultPriority if priority not provided
    const messagePriority = priority !== undefined ? priority : (topic.defaultPriority !== undefined ? topic.defaultPriority : undefined);
    
    // Apply defaultTTL if ttl not provided
    const messageTTL = ttl !== undefined ? ttl : (topic.defaultTTL !== undefined ? topic.defaultTTL : undefined);
    
    // Calculate expiration timestamp if TTL is set
    const expirationTime = messageTTL && messageTTL > 0 ? now + (messageTTL * 1000) : undefined;

    // Create message
    const message: QueuedMessage = {
      id: messageId,
      timestamp: now,
      destination: topicName,
      payload,
      size,
      headers,
      priority: messagePriority,
      ttl: expirationTime,
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
   * Calculate redelivery delay based on redelivery policy
   */
  private calculateRedeliveryDelay(
    deliveryCount: number,
    policy?: RedeliveryPolicy
  ): number {
    if (!policy) {
      return 0; // No delay if no policy
    }

    const maxRedeliveries = policy.maxRedeliveries ?? 6;
    const initialDelay = policy.initialRedeliveryDelay ?? 1000;
    const maximumDelay = policy.maximumRedeliveryDelay ?? 60000;
    const useExponentialBackOff = policy.useExponentialBackOff ?? false;
    const backOffMultiplier = policy.backOffMultiplier ?? 2;

    if (deliveryCount <= 1) {
      return 0; // First delivery, no delay
    }

    let delay = initialDelay;

    if (useExponentialBackOff) {
      // Exponential backoff: delay = initialDelay * (backOffMultiplier ^ (deliveryCount - 2))
      delay = initialDelay * Math.pow(backOffMultiplier, deliveryCount - 2);
    } else {
      // Linear: delay = initialDelay * (deliveryCount - 1)
      delay = initialDelay * (deliveryCount - 1);
    }

    // Cap at maximum delay
    return Math.min(delay, maximumDelay);
  }

  /**
   * Get effective redelivery policy from queue/topic (supports both old and new format)
   */
  private getRedeliveryPolicy(queueOrTopic: ActiveMQQueue | ActiveMQTopic): RedeliveryPolicy {
    if (queueOrTopic.redeliveryPolicy) {
      return queueOrTopic.redeliveryPolicy;
    }
    
    // Fallback to deprecated maxRedeliveries for backward compatibility
    return {
      maxRedeliveries: queueOrTopic.maxRedeliveries ?? 6,
      initialRedeliveryDelay: 1000,
      maximumRedeliveryDelay: 60000,
      useExponentialBackOff: false,
      backOffMultiplier: 2,
    };
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

      const redeliveryPolicy = this.getRedeliveryPolicy(queue);
      const maxRedeliveries = redeliveryPolicy.maxRedeliveries ?? 6;

      // Process expired messages - move to DLQ if expired
      const expiredMessages: QueuedMessage[] = [];
      messages = messages.filter(msg => {
        if (msg.ttl && now > msg.ttl) {
          // Message expired - move to DLQ
          expiredMessages.push(msg);
          return false;
        }
        return true;
      });
      
      // Move expired messages to DLQ
      for (const expiredMsg of expiredMessages) {
        expiredMsg.destination = this.deadLetterQueueName;
        expiredMsg.headers = {
          ...expiredMsg.headers,
          'originalDestination': queueName,
          'reason': 'expired',
          'expiredAt': now,
        };
        this.deadLetterQueue.push(expiredMsg);
      }
      
      // Filter messages ready for delivery (respect redelivery delay)
      const readyMessages = messages.filter(msg => {
        if (msg.redeliveryTime === undefined) {
          return true; // Message is ready (first delivery or no redelivery delay)
        }
        return now >= msg.redeliveryTime; // Message is ready if redelivery time has passed
      });
      
      const waitingMessages = messages.filter(msg => {
        if (msg.redeliveryTime === undefined) {
          return false;
        }
        return now < msg.redeliveryTime; // Message is waiting for redelivery
      });
      
      this.queueMessages.set(queueName, [...readyMessages, ...waitingMessages]);

      // Calculate consumption rate with prefetch consideration
      const consumers = queue.consumerCount || state.consumerCount || 0;
      const prefetch = queue.prefetch ?? 0; // 0 means no prefetch limit
      
      const consumptionRate = consumers * this.consumptionRate; // msgs/sec per consumer (configurable)
      const consumptionDelta = (consumptionRate * deltaTimeMs) / 1000;
      
      // Calculate total available messages considering prefetch
      let availableMessages = readyMessages.length;
      if (prefetch > 0 && consumers > 0) {
        // With prefetch, each consumer can have at most prefetch messages in flight
        // Limit total available messages to consumers * prefetch
        const maxPrefetchMessages = consumers * prefetch;
        availableMessages = Math.min(readyMessages.length, maxPrefetchMessages);
      }
      
      const toConsume = Math.min(consumptionDelta, availableMessages);
      
      // Consume messages (only from ready messages)
      const consumed = readyMessages.splice(0, Math.floor(toConsume));
      
      // Simulate delivery failures (random failures ~0.1% chance)
      const failedMessages: QueuedMessage[] = [];
      const successfulMessages: QueuedMessage[] = [];
      
      for (const msg of consumed) {
        // Initialize delivery count if not set
        if (msg.deliveryCount === undefined) {
          msg.deliveryCount = 0;
        }
        
        // Increment delivery count
        msg.deliveryCount++;
        msg.redelivered = msg.deliveryCount > 1;
        
        // Simulate random delivery failure (0.1% chance)
        const deliveryFailure = Math.random() < 0.001;
        
        if (deliveryFailure && msg.deliveryCount <= maxRedeliveries) {
          // Delivery failed, but within redelivery limit - schedule redelivery with delay
          const redeliveryDelay = this.calculateRedeliveryDelay(msg.deliveryCount, redeliveryPolicy);
          msg.redeliveryTime = now + redeliveryDelay;
          failedMessages.push(msg);
        } else if (msg.deliveryCount > maxRedeliveries) {
          // Exceeded max redeliveries - move to DLQ
          msg.destination = this.deadLetterQueueName;
          msg.headers = {
            ...msg.headers,
            'originalDestination': queueName,
            'reason': 'maxRedeliveriesExceeded',
            'deliveryCount': msg.deliveryCount,
            'movedToDLQAt': now,
          };
          this.deadLetterQueue.push(msg);
        } else {
          // Successfully consumed - clear redelivery time
          msg.redeliveryTime = undefined;
          successfulMessages.push(msg);
        }
      }
      
      // Put failed messages back in queue (for redelivery with delay)
      // Combine ready messages (remaining), failed messages (with redelivery delay), and waiting messages
      const allMessages = [...readyMessages, ...failedMessages, ...waitingMessages];
      // Sort by priority, then by redelivery time (messages without redelivery time first)
      allMessages.sort((a, b) => {
        // First sort by priority (higher priority first)
        const priorityDiff = (b.priority || 0) - (a.priority || 0);
        if (priorityDiff !== 0) return priorityDiff;
        
        // Then sort by redelivery time (messages ready for delivery first)
        if (a.redeliveryTime === undefined && b.redeliveryTime === undefined) return 0;
        if (a.redeliveryTime === undefined) return -1;
        if (b.redeliveryTime === undefined) return 1;
        return a.redeliveryTime - b.redeliveryTime;
      });
      
      messages = allMessages;
      
      this.queueMessages.set(queueName, messages);

      // Update state
      state.queueSize = messages.length;
      state.dequeueCount = (state.dequeueCount || 0) + successfulMessages.length;
      state.lastUpdate = now;
      this.queueState.set(queueName, state);
    }

    // Process topic subscriptions
    for (const [topicName, subscriptions] of this.subscriptions.entries()) {
      const topic = this.topics.get(topicName);
      if (!topic) continue;
      
      const redeliveryPolicy = this.getRedeliveryPolicy(topic);
      const maxRedeliveries = redeliveryPolicy.maxRedeliveries ?? 6;
      
      for (const subscription of subscriptions) {
        let messages = this.subscriptionMessages.get(subscription.id) || [];

        // Process expired messages - move to DLQ if expired
        const expiredMessages: QueuedMessage[] = [];
        messages = messages.filter(msg => {
          if (msg.ttl && now > msg.ttl) {
            // Message expired - move to DLQ
            expiredMessages.push(msg);
            return false;
          }
          return true;
        });
        
        // Move expired messages to DLQ
        for (const expiredMsg of expiredMessages) {
          expiredMsg.destination = this.deadLetterQueueName;
          expiredMsg.headers = {
            ...expiredMsg.headers,
            'originalDestination': topicName,
            'subscriptionId': subscription.id,
            'reason': 'expired',
            'expiredAt': now,
          };
          this.deadLetterQueue.push(expiredMsg);
        }

        // Filter messages ready for delivery (respect redelivery delay)
        const readyMessages = messages.filter(msg => {
          if (msg.redeliveryTime === undefined) {
            return true; // Message is ready (first delivery or no redelivery delay)
          }
          return now >= msg.redeliveryTime; // Message is ready if redelivery time has passed
        });
        
        const waitingMessages = messages.filter(msg => {
          if (msg.redeliveryTime === undefined) {
            return false;
          }
          return now < msg.redeliveryTime; // Message is waiting for redelivery
        });

        // Simulate consumption (use configurable consumption rate)
        // Note: Topics don't have prefetch per subscription, but we respect consumption rate
        const consumptionRate = this.consumptionRate; // msgs/sec per subscription
        const consumptionDelta = (consumptionRate * deltaTimeMs) / 1000;
        const toConsume = Math.min(consumptionDelta, readyMessages.length);
        const consumed = readyMessages.splice(0, Math.floor(toConsume));
        
        // Simulate delivery failures (random failures ~0.1% chance)
        const failedMessages: QueuedMessage[] = [];
        const successfulMessages: QueuedMessage[] = [];
        
        for (const msg of consumed) {
          // Initialize delivery count if not set
          if (msg.deliveryCount === undefined) {
            msg.deliveryCount = 0;
          }
          
          // Increment delivery count
          msg.deliveryCount++;
          msg.redelivered = msg.deliveryCount > 1;
          
          // Simulate random delivery failure (0.1% chance)
          const deliveryFailure = Math.random() < 0.001;
          
          if (deliveryFailure && msg.deliveryCount <= maxRedeliveries) {
            // Delivery failed, but within redelivery limit - schedule redelivery with delay
            const redeliveryDelay = this.calculateRedeliveryDelay(msg.deliveryCount, redeliveryPolicy);
            msg.redeliveryTime = now + redeliveryDelay;
            failedMessages.push(msg);
          } else if (msg.deliveryCount > maxRedeliveries) {
            // Exceeded max redeliveries - move to DLQ
            msg.destination = this.deadLetterQueueName;
            msg.headers = {
              ...msg.headers,
              'originalDestination': topicName,
              'subscriptionId': subscription.id,
              'reason': 'maxRedeliveriesExceeded',
              'deliveryCount': msg.deliveryCount,
              'movedToDLQAt': now,
            };
            this.deadLetterQueue.push(msg);
          } else {
            // Successfully consumed - clear redelivery time
            msg.redeliveryTime = undefined;
            successfulMessages.push(msg);
          }
        }
        
        // Put failed messages back in subscription queue (for redelivery with delay)
        // Combine ready messages (remaining), failed messages (with redelivery delay), and waiting messages
        const allMessages = [...readyMessages, ...failedMessages, ...waitingMessages];
        // Sort by priority, then by redelivery time (messages without redelivery time first)
        allMessages.sort((a, b) => {
          // First sort by priority (higher priority first)
          const priorityDiff = (b.priority || 0) - (a.priority || 0);
          if (priorityDiff !== 0) return priorityDiff;
          
          // Then sort by redelivery time (messages ready for delivery first)
          if (a.redeliveryTime === undefined && b.redeliveryTime === undefined) return 0;
          if (a.redeliveryTime === undefined) return -1;
          if (b.redeliveryTime === undefined) return 1;
          return a.redeliveryTime - b.redeliveryTime;
        });
        
        messages = allMessages;

        // Update subscription state
        subscription.pendingQueueSize = messages.length;
        subscription.dispatchedQueueSize = (subscription.dispatchedQueueSize || 0) + successfulMessages.length;
        subscription.dequeueCounter = (subscription.dequeueCounter || 0) + successfulMessages.length;

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

  /**
   * Get store usage (persistent messages) in bytes
   */
  public getStoreUsage(persistenceEnabled: boolean): number {
    if (!persistenceEnabled) {
      return 0; // No persistent storage if persistence is disabled
    }
    
    let totalSize = 0;
    // Count persistent messages in queues
    for (const messages of this.queueMessages.values()) {
      for (const msg of messages) {
        totalSize += msg.size;
      }
    }
    // Count persistent messages in subscriptions (durable subscriptions)
    for (const messages of this.subscriptionMessages.values()) {
      for (const msg of messages) {
        totalSize += msg.size;
      }
    }
    return totalSize;
  }

  /**
   * Get temp usage (non-persistent messages) in bytes
   */
  public getTempUsage(persistenceEnabled: boolean): number {
    if (persistenceEnabled) {
      return 0; // All messages are persistent if persistence is enabled
    }
    
    let totalSize = 0;
    // Count non-persistent messages in queues
    for (const messages of this.queueMessages.values()) {
      for (const msg of messages) {
        totalSize += msg.size;
      }
    }
    // Count non-persistent messages in topics (non-durable subscriptions)
    for (const messages of this.topicMessages.values()) {
      for (const msg of messages) {
        totalSize += msg.size;
      }
    }
    return totalSize;
  }

  /**
   * Get Dead Letter Queue messages
   */
  public getDeadLetterQueueMessages(): QueuedMessage[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Get Dead Letter Queue size
   */
  public getDeadLetterQueueSize(): number {
    return this.deadLetterQueue.length;
  }

  /**
   * Get Dead Letter Queue name
   */
  public getDeadLetterQueueName(): string {
    return this.deadLetterQueueName;
  }

  /**
   * Clear Dead Letter Queue
   */
  public clearDeadLetterQueue(): void {
    this.deadLetterQueue = [];
  }

  /**
   * Remove message from Dead Letter Queue by ID
   */
  public removeFromDeadLetterQueue(messageId: string): boolean {
    const index = this.deadLetterQueue.findIndex(msg => msg.id === messageId);
    if (index !== -1) {
      this.deadLetterQueue.splice(index, 1);
      return true;
    }
    return false;
  }
}




















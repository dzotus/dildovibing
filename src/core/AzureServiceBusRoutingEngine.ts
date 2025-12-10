/**
 * Azure Service Bus Routing Engine
 * Handles message routing to queues (point-to-point) and topics (publish-subscribe)
 * with support for peek-lock, dead letter queue, sessions, and scheduled messages
 */

export interface ServiceBusQueue {
  name: string;
  namespace: string;
  maxSizeInMegabytes: number;
  defaultMessageTimeToLive: number; // seconds
  lockDuration: number; // seconds
  maxDeliveryCount: number;
  enablePartitioning: boolean;
  enableDeadLetteringOnMessageExpiration: boolean;
  enableSessions: boolean;
  activeMessageCount?: number;
  deadLetterMessageCount?: number;
  scheduledMessageCount?: number;
}

export interface ServiceBusTopic {
  name: string;
  namespace: string;
  maxSizeInMegabytes: number;
  defaultMessageTimeToLive: number; // seconds
  enablePartitioning: boolean;
  subscriptions?: ServiceBusSubscription[];
}

export interface ServiceBusSubscription {
  name: string;
  maxDeliveryCount: number;
  lockDuration: number; // seconds
  enableDeadLetteringOnMessageExpiration: boolean;
  activeMessageCount?: number;
}

export interface ServiceBusMessage {
  id: string;
  messageId: string; // Service Bus message ID
  lockToken?: string; // for peek-lock pattern
  timestamp: number;
  destination: string; // queue or topic name
  subscriptionName?: string; // for topic subscriptions
  payload: unknown;
  size: number;
  properties?: Record<string, unknown>; // message properties
  sessionId?: string; // for sessions
  scheduledEnqueueTime?: number; // for scheduled messages
  expirationTime: number; // when message expires (TTL)
  deliveryCount: number; // how many times message was delivered
  enqueuedTime: number; // when message was enqueued
  lockedUntil?: number; // when lock expires (peek-lock)
}

export interface LockedMessage {
  message: ServiceBusMessage;
  lockedAt: number;
  lockExpiresAt: number;
}

/**
 * Azure Service Bus Routing Engine
 * Simulates Azure Service Bus message routing behavior
 */
export class AzureServiceBusRoutingEngine {
  private queues: Map<string, ServiceBusQueue> = new Map();
  private topics: Map<string, ServiceBusTopic> = new Map();
  private subscriptions: Map<string, ServiceBusSubscription[]> = new Map(); // topic -> subscriptions
  private queueMessages: Map<string, ServiceBusMessage[]> = new Map(); // queue -> available messages
  private topicMessages: Map<string, ServiceBusMessage[]> = new Map(); // topic -> messages (for subscriptions)
  private subscriptionMessages: Map<string, ServiceBusMessage[]> = new Map(); // subscriptionId -> messages
  private lockedMessages: Map<string, LockedMessage[]> = new Map(); // queue/subscription -> locked messages
  private deadLetterMessages: Map<string, ServiceBusMessage[]> = new Map(); // queue/subscription -> dead letter messages
  private scheduledMessages: Map<string, ServiceBusMessage[]> = new Map(); // queue/topic -> scheduled messages
  private sessionMessages: Map<string, Map<string, ServiceBusMessage[]>> = new Map(); // queue/subscription -> sessionId -> messages
  
  private queueState: Map<string, {
    activeMessageCount: number;
    deadLetterMessageCount: number;
    scheduledMessageCount: number;
    sentCount: number;
    receivedCount: number;
    completedCount: number;
    abandonedCount: number;
    lastUpdate: number;
  }> = new Map();
  
  private subscriptionState: Map<string, {
    activeMessageCount: number;
    deadLetterMessageCount: number;
    sentCount: number;
    receivedCount: number;
    completedCount: number;
    abandonedCount: number;
    lastUpdate: number;
  }> = new Map();

  /**
   * Initialize with Azure Service Bus configuration
   */
  public initialize(config: {
    queues?: ServiceBusQueue[];
    topics?: ServiceBusTopic[];
  }) {
    // Clear previous state
    this.queues.clear();
    this.topics.clear();
    this.subscriptions.clear();
    this.queueMessages.clear();
    this.topicMessages.clear();
    this.subscriptionMessages.clear();
    this.lockedMessages.clear();
    this.deadLetterMessages.clear();
    this.scheduledMessages.clear();
    this.sessionMessages.clear();
    this.queueState.clear();
    this.subscriptionState.clear();

    // Initialize queues
    if (config.queues) {
      for (const queue of config.queues) {
        this.queues.set(queue.name, { ...queue });
        this.queueMessages.set(queue.name, []);
        this.lockedMessages.set(queue.name, []);
        this.deadLetterMessages.set(queue.name, []);
        this.scheduledMessages.set(queue.name, []);
        this.queueState.set(queue.name, {
          activeMessageCount: queue.activeMessageCount || 0,
          deadLetterMessageCount: queue.deadLetterMessageCount || 0,
          scheduledMessageCount: queue.scheduledMessageCount || 0,
          sentCount: 0,
          receivedCount: 0,
          completedCount: 0,
          abandonedCount: 0,
          lastUpdate: Date.now(),
        });
        
        // Initialize session messages if sessions enabled
        if (queue.enableSessions) {
          this.sessionMessages.set(queue.name, new Map());
        }
      }
    }

    // Initialize topics
    if (config.topics) {
      for (const topic of config.topics) {
        this.topics.set(topic.name, { ...topic });
        this.topicMessages.set(topic.name, []);
        this.scheduledMessages.set(topic.name, []);
        this.subscriptions.set(topic.name, []);
        
        // Initialize subscriptions
        if (topic.subscriptions) {
          for (const subscription of topic.subscriptions) {
            const topicSubscriptions = this.subscriptions.get(topic.name) || [];
            topicSubscriptions.push(subscription);
            this.subscriptions.set(topic.name, topicSubscriptions);
            
            const subscriptionId = `${topic.name}/subscriptions/${subscription.name}`;
            this.subscriptionMessages.set(subscriptionId, []);
            this.lockedMessages.set(subscriptionId, []);
            this.deadLetterMessages.set(subscriptionId, []);
            this.subscriptionState.set(subscriptionId, {
              activeMessageCount: subscription.activeMessageCount || 0,
              deadLetterMessageCount: 0,
              sentCount: 0,
              receivedCount: 0,
              completedCount: 0,
              abandonedCount: 0,
              lastUpdate: Date.now(),
            });
            
            // Initialize session messages if sessions enabled (for subscriptions)
            // Note: sessions are typically used with queues, but can be used with subscriptions
            this.sessionMessages.set(subscriptionId, new Map());
          }
        }
      }
    }
  }

  /**
   * Send message to queue (point-to-point)
   */
  public sendToQueue(
    queueName: string,
    payload: unknown,
    size: number,
    properties?: Record<string, unknown>,
    sessionId?: string,
    scheduledEnqueueTime?: number
  ): string | null {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return null; // Queue not found
    }

    const now = Date.now();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const serviceBusMessageId = `${queueName}-${messageId}`;

    // Calculate expiration time (TTL)
    const ttlMs = queue.defaultMessageTimeToLive * 1000;
    const expirationTime = now + ttlMs;

    const message: ServiceBusMessage = {
      id: messageId,
      messageId: serviceBusMessageId,
      timestamp: now,
      destination: queueName,
      payload,
      size,
      properties,
      sessionId,
      scheduledEnqueueTime,
      expirationTime,
      deliveryCount: 0,
      enqueuedTime: scheduledEnqueueTime || now,
    };

    // Check if message is scheduled
    if (scheduledEnqueueTime && scheduledEnqueueTime > now) {
      const scheduled = this.scheduledMessages.get(queueName) || [];
      scheduled.push(message);
      this.scheduledMessages.set(queueName, scheduled);
      
      const state = this.queueState.get(queueName);
      if (state) {
        state.scheduledMessageCount = scheduled.length;
      }
      return serviceBusMessageId;
    }

    // Add to queue (or session if sessions enabled)
    if (queue.enableSessions && sessionId) {
      const sessions = this.sessionMessages.get(queueName);
      if (sessions) {
        const sessionMessages = sessions.get(sessionId) || [];
        sessionMessages.push(message);
        sessions.set(sessionId, sessionMessages);
      }
    } else {
      const messages = this.queueMessages.get(queueName) || [];
      messages.push(message);
      this.queueMessages.set(queueName, messages);
    }

    // Update state
    const state = this.queueState.get(queueName);
    if (state) {
      const available = this.getAvailableMessages(queueName);
      state.activeMessageCount = available.length;
      state.sentCount = (state.sentCount || 0) + 1;
      state.lastUpdate = now;
    }

    return serviceBusMessageId;
  }

  /**
   * Publish message to topic (publish-subscribe)
   */
  public publishToTopic(
    topicName: string,
    payload: unknown,
    size: number,
    properties?: Record<string, unknown>,
    scheduledEnqueueTime?: number
  ): string[] {
    const topic = this.topics.get(topicName);
    if (!topic) {
      return []; // Topic not found
    }

    const now = Date.now();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const serviceBusMessageId = `${topicName}-${messageId}`;

    // Calculate expiration time (TTL)
    const ttlMs = topic.defaultMessageTimeToLive * 1000;
    const expirationTime = now + ttlMs;

    const message: ServiceBusMessage = {
      id: messageId,
      messageId: serviceBusMessageId,
      timestamp: now,
      destination: topicName,
      payload,
      size,
      properties,
      scheduledEnqueueTime,
      expirationTime,
      deliveryCount: 0,
      enqueuedTime: scheduledEnqueueTime || now,
    };

    const subscriptionIds: string[] = [];

    // Check if message is scheduled
    if (scheduledEnqueueTime && scheduledEnqueueTime > now) {
      const scheduled = this.scheduledMessages.get(topicName) || [];
      scheduled.push(message);
      this.scheduledMessages.set(topicName, scheduled);
      return [serviceBusMessageId];
    }

    // Get subscriptions for this topic
    const subscriptions = this.subscriptions.get(topicName) || [];
    
    if (subscriptions.length === 0) {
      // No subscriptions, message is lost (or could be stored for future subscriptions)
      return [];
    }

    // Deliver message to each subscription
    for (const subscription of subscriptions) {
      const subscriptionId = `${topicName}/subscriptions/${subscription.name}`;
      const subMessages = this.subscriptionMessages.get(subscriptionId) || [];
      
      // Create a copy of message for each subscription
      const subMessage: ServiceBusMessage = {
        ...message,
        id: `${messageId}-${subscription.name}`,
        messageId: `${serviceBusMessageId}-${subscription.name}`,
        subscriptionName: subscription.name,
      };
      
      subMessages.push(subMessage);
      this.subscriptionMessages.set(subscriptionId, subMessages);
      subscriptionIds.push(subMessage.messageId);

      // Update subscription state
      const state = this.subscriptionState.get(subscriptionId);
      if (state) {
        const available = this.getAvailableSubscriptionMessages(subscriptionId);
        state.activeMessageCount = available.length;
        state.sentCount = (state.sentCount || 0) + 1;
        state.lastUpdate = now;
      }
    }

    return subscriptionIds;
  }

  /**
   * Receive message from queue (peek-lock pattern)
   */
  public receiveFromQueue(
    queueName: string,
    lockDuration?: number,
    sessionId?: string
  ): ServiceBusMessage | null {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return null; // Queue not found
    }

    const now = Date.now();
    const lockDurationMs = (lockDuration || queue.lockDuration) * 1000;
    const lockExpiresAt = now + lockDurationMs;

    // Get available messages
    let messages: ServiceBusMessage[];
    if (queue.enableSessions && sessionId) {
      // Get messages from session
      const sessions = this.sessionMessages.get(queueName);
      if (!sessions) return null;
      messages = sessions.get(sessionId) || [];
    } else {
      messages = this.getAvailableMessages(queueName);
    }

    if (messages.length === 0) {
      return null; // No messages available
    }

    // Get first message (FIFO)
    const message = messages.shift()!;
    
    // Update message delivery count
    message.deliveryCount = (message.deliveryCount || 0) + 1;
    message.lockedUntil = lockExpiresAt;
    message.lockToken = `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Move to locked messages
    const locked = this.lockedMessages.get(queueName) || [];
    locked.push({
      message,
      lockedAt: now,
      lockExpiresAt,
    });
    this.lockedMessages.set(queueName, locked);

    // Update session messages if using sessions
    if (queue.enableSessions && sessionId) {
      const sessions = this.sessionMessages.get(queueName);
      if (sessions) {
        const sessionMessages = sessions.get(sessionId) || [];
        const index = sessionMessages.findIndex(m => m.id === message.id);
        if (index >= 0) {
          sessionMessages.splice(index, 1);
          sessions.set(sessionId, sessionMessages);
        }
      }
    }

    // Update state
    const state = this.queueState.get(queueName);
    if (state) {
      const available = this.getAvailableMessages(queueName);
      state.activeMessageCount = available.length;
      state.receivedCount = (state.receivedCount || 0) + 1;
      state.lastUpdate = now;
    }

    return message;
  }

  /**
   * Receive message from subscription (peek-lock pattern)
   */
  public receiveFromSubscription(
    topicName: string,
    subscriptionName: string,
    lockDuration?: number
  ): ServiceBusMessage | null {
    const subscriptionId = `${topicName}/subscriptions/${subscriptionName}`;
    const messages = this.getAvailableSubscriptionMessages(subscriptionId);

    if (messages.length === 0) {
      return null; // No messages available
    }

    const subscription = this.subscriptions.get(topicName)?.find(s => s.name === subscriptionName);
    if (!subscription) {
      return null; // Subscription not found
    }

    const now = Date.now();
    const lockDurationMs = (lockDuration || subscription.lockDuration) * 1000;
    const lockExpiresAt = now + lockDurationMs;

    // Get first message (FIFO)
    const message = messages.shift()!;
    
    // Update message delivery count
    message.deliveryCount = (message.deliveryCount || 0) + 1;
    message.lockedUntil = lockExpiresAt;
    message.lockToken = `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Move to locked messages
    const locked = this.lockedMessages.get(subscriptionId) || [];
    locked.push({
      message,
      lockedAt: now,
      lockExpiresAt,
    });
    this.lockedMessages.set(subscriptionId, locked);

    // Update state
    const state = this.subscriptionState.get(subscriptionId);
    if (state) {
      const available = this.getAvailableSubscriptionMessages(subscriptionId);
      state.activeMessageCount = available.length;
      state.receivedCount = (state.receivedCount || 0) + 1;
      state.lastUpdate = now;
    }

    return message;
  }

  /**
   * Complete message (delete after processing)
   */
  public completeMessage(
    queueOrSubscriptionId: string,
    lockToken: string
  ): boolean {
    const locked = this.lockedMessages.get(queueOrSubscriptionId) || [];
    const index = locked.findIndex(lm => lm.message.lockToken === lockToken);
    
    if (index < 0) {
      return false; // Message not found or lock expired
    }

    locked.splice(index, 1);
    this.lockedMessages.set(queueOrSubscriptionId, locked);

    // Update state
    const isQueue = this.queues.has(queueOrSubscriptionId);
    if (isQueue) {
      const state = this.queueState.get(queueOrSubscriptionId);
      if (state) {
        state.completedCount = (state.completedCount || 0) + 1;
        state.lastUpdate = Date.now();
      }
    } else {
      const state = this.subscriptionState.get(queueOrSubscriptionId);
      if (state) {
        state.completedCount = (state.completedCount || 0) + 1;
        state.lastUpdate = Date.now();
      }
    }

    return true;
  }

  /**
   * Abandon message (return to queue/subscription)
   */
  public abandonMessage(
    queueOrSubscriptionId: string,
    lockToken: string
  ): boolean {
    const locked = this.lockedMessages.get(queueOrSubscriptionId) || [];
    const index = locked.findIndex(lm => lm.message.lockToken === lockToken);
    
    if (index < 0) {
      return false; // Message not found or lock expired
    }

    const lockedMessage = locked[index];
    locked.splice(index, 1);
    this.lockedMessages.set(queueOrSubscriptionId, locked);

    const message = lockedMessage.message;
    message.lockToken = undefined;
    message.lockedUntil = undefined;

    // Check if message exceeded max delivery count
    const isQueue = this.queues.has(queueOrSubscriptionId);
    const maxDeliveryCount = isQueue
      ? this.queues.get(queueOrSubscriptionId)?.maxDeliveryCount || 10
      : this.subscriptions.get(message.destination)?.find(s => s.name === message.subscriptionName)?.maxDeliveryCount || 10;

    if (message.deliveryCount >= maxDeliveryCount) {
      // Move to dead letter queue
      const dlq = this.deadLetterMessages.get(queueOrSubscriptionId) || [];
      dlq.push(message);
      this.deadLetterMessages.set(queueOrSubscriptionId, dlq);

      // Update state
      if (isQueue) {
        const state = this.queueState.get(queueOrSubscriptionId);
        if (state) {
          state.deadLetterMessageCount = dlq.length;
          state.abandonedCount = (state.abandonedCount || 0) + 1;
          state.lastUpdate = Date.now();
        }
      } else {
        const state = this.subscriptionState.get(queueOrSubscriptionId);
        if (state) {
          state.deadLetterMessageCount = dlq.length;
          state.abandonedCount = (state.abandonedCount || 0) + 1;
          state.lastUpdate = Date.now();
        }
      }
    } else {
      // Return to queue/subscription
      if (isQueue) {
        const queue = this.queues.get(queueOrSubscriptionId);
        if (queue) {
          if (queue.enableSessions && message.sessionId) {
            const sessions = this.sessionMessages.get(queueOrSubscriptionId);
            if (sessions) {
              const sessionMessages = sessions.get(message.sessionId) || [];
              sessionMessages.push(message);
              sessions.set(message.sessionId, sessionMessages);
            }
          } else {
            const messages = this.queueMessages.get(queueOrSubscriptionId) || [];
            messages.push(message);
            this.queueMessages.set(queueOrSubscriptionId, messages);
          }
        }
      } else {
        const subMessages = this.subscriptionMessages.get(queueOrSubscriptionId) || [];
        subMessages.push(message);
        this.subscriptionMessages.set(queueOrSubscriptionId, subMessages);
      }

      // Update state
      if (isQueue) {
        const state = this.queueState.get(queueOrSubscriptionId);
        if (state) {
          const available = this.getAvailableMessages(queueOrSubscriptionId);
          state.activeMessageCount = available.length;
          state.abandonedCount = (state.abandonedCount || 0) + 1;
          state.lastUpdate = Date.now();
        }
      } else {
        const state = this.subscriptionState.get(queueOrSubscriptionId);
        if (state) {
          const available = this.getAvailableSubscriptionMessages(queueOrSubscriptionId);
          state.activeMessageCount = available.length;
          state.abandonedCount = (state.abandonedCount || 0) + 1;
          state.lastUpdate = Date.now();
        }
      }
    }

    return true;
  }

  /**
   * Process consumption (move scheduled messages, expire locks, expire TTL)
   */
  public processConsumption(deltaTime: number) {
    const now = Date.now();

    // Process queues
    for (const [queueName, queue] of this.queues.entries()) {
      // Move scheduled messages to available
      const scheduled = this.scheduledMessages.get(queueName) || [];
      const available = this.queueMessages.get(queueName) || [];
      const sessions = this.sessionMessages.get(queueName);
      
      for (let i = scheduled.length - 1; i >= 0; i--) {
        const msg = scheduled[i];
        if (msg.scheduledEnqueueTime && msg.scheduledEnqueueTime <= now) {
          scheduled.splice(i, 1);
          
          if (queue.enableSessions && msg.sessionId && sessions) {
            const sessionMessages = sessions.get(msg.sessionId) || [];
            sessionMessages.push(msg);
            sessions.set(msg.sessionId, sessionMessages);
          } else {
            available.push(msg);
          }
        }
      }
      this.scheduledMessages.set(queueName, scheduled);
      this.queueMessages.set(queueName, available);

      // Expire locks (return to queue)
      const locked = this.lockedMessages.get(queueName) || [];
      for (let i = locked.length - 1; i >= 0; i--) {
        const lm = locked[i];
        if (lm.lockExpiresAt <= now) {
          locked.splice(i, 1);
          // Abandon message (lock expired)
          this.abandonMessage(queueName, lm.message.lockToken!);
        }
      }
      this.lockedMessages.set(queueName, locked);

      // Expire TTL messages
      const messages = this.getAvailableMessages(queueName);
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.expirationTime <= now) {
          messages.splice(i, 1);
          
          if (queue.enableDeadLetteringOnMessageExpiration) {
            const dlq = this.deadLetterMessages.get(queueName) || [];
            dlq.push(msg);
            this.deadLetterMessages.set(queueName, dlq);
          }
        }
      }
      this.queueMessages.set(queueName, messages);

      // Update state
      const state = this.queueState.get(queueName);
      if (state) {
        state.activeMessageCount = this.getAvailableMessages(queueName).length;
        state.deadLetterMessageCount = (this.deadLetterMessages.get(queueName) || []).length;
        state.scheduledMessageCount = scheduled.length;
        state.lastUpdate = now;
      }
    }

    // Process topics and subscriptions
    for (const [topicName, topic] of this.topics.entries()) {
      // Move scheduled messages to subscriptions
      const scheduled = this.scheduledMessages.get(topicName) || [];
      for (let i = scheduled.length - 1; i >= 0; i--) {
        const msg = scheduled[i];
        if (msg.scheduledEnqueueTime && msg.scheduledEnqueueTime <= now) {
          scheduled.splice(i, 1);
          // Publish to subscriptions
          this.publishToTopic(topicName, msg.payload, msg.size, msg.properties);
        }
      }
      this.scheduledMessages.set(topicName, scheduled);

      // Process subscriptions
      const subscriptions = this.subscriptions.get(topicName) || [];
      for (const subscription of subscriptions) {
        const subscriptionId = `${topicName}/subscriptions/${subscription.name}`;
        
        // Expire locks
        const locked = this.lockedMessages.get(subscriptionId) || [];
        for (let i = locked.length - 1; i >= 0; i--) {
          const lm = locked[i];
          if (lm.lockExpiresAt <= now) {
            locked.splice(i, 1);
            this.abandonMessage(subscriptionId, lm.message.lockToken!);
          }
        }
        this.lockedMessages.set(subscriptionId, locked);

        // Expire TTL messages
        const messages = this.getAvailableSubscriptionMessages(subscriptionId);
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          if (msg.expirationTime <= now) {
            messages.splice(i, 1);
            
            if (subscription.enableDeadLetteringOnMessageExpiration) {
              const dlq = this.deadLetterMessages.get(subscriptionId) || [];
              dlq.push(msg);
              this.deadLetterMessages.set(subscriptionId, dlq);
            }
          }
        }
        this.subscriptionMessages.set(subscriptionId, messages);

        // Update state
        const state = this.subscriptionState.get(subscriptionId);
        if (state) {
          state.activeMessageCount = this.getAvailableSubscriptionMessages(subscriptionId).length;
          state.deadLetterMessageCount = (this.deadLetterMessages.get(subscriptionId) || []).length;
          state.lastUpdate = now;
        }
      }
    }
  }

  /**
   * Get available messages for a queue (excluding locked and scheduled)
   */
  private getAvailableMessages(queueName: string): ServiceBusMessage[] {
    const queue = this.queues.get(queueName);
    if (!queue) return [];

    const now = Date.now();
    const messages = this.queueMessages.get(queueName) || [];
    
    // Filter out expired messages
    return messages.filter(msg => msg.expirationTime > now);
  }

  /**
   * Get available messages for a subscription (excluding locked)
   */
  private getAvailableSubscriptionMessages(subscriptionId: string): ServiceBusMessage[] {
    const now = Date.now();
    const messages = this.subscriptionMessages.get(subscriptionId) || [];
    
    // Filter out expired messages
    return messages.filter(msg => msg.expirationTime > now);
  }

  /**
   * Get total queue depth (active messages)
   */
  public getTotalQueueDepth(): number {
    let total = 0;
    for (const queueName of this.queues.keys()) {
      total += this.getAvailableMessages(queueName).length;
    }
    return total;
  }

  /**
   * Get total subscription messages
   */
  public getTotalSubscriptionMessages(): number {
    let total = 0;
    for (const subscriptionId of this.subscriptionMessages.keys()) {
      total += this.getAvailableSubscriptionMessages(subscriptionId).length;
    }
    return total;
  }

  /**
   * Get queue metrics
   */
  public getQueueMetrics(queueName: string): {
    activeMessageCount: number;
    deadLetterMessageCount: number;
    scheduledMessageCount: number;
    sentCount: number;
    receivedCount: number;
    completedCount: number;
    abandonedCount: number;
  } | null {
    const state = this.queueState.get(queueName);
    if (!state) return null;

    return {
      activeMessageCount: state.activeMessageCount,
      deadLetterMessageCount: state.deadLetterMessageCount,
      scheduledMessageCount: state.scheduledMessageCount,
      sentCount: state.sentCount,
      receivedCount: state.receivedCount,
      completedCount: state.completedCount,
      abandonedCount: state.abandonedCount,
    };
  }

  /**
   * Get subscription metrics
   */
  public getSubscriptionMetrics(topicName: string, subscriptionName: string): {
    activeMessageCount: number;
    deadLetterMessageCount: number;
    sentCount: number;
    receivedCount: number;
    completedCount: number;
    abandonedCount: number;
  } | null {
    const subscriptionId = `${topicName}/subscriptions/${subscriptionName}`;
    const state = this.subscriptionState.get(subscriptionId);
    if (!state) return null;

    return {
      activeMessageCount: state.activeMessageCount,
      deadLetterMessageCount: state.deadLetterMessageCount,
      sentCount: state.sentCount,
      receivedCount: state.receivedCount,
      completedCount: state.completedCount,
      abandonedCount: state.abandonedCount,
    };
  }

  /**
   * Get all queue metrics
   */
  public getAllQueueMetrics(): Map<string, {
    activeMessageCount: number;
    deadLetterMessageCount: number;
    scheduledMessageCount: number;
    sentCount: number;
    receivedCount: number;
    completedCount: number;
    abandonedCount: number;
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
   * Get all subscription metrics
   */
  public getAllSubscriptionMetrics(): Map<string, {
    activeMessageCount: number;
    deadLetterMessageCount: number;
    sentCount: number;
    receivedCount: number;
    completedCount: number;
    abandonedCount: number;
  }> {
    const metrics = new Map();
    for (const [subscriptionId, state] of this.subscriptionState.entries()) {
      metrics.set(subscriptionId, {
        activeMessageCount: state.activeMessageCount,
        deadLetterMessageCount: state.deadLetterMessageCount,
        sentCount: state.sentCount,
        receivedCount: state.receivedCount,
        completedCount: state.completedCount,
        abandonedCount: state.abandonedCount,
      });
    }
    return metrics;
  }

  /**
   * Get active connections (simulated)
   */
  public getActiveConnections(): number {
    // Simulate active connections based on queues and topics
    return this.queues.size + this.topics.size;
  }
}


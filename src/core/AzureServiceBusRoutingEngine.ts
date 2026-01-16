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
  enableDuplicateDetection?: boolean;
  duplicateDetectionHistoryTimeWindow?: number; // seconds
  forwardTo?: string; // queue or topic name to forward messages to
  forwardDeadLetterMessagesTo?: string; // queue or topic name to forward dead letter messages to
}

export interface ServiceBusTopic {
  name: string;
  namespace: string;
  maxSizeInMegabytes: number;
  defaultMessageTimeToLive: number; // seconds
  enablePartitioning: boolean;
  subscriptions?: ServiceBusSubscription[];
  enableDuplicateDetection?: boolean;
  duplicateDetectionHistoryTimeWindow?: number; // seconds
  forwardTo?: string; // queue or topic name to forward messages to
  forwardDeadLetterMessagesTo?: string; // queue or topic name to forward dead letter messages to
}

export interface SubscriptionFilter {
  type: 'sql' | 'correlation' | 'none';
  sqlExpression?: string; // для SQL filter
  correlationId?: string; // для correlation filter
  properties?: Record<string, string>; // для correlation filter
}

export interface ServiceBusSubscription {
  name: string;
  maxDeliveryCount: number;
  lockDuration: number; // seconds
  enableDeadLetteringOnMessageExpiration: boolean;
  activeMessageCount?: number;
  filter?: SubscriptionFilter; // фильтр для подписки
  forwardTo?: string; // queue or topic name to forward messages to
  forwardDeadLetterMessagesTo?: string; // queue or topic name to forward dead letter messages to
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
  private duplicateDetectionHistory: Map<string, Map<string, number>> = new Map(); // queue/topic -> messageId -> timestamp
  private deferredMessages: Map<string, ServiceBusMessage[]> = new Map(); // queue/subscription -> deferred messages
  
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
    this.deferredMessages.clear();

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
            
            // Initialize deferred messages storage
            this.deferredMessages.set(`${subscriptionId}/deferred`, []);
          }
        }
      }
    }
    
    // Initialize deferred messages for queues
    for (const queueName of this.queues.keys()) {
      this.deferredMessages.set(`${queueName}/deferred`, []);
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
    
    // Check for duplicate detection
    if (queue.enableDuplicateDetection) {
      const messageIdFromProps = properties?.['MessageId'] as string || properties?.['messageId'] as string;
      if (messageIdFromProps) {
        const history = this.duplicateDetectionHistory.get(queueName) || new Map();
        const windowMs = (queue.duplicateDetectionHistoryTimeWindow || 300) * 1000; // default 5 minutes
        
        // Clean old entries outside the window
        const cutoffTime = now - windowMs;
        for (const [msgId, timestamp] of history.entries()) {
          if (timestamp < cutoffTime) {
            history.delete(msgId);
          }
        }
        
        // Check if messageId exists in history
        if (history.has(messageIdFromProps)) {
          return null; // Duplicate detected, reject message
        }
        
        // Add to history
        history.set(messageIdFromProps, now);
        this.duplicateDetectionHistory.set(queueName, history);
      }
    }
    
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
    
    // Check for duplicate detection
    if (topic.enableDuplicateDetection) {
      const messageIdFromProps = properties?.['MessageId'] as string || properties?.['messageId'] as string;
      if (messageIdFromProps) {
        const history = this.duplicateDetectionHistory.get(topicName) || new Map();
        const windowMs = (topic.duplicateDetectionHistoryTimeWindow || 300) * 1000; // default 5 minutes
        
        // Clean old entries outside the window
        const cutoffTime = now - windowMs;
        for (const [msgId, timestamp] of history.entries()) {
          if (timestamp < cutoffTime) {
            history.delete(msgId);
          }
        }
        
        // Check if messageId exists in history
        if (history.has(messageIdFromProps)) {
          return []; // Duplicate detected, reject message
        }
        
        // Add to history
        history.set(messageIdFromProps, now);
        this.duplicateDetectionHistory.set(topicName, history);
      }
    }
    
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

    // Deliver message to each subscription (with filter support)
    for (const subscription of subscriptions) {
      // Check if message matches subscription filter
      if (!this.matchesSubscriptionFilter(message, subscription.filter)) {
        continue; // Skip this subscription if filter doesn't match
      }
      
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

    const lockedMessage = locked[index];
    const message = lockedMessage.message;
    locked.splice(index, 1);
    this.lockedMessages.set(queueOrSubscriptionId, locked);

    // Check for auto-forwarding before completing
    const isQueue = this.queues.has(queueOrSubscriptionId);
    let forwardTo: string | undefined;
    
    if (isQueue) {
      const queue = this.queues.get(queueOrSubscriptionId);
      forwardTo = queue?.forwardTo;
    } else {
      // For subscription, get forwardTo from subscription config
      const [topicName, , subscriptionName] = queueOrSubscriptionId.split('/');
      const topic = this.topics.get(topicName);
      const subscription = topic?.subscriptions?.find(s => s.name === subscriptionName);
      forwardTo = subscription?.forwardTo;
    }

    // Forward message if forwardTo is configured
    if (forwardTo) {
      this.forwardMessage(message, forwardTo);
    }

    // Update state
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
      // Check for forward dead letter messages before moving to DLQ
      let forwardDeadLetterTo: string | undefined;
      
      if (isQueue) {
        const queue = this.queues.get(queueOrSubscriptionId);
        forwardDeadLetterTo = queue?.forwardDeadLetterMessagesTo;
      } else {
        // For subscription, get forwardDeadLetterMessagesTo from subscription config
        const [topicName, , subscriptionName] = queueOrSubscriptionId.split('/');
        const topic = this.topics.get(topicName);
        const subscription = topic?.subscriptions?.find(s => s.name === subscriptionName);
        forwardDeadLetterTo = subscription?.forwardDeadLetterMessagesTo;
      }

      // Forward dead letter message if configured
      if (forwardDeadLetterTo) {
        this.forwardMessage(message, forwardDeadLetterTo);
      } else {
        // Move to dead letter queue only if not forwarding
        const dlq = this.deadLetterMessages.get(queueOrSubscriptionId) || [];
        dlq.push(message);
        this.deadLetterMessages.set(queueOrSubscriptionId, dlq);
      }

      // Update state
      if (isQueue) {
        const state = this.queueState.get(queueOrSubscriptionId);
        if (state) {
          state.deadLetterMessageCount = forwardDeadLetterTo ? state.deadLetterMessageCount : (this.deadLetterMessages.get(queueOrSubscriptionId) || []).length;
          state.abandonedCount = (state.abandonedCount || 0) + 1;
          state.lastUpdate = Date.now();
        }
      } else {
        const state = this.subscriptionState.get(queueOrSubscriptionId);
        if (state) {
          state.deadLetterMessageCount = forwardDeadLetterTo ? state.deadLetterMessageCount : (this.deadLetterMessages.get(queueOrSubscriptionId) || []).length;
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
   * Forward message to another queue or topic
   */
  private forwardMessage(message: ServiceBusMessage, forwardTo: string): void {
    // Check if forwardTo is a queue or topic
    const isQueue = this.queues.has(forwardTo);
    const isTopic = this.topics.has(forwardTo);

    if (isQueue) {
      // Forward to queue
      const newMessageId = this.sendToQueue(
        forwardTo,
        message.payload,
        message.size,
        message.properties,
        message.sessionId
      );
      // Note: newMessageId is returned but not used - message is forwarded
    } else if (isTopic) {
      // Forward to topic
      this.publishToTopic(
        forwardTo,
        message.payload,
        message.size,
        message.properties
      );
    }
    // If forwardTo doesn't exist, message is silently dropped (as per Azure Service Bus behavior)
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
            // Check for forward dead letter messages
            if (queue.forwardDeadLetterMessagesTo) {
              this.forwardMessage(msg, queue.forwardDeadLetterMessagesTo);
            } else {
              const dlq = this.deadLetterMessages.get(queueName) || [];
              dlq.push(msg);
              this.deadLetterMessages.set(queueName, dlq);
            }
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
              // Check for forward dead letter messages
              if (subscription.forwardDeadLetterMessagesTo) {
                this.forwardMessage(msg, subscription.forwardDeadLetterMessagesTo);
              } else {
                const dlq = this.deadLetterMessages.get(subscriptionId) || [];
                dlq.push(msg);
                this.deadLetterMessages.set(subscriptionId, dlq);
              }
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

  /**
   * Check if message matches subscription filter
   */
  private matchesSubscriptionFilter(message: ServiceBusMessage, filter?: SubscriptionFilter): boolean {
    // No filter means all messages pass
    if (!filter || filter.type === 'none') {
      return true;
    }

    const properties = message.properties || {};

    if (filter.type === 'sql') {
      // SQL Filter - simplified SQL-like expression evaluation
      if (!filter.sqlExpression) {
        return true; // Empty expression means all messages pass
      }
      
      return this.evaluateSQLFilter(filter.sqlExpression, properties);
    }

    if (filter.type === 'correlation') {
      // Correlation Filter - match by correlationId or properties
      if (filter.correlationId) {
        const messageCorrelationId = properties['CorrelationId'] || properties['correlationId'] || properties['correlation-id'];
        if (messageCorrelationId !== filter.correlationId) {
          return false;
        }
      }

      // Check properties match
      if (filter.properties) {
        for (const [key, value] of Object.entries(filter.properties)) {
          const messageValue = properties[key] || properties[key.toLowerCase()] || properties[key.toUpperCase()];
          if (messageValue !== value) {
            return false;
          }
        }
      }

      return true;
    }

    return true; // Unknown filter type, allow message
  }

  /**
   * Evaluate simplified SQL filter expression
   * Supports basic operators: =, !=, >, <, >=, <=, AND, OR, LIKE
   * Example: "user.type = 'premium' AND amount > 100"
   */
  private evaluateSQLFilter(expression: string, properties: Record<string, unknown>): boolean {
    try {
      // Simple SQL filter evaluation
      // This is a simplified version - real Azure Service Bus SQL filters are more complex
      
      // Normalize expression
      let expr = expression.trim();
      
      // Handle simple equality checks: property = 'value'
      const equalityMatch = expr.match(/^(\w+)\s*=\s*['"]([^'"]+)['"]$/);
      if (equalityMatch) {
        const [, propName, expectedValue] = equalityMatch;
        const propValue = this.getPropertyValue(properties, propName);
        return String(propValue) === expectedValue;
      }

      // Handle inequality: property != 'value'
      const inequalityMatch = expr.match(/^(\w+)\s*!=\s*['"]([^'"]+)['"]$/);
      if (inequalityMatch) {
        const [, propName, expectedValue] = inequalityMatch;
        const propValue = this.getPropertyValue(properties, propName);
        return String(propValue) !== expectedValue;
      }

      // Handle numeric comparisons: property > 100
      const numericMatch = expr.match(/^(\w+)\s*(>|<|>=|<=)\s*(\d+\.?\d*)$/);
      if (numericMatch) {
        const [, propName, operator, numericValue] = numericMatch;
        const propValue = this.getPropertyValue(properties, propName);
        const numValue = parseFloat(numericValue);
        const propNum = typeof propValue === 'number' ? propValue : parseFloat(String(propValue));
        
        if (isNaN(propNum)) return false;
        
        switch (operator) {
          case '>': return propNum > numValue;
          case '<': return propNum < numValue;
          case '>=': return propNum >= numValue;
          case '<=': return propNum <= numValue;
          default: return false;
        }
      }

      // Handle AND/OR logic (simplified)
      if (expr.includes(' AND ')) {
        const parts = expr.split(' AND ');
        return parts.every(part => this.evaluateSQLFilter(part.trim(), properties));
      }
      
      if (expr.includes(' OR ')) {
        const parts = expr.split(' OR ');
        return parts.some(part => this.evaluateSQLFilter(part.trim(), properties));
      }

      // Default: check if property exists
      const propMatch = expr.match(/^(\w+)$/);
      if (propMatch) {
        const propName = propMatch[1];
        return this.getPropertyValue(properties, propName) !== undefined;
      }

      return true; // If we can't parse, allow message (fail open)
    } catch (error) {
      console.warn('Error evaluating SQL filter:', error);
      return true; // Fail open - allow message if filter evaluation fails
    }
  }

  /**
   * Get property value from message properties (case-insensitive)
   */
  private getPropertyValue(properties: Record<string, unknown>, key: string): unknown {
    // Try exact match first
    if (properties[key] !== undefined) {
      return properties[key];
    }
    
    // Try case-insensitive match
    const lowerKey = key.toLowerCase();
    for (const [propKey, value] of Object.entries(properties)) {
      if (propKey.toLowerCase() === lowerKey) {
        return value;
      }
    }
    
    return undefined;
  }

  /**
   * Peek messages from queue (view without locking)
   */
  public peekMessages(queueName: string, count: number = 1): ServiceBusMessage[] {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return []; // Queue not found
    }

    const messages = this.getAvailableMessages(queueName);
    return messages.slice(0, Math.min(count, messages.length));
  }

  /**
   * Peek messages from subscription (view without locking)
   */
  public peekSubscriptionMessages(topicName: string, subscriptionName: string, count: number = 1): ServiceBusMessage[] {
    const subscriptionId = `${topicName}/subscriptions/${subscriptionName}`;
    const messages = this.getAvailableSubscriptionMessages(subscriptionId);
    return messages.slice(0, Math.min(count, messages.length));
  }

  /**
   * Defer message (move to deferred queue for later processing)
   */
  public deferMessage(
    queueOrSubscriptionId: string,
    lockToken: string,
    sequenceNumber?: number
  ): boolean {
    const locked = this.lockedMessages.get(queueOrSubscriptionId) || [];
    const index = locked.findIndex(lm => lm.message.lockToken === lockToken);
    
    if (index < 0) {
      return false; // Message not found or lock expired
    }

    const lockedMessage = locked[index];
    const message = lockedMessage.message;
    
    // Remove from locked messages
    locked.splice(index, 1);
    this.lockedMessages.set(queueOrSubscriptionId, locked);

    // Store deferred message (we'll use a separate map for deferred messages)
    // For simplicity, we'll store them in a special structure
    // In real Azure Service Bus, deferred messages are stored separately and can be received by sequence number
    const deferredKey = `${queueOrSubscriptionId}/deferred`;
    const deferred = this.deferredMessages.get(deferredKey) || [];
    
    // Add sequence number if not provided
    if (sequenceNumber === undefined) {
      sequenceNumber = Date.now(); // Use timestamp as sequence number
    }
    
    message.lockToken = undefined;
    message.lockedUntil = undefined;
    (message as any).sequenceNumber = sequenceNumber;
    (message as any).deferredAt = Date.now();
    
    deferred.push(message);
    this.deferredMessages.set(deferredKey, deferred);

    // Update state
    const isQueue = this.queues.has(queueOrSubscriptionId);
    if (isQueue) {
      const state = this.queueState.get(queueOrSubscriptionId);
      if (state) {
        state.lastUpdate = Date.now();
      }
    } else {
      const state = this.subscriptionState.get(queueOrSubscriptionId);
      if (state) {
        state.lastUpdate = Date.now();
      }
    }

    return true;
  }

  /**
   * Receive deferred message by sequence number
   */
  public receiveDeferredMessage(
    queueOrSubscriptionId: string,
    sequenceNumber: number
  ): ServiceBusMessage | null {
    const deferredKey = `${queueOrSubscriptionId}/deferred`;
    const deferred = this.deferredMessages.get(deferredKey) || [];
    
    const index = deferred.findIndex((msg: any) => msg.sequenceNumber === sequenceNumber);
    if (index < 0) {
      return null; // Deferred message not found
    }

    const message = deferred[index];
    deferred.splice(index, 1);
    this.deferredMessages.set(deferredKey, deferred);

    // Lock the message (similar to receive)
    const now = Date.now();
    const isQueue = this.queues.has(queueOrSubscriptionId);
    const lockDuration = isQueue
      ? (this.queues.get(queueOrSubscriptionId)?.lockDuration || 30) * 1000
      : (() => {
          const [topicName, , subscriptionName] = queueOrSubscriptionId.split('/');
          const topic = this.topics.get(topicName);
          const subscription = topic?.subscriptions?.find(s => s.name === subscriptionName);
          return (subscription?.lockDuration || 30) * 1000;
        })();

    const lockExpiresAt = now + lockDuration;
    message.lockedUntil = lockExpiresAt;
    message.lockToken = `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    message.deliveryCount = (message.deliveryCount || 0) + 1;

    // Move to locked messages
    const locked = this.lockedMessages.get(queueOrSubscriptionId) || [];
    locked.push({
      message,
      lockedAt: now,
      lockExpiresAt,
    });
    this.lockedMessages.set(queueOrSubscriptionId, locked);

    return message;
  }

  /**
   * Get all messages for a queue (for UI display)
   * Returns active, locked, scheduled, and dead letter messages
   */
  public getQueueMessages(queueName: string): {
    active: ServiceBusMessage[];
    locked: ServiceBusMessage[];
    scheduled: ServiceBusMessage[];
    deadLetter: ServiceBusMessage[];
    deferred: ServiceBusMessage[];
  } {
    const active = this.getAvailableMessages(queueName);
    const locked = (this.lockedMessages.get(queueName) || []).map(lm => lm.message);
    const scheduled = (this.scheduledMessages.get(queueName) || []).filter(msg => {
      const now = Date.now();
      return msg.scheduledEnqueueTime && msg.scheduledEnqueueTime > now;
    });
    const deadLetter = this.deadLetterMessages.get(queueName) || [];
    const deferred = this.deferredMessages.get(`${queueName}/deferred`) || [];

    return {
      active,
      locked,
      scheduled,
      deadLetter,
      deferred,
    };
  }

  /**
   * Get all messages for a subscription (for UI display)
   */
  public getSubscriptionMessages(topicName: string, subscriptionName: string): {
    active: ServiceBusMessage[];
    locked: ServiceBusMessage[];
    deadLetter: ServiceBusMessage[];
    deferred: ServiceBusMessage[];
  } {
    const subscriptionId = `${topicName}/subscriptions/${subscriptionName}`;
    const active = this.getAvailableSubscriptionMessages(subscriptionId);
    const locked = (this.lockedMessages.get(subscriptionId) || []).map(lm => lm.message);
    const deadLetter = this.deadLetterMessages.get(subscriptionId) || [];
    const deferred = this.deferredMessages.get(`${subscriptionId}/deferred`) || [];

    return {
      active,
      locked,
      deadLetter,
      deferred,
    };
  }
}


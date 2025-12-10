/**
 * Google Cloud Pub/Sub Routing Engine
 * Simulates Google Pub/Sub message routing behavior with topics and subscriptions
 */

export interface PubSubTopic {
  name: string;
  projectId: string;
  messageRetentionDuration?: number; // seconds
  labels?: Record<string, string>;
  messageCount?: number;
  byteCount?: number;
}

export interface PubSubSubscription {
  name: string;
  topic: string;
  projectId: string;
  ackDeadlineSeconds: number;
  messageRetentionDuration?: number; // seconds
  enableMessageOrdering: boolean;
  pushEndpoint?: string; // URL for push subscriptions
  pushAttributes?: Record<string, string>;
  messageCount?: number;
  unackedMessageCount?: number;
}

export interface PubSubMessage {
  id: string;
  messageId: string; // Pub/Sub message ID
  publishTime: number;
  data: unknown;
  attributes?: Record<string, string>;
  orderingKey?: string;
  size: number;
  ackId?: string; // For tracking in subscriptions
}

export interface UnackedMessage {
  message: PubSubMessage;
  subscriptionName: string;
  ackDeadlineExpiresAt: number;
  deliveryAttempt: number;
  orderingKey?: string;
}

/**
 * Google Cloud Pub/Sub Routing Engine
 * Simulates Pub/Sub message routing behavior
 */
export class PubSubRoutingEngine {
  private topics: Map<string, PubSubTopic> = new Map();
  private subscriptions: Map<string, PubSubSubscription> = new Map();
  private topicSubscriptions: Map<string, string[]> = new Map(); // topic -> subscription names
  private topicMessages: Map<string, PubSubMessage[]> = new Map(); // topic -> messages
  private subscriptionMessages: Map<string, PubSubMessage[]> = new Map(); // subscription -> available messages
  private unackedMessages: Map<string, UnackedMessage[]> = new Map(); // subscription -> unacked messages
  private orderingKeyQueues: Map<string, Map<string, PubSubMessage[]>> = new Map(); // topic -> orderingKey -> messages (for ordering)
  
  private topicState: Map<string, {
    messageCount: number;
    byteCount: number;
    publishedCount: number;
    lastUpdate: number;
  }> = new Map();
  
  private subscriptionState: Map<string, {
    messageCount: number;
    unackedMessageCount: number;
    deliveredCount: number;
    acknowledgedCount: number;
    nackedCount: number;
    lastUpdate: number;
  }> = new Map();

  /**
   * Initialize with Pub/Sub configuration
   */
  public initialize(config: {
    topics?: PubSubTopic[];
    subscriptions?: PubSubSubscription[];
  }) {
    // Clear previous state
    this.topics.clear();
    this.subscriptions.clear();
    this.topicSubscriptions.clear();
    this.topicMessages.clear();
    this.subscriptionMessages.clear();
    this.unackedMessages.clear();
    this.orderingKeyQueues.clear();
    this.topicState.clear();
    this.subscriptionState.clear();

    // Initialize topics
    if (config.topics) {
      for (const topic of config.topics) {
        this.topics.set(topic.name, { ...topic });
        this.topicMessages.set(topic.name, []);
        this.topicSubscriptions.set(topic.name, []);
        this.orderingKeyQueues.set(topic.name, new Map());
        this.topicState.set(topic.name, {
          messageCount: topic.messageCount || 0,
          byteCount: topic.byteCount || 0,
          publishedCount: 0,
          lastUpdate: Date.now(),
        });
      }
    }

    // Initialize subscriptions
    if (config.subscriptions) {
      for (const subscription of config.subscriptions) {
        this.subscriptions.set(subscription.name, { ...subscription });
        this.subscriptionMessages.set(subscription.name, []);
        this.unackedMessages.set(subscription.name, []);
        
        // Add subscription to topic's subscription list
        const topicSubs = this.topicSubscriptions.get(subscription.topic) || [];
        if (!topicSubs.includes(subscription.name)) {
          topicSubs.push(subscription.name);
        }
        this.topicSubscriptions.set(subscription.topic, topicSubs);
        
        this.subscriptionState.set(subscription.name, {
          messageCount: subscription.messageCount || 0,
          unackedMessageCount: subscription.unackedMessageCount || 0,
          deliveredCount: 0,
          acknowledgedCount: 0,
          nackedCount: 0,
          lastUpdate: Date.now(),
        });
      }
    }
  }

  /**
   * Publish a message to a topic
   */
  public publishToTopic(
    topicName: string,
    data: unknown,
    size: number,
    attributes?: Record<string, string>,
    orderingKey?: string
  ): string | null {
    const topic = this.topics.get(topicName);
    if (!topic) {
      return null; // Topic not found
    }

    const now = Date.now();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const publishTime = now;

    const message: PubSubMessage = {
      id: `pubsub_${messageId}`,
      messageId,
      publishTime,
      data,
      attributes,
      orderingKey,
      size,
    };

    // Add message to topic
    const topicMessages = this.topicMessages.get(topicName) || [];
    
    // If ordering is enabled, add to ordering key queue
    if (orderingKey) {
      const orderingQueues = this.orderingKeyQueues.get(topicName) || new Map();
      const keyQueue = orderingQueues.get(orderingKey) || [];
      keyQueue.push(message);
      orderingQueues.set(orderingKey, keyQueue);
      this.orderingKeyQueues.set(topicName, orderingQueues);
    } else {
      topicMessages.push(message);
      this.topicMessages.set(topicName, topicMessages);
    }

    // Distribute to all subscriptions of this topic
    const subscriptions = this.topicSubscriptions.get(topicName) || [];
    for (const subName of subscriptions) {
      const subscription = this.subscriptions.get(subName);
      if (!subscription) continue;

      // Create a copy of the message for this subscription
      const subscriptionMessage: PubSubMessage = {
        ...message,
        id: `${message.id}_${subName}`,
      };

      const subMessages = this.subscriptionMessages.get(subName) || [];
      
      // If subscription has ordering enabled, maintain order within ordering key
      if (subscription.enableMessageOrdering && orderingKey) {
        // Add to subscription messages (they will be processed in order)
        subMessages.push(subscriptionMessage);
      } else {
        // No ordering, just add
        subMessages.push(subscriptionMessage);
      }
      
      this.subscriptionMessages.set(subName, subMessages);
    }

    // Update topic state
    const state = this.topicState.get(topicName) || {
      messageCount: 0,
      byteCount: 0,
      publishedCount: 0,
      lastUpdate: now,
    };
    state.messageCount = topicMessages.length + 
      (orderingKey ? (this.orderingKeyQueues.get(topicName)?.get(orderingKey)?.length || 0) : 0);
    state.byteCount = (state.byteCount || 0) + size;
    state.publishedCount = (state.publishedCount || 0) + 1;
    state.lastUpdate = now;
    this.topicState.set(topicName, state);

    return messageId;
  }

  /**
   * Pull messages from a subscription (for pull subscriptions)
   */
  public pullFromSubscription(
    subscriptionName: string,
    maxMessages: number = 100
  ): PubSubMessage[] {
    const subscription = this.subscriptions.get(subscriptionName);
    if (!subscription) {
      return []; // Subscription not found
    }

    const availableMessages = this.subscriptionMessages.get(subscriptionName) || [];
    if (availableMessages.length === 0) {
      return [];
    }

    const now = Date.now();
    const ackDeadlineMs = subscription.ackDeadlineSeconds * 1000;
    const pulledMessages: PubSubMessage[] = [];
    const remainingMessages: PubSubMessage[] = [];

    // Process messages respecting ordering if enabled
    if (subscription.enableMessageOrdering) {
      // Group by ordering key to maintain order
      const orderingGroups = new Map<string, PubSubMessage[]>();
      
      for (const msg of availableMessages) {
        const key = msg.orderingKey || '__no_key__';
        if (!orderingGroups.has(key)) {
          orderingGroups.set(key, []);
        }
        orderingGroups.get(key)!.push(msg);
      }

      // Pull messages maintaining order within each key
      for (const [key, keyMessages] of orderingGroups.entries()) {
        if (pulledMessages.length >= maxMessages) break;
        
        const toPull = Math.min(keyMessages.length, maxMessages - pulledMessages.length);
        const pulled = keyMessages.splice(0, toPull);
        pulledMessages.push(...pulled);
        remainingMessages.push(...keyMessages);
      }

      // Add remaining messages from other groups
      for (const [key, keyMessages] of orderingGroups.entries()) {
        if (keyMessages.length > 0 && remainingMessages.find(m => (m.orderingKey || '__no_key__') === key) === undefined) {
          remainingMessages.push(...keyMessages);
        }
      }
    } else {
      // No ordering, just pull up to maxMessages
      const toPull = Math.min(availableMessages.length, maxMessages);
      pulledMessages.push(...availableMessages.splice(0, toPull));
      remainingMessages.push(...availableMessages);
    }

    // Update subscription messages
    this.subscriptionMessages.set(subscriptionName, remainingMessages);

    // Move pulled messages to unacked with ack deadline
    const unacked = this.unackedMessages.get(subscriptionName) || [];
    for (const msg of pulledMessages) {
      const ackId = `ack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      msg.ackId = ackId;
      
      unacked.push({
        message: msg,
        subscriptionName,
        ackDeadlineExpiresAt: now + ackDeadlineMs,
        deliveryAttempt: 1,
        orderingKey: msg.orderingKey,
      });
    }
    this.unackedMessages.set(subscriptionName, unacked);

    // Update subscription state
    const state = this.subscriptionState.get(subscriptionName) || {
      messageCount: 0,
      unackedMessageCount: 0,
      deliveredCount: 0,
      acknowledgedCount: 0,
      nackedCount: 0,
      lastUpdate: now,
    };
    state.messageCount = remainingMessages.length;
    state.unackedMessageCount = unacked.length;
    state.deliveredCount = (state.deliveredCount || 0) + pulledMessages.length;
    state.lastUpdate = now;
    this.subscriptionState.set(subscriptionName, state);

    return pulledMessages;
  }

  /**
   * Acknowledge a message (remove from unacked and mark as processed)
   */
  public ackMessage(subscriptionName: string, ackId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionName);
    if (!subscription) {
      return false;
    }

    const unacked = this.unackedMessages.get(subscriptionName) || [];
    const initialLength = unacked.length;
    
    // Remove message with matching ackId
    const filtered = unacked.filter(unackedMsg => unackedMsg.message.ackId !== ackId);
    this.unackedMessages.set(subscriptionName, filtered);

    if (filtered.length < initialLength) {
      // Update subscription state
      const state = this.subscriptionState.get(subscriptionName);
      if (state) {
        state.unackedMessageCount = filtered.length;
        state.acknowledgedCount = (state.acknowledgedCount || 0) + 1;
        state.lastUpdate = Date.now();
      }
      return true;
    }

    return false;
  }

  /**
   * Nack a message (return to subscription queue, will be redelivered)
   */
  public nackMessage(subscriptionName: string, ackId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionName);
    if (!subscription) {
      return false;
    }

    const unacked = this.unackedMessages.get(subscriptionName) || [];
    const messageIndex = unacked.findIndex(unackedMsg => unackedMsg.message.ackId === ackId);
    
    if (messageIndex === -1) {
      return false;
    }

    const unackedMsg = unacked[messageIndex];
    const message = unackedMsg.message;
    
    // Remove from unacked
    unacked.splice(messageIndex, 1);
    this.unackedMessages.set(subscriptionName, unacked);

    // Return to subscription messages (will be redelivered)
    const subscriptionMessages = this.subscriptionMessages.get(subscriptionName) || [];
    // Clear ackId before returning
    message.ackId = undefined;
    subscriptionMessages.push(message);
    this.subscriptionMessages.set(subscriptionName, subscriptionMessages);

    // Update subscription state
    const state = this.subscriptionState.get(subscriptionName);
    if (state) {
      state.unackedMessageCount = unacked.length;
      state.messageCount = subscriptionMessages.length;
      state.nackedCount = (state.nackedCount || 0) + 1;
      state.lastUpdate = Date.now();
    }

    return true;
  }

  /**
   * Process consumption: handle ack deadlines, push deliveries, retention cleanup
   */
  public processConsumption(deltaTimeMs: number): void {
    const now = Date.now();

    // Process unacked messages - check ack deadlines
    for (const [subscriptionName, unacked] of this.unackedMessages.entries()) {
      const subscription = this.subscriptions.get(subscriptionName);
      if (!subscription) continue;

      const expiredMessages: UnackedMessage[] = [];
      const remainingUnacked: UnackedMessage[] = [];

      for (const unackedMsg of unacked) {
        if (now >= unackedMsg.ackDeadlineExpiresAt) {
          // Ack deadline expired - return message to subscription
          expiredMessages.push(unackedMsg);
        } else {
          remainingUnacked.push(unackedMsg);
        }
      }

      // Return expired messages to subscription queue
      if (expiredMessages.length > 0) {
        const subscriptionMessages = this.subscriptionMessages.get(subscriptionName) || [];
        for (const expired of expiredMessages) {
          const message = expired.message;
          message.ackId = undefined; // Clear ackId
          subscriptionMessages.push(message);
        }
        this.subscriptionMessages.set(subscriptionName, subscriptionMessages);

        // Update state
        const state = this.subscriptionState.get(subscriptionName);
        if (state) {
          state.unackedMessageCount = remainingUnacked.length;
          state.messageCount = subscriptionMessages.length;
        }
      }

      this.unackedMessages.set(subscriptionName, remainingUnacked);
    }

    // Process push subscriptions - simulate push delivery
    // In a real implementation, this would make HTTP POST requests to push endpoints
    // For simulation, we just mark messages as delivered if push endpoint exists
    for (const [subscriptionName, subscription] of this.subscriptions.entries()) {
      if (subscription.pushEndpoint) {
        const subscriptionMessages = this.subscriptionMessages.get(subscriptionName) || [];
        if (subscriptionMessages.length > 0) {
          // Simulate push delivery - move some messages to unacked
          // In reality, Pub/Sub would POST to the endpoint
          const maxPushBatch = 10; // Max messages per push
          const toPush = Math.min(subscriptionMessages.length, maxPushBatch);
          
          const pushedMessages = subscriptionMessages.splice(0, toPush);
          const unacked = this.unackedMessages.get(subscriptionName) || [];
          const now = Date.now();
          const ackDeadlineMs = subscription.ackDeadlineSeconds * 1000;

          for (const msg of pushedMessages) {
            const ackId = `ack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            msg.ackId = ackId;
            unacked.push({
              message: msg,
              subscriptionName,
              ackDeadlineExpiresAt: now + ackDeadlineMs,
              deliveryAttempt: 1,
              orderingKey: msg.orderingKey,
            });
          }

          this.subscriptionMessages.set(subscriptionName, subscriptionMessages);
          this.unackedMessages.set(subscriptionName, unacked);

          // Update state
          const state = this.subscriptionState.get(subscriptionName);
          if (state) {
            state.messageCount = subscriptionMessages.length;
            state.unackedMessageCount = unacked.length;
            state.deliveredCount = (state.deliveredCount || 0) + pushedMessages.length;
          }
        }
      }
    }

    // Apply retention policies
    for (const [topicName, topic] of this.topics.entries()) {
      const retentionSeconds = topic.messageRetentionDuration || 604800; // Default 7 days
      const retentionMs = retentionSeconds * 1000;
      
      const topicMessages = this.topicMessages.get(topicName) || [];
      const now = Date.now();
      
      // Remove messages older than retention period
      const validMessages = topicMessages.filter(msg => {
        const age = now - msg.publishTime;
        return age < retentionMs;
      });
      
      if (validMessages.length < topicMessages.length) {
        const removed = topicMessages.length - validMessages.length;
        this.topicMessages.set(topicName, validMessages);
        
        // Update state
        const state = this.topicState.get(topicName);
        if (state) {
          state.messageCount = validMessages.length;
        }
      }
    }
  }

  /**
   * Get topic metrics
   */
  public getTopicMetrics(topicName: string): {
    messageCount: number;
    byteCount: number;
    publishedCount: number;
  } | null {
    const topic = this.topics.get(topicName);
    if (!topic) return null;

    const state = this.topicState.get(topicName);
    if (!state) return null;

    return {
      messageCount: state.messageCount,
      byteCount: state.byteCount,
      publishedCount: state.publishedCount,
    };
  }

  /**
   * Get subscription metrics
   */
  public getSubscriptionMetrics(subscriptionName: string): {
    messageCount: number;
    unackedMessageCount: number;
    deliveredCount: number;
    acknowledgedCount: number;
    nackedCount: number;
  } | null {
    const subscription = this.subscriptions.get(subscriptionName);
    if (!subscription) return null;

    const state = this.subscriptionState.get(subscriptionName);
    if (!state) return null;

    return {
      messageCount: state.messageCount,
      unackedMessageCount: state.unackedMessageCount,
      deliveredCount: state.deliveredCount,
      acknowledgedCount: state.acknowledgedCount,
      nackedCount: state.nackedCount,
    };
  }

  /**
   * Get all topic metrics
   */
  public getAllTopicMetrics(): Map<string, {
    messageCount: number;
    byteCount: number;
    publishedCount: number;
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
   * Get all subscription metrics
   */
  public getAllSubscriptionMetrics(): Map<string, {
    messageCount: number;
    unackedMessageCount: number;
    deliveredCount: number;
    acknowledgedCount: number;
    nackedCount: number;
  }> {
    const metrics = new Map();
    for (const subscriptionName of this.subscriptions.keys()) {
      const subscriptionMetrics = this.getSubscriptionMetrics(subscriptionName);
      if (subscriptionMetrics) {
        metrics.set(subscriptionName, subscriptionMetrics);
      }
    }
    return metrics;
  }

  /**
   * Get total messages across all topics
   */
  public getTotalTopicMessages(): number {
    let total = 0;
    for (const messages of this.topicMessages.values()) {
      total += messages.length;
    }
    // Also count ordering key queues
    for (const orderingQueues of this.orderingKeyQueues.values()) {
      for (const keyQueue of orderingQueues.values()) {
        total += keyQueue.length;
      }
    }
    return total;
  }

  /**
   * Get total unacked messages across all subscriptions
   */
  public getTotalUnackedMessages(): number {
    let total = 0;
    for (const unacked of this.unackedMessages.values()) {
      total += unacked.length;
    }
    return total;
  }

  /**
   * Get active connections count (estimated from subscriptions)
   */
  public getActiveConnections(): number {
    let connections = 0;
    
    // Count subscriptions (each can have active pull/push connections)
    for (const subscription of this.subscriptions.values()) {
      if (subscription.pushEndpoint) {
        connections += 1; // Push subscription connection
      } else {
        connections += 1; // Pull subscription connection
      }
    }
    
    // Add estimated publisher connections (at least 1)
    return Math.max(1, connections + 1);
  }

  /**
   * Update topic configuration
   */
  public updateTopic(topicName: string, updates: Partial<PubSubTopic>): void {
    const topic = this.topics.get(topicName);
    if (topic) {
      Object.assign(topic, updates);
      this.topics.set(topicName, topic);
    }
  }

  /**
   * Update subscription configuration
   */
  public updateSubscription(subscriptionName: string, updates: Partial<PubSubSubscription>): void {
    const subscription = this.subscriptions.get(subscriptionName);
    if (subscription) {
      Object.assign(subscription, updates);
      this.subscriptions.set(subscriptionName, subscription);
    }
  }
}


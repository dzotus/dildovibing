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
  schema?: {
    type: 'AVRO' | 'PROTOCOL_BUFFER' | 'JSON';
    definition?: string; // Schema definition (Avro schema JSON, .proto file content, or JSON schema)
  };
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
  payloadFormat?: 'WRAPPED' | 'UNWRAPPED'; // Payload format for push subscriptions (default: WRAPPED)
  messageCount?: number;
  unackedMessageCount?: number;
  deadLetterTopic?: string; // Dead letter topic for failed deliveries
  maxDeliveryAttempts?: number; // Max retry attempts before dead letter (default: 5)
  retryPolicy?: {
    minimumBackoff?: number; // seconds (default: 10)
    maximumBackoff?: number; // seconds (default: 600)
  };
  enableExactlyOnceDelivery?: boolean; // Enable exactly-once delivery semantics
  expirationPolicy?: {
    ttl?: number; // Time-to-live in seconds (subscription expires if inactive for this duration)
  };
  flowControl?: {
    maxOutstandingMessages?: number; // Max unacked messages (default: 1000, 0 = unlimited)
    maxOutstandingBytes?: number; // Max unacked bytes (default: 0 = unlimited)
  };
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
  nextRetryAt?: number; // Timestamp for next retry (for push subscriptions)
  lastPushResponse?: number; // HTTP status code from last push attempt
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
    validationErrorCount: number; // Count of messages that failed schema validation
    lastUpdate: number;
  }> = new Map();
  
  private subscriptionState: Map<string, {
    messageCount: number;
    unackedMessageCount: number;
    deliveredCount: number;
    acknowledgedCount: number;
    nackedCount: number;
    deadLetterCount: number;
    pushDeliverySuccessCount: number;
    pushDeliveryFailureCount: number;
    expiredAckDeadlines: number;
    totalDeliveryAttempts: number;
    messagesWithAttempts: number; // For calculating average
    lastUpdate: number;
    lastActivity: number; // Last activity timestamp for expiration policy
    deliveredMessageIds: Set<string>; // Track delivered message IDs for exactly-once delivery
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
          validationErrorCount: 0,
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
          deadLetterCount: 0,
          pushDeliverySuccessCount: 0,
          pushDeliveryFailureCount: 0,
          expiredAckDeadlines: 0,
          totalDeliveryAttempts: 0,
          messagesWithAttempts: 0,
          lastUpdate: Date.now(),
          lastActivity: Date.now(),
          deliveredMessageIds: new Set<string>(),
        });
      }
    }
  }

  /**
   * Validate message data against topic schema
   * Returns true if valid, false if invalid
   */
  private validateMessageAgainstSchema(topic: PubSubTopic, data: unknown): boolean {
    if (!topic.schema || !topic.schema.definition) {
      return true; // No schema defined, all messages are valid
    }

    const schemaType = topic.schema.type;
    const schemaDefinition = topic.schema.definition;

    try {
      switch (schemaType) {
        case 'JSON': {
          // For JSON schema, validate data structure
          // In real Pub/Sub, this uses JSON Schema validation
          // For simulation, we do basic validation
          if (typeof data !== 'object' || data === null) {
            return false; // JSON schema expects object
          }
          
          // Try to parse schema definition as JSON Schema
          try {
            const jsonSchema = JSON.parse(schemaDefinition);
            // Basic validation: check if data matches schema structure
            // In real implementation, would use a JSON Schema validator library
            // For simulation, we do basic type checking
            if (jsonSchema.type && typeof data !== jsonSchema.type) {
              return false;
            }
            return true;
          } catch {
            // Schema definition is not valid JSON, skip validation
            return true;
          }
        }
        case 'AVRO': {
          // For Avro, validate data structure against Avro schema
          // In real Pub/Sub, this uses Avro schema validation
          // For simulation, we do basic validation
          if (typeof data !== 'object' || data === null) {
            return false; // Avro typically expects objects
          }
          
          // Try to parse Avro schema
          try {
            const avroSchema = JSON.parse(schemaDefinition);
            // Basic validation: check if schema has fields
            if (avroSchema.type === 'record' && Array.isArray(avroSchema.fields)) {
              // In real implementation, would validate each field
              // For simulation, we just check if data is an object
              return typeof data === 'object' && data !== null;
            }
            return true;
          } catch {
            // Schema definition is not valid JSON, skip validation
            return true;
          }
        }
        case 'PROTOCOL_BUFFER': {
          // For Protocol Buffers, validation is complex and requires .proto parsing
          // In real Pub/Sub, this uses protobuf schema validation
          // For simulation, we do basic validation
          if (typeof data !== 'object' || data === null) {
            return false; // Protobuf typically expects objects
          }
          
          // Protocol Buffer schema is a .proto file content
          // In real implementation, would parse .proto and validate
          // For simulation, we just check if data is an object
          return typeof data === 'object' && data !== null;
        }
        default:
          return true; // Unknown schema type, allow all messages
      }
    } catch (error) {
      // Validation error occurred, reject message
      return false;
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

    // Validate message against schema if schema is defined
    const isValid = this.validateMessageAgainstSchema(topic, data);
    const state = this.topicState.get(topicName);
    
    if (!isValid) {
      // Message failed validation - reject it
      if (state) {
        state.validationErrorCount = (state.validationErrorCount || 0) + 1;
        state.lastUpdate = Date.now();
      }
      return null; // Return null to indicate failure
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

    // Update topic state (state already retrieved for validation)
    const finalState = state || {
      messageCount: 0,
      byteCount: 0,
      publishedCount: 0,
      validationErrorCount: 0,
      lastUpdate: now,
    };
    finalState.messageCount = topicMessages.length + 
      (orderingKey ? (this.orderingKeyQueues.get(topicName)?.get(orderingKey)?.length || 0) : 0);
    finalState.byteCount = (finalState.byteCount || 0) + size;
    finalState.publishedCount = (finalState.publishedCount || 0) + 1;
    finalState.lastUpdate = now;
    this.topicState.set(topicName, finalState);

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

    // Check flow control limits
    const unacked = this.unackedMessages.get(subscriptionName) || [];
    const flowControl = subscription.flowControl || {};
    const maxOutstandingMessages = flowControl.maxOutstandingMessages ?? 1000; // Default 1000, 0 = unlimited
    const maxOutstandingBytes = flowControl.maxOutstandingBytes ?? 0; // Default 0 = unlimited
    
    // Calculate current outstanding messages and bytes
    const currentOutstandingMessages = unacked.length;
    let currentOutstandingBytes = 0;
    for (const unackedMsg of unacked) {
      currentOutstandingBytes += unackedMsg.message.size || 0;
    }
    
    // If flow control limits are reached, don't pull more messages
    if (maxOutstandingMessages > 0 && currentOutstandingMessages >= maxOutstandingMessages) {
      return []; // Flow control limit reached for messages
    }
    
    if (maxOutstandingBytes > 0 && currentOutstandingBytes >= maxOutstandingBytes) {
      return []; // Flow control limit reached for bytes
    }

    const now = Date.now();
    const ackDeadlineMs = subscription.ackDeadlineSeconds * 1000;
    const pulledMessages: PubSubMessage[] = [];
    const remainingMessages: PubSubMessage[] = [];
    
    // Get subscription state for exactly-once delivery tracking
    const state = this.subscriptionState.get(subscriptionName);
    const enableExactlyOnce = subscription.enableExactlyOnceDelivery || false;
    const deliveredMessageIds = state?.deliveredMessageIds || new Set<string>();

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
        
        // Filter out already delivered messages if exactly-once is enabled
        const filteredMessages = enableExactlyOnce
          ? keyMessages.filter(msg => !deliveredMessageIds.has(msg.messageId))
          : keyMessages;
        
        // Apply flow control limits when pulling
        let toPull = Math.min(filteredMessages.length, maxMessages - pulledMessages.length);
        
        // Check message count limit
        if (maxOutstandingMessages > 0) {
          const availableMessageSlots = maxOutstandingMessages - currentOutstandingMessages;
          toPull = Math.min(toPull, availableMessageSlots);
        }
        
        // Check byte limit
        if (maxOutstandingBytes > 0 && toPull > 0) {
          let availableBytes = maxOutstandingBytes - currentOutstandingBytes;
          let bytesToPull = 0;
          let messagesToPull = 0;
          
          for (const msg of filteredMessages) {
            const msgSize = msg.size || 0;
            if (bytesToPull + msgSize <= availableBytes && messagesToPull < toPull) {
              bytesToPull += msgSize;
              messagesToPull++;
            } else {
              break;
            }
          }
          
          toPull = messagesToPull;
        }
        
        if (toPull <= 0) break; // Flow control limit reached
        
        const pulled = filteredMessages.splice(0, toPull);
        
        // Remove pulled messages from original array
        for (const pulledMsg of pulled) {
          const index = keyMessages.indexOf(pulledMsg);
          if (index !== -1) {
            keyMessages.splice(index, 1);
          }
        }
        
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
      // Filter out already delivered messages if exactly-once is enabled
      const filteredMessages = enableExactlyOnce
        ? availableMessages.filter(msg => !deliveredMessageIds.has(msg.messageId))
        : availableMessages;
      
      // Apply flow control limits when pulling
      let toPull = Math.min(filteredMessages.length, maxMessages);
      
      // Check message count limit
      if (maxOutstandingMessages > 0) {
        const availableMessageSlots = maxOutstandingMessages - currentOutstandingMessages;
        toPull = Math.min(toPull, availableMessageSlots);
      }
      
      // Check byte limit
      if (maxOutstandingBytes > 0 && toPull > 0) {
        let availableBytes = maxOutstandingBytes - currentOutstandingBytes;
        let bytesToPull = 0;
        let messagesToPull = 0;
        
        for (const msg of filteredMessages) {
          const msgSize = msg.size || 0;
          if (bytesToPull + msgSize <= availableBytes && messagesToPull < toPull) {
            bytesToPull += msgSize;
            messagesToPull++;
          } else {
            break;
          }
        }
        
        toPull = messagesToPull;
      }
      
      if (toPull <= 0) {
        // Flow control limit reached, return empty
        return [];
      }
      
      const pulled = filteredMessages.splice(0, toPull);
      
      // Remove pulled messages from original array
      for (const pulledMsg of pulled) {
        const index = availableMessages.indexOf(pulledMsg);
        if (index !== -1) {
          availableMessages.splice(index, 1);
        }
      }
      
      pulledMessages.push(...pulled);
      remainingMessages.push(...availableMessages);
    }

    // Update subscription messages
    this.subscriptionMessages.set(subscriptionName, remainingMessages);

    // Move pulled messages to unacked with ack deadline
    // Reuse unacked variable that was already declared for flow control check
    const subscriptionState = this.subscriptionState.get(subscriptionName);
    
    for (const msg of pulledMessages) {
      const ackId = `ack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      msg.ackId = ackId;
      
      // Track message as delivered for exactly-once delivery
      if (enableExactlyOnce && subscriptionState) {
        subscriptionState.deliveredMessageIds.add(msg.messageId);
      }
      
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
    const finalState = subscriptionState || {
      messageCount: 0,
      unackedMessageCount: 0,
      deliveredCount: 0,
      acknowledgedCount: 0,
      nackedCount: 0,
      lastUpdate: now,
      lastActivity: now,
      deliveredMessageIds: new Set<string>(),
    };
    finalState.messageCount = remainingMessages.length;
    finalState.unackedMessageCount = unacked.length;
    finalState.deliveredCount = (finalState.deliveredCount || 0) + pulledMessages.length;
    finalState.lastUpdate = now;
    finalState.lastActivity = now; // Update last activity timestamp
    this.subscriptionState.set(subscriptionName, finalState);

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
    
    // Find and remove message with matching ackId
    let ackedMessage: UnackedMessage | null = null;
    const filtered = unacked.filter(unackedMsg => {
      if (unackedMsg.message.ackId === ackId) {
        ackedMessage = unackedMsg;
        return false; // Remove this message
      }
      return true; // Keep this message
    });
    this.unackedMessages.set(subscriptionName, filtered);

    if (filtered.length < initialLength && ackedMessage) {
      // Update subscription state
      const state = this.subscriptionState.get(subscriptionName);
      if (state) {
        state.unackedMessageCount = filtered.length;
        state.acknowledgedCount = (state.acknowledgedCount || 0) + 1;
        state.lastUpdate = Date.now();
        state.lastActivity = Date.now();
        
        // For exactly-once delivery, we keep the messageId in deliveredMessageIds
        // to prevent redelivery. It will be cleaned up after retention period.
        // In real Pub/Sub, this is handled by the service itself.
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
      state.lastActivity = Date.now();
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

        // Update state - track expired ack deadlines
        const state = this.subscriptionState.get(subscriptionName);
        if (state) {
          state.unackedMessageCount = remainingUnacked.length;
          state.messageCount = subscriptionMessages.length;
          state.expiredAckDeadlines = (state.expiredAckDeadlines || 0) + expiredMessages.length;
          state.lastActivity = now; // Activity from processing expired messages
        }
      }

      this.unackedMessages.set(subscriptionName, remainingUnacked);
    }

    // Process push subscriptions - simulate push delivery with HTTP response handling
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
          const maxDeliveryAttempts = subscription.maxDeliveryAttempts || 5;
          const minBackoff = (subscription.retryPolicy?.minimumBackoff || 10) * 1000; // ms
          const maxBackoff = (subscription.retryPolicy?.maximumBackoff || 600) * 1000; // ms
          const enableExactlyOnce = subscription.enableExactlyOnceDelivery || false;
          const state = this.subscriptionState.get(subscriptionName);
          const deliveredMessageIds = state?.deliveredMessageIds || new Set<string>();

          for (const msg of pushedMessages) {
            // Check exactly-once delivery - skip if already delivered
            if (enableExactlyOnce && deliveredMessageIds.has(msg.messageId)) {
              // Message already delivered, skip it
              continue;
            }
            // Simulate HTTP POST to push endpoint
            // In simulation, we simulate different response codes based on probability
            // 90% success (200-299), 5% client error (4xx), 5% server error (5xx)
            const rand = Math.random();
            let httpStatus: number;
            if (rand < 0.9) {
              httpStatus = 200; // Success
            } else if (rand < 0.95) {
              httpStatus = 400 + Math.floor(Math.random() * 100); // 4xx client error
            } else {
              httpStatus = 500 + Math.floor(Math.random() * 100); // 5xx server error
            }
            
            const ackId = `ack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            msg.ackId = ackId;
            
            if (httpStatus >= 200 && httpStatus < 300) {
              // Success - message is delivered, will be acked
              // Track message as delivered for exactly-once delivery
              if (enableExactlyOnce && state) {
                state.deliveredMessageIds.add(msg.messageId);
              }
              
              unacked.push({
                message: msg,
                subscriptionName,
                ackDeadlineExpiresAt: now + ackDeadlineMs,
                deliveryAttempt: 1,
                orderingKey: msg.orderingKey,
                lastPushResponse: httpStatus,
              });
              
              // Track push delivery success
              if (state) {
                state.pushDeliverySuccessCount = (state.pushDeliverySuccessCount || 0) + 1;
                state.totalDeliveryAttempts = (state.totalDeliveryAttempts || 0) + 1;
                state.messagesWithAttempts = (state.messagesWithAttempts || 0) + 1;
                state.lastActivity = now;
              }
            } else {
              // Failure - calculate backoff and schedule retry
              const deliveryAttempt = 1;
              const backoffMs = Math.min(
                minBackoff * Math.pow(2, deliveryAttempt - 1),
                maxBackoff
              );
              const nextRetryAt = now + backoffMs;
              
              // If max attempts not reached, schedule retry
              if (deliveryAttempt < maxDeliveryAttempts) {
                unacked.push({
                  message: msg,
                  subscriptionName,
                  ackDeadlineExpiresAt: now + ackDeadlineMs,
                  deliveryAttempt,
                  orderingKey: msg.orderingKey,
                  nextRetryAt,
                  lastPushResponse: httpStatus,
                });
              } else {
                // Max attempts reached - send to dead letter topic if configured
                if (subscription.deadLetterTopic) {
                  const deadLetterTopic = this.topics.get(subscription.deadLetterTopic);
                  if (deadLetterTopic) {
                    // Publish to dead letter topic
                    this.publishToTopic(
                      subscription.deadLetterTopic,
                      msg.data,
                      msg.size,
                      {
                        ...msg.attributes,
                        'original-subscription': subscriptionName,
                        'delivery-attempts': deliveryAttempt.toString(),
                        'last-error': `HTTP ${httpStatus}`,
                      },
                      msg.orderingKey
                    );
                    
                    // Track dead letter message
                    const state = this.subscriptionState.get(subscriptionName);
                    if (state) {
                      state.deadLetterCount = (state.deadLetterCount || 0) + 1;
                    }
                  }
                } else {
                  // No dead letter topic - return to subscription queue for manual handling
                  subscriptionMessages.push(msg);
                }
                
                // Track push delivery failure
                const state = this.subscriptionState.get(subscriptionName);
                if (state) {
                  state.pushDeliveryFailureCount = (state.pushDeliveryFailureCount || 0) + 1;
                  state.totalDeliveryAttempts = (state.totalDeliveryAttempts || 0) + deliveryAttempt;
                  state.messagesWithAttempts = (state.messagesWithAttempts || 0) + 1;
                }
              }
            }
          }

          this.subscriptionMessages.set(subscriptionName, subscriptionMessages);
          this.unackedMessages.set(subscriptionName, unacked);

          // Update state
          const finalState = this.subscriptionState.get(subscriptionName);
          if (finalState) {
            finalState.messageCount = subscriptionMessages.length;
            finalState.unackedMessageCount = unacked.length;
            finalState.deliveredCount = (finalState.deliveredCount || 0) + pushedMessages.length;
            finalState.lastActivity = now;
          }
        }
        
        // Process retries for failed push deliveries
        const unacked = this.unackedMessages.get(subscriptionName) || [];
        const retryableMessages: UnackedMessage[] = [];
        const remainingUnacked: UnackedMessage[] = [];
        
        for (const unackedMsg of unacked) {
          if (unackedMsg.nextRetryAt && now >= unackedMsg.nextRetryAt) {
            // Retry time reached - simulate push again
            const deliveryAttempt = unackedMsg.deliveryAttempt + 1;
            const rand = Math.random();
            let httpStatus: number;
            
            // Retry success probability increases slightly with attempt (simulating transient errors)
            const successProbability = 0.85 + (deliveryAttempt * 0.02); // 85% -> 95%
            if (rand < successProbability) {
              httpStatus = 200; // Success
              // Remove nextRetryAt, message will be acked normally
              unackedMsg.nextRetryAt = undefined;
              unackedMsg.lastPushResponse = httpStatus;
              remainingUnacked.push(unackedMsg);
            } else if (rand < successProbability + 0.1) {
              httpStatus = 400 + Math.floor(Math.random() * 100); // 4xx
            } else {
              httpStatus = 500 + Math.floor(Math.random() * 100); // 5xx
            }
            
            if (httpStatus >= 200 && httpStatus < 300) {
              // Success on retry
              unackedMsg.deliveryAttempt = deliveryAttempt;
              remainingUnacked.push(unackedMsg);
              
              // Track push delivery success
              const state = this.subscriptionState.get(subscriptionName);
              if (state) {
                state.pushDeliverySuccessCount = (state.pushDeliverySuccessCount || 0) + 1;
                state.totalDeliveryAttempts = (state.totalDeliveryAttempts || 0) + deliveryAttempt;
                if (!unackedMsg.nextRetryAt) {
                  state.messagesWithAttempts = (state.messagesWithAttempts || 0) + 1;
                }
              }
            } else {
              // Still failed - check if max attempts reached
              if (deliveryAttempt >= maxDeliveryAttempts) {
                // Send to dead letter topic
                if (subscription.deadLetterTopic) {
                  const deadLetterTopic = this.topics.get(subscription.deadLetterTopic);
                  if (deadLetterTopic) {
                    this.publishToTopic(
                      subscription.deadLetterTopic,
                      unackedMsg.message.data,
                      unackedMsg.message.size,
                      {
                        ...unackedMsg.message.attributes,
                        'original-subscription': subscriptionName,
                        'delivery-attempts': deliveryAttempt.toString(),
                        'last-error': `HTTP ${httpStatus}`,
                      },
                      unackedMsg.message.orderingKey
                    );
                    
                    // Track dead letter message
                    const state = this.subscriptionState.get(subscriptionName);
                    if (state) {
                      state.deadLetterCount = (state.deadLetterCount || 0) + 1;
                    }
                  }
                } else {
                  // No dead letter topic - return to subscription queue
                  const subscriptionMessages = this.subscriptionMessages.get(subscriptionName) || [];
                  unackedMsg.message.ackId = undefined;
                  subscriptionMessages.push(unackedMsg.message);
                  this.subscriptionMessages.set(subscriptionName, subscriptionMessages);
                }
                
                // Track push delivery failure
                const state = this.subscriptionState.get(subscriptionName);
                if (state) {
                  state.pushDeliveryFailureCount = (state.pushDeliveryFailureCount || 0) + 1;
                  state.totalDeliveryAttempts = (state.totalDeliveryAttempts || 0) + deliveryAttempt;
                  state.messagesWithAttempts = (state.messagesWithAttempts || 0) + 1;
                }
              } else {
                // Schedule next retry with exponential backoff
                const backoffMs = Math.min(
                  minBackoff * Math.pow(2, deliveryAttempt - 1),
                  maxBackoff
                );
                unackedMsg.deliveryAttempt = deliveryAttempt;
                unackedMsg.nextRetryAt = now + backoffMs;
                unackedMsg.lastPushResponse = httpStatus;
                remainingUnacked.push(unackedMsg);
                
                // Track push delivery failure (will retry)
                const state = this.subscriptionState.get(subscriptionName);
                if (state) {
                  state.pushDeliveryFailureCount = (state.pushDeliveryFailureCount || 0) + 1;
                  state.totalDeliveryAttempts = (state.totalDeliveryAttempts || 0) + deliveryAttempt;
                }
              }
            }
          } else {
            remainingUnacked.push(unackedMsg);
          }
        }
        
        this.unackedMessages.set(subscriptionName, remainingUnacked);
      }
    }

    // Apply expiration policies for subscriptions
    // Use 'now' variable already declared at the start of processConsumption
    for (const [subscriptionName, subscription] of this.subscriptions.entries()) {
      if (subscription.expirationPolicy?.ttl) {
        const state = this.subscriptionState.get(subscriptionName);
        if (state && state.lastActivity) {
          const inactiveDuration = now - state.lastActivity;
          const ttlMs = subscription.expirationPolicy.ttl * 1000;
          
          // If subscription has been inactive longer than TTL, mark it as expired
          // In real Pub/Sub, expired subscriptions are automatically deleted
          // In simulation, we can mark them or remove them
          if (inactiveDuration > ttlMs) {
            // Subscription expired - in real Pub/Sub this would delete it
            // For simulation, we can optionally remove it or just mark it
            // For now, we'll leave it but could add an expired flag if needed
            // This is a simulation, so we track it but don't auto-delete
          }
        }
      }
    }

    // Apply retention policies
    for (const [topicName, topic] of this.topics.entries()) {
      const retentionSeconds = topic.messageRetentionDuration || 604800; // Default 7 days
      const retentionMs = retentionSeconds * 1000;
      
      const topicMessages = this.topicMessages.get(topicName) || [];
      // Use 'now' variable already declared at the start of processConsumption
      
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
   * Format message payload for push delivery based on payload format
   * WRAPPED: Google Pub/Sub format with message wrapper
   * UNWRAPPED: Only the message data
   */
  public formatPushPayload(
    message: PubSubMessage,
    subscription: PubSubSubscription
  ): unknown {
    const payloadFormat = subscription.payloadFormat || 'WRAPPED';
    
    if (payloadFormat === 'UNWRAPPED') {
      // Unwrapped format: return only the message data
      return message.data;
    }
    
    // Wrapped format: Google Pub/Sub standard format
    // In real Pub/Sub, data is base64 encoded, but in simulation we keep it as-is
    const wrappedMessage: {
      message: {
        data: string; // Base64 encoded in real Pub/Sub, but we use JSON string in simulation
        messageId: string;
        publishTime: string; // RFC3339 format
        attributes?: Record<string, string>;
        orderingKey?: string;
      };
      subscription: string;
    } = {
      message: {
        data: typeof message.data === 'string' 
          ? message.data 
          : JSON.stringify(message.data),
        messageId: message.messageId,
        publishTime: new Date(message.publishTime).toISOString(),
      },
      subscription: `projects/${subscription.projectId}/subscriptions/${subscription.name}`,
    };
    
    // Add attributes if present
    if (message.attributes && Object.keys(message.attributes).length > 0) {
      wrappedMessage.message.attributes = message.attributes;
    }
    
    // Add ordering key if present
    if (message.orderingKey) {
      wrappedMessage.message.orderingKey = message.orderingKey;
    }
    
    return wrappedMessage;
  }

  /**
   * Get formatted push payload for a message by subscription name
   * Returns the payload formatted according to subscription's payload format setting
   */
  public getFormattedPushPayload(subscriptionName: string, message: PubSubMessage): unknown | null {
    const subscription = this.subscriptions.get(subscriptionName);
    if (!subscription) {
      return null;
    }
    
    return this.formatPushPayload(message, subscription);
  }

  /**
   * Get topic metrics
   */
  public getTopicMetrics(topicName: string): {
    messageCount: number;
    byteCount: number;
    publishedCount: number;
    validationErrorCount: number;
  } | null {
    const topic = this.topics.get(topicName);
    if (!topic) return null;

    const state = this.topicState.get(topicName);
    if (!state) return null;

    return {
      messageCount: state.messageCount,
      byteCount: state.byteCount,
      publishedCount: state.publishedCount,
      validationErrorCount: state.validationErrorCount || 0,
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
    deadLetterCount: number;
    pushDeliverySuccessRate: number;
    expiredAckDeadlines: number;
    avgDeliveryAttempts: number;
  } | null {
    const subscription = this.subscriptions.get(subscriptionName);
    if (!subscription) return null;

    const state = this.subscriptionState.get(subscriptionName);
    if (!state) return null;

    // Calculate push delivery success rate
    const totalPushDeliveries = (state.pushDeliverySuccessCount || 0) + (state.pushDeliveryFailureCount || 0);
    const pushDeliverySuccessRate = totalPushDeliveries > 0
      ? (state.pushDeliverySuccessCount || 0) / totalPushDeliveries
      : 0;

    // Calculate average delivery attempts
    const avgDeliveryAttempts = (state.messagesWithAttempts || 0) > 0
      ? (state.totalDeliveryAttempts || 0) / (state.messagesWithAttempts || 1)
      : 0;

    return {
      messageCount: state.messageCount,
      unackedMessageCount: state.unackedMessageCount,
      deliveredCount: state.deliveredCount,
      acknowledgedCount: state.acknowledgedCount,
      nackedCount: state.nackedCount,
      deadLetterCount: state.deadLetterCount || 0,
      pushDeliverySuccessRate,
      expiredAckDeadlines: state.expiredAckDeadlines || 0,
      avgDeliveryAttempts,
    };
  }

  /**
   * Get all topic metrics
   */
  public getAllTopicMetrics(): Map<string, {
    messageCount: number;
    byteCount: number;
    publishedCount: number;
    validationErrorCount: number;
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
    deadLetterCount: number;
    pushDeliverySuccessRate: number;
    expiredAckDeadlines: number;
    avgDeliveryAttempts: number;
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


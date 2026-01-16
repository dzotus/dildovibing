/**
 * AWS SQS Routing Engine
 * Handles message routing to SQS queues with Standard/FIFO support,
 * visibility timeout, message retention, and DLQ processing
 */

export interface SQSQueue {
  name: string;
  type: 'standard' | 'fifo';
  region: string;
  visibilityTimeout: number; // seconds
  messageRetention: number; // days
  delaySeconds: number; // seconds
  maxReceiveCount?: number; // for DLQ
  deadLetterQueue?: string; // DLQ name
  contentBasedDedup?: boolean; // for FIFO
  fifoThroughputLimit?: 'perQueue' | 'perMessageGroupId'; // for FIFO
  // Long polling wait time per queue (ReceiveMessageWaitTimeSeconds)
  receiveMessageWaitTimeSeconds?: number;
  // Tags for queue, similar to AWS SQS tags
  tags?: Record<string, string>;
}

export interface SQSMessage {
  id: string;
  messageId: string; // AWS message ID
  receiptHandle?: string; // for received messages
  timestamp: number;
  queueName: string;
  payload: unknown;
  size: number;
  attributes?: Record<string, string>; // message attributes
  messageGroupId?: string; // for FIFO
  messageDeduplicationId?: string; // for FIFO
  receiveCount: number; // how many times message was received
  firstReceivedAt?: number; // when message was first received
  retentionExpiresAt: number; // when message expires (messageRetention)
  delayUntil?: number; // when message becomes available (delaySeconds)
}

export interface InFlightMessage {
  message: SQSMessage;
  receivedAt: number;
  visibilityTimeoutExpiresAt: number;
}

/**
 * AWS SQS Routing Engine
 * Simulates AWS SQS message routing behavior
 */
export class SQSRoutingEngine {
  private queues: Map<string, SQSQueue> = new Map();
  private queueMessages: Map<string, SQSMessage[]> = new Map(); // queue -> available messages
  private inFlightMessages: Map<string, InFlightMessage[]> = new Map(); // queue -> in-flight messages (received but not deleted)
  private dlqMessages: Map<string, SQSMessage[]> = new Map(); // dlq -> dead letter messages
  private queueState: Map<string, {
    approximateMessages: number;
    approximateMessagesNotVisible: number;
    approximateMessagesDelayed: number;
    sentCount: number;
    receivedCount: number;
    deletedCount: number;
    dlqCount: number;
    lastUpdate: number;
  }> = new Map();
  
  // For FIFO: track message groups and deduplication
  private messageGroups: Map<string, Map<string, SQSMessage[]>> = new Map(); // queue -> groupId -> messages
  private deduplicationIds: Map<string, Set<string>> = new Map(); // queue -> deduplication IDs (for content-based dedup)

  /**
   * Initialize with SQS configuration
   */
  public initialize(config: {
    queues?: SQSQueue[];
  }) {
    // Clear previous state
    this.queues.clear();
    this.queueMessages.clear();
    this.inFlightMessages.clear();
    this.dlqMessages.clear();
    this.queueState.clear();
    this.messageGroups.clear();
    this.deduplicationIds.clear();

    // Initialize queues
    if (config.queues) {
      for (const queue of config.queues) {
        this.queues.set(queue.name, { ...queue });
        this.queueMessages.set(queue.name, []);
        this.inFlightMessages.set(queue.name, []);
        this.queueState.set(queue.name, {
          approximateMessages: 0,
          approximateMessagesNotVisible: 0,
          approximateMessagesDelayed: 0,
          sentCount: 0,
          receivedCount: 0,
          deletedCount: 0,
          dlqCount: 0,
          lastUpdate: Date.now(),
        });
        
        // Initialize FIFO structures
        if (queue.type === 'fifo') {
          this.messageGroups.set(queue.name, new Map());
          this.deduplicationIds.set(queue.name, new Set());
        }
      }
    }
  }

  /**
   * Send message to queue
   */
  public sendMessage(
    queueName: string,
    payload: unknown,
    size: number,
    attributes?: Record<string, string>,
    messageGroupId?: string, // for FIFO
    messageDeduplicationId?: string // for FIFO
  ): string | null {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return null; // Queue not found
    }

    const now = Date.now();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const awsMessageId = `${queueName}-${messageId}`;

    // For FIFO: check deduplication
    if (queue.type === 'fifo') {
      // Content-based deduplication: generate deduplication ID from payload
      if (queue.contentBasedDedup && !messageDeduplicationId) {
        // Generate hash from payload
        const payloadStr = JSON.stringify(payload);
        messageDeduplicationId = this.hashString(payloadStr);
      }

      // Check if message with same deduplication ID already exists
      if (messageDeduplicationId) {
        const existingIds = this.deduplicationIds.get(queueName);
        if (existingIds && existingIds.has(messageDeduplicationId)) {
          // Duplicate message, return existing message ID (SQS behavior)
          return awsMessageId;
        }
        existingIds?.add(messageDeduplicationId);
      }

      // For FIFO: require messageGroupId
      if (!messageGroupId) {
        messageGroupId = 'default-group'; // Default group if not specified
      }
    }

    // Calculate retention expiration
    const retentionMs = queue.messageRetention * 24 * 60 * 60 * 1000; // days to ms
    const retentionExpiresAt = now + retentionMs;

    // Calculate delay (when message becomes available)
    const delayMs = queue.delaySeconds * 1000;
    const delayUntil = delayMs > 0 ? now + delayMs : undefined;

    const message: SQSMessage = {
      id: messageId,
      messageId: awsMessageId,
      timestamp: now,
      queueName,
      payload,
      size,
      attributes,
      messageGroupId,
      messageDeduplicationId,
      receiveCount: 0,
      retentionExpiresAt,
      delayUntil,
    };

    // Add to queue
    const messages = this.queueMessages.get(queueName) || [];
    
    // For FIFO: add to message group
    if (queue.type === 'fifo' && messageGroupId) {
      const groups = this.messageGroups.get(queueName);
      if (groups) {
        const groupMessages = groups.get(messageGroupId) || [];
        groupMessages.push(message);
        groups.set(messageGroupId, groupMessages);
      }
    }
    
    messages.push(message);
    this.queueMessages.set(queueName, messages);

    // Update state immediately
    const state = this.queueState.get(queueName);
    if (state) {
      const available = this.queueMessages.get(queueName) || [];
      const inFlight = this.inFlightMessages.get(queueName) || [];
      const delayed = available.filter(msg => msg.delayUntil && now < msg.delayUntil);
      
      state.approximateMessages = available.length;
      state.approximateMessagesNotVisible = inFlight.length;
      state.approximateMessagesDelayed = delayed.length;
      state.sentCount = (state.sentCount || 0) + 1;
      state.lastUpdate = now;
    }

    return awsMessageId;
  }

  /**
   * Receive messages from queue
   */
  public receiveMessage(
    queueName: string,
    maxNumberOfMessages: number = 1,
    visibilityTimeout?: number
  ): SQSMessage[] {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return []; // Queue not found
    }

    const now = Date.now();
    const effectiveVisibilityTimeout = visibilityTimeout !== undefined 
      ? visibilityTimeout 
      : queue.visibilityTimeout;
    
    const visibilityTimeoutMs = effectiveVisibilityTimeout * 1000;

    // Get available messages (not delayed, not expired)
    let availableMessages = (this.queueMessages.get(queueName) || []).filter(msg => {
      // Check if message is delayed
      if (msg.delayUntil && now < msg.delayUntil) {
        return false; // Message is still delayed
      }
      // Check if message expired (retention)
      if (now >= msg.retentionExpiresAt) {
        return false; // Message expired
      }
      return true;
    });

    // For FIFO: process by message groups
    if (queue.type === 'fifo') {
      // FIFO: process messages in order by message group
      // For simplicity, we'll process one message per group at a time
      const groups = this.messageGroups.get(queueName);
      if (groups) {
        availableMessages = [];
        let messagesAdded = 0;
        
        // Get one message from each group in order
        for (const [groupId, groupMessages] of groups.entries()) {
          if (messagesAdded >= maxNumberOfMessages) break;
          
          if (groupMessages.length > 0) {
            const msg = groupMessages[0];
            // Check if message is available (not delayed, not expired)
            if ((!msg.delayUntil || now >= msg.delayUntil) && now < msg.retentionExpiresAt) {
              availableMessages.push(msg);
              messagesAdded++;
            }
          }
        }
      }
    }

    // Limit to maxNumberOfMessages
    const toReceive = Math.min(maxNumberOfMessages, availableMessages.length);
    const received: SQSMessage[] = [];

    for (let i = 0; i < toReceive; i++) {
      const message = availableMessages[i];
      
      // Generate receipt handle
      const receiptHandle = `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      message.receiptHandle = receiptHandle;
      message.receiveCount = (message.receiveCount || 0) + 1;
      
      if (!message.firstReceivedAt) {
        message.firstReceivedAt = now;
      }

      // Move to in-flight
      const inFlight: InFlightMessage = {
        message,
        receivedAt: now,
        visibilityTimeoutExpiresAt: now + visibilityTimeoutMs,
      };

      const inFlightList = this.inFlightMessages.get(queueName) || [];
      inFlightList.push(inFlight);
      this.inFlightMessages.set(queueName, inFlightList);

      // Remove from available messages
      const availableList = this.queueMessages.get(queueName) || [];
      const index = availableList.indexOf(message);
      if (index > -1) {
        availableList.splice(index, 1);
      }
      this.queueMessages.set(queueName, availableList);

      // For FIFO: remove from message group
      if (queue.type === 'fifo' && message.messageGroupId) {
        const groups = this.messageGroups.get(queueName);
        if (groups) {
          const groupMessages = groups.get(message.messageGroupId) || [];
          const groupIndex = groupMessages.indexOf(message);
          if (groupIndex > -1) {
            groupMessages.splice(groupIndex, 1);
          }
          if (groupMessages.length === 0) {
            groups.delete(message.messageGroupId);
          } else {
            groups.set(message.messageGroupId, groupMessages);
          }
        }
      }

      received.push(message);
    }

    // Update state
    const state = this.queueState.get(queueName);
    if (state) {
      state.receivedCount = (state.receivedCount || 0) + received.length;
      state.lastUpdate = now;
    }

    return received;
  }

  /**
   * Delete message from queue (after processing)
   */
  public deleteMessage(queueName: string, receiptHandle: string): boolean {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return false;
    }

    const inFlightList = this.inFlightMessages.get(queueName) || [];
    const index = inFlightList.findIndex(ifm => ifm.message.receiptHandle === receiptHandle);
    
    if (index === -1) {
      return false; // Message not found
    }

    const inFlight = inFlightList[index];
    inFlightList.splice(index, 1);
    this.inFlightMessages.set(queueName, inFlightList);

    // Update state
    const state = this.queueState.get(queueName);
    if (state) {
      state.deletedCount = (state.deletedCount || 0) + 1;
      state.lastUpdate = Date.now();
    }

    return true;
  }

  /**
   * Process queue consumption (simulate visibility timeout, retention, DLQ)
   */
  public processConsumption(deltaTimeMs: number): void {
    const now = Date.now();

    for (const [queueName, queue] of this.queues.entries()) {
      // Process visibility timeout: return messages to queue if timeout expired
      const inFlightList = this.inFlightMessages.get(queueName) || [];
      const returnedMessages: SQSMessage[] = [];
      const remainingInFlight: InFlightMessage[] = [];

      for (const inFlight of inFlightList) {
        if (now >= inFlight.visibilityTimeoutExpiresAt) {
          // Visibility timeout expired, return message to queue
          const message = inFlight.message;
          message.receiptHandle = undefined; // Clear receipt handle
          
          // Check if message should go to DLQ (maxReceiveCount exceeded)
          if (queue.maxReceiveCount && message.receiveCount >= queue.maxReceiveCount) {
            // Send to DLQ
            this.sendToDLQ(queue, message);
          } else {
            // Return to queue
            returnedMessages.push(message);
          }
        } else {
          remainingInFlight.push(inFlight);
        }
      }

      this.inFlightMessages.set(queueName, remainingInFlight);

      // Return messages to queue
      if (returnedMessages.length > 0) {
        const availableMessages = this.queueMessages.get(queueName) || [];
        
        // For FIFO: return to message groups
        if (queue.type === 'fifo') {
          const groups = this.messageGroups.get(queueName);
          if (groups) {
            for (const message of returnedMessages) {
              const groupId = message.messageGroupId || 'default-group';
              const groupMessages = groups.get(groupId) || [];
              groupMessages.push(message);
              groups.set(groupId, groupMessages);
            }
          }
        }
        
        availableMessages.push(...returnedMessages);
        this.queueMessages.set(queueName, availableMessages);
      }

      // Process message retention: remove expired messages
      const availableMessages = this.queueMessages.get(queueName) || [];
      const validMessages = availableMessages.filter(msg => {
        if (now >= msg.retentionExpiresAt) {
          // Message expired, send to DLQ if configured
          if (queue.deadLetterQueue) {
            this.sendToDLQ(queue, msg);
          }
          return false; // Remove from queue
        }
        return true;
      });
      this.queueMessages.set(queueName, validMessages);

      // For FIFO: also clean expired messages from groups
      if (queue.type === 'fifo') {
        const groups = this.messageGroups.get(queueName);
        if (groups) {
          for (const [groupId, groupMessages] of groups.entries()) {
            const validGroupMessages = groupMessages.filter(msg => {
              if (now >= msg.retentionExpiresAt) {
                if (queue.deadLetterQueue) {
                  this.sendToDLQ(queue, msg);
                }
                return false;
              }
              return true;
            });
            if (validGroupMessages.length === 0) {
              groups.delete(groupId);
            } else {
              groups.set(groupId, validGroupMessages);
            }
          }
        }
      }

      // Update state
      const state = this.queueState.get(queueName);
      if (state) {
        const available = this.queueMessages.get(queueName) || [];
        const inFlight = this.inFlightMessages.get(queueName) || [];
        const delayed = available.filter(msg => msg.delayUntil && now < msg.delayUntil);
        
        state.approximateMessages = available.length;
        state.approximateMessagesNotVisible = inFlight.length;
        state.approximateMessagesDelayed = delayed.length;
        state.lastUpdate = now;
      }
    }
  }

  /**
   * Send message to Dead Letter Queue
   */
  private sendToDLQ(queue: SQSQueue, message: SQSMessage): void {
    if (!queue.deadLetterQueue) {
      return; // No DLQ configured
    }

    const dlq = this.queues.get(queue.deadLetterQueue);
    if (!dlq) {
      return; // DLQ not found
    }

    // Add to DLQ messages
    const dlqMessages = this.dlqMessages.get(queue.deadLetterQueue) || [];
    dlqMessages.push(message);
    this.dlqMessages.set(queue.deadLetterQueue, dlqMessages);

    // Update DLQ state
    const dlqState = this.queueState.get(queue.deadLetterQueue);
    if (dlqState) {
      dlqState.dlqCount = (dlqState.dlqCount || 0) + 1;
      dlqState.approximateMessages = dlqMessages.length;
    }

    // Update source queue state
    const state = this.queueState.get(queue.name);
    if (state) {
      state.dlqCount = (state.dlqCount || 0) + 1;
    }
  }

  /**
   * Hash string for content-based deduplication
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get queue metrics
   */
  public getQueueMetrics(queueName: string): {
    approximateMessages: number;
    approximateMessagesNotVisible: number;
    approximateMessagesDelayed: number;
    sentCount: number;
    receivedCount: number;
    deletedCount: number;
    dlqCount: number;
  } | null {
    const queue = this.queues.get(queueName);
    if (!queue) return null;

    const state = this.queueState.get(queueName);
    if (!state) return null;

    return {
      approximateMessages: state.approximateMessages,
      approximateMessagesNotVisible: state.approximateMessagesNotVisible,
      approximateMessagesDelayed: state.approximateMessagesDelayed,
      sentCount: state.sentCount,
      receivedCount: state.receivedCount,
      deletedCount: state.deletedCount,
      dlqCount: state.dlqCount,
    };
  }

  /**
   * Get all queue metrics
   */
  public getAllQueueMetrics(): Map<string, {
    approximateMessages: number;
    approximateMessagesNotVisible: number;
    approximateMessagesDelayed: number;
    sentCount: number;
    receivedCount: number;
    deletedCount: number;
    dlqCount: number;
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
   * Get total queue depth (sum of all queue messages)
   */
  public getTotalQueueDepth(): number {
    let total = 0;
    for (const messages of this.queueMessages.values()) {
      total += messages.length;
    }
    for (const inFlightList of this.inFlightMessages.values()) {
      total += inFlightList.length;
    }
    return total;
  }

  /**
   * Get active connections count (estimated from producers/consumers)
   */
  public getActiveConnections(): number {
    // Estimate based on queues with activity
    let connections = 0;
    for (const state of this.queueState.values()) {
      if (state.sentCount > 0 || state.receivedCount > 0) {
        connections += 1; // At least one connection per active queue
      }
    }
    return Math.max(1, connections);
  }

  /**
   * Update queue configuration
   */
  public updateQueue(queueName: string, updates: Partial<SQSQueue>): void {
    const queue = this.queues.get(queueName);
    if (queue) {
      Object.assign(queue, updates);
      this.queues.set(queueName, queue);
    }
  }
}


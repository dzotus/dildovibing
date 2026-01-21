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
  highThroughputFifo?: boolean; // for FIFO high-throughput mode
  accountId?: string; // AWS account ID for queue URLs/ARNs
  redrivePolicy?: {
    deadLetterTargetArn?: string;
    maxReceiveCount: number;
  };
  redriveAllowPolicy?: {
    sourceQueueArns?: string[];
  };
}

export interface SQSMessage {
  id: string;
  messageId: string; // AWS message ID
  receiptHandle?: string; // for received messages
  timestamp: number;
  queueName: string;
  payload: unknown;
  size: number;
  attributes?: Record<string, string>; // message attributes (custom)
  systemAttributes?: Record<string, string>; // message system attributes (AWS.SQS.*)
  messageGroupId?: string; // for FIFO
  messageDeduplicationId?: string; // for FIFO
  receiveCount: number; // how many times message was received
  firstReceivedAt?: number; // when message was first received
  retentionExpiresAt: number; // when message expires (messageRetention)
  delayUntil?: number; // when message becomes available (delaySeconds)
  approximateFirstReceiveTimestamp?: number; // AWS system attribute
  approximateReceiveCount?: number; // AWS system attribute
  sentTimestamp?: number; // AWS system attribute
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
  private deduplicationIdTimestamps: Map<string, Map<string, number>> = new Map(); // queue -> deduplicationId -> timestamp (for 5-minute window)
  private inFlightGroups: Map<string, Set<string>> = new Map(); // queue -> set of messageGroupIds currently being processed (for FIFO ordering)
  
  // CloudWatch metrics
  private cloudWatchMetrics: Map<string, {
    numberOfMessagesSent: number;
    numberOfMessagesReceived: number;
    numberOfMessagesDeleted: number;
    approximateNumberOfMessagesVisible: number;
    approximateNumberOfMessagesNotVisible: number;
    approximateNumberOfMessagesDelayed: number;
    sentMessageSize: number; // total bytes sent
    receivedMessageSize: number; // total bytes received
    timestamp: number;
  }> = new Map();

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
    this.deduplicationIdTimestamps.clear();
    this.inFlightGroups.clear();
    this.cloudWatchMetrics.clear();

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
          this.deduplicationIdTimestamps.set(queue.name, new Map());
          this.inFlightGroups.set(queue.name, new Set());
        }
        
        // Initialize CloudWatch metrics
        this.cloudWatchMetrics.set(queue.name, {
          numberOfMessagesSent: 0,
          numberOfMessagesReceived: 0,
          numberOfMessagesDeleted: 0,
          approximateNumberOfMessagesVisible: 0,
          approximateNumberOfMessagesNotVisible: 0,
          approximateNumberOfMessagesDelayed: 0,
          sentMessageSize: 0,
          receivedMessageSize: 0,
          timestamp: Date.now(),
        });
        
        // Auto-create DLQ if maxReceiveCount is set but no DLQ specified
        if (queue.maxReceiveCount && !queue.deadLetterQueue) {
          const dlqName = `${queue.name}-dlq${queue.type === 'fifo' ? '.fifo' : ''}`;
          // Note: DLQ will be created when first message needs to be sent to it
        }
      }
    }
  }

  /**
   * Send message to queue
   * @param systemAttributes - Optional system attributes (AWS.SQS.*)
   */
  public sendMessage(
    queueName: string,
    payload: unknown,
    size: number,
    attributes?: Record<string, string>,
    messageGroupId?: string, // for FIFO
    messageDeduplicationId?: string, // for FIFO
    systemAttributes?: Record<string, string> // System attributes (AWS.SQS.*)
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

      // Check if message with same deduplication ID already exists (within 5-minute window)
      if (messageDeduplicationId) {
        const existingIds = this.deduplicationIds.get(queueName);
        const dedupTimestamps = this.deduplicationIdTimestamps.get(queueName);
        
        if (existingIds && dedupTimestamps) {
          // Check if deduplication ID exists and is still within 5-minute window
          if (existingIds.has(messageDeduplicationId)) {
            const dedupTimestamp = dedupTimestamps.get(messageDeduplicationId);
            if (dedupTimestamp && (now - dedupTimestamp) < 5 * 60 * 1000) {
              // Duplicate message within 5-minute window, return existing message ID (SQS behavior)
              return awsMessageId;
            } else {
              // Deduplication window expired, remove old entry
              existingIds.delete(messageDeduplicationId);
              dedupTimestamps.delete(messageDeduplicationId);
            }
          }
          
          // Add new deduplication ID with timestamp
          existingIds.add(messageDeduplicationId);
          dedupTimestamps.set(messageDeduplicationId, now);
        }
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
      systemAttributes,
      messageGroupId,
      messageDeduplicationId,
      receiveCount: 0,
      retentionExpiresAt,
      delayUntil,
      sentTimestamp: now, // Always set sent timestamp
    };

    // Add to queue
    const messages = this.queueMessages.get(queueName) || [];
    
    // For FIFO: add to message group (maintain order)
    if (queue.type === 'fifo' && messageGroupId) {
      const groups = this.messageGroups.get(queueName);
      if (groups) {
        const groupMessages = groups.get(messageGroupId) || [];
        // For FIFO, maintain strict ordering within message group
        groupMessages.push(message);
        groups.set(messageGroupId, groupMessages);
      }
    } else {
      // For standard queues, add directly to messages
      messages.push(message);
    }
    
    // For FIFO, we don't add to messages array directly (handled by message groups)
    if (queue.type !== 'fifo') {
      messages.push(message);
    }
    this.queueMessages.set(queueName, messages);

    // Update state immediately
    const state = this.queueState.get(queueName);
    if (state) {
      // For FIFO, count messages from message groups
      let availableCount = 0;
      if (queue.type === 'fifo') {
        const groups = this.messageGroups.get(queueName);
        if (groups) {
          for (const groupMessages of groups.values()) {
            availableCount += groupMessages.filter(msg => 
              (!msg.delayUntil || now >= msg.delayUntil) && now < msg.retentionExpiresAt
            ).length;
          }
        }
      } else {
        const available = this.queueMessages.get(queueName) || [];
        availableCount = available.filter(msg => 
          (!msg.delayUntil || now >= msg.delayUntil) && now < msg.retentionExpiresAt
        ).length;
      }
      
      const inFlight = this.inFlightMessages.get(queueName) || [];
      const available = this.queueMessages.get(queueName) || [];
      const delayed = available.filter(msg => msg.delayUntil && now < msg.delayUntil);
      
      state.approximateMessages = availableCount;
      state.approximateMessagesNotVisible = inFlight.length;
      state.approximateMessagesDelayed = delayed.length;
      state.sentCount = (state.sentCount || 0) + 1;
      state.lastUpdate = now;
    }
    
    // Update CloudWatch metrics
    const cloudWatch = this.cloudWatchMetrics.get(queueName);
    if (cloudWatch) {
      cloudWatch.numberOfMessagesSent += 1;
      cloudWatch.sentMessageSize += size;
      cloudWatch.approximateNumberOfMessagesVisible = state?.approximateMessages || 0;
      cloudWatch.approximateNumberOfMessagesNotVisible = state?.approximateMessagesNotVisible || 0;
      cloudWatch.approximateNumberOfMessagesDelayed = state?.approximateMessagesDelayed || 0;
      cloudWatch.timestamp = now;
    }

    return awsMessageId;
  }

  /**
   * Receive messages from queue
   * Supports long polling via waitTimeSeconds (0 = short polling, 1-20 = long polling)
   * Note: waitTimeSeconds is handled by the caller (DataFlowEngine) for throttling
   * @param messageAttributeNames - Optional array of attribute names to return (filters attributes)
   * @param attributeNames - Optional array of system attribute names to return (All, ApproximateFirstReceiveTimestamp, ApproximateReceiveCount, SentTimestamp, etc.)
   */
  public receiveMessage(
    queueName: string,
    maxNumberOfMessages: number = 1,
    visibilityTimeout?: number,
    waitTimeSeconds: number = 0,
    messageAttributeNames?: string[], // Filter custom message attributes
    attributeNames?: string[] // Filter system attributes (All, ApproximateFirstReceiveTimestamp, etc.)
  ): SQSMessage[] {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return []; // Queue not found
    }

    // Clamp maxNumberOfMessages to AWS limit (10)
    const maxMessages = Math.min(maxNumberOfMessages, 10);

    const now = Date.now();
    const effectiveVisibilityTimeout = visibilityTimeout !== undefined 
      ? visibilityTimeout 
      : queue.visibilityTimeout;
    
    const visibilityTimeoutMs = effectiveVisibilityTimeout * 1000;
    
    // Determine which system attributes to include
    const includeAllAttributes = !attributeNames || attributeNames.includes('All');
    const includeApproximateFirstReceiveTimestamp = includeAllAttributes || attributeNames?.includes('ApproximateFirstReceiveTimestamp');
    const includeApproximateReceiveCount = includeAllAttributes || attributeNames?.includes('ApproximateReceiveCount');
    const includeSentTimestamp = includeAllAttributes || attributeNames?.includes('SentTimestamp');

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

    // For FIFO: process by message groups with proper ordering
    if (queue.type === 'fifo') {
      const groups = this.messageGroups.get(queueName);
      const inFlightGroupsSet = this.inFlightGroups.get(queueName) || new Set();
      
      if (groups) {
        availableMessages = [];
        let messagesAdded = 0;
        
        // High-throughput FIFO: can process multiple messages from same group
        // Standard FIFO: process one message per group at a time
        const canProcessMultiplePerGroup = queue.highThroughputFifo === true;
        
        // Get messages from groups in order
        // For perQueue throughput limit: process one message per group round-robin
        // For perMessageGroupId: can process multiple messages from same group
        const throughputLimit = queue.fifoThroughputLimit || 'perQueue';
        
        if (throughputLimit === 'perMessageGroupId' || canProcessMultiplePerGroup) {
          // Can process multiple messages from same group
          for (const [groupId, groupMessages] of groups.entries()) {
            if (messagesAdded >= maxMessages) break;
            
            // Check if group is currently being processed (for ordering)
            if (inFlightGroupsSet.has(groupId) && !canProcessMultiplePerGroup) {
              continue; // Skip groups that are currently being processed (maintain ordering)
            }
            
            // Process messages from this group in order
            for (const msg of groupMessages) {
              if (messagesAdded >= maxMessages) break;
              
              // Check if message is available (not delayed, not expired)
              if ((!msg.delayUntil || now >= msg.delayUntil) && now < msg.retentionExpiresAt) {
                availableMessages.push(msg);
                messagesAdded++;
                
                // Mark group as in-flight if not high-throughput
                if (!canProcessMultiplePerGroup) {
                  inFlightGroupsSet.add(groupId);
                }
              }
            }
          }
        } else {
          // perQueue: process one message per group in round-robin fashion
          const groupEntries = Array.from(groups.entries());
          let groupIndex = 0;
          
          while (messagesAdded < maxMessages && groupEntries.length > 0) {
            const [groupId, groupMessages] = groupEntries[groupIndex % groupEntries.length];
            
            // Skip groups that are currently being processed
            if (inFlightGroupsSet.has(groupId)) {
              groupIndex++;
              continue;
            }
            
            if (groupMessages.length > 0) {
              const msg = groupMessages[0];
              // Check if message is available (not delayed, not expired)
              if ((!msg.delayUntil || now >= msg.delayUntil) && now < msg.retentionExpiresAt) {
                availableMessages.push(msg);
                messagesAdded++;
                inFlightGroupsSet.add(groupId); // Mark group as in-flight
              }
            }
            
            groupIndex++;
            
            // Prevent infinite loop
            if (groupIndex > groupEntries.length * 10) break;
          }
        }
      }
    }

    // Limit to maxMessages
    const toReceive = Math.min(maxMessages, availableMessages.length);
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
      
      // Update system attributes
      if (includeApproximateFirstReceiveTimestamp && !message.approximateFirstReceiveTimestamp) {
        message.approximateFirstReceiveTimestamp = now;
      }
      if (includeApproximateReceiveCount) {
        message.approximateReceiveCount = message.receiveCount;
      }
      if (includeSentTimestamp && !message.sentTimestamp) {
        message.sentTimestamp = message.timestamp;
      }
      
      // Filter message attributes if specified
      if (messageAttributeNames && messageAttributeNames.length > 0 && message.attributes) {
        const filteredAttributes: Record<string, string> = {};
        for (const attrName of messageAttributeNames) {
          if (message.attributes[attrName]) {
            filteredAttributes[attrName] = message.attributes[attrName];
          }
        }
        message.attributes = filteredAttributes;
      }
      
      // Build system attributes object if requested
      if (includeAllAttributes || attributeNames) {
        message.systemAttributes = {};
        if (includeApproximateFirstReceiveTimestamp && message.approximateFirstReceiveTimestamp) {
          message.systemAttributes['ApproximateFirstReceiveTimestamp'] = message.approximateFirstReceiveTimestamp.toString();
        }
        if (includeApproximateReceiveCount && message.approximateReceiveCount) {
          message.systemAttributes['ApproximateReceiveCount'] = message.approximateReceiveCount.toString();
        }
        if (includeSentTimestamp && message.sentTimestamp) {
          message.systemAttributes['SentTimestamp'] = message.sentTimestamp.toString();
        }
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
            // Remove from in-flight groups when group is empty
            const inFlightGroupsSet = this.inFlightGroups.get(queueName);
            if (inFlightGroupsSet) {
              inFlightGroupsSet.delete(message.messageGroupId);
            }
          } else {
            groups.set(message.messageGroupId, groupMessages);
          }
        }
      }

      received.push(message);
    }
    
    // Update CloudWatch metrics
    const cloudWatch = this.cloudWatchMetrics.get(queueName);
    if (cloudWatch && received.length > 0) {
      cloudWatch.numberOfMessagesReceived += received.length;
      cloudWatch.receivedMessageSize += received.reduce((sum, msg) => sum + msg.size, 0);
      cloudWatch.approximateNumberOfMessagesNotVisible = (this.inFlightMessages.get(queueName) || []).length;
      cloudWatch.timestamp = now;
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
   * Send message batch (up to 10 messages)
   * Returns array of message IDs (successful) and failed entries
   */
  public sendMessageBatch(
    queueName: string,
    entries: Array<{
      id: string; // Unique ID for this entry in the batch
      payload: unknown;
      size: number;
      attributes?: Record<string, string>;
      systemAttributes?: Record<string, string>; // System attributes (AWS.SQS.*)
      messageGroupId?: string; // for FIFO
      messageDeduplicationId?: string; // for FIFO
      delaySeconds?: number; // Override queue delay
    }>
  ): {
    successful: Array<{ id: string; messageId: string }>;
    failed: Array<{ id: string; code: string; message: string }>;
  } {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return {
        successful: [],
        failed: entries.map(e => ({
          id: e.id,
          code: 'AWS.SimpleQueueService.NonExistentQueue',
          message: `Queue '${queueName}' does not exist`,
        })),
      };
    }

    // AWS SQS batch limit is 10
    if (entries.length > 10) {
      return {
        successful: [],
        failed: entries.map(e => ({
          id: e.id,
          code: 'AWS.SimpleQueueService.TooManyEntriesInBatchRequest',
          message: 'Maximum number of entries per request is 10',
        })),
      };
    }

    const successful: Array<{ id: string; messageId: string }> = [];
    const failed: Array<{ id: string; code: string; message: string }> = [];
    const seenIds = new Set<string>();

    for (const entry of entries) {
      // Check for duplicate IDs in batch
      if (seenIds.has(entry.id)) {
        failed.push({
          id: entry.id,
          code: 'AWS.SimpleQueueService.BatchEntryIdsNotDistinct',
          message: `Id ${entry.id} is duplicated`,
        });
        continue;
      }
      seenIds.add(entry.id);

      // Validate message size (256 KB limit)
      if (entry.size > 256 * 1024) {
        failed.push({
          id: entry.id,
          code: 'AWS.SimpleQueueService.InvalidMessageContents',
          message: 'Message size exceeds 256 KB limit',
        });
        continue;
      }

      // Send message (temporarily override delay if specified)
      const originalDelay = queue.delaySeconds;
      if (entry.delaySeconds !== undefined) {
        queue.delaySeconds = entry.delaySeconds;
      }

      const messageId = this.sendMessage(
        queueName,
        entry.payload,
        entry.size,
        entry.attributes,
        entry.messageGroupId,
        entry.messageDeduplicationId,
        entry.systemAttributes
      );

      // Restore original delay
      queue.delaySeconds = originalDelay;

      if (messageId) {
        successful.push({ id: entry.id, messageId });
      } else {
        failed.push({
          id: entry.id,
          code: 'AWS.SimpleQueueService.InvalidMessageContents',
          message: 'Failed to send message',
        });
      }
    }

    return { successful, failed };
  }

  /**
   * Delete message batch (up to 10 messages)
   * Returns array of successful and failed receipt handles
   */
  public deleteMessageBatch(
    queueName: string,
    entries: Array<{ id: string; receiptHandle: string }>
  ): {
    successful: string[]; // IDs of successful deletions
    failed: Array<{ id: string; code: string; message: string }>;
  } {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return {
        successful: [],
        failed: entries.map(e => ({
          id: e.id,
          code: 'AWS.SimpleQueueService.NonExistentQueue',
          message: `Queue '${queueName}' does not exist`,
        })),
      };
    }

    // AWS SQS batch limit is 10
    if (entries.length > 10) {
      return {
        successful: [],
        failed: entries.map(e => ({
          id: e.id,
          code: 'AWS.SimpleQueueService.TooManyEntriesInBatchRequest',
          message: 'Maximum number of entries per request is 10',
        })),
      };
    }

    const successful: string[] = [];
    const failed: Array<{ id: string; code: string; message: string }> = [];
    const seenIds = new Set<string>();

    for (const entry of entries) {
      // Check for duplicate IDs in batch
      if (seenIds.has(entry.id)) {
        failed.push({
          id: entry.id,
          code: 'AWS.SimpleQueueService.BatchEntryIdsNotDistinct',
          message: `Id ${entry.id} is duplicated`,
        });
        continue;
      }
      seenIds.add(entry.id);

      const deleted = this.deleteMessage(queueName, entry.receiptHandle);
      if (deleted) {
        successful.push(entry.id);
      } else {
        failed.push({
          id: entry.id,
          code: 'AWS.SimpleQueueService.ReceiptHandleIsInvalid',
          message: `Receipt handle '${entry.receiptHandle}' is invalid`,
        });
      }
    }

    return { successful, failed };
  }

  /**
   * Change message visibility timeout
   * Extends or reduces the visibility timeout for a message that is in-flight
   */
  public changeMessageVisibility(
    queueName: string,
    receiptHandle: string,
    visibilityTimeout: number
  ): boolean {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return false;
    }

    // Validate visibility timeout (0 to 43200 seconds = 12 hours)
    if (visibilityTimeout < 0 || visibilityTimeout > 43200) {
      return false;
    }

    const inFlightList = this.inFlightMessages.get(queueName) || [];
    const index = inFlightList.findIndex(ifm => ifm.message.receiptHandle === receiptHandle);
    
    if (index === -1) {
      return false; // Message not found
    }

    const inFlight = inFlightList[index];
    const now = Date.now();
    const visibilityTimeoutMs = visibilityTimeout * 1000;
    
    // Update visibility timeout expiration
    inFlight.visibilityTimeoutExpiresAt = now + visibilityTimeoutMs;
    
    // Update in-flight list
    inFlightList[index] = inFlight;
    this.inFlightMessages.set(queueName, inFlightList);

    return true;
  }

  /**
   * Change message visibility timeout batch (up to 10 messages)
   */
  public changeMessageVisibilityBatch(
    queueName: string,
    entries: Array<{ id: string; receiptHandle: string; visibilityTimeout: number }>
  ): {
    successful: string[]; // IDs of successful changes
    failed: Array<{ id: string; code: string; message: string }>;
  } {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return {
        successful: [],
        failed: entries.map(e => ({
          id: e.id,
          code: 'AWS.SimpleQueueService.NonExistentQueue',
          message: `Queue '${queueName}' does not exist`,
        })),
      };
    }

    // AWS SQS batch limit is 10
    if (entries.length > 10) {
      return {
        successful: [],
        failed: entries.map(e => ({
          id: e.id,
          code: 'AWS.SimpleQueueService.TooManyEntriesInBatchRequest',
          message: 'Maximum number of entries per request is 10',
        })),
      };
    }

    const successful: string[] = [];
    const failed: Array<{ id: string; code: string; message: string }> = [];
    const seenIds = new Set<string>();

    for (const entry of entries) {
      // Check for duplicate IDs in batch
      if (seenIds.has(entry.id)) {
        failed.push({
          id: entry.id,
          code: 'AWS.SimpleQueueService.BatchEntryIdsNotDistinct',
          message: `Id ${entry.id} is duplicated`,
        });
        continue;
      }
      seenIds.add(entry.id);

      // Validate visibility timeout
      if (entry.visibilityTimeout < 0 || entry.visibilityTimeout > 43200) {
        failed.push({
          id: entry.id,
          code: 'AWS.SimpleQueueService.InvalidParameterValue',
          message: 'VisibilityTimeout must be between 0 and 43200 seconds',
        });
        continue;
      }

      const changed = this.changeMessageVisibility(
        queueName,
        entry.receiptHandle,
        entry.visibilityTimeout
      );

      if (changed) {
        successful.push(entry.id);
      } else {
        failed.push({
          id: entry.id,
          code: 'AWS.SimpleQueueService.ReceiptHandleIsInvalid',
          message: `Receipt handle '${entry.receiptHandle}' is invalid`,
        });
      }
    }

    return { successful, failed };
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
    
    // Update CloudWatch metrics
    const cloudWatch = this.cloudWatchMetrics.get(queueName);
    if (cloudWatch) {
      cloudWatch.numberOfMessagesDeleted += 1;
      cloudWatch.approximateNumberOfMessagesNotVisible = (this.inFlightMessages.get(queueName) || []).length;
      cloudWatch.timestamp = Date.now();
    }
    
    // For FIFO: if message was from a group, check if group can be released
    if (queue.type === 'fifo' && inFlight.message.messageGroupId) {
      const groups = this.messageGroups.get(queueName);
      const inFlightGroupsSet = this.inFlightGroups.get(queueName);
      if (groups && inFlightGroupsSet) {
        const groupId = inFlight.message.messageGroupId;
        const groupMessages = groups.get(groupId);
        // If group has no more messages, remove from in-flight
        if (!groupMessages || groupMessages.length === 0) {
          inFlightGroupsSet.delete(groupId);
        }
      }
    }

    return true;
  }

  /**
   * Process queue consumption (simulate visibility timeout, retention, DLQ, deduplication window)
   */
  public processConsumption(deltaTimeMs: number): void {
    const now = Date.now();
    
    // Clean up expired deduplication IDs (5-minute window)
    for (const [queueName, dedupTimestamps] of this.deduplicationIdTimestamps.entries()) {
      const queue = this.queues.get(queueName);
      if (queue && queue.type === 'fifo') {
        const existingIds = this.deduplicationIds.get(queueName);
        if (existingIds && dedupTimestamps) {
          for (const [dedupId, timestamp] of dedupTimestamps.entries()) {
            if ((now - timestamp) >= 5 * 60 * 1000) {
              // 5-minute window expired
              existingIds.delete(dedupId);
              dedupTimestamps.delete(dedupId);
            }
          }
        }
      }
    }

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

      // Also clean expired messages from in-flight (if they somehow expired while in-flight)
      // Filter out expired messages from remainingInFlight before setting it
      const validInFlight = remainingInFlight.filter(ifm => {
        if (now >= ifm.message.retentionExpiresAt) {
          // Message expired while in-flight - remove it
          return false;
        }
        return true;
      });
      this.inFlightMessages.set(queueName, validInFlight);

      // Return messages to queue
      if (returnedMessages.length > 0) {
        const availableMessages = this.queueMessages.get(queueName) || [];
        
        // For FIFO: return to message groups (maintain order - add to end)
        if (queue.type === 'fifo') {
          const groups = this.messageGroups.get(queueName);
          if (groups) {
            for (const message of returnedMessages) {
              const groupId = message.messageGroupId || 'default-group';
              const groupMessages = groups.get(groupId) || [];
              // Add to end to maintain FIFO order
              groupMessages.push(message);
              groups.set(groupId, groupMessages);
            }
          }
        } else {
          availableMessages.push(...returnedMessages);
        }
        
        if (queue.type !== 'fifo') {
          this.queueMessages.set(queueName, availableMessages);
        }
      }

      // Process message retention: remove expired messages
      // Note: In AWS SQS, expired messages are simply deleted, not sent to DLQ
      // DLQ is only used for messages that exceed maxReceiveCount
      const availableMessages = this.queueMessages.get(queueName) || [];
      const validMessages = availableMessages.filter(msg => {
        if (now >= msg.retentionExpiresAt) {
          // Message expired - simply remove it (AWS SQS behavior)
          // DLQ is only for messages that exceed maxReceiveCount, not for expired messages
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
                // Message expired - simply remove it
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
        // For FIFO, count from message groups
        let availableCount = 0;
        let delayedCount = 0;
        
        if (queue.type === 'fifo') {
          const groups = this.messageGroups.get(queueName);
          if (groups) {
            for (const groupMessages of groups.values()) {
              for (const msg of groupMessages) {
                if (now < msg.retentionExpiresAt) {
                  if (msg.delayUntil && now < msg.delayUntil) {
                    delayedCount++;
                  } else {
                    availableCount++;
                  }
                }
              }
            }
          }
        } else {
          const available = this.queueMessages.get(queueName) || [];
          availableCount = available.filter(msg => now < msg.retentionExpiresAt && (!msg.delayUntil || now >= msg.delayUntil)).length;
          delayedCount = available.filter(msg => msg.delayUntil && now < msg.delayUntil && now < msg.retentionExpiresAt).length;
        }
        
        const inFlight = this.inFlightMessages.get(queueName) || [];
        
        state.approximateMessages = availableCount;
        state.approximateMessagesNotVisible = inFlight.length;
        state.approximateMessagesDelayed = delayedCount;
        state.lastUpdate = now;
      }
      
      // Update CloudWatch metrics
      const cloudWatch = this.cloudWatchMetrics.get(queueName);
      if (cloudWatch && state) {
        cloudWatch.approximateNumberOfMessagesVisible = state.approximateMessages;
        cloudWatch.approximateNumberOfMessagesNotVisible = state.approximateMessagesNotVisible;
        cloudWatch.approximateNumberOfMessagesDelayed = state.approximateMessagesDelayed;
        cloudWatch.timestamp = now;
      }
    }
  }

  /**
   * Send message to Dead Letter Queue
   */
  private sendToDLQ(queue: SQSQueue, message: SQSMessage): void {
    if (!queue.deadLetterQueue) {
      // Auto-create DLQ if maxReceiveCount is set
      if (queue.maxReceiveCount) {
        const dlqName = `${queue.name}-dlq${queue.type === 'fifo' ? '.fifo' : ''}`;
        // Create DLQ queue if it doesn't exist
        if (!this.queues.has(dlqName)) {
          const dlq: SQSQueue = {
            name: dlqName,
            type: queue.type,
            region: queue.region,
            visibilityTimeout: queue.visibilityTimeout,
            messageRetention: queue.messageRetention,
            delaySeconds: 0,
            accountId: queue.accountId,
          };
          this.queues.set(dlqName, dlq);
          this.queueMessages.set(dlqName, []);
          this.inFlightMessages.set(dlqName, []);
          this.queueState.set(dlqName, {
            approximateMessages: 0,
            approximateMessagesNotVisible: 0,
            approximateMessagesDelayed: 0,
            sentCount: 0,
            receivedCount: 0,
            deletedCount: 0,
            dlqCount: 0,
            lastUpdate: Date.now(),
          });
          if (dlq.type === 'fifo') {
            this.messageGroups.set(dlqName, new Map());
            this.deduplicationIds.set(dlqName, new Set());
            this.deduplicationIdTimestamps.set(dlqName, new Map());
            this.inFlightGroups.set(dlqName, new Set());
          }
          this.cloudWatchMetrics.set(dlqName, {
            numberOfMessagesSent: 0,
            numberOfMessagesReceived: 0,
            numberOfMessagesDeleted: 0,
            approximateNumberOfMessagesVisible: 0,
            approximateNumberOfMessagesNotVisible: 0,
            approximateNumberOfMessagesDelayed: 0,
            sentMessageSize: 0,
            receivedMessageSize: 0,
            timestamp: Date.now(),
          });
        }
        queue.deadLetterQueue = dlqName;
      } else {
        return; // No DLQ configured and no auto-create
      }
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
   * Redrive messages from DLQ back to source queue
   * This simulates the AWS SQS redrive functionality
   */
  public redriveFromDLQ(dlqName: string, maxMessages?: number): {
    redriven: number;
    failed: number;
  } {
    const dlq = this.queues.get(dlqName);
    if (!dlq) {
      return { redriven: 0, failed: 0 };
    }
    
    // Find source queue(s) that use this DLQ
    const sourceQueues: SQSQueue[] = [];
    for (const queue of this.queues.values()) {
      if (queue.deadLetterQueue === dlqName) {
        sourceQueues.push(queue);
      }
    }
    
    if (sourceQueues.length === 0) {
      return { redriven: 0, failed: 0 };
    }
    
    const dlqMessages = this.dlqMessages.get(dlqName) || [];
    const toRedrive = maxMessages ? Math.min(maxMessages, dlqMessages.length) : dlqMessages.length;
    let redriven = 0;
    let failed = 0;
    
    for (let i = 0; i < toRedrive; i++) {
      const message = dlqMessages[i];
      if (!message) continue;
      
      // Find source queue for this message (use first matching queue)
      const sourceQueue = sourceQueues.find(q => 
        message.queueName === q.name || message.queueName.startsWith(q.name)
      ) || sourceQueues[0];
      
      // Reset message state
      message.receiveCount = 0;
      message.firstReceivedAt = undefined;
      message.receiptHandle = undefined;
      message.delayUntil = undefined;
      
      // Resend to source queue
      const messageId = this.sendMessage(
        sourceQueue.name,
        message.payload,
        message.size,
        message.attributes,
        message.messageGroupId,
        message.messageDeduplicationId,
        message.systemAttributes
      );
      
      if (messageId) {
        redriven++;
      } else {
        failed++;
      }
    }
    
    // Remove redriven messages from DLQ
    if (redriven > 0) {
      dlqMessages.splice(0, redriven);
      this.dlqMessages.set(dlqName, dlqMessages);
      
      // Update DLQ state
      const dlqState = this.queueState.get(dlqName);
      if (dlqState) {
        dlqState.approximateMessages = dlqMessages.length;
      }
    }
    
    return { redriven, failed };
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
  
  /**
   * Get queue URL in AWS format
   * Format: https://sqs.{region}.amazonaws.com/{accountId}/{queueName}
   */
  public getQueueUrl(queueName: string): string | null {
    const queue = this.queues.get(queueName);
    if (!queue) return null;
    
    const accountId = queue.accountId || '123456789012'; // Default account ID
    return `https://sqs.${queue.region}.amazonaws.com/${accountId}/${queueName}`;
  }
  
  /**
   * Get queue ARN in AWS format
   * Format: arn:aws:sqs:{region}:{accountId}:{queueName}
   */
  public getQueueArn(queueName: string): string | null {
    const queue = this.queues.get(queueName);
    if (!queue) return null;
    
    const accountId = queue.accountId || '123456789012'; // Default account ID
    return `arn:aws:sqs:${queue.region}:${accountId}:${queueName}`;
  }
  
  /**
   * Get CloudWatch metrics for a queue
   */
  public getCloudWatchMetrics(queueName: string): {
    numberOfMessagesSent: number;
    numberOfMessagesReceived: number;
    numberOfMessagesDeleted: number;
    approximateNumberOfMessagesVisible: number;
    approximateNumberOfMessagesNotVisible: number;
    approximateNumberOfMessagesDelayed: number;
    sentMessageSize: number;
    receivedMessageSize: number;
    averageMessageSize: number;
    timestamp: number;
  } | null {
    const metrics = this.cloudWatchMetrics.get(queueName);
    if (!metrics) return null;
    
    const totalMessages = metrics.numberOfMessagesSent;
    const avgSize = totalMessages > 0 ? metrics.sentMessageSize / totalMessages : 0;
    
    return {
      ...metrics,
      averageMessageSize: avgSize,
    };
  }
  
  /**
   * Validate queue name according to AWS rules
   * - 1-80 characters
   * - Alphanumeric, hyphens, underscores
   * - FIFO queues must end with .fifo
   */
  public static validateQueueName(name: string, type: 'standard' | 'fifo'): {
    valid: boolean;
    error?: string;
  } {
    if (!name || name.length < 1 || name.length > 80) {
      return { valid: false, error: 'Queue name must be 1-80 characters' };
    }
    
    if (type === 'fifo' && !name.endsWith('.fifo')) {
      return { valid: false, error: 'FIFO queue name must end with .fifo' };
    }
    
    if (type === 'standard' && name.endsWith('.fifo')) {
      return { valid: false, error: 'Standard queue name cannot end with .fifo' };
    }
    
    // Check for valid characters: alphanumeric, hyphens, underscores
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    const baseName = type === 'fifo' ? name.slice(0, -5) : name;
    if (!validPattern.test(baseName)) {
      return { valid: false, error: 'Queue name can only contain alphanumeric characters, hyphens, and underscores' };
    }
    
    return { valid: true };
  }
}


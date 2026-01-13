/**
 * Apache Kafka Routing Engine
 * Simulates Apache Kafka message routing behavior with topics, partitions, and consumer groups
 */

export interface KafkaTopic {
  name: string;
  partitions: number;
  replication: number;
  config?: TopicConfig;
  partitionInfo?: PartitionInfo[];
}

export interface TopicConfig {
  retentionMs?: number;
  retentionBytes?: number;
  cleanupPolicy?: 'delete' | 'compact' | 'delete,compact';
  compressionType?: 'uncompressed' | 'gzip' | 'snappy' | 'lz4' | 'zstd';
  minInsyncReplicas?: number;
  maxMessageBytes?: number;
  segmentMs?: number;
  segmentBytes?: number;
}

export interface PartitionInfo {
  id: number;
  leader: number;
  replicas: number[];
  isr: number[]; // In-Sync Replicas
}

export interface KafkaPartition {
  topicName: string;
  partitionId: number;
  leader: number;
  replicas: number[];
  isr: number[];
  highWatermark: number; // Latest committed offset
  messages: KafkaMessage[];
}

export interface KafkaMessage {
  offset: number;
  timestamp: number;
  key?: string;
  value: unknown; // payload
  size: number;
  headers?: Record<string, unknown>;
  partition: number;
  topic: string;
}

export interface ConsumerGroupState {
  id: string;
  topic: string;
  members: number;
  partitionAssignment: Map<number, number[]>; // memberId -> partitionIds[]
  offsetStrategy: 'earliest' | 'latest' | 'none';
  autoCommit: boolean;
  isRebalancing: boolean;
  rebalanceEndTime?: number;
}

/**
 * Apache Kafka Routing Engine
 * Simulates Kafka message routing behavior
 */
export class KafkaRoutingEngine {
  private topics: Map<string, KafkaTopic> = new Map();
  private partitions: Map<string, KafkaPartition> = new Map(); // key: "topic-partition"
  private messages: Map<string, KafkaMessage[]> = new Map(); // key: "topic-partition" -> messages
  private consumerGroups: Map<string, ConsumerGroupState> = new Map();
  private consumerOffsets: Map<string, Map<string, number>> = new Map(); // groupId -> "topic-partition" -> offset
  private partitionOffsets: Map<string, number> = new Map(); // "topic-partition" -> latest offset
  
  // State tracking
  private topicState: Map<string, {
    messageCount: number;
    byteCount: number;
    publishedCount: number;
    lastUpdate: number;
  }> = new Map();
  
  private partitionState: Map<string, {
    messageCount: number;
    byteCount: number;
    latestOffset: number;
    highWatermark: number;
    lastUpdate: number;
  }> = new Map();
  
  // Broker health tracking
  private brokerHealth: Map<number, {
    isHealthy: boolean;
    lastHealthCheck: number;
    consecutiveFailures: number;
  }> = new Map();
  
  private brokers: string[] = [];

  /**
   * Initialize with Kafka configuration
   */
  public initialize(config: {
    brokers?: string[];
    topics?: Array<{
      name: string;
      partitions: number;
      replication: number;
      config?: TopicConfig;
      partitionInfo?: PartitionInfo[];
    }>;
    consumerGroups?: Array<{
      id: string;
      topic: string;
      members?: number;
      offsetStrategy?: 'earliest' | 'latest' | 'none';
      autoCommit?: boolean;
    }>;
  }) {
    // Clear previous state
    this.topics.clear();
    this.partitions.clear();
    this.messages.clear();
    this.consumerGroups.clear();
    this.consumerOffsets.clear();
    this.partitionOffsets.clear();
    this.topicState.clear();
    this.partitionState.clear();

    const brokers = config.brokers || ['localhost:9092'];
    this.brokers = brokers;
    const brokerCount = brokers.length;
    
    // Initialize broker health tracking
    this.brokerHealth.clear();
    for (let i = 0; i < brokerCount; i++) {
      this.brokerHealth.set(i, {
        isHealthy: true,
        lastHealthCheck: Date.now(),
        consecutiveFailures: 0,
      });
    }

    // Initialize topics
    if (config.topics) {
      for (const topicConfig of config.topics) {
        const topic: KafkaTopic = {
          name: topicConfig.name,
          partitions: topicConfig.partitions || 1,
          replication: topicConfig.replication || 1,
          config: topicConfig.config,
          partitionInfo: topicConfig.partitionInfo,
        };
        
        this.topics.set(topic.name, topic);
        
        // Initialize partitions for this topic
        const partitionCount = topic.partitions;
        for (let partitionId = 0; partitionId < partitionCount; partitionId++) {
          const partitionKey = `${topic.name}-${partitionId}`;
          
          // Get partition info from config or create default
          let partitionInfo: PartitionInfo;
          if (topic.partitionInfo && topic.partitionInfo[partitionId]) {
            partitionInfo = topic.partitionInfo[partitionId];
          } else {
            // Create default partition info
            const leader = partitionId % brokerCount;
            const replicas: number[] = [];
            for (let i = 0; i < topic.replication; i++) {
              replicas.push((leader + i) % brokerCount);
            }
            partitionInfo = {
              id: partitionId,
              leader,
              replicas,
              isr: [...replicas], // All replicas are in sync initially
            };
          }
          
          const partition: KafkaPartition = {
            topicName: topic.name,
            partitionId,
            leader: partitionInfo.leader,
            replicas: partitionInfo.replicas,
            isr: partitionInfo.isr,
            highWatermark: 0,
            messages: [],
          };
          
          this.partitions.set(partitionKey, partition);
          this.messages.set(partitionKey, []);
          this.partitionOffsets.set(partitionKey, 0);
          
          // Initialize partition state
          this.partitionState.set(partitionKey, {
            messageCount: 0,
            byteCount: 0,
            latestOffset: 0,
            highWatermark: 0,
            lastUpdate: Date.now(),
          });
        }
        
        // Initialize topic state
        this.topicState.set(topic.name, {
          messageCount: 0,
          byteCount: 0,
          publishedCount: 0,
          lastUpdate: Date.now(),
        });
      }
    }

    // Initialize consumer groups
    if (config.consumerGroups) {
      for (const groupConfig of config.consumerGroups) {
        const topic = this.topics.get(groupConfig.topic);
        if (!topic) continue; // Skip if topic doesn't exist
        
        const groupState: ConsumerGroupState = {
          id: groupConfig.id,
          topic: groupConfig.topic,
          members: groupConfig.members || 1,
          partitionAssignment: new Map(),
          offsetStrategy: groupConfig.offsetStrategy || 'latest',
          autoCommit: groupConfig.autoCommit !== false, // Default true
          isRebalancing: false,
        };
        
        // Assign partitions to consumers
        this.assignPartitionsToConsumers(
          groupState.id,
          groupState.members,
          topic.partitions
        );
        
        this.consumerGroups.set(groupState.id, groupState);
        this.consumerOffsets.set(groupState.id, new Map());
        
        // Initialize offsets based on strategy
        if (groupState.offsetStrategy === 'earliest') {
          // Start from offset 0
          for (let partitionId = 0; partitionId < topic.partitions; partitionId++) {
            const partitionKey = `${groupState.topic}-${partitionId}`;
            const offsets = this.consumerOffsets.get(groupState.id)!;
            offsets.set(partitionKey, 0);
          }
        } else if (groupState.offsetStrategy === 'latest') {
          // Start from latest offset (will be updated when messages arrive)
          for (let partitionId = 0; partitionId < topic.partitions; partitionId++) {
            const partitionKey = `${groupState.topic}-${partitionId}`;
            const offsets = this.consumerOffsets.get(groupState.id)!;
            const latestOffset = this.partitionOffsets.get(partitionKey) || 0;
            offsets.set(partitionKey, latestOffset);
          }
        }
      }
    }
  }

  /**
   * Publish a message to a topic
   * Returns the offset of the published message, or null if topic not found
   */
  public publishToTopic(
    topicName: string,
    payload: unknown,
    size: number,
    key?: string,
    headers?: Record<string, unknown>
  ): number | null {
    const topic = this.topics.get(topicName);
    if (!topic) {
      return null; // Topic not found
    }

    // Determine partition
    let partitionId: number;
    if (key !== undefined && key !== null) {
      // Key-based partitioning (consistent hashing)
      partitionId = this.hashKey(key) % topic.partitions;
    } else {
      // Round-robin for messages without key
      const partitionKey = `${topicName}-0`;
      const currentOffset = this.partitionOffsets.get(partitionKey) || 0;
      partitionId = currentOffset % topic.partitions;
    }

    const partitionKey = `${topicName}-${partitionId}`;
    const partition = this.partitions.get(partitionKey);
    if (!partition) {
      return null; // Partition not found
    }

    // Get current offset for this partition
    const currentOffset = this.partitionOffsets.get(partitionKey) || 0;
    const newOffset = currentOffset + 1;

    // Create message
    const message: KafkaMessage = {
      offset: newOffset,
      timestamp: Date.now(),
      key,
      value: payload,
      size,
      headers,
      partition: partitionId,
      topic: topicName,
    };

    // Add message to partition
    const partitionMessages = this.messages.get(partitionKey) || [];
    partitionMessages.push(message);
    this.messages.set(partitionKey, partitionMessages);

    // Update partition offset
    this.partitionOffsets.set(partitionKey, newOffset);
    
    // Update high watermark (in real Kafka, this is updated after replication)
    partition.highWatermark = newOffset;

    // Update partition state
    const partitionState = this.partitionState.get(partitionKey);
    if (partitionState) {
      partitionState.messageCount = partitionMessages.length;
      partitionState.byteCount = (partitionState.byteCount || 0) + size;
      partitionState.latestOffset = newOffset;
      partitionState.highWatermark = newOffset;
      partitionState.lastUpdate = Date.now();
    }

    // Update topic state
    const topicState = this.topicState.get(topicName);
    if (topicState) {
      topicState.messageCount = (topicState.messageCount || 0) + 1;
      topicState.byteCount = (topicState.byteCount || 0) + size;
      topicState.publishedCount = (topicState.publishedCount || 0) + 1;
      topicState.lastUpdate = Date.now();
    }

    return newOffset;
  }

  /**
   * Consume messages from a topic for a consumer group
   * Returns array of messages consumed
   */
  public consumeFromTopic(
    groupId: string,
    topicName: string,
    maxMessages?: number
  ): KafkaMessage[] {
    const group = this.consumerGroups.get(groupId);
    if (!group) {
      return []; // Consumer group not found
    }

    if (group.topic !== topicName) {
      return []; // Group is not subscribed to this topic
    }

    // Don't consume during rebalancing
    if (group.isRebalancing) {
      return []; // Rebalancing in progress
    }

    const topic = this.topics.get(topicName);
    if (!topic) {
      return []; // Topic not found
    }

    // Get partition assignment for this group
    const assignedPartitions: number[] = [];
    for (const [memberId, partitions] of group.partitionAssignment.entries()) {
      assignedPartitions.push(...partitions);
    }

    // Remove duplicates
    const uniquePartitions = Array.from(new Set(assignedPartitions));

    if (uniquePartitions.length === 0) {
      return []; // No partitions assigned
    }

    const maxMessagesPerPartition = maxMessages 
      ? Math.ceil(maxMessages / uniquePartitions.length)
      : 500; // Default batch size

    const consumedMessages: KafkaMessage[] = [];
    const groupOffsets = this.consumerOffsets.get(groupId);
    if (!groupOffsets) {
      return [];
    }

    // Consume from each assigned partition
    for (const partitionId of uniquePartitions) {
      const partitionKey = `${topicName}-${partitionId}`;
      const partitionMessages = this.messages.get(partitionKey) || [];
      const currentOffset = groupOffsets.get(partitionKey) || 0;

      // Find messages starting from current offset
      const availableMessages = partitionMessages.filter(msg => msg.offset > currentOffset);
      const toConsume = availableMessages.slice(0, maxMessagesPerPartition);

      if (toConsume.length > 0) {
        consumedMessages.push(...toConsume);

        // Update offset (auto-commit if enabled)
        if (group.autoCommit) {
          const lastOffset = toConsume[toConsume.length - 1].offset;
          groupOffsets.set(partitionKey, lastOffset);
        }
      }
    }

    return consumedMessages;
  }

  /**
   * Assign partitions to consumers using range assignment strategy
   */
  public assignPartitionsToConsumers(
    groupId: string,
    memberCount: number,
    partitionCount: number
  ): Map<number, number[]> {
    const group = this.consumerGroups.get(groupId);
    if (!group) {
      return new Map();
    }

    if (memberCount === 0 || partitionCount === 0) {
      group.partitionAssignment.clear();
      return new Map();
    }

    const assignment: Map<number, number[]> = new Map();
    const partitionsPerConsumer = Math.floor(partitionCount / memberCount);
    const extraPartitions = partitionCount % memberCount;

    let partitionIndex = 0;
    for (let memberId = 0; memberId < memberCount; memberId++) {
      const assignedPartitions: number[] = [];
      const countForThisConsumer = partitionsPerConsumer + (memberId < extraPartitions ? 1 : 0);

      for (let i = 0; i < countForThisConsumer; i++) {
        if (partitionIndex < partitionCount) {
          assignedPartitions.push(partitionIndex);
          partitionIndex++;
        }
      }

      assignment.set(memberId, assignedPartitions);
    }

    group.partitionAssignment = assignment;
    return assignment;
  }

  /**
   * Commit offset for a consumer group
   */
  public commitOffset(
    groupId: string,
    topic: string,
    partition: number,
    offset: number
  ): boolean {
    const groupOffsets = this.consumerOffsets.get(groupId);
    if (!groupOffsets) {
      return false;
    }

    const partitionKey = `${topic}-${partition}`;
    const currentOffset = groupOffsets.get(partitionKey) || 0;
    
    // Offset can only increase
    if (offset >= currentOffset) {
      groupOffsets.set(partitionKey, offset);
      return true;
    }

    return false;
  }

  /**
   * Get current offset for a consumer group
   */
  public getOffset(
    groupId: string,
    topic: string,
    partition: number
  ): number {
    const groupOffsets = this.consumerOffsets.get(groupId);
    if (!groupOffsets) {
      return 0;
    }

    const partitionKey = `${topic}-${partition}`;
    return groupOffsets.get(partitionKey) || 0;
  }

  /**
   * Reset offset for a consumer group
   */
  public resetOffset(
    groupId: string,
    topic: string,
    strategy: 'earliest' | 'latest'
  ): boolean {
    const groupOffsets = this.consumerOffsets.get(groupId);
    if (!groupOffsets) {
      return false;
    }

    const topicObj = this.topics.get(topic);
    if (!topicObj) {
      return false;
    }

    for (let partitionId = 0; partitionId < topicObj.partitions; partitionId++) {
      const partitionKey = `${topic}-${partitionId}`;
      
      if (strategy === 'earliest') {
        groupOffsets.set(partitionKey, 0);
      } else if (strategy === 'latest') {
        const latestOffset = this.partitionOffsets.get(partitionKey) || 0;
        groupOffsets.set(partitionKey, latestOffset);
      }
    }

    return true;
  }

  /**
   * Process retention and compaction policies
   */
  public processRetentionAndCompaction(deltaTime: number): void {
    const now = Date.now();

    for (const [topicName, topic] of this.topics.entries()) {
      const config = topic.config || {};
      const retentionMs = config.retentionMs || 604800000; // Default 7 days
      const retentionBytes = config.retentionBytes;
      const cleanupPolicy = config.cleanupPolicy || 'delete';

      for (let partitionId = 0; partitionId < topic.partitions; partitionId++) {
        const partitionKey = `${topicName}-${partitionId}`;
        const partitionMessages = this.messages.get(partitionKey) || [];
        
        if (partitionMessages.length === 0) continue;

        // Apply retention by time
        const validMessages = partitionMessages.filter(msg => {
          const age = now - msg.timestamp;
          return age < retentionMs;
        });

        // Apply retention by bytes
        let finalMessages = validMessages;
        if (retentionBytes && retentionBytes > 0) {
          let totalSize = 0;
          const messagesWithinBytes: KafkaMessage[] = [];
          
          // Keep messages from newest to oldest until we hit the limit
          for (let i = validMessages.length - 1; i >= 0; i--) {
            const msg = validMessages[i];
            if (totalSize + msg.size <= retentionBytes) {
              messagesWithinBytes.unshift(msg);
              totalSize += msg.size;
            } else {
              break;
            }
          }
          
          finalMessages = messagesWithinBytes;
        }

        // Apply compaction if enabled
        if (cleanupPolicy === 'compact' || cleanupPolicy === 'delete,compact') {
          // Keep only the latest message for each key
          const keyToLatestMessage = new Map<string, KafkaMessage>();
          
          for (const msg of finalMessages) {
            if (msg.key !== undefined && msg.key !== null) {
              const key = String(msg.key);
              const existing = keyToLatestMessage.get(key);
              
              if (!existing || msg.offset > existing.offset) {
                keyToLatestMessage.set(key, msg);
              }
            } else {
              // Messages without key are kept
              keyToLatestMessage.set(`__no_key_${msg.offset}`, msg);
            }
          }
          
          finalMessages = Array.from(keyToLatestMessage.values())
            .sort((a, b) => a.offset - b.offset);
        }

        // Update messages if changed
        if (finalMessages.length !== partitionMessages.length) {
          this.messages.set(partitionKey, finalMessages);
          
          // Update offsets if messages were removed
          if (finalMessages.length > 0) {
            const minOffset = finalMessages[0].offset;
            const partition = this.partitions.get(partitionKey);
            if (partition) {
              // Update high watermark if needed
              const maxOffset = finalMessages[finalMessages.length - 1].offset;
              partition.highWatermark = Math.max(partition.highWatermark, maxOffset);
            }
          }

          // Update partition state
          const partitionState = this.partitionState.get(partitionKey);
          if (partitionState) {
            partitionState.messageCount = finalMessages.length;
            const totalSize = finalMessages.reduce((sum, msg) => sum + msg.size, 0);
            partitionState.byteCount = totalSize;
            partitionState.lastUpdate = now;
          }
        }
      }

      // Update topic state
      const topicState = this.topicState.get(topicName);
      if (topicState) {
        let totalMessages = 0;
        let totalBytes = 0;
        
        for (let partitionId = 0; partitionId < topic.partitions; partitionId++) {
          const partitionKey = `${topicName}-${partitionId}`;
          const partitionState = this.partitionState.get(partitionKey);
          if (partitionState) {
            totalMessages += partitionState.messageCount;
            totalBytes += partitionState.byteCount;
          }
        }
        
        topicState.messageCount = totalMessages;
        topicState.byteCount = totalBytes;
        topicState.lastUpdate = now;
      }
    }
  }

  /**
   * Check ACL permission
   */
  public checkACLPermission(
    acls: Array<{
      principal: string;
      resourceType: string;
      resourceName: string;
      operation: string;
      permission: 'Allow' | 'Deny';
      resourcePatternType?: string;
    }>,
    principal: string,
    resourceType: string,
    resourceName: string,
    operation: string
  ): boolean {
    // No ACLs configured - default allow (Kafka default: allow if no ACLs)
    if (!acls || acls.length === 0) {
      return true;
    }

    // Find matching ACLs
    const matchingACLs = acls.filter(acl => {
      // Check principal match
      const principalMatch = acl.principal === principal || 
                            acl.principal === '*' ||
                            principal.startsWith(acl.principal);
      
      // Check resource type match
      const resourceTypeMatch = acl.resourceType === resourceType || 
                               acl.resourceType === '*';
      
      // Check resource name match
      let resourceNameMatch = false;
      if (acl.resourcePatternType === 'Literal') {
        resourceNameMatch = acl.resourceName === resourceName;
      } else if (acl.resourcePatternType === 'Prefixed') {
        resourceNameMatch = resourceName.startsWith(acl.resourceName);
      } else {
        // Default to Literal
        resourceNameMatch = acl.resourceName === resourceName || acl.resourceName === '*';
      }
      
      // Check operation match
      const operationMatch = acl.operation === operation || 
                            acl.operation === 'All';
      
      return principalMatch && resourceTypeMatch && resourceNameMatch && operationMatch;
    });

    if (matchingACLs.length === 0) {
      // No matching ACLs - default deny in Kafka (if ACLs are enabled)
      return false;
    }

    // Kafka ACL logic: Deny takes precedence over Allow
    const hasDeny = matchingACLs.some(acl => acl.permission === 'Deny');
    if (hasDeny) {
      return false;
    }

    const hasAllow = matchingACLs.some(acl => acl.permission === 'Allow');
    return hasAllow;
  }

  /**
   * Get topic metrics
   */
  public getTopicMetrics(topicName: string): {
    messages: number;
    size: number;
    partitions: number;
  } | null {
    const topic = this.topics.get(topicName);
    if (!topic) return null;

    const state = this.topicState.get(topicName);
    if (!state) return null;

    return {
      messages: state.messageCount,
      size: state.byteCount,
      partitions: topic.partitions,
    };
  }

  /**
   * Get partition metrics
   */
  public getPartitionMetrics(topicName: string, partition: number): {
    messages: number;
    size: number;
    offset: number;
    highWatermark: number;
    leader: number;
    replicas: number[];
    isr: number[];
  } | null {
    const partitionKey = `${topicName}-${partition}`;
    const state = this.partitionState.get(partitionKey);
    const partitionData = this.partitions.get(partitionKey);
    
    if (!state || !partitionData) return null;

    return {
      messages: state.messageCount,
      size: state.byteCount,
      offset: state.latestOffset,
      highWatermark: partitionData.highWatermark,
      leader: partitionData.leader,
      replicas: partitionData.replicas,
      isr: partitionData.isr,
    };
  }

  /**
   * Get all partition metrics for a topic
   */
  public getAllPartitionMetrics(topicName: string): Array<{
    partitionId: number;
    messages: number;
    size: number;
    offset: number;
    highWatermark: number;
    leader: number;
    replicas: number[];
    isr: number[];
  }> {
    const topic = this.topics.get(topicName);
    if (!topic) return [];

    const metrics: Array<{
      partitionId: number;
      messages: number;
      size: number;
      offset: number;
      highWatermark: number;
      leader: number;
      replicas: number[];
      isr: number[];
    }> = [];

    for (let partitionId = 0; partitionId < topic.partitions; partitionId++) {
      const partitionMetrics = this.getPartitionMetrics(topicName, partitionId);
      if (partitionMetrics) {
        metrics.push({
          partitionId,
          ...partitionMetrics,
        });
      }
    }

    return metrics;
  }

  /**
   * Get consumer group lag
   */
  public getConsumerGroupLag(groupId: string, topicName: string): number {
    const group = this.consumerGroups.get(groupId);
    if (!group || group.topic !== topicName) {
      return 0;
    }

    const groupOffsets = this.consumerOffsets.get(groupId);
    if (!groupOffsets) {
      return 0;
    }

    let totalLag = 0;
    const topic = this.topics.get(topicName);
    if (!topic) return 0;

    for (let partitionId = 0; partitionId < topic.partitions; partitionId++) {
      const partitionKey = `${topicName}-${partitionId}`;
      const partition = this.partitions.get(partitionKey);
      if (!partition) continue;

      const consumerOffset = groupOffsets.get(partitionKey) || 0;
      const latestOffset = partition.highWatermark;
      const lag = Math.max(0, latestOffset - consumerOffset);
      totalLag += lag;
    }

    return totalLag;
  }

  /**
   * Get number of under-replicated partitions
   */
  public getUnderReplicatedPartitions(): number {
    let underReplicated = 0;

    for (const partition of this.partitions.values()) {
      const expectedReplicas = partition.replicas.length;
      const actualISR = partition.isr.length;

      if (actualISR < expectedReplicas) {
        underReplicated++;
      }
    }

    return underReplicated;
  }

  /**
   * Get partition assignment for a consumer group
   */
  public getPartitionAssignment(groupId: string): Map<number, number[]> | null {
    const group = this.consumerGroups.get(groupId);
    if (!group) {
      return null;
    }
    return group.partitionAssignment;
  }

  /**
   * Get consumer group state
   */
  public getConsumerGroupState(groupId: string): ConsumerGroupState | null {
    return this.consumerGroups.get(groupId) || null;
  }

  /**
   * Create or update consumer group dynamically
   * Used for automatic consumer group creation from connections
   */
  public createOrUpdateConsumerGroup(
    groupId: string,
    topicName: string,
    memberCount: number = 1,
    offsetStrategy: 'earliest' | 'latest' | 'none' = 'latest',
    autoCommit: boolean = true
  ): boolean {
    const topic = this.topics.get(topicName);
    if (!topic) {
      return false; // Topic doesn't exist
    }

    const existingGroup = this.consumerGroups.get(groupId);
    const needsRebalance = existingGroup && existingGroup.members !== memberCount;

    if (needsRebalance) {
      // Start rebalancing
      existingGroup!.isRebalancing = true;
      existingGroup!.rebalanceEndTime = Date.now() + 2000; // 2 second rebalance pause
    }

    const groupState: ConsumerGroupState = {
      id: groupId,
      topic: topicName,
      members: memberCount,
      partitionAssignment: new Map(),
      offsetStrategy: existingGroup?.offsetStrategy || offsetStrategy,
      autoCommit: existingGroup?.autoCommit !== false ? autoCommit : existingGroup.autoCommit,
      isRebalancing: needsRebalance || false,
      rebalanceEndTime: needsRebalance ? Date.now() + 2000 : undefined,
    };

    // Assign partitions to consumers
    this.assignPartitionsToConsumers(
      groupId,
      memberCount,
      Array.from({ length: topic.partitions }, (_, i) => i)
    );

    // Initialize offsets if new group
    if (!existingGroup) {
      this.consumerOffsets.set(groupId, new Map());
      
      if (groupState.offsetStrategy === 'earliest') {
        for (let partitionId = 0; partitionId < topic.partitions; partitionId++) {
          const partitionKey = `${topicName}-${partitionId}`;
          const offsets = this.consumerOffsets.get(groupId)!;
          offsets.set(partitionKey, 0);
        }
      } else if (groupState.offsetStrategy === 'latest') {
        for (let partitionId = 0; partitionId < topic.partitions; partitionId++) {
          const partitionKey = `${topicName}-${partitionId}`;
          const offsets = this.consumerOffsets.get(groupId)!;
          const latestOffset = this.partitionOffsets.get(partitionKey) || 0;
          offsets.set(partitionKey, latestOffset);
        }
      }
    }

    this.consumerGroups.set(groupId, groupState);
    return true;
  }

  /**
   * Update member count for a consumer group and trigger rebalancing if needed
   */
  public updateConsumerGroupMembers(groupId: string, memberCount: number): boolean {
    const group = this.consumerGroups.get(groupId);
    if (!group) {
      return false;
    }

    if (group.members === memberCount) {
      return true; // No change needed
    }

    const topic = this.topics.get(group.topic);
    if (!topic) {
      return false;
    }

    // Start rebalancing
    group.isRebalancing = true;
    group.rebalanceEndTime = Date.now() + 2000; // 2 second rebalance pause
    group.members = memberCount;

    // Reassign partitions
    this.assignPartitionsToConsumers(
      groupId,
      memberCount,
      Array.from({ length: topic.partitions }, (_, i) => i)
    );

    return true;
  }

  /**
   * Check and complete rebalancing if time has passed
   */
  public checkRebalancing(): void {
    const now = Date.now();
    for (const group of this.consumerGroups.values()) {
      if (group.isRebalancing && group.rebalanceEndTime && now >= group.rebalanceEndTime) {
        group.isRebalancing = false;
        group.rebalanceEndTime = undefined;
      }
    }
  }

  /**
   * Get consumption rate for a consumer group (messages per second)
   */
  public getConsumptionRate(groupId: string, topicName: string): number {
    const group = this.consumerGroups.get(groupId);
    if (!group || group.topic !== topicName) {
      return 0;
    }

    // Calculate based on member count and typical batch size
    // This is an approximation - in real Kafka, it depends on actual consumption
    const batchSize = 500; // Default batch size
    const pollInterval = 0.5; // 500ms default poll interval
    const messagesPerSecond = (group.members * batchSize) / pollInterval;
    
    return messagesPerSecond;
  }

  /**
   * Update broker health status
   * Called periodically to check broker health
   */
  public updateBrokerHealth(brokerHealthStatus: Map<number, boolean>): void {
    const now = Date.now();
    for (const [brokerId, isHealthy] of brokerHealthStatus.entries()) {
      const health = this.brokerHealth.get(brokerId);
      if (health) {
        if (!isHealthy) {
          health.consecutiveFailures++;
          // Mark as unhealthy after 3 consecutive failures
          if (health.consecutiveFailures >= 3) {
            health.isHealthy = false;
          }
        } else {
          health.consecutiveFailures = 0;
          health.isHealthy = true;
        }
        health.lastHealthCheck = now;
      }
    }
    
    // Update ISR and trigger leader election if needed
    this.updateISRAndLeaderElection();
  }

  /**
   * Update ISR (In-Sync Replicas) based on broker health
   * and trigger leader election if current leader is down
   */
  private updateISRAndLeaderElection(): void {
    for (const [partitionKey, partition] of this.partitions.entries()) {
      const topic = this.topics.get(partition.topicName);
      if (!topic) continue;
      
      // Update ISR: only include healthy replicas
      const healthyReplicas = partition.replicas.filter(brokerId => {
        const health = this.brokerHealth.get(brokerId);
        return health?.isHealthy !== false;
      });
      
      partition.isr = healthyReplicas;
      
      // Check if leader is healthy
      const leaderHealth = this.brokerHealth.get(partition.leader);
      const isLeaderHealthy = leaderHealth?.isHealthy !== false;
      
      // Trigger leader election if leader is down
      if (!isLeaderHealthy && partition.isr.length > 0) {
        this.electNewLeader(partitionKey, partition);
      }
      
      // If no healthy replicas in ISR, try to recover by selecting any available replica
      if (partition.isr.length === 0 && partition.replicas.length > 0) {
        // In real Kafka, this would require manual intervention
        // For simulation, we'll try to recover by checking if any replica becomes healthy
        const anyReplica = partition.replicas.find(brokerId => {
          const health = this.brokerHealth.get(brokerId);
          return health?.isHealthy === true;
        });
        
        if (anyReplica !== undefined) {
          partition.leader = anyReplica;
          partition.isr = [anyReplica];
        }
      }
    }
  }

  /**
   * Elect a new leader for a partition
   * Uses the first available replica from ISR (preferred replica election)
   */
  private electNewLeader(partitionKey: string, partition: KafkaPartition): void {
    if (partition.isr.length === 0) {
      // No healthy replicas available
      return;
    }
    
    // Preferred replica election: select the first replica from ISR
    // In real Kafka, this could be configured (preferred leader)
    const newLeader = partition.isr[0];
    
    // Only update if leader actually changed
    if (newLeader !== partition.leader) {
      partition.leader = newLeader;
      
      // Log leader election (in real implementation, this would be an event)
      console.log(`[Kafka] Leader election for partition ${partitionKey}: new leader = broker ${newLeader}`);
    }
  }

  /**
   * Get broker health status
   */
  public getBrokerHealth(brokerId: number): { isHealthy: boolean; lastHealthCheck: number; consecutiveFailures: number } | null {
    return this.brokerHealth.get(brokerId) || null;
  }

  /**
   * Get all broker health statuses
   */
  public getAllBrokerHealth(): Map<number, { isHealthy: boolean; lastHealthCheck: number; consecutiveFailures: number }> {
    return new Map(this.brokerHealth);
  }

  /**
   * Hash key for partition assignment using MurmurHash2 algorithm
   * This matches Kafka's default partitioner behavior
   */
  private hashKey(key: string): number {
    // MurmurHash2 implementation (32-bit)
    // This is the same algorithm used by Kafka's default partitioner
    const m = 0x5bd1e995;
    const r = 24;
    let h = 0;
    let len = key.length;
    let k: number;
    
    // Process 4 bytes at a time
    let i = 0;
    while (len >= 4) {
      k = key.charCodeAt(i) |
          (key.charCodeAt(i + 1) << 8) |
          (key.charCodeAt(i + 2) << 16) |
          (key.charCodeAt(i + 3) << 24);
      
      k = ((k & 0xffff) * m) + ((((k >>> 16) * m) & 0xffff) << 16);
      k ^= k >>> r;
      k = ((k & 0xffff) * m) + ((((k >>> 16) * m) & 0xffff) << 16);
      
      h = ((h & 0xffff) * m) + ((((h >>> 16) * m) & 0xffff) << 16);
      h ^= k;
      
      i += 4;
      len -= 4;
    }
    
    // Handle remaining bytes
    switch (len) {
      case 3:
        h ^= key.charCodeAt(i + 2) << 16;
      case 2:
        h ^= key.charCodeAt(i + 1) << 8;
      case 1:
        h ^= key.charCodeAt(i);
        h = ((h & 0xffff) * m) + ((((h >>> 16) * m) & 0xffff) << 16);
    }
    
    // Finalize hash
    h ^= h >>> 13;
    h = ((h & 0xffff) * m) + ((((h >>> 16) * m) & 0xffff) << 16);
    h ^= h >>> 15;
    
    // Return positive 32-bit integer
    return h >>> 0;
  }
}

/**
 * Redis Routing Engine
 * Handles Redis key-value operations, data structures, TTL, memory management, and clustering
 */

export type RedisDataType = 'string' | 'hash' | 'list' | 'set' | 'zset' | 'stream';

export interface RedisKey {
  key: string;
  type: RedisDataType;
  ttl?: number; // seconds, -1 for no expiry
  expiresAt?: number; // timestamp when key expires
  value?: any;
  size?: number; // bytes
}

export interface RedisHashField {
  field: string;
  value: string;
}

export interface RedisListElement {
  value: string;
  index: number;
}

export interface RedisSetMember {
  member: string;
}

export interface RedisZSetMember {
  member: string;
  score: number;
}

export interface RedisStreamEntry {
  id: string;
  fields: Record<string, string>;
}

export interface RedisStreamConsumerGroup {
  name: string;
  lastDeliveredId: string;
  pendingEntries: Map<string, {
    consumer: string;
    deliveryTime: number;
    deliveryCount: number;
  }>;
  consumers: Map<string, {
    name: string;
    seenTime: number;
    pendingCount: number;
  }>;
}

export interface RedisStream {
  entries: RedisStreamEntry[];
  groups: Map<string, RedisStreamConsumerGroup>;
  maxLength?: number; // For XTRIM MAXLEN
  lastId: string; // Last generated ID
}

export interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  database?: number;
  maxMemory?: string; // e.g., "256mb"
  maxMemoryPolicy?: 'noeviction' | 'allkeys-lru' | 'allkeys-lfu' | 'volatile-lru' | 'volatile-lfu' | 'volatile-ttl' | 'volatile-random' | 'allkeys-random';
  enablePersistence?: boolean;
  persistenceType?: 'rdb' | 'aof' | 'both';
  enableCluster?: boolean;
  clusterNodes?: string[];
  keys?: RedisKey[];
}

export interface RedisCommandResult {
  success: boolean;
  value?: any;
  error?: string;
  latency?: number;
}

export interface SlowLogEntry {
  id: number;
  timestamp: number;
  duration: number; // microseconds
  command: string;
  args: string[];
  client: string;
}

export interface CommandStatistics {
  command: string;
  calls: number;
  totalDuration: number; // microseconds
  averageDuration: number; // microseconds
}

export interface ConnectedClient {
  id: string;
  addr: string;
  fd: number;
  name: string;
  age: number; // seconds
  idle: number; // seconds
  flags: string;
  db: number;
  sub: number;
  psub: number;
  multi: number;
  qbuf: number;
  qbufFree: number;
  obl: number;
  oll: number;
  omem: number;
  events: string;
  cmd: string;
}

export interface RedisMetrics {
  totalKeys: number;
  keysByType: Record<RedisDataType, number>;
  memoryUsage: number; // bytes
  memoryUsagePercent: number; // percentage of maxMemory
  operationsPerSecond: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  expiredKeys: number;
  evictedKeys: number;
  connectedClients: number;
  // Extended metrics
  slowlog: SlowLogEntry[];
  commandStatistics: CommandStatistics[];
  networkBytesIn: number;
  networkBytesOut: number;
  connectedClientsDetail: ConnectedClient[];
}

export interface PubSubSubscriber {
  clientId: string;
  subscribedAt: number;
  messageCount: number;
}

export interface PubSubChannel {
  name: string;
  subscribers: Map<string, PubSubSubscriber>; // clientId -> subscriber
  messageCount: number;
  lastMessageAt?: number;
}

export interface PubSubPattern {
  pattern: string;
  regex: RegExp;
  subscribers: Map<string, PubSubSubscriber>; // clientId -> subscriber
}

/**
 * Redis Routing Engine
 * Simulates Redis key-value store behavior
 */
export class RedisRoutingEngine {
  private keys: Map<string, RedisKey> = new Map(); // key -> RedisKey
  private config: RedisConfig = {};
  private maxMemoryBytes: number = 256 * 1024 * 1024; // 256MB default
  private currentMemoryUsage: number = 0;
  
  // Metrics
  private metrics: RedisMetrics = {
    totalKeys: 0,
    keysByType: {
      string: 0,
      hash: 0,
      list: 0,
      set: 0,
      zset: 0,
      stream: 0,
    },
    memoryUsage: 0,
    memoryUsagePercent: 0,
    operationsPerSecond: 0,
    hitCount: 0,
    missCount: 0,
    hitRate: 0,
    expiredKeys: 0,
    evictedKeys: 0,
    connectedClients: 0,
    slowlog: [],
    commandStatistics: [],
    networkBytesIn: 0,
    networkBytesOut: 0,
    connectedClientsDetail: [],
  };
  
  private operationCount: number = 0;
  private lastMetricsUpdate: number = Date.now();
  private operationHistory: Array<{ timestamp: number; command: string; duration: number }> = [];
  
  // For cluster mode
  private clusterSlots: Map<number, string> = new Map(); // slot -> node
  private clusterNodes: string[] = [];
  
  // For server commands
  private lastSaveTime: number = 0;
  private serverConfig: Map<string, string> = new Map();
  
  // Extended metrics tracking
  private slowlog: SlowLogEntry[] = [];
  private maxSlowlogEntries: number = 128;
  private slowlogThreshold: number = 10000; // microseconds (10ms default)
  private commandStats: Map<string, { calls: number; totalDuration: number }> = new Map();
  private networkBytesIn: number = 0;
  private networkBytesOut: number = 0;
  private slowlogIdCounter: number = 0;
  private connectedClientsDetail: ConnectedClient[] = [];
  
  // Pub/Sub
  private pubSubChannels: Map<string, PubSubChannel> = new Map(); // channel name -> channel
  private pubSubPatterns: Map<string, PubSubPattern> = new Map(); // pattern -> pattern subscribers
  private pubSubClientIdCounter: number = 0;
  
  /**
   * Initialize with Redis configuration
   */
  public initialize(config: RedisConfig) {
    this.config = { ...config };
    this.keys.clear();
    this.currentMemoryUsage = 0;
    this.operationCount = 0;
    this.lastMetricsUpdate = Date.now();
    this.operationHistory = [];
    
    // Reset extended metrics
    this.slowlog = [];
    this.slowlogIdCounter = 0;
    this.commandStats.clear();
    this.networkBytesIn = 0;
    this.networkBytesOut = 0;
    this.connectedClientsDetail = [];
    
    // Reset Pub/Sub
    this.pubSubChannels.clear();
    this.pubSubPatterns.clear();
    this.pubSubClientIdCounter = 0;
    
    // Parse maxMemory
    if (config.maxMemory) {
      this.maxMemoryBytes = this.parseMemorySize(config.maxMemory);
    }
    
    // Initialize cluster if enabled
    if (config.enableCluster && config.clusterNodes) {
      this.clusterNodes = [...config.clusterNodes];
      this.initializeClusterSlots();
    }
    
    // Load initial keys from config
    // Check if keys is an array (not a number representing key count)
    if (config.keys && Array.isArray(config.keys)) {
      for (const key of config.keys) {
        this.setKey(key.key, key.type, key.value, key.ttl);
      }
    }
    
    // Update metrics
    this.updateMetrics();
  }
  
  /**
   * Parse memory size string (e.g., "256mb", "1gb") to bytes
   */
  private parseMemorySize(size: string): number {
    const match = size.match(/^(\d+)([kmg]?b?)$/i);
    if (!match) return 256 * 1024 * 1024; // default 256MB
    
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    switch (unit) {
      case 'kb':
        return value * 1024;
      case 'mb':
        return value * 1024 * 1024;
      case 'gb':
        return value * 1024 * 1024 * 1024;
      default:
        return value; // assume bytes
    }
  }
  
  /**
   * Initialize cluster slots (16384 slots distributed across nodes)
   */
  private initializeClusterSlots() {
    if (this.clusterNodes.length === 0) return;
    
    const slotsPerNode = Math.floor(16384 / this.clusterNodes.length);
    let slot = 0;
    
    for (let i = 0; i < this.clusterNodes.length; i++) {
      const endSlot = i === this.clusterNodes.length - 1 ? 16383 : slot + slotsPerNode - 1;
      for (let s = slot; s <= endSlot; s++) {
        this.clusterSlots.set(s, this.clusterNodes[i]);
      }
      slot = endSlot + 1;
    }
  }
  
  /**
   * Get cluster slot for a key (CRC16 hash)
   */
  private getClusterSlot(key: string): number {
    // Simplified CRC16 implementation for Redis cluster
    const crc16Table = [
      0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50a5, 0x60c6, 0x70e7,
      0x8108, 0x9129, 0xa14a, 0xb16b, 0xc18c, 0xd1ad, 0xe1ce, 0xf1ef,
    ];
    
    let crc = 0;
    for (let i = 0; i < key.length; i++) {
      const byte = key.charCodeAt(i);
      crc = ((crc << 8) ^ crc16Table[((crc >> 8) ^ byte) & 0xff]) & 0xffff;
    }
    
    return crc % 16384;
  }
  
  /**
   * Check if key should be handled by this node (cluster mode)
   */
  private isKeyForThisNode(key: string): boolean {
    if (!this.config.enableCluster || this.clusterNodes.length === 0) {
      return true; // Standalone mode
    }
    
    const slot = this.getClusterSlot(key);
    const node = this.clusterSlots.get(slot);
    // In simulation, we assume this is the primary node
    // In real cluster, we'd check if node matches current node
    return true; // Simplified: all keys handled by this node
  }
  
  /**
   * Execute Redis command
   */
  public executeCommand(command: string, args: string[]): RedisCommandResult {
    const startTime = Date.now();
    const cmd = command.toUpperCase();
    
    try {
      let result: any;
      
      switch (cmd) {
        // String commands
        case 'GET':
          result = this.get(args[0]);
          break;
        case 'SET':
          result = this.set(args[0], args[1], args[2] ? parseInt(args[2]) : undefined);
          break;
        case 'INCR':
          result = this.incr(args[0]);
          break;
        case 'DECR':
          result = this.decr(args[0]);
          break;
        case 'INCRBY':
          result = this.incrby(args[0], parseInt(args[1]));
          break;
        case 'DECRBY':
          result = this.decrby(args[0], parseInt(args[1]));
          break;
        case 'APPEND':
          result = this.append(args[0], args[1]);
          break;
        case 'GETSET':
          result = this.getset(args[0], args[1]);
          break;
        case 'MGET':
          result = this.mget(args);
          break;
        case 'MSET':
          result = this.mset(args);
          break;
        case 'MSETNX':
          result = this.msetnx(args);
          break;
        case 'STRLEN':
          result = this.strlen(args[0]);
          break;
        case 'GETRANGE':
          result = this.getrange(args[0], parseInt(args[1]), parseInt(args[2]));
          break;
        case 'SETRANGE':
          result = this.setrange(args[0], parseInt(args[1]), args[2]);
          break;
        case 'DEL':
          result = this.del(args);
          break;
        case 'EXISTS':
          result = this.exists(args);
          break;
        case 'EXPIRE':
          result = this.expire(args[0], parseInt(args[1]));
          break;
        case 'TTL':
          result = this.ttl(args[0]);
          break;
        case 'KEYS':
          result = this.keys(args[0] || '*');
          break;
        case 'SCAN':
          result = this.scan(args);
          break;
        case 'RENAME':
          result = this.rename(args[0], args[1]);
          break;
        case 'RENAMENX':
          result = this.renamenx(args[0], args[1]);
          break;
        case 'TYPE':
          result = this.type(args[0]);
          break;
        case 'RANDOMKEY':
          result = this.randomkey();
          break;
        case 'PERSIST':
          result = this.persist(args[0]);
          break;
        
        // Hash commands
        case 'HGET':
          result = this.hget(args[0], args[1]);
          break;
        case 'HSET':
          result = this.hset(args[0], args.slice(1));
          break;
        case 'HMSET':
          result = this.hmset(args[0], args.slice(1));
          break;
        case 'HMGET':
          result = this.hmget(args[0], args.slice(1));
          break;
        case 'HINCRBY':
          result = this.hincrby(args[0], args[1], parseInt(args[2]));
          break;
        case 'HINCRBYFLOAT':
          result = this.hincrbyfloat(args[0], args[1], parseFloat(args[2]));
          break;
        case 'HEXISTS':
          result = this.hexists(args[0], args[1]);
          break;
        case 'HLEN':
          result = this.hlen(args[0]);
          break;
        case 'HSTRLEN':
          result = this.hstrlen(args[0], args[1]);
          break;
        case 'HGETALL':
          result = this.hgetall(args[0]);
          break;
        case 'HDEL':
          result = this.hdel(args[0], args.slice(1));
          break;
        case 'HKEYS':
          result = this.hkeys(args[0]);
          break;
        case 'HVALS':
          result = this.hvals(args[0]);
          break;
        
        // List commands
        case 'LPUSH':
          result = this.lpush(args[0], args.slice(1));
          break;
        case 'RPUSH':
          result = this.rpush(args[0], args.slice(1));
          break;
        case 'LPOP':
          result = this.lpop(args[0]);
          break;
        case 'RPOP':
          result = this.rpop(args[0]);
          break;
        case 'LINDEX':
          result = this.lindex(args[0], parseInt(args[1]));
          break;
        case 'LSET':
          result = this.lset(args[0], parseInt(args[1]), args[2]);
          break;
        case 'LTRIM':
          result = this.ltrim(args[0], parseInt(args[1]), parseInt(args[2]));
          break;
        case 'LINSERT':
          result = this.linsert(args[0], args[1], args[2], args[3]);
          break;
        case 'RPOPLPUSH':
          result = this.rpoplpush(args[0], args[1]);
          break;
        case 'BLPOP':
          result = this.blpop(args);
          break;
        case 'BRPOP':
          result = this.brpop(args);
          break;
        case 'LLEN':
          result = this.llen(args[0]);
          break;
        case 'LRANGE':
          result = this.lrange(args[0], parseInt(args[1]), parseInt(args[2]));
          break;
        
        // Set commands
        case 'SADD':
          result = this.sadd(args[0], args.slice(1));
          break;
        case 'SREM':
          result = this.srem(args[0], args.slice(1));
          break;
        case 'SMEMBERS':
          result = this.smembers(args[0]);
          break;
        case 'SISMEMBER':
          result = this.sismember(args[0], args[1]);
          break;
        case 'SCARD':
          result = this.scard(args[0]);
          break;
        case 'SINTER':
          result = this.sinter(args);
          break;
        case 'SUNION':
          result = this.sunion(args);
          break;
        case 'SDIFF':
          result = this.sdiff(args);
          break;
        case 'SINTERSTORE':
          result = this.sinterstore(args[0], args.slice(1));
          break;
        case 'SUNIONSTORE':
          result = this.sunionstore(args[0], args.slice(1));
          break;
        case 'SDIFFSTORE':
          result = this.sdiffstore(args[0], args.slice(1));
          break;
        case 'SMOVE':
          result = this.smove(args[0], args[1], args[2]);
          break;
        case 'SPOP':
          result = this.spop(args[0], args[1] ? parseInt(args[1]) : 1);
          break;
        case 'SRANDMEMBER':
          result = this.srandmember(args[0], args[1] ? parseInt(args[1]) : 1);
          break;
        
        // Sorted Set commands
        case 'ZADD':
          result = this.zadd(args[0], args.slice(1));
          break;
        case 'ZREM':
          result = this.zrem(args[0], args.slice(1));
          break;
        case 'ZRANGE':
          result = this.zrange(args[0], parseInt(args[1]), parseInt(args[2]), args[3] === 'WITHSCORES');
          break;
        case 'ZREVRANGE':
          result = this.zrevrange(args[0], parseInt(args[1]), parseInt(args[2]), args[3] === 'WITHSCORES');
          break;
        case 'ZRANGEBYSCORE':
          result = this.zrangebyscore(args[0], args[1], args[2], args.slice(3));
          break;
        case 'ZREVRANGEBYSCORE':
          result = this.zrevrangebyscore(args[0], args[1], args[2], args.slice(3));
          break;
        case 'ZRANK':
          result = this.zrank(args[0], args[1]);
          break;
        case 'ZREVRANK':
          result = this.zrevrank(args[0], args[1]);
          break;
        case 'ZINCRBY':
          result = this.zincrby(args[0], parseFloat(args[1]), args[2]);
          break;
        case 'ZCOUNT':
          result = this.zcount(args[0], args[1], args[2]);
          break;
        case 'ZREMRANGEBYSCORE':
          result = this.zremrangebyscore(args[0], args[1], args[2]);
          break;
        case 'ZREMRANGEBYRANK':
          result = this.zremrangebyrank(args[0], parseInt(args[1]), parseInt(args[2]));
          break;
        case 'ZUNIONSTORE':
          result = this.zunionstore(args[0], args.slice(1));
          break;
        case 'ZINTERSTORE':
          result = this.zinterstore(args[0], args.slice(1));
          break;
        case 'ZSCORE':
          result = this.zscore(args[0], args[1]);
          break;
        case 'ZCARD':
          result = this.zcard(args[0]);
          break;
        
        // Stream commands
        case 'XADD':
          result = this.xadd(args[0], args.slice(1));
          break;
        case 'XREAD':
          result = this.xread(args);
          break;
        case 'XRANGE':
          result = this.xrange(args[0], args[1], args[2], args[3] ? parseInt(args[3]) : undefined);
          break;
        case 'XREVRANGE':
          result = this.xrevrange(args[0], args[1], args[2], args[3] ? parseInt(args[3]) : undefined);
          break;
        case 'XREADGROUP':
          result = this.xreadgroup(args);
          break;
        case 'XACK':
          result = this.xack(args[0], args[1], args.slice(2));
          break;
        case 'XPENDING':
          result = this.xpending(args);
          break;
        case 'XCLAIM':
          result = this.xclaim(args);
          break;
        case 'XDEL':
          result = this.xdel(args[0], args.slice(1));
          break;
        case 'XTRIM':
          result = this.xtrim(args[0], args.slice(1));
          break;
        case 'XINFO':
          result = this.xinfo(args);
          break;
        
        // Pub/Sub commands
        case 'PUBLISH':
          result = this.publish(args[0], args[1]);
          break;
        case 'SUBSCRIBE':
          result = this.subscribe(args);
          break;
        case 'PSUBSCRIBE':
          result = this.psubscribe(args);
          break;
        case 'UNSUBSCRIBE':
          result = this.unsubscribe(args.length > 0 ? args : undefined);
          break;
        case 'PUNSUBSCRIBE':
          result = this.punsubscribe(args.length > 0 ? args : undefined);
          break;
        case 'PUBSUB':
          result = this.pubsub(args);
          break;
        
        // Server commands
        case 'FLUSHDB':
          result = this.flushdb();
          break;
        case 'FLUSHALL':
          result = this.flushall();
          break;
        case 'SAVE':
          result = this.save();
          break;
        case 'BGSAVE':
          result = this.bgsave();
          break;
        case 'LASTSAVE':
          result = this.lastsave();
          break;
        case 'SHUTDOWN':
          result = this.shutdown(args);
          break;
        case 'CONFIG':
          result = this.config(args);
          break;
        case 'CLIENT':
          result = this.client(args);
          break;
        case 'SLOWLOG':
          result = this.slowlogCommand(args);
          break;
        
        // Info commands
        case 'PING':
          result = 'PONG';
          break;
        case 'INFO':
          result = this.info(args[0]);
          break;
        case 'DBSIZE':
          result = this.dbsize();
          break;
        
        default:
          return {
            success: false,
            error: `Unknown command: ${command}`,
            latency: Date.now() - startTime,
          };
      }
      
      const latency = Date.now() - startTime;
      const latencyMicroseconds = latency * 1000; // Convert to microseconds
      
      // Track command statistics
      this.trackCommandStats(cmd, latencyMicroseconds);
      
      // Track network I/O (approximate)
      const commandSize = JSON.stringify({ command: cmd, args }).length;
      const resultSize = JSON.stringify(result).length;
      this.networkBytesIn += commandSize;
      this.networkBytesOut += resultSize;
      
      // Add to slowlog if threshold exceeded
      if (latencyMicroseconds >= this.slowlogThreshold) {
        this.addToSlowlog(cmd, args, latencyMicroseconds);
      }
      
      this.recordOperation(cmd, latencyMicroseconds);
      
      return {
        success: true,
        value: result,
        latency,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - startTime,
      };
    }
  }
  
  /**
   * Record operation for metrics
   */
  private recordOperation(command: string, duration: number) {
    this.operationCount++;
    this.operationHistory.push({ timestamp: Date.now(), command, duration });
    
    // Keep only last 1000 operations for metrics
    if (this.operationHistory.length > 1000) {
      this.operationHistory.shift();
    }
  }
  
  /**
   * Track command statistics
   */
  private trackCommandStats(command: string, duration: number) {
    const stats = this.commandStats.get(command) || { calls: 0, totalDuration: 0 };
    stats.calls++;
    stats.totalDuration += duration;
    this.commandStats.set(command, stats);
  }
  
  /**
   * Add entry to slowlog
   */
  private addToSlowlog(command: string, args: string[], duration: number) {
    const entry: SlowLogEntry = {
      id: this.slowlogIdCounter++,
      timestamp: Date.now(),
      duration,
      command,
      args: args.slice(0, 10), // Limit args for display
      client: `127.0.0.1:${this.config.port || 6379}`,
    };
    
    this.slowlog.unshift(entry);
    
    // Keep only maxSlowlogEntries
    if (this.slowlog.length > this.maxSlowlogEntries) {
      this.slowlog.pop();
    }
  }
  
  /**
   * Get slowlog entries
   */
  public getSlowlog(count?: number): SlowLogEntry[] {
    if (count !== undefined) {
      return this.slowlog.slice(0, count);
    }
    return [...this.slowlog];
  }
  
  /**
   * Clear slowlog
   */
  public clearSlowlog(): void {
    this.slowlog = [];
    this.slowlogIdCounter = 0;
  }
  
  // String commands
  private get(key: string): string | null {
    if (!this.isKeyForThisNode(key)) {
      throw new Error('MOVED - key belongs to different node');
    }
    
    const redisKey = this.keys.get(key);
    if (!redisKey) {
      this.metrics.missCount++;
      return null;
    }
    
    // Check expiration
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      this.metrics.missCount++;
      return null;
    }
    
    this.metrics.hitCount++;
    return typeof redisKey.value === 'string' ? redisKey.value : JSON.stringify(redisKey.value);
  }
  
  private set(key: string, value: string, ttl?: number): 'OK' {
    if (!this.isKeyForThisNode(key)) {
      throw new Error('MOVED - key belongs to different node');
    }
    
    // Check memory and evict if needed
    this.checkMemoryAndEvict();
    
    const existingKey = this.keys.get(key);
    if (existingKey) {
      this.currentMemoryUsage -= this.calculateKeySize(existingKey);
    }
    
    const redisKey: RedisKey = {
      key,
      type: 'string',
      value,
      ttl: ttl !== undefined ? ttl : existingKey?.ttl,
      expiresAt: ttl !== undefined && ttl > 0 ? Date.now() + ttl * 1000 : existingKey?.expiresAt,
      size: this.estimateSize(value),
    };
    
    this.keys.set(key, redisKey);
    this.currentMemoryUsage += this.calculateKeySize(redisKey);
    
    return 'OK';
  }
  
  private del(keys: string[]): number {
    let deleted = 0;
    for (const key of keys) {
      if (this.deleteKey(key)) {
        deleted++;
      }
    }
    return deleted;
  }
  
  private exists(keys: string[]): number {
    let count = 0;
    for (const key of keys) {
      const redisKey = this.keys.get(key);
      if (redisKey && !this.isExpired(redisKey)) {
        count++;
      }
    }
    return count;
  }
  
  private expire(key: string, seconds: number): number {
    const redisKey = this.keys.get(key);
    if (!redisKey) {
      return 0;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return 0;
    }
    
    redisKey.ttl = seconds;
    redisKey.expiresAt = seconds > 0 ? Date.now() + seconds * 1000 : undefined;
    return 1;
  }
  
  private ttl(key: string): number {
    const redisKey = this.keys.get(key);
    if (!redisKey) {
      return -2; // Key doesn't exist
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return -2;
    }
    
    if (!redisKey.expiresAt) {
      return -1; // No expiry
    }
    
    const remaining = Math.floor((redisKey.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }
  
  private keys(pattern: string): string[] {
    const regex = this.patternToRegex(pattern);
    const result: string[] = [];
    const now = Date.now();
    
    for (const [key, redisKey] of this.keys.entries()) {
      if (this.isExpired(redisKey)) {
        this.deleteKey(key);
        continue;
      }
      
      if (regex.test(key)) {
        result.push(key);
      }
    }
    
    return result;
  }
  
  // Additional Keys commands
  private scan(args: string[]): [string, string[]] {
    // SCAN cursor [MATCH pattern] [COUNT count]
    let cursor = parseInt(args[0]) || 0;
    let pattern = '*';
    let count = 10;
    
    for (let i = 1; i < args.length; i++) {
      if (args[i] === 'MATCH' && i + 1 < args.length) {
        pattern = args[i + 1];
        i++;
      } else if (args[i] === 'COUNT' && i + 1 < args.length) {
        count = parseInt(args[i + 1]);
        i++;
      }
    }
    
    this.cleanupExpiredKeys();
    const allKeys = Array.from(this.keys.keys());
    const regex = this.patternToRegex(pattern);
    const filtered = allKeys.filter(key => regex.test(key));
    
    const start = cursor;
    const end = Math.min(start + count, filtered.length);
    const result = filtered.slice(start, end);
    const nextCursor = end >= filtered.length ? 0 : end;
    
    return [nextCursor.toString(), result];
  }
  
  private rename(key: string, newKey: string): 'OK' {
    const redisKey = this.keys.get(key);
    if (!redisKey) {
      throw new Error('ERR no such key');
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      throw new Error('ERR no such key');
    }
    
    // Remove old key
    this.keys.delete(key);
    
    // Check if newKey exists and remove it
    const existingNewKey = this.keys.get(newKey);
    if (existingNewKey) {
      this.currentMemoryUsage -= this.calculateKeySize(existingNewKey);
    }
    
    // Set new key
    redisKey.key = newKey;
    this.keys.set(newKey, redisKey);
    
    return 'OK';
  }
  
  private renamenx(key: string, newKey: string): number {
    const redisKey = this.keys.get(key);
    if (!redisKey) {
      throw new Error('ERR no such key');
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      throw new Error('ERR no such key');
    }
    
    // Check if newKey exists
    if (this.keys.has(newKey)) {
      const existing = this.keys.get(newKey)!;
      if (!this.isExpired(existing)) {
        return 0; // New key exists
      }
    }
    
    // Remove old key
    this.keys.delete(key);
    
    // Set new key
    redisKey.key = newKey;
    this.keys.set(newKey, redisKey);
    
    return 1;
  }
  
  private type(key: string): string {
    const redisKey = this.keys.get(key);
    if (!redisKey) {
      return 'none';
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return 'none';
    }
    
    return redisKey.type;
  }
  
  private randomkey(): string | null {
    this.cleanupExpiredKeys();
    const keys = Array.from(this.keys.keys());
    if (keys.length === 0) {
      return null;
    }
    return keys[Math.floor(Math.random() * keys.length)];
  }
  
  private persist(key: string): number {
    const redisKey = this.keys.get(key);
    if (!redisKey) {
      return 0;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return 0;
    }
    
    if (redisKey.expiresAt) {
      redisKey.ttl = -1;
      redisKey.expiresAt = undefined;
      return 1;
    }
    
    return 0;
  }
  
  // Additional String commands
  private incr(key: string): number {
    const current = this.get(key);
    const value = current ? parseInt(current) : 0;
    if (isNaN(value)) {
      throw new Error('ERR value is not an integer or out of range');
    }
    const newValue = value + 1;
    this.set(key, newValue.toString());
    return newValue;
  }
  
  private decr(key: string): number {
    const current = this.get(key);
    const value = current ? parseInt(current) : 0;
    if (isNaN(value)) {
      throw new Error('ERR value is not an integer or out of range');
    }
    const newValue = value - 1;
    this.set(key, newValue.toString());
    return newValue;
  }
  
  private incrby(key: string, increment: number): number {
    const current = this.get(key);
    const value = current ? parseInt(current) : 0;
    if (isNaN(value) || isNaN(increment)) {
      throw new Error('ERR value is not an integer or out of range');
    }
    const newValue = value + increment;
    this.set(key, newValue.toString());
    return newValue;
  }
  
  private decrby(key: string, decrement: number): number {
    const current = this.get(key);
    const value = current ? parseInt(current) : 0;
    if (isNaN(value) || isNaN(decrement)) {
      throw new Error('ERR value is not an integer or out of range');
    }
    const newValue = value - decrement;
    this.set(key, newValue.toString());
    return newValue;
  }
  
  private append(key: string, value: string): number {
    const current = this.get(key);
    const newValue = (current || '') + value;
    this.set(key, newValue);
    return newValue.length;
  }
  
  private getset(key: string, value: string): string | null {
    const oldValue = this.get(key);
    this.set(key, value);
    return oldValue;
  }
  
  private mget(keys: string[]): Array<string | null> {
    return keys.map(key => this.get(key));
  }
  
  private mset(args: string[]): 'OK' {
    for (let i = 0; i < args.length; i += 2) {
      if (i + 1 < args.length) {
        this.set(args[i], args[i + 1]);
      }
    }
    return 'OK';
  }
  
  private msetnx(args: string[]): number {
    // Check if all keys don't exist
    for (let i = 0; i < args.length; i += 2) {
      if (i + 1 < args.length) {
        const existing = this.keys.get(args[i]);
        if (existing && !this.isExpired(existing)) {
          return 0; // At least one key exists
        }
      }
    }
    
    // Set all keys
    for (let i = 0; i < args.length; i += 2) {
      if (i + 1 < args.length) {
        this.set(args[i], args[i + 1]);
      }
    }
    return 1;
  }
  
  private strlen(key: string): number {
    const value = this.get(key);
    return value ? value.length : 0;
  }
  
  private getrange(key: string, start: number, end: number): string {
    const value = this.get(key);
    if (!value) {
      return '';
    }
    const len = value.length;
    const startIdx = start < 0 ? Math.max(0, len + start) : Math.min(start, len);
    const endIdx = end < 0 ? Math.max(0, len + end) : Math.min(end, len - 1);
    return value.substring(startIdx, endIdx + 1);
  }
  
  private setrange(key: string, offset: number, value: string): number {
    const current = this.get(key) || '';
    const len = current.length;
    const newValue = offset > len
      ? current + ' '.repeat(offset - len) + value
      : current.substring(0, offset) + value + current.substring(offset + value.length);
    this.set(key, newValue);
    return newValue.length;
  }
  
  // Hash commands
  private hget(key: string, field: string): string | null {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'hash') {
      return null;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return null;
    }
    
    const hash = redisKey.value as Record<string, string>;
    return hash[field] || null;
  }
  
  private hset(key: string, args: string[]): number {
    if (!this.isKeyForThisNode(key)) {
      throw new Error('MOVED - key belongs to different node');
    }
    
    this.checkMemoryAndEvict();
    
    let redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'hash') {
      if (redisKey) {
        this.currentMemoryUsage -= this.calculateKeySize(redisKey);
      }
      redisKey = {
        key,
        type: 'hash',
        value: {},
        size: 0,
      };
    }
    
    const hash = redisKey.value as Record<string, string>;
    let added = 0;
    
    for (let i = 0; i < args.length; i += 2) {
      const field = args[i];
      const value = args[i + 1];
      if (!hash[field]) {
        added++;
      }
      hash[field] = value;
    }
    
    redisKey.size = this.estimateSize(JSON.stringify(hash));
    this.keys.set(key, redisKey);
    this.currentMemoryUsage += this.calculateKeySize(redisKey);
    
    return added;
  }
  
  private hgetall(key: string): Record<string, string> {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'hash') {
      return {};
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return {};
    }
    
    return { ...(redisKey.value as Record<string, string>) };
  }
  
  private hdel(key: string, fields: string[]): number {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'hash') {
      return 0;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return 0;
    }
    
    const hash = redisKey.value as Record<string, string>;
    let deleted = 0;
    
    for (const field of fields) {
      if (hash[field]) {
        delete hash[field];
        deleted++;
      }
    }
    
    if (deleted > 0) {
      redisKey.size = this.estimateSize(JSON.stringify(hash));
      this.keys.set(key, redisKey);
    }
    
    return deleted;
  }
  
  private hkeys(key: string): string[] {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'hash') {
      return [];
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return [];
    }
    
    return Object.keys(redisKey.value as Record<string, string>);
  }
  
  private hvals(key: string): string[] {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'hash') {
      return [];
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return [];
    }
    
    return Object.values(redisKey.value as Record<string, string>);
  }
  
  // Additional Hash commands
  private hmset(key: string, args: string[]): 'OK' {
    // HMSET is same as HSET in newer Redis versions
    this.hset(key, args);
    return 'OK';
  }
  
  private hmget(key: string, fields: string[]): Array<string | null> {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'hash') {
      return fields.map(() => null);
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return fields.map(() => null);
    }
    
    const hash = redisKey.value as Record<string, string>;
    return fields.map(field => hash[field] || null);
  }
  
  private hincrby(key: string, field: string, increment: number): number {
    if (!this.isKeyForThisNode(key)) {
      throw new Error('MOVED - key belongs to different node');
    }
    
    this.checkMemoryAndEvict();
    
    let redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'hash') {
      if (redisKey) {
        this.currentMemoryUsage -= this.calculateKeySize(redisKey);
      }
      redisKey = {
        key,
        type: 'hash',
        value: {},
        size: 0,
      };
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      redisKey = {
        key,
        type: 'hash',
        value: {},
        size: 0,
      };
    }
    
    const hash = redisKey.value as Record<string, string>;
    const current = hash[field] ? parseInt(hash[field]) : 0;
    if (isNaN(current) || isNaN(increment)) {
      throw new Error('ERR hash value is not an integer');
    }
    const newValue = current + increment;
    hash[field] = newValue.toString();
    
    redisKey.size = this.estimateSize(JSON.stringify(hash));
    this.keys.set(key, redisKey);
    this.currentMemoryUsage += this.calculateKeySize(redisKey);
    
    return newValue;
  }
  
  private hincrbyfloat(key: string, field: string, increment: number): string {
    if (!this.isKeyForThisNode(key)) {
      throw new Error('MOVED - key belongs to different node');
    }
    
    this.checkMemoryAndEvict();
    
    let redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'hash') {
      if (redisKey) {
        this.currentMemoryUsage -= this.calculateKeySize(redisKey);
      }
      redisKey = {
        key,
        type: 'hash',
        value: {},
        size: 0,
      };
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      redisKey = {
        key,
        type: 'hash',
        value: {},
        size: 0,
      };
    }
    
    const hash = redisKey.value as Record<string, string>;
    const current = hash[field] ? parseFloat(hash[field]) : 0;
    if (isNaN(current) || isNaN(increment)) {
      throw new Error('ERR hash value is not a float');
    }
    const newValue = current + increment;
    hash[field] = newValue.toString();
    
    redisKey.size = this.estimateSize(JSON.stringify(hash));
    this.keys.set(key, redisKey);
    this.currentMemoryUsage += this.calculateKeySize(redisKey);
    
    return newValue.toString();
  }
  
  private hexists(key: string, field: string): number {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'hash') {
      return 0;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return 0;
    }
    
    const hash = redisKey.value as Record<string, string>;
    return hash[field] !== undefined ? 1 : 0;
  }
  
  private hlen(key: string): number {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'hash') {
      return 0;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return 0;
    }
    
    return Object.keys(redisKey.value as Record<string, string>).length;
  }
  
  private hstrlen(key: string, field: string): number {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'hash') {
      return 0;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return 0;
    }
    
    const hash = redisKey.value as Record<string, string>;
    const value = hash[field];
    return value ? value.length : 0;
  }
  
  // List commands
  private lpush(key: string, values: string[]): number {
    if (!this.isKeyForThisNode(key)) {
      throw new Error('MOVED - key belongs to different node');
    }
    
    this.checkMemoryAndEvict();
    
    let redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'list') {
      if (redisKey) {
        this.currentMemoryUsage -= this.calculateKeySize(redisKey);
      }
      redisKey = {
        key,
        type: 'list',
        value: [],
        size: 0,
      };
    }
    
    const list = redisKey.value as string[];
    list.unshift(...values);
    redisKey.size = this.estimateSize(JSON.stringify(list));
    this.keys.set(key, redisKey);
    this.currentMemoryUsage += this.calculateKeySize(redisKey);
    
    return list.length;
  }
  
  private rpush(key: string, values: string[]): number {
    if (!this.isKeyForThisNode(key)) {
      throw new Error('MOVED - key belongs to different node');
    }
    
    this.checkMemoryAndEvict();
    
    let redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'list') {
      if (redisKey) {
        this.currentMemoryUsage -= this.calculateKeySize(redisKey);
      }
      redisKey = {
        key,
        type: 'list',
        value: [],
        size: 0,
      };
    }
    
    const list = redisKey.value as string[];
    list.push(...values);
    redisKey.size = this.estimateSize(JSON.stringify(list));
    this.keys.set(key, redisKey);
    this.currentMemoryUsage += this.calculateKeySize(redisKey);
    
    return list.length;
  }
  
  private lpop(key: string): string | null {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'list') {
      return null;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return null;
    }
    
    const list = redisKey.value as string[];
    if (list.length === 0) {
      return null;
    }
    
    const value = list.shift()!;
    redisKey.size = this.estimateSize(JSON.stringify(list));
    this.keys.set(key, redisKey);
    
    return value;
  }
  
  private rpop(key: string): string | null {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'list') {
      return null;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return null;
    }
    
    const list = redisKey.value as string[];
    if (list.length === 0) {
      return null;
    }
    
    const value = list.pop()!;
    redisKey.size = this.estimateSize(JSON.stringify(list));
    this.keys.set(key, redisKey);
    
    return value;
  }
  
  private llen(key: string): number {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'list') {
      return 0;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return 0;
    }
    
    return (redisKey.value as string[]).length;
  }
  
  private lrange(key: string, start: number, stop: number): string[] {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'list') {
      return [];
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return [];
    }
    
    const list = redisKey.value as string[];
    const len = list.length;
    const startIdx = start < 0 ? Math.max(0, len + start) : Math.min(start, len);
    const stopIdx = stop < 0 ? Math.max(0, len + stop) : Math.min(stop, len - 1);
    
    return list.slice(startIdx, stopIdx + 1);
  }
  
  // Additional List commands
  private lindex(key: string, index: number): string | null {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'list') {
      return null;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return null;
    }
    
    const list = redisKey.value as string[];
    const len = list.length;
    const idx = index < 0 ? len + index : index;
    if (idx < 0 || idx >= len) {
      return null;
    }
    return list[idx];
  }
  
  private lset(key: string, index: number, value: string): 'OK' {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'list') {
      throw new Error('ERR no such key');
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      throw new Error('ERR no such key');
    }
    
    const list = redisKey.value as string[];
    const len = list.length;
    const idx = index < 0 ? len + index : index;
    if (idx < 0 || idx >= len) {
      throw new Error('ERR index out of range');
    }
    
    list[idx] = value;
    redisKey.size = this.estimateSize(JSON.stringify(list));
    this.keys.set(key, redisKey);
    
    return 'OK';
  }
  
  private ltrim(key: string, start: number, stop: number): 'OK' {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'list') {
      return 'OK';
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return 'OK';
    }
    
    const list = redisKey.value as string[];
    const len = list.length;
    const startIdx = start < 0 ? Math.max(0, len + start) : Math.min(start, len);
    const stopIdx = stop < 0 ? Math.max(0, len + stop) : Math.min(stop, len - 1);
    
    if (startIdx > stopIdx || startIdx >= len) {
      // Clear list
      list.length = 0;
    } else {
      const trimmed = list.slice(startIdx, stopIdx + 1);
      list.length = 0;
      list.push(...trimmed);
    }
    
    redisKey.size = this.estimateSize(JSON.stringify(list));
    this.keys.set(key, redisKey);
    
    return 'OK';
  }
  
  private linsert(key: string, position: string, pivot: string, value: string): number {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'list') {
      return -1;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return -1;
    }
    
    const list = redisKey.value as string[];
    const pivotIndex = list.indexOf(pivot);
    if (pivotIndex === -1) {
      return -1;
    }
    
    const insertIndex = position.toUpperCase() === 'BEFORE' ? pivotIndex : pivotIndex + 1;
    list.splice(insertIndex, 0, value);
    
    redisKey.size = this.estimateSize(JSON.stringify(list));
    this.keys.set(key, redisKey);
    
    return list.length;
  }
  
  private rpoplpush(source: string, destination: string): string | null {
    const value = this.rpop(source);
    if (value === null) {
      return null;
    }
    this.lpush(destination, [value]);
    return value;
  }
  
  private blpop(args: string[]): any {
    // Simplified: BLPOP key1 key2 ... timeout
    // In real Redis, this blocks, but in simulation we'll return immediately or null
    const timeout = parseInt(args[args.length - 1]);
    const keys = args.slice(0, -1);
    
    for (const key of keys) {
      const value = this.lpop(key);
      if (value !== null) {
        return [key, value];
      }
    }
    
    // In real Redis, would block for timeout seconds
    // In simulation, return null immediately
    return null;
  }
  
  private brpop(args: string[]): any {
    // Simplified: BRPOP key1 key2 ... timeout
    const timeout = parseInt(args[args.length - 1]);
    const keys = args.slice(0, -1);
    
    for (const key of keys) {
      const value = this.rpop(key);
      if (value !== null) {
        return [key, value];
      }
    }
    
    return null;
  }
  
  // Set commands
  private sadd(key: string, members: string[]): number {
    if (!this.isKeyForThisNode(key)) {
      throw new Error('MOVED - key belongs to different node');
    }
    
    this.checkMemoryAndEvict();
    
    let redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'set') {
      if (redisKey) {
        this.currentMemoryUsage -= this.calculateKeySize(redisKey);
      }
      redisKey = {
        key,
        type: 'set',
        value: new Set<string>(),
        size: 0,
      };
    }
    
    const set = redisKey.value as Set<string>;
    let added = 0;
    
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added++;
      }
    }
    
    redisKey.size = this.estimateSize(JSON.stringify(Array.from(set)));
    this.keys.set(key, redisKey);
    this.currentMemoryUsage += this.calculateKeySize(redisKey);
    
    return added;
  }
  
  private srem(key: string, members: string[]): number {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'set') {
      return 0;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return 0;
    }
    
    const set = redisKey.value as Set<string>;
    let removed = 0;
    
    for (const member of members) {
      if (set.has(member)) {
        set.delete(member);
        removed++;
      }
    }
    
    if (removed > 0) {
      redisKey.size = this.estimateSize(JSON.stringify(Array.from(set)));
      this.keys.set(key, redisKey);
    }
    
    return removed;
  }
  
  private smembers(key: string): string[] {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'set') {
      return [];
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return [];
    }
    
    return Array.from(redisKey.value as Set<string>);
  }
  
  private sismember(key: string, member: string): number {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'set') {
      return 0;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return 0;
    }
    
    return (redisKey.value as Set<string>).has(member) ? 1 : 0;
  }
  
  private scard(key: string): number {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'set') {
      return 0;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return 0;
    }
    
    return (redisKey.value as Set<string>).size;
  }
  
  // Additional Set commands
  private sinter(keys: string[]): string[] {
    if (keys.length === 0) {
      return [];
    }
    
    const sets: Set<string>[] = [];
    for (const key of keys) {
      const redisKey = this.keys.get(key);
      if (!redisKey || redisKey.type !== 'set') {
        return [];
      }
      if (this.isExpired(redisKey)) {
        this.deleteKey(key);
        return [];
      }
      sets.push(redisKey.value as Set<string>);
    }
    
    if (sets.length === 0) {
      return [];
    }
    
    // Intersection
    const result = new Set<string>();
    const firstSet = sets[0];
    for (const member of firstSet) {
      let inAll = true;
      for (let i = 1; i < sets.length; i++) {
        if (!sets[i].has(member)) {
          inAll = false;
          break;
        }
      }
      if (inAll) {
        result.add(member);
      }
    }
    
    return Array.from(result);
  }
  
  private sunion(keys: string[]): string[] {
    const result = new Set<string>();
    
    for (const key of keys) {
      const redisKey = this.keys.get(key);
      if (redisKey && redisKey.type === 'set' && !this.isExpired(redisKey)) {
        const set = redisKey.value as Set<string>;
        for (const member of set) {
          result.add(member);
        }
      }
    }
    
    return Array.from(result);
  }
  
  private sdiff(keys: string[]): string[] {
    if (keys.length === 0) {
      return [];
    }
    
    const firstKey = keys[0];
    const redisKey = this.keys.get(firstKey);
    if (!redisKey || redisKey.type !== 'set') {
      return [];
    }
    if (this.isExpired(redisKey)) {
      this.deleteKey(firstKey);
      return [];
    }
    
    const firstSet = new Set(redisKey.value as Set<string>);
    
    // Subtract other sets
    for (let i = 1; i < keys.length; i++) {
      const otherKey = keys[i];
      const otherRedisKey = this.keys.get(otherKey);
      if (otherRedisKey && otherRedisKey.type === 'set' && !this.isExpired(otherRedisKey)) {
        const otherSet = otherRedisKey.value as Set<string>;
        for (const member of otherSet) {
          firstSet.delete(member);
        }
      }
    }
    
    return Array.from(firstSet);
  }
  
  private sinterstore(destination: string, keys: string[]): number {
    const result = this.sinter(keys);
    this.checkMemoryAndEvict();
    
    let redisKey = this.keys.get(destination);
    if (redisKey && redisKey.type !== 'set') {
      this.currentMemoryUsage -= this.calculateKeySize(redisKey);
      redisKey = undefined;
    }
    
    if (!redisKey) {
      redisKey = {
        key: destination,
        type: 'set',
        value: new Set<string>(),
        size: 0,
      };
    }
    
    const set = redisKey.value as Set<string>;
    set.clear();
    for (const member of result) {
      set.add(member);
    }
    
    redisKey.size = this.estimateSize(JSON.stringify(Array.from(set)));
    this.keys.set(destination, redisKey);
    this.currentMemoryUsage += this.calculateKeySize(redisKey);
    
    return result.length;
  }
  
  private sunionstore(destination: string, keys: string[]): number {
    const result = this.sunion(keys);
    this.checkMemoryAndEvict();
    
    let redisKey = this.keys.get(destination);
    if (redisKey && redisKey.type !== 'set') {
      this.currentMemoryUsage -= this.calculateKeySize(redisKey);
      redisKey = undefined;
    }
    
    if (!redisKey) {
      redisKey = {
        key: destination,
        type: 'set',
        value: new Set<string>(),
        size: 0,
      };
    }
    
    const set = redisKey.value as Set<string>;
    set.clear();
    for (const member of result) {
      set.add(member);
    }
    
    redisKey.size = this.estimateSize(JSON.stringify(Array.from(set)));
    this.keys.set(destination, redisKey);
    this.currentMemoryUsage += this.calculateKeySize(redisKey);
    
    return result.length;
  }
  
  private sdiffstore(destination: string, keys: string[]): number {
    const result = this.sdiff(keys);
    this.checkMemoryAndEvict();
    
    let redisKey = this.keys.get(destination);
    if (redisKey && redisKey.type !== 'set') {
      this.currentMemoryUsage -= this.calculateKeySize(redisKey);
      redisKey = undefined;
    }
    
    if (!redisKey) {
      redisKey = {
        key: destination,
        type: 'set',
        value: new Set<string>(),
        size: 0,
      };
    }
    
    const set = redisKey.value as Set<string>;
    set.clear();
    for (const member of result) {
      set.add(member);
    }
    
    redisKey.size = this.estimateSize(JSON.stringify(Array.from(set)));
    this.keys.set(destination, redisKey);
    this.currentMemoryUsage += this.calculateKeySize(redisKey);
    
    return result.length;
  }
  
  private smove(source: string, destination: string, member: string): number {
    const sourceKey = this.keys.get(source);
    if (!sourceKey || sourceKey.type !== 'set') {
      return 0;
    }
    
    if (this.isExpired(sourceKey)) {
      this.deleteKey(source);
      return 0;
    }
    
    const sourceSet = sourceKey.value as Set<string>;
    if (!sourceSet.has(member)) {
      return 0;
    }
    
    sourceSet.delete(member);
    sourceKey.size = this.estimateSize(JSON.stringify(Array.from(sourceSet)));
    this.keys.set(source, sourceKey);
    
    // Add to destination
    this.checkMemoryAndEvict();
    let destKey = this.keys.get(destination);
    if (!destKey || destKey.type !== 'set') {
      if (destKey) {
        this.currentMemoryUsage -= this.calculateKeySize(destKey);
      }
      destKey = {
        key: destination,
        type: 'set',
        value: new Set<string>(),
        size: 0,
      };
    }
    
    const destSet = destKey.value as Set<string>;
    destSet.add(member);
    destKey.size = this.estimateSize(JSON.stringify(Array.from(destSet)));
    this.keys.set(destination, destKey);
    this.currentMemoryUsage += this.calculateKeySize(destKey);
    
    return 1;
  }
  
  private spop(key: string, count: number): string | string[] | null {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'set') {
      return null;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return null;
    }
    
    const set = redisKey.value as Set<string>;
    if (set.size === 0) {
      return null;
    }
    
    const members = Array.from(set);
    const toRemove = Math.min(count, members.length);
    const result: string[] = [];
    
    for (let i = 0; i < toRemove; i++) {
      const randomIndex = Math.floor(Math.random() * members.length);
      const member = members[randomIndex];
      set.delete(member);
      result.push(member);
      members.splice(randomIndex, 1);
    }
    
    redisKey.size = this.estimateSize(JSON.stringify(Array.from(set)));
    this.keys.set(key, redisKey);
    
    return count === 1 ? result[0] : result;
  }
  
  private srandmember(key: string, count: number): string | string[] | null {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'set') {
      return null;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return null;
    }
    
    const set = redisKey.value as Set<string>;
    if (set.size === 0) {
      return null;
    }
    
    const members = Array.from(set);
    const toReturn = Math.min(Math.abs(count), members.length);
    const result: string[] = [];
    
    for (let i = 0; i < toReturn; i++) {
      const randomIndex = Math.floor(Math.random() * members.length);
      result.push(members[randomIndex]);
      if (count > 0) {
        // Remove from array to avoid duplicates
        members.splice(randomIndex, 1);
      }
    }
    
    return count === 1 ? result[0] : result;
  }
  
  // Sorted Set commands
  private zadd(key: string, args: string[]): number {
    if (!this.isKeyForThisNode(key)) {
      throw new Error('MOVED - key belongs to different node');
    }
    
    this.checkMemoryAndEvict();
    
    let redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'zset') {
      if (redisKey) {
        this.currentMemoryUsage -= this.calculateKeySize(redisKey);
      }
      redisKey = {
        key,
        type: 'zset',
        value: new Map<string, number>(),
        size: 0,
      };
    }
    
    const zset = redisKey.value as Map<string, number>;
    let added = 0;
    
    for (let i = 0; i < args.length; i += 2) {
      const score = parseFloat(args[i]);
      const member = args[i + 1];
      if (!zset.has(member)) {
        added++;
      }
      zset.set(member, score);
    }
    
    redisKey.size = this.estimateSize(JSON.stringify(Array.from(zset.entries())));
    this.keys.set(key, redisKey);
    this.currentMemoryUsage += this.calculateKeySize(redisKey);
    
    return added;
  }
  
  private zrem(key: string, members: string[]): number {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'zset') {
      return 0;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return 0;
    }
    
    const zset = redisKey.value as Map<string, number>;
    let removed = 0;
    
    for (const member of members) {
      if (zset.has(member)) {
        zset.delete(member);
        removed++;
      }
    }
    
    if (removed > 0) {
      redisKey.size = this.estimateSize(JSON.stringify(Array.from(zset.entries())));
      this.keys.set(key, redisKey);
    }
    
    return removed;
  }
  
  private zrange(key: string, start: number, stop: number, withScores: boolean = false): string[] | Array<[string, number]> {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'zset') {
      return [];
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return [];
    }
    
    const zset = redisKey.value as Map<string, number>;
    const entries = Array.from(zset.entries()).sort((a, b) => a[1] - b[1]);
    const len = entries.length;
    const startIdx = start < 0 ? Math.max(0, len + start) : Math.min(start, len);
    const stopIdx = stop < 0 ? Math.max(0, len + stop) : Math.min(stop, len - 1);
    
    const result = entries.slice(startIdx, stopIdx + 1);
    return withScores ? result.map(e => [e[0], e[1]]) : result.map(e => e[0]);
  }
  
  private zscore(key: string, member: string): number | null {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'zset') {
      return null;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return null;
    }
    
    const zset = redisKey.value as Map<string, number>;
    return zset.get(member) ?? null;
  }
  
  private zcard(key: string): number {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'zset') {
      return 0;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return 0;
    }
    
    return (redisKey.value as Map<string, number>).size;
  }
  
  // Additional Sorted Set commands
  private zrevrange(key: string, start: number, stop: number, withScores: boolean = false): string[] | Array<[string, number]> {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'zset') {
      return [];
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return [];
    }
    
    const zset = redisKey.value as Map<string, number>;
    const entries = Array.from(zset.entries()).sort((a, b) => b[1] - a[1]); // Reverse sort
    const len = entries.length;
    const startIdx = start < 0 ? Math.max(0, len + start) : Math.min(start, len);
    const stopIdx = stop < 0 ? Math.max(0, len + stop) : Math.min(stop, len - 1);
    
    const result = entries.slice(startIdx, stopIdx + 1);
    return withScores ? result.map(e => [e[0], e[1]]) : result.map(e => e[0]);
  }
  
  private parseScoreRange(min: string, max: string): { min: number, max: number, minExclusive: boolean, maxExclusive: boolean } {
    let minScore = min === '-inf' ? -Infinity : parseFloat(min);
    let maxScore = max === '+inf' ? Infinity : parseFloat(max);
    let minExclusive = min.startsWith('(');
    let maxExclusive = max.startsWith('(');
    
    if (minExclusive) {
      minScore = parseFloat(min.substring(1));
    }
    if (maxExclusive) {
      maxScore = parseFloat(max.substring(1));
    }
    
    return { min: minScore, max: maxScore, minExclusive, maxExclusive };
  }
  
  private zrangebyscore(key: string, min: string, max: string, options: string[]): any {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'zset') {
      return [];
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return [];
    }
    
    const range = this.parseScoreRange(min, max);
    const zset = redisKey.value as Map<string, number>;
    const entries = Array.from(zset.entries())
      .filter(([member, score]) => {
        if (range.minExclusive ? score <= range.min : score < range.min) return false;
        if (range.maxExclusive ? score >= range.max : score > range.max) return false;
        return true;
      })
      .sort((a, b) => a[1] - b[1]);
    
    let limit: number | undefined;
    let offset: number | undefined;
    let withScores = false;
    
    for (let i = 0; i < options.length; i++) {
      if (options[i] === 'LIMIT' && i + 2 < options.length) {
        offset = parseInt(options[i + 1]);
        limit = parseInt(options[i + 2]);
      } else if (options[i] === 'WITHSCORES') {
        withScores = true;
      }
    }
    
    let result = entries;
    if (offset !== undefined && limit !== undefined) {
      result = entries.slice(offset, offset + limit);
    }
    
    return withScores ? result.map(e => [e[0], e[1]]) : result.map(e => e[0]);
  }
  
  private zrevrangebyscore(key: string, max: string, min: string, options: string[]): any {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'zset') {
      return [];
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return [];
    }
    
    const range = this.parseScoreRange(min, max);
    const zset = redisKey.value as Map<string, number>;
    const entries = Array.from(zset.entries())
      .filter(([member, score]) => {
        if (range.minExclusive ? score <= range.min : score < range.min) return false;
        if (range.maxExclusive ? score >= range.max : score > range.max) return false;
        return true;
      })
      .sort((a, b) => b[1] - a[1]); // Reverse sort
    
    let limit: number | undefined;
    let offset: number | undefined;
    let withScores = false;
    
    for (let i = 0; i < options.length; i++) {
      if (options[i] === 'LIMIT' && i + 2 < options.length) {
        offset = parseInt(options[i + 1]);
        limit = parseInt(options[i + 2]);
      } else if (options[i] === 'WITHSCORES') {
        withScores = true;
      }
    }
    
    let result = entries;
    if (offset !== undefined && limit !== undefined) {
      result = entries.slice(offset, offset + limit);
    }
    
    return withScores ? result.map(e => [e[0], e[1]]) : result.map(e => e[0]);
  }
  
  private zrank(key: string, member: string): number | null {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'zset') {
      return null;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return null;
    }
    
    const zset = redisKey.value as Map<string, number>;
    if (!zset.has(member)) {
      return null;
    }
    
    const entries = Array.from(zset.entries()).sort((a, b) => a[1] - b[1]);
    const index = entries.findIndex(e => e[0] === member);
    return index !== -1 ? index : null;
  }
  
  private zrevrank(key: string, member: string): number | null {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'zset') {
      return null;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return null;
    }
    
    const zset = redisKey.value as Map<string, number>;
    if (!zset.has(member)) {
      return null;
    }
    
    const entries = Array.from(zset.entries()).sort((a, b) => b[1] - a[1]);
    const index = entries.findIndex(e => e[0] === member);
    return index !== -1 ? index : null;
  }
  
  private zincrby(key: string, increment: number, member: string): string {
    if (!this.isKeyForThisNode(key)) {
      throw new Error('MOVED - key belongs to different node');
    }
    
    this.checkMemoryAndEvict();
    
    let redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'zset') {
      if (redisKey) {
        this.currentMemoryUsage -= this.calculateKeySize(redisKey);
      }
      redisKey = {
        key,
        type: 'zset',
        value: new Map<string, number>(),
        size: 0,
      };
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      redisKey = {
        key,
        type: 'zset',
        value: new Map<string, number>(),
        size: 0,
      };
    }
    
    const zset = redisKey.value as Map<string, number>;
    const currentScore = zset.get(member) || 0;
    const newScore = currentScore + increment;
    zset.set(member, newScore);
    
    redisKey.size = this.estimateSize(JSON.stringify(Array.from(zset.entries())));
    this.keys.set(key, redisKey);
    this.currentMemoryUsage += this.calculateKeySize(redisKey);
    
    return newScore.toString();
  }
  
  private zcount(key: string, min: string, max: string): number {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'zset') {
      return 0;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return 0;
    }
    
    const range = this.parseScoreRange(min, max);
    const zset = redisKey.value as Map<string, number>;
    return Array.from(zset.values()).filter(score => {
      if (range.minExclusive ? score <= range.min : score < range.min) return false;
      if (range.maxExclusive ? score >= range.max : score > range.max) return false;
      return true;
    }).length;
  }
  
  private zremrangebyscore(key: string, min: string, max: string): number {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'zset') {
      return 0;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return 0;
    }
    
    const range = this.parseScoreRange(min, max);
    const zset = redisKey.value as Map<string, number>;
    let removed = 0;
    
    for (const [member, score] of zset.entries()) {
      if (range.minExclusive ? score <= range.min : score < range.min) continue;
      if (range.maxExclusive ? score >= range.max : score > range.max) continue;
      zset.delete(member);
      removed++;
    }
    
    if (removed > 0) {
      redisKey.size = this.estimateSize(JSON.stringify(Array.from(zset.entries())));
      this.keys.set(key, redisKey);
    }
    
    return removed;
  }
  
  private zremrangebyrank(key: string, start: number, stop: number): number {
    const redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'zset') {
      return 0;
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      return 0;
    }
    
    const zset = redisKey.value as Map<string, number>;
    const entries = Array.from(zset.entries()).sort((a, b) => a[1] - b[1]);
    const len = entries.length;
    const startIdx = start < 0 ? Math.max(0, len + start) : Math.min(start, len);
    const stopIdx = stop < 0 ? Math.max(0, len + stop) : Math.min(stop, len - 1);
    
    let removed = 0;
    for (let i = startIdx; i <= stopIdx && i < entries.length; i++) {
      zset.delete(entries[i][0]);
      removed++;
    }
    
    if (removed > 0) {
      redisKey.size = this.estimateSize(JSON.stringify(Array.from(zset.entries())));
      this.keys.set(key, redisKey);
    }
    
    return removed;
  }
  
  private zunionstore(destination: string, args: string[]): number {
    // Parse: ZUNIONSTORE dest numkeys key1 key2 ... [WEIGHTS weight1 weight2 ...] [AGGREGATE SUM|MIN|MAX]
    const numKeys = parseInt(args[0]);
    const keys = args.slice(1, 1 + numKeys);
    const weights: number[] = [];
    let aggregate: 'SUM' | 'MIN' | 'MAX' = 'SUM';
    
    let i = 1 + numKeys;
    if (i < args.length && args[i] === 'WEIGHTS') {
      i++;
      while (i < args.length && !isNaN(parseFloat(args[i]))) {
        weights.push(parseFloat(args[i]));
        i++;
      }
    }
    if (i < args.length && args[i] === 'AGGREGATE') {
      aggregate = (args[i + 1] as 'SUM' | 'MIN' | 'MAX') || 'SUM';
    }
    
    const result = new Map<string, number>();
    
    for (let j = 0; j < keys.length; j++) {
      const key = keys[j];
      const redisKey = this.keys.get(key);
      if (redisKey && redisKey.type === 'zset' && !this.isExpired(redisKey)) {
        const zset = redisKey.value as Map<string, number>;
        const weight = weights[j] || 1;
        
        for (const [member, score] of zset.entries()) {
          const weightedScore = score * weight;
          if (result.has(member)) {
            const current = result.get(member)!;
            switch (aggregate) {
              case 'SUM':
                result.set(member, current + weightedScore);
                break;
              case 'MIN':
                result.set(member, Math.min(current, weightedScore));
                break;
              case 'MAX':
                result.set(member, Math.max(current, weightedScore));
                break;
            }
          } else {
            result.set(member, weightedScore);
          }
        }
      }
    }
    
    this.checkMemoryAndEvict();
    let destKey = this.keys.get(destination);
    if (destKey && destKey.type !== 'zset') {
      this.currentMemoryUsage -= this.calculateKeySize(destKey);
      destKey = undefined;
    }
    
    if (!destKey) {
      destKey = {
        key: destination,
        type: 'zset',
        value: new Map<string, number>(),
        size: 0,
      };
    }
    
    destKey.value = result;
    destKey.size = this.estimateSize(JSON.stringify(Array.from(result.entries())));
    this.keys.set(destination, destKey);
    this.currentMemoryUsage += this.calculateKeySize(destKey);
    
    return result.size;
  }
  
  private zinterstore(destination: string, args: string[]): number {
    // Similar to ZUNIONSTORE but only members present in all sets
    const numKeys = parseInt(args[0]);
    const keys = args.slice(1, 1 + numKeys);
    const weights: number[] = [];
    let aggregate: 'SUM' | 'MIN' | 'MAX' = 'SUM';
    
    let i = 1 + numKeys;
    if (i < args.length && args[i] === 'WEIGHTS') {
      i++;
      while (i < args.length && !isNaN(parseFloat(args[i]))) {
        weights.push(parseFloat(args[i]));
        i++;
      }
    }
    if (i < args.length && args[i] === 'AGGREGATE') {
      aggregate = (args[i + 1] as 'SUM' | 'MIN' | 'MAX') || 'SUM';
    }
    
    const zsets: Map<string, number>[] = [];
    for (const key of keys) {
      const redisKey = this.keys.get(key);
      if (redisKey && redisKey.type === 'zset' && !this.isExpired(redisKey)) {
        zsets.push(redisKey.value as Map<string, number>);
      }
    }
    
    if (zsets.length === 0) {
      return 0;
    }
    
    // Find common members
    const firstSet = zsets[0];
    const result = new Map<string, number>();
    
    for (const [member, score] of firstSet.entries()) {
      let inAll = true;
      const scores: number[] = [score * (weights[0] || 1)];
      
      for (let j = 1; j < zsets.length; j++) {
        if (!zsets[j].has(member)) {
          inAll = false;
          break;
        }
        scores.push(zsets[j].get(member)! * (weights[j] || 1));
      }
      
      if (inAll) {
        let finalScore: number;
        switch (aggregate) {
          case 'SUM':
            finalScore = scores.reduce((a, b) => a + b, 0);
            break;
          case 'MIN':
            finalScore = Math.min(...scores);
            break;
          case 'MAX':
            finalScore = Math.max(...scores);
            break;
          default:
            finalScore = scores.reduce((a, b) => a + b, 0);
        }
        result.set(member, finalScore);
      }
    }
    
    this.checkMemoryAndEvict();
    let destKey = this.keys.get(destination);
    if (destKey && destKey.type !== 'zset') {
      this.currentMemoryUsage -= this.calculateKeySize(destKey);
      destKey = undefined;
    }
    
    if (!destKey) {
      destKey = {
        key: destination,
        type: 'zset',
        value: new Map<string, number>(),
        size: 0,
      };
    }
    
    destKey.value = result;
    destKey.size = this.estimateSize(JSON.stringify(Array.from(result.entries())));
    this.keys.set(destination, destKey);
    this.currentMemoryUsage += this.calculateKeySize(destKey);
    
    return result.size;
  }
  
  // Stream commands
  /**
   * Generate stream entry ID (milliseconds-timestamp-sequence)
   */
  private generateStreamId(): string {
    const now = Date.now();
    const seq = Math.floor(Math.random() * 1000); // Simplified sequence
    return `${now}-${seq}`;
  }
  
  /**
   * Parse stream ID to timestamp
   */
  private parseStreamId(id: string): number {
    const parts = id.split('-');
    if (parts.length >= 1) {
      return parseInt(parts[0]) || 0;
    }
    return 0;
  }
  
  /**
   * Compare stream IDs
   */
  private compareStreamIds(id1: string, id2: string): number {
    const ts1 = this.parseStreamId(id1);
    const ts2 = this.parseStreamId(id2);
    if (ts1 !== ts2) {
      return ts1 - ts2;
    }
    // Compare sequence numbers
    const seq1 = parseInt(id1.split('-')[1] || '0');
    const seq2 = parseInt(id2.split('-')[1] || '0');
    return seq1 - seq2;
  }
  
  /**
   * Get or create stream
   */
  private getOrCreateStream(key: string): RedisStream {
    if (!this.isKeyForThisNode(key)) {
      throw new Error('MOVED - key belongs to different node');
    }
    
    let redisKey = this.keys.get(key);
    if (!redisKey || redisKey.type !== 'stream') {
      if (redisKey) {
        this.currentMemoryUsage -= this.calculateKeySize(redisKey);
      }
      const stream: RedisStream = {
        entries: [],
        groups: new Map(),
        lastId: '0-0',
      };
      redisKey = {
        key,
        type: 'stream',
        value: stream,
        size: 0,
      };
      this.keys.set(key, redisKey);
    }
    
    if (this.isExpired(redisKey)) {
      this.deleteKey(key);
      // Recreate
      const stream: RedisStream = {
        entries: [],
        groups: new Map(),
        lastId: '0-0',
      };
      redisKey = {
        key,
        type: 'stream',
        value: stream,
        size: 0,
      };
      this.keys.set(key, redisKey);
    }
    
    return redisKey.value as RedisStream;
  }
  
  /**
   * XADD - Add entry to stream
   */
  private xadd(key: string, args: string[]): string {
    this.checkMemoryAndEvict();
    
    const stream = this.getOrCreateStream(key);
    
    // Parse arguments: [ID] field1 value1 [field2 value2 ...]
    let entryId: string | undefined;
    let fieldIndex = 0;
    
    // Check if first arg is ID (starts with * or is timestamp-sequence)
    if (args.length > 0 && (args[0] === '*' || args[0].includes('-'))) {
      entryId = args[0] === '*' ? this.generateStreamId() : args[0];
      fieldIndex = 1;
    } else {
      entryId = this.generateStreamId();
    }
    
    // Parse fields
    const fields: Record<string, string> = {};
    for (let i = fieldIndex; i < args.length; i += 2) {
      if (i + 1 < args.length) {
        fields[args[i]] = args[i + 1];
      }
    }
    
    // Create entry
    const entry: RedisStreamEntry = {
      id: entryId,
      fields,
    };
    
    // Insert in sorted order by ID
    let insertIndex = stream.entries.length;
    for (let i = 0; i < stream.entries.length; i++) {
      if (this.compareStreamIds(entryId, stream.entries[i].id) < 0) {
        insertIndex = i;
        break;
      }
    }
    stream.entries.splice(insertIndex, 0, entry);
    stream.lastId = entryId;
    
    // Update key size
    const redisKey = this.keys.get(key)!;
    redisKey.size = this.estimateSize(JSON.stringify(stream));
    this.currentMemoryUsage += this.calculateKeySize(redisKey);
    
    return entryId;
  }
  
  /**
   * XREAD - Read entries from streams
   */
  private xread(args: string[]): any {
    // Parse: STREAMS key1 key2 ... id1 id2 ...
    const streamsIndex = args.indexOf('STREAMS');
    if (streamsIndex === -1) {
      throw new Error('ERR syntax error');
    }
    
    const keys = args.slice(0, streamsIndex);
    const ids = args.slice(streamsIndex + 1);
    
    if (keys.length !== ids.length) {
      throw new Error('ERR syntax error');
    }
    
    // Parse COUNT and BLOCK if present
    let count: number | undefined;
    let block: number | undefined;
    const countIndex = args.indexOf('COUNT');
    if (countIndex !== -1 && countIndex < streamsIndex) {
      count = parseInt(args[countIndex + 1]);
    }
    const blockIndex = args.indexOf('BLOCK');
    if (blockIndex !== -1 && blockIndex < streamsIndex) {
      block = parseInt(args[blockIndex + 1]);
    }
    
    const result: Array<[string, Array<[string, Record<string, string>]>]> = [];
    
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const startId = ids[i];
      const stream = this.getOrCreateStream(key);
      
      // Find entries after startId
      const entries: Array<[string, Record<string, string>]> = [];
      for (const entry of stream.entries) {
        if (this.compareStreamIds(entry.id, startId) > 0) {
          entries.push([entry.id, entry.fields]);
          if (count && entries.length >= count) {
            break;
          }
        }
      }
      
      if (entries.length > 0) {
        result.push([key, entries]);
      }
    }
    
    return result.length > 0 ? result : null;
  }
  
  /**
   * XRANGE - Get entries in range
   */
  private xrange(key: string, start: string, end: string, count?: number): Array<[string, Record<string, string>]> {
    const stream = this.getOrCreateStream(key);
    const result: Array<[string, Record<string, string>]> = [];
    
    for (const entry of stream.entries) {
      if (start !== '-' && this.compareStreamIds(entry.id, start) < 0) {
        continue;
      }
      if (end !== '+' && this.compareStreamIds(entry.id, end) > 0) {
        break;
      }
      result.push([entry.id, entry.fields]);
      if (count && result.length >= count) {
        break;
      }
    }
    
    return result;
  }
  
  /**
   * XREVRANGE - Get entries in reverse range
   */
  private xrevrange(key: string, end: string, start: string, count?: number): Array<[string, Record<string, string>]> {
    const stream = this.getOrCreateStream(key);
    const result: Array<[string, Record<string, string>]> = [];
    
    // Iterate in reverse
    for (let i = stream.entries.length - 1; i >= 0; i--) {
      const entry = stream.entries[i];
      if (start !== '+' && this.compareStreamIds(entry.id, start) < 0) {
        continue;
      }
      if (end !== '-' && this.compareStreamIds(entry.id, end) > 0) {
        break;
      }
      result.push([entry.id, entry.fields]);
      if (count && result.length >= count) {
        break;
      }
    }
    
    return result;
  }
  
  /**
   * XREADGROUP - Read from consumer group
   */
  private xreadgroup(args: string[]): any {
    // Parse: GROUP group consumer [COUNT count] [BLOCK ms] STREAMS key1 key2 ... id1 id2 ...
    const groupIndex = args.indexOf('GROUP');
    if (groupIndex === -1) {
      throw new Error('ERR syntax error');
    }
    
    const groupName = args[groupIndex + 1];
    const consumerName = args[groupIndex + 2];
    const streamsIndex = args.indexOf('STREAMS');
    if (streamsIndex === -1) {
      throw new Error('ERR syntax error');
    }
    
    const keys = args.slice(streamsIndex + 1, streamsIndex + 1 + (streamsIndex - groupIndex - 3) / 2);
    const ids = args.slice(streamsIndex + 1 + keys.length);
    
    if (keys.length !== ids.length) {
      throw new Error('ERR syntax error');
    }
    
    let count: number | undefined;
    let block: number | undefined;
    const countIndex = args.indexOf('COUNT');
    if (countIndex !== -1) {
      count = parseInt(args[countIndex + 1]);
    }
    const blockIndex = args.indexOf('BLOCK');
    if (blockIndex !== -1) {
      block = parseInt(args[blockIndex + 1]);
    }
    
    const result: Array<[string, Array<[string, Record<string, string>]>]> = [];
    
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const startId = ids[i];
      const stream = this.getOrCreateStream(key);
      
      // Get or create group
      if (!stream.groups.has(groupName)) {
        stream.groups.set(groupName, {
          name: groupName,
          lastDeliveredId: '0-0',
          pendingEntries: new Map(),
          consumers: new Map(),
        });
      }
      const group = stream.groups.get(groupName)!;
      
      // Update consumer
      if (!group.consumers.has(consumerName)) {
        group.consumers.set(consumerName, {
          name: consumerName,
          seenTime: Date.now(),
          pendingCount: 0,
        });
      }
      const consumer = group.consumers.get(consumerName)!;
      consumer.seenTime = Date.now();
      
      // Read new entries or pending entries
      const entries: Array<[string, Record<string, string>]> = [];
      
      if (startId === '>') {
        // Read new entries
        for (const entry of stream.entries) {
          if (this.compareStreamIds(entry.id, group.lastDeliveredId) > 0) {
            entries.push([entry.id, entry.fields]);
            group.lastDeliveredId = entry.id;
            group.pendingEntries.set(entry.id, {
              consumer: consumerName,
              deliveryTime: Date.now(),
              deliveryCount: 1,
            });
            consumer.pendingCount++;
            if (count && entries.length >= count) {
              break;
            }
          }
        }
      } else {
        // Read pending entries for this consumer
        for (const [entryId, pending] of group.pendingEntries.entries()) {
          if (pending.consumer === consumerName && this.compareStreamIds(entryId, startId) > 0) {
            const entry = stream.entries.find(e => e.id === entryId);
            if (entry) {
              entries.push([entry.id, entry.fields]);
              pending.deliveryCount++;
              pending.deliveryTime = Date.now();
              if (count && entries.length >= count) {
                break;
              }
            }
          }
        }
      }
      
      if (entries.length > 0) {
        result.push([key, entries]);
      }
    }
    
    return result.length > 0 ? result : null;
  }
  
  /**
   * XACK - Acknowledge entries
   */
  private xack(key: string, groupName: string, entryIds: string[]): number {
    const stream = this.getOrCreateStream(key);
    const group = stream.groups.get(groupName);
    if (!group) {
      return 0;
    }
    
    let acked = 0;
    for (const entryId of entryIds) {
      if (group.pendingEntries.has(entryId)) {
        const pending = group.pendingEntries.get(entryId)!;
        const consumer = group.consumers.get(pending.consumer);
        if (consumer) {
          consumer.pendingCount--;
        }
        group.pendingEntries.delete(entryId);
        acked++;
      }
    }
    
    return acked;
  }
  
  /**
   * XPENDING - Get pending entries info
   */
  private xpending(args: string[]): any {
    const key = args[0];
    const groupName = args[1];
    const stream = this.getOrCreateStream(key);
    const group = stream.groups.get(groupName);
    
    if (!group) {
      return [];
    }
    
    // XPENDING key group [start] [end] [count] [consumer]
    if (args.length === 2) {
      // Return summary
      const totalPending = group.pendingEntries.size;
      const minId = totalPending > 0 
        ? Array.from(group.pendingEntries.keys()).sort((a, b) => this.compareStreamIds(a, b))[0]
        : null;
      const maxId = totalPending > 0
        ? Array.from(group.pendingEntries.keys()).sort((a, b) => this.compareStreamIds(b, a))[0]
        : null;
      
      const consumers: Record<string, number> = {};
      for (const [consumerName, consumer] of group.consumers.entries()) {
        consumers[consumerName] = consumer.pendingCount;
      }
      
      return [totalPending, minId, maxId, Object.entries(consumers).map(([name, count]) => [name, count.toString()])];
    }
    
    // Detailed pending entries
    const start = args[2] || '-';
    const end = args[3] || '+';
    const count = args[4] ? parseInt(args[4]) : undefined;
    const consumer = args[5];
    
    const pendingList: Array<[string, string, number, number]> = [];
    for (const [entryId, pending] of group.pendingEntries.entries()) {
      if (consumer && pending.consumer !== consumer) {
        continue;
      }
      if (start !== '-' && this.compareStreamIds(entryId, start) < 0) {
        continue;
      }
      if (end !== '+' && this.compareStreamIds(entryId, end) > 0) {
        continue;
      }
      pendingList.push([entryId, pending.consumer, pending.deliveryTime, pending.deliveryCount]);
      if (count && pendingList.length >= count) {
        break;
      }
    }
    
    return pendingList;
  }
  
  /**
   * XCLAIM - Claim pending entries
   */
  private xclaim(args: string[]): any {
    // XCLAIM key group consumer min-idle-time id1 id2 ... [IDLE ms] [TIME ms-unix-time] [RETRYCOUNT count] [FORCE] [JUSTID]
    const key = args[0];
    const groupName = args[1];
    const consumerName = args[2];
    const minIdleTime = parseInt(args[3]);
    const entryIds = args.slice(4);
    
    const stream = this.getOrCreateStream(key);
    const group = stream.groups.get(groupName);
    if (!group) {
      return [];
    }
    
    // Update consumer
    if (!group.consumers.has(consumerName)) {
      group.consumers.set(consumerName, {
        name: consumerName,
        seenTime: Date.now(),
        pendingCount: 0,
      });
    }
    const consumer = group.consumers.get(consumerName)!;
    consumer.seenTime = Date.now();
    
    const claimed: Array<[string, Record<string, string>]> = [];
    const now = Date.now();
    
    for (const entryId of entryIds) {
      const pending = group.pendingEntries.get(entryId);
      if (pending && (now - pending.deliveryTime) >= minIdleTime) {
        // Claim entry
        const oldConsumer = group.consumers.get(pending.consumer);
        if (oldConsumer) {
          oldConsumer.pendingCount--;
        }
        pending.consumer = consumerName;
        pending.deliveryTime = now;
        pending.deliveryCount++;
        consumer.pendingCount++;
        
        const entry = stream.entries.find(e => e.id === entryId);
        if (entry) {
          claimed.push([entry.id, entry.fields]);
        }
      }
    }
    
    return claimed;
  }
  
  /**
   * XDEL - Delete entries from stream
   */
  private xdel(key: string, entryIds: string[]): number {
    const stream = this.getOrCreateStream(key);
    let deleted = 0;
    
    for (const entryId of entryIds) {
      const index = stream.entries.findIndex(e => e.id === entryId);
      if (index !== -1) {
        stream.entries.splice(index, 1);
        deleted++;
        
        // Remove from all groups' pending entries
        for (const group of stream.groups.values()) {
          if (group.pendingEntries.has(entryId)) {
            const pending = group.pendingEntries.get(entryId)!;
            const consumer = group.consumers.get(pending.consumer);
            if (consumer) {
              consumer.pendingCount--;
            }
            group.pendingEntries.delete(entryId);
          }
        }
      }
    }
    
    if (deleted > 0) {
      const redisKey = this.keys.get(key)!;
      redisKey.size = this.estimateSize(JSON.stringify(stream));
    }
    
    return deleted;
  }
  
  /**
   * XTRIM - Trim stream to max length
   */
  private xtrim(key: string, args: string[]): number {
    const stream = this.getOrCreateStream(key);
    
    // Parse MAXLEN [~] count or MINID [~] id
    let trimmed = 0;
    
    if (args[0] === 'MAXLEN') {
      const approximate = args[1] === '~';
      const maxLen = parseInt(args[approximate ? 2 : 1]);
      
      if (stream.entries.length > maxLen) {
        const toRemove = stream.entries.length - maxLen;
        stream.entries.splice(0, toRemove);
        trimmed = toRemove;
      }
    } else if (args[0] === 'MINID') {
      const approximate = args[1] === '~';
      const minId = args[approximate ? 2 : 1];
      
      const removeCount = stream.entries.filter(e => this.compareStreamIds(e.id, minId) < 0).length;
      if (removeCount > 0) {
        stream.entries = stream.entries.filter(e => this.compareStreamIds(e.id, minId) >= 0);
        trimmed = removeCount;
      }
    }
    
    if (trimmed > 0) {
      const redisKey = this.keys.get(key)!;
      redisKey.size = this.estimateSize(JSON.stringify(stream));
    }
    
    return trimmed;
  }
  
  /**
   * XINFO - Get stream information
   */
  private xinfo(args: string[]): any {
    if (args.length === 0) {
      throw new Error('ERR syntax error');
    }
    
    const subcommand = args[0].toUpperCase();
    
    if (subcommand === 'STREAM') {
      const key = args[1];
      const stream = this.getOrCreateStream(key);
      
      return [
        'length', stream.entries.length,
        'first-entry', stream.entries.length > 0 ? [stream.entries[0].id, stream.entries[0].fields] : null,
        'last-entry', stream.entries.length > 0 ? [stream.entries[stream.entries.length - 1].id, stream.entries[stream.entries.length - 1].fields] : null,
      ];
    } else if (subcommand === 'GROUPS') {
      const key = args[1];
      const stream = this.getOrCreateStream(key);
      
      const groups: Array<[string, string, string, number, string, number]> = [];
      for (const group of stream.groups.values()) {
        groups.push([
          'name', group.name,
          'consumers', group.consumers.size,
          'pending', group.pendingEntries.size,
          'last-delivered-id', group.lastDeliveredId,
        ]);
      }
      
      return groups;
    } else if (subcommand === 'CONSUMERS') {
      const key = args[1];
      const groupName = args[2];
      const stream = this.getOrCreateStream(key);
      const group = stream.groups.get(groupName);
      
      if (!group) {
        return [];
      }
      
      const consumers: Array<[string, string, number, number]> = [];
      for (const consumer of group.consumers.values()) {
        consumers.push([
          'name', consumer.name,
          'pending', consumer.pendingCount,
          'idle', Date.now() - consumer.seenTime,
        ]);
      }
      
      return consumers;
    }
    
    throw new Error('ERR unknown subcommand');
  }
  
  // Info commands
  private info(section?: string): string {
    const metrics = this.getMetrics();
    return `# Server
redis_version:7.2.0
redis_mode:${this.config.enableCluster ? 'cluster' : 'standalone'}

# Memory
used_memory:${metrics.memoryUsage}
used_memory_human:${this.formatBytes(metrics.memoryUsage)}
maxmemory:${this.maxMemoryBytes}
maxmemory_human:${this.formatBytes(this.maxMemoryBytes)}
maxmemory_policy:${this.config.maxMemoryPolicy || 'noeviction'}
mem_fragmentation_ratio:1.0

# Stats
total_keys:${metrics.totalKeys}
expired_keys:${metrics.expiredKeys}
evicted_keys:${metrics.evictedKeys}
keyspace_hits:${metrics.hitCount}
keyspace_misses:${metrics.missCount}

# Cluster
cluster_enabled:${this.config.enableCluster ? 1 : 0}
`;
  }
  
  private dbsize(): number {
    this.cleanupExpiredKeys();
    return this.keys.size;
  }
  
  // Pub/Sub commands
  /**
   * Publish message to channel
   * Returns number of subscribers that received the message
   */
  private publish(channel: string, message: string): number {
    if (!channel || !message) {
      return 0;
    }
    
    const now = Date.now();
    let subscribersCount = 0;
    
    // Send to direct channel subscribers
    const channelData = this.pubSubChannels.get(channel);
    if (channelData) {
      subscribersCount += channelData.subscribers.size;
      channelData.messageCount++;
      channelData.lastMessageAt = now;
      
      // Update subscriber message counts
      for (const subscriber of channelData.subscribers.values()) {
        subscriber.messageCount++;
      }
    }
    
    // Send to pattern subscribers
    for (const [pattern, patternData] of this.pubSubPatterns.entries()) {
      if (patternData.regex.test(channel)) {
        subscribersCount += patternData.subscribers.size;
        
        // Update subscriber message counts
        for (const subscriber of patternData.subscribers.values()) {
          subscriber.messageCount++;
        }
      }
    }
    
    return subscribersCount;
  }
  
  /**
   * Subscribe to channel(s)
   * Returns array of subscription confirmations
   */
  private subscribe(channels: string[]): Array<['subscribe', string, number]> {
    if (!Array.isArray(channels) || channels.length === 0) {
      return [];
    }
    
    const clientId = `client_${this.pubSubClientIdCounter++}_${Date.now()}`;
    const now = Date.now();
    const results: Array<['subscribe', string, number]> = [];
    
    for (const channel of channels) {
      if (!channel) continue;
      
      let channelData = this.pubSubChannels.get(channel);
      if (!channelData) {
        channelData = {
          name: channel,
          subscribers: new Map(),
          messageCount: 0,
        };
        this.pubSubChannels.set(channel, channelData);
      }
      
      // Add subscriber if not already subscribed
      if (!channelData.subscribers.has(clientId)) {
        channelData.subscribers.set(clientId, {
          clientId,
          subscribedAt: now,
          messageCount: 0,
        });
      }
      
      results.push(['subscribe', channel, channelData.subscribers.size]);
    }
    
    return results;
  }
  
  /**
   * Subscribe to pattern(s)
   * Returns array of subscription confirmations
   */
  private psubscribe(patterns: string[]): Array<['psubscribe', string, number]> {
    if (!Array.isArray(patterns) || patterns.length === 0) {
      return [];
    }
    
    const clientId = `client_${this.pubSubClientIdCounter++}_${Date.now()}`;
    const now = Date.now();
    const results: Array<['psubscribe', string, number]> = [];
    
    for (const pattern of patterns) {
      if (!pattern) continue;
      
      let patternData = this.pubSubPatterns.get(pattern);
      if (!patternData) {
        patternData = {
          pattern,
          regex: this.patternToRegex(pattern),
          subscribers: new Map(),
        };
        this.pubSubPatterns.set(pattern, patternData);
      }
      
      // Add subscriber if not already subscribed
      if (!patternData.subscribers.has(clientId)) {
        patternData.subscribers.set(clientId, {
          clientId,
          subscribedAt: now,
          messageCount: 0,
        });
      }
      
      results.push(['psubscribe', pattern, patternData.subscribers.size]);
    }
    
    return results;
  }
  
  /**
   * Unsubscribe from channel(s)
   * Returns array of unsubscription confirmations
   */
  private unsubscribe(channels?: string[]): Array<['unsubscribe', string, number]> {
    const clientId = `client_${this.pubSubClientIdCounter}`; // Use current client ID
    
    // If no channels specified, unsubscribe from all
    const channelsToUnsubscribe = channels && channels.length > 0 
      ? channels 
      : Array.from(this.pubSubChannels.keys());
    
    const results: Array<['unsubscribe', string, number]> = [];
    
    for (const channel of channelsToUnsubscribe) {
      const channelData = this.pubSubChannels.get(channel);
      if (channelData && channelData.subscribers.has(clientId)) {
        channelData.subscribers.delete(clientId);
        
        // Remove channel if no subscribers
        if (channelData.subscribers.size === 0) {
          this.pubSubChannels.delete(channel);
        }
        
        results.push(['unsubscribe', channel, channelData.subscribers.size]);
      } else if (!channelData) {
        // Channel doesn't exist, but return confirmation anyway
        results.push(['unsubscribe', channel, 0]);
      }
    }
    
    return results;
  }
  
  /**
   * Unsubscribe from pattern(s)
   * Returns array of unsubscription confirmations
   */
  private punsubscribe(patterns?: string[]): Array<['punsubscribe', string, number]> {
    const clientId = `client_${this.pubSubClientIdCounter}`; // Use current client ID
    
    // If no patterns specified, unsubscribe from all
    const patternsToUnsubscribe = patterns && patterns.length > 0 
      ? patterns 
      : Array.from(this.pubSubPatterns.keys());
    
    const results: Array<['punsubscribe', string, number]> = [];
    
    for (const pattern of patternsToUnsubscribe) {
      const patternData = this.pubSubPatterns.get(pattern);
      if (patternData && patternData.subscribers.has(clientId)) {
        patternData.subscribers.delete(clientId);
        
        // Remove pattern if no subscribers
        if (patternData.subscribers.size === 0) {
          this.pubSubPatterns.delete(pattern);
        }
        
        results.push(['punsubscribe', pattern, patternData.subscribers.size]);
      } else if (!patternData) {
        // Pattern doesn't exist, but return confirmation anyway
        results.push(['punsubscribe', pattern, 0]);
      }
    }
    
    return results;
  }
  
  /**
   * Get Pub/Sub information
   * PUBSUB CHANNELS [pattern] - list active channels
   * PUBSUB NUMSUB [channel ...] - number of subscribers per channel
   * PUBSUB NUMPAT - number of pattern subscriptions
   */
  private pubsub(args: string[]): any {
    if (args.length === 0) {
      return { error: 'PUBSUB subcommand required' };
    }
    
    const subcommand = args[0].toUpperCase();
    
    switch (subcommand) {
      case 'CHANNELS': {
        const pattern = args[1] || '*';
        const regex = this.patternToRegex(pattern);
        const channels: string[] = [];
        
        for (const [channelName] of this.pubSubChannels.entries()) {
          if (regex.test(channelName)) {
            channels.push(channelName);
          }
        }
        
        return channels.sort();
      }
      
      case 'NUMSUB': {
        const channels = args.slice(1);
        const result: Record<string, number> = {};
        
        if (channels.length === 0) {
          // Return all channels
          for (const [channelName, channelData] of this.pubSubChannels.entries()) {
            result[channelName] = channelData.subscribers.size;
          }
        } else {
          // Return specified channels
          for (const channel of channels) {
            const channelData = this.pubSubChannels.get(channel);
            result[channel] = channelData ? channelData.subscribers.size : 0;
          }
        }
        
        return result;
      }
      
      case 'NUMPAT': {
        return this.pubSubPatterns.size;
      }
      
      default:
        return { error: `Unknown PUBSUB subcommand: ${subcommand}` };
    }
  }
  
  /**
   * Get Pub/Sub channels and patterns for UI
   */
  public getPubSubInfo(): {
    channels: Array<{ name: string; subscribers: number; messageCount: number; lastMessageAt?: number }>;
    patterns: Array<{ pattern: string; subscribers: number }>;
  } {
    const channels = Array.from(this.pubSubChannels.values()).map(channel => ({
      name: channel.name,
      subscribers: channel.subscribers.size,
      messageCount: channel.messageCount,
      lastMessageAt: channel.lastMessageAt,
    }));
    
    const patterns = Array.from(this.pubSubPatterns.values()).map(pattern => ({
      pattern: pattern.pattern,
      subscribers: pattern.subscribers.size,
    }));
    
    return { channels, patterns };
  }
  
  /**
   * Check if channel has subscribers (for cross-component Pub/Sub)
   */
  public hasChannelSubscribers(channel: string): boolean {
    const channelData = this.pubSubChannels.get(channel);
    if (channelData && channelData.subscribers.size > 0) {
      return true;
    }
    
    // Check pattern subscribers
    for (const [pattern, patternData] of this.pubSubPatterns.entries()) {
      if (patternData.regex.test(channel) && patternData.subscribers.size > 0) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if pattern matches channel (for cross-component Pub/Sub)
   */
  public patternMatchesChannel(pattern: string, channel: string): boolean {
    const patternData = this.pubSubPatterns.get(pattern);
    if (!patternData) {
      return false;
    }
    return patternData.regex.test(channel);
  }
  
  /**
   * Process incoming Pub/Sub message from another component
   * This is called when a message is received from another Redis component
   */
  public processIncomingPubSubMessage(channel: string, message: string): number {
    if (!channel || !message) {
      return 0;
    }
    
    const now = Date.now();
    let subscribersCount = 0;
    
    // Send to direct channel subscribers
    const channelData = this.pubSubChannels.get(channel);
    if (channelData) {
      subscribersCount += channelData.subscribers.size;
      channelData.messageCount++;
      channelData.lastMessageAt = now;
      
      // Update subscriber message counts
      for (const subscriber of channelData.subscribers.values()) {
        subscriber.messageCount++;
      }
    }
    
    // Send to pattern subscribers
    for (const [pattern, patternData] of this.pubSubPatterns.entries()) {
      if (patternData.regex.test(channel)) {
        subscribersCount += patternData.subscribers.size;
        
        // Update subscriber message counts
        for (const subscriber of patternData.subscribers.values()) {
          subscriber.messageCount++;
        }
      }
    }
    
    return subscribersCount;
  }
  
  // Server commands
  private flushdb(): 'OK' {
    this.keys.clear();
    this.currentMemoryUsage = 0;
    this.updateMetrics();
    return 'OK';
  }
  
  private flushall(): 'OK' {
    // In simulation, same as FLUSHDB since we only have one database
    return this.flushdb();
  }
  
  private save(): 'OK' {
    // In simulation, just update lastSaveTime
    this.lastSaveTime = Date.now();
    return 'OK';
  }
  
  private bgsave(): 'OK' {
    // In simulation, same as SAVE
    this.lastSaveTime = Date.now();
    return 'OK';
  }
  
  private lastsave(): number {
    return Math.floor(this.lastSaveTime / 1000); // Return Unix timestamp in seconds
  }
  
  private shutdown(args: string[]): 'OK' {
    // In simulation, just return OK
    // In real Redis, this would shut down the server
    return 'OK';
  }
  
  private config(args: string[]): any {
    if (args.length === 0) {
      throw new Error('ERR wrong number of arguments for CONFIG command');
    }
    
    const subcommand = args[0].toUpperCase();
    
    if (subcommand === 'GET') {
      const param = args[1];
      if (!param) {
        throw new Error('ERR wrong number of arguments for CONFIG GET');
      }
      
      // Return config value from serverConfig or config
      const value = this.serverConfig.get(param) || 
                   (this.config as any)[param] || 
                   this.getConfigValue(param);
      
      return [[param, value || '']];
    } else if (subcommand === 'SET') {
      const param = args[1];
      const value = args[2];
      
      if (!param || value === undefined) {
        throw new Error('ERR wrong number of arguments for CONFIG SET');
      }
      
      // Update config
      this.serverConfig.set(param, value);
      (this.config as any)[param] = value;
      
      // Apply some config changes immediately
      if (param === 'maxmemory') {
        this.maxMemoryBytes = this.parseMemorySize(value);
      } else if (param === 'maxmemory-policy') {
        this.config.maxMemoryPolicy = value as any;
      }
      
      return 'OK';
    } else {
      throw new Error(`ERR unknown subcommand or wrong number of arguments for CONFIG. Try CONFIG HELP.`);
    }
  }
  
  private getConfigValue(param: string): string | undefined {
    // Map Redis config parameters to our config
    const configMap: Record<string, () => string> = {
      'maxmemory': () => this.maxMemoryBytes.toString(),
      'maxmemory-policy': () => this.config.maxMemoryPolicy || 'noeviction',
      'save': () => this.config.rdbSaveInterval || '',
      'appendonly': () => (this.config.enablePersistence && this.config.persistenceType === 'aof') ? 'yes' : 'no',
    };
    
    const getter = configMap[param.toLowerCase()];
    return getter ? getter() : undefined;
  }
  
  private client(args: string[]): any {
    if (args.length === 0) {
      throw new Error('ERR wrong number of arguments for CLIENT command');
    }
    
    const subcommand = args[0].toUpperCase();
    
    if (subcommand === 'LIST') {
      // Return simplified client list
      return `id=0 addr=127.0.0.1:${this.config.port || 6379} fd=0 name= age=0 idle=0 flags=N db=0 sub=0 psub=0 multi=-1 qbuf=0 qbuf-free=0 obl=0 oll=0 omem=0 events=r cmd=client`;
    } else if (subcommand === 'KILL') {
      // In simulation, just return OK
      return 'OK';
    } else {
      throw new Error(`ERR unknown subcommand or wrong number of arguments for CLIENT. Try CLIENT HELP.`);
    }
  }
  
  private slowlogCommand(args: string[]): any {
    if (args.length === 0) {
      // SLOWLOG GET - return all entries
      return this.slowlog.map(entry => [
        entry.id,
        entry.timestamp,
        entry.duration,
        [entry.command, ...entry.args],
        entry.client,
        entry.client,
      ]);
    }
    
    const subcommand = args[0].toUpperCase();
    
    if (subcommand === 'GET') {
      const count = args[1] ? parseInt(args[1]) : 10;
      return this.slowlog.slice(0, count).map(entry => [
        entry.id,
        entry.timestamp,
        entry.duration,
        [entry.command, ...entry.args],
        entry.client,
        entry.client,
      ]);
    } else if (subcommand === 'LEN') {
      return this.slowlog.length;
    } else if (subcommand === 'RESET') {
      this.clearSlowlog();
      return 'OK';
    } else {
      throw new Error('ERR unknown subcommand or wrong number of arguments for SLOWLOG');
    }
  }
  
  /**
   * Set key (internal method)
   */
  private setKey(key: string, type: RedisDataType, value: any, ttl?: number): void {
    const redisKey: RedisKey = {
      key,
      type,
      value,
      ttl: ttl !== undefined ? ttl : -1,
      expiresAt: ttl !== undefined && ttl > 0 ? Date.now() + ttl * 1000 : undefined,
      size: this.estimateSize(typeof value === 'string' ? value : JSON.stringify(value)),
    };
    
    this.keys.set(key, redisKey);
    this.currentMemoryUsage += this.calculateKeySize(redisKey);
  }
  
  /**
   * Delete key
   */
  private deleteKey(key: string): boolean {
    const redisKey = this.keys.get(key);
    if (!redisKey) {
      return false;
    }
    
    this.currentMemoryUsage -= this.calculateKeySize(redisKey);
    this.keys.delete(key);
    return true;
  }
  
  /**
   * Check if key is expired
   */
  private isExpired(redisKey: RedisKey): boolean {
    if (!redisKey.expiresAt) {
      return false;
    }
    return Date.now() >= redisKey.expiresAt;
  }
  
  /**
   * Cleanup expired keys
   */
  private cleanupExpiredKeys(): void {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, redisKey] of this.keys.entries()) {
      if (this.isExpired(redisKey)) {
        this.deleteKey(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      this.metrics.expiredKeys += expiredCount;
    }
  }
  
  /**
   * Check memory and evict keys if needed
   */
  private checkMemoryAndEvict(): void {
    if (this.currentMemoryUsage <= this.maxMemoryBytes) {
      return;
    }
    
    const policy = this.config.maxMemoryPolicy || 'noeviction';
    
    if (policy === 'noeviction') {
      // Don't evict, just reject
      return;
    }
    
    // Evict keys based on policy
    const keysToEvict = this.selectKeysToEvict(policy);
    let evicted = 0;
    
    for (const key of keysToEvict) {
      this.deleteKey(key);
      evicted++;
      
      if (this.currentMemoryUsage <= this.maxMemoryBytes * 0.9) {
        break; // Evict until 90% of max memory
      }
    }
    
    if (evicted > 0) {
      this.metrics.evictedKeys += evicted;
    }
  }
  
  /**
   * Select keys to evict based on policy
   */
  private selectKeysToEvict(policy: string): string[] {
    const allKeys = Array.from(this.keys.keys());
    
    switch (policy) {
      case 'allkeys-lru':
      case 'allkeys-lfu':
      case 'allkeys-random':
        return allKeys;
      
      case 'volatile-lru':
      case 'volatile-lfu':
      case 'volatile-ttl':
      case 'volatile-random':
        return allKeys.filter(key => {
          const redisKey = this.keys.get(key);
          return redisKey && redisKey.expiresAt !== undefined;
        });
      
      default:
        return [];
    }
  }
  
  /**
   * Calculate key size in bytes
   */
  private calculateKeySize(redisKey: RedisKey): number {
    if (redisKey.size) {
      return redisKey.size;
    }
    
    let valueSize = 0;
    if (typeof redisKey.value === 'string') {
      valueSize = Buffer.byteLength(redisKey.value, 'utf8');
    } else {
      valueSize = Buffer.byteLength(JSON.stringify(redisKey.value), 'utf8');
    }
    
    // Key name size + overhead
    const keySize = Buffer.byteLength(redisKey.key, 'utf8');
    return keySize + valueSize + 100; // 100 bytes overhead
  }
  
  /**
   * Estimate size of value
   */
  private estimateSize(value: string): number {
    return Buffer.byteLength(value, 'utf8');
  }
  
  /**
   * Convert pattern to regex
   */
  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
  }
  
  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + sizes[i];
  }
  
  /**
   * Get metrics
   */
  public getMetrics(): RedisMetrics {
    this.cleanupExpiredKeys();
    this.updateMetrics();
    return { ...this.metrics };
  }
  
  /**
   * Update metrics
   */
  private updateMetrics(): void {
    const now = Date.now();
    const deltaTime = (now - this.lastMetricsUpdate) / 1000; // seconds
    
    // Count keys by type
    const keysByType: Record<RedisDataType, number> = {
      string: 0,
      hash: 0,
      list: 0,
      set: 0,
      zset: 0,
      stream: 0,
    };
    
    for (const redisKey of this.keys.values()) {
      keysByType[redisKey.type]++;
    }
    
    // Calculate operations per second
    const recentOps = this.operationHistory.filter(
      op => op.timestamp > now - 1000
    ).length;
    
    // Calculate hit rate
    const totalRequests = this.metrics.hitCount + this.metrics.missCount;
    const hitRate = totalRequests > 0 
      ? this.metrics.hitCount / totalRequests 
      : 0;
    
    // Build command statistics
    const commandStatistics: CommandStatistics[] = Array.from(this.commandStats.entries())
      .map(([command, stats]) => ({
        command,
        calls: stats.calls,
        totalDuration: stats.totalDuration,
        averageDuration: stats.calls > 0 ? stats.totalDuration / stats.calls : 0,
      }))
      .sort((a, b) => b.calls - a.calls) // Sort by calls descending
      .slice(0, 20); // Top 20 commands
    
    // Update connected clients detail (simplified simulation)
    if (this.connectedClientsDetail.length === 0) {
      this.connectedClientsDetail = [{
        id: '0',
        addr: `127.0.0.1:${this.config.port || 6379}`,
        fd: 0,
        name: '',
        age: Math.floor((now - this.lastMetricsUpdate) / 1000),
        idle: 0,
        flags: 'N',
        db: this.config.database || 0,
        sub: 0,
        psub: 0,
        multi: -1,
        qbuf: 0,
        qbufFree: 0,
        obl: 0,
        oll: 0,
        omem: 0,
        events: 'r',
        cmd: 'client',
      }];
    } else {
      // Update age and idle time
      this.connectedClientsDetail.forEach(client => {
        client.age = Math.floor((now - this.lastMetricsUpdate) / 1000) + client.age;
      });
    }
    
    this.metrics = {
      totalKeys: this.keys.size,
      keysByType,
      memoryUsage: this.currentMemoryUsage,
      memoryUsagePercent: this.maxMemoryBytes > 0 
        ? (this.currentMemoryUsage / this.maxMemoryBytes) * 100 
        : 0,
      operationsPerSecond: recentOps,
      hitCount: this.metrics.hitCount,
      missCount: this.metrics.missCount,
      hitRate,
      expiredKeys: this.metrics.expiredKeys,
      evictedKeys: this.metrics.evictedKeys,
      connectedClients: this.connectedClientsDetail.length,
      slowlog: [...this.slowlog],
      commandStatistics,
      networkBytesIn: this.networkBytesIn,
      networkBytesOut: this.networkBytesOut,
      connectedClientsDetail: [...this.connectedClientsDetail],
    };
    
    this.lastMetricsUpdate = now;
  }
  
  /**
   * Get all keys
   */
  public getAllKeys(): RedisKey[] {
    this.cleanupExpiredKeys();
    return Array.from(this.keys.values());
  }
  
  /**
   * Get key by name
   */
  public getKey(key: string): RedisKey | undefined {
    const redisKey = this.keys.get(key);
    if (redisKey && this.isExpired(redisKey)) {
      this.deleteKey(key);
      return undefined;
    }
    return redisKey;
  }
  
  /**
   * Sync keys from configuration
   * This method synchronizes keys from UI configuration with runtime state
   */
  public syncKeysFromConfig(configKeys: RedisKey[]): void {
    const configKeyMap = new Map<string, RedisKey>();
    for (const key of configKeys) {
      configKeyMap.set(key.key, key);
    }
    
    // Remove keys that are no longer in config (but keep runtime-created keys)
    // In real scenario, we might want to preserve runtime keys, but for simulation
    // we'll sync with config
    const keysToRemove: string[] = [];
    for (const [key, redisKey] of this.keys.entries()) {
      // Only remove if key was originally from config (we can't distinguish, so we'll be conservative)
      // For now, we'll keep all existing keys and only add/update from config
    }
    
    // Add or update keys from config
    for (const configKey of configKeys) {
      const existingKey = this.keys.get(configKey.key);
      if (!existingKey) {
        // New key from config
        this.setKey(configKey.key, configKey.type, configKey.value, configKey.ttl);
      } else {
        // Update existing key if config changed
        if (existingKey.type !== configKey.type || 
            JSON.stringify(existingKey.value) !== JSON.stringify(configKey.value) ||
            existingKey.ttl !== configKey.ttl) {
          // Update key
          this.currentMemoryUsage -= this.calculateKeySize(existingKey);
          const updatedKey: RedisKey = {
            ...configKey,
            expiresAt: configKey.ttl !== undefined && configKey.ttl > 0 
              ? Date.now() + configKey.ttl * 1000 
              : undefined,
            size: this.estimateSize(typeof configKey.value === 'string' 
              ? configKey.value 
              : JSON.stringify(configKey.value)),
          };
          this.keys.set(configKey.key, updatedKey);
          this.currentMemoryUsage += this.calculateKeySize(updatedKey);
        }
      }
    }
    
    this.updateMetrics();
  }
}


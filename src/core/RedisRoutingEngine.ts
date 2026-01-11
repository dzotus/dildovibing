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
  };
  
  private operationCount: number = 0;
  private lastMetricsUpdate: number = Date.now();
  private operationHistory: Array<{ timestamp: number }> = [];
  
  // For cluster mode
  private clusterSlots: Map<number, string> = new Map(); // slot -> node
  private clusterNodes: string[] = [];
  
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
        
        // Hash commands
        case 'HGET':
          result = this.hget(args[0], args[1]);
          break;
        case 'HSET':
          result = this.hset(args[0], args.slice(1));
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
        
        // Sorted Set commands
        case 'ZADD':
          result = this.zadd(args[0], args.slice(1));
          break;
        case 'ZREM':
          result = this.zrem(args[0], args.slice(1));
          break;
        case 'ZRANGE':
          result = this.zrange(args[0], parseInt(args[1]), parseInt(args[2]));
          break;
        case 'ZSCORE':
          result = this.zscore(args[0], args[1]);
          break;
        case 'ZCARD':
          result = this.zcard(args[0]);
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
      this.recordOperation();
      
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
  private recordOperation() {
    this.operationCount++;
    this.operationHistory.push({ timestamp: Date.now() });
    
    // Keep only last 1000 operations for metrics
    if (this.operationHistory.length > 1000) {
      this.operationHistory.shift();
    }
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
  
  private zrange(key: string, start: number, stop: number): string[] {
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
    
    return entries.slice(startIdx, stopIdx + 1).map(e => e[0]);
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
      connectedClients: 1, // Simplified
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


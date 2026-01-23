/**
 * BFF (Backend for Frontend) Routing Engine
 * Handles data aggregation from multiple backend services with caching, circuit breaking, and retry logic
 */

export interface BFFBackend {
  id: string;
  name: string;
  endpoint: string;
  protocol: 'http' | 'grpc' | 'graphql';
  status: 'connected' | 'disconnected' | 'error';
  timeout?: number;
  retries?: number;
  retryBackoff?: 'exponential' | 'linear' | 'constant';
  circuitBreaker?: {
    enabled: boolean;
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
  };
}

export interface BFFEndpoint {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  backends: string[]; // Backend IDs
  aggregator: 'merge' | 'sequential' | 'parallel';
  cacheKey?: string;
  cacheTtl?: number;
  timeout?: number;
}

export interface BFFRequest {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
}

export interface BFFBackendResponse {
  backendId: string;
  status: number;
  data?: unknown;
  error?: string;
  latency: number;
  cached: boolean;
}

export interface BFFResponse {
  status: number;
  data?: unknown;
  error?: string;
  latency: number;
  backendResponses: BFFBackendResponse[];
  cacheHit: boolean;
}

export interface BFFConfig {
  backends?: BFFBackend[];
  endpoints?: BFFEndpoint[];
  enableCaching?: boolean;
  enableRequestBatching?: boolean;
  enableResponseCompression?: boolean;
  defaultTimeout?: number;
  maxConcurrentRequests?: number;
  cacheMode?: 'memory' | 'redis' | 'off';
  cacheTtl?: number;
  fallbackEnabled?: boolean;
  fallbackComponent?: string;
  redisEngine?: any; // RedisRoutingEngine - optional, used when cacheMode === 'redis'
  redisNodeId?: string; // Redis node ID for cache key prefix
  sendMessageToBackend?: (backendId: string, request: BFFRequest) => Promise<{ data?: unknown; error?: string; latency: number; status: number }>; // Function to send requests to real backends
  bffNodeId?: string; // BFF node ID for finding connections
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  failures: number;
  successes: number;
  state: 'closed' | 'open' | 'half-open';
  lastFailureTime: number;
  nextAttemptTime: number;
}

/**
 * Cache entry
 */
interface CacheEntry {
  key: string;
  data: unknown;
  expiresAt: number;
  hitCount: number;
}

/**
 * Backend metrics
 */
interface BackendMetrics {
  requestCount: number;
  errorCount: number;
  totalLatency: number;
  averageLatency: number;
  lastRequestTime: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * BFF Routing Engine
 * Implements real BFF patterns: aggregation, caching, circuit breaking, retry
 */
export class BFFRoutingEngine {
  private backends: Map<string, BFFBackend> = new Map();
  private endpoints: Map<string, BFFEndpoint> = new Map();
  private config: BFFConfig = {};
  
  // Circuit breakers per backend
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  
  // Cache (in-memory)
  private cache: Map<string, CacheEntry> = new Map();
  private cacheMode: 'memory' | 'redis' | 'off' = 'memory';
  private defaultCacheTtl: number = 5; // seconds
  private redisEngine: any = null; // RedisRoutingEngine - optional
  private redisNodeId: string = ''; // Redis node ID for cache key prefix
  
  // Metrics per backend
  private backendMetrics: Map<string, BackendMetrics> = new Map();
  
  // Request batching
  private batchQueue: Map<string, Array<{
    request: BFFRequest;
    resolve: (response: BFFResponse) => void;
    reject: (error: Error) => void;
  }>> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;
  private batchSize: number = 10;
  private batchTimeout: number = 50; // ms
  
  // Function to send messages to real backends
  private sendMessageToBackend?: (backendId: string, request: BFFRequest) => Promise<{ data?: unknown; error?: string; latency: number; status: number }>;
  
  /**
   * Initialize BFF with configuration
   */
  public initialize(config: BFFConfig) {
    this.config = config;
    this.backends.clear();
    this.endpoints.clear();
    this.circuitBreakers.clear();
    this.cache.clear();
    this.backendMetrics.clear();
    
    // Set cache mode
    this.cacheMode = config.cacheMode || 'memory';
    this.defaultCacheTtl = config.cacheTtl || 5;
    this.redisEngine = config.redisEngine || null;
    this.redisNodeId = config.redisNodeId || '';
    
    // Store function to send messages to backends
    this.sendMessageToBackend = config.sendMessageToBackend;
    
    // Initialize backends
    if (config.backends) {
      for (const backend of config.backends) {
        this.backends.set(backend.id, { ...backend });
        this.initializeCircuitBreaker(backend.id, backend.circuitBreaker);
        this.initializeBackendMetrics(backend.id);
      }
    }
    
    // Initialize endpoints
    if (config.endpoints) {
      for (const endpoint of config.endpoints) {
        this.endpoints.set(endpoint.id, { ...endpoint });
      }
    }
  }

  /**
   * Update configuration without losing state (metrics, circuit breakers, cache)
   */
  public updateConfig(config: Partial<BFFConfig>): void {
    // Update cache mode and Redis connection if changed
    if (config.cacheMode !== undefined && config.cacheMode !== this.cacheMode) {
      // If switching from redis to memory or off, clear redis cache references
      if (this.cacheMode === 'redis' && config.cacheMode !== 'redis') {
        // Keep in-memory cache entries
      }
      // If switching to redis, update redis engine
      if (config.cacheMode === 'redis' && config.redisEngine) {
        this.redisEngine = config.redisEngine;
        this.redisNodeId = config.redisNodeId || '';
      }
      this.cacheMode = config.cacheMode;
    }
    
    if (config.cacheTtl !== undefined) {
      this.defaultCacheTtl = config.cacheTtl;
    }
    
    if (config.redisEngine !== undefined) {
      this.redisEngine = config.redisEngine;
    }
    
    if (config.redisNodeId !== undefined) {
      this.redisNodeId = config.redisNodeId;
    }

    // Update backends - preserve metrics and circuit breakers
    if (config.backends !== undefined) {
      // Remove backends that are no longer in config
      const newBackendIds = new Set(config.backends.map(b => b.id));
      for (const [id] of this.backends) {
        if (!newBackendIds.has(id)) {
          this.backends.delete(id);
          this.circuitBreakers.delete(id);
          this.backendMetrics.delete(id);
        }
      }
      
      // Add or update backends
      for (const backend of config.backends) {
        const existing = this.backends.get(backend.id);
        this.backends.set(backend.id, { ...backend });
        
        // Preserve circuit breaker state if backend already exists
        if (existing) {
          const existingCircuitBreaker = this.circuitBreakers.get(backend.id);
          if (existingCircuitBreaker && backend.circuitBreaker?.enabled) {
            // Update circuit breaker config but preserve state
            // State will be updated by the circuit breaker logic itself
          } else if (backend.circuitBreaker?.enabled) {
            // Initialize new circuit breaker
            this.initializeCircuitBreaker(backend.id, backend.circuitBreaker);
          } else {
            // Remove circuit breaker if disabled
            this.circuitBreakers.delete(backend.id);
          }
        } else {
          // New backend - initialize circuit breaker and metrics
          this.initializeCircuitBreaker(backend.id, backend.circuitBreaker);
          this.initializeBackendMetrics(backend.id);
        }
      }
    }

    // Update endpoints - preserve cache entries
    if (config.endpoints !== undefined) {
      // Remove endpoints that are no longer in config
      const newEndpointIds = new Set(config.endpoints.map(e => e.id));
      for (const [id] of this.endpoints) {
        if (!newEndpointIds.has(id)) {
          this.endpoints.delete(id);
          // Note: We don't clear cache entries here as they might still be valid
          // Cache cleanup happens automatically on expiration
        }
      }
      
      // Add or update endpoints
      for (const endpoint of config.endpoints) {
        this.endpoints.set(endpoint.id, { ...endpoint });
      }
    }

    // Update sendMessageToBackend function if provided
    if (config.sendMessageToBackend !== undefined) {
      this.sendMessageToBackend = config.sendMessageToBackend;
    }
    
    if (config.bffNodeId !== undefined) {
      this.config.bffNodeId = config.bffNodeId;
    }

    // Update other config options
    if (config.enableCaching !== undefined) {
      this.config.enableCaching = config.enableCaching;
    }
    if (config.enableRequestBatching !== undefined) {
      this.config.enableRequestBatching = config.enableRequestBatching;
    }
    if (config.enableResponseCompression !== undefined) {
      this.config.enableResponseCompression = config.enableResponseCompression;
    }
    if (config.defaultTimeout !== undefined) {
      this.config.defaultTimeout = config.defaultTimeout;
    }
    if (config.maxConcurrentRequests !== undefined) {
      this.config.maxConcurrentRequests = config.maxConcurrentRequests;
    }
    if (config.fallbackEnabled !== undefined) {
      this.config.fallbackEnabled = config.fallbackEnabled;
    }
    if (config.fallbackComponent !== undefined) {
      this.config.fallbackComponent = config.fallbackComponent;
    }
  }
  
  /**
   * Initialize circuit breaker for a backend
   */
  private initializeCircuitBreaker(backendId: string, config?: BFFBackend['circuitBreaker']) {
    if (config?.enabled) {
      this.circuitBreakers.set(backendId, {
        failures: 0,
        successes: 0,
        state: 'closed',
        lastFailureTime: 0,
        nextAttemptTime: 0,
      });
    }
  }
  
  /**
   * Initialize metrics for a backend
   */
  private initializeBackendMetrics(backendId: string) {
    this.backendMetrics.set(backendId, {
      requestCount: 0,
      errorCount: 0,
      totalLatency: 0,
      averageLatency: 0,
      lastRequestTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
    });
  }
  
  /**
   * Route a request through BFF
   */
  public async routeRequest(request: BFFRequest): Promise<BFFResponse> {
    const startTime = Date.now();
    
    // 1. Match endpoint
    const endpoint = this.matchEndpoint(request);
    if (!endpoint) {
      return {
        status: 404,
        error: 'Endpoint not found',
        latency: Date.now() - startTime,
        backendResponses: [],
        cacheHit: false,
      };
    }
    
    // 2. Check cache first
    if (this.config.enableCaching && this.cacheMode !== 'off') {
      const cacheKey = this.getCacheKey(endpoint, request);
      const cached = this.getCached(cacheKey);
      if (cached) {
        const metrics = this.backendMetrics.get(endpoint.backends[0]) || this.initializeBackendMetrics(endpoint.backends[0]);
        if (metrics) {
          metrics.cacheHits++;
        }
        return {
          status: 200,
          data: cached.data,
          latency: Date.now() - startTime,
          backendResponses: [],
          cacheHit: true,
        };
      }
    }
    
    // 3. Get backend responses based on aggregation strategy
    const backendResponses = await this.aggregateBackends(endpoint, request);
    
    // 4. Aggregate responses
    const aggregated = this.aggregateResponses(endpoint, backendResponses);
    
    // 5. Cache result if successful
    if (this.config.enableCaching && this.cacheMode !== 'off' && aggregated.status === 200) {
      const cacheKey = this.getCacheKey(endpoint, request);
      const ttl = endpoint.cacheTtl || this.defaultCacheTtl;
      this.setCached(cacheKey, aggregated.data, ttl);
    }
    
    // 6. Update metrics
    for (const response of backendResponses) {
      const metrics = this.backendMetrics.get(response.backendId);
      if (metrics) {
        metrics.requestCount++;
        if (response.status >= 400) {
          metrics.errorCount++;
        }
        metrics.totalLatency += response.latency;
        metrics.averageLatency = metrics.totalLatency / metrics.requestCount;
        metrics.lastRequestTime = Date.now();
        if (!response.cached) {
          metrics.cacheMisses++;
        }
      }
    }
    
    return {
      ...aggregated,
      latency: Date.now() - startTime,
      backendResponses,
      cacheHit: false,
    };
  }
  
  /**
   * Match request to endpoint
   */
  private matchEndpoint(request: BFFRequest): BFFEndpoint | null {
    for (const endpoint of this.endpoints.values()) {
      if (endpoint.path === request.path && endpoint.method === request.method) {
        return endpoint;
      }
    }
    return null;
  }
  
  /**
   * Aggregate responses from multiple backends
   */
  private async aggregateBackends(endpoint: BFFEndpoint, request: BFFRequest): Promise<BFFBackendResponse[]> {
    const backendIds = endpoint.backends;
    
    switch (endpoint.aggregator) {
      case 'parallel':
        // Execute all backends in parallel
        return await this.executeBackendsParallel(backendIds, request, endpoint);
        
      case 'sequential':
        // Execute backends sequentially (each can depend on previous)
        return await this.executeBackendsSequential(backendIds, request, endpoint);
        
      case 'merge':
      default:
        // Execute all backends in parallel and merge results
        return await this.executeBackendsParallel(backendIds, request, endpoint);
    }
  }
  
  /**
   * Execute backends in parallel
   */
  private async executeBackendsParallel(
    backendIds: string[],
    request: BFFRequest,
    endpoint: BFFEndpoint
  ): Promise<BFFBackendResponse[]> {
    const promises = backendIds.map(backendId => 
      this.executeBackend(backendId, request, endpoint)
    );
    return Promise.all(promises);
  }
  
  /**
   * Execute backends sequentially
   */
  private async executeBackendsSequential(
    backendIds: string[],
    request: BFFRequest,
    endpoint: BFFEndpoint
  ): Promise<BFFBackendResponse[]> {
    const responses: BFFBackendResponse[] = [];
    let accumulatedData: Record<string, unknown> = {};
    
    for (const backendId of backendIds) {
      // Pass accumulated data from previous backends
      const enrichedRequest = {
        ...request,
        body: {
          ...(typeof request.body === 'object' ? request.body : {}),
          ...accumulatedData,
        } as Record<string, unknown>,
      };
      
      const response = await this.executeBackend(backendId, enrichedRequest, endpoint);
      responses.push(response);
      
      // If successful, accumulate data for next backend
      if (response.status >= 200 && response.status < 300 && response.data) {
        if (typeof response.data === 'object') {
          accumulatedData = { ...accumulatedData, ...response.data as Record<string, unknown> };
        }
      } else {
        // If error, stop sequential execution
        break;
      }
    }
    
    return responses;
  }
  
  /**
   * Execute a single backend request
   */
  private async executeBackend(
    backendId: string,
    request: BFFRequest,
    endpoint: BFFEndpoint
  ): Promise<BFFBackendResponse> {
    const backend = this.backends.get(backendId);
    if (!backend) {
      return {
        backendId,
        status: 503,
        error: 'Backend not found',
        latency: 0,
        cached: false,
      };
    }
    
    // Check circuit breaker
    const circuitBreaker = this.circuitBreakers.get(backendId);
    if (circuitBreaker) {
      const now = Date.now();
      if (circuitBreaker.state === 'open') {
        if (now < circuitBreaker.nextAttemptTime) {
          return {
            backendId,
            status: 503,
            error: 'Circuit breaker is open',
            latency: 0,
            cached: false,
          };
        } else {
          // Try half-open
          circuitBreaker.state = 'half-open';
        }
      }
    }
    
    // Check cache
    if (this.config.enableCaching && this.cacheMode !== 'off') {
      const cacheKey = `${backendId}:${endpoint.path}:${JSON.stringify(request.query || {})}`;
      const cached = this.getCached(cacheKey);
      if (cached) {
        return {
          backendId,
          status: 200,
          data: cached.data,
          latency: 1, // Cache hit is very fast
          cached: true,
        };
      }
    }
    
    // Use real backend connection if available
    if (this.sendMessageToBackend) {
      const timeout = endpoint.timeout || backend.timeout || this.config.defaultTimeout || 5000;
      const retries = backend.retries || 0;
      const retryBackoff = backend.retryBackoff || 'exponential';
      
      let lastError: string | undefined;
      let lastLatency = 0;
      
      for (let attempt = 0; attempt <= retries; attempt++) {
        if (attempt > 0) {
          // Wait before retry
          const backoff = this.calculateBackoff(attempt, retryBackoff);
          await new Promise(resolve => setTimeout(resolve, backoff));
          lastLatency += backoff;
        }
        
        try {
          const startTime = Date.now();
          const response = await Promise.race([
            this.sendMessageToBackend(backendId, request),
            new Promise<{ data?: unknown; error?: string; latency: number; status: number }>((_, reject) =>
              setTimeout(() => reject(new Error('Request timeout')), timeout)
            ),
          ]);
          
          const requestLatency = Date.now() - startTime;
          lastLatency += requestLatency;
          
          // Update circuit breaker on success
          if (response.status >= 200 && response.status < 300) {
            if (circuitBreaker) {
              if (circuitBreaker.state === 'half-open') {
                circuitBreaker.successes++;
                if (circuitBreaker.successes >= (backend.circuitBreaker?.successThreshold || 2)) {
                  circuitBreaker.state = 'closed';
                  circuitBreaker.failures = 0;
                  circuitBreaker.successes = 0;
                }
              } else {
                circuitBreaker.failures = Math.max(0, circuitBreaker.failures - 1);
              }
            }
            
            return {
              backendId,
              status: response.status,
              data: response.data,
              latency: lastLatency,
              cached: false,
            };
          } else {
            // Request failed
            lastError = response.error || `Backend returned status ${response.status}`;
            
            // Update circuit breaker on failure
            if (circuitBreaker) {
              circuitBreaker.failures++;
              circuitBreaker.lastFailureTime = Date.now();
              
              if (circuitBreaker.failures >= (backend.circuitBreaker?.failureThreshold || 5)) {
                circuitBreaker.state = 'open';
                circuitBreaker.nextAttemptTime = Date.now() + (backend.circuitBreaker?.timeout || 60000);
              }
            }
            
            // If this was the last attempt, return error
            if (attempt === retries) {
              return {
                backendId,
                status: response.status,
                error: lastError,
                latency: lastLatency,
                cached: false,
              };
            }
          }
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Unknown error';
          lastLatency += timeout; // Add timeout to latency
          
          // Update circuit breaker on error
          if (circuitBreaker) {
            circuitBreaker.failures++;
            circuitBreaker.lastFailureTime = Date.now();
            
            if (circuitBreaker.failures >= (backend.circuitBreaker?.failureThreshold || 5)) {
              circuitBreaker.state = 'open';
              circuitBreaker.nextAttemptTime = Date.now() + (backend.circuitBreaker?.timeout || 60000);
            }
          }
          
          // If this was the last attempt, return error
          if (attempt === retries) {
            return {
              backendId,
              status: 503,
              error: lastError,
              latency: lastLatency,
              cached: false,
            };
          }
        }
      }
      
      // All retries failed
      return {
        backendId,
        status: 503,
        error: lastError || 'Backend request failed',
        latency: lastLatency,
        cached: false,
      };
    } else {
      // No sendMessageToBackend function - return error
      return {
        backendId,
        status: 503,
        error: 'Backend connection not configured',
        latency: 0,
        cached: false,
      };
    }
  }
  
  /**
   * Calculate backoff delay for retry
   */
  private calculateBackoff(attempt: number, strategy: 'exponential' | 'linear' | 'constant'): number {
    switch (strategy) {
      case 'exponential':
        return Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      case 'linear':
        return 100 * attempt;
      case 'constant':
      default:
        return 100;
    }
  }
  
  /**
   * Aggregate multiple backend responses into single response
   */
  private aggregateResponses(
    endpoint: BFFEndpoint,
    responses: BFFBackendResponse[]
  ): { status: number; data?: unknown; error?: string } {
    // Handle empty responses
    if (responses.length === 0) {
      return {
        status: 503,
        error: 'No backends configured for endpoint',
      };
    }
    
    // Check if all failed
    const allFailed = responses.every(r => r.status >= 400);
    if (allFailed) {
      return {
        status: 503,
        error: 'All backends failed',
      };
    }
    
    // Check if any failed (for merge/parallel, we can still return partial data)
    const hasErrors = responses.some(r => r.status >= 400);
    
    // Merge successful responses
    if (endpoint.aggregator === 'merge' || endpoint.aggregator === 'parallel') {
      const merged: Record<string, unknown> = {};
      
      for (const response of responses) {
        if (response.status >= 200 && response.status < 300 && response.data) {
          const backend = this.backends.get(response.backendId);
          const key = backend?.name || response.backendId;
          
          if (typeof response.data === 'object' && response.data !== null) {
            merged[key] = response.data;
          } else {
            merged[key] = response.data;
          }
        }
      }
      
      return {
        status: hasErrors ? 207 : 200, // 207 Multi-Status if partial success
        data: merged,
      };
    } else {
      // Sequential: return last successful response or first error
      const lastResponse = responses[responses.length - 1];
      if (lastResponse.status >= 200 && lastResponse.status < 300) {
        return {
          status: 200,
          data: lastResponse.data,
        };
      } else {
        return {
          status: lastResponse.status,
          error: lastResponse.error,
        };
      }
    }
  }
  
  /**
   * Get cache key for request
   */
  private getCacheKey(endpoint: BFFEndpoint, request: BFFRequest): string {
    if (endpoint.cacheKey) {
      return endpoint.cacheKey;
    }
    return `${endpoint.path}:${endpoint.method}:${JSON.stringify(request.query || {})}`;
  }
  
  /**
   * Get cached value
   */
  private getCached(key: string): CacheEntry | null {
    if (this.cacheMode === 'off') {
      return null;
    }
    
    // Use Redis if configured
    if (this.cacheMode === 'redis' && this.redisEngine) {
      const redisKey = this.getRedisCacheKey(key);
      const result = this.redisEngine.executeCommand('GET', [redisKey]);
      
      if (result.success && result.value !== null) {
        try {
          const data = typeof result.value === 'string' 
            ? JSON.parse(result.value) 
            : result.value;
          
          // Create cache entry for compatibility
          return {
            key,
            data,
            expiresAt: Date.now() + (this.defaultCacheTtl * 1000), // Approximate
            hitCount: 1,
          };
        } catch (e) {
          // Invalid JSON, return null
          return null;
        }
      }
      
      return null;
    }
    
    // Use in-memory cache
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    
    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    entry.hitCount++;
    return entry;
  }
  
  /**
   * Set cached value
   */
  private setCached(key: string, data: unknown, ttl: number) {
    if (this.cacheMode === 'off') {
      return;
    }
    
    // Use Redis if configured
    if (this.cacheMode === 'redis' && this.redisEngine) {
      const redisKey = this.getRedisCacheKey(key);
      const value = typeof data === 'string' ? data : JSON.stringify(data);
      const args = [redisKey, value];
      
      if (ttl > 0) {
        args.push('EX', String(ttl));
      }
      
      this.redisEngine.executeCommand('SET', args);
      return;
    }
    
    // Use in-memory cache
    this.cache.set(key, {
      key,
      data,
      expiresAt: Date.now() + (ttl * 1000),
      hitCount: 0,
    });
    
    // Cleanup expired entries periodically (simple implementation)
    if (this.cache.size > 1000) {
      this.cleanupCache();
    }
  }
  
  /**
   * Get Redis cache key with prefix
   */
  private getRedisCacheKey(key: string): string {
    const prefix = this.redisNodeId ? `bff:${this.redisNodeId}:` : 'bff:';
    return `${prefix}${key}`;
  }
  
  /**
   * Cleanup expired cache entries
   */
  private cleanupCache() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Get statistics
   */
  public getStats(): {
    totalRequests: number;
    totalErrors: number;
    averageLatency: number;
    cacheHitRate: number;
    backendStats: Record<string, BackendMetrics>;
  } {
    let totalRequests = 0;
    let totalErrors = 0;
    let totalLatency = 0;
    let totalCacheHits = 0;
    let totalCacheMisses = 0;
    
    const backendStats: Record<string, BackendMetrics> = {};
    
    for (const [backendId, metrics] of this.backendMetrics.entries()) {
      totalRequests += metrics.requestCount;
      totalErrors += metrics.errorCount;
      totalLatency += metrics.totalLatency;
      totalCacheHits += metrics.cacheHits;
      totalCacheMisses += metrics.cacheMisses;
      
      backendStats[backendId] = { ...metrics };
    }
    
    return {
      totalRequests,
      totalErrors,
      averageLatency: totalRequests > 0 ? totalLatency / totalRequests : 0,
      cacheHitRate: (totalCacheHits + totalCacheMisses) > 0 
        ? totalCacheHits / (totalCacheHits + totalCacheMisses) 
        : 0,
      backendStats,
    };
  }
  
  /**
   * Get backend metrics
   */
  public getBackendMetrics(backendId: string): BackendMetrics | undefined {
    return this.backendMetrics.get(backendId);
  }
  
  /**
   * Get all backends
   */
  public getBackends(): BFFBackend[] {
    return Array.from(this.backends.values());
  }
  
  /**
   * Get all endpoints
   */
  public getEndpoints(): BFFEndpoint[] {
    return Array.from(this.endpoints.values());
  }
  
  /**
   * Update backend status
   */
  public updateBackendStatus(backendId: string, status: BFFBackend['status']) {
    const backend = this.backends.get(backendId);
    if (backend) {
      backend.status = status;
    }
  }
}


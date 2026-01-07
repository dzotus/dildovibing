/**
 * gRPC Routing Engine
 * Handles gRPC service routing, method invocation, streaming, and metrics
 */

export interface GRPCService {
  name: string;
  methods: Array<{
    name: string;
    inputType: string;
    outputType: string;
    streaming?: 'unary' | 'client-streaming' | 'server-streaming' | 'bidirectional';
    enabled?: boolean;
    timeout?: number;
    rateLimit?: number; // requests per second
    retryPolicy?: {
      maxAttempts?: number;
      initialBackoff?: number; // ms
      maxBackoff?: number; // ms
      backoffMultiplier?: number;
    };
  }>;
  enabled?: boolean;
}

export interface GRPCRequest {
  service: string;
  method: string;
  payload?: unknown;
  metadata?: Record<string, string>;
  timeout?: number;
  clientIP?: string;
}

export interface GRPCResponse {
  status: 'OK' | 'CANCELLED' | 'UNKNOWN' | 'INVALID_ARGUMENT' | 'DEADLINE_EXCEEDED' | 'NOT_FOUND' | 'ALREADY_EXISTS' | 'PERMISSION_DENIED' | 'RESOURCE_EXHAUSTED' | 'FAILED_PRECONDITION' | 'ABORTED' | 'OUT_OF_RANGE' | 'UNIMPLEMENTED' | 'INTERNAL' | 'UNAVAILABLE' | 'DATA_LOSS' | 'UNAUTHENTICATED';
  data?: unknown;
  error?: string;
  latency: number;
  service?: string;
  method?: string;
  metadata?: Record<string, string>;
}

export interface GRPCConfig {
  endpoint?: string;
  services?: GRPCService[];
  reflectionEnabled?: boolean;
  enableTLS?: boolean;
  enableCompression?: boolean;
  maxMessageSize?: number; // MB
  keepAliveTime?: number; // seconds
  keepAliveTimeout?: number; // seconds
  maxConnectionIdle?: number; // seconds
  maxConnectionAge?: number; // seconds
  maxConnectionAgeGrace?: number; // seconds
  authentication?: {
    type: 'none' | 'tls' | 'mtls' | 'jwt' | 'apiKey';
    token?: string;
    apiKey?: string;
  };
  rateLimit?: {
    enabled: boolean;
    requestsPerSecond?: number;
    burst?: number;
  };
  loadBalancing?: {
    policy: 'round_robin' | 'pick_first' | 'least_request';
    enabled: boolean;
  };
}

/**
 * Method metrics
 */
interface MethodMetrics {
  requestCount: number;
  errorCount: number;
  totalLatency: number;
  averageLatency: number;
  lastRequestTime: number;
  statusCounts: Map<string, number>;
  streamingConnections?: number;
}

/**
 * Rate limit state
 */
interface RateLimitState {
  count: number;
  resetAt: number;
  burst: number;
}

/**
 * Connection pool state
 */
interface ConnectionState {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  lastActivity: number;
}

/**
 * gRPC Routing Engine
 * Implements gRPC service routing, method invocation, streaming, and metrics
 */
export class GRPCRoutingEngine {
  private services: Map<string, GRPCService> = new Map();
  private config: GRPCConfig = {};
  
  // Metrics per method
  private methodMetrics: Map<string, MethodMetrics> = new Map();
  
  // Rate limiting state
  private rateLimitState: Map<string, RateLimitState> = new Map(); // method -> state
  private globalRateLimitState: RateLimitState | null = null;
  
  // Connection pool state
  private connectionState: ConnectionState = {
    activeConnections: 0,
    idleConnections: 0,
    totalConnections: 0,
    lastActivity: 0,
  };
  
  // Request history for metrics
  private requestHistory: Array<{
    service: string;
    method: string;
    timestamp: number;
    latency: number;
    status: string;
  }> = [];
  private maxHistorySize: number = 1000;
  
  /**
   * Initialize gRPC with configuration
   */
  public initialize(config: GRPCConfig) {
    this.config = config;
    this.services.clear();
    this.methodMetrics.clear();
    this.rateLimitState.clear();
    this.requestHistory = [];
    this.globalRateLimitState = null;
    this.connectionState = {
      activeConnections: 0,
      idleConnections: 0,
      totalConnections: 0,
      lastActivity: 0,
    };
    
    // Initialize services
    if (config.services) {
      for (const service of config.services) {
        this.services.set(service.name, { ...service, enabled: service.enabled !== false });
        
        // Initialize metrics for each method
        for (const method of service.methods) {
          const methodKey = `${service.name}.${method.name}`;
          this.initializeMethodMetrics(methodKey);
          
          // Initialize rate limit state for method
          if (method.rateLimit) {
            this.rateLimitState.set(methodKey, {
              count: 0,
              resetAt: Date.now() + 1000,
              burst: method.rateLimit,
            });
          }
        }
      }
    }
    
    // Initialize global rate limit
    if (config.rateLimit?.enabled) {
      this.globalRateLimitState = {
        count: 0,
        resetAt: Date.now() + 1000,
        burst: config.rateLimit.burst || config.rateLimit.requestsPerSecond || 1000,
      };
    }
  }
  
  /**
   * Initialize metrics for a method
   */
  private initializeMethodMetrics(methodKey: string) {
    this.methodMetrics.set(methodKey, {
      requestCount: 0,
      errorCount: 0,
      totalLatency: 0,
      averageLatency: 0,
      lastRequestTime: 0,
      statusCounts: new Map(),
      streamingConnections: 0,
    });
  }
  
  /**
   * Route a request through gRPC service
   */
  public routeRequest(request: GRPCRequest): GRPCResponse {
    const startTime = Date.now();
    
    // 1. Match service and method
    const service = this.services.get(request.service);
    if (!service) {
      return {
        status: 'NOT_FOUND',
        error: `Service '${request.service}' not found`,
        latency: Date.now() - startTime,
      };
    }
    
    // 2. Check if service is enabled
    if (service.enabled === false) {
      return {
        status: 'UNAVAILABLE',
        error: `Service '${request.service}' is disabled`,
        latency: Date.now() - startTime,
        service: request.service,
      };
    }
    
    // 3. Find method
    const method = service.methods.find(m => m.name === request.method);
    if (!method) {
      return {
        status: 'NOT_FOUND',
        error: `Method '${request.method}' not found in service '${request.service}'`,
        latency: Date.now() - startTime,
        service: request.service,
      };
    }
    
    const methodKey = `${request.service}.${request.method}`;
    
    // 4. Check if method is enabled
    if (method.enabled === false) {
      return {
        status: 'UNAVAILABLE',
        error: `Method '${request.method}' is disabled`,
        latency: Date.now() - startTime,
        service: request.service,
        method: request.method,
      };
    }
    
    // 5. Check global rate limit
    if (this.config.rateLimit?.enabled && this.globalRateLimitState) {
      const rateLimitResult = this.checkGlobalRateLimit();
      if (!rateLimitResult.allowed) {
        this.updateMethodMetrics(methodKey, Date.now() - startTime, 'RESOURCE_EXHAUSTED');
        return {
          status: 'RESOURCE_EXHAUSTED',
          error: 'Rate limit exceeded',
          latency: Date.now() - startTime,
          service: request.service,
          method: request.method,
          metadata: {
            'grpc-status': '8', // RESOURCE_EXHAUSTED
            'grpc-message': 'Rate limit exceeded',
          },
        };
      }
    }
    
    // 6. Check method-specific rate limit
    if (method.rateLimit) {
      const rateLimitResult = this.checkMethodRateLimit(methodKey, method.rateLimit);
      if (!rateLimitResult.allowed) {
        this.updateMethodMetrics(methodKey, Date.now() - startTime, 'RESOURCE_EXHAUSTED');
        return {
          status: 'RESOURCE_EXHAUSTED',
          error: 'Method rate limit exceeded',
          latency: Date.now() - startTime,
          service: request.service,
          method: request.method,
          metadata: {
            'grpc-status': '8',
            'grpc-message': 'Method rate limit exceeded',
          },
        };
      }
    }
    
    // 7. Authenticate request
    const authResult = this.authenticate(request);
    if (!authResult.success) {
      this.updateMethodMetrics(methodKey, Date.now() - startTime, authResult.status || 'UNAUTHENTICATED');
      return {
        status: (authResult.status as any) || 'UNAUTHENTICATED',
        error: authResult.error || 'Authentication failed',
        latency: Date.now() - startTime,
        service: request.service,
        method: request.method,
      };
    }
    
    // 8. Update connection state
    this.updateConnectionState(true);
    
    // 9. Simulate processing latency (gRPC is typically faster than REST)
    const processingLatency = this.simulateProcessingLatency(method, request);
    const totalLatency = Date.now() - startTime + processingLatency;
    
    // 10. Check timeout
    const timeout = request.timeout || method.timeout || this.config.maxConnectionIdle || 30000;
    if (totalLatency > timeout) {
      this.updateMethodMetrics(methodKey, totalLatency, 'DEADLINE_EXCEEDED');
      this.updateConnectionState(false);
      return {
        status: 'DEADLINE_EXCEEDED',
        error: 'Request timeout exceeded',
        latency: totalLatency,
        service: request.service,
        method: request.method,
        metadata: {
          'grpc-status': '4',
          'grpc-message': 'Deadline exceeded',
        },
      };
    }
    
    // 11. Handle streaming methods
    if (method.streaming && method.streaming !== 'unary') {
      // For streaming, we simulate a connection
      const metrics = this.methodMetrics.get(methodKey);
      if (metrics) {
        metrics.streamingConnections = (metrics.streamingConnections || 0) + 1;
      }
    }
    
    // 12. Update metrics
    this.updateMethodMetrics(methodKey, totalLatency, 'OK');
    
    // 13. Update connection state
    this.updateConnectionState(false);
    
    // 14. Return success response
    return {
      status: 'OK',
      data: this.generateResponse(method, request),
      latency: totalLatency,
      service: request.service,
      method: request.method,
      metadata: {
        'grpc-status': '0',
        'content-type': 'application/grpc',
      },
    };
  }
  
  /**
   * Check global rate limit
   */
  private checkGlobalRateLimit(): { allowed: boolean; resetAt?: number } {
    if (!this.globalRateLimitState) {
      return { allowed: true };
    }
    
    const now = Date.now();
    
    // Reset counter if time window expired
    if (now >= this.globalRateLimitState.resetAt) {
      this.globalRateLimitState.count = 0;
      this.globalRateLimitState.resetAt = now + 1000;
    }
    
    const limit = this.config.rateLimit?.requestsPerSecond || 1000;
    
    if (this.globalRateLimitState.count >= limit) {
      return {
        allowed: false,
        resetAt: this.globalRateLimitState.resetAt,
      };
    }
    
    this.globalRateLimitState.count++;
    return { allowed: true };
  }
  
  /**
   * Check method-specific rate limit
   */
  private checkMethodRateLimit(methodKey: string, limit: number): { allowed: boolean; resetAt?: number } {
    let state = this.rateLimitState.get(methodKey);
    
    if (!state) {
      state = {
        count: 0,
        resetAt: Date.now() + 1000,
        burst: limit,
      };
      this.rateLimitState.set(methodKey, state);
    }
    
    const now = Date.now();
    
    // Reset counter if time window expired
    if (now >= state.resetAt) {
      state.count = 0;
      state.resetAt = now + 1000;
    }
    
    if (state.count >= limit) {
      return {
        allowed: false,
        resetAt: state.resetAt,
      };
    }
    
    state.count++;
    return { allowed: true };
  }
  
  /**
   * Authenticate request
   */
  private authenticate(request: GRPCRequest): { success: boolean; status?: string; error?: string } {
    const auth = this.config.authentication;
    
    if (!auth || auth.type === 'none') {
      return { success: true };
    }
    
    switch (auth.type) {
      case 'jwt': {
        const token = request.metadata?.['authorization'] || request.metadata?.['Authorization'];
        if (!token || !token.startsWith('Bearer ')) {
          return { success: false, status: 'UNAUTHENTICATED', error: 'Missing or invalid JWT token' };
        }
        
        const jwtToken = token.replace('Bearer ', '');
        if (auth.token && jwtToken !== auth.token) {
          return { success: false, status: 'UNAUTHENTICATED', error: 'Invalid JWT token' };
        }
        
        return { success: true };
      }
      
      case 'apiKey': {
        const apiKey = request.metadata?.['x-api-key'] || request.metadata?.['X-API-Key'];
        
        if (!apiKey) {
          return { success: false, status: 'UNAUTHENTICATED', error: 'Missing API key' };
        }
        
        if (auth.apiKey && apiKey !== auth.apiKey) {
          return { success: false, status: 'UNAUTHENTICATED', error: 'Invalid API key' };
        }
        
        return { success: true };
      }
      
      case 'tls':
      case 'mtls': {
        // TLS/mTLS authentication is handled at connection level
        // For simulation, we assume connection is authenticated if TLS is enabled
        if (!this.config.enableTLS) {
          return { success: false, status: 'UNAUTHENTICATED', error: 'TLS required but not enabled' };
        }
        
        return { success: true };
      }
      
      default:
        return { success: true };
    }
  }
  
  /**
   * Simulate processing latency
   */
  private simulateProcessingLatency(method: GRPCService['methods'][0], request: GRPCRequest): number {
    // gRPC is typically faster than REST (5-20ms base)
    const baseLatency = 5 + Math.random() * 15;
    
    // Streaming methods have different latency characteristics
    let streamingOverhead = 0;
    if (method.streaming) {
      switch (method.streaming) {
        case 'unary':
          streamingOverhead = 0;
          break;
        case 'client-streaming':
        case 'server-streaming':
          streamingOverhead = 10 + Math.random() * 20; // Additional overhead for streaming
          break;
        case 'bidirectional':
          streamingOverhead = 20 + Math.random() * 30; // Highest overhead
          break;
      }
    }
    
    // Compression overhead if enabled
    const compressionOverhead = this.config.enableCompression ? 2 + Math.random() * 3 : 0;
    
    // Message size overhead
    const messageSize = this.estimateMessageSize(request.payload);
    const maxMessageSize = (this.config.maxMessageSize || 4) * 1024 * 1024; // MB to bytes
    const sizeOverhead = messageSize > maxMessageSize ? 50 : (messageSize / maxMessageSize) * 10;
    
    // Timeout penalty if configured
    const timeoutPenalty = method.timeout ? Math.random() * 0.05 * method.timeout : 0;
    
    return baseLatency + streamingOverhead + compressionOverhead + sizeOverhead + timeoutPenalty;
  }
  
  /**
   * Estimate message size
   */
  private estimateMessageSize(payload: unknown): number {
    if (!payload) return 0;
    try {
      return JSON.stringify(payload).length;
    } catch {
      return 0;
    }
  }
  
  /**
   * Generate response data
   */
  private generateResponse(method: GRPCService['methods'][0], request: GRPCRequest): unknown {
    // Generate default response based on output type
    if (request.payload) {
      // Echo back the request with some modifications
      return {
        ...(request.payload as object),
        processedAt: new Date().toISOString(),
        method: method.name,
      };
    }
    
    // Default response
    return {
      success: true,
      message: `Response from ${method.name}`,
      data: {},
    };
  }
  
  /**
   * Update connection state
   */
  private updateConnectionState(isActive: boolean) {
    if (isActive) {
      this.connectionState.activeConnections++;
      this.connectionState.totalConnections = Math.max(
        this.connectionState.totalConnections,
        this.connectionState.activeConnections + this.connectionState.idleConnections
      );
    } else {
      if (this.connectionState.activeConnections > 0) {
        this.connectionState.activeConnections--;
        this.connectionState.idleConnections++;
      }
    }
    this.connectionState.lastActivity = Date.now();
    
    // Clean up idle connections based on maxConnectionIdle
    const maxIdle = (this.config.maxConnectionIdle || 300) * 1000; // seconds to ms
    if (this.connectionState.idleConnections > 0 && Date.now() - this.connectionState.lastActivity > maxIdle) {
      this.connectionState.idleConnections = Math.max(0, this.connectionState.idleConnections - 1);
    }
  }
  
  /**
   * Update method metrics
   */
  private updateMethodMetrics(methodKey: string, latency: number, status: string) {
    let metrics = this.methodMetrics.get(methodKey);
    if (!metrics) {
      this.initializeMethodMetrics(methodKey);
      metrics = this.methodMetrics.get(methodKey)!;
    }
    
    metrics.requestCount++;
    if (status !== 'OK') {
      metrics.errorCount++;
    }
    
    metrics.totalLatency += latency;
    metrics.averageLatency = metrics.totalLatency / metrics.requestCount;
    metrics.lastRequestTime = Date.now();
    
    const statusCount = metrics.statusCounts.get(status) || 0;
    metrics.statusCounts.set(status, statusCount + 1);
    
    // Add to history
    const [service, method] = methodKey.split('.');
    this.requestHistory.push({
      service: service || '',
      method: method || '',
      timestamp: Date.now(),
      latency,
      status,
    });
    
    // Trim history if too large
    if (this.requestHistory.length > this.maxHistorySize) {
      this.requestHistory.shift();
    }
  }
  
  /**
   * Get method statistics
   */
  public getMethodStats(methodKey: string): {
    requestCount: number;
    errorCount: number;
    averageLatency: number;
    lastRequestTime: number;
    statusCounts: Record<string, number>;
    streamingConnections?: number;
  } | null {
    const metrics = this.methodMetrics.get(methodKey);
    if (!metrics) {
      return null;
    }
    
    const statusCounts: Record<string, number> = {};
    for (const [status, count] of metrics.statusCounts.entries()) {
      statusCounts[status] = count;
    }
    
    return {
      requestCount: metrics.requestCount,
      errorCount: metrics.errorCount,
      averageLatency: metrics.averageLatency,
      lastRequestTime: metrics.lastRequestTime,
      statusCounts,
      streamingConnections: metrics.streamingConnections,
    };
  }
  
  /**
   * Get all method statistics
   */
  public getAllMethodStats(): Record<string, ReturnType<typeof this.getMethodStats>> {
    const stats: Record<string, ReturnType<typeof this.getMethodStats>> = {};
    
    for (const methodKey of this.methodMetrics.keys()) {
      stats[methodKey] = this.getMethodStats(methodKey);
    }
    
    return stats;
  }
  
  /**
   * Get overall statistics
   */
  public getStats(): {
    totalServices: number;
    enabledServices: number;
    totalMethods: number;
    enabledMethods: number;
    totalRequests: number;
    totalErrors: number;
    averageLatency: number;
    activeConnections: number;
    idleConnections: number;
    totalConnections: number;
  } {
    let totalRequests = 0;
    let totalErrors = 0;
    let totalLatency = 0;
    let enabledServiceCount = 0;
    let totalMethodCount = 0;
    let enabledMethodCount = 0;
    
    for (const service of this.services.values()) {
      if (service.enabled !== false) {
        enabledServiceCount++;
      }
      
      totalMethodCount += service.methods.length;
      for (const method of service.methods) {
        if (method.enabled !== false) {
          enabledMethodCount++;
        }
        
        const methodKey = `${service.name}.${method.name}`;
        const metrics = this.methodMetrics.get(methodKey);
        if (metrics) {
          totalRequests += metrics.requestCount;
          totalErrors += metrics.errorCount;
          totalLatency += metrics.totalLatency;
        }
      }
    }
    
    return {
      totalServices: this.services.size,
      enabledServices: enabledServiceCount,
      totalMethods: totalMethodCount,
      enabledMethods: enabledMethodCount,
      totalRequests,
      totalErrors,
      averageLatency: totalRequests > 0 ? totalLatency / totalRequests : 0,
      activeConnections: this.connectionState.activeConnections,
      idleConnections: this.connectionState.idleConnections,
      totalConnections: this.connectionState.totalConnections,
    };
  }
  
  /**
   * Get connection state
   */
  public getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }
}


/**
 * REST API Routing Engine
 * Handles REST API request routing, authentication, validation, and service routing
 */

export interface RestApiEndpoint {
  id?: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description?: string;
  summary?: string;
  tags?: string[];
  parameters?: Array<{
    name: string;
    in: 'query' | 'path' | 'header';
    type: string;
    required: boolean;
    defaultValue?: string;
  }>;
  requestBody?: string;
  responseExample?: string;
  targetService?: string; // ID of target service node (for routing)
  enabled?: boolean;
  timeout?: number;
  rateLimit?: number; // requests per second
}

export interface RestApiRequest {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  clientIP?: string;
}

export interface RestApiResponse {
  status: number;
  data?: unknown;
  error?: string;
  latency: number;
  endpoint?: string;
  headers?: Record<string, string>;
}

export interface RestApiConfig {
  baseUrl?: string;
  version?: string;
  title?: string;
  description?: string;
  endpoints?: RestApiEndpoint[];
  authentication?: {
    type: 'none' | 'bearer' | 'apiKey' | 'oauth2' | 'basic';
    token?: string;
    apiKey?: string;
    apiKeyHeader?: string;
    username?: string;
    password?: string;
    oauth2Config?: {
      tokenEndpoint?: string;
      clientId?: string;
      clientSecret?: string;
      scopes?: string[];
    };
  };
  rateLimit?: {
    enabled: boolean;
    requestsPerSecond?: number;
    burst?: number;
  };
  cors?: {
    enabled: boolean;
    allowedOrigins?: string[];
    allowedMethods?: string[];
    allowedHeaders?: string[];
  };
}

/**
 * Endpoint metrics
 */
interface EndpointMetrics {
  requestCount: number;
  errorCount: number;
  totalLatency: number;
  averageLatency: number;
  lastRequestTime: number;
  statusCodeCounts: Map<number, number>;
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
 * REST API Routing Engine
 * Implements REST API request routing, authentication, validation, and service routing
 */
export class RestApiRoutingEngine {
  private endpoints: Map<string, RestApiEndpoint> = new Map();
  private config: RestApiConfig = {};
  
  // Metrics per endpoint
  private endpointMetrics: Map<string, EndpointMetrics> = new Map();
  
  // Rate limiting state
  private rateLimitState: Map<string, RateLimitState> = new Map(); // endpoint -> state
  private globalRateLimitState: RateLimitState | null = null;
  
  // Request history for metrics
  private requestHistory: Array<{
    endpoint: string;
    timestamp: number;
    latency: number;
    status: number;
  }> = [];
  private maxHistorySize: number = 1000;
  
  /**
   * Initialize REST API with configuration
   */
  public initialize(config: RestApiConfig) {
    this.config = config;
    this.endpoints.clear();
    this.endpointMetrics.clear();
    this.rateLimitState.clear();
    this.requestHistory = [];
    this.globalRateLimitState = null;
    
    // Initialize endpoints
    if (config.endpoints) {
      for (const endpoint of config.endpoints) {
        const endpointId = endpoint.id || `${endpoint.method}:${endpoint.path}`;
        this.endpoints.set(endpointId, { ...endpoint, id: endpointId, enabled: endpoint.enabled !== false });
        this.initializeEndpointMetrics(endpointId);
        
        // Initialize rate limit state for endpoint
        if (endpoint.rateLimit) {
          this.rateLimitState.set(endpointId, {
            count: 0,
            resetAt: Date.now() + 1000, // Reset every second
            burst: endpoint.rateLimit,
          });
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
   * Initialize metrics for an endpoint
   */
  private initializeEndpointMetrics(endpointId: string) {
    this.endpointMetrics.set(endpointId, {
      requestCount: 0,
      errorCount: 0,
      totalLatency: 0,
      averageLatency: 0,
      lastRequestTime: 0,
      statusCodeCounts: new Map(),
    });
  }
  
  /**
   * Route a request through REST API
   */
  public routeRequest(request: RestApiRequest): RestApiResponse {
    const startTime = Date.now();
    
    // 1. Match endpoint
    const endpoint = this.matchEndpoint(request);
    if (!endpoint) {
      return {
        status: 404,
        error: 'Endpoint not found',
        latency: Date.now() - startTime,
      };
    }
    
    // 2. Check if endpoint is enabled
    if (endpoint.enabled === false) {
      return {
        status: 503,
        error: 'Endpoint is disabled',
        latency: Date.now() - startTime,
        endpoint: endpoint.id,
      };
    }
    
    // 3. Check global rate limit
    if (this.config.rateLimit?.enabled && this.globalRateLimitState) {
      const rateLimitResult = this.checkGlobalRateLimit();
      if (!rateLimitResult.allowed) {
        this.updateEndpointMetrics(endpoint.id!, Date.now() - startTime, 429);
        return {
          status: 429,
          error: 'Rate limit exceeded',
          latency: Date.now() - startTime,
          endpoint: endpoint.id,
          headers: {
            'X-RateLimit-Limit': String(this.config.rateLimit.requestsPerSecond || 1000),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimitResult.resetAt || Date.now() + 1000),
          },
        };
      }
    }
    
    // 4. Check endpoint-specific rate limit
    if (endpoint.rateLimit && endpoint.id) {
      const rateLimitResult = this.checkEndpointRateLimit(endpoint.id, endpoint.rateLimit);
      if (!rateLimitResult.allowed) {
        this.updateEndpointMetrics(endpoint.id, Date.now() - startTime, 429);
        return {
          status: 429,
          error: 'Endpoint rate limit exceeded',
          latency: Date.now() - startTime,
          endpoint: endpoint.id,
          headers: {
            'X-RateLimit-Limit': String(endpoint.rateLimit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimitResult.resetAt || Date.now() + 1000),
          },
        };
      }
    }
    
    // 5. Authenticate request
    const authResult = this.authenticate(request);
    if (!authResult.success) {
      this.updateEndpointMetrics(endpoint.id!, Date.now() - startTime, authResult.status || 401);
      return {
        status: authResult.status || 401,
        error: authResult.error || 'Authentication failed',
        latency: Date.now() - startTime,
        endpoint: endpoint.id,
      };
    }
    
    // 6. Validate parameters
    const validationResult = this.validateParameters(request, endpoint);
    if (!validationResult.valid) {
      this.updateEndpointMetrics(endpoint.id!, Date.now() - startTime, 400);
      return {
        status: 400,
        error: validationResult.error || 'Invalid parameters',
        latency: Date.now() - startTime,
        endpoint: endpoint.id,
      };
    }
    
    // 7. Simulate processing latency
    const processingLatency = this.simulateProcessingLatency(endpoint);
    const totalLatency = Date.now() - startTime + processingLatency;
    
    // 8. Update metrics
    this.updateEndpointMetrics(endpoint.id!, totalLatency, 200);
    
    // 9. Return success response
    return {
      status: 200,
      data: this.generateResponse(endpoint, request),
      latency: totalLatency,
      endpoint: endpoint.id,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.cors?.enabled ? this.getCorsHeaders() : {}),
      },
    };
  }
  
  /**
   * Match request to an endpoint
   */
  private matchEndpoint(request: RestApiRequest): RestApiEndpoint | null {
    // Try exact match first
    for (const endpoint of this.endpoints.values()) {
      if (endpoint.method === request.method && endpoint.path === request.path) {
        return endpoint;
      }
    }
    
    // Try path pattern matching (simple wildcard support)
    for (const endpoint of this.endpoints.values()) {
      if (endpoint.method === request.method && this.matchPathPattern(endpoint.path, request.path)) {
        return endpoint;
      }
    }
    
    return null;
  }
  
  /**
   * Match path pattern (supports :param and * wildcards)
   */
  private matchPathPattern(pattern: string, path: string): boolean {
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/:[^/]+/g, '[^/]+') // :id -> [^/]+
      .replace(/\*/g, '.*'); // * -> .*
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
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
   * Check endpoint-specific rate limit
   */
  private checkEndpointRateLimit(endpointId: string, limit: number): { allowed: boolean; resetAt?: number } {
    let state = this.rateLimitState.get(endpointId);
    
    if (!state) {
      state = {
        count: 0,
        resetAt: Date.now() + 1000,
        burst: limit,
      };
      this.rateLimitState.set(endpointId, state);
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
  private authenticate(request: RestApiRequest): { success: boolean; status?: number; error?: string } {
    const auth = this.config.authentication;
    
    if (!auth || auth.type === 'none') {
      return { success: true };
    }
    
    switch (auth.type) {
      case 'bearer': {
        const authHeader = request.headers?.['Authorization'] || request.headers?.['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return { success: false, status: 401, error: 'Missing or invalid Bearer token' };
        }
        
        const token = authHeader.replace('Bearer ', '');
        if (auth.token && token !== auth.token) {
          return { success: false, status: 401, error: 'Invalid Bearer token' };
        }
        
        return { success: true };
      }
      
      case 'apiKey': {
        const headerName = auth.apiKeyHeader || 'X-API-Key';
        const apiKey = request.headers?.[headerName] || request.headers?.[headerName.toLowerCase()];
        
        if (!apiKey) {
          return { success: false, status: 401, error: 'Missing API key' };
        }
        
        if (auth.apiKey && apiKey !== auth.apiKey) {
          return { success: false, status: 401, error: 'Invalid API key' };
        }
        
        return { success: true };
      }
      
      case 'oauth2': {
        // Simplified OAuth2 validation
        const authHeader = request.headers?.['Authorization'] || request.headers?.['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return { success: false, status: 401, error: 'Missing OAuth2 token' };
        }
        
        // In real implementation, would validate JWT token and check scopes
        // For simulation, we just check if token is present
        return { success: true };
      }
      
      case 'basic': {
        const authHeader = request.headers?.['Authorization'] || request.headers?.['authorization'];
        if (!authHeader || !authHeader.startsWith('Basic ')) {
          return { success: false, status: 401, error: 'Missing Basic Auth credentials' };
        }
        
        const credentials = authHeader.replace('Basic ', '');
        try {
          const decoded = atob(credentials);
          const [username, password] = decoded.split(':');
          
          if (auth.username && username !== auth.username) {
            return { success: false, status: 401, error: 'Invalid username' };
          }
          
          if (auth.password && password !== auth.password) {
            return { success: false, status: 401, error: 'Invalid password' };
          }
          
          return { success: true };
        } catch {
          return { success: false, status: 401, error: 'Invalid Basic Auth format' };
        }
      }
      
      default:
        return { success: true };
    }
  }
  
  /**
   * Validate request parameters
   */
  private validateParameters(request: RestApiRequest, endpoint: RestApiEndpoint): { valid: boolean; error?: string } {
    if (!endpoint.parameters || endpoint.parameters.length === 0) {
      return { valid: true };
    }
    
    for (const param of endpoint.parameters) {
      if (param.required) {
        let value: string | undefined;
        
        switch (param.in) {
          case 'query':
            value = request.query?.[param.name];
            break;
          case 'path':
            // Path parameters are extracted from path pattern
            // For simplicity, we assume they're present if path matched
            value = 'present';
            break;
          case 'header':
            value = request.headers?.[param.name] || request.headers?.[param.name.toLowerCase()];
            break;
        }
        
        if (!value && !param.defaultValue) {
          return { valid: false, error: `Missing required parameter: ${param.name} (in ${param.in})` };
        }
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Simulate processing latency
   */
  private simulateProcessingLatency(endpoint: RestApiEndpoint): number {
    // Base latency: 10-50ms
    const baseLatency = 10 + Math.random() * 40;
    
    // Method-specific latency
    const methodLatency: Record<string, number> = {
      'GET': 0,
      'POST': 20,
      'PUT': 15,
      'PATCH': 10,
      'DELETE': 5,
    };
    
    const methodOverhead = methodLatency[endpoint.method] || 0;
    
    // Timeout penalty if configured
    const timeoutPenalty = endpoint.timeout ? Math.random() * 0.1 * endpoint.timeout : 0;
    
    return baseLatency + methodOverhead + timeoutPenalty;
  }
  
  /**
   * Generate response data
   */
  private generateResponse(endpoint: RestApiEndpoint, request: RestApiRequest): unknown {
    // If response example is provided, use it
    if (endpoint.responseExample) {
      try {
        return JSON.parse(endpoint.responseExample);
      } catch {
        return { message: endpoint.responseExample };
      }
    }
    
    // Generate default response based on method
    switch (endpoint.method) {
      case 'GET':
        return {
          data: [],
          count: 0,
          message: 'Success',
        };
      case 'POST':
        return {
          id: Math.random().toString(36).substring(7),
          ...(request.body as object || {}),
          createdAt: new Date().toISOString(),
        };
      case 'PUT':
      case 'PATCH':
        return {
          ...(request.body as object || {}),
          updatedAt: new Date().toISOString(),
        };
      case 'DELETE':
        return {
          message: 'Deleted successfully',
        };
      default:
        return { message: 'Success' };
    }
  }
  
  /**
   * Get CORS headers
   */
  private getCorsHeaders(): Record<string, string> {
    const cors = this.config.cors;
    if (!cors || !cors.enabled) {
      return {};
    }
    
    return {
      'Access-Control-Allow-Origin': cors.allowedOrigins?.join(',') || '*',
      'Access-Control-Allow-Methods': cors.allowedMethods?.join(',') || 'GET,POST,PUT,DELETE,PATCH',
      'Access-Control-Allow-Headers': cors.allowedHeaders?.join(',') || 'Content-Type,Authorization',
    };
  }
  
  /**
   * Update endpoint metrics
   */
  private updateEndpointMetrics(endpointId: string, latency: number, status: number) {
    let metrics = this.endpointMetrics.get(endpointId);
    if (!metrics) {
      this.initializeEndpointMetrics(endpointId);
      metrics = this.endpointMetrics.get(endpointId)!;
    }
    
    metrics.requestCount++;
    if (status >= 400) {
      metrics.errorCount++;
    }
    
    metrics.totalLatency += latency;
    metrics.averageLatency = metrics.totalLatency / metrics.requestCount;
    metrics.lastRequestTime = Date.now();
    
    const statusCount = metrics.statusCodeCounts.get(status) || 0;
    metrics.statusCodeCounts.set(status, statusCount + 1);
    
    // Add to history
    this.requestHistory.push({
      endpoint: endpointId,
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
   * Get endpoint statistics
   */
  public getEndpointStats(endpointId: string): {
    requestCount: number;
    errorCount: number;
    averageLatency: number;
    lastRequestTime: number;
    statusCodeCounts: Record<number, number>;
  } | null {
    const metrics = this.endpointMetrics.get(endpointId);
    if (!metrics) {
      return null;
    }
    
    const statusCodeCounts: Record<number, number> = {};
    for (const [status, count] of metrics.statusCodeCounts.entries()) {
      statusCodeCounts[status] = count;
    }
    
    return {
      requestCount: metrics.requestCount,
      errorCount: metrics.errorCount,
      averageLatency: metrics.averageLatency,
      lastRequestTime: metrics.lastRequestTime,
      statusCodeCounts,
    };
  }
  
  /**
   * Get all endpoint statistics
   */
  public getAllEndpointStats(): Record<string, ReturnType<typeof this.getEndpointStats>> {
    const stats: Record<string, ReturnType<typeof this.getEndpointStats>> = {};
    
    for (const endpointId of this.endpoints.keys()) {
      stats[endpointId] = this.getEndpointStats(endpointId);
    }
    
    return stats;
  }
  
  /**
   * Get overall statistics
   */
  public getStats(): {
    totalEndpoints: number;
    enabledEndpoints: number;
    totalRequests: number;
    totalErrors: number;
    averageLatency: number;
  } {
    let totalRequests = 0;
    let totalErrors = 0;
    let totalLatency = 0;
    let enabledCount = 0;
    
    for (const endpoint of this.endpoints.values()) {
      if (endpoint.enabled !== false) {
        enabledCount++;
      }
      
      const metrics = this.endpointMetrics.get(endpoint.id!);
      if (metrics) {
        totalRequests += metrics.requestCount;
        totalErrors += metrics.errorCount;
        totalLatency += metrics.totalLatency;
      }
    }
    
    return {
      totalEndpoints: this.endpoints.size,
      enabledEndpoints: enabledCount,
      totalRequests,
      totalErrors,
      averageLatency: totalRequests > 0 ? totalLatency / totalRequests : 0,
    };
  }
}


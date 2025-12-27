/**
 * Envoy Proxy Routing Engine
 * Handles request routing through listeners, routes, and clusters with load balancing
 * Simulates Envoy Proxy behavior including filters, health checks, circuit breakers, and rate limiting
 */

export interface EnvoyClusterEndpoint {
  address: string;
  port: number;
  weight?: number;
  healthStatus?: 'healthy' | 'unhealthy' | 'degraded' | 'timeout' | 'unknown';
  requests?: number;
  errors?: number;
  responseTime?: number; // ms
  lastCheck?: number; // timestamp
}

export interface EnvoyCluster {
  name: string;
  type: 'STATIC_DNS' | 'STRICT_DNS' | 'LOGICAL_DNS' | 'EDS' | 'ORIGINAL_DST';
  endpoints: EnvoyClusterEndpoint[];
  connectTimeout?: number; // ms
  healthCheck?: {
    enabled: boolean;
    interval?: number; // ms
    timeout?: number; // ms
    path?: string; // for HTTP health checks
    healthyThreshold?: number;
    unhealthyThreshold?: number;
  };
  circuitBreaker?: {
    enabled: boolean;
    maxConnections?: number;
    maxRequests?: number;
    maxRetries?: number;
    consecutiveErrors?: number; // threshold for opening circuit
  };
  loadBalancingPolicy?: 'ROUND_ROBIN' | 'LEAST_REQUEST' | 'RING_HASH' | 'MAGLEV' | 'RANDOM';
  outlierDetection?: {
    enabled: boolean;
    consecutiveErrors?: number;
    interval?: number; // ms
    baseEjectionTime?: number; // ms
    maxEjectionPercent?: number;
  };
  // Statistics
  requests?: number;
  errors?: number;
  activeConnections?: number;
}

export interface EnvoyFilter {
  name: string;
  type: 'http_connection_manager' | 'tls_inspector' | 'router' | 'cors' | 'ratelimit' | 'fault' | 'ext_authz';
  config?: Record<string, any>;
}

export interface EnvoyListener {
  name: string;
  address: string;
  port: number;
  protocol?: 'HTTP' | 'HTTPS' | 'TCP' | 'UDP';
  filters: EnvoyFilter[];
  // Statistics
  activeConnections?: number;
  requests?: number;
  responses?: number;
}

export interface EnvoyRouteMatch {
  prefix?: string;
  path?: string;
  regex?: string;
  headers?: Array<{
    name: string;
    exact?: string;
    prefix?: string;
    suffix?: string;
    regex?: string;
  }>;
  queryParameters?: Array<{
    name: string;
    exact?: string;
    regex?: string;
  }>;
}

export interface EnvoyRoute {
  name: string;
  match: EnvoyRouteMatch;
  cluster: string;
  priority?: number;
  timeout?: number; // ms
  retryPolicy?: {
    retryOn?: string[]; // e.g., ['5xx', 'reset', 'connect-failure']
    numRetries?: number;
    perTryTimeout?: number; // ms
  };
  // Statistics
  requests?: number;
  responses?: number;
  errors?: number;
}

export interface EnvoyRequest {
  path: string;
  method: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  clientIP?: string;
  protocol?: 'http' | 'https' | 'tcp' | 'udp';
  host?: string;
}

export interface EnvoyResponse {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
  latency?: number;
  error?: string;
  clusterTarget?: string;
  endpointTarget?: string;
}

export interface EnvoyStats {
  clusters: number;
  listeners: number;
  routes: number;
  totalEndpoints: number;
  healthyEndpoints: number;
  unhealthyEndpoints: number;
  totalRequests: number;
  totalResponses: number;
  activeConnections: number;
  totalBytesIn: number;
  totalBytesOut: number;
  errorRate: number;
  rateLimitBlocks?: number;
  timeoutErrors?: number;
  circuitBreakerTrips?: number;
}

export interface EnvoyGlobalConfig {
  maxConnections?: number;
  connectTimeout?: number; // ms
  requestTimeout?: number; // ms
  drainTime?: number; // seconds
  rateLimit?: {
    enabled: boolean;
    rate?: number; // requests per second
    burst?: number;
  };
  tracing?: {
    enabled: boolean;
    provider?: 'jaeger' | 'zipkin' | 'datadog';
  };
}

/**
 * Envoy Proxy Routing Engine
 * Simulates Envoy request routing and load balancing behavior
 */
export class EnvoyRoutingEngine {
  private clusters: Map<string, EnvoyCluster> = new Map();
  private listeners: Map<string, EnvoyListener> = new Map();
  private routes: Map<string, EnvoyRoute> = new Map();
  private globalConfig: EnvoyGlobalConfig = {};
  
  // Load balancing state
  private roundRobinCounters: Map<string, number> = new Map(); // cluster -> counter
  private leastRequestCounts: Map<string, Map<string, number>> = new Map(); // cluster -> endpoint -> request count
  private connectionCounts: Map<string, number> = new Map(); // endpoint -> connection count
  private ringHashMapping: Map<string, string[]> = new Map(); // cluster -> sorted endpoint list
  private maglevTable: Map<string, Map<number, string>> = new Map(); // cluster -> hash table
  
  // Circuit breaker state
  private circuitBreakerState: Map<string, {
    isOpen: boolean;
    consecutiveErrors: number;
    openUntil?: number; // timestamp
  }> = new Map(); // cluster -> state
  
  // Outlier detection state
  private outlierDetectionState: Map<string, Map<string, {
    consecutiveErrors: number;
    ejectedUntil?: number;
  }>> = new Map(); // cluster -> endpoint -> state
  
  // Statistics
  private requestCount: number = 0;
  private responseCount: number = 0;
  private errorCount: number = 0;
  private totalBytesIn: number = 0;
  private totalBytesOut: number = 0;
  private activeConnections: number = 0;
  private rateLimitBlocks: number = 0;
  private timeoutErrors: number = 0;
  private circuitBreakerTrips: number = 0;
  
  // Health check state
  private healthCheckTimers: Map<string, NodeJS.Timeout> = new Map();
  private endpointCheckFailures: Map<string, number> = new Map(); // endpoint -> failure count
  private endpointCheckSuccesses: Map<string, number> = new Map(); // endpoint -> success count
  
  // Rate limiting state
  private rateLimitTracker: Map<string, { count: number; resetAt: number }> = new Map(); // client IP -> rate limit state

  /**
   * Initialize with Envoy configuration
   */
  public initialize(config: {
    clusters?: EnvoyCluster[];
    listeners?: EnvoyListener[];
    routes?: EnvoyRoute[];
    globalConfig?: EnvoyGlobalConfig;
  }) {
    // Clear previous state
    this.clusters.clear();
    this.listeners.clear();
    this.routes.clear();
    this.roundRobinCounters.clear();
    this.leastRequestCounts.clear();
    this.connectionCounts.clear();
    this.ringHashMapping.clear();
    this.maglevTable.clear();
    this.circuitBreakerState.clear();
    this.outlierDetectionState.clear();
    this.endpointCheckFailures.clear();
    this.endpointCheckSuccesses.clear();
    this.rateLimitTracker.clear();
    
    // Store global config
    this.globalConfig = config.globalConfig || {};
    
    // Clear health check timers
    for (const timer of this.healthCheckTimers.values()) {
      clearInterval(timer);
    }
    this.healthCheckTimers.clear();

    // Initialize clusters
    if (config.clusters) {
      for (const cluster of config.clusters) {
        this.clusters.set(cluster.name, { ...cluster });
        this.roundRobinCounters.set(cluster.name, 0);
        this.leastRequestCounts.set(cluster.name, new Map());
        this.circuitBreakerState.set(cluster.name, {
          isOpen: false,
          consecutiveErrors: 0,
        });
        this.outlierDetectionState.set(cluster.name, new Map());
        
        // Initialize health checks for cluster endpoints
        if (cluster.healthCheck?.enabled && cluster.endpoints) {
          for (const endpoint of cluster.endpoints) {
            const endpointKey = `${endpoint.address}:${endpoint.port}`;
            this.leastRequestCounts.get(cluster.name)!.set(endpointKey, 0);
            this.startHealthCheck(cluster.name, endpoint, cluster.healthCheck);
          }
        } else {
          // Initialize request counts for endpoints even without health checks
          for (const endpoint of cluster.endpoints) {
            const endpointKey = `${endpoint.address}:${endpoint.port}`;
            this.leastRequestCounts.get(cluster.name)!.set(endpointKey, 0);
          }
        }
        
        // Build load balancing structures
        if (cluster.loadBalancingPolicy === 'RING_HASH' || cluster.loadBalancingPolicy === 'MAGLEV') {
          this.buildHashTable(cluster.name, cluster);
        }
      }
    }

    // Initialize listeners
    if (config.listeners) {
      for (const listener of config.listeners) {
        this.listeners.set(listener.name, { ...listener });
      }
    }

    // Initialize routes
    if (config.routes) {
      // Sort routes by priority (higher priority first)
      const sortedRoutes = [...config.routes].sort((a, b) => (b.priority || 0) - (a.priority || 0));
      for (const route of sortedRoutes) {
        this.routes.set(route.name, { ...route });
      }
    }

    // Reset statistics
    this.requestCount = 0;
    this.responseCount = 0;
    this.errorCount = 0;
    this.totalBytesIn = 0;
    this.totalBytesOut = 0;
    this.activeConnections = 0;
    this.rateLimitBlocks = 0;
    this.timeoutErrors = 0;
    this.circuitBreakerTrips = 0;
  }

  /**
   * Route a request through Envoy Proxy
   */
  public routeRequest(request: EnvoyRequest, listenerName?: string): {
    listener: EnvoyListener | null;
    route: EnvoyRoute | null;
    cluster: EnvoyCluster | null;
    response: EnvoyResponse;
    clusterTarget?: string;
    endpointTarget?: string;
  } {
    const startTime = Date.now();
    this.requestCount++;
    
    // Check max connections limit
    const maxConnections = this.globalConfig.maxConnections || 1024;
    if (this.activeConnections >= maxConnections) {
      this.errorCount++;
      return {
        listener: null,
        route: null,
        cluster: null,
        response: {
          status: 503,
          error: 'Max connections exceeded',
          latency: Date.now() - startTime,
        },
      };
    }
    
    this.activeConnections++;
    
    // Check global rate limiting
    if (this.globalConfig.rateLimit?.enabled) {
      const rateLimitResult = this.checkRateLimit(request);
      if (!rateLimitResult.allowed) {
        this.activeConnections--;
        this.rateLimitBlocks++;
        this.errorCount++;
        return {
          listener: null,
          route: null,
          cluster: null,
          response: {
            status: 429,
            error: 'Rate limit exceeded',
            latency: Date.now() - startTime,
          },
        };
      }
    }

    // Step 1: Find listener
    let listener: EnvoyListener | null = null;
    
    if (listenerName) {
      listener = this.listeners.get(listenerName) || null;
    } else {
      // Find listener by port/protocol
      for (const [name, lst] of this.listeners.entries()) {
        const protocol = lst.protocol || 'HTTP';
        if (request.protocol === 'https' && (protocol === 'HTTPS' || lst.port === 443)) {
          listener = lst;
          break;
        } else if (request.protocol === 'http' && (protocol === 'HTTP' || lst.port === 80)) {
          listener = lst;
          break;
        }
      }
      
      // If no match, use first listener
      if (!listener && this.listeners.size > 0) {
        listener = Array.from(this.listeners.values())[0];
      }
    }

    if (!listener) {
      this.activeConnections--;
      this.errorCount++;
      return {
        listener: null,
        route: null,
        cluster: null,
        response: {
          status: 503,
          error: 'No listener available',
          latency: Date.now() - startTime,
        },
      };
    }

    // Update listener statistics
    listener.requests = (listener.requests || 0) + 1;
    listener.activeConnections = (listener.activeConnections || 0) + 1;

    // Step 2: Process filters
    for (const filter of listener.filters) {
      const filterResult = this.processFilter(filter, request);
      if (!filterResult.allowed) {
        this.activeConnections--;
        this.errorCount++;
        listener.activeConnections = (listener.activeConnections || 1) - 1;
        return {
          listener,
          route: null,
          cluster: null,
          response: {
            status: filterResult.status || 403,
            error: filterResult.error || 'Filter denied',
            latency: Date.now() - startTime,
          },
        };
      }
      if (filterResult.modifiedRequest) {
        request = filterResult.modifiedRequest;
      }
    }

    // Step 3: Find matching route
    let matchedRoute: EnvoyRoute | null = null;
    
    for (const route of this.routes.values()) {
      if (this.matchRoute(route, request)) {
        matchedRoute = route;
        break;
      }
    }

    if (!matchedRoute) {
      this.activeConnections--;
      this.errorCount++;
      listener.activeConnections = (listener.activeConnections || 1) - 1;
      return {
        listener,
        route: null,
        cluster: null,
        response: {
          status: 404,
          error: 'No route matched',
          latency: Date.now() - startTime,
        },
      };
    }

    // Update route statistics
    matchedRoute.requests = (matchedRoute.requests || 0) + 1;

    // Step 4: Find cluster
    const cluster = this.clusters.get(matchedRoute.cluster);
    if (!cluster) {
      this.activeConnections--;
      this.errorCount++;
      matchedRoute.errors = (matchedRoute.errors || 0) + 1;
      listener.activeConnections = (listener.activeConnections || 1) - 1;
      return {
        listener,
        route: matchedRoute,
        cluster: null,
        response: {
          status: 503,
          error: `Cluster ${matchedRoute.cluster} not found`,
          latency: Date.now() - startTime,
        },
      };
    }

    // Check circuit breaker
    const cbState = this.circuitBreakerState.get(cluster.name);
    if (cbState && cluster.circuitBreaker?.enabled) {
      if (cbState.isOpen) {
        if (cbState.openUntil && Date.now() < cbState.openUntil) {
          // Circuit is open
          this.activeConnections--;
          this.errorCount++;
          matchedRoute.errors = (matchedRoute.errors || 0) + 1;
          cluster.errors = (cluster.errors || 0) + 1;
          listener.activeConnections = (listener.activeConnections || 1) - 1;
          return {
            listener,
            route: matchedRoute,
            cluster,
            response: {
              status: 503,
              error: 'Circuit breaker is open',
              latency: Date.now() - startTime,
              clusterTarget: cluster.name,
            },
          };
        } else {
          // Circuit breaker timeout expired, try half-open
          cbState.isOpen = false;
          cbState.consecutiveErrors = 0;
        }
      }
    }

    // Step 5: Select endpoint using load balancing
    const endpointTarget = this.selectEndpoint(cluster, request);
    
    if (!endpointTarget) {
      this.activeConnections--;
      this.errorCount++;
      matchedRoute.errors = (matchedRoute.errors || 0) + 1;
      cluster.errors = (cluster.errors || 0) + 1;
      listener.activeConnections = (listener.activeConnections || 1) - 1;
      return {
        listener,
        route: matchedRoute,
        cluster,
        response: {
          status: 503,
          error: 'No healthy endpoint available',
          latency: Date.now() - startTime,
          clusterTarget: cluster.name,
        },
      };
    }

    // Update cluster statistics
    cluster.requests = (cluster.requests || 0) + 1;
    cluster.activeConnections = (cluster.activeConnections || 0) + 1;

    // Find endpoint
    const endpoint = cluster.endpoints.find(e => `${e.address}:${e.port}` === endpointTarget);
    if (endpoint) {
      endpoint.requests = (endpoint.requests || 0) + 1;
    }

    // Step 6: Simulate request processing
    const connectTimeout = cluster.connectTimeout || this.globalConfig.connectTimeout || 5000;
    const requestTimeout = matchedRoute.timeout || this.globalConfig.requestTimeout || 15000;
    
    // Simulate connection time
    const connectTime = Math.min(50 + Math.random() * 100, connectTimeout);
    if (connectTime >= connectTimeout * 0.9) {
      // Connection timeout
      this.activeConnections--;
      this.timeoutErrors++;
      this.errorCount++;
      matchedRoute.errors = (matchedRoute.errors || 0) + 1;
      cluster.errors = (cluster.errors || 0) + 1;
      cluster.activeConnections = (cluster.activeConnections || 1) - 1;
      listener.activeConnections = (listener.activeConnections || 1) - 1;
      if (endpoint) {
        endpoint.errors = (endpoint.errors || 0) + 1;
        this.updateOutlierDetection(cluster.name, endpointTarget, true);
      }
      return {
        listener,
        route: matchedRoute,
        cluster,
        response: {
          status: 504,
          error: 'Connection timeout',
          latency: connectTimeout,
          clusterTarget: cluster.name,
          endpointTarget,
        },
      };
    }
    
    // Simulate processing time
    const baseResponseTime = 10 + Math.random() * 90; // 10-100ms base
    const totalResponseTime = connectTime + baseResponseTime;
    
    // Check if response time exceeds timeout
    if (totalResponseTime > requestTimeout) {
      this.activeConnections--;
      this.timeoutErrors++;
      this.errorCount++;
      matchedRoute.errors = (matchedRoute.errors || 0) + 1;
      cluster.errors = (cluster.errors || 0) + 1;
      cluster.activeConnections = (cluster.activeConnections || 1) - 1;
      listener.activeConnections = (listener.activeConnections || 1) - 1;
      if (endpoint) {
        endpoint.errors = (endpoint.errors || 0) + 1;
        this.updateOutlierDetection(cluster.name, endpointTarget, true);
      }
      return {
        listener,
        route: matchedRoute,
        cluster,
        response: {
          status: 504,
          error: 'Request timeout',
          latency: requestTimeout,
          clusterTarget: cluster.name,
          endpointTarget,
        },
      };
    }

    // Simulate success/failure (90% success rate)
    const isSuccess = Math.random() > 0.1;
    const responseStatus = isSuccess ? 200 : (500 + Math.floor(Math.random() * 3)); // 500-502

    if (!isSuccess) {
      this.errorCount++;
      matchedRoute.errors = (matchedRoute.errors || 0) + 1;
      cluster.errors = (cluster.errors || 0) + 1;
      if (endpoint) {
        endpoint.errors = (endpoint.errors || 0) + 1;
        this.updateOutlierDetection(cluster.name, endpointTarget, true);
      }
      this.updateCircuitBreaker(cluster.name, true);
    } else {
      this.updateCircuitBreaker(cluster.name, false);
      this.responseCount++;
      matchedRoute.responses = (matchedRoute.responses || 0) + 1;
    }

    // Update statistics
    const requestSize = 1024;
    const responseSize = 2048;
    this.totalBytesIn += requestSize;
    this.totalBytesOut += responseSize;
    if (endpoint) {
      endpoint.responseTime = totalResponseTime;
    }

    this.activeConnections--;
    listener.activeConnections = (listener.activeConnections || 1) - 1;
    cluster.activeConnections = (cluster.activeConnections || 1) - 1;

    const response: EnvoyResponse = {
      status: responseStatus,
      body: { proxied: true, cluster: cluster.name, endpoint: endpointTarget },
      latency: totalResponseTime,
      clusterTarget: cluster.name,
      endpointTarget,
    };

    return {
      listener,
      route: matchedRoute,
      cluster,
      response,
      clusterTarget: cluster.name,
      endpointTarget,
    };
  }

  /**
   * Match route against request
   */
  private matchRoute(route: EnvoyRoute, request: EnvoyRequest): boolean {
    const match = route.match;

    // Path matching
    if (match.prefix) {
      if (!request.path.startsWith(match.prefix)) {
        return false;
      }
    }
    if (match.path) {
      if (request.path !== match.path) {
        return false;
      }
    }
    if (match.regex) {
      const regex = new RegExp(match.regex);
      if (!regex.test(request.path)) {
        return false;
      }
    }

    // Header matching
    if (match.headers) {
      for (const headerMatch of match.headers) {
        const headerValue = request.headers?.[headerName(headerMatch.name)] || '';
        if (headerMatch.exact && headerValue !== headerMatch.exact) {
          return false;
        }
        if (headerMatch.prefix && !headerValue.startsWith(headerMatch.prefix)) {
          return false;
        }
        if (headerMatch.suffix && !headerValue.endsWith(headerMatch.suffix)) {
          return false;
        }
        if (headerMatch.regex) {
          const regex = new RegExp(headerMatch.regex);
          if (!regex.test(headerValue)) {
            return false;
          }
        }
      }
    }

    // Query parameter matching
    if (match.queryParameters) {
      for (const queryMatch of match.queryParameters) {
        const queryValue = request.query?.[queryMatch.name] || '';
        if (queryMatch.exact && queryValue !== queryMatch.exact) {
          return false;
        }
        if (queryMatch.regex) {
          const regex = new RegExp(queryMatch.regex);
          if (!regex.test(queryValue)) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Process filter
   */
  private processFilter(filter: EnvoyFilter, request: EnvoyRequest): {
    allowed: boolean;
    status?: number;
    error?: string;
    modifiedRequest?: EnvoyRequest;
  } {
    switch (filter.type) {
      case 'http_connection_manager':
        // HTTP connection manager always allows
        return { allowed: true };
      
      case 'tls_inspector':
        // TLS inspector allows TLS connections
        if (request.protocol === 'https') {
          return { allowed: true };
        }
        return { allowed: true }; // Allow non-TLS too
      
      case 'router':
        // Router filter allows
        return { allowed: true };
      
      case 'cors':
        // CORS filter allows and may modify headers
        return { allowed: true, modifiedRequest: request };
      
      case 'ratelimit':
        // Rate limit check (per-filter rate limiting)
        return { allowed: true };
      
      case 'fault':
        // Fault injection (for testing)
        const faultRate = filter.config?.faultRate || 0;
        if (Math.random() < faultRate) {
          return {
            allowed: false,
            status: filter.config?.faultStatusCode || 503,
            error: 'Fault injected',
          };
        }
        return { allowed: true };
      
      case 'ext_authz':
        // External authorization (simulate as allowed)
        return { allowed: true };
      
      default:
        return { allowed: true };
    }
  }

  /**
   * Select endpoint using load balancing policy
   */
  private selectEndpoint(cluster: EnvoyCluster, request: EnvoyRequest): string | null {
    // Filter healthy endpoints (not ejected by outlier detection)
    const healthyEndpoints = cluster.endpoints.filter(endpoint => {
      const endpointKey = `${endpoint.address}:${endpoint.port}`;
      const outlierState = this.outlierDetectionState.get(cluster.name)?.get(endpointKey);
      
      // Check if endpoint is ejected
      if (outlierState?.ejectedUntil && Date.now() < outlierState.ejectedUntil) {
        return false;
      }
      
      // Check health status
      return endpoint.healthStatus !== 'unhealthy' && endpoint.healthStatus !== 'timeout';
    });
    
    if (healthyEndpoints.length === 0) {
      return null;
    }

    const policy = cluster.loadBalancingPolicy || 'ROUND_ROBIN';
    let selectedEndpoint: EnvoyClusterEndpoint;

    switch (policy) {
      case 'ROUND_ROBIN':
        selectedEndpoint = this.selectRoundRobin(cluster.name, healthyEndpoints);
        break;
      
      case 'LEAST_REQUEST':
        selectedEndpoint = this.selectLeastRequest(cluster.name, healthyEndpoints);
        break;
      
      case 'RING_HASH':
      case 'MAGLEV':
        selectedEndpoint = this.selectHashBased(cluster.name, healthyEndpoints, request);
        break;
      
      case 'RANDOM':
        selectedEndpoint = healthyEndpoints[Math.floor(Math.random() * healthyEndpoints.length)];
        break;
      
      default:
        selectedEndpoint = healthyEndpoints[0];
    }

    return `${selectedEndpoint.address}:${selectedEndpoint.port}`;
  }

  /**
   * Round-robin selection with weights
   */
  private selectRoundRobin(clusterName: string, endpoints: EnvoyClusterEndpoint[]): EnvoyClusterEndpoint {
    const totalWeight = endpoints.reduce((sum, e) => sum + (e.weight || 1), 0);
    let counter = this.roundRobinCounters.get(clusterName) || 0;
    
    let currentWeight = 0;
    for (const endpoint of endpoints) {
      currentWeight += endpoint.weight || 1;
      if (counter < currentWeight) {
        this.roundRobinCounters.set(clusterName, (counter + 1) % totalWeight);
        return endpoint;
      }
    }
    
    this.roundRobinCounters.set(clusterName, (counter + 1) % totalWeight);
    return endpoints[0];
  }

  /**
   * Least request selection
   */
  private selectLeastRequest(clusterName: string, endpoints: EnvoyClusterEndpoint[]): EnvoyClusterEndpoint {
    const requestCounts = this.leastRequestCounts.get(clusterName) || new Map();
    let minRequests = Infinity;
    let selectedEndpoint = endpoints[0];

    for (const endpoint of endpoints) {
      const endpointKey = `${endpoint.address}:${endpoint.port}`;
      const requests = requestCounts.get(endpointKey) || 0;
      const weightedRequests = requests / (endpoint.weight || 1);
      
      if (weightedRequests < minRequests) {
        minRequests = weightedRequests;
        selectedEndpoint = endpoint;
      }
    }

    // Increment request count for selected endpoint
    const selectedKey = `${selectedEndpoint.address}:${selectedEndpoint.port}`;
    const currentCount = requestCounts.get(selectedKey) || 0;
    requestCounts.set(selectedKey, currentCount + 1);

    return selectedEndpoint;
  }

  /**
   * Hash-based selection (Ring Hash or Maglev)
   */
  private selectHashBased(clusterName: string, endpoints: EnvoyClusterEndpoint[], request: EnvoyRequest): EnvoyClusterEndpoint {
    // Use host header or path for hashing
    const hashKey = request.host || request.path || request.clientIP || 'default';
    const hash = this.simpleHash(hashKey);
    const index = hash % endpoints.length;
    return endpoints[index];
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Build hash table for ring hash or maglev
   */
  private buildHashTable(clusterName: string, cluster: EnvoyCluster): void {
    // Simplified hash table building
    // In real Envoy, this is more complex
    const endpoints = cluster.endpoints.map(e => `${e.address}:${e.port}`);
    this.ringHashMapping.set(clusterName, endpoints);
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(request: EnvoyRequest): { allowed: boolean } {
    if (!this.globalConfig.rateLimit?.enabled) {
      return { allowed: true };
    }
    
    const rate = this.globalConfig.rateLimit.rate || 100;
    const burst = this.globalConfig.rateLimit.burst || 10;
    const clientIP = request.clientIP || request.headers?.['X-Real-IP'] || request.headers?.['X-Forwarded-For'] || '0.0.0.0';
    const now = Date.now();
    const trackerKey = clientIP;
    
    let tracker = this.rateLimitTracker.get(trackerKey);
    
    // Reset if window expired (1 second window)
    if (!tracker || now >= tracker.resetAt) {
      tracker = {
        count: 0,
        resetAt: now + 1000,
      };
    }
    
    // Check if limit exceeded
    if (tracker.count >= rate + burst) {
      return { allowed: false };
    }
    
    // Increment counter
    tracker.count++;
    this.rateLimitTracker.set(trackerKey, tracker);
    
    return { allowed: true };
  }

  /**
   * Update circuit breaker state
   */
  private updateCircuitBreaker(clusterName: string, isError: boolean): void {
    const cluster = this.clusters.get(clusterName);
    if (!cluster || !cluster.circuitBreaker?.enabled) {
      return;
    }

    const cbState = this.circuitBreakerState.get(clusterName);
    if (!cbState) {
      return;
    }

    if (isError) {
      cbState.consecutiveErrors++;
      const threshold = cluster.circuitBreaker.consecutiveErrors || 5;
      
      if (cbState.consecutiveErrors >= threshold && !cbState.isOpen) {
        cbState.isOpen = true;
        cbState.openUntil = Date.now() + 30000; // 30 second timeout
        this.circuitBreakerTrips++;
      }
    } else {
      cbState.consecutiveErrors = 0;
      if (cbState.isOpen) {
        cbState.isOpen = false;
        cbState.openUntil = undefined;
      }
    }
  }

  /**
   * Update outlier detection state
   */
  private updateOutlierDetection(clusterName: string, endpointKey: string, isError: boolean): void {
    const cluster = this.clusters.get(clusterName);
    if (!cluster || !cluster.outlierDetection?.enabled) {
      return;
    }

    let clusterState = this.outlierDetectionState.get(clusterName);
    if (!clusterState) {
      clusterState = new Map();
      this.outlierDetectionState.set(clusterName, clusterState);
    }

    let endpointState = clusterState.get(endpointKey);
    if (!endpointState) {
      endpointState = { consecutiveErrors: 0 };
      clusterState.set(endpointKey, endpointState);
    }

    if (isError) {
      endpointState.consecutiveErrors++;
      const threshold = cluster.outlierDetection.consecutiveErrors || 5;
      const baseEjectionTime = cluster.outlierDetection.baseEjectionTime || 30000;
      
      if (endpointState.consecutiveErrors >= threshold) {
        endpointState.ejectedUntil = Date.now() + baseEjectionTime;
        
        // Update endpoint health status
        const endpoint = cluster.endpoints.find(e => `${e.address}:${e.port}` === endpointKey);
        if (endpoint) {
          endpoint.healthStatus = 'unhealthy';
        }
      }
    } else {
      endpointState.consecutiveErrors = 0;
      if (endpointState.ejectedUntil && Date.now() >= endpointState.ejectedUntil) {
        endpointState.ejectedUntil = undefined;
        
        // Update endpoint health status
        const endpoint = cluster.endpoints.find(e => `${e.address}:${e.port}` === endpointKey);
        if (endpoint) {
          endpoint.healthStatus = 'healthy';
        }
      }
    }
  }

  /**
   * Start health check for an endpoint
   */
  private startHealthCheck(clusterName: string, endpoint: EnvoyClusterEndpoint, healthCheck: NonNullable<EnvoyCluster['healthCheck']>): void {
    const endpointKey = `${clusterName}:${endpoint.address}:${endpoint.port}`;
    
    // Clear existing timer if any
    const existingTimer = this.healthCheckTimers.get(endpointKey);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    const interval = healthCheck.interval || 10000;
    const timeout = healthCheck.timeout || 5000;
    const healthyThreshold = healthCheck.healthyThreshold || 1;
    const unhealthyThreshold = healthCheck.unhealthyThreshold || 2;

    const timer = setInterval(() => {
      endpoint.lastCheck = Date.now();

      // Simulate health check
      const isHealthy = Math.random() > 0.1; // 90% chance of being healthy

      setTimeout(() => {
        if (isHealthy) {
          const successCount = (this.endpointCheckSuccesses.get(endpointKey) || 0) + 1;
          this.endpointCheckSuccesses.set(endpointKey, successCount);
          this.endpointCheckFailures.set(endpointKey, 0);

          if (endpoint.healthStatus === 'unhealthy' && successCount >= healthyThreshold) {
            endpoint.healthStatus = 'healthy';
          } else if (!endpoint.healthStatus || endpoint.healthStatus === 'unknown') {
            endpoint.healthStatus = 'healthy';
          }
        } else {
          const failureCount = (this.endpointCheckFailures.get(endpointKey) || 0) + 1;
          this.endpointCheckFailures.set(endpointKey, failureCount);
          this.endpointCheckSuccesses.set(endpointKey, 0);

          if (endpoint.healthStatus === 'healthy' && failureCount >= unhealthyThreshold) {
            endpoint.healthStatus = 'unhealthy';
          } else if (!endpoint.healthStatus || endpoint.healthStatus === 'unknown') {
            endpoint.healthStatus = 'unhealthy';
          }
        }
      }, timeout);
    }, interval);

    this.healthCheckTimers.set(endpointKey, timer);
  }

  /**
   * Get routing statistics
   */
  public getStats(): EnvoyStats {
    let totalEndpoints = 0;
    let healthyEndpoints = 0;
    let unhealthyEndpoints = 0;

    for (const cluster of this.clusters.values()) {
      totalEndpoints += cluster.endpoints.length;
      for (const endpoint of cluster.endpoints) {
        if (endpoint.healthStatus === 'healthy') {
          healthyEndpoints++;
        } else if (endpoint.healthStatus === 'unhealthy') {
          unhealthyEndpoints++;
        }
      }
    }

    const errorRate = this.requestCount > 0 ? this.errorCount / this.requestCount : 0;

    return {
      clusters: this.clusters.size,
      listeners: this.listeners.size,
      routes: this.routes.size,
      totalEndpoints,
      healthyEndpoints,
      unhealthyEndpoints,
      totalRequests: this.requestCount,
      totalResponses: this.responseCount,
      activeConnections: this.activeConnections,
      totalBytesIn: this.totalBytesIn,
      totalBytesOut: this.totalBytesOut,
      errorRate,
      rateLimitBlocks: this.rateLimitBlocks,
      timeoutErrors: this.timeoutErrors,
      circuitBreakerTrips: this.circuitBreakerTrips,
    };
  }

  /**
   * Get cluster statistics
   */
  public getClusterStats(clusterName: string): {
    requests: number;
    errors: number;
    activeConnections: number;
    healthyEndpoints: number;
    unhealthyEndpoints: number;
  } | null {
    const cluster = this.clusters.get(clusterName);
    if (!cluster) return null;

    let healthyEndpoints = 0;
    let unhealthyEndpoints = 0;

    for (const endpoint of cluster.endpoints) {
      if (endpoint.healthStatus === 'healthy') {
        healthyEndpoints++;
      } else if (endpoint.healthStatus === 'unhealthy') {
        unhealthyEndpoints++;
      }
    }

    return {
      requests: cluster.requests || 0,
      errors: cluster.errors || 0,
      activeConnections: cluster.activeConnections || 0,
      healthyEndpoints,
      unhealthyEndpoints,
    };
  }

  /**
   * Get listener statistics
   */
  public getListenerStats(listenerName: string): {
    activeConnections: number;
    requests: number;
    responses: number;
  } | null {
    const listener = this.listeners.get(listenerName);
    if (!listener) return null;

    return {
      activeConnections: listener.activeConnections || 0,
      requests: listener.requests || 0,
      responses: listener.responses || 0,
    };
  }

  /**
   * Get route statistics
   */
  public getRouteStats(routeName: string): {
    requests: number;
    responses: number;
    errors: number;
  } | null {
    const route = this.routes.get(routeName);
    if (!route) return null;

    return {
      requests: route.requests || 0,
      responses: route.responses || 0,
      errors: route.errors || 0,
    };
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    for (const timer of this.healthCheckTimers.values()) {
      clearInterval(timer);
    }
    this.healthCheckTimers.clear();
  }
}

/**
 * Helper function to normalize header names
 */
function headerName(name: string): string {
  return name.toLowerCase();
}



/**
 * Traefik Routing Engine
 * Handles request routing through routers, services, and middlewares
 * Simulates Traefik behavior including dynamic routing, load balancing, and middleware chains
 */

export interface TraefikRouter {
  id: string;
  name: string;
  rule: string; // e.g., "Host(`example.com`) && PathPrefix(`/api`)"
  service: string; // Service name
  entryPoints: string[]; // e.g., ["web", "websecure"]
  middlewares?: string[]; // Middleware chain (order matters)
  tls?: {
    enabled: boolean;
    certResolver?: string;
    options?: string;
  };
  priority?: number; // Higher priority = evaluated first
  // Statistics
  requests?: number;
  responses?: number;
  errors?: number;
  bytesIn?: number;
  bytesOut?: number;
  averageLatency?: number;
}

export interface TraefikService {
  id: string;
  name: string;
  loadBalancer: {
    servers: Array<{
      url: string; // e.g., "http://192.168.1.10:8080"
      weight?: number; // For weighted load balancing
    }>;
    strategy?: 'roundRobin' | 'wrr' | 'drr'; // Weighted Round Robin, Dynamic Round Robin
    healthCheck?: {
      enabled: boolean;
      path?: string;
      interval?: number; // seconds
      timeout?: number; // seconds
      scheme?: 'http' | 'https';
      hostname?: string;
      port?: number;
      headers?: Record<string, string>;
      followRedirects?: boolean;
    };
    passHostHeader?: boolean;
    responseForwarding?: {
      flushInterval?: string; // e.g., "100ms"
    };
    serversTransport?: string;
  };
  // Alternative: mirroring, failover, weighted
  type?: 'loadBalancer' | 'mirroring' | 'failover' | 'weighted';
  mirrors?: Array<{
    name: string;
    percent?: number; // 0-100
  }>;
  // Statistics
  totalRequests?: number;
  totalResponses?: number;
  activeConnections?: number;
}

export interface TraefikMiddleware {
  id: string;
  name: string;
  type: 'auth' | 'rateLimit' | 'headers' | 'redirect' | 'stripPrefix' | 'addPrefix' | 
        'compress' | 'retry' | 'circuitBreaker' | 'ipAllowList' | 'ipWhiteList' |
        'basicAuth' | 'digestAuth' | 'forwardAuth' | 'chain';
  config?: {
    // Rate Limit
    average?: number;
    burst?: number;
    period?: string; // e.g., "1s"
    // Headers
    customRequestHeaders?: Record<string, string>;
    customResponseHeaders?: Record<string, string>;
    // Redirect
    scheme?: string;
    permanent?: boolean;
    port?: string;
    regex?: string;
    replacement?: string;
    // Strip/Add Prefix
    prefix?: string;
    // Compress
    excludedContentTypes?: string[];
    // Retry
    attempts?: number;
    initialInterval?: string;
    // Circuit Breaker
    expression?: string;
    checkPeriod?: string;
    fallbackDuration?: string;
    recoveryDuration?: string;
    // IP Allow/White List
    sourceRange?: string[];
    // Auth
    headerField?: string;
    users?: string[];
    realm?: string;
    // Chain
    middlewares?: string[];
  };
}

export interface TraefikEntryPoint {
  name: string;
  address: string; // e.g., ":80", ":443"
  transport?: {
    respondingTimeouts?: {
      readTimeout?: string;
      writeTimeout?: string;
      idleTimeout?: string;
    };
    forwardingTimeouts?: {
      dialTimeout?: string;
      responseHeaderTimeout?: string;
      idleConnTimeout?: string;
    };
  };
  proxyProtocol?: {
    trustedIPs?: string[];
    insecure?: boolean;
  };
  forwardedHeaders?: {
    insecure?: boolean;
    trustedIPs?: string[];
  };
}

export interface TraefikRequest {
  path: string;
  method: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  clientIP?: string;
  protocol?: 'http' | 'https';
  host?: string;
  entryPoint?: string;
}

export interface TraefikResponse {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
  latency?: number;
  error?: string;
  serviceTarget?: string;
  serverTarget?: string;
  routerMatched?: string;
}

export interface TraefikStats {
  routers: number;
  activeRouters: number;
  services: number;
  middlewares: number;
  entryPoints: number;
  totalServers: number;
  healthyServers: number;
  totalRequests: number;
  totalResponses: number;
  activeConnections: number;
  totalBytesIn: number;
  totalBytesOut: number;
  errorRate: number;
  averageLatency: number;
}

export interface TraefikGlobalConfig {
  maxIdleConnsPerHost?: number;
  maxConnections?: number;
  idleTimeout?: number; // ms
  responseTimeout?: number; // ms
  forwardAuth?: {
    address?: string;
    trustForwardHeader?: boolean;
  };
  insecureSkipVerify?: boolean;
}

/**
 * Traefik Routing Engine
 * Simulates Traefik request routing and load balancing behavior
 */
export class TraefikRoutingEngine {
  private routers: Map<string, TraefikRouter> = new Map();
  private services: Map<string, TraefikService> = new Map();
  private middlewares: Map<string, TraefikMiddleware> = new Map();
  private entryPoints: Map<string, TraefikEntryPoint> = new Map();
  private globalConfig: TraefikGlobalConfig = {};
  
  // Load balancing state
  private roundRobinCounters: Map<string, number> = new Map(); // service -> counter
  private connectionCounts: Map<string, number> = new Map(); // server -> connection count
  private serverHealthStatus: Map<string, 'healthy' | 'unhealthy' | 'checking'> = new Map(); // server url -> status
  private serverCheckFailures: Map<string, number> = new Map(); // server url -> failure count
  private serverCheckSuccesses: Map<string, number> = new Map(); // server url -> success count
  
  // Health check timers
  private healthCheckTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // Rate limiting state
  private rateLimitTracker: Map<string, { count: number; resetAt: number; burst: number }> = new Map(); // key -> rate limit state
  
  // Statistics
  private requestCount: number = 0;
  private responseCount: number = 0;
  private errorCount: number = 0;
  private totalBytesIn: number = 0;
  private totalBytesOut: number = 0;
  private activeConnections: number = 0;
  private totalLatency: number = 0;
  private latencyCount: number = 0;

  /**
   * Initialize with Traefik configuration
   */
  public initialize(config: {
    routers?: TraefikRouter[];
    services?: TraefikService[];
    middlewares?: TraefikMiddleware[];
    entryPoints?: TraefikEntryPoint[];
    globalConfig?: TraefikGlobalConfig;
  }) {
    // Clear previous state
    this.routers.clear();
    this.services.clear();
    this.middlewares.clear();
    this.entryPoints.clear();
    this.roundRobinCounters.clear();
    this.connectionCounts.clear();
    this.serverHealthStatus.clear();
    this.serverCheckFailures.clear();
    this.serverCheckSuccesses.clear();
    this.rateLimitTracker.clear();
    
    // Store global config
    this.globalConfig = config.globalConfig || {};
    
    // Clear health check timers
    for (const timer of this.healthCheckTimers.values()) {
      clearInterval(timer);
    }
    this.healthCheckTimers.clear();

    // Initialize entry points
    if (config.entryPoints) {
      for (const ep of config.entryPoints) {
        this.entryPoints.set(ep.name, ep);
      }
    } else {
      // Default entry points
      this.entryPoints.set('web', {
        name: 'web',
        address: ':80',
      });
      this.entryPoints.set('websecure', {
        name: 'websecure',
        address: ':443',
      });
    }

    // Initialize routers
    if (config.routers) {
      for (const router of config.routers) {
        this.routers.set(router.name, {
          ...router,
          priority: router.priority || 0,
          requests: router.requests || 0,
          responses: router.responses || 0,
          errors: router.errors || 0,
          bytesIn: router.bytesIn || 0,
          bytesOut: router.bytesOut || 0,
        });
      }
    }

    // Initialize services
    if (config.services) {
      for (const service of config.services) {
        this.services.set(service.name, service);
        this.roundRobinCounters.set(service.name, 0);
        
        // Initialize health checks for service servers
        if (service.loadBalancer?.healthCheck?.enabled && service.loadBalancer.servers) {
          for (const server of service.loadBalancer.servers) {
            this.startHealthCheck(service.name, server.url, service.loadBalancer.healthCheck);
          }
        }
      }
    }

    // Initialize middlewares
    if (config.middlewares) {
      for (const middleware of config.middlewares) {
        this.middlewares.set(middleware.name, middleware);
      }
    }

    // Reset statistics
    this.requestCount = 0;
    this.responseCount = 0;
    this.errorCount = 0;
    this.totalBytesIn = 0;
    this.totalBytesOut = 0;
    this.activeConnections = 0;
    this.totalLatency = 0;
    this.latencyCount = 0;
  }

  /**
   * Route a request through Traefik
   */
  public routeRequest(request: TraefikRequest): {
    router: TraefikRouter | null;
    service: TraefikService | null;
    response: TraefikResponse;
    middlewaresApplied?: string[];
  } {
    const startTime = Date.now();
    this.requestCount++;
    
    // Check max connections limit
    const maxConnections = this.globalConfig.maxConnections || 10000;
    if (this.activeConnections >= maxConnections) {
      this.connectionRejects++;
      this.errorCount++;
      return {
        router: null,
        service: null,
        response: {
          status: 503,
          error: 'Max connections exceeded',
          latency: Date.now() - startTime,
        },
      };
    }
    
    this.activeConnections++;
    
    // Step 1: Find matching router based on entry point and rules
    const router = this.findMatchingRouter(request);
    
    if (!router) {
      this.activeConnections--;
      this.errorCount++;
      return {
        router: null,
        service: null,
        response: {
          status: 404,
          error: 'No matching router found',
          latency: Date.now() - startTime,
        },
      };
    }

    // Update router statistics
    router.requests = (router.requests || 0) + 1;

    // Step 2: Apply middleware chain (if any)
    let processedRequest = { ...request };
    const middlewaresApplied: string[] = [];
    
    if (router.middlewares && router.middlewares.length > 0) {
      for (const middlewareName of router.middlewares) {
        const middleware = this.middlewares.get(middlewareName);
        if (middleware) {
          const middlewareResult = this.applyMiddleware(middleware, processedRequest);
          if (middlewareResult.block) {
            this.activeConnections--;
            this.errorCount++;
            router.errors = (router.errors || 0) + 1;
            return {
              router,
              service: null,
              response: {
                status: middlewareResult.status || 403,
                error: middlewareResult.error || 'Middleware blocked request',
                latency: Date.now() - startTime,
                routerMatched: router.name,
              },
              middlewaresApplied,
            };
          }
          if (middlewareResult.request) {
            processedRequest = middlewareResult.request;
          }
          middlewaresApplied.push(middlewareName);
        }
      }
    }

    // Step 3: Find service
    const service = this.services.get(router.service);
    if (!service) {
      this.activeConnections--;
      this.errorCount++;
      router.errors = (router.errors || 0) + 1;
      return {
        router,
        service: null,
        response: {
          status: 503,
          error: `Service ${router.service} not found`,
          latency: Date.now() - startTime,
          routerMatched: router.name,
        },
        middlewaresApplied,
      };
    }

    // Step 4: Select server using load balancing
    const serverTarget = this.selectServer(service, processedRequest);
    
    if (!serverTarget) {
      this.activeConnections--;
      this.errorCount++;
      router.errors = (router.errors || 0) + 1;
      return {
        router,
        service,
        response: {
          status: 503,
          error: 'No healthy server available',
          latency: Date.now() - startTime,
          routerMatched: router.name,
        },
        middlewaresApplied,
      };
    }

    // Step 5: Simulate request processing
    const baseResponseTime = 5 + Math.random() * 95; // 5-100ms base
    
    // Add TLS overhead if router uses TLS
    const tlsOverhead = router.tls?.enabled ? 5 + Math.random() * 15 : 0; // 5-20ms
    
    // Apply timeout constraints
    const responseTimeout = this.globalConfig.responseTimeout || 30000;
    const totalResponseTime = baseResponseTime + tlsOverhead;
    
    if (totalResponseTime > responseTimeout) {
      this.activeConnections--;
      this.errorCount++;
      router.errors = (router.errors || 0) + 1;
      return {
        router,
        service,
        response: {
          status: 504,
          error: 'Response timeout',
          latency: responseTimeout,
          serviceTarget: service.name,
          serverTarget,
          routerMatched: router.name,
        },
        middlewaresApplied,
      };
    }
    
    const response: TraefikResponse = {
      status: 200,
      body: { proxied: true, service: service.name, server: serverTarget },
      latency: totalResponseTime,
      serviceTarget: service.name,
      serverTarget,
      routerMatched: router.name,
    };

    // Update statistics
    const requestSize = 1024; // Estimated
    const responseSize = 2048; // Estimated
    router.bytesIn = (router.bytesIn || 0) + requestSize;
    router.bytesOut = (router.bytesOut || 0) + responseSize;
    router.responses = (router.responses || 0) + 1;
    router.averageLatency = ((router.averageLatency || 0) * (router.responses - 1) + totalResponseTime) / router.responses;
    
    service.totalRequests = (service.totalRequests || 0) + 1;
    service.totalResponses = (service.totalResponses || 0) + 1;
    
    this.totalBytesIn += requestSize;
    this.totalBytesOut += responseSize;
    this.responseCount++;
    this.activeConnections--;
    this.totalLatency += totalResponseTime;
    this.latencyCount++;

    // Update connection count for server
    const connCount = this.connectionCounts.get(serverTarget) || 0;
    this.connectionCounts.set(serverTarget, connCount + 1);

    return {
      router,
      service,
      response,
      middlewaresApplied,
    };
  }

  /**
   * Find matching router based on entry point and rules
   */
  private findMatchingRouter(request: TraefikRequest): TraefikRouter | null {
    // Filter routers by entry point
    let candidateRouters: TraefikRouter[] = [];
    
    for (const router of this.routers.values()) {
      // Check entry point match
      if (request.entryPoint) {
        if (!router.entryPoints.includes(request.entryPoint)) {
          continue;
        }
      }
      
      // Check rule match
      if (this.evaluateRule(router.rule, request)) {
        candidateRouters.push(router);
      }
    }
    
    // Sort by priority (higher priority first)
    candidateRouters.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    return candidateRouters.length > 0 ? candidateRouters[0] : null;
  }

  /**
   * Evaluate router rule (simplified parser for common rules)
   * Supports: Host(`domain.com`), PathPrefix(`/api`), Path(`/exact`), Method(`GET`)
   */
  private evaluateRule(rule: string, request: TraefikRequest): boolean {
    // Simple rule evaluation - supports common Traefik rules
    // Full parser would be more complex
    
    try {
      // Split by && and evaluate each part
      const parts = rule.split('&&').map(p => p.trim());
      
      for (const part of parts) {
        // Host(`domain.com`)
        if (part.startsWith('Host(')) {
          const match = part.match(/Host\(`([^`]+)`\)/);
          if (match) {
            const host = match[1];
            const requestHost = request.host || request.headers?.['Host'] || '';
            if (requestHost !== host && !requestHost.endsWith(`.${host}`)) {
              return false;
            }
          }
        }
        
        // PathPrefix(`/api`)
        if (part.startsWith('PathPrefix(')) {
          const match = part.match(/PathPrefix\(`([^`]+)`\)/);
          if (match) {
            const prefix = match[1];
            if (!request.path.startsWith(prefix)) {
              return false;
            }
          }
        }
        
        // Path(`/exact`)
        if (part.startsWith('Path(') && !part.startsWith('PathPrefix(')) {
          const match = part.match(/Path\(`([^`]+)`\)/);
          if (match) {
            const path = match[1];
            if (request.path !== path) {
              return false;
            }
          }
        }
        
        // Method(`GET`)
        if (part.startsWith('Method(')) {
          const match = part.match(/Method\(`([^`]+)`\)/);
          if (match) {
            const method = match[1];
            if (request.method.toUpperCase() !== method.toUpperCase()) {
              return false;
            }
          }
        }
      }
      
      return true;
    } catch (e) {
      // If rule parsing fails, assume it matches (fallback)
      console.warn('Failed to parse Traefik rule:', rule, e);
      return true;
    }
  }

  /**
   * Apply middleware to request
   */
  private applyMiddleware(middleware: TraefikMiddleware, request: TraefikRequest): {
    block: boolean;
    status?: number;
    error?: string;
    request?: TraefikRequest;
  } {
    switch (middleware.type) {
      case 'rateLimit':
        return this.applyRateLimit(middleware, request);
      
      case 'ipAllowList':
      case 'ipWhiteList':
        return this.applyIPAllowList(middleware, request);
      
      case 'auth':
      case 'basicAuth':
      case 'digestAuth':
        return this.applyAuth(middleware, request);
      
      case 'headers':
        return this.applyHeaders(middleware, request);
      
      case 'redirect':
        return this.applyRedirect(middleware, request);
      
      case 'stripPrefix':
        return this.applyStripPrefix(middleware, request);
      
      case 'addPrefix':
        return this.applyAddPrefix(middleware, request);
      
      default:
        // Other middlewares don't block, just transform
        return { block: false, request };
    }
  }

  /**
   * Apply rate limit middleware
   */
  private applyRateLimit(middleware: TraefikMiddleware, request: TraefikRequest): {
    block: boolean;
    status?: number;
    error?: string;
  } {
    if (!middleware.config) return { block: false };
    
    const average = middleware.config.average || 100;
    const burst = middleware.config.burst || 50;
    const period = this.parsePeriod(middleware.config.period || '1s');
    
    const clientIP = request.clientIP || '0.0.0.0';
    const key = `${middleware.name}:${clientIP}`;
    
    const now = Date.now();
    let tracker = this.rateLimitTracker.get(key);
    
    if (!tracker || tracker.resetAt < now) {
      tracker = {
        count: 0,
        resetAt: now + period,
        burst,
      };
      this.rateLimitTracker.set(key, tracker);
    }
    
    if (tracker.count >= average + burst) {
      return {
        block: true,
        status: 429,
        error: 'Rate limit exceeded',
      };
    }
    
    tracker.count++;
    return { block: false };
  }

  /**
   * Apply IP allow list middleware
   */
  private applyIPAllowList(middleware: TraefikMiddleware, request: TraefikRequest): {
    block: boolean;
    status?: number;
    error?: string;
  } {
    if (!middleware.config?.sourceRange) return { block: false };
    
    const clientIP = request.clientIP || '0.0.0.0';
    
    // Simple IP matching (in production, use proper IP CIDR matching)
    const isAllowed = middleware.config.sourceRange.some(range => {
      if (range.includes('/')) {
        // CIDR notation - simplified check
        return clientIP.startsWith(range.split('/')[0]);
      }
      return clientIP === range;
    });
    
    if (!isAllowed) {
      return {
        block: true,
        status: 403,
        error: 'IP not allowed',
      };
    }
    
    return { block: false };
  }

  /**
   * Apply auth middleware (simplified)
   */
  private applyAuth(middleware: TraefikMiddleware, request: TraefikRequest): {
    block: boolean;
    status?: number;
    error?: string;
  } {
    // Simplified auth check - just verify header exists
    if (middleware.config?.headerField) {
      const headerValue = request.headers?.[middleware.config.headerField];
      if (!headerValue) {
        return {
          block: true,
          status: 401,
          error: 'Authentication required',
        };
      }
    }
    
    return { block: false };
  }

  /**
   * Apply headers middleware
   */
  private applyHeaders(middleware: TraefikMiddleware, request: TraefikRequest): {
    block: boolean;
    request?: TraefikRequest;
  } {
    const newRequest = { ...request };
    if (!newRequest.headers) {
      newRequest.headers = {};
    }
    
    if (middleware.config?.customRequestHeaders) {
      Object.assign(newRequest.headers, middleware.config.customRequestHeaders);
    }
    
    return { block: false, request: newRequest };
  }

  /**
   * Apply redirect middleware
   */
  private applyRedirect(middleware: TraefikMiddleware, request: TraefikRequest): {
    block: boolean;
    status?: number;
    error?: string;
  } {
    // Redirect is handled as a response modification, not request blocking
    // In real Traefik, this would redirect the response
    return { block: false };
  }

  /**
   * Apply strip prefix middleware
   */
  private applyStripPrefix(middleware: TraefikMiddleware, request: TraefikRequest): {
    block: boolean;
    request?: TraefikRequest;
  } {
    if (!middleware.config?.prefix) return { block: false, request };
    
    const newRequest = { ...request };
    if (newRequest.path.startsWith(middleware.config.prefix)) {
      newRequest.path = newRequest.path.substring(middleware.config.prefix.length);
    }
    
    return { block: false, request: newRequest };
  }

  /**
   * Apply add prefix middleware
   */
  private applyAddPrefix(middleware: TraefikMiddleware, request: TraefikRequest): {
    block: boolean;
    request?: TraefikRequest;
  } {
    if (!middleware.config?.prefix) return { block: false, request };
    
    const newRequest = { ...request };
    newRequest.path = middleware.config.prefix + newRequest.path;
    
    return { block: false, request: newRequest };
  }

  /**
   * Select server using load balancing strategy
   */
  private selectServer(service: TraefikService, request: TraefikRequest): string | null {
    const servers = service.loadBalancer?.servers || [];
    
    // Filter healthy servers
    const healthyServers = servers.filter(server => {
      const status = this.serverHealthStatus.get(server.url);
      return status === 'healthy' || status === undefined; // undefined = not checked yet
    });
    
    if (healthyServers.length === 0) {
      return null;
    }

    const strategy = service.loadBalancer?.strategy || 'roundRobin';
    
    switch (strategy) {
      case 'roundRobin':
        return this.selectRoundRobin(service.name, healthyServers);
      
      case 'wrr': // Weighted Round Robin
        return this.selectWeightedRoundRobin(service.name, healthyServers);
      
      case 'drr': // Dynamic Round Robin
        return this.selectDynamicRoundRobin(service.name, healthyServers);
      
      default:
        return healthyServers[0]?.url || null;
    }
  }

  /**
   * Round-robin selection
   */
  private selectRoundRobin(serviceName: string, servers: Array<{ url: string; weight?: number }>): string {
    const counter = this.roundRobinCounters.get(serviceName) || 0;
    const selected = servers[counter % servers.length];
    this.roundRobinCounters.set(serviceName, (counter + 1) % servers.length);
    return selected.url;
  }

  /**
   * Weighted Round Robin selection
   */
  private selectWeightedRoundRobin(serviceName: string, servers: Array<{ url: string; weight?: number }>): string {
    const totalWeight = servers.reduce((sum, s) => sum + (s.weight || 1), 0);
    let counter = this.roundRobinCounters.get(serviceName) || 0;
    
    let currentWeight = 0;
    for (const server of servers) {
      currentWeight += server.weight || 1;
      if (counter < currentWeight) {
        this.roundRobinCounters.set(serviceName, (counter + 1) % totalWeight);
        return server.url;
      }
    }
    
    this.roundRobinCounters.set(serviceName, (counter + 1) % totalWeight);
    return servers[0]?.url || '';
  }

  /**
   * Dynamic Round Robin (considers server load)
   */
  private selectDynamicRoundRobin(serviceName: string, servers: Array<{ url: string; weight?: number }>): string {
    // Similar to least connections
    let minConnections = Infinity;
    let selected = servers[0];
    
    for (const server of servers) {
      const connections = this.connectionCounts.get(server.url) || 0;
      const weightedConnections = connections / (server.weight || 1);
      
      if (weightedConnections < minConnections) {
        minConnections = weightedConnections;
        selected = server;
      }
    }
    
    return selected.url;
  }

  /**
   * Start health check for a server
   */
  private startHealthCheck(serviceName: string, serverUrl: string, healthCheck: {
    enabled: boolean;
    path?: string;
    interval?: number;
    timeout?: number;
  }) {
    const interval = (healthCheck.interval || 10) * 1000; // Convert to ms
    const key = `${serviceName}:${serverUrl}`;
    
    // Initial status
    this.serverHealthStatus.set(serverUrl, 'checking');
    
    const checkHealth = async () => {
      try {
        // Simulate health check (in real implementation, would make HTTP request)
        // For now, randomly mark servers as healthy/unhealthy for simulation
        const random = Math.random();
        const isHealthy = random > 0.1; // 90% chance of being healthy
        
        if (isHealthy) {
          this.serverHealthStatus.set(serverUrl, 'healthy');
          const successes = this.serverCheckSuccesses.get(serverUrl) || 0;
          this.serverCheckSuccesses.set(serverUrl, successes + 1);
          this.serverCheckFailures.set(serverUrl, 0);
        } else {
          const failures = (this.serverCheckFailures.get(serverUrl) || 0) + 1;
          this.serverCheckFailures.set(serverUrl, failures);
          
          // Mark unhealthy after 3 consecutive failures
          if (failures >= 3) {
            this.serverHealthStatus.set(serverUrl, 'unhealthy');
          }
        }
      } catch (e) {
        const failures = (this.serverCheckFailures.get(serverUrl) || 0) + 1;
        this.serverCheckFailures.set(serverUrl, failures);
        if (failures >= 3) {
          this.serverHealthStatus.set(serverUrl, 'unhealthy');
        }
      }
    };
    
    // Initial check
    checkHealth();
    
    // Schedule periodic checks
    const timer = setInterval(checkHealth, interval);
    this.healthCheckTimers.set(key, timer);
  }

  /**
   * Parse period string (e.g., "1s", "100ms", "5m")
   */
  private parsePeriod(period: string): number {
    const match = period.match(/^(\d+)([smh])$/);
    if (!match) return 1000; // Default 1 second
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return 1000;
    }
  }

  /**
   * Get statistics
   */
  public getStats(): TraefikStats {
    let totalServers = 0;
    let healthyServers = 0;
    
    for (const service of this.services.values()) {
      const servers = service.loadBalancer?.servers || [];
      totalServers += servers.length;
      
      for (const server of servers) {
        const status = this.serverHealthStatus.get(server.url);
        if (status === 'healthy' || status === undefined) {
          healthyServers++;
        }
      }
    }
    
    const activeRouters = Array.from(this.routers.values()).filter(r => (r.requests || 0) > 0).length;
    const averageLatency = this.latencyCount > 0 ? this.totalLatency / this.latencyCount : 0;
    const errorRate = this.requestCount > 0 ? this.errorCount / this.requestCount : 0;
    
    return {
      routers: this.routers.size,
      activeRouters,
      services: this.services.size,
      middlewares: this.middlewares.size,
      entryPoints: this.entryPoints.size,
      totalServers,
      healthyServers,
      totalRequests: this.requestCount,
      totalResponses: this.responseCount,
      activeConnections: this.activeConnections,
      totalBytesIn: this.totalBytesIn,
      totalBytesOut: this.totalBytesOut,
      errorRate,
      averageLatency,
    };
  }

  /**
   * Get router by name
   */
  public getRouter(name: string): TraefikRouter | undefined {
    return this.routers.get(name);
  }

  /**
   * Get service by name
   */
  public getService(name: string): TraefikService | undefined {
    return this.services.get(name);
  }

  /**
   * Get middleware by name
   */
  public getMiddleware(name: string): TraefikMiddleware | undefined {
    return this.middlewares.get(name);
  }

  /**
   * Reset statistics
   */
  public resetStats() {
    this.requestCount = 0;
    this.responseCount = 0;
    this.errorCount = 0;
    this.totalBytesIn = 0;
    this.totalBytesOut = 0;
    this.activeConnections = 0;
    this.totalLatency = 0;
    this.latencyCount = 0;
    
    for (const router of this.routers.values()) {
      router.requests = 0;
      router.responses = 0;
      router.errors = 0;
      router.bytesIn = 0;
      router.bytesOut = 0;
      router.averageLatency = 0;
    }
    
    for (const service of this.services.values()) {
      service.totalRequests = 0;
      service.totalResponses = 0;
      service.activeConnections = 0;
    }
  }

  private connectionRejects: number = 0;
}


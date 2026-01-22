/**
 * Kong Gateway Routing Engine
 * Handles request routing through services, routes, and upstreams with load balancing
 */

export interface KongService {
  id: string;
  name: string;
  url?: string;
  protocol?: 'http' | 'https' | 'grpc' | 'grpcs';
  host?: string;
  port?: number;
  path?: string;
  connect_timeout?: number;
  write_timeout?: number;
  read_timeout?: number;
  retries?: number;
  enabled?: boolean;
  upstream?: string;
  routes?: string[];
  tags?: string[];
  ca_certificates?: string[];
  client_certificate?: string;
  tls_verify?: boolean;
  tls_verify_depth?: number;
}

export interface KongRoute {
  id: string;
  name?: string;
  paths?: string[];
  path?: string; // For backward compatibility
  methods?: string[];
  method?: string; // For backward compatibility
  hosts?: string[];
  snis?: string[];
  sources?: Array<{ ip?: string; port?: number }>;
  destinations?: Array<{ ip?: string; port?: number }>;
  regex_priority?: number;
  priority?: number;
  preserve_host?: boolean;
  request_buffering?: boolean;
  response_buffering?: boolean;
  https_redirect_status_code?: number;
  path_handling?: 'v0' | 'v1';
  strip_path?: boolean;
  stripPath?: boolean; // For backward compatibility
  service: string;
  protocols?: ('http' | 'https' | 'grpc' | 'grpcs')[];
  tags?: string[];
}

export interface KongUpstream {
  id?: string;
  name: string;
  algorithm?: 'round-robin' | 'consistent-hashing' | 'least-connections';
  slots?: number;
  hash_on?: 'none' | 'header' | 'cookie' | 'consumer' | 'ip';
  hash_fallback?: 'none' | 'header' | 'cookie' | 'consumer' | 'ip';
  hash_on_header?: string;
  hash_fallback_header?: string;
  hash_on_cookie?: string;
  hash_on_cookie_path?: string;
  healthchecks?: {
    active?: {
      type?: 'http' | 'https' | 'tcp';
      http_path?: string;
      https_verify_certificate?: boolean;
      https_sni?: string;
      timeout?: number;
      concurrency?: number;
      healthy?: {
        interval?: number;
        successes?: number;
        http_statuses?: number[];
        timeouts?: number;
      };
      unhealthy?: {
        interval?: number;
        timeouts?: number;
        http_statuses?: number[];
        tcp_failures?: number;
        http_failures?: number;
      };
    };
    passive?: {
      type?: 'http' | 'https' | 'tcp';
      healthy?: {
        successes?: number;
        http_statuses?: number[];
        timeouts?: number;
      };
      unhealthy?: {
        timeouts?: number;
        http_statuses?: number[];
        tcp_failures?: number;
        http_failures?: number;
      };
    };
  };
  targets?: KongUpstreamTarget[];
  tags?: string[];
}

export interface KongUpstreamTarget {
  id?: string;
  target: string; // host:port
  weight?: number;
  health?: 'healthy' | 'unhealthy' | 'draining';
  tags?: string[];
  created_at?: number;
}

export interface KongConsumer {
  id: string;
  username?: string;
  custom_id?: string;
  customId?: string; // For backward compatibility
  tags?: string[];
  created_at?: number;
  credentials?: KongConsumerCredential[];
}

export interface KongConsumerCredential {
  id?: string;
  type: 'key-auth' | 'jwt' | 'oauth2' | 'basic-auth' | 'hmac-auth' | 'ldap-auth' | 'mtls-auth';
  key?: string;
  secret?: string;
  algorithm?: string;
  rsa_public_key?: string;
  rsaPublicKey?: string; // For backward compatibility
  consumer?: string;
  created_at?: number;
  // Additional fields for different credential types
  [key: string]: any;
}

export interface KongPlugin {
  id: string;
  name: string;
  instance_name?: string;
  enabled?: boolean;
  config?: Record<string, any>;
  protocols?: ('http' | 'https' | 'grpc' | 'grpcs' | 'tcp' | 'tls')[];
  service?: string;
  route?: string;
  consumer?: string;
  consumer_group?: string;
  tags?: string[];
  ordering?: {
    before?: string[];
    after?: string[];
  };
  run_on?: 'first' | 'second' | 'all';
  created_at?: number;
}

export interface KongRequest {
  path: string;
  method: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  consumerId?: string;
  apiKey?: string;
}

export interface KongResponse {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
  latency?: number;
  error?: string;
}

export interface RouteMatch {
  route: KongRoute;
  service: KongService;
  matchedPath: string;
  remainingPath: string;
}

/**
 * Kong Gateway Routing Engine
 * Simulates Kong Gateway request routing behavior
 */
export class KongRoutingEngine {
  private services: Map<string, KongService> = new Map();
  private routes: Map<string, KongRoute> = new Map();
  private upstreams: Map<string, KongUpstream> = new Map();
  private consumers: Map<string, KongConsumer> = new Map();
  private plugins: KongPlugin[] = [];
  
  // Load balancing state
  private roundRobinCounters: Map<string, number> = new Map(); // upstream -> counter
  private connectionCounts: Map<string, number> = new Map(); // target -> connection count
  private consistentHashRing: Map<string, string[]> = new Map(); // upstream -> sorted targets
  
  // Rate limiting state
  private rateLimitCounters: Map<string, Map<string, { count: number; resetAt: number }>> = new Map(); // plugin -> consumer/service/route -> counter
  
  // Health check state
  private healthCheckTimers: Map<string, NodeJS.Timeout> = new Map(); // upstream -> timer
  private targetHealthStatus: Map<string, 'healthy' | 'unhealthy' | 'draining'> = new Map(); // target -> status
  private targetHealthCounters: Map<string, { successes: number; failures: number; lastCheck: number }> = new Map(); // target -> counters
  
  // Circuit breaker state
  private circuitBreakerState: Map<string, 'closed' | 'open' | 'half-open'> = new Map(); // target -> state
  private circuitBreakerCounters: Map<string, { failures: number; successes: number; lastFailure: number; openedAt: number }> = new Map(); // target -> counters
  private readonly CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5; // Open circuit after 5 failures
  private readonly CIRCUIT_BREAKER_SUCCESS_THRESHOLD = 2; // Close circuit after 2 successes
  private readonly CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 seconds before trying half-open
  
  /**
   * Initialize with Kong configuration
   */
  public initialize(config: {
    services?: KongService[];
    routes?: KongRoute[];
    upstreams?: KongUpstream[];
    consumers?: KongConsumer[];
    plugins?: KongPlugin[];
  }) {
    // Clear previous state
    // Stop all health check timers
    for (const timer of this.healthCheckTimers.values()) {
      clearInterval(timer);
    }
    this.healthCheckTimers.clear();
    
    this.services.clear();
    this.routes.clear();
    this.upstreams.clear();
    this.consumers.clear();
    this.plugins = [];
    this.roundRobinCounters.clear();
    this.connectionCounts.clear();
    this.consistentHashRing.clear();
    this.rateLimitCounters.clear();
    this.targetHealthStatus.clear();
    this.targetHealthCounters.clear();
    this.circuitBreakerState.clear();
    this.circuitBreakerCounters.clear();

    // Initialize services
    if (config.services) {
      for (const service of config.services) {
        this.services.set(service.id, { ...service });
      }
    }

    // Initialize routes
    if (config.routes) {
      for (const route of config.routes) {
        this.routes.set(route.id, { ...route });
      }
    }

    // Initialize upstreams
    if (config.upstreams) {
      for (const upstream of config.upstreams) {
        this.upstreams.set(upstream.name, { ...upstream });
        this.roundRobinCounters.set(upstream.name, 0);
        
        // Initialize health status for targets
        if (upstream.targets) {
          for (const target of upstream.targets) {
            const targetKey = `${upstream.name}:${target.target}`;
            this.targetHealthStatus.set(targetKey, target.health || 'healthy');
            this.targetHealthCounters.set(targetKey, {
              successes: 0,
              failures: 0,
              lastCheck: Date.now(),
            });
          }
        }
        
        // Start health checks if configured
        if (upstream.healthchecks?.active) {
          this.startActiveHealthChecks(upstream);
        }
        
        // Build consistent hash ring if needed
        if (upstream.algorithm === 'consistent-hashing' && upstream.targets) {
          const sortedTargets = [...upstream.targets]
            .filter(t => {
              const targetKey = `${upstream.name}:${t.target}`;
              const status = this.targetHealthStatus.get(targetKey) || t.health || 'healthy';
              return status === 'healthy';
            })
            .sort((a, b) => a.target.localeCompare(b.target));
          this.consistentHashRing.set(upstream.name, sortedTargets.map(t => t.target));
        }
      }
    }

    // Initialize consumers
    if (config.consumers) {
      for (const consumer of config.consumers) {
        this.consumers.set(consumer.id, { ...consumer });
      }
    }

    // Initialize plugins
    if (config.plugins) {
      this.plugins = config.plugins.filter(p => p.enabled);
    }
  }

  /**
   * Update configuration without full reinitialization
   * Preserves state (counters, connections, etc.)
   */
  public updateConfig(config: {
    services?: KongService[];
    routes?: KongRoute[];
    upstreams?: KongUpstream[];
    consumers?: KongConsumer[];
    plugins?: KongPlugin[];
  }): void {
    // Update services
    if (config.services !== undefined) {
      // Remove services that are no longer in config
      const newServiceIds = new Set(config.services.map(s => s.id));
      for (const [id] of this.services) {
        if (!newServiceIds.has(id)) {
          this.services.delete(id);
        }
      }
      // Add or update services
      for (const service of config.services) {
        this.services.set(service.id, { ...service });
      }
    }

    // Update routes
    if (config.routes !== undefined) {
      // Remove routes that are no longer in config
      const newRouteIds = new Set(config.routes.map(r => r.id));
      for (const [id] of this.routes) {
        if (!newRouteIds.has(id)) {
          this.routes.delete(id);
        }
      }
      // Add or update routes
      for (const route of config.routes) {
        this.routes.set(route.id, { ...route });
      }
    }

    // Update upstreams
    if (config.upstreams !== undefined) {
      // Remove upstreams that are no longer in config
      const newUpstreamNames = new Set(config.upstreams.map(u => u.name));
      for (const [name] of this.upstreams) {
        if (!newUpstreamNames.has(name)) {
          this.upstreams.delete(name);
          this.roundRobinCounters.delete(name);
          this.consistentHashRing.delete(name);
        }
      }
      // Add or update upstreams
      for (const upstream of config.upstreams) {
        const existing = this.upstreams.get(upstream.name);
        this.upstreams.set(upstream.name, { ...upstream });
        
        // Initialize counter if new upstream
        if (!existing) {
          this.roundRobinCounters.set(upstream.name, 0);
        }
        
        // Rebuild consistent hash ring if needed
        if (upstream.algorithm === 'consistent-hashing' && upstream.targets) {
          const sortedTargets = [...upstream.targets]
            .filter(t => {
              const targetKey = `${upstream.name}:${t.target}`;
              const status = this.targetHealthStatus.get(targetKey) || t.health || 'healthy';
              return status === 'healthy';
            })
            .sort((a, b) => a.target.localeCompare(b.target));
          this.consistentHashRing.set(upstream.name, sortedTargets.map(t => t.target));
        }
        
        // Start health checks if configured
        if (upstream.healthchecks?.active) {
          this.startActiveHealthChecks(upstream);
        }
      }
    }

    // Update consumers
    if (config.consumers !== undefined) {
      // Remove consumers that are no longer in config
      const newConsumerIds = new Set(config.consumers.map(c => c.id));
      for (const [id] of this.consumers) {
        if (!newConsumerIds.has(id)) {
          this.consumers.delete(id);
        }
      }
      // Add or update consumers
      for (const consumer of config.consumers) {
        this.consumers.set(consumer.id, { ...consumer });
      }
    }

    // Update plugins
    if (config.plugins !== undefined) {
      this.plugins = config.plugins.filter(p => p.enabled);
      // Clear rate limit counters for removed plugins
      const pluginIds = new Set(config.plugins.map(p => p.id));
      for (const [pluginId] of this.rateLimitCounters) {
        if (!pluginIds.has(pluginId)) {
          this.rateLimitCounters.delete(pluginId);
        }
      }
    }
  }

  /**
   * Route a request through Kong Gateway
   */
  public routeRequest(request: KongRequest): {
    match: RouteMatch | null;
    response: KongResponse;
    target?: string;
  } {
    const startTime = Date.now();
    
    // Step 1: Match route
    const match = this.matchRoute(request);
    if (!match) {
      return {
        match: null,
        response: {
          status: 404,
          error: 'No route matched',
          latency: Date.now() - startTime,
        },
      };
    }

    // Step 2: Execute plugins (access phase)
    const pluginResult = this.executePlugins(request, match, 'access');
    if (pluginResult.blocked) {
      return {
        match,
        response: {
          status: pluginResult.status || 403,
          error: pluginResult.error || 'Request blocked by plugin',
          latency: Date.now() - startTime,
        },
      };
    }

    // Step 3: Resolve upstream target
    // Check circuit breaker timeouts before selecting target
    const upstreamName = match.service.upstream || match.service.name;
    const upstream = this.upstreams.get(upstreamName);
    if (upstream && upstream.targets) {
      for (const target of upstream.targets) {
        this.checkCircuitBreakerTimeout(target.target);
      }
    }
    
    const target = this.selectUpstreamTarget(match.service);
    if (!target) {
      return {
        match,
        response: {
          status: 503,
          error: 'No healthy upstream target available',
          latency: Date.now() - startTime,
        },
      };
    }

    // Check if target circuit breaker is open
    const circuitState = this.circuitBreakerState.get(target);
    if (circuitState === 'open') {
      return {
        match,
        response: {
          status: 503,
          error: 'Circuit breaker is open',
          latency: Date.now() - startTime,
        },
      };
    }

    // Step 4: Apply path transformation (strip path)
    const finalPath = this.transformPath(request.path, match);

    // Step 5: Execute request with retry logic and timeout handling
    const service = match.service;
    const retries = service.retries || 0;
    const connectTimeout = service.connect_timeout || 60000; // Default 60s
    const writeTimeout = service.write_timeout || 60000; // Default 60s
    const readTimeout = service.read_timeout || 60000; // Default 60s

    let lastResponse: KongResponse | null = null;
    let lastError: string | null = null;

    // Retry loop (simulated synchronously)
    for (let attempt = 0; attempt <= retries; attempt++) {
      // Simulate request with timeout handling
      const requestStartTime = Date.now();
      let response: KongResponse;
      let timedOut = false;
      let timeoutType: 'connect' | 'write' | 'read' | null = null;

      // Simulate connect timeout
      const connectLatency = Math.random() * (connectTimeout * 2);
      if (connectLatency > connectTimeout) {
        timedOut = true;
        timeoutType = 'connect';
        response = {
          status: 504,
          latency: Date.now() - startTime + connectTimeout,
          error: 'Connection timeout',
        };
      } else {
        // Simulate write timeout (if applicable)
        const writeLatency = Math.random() * (writeTimeout * 2);
        if (writeLatency > writeTimeout) {
          timedOut = true;
          timeoutType = 'write';
          response = {
            status: 504,
            latency: Date.now() - startTime + writeTimeout,
            error: 'Write timeout',
          };
        } else {
          // Simulate upstream latency (read phase)
          const upstreamLatency = this.simulateUpstreamLatency(target);
          if (upstreamLatency > readTimeout) {
            timedOut = true;
            timeoutType = 'read';
            response = {
              status: 504,
              latency: Date.now() - startTime + readTimeout,
              error: 'Read timeout',
            };
          } else {
            // Simulate successful response
            const totalLatency = Date.now() - startTime + upstreamLatency;
            const isError = Math.random() < 0.05; // 5% error rate
            response = {
              status: isError ? 500 : 200,
              latency: totalLatency,
              error: isError ? 'Internal server error' : undefined,
            };
          }
        }
      }

      lastResponse = response;

      // Check if we should retry
      const shouldRetry = attempt < retries && (
        response.status >= 500 || // Server errors
        response.status === 504 || // Gateway timeout
        timedOut
      );

      if (!shouldRetry) {
        break;
      }

      lastError = response.error || 'Request failed';
      // Simulate retry delay (add to latency)
      if (lastResponse) {
        lastResponse.latency = (lastResponse.latency || 0) + (100 * (attempt + 1));
      }
    }

    // Use the last response (after all retries)
    const finalResponse = lastResponse || {
      status: 500,
      latency: Date.now() - startTime,
      error: lastError || 'Request failed after retries',
    };

    // Record passive health check result
    const upstreamNameForHealth = match.service.upstream || match.service.name;
    const upstreamForHealth = this.upstreams.get(upstreamNameForHealth);
    if (upstreamForHealth && upstreamForHealth.healthchecks?.passive) {
      const isSuccess = finalResponse.status >= 200 && finalResponse.status < 500;
      this.recordPassiveHealthCheck(upstreamNameForHealth, target, isSuccess);
    }

    // Update circuit breaker based on response
    const isSuccess = finalResponse.status >= 200 && finalResponse.status < 500;
    this.updateCircuitBreaker(target, isSuccess);

    return {
      match,
      response: finalResponse,
      target,
    };
  }

  /**
   * Match request to a route
   */
  private matchRoute(request: KongRequest): RouteMatch | null {
    // Sort routes by priority (higher priority first)
    const sortedRoutes = Array.from(this.routes.values())
      .sort((a, b) => (b.regex_priority || b.priority || 0) - (a.regex_priority || a.priority || 0));

    for (const route of sortedRoutes) {
      // Check method match
      const methods = route.methods || (route.method ? [route.method] : []);
      if (methods.length > 0 && !methods.some(m => m.toUpperCase() === request.method.toUpperCase())) {
        continue;
      }

      // Check path match
      const paths = route.paths || (route.path ? [route.path] : []);
      let pathMatch: { matched: string; remaining: string } | null = null;
      for (const path of paths) {
        pathMatch = this.matchPath(path, request.path);
        if (pathMatch) break;
      }

      if (pathMatch) {
        const service = this.services.get(route.service);
        if (!service || service.enabled === false) {
          continue;
        }

        return {
          route,
          service,
          matchedPath: pathMatch.matched,
          remainingPath: pathMatch.remaining,
        };
      }
    }

    return null;
  }

  /**
   * Match path pattern (supports prefix and regex patterns)
   */
  private matchPath(pattern: string, path: string): { matched: string; remaining: string } | null {
    // Simple prefix matching (Kong supports more complex patterns)
    if (path.startsWith(pattern)) {
      return {
        matched: pattern,
        remaining: path.substring(pattern.length),
      };
    }

    // Try regex pattern
    try {
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(path)) {
        return {
          matched: path,
          remaining: '',
        };
      }
    } catch (e) {
      // Invalid regex, ignore
    }

    return null;
  }

  /**
   * Select upstream target using load balancing algorithm
   */
  private selectUpstreamTarget(service: KongService): string | null {
    const upstreamName = service.upstream || service.name;
    const upstream = this.upstreams.get(upstreamName);
    
    if (!upstream || !upstream.targets || upstream.targets.length === 0) {
      // Fallback to service URL or build from service config
      if (service.url) {
        return service.url;
      }
      if (service.host && service.port) {
        const protocol = service.protocol || 'http';
        const path = service.path || '';
        return `${protocol}://${service.host}:${service.port}${path}`;
      }
      return null;
    }

    // Filter healthy targets (use health status from health checks and circuit breaker)
    const healthyTargets = upstream.targets.filter(t => {
      const targetKey = `${upstreamName}:${t.target}`;
      const healthStatus = this.targetHealthStatus.get(targetKey) || t.health || 'healthy';
      const circuitState = this.circuitBreakerState.get(t.target) || 'closed';
      
      // Circuit breaker must be closed or half-open
      if (circuitState === 'open') {
        return false;
      }
      
      return healthStatus === 'healthy';
    });
    if (healthyTargets.length === 0) {
      return null;
    }

    const algorithm = upstream.algorithm || 'round-robin';

    switch (algorithm) {
      case 'round-robin':
        return this.selectRoundRobin(upstreamName, healthyTargets);
      
      case 'consistent-hashing':
        return this.selectConsistentHash(upstreamName, healthyTargets, service.name);
      
      case 'least-connections':
        return this.selectLeastConnections(healthyTargets);
      
      default:
        return healthyTargets[0].target;
    }
  }

  /**
   * Round-robin selection
   */
  private selectRoundRobin(upstreamName: string, targets: KongUpstreamTarget[]): string {
    const counter = this.roundRobinCounters.get(upstreamName) || 0;
    const target = targets[counter % targets.length];
    this.roundRobinCounters.set(upstreamName, (counter + 1) % targets.length);
    return target.target;
  }

  /**
   * Consistent hashing selection
   */
  private selectConsistentHash(upstreamName: string, targets: KongUpstreamTarget[], key: string): string {
    // Simple consistent hashing based on key
    const hash = this.simpleHash(key);
    const index = hash % targets.length;
    return targets[index].target;
  }

  /**
   * Least connections selection
   */
  private selectLeastConnections(targets: KongUpstreamTarget[]): string {
    let minConnections = Infinity;
    let selectedTarget = targets[0].target;

    for (const target of targets) {
      const connections = this.connectionCounts.get(target.target) || 0;
      if (connections < minConnections) {
        minConnections = connections;
        selectedTarget = target.target;
      }
    }

    // Increment connection count
    const current = this.connectionCounts.get(selectedTarget) || 0;
    this.connectionCounts.set(selectedTarget, current + 1);

    return selectedTarget;
  }

  /**
   * Simple hash function for consistent hashing
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
   * Transform path based on route configuration
   */
  private transformPath(originalPath: string, match: RouteMatch): string {
    const stripPath = match.route.strip_path !== undefined ? match.route.strip_path : match.route.stripPath;
    if (stripPath) {
      return match.remainingPath || '/';
    }
    return originalPath;
  }

  /**
   * Execute plugins in access phase
   */
  private executePlugins(request: KongRequest, match: RouteMatch, phase: 'access' | 'response'): {
    blocked: boolean;
    status?: number;
    error?: string;
  } {
    // Get plugins for this route/service
    const applicablePlugins = this.plugins.filter(p => {
      if (p.route && p.route !== match.route.id) return false;
      if (p.service && p.service !== match.service.id) return false;
      return true;
    });

    for (const plugin of applicablePlugins) {
      const result = this.executePlugin(plugin, request, match, phase);
      if (result.blocked) {
        return result;
      }
    }

    return { blocked: false };
  }

  /**
   * Execute a single plugin
   */
  private executePlugin(
    plugin: KongPlugin,
    request: KongRequest,
    match: RouteMatch,
    phase: 'access' | 'response'
  ): {
    blocked: boolean;
    status?: number;
    error?: string;
  } {
    const config = plugin.config || {};

    switch (plugin.name) {
      case 'rate-limiting':
        return this.executeRateLimiting(plugin, request, match, config);
      
      case 'key-auth':
        return this.executeKeyAuth(plugin, request, match, config);
      
      case 'jwt':
        return this.executeJWT(plugin, request, match, config);
      
      case 'cors':
        // CORS is handled in response phase, not blocking
        return { blocked: false };
      
      case 'ip-restriction':
        return this.executeIPRestriction(plugin, request, match, config);
      
      default:
        return { blocked: false };
    }
  }

  /**
   * Execute rate limiting plugin
   */
  private executeRateLimiting(
    plugin: KongPlugin,
    request: KongRequest,
    match: RouteMatch,
    config: Record<string, any>
  ): { blocked: boolean; status?: number; error?: string } {
    const identifier = request.consumerId || match.service.id || match.route.id;
    const now = Date.now();
    
    // Get or create counter
    let pluginCounters = this.rateLimitCounters.get(plugin.id);
    if (!pluginCounters) {
      pluginCounters = new Map();
      this.rateLimitCounters.set(plugin.id, pluginCounters);
    }

    let counter = pluginCounters.get(identifier);
    if (!counter || counter.resetAt < now) {
      counter = { count: 0, resetAt: now + 60000 }; // Reset every minute
      pluginCounters.set(identifier, counter);
    }

    // Check limits
    const minuteLimit = config.minute || 1000;
    const hourLimit = config.hour || 10000;

    counter.count++;
    
    if (counter.count > minuteLimit) {
      return {
        blocked: true,
        status: 429,
        error: 'Rate limit exceeded (per minute)',
      };
    }

    return { blocked: false };
  }

  /**
   * Execute key-auth plugin
   */
  private executeKeyAuth(
    plugin: KongPlugin,
    request: KongRequest,
    match: RouteMatch,
    config: Record<string, any>
  ): { blocked: boolean; status?: number; error?: string } {
    const keyNames = config.key_names || ['apikey'];
    const apiKey = request.apiKey || request.headers?.[keyNames[0]] || request.query?.[keyNames[0]];

    if (!apiKey) {
      return {
        blocked: true,
        status: 401,
        error: 'API key required',
      };
    }

    // Check if consumer exists with this key
    const consumer = Array.from(this.consumers.values()).find(c => {
      return c.credentials?.some(cred => cred.type === 'key-auth' && cred.key === apiKey);
    });

    if (!consumer) {
      return {
        blocked: true,
        status: 401,
        error: 'Invalid API key',
      };
    }

    return { blocked: false };
  }

  /**
   * Execute JWT plugin
   */
  private executeJWT(
    plugin: KongPlugin,
    request: KongRequest,
    match: RouteMatch,
    config: Record<string, any>
  ): { blocked: boolean; status?: number; error?: string } {
    // Simplified JWT validation - in real Kong, this would verify signature
    const authHeader = request.headers?.['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        blocked: true,
        status: 401,
        error: 'JWT token required',
      };
    }

    // In real implementation, would verify JWT signature and claims
    return { blocked: false };
  }

  /**
   * Execute IP restriction plugin
   */
  private executeIPRestriction(
    plugin: KongPlugin,
    request: KongRequest,
    match: RouteMatch,
    config: Record<string, any>
  ): { blocked: boolean; status?: number; error?: string } {
    const clientIP = request.headers?.['X-Forwarded-For'] || request.headers?.['X-Real-IP'] || 'unknown';
    const whitelist = config.whitelist || [];
    const blacklist = config.blacklist || [];

    if (blacklist.includes(clientIP)) {
      return {
        blocked: true,
        status: 403,
        error: 'IP address blocked',
      };
    }

    if (whitelist.length > 0 && !whitelist.includes(clientIP)) {
      return {
        blocked: true,
        status: 403,
        error: 'IP address not whitelisted',
      };
    }

    return { blocked: false };
  }

  /**
   * Simulate upstream latency
   */
  private simulateUpstreamLatency(target: string): number {
    // Base latency 10-50ms, but can be higher for unhealthy targets
    const baseLatency = 10 + Math.random() * 40;
    // Add extra latency if target is unhealthy (simulate slow responses)
    const isUnhealthy = Math.random() < 0.1; // 10% chance of being slow
    return baseLatency + (isUnhealthy ? 50 + Math.random() * 100 : 0);
  }

  /**
   * Start active health checks for an upstream
   */
  private startActiveHealthChecks(upstream: KongUpstream): void {
    // Stop existing timer if any
    const existingTimer = this.healthCheckTimers.get(upstream.name);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    const healthchecks = upstream.healthchecks?.active;
    if (!healthchecks || !upstream.targets) {
      return;
    }

    const interval = healthchecks.healthy?.interval || 10000; // Default 10 seconds
    const timeout = healthchecks.timeout || 1000; // Default 1 second

    const timer = setInterval(() => {
      for (const target of upstream.targets || []) {
        const targetKey = `${upstream.name}:${target.target}`;
        this.performActiveHealthCheck(upstream, target, targetKey, healthchecks, timeout);
      }
    }, interval);

    this.healthCheckTimers.set(upstream.name, timer);
  }

  /**
   * Perform active health check for a target
   */
  private performActiveHealthCheck(
    upstream: KongUpstream,
    target: KongUpstreamTarget,
    targetKey: string,
    config: KongUpstream['healthchecks']!['active']!,
    timeout: number
  ): void {
    // Simulate health check request
    const startTime = Date.now();
    const isHealthy = Math.random() > 0.05; // 95% success rate by default
    const latency = Math.random() * timeout;
    const timedOut = latency > timeout;

    const counters = this.targetHealthCounters.get(targetKey) || {
      successes: 0,
      failures: 0,
      lastCheck: Date.now(),
    };

    if (timedOut || !isHealthy) {
      counters.failures++;
      // Check if target should be marked unhealthy
      const unhealthyThreshold = config.unhealthy?.timeouts || 0;
      if (counters.failures >= unhealthyThreshold) {
        this.targetHealthStatus.set(targetKey, 'unhealthy');
        // Update target in upstream
        if (target.health !== 'unhealthy') {
          target.health = 'unhealthy';
        }
      }
    } else {
      counters.successes++;
      // Check if target should be marked healthy
      const healthyThreshold = config.healthy?.successes || 1;
      if (counters.successes >= healthyThreshold) {
        this.targetHealthStatus.set(targetKey, 'healthy');
        if (target.health !== 'healthy') {
          target.health = 'healthy';
        }
        // Reset failure counter
        counters.failures = 0;
      }
    }

    counters.lastCheck = Date.now();
    this.targetHealthCounters.set(targetKey, counters);
  }

  /**
   * Record passive health check result (from actual request)
   */
  public recordPassiveHealthCheck(upstreamName: string, target: string, success: boolean): void {
    const upstream = this.upstreams.get(upstreamName);
    if (!upstream || !upstream.healthchecks?.passive) {
      return;
    }

    const targetKey = `${upstreamName}:${target}`;
    const counters = this.targetHealthCounters.get(targetKey) || {
      successes: 0,
      failures: 0,
      lastCheck: Date.now(),
    };

    const passiveConfig = upstream.healthchecks.passive;

    if (success) {
      counters.successes++;
      const healthyThreshold = passiveConfig.healthy?.successes || 1;
      if (counters.successes >= healthyThreshold) {
        this.targetHealthStatus.set(targetKey, 'healthy');
        // Update target in upstream
        const targetObj = upstream.targets?.find(t => t.target === target);
        if (targetObj && targetObj.health !== 'healthy') {
          targetObj.health = 'healthy';
        }
        counters.failures = 0;
      }
    } else {
      counters.failures++;
      const unhealthyThreshold = passiveConfig.unhealthy?.http_failures || passiveConfig.unhealthy?.tcp_failures || 0;
      if (counters.failures >= unhealthyThreshold) {
        this.targetHealthStatus.set(targetKey, 'unhealthy');
        // Update target in upstream
        const targetObj = upstream.targets?.find(t => t.target === target);
        if (targetObj && targetObj.health !== 'unhealthy') {
          targetObj.health = 'unhealthy';
        }
      }
    }

    counters.lastCheck = Date.now();
    this.targetHealthCounters.set(targetKey, counters);
  }

  /**
   * Get routing statistics
   */
  public getStats(): {
    services: number;
    routes: number;
    upstreams: number;
    consumers: number;
    plugins: number;
  } {
    return {
      services: this.services.size,
      routes: this.routes.size,
      upstreams: this.upstreams.size,
      consumers: this.consumers.size,
      plugins: this.plugins.length,
    };
  }
}


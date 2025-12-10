/**
 * Kong Gateway Routing Engine
 * Handles request routing through services, routes, and upstreams with load balancing
 */

export interface KongService {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  upstream?: string;
  routes?: string[];
}

export interface KongRoute {
  id: string;
  path: string;
  method: string;
  service: string;
  stripPath: boolean;
  protocols?: string[];
  priority?: number;
}

export interface KongUpstream {
  id: string;
  name: string;
  algorithm?: 'round-robin' | 'consistent-hashing' | 'least-connections';
  healthchecks?: {
    active?: boolean;
    passive?: boolean;
  };
  targets?: KongUpstreamTarget[];
}

export interface KongUpstreamTarget {
  target: string; // host:port
  weight?: number;
  health?: 'healthy' | 'unhealthy' | 'draining';
}

export interface KongConsumer {
  id: string;
  username: string;
  customId?: string;
  credentials?: KongConsumerCredential[];
}

export interface KongConsumerCredential {
  type: 'key-auth' | 'jwt' | 'oauth2' | 'basic-auth';
  key?: string;
  secret?: string;
  algorithm?: string;
  rsaPublicKey?: string;
}

export interface KongPlugin {
  id: string;
  name: string;
  enabled: boolean;
  service?: string;
  route?: string;
  consumer?: string;
  config?: Record<string, any>;
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
    this.services.clear();
    this.routes.clear();
    this.upstreams.clear();
    this.consumers.clear();
    this.plugins = [];
    this.roundRobinCounters.clear();
    this.connectionCounts.clear();
    this.consistentHashRing.clear();
    this.rateLimitCounters.clear();

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
        
        // Build consistent hash ring if needed
        if (upstream.algorithm === 'consistent-hashing' && upstream.targets) {
          const sortedTargets = [...upstream.targets]
            .filter(t => t.health === 'healthy')
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

    // Step 4: Apply path transformation (strip path)
    const finalPath = this.transformPath(request.path, match);

    // Step 5: Execute plugins (response phase - simplified)
    const response: KongResponse = {
      status: 200,
      latency: Date.now() - startTime,
    };

    // Simulate upstream latency
    response.latency = (response.latency || 0) + this.simulateUpstreamLatency(target);

    return {
      match,
      response,
      target,
    };
  }

  /**
   * Match request to a route
   */
  private matchRoute(request: KongRequest): RouteMatch | null {
    // Sort routes by priority (higher priority first)
    const sortedRoutes = Array.from(this.routes.values())
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const route of sortedRoutes) {
      // Check method match
      if (route.method && route.method.toUpperCase() !== request.method.toUpperCase()) {
        continue;
      }

      // Check path match
      const pathMatch = this.matchPath(route.path, request.path);
      if (pathMatch) {
        const service = this.services.get(route.service);
        if (!service || !service.enabled) {
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
      // Fallback to service URL
      return service.url;
    }

    // Filter healthy targets
    const healthyTargets = upstream.targets.filter(t => t.health === 'healthy');
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
    if (match.route.stripPath) {
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
    // Base latency 10-50ms
    return 10 + Math.random() * 40;
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


/**
 * NGINX Routing Engine
 * Handles request routing through server blocks, locations, and upstreams with load balancing
 */

export interface NginxLocation {
  path: string;
  proxyPass?: string;
  method?: 'proxy' | 'static' | 'fastcgi' | 'uwsgi' | 'scgi' | 'grpc';
  upstream?: string;
  rateLimit?: {
    zone: string;
    rate: string;
    burst?: number;
    nodelay?: boolean;
  };
  cache?: {
    enabled: boolean;
    key?: string;
    valid?: string;
  };
  headers?: Record<string, string>;
  rewrite?: {
    pattern: string;
    replacement: string;
    flag?: 'last' | 'break' | 'redirect' | 'permanent';
  }[];
}

export interface NginxUpstream {
  name: string;
  servers: NginxUpstreamServer[];
  method?: 'round-robin' | 'least_conn' | 'ip_hash' | 'hash';
  keepalive?: number;
  keepaliveRequests?: number;
  keepaliveTimeout?: string;
}

export interface NginxUpstreamServer {
  address: string; // host:port or host
  weight?: number;
  maxFails?: number;
  failTimeout?: string;
  backup?: boolean;
  down?: boolean;
  health?: 'healthy' | 'unhealthy' | 'checking';
}

export interface NginxRateLimitZone {
  name: string;
  size: string; // e.g., "10m"
  rate: string; // e.g., "10r/s", "5r/m"
}

export interface NginxSSLCertificate {
  name: string;
  certPath: string;
  keyPath: string;
  domain?: string;
}

export interface NginxRequest {
  path: string;
  method: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  clientIP?: string;
  protocol?: 'http' | 'https';
}

export interface NginxResponse {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
  latency?: number;
  error?: string;
  cacheHit?: boolean;
  upstreamTarget?: string;
}

export interface LocationMatch {
  location: NginxLocation;
  matchedPath: string;
  remainingPath: string;
  priority: number;
}

/**
 * NGINX Routing Engine
 * Simulates NGINX request routing behavior
 */
export class NginxRoutingEngine {
  private locations: NginxLocation[] = [];
  private upstreams: Map<string, NginxUpstream> = new Map();
  private rateLimitZones: Map<string, NginxRateLimitZone> = new Map();
  private sslCertificates: Map<string, NginxSSLCertificate> = new Map();
  
  // Load balancing state
  private roundRobinCounters: Map<string, number> = new Map(); // upstream -> counter
  private connectionCounts: Map<string, number> = new Map(); // server -> connection count
  private ipHashMap: Map<string, string> = new Map(); // IP -> server mapping
  private hashRing: Map<string, string[]> = new Map(); // upstream -> sorted servers
  
  // Rate limiting state
  private rateLimitCounters: Map<string, Map<string, { count: number; resetAt: number; burst: number }>> = new Map(); // zone -> key -> counter
  
  // Cache state
  private cache: Map<string, { data: unknown; expiresAt: number }> = new Map();
  
  // SSL/TLS state
  private enableSSL: boolean = false;
  private sslPort: number = 443;
  
  // Performance settings
  private enableGzip: boolean = true;
  private enableCache: boolean = true;
  private maxWorkers: number = 4;
  
  // Statistics
  private requestCount: number = 0;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private rateLimitBlocks: number = 0;

  /**
   * Initialize with NGINX configuration
   */
  public initialize(config: {
    locations?: NginxLocation[];
    upstreams?: NginxUpstream[];
    rateLimitZones?: NginxRateLimitZone[];
    sslCertificates?: NginxSSLCertificate[];
    enableSSL?: boolean;
    sslPort?: number;
    enableGzip?: boolean;
    enableCache?: boolean;
    maxWorkers?: number;
  }) {
    // Clear previous state
    this.locations = [];
    this.upstreams.clear();
    this.rateLimitZones.clear();
    this.sslCertificates.clear();
    this.roundRobinCounters.clear();
    this.connectionCounts.clear();
    this.ipHashMap.clear();
    this.hashRing.clear();
    this.rateLimitCounters.clear();
    this.cache.clear();

    // Initialize locations (sorted by path length for proper matching)
    if (config.locations) {
      this.locations = [...config.locations].sort((a, b) => {
        // Longer paths first (more specific), then by path
        if (b.path.length !== a.path.length) {
          return b.path.length - a.path.length;
        }
        return a.path.localeCompare(b.path);
      });
    }

    // Initialize upstreams
    if (config.upstreams) {
      for (const upstream of config.upstreams) {
        this.upstreams.set(upstream.name, { ...upstream });
        this.roundRobinCounters.set(upstream.name, 0);
        
        // Build hash ring for hash method
        if (upstream.method === 'hash' && upstream.servers) {
          const sortedServers = [...upstream.servers]
            .filter(s => !s.down && s.health !== 'unhealthy')
            .sort((a, b) => a.address.localeCompare(b.address));
          this.hashRing.set(upstream.name, sortedServers.map(s => s.address));
        }
      }
    }

    // Initialize rate limit zones
    if (config.rateLimitZones) {
      for (const zone of config.rateLimitZones) {
        this.rateLimitZones.set(zone.name, { ...zone });
      }
    }

    // Initialize SSL certificates
    if (config.sslCertificates) {
      for (const cert of config.sslCertificates) {
        this.sslCertificates.set(cert.name, { ...cert });
      }
    }

    // Initialize settings
    this.enableSSL = config.enableSSL ?? false;
    this.sslPort = config.sslPort || 443;
    this.enableGzip = config.enableGzip ?? true;
    this.enableCache = config.enableCache ?? true;
    this.maxWorkers = config.maxWorkers || 4;
  }

  /**
   * Route a request through NGINX
   */
  public routeRequest(request: NginxRequest): {
    match: LocationMatch | null;
    response: NginxResponse;
    upstreamTarget?: string;
  } {
    const startTime = Date.now();
    this.requestCount++;

    // Step 1: Check SSL redirect if needed
    if (!this.enableSSL && request.protocol === 'https') {
      return {
        match: null,
        response: {
          status: 400,
          error: 'HTTPS not enabled',
          latency: Date.now() - startTime,
        },
      };
    }

    // Step 2: Match location
    const match = this.matchLocation(request);
    if (!match) {
      return {
        match: null,
        response: {
          status: 404,
          error: 'No location matched',
          latency: Date.now() - startTime,
        },
      };
    }

    // Step 3: Check rate limiting
    if (match.location.rateLimit) {
      const rateLimitResult = this.checkRateLimit(match.location.rateLimit, request);
      if (rateLimitResult.blocked) {
        this.rateLimitBlocks++;
        return {
          match,
          response: {
            status: 429,
            error: rateLimitResult.error || 'Rate limit exceeded',
            latency: Date.now() - startTime,
          },
        };
      }
    }

    // Step 4: Check cache (if enabled and method is GET)
    if (this.enableCache && match.location.cache?.enabled && request.method === 'GET') {
      const cacheKey = this.getCacheKey(request, match);
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        this.cacheHits++;
        return {
          match,
          response: {
            status: 200,
            body: cached.data,
            latency: Date.now() - startTime,
            cacheHit: true,
          },
        };
      }
      this.cacheMisses++;
    }

    // Step 5: Process based on location method
    let upstreamTarget: string | undefined;
    let response: NginxResponse;

    switch (match.location.method) {
      case 'proxy':
      case 'grpc':
        // Proxy to upstream
        upstreamTarget = this.selectUpstreamTarget(match.location, request);
        if (!upstreamTarget) {
          return {
            match,
            response: {
              status: 503,
              error: 'No healthy upstream server available',
              latency: Date.now() - startTime,
            },
          };
        }
        response = this.proxyRequest(request, match, upstreamTarget);
        break;

      case 'static':
        response = this.serveStatic(request, match);
        break;

      case 'fastcgi':
      case 'uwsgi':
      case 'scgi':
        upstreamTarget = this.selectUpstreamTarget(match.location, request);
        if (!upstreamTarget) {
          return {
            match,
            response: {
              status: 503,
              error: 'No upstream server available',
              latency: Date.now() - startTime,
            },
          };
        }
        response = this.processFastCGI(request, match, upstreamTarget);
        break;

      default:
        response = {
          status: 501,
          error: 'Method not implemented',
          latency: Date.now() - startTime,
        };
    }

    // Step 6: Apply response transformations
    if (this.enableGzip && this.shouldCompress(response)) {
      response.headers = {
        ...response.headers,
        'Content-Encoding': 'gzip',
      };
    }

    // Step 7: Cache response if applicable
    if (this.enableCache && match.location.cache?.enabled && request.method === 'GET' && response.status === 200) {
      const cacheKey = this.getCacheKey(request, match);
      const ttl = this.parseCacheValid(match.location.cache.valid || '1h');
      this.cache.set(cacheKey, {
        data: response.body,
        expiresAt: Date.now() + ttl,
      });
    }

    response.latency = Date.now() - startTime;
    response.upstreamTarget = upstreamTarget;

    return {
      match,
      response,
      upstreamTarget,
    };
  }

  /**
   * Match request to a location block
   */
  private matchLocation(request: NginxRequest): LocationMatch | null {
    for (const location of this.locations) {
      const pathMatch = this.matchPath(location.path, request.path);
      if (pathMatch) {
        return {
          location,
          matchedPath: pathMatch.matched,
          remainingPath: pathMatch.remaining,
          priority: this.getLocationPriority(location.path),
        };
      }
    }

    return null;
  }

  /**
   * Match path pattern (supports exact, prefix, regex, and location modifiers)
   */
  private matchPath(pattern: string, path: string): { matched: string; remaining: string } | null {
    // Remove location modifiers for matching
    const cleanPattern = pattern.replace(/^[=~*^]/, '');
    const modifier = pattern[0];

    switch (modifier) {
      case '=':
        // Exact match
        if (path === cleanPattern) {
          return { matched: path, remaining: '' };
        }
        break;

      case '~':
      case '~*':
        // Regex match (case sensitive or insensitive)
        try {
          const regex = new RegExp(cleanPattern, modifier === '~*' ? 'i' : '');
          if (regex.test(path)) {
            return { matched: path, remaining: '' };
          }
        } catch (e) {
          // Invalid regex
        }
        break;

      case '^~':
      case '*':
      default:
        // Prefix match
        if (path.startsWith(cleanPattern)) {
          return {
            matched: cleanPattern,
            remaining: path.substring(cleanPattern.length),
          };
        }
    }

    return null;
  }

  /**
   * Get location priority for sorting
   */
  private getLocationPriority(path: string): number {
    if (path.startsWith('=')) return 4; // Exact match
    if (path.startsWith('^~')) return 3; // Prefix match (no regex)
    if (path.startsWith('~') || path.startsWith('~*')) return 2; // Regex
    return 1; // Prefix match
  }

  /**
   * Select upstream target using load balancing algorithm
   */
  private selectUpstreamTarget(location: NginxLocation, request: NginxRequest): string | null {
    const upstreamName = location.upstream || this.extractUpstreamFromProxyPass(location.proxyPass);
    if (!upstreamName) {
      // Direct proxy_pass without upstream
      return location.proxyPass || null;
    }

    const upstream = this.upstreams.get(upstreamName);
    if (!upstream || !upstream.servers || upstream.servers.length === 0) {
      return null;
    }

    // Filter healthy servers
    const healthyServers = upstream.servers.filter(s => 
      !s.down && s.health !== 'unhealthy'
    );
    
    if (healthyServers.length === 0) {
      return null;
    }

    const method = upstream.method || 'round-robin';

    switch (method) {
      case 'round-robin':
        return this.selectRoundRobin(upstreamName, healthyServers);
      
      case 'least_conn':
        return this.selectLeastConnections(healthyServers);
      
      case 'ip_hash':
        return this.selectIPHash(upstreamName, healthyServers, request);
      
      case 'hash':
        return this.selectHash(upstreamName, healthyServers, request);
      
      default:
        return healthyServers[0].address;
    }
  }

  /**
   * Round-robin selection with weights
   */
  private selectRoundRobin(upstreamName: string, servers: NginxUpstreamServer[]): string {
    // Calculate total weight
    const totalWeight = servers.reduce((sum, s) => sum + (s.weight || 1), 0);
    
    // Get current counter
    let counter = this.roundRobinCounters.get(upstreamName) || 0;
    
    // Select server based on weighted round-robin
    let currentWeight = 0;
    for (const server of servers) {
      currentWeight += server.weight || 1;
      if (counter < currentWeight) {
        this.roundRobinCounters.set(upstreamName, (counter + 1) % totalWeight);
        return server.address;
      }
    }
    
    // Fallback
    this.roundRobinCounters.set(upstreamName, (counter + 1) % totalWeight);
    return servers[0].address;
  }

  /**
   * Least connections selection
   */
  private selectLeastConnections(servers: NginxUpstreamServer[]): string {
    let minConnections = Infinity;
    let selectedServer = servers[0].address;

    for (const server of servers) {
      const connections = this.connectionCounts.get(server.address) || 0;
      const weightedConnections = connections / (server.weight || 1);
      
      if (weightedConnections < minConnections) {
        minConnections = weightedConnections;
        selectedServer = server.address;
      }
    }

    // Increment connection count
    const current = this.connectionCounts.get(selectedServer) || 0;
    this.connectionCounts.set(selectedServer, current + 1);

    return selectedServer;
  }

  /**
   * IP hash selection
   */
  private selectIPHash(upstreamName: string, servers: NginxUpstreamServer[], request: NginxRequest): string {
    const clientIP = request.clientIP || request.headers?.['X-Real-IP'] || request.headers?.['X-Forwarded-For'] || '0.0.0.0';
    
    // Check if we already have a mapping for this IP
    const cached = this.ipHashMap.get(clientIP);
    if (cached && servers.some(s => s.address === cached)) {
      return cached;
    }

    // Calculate hash
    const hash = this.simpleHash(clientIP);
    const index = hash % servers.length;
    const selected = servers[index].address;
    
    // Cache mapping
    this.ipHashMap.set(clientIP, selected);
    
    return selected;
  }

  /**
   * Hash selection (consistent hashing)
   */
  private selectHash(upstreamName: string, servers: NginxUpstreamServer[], request: NginxRequest): string {
    const hashRing = this.hashRing.get(upstreamName);
    if (!hashRing || hashRing.length === 0) {
      return servers[0].address;
    }

    // Use request path as hash key
    const key = request.path;
    const hash = this.simpleHash(key);
    const index = hash % hashRing.length;
    
    return hashRing[index];
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
   * Extract upstream name from proxy_pass
   */
  private extractUpstreamFromProxyPass(proxyPass?: string): string | null {
    if (!proxyPass) return null;
    
    // Match pattern: http://upstream_name/...
    const match = proxyPass.match(/^https?:\/\/([^\/:]+)/);
    if (match && this.upstreams.has(match[1])) {
      return match[1];
    }
    
    return null;
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(rateLimit: { zone: string; rate: string; burst?: number; nodelay?: boolean }, request: NginxRequest): {
    blocked: boolean;
    error?: string;
  } {
    const zone = this.rateLimitZones.get(rateLimit.zone);
    if (!zone) {
      return { blocked: false };
    }

    // Parse rate (e.g., "10r/s", "5r/m")
    const rateMatch = zone.rate.match(/^(\d+)r\/([smhd])$/);
    if (!rateMatch) {
      return { blocked: false };
    }

    const limit = parseInt(rateMatch[1], 10);
    const period = rateMatch[2];
    const periodMs = this.getPeriodMs(period);

    // Get identifier (IP address or custom key)
    const identifier = request.clientIP || request.headers?.['X-Real-IP'] || 'default';

    // Get or create counter
    let zoneCounters = this.rateLimitCounters.get(rateLimit.zone);
    if (!zoneCounters) {
      zoneCounters = new Map();
      this.rateLimitCounters.set(rateLimit.zone, zoneCounters);
    }

    let counter = zoneCounters.get(identifier);
    const now = Date.now();

    if (!counter || counter.resetAt < now) {
      counter = {
        count: 0,
        resetAt: now + periodMs,
        burst: rateLimit.burst || 0,
      };
      zoneCounters.set(identifier, counter);
    }

    // Check limit
    const burst = rateLimit.burst || 0;
    const maxRequests = limit + burst;

    if (counter.count >= maxRequests) {
      return {
        blocked: true,
        error: `Rate limit exceeded: ${limit} requests per ${period}`,
      };
    }

    counter.count++;
    return { blocked: false };
  }

  /**
   * Get period in milliseconds
   */
  private getPeriodMs(period: string): number {
    switch (period) {
      case 's': return 1000;
      case 'm': return 60000;
      case 'h': return 3600000;
      case 'd': return 86400000;
      default: return 1000;
    }
  }

  /**
   * Proxy request to upstream
   */
  private proxyRequest(request: NginxRequest, match: LocationMatch, upstreamTarget: string): NginxResponse {
    // Simulate upstream latency (10-100ms)
    const upstreamLatency = 10 + Math.random() * 90;
    
    return {
      status: 200,
      body: { proxied: true, upstream: upstreamTarget },
      latency: upstreamLatency,
    };
  }

  /**
   * Serve static content
   */
  private serveStatic(request: NginxRequest, match: LocationMatch): NginxResponse {
    // Simulate file serving latency (1-5ms)
    const latency = 1 + Math.random() * 4;
    
    return {
      status: 200,
      body: { static: true, path: match.matchedPath },
      latency,
    };
  }

  /**
   * Process FastCGI/uWSGI/SCGI request
   */
  private processFastCGI(request: NginxRequest, match: LocationMatch, upstreamTarget: string): NginxResponse {
    // Simulate FastCGI processing latency (20-200ms)
    const latency = 20 + Math.random() * 180;
    
    return {
      status: 200,
      body: { processed: true, upstream: upstreamTarget },
      latency,
    };
  }

  /**
   * Get cache key
   */
  private getCacheKey(request: NginxRequest, match: LocationMatch): string {
    if (match.location.cache?.key) {
      // Use custom cache key
      return match.location.cache.key.replace(/\$(\w+)/g, (_, varName) => {
        switch (varName) {
          case 'uri': return request.path;
          case 'args': return JSON.stringify(request.query);
          default: return '';
        }
      });
    }
    
    // Default cache key
    return `${request.method}:${request.path}:${JSON.stringify(request.query)}`;
  }

  /**
   * Parse cache valid time
   */
  private parseCacheValid(valid: string): number {
    // Parse formats like "1h", "30m", "1d"
    const match = valid.match(/^(\d+)([smhd])$/);
    if (!match) return 3600000; // Default 1 hour
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    return value * this.getPeriodMs(unit);
  }

  /**
   * Check if response should be compressed
   */
  private shouldCompress(response: NginxResponse): boolean {
    if (!response.body) return false;
    
    const contentType = response.headers?.['Content-Type'] || '';
    const compressibleTypes = ['text/', 'application/json', 'application/javascript', 'application/xml'];
    
    return compressibleTypes.some(type => contentType.includes(type));
  }

  /**
   * Get routing statistics
   */
  public getStats(): {
    locations: number;
    upstreams: number;
    rateLimitZones: number;
    sslCertificates: number;
    requests: number;
    cacheHits: number;
    cacheMisses: number;
    rateLimitBlocks: number;
    cacheHitRate: number;
  } {
    const totalCacheRequests = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalCacheRequests > 0 ? this.cacheHits / totalCacheRequests : 0;

    return {
      locations: this.locations.length,
      upstreams: this.upstreams.size,
      rateLimitZones: this.rateLimitZones.size,
      sslCertificates: this.sslCertificates.size,
      requests: this.requestCount,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      rateLimitBlocks: this.rateLimitBlocks,
      cacheHitRate,
    };
  }

  /**
   * Update upstream server health
   */
  public updateServerHealth(upstreamName: string, serverAddress: string, health: 'healthy' | 'unhealthy' | 'checking'): void {
    const upstream = this.upstreams.get(upstreamName);
    if (!upstream) return;

    const server = upstream.servers.find(s => s.address === serverAddress);
    if (server) {
      server.health = health;
    }
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}


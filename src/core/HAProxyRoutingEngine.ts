/**
 * HAProxy Routing Engine
 * Handles request routing through frontends, backends, and servers with load balancing
 * Simulates HAProxy behavior including ACL rules, health checks, and stick tables
 */

export interface HAProxyFrontend {
  id: string;
  name: string;
  bind: string; // e.g., "0.0.0.0:80" or "0.0.0.0:443"
  mode: 'http' | 'tcp';
  defaultBackend?: string;
  backends?: string[]; // List of backend names
  ssl?: boolean;
  acls?: HAProxyACL[];
  // Statistics
  requests?: number;
  responses?: number;
  bytesIn?: number;
  bytesOut?: number;
}

export interface HAProxyBackend {
  id: string;
  name: string;
  mode: 'http' | 'tcp';
  balance: 'roundrobin' | 'leastconn' | 'source' | 'uri' | 'hdr' | 'rdp-cookie';
  servers: HAProxyBackendServer[];
  healthCheck?: {
    enabled: boolean;
    interval?: number; // ms
    timeout?: number; // ms
    path?: string; // for HTTP mode
    fall?: number; // consecutive failures before marking down
    rise?: number; // consecutive successes before marking up
  };
  stickTable?: {
    enabled: boolean;
    type: 'ip' | 'integer' | 'string';
    size?: number;
    expire?: number; // seconds
  };
  acls?: HAProxyACL[];
}

export interface HAProxyBackendServer {
  id: string;
  name: string;
  address: string;
  port: number;
  weight?: number;
  check?: boolean;
  status: 'up' | 'down' | 'maint' | 'drain';
  // Statistics
  sessions?: number;
  bytesIn?: number;
  bytesOut?: number;
  errors?: number;
  responseTime?: number; // ms
  lastCheck?: number; // timestamp
  checkStatus?: 'checking' | 'passed' | 'failed';
}

export interface HAProxyACL {
  name: string;
  criterion: string; // e.g., "hdr(host)", "path_beg", "src", etc.
  value?: string;
  operator?: 'eq' | 'ne' | 'beg' | 'end' | 'sub' | 'gt' | 'lt' | 'gte' | 'lte';
}

export interface HAProxyRequest {
  path: string;
  method: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  clientIP?: string;
  protocol?: 'http' | 'https';
  host?: string;
}

export interface HAProxyResponse {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
  latency?: number;
  error?: string;
  backendTarget?: string;
  serverTarget?: string;
}

export interface HAProxyStats {
  frontends: number;
  backends: number;
  totalServers: number;
  upServers: number;
  downServers: number;
  totalRequests: number;
  totalResponses: number;
  activeConnections: number;
  totalBytesIn: number;
  totalBytesOut: number;
  errorRate: number;
  rateLimitBlocks?: number;
  timeoutErrors?: number;
  connectionRejects?: number;
}

export interface HAProxyGlobalConfig {
  maxConnections?: number;
  timeoutConnect?: number; // ms
  timeoutServer?: number; // ms
  timeoutClient?: number; // ms
  timeoutHttpRequest?: number; // ms
  timeoutHttpKeepAlive?: number; // ms
  rateLimit?: {
    enabled: boolean;
    rate?: string; // e.g., "10r/s"
    burst?: number;
  };
}

/**
 * HAProxy Routing Engine
 * Simulates HAProxy request routing and load balancing behavior
 */
export class HAProxyRoutingEngine {
  private frontends: Map<string, HAProxyFrontend> = new Map();
  private backends: Map<string, HAProxyBackend> = new Map();
  private globalConfig: HAProxyGlobalConfig = {};
  
  // Load balancing state
  private roundRobinCounters: Map<string, number> = new Map(); // backend -> counter
  private connectionCounts: Map<string, number> = new Map(); // server -> connection count
  private sourceHashMap: Map<string, string> = new Map(); // source IP -> server mapping
  private uriHashMap: Map<string, string> = new Map(); // URI hash -> server mapping
  private stickTable: Map<string, { server: string; expiresAt: number }> = new Map(); // key -> server mapping
  
  // Statistics
  private requestCount: number = 0;
  private responseCount: number = 0;
  private errorCount: number = 0;
  private totalBytesIn: number = 0;
  private totalBytesOut: number = 0;
  private activeConnections: number = 0;
  private rateLimitBlocks: number = 0;
  private timeoutErrors: number = 0;
  private connectionRejects: number = 0;
  
  // Health check state
  private healthCheckTimers: Map<string, NodeJS.Timeout> = new Map();
  private serverCheckFailures: Map<string, number> = new Map(); // server key -> failure count
  private serverCheckSuccesses: Map<string, number> = new Map(); // server key -> success count
  
  // Rate limiting state
  private rateLimitTracker: Map<string, { count: number; resetAt: number }> = new Map(); // client IP -> rate limit state

  /**
   * Initialize with HAProxy configuration
   */
  public initialize(config: {
    frontends?: HAProxyFrontend[];
    backends?: HAProxyBackend[];
    globalConfig?: HAProxyGlobalConfig;
  }) {
    // Clear previous state
    this.frontends.clear();
    this.backends.clear();
    this.roundRobinCounters.clear();
    this.connectionCounts.clear();
    this.sourceHashMap.clear();
    this.uriHashMap.clear();
    this.stickTable.clear();
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

    // Initialize frontends
    if (config.frontends) {
      for (const frontend of config.frontends) {
        this.frontends.set(frontend.name, { 
          ...frontend,
          acls: frontend.acls || [],
        });
      }
    }

    // Initialize backends
    if (config.backends) {
      for (const backend of config.backends) {
        this.backends.set(backend.name, { 
          ...backend,
          acls: backend.acls || [],
        });
        this.roundRobinCounters.set(backend.name, 0);
        
        // Initialize health checks for backend servers
        if (backend.healthCheck?.enabled && backend.servers) {
          for (const server of backend.servers) {
            if (server.check) {
              this.startHealthCheck(backend.name, server, backend.healthCheck);
            }
          }
        }
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
    this.connectionRejects = 0;
  }

  /**
   * Route a request through HAProxy
   */
  public routeRequest(request: HAProxyRequest, frontendName?: string): {
    frontend: HAProxyFrontend | null;
    backend: HAProxyBackend | null;
    response: HAProxyResponse;
    backendTarget?: string;
    serverTarget?: string;
  } {
    const startTime = Date.now();
    this.requestCount++;
    
    // Check max connections limit
    const maxConnections = this.globalConfig.maxConnections || 4096;
    if (this.activeConnections >= maxConnections) {
      this.connectionRejects++;
      this.errorCount++;
      return {
        frontend: null,
        backend: null,
        response: {
          status: 503,
          error: 'Max connections exceeded',
          latency: Date.now() - startTime,
        },
      };
    }
    
    this.activeConnections++;
    
    // Check rate limiting
    if (this.globalConfig.rateLimit?.enabled) {
      const rateLimitResult = this.checkRateLimit(request);
      if (!rateLimitResult.allowed) {
        this.activeConnections--;
        this.rateLimitBlocks++;
        this.errorCount++;
        return {
          frontend: null,
          backend: null,
          response: {
            status: 429,
            error: 'Rate limit exceeded',
            latency: Date.now() - startTime,
          },
        };
      }
    }

    // Step 1: Find frontend
    let frontend: HAProxyFrontend | null = null;
    
    if (frontendName) {
      frontend = this.frontends.get(frontendName) || null;
    } else {
      // Find frontend by bind address or default
      for (const [name, fe] of this.frontends.entries()) {
        // Match by protocol
        const bindPort = this.extractPort(fe.bind);
        if (request.protocol === 'https' && bindPort === 443) {
          frontend = fe;
          break;
        } else if (request.protocol === 'http' && bindPort === 80) {
          frontend = fe;
          break;
        }
      }
      
      // If no match, use first frontend or default
      if (!frontend && this.frontends.size > 0) {
        frontend = Array.from(this.frontends.values())[0];
      }
    }

    if (!frontend) {
      this.activeConnections--;
      return {
        frontend: null,
        backend: null,
        response: {
          status: 503,
          error: 'No frontend available',
          latency: Date.now() - startTime,
        },
      };
    }

    // Step 2: Evaluate ACL rules if present
    if (frontend.acls && frontend.acls.length > 0) {
      const aclResult = this.evaluateACLs(frontend.acls, request);
      if (!aclResult.matched) {
        this.activeConnections--;
        this.errorCount++;
        return {
          frontend,
          backend: null,
          response: {
            status: 403,
            error: aclResult.error || 'ACL rule denied',
            latency: Date.now() - startTime,
          },
        };
      }
    }

    // Step 3: Select backend
    const backendName = frontend.defaultBackend || 
                       (frontend.backends && frontend.backends.length > 0 ? frontend.backends[0] : null);
    
    if (!backendName) {
      this.activeConnections--;
      this.errorCount++;
      return {
        frontend,
        backend: null,
        response: {
          status: 503,
          error: 'No backend configured',
          latency: Date.now() - startTime,
        },
      };
    }

    const backend = this.backends.get(backendName);
    if (!backend) {
      this.activeConnections--;
      this.errorCount++;
      return {
        frontend,
        backend: null,
        response: {
          status: 503,
          error: `Backend ${backendName} not found`,
          latency: Date.now() - startTime,
        },
      };
    }

    // Step 4: Evaluate backend ACLs if present
    if (backend.acls && backend.acls.length > 0) {
      const aclResult = this.evaluateACLs(backend.acls, request);
      if (!aclResult.matched) {
        this.activeConnections--;
        this.errorCount++;
        return {
          frontend,
          backend,
          response: {
            status: 403,
            error: aclResult.error || 'Backend ACL rule denied',
            latency: Date.now() - startTime,
          },
        };
      }
    }

    // Step 5: Select server using load balancing algorithm
    const serverTarget = this.selectServer(backend, request);
    
    if (!serverTarget) {
      this.activeConnections--;
      this.errorCount++;
      return {
        frontend,
        backend,
        response: {
          status: 503,
          error: 'No healthy server available',
          latency: Date.now() - startTime,
        },
      };
    }

    // Step 6: Update statistics
    const server = backend.servers.find(s => `${s.address}:${s.port}` === serverTarget);
    if (server) {
      server.sessions = (server.sessions || 0) + 1;
      const connCount = this.connectionCounts.get(serverTarget) || 0;
      this.connectionCounts.set(serverTarget, connCount + 1);
    }

    // Step 7: Simulate request processing with timeouts and SSL overhead
    const baseResponseTime = 10 + Math.random() * 90; // 10-100ms base
    
    // Add SSL overhead if frontend uses SSL
    const sslOverhead = frontend.ssl ? 5 + Math.random() * 15 : 0; // 5-20ms for SSL handshake overhead
    
    // Apply timeout constraints
    const timeoutServer = this.globalConfig.timeoutServer || 50000;
    const timeoutConnect = this.globalConfig.timeoutConnect || 5000;
    const timeoutHttpRequest = this.globalConfig.timeoutHttpRequest || 10000;
    
    // Simulate connection time (with timeout check)
    const connectTime = Math.min(50 + Math.random() * 100, timeoutConnect);
    if (connectTime >= timeoutConnect * 0.9) {
      // Connection timeout
      this.activeConnections--;
      this.timeoutErrors++;
      this.errorCount++;
      if (server) {
        server.errors = (server.errors || 0) + 1;
      }
      return {
        frontend,
        backend,
        response: {
          status: 504,
          error: 'Connection timeout',
          latency: timeoutConnect,
          backendTarget: backendName,
          serverTarget,
        },
      };
    }
    
    // Total response time (connection + processing)
    const totalResponseTime = connectTime + baseResponseTime + sslOverhead;
    
    // Check if response time exceeds server timeout
    if (totalResponseTime > timeoutServer) {
      this.activeConnections--;
      this.timeoutErrors++;
      this.errorCount++;
      if (server) {
        server.errors = (server.errors || 0) + 1;
      }
      return {
        frontend,
        backend,
        response: {
          status: 504,
          error: 'Server timeout',
          latency: timeoutServer,
          backendTarget: backendName,
          serverTarget,
        },
      };
    }
    
    // Check HTTP request timeout
    if (totalResponseTime > timeoutHttpRequest) {
      this.activeConnections--;
      this.timeoutErrors++;
      this.errorCount++;
      if (server) {
        server.errors = (server.errors || 0) + 1;
      }
      return {
        frontend,
        backend,
        response: {
          status: 408,
          error: 'Request timeout',
          latency: timeoutHttpRequest,
          backendTarget: backendName,
          serverTarget,
        },
      };
    }
    
    const response: HAProxyResponse = {
      status: 200,
      body: { proxied: true, backend: backendName, server: serverTarget },
      latency: totalResponseTime,
      backendTarget: backendName,
      serverTarget,
    };

    // Update server statistics
    if (server) {
      const requestSize = 1024; // Estimated request size
      const responseSize = 2048; // Estimated response size
      server.bytesIn = (server.bytesIn || 0) + requestSize;
      server.bytesOut = (server.bytesOut || 0) + responseSize;
      server.responseTime = totalResponseTime;
      this.totalBytesIn += requestSize;
      this.totalBytesOut += responseSize;
    }

    this.responseCount++;
    this.activeConnections--;

    return {
      frontend,
      backend,
      response,
      backendTarget: backendName,
      serverTarget,
    };
  }

  /**
   * Select server using load balancing algorithm
   */
  private selectServer(backend: HAProxyBackend, request: HAProxyRequest): string | null {
    // Filter healthy servers
    const healthyServers = backend.servers.filter(s => 
      s.status === 'up' && s.check !== false
    );
    
    if (healthyServers.length === 0) {
      return null;
    }

    // Check stick table first if enabled
    if (backend.stickTable?.enabled) {
      const stickKey = this.getStickTableKey(request, backend.stickTable.type);
      const stickEntry = this.stickTable.get(stickKey);
      if (stickEntry && stickEntry.expiresAt > Date.now()) {
        // Verify server is still healthy
        const server = healthyServers.find(s => `${s.address}:${s.port}` === stickEntry.server);
        if (server) {
          return stickEntry.server;
        }
      }
    }

    const method = backend.balance || 'roundrobin';
    let selectedServer: string;

    switch (method) {
      case 'roundrobin':
        selectedServer = this.selectRoundRobin(backend.name, healthyServers);
        break;
      
      case 'leastconn':
        selectedServer = this.selectLeastConnections(healthyServers);
        break;
      
      case 'source':
        selectedServer = this.selectSourceIP(backend.name, healthyServers, request);
        break;
      
      case 'uri':
        selectedServer = this.selectURIHash(backend.name, healthyServers, request);
        break;
      
      case 'hdr':
        selectedServer = this.selectHeaderHash(backend.name, healthyServers, request);
        break;
      
      default:
        selectedServer = `${healthyServers[0].address}:${healthyServers[0].port}`;
    }

    // Update stick table if enabled
    if (backend.stickTable?.enabled && selectedServer) {
      const stickKey = this.getStickTableKey(request, backend.stickTable.type);
      const expire = (backend.stickTable.expire || 3600) * 1000; // Convert to ms
      this.stickTable.set(stickKey, {
        server: selectedServer,
        expiresAt: Date.now() + expire,
      });
    }

    return selectedServer;
  }

  /**
   * Round-robin selection with weights
   */
  private selectRoundRobin(backendName: string, servers: HAProxyBackendServer[]): string {
    const totalWeight = servers.reduce((sum, s) => sum + (s.weight || 1), 0);
    let counter = this.roundRobinCounters.get(backendName) || 0;
    
    let currentWeight = 0;
    for (const server of servers) {
      currentWeight += server.weight || 1;
      if (counter < currentWeight) {
        this.roundRobinCounters.set(backendName, (counter + 1) % totalWeight);
        return `${server.address}:${server.port}`;
      }
    }
    
    this.roundRobinCounters.set(backendName, (counter + 1) % totalWeight);
    return `${servers[0].address}:${servers[0].port}`;
  }

  /**
   * Least connections selection
   */
  private selectLeastConnections(servers: HAProxyBackendServer[]): string {
    let minConnections = Infinity;
    let selectedServer = servers[0];

    for (const server of servers) {
      const serverKey = `${server.address}:${server.port}`;
      const connections = this.connectionCounts.get(serverKey) || (server.sessions || 0);
      const weightedConnections = connections / (server.weight || 1);
      
      if (weightedConnections < minConnections) {
        minConnections = weightedConnections;
        selectedServer = server;
      }
    }

    return `${selectedServer.address}:${selectedServer.port}`;
  }

  /**
   * Source IP hash selection
   */
  private selectSourceIP(backendName: string, servers: HAProxyBackendServer[], request: HAProxyRequest): string {
    const clientIP = request.clientIP || request.headers?.['X-Real-IP'] || request.headers?.['X-Forwarded-For'] || '0.0.0.0';
    
    // Check cache
    const cached = this.sourceHashMap.get(`${backendName}:${clientIP}`);
    if (cached && servers.some(s => `${s.address}:${s.port}` === cached)) {
      return cached;
    }

    // Calculate hash
    const hash = this.simpleHash(clientIP);
    const index = hash % servers.length;
    const selected = `${servers[index].address}:${servers[index].port}`;
    
    // Cache mapping
    this.sourceHashMap.set(`${backendName}:${clientIP}`, selected);
    
    return selected;
  }

  /**
   * URI hash selection
   */
  private selectURIHash(backendName: string, servers: HAProxyBackendServer[], request: HAProxyRequest): string {
    const uri = request.path;
    const hashKey = `${backendName}:${uri}`;
    
    // Check cache
    const cached = this.uriHashMap.get(hashKey);
    if (cached && servers.some(s => `${s.address}:${s.port}` === cached)) {
      return cached;
    }

    // Calculate hash
    const hash = this.simpleHash(uri);
    const index = hash % servers.length;
    const selected = `${servers[index].address}:${servers[index].port}`;
    
    // Cache mapping
    this.uriHashMap.set(hashKey, selected);
    
    return selected;
  }

  /**
   * Header hash selection (for hdr balance method)
   */
  private selectHeaderHash(backendName: string, servers: HAProxyBackendServer[], request: HAProxyRequest): string {
    // Default to host header if available, otherwise use URI
    const headerValue = request.host || request.headers?.['Host'] || request.path;
    const hash = this.simpleHash(headerValue);
    const index = hash % servers.length;
    return `${servers[index].address}:${servers[index].port}`;
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
   * Get stick table key based on type
   */
  private getStickTableKey(request: HAProxyRequest, type: 'ip' | 'integer' | 'string'): string {
    switch (type) {
      case 'ip':
        return request.clientIP || request.headers?.['X-Real-IP'] || '0.0.0.0';
      case 'string':
        return request.host || request.headers?.['Host'] || '';
      case 'integer':
        // Could use a numeric header or port
        return request.headers?.['X-Forwarded-Port'] || '0';
      default:
        return request.clientIP || '0.0.0.0';
    }
  }

  /**
   * Evaluate ACL rules
   */
  private evaluateACLs(acls: HAProxyACL[], request: HAProxyRequest): {
    matched: boolean;
    error?: string;
  } {
    // For now, we'll implement basic ACL evaluation
    // In real HAProxy, ACLs are more complex
    for (const acl of acls) {
      const result = this.evaluateACL(acl, request);
      if (!result.matched) {
        return { matched: false, error: `ACL ${acl.name} failed` };
      }
    }
    return { matched: true };
  }

  /**
   * Evaluate single ACL rule
   */
  private evaluateACL(acl: HAProxyACL, request: HAProxyRequest): {
    matched: boolean;
  } {
    const operator = acl.operator || 'eq';
    const value = acl.value || '';
    
    // Header-based ACLs
    if (acl.criterion.startsWith('hdr(')) {
      const headerName = acl.criterion.match(/hdr\(([^)]+)\)/)?.[1];
      if (headerName) {
        const headerValue = (request.headers?.[headerName.toLowerCase()] || '').toLowerCase();
        const matchValue = value.toLowerCase();
        return { matched: this.compareValues(headerValue, matchValue, operator) };
      }
    }
    // Path-based ACLs
    else if (acl.criterion === 'path_beg') {
      return { matched: request.path.toLowerCase().startsWith(value.toLowerCase()) };
    }
    else if (acl.criterion === 'path_end') {
      return { matched: request.path.toLowerCase().endsWith(value.toLowerCase()) };
    }
    else if (acl.criterion === 'path') {
      return { matched: this.compareValues(request.path.toLowerCase(), value.toLowerCase(), operator) };
    }
    // Source IP ACL
    else if (acl.criterion === 'src') {
      const clientIP = request.clientIP || request.headers?.['X-Real-IP'] || request.headers?.['X-Forwarded-For'] || '0.0.0.0';
      if (value.includes('/')) {
        // CIDR notation support (basic)
        const [ip, prefix] = value.split('/');
        return { matched: this.isIPInCIDR(clientIP, ip, parseInt(prefix || '32', 10)) };
      } else {
        return { matched: this.compareValues(clientIP, value, operator) };
      }
    }
    // HTTP method ACL
    else if (acl.criterion === 'method') {
      return { matched: this.compareValues(request.method.toUpperCase(), value.toUpperCase(), operator) };
    }
    // URL parameter ACL
    else if (acl.criterion === 'url_param') {
      const paramName = value.split('=')[0];
      const paramValue = value.split('=')[1] || '';
      const queryValue = request.query?.[paramName] || '';
      if (paramValue) {
        return { matched: this.compareValues(queryValue, paramValue, operator) };
      } else {
        return { matched: !!queryValue };
      }
    }
    
    return { matched: true }; // Default to allow
  }
  
  /**
   * Compare values based on operator
   */
  private compareValues(actual: string, expected: string, operator: string): boolean {
    switch (operator) {
      case 'eq':
        return actual === expected;
      case 'ne':
        return actual !== expected;
      case 'beg':
        return actual.startsWith(expected);
      case 'end':
        return actual.endsWith(expected);
      case 'sub':
        return actual.includes(expected);
      case 'gt':
        return parseFloat(actual) > parseFloat(expected);
      case 'lt':
        return parseFloat(actual) < parseFloat(expected);
      case 'gte':
        return parseFloat(actual) >= parseFloat(expected);
      case 'lte':
        return parseFloat(actual) <= parseFloat(expected);
      default:
        return actual === expected;
    }
  }
  
  /**
   * Check if IP is in CIDR range (simplified)
   */
  private isIPInCIDR(ip: string, cidrIP: string, prefix: number): boolean {
    // Simplified CIDR check - in production would use proper IP address parsing
    if (prefix === 32) {
      return ip === cidrIP;
    }
    // For simulation, just check if IPs start with same prefix
    const ipParts = ip.split('.');
    const cidrParts = cidrIP.split('.');
    if (ipParts.length !== 4 || cidrParts.length !== 4) return false;
    
    const prefixBytes = Math.floor(prefix / 8);
    for (let i = 0; i < prefixBytes; i++) {
      if (ipParts[i] !== cidrParts[i]) return false;
    }
    return true;
  }
  
  /**
   * Check rate limiting
   */
  private checkRateLimit(request: HAProxyRequest): { allowed: boolean } {
    if (!this.globalConfig.rateLimit?.enabled) {
      return { allowed: true };
    }
    
    const rateConfig = this.globalConfig.rateLimit;
    const rateStr = rateConfig.rate || '10r/s';
    const burst = rateConfig.burst || 5;
    
    // Parse rate (e.g., "10r/s" -> 10 requests per second)
    const rateMatch = rateStr.match(/(\d+)r\/([smh])/);
    if (!rateMatch) {
      return { allowed: true };
    }
    
    const rate = parseInt(rateMatch[1], 10);
    const unit = rateMatch[2];
    let windowMs = 1000; // default to seconds
    
    switch (unit) {
      case 's':
        windowMs = 1000;
        break;
      case 'm':
        windowMs = 60000;
        break;
      case 'h':
        windowMs = 3600000;
        break;
    }
    
    const clientIP = request.clientIP || request.headers?.['X-Real-IP'] || request.headers?.['X-Forwarded-For'] || '0.0.0.0';
    const now = Date.now();
    const trackerKey = clientIP;
    
    let tracker = this.rateLimitTracker.get(trackerKey);
    
    // Reset if window expired
    if (!tracker || now >= tracker.resetAt) {
      tracker = {
        count: 0,
        resetAt: now + windowMs,
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
   * Start health check for a server
   */
  private startHealthCheck(backendName: string, server: HAProxyBackendServer, healthCheck: NonNullable<HAProxyBackend['healthCheck']>): void {
    const serverKey = `${backendName}:${server.address}:${server.port}`;
    
    // Clear existing timer if any
    const existingTimer = this.healthCheckTimers.get(serverKey);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    const interval = healthCheck.interval || 2000;
    const timeout = healthCheck.timeout || 1000;
    const fall = healthCheck.fall || 3;
    const rise = healthCheck.rise || 2;

    const timer = setInterval(() => {
      server.lastCheck = Date.now();
      server.checkStatus = 'checking';

      // Simulate health check (in real HAProxy, this would be an actual HTTP/TCP check)
      // For simulation, we'll randomly mark servers as healthy/unhealthy based on their current status
      const isHealthy = Math.random() > 0.1; // 90% chance of being healthy

      setTimeout(() => {
        if (isHealthy) {
          const successCount = (this.serverCheckSuccesses.get(serverKey) || 0) + 1;
          this.serverCheckSuccesses.set(serverKey, successCount);
          this.serverCheckFailures.set(serverKey, 0);

          if (server.status === 'down' && successCount >= rise) {
            server.status = 'up';
            server.checkStatus = 'passed';
          } else if (server.status === 'up') {
            server.checkStatus = 'passed';
          }
        } else {
          const failureCount = (this.serverCheckFailures.get(serverKey) || 0) + 1;
          this.serverCheckFailures.set(serverKey, failureCount);
          this.serverCheckSuccesses.set(serverKey, 0);

          if (server.status === 'up' && failureCount >= fall) {
            server.status = 'down';
            server.checkStatus = 'failed';
          } else if (server.status === 'down') {
            server.checkStatus = 'failed';
          }
        }
      }, timeout);
    }, interval);

    this.healthCheckTimers.set(serverKey, timer);
  }

  /**
   * Extract port from bind string
   */
  private extractPort(bind: string): number {
    const match = bind.match(/:(\d+)$/);
    return match ? parseInt(match[1], 10) : 80;
  }

  /**
   * Get routing statistics
   */
  public getStats(): HAProxyStats {
    let totalServers = 0;
    let upServers = 0;
    let downServers = 0;

    for (const backend of this.backends.values()) {
      totalServers += backend.servers.length;
      for (const server of backend.servers) {
        if (server.status === 'up') {
          upServers++;
        } else {
          downServers++;
        }
      }
    }

    const errorRate = this.requestCount > 0 ? this.errorCount / this.requestCount : 0;

    return {
      frontends: this.frontends.size,
      backends: this.backends.size,
      totalServers,
      upServers,
      downServers,
      totalRequests: this.requestCount,
      totalResponses: this.responseCount,
      activeConnections: this.activeConnections,
      totalBytesIn: this.totalBytesIn,
      totalBytesOut: this.totalBytesOut,
      errorRate,
      rateLimitBlocks: this.rateLimitBlocks,
      timeoutErrors: this.timeoutErrors,
      connectionRejects: this.connectionRejects,
    };
  }

  /**
   * Get frontend statistics
   */
  public getFrontendStats(frontendName: string): {
    requests: number;
    responses: number;
    bytesIn: number;
    bytesOut: number;
  } | null {
    const frontend = this.frontends.get(frontendName);
    if (!frontend) return null;

    return {
      requests: frontend.requests || 0,
      responses: frontend.responses || 0,
      bytesIn: frontend.bytesIn || 0,
      bytesOut: frontend.bytesOut || 0,
    };
  }

  /**
   * Get backend statistics
   */
  public getBackendStats(backendName: string): {
    servers: number;
    upServers: number;
    downServers: number;
    totalSessions: number;
    totalBytesIn: number;
    totalBytesOut: number;
    totalErrors: number;
  } | null {
    const backend = this.backends.get(backendName);
    if (!backend) return null;

    let upServers = 0;
    let downServers = 0;
    let totalSessions = 0;
    let totalBytesIn = 0;
    let totalBytesOut = 0;
    let totalErrors = 0;

    for (const server of backend.servers) {
      if (server.status === 'up') {
        upServers++;
      } else {
        downServers++;
      }
      totalSessions += server.sessions || 0;
      totalBytesIn += server.bytesIn || 0;
      totalBytesOut += server.bytesOut || 0;
      totalErrors += server.errors || 0;
    }

    return {
      servers: backend.servers.length,
      upServers,
      downServers,
      totalSessions,
      totalBytesIn,
      totalBytesOut,
      totalErrors,
    };
  }

  /**
   * Update server status manually
   */
  public updateServerStatus(backendName: string, serverId: string, status: 'up' | 'down' | 'maint' | 'drain'): void {
    const backend = this.backends.get(backendName);
    if (!backend) return;

    const server = backend.servers.find(s => s.id === serverId);
    if (server) {
      server.status = status;
    }
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


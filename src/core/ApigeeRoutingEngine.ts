/**
 * Apigee API Gateway Routing Engine
 * Simulates Apigee API Gateway request routing behavior with policies
 */

export interface ApigeeProxy {
  name: string;
  environment: 'dev' | 'stage' | 'prod';
  basePath: string;
  targetEndpoint: string;
  revision?: number;
  status?: 'deployed' | 'undeployed';
  quota?: number;
  quotaInterval?: number; // seconds
  spikeArrest?: number; // requests per second
  enableOAuth?: boolean;
  jwtIssuer?: string;
}

export interface ApigeePolicy {
  id: string;
  name: string;
  type: 'quota' | 'spike-arrest' | 'oauth' | 'jwt' | 'verify-api-key' | 'cors' | 'xml-to-json';
  enabled: boolean;
  executionFlow?: 'PreFlow' | 'RequestFlow' | 'PostFlow' | 'ErrorFlow';
  condition?: string; // Optional condition for conditional execution
  config?: Record<string, any>;
}

export interface ApigeeRequest {
  path: string;
  method: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  apiKey?: string;
  oauthToken?: string;
  jwtToken?: string;
}

export interface ApigeeResponse {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
  latency?: number;
  error?: string;
}

export interface ProxyMatch {
  proxy: ApigeeProxy;
  matchedPath: string;
  remainingPath: string;
}

/**
 * Quota counter state
 */
interface QuotaCounter {
  count: number;
  resetAt: number; // timestamp
  identifier: string; // proxy name or consumer identifier
}

/**
 * Spike Arrest token bucket state
 */
interface SpikeArrestBucket {
  tokens: number;
  lastRefill: number; // timestamp
  rate: number; // tokens per second
}

/**
 * Apigee API Gateway Routing Engine
 * Simulates Apigee Gateway request routing behavior
 */
export class ApigeeRoutingEngine {
  private proxies: Map<string, ApigeeProxy> = new Map(); // proxy name -> proxy
  private policies: ApigeePolicy[] = [];
  private organization?: string;
  private environment?: string;
  
  // Quota tracking: Map<proxyName, Map<identifier, QuotaCounter>>
  private quotaCounters: Map<string, Map<string, QuotaCounter>> = new Map();
  
  // Spike Arrest tracking: Map<proxyName, SpikeArrestBucket>
  private spikeArrestBuckets: Map<string, SpikeArrestBucket> = new Map();
  
  // API Key validation cache: Map<apiKey, {valid: boolean, consumerId?: string}>
  private apiKeyCache: Map<string, { valid: boolean; consumerId?: string; expiresAt: number }> = new Map();
  
  // OAuth token cache: Map<token, {valid: boolean, expiresAt: number}>
  private oauthTokenCache: Map<string, { valid: boolean; expiresAt: number }> = new Map();
  
  // JWT validation cache: Map<token, {valid: boolean, issuer?: string, expiresAt: number}>
  private jwtTokenCache: Map<string, { valid: boolean; issuer?: string; expiresAt: number }> = new Map();
  
  // Request metrics per proxy
  private proxyMetrics: Map<string, {
    requestCount: number;
    errorCount: number;
    totalLatency: number;
    lastRequestTime: number;
  }> = new Map();

  /**
   * Initialize with Apigee configuration
   */
  public initialize(config: {
    organization?: string;
    environment?: string;
    proxies?: ApigeeProxy[];
    policies?: ApigeePolicy[];
  }) {
    // Clear previous state
    this.proxies.clear();
    this.policies = [];
    this.quotaCounters.clear();
    this.spikeArrestBuckets.clear();
    this.apiKeyCache.clear();
    this.oauthTokenCache.clear();
    this.jwtTokenCache.clear();
    this.proxyMetrics.clear();

    this.organization = config.organization || 'archiphoenix-org';
    this.environment = config.environment || 'prod';

    // Initialize proxies
    if (config.proxies) {
      for (const proxy of config.proxies) {
        this.proxies.set(proxy.name, { ...proxy });
        
        // Initialize metrics
        this.proxyMetrics.set(proxy.name, {
          requestCount: 0,
          errorCount: 0,
          totalLatency: 0,
          lastRequestTime: 0,
        });
        
        // Initialize spike arrest bucket if configured
        if (proxy.spikeArrest && proxy.spikeArrest > 0) {
          this.spikeArrestBuckets.set(proxy.name, {
            tokens: proxy.spikeArrest,
            lastRefill: Date.now(),
            rate: proxy.spikeArrest,
          });
        }
      }
    }

    // Initialize policies
    if (config.policies) {
      this.policies = config.policies.filter(p => p.enabled);
    }
  }

  /**
   * Route a request through Apigee Gateway
   */
  public routeRequest(request: ApigeeRequest): {
    match: ProxyMatch | null;
    response: ApigeeResponse;
    target?: string;
  } {
    const startTime = Date.now();
    
    // Step 1: Match proxy by basePath
    const match = this.matchProxy(request);
    if (!match) {
      return {
        match: null,
        response: {
          status: 404,
          error: 'No API proxy matched for path',
          latency: Date.now() - startTime,
        },
      };
    }

    // Step 2: Check if proxy is deployed
    if (match.proxy.status === 'undeployed') {
      this.updateProxyMetrics(match.proxy.name, false, Date.now() - startTime);
      return {
        match,
        response: {
          status: 503,
          error: `Proxy '${match.proxy.name}' is not deployed`,
          latency: Date.now() - startTime,
        },
      };
    }

    // Step 2: Execute PreFlow policies (authentication)
    const preFlowPolicies = this.policies.filter(p => 
      p.enabled && (p.executionFlow === 'PreFlow' || (!p.executionFlow && this.isPreFlowPolicy(p.type)))
    );
    const authResult = this.executePolicies(preFlowPolicies, request, match, 'PreFlow');
    if (authResult.blocked) {
      this.updateProxyMetrics(match.proxy.name, true, Date.now() - startTime);
      return {
        match,
        response: {
          status: authResult.status || 401,
          error: authResult.error || 'Authentication failed',
          latency: Date.now() - startTime,
        },
      };
    }

    // Step 3: Execute RequestFlow policies (quota, spike arrest)
    const requestFlowPolicies = this.policies.filter(p => 
      p.enabled && (p.executionFlow === 'RequestFlow' || (!p.executionFlow && this.isRequestFlowPolicy(p.type)))
    );
    const requestPolicyResult = this.executePolicies(requestFlowPolicies, request, match, 'RequestFlow');
    if (requestPolicyResult.blocked) {
      this.updateProxyMetrics(match.proxy.name, true, Date.now() - startTime);
      return {
        match,
        response: {
          status: requestPolicyResult.status || 429,
          error: requestPolicyResult.error || 'Request policy violation',
          latency: Date.now() - startTime,
        },
      };
    }

    // Step 4: Route to target endpoint
    const target = this.buildTargetUrl(match.proxy, match.remainingPath);

    // Step 5: Simulate upstream latency
    const upstreamLatency = this.simulateUpstreamLatency(target);
    const totalLatency = Date.now() - startTime + upstreamLatency;

    // Step 6: Execute PostFlow policies (CORS, transformation)
    const postFlowPolicies = this.policies.filter(p => 
      p.enabled && (p.executionFlow === 'PostFlow' || (!p.executionFlow && this.isPostFlowPolicy(p.type)))
    );
    const response: ApigeeResponse = {
      status: 200,
      latency: totalLatency,
    };

    // Apply PostFlow policies
    this.executePolicies(postFlowPolicies, request, match, 'PostFlow', response);

    // Update metrics
    this.updateProxyMetrics(match.proxy.name, false, totalLatency);

    return {
      match,
      response,
      target,
    };
  }

  /**
   * Match request to a proxy by basePath
   */
  private matchProxy(request: ApigeeRequest): ProxyMatch | null {
    // Sort proxies by basePath length (longest first) for more specific matching
    const sortedProxies = Array.from(this.proxies.values())
      .filter(p => p.status === 'deployed' || p.status === undefined)
      .sort((a, b) => b.basePath.length - a.basePath.length);

    for (const proxy of sortedProxies) {
      if (request.path.startsWith(proxy.basePath)) {
        const remainingPath = request.path.slice(proxy.basePath.length) || '/';
        return {
          proxy,
          matchedPath: proxy.basePath,
          remainingPath,
        };
      }
    }

    return null;
  }

  /**
   * Check if policy type belongs to PreFlow
   */
  private isPreFlowPolicy(type: string): boolean {
    return ['verify-api-key', 'oauth', 'jwt'].includes(type);
  }

  /**
   * Check if policy type belongs to RequestFlow
   */
  private isRequestFlowPolicy(type: string): boolean {
    return ['quota', 'spike-arrest'].includes(type);
  }

  /**
   * Check if policy type belongs to PostFlow
   */
  private isPostFlowPolicy(type: string): boolean {
    return ['cors', 'xml-to-json'].includes(type);
  }

  /**
   * Check if condition is met (simplified condition evaluation)
   */
  private evaluateCondition(condition: string | undefined, request: ApigeeRequest, match: ProxyMatch): boolean {
    if (!condition) return true;
    
    // Simplified condition evaluation
    // In real Apigee, this would use JavaScript evaluation
    try {
      // Basic path matching
      if (condition.includes('request.path')) {
        const pathMatch = condition.match(/request\.path\s*[=!]=\s*['"]([^'"]+)['"]/);
        if (pathMatch) {
          return request.path === pathMatch[1];
        }
      }
      // Default: condition is met if it's not empty
      return condition.length > 0;
    } catch {
      return true; // Default allow if condition evaluation fails
    }
  }

  /**
   * Execute policies in a specific flow
   */
  private executePolicies(
    policies: ApigeePolicy[],
    request: ApigeeRequest,
    match: ProxyMatch,
    flow: 'PreFlow' | 'RequestFlow' | 'PostFlow' | 'ErrorFlow',
    response?: ApigeeResponse
  ): { blocked: boolean; status?: number; error?: string } {
    for (const policy of policies) {
      // Check condition if specified
      if (!this.evaluateCondition(policy.condition, request, match)) {
        continue; // Skip policy if condition not met
      }

      if (flow === 'PreFlow') {
        const result = this.executePreFlowPolicy(policy, request, match);
        if (result.blocked) return result;
      } else if (flow === 'RequestFlow') {
        const result = this.executeRequestFlowPolicy(policy, request, match);
        if (result.blocked) return result;
      } else if (flow === 'PostFlow' && response) {
        this.executePostFlowPolicy(policy, request, match, response);
      }
    }

    return { blocked: false };
  }

  /**
   * Execute a single PreFlow policy
   */
  private executePreFlowPolicy(
    policy: ApigeePolicy,
    request: ApigeeRequest,
    match: ProxyMatch
  ): { blocked: boolean; status?: number; error?: string } {
    const proxy = match.proxy;

    if (policy.type === 'verify-api-key') {
      const apiKey = request.apiKey || 
                     request.headers?.['X-API-Key'] || 
                     request.headers?.['apikey'] ||
                     request.query?.['apikey'];
      
      if (!apiKey) {
        return {
          blocked: true,
          status: 401,
          error: 'API key is required',
        };
      }

      if (!this.validateApiKey(apiKey)) {
        return {
          blocked: true,
          status: 401,
          error: 'Invalid API key',
        };
      }
    }

    if (policy.type === 'oauth') {
      const proxy = match.proxy;
      if (proxy.enableOAuth) {
        const token = request.oauthToken || 
                      request.headers?.['Authorization']?.replace('Bearer ', '') ||
                      request.headers?.['Authorization']?.replace('OAuth ', '');
        
        if (!token) {
          return {
            blocked: true,
            status: 401,
            error: 'OAuth token is required',
          };
        }

        if (!this.validateOAuthToken(token)) {
          return {
            blocked: true,
            status: 401,
            error: 'Invalid or expired OAuth token',
          };
        }
      }
    }

    if (policy.type === 'jwt') {
      const proxy = match.proxy;
      if (proxy.jwtIssuer) {
        const token = request.jwtToken || 
                      request.headers?.['Authorization']?.replace('Bearer ', '') ||
                      request.headers?.['X-JWT-Token'];
        
        if (!token) {
          return {
            blocked: true,
            status: 401,
            error: 'JWT token is required',
          };
        }

        if (!this.validateJWTToken(token, proxy.jwtIssuer)) {
          return {
            blocked: true,
            status: 401,
            error: 'Invalid or expired JWT token',
          };
        }
      }
    }

    return { blocked: false };
  }

  /**
   * Execute a single RequestFlow policy
   */
  private executeRequestFlowPolicy(
    policy: ApigeePolicy,
    request: ApigeeRequest,
    match: ProxyMatch
  ): { blocked: boolean; status?: number; error?: string } {
    const proxy = match.proxy;
    const identifier = request.headers?.['X-Consumer-ID'] || 'default';

    if (policy.type === 'quota') {
      // Use policy config or proxy config
      const quota = policy.config?.quota || proxy.quota;
      const quotaInterval = policy.config?.interval || proxy.quotaInterval;
      
      if (quota && quotaInterval) {
        if (!this.checkQuota(proxy.name, identifier, quota, quotaInterval)) {
          return {
            blocked: true,
            status: 429,
            error: `Quota exceeded: ${quota} requests per ${quotaInterval} seconds`,
          };
        }
      }
    }

    if (policy.type === 'spike-arrest') {
      // Use policy config or proxy config
      const rate = policy.config?.rate || proxy.spikeArrest;
      
      if (rate && rate > 0) {
        if (!this.checkSpikeArrest(proxy.name, rate)) {
          return {
            blocked: true,
            status: 429,
            error: `Spike arrest limit exceeded: ${rate} requests per second`,
          };
        }
      }
    }

    return { blocked: false };
  }

  /**
   * Execute a single PostFlow policy
   */
  private executePostFlowPolicy(
    policy: ApigeePolicy,
    request: ApigeeRequest,
    match: ProxyMatch,
    response: ApigeeResponse
  ): void {
    if (policy.type === 'cors') {
      if (!response.headers) {
        response.headers = {};
      }
      response.headers['Access-Control-Allow-Origin'] = policy.config?.origins?.[0] || '*';
      response.headers['Access-Control-Allow-Methods'] = policy.config?.methods?.join(', ') || 'GET, POST, PUT, DELETE';
      response.headers['Access-Control-Allow-Headers'] = policy.config?.headers?.join(', ') || 'Content-Type, Authorization';
    }

    if (policy.type === 'xml-to-json') {
      // Transformation would happen here
      // For simulation, we just mark it
      if (!response.headers) {
        response.headers = {};
      }
      response.headers['Content-Type'] = 'application/json';
    }
  }

  /**
   * Check quota limit
   */
  private checkQuota(
    proxyName: string,
    identifier: string,
    quota: number,
    intervalSeconds: number
  ): boolean {
    const now = Date.now();
    const intervalMs = intervalSeconds * 1000;

    // Get or create quota counters for this proxy
    let proxyCounters = this.quotaCounters.get(proxyName);
    if (!proxyCounters) {
      proxyCounters = new Map();
      this.quotaCounters.set(proxyName, proxyCounters);
    }

    // Get or create counter for this identifier
    let counter = proxyCounters.get(identifier);
    if (!counter || counter.resetAt < now) {
      // Reset counter
      counter = {
        count: 0,
        resetAt: now + intervalMs,
        identifier,
      };
      proxyCounters.set(identifier, counter);
    }

    // Check quota
    if (counter.count >= quota) {
      return false; // Quota exceeded
    }

    // Increment counter
    counter.count++;
    return true;
  }

  /**
   * Check spike arrest limit using token bucket algorithm
   */
  private checkSpikeArrest(proxyName: string, rate: number): boolean {
    const now = Date.now();
    
    // Get or create bucket for this proxy
    let bucket = this.spikeArrestBuckets.get(proxyName);
    if (!bucket) {
      bucket = {
        tokens: rate,
        lastRefill: now,
        rate,
      };
      this.spikeArrestBuckets.set(proxyName, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = (now - bucket.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * bucket.rate;
    bucket.tokens = Math.min(bucket.rate, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Check if we have tokens
    if (bucket.tokens < 1) {
      return false; // Spike arrest limit exceeded
    }

    // Consume one token
    bucket.tokens -= 1;
    return true;
  }

  /**
   * Validate API key (simplified validation)
   */
  private validateApiKey(apiKey: string): boolean {
    // Check cache first
    const cached = this.apiKeyCache.get(apiKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.valid;
    }

    // Simplified validation: API key should be non-empty
    // In real Apigee, this would check against registered API keys
    const valid = apiKey.length >= 10; // Basic validation
    
    // Cache result (5 minutes)
    this.apiKeyCache.set(apiKey, {
      valid,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    return valid;
  }

  /**
   * Validate OAuth token (simplified validation)
   */
  private validateOAuthToken(token: string): boolean {
    // Check cache first
    const cached = this.oauthTokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.valid;
    }

    // Simplified validation: token should be non-empty
    // In real Apigee, this would validate against OAuth provider
    const valid = token.length >= 20; // Basic validation
    
    // Cache result (1 hour, typical OAuth token lifetime)
    this.oauthTokenCache.set(token, {
      valid,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    return valid;
  }

  /**
   * Validate JWT token (simplified validation)
   */
  private validateJWTToken(token: string, expectedIssuer: string): boolean {
    // Check cache first
    const cached = this.jwtTokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.valid && cached.issuer === expectedIssuer;
    }

    // Simplified validation: token should be non-empty and contain issuer
    // In real Apigee, this would decode and validate JWT signature
    const valid = token.length >= 20; // Basic validation
    
    // Cache result (1 hour, typical JWT lifetime)
    this.jwtTokenCache.set(token, {
      valid,
      issuer: expectedIssuer,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    return valid;
  }

  /**
   * Build target URL from proxy configuration
   */
  private buildTargetUrl(proxy: ApigeeProxy, remainingPath: string): string {
    const baseUrl = proxy.targetEndpoint.replace(/\/$/, '');
    const path = remainingPath.startsWith('/') ? remainingPath : `/${remainingPath}`;
    return `${baseUrl}${path}`;
  }

  /**
   * Simulate upstream latency
   */
  private simulateUpstreamLatency(target: string): number {
    // Base latency: 10-50ms
    const baseLatency = 10 + Math.random() * 40;
    
    // Add network jitter
    const jitter = (Math.random() - 0.5) * 10;
    
    return Math.max(1, baseLatency + jitter);
  }

  /**
   * Update proxy metrics
   */
  private updateProxyMetrics(proxyName: string, isError: boolean, latency: number): void {
    const metrics = this.proxyMetrics.get(proxyName);
    if (!metrics) return;

    metrics.requestCount++;
    if (isError) {
      metrics.errorCount++;
    }
    metrics.totalLatency += latency;
    metrics.lastRequestTime = Date.now();
  }

  /**
   * Get statistics
   */
  public getStats(): {
    proxies: number;
    policies: number;
    totalRequests: number;
    totalErrors: number;
    avgLatency: number;
  } {
    let totalRequests = 0;
    let totalErrors = 0;
    let totalLatency = 0;

    for (const metrics of this.proxyMetrics.values()) {
      totalRequests += metrics.requestCount;
      totalErrors += metrics.errorCount;
      totalLatency += metrics.totalLatency;
    }

    const avgLatency = totalRequests > 0 ? totalLatency / totalRequests : 0;

    return {
      proxies: this.proxies.size,
      policies: this.policies.length,
      totalRequests,
      totalErrors,
      avgLatency,
    };
  }

  /**
   * Get proxy metrics
   */
  public getProxyMetrics(proxyName: string): {
    requestCount: number;
    errorCount: number;
    avgResponseTime: number;
  } | null {
    const metrics = this.proxyMetrics.get(proxyName);
    if (!metrics) return null;

    return {
      requestCount: metrics.requestCount,
      errorCount: metrics.errorCount,
      avgResponseTime: metrics.requestCount > 0 
        ? metrics.totalLatency / metrics.requestCount 
        : 0,
    };
  }

  /**
   * Clear caches (useful for testing or reset)
   */
  public clearCaches(): void {
    this.apiKeyCache.clear();
    this.oauthTokenCache.clear();
    this.jwtTokenCache.clear();
  }
}


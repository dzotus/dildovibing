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
  executionFlow?: 'PreFlow' | 'RequestFlow' | 'ResponseFlow' | 'PostFlow' | 'ErrorFlow';
  condition?: string; // Optional condition for conditional execution
  config?: Record<string, any>;
}

export interface APIKeyConfig {
  key: string;
  consumerId?: string;
  appId?: string;
  products?: string[];
  expiresAt?: number;
  createdAt?: number;
}

export interface OAuthTokenConfig {
  token: string;
  tokenType?: 'Bearer' | 'OAuth';
  expiresAt?: number;
  scopes?: string[];
  clientId?: string;
}

export interface JWTConfig {
  issuer: string;
  audience?: string;
  publicKey?: string;
  algorithm?: string;
  allowedIssuers?: string[];
}

/**
 * API Product - groups proxies together for access control
 */
export interface ApigeeProduct {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  proxies: string[]; // Array of proxy names
  environments?: ('dev' | 'stage' | 'prod')[];
  quota?: number; // Product-level quota
  quotaInterval?: number; // seconds
  attributes?: Record<string, string>;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Developer App API Key
 */
export interface DeveloperAppKey {
  id: string;
  key: string;
  consumerKey?: string;
  consumerSecret?: string;
  status?: 'approved' | 'revoked';
  expiresAt?: number;
  createdAt: number;
  attributes?: Record<string, string>;
  apiProducts?: string[]; // Array of product IDs
}

/**
 * Developer App - represents a developer application
 */
export interface DeveloperApp {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  developerId?: string;
  developerEmail?: string;
  status?: 'approved' | 'pending' | 'revoked';
  apiProducts: string[]; // Array of product IDs
  keys: DeveloperAppKey[]; // Array of API keys
  attributes?: Record<string, string>;
  createdAt: number;
  updatedAt: number;
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
  private products: Map<string, ApigeeProduct> = new Map(); // product id -> product
  private developerApps: Map<string, DeveloperApp> = new Map(); // app id -> developer app
  private organization?: string;
  private environment?: string;
  
  // API Keys configuration (legacy, for backward compatibility)
  private apiKeys: APIKeyConfig[] = [];
  
  // OAuth tokens configuration
  private oauthTokens: OAuthTokenConfig[] = [];
  
  // JWT configuration
  private jwtConfigs: JWTConfig[] = [];
  
  // API Key usage tracking: Map<key, {appId, requestCount, lastUsed}>
  private keyUsageMetrics: Map<string, {
    appId: string;
    requestCount: number;
    lastUsed: number;
  }> = new Map();
  
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
    products?: ApigeeProduct[];
    developerApps?: DeveloperApp[];
    apiKeys?: APIKeyConfig[];
    oauthTokens?: OAuthTokenConfig[];
    jwtConfigs?: JWTConfig[];
  }) {
    // Clear previous state
    this.proxies.clear();
    this.policies = [];
    this.products.clear();
    this.developerApps.clear();
    this.quotaCounters.clear();
    this.spikeArrestBuckets.clear();
    this.apiKeyCache.clear();
    this.oauthTokenCache.clear();
    this.jwtTokenCache.clear();
    this.proxyMetrics.clear();
    this.keyUsageMetrics.clear();

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

    // Initialize products
    if (config.products) {
      for (const product of config.products) {
        this.products.set(product.id, { ...product });
      }
    }

    // Initialize Developer Apps
    if (config.developerApps) {
      for (const app of config.developerApps) {
        this.developerApps.set(app.id, { ...app });
        // Extract API keys from developer apps and add to apiKeys for validation
        for (const key of app.keys) {
          if (key.status === 'approved') {
            this.apiKeys.push({
              key: key.key,
              consumerId: app.developerId || app.id,
              appId: app.id,
              products: key.apiProducts || app.apiProducts,
              expiresAt: key.expiresAt,
              createdAt: key.createdAt,
            });
          }
        }
      }
    }

    // Initialize API Keys (legacy, for backward compatibility)
    if (config.apiKeys) {
      this.apiKeys = [...this.apiKeys, ...config.apiKeys];
    }

    // Initialize OAuth tokens
    if (config.oauthTokens) {
      this.oauthTokens = config.oauthTokens;
    }

    // Initialize JWT configs
    if (config.jwtConfigs) {
      this.jwtConfigs = config.jwtConfigs;
    }
  }

  /**
   * Update configuration without full reinitialization
   * Preserves caches and metrics state
   */
  public updateConfig(config: {
    organization?: string;
    environment?: string;
    proxies?: ApigeeProxy[];
    policies?: ApigeePolicy[];
    products?: ApigeeProduct[];
    developerApps?: DeveloperApp[];
    apiKeys?: APIKeyConfig[];
    oauthTokens?: OAuthTokenConfig[];
    jwtConfigs?: JWTConfig[];
  }): void {
    // Update organization and environment
    if (config.organization !== undefined) {
      this.organization = config.organization || 'archiphoenix-org';
    }
    if (config.environment !== undefined) {
      this.environment = config.environment || 'prod';
    }

    // Update proxies
    if (config.proxies !== undefined) {
      const existingProxyNames = new Set(this.proxies.keys());
      const newProxyNames = new Set(config.proxies.map(p => p.name));

      // Remove proxies that no longer exist
      for (const proxyName of existingProxyNames) {
        if (!newProxyNames.has(proxyName)) {
          this.proxies.delete(proxyName);
          this.quotaCounters.delete(proxyName);
          this.spikeArrestBuckets.delete(proxyName);
          this.proxyMetrics.delete(proxyName);
        }
      }

      // Add or update proxies
      for (const proxy of config.proxies) {
        const existing = this.proxies.has(proxy.name);
        this.proxies.set(proxy.name, { ...proxy });

        // Initialize metrics if new proxy
        if (!existing) {
          this.proxyMetrics.set(proxy.name, {
            requestCount: 0,
            errorCount: 0,
            totalLatency: 0,
            lastRequestTime: 0,
          });
        }

        // Update spike arrest bucket if configured
        if (proxy.spikeArrest && proxy.spikeArrest > 0) {
          const existingBucket = this.spikeArrestBuckets.get(proxy.name);
          if (existingBucket) {
            // Update rate, preserve tokens
            existingBucket.rate = proxy.spikeArrest;
          } else {
            // Create new bucket
            this.spikeArrestBuckets.set(proxy.name, {
              tokens: proxy.spikeArrest,
              lastRefill: Date.now(),
              rate: proxy.spikeArrest,
            });
          }
        } else {
          // Remove bucket if spike arrest disabled
          this.spikeArrestBuckets.delete(proxy.name);
        }
      }
    }

    // Update policies
    if (config.policies !== undefined) {
      this.policies = config.policies.filter(p => p.enabled);
    }

    // Update products
    if (config.products !== undefined) {
      const existingProductIds = new Set(this.products.keys());
      const newProductIds = new Set(config.products.map(p => p.id));

      // Remove products that no longer exist
      for (const productId of existingProductIds) {
        if (!newProductIds.has(productId)) {
          this.products.delete(productId);
        }
      }

      // Add or update products
      for (const product of config.products) {
        this.products.set(product.id, { ...product });
      }
    }

    // Update Developer Apps
    if (config.developerApps !== undefined) {
      const existingAppIds = new Set(this.developerApps.keys());
      const newAppIds = new Set(config.developerApps.map(a => a.id));

      // Remove apps that no longer exist
      for (const appId of existingAppIds) {
        if (!newAppIds.has(appId)) {
          this.developerApps.delete(appId);
        }
      }

      // Rebuild apiKeys from developer apps
      this.apiKeys = config.apiKeys || [];
      for (const app of config.developerApps) {
        this.developerApps.set(app.id, { ...app });
        // Extract API keys from developer apps
        for (const key of app.keys) {
          if (key.status === 'approved') {
            // Remove old key if exists
            this.apiKeys = this.apiKeys.filter(k => k.key !== key.key);
            // Add new key
            this.apiKeys.push({
              key: key.key,
              consumerId: app.developerId || app.id,
              appId: app.id,
              products: key.apiProducts || app.apiProducts,
              expiresAt: key.expiresAt,
              createdAt: key.createdAt,
            });
          }
        }
      }
      // Clear cache when API keys change
      this.apiKeyCache.clear();
    } else if (config.apiKeys !== undefined) {
      // Update API Keys (legacy, for backward compatibility)
      this.apiKeys = config.apiKeys;
      // Clear cache when API keys change
      this.apiKeyCache.clear();
    }

    // Update OAuth tokens
    if (config.oauthTokens !== undefined) {
      this.oauthTokens = config.oauthTokens;
      // Clear cache when OAuth tokens change
      this.oauthTokenCache.clear();
    }

    // Update JWT configs
    if (config.jwtConfigs !== undefined) {
      this.jwtConfigs = config.jwtConfigs;
      // Clear cache when JWT configs change
      this.jwtTokenCache.clear();
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

    // Step 6: Create initial response
    const response: ApigeeResponse = {
      status: 200,
      latency: totalLatency,
    };

    // Step 7: Execute ResponseFlow policies (response transformation)
    const responseFlowPolicies = this.policies.filter(p => 
      p.enabled && p.executionFlow === 'ResponseFlow'
    );
    this.executePolicies(responseFlowPolicies, request, match, 'ResponseFlow', response);

    // Step 8: Execute PostFlow policies (CORS, final transformation)
    const postFlowPolicies = this.policies.filter(p => 
      p.enabled && (p.executionFlow === 'PostFlow' || (!p.executionFlow && this.isPostFlowPolicy(p.type)))
    );
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
    flow: 'PreFlow' | 'RequestFlow' | 'ResponseFlow' | 'PostFlow' | 'ErrorFlow',
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
      } else if (flow === 'ResponseFlow' && response) {
        this.executeResponseFlowPolicy(policy, request, match, response);
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
      const quota = policy.config?.quota || policy.config?.allowCount || proxy.quota;
      let quotaInterval = policy.config?.interval || policy.config?.quotaInterval || proxy.quotaInterval;
      const timeUnit = policy.config?.timeUnit || 'second';
      
      // Convert interval to seconds based on time unit
      if (quotaInterval) {
        switch (timeUnit) {
          case 'minute':
            quotaInterval = quotaInterval * 60;
            break;
          case 'hour':
            quotaInterval = quotaInterval * 3600;
            break;
          case 'day':
            quotaInterval = quotaInterval * 86400;
            break;
          // 'second' is default, no conversion needed
        }
      }
      
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
      let rate = policy.config?.rate || proxy.spikeArrest;
      const timeUnit = policy.config?.timeUnit || 'second';
      
      // Convert rate to requests per second based on time unit
      if (rate && rate > 0) {
        if (timeUnit === 'minute') {
          rate = rate / 60; // Convert per minute to per second
        }
        
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
   * Execute a single ResponseFlow policy
   */
  private executeResponseFlowPolicy(
    policy: ApigeePolicy,
    request: ApigeeRequest,
    match: ProxyMatch,
    response: ApigeeResponse
  ): void {
    // ResponseFlow policies can transform response body, headers, status
    if (policy.type === 'xml-to-json') {
      // Transformation would happen here
      // For simulation, we just mark it
      if (!response.headers) {
        response.headers = {};
      }
      response.headers['Content-Type'] = 'application/json';
      
      // Apply XML to JSON transformation options from config
      const options = policy.config?.options;
      const attributes = policy.config?.attributes || 'prefix';
      const namespaces = policy.config?.namespaces || 'prefix';
      
      // In a real implementation, these would affect the transformation
      // For simulation, we just mark that transformation occurred
      if (options || attributes !== 'prefix' || namespaces !== 'prefix') {
        // Transformation applied with custom options
      }
    }

    // Custom response transformation based on policy config
    if (policy.config?.transformResponse) {
      // Apply custom transformations from config
      if (policy.config.statusCode) {
        response.status = policy.config.statusCode;
      }
      if (policy.config.responseHeaders) {
        if (!response.headers) {
          response.headers = {};
        }
        Object.assign(response.headers, policy.config.responseHeaders);
      }
    }
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
      const origins = policy.config?.origins || ['*'];
      const methods = policy.config?.methods || ['GET', 'POST', 'PUT', 'DELETE'];
      const headers = policy.config?.headers || ['Content-Type', 'Authorization'];
      const maxAge = policy.config?.maxAge || 3600;
      const allowCredentials = policy.config?.allowCredentials || false;
      
      response.headers['Access-Control-Allow-Origin'] = Array.isArray(origins) ? origins[0] : (origins || '*');
      response.headers['Access-Control-Allow-Methods'] = Array.isArray(methods) ? methods.join(', ') : methods;
      response.headers['Access-Control-Allow-Headers'] = Array.isArray(headers) ? headers.join(', ') : headers;
      response.headers['Access-Control-Max-Age'] = maxAge.toString();
      if (allowCredentials) {
        response.headers['Access-Control-Allow-Credentials'] = 'true';
      }
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
   * Validate API key against configured keys
   */
  private validateApiKey(apiKey: string): boolean {
    if (!apiKey || apiKey.trim() === '') {
      return false;
    }

    // Check cache first
    const cached = this.apiKeyCache.get(apiKey);
    if (cached && cached.expiresAt > Date.now()) {
      // Track usage
      if (cached.valid && cached.consumerId) {
        this.trackKeyUsage(apiKey, cached.consumerId);
      }
      return cached.valid;
    }

    // Check against configured API keys
    const keyConfig = this.apiKeys.find(k => k.key === apiKey);
    if (!keyConfig) {
      this.apiKeyCache.set(apiKey, {
        valid: false,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      return false;
    }
    
    // Check expiration if configured
    if (keyConfig.expiresAt && keyConfig.expiresAt < Date.now()) {
      this.apiKeyCache.set(apiKey, {
        valid: false,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      return false;
    }
    
    // Cache valid result (5 minutes)
    this.apiKeyCache.set(apiKey, {
      valid: true,
      consumerId: keyConfig.consumerId,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    
    // Track usage
    if (keyConfig.appId) {
      this.trackKeyUsage(apiKey, keyConfig.appId);
    }
    
    return true;
  }

  /**
   * Track API key usage for metrics
   */
  private trackKeyUsage(apiKey: string, appId: string): void {
    const existing = this.keyUsageMetrics.get(apiKey);
    if (existing) {
      existing.requestCount++;
      existing.lastUsed = Date.now();
    } else {
      this.keyUsageMetrics.set(apiKey, {
        appId,
        requestCount: 1,
        lastUsed: Date.now(),
      });
    }
  }

  /**
   * Validate OAuth token against configured tokens
   */
  private validateOAuthToken(token: string): boolean {
    if (!token || token.trim() === '') {
      return false;
    }

    // Check cache first
    const cached = this.oauthTokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.valid;
    }

    // Check against configured OAuth tokens
    const tokenConfig = this.oauthTokens.find(t => t.token === token);
    if (!tokenConfig) {
      this.oauthTokenCache.set(token, {
        valid: false,
        expiresAt: Date.now() + 60 * 60 * 1000,
      });
      return false;
    }

    // Check expiration if configured
    if (tokenConfig.expiresAt && tokenConfig.expiresAt < Date.now()) {
      this.oauthTokenCache.set(token, {
        valid: false,
        expiresAt: Date.now() + 60 * 60 * 1000,
      });
      return false;
    }
    
    // Cache valid result (1 hour, typical OAuth token lifetime)
    this.oauthTokenCache.set(token, {
      valid: true,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
    return true;
  }

  /**
   * Validate JWT token against configured JWT configs
   */
  private validateJWTToken(token: string, expectedIssuer: string): boolean {
    if (!token || token.trim() === '') {
      return false;
    }

    // Check cache first
    const cached = this.jwtTokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.valid && cached.issuer === expectedIssuer;
    }

    // Find JWT config for this issuer
    const jwtConfig = this.jwtConfigs.find(c => c.issuer === expectedIssuer);
    if (!jwtConfig) {
      // If no config found, check if issuer is in allowed issuers
      const hasAllowedIssuers = this.jwtConfigs.some(c => 
        c.allowedIssuers?.includes(expectedIssuer) || c.issuer === expectedIssuer
      );
      if (!hasAllowedIssuers) {
        this.jwtTokenCache.set(token, {
          valid: false,
          issuer: expectedIssuer,
          expiresAt: Date.now() + 60 * 60 * 1000,
        });
        return false;
      }
    }

    // Simplified JWT validation: check token structure (header.payload.signature)
    // In real Apigee, this would decode and validate JWT signature using public key
    const parts = token.split('.');
    const valid = parts.length === 3; // JWT has 3 parts
    
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
   * Get all products
   */
  public getProducts(): ApigeeProduct[] {
    return Array.from(this.products.values());
  }

  /**
   * Get product by ID
   */
  public getProduct(productId: string): ApigeeProduct | null {
    return this.products.get(productId) || null;
  }

  /**
   * Get products for a proxy
   */
  public getProductsForProxy(proxyName: string): ApigeeProduct[] {
    return Array.from(this.products.values()).filter(p => p.proxies.includes(proxyName));
  }

  /**
   * Get all developer apps
   */
  public getDeveloperApps(): DeveloperApp[] {
    return Array.from(this.developerApps.values());
  }

  /**
   * Get developer app by ID
   */
  public getDeveloperApp(appId: string): DeveloperApp | null {
    return this.developerApps.get(appId) || null;
  }

  /**
   * Get developer apps for a product
   */
  public getDeveloperAppsForProduct(productId: string): DeveloperApp[] {
    return Array.from(this.developerApps.values()).filter(app => 
      app.apiProducts.includes(productId)
    );
  }

  /**
   * Generate a new API key
   */
  public generateApiKey(): string {
    // Generate a random API key (32 characters, alphanumeric)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  }

  /**
   * Get API key usage metrics
   */
  public getKeyUsageMetrics(apiKey: string): {
    appId: string;
    requestCount: number;
    lastUsed: number;
  } | null {
    return this.keyUsageMetrics.get(apiKey) || null;
  }

  /**
   * Get all key usage metrics for an app
   */
  public getAppKeyUsageMetrics(appId: string): Map<string, {
    appId: string;
    requestCount: number;
    lastUsed: number;
  }> {
    const result = new Map();
    for (const [key, metrics] of this.keyUsageMetrics.entries()) {
      if (metrics.appId === appId) {
        result.set(key, metrics);
      }
    }
    return result;
  }

  /**
   * Get statistics
   */
  public getStats(): {
    proxies: number;
    policies: number;
    products: number;
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
      products: this.products.size,
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


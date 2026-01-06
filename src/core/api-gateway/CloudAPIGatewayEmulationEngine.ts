/**
 * Cloud API Gateway Emulation Engine
 * Multi-provider support: AWS API Gateway, Azure API Management, GCP Cloud Endpoints
 */

import type {
  BaseAPIGatewayConfig,
  GatewayProvider,
  API,
  APIKey,
  AWSGatewayConfig,
  AzureGatewayConfig,
  GCPGatewayConfig,
} from './types';

export interface GatewayRequest {
  path: string;
  method: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  apiKey?: string;
}

export interface GatewayResponse {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
  latency: number; // ms
  error?: string;
  metadata?: {
    gatewayProvider?: GatewayProvider;
    apiId?: string;
    keyId?: string;
    cacheHit?: boolean;
    rateLimitRemaining?: number;
    rateLimitReset?: number;
  };
}

export interface AuthResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  key?: APIKey;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining?: number;
  resetAt?: number;
}

/**
 * Base class for provider-specific gateway engines
 */
abstract class ProviderGatewayEngine {
  protected config: BaseAPIGatewayConfig;

  constructor(config: BaseAPIGatewayConfig) {
    this.config = config;
  }

  abstract authenticate(request: GatewayRequest, api: API): AuthResult;
  abstract checkRateLimit(request: GatewayRequest, api: API, key?: APIKey): RateLimitResult;
  abstract calculateLatency(request: GatewayRequest, api: API): number;
  abstract getCachedResponse(cacheKey: string, api: API): GatewayResponse | null;
  abstract setCachedResponse(cacheKey: string, response: GatewayResponse, ttl: number): void;
  abstract generateCacheKey(request: GatewayRequest, api: API): string;
  abstract getProviderSpecificMetrics(): Record<string, number>;
}

/**
 * AWS API Gateway Engine
 */
class AWSGatewayEngine extends ProviderGatewayEngine {
  private cache: Map<string, { response: GatewayResponse; expiresAt: number }> = new Map();
  private rateLimitCounters: Map<string, { count: number; resetAt: number }> = new Map();
  private awsConfig: AWSGatewayConfig;

  constructor(config: BaseAPIGatewayConfig) {
    super(config);
    this.awsConfig = config.providerConfig as AWSGatewayConfig;
  }

  authenticate(request: GatewayRequest, api: API): AuthResult {
    // Check API-level auth requirement first
    // If api.authRequired === false, skip authentication even if globally enabled
    if (api.authRequired === false) {
      return { success: true };
    }
    
    // If api.authRequired === true, require authentication even if globally disabled
    // If api.authRequired is undefined, use global setting
    const requiresAuth = api.authRequired !== undefined ? api.authRequired : this.config.enableAuthentication;
    
    if (!requiresAuth) {
      return { success: true };
    }

    if (this.config.authType === 'api-key' && this.config.keys) {
      const key = this.config.keys.find(k => k.key === request.apiKey || request.headers?.['x-api-key'] === k.key);
      if (!key || !key.enabled) {
        return { success: false, statusCode: 403, error: 'Invalid API Key' };
      }
      
      // Check if key has access to this API
      if (!key.apiIds.includes(api.id)) {
        return { success: false, statusCode: 403, error: 'API Key does not have access to this API' };
      }

      // Check auth scopes if specified for OAuth2/JWT
      if (api.authScopes && api.authScopes.length > 0 && this.config.authType !== 'api-key') {
        // In real implementation, would validate scopes from token
        // For now, assume valid if key exists
      }

      return { success: true, key };
    }

    // AWS: Lambda Authorizer (if configured)
    if (this.awsConfig.authorizers && this.awsConfig.authorizers.length > 0) {
      // Simplified: assume authorizer passes if API key is valid
      // In real implementation, would call Lambda function
      const authLatency = 20; // Lambda authorizer overhead
      return { success: true };
    }

    return { success: false, statusCode: 401, error: 'Unauthorized' };
  }

  checkRateLimit(request: GatewayRequest, api: API, key?: APIKey): RateLimitResult {
    if (!this.config.enableRateLimiting) {
      return { allowed: true };
    }

    const now = Date.now();
    const limitKey = key ? `key-${key.id}` : `api-${api.id}`;
    const limit = key?.rateLimit || api.rateLimit || this.config.defaultRateLimit || 1000;
    const windowMs = 60 * 1000; // 1 minute window

    const counter = this.rateLimitCounters.get(limitKey);
    if (!counter || counter.resetAt < now) {
      // Reset counter
      this.rateLimitCounters.set(limitKey, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
    }

    if (counter.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: counter.resetAt };
    }

    counter.count++;
    return { allowed: true, remaining: limit - counter.count, resetAt: counter.resetAt };
  }

  calculateLatency(request: GatewayRequest, api: API): number {
    // AWS base latency: 50-100ms
    let latency = 50 + Math.random() * 50;

    // Add latency for authentication
    if (this.config.enableAuthentication) {
      latency += 10;
      if (this.awsConfig.authorizers && this.awsConfig.authorizers.length > 0) {
        latency += 20; // Lambda authorizer overhead
      }
    }

    // Add latency for rate limiting check
    if (this.config.enableRateLimiting) {
      latency += 5;
    }

    // Add latency for caching check
    const cachingEnabled = api.caching?.enabled !== undefined 
      ? api.caching.enabled 
      : this.config.enableCaching;
    if (cachingEnabled) {
      latency += 3;
    }

    // Add latency for logging
    if (this.config.enableRequestLogging) {
      latency += 2;
    }

    // Add latency for X-Ray if enabled
    if (this.awsConfig.enableXRay) {
      latency += 5;
    }

    // Add latency based on utilization (simulate load)
    const utilization = this.calculateUtilization();
    latency += utilization * 30; // Up to 30ms additional latency under load

    return Math.round(latency);
  }

  getCachedResponse(cacheKey: string, api: API): GatewayResponse | null {
    // Check API-level caching first
    const cachingEnabled = api.caching?.enabled !== undefined 
      ? api.caching.enabled 
      : this.config.enableCaching;
    
    if (!cachingEnabled) {
      return null;
    }

    const cached = this.cache.get(cacheKey);
    if (!cached || cached.expiresAt < Date.now()) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.response;
  }

  setCachedResponse(cacheKey: string, response: GatewayResponse, ttl: number): void {
    const expiresAt = Date.now() + (ttl * 1000);
    this.cache.set(cacheKey, { response, expiresAt });
  }

  generateCacheKey(request: GatewayRequest, api: API): string {
    const cacheParams = api.caching?.cacheKey || ['method', 'path'];
    const keyParts = cacheParams.map(param => {
      if (param === 'method') return request.method;
      if (param === 'path') return request.path;
      if (param === 'query') return JSON.stringify(request.query || {});
      return request.headers?.[param] || '';
    });
    return `${api.id}:${keyParts.join(':')}`;
  }

  getProviderSpecificMetrics(): Record<string, number> {
    return {
      cacheHitRate: this.calculateCacheHitRate(),
      xRayEnabled: this.awsConfig.enableXRay ? 1 : 0,
      stagesCount: this.awsConfig.stages?.length || 0,
      usagePlansCount: this.awsConfig.usagePlans?.length || 0,
    };
  }

  private calculateUtilization(): number {
    // Simplified: calculate based on rate limit counters
    const totalRequests = Array.from(this.rateLimitCounters.values())
      .reduce((sum, c) => sum + c.count, 0);
    const maxCapacity = (this.config.defaultRateLimit || 1000) * (this.config.apis?.length || 1);
    return Math.min(totalRequests / maxCapacity, 1);
  }

  private calculateCacheHitRate(): number {
    // Simplified cache hit rate calculation
    return 0.3; // 30% cache hit rate (would be calculated from real cache stats)
  }
}

/**
 * Azure API Management Engine
 */
class AzureGatewayEngine extends ProviderGatewayEngine {
  private cache: Map<string, { response: GatewayResponse; expiresAt: number }> = new Map();
  private rateLimitCounters: Map<string, { count: number; resetAt: number }> = new Map();
  private azureConfig: AzureGatewayConfig;

  constructor(config: BaseAPIGatewayConfig) {
    super(config);
    this.azureConfig = config.providerConfig as AzureGatewayConfig;
  }

  authenticate(request: GatewayRequest, api: API): AuthResult {
    // Check API-level auth requirement first
    if (api.authRequired === false) {
      return { success: true };
    }
    
    const requiresAuth = api.authRequired !== undefined ? api.authRequired : this.config.enableAuthentication;
    
    if (!requiresAuth) {
      return { success: true };
    }

    // Azure: Check Subscription Key
    if (this.config.authType === 'api-key') {
      const subscriptionKey = request.headers?.['ocp-apim-subscription-key'] || 
                             request.query?.['subscription-key'] ||
                             request.apiKey;
      
      if (!subscriptionKey) {
        return { success: false, statusCode: 401, error: 'Missing subscription key' };
      }

      // Find subscription by key
      const subscription = this.azureConfig.subscriptions?.find(
        s => s.primaryKey === subscriptionKey || s.secondaryKey === subscriptionKey
      );

      if (!subscription || subscription.state !== 'active') {
        return { success: false, statusCode: 401, error: 'Invalid subscription key' };
      }

      // Check product access
      const product = this.azureConfig.products?.find(p => p.apis?.includes(api.id));
      if (product && product.subscriptionRequired && subscription.productId !== product.id) {
        return { success: false, statusCode: 403, error: 'Subscription does not have access to this API' };
      }

      return { success: true };
    }

    return { success: false, statusCode: 401, error: 'Unauthorized' };
  }

  checkRateLimit(request: GatewayRequest, api: API, key?: APIKey): RateLimitResult {
    if (!this.config.enableRateLimiting) {
      return { allowed: true };
    }

    // Azure uses subscription-based rate limiting
    const subscriptionKey = request.headers?.['ocp-apim-subscription-key'] || request.query?.['subscription-key'];
    const subscription = this.azureConfig.subscriptions?.find(
      s => s.primaryKey === subscriptionKey || s.secondaryKey === subscriptionKey
    );

    const now = Date.now();
    const limitKey = subscription ? `sub-${subscription.id}` : `api-${api.id}`;
    const limit = api.rateLimit || this.config.defaultRateLimit || 1000;
    const windowMs = 60 * 1000;

    const counter = this.rateLimitCounters.get(limitKey);
    if (!counter || counter.resetAt < now) {
      this.rateLimitCounters.set(limitKey, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
    }

    if (counter.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: counter.resetAt };
    }

    counter.count++;
    return { allowed: true, remaining: limit - counter.count, resetAt: counter.resetAt };
  }

  calculateLatency(request: GatewayRequest, api: API): number {
    // Azure base latency: 30-80ms
    let latency = 30 + Math.random() * 50;

    // Policy execution overhead
    const policyCount = this.azureConfig.policies?.filter(
      p => p.scope === 'Global' || p.scope === 'API' || (p.scope === 'Operation' && p.scopeId === api.id)
    ).length || 0;
    latency += policyCount * 5;

    // Authentication overhead
    if (this.config.enableAuthentication) {
      latency += 8;
    }

    // Rate limiting overhead
    if (this.config.enableRateLimiting) {
      latency += 4;
    }

    // Caching overhead
    const cachingEnabled = api.caching?.enabled !== undefined 
      ? api.caching.enabled 
      : this.config.enableCaching;
    if (cachingEnabled) {
      latency += 2;
    }

    // Application Insights overhead
    if (this.azureConfig.enableApplicationInsights) {
      latency += 3;
    }

    // Utilization-based latency
    const utilization = this.calculateUtilization();
    latency += utilization * 25;

    return Math.round(latency);
  }

  getCachedResponse(cacheKey: string, api: API): GatewayResponse | null {
    // Check API-level caching first
    const cachingEnabled = api.caching?.enabled !== undefined 
      ? api.caching.enabled 
      : this.config.enableCaching;
    
    if (!cachingEnabled) {
      return null;
    }

    const cached = this.cache.get(cacheKey);
    if (!cached || cached.expiresAt < Date.now()) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.response;
  }

  setCachedResponse(cacheKey: string, response: GatewayResponse, ttl: number): void {
    const expiresAt = Date.now() + (ttl * 1000);
    this.cache.set(cacheKey, { response, expiresAt });
  }

  generateCacheKey(request: GatewayRequest, api: API): string {
    const cacheParams = api.caching?.cacheKey || ['method', 'path'];
    const keyParts = cacheParams.map(param => {
      if (param === 'method') return request.method;
      if (param === 'path') return request.path;
      if (param === 'query') return JSON.stringify(request.query || {});
      return request.headers?.[param] || '';
    });
    return `${api.id}:${keyParts.join(':')}`;
  }

  getProviderSpecificMetrics(): Record<string, number> {
    return {
      cacheHitRate: this.calculateCacheHitRate(),
      productsCount: this.azureConfig.products?.length || 0,
      subscriptionsCount: this.azureConfig.subscriptions?.length || 0,
      policiesCount: this.azureConfig.policies?.length || 0,
      applicationInsightsEnabled: this.azureConfig.enableApplicationInsights ? 1 : 0,
    };
  }

  private calculateUtilization(): number {
    const totalRequests = Array.from(this.rateLimitCounters.values())
      .reduce((sum, c) => sum + c.count, 0);
    const maxCapacity = (this.config.defaultRateLimit || 1000) * (this.config.apis?.length || 1);
    return Math.min(totalRequests / maxCapacity, 1);
  }

  private calculateCacheHitRate(): number {
    return 0.25; // 25% cache hit rate
  }
}

/**
 * GCP Cloud Endpoints Engine
 */
class GCPGatewayEngine extends ProviderGatewayEngine {
  private cache: Map<string, { response: GatewayResponse; expiresAt: number }> = new Map();
  private rateLimitCounters: Map<string, { count: number; resetAt: number }> = new Map();
  private gcpConfig: GCPGatewayConfig;

  constructor(config: BaseAPIGatewayConfig) {
    super(config);
    this.gcpConfig = config.providerConfig as GCPGatewayConfig;
  }

  authenticate(request: GatewayRequest, api: API): AuthResult {
    // Check API-level auth requirement first
    if (api.authRequired === false) {
      return { success: true };
    }
    
    const requiresAuth = api.authRequired !== undefined ? api.authRequired : this.config.enableAuthentication;
    
    if (!requiresAuth) {
      return { success: true };
    }

    // GCP: Check API Key with restrictions
    if (this.config.authType === 'api-key' && this.config.keys) {
      const apiKey = request.headers?.['x-api-key'] || request.query?.['key'] || request.apiKey;
      
      if (!apiKey) {
        return { success: false, statusCode: 401, error: 'Missing API key' };
      }

      const key = this.config.keys.find(k => k.key === apiKey);
      if (!key || !key.enabled) {
        return { success: false, statusCode: 403, error: 'Invalid API key' };
      }

      // Check API key restrictions
      const restrictions = key.providerMetadata?.gcp?.restrictions;
      if (restrictions) {
        // Check API targets
        if (restrictions.apiTargets && !restrictions.apiTargets.some(
          target => target.service === this.gcpConfig.serviceName && 
                   (target.methods.includes(api.method) || target.methods.includes('*'))
        )) {
          return { success: false, statusCode: 403, error: 'API key does not have access to this endpoint' };
        }

        // Check HTTP referrers
        if (restrictions.httpReferrers && request.headers?.['referer']) {
          const referer = request.headers['referer'];
          if (!restrictions.httpReferrers.some(ref => referer.includes(ref))) {
            return { success: false, statusCode: 403, error: 'API key restricted by referer' };
          }
        }

        // Check IP addresses
        if (restrictions.ipAddresses && request.headers?.['x-forwarded-for']) {
          const clientIp = request.headers['x-forwarded-for'].split(',')[0].trim();
          // Simplified IP check (would need proper CIDR matching in real implementation)
          if (!restrictions.ipAddresses.some(ip => clientIp.startsWith(ip))) {
            return { success: false, statusCode: 403, error: 'API key restricted by IP address' };
          }
        }
      }

      // Check API access
      if (!key.apiIds.includes(api.id)) {
        return { success: false, statusCode: 403, error: 'API key does not have access to this API' };
      }

      return { success: true, key };
    }

    return { success: false, statusCode: 401, error: 'Unauthorized' };
  }

  checkRateLimit(request: GatewayRequest, api: API, key?: APIKey): RateLimitResult {
    if (!this.config.enableRateLimiting) {
      return { allowed: true };
    }

    // Check quota limits
    const quota = this.gcpConfig.quotas?.find(q => q.metric === 'requests');
    if (quota) {
      const now = Date.now();
      const limitKey = `quota-${quota.id}`;
      const counter = this.rateLimitCounters.get(limitKey);
      
      if (!counter || counter.resetAt < now) {
        this.rateLimitCounters.set(limitKey, { count: 1, resetAt: now + 60000 });
        return { allowed: true, remaining: quota.limit - 1, resetAt: now + 60000 };
      }

      if (counter.count >= quota.limit) {
        return { allowed: false, remaining: 0, resetAt: counter.resetAt };
      }

      counter.count++;
      return { allowed: true, remaining: quota.limit - counter.count, resetAt: counter.resetAt };
    }

    // Fallback to standard rate limiting
    const now = Date.now();
    const limitKey = key ? `key-${key.id}` : `api-${api.id}`;
    const limit = key?.rateLimit || api.rateLimit || this.config.defaultRateLimit || 1000;
    const windowMs = 60 * 1000;

    const counter = this.rateLimitCounters.get(limitKey);
    if (!counter || counter.resetAt < now) {
      this.rateLimitCounters.set(limitKey, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
    }

    if (counter.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: counter.resetAt };
    }

    counter.count++;
    return { allowed: true, remaining: limit - counter.count, resetAt: counter.resetAt };
  }

  calculateLatency(request: GatewayRequest, api: API): number {
    // GCP base latency: 40-90ms
    let latency = 40 + Math.random() * 50;

    // OpenAPI validation overhead
    if (this.gcpConfig.openApiSpec) {
      latency += 15;
    }

    // ESP (Extensible Service Proxy) overhead
    latency += 10;

    // Authentication overhead
    if (this.config.enableAuthentication) {
      latency += 12;
    }

    // Rate limiting overhead
    if (this.config.enableRateLimiting) {
      latency += 5;
    }

    // Caching overhead
    const cachingEnabled = api.caching?.enabled !== undefined 
      ? api.caching.enabled 
      : this.config.enableCaching;
    if (cachingEnabled) {
      latency += 3;
    }

    // Cloud Logging overhead
    if (this.gcpConfig.enableCloudLogging) {
      latency += 4;
    }

    // Utilization-based latency
    const utilization = this.calculateUtilization();
    latency += utilization * 30;

    return Math.round(latency);
  }

  getCachedResponse(cacheKey: string, api: API): GatewayResponse | null {
    // Check API-level caching first
    const cachingEnabled = api.caching?.enabled !== undefined 
      ? api.caching.enabled 
      : this.config.enableCaching;
    
    if (!cachingEnabled) {
      return null;
    }

    const cached = this.cache.get(cacheKey);
    if (!cached || cached.expiresAt < Date.now()) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.response;
  }

  setCachedResponse(cacheKey: string, response: GatewayResponse, ttl: number): void {
    const expiresAt = Date.now() + (ttl * 1000);
    this.cache.set(cacheKey, { response, expiresAt });
  }

  generateCacheKey(request: GatewayRequest, api: API): string {
    const cacheParams = api.caching?.cacheKey || ['method', 'path'];
    const keyParts = cacheParams.map(param => {
      if (param === 'method') return request.method;
      if (param === 'path') return request.path;
      if (param === 'query') return JSON.stringify(request.query || {});
      return request.headers?.[param] || '';
    });
    return `${api.id}:${keyParts.join(':')}`;
  }

  getProviderSpecificMetrics(): Record<string, number> {
    return {
      cacheHitRate: this.calculateCacheHitRate(),
      quotasCount: this.gcpConfig.quotas?.length || 0,
      serviceAccountsCount: this.gcpConfig.serviceAccounts?.length || 0,
      openApiSpecSize: this.gcpConfig.openApiSpec?.length || 0,
      cloudLoggingEnabled: this.gcpConfig.enableCloudLogging ? 1 : 0,
      cloudMonitoringEnabled: this.gcpConfig.enableCloudMonitoring ? 1 : 0,
    };
  }

  private calculateUtilization(): number {
    const totalRequests = Array.from(this.rateLimitCounters.values())
      .reduce((sum, c) => sum + c.count, 0);
    const maxCapacity = (this.config.defaultRateLimit || 1000) * (this.config.apis?.length || 1);
    return Math.min(totalRequests / maxCapacity, 1);
  }

  private calculateCacheHitRate(): number {
    return 0.35; // 35% cache hit rate
  }
}

/**
 * Cloud API Gateway Emulation Engine
 * Main entry point for multi-provider API Gateway simulation
 */
export class CloudAPIGatewayEmulationEngine {
  private config: BaseAPIGatewayConfig;
  private providerEngine: ProviderGatewayEngine;
  private requestCount: number = 0;
  private errorCount: number = 0;
  private totalLatency: number = 0;
  private latencyHistory: number[] = [];

  constructor(config: BaseAPIGatewayConfig) {
    this.config = config;
    
    // Initialize provider-specific engine
    switch (config.provider) {
      case 'aws':
        this.providerEngine = new AWSGatewayEngine(config);
        break;
      case 'azure':
        this.providerEngine = new AzureGatewayEngine(config);
        break;
      case 'gcp':
        this.providerEngine = new GCPGatewayEngine(config);
        break;
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  /**
   * Process incoming request through gateway
   */
  processRequest(request: GatewayRequest): GatewayResponse {
    // 1. Find matching API route
    const api = this.findRoute(request);
    if (!api || !api.enabled) {
      return {
        status: 404,
        latency: 5,
        error: 'API not found',
        metadata: {
          gatewayProvider: this.config.provider,
        },
      };
    }

    // 2. Authentication
    const authResult = this.providerEngine.authenticate(request, api);
    if (!authResult.success) {
      this.errorCount++;
      return {
        status: authResult.statusCode || 401,
        latency: this.providerEngine.calculateLatency(request, api),
        error: authResult.error,
        metadata: {
          gatewayProvider: this.config.provider,
          apiId: api.id,
        },
      };
    }

    // 3. Rate Limiting
    const rateLimitResult = this.providerEngine.checkRateLimit(request, api, authResult.key);
    if (!rateLimitResult.allowed) {
      this.errorCount++;
      return {
        status: 429,
        latency: this.providerEngine.calculateLatency(request, api),
        error: 'Rate limit exceeded',
        headers: {
          'X-RateLimit-Limit': String(api.rateLimit || this.config.defaultRateLimit || 1000),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimitResult.resetAt || Date.now() + 60000),
        },
        metadata: {
          gatewayProvider: this.config.provider,
          apiId: api.id,
          keyId: authResult.key?.id,
        },
      };
    }

    // 4. Caching
    const cacheKey = this.providerEngine.generateCacheKey(request, api);
    const cachedResponse = this.providerEngine.getCachedResponse(cacheKey, api);
    if (cachedResponse) {
      this.requestCount++;
      return {
        ...cachedResponse,
        metadata: {
          ...cachedResponse.metadata,
          cacheHit: true,
        },
      };
    }

    // 5. Calculate gateway latency
    const gatewayLatency = this.providerEngine.calculateLatency(request, api);
    
    // 6. Check timeout
    const apiTimeout = api.timeout || this.config.requestTimeout || 30;
    const timeoutMs = apiTimeout * 1000;
    
    // Simulate backend processing time (would be actual backend call in real implementation)
    // For simulation, add some latency variation
    const simulatedBackendLatency = gatewayLatency + Math.random() * 100;
    
    // If timeout exceeded, return 504 Gateway Timeout
    if (simulatedBackendLatency > timeoutMs) {
      this.errorCount++;
      return {
        status: 504,
        latency: timeoutMs,
        error: 'Gateway Timeout',
        metadata: {
          gatewayProvider: this.config.provider,
          apiId: api.id,
          keyId: authResult.key?.id,
        },
      };
    }
    
    // Increase latency as we approach timeout (simulate slowdown)
    const timeoutRatio = simulatedBackendLatency / timeoutMs;
    const finalLatency = timeoutRatio > 0.8 
      ? Math.min(simulatedBackendLatency + (timeoutRatio - 0.8) * 200, timeoutMs - 10)
      : simulatedBackendLatency;

    this.requestCount++;
    this.totalLatency += finalLatency;
    this.latencyHistory.push(finalLatency);
    if (this.latencyHistory.length > 100) {
      this.latencyHistory.shift();
    }

    // 7. Cache response if caching is enabled
    const cachingEnabled = api.caching?.enabled !== undefined 
      ? api.caching.enabled 
      : this.config.enableCaching;
    
    const response: GatewayResponse = {
      status: 200,
      latency: Math.round(finalLatency),
      metadata: {
        gatewayProvider: this.config.provider,
        apiId: api.id,
        keyId: authResult.key?.id,
        cacheHit: false,
        rateLimitRemaining: rateLimitResult.remaining,
        rateLimitReset: rateLimitResult.resetAt,
      },
    };
    
    if (cachingEnabled) {
      const ttl = api.caching?.ttl || this.config.cacheTTL || 300;
      this.providerEngine.setCachedResponse(cacheKey, response, ttl);
    }

    // 8. Return response (would forward to backend in real implementation)
    return {
      status: 200,
      latency: Math.round(finalLatency),
      metadata: {
        gatewayProvider: this.config.provider,
        apiId: api.id,
        keyId: authResult.key?.id,
        cacheHit: false,
        rateLimitRemaining: rateLimitResult.remaining,
        rateLimitReset: rateLimitResult.resetAt,
      },
    };
  }

  /**
   * Find matching API route
   */
  private findRoute(request: GatewayRequest): API | undefined {
    if (!this.config.apis) {
      return undefined;
    }

    // Find exact match first
    let match = this.config.apis.find(
      api => api.path === request.path && 
             (api.method === request.method || api.method === 'ALL') &&
             api.enabled
    );

    // If no exact match, try path prefix matching
    if (!match) {
      match = this.config.apis.find(
        api => request.path.startsWith(api.path) &&
               (api.method === request.method || api.method === 'ALL') &&
               api.enabled
      );
    }

    return match;
  }

  /**
   * Calculate gateway metrics
   */
  calculateMetrics(): {
    throughput: number;
    latency: number;
    latencyP50?: number;
    latencyP95?: number;
    latencyP99?: number;
    errorRate: number;
    utilization: number;
    customMetrics: Record<string, number>;
  } {
    const throughput = this.requestCount / 60; // requests per second (assuming 60s window)
    const avgLatency = this.requestCount > 0 ? this.totalLatency / this.requestCount : 0;
    
    // Calculate percentiles
    const sortedLatency = [...this.latencyHistory].sort((a, b) => a - b);
    const p50 = sortedLatency.length > 0 ? sortedLatency[Math.floor(sortedLatency.length * 0.5)] : undefined;
    const p95 = sortedLatency.length > 0 ? sortedLatency[Math.floor(sortedLatency.length * 0.95)] : undefined;
    const p99 = sortedLatency.length > 0 ? sortedLatency[Math.floor(sortedLatency.length * 0.99)] : undefined;

    const errorRate = this.requestCount > 0 ? this.errorCount / this.requestCount : 0;
    
    // Calculate utilization
    const maxCapacity = (this.config.defaultRateLimit || 1000) * (this.config.apis?.length || 1);
    const utilization = Math.min(throughput / maxCapacity, 1);

    // Get provider-specific metrics
    const providerMetrics = this.providerEngine.getProviderSpecificMetrics();

    return {
      throughput,
      latency: avgLatency,
      latencyP50: p50,
      latencyP95: p95,
      latencyP99: p99,
      errorRate,
      utilization,
      customMetrics: {
        ...providerMetrics,
        totalRequests: this.requestCount,
        totalErrors: this.errorCount,
        apisCount: this.config.apis?.length || 0,
        keysCount: this.config.keys?.length || 0,
      },
    };
  }

  /**
   * Reset metrics (called periodically)
   */
  resetMetrics() {
    this.requestCount = 0;
    this.errorCount = 0;
    this.totalLatency = 0;
    this.latencyHistory = [];
  }

  /**
   * Update configuration
   */
  updateConfig(config: BaseAPIGatewayConfig) {
    this.config = config;
    
    // Reinitialize provider engine
    switch (config.provider) {
      case 'aws':
        this.providerEngine = new AWSGatewayEngine(config);
        break;
      case 'azure':
        this.providerEngine = new AzureGatewayEngine(config);
        break;
      case 'gcp':
        this.providerEngine = new GCPGatewayEngine(config);
        break;
    }
  }
}


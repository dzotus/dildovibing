/**
 * Webhook Emulation Engine
 * Симулирует работу Webhook Endpoint: обработка входящих запросов, доставка на настроенные endpoints, retry логика, метрики
 */

import { CanvasNode, CanvasConnection } from '@/types';

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  secret?: string;
  enabled: boolean;
  events: string[];
  headers?: Record<string, string>;
  allowedIPs?: string[];
  timeoutDuration?: number;
  errorRate?: number;
  payloadTransformation?: {
    enabled: boolean;
    template?: string; // JSON template with placeholders
    addFields?: Record<string, string>; // Fields to add
    removeFields?: string[]; // Fields to remove
    transformFields?: Record<string, string>; // Field transformations (JSONPath-like)
  };
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: string;
  payload: string;
  status: 'pending' | 'success' | 'failed';
  timestamp: string;
  attempts: number;
  responseCode?: number;
  responseBody?: string;
  error?: string;
  latency?: number;
  retryHistory?: Array<{ attempt: number; timestamp: string; status: number; error?: string }>;
}

export interface WebhookConfig {
  endpoints?: WebhookEndpoint[];
  enableRetryOnFailure?: boolean;
  enableSignatureVerification?: boolean;
  maxRetryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  retryBackoff?: 'exponential' | 'linear' | 'constant';
  enableRateLimiting?: boolean;
  rateLimitPerMinute?: number;
  endpoint?: string;
  httpMethod?: 'POST' | 'PUT' | 'PATCH';
  enableSignature?: boolean;
  signatureHeader?: string;
  signatureAlgorithm?: 'sha256' | 'sha512' | 'hmac-sha256';
  enableTimeout?: boolean;
  timeoutDuration?: number;
  errorRate?: number;
}

export interface WebhookEngineMetrics {
  endpointsTotal: number;
  endpointsEnabled: number;
  deliveriesTotal: number;
  deliveriesSuccess: number;
  deliveriesFailed: number;
  deliveriesPending: number;
  successRate: number;
  averageLatency: number;
  requestsPerSecond: number;
  errorRate: number;
  retriesTotal: number;
  utilization: number;
}

export interface WebhookRequest {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body: unknown;
  event?: string;
  ip?: string;
}

export interface WebhookResponse {
  success: boolean;
  status: number;
  latency: number;
  deliveryId?: string;
  attempts: number;
  error?: string;
}

/**
 * Webhook Emulation Engine
 * Симулирует работу Webhook Endpoint
 */
export class WebhookEmulationEngine {
  private config: WebhookConfig | null = null;
  
  // Endpoints
  private endpoints: Map<string, WebhookEndpoint> = new Map();
  
  // Deliveries
  private deliveries: Map<string, WebhookDelivery> = new Map();
  private readonly MAX_DELIVERY_HISTORY = 1000;
  
  // Metrics
  private webhookMetrics: WebhookEngineMetrics = {
    endpointsTotal: 0,
    endpointsEnabled: 0,
    deliveriesTotal: 0,
    deliveriesSuccess: 0,
    deliveriesFailed: 0,
    deliveriesPending: 0,
    successRate: 0,
    averageLatency: 0,
    requestsPerSecond: 0,
    errorRate: 0,
    retriesTotal: 0,
    utilization: 0,
  };
  
  // Delivery history for metrics
  private deliveryHistory: Array<{ timestamp: number; latency: number; status: 'success' | 'failed' }> = [];
  private readonly MAX_DELIVERY_HISTORY_LIST = 1000;
  
  // Request tracking for RPS
  private requestTimestamps: number[] = [];
  private readonly RPS_WINDOW_MS = 1000;
  
  // Rate limiting tracking - multiple strategies
  private rateLimitWindowStart: number = Date.now();
  private rateLimitRequestsInWindow: number = 0;
  
  // Token bucket for rate limiting
  private tokenBucket: {
    tokens: number;
    capacity: number;
    refillRate: number; // tokens per second
    lastRefill: number;
  } | null = null;
  
  // Sliding window for rate limiting
  private slidingWindow: Array<{ timestamp: number }> = [];
  private rateLimitStrategy: 'fixed' | 'token-bucket' | 'sliding-window' = 'fixed';
  
  /**
   * Обрабатывает входящий webhook запрос
   */
  processWebhookRequest(request: WebhookRequest): WebhookResponse {
    const startTime = Date.now();
    
    if (!this.config) {
      return {
        success: false,
        status: 500,
        latency: Date.now() - startTime,
        attempts: 0,
        error: 'Webhook endpoint not configured',
      };
    }
    
    // Check IP whitelisting
    if (request.ip) {
      const matchingEndpoint = Array.from(this.endpoints.values()).find(e => 
        e.enabled && this.isIPAllowed(request.ip!, e.allowedIPs)
      );
      if (!matchingEndpoint && Array.from(this.endpoints.values()).some(e => e.allowedIPs && e.allowedIPs.length > 0)) {
        // At least one endpoint has IP restrictions, check if IP is allowed
        const hasAllowedEndpoint = Array.from(this.endpoints.values()).some(e => 
          e.enabled && this.isIPAllowed(request.ip!, e.allowedIPs)
        );
        if (!hasAllowedEndpoint) {
          return {
            success: false,
            status: 403,
            latency: Date.now() - startTime,
            attempts: 0,
            error: 'IP address not allowed',
          };
        }
      }
    }
    
    // Check rate limiting
    if (this.config.enableRateLimiting && this.config.rateLimitPerMinute) {
      if (!this.checkRateLimit()) {
        return {
          success: false,
          status: 429,
          latency: Date.now() - startTime,
          attempts: 0,
          error: 'Rate limit exceeded',
        };
      }
    }
    
    // Verify signature if enabled
    if (this.config.enableSignatureVerification || this.config.enableSignature) {
      const signatureHeader = this.config.signatureHeader || 'X-Signature';
      if (!this.verifySignature(request, signatureHeader)) {
        this.webhookMetrics.deliveriesFailed++;
        this.webhookMetrics.deliveriesTotal++;
        this.updateErrorRate();
        return {
          success: false,
          status: 401,
          latency: Date.now() - startTime,
          attempts: 0,
          error: 'Invalid signature',
        };
      }
    }
    
    // Track request
    const now = Date.now();
    this.requestTimestamps.push(now);
    // Clean up old timestamps (older than 1 second)
    this.cleanupOldRequestTimestamps();
    // Calculate RPS: count requests in the last second (after cleanup)
    this.webhookMetrics.requestsPerSecond = this.requestTimestamps.length;
    
    // Process webhook - deliver to all enabled endpoints that match the event
    const event = request.event || request.headers?.['x-event'] || request.headers?.['x-github-event'] || 'default';
    const matchingEndpoints = this.getMatchingEndpoints(event);
    
    if (matchingEndpoints.length === 0) {
      // No matching endpoints, but request was received
      return {
        success: true,
        status: 200,
        latency: Date.now() - startTime,
        attempts: 0,
      };
    }
    
    // Deliver to all matching endpoints
    let allSuccess = true;
    let deliveryIds: string[] = [];
    
    for (const endpoint of matchingEndpoints) {
      const deliveryResult = this.deliverToEndpoint(endpoint, request, event);
      if (deliveryResult.deliveryId) {
        deliveryIds.push(deliveryResult.deliveryId);
      }
      if (!deliveryResult.success) {
        allSuccess = false;
      }
    }
    
    const latency = Date.now() - startTime;
    this.updateAverageLatency(latency);
    
    return {
      success: allSuccess,
      status: allSuccess ? 200 : 500,
      latency,
      deliveryId: deliveryIds[0],
      attempts: 1,
    };
  }
  
  /**
   * Transform payload based on endpoint configuration
   */
  private transformPayload(
    payload: any,
    endpoint: WebhookEndpoint
  ): any {
    if (!endpoint.payloadTransformation?.enabled) {
      return payload;
    }

    let transformed = typeof payload === 'string' 
      ? JSON.parse(payload) 
      : { ...payload };

    // Remove fields
    if (endpoint.payloadTransformation.removeFields) {
      for (const field of endpoint.payloadTransformation.removeFields) {
        delete transformed[field];
      }
    }

    // Add fields
    if (endpoint.payloadTransformation.addFields) {
      transformed = { ...transformed, ...endpoint.payloadTransformation.addFields };
    }

    // Transform fields using simple JSONPath-like syntax
    if (endpoint.payloadTransformation.transformFields) {
      for (const [sourcePath, targetPath] of Object.entries(endpoint.payloadTransformation.transformFields)) {
        const value = this.getNestedValue(transformed, sourcePath);
        if (value !== undefined) {
          this.setNestedValue(transformed, targetPath, value);
          // Remove from source if different path
          if (sourcePath !== targetPath) {
            this.deleteNestedValue(transformed, sourcePath);
          }
        }
      }
    }

    // Apply template if provided
    if (endpoint.payloadTransformation.template) {
      try {
        const template = JSON.parse(endpoint.payloadTransformation.template);
        transformed = this.applyTemplate(template, transformed);
      } catch {
        // Invalid template, use transformed payload as is
      }
    }

    return transformed;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Delete nested value from object using dot notation
   */
  private deleteNestedValue(obj: any, path: string): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => current?.[key], obj);
    if (target) {
      delete target[lastKey];
    }
  }

  /**
   * Apply template with placeholders
   */
  private applyTemplate(template: any, data: any): any {
    if (typeof template === 'string') {
      // Replace placeholders like {{field}} or {{field.path}}
      return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = this.getNestedValue(data, path.trim());
        return value !== undefined ? String(value) : match;
      });
    } else if (Array.isArray(template)) {
      return template.map(item => this.applyTemplate(item, data));
    } else if (typeof template === 'object' && template !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(template)) {
        result[key] = this.applyTemplate(value, data);
      }
      return result;
    }
    return template;
  }

  /**
   * Deliver webhook to a specific endpoint
   */
  private deliverToEndpoint(
    endpoint: WebhookEndpoint,
    request: WebhookRequest,
    event: string
  ): WebhookResponse {
    const startTime = Date.now();
    const maxAttempts = this.config?.maxRetryAttempts || 3;
    const baseDelay = this.config?.retryDelay || 5;
    const timeout = endpoint.timeoutDuration || this.config?.timeout || this.config?.timeoutDuration || 30000;
    const retryEnabled = this.config?.enableRetryOnFailure !== false;
    const backoffStrategy = this.config?.retryBackoff || 'exponential';
    
    // Transform payload if needed
    let transformedPayload = request.body;
    if (endpoint.payloadTransformation?.enabled) {
      transformedPayload = this.transformPayload(request.body, endpoint);
    }
    
    const transformedRequest: WebhookRequest = {
      ...request,
      body: transformedPayload,
    };
    
    let attempts = 0;
    let lastError: string | undefined;
    let lastStatusCode: number | undefined;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      // Simulate HTTP request to endpoint
      const attemptResult = this.simulateHttpRequest(endpoint.url, transformedRequest, timeout);
      
      if (attemptResult.success) {
        // Success - create delivery record
        const latency = Date.now() - startTime;
        const deliveryId = `delivery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const delivery: WebhookDelivery = {
          id: deliveryId,
          endpointId: endpoint.id,
          event,
          payload: typeof transformedPayload === 'string' ? transformedPayload : JSON.stringify(transformedPayload),
          status: 'success',
          timestamp: new Date().toISOString(),
          attempts,
          responseCode: attemptResult.statusCode,
          responseBody: attemptResult.responseBody,
          latency: Date.now() - startTime,
        };
        this.addDelivery(delivery, latency);
        this.updateAverageLatency(latency);
        
        return {
          success: true,
          status: attemptResult.statusCode || 200,
          latency,
          deliveryId,
          attempts,
        };
      }
      
      // Failed attempt
      lastError = attemptResult.error;
      lastStatusCode = attemptResult.statusCode;
      
      if (attempts > 1) {
        this.webhookMetrics.retriesTotal++;
      }
      
      // If retry is disabled or last attempt, break
      if (!retryEnabled || attempts >= maxAttempts) {
        break;
      }
      
      // Calculate delay based on backoff strategy (simulated)
      const delay = this.calculateRetryDelay(attempts, baseDelay, backoffStrategy);
    }
    
    // All attempts failed - create failed delivery record
    const latency = Date.now() - startTime;
    const deliveryId = `delivery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const delivery: WebhookDelivery = {
      id: deliveryId,
      endpointId: endpoint.id,
      event,
      payload: typeof transformedPayload === 'string' ? transformedPayload : JSON.stringify(transformedPayload),
      status: 'failed',
      timestamp: new Date().toISOString(),
      attempts,
      responseCode: lastStatusCode,
      error: lastError,
      latency,
    };
    this.addDelivery(delivery, latency);
    this.updateAverageLatency(latency);
    
    return {
      success: false,
      status: lastStatusCode || 500,
      latency,
      deliveryId,
      attempts,
      error: lastError,
    };
  }
  
  /**
   * Check if IP is allowed
   */
  private isIPAllowed(ip: string, allowedIPs?: string[]): boolean {
    if (!allowedIPs || allowedIPs.length === 0) {
      return true; // No restrictions
    }
    
    for (const allowed of allowedIPs) {
      if (this.isIPInRange(ip, allowed)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if IP is in CIDR range or exact match
   */
  private isIPInRange(ip: string, range: string): boolean {
    // Exact match
    if (ip === range) {
      return true;
    }
    
    // CIDR notation
    if (range.includes('/')) {
      const [rangeIP, prefixLength] = range.split('/');
      const prefix = parseInt(prefixLength, 10);
      
      const ipNum = this.ipToNumber(ip);
      const rangeNum = this.ipToNumber(rangeIP);
      const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
      
      return (ipNum & mask) === (rangeNum & mask);
    }
    
    return false;
  }

  /**
   * Convert IP to number
   */
  private ipToNumber(ip: string): number {
    const parts = ip.split('.').map(Number);
    return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  }

  /**
   * Simulate HTTP request to endpoint
   */
  private simulateHttpRequest(
    url: string,
    request: WebhookRequest,
    timeout: number
  ): { success: boolean; statusCode?: number; responseBody?: string; error?: string } {
    // Find endpoint to get its specific settings
    const endpoint = Array.from(this.endpoints.values()).find(e => e.url === url);
    const endpointErrorRate = endpoint?.errorRate || this.config?.errorRate || 10;
    const endpointTimeout = endpoint?.timeoutDuration || timeout;
    
    // Simulate network latency with normal distribution (10-500ms)
    // Using Box-Muller transform for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const meanLatency = 100;
    const stdDev = 50;
    let latency = meanLatency + z0 * stdDev;
    latency = Math.max(10, Math.min(500, latency)); // Clamp to 10-500ms
    
    // Check for timeout
    if (latency > endpointTimeout) {
      return {
        success: false,
        statusCode: 408,
        error: 'Request timeout',
      };
    }
    
    // Simulate success/failure based on error rate
    const errorRate = endpointErrorRate / 100;
    const isSuccess = Math.random() >= errorRate;
    
    if (isSuccess) {
      // Simulate different success status codes
      const successType = Math.random();
      let statusCode = 200;
      if (successType < 0.05) {
        statusCode = 201; // Created
      } else if (successType < 0.1) {
        statusCode = 202; // Accepted
      }
      
      return {
        success: true,
        statusCode,
        responseBody: JSON.stringify({ received: true, timestamp: Date.now() }),
      };
    } else {
      // Simulate different error types with realistic distribution
      const errorType = Math.random();
      if (errorType < 0.15) {
        // Network errors
        const networkErrorType = Math.random();
        if (networkErrorType < 0.3) {
          return {
            success: false,
            statusCode: 408,
            error: 'Connection timeout',
          };
        } else if (networkErrorType < 0.6) {
          return {
            success: false,
            statusCode: 0,
            error: 'DNS resolution failed',
          };
        } else {
          return {
            success: false,
            statusCode: 0,
            error: 'Connection refused',
          };
        }
      } else if (errorType < 0.3) {
        // Client errors
        const clientErrorType = Math.random();
        if (clientErrorType < 0.3) {
          return {
            success: false,
            statusCode: 400,
            error: 'Bad request',
          };
        } else if (clientErrorType < 0.6) {
          return {
            success: false,
            statusCode: 401,
            error: 'Unauthorized',
          };
        } else if (clientErrorType < 0.8) {
          return {
            success: false,
            statusCode: 403,
            error: 'Forbidden',
          };
        } else {
          return {
            success: false,
            statusCode: 404,
            error: 'Not found',
          };
        }
      } else {
        // Server errors
        const serverErrorType = Math.random();
        if (serverErrorType < 0.4) {
          return {
            success: false,
            statusCode: 500,
            error: 'Internal server error',
          };
        } else if (serverErrorType < 0.7) {
          return {
            success: false,
            statusCode: 502,
            error: 'Bad gateway',
          };
        } else if (serverErrorType < 0.9) {
          return {
            success: false,
            statusCode: 503,
            error: 'Service unavailable',
          };
        } else {
          return {
            success: false,
            statusCode: 504,
            error: 'Gateway timeout',
          };
        }
      }
    }
  }
  
  /**
   * Calculate retry delay based on strategy
   */
  private calculateRetryDelay(attempt: number, baseDelay: number, strategy: string): number {
    switch (strategy) {
      case 'exponential':
        return baseDelay * Math.pow(2, attempt - 1);
      case 'linear':
        return baseDelay * attempt;
      case 'constant':
      default:
        return baseDelay;
    }
  }
  
  /**
   * Get matching endpoints for event
   */
  private getMatchingEndpoints(event: string): WebhookEndpoint[] {
    const matching: WebhookEndpoint[] = [];
    
    for (const endpoint of this.endpoints.values()) {
      if (!endpoint.enabled) continue;
      
      // If endpoint has no events filter, it matches all events
      if (endpoint.events.length === 0) {
        matching.push(endpoint);
        continue;
      }
      
      // Check if event matches
      if (endpoint.events.includes(event) || endpoint.events.includes('*')) {
        matching.push(endpoint);
      }
    }
    
    return matching;
  }
  
  /**
   * Verify webhook signature
   */
  private verifySignature(request: WebhookRequest, headerName: string): boolean {
    const signature = request.headers?.[headerName.toLowerCase()] || 
                     request.headers?.[headerName] ||
                     request.headers?.['x-signature'] ||
                     request.headers?.['x-hub-signature-256'];
    
    if (!signature) {
      return false;
    }
    
    // Find endpoint to get secret and algorithm
    const endpoint = Array.from(this.endpoints.values()).find(e => {
      // Try to match by URL or use first endpoint with secret
      return e.secret;
    });
    
    if (!endpoint || !endpoint.secret) {
      // No secret configured, accept if signature exists
      return signature.length > 0;
    }
    
    // Get algorithm from config or default
    const algorithm = this.config?.signatureAlgorithm || 'hmac-sha256';
    
    // Simulate signature verification
    // In real implementation, this would use crypto.createHmac with the algorithm
    // For simulation, we'll check if signature format matches expected algorithm
    
    const payload = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    
    // Simulate different algorithms
    if (algorithm === 'hmac-sha256' || algorithm === 'sha256') {
      // HMAC-SHA256 signatures are typically 64 hex characters
      // SHA256 signatures are also 64 hex characters
      const hexPattern = /^[0-9a-f]{64}$/i;
      return hexPattern.test(signature.replace(/^sha256=/, '').replace(/^hmac-sha256=/, ''));
    } else if (algorithm === 'sha512') {
      // SHA512 signatures are 128 hex characters
      const hexPattern = /^[0-9a-f]{128}$/i;
      return hexPattern.test(signature.replace(/^sha512=/, ''));
    }
    
    // Default: accept if signature exists and has reasonable length
    return signature.length >= 32;
  }
  
  /**
   * Check rate limit with multiple strategies
   */
  private checkRateLimit(): boolean {
    const limit = this.config?.rateLimitPerMinute || 100;
    const strategy = this.rateLimitStrategy;
    
    switch (strategy) {
      case 'token-bucket':
        return this.checkTokenBucket(limit);
      case 'sliding-window':
        return this.checkSlidingWindow(limit);
      case 'fixed':
      default:
        return this.checkFixedWindow(limit);
    }
  }

  /**
   * Fixed window rate limiting
   */
  private checkFixedWindow(limit: number): boolean {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    
    if (now - this.rateLimitWindowStart >= windowMs) {
      // Reset window
      this.rateLimitWindowStart = now;
      this.rateLimitRequestsInWindow = 0;
    }
    
    if (this.rateLimitRequestsInWindow >= limit) {
      return false;
    }
    
    this.rateLimitRequestsInWindow++;
    return true;
  }

  /**
   * Token bucket rate limiting
   */
  private checkTokenBucket(limit: number): boolean {
    const now = Date.now();
    
    // Initialize token bucket if needed
    if (!this.tokenBucket) {
      this.tokenBucket = {
        tokens: limit,
        capacity: limit,
        refillRate: limit / 60, // tokens per second (limit per minute / 60)
        lastRefill: now,
      };
    }
    
    // Refill tokens based on time passed
    const timePassed = (now - this.tokenBucket.lastRefill) / 1000; // seconds
    const tokensToAdd = timePassed * this.tokenBucket.refillRate;
    this.tokenBucket.tokens = Math.min(
      this.tokenBucket.capacity,
      this.tokenBucket.tokens + tokensToAdd
    );
    this.tokenBucket.lastRefill = now;
    
    // Check if we have tokens
    if (this.tokenBucket.tokens >= 1) {
      this.tokenBucket.tokens -= 1;
      return true;
    }
    
    return false;
  }

  /**
   * Sliding window rate limiting
   */
  private checkSlidingWindow(limit: number): boolean {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    
    // Remove old entries outside the window
    this.slidingWindow = this.slidingWindow.filter(
      entry => now - entry.timestamp < windowMs
    );
    
    // Check if we're within the limit
    if (this.slidingWindow.length >= limit) {
      return false;
    }
    
    // Add current request
    this.slidingWindow.push({ timestamp: now });
    return true;
  }
  
  /**
   * Add delivery to history
   * Note: latency should be added separately via updateAverageLatency to avoid duplication
   */
  private addDelivery(delivery: WebhookDelivery, latency?: number) {
    this.deliveries.set(delivery.id, delivery);
    
    // Update metrics
    this.webhookMetrics.deliveriesTotal++;
    if (delivery.status === 'success') {
      this.webhookMetrics.deliveriesSuccess++;
    } else if (delivery.status === 'failed') {
      this.webhookMetrics.deliveriesFailed++;
    } else {
      this.webhookMetrics.deliveriesPending++;
    }
    
    // Update success rate
    if (this.webhookMetrics.deliveriesTotal > 0) {
      this.webhookMetrics.successRate = 
        (this.webhookMetrics.deliveriesSuccess / this.webhookMetrics.deliveriesTotal) * 100;
    }
    
    // Add to history only if latency is provided (to avoid duplication)
    // If latency is not provided here, it will be added via updateAverageLatency
    if (latency !== undefined) {
      this.deliveryHistory.push({
        timestamp: Date.now(),
        latency,
        status: delivery.status === 'success' ? 'success' : 'failed',
      });
      
      // Limit history size
      if (this.deliveryHistory.length > this.MAX_DELIVERY_HISTORY_LIST) {
        this.deliveryHistory.shift();
      }
    }
    
    // Limit deliveries map size
    if (this.deliveries.size > this.MAX_DELIVERY_HISTORY) {
      const firstKey = this.deliveries.keys().next().value;
      this.deliveries.delete(firstKey);
    }
    
    this.updateErrorRate();
  }
  
  /**
   * Update average latency
   */
  private updateAverageLatency(latency: number) {
    this.deliveryHistory.push({
      timestamp: Date.now(),
      latency,
      status: 'success',
    });
    
    if (this.deliveryHistory.length > this.MAX_DELIVERY_HISTORY_LIST) {
      this.deliveryHistory.shift();
    }
    
    if (this.deliveryHistory.length > 0) {
      const totalLatency = this.deliveryHistory.reduce((sum, d) => sum + d.latency, 0);
      this.webhookMetrics.averageLatency = totalLatency / this.deliveryHistory.length;
    }
  }
  
  /**
   * Update error rate
   */
  private updateErrorRate() {
    if (this.webhookMetrics.deliveriesTotal > 0) {
      this.webhookMetrics.errorRate = 
        (this.webhookMetrics.deliveriesFailed / this.webhookMetrics.deliveriesTotal) * 100;
    }
  }
  
  /**
   * Cleanup old request timestamps
   */
  private cleanupOldRequestTimestamps() {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.RPS_WINDOW_MS
    );
  }
  
  /**
   * Initialize configuration from component config
   */
  public initializeConfig(node: CanvasNode) {
    const config = (node.data.config || {}) as WebhookConfig;
    this.config = config;
    
    // Initialize endpoints
    this.endpoints.clear();
    if (config.endpoints) {
      for (const endpoint of config.endpoints) {
        this.endpoints.set(endpoint.id, { ...endpoint });
      }
    }
    
    // Update metrics
    this.webhookMetrics.endpointsTotal = this.endpoints.size;
    this.webhookMetrics.endpointsEnabled = Array.from(this.endpoints.values())
      .filter(e => e.enabled).length;
    
    // Reset deliveries if config changed significantly
    // (in real system, we might want to preserve some history)
  }
  
  /**
   * Update configuration
   */
  public updateConfig(config: WebhookConfig) {
    this.config = config;
    
    // Update rate limiting strategy based on config
    // For now, use token-bucket if rate limiting is enabled
    if (config.enableRateLimiting) {
      this.rateLimitStrategy = 'token-bucket'; // Can be made configurable
    }
    
    // Reset rate limiting state when config changes
    this.rateLimitWindowStart = Date.now();
    this.rateLimitRequestsInWindow = 0;
    this.tokenBucket = null;
    this.slidingWindow = [];
    
    // Update endpoints
    this.endpoints.clear();
    if (config.endpoints) {
      for (const endpoint of config.endpoints) {
        this.endpoints.set(endpoint.id, { ...endpoint });
      }
    }
    
    // Update metrics
    this.webhookMetrics.endpointsTotal = this.endpoints.size;
    this.webhookMetrics.endpointsEnabled = Array.from(this.endpoints.values())
      .filter(e => e.enabled).length;
  }
  
  /**
   * Get metrics
   */
  public getMetrics(): WebhookEngineMetrics {
    // Calculate utilization based on requests per second
    const maxRPS = 100; // Configurable max RPS
    this.webhookMetrics.utilization = Math.min(
      (this.webhookMetrics.requestsPerSecond / maxRPS) * 100,
      100
    );
    
    return { ...this.webhookMetrics };
  }
  
  /**
   * Get all deliveries
   */
  public getDeliveries(): WebhookDelivery[] {
    return Array.from(this.deliveries.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
  
  /**
   * Get deliveries for specific endpoint
   */
  public getDeliveriesForEndpoint(endpointId: string): WebhookDelivery[] {
    return this.getDeliveries().filter(d => d.endpointId === endpointId);
  }
  
  /**
   * Get all endpoints
   */
  public getEndpoints(): WebhookEndpoint[] {
    return Array.from(this.endpoints.values());
  }
  
  /**
   * Get endpoint by ID
   */
  public getEndpoint(endpointId: string): WebhookEndpoint | undefined {
    return this.endpoints.get(endpointId);
  }

  /**
   * Get metrics for a specific endpoint
   */
  public getEndpointMetrics(endpointId: string): {
    totalDeliveries: number;
    successDeliveries: number;
    failedDeliveries: number;
    successRate: number;
    averageLatency: number;
    requestsPerSecond: number;
    errorRate: number;
  } {
    const endpointDeliveries = this.getDeliveriesForEndpoint(endpointId);
    const total = endpointDeliveries.length;
    const success = endpointDeliveries.filter(d => d.status === 'success').length;
    const failed = endpointDeliveries.filter(d => d.status === 'failed').length;
    
    const latencies = endpointDeliveries
      .filter(d => d.latency !== undefined)
      .map(d => d.latency!);
    const avgLatency = latencies.length > 0
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
      : 0;
    
    // Calculate RPS for this endpoint (last minute)
    const now = Date.now();
    const recentDeliveries = endpointDeliveries.filter(d => {
      const deliveryTime = new Date(d.timestamp).getTime();
      return now - deliveryTime < 60000; // Last minute
    });
    const rps = recentDeliveries.length / 60;
    
    const errorRate = total > 0 ? (failed / total) * 100 : 0;
    const successRate = total > 0 ? (success / total) * 100 : 0;
    
    return {
      totalDeliveries: total,
      successDeliveries: success,
      failedDeliveries: failed,
      successRate,
      averageLatency: Math.round(avgLatency),
      requestsPerSecond: Math.round(rps * 100) / 100,
      errorRate,
    };
  }
}

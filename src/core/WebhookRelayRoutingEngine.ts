/**
 * Webhook Relay Routing Engine
 * Handles webhook relay forwarding with retry, signature verification, IP filtering, and transformation
 */

export interface WebhookRelay {
  id: string;
  name: string;
  sourceUrl: string;
  targetUrl: string;
  enabled: boolean;
  events?: string[];
  signatureSecret?: string;
  signatureHeader?: string;
  allowedIps?: string[];
  transformTemplate?: string;
  maxRetryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  retryBackoff?: 'exponential' | 'linear' | 'constant';
}

export interface WebhookRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  ip?: string;
  event?: string;
}

export interface WebhookDelivery {
  id: string;
  relayId: string;
  event: string;
  payload: string;
  status: 'pending' | 'success' | 'failed';
  timestamp: string;
  attempts: number;
  responseCode?: number;
  error?: string;
}

export interface WebhookRelayResponse {
  success: boolean;
  status: number;
  latency: number;
  relayId?: string;
  deliveryId?: string;
  attempts: number;
  error?: string;
}

export interface WebhookRelayConfig {
  relays?: WebhookRelay[];
  enableRetryOnFailure?: boolean;
  enableSignatureVerification?: boolean;
  enableRequestLogging?: boolean;
  maxRetryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
}

/**
 * Delivery attempt tracking
 */
interface DeliveryAttempt {
  attempt: number;
  timestamp: number;
  status: 'pending' | 'success' | 'failed';
  responseCode?: number;
  error?: string;
  latency: number;
}

/**
 * Relay metrics
 */
interface RelayMetrics {
  totalRequests: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  totalRetries: number;
  averageLatency: number;
  totalLatency: number;
  lastRequestTime: number;
}

/**
 * Webhook Relay Routing Engine
 * Simulates webhook relay behavior with retry, signature verification, and transformation
 */
export class WebhookRelayRoutingEngine {
  private relays: Map<string, WebhookRelay> = new Map();
  private config: WebhookRelayConfig = {};
  private deliveries: Map<string, WebhookDelivery> = new Map();
  private pendingDeliveries: Map<string, DeliveryAttempt[]> = new Map();
  private relayMetrics: Map<string, RelayMetrics> = new Map();

  /**
   * Initialize with configuration
   */
  public initialize(config: WebhookRelayConfig) {
    this.config = config;
    this.relays.clear();
    this.deliveries.clear();
    this.pendingDeliveries.clear();
    this.relayMetrics.clear();

    // Initialize relays
    if (config.relays) {
      for (const relay of config.relays) {
        if (relay.enabled) {
          this.relays.set(relay.id, { ...relay });
          this.initializeRelayMetrics(relay.id);
        }
      }
    }
  }

  /**
   * Initialize metrics for a relay
   */
  private initializeRelayMetrics(relayId: string) {
    this.relayMetrics.set(relayId, {
      totalRequests: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      totalRetries: 0,
      averageLatency: 0,
      totalLatency: 0,
      lastRequestTime: 0,
    });
  }

  /**
   * Process incoming webhook and relay to target
   */
  public relayWebhook(request: WebhookRequest): WebhookRelayResponse {
    const startTime = Date.now();

    // 1. Find matching relay
    const relay = this.findMatchingRelay(request);
    if (!relay) {
      return {
        success: false,
        status: 404,
        latency: Date.now() - startTime,
        attempts: 0,
        error: 'No matching relay found',
      };
    }

    // 2. Check IP filtering
    if (relay.allowedIps && relay.allowedIps.length > 0 && request.ip) {
      if (!this.isIpAllowed(request.ip, relay.allowedIps)) {
        this.updateRelayMetrics(relay.id, false, Date.now() - startTime);
        return {
          success: false,
          status: 403,
          latency: Date.now() - startTime,
          attempts: 0,
          error: 'IP address not allowed',
          relayId: relay.id,
        };
      }
    }

    // 3. Verify signature if enabled
    if (this.config.enableSignatureVerification && relay.signatureSecret) {
      if (!this.verifySignature(request, relay.signatureSecret, relay.signatureHeader || 'X-Signature')) {
        this.updateRelayMetrics(relay.id, false, Date.now() - startTime);
        return {
          success: false,
          status: 401,
          latency: Date.now() - startTime,
          attempts: 0,
          error: 'Invalid signature',
          relayId: relay.id,
        };
      }
    }

    // 4. Transform payload if template provided
    let transformedBody = request.body;
    if (relay.transformTemplate) {
      transformedBody = this.transformPayload(request.body, relay.transformTemplate);
    }

    // 5. Attempt delivery with retry logic
    const deliveryResult = this.deliverWebhook(relay, {
      ...request,
      body: transformedBody,
    });

    // 6. Update metrics
    this.updateRelayMetrics(relay.id, deliveryResult.success, deliveryResult.latency);

    return {
      ...deliveryResult,
      relayId: relay.id,
    };
  }

  /**
   * Find matching relay for webhook request
   */
  private findMatchingRelay(request: WebhookRequest): WebhookRelay | null {
    for (const relay of this.relays.values()) {
      // Check if source URL matches
      if (request.url.startsWith(relay.sourceUrl) || relay.sourceUrl === '*' || request.url.includes(relay.sourceUrl)) {
        // Check event filter if specified
        if (relay.events && relay.events.length > 0) {
          const eventName = request.event || request.headers['x-event'] || request.headers['x-github-event'] || '';
          if (!relay.events.includes(eventName) && eventName !== '') {
            continue;
          }
        }
        return relay;
      }
    }
    return null;
  }

  /**
   * Check if IP address is allowed
   */
  private isIpAllowed(ip: string, allowedIps: string[]): boolean {
    for (const allowedIp of allowedIps) {
      if (this.matchesCidr(ip, allowedIp)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Simple CIDR matching (basic implementation)
   */
  private matchesCidr(ip: string, cidr: string): boolean {
    if (cidr === '*') return true;
    if (cidr === ip) return true;

    // Handle CIDR notation (basic)
    if (cidr.includes('/')) {
      const [network, prefixLength] = cidr.split('/');
      const prefix = parseInt(prefixLength, 10);
      
      // For simplicity, check if IP starts with network prefix
      const networkParts = network.split('.');
      const ipParts = ip.split('.');
      
      if (networkParts.length !== 4 || ipParts.length !== 4) return false;
      
      // Check each octet up to prefix length
      const octetsToCheck = Math.floor(prefix / 8);
      for (let i = 0; i < octetsToCheck; i++) {
        if (networkParts[i] !== ipParts[i]) {
          return false;
        }
      }
      return true;
    }

    return ip === cidr;
  }

  /**
   * Verify webhook signature (HMAC)
   */
  private verifySignature(
    request: WebhookRequest,
    secret: string,
    headerName: string
  ): boolean {
    const signature = request.headers[headerName.toLowerCase()] || 
                     request.headers[headerName] ||
                     request.headers['x-signature'] ||
                     request.headers['x-hub-signature-256'];
    
    if (!signature) {
      return false;
    }

    // In real implementation, this would use crypto.createHmac
    // For simulation, we'll do a simple check
    const bodyString = typeof request.body === 'string' 
      ? request.body 
      : JSON.stringify(request.body);
    
    // Simulate signature verification (in real system, use HMAC-SHA256)
    // For simulation purposes, accept if signature header exists and secret matches pattern
    return signature.length > 0 && secret.length > 0;
  }

  /**
   * Transform payload using template
   */
  private transformPayload(body: unknown, template: string): unknown {
    try {
      // Simple template replacement (in real system, use proper templating engine)
      let transformed = template;
      
      // Replace {{raw}} with JSON stringified body
      if (transformed.includes('{{raw}}')) {
        const bodyJson = typeof body === 'string' ? body : JSON.stringify(body);
        transformed = transformed.replace(/\{\{raw\}\}/g, bodyJson);
      }
      
      // Replace {{json}} with parsed JSON
      if (transformed.includes('{{json}}')) {
        const bodyJson = typeof body === 'string' ? JSON.parse(body) : body;
        transformed = transformed.replace(/\{\{json\}\}/g, JSON.stringify(bodyJson));
      }
      
      // Try to parse as JSON if it looks like JSON
      try {
        return JSON.parse(transformed);
      } catch {
        return transformed;
      }
    } catch (error) {
      // If transformation fails, return original body
      return body;
    }
  }

  /**
   * Deliver webhook with retry logic
   */
  private deliverWebhook(relay: WebhookRelay, request: WebhookRequest): WebhookRelayResponse {
    const maxAttempts = relay.maxRetryAttempts || this.config.maxRetryAttempts || 3;
    const baseDelay = relay.retryDelay || this.config.retryDelay || 5;
    const timeout = relay.timeout || this.config.timeout || 30;
    const retryEnabled = this.config.enableRetryOnFailure !== false;
    const backoffStrategy = relay.retryBackoff || 'exponential';

    let attempts = 0;
    let lastError: string | undefined;
    let lastStatusCode: number | undefined;
    const startTime = Date.now();

    while (attempts < maxAttempts) {
      attempts++;
      
      // Simulate HTTP request to target
      const attemptResult = this.simulateHttpRequest(relay.targetUrl, request, timeout);
      
      if (attemptResult.success) {
        // Success - create delivery record
        const deliveryId = `delivery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const delivery: WebhookDelivery = {
          id: deliveryId,
          relayId: relay.id,
          event: request.event || 'unknown',
          payload: typeof request.body === 'string' ? request.body : JSON.stringify(request.body),
          status: 'success',
          timestamp: new Date().toISOString(),
          attempts,
          responseCode: attemptResult.statusCode,
        };
        this.deliveries.set(deliveryId, delivery);

        return {
          success: true,
          status: attemptResult.statusCode || 200,
          latency: Date.now() - startTime,
          deliveryId,
          attempts,
        };
      }

      // Failed attempt
      lastError = attemptResult.error;
      lastStatusCode = attemptResult.statusCode;

      // If retry is disabled or last attempt, break
      if (!retryEnabled || attempts >= maxAttempts) {
        break;
      }

      // Calculate delay based on backoff strategy
      const delay = this.calculateRetryDelay(attempts, baseDelay, backoffStrategy);
      
      // In real system, we would wait here, but for simulation we just track it
      // The actual delay would be handled by the emulation engine timing
    }

    // All attempts failed - create failed delivery record
    const deliveryId = `delivery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const delivery: WebhookDelivery = {
      id: deliveryId,
      relayId: relay.id,
      event: request.event || 'unknown',
      payload: typeof request.body === 'string' ? request.body : JSON.stringify(request.body),
      status: 'failed',
      timestamp: new Date().toISOString(),
      attempts,
      responseCode: lastStatusCode,
      error: lastError,
    };
    this.deliveries.set(deliveryId, delivery);

    return {
      success: false,
      status: lastStatusCode || 500,
      latency: Date.now() - startTime,
      deliveryId,
      attempts,
      error: lastError || 'Delivery failed after all retry attempts',
    };
  }

  /**
   * Simulate HTTP request to target URL
   */
  private simulateHttpRequest(
    targetUrl: string,
    request: WebhookRequest,
    timeout: number
  ): { success: boolean; statusCode?: number; error?: string; latency: number } {
    const startTime = Date.now();
    
    // Simulate network latency (10-50ms)
    const networkLatency = 10 + Math.random() * 40;
    
    // Simulate target service processing time (5-100ms)
    const processingTime = 5 + Math.random() * 95;
    
    // Simulate occasional failures (5% failure rate)
    const shouldFail = Math.random() < 0.05;
    const isTimeout = Math.random() < 0.02; // 2% timeout rate
    
    if (isTimeout) {
      return {
        success: false,
        statusCode: 504,
        error: 'Request timeout',
        latency: timeout * 1000, // timeout in milliseconds
      };
    }

    if (shouldFail) {
      // Simulate various error codes
      const errorCodes = [500, 502, 503, 429];
      const statusCode = errorCodes[Math.floor(Math.random() * errorCodes.length)];
      return {
        success: false,
        statusCode,
        error: `HTTP ${statusCode} error`,
        latency: networkLatency + processingTime,
      };
    }

    // Success
    return {
      success: true,
      statusCode: 200,
      latency: networkLatency + processingTime,
    };
  }

  /**
   * Calculate retry delay based on strategy
   */
  private calculateRetryDelay(attempt: number, baseDelay: number, strategy: 'exponential' | 'linear' | 'constant'): number {
    switch (strategy) {
      case 'exponential':
        // Exponential backoff: baseDelay * 2^(attempt-1)
        return baseDelay * Math.pow(2, attempt - 1);
      
      case 'linear':
        // Linear backoff: baseDelay * attempt
        return baseDelay * attempt;
      
      case 'constant':
      default:
        // Constant delay
        return baseDelay;
    }
  }

  /**
   * Update relay metrics
   */
  private updateRelayMetrics(relayId: string, success: boolean, latency: number) {
    let metrics = this.relayMetrics.get(relayId);
    if (!metrics) {
      metrics = {
        totalRequests: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        totalRetries: 0,
        averageLatency: 0,
        totalLatency: 0,
        lastRequestTime: 0,
      };
      this.relayMetrics.set(relayId, metrics);
    }

    metrics.totalRequests++;
    metrics.totalLatency += latency;
    metrics.averageLatency = metrics.totalLatency / metrics.totalRequests;
    metrics.lastRequestTime = Date.now();

    if (success) {
      metrics.successfulDeliveries++;
    } else {
      metrics.failedDeliveries++;
    }
  }

  /**
   * Get deliveries for a relay
   */
  public getDeliveries(relayId?: string): WebhookDelivery[] {
    const allDeliveries = Array.from(this.deliveries.values());
    if (relayId) {
      return allDeliveries.filter(d => d.relayId === relayId);
    }
    return allDeliveries;
  }

  /**
   * Get metrics for a relay
   */
  public getRelayMetrics(relayId: string): RelayMetrics | undefined {
    return this.relayMetrics.get(relayId);
  }

  /**
   * Get all relay metrics
   */
  public getAllRelayMetrics(): Map<string, RelayMetrics> {
    return new Map(this.relayMetrics);
  }

  /**
   * Get relay by ID
   */
  public getRelay(relayId: string): WebhookRelay | undefined {
    return this.relays.get(relayId);
  }

  /**
   * Get all relays
   */
  public getAllRelays(): WebhookRelay[] {
    return Array.from(this.relays.values());
  }
}


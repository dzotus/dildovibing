interface RateLimitEntry {
  count: number;
  resetAt: number;
  windowStart: number;
}

/**
 * RateLimiter - Manages rate limiting for GraphQL requests
 */
export class RateLimiter {
  private enabled: boolean;
  private limits: Map<string, RateLimitEntry> = new Map();
  private defaultLimit: number = 100; // requests per minute
  private windowMs: number = 60000; // 1 minute
  
  constructor(enabled: boolean = false, defaultLimit: number = 100) {
    this.enabled = enabled;
    this.defaultLimit = defaultLimit;
  }
  
  /**
   * Check if request should be rate limited
   */
  public checkLimit(identifier: string, limit?: number): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
  } {
    if (!this.enabled) {
      return {
        allowed: true,
        remaining: Infinity,
        resetAt: Date.now() + this.windowMs,
      };
    }
    
    const effectiveLimit = limit || this.defaultLimit;
    const now = Date.now();
    const entry = this.limits.get(identifier);
    
    // Initialize or reset if window expired
    if (!entry || now >= entry.resetAt) {
      const newEntry: RateLimitEntry = {
        count: 1,
        resetAt: now + this.windowMs,
        windowStart: now,
      };
      this.limits.set(identifier, newEntry);
      return {
        allowed: true,
        remaining: effectiveLimit - 1,
        resetAt: newEntry.resetAt,
      };
    }
    
    // Check if limit exceeded
    if (entry.count >= effectiveLimit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
      };
    }
    
    // Increment counter
    entry.count += 1;
    
    return {
      allowed: true,
      remaining: effectiveLimit - entry.count,
      resetAt: entry.resetAt,
    };
  }
  
  /**
   * Get identifier from request (client IP, API key, etc.)
   */
  public getIdentifier(headers?: Record<string, string>): string {
    if (!headers) return 'default';
    
    // Try to get client identifier from headers
    const apiKey = headers['x-api-key'] || headers['apikey'];
    if (apiKey) return `key:${apiKey}`;
    
    const clientId = headers['x-client-id'];
    if (clientId) return `client:${clientId}`;
    
    return 'default';
  }
  
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  public updateDefaultLimit(limit: number): void {
    this.defaultLimit = limit;
  }
  
  public clearLimits(): void {
    this.limits.clear();
  }
}


/**
 * WAF Routing Engine
 * Handles request filtering, threat detection, and blocking based on WAF rules
 */

import { CanvasNode } from '@/types';

export interface WAFRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  action: 'allow' | 'block' | 'log' | 'challenge';
  priority: number;
  conditions?: Array<{
    type: 'ip' | 'uri' | 'header' | 'body' | 'method' | 'country' | 'user-agent';
    operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'in' | 'not-in';
    value: string;
  }>;
}

export interface WAFThreat {
  id: string;
  type: 'sql-injection' | 'xss' | 'csrf' | 'path-traversal' | 'rce' | 'ddos' | 'rate-limit' | 'geo-block' | 'ip-block' | 'custom';
  sourceIP: string;
  target: string;
  timestamp: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  blocked: boolean;
  ruleId?: string;
  ruleName?: string;
  details?: Record<string, unknown>;
}

export interface WAFRequest {
  path: string;
  method: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  sourceIP?: string;
  country?: string;
  userAgent?: string;
  timestamp?: number;
}

export interface WAFResponse {
  allowed: boolean;
  blocked: boolean;
  action: 'allow' | 'block' | 'log' | 'challenge';
  latency: number;
  threatDetected?: WAFThreat;
  matchedRule?: WAFRule;
  error?: string;
}

export interface WAFConfig {
  mode?: 'detection' | 'prevention' | 'logging';
  enableOWASP?: boolean;
  owaspRuleset?: string;
  enableRateLimiting?: boolean;
  rateLimitPerMinute?: number;
  enableGeoBlocking?: boolean;
  blockedCountries?: string[];
  enableIPWhitelist?: boolean;
  whitelistedIPs?: string[];
  enableDDoSProtection?: boolean;
  ddosThreshold?: number;
  rules?: WAFRule[];
}

export interface WAFStats {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  threatsDetected: number;
  activeRules: number;
  rateLimitHits: number;
  geoBlockHits: number;
  ipBlockHits: number;
  owaspHits: number;
}

/**
 * WAF Routing Engine
 * Simulates WAF request filtering and threat detection behavior
 */
export class WAFRoutingEngine {
  private config: WAFConfig | null = null;
  private rules: Map<string, WAFRule> = new Map();
  private threats: WAFThreat[] = [];
  private stats: WAFStats = {
    totalRequests: 0,
    allowedRequests: 0,
    blockedRequests: 0,
    threatsDetected: 0,
    activeRules: 0,
    rateLimitHits: 0,
    geoBlockHits: 0,
    ipBlockHits: 0,
    owaspHits: 0,
  };

  // Rate limiting tracking (IP -> request timestamps)
  private rateLimitTracker: Map<string, number[]> = new Map();
  private readonly RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

  // DDoS tracking (IP -> request count in current window)
  private ddosTracker: Map<string, { count: number; windowStart: number }> = new Map();
  private readonly DDOS_WINDOW_MS = 1000; // 1 second

  // Threat history (keep last 1000 threats)
  private readonly MAX_THREATS = 1000;

  /**
   * Initialize WAF configuration from node
   */
  public initializeConfig(node: CanvasNode): void {
    const raw = (node.data.config || {}) as any;

    this.config = {
      mode: raw.mode || 'detection',
      enableOWASP: raw.enableOWASP ?? true,
      owaspRuleset: raw.owaspRuleset || '3.3',
      enableRateLimiting: raw.enableRateLimiting ?? true,
      rateLimitPerMinute: raw.rateLimitPerMinute || 100,
      enableGeoBlocking: raw.enableGeoBlocking ?? false,
      blockedCountries: Array.isArray(raw.blockedCountries) ? raw.blockedCountries : [],
      enableIPWhitelist: raw.enableIPWhitelist ?? false,
      whitelistedIPs: Array.isArray(raw.whitelistedIPs) ? raw.whitelistedIPs : [],
      enableDDoSProtection: raw.enableDDoSProtection ?? true,
      ddosThreshold: raw.ddosThreshold || 1000,
      rules: Array.isArray(raw.rules) ? raw.rules : [],
    };

    // Load rules
    this.rules.clear();
    if (this.config.rules) {
      for (const rule of this.config.rules) {
        if (rule.id) {
          this.rules.set(rule.id, rule);
        }
      }
    }

    // Update stats
    this.stats.activeRules = Array.from(this.rules.values()).filter(r => r.enabled).length;
  }

  /**
   * Process incoming request through WAF
   */
  public processRequest(request: WAFRequest): WAFResponse {
    const startTime = performance.now();
    const timestamp = request.timestamp || Date.now();
    const sourceIP = request.sourceIP || '0.0.0.0';

    this.stats.totalRequests++;

    // Check IP whitelist first (whitelisted IPs bypass all checks)
    if (this.config?.enableIPWhitelist && this.config.whitelistedIPs?.includes(sourceIP)) {
      this.stats.allowedRequests++;
      return {
        allowed: true,
        blocked: false,
        action: 'allow',
        latency: performance.now() - startTime,
      };
    }

    // Check geo-blocking
    if (this.config?.enableGeoBlocking && request.country) {
      if (this.config.blockedCountries?.includes(request.country)) {
        const threat: WAFThreat = {
          id: `threat-${Date.now()}-${Math.random()}`,
          type: 'geo-block',
          sourceIP,
          target: request.path,
          timestamp,
          severity: 'medium',
          blocked: true,
          details: { country: request.country },
        };
        this.addThreat(threat);
        this.stats.geoBlockHits++;
        this.stats.blockedRequests++;
        this.stats.threatsDetected++;

        if (this.config.mode === 'prevention') {
          return {
            allowed: false,
            blocked: true,
            action: 'block',
            latency: performance.now() - startTime,
            threatDetected: threat,
          };
        }
      }
    }

    // Check DDoS protection
    if (this.config?.enableDDoSProtection) {
      const ddosResult = this.checkDDoS(sourceIP, timestamp);
      if (ddosResult.blocked) {
        const threat: WAFThreat = {
          id: `threat-${Date.now()}-${Math.random()}`,
          type: 'ddos',
          sourceIP,
          target: request.path,
          timestamp,
          severity: 'critical',
          blocked: true,
          details: { requestCount: ddosResult.count },
        };
        this.addThreat(threat);
        this.stats.blockedRequests++;
        this.stats.threatsDetected++;

        if (this.config.mode === 'prevention') {
          return {
            allowed: false,
            blocked: true,
            action: 'block',
            latency: performance.now() - startTime,
            threatDetected: threat,
          };
        }
      }
    }

    // Check rate limiting
    if (this.config?.enableRateLimiting) {
      const rateLimitResult = this.checkRateLimit(sourceIP, timestamp);
      if (rateLimitResult.blocked) {
        const threat: WAFThreat = {
          id: `threat-${Date.now()}-${Math.random()}`,
          type: 'rate-limit',
          sourceIP,
          target: request.path,
          timestamp,
          severity: 'medium',
          blocked: true,
          details: { requestCount: rateLimitResult.count },
        };
        this.addThreat(threat);
        this.stats.rateLimitHits++;
        this.stats.blockedRequests++;
        this.stats.threatsDetected++;

        if (this.config.mode === 'prevention') {
          return {
            allowed: false,
            blocked: true,
            action: 'block',
            latency: performance.now() - startTime,
            threatDetected: threat,
          };
        }
      }
    }

    // Check OWASP rules
    if (this.config?.enableOWASP) {
      const owaspResult = this.checkOWASPRules(request);
      if (owaspResult.detected) {
        const threat: WAFThreat = {
          id: `threat-${Date.now()}-${Math.random()}`,
          type: owaspResult.threatType || 'custom',
          sourceIP,
          target: request.path,
          timestamp,
          severity: owaspResult.severity || 'high',
          blocked: true,
          details: owaspResult.details,
        };
        this.addThreat(threat);
        this.stats.owaspHits++;
        this.stats.blockedRequests++;
        this.stats.threatsDetected++;

        if (this.config.mode === 'prevention') {
          return {
            allowed: false,
            blocked: true,
            action: 'block',
            latency: performance.now() - startTime,
            threatDetected: threat,
          };
        }
      }
    }

    // Check custom rules (sorted by priority)
    const sortedRules = Array.from(this.rules.values())
      .filter(r => r.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      const matchResult = this.matchRule(rule, request);
      if (matchResult.matched) {
        const threat: WAFThreat = {
          id: `threat-${Date.now()}-${Math.random()}`,
          type: 'custom',
          sourceIP,
          target: request.path,
          timestamp,
          severity: matchResult.severity || 'medium',
          blocked: rule.action === 'block',
          ruleId: rule.id,
          ruleName: rule.name,
          details: matchResult.details,
        };
        this.addThreat(threat);
        this.stats.threatsDetected++;

        if (rule.action === 'block' && this.config?.mode === 'prevention') {
          this.stats.blockedRequests++;
          return {
            allowed: false,
            blocked: true,
            action: 'block',
            latency: performance.now() - startTime,
            threatDetected: threat,
            matchedRule: rule,
          };
        } else if (rule.action === 'log') {
          // Log only, continue processing
          continue;
        } else if (rule.action === 'challenge') {
          // Challenge (e.g., CAPTCHA)
          return {
            allowed: false,
            blocked: false,
            action: 'challenge',
            latency: performance.now() - startTime,
            threatDetected: threat,
            matchedRule: rule,
          };
        }
      }
    }

    // Request passed all checks
    this.stats.allowedRequests++;
    return {
      allowed: true,
      blocked: false,
      action: 'allow',
      latency: performance.now() - startTime,
    };
  }

  /**
   * Check if request matches a rule
   */
  private matchRule(rule: WAFRule, request: WAFRequest): {
    matched: boolean;
    severity?: 'critical' | 'high' | 'medium' | 'low';
    details?: Record<string, unknown>;
  } {
    if (!rule.conditions || rule.conditions.length === 0) {
      return { matched: false };
    }

    // All conditions must match (AND logic)
    for (const condition of rule.conditions) {
      let value: string | undefined;
      let matched = false;

      switch (condition.type) {
        case 'ip':
          value = request.sourceIP;
          break;
        case 'uri':
          value = request.path;
          break;
        case 'method':
          value = request.method;
          break;
        case 'header':
          value = request.headers?.[condition.value] || '';
          break;
        case 'body':
          value = typeof request.body === 'string' ? request.body : JSON.stringify(request.body || '');
          break;
        case 'country':
          value = request.country;
          break;
        case 'user-agent':
          value = request.userAgent;
          break;
      }

      if (value === undefined) {
        return { matched: false };
      }

      switch (condition.operator) {
        case 'equals':
          matched = value === condition.value;
          break;
        case 'contains':
          matched = value.toLowerCase().includes(condition.value.toLowerCase());
          break;
        case 'startsWith':
          matched = value.toLowerCase().startsWith(condition.value.toLowerCase());
          break;
        case 'endsWith':
          matched = value.toLowerCase().endsWith(condition.value.toLowerCase());
          break;
        case 'regex':
          try {
            const regex = new RegExp(condition.value, 'i');
            matched = regex.test(value);
          } catch {
            matched = false;
          }
          break;
        case 'in':
          const inValues = condition.value.split(',').map(v => v.trim());
          matched = inValues.includes(value);
          break;
        case 'not-in':
          const notInValues = condition.value.split(',').map(v => v.trim());
          matched = !notInValues.includes(value);
          break;
      }

      if (!matched) {
        return { matched: false };
      }
    }

    return {
      matched: true,
      severity: 'medium',
      details: { matchedConditions: rule.conditions.length },
    };
  }

  /**
   * Check OWASP rules (simplified detection patterns)
   */
  private checkOWASPRules(request: WAFRequest): {
    detected: boolean;
    threatType?: 'sql-injection' | 'xss' | 'path-traversal' | 'rce';
    severity?: 'critical' | 'high' | 'medium' | 'low';
    details?: Record<string, unknown>;
  } {
    const bodyStr = typeof request.body === 'string' ? request.body : JSON.stringify(request.body || '');
    const pathStr = request.path || '';
    const queryStr = JSON.stringify(request.query || '');

    const combined = `${bodyStr} ${pathStr} ${queryStr}`.toLowerCase();

    // SQL Injection patterns
    const sqlPatterns = [
      /(\bunion\b.*\bselect\b)/i,
      /(\bselect\b.*\bfrom\b)/i,
      /(\bdrop\b.*\btable\b)/i,
      /(\binsert\b.*\binto\b)/i,
      /(\bdelete\b.*\bfrom\b)/i,
      /('.*--)/,
      /(\bor\b.*=.*)/i,
      /(\band\b.*=.*)/i,
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(combined)) {
        return {
          detected: true,
          threatType: 'sql-injection',
          severity: 'critical',
          details: { pattern: pattern.toString() },
        };
      }
    }

    // XSS patterns
    const xssPatterns = [
      /<script[^>]*>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe[^>]*>/i,
      /eval\s*\(/i,
      /expression\s*\(/i,
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(combined)) {
        return {
          detected: true,
          threatType: 'xss',
          severity: 'high',
          details: { pattern: pattern.toString() },
        };
      }
    }

    // Path traversal patterns
    const pathTraversalPatterns = [
      /\.\.\//,
      /\.\.\\/,
      /\.\.%2f/i,
      /\.\.%5c/i,
    ];

    for (const pattern of pathTraversalPatterns) {
      if (pattern.test(combined)) {
        return {
          detected: true,
          threatType: 'path-traversal',
          severity: 'high',
          details: { pattern: pattern.toString() },
        };
      }
    }

    // RCE patterns
    const rcePatterns = [
      /\$\{[^}]*\}/,
      /\$\([^)]*\)/,
      /`[^`]*`/,
      /\|\s*\w+.*\s*\|/,
    ];

    for (const pattern of rcePatterns) {
      if (pattern.test(combined)) {
        return {
          detected: true,
          threatType: 'rce',
          severity: 'critical',
          details: { pattern: pattern.toString() },
        };
      }
    }

    return { detected: false };
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(sourceIP: string, timestamp: number): {
    blocked: boolean;
    count: number;
  } {
    if (!this.config?.enableRateLimiting || !this.config.rateLimitPerMinute) {
      return { blocked: false, count: 0 };
    }

    const windowStart = timestamp - this.RATE_LIMIT_WINDOW_MS;
    const requests = this.rateLimitTracker.get(sourceIP) || [];
    const recentRequests = requests.filter(t => t > windowStart);

    if (recentRequests.length >= this.config.rateLimitPerMinute) {
      return { blocked: true, count: recentRequests.length };
    }

    recentRequests.push(timestamp);
    this.rateLimitTracker.set(sourceIP, recentRequests);

    // Cleanup old entries
    if (requests.length > this.config.rateLimitPerMinute * 2) {
      this.rateLimitTracker.set(sourceIP, recentRequests);
    }

    return { blocked: false, count: recentRequests.length };
  }

  /**
   * Check DDoS protection
   */
  private checkDDoS(sourceIP: string, timestamp: number): {
    blocked: boolean;
    count: number;
  } {
    if (!this.config?.enableDDoSProtection || !this.config.ddosThreshold) {
      return { blocked: false, count: 0 };
    }

    const tracker = this.ddosTracker.get(sourceIP);
    const windowStart = timestamp - this.DDOS_WINDOW_MS;

    if (!tracker || tracker.windowStart < windowStart) {
      // New window
      this.ddosTracker.set(sourceIP, { count: 1, windowStart: timestamp });
      return { blocked: false, count: 1 };
    }

    tracker.count++;
    this.ddosTracker.set(sourceIP, tracker);

    if (tracker.count >= this.config.ddosThreshold) {
      return { blocked: true, count: tracker.count };
    }

    return { blocked: false, count: tracker.count };
  }

  /**
   * Add threat to history
   */
  private addThreat(threat: WAFThreat): void {
    this.threats.push(threat);
    if (this.threats.length > this.MAX_THREATS) {
      this.threats.shift();
    }
  }

  /**
   * Get recent threats
   */
  public getThreats(limit: number = 100): WAFThreat[] {
    return this.threats.slice(-limit).reverse();
  }

  /**
   * Get statistics
   */
  public getStats(): WAFStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      threatsDetected: 0,
      activeRules: this.stats.activeRules,
      rateLimitHits: 0,
      geoBlockHits: 0,
      ipBlockHits: 0,
      owaspHits: 0,
    };
    this.threats = [];
    this.rateLimitTracker.clear();
    this.ddosTracker.clear();
  }
}


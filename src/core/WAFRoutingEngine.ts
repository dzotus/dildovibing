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
  type: 'sql-injection' | 'xss' | 'csrf' | 'path-traversal' | 'rce' | 'ddos' | 'rate-limit' | 'geo-block' | 'ip-block' | 'ssrf' | 'xxe' | 'command-injection' | 'ldap-injection' | 'nosql-injection' | 'template-injection' | 'custom';
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

export interface SchemaValidationConfig {
  enabled: boolean;
  schemaType: 'json-schema' | 'openapi';
  schema: string; // JSON Schema или OpenAPI spec
  validateRequest: boolean;
  validateResponse: boolean;
}

export interface JWTValidationConfig {
  enabled: boolean;
  secret?: string; // для HMAC
  publicKey?: string; // для RSA
  algorithm?: 'HS256' | 'RS256' | 'ES256';
  issuer?: string;
  audience?: string[];
  requireExpiration?: boolean;
}

export interface APIKeyConfig {
  enabled: boolean;
  keys: Array<{
    id: string;
    key: string;
    enabled: boolean;
    allowedPaths?: string[]; // Опционально: только для определенных путей
    rateLimit?: number; // Per-key rate limit
  }>;
  headerName?: string; // По умолчанию 'X-API-Key'
}

export interface GraphQLProtectionConfig {
  enabled: boolean;
  maxDepth?: number; // Максимальная глубина запроса
  maxComplexity?: number; // Максимальная сложность
  maxAliases?: number; // Максимальное количество алиасов
  blockIntrospection?: boolean; // Блокировать introspection запросы
}

export interface BotDetectionConfig {
  enabled: boolean;
  methods: Array<'user-agent' | 'behavioral' | 'fingerprint'>;
  blockKnownBots?: boolean; // Блокировать известных ботов (Googlebot, etc.)
  challengeSuspicious?: boolean; // Выдавать challenge подозрительным
}

export interface AnomalyDetectionConfig {
  enabled: boolean;
  threshold?: number; // Порог для обнаружения аномалий (множитель от среднего)
  windowSize?: number; // Размер окна для анализа (в секундах)
}

export interface WAFConfig {
  mode?: 'detection' | 'prevention' | 'logging';
  enableOWASP?: boolean;
  owaspRuleset?: string;
  enableRateLimiting?: boolean;
  rateLimitPerMinute?: number;
  rateLimitStrategy?: 'fixed-window' | 'sliding-window' | 'token-bucket';
  rateLimitBurst?: number; // для token-bucket
  enableGeoBlocking?: boolean;
  blockedCountries?: string[];
  enableIPWhitelist?: boolean;
  whitelistedIPs?: string[]; // Поддержка CIDR: ['192.168.1.0/24', '10.0.0.1']
  ipBlacklist?: string[]; // Поддержка CIDR для блокировки
  enableDDoSProtection?: boolean;
  ddosThreshold?: number;
  rules?: WAFRule[];
  // API Shield functions
  schemaValidation?: SchemaValidationConfig;
  jwtValidation?: JWTValidationConfig;
  apiKeyValidation?: APIKeyConfig;
  graphQLProtection?: GraphQLProtectionConfig;
  // Real functions
  botDetection?: BotDetectionConfig;
  anomalyDetection?: AnomalyDetectionConfig;
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

  // Rate limiting tracking
  // Fixed window: IP -> request timestamps
  private rateLimitTracker: Map<string, number[]> = new Map();
  // Sliding window: IP -> { requests: timestamp[], windowStart: number }
  private slidingWindowTracker: Map<string, { requests: number[]; windowStart: number }> = new Map();
  // Token bucket: IP -> { tokens: number, lastRefill: number }
  private tokenBucketTracker: Map<string, { tokens: number; lastRefill: number }> = new Map();
  private readonly RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

  // DDoS tracking (IP -> request count in current window)
  private ddosTracker: Map<string, { count: number; windowStart: number }> = new Map();
  private readonly DDOS_WINDOW_MS = 1000; // 1 second

  // Anomaly detection tracking (IP -> request history)
  private anomalyTracker: Map<string, number[]> = new Map();
  private readonly ANOMALY_WINDOW_MS = 60000; // 1 minute

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
      rateLimitStrategy: raw.rateLimitStrategy || 'fixed-window',
      rateLimitBurst: raw.rateLimitBurst || (raw.rateLimitPerMinute || 100),
      enableGeoBlocking: raw.enableGeoBlocking ?? false,
      blockedCountries: Array.isArray(raw.blockedCountries) ? raw.blockedCountries : [],
      enableIPWhitelist: raw.enableIPWhitelist ?? false,
      whitelistedIPs: Array.isArray(raw.whitelistedIPs) ? raw.whitelistedIPs : [],
      ipBlacklist: Array.isArray(raw.ipBlacklist) ? raw.ipBlacklist : [],
      enableDDoSProtection: raw.enableDDoSProtection ?? true,
      ddosThreshold: raw.ddosThreshold || 1000,
      rules: Array.isArray(raw.rules) ? raw.rules : [],
      // API Shield functions
      schemaValidation: raw.schemaValidation ? {
        enabled: raw.schemaValidation.enabled ?? false,
        schemaType: raw.schemaValidation.schemaType || 'json-schema',
        schema: raw.schemaValidation.schema || '',
        validateRequest: raw.schemaValidation.validateRequest ?? true,
        validateResponse: raw.schemaValidation.validateResponse ?? false,
      } : undefined,
      jwtValidation: raw.jwtValidation ? {
        enabled: raw.jwtValidation.enabled ?? false,
        secret: raw.jwtValidation.secret,
        publicKey: raw.jwtValidation.publicKey,
        algorithm: raw.jwtValidation.algorithm || 'HS256',
        issuer: raw.jwtValidation.issuer,
        audience: Array.isArray(raw.jwtValidation.audience) ? raw.jwtValidation.audience : [],
        requireExpiration: raw.jwtValidation.requireExpiration ?? true,
      } : undefined,
      apiKeyValidation: raw.apiKeyValidation ? {
        enabled: raw.apiKeyValidation.enabled ?? false,
        keys: Array.isArray(raw.apiKeyValidation.keys) ? raw.apiKeyValidation.keys : [],
        headerName: raw.apiKeyValidation.headerName || 'X-API-Key',
      } : undefined,
      graphQLProtection: raw.graphQLProtection ? {
        enabled: raw.graphQLProtection.enabled ?? false,
        maxDepth: raw.graphQLProtection.maxDepth || 10,
        maxComplexity: raw.graphQLProtection.maxComplexity || 100,
        maxAliases: raw.graphQLProtection.maxAliases || 10,
        blockIntrospection: raw.graphQLProtection.blockIntrospection ?? false,
      } : undefined,
      botDetection: raw.botDetection ? {
        enabled: raw.botDetection.enabled ?? false,
        methods: Array.isArray(raw.botDetection.methods) ? raw.botDetection.methods : ['user-agent'],
        blockKnownBots: raw.botDetection.blockKnownBots ?? false,
        challengeSuspicious: raw.botDetection.challengeSuspicious ?? false,
      } : undefined,
      anomalyDetection: raw.anomalyDetection ? {
        enabled: raw.anomalyDetection.enabled ?? false,
        threshold: raw.anomalyDetection.threshold || 3.0,
        windowSize: raw.anomalyDetection.windowSize || 60,
      } : undefined,
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

    // Check IP blacklist first
    if (this.config?.ipBlacklist && this.config.ipBlacklist.length > 0) {
      if (this.isIPInList(sourceIP, this.config.ipBlacklist)) {
        const threat: WAFThreat = {
          id: `threat-${Date.now()}-${Math.random()}`,
          type: 'ip-block',
          sourceIP,
          target: request.path,
          timestamp,
          severity: 'high',
          blocked: true,
          details: { reason: 'ip-blacklist' },
        };
        this.addThreat(threat);
        this.stats.ipBlockHits++;
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

    // Check IP whitelist (whitelisted IPs bypass all checks)
    if (this.config?.enableIPWhitelist && this.config.whitelistedIPs && this.config.whitelistedIPs.length > 0) {
      if (this.isIPInList(sourceIP, this.config.whitelistedIPs)) {
        this.stats.allowedRequests++;
        return {
          allowed: true,
          blocked: false,
          action: 'allow',
          latency: performance.now() - startTime,
        };
      }
    }

    // API Shield: Schema Validation (before OWASP rules)
    if (this.config?.schemaValidation?.enabled && this.config.schemaValidation.validateRequest) {
      const schemaResult = this.validateSchema(request);
      if (!schemaResult.valid) {
        const threat: WAFThreat = {
          id: `threat-${Date.now()}-${Math.random()}`,
          type: 'custom',
          sourceIP,
          target: request.path,
          timestamp,
          severity: 'medium',
          blocked: true,
          details: { reason: 'schema-validation-failed', errors: schemaResult.errors },
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
            error: 'Schema validation failed',
          };
        }
      }
    }

    // API Shield: JWT Validation
    if (this.config?.jwtValidation?.enabled) {
      const jwtResult = this.validateJWT(request);
      if (!jwtResult.valid) {
        const threat: WAFThreat = {
          id: `threat-${Date.now()}-${Math.random()}`,
          type: 'custom',
          sourceIP,
          target: request.path,
          timestamp,
          severity: 'high',
          blocked: true,
          details: { reason: 'jwt-validation-failed', error: jwtResult.error },
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
            error: jwtResult.error || 'JWT validation failed',
          };
        }
      }
    }

    // API Shield: API Key Validation
    if (this.config?.apiKeyValidation?.enabled) {
      const apiKeyResult = this.validateAPIKey(request);
      if (!apiKeyResult.valid) {
        const threat: WAFThreat = {
          id: `threat-${Date.now()}-${Math.random()}`,
          type: 'custom',
          sourceIP,
          target: request.path,
          timestamp,
          severity: 'high',
          blocked: true,
          details: { reason: 'api-key-validation-failed', error: apiKeyResult.error },
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
            error: apiKeyResult.error || 'API key validation failed',
          };
        }
      }
    }

    // API Shield: GraphQL Query Protection
    if (this.config?.graphQLProtection?.enabled) {
      const graphqlResult = this.validateGraphQL(request);
      if (!graphqlResult.valid) {
        const threat: WAFThreat = {
          id: `threat-${Date.now()}-${Math.random()}`,
          type: 'custom',
          sourceIP,
          target: request.path,
          timestamp,
          severity: 'high',
          blocked: true,
          details: { reason: 'graphql-protection-failed', error: graphqlResult.error },
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
            error: graphqlResult.error || 'GraphQL query protection failed',
          };
        }
      }
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

    // Bot Detection
    if (this.config?.botDetection?.enabled) {
      const botResult = this.detectBot(request, sourceIP);
      if (botResult.detected) {
        const threat: WAFThreat = {
          id: `threat-${Date.now()}-${Math.random()}`,
          type: 'custom',
          sourceIP,
          target: request.path,
          timestamp,
          severity: 'medium',
          blocked: botResult.blocked || false,
          details: { reason: 'bot-detected', method: botResult.method },
        };
        this.addThreat(threat);
        this.stats.threatsDetected++;

        if (botResult.blocked && this.config.mode === 'prevention') {
          this.stats.blockedRequests++;
          return {
            allowed: false,
            blocked: true,
            action: 'block',
            latency: performance.now() - startTime,
            threatDetected: threat,
          };
        } else if (botResult.challenge && this.config.botDetection.challengeSuspicious) {
          return {
            allowed: false,
            blocked: false,
            action: 'challenge',
            latency: performance.now() - startTime,
            threatDetected: threat,
          };
        }
      }
    }

    // Anomaly Detection
    if (this.config?.anomalyDetection?.enabled) {
      const anomalyResult = this.detectAnomaly(sourceIP, timestamp);
      if (anomalyResult.detected) {
        const threat: WAFThreat = {
          id: `threat-${Date.now()}-${Math.random()}`,
          type: 'custom',
          sourceIP,
          target: request.path,
          timestamp,
          severity: 'high',
          blocked: true,
          details: { reason: 'anomaly-detected', factor: anomalyResult.factor },
        };
        this.addThreat(threat);
        this.stats.threatsDetected++;
        this.stats.blockedRequests++;

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
   * Check OWASP rules (extended detection patterns based on OWASP ModSecurity CRS)
   */
  private checkOWASPRules(request: WAFRequest): {
    detected: boolean;
    threatType?: 'sql-injection' | 'xss' | 'path-traversal' | 'rce' | 'csrf' | 'ssrf' | 'xxe' | 'command-injection' | 'ldap-injection' | 'nosql-injection' | 'template-injection';
    severity?: 'critical' | 'high' | 'medium' | 'low';
    details?: Record<string, unknown>;
  } {
    const bodyStr = typeof request.body === 'string' ? request.body : JSON.stringify(request.body || '');
    const pathStr = request.path || '';
    const queryStr = JSON.stringify(request.query || '');
    const headersStr = JSON.stringify(request.headers || '');

    const combined = `${bodyStr} ${pathStr} ${queryStr} ${headersStr}`.toLowerCase();

    // Extended SQL Injection patterns (based on OWASP ModSecurity CRS)
    const sqlPatterns = [
      // UNION-based SQL injection
      /(\bunion\b.*\bselect\b)/i,
      /(\bunion\s+all\s+select\b)/i,
      /(\bunion\s+distinct\s+select\b)/i,
      // Boolean-based blind SQL injection
      /(\bor\b\s+\d+\s*=\s*\d+)/i,
      /(\band\b\s+\d+\s*=\s*\d+)/i,
      /(\bor\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?)/i,
      // Time-based blind SQL injection
      /(\bwaitfor\b\s+delay)/i,
      /(\bsleep\s*\([^)]*\))/i,
      /(\bpg_sleep\s*\([^)]*\))/i,
      // Error-based SQL injection
      /(\bselect\b.*\bfrom\b.*\bwhere\b)/i,
      /(\bselect\b.*\bfrom\b)/i,
      /(\bdrop\b.*\btable\b)/i,
      /(\binsert\b.*\binto\b)/i,
      /(\bdelete\b.*\bfrom\b)/i,
      /(\bupdate\b.*\bset\b)/i,
      /(\balter\b.*\btable\b)/i,
      /(\bcreate\b.*\btable\b)/i,
      /(\bexec\s*\([^)]*\))/i,
      /(\bexecute\s*\([^)]*\))/i,
      // SQL comment patterns
      /('.*--)/,
      /('.*\/\*)/,
      /(\/\*.*\*\/)/,
      // Second-order SQL injection
      /(\bconcat\s*\([^)]*\))/i,
      /(\bgroup_concat\s*\([^)]*\))/i,
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(combined)) {
        return {
          detected: true,
          threatType: 'sql-injection',
          severity: 'critical',
          details: { pattern: pattern.toString(), category: 'sql-injection' },
        };
      }
    }

    // Extended XSS patterns
    const xssPatterns = [
      // Stored XSS
      /<script[^>]*>/i,
      /<\/script>/i,
      // Reflected XSS
      /javascript:/i,
      /vbscript:/i,
      /data:text\/html/i,
      // DOM-based XSS
      /on\w+\s*=/i,
      /onerror\s*=/i,
      /onload\s*=/i,
      /onclick\s*=/i,
      // Event handler injection
      /<iframe[^>]*>/i,
      /<object[^>]*>/i,
      /<embed[^>]*>/i,
      /<img[^>]*onerror/i,
      // CSS injection
      /expression\s*\(/i,
      /@import/i,
      // JavaScript execution
      /eval\s*\(/i,
      /setTimeout\s*\(/i,
      /setInterval\s*\(/i,
      /Function\s*\(/i,
      /<svg[^>]*onload/i,
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(combined)) {
        return {
          detected: true,
          threatType: 'xss',
          severity: 'high',
          details: { pattern: pattern.toString(), category: 'xss' },
        };
      }
    }

    // Path traversal patterns
    const pathTraversalPatterns = [
      /\.\.\//,
      /\.\.\\/,
      /\.\.%2f/i,
      /\.\.%5c/i,
      /\.\.%252f/i,
      /\.\.%255c/i,
      /\.\.%c0%af/i,
      /\.\.%c1%9c/i,
      /\.\.%c0%2e/i,
    ];

    for (const pattern of pathTraversalPatterns) {
      if (pattern.test(combined)) {
        return {
          detected: true,
          threatType: 'path-traversal',
          severity: 'high',
          details: { pattern: pattern.toString(), category: 'path-traversal' },
        };
      }
    }

    // RCE (Remote Code Execution) patterns
    const rcePatterns = [
      // Command injection
      /(\$\{[^}]*\})/,
      /(\$\([^)]*\))/,
      /(`[^`]*`)/,
      /(\|\s*\w+.*\s*\|)/,
      // PHP code injection
      /(<\?php[^?]*\?>)/i,
      /(<\?[^?]*\?>)/i,
      // Shell command injection
      /(;\s*(rm|cat|ls|pwd|whoami|id|uname|ps|kill|chmod|chown)\s)/i,
      /(\|\s*(rm|cat|ls|pwd|whoami|id|uname|ps|kill|chmod|chown)\s)/i,
      /(&&\s*(rm|cat|ls|pwd|whoami|id|uname|ps|kill|chmod|chown)\s)/i,
      // Python code injection
      /(__import__\s*\([^)]*\))/i,
      /(eval\s*\([^)]*\))/i,
      /(exec\s*\([^)]*\))/i,
      /(compile\s*\([^)]*\))/i,
    ];

    for (const pattern of rcePatterns) {
      if (pattern.test(combined)) {
        return {
          detected: true,
          threatType: 'rce',
          severity: 'critical',
          details: { pattern: pattern.toString(), category: 'rce' },
        };
      }
    }

    // CSRF (Cross-Site Request Forgery) patterns
    const csrfPatterns = [
      // Missing or invalid CSRF token
      /(csrf[_-]?token\s*[:=]\s*['"]?[^'"]{0,10}['"]?)/i,
      // Referer header manipulation
      /(referer\s*:\s*https?:\/\/[^\/]+\/)/i,
    ];

    // CSRF detection is context-dependent, simplified check
    if (request.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method.toUpperCase())) {
      const hasCSRFToken = combined.includes('csrf') || combined.includes('xsrf') || 
                           (request.headers && ('x-csrf-token' in request.headers || 'x-xsrf-token' in request.headers));
      if (!hasCSRFToken && csrfPatterns.some(p => p.test(combined))) {
        return {
          detected: true,
          threatType: 'csrf',
          severity: 'medium',
          details: { pattern: 'csrf-token-missing', category: 'csrf' },
        };
      }
    }

    // SSRF (Server-Side Request Forgery) patterns
    const ssrfPatterns = [
      /(https?:\/\/127\.0\.0\.1)/i,
      /(https?:\/\/localhost)/i,
      /(https?:\/\/0\.0\.0\.0)/i,
      /(https?:\/\/169\.254\.169\.254)/i, // AWS metadata
      /(https?:\/\/192\.168\.)/i,
      /(https?:\/\/10\.)/i,
      /(https?:\/\/172\.(1[6-9]|2[0-9]|3[01])\.)/i,
      /(file:\/\/\/)/i,
      /(gopher:\/\/)/i,
      /(dict:\/\/)/i,
      /(ldap:\/\/)/i,
    ];

    for (const pattern of ssrfPatterns) {
      if (pattern.test(combined)) {
        return {
          detected: true,
          threatType: 'ssrf',
          severity: 'high',
          details: { pattern: pattern.toString(), category: 'ssrf' },
        };
      }
    }

    // XXE (XML External Entity) patterns
    const xxePatterns = [
      /(<!DOCTYPE[^>]*\[)/i,
      /(<!ENTITY[^>]*SYSTEM)/i,
      /(<!ENTITY[^>]*PUBLIC)/i,
      /(&[a-zA-Z_][a-zA-Z0-9_]*;)/,
      /(%[a-zA-Z_][a-zA-Z0-9_]*;)/,
      /(xmlns[=:])/i,
    ];

    if (combined.includes('<?xml') || request.headers?.['content-type']?.includes('xml')) {
      for (const pattern of xxePatterns) {
        if (pattern.test(combined)) {
          return {
            detected: true,
            threatType: 'xxe',
            severity: 'high',
            details: { pattern: pattern.toString(), category: 'xxe' },
          };
        }
      }
    }

    // Command Injection patterns
    const commandInjectionPatterns = [
      /(;\s*sh\s|;\s*bash\s|;\s*cmd\s|;\s*powershell\s)/i,
      /(\|\s*sh\s|\|\s*bash\s|\|\s*cmd\s)/i,
      /(&&\s*sh\s|&&\s*bash\s|&&\s*cmd\s)/i,
      /(`[^`]*sh[^`]*`)/i,
      /(\$\{[^}]*sh[^}]*\})/i,
    ];

    for (const pattern of commandInjectionPatterns) {
      if (pattern.test(combined)) {
        return {
          detected: true,
          threatType: 'command-injection',
          severity: 'critical',
          details: { pattern: pattern.toString(), category: 'command-injection' },
        };
      }
    }

    // LDAP Injection patterns
    const ldapInjectionPatterns = [
      /(\*\)\s*\(/i,
      /(\|\s*\(/i,
      /(&\s*\(/i,
      /(\)\s*\(/i,
      /(\([^)]*\)\s*\(/i,
    ];

    for (const pattern of ldapInjectionPatterns) {
      if (pattern.test(combined)) {
        return {
          detected: true,
          threatType: 'ldap-injection',
          severity: 'high',
          details: { pattern: pattern.toString(), category: 'ldap-injection' },
        };
      }
    }

    // NoSQL Injection patterns
    const nosqlInjectionPatterns = [
      /(\$where\s*:)/i,
      /(\$ne\s*:)/i,
      /(\$gt\s*:)/i,
      /(\$lt\s*:)/i,
      /(\$regex\s*:)/i,
      /(\$exists\s*:)/i,
      /(\$in\s*:)/i,
      /(\$nin\s*:)/i,
      /(\$or\s*:)/i,
      /(\$and\s*:)/i,
    ];

    for (const pattern of nosqlInjectionPatterns) {
      if (pattern.test(combined)) {
        return {
          detected: true,
          threatType: 'nosql-injection',
          severity: 'high',
          details: { pattern: pattern.toString(), category: 'nosql-injection' },
        };
      }
    }

    // Template Injection patterns (Jinja2, Twig, etc.)
    const templateInjectionPatterns = [
      /(\{\{[^}]*\}\})/,
      /(\{%[^%]*%\})/,
      /(\{#[^#]*#\})/,
      /(\{\{.*__.*\}\})/,
      /(\{\{.*config.*\}\})/,
      /(\{\{.*self.*\}\})/,
    ];

    for (const pattern of templateInjectionPatterns) {
      if (pattern.test(combined)) {
        return {
          detected: true,
          threatType: 'template-injection',
          severity: 'high',
          details: { pattern: pattern.toString(), category: 'template-injection' },
        };
      }
    }

    return { detected: false };
  }

  /**
   * Check rate limiting with support for different strategies
   */
  private checkRateLimit(sourceIP: string, timestamp: number): {
    blocked: boolean;
    count: number;
  } {
    if (!this.config?.enableRateLimiting || !this.config.rateLimitPerMinute) {
      return { blocked: false, count: 0 };
    }

    const strategy = this.config.rateLimitStrategy || 'fixed-window';
    const limit = this.config.rateLimitPerMinute;

    switch (strategy) {
      case 'sliding-window':
        return this.checkSlidingWindowRateLimit(sourceIP, timestamp, limit);
      case 'token-bucket':
        return this.checkTokenBucketRateLimit(sourceIP, timestamp, limit);
      case 'fixed-window':
      default:
        return this.checkFixedWindowRateLimit(sourceIP, timestamp, limit);
    }
  }

  /**
   * Fixed window rate limiting (original implementation)
   */
  private checkFixedWindowRateLimit(sourceIP: string, timestamp: number, limit: number): {
    blocked: boolean;
    count: number;
  } {
    const windowStart = timestamp - this.RATE_LIMIT_WINDOW_MS;
    const requests = this.rateLimitTracker.get(sourceIP) || [];
    const recentRequests = requests.filter(t => t > windowStart);

    if (recentRequests.length >= limit) {
      return { blocked: true, count: recentRequests.length };
    }

    recentRequests.push(timestamp);
    this.rateLimitTracker.set(sourceIP, recentRequests);

    // Cleanup old entries
    if (requests.length > limit * 2) {
      this.rateLimitTracker.set(sourceIP, recentRequests);
    }

    return { blocked: false, count: recentRequests.length };
  }

  /**
   * Sliding window rate limiting (more accurate)
   */
  private checkSlidingWindowRateLimit(sourceIP: string, timestamp: number, limit: number): {
    blocked: boolean;
    count: number;
  } {
    const windowStart = timestamp - this.RATE_LIMIT_WINDOW_MS;
    let tracker = this.slidingWindowTracker.get(sourceIP);

    if (!tracker || tracker.windowStart < windowStart) {
      // New window or expired window
      tracker = { requests: [timestamp], windowStart: timestamp };
      this.slidingWindowTracker.set(sourceIP, tracker);
      return { blocked: false, count: 1 };
    }

    // Remove requests outside the window
    tracker.requests = tracker.requests.filter(t => t > windowStart);

    if (tracker.requests.length >= limit) {
      return { blocked: true, count: tracker.requests.length };
    }

    tracker.requests.push(timestamp);
    this.slidingWindowTracker.set(sourceIP, tracker);

    return { blocked: false, count: tracker.requests.length };
  }

  /**
   * Token bucket rate limiting (allows bursts)
   */
  private checkTokenBucketRateLimit(sourceIP: string, timestamp: number, limit: number): {
    blocked: boolean;
    count: number;
  } {
    const burst = this.config?.rateLimitBurst || limit;
    const refillRate = limit / (this.RATE_LIMIT_WINDOW_MS / 1000); // tokens per second
    let bucket = this.tokenBucketTracker.get(sourceIP);

    if (!bucket) {
      bucket = { tokens: burst, lastRefill: timestamp };
      this.tokenBucketTracker.set(sourceIP, bucket);
    }

    // Refill tokens based on time passed
    const timePassed = (timestamp - bucket.lastRefill) / 1000; // seconds
    const tokensToAdd = timePassed * refillRate;
    bucket.tokens = Math.min(burst, bucket.tokens + tokensToAdd);
    bucket.lastRefill = timestamp;

    if (bucket.tokens < 1) {
      return { blocked: true, count: Math.floor(burst - bucket.tokens) };
    }

    bucket.tokens -= 1;
    this.tokenBucketTracker.set(sourceIP, bucket);

    return { blocked: false, count: Math.floor(burst - bucket.tokens) };
  }

  /**
   * Check if IP is in list (supports CIDR notation)
   */
  private isIPInList(ip: string, list: string[]): boolean {
    for (const entry of list) {
      if (entry.includes('/')) {
        // CIDR notation
        if (this.isIPInCIDR(ip, entry)) {
          return true;
        }
      } else {
        // Exact match
        if (ip === entry) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if IP is in CIDR range
   */
  private isIPInCIDR(ip: string, cidr: string): boolean {
    try {
      const [network, prefixLengthStr] = cidr.split('/');
      const prefixLength = parseInt(prefixLengthStr, 10);

      if (isNaN(prefixLength) || prefixLength < 0 || prefixLength > 32) {
        return false;
      }

      const ipToNumber = (ipStr: string): number => {
        const parts = ipStr.split('.').map(Number);
        if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
          return -1;
        }
        return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
      };

      const ipNum = ipToNumber(ip);
      const networkNum = ipToNumber(network);

      if (ipNum === -1 || networkNum === -1) {
        return false;
      }

      const mask = (0xFFFFFFFF << (32 - prefixLength)) >>> 0;
      return (ipNum & mask) === (networkNum & mask);
    } catch {
      return false;
    }
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
   * API Shield: Schema Validation
   */
  private validateSchema(request: WAFRequest): {
    valid: boolean;
    errors?: string[];
  } {
    const config = this.config?.schemaValidation;
    if (!config || !config.schema) {
      return { valid: true };
    }

    try {
      // Simplified schema validation (without external dependencies)
      // In production, use ajv or similar library
      const schema = JSON.parse(config.schema);
      const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;

      // Basic JSON Schema validation (simplified)
      if (schema.type === 'object' && typeof body !== 'object') {
        return { valid: false, errors: ['Body must be an object'] };
      }

      if (schema.required && Array.isArray(schema.required)) {
        const missing = schema.required.filter((field: string) => !(field in (body || {})));
        if (missing.length > 0) {
          return { valid: false, errors: [`Missing required fields: ${missing.join(', ')}`] };
        }
      }

      // Type checking
      if (schema.properties && typeof body === 'object' && body !== null) {
        for (const [key, propSchema] of Object.entries(schema.properties as Record<string, any>)) {
          if (key in body) {
            const value = (body as any)[key];
            if (propSchema.type === 'string' && typeof value !== 'string') {
              return { valid: false, errors: [`Field ${key} must be a string`] };
            }
            if (propSchema.type === 'number' && typeof value !== 'number') {
              return { valid: false, errors: [`Field ${key} must be a number`] };
            }
            if (propSchema.type === 'boolean' && typeof value !== 'boolean') {
              return { valid: false, errors: [`Field ${key} must be a boolean`] };
            }
          }
        }
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, errors: [`Schema validation error: ${error instanceof Error ? error.message : 'Unknown error'}`] };
    }
  }

  /**
   * API Shield: JWT Validation
   */
  private validateJWT(request: WAFRequest): {
    valid: boolean;
    error?: string;
  } {
    const config = this.config?.jwtValidation;
    if (!config) {
      return { valid: true };
    }

    // Extract JWT from Authorization header
    const authHeader = request.headers?.['authorization'] || request.headers?.['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { valid: false, error: 'Missing or invalid Authorization header' };
    }

    const token = authHeader.substring(7);
    if (!token) {
      return { valid: false, error: 'JWT token is empty' };
    }

    try {
      // Parse JWT (simplified - in production use jsonwebtoken library)
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { valid: false, error: 'Invalid JWT format' };
      }

      const payload = JSON.parse(atob(parts[1]));

      // Check expiration
      if (config.requireExpiration !== false && payload.exp) {
        const exp = payload.exp * 1000; // Convert to milliseconds
        if (Date.now() > exp) {
          return { valid: false, error: 'JWT token has expired' };
        }
      }

      // Check issuer
      if (config.issuer && payload.iss !== config.issuer) {
        return { valid: false, error: `Invalid issuer: expected ${config.issuer}, got ${payload.iss}` };
      }

      // Check audience
      if (config.audience && config.audience.length > 0) {
        const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
        const hasAudience = config.audience.some(a => aud.includes(a));
        if (!hasAudience) {
          return { valid: false, error: `Invalid audience: expected one of ${config.audience.join(', ')}, got ${aud.join(', ')}` };
        }
      }

      // Note: Signature verification would require the secret/publicKey
      // This is a simplified validation - in production, verify the signature

      return { valid: true };
    } catch (error) {
      return { valid: false, error: `JWT validation error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  /**
   * API Shield: API Key Validation
   */
  private validateAPIKey(request: WAFRequest): {
    valid: boolean;
    error?: string;
    keyId?: string;
  } {
    const config = this.config?.apiKeyValidation;
    if (!config || !config.keys || config.keys.length === 0) {
      return { valid: true };
    }

    const headerName = config.headerName || 'X-API-Key';
    const apiKey = request.headers?.[headerName.toLowerCase()] || request.headers?.[headerName];

    if (!apiKey) {
      return { valid: false, error: `Missing API key in header ${headerName}` };
    }

    // Find matching key
    const key = config.keys.find(k => k.enabled && k.key === apiKey);
    if (!key) {
      return { valid: false, error: 'Invalid API key' };
    }

    // Check if key is allowed for this path
    if (key.allowedPaths && key.allowedPaths.length > 0) {
      const pathAllowed = key.allowedPaths.some(path => {
        if (path.endsWith('*')) {
          return request.path.startsWith(path.slice(0, -1));
        }
        return request.path === path;
      });
      if (!pathAllowed) {
        return { valid: false, error: `API key not allowed for path ${request.path}` };
      }
    }

    // Per-key rate limiting would be implemented here if needed

    return { valid: true, keyId: key.id };
  }

  /**
   * API Shield: GraphQL Query Protection
   */
  private validateGraphQL(request: WAFRequest): {
    valid: boolean;
    error?: string;
  } {
    const config = this.config?.graphQLProtection;
    if (!config) {
      return { valid: true };
    }

    // Check if this is a GraphQL request
    const contentType = request.headers?.['content-type'] || '';
    const isGraphQL = contentType.includes('application/graphql') || 
                     contentType.includes('application/json') ||
                     request.path.includes('/graphql');

    if (!isGraphQL) {
      return { valid: true }; // Not a GraphQL request
    }

    try {
      const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
      const query = body?.query || body?.Query || '';

      if (!query) {
        return { valid: true }; // No query to validate
      }

      // Block introspection queries if configured
      if (config.blockIntrospection) {
        if (query.includes('__schema') || query.includes('__type') || query.includes('__typename')) {
          return { valid: false, error: 'Introspection queries are blocked' };
        }
      }

      // Calculate query depth
      const depth = this.calculateGraphQLDepth(query);
      if (config.maxDepth && depth > config.maxDepth) {
        return { valid: false, error: `Query depth ${depth} exceeds maximum ${config.maxDepth}` };
      }

      // Calculate query complexity (simplified)
      const complexity = this.calculateGraphQLComplexity(query);
      if (config.maxComplexity && complexity > config.maxComplexity) {
        return { valid: false, error: `Query complexity ${complexity} exceeds maximum ${config.maxComplexity}` };
      }

      // Count aliases
      const aliasMatches = query.match(/\w+:/g) || [];
      const aliasCount = aliasMatches.length;
      if (config.maxAliases && aliasCount > config.maxAliases) {
        return { valid: false, error: `Query has ${aliasCount} aliases, exceeds maximum ${config.maxAliases}` };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: `GraphQL validation error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  /**
   * Calculate GraphQL query depth
   */
  private calculateGraphQLDepth(query: string): number {
    let maxDepth = 0;
    let currentDepth = 0;
    const stack: string[] = [];

    for (let i = 0; i < query.length; i++) {
      const char = query[i];
      if (char === '{') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
        stack.push('{');
      } else if (char === '}') {
        if (stack.length > 0 && stack[stack.length - 1] === '{') {
          stack.pop();
          currentDepth--;
        }
      }
    }

    return maxDepth;
  }

  /**
   * Calculate GraphQL query complexity (simplified - counts fields)
   */
  private calculateGraphQLComplexity(query: string): number {
    // Simple complexity calculation: count field selections
    const fieldMatches = query.match(/\w+\s*\{/g) || [];
    return fieldMatches.length;
  }

  /**
   * Bot Detection
   */
  private detectBot(request: WAFRequest, sourceIP: string): {
    detected: boolean;
    blocked?: boolean;
    challenge?: boolean;
    method?: string;
  } {
    const config = this.config?.botDetection;
    if (!config) {
      return { detected: false };
    }

    // User-Agent based detection
    if (config.methods.includes('user-agent')) {
      const userAgent = request.userAgent || '';
      const knownBots = [
        'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
        'yandexbot', 'sogou', 'exabot', 'facebot', 'ia_archiver',
        'scrapy', 'python-requests', 'curl', 'wget', 'postman',
        'apache-httpclient', 'okhttp', 'go-http-client',
      ];

      const isKnownBot = knownBots.some(bot => userAgent.toLowerCase().includes(bot));
      if (isKnownBot) {
        if (config.blockKnownBots) {
          return { detected: true, blocked: true, method: 'user-agent' };
        }
        return { detected: true, blocked: false, method: 'user-agent' };
      }

      // Suspicious user agents
      if (!userAgent || userAgent.length < 10) {
        return { detected: true, challenge: config.challengeSuspicious, method: 'user-agent' };
      }
    }

    // Behavioral detection (simplified)
    if (config.methods.includes('behavioral')) {
      // Check for rapid requests (would need request history)
      // This is a simplified check - in production, track request patterns
      const hasCookies = request.headers && Object.keys(request.headers).some(k => 
        k.toLowerCase().includes('cookie') && request.headers[k]
      );
      if (!hasCookies && request.method === 'GET') {
        // Suspicious: GET request without cookies
        return { detected: true, challenge: config.challengeSuspicious, method: 'behavioral' };
      }
    }

    return { detected: false };
  }

  /**
   * Anomaly Detection
   */
  private detectAnomaly(sourceIP: string, timestamp: number): {
    detected: boolean;
    factor?: number;
  } {
    const config = this.config?.anomalyDetection;
    if (!config) {
      return { detected: false };
    }

    const threshold = config.threshold || 3.0; // 3x average
    const windowSize = (config.windowSize || 60) * 1000; // Convert to ms

    // Get request history for this IP
    let history = this.anomalyTracker.get(sourceIP) || [];
    const windowStart = timestamp - windowSize;

    // Filter to window
    history = history.filter(t => t > windowStart);
    history.push(timestamp);
    this.anomalyTracker.set(sourceIP, history);

    // Calculate average requests per second
    if (history.length < 2) {
      return { detected: false };
    }

    const timeSpan = (history[history.length - 1] - history[0]) / 1000; // seconds
    if (timeSpan <= 0) {
      return { detected: false };
    }

    const avgRPS = history.length / timeSpan;

    // Check if current rate is anomalous
    // Simplified: if we have more than threshold * average in the last second
    const recentRequests = history.filter(t => t > timestamp - 1000);
    const currentRPS = recentRequests.length;

    if (avgRPS > 0 && currentRPS > avgRPS * threshold) {
      return { detected: true, factor: currentRPS / avgRPS };
    }

    return { detected: false };
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
    this.slidingWindowTracker.clear();
    this.tokenBucketTracker.clear();
    this.ddosTracker.clear();
    this.anomalyTracker.clear();
  }
}


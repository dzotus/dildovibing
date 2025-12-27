/**
 * Istio Service Mesh Routing Engine
 * Handles request routing through VirtualServices, DestinationRules, Gateways
 * Simulates Istio behavior including mTLS, circuit breakers, retries, timeouts, and load balancing
 */

export interface IstioService {
  id: string;
  name: string;
  namespace: string;
  host: string; // FQDN: service.namespace.svc.cluster.local
  ports?: Array<{
    number: number;
    protocol: 'HTTP' | 'HTTPS' | 'TCP' | 'gRPC';
    name?: string;
  }>;
  labels?: Record<string, string>;
  // Statistics
  requests?: number;
  errors?: number;
  latency?: number; // ms
  pods?: number;
  healthyPods?: number;
}

export interface IstioVirtualService {
  id: string;
  name: string;
  namespace?: string;
  hosts: string[]; // Service FQDNs or wildcards
  gateways?: string[]; // Gateway names
  http?: Array<{
    match?: Array<{
      uri?: { exact?: string; prefix?: string; regex?: string };
      method?: { exact?: string; regex?: string };
      headers?: Record<string, { exact?: string; prefix?: string; regex?: string }>;
      queryParams?: Record<string, { exact?: string; regex?: string }>;
      authority?: { exact?: string; prefix?: string; regex?: string };
    }>;
    route?: Array<{
      destination: {
        host: string;
        subset?: string;
        port?: { number: number };
      };
      weight?: number; // 0-100
    }>;
    redirect?: {
      uri?: string;
      authority?: string;
      redirectCode?: number;
    };
    rewrite?: {
      uri?: string;
      authority?: string;
    };
    timeout?: string; // e.g., "30s"
    retries?: {
      attempts?: number;
      perTryTimeout?: string;
      retryOn?: string; // e.g., "5xx,reset,connect-failure"
    };
    fault?: {
      delay?: {
        percentage?: { value?: number };
        fixedDelay?: string;
      };
      abort?: {
        percentage?: { value?: number };
        httpStatus?: number;
      };
    };
    mirror?: {
      host: string;
      subset?: string;
    };
    mirrorPercentage?: {
      value?: number;
    };
    corsPolicy?: {
      allowOrigin?: string[];
      allowMethods?: string[];
      allowHeaders?: string[];
      exposeHeaders?: string[];
      maxAge?: string;
    };
  }>;
  tcp?: Array<{
    match?: Array<{
      port?: number;
      destinationSubnets?: string[];
    }>;
    route?: Array<{
      destination: {
        host: string;
        subset?: string;
        port?: { number: number };
      };
      weight?: number;
    }>;
  }>;
  tls?: Array<{
    match?: Array<{
      port?: number;
      sniHosts?: string[];
    }>;
    route?: Array<{
      destination: {
        host: string;
        subset?: string;
        port?: { number: number };
      };
      weight?: number;
    }>;
  }>;
}

export interface IstioDestinationRule {
  id: string;
  name: string;
  namespace?: string;
  host: string; // Service FQDN
  subsets?: Array<{
    name: string;
    labels?: Record<string, string>;
    trafficPolicy?: IstioTrafficPolicy;
  }>;
  trafficPolicy?: IstioTrafficPolicy;
}

export interface IstioTrafficPolicy {
  loadBalancer?: {
    simple?: 'ROUND_ROBIN' | 'LEAST_CONN' | 'RANDOM' | 'PASSTHROUGH';
    consistentHash?: {
      httpHeaderName?: string;
      httpCookie?: {
        name: string;
        ttl?: string;
      };
      useSourceIp?: boolean;
      minimumRingSize?: number;
    };
  };
  connectionPool?: {
    tcp?: {
      maxConnections?: number;
      connectTimeout?: string;
    };
    http?: {
      http1MaxPendingRequests?: number;
      http2MaxRequests?: number;
      maxRequestsPerConnection?: number;
      idleTimeout?: string;
      h2UpgradePolicy?: 'DEFAULT' | 'DO_NOT_UPGRADE' | 'UPGRADE';
    };
  };
  outlierDetection?: {
    consecutiveErrors?: number;
    interval?: string;
    baseEjectionTime?: string;
    maxEjectionPercent?: number;
    minHealthPercent?: number;
  };
  tls?: {
    mode?: 'DISABLE' | 'SIMPLE' | 'MUTUAL' | 'ISTIO_MUTUAL';
    clientCertificate?: string;
    privateKey?: string;
    caCertificates?: string;
    sni?: string;
  };
  portLevelSettings?: Array<{
    port?: { number: number };
    loadBalancer?: any;
    connectionPool?: any;
    outlierDetection?: any;
  }>;
}

export interface IstioGateway {
  id: string;
  name: string;
  namespace?: string;
  selector?: Record<string, string>; // Pod labels
  servers?: Array<{
    port: {
      number: number;
      protocol: 'HTTP' | 'HTTPS' | 'TCP' | 'TLS' | 'GRPC';
      name: string;
    };
    hosts: string[]; // Hostnames
    tls?: {
      httpsRedirect?: boolean;
      mode?: 'SIMPLE' | 'MUTUAL' | 'ISTIO_MUTUAL' | 'PASSTHROUGH';
      serverCertificate?: string;
      privateKey?: string;
      caCertificates?: string;
      credentialName?: string;
      minProtocolVersion?: string;
      maxProtocolVersion?: string;
      cipherSuites?: string[];
    };
  }>;
}

export interface IstioPeerAuthentication {
  id: string;
  name: string;
  namespace?: string;
  selector?: {
    matchLabels?: Record<string, string>;
  };
  mtls?: {
    mode: 'STRICT' | 'PERMISSIVE' | 'DISABLE';
  };
  portLevelMtls?: Record<number, { mode: 'STRICT' | 'PERMISSIVE' | 'DISABLE' }>;
}

export interface IstioAuthorizationPolicy {
  id: string;
  name: string;
  namespace?: string;
  selector?: {
    matchLabels?: Record<string, string>;
  };
  action?: 'ALLOW' | 'DENY' | 'AUDIT' | 'CUSTOM';
  rules?: Array<{
    from?: Array<{
      source?: {
        principals?: string[];
        namespaces?: string[];
        ipBlocks?: string[];
        requestPrincipals?: string[];
      };
    }>;
    to?: Array<{
      operation?: {
        hosts?: string[];
        methods?: string[];
        paths?: string[];
        ports?: string[];
      };
    }>;
    when?: Array<{
      key: string;
      values?: string[];
      notValues?: string[];
    }>;
  }>;
}

export interface IstioServiceEntry {
  id: string;
  name: string;
  namespace?: string;
  hosts: string[];
  addresses?: string[];
  ports?: Array<{
    number: number;
    protocol: 'HTTP' | 'HTTPS' | 'TCP' | 'TLS' | 'gRPC';
    name: string;
  }>;
  location?: 'MESH_EXTERNAL' | 'MESH_INTERNAL';
  resolution?: 'NONE' | 'STATIC' | 'DNS';
  endpoints?: Array<{
    address: string;
    ports?: Record<string, number>;
    labels?: Record<string, string>;
    locality?: string;
    weight?: number;
  }>;
}

export interface IstioSidecar {
  id: string;
  name: string;
  namespace?: string;
  workloadSelector?: {
    labels?: Record<string, string>;
  };
  egress?: Array<{
    hosts: string[];
    port?: {
      number: number;
      protocol: string;
    };
  }>;
  ingress?: Array<{
    port: {
      number: number;
      protocol: string;
    };
    defaultEndpoint?: string;
  }>;
}

export interface IstioRequest {
  path: string;
  method: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  clientIP?: string;
  protocol?: 'http' | 'https' | 'grpc' | 'tcp';
  host?: string;
  authority?: string; // Host header
  sourcePrincipal?: string; // For mTLS
  destinationPrincipal?: string;
}

export interface IstioResponse {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
  latency?: number;
  error?: string;
  serviceTarget?: string;
  subsetTarget?: string;
  endpointTarget?: string;
  virtualServiceMatched?: string;
  destinationRuleMatched?: string;
  retryAttempts?: number;
  circuitBreakerOpen?: boolean;
}

export interface IstioStats {
  services: number;
  virtualServices: number;
  destinationRules: number;
  gateways: number;
  totalRequests: number;
  totalResponses: number;
  totalErrors: number;
  activeConnections: number;
  totalBytesIn: number;
  totalBytesOut: number;
  errorRate: number;
  averageLatency: number;
  mtlsConnections: number;
  circuitBreakerTrips: number;
  retryAttempts: number;
  timeoutErrors: number;
  rateLimitBlocks: number;
}

export interface IstioGlobalConfig {
  enableMTLS?: boolean;
  mtlsMode?: 'STRICT' | 'PERMISSIVE' | 'DISABLE';
  enableTracing?: boolean;
  tracingProvider?: 'jaeger' | 'zipkin' | 'datadog';
  enableMetrics?: boolean;
  metricsProvider?: 'prometheus' | 'statsd';
  enableAccessLog?: boolean;
  maxConnections?: number;
  defaultTimeout?: string;
  defaultRetryAttempts?: number;
}

/**
 * Istio Service Mesh Routing Engine
 * Simulates Istio request routing and traffic management behavior
 */
export class IstioRoutingEngine {
  private services: Map<string, IstioService> = new Map(); // host -> service
  private virtualServices: Map<string, IstioVirtualService> = new Map(); // name -> vs
  private destinationRules: Map<string, IstioDestinationRule> = new Map(); // name -> dr
  private gateways: Map<string, IstioGateway> = new Map(); // name -> gateway
  private peerAuthentications: Map<string, IstioPeerAuthentication> = new Map();
  private authorizationPolicies: Map<string, IstioAuthorizationPolicy> = new Map();
  private serviceEntries: Map<string, IstioServiceEntry> = new Map();
  private sidecars: Map<string, IstioSidecar> = new Map();
  private globalConfig: IstioGlobalConfig = {};
  
  // Load balancing state
  private roundRobinCounters: Map<string, number> = new Map(); // service:subset -> counter
  private leastConnCounts: Map<string, Map<string, number>> = new Map(); // service:subset -> endpoint -> connections
  private consistentHashRing: Map<string, Map<string, string>> = new Map(); // service:subset -> hash -> endpoint
  
  // Connection pool state
  private connectionPoolCounts: Map<string, number> = new Map(); // service:subset -> active connections
  
  // Circuit breaker state
  private circuitBreakerState: Map<string, {
    isOpen: boolean;
    consecutiveErrors: number;
    openUntil?: number;
    halfOpenRequests?: number;
  }> = new Map(); // service:subset -> state
  
  // Outlier detection state
  private outlierDetectionState: Map<string, Map<string, {
    consecutiveErrors: number;
    ejectedUntil?: number;
  }>> = new Map(); // service:subset -> endpoint -> state
  
  // mTLS state
  private mtlsConnections: Map<string, boolean> = new Map(); // connection key -> is mTLS
  
  // Statistics
  private requestCount: number = 0;
  private responseCount: number = 0;
  private errorCount: number = 0;
  private totalBytesIn: number = 0;
  private totalBytesOut: number = 0;
  private activeConnections: number = 0;
  private totalLatency: number = 0;
  private circuitBreakerTrips: number = 0;
  private retryAttempts: number = 0;
  private timeoutErrors: number = 0;
  private rateLimitBlocks: number = 0;
  
  // Service endpoint tracking
  private serviceEndpoints: Map<string, Array<{
    address: string;
    port: number;
    weight?: number;
    healthy?: boolean;
    labels?: Record<string, string>;
  }>> = new Map(); // service:subset -> endpoints

  /**
   * Initialize with Istio configuration
   */
  public initialize(config: {
    services?: IstioService[];
    virtualServices?: IstioVirtualService[];
    destinationRules?: IstioDestinationRule[];
    gateways?: IstioGateway[];
    peerAuthentications?: IstioPeerAuthentication[];
    authorizationPolicies?: IstioAuthorizationPolicy[];
    serviceEntries?: IstioServiceEntry[];
    sidecars?: IstioSidecar[];
    globalConfig?: IstioGlobalConfig;
  }) {
    // Clear previous state
    this.services.clear();
    this.virtualServices.clear();
    this.destinationRules.clear();
    this.gateways.clear();
    this.peerAuthentications.clear();
    this.authorizationPolicies.clear();
    this.serviceEntries.clear();
    this.sidecars.clear();
    this.roundRobinCounters.clear();
    this.leastConnCounts.clear();
    this.consistentHashRing.clear();
    this.circuitBreakerState.clear();
    this.outlierDetectionState.clear();
    this.mtlsConnections.clear();
    this.serviceEndpoints.clear();
    this.connectionPoolCounts.clear();
    
    // Store global config
    this.globalConfig = config.globalConfig || {};
    
    // Initialize services
    if (config.services) {
      for (const service of config.services) {
        const host = this.normalizeHost(service.host);
        this.services.set(host, service);
        
        // Initialize endpoints for service
        if (service.ports && service.ports.length > 0) {
          const defaultPort = service.ports[0].number;
          const key = `${host}:default`;
          this.serviceEndpoints.set(key, [{
            address: service.host,
            port: defaultPort,
            weight: 100,
            healthy: true,
            labels: service.labels,
          }]);
        }
      }
    }
    
    // Initialize virtual services
    if (config.virtualServices) {
      for (const vs of config.virtualServices) {
        this.virtualServices.set(vs.name, vs);
      }
    }
    
    // Initialize destination rules
    if (config.destinationRules) {
      for (const dr of config.destinationRules) {
        this.destinationRules.set(dr.name, dr);
        
        // Initialize subsets and endpoints
        if (dr.subsets) {
          for (const subset of dr.subsets) {
            const key = `${dr.host}:${subset.name}`;
            this.roundRobinCounters.set(key, 0);
            this.leastConnCounts.set(key, new Map());
            
            // Initialize endpoints from service
            const service = this.services.get(this.normalizeHost(dr.host));
            if (service && service.ports && service.ports.length > 0) {
              const port = service.ports[0].number;
              this.serviceEndpoints.set(key, [{
                address: service.host,
                port: port,
                weight: 100,
                healthy: true,
                labels: subset.labels,
              }]);
            }
          }
        }
      }
    }
    
    // Initialize gateways
    if (config.gateways) {
      for (const gw of config.gateways) {
        this.gateways.set(gw.name, gw);
      }
    }
    
    // Initialize peer authentications
    if (config.peerAuthentications) {
      for (const pa of config.peerAuthentications) {
        this.peerAuthentications.set(pa.name, pa);
      }
    }
    
    // Initialize authorization policies
    if (config.authorizationPolicies) {
      for (const ap of config.authorizationPolicies) {
        this.authorizationPolicies.set(ap.name, ap);
      }
    }
    
    // Initialize service entries
    if (config.serviceEntries) {
      for (const se of config.serviceEntries) {
        this.serviceEntries.set(se.name, se);
        
        // Add endpoints from service entry
        if (se.endpoints) {
          for (const host of se.hosts) {
            const normalizedHost = this.normalizeHost(host);
            if (se.ports && se.ports.length > 0) {
              const port = se.ports[0].number;
              const key = `${normalizedHost}:default`;
              this.serviceEndpoints.set(key, se.endpoints.map(ep => ({
                address: ep.address,
                port: ep.ports ? Object.values(ep.ports)[0] : port,
                weight: ep.weight || 100,
                healthy: true,
                labels: ep.labels,
              })));
            }
          }
        }
      }
    }
    
    // Initialize sidecars
    if (config.sidecars) {
      for (const sc of config.sidecars) {
        this.sidecars.set(sc.name, sc);
      }
    }
    
    // Reset statistics
    this.requestCount = 0;
    this.responseCount = 0;
    this.errorCount = 0;
    this.totalBytesIn = 0;
    this.totalBytesOut = 0;
    this.activeConnections = 0;
    this.totalLatency = 0;
    this.circuitBreakerTrips = 0;
    this.retryAttempts = 0;
    this.timeoutErrors = 0;
    this.rateLimitBlocks = 0;
  }

  /**
   * Route a request through Istio service mesh
   */
  public routeRequest(request: IstioRequest, gatewayName?: string): {
    virtualService: IstioVirtualService | null;
    destinationRule: IstioDestinationRule | null;
    response: IstioResponse;
    serviceTarget?: string;
    subsetTarget?: string;
    endpointTarget?: string;
  } {
    const startTime = Date.now();
    this.requestCount++;
    this.activeConnections++;
    
    try {
      // Step 1: Check mTLS if enabled
      const mtlsResult = this.checkMTLS(request);
      if (!mtlsResult.allowed) {
        this.activeConnections--;
        this.errorCount++;
        return {
          virtualService: null,
          destinationRule: null,
          response: {
            status: 403,
            error: 'mTLS authentication failed',
            latency: Date.now() - startTime,
          },
        };
      }
      
      // Step 2: Check authorization policies
      const authResult = this.checkAuthorization(request);
      if (!authResult.allowed) {
        this.activeConnections--;
        this.errorCount++;
        return {
          virtualService: null,
          destinationRule: null,
          response: {
            status: 403,
            error: authResult.reason || 'Authorization denied',
            latency: Date.now() - startTime,
          },
        };
      }
      
      // Step 3: Find matching VirtualService
      const vs = this.findMatchingVirtualService(request, gatewayName);
      if (!vs) {
        // No VirtualService match - direct routing to service
        const service = this.findServiceByHost(request.host || '');
        if (!service) {
          this.activeConnections--;
          this.errorCount++;
          return {
            virtualService: null,
            destinationRule: null,
            response: {
              status: 404,
              error: `Service not found: ${request.host}`,
              latency: Date.now() - startTime,
            },
          };
        }
        
        // Direct routing without VirtualService
        const result = this.routeToService(service.host, undefined, request, startTime);
        this.activeConnections--;
        return result;
      }
      
      // Step 4: Match HTTP route in VirtualService
      const httpMatch = this.matchHTTPRoute(vs, request);
      if (!httpMatch) {
        this.activeConnections--;
        this.errorCount++;
        return {
          virtualService: vs,
          destinationRule: null,
          response: {
            status: 404,
            error: 'No matching route in VirtualService',
            latency: Date.now() - startTime,
          },
        };
      }
      
      // Step 5: Apply fault injection if configured
      const faultResult = this.applyFaultInjection(httpMatch.fault, request);
      if (faultResult.abort) {
        this.activeConnections--;
        this.errorCount++;
        return {
          virtualService: vs,
          destinationRule: null,
          response: {
            status: faultResult.abort.httpStatus || 500,
            error: 'Fault injection: abort',
            latency: Date.now() - startTime,
          },
        };
      }
      
      // Step 6: Apply delay if configured
      if (faultResult.delay) {
        // Simulate delay
        const delayMs = this.parseDuration(faultResult.delay.fixedDelay || '0s');
        // Note: In real implementation, this would be async
      }
      
      // Step 7: Route to destination
      let destination: { host: string; subset?: string; port?: number } | null = null;
      if (httpMatch.route && httpMatch.route.length > 0) {
        destination = this.selectDestination(httpMatch.route, request);
      } else if (httpMatch.redirect) {
        this.activeConnections--;
        this.responseCount++;
        return {
          virtualService: vs,
          destinationRule: null,
          response: {
            status: httpMatch.redirect.redirectCode || 301,
            headers: {
              'Location': httpMatch.redirect.uri || httpMatch.redirect.authority || '',
            },
            latency: Date.now() - startTime,
          },
        };
      }
      
      if (!destination) {
        this.activeConnections--;
        this.errorCount++;
        return {
          virtualService: vs,
          destinationRule: null,
          response: {
            status: 500,
            error: 'No destination configured',
            latency: Date.now() - startTime,
          },
        };
      }
      
      // Step 8: Find DestinationRule
      const dr = this.findDestinationRule(destination.host);
      
      // Step 9: Route to service with retry logic
      const routeResult = this.routeToService(
        destination.host,
        destination.subset,
        destination.port,
        request,
        startTime,
        httpMatch.retries,
        httpMatch.timeout,
        dr
      );
      
      routeResult.virtualService = vs;
      routeResult.destinationRule = dr;
      
      this.activeConnections--;
      return routeResult;
      
    } catch (error: any) {
      this.activeConnections--;
      this.errorCount++;
      return {
        virtualService: null,
        destinationRule: null,
        response: {
          status: 500,
          error: error.message || 'Internal error',
          latency: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Check mTLS authentication
   */
  private checkMTLS(request: IstioRequest): { allowed: boolean; reason?: string } {
    const mtlsMode = this.globalConfig.mtlsMode || 
                     (this.globalConfig.enableMTLS ? 'PERMISSIVE' : 'DISABLE');
    
    if (mtlsMode === 'DISABLE') {
      return { allowed: true };
    }
    
    // Check PeerAuthentication policies
    for (const pa of this.peerAuthentications.values()) {
      // Simplified: check if request matches selector
      if (pa.mtls) {
        if (pa.mtls.mode === 'STRICT' && !request.sourcePrincipal) {
          return { allowed: false, reason: 'mTLS required but not provided' };
        }
        if (pa.mtls.mode === 'DISABLE') {
          return { allowed: true };
        }
      }
    }
    
    // Check global mTLS mode
    if (mtlsMode === 'STRICT' && !request.sourcePrincipal) {
      return { allowed: false, reason: 'mTLS required in STRICT mode' };
    }
    
    return { allowed: true };
  }

  /**
   * Check authorization policies
   */
  private checkAuthorization(request: IstioRequest): { allowed: boolean; reason?: string } {
    // Find matching authorization policies
    const matchingPolicies: IstioAuthorizationPolicy[] = [];
    
    for (const ap of this.authorizationPolicies.values()) {
      // Simplified matching - in real Istio, this is more complex
      if (this.matchesAuthorizationPolicy(ap, request)) {
        matchingPolicies.push(ap);
      }
    }
    
    if (matchingPolicies.length === 0) {
      // No policies = allow (default)
      return { allowed: true };
    }
    
    // Check policies in order
    for (const ap of matchingPolicies) {
      const action = ap.action || 'ALLOW';
      
      if (action === 'DENY') {
        return { allowed: false, reason: `Denied by policy: ${ap.name}` };
      }
      
      if (action === 'ALLOW') {
        // Check if request matches rules
        if (ap.rules && ap.rules.length > 0) {
          let matched = false;
          for (const rule of ap.rules) {
            if (this.matchesAuthorizationRule(rule, request)) {
              matched = true;
              break;
            }
          }
          if (!matched) {
            return { allowed: false, reason: `No matching rule in policy: ${ap.name}` };
          }
        }
        return { allowed: true };
      }
    }
    
    return { allowed: true };
  }

  /**
   * Check if request matches authorization policy
   */
  private matchesAuthorizationPolicy(ap: IstioAuthorizationPolicy, request: IstioRequest): boolean {
    // Simplified: always match if no selector
    if (!ap.selector || !ap.selector.matchLabels) {
      return true;
    }
    
    // In real Istio, this would check workload labels
    return true;
  }

  /**
   * Check if request matches authorization rule
   */
  private matchesAuthorizationRule(rule: any, request: IstioRequest): boolean {
    // Check 'from' conditions
    if (rule.from && rule.from.length > 0) {
      let fromMatched = false;
      for (const from of rule.from) {
        if (from.source) {
          if (from.source.principals && request.sourcePrincipal) {
            if (from.source.principals.includes(request.sourcePrincipal) || 
                from.source.principals.includes('*')) {
              fromMatched = true;
              break;
            }
          } else {
            fromMatched = true; // No principal requirement
          }
        } else {
          fromMatched = true; // No 'from' restriction
        }
      }
      if (!fromMatched) {
        return false;
      }
    }
    
    // Check 'to' conditions
    if (rule.to && rule.to.length > 0) {
      let toMatched = false;
      for (const to of rule.to) {
        if (to.operation) {
          if (to.operation.methods && !to.operation.methods.includes(request.method)) {
            continue;
          }
          if (to.operation.paths && !to.operation.paths.some(p => request.path.startsWith(p))) {
            continue;
          }
          if (to.operation.hosts && request.host && !to.operation.hosts.includes(request.host)) {
            continue;
          }
          toMatched = true;
          break;
        } else {
          toMatched = true; // No 'to' restriction
        }
      }
      if (!toMatched) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Find matching VirtualService for request
   */
  private findMatchingVirtualService(request: IstioRequest, gatewayName?: string): IstioVirtualService | null {
    const host = request.host || request.authority || '';
    
    for (const vs of this.virtualServices.values()) {
      // Check if host matches
      const hostMatches = vs.hosts.some(h => {
        if (h === '*') return true;
        if (h === host) return true;
        // Wildcard matching
        if (h.startsWith('*.')) {
          const domain = h.substring(2);
          return host.endsWith('.' + domain) || host === domain;
        }
        return false;
      });
      
      if (!hostMatches) continue;
      
      // Check gateway if specified
      if (gatewayName && vs.gateways && vs.gateways.length > 0) {
        if (!vs.gateways.includes(gatewayName)) {
          continue;
        }
      }
      
      return vs;
    }
    
    return null;
  }

  /**
   * Match HTTP route in VirtualService
   */
  private matchHTTPRoute(vs: IstioVirtualService, request: IstioRequest): {
    route?: Array<{ destination: { host: string; subset?: string; port?: { number: number } }; weight?: number }>;
    redirect?: any;
    rewrite?: any;
    timeout?: string;
    retries?: any;
    fault?: any;
  } | null {
    if (!vs.http || vs.http.length === 0) {
      return null;
    }
    
    // Find first matching HTTP route
    for (const httpRoute of vs.http) {
      if (!httpRoute.match || httpRoute.match.length === 0) {
        // No match criteria = always match
        return {
          route: httpRoute.route,
          redirect: httpRoute.redirect,
          rewrite: httpRoute.rewrite,
          timeout: httpRoute.timeout,
          retries: httpRoute.retries,
          fault: httpRoute.fault,
        };
      }
      
      // Check if any match condition is satisfied
      for (const match of httpRoute.match) {
        let matched = true;
        
        // URI matching
        if (match.uri) {
          if (match.uri.exact && request.path !== match.uri.exact) {
            matched = false;
            continue;
          }
          if (match.uri.prefix && !request.path.startsWith(match.uri.prefix)) {
            matched = false;
            continue;
          }
          if (match.uri.regex) {
            const regex = new RegExp(match.uri.regex);
            if (!regex.test(request.path)) {
              matched = false;
              continue;
            }
          }
        }
        
        // Method matching
        if (match.method) {
          if (match.method.exact && request.method !== match.method.exact) {
            matched = false;
            continue;
          }
          if (match.method.regex) {
            const regex = new RegExp(match.method.regex);
            if (!regex.test(request.method)) {
              matched = false;
              continue;
            }
          }
        }
        
        // Header matching
        if (match.headers) {
          for (const [headerName, headerMatch] of Object.entries(match.headers)) {
            const headerValue = request.headers?.[headerName.toLowerCase()];
            if (!headerValue) {
              matched = false;
              break;
            }
            if (headerMatch.exact && headerValue !== headerMatch.exact) {
              matched = false;
              break;
            }
            if (headerMatch.prefix && !headerValue.startsWith(headerMatch.prefix)) {
              matched = false;
              break;
            }
            if (headerMatch.regex) {
              const regex = new RegExp(headerMatch.regex);
              if (!regex.test(headerValue)) {
                matched = false;
                break;
              }
            }
          }
        }
        
        if (matched) {
          return {
            route: httpRoute.route,
            redirect: httpRoute.redirect,
            rewrite: httpRoute.rewrite,
            timeout: httpRoute.timeout,
            retries: httpRoute.retries,
            fault: httpRoute.fault,
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Apply fault injection
   */
  private applyFaultInjection(fault: any, request: IstioRequest): { delay?: any; abort?: any } {
    if (!fault) {
      return {};
    }
    
    const result: { delay?: any; abort?: any } = {};
    
    // Check delay
    if (fault.delay) {
      const percentage = fault.delay.percentage?.value || 0;
      if (Math.random() * 100 < percentage) {
        result.delay = fault.delay;
      }
    }
    
    // Check abort
    if (fault.abort) {
      const percentage = fault.abort.percentage?.value || 0;
      if (Math.random() * 100 < percentage) {
        result.abort = fault.abort;
      }
    }
    
    return result;
  }

  /**
   * Select destination from weighted routes
   */
  private selectDestination(
    routes: Array<{ destination: { host: string; subset?: string; port?: { number: number } }; weight?: number }>,
    request: IstioRequest
  ): { host: string; subset?: string; port?: number } | null {
    if (routes.length === 0) {
      return null;
    }
    
    if (routes.length === 1) {
      return routes[0].destination;
    }
    
    // Weighted selection
    const totalWeight = routes.reduce((sum, r) => sum + (r.weight || 100), 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const route of routes) {
      currentWeight += route.weight || 100;
      if (random <= currentWeight) {
        return route.destination;
      }
    }
    
    // Fallback to first route
    return routes[0].destination;
  }

  /**
   * Find DestinationRule for service
   */
  private findDestinationRule(host: string): IstioDestinationRule | null {
    const normalizedHost = this.normalizeHost(host);
    
    for (const dr of this.destinationRules.values()) {
      if (this.normalizeHost(dr.host) === normalizedHost) {
        return dr;
      }
    }
    
    return null;
  }

  /**
   * Route to service with retry and timeout logic
   */
  private routeToService(
    host: string,
    subset: string | undefined,
    port: number | undefined,
    request: IstioRequest,
    startTime: number,
    retries?: any,
    timeout?: string,
    dr?: IstioDestinationRule | null
  ): {
    virtualService: IstioVirtualService | null;
    destinationRule: IstioDestinationRule | null;
    response: IstioResponse;
    serviceTarget?: string;
    subsetTarget?: string;
    endpointTarget?: string;
  } {
    const serviceKey = `${host}:${subset || 'default'}`;
    
    // Check circuit breaker
    const circuitState = this.circuitBreakerState.get(serviceKey);
    if (circuitState?.isOpen && (!circuitState.openUntil || Date.now() < circuitState.openUntil)) {
      this.circuitBreakerTrips++;
      this.errorCount++;
      return {
        virtualService: null,
        destinationRule: dr || null,
        response: {
          status: 503,
          error: 'Circuit breaker is open',
          latency: Date.now() - startTime,
          circuitBreakerOpen: true,
        },
        serviceTarget: host,
        subsetTarget: subset,
      };
    }
    
    // Get endpoints
    const endpoints = this.serviceEndpoints.get(serviceKey) || [];
    if (endpoints.length === 0) {
      this.errorCount++;
      return {
        virtualService: null,
        destinationRule: dr || null,
        response: {
          status: 503,
          error: 'No endpoints available',
          latency: Date.now() - startTime,
        },
        serviceTarget: host,
        subsetTarget: subset,
      };
    }
    
    // Select endpoint using load balancing
    const trafficPolicy = this.getTrafficPolicy(host, subset, dr);
    
    // Check connection pool limits
    const maxConnections = trafficPolicy?.connectionPool?.tcp?.maxConnections;
    if (maxConnections) {
      const currentConnections = this.connectionPoolCounts.get(serviceKey) || 0;
      if (currentConnections >= maxConnections) {
        this.errorCount++;
        return {
          virtualService: null,
          destinationRule: dr || null,
          response: {
            status: 503,
            error: 'Connection pool exhausted',
            latency: Date.now() - startTime,
          },
          serviceTarget: host,
          subsetTarget: subset,
        };
      }
      // Increment connection count
      this.connectionPoolCounts.set(serviceKey, currentConnections + 1);
    }
    
    const endpoint = this.selectEndpoint(endpoints, serviceKey, request, trafficPolicy);
    
    // Apply timeout (use connectionPool timeout if available)
    const connectTimeout = trafficPolicy?.connectionPool?.tcp?.connectTimeout;
    const timeoutMs = timeout 
      ? this.parseDuration(timeout) 
      : (connectTimeout 
        ? this.parseDuration(connectTimeout) 
        : (this.globalConfig.defaultTimeout 
          ? this.parseDuration(this.globalConfig.defaultTimeout) 
          : 30000));
    
    // Retry logic
    const maxRetries = retries?.attempts || this.globalConfig.defaultRetryAttempts || 0;
    let lastError: IstioResponse | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        this.retryAttempts++;
      }
      
      // Simulate request to endpoint
      const response = this.simulateEndpointRequest(endpoint, request, timeoutMs);
      
      if (response.status >= 200 && response.status < 500) {
        // Success or client error (don't retry)
        this.responseCount++;
        this.totalLatency += response.latency || 0;
        
        // Decrement connection pool count on success
        if (maxConnections) {
          const currentConnections = this.connectionPoolCounts.get(serviceKey) || 0;
          if (currentConnections > 0) {
            this.connectionPoolCounts.set(serviceKey, currentConnections - 1);
          }
        }
        
        // Update circuit breaker (success)
        if (circuitState) {
          circuitState.consecutiveErrors = 0;
          if (circuitState.isOpen && circuitState.halfOpenRequests !== undefined) {
            circuitState.halfOpenRequests++;
            if (circuitState.halfOpenRequests >= 3) {
              circuitState.isOpen = false;
              circuitState.halfOpenRequests = undefined;
            }
          }
        }
        
        return {
          virtualService: null,
          destinationRule: dr || null,
          response: {
            ...response,
            serviceTarget: host,
            subsetTarget: subset,
            endpointTarget: `${endpoint.address}:${endpoint.port}`,
            retryAttempts: attempt,
          },
        };
      }
      
      // Server error - may retry
      if (response.status >= 500) {
        lastError = response;
        
        // Check if should retry
        const retryOn = retries?.retryOn || '5xx,reset,connect-failure';
        if (retryOn.includes('5xx') && response.status >= 500) {
          if (attempt < maxRetries) {
            // Wait before retry (simplified)
            continue;
          }
        }
      }
      
      // Decrement connection pool count on error
      if (maxConnections) {
        const currentConnections = this.connectionPoolCounts.get(serviceKey) || 0;
        if (currentConnections > 0) {
          this.connectionPoolCounts.set(serviceKey, currentConnections - 1);
        }
      }
      
      // Update circuit breaker (error)
      if (circuitState) {
        circuitState.consecutiveErrors++;
        const threshold = dr?.trafficPolicy?.outlierDetection?.consecutiveErrors || 5;
        if (circuitState.consecutiveErrors >= threshold) {
          circuitState.isOpen = true;
          circuitState.openUntil = Date.now() + (this.parseDuration(dr?.trafficPolicy?.outlierDetection?.baseEjectionTime || '30s') || 30000);
          circuitState.halfOpenRequests = 0;
        }
      }
      
      this.errorCount++;
      break;
    }
    
    // All retries failed
    return {
      virtualService: null,
      destinationRule: dr || null,
      response: {
        ...(lastError || {
          status: 500,
          error: 'Request failed after retries',
          latency: Date.now() - startTime,
        }),
        serviceTarget: host,
        subsetTarget: subset,
        endpointTarget: `${endpoint.address}:${endpoint.port}`,
        retryAttempts: maxRetries,
      },
    };
  }

  /**
   * Get traffic policy for service/subset
   */
  private getTrafficPolicy(host: string, subset: string | undefined, dr: IstioDestinationRule | null | undefined): IstioTrafficPolicy | null {
    if (!dr) {
      return null;
    }
    
    // Check subset-specific policy
    if (subset && dr.subsets) {
      const subsetConfig = dr.subsets.find(s => s.name === subset);
      if (subsetConfig?.trafficPolicy) {
        return subsetConfig.trafficPolicy;
      }
    }
    
    // Use default traffic policy
    return dr.trafficPolicy || null;
  }

  /**
   * Select endpoint using load balancing algorithm
   */
  private selectEndpoint(
    endpoints: Array<{ address: string; port: number; weight?: number; healthy?: boolean; labels?: Record<string, string> }>,
    serviceKey: string,
    request: IstioRequest,
    trafficPolicy: IstioTrafficPolicy | null
  ): { address: string; port: number; weight?: number; healthy?: boolean; labels?: Record<string, string> } {
    // Filter healthy endpoints
    const healthyEndpoints = endpoints.filter(ep => ep.healthy !== false);
    if (healthyEndpoints.length === 0) {
      return endpoints[0]; // Fallback to any endpoint
    }
    
    const lbPolicy = trafficPolicy?.loadBalancer?.simple || 'ROUND_ROBIN';
    
    switch (lbPolicy) {
      case 'ROUND_ROBIN': {
        const counter = this.roundRobinCounters.get(serviceKey) || 0;
        const selected = healthyEndpoints[counter % healthyEndpoints.length];
        this.roundRobinCounters.set(serviceKey, counter + 1);
        return selected;
      }
      
      case 'LEAST_CONN': {
        let minConnections = Infinity;
        let selected = healthyEndpoints[0];
        
        const connCounts = this.leastConnCounts.get(serviceKey) || new Map();
        for (const endpoint of healthyEndpoints) {
          const endpointKey = `${endpoint.address}:${endpoint.port}`;
          const connections = connCounts.get(endpointKey) || 0;
          if (connections < minConnections) {
            minConnections = connections;
            selected = endpoint;
          }
        }
        
        const endpointKey = `${selected.address}:${selected.port}`;
        connCounts.set(endpointKey, (connCounts.get(endpointKey) || 0) + 1);
        this.leastConnCounts.set(serviceKey, connCounts);
        
        return selected;
      }
      
      case 'RANDOM': {
        return healthyEndpoints[Math.floor(Math.random() * healthyEndpoints.length)];
      }
      
      case 'PASSTHROUGH':
      default: {
        return healthyEndpoints[0];
      }
    }
  }

  /**
   * Simulate request to endpoint
   */
  private simulateEndpointRequest(
    endpoint: { address: string; port: number; weight?: number; healthy?: boolean },
    request: IstioRequest,
    timeoutMs: number
  ): IstioResponse {
    // Simulate latency (10-100ms base + network delay)
    const baseLatency = 10 + Math.random() * 90;
    const networkLatency = Math.random() * 50;
    const latency = baseLatency + networkLatency;
    
    // Simulate occasional errors (1% error rate)
    const errorRate = 0.01;
    if (Math.random() < errorRate) {
      return {
        status: 500,
        error: 'Internal server error',
        latency: latency,
      };
    }
    
    // Simulate timeout
    if (latency > timeoutMs) {
      this.timeoutErrors++;
      return {
        status: 504,
        error: 'Gateway timeout',
        latency: timeoutMs,
      };
    }
    
    // Success response
    return {
      status: 200,
      latency: latency,
    };
  }

  /**
   * Find service by host
   */
  private findServiceByHost(host: string): IstioService | null {
    const normalizedHost = this.normalizeHost(host);
    return this.services.get(normalizedHost) || null;
  }

  /**
   * Normalize host name (FQDN)
   */
  private normalizeHost(host: string): string {
    // Convert to lowercase and handle FQDN
    return host.toLowerCase().trim();
  }

  /**
   * Parse duration string (e.g., "30s", "1m", "500ms")
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)(ms|s|m|h)$/);
    if (!match) {
      return 0;
    }
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    switch (unit) {
      case 'ms':
        return value;
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      default:
        return 0;
    }
  }

  /**
   * Get statistics
   */
  public getStats(): IstioStats {
    const averageLatency = this.responseCount > 0 ? this.totalLatency / this.responseCount : 0;
    const errorRate = this.requestCount > 0 ? this.errorCount / this.requestCount : 0;
    
    return {
      services: this.services.size,
      virtualServices: this.virtualServices.size,
      destinationRules: this.destinationRules.size,
      gateways: this.gateways.size,
      totalRequests: this.requestCount,
      totalResponses: this.responseCount,
      totalErrors: this.errorCount,
      activeConnections: this.activeConnections,
      totalBytesIn: this.totalBytesIn,
      totalBytesOut: this.totalBytesOut,
      errorRate: errorRate,
      averageLatency: averageLatency,
      mtlsConnections: Array.from(this.mtlsConnections.values()).filter(v => v).length,
      circuitBreakerTrips: this.circuitBreakerTrips,
      retryAttempts: this.retryAttempts,
      timeoutErrors: this.timeoutErrors,
      rateLimitBlocks: this.rateLimitBlocks,
    };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.requestCount = 0;
    this.responseCount = 0;
    this.errorCount = 0;
    this.totalBytesIn = 0;
    this.totalBytesOut = 0;
    this.activeConnections = 0;
    this.totalLatency = 0;
    this.circuitBreakerTrips = 0;
    this.retryAttempts = 0;
    this.timeoutErrors = 0;
    this.rateLimitBlocks = 0;
  }
}


/**
 * Service Mesh Routing Engine
 * Generic service mesh routing engine based on Istio implementation
 * Handles request routing, traffic management, security policies, and observability
 */

import { IstioRoutingEngine, IstioService, IstioVirtualService, IstioDestinationRule, IstioGateway, IstioPeerAuthentication, IstioAuthorizationPolicy, IstioServiceEntry, IstioSidecar, IstioGlobalConfig, IstioRequest, IstioResponse, IstioStats } from './IstioRoutingEngine';

/**
 * Service Mesh Routing Engine
 * Wrapper around IstioRoutingEngine for generic service mesh functionality
 */
export class ServiceMeshRoutingEngine {
  private istioEngine: IstioRoutingEngine;

  constructor() {
    this.istioEngine = new IstioRoutingEngine();
  }

  /**
   * Initialize with service mesh configuration
   */
  public initialize(config: {
    services?: Array<{
      id?: string;
      name: string;
      namespace?: string;
      host?: string;
      ports?: Array<{ number: number; protocol: string; name?: string }>;
      labels?: Record<string, string>;
      requests?: number;
      errors?: number;
      latency?: number;
      pods?: number;
      healthyPods?: number;
    }>;
    virtualServices?: IstioVirtualService[];
    destinationRules?: IstioDestinationRule[];
    gateways?: IstioGateway[];
    peerAuthentications?: IstioPeerAuthentication[];
    authorizationPolicies?: IstioAuthorizationPolicy[];
    serviceEntries?: IstioServiceEntry[];
    sidecars?: IstioSidecar[];
    globalConfig?: {
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
      defaultLoadBalancer?: 'ROUND_ROBIN' | 'LEAST_CONN' | 'RANDOM';
    };
  }) {
    // Convert generic service mesh services to Istio format
    const istioServices: IstioService[] = (config.services || []).map(service => ({
      id: service.id || service.name,
      name: service.name,
      namespace: service.namespace || 'default',
      host: service.host || `${service.name}.${service.namespace || 'default'}.svc.cluster.local`,
      ports: service.ports || [{ number: 80, protocol: 'HTTP' }],
      labels: service.labels || {},
      requests: service.requests || 0,
      errors: service.errors || 0,
      latency: service.latency || 0,
      pods: service.pods || 1,
      healthyPods: service.healthyPods || service.pods || 1,
    }));

    // Initialize Istio engine with converted config
    this.istioEngine.initialize({
      services: istioServices,
      virtualServices: config.virtualServices || [],
      destinationRules: config.destinationRules || [],
      gateways: config.gateways || [],
      peerAuthentications: config.peerAuthentications || [],
      authorizationPolicies: config.authorizationPolicies || [],
      serviceEntries: config.serviceEntries || [],
      sidecars: config.sidecars || [],
      globalConfig: config.globalConfig as IstioGlobalConfig,
    });
  }

  /**
   * Update configuration
   */
  public updateConfig(config: {
    services?: Array<{
      id?: string;
      name: string;
      namespace?: string;
      host?: string;
      ports?: Array<{ number: number; protocol: string; name?: string }>;
      labels?: Record<string, string>;
      requests?: number;
      errors?: number;
      latency?: number;
      pods?: number;
      healthyPods?: number;
    }>;
    virtualServices?: IstioVirtualService[];
    destinationRules?: IstioDestinationRule[];
    gateways?: IstioGateway[];
    peerAuthentications?: IstioPeerAuthentication[];
    authorizationPolicies?: IstioAuthorizationPolicy[];
    serviceEntries?: IstioServiceEntry[];
    sidecars?: IstioSidecar[];
    globalConfig?: {
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
      defaultLoadBalancer?: 'ROUND_ROBIN' | 'LEAST_CONN' | 'RANDOM';
    };
  }) {
    this.initialize(config);
  }

  /**
   * Route a request through service mesh
   */
  public routeRequest(request: IstioRequest): {
    response: IstioResponse;
    virtualService?: IstioVirtualService;
    destinationRule?: IstioDestinationRule;
    serviceTarget?: string;
    subsetTarget?: string;
    endpointTarget?: string;
  } {
    return this.istioEngine.routeRequest(request);
  }

  /**
   * Get statistics
   */
  public getStats(): IstioStats {
    return this.istioEngine.getStats();
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.istioEngine.resetStats();
  }

  /**
   * Get underlying Istio engine (for advanced usage)
   */
  public getIstioEngine(): IstioRoutingEngine {
    return this.istioEngine;
  }
}


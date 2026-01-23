import { ParsedQuery, QueryPlan, SubQuery, ServiceRuntimeState, GraphQLGatewayFederationConfig, GraphQLGatewayVariabilityConfig } from './types';

/**
 * QueryPlanner - Plans query execution across services
 */
export class QueryPlanner {
  private federationConfig?: GraphQLGatewayFederationConfig;
  private variability?: GraphQLGatewayVariabilityConfig;
  
  constructor(federationConfig?: GraphQLGatewayFederationConfig, variability?: GraphQLGatewayVariabilityConfig) {
    this.federationConfig = federationConfig;
    this.variability = variability;
  }
  
  /**
   * Create an execution plan for a parsed query
   */
  public planQuery(
    parsedQuery: ParsedQuery,
    availableServices: ServiceRuntimeState[]
  ): QueryPlan {
    if (availableServices.length === 0) {
      return {
        subqueries: [],
        requiresFederation: false,
        estimatedLatency: 0,
      };
    }
    
    const requiresFederation = this.federationConfig?.enabled ?? false;
    
    // Select services for this query
    const selectedServices = this.selectServices(parsedQuery, availableServices);
    
    // Create subqueries
    const subqueries: SubQuery[] = selectedServices.map(service => ({
      serviceId: service.id,
      serviceName: service.name,
      endpoint: service.endpoint,
      query: parsedQuery.rawQuery,
      fields: parsedQuery.fields,
      estimatedLatency: this.estimateServiceLatency(service, parsedQuery),
    }));
    
    // Calculate total estimated latency
    const estimatedLatency = subqueries.reduce((sum, sq) => sum + sq.estimatedLatency, 0);
    
    // Add federation overhead if needed (контролируемая вариативность)
    const federationOverhead = requiresFederation
      ? this.getFederationOverhead()
      : 0;
    
    return {
      subqueries,
      requiresFederation,
      estimatedLatency: estimatedLatency + federationOverhead,
    };
  }
  
  private selectServices(
    parsedQuery: ParsedQuery,
    availableServices: ServiceRuntimeState[]
  ): ServiceRuntimeState[] {
    // If federation enabled, select multiple services
    if (this.federationConfig?.enabled && this.federationConfig.services?.length) {
      const federatedServices = availableServices.filter(s =>
        this.federationConfig!.services.includes(s.name)
      );
      return federatedServices.length > 0
        ? federatedServices
        : availableServices.slice(0, Math.min(2, availableServices.length));
    }
    
    // Non-federated: select one service deterministically
    const queryHash = this.hashString(parsedQuery.operationName || parsedQuery.rawQuery);
    const idx = Math.abs(queryHash) % availableServices.length;
    return [availableServices[idx]];
  }
  
  private estimateServiceLatency(
    service: ServiceRuntimeState,
    parsedQuery: ParsedQuery
  ): number {
    const base = service.avgLatencyMs;
    const complexityCost = Math.sqrt(parsedQuery.complexity) * 0.8;
    const depthCost = parsedQuery.depth * 1.5;
    // Контролируемый джиттер: если вариативность не задана, используем мягкое значение
    const jitterMultiplier = this.variability?.latencyJitterMultiplier ?? 1;
    const maxJitterMs = 5 * Math.max(jitterMultiplier, 0);
    const jitter = maxJitterMs > 0 ? (maxJitterMs / 2) : 0;
    return base + complexityCost + depthCost + jitter;
  }
  
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }
    return hash;
  }
  
  public updateFederationConfig(config?: GraphQLGatewayFederationConfig): void {
    this.federationConfig = config;
  }

  public updateVariability(variability?: GraphQLGatewayVariabilityConfig): void {
    this.variability = variability;
  }

  private getFederationOverhead(): number {
    const explicit = this.variability?.federationOverheadMs;
    if (typeof explicit === 'number') {
      return explicit;
    }
    // По умолчанию небольшой фиксированный overhead без рандома
    return 5;
  }
}


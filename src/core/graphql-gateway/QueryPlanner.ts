import { ParsedQuery, QueryPlan, SubQuery, ServiceRuntimeState, GraphQLGatewayFederationConfig } from './types';

/**
 * QueryPlanner - Plans query execution across services
 */
export class QueryPlanner {
  private federationConfig?: GraphQLGatewayFederationConfig;
  
  constructor(federationConfig?: GraphQLGatewayFederationConfig) {
    this.federationConfig = federationConfig;
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
    
    // Add federation overhead if needed
    const federationOverhead = requiresFederation ? 3 + Math.random() * 5 : 0;
    
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
    const jitter = Math.random() * 5;
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
}


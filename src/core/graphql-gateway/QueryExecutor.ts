import { QueryPlan, SubQuery, ServiceRuntimeState } from './types';
import { ServiceRegistry } from './ServiceRegistry';

/**
 * QueryExecutor - Executes query plan across services
 */
export class QueryExecutor {
  private serviceRegistry: ServiceRegistry;
  
  constructor(serviceRegistry: ServiceRegistry) {
    this.serviceRegistry = serviceRegistry;
  }
  
  /**
   * Execute a query plan
   */
  public executePlan(plan: QueryPlan): {
    success: boolean;
    totalLatency: number;
    error?: string;
    failedService?: string;
    executedEndpoints?: string[];
  } {
    if (plan.subqueries.length === 0) {
      return {
        success: false,
        totalLatency: 0,
        error: 'No services available',
        executedEndpoints: [],
      };
    }
    
    let totalLatency = 0;
    const executedEndpoints: string[] = [];
    
    // Execute subqueries (simulated parallel execution)
    for (const subquery of plan.subqueries) {
      const service = this.serviceRegistry.getService(subquery.serviceId);
      if (!service) {
        return {
          success: false,
          totalLatency,
          error: `Service ${subquery.serviceId} not found`,
          failedService: subquery.serviceId,
          executedEndpoints,
        };
      }
      
      // Use endpoint from subquery (which comes from service configuration)
      const endpoint = subquery.endpoint || service.endpoint;
      executedEndpoints.push(endpoint);
      
      // Simulate service latency
      // Different endpoints might have different base latency
      const baseLatency = this.getEndpointLatency(endpoint, service.avgLatencyMs);
      const latency = baseLatency + (subquery.estimatedLatency - service.avgLatencyMs);
      totalLatency += latency;
      
      // Simulate error probability
      if (Math.random() < service.errorRate) {
        this.serviceRegistry.recordRequest(service.id, latency, false);
        return {
          success: false,
          totalLatency,
          error: `Upstream error at ${service.name} (${endpoint})`,
          failedService: service.id,
          executedEndpoints,
        };
      }
      
      // Record successful request
      this.serviceRegistry.recordRequest(service.id, latency, true);
    }
    
    return {
      success: true,
      totalLatency,
      executedEndpoints,
    };
  }
  
  /**
   * Get base latency for an endpoint (can vary by endpoint URL)
   */
  private getEndpointLatency(endpoint: string, defaultLatency: number): number {
    // Different endpoints might have different characteristics
    // For now, use default latency, but this could be enhanced
    // to consider endpoint location, protocol, etc.
    if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1')) {
      return defaultLatency * 0.8; // Local endpoints are faster
    }
    if (endpoint.includes('https://')) {
      return defaultLatency * 1.1; // HTTPS has slightly more overhead
    }
    return defaultLatency;
  }
}


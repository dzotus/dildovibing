import { GraphQLGatewayService, ServiceRuntimeState } from './types';

/**
 * ServiceRegistry - Manages GraphQL backend services and their runtime state
 */
export class ServiceRegistry {
  private services: Map<string, ServiceRuntimeState> = new Map();
  
  /**
   * Register or update a service
   */
  public registerService(service: GraphQLGatewayService): void {
    const existing = this.services.get(service.id);
    
    this.services.set(service.id, {
      id: service.id,
      name: service.name,
      endpoint: service.endpoint,
      avgLatencyMs: service.avgLatencyMs ?? 20,
      errorRate: service.errorRate ?? 0.01,
      status: service.status ?? 'connected',
      rollingLatency: existing?.rollingLatency || [],
      rollingErrors: existing?.rollingErrors || [],
    });
  }
  
  /**
   * Remove a service
   */
  public unregisterService(serviceId: string): void {
    this.services.delete(serviceId);
  }
  
  /**
   * Get all connected services
   */
  public getConnectedServices(): ServiceRuntimeState[] {
    return Array.from(this.services.values()).filter(s => s.status === 'connected');
  }
  
  /**
   * Get service by ID
   */
  public getService(serviceId: string): ServiceRuntimeState | undefined {
    return this.services.get(serviceId);
  }
  
  /**
   * Get service by name
   */
  public getServiceByName(name: string): ServiceRuntimeState | undefined {
    return Array.from(this.services.values()).find(s => s.name === name);
  }
  
  /**
   * Update service metrics after a request
   */
  public recordRequest(serviceId: string, latency: number, success: boolean): void {
    const service = this.services.get(serviceId);
    if (!service) return;
    
    service.rollingLatency.push(latency);
    if (service.rollingLatency.length > 50) {
      service.rollingLatency.shift();
    }
    
    if (!success) {
      service.rollingErrors.push(latency);
      if (service.rollingErrors.length > 50) {
        service.rollingErrors.shift();
      }
    }
    
    // Update average latency
    const avgLatency = service.rollingLatency.reduce((sum, l) => sum + l, 0) / service.rollingLatency.length;
    service.avgLatencyMs = avgLatency;
    
    // Update error rate
    const errorRate = service.rollingErrors.length / Math.max(service.rollingLatency.length, 1);
    service.errorRate = errorRate;
  }
  
  /**
   * Initialize from config
   */
  public initialize(services: GraphQLGatewayService[]): void {
    this.services.clear();
    for (const service of services) {
      this.registerService(service);
    }
  }
  
  /**
   * Get all services
   */
  public getAllServices(): ServiceRuntimeState[] {
    return Array.from(this.services.values());
  }
}


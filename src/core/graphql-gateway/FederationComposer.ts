import { GraphQLGatewayFederationConfig, ServiceRuntimeState } from './types';

/**
 * FederationComposer - Handles GraphQL Federation composition
 */
export class FederationComposer {
  private config?: GraphQLGatewayFederationConfig;
  
  constructor(config?: GraphQLGatewayFederationConfig) {
    this.config = config;
  }
  
  /**
   * Check if federation is enabled
   */
  public isEnabled(): boolean {
    return this.config?.enabled ?? false;
  }
  
  /**
   * Get federation version
   */
  public getVersion(): '1' | '2' | undefined {
    return this.config?.version;
  }
  
  /**
   * Get federated service names
   */
  public getFederatedServices(): string[] {
    return this.config?.services || [];
  }
  
  /**
   * Calculate federation overhead for query planning
   */
  public getPlanningOverhead(): number {
    if (!this.isEnabled()) return 0;
    
    // Federation v2 has less overhead than v1
    const baseOverhead = this.config?.version === '2' ? 2 : 4;
    return baseOverhead + Math.random() * 3;
  }
  
  /**
   * Check if service is part of federation
   */
  public isFederatedService(service: ServiceRuntimeState): boolean {
    if (!this.isEnabled()) return false;
    return this.config?.services?.includes(service.name) ?? false;
  }
  
  /**
   * Compose supergraph schema (simplified - just returns config value)
   */
  public getSupergraphSchema(): string | undefined {
    return this.config?.supergraph;
  }
  
  public updateConfig(config?: GraphQLGatewayFederationConfig): void {
    this.config = config;
  }
}


/**
 * Common types for GraphQL Gateway modules
 */

export interface GraphQLGatewayService {
  id: string;
  name: string;
  endpoint: string;
  status?: 'connected' | 'disconnected' | 'error';
  avgLatencyMs?: number;
  errorRate?: number;
}

export interface GraphQLGatewayFederationConfig {
  enabled: boolean;
  services: string[];
  supergraph?: string;
  version?: '1' | '2';
}

export interface GraphQLGatewayConfig {
  services?: GraphQLGatewayService[];
  federation?: GraphQLGatewayFederationConfig;
  cacheTtl?: number;
  persistQueries?: boolean;
  subscriptions?: boolean;
  enableIntrospection?: boolean;
  enableQueryComplexityAnalysis?: boolean;
  enableRateLimiting?: boolean;
  maxQueryDepth?: number;
  maxQueryComplexity?: number;
  endpoint?: string;
}

export interface GraphQLGatewayRequest {
  query: string;
  variables?: Record<string, unknown>;
  headers?: Record<string, string>;
  operationName?: string;
}

export interface GraphQLGatewayResponse {
  status: number;
  latency: number;
  error?: string;
}

export interface ParsedQuery {
  operationName?: string;
  operationType: 'query' | 'mutation' | 'subscription';
  fields: string[];
  depth: number;
  complexity: number;
  rawQuery: string;
}

export interface QueryPlan {
  subqueries: SubQuery[];
  requiresFederation: boolean;
  estimatedLatency: number;
}

export interface SubQuery {
  serviceId: string;
  serviceName: string;
  endpoint: string;
  query: string;
  fields: string[];
  estimatedLatency: number;
}

export interface ServiceRuntimeState {
  id: string;
  name: string;
  endpoint: string;
  avgLatencyMs: number;
  errorRate: number;
  status: 'connected' | 'disconnected' | 'error';
  rollingLatency: number[];
  rollingErrors: number[];
}


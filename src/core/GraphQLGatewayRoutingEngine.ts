/**
 * GraphQL Gateway Routing Engine
 * 
 * Modular architecture with separate components:
 * - QueryParser: Parses GraphQL queries
 * - QueryPlanner: Plans query execution
 * - FederationComposer: Handles federation
 * - ServiceRegistry: Manages backend services
 * - QueryExecutor: Executes queries
 * - CacheManager: Handles caching
 * - RateLimiter: Rate limiting
 * - QueryComplexityAnalyzer: Complexity analysis
 */

import {
  GraphQLGatewayConfig,
  GraphQLGatewayRequest,
  GraphQLGatewayResponse,
} from './graphql-gateway/types';

import { QueryParser } from './graphql-gateway/QueryParser';
import { QueryPlanner } from './graphql-gateway/QueryPlanner';
import { QueryExecutor } from './graphql-gateway/QueryExecutor';
import { ServiceRegistry } from './graphql-gateway/ServiceRegistry';
import { CacheManager } from './graphql-gateway/CacheManager';
import { RateLimiter } from './graphql-gateway/RateLimiter';
import { QueryComplexityAnalyzer } from './graphql-gateway/QueryComplexityAnalyzer';
import { FederationComposer } from './graphql-gateway/FederationComposer';

// Re-export types for backward compatibility
export type {
  GraphQLGatewayService,
  GraphQLGatewayFederationConfig,
  GraphQLGatewayConfig,
  GraphQLGatewayRequest,
  GraphQLGatewayResponse,
} from './graphql-gateway/types';

/**
 * GraphQL Gateway Routing Engine
 * Orchestrates all modules to process GraphQL requests
 */
export class GraphQLGatewayRoutingEngine {
  // Core modules
  private queryParser: QueryParser;
  private queryPlanner: QueryPlanner;
  private queryExecutor: QueryExecutor;
  private serviceRegistry: ServiceRegistry;
  private cacheManager: CacheManager;
  private rateLimiter: RateLimiter;
  private complexityAnalyzer: QueryComplexityAnalyzer;
  private federationComposer: FederationComposer;

  constructor() {
    // Initialize modules
    this.serviceRegistry = new ServiceRegistry();
    this.queryParser = new QueryParser();
    this.queryPlanner = new QueryPlanner();
    this.queryExecutor = new QueryExecutor(this.serviceRegistry);
    this.cacheManager = new CacheManager();
    this.rateLimiter = new RateLimiter();
    this.complexityAnalyzer = new QueryComplexityAnalyzer();
    this.federationComposer = new FederationComposer();
  }

  /**
   * Initialize the gateway with configuration
   */
  public initialize(config: GraphQLGatewayConfig): void {
    // Initialize service registry
    if (config.services) {
      this.serviceRegistry.initialize(config.services);
    }

    // Initialize federation composer
    this.federationComposer.updateConfig(config.federation);
    this.queryPlanner.updateFederationConfig(config.federation);

    // Initialize cache manager
    this.cacheManager.updateConfig(
      config.cacheTtl ?? 0,
      config.persistQueries ?? false
    );

    // Initialize rate limiter
    this.rateLimiter.setEnabled(config.enableRateLimiting ?? false);

    // Initialize complexity analyzer
    this.complexityAnalyzer.updateLimits(
      config.maxQueryDepth ?? 15,
      config.maxQueryComplexity ?? 1000
    );
    this.complexityAnalyzer.setEnabled(config.enableQueryComplexityAnalysis ?? true);
  }

  /**
   * Route a GraphQL request through the gateway
   */
  public routeRequest(request: GraphQLGatewayRequest): GraphQLGatewayResponse {
    const start = Date.now();

    // 1. Basic validation
    if (!request.query || request.query.trim().length === 0) {
      return {
        status: 400,
        latency: Date.now() - start,
        error: 'Empty query',
      };
    }

    // 2. Rate limiting check
    const identifier = this.rateLimiter.getIdentifier(request.headers);
    const rateLimitResult = this.rateLimiter.checkLimit(identifier);
    if (!rateLimitResult.allowed) {
      return {
        status: 429,
        latency: Date.now() - start,
        error: 'Rate limit exceeded',
      };
    }

    // 3. Parse query
    const parsedQuery = this.queryParser.parseQuery(request);

    // 4. Check cache
    const cacheResult = this.cacheManager.getCached(request.query, request.variables);
    if (cacheResult.hit) {
      // Cache hit - return quickly
      return {
        status: 200,
        latency: (Date.now() - start) * (1 - cacheResult.latencyReduction),
      };
    }

    // 5. Validate complexity
    const complexityValidation = this.complexityAnalyzer.validateQuery(parsedQuery);
    if (!complexityValidation.valid) {
      return {
        status: 413,
        latency: Date.now() - start,
        error: complexityValidation.error,
      };
    }

    // 6. Get available services
    const availableServices = this.serviceRegistry.getConnectedServices();
    if (availableServices.length === 0) {
      return {
        status: 503,
        latency: Date.now() - start,
        error: 'No connected services',
      };
    }

    // 7. Plan query execution
    const queryPlan = this.queryPlanner.planQuery(parsedQuery, availableServices);

    // 8. Execute query plan
    const executionResult = this.queryExecutor.executePlan(queryPlan);
    
    if (!executionResult.success) {
      return {
        status: 502,
        latency: executionResult.totalLatency + (Date.now() - start),
        error: executionResult.error,
      };
    }
    
    // Store executed endpoints for metadata (can be accessed via getServiceRegistry)
    // This allows tracking which endpoints were used for the request

    // 9. Store in cache if applicable
    this.cacheManager.setCached(request.query, { success: true }, request.variables);

    // 10. Return success response
    return {
      status: 200,
      latency: executionResult.totalLatency + (Date.now() - start),
    };
  }

  /**
   * Get service registry (for external access)
   */
  public getServiceRegistry(): ServiceRegistry {
    return this.serviceRegistry;
  }

  /**
   * Get cache manager (for external access)
   */
  public getCacheManager(): CacheManager {
    return this.cacheManager;
  }

  /**
   * Get rate limiter (for external access)
   */
  public getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }
}


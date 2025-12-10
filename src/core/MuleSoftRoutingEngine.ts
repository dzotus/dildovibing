/**
 * MuleSoft Anypoint Runtime Routing Engine
 * Handles Mule applications, connectors, and data transformation
 */

export interface MuleApplication {
  name: string;
  runtimeVersion: string;
  workerCount: number;
  status: 'running' | 'stopped' | 'deploying';
  connectors?: string[]; // Connector names used by this application
  errorStrategy?: 'continue' | 'rollback' | 'propagate';
  reconnectionStrategy?: 'exponential' | 'linear' | 'none';
  auditLogging?: boolean;
  flows?: MuleFlow[];
}

export interface MuleFlow {
  id: string;
  name: string;
  source?: string; // Source connector or endpoint
  processors?: MuleProcessor[];
  target?: string; // Target connector or endpoint
}

export interface MuleProcessor {
  type: 'transform' | 'validate' | 'filter' | 'enrich' | 'route';
  config?: Record<string, any>;
}

export interface MuleConnector {
  name: string;
  type: 'database' | 'api' | 'file' | 'messaging' | 'custom';
  enabled: boolean;
  config?: Record<string, any>;
  targetComponentType?: string; // Type of component this connector connects to
  targetComponentId?: string; // ID of component this connector connects to
}

export interface MuleRequest {
  path?: string;
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  format?: 'json' | 'xml' | 'binary' | 'text';
  sourceComponentType?: string; // Type of source component
  sourceComponentId?: string; // ID of source component
  targetComponentType?: string; // Type of target component
  targetComponentId?: string; // ID of target component
}

export interface MuleResponse {
  status: 'success' | 'error' | 'transformed';
  data?: unknown;
  format?: 'json' | 'xml' | 'binary' | 'text';
  latency?: number;
  error?: string;
  application?: string; // Application that processed the request
  flow?: string; // Flow that processed the request
  connector?: string; // Connector used
}

export interface ApplicationMatch {
  application: MuleApplication;
  flow?: MuleFlow;
  matchedConnector?: MuleConnector;
}

/**
 * MuleSoft Routing Engine
 * Simulates MuleSoft Anypoint Runtime behavior
 */
export class MuleSoftRoutingEngine {
  private applications: Map<string, MuleApplication> = new Map();
  private connectors: Map<string, MuleConnector> = new Map();
  private organization?: string;
  private environment?: string;
  
  // Application metrics
  private applicationMetrics: Map<string, {
    requestCount: number;
    errorCount: number;
    totalLatency: number;
    lastRequestTime: number;
  }> = new Map();
  
  // Connector metrics
  private connectorMetrics: Map<string, {
    requestCount: number;
    errorCount: number;
    totalLatency: number;
    lastRequestTime: number;
  }> = new Map();
  
  // Reconnection state for connectors
  private reconnectionState: Map<string, {
    attempts: number;
    lastAttempt: number;
    nextAttempt: number;
  }> = new Map();

  /**
   * Initialize with MuleSoft configuration
   */
  public initialize(config: {
    organization?: string;
    environment?: string;
    applications?: MuleApplication[];
    connectors?: MuleConnector[];
  }) {
    // Clear previous state
    this.applications.clear();
    this.connectors.clear();
    this.applicationMetrics.clear();
    this.connectorMetrics.clear();
    this.reconnectionState.clear();

    this.organization = config.organization || 'archiphoenix-org';
    this.environment = config.environment || 'production';

    // Initialize applications
    if (config.applications) {
      for (const app of config.applications) {
        this.applications.set(app.name, { ...app });
        
        // Initialize metrics
        this.applicationMetrics.set(app.name, {
          requestCount: 0,
          errorCount: 0,
          totalLatency: 0,
          lastRequestTime: 0,
        });
      }
    }

    // Initialize connectors
    if (config.connectors) {
      for (const connector of config.connectors) {
        this.connectors.set(connector.name, { ...connector });
        
        // Initialize metrics
        this.connectorMetrics.set(connector.name, {
          requestCount: 0,
          errorCount: 0,
          totalLatency: 0,
          lastRequestTime: 0,
        });
        
        // Initialize reconnection state
        this.reconnectionState.set(connector.name, {
          attempts: 0,
          lastAttempt: 0,
          nextAttempt: 0,
        });
      }
    }
  }

  /**
   * Process data through MuleSoft
   */
  public processData(request: MuleRequest): {
    match: ApplicationMatch | null;
    response: MuleResponse;
  } {
    const startTime = Date.now();
    
    // Step 1: Find matching application and flow
    const match = this.matchApplication(request);
    if (!match) {
      return {
        match: null,
        response: {
          status: 'error',
          error: 'No Mule application matched for request',
          latency: Date.now() - startTime,
        },
      };
    }

    // Step 2: Check if application is running
    if (match.application.status !== 'running') {
      this.updateApplicationMetrics(match.application.name, false, Date.now() - startTime);
      return {
        match,
        response: {
          status: 'error',
          error: `Application '${match.application.name}' is not running (status: ${match.application.status})`,
          latency: Date.now() - startTime,
        },
      };
    }

    // Step 3: Process through flow
    let processingLatency = 0;
    let processingError: string | undefined;
    
    try {
      processingLatency = this.processFlow(match, request);
    } catch (error) {
      processingError = error instanceof Error ? error.message : 'Unknown error';
    }

    // Step 4: Handle errors based on error strategy
    if (processingError) {
      const errorHandled = this.handleError(match.application, processingError);
      if (!errorHandled) {
        this.updateApplicationMetrics(match.application.name, true, Date.now() - startTime);
        return {
          match,
          response: {
            status: 'error',
            error: processingError,
            latency: Date.now() - startTime,
            application: match.application.name,
            flow: match.flow?.name,
          },
        };
      }
    }

    // Step 5: Transform data if needed
    const transformedData = this.transformData(request, match);
    
    // Step 6: Update metrics
    this.updateApplicationMetrics(match.application.name, false, Date.now() - startTime);
    if (match.matchedConnector) {
      this.updateConnectorMetrics(match.matchedConnector.name, false, Date.now() - startTime);
    }

    return {
      match,
      response: {
        status: 'success',
        data: transformedData.data,
        format: transformedData.format || request.format,
        latency: Date.now() - startTime,
        application: match.application.name,
        flow: match.flow?.name,
        connector: match.matchedConnector?.name,
      },
    };
  }

  /**
   * Match application and flow for request
   */
  private matchApplication(request: MuleRequest): ApplicationMatch | null {
    // Find application that can handle this request
    // Priority: 1) Application with matching connector, 2) First running application
    
    // Try to find application with matching connector
    if (request.sourceComponentType || request.targetComponentType) {
      for (const [appName, app] of this.applications.entries()) {
        if (app.status !== 'running') continue;
        
        // Check if application has connector matching source/target
        const matchingConnector = this.findMatchingConnector(
          app,
          request.sourceComponentType,
          request.targetComponentType
        );
        
        if (matchingConnector) {
          // Find flow that uses this connector
          const flow = app.flows?.find(f => 
            f.source === matchingConnector.name || 
            f.target === matchingConnector.name
          ) || app.flows?.[0];
          
          return {
            application: app,
            flow,
            matchedConnector: matchingConnector,
          };
        }
      }
    }
    
    // Fallback: find first running application
    for (const [appName, app] of this.applications.entries()) {
      if (app.status === 'running') {
        return {
          application: app,
          flow: app.flows?.[0],
        };
      }
    }
    
    return null;
  }

  /**
   * Find connector matching source/target component types
   */
  private findMatchingConnector(
    application: MuleApplication,
    sourceType?: string,
    targetType?: string
  ): MuleConnector | null {
    // Check connectors used by application
    const connectorNames = application.connectors || [];
    
    for (const connectorName of connectorNames) {
      const connector = this.connectors.get(connectorName);
      if (!connector || !connector.enabled) continue;
      
      // Match by component type
      if (sourceType && this.connectorMatchesComponentType(connector, sourceType)) {
        return connector;
      }
      if (targetType && this.connectorMatchesComponentType(connector, targetType)) {
        return connector;
      }
    }
    
    return null;
  }

  /**
   * Check if connector matches component type
   */
  private connectorMatchesComponentType(connector: MuleConnector, componentType: string): boolean {
    // Map component types to connector types
    const typeMapping: Record<string, string[]> = {
      'database': ['postgres', 'mongodb', 'redis', 'cassandra', 'clickhouse', 'snowflake', 'elasticsearch'],
      'api': ['rest', 'grpc', 'graphql', 'soap', 'websocket', 'webhook'],
      'messaging': ['kafka', 'rabbitmq', 'activemq', 'aws-sqs', 'azure-service-bus', 'gcp-pubsub'],
      'file': ['s3-datalake'],
      'business': ['crm', 'erp', 'payment-gateway'],
    };
    
    // Check if component type matches connector type
    for (const [connectorType, componentTypes] of Object.entries(typeMapping)) {
      if (connector.type === connectorType && componentTypes.includes(componentType)) {
        return true;
      }
    }
    
    // Check direct match
    if (connector.targetComponentType === componentType) {
      return true;
    }
    
    return false;
  }

  /**
   * Process data through flow
   */
  private processFlow(match: ApplicationMatch, request: MuleRequest): number {
    if (!match.flow) {
      // No flow, just pass through with base processing time
      return this.calculateBaseProcessingTime(match.application);
    }
    
    let totalLatency = this.calculateBaseProcessingTime(match.application);
    
    // Process through flow processors
    if (match.flow.processors) {
      for (const processor of match.flow.processors) {
        totalLatency += this.processProcessor(processor, request);
      }
    }
    
    // Add connector latency
    if (match.matchedConnector) {
      totalLatency += this.calculateConnectorLatency(match.matchedConnector);
    }
    
    return totalLatency;
  }

  /**
   * Calculate base processing time based on application configuration
   */
  private calculateBaseProcessingTime(application: MuleApplication): number {
    // Base latency: 5-15ms for Mule Runtime
    const baseLatency = 5 + Math.random() * 10;
    
    // Worker count affects throughput but not individual request latency
    // More workers = better parallel processing, but each request still takes similar time
    
    // Runtime version can affect performance (newer = slightly faster)
    const versionFactor = parseFloat(application.runtimeVersion) >= 4.5 ? 0.9 : 1.0;
    
    return baseLatency * versionFactor;
  }

  /**
   * Process a single processor
   */
  private processProcessor(processor: MuleProcessor, request: MuleRequest): number {
    switch (processor.type) {
      case 'transform':
        // Data transformation: 2-8ms
        return 2 + Math.random() * 6;
      case 'validate':
        // Validation: 1-3ms
        return 1 + Math.random() * 2;
      case 'filter':
        // Filtering: 0.5-2ms
        return 0.5 + Math.random() * 1.5;
      case 'enrich':
        // Enrichment: 3-10ms (may involve external calls)
        return 3 + Math.random() * 7;
      case 'route':
        // Routing: 0.5-1ms
        return 0.5 + Math.random() * 0.5;
      default:
        return 1;
    }
  }

  /**
   * Calculate connector latency based on type
   */
  private calculateConnectorLatency(connector: MuleConnector): number {
    // Base latency varies by connector type
    const baseLatencies: Record<string, number> = {
      'database': 10, // Database queries: 10-30ms
      'api': 20, // API calls: 20-50ms
      'messaging': 5, // Messaging: 5-15ms
      'file': 50, // File operations: 50-200ms
      'custom': 15, // Custom: 15-40ms
    };
    
    const base = baseLatencies[connector.type] || 15;
    const jitter = base * 0.5 * Math.random();
    
    return base + jitter;
  }

  /**
   * Transform data format
   */
  private transformData(request: MuleRequest, match: ApplicationMatch): {
    data: unknown;
    format?: 'json' | 'xml' | 'binary' | 'text';
  } {
    // If target component type is specified, transform to compatible format
    if (request.targetComponentType) {
      const targetFormat = this.getTargetFormat(request.targetComponentType);
      if (targetFormat && targetFormat !== request.format) {
        // Simulate transformation (in real MuleSoft, this would use DataWeave)
        return {
          data: request.body,
          format: targetFormat,
        };
      }
    }
    
    return {
      data: request.body,
      format: request.format,
    };
  }

  /**
   * Get target format for component type
   */
  private getTargetFormat(componentType: string): 'json' | 'xml' | 'binary' | 'text' | undefined {
    const formatMapping: Record<string, 'json' | 'xml' | 'binary' | 'text'> = {
      'postgres': 'json',
      'mongodb': 'json',
      'redis': 'json',
      'rest': 'json',
      'graphql': 'json',
      'soap': 'xml',
      'grpc': 'binary',
      'kafka': 'json',
      'rabbitmq': 'json',
    };
    
    return formatMapping[componentType];
  }

  /**
   * Handle errors based on error strategy
   */
  private handleError(application: MuleApplication, error: string): boolean {
    const strategy = application.errorStrategy || 'continue';
    
    switch (strategy) {
      case 'continue':
        // Continue processing, log error
        return true;
      case 'rollback':
        // Rollback transaction (simplified: just return error)
        return false;
      case 'propagate':
        // Propagate error to caller
        return false;
      default:
        return false;
    }
  }

  /**
   * Update application metrics
   */
  private updateApplicationMetrics(appName: string, isError: boolean, latency: number) {
    const metrics = this.applicationMetrics.get(appName);
    if (!metrics) return;
    
    metrics.requestCount++;
    if (isError) {
      metrics.errorCount++;
    }
    metrics.totalLatency += latency;
    metrics.lastRequestTime = Date.now();
  }

  /**
   * Update connector metrics
   */
  private updateConnectorMetrics(connectorName: string, isError: boolean, latency: number) {
    const metrics = this.connectorMetrics.get(connectorName);
    if (!metrics) return;
    
    metrics.requestCount++;
    if (isError) {
      metrics.errorCount++;
    }
    metrics.totalLatency += latency;
    metrics.lastRequestTime = Date.now();
  }

  /**
   * Get statistics
   */
  public getStats(): {
    applications: number;
    runningApplications: number;
    connectors: number;
    enabledConnectors: number;
    totalRequests: number;
    totalErrors: number;
    avgLatency: number;
  } {
    let totalRequests = 0;
    let totalErrors = 0;
    let totalLatency = 0;
    
    for (const metrics of this.applicationMetrics.values()) {
      totalRequests += metrics.requestCount;
      totalErrors += metrics.errorCount;
      totalLatency += metrics.totalLatency;
    }
    
    const runningApps = Array.from(this.applications.values())
      .filter(app => app.status === 'running').length;
    
    const enabledConnectors = Array.from(this.connectors.values())
      .filter(conn => conn.enabled).length;
    
    return {
      applications: this.applications.size,
      runningApplications: runningApps,
      connectors: this.connectors.size,
      enabledConnectors,
      totalRequests,
      totalErrors,
      avgLatency: totalRequests > 0 ? totalLatency / totalRequests : 0,
    };
  }

  /**
   * Get application metrics
   */
  public getApplicationMetrics(appName: string): {
    requestCount: number;
    errorCount: number;
    avgLatency: number;
  } | null {
    const metrics = this.applicationMetrics.get(appName);
    if (!metrics) return null;
    
    return {
      requestCount: metrics.requestCount,
      errorCount: metrics.errorCount,
      avgLatency: metrics.requestCount > 0 
        ? metrics.totalLatency / metrics.requestCount 
        : 0,
    };
  }

  /**
   * Get connector metrics
   */
  public getConnectorMetrics(connectorName: string): {
    requestCount: number;
    errorCount: number;
    avgLatency: number;
  } | null {
    const metrics = this.connectorMetrics.get(connectorName);
    if (!metrics) return null;
    
    return {
      requestCount: metrics.requestCount,
      errorCount: metrics.errorCount,
      avgLatency: metrics.requestCount > 0 
        ? metrics.totalLatency / metrics.requestCount 
        : 0,
    };
  }
}


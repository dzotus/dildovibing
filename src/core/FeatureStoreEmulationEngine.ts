import { CanvasNode } from '@/types';

/**
 * Feature Store Type
 */
export type FeatureStoreType = 'feast' | 'tecton' | 'hopsworks';

/**
 * Online Store Type
 */
export type OnlineStoreType = 'redis' | 'dynamodb' | 'cassandra';

/**
 * Offline Store Type
 */
export type OfflineStoreType = 'snowflake' | 'bigquery' | 'redshift';

/**
 * Feature Type
 */
export type FeatureType = 'numerical' | 'categorical' | 'embedding' | 'timestamp';

/**
 * Feature Status
 */
export type FeatureStatus = 'active' | 'deprecated' | 'archived';

/**
 * Feature Transformation Type
 */
export type TransformationType = 'normalization' | 'standardization' | 'min-max' | 'one-hot' | 'label-encoding' | 'aggregation' | 'custom';

/**
 * Feature Transformation
 */
export interface FeatureTransformation {
  type: TransformationType;
  params?: Record<string, any>;
  // For normalization/standardization
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
  // For encoding
  categories?: string[];
  // For aggregation
  aggregationType?: 'sum' | 'avg' | 'max' | 'min' | 'count';
  window?: number; // Time window in seconds
  // Custom transformation function name
  customFunction?: string;
}

/**
 * Feature Serving Request
 */
export interface FeatureRequest {
  id: string;
  featureNames: string[];
  entityIds?: string[];
  pointInTime?: number;
  requestType: 'online' | 'offline';
  timestamp: number;
  latency?: number;
  status?: 'success' | 'error' | 'timeout';
  error?: string;
  cacheHit?: boolean;
}

/**
 * Feature Store Feature
 */
export interface FeatureStoreFeature {
  name: string;
  version: string;
  type: FeatureType;
  description?: string;
  dataType: string;
  defaultValue?: any;
  tags?: string[];
  status: FeatureStatus;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
  lastUsed?: number;
  // Validation rules
  validationRules?: {
    min?: number;
    max?: number;
    allowedValues?: any[];
    required?: boolean;
  };
  // Statistics
  statistics?: {
    mean?: number;
    std?: number;
    min?: number;
    max?: number;
    nullCount?: number;
    distinctCount?: number;
  };
  // Transformations
  transformations?: FeatureTransformation[];
}

/**
 * Feature Set
 */
export interface FeatureStoreFeatureSet {
  name: string;
  version: string;
  features: string[]; // Feature names
  description?: string;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
  lastUsed?: number;
}

/**
 * Feature Store Configuration
 */
export interface FeatureStoreConfig {
  enabled?: boolean;
  featureStoreType?: FeatureStoreType;
  enableOnlineServing?: boolean;
  onlineStoreType?: OnlineStoreType;
  onlineStoreUrl?: string;
  enableOfflineServing?: boolean;
  offlineStoreType?: OfflineStoreType;
  offlineStoreUrl?: string;
  enableFeatureValidation?: boolean;
  enableFeatureMonitoring?: boolean;
  ttlDays?: number;
  // Features and Feature Sets
  features?: Array<{
    name: string;
    version: string;
    type: FeatureType;
    description?: string;
    dataType: string;
    defaultValue?: any;
    tags?: string[];
  }>;
  featureSets?: Array<{
    name: string;
    version: string;
    features: string[];
    description?: string;
  }>;
  // Cache settings
  enableCaching?: boolean;
  cacheSize?: number; // MB
  cacheTtl?: number; // seconds
  // Performance
  maxConcurrentRequests?: number;
  requestTimeout?: number; // ms
  // Monitoring
  enableDriftDetection?: boolean;
  driftThreshold?: number;
  // Transformations
  enableTransformations?: boolean;
}

/**
 * Feature Store Engine Metrics
 */
export interface FeatureStoreEngineMetrics {
  // Features
  totalFeatures: number;
  activeFeatures: number;
  deprecatedFeatures: number;
  totalFeatureSets: number;
  // Requests
  requestsTotal: number;
  requestsOnline: number;
  requestsOffline: number;
  requestsSuccess: number;
  requestsErrors: number;
  requestsTimeout: number;
  // Performance
  averageLatency: number;
  p50Latency: number;
  p99Latency: number;
  requestsPerSecond: number;
  throughput: number; // requests per second
  errorRate: number;
  // Cache
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number; // 0-1
  // Storage
  onlineStoreUtilization: number; // 0-1
  offlineStoreUtilization: number; // 0-1
  // Validation
  validationPassed: number;
  validationFailed: number;
  // Monitoring
  driftDetections: number;
  missingValueDetections: number;
  outlierDetections: number;
  // Feature usage
  totalFeatureUsage: number;
  topFeatures: Array<{ name: string; usage: number }>;
  // Alerts
  activeAlerts: number;
}

/**
 * Feature Store Emulation Engine
 * Симулирует работу Feature Store: online/offline serving, кэширование, валидация, мониторинг
 */
export class FeatureStoreEmulationEngine {
  private config: FeatureStoreConfig | null = null;
  
  // Features and Feature Sets
  private features: Map<string, FeatureStoreFeature> = new Map(); // key: "name:version"
  private featureSets: Map<string, FeatureStoreFeatureSet> = new Map(); // key: "name:version"
  
  // Request history
  private requests: Map<string, FeatureRequest> = new Map();
  private readonly MAX_REQUEST_HISTORY = 10000;
  
  // Cache simulation (in-memory cache)
  private cache: Map<string, {
    data: any;
    timestamp: number;
    ttl: number;
  }> = new Map();
  
  // Online store: entityId -> featureName -> { value, timestamp }
  private onlineStore: Map<string, Map<string, {
    value: any;
    timestamp: number;
  }>> = new Map();
  
  // Offline store: featureName -> entityId -> Array<{ value, timestamp }>
  // For point-in-time correctness - stores historical values
  private offlineStore: Map<string, Map<string, Array<{
    value: any;
    timestamp: number;
  }>>> = new Map();
  
  // Metrics
  private metrics: FeatureStoreEngineMetrics = {
    totalFeatures: 0,
    activeFeatures: 0,
    deprecatedFeatures: 0,
    totalFeatureSets: 0,
    requestsTotal: 0,
    requestsOnline: 0,
    requestsOffline: 0,
    requestsSuccess: 0,
    requestsErrors: 0,
    requestsTimeout: 0,
    averageLatency: 0,
    p50Latency: 0,
    p99Latency: 0,
    requestsPerSecond: 0,
    throughput: 0,
    errorRate: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheHitRate: 0,
    onlineStoreUtilization: 0,
    offlineStoreUtilization: 0,
    validationPassed: 0,
    validationFailed: 0,
    driftDetections: 0,
    missingValueDetections: 0,
    outlierDetections: 0,
    totalFeatureUsage: 0,
    topFeatures: [],
    activeAlerts: 0,
  };
  
  // Latency history for percentile calculations
  private latencyHistory: number[] = [];
  private readonly MAX_LATENCY_HISTORY = 1000;
  
  // Request tracking for RPS calculation
  private requestTimestamps: number[] = [];
  private readonly MAX_REQUEST_TIMESTAMPS = 1000;
  private lastSecondStart: number = Date.now();
  private requestsThisSecond: number = 0;
  
  // Last update time
  private lastUpdateTime: number = Date.now();
  
  // Pending requests from DataFlowEngine
  private pendingRequests: Array<{
    id: string;
    featureNames: string[];
    entityIds?: string[];
    requestType: 'online' | 'offline';
    timestamp: number;
    resolve: (result: any) => void;
    reject: (error: Error) => void;
  }> = [];
  
  // Metrics history for visualization
  private metricsHistory: Array<{
    timestamp: number;
    latency: number;
    rps: number;
    errorRate: number;
    throughput: number;
    cacheHitRate: number;
  }> = [];
  private readonly MAX_METRICS_HISTORY = 300;
  
  // Feature monitoring: store recent values for drift detection
  private featureValueHistory: Map<string, Array<{
    value: any;
    timestamp: number;
  }>> = new Map();
  private readonly MAX_FEATURE_VALUE_HISTORY = 1000;
  
  // Alerts
  private alerts: Array<{
    id: string;
    type: 'drift' | 'missing' | 'outlier' | 'error';
    severity: 'critical' | 'warning' | 'info';
    featureName?: string;
    message: string;
    timestamp: number;
    resolved?: boolean;
  }> = [];
  private readonly MAX_ALERTS = 1000;
  
  /**
   * Инициализирует конфигурацию Feature Store из конфига компонента
   */
  public initializeConfig(node: CanvasNode): void {
    const config = (node.data.config as any) || {} as FeatureStoreConfig;
    this.config = {
      enabled: config.enabled !== false,
      featureStoreType: config.featureStoreType || 'feast',
      enableOnlineServing: config.enableOnlineServing !== false,
      onlineStoreType: config.onlineStoreType || 'redis',
      onlineStoreUrl: config.onlineStoreUrl || 'redis://localhost:6379',
      enableOfflineServing: config.enableOfflineServing !== false,
      offlineStoreType: config.offlineStoreType || 'snowflake',
      offlineStoreUrl: config.offlineStoreUrl || '',
      enableFeatureValidation: config.enableFeatureValidation !== false,
      enableFeatureMonitoring: config.enableFeatureMonitoring !== false,
      enableTransformations: config.enableTransformations !== false,
      ttlDays: config.ttlDays || 30,
      enableCaching: config.enableCaching !== false,
      cacheSize: config.cacheSize || 100, // MB
      cacheTtl: config.cacheTtl || 3600, // 1 hour
      maxConcurrentRequests: config.maxConcurrentRequests || 100,
      requestTimeout: config.requestTimeout || 30000,
      enableDriftDetection: config.enableDriftDetection || false,
      driftThreshold: config.driftThreshold || 0.1,
      ...config,
    };
    
    // Initialize features from config
    this.initializeFeatures();
    
    // Initialize feature sets from config
    this.initializeFeatureSets();
  }
  
  /**
   * Initialize features from config
   */
  private initializeFeatures(): void {
    if (!this.config) return;
    
    this.features.clear();
    
    if (this.config.features && Array.isArray(this.config.features)) {
      const now = Date.now();
      for (const featureConfig of this.config.features) {
        const key = `${featureConfig.name}:${featureConfig.version}`;
        const feature: FeatureStoreFeature = {
          name: featureConfig.name,
          version: featureConfig.version,
          type: featureConfig.type || 'numerical',
          description: featureConfig.description,
          dataType: featureConfig.dataType || 'float64',
          defaultValue: featureConfig.defaultValue,
          tags: featureConfig.tags || [],
          status: 'active',
          createdAt: now,
          updatedAt: now,
          usageCount: 0,
          transformations: (featureConfig as any).transformations || [],
        };
        this.features.set(key, feature);
      }
    }
  }
  
  /**
   * Initialize feature sets from config
   */
  private initializeFeatureSets(): void {
    if (!this.config) return;
    
    this.featureSets.clear();
    
    if (this.config.featureSets && Array.isArray(this.config.featureSets)) {
      const now = Date.now();
      for (const setConfig of this.config.featureSets) {
        const key = `${setConfig.name}:${setConfig.version}`;
        const featureSet: FeatureStoreFeatureSet = {
          name: setConfig.name,
          version: setConfig.version,
          features: setConfig.features || [],
          description: setConfig.description,
          createdAt: now,
          updatedAt: now,
          usageCount: 0,
        };
        this.featureSets.set(key, featureSet);
      }
    }
  }
  
  /**
   * Process a feature request (online or offline)
   * Optimized for batch operations when multiple entity IDs are provided
   */
  public processFeatureRequest(
    featureNames: string[],
    entityIds?: string[],
    requestType: 'online' | 'offline' = 'online',
    pointInTime?: number
  ): {
    success: boolean;
    data?: any;
    latency: number;
    error?: string;
    cacheHit?: boolean;
  } {
    if (!this.config || !this.config.enabled) {
      return {
        success: false,
        latency: 0,
        error: 'Feature Store is not enabled',
      };
    }
    
    const startTime = Date.now();
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Check if online/offline serving is enabled
    if (requestType === 'online' && !this.config.enableOnlineServing) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: 'Online serving is not enabled',
      };
    }
    
    if (requestType === 'offline' && !this.config.enableOfflineServing) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: 'Offline serving is not enabled',
      };
    }
    
    // Check cache first (for online requests)
    let cacheHit = false;
    if (requestType === 'online' && this.config.enableCaching) {
      const cacheKey = this.getCacheKey(featureNames, entityIds);
      const cached = this.cache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < cached.ttl * 1000) {
        cacheHit = true;
        this.metrics.cacheHits++;
        const latency = this.getOnlineLatency(true); // Cache hit is faster
        this.updateRequestMetrics(requestId, requestType, true, latency, true);
        return {
          success: true,
          data: cached.data,
          latency,
          cacheHit: true,
        };
      } else {
        this.metrics.cacheMisses++;
      }
    }
    
    // Validate features exist
    const missingFeatures: string[] = [];
    for (const featureName of featureNames) {
      const found = Array.from(this.features.values()).find(
        f => f.name === featureName && f.status === 'active'
      );
      if (!found) {
        missingFeatures.push(featureName);
      }
    }
    
    if (missingFeatures.length > 0) {
      const latency = this.getOnlineLatency(false);
      this.updateRequestMetrics(requestId, requestType, false, latency);
      return {
        success: false,
        latency,
        error: `Features not found: ${missingFeatures.join(', ')}`,
      };
    }
    
    // Simulate feature retrieval latency
    const latency = requestType === 'online' 
      ? this.getOnlineLatency(false)
      : this.getOfflineLatency();
    
    // Simulate errors based on error rate and store type reliability
    // Different store types have different reliability characteristics
    const storeType = requestType === 'online' 
      ? (this.config?.onlineStoreType || 'redis')
      : (this.config?.offlineStoreType || 'snowflake');
    
    // Base error probability depends on store type
    let baseErrorRate = 0.001; // 0.1% base error rate
    if (requestType === 'online') {
      switch (storeType) {
        case 'redis':
          baseErrorRate = 0.0005; // Redis is very reliable
          break;
        case 'dynamodb':
          baseErrorRate = 0.001; // DynamoDB is reliable
          break;
        case 'cassandra':
          baseErrorRate = 0.002; // Cassandra can have consistency issues
          break;
      }
    } else {
      switch (storeType) {
        case 'snowflake':
          baseErrorRate = 0.001; // Snowflake is reliable
          break;
        case 'bigquery':
          baseErrorRate = 0.0008; // BigQuery is very reliable
          break;
        case 'redshift':
          baseErrorRate = 0.002; // Redshift can have issues under load
          break;
      }
    }
    
    const shouldError = Math.random() < (baseErrorRate + this.metrics.errorRate * 0.1);
    if (shouldError) {
      const latency = requestType === 'online' ? this.getOnlineLatency(false) : this.getOfflineLatency();
      this.updateRequestMetrics(requestId, requestType, false, latency);
      return {
        success: false,
        latency,
        error: 'Feature retrieval failed',
      };
    }
    
    // Retrieve feature data from store or generate if not found
    // Optimize for batch operations: process multiple entities efficiently
    const featureData: Record<string, any> = {};
    const queryTimestamp = pointInTime || Date.now();
    
    // For batch operations with multiple entity IDs, optimize retrieval
    if (entityIds && entityIds.length > 1) {
      // Batch processing: retrieve features for all entities at once
      for (const entityId of entityIds) {
        const entityData: Record<string, any> = {};
        for (const featureName of featureNames) {
          const feature = Array.from(this.features.values()).find(f => f.name === featureName);
          if (!feature) continue;
          
          let value: any = null;
          let foundInStore = false;
          
          if (requestType === 'online') {
            const entityFeatures = this.onlineStore.get(entityId);
            if (entityFeatures) {
              const featureEntry = entityFeatures.get(featureName);
              if (featureEntry) {
                value = featureEntry.value;
                foundInStore = true;
              }
            }
          } else {
            // Offline serving with point-in-time correctness
            const featureStore = this.offlineStore.get(featureName);
            if (featureStore) {
              const entityHistory = featureStore.get(entityId);
              if (entityHistory && entityHistory.length > 0) {
                let pointInTimeValue = null;
                for (let i = entityHistory.length - 1; i >= 0; i--) {
                  if (entityHistory[i].timestamp <= queryTimestamp) {
                    pointInTimeValue = entityHistory[i].value;
                    break;
                  }
                }
                if (pointInTimeValue !== null) {
                  value = pointInTimeValue;
                  foundInStore = true;
                }
              }
            }
          }
          
          if (!foundInStore) {
            value = this.generateFeatureValue(feature);
          } else {
            if (this.config.enableTransformations && feature.transformations && feature.transformations.length > 0) {
              value = this.applyTransformations(value, feature);
            }
          }
          
          entityData[featureName] = value;
          
          // Monitor feature values
          if (this.config.enableFeatureMonitoring) {
            this.monitorFeatureValue(featureName, value, feature);
          }
        }
        
        // Store entity data in result (keyed by entity ID)
        featureData[entityId] = entityData;
        
        // Update usage for all features
        for (const featureName of featureNames) {
          const feature = Array.from(this.features.values()).find(f => f.name === featureName);
          if (feature) {
            feature.usageCount++;
            feature.lastUsed = Date.now();
          }
        }
      }
    } else {
      // Single entity or no entity IDs - original logic
      for (const featureName of featureNames) {
        const feature = Array.from(this.features.values()).find(f => f.name === featureName);
        if (!feature) continue;
        
        let value: any = null;
        let foundInStore = false;
        
        if (requestType === 'online') {
          // Try to get from online store
          if (entityIds && entityIds.length > 0) {
            // Try each entity ID
            for (const entityId of entityIds) {
              const entityFeatures = this.onlineStore.get(entityId);
              if (entityFeatures) {
                const featureEntry = entityFeatures.get(featureName);
                if (featureEntry) {
                  value = featureEntry.value;
                  foundInStore = true;
                  break;
                }
              }
            }
          } else {
            // Try default entity
            const defaultEntityFeatures = this.onlineStore.get('__default__');
            if (defaultEntityFeatures) {
              const featureEntry = defaultEntityFeatures.get(featureName);
              if (featureEntry) {
                value = featureEntry.value;
                foundInStore = true;
              }
            }
          }
        } else {
          // Offline serving with point-in-time correctness
          if (entityIds && entityIds.length > 0) {
            for (const entityId of entityIds) {
              const featureStore = this.offlineStore.get(featureName);
              if (featureStore) {
                const entityHistory = featureStore.get(entityId);
                if (entityHistory && entityHistory.length > 0) {
                  // Find the value at the point in time (latest value <= queryTimestamp)
                  let pointInTimeValue = null;
                  for (let i = entityHistory.length - 1; i >= 0; i--) {
                    if (entityHistory[i].timestamp <= queryTimestamp) {
                      pointInTimeValue = entityHistory[i].value;
                      break;
                    }
                  }
                  if (pointInTimeValue !== null) {
                    value = pointInTimeValue;
                    foundInStore = true;
                    break;
                  }
                }
              }
            }
          } else {
            // Try default entity
            const featureStore = this.offlineStore.get(featureName);
            if (featureStore) {
              const defaultHistory = featureStore.get('__default__');
              if (defaultHistory && defaultHistory.length > 0) {
                let pointInTimeValue = null;
                for (let i = defaultHistory.length - 1; i >= 0; i--) {
                  if (defaultHistory[i].timestamp <= queryTimestamp) {
                    pointInTimeValue = defaultHistory[i].value;
                    break;
                  }
                }
                if (pointInTimeValue !== null) {
                  value = pointInTimeValue;
                  foundInStore = true;
                }
              }
            }
          }
        }
        
        // If not found in store, generate sample data
        if (!foundInStore) {
          value = this.generateFeatureValue(feature);
        } else {
          // Apply transformations to stored values if enabled
          if (this.config.enableTransformations && feature.transformations && feature.transformations.length > 0) {
            value = this.applyTransformations(value, feature);
          }
        }
        
        featureData[featureName] = value;
        
        // Update usage
        feature.usageCount++;
        feature.lastUsed = Date.now();
        
        // Monitor feature values for drift, missing values, and outliers
        if (this.config.enableFeatureMonitoring) {
          this.monitorFeatureValue(featureName, value, feature);
        }
      }
    }
    
    // Validate features if enabled
    if (this.config.enableFeatureValidation) {
      const validationResult = this.validateFeatures(featureNames, featureData);
      if (!validationResult.valid) {
        const latency = requestType === 'online' ? this.getOnlineLatency(false) : this.getOfflineLatency();
        this.updateRequestMetrics(requestId, requestType, false, latency);
        return {
          success: false,
          latency,
          error: `Validation failed: ${validationResult.error}`,
        };
      }
    }
    
    // Cache the result (for online requests)
    if (requestType === 'online' && this.config.enableCaching && !cacheHit) {
      const cacheKey = this.getCacheKey(featureNames, entityIds);
      this.cache.set(cacheKey, {
        data: featureData,
        timestamp: Date.now(),
        ttl: this.config.cacheTtl || 3600,
      });
      
      // Limit cache size
      if (this.cache.size > (this.config.cacheSize || 100) * 1024) { // Convert MB to entries (rough estimate)
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
    }
    
    // Update metrics
    this.updateRequestMetrics(requestId, requestType, true, latency, cacheHit);
    
    return {
      success: true,
      data: featureData,
      latency,
      cacheHit: false,
    };
  }
  
  /**
   * Get online serving latency (cache hit is faster)
   */
  private getOnlineLatency(cacheHit: boolean): number {
    if (cacheHit) {
      // Cache hit: 1-5ms
      return 1 + Math.random() * 4;
    }
    
    // Online store latency depends on store type
    const storeType = this.config?.onlineStoreType || 'redis';
    switch (storeType) {
      case 'redis':
        return 5 + Math.random() * 10; // 5-15ms
      case 'dynamodb':
        return 10 + Math.random() * 20; // 10-30ms
      case 'cassandra':
        return 15 + Math.random() * 25; // 15-40ms
      default:
        return 10 + Math.random() * 20;
    }
  }
  
  /**
   * Get offline serving latency (much slower)
   */
  private getOfflineLatency(): number {
    const storeType = this.config?.offlineStoreType || 'snowflake';
    switch (storeType) {
      case 'snowflake':
        return 500 + Math.random() * 1000; // 500-1500ms
      case 'bigquery':
        return 400 + Math.random() * 800; // 400-1200ms
      case 'redshift':
        return 600 + Math.random() * 1200; // 600-1800ms
      default:
        return 500 + Math.random() * 1000;
    }
  }
  
  /**
   * Generate cache key
   */
  private getCacheKey(featureNames: string[], entityIds?: string[]): string {
    const sortedNames = [...featureNames].sort().join(',');
    const sortedIds = entityIds ? [...entityIds].sort().join(',') : '';
    return `features:${sortedNames}:${sortedIds}`;
  }
  
  /**
   * Generate feature value based on type
   */
  private generateFeatureValue(feature: FeatureStoreFeature): any {
    let value: any;
    
    switch (feature.type) {
      case 'numerical':
        if (feature.dataType === 'int' || feature.dataType === 'int64') {
          value = Math.floor(Math.random() * 1000);
        } else {
          value = Math.random() * 100;
        }
        break;
      case 'categorical':
        const categories = ['A', 'B', 'C', 'D', 'E'];
        value = categories[Math.floor(Math.random() * categories.length)];
        break;
      case 'embedding':
        value = Array.from({ length: 128 }, () => Math.random());
        break;
      case 'timestamp':
        value = Date.now();
        break;
      default:
        value = feature.defaultValue || null;
    }
    
    // Apply transformations if enabled and configured
    if (this.config?.enableTransformations && feature.transformations && feature.transformations.length > 0) {
      value = this.applyTransformations(value, feature);
    }
    
    return value;
  }
  
  /**
   * Apply transformations to a feature value
   */
  private applyTransformations(value: any, feature: FeatureStoreFeature): any {
    if (!feature.transformations || feature.transformations.length === 0) {
      return value;
    }
    
    let transformedValue = value;
    
    for (const transformation of feature.transformations) {
      transformedValue = this.applyTransformation(transformedValue, transformation, feature);
    }
    
    return transformedValue;
  }
  
  /**
   * Apply a single transformation
   */
  private applyTransformation(value: any, transformation: FeatureTransformation, feature: FeatureStoreFeature): any {
    if (value === null || value === undefined) {
      return value;
    }
    
    switch (transformation.type) {
      case 'normalization':
      case 'standardization':
        if (typeof value === 'number' && transformation.mean !== undefined && transformation.std !== undefined) {
          if (transformation.type === 'standardization') {
            return (value - transformation.mean) / transformation.std;
          } else {
            // Normalization (z-score)
            return (value - transformation.mean) / transformation.std;
          }
        }
        return value;
        
      case 'min-max':
        if (typeof value === 'number' && transformation.min !== undefined && transformation.max !== undefined) {
          const range = transformation.max - transformation.min;
          if (range > 0) {
            return (value - transformation.min) / range;
          }
        }
        return value;
        
      case 'one-hot':
        if (feature.type === 'categorical' && transformation.categories) {
          const index = transformation.categories.indexOf(String(value));
          if (index >= 0) {
            return transformation.categories.map((_, i) => i === index ? 1 : 0);
          }
        }
        return value;
        
      case 'label-encoding':
        if (feature.type === 'categorical' && transformation.categories) {
          const index = transformation.categories.indexOf(String(value));
          return index >= 0 ? index : -1;
        }
        return value;
        
      case 'aggregation':
        // Aggregation is typically applied to time series data
        // For now, return the value as-is (would need historical data for proper aggregation)
        return value;
        
      case 'custom':
        // Custom transformations would be handled by external functions
        // For simulation, just return the value
        return value;
        
      default:
        return value;
    }
  }
  
  /**
   * Validate features
   */
  private validateFeatures(featureNames: string[], featureData: Record<string, any>): {
    valid: boolean;
    error?: string;
  } {
    for (const featureName of featureNames) {
      const feature = Array.from(this.features.values()).find(f => f.name === featureName);
      if (!feature) continue;
      
      const value = featureData[featureName];
      const rules = feature.validationRules;
      
      if (!rules) continue;
      
      // Check required
      if (rules.required && (value === null || value === undefined)) {
        return {
          valid: false,
          error: `Feature ${featureName} is required but missing`,
        };
      }
      
      // Check min/max for numerical
      if (feature.type === 'numerical' && typeof value === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          return {
            valid: false,
            error: `Feature ${featureName} value ${value} is below minimum ${rules.min}`,
          };
        }
        if (rules.max !== undefined && value > rules.max) {
          return {
            valid: false,
            error: `Feature ${featureName} value ${value} is above maximum ${rules.max}`,
          };
        }
      }
      
      // Check allowed values
      if (rules.allowedValues && !rules.allowedValues.includes(value)) {
        return {
          valid: false,
          error: `Feature ${featureName} value ${value} is not in allowed values`,
        };
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Update request metrics
   */
  private updateRequestMetrics(
    requestId: string,
    requestType: 'online' | 'offline',
    success: boolean,
    latency: number,
    cacheHit?: boolean
  ): void {
    this.metrics.requestsTotal++;
    if (requestType === 'online') {
      this.metrics.requestsOnline++;
    } else {
      this.metrics.requestsOffline++;
    }
    
    if (success) {
      this.metrics.requestsSuccess++;
    } else {
      this.metrics.requestsErrors++;
    }
    
    // Update latency history
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > this.MAX_LATENCY_HISTORY) {
      this.latencyHistory.shift();
    }
    
    // Update request timestamps for RPS
    const now = Date.now();
    this.requestTimestamps.push(now);
    if (this.requestTimestamps.length > this.MAX_REQUEST_TIMESTAMPS) {
      this.requestTimestamps.shift();
    }
    
    // Store request
    const request: FeatureRequest = {
      id: requestId,
      featureNames: [],
      requestType,
      timestamp: now,
      latency,
      status: success ? 'success' : 'error',
      cacheHit,
    };
    this.requests.set(requestId, request);
    if (this.requests.size > this.MAX_REQUEST_HISTORY) {
      const firstKey = this.requests.keys().next().value;
      this.requests.delete(firstKey);
    }
    
    // Update validation metrics
    if (this.config?.enableFeatureValidation) {
      if (success) {
        this.metrics.validationPassed++;
      } else {
        this.metrics.validationFailed++;
      }
    }
  }
  
  /**
   * Update metrics
   */
  public updateMetrics(): void {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000; // seconds
    
    // Update feature metrics
    const allFeatures = Array.from(this.features.values());
    this.metrics.totalFeatures = allFeatures.length;
    this.metrics.activeFeatures = allFeatures.filter(f => f.status === 'active').length;
    this.metrics.deprecatedFeatures = allFeatures.filter(f => f.status === 'deprecated').length;
    this.metrics.totalFeatureSets = this.featureSets.size;
    
    // Calculate average latency
    if (this.latencyHistory.length > 0) {
      const sorted = [...this.latencyHistory].sort((a, b) => a - b);
      this.metrics.averageLatency = sorted.reduce((sum, val) => sum + val, 0) / sorted.length;
      this.metrics.p50Latency = this.calculatePercentile(sorted, 50);
      this.metrics.p99Latency = this.calculatePercentile(sorted, 99);
    }
    
    // Calculate RPS
    const currentSecond = Math.floor(now / 1000);
    const lastSecond = Math.floor(this.lastSecondStart / 1000);
    
    if (currentSecond > lastSecond) {
      // New second, calculate RPS from previous second
      const requestsInLastSecond = this.requestTimestamps.filter(
        ts => ts >= this.lastSecondStart && ts < currentSecond * 1000
      ).length;
      this.metrics.requestsPerSecond = requestsInLastSecond;
      this.metrics.throughput = requestsInLastSecond;
      this.lastSecondStart = currentSecond * 1000;
    }
    
    // Calculate error rate
    if (this.metrics.requestsTotal > 0) {
      this.metrics.errorRate = this.metrics.requestsErrors / this.metrics.requestsTotal;
    }
    
    // Calculate cache hit rate
    const totalCacheRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    if (totalCacheRequests > 0) {
      this.metrics.cacheHitRate = this.metrics.cacheHits / totalCacheRequests;
    }
    
    // Calculate storage utilization (simulated) - depends on store type
    const onlineStoreType = this.config?.onlineStoreType || 'redis';
    const offlineStoreType = this.config?.offlineStoreType || 'snowflake';
    
    // Different store types have different capacity characteristics
    let onlineCapacity = 100; // default max concurrent requests
    switch (onlineStoreType) {
      case 'redis':
        onlineCapacity = 1000; // Redis can handle high throughput
        break;
      case 'dynamodb':
        onlineCapacity = 500; // DynamoDB has good scalability
        break;
      case 'cassandra':
        onlineCapacity = 300; // Cassandra is distributed but slower
        break;
    }
    
    let offlineCapacity = 10; // default for offline
    switch (offlineStoreType) {
      case 'snowflake':
        offlineCapacity = 20; // Snowflake can handle moderate concurrent queries
        break;
      case 'bigquery':
        offlineCapacity = 15; // BigQuery has good concurrency
        break;
      case 'redshift':
        offlineCapacity = 10; // Redshift is more limited
        break;
    }
    
    this.metrics.onlineStoreUtilization = Math.min(1, this.metrics.requestsOnline / (this.config?.maxConcurrentRequests || onlineCapacity));
    this.metrics.offlineStoreUtilization = Math.min(1, this.metrics.requestsOffline / offlineCapacity);
    
    // Update top features
    const featureUsage = new Map<string, number>();
    for (const feature of allFeatures) {
      featureUsage.set(feature.name, (featureUsage.get(feature.name) || 0) + feature.usageCount);
    }
    this.metrics.topFeatures = Array.from(featureUsage.entries())
      .map(([name, usage]) => ({ name, usage }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 10);
    
    this.metrics.totalFeatureUsage = allFeatures.reduce((sum, f) => sum + f.usageCount, 0);
    
    // Update active alerts count
    this.metrics.activeAlerts = this.alerts.filter(a => !a.resolved).length;
    
    // Update metrics history
    this.metricsHistory.push({
      timestamp: now,
      latency: this.metrics.averageLatency,
      rps: this.metrics.requestsPerSecond,
      errorRate: this.metrics.errorRate,
      throughput: this.metrics.throughput,
      cacheHitRate: this.metrics.cacheHitRate,
    });
    if (this.metricsHistory.length > this.MAX_METRICS_HISTORY) {
      this.metricsHistory.shift();
    }
    
    this.lastUpdateTime = now;
  }
  
  /**
   * Calculate percentile
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }
  
  /**
   * Get metrics
   */
  public getMetrics(): FeatureStoreEngineMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Get features
   */
  public getFeatures(): FeatureStoreFeature[] {
    return Array.from(this.features.values());
  }
  
  /**
   * Get feature sets
   */
  public getFeatureSets(): FeatureStoreFeatureSet[] {
    return Array.from(this.featureSets.values());
  }
  
  /**
   * Get feature by name and version
   */
  public getFeature(name: string, version: string): FeatureStoreFeature | undefined {
    return this.features.get(`${name}:${version}`);
  }
  
  /**
   * Add or update feature
   */
  public addFeature(feature: Omit<FeatureStoreFeature, 'createdAt' | 'updatedAt' | 'usageCount'>): void {
    const key = `${feature.name}:${feature.version}`;
    const existing = this.features.get(key);
    const now = Date.now();
    
    const featureData: FeatureStoreFeature = {
      ...feature,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      usageCount: existing?.usageCount || 0,
      lastUsed: existing?.lastUsed,
    };
    
    this.features.set(key, featureData);
  }
  
  /**
   * Remove feature
   */
  public removeFeature(name: string, version: string): void {
    this.features.delete(`${name}:${version}`);
  }
  
  /**
   * Add or update feature set
   */
  public addFeatureSet(featureSet: Omit<FeatureStoreFeatureSet, 'createdAt' | 'updatedAt' | 'usageCount'>): void {
    const key = `${featureSet.name}:${featureSet.version}`;
    const existing = this.featureSets.get(key);
    const now = Date.now();
    
    const setData: FeatureStoreFeatureSet = {
      ...featureSet,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      usageCount: existing?.usageCount || 0,
      lastUsed: existing?.lastUsed,
    };
    
    this.featureSets.set(key, setData);
  }
  
  /**
   * Remove feature set
   */
  public removeFeatureSet(name: string, version: string): void {
    this.featureSets.delete(`${name}:${version}`);
  }
  
  /**
   * Get metrics history
   */
  public getMetricsHistory(): Array<{
    timestamp: number;
    latency: number;
    rps: number;
    errorRate: number;
    throughput: number;
    cacheHitRate: number;
  }> {
    return [...this.metricsHistory];
  }
  
  /**
   * Get recent requests
   */
  public getRecentRequests(limit: number = 100): FeatureRequest[] {
    return Array.from(this.requests.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
  
  /**
   * Monitor feature value for drift, missing values, and outliers
   */
  private monitorFeatureValue(featureName: string, value: any, feature: FeatureStoreFeature): void {
    if (!this.config?.enableFeatureMonitoring) return;
    
    const now = Date.now();
    const key = `${featureName}:${feature.version}`;
    
    // Store value in history
    if (!this.featureValueHistory.has(key)) {
      this.featureValueHistory.set(key, []);
    }
    const history = this.featureValueHistory.get(key)!;
    history.push({ value, timestamp: now });
    
    // Limit history size
    if (history.length > this.MAX_FEATURE_VALUE_HISTORY) {
      history.shift();
    }
    
    // Check for missing values
    if (value === null || value === undefined) {
      this.metrics.missingValueDetections++;
      this.createAlert('missing', 'warning', featureName, `Feature ${featureName} has missing value`);
      return;
    }
    
    // Check for outliers (for numerical features)
    if (feature.type === 'numerical' && typeof value === 'number' && feature.statistics) {
      const stats = feature.statistics;
      if (stats.mean !== undefined && stats.std !== undefined) {
        const zScore = Math.abs((value - stats.mean) / stats.std);
        if (zScore > 3) { // 3 standard deviations
          this.metrics.outlierDetections++;
          this.createAlert('outlier', 'warning', featureName, 
            `Feature ${featureName} has outlier value: ${value} (z-score: ${zScore.toFixed(2)})`);
        }
      }
    }
    
    // Check for drift (if enabled and enough history)
    if (this.config.enableDriftDetection && history.length >= 100) {
      const driftDetected = this.detectDrift(featureName, value, feature, history);
      if (driftDetected) {
        this.metrics.driftDetections++;
        this.createAlert('drift', 'critical', featureName, 
          `Feature ${featureName} shows data drift`);
      }
    }
  }
  
  /**
   * Detect data drift for a feature
   */
  private detectDrift(featureName: string, currentValue: any, feature: FeatureStoreFeature, history: Array<{ value: any; timestamp: number }>): boolean {
    if (!feature.statistics || history.length < 100) return false;
    
    const stats = feature.statistics;
    const threshold = this.config?.driftThreshold || 0.1;
    
    if (feature.type === 'numerical' && typeof currentValue === 'number' && stats.mean !== undefined && stats.std !== undefined) {
      // Calculate recent mean (last 50 values)
      const recentValues = history.slice(-50).map(h => h.value).filter(v => typeof v === 'number') as number[];
      if (recentValues.length < 10) return false;
      
      const recentMean = recentValues.reduce((sum, v) => sum + v, 0) / recentValues.length;
      const recentStd = Math.sqrt(
        recentValues.reduce((sum, v) => sum + Math.pow(v - recentMean, 2), 0) / recentValues.length
      );
      
      // Compare with baseline statistics
      const meanDrift = Math.abs(recentMean - stats.mean) / (stats.std || 1);
      const stdDrift = Math.abs(recentStd - (stats.std || 0)) / (stats.std || 1);
      
      return meanDrift > threshold || stdDrift > threshold;
    } else if (feature.type === 'categorical') {
      // For categorical features, check distribution change
      const recentValues = history.slice(-50).map(h => String(h.value));
      const baselineCategories = stats.distinctCount || 5;
      
      const uniqueRecent = new Set(recentValues).size;
      const distributionChange = Math.abs(uniqueRecent - baselineCategories) / (baselineCategories || 1);
      
      return distributionChange > threshold;
    }
    
    return false;
  }
  
  /**
   * Create an alert
   */
  private createAlert(
    type: 'drift' | 'missing' | 'outlier' | 'error',
    severity: 'critical' | 'warning' | 'info',
    featureName: string,
    message: string
  ): void {
    const alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      featureName,
      message,
      timestamp: Date.now(),
      resolved: false,
    };
    
    this.alerts.push(alert);
    
    // Limit alerts size
    if (this.alerts.length > this.MAX_ALERTS) {
      this.alerts.shift();
    }
    
    // Update active alerts count
    this.metrics.activeAlerts = this.alerts.filter(a => !a.resolved).length;
  }
  
  /**
   * Get active alerts
   */
  public getAlerts(limit: number = 100): Array<{
    id: string;
    type: 'drift' | 'missing' | 'outlier' | 'error';
    severity: 'critical' | 'warning' | 'info';
    featureName?: string;
    message: string;
    timestamp: number;
    resolved?: boolean;
  }> {
    return this.alerts
      .filter(a => !a.resolved)
      .sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })
      .slice(0, limit);
  }
  
  /**
   * Write features to the store (online or offline)
   */
  public writeFeatures(
    features: Record<string, any>,
    entityIds?: string[],
    storeType: 'online' | 'offline' = 'online',
    timestamp?: number
  ): {
    success: boolean;
    written: number;
    latency: number;
    error?: string;
  } {
    if (!this.config || !this.config.enabled) {
      return {
        success: false,
        written: 0,
        latency: 0,
        error: 'Feature Store is not enabled',
      };
    }
    
    const startTime = Date.now();
    const writeTimestamp = timestamp || Date.now();
    let written = 0;
    
    // Validate that all features exist
    const featureNames = Object.keys(features);
    const missingFeatures: string[] = [];
    for (const featureName of featureNames) {
      const found = Array.from(this.features.values()).find(
        f => f.name === featureName && f.status === 'active'
      );
      if (!found) {
        missingFeatures.push(featureName);
      }
    }
    
    if (missingFeatures.length > 0) {
      return {
        success: false,
        written: 0,
        latency: Date.now() - startTime,
        error: `Features not found: ${missingFeatures.join(', ')}`,
      };
    }
    
    // Validate features if enabled
    if (this.config.enableFeatureValidation) {
      const validationResult = this.validateFeatures(featureNames, features);
      if (!validationResult.valid) {
        return {
          success: false,
          written: 0,
          latency: Date.now() - startTime,
          error: `Validation failed: ${validationResult.error}`,
        };
      }
    }
    
    if (storeType === 'online') {
      // Write to online store
      if (!this.config.enableOnlineServing) {
        return {
          success: false,
          written: 0,
          latency: Date.now() - startTime,
          error: 'Online serving is not enabled',
        };
      }
      
      // If entityIds provided, write for each entity
      if (entityIds && entityIds.length > 0) {
        for (const entityId of entityIds) {
          if (!this.onlineStore.has(entityId)) {
            this.onlineStore.set(entityId, new Map());
          }
          const entityFeatures = this.onlineStore.get(entityId)!;
          
          for (const [featureName, value] of Object.entries(features)) {
            entityFeatures.set(featureName, {
              value,
              timestamp: writeTimestamp,
            });
            written++;
          }
        }
      } else {
        // Write to default entity (for features without entity IDs)
        const defaultEntityId = '__default__';
        if (!this.onlineStore.has(defaultEntityId)) {
          this.onlineStore.set(defaultEntityId, new Map());
        }
        const entityFeatures = this.onlineStore.get(defaultEntityId)!;
        
        for (const [featureName, value] of Object.entries(features)) {
          entityFeatures.set(featureName, {
            value,
            timestamp: writeTimestamp,
          });
          written++;
        }
      }
      
      // Invalidate cache for written features
      if (this.config.enableCaching) {
        for (const key of this.cache.keys()) {
          if (featureNames.some(name => key.includes(name))) {
            this.cache.delete(key);
          }
        }
      }
    } else {
      // Write to offline store (with historical tracking)
      if (!this.config.enableOfflineServing) {
        return {
          success: false,
          written: 0,
          latency: Date.now() - startTime,
          error: 'Offline serving is not enabled',
        };
      }
      
      // If entityIds provided, write for each entity
      if (entityIds && entityIds.length > 0) {
        for (const entityId of entityIds) {
          for (const [featureName, value] of Object.entries(features)) {
            if (!this.offlineStore.has(featureName)) {
              this.offlineStore.set(featureName, new Map());
            }
            const featureStore = this.offlineStore.get(featureName)!;
            
            if (!featureStore.has(entityId)) {
              featureStore.set(entityId, []);
            }
            const entityHistory = featureStore.get(entityId)!;
            
            // Add to history (sorted by timestamp)
            entityHistory.push({
              value,
              timestamp: writeTimestamp,
            });
            
            // Keep only last 1000 entries per entity per feature
            if (entityHistory.length > 1000) {
              entityHistory.shift();
            }
            
            // Sort by timestamp
            entityHistory.sort((a, b) => a.timestamp - b.timestamp);
            
            written++;
          }
        }
      } else {
        // Write to default entity
        const defaultEntityId = '__default__';
        for (const [featureName, value] of Object.entries(features)) {
          if (!this.offlineStore.has(featureName)) {
            this.offlineStore.set(featureName, new Map());
          }
          const featureStore = this.offlineStore.get(featureName)!;
          
          if (!featureStore.has(defaultEntityId)) {
            featureStore.set(defaultEntityId, []);
          }
          const entityHistory = featureStore.get(defaultEntityId)!;
          
          entityHistory.push({
            value,
            timestamp: writeTimestamp,
          });
          
          if (entityHistory.length > 1000) {
            entityHistory.shift();
          }
          
          entityHistory.sort((a, b) => a.timestamp - b.timestamp);
          written++;
        }
      }
    }
    
    const latency = storeType === 'online' 
      ? this.getOnlineLatency(false) 
      : this.getOfflineLatency();
    
    // Update metrics
    this.metrics.requestsTotal++;
    if (storeType === 'online') {
      this.metrics.requestsOnline++;
    } else {
      this.metrics.requestsOffline++;
    }
    this.metrics.requestsSuccess++;
    
    return {
      success: true,
      written,
      latency,
    };
  }
  
  /**
   * Выполняет один цикл обновления Feature Store
   */
  public performUpdate(currentTime: number, hasIncomingConnections: boolean = false): void {
    if (!this.config || !this.config.enabled) return;
    
    // Process pending requests from DataFlowEngine (incoming connections)
    this.processPendingRequests(currentTime);
    
    // Simulate requests if there are incoming connections but no pending ones
    if (hasIncomingConnections && this.pendingRequests.length === 0) {
      this.simulateRequests(currentTime);
    }
    
    // Update metrics
    this.updateMetrics();
    
    // Clean up expired cache entries
    this.cleanupCache();
  }
  
  /**
   * Process pending requests from DataFlowEngine
   */
  private processPendingRequests(currentTime: number): void {
    while (this.pendingRequests.length > 0) {
      const request = this.pendingRequests.shift();
      if (!request) break;
      
      try {
        const result = this.processFeatureRequest(
          request.featureNames,
          request.entityIds,
          request.requestType
        );
        
        if (result.success) {
          request.resolve(result.data);
        } else {
          request.reject(new Error(result.error || 'Feature request failed'));
        }
      } catch (error) {
        request.reject(error instanceof Error ? error : new Error('Unknown error'));
      }
    }
  }
  
  /**
   * Simulate requests when there are incoming connections
   */
  private simulateRequests(currentTime: number): void {
    // Simulate some requests based on configuration
    const features = this.getFeatures();
    if (features.length === 0) return;
    
    // Simulate 1-5 requests per update cycle
    const numRequests = 1 + Math.floor(Math.random() * 4);
    
    for (let i = 0; i < numRequests; i++) {
      // Randomly select 1-3 features
      const numFeatures = 1 + Math.floor(Math.random() * 3);
      const selectedFeatures = features
        .filter(f => f.status === 'active')
        .sort(() => Math.random() - 0.5)
        .slice(0, numFeatures)
        .map(f => f.name);
      
      if (selectedFeatures.length === 0) continue;
      
      // Randomly choose online or offline (80% online, 20% offline)
      const requestType = Math.random() < 0.8 ? 'online' : 'offline';
      
      this.processFeatureRequest(selectedFeatures, undefined, requestType);
    }
  }
  
  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if ((now - entry.timestamp) > entry.ttl * 1000) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Materialize features from offline store to online store
   * This simulates the process of syncing batch/offline features to online serving
   */
  public materializeFeatures(
    featureNames: string[],
    entityIds?: string[],
    materializationWindow?: number // Time window in milliseconds
  ): {
    success: boolean;
    materialized: number;
    latency: number;
    error?: string;
  } {
    if (!this.config || !this.config.enabled) {
      return {
        success: false,
        materialized: 0,
        latency: 0,
        error: 'Feature Store is not enabled',
      };
    }
    
    if (!this.config.enableOnlineServing || !this.config.enableOfflineServing) {
      return {
        success: false,
        materialized: 0,
        latency: 0,
        error: 'Both online and offline serving must be enabled for materialization',
      };
    }
    
    const startTime = Date.now();
    const window = materializationWindow || 3600000; // Default: 1 hour
    const cutoffTime = Date.now() - window;
    let materialized = 0;
    
    // Get entities to materialize
    const entitiesToProcess = entityIds || ['__default__'];
    
    for (const entityId of entitiesToProcess) {
      for (const featureName of featureNames) {
        const feature = Array.from(this.features.values()).find(f => f.name === featureName);
        if (!feature) continue;
        
        // Get latest value from offline store
        const offlineStore = this.offlineStore.get(featureName);
        if (!offlineStore) continue;
        
        const entityHistory = offlineStore.get(entityId);
        if (!entityHistory || entityHistory.length === 0) continue;
        
        // Find the latest value within the materialization window
        let latestValue: any = null;
        let latestTimestamp = 0;
        
        for (let i = entityHistory.length - 1; i >= 0; i--) {
          const entry = entityHistory[i];
          if (entry.timestamp >= cutoffTime && entry.timestamp > latestTimestamp) {
            latestValue = entry.value;
            latestTimestamp = entry.timestamp;
          }
        }
        
        if (latestValue !== null) {
          // Write to online store
          if (!this.onlineStore.has(entityId)) {
            this.onlineStore.set(entityId, new Map());
          }
          const onlineFeatures = this.onlineStore.get(entityId)!;
          
          // Check if online value is older or doesn't exist
          const existingOnline = onlineFeatures.get(featureName);
          if (!existingOnline || existingOnline.timestamp < latestTimestamp) {
            onlineFeatures.set(featureName, {
              value: latestValue,
              timestamp: latestTimestamp,
            });
            materialized++;
            
            // Invalidate cache for this feature
            if (this.config.enableCaching) {
              for (const key of this.cache.keys()) {
                if (key.includes(featureName)) {
                  this.cache.delete(key);
                }
              }
            }
          }
        }
      }
    }
    
    const latency = this.getOnlineLatency(false) * materialized; // Simulate materialization latency
    
    return {
      success: true,
      materialized,
      latency,
    };
  }
}

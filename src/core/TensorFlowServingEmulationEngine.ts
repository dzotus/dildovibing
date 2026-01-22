import { CanvasNode } from '@/types';

/**
 * Model Status
 */
export type ModelStatus = 'serving' | 'loading' | 'unavailable' | 'error';

/**
 * Prediction Status
 */
export type PredictionStatus = 'success' | 'error' | 'timeout';

/**
 * TensorFlow Serving Model
 */
export interface TensorFlowModel {
  name: string;
  version: string;
  status: ModelStatus;
  platform: string;
  inputs?: Array<{ name: string; dtype: string; shape: string }>;
  outputs?: Array<{ name: string; dtype: string; shape: string }>;
  requests?: number;
  avgLatency?: number;
  totalPredictions?: number;
  successfulPredictions?: number;
  failedPredictions?: number;
  memoryUsage?: number; // MB
  loadTime?: number; // ms
  lastUsed?: number; // timestamp
}

/**
 * TensorFlow Serving Prediction
 */
export interface TensorFlowPrediction {
  id: string;
  model: string;
  version: string;
  input?: string;
  output?: string;
  status: PredictionStatus;
  timestamp: number;
  latency: number; // ms
  batchSize?: number;
  error?: string;
}

/**
 * TensorFlow Serving Configuration
 */
export interface TensorFlowServingConfig {
  enabled?: boolean;
  endpoint?: string;
  modelBasePath?: string;
  enableBatching?: boolean;
  batchSize?: number;
  maxBatchSize?: number;
  maxBatchWaitTime?: number; // ms
  enableGPU?: boolean;
  gpuMemoryFraction?: number;
  enableMonitoring?: boolean;
  monitoringPort?: number;
  models?: Array<{
    name: string;
    version: string;
    status?: ModelStatus;
    platform?: string;
    inputs?: Array<{ name: string; dtype: string; shape: string }>;
    outputs?: Array<{ name: string; dtype: string; shape: string }>;
  }>;
  predictions?: Array<{
    id: string;
    model: string;
    version: string;
    input?: string;
    output?: string;
    status?: PredictionStatus;
    timestamp?: string;
    latency?: number;
  }>;
  totalModels?: number;
  totalPredictions?: number;
  averageLatency?: number;
  // Performance tuning
  numThreads?: number;
  interOpParallelismThreads?: number;
  intraOpParallelismThreads?: number;
  sessionConfig?: Record<string, unknown>;
  // Error simulation
  errorRate?: number; // 0-1, probability of error
  enableErrorSimulation?: boolean;
  timeoutMs?: number; // Request timeout in milliseconds
  // Versioning policies
  versioningPolicy?: 'latest' | 'specific' | 'all';
  // A/B Testing
  enableABTesting?: boolean;
  abTestConfig?: Array<{
    modelName: string;
    versions: Array<{
      version: string;
      trafficPercentage: number; // 0-100
    }>;
  }>;
  // Prometheus metrics export
  enablePrometheusExport?: boolean;
  prometheusPort?: number;
  // gRPC API
  enableGRPC?: boolean;
  grpcPort?: number;
}

/**
 * TensorFlow Serving Engine Metrics
 */
export interface TensorFlowServingEngineMetrics {
  totalModels: number;
  servingModels: number;
  loadingModels: number;
  unavailableModels: number;
  totalPredictions: number;
  successfulPredictions: number;
  failedPredictions: number;
  averageLatency: number;
  p50Latency: number;
  p99Latency: number;
  requestsPerSecond: number;
  throughput: number; // predictions per second
  errorRate: number;
  batchUtilization: number; // 0-1, how well batching is utilized
  gpuUtilization?: number; // 0-1, if GPU enabled
  memoryUsage: number; // MB
  cpuUtilization: number; // 0-1
  requestsTotal: number;
  requestsErrors: number;
  // Model-specific metrics
  modelMetrics: Map<string, {
    predictions: number;
    avgLatency: number;
    errorRate: number;
    requestsPerSecond: number;
  }>;
}

/**
 * Batch Queue for batching predictions
 */
interface BatchQueue {
  modelName: string;
  version: string;
  items: Array<{
    predictionId: string;
    input: any;
    timestamp: number;
    resolve: (result: any) => void;
    reject: (error: Error) => void;
  }>;
  lastBatchTime: number;
}

/**
 * TensorFlow Serving Emulation Engine
 * Симулирует работу TensorFlow Serving: модели, предсказания, батчинг, GPU, метрики
 */
export class TensorFlowServingEmulationEngine {
  private config: TensorFlowServingConfig | null = null;
  
  // Models
  private models: Map<string, TensorFlowModel> = new Map(); // key: "name:version"
  
  // Predictions history
  private predictions: Map<string, TensorFlowPrediction> = new Map();
  private readonly MAX_PREDICTION_HISTORY = 10000;
  
  // Batch queues per model
  private batchQueues: Map<string, BatchQueue> = new Map(); // key: "name:version"
  
  // Metrics
  private metrics: TensorFlowServingEngineMetrics = {
    totalModels: 0,
    servingModels: 0,
    loadingModels: 0,
    unavailableModels: 0,
    totalPredictions: 0,
    successfulPredictions: 0,
    failedPredictions: 0,
    averageLatency: 0,
    p50Latency: 0,
    p99Latency: 0,
    requestsPerSecond: 0,
    throughput: 0,
    errorRate: 0,
    batchUtilization: 0,
    memoryUsage: 0,
    cpuUtilization: 0,
    requestsTotal: 0,
    requestsErrors: 0,
    modelMetrics: new Map(),
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
  
  // Model loading simulation
  private modelLoadingStates: Map<string, {
    startTime: number;
    loadDuration: number;
  }> = new Map();
  
  // Pending predictions from DataFlowEngine (incoming connections)
  private pendingPredictions: Array<{
    id: string;
    modelName: string;
    version: string;
    input: any;
    timestamp: number;
    resolve: (result: any) => void;
    reject: (error: Error) => void;
  }> = [];
  
  // Metrics history for visualization (time series)
  private metricsHistory: Array<{
    timestamp: number;
    latency: number;
    rps: number;
    errorRate: number;
    throughput: number;
    batchUtilization: number;
    gpuUtilization?: number;
    cpuUtilization: number;
  }> = [];
  private readonly MAX_METRICS_HISTORY = 300; // 5 minutes at 1 second intervals
  
  /**
   * Инициализирует конфигурацию TensorFlow Serving из конфига компонента
   */
  public initializeConfig(node: CanvasNode): void {
    const config = (node.data.config as any) || {} as TensorFlowServingConfig;
    this.config = {
      enabled: config.enabled !== false,
      endpoint: config.endpoint || 'localhost:8501',
      modelBasePath: config.modelBasePath || '/models',
      enableBatching: config.enableBatching !== false,
      batchSize: config.batchSize || 32,
      maxBatchSize: config.maxBatchSize || 128,
      maxBatchWaitTime: config.maxBatchWaitTime || 100,
      enableGPU: config.enableGPU || false,
      gpuMemoryFraction: config.gpuMemoryFraction || 0.5,
      enableMonitoring: config.enableMonitoring !== false,
      monitoringPort: config.monitoringPort || 8501,
      numThreads: config.numThreads || 4,
      interOpParallelismThreads: config.interOpParallelismThreads || 2,
      intraOpParallelismThreads: config.intraOpParallelismThreads || 2,
      errorRate: config.errorRate || 0,
      enableErrorSimulation: config.enableErrorSimulation || false,
      timeoutMs: config.timeoutMs || 30000,
      versioningPolicy: config.versioningPolicy || 'latest',
      enableABTesting: config.enableABTesting || false,
      abTestConfig: config.abTestConfig || [],
      enablePrometheusExport: config.enablePrometheusExport || false,
      prometheusPort: config.prometheusPort || 8502,
      enableGRPC: config.enableGRPC || false,
      grpcPort: config.grpcPort || 8500,
      ...config,
    };
    
    // Initialize models from config
    this.initializeModels();
    
    // Initialize batch queues
    this.initializeBatchQueues();
  }
  
  /**
   * Initialize models from config
   */
  private initializeModels(): void {
    if (!this.config) return;
    
    this.models.clear();
    
    if (this.config.models && Array.isArray(this.config.models)) {
      for (const modelConfig of this.config.models) {
        const key = `${modelConfig.name}:${modelConfig.version}`;
        const model: TensorFlowModel = {
          name: modelConfig.name,
          version: modelConfig.version,
          status: modelConfig.status || 'serving',
          platform: modelConfig.platform || 'tensorflow',
          inputs: modelConfig.inputs || [],
          outputs: modelConfig.outputs || [],
          requests: 0,
          avgLatency: 0,
          totalPredictions: 0,
          successfulPredictions: 0,
          failedPredictions: 0,
          memoryUsage: this.estimateModelMemory(modelConfig),
          loadTime: this.estimateLoadTime(modelConfig),
          lastUsed: Date.now(),
        };
        
        this.models.set(key, model);
        
        // If model is loading, simulate loading process
        if (model.status === 'loading') {
          this.modelLoadingStates.set(key, {
            startTime: Date.now(),
            loadDuration: model.loadTime || 5000,
          });
        }
      }
    }
    
    this.updateModelSpecificMetrics();
  }
  
  /**
   * Initialize batch queues for models with batching enabled
   */
  private initializeBatchQueues(): void {
    if (!this.config || !this.config.enableBatching) return;
    
    this.batchQueues.clear();
    
    for (const [key, model] of this.models.entries()) {
      if (model.status === 'serving') {
        this.batchQueues.set(key, {
          modelName: model.name,
          version: model.version,
          items: [],
          lastBatchTime: Date.now(),
        });
      }
    }
  }
  
  /**
   * Estimate model memory usage based on inputs/outputs
   */
  private estimateModelMemory(modelConfig: any): number {
    // Simple estimation: base memory + input/output size
    let baseMemory = 100; // MB base
    
    if (modelConfig.inputs && Array.isArray(modelConfig.inputs)) {
      for (const input of modelConfig.inputs) {
        // Estimate based on shape (simplified)
        const shape = input.shape || '[1,1]';
        const matches = shape.match(/\d+/g);
        if (matches) {
          const size = matches.reduce((a, b) => parseInt(a) * parseInt(b), 1);
          baseMemory += size * 0.001; // Rough estimate
        }
      }
    }
    
    return Math.max(50, Math.min(5000, baseMemory));
  }
  
  /**
   * Estimate model load time
   */
  private estimateLoadTime(modelConfig: any): number {
    // Base load time + complexity factor
    let baseTime = 2000; // 2 seconds base
    
    const memory = this.estimateModelMemory(modelConfig);
    baseTime += memory * 2; // 2ms per MB
    
    return Math.max(1000, Math.min(30000, baseTime));
  }
  
  /**
   * Выполняет один цикл обновления TensorFlow Serving
   */
  public performUpdate(currentTime: number, hasIncomingConnections: boolean = false): void {
    if (!this.config || !this.config.enabled) return;
    
    const deltaTime = currentTime - this.lastUpdateTime;
    this.lastUpdateTime = currentTime;
    
    // Update model loading states
    this.updateModelLoadingStates(currentTime);
    
    // Process pending predictions from DataFlowEngine (incoming connections)
    this.processPendingPredictions(currentTime);
    
    // Process batch queues
    if (this.config.enableBatching) {
      this.processBatchQueues(currentTime);
    }
    
    // Simulate predictions if there are incoming connections but no pending ones
    if (hasIncomingConnections && this.pendingPredictions.length === 0) {
      this.simulatePredictions(currentTime);
    }
    
    // Update metrics
    this.updateMetrics(currentTime);
  }
  
  /**
   * Add prediction request from DataFlowEngine (incoming connection)
   */
  public addPendingPrediction(
    modelName: string,
    version: string,
    input: any
  ): Promise<{ success: boolean; output?: any; error?: string; latency: number }> {
    return new Promise((resolve, reject) => {
      const predictionId = `pred-${Date.now()}-${Math.random()}`;
      this.pendingPredictions.push({
        id: predictionId,
        modelName,
        version,
        input,
        timestamp: Date.now(),
        resolve: (result) => resolve(result),
        reject: (error) => reject(error),
      });
    });
  }
  
  /**
   * Process pending predictions from DataFlowEngine
   */
  private processPendingPredictions(currentTime: number): void {
    if (this.pendingPredictions.length === 0) return;
    
    // Process pending predictions
    const toProcess = [...this.pendingPredictions];
    this.pendingPredictions = [];
    
    for (const pending of toProcess) {
      // Check timeout
      const elapsed = currentTime - pending.timestamp;
      if (this.config?.timeoutMs && elapsed > this.config.timeoutMs) {
        const latency = currentTime - pending.timestamp;
        this.metrics.requestsTotal++;
        this.metrics.requestsErrors++;
        pending.reject(new Error('Request timeout'));
        continue;
      }
      
      // Process prediction
      this.processPredictionInternal(
        pending.id,
        pending.modelName,
        pending.version,
        pending.input,
        currentTime,
        pending.resolve,
        pending.reject
      );
    }
  }
  
  /**
   * Internal method to process prediction (used by both pending and batch)
   */
  private processPredictionInternal(
    predictionId: string,
    modelName: string,
    version: string,
    input: any,
    currentTime: number,
    resolve: (result: any) => void,
    reject: (error: Error) => void
  ): void {
    const key = `${modelName}:${version}`;
    const model = this.models.get(key);
    
    if (!model) {
      const latency = 5; // Fast failure
      this.metrics.requestsTotal++;
      this.metrics.requestsErrors++;
      reject(new Error(`Model ${modelName}:${version} not found`));
      return;
    }
    
    if (model.status !== 'serving') {
      const latency = 5;
      this.metrics.requestsTotal++;
      this.metrics.requestsErrors++;
      reject(new Error(`Model ${modelName}:${version} is not serving (status: ${model.status})`));
      return;
    }
    
    // Record request timestamp
    this.requestTimestamps.push(currentTime);
    if (this.requestTimestamps.length > this.MAX_REQUEST_TIMESTAMPS) {
      this.requestTimestamps = this.requestTimestamps.slice(-this.MAX_REQUEST_TIMESTAMPS);
    }
    
    // Check for simulated errors
    let shouldError = false;
    let errorType: 'timeout' | 'validation' | 'model' = 'model';
    if (this.config?.enableErrorSimulation && this.config.errorRate && this.config.errorRate > 0) {
      if (Math.random() < this.config.errorRate) {
        shouldError = true;
        // Randomly select error type
        const errorRand = Math.random();
        if (errorRand < 0.3) {
          errorType = 'timeout';
        } else if (errorRand < 0.6) {
          errorType = 'validation';
        } else {
          errorType = 'model';
        }
      }
    }
    
    if (shouldError) {
      const latency = this.calculateBaseLatency(model);
      const errorMessage = errorType === 'timeout' 
        ? 'Request timeout'
        : errorType === 'validation'
        ? 'Input validation failed'
        : 'Model inference error';
      
      const prediction: TensorFlowPrediction = {
        id: predictionId,
        model: modelName,
        version: version,
        input: JSON.stringify(input),
        status: 'error',
        timestamp: currentTime,
        latency: Math.floor(latency),
        error: errorMessage,
      };
      
      this.predictions.set(prediction.id, prediction);
      model.requests = (model.requests || 0) + 1;
      model.totalPredictions = (model.totalPredictions || 0) + 1;
      model.failedPredictions = (model.failedPredictions || 0) + 1;
      this.metrics.requestsTotal++;
      this.metrics.requestsErrors++;
      
      reject(new Error(errorMessage));
      return;
    }
    
    // Process prediction
    if (this.config?.enableBatching) {
      // Add to batch queue
      const queue = this.batchQueues.get(key);
      if (!queue) {
        const latency = 5;
        this.metrics.requestsTotal++;
        this.metrics.requestsErrors++;
        reject(new Error('Batch queue not found'));
        return;
      }
      
      queue.items.push({
        predictionId,
        input,
        timestamp: currentTime,
        resolve,
        reject,
      });
    } else {
      // Execute immediately
      const latency = this.calculateBaseLatency(model);
      const output = this.generateMockOutput(model);
      
      const prediction: TensorFlowPrediction = {
        id: predictionId,
        model: modelName,
        version: version,
        input: JSON.stringify(input),
        output: JSON.stringify(output),
        status: 'success',
        timestamp: currentTime,
        latency: Math.floor(latency),
      };
      
      this.predictions.set(prediction.id, prediction);
      
      // Update model stats
      model.requests = (model.requests || 0) + 1;
      model.totalPredictions = (model.totalPredictions || 0) + 1;
      model.successfulPredictions = (model.successfulPredictions || 0) + 1;
      model.avgLatency = this.updateAverageLatency(model.avgLatency || 0, prediction.latency, model.totalPredictions);
      model.lastUsed = currentTime;
      
      // Limit prediction history
      if (this.predictions.size > this.MAX_PREDICTION_HISTORY) {
        const firstKey = this.predictions.keys().next().value;
        this.predictions.delete(firstKey);
      }
      
      this.metrics.requestsTotal++;
      
      resolve({
        success: true,
        output,
        latency: prediction.latency,
      });
    }
  }
  
  /**
   * Update model loading states
   */
  private updateModelLoadingStates(currentTime: number): void {
    for (const [key, loadingState] of this.modelLoadingStates.entries()) {
      const elapsed = currentTime - loadingState.startTime;
      
      if (elapsed >= loadingState.loadDuration) {
        // Model finished loading
        const model = this.models.get(key);
        if (model) {
          model.status = 'serving';
          model.lastUsed = currentTime;
        }
        this.modelLoadingStates.delete(key);
        
        // Initialize batch queue if batching enabled
        if (this.config?.enableBatching && model) {
          this.batchQueues.set(key, {
            modelName: model.name,
            version: model.version,
            items: [],
            lastBatchTime: currentTime,
          });
        }
      }
    }
  }
  
  /**
   * Process batch queues - execute batches when ready
   */
  private processBatchQueues(currentTime: number): void {
    if (!this.config) return;
    
    for (const [key, queue] of this.batchQueues.entries()) {
      const model = this.models.get(key);
      if (!model || model.status !== 'serving') continue;
      
      const timeSinceLastBatch = currentTime - queue.lastBatchTime;
      const shouldFlush = 
        queue.items.length >= (this.config.batchSize || 32) ||
        (timeSinceLastBatch >= (this.config.maxBatchWaitTime || 100) && queue.items.length > 0);
      
      if (shouldFlush && queue.items.length > 0) {
        this.executeBatch(key, queue, currentTime);
      }
    }
  }
  
  /**
   * Execute a batch of predictions
   */
  private executeBatch(key: string, queue: BatchQueue, currentTime: number): void {
    const model = this.models.get(key);
    if (!model) {
      // Reject all items in batch
      const batchItems = queue.items.splice(0, queue.items.length);
      for (const item of batchItems) {
        item.reject(new Error('Model not found'));
      }
      return;
    }
    
    const batchSize = queue.items.length;
    const batchItems = queue.items.splice(0, batchSize);
    
    // Calculate batch latency (batch processing is more efficient)
    // Improved formula: batch processing is more efficient per item
    const baseLatency = this.calculateBaseLatency(model);
    const batchEfficiency = Math.max(0.5, 1 - (batchSize - 1) * 0.05); // Each additional item adds 5% latency, but min 50% efficiency
    const batchLatency = baseLatency * batchEfficiency;
    
    // Process each item in batch
    for (const item of batchItems) {
      // Check for simulated errors
      let shouldError = false;
      let errorType: 'timeout' | 'validation' | 'model' = 'model';
      if (this.config?.enableErrorSimulation && this.config.errorRate && this.config.errorRate > 0) {
        if (Math.random() < this.config.errorRate) {
          shouldError = true;
          const errorRand = Math.random();
          if (errorRand < 0.3) {
            errorType = 'timeout';
          } else if (errorRand < 0.6) {
            errorType = 'validation';
          } else {
            errorType = 'model';
          }
        }
      }
      
      if (shouldError) {
        const latency = Math.floor(batchLatency);
        const errorMessage = errorType === 'timeout' 
          ? 'Request timeout'
          : errorType === 'validation'
          ? 'Input validation failed'
          : 'Model inference error';
        
        const prediction: TensorFlowPrediction = {
          id: item.predictionId,
          model: model.name,
          version: model.version,
          input: JSON.stringify(item.input),
          status: 'error',
          timestamp: currentTime,
          latency: latency,
          batchSize: batchSize,
          error: errorMessage,
        };
        
        this.predictions.set(prediction.id, prediction);
        model.requests = (model.requests || 0) + 1;
        model.totalPredictions = (model.totalPredictions || 0) + 1;
        model.failedPredictions = (model.failedPredictions || 0) + 1;
        this.metrics.requestsTotal++;
        this.metrics.requestsErrors++;
        
        item.reject(new Error(errorMessage));
        continue;
      }
      
      // Success case
      const output = this.generateMockOutput(model);
      const prediction: TensorFlowPrediction = {
        id: item.predictionId,
        model: model.name,
        version: model.version,
        input: JSON.stringify(item.input),
        output: JSON.stringify(output),
        status: 'success',
        timestamp: currentTime,
        latency: Math.floor(batchLatency + (Math.random() * 10 - 5)), // Add some variation
        batchSize: batchSize,
      };
      
      this.predictions.set(prediction.id, prediction);
      
      // Update model stats
      model.requests = (model.requests || 0) + 1;
      model.totalPredictions = (model.totalPredictions || 0) + 1;
      model.successfulPredictions = (model.successfulPredictions || 0) + 1;
      model.avgLatency = this.updateAverageLatency(model.avgLatency || 0, prediction.latency, model.totalPredictions);
      model.lastUsed = currentTime;
      
      this.metrics.requestsTotal++;
      
      // Resolve promise with result
      item.resolve({
        success: true,
        output,
        latency: prediction.latency,
      });
    }
    
    // Update batch queue
    queue.lastBatchTime = currentTime;
    
    // Limit prediction history
    if (this.predictions.size > this.MAX_PREDICTION_HISTORY) {
      const firstKey = this.predictions.keys().next().value;
      this.predictions.delete(firstKey);
    }
  }
  
  /**
   * Simulate predictions based on incoming connections
   */
  private simulatePredictions(currentTime: number): void {
    if (!this.config) return;
    
    // Simulate requests based on configuration
    const requestRate = this.calculateRequestRate();
    const requestsThisUpdate = Math.floor(requestRate * 0.1); // 100ms update interval
    
    for (let i = 0; i < requestsThisUpdate; i++) {
      // Select random serving model
      const servingModels = Array.from(this.models.values()).filter(m => m.status === 'serving');
      if (servingModels.length === 0) continue;
      
      const model = servingModels[Math.floor(Math.random() * servingModels.length)];
      const key = `${model.name}:${model.version}`;
      
      // Create prediction request
      const predictionId = `pred-${currentTime}-${i}`;
      const input = this.generateMockInput(model);
      
      if (this.config.enableBatching) {
        // Add to batch queue
        const queue = this.batchQueues.get(key);
        if (queue) {
          queue.items.push({
            predictionId,
            input,
            timestamp: currentTime,
            resolve: () => {},
            reject: () => {},
          });
        }
      } else {
        // Execute immediately
        const latency = this.calculateBaseLatency(model);
        const prediction: TensorFlowPrediction = {
          id: predictionId,
          model: model.name,
          version: model.version,
          input: JSON.stringify(input),
          output: JSON.stringify(this.generateMockOutput(model)),
          status: 'success',
          timestamp: currentTime,
          latency: Math.floor(latency + (Math.random() * 10 - 5)),
        };
        
        this.predictions.set(prediction.id, prediction);
        
        // Update model stats
        model.requests = (model.requests || 0) + 1;
        model.totalPredictions = (model.totalPredictions || 0) + 1;
        model.successfulPredictions = (model.successfulPredictions || 0) + 1;
        model.avgLatency = this.updateAverageLatency(model.avgLatency || 0, prediction.latency, model.totalPredictions);
        model.lastUsed = currentTime;
      }
    }
  }
  
  /**
   * Calculate base latency for a model
   */
  private calculateBaseLatency(model: TensorFlowModel): number {
    // Base latency depends on model complexity
    let baseLatency = 20; // ms base
    
    // Add latency based on model size
    const memory = model.memoryUsage || 100;
    baseLatency += memory * 0.1;
    
    // GPU acceleration reduces latency
    if (this.config?.enableGPU) {
      baseLatency *= 0.3; // 70% reduction with GPU
    }
    
    // Add some randomness
    baseLatency += (Math.random() * 10 - 5);
    
    return Math.max(5, baseLatency);
  }
  
  /**
   * Calculate request rate based on configuration
   */
  private calculateRequestRate(): number {
    // Base rate: 10 requests per second per serving model
    const servingModels = Array.from(this.models.values()).filter(m => m.status === 'serving');
    return servingModels.length * 10;
  }
  
  /**
   * Generate mock input for a model
   */
  private generateMockInput(model: TensorFlowModel): any {
    const input: any = {};
    
    if (model.inputs && Array.isArray(model.inputs)) {
      for (const inp of model.inputs) {
        // Generate mock data based on shape
        const shape = inp.shape || '[1,1]';
        const matches = shape.match(/\d+/g);
        if (matches) {
          const dims = matches.map(m => parseInt(m));
          input[inp.name] = this.generateArray(dims);
        } else {
          input[inp.name] = [Math.random()];
        }
      }
    } else {
      // Default input
      input.instances = [[Math.random(), Math.random(), Math.random()]];
    }
    
    return input;
  }
  
  /**
   * Generate array with given dimensions
   */
  private generateArray(dims: number[]): number[] {
    if (dims.length === 1) {
      return Array(dims[0]).fill(0).map(() => Math.random());
    } else if (dims.length === 2) {
      return Array(dims[0]).fill(0).map(() => 
        Array(dims[1]).fill(0).map(() => Math.random())
      );
    } else {
      // Flatten for simplicity
      const total = dims.reduce((a, b) => a * b, 1);
      return Array(total).fill(0).map(() => Math.random());
    }
  }
  
  /**
   * Generate mock output for a model
   */
  private generateMockOutput(model: TensorFlowModel): any {
    // Generate predictions based on model outputs
    if (model.outputs && model.outputs.length > 0) {
      const output: any = {};
      for (const out of model.outputs) {
        const shape = out.shape || '[1,1]';
        const matches = shape.match(/\d+/g);
        if (matches) {
          const dims = matches.map(m => parseInt(m));
          output[out.name] = this.generateArray(dims);
        } else {
          output[out.name] = [[Math.random()]];
        }
      }
      return output;
    }
    
    // Default output
    return {
      predictions: [[Math.random(), Math.random(), Math.random()]],
    };
  }
  
  /**
   * Update average latency using running average
   */
  private updateAverageLatency(currentAvg: number, newValue: number, count: number): number {
    if (count === 1) return newValue;
    return (currentAvg * (count - 1) + newValue) / count;
  }
  
  /**
   * Update metrics
   */
  private updateMetrics(currentTime: number): void {
    // Update model counts
    let servingModels = 0;
    let loadingModels = 0;
    let unavailableModels = 0;
    
    for (const model of this.models.values()) {
      switch (model.status) {
        case 'serving':
          servingModels++;
          break;
        case 'loading':
          loadingModels++;
          break;
        case 'unavailable':
        case 'error':
          unavailableModels++;
          break;
      }
    }
    
    this.metrics.totalModels = this.models.size;
    this.metrics.servingModels = servingModels;
    this.metrics.loadingModels = loadingModels;
    this.metrics.unavailableModels = unavailableModels;
    
    // Update prediction metrics
    const recentPredictions = Array.from(this.predictions.values())
      .filter(p => currentTime - p.timestamp < 60000); // Last minute
    
    this.metrics.totalPredictions = this.predictions.size;
    this.metrics.successfulPredictions = recentPredictions.filter(p => p.status === 'success').length;
    this.metrics.failedPredictions = recentPredictions.filter(p => p.status === 'error').length;
    
    // Calculate latency metrics
    if (recentPredictions.length > 0) {
      const latencies = recentPredictions.map(p => p.latency).sort((a, b) => a - b);
      this.metrics.averageLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      this.metrics.p50Latency = this.calculatePercentile(latencies, 50);
      this.metrics.p99Latency = this.calculatePercentile(latencies, 99);
      
      // Update latency history
      this.latencyHistory.push(...latencies.slice(-100));
      if (this.latencyHistory.length > this.MAX_LATENCY_HISTORY) {
        this.latencyHistory = this.latencyHistory.slice(-this.MAX_LATENCY_HISTORY);
      }
    }
    
    // Calculate RPS
    const oneSecondAgo = currentTime - 1000;
    const recentRequests = this.requestTimestamps.filter(t => t > oneSecondAgo);
    this.metrics.requestsPerSecond = recentRequests.length;
    this.metrics.throughput = this.metrics.requestsPerSecond;
    
    // Calculate error rate
    if (recentPredictions.length > 0) {
      this.metrics.errorRate = this.metrics.failedPredictions / recentPredictions.length;
    }
    
    // Calculate batch utilization
    if (this.config?.enableBatching) {
      let totalQueued = 0;
      let totalBatches = 0;
      for (const queue of this.batchQueues.values()) {
        totalQueued += queue.items.length;
        totalBatches++;
      }
      const avgQueueSize = totalBatches > 0 ? totalQueued / totalBatches : 0;
      this.metrics.batchUtilization = Math.min(1, avgQueueSize / (this.config.batchSize || 32));
    }
    
    // Calculate GPU utilization (if enabled)
    if (this.config?.enableGPU) {
      this.metrics.gpuUtilization = Math.min(1, this.metrics.requestsPerSecond / 100); // Scale to 100 RPS = 100% GPU
    }
    
    // Calculate memory usage
    let totalMemory = 0;
    for (const model of this.models.values()) {
      totalMemory += model.memoryUsage || 0;
    }
    this.metrics.memoryUsage = totalMemory;
    
    // Calculate CPU utilization
    this.metrics.cpuUtilization = Math.min(1, this.metrics.requestsPerSecond / 50); // Scale to 50 RPS = 100% CPU
    
    // Update model-specific metrics
    this.updateModelSpecificMetrics();
    
    // Store metrics history for visualization
    this.metricsHistory.push({
      timestamp: currentTime,
      latency: this.metrics.averageLatency,
      rps: this.metrics.requestsPerSecond,
      errorRate: this.metrics.errorRate,
      throughput: this.metrics.throughput,
      batchUtilization: this.metrics.batchUtilization,
      gpuUtilization: this.metrics.gpuUtilization,
      cpuUtilization: this.metrics.cpuUtilization,
    });
    
    // Limit history size
    if (this.metricsHistory.length > this.MAX_METRICS_HISTORY) {
      this.metricsHistory = this.metricsHistory.slice(-this.MAX_METRICS_HISTORY);
    }
  }
  
  /**
   * Update model-specific metrics
   */
  private updateModelSpecificMetrics(): void {
    this.metrics.modelMetrics.clear();
    
    for (const [key, model] of this.models.entries()) {
      const recentPredictions = Array.from(this.predictions.values())
        .filter(p => p.model === model.name && p.version === model.version);
      
      const modelKey = `${model.name}:${model.version}`;
      this.metrics.modelMetrics.set(modelKey, {
        predictions: recentPredictions.length,
        avgLatency: model.avgLatency || 0,
        errorRate: model.failedPredictions && model.totalPredictions
          ? model.failedPredictions / model.totalPredictions
          : 0,
        requestsPerSecond: model.requests ? model.requests / 60 : 0, // Rough estimate
      });
    }
  }
  
  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }
  
  /**
   * Process a prediction request
   */
  public async processPrediction(
    modelName: string,
    version: string,
    input: any
  ): Promise<{ success: boolean; output?: any; error?: string; latency: number }> {
    const startTime = Date.now();
    const key = `${modelName}:${version}`;
    const model = this.models.get(key);
    
    if (!model) {
      const latency = Date.now() - startTime;
      this.metrics.requestsTotal++;
      this.metrics.requestsErrors++;
      return {
        success: false,
        error: `Model ${modelName}:${version} not found`,
        latency,
      };
    }
    
    if (model.status !== 'serving') {
      const latency = Date.now() - startTime;
      this.metrics.requestsTotal++;
      this.metrics.requestsErrors++;
      return {
        success: false,
        error: `Model ${modelName}:${version} is not serving (status: ${model.status})`,
        latency,
      };
    }
    
    // Record request timestamp
    this.requestTimestamps.push(startTime);
    if (this.requestTimestamps.length > this.MAX_REQUEST_TIMESTAMPS) {
      this.requestTimestamps = this.requestTimestamps.slice(-this.MAX_REQUEST_TIMESTAMPS);
    }
    
    // Process prediction
    if (this.config?.enableBatching) {
      // Add to batch queue
      return new Promise((resolve, reject) => {
        const queue = this.batchQueues.get(key);
        if (!queue) {
          const latency = Date.now() - startTime;
          this.metrics.requestsTotal++;
          this.metrics.requestsErrors++;
          resolve({
            success: false,
            error: 'Batch queue not found',
            latency,
          });
          return;
        }
        
        const predictionId = `pred-${Date.now()}-${Math.random()}`;
        queue.items.push({
          predictionId,
          input,
          timestamp: startTime,
          resolve: (output) => {
            const latency = Date.now() - startTime;
            this.metrics.requestsTotal++;
            resolve({
              success: true,
              output,
              latency,
            });
          },
          reject: (error) => {
            const latency = Date.now() - startTime;
            this.metrics.requestsTotal++;
            this.metrics.requestsErrors++;
            resolve({
              success: false,
              error: error.message,
              latency,
            });
          },
        });
      });
    } else {
      // Execute immediately
      const latency = this.calculateBaseLatency(model);
      const output = this.generateMockOutput(model);
      
      const prediction: TensorFlowPrediction = {
        id: `pred-${Date.now()}`,
        model: modelName,
        version: version,
        input: JSON.stringify(input),
        output: JSON.stringify(output),
        status: 'success',
        timestamp: startTime,
        latency: Math.floor(latency),
      };
      
      this.predictions.set(prediction.id, prediction);
      
      // Update model stats
      model.requests = (model.requests || 0) + 1;
      model.totalPredictions = (model.totalPredictions || 0) + 1;
      model.successfulPredictions = (model.successfulPredictions || 0) + 1;
      model.avgLatency = this.updateAverageLatency(model.avgLatency || 0, prediction.latency, model.totalPredictions);
      model.lastUsed = startTime;
      
      // Limit prediction history
      if (this.predictions.size > this.MAX_PREDICTION_HISTORY) {
        const firstKey = this.predictions.keys().next().value;
        this.predictions.delete(firstKey);
      }
      
      this.metrics.requestsTotal++;
      
      return {
        success: true,
        output,
        latency: prediction.latency,
      };
    }
  }
  
  /**
   * Get metrics
   */
  public getMetrics(): TensorFlowServingEngineMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Get models
   */
  public getModels(): TensorFlowModel[] {
    return Array.from(this.models.values());
  }
  
  /**
   * Get recent predictions
   */
  public getRecentPredictions(limit: number = 100): TensorFlowPrediction[] {
    return Array.from(this.predictions.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
  
  /**
   * Sync models from config (called when config changes)
   */
  public syncModelsFromConfig(): void {
    if (!this.config) return;
    this.initializeModels();
    this.initializeBatchQueues();
  }
  
  /**
   * Get metrics history for visualization
   */
  public getMetricsHistory(limit?: number): Array<{
    timestamp: number;
    latency: number;
    rps: number;
    errorRate: number;
    throughput: number;
    batchUtilization: number;
    gpuUtilization?: number;
    cpuUtilization: number;
  }> {
    if (limit) {
      return this.metricsHistory.slice(-limit);
    }
    return [...this.metricsHistory];
  }
  
  /**
   * Select model version based on versioning policy or A/B testing
   */
  private selectModelVersion(modelName: string): string | null {
    if (!this.config) return null;
    
    // Check A/B testing first
    if (this.config.enableABTesting && this.config.abTestConfig) {
      const abConfig = this.config.abTestConfig.find(c => c.modelName === modelName);
      if (abConfig && abConfig.versions.length > 0) {
        // Select version based on traffic percentage
        const rand = Math.random() * 100;
        let cumulative = 0;
        for (const versionConfig of abConfig.versions) {
          cumulative += versionConfig.trafficPercentage;
          if (rand <= cumulative) {
            const key = `${modelName}:${versionConfig.version}`;
            if (this.models.has(key) && this.models.get(key)?.status === 'serving') {
              return versionConfig.version;
            }
          }
        }
        // Fallback to first available version
        for (const versionConfig of abConfig.versions) {
          const key = `${modelName}:${versionConfig.version}`;
          if (this.models.has(key) && this.models.get(key)?.status === 'serving') {
            return versionConfig.version;
          }
        }
      }
    }
    
    // Use versioning policy
    const availableVersions = Array.from(this.models.values())
      .filter(m => m.name === modelName && m.status === 'serving')
      .map(m => ({ version: m.version, timestamp: m.lastUsed || 0 }))
      .sort((a, b) => {
        // Sort by version number (simple string comparison)
        return b.version.localeCompare(a.version);
      });
    
    if (availableVersions.length === 0) return null;
    
    switch (this.config.versioningPolicy) {
      case 'latest':
        return availableVersions[0].version;
      case 'all':
        // Return random version for load balancing
        return availableVersions[Math.floor(Math.random() * availableVersions.length)].version;
      case 'specific':
        // Return first available (specific version should be specified in request)
        return availableVersions[0].version;
      default:
        return availableVersions[0].version;
    }
  }
  
  /**
   * Get Prometheus metrics format
   */
  public getPrometheusMetrics(): string {
    const lines: string[] = [];
    
    // General metrics
    lines.push(`# HELP tensorflow_serving_models_total Total number of models`);
    lines.push(`# TYPE tensorflow_serving_models_total gauge`);
    lines.push(`tensorflow_serving_models_total ${this.metrics.totalModels}`);
    
    lines.push(`# HELP tensorflow_serving_models_serving Number of serving models`);
    lines.push(`# TYPE tensorflow_serving_models_serving gauge`);
    lines.push(`tensorflow_serving_models_serving ${this.metrics.servingModels}`);
    
    lines.push(`# HELP tensorflow_serving_predictions_total Total number of predictions`);
    lines.push(`# TYPE tensorflow_serving_predictions_total counter`);
    lines.push(`tensorflow_serving_predictions_total ${this.metrics.totalPredictions}`);
    
    lines.push(`# HELP tensorflow_serving_predictions_successful Successful predictions`);
    lines.push(`# TYPE tensorflow_serving_predictions_successful counter`);
    lines.push(`tensorflow_serving_predictions_successful ${this.metrics.successfulPredictions}`);
    
    lines.push(`# HELP tensorflow_serving_predictions_failed Failed predictions`);
    lines.push(`# TYPE tensorflow_serving_predictions_failed counter`);
    lines.push(`tensorflow_serving_predictions_failed ${this.metrics.failedPredictions}`);
    
    lines.push(`# HELP tensorflow_serving_latency_ms Average latency in milliseconds`);
    lines.push(`# TYPE tensorflow_serving_latency_ms gauge`);
    lines.push(`tensorflow_serving_latency_ms ${this.metrics.averageLatency}`);
    
    lines.push(`# HELP tensorflow_serving_latency_p50_ms P50 latency in milliseconds`);
    lines.push(`# TYPE tensorflow_serving_latency_p50_ms gauge`);
    lines.push(`tensorflow_serving_latency_p50_ms ${this.metrics.p50Latency}`);
    
    lines.push(`# HELP tensorflow_serving_latency_p99_ms P99 latency in milliseconds`);
    lines.push(`# TYPE tensorflow_serving_latency_p99_ms gauge`);
    lines.push(`tensorflow_serving_latency_p99_ms ${this.metrics.p99Latency}`);
    
    lines.push(`# HELP tensorflow_serving_requests_per_second Requests per second`);
    lines.push(`# TYPE tensorflow_serving_requests_per_second gauge`);
    lines.push(`tensorflow_serving_requests_per_second ${this.metrics.requestsPerSecond}`);
    
    lines.push(`# HELP tensorflow_serving_error_rate Error rate (0-1)`);
    lines.push(`# TYPE tensorflow_serving_error_rate gauge`);
    lines.push(`tensorflow_serving_error_rate ${this.metrics.errorRate}`);
    
    lines.push(`# HELP tensorflow_serving_batch_utilization Batch utilization (0-1)`);
    lines.push(`# TYPE tensorflow_serving_batch_utilization gauge`);
    lines.push(`tensorflow_serving_batch_utilization ${this.metrics.batchUtilization}`);
    
    if (this.metrics.gpuUtilization !== undefined) {
      lines.push(`# HELP tensorflow_serving_gpu_utilization GPU utilization (0-1)`);
      lines.push(`# TYPE tensorflow_serving_gpu_utilization gauge`);
      lines.push(`tensorflow_serving_gpu_utilization ${this.metrics.gpuUtilization}`);
    }
    
    lines.push(`# HELP tensorflow_serving_cpu_utilization CPU utilization (0-1)`);
    lines.push(`# TYPE tensorflow_serving_cpu_utilization gauge`);
    lines.push(`tensorflow_serving_cpu_utilization ${this.metrics.cpuUtilization}`);
    
    lines.push(`# HELP tensorflow_serving_memory_usage_mb Memory usage in MB`);
    lines.push(`# TYPE tensorflow_serving_memory_usage_mb gauge`);
    lines.push(`tensorflow_serving_memory_usage_mb ${this.metrics.memoryUsage}`);
    
    // Model-specific metrics
    for (const [modelKey, modelMetrics] of this.metrics.modelMetrics.entries()) {
      const [modelName, version] = modelKey.split(':');
      lines.push(`# Model-specific metrics for ${modelName}:${version}`);
      lines.push(`tensorflow_serving_model_predictions_total{model="${modelName}",version="${version}"} ${modelMetrics.predictions}`);
      lines.push(`tensorflow_serving_model_latency_ms{model="${modelName}",version="${version}"} ${modelMetrics.avgLatency}`);
      lines.push(`tensorflow_serving_model_error_rate{model="${modelName}",version="${version}"} ${modelMetrics.errorRate}`);
      lines.push(`tensorflow_serving_model_rps{model="${modelName}",version="${version}"} ${modelMetrics.requestsPerSecond}`);
    }
    
    return lines.join('\n');
  }
  
  /**
   * Get model status (for Status API)
   */
  public getModelStatus(modelName: string, version?: string): {
    model_version_status: Array<{
      version: string;
      state: string;
      status: {
        error_code: number;
        error_message: string;
      };
    }>;
  } | null {
    const matchingModels = Array.from(this.models.values())
      .filter(m => m.name === modelName && (!version || m.version === version));
    
    if (matchingModels.length === 0) return null;
    
    return {
      model_version_status: matchingModels.map(m => ({
        version: m.version,
        state: m.status === 'serving' ? 'AVAILABLE' : 
               m.status === 'loading' ? 'LOADING' : 
               m.status === 'error' ? 'UNAVAILABLE' : 'UNAVAILABLE',
        status: {
          error_code: m.status === 'error' ? 1 : 0,
          error_message: m.status === 'error' ? 'Model error' : '',
        },
      })),
    };
  }
  
  /**
   * Process gRPC prediction request (simulated)
   * In real TensorFlow Serving, this would use Protocol Buffers
   */
  public async processGRPCPrediction(
    modelName: string,
    version: string,
    input: any
  ): Promise<{ success: boolean; output?: any; error?: string; latency: number }> {
    // gRPC uses the same prediction logic as REST, but with different serialization
    // For simulation purposes, we use the same processPrediction method
    return this.processPrediction(modelName, version, input);
  }
  
  /**
   * Get gRPC endpoint info
   */
  public getGRPCInfo(): { enabled: boolean; port: number; endpoint: string } | null {
    if (!this.config || !this.config.enableGRPC) return null;
    
    const host = this.config.endpoint?.split(':')[0] || 'localhost';
    const port = this.config.grpcPort || 8500;
    
    return {
      enabled: true,
      port,
      endpoint: `${host}:${port}`,
    };
  }
}

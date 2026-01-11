import { CanvasNode } from '@/types';

/**
 * Spark Job Status
 */
export type SparkJobStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'KILLED';

/**
 * Spark Stage Status
 */
export type SparkStageStatus = 'ACTIVE' | 'COMPLETE' | 'FAILED' | 'SKIPPED';

/**
 * Spark Executor Status
 */
export type SparkExecutorStatus = 'ALIVE' | 'DEAD' | 'UNKNOWN';

/**
 * Spark Job
 */
export interface SparkJob {
  id: string;
  name: string;
  status: SparkJobStatus;
  startTime: number;
  endTime?: number;
  duration?: number;
  stages: number;
  tasks: number;
  executors: number;
  inputBytes: number;
  outputBytes: number;
  shuffleRead: number;
  shuffleWrite: number;
  submissionTime?: number;
  completionTime?: number;
  // DAG information
  stageDependencies?: Map<string, string[]>; // Map of stageId -> parent stageIds
  rootStageIds?: string[]; // Stages with no dependencies (can start immediately)
}

/**
 * Spark Stage
 */
export interface SparkStage {
  id: string;
  jobId: string;
  name: string;
  status: SparkStageStatus;
  numTasks: number;
  numActiveTasks: number;
  numCompleteTasks: number;
  numFailedTasks: number;
  inputBytes: number;
  outputBytes: number;
  shuffleRead: number;
  shuffleWrite: number;
  duration: number;
  submissionTime?: number;
  completionTime?: number;
  // DAG dependencies
  parentStageIds?: string[]; // Stages that must complete before this stage
  childStageIds?: string[]; // Stages that depend on this stage
  stageType?: 'map' | 'reduce' | 'shuffle' | 'action'; // Type of stage operation
  // Shuffle network I/O and spill metrics
  shuffleNetworkRead?: number; // Bytes read over network during shuffle
  shuffleNetworkWrite?: number; // Bytes written over network during shuffle
  shuffleSpillMemory?: number; // Bytes spilled from memory to disk
  shuffleSpillDisk?: number; // Bytes read from disk during shuffle
  shuffleFetchWaitTime?: number; // Time waiting for shuffle data (ms)
}

/**
 * Spark Executor
 */
export interface SparkExecutor {
  id: string;
  host: string;
  status: SparkExecutorStatus;
  cores: number;
  memoryUsed: number;
  memoryMax: number;
  diskUsed: number;
  diskMax: number;
  activeTasks: number;
  totalTasks: number;
  totalInputBytes: number;
  totalShuffleRead: number;
  totalShuffleWrite: number;
  startTime: number;
  lastHeartbeat: number;
}

/**
 * Spark Configuration
 */
export interface SparkEmulationConfig {
  master?: string;
  appName?: string;
  driverMemory?: string;
  executorMemory?: string;
  executorCores?: number;
  enableDynamicAllocation?: boolean;
  minExecutors?: number;
  maxExecutors?: number;
  enableCheckpointing?: boolean;
  checkpointDirectory?: string;
  enableStreaming?: boolean;
  streamingBatchInterval?: number;
  jobs?: Array<{
    id: string;
    name: string;
    status?: SparkJobStatus;
    startTime?: string;
    stages?: number;
    tasks?: number;
  }>;
  stages?: Array<{
    id: string;
    jobId: string;
    name: string;
    status?: SparkStageStatus;
    numTasks?: number;
  }>;
  executors?: Array<{
    id: string;
    host: string;
    status?: SparkExecutorStatus;
    cores?: number;
    memoryMax?: number;
    diskMax?: number;
  }>;
  jobCreationRate?: number; // jobs per hour
  averageJobDuration?: number; // milliseconds
  failureRate?: number; // 0-1
  dataProcessingRate?: number; // bytes per second per job
  shuffleIntensity?: number; // 0-1, how much shuffle operations
  executorFailureRate?: number; // 0-1, probability of executor failure
  durationVariation?: number; // 0-1, variation in durations ±X%
}

/**
 * Spark SQL Query
 */
export interface SparkSQLQuery {
  id: string;
  query: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  executionTime?: number; // milliseconds
  rowsProcessed?: number;
  startTime?: number;
  endTime?: number;
  explainPlan?: string; // Query execution plan
  physicalPlan?: string; // Physical execution plan
  logicalPlan?: string; // Logical execution plan
  stages?: string[]; // Associated stage IDs
  jobId?: string; // Associated job ID
}

/**
 * Spark Streaming Job
 */
export interface SparkStreamingJob {
  id: string;
  name: string;
  status: 'ACTIVE' | 'STOPPED' | 'FAILED';
  batchInterval: number; // milliseconds
  startTime: number;
  lastBatchTime?: number;
  nextBatchTime?: number;
  totalBatches: number;
  processedBatches: number;
  failedBatches: number;
  totalRecordsProcessed: number;
  averageProcessingTime: number; // milliseconds per batch
  checkpointDirectory?: string;
  backpressureEnabled: boolean;
  currentBackpressure: number; // 0-1, how much backpressure
  jobId?: string; // Associated batch job ID
}

/**
 * Spark Engine Metrics
 */
export interface SparkEngineMetrics {
  totalJobs: number;
  activeJobs: number;
  succeededJobs: number;
  failedJobs: number;
  totalStages: number;
  activeStages: number;
  totalExecutors: number;
  aliveExecutors: number;
  totalCores: number;
  totalMemory: number; // GB
  totalMemoryUsed: number; // GB
  totalInputBytes: number;
  totalOutputBytes: number;
  totalShuffleRead: number;
  totalShuffleWrite: number;
  totalShuffleNetworkRead: number; // Network I/O during shuffle
  totalShuffleNetworkWrite: number;
  totalShuffleSpillMemory: number; // Memory spill to disk
  totalShuffleSpillDisk: number; // Disk read during shuffle
  jobsPerHour: number;
  averageJobDuration: number;
  throughput: number; // bytes per second
  requestsTotal: number;
  requestsErrors: number;
  // GC Metrics
  gcPauseTime: number; // Total GC pause time in ms
  gcFrequency: number; // GC events per hour
  memoryBeforeGC: number; // Memory before GC in GB
  memoryAfterGC: number; // Memory after GC in GB
  // Network Metrics
  totalNetworkIO: number; // Total network I/O in bytes
  networkUtilization: number; // Network utilization percentage (0-100)
  networkErrors: number; // Network error count
  // Disk Metrics
  diskIORate: number; // Disk I/O rate in bytes per second
  diskUtilization: number; // Disk utilization percentage (0-100)
  diskErrors: number; // Disk error count
  // JVM Metrics
  heapUsage: number; // Heap usage in GB
  nonHeapUsage: number; // Non-heap usage in GB
  threadCount: number; // Number of threads
}

/**
 * Spark Emulation Engine
 * Симулирует работу Apache Spark: jobs, stages, executors, метрики
 */
export class SparkEmulationEngine {
  private config: SparkEmulationConfig | null = null;
  
  // Jobs
  private jobs: Map<string, SparkJob> = new Map();
  private activeJobs: Map<string, SparkJob> = new Map();
  private readonly MAX_JOB_HISTORY = 1000;
  
  // Stages
  private stages: Map<string, SparkStage> = new Map();
  private activeStages: Map<string, SparkStage> = new Map();
  private readonly MAX_STAGE_HISTORY = 5000;
  
  // Executors
  private executors: Map<string, SparkExecutor> = new Map();
  
  // SQL Queries
  private sqlQueries: Map<string, SparkSQLQuery> = new Map();
  private activeSqlQueries: Map<string, SparkSQLQuery> = new Map();
  private readonly MAX_SQL_QUERY_HISTORY = 1000;
  
  // Streaming Jobs
  private streamingJobs: Map<string, SparkStreamingJob> = new Map();
  private activeStreamingJobs: Map<string, SparkStreamingJob> = new Map();
  private readonly MAX_STREAMING_JOB_HISTORY = 100;
  private lastStreamingCheckpoint: number = 0;
  private readonly CHECKPOINT_INTERVAL = 60000; // 1 minute
  
  // Metrics
  private sparkMetrics: SparkEngineMetrics = {
    totalJobs: 0,
    activeJobs: 0,
    succeededJobs: 0,
    failedJobs: 0,
    totalStages: 0,
    activeStages: 0,
    totalExecutors: 0,
    aliveExecutors: 0,
    totalCores: 0,
    totalMemory: 0,
    totalMemoryUsed: 0,
    totalInputBytes: 0,
    totalOutputBytes: 0,
    totalShuffleRead: 0,
    totalShuffleWrite: 0,
    totalShuffleNetworkRead: 0,
    totalShuffleNetworkWrite: 0,
    totalShuffleSpillMemory: 0,
    totalShuffleSpillDisk: 0,
    jobsPerHour: 0,
    averageJobDuration: 0,
    throughput: 0,
    requestsTotal: 0,
    requestsErrors: 0,
    // GC Metrics
    gcPauseTime: 0,
    gcFrequency: 0,
    memoryBeforeGC: 0,
    memoryAfterGC: 0,
    // Network Metrics
    totalNetworkIO: 0,
    networkUtilization: 0,
    networkErrors: 0,
    // Disk Metrics
    diskIORate: 0,
    diskUtilization: 0,
    diskErrors: 0,
    // JVM Metrics
    heapUsage: 0,
    nonHeapUsage: 0,
    threadCount: 0,
  };
  
  // GC history for metrics calculation
  private gcHistory: Array<{ timestamp: number; pauseTime: number; memoryBefore: number; memoryAfter: number }> = [];
  private readonly MAX_GC_HISTORY = 100;
  
  // Network and disk metrics tracking
  private lastNetworkUpdate: number = Date.now();
  private lastDiskUpdate: number = Date.now();
  
  // Job history for metrics
  private jobHistoryList: Array<{ timestamp: number; duration: number; status: SparkJobStatus }> = [];
  private readonly MAX_JOB_HISTORY_LIST = 1000;
  
  // Last job creation time
  private lastJobCreation: number = 0;
  
  // Executor heartbeat tracking
  private executorHeartbeatInterval: Map<string, number> = new Map();
  
  /**
   * Обрабатывает входящий запрос (data processing request)
   */
  processRequest(success: boolean = true): void {
    this.sparkMetrics.requestsTotal++;
    if (!success) {
      this.sparkMetrics.requestsErrors++;
    }
  }
  
  /**
   * Инициализирует конфигурацию Spark из конфига компонента
   */
  initializeConfig(node: CanvasNode): void {
    const config = node.data.config || {};
    
    this.config = {
      master: config.master || config.sparkMaster || 'local[*]',
      appName: config.appName || config.sparkAppName || 'archiphoenix-spark',
      driverMemory: config.driverMemory || '2g',
      executorMemory: config.executorMemory || '4g',
      executorCores: config.executorCores || 2,
      enableDynamicAllocation: config.enableDynamicAllocation ?? true,
      minExecutors: config.minExecutors || 1,
      maxExecutors: config.maxExecutors || 10,
      enableCheckpointing: config.enableCheckpointing ?? true,
      checkpointDirectory: config.checkpointDirectory || '/checkpoint',
      enableStreaming: config.enableStreaming ?? false,
      streamingBatchInterval: config.streamingBatchInterval || 1000,
      jobs: config.jobs || [],
      stages: config.stages || [],
      executors: config.executors || [],
      jobCreationRate: config.jobCreationRate || 2, // 2 jobs per hour
      averageJobDuration: config.averageJobDuration || 300000, // 5 minutes base
      failureRate: config.failureRate ?? 0.05, // 5% failure rate
      dataProcessingRate: config.dataProcessingRate || 104857600, // 100 MB/s per job
      shuffleIntensity: config.shuffleIntensity ?? 0.3, // 30% shuffle
      executorFailureRate: config.executorFailureRate ?? 0.01, // 1% executor failure rate
      durationVariation: config.durationVariation ?? 0.3, // ±30% variation
    };
    
    // Initialize executors
    this.initializeExecutors();
    
    // Initialize jobs
    this.initializeJobs();
    
    // Initialize stages
    this.initializeStages();
    
    // Initialize streaming job if enabled
    if (this.config.enableStreaming) {
      this.initializeStreamingJob(Date.now());
    }
  }
  
  /**
   * Обновляет конфигурацию (для динамических изменений)
   */
  updateConfig(node: CanvasNode): void {
    this.initializeConfig(node);
  }
  
  /**
   * Инициализирует executors из конфига
   */
  private initializeExecutors(): void {
    const configExecutors = this.config?.executors || [];
    const minExecutors = this.config?.minExecutors || 1;
    const maxExecutors = this.config?.maxExecutors || 10;
    const executorMemory = this.parseMemory(this.config?.executorMemory || '4g');
    const executorCores = this.config?.executorCores || 2;
    
    // Clear executors not in config
    const configExecutorIds = new Set(configExecutors.map(e => e.id));
    for (const [executorId, executor] of this.executors.entries()) {
      if (!configExecutorIds.has(executorId) && executor.status === 'DEAD') {
        this.executors.delete(executorId);
      }
    }
    
    // Create default executors if none configured
    if (configExecutors.length === 0) {
      const defaultExecutorCount = Math.max(minExecutors, Math.min(3, maxExecutors));
      for (let i = 0; i < defaultExecutorCount; i++) {
        const executor: SparkExecutor = {
          id: `executor-${i}`,
          host: `host-${i}.example.com`,
          status: 'ALIVE',
          cores: executorCores,
          memoryUsed: executorMemory * 0.3, // 30% used
          memoryMax: executorMemory,
          diskUsed: executorMemory * 0.2, // 20% used
          diskMax: executorMemory * 2, // 2x memory for disk
          activeTasks: 0,
          totalTasks: 0,
          totalInputBytes: 0,
          totalShuffleRead: 0,
          totalShuffleWrite: 0,
          startTime: Date.now() - (Math.random() * 3600000), // Random time in last hour
          lastHeartbeat: Date.now(),
        };
        this.executors.set(executor.id, executor);
        this.executorHeartbeatInterval.set(executor.id, 3000 + Math.random() * 2000); // 3-5 seconds
      }
      return;
    }
    
    for (const executorConfig of configExecutors) {
      const existingExecutor = this.executors.get(executorConfig.id);
      const executorMemory = this.parseMemory(this.config?.executorMemory || '4g');
      
      const executor: SparkExecutor = {
        id: executorConfig.id,
        host: executorConfig.host || `host-${executorConfig.id}.example.com`,
        status: executorConfig.status || (existingExecutor?.status || 'ALIVE'),
        cores: executorConfig.cores || executorCores,
        memoryUsed: existingExecutor?.memoryUsed || executorMemory * 0.3,
        memoryMax: executorConfig.memoryMax || executorMemory,
        diskUsed: existingExecutor?.diskUsed || executorMemory * 0.2,
        diskMax: executorConfig.diskMax || executorMemory * 2,
        activeTasks: existingExecutor?.activeTasks || 0,
        totalTasks: existingExecutor?.totalTasks || 0,
        totalInputBytes: existingExecutor?.totalInputBytes || 0,
        totalShuffleRead: existingExecutor?.totalShuffleRead || 0,
        totalShuffleWrite: existingExecutor?.totalShuffleWrite || 0,
        startTime: existingExecutor?.startTime || Date.now() - (Math.random() * 3600000),
        lastHeartbeat: Date.now(),
      };
      
      this.executors.set(executor.id, executor);
      if (!this.executorHeartbeatInterval.has(executor.id)) {
        this.executorHeartbeatInterval.set(executor.id, 3000 + Math.random() * 2000);
      }
    }
  }
  
  /**
   * Инициализирует jobs из конфига
   */
  private initializeJobs(): void {
    const activeJobIds = new Set(Array.from(this.activeJobs.keys()));
    
    // Remove completed jobs that are not in config
    const configJobIds = new Set((this.config?.jobs || []).map(j => j.id));
    for (const [jobId, job] of this.jobs.entries()) {
      if (!activeJobIds.has(jobId) && !configJobIds.has(jobId)) {
        this.jobs.delete(jobId);
      }
    }
    
    const configJobs = this.config?.jobs || [];
    for (const jobConfig of configJobs) {
      const existingJob = this.jobs.get(jobConfig.id);
      
      const job: SparkJob = {
        id: jobConfig.id,
        name: jobConfig.name,
        status: jobConfig.status || (existingJob?.status || 'SUCCEEDED'),
        startTime: jobConfig.startTime ? new Date(jobConfig.startTime).getTime() : (existingJob?.startTime || Date.now() - 3600000),
        stages: jobConfig.stages || (existingJob?.stages || 3),
        tasks: jobConfig.tasks || (existingJob?.tasks || 100),
        executors: existingJob?.executors || this.executors.size,
        inputBytes: existingJob?.inputBytes || 0,
        outputBytes: existingJob?.outputBytes || 0,
        shuffleRead: existingJob?.shuffleRead || 0,
        shuffleWrite: existingJob?.shuffleWrite || 0,
      };
      
      if (job.status === 'RUNNING') {
        this.activeJobs.set(job.id, job);
      }
      
      this.jobs.set(job.id, job);
    }
  }
  
  /**
   * Инициализирует stages из конфига
   */
  private initializeStages(): void {
    const activeStageIds = new Set(Array.from(this.activeStages.keys()));
    
    // Remove completed stages that are not in config
    const configStageIds = new Set((this.config?.stages || []).map(s => s.id));
    for (const [stageId, stage] of this.stages.entries()) {
      if (!activeStageIds.has(stageId) && !configStageIds.has(stageId)) {
        this.stages.delete(stageId);
      }
    }
    
    const configStages = this.config?.stages || [];
    for (const stageConfig of configStages) {
      const existingStage = this.stages.get(stageConfig.id);
      const job = this.jobs.get(stageConfig.jobId);
      if (!job) continue;
      
      const stage: SparkStage = {
        id: stageConfig.id,
        jobId: stageConfig.jobId,
        name: stageConfig.name,
        status: stageConfig.status || (existingStage?.status || 'COMPLETE'),
        numTasks: stageConfig.numTasks || (existingStage?.numTasks || 10),
        numActiveTasks: existingStage?.numActiveTasks || 0,
        numCompleteTasks: existingStage?.numCompleteTasks || (stageConfig.status === 'COMPLETE' ? stageConfig.numTasks || 10 : 0),
        numFailedTasks: existingStage?.numFailedTasks || 0,
        inputBytes: existingStage?.inputBytes || 0,
        outputBytes: existingStage?.outputBytes || 0,
        shuffleRead: existingStage?.shuffleRead || 0,
        shuffleWrite: existingStage?.shuffleWrite || 0,
        duration: existingStage?.duration || 0,
      };
      
      if (stage.status === 'ACTIVE') {
        this.activeStages.set(stage.id, stage);
      }
      
      this.stages.set(stage.id, stage);
    }
  }
  
  /**
   * Выполняет один цикл обновления Spark
   * Должен вызываться периодически в EmulationEngine
   */
  performUpdate(currentTime: number): void {
    if (!this.config) return;
    
    // Update active jobs
    this.updateActiveJobs(currentTime);
    
    // Update active stages
    this.updateActiveStages(currentTime);
    
    // Update executors (heartbeat, failures)
    this.updateExecutors(currentTime);
    
    // Update active SQL queries
    for (const [queryId, _] of this.activeSqlQueries.entries()) {
      this.updateSQLQuery(queryId, currentTime);
    }
    
    // Update streaming jobs (batch processing)
    if (this.config.enableStreaming) {
      this.updateStreamingJobs(currentTime);
    }
    
    // Trigger new jobs if enabled
    this.triggerNewJobs(currentTime);
    
    // Update metrics
    this.updateMetrics();
  }
  
  /**
   * Обновляет активные jobs
   */
  private updateActiveJobs(currentTime: number): void {
    const jobsToProcess = Array.from(this.activeJobs.entries());
    
    for (const [jobId, job] of jobsToProcess) {
      if (job.status !== 'RUNNING') {
        // Move to history
        if (this.jobs.size > this.MAX_JOB_HISTORY) {
          const firstKey = this.jobs.keys().next().value;
          if (firstKey && !this.activeJobs.has(firstKey)) {
            this.jobs.delete(firstKey);
          }
        }
        this.activeJobs.delete(jobId);
        continue;
      }
      
      if (!job.submissionTime) {
        job.submissionTime = job.startTime;
        continue;
      }
      
      const elapsed = currentTime - job.startTime;
      const averageDuration = this.config?.averageJobDuration || 300000;
      const durationVariation = this.config?.durationVariation || 0.3;
      const variation = averageDuration * durationVariation * (Math.random() * 2 - 1);
      const estimatedDuration = averageDuration + variation;
      
      // Calculate data processing
      const dataProcessingRate = this.config?.dataProcessingRate || 104857600; // 100 MB/s
      const shuffleIntensity = this.config?.shuffleIntensity || 0.3;
      const timeElapsedSeconds = elapsed / 1000;
      
      if (job.inputBytes === 0) {
        // Initialize data sizes
        const totalDataSize = dataProcessingRate * (estimatedDuration / 1000) * 0.5; // Use 50% of estimated time
        job.inputBytes = totalDataSize;
        job.outputBytes = totalDataSize * 0.8; // 80% output
        job.shuffleRead = totalDataSize * shuffleIntensity;
        job.shuffleWrite = totalDataSize * shuffleIntensity;
      } else {
        // Update data processing progress
        const progress = Math.min(1, elapsed / estimatedDuration);
        job.inputBytes = job.inputBytes * (0.5 + progress * 0.5); // Gradually increase
        job.outputBytes = job.inputBytes * 0.8 * progress;
        job.shuffleRead = job.inputBytes * shuffleIntensity * progress;
        job.shuffleWrite = job.inputBytes * shuffleIntensity * progress;
      }
      
      // Update job stages and tasks
      const stagesForJob = Array.from(this.stages.values()).filter(s => s.jobId === jobId);
      job.stages = stagesForJob.length;
      job.tasks = stagesForJob.reduce((sum, s) => sum + s.numTasks, 0);
      job.executors = this.executors.size;
      
      if (elapsed >= estimatedDuration) {
        // Determine if job succeeds or fails
        const failureRate = this.config?.failureRate ?? 0.05;
        const shouldFail = Math.random() < failureRate;
        
        if (shouldFail) {
          job.status = 'FAILED';
          job.endTime = currentTime;
          job.completionTime = currentTime;
          job.duration = elapsed;
        } else {
          job.status = 'SUCCEEDED';
          job.endTime = currentTime;
          job.completionTime = currentTime;
          job.duration = elapsed;
          
          // Finalize data sizes
          const finalDataSize = dataProcessingRate * (estimatedDuration / 1000);
          job.inputBytes = finalDataSize;
          job.outputBytes = finalDataSize * 0.8;
          job.shuffleRead = finalDataSize * shuffleIntensity;
          job.shuffleWrite = finalDataSize * shuffleIntensity;
        }
        
        // Add to history
        this.jobHistoryList.push({
          timestamp: currentTime,
          duration: elapsed,
          status: job.status,
        });
        if (this.jobHistoryList.length > this.MAX_JOB_HISTORY_LIST) {
          this.jobHistoryList.shift();
        }
      }
    }
  }
  
  /**
   * Обновляет активные stages с учетом DAG зависимостей
   */
  private updateActiveStages(currentTime: number): void {
    const stagesToProcess = Array.from(this.activeStages.entries());
    const completedStages: string[] = [];
    
    for (const [stageId, stage] of stagesToProcess) {
      if (stage.status !== 'ACTIVE') {
        this.activeStages.delete(stageId);
        continue;
      }
      
      if (!stage.submissionTime) {
        stage.submissionTime = currentTime;
        continue;
      }
      
      const job = this.jobs.get(stage.jobId);
      if (!job || job.status !== 'RUNNING') {
        stage.status = 'COMPLETE';
        stage.completionTime = currentTime;
        stage.duration = currentTime - (stage.submissionTime || currentTime);
        stage.numActiveTasks = 0;
        stage.numCompleteTasks = stage.numTasks;
        completedStages.push(stageId);
        continue;
      }
      
      const elapsed = currentTime - (stage.submissionTime || currentTime);
      const averageStageDuration = (this.config?.averageJobDuration || 300000) / (job.stages || 3);
      const durationVariation = this.config?.durationVariation || 0.3;
      const variation = averageStageDuration * durationVariation * (Math.random() * 2 - 1);
      const estimatedDuration = averageStageDuration + variation;
      
      // Update task progress
      const progress = Math.min(1, elapsed / estimatedDuration);
      stage.numCompleteTasks = Math.floor(stage.numTasks * progress);
      stage.numActiveTasks = Math.max(0, stage.numTasks - stage.numCompleteTasks - stage.numFailedTasks);
      
      // Update data sizes based on job
      const jobProgress = Math.min(1, elapsed / estimatedDuration);
      const shuffleIntensity = this.config?.shuffleIntensity || 0.3;
      stage.inputBytes = (job.inputBytes / (job.stages || 3)) * jobProgress;
      stage.outputBytes = (job.outputBytes / (job.stages || 3)) * jobProgress;
      stage.shuffleRead = (job.shuffleRead / (job.stages || 3)) * jobProgress;
      stage.shuffleWrite = (job.shuffleWrite / (job.stages || 3)) * jobProgress;
      
      // Calculate shuffle network I/O and spill (only for shuffle stages)
      if (stage.stageType === 'shuffle' || stage.parentStageIds && stage.parentStageIds.length > 0) {
        const totalExecutors = this.executors.size;
        const networkBandwidth = 100 * 1024 * 1024; // 100 MB/s per executor (simulated)
        
        // Network I/O: shuffle data transferred between executors
        stage.shuffleNetworkRead = (stage.shuffleRead * 0.7) * jobProgress; // 70% of shuffle read is network
        stage.shuffleNetworkWrite = (stage.shuffleWrite * 0.7) * jobProgress; // 70% of shuffle write is network
        
        // Spill: when memory is full, data spills to disk
        const memoryPressure = Math.min(1, (this.sparkMetrics.totalMemoryUsed / this.sparkMetrics.totalMemory) || 0.5);
        const spillThreshold = 0.8; // Spill when memory usage > 80%
        
        if (memoryPressure > spillThreshold) {
          const spillRatio = (memoryPressure - spillThreshold) / (1 - spillThreshold); // 0-1
          stage.shuffleSpillMemory = (stage.shuffleWrite * 0.3 * spillRatio) * jobProgress; // 30% of shuffle write spills
          stage.shuffleSpillDisk = (stage.shuffleRead * 0.2 * spillRatio) * jobProgress; // 20% of shuffle read from disk
        } else {
          stage.shuffleSpillMemory = 0;
          stage.shuffleSpillDisk = 0;
        }
        
        // Shuffle fetch wait time: time waiting for network data
        const networkLatency = 10; // 10ms base network latency
        const networkLoad = Math.min(1, (stage.shuffleNetworkRead || 0) / (networkBandwidth * totalExecutors));
        stage.shuffleFetchWaitTime = networkLatency + (networkLoad * 50); // Additional wait based on load
      } else {
        stage.shuffleNetworkRead = 0;
        stage.shuffleNetworkWrite = 0;
        stage.shuffleSpillMemory = 0;
        stage.shuffleSpillDisk = 0;
        stage.shuffleFetchWaitTime = 0;
      }
      
      if (elapsed >= estimatedDuration || stage.numCompleteTasks >= stage.numTasks) {
        stage.status = 'COMPLETE';
        stage.completionTime = currentTime;
        stage.duration = elapsed;
        stage.numActiveTasks = 0;
        stage.numCompleteTasks = stage.numTasks;
        
        // Finalize data sizes
        stage.inputBytes = job.inputBytes / (job.stages || 3);
        stage.outputBytes = job.outputBytes / (job.stages || 3);
        stage.shuffleRead = job.shuffleRead / (job.stages || 3);
        stage.shuffleWrite = job.shuffleWrite / (job.stages || 3);
        
        // Finalize shuffle network and spill metrics
        if (stage.stageType === 'shuffle' || stage.parentStageIds && stage.parentStageIds.length > 0) {
          const totalExecutors = this.executors.size;
          const memoryPressure = Math.min(1, (this.sparkMetrics.totalMemoryUsed / this.sparkMetrics.totalMemory) || 0.5);
          const spillThreshold = 0.8;
          
          stage.shuffleNetworkRead = (stage.shuffleRead * 0.7);
          stage.shuffleNetworkWrite = (stage.shuffleWrite * 0.7);
          
          if (memoryPressure > spillThreshold) {
            const spillRatio = (memoryPressure - spillThreshold) / (1 - spillThreshold);
            stage.shuffleSpillMemory = stage.shuffleWrite * 0.3 * spillRatio;
            stage.shuffleSpillDisk = stage.shuffleRead * 0.2 * spillRatio;
          } else {
            stage.shuffleSpillMemory = 0;
            stage.shuffleSpillDisk = 0;
          }
        }
        
        completedStages.push(stageId);
      }
    }
    
    // After processing active stages, check if any child stages can be started
    for (const completedStageId of completedStages) {
      const completedStage = this.stages.get(completedStageId);
      if (!completedStage || !completedStage.childStageIds) continue;
      
      // Check each child stage to see if all its dependencies are complete
      for (const childStageId of completedStage.childStageIds) {
        const childStage = this.stages.get(childStageId);
        if (!childStage || childStage.status !== 'SKIPPED') continue;
        
        // Check if all parent stages are complete
        const parentStageIds = childStage.parentStageIds || [];
        const allParentsComplete = parentStageIds.every(parentId => {
          const parentStage = this.stages.get(parentId);
          return parentStage && parentStage.status === 'COMPLETE';
        });
        
        if (allParentsComplete) {
          // Start the child stage
          childStage.status = 'ACTIVE';
          childStage.submissionTime = currentTime;
          childStage.numActiveTasks = childStage.numTasks;
          this.activeStages.set(childStageId, childStage);
        }
      }
    }
    
    // Also check for any skipped stages that might be ready to start (root stages)
    const job = this.jobs.values().next().value;
    if (job && job.rootStageIds) {
      for (const rootStageId of job.rootStageIds) {
        const rootStage = this.stages.get(rootStageId);
        if (rootStage && rootStage.status === 'SKIPPED') {
          rootStage.status = 'ACTIVE';
          rootStage.submissionTime = currentTime;
          rootStage.numActiveTasks = rootStage.numTasks;
          this.activeStages.set(rootStageId, rootStage);
        }
      }
    }
  }
  
  /**
   * Обновляет executors
   */
  private updateExecutors(currentTime: number): void {
    const executorFailureRate = this.config?.executorFailureRate ?? 0.01;
    
    for (const [executorId, executor] of this.executors.entries()) {
      if (executor.status === 'DEAD') continue;
      
      // Update heartbeat
      const heartbeatInterval = this.executorHeartbeatInterval.get(executorId) || 5000;
      if (currentTime - executor.lastHeartbeat > heartbeatInterval * 3) {
        // Executor missed heartbeats - mark as dead
        executor.status = 'DEAD';
        executor.activeTasks = 0;
        continue;
      }
      
      // Random executor failure
      if (Math.random() < executorFailureRate / 3600) { // Per hour probability
        executor.status = 'DEAD';
        executor.activeTasks = 0;
        continue;
      }
      
      // Update heartbeat
      if (currentTime - executor.lastHeartbeat >= heartbeatInterval) {
        executor.lastHeartbeat = currentTime;
      }
      
      // Update memory and disk usage based on active tasks
      const activeJobsCount = this.activeJobs.size;
      const totalExecutors = this.executors.size;
      const tasksPerExecutor = activeJobsCount > 0 ? Math.ceil(100 / totalExecutors) : 0;
      
      executor.activeTasks = Math.min(tasksPerExecutor, executor.cores * 2);
      executor.totalTasks += executor.activeTasks;
      
      // Update memory usage (30-80% based on tasks)
      const memoryUsageFactor = 0.3 + (executor.activeTasks / (executor.cores * 2)) * 0.5;
      executor.memoryUsed = executor.memoryMax * memoryUsageFactor;
      
      // Update disk usage (20-60% based on shuffle)
      const shuffleIntensity = this.config?.shuffleIntensity || 0.3;
      const diskUsageFactor = 0.2 + shuffleIntensity * 0.4;
      executor.diskUsed = executor.diskMax * diskUsageFactor;
      
      // Update shuffle metrics
      const activeJob = Array.from(this.activeJobs.values())[0];
      if (activeJob) {
        executor.totalShuffleRead = (activeJob.shuffleRead / totalExecutors) || 0;
        executor.totalShuffleWrite = (activeJob.shuffleWrite / totalExecutors) || 0;
        executor.totalInputBytes = (activeJob.inputBytes / totalExecutors) || 0;
      }
    }
    
    // Dynamic allocation: add/remove executors
    if (this.config?.enableDynamicAllocation) {
      const minExecutors = this.config.minExecutors || 1;
      const maxExecutors = this.config.maxExecutors || 10;
      const activeJobsCount = this.activeJobs.size;
      const currentAliveExecutors = Array.from(this.executors.values()).filter(e => e.status === 'ALIVE').length;
      
      if (activeJobsCount > 0 && currentAliveExecutors < maxExecutors) {
        // Add executor if needed
        const newExecutorId = `executor-${Date.now()}`;
        const executorMemory = this.parseMemory(this.config.executorMemory || '4g');
        const executorCores = this.config.executorCores || 2;
        
        const newExecutor: SparkExecutor = {
          id: newExecutorId,
          host: `host-${newExecutorId}.example.com`,
          status: 'ALIVE',
          cores: executorCores,
          memoryUsed: executorMemory * 0.3,
          memoryMax: executorMemory,
          diskUsed: executorMemory * 0.2,
          diskMax: executorMemory * 2,
          activeTasks: 0,
          totalTasks: 0,
          totalInputBytes: 0,
          totalShuffleRead: 0,
          totalShuffleWrite: 0,
          startTime: currentTime,
          lastHeartbeat: currentTime,
        };
        
        this.executors.set(newExecutorId, newExecutor);
        this.executorHeartbeatInterval.set(newExecutorId, 3000 + Math.random() * 2000);
      } else if (activeJobsCount === 0 && currentAliveExecutors > minExecutors) {
        // Remove executor if not needed (mark as dead)
        const aliveExecutors = Array.from(this.executors.entries()).filter(([_, e]) => e.status === 'ALIVE');
        if (aliveExecutors.length > minExecutors) {
          const [executorId, executor] = aliveExecutors[aliveExecutors.length - 1];
          executor.status = 'DEAD';
        }
      }
    }
  }
  
  /**
   * Триггерит создание новых jobs
   */
  private triggerNewJobs(currentTime: number): void {
    if (!this.config) return;
    
    const jobCreationRate = this.config.jobCreationRate || 2; // jobs per hour
    const timeSinceLastJob = currentTime - this.lastJobCreation;
    const jobInterval = (3600000 / jobCreationRate); // milliseconds between jobs
    
    if (timeSinceLastJob >= jobInterval && this.activeJobs.size < 5) { // Max 5 concurrent jobs
      this.createNewJob(currentTime);
      this.lastJobCreation = currentTime;
    }
  }
  
  /**
   * Создает новый job с DAG зависимостями между stages
   */
  private createNewJob(currentTime: number): void {
    if (!this.config) return;
    
    const jobId = `job-${Date.now()}`;
    const jobName = `Spark Job ${this.jobs.size + 1}`;
    const stagesCount = 3 + Math.floor(Math.random() * 5); // 3-7 stages
    const tasksPerStage = 10 + Math.floor(Math.random() * 90); // 10-100 tasks per stage
    
    // Build DAG structure: linear pipeline with some parallel branches
    const stageDependencies = new Map<string, string[]>();
    const rootStageIds: string[] = [];
    const stageIds: string[] = [];
    
    // Create stage IDs
    for (let i = 0; i < stagesCount; i++) {
      stageIds.push(`stage-${jobId}-${i}`);
    }
    
    // Build dependencies: first stage has no dependencies, others depend on previous
    // Some stages can run in parallel (e.g., stage 1 -> stage 2,3 -> stage 4)
    for (let i = 0; i < stagesCount; i++) {
      const stageId = stageIds[i];
      const parentIds: string[] = [];
      
      if (i === 0) {
        // First stage has no dependencies
        rootStageIds.push(stageId);
      } else if (i === 1) {
        // Second stage depends on first
        parentIds.push(stageIds[0]);
      } else if (i === 2 && stagesCount > 3) {
        // Third stage can also depend on first (parallel with second)
        parentIds.push(stageIds[0]);
      } else {
        // Other stages depend on previous stage(s)
        // Create a pipeline: each stage depends on previous
        const prevStageIndex = Math.max(0, i - 1);
        parentIds.push(stageIds[prevStageIndex]);
      }
      
      stageDependencies.set(stageId, parentIds);
    }
    
    const job: SparkJob = {
      id: jobId,
      name: jobName,
      status: 'RUNNING',
      startTime: currentTime,
      stages: stagesCount,
      tasks: stagesCount * tasksPerStage,
      executors: this.executors.size,
      inputBytes: 0,
      outputBytes: 0,
      shuffleRead: 0,
      shuffleWrite: 0,
      submissionTime: currentTime,
      stageDependencies,
      rootStageIds,
    };
    
    this.jobs.set(jobId, job);
    this.activeJobs.set(jobId, job);
    
    // Create stages for this job with DAG dependencies
    for (let i = 0; i < stagesCount; i++) {
      const stageId = stageIds[i];
      const parentIds = stageDependencies.get(stageId) || [];
      const isRoot = rootStageIds.includes(stageId);
      
      // Determine stage type based on position
      let stageType: 'map' | 'reduce' | 'shuffle' | 'action' = 'map';
      if (i === 0) {
        stageType = 'map'; // First stage is usually a map
      } else if (i === stagesCount - 1) {
        stageType = 'action'; // Last stage is usually an action
      } else if (parentIds.length > 0) {
        stageType = 'shuffle'; // Middle stages with dependencies are shuffle
      } else {
        stageType = 'reduce';
      }
      
      const stage: SparkStage = {
        id: stageId,
        jobId: jobId,
        name: `Stage ${i + 1}`,
        status: isRoot ? 'ACTIVE' : 'SKIPPED',
        numTasks: tasksPerStage,
        numActiveTasks: isRoot ? tasksPerStage : 0,
        numCompleteTasks: 0,
        numFailedTasks: 0,
        inputBytes: 0,
        outputBytes: 0,
        shuffleRead: 0,
        shuffleWrite: 0,
        duration: 0,
        submissionTime: isRoot ? currentTime : undefined,
        parentStageIds: parentIds,
        childStageIds: [], // Will be populated below
        stageType,
        shuffleNetworkRead: 0,
        shuffleNetworkWrite: 0,
        shuffleSpillMemory: 0,
        shuffleSpillDisk: 0,
        shuffleFetchWaitTime: 0,
      };
      
      // Set child stage IDs for parent stages
      for (const parentId of parentIds) {
        const parentStage = this.stages.get(parentId);
        if (parentStage) {
          if (!parentStage.childStageIds) {
            parentStage.childStageIds = [];
          }
          parentStage.childStageIds.push(stageId);
        }
      }
      
      this.stages.set(stageId, stage);
      if (stage.status === 'ACTIVE') {
        this.activeStages.set(stageId, stage);
      }
    }
    
    // Now set child stage IDs for parent stages (after all stages are created)
    for (let i = 0; i < stagesCount; i++) {
      const stageId = stageIds[i];
      const stage = this.stages.get(stageId);
      if (!stage || !stage.parentStageIds) continue;
      
      for (const parentId of stage.parentStageIds) {
        const parentStage = this.stages.get(parentId);
        if (parentStage) {
          if (!parentStage.childStageIds) {
            parentStage.childStageIds = [];
          }
          parentStage.childStageIds.push(stageId);
        }
      }
    }
  }
  
  /**
   * Обновляет метрики
   */
  private updateMetrics(): void {
    const allJobs = Array.from(this.jobs.values());
    const activeJobsList = Array.from(this.activeJobs.values());
    const allStages = Array.from(this.stages.values());
    const activeStagesList = Array.from(this.activeStages.values());
    const allExecutors = Array.from(this.executors.values());
    const aliveExecutors = allExecutors.filter(e => e.status === 'ALIVE');
    
    this.sparkMetrics.totalJobs = allJobs.length;
    this.sparkMetrics.activeJobs = activeJobsList.length;
    this.sparkMetrics.succeededJobs = allJobs.filter(j => j.status === 'SUCCEEDED').length;
    this.sparkMetrics.failedJobs = allJobs.filter(j => j.status === 'FAILED').length;
    this.sparkMetrics.totalStages = allStages.length;
    this.sparkMetrics.activeStages = activeStagesList.length;
    this.sparkMetrics.totalExecutors = allExecutors.length;
    this.sparkMetrics.aliveExecutors = aliveExecutors.length;
    this.sparkMetrics.totalCores = aliveExecutors.reduce((sum, e) => sum + e.cores, 0);
    this.sparkMetrics.totalMemory = aliveExecutors.reduce((sum, e) => sum + e.memoryMax, 0) / 1024; // Convert to GB
    this.sparkMetrics.totalMemoryUsed = aliveExecutors.reduce((sum, e) => sum + e.memoryUsed, 0) / 1024; // Convert to GB
    
    // Calculate data metrics
    this.sparkMetrics.totalInputBytes = allJobs.reduce((sum, j) => sum + j.inputBytes, 0);
    this.sparkMetrics.totalOutputBytes = allJobs.reduce((sum, j) => sum + j.outputBytes, 0);
    this.sparkMetrics.totalShuffleRead = allJobs.reduce((sum, j) => sum + j.shuffleRead, 0);
    this.sparkMetrics.totalShuffleWrite = allJobs.reduce((sum, j) => sum + j.shuffleWrite, 0);
    
    // Calculate shuffle network and spill metrics from stages
    this.sparkMetrics.totalShuffleNetworkRead = allStages.reduce((sum, s) => sum + (s.shuffleNetworkRead || 0), 0);
    this.sparkMetrics.totalShuffleNetworkWrite = allStages.reduce((sum, s) => sum + (s.shuffleNetworkWrite || 0), 0);
    this.sparkMetrics.totalShuffleSpillMemory = allStages.reduce((sum, s) => sum + (s.shuffleSpillMemory || 0), 0);
    this.sparkMetrics.totalShuffleSpillDisk = allStages.reduce((sum, s) => sum + (s.shuffleSpillDisk || 0), 0);
    
    // Calculate throughput (bytes per second)
    const totalDataProcessed = this.sparkMetrics.totalInputBytes + this.sparkMetrics.totalOutputBytes;
    this.sparkMetrics.throughput = totalDataProcessed / 3600; // Approximate per second
    
    // Calculate jobs per hour from history
    const oneHourAgo = Date.now() - 3600000;
    const recentJobs = this.jobHistoryList.filter(j => j.timestamp >= oneHourAgo);
    this.sparkMetrics.jobsPerHour = recentJobs.length;
    
    // Calculate average job duration
    if (this.jobHistoryList.length > 0) {
      const totalDuration = this.jobHistoryList.reduce((sum, j) => sum + j.duration, 0);
      this.sparkMetrics.averageJobDuration = totalDuration / this.jobHistoryList.length;
    } else {
      this.sparkMetrics.averageJobDuration = this.config?.averageJobDuration || 300000;
    }
    
    // Calculate GC metrics
    this.updateGCMetrics();
    
    // Calculate Network metrics
    this.updateNetworkMetrics();
    
    // Calculate Disk metrics
    this.updateDiskMetrics();
    
    // Calculate JVM metrics
    this.updateJVMMetrics();
  }
  
  /**
   * Обновляет GC метрики
   */
  private updateGCMetrics(): void {
    const currentTime = Date.now();
    const memoryUsed = this.sparkMetrics.totalMemoryUsed;
    
    // Simulate GC events (randomly trigger GC based on memory pressure)
    const memoryPressure = memoryUsed / this.sparkMetrics.totalMemory;
    const gcProbability = Math.max(0, (memoryPressure - 0.7) * 0.1); // Higher pressure = more GC
    
    if (Math.random() < gcProbability && this.sparkMetrics.totalMemory > 0) {
      // Simulate GC event
      const pauseTime = 50 + Math.random() * 150; // 50-200ms pause
      const memoryBefore = memoryUsed;
      const memoryAfter = memoryUsed * (0.85 + Math.random() * 0.1); // 85-95% of memory after GC
      
      this.gcHistory.push({
        timestamp: currentTime,
        pauseTime,
        memoryBefore,
        memoryAfter,
      });
      
      // Keep history limited
      if (this.gcHistory.length > this.MAX_GC_HISTORY) {
        this.gcHistory.shift();
      }
    }
    
    // Calculate GC metrics from history
    const oneHourAgo = currentTime - 3600000;
    const recentGC = this.gcHistory.filter(gc => gc.timestamp >= oneHourAgo);
    
    this.sparkMetrics.gcFrequency = recentGC.length;
    this.sparkMetrics.gcPauseTime = recentGC.reduce((sum, gc) => sum + gc.pauseTime, 0);
    
    if (recentGC.length > 0) {
      const latestGC = recentGC[recentGC.length - 1];
      this.sparkMetrics.memoryBeforeGC = latestGC.memoryBefore;
      this.sparkMetrics.memoryAfterGC = latestGC.memoryAfter;
    } else {
      // Use current memory if no recent GC
      this.sparkMetrics.memoryBeforeGC = memoryUsed;
      this.sparkMetrics.memoryAfterGC = memoryUsed;
    }
  }
  
  /**
   * Обновляет Network метрики
   */
  private updateNetworkMetrics(): void {
    const currentTime = Date.now();
    const timeDelta = (currentTime - this.lastNetworkUpdate) / 1000; // seconds
    this.lastNetworkUpdate = currentTime;
    
    // Total network I/O includes shuffle network I/O
    this.sparkMetrics.totalNetworkIO = 
      this.sparkMetrics.totalShuffleNetworkRead + 
      this.sparkMetrics.totalShuffleNetworkWrite;
    
    // Calculate network utilization (based on available bandwidth)
    const totalExecutors = this.sparkMetrics.aliveExecutors || 1;
    const networkBandwidthPerExecutor = 100 * 1024 * 1024; // 100 MB/s per executor
    const totalBandwidth = networkBandwidthPerExecutor * totalExecutors;
    const networkIOPS = this.sparkMetrics.totalNetworkIO / (timeDelta || 1); // bytes per second
    
    this.sparkMetrics.networkUtilization = Math.min(100, (networkIOPS / totalBandwidth) * 100);
    
    // Simulate network errors (rare, based on utilization)
    if (this.sparkMetrics.networkUtilization > 90 && Math.random() < 0.01) {
      this.sparkMetrics.networkErrors += 1;
    }
  }
  
  /**
   * Обновляет Disk метрики
   */
  private updateDiskMetrics(): void {
    const currentTime = Date.now();
    const timeDelta = (currentTime - this.lastDiskUpdate) / 1000; // seconds
    this.lastDiskUpdate = currentTime;
    
    // Disk I/O includes shuffle spill and storage operations
    const diskIO = this.sparkMetrics.totalShuffleSpillMemory + 
                   this.sparkMetrics.totalShuffleSpillDisk;
    
    // Calculate disk I/O rate
    this.sparkMetrics.diskIORate = diskIO / (timeDelta || 1); // bytes per second
    
    // Calculate disk utilization (based on total disk capacity)
    const allExecutors = Array.from(this.executors.values());
    const totalDiskCapacity = allExecutors.reduce((sum, e) => sum + e.diskMax, 0);
    const totalDiskUsed = allExecutors.reduce((sum, e) => sum + e.diskUsed, 0);
    
    if (totalDiskCapacity > 0) {
      this.sparkMetrics.diskUtilization = (totalDiskUsed / totalDiskCapacity) * 100;
    } else {
      this.sparkMetrics.diskUtilization = 0;
    }
    
    // Simulate disk errors (rare, based on utilization)
    if (this.sparkMetrics.diskUtilization > 95 && Math.random() < 0.005) {
      this.sparkMetrics.diskErrors += 1;
    }
  }
  
  /**
   * Обновляет JVM метрики
   */
  private updateJVMMetrics(): void {
    // Heap usage = total memory used
    this.sparkMetrics.heapUsage = this.sparkMetrics.totalMemoryUsed;
    
    // Non-heap usage (metaspace, code cache, etc.) - typically 10-20% of heap
    const nonHeapRatio = 0.15; // 15% of heap
    this.sparkMetrics.nonHeapUsage = this.sparkMetrics.totalMemory * nonHeapRatio;
    
    // Thread count (based on active jobs, stages, and executors)
    const baseThreads = 10; // Base threads (main, GC, etc.)
    const executorThreads = this.sparkMetrics.aliveExecutors * 2; // 2 threads per executor
    const jobThreads = this.sparkMetrics.activeJobs * 5; // 5 threads per active job
    const stageThreads = this.sparkMetrics.activeStages * 3; // 3 threads per active stage
    
    this.sparkMetrics.threadCount = baseThreads + executorThreads + jobThreads + stageThreads;
  }
  
  /**
   * Парсит строку памяти (например, "4g" -> 4096 MB)
   */
  private parseMemory(memoryStr: string): number {
    const match = memoryStr.match(/^(\d+)([kmg]?)$/i);
    if (!match) return 4096; // Default 4GB
    
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    
    switch (unit) {
      case 'k':
        return value / 1024; // KB to MB
      case 'm':
        return value; // MB
      case 'g':
        return value * 1024; // GB to MB
      default:
        return value; // Assume MB
    }
  }
  
  /**
   * Получает метрики
   */
  getMetrics(): SparkEngineMetrics {
    return { ...this.sparkMetrics };
  }
  
  /**
   * Получает все jobs
   */
  getJobs(): SparkJob[] {
    return Array.from(this.jobs.values());
  }
  
  /**
   * Получает все stages
   */
  getStages(): SparkStage[] {
    return Array.from(this.stages.values());
  }
  
  /**
   * Получает все executors
   */
  getExecutors(): SparkExecutor[] {
    return Array.from(this.executors.values());
  }
  
  /**
   * Получает job по ID
   */
  getJob(jobId: string): SparkJob | undefined {
    return this.jobs.get(jobId);
  }
  
  /**
   * Получает stages для job
   */
  getStagesForJob(jobId: string): SparkStage[] {
    return Array.from(this.stages.values()).filter(s => s.jobId === jobId);
  }
  
  /**
   * Получает DAG структуру для job (для визуализации)
   */
  getJobDAG(jobId: string): {
    stages: SparkStage[];
    edges: Array<{ from: string; to: string }>;
  } {
    const job = this.jobs.get(jobId);
    if (!job) {
      return { stages: [], edges: [] };
    }
    
    const stages = this.getStagesForJob(jobId);
    const edges: Array<{ from: string; to: string }> = [];
    
    for (const stage of stages) {
      if (stage.parentStageIds) {
        for (const parentId of stage.parentStageIds) {
          edges.push({ from: parentId, to: stage.id });
        }
      }
    }
    
    return { stages, edges };
  }
  
  /**
   * Добавляет новый job (для ручного создания)
   */
  addJob(job: SparkJob): void {
    this.jobs.set(job.id, job);
    if (job.status === 'RUNNING') {
      this.activeJobs.set(job.id, job);
    }
  }
  
  /**
   * Удаляет job
   */
  removeJob(jobId: string): void {
    this.jobs.delete(jobId);
    this.activeJobs.delete(jobId);
    
    // Remove associated stages
    const stagesToRemove = Array.from(this.stages.entries()).filter(([_, s]) => s.jobId === jobId);
    for (const [stageId, _] of stagesToRemove) {
      this.stages.delete(stageId);
      this.activeStages.delete(stageId);
    }
  }
  
  /**
   * Добавляет новый executor (для ручного создания)
   */
  addExecutor(executor: SparkExecutor): void {
    this.executors.set(executor.id, executor);
    this.executorHeartbeatInterval.set(executor.id, 3000 + Math.random() * 2000);
  }
  
  /**
   * Удаляет executor
   */
  removeExecutor(executorId: string): void {
    const executor = this.executors.get(executorId);
    if (executor) {
      executor.status = 'DEAD';
    }
    this.executorHeartbeatInterval.delete(executorId);
  }
  
  /**
   * Выполняет SQL query с симуляцией query planning и execution
   */
  executeSQL(query: string, currentTime: number = Date.now()): SparkSQLQuery {
    const queryId = `sql-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate execution plans
    const logicalPlan = this.generateLogicalPlan(query);
    const physicalPlan = this.generatePhysicalPlan(query);
    const explainPlan = this.generateExplainPlan(query, logicalPlan, physicalPlan);
    
    // Estimate execution time and rows
    const estimatedRows = this.estimateQueryRows(query);
    const estimatedDuration = this.estimateQueryDuration(query, estimatedRows);
    
    // Create a job for this SQL query
    const jobId = `job-${queryId}`;
    const job: SparkJob = {
      id: jobId,
      name: `SQL Query: ${query.substring(0, 50)}...`,
      status: 'RUNNING',
      startTime: currentTime,
      stages: this.estimateQueryStages(query),
      tasks: this.estimateQueryTasks(query, estimatedRows),
      executors: this.executors.size,
      inputBytes: estimatedRows * 1024, // Assume 1KB per row
      outputBytes: estimatedRows * 512, // Assume 0.5KB per output row
      shuffleRead: estimatedRows * 256, // Shuffle operations
      shuffleWrite: estimatedRows * 256,
      submissionTime: currentTime,
    };
    
    this.jobs.set(jobId, job);
    this.activeJobs.set(jobId, job);
    
    // Create stages for SQL query
    const stageIds: string[] = [];
    for (let i = 0; i < job.stages; i++) {
      const stageId = `stage-${jobId}-${i}`;
      stageIds.push(stageId);
      
      const stage: SparkStage = {
        id: stageId,
        jobId: jobId,
        name: `SQL Stage ${i + 1}`,
        status: i === 0 ? 'ACTIVE' : 'SKIPPED',
        numTasks: Math.floor(job.tasks / job.stages),
        numActiveTasks: i === 0 ? Math.floor(job.tasks / job.stages) : 0,
        numCompleteTasks: 0,
        numFailedTasks: 0,
        inputBytes: job.inputBytes / job.stages,
        outputBytes: job.outputBytes / job.stages,
        shuffleRead: job.shuffleRead / job.stages,
        shuffleWrite: job.shuffleWrite / job.stages,
        duration: 0,
        submissionTime: i === 0 ? currentTime : undefined,
        parentStageIds: i > 0 ? [stageIds[i - 1]] : undefined,
        childStageIds: i < job.stages - 1 ? [stageIds[i + 1]] : undefined,
        stageType: i === 0 ? 'map' : i === job.stages - 1 ? 'action' : 'shuffle',
        shuffleNetworkRead: 0,
        shuffleNetworkWrite: 0,
        shuffleSpillMemory: 0,
        shuffleSpillDisk: 0,
        shuffleFetchWaitTime: 0,
      };
      
      this.stages.set(stageId, stage);
      if (stage.status === 'ACTIVE') {
        this.activeStages.set(stageId, stage);
      }
    }
    
    const sqlQuery: SparkSQLQuery = {
      id: queryId,
      query,
      status: 'RUNNING',
      startTime: currentTime,
      executionTime: estimatedDuration,
      rowsProcessed: 0,
      explainPlan,
      physicalPlan,
      logicalPlan,
      stages: stageIds,
      jobId,
    };
    
    this.sqlQueries.set(queryId, sqlQuery);
    this.activeSqlQueries.set(queryId, sqlQuery);
    
    return sqlQuery;
  }
  
  /**
   * Генерирует logical plan для SQL query
   */
  private generateLogicalPlan(query: string): string {
    const upperQuery = query.toUpperCase().trim();
    
    if (upperQuery.startsWith('SELECT')) {
      return `== Logical Plan ==
Project [columns]
+- Filter [conditions]
   +- Relation [table]
`;
    } else if (upperQuery.startsWith('INSERT')) {
      return `== Logical Plan ==
InsertIntoTable [target]
+- Project [columns]
   +- Relation [source]
`;
    } else if (upperQuery.startsWith('CREATE TABLE')) {
      return `== Logical Plan ==
CreateTable [table]
+- Relation [schema]
`;
    } else {
      return `== Logical Plan ==
UnresolvedRelation [table]
`;
    }
  }
  
  /**
   * Генерирует physical plan для SQL query
   */
  private generatePhysicalPlan(query: string): string {
    const upperQuery = query.toUpperCase().trim();
    const hasJoin = upperQuery.includes('JOIN');
    const hasGroupBy = upperQuery.includes('GROUP BY');
    const hasOrderBy = upperQuery.includes('ORDER BY');
    
    let plan = `== Physical Plan ==
*Project [columns]
`;
    
    if (hasOrderBy) {
      plan += `+- *Sort [order]
`;
    }
    
    if (hasGroupBy) {
      plan += `+- *HashAggregate [grouping]
`;
    }
    
    if (hasJoin) {
      plan += `+- *BroadcastHashJoin [join]
   :- *Project [left]
   :  +- *Scan [leftTable]
   +- *Project [right]
      +- *Scan [rightTable]
`;
    } else {
      plan += `+- *Scan [table]
`;
    }
    
    return plan;
  }
  
  /**
   * Генерирует explain plan (комбинация logical и physical)
   */
  private generateExplainPlan(query: string, logicalPlan: string, physicalPlan: string): string {
    return `${logicalPlan}\n${physicalPlan}`;
  }
  
  /**
   * Оценивает количество строк для query
   */
  private estimateQueryRows(query: string): number {
    const upperQuery = query.toUpperCase();
    let baseRows = 10000;
    
    // Adjust based on query complexity
    if (upperQuery.includes('WHERE')) baseRows *= 0.5; // Filter reduces rows
    if (upperQuery.includes('JOIN')) baseRows *= 2; // Join increases rows
    if (upperQuery.includes('GROUP BY')) baseRows *= 0.3; // Group by reduces rows
    if (upperQuery.includes('LIMIT')) baseRows = Math.min(baseRows, 1000); // Limit caps rows
    
    return Math.floor(baseRows * (0.5 + Math.random()));
  }
  
  /**
   * Оценивает длительность выполнения query
   */
  private estimateQueryDuration(query: string, estimatedRows: number): number {
    const baseDuration = 1000; // 1 second base
    const rowsPerSecond = 10000; // Process 10k rows per second
    const duration = baseDuration + (estimatedRows / rowsPerSecond) * 1000;
    
    // Add variation
    return Math.floor(duration * (0.8 + Math.random() * 0.4));
  }
  
  /**
   * Оценивает количество stages для query
   */
  private estimateQueryStages(query: string): number {
    const upperQuery = query.toUpperCase();
    let stages = 2; // Base: map + action
    
    if (upperQuery.includes('JOIN')) stages += 1; // Join adds shuffle stage
    if (upperQuery.includes('GROUP BY')) stages += 1; // Group by adds shuffle stage
    if (upperQuery.includes('ORDER BY')) stages += 1; // Order by adds sort stage
    
    return Math.min(stages, 7); // Max 7 stages
  }
  
  /**
   * Оценивает количество tasks для query
   */
  private estimateQueryTasks(query: string, estimatedRows: number): number {
    const tasksPer10kRows = 10;
    const baseTasks = Math.ceil((estimatedRows / 10000) * tasksPer10kRows);
    return Math.max(10, Math.min(baseTasks, 200)); // Between 10 and 200 tasks
  }
  
  /**
   * Обновляет статус SQL query (вызывается периодически)
   */
  updateSQLQuery(queryId: string, currentTime: number): void {
    const query = this.sqlQueries.get(queryId);
    if (!query || query.status !== 'RUNNING') return;
    
    const elapsed = currentTime - (query.startTime || currentTime);
    const estimatedDuration = query.executionTime || 5000;
    
    if (elapsed >= estimatedDuration) {
      // Query completed
      const shouldFail = Math.random() < 0.05; // 5% failure rate
      
      if (shouldFail) {
        query.status = 'FAILED';
      } else {
        query.status = 'SUCCEEDED';
        query.rowsProcessed = this.estimateQueryRows(query.query);
      }
      
      query.endTime = currentTime;
      query.executionTime = elapsed;
      
      // Update associated job
      if (query.jobId) {
        const job = this.jobs.get(query.jobId);
        if (job) {
          job.status = query.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED';
          job.endTime = currentTime;
          job.completionTime = currentTime;
          job.duration = elapsed;
        }
      }
      
      this.activeSqlQueries.delete(queryId);
    } else {
      // Update progress
      const progress = Math.min(1, elapsed / estimatedDuration);
      query.rowsProcessed = Math.floor(this.estimateQueryRows(query.query) * progress);
    }
  }
  
  /**
   * Получает все SQL queries
   */
  getSQLQueries(): SparkSQLQuery[] {
    return Array.from(this.sqlQueries.values());
  }
  
  /**
   * Получает SQL query по ID
   */
  getSQLQuery(queryId: string): SparkSQLQuery | undefined {
    return this.sqlQueries.get(queryId);
  }
  
  /**
   * Создает новый streaming job
   */
  createStreamingJob(name: string, batchInterval: number, currentTime: number = Date.now()): SparkStreamingJob {
    const streamingJobId = `streaming-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const streamingJob: SparkStreamingJob = {
      id: streamingJobId,
      name,
      status: 'ACTIVE',
      batchInterval,
      startTime: currentTime,
      lastBatchTime: currentTime,
      nextBatchTime: currentTime + batchInterval,
      totalBatches: 0,
      processedBatches: 0,
      failedBatches: 0,
      totalRecordsProcessed: 0,
      averageProcessingTime: batchInterval * 0.8, // 80% of batch interval
      checkpointDirectory: this.config?.checkpointDirectory || '/checkpoint',
      backpressureEnabled: true,
      currentBackpressure: 0,
    };
    
    this.streamingJobs.set(streamingJobId, streamingJob);
    this.activeStreamingJobs.set(streamingJobId, streamingJob);
    
    return streamingJob;
  }
  
  /**
   * Обновляет streaming jobs (обрабатывает batches)
   */
  private updateStreamingJobs(currentTime: number): void {
    if (!this.config?.enableStreaming) return;
    
    const streamingJobsToProcess = Array.from(this.activeStreamingJobs.entries());
    
    for (const [streamingJobId, streamingJob] of streamingJobsToProcess) {
      if (streamingJob.status !== 'ACTIVE') {
        this.activeStreamingJobs.delete(streamingJobId);
        continue;
      }
      
      // Check if it's time for next batch
      if (streamingJob.nextBatchTime && currentTime >= streamingJob.nextBatchTime) {
        this.processStreamingBatch(streamingJobId, currentTime);
      }
      
      // Update backpressure
      this.updateBackpressure(streamingJobId, currentTime);
      
      // Perform checkpoint if needed
      if (this.config.enableCheckpointing) {
        this.performCheckpoint(streamingJobId, currentTime);
      }
    }
  }
  
  /**
   * Обрабатывает один batch для streaming job
   */
  private processStreamingBatch(streamingJobId: string, currentTime: number): void {
    const streamingJob = this.streamingJobs.get(streamingJobId);
    if (!streamingJob || streamingJob.status !== 'ACTIVE') return;
    
    // Check backpressure - if too high, skip batch
    if (streamingJob.backpressureEnabled && streamingJob.currentBackpressure > 0.8) {
      // High backpressure - delay batch
      streamingJob.nextBatchTime = currentTime + streamingJob.batchInterval * 0.5; // Delay by 50%
      return;
    }
    
    streamingJob.totalBatches++;
    streamingJob.lastBatchTime = currentTime;
    
    // Simulate batch processing
    const batchProcessingTime = streamingJob.batchInterval * (0.5 + Math.random() * 0.5); // 50-100% of interval
    const recordsInBatch = Math.floor(1000 + Math.random() * 9000); // 1k-10k records per batch
    
    // Check if batch fails (5% failure rate)
    const shouldFail = Math.random() < 0.05;
    
    if (shouldFail) {
      streamingJob.failedBatches++;
      streamingJob.status = 'FAILED';
      this.activeStreamingJobs.delete(streamingJobId);
    } else {
      streamingJob.processedBatches++;
      streamingJob.totalRecordsProcessed += recordsInBatch;
      
      // Update average processing time
      streamingJob.averageProcessingTime = 
        (streamingJob.averageProcessingTime * (streamingJob.processedBatches - 1) + batchProcessingTime) / 
        streamingJob.processedBatches;
      
      // Create a batch job for this streaming batch
      const batchJobId = `batch-${streamingJobId}-${streamingJob.totalBatches}`;
      const batchJob: SparkJob = {
        id: batchJobId,
        name: `${streamingJob.name} - Batch ${streamingJob.totalBatches}`,
        status: 'RUNNING',
        startTime: currentTime,
        stages: 2 + Math.floor(Math.random() * 3), // 2-4 stages
        tasks: 10 + Math.floor(Math.random() * 40), // 10-50 tasks
        executors: this.executors.size,
        inputBytes: recordsInBatch * 1024, // 1KB per record
        outputBytes: recordsInBatch * 512, // 0.5KB per output record
        shuffleRead: recordsInBatch * 256,
        shuffleWrite: recordsInBatch * 256,
        submissionTime: currentTime,
      };
      
      this.jobs.set(batchJobId, batchJob);
      this.activeJobs.set(batchJobId, batchJob);
      streamingJob.jobId = batchJobId;
      
      // Schedule next batch
      streamingJob.nextBatchTime = currentTime + streamingJob.batchInterval;
    }
  }
  
  /**
   * Обновляет backpressure для streaming job
   */
  private updateBackpressure(streamingJobId: string, currentTime: number): void {
    const streamingJob = this.streamingJobs.get(streamingJobId);
    if (!streamingJob || !streamingJob.backpressureEnabled) return;
    
    // Calculate backpressure based on processing time vs batch interval
    const processingRatio = streamingJob.averageProcessingTime / streamingJob.batchInterval;
    
    // If processing takes longer than batch interval, we have backpressure
    if (processingRatio > 1.0) {
      streamingJob.currentBackpressure = Math.min(1.0, (processingRatio - 1.0) * 0.5); // Scale to 0-1
    } else {
      // No backpressure if processing is faster than batch interval
      streamingJob.currentBackpressure = Math.max(0, streamingJob.currentBackpressure - 0.1); // Gradually decrease
    }
    
    // Also consider active jobs count
    const activeJobsCount = this.activeJobs.size;
    const maxConcurrentJobs = 5;
    if (activeJobsCount >= maxConcurrentJobs) {
      streamingJob.currentBackpressure = Math.min(1.0, streamingJob.currentBackpressure + 0.2);
    }
  }
  
  /**
   * Выполняет checkpoint для streaming job
   */
  private performCheckpoint(streamingJobId: string, currentTime: number): void {
    const streamingJob = this.streamingJobs.get(streamingJobId);
    if (!streamingJob || !this.config?.enableCheckpointing) return;
    
    // Checkpoint every CHECKPOINT_INTERVAL
    if (currentTime - this.lastStreamingCheckpoint >= this.CHECKPOINT_INTERVAL) {
      // Simulate checkpoint save
      // In real Spark, this would save state to checkpoint directory
      this.lastStreamingCheckpoint = currentTime;
      
      // Checkpoint success/failure (1% failure rate)
      const checkpointFails = Math.random() < 0.01;
      if (checkpointFails) {
        // Checkpoint failure - streaming job might need to recover
        streamingJob.status = 'FAILED';
        this.activeStreamingJobs.delete(streamingJobId);
      }
    }
  }
  
  /**
   * Получает все streaming jobs
   */
  getStreamingJobs(): SparkStreamingJob[] {
    return Array.from(this.streamingJobs.values());
  }
  
  /**
   * Получает streaming job по ID
   */
  getStreamingJob(streamingJobId: string): SparkStreamingJob | undefined {
    return this.streamingJobs.get(streamingJobId);
  }
  
  /**
   * Останавливает streaming job
   */
  stopStreamingJob(streamingJobId: string): void {
    const streamingJob = this.streamingJobs.get(streamingJobId);
    if (streamingJob) {
      streamingJob.status = 'STOPPED';
      this.activeStreamingJobs.delete(streamingJobId);
    }
  }
  
  /**
   * Инициализирует streaming job при включении streaming
   */
  initializeStreamingJob(currentTime: number): void {
    if (!this.config?.enableStreaming) return;
    
    // Check if streaming job already exists
    const existingStreamingJobs = Array.from(this.streamingJobs.values());
    if (existingStreamingJobs.some(sj => sj.status === 'ACTIVE')) {
      return; // Already has active streaming job
    }
    
    // Create default streaming job
    const batchInterval = this.config.streamingBatchInterval || 1000;
    this.createStreamingJob('Spark Streaming Job', batchInterval, currentTime);
  }
}

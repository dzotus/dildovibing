import { CanvasNode } from '@/types';
import { ComponentMetrics } from './EmulationEngine';

/**
 * GitLab CI Job Status
 */
export type JobStatus = 'created' | 'pending' | 'running' | 'success' | 'failed' | 'canceled' | 'skipped' | 'manual';

/**
 * GitLab CI Stage Status
 */
export type StageStatus = 'pending' | 'running' | 'success' | 'failed' | 'canceled' | 'skipped';

/**
 * GitLab CI Pipeline Status
 */
export type PipelineStatus = 'created' | 'waiting_for_resource' | 'preparing' | 'pending' | 'running' | 'success' | 'failed' | 'canceled' | 'skipped' | 'manual' | 'scheduled';

/**
 * GitLab CI Job
 */
export interface GitLabCIJob {
  id: string;
  name: string;
  stage: string;
  status: JobStatus;
  pipelineId: string;
  startTime?: number;
  duration?: number;
  estimatedDuration?: number;
  progress?: number; // 0-100
  runnerId?: string;
  logs?: string[];
  artifacts?: string[];
  variables?: Record<string, string>;
  when?: 'on_success' | 'on_failure' | 'always' | 'manual';
  allowFailure?: boolean;
  retry?: number;
  maxRetries?: number;
  tags?: string[];
  image?: string;
  services?: string[];
  script?: string[];
  beforeScript?: string[];
  afterScript?: string[];
  cache?: {
    key?: string;
    paths?: string[];
  };
}

/**
 * GitLab CI Stage
 */
export interface GitLabCIStage {
  name: string;
  status: StageStatus;
  jobs: GitLabCIJob[];
  startTime?: number;
  duration?: number;
}

/**
 * GitLab CI Pipeline
 */
export interface GitLabCIPipeline {
  id: string;
  iid: number; // Internal ID (project-level)
  status: PipelineStatus;
  ref: string; // Branch or tag
  sha?: string; // Commit SHA
  source: 'push' | 'web' | 'trigger' | 'schedule' | 'api' | 'external' | 'chat' | 'webide' | 'merge_request_event' | 'external_pull_request_event' | 'parent_pipeline';
  stages: GitLabCIStage[];
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  finishedAt?: number;
  duration?: number;
  queuedDuration?: number;
  coverage?: number; // Code coverage percentage
  webUrl?: string;
  user?: {
    id: string;
    name: string;
    username: string;
  };
  variables?: Record<string, string>;
  beforeYaml?: string; // .gitlab-ci.yml content
}

/**
 * GitLab CI Runner
 */
export interface GitLabCIRunner {
  id: string;
  name: string;
  description?: string;
  status: 'online' | 'offline' | 'paused' | 'not_connected';
  runnerType: 'instance_type' | 'group_type' | 'project_type';
  executor: 'docker' | 'kubernetes' | 'shell' | 'docker-ssh' | 'ssh' | 'parallels' | 'virtualbox' | 'docker+machine' | 'docker-ssh+machine' | 'custom';
  platform?: string; // linux, windows, osx
  architecture?: string; // amd64, arm64, etc.
  active: boolean;
  isShared: boolean;
  locked: boolean;
  maximumTimeout?: number;
  tagList?: string[];
  runUntagged: boolean;
  accessLevel: 'not_protected' | 'ref_protected';
  jobsCount?: number;
  contactedAt?: number;
  version?: string;
  revision?: string;
  ipAddress?: string;
  token?: string; // Registration token
  // Runtime state
  currentJobs: number;
  maxJobs: number;
  busy: boolean;
}

/**
 * GitLab CI Variable
 */
export interface GitLabCIVariable {
  key: string;
  value: string;
  variableType: 'env_var' | 'file';
  protected: boolean;
  masked: boolean;
  raw: boolean;
  environmentScope?: string; // '*' for all, or specific environment
}

/**
 * GitLab CI Cache Configuration
 */
export interface GitLabCICache {
  key: string;
  paths: string[];
  policy: 'pull-push' | 'pull' | 'push';
  when?: 'on_success' | 'on_failure' | 'always';
}

/**
 * GitLab CI Artifact
 */
export interface GitLabCIArtifact {
  id: string;
  jobId: string;
  pipelineId: string;
  name: string;
  size: number;
  fileType: string;
  filename: string;
  createdAt: number;
  expiresAt?: number;
}

/**
 * GitLab CI Environment
 */
export interface GitLabCIEnvironment {
  id: string;
  name: string;
  slug: string;
  externalUrl?: string;
  state: 'available' | 'stopped';
  deployments?: Array<{
    id: string;
    status: 'created' | 'running' | 'success' | 'failed' | 'canceled';
    createdAt: number;
    finishedAt?: number;
    user?: {
      id: string;
      name: string;
    };
  }>;
}

/**
 * GitLab CI Schedule
 */
export interface GitLabCISchedule {
  id: string;
  description: string;
  ref: string; // Branch or tag
  cron: string; // Cron expression
  cronTimezone?: string;
  active: boolean;
  nextRunAt?: number;
  lastRunPipelineId?: string;
  variables?: Record<string, string>;
}

/**
 * GitLab CI Configuration
 */
export interface GitLabCIEmulationConfig {
  gitlabUrl?: string;
  projectId?: string;
  projectUrl?: string;
  enableRunners?: boolean;
  runnerType?: 'docker' | 'kubernetes' | 'shell';
  concurrentJobs?: number; // Per runner
  enableCache?: boolean;
  cacheType?: 's3' | 'gcs' | 'local';
  enableArtifacts?: boolean;
  artifactsExpiry?: string; // e.g., '7d', '30d'
  enableKubernetes?: boolean;
  k8sNamespace?: string;
  pipelines?: Array<{
    id: string;
    ref?: string;
    status?: PipelineStatus;
    source?: 'push' | 'web' | 'trigger' | 'schedule' | 'api';
    stages?: Array<{
      name: string;
      jobs?: Array<{
        name: string;
        stage: string;
        script?: string[];
        image?: string;
        tags?: string[];
        when?: 'on_success' | 'on_failure' | 'always' | 'manual';
        allowFailure?: boolean;
      }>;
    }>;
  }>;
  runners?: Array<{
    id: string;
    name: string;
    executor?: 'docker' | 'kubernetes' | 'shell';
    maxJobs?: number;
    tags?: string[];
    isShared?: boolean;
  }>;
  variables?: Array<{
    key: string;
    value: string;
    protected?: boolean;
    masked?: boolean;
    environmentScope?: string;
  }>;
  environments?: Array<{
    id: string;
    name: string;
    externalUrl?: string;
  }>;
  schedules?: Array<{
    id: string;
    description: string;
    ref: string;
    cron: string;
    active?: boolean;
    variables?: Record<string, string>;
  }>;
  pipelineTriggerRate?: number; // pipelines per hour
  averagePipelineDuration?: number; // milliseconds
  averageJobDuration?: number; // milliseconds
  failureRate?: number; // 0-1
  cacheHitRate?: number; // 0-1
}

/**
 * GitLab CI Engine Metrics
 */
export interface GitLabCIEngineMetrics {
  pipelinesTotal: number;
  pipelinesSuccess: number;
  pipelinesFailed: number;
  pipelinesRunning: number;
  pipelinesPending: number;
  pipelinesPerHour: number;
  averagePipelineDuration: number;
  jobsTotal: number;
  jobsSuccess: number;
  jobsFailed: number;
  jobsRunning: number;
  jobsPending: number;
  averageJobDuration: number;
  runnersTotal: number;
  runnersOnline: number;
  runnersBusy: number;
  runnersIdle: number;
  runnerUtilization: number; // 0-100
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number; // 0-1
  artifactsTotal: number;
  artifactsSizeBytes: number;
  requestsTotal: number;
  requestsErrors: number;
  coverage?: number; // Average code coverage
}

/**
 * GitLab CI Emulation Engine
 * Симулирует работу GitLab CI/CD: pipelines, jobs, runners, stages, artifacts, cache
 */
export class GitLabCIEmulationEngine {
  private config: GitLabCIEmulationConfig | null = null;
  
  // Pipelines
  private pipelines: Map<string, GitLabCIPipeline> = new Map();
  
  // Active jobs
  private activeJobs: Map<string, GitLabCIJob> = new Map();
  
  // Runners
  private runners: Map<string, GitLabCIRunner> = new Map();
  
  // Variables
  private variables: Map<string, GitLabCIVariable> = new Map();
  
  // Environments
  private environments: Map<string, GitLabCIEnvironment> = new Map();
  
  // Schedules
  private schedules: Map<string, GitLabCISchedule> = new Map();
  
  // Artifacts
  private artifacts: Map<string, GitLabCIArtifact> = new Map();
  
  // Cache entries (simulated)
  private cacheEntries: Map<string, { key: string; size: number; createdAt: number; lastAccessed: number }> = new Map();
  
  // Metrics
  private gitlabMetrics: GitLabCIEngineMetrics = {
    pipelinesTotal: 0,
    pipelinesSuccess: 0,
    pipelinesFailed: 0,
    pipelinesRunning: 0,
    pipelinesPending: 0,
    pipelinesPerHour: 0,
    averagePipelineDuration: 0,
    jobsTotal: 0,
    jobsSuccess: 0,
    jobsFailed: 0,
    jobsRunning: 0,
    jobsPending: 0,
    averageJobDuration: 0,
    runnersTotal: 0,
    runnersOnline: 0,
    runnersBusy: 0,
    runnersIdle: 0,
    runnerUtilization: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheHitRate: 0,
    artifactsTotal: 0,
    artifactsSizeBytes: 0,
    requestsTotal: 0,
    requestsErrors: 0,
  };
  
  // Pipeline history for metrics
  private pipelineHistory: Array<{ timestamp: number; duration: number; status: PipelineStatus }> = [];
  private readonly MAX_PIPELINE_HISTORY = 1000;
  
  // Job history for metrics
  private jobHistory: Array<{ timestamp: number; duration: number; status: JobStatus }> = [];
  private readonly MAX_JOB_HISTORY = 5000;
  
  // Pipeline trigger timing
  private lastPipelineTrigger: Map<string, number> = new Map();
  private pipelineIidCounter: number = 0;
  
  // Schedule tracking
  private scheduleLastRun: Map<string, number> = new Map();
  
  /**
   * Обрабатывает входящий запрос (webhook, API)
   */
  processRequest(success: boolean = true): void {
    this.gitlabMetrics.requestsTotal++;
    if (!success) {
      this.gitlabMetrics.requestsErrors++;
    }
  }
  
  /**
   * Инициализирует конфигурацию GitLab CI из конфига компонента
   */
  initializeConfig(node: CanvasNode): void {
    const config = node.data.config || {};
    
    // Handle runners: if it's a number, create default runners array
    let runners = config.runners;
    if (typeof runners === 'number') {
      // If runners is a number, create that many default runners
      runners = Array.from({ length: runners }, (_, i) => ({
        id: `runner-${i + 1}`,
        name: `docker-runner-${i + 1}`,
        executor: config.runnerType || 'docker',
        maxJobs: config.concurrentJobs || 4,
        tags: [],
        isShared: false,
      }));
    } else if (!Array.isArray(runners)) {
      runners = [];
    }
    
    this.config = {
      gitlabUrl: config.gitlabUrl || 'https://gitlab.com',
      projectId: config.projectId || '1',
      projectUrl: config.projectUrl || 'https://gitlab.com/archiphoenix/project',
      enableRunners: config.enableRunners ?? true,
      runnerType: config.runnerType || 'docker',
      concurrentJobs: config.concurrentJobs || 4,
      enableCache: config.enableCache ?? true,
      cacheType: config.cacheType || 's3',
      enableArtifacts: config.enableArtifacts ?? true,
      artifactsExpiry: config.artifactsExpiry || '7d',
      enableKubernetes: config.enableKubernetes ?? false,
      k8sNamespace: config.k8sNamespace || 'gitlab-runner',
      pipelines: Array.isArray(config.pipelines) ? config.pipelines : [],
      runners: runners,
      variables: Array.isArray(config.variables) ? config.variables : [],
      environments: Array.isArray(config.environments) ? config.environments : [],
      schedules: Array.isArray(config.schedules) ? config.schedules : [],
      pipelineTriggerRate: config.pipelineTriggerRate || 2, // 2 pipelines per hour per pipeline config
      averagePipelineDuration: config.averagePipelineDuration || 300000, // 5 minutes
      averageJobDuration: config.averageJobDuration || 60000, // 1 minute
      failureRate: config.failureRate || 0.1, // 10% failure rate
      cacheHitRate: config.cacheHitRate || 0.7, // 70% cache hit rate
    };
    
    // Initialize pipelines
    this.initializePipelines();
    
    // Initialize runners
    this.initializeRunners();
    
    // Initialize variables
    this.initializeVariables();
    
    // Initialize environments
    this.initializeEnvironments();
    
    // Initialize schedules
    this.initializeSchedules();
  }
  
  /**
   * Инициализирует pipelines из конфига
   */
  private initializePipelines(): void {
    this.pipelines.clear();
    
    const configPipelines = Array.isArray(this.config?.pipelines) ? this.config.pipelines : [];
    
    for (const pipelineConfig of configPipelines) {
      const pipelineId = pipelineConfig.id;
      const stages = Array.isArray(pipelineConfig.stages) ? pipelineConfig.stages : [
        { name: 'build', jobs: [{ name: 'build', stage: 'build' }] },
        { name: 'test', jobs: [{ name: 'test', stage: 'test' }] },
        { name: 'deploy', jobs: [{ name: 'deploy', stage: 'deploy' }] },
      ];
      
      const gitlabStages: GitLabCIStage[] = stages.map(stage => ({
        name: stage.name,
        status: 'pending',
        jobs: Array.isArray(stage.jobs) ? stage.jobs.map(job => ({
          id: `${pipelineId}-${stage.name}-${job.name}`,
          name: job.name,
          stage: stage.name,
          status: 'created',
          pipelineId,
          when: job.when || 'on_success',
          allowFailure: job.allowFailure || false,
          tags: Array.isArray(job.tags) ? job.tags : [],
          image: job.image,
          script: Array.isArray(job.script) ? job.script : [`echo "Running ${job.name}"`],
        })) : [],
      }));
      
      const pipeline: GitLabCIPipeline = {
        id: pipelineId,
        iid: ++this.pipelineIidCounter,
        status: 'created',
        ref: pipelineConfig.ref || 'main',
        source: pipelineConfig.source || 'push',
        stages: gitlabStages,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        variables: {},
      };
      
      this.pipelines.set(pipelineId, pipeline);
    }
  }
  
  /**
   * Инициализирует runners из конфига
   */
  private initializeRunners(): void {
    this.runners.clear();
    
    const configRunners = Array.isArray(this.config?.runners) ? this.config.runners : [];
    
    // Default runner if none configured
    if (configRunners.length === 0 && this.config?.enableRunners) {
      const defaultRunner: GitLabCIRunner = {
        id: 'default-runner-1',
        name: 'docker-runner-1',
        status: 'online',
        runnerType: 'project_type',
        executor: this.config.runnerType || 'docker',
        active: true,
        isShared: false,
        locked: false,
        runUntagged: true,
        accessLevel: 'not_protected',
        currentJobs: 0,
        maxJobs: this.config.concurrentJobs || 4,
        busy: false,
        platform: 'linux',
        architecture: 'amd64',
        contactedAt: Date.now(),
      };
      this.runners.set(defaultRunner.id, defaultRunner);
      return;
    }
    
    for (const runnerConfig of configRunners) {
      const runner: GitLabCIRunner = {
        id: runnerConfig.id,
        name: runnerConfig.name,
        status: 'online',
        runnerType: 'project_type',
        executor: runnerConfig.executor || this.config?.runnerType || 'docker',
        active: true,
        isShared: runnerConfig.isShared ?? false,
        locked: false,
        runUntagged: true,
        accessLevel: 'not_protected',
        tagList: runnerConfig.tags || [],
        currentJobs: 0,
        maxJobs: runnerConfig.maxJobs || this.config?.concurrentJobs || 4,
        busy: false,
        platform: 'linux',
        architecture: 'amd64',
        contactedAt: Date.now(),
      };
      
      this.runners.set(runner.id, runner);
    }
  }
  
  /**
   * Инициализирует variables из конфига
   */
  private initializeVariables(): void {
    this.variables.clear();
    
    const configVariables = Array.isArray(this.config?.variables) ? this.config.variables : [];
    
    for (const varConfig of configVariables) {
      const variable: GitLabCIVariable = {
        key: varConfig.key,
        value: varConfig.value,
        variableType: 'env_var',
        protected: varConfig.protected ?? false,
        masked: varConfig.masked ?? false,
        raw: false,
        environmentScope: varConfig.environmentScope || '*',
      };
      
      this.variables.set(varConfig.key, variable);
    }
  }
  
  /**
   * Инициализирует environments из конфига
   */
  private initializeEnvironments(): void {
    this.environments.clear();
    
    const configEnvironments = Array.isArray(this.config?.environments) ? this.config.environments : [];
    
    for (const envConfig of configEnvironments) {
      const environment: GitLabCIEnvironment = {
        id: envConfig.id,
        name: envConfig.name,
        slug: envConfig.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        externalUrl: envConfig.externalUrl,
        state: 'available',
        deployments: [],
      };
      
      this.environments.set(envConfig.id, environment);
    }
  }
  
  /**
   * Инициализирует schedules из конфига
   */
  private initializeSchedules(): void {
    this.schedules.clear();
    
    const configSchedules = Array.isArray(this.config?.schedules) ? this.config.schedules : [];
    
    for (const scheduleConfig of configSchedules) {
      const schedule: GitLabCISchedule = {
        id: scheduleConfig.id,
        description: scheduleConfig.description,
        ref: scheduleConfig.ref,
        cron: scheduleConfig.cron,
        active: scheduleConfig.active !== false,
        variables: scheduleConfig.variables || {},
      };
      
      // Calculate next run time (simplified)
      schedule.nextRunAt = this.calculateNextRunTime(schedule.cron);
      
      this.schedules.set(scheduleConfig.id, schedule);
    }
  }
  
  /**
   * Вычисляет следующее время запуска по cron выражению (упрощенная версия)
   */
  private calculateNextRunTime(cron: string): number {
    // Упрощенная реализация - в реальности нужен парсер cron
    // Для демонстрации: если cron содержит "0 * * * *" (каждый час), возвращаем час от now
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    return now + oneHour;
  }
  
  /**
   * Выполняет один цикл обновления GitLab CI
   * Должен вызываться периодически в EmulationEngine
   */
  performUpdate(currentTime: number): void {
    if (!this.config) return;
    
    // Update active jobs
    this.updateActiveJobs(currentTime);
    
    // Update active pipelines
    this.updateActivePipelines(currentTime);
    
    // Trigger new pipelines based on rate and schedules
    this.triggerPipelines(currentTime);
    
    // Check scheduled pipelines
    this.checkSchedules(currentTime);
    
    // Cleanup old artifacts
    if (this.config.enableArtifacts) {
      this.cleanupArtifacts(currentTime);
    }
    
    // Update metrics
    this.updateMetrics();
  }
  
  /**
   * Обновляет активные jobs
   */
  private updateActiveJobs(currentTime: number): void {
    const jobsToProcess = Array.from(this.activeJobs.entries());
    
    for (const [jobId, job] of jobsToProcess) {
      if (job.status !== 'running') continue;
      
      try {
        if (!job.startTime) {
          job.startTime = currentTime;
          continue;
        }
        
        const elapsed = currentTime - job.startTime;
        const estimatedDuration = job.estimatedDuration || this.config?.averageJobDuration || 60000;
        
        if (elapsed < 0) continue;
        
        // Calculate progress
        job.progress = Math.min(100, Math.max(0, Math.floor((elapsed / estimatedDuration) * 100)));
        
        // Update logs periodically
        if (elapsed % 5000 < 100 && job.logs) {
          this.updateJobLogs(job, elapsed, estimatedDuration);
        }
        
        // Check if job should complete
        if (elapsed >= estimatedDuration) {
          // Determine success/failure based on failure rate
          const shouldFail = Math.random() < (this.config?.failureRate || 0.1);
          job.status = shouldFail ? 'failed' : 'success';
          job.duration = elapsed;
          job.progress = 100;
          
          // Add final logs
          if (job.logs) {
            if (shouldFail) {
              job.logs.push(`Job ${job.name} failed after ${(elapsed / 1000).toFixed(1)}s`);
            } else {
              job.logs.push(`Job ${job.name} succeeded in ${(elapsed / 1000).toFixed(1)}s`);
            }
          }
          
          // Generate artifacts if job succeeded
          if (job.status === 'success' && this.config?.enableArtifacts) {
            this.generateJobArtifacts(job, currentTime);
          }
          
          // Free runner
          this.freeRunner(job.runnerId);
          job.runnerId = undefined;
          
          // Update pipeline stage
          this.updatePipelineStage(job);
          
          // Add to history
          this.addJobToHistory(job);
          
          // Remove from active jobs
          this.activeJobs.delete(jobId);
        }
      } catch (error) {
        console.error(`Error updating job ${jobId}:`, error);
        job.status = 'failed';
        this.activeJobs.delete(jobId);
        this.freeRunner(job.runnerId);
      }
    }
  }
  
  /**
   * Обновляет активные pipelines
   */
  private updateActivePipelines(currentTime: number): void {
    for (const pipeline of this.pipelines.values()) {
      if (pipeline.status !== 'running' && pipeline.status !== 'pending') continue;
      
      // Check if all stages are complete
      const allStagesComplete = pipeline.stages.every(stage => 
        stage.status === 'success' || stage.status === 'failed' || stage.status === 'canceled'
      );
      
      if (allStagesComplete && pipeline.status === 'running') {
        // Determine pipeline status based on stages
        const hasFailed = pipeline.stages.some(stage => stage.status === 'failed');
        pipeline.status = hasFailed ? 'failed' : 'success';
        pipeline.finishedAt = currentTime;
        if (pipeline.startedAt) {
          pipeline.duration = currentTime - pipeline.startedAt;
        }
        
        // Calculate coverage (simulated)
        if (pipeline.status === 'success') {
          pipeline.coverage = 75 + Math.random() * 20; // 75-95%
        }
        
        // Add to history
        this.addPipelineToHistory(pipeline);
        
        // Update metrics
        if (pipeline.status === 'success') {
          this.gitlabMetrics.pipelinesSuccess++;
        } else {
          this.gitlabMetrics.pipelinesFailed++;
        }
        this.gitlabMetrics.pipelinesRunning--;
      } else if (pipeline.status === 'pending' && !allStagesComplete) {
        // Check if we can start the pipeline (has available runner)
        const firstPendingStage = pipeline.stages.find(stage => stage.status === 'pending');
        if (firstPendingStage && this.hasAvailableRunner(firstPendingStage.jobs[0]?.tags)) {
          pipeline.status = 'running';
          pipeline.startedAt = currentTime;
          this.startStage(firstPendingStage, pipeline.id, currentTime);
        }
      } else if (pipeline.status === 'running') {
        // Update stages that are ready to run
        for (let i = 0; i < pipeline.stages.length; i++) {
          const stage = pipeline.stages[i];
          const prevStage = i > 0 ? pipeline.stages[i - 1] : null;
          
          if (stage.status === 'pending' && (!prevStage || prevStage.status === 'success')) {
            this.startStage(stage, pipeline.id, currentTime);
            break; // Start one stage at a time
          }
        }
      }
      
      pipeline.updatedAt = currentTime;
    }
  }
  
  /**
   * Запускает stage (запускает все jobs в stage)
   */
  private startStage(stage: GitLabCIStage, pipelineId: string, currentTime: number): void {
    stage.status = 'running';
    stage.startTime = currentTime;
    
    for (const job of stage.jobs) {
      if (job.status === 'created' || job.status === 'pending') {
        // Find available runner
        const runner = this.findAvailableRunner(job.tags);
        if (runner) {
          job.status = 'running';
          job.startTime = currentTime;
          job.runnerId = runner.id;
          job.estimatedDuration = this.config?.averageJobDuration || 60000;
          job.progress = 0;
          
          // Generate initial logs
          job.logs = this.generateJobLogs(job);
          
          // Allocate runner
          runner.currentJobs++;
          runner.busy = runner.currentJobs >= runner.maxJobs;
          
          this.activeJobs.set(job.id, job);
          this.gitlabMetrics.jobsRunning++;
        } else {
          job.status = 'pending';
          this.gitlabMetrics.jobsPending++;
        }
      }
    }
  }
  
  /**
   * Обновляет логи job во время выполнения
   */
  private updateJobLogs(job: GitLabCIJob, elapsed: number, estimatedDuration: number): void {
    if (!job.logs) return;
    
    const progress = Math.floor((elapsed / estimatedDuration) * 100);
    const progressThresholds = [10, 30, 50, 70, 90];
    
    for (const threshold of progressThresholds) {
      if (progress >= threshold && !job.logs.some(log => log.includes(`Progress: ${threshold}%`))) {
        job.logs.push(`[${job.name}] Progress: ${threshold}% completed`);
      }
    }
  }
  
  /**
   * Генерирует логи для job
   */
  private generateJobLogs(job: GitLabCIJob): string[] {
    const logs: string[] = [];
    logs.push(`Running with ${job.image || 'default'} image`);
    logs.push(`$ ${job.script?.[0] || `echo "Running ${job.name}"`}`);
    
    if (job.script) {
      for (const line of job.script) {
        if (line.startsWith('echo')) {
          logs.push(line.replace('echo ', ''));
        } else {
          logs.push(`$ ${line}`);
          logs.push(`[output from ${line}]`);
        }
      }
    }
    
    return logs;
  }
  
  /**
   * Генерирует артефакты для job
   */
  private generateJobArtifacts(job: GitLabCIJob, currentTime: number): void {
    if (!this.config?.enableArtifacts) return;
    
    const artifactTypes = [
      { name: `${job.name}-output.log`, size: 1024 * 10, fileType: 'text/plain' },
      { name: `${job.name}-results.json`, size: 1024 * 5, fileType: 'application/json' },
    ];
    
    for (const artifactType of artifactTypes) {
      const artifactId = `${job.id}-${artifactType.name}`;
      const artifact: GitLabCIArtifact = {
        id: artifactId,
        jobId: job.id,
        pipelineId: job.pipelineId,
        name: artifactType.name,
        size: artifactType.size,
        fileType: artifactType.fileType,
        filename: artifactType.name,
        createdAt: currentTime,
      };
      
      // Calculate expiry
      const expiryDays = parseInt(this.config.artifactsExpiry?.replace('d', '') || '7');
      artifact.expiresAt = currentTime + (expiryDays * 24 * 60 * 60 * 1000);
      
      this.artifacts.set(artifactId, artifact);
      
      if (!job.artifacts) {
        job.artifacts = [];
      }
      job.artifacts.push(artifactType.name);
    }
  }
  
  /**
   * Обновляет stage pipeline после завершения job
   */
  private updatePipelineStage(job: GitLabCIJob): void {
    const pipeline = this.pipelines.get(job.pipelineId);
    if (!pipeline) return;
    
    const stage = pipeline.stages.find(s => s.name === job.stage);
    if (!stage) return;
    
    const stageJob = stage.jobs.find(j => j.id === job.id);
    if (stageJob) {
      stageJob.status = job.status;
      stageJob.duration = job.duration;
    }
    
    // Check if all jobs in stage are complete
    const allJobsComplete = stage.jobs.every(j => 
      j.status === 'success' || j.status === 'failed' || j.status === 'canceled' || j.status === 'skipped'
    );
    
    if (allJobsComplete) {
      const hasFailed = stage.jobs.some(j => j.status === 'failed' && !j.allowFailure);
      stage.status = hasFailed ? 'failed' : 'success';
      if (stage.startTime) {
        stage.duration = Date.now() - stage.startTime;
      }
    }
  }
  
  /**
   * Триггерит новые pipelines на основе rate
   */
  private triggerPipelines(currentTime: number): void {
    if (!this.config) return;
    
    const triggerRate = this.config.pipelineTriggerRate || 2; // pipelines per hour
    const triggerInterval = (60 * 60 * 1000) / triggerRate; // milliseconds
    
    for (const [pipelineId, pipeline] of this.pipelines.entries()) {
      if (pipeline.status === 'running' || pipeline.status === 'pending') continue;
      
      const lastTrigger = this.lastPipelineTrigger.get(pipelineId) || 0;
      const timeSinceLastTrigger = currentTime - lastTrigger;
      
      if (timeSinceLastTrigger >= triggerInterval) {
        this.startPipeline(pipelineId, currentTime);
        this.lastPipelineTrigger.set(pipelineId, currentTime);
      }
    }
  }
  
  /**
   * Проверяет scheduled pipelines
   */
  private checkSchedules(currentTime: number): void {
    for (const [scheduleId, schedule] of this.schedules.entries()) {
      if (!schedule.active) continue;
      
      if (schedule.nextRunAt && currentTime >= schedule.nextRunAt) {
        // Find pipeline for this ref
        const pipeline = Array.from(this.pipelines.values())
          .find(p => p.ref === schedule.ref && (p.status === 'created' || p.status === 'success' || p.status === 'failed'));
        
        if (pipeline) {
          this.startPipeline(pipeline.id, currentTime, 'schedule', schedule.variables);
          schedule.lastRunPipelineId = pipeline.id;
        }
        
        // Calculate next run time
        schedule.nextRunAt = this.calculateNextRunTime(schedule.cron);
        this.scheduleLastRun.set(scheduleId, currentTime);
      }
    }
  }
  
  /**
   * Запускает pipeline
   */
  public startPipeline(pipelineId: string, currentTime: number, source: PipelineStatus['source'] = 'push', variables?: Record<string, string>): { success: boolean; reason?: string } {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      return { success: false, reason: 'Pipeline not found' };
    }
    
    if (pipeline.status === 'running' || pipeline.status === 'pending') {
      return { success: false, reason: 'Pipeline already running' };
    }
    
    // Reset pipeline
    pipeline.status = 'pending';
    pipeline.source = source;
    pipeline.createdAt = currentTime;
    pipeline.updatedAt = currentTime;
    pipeline.startedAt = undefined;
    pipeline.finishedAt = undefined;
    pipeline.duration = undefined;
    pipeline.coverage = undefined;
    
    // Merge variables
    if (variables) {
      pipeline.variables = { ...pipeline.variables, ...variables };
    }
    
    // Reset stages
    for (const stage of pipeline.stages) {
      stage.status = 'pending';
      stage.startTime = undefined;
      stage.duration = undefined;
      for (const job of stage.jobs) {
        job.status = 'created';
        job.startTime = undefined;
        job.duration = undefined;
        job.progress = 0;
        job.logs = undefined;
        job.artifacts = undefined;
        job.runnerId = undefined;
      }
    }
    
    this.gitlabMetrics.pipelinesTotal++;
    this.gitlabMetrics.pipelinesPending++;
    
    return { success: true };
  }
  
  /**
   * Обрабатывает webhook триггер
   */
  public triggerWebhook(ref: string, variables?: Record<string, string>): { success: boolean; pipelineId?: string; reason?: string } {
    // Find pipeline for this ref
    const pipeline = Array.from(this.pipelines.values())
      .find(p => p.ref === ref && (p.status === 'created' || p.status === 'success' || p.status === 'failed'));
    
    if (!pipeline) {
      return { success: false, reason: `No pipeline found for ref: ${ref}` };
    }
    
    const result = this.startPipeline(pipeline.id, Date.now(), 'trigger', variables);
    if (result.success) {
      return { success: true, pipelineId: pipeline.id };
    }
    return result;
  }
  
  /**
   * Отменяет выполняющийся pipeline
   */
  public cancelPipeline(pipelineId: string): { success: boolean; reason?: string } {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      return { success: false, reason: 'Pipeline not found' };
    }
    
    if (pipeline.status !== 'running' && pipeline.status !== 'pending') {
      return { success: false, reason: 'Pipeline is not running' };
    }
    
    pipeline.status = 'canceled';
    pipeline.finishedAt = Date.now();
    if (pipeline.startedAt) {
      pipeline.duration = Date.now() - pipeline.startedAt;
    }
    
    // Cancel all active jobs
    for (const stage of pipeline.stages) {
      stage.status = 'canceled';
      for (const job of stage.jobs) {
        if (job.status === 'running' || job.status === 'pending') {
          job.status = 'canceled';
          this.freeRunner(job.runnerId);
          this.activeJobs.delete(job.id);
          this.gitlabMetrics.jobsRunning--;
        }
      }
    }
    
    this.gitlabMetrics.pipelinesRunning--;
    
    return { success: true };
  }
  
  /**
   * Проверяет наличие доступного runner
   */
  private hasAvailableRunner(tags?: string[]): boolean {
    for (const runner of this.runners.values()) {
      if (runner.status !== 'online' || !runner.active) continue;
      if (runner.currentJobs >= runner.maxJobs) continue;
      
      // Check tags match
      if (tags && tags.length > 0) {
        if (!runner.runUntagged && (!runner.tagList || runner.tagList.length === 0)) continue;
        if (runner.tagList && runner.tagList.length > 0) {
          const hasMatchingTag = tags.some(tag => runner.tagList?.includes(tag));
          if (!hasMatchingTag && !runner.runUntagged) continue;
        }
      }
      
      return true;
    }
    return false;
  }
  
  /**
   * Находит доступный runner
   */
  private findAvailableRunner(tags?: string[]): GitLabCIRunner | undefined {
    for (const runner of this.runners.values()) {
      if (runner.status !== 'online' || !runner.active) continue;
      if (runner.currentJobs >= runner.maxJobs) continue;
      
      // Check tags match
      if (tags && tags.length > 0) {
        if (!runner.runUntagged && (!runner.tagList || runner.tagList.length === 0)) continue;
        if (runner.tagList && runner.tagList.length > 0) {
          const hasMatchingTag = tags.some(tag => runner.tagList?.includes(tag));
          if (!hasMatchingTag && !runner.runUntagged) continue;
        }
      }
      
      return runner;
    }
    return undefined;
  }
  
  /**
   * Освобождает runner
   */
  private freeRunner(runnerId?: string): void {
    if (!runnerId) return;
    
    const runner = this.runners.get(runnerId);
    if (runner && runner.currentJobs > 0) {
      runner.currentJobs--;
      runner.busy = runner.currentJobs >= runner.maxJobs;
    }
  }
  
  /**
   * Добавляет pipeline в историю
   */
  private addPipelineToHistory(pipeline: GitLabCIPipeline): void {
    if (!pipeline.duration) return;
    
    this.pipelineHistory.push({
      timestamp: pipeline.startedAt || pipeline.createdAt,
      duration: pipeline.duration,
      status: pipeline.status,
    });
    
    if (this.pipelineHistory.length > this.MAX_PIPELINE_HISTORY) {
      this.pipelineHistory.shift();
    }
  }
  
  /**
   * Добавляет job в историю
   */
  private addJobToHistory(job: GitLabCIJob): void {
    if (!job.duration) return;
    
    this.jobHistory.push({
      timestamp: job.startTime || Date.now(),
      duration: job.duration,
      status: job.status,
    });
    
    if (this.jobHistory.length > this.MAX_JOB_HISTORY) {
      this.jobHistory.shift();
    }
    
    // Update counters
    if (job.status === 'success') {
      this.gitlabMetrics.jobsSuccess++;
    } else if (job.status === 'failed') {
      this.gitlabMetrics.jobsFailed++;
    }
    this.gitlabMetrics.jobsRunning--;
  }
  
  /**
   * Очищает старые артефакты
   */
  private cleanupArtifacts(currentTime: number): void {
    if (!this.config) return;
    
    const expiryDays = parseInt(this.config.artifactsExpiry?.replace('d', '') || '7');
    const expiryMs = expiryDays * 24 * 60 * 60 * 1000;
    
    for (const [artifactId, artifact] of this.artifacts.entries()) {
      if (artifact.expiresAt && currentTime > artifact.expiresAt) {
        this.artifacts.delete(artifactId);
      } else if (currentTime - artifact.createdAt > expiryMs) {
        this.artifacts.delete(artifactId);
      }
    }
  }
  
  /**
   * Обновляет метрики GitLab CI
   */
  private updateMetrics(): void {
    // Pipeline metrics
    this.gitlabMetrics.pipelinesRunning = Array.from(this.pipelines.values())
      .filter(p => p.status === 'running').length;
    this.gitlabMetrics.pipelinesPending = Array.from(this.pipelines.values())
      .filter(p => p.status === 'pending').length;
    
    // Calculate pipelines per hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentPipelines = this.pipelineHistory.filter(p => p.timestamp > oneHourAgo);
    this.gitlabMetrics.pipelinesPerHour = recentPipelines.length;
    
    // Calculate average pipeline duration
    if (this.pipelineHistory.length > 0) {
      const recent = this.pipelineHistory.slice(-100);
      const avgDuration = recent.reduce((sum, p) => sum + p.duration, 0) / recent.length;
      this.gitlabMetrics.averagePipelineDuration = avgDuration;
    }
    
    // Job metrics
    this.gitlabMetrics.jobsRunning = this.activeJobs.size;
    this.gitlabMetrics.jobsPending = Array.from(this.activeJobs.values())
      .filter(j => j.status === 'pending').length;
    
    // Calculate average job duration
    if (this.jobHistory.length > 0) {
      const recent = this.jobHistory.slice(-500);
      const avgDuration = recent.reduce((sum, j) => sum + j.duration, 0) / recent.length;
      this.gitlabMetrics.averageJobDuration = avgDuration;
    }
    
    // Runner metrics
    this.gitlabMetrics.runnersTotal = this.runners.size;
    this.gitlabMetrics.runnersOnline = Array.from(this.runners.values())
      .filter(r => r.status === 'online').length;
    
    let totalBusy = 0;
    let totalIdle = 0;
    let totalMaxJobs = 0;
    
    for (const runner of this.runners.values()) {
      if (runner.status === 'online') {
        totalBusy += runner.currentJobs;
        totalIdle += (runner.maxJobs - runner.currentJobs);
        totalMaxJobs += runner.maxJobs;
      }
    }
    
    this.gitlabMetrics.runnersBusy = totalBusy;
    this.gitlabMetrics.runnersIdle = totalIdle;
    this.gitlabMetrics.runnerUtilization = totalMaxJobs > 0 
      ? (totalBusy / totalMaxJobs) * 100 
      : 0;
    
    // Cache metrics (simulated)
    const totalCacheRequests = this.gitlabMetrics.cacheHits + this.gitlabMetrics.cacheMisses;
    if (totalCacheRequests > 0) {
      this.gitlabMetrics.cacheHitRate = this.gitlabMetrics.cacheHits / totalCacheRequests;
    } else {
      // Simulate cache activity
      this.gitlabMetrics.cacheHits = Math.floor(Math.random() * 100);
      this.gitlabMetrics.cacheMisses = Math.floor(this.gitlabMetrics.cacheHits * 0.3);
      this.gitlabMetrics.cacheHitRate = this.config?.cacheHitRate || 0.7;
    }
    
    // Artifact metrics
    this.gitlabMetrics.artifactsTotal = this.artifacts.size;
    let totalSize = 0;
    for (const artifact of this.artifacts.values()) {
      totalSize += artifact.size;
    }
    this.gitlabMetrics.artifactsSizeBytes = totalSize;
    
    // Coverage (average from successful pipelines)
    const successfulPipelines = Array.from(this.pipelines.values())
      .filter(p => p.status === 'success' && p.coverage !== undefined);
    if (successfulPipelines.length > 0) {
      const avgCoverage = successfulPipelines.reduce((sum, p) => sum + (p.coverage || 0), 0) / successfulPipelines.length;
      this.gitlabMetrics.coverage = avgCoverage;
    }
  }
  
  /**
   * Получает метрики GitLab CI
   */
  getGitLabCIMetrics(): GitLabCIEngineMetrics {
    return { ...this.gitlabMetrics };
  }
  
  /**
   * Получает метрики GitLab CI (алиас для совместимости с другими движками)
   */
  getMetrics(): GitLabCIEngineMetrics {
    return this.getGitLabCIMetrics();
  }
  
  /**
   * Получает все pipelines
   */
  getPipelines(): GitLabCIPipeline[] {
    return Array.from(this.pipelines.values());
  }
  
  /**
   * Получает pipeline по ID
   */
  getPipeline(pipelineId: string): GitLabCIPipeline | undefined {
    return this.pipelines.get(pipelineId);
  }
  
  /**
   * Получает все активные jobs
   */
  getActiveJobs(): GitLabCIJob[] {
    return Array.from(this.activeJobs.values());
  }
  
  /**
   * Получает job по ID
   */
  getJob(jobId: string): GitLabCIJob | undefined {
    // Check active jobs first
    if (this.activeJobs.has(jobId)) {
      return this.activeJobs.get(jobId);
    }
    
    // Check in pipelines
    for (const pipeline of this.pipelines.values()) {
      for (const stage of pipeline.stages) {
        const job = stage.jobs.find(j => j.id === jobId);
        if (job) return job;
      }
    }
    
    return undefined;
  }
  
  /**
   * Получает все runners
   */
  getRunners(): GitLabCIRunner[] {
    return Array.from(this.runners.values());
  }
  
  /**
   * Получает все variables
   */
  getVariables(): GitLabCIVariable[] {
    return Array.from(this.variables.values());
  }
  
  /**
   * Получает все environments
   */
  getEnvironments(): GitLabCIEnvironment[] {
    return Array.from(this.environments.values());
  }
  
  /**
   * Получает все schedules
   */
  getSchedules(): GitLabCISchedule[] {
    return Array.from(this.schedules.values());
  }
  
  /**
   * Получает все artifacts
   */
  getArtifacts(): GitLabCIArtifact[] {
    return Array.from(this.artifacts.values());
  }
  
  /**
   * Получает логи job
   */
  getJobLogs(jobId: string): string[] | undefined {
    const job = this.getJob(jobId);
    return job?.logs;
  }
  
  /**
   * Обновляет конфигурацию (вызывается при изменении конфига в UI)
   */
  updateConfig(node: CanvasNode): void {
    const oldConfig = this.config;
    const oldPipelineIds = new Set(this.pipelines.keys());
    
    this.initializeConfig(node);
    
    // Проверяем изменения в pipelines
    const newPipelineIds = new Set(this.pipelines.keys());
    
    // Удаляем pipelines, которых больше нет в конфиге
    for (const oldId of oldPipelineIds) {
      if (!newPipelineIds.has(oldId)) {
        // Отменяем активные jobs для удаленного pipeline
        for (const [jobId, job] of this.activeJobs.entries()) {
          if (job.pipelineId === oldId) {
            job.status = 'canceled';
            this.freeRunner(job.runnerId);
            this.activeJobs.delete(jobId);
          }
        }
        this.pipelines.delete(oldId);
      }
    }
    
    // Обновляем существующие pipelines с новыми данными из конфига
    const configPipelines = this.config?.pipelines || [];
    for (const pipelineConfig of configPipelines) {
      const existingPipeline = this.pipelines.get(pipelineConfig.id);
      if (existingPipeline) {
        // Обновляем базовые свойства (но сохраняем runtime состояние)
        existingPipeline.ref = pipelineConfig.ref || existingPipeline.ref;
        existingPipeline.source = pipelineConfig.source || existingPipeline.source;
        
        // Обновляем stages и jobs только если pipeline не запущен
        if (existingPipeline.status !== 'running' && existingPipeline.status !== 'pending') {
          // Можно обновить структуру stages/jobs
        }
      }
    }
    
    // Обновляем runners из конфига
    const configRunners = this.config?.runners || [];
    const existingRunnerIds = new Set(this.runners.keys());
    
    // Удаляем runners, которых больше нет в конфиге
    for (const runnerId of existingRunnerIds) {
      if (!configRunners.find(r => r.id === runnerId)) {
        // Освобождаем jobs на этом runner
        for (const [jobId, job] of this.activeJobs.entries()) {
          if (job.runnerId === runnerId) {
            job.status = 'canceled';
            this.activeJobs.delete(jobId);
          }
        }
        this.runners.delete(runnerId);
      }
    }
    
    // Добавляем/обновляем runners из конфига
    for (const runnerConfig of configRunners) {
      const existingRunner = this.runners.get(runnerConfig.id);
      if (existingRunner) {
        // Обновляем существующий runner (сохраняем runtime состояние)
        existingRunner.name = runnerConfig.name;
        existingRunner.executor = runnerConfig.executor || existingRunner.executor;
        existingRunner.maxJobs = runnerConfig.maxJobs || existingRunner.maxJobs;
        existingRunner.tagList = runnerConfig.tags || existingRunner.tagList;
        existingRunner.isShared = runnerConfig.isShared ?? existingRunner.isShared;
        // Не обновляем currentJobs и busy - они управляются jobs
      } else {
        // Создаем новый runner
        const newRunner: GitLabCIRunner = {
          id: runnerConfig.id,
          name: runnerConfig.name,
          status: 'online',
          runnerType: 'project_type',
          executor: runnerConfig.executor || this.config?.runnerType || 'docker',
          active: true,
          isShared: runnerConfig.isShared ?? false,
          locked: false,
          runUntagged: true,
          accessLevel: 'not_protected',
          tagList: runnerConfig.tags || [],
          currentJobs: 0,
          maxJobs: runnerConfig.maxJobs || this.config?.concurrentJobs || 4,
          busy: false,
          platform: 'linux',
          architecture: 'amd64',
          contactedAt: Date.now(),
        };
        this.runners.set(runnerConfig.id, newRunner);
      }
    }
    
    // Обновляем variables
    this.initializeVariables();
    
    // Обновляем environments
    this.initializeEnvironments();
    
    // Обновляем schedules
    this.initializeSchedules();
  }
  
  /**
   * Рассчитывает метрики компонента на основе метрик GitLab CI
   */
  calculateComponentMetrics(): Partial<ComponentMetrics> {
    const metrics = this.getGitLabCIMetrics();
    
    // Calculate throughput (pipelines per second)
    const throughput = metrics.pipelinesPerHour / 3600;
    
    // Calculate latency (average pipeline duration)
    const latency = metrics.averagePipelineDuration;
    
    // Calculate utilization (runner utilization)
    const utilization = metrics.runnerUtilization / 100;
    
    // Calculate error rate
    const totalPipelines = metrics.pipelinesSuccess + metrics.pipelinesFailed;
    const errorRate = totalPipelines > 0 ? (metrics.pipelinesFailed / totalPipelines) : 0;
    
    return {
      throughput,
      latency,
      utilization,
      errorRate,
    };
  }
}


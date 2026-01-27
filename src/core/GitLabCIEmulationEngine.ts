import { CanvasNode } from '@/types';
import { ComponentMetrics } from './EmulationEngine';
import * as yaml from 'js-yaml';
import { CronParser } from '@/utils/cronParser';
import { PrometheusEmulationEngine } from './PrometheusEmulationEngine';
import { LokiEmulationEngine } from './LokiEmulationEngine';
import { JaegerEmulationEngine, JaegerSpan } from './JaegerEmulationEngine';
import { DockerEmulationEngine } from './DockerEmulationEngine';
import { KubernetesEmulationEngine } from './KubernetesEmulationEngine';
import { dataFlowEngine } from './DataFlowEngine';

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
 * GitLab CI Rule
 */
export interface GitLabCIRule {
  if?: string; // CI variable expression (e.g., "$CI_COMMIT_BRANCH == 'main'")
  when?: 'on_success' | 'on_failure' | 'always' | 'manual';
  allowFailure?: boolean;
  // only/except deprecated, но поддерживаем для совместимости
  only?: string[]; // refs, branches, tags, etc.
  except?: string[]; // refs, branches, tags, etc.
}

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
  needs?: string[]; // Имена jobs, от которых зависит этот job
  rules?: GitLabCIRule[]; // Rules для определения условий запуска
  // Deprecated: only/except (поддерживаем для совместимости)
  only?: string[];
  except?: string[];
  cache?: {
    key?: string | { files?: string[]; prefix?: string };
    paths?: string[];
    policy?: 'pull-push' | 'pull' | 'push';
    when?: 'on_success' | 'on_failure' | 'always';
    untracked?: boolean;
  };
  dependencies?: string[]; // Имена jobs, artifacts которых нужны
  // Интеграции с другими компонентами
  integrations?: {
    deploy?: {
      targetComponentId?: string;
      deployType?: 'deployment' | 'service' | 'configmap' | 'secret';
      manifests?: unknown[];
    };
    upload?: {
      targetComponentId?: string;
      bucket?: string;
      path?: string;
    };
    notify?: {
      targetComponentId?: string;
      notificationType?: string;
    };
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
 * GitLab CI Pipeline Template (из конфига)
 */
export interface GitLabCIPipelineTemplate {
  id: string; // template ID
  ref?: string;
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
      needs?: string[];
      rules?: GitLabCIRule[];
      // Deprecated: only/except (поддерживаем для совместимости)
      only?: string[];
      except?: string[];
      // Интеграции с другими компонентами
      integrations?: {
        deploy?: {
          targetComponentId?: string;
          deployType?: 'deployment' | 'service' | 'configmap' | 'secret';
          manifests?: unknown[];
        };
        upload?: {
          targetComponentId?: string;
          bucket?: string;
          path?: string;
        };
        notify?: {
          targetComponentId?: string;
          notificationType?: string;
        };
      };
    }>;
  }>;
  // Автоматическая отправка результатов пайплайна
  resultDestinations?: Array<{
    targetComponentId: string;
    format?: 'prometheus' | 'loki' | 'pagerduty' | 's3' | 'json';
    condition?: 'always' | 'on_success' | 'on_failure';
  }>;
}

/**
 * GitLab CI Pipeline (Execution - реальное выполнение)
 */
export interface GitLabCIPipeline {
  id: string; // execution ID
  templateId: string; // ссылка на template
  iid: number; // Internal ID (project-level) - увеличивается только при создании нового execution
  retryOf?: number; // iid pipeline, который retry
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
  // Merge Request support
  mergeRequest?: {
    id: number;
    iid: number;
    title: string;
    sourceBranch: string;
    targetBranch: string;
  };
  // Parent/Child Pipelines support
  parentPipelineId?: string;
  childPipelineIds?: string[];
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
  key: string | { files?: string[]; prefix?: string };
  paths: string[];
  policy: 'pull-push' | 'pull' | 'push';
  when?: 'on_success' | 'on_failure' | 'always';
  untracked?: boolean;
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
  private node: CanvasNode | null = null; // Для доступа к node для интеграций
  
  // Pipeline Templates (из конфига)
  private pipelineTemplates: Map<string, GitLabCIPipelineTemplate> = new Map();
  
  // Pipeline Executions (реальные выполнения)
  private pipelineExecutions: Map<string, GitLabCIPipeline> = new Map();
  
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
  private pipelineIidCounter: number = 0; // увеличивается только при создании нового execution
  
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
    this.node = node; // Сохраняем node для интеграций
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
      gitlabUrl: config.gitlabUrl,
      projectId: config.projectId,
      projectUrl: config.projectUrl,
      enableRunners: config.enableRunners,
      runnerType: config.runnerType,
      concurrentJobs: config.concurrentJobs,
      enableCache: config.enableCache,
      cacheType: config.cacheType,
      enableArtifacts: config.enableArtifacts,
      artifactsExpiry: config.artifactsExpiry,
      enableKubernetes: config.enableKubernetes,
      k8sNamespace: config.k8sNamespace,
      pipelines: Array.isArray(config.pipelines) ? config.pipelines : [],
      runners: runners,
      variables: Array.isArray(config.variables) ? config.variables : [],
      environments: Array.isArray(config.environments) ? config.environments : [],
      schedules: Array.isArray(config.schedules) ? config.schedules : [],
      pipelineTriggerRate: config.pipelineTriggerRate,
      averagePipelineDuration: config.averagePipelineDuration,
      averageJobDuration: config.averageJobDuration,
      failureRate: config.failureRate,
      cacheHitRate: config.cacheHitRate,
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
   * Инициализирует pipeline templates из конфига
   * Создает templates, а не executions - iid не увеличивается
   */
  private initializePipelines(): void {
    this.pipelineTemplates.clear();
    
    const configPipelines = Array.isArray(this.config?.pipelines) ? this.config.pipelines : [];
    
    for (const pipelineConfig of configPipelines) {
      const templateId = pipelineConfig.id;
      
      // Создаем template без дефолтных значений - используем только то, что в конфиге
      const template: GitLabCIPipelineTemplate = {
        id: templateId,
        ref: pipelineConfig.ref,
        source: pipelineConfig.source,
        stages: Array.isArray(pipelineConfig.stages) ? pipelineConfig.stages : undefined,
        // Копируем resultDestinations из конфига
        resultDestinations: Array.isArray((pipelineConfig as any).resultDestinations) 
          ? (pipelineConfig as any).resultDestinations 
          : undefined,
      };
      
      this.pipelineTemplates.set(templateId, template);
    }
  }
  
  /**
   * Инициализирует runners из конфига
   */
  private initializeRunners(): void {
    this.runners.clear();
    
    const configRunners = Array.isArray(this.config?.runners) ? this.config.runners : [];
    
    // Не создаем дефолтный runner - используем только то, что в конфиге
    
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
      
      // Calculate next run time using CronParser
      schedule.nextRunAt = this.calculateNextRunTime(schedule.cron);
      
      this.schedules.set(scheduleConfig.id, schedule);
    }
  }
  
  /**
   * Вычисляет следующее время запуска по cron выражению
   * Использует CronParser для точного расчета
   */
  private calculateNextRunTime(cron: string, fromTime?: number): number {
    try {
      const from = fromTime ? new Date(fromTime) : new Date();
      const nextTime = CronParser.getNextTriggerTime(cron, from);
      return nextTime.getTime();
    } catch (error) {
      // Fallback на упрощенную реализацию при ошибке парсинга
      console.warn(`Error parsing cron expression "${cron}":`, error);
      const now = fromTime || Date.now();
      const oneHour = 60 * 60 * 1000;
      return now + oneHour;
    }
  }
  
  /**
   * Парсит .gitlab-ci.yml файл и преобразует в GitLabCIEmulationConfig
   * Поддерживает extends и include (include обрабатывается как mock для симуляции)
   */
  public parseGitLabCIYaml(yamlContent: string): Partial<GitLabCIEmulationConfig> | null {
    try {
      const parsed = yaml.load(yamlContent) as any;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      
      // Преобразуем GitLab CI YAML структуру в наш формат
      const config: Partial<GitLabCIEmulationConfig> = {
        pipelines: [],
      };
      
      // Обработка include (в симуляции пропускаем загрузку внешних файлов)
      // В реальном GitLab include может загружать файлы из репозитория или удаленных источников
      // Для симуляции просто логируем, что include был обнаружен
      if (parsed.include) {
        // В симуляции не загружаем внешние файлы, просто отмечаем наличие include
        console.log('GitLab CI YAML contains include - external files not loaded in simulation');
      }
      
      // Извлекаем stages (без дефолтных значений)
      const stages = Array.isArray(parsed.stages) ? parsed.stages : [];
      
      // Сначала собираем все job templates (включая те, которые могут быть базовыми для extends)
      const jobTemplates: Record<string, any> = {};
      
      // Извлекаем jobs из YAML
      for (const [key, value] of Object.entries(parsed)) {
        if (key === 'stages' || key === 'variables' || key === 'cache' || key === 'include' || key === 'extends') {
          continue;
        }
        
        if (value && typeof value === 'object') {
          // Сохраняем как template (может быть базовым для extends)
          jobTemplates[key] = value;
        }
      }
      
      // Обрабатываем extends - мержим конфигурации
      const resolvedJobs: Record<string, any> = {};
      for (const [jobName, jobConfig] of Object.entries(jobTemplates)) {
        const job = jobConfig as any;
        
        // Если job имеет extends - мержим с базовым job
        if (job.extends) {
          const baseJobName = typeof job.extends === 'string' ? job.extends : job.extends;
          const baseJob = jobTemplates[baseJobName];
          
          if (baseJob) {
            // Мержим конфигурации: сначала базовая, потом переопределения
            resolvedJobs[jobName] = this.mergeJobConfig(baseJob, job);
          } else {
            // Базовый job не найден - используем только текущий
            resolvedJobs[jobName] = job;
          }
        } else {
          // Нет extends - используем как есть
          resolvedJobs[jobName] = job;
        }
      }
      
      // Группируем jobs по stages
      const jobsByStage: Record<string, any[]> = {};
      for (const [jobName, job] of Object.entries(resolvedJobs)) {
        // Пропускаем jobs без script (могут быть template jobs для extends)
        if (!job || typeof job !== 'object' || !('script' in job)) {
          continue;
        }
        
        const stage = job.stage || (stages.length > 0 ? stages[0] : undefined);
        if (!stage) continue;
        
        if (!jobsByStage[stage]) {
          jobsByStage[stage] = [];
        }
        
        jobsByStage[stage].push({
          name: jobName,
          stage: stage,
          script: Array.isArray(job.script) ? job.script : job.script ? [job.script] : undefined,
          image: job.image,
          tags: Array.isArray(job.tags) ? job.tags : job.tags ? [job.tags] : undefined,
          when: job.when,
          allowFailure: job.allow_failure || job.allowFailure,
          needs: Array.isArray(job.needs) ? job.needs : undefined,
          rules: Array.isArray(job.rules) ? job.rules : undefined,
          only: Array.isArray(job.only) ? job.only : undefined,
          except: Array.isArray(job.except) ? job.except : undefined,
          cache: job.cache,
          dependencies: Array.isArray(job.dependencies) ? job.dependencies : undefined,
          retry: typeof job.retry === 'number' ? job.retry : undefined,
          maxRetries: typeof job.maxRetries === 'number' ? job.maxRetries : (typeof job.retry === 'object' && job.retry?.max ? job.retry.max : undefined),
        });
      }
      
      // Создаем pipeline с stages (только те stages, где есть jobs)
      const pipelineStages = stages
        .filter((stageName: string) => jobsByStage[stageName] && jobsByStage[stageName].length > 0)
        .map((stageName: string) => ({
          name: stageName,
          jobs: jobsByStage[stageName] || [],
        }));
      
      // Если stages не указаны, но есть jobs - создаем stages из jobs
      if (pipelineStages.length === 0 && Object.keys(jobsByStage).length > 0) {
        for (const [stageName, jobs] of Object.entries(jobsByStage)) {
          if (jobs.length > 0) {
            pipelineStages.push({
              name: stageName,
              jobs: jobs,
            });
          }
        }
      }
      
      // Извлекаем variables (без дефолтных значений)
      if (parsed.variables && typeof parsed.variables === 'object') {
        config.variables = Object.entries(parsed.variables).map(([key, value]) => ({
          key,
          value: String(value),
          protected: false,
          masked: false,
        }));
      }
      
      // Создаем pipeline только если есть stages
      if (pipelineStages.length > 0) {
        const pipelineId = `pipeline-${Date.now()}`;
        config.pipelines = [{
          id: pipelineId,
          ref: 'main',
          source: 'push',
          stages: pipelineStages,
        }];
      }
      
      return config;
    } catch (error) {
      console.error('Error parsing GitLab CI YAML:', error);
      return null;
    }
  }
  
  /**
   * Мержит конфигурации jobs (для extends)
   * Базовый job мержится первым, затем переопределения из текущего job
   */
  private mergeJobConfig(baseJob: any, currentJob: any): any {
    const merged = { ...baseJob };
    
    // Мержим все поля из currentJob (переопределяют базовые)
    for (const [key, value] of Object.entries(currentJob)) {
      if (key === 'extends') {
        // Пропускаем поле extends
        continue;
      }
      
      // Для массивов мержим (script, tags, needs, etc.)
      if (Array.isArray(value) && Array.isArray(merged[key])) {
        // В GitLab CI массивы обычно заменяются, а не мержатся
        merged[key] = value;
      } else if (value !== undefined && value !== null) {
        // Переопределяем значение
        merged[key] = value;
      }
    }
    
    return merged;
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
          
          // Check for automatic retry on failure
          if (job.status === 'failed' && job.maxRetries !== undefined && job.retry !== undefined) {
            if (job.retry < job.maxRetries) {
              // Автоматический retry
              job.retry++;
              job.status = 'pending';
              job.startTime = undefined;
              job.duration = undefined;
              job.progress = 0;
              job.logs?.push(`Retrying job ${job.name} (attempt ${job.retry}/${job.maxRetries})`);
              
              // Free runner для retry
              this.freeRunner(job.runnerId);
              job.runnerId = undefined;
              
              // Job останется в activeJobs и будет перезапущен в следующем цикле
              continue;
            }
          }
          
          // Process cache (pull/push)
          if (job.status === 'success' || job.status === 'failed') {
            this.processJobCache(job, this.pipelineExecutions.get(job.pipelineId)!, currentTime);
          }
          
          // Generate artifacts if job succeeded
          if (job.status === 'success' && this.config?.enableArtifacts) {
            this.generateJobArtifacts(job, currentTime);
          }
          
          // Выполняем интеграции job (деплой, отправка артефактов, уведомления)
          const pipeline = this.pipelineExecutions.get(job.pipelineId);
          if (pipeline && job.integrations) {
            this.executeJobWithIntegration(job, pipeline).catch(error => {
              console.warn(`Error executing job integration for ${job.name}:`, error);
              if (job.logs) {
                job.logs.push(`[Integration] Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            });
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
    for (const pipeline of this.pipelineExecutions.values()) {
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
        
        // Если pipeline успешно завершился и есть child pipelines для запуска - запускаем их
        // В реальном GitLab CI child pipelines запускаются через trigger:include или через API
        // В симуляции можно запускать автоматически, если указан child template в конфиге
        // Это будет обрабатываться через специальную логику в triggerPipelines или через UI
        
        // Add to history
        this.addPipelineToHistory(pipeline);
        
        // Отправляем результаты пайплайна в другие компоненты
        const template = this.pipelineTemplates.get(pipeline.templateId);
        if (template && (template as any).resultDestinations) {
          this.sendPipelineResults(pipeline, (template as any).resultDestinations).catch(error => {
            console.warn(`Error sending pipeline results for pipeline ${pipeline.iid}:`, error);
          });
        }
        
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
        
        // Проверяем jobs с needs dependencies - они могут запуститься после завершения зависимостей
        for (const stage of pipeline.stages) {
          for (const job of stage.jobs) {
            if (job.status === 'pending' && job.when !== 'manual') {
              // Проверяем rules еще раз (может измениться контекст)
              if (job.rules && job.rules.length > 0) {
                const rulesResult = this.evaluateRules(job.rules, pipeline, pipeline.variables || {});
                if (!rulesResult.shouldRun) {
                  job.status = 'skipped';
                  continue;
                }
              }
              
              if (this.canStartJob(job, pipeline)) {
                // Подготавливаем artifacts из зависимых jobs (dependencies)
                if (this.config?.enableArtifacts && job.dependencies && job.dependencies.length > 0) {
                  this.prepareJobArtifacts(job, pipeline);
                }
                
                const runner = this.findAvailableRunner(job.tags);
                if (runner) {
                  job.status = 'running';
                  job.startTime = currentTime;
                  job.runnerId = runner.id;
                  job.estimatedDuration = this.config?.averageJobDuration || 60000;
                  job.progress = 0;
                  
                  // Инициализируем retry счетчик если не установлен
                  if (job.retry === undefined) {
                    job.retry = 0;
                  }
                  
                  job.logs = this.generateJobLogs(job);
                  
                  runner.currentJobs++;
                  runner.busy = runner.currentJobs >= runner.maxJobs;
                  
                  this.activeJobs.set(job.id, job);
                  this.gitlabMetrics.jobsRunning++;
                }
              }
            }
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
    
    const pipeline = this.pipelineExecutions.get(pipelineId);
    if (!pipeline) return;
    
    for (const job of stage.jobs) {
      if (job.status === 'created' || job.status === 'pending') {
        // Проверяем rules (если есть)
        let jobWhen = job.when;
        let jobAllowFailure = job.allowFailure;
        
        if (job.rules && job.rules.length > 0) {
          const rulesResult = this.evaluateRules(job.rules, pipeline, pipeline.variables || {});
          if (!rulesResult.shouldRun) {
            job.status = 'skipped';
            continue;
          }
          // Применяем when и allowFailure из rules (если указаны)
          if (rulesResult.when !== undefined) {
            jobWhen = rulesResult.when;
          }
          if (rulesResult.allowFailure !== undefined) {
            jobAllowFailure = rulesResult.allowFailure;
          }
        }
        
        // Обновляем when и allowFailure в job (если изменились из rules)
        if (jobWhen !== undefined) {
          job.when = jobWhen;
        }
        if (jobAllowFailure !== undefined) {
          job.allowFailure = jobAllowFailure;
        }
        
        // Пропускаем manual jobs
        if (job.when === 'manual') {
          job.status = 'manual';
          continue;
        }
        
        // Проверяем зависимости (needs)
        if (!this.canStartJob(job, pipeline)) {
          job.status = 'pending';
          this.gitlabMetrics.jobsPending++;
          continue;
        }
        
        // Подготавливаем artifacts из зависимых jobs (dependencies)
        if (this.config?.enableArtifacts && job.dependencies && job.dependencies.length > 0) {
          this.prepareJobArtifacts(job, pipeline);
        }
        
        // Find available runner
        const runner = this.findAvailableRunner(job.tags);
        if (runner) {
          job.status = 'running';
          job.startTime = currentTime;
          job.runnerId = runner.id;
          job.estimatedDuration = this.config?.averageJobDuration || 60000;
          job.progress = 0;
          
          // Инициализируем retry счетчик если не установлен
          if (job.retry === undefined) {
            job.retry = 0;
          }
          
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
   * Оценивает правила (rules) для job
   * Возвращает решение о том, должен ли job запускаться и с какими параметрами
   */
  private evaluateRules(
    rules: GitLabCIRule[] | undefined,
    pipeline: GitLabCIPipeline,
    variables: Record<string, string>
  ): { shouldRun: boolean; when?: 'on_success' | 'on_failure' | 'always' | 'manual'; allowFailure?: boolean } {
    // Если нет rules - job должен запускаться
    if (!rules || rules.length === 0) {
      return { shouldRun: true };
    }
    
    // Оцениваем правила по порядку - первое совпавшее правило определяет поведение
    for (const rule of rules) {
      let ruleMatches = true;
      
      // Проверяем if выражение
      if (rule.if) {
        const ifResult = this.evaluateIfExpression(rule.if, pipeline, variables);
        if (!ifResult) {
          ruleMatches = false;
        }
      }
      
      // Проверяем only (deprecated, но поддерживаем)
      if (rule.only && rule.only.length > 0) {
        const matchesOnly = this.matchesRefs(rule.only, pipeline.ref, pipeline.source);
        if (!matchesOnly) {
          ruleMatches = false;
        }
      }
      
      // Проверяем except (deprecated, но поддерживаем)
      if (rule.except && rule.except.length > 0) {
        const matchesExcept = this.matchesRefs(rule.except, pipeline.ref, pipeline.source);
        if (matchesExcept) {
          ruleMatches = false; // except исключает запуск
        }
      }
      
      // Если правило совпало - возвращаем его параметры
      if (ruleMatches) {
        return {
          shouldRun: true,
          when: rule.when,
          allowFailure: rule.allowFailure,
        };
      }
    }
    
    // Если ни одно правило не совпало - job не запускается
    return { shouldRun: false };
  }
  
  /**
   * Оценивает if выражение с CI переменными
   * Поддерживает простые выражения типа:
   * - "$CI_COMMIT_BRANCH == 'main'"
   * - "$CI_PIPELINE_SOURCE == 'push'"
   * - "$CI_COMMIT_REF_NAME =~ /^feature\//"
   */
  private evaluateIfExpression(
    expression: string,
    pipeline: GitLabCIPipeline,
    variables: Record<string, string>
  ): boolean {
    try {
      // Собираем все переменные (CI переменные + pipeline variables + config variables)
      const allVariables: Record<string, string> = {
        // Стандартные CI переменные
        CI_PIPELINE_SOURCE: pipeline.source,
        CI_COMMIT_REF_NAME: pipeline.ref,
        CI_COMMIT_BRANCH: pipeline.ref,
        CI_COMMIT_TAG: pipeline.ref,
        CI_PIPELINE_ID: pipeline.id,
        CI_PIPELINE_IID: String(pipeline.iid),
        CI_PROJECT_ID: this.config?.projectId || '',
        CI_PROJECT_URL: this.config?.projectUrl || '',
        // Pipeline variables
        ...pipeline.variables,
        // Config variables
        ...variables,
      };
      
      // Добавляем переменные из конфига
      for (const [key, variable] of this.variables.entries()) {
        if (!allVariables[key]) {
          allVariables[key] = variable.value;
        }
      }
      
      // Заменяем переменные в выражении
      let evaluatedExpression = expression;
      for (const [key, value] of Object.entries(allVariables)) {
        const regex = new RegExp(`\\$${key}\\b`, 'g');
        evaluatedExpression = evaluatedExpression.replace(regex, `"${value}"`);
      }
      
      // Обрабатываем регулярные выражения (=~)
      const regexMatch = evaluatedExpression.match(/=~\s*\/(.+)\//);
      if (regexMatch) {
        const varName = evaluatedExpression.match(/\$(\w+)/)?.[1];
        const regexPattern = regexMatch[1];
        if (varName && allVariables[varName]) {
          const regex = new RegExp(regexPattern);
          return regex.test(allVariables[varName]);
        }
        return false;
      }
      
      // Обрабатываем простые сравнения (==, !=)
      // Безопасная оценка простых выражений
      if (evaluatedExpression.includes('==')) {
        const [left, right] = evaluatedExpression.split('==').map(s => s.trim().replace(/^"|"$/g, ''));
        return left === right;
      }
      
      if (evaluatedExpression.includes('!=')) {
        const [left, right] = evaluatedExpression.split('!=').map(s => s.trim().replace(/^"|"$/g, ''));
        return left !== right;
      }
      
      // Если выражение не распознано - считаем его true (не блокируем)
      console.warn(`Unsupported if expression: ${expression}`);
      return true;
    } catch (error) {
      console.error(`Error evaluating if expression "${expression}":`, error);
      // При ошибке - не блокируем запуск
      return true;
    }
  }
  
  /**
   * Проверяет, совпадает ли ref с указанными значениями (для only/except)
   */
  private matchesRefs(refs: string[], pipelineRef: string, source: PipelineStatus['source']): boolean {
    for (const ref of refs) {
      // Проверяем точное совпадение
      if (ref === pipelineRef) {
        return true;
      }
      
      // Проверяем типы (branches, tags, merge_requests, etc.)
      if (ref === 'branches' && source === 'push') {
        return true;
      }
      if (ref === 'tags' && source === 'push') {
        return true;
      }
      if (ref === 'merge_requests' && source === 'merge_request_event') {
        return true;
      }
      if (ref === 'schedules' && source === 'schedule') {
        return true;
      }
      if (ref === 'triggers' && source === 'trigger') {
        return true;
      }
      
      // Проверяем паттерны (например, "main", "feature/*")
      if (ref.includes('*')) {
        const pattern = new RegExp('^' + ref.replace(/\*/g, '.*') + '$');
        if (pattern.test(pipelineRef)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Проверяет, можно ли запустить job (проверяет needs dependencies и rules)
   */
  private canStartJob(job: GitLabCIJob, pipeline: GitLabCIPipeline): boolean {
    // Проверяем rules (если есть)
    if (job.rules && job.rules.length > 0) {
      const rulesResult = this.evaluateRules(job.rules, pipeline, pipeline.variables || {});
      if (!rulesResult.shouldRun) {
        return false;
      }
    } else {
      // Если нет rules, проверяем deprecated only/except
      if (job.only && job.only.length > 0) {
        const matchesOnly = this.matchesRefs(job.only, pipeline.ref, pipeline.source);
        if (!matchesOnly) {
          return false;
        }
      }
      
      if (job.except && job.except.length > 0) {
        const matchesExcept = this.matchesRefs(job.except, pipeline.ref, pipeline.source);
        if (matchesExcept) {
          return false; // except исключает запуск
        }
      }
    }
    
    // Проверяем needs dependencies
    if (job.needs && job.needs.length > 0) {
      for (const neededJobName of job.needs) {
        const neededJob = this.findJobInPipeline(pipeline, neededJobName);
        if (!neededJob || neededJob.status !== 'success') {
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Находит job в pipeline по имени
   */
  private findJobInPipeline(pipeline: GitLabCIPipeline, jobName: string): GitLabCIJob | undefined {
    for (const stage of pipeline.stages) {
      const job = stage.jobs.find(j => j.name === jobName);
      if (job) return job;
    }
    return undefined;
  }
  
  /**
   * Запускает manual job
   */
  public playManualJob(jobId: string, currentTime: number): { success: boolean; reason?: string } {
    const job = this.getJob(jobId);
    if (!job || job.when !== 'manual') {
      return { success: false, reason: 'Job is not manual' };
    }
    
    if (job.status !== 'manual') {
      return { success: false, reason: 'Job is not in manual state' };
    }
    
    const pipeline = this.pipelineExecutions.get(job.pipelineId);
    if (!pipeline) {
      return { success: false, reason: 'Pipeline not found' };
    }
    
    // Проверяем зависимости
    if (!this.canStartJob(job, pipeline)) {
      return { success: false, reason: 'Job dependencies not met' };
    }
    
    // Подготавливаем artifacts из зависимых jobs (dependencies)
    if (this.config?.enableArtifacts && job.dependencies && job.dependencies.length > 0) {
      this.prepareJobArtifacts(job, pipeline);
    }
    
    // Запускаем manual job
    const runner = this.findAvailableRunner(job.tags);
    if (!runner) {
      job.status = 'pending';
      this.gitlabMetrics.jobsPending++;
      return { success: false, reason: 'No available runner' };
    }
    
    job.status = 'running';
    job.startTime = currentTime;
    job.runnerId = runner.id;
    job.estimatedDuration = this.config?.averageJobDuration || 60000;
    job.progress = 0;
    
    // Инициализируем retry счетчик если не установлен
    if (job.retry === undefined) {
      job.retry = 0;
    }
    
    // Generate initial logs
    job.logs = this.generateJobLogs(job);
    
    // Allocate runner
    runner.currentJobs++;
    runner.busy = runner.currentJobs >= runner.maxJobs;
    
    this.activeJobs.set(job.id, job);
    this.gitlabMetrics.jobsRunning++;
    
    return { success: true };
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
   * Генерирует логи для job на основе реальных команд из script
   */
  private generateJobLogs(job: GitLabCIJob): string[] {
    const logs: string[] = [];
    
    // Если нет скрипта - не генерируем логи
    if (!job.script || job.script.length === 0) {
      return logs;
    }
    
    // Для симуляции показываем команды
    if (job.image) {
      logs.push(`Running with ${job.image} image`);
    }
    
    for (const line of job.script) {
      logs.push(`$ ${line}`);
      // Для симуляции можно добавить индикатор
      logs.push(`[Simulating: ${line}]`);
    }
    
    return logs;
  }
  
  /**
   * Подготавливает artifacts из зависимых jobs для использования в текущем job
   */
  private prepareJobArtifacts(job: GitLabCIJob, pipeline: GitLabCIPipeline): void {
    if (!job.dependencies || job.dependencies.length === 0) {
      return;
    }
    
    // Находим artifacts из зависимых jobs
    const dependentArtifacts: string[] = [];
    
    for (const dependentJobName of job.dependencies) {
      const dependentJob = this.findJobInPipeline(pipeline, dependentJobName);
      if (dependentJob && dependentJob.artifacts && dependentJob.artifacts.length > 0) {
        // В реальном GitLab CI artifacts копируются в рабочую директорию job
        // В симуляции просто отмечаем, что artifacts доступны
        dependentArtifacts.push(...dependentJob.artifacts);
      }
    }
    
    // Логируем доступность artifacts (в симуляции)
    if (dependentArtifacts.length > 0 && job.logs) {
      job.logs.push(`[Simulating] Artifacts from dependencies available: ${dependentArtifacts.join(', ')}`);
    }
  }
  
  /**
   * Вычисляет cache key на основе конфигурации cache
   */
  private calculateCacheKey(cache: GitLabCIJob['cache'], job: GitLabCIJob, pipeline: GitLabCIPipeline): string {
    if (!cache || !cache.key) {
      return `default-${job.name}`;
    }
    
    // Если key - строка, используем как есть
    if (typeof cache.key === 'string') {
      return cache.key;
    }
    
    // Если key - объект с files и prefix
    let keyParts: string[] = [];
    
    // Добавляем prefix если есть
    if (cache.key.prefix) {
      keyParts.push(cache.key.prefix);
    }
    
    // Если есть files - вычисляем hash на основе файлов (в симуляции используем упрощенный подход)
    if (cache.key.files && cache.key.files.length > 0) {
      // В реальном GitLab CI вычисляется hash содержимого файлов
      // В симуляции используем упрощенный подход - комбинируем имена файлов
      const filesHash = cache.key.files.sort().join('-').replace(/[^a-zA-Z0-9-]/g, '-');
      keyParts.push(filesHash);
    }
    
    // Добавляем job name для уникальности
    keyParts.push(job.name);
    
    return keyParts.join('-');
  }
  
  /**
   * Обрабатывает cache для job (pull/push)
   */
  private processJobCache(job: GitLabCIJob, pipeline: GitLabCIPipeline, currentTime: number): void {
    if (!this.config?.enableCache || !job.cache) {
      return;
    }
    
    const cacheKey = this.calculateCacheKey(job.cache, job, pipeline);
    const cachePolicy = job.cache.policy || 'pull-push';
    
    // Pull cache (если policy включает pull)
    if (cachePolicy === 'pull-push' || cachePolicy === 'pull') {
      const cacheEntry = this.cacheEntries.get(cacheKey);
      if (cacheEntry) {
        // Cache hit
        this.gitlabMetrics.cacheHits++;
        cacheEntry.lastAccessed = currentTime;
        if (job.logs) {
          job.logs.push(`[Cache] Cache hit for key: ${cacheKey}`);
        }
      } else {
        // Cache miss
        this.gitlabMetrics.cacheMisses++;
        if (job.logs) {
          job.logs.push(`[Cache] Cache miss for key: ${cacheKey}`);
        }
      }
    }
    
    // Push cache (если policy включает push и job успешен)
    if ((cachePolicy === 'pull-push' || cachePolicy === 'push') && job.status === 'success') {
      const cacheWhen = job.cache.when || 'on_success';
      if (cacheWhen === 'on_success' || (cacheWhen === 'always')) {
        // Создаем или обновляем cache entry
        const cachePaths = job.cache.paths || [];
        const cacheSize = cachePaths.length * 1024 * 10; // Симулируем размер
        
        this.cacheEntries.set(cacheKey, {
          key: cacheKey,
          size: cacheSize,
          createdAt: currentTime,
          lastAccessed: currentTime,
        });
        
        if (job.logs) {
          job.logs.push(`[Cache] Cache saved for key: ${cacheKey} (paths: ${cachePaths.join(', ')})`);
        }
      }
    }
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
    const pipeline = this.pipelineExecutions.get(job.pipelineId);
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
    
    // Триггерим templates, а не executions
    for (const [templateId, template] of this.pipelineTemplates.entries()) {
      // Проверяем, есть ли активные executions для этого template
      const hasActiveExecution = Array.from(this.pipelineExecutions.values())
        .some(exec => exec.templateId === templateId && (exec.status === 'running' || exec.status === 'pending'));
      
      if (hasActiveExecution) continue;
      
      const lastTrigger = this.lastPipelineTrigger.get(templateId) || 0;
      const timeSinceLastTrigger = currentTime - lastTrigger;
      
      if (timeSinceLastTrigger >= triggerInterval) {
        this.startPipeline(templateId, currentTime);
        this.lastPipelineTrigger.set(templateId, currentTime);
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
        // Find template for this ref
        const template = Array.from(this.pipelineTemplates.values())
          .find(t => t.ref === schedule.ref);
        
        if (template) {
          const result = this.startPipeline(template.id, currentTime, 'schedule', schedule.variables);
          if (result.success && result.executionId) {
            schedule.lastRunPipelineId = result.executionId;
          }
        }
        
        // Calculate next run time using CronParser
        schedule.nextRunAt = this.calculateNextRunTime(schedule.cron, currentTime);
        this.scheduleLastRun.set(scheduleId, currentTime);
      }
    }
  }
  
  /**
   * Создает новый pipeline execution из template
   */
  public startPipeline(
    templateId: string, 
    currentTime: number, 
    source: PipelineStatus['source'] = 'push', 
    variables?: Record<string, string>,
    isRetry: boolean = false,
    retryOfIid?: number
  ): { success: boolean; reason?: string; executionId?: string; iid?: number } {
    const template = this.pipelineTemplates.get(templateId);
    if (!template) {
      return { success: false, reason: 'Pipeline template not found' };
    }
    
    // Определяем iid
    let iid: number;
    if (isRetry && retryOfIid !== undefined) {
      iid = retryOfIid; // Retry сохраняет iid
    } else {
      iid = ++this.pipelineIidCounter; // Новый execution = новый iid
    }
    
    // Создаем stages из template
    const stages: GitLabCIStage[] = [];
    if (template.stages && Array.isArray(template.stages)) {
      for (const stageConfig of template.stages) {
        const jobs: GitLabCIJob[] = [];
        if (Array.isArray(stageConfig.jobs)) {
          for (const jobConfig of stageConfig.jobs) {
            jobs.push({
              id: `${templateId}-${stageConfig.name}-${jobConfig.name}-${iid}-${Date.now()}`,
              name: jobConfig.name,
              stage: stageConfig.name,
              status: 'created',
              pipelineId: '', // будет установлен после создания execution
              when: jobConfig.when,
              allowFailure: jobConfig.allowFailure,
              tags: Array.isArray(jobConfig.tags) ? jobConfig.tags : undefined,
              image: jobConfig.image,
              script: Array.isArray(jobConfig.script) ? jobConfig.script : undefined,
              needs: Array.isArray(jobConfig.needs) ? jobConfig.needs : undefined,
              rules: Array.isArray(jobConfig.rules) ? jobConfig.rules : undefined,
              // Deprecated: only/except (поддерживаем для совместимости)
              only: Array.isArray(jobConfig.only) ? jobConfig.only : undefined,
              except: Array.isArray(jobConfig.except) ? jobConfig.except : undefined,
              cache: jobConfig.cache,
              dependencies: Array.isArray(jobConfig.dependencies) ? jobConfig.dependencies : undefined,
              retry: jobConfig.retry,
              maxRetries: jobConfig.maxRetries,
              // Копируем integrations из template
              integrations: jobConfig.integrations,
            });
          }
        }
        stages.push({
          name: stageConfig.name,
          status: 'pending',
          jobs,
        });
      }
    }
    
    // Создаем новый execution
    const executionId = `execution-${currentTime}-${iid}`;
    const execution: GitLabCIPipeline = {
      id: executionId,
      templateId,
      iid,
      retryOf: isRetry && retryOfIid !== undefined ? retryOfIid : undefined,
      status: 'pending',
      ref: template.ref || 'main',
      source,
      stages,
      createdAt: currentTime,
      updatedAt: currentTime,
      variables: variables || {},
    };
    
    // Устанавливаем pipelineId для всех jobs
    for (const stage of execution.stages) {
      for (const job of stage.jobs) {
        job.pipelineId = executionId;
      }
    }
    
    this.pipelineExecutions.set(executionId, execution);
    this.gitlabMetrics.pipelinesTotal++;
    this.gitlabMetrics.pipelinesPending++;
    
    return { success: true, executionId, iid };
  }
  
  /**
   * Retry существующего pipeline с сохранением iid
   */
  public retryPipeline(executionId: string, currentTime: number): { success: boolean; reason?: string; newExecutionId?: string; iid?: number } {
    const execution = this.pipelineExecutions.get(executionId);
    if (!execution) {
      return { success: false, reason: 'Pipeline execution not found' };
    }
    
    // Создаем новый execution с тем же iid
    const result = this.startPipeline(
      execution.templateId,
      currentTime,
      execution.source,
      execution.variables,
      true, // isRetry
      execution.iid // retryOfIid
    );
    
    if (result.success) {
      return { 
        success: true, 
        newExecutionId: result.executionId, 
        iid: result.iid 
      };
    }
    
    return result;
  }
  
  /**
   * Обрабатывает webhook триггер
   * Поддерживает обычные push события и merge request события
   */
  public triggerWebhook(
    ref: string, 
    variables?: Record<string, string>,
    eventType?: 'push' | 'merge_request',
    mergeRequestData?: { id: number; iid: number; title: string; sourceBranch: string; targetBranch: string }
  ): { success: boolean; pipelineId?: string; reason?: string } {
    // Find template for this ref
    const template = Array.from(this.pipelineTemplates.values())
      .find(t => t.ref === ref || (eventType === 'merge_request' && t.ref === mergeRequestData?.sourceBranch));
    
    if (!template) {
      return { success: false, reason: `No pipeline template found for ref: ${ref}` };
    }
    
    const source = eventType === 'merge_request' ? 'merge_request_event' : 'trigger';
    const result = this.startPipeline(template.id, Date.now(), source, variables);
    
    if (result.success && result.executionId) {
      const execution = this.pipelineExecutions.get(result.executionId);
      if (execution && eventType === 'merge_request' && mergeRequestData) {
        // Устанавливаем merge request данные
        execution.mergeRequest = mergeRequestData;
        execution.ref = mergeRequestData.sourceBranch; // Для merge request используем source branch
      }
      return { success: true, pipelineId: result.executionId };
    }
    return result;
  }
  
  /**
   * Создает pipeline для merge request
   */
  public triggerMergeRequestPipeline(
    templateId: string,
    mergeRequestData: { id: number; iid: number; title: string; sourceBranch: string; targetBranch: string },
    currentTime: number,
    variables?: Record<string, string>
  ): { success: boolean; reason?: string; executionId?: string; iid?: number } {
    const result = this.startPipeline(templateId, currentTime, 'merge_request_event', variables);
    
    if (result.success && result.executionId) {
      const execution = this.pipelineExecutions.get(result.executionId);
      if (execution) {
        execution.mergeRequest = mergeRequestData;
        execution.ref = mergeRequestData.sourceBranch; // Для merge request используем source branch
      }
    }
    
    return result;
  }
  
  /**
   * Создает child pipeline из parent pipeline
   */
  public triggerChildPipeline(
    parentExecutionId: string,
    childTemplateId: string,
    currentTime: number,
    variables?: Record<string, string>
  ): { success: boolean; reason?: string; childExecutionId?: string; iid?: number } {
    const parentExecution = this.pipelineExecutions.get(parentExecutionId);
    if (!parentExecution) {
      return { success: false, reason: 'Parent pipeline execution not found' };
    }
    
    // Создаем child pipeline
    const result = this.startPipeline(childTemplateId, currentTime, 'parent_pipeline', variables);
    
    if (result.success && result.executionId) {
      const childExecution = this.pipelineExecutions.get(result.executionId);
      if (childExecution) {
        // Устанавливаем связь parent-child
        childExecution.parentPipelineId = parentExecutionId;
        
        // Добавляем child в parent
        if (!parentExecution.childPipelineIds) {
          parentExecution.childPipelineIds = [];
        }
        parentExecution.childPipelineIds.push(result.executionId);
        
        // Наследуем merge request данные от parent (если есть)
        if (parentExecution.mergeRequest) {
          childExecution.mergeRequest = parentExecution.mergeRequest;
        }
      }
    }
    
    return result;
  }
  
  /**
   * Отменяет выполняющийся pipeline
   */
  public cancelPipeline(pipelineId: string): { success: boolean; reason?: string } {
    const pipeline = this.pipelineExecutions.get(pipelineId);
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
    this.gitlabMetrics.pipelinesRunning = Array.from(this.pipelineExecutions.values())
      .filter(p => p.status === 'running').length;
    this.gitlabMetrics.pipelinesPending = Array.from(this.pipelineExecutions.values())
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
    const successfulPipelines = Array.from(this.pipelineExecutions.values())
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
   * Получает все pipeline executions
   */
  getPipelines(): GitLabCIPipeline[] {
    return Array.from(this.pipelineExecutions.values());
  }
  
  /**
   * Получает pipeline execution по ID
   */
  getPipeline(pipelineId: string): GitLabCIPipeline | undefined {
    return this.pipelineExecutions.get(pipelineId);
  }
  
  /**
   * Получает все pipeline templates
   */
  getPipelineTemplates(): GitLabCIPipelineTemplate[] {
    return Array.from(this.pipelineTemplates.values());
  }
  
  /**
   * Получает pipeline template по ID
   */
  getPipelineTemplate(templateId: string): GitLabCIPipelineTemplate | undefined {
    return this.pipelineTemplates.get(templateId);
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
    
    // Check in pipeline executions
    for (const pipeline of this.pipelineExecutions.values()) {
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
    const oldTemplateIds = new Set(this.pipelineTemplates.keys());
    
    this.initializeConfig(node);
    
    // Проверяем изменения в templates
    const newTemplateIds = new Set(this.pipelineTemplates.keys());
    
    // Отменяем активные executions для удаленных templates
    for (const oldId of oldTemplateIds) {
      if (!newTemplateIds.has(oldId)) {
        // Отменяем активные jobs для удаленного template
        for (const [executionId, execution] of this.pipelineExecutions.entries()) {
          if (execution.templateId === oldId) {
            for (const [jobId, job] of this.activeJobs.entries()) {
              if (job.pipelineId === executionId) {
                job.status = 'canceled';
                this.freeRunner(job.runnerId);
                this.activeJobs.delete(jobId);
              }
            }
            this.pipelineExecutions.delete(executionId);
          }
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

  // ==================== ИНТЕГРАЦИИ С ДРУГИМИ КОМПОНЕНТАМИ ====================

  /**
   * Экспортирует метрики GitLab CI в Prometheus format
   * Возвращает строку в Prometheus exposition format для scraping
   */
  exportPrometheusMetrics(node: CanvasNode): string {
    if (!this.config) return '';

    const metrics = this.getGitLabCIMetrics();
    const timestamp = Date.now();
    const lines: string[] = [];
    const labels = `component_id="${this.escapeLabelValue(node.id)}",component_type="gitlab-ci"`;

    // Pipeline metrics
    lines.push('# HELP gitlab_ci_pipelines_total Total number of pipelines');
    lines.push('# TYPE gitlab_ci_pipelines_total counter');
    lines.push(`gitlab_ci_pipelines_total{${labels}} ${metrics.pipelinesTotal} ${timestamp}`);
    
    lines.push('# HELP gitlab_ci_pipelines_success Total number of successful pipelines');
    lines.push('# TYPE gitlab_ci_pipelines_success counter');
    lines.push(`gitlab_ci_pipelines_success{${labels}} ${metrics.pipelinesSuccess} ${timestamp}`);
    
    lines.push('# HELP gitlab_ci_pipelines_failed Total number of failed pipelines');
    lines.push('# TYPE gitlab_ci_pipelines_failed counter');
    lines.push(`gitlab_ci_pipelines_failed{${labels}} ${metrics.pipelinesFailed} ${timestamp}`);
    
    lines.push('# HELP gitlab_ci_pipelines_running Current number of running pipelines');
    lines.push('# TYPE gitlab_ci_pipelines_running gauge');
    lines.push(`gitlab_ci_pipelines_running{${labels}} ${metrics.pipelinesRunning} ${timestamp}`);
    
    lines.push('# HELP gitlab_ci_pipelines_per_hour Pipelines per hour');
    lines.push('# TYPE gitlab_ci_pipelines_per_hour gauge');
    lines.push(`gitlab_ci_pipelines_per_hour{${labels}} ${metrics.pipelinesPerHour} ${timestamp}`);
    
    lines.push('# HELP gitlab_ci_pipeline_duration_seconds Average pipeline duration in seconds');
    lines.push('# TYPE gitlab_ci_pipeline_duration_seconds gauge');
    lines.push(`gitlab_ci_pipeline_duration_seconds{${labels}} ${metrics.averagePipelineDuration / 1000} ${timestamp}`);

    // Job metrics
    lines.push('# HELP gitlab_ci_jobs_total Total number of jobs');
    lines.push('# TYPE gitlab_ci_jobs_total counter');
    lines.push(`gitlab_ci_jobs_total{${labels}} ${metrics.jobsTotal} ${timestamp}`);
    
    lines.push('# HELP gitlab_ci_jobs_success Total number of successful jobs');
    lines.push('# TYPE gitlab_ci_jobs_success counter');
    lines.push(`gitlab_ci_jobs_success{${labels}} ${metrics.jobsSuccess} ${timestamp}`);
    
    lines.push('# HELP gitlab_ci_jobs_failed Total number of failed jobs');
    lines.push('# TYPE gitlab_ci_jobs_failed counter');
    lines.push(`gitlab_ci_jobs_failed{${labels}} ${metrics.jobsFailed} ${timestamp}`);
    
    lines.push('# HELP gitlab_ci_jobs_running Current number of running jobs');
    lines.push('# TYPE gitlab_ci_jobs_running gauge');
    lines.push(`gitlab_ci_jobs_running{${labels}} ${metrics.jobsRunning} ${timestamp}`);
    
    lines.push('# HELP gitlab_ci_job_duration_seconds Average job duration in seconds');
    lines.push('# TYPE gitlab_ci_job_duration_seconds gauge');
    lines.push(`gitlab_ci_job_duration_seconds{${labels}} ${metrics.averageJobDuration / 1000} ${timestamp}`);

    // Runner metrics
    lines.push('# HELP gitlab_ci_runners_total Total number of runners');
    lines.push('# TYPE gitlab_ci_runners_total gauge');
    lines.push(`gitlab_ci_runners_total{${labels}} ${metrics.runnersTotal} ${timestamp}`);
    
    lines.push('# HELP gitlab_ci_runners_online Number of online runners');
    lines.push('# TYPE gitlab_ci_runners_online gauge');
    lines.push(`gitlab_ci_runners_online{${labels}} ${metrics.runnersOnline} ${timestamp}`);
    
    lines.push('# HELP gitlab_ci_runners_busy Number of busy runners');
    lines.push('# TYPE gitlab_ci_runners_busy gauge');
    lines.push(`gitlab_ci_runners_busy{${labels}} ${metrics.runnersBusy} ${timestamp}`);
    
    lines.push('# HELP gitlab_ci_runners_idle Number of idle runners');
    lines.push('# TYPE gitlab_ci_runners_idle gauge');
    lines.push(`gitlab_ci_runners_idle{${labels}} ${metrics.runnersIdle} ${timestamp}`);
    
    lines.push('# HELP gitlab_ci_runner_utilization Runner utilization (0-1)');
    lines.push('# TYPE gitlab_ci_runner_utilization gauge');
    lines.push(`gitlab_ci_runner_utilization{${labels}} ${metrics.runnerUtilization / 100} ${timestamp}`);

    // Cache metrics
    lines.push('# HELP gitlab_ci_cache_hits Total number of cache hits');
    lines.push('# TYPE gitlab_ci_cache_hits counter');
    lines.push(`gitlab_ci_cache_hits{${labels}} ${metrics.cacheHits} ${timestamp}`);
    
    lines.push('# HELP gitlab_ci_cache_misses Total number of cache misses');
    lines.push('# TYPE gitlab_ci_cache_misses counter');
    lines.push(`gitlab_ci_cache_misses{${labels}} ${metrics.cacheMisses} ${timestamp}`);
    
    lines.push('# HELP gitlab_ci_cache_hit_rate Cache hit rate (0-1)');
    lines.push('# TYPE gitlab_ci_cache_hit_rate gauge');
    lines.push(`gitlab_ci_cache_hit_rate{${labels}} ${metrics.cacheHitRate} ${timestamp}`);

    // Artifact metrics
    lines.push('# HELP gitlab_ci_artifacts_total Total number of artifacts');
    lines.push('# TYPE gitlab_ci_artifacts_total gauge');
    lines.push(`gitlab_ci_artifacts_total{${labels}} ${metrics.artifactsTotal} ${timestamp}`);
    
    lines.push('# HELP gitlab_ci_artifacts_size_bytes Total size of artifacts in bytes');
    lines.push('# TYPE gitlab_ci_artifacts_size_bytes gauge');
    lines.push(`gitlab_ci_artifacts_size_bytes{${labels}} ${metrics.artifactsSizeBytes} ${timestamp}`);

    return lines.join('\n') + '\n';
  }

  /**
   * Экранирует значения labels согласно Prometheus спецификации
   */
  private escapeLabelValue(value: string): string {
    return value
      .replace(/\\/g, '\\\\')  // Экранируем обратные слэши
      .replace(/"/g, '\\"')     // Экранируем кавычки
      .replace(/\n/g, '\\n');   // Экранируем переносы строк
  }

  /**
   * Экспортирует логи jobs в Loki
   * Вызывается при завершении job или периодически для активных jobs
   */
  exportLogsToLoki(node: CanvasNode, lokiEngine: LokiEmulationEngine, job?: GitLabCIJob): void {
    if (!job || !job.logs || job.logs.length === 0) return;

    const streamLabels = {
      component_id: node.id,
      component_type: 'gitlab-ci',
      job_id: job.id,
      job_name: job.name,
      pipeline_id: job.pipelineId,
      stage: job.stage,
      status: job.status,
    };

    // Конвертируем логи в формат Loki
    const timestamp = Date.now() * 1000000; // nanoseconds
    const values: Array<[string, string]> = job.logs.map((log, index) => [
      (timestamp + index).toString(),
      log,
    ]);

    // Отправляем в Loki через ingestion
    lokiEngine.processIngestion([{
      stream: streamLabels,
      values,
    }], node.id);
  }

  /**
   * Создает span в Jaeger для pipeline или job
   * Вызывается при запуске/завершении pipeline или job
   */
  createJaegerSpan(
    node: CanvasNode,
    jaegerEngine: JaegerEmulationEngine,
    pipeline: GitLabCIPipeline,
    job?: GitLabCIJob
  ): void {
    const traceId = this.generateTraceId(pipeline.id);
    const spanId = this.generateSpanId();
    const startTime = job?.startTime || pipeline.startedAt || pipeline.createdAt;
    const duration = job?.duration || pipeline.duration || 0;
    const endTime = startTime + duration;

    const operationName = job 
      ? `gitlab_ci_job:${job.name}` 
      : `gitlab_ci_pipeline:${pipeline.iid}`;

    const span: JaegerSpan = {
      traceId,
      spanId,
      parentSpanId: job ? this.generateSpanId() : undefined, // Для job parent = pipeline span
      operationName,
      serviceName: node.data.label || 'gitlab-ci',
      startTime,
      duration,
      tags: [
        { key: 'component.type', value: 'gitlab-ci' },
        { key: 'component.id', value: node.id },
        { key: 'pipeline.id', value: pipeline.id },
        { key: 'pipeline.iid', value: String(pipeline.iid) },
        { key: 'pipeline.status', value: pipeline.status },
        { key: 'pipeline.ref', value: pipeline.ref },
        { key: 'pipeline.source', value: pipeline.source },
      ],
      logs: [],
    };

    // Добавляем job-specific tags
    if (job) {
      span.tags.push(
        { key: 'job.id', value: job.id },
        { key: 'job.name', value: job.name },
        { key: 'job.stage', value: job.stage },
        { key: 'job.status', value: job.status },
        { key: 'job.runner_id', value: job.runnerId || 'none' },
      );

      if (job.duration) {
        span.tags.push({ key: 'job.duration_ms', value: String(job.duration) });
      }
    }

    // Добавляем error tag если есть ошибка
    if (pipeline.status === 'failed' || (job && job.status === 'failed')) {
      span.tags.push({ key: 'error', value: true });
      span.logs.push({
        timestamp: endTime,
        fields: [
          { key: 'event', value: 'error' },
          { key: 'error.message', value: job ? `Job ${job.name} failed` : `Pipeline ${pipeline.iid} failed` },
        ],
      });
    }

    // Отправляем span в Jaeger
    jaegerEngine.receiveSpan(span);
  }

  /**
   * Генерирует trace ID для pipeline
   */
  private generateTraceId(pipelineId: string): string {
    // Используем hash от pipelineId для стабильности
    let hash = 0;
    for (let i = 0; i < pipelineId.length; i++) {
      const char = pipelineId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  /**
   * Генерирует span ID
   */
  private generateSpanId(): string {
    return Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0');
  }

  /**
   * Интеграция с Docker для выполнения job через Docker executor
   * Создает контейнер для выполнения job
   */
  async executeJobWithDocker(
    node: CanvasNode,
    dockerEngine: DockerEmulationEngine,
    job: GitLabCIJob,
    pipeline: GitLabCIPipeline
  ): Promise<{ success: boolean; containerId?: string; error?: string }> {
    if (!job.script || job.script.length === 0) {
      return { success: true }; // Нет скрипта - пропускаем
    }

    // Определяем образ для контейнера
    const image = job.image || 'alpine:latest';
    const containerName = `gitlab-ci-job-${job.id.slice(0, 8)}`;

    try {
      // Создаем контейнер для job
      // В симуляции это будет виртуальный контейнер
      const containerId = `container-${job.id}`;
      
      // В реальном режиме можно использовать dockerEngine для создания реального контейнера
      // Но в симуляции мы просто логируем
      
      return {
        success: true,
        containerId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Интеграция с Kubernetes для выполнения job через Kubernetes executor
   * Создает pod для выполнения job
   */
  async executeJobWithKubernetes(
    node: CanvasNode,
    kubernetesEngine: KubernetesEmulationEngine,
    job: GitLabCIJob,
    pipeline: GitLabCIPipeline
  ): Promise<{ success: boolean; podId?: string; error?: string }> {
    if (!job.script || job.script.length === 0) {
      return { success: true }; // Нет скрипта - пропускаем
    }

    // Определяем образ для pod
    const image = job.image || 'alpine:latest';
    const podName = `gitlab-ci-job-${job.id.slice(0, 8)}`;

    try {
      // Создаем pod для job
      // В симуляции это будет виртуальный pod
      const podId = `pod-${job.id}`;
      
      // В реальном режиме можно использовать kubernetesEngine для создания реального pod
      // Но в симуляции мы просто логируем
      
      return {
        success: true,
        podId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Выполняет job с интеграцией с другими компонентами через DataFlowEngine
   * Определяет целевые компоненты из конфигурации job и отправляет данные
   */
  async executeJobWithIntegration(
    job: GitLabCIJob,
    pipeline: GitLabCIPipeline
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.node || !job.integrations) {
      return { success: true }; // Нет интеграций - пропускаем
    }

    try {
      // Обрабатываем деплой
      if (job.integrations.deploy && job.integrations.deploy.targetComponentId) {
        const deployResult = await this.deployToKubernetes(
          job,
          pipeline,
          job.integrations.deploy.targetComponentId,
          job.integrations.deploy.deployType || 'deployment',
          job.integrations.deploy.manifests || []
        );
        if (!deployResult.success) {
          return { success: false, error: deployResult.error };
        }
      }

      // Обрабатываем отправку артефактов
      if (job.integrations.upload && job.integrations.upload.targetComponentId) {
        const uploadResult = await this.uploadArtifactsToS3(
          job,
          pipeline,
          job.integrations.upload.targetComponentId,
          job.integrations.upload.bucket || 'artifacts',
          job.integrations.upload.path || '',
          job.artifacts || []
        );
        if (!uploadResult.success) {
          return { success: false, error: uploadResult.error };
        }
      }

      // Обрабатываем уведомления
      if (job.integrations.notify && job.integrations.notify.targetComponentId) {
        const notifyResult = await this.sendNotification(
          job,
          pipeline,
          job.integrations.notify.targetComponentId,
          job.integrations.notify.notificationType || 'job_complete',
          {
            jobName: job.name,
            jobStatus: job.status,
            pipelineId: pipeline.id,
            pipelineIid: pipeline.iid,
          }
        );
        if (!notifyResult.success) {
          return { success: false, error: notifyResult.error };
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during integration',
      };
    }
  }

  /**
   * Деплой в Kubernetes через DataFlowEngine
   */
  async deployToKubernetes(
    job: GitLabCIJob,
    pipeline: GitLabCIPipeline,
    targetComponentId: string,
    deployType: 'deployment' | 'service' | 'configmap' | 'secret',
    manifests: unknown[]
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.node) {
      return { success: false, error: 'Node not initialized' };
    }

    try {
      // Отправляем сообщение через DataFlowEngine
      const message = dataFlowEngine.addMessage({
        source: this.node.id,
        target: targetComponentId,
        format: 'json',
        payload: {
          operation: 'deploy',
          deployType,
          manifests,
          source: 'gitlab-ci',
          jobId: job.id,
          jobName: job.name,
          pipelineId: pipeline.id,
          pipelineIid: pipeline.iid,
        },
        size: JSON.stringify(manifests).length,
        metadata: {
          operation: 'deploy',
          contentType: 'application/json',
        },
      });

      if (message.status === 'failed') {
        return { success: false, error: message.error || 'Failed to send deploy message' };
      }

      // Добавляем в логи job
      if (job.logs) {
        job.logs.push(`[Integration] Deploying to Kubernetes component: ${targetComponentId}`);
        job.logs.push(`[Integration] Deploy type: ${deployType}`);
        job.logs.push(`[Integration] Manifests count: ${Array.isArray(manifests) ? manifests.length : 0}`);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during Kubernetes deploy',
      };
    }
  }

  /**
   * Отправка артефактов в S3 через DataFlowEngine
   */
  async uploadArtifactsToS3(
    job: GitLabCIJob,
    pipeline: GitLabCIPipeline,
    targetComponentId: string,
    bucket: string,
    path: string,
    artifacts: string[]
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.node) {
      return { success: false, error: 'Node not initialized' };
    }

    try {
      // Отправляем сообщение через DataFlowEngine
      const message = dataFlowEngine.addMessage({
        source: this.node.id,
        target: targetComponentId,
        format: 'json',
        payload: {
          operation: 'upload',
          bucket,
          path,
          artifacts,
          source: 'gitlab-ci',
          jobId: job.id,
          jobName: job.name,
          pipelineId: pipeline.id,
          pipelineIid: pipeline.iid,
        },
        size: JSON.stringify(artifacts).length,
        metadata: {
          operation: 'upload',
          contentType: 'application/json',
        },
      });

      if (message.status === 'failed') {
        return { success: false, error: message.error || 'Failed to send upload message' };
      }

      // Добавляем в логи job
      if (job.logs) {
        job.logs.push(`[Integration] Uploading artifacts to S3 component: ${targetComponentId}`);
        job.logs.push(`[Integration] Bucket: ${bucket}, Path: ${path}`);
        job.logs.push(`[Integration] Artifacts count: ${artifacts.length}`);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during S3 upload',
      };
    }
  }

  /**
   * Отправка уведомлений через DataFlowEngine
   */
  async sendNotification(
    job: GitLabCIJob,
    pipeline: GitLabCIPipeline,
    targetComponentId: string,
    notificationType: string,
    notification: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.node) {
      return { success: false, error: 'Node not initialized' };
    }

    try {
      // Отправляем сообщение через DataFlowEngine
      const message = dataFlowEngine.addMessage({
        source: this.node.id,
        target: targetComponentId,
        format: 'json',
        payload: {
          operation: 'notify',
          notificationType,
          notification,
          source: 'gitlab-ci',
          jobId: job.id,
          jobName: job.name,
          pipelineId: pipeline.id,
          pipelineIid: pipeline.iid,
        },
        size: JSON.stringify(notification).length,
        metadata: {
          operation: 'notify',
          contentType: 'application/json',
        },
      });

      if (message.status === 'failed') {
        return { success: false, error: message.error || 'Failed to send notification message' };
      }

      // Добавляем в логи job
      if (job.logs) {
        job.logs.push(`[Integration] Sending notification to component: ${targetComponentId}`);
        job.logs.push(`[Integration] Notification type: ${notificationType}`);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during notification',
      };
    }
  }

  /**
   * Автоматическая отправка результатов пайплайна в другие компоненты
   * Вызывается при завершении пайплайна
   */
  async sendPipelineResults(
    pipeline: GitLabCIPipeline,
    resultDestinations?: Array<{
      targetComponentId: string;
      format?: 'prometheus' | 'loki' | 'pagerduty' | 's3' | 'json';
      condition?: 'always' | 'on_success' | 'on_failure';
    }>
  ): Promise<void> {
    if (!this.node || !resultDestinations || resultDestinations.length === 0) {
      return; // Нет destinations - пропускаем
    }

    // Определяем условие отправки
    const shouldSend = (condition?: string): boolean => {
      if (!condition || condition === 'always') return true;
      if (condition === 'on_success' && pipeline.status === 'success') return true;
      if (condition === 'on_failure' && pipeline.status === 'failed') return true;
      return false;
    };

    for (const destination of resultDestinations) {
      if (!shouldSend(destination.condition)) {
        continue; // Условие не выполнено
      }

      try {
        const pipelineResults = {
          pipelineId: pipeline.id,
          pipelineIid: pipeline.iid,
          status: pipeline.status,
          ref: pipeline.ref,
          source: pipeline.source,
          duration: pipeline.duration,
          createdAt: pipeline.createdAt,
          finishedAt: pipeline.finishedAt,
          stages: pipeline.stages.map(s => ({
            name: s.name,
            status: s.status,
            duration: s.duration,
            jobsCount: s.jobs.length,
          })),
          mergeRequest: pipeline.mergeRequest,
        };

        // Отправляем результаты в зависимости от формата
        const message = dataFlowEngine.addMessage({
          source: this.node.id,
          target: destination.targetComponentId,
          format: destination.format === 'json' ? 'json' : 'json',
          payload: {
            operation: 'pipeline_results',
            format: destination.format || 'json',
            results: pipelineResults,
            source: 'gitlab-ci',
          },
          size: JSON.stringify(pipelineResults).length,
          metadata: {
            operation: 'pipeline_results',
            contentType: 'application/json',
            format: destination.format,
          },
        });

        if (message.status === 'failed') {
          console.warn(`Failed to send pipeline results to ${destination.targetComponentId}: ${message.error}`);
        }
      } catch (error) {
        console.warn(`Error sending pipeline results to ${destination.targetComponentId}:`, error);
      }
    }
  }
}


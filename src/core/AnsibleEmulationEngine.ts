import { CanvasNode } from '@/types';
import { ComponentMetrics } from './EmulationEngine';

/**
 * Ansible Job Status
 */
export type JobStatus = 'new' | 'pending' | 'waiting' | 'running' | 'successful' | 'failed' | 'error' | 'canceled';

/**
 * Ansible Host Status
 */
export type HostStatus = 'ok' | 'changed' | 'unreachable' | 'failed' | 'skipped';

/**
 * Ansible Inventory
 */
export interface AnsibleInventory {
  id: string;
  name: string;
  description?: string;
  type: 'static' | 'dynamic' | 'smart';
  organization?: string;
  variables?: Record<string, any>;
  hosts?: Array<{
    id: string;
    name: string;
    description?: string;
    enabled: boolean;
    groups: string[];
    variables?: Record<string, any>;
  }>;
  groups?: Array<{
    id: string;
    name: string;
    description?: string;
    hosts: string[];
    variables?: Record<string, any>;
    children?: string[]; // Child group names
  }>;
  hostFilter?: string; // For smart inventories
  source?: string; // For dynamic inventories
  lastSync?: number;
}

/**
 * Ansible Project
 */
export interface AnsibleProject {
  id: string;
  name: string;
  description?: string;
  organization?: string;
  scmType: 'git' | 'svn' | 'insights' | 'manual' | 'archive';
  scmUrl?: string;
  scmBranch?: string;
  scmCredential?: string;
  scmUpdateOnLaunch?: boolean;
  scmUpdateCacheTimeout?: number;
  scmClean?: boolean;
  scmDeleteOnUpdate?: boolean;
  scmRevision?: string;
  lastUpdateTime?: number;
  lastUpdateFailed?: boolean;
  status?: 'new' | 'waiting' | 'running' | 'successful' | 'failed' | 'error' | 'canceled';
  playbooks?: string[];
  localPath?: string;
}

/**
 * Ansible Credential
 */
export interface AnsibleCredential {
  id: string;
  name: string;
  description?: string;
  organization?: string;
  credentialType: 'machine' | 'vault' | 'source_control' | 'cloud' | 'network' | 'insights';
  inputs?: Record<string, any>;
  // For machine credentials
  username?: string;
  password?: string;
  sshKey?: string;
  sshKeyUnlock?: string;
  becomeMethod?: 'sudo' | 'su' | 'pbrun' | 'pfexec' | 'dzdo' | 'pmrun' | 'runas';
  becomeUsername?: string;
  becomePassword?: string;
  // For vault credentials
  vaultPassword?: string;
  vaultId?: string;
  // For cloud credentials
  cloudProvider?: 'aws' | 'azure' | 'gcp' | 'openstack';
  // For source control
  scmUsername?: string;
  scmPassword?: string;
  scmSshKey?: string;
}

/**
 * Ansible Job Template
 */
export interface AnsibleJobTemplate {
  id: string;
  name: string;
  description?: string;
  organization?: string;
  inventory: string; // Inventory ID
  project: string; // Project ID
  playbook: string; // Path to playbook
  credential?: string; // Credential ID
  vaultCredential?: string; // Vault credential ID
  enabled: boolean;
  askInventoryOnLaunch?: boolean;
  askVariablesOnLaunch?: boolean;
  askLimitOnLaunch?: boolean;
  askTagsOnLaunch?: boolean;
  askSkipTagsOnLaunch?: boolean;
  askJobTypeOnLaunch?: boolean;
  askVerbosityOnLaunch?: boolean;
  askCredentialOnLaunch?: boolean;
  askVaultCredentialOnLaunch?: boolean;
  askLabelsOnLaunch?: boolean;
  askForksOnLaunch?: boolean;
  askInstanceGroupsOnLaunch?: boolean;
  askTimeoutOnLaunch?: boolean;
  jobType: 'run' | 'check';
  becomeEnabled?: boolean;
  becomeUser?: string;
  becomeMethod?: string;
  diffMode?: boolean;
  forks?: number;
  limit?: string;
  verbosity?: 0 | 1 | 2 | 3 | 4;
  extraVars?: string; // YAML string
  jobTags?: string; // Comma-separated
  skipTags?: string; // Comma-separated
  timeout?: number; // seconds
  instanceGroups?: string[];
  labels?: string[];
  surveyEnabled?: boolean;
  survey?: any;
  webhookService?: string;
  webhookCredential?: string;
  lastJobRun?: string; // Job ID
  lastJobStatus?: JobStatus;
  lastJobStarted?: number;
  lastJobFinished?: number;
}

/**
 * Ansible Job
 */
export interface AnsibleJob {
  id: string;
  name: string;
  type: 'job' | 'ad_hoc_command' | 'system_job' | 'project_update' | 'inventory_update' | 'workflow_job';
  status: JobStatus;
  jobTemplate?: string; // Template ID
  jobTemplateName?: string;
  inventory?: string; // Inventory ID
  inventoryName?: string;
  project?: string; // Project ID
  projectName?: string;
  playbook?: string;
  credential?: string;
  vaultCredential?: string;
  organization?: string;
  created: number;
  started?: number;
  finished?: number;
  elapsed?: number; // seconds
  launchedBy?: {
    id: string;
    username: string;
    first_name?: string;
    last_name?: string;
  };
  jobArgs?: string;
  jobCwd?: string;
  jobEnv?: Record<string, string>;
  jobExplanation?: string;
  executionEnvironment?: string;
  forks?: number;
  limit?: string;
  verbosity?: number;
  extraVars?: string;
  jobTags?: string;
  skipTags?: string;
  timeout?: number;
  becomeEnabled?: boolean;
  hosts?: Array<{
    id: string;
    name: string;
    status: HostStatus;
    failed?: boolean;
    changed?: boolean;
    unreachable?: boolean;
    skipped?: boolean;
    ansibleFacts?: Record<string, any>;
  }>;
  resultSummary?: {
    ok: number;
    changed: number;
    unreachable: number;
    failed: number;
    skipped: number;
  };
  artifactResults?: Record<string, any>;
  canceled?: boolean;
  canceledBy?: string;
  cancelReason?: string;
  executionNode?: string;
}

/**
 * Ansible Schedule
 */
export interface AnsibleSchedule {
  id: string;
  name: string;
  description?: string;
  unifiedJobTemplate: string; // Job Template ID
  enabled: boolean;
  rrule: string; // iCal RRULE format
  dtstart?: string; // ISO 8601 datetime
  dtend?: string; // ISO 8601 datetime
  timezone?: string;
  nextRun?: number;
  lastRun?: number;
  lastRunStatus?: JobStatus;
  extraData?: Record<string, any>; // Extra vars, limit, etc.
}

/**
 * Ansible Configuration
 */
export interface AnsibleEmulationConfig {
  towerUrl?: string;
  organizationName?: string;
  defaultExecutionEnvironment?: string;
  inventories?: Array<{
    id: string;
    name: string;
    description?: string;
    type?: 'static' | 'dynamic' | 'smart';
    hosts?: Array<{
      id?: string;
      name: string;
      groups?: string[];
      variables?: Record<string, any>;
    }>;
    groups?: Array<{
      id?: string;
      name: string;
      hosts?: string[];
      variables?: Record<string, any>;
      children?: string[];
    }>;
  }>;
  projects?: Array<{
    id: string;
    name: string;
    description?: string;
    scmType?: 'git' | 'svn' | 'insights' | 'manual' | 'archive';
    scmUrl?: string;
    scmBranch?: string;
    playbooks?: string[];
  }>;
  credentials?: Array<{
    id: string;
    name: string;
    description?: string;
    credentialType?: 'machine' | 'vault' | 'source_control' | 'cloud';
    username?: string;
    password?: string;
    sshKey?: string;
    becomeMethod?: string;
    becomeUsername?: string;
  }>;
  jobTemplates?: Array<{
    id: string;
    name: string;
    description?: string;
    inventory: string;
    project: string;
    playbook: string;
    credential?: string;
    enabled?: boolean;
    jobType?: 'run' | 'check';
    becomeEnabled?: boolean;
    becomeUser?: string;
    forks?: number;
    timeout?: number;
    verbosity?: number;
  }>;
  jobs?: Array<{
    id: string;
    name?: string;
    type?: 'job' | 'ad_hoc_command';
    status?: JobStatus;
    jobTemplate?: string;
    startedAt?: string;
    finishedAt?: string;
    duration?: number;
    hosts?: Array<{
      name: string;
      status: HostStatus;
    }>;
  }>;
  schedules?: Array<{
    id: string;
    name: string;
    unifiedJobTemplate: string;
    enabled?: boolean;
    rrule?: string;
  }>;
  jobTriggerRate?: number; // jobs per hour per enabled template
  averageJobDuration?: number; // milliseconds (base duration)
  failureRate?: number; // 0-1
  hostFailureRate?: number; // 0-1, probability of individual host failure
  playbookComplexity?: number; // 0-1, affects duration
  maxForks?: number; // Maximum parallel execution
  defaultTimeout?: number; // seconds
}

/**
 * Ansible Engine Metrics
 */
export interface AnsibleEngineMetrics {
  inventoriesTotal: number;
  projectsTotal: number;
  credentialsTotal: number;
  jobTemplatesTotal: number;
  jobTemplatesEnabled: number;
  jobsTotal: number;
  jobsSuccess: number;
  jobsFailed: number;
  jobsRunning: number;
  jobsPending: number;
  jobsPerHour: number;
  averageJobDuration: number;
  hostsTotal: number;
  hostsOk: number;
  hostsChanged: number;
  hostsFailed: number;
  hostsUnreachable: number;
  schedulesTotal: number;
  schedulesEnabled: number;
  requestsTotal: number;
  requestsErrors: number;
}

/**
 * Ansible Emulation Engine
 * Симулирует работу Ansible Tower/AWX: inventories, projects, job templates, jobs, schedules, метрики
 */
export class AnsibleEmulationEngine {
  private config: AnsibleEmulationConfig | null = null;
  
  // Inventories
  private inventories: Map<string, AnsibleInventory> = new Map();
  
  // Projects
  private projects: Map<string, AnsibleProject> = new Map();
  
  // Credentials
  private credentials: Map<string, AnsibleCredential> = new Map();
  
  // Job Templates
  private jobTemplates: Map<string, AnsibleJobTemplate> = new Map();
  
  // Active jobs
  private activeJobs: Map<string, AnsibleJob> = new Map();
  
  // Completed jobs (limited history)
  private jobHistory: Map<string, AnsibleJob> = new Map();
  private readonly MAX_JOB_HISTORY = 1000;
  
  // Schedules
  private schedules: Map<string, AnsibleSchedule> = new Map();
  
  // Metrics
  private ansibleMetrics: AnsibleEngineMetrics = {
    inventoriesTotal: 0,
    projectsTotal: 0,
    credentialsTotal: 0,
    jobTemplatesTotal: 0,
    jobTemplatesEnabled: 0,
    jobsTotal: 0,
    jobsSuccess: 0,
    jobsFailed: 0,
    jobsRunning: 0,
    jobsPending: 0,
    jobsPerHour: 0,
    averageJobDuration: 0,
    hostsTotal: 0,
    hostsOk: 0,
    hostsChanged: 0,
    hostsFailed: 0,
    hostsUnreachable: 0,
    schedulesTotal: 0,
    schedulesEnabled: 0,
    requestsTotal: 0,
    requestsErrors: 0,
  };
  
  // Job history for metrics
  private jobHistoryList: Array<{ timestamp: number; duration: number; status: JobStatus }> = [];
  private readonly MAX_JOB_HISTORY_LIST = 1000;
  
  // Last job time per template
  private lastJobTime: Map<string, number> = new Map();
  
  // Schedule next run tracking
  private scheduleNextRuns: Map<string, number> = new Map();
  
  /**
   * Обрабатывает входящий запрос (API, webhook)
   */
  processRequest(success: boolean = true): void {
    this.ansibleMetrics.requestsTotal++;
    if (!success) {
      this.ansibleMetrics.requestsErrors++;
    }
  }
  
  /**
   * Инициализирует конфигурацию Ansible из конфига компонента
   */
  initializeConfig(node: CanvasNode): void {
    const config = node.data.config || {};
    
    this.config = {
      towerUrl: config.towerUrl || 'https://tower.example.com',
      organizationName: config.organizationName || 'Default',
      defaultExecutionEnvironment: config.defaultExecutionEnvironment || 'default',
      inventories: config.inventories || [],
      projects: config.projects || [],
      credentials: config.credentials || [],
      jobTemplates: config.jobTemplates || [],
      jobs: config.jobs || [],
      schedules: config.schedules || [],
      jobTriggerRate: config.jobTriggerRate || 0.5, // 0.5 jobs per hour per enabled template
      averageJobDuration: config.averageJobDuration || 120000, // 2 minutes base
      failureRate: config.failureRate ?? 0.05, // 5% failure rate
      hostFailureRate: config.hostFailureRate ?? 0.02, // 2% host failure rate
      playbookComplexity: config.playbookComplexity ?? 0.5,
      maxForks: config.maxForks || 5,
      defaultTimeout: config.defaultTimeout || 3600,
    };
    
    // Initialize inventories
    this.initializeInventories();
    
    // Initialize projects
    this.initializeProjects();
    
    // Initialize credentials
    this.initializeCredentials();
    
    // Initialize job templates
    this.initializeJobTemplates();
    
    // Initialize jobs
    this.initializeJobs();
    
    // Initialize schedules
    this.initializeSchedules();
  }
  
  /**
   * Обновляет конфигурацию (для динамических изменений)
   */
  updateConfig(node: CanvasNode): void {
    this.initializeConfig(node);
  }
  
  /**
   * Инициализирует inventories из конфига
   */
  private initializeInventories(): void {
    this.inventories.clear();
    
    const configInventories = this.config?.inventories || [];
    
    // Default inventory if none configured
    if (configInventories.length === 0) {
      const defaultInventory: AnsibleInventory = {
        id: 'default',
        name: 'Default',
        description: 'Default inventory',
        type: 'static',
        organization: this.config?.organizationName || 'Default',
        hosts: [],
        groups: [],
      };
      this.inventories.set('default', defaultInventory);
      return;
    }
    
    for (const invConfig of configInventories) {
      const inventory: AnsibleInventory = {
        id: invConfig.id,
        name: invConfig.name,
        description: invConfig.description,
        type: invConfig.type || 'static',
        organization: this.config?.organizationName || 'Default',
        hosts: (invConfig.hosts || []).map((h, idx) => ({
          id: h.id || `host-${invConfig.id}-${idx}`,
          name: h.name,
          enabled: true,
          groups: h.groups || [],
          variables: h.variables || {},
        })),
        groups: (invConfig.groups || []).map((g, idx) => ({
          id: g.id || `group-${invConfig.id}-${idx}`,
          name: g.name,
          hosts: g.hosts || [],
          variables: g.variables || {},
          children: g.children || [],
        })),
      };
      
      this.inventories.set(inventory.id, inventory);
    }
  }
  
  /**
   * Инициализирует projects из конфига
   */
  private initializeProjects(): void {
    this.projects.clear();
    
    const configProjects = this.config?.projects || [];
    
    // Default project if none configured
    if (configProjects.length === 0) {
      const defaultProject: AnsibleProject = {
        id: 'default',
        name: 'Default',
        description: 'Default project',
        organization: this.config?.organizationName || 'Default',
        scmType: 'manual',
        playbooks: ['playbook.yml'],
      };
      this.projects.set('default', defaultProject);
      return;
    }
    
    for (const projConfig of configProjects) {
      const project: AnsibleProject = {
        id: projConfig.id,
        name: projConfig.name,
        description: projConfig.description,
        organization: this.config?.organizationName || 'Default',
        scmType: projConfig.scmType || 'manual',
        scmUrl: projConfig.scmUrl,
        scmBranch: projConfig.scmBranch || 'main',
        playbooks: projConfig.playbooks || ['playbook.yml'],
        status: 'successful',
        lastUpdateTime: Date.now() - Math.random() * 86400000, // Random time in last day
      };
      
      this.projects.set(project.id, project);
    }
  }
  
  /**
   * Инициализирует credentials из конфига
   */
  private initializeCredentials(): void {
    this.credentials.clear();
    
    const configCredentials = this.config?.credentials || [];
    
    for (const credConfig of configCredentials) {
      const credential: AnsibleCredential = {
        id: credConfig.id,
        name: credConfig.name,
        description: credConfig.description,
        organization: this.config?.organizationName || 'Default',
        credentialType: credConfig.credentialType || 'machine',
        username: credConfig.username,
        password: credConfig.password,
        sshKey: credConfig.sshKey,
        becomeMethod: credConfig.becomeMethod as any,
        becomeUsername: credConfig.becomeUsername,
      };
      
      this.credentials.set(credential.id, credential);
    }
  }
  
  /**
   * Инициализирует job templates из конфига
   */
  private initializeJobTemplates(): void {
    this.jobTemplates.clear();
    
    const configTemplates = this.config?.jobTemplates || [];
    
    for (const templateConfig of configTemplates) {
      const template: AnsibleJobTemplate = {
        id: templateConfig.id,
        name: templateConfig.name,
        description: templateConfig.description,
        organization: this.config?.organizationName || 'Default',
        inventory: templateConfig.inventory,
        project: templateConfig.project,
        playbook: templateConfig.playbook,
        credential: templateConfig.credential,
        enabled: templateConfig.enabled !== false,
        jobType: templateConfig.jobType || 'run',
        becomeEnabled: templateConfig.becomeEnabled,
        becomeUser: templateConfig.becomeUser,
        forks: templateConfig.forks || this.config?.maxForks || 5,
        timeout: templateConfig.timeout || this.config?.defaultTimeout || 3600,
        verbosity: templateConfig.verbosity || 0,
      };
      
      this.jobTemplates.set(template.id, template);
    }
  }
  
  /**
   * Инициализирует jobs из конфига
   */
  private initializeJobs(): void {
    // Clear only completed jobs, keep active ones
    const activeJobIds = new Set(Array.from(this.activeJobs.keys()));
    
    // Remove completed jobs that are not in config
    const configJobIds = new Set((this.config?.jobs || []).map(j => j.id));
    for (const [jobId, job] of this.jobHistory.entries()) {
      if (!activeJobIds.has(jobId) && !configJobIds.has(jobId)) {
        this.jobHistory.delete(jobId);
      }
    }
    
    const configJobs = this.config?.jobs || [];
    for (const jobConfig of configJobs) {
      const job: AnsibleJob = {
        id: jobConfig.id,
        name: jobConfig.name || `Job ${jobConfig.id}`,
        type: jobConfig.type || 'job',
        status: jobConfig.status || 'successful',
        jobTemplate: jobConfig.jobTemplate,
        created: jobConfig.startedAt ? new Date(jobConfig.startedAt).getTime() : Date.now() - 3600000,
        started: jobConfig.startedAt ? new Date(jobConfig.startedAt).getTime() : undefined,
        finished: jobConfig.finishedAt ? new Date(jobConfig.finishedAt).getTime() : undefined,
        elapsed: jobConfig.duration,
        hosts: jobConfig.hosts?.map((h, idx) => ({
          id: `host-${jobConfig.id}-${idx}`,
          name: h.name,
          status: h.status,
          failed: h.status === 'failed' || h.status === 'unreachable',
          changed: h.status === 'changed',
          unreachable: h.status === 'unreachable',
          skipped: h.status === 'skipped',
        })),
      };
      
      if (['new', 'pending', 'waiting', 'running'].includes(job.status)) {
        this.activeJobs.set(job.id, job);
      } else {
        this.jobHistory.set(job.id, job);
      }
    }
  }
  
  /**
   * Инициализирует schedules из конфига
   */
  private initializeSchedules(): void {
    this.schedules.clear();
    
    const configSchedules = this.config?.schedules || [];
    
    for (const schedConfig of configSchedules) {
      const schedule: AnsibleSchedule = {
        id: schedConfig.id,
        name: schedConfig.name,
        unifiedJobTemplate: schedConfig.unifiedJobTemplate,
        enabled: schedConfig.enabled !== false,
        rrule: schedConfig.rrule || 'DTSTART:20240101T000000Z\nRRULE:FREQ=HOURLY;INTERVAL=1',
        nextRun: Date.now() + 3600000, // 1 hour from now
      };
      
      this.schedules.set(schedule.id, schedule);
      this.scheduleNextRuns.set(schedule.id, schedule.nextRun || Date.now() + 3600000);
    }
  }
  
  /**
   * Выполняет один цикл обновления Ansible
   * Должен вызываться периодически в EmulationEngine
   */
  performUpdate(currentTime: number): void {
    if (!this.config) return;
    
    // Update active jobs
    this.updateActiveJobs(currentTime);
    
    // Trigger scheduled jobs
    this.triggerScheduledJobs(currentTime);
    
    // Trigger automatic jobs from templates if enabled
    this.triggerAutomaticJobs(currentTime);
    
    // Update metrics
    this.updateMetrics();
  }
  
  /**
   * Обновляет активные jobs
   */
  private updateActiveJobs(currentTime: number): void {
    const jobsToProcess = Array.from(this.activeJobs.entries());
    
    for (const [jobId, job] of jobsToProcess) {
      if (!['new', 'pending', 'waiting', 'running'].includes(job.status)) {
        // Move to history
        this.jobHistory.set(jobId, job);
        if (this.jobHistory.size > this.MAX_JOB_HISTORY) {
          const firstKey = this.jobHistory.keys().next().value;
          if (firstKey) this.jobHistory.delete(firstKey);
        }
        this.activeJobs.delete(jobId);
        continue;
      }
      
      if (!job.started) {
        // Job just started
        job.started = currentTime;
        job.status = 'running';
        continue;
      }
      
      const elapsed = (currentTime - job.started) / 1000; // seconds
      
      // Calculate base duration
      const baseDuration = this.config?.averageJobDuration || 120000; // 2 minutes
      const complexity = this.config?.playbookComplexity || 0.5;
      const durationVariation = 0.3; // ±30%
      const baseDurationMs = baseDuration * (1 + complexity * 0.5) * (1 + (Math.random() - 0.5) * durationVariation);
      
      const expectedDuration = baseDurationMs / 1000; // seconds
      
      // Check if job should finish
      if (elapsed >= expectedDuration) {
        // Determine success/failure
        const shouldFail = Math.random() < (this.config?.failureRate || 0.05);
        
        if (shouldFail) {
          job.status = 'failed';
        } else {
          job.status = 'successful';
        }
        
        job.finished = currentTime;
        job.elapsed = elapsed;
        
        // Update hosts status
        if (job.hosts && job.hosts.length > 0) {
          const hostFailureRate = this.config?.hostFailureRate || 0.02;
          for (const host of job.hosts) {
            if (job.status === 'failed') {
              // If job failed, some hosts might fail
              if (Math.random() < hostFailureRate * 2) {
                host.status = Math.random() < 0.5 ? 'failed' : 'unreachable';
                host.failed = true;
              } else if (Math.random() < 0.3) {
                host.status = 'changed';
                host.changed = true;
              } else {
                host.status = 'ok';
              }
            } else {
              // Job successful, but some hosts might still have issues
              if (Math.random() < hostFailureRate) {
                host.status = 'unreachable';
                host.unreachable = true;
              } else if (Math.random() < 0.4) {
                host.status = 'changed';
                host.changed = true;
              } else {
                host.status = 'ok';
              }
            }
          }
        }
        
        // Calculate result summary
        if (job.hosts) {
          job.resultSummary = {
            ok: job.hosts.filter(h => h.status === 'ok').length,
            changed: job.hosts.filter(h => h.status === 'changed').length,
            unreachable: job.hosts.filter(h => h.status === 'unreachable').length,
            failed: job.hosts.filter(h => h.status === 'failed').length,
            skipped: job.hosts.filter(h => h.status === 'skipped').length,
          };
        }
        
        // Add to history for metrics
        this.jobHistoryList.push({
          timestamp: currentTime,
          duration: elapsed,
          status: job.status,
        });
        if (this.jobHistoryList.length > this.MAX_JOB_HISTORY_LIST) {
          this.jobHistoryList.shift();
        }
      } else {
        // Job still running, update elapsed
        job.elapsed = elapsed;
        
        // Update progress for hosts (simulate)
        if (job.hosts) {
          const progress = elapsed / expectedDuration;
          // Some hosts might finish earlier (simulate parallel execution)
          for (let i = 0; i < job.hosts.length; i++) {
            const hostProgress = progress + (Math.random() - 0.5) * 0.2;
            if (hostProgress >= 0.9 && job.hosts[i].status === 'ok') {
              // Host finished
              if (Math.random() < 0.3) {
                job.hosts[i].status = 'changed';
                job.hosts[i].changed = true;
              }
            }
          }
        }
      }
    }
  }
  
  /**
   * Триггерит scheduled jobs
   */
  private triggerScheduledJobs(currentTime: number): void {
    for (const [scheduleId, schedule] of this.schedules.entries()) {
      if (!schedule.enabled) continue;
      
      const nextRun = this.scheduleNextRuns.get(scheduleId);
      if (!nextRun || currentTime < nextRun) continue;
      
      // Trigger job from template
      const template = this.jobTemplates.get(schedule.unifiedJobTemplate);
      if (!template || !template.enabled) continue;
      
      this.launchJobFromTemplate(template.id, schedule.extraData || {});
      
      // Calculate next run (simple hourly for now)
      const nextRunTime = currentTime + 3600000; // 1 hour
      this.scheduleNextRuns.set(scheduleId, nextRunTime);
      schedule.nextRun = nextRunTime;
      schedule.lastRun = currentTime;
    }
  }
  
  /**
   * Триггерит automatic jobs from templates
   */
  private triggerAutomaticJobs(currentTime: number): void {
    if (!this.config) return;
    
    const triggerRate = this.config.jobTriggerRate || 0.5; // jobs per hour per template
    const triggerInterval = 3600000 / triggerRate; // milliseconds between triggers
    
    for (const [templateId, template] of this.jobTemplates.entries()) {
      if (!template.enabled) continue;
      
      const lastJobTime = this.lastJobTime.get(templateId) || 0;
      const timeSinceLastJob = currentTime - lastJobTime;
      
      if (timeSinceLastJob >= triggerInterval) {
        // Random chance to trigger (to avoid all templates triggering at once)
        if (Math.random() < 0.1) { // 10% chance per check
          this.launchJobFromTemplate(templateId);
          this.lastJobTime.set(templateId, currentTime);
        }
      }
    }
  }
  
  /**
   * Запускает job из template
   */
  launchJobFromTemplate(templateId: string, extraData?: Record<string, any>): AnsibleJob | null {
    const template = this.jobTemplates.get(templateId);
    if (!template || !template.enabled) return null;
    
    const inventory = this.inventories.get(template.inventory);
    if (!inventory) return null;
    
    const project = this.projects.get(template.project);
    if (!project) return null;
    
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Get hosts from inventory
    const hosts = inventory.hosts || [];
    
    const job: AnsibleJob = {
      id: jobId,
      name: `${template.name} - ${new Date().toISOString()}`,
      type: 'job',
      status: 'pending',
      jobTemplate: templateId,
      jobTemplateName: template.name,
      inventory: template.inventory,
      inventoryName: inventory.name,
      project: template.project,
      projectName: project.name,
      playbook: template.playbook,
      credential: template.credential,
      vaultCredential: template.vaultCredential,
      organization: template.organization,
      created: Date.now(),
      jobType: template.jobType,
      becomeEnabled: template.becomeEnabled,
      forks: template.forks || this.config?.maxForks || 5,
      limit: template.limit || extraData?.limit,
      verbosity: template.verbosity || 0,
      extraVars: template.extraVars || extraData?.extraVars,
      jobTags: template.jobTags || extraData?.jobTags,
      skipTags: template.skipTags || extraData?.skipTags,
      timeout: template.timeout || this.config?.defaultTimeout || 3600,
      hosts: hosts.map((h, idx) => ({
        id: h.id,
        name: h.name,
        status: 'ok', // Will be updated during execution
        failed: false,
        changed: false,
        unreachable: false,
        skipped: false,
      })),
    };
    
    this.activeJobs.set(jobId, job);
    
    // Update template last job info
    template.lastJobRun = jobId;
    template.lastJobStatus = 'running';
    template.lastJobStarted = Date.now();
    
    return job;
  }
  
  /**
   * Обновляет метрики
   */
  private updateMetrics(): void {
    // Count inventories
    this.ansibleMetrics.inventoriesTotal = this.inventories.size;
    
    // Count projects
    this.ansibleMetrics.projectsTotal = this.projects.size;
    
    // Count credentials
    this.ansibleMetrics.credentialsTotal = this.credentials.size;
    
    // Count job templates
    this.ansibleMetrics.jobTemplatesTotal = this.jobTemplates.size;
    this.ansibleMetrics.jobTemplatesEnabled = Array.from(this.jobTemplates.values())
      .filter(t => t.enabled).length;
    
    // Count jobs
    const allJobs = [...this.activeJobs.values(), ...this.jobHistory.values()];
    this.ansibleMetrics.jobsTotal = allJobs.length;
    this.ansibleMetrics.jobsSuccess = allJobs.filter(j => j.status === 'successful').length;
    this.ansibleMetrics.jobsFailed = allJobs.filter(j => j.status === 'failed' || j.status === 'error').length;
    this.ansibleMetrics.jobsRunning = this.activeJobs.size;
    this.ansibleMetrics.jobsPending = Array.from(this.activeJobs.values())
      .filter(j => j.status === 'pending' || j.status === 'waiting').length;
    
    // Calculate jobs per hour from history
    const oneHourAgo = Date.now() - 3600000;
    const recentJobs = this.jobHistoryList.filter(j => j.timestamp >= oneHourAgo);
    this.ansibleMetrics.jobsPerHour = recentJobs.length;
    
    // Calculate average job duration
    if (this.jobHistoryList.length > 0) {
      const totalDuration = this.jobHistoryList.reduce((sum, j) => sum + j.duration, 0);
      this.ansibleMetrics.averageJobDuration = totalDuration / this.jobHistoryList.length;
    } else {
      this.ansibleMetrics.averageJobDuration = 0;
    }
    
    // Count hosts (from all inventories)
    let hostsTotal = 0;
    let hostsOk = 0;
    let hostsChanged = 0;
    let hostsFailed = 0;
    let hostsUnreachable = 0;
    
    for (const inventory of this.inventories.values()) {
      hostsTotal += inventory.hosts?.length || 0;
    }
    
    // Count hosts from active jobs
    for (const job of this.activeJobs.values()) {
      if (job.hosts) {
        for (const host of job.hosts) {
          if (host.status === 'ok') hostsOk++;
          if (host.status === 'changed') hostsChanged++;
          if (host.status === 'failed') hostsFailed++;
          if (host.status === 'unreachable') hostsUnreachable++;
        }
      }
    }
    
    this.ansibleMetrics.hostsTotal = hostsTotal;
    this.ansibleMetrics.hostsOk = hostsOk;
    this.ansibleMetrics.hostsChanged = hostsChanged;
    this.ansibleMetrics.hostsFailed = hostsFailed;
    this.ansibleMetrics.hostsUnreachable = hostsUnreachable;
    
    // Count schedules
    this.ansibleMetrics.schedulesTotal = this.schedules.size;
    this.ansibleMetrics.schedulesEnabled = Array.from(this.schedules.values())
      .filter(s => s.enabled).length;
  }
  
  /**
   * Получает метрики движка
   */
  getMetrics(): AnsibleEngineMetrics {
    return { ...this.ansibleMetrics };
  }
  
  /**
   * Получает все inventories
   */
  getInventories(): AnsibleInventory[] {
    return Array.from(this.inventories.values());
  }
  
  /**
   * Получает все projects
   */
  getProjects(): AnsibleProject[] {
    return Array.from(this.projects.values());
  }
  
  /**
   * Получает все credentials
   */
  getCredentials(): AnsibleCredential[] {
    return Array.from(this.credentials.values());
  }
  
  /**
   * Получает все job templates
   */
  getJobTemplates(): AnsibleJobTemplate[] {
    return Array.from(this.jobTemplates.values());
  }
  
  /**
   * Получает активные jobs
   */
  getActiveJobs(): AnsibleJob[] {
    return Array.from(this.activeJobs.values());
  }
  
  /**
   * Получает все jobs (активные + история)
   */
  getAllJobs(): AnsibleJob[] {
    return [...Array.from(this.activeJobs.values()), ...Array.from(this.jobHistory.values())];
  }
  
  /**
   * Получает job по ID
   */
  getJob(jobId: string): AnsibleJob | undefined {
    return this.activeJobs.get(jobId) || this.jobHistory.get(jobId);
  }
  
  /**
   * Получает все schedules
   */
  getSchedules(): AnsibleSchedule[] {
    return Array.from(this.schedules.values());
  }
  
  /**
   * Получает логи job (симулированные)
   */
  getJobLogs(jobId: string): string[] {
    const job = this.getJob(jobId);
    if (!job) return [];
    
    const logs: string[] = [];
    logs.push(`Starting job ${job.name} (ID: ${job.id})`);
    logs.push(`Job Template: ${job.jobTemplateName || 'N/A'}`);
    logs.push(`Inventory: ${job.inventoryName || 'N/A'}`);
    logs.push(`Playbook: ${job.playbook || 'N/A'}`);
    
    if (job.hosts) {
      logs.push(`\nRunning on ${job.hosts.length} host(s)...`);
      for (const host of job.hosts) {
        logs.push(`\n${host.name}:`);
        if (host.status === 'ok') {
          logs.push(`  OK - Task completed successfully`);
        } else if (host.status === 'changed') {
          logs.push(`  CHANGED - Task made changes to the system`);
        } else if (host.status === 'failed') {
          logs.push(`  FAILED - Task failed to execute`);
        } else if (host.status === 'unreachable') {
          logs.push(`  UNREACHABLE - Host is unreachable`);
        } else if (host.status === 'skipped') {
          logs.push(`  SKIPPED - Task was skipped`);
        }
      }
    }
    
    if (job.resultSummary) {
      logs.push(`\nPLAY RECAP`);
      logs.push(`ok: ${job.resultSummary.ok}, changed: ${job.resultSummary.changed}, unreachable: ${job.resultSummary.unreachable}, failed: ${job.resultSummary.failed}, skipped: ${job.resultSummary.skipped}`);
    }
    
    if (job.status === 'successful') {
      logs.push(`\nJob completed successfully in ${job.elapsed?.toFixed(2)}s`);
    } else if (job.status === 'failed') {
      logs.push(`\nJob failed after ${job.elapsed?.toFixed(2)}s`);
    }
    
    return logs;
  }
  
  /**
   * Отменяет job
   */
  cancelJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (!job || !['pending', 'waiting', 'running'].includes(job.status)) {
      return false;
    }
    
    job.status = 'canceled';
    job.canceled = true;
    job.canceledBy = 'user';
    job.finished = Date.now();
    if (job.started) {
      job.elapsed = (Date.now() - job.started) / 1000;
    }
    
    // Move to history
    this.jobHistory.set(jobId, job);
    this.activeJobs.delete(jobId);
    
    return true;
  }
}


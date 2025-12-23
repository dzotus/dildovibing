import { CanvasNode } from '@/types';
import { ComponentMetrics } from './EmulationEngine';

/**
 * Terraform Run Status
 */
export type RunStatus = 'pending' | 'planning' | 'planned' | 'applying' | 'applied' | 'errored' | 'canceled';

/**
 * Terraform Workspace
 */
export interface TerraformWorkspace {
  id: string;
  name: string;
  description?: string;
  terraformVersion?: string;
  autoApply?: boolean;
  queueAllRuns?: boolean;
  workingDirectory?: string;
  vcsRepo?: {
    identifier: string;
    branch: string;
    oauthTokenId?: string;
  };
  variables?: Array<{
    key: string;
    value: string;
    category?: 'terraform' | 'env';
    sensitive?: boolean;
    hcl?: boolean;
  }>;
  lastRun?: {
    id: string;
    status: RunStatus;
    createdAt: number;
  };
}

/**
 * Terraform Run
 */
export interface TerraformRun {
  id: string;
  workspaceId: string;
  workspaceName: string;
  status: RunStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  planOnly?: boolean;
  message?: string;
  duration?: number;
  resourceAdditions?: number;
  resourceChanges?: number;
  resourceDestructions?: number;
  hasChanges?: boolean;
  error?: string;
  triggeredBy?: string;
  source?: string; // 'vcs' | 'api' | 'cli' | 'webhook'
}

/**
 * Terraform State
 */
export interface TerraformState {
  id: string;
  workspaceId: string;
  workspaceName: string;
  version: number;
  serial: number;
  lineage?: string;
  resources?: number;
  outputs?: Record<string, any>;
  updatedAt: number;
  createdAt: number;
}

/**
 * Terraform Configuration
 */
export interface TerraformEmulationConfig {
  organizationName?: string;
  enableVCS?: boolean;
  enableStateLocking?: boolean;
  enableRemoteState?: boolean;
  defaultTerraformVersion?: string;
  workspaces?: Array<{
    id: string;
    name: string;
    description?: string;
    terraformVersion?: string;
    autoApply?: boolean;
    queueAllRuns?: boolean;
    workingDirectory?: string;
    vcsRepo?: {
      identifier: string;
      branch: string;
      oauthTokenId?: string;
    };
    variables?: Array<{
      key: string;
      value: string;
      category?: 'terraform' | 'env';
      sensitive?: boolean;
      hcl?: boolean;
    }>;
  }>;
  runs?: Array<{
    id: string;
    workspace: string;
    status?: RunStatus;
    createdAt?: string;
    planOnly?: boolean;
    message?: string;
    duration?: number;
  }>;
  states?: Array<{
    id: string;
    workspace: string;
    version?: number;
    serial?: number;
    resources?: number;
    updatedAt?: string;
  }>;
  runTriggerRate?: number; // runs per hour per workspace
  averagePlanDuration?: number; // milliseconds (base duration)
  averageApplyDuration?: number; // milliseconds (base duration)
  failureRate?: number; // 0-1
  changeProbability?: number; // 0-1, probability of changes in plan (default 0.7)
  maxResourceAdditions?: number; // max resources added per run (default 10)
  maxResourceChanges?: number; // max resources changed per run (default 5)
  maxResourceDestructions?: number; // max resources destroyed per run (default 3)
  vcsWebhookProbability?: number; // 0-1, probability of VCS webhook per hour (default 0.3)
  defaultStateResources?: number; // default number of resources for new state (default 10)
  durationVariation?: number; // 0-1, variation in durations ±X% (default 0.3)
  resourceTimeMultiplier?: number; // milliseconds per resource for plan/apply (default 500)
}

/**
 * Terraform Engine Metrics
 */
export interface TerraformEngineMetrics {
  workspacesTotal: number;
  runsTotal: number;
  runsSuccess: number;
  runsFailed: number;
  runsRunning: number;
  runsPending: number;
  runsPerHour: number;
  averageRunDuration: number;
  statesTotal: number;
  resourcesManaged: number;
  requestsTotal: number;
  requestsErrors: number;
}

/**
 * Terraform Emulation Engine
 * Симулирует работу Terraform Cloud/Enterprise: workspaces, runs, state management, метрики
 */
export class TerraformEmulationEngine {
  private config: TerraformEmulationConfig | null = null;
  
  // Workspaces
  private workspaces: Map<string, TerraformWorkspace> = new Map();
  
  // Active runs
  private activeRuns: Map<string, TerraformRun> = new Map();
  
  // Completed runs (limited history)
  private runHistory: Map<string, TerraformRun> = new Map();
  private readonly MAX_RUN_HISTORY = 1000;
  
  // States
  private states: Map<string, TerraformState> = new Map();
  
  // Metrics
  private terraformMetrics: TerraformEngineMetrics = {
    workspacesTotal: 0,
    runsTotal: 0,
    runsSuccess: 0,
    runsFailed: 0,
    runsRunning: 0,
    runsPending: 0,
    runsPerHour: 0,
    averageRunDuration: 0,
    statesTotal: 0,
    resourcesManaged: 0,
    requestsTotal: 0,
    requestsErrors: 0,
  };
  
  // Run history for metrics
  private runHistoryList: Array<{ timestamp: number; duration: number; status: RunStatus }> = [];
  private readonly MAX_RUN_HISTORY_LIST = 1000;
  
  // Last run time per workspace
  private lastRunTime: Map<string, number> = new Map();
  
  // VCS webhook tracking
  private lastVCSWebhook: Map<string, number> = new Map();
  
  /**
   * Обрабатывает входящий запрос (webhook, API)
   */
  processRequest(success: boolean = true): void {
    this.terraformMetrics.requestsTotal++;
    if (!success) {
      this.terraformMetrics.requestsErrors++;
    }
  }
  
  /**
   * Инициализирует конфигурацию Terraform из конфига компонента
   */
  initializeConfig(node: CanvasNode): void {
    const config = node.data.config || {};
    
    this.config = {
      organizationName: config.organizationName || 'archiphoenix',
      enableVCS: config.enableVCS ?? true,
      enableStateLocking: config.enableStateLocking ?? true,
      enableRemoteState: config.enableRemoteState ?? true,
      defaultTerraformVersion: config.defaultTerraformVersion || '1.5.0',
      workspaces: config.workspaces || [],
      runs: config.runs || [],
      states: config.states || [],
      runTriggerRate: config.runTriggerRate || 0.5, // 0.5 runs per hour per workspace
      averagePlanDuration: config.averagePlanDuration || 30000, // 30 seconds base
      averageApplyDuration: config.averageApplyDuration || 120000, // 2 minutes base
      failureRate: config.failureRate ?? 0.05, // 5% failure rate
      changeProbability: config.changeProbability ?? 0.7, // 70% chance of changes
      maxResourceAdditions: config.maxResourceAdditions || 10,
      maxResourceChanges: config.maxResourceChanges || 5,
      maxResourceDestructions: config.maxResourceDestructions || 3,
      vcsWebhookProbability: config.vcsWebhookProbability ?? 0.3, // 30% chance per hour
      defaultStateResources: config.defaultStateResources || 10,
      durationVariation: config.durationVariation ?? 0.3, // ±30% variation
      resourceTimeMultiplier: config.resourceTimeMultiplier || 500, // 500ms per resource
    };
    
    // Initialize workspaces
    this.initializeWorkspaces();
    
    // Initialize runs
    this.initializeRuns();
    
    // Initialize states
    this.initializeStates();
  }
  
  /**
   * Обновляет конфигурацию (для динамических изменений)
   */
  updateConfig(node: CanvasNode): void {
    this.initializeConfig(node);
  }
  
  /**
   * Инициализирует workspaces из конфига
   */
  private initializeWorkspaces(): void {
    this.workspaces.clear();
    
    const configWorkspaces = this.config?.workspaces || [];
    
    // Default workspace if none configured
    if (configWorkspaces.length === 0) {
      const defaultWorkspace: TerraformWorkspace = {
        id: 'default',
        name: 'production',
        description: 'Production infrastructure',
        terraformVersion: this.config?.defaultTerraformVersion || '1.5.0',
        autoApply: false,
        queueAllRuns: true,
        workingDirectory: '/terraform',
      };
      this.workspaces.set('default', defaultWorkspace);
      return;
    }
    
    for (const workspaceConfig of configWorkspaces) {
      const workspace: TerraformWorkspace = {
        id: workspaceConfig.id,
        name: workspaceConfig.name,
        description: workspaceConfig.description,
        terraformVersion: workspaceConfig.terraformVersion || this.config?.defaultTerraformVersion || '1.5.0',
        autoApply: workspaceConfig.autoApply ?? false,
        queueAllRuns: workspaceConfig.queueAllRuns ?? true,
        workingDirectory: workspaceConfig.workingDirectory,
        vcsRepo: workspaceConfig.vcsRepo,
        variables: workspaceConfig.variables || [],
      };
      
      this.workspaces.set(workspace.id, workspace);
    }
  }
  
  /**
   * Инициализирует runs из конфига
   */
  private initializeRuns(): void {
    // Clear only completed runs, keep active ones
    const activeRunIds = new Set(Array.from(this.activeRuns.keys()));
    
    // Remove completed runs that are not in config
    const configRunIds = new Set((this.config?.runs || []).map(r => r.id));
    for (const [runId, run] of this.runHistory.entries()) {
      if (!activeRunIds.has(runId) && !configRunIds.has(runId)) {
        this.runHistory.delete(runId);
      }
    }
    
    const configRuns = this.config?.runs || [];
    for (const runConfig of configRuns) {
      const workspace = this.workspaces.values().next().value;
      if (!workspace) continue;
      
      const run: TerraformRun = {
        id: runConfig.id,
        workspaceId: workspace.id,
        workspaceName: runConfig.workspace || workspace.name,
        status: runConfig.status || 'applied',
        createdAt: runConfig.createdAt ? new Date(runConfig.createdAt).getTime() : Date.now() - 3600000,
        finishedAt: runConfig.createdAt ? new Date(runConfig.createdAt).getTime() + (runConfig.duration || 120000) : Date.now() - 3480000,
        duration: runConfig.duration || 120000,
        planOnly: runConfig.planOnly ?? false,
        message: runConfig.message,
        hasChanges: runConfig.status === 'applied' ? true : false,
      };
      
      if (['pending', 'planning', 'applying'].includes(run.status)) {
        this.activeRuns.set(run.id, run);
      } else {
        this.runHistory.set(run.id, run);
      }
    }
  }
  
  /**
   * Инициализирует states из конфига
   */
  private initializeStates(): void {
    this.states.clear();
    
    const configStates = this.config?.states || [];
    
    // Create default state for each workspace if none configured
    if (configStates.length === 0) {
      const defaultResources = this.config?.defaultStateResources || 10;
      for (const workspace of this.workspaces.values()) {
        const state: TerraformState = {
          id: `state-${workspace.id}`,
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          version: 1,
          serial: 1,
          resources: defaultResources,
          updatedAt: Date.now() - (3600000 + Math.random() * 3600000), // Random time in last 2 hours
          createdAt: Date.now() - (86400000 + Math.random() * 86400000), // Random time in last 2 days
        };
        this.states.set(state.id, state);
      }
      return;
    }
    
    for (const stateConfig of configStates) {
      const workspace = Array.from(this.workspaces.values()).find(w => w.name === stateConfig.workspace);
      if (!workspace) continue;
      
      const state: TerraformState = {
        id: stateConfig.id,
        workspaceId: workspace.id,
        workspaceName: stateConfig.workspace,
        version: stateConfig.version || 1,
        serial: stateConfig.serial || 1,
        resources: stateConfig.resources,
        updatedAt: stateConfig.updatedAt ? new Date(stateConfig.updatedAt).getTime() : Date.now(),
        createdAt: stateConfig.updatedAt ? new Date(stateConfig.updatedAt).getTime() - 86400000 : Date.now() - 86400000,
      };
      
      this.states.set(state.id, state);
    }
  }
  
  /**
   * Выполняет один цикл обновления Terraform
   * Должен вызываться периодически в EmulationEngine
   */
  performUpdate(currentTime: number): void {
    if (!this.config) return;
    
    // Update active runs
    this.updateActiveRuns(currentTime);
    
    // Trigger VCS webhooks if enabled
    if (this.config.enableVCS) {
      this.triggerVCSWebhooks(currentTime);
    }
    
    // Trigger automatic runs if enabled
    this.triggerAutoRuns(currentTime);
    
    // Update metrics
    this.updateMetrics();
  }
  
  /**
   * Обновляет активные runs
   */
  private updateActiveRuns(currentTime: number): void {
    const runsToProcess = Array.from(this.activeRuns.entries());
    
    for (const [runId, run] of runsToProcess) {
      if (!['pending', 'planning', 'applying'].includes(run.status)) {
        // Move to history
        this.runHistory.set(runId, run);
        if (this.runHistory.size > this.MAX_RUN_HISTORY) {
          const firstKey = this.runHistory.keys().next().value;
          if (firstKey) this.runHistory.delete(firstKey);
        }
        this.activeRuns.delete(runId);
        continue;
      }
      
      if (!run.startedAt) {
        run.startedAt = currentTime;
        continue;
      }
      
      const elapsed = currentTime - run.startedAt;
      let estimatedDuration: number;
      
      // Calculate base duration considering resources in state
      const state = this.getStateForWorkspace(run.workspaceId);
      const resourceCount = state?.resources || this.config?.defaultStateResources || 10;
      const resourceTimeMultiplier = this.config?.resourceTimeMultiplier || 500;
      const basePlanTime = this.config?.averagePlanDuration || 30000;
      const baseApplyTime = this.config?.averageApplyDuration || 120000;
      const durationVariation = this.config?.durationVariation || 0.3;
      
      // Calculate duration with resource scaling (logarithmic scale to avoid excessive times)
      const resourceFactor = Math.log10(Math.max(1, resourceCount)) * resourceTimeMultiplier;
      const planTimeWithResources = basePlanTime + resourceFactor;
      const applyTimeWithResources = baseApplyTime + (resourceFactor * 2); // Apply takes ~2x longer per resource
      
      if (run.status === 'pending') {
        // Move to planning
        run.status = 'planning';
        // Use stored estimated duration if available, otherwise calculate
        const storedDuration = (run as any).estimatedPlanDuration;
        const basePlanDuration = storedDuration || planTimeWithResources;
        // Add variation to duration
        const variation = basePlanDuration * durationVariation * (Math.random() * 2 - 1);
        estimatedDuration = basePlanDuration + variation;
      } else if (run.status === 'planning') {
        // Add variation to duration
        const variation = planTimeWithResources * durationVariation * (Math.random() * 2 - 1);
        estimatedDuration = planTimeWithResources + variation;
        
        if (elapsed >= estimatedDuration) {
          // Determine if there are changes based on configurable probability
          const changeProbability = this.config?.changeProbability ?? 0.7;
          const hasChanges = Math.random() < changeProbability;
          run.hasChanges = hasChanges;
          
          if (hasChanges) {
            const maxAdditions = this.config?.maxResourceAdditions || 10;
            const maxChanges = this.config?.maxResourceChanges || 5;
            const maxDestructions = this.config?.maxResourceDestructions || 3;
            
            // More resources in state = potentially more changes (but not linear)
            const changeFactor = Math.min(1.5, 1 + (resourceCount / 100));
            run.resourceAdditions = Math.floor(Math.random() * maxAdditions * changeFactor) + 1;
            run.resourceChanges = Math.floor(Math.random() * maxChanges * changeFactor);
            run.resourceDestructions = Math.floor(Math.random() * maxDestructions * changeFactor);
          } else {
            run.resourceAdditions = 0;
            run.resourceChanges = 0;
            run.resourceDestructions = 0;
          }
          
          if (run.planOnly) {
            // Plan-only run completes here
            run.status = 'planned';
            run.finishedAt = currentTime;
            run.duration = elapsed;
            run.message = hasChanges 
              ? `Plan completed with ${run.resourceAdditions + run.resourceChanges + run.resourceDestructions} changes`
              : 'No changes detected';
          } else {
            // Move to applying (if auto-apply or manual approval)
            const workspace = this.workspaces.get(run.workspaceId);
            if (workspace?.autoApply && hasChanges) {
              run.status = 'applying';
              // Add variation to apply duration
              const variation = applyTimeWithResources * durationVariation * (Math.random() * 2 - 1);
              estimatedDuration = applyTimeWithResources + variation;
            } else if (hasChanges) {
              run.status = 'planned';
              run.message = `Plan completed. ${run.resourceAdditions + run.resourceChanges + run.resourceDestructions} changes detected.`;
            } else {
              run.status = 'applied';
              run.finishedAt = currentTime;
              run.duration = elapsed;
              run.message = 'No changes detected';
            }
          }
        }
      } else if (run.status === 'applying') {
        // Add variation to apply duration (recalculate in case it wasn't set)
        const variation = applyTimeWithResources * durationVariation * (Math.random() * 2 - 1);
        estimatedDuration = applyTimeWithResources + variation;
        
        if (elapsed >= estimatedDuration) {
          // Determine success/failure based on configurable failure rate
          const failureRate = this.config?.failureRate ?? 0.05;
          const shouldFail = Math.random() < failureRate;
          run.status = shouldFail ? 'errored' : 'applied';
          run.finishedAt = currentTime;
          run.duration = elapsed;
          
          if (shouldFail) {
            run.error = 'Apply failed: resource provisioning error or validation failure';
            run.message = run.error;
          } else {
            run.message = 'Apply completed successfully';
            // Update state
            this.updateStateAfterApply(run);
          }
        }
      }
    }
  }
  
  /**
   * Обновляет state после успешного apply
   */
  private updateStateAfterApply(run: TerraformRun): void {
    const state = Array.from(this.states.values()).find(s => s.workspaceId === run.workspaceId);
    if (!state) return;
    
    // Increment version and serial
    state.version++;
    state.serial++;
    state.updatedAt = Date.now();
    
    // Update resource count
    if (run.resourceAdditions !== undefined) {
      state.resources = (state.resources || 0) + run.resourceAdditions;
      if (run.resourceDestructions !== undefined) {
        state.resources = Math.max(0, state.resources - run.resourceDestructions);
      }
    }
    
    // Update workspace lastRun
    const workspace = this.workspaces.get(run.workspaceId);
    if (workspace) {
      workspace.lastRun = {
        id: run.id,
        status: run.status,
        createdAt: run.finishedAt || Date.now(),
      };
    }
  }
  
  /**
   * Триггерит VCS webhooks для workspaces с VCS интеграцией
   */
  private triggerVCSWebhooks(currentTime: number): void {
    // Simulate VCS webhook events (push to branch)
    // In reality, this would be triggered by actual VCS events
    // Here we simulate periodic checks
    const webhookInterval = 3600000; // Check every hour
    
    for (const workspace of this.workspaces.values()) {
      if (!workspace.vcsRepo) continue;
      
      const lastWebhook = this.lastVCSWebhook.get(workspace.id) || 0;
      if (currentTime - lastWebhook < webhookInterval) continue;
      
      // Simulate VCS pushes based on configurable probability
      const webhookProbability = this.config?.vcsWebhookProbability ?? 0.3;
      if (Math.random() < webhookProbability) {
        this.lastVCSWebhook.set(workspace.id, currentTime);
        // Trigger run for VCS push
        this.triggerRun(workspace.id, { source: 'vcs' });
      }
    }
  }
  
  /**
   * Триггерит автоматические runs
   */
  private triggerAutoRuns(currentTime: number): void {
    // Auto-runs are typically triggered by VCS or schedules
    // Here we simulate based on runTriggerRate
    const runTriggerRate = this.config?.runTriggerRate || 0.5; // runs per hour
    const runInterval = 3600000 / runTriggerRate; // milliseconds between runs
    
    for (const workspace of this.workspaces.values()) {
      const lastRun = this.lastRunTime.get(workspace.id) || 0;
      const timeSinceLastRun = currentTime - lastRun;
      
      if (timeSinceLastRun >= runInterval) {
        // Check if there are no active runs for this workspace
        const hasActiveRun = Array.from(this.activeRuns.values())
          .some(r => r.workspaceId === workspace.id && ['pending', 'planning', 'applying'].includes(r.status));
        
        if (!hasActiveRun && workspace.queueAllRuns) {
          this.lastRunTime.set(workspace.id, currentTime);
          this.triggerRun(workspace.id, { source: 'scheduled' });
        }
      }
    }
  }
  
  /**
   * Триггерит новый run для workspace
   */
  public triggerRun(workspaceId: string, options?: { planOnly?: boolean; source?: string; triggeredBy?: string }): { success: boolean; runId?: string; reason?: string } {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'Workspace not found' };
    }
    
    // Check if there's already an active run
    const hasActiveRun = Array.from(this.activeRuns.values())
      .some(r => r.workspaceId === workspaceId && ['pending', 'planning', 'applying'].includes(r.status));
    
    if (hasActiveRun && !workspace.queueAllRuns) {
      return { success: false, reason: 'Workspace already has an active run' };
    }
    
    const currentTime = Date.now();
    const runId = `run-${workspaceId}-${currentTime}`;
    
    // Estimate duration with resource consideration for better UX
    const state = this.getStateForWorkspace(workspaceId);
    const resourceCount = state?.resources || this.config?.defaultStateResources || 10;
    const resourceTimeMultiplier = this.config?.resourceTimeMultiplier || 500;
    const basePlanTime = this.config?.averagePlanDuration || 30000;
    const resourceFactor = Math.log10(Math.max(1, resourceCount)) * resourceTimeMultiplier;
    
    const run: TerraformRun = {
      id: runId,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      status: 'pending',
      createdAt: currentTime,
      planOnly: options?.planOnly ?? false,
      source: options?.source || 'api',
      triggeredBy: options?.triggeredBy || 'user',
    };
    
    // Store estimated duration for planning phase (will be used when status changes to planning)
    (run as any).estimatedPlanDuration = basePlanTime + resourceFactor;
    
    this.activeRuns.set(runId, run);
    this.terraformMetrics.runsTotal++;
    this.terraformMetrics.runsPending++;
    
    // Update workspace lastRun
    workspace.lastRun = {
      id: runId,
      status: 'pending',
      createdAt: currentTime,
    };
    
    return { success: true, runId };
  }
  
  /**
   * Отменяет активный run
   */
  public cancelRun(runId: string): { success: boolean; reason?: string } {
    const run = this.activeRuns.get(runId);
    if (!run) {
      return { success: false, reason: 'Run not found or not active' };
    }
    
    if (!['pending', 'planning', 'applying'].includes(run.status)) {
      return { success: false, reason: 'Run is not in a cancelable state' };
    }
    
    run.status = 'canceled';
    run.finishedAt = Date.now();
    run.duration = run.startedAt ? Date.now() - run.startedAt : 0;
    run.message = 'Run canceled by user';
    
    // Move to history
    this.runHistory.set(runId, run);
    if (this.runHistory.size > this.MAX_RUN_HISTORY) {
      const firstKey = this.runHistory.keys().next().value;
      if (firstKey) this.runHistory.delete(firstKey);
    }
    this.activeRuns.delete(runId);
    
    return { success: true };
  }
  
  /**
   * Обновляет метрики
   */
  private updateMetrics(): void {
    const allRuns = Array.from(this.activeRuns.values()).concat(Array.from(this.runHistory.values()));
    
    this.terraformMetrics.workspacesTotal = this.workspaces.size;
    this.terraformMetrics.statesTotal = this.states.size;
    this.terraformMetrics.runsRunning = Array.from(this.activeRuns.values())
      .filter(r => ['planning', 'applying'].includes(r.status)).length;
    this.terraformMetrics.runsPending = Array.from(this.activeRuns.values())
      .filter(r => r.status === 'pending').length;
    this.terraformMetrics.runsSuccess = allRuns.filter(r => r.status === 'applied').length;
    this.terraformMetrics.runsFailed = allRuns.filter(r => r.status === 'errored').length;
    
    // Calculate resources managed
    this.terraformMetrics.resourcesManaged = Array.from(this.states.values())
      .reduce((sum, state) => sum + (state.resources || 0), 0);
    
    // Calculate average run duration
    const completedRuns = allRuns.filter(r => r.duration !== undefined);
    if (completedRuns.length > 0) {
      const totalDuration = completedRuns.reduce((sum, r) => sum + (r.duration || 0), 0);
      this.terraformMetrics.averageRunDuration = totalDuration / completedRuns.length;
    }
    
    // Calculate runs per hour (from recent history)
    const oneHourAgo = Date.now() - 3600000;
    const recentRuns = this.runHistoryList.filter(r => r.timestamp >= oneHourAgo);
    this.terraformMetrics.runsPerHour = recentRuns.length;
  }
  
  /**
   * Добавляет run в историю для метрик
   */
  private addRunToHistory(run: TerraformRun): void {
    if (run.duration === undefined) return;
    
    this.runHistoryList.push({
      timestamp: run.finishedAt || Date.now(),
      duration: run.duration,
      status: run.status,
    });
    
    if (this.runHistoryList.length > this.MAX_RUN_HISTORY_LIST) {
      this.runHistoryList.shift();
    }
  }
  
  /**
   * Получает метрики
   */
  public getMetrics(): TerraformEngineMetrics {
    return { ...this.terraformMetrics };
  }
  
  /**
   * Получает workspace по ID
   */
  public getWorkspace(workspaceId: string): TerraformWorkspace | undefined {
    return this.workspaces.get(workspaceId);
  }
  
  /**
   * Получает все workspaces
   */
  public getWorkspaces(): TerraformWorkspace[] {
    return Array.from(this.workspaces.values());
  }
  
  /**
   * Получает run по ID
   */
  public getRun(runId: string): TerraformRun | undefined {
    return this.activeRuns.get(runId) || this.runHistory.get(runId);
  }
  
  /**
   * Получает все активные runs
   */
  public getActiveRuns(): TerraformRun[] {
    return Array.from(this.activeRuns.values());
  }
  
  /**
   * Получает историю runs для workspace
   */
  public getRunsForWorkspace(workspaceId: string, limit: number = 100): TerraformRun[] {
    const allRuns = Array.from(this.activeRuns.values()).concat(Array.from(this.runHistory.values()));
    return allRuns
      .filter(r => r.workspaceId === workspaceId)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, limit);
  }
  
  /**
   * Получает state для workspace
   */
  public getStateForWorkspace(workspaceId: string): TerraformState | undefined {
    return Array.from(this.states.values()).find(s => s.workspaceId === workspaceId);
  }
  
  /**
   * Получает все states
   */
  public getStates(): TerraformState[] {
    return Array.from(this.states.values());
  }
  
  /**
   * Получает конфигурацию
   */
  public getConfig(): TerraformEmulationConfig | null {
    return this.config;
  }
}



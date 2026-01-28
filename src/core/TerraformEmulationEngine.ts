import { CanvasNode, CanvasConnection } from '@/types';
import { ComponentMetrics } from './EmulationEngine';
import { DataMessage } from './DataFlowEngine';
import { dataFlowEngine } from './DataFlowEngine';

/**
 * Terraform Run Status
 */
export type RunStatus = 'pending' | 'planning' | 'planned' | 'applying' | 'applied' | 'errored' | 'canceled';

/**
 * Terraform Variable
 */
export interface TerraformVariable {
  id: string;
  key: string;
  value: string;
  category: 'terraform' | 'env';
  sensitive: boolean;
  hcl: boolean;
  description?: string;
}

/**
 * Terraform Notification Configuration
 */
export interface TerraformNotificationConfiguration {
  id: string;
  name: string;
  type: 'slack' | 'email' | 'webhook' | 'component';
  destination: string; // URL, email, componentId
  conditions: Array<'on_success' | 'on_failure' | 'on_start'>;
  enabled: boolean;
  description?: string;
}

/**
 * Terraform Run Policy
 */
export interface TerraformRunPolicy {
  id: string;
  name: string;
  type: 'manual_approval' | 'sentinel' | 'opa';
  enabled: boolean;
  conditions?: {
    onPlanOnly?: boolean;
    onApply?: boolean;
    resourceTypes?: string[];
    minResourceChanges?: number;
    requireDestruction?: boolean;
  };
  description?: string;
}

/**
 * Run Policy Check Result
 */
export interface RunPolicyCheckResult {
  passed: boolean;
  blockingPolicies: Array<{ id: string; name: string; type: string; reason: string }>;
  requiresApproval: boolean;
}

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
  notifications?: TerraformNotificationConfiguration[];
  tags?: string[];
  runPolicies?: TerraformRunPolicy[];
  lastRun?: {
    id: string;
    status: RunStatus;
    createdAt: number;
  };
  // HCL code storage for infrastructure as code
  hclCode?: string; // HCL код инфраструктуры
  hclCodeVersion?: string; // Версия кода (commit hash, tag)
  hclCodeUpdatedAt?: number; // Когда код был обновлен
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
  policyChecks?: {
    checked: boolean;
    passed: boolean;
    requiresApproval: boolean;
    approved?: boolean;
    approvedBy?: string;
    approvedAt?: number;
  };
  planOutput?: {
    changes: {
      additions: number;
      changes: number;
      destructions: number;
    };
    resourceChanges?: Array<{
      address: string;
      action: 'create' | 'update' | 'delete' | 'replace';
      type: string;
    }>;
    summary: string;
  };
  applyOutput?: {
    success: boolean;
    resourcesCreated?: number;
    resourcesUpdated?: number;
    resourcesDestroyed?: number;
    outputs?: Record<string, any>;
    summary: string;
  };
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
    hclCode?: string; // HCL код инфраструктуры
    hclCodeVersion?: string; // Версия кода (commit hash, tag)
    hclCodeUpdatedAt?: number; // Когда код был обновлен
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
  connectedComponents: number;
  outgoingMessages: number;
  incomingWebhooks: number;
  // Метрики зависимостей
  vcsConnected: boolean;
  stateBackendConnected: boolean;
  providersConnected: number;
  blockedRuns: number; // Runs заблокированные из-за отсутствия зависимостей
}

/**
 * Terraform Emulation Engine
 * Симулирует работу Terraform Cloud/Enterprise: workspaces, runs, state management, метрики
 */
export class TerraformEmulationEngine {
  private config: TerraformEmulationConfig | null = null;
  
  // Node ID for this engine instance
  private nodeId: string | null = null;
  
  // Connections for sending messages
  private connections: CanvasConnection[] = [];
  
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
    connectedComponents: 0,
    outgoingMessages: 0,
    incomingWebhooks: 0,
    // Метрики зависимостей
    vcsConnected: false,
    stateBackendConnected: false,
    providersConnected: 0,
    blockedRuns: 0,
  };
  
  // Счетчик заблокированных runs (для метрики)
  private blockedRunsCount: number = 0;
  
  // Counters for connection-related metrics
  private outgoingMessagesCount: number = 0;
  private incomingWebhooksCount: number = 0;
  
  // Run history for metrics
  private runHistoryList: Array<{ timestamp: number; duration: number; status: RunStatus }> = [];
  private readonly MAX_RUN_HISTORY_LIST = 1000;
  
  // Last run time per workspace
  private lastRunTime: Map<string, number> = new Map();
  
  // VCS webhook tracking
  private lastVCSWebhook: Map<string, number> = new Map();
  
  /**
   * Устанавливает node ID для этого движка
   */
  public setNodeId(nodeId: string): void {
    this.nodeId = nodeId;
  }
  
  /**
   * Устанавливает соединения для отправки сообщений
   */
  public setConnections(connections: CanvasConnection[]): void {
    this.connections = connections;
  }
  
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
        notifications: (workspaceConfig as any).notifications || [],
        tags: (workspaceConfig as any).tags || [],
        runPolicies: (workspaceConfig as any).runPolicies || [],
        hclCode: workspaceConfig.hclCode,
        hclCodeVersion: workspaceConfig.hclCodeVersion,
        hclCodeUpdatedAt: workspaceConfig.hclCodeUpdatedAt,
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
   * 
   * ВАЖНО: Terraform работает реактивно - runs создаются только при реальных событиях:
   * - Входящие webhook от VCS (через DataFlowEngine handler)
   * - Явные API запросы (через DataFlowEngine handler)
   * - Ручной запуск из UI (через triggerRun())
   * 
   * Автогенерация runs удалена для соответствия реальности.
   */
  performUpdate(currentTime: number): void {
    if (!this.config) return;
    
    // Update active runs only - no automatic triggering
    this.updateActiveRuns(currentTime);
    
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
          // Получаем HCL код для workspace
          const hclCode = this.getHCLCodeForWorkspace(run.workspaceId);
          
          if (!hclCode) {
            // Нет HCL кода - не можем сделать plan
            run.status = 'errored';
            run.error = 'HCL code not available. Connect to VCS or provide code manually.';
            run.finishedAt = currentTime;
            run.duration = elapsed;
            run.hasChanges = false;
            run.resourceAdditions = 0;
            run.resourceChanges = 0;
            run.resourceDestructions = 0;
            
            // Отправляем результаты errored run
            this.sendRunResults(run);
            continue;
          }
          
          // Парсим HCL код для определения реальных ресурсов
          const parsed = this.parseHCLCode(hclCode);
          
          // Определяем изменения на основе реальных ресурсов из HCL кода
          const existingResources = state?.resources || 0;
          const newResources = parsed.resourceCount;
          
          // Рассчитываем изменения на основе сравнения текущего state и HCL кода
          let resourceAdditions = 0;
          let resourceChanges = 0;
          let resourceDestructions = 0;
          let hasChanges = false;
          
          if (newResources > existingResources) {
            // Новые ресурсы в HCL коде
            resourceAdditions = newResources - existingResources;
            hasChanges = true;
          } else if (newResources < existingResources) {
            // Ресурсы удалены из HCL кода
            resourceDestructions = existingResources - newResources;
            hasChanges = true;
          }
          
          // Добавляем некоторую вариативность для изменений существующих ресурсов
          // (в реальности это определяется сравнением state и plan)
          if (newResources > 0 && existingResources > 0) {
            const changeProbability = this.config?.changeProbability ?? 0.3; // Вероятность изменений существующих ресурсов
            if (Math.random() < changeProbability) {
              resourceChanges = Math.min(Math.floor(newResources * 0.2), this.config?.maxResourceChanges || 5);
              hasChanges = true;
            }
          }
          
          // Если нет изменений, но есть ресурсы - это может быть первый run
          if (!hasChanges && newResources > 0 && existingResources === 0) {
            resourceAdditions = newResources;
            hasChanges = true;
          }
          
          run.hasChanges = hasChanges;
          run.resourceAdditions = resourceAdditions;
          run.resourceChanges = resourceChanges;
          run.resourceDestructions = resourceDestructions;
          
          // Генерируем plan output с реальными изменениями ресурсов из HCL кода
          if (hasChanges && parsed.resources.length > 0) {
            // Берем первые N ресурсов для отображения в plan output
            const resourcesToShow = parsed.resources.slice(0, Math.max(resourceAdditions + resourceChanges + resourceDestructions, 10));
            const resourceChangesList = resourcesToShow.map((r, index) => {
              let action: 'create' | 'update' | 'delete' | 'replace' = 'create';
              if (index < resourceAdditions) {
                action = 'create';
              } else if (index < resourceAdditions + resourceChanges) {
                action = 'update';
              } else if (index < resourceAdditions + resourceChanges + resourceDestructions) {
                action = 'delete';
              }
              
              return {
                address: r.address,
                action,
                type: r.type,
              };
            });
            
            run.planOutput = {
              changes: {
                additions: resourceAdditions,
                changes: resourceChanges,
                destructions: resourceDestructions,
              },
              resourceChanges: resourceChangesList,
              summary: `Plan: ${resourceAdditions} to add, ${resourceChanges} to change, ${resourceDestructions} to destroy.`,
            };
          } else {
            run.planOutput = {
              changes: { additions: 0, changes: 0, destructions: 0 },
              summary: 'No changes. Infrastructure is up-to-date.',
            };
          }
          
          if (run.planOnly) {
            // Plan-only run completes here
            run.status = 'planned';
            run.finishedAt = currentTime;
            run.duration = elapsed;
            run.message = hasChanges 
              ? `Plan completed with ${run.resourceAdditions + run.resourceChanges + run.resourceDestructions} changes`
              : 'No changes detected';
            
            // Plan output уже сгенерирован выше на основе HCL кода
            
            // Отправляем результаты plan-only run
            this.sendRunResults(run);
          } else {
            // Check policies before applying
            const workspace = this.workspaces.get(run.workspaceId);
            const policyCheck = this.checkRunPolicies(run, workspace);
            
            // Initialize policy checks if not done
            if (!run.policyChecks) {
              run.policyChecks = {
                checked: true,
                passed: policyCheck.passed,
                requiresApproval: policyCheck.requiresApproval,
                approved: false,
              };
            }
            
            // Plan output уже сгенерирован выше на основе HCL кода
            
            // Проверяем наличие целевых компонентов для apply
            const targetComponents = this.getTargetComponentsForWorkspace(run.workspaceId);
            
            // If policies require approval and not approved, stay in planned state
            if (policyCheck.requiresApproval && !run.policyChecks.approved) {
              run.status = 'planned';
              run.message = `Plan completed. ${run.resourceAdditions + run.resourceChanges + run.resourceDestructions} changes detected. Approval required.`;
              // Отправляем результаты planned run (требует manual approval)
              this.sendRunResults(run);
            } else if (hasChanges && targetComponents.length === 0) {
              // Нет целевых компонентов - можем только plan
              run.status = 'planned';
              run.message = 'Plan completed. No target infrastructure connected for apply. Connect to Kubernetes/Docker/AWS to apply changes.';
              run.finishedAt = currentTime;
              run.duration = elapsed;
              
              // Отправляем результаты planned run
              this.sendRunResults(run);
            } else if (workspace?.autoApply && hasChanges && policyCheck.passed) {
              // Auto-apply if enabled and policies passed
              run.status = 'applying';
              // Add variation to apply duration
              const variation = applyTimeWithResources * durationVariation * (Math.random() * 2 - 1);
              estimatedDuration = applyTimeWithResources + variation;
            } else if (hasChanges && policyCheck.passed && run.policyChecks.approved) {
              // Manual approval granted and policies passed
              run.status = 'applying';
              // Add variation to apply duration
              const variation = applyTimeWithResources * durationVariation * (Math.random() * 2 - 1);
              estimatedDuration = applyTimeWithResources + variation;
            } else if (hasChanges) {
              // Has changes but needs approval or policies failed
              run.status = 'planned';
              run.message = `Plan completed. ${run.resourceAdditions + run.resourceChanges + run.resourceDestructions} changes detected. Approval required.`;
              // Отправляем результаты planned run (требует manual approval)
              this.sendRunResults(run);
            } else {
              // No changes
              run.status = 'applied';
              run.finishedAt = currentTime;
              run.duration = elapsed;
              run.message = 'No changes detected';
              
              // Generate apply output for no changes
              run.applyOutput = {
                success: true,
                resourcesCreated: 0,
                resourcesUpdated: 0,
                resourcesDestroyed: 0,
                summary: 'Apply complete: No changes were made.',
              };
              
              // Отправляем результаты (no changes)
              this.sendRunResults(run);
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
            
            // Generate apply output for failure
            run.applyOutput = {
              success: false,
              summary: `Apply failed: ${run.error}`,
            };
            
            // Отправляем результаты даже при ошибке
            this.sendRunResults(run);
          } else {
            run.message = 'Apply completed successfully';
            
            // Update state
            this.updateStateAfterApply(run);
            
            // Generate apply output for success
            const state = this.getStateForWorkspace(run.workspaceId);
            run.applyOutput = {
              success: true,
              resourcesCreated: run.resourceAdditions || 0,
              resourcesUpdated: run.resourceChanges || 0,
              resourcesDestroyed: run.resourceDestructions || 0,
              outputs: state?.outputs || {},
              summary: `Apply complete: ${run.resourceAdditions || 0} added, ${run.resourceChanges || 0} changed, ${run.resourceDestructions || 0} destroyed.`,
            };
            
            // Отправляем результаты успешного apply
            this.sendRunResults(run);
          }
        }
      } else if (run.status === 'planned') {
        // Plan-only run завершен
        this.sendRunResults(run);
      } else if (run.status === 'canceled') {
        // Run отменен
        this.sendRunResults(run);
      }
    }
  }
  
  /**
   * Генерирует список изменений ресурсов для plan output
   */
  private generateResourceChanges(run: TerraformRun): Array<{
    address: string;
    action: 'create' | 'update' | 'delete' | 'replace';
    type: string;
  }> {
    const changes: Array<{
      address: string;
      action: 'create' | 'update' | 'delete' | 'replace';
      type: string;
    }> = [];
    
    const resourceTypes = ['aws_instance', 'aws_s3_bucket', 'aws_lambda_function', 'kubernetes_deployment', 'docker_container', 'postgresql_database'];
    const workspaceName = run.workspaceName || 'default';
    
    // Generate additions
    for (let i = 0; i < (run.resourceAdditions || 0); i++) {
      const type = resourceTypes[Math.floor(Math.random() * resourceTypes.length)];
      changes.push({
        address: `${type}.${workspaceName}_resource_${i + 1}`,
        action: 'create',
        type,
      });
    }
    
    // Generate changes
    for (let i = 0; i < (run.resourceChanges || 0); i++) {
      const type = resourceTypes[Math.floor(Math.random() * resourceTypes.length)];
      const action = Math.random() > 0.5 ? 'update' : 'replace';
      changes.push({
        address: `${type}.${workspaceName}_resource_${i + 1}`,
        action,
        type,
      });
    }
    
    // Generate destructions
    for (let i = 0; i < (run.resourceDestructions || 0); i++) {
      const type = resourceTypes[Math.floor(Math.random() * resourceTypes.length)];
      changes.push({
        address: `${type}.${workspaceName}_resource_${i + 1}`,
        action: 'delete',
        type,
      });
    }
    
    return changes;
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
    
    // Generate outputs for successful apply
    if (run.status === 'applied' && run.hasChanges) {
      state.outputs = {
        resourceCount: state.resources || 0,
        lastApplyTime: run.finishedAt || Date.now(),
        runId: run.id,
        workspaceName: run.workspaceName,
      };
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
   * Отправляет результаты run в подключенные компоненты
   */
  private sendRunResults(run: TerraformRun): void {
    if (!this.nodeId) return;
    
    // Определяем когда отправлять (после завершения run)
    const shouldSend = ['applied', 'errored', 'canceled', 'planned'].includes(run.status);
    if (!shouldSend) {
      return;
    }

    // Отправляем notifications (если настроены)
    this.sendNotifications(run);
    
    // Получаем исходящие соединения
    const outgoingConnections = this.connections.filter(c => c.source === this.nodeId);
    
    if (outgoingConnections.length === 0) {
      return; // Нет исходящих соединений
    }
    
    // Получаем state для outputs
    const state = Array.from(this.states.values()).find(s => s.workspaceId === run.workspaceId);
    
    // Создаем payload для сообщения
    const payload = {
      operation: 'run_completed',
      runId: run.id,
      workspaceId: run.workspaceId,
      workspaceName: run.workspaceName,
      status: run.status,
      duration: run.duration || 0,
      resourceAdditions: run.resourceAdditions,
      resourceChanges: run.resourceChanges,
      resourceDestructions: run.resourceDestructions,
      hasChanges: run.hasChanges || false,
      stateVersion: state?.version,
      outputs: state?.outputs,
      error: run.error,
      source: 'terraform',
      createdAt: run.createdAt,
      finishedAt: run.finishedAt,
      triggeredBy: run.triggeredBy,
      sourceType: run.source,
    };
    
    // Отправляем сообщения во все исходящие соединения
    for (const connection of outgoingConnections) {
      try {
        const message = dataFlowEngine.addMessage({
          source: this.nodeId,
          target: connection.target,
          format: 'json',
          payload,
          size: JSON.stringify(payload).length,
          metadata: {
            operation: 'run_completed',
            contentType: 'application/json',
            terraformRunId: run.id,
            terraformWorkspaceId: run.workspaceId,
          },
        });
        
        if (message.status === 'failed') {
          console.warn(`Failed to send Terraform run results to ${connection.target}: ${message.error}`);
        } else {
          // Увеличиваем счетчик отправленных сообщений
          this.outgoingMessagesCount++;
        }
      } catch (error) {
        console.warn(`Error sending Terraform run results to ${connection.target}:`, error);
      }
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
      
      // Проверяем наличие соединения с VCS (graceful degradation)
      if (!this.checkVCSConnection(workspace)) {
        continue; // Пропускаем если нет соединения
      }
      
      const lastWebhook = this.lastVCSWebhook.get(workspace.id) || 0;
      if (currentTime - lastWebhook < webhookInterval) continue;
      
      // Simulate VCS pushes based on configurable probability
      const webhookProbability = this.config?.vcsWebhookProbability ?? 0.3;
      if (Math.random() < webhookProbability) {
        this.lastVCSWebhook.set(workspace.id, currentTime);
        // Trigger run for VCS push (счетчик увеличится в triggerRun)
        this.triggerRun(workspace.id, { source: 'vcs', triggeredBy: 'vcs-webhook' });
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
   * Проверяет наличие соединения с VCS для workspace
   */
  private checkVCSConnection(workspace: TerraformWorkspace): boolean {
    if (!workspace.vcsRepo) {
      return false; // Нет VCS repo настроен
    }
    
    if (!this.nodeId) {
      return false;
    }
    
    // Проверяем наличие входящих соединений от VCS компонентов
    // Используем правильное сравнение: source должен быть nodeId источника, target - наш nodeId
    const vcsConnections = this.connections.filter(c => {
      // Получаем source node ID из connection
      const sourceNodeId = typeof c.source === 'string' ? c.source : (c.source as any)?.id;
      const targetNodeId = typeof c.target === 'string' ? c.target : (c.target as any)?.id;
      
      // Проверяем что соединение идет к нам (target === наш nodeId)
      if (targetNodeId !== this.nodeId) {
        return false;
      }
      
      // Проверяем тип источника через nodes (если доступны) или через connection type
      // В реальности нужно проверять тип source node, но для упрощения используем connection type
      return true; // Принимаем все входящие соединения как потенциальные VCS
    });
    
    return vcsConnections.length > 0;
  }
  
  /**
   * Проверяет наличие State backend соединения
   */
  private checkStateBackend(workspaceId: string): boolean {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;
    
    const config = this.config;
    if (!config?.enableRemoteState) {
      return true; // Локальный state разрешен
    }
    
    if (!this.nodeId) return false;
    
    // Проверяем соединение с State backend (Vault, S3)
    // В реальности нужно проверять тип source node, но для упрощения проверяем все входящие соединения
    const stateBackendConnections = this.connections.filter(c => {
      const targetNodeId = typeof c.target === 'string' ? c.target : (c.target as any)?.id;
      return targetNodeId === this.nodeId;
    });
    
    // В реальности нужно проверять тип компонента (Vault, S3), но для симуляции принимаем наличие соединений
    return stateBackendConnections.length > 0;
  }
  
  /**
   * Получает целевые компоненты (провайдеры) для workspace
   * Это компоненты, куда Terraform будет применять изменения
   */
  private getTargetComponentsForWorkspace(workspaceId: string): string[] {
    if (!this.nodeId) return [];
    
    // Получаем исходящие соединения к провайдерам
    const providerConnections = this.connections.filter(c => {
      const sourceNodeId = typeof c.source === 'string' ? c.source : (c.source as any)?.id;
      return sourceNodeId === this.nodeId;
    });
    
    // В реальности нужно проверять тип target node (Kubernetes, Docker, AWS), но для симуляции возвращаем все
    return providerConnections.map(c => {
      const targetNodeId = typeof c.target === 'string' ? c.target : (c.target as any)?.id;
      return targetNodeId;
    }).filter(Boolean);
  }
  
  /**
   * Проверяет наличие исходящих соединений для отправки результатов
   */
  private checkOutgoingConnections(): boolean {
    if (!this.nodeId) return false;
    const outgoingConnections = this.connections.filter(c => c.source === this.nodeId);
    return outgoingConnections.length > 0;
  }
  
  /**
   * Триггерит новый run для workspace
   */
  public triggerRun(workspaceId: string, options?: { planOnly?: boolean; source?: string; triggeredBy?: string }): { success: boolean; runId?: string; reason?: string } {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'Workspace not found' };
    }
    
    // Увеличиваем счетчик входящих webhooks если это webhook от VCS
    if (options?.source === 'vcs' || options?.triggeredBy === 'vcs-webhook') {
      this.incomingWebhooksCount++;
    }
    
    // КРИТИЧНО: Если есть vcsRepo, но нет соединения - блокируем
    if (workspace.vcsRepo && !this.checkVCSConnection(workspace)) {
      this.blockedRunsCount++;
      return { 
        success: false, 
        reason: 'VCS connection required but not found. Connect to VCS component (GitLab CI, GitHub, etc.) to receive HCL code.' 
      };
    }
    
    // КРИТИЧНО: Проверяем наличие HCL кода
    const hclCode = this.getHCLCode(workspaceId);
    if (!hclCode && workspace.vcsRepo) {
      this.blockedRunsCount++;
      return { 
        success: false, 
        reason: 'HCL code not available. VCS connection exists but no code received yet. Wait for webhook from VCS or provide code manually.' 
      };
    }
    
    // Если нет vcsRepo и нет HCL кода - можно разрешить (ручной ввод кода через UI)
    if (!workspace.vcsRepo && !hclCode) {
      // Разрешаем, но предупреждаем что plan может не работать
      console.warn(`Terraform workspace ${workspace.name} has no VCS repo and no HCL code. Run may fail during planning.`);
    }
    
    // КРИТИЧНО: Проверяем State backend если требуется
    if (this.config?.enableRemoteState && !this.checkStateBackend(workspaceId)) {
      this.blockedRunsCount++;
      return { 
        success: false, 
        reason: 'Remote state enabled but no State backend connection found. Connect to Vault or S3 for state storage.' 
      };
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
    
    // Отправляем результаты отмененного run
    this.sendRunResults(run);
    
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
    
    // Calculate connected components (unique targets from connections)
    if (this.nodeId) {
      const incomingConnections = this.connections.filter(c => c.target === this.nodeId);
      const outgoingConnections = this.connections.filter(c => c.source === this.nodeId);
      const uniqueComponents = new Set<string>();
      incomingConnections.forEach(c => uniqueComponents.add(c.source));
      outgoingConnections.forEach(c => uniqueComponents.add(c.target));
      this.terraformMetrics.connectedComponents = uniqueComponents.size;
    } else {
      this.terraformMetrics.connectedComponents = 0;
    }
    
    // Update connection-related metrics from counters
    this.terraformMetrics.outgoingMessages = this.outgoingMessagesCount;
    this.terraformMetrics.incomingWebhooks = this.incomingWebhooksCount;
    
    // Метрики зависимостей
    if (this.nodeId) {
      // Проверяем VCS соединения
      const vcsConnections = this.connections.filter(c => {
        const targetNodeId = typeof c.target === 'string' ? c.target : (c.target as any)?.id;
        return targetNodeId === this.nodeId;
      });
      // Проверяем есть ли хотя бы один workspace с VCS repo и соединением
      const workspacesWithVCS = Array.from(this.workspaces.values()).filter(w => w.vcsRepo);
      this.terraformMetrics.vcsConnected = workspacesWithVCS.length > 0 && vcsConnections.length > 0;
      
      // Проверяем State backend соединения
      if (this.config?.enableRemoteState) {
        this.terraformMetrics.stateBackendConnected = vcsConnections.length > 0; // Упрощенная проверка
      } else {
        this.terraformMetrics.stateBackendConnected = true; // Локальный state разрешен
      }
      
      // Проверяем провайдеры (исходящие соединения)
      const providerConnections = this.connections.filter(c => {
        const sourceNodeId = typeof c.source === 'string' ? c.source : (c.source as any)?.id;
        return sourceNodeId === this.nodeId;
      });
      this.terraformMetrics.providersConnected = providerConnections.length;
    } else {
      this.terraformMetrics.vcsConnected = false;
      this.terraformMetrics.stateBackendConnected = false;
      this.terraformMetrics.providersConnected = 0;
    }
    
    // Обновляем метрику заблокированных runs
    this.terraformMetrics.blockedRuns = this.blockedRunsCount;
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
   * Получает outputs из state для workspace
   */
  public getStateOutputs(workspaceId: string): Record<string, any> | undefined {
    const state = this.getStateForWorkspace(workspaceId);
    return state?.outputs;
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

  /**
   * Variables Management
   */

  /**
   * Добавляет переменную в workspace
   */
  public addVariable(workspaceId: string, variable: Omit<TerraformVariable, 'id'>): { success: boolean; variableId?: string; reason?: string } {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'Workspace not found' };
    }

    // Проверка уникальности ключа
    const existingVariables = workspace.variables || [];
    if (existingVariables.some(v => v.key === variable.key)) {
      return { success: false, reason: 'Variable with this key already exists' };
    }

    const variableId = `var-${workspaceId}-${Date.now()}`;
    const newVariable: TerraformVariable = {
      id: variableId,
      ...variable,
    };

    // Обновляем workspace
    const updatedVariables = [...existingVariables, {
      key: variable.key,
      value: variable.value,
      category: variable.category,
      sensitive: variable.sensitive,
      hcl: variable.hcl,
    }];

    workspace.variables = updatedVariables;
    this.workspaces.set(workspaceId, workspace);

    // Синхронизируем с конфигом
    this.syncWorkspaceToConfig(workspaceId);

    return { success: true, variableId };
  }

  /**
   * Обновляет переменную в workspace
   */
  public updateVariable(workspaceId: string, variableKey: string, updates: Partial<Omit<TerraformVariable, 'id' | 'key'>>): { success: boolean; reason?: string } {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'Workspace not found' };
    }

    const variables = workspace.variables || [];
    const variableIndex = variables.findIndex(v => v.key === variableKey);

    if (variableIndex === -1) {
      return { success: false, reason: 'Variable not found' };
    }

    // Обновляем переменную
    const updatedVariable = {
      ...variables[variableIndex],
      ...(updates.value !== undefined && { value: String(updates.value) }),
      ...(updates.category !== undefined && { category: updates.category }),
      ...(updates.sensitive !== undefined && { sensitive: updates.sensitive }),
      ...(updates.hcl !== undefined && { hcl: updates.hcl }),
    };

    variables[variableIndex] = updatedVariable;
    workspace.variables = variables;
    this.workspaces.set(workspaceId, workspace);

    // Синхронизируем с конфигом
    this.syncWorkspaceToConfig(workspaceId);

    return { success: true };
  }

  /**
   * Удаляет переменную из workspace
   */
  public deleteVariable(workspaceId: string, variableKey: string): { success: boolean; reason?: string } {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'Workspace not found' };
    }

    const variables = workspace.variables || [];
    const filteredVariables = variables.filter(v => v.key !== variableKey);

    if (filteredVariables.length === variables.length) {
      return { success: false, reason: 'Variable not found' };
    }

    workspace.variables = filteredVariables;
    this.workspaces.set(workspaceId, workspace);

    // Синхронизируем с конфигом
    this.syncWorkspaceToConfig(workspaceId);

    return { success: true };
  }

  /**
   * Получает все переменные для workspace
   */
  public getVariables(workspaceId: string): TerraformVariable[] {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return [];
    }

    const variables = workspace.variables || [];
    return variables.map((v, index) => ({
      id: `var-${workspaceId}-${index}`,
      key: v.key,
      value: v.value,
      category: v.category || 'terraform',
      sensitive: v.sensitive || false,
      hcl: v.hcl || false,
    }));
  }

  /**
   * Notifications Management
   */

  /**
   * Добавляет notification configuration в workspace
   */
  public addNotification(workspaceId: string, notification: Omit<TerraformNotificationConfiguration, 'id'>): { success: boolean; notificationId?: string; reason?: string } {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'Workspace not found' };
    }

    // Проверка уникальности имени
    const existingNotifications = workspace.notifications || [];
    if (existingNotifications.some(n => n.name === notification.name)) {
      return { success: false, reason: 'Notification with this name already exists' };
    }

    const notificationId = `notif-${workspaceId}-${Date.now()}`;
    const newNotification: TerraformNotificationConfiguration = {
      id: notificationId,
      ...notification,
    };

    workspace.notifications = [...existingNotifications, newNotification];
    this.workspaces.set(workspaceId, workspace);

    // Синхронизируем с конфигом
    this.syncWorkspaceToConfig(workspaceId);

    return { success: true, notificationId };
  }

  /**
   * Обновляет notification configuration в workspace
   */
  public updateNotification(workspaceId: string, notificationId: string, updates: Partial<Omit<TerraformNotificationConfiguration, 'id'>>): { success: boolean; reason?: string } {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'Workspace not found' };
    }

    const notifications = workspace.notifications || [];
    const notificationIndex = notifications.findIndex(n => n.id === notificationId);

    if (notificationIndex === -1) {
      return { success: false, reason: 'Notification not found' };
    }

    // Обновляем notification
    notifications[notificationIndex] = {
      ...notifications[notificationIndex],
      ...updates,
    };

    workspace.notifications = notifications;
    this.workspaces.set(workspaceId, workspace);

    // Синхронизируем с конфигом
    this.syncWorkspaceToConfig(workspaceId);

    return { success: true };
  }

  /**
   * Удаляет notification configuration из workspace
   */
  public deleteNotification(workspaceId: string, notificationId: string): { success: boolean; reason?: string } {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'Workspace not found' };
    }

    const notifications = workspace.notifications || [];
    const filteredNotifications = notifications.filter(n => n.id !== notificationId);

    if (filteredNotifications.length === notifications.length) {
      return { success: false, reason: 'Notification not found' };
    }

    workspace.notifications = filteredNotifications;
    this.workspaces.set(workspaceId, workspace);

    // Синхронизируем с конфигом
    this.syncWorkspaceToConfig(workspaceId);

    return { success: true };
  }

  /**
   * Получает все notification configurations для workspace
   */
  public getNotifications(workspaceId: string): TerraformNotificationConfiguration[] {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return [];
    }

    return workspace.notifications || [];
  }

  /**
   * Отправляет notifications для run (вызывается из sendRunResults)
   */
  private sendNotifications(run: TerraformRun): void {
    const workspace = this.workspaces.get(run.workspaceId);
    if (!workspace || !workspace.notifications) {
      return;
    }

    const notifications = workspace.notifications.filter(n => n.enabled);
    if (notifications.length === 0) {
      return;
    }

    // Определяем какие условия выполнены
    const conditions: Array<'on_success' | 'on_failure' | 'on_start'> = [];
    if (run.status === 'applied') {
      conditions.push('on_success');
    } else if (run.status === 'errored') {
      conditions.push('on_failure');
    }
    // on_start не обрабатываем здесь, так как run уже завершен

    // Отправляем notifications для соответствующих условий
    for (const notification of notifications) {
      const shouldSend = notification.conditions.some(c => conditions.includes(c));
      if (!shouldSend) {
        continue;
      }

      // Для component типа отправляем через DataFlowEngine
      if (notification.type === 'component' && this.nodeId) {
        const targetComponentId = notification.destination;
        const outgoingConnections = this.connections.filter(c => 
          c.source === this.nodeId && c.target === targetComponentId
        );

        if (outgoingConnections.length > 0) {
          try {
            const payload = {
              operation: 'notification',
              notificationId: notification.id,
              notificationName: notification.name,
              runId: run.id,
              workspaceId: run.workspaceId,
              workspaceName: run.workspaceName,
              status: run.status,
              duration: run.duration || 0,
              resourceAdditions: run.resourceAdditions,
              resourceChanges: run.resourceChanges,
              resourceDestructions: run.resourceDestructions,
              hasChanges: run.hasChanges || false,
              error: run.error,
              source: 'terraform',
            };

            dataFlowEngine.addMessage({
              source: this.nodeId,
              target: targetComponentId,
              format: 'json',
              payload,
              size: JSON.stringify(payload).length,
              metadata: {
                operation: 'notification',
                contentType: 'application/json',
                terraformNotificationId: notification.id,
                terraformRunId: run.id,
              },
            });
          } catch (error) {
            console.warn(`Failed to send Terraform notification to ${targetComponentId}:`, error);
          }
        }
      }
      // Для других типов (slack, email, webhook) просто логируем
      // В реальной реализации здесь была бы отправка через соответствующие сервисы
    }
  }

  /**
   * Tags Management
   */

  /**
   * Добавляет tag в workspace
   */
  public addTag(workspaceId: string, tag: string): { success: boolean; reason?: string } {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'Workspace not found' };
    }

    const normalizedTag = tag.trim().toLowerCase();
    if (!normalizedTag) {
      return { success: false, reason: 'Tag cannot be empty' };
    }

    const tags = workspace.tags || [];
    if (tags.includes(normalizedTag)) {
      return { success: false, reason: 'Tag already exists' };
    }

    workspace.tags = [...tags, normalizedTag];
    this.workspaces.set(workspaceId, workspace);

    // Синхронизируем с конфигом
    this.syncWorkspaceToConfig(workspaceId);

    return { success: true };
  }

  /**
   * Удаляет tag из workspace
   */
  public removeTag(workspaceId: string, tag: string): { success: boolean; reason?: string } {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'Workspace not found' };
    }

    const normalizedTag = tag.trim().toLowerCase();
    const tags = workspace.tags || [];
    const filteredTags = tags.filter(t => t !== normalizedTag);

    if (filteredTags.length === tags.length) {
      return { success: false, reason: 'Tag not found' };
    }

    workspace.tags = filteredTags;
    this.workspaces.set(workspaceId, workspace);

    // Синхронизируем с конфигом
    this.syncWorkspaceToConfig(workspaceId);

    return { success: true };
  }

  /**
   * Получает все workspaces с указанным tag
   */
  public getWorkspacesByTag(tag: string): TerraformWorkspace[] {
    const normalizedTag = tag.trim().toLowerCase();
    return Array.from(this.workspaces.values()).filter(ws => 
      (ws.tags || []).includes(normalizedTag)
    );
  }

  /**
   * Получает все уникальные tags из всех workspaces
   */
  public getAllTags(): string[] {
    const tagSet = new Set<string>();
    for (const workspace of this.workspaces.values()) {
      (workspace.tags || []).forEach(tag => tagSet.add(tag));
    }
    return Array.from(tagSet).sort();
  }

  /**
   * Run Policies Management
   */

  /**
   * Проверяет run policies для run
   */
  private checkRunPolicies(run: TerraformRun, workspace: TerraformWorkspace | undefined): RunPolicyCheckResult {
    if (!workspace || !workspace.runPolicies || workspace.runPolicies.length === 0) {
      return { passed: true, blockingPolicies: [], requiresApproval: false };
    }

    const enabledPolicies = workspace.runPolicies.filter(p => p.enabled);
    if (enabledPolicies.length === 0) {
      return { passed: true, blockingPolicies: [], requiresApproval: false };
    }

    const blockingPolicies: Array<{ id: string; name: string; type: string; reason: string }> = [];
    let requiresApproval = false;

    for (const policy of enabledPolicies) {
      const conditions = policy.conditions || {};
      
      // Check if policy applies to this run
      if (run.planOnly && !conditions.onPlanOnly) {
        continue; // Policy doesn't apply to plan-only runs
      }
      
      if (!run.planOnly && conditions.onPlanOnly && !conditions.onApply) {
        continue; // Policy only applies to plan-only runs
      }
      
      if (run.planOnly && conditions.onPlanOnly) {
        // Check plan-only policies (Sentinel/OPA can still apply)
        if (policy.type === 'manual_approval') {
          requiresApproval = true;
        } else if (policy.type === 'sentinel' || policy.type === 'opa') {
          // Simulate policy check (in reality would call Sentinel/OPA)
          const policyPassed = Math.random() > 0.1; // 90% pass rate for simulation
          if (!policyPassed) {
            blockingPolicies.push({
              id: policy.id,
              name: policy.name,
              type: policy.type,
              reason: 'Policy check failed',
            });
          }
        }
        continue;
      }
      
      // Check apply policies
      if (conditions.onApply && !run.planOnly) {
        if (policy.type === 'manual_approval') {
          requiresApproval = true;
        } else if (policy.type === 'sentinel' || policy.type === 'opa') {
          // Check conditions
          const totalChanges = (run.resourceAdditions || 0) + (run.resourceChanges || 0) + (run.resourceDestructions || 0);
          
          if (conditions.minResourceChanges !== undefined && totalChanges < conditions.minResourceChanges) {
            continue; // Policy doesn't apply
          }
          
          if (conditions.requireDestruction && (run.resourceDestructions || 0) === 0) {
            continue; // Policy doesn't apply
          }
          
          // Simulate policy check (in reality would call Sentinel/OPA)
          const policyPassed = Math.random() > 0.1; // 90% pass rate for simulation
          if (!policyPassed) {
            blockingPolicies.push({
              id: policy.id,
              name: policy.name,
              type: policy.type,
              reason: 'Policy check failed',
            });
          }
        }
      }
    }

    const passed = blockingPolicies.length === 0;
    return { passed, blockingPolicies, requiresApproval };
  }

  /**
   * Добавляет run policy в workspace
   */
  public addRunPolicy(workspaceId: string, policy: Omit<TerraformRunPolicy, 'id'>): { success: boolean; policyId?: string; reason?: string } {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'Workspace not found' };
    }

    // Проверка уникальности имени
    const existingPolicies = workspace.runPolicies || [];
    if (existingPolicies.some(p => p.name === policy.name)) {
      return { success: false, reason: 'Policy with this name already exists' };
    }

    const policyId = `policy-${workspaceId}-${Date.now()}`;
    const newPolicy: TerraformRunPolicy = {
      id: policyId,
      ...policy,
    };

    workspace.runPolicies = [...existingPolicies, newPolicy];
    this.workspaces.set(workspaceId, workspace);

    // Синхронизируем с конфигом
    this.syncWorkspaceToConfig(workspaceId);

    return { success: true, policyId };
  }

  /**
   * Обновляет run policy в workspace
   */
  public updateRunPolicy(workspaceId: string, policyId: string, updates: Partial<Omit<TerraformRunPolicy, 'id'>>): { success: boolean; reason?: string } {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'Workspace not found' };
    }

    const policies = workspace.runPolicies || [];
    const policyIndex = policies.findIndex(p => p.id === policyId);

    if (policyIndex === -1) {
      return { success: false, reason: 'Policy not found' };
    }

    // Обновляем policy
    policies[policyIndex] = {
      ...policies[policyIndex],
      ...updates,
    };

    workspace.runPolicies = policies;
    this.workspaces.set(workspaceId, workspace);

    // Синхронизируем с конфигом
    this.syncWorkspaceToConfig(workspaceId);

    return { success: true };
  }

  /**
   * Удаляет run policy из workspace
   */
  public deleteRunPolicy(workspaceId: string, policyId: string): { success: boolean; reason?: string } {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'Workspace not found' };
    }

    const policies = workspace.runPolicies || [];
    const filteredPolicies = policies.filter(p => p.id !== policyId);

    if (filteredPolicies.length === policies.length) {
      return { success: false, reason: 'Policy not found' };
    }

    workspace.runPolicies = filteredPolicies;
    this.workspaces.set(workspaceId, workspace);

    // Синхронизируем с конфигом
    this.syncWorkspaceToConfig(workspaceId);

    return { success: true };
  }

  /**
   * Получает все run policies для workspace
   */
  public getRunPolicies(workspaceId: string): TerraformRunPolicy[] {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return [];
    }

    return workspace.runPolicies || [];
  }

  /**
   * Одобряет run для применения (manual approval)
   */
  public approveRun(runId: string, approvedBy: string = 'user'): { success: boolean; reason?: string } {
    const run = this.activeRuns.get(runId) || this.runHistory.get(runId);
    if (!run) {
      return { success: false, reason: 'Run not found' };
    }

    if (run.status !== 'planned') {
      return { success: false, reason: 'Run is not in planned state' };
    }

    if (!run.policyChecks) {
      run.policyChecks = {
        checked: true,
        passed: true,
        requiresApproval: true,
        approved: true,
        approvedBy,
        approvedAt: Date.now(),
      };
    } else {
      run.policyChecks.approved = true;
      run.policyChecks.approvedBy = approvedBy;
      run.policyChecks.approvedAt = Date.now();
    }

    // Re-check policies to ensure they still pass
    const workspace = this.workspaces.get(run.workspaceId);
    const policyCheck = this.checkRunPolicies(run, workspace);
    
    if (!policyCheck.passed) {
      return { success: false, reason: 'Run policies check failed' };
    }

    // Move to applying if approved and policies pass
    if (run.policyChecks.approved && policyCheck.passed && run.hasChanges) {
      run.status = 'applying';
      run.startedAt = Date.now();
      
      // Calculate apply duration
      const state = this.getStateForWorkspace(run.workspaceId);
      const resourceCount = state?.resources || this.config?.defaultStateResources || 10;
      const resourceTimeMultiplier = this.config?.resourceTimeMultiplier || 500;
      const baseApplyTime = this.config?.averageApplyDuration || 120000;
      const resourceFactor = Math.log10(Math.max(1, resourceCount)) * resourceTimeMultiplier;
      const applyTimeWithResources = baseApplyTime + (resourceFactor * 2);
      const durationVariation = this.config?.durationVariation || 0.3;
      const variation = applyTimeWithResources * durationVariation * (Math.random() * 2 - 1);
      (run as any).estimatedApplyDuration = applyTimeWithResources + variation;
    }

    return { success: true };
  }

  /**
   * Синхронизирует workspace с конфигом (для сохранения изменений)
   */
  private syncWorkspaceToConfig(workspaceId: string): void {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace || !this.config) {
      return;
    }

    // Обновляем workspace в конфиге
    const configWorkspaces = this.config.workspaces || [];
    const workspaceIndex = configWorkspaces.findIndex(w => w.id === workspaceId);

    if (workspaceIndex !== -1) {
      configWorkspaces[workspaceIndex] = {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        terraformVersion: workspace.terraformVersion,
        autoApply: workspace.autoApply,
        queueAllRuns: workspace.queueAllRuns,
        workingDirectory: workspace.workingDirectory,
        vcsRepo: workspace.vcsRepo,
        variables: workspace.variables,
        tags: workspace.tags,
        runPolicies: workspace.runPolicies,
        hclCode: workspace.hclCode,
        hclCodeVersion: workspace.hclCodeVersion,
        hclCodeUpdatedAt: workspace.hclCodeUpdatedAt,
      };
      this.config.workspaces = configWorkspaces;
    }
  }

  /**
   * HCL Code Management
   */

  /**
   * Устанавливает HCL код для workspace
   */
  public setHCLCode(workspaceId: string, hclCode: string, version?: string): { success: boolean; reason?: string } {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return { success: false, reason: 'Workspace not found' };
    }
    
    workspace.hclCode = hclCode;
    workspace.hclCodeVersion = version;
    workspace.hclCodeUpdatedAt = Date.now();
    
    this.workspaces.set(workspaceId, workspace);
    this.syncWorkspaceToConfig(workspaceId);
    
    return { success: true };
  }

  /**
   * Получает HCL код для workspace
   */
  public getHCLCode(workspaceId: string): string | undefined {
    const workspace = this.workspaces.get(workspaceId);
    return workspace?.hclCode;
  }

  /**
   * Получает информацию о версии HCL кода для workspace
   */
  public getHCLCodeInfo(workspaceId: string): { version?: string; updatedAt?: number } | undefined {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return undefined;
    
    return {
      version: workspace.hclCodeVersion,
      updatedAt: workspace.hclCodeUpdatedAt,
    };
  }

  /**
   * Получает HCL код для workspace (вспомогательный метод)
   */
  private getHCLCodeForWorkspace(workspaceId: string): string | undefined {
    return this.getHCLCode(workspaceId);
  }

  /**
   * Парсит HCL код и определяет ресурсы
   * Упрощенный парсер для симуляции (в реальности используется библиотека hcl2json или hashicorp/hcl)
   * 
   * Поддерживает формат: resource "type" "name" { ... }
   */
  private parseHCLCode(hclCode: string): {
    resources: Array<{
      type: string;
      name: string;
      address: string;
    }>;
    resourceCount: number;
    resourceTypes: string[];
  } {
    const resources: Array<{ type: string; name: string; address: string }> = [];
    const resourceTypesSet = new Set<string>();
    
    if (!hclCode || typeof hclCode !== 'string') {
      return { resources: [], resourceCount: 0, resourceTypes: [] };
    }
    
    // Простой regex для поиска resource блоков
    // Формат: resource "type" "name" { ... }
    // Поддерживаем различные варианты кавычек: "type", 'type', `type`
    const resourceRegex = /resource\s+(["'`])(\w+)\1\s+(["'`])([\w\-_]+)\3\s*\{/g;
    let match;
    
    while ((match = resourceRegex.exec(hclCode)) !== null) {
      const type = match[2];
      const name = match[4];
      const address = `${type}.${name}`;
      
      resources.push({ type, name, address });
      resourceTypesSet.add(type);
    }
    
    // Также ищем data источники (data "type" "name" { ... })
    const dataRegex = /data\s+(["'`])(\w+)\1\s+(["'`])([\w\-_]+)\3\s*\{/g;
    while ((match = dataRegex.exec(hclCode)) !== null) {
      const type = match[2];
      const name = match[4];
      const address = `data.${type}.${name}`;
      
      // Data источники тоже считаем ресурсами для подсчета
      resources.push({ type: `data.${type}`, name, address });
      resourceTypesSet.add(`data.${type}`);
    }
    
    return {
      resources,
      resourceCount: resources.length,
      resourceTypes: Array.from(resourceTypesSet),
    };
  }
}



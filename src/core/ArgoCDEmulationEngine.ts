import { CanvasNode, CanvasConnection } from '@/types';
import { ComponentMetrics } from './EmulationEngine';
import { ServiceDiscovery } from '@/services/connection/ServiceDiscovery';

/**
 * Argo CD Application Sync Status
 */
export type ApplicationSyncStatus = 'synced' | 'outofsync' | 'progressing' | 'degraded' | 'suspended' | 'unknown';

/**
 * Argo CD Application Health Status
 */
export type ApplicationHealthStatus = 'healthy' | 'degraded' | 'progressing' | 'suspended' | 'missing' | 'unknown';

/**
 * Argo CD Sync Policy Options
 */
export interface SyncPolicyOptions {
  /** Автоматически удалять ресурсы, которых больше нет в Git */
  prune?: boolean;
  /** Автоматически восстанавливать drift (когда ресурсы изменены вручную в кластере) */
  selfHeal?: boolean;
}

/**
 * Argo CD Sync Policy
 * Может быть строкой (для обратной совместимости) или объектом с опциями
 */
export type SyncPolicy = 
  | 'automated' 
  | 'manual' 
  | 'sync-window'
  | {
      type: 'automated' | 'manual' | 'sync-window';
      options?: SyncPolicyOptions;
    };

/**
 * Argo CD Sync Hook Phase
 */
export type SyncHookPhase = 'PreSync' | 'Sync' | 'PostSync' | 'SyncFail' | 'PreDelete' | 'PostDelete' | 'Skip';

/**
 * Argo CD Sync Hook Status
 */
export type SyncHookStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

/**
 * Argo CD Sync Hook
 * Представляет Kubernetes ресурс с аннотацией argocd.argoproj.io/hook
 */
export interface ArgoCDSyncHook {
  name: string;
  kind: string; // Pod, Job, Argo Workflow, etc.
  phase: SyncHookPhase;
  status: SyncHookStatus;
  startedAt?: number;
  finishedAt?: number;
  duration?: number; // milliseconds
  error?: string;
  deletePolicy?: 'HookSucceeded' | 'HookFailed' | 'BeforeHookCreation'; // Когда удалять hook
}

/**
 * Argo CD Helm Chart Configuration
 * Конфигурация для Helm chart в Application
 */
export interface ArgoCDHelmConfig {
  /** Имя Helm chart */
  chart?: string;
  /** Версия chart (например, "1.2.3" или ">=1.0.0") */
  version?: string;
  /** Имя Helm release (опционально, по умолчанию используется имя application) */
  releaseName?: string;
  /** Переопределение values для chart */
  values?: string | Record<string, unknown>;
  /** Values files (пути к файлам values в репозитории) */
  valueFiles?: string[];
  /** Параметры для Helm (например, --set flags) */
  parameters?: Array<{
    name: string;
    value: string;
    forceString?: boolean;
  }>;
  /** Skip CRDs при установке */
  skipCrds?: boolean;
}

/**
 * Argo CD OCI Chart Configuration
 * Конфигурация для OCI chart в Application
 */
export interface ArgoCDOciConfig {
  /** OCI registry URL (например, "oci://registry-1.docker.io/bitnamicharts/nginx") */
  registry?: string;
  /** Имя OCI chart/image */
  chart?: string;
  /** Версия/tag chart (например, "15.9.0" или "latest") */
  version?: string;
  /** Имя Helm release (опционально, по умолчанию используется имя application) */
  releaseName?: string;
  /** Переопределение values для chart */
  values?: string | Record<string, unknown>;
  /** Values files (пути к файлам values в репозитории) */
  valueFiles?: string[];
  /** Параметры для Helm (например, --set flags) */
  parameters?: Array<{
    name: string;
    value: string;
    forceString?: boolean;
  }>;
  /** Skip CRDs при установке */
  skipCrds?: boolean;
}

/**
 * Argo CD Application
 */
export interface ArgoCDApplication {
  name: string;
  namespace?: string;
  project?: string;
  repository: string; // Repository name/URL
  path?: string; // Path in repository (для Git) или chart name (для Helm)
  targetRevision?: string; // Branch/tag/commit (для Git) или chart version (для Helm)
  destination?: {
    server?: string; // Kubernetes server URL
    namespace?: string; // Target namespace
  };
  /** Конфигурация Helm chart (если используется Helm repository) */
  helm?: ArgoCDHelmConfig;
  /** Конфигурация OCI chart (если используется OCI repository) */
  oci?: ArgoCDOciConfig;
  syncPolicy: SyncPolicy;
  status: ApplicationSyncStatus;
  health: ApplicationHealthStatus;
  lastSync?: number; // Timestamp
  lastSyncDuration?: number; // milliseconds
  syncStartedAt?: number;
  resources?: Array<{
    kind: string;
    name: string;
    namespace?: string;
    status: 'synced' | 'outofsync' | 'missing';
    health: ApplicationHealthStatus;
  }>;
  revision?: string; // Current deployed revision
  sourceRevision?: string; // Source revision
  history?: Array<{
    id: string;
    revision: string;
    deployedAt: number;
    deployedBy?: string;
  }>;
  hooks?: ArgoCDSyncHook[]; // Sync hooks для этого application
}

/**
 * Helm Chart Information
 * Информация о Helm chart в репозитории
 */
export interface ArgoCDHelmChart {
  name: string;
  versions: string[]; // Доступные версии chart
  description?: string;
  appVersion?: string; // Версия приложения в chart
  home?: string; // URL домашней страницы chart
  maintainers?: Array<{
    name: string;
    email?: string;
  }>;
}

/**
 * Argo CD Repository
 */
export interface ArgoCDRepository {
  name: string;
  url: string;
  type: 'git' | 'helm' | 'oci';
  username?: string;
  password?: string;
  sshPrivateKey?: string;
  insecure?: boolean;
  enableLfs?: boolean;
  enableOci?: boolean;
  proxy?: string;
  project?: string;
  lastVerifiedAt?: number;
  connectionStatus: 'successful' | 'failed' | 'unknown';
  lastConnectionError?: string;
  /** Список Helm charts (только для Helm repositories) */
  helmCharts?: ArgoCDHelmChart[];
  /** Последнее обновление списка charts */
  chartsLastUpdated?: number;
  /** Список OCI charts/images (только для OCI repositories) */
  ociCharts?: ArgoCDOciChart[];
  /** Последнее обновление списка OCI charts */
  ociChartsLastUpdated?: number;
}

/**
 * OCI Chart Information
 * Информация об OCI chart в репозитории
 */
export interface ArgoCDOciChart {
  name: string; // Полное имя chart (например, "bitnamicharts/nginx")
  registry: string; // Registry URL (например, "registry-1.docker.io")
  versions: string[]; // Доступные версии/tags chart
  description?: string;
  appVersion?: string; // Версия приложения в chart
  maintainers?: Array<{
    name: string;
    email?: string;
  }>;
}

/**
 * Argo CD Project
 */
export interface ArgoCDProject {
  name: string;
  description?: string;
  sourceRepos?: string[]; // Repository URLs/names
  destinations?: Array<{
    server?: string;
    namespace?: string;
  }>;
  clusterResourceWhitelist?: Array<{
    group: string;
    kind: string;
  }>;
  namespaceResourceWhitelist?: Array<{
    group: string;
    kind: string;
  }>;
  roles?: Array<{
    name: string;
    description?: string;
    policies?: string[];
    groups?: string[];
  }>;
}

/**
 * Argo CD Kubernetes Cluster Information
 * Информация о подключенном Kubernetes кластере
 */
export interface ArgoCDCluster {
  /** Имя кластера (из label или hostname) */
  name: string;
  /** URL сервера Kubernetes */
  server: string;
  /** Namespace по умолчанию */
  namespace?: string;
  /** Статус соединения с кластером */
  connectionStatus: 'connected' | 'disconnected' | 'failed';
  /** Статус здоровья кластера */
  health: 'healthy' | 'degraded' | 'unhealthy';
  /** Последняя проверка соединения */
  lastChecked?: number;
  /** Ошибка соединения (если есть) */
  connectionError?: string;
  /** Версия Kubernetes API */
  version?: string;
  /** Количество nodes в кластере */
  nodeCount?: number;
}

/**
 * Argo CD Sync Options
 */
export interface ArgoCDSyncOptions {
  /** Удалять ресурсы, которых больше нет в Git */
  prune?: boolean;
  /** Принудительная синхронизация */
  force?: boolean;
  /** Пробный запуск без изменений */
  dryRun?: boolean;
}

/**
 * Argo CD Sync Operation
 */
export interface ArgoCDSyncOperation {
  id: string;
  application: string;
  startedAt: number;
  finishedAt?: number;
  status: 'running' | 'success' | 'failed' | 'error';
  phase: 'presync' | 'sync' | 'postsync' | 'syncfail' | 'hook' | 'rollback' | 'prune';
  currentHookPhase?: SyncHookPhase; // Текущая фаза hook
  hooks?: Array<{
    name: string;
    phase: SyncHookPhase;
    status: SyncHookStatus;
    startedAt?: number;
    finishedAt?: number;
    error?: string;
  }>;
  resources?: Array<{
    kind: string;
    name: string;
    namespace?: string;
    status: 'synced' | 'failed' | 'skipped' | 'pruned';
    message?: string;
  }>;
  /** Опции синхронизации */
  syncOptions?: ArgoCDSyncOptions;
  /** Количество удаленных ресурсов (prune) */
  prunedResources?: number;
  error?: string;
}

/**
 * Argo CD Configuration
 */
export interface ArgoCDEmulationConfig {
  serverUrl?: string;
  enableSSO?: boolean;
  ssoProvider?: 'oidc' | 'saml' | 'ldap';
  enableRBAC?: boolean;
  enableSyncPolicy?: boolean;
  autoSync?: boolean;
  syncPolicy?: SyncPolicy;
  enableHealthChecks?: boolean;
  enableNotifications?: boolean;
  notificationChannels?: string[];
  applications?: Array<{
    name: string;
    namespace?: string;
    project?: string;
    repository: string;
    path?: string;
    targetRevision?: string;
    destination?: {
      server?: string;
      namespace?: string;
    };
    helm?: {
      chart?: string;
      version?: string;
      releaseName?: string;
      values?: string | Record<string, unknown>;
      valueFiles?: string[];
      parameters?: Array<{
        name: string;
        value: string;
        forceString?: boolean;
      }>;
      skipCrds?: boolean;
    };
    oci?: {
      registry?: string;
      chart?: string;
      version?: string;
      releaseName?: string;
      values?: string | Record<string, unknown>;
      valueFiles?: string[];
      parameters?: Array<{
        name: string;
        value: string;
        forceString?: boolean;
      }>;
      skipCrds?: boolean;
    };
    syncPolicy?: SyncPolicy;
    status?: ApplicationSyncStatus;
    health?: ApplicationHealthStatus;
    hooks?: Array<{
      name: string;
      kind: string;
      phase: SyncHookPhase;
      deletePolicy?: 'HookSucceeded' | 'HookFailed' | 'BeforeHookCreation';
    }>;
  }>;
  repositories?: Array<{
    name: string;
    url: string;
    type?: 'git' | 'helm' | 'oci';
    username?: string;
    password?: string;
    insecure?: boolean;
    project?: string;
    helmCharts?: Array<{
      name: string;
      versions: string[];
      description?: string;
      appVersion?: string;
      home?: string;
      maintainers?: Array<{
        name: string;
        email?: string;
      }>;
    }>;
    ociCharts?: Array<{
      name: string;
      registry: string;
      versions: string[];
      description?: string;
      appVersion?: string;
      maintainers?: Array<{
        name: string;
        email?: string;
      }>;
    }>;
  }>;
  projects?: Array<{
    name: string;
    description?: string;
    sourceRepos?: string[];
    destinations?: Array<{
      server?: string;
      namespace?: string;
    }>;
  }>;
  roles?: Array<{
    name: string;
    description?: string;
    policies?: string[];
    groups?: string[];
  }>;
  notificationChannelsConfig?: Array<{
    name: string;
    type?: 'slack' | 'email' | 'pagerduty' | 'webhook' | 'opsgenie' | 'msteams';
    enabled?: boolean;
    config?: Record<string, unknown>;
    triggers?: Array<{
      event: 'sync-success' | 'sync-failed' | 'health-degraded' | 'health-progressing' | 'sync-running' | 'app-created' | 'app-deleted';
      condition?: string;
    }>;
  }>;
  syncWindows?: Array<{
    name: string;
    description?: string;
    schedule: string;
    duration?: number;
    kind?: 'allow' | 'deny';
    applications?: string[];
    projects?: string[];
    manualSync?: boolean;
    enabled?: boolean;
  }>;
  applicationSets?: Array<{
    name: string;
    namespace?: string;
    generators?: Array<{
      type: ApplicationSetGeneratorType;
      elements?: Array<Record<string, string>>;
      repoURL?: string;
      revision?: string;
      directories?: Array<{ path: string; exclude?: boolean }>;
      files?: Array<{ path: string }>;
      selector?: { matchLabels?: Record<string, string> };
      values?: Record<string, string>;
    }>;
    template?: {
      name?: string;
      namespace?: string;
      project?: string;
      repository?: string;
      path?: string;
      targetRevision?: string;
      destination?: { server?: string; namespace?: string };
      syncPolicy?: SyncPolicy;
    };
    syncPolicy?: SyncPolicy;
    preserveResourcesOnDeletion?: boolean;
    goTemplate?: boolean;
    enabled?: boolean;
  }>;
  syncRate?: number; // syncs per hour per application
  averageSyncDuration?: number; // milliseconds
  failureRate?: number; // 0-1
  healthCheckInterval?: number; // milliseconds
}

/**
 * Argo CD RBAC Policy
 */
export interface ArgoCDPolicy {
  action: string; // e.g., 'get', 'create', 'update', 'delete', 'sync', 'override'
  resource: string; // e.g., 'applications', 'repositories', 'clusters', '*'
  effect: 'allow' | 'deny';
  object?: string; // Specific object name or pattern (e.g., 'app-*', 'default/*')
}

/**
 * Argo CD RBAC Role
 */
export interface ArgoCDRole {
  name: string;
  description?: string;
  policies: ArgoCDPolicy[];
  groups?: string[]; // LDAP/OIDC groups that have this role
  jwtGroups?: string[]; // JWT groups
}

/**
 * Argo CD Notification Channel
 */
export interface ArgoCDNotificationChannel {
  name: string;
  type: 'slack' | 'email' | 'pagerduty' | 'webhook' | 'opsgenie' | 'msteams';
  enabled: boolean;
  config: {
    url?: string; // Webhook URL
    channel?: string; // Slack channel
    recipients?: string[]; // Email recipients
    serviceKey?: string; // PagerDuty service key
    [key: string]: unknown; // Additional config
  };
  triggers: Array<{
    event: 'sync-success' | 'sync-failed' | 'health-degraded' | 'health-progressing' | 'sync-running' | 'app-created' | 'app-deleted';
    condition?: string; // Optional condition
  }>;
}

/**
 * Argo CD Sync Window
 * Блокирует синхронизацию в определенное время
 * Schedule format: cron-like или "HH:MM-HH:MM" для ежедневного окна
 * Duration: в минутах (для cron schedule) или null для time range
 * Kind: 'allow' разрешает sync только в окне, 'deny' блокирует sync в окне
 */
export interface ArgoCDSyncWindow {
  name: string;
  description?: string;
  schedule: string; // Cron expression или "HH:MM-HH:MM" для ежедневного окна
  duration?: number; // Duration in minutes (для cron schedule)
  kind: 'allow' | 'deny'; // allow = разрешить только в окне, deny = блокировать в окне
  applications?: string[]; // Список application names или пусто для всех
  projects?: string[]; // Список project names или пусто для всех
  manualSync?: boolean; // Разрешить manual sync во время блокировки
  enabled: boolean;
}

/**
 * Argo CD ApplicationSet Generator Types
 */
export type ApplicationSetGeneratorType = 'list' | 'git' | 'cluster' | 'matrix' | 'merge' | 'scm' | 'pullRequest' | 'clusterDecisionResource' | 'plugin';

/**
 * List Generator - генерирует Applications из списка параметров
 */
export interface ArgoCDListGenerator {
  type: 'list';
  elements: Array<Record<string, string>>; // Параметры для каждого application
}

/**
 * Git Generator - генерирует Applications из структуры Git репозитория
 */
export interface ArgoCDGitGenerator {
  type: 'git';
  repoURL: string;
  revision?: string;
  directories?: Array<{
    path: string;
    exclude?: boolean;
  }>;
  files?: Array<{
    path: string;
  }>;
}

/**
 * Cluster Generator - генерирует Applications для каждого кластера
 */
export interface ArgoCDClusterGenerator {
  type: 'cluster';
  selector?: {
    matchLabels?: Record<string, string>;
  };
  values?: Record<string, string>; // Значения для шаблона
}

/**
 * ApplicationSet Generator (union type)
 */
export type ArgoCDApplicationSetGenerator = 
  | ArgoCDListGenerator 
  | ArgoCDGitGenerator 
  | ArgoCDClusterGenerator;

/**
 * Argo CD ApplicationSet Template
 * Шаблон для генерации Applications
 */
export interface ArgoCDApplicationSetTemplate {
  name?: string; // Шаблон имени (может использовать параметры)
  namespace?: string;
  project?: string;
  repository?: string;
  path?: string;
  targetRevision?: string;
  destination?: {
    server?: string;
    namespace?: string;
  };
  syncPolicy?: SyncPolicy;
}

/**
 * Argo CD ApplicationSet
 * Генерирует Applications из шаблона используя генераторы
 */
export interface ArgoCDApplicationSet {
  name: string;
  namespace?: string;
  generators: ArgoCDApplicationSetGenerator[];
  template: ArgoCDApplicationSetTemplate;
  syncPolicy?: SyncPolicy;
  preserveResourcesOnDeletion?: boolean;
  goTemplate?: boolean; // Использовать Go templates вместо стандартных
  enabled: boolean;
  generatedApplications?: string[]; // Список сгенерированных application names
}

/**
 * Argo CD Engine Metrics
 */
export interface ArgoCDEngineMetrics {
  applicationsTotal: number;
  applicationsSynced: number;
  applicationsOutOfSync: number;
  applicationsProgressing: number;
  applicationsDegraded: number;
  applicationsHealthy: number;
  syncOperationsTotal: number;
  syncOperationsSuccess: number;
  syncOperationsFailed: number;
  syncOperationsRunning: number;
  syncRate: number; // syncs per hour
  averageSyncDuration: number; // milliseconds
  repositoriesTotal: number;
  repositoriesConnected: number;
  repositoriesFailed: number;
  projectsTotal: number;
  requestsTotal: number;
  requestsErrors: number;
}

/**
 * Helper функции для работы с SyncPolicy
 */

/**
 * Получает тип sync policy (automated, manual, sync-window)
 */
export function getSyncPolicyType(syncPolicy: SyncPolicy | undefined): 'automated' | 'manual' | 'sync-window' {
  if (!syncPolicy) return 'manual';
  if (typeof syncPolicy === 'string') return syncPolicy as 'automated' | 'manual' | 'sync-window';
  return syncPolicy.type;
}

/**
 * Получает опции sync policy (prune, selfHeal)
 */
export function getSyncPolicyOptions(syncPolicy: SyncPolicy | undefined): SyncPolicyOptions {
  if (!syncPolicy) return {};
  if (typeof syncPolicy === 'string') return {};
  return syncPolicy.options || {};
}

/**
 * Проверяет является ли sync policy automated
 */
export function isAutomatedSyncPolicy(syncPolicy: SyncPolicy | undefined): boolean {
  return getSyncPolicyType(syncPolicy) === 'automated';
}

/**
 * Проверяет включен ли prune в sync policy
 */
export function isPruneEnabled(syncPolicy: SyncPolicy | undefined): boolean {
  return getSyncPolicyOptions(syncPolicy).prune === true;
}

/**
 * Проверяет включен ли self-heal в sync policy
 */
export function isSelfHealEnabled(syncPolicy: SyncPolicy | undefined): boolean {
  return getSyncPolicyOptions(syncPolicy).selfHeal === true;
}

/**
 * Результат валидации sync policy
 */
export interface SyncPolicyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Валидирует sync policy
 * @param syncPolicy - Sync policy для валидации
 * @param availableSyncWindows - Доступные sync windows (для проверки sync-window policy)
 * @param applicationName - Имя application (для проверки sync windows по application)
 * @param projectName - Имя project (для проверки sync windows по project)
 */
export function validateSyncPolicy(
  syncPolicy: SyncPolicy | undefined,
  availableSyncWindows: ArgoCDSyncWindow[] = [],
  applicationName?: string,
  projectName?: string
): SyncPolicyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!syncPolicy) {
    // Manual sync policy по умолчанию - валиден
    return { valid: true, errors: [], warnings: [] };
  }
  
  const policyType = getSyncPolicyType(syncPolicy);
  const options = getSyncPolicyOptions(syncPolicy);
  
  // Проверка типа sync policy
  if (policyType !== 'automated' && policyType !== 'manual' && policyType !== 'sync-window') {
    errors.push(`Invalid sync policy type: ${policyType}. Must be 'automated', 'manual', or 'sync-window'`);
  }
  
  // Проверка sync-window policy
  if (policyType === 'sync-window') {
    // Проверяем что есть хотя бы один sync window
    const enabledSyncWindows = availableSyncWindows.filter(sw => sw.enabled !== false);
    
    if (enabledSyncWindows.length === 0) {
      errors.push('Sync policy is set to "sync-window" but no sync windows are configured');
    } else {
      // Проверяем что есть sync window для этого application или project
      const applicableSyncWindows = enabledSyncWindows.filter(sw => {
        // Проверяем по application
        if (applicationName && sw.applications && sw.applications.length > 0) {
          return sw.applications.includes(applicationName);
        }
        // Проверяем по project
        if (projectName && sw.projects && sw.projects.length > 0) {
          return sw.projects.includes(projectName);
        }
        // Если нет специфичных applications/projects - применяется ко всем
        return (!sw.applications || sw.applications.length === 0) && 
               (!sw.projects || sw.projects.length === 0);
      });
      
      if (applicableSyncWindows.length === 0) {
        warnings.push('Sync policy is set to "sync-window" but no sync windows are configured for this application/project');
      }
    }
  }
  
  // Проверка опций для automated policy
  if (policyType === 'automated') {
    // Опции prune и selfHeal должны быть boolean если указаны
    if (options.prune !== undefined && typeof options.prune !== 'boolean') {
      errors.push('Sync policy option "prune" must be a boolean');
    }
    if (options.selfHeal !== undefined && typeof options.selfHeal !== 'boolean') {
      errors.push('Sync policy option "selfHeal" must be a boolean');
    }
    
    // Предупреждение если оба опции включены
    if (options.prune === true && options.selfHeal === true) {
      warnings.push('Both prune and self-heal are enabled. This may cause aggressive automatic changes.');
    }
  } else {
    // Для non-automated policy опции не должны быть указаны
    if (options.prune !== undefined || options.selfHeal !== undefined) {
      warnings.push('Sync policy options (prune, selfHeal) are only valid for automated sync policy');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Argo CD Emulation Engine
 * Симулирует работу Argo CD: applications, repositories, projects, sync operations, health checks
 */
export class ArgoCDEmulationEngine {
  private config: ArgoCDEmulationConfig | null = null;
  private node: CanvasNode | null = null;
  private nodes: CanvasNode[] = [];
  private connections: CanvasConnection[] = [];
  private serviceDiscovery: ServiceDiscovery = new ServiceDiscovery();
  
  // Applications
  private applications: Map<string, ArgoCDApplication> = new Map();
  
  // Repositories
  private repositories: Map<string, ArgoCDRepository> = new Map();
  
  // Projects
  private projects: Map<string, ArgoCDProject> = new Map();
  
  // RBAC Roles
  private roles: Map<string, ArgoCDRole> = new Map();
  
  // Notification Channels
  private notificationChannels: Map<string, ArgoCDNotificationChannel> = new Map();
  
  // Sync Windows
  private syncWindows: Map<string, ArgoCDSyncWindow> = new Map();
  
  // ApplicationSets
  private applicationSets: Map<string, ArgoCDApplicationSet> = new Map();
  
  // Kubernetes Clusters (multi-cluster support)
  private clusters: Map<string, ArgoCDCluster> = new Map();
  
  // Active sync operations
  private syncOperations: Map<string, ArgoCDSyncOperation> = new Map();
  
  // Metrics
  private argoMetrics: ArgoCDEngineMetrics = {
    applicationsTotal: 0,
    applicationsSynced: 0,
    applicationsOutOfSync: 0,
    applicationsProgressing: 0,
    applicationsDegraded: 0,
    applicationsHealthy: 0,
    syncOperationsTotal: 0,
    syncOperationsSuccess: 0,
    syncOperationsFailed: 0,
    syncOperationsRunning: 0,
    syncRate: 0,
    averageSyncDuration: 0,
    repositoriesTotal: 0,
    repositoriesConnected: 0,
    repositoriesFailed: 0,
    projectsTotal: 0,
    requestsTotal: 0,
    requestsErrors: 0,
  };
  
  // Sync operation history
  private syncHistory: Array<{ timestamp: number; duration: number; status: 'success' | 'failed'; operationId?: string; application?: string }> = [];
  private readonly MAX_SYNC_HISTORY = 1000;
  
  // Last sync time per application
  private lastSyncTime: Map<string, number> = new Map();
  
  // Health check tracking
  private lastHealthCheck: Map<string, number> = new Map();
  
  /**
   * Обрабатывает входящий запрос (webhook, API)
   */
  processRequest(success: boolean = true): void {
    this.argoMetrics.requestsTotal++;
    if (!success) {
      this.argoMetrics.requestsErrors++;
    }
  }
  
  /**
   * Инициализирует конфигурацию Argo CD из конфига компонента
   */
  initializeConfig(node: CanvasNode, nodes: CanvasNode[] = [], connections: CanvasConnection[] = []): void {
    const config = node.data.config || {};
    
    this.node = node;
    this.nodes = nodes;
    this.connections = connections;
    
    this.config = {
      serverUrl: config.serverUrl || config.argoUrl || 'https://argocd.example.com',
      enableSSO: config.enableSSO ?? false,
      ssoProvider: config.ssoProvider || 'oidc',
      enableRBAC: config.enableRBAC ?? true,
      enableSyncPolicy: config.enableSyncPolicy ?? true,
      autoSync: config.autoSync ?? false,
      syncPolicy: config.syncPolicy || 'manual',
      enableHealthChecks: config.enableHealthChecks ?? true,
      enableNotifications: config.enableNotifications ?? true,
      notificationChannels: config.notificationChannels || ['slack'],
      applications: config.applications || [],
      repositories: config.repositories || [],
      projects: config.projects || [],
      roles: config.roles || [],
      notificationChannelsConfig: config.notificationChannelsConfig || [],
      syncWindows: config.syncWindows || [],
      applicationSets: config.applicationSets || [],
      syncRate: config.syncRate || 1, // 1 sync per hour per application
      averageSyncDuration: config.averageSyncDuration || 30000, // 30 seconds
      failureRate: config.failureRate || 0.05, // 5% failure rate
      healthCheckInterval: config.healthCheckInterval || 300000, // 5 minutes
    };
    
    // Initialize applications
    this.initializeApplications();
    
    // Initialize repositories
    this.initializeRepositories();
    
    // Initialize projects
    this.initializeProjects();
    
    // Initialize RBAC roles
    this.initializeRoles();
    
    // Initialize notification channels
    this.initializeNotificationChannels();
    
    // Initialize sync windows
    this.initializeSyncWindows();
    
    // Initialize ApplicationSets and generate applications
    this.initializeApplicationSets();
    
    // Initialize clusters (multi-cluster support)
    this.initializeClusters();
  }

  /**
   * Обновляет nodes и connections для проверки соединений
   */
  updateConnections(nodes: CanvasNode[], connections: CanvasConnection[]): void {
    this.nodes = nodes;
    this.connections = connections;
    // Переинициализируем кластеры при изменении соединений
    this.initializeClusters();
  }
  
  /**
   * Инициализирует applications из конфига
   * Без хардкода дефолтных значений - только из конфига
   */
  private initializeApplications(): void {
    this.applications.clear();
    
    const configApplications = this.config?.applications || [];
    
    // Не создаем дефолтные applications - только из конфига
    if (configApplications.length === 0) {
      return;
    }
    
    for (const appConfig of configApplications) {
      const repo = this.repositories.get(appConfig.repository);
      const isHelmRepo = repo?.type === 'helm';
      const isOciRepo = repo?.type === 'oci';
      
      const app: ArgoCDApplication = {
        name: appConfig.name,
        namespace: appConfig.namespace,
        project: appConfig.project || 'default',
        repository: appConfig.repository,
        path: isHelmRepo ? (appConfig.helm?.chart || appConfig.path || '') : 
              isOciRepo ? (appConfig.oci?.chart || appConfig.path || '.') : 
              (appConfig.path || '.'),
        targetRevision: isHelmRepo ? (appConfig.helm?.version || appConfig.targetRevision || 'latest') : 
                        isOciRepo ? (appConfig.oci?.version || appConfig.targetRevision || 'latest') :
                        (appConfig.targetRevision || 'main'),
        destination: appConfig.destination || {
          server: 'https://kubernetes.default.svc',
          namespace: appConfig.namespace || 'default',
        },
        helm: appConfig.helm ? {
          chart: appConfig.helm.chart || appConfig.path,
          version: appConfig.helm.version || appConfig.targetRevision || 'latest',
          releaseName: appConfig.helm.releaseName,
          values: appConfig.helm.values,
          valueFiles: appConfig.helm.valueFiles,
          parameters: appConfig.helm.parameters,
          skipCrds: appConfig.helm.skipCrds,
        } : undefined,
        oci: appConfig.oci ? {
          registry: appConfig.oci.registry,
          chart: appConfig.oci.chart || appConfig.path,
          version: appConfig.oci.version || appConfig.targetRevision || 'latest',
          releaseName: appConfig.oci.releaseName,
          values: appConfig.oci.values,
          valueFiles: appConfig.oci.valueFiles,
          parameters: appConfig.oci.parameters,
          skipCrds: appConfig.oci.skipCrds,
        } : undefined,
        syncPolicy: appConfig.syncPolicy || this.config?.syncPolicy || 'manual',
        status: appConfig.status || 'synced',
        health: appConfig.health || 'healthy',
        lastSync: Date.now() - Math.random() * 3600000, // Random time in last hour
        revision: this.generateRevision(),
        sourceRevision: this.generateRevision(),
        hooks: appConfig.hooks?.map(hookConfig => ({
          name: hookConfig.name,
          kind: hookConfig.kind,
          phase: hookConfig.phase,
          status: 'pending' as SyncHookStatus,
          deletePolicy: hookConfig.deletePolicy,
        })) || [],
      };
      
      this.applications.set(app.name, app);
    }
  }
  
  /**
   * Инициализирует repositories из конфига
   */
  private initializeRepositories(): void {
    this.repositories.clear();
    
    const configRepositories = this.config?.repositories || [];
    
    // Extract unique repositories from applications if not explicitly configured
    const appRepos = new Set<string>();
    for (const app of this.applications.values()) {
      appRepos.add(app.repository);
    }
    
    // Add repositories from config
    for (const repoConfig of configRepositories) {
      const repo: ArgoCDRepository = {
        name: repoConfig.name || repoConfig.url,
        url: repoConfig.url,
        type: repoConfig.type || 'git',
        username: repoConfig.username,
        password: repoConfig.password,
        insecure: repoConfig.insecure ?? false,
        project: repoConfig.project,
        connectionStatus: 'successful',
        lastVerifiedAt: Date.now(),
        helmCharts: repoConfig.type === 'helm' && repoConfig.helmCharts 
          ? repoConfig.helmCharts.map(chart => ({
              name: chart.name,
              versions: chart.versions || [],
              description: chart.description,
              appVersion: chart.appVersion,
              home: chart.home,
              maintainers: chart.maintainers,
            }))
          : undefined,
        chartsLastUpdated: repoConfig.type === 'helm' ? Date.now() : undefined,
        ociCharts: repoConfig.type === 'oci' && repoConfig.ociCharts 
          ? repoConfig.ociCharts.map(chart => ({
              name: chart.name,
              registry: chart.registry,
              versions: chart.versions || [],
              description: chart.description,
              appVersion: chart.appVersion,
              maintainers: chart.maintainers,
            }))
          : undefined,
        ociChartsLastUpdated: repoConfig.type === 'oci' ? Date.now() : undefined,
      };
      
      // Если Helm repository без charts - генерируем примерные charts
      if (repo.type === 'helm' && !repo.helmCharts) {
        repo.helmCharts = this.generateSampleHelmCharts(repo.url);
        repo.chartsLastUpdated = Date.now();
      }
      
      // Если OCI repository без charts - генерируем примерные charts
      if (repo.type === 'oci' && !repo.ociCharts) {
        repo.ociCharts = this.generateSampleOciCharts(repo.url);
        repo.ociChartsLastUpdated = Date.now();
      }
      
      this.repositories.set(repo.name, repo);
    }
    
    // Add repositories from applications if not already added
    for (const repoUrl of appRepos) {
      if (!this.repositories.has(repoUrl)) {
        const repo: ArgoCDRepository = {
          name: repoUrl,
          url: repoUrl,
          type: 'git',
          connectionStatus: 'successful',
          lastVerifiedAt: Date.now(),
        };
        this.repositories.set(repoUrl, repo);
      }
    }
  }
  
  /**
   * Инициализирует projects из конфига
   * Без хардкода дефолтных значений - только из конфига
   */
  private initializeProjects(): void {
    this.projects.clear();
    
    const configProjects = this.config?.projects || [];
    
    // Не создаем дефолтный project - только из конфига
    if (configProjects.length === 0) {
      return;
    }
    
    for (const projectConfig of configProjects) {
      const project: ArgoCDProject = {
        name: projectConfig.name,
        description: projectConfig.description,
        sourceRepos: projectConfig.sourceRepos || ['*'],
        destinations: projectConfig.destinations || [{ server: '*', namespace: '*' }],
      };
      
      this.projects.set(project.name, project);
    }
  }
  
  /**
   * Инициализирует RBAC roles из конфига
   */
  private initializeRoles(): void {
    this.roles.clear();
    
    const configRoles = this.config?.roles || [];
    
    if (configRoles.length === 0) {
      return;
    }
    
    for (const roleConfig of configRoles) {
      const role: ArgoCDRole = {
        name: roleConfig.name,
        description: roleConfig.description,
        policies: (roleConfig.policies || []).map(policyStr => {
          // Parse policy string like "p, role:admin, applications, *, allow"
          const parts = policyStr.split(',');
          if (parts.length >= 4) {
            return {
              action: parts[2]?.trim() || '*',
              resource: parts[3]?.trim() || '*',
              effect: parts[4]?.trim() === 'allow' ? 'allow' : 'deny',
              object: parts[5]?.trim(),
            };
          }
          return {
            action: '*',
            resource: '*',
            effect: 'allow',
          };
        }),
        groups: roleConfig.groups || [],
      };
      
      this.roles.set(role.name, role);
    }
  }
  
  /**
   * Инициализирует notification channels из конфига
   */
  private initializeNotificationChannels(): void {
    this.notificationChannels.clear();
    
    // First, initialize from notificationChannelsConfig if available
    const configChannelsConfig = this.config?.notificationChannelsConfig || [];
    if (configChannelsConfig.length > 0) {
      for (const channelConfig of configChannelsConfig) {
        const channel: ArgoCDNotificationChannel = {
          name: channelConfig.name,
          type: channelConfig.type || 'webhook',
          enabled: channelConfig.enabled ?? true,
          config: channelConfig.config || {},
          triggers: channelConfig.triggers || [
            { event: 'sync-success' },
            { event: 'sync-failed' },
            { event: 'health-degraded' },
          ],
        };
        this.notificationChannels.set(channel.name, channel);
      }
    }
    
    // Also support legacy notificationChannels array (strings)
    const configChannels = this.config?.notificationChannels || [];
    if (this.config?.enableNotifications && configChannels.length > 0) {
      for (const channelName of configChannels) {
        if (!this.notificationChannels.has(channelName)) {
          const channel: ArgoCDNotificationChannel = {
            name: channelName,
            type: channelName === 'slack' ? 'slack' : channelName === 'email' ? 'email' : 'webhook',
            enabled: true,
            config: {},
            triggers: [
              { event: 'sync-success' },
              { event: 'sync-failed' },
              { event: 'health-degraded' },
            ],
          };
          this.notificationChannels.set(channelName, channel);
        }
      }
    }
  }
  
  /**
   * Инициализирует sync windows из конфига
   */
  private initializeSyncWindows(): void {
    this.syncWindows.clear();
    
    const configSyncWindows = this.config?.syncWindows || [];
    
    if (configSyncWindows.length === 0) {
      return;
    }
    
    for (const windowConfig of configSyncWindows) {
      const syncWindow: ArgoCDSyncWindow = {
        name: windowConfig.name,
        description: windowConfig.description,
        schedule: windowConfig.schedule,
        duration: windowConfig.duration,
        kind: windowConfig.kind || 'deny',
        applications: windowConfig.applications || [],
        projects: windowConfig.projects || [],
        manualSync: windowConfig.manualSync ?? false,
        enabled: windowConfig.enabled ?? true,
      };
      
      this.syncWindows.set(syncWindow.name, syncWindow);
    }
  }
  
  /**
   * Инициализирует ApplicationSets и генерирует Applications
   */
  private initializeApplicationSets(): void {
    this.applicationSets.clear();
    
    const configApplicationSets = this.config?.applicationSets || [];
    
    if (configApplicationSets.length === 0) {
      return;
    }
    
    for (const appSetConfig of configApplicationSets) {
      if (!appSetConfig.enabled) continue;
      
      const appSet: ArgoCDApplicationSet = {
        name: appSetConfig.name,
        namespace: appSetConfig.namespace,
        generators: appSetConfig.generators?.map(g => {
          if (g.type === 'list') {
            return {
              type: 'list' as const,
              elements: g.elements || [],
            };
          } else if (g.type === 'git') {
            return {
              type: 'git' as const,
              repoURL: g.repoURL || '',
              revision: g.revision,
              directories: g.directories,
              files: g.files,
            };
          } else if (g.type === 'cluster') {
            return {
              type: 'cluster' as const,
              selector: g.selector,
              values: g.values,
            };
          }
          // Fallback для других типов (пока не реализованы)
          return {
            type: 'list' as const,
            elements: [],
          };
        }) || [],
        template: appSetConfig.template || {},
        syncPolicy: appSetConfig.syncPolicy || 'manual',
        preserveResourcesOnDeletion: appSetConfig.preserveResourcesOnDeletion ?? false,
        goTemplate: appSetConfig.goTemplate ?? false,
        enabled: appSetConfig.enabled ?? true,
        generatedApplications: [],
      };
      
      this.applicationSets.set(appSet.name, appSet);
      
      // Генерируем Applications из ApplicationSet
      this.generateApplicationsFromSet(appSet);
    }
  }
  
  /**
   * Инициализирует список доступных Kubernetes кластеров
   * Обнаруживает все подключенные Kubernetes кластеры через соединения
   */
  private initializeClusters(): void {
    this.clusters.clear();
    
    if (!this.node || !this.nodes.length || !this.connections.length) {
      return;
    }
    
    // Ищем все соединения от Argo CD к Kubernetes компонентам
    const k8sConnections = this.connections.filter(conn => {
      if (conn.source !== this.node!.id) return false;
      
      const targetNode = this.nodes.find(n => n.id === conn.target);
      return targetNode?.type === 'kubernetes';
    });
    
    // Создаем записи о кластерах
    for (const connection of k8sConnections) {
      const k8sNode = this.nodes.find(n => n.id === connection.target);
      if (!k8sNode) continue;
      
      const clusterName = k8sNode.data.label || this.serviceDiscovery.getHost(k8sNode) || `cluster-${k8sNode.id.slice(0, 8)}`;
      
      // Получаем server URL через ServiceDiscovery
      let serverUrl: string;
      try {
        serverUrl = this.serviceDiscovery.getURL(k8sNode, 'main', 'https');
      } catch {
        const host = this.serviceDiscovery.getHost(k8sNode);
        const port = this.serviceDiscovery.getPort(k8sNode, 'main') || 6443;
        serverUrl = `https://${host}:${port}`;
      }
      
      const cluster: ArgoCDCluster = {
        name: clusterName,
        server: serverUrl,
        namespace: 'default',
        connectionStatus: 'connected',
        health: 'healthy',
        lastChecked: Date.now(),
        version: '1.28.0', // Симулируем версию Kubernetes
        nodeCount: 3 + Math.floor(Math.random() * 5), // 3-7 nodes
      };
      
      this.clusters.set(clusterName, cluster);
    }
  }
  
  /**
   * Обновляет информацию о кластерах (health checks, connection status)
   */
  private updateClusters(): void {
    const currentTime = Date.now();
    const checkInterval = 60000; // Проверка каждую минуту
    
    for (const cluster of this.clusters.values()) {
      const lastCheck = cluster.lastChecked || 0;
      const timeSinceLastCheck = currentTime - lastCheck;
      
      if (timeSinceLastCheck >= checkInterval) {
        // Проверяем соединение с кластером
        const hasConnection = this.hasConnectionToKubernetes(cluster.server);
        
        if (hasConnection) {
          cluster.connectionStatus = 'connected';
          cluster.health = 'healthy';
          cluster.connectionError = undefined;
        } else {
          cluster.connectionStatus = 'disconnected';
          cluster.health = 'unhealthy';
          cluster.connectionError = 'No connection to Kubernetes cluster';
        }
        
        cluster.lastChecked = currentTime;
      }
    }
  }
  
  /**
   * Получает список всех доступных кластеров
   */
  getClusters(): ArgoCDCluster[] {
    return Array.from(this.clusters.values());
  }
  
  /**
   * Получает информацию о кластере по имени или server URL
   */
  getCluster(nameOrServer: string): ArgoCDCluster | undefined {
    // Ищем по имени
    let cluster = this.clusters.get(nameOrServer);
    if (cluster) return cluster;
    
    // Ищем по server URL
    for (const c of this.clusters.values()) {
      if (c.server === nameOrServer || c.server.includes(nameOrServer) || nameOrServer.includes(c.server)) {
        return c;
      }
    }
    
    return undefined;
  }
  
  /**
   * Генерирует Applications из ApplicationSet используя генераторы
   */
  private generateApplicationsFromSet(appSet: ArgoCDApplicationSet): void {
    if (!appSet.enabled) return;
    
    const generatedApps: string[] = [];
    
    for (const generator of appSet.generators) {
      if (generator.type === 'list') {
        // List generator: создаем application для каждого элемента
        for (const element of generator.elements) {
          const appName = this.renderTemplate(appSet.template.name || `${appSet.name}-{{name}}`, element);
          const app: ArgoCDApplication = {
            name: appName,
            namespace: this.renderTemplate(appSet.template.namespace || appSet.namespace || 'default', element),
            project: this.renderTemplate(appSet.template.project || 'default', element),
            repository: this.renderTemplate(appSet.template.repository || '', element),
            path: this.renderTemplate(appSet.template.path || '.', element),
            targetRevision: this.renderTemplate(appSet.template.targetRevision || 'main', element),
            destination: {
              server: this.renderTemplate(appSet.template.destination?.server || 'https://kubernetes.default.svc', element),
              namespace: this.renderTemplate(appSet.template.destination?.namespace || 'default', element),
            },
            syncPolicy: appSet.template.syncPolicy || appSet.syncPolicy || 'manual',
            status: 'synced',
            health: 'healthy',
            lastSync: Date.now() - Math.random() * 3600000,
            revision: this.generateRevision(),
            sourceRevision: this.generateRevision(),
          };
          
          // Проверяем что application еще не существует
          if (!this.applications.has(app.name)) {
            this.applications.set(app.name, app);
            generatedApps.push(app.name);
          }
        }
      } else if (generator.type === 'git') {
        // Git generator: создаем applications из структуры Git репозитория
        // Упрощенная симуляция - создаем applications для каждого directory
        const directories = generator.directories || [{ path: '.' }];
        for (const dir of directories) {
          if (dir.exclude) continue;
          
          const appName = `${appSet.name}-${dir.path.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}`;
          const app: ArgoCDApplication = {
            name: appName,
            namespace: appSet.template.namespace || appSet.namespace || 'default',
            project: appSet.template.project || 'default',
            repository: generator.repoURL,
            path: dir.path,
            targetRevision: generator.revision || appSet.template.targetRevision || 'main',
            destination: {
              server: appSet.template.destination?.server || 'https://kubernetes.default.svc',
              namespace: appSet.template.destination?.namespace || 'default',
            },
            syncPolicy: appSet.template.syncPolicy || appSet.syncPolicy || 'manual',
            status: 'synced',
            health: 'healthy',
            lastSync: Date.now() - Math.random() * 3600000,
            revision: this.generateRevision(),
            sourceRevision: this.generateRevision(),
          };
          
          if (!this.applications.has(app.name)) {
            this.applications.set(app.name, app);
            generatedApps.push(app.name);
          }
        }
      } else if (generator.type === 'cluster') {
        // Cluster generator: создаем applications для каждого кластера
        // Упрощенная симуляция - создаем один application для кластера
        const clusterName = generator.values?.cluster || 'default-cluster';
        const appName = `${appSet.name}-${clusterName}`;
        const app: ArgoCDApplication = {
          name: appName,
          namespace: this.renderTemplate(appSet.template.namespace || appSet.namespace || 'default', generator.values || {}),
          project: this.renderTemplate(appSet.template.project || 'default', generator.values || {}),
          repository: this.renderTemplate(appSet.template.repository || '', generator.values || {}),
          path: this.renderTemplate(appSet.template.path || '.', generator.values || {}),
          targetRevision: this.renderTemplate(appSet.template.targetRevision || 'main', generator.values || {}),
          destination: {
            server: this.renderTemplate(appSet.template.destination?.server || 'https://kubernetes.default.svc', generator.values || {}),
            namespace: this.renderTemplate(appSet.template.destination?.namespace || 'default', generator.values || {}),
          },
          syncPolicy: appSet.template.syncPolicy || appSet.syncPolicy || 'manual',
          status: 'synced',
          health: 'healthy',
          lastSync: Date.now() - Math.random() * 3600000,
          revision: this.generateRevision(),
          sourceRevision: this.generateRevision(),
        };
        
        if (!this.applications.has(app.name)) {
          this.applications.set(app.name, app);
          generatedApps.push(app.name);
        }
      }
    }
    
    // Сохраняем список сгенерированных applications
    appSet.generatedApplications = generatedApps;
  }
  
  /**
   * Рендерит шаблон с параметрами (упрощенная версия Go templates)
   */
  private renderTemplate(template: string, params: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(params)) {
      // Заменяем {{key}} на value
      result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value);
      // Также поддерживаем {{.key}} формат
      result = result.replace(new RegExp(`{{\\s*\\.${key}\\s*}}`, 'g'), value);
    }
    return result;
  }
  
  /**
   * Проверяет, разрешена ли синхронизация для application в текущее время
   * @param applicationName Имя application
   * @param currentTime Текущее время (timestamp)
   * @param isManualSync Является ли это manual sync
   * @returns true если sync разрешен, false если заблокирован
   */
  private isSyncAllowed(applicationName: string, currentTime: number, isManualSync: boolean = false): boolean {
    const app = this.applications.get(applicationName);
    if (!app) return false;
    
    // Если нет активных sync windows - разрешаем
    const activeWindows = Array.from(this.syncWindows.values()).filter(w => w.enabled);
    if (activeWindows.length === 0) {
      return true;
    }
    
    // Проверяем каждое sync window
    for (const syncWindow of activeWindows) {
      // Проверяем, применяется ли это окно к данному application
      const appliesToApp = syncWindow.applications?.length === 0 || 
                          syncWindow.applications?.includes(applicationName) ||
                          syncWindow.projects?.includes(app.project || 'default');
      
      if (!appliesToApp) {
        continue; // Это окно не применяется к данному application
      }
      
      // Проверяем, находится ли текущее время в окне
      const isInWindow = this.isTimeInSyncWindow(syncWindow, currentTime);
      
      if (syncWindow.kind === 'deny') {
        // Deny window: блокируем sync если время в окне
        if (isInWindow) {
          // Если manual sync разрешен - пропускаем блокировку
          if (isManualSync && syncWindow.manualSync) {
            continue;
          }
          return false; // Блокируем sync
        }
      } else if (syncWindow.kind === 'allow') {
        // Allow window: разрешаем sync только если время в окне
        if (!isInWindow) {
          return false; // Блокируем sync вне окна
        }
      }
    }
    
    return true; // Разрешаем sync
  }
  
  /**
   * Проверяет, находится ли время в sync window
   * Поддерживает два формата:
   * 1. "HH:MM-HH:MM" - ежедневное окно (например, "09:00-17:00")
   * 2. Cron-like выражение с duration (например, "0 9 * * 1-5" с duration 480 минут = рабочие дни 9:00-17:00)
   */
  private isTimeInSyncWindow(syncWindow: ArgoCDSyncWindow, currentTime: number): boolean {
    const date = new Date(currentTime);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const currentTimeMinutes = hours * 60 + minutes;
    
    // Простой формат "HH:MM-HH:MM" для ежедневного окна
    const timeRangeMatch = syncWindow.schedule.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
    if (timeRangeMatch) {
      const startHours = parseInt(timeRangeMatch[1], 10);
      const startMinutes = parseInt(timeRangeMatch[2], 10);
      const endHours = parseInt(timeRangeMatch[3], 10);
      const endMinutes = parseInt(timeRangeMatch[4], 10);
      
      const startTimeMinutes = startHours * 60 + startMinutes;
      const endTimeMinutes = endHours * 60 + endMinutes;
      
      // Обрабатываем окно, которое переходит через полночь
      if (endTimeMinutes < startTimeMinutes) {
        return currentTimeMinutes >= startTimeMinutes || currentTimeMinutes <= endTimeMinutes;
      } else {
        return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
      }
    }
    
    // Cron-like формат (упрощенный)
    // Формат: "minute hour day-of-month month day-of-week"
    // Примеры:
    // "0 9 * * 1-5" - рабочие дни в 9:00
    // "0 9-17 * * 1-5" - рабочие дни с 9:00 до 17:00
    // "0 0 * * 0" - воскресенье в полночь
    
    const cronParts = syncWindow.schedule.split(/\s+/);
    if (cronParts.length >= 5) {
      const cronMinute = cronParts[0];
      const cronHour = cronParts[1];
      const cronDayOfMonth = cronParts[2];
      const cronMonth = cronParts[3];
      const cronDayOfWeek = cronParts[4];
      
      // Проверяем минуту
      if (cronMinute !== '*' && parseInt(cronMinute, 10) !== minutes) {
        return false;
      }
      
      // Проверяем час (может быть диапазоном "9-17")
      let hourMatch = false;
      if (cronHour === '*') {
        hourMatch = true;
      } else if (cronHour.includes('-')) {
        const [startHour, endHour] = cronHour.split('-').map(h => parseInt(h, 10));
        hourMatch = hours >= startHour && hours <= endHour;
      } else {
        hourMatch = parseInt(cronHour, 10) === hours;
      }
      
      if (!hourMatch) {
        return false;
      }
      
      // Проверяем день недели (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
      if (cronDayOfWeek !== '*') {
        let dayMatch = false;
        if (cronDayOfWeek.includes('-')) {
          const [startDay, endDay] = cronDayOfWeek.split('-').map(d => {
            const day = parseInt(d, 10);
            // В cron 0 или 7 = Sunday, но в JS Date.getDay() 0 = Sunday
            return day === 0 || day === 7 ? 0 : day;
          });
          dayMatch = dayOfWeek >= startDay && dayOfWeek <= endDay;
        } else if (cronDayOfWeek.includes(',')) {
          const days = cronDayOfWeek.split(',').map(d => {
            const day = parseInt(d.trim(), 10);
            return day === 0 || day === 7 ? 0 : day;
          });
          dayMatch = days.includes(dayOfWeek);
        } else {
          const day = parseInt(cronDayOfWeek, 10);
          const normalizedDay = day === 0 || day === 7 ? 0 : day;
          dayMatch = normalizedDay === dayOfWeek;
        }
        
        if (!dayMatch) {
          return false;
        }
      }
      
      // Если указана duration, проверяем что текущее время в пределах duration от начала окна
      if (syncWindow.duration && syncWindow.duration > 0) {
        // Для упрощения считаем что окно начинается в указанный час
        const windowStartMinutes = (cronHour.includes('-') ? parseInt(cronHour.split('-')[0], 10) : parseInt(cronHour, 10)) * 60;
        const windowEndMinutes = windowStartMinutes + syncWindow.duration;
        
        if (windowEndMinutes >= 1440) {
          // Окно переходит через полночь
          return currentTimeMinutes >= windowStartMinutes || currentTimeMinutes <= (windowEndMinutes % 1440);
        } else {
          return currentTimeMinutes >= windowStartMinutes && currentTimeMinutes <= windowEndMinutes;
        }
      }
      
      return true;
    }
    
    // Если формат не распознан - считаем что окно активно всегда
    return true;
  }
  
  /**
   * Генерирует случайный revision hash
   */
  private generateRevision(): string {
    return Math.random().toString(36).substring(2, 8);
  }
  
  /**
   * Выполняет один цикл обновления Argo CD
   * Должен вызываться периодически в EmulationEngine
   */
  performUpdate(currentTime: number): void {
    if (!this.config) return;
    
    // Update active sync operations
    this.updateSyncOperations(currentTime);
    
    // Trigger automatic syncs if enabled
    if (this.config.autoSync || isAutomatedSyncPolicy(this.config.syncPolicy)) {
      this.triggerAutoSyncs(currentTime);
    }
    
    // Perform health checks
    if (this.config.enableHealthChecks) {
      this.performHealthChecks(currentTime);
    }
    
    // Check repository connections
    this.checkRepositoryConnections(currentTime);
    
    // Update clusters (multi-cluster support)
    this.updateClusters();
    
    // Update metrics
    this.updateMetrics();
  }
  
  /**
   * Обновляет активные sync operations
   * Выполняет hooks в правильном порядке: PreSync -> Sync -> PostSync
   */
  private updateSyncOperations(currentTime: number): void {
    const operationsToProcess = Array.from(this.syncOperations.entries());
    
    for (const [operationId, operation] of operationsToProcess) {
      if (operation.status !== 'running') continue;
      
      if (!operation.startedAt) {
        operation.startedAt = currentTime;
        // Инициализируем hooks если их еще нет
        if (!operation.hooks) {
          operation.hooks = [];
        }
        continue;
      }
      
      const app = this.applications.get(operation.application);
      if (!app) {
        // Application удален - завершаем операцию
        operation.status = 'failed';
        operation.error = 'Application not found';
        operation.finishedAt = currentTime;
        this.argoMetrics.syncOperationsFailed++;
        this.argoMetrics.syncOperationsRunning--;
        this.syncOperations.delete(operationId);
        continue;
      }
      
      // Получаем hooks для application
      const appHooks = app.hooks || [];
      
      // Определяем текущую фазу операции
      const currentPhase = operation.phase || 'presync';
      
      // Выполняем hooks по фазам
      if (currentPhase === 'presync') {
        // Выполняем PreSync hooks
        const presyncHooks = appHooks.filter(h => h.phase === 'PreSync');
        const hookDuration = 2000; // 2 секунды на hook
        
        if (presyncHooks.length > 0) {
          // Проверяем статус PreSync hooks
          let allPresyncComplete = true;
          let presyncFailed = false;
          
          for (const hook of presyncHooks) {
            const hookStatus = operation.hooks?.find(h => h.name === hook.name && h.phase === 'PreSync');
            
            if (!hookStatus) {
              // Запускаем hook
              operation.hooks!.push({
                name: hook.name,
                phase: 'PreSync',
                status: 'running',
                startedAt: currentTime,
              });
              operation.currentHookPhase = 'PreSync';
              allPresyncComplete = false;
            } else if (hookStatus.status === 'running') {
              // Hook выполняется
              const hookElapsed = currentTime - (hookStatus.startedAt || operation.startedAt);
              if (hookElapsed >= hookDuration) {
                // Hook завершен
                const hookShouldFail = Math.random() < (this.config?.failureRate || 0.05) * 0.5; // Hooks реже фейлятся
                hookStatus.status = hookShouldFail ? 'failed' : 'success';
                hookStatus.finishedAt = currentTime;
                
                if (hookShouldFail) {
                  hookStatus.error = `PreSync hook "${hook.name}" failed`;
                  presyncFailed = true;
                }
              } else {
                allPresyncComplete = false;
              }
            } else if (hookStatus.status === 'failed') {
              presyncFailed = true;
            }
          }
          
          if (presyncFailed) {
            // PreSync hook failed - останавливаем sync
            operation.status = 'failed';
            operation.phase = 'syncfail';
            operation.error = 'PreSync hook failed';
            operation.finishedAt = currentTime;
            
            // Выполняем SyncFail hooks
            this.executeSyncFailHooks(operation, appHooks, currentTime);
            
            app.status = 'degraded';
            app.health = 'degraded';
            this.addSyncToHistory(operation);
            this.argoMetrics.syncOperationsFailed++;
            this.argoMetrics.syncOperationsRunning--;
            this.syncOperations.delete(operationId);
            
            // Отправляем notification о неудачной синхронизации
            this.sendNotification('sync-failed', {
              application: operation.application,
              operationId: operation.id,
              error: operation.error,
              phase: 'presync',
            });
            
            continue;
          }
          
          if (allPresyncComplete) {
            // PreSync hooks завершены - переходим к Sync
            operation.phase = 'sync';
            operation.currentHookPhase = undefined;
          }
        } else {
          // Нет PreSync hooks - переходим к Sync
          operation.phase = 'sync';
        }
      }
      
      if (currentPhase === 'sync' || operation.phase === 'sync') {
        // Выполняем основную синхронизацию
        const elapsed = currentTime - operation.startedAt;
        const estimatedDuration = this.config?.averageSyncDuration || 30000;
        
          if (elapsed >= estimatedDuration) {
          // Sync завершен - проверяем на ошибки
          const shouldFail = Math.random() < (this.config?.failureRate || 0.05);
          
          if (shouldFail) {
            // Sync failed - выполняем SyncFail hooks
            operation.status = 'failed';
            operation.phase = 'syncfail';
            operation.error = 'Sync failed: resource conflict or validation error';
            operation.finishedAt = currentTime;
            
            this.executeSyncFailHooks(operation, appHooks, currentTime);
            
            app.status = 'degraded';
            app.health = 'degraded';
            this.addSyncToHistory(operation);
            this.argoMetrics.syncOperationsFailed++;
            this.argoMetrics.syncOperationsRunning--;
            this.syncOperations.delete(operationId);
            
            // Отправляем notification о неудачной синхронизации
            this.sendNotification('sync-failed', {
              application: operation.application,
              operationId: operation.id,
              error: operation.error,
              phase: 'sync',
            });
            
            continue;
          }
          
          // Sync успешен - проверяем нужно ли выполнить prune
          if (operation.syncOptions?.prune && !operation.syncOptions?.dryRun) {
            // Переходим к prune фазе
            operation.phase = 'prune';
          } else {
            // Переходим к PostSync
            operation.phase = 'postsync';
          }
        }
      }
      
      // Prune фаза - удаление ресурсов, которых больше нет в Git
      if (currentPhase === 'prune' || operation.phase === 'prune') {
        const elapsed = currentTime - operation.startedAt;
        const pruneDuration = 5000; // 5 секунд на prune
        
        // Симулируем обнаружение и удаление ресурсов
        if (!operation.prunedResources && elapsed >= pruneDuration) {
          // Симулируем обнаружение ресурсов для удаления
          // В реальности это сравнение Git манифестов с ресурсами в кластере
          const prunedCount = Math.floor(Math.random() * 3); // 0-2 ресурса для удаления
          operation.prunedResources = prunedCount;
          
          if (prunedCount > 0 && operation.resources) {
            // Добавляем информацию о удаленных ресурсах
            for (let i = 0; i < prunedCount; i++) {
              operation.resources.push({
                kind: `Resource${i + 1}`,
                name: `pruned-resource-${i + 1}`,
                status: 'pruned',
                message: 'Resource removed from Git repository',
              });
            }
          }
        }
        
        // Prune завершен - переходим к PostSync
        if (elapsed >= pruneDuration) {
          operation.phase = 'postsync';
        }
      }
      
      if (currentPhase === 'postsync' || operation.phase === 'postsync') {
        // Выполняем PostSync hooks
        const postsyncHooks = appHooks.filter(h => h.phase === 'PostSync');
        const hookDuration = 2000;
        
        if (postsyncHooks.length > 0) {
          let allPostsyncComplete = true;
          let postsyncFailed = false;
          
          for (const hook of postsyncHooks) {
            const hookStatus = operation.hooks?.find(h => h.name === hook.name && h.phase === 'PostSync');
            
            if (!hookStatus) {
              operation.hooks!.push({
                name: hook.name,
                phase: 'PostSync',
                status: 'running',
                startedAt: currentTime,
              });
              operation.currentHookPhase = 'PostSync';
              allPostsyncComplete = false;
            } else if (hookStatus.status === 'running') {
              const hookElapsed = currentTime - (hookStatus.startedAt || operation.startedAt);
              if (hookElapsed >= hookDuration) {
                const hookShouldFail = Math.random() < (this.config?.failureRate || 0.05) * 0.5;
                hookStatus.status = hookShouldFail ? 'failed' : 'success';
                hookStatus.finishedAt = currentTime;
                
                if (hookShouldFail) {
                  hookStatus.error = `PostSync hook "${hook.name}" failed`;
                  postsyncFailed = true;
                }
              } else {
                allPostsyncComplete = false;
              }
            } else if (hookStatus.status === 'failed') {
              postsyncFailed = true;
            }
          }
          
          if (!allPostsyncComplete) {
            continue; // Ждем завершения PostSync hooks
          }
          
          // PostSync hooks завершены (даже если failed - deployment считается успешным, но marked failed)
          if (postsyncFailed) {
            operation.status = 'failed';
            operation.error = 'PostSync hook failed';
            app.status = 'degraded';
            app.health = 'degraded';
            
            // Отправляем notification о неудачной синхронизации
            this.sendNotification('sync-failed', {
              application: operation.application,
              operationId: operation.id,
              error: operation.error,
              phase: 'postsync',
            });
          } else {
            operation.status = 'success';
            app.status = 'synced';
            app.health = 'healthy';
            app.lastSync = currentTime;
            app.lastSyncDuration = currentTime - operation.startedAt;
            app.revision = app.sourceRevision = this.generateRevision();
            
            // Add to history
            if (!app.history) {
              app.history = [];
            }
            app.history.unshift({
              id: operationId,
              revision: app.revision,
              deployedAt: currentTime,
            });
            if (app.history.length > 10) {
              app.history.pop();
            }
            
            // Отправляем notification об успешной синхронизации
            this.sendNotification('sync-success', {
              application: operation.application,
              operationId: operation.id,
              duration: currentTime - operation.startedAt,
              revision: app.revision,
            });
          }
          
          operation.finishedAt = currentTime;
          this.addSyncToHistory(operation);
          
          if (operation.status === 'success') {
            this.argoMetrics.syncOperationsSuccess++;
          } else {
            this.argoMetrics.syncOperationsFailed++;
          }
          this.argoMetrics.syncOperationsRunning--;
          this.syncOperations.delete(operationId);
        } else {
          // Нет PostSync hooks - завершаем sync
          operation.status = 'success';
          operation.finishedAt = currentTime;
          app.status = 'synced';
          app.health = 'healthy';
          app.lastSync = currentTime;
          app.lastSyncDuration = currentTime - operation.startedAt;
          app.revision = app.sourceRevision = this.generateRevision();
          
          if (!app.history) {
            app.history = [];
          }
          app.history.unshift({
            id: operationId,
            revision: app.revision,
            deployedAt: currentTime,
          });
          if (app.history.length > 10) {
            app.history.pop();
          }
          
          this.addSyncToHistory(operation);
          this.argoMetrics.syncOperationsSuccess++;
          this.argoMetrics.syncOperationsRunning--;
          this.syncOperations.delete(operationId);
          
          // Отправляем notification об успешной синхронизации
          this.sendNotification('sync-success', {
            application: operation.application,
            operationId: operation.id,
            duration: currentTime - operation.startedAt,
            revision: app.revision,
          });
        }
      }
    }
  }
  
  /**
   * Выполняет SyncFail hooks при ошибке синхронизации
   */
  private executeSyncFailHooks(
    operation: ArgoCDSyncOperation,
    appHooks: ArgoCDSyncHook[],
    currentTime: number
  ): void {
    const syncFailHooks = appHooks.filter(h => h.phase === 'SyncFail');
    
    if (!operation.hooks) {
      operation.hooks = [];
    }
    
    // SyncFail hooks выполняются быстро (симуляция)
    for (const hook of syncFailHooks) {
      operation.hooks.push({
        name: hook.name,
        phase: 'SyncFail',
        status: 'success', // SyncFail hooks обычно успешны (они для cleanup)
        startedAt: currentTime,
        finishedAt: currentTime + 500, // Быстрое выполнение
      });
    }
  }
  
  /**
   * Триггерит автоматические синхронизации
   * Поддерживает self-heal для автоматического восстановления drift
   */
  private triggerAutoSyncs(currentTime: number): void {
    const syncRate = this.config?.syncRate || 1; // syncs per hour
    const syncInterval = 3600000 / syncRate; // milliseconds between syncs
    
    for (const app of this.applications.values()) {
      // Проверяем sync policy используя helper функцию
      if (!isAutomatedSyncPolicy(app.syncPolicy)) continue;
      
      const lastSync = this.lastSyncTime.get(app.name) || app.lastSync || 0;
      const timeSinceLastSync = currentTime - lastSync;
      
      // Self-heal: проверяем drift чаще чем обычный sync interval
      const selfHealEnabled = isSelfHealEnabled(app.syncPolicy);
      const selfHealInterval = selfHealEnabled ? syncInterval / 2 : syncInterval * 2; // Self-heal проверяет в 2 раза чаще
      
      // Проверяем нужно ли запустить sync
      const shouldSync = timeSinceLastSync >= syncInterval;
      const shouldSelfHeal = selfHealEnabled && timeSinceLastSync >= selfHealInterval;
      
      if (shouldSync || shouldSelfHeal) {
        // Self-heal: симулируем обнаружение drift (когда ресурсы изменены вручную в кластере)
        // В реальности Argo CD сравнивает Git манифесты с ресурсами в кластере
        if (selfHealEnabled && app.status === 'synced' && Math.random() < 0.1) {
          // 10% chance обнаружить drift (симуляция)
          app.status = 'outofsync';
          // Автоматически запускаем sync для восстановления
        }
        
        // Check if app is out of sync or needs refresh
        if (app.status === 'outofsync' || app.status === 'synced' || shouldSelfHeal) {
          // Проверяем sync windows перед автоматической синхронизацией
          if (this.isSyncAllowed(app.name, currentTime, false)) {
            // Используем опции из sync policy
            const policyOptions = getSyncPolicyOptions(app.syncPolicy);
            const syncOptions: ArgoCDSyncOptions = {
              prune: policyOptions.prune ?? false,
              force: false,
              dryRun: false,
            };
            
            this.startSync(app.name, currentTime, false, undefined, syncOptions);
            this.lastSyncTime.set(app.name, currentTime);
          }
        }
      }
    }
  }
  
  /**
   * Выполняет health checks для приложений с учетом соединений
   */
  private performHealthChecks(currentTime: number): void {
    const healthCheckInterval = this.config?.healthCheckInterval || 300000; // 5 minutes
    
    for (const app of this.applications.values()) {
      const lastCheck = this.lastHealthCheck.get(app.name) || 0;
      const timeSinceLastCheck = currentTime - lastCheck;
      
      if (timeSinceLastCheck >= healthCheckInterval) {
        // Проверяем соединения для health check
        const repo = this.repositories.get(app.repository);
        const hasRepoConnection = repo ? repo.connectionStatus === 'successful' : false;
        const hasK8sConnection = this.hasConnectionToKubernetes(app.destination?.server);
        
        // Если нет соединений - приложение должно быть degraded
        if (!hasRepoConnection || !hasK8sConnection) {
          const wasHealthy = app.health === 'healthy';
          app.health = 'degraded';
          app.status = 'degraded';
          
          // Отправляем notification если health изменился на degraded
          if (wasHealthy) {
            this.sendNotification('health-degraded', {
              application: app.name,
              reason: !hasRepoConnection ? 'Repository connection failed' : 'Kubernetes connection failed',
            });
          }
        } else {
          // Если соединения есть, проверяем статус репозитория
          if (repo && repo.connectionStatus === 'failed') {
            const wasHealthy = app.health === 'healthy';
            app.health = 'degraded';
            app.status = 'degraded';
            
            // Отправляем notification если health изменился на degraded
            if (wasHealthy) {
              this.sendNotification('health-degraded', {
                application: app.name,
                reason: 'Repository connection failed',
              });
            }
          } else if (app.health === 'degraded' && Math.random() < 0.3) {
            // 30% chance to recover if was degraded
            app.health = 'healthy';
            if (app.status === 'degraded') {
              app.status = 'synced';
            }
          }
        }
        
        this.lastHealthCheck.set(app.name, currentTime);
      }
    }
  }
  
  /**
   * Проверяет соединения с репозиториями на основе реальных соединений
   */
  private checkRepositoryConnections(currentTime: number): void {
    const checkInterval = 600000; // 10 minutes
    
    if (!this.node) return;
    
    for (const repo of this.repositories.values()) {
      const lastCheck = repo.lastVerifiedAt || 0;
      const timeSinceLastCheck = currentTime - lastCheck;
      
      if (timeSinceLastCheck >= checkInterval) {
        if (repo.type === 'helm') {
          // Для Helm repositories проверяем соединение с Helm registry
          const hasHelmConnection = this.hasConnectionToHelmRepository(repo);
          
          if (hasHelmConnection) {
            repo.connectionStatus = 'successful';
            repo.lastVerifiedAt = currentTime;
            repo.lastConnectionError = undefined;
            
            // Обновляем список charts для Helm repository
            this.updateHelmRepositoryCharts(repo.name);
          } else {
            repo.connectionStatus = 'failed';
            repo.lastConnectionError = 'No connection to Helm repository found';
            repo.lastVerifiedAt = currentTime;
          }
        } else if (repo.type === 'git' || !repo.type) {
          // Для Git repositories проверяем наличие реального соединения с Git репозиторием
          const hasGitConnection = this.hasConnectionToGitRepository(repo.url);
          
          if (hasGitConnection) {
            repo.connectionStatus = 'successful';
            repo.lastVerifiedAt = currentTime;
            repo.lastConnectionError = undefined;
          } else {
            repo.connectionStatus = 'failed';
            repo.lastConnectionError = 'No connection to Git repository found';
            repo.lastVerifiedAt = currentTime;
          }
        } else if (repo.type === 'oci') {
          // Для OCI repositories проверяем соединение с OCI registry
          const hasOciConnection = this.hasConnectionToOciRepository(repo);
          
          if (hasOciConnection) {
            repo.connectionStatus = 'successful';
            repo.lastVerifiedAt = currentTime;
            repo.lastConnectionError = undefined;
            
            // Обновляем список charts для OCI repository
            this.updateOciRepositoryCharts(repo.name);
          } else {
            repo.connectionStatus = 'failed';
            repo.lastConnectionError = 'No connection to OCI registry found';
            repo.lastVerifiedAt = currentTime;
          }
        } else {
          // Для других типов - базовая проверка
          repo.connectionStatus = 'successful';
          repo.lastVerifiedAt = currentTime;
        }
      }
    }
  }

  /**
   * Проверяет наличие соединения с Git репозиторием
   */
  private hasConnectionToGitRepository(repoUrl: string): boolean {
    if (!this.node) return false;
    
    // Ищем соединения от Argo CD к Git компонентам (gitlab, github, git)
    const gitConnections = this.connections.filter(conn => {
      if (conn.source !== this.node!.id) return false;
      
      const targetNode = this.nodes.find(n => n.id === conn.target);
      if (!targetNode) return false;
      
      // Проверяем типы Git компонентов
      const gitTypes = ['gitlab', 'github', 'git'];
      return gitTypes.includes(targetNode.type);
    });
    
    return gitConnections.length > 0;
  }

  /**
   * Проверяет наличие соединения с Kubernetes кластером
   * Поддерживает резолвинг destination server через ServiceDiscovery
   */
  private hasConnectionToKubernetes(serverUrl?: string): boolean {
    if (!this.node) return false;
    
    // Если указан serverUrl, пытаемся резолвить его через ServiceDiscovery
    if (serverUrl && serverUrl !== 'https://kubernetes.default.svc' && serverUrl !== '*') {
      // Пытаемся найти Kubernetes компонент по URL или имени
      const k8sNode = this.nodes.find(n => {
        if (n.type !== 'kubernetes') return false;
        
        // Проверяем по hostname из ServiceDiscovery
        const host = this.serviceDiscovery.getHost(n);
        const url = this.serviceDiscovery.getURL(n, 'main', 'https');
        
        // Проверяем соответствие serverUrl
        return serverUrl.includes(host) || 
               serverUrl.includes(n.data.label || '') ||
               url === serverUrl ||
               serverUrl === `https://${host}:6443` ||
               serverUrl === `https://${host}`;
      });
      
      if (k8sNode) {
        // Проверяем наличие соединения с этим узлом
        const hasConnection = this.connections.some(conn => 
          conn.source === this.node!.id && conn.target === k8sNode.id
        );
        return hasConnection;
      }
      
      // Если не нашли по URL, проверяем наличие любого соединения с Kubernetes
    }
    
    // Ищем соединения от Argo CD к Kubernetes компонентам
    const k8sConnections = this.connections.filter(conn => {
      if (conn.source !== this.node!.id) return false;
      
      const targetNode = this.nodes.find(n => n.id === conn.target);
      if (!targetNode) return false;
      
      return targetNode.type === 'kubernetes';
    });
    
    return k8sConnections.length > 0;
  }
  
  /**
   * Резолвит destination server через ServiceDiscovery
   * Возвращает реальный URL Kubernetes кластера или null если не найден
   * Поддерживает multi-cluster: ищет кластер по имени или URL
   */
  private resolveKubernetesServer(serverUrl?: string): string | null {
    if (!this.node) return null;
    
    // Сначала проверяем зарегистрированные кластеры
    if (serverUrl) {
      const cluster = this.getCluster(serverUrl);
      if (cluster && cluster.connectionStatus === 'connected') {
        return cluster.server;
      }
    }
    
    // Если указан serverUrl, пытаемся резолвить его
    if (serverUrl && serverUrl !== 'https://kubernetes.default.svc' && serverUrl !== '*') {
      const k8sNode = this.nodes.find(n => {
        if (n.type !== 'kubernetes') return false;
        
        const host = this.serviceDiscovery.getHost(n);
        const url = this.serviceDiscovery.getURL(n, 'main', 'https');
        
        return serverUrl.includes(host) || 
               serverUrl.includes(n.data.label || '') ||
               url === serverUrl ||
               serverUrl === `https://${host}:6443` ||
               serverUrl === `https://${host}`;
      });
      
      if (k8sNode) {
        const hasConnection = this.connections.some(conn => 
          conn.source === this.node!.id && conn.target === k8sNode.id
        );
        
        if (hasConnection) {
          // Возвращаем реальный URL через ServiceDiscovery
          try {
            return this.serviceDiscovery.getURL(k8sNode, 'main', 'https');
          } catch {
            const host = this.serviceDiscovery.getHost(k8sNode);
            const port = this.serviceDiscovery.getPort(k8sNode, 'main') || 6443;
            return `https://${host}:${port}`;
          }
        }
      }
    }
    
    // Ищем первое доступное соединение с Kubernetes
    const k8sConnection = this.connections.find(conn => {
      if (conn.source !== this.node!.id) return false;
      
      const targetNode = this.nodes.find(n => n.id === conn.target);
      return targetNode?.type === 'kubernetes';
    });
    
    if (k8sConnection) {
      const k8sNode = this.nodes.find(n => n.id === k8sConnection.target);
      if (k8sNode) {
        try {
          return this.serviceDiscovery.getURL(k8sNode, 'main', 'https');
        } catch {
          const host = this.serviceDiscovery.getHost(k8sNode);
          const port = this.serviceDiscovery.getPort(k8sNode, 'main') || 6443;
          return `https://${host}:${port}`;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Запускает синхронизацию приложения
   * Проверяет наличие соединений и sync windows перед запуском
   * @param applicationName Имя application
   * @param currentTime Текущее время (timestamp)
   * @param isManualSync Является ли это manual sync (для обхода deny windows с manualSync=true)
   * @param roleName Опциональная роль пользователя для RBAC проверки
   * @param syncOptions Опции синхронизации (prune, force, dry-run)
   */
  startSync(
    applicationName: string, 
    currentTime: number = Date.now(), 
    isManualSync: boolean = false, 
    roleName?: string,
    syncOptions?: ArgoCDSyncOptions
  ): boolean {
    const app = this.applications.get(applicationName);
    if (!app) return false;
    
    // RBAC проверка
    if (roleName && this.config?.enableRBAC) {
      if (!this.checkPermission(roleName, 'sync', 'applications', applicationName)) {
        return false;
      }
    }
    
    // Check if already syncing
    const existingSync = Array.from(this.syncOperations.values()).find(
      op => op.application === applicationName && op.status === 'running'
    );
    if (existingSync) return false;
    
    // Проверяем соединения перед запуском sync
    const repo = this.repositories.get(app.repository);
    const hasRepoConnection = repo ? repo.connectionStatus === 'successful' : false;
    const hasK8sConnection = this.hasConnectionToKubernetes(app.destination?.server);
    
    // Если нет соединений - sync должен фейлиться
    if (!hasRepoConnection || !hasK8sConnection) {
      return false;
    }
    
    // Для Helm applications проверяем доступность chart и версии
    if (repo?.type === 'helm' && app.helm) {
      const chartName = app.helm.chart || app.path;
      const chartVersion = app.helm.version || app.targetRevision || 'latest';
      
      if (!chartName) {
        return false; // Chart name не указан
      }
      
      // Проверяем доступность chart в repository
      const chart = repo.helmCharts?.find(c => c.name === chartName);
      if (!chart) {
        return false; // Chart не найден в repository
      }
      
      // Проверяем доступность версии (если не latest)
      if (chartVersion !== 'latest' && chartVersion !== '*' && !chart.versions.includes(chartVersion)) {
        return false; // Версия chart недоступна
      }
    }
    
    // Для OCI applications проверяем доступность chart и версии
    if (repo?.type === 'oci' && app.oci) {
      const chartName = app.oci.chart || app.path;
      const chartVersion = app.oci.version || app.targetRevision || 'latest';
      
      if (!chartName) {
        return false; // Chart name не указан
      }
      
      // Проверяем доступность chart в repository
      const chart = repo.ociCharts?.find(c => c.name === chartName);
      if (!chart) {
        return false; // Chart не найден в repository
      }
      
      // Проверяем доступность версии (если не latest)
      if (chartVersion !== 'latest' && chartVersion !== '*' && !chart.versions.includes(chartVersion)) {
        return false; // Версия chart недоступна
      }
    }
    
    // Проверяем sync windows
    if (!this.isSyncAllowed(applicationName, currentTime, isManualSync)) {
      return false; // Sync заблокирован sync window
    }
    
    // Определяем sync options из параметров или из sync policy
    const policyOptions = getSyncPolicyOptions(app.syncPolicy);
    const finalSyncOptions: ArgoCDSyncOptions = {
      prune: syncOptions?.prune ?? policyOptions.prune ?? false,
      force: syncOptions?.force ?? false,
      dryRun: syncOptions?.dryRun ?? false,
    };
    
    const operationId = `sync-${applicationName}-${currentTime}`;
    const operation: ArgoCDSyncOperation = {
      id: operationId,
      application: applicationName,
      startedAt: currentTime,
      status: 'running',
      phase: 'presync', // Начинаем с PreSync hooks
      hooks: [],
      syncOptions: finalSyncOptions,
      prunedResources: 0,
    };
    
    this.syncOperations.set(operationId, operation);
    this.argoMetrics.syncOperationsRunning++;
    this.argoMetrics.syncOperationsTotal++;
    
    app.status = 'progressing';
    app.syncStartedAt = currentTime;
    
    // Отправляем notification о запуске синхронизации
    this.sendNotification('sync-running', {
      application: applicationName,
      operationId,
      isManualSync,
    });
    
    return true;
  }
  
  /**
   * Обновляет метрики
   * Оптимизированная версия - использует один проход по коллекциям вместо нескольких filter()
   */
  private updateMetrics(): void {
    // Applications metrics - один проход вместо нескольких filter()
    let applicationsSynced = 0;
    let applicationsOutOfSync = 0;
    let applicationsProgressing = 0;
    let applicationsDegraded = 0;
    let applicationsHealthy = 0;
    
    for (const app of this.applications.values()) {
      switch (app.status) {
        case 'synced':
          applicationsSynced++;
          break;
        case 'outofsync':
          applicationsOutOfSync++;
          break;
        case 'progressing':
          applicationsProgressing++;
          break;
        case 'degraded':
          applicationsDegraded++;
          break;
      }
      
      if (app.health === 'healthy') {
        applicationsHealthy++;
      }
    }
    
    this.argoMetrics.applicationsTotal = this.applications.size;
    this.argoMetrics.applicationsSynced = applicationsSynced;
    this.argoMetrics.applicationsOutOfSync = applicationsOutOfSync;
    this.argoMetrics.applicationsProgressing = applicationsProgressing;
    this.argoMetrics.applicationsDegraded = applicationsDegraded;
    this.argoMetrics.applicationsHealthy = applicationsHealthy;
    
    // Repositories metrics - один проход вместо нескольких filter()
    let repositoriesConnected = 0;
    let repositoriesFailed = 0;
    
    for (const repo of this.repositories.values()) {
      if (repo.connectionStatus === 'successful') {
        repositoriesConnected++;
      } else if (repo.connectionStatus === 'failed') {
        repositoriesFailed++;
      }
    }
    
    this.argoMetrics.repositoriesTotal = this.repositories.size;
    this.argoMetrics.repositoriesConnected = repositoriesConnected;
    this.argoMetrics.repositoriesFailed = repositoriesFailed;
    
    this.argoMetrics.projectsTotal = this.projects.size;
    
    // Calculate sync rate (syncs per hour) - оптимизировано
    if (this.syncHistory.length > 0) {
      const oneHourAgo = Date.now() - 3600000;
      let recentSyncs = 0;
      let successfulSyncsCount = 0;
      let totalDuration = 0;
      
      // Один проход для sync rate и average duration
      for (const sync of this.syncHistory) {
        if (sync.timestamp >= oneHourAgo) {
          recentSyncs++;
        }
        
        if (sync.status === 'success') {
          successfulSyncsCount++;
          totalDuration += sync.duration;
        }
      }
      
      this.argoMetrics.syncRate = recentSyncs;
      
      // Calculate average sync duration
      if (successfulSyncsCount > 0) {
        this.argoMetrics.averageSyncDuration = totalDuration / successfulSyncsCount;
      }
    }
  }
  
  /**
   * Добавляет sync в историю
   */
  private addSyncToHistory(operation: ArgoCDSyncOperation): void {
    if (!operation.finishedAt || !operation.startedAt) return;
    
    const duration = operation.finishedAt - operation.startedAt;
    const status = operation.status === 'success' ? 'success' : 'failed';
    
    this.syncHistory.push({
      timestamp: operation.finishedAt,
      duration,
      status,
      operationId: operation.id,
      application: operation.application,
    });
    
    if (this.syncHistory.length > this.MAX_SYNC_HISTORY) {
      this.syncHistory.shift();
    }
  }
  
  /**
   * Получает метрики
   */
  getMetrics(): ArgoCDEngineMetrics {
    return { ...this.argoMetrics };
  }
  
  /**
   * Получает все applications
   */
  getApplications(): ArgoCDApplication[] {
    return Array.from(this.applications.values());
  }
  
  /**
   * Получает application по имени
   */
  getApplication(name: string): ArgoCDApplication | undefined {
    return this.applications.get(name);
  }
  
  /**
   * Добавляет application
   * @param app Application для добавления
   * @param roleName Опциональная роль пользователя для RBAC проверки
   * @returns true если операция успешна, false если RBAC запрещает
   */
  addApplication(app: ArgoCDApplication, roleName?: string): boolean {
    // RBAC проверка
    if (roleName && this.config?.enableRBAC) {
      if (!this.checkPermission(roleName, 'create', 'applications', app.name)) {
        return false;
      }
    }
    
    this.applications.set(app.name, app);
    
    // Отправляем notification о создании application
    this.sendNotification('app-created', {
      application: app.name,
      project: app.project,
      repository: app.repository,
    });
    
    return true;
  }
  
  /**
   * Удаляет application
   * @param name Имя application для удаления
   * @param roleName Опциональная роль пользователя для RBAC проверки
   * @returns true если операция успешна, false если RBAC запрещает или application не найден
   */
  removeApplication(name: string, roleName?: string): boolean {
    const app = this.applications.get(name);
    if (!app) return false;
    
    // RBAC проверка
    if (roleName && this.config?.enableRBAC) {
      if (!this.checkPermission(roleName, 'delete', 'applications', name)) {
        return false;
      }
    }
    
    const deleted = this.applications.delete(name);
    
    if (deleted) {
      // Отправляем notification об удалении application
      this.sendNotification('app-deleted', {
        application: name,
        project: app.project,
      });
    }
    
    return deleted;
  }
  
  /**
   * Обновляет application
   * @param name Имя application для обновления
   * @param updates Обновления для application
   * @param roleName Опциональная роль пользователя для RBAC проверки
   * @returns true если операция успешна, false если RBAC запрещает или application не найден
   */
  updateApplication(name: string, updates: Partial<ArgoCDApplication>, roleName?: string): boolean {
    const app = this.applications.get(name);
    if (!app) return false;
    
    // RBAC проверка
    if (roleName && this.config?.enableRBAC) {
      if (!this.checkPermission(roleName, 'update', 'applications', name)) {
        return false;
      }
    }
    
    this.applications.set(name, { ...app, ...updates });
    return true;
  }
  
  /**
   * Получает все repositories
   */
  getRepositories(): ArgoCDRepository[] {
    return Array.from(this.repositories.values());
  }
  
  /**
   * Получает repository по имени
   */
  getRepository(name: string): ArgoCDRepository | undefined {
    return this.repositories.get(name);
  }
  
  /**
   * Добавляет repository
   * @param repo Repository для добавления
   * @param roleName Опциональная роль пользователя для RBAC проверки
   * @returns true если операция успешна, false если RBAC запрещает
   */
  addRepository(repo: ArgoCDRepository, roleName?: string): boolean {
    // RBAC проверка
    if (roleName && this.config?.enableRBAC) {
      if (!this.checkPermission(roleName, 'create', 'repositories', repo.name)) {
        return false;
      }
    }
    
    this.repositories.set(repo.name, repo);
    return true;
  }
  
  /**
   * Удаляет repository
   */
  removeRepository(name: string): boolean {
    return this.repositories.delete(name);
  }
  
  /**
   * Обновляет repository
   * @param name Имя repository для обновления
   * @param updates Обновления для repository
   * @param roleName Опциональная роль пользователя для RBAC проверки
   * @returns true если операция успешна, false если RBAC запрещает или repository не найден
   */
  updateRepository(name: string, updates: Partial<ArgoCDRepository>, roleName?: string): boolean {
    const repo = this.repositories.get(name);
    if (!repo) return false;
    
    // RBAC проверка
    if (roleName && this.config?.enableRBAC) {
      if (!this.checkPermission(roleName, 'update', 'repositories', name)) {
        return false;
      }
    }
    
    this.repositories.set(name, { ...repo, ...updates });
    return true;
  }
  
  /**
   * Получает все projects
   */
  getProjects(): ArgoCDProject[] {
    return Array.from(this.projects.values());
  }
  
  /**
   * Получает project по имени
   */
  getProject(name: string): ArgoCDProject | undefined {
    return this.projects.get(name);
  }
  
  /**
   * Добавляет project
   * @param project Project для добавления
   * @param roleName Опциональная роль пользователя для RBAC проверки
   * @returns true если операция успешна, false если RBAC запрещает
   */
  addProject(project: ArgoCDProject, roleName?: string): boolean {
    // RBAC проверка
    if (roleName && this.config?.enableRBAC) {
      if (!this.checkPermission(roleName, 'create', 'projects', project.name)) {
        return false;
      }
    }
    
    this.projects.set(project.name, project);
    return true;
  }
  
  /**
   * Обновляет project
   * @param name Имя project для обновления
   * @param updates Обновления для project
   * @param roleName Опциональная роль пользователя для RBAC проверки
   * @returns true если операция успешна, false если RBAC запрещает или project не найден
   */
  updateProject(name: string, updates: Partial<ArgoCDProject>, roleName?: string): boolean {
    const project = this.projects.get(name);
    if (!project) return false;
    
    // RBAC проверка
    if (roleName && this.config?.enableRBAC) {
      if (!this.checkPermission(roleName, 'update', 'projects', name)) {
        return false;
      }
    }
    
    this.projects.set(name, { ...project, ...updates });
    return true;
  }
  
  /**
   * Удаляет project
   * @param name Имя project для удаления
   * @param roleName Опциональная роль пользователя для RBAC проверки
   * @returns true если операция успешна, false если RBAC запрещает или project не найден
   */
  removeProject(name: string, roleName?: string): boolean {
    // RBAC проверка
    if (roleName && this.config?.enableRBAC) {
      if (!this.checkPermission(roleName, 'delete', 'projects', name)) {
        return false;
      }
    }
    
    return this.projects.delete(name);
  }
  
  /**
   * Получает все RBAC roles
   */
  getRoles(): ArgoCDRole[] {
    return Array.from(this.roles.values());
  }
  
  /**
   * Получает role по имени
   */
  getRole(name: string): ArgoCDRole | undefined {
    return this.roles.get(name);
  }
  
  /**
   * Добавляет role
   */
  addRole(role: ArgoCDRole): void {
    this.roles.set(role.name, role);
  }
  
  /**
   * Обновляет role
   */
  updateRole(name: string, updates: Partial<ArgoCDRole>): boolean {
    const role = this.roles.get(name);
    if (!role) return false;
    
    this.roles.set(name, { ...role, ...updates });
    return true;
  }
  
  /**
   * Удаляет role
   */
  removeRole(name: string): boolean {
    return this.roles.delete(name);
  }
  
  /**
   * Проверяет permission для действия
   */
  checkPermission(roleName: string, action: string, resource: string, object?: string): boolean {
    if (!this.config?.enableRBAC) {
      return true; // RBAC disabled - allow all
    }
    
    const role = this.roles.get(roleName);
    if (!role) return false;
    
    for (const policy of role.policies) {
      // Check if policy matches
      const resourceMatch = policy.resource === '*' || policy.resource === resource;
      const actionMatch = policy.action === '*' || policy.action === action;
      const objectMatch = !policy.object || !object || this.matchPattern(policy.object, object);
      
      if (resourceMatch && actionMatch && objectMatch) {
        return policy.effect === 'allow';
      }
    }
    
    return false; // Default deny
  }
  
  /**
   * Проверяет соответствие паттерна (wildcard support)
   */
  private matchPattern(pattern: string, value: string): boolean {
    if (pattern === '*') return true;
    if (pattern === value) return true;
    
    // Simple wildcard matching
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(value);
  }
  
  /**
   * Получает все notification channels
   */
  getNotificationChannels(): ArgoCDNotificationChannel[] {
    return Array.from(this.notificationChannels.values());
  }
  
  /**
   * Получает notification channel по имени
   */
  getNotificationChannel(name: string): ArgoCDNotificationChannel | undefined {
    return this.notificationChannels.get(name);
  }
  
  /**
   * Добавляет notification channel
   */
  addNotificationChannel(channel: ArgoCDNotificationChannel): void {
    this.notificationChannels.set(channel.name, channel);
  }
  
  /**
   * Обновляет notification channel
   */
  updateNotificationChannel(name: string, updates: Partial<ArgoCDNotificationChannel>): boolean {
    const channel = this.notificationChannels.get(name);
    if (!channel) return false;
    
    this.notificationChannels.set(name, { ...channel, ...updates });
    return true;
  }
  
  /**
   * Удаляет notification channel
   */
  removeNotificationChannel(name: string): boolean {
    return this.notificationChannels.delete(name);
  }
  
  /**
   * Отправляет notification для события
   */
  sendNotification(event: string, data: Record<string, unknown>): void {
    if (!this.config?.enableNotifications) return;
    
    for (const channel of this.notificationChannels.values()) {
      if (!channel.enabled) continue;
      
      // Check if channel has trigger for this event
      const hasTrigger = channel.triggers.some(trigger => trigger.event === event);
      if (!hasTrigger) continue;
      
      // Simulate sending notification (in real implementation would call external service)
      console.log(`[ArgoCD] Notification sent via ${channel.type} channel "${channel.name}" for event "${event}"`, data);
    }
  }
  
  /**
   * Получает активные sync operations
   */
  getSyncOperations(): ArgoCDSyncOperation[] {
    return Array.from(this.syncOperations.values());
  }
  
  /**
   * Получает историю sync operations (завершенные)
   */
  getSyncHistory(): Array<{ timestamp: number; duration: number; status: 'success' | 'failed'; operationId?: string; application?: string }> {
    return [...this.syncHistory].reverse(); // Новые сначала
  }
  
  /**
   * Получает все sync operations (активные + недавно завершенные)
   * Возвращает активные операции и последние N завершенных из истории
   */
  getAllSyncOperations(limit: number = 50): Array<ArgoCDSyncOperation & { finishedAt: number; duration?: number }> {
    const active = Array.from(this.syncOperations.values());
    const history = this.getSyncHistory().slice(0, limit);
    
    // Создаем объекты операций из истории
    const completed: Array<ArgoCDSyncOperation & { finishedAt: number; duration?: number }> = history.map(h => ({
      id: h.operationId || `sync-${h.timestamp}`,
      application: h.application || 'unknown',
      startedAt: h.timestamp - h.duration,
      finishedAt: h.timestamp,
      status: h.status === 'success' ? 'success' : 'failed',
      phase: 'sync',
      duration: h.duration,
    }));
    
    return [...active, ...completed];
  }
  
  /**
   * Получает все sync windows
   */
  getSyncWindows(): ArgoCDSyncWindow[] {
    return Array.from(this.syncWindows.values());
  }
  
  /**
   * Получает sync window по имени
   */
  getSyncWindow(name: string): ArgoCDSyncWindow | undefined {
    return this.syncWindows.get(name);
  }
  
  /**
   * Добавляет sync window
   */
  addSyncWindow(syncWindow: ArgoCDSyncWindow): void {
    this.syncWindows.set(syncWindow.name, syncWindow);
  }
  
  /**
   * Обновляет sync window
   */
  updateSyncWindow(name: string, updates: Partial<ArgoCDSyncWindow>): boolean {
    const syncWindow = this.syncWindows.get(name);
    if (!syncWindow) return false;
    
    this.syncWindows.set(name, { ...syncWindow, ...updates });
    return true;
  }
  
  /**
   * Удаляет sync window
   */
  removeSyncWindow(name: string): boolean {
    return this.syncWindows.delete(name);
  }
  
  /**
   * Добавляет hook к application
   */
  addHookToApplication(applicationName: string, hook: ArgoCDSyncHook): boolean {
    const app = this.applications.get(applicationName);
    if (!app) return false;
    
    if (!app.hooks) {
      app.hooks = [];
    }
    
    // Проверяем на дубликаты
    if (app.hooks.some(h => h.name === hook.name && h.phase === hook.phase)) {
      return false;
    }
    
    app.hooks.push({
      ...hook,
      status: 'pending',
    });
    
    return true;
  }
  
  /**
   * Удаляет hook из application
   */
  removeHookFromApplication(applicationName: string, hookName: string, phase: SyncHookPhase): boolean {
    const app = this.applications.get(applicationName);
    if (!app || !app.hooks) return false;
    
    const index = app.hooks.findIndex(h => h.name === hookName && h.phase === phase);
    if (index === -1) return false;
    
    app.hooks.splice(index, 1);
    return true;
  }
  
  /**
   * Обновляет hook в application
   */
  updateHookInApplication(
    applicationName: string,
    hookName: string,
    phase: SyncHookPhase,
    updates: Partial<ArgoCDSyncHook>
  ): boolean {
    const app = this.applications.get(applicationName);
    if (!app || !app.hooks) return false;
    
    const hook = app.hooks.find(h => h.name === hookName && h.phase === phase);
    if (!hook) return false;
    
    Object.assign(hook, updates);
    return true;
  }
  
  /**
   * Получает hooks для application
   */
  getApplicationHooks(applicationName: string): ArgoCDSyncHook[] {
    const app = this.applications.get(applicationName);
    return app?.hooks || [];
  }
  
  /**
   * Генерирует примерные Helm charts для Helm repository
   * Используется когда charts не указаны в конфиге
   */
  private generateSampleHelmCharts(repoUrl: string): ArgoCDHelmChart[] {
    // Генерируем примерные charts на основе URL репозитория
    const commonCharts = [
      { name: 'nginx', versions: ['1.0.0', '1.1.0', '1.2.0'], description: 'NGINX Ingress Controller' },
      { name: 'redis', versions: ['6.0.0', '6.2.0', '7.0.0'], description: 'Redis cache' },
      { name: 'postgresql', versions: ['11.0.0', '12.0.0', '13.0.0'], description: 'PostgreSQL database' },
      { name: 'mongodb', versions: ['4.0.0', '4.4.0', '5.0.0'], description: 'MongoDB database' },
      { name: 'elasticsearch', versions: ['7.0.0', '7.10.0', '8.0.0'], description: 'Elasticsearch search engine' },
    ];
    
    // Возвращаем 3-5 случайных charts
    const count = 3 + Math.floor(Math.random() * 3);
    const shuffled = [...commonCharts].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
  
  /**
   * Обновляет список Helm charts для Helm repository
   * Симулирует обновление индекса Helm repository
   */
  updateHelmRepositoryCharts(repositoryName: string): boolean {
    const repo = this.repositories.get(repositoryName);
    if (!repo || repo.type !== 'helm') {
      return false;
    }
    
    // Проверяем соединение с Helm repository
    if (!this.hasConnectionToHelmRepository(repo)) {
      repo.connectionStatus = 'failed';
      repo.lastConnectionError = 'No connection to Helm repository';
      return false;
    }
    
    // Если charts не указаны - генерируем примерные
    if (!repo.helmCharts || repo.helmCharts.length === 0) {
      repo.helmCharts = this.generateSampleHelmCharts(repo.url);
    } else {
      // Симулируем обновление: добавляем новые версии к существующим charts
      for (const chart of repo.helmCharts) {
        const latestVersion = chart.versions[chart.versions.length - 1] || '1.0.0';
        const versionParts = latestVersion.split('.');
        const major = parseInt(versionParts[0]) || 1;
        const minor = parseInt(versionParts[1]) || 0;
        const patch = parseInt(versionParts[2]) || 0;
        
        // Случайно добавляем новую версию (10% chance)
        if (Math.random() < 0.1) {
          const newVersion = `${major}.${minor}.${patch + 1}`;
          if (!chart.versions.includes(newVersion)) {
            chart.versions.push(newVersion);
            chart.versions.sort((a, b) => {
              const aParts = a.split('.').map(Number);
              const bParts = b.split('.').map(Number);
              for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                const aVal = aParts[i] || 0;
                const bVal = bParts[i] || 0;
                if (aVal !== bVal) return bVal - aVal;
              }
              return 0;
            });
          }
        }
      }
    }
    
    repo.chartsLastUpdated = Date.now();
    repo.connectionStatus = 'successful';
    repo.lastConnectionError = undefined;
    return true;
  }
  
  /**
   * Проверяет наличие соединения с Helm repository
   */
  private hasConnectionToHelmRepository(repo: ArgoCDRepository): boolean {
    if (!this.node || !this.nodes.length || !this.connections.length) {
      return false;
    }
    
    // Проверяем соединения с Helm registry компонентами (harbor, docker registry, etc.)
    // Helm repositories обычно доступны через HTTP/HTTPS, но могут быть через registry компоненты
    const helmRegistryTypes = ['harbor', 'docker-registry'];
    
    for (const connection of this.connections) {
      const sourceNode = this.nodes.find(n => n.id === connection.source);
      const targetNode = this.nodes.find(n => n.id === connection.target);
      
      if (!sourceNode || !targetNode) continue;
      
      // Проверяем соединение от Argo CD к Helm registry
      if (sourceNode.id === this.node.id && helmRegistryTypes.includes(targetNode.type)) {
        // Проверяем что URL репозитория соответствует registry
        const registryUrl = targetNode.data?.config?.registryUrl || targetNode.data?.config?.url || '';
        if (repo.url.includes(registryUrl) || registryUrl.includes(repo.url)) {
          return true;
        }
      }
    }
    
    // Если нет явного соединения - считаем что Helm repository доступен через HTTP/HTTPS
    // (в реальности Helm repositories обычно доступны через HTTP без необходимости соединения)
    return repo.url.startsWith('http://') || repo.url.startsWith('https://');
  }
  
  /**
   * Получает Helm charts для repository
   */
  getHelmCharts(repositoryName: string): ArgoCDHelmChart[] {
    const repo = this.repositories.get(repositoryName);
    if (!repo || repo.type !== 'helm') {
      return [];
    }
    return repo.helmCharts || [];
  }
  
  /**
   * Получает версии Helm chart
   */
  getHelmChartVersions(repositoryName: string, chartName: string): string[] {
    const repo = this.repositories.get(repositoryName);
    if (!repo || repo.type !== 'helm' || !repo.helmCharts) {
      return [];
    }
    
    const chart = repo.helmCharts.find(c => c.name === chartName);
    return chart?.versions || [];
  }
  
  /**
   * Проверяет доступность Helm chart версии
   */
  isHelmChartVersionAvailable(repositoryName: string, chartName: string, version: string): boolean {
    const versions = this.getHelmChartVersions(repositoryName, chartName);
    if (version === 'latest' || version === '*') {
      return versions.length > 0;
    }
    return versions.includes(version);
  }
  
  /**
   * Генерирует примерные OCI charts для OCI repository
   * Используется когда charts не указаны в конфиге
   */
  private generateSampleOciCharts(repoUrl: string): ArgoCDOciChart[] {
    // Парсим registry из URL (например, oci://registry-1.docker.io/bitnamicharts/nginx -> registry-1.docker.io)
    let registry = 'registry-1.docker.io';
    if (repoUrl.startsWith('oci://')) {
      const urlWithoutScheme = repoUrl.replace('oci://', '');
      const parts = urlWithoutScheme.split('/');
      if (parts.length > 0) {
        registry = parts[0];
      }
    } else if (repoUrl.includes('.')) {
      const parts = repoUrl.split('/');
      if (parts.length > 0 && parts[0].includes('.')) {
        registry = parts[0];
      }
    }
    
    // Генерируем примерные OCI charts
    const commonOciCharts = [
      { name: 'bitnamicharts/nginx', versions: ['15.9.0', '16.0.0', '16.1.0'], description: 'NGINX Ingress Controller' },
      { name: 'bitnamicharts/redis', versions: ['18.0.0', '18.1.0', '19.0.0'], description: 'Redis cache' },
      { name: 'bitnamicharts/postgresql', versions: ['14.0.0', '14.1.0', '15.0.0'], description: 'PostgreSQL database' },
      { name: 'bitnamicharts/mongodb', versions: ['13.0.0', '13.1.0', '14.0.0'], description: 'MongoDB database' },
      { name: 'bitnamicharts/elasticsearch', versions: ['20.0.0', '20.1.0', '21.0.0'], description: 'Elasticsearch search engine' },
    ];
    
    // Возвращаем 3-5 случайных charts с правильным registry
    const count = 3 + Math.floor(Math.random() * 3);
    const shuffled = [...commonOciCharts].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(chart => ({
      ...chart,
      registry,
    }));
  }
  
  /**
   * Обновляет список OCI charts для OCI repository
   * Симулирует обновление индекса OCI registry
   */
  updateOciRepositoryCharts(repositoryName: string): boolean {
    const repo = this.repositories.get(repositoryName);
    if (!repo || repo.type !== 'oci') {
      return false;
    }
    
    // Проверяем соединение с OCI registry
    if (!this.hasConnectionToOciRepository(repo)) {
      repo.connectionStatus = 'failed';
      repo.lastConnectionError = 'No connection to OCI registry';
      return false;
    }
    
    // Если charts не указаны - генерируем примерные
    if (!repo.ociCharts || repo.ociCharts.length === 0) {
      repo.ociCharts = this.generateSampleOciCharts(repo.url);
    } else {
      // Симулируем обновление: добавляем новые версии к существующим charts
      for (const chart of repo.ociCharts) {
        const latestVersion = chart.versions[chart.versions.length - 1] || '1.0.0';
        const versionParts = latestVersion.split('.');
        const major = parseInt(versionParts[0]) || 1;
        const minor = parseInt(versionParts[1]) || 0;
        const patch = parseInt(versionParts[2]) || 0;
        
        // Случайно добавляем новую версию (10% chance)
        if (Math.random() < 0.1) {
          const newVersion = `${major}.${minor}.${patch + 1}`;
          if (!chart.versions.includes(newVersion)) {
            chart.versions.push(newVersion);
            chart.versions.sort((a, b) => {
              const aParts = a.split('.').map(Number);
              const bParts = b.split('.').map(Number);
              for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                const aVal = aParts[i] || 0;
                const bVal = bParts[i] || 0;
                if (aVal !== bVal) return bVal - aVal;
              }
              return 0;
            });
          }
        }
      }
    }
    
    repo.ociChartsLastUpdated = Date.now();
    repo.connectionStatus = 'successful';
    repo.lastConnectionError = undefined;
    return true;
  }
  
  /**
   * Проверяет наличие соединения с OCI registry
   */
  private hasConnectionToOciRepository(repo: ArgoCDRepository): boolean {
    if (!this.node || !this.nodes.length || !this.connections.length) {
      return false;
    }
    
    // Проверяем соединения с OCI registry компонентами (docker-registry, harbor, etc.)
    const ociRegistryTypes = ['docker-registry', 'harbor'];
    
    for (const connection of this.connections) {
      const sourceNode = this.nodes.find(n => n.id === connection.source);
      const targetNode = this.nodes.find(n => n.id === connection.target);
      
      if (!sourceNode || !targetNode) continue;
      
      // Проверяем соединение от Argo CD к OCI registry
      if (sourceNode.id === this.node.id && ociRegistryTypes.includes(targetNode.type)) {
        // Проверяем что URL репозитория соответствует registry
        const registryUrl = targetNode.data?.config?.registryUrl || targetNode.data?.config?.url || '';
        const repoUrl = repo.url.replace('oci://', '');
        
        // Проверяем соответствие registry
        if (repoUrl.includes(registryUrl) || registryUrl.includes(repoUrl.split('/')[0])) {
          return true;
        }
      }
    }
    
    // Если нет явного соединения - проверяем что URL начинается с oci:// или содержит известные registry
    const knownRegistries = ['docker.io', 'gcr.io', 'ghcr.io', 'ecr.', 'azurecr.io', 'quay.io'];
    const repoUrlLower = repo.url.toLowerCase();
    return repoUrlLower.startsWith('oci://') || knownRegistries.some(reg => repoUrlLower.includes(reg));
  }
  
  /**
   * Получает OCI charts для repository
   */
  getOciCharts(repositoryName: string): ArgoCDOciChart[] {
    const repo = this.repositories.get(repositoryName);
    if (!repo || repo.type !== 'oci') {
      return [];
    }
    return repo.ociCharts || [];
  }
  
  /**
   * Получает версии OCI chart
   */
  getOciChartVersions(repositoryName: string, chartName: string): string[] {
    const repo = this.repositories.get(repositoryName);
    if (!repo || repo.type !== 'oci' || !repo.ociCharts) {
      return [];
    }
    
    const chart = repo.ociCharts.find(c => c.name === chartName);
    return chart?.versions || [];
  }
  
  /**
   * Проверяет доступность OCI chart версии
   */
  isOciChartVersionAvailable(repositoryName: string, chartName: string, version: string): boolean {
    const versions = this.getOciChartVersions(repositoryName, chartName);
    if (version === 'latest' || version === '*') {
      return versions.length > 0;
    }
    return versions.includes(version);
  }
  
  /**
   * Получает все ApplicationSets
   */
  getApplicationSets(): ArgoCDApplicationSet[] {
    return Array.from(this.applicationSets.values());
  }
  
  /**
   * Получает ApplicationSet по имени
   */
  getApplicationSet(name: string): ArgoCDApplicationSet | undefined {
    return this.applicationSets.get(name);
  }
  
  /**
   * Добавляет ApplicationSet
   */
  addApplicationSet(appSet: ArgoCDApplicationSet): void {
    this.applicationSets.set(appSet.name, appSet);
    if (appSet.enabled) {
      this.generateApplicationsFromSet(appSet);
    }
  }
  
  /**
   * Обновляет ApplicationSet
   */
  updateApplicationSet(name: string, updates: Partial<ArgoCDApplicationSet>): boolean {
    const appSet = this.applicationSets.get(name);
    if (!appSet) return false;
    
    const updated = { ...appSet, ...updates };
    this.applicationSets.set(name, updated);
    
    // Если ApplicationSet был включен или обновлен - регенерируем applications
    if (updated.enabled) {
      // Удаляем старые сгенерированные applications
      if (appSet.generatedApplications) {
        for (const appName of appSet.generatedApplications) {
          this.applications.delete(appName);
        }
      }
      // Генерируем новые
      this.generateApplicationsFromSet(updated);
    }
    
    return true;
  }
  
  /**
   * Удаляет ApplicationSet
   */
  removeApplicationSet(name: string): boolean {
    const appSet = this.applicationSets.get(name);
    if (!appSet) return false;
    
    // Удаляем сгенерированные applications
    if (appSet.generatedApplications) {
      for (const appName of appSet.generatedApplications) {
        this.applications.delete(appName);
      }
    }
    
    return this.applicationSets.delete(name);
  }
  
  /**
   * Регенерирует Applications из всех ApplicationSets
   */
  regenerateApplicationSets(): void {
    for (const appSet of this.applicationSets.values()) {
      if (appSet.enabled) {
        // Удаляем старые
        if (appSet.generatedApplications) {
          for (const appName of appSet.generatedApplications) {
            this.applications.delete(appName);
          }
        }
        // Генерируем новые
        this.generateApplicationsFromSet(appSet);
      }
    }
  }
  
  /**
   * Получает статистику
   */
  getStats(): {
    metrics: ArgoCDEngineMetrics;
    applications: ArgoCDApplication[];
    repositories: ArgoCDRepository[];
    projects: ArgoCDProject[];
    activeSyncs: ArgoCDSyncOperation[];
  } {
    return {
      metrics: this.getMetrics(),
      applications: this.getApplications(),
      repositories: this.getRepositories(),
      projects: this.getProjects(),
      activeSyncs: this.getSyncOperations(),
    };
  }
}


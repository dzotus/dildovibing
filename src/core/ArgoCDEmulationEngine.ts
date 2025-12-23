import { CanvasNode } from '@/types';
import { ComponentMetrics } from './EmulationEngine';

/**
 * Argo CD Application Sync Status
 */
export type ApplicationSyncStatus = 'synced' | 'outofsync' | 'progressing' | 'degraded' | 'suspended' | 'unknown';

/**
 * Argo CD Application Health Status
 */
export type ApplicationHealthStatus = 'healthy' | 'degraded' | 'progressing' | 'suspended' | 'missing' | 'unknown';

/**
 * Argo CD Sync Policy
 */
export type SyncPolicy = 'automated' | 'manual' | 'sync-window';

/**
 * Argo CD Application
 */
export interface ArgoCDApplication {
  name: string;
  namespace?: string;
  project?: string;
  repository: string; // Repository name/URL
  path?: string; // Path in repository
  targetRevision?: string; // Branch/tag/commit
  destination?: {
    server?: string; // Kubernetes server URL
    namespace?: string; // Target namespace
  };
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
 * Argo CD Sync Operation
 */
export interface ArgoCDSyncOperation {
  id: string;
  application: string;
  startedAt: number;
  finishedAt?: number;
  status: 'running' | 'success' | 'failed' | 'error';
  phase: 'sync' | 'hook' | 'rollback';
  resources?: Array<{
    kind: string;
    name: string;
    namespace?: string;
    status: 'synced' | 'failed' | 'skipped';
    message?: string;
  }>;
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
    syncPolicy?: SyncPolicy;
    status?: ApplicationSyncStatus;
    health?: ApplicationHealthStatus;
  }>;
  repositories?: Array<{
    name: string;
    url: string;
    type?: 'git' | 'helm' | 'oci';
    username?: string;
    password?: string;
    insecure?: boolean;
    project?: string;
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
  syncRate?: number; // syncs per hour per application
  averageSyncDuration?: number; // milliseconds
  failureRate?: number; // 0-1
  healthCheckInterval?: number; // milliseconds
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
 * Argo CD Emulation Engine
 * Симулирует работу Argo CD: applications, repositories, projects, sync operations, health checks
 */
export class ArgoCDEmulationEngine {
  private config: ArgoCDEmulationConfig | null = null;
  
  // Applications
  private applications: Map<string, ArgoCDApplication> = new Map();
  
  // Repositories
  private repositories: Map<string, ArgoCDRepository> = new Map();
  
  // Projects
  private projects: Map<string, ArgoCDProject> = new Map();
  
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
  private syncHistory: Array<{ timestamp: number; duration: number; status: 'success' | 'failed' }> = [];
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
  initializeConfig(node: CanvasNode): void {
    const config = node.data.config || {};
    
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
  }
  
  /**
   * Инициализирует applications из конфига
   */
  private initializeApplications(): void {
    this.applications.clear();
    
    const configApplications = this.config?.applications || [];
    
    // Default applications if none configured
    if (configApplications.length === 0) {
      const defaultApp: ArgoCDApplication = {
        name: 'web-app',
        namespace: 'production',
        project: 'default',
        repository: 'https://github.com/example/web-app',
        path: 'k8s',
        targetRevision: 'main',
        destination: {
          server: 'https://kubernetes.default.svc',
          namespace: 'production',
        },
        syncPolicy: this.config?.syncPolicy || 'manual',
        status: 'synced',
        health: 'healthy',
        lastSync: Date.now() - 120000, // 2 minutes ago
        revision: 'abc123',
        sourceRevision: 'abc123',
      };
      this.applications.set(defaultApp.name, defaultApp);
      return;
    }
    
    for (const appConfig of configApplications) {
      const app: ArgoCDApplication = {
        name: appConfig.name,
        namespace: appConfig.namespace,
        project: appConfig.project || 'default',
        repository: appConfig.repository,
        path: appConfig.path || '.',
        targetRevision: appConfig.targetRevision || 'main',
        destination: appConfig.destination || {
          server: 'https://kubernetes.default.svc',
          namespace: appConfig.namespace || 'default',
        },
        syncPolicy: appConfig.syncPolicy || this.config?.syncPolicy || 'manual',
        status: appConfig.status || 'synced',
        health: appConfig.health || 'healthy',
        lastSync: Date.now() - Math.random() * 3600000, // Random time in last hour
        revision: this.generateRevision(),
        sourceRevision: this.generateRevision(),
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
      };
      
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
   */
  private initializeProjects(): void {
    this.projects.clear();
    
    const configProjects = this.config?.projects || [];
    
    // Default project
    if (configProjects.length === 0) {
      const defaultProject: ArgoCDProject = {
        name: 'default',
        description: 'Default project',
        sourceRepos: ['*'],
        destinations: [{ server: '*', namespace: '*' }],
      };
      this.projects.set('default', defaultProject);
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
    if (this.config.autoSync || this.config.syncPolicy === 'automated') {
      this.triggerAutoSyncs(currentTime);
    }
    
    // Perform health checks
    if (this.config.enableHealthChecks) {
      this.performHealthChecks(currentTime);
    }
    
    // Check repository connections
    this.checkRepositoryConnections(currentTime);
    
    // Update metrics
    this.updateMetrics();
  }
  
  /**
   * Обновляет активные sync operations
   */
  private updateSyncOperations(currentTime: number): void {
    const operationsToProcess = Array.from(this.syncOperations.entries());
    
    for (const [operationId, operation] of operationsToProcess) {
      if (operation.status !== 'running') continue;
      
      if (!operation.startedAt) {
        operation.startedAt = currentTime;
        continue;
      }
      
      const elapsed = currentTime - operation.startedAt;
      const estimatedDuration = this.config?.averageSyncDuration || 30000;
      
      if (elapsed >= estimatedDuration) {
        // Determine success/failure based on failure rate
        const shouldFail = Math.random() < (this.config?.failureRate || 0.05);
        operation.status = shouldFail ? 'failed' : 'success';
        operation.finishedAt = currentTime;
        
        if (shouldFail) {
          operation.error = 'Sync failed: resource conflict or validation error';
        }
        
        // Update application status
        const app = this.applications.get(operation.application);
        if (app) {
          if (operation.status === 'success') {
            app.status = 'synced';
            app.health = 'healthy';
            app.lastSync = currentTime;
            app.lastSyncDuration = elapsed;
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
          } else {
            app.status = 'degraded';
            app.health = 'degraded';
          }
        }
        
        // Add to history
        this.addSyncToHistory(operation);
        
        // Update metrics
        if (operation.status === 'success') {
          this.argoMetrics.syncOperationsSuccess++;
        } else {
          this.argoMetrics.syncOperationsFailed++;
        }
        this.argoMetrics.syncOperationsRunning--;
        
        // Remove from active operations
        this.syncOperations.delete(operationId);
      }
    }
  }
  
  /**
   * Триггерит автоматические синхронизации
   */
  private triggerAutoSyncs(currentTime: number): void {
    const syncRate = this.config?.syncRate || 1; // syncs per hour
    const syncInterval = 3600000 / syncRate; // milliseconds between syncs
    
    for (const app of this.applications.values()) {
      if (app.syncPolicy !== 'automated' && app.syncPolicy !== 'auto') continue;
      
      const lastSync = this.lastSyncTime.get(app.name) || app.lastSync || 0;
      const timeSinceLastSync = currentTime - lastSync;
      
      if (timeSinceLastSync >= syncInterval) {
        // Check if app is out of sync or needs refresh
        if (app.status === 'outofsync' || app.status === 'synced') {
          this.startSync(app.name, currentTime);
          this.lastSyncTime.set(app.name, currentTime);
        }
      }
    }
  }
  
  /**
   * Выполняет health checks для приложений
   */
  private performHealthChecks(currentTime: number): void {
    const healthCheckInterval = this.config?.healthCheckInterval || 300000; // 5 minutes
    
    for (const app of this.applications.values()) {
      const lastCheck = this.lastHealthCheck.get(app.name) || 0;
      const timeSinceLastCheck = currentTime - lastCheck;
      
      if (timeSinceLastCheck >= healthCheckInterval) {
        // Simulate health check
        // Randomly change health status (5% chance of degraded)
        if (Math.random() < 0.05 && app.health === 'healthy') {
          app.health = 'degraded';
          app.status = 'degraded';
        } else if (app.health === 'degraded' && Math.random() < 0.3) {
          // 30% chance to recover
          app.health = 'healthy';
          if (app.status === 'degraded') {
            app.status = 'synced';
          }
        }
        
        this.lastHealthCheck.set(app.name, currentTime);
      }
    }
  }
  
  /**
   * Проверяет соединения с репозиториями
   */
  private checkRepositoryConnections(currentTime: number): void {
    const checkInterval = 600000; // 10 minutes
    
    for (const repo of this.repositories.values()) {
      const lastCheck = repo.lastVerifiedAt || 0;
      const timeSinceLastCheck = currentTime - lastCheck;
      
      if (timeSinceLastCheck >= checkInterval) {
        // Simulate connection check (95% success rate)
        if (Math.random() < 0.95) {
          repo.connectionStatus = 'successful';
          repo.lastVerifiedAt = currentTime;
          repo.lastConnectionError = undefined;
        } else {
          repo.connectionStatus = 'failed';
          repo.lastConnectionError = 'Connection timeout or authentication failed';
          repo.lastVerifiedAt = currentTime;
        }
      }
    }
  }
  
  /**
   * Запускает синхронизацию приложения
   */
  startSync(applicationName: string, currentTime: number = Date.now()): boolean {
    const app = this.applications.get(applicationName);
    if (!app) return false;
    
    // Check if already syncing
    const existingSync = Array.from(this.syncOperations.values()).find(
      op => op.application === applicationName && op.status === 'running'
    );
    if (existingSync) return false;
    
    const operationId = `sync-${applicationName}-${currentTime}`;
    const operation: ArgoCDSyncOperation = {
      id: operationId,
      application: applicationName,
      startedAt: currentTime,
      status: 'running',
      phase: 'sync',
    };
    
    this.syncOperations.set(operationId, operation);
    this.argoMetrics.syncOperationsRunning++;
    this.argoMetrics.syncOperationsTotal++;
    
    app.status = 'progressing';
    app.syncStartedAt = currentTime;
    
    return true;
  }
  
  /**
   * Обновляет метрики
   */
  private updateMetrics(): void {
    this.argoMetrics.applicationsTotal = this.applications.size;
    this.argoMetrics.applicationsSynced = Array.from(this.applications.values()).filter(
      a => a.status === 'synced'
    ).length;
    this.argoMetrics.applicationsOutOfSync = Array.from(this.applications.values()).filter(
      a => a.status === 'outofsync'
    ).length;
    this.argoMetrics.applicationsProgressing = Array.from(this.applications.values()).filter(
      a => a.status === 'progressing'
    ).length;
    this.argoMetrics.applicationsDegraded = Array.from(this.applications.values()).filter(
      a => a.status === 'degraded'
    ).length;
    this.argoMetrics.applicationsHealthy = Array.from(this.applications.values()).filter(
      a => a.health === 'healthy'
    ).length;
    
    this.argoMetrics.repositoriesTotal = this.repositories.size;
    this.argoMetrics.repositoriesConnected = Array.from(this.repositories.values()).filter(
      r => r.connectionStatus === 'successful'
    ).length;
    this.argoMetrics.repositoriesFailed = Array.from(this.repositories.values()).filter(
      r => r.connectionStatus === 'failed'
    ).length;
    
    this.argoMetrics.projectsTotal = this.projects.size;
    
    // Calculate sync rate (syncs per hour)
    if (this.syncHistory.length > 0) {
      const oneHourAgo = Date.now() - 3600000;
      const recentSyncs = this.syncHistory.filter(s => s.timestamp >= oneHourAgo).length;
      this.argoMetrics.syncRate = recentSyncs;
      
      // Calculate average sync duration
      const successfulSyncs = this.syncHistory.filter(s => s.status === 'success');
      if (successfulSyncs.length > 0) {
        const totalDuration = successfulSyncs.reduce((sum, s) => sum + s.duration, 0);
        this.argoMetrics.averageSyncDuration = totalDuration / successfulSyncs.length;
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
   */
  addApplication(app: ArgoCDApplication): void {
    this.applications.set(app.name, app);
  }
  
  /**
   * Удаляет application
   */
  removeApplication(name: string): boolean {
    return this.applications.delete(name);
  }
  
  /**
   * Обновляет application
   */
  updateApplication(name: string, updates: Partial<ArgoCDApplication>): boolean {
    const app = this.applications.get(name);
    if (!app) return false;
    
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
   */
  addRepository(repo: ArgoCDRepository): void {
    this.repositories.set(repo.name, repo);
  }
  
  /**
   * Удаляет repository
   */
  removeRepository(name: string): boolean {
    return this.repositories.delete(name);
  }
  
  /**
   * Обновляет repository
   */
  updateRepository(name: string, updates: Partial<ArgoCDRepository>): boolean {
    const repo = this.repositories.get(name);
    if (!repo) return false;
    
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
   */
  addProject(project: ArgoCDProject): void {
    this.projects.set(project.name, project);
  }
  
  /**
   * Обновляет project
   */
  updateProject(name: string, updates: Partial<ArgoCDProject>): boolean {
    const project = this.projects.get(name);
    if (!project) return false;
    
    this.projects.set(name, { ...project, ...updates });
    return true;
  }
  
  /**
   * Удаляет project
   */
  removeProject(name: string): boolean {
    return this.projects.delete(name);
  }
  
  /**
   * Получает активные sync operations
   */
  getSyncOperations(): ArgoCDSyncOperation[] {
    return Array.from(this.syncOperations.values());
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


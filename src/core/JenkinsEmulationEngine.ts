import { CanvasNode } from '@/types';
import { ComponentMetrics } from './EmulationEngine';

/**
 * Jenkins Build Status
 */
export type BuildStatus = 'success' | 'running' | 'failed' | 'pending' | 'aborted' | 'unstable';

/**
 * Jenkins Build
 */
export interface JenkinsBuild {
  id: string;
  number: number;
  pipelineId: string;
  status: BuildStatus;
  startTime: number;
  duration?: number;
  estimatedDuration?: number;
  progress?: number; // 0-100
  stages?: BuildStage[];
  logs?: string[];
  artifacts?: string[];
  triggeredBy?: string;
  branch?: string;
  commit?: string;
}

/**
 * Build Stage
 */
export interface BuildStage {
  name: string;
  status: BuildStatus;
  duration?: number;
  startTime?: number;
}

/**
 * Jenkins Pipeline
 */
export interface JenkinsPipeline {
  id: string;
  name: string;
  status: BuildStatus;
  lastBuild: number;
  lastSuccessfulBuild?: number;
  lastFailedBuild?: number;
  duration?: number;
  branch?: string;
  enabled: boolean;
  builds: JenkinsBuild[];
  nextBuildNumber: number;
}

/**
 * Jenkins Node/Agent
 */
export interface JenkinsNode {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'temporarily-offline';
  numExecutors: number;
  busyExecutors: number;
  idleExecutors: number;
  labels: string[];
  description?: string;
}

/**
 * Jenkins Plugin
 */
export interface JenkinsPlugin {
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  active: boolean; // active = enabled && dependencies satisfied
  dependencies?: string[];
}

/**
 * Build Trigger Configuration
 */
export interface BuildTrigger {
  type: 'webhook' | 'cron' | 'scm' | 'manual';
  enabled: boolean;
  config?: {
    // Webhook trigger
    branches?: string[];
    events?: string[];
    // Cron trigger
    schedule?: string; // Cron expression
    // SCM polling
    pollInterval?: number; // minutes
  };
}

/**
 * Build Parameter
 */
export interface BuildParameter {
  name: string;
  type: 'string' | 'choice' | 'boolean' | 'password';
  defaultValue?: string | boolean;
  description?: string;
  choices?: string[]; // For choice type
}

/**
 * Post-Build Action
 */
export interface PostBuildAction {
  type: 'email' | 'archive' | 'publish' | 'deploy';
  enabled: boolean;
  config?: {
    recipients?: string[];
    archivePattern?: string;
    publishTarget?: string;
    deployEnv?: string;
  };
}

/**
 * Jenkins Configuration
 */
export interface JenkinsEmulationConfig {
  jenkinsUrl?: string;
  enableCSRF?: boolean;
  executorCount?: number;
  enablePlugins?: boolean;
  plugins?: string[];
  enablePipeline?: boolean;
  enableBlueOcean?: boolean;
  enableArtifactArchiving?: boolean;
  retentionDays?: number;
  pipelines?: Array<{
    id: string;
    name: string;
    status?: BuildStatus;
    lastBuild?: number;
    duration?: number;
    branch?: string;
    enabled?: boolean;
    triggers?: BuildTrigger[];
    parameters?: BuildParameter[];
    environmentVariables?: Record<string, string>;
    postBuildActions?: PostBuildAction[];
  }>;
  nodes?: Array<{
    id: string;
    name: string;
    numExecutors?: number;
    labels?: string[];
  }>;
  buildTriggerRate?: number; // builds per minute
  averageBuildDuration?: number; // milliseconds
  failureRate?: number; // 0-1
}

/**
 * Jenkins Engine Metrics
 */
export interface JenkinsEngineMetrics {
  buildsTotal: number;
  buildsSuccess: number;
  buildsFailed: number;
  buildsRunning: number;
  buildsPending: number;
  buildsPerMinute: number;
  averageBuildDuration: number;
  executorUtilization: number;
  executorIdle: number;
  executorBusy: number;
  pipelinesTotal: number;
  pipelinesEnabled: number;
  nodesTotal: number;
  nodesOnline: number;
  pluginsTotal: number;
  pluginsActive: number;
  artifactStorageBytes: number;
  requestsTotal: number;
  requestsErrors: number;
}

/**
 * Jenkins Emulation Engine
 * Симулирует работу Jenkins: pipelines, builds, executors, метрики
 */
export class JenkinsEmulationEngine {
  private config: JenkinsEmulationConfig | null = null;
  
  // Pipelines
  private pipelines: Map<string, JenkinsPipeline> = new Map();
  
  // Active builds
  private activeBuilds: Map<string, JenkinsBuild> = new Map();
  
  // Nodes/Agents
  private nodes: Map<string, JenkinsNode> = new Map();
  
  // Plugins
  private plugins: Map<string, JenkinsPlugin> = new Map();
  
  // Metrics
  private jenkinsMetrics: JenkinsEngineMetrics = {
    buildsTotal: 0,
    buildsSuccess: 0,
    buildsFailed: 0,
    buildsRunning: 0,
    buildsPending: 0,
    buildsPerMinute: 0,
    averageBuildDuration: 0,
    executorUtilization: 0,
    executorIdle: 0,
    executorBusy: 0,
    pipelinesTotal: 0,
    pipelinesEnabled: 0,
    nodesTotal: 0,
    nodesOnline: 0,
    pluginsTotal: 0,
    pluginsActive: 0,
    artifactStorageBytes: 0,
    requestsTotal: 0,
    requestsErrors: 0,
  };
  
  /**
   * Обрабатывает входящий запрос (webhook, API)
   */
  processRequest(success: boolean = true): void {
    this.jenkinsMetrics.requestsTotal++;
    if (!success) {
      this.jenkinsMetrics.requestsErrors++;
    }
  }
  
  // Build history for metrics
  private buildHistory: Array<{ timestamp: number; duration: number; status: BuildStatus }> = [];
  private readonly MAX_BUILD_HISTORY = 1000;
  
  // Build trigger timing
  private lastBuildTrigger: Map<string, number> = new Map();
  private buildTriggerCounter: number = 0;
  
  // Artifact storage simulation
  private artifacts: Map<string, { size: number; created: number }> = new Map();
  
  /**
   * Инициализирует конфигурацию Jenkins из конфига компонента
   */
  initializeConfig(node: CanvasNode): void {
    const config = node.data.config || {};
    
    this.config = {
      jenkinsUrl: config.jenkinsUrl || 'http://jenkins:8080',
      enableCSRF: config.enableCSRF ?? true,
      executorCount: config.executorCount || 2,
      enablePlugins: config.enablePlugins ?? true,
      plugins: config.plugins || ['git', 'docker', 'kubernetes'],
      enablePipeline: config.enablePipeline ?? true,
      enableBlueOcean: config.enableBlueOcean ?? false,
      enableArtifactArchiving: config.enableArtifactArchiving ?? true,
      retentionDays: config.retentionDays || 30,
      pipelines: config.pipelines || [],
      nodes: config.nodes || [],
      buildTriggerRate: config.buildTriggerRate || 0.5, // 0.5 builds per minute per pipeline
      averageBuildDuration: config.averageBuildDuration || 120000, // 2 minutes
      failureRate: config.failureRate || 0.1, // 10% failure rate
    };
    
    // Initialize pipelines
    this.initializePipelines();
    
    // Initialize nodes
    this.initializeNodes();
    
    // Initialize plugins
    this.initializePlugins();
  }
  
  /**
   * Инициализирует pipelines из конфига
   */
  private initializePipelines(): void {
    this.pipelines.clear();
    
    if (!this.config || !this.config.enablePipeline) return;
    
    const configPipelines = this.config.pipelines || [];
    
    for (const pipelineConfig of configPipelines) {
      // Статус вычисляется из builds, не берем из конфига
      // Если есть lastBuild, вычисляем статус из истории builds
      const lastBuildNumber = pipelineConfig.lastBuild || 0;
      
      const pipeline: JenkinsPipeline = {
        id: pipelineConfig.id,
        name: pipelineConfig.name,
        status: 'pending', // Статус будет вычисляться из builds
        lastBuild: lastBuildNumber,
        lastSuccessfulBuild: undefined, // Будет вычисляться из builds
        lastFailedBuild: undefined, // Будет вычисляться из builds
        duration: undefined, // Будет из последнего build
        branch: pipelineConfig.branch || 'main',
        enabled: pipelineConfig.enabled !== false,
        builds: [],
        nextBuildNumber: lastBuildNumber + 1,
      };
      
      // Сохраняем полную конфигурацию pipeline (triggers, parameters, postBuildActions, environmentVariables)
      (pipeline as any).config = {
        triggers: pipelineConfig.triggers || [],
        parameters: pipelineConfig.parameters || [],
        environmentVariables: pipelineConfig.environmentVariables || {},
        postBuildActions: pipelineConfig.postBuildActions || [],
      };
      
      this.pipelines.set(pipeline.id, pipeline);
    }
  }
  
  /**
   * Вычисляет статус pipeline на основе последнего build
   */
  private calculatePipelineStatus(pipeline: JenkinsPipeline): BuildStatus {
    if (pipeline.builds.length === 0) {
      // Проверяем активные builds
      const activeBuild = Array.from(this.activeBuilds.values())
        .find(b => b.pipelineId === pipeline.id && b.status === 'running');
      if (activeBuild) {
        return 'running';
      }
      return 'pending'; // Never built
    }
    
    // Берем последний build из истории
    const lastBuild = pipeline.builds[pipeline.builds.length - 1];
    return lastBuild.status;
  }
  
  /**
   * Инициализирует nodes из конфига
   */
  private initializeNodes(): void {
    this.nodes.clear();
    
    // Master node (built-in)
    const masterNode: JenkinsNode = {
      id: 'master',
      name: 'master',
      status: 'online',
      numExecutors: this.config?.executorCount || 2,
      busyExecutors: 0,
      idleExecutors: this.config?.executorCount || 2,
      labels: ['master'],
    };
    this.nodes.set('master', masterNode);
    
    // Additional nodes from config
    const configNodes = this.config?.nodes || [];
    for (const nodeConfig of configNodes) {
      const node: JenkinsNode = {
        id: nodeConfig.id,
        name: nodeConfig.name,
        status: 'online',
        numExecutors: nodeConfig.numExecutors || 1,
        busyExecutors: 0,
        idleExecutors: nodeConfig.numExecutors || 1,
        labels: nodeConfig.labels || [],
      };
      this.nodes.set(node.id, node);
    }
  }
  
  /**
   * Инициализирует plugins из конфига
   */
  private initializePlugins(): void {
    this.plugins.clear();
    
    if (!this.config || !this.config.enablePlugins) return;
    
    // Популярные плагины Jenkins с описаниями
    const popularPlugins: Record<string, { version: string; description: string; dependencies?: string[] }> = {
      'git': { version: '4.11.0', description: 'Git integration plugin' },
      'docker': { version: '1.2.9', description: 'Docker pipeline plugin', dependencies: ['workflow-aggregator'] },
      'kubernetes': { version: '1.31.1', description: 'Kubernetes plugin for dynamic agent provisioning' },
      'workflow-aggregator': { version: '2.6', description: 'Pipeline plugin aggregator' },
      'blue-ocean': { version: '1.25.3', description: 'Blue Ocean UI for Jenkins', dependencies: ['workflow-aggregator'] },
      'credentials': { version: '2.6.1', description: 'Credentials management plugin' },
      'ssh-slaves': { version: '1.32.0', description: 'SSH agent plugin' },
      'junit': { version: '1.53', description: 'JUnit test result publisher' },
      'maven-plugin': { version: '3.20', description: 'Maven integration plugin' },
      'gradle': { version: '1.36.1', description: 'Gradle plugin' },
    };
    
    const pluginConfigs = this.config.plugins || [];
    for (const pluginConfig of pluginConfigs) {
      // Поддерживаем как строки (старый формат), так и объекты (новый формат)
      let pluginName: string;
      let pluginEnabled: boolean = true;
      
      if (typeof pluginConfig === 'string') {
        pluginName = pluginConfig;
      } else {
        pluginName = pluginConfig.name || pluginConfig;
        pluginEnabled = pluginConfig.enabled !== false;
      }
      
      const pluginInfo = popularPlugins[pluginName] || {
        version: '1.0.0',
        description: `${pluginName} plugin`,
      };
      
      const plugin: JenkinsPlugin = {
        name: pluginName,
        version: pluginInfo.version,
        description: pluginInfo.description,
        enabled: pluginEnabled,
        active: pluginEnabled, // Будет пересчитываться с учетом зависимостей
        dependencies: pluginInfo.dependencies,
      };
      
      this.plugins.set(pluginName, plugin);
    }
    
    // Пересчитываем active статус с учетом зависимостей
    this.updatePluginActiveStatus();
  }
  
  /**
   * Обновляет active статус плагинов с учетом зависимостей
   */
  private updatePluginActiveStatus(): void {
    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled) {
        plugin.active = false;
        continue;
      }
      
      // Проверяем зависимости
      if (plugin.dependencies && plugin.dependencies.length > 0) {
        const allDependenciesSatisfied = plugin.dependencies.every(dep => {
          const depPlugin = this.plugins.get(dep);
          return depPlugin && depPlugin.enabled && depPlugin.active;
        });
        plugin.active = allDependenciesSatisfied;
      } else {
        plugin.active = plugin.enabled;
      }
    }
  }
  
  /**
   * Добавляет новый плагин
   */
  addPlugin(pluginName: string, version?: string, description?: string): boolean {
    if (this.plugins.has(pluginName)) {
      return false; // Плагин уже существует
    }
    
    const plugin: JenkinsPlugin = {
      name: pluginName,
      version: version || '1.0.0',
      description: description || `${pluginName} plugin`,
      enabled: true,
      active: true,
    };
    
    this.plugins.set(pluginName, plugin);
    this.updatePluginActiveStatus();
    return true;
  }
  
  /**
   * Удаляет плагин (проверяет зависимости других плагинов)
   */
  removePlugin(pluginName: string): { success: boolean; reason?: string } {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      return { success: false, reason: 'Plugin not found' };
    }
    
    // Проверяем, не используется ли этот плагин как зависимость
    const dependents = Array.from(this.plugins.values())
      .filter(p => p.dependencies?.includes(pluginName));
    
    if (dependents.length > 0) {
      return {
        success: false,
        reason: `Cannot remove plugin. It is required by: ${dependents.map(p => p.name).join(', ')}`,
      };
    }
    
    this.plugins.delete(pluginName);
    this.updatePluginActiveStatus();
    return { success: true };
  }
  
  /**
   * Включает/выключает плагин
   */
  setPluginEnabled(pluginName: string, enabled: boolean): boolean {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) return false;
    
    plugin.enabled = enabled;
    this.updatePluginActiveStatus();
    return true;
  }
  
  /**
   * Выполняет один цикл обновления Jenkins
   * Должен вызываться периодически в EmulationEngine
   */
  performUpdate(currentTime: number): void {
    if (!this.config) return;
    
    // Update active builds
    this.updateActiveBuilds(currentTime);
    
    // Trigger new builds based on rate
    if (this.config.enablePipeline) {
      this.triggerBuilds(currentTime);
    }
    
    // Cleanup old artifacts
    if (this.config.enableArtifactArchiving) {
      this.cleanupArtifacts(currentTime);
    }
    
    // Update metrics
    this.updateMetrics();
  }
  
  /**
   * Обновляет активные builds
   */
  private updateActiveBuilds(currentTime: number): void {
    // Оптимизация: работаем с копией для избежания проблем с итерацией
    const buildsToProcess = Array.from(this.activeBuilds.entries());
    
    for (const [buildId, build] of buildsToProcess) {
      if (build.status !== 'running') continue;
      
      try {
        // Обновляем логи во время выполнения (только периодически для производительности)
        if (build.startTime && (currentTime - build.startTime) % 5000 < 100) {
          this.updateBuildLogs(build, currentTime);
        }
        
        const elapsed = currentTime - build.startTime;
        const estimatedDuration = build.estimatedDuration || this.config?.averageBuildDuration || 120000;
        
        // Защита от отрицательных значений
        if (elapsed < 0) continue;
        
        // Calculate progress
        build.progress = Math.min(100, Math.max(0, Math.floor((elapsed / estimatedDuration) * 100)));
        
        // Check if build should complete
        if (elapsed >= estimatedDuration) {
        // Determine success/failure based on failure rate
        const shouldFail = Math.random() < (this.config?.failureRate || 0.1);
        build.status = shouldFail ? 'failed' : 'success';
        build.duration = elapsed;
        build.progress = 100;
        
        // Добавляем финальные логи
        if (build.logs) {
          if (shouldFail) {
            build.logs.push('[Pipeline] FAILED');
            build.logs.push(`Build failed after ${(elapsed / 1000).toFixed(1)}s`);
          } else {
            build.logs.push('[Pipeline] SUCCESS');
            build.logs.push(`Build completed successfully in ${(elapsed / 1000).toFixed(1)}s`);
          }
          build.logs.push(`Finished: ${build.status}`);
        }
        
        // Обновляем stages
        if (build.stages) {
          for (const stage of build.stages) {
            if (stage.status === 'running' || stage.status === 'pending') {
              stage.status = build.status;
              if (stage.startTime) {
                stage.duration = currentTime - stage.startTime;
              }
            }
          }
        }
        
        // Выполняем post-build actions
        this.executePostBuildActions(build, build.status === 'success');
        
        // Update pipeline
        const pipeline = this.pipelines.get(build.pipelineId);
        if (pipeline) {
          pipeline.lastBuild = build.number;
          if (build.status === 'success') {
            pipeline.lastSuccessfulBuild = build.number;
          } else if (build.status === 'failed') {
            pipeline.lastFailedBuild = build.number;
          }
          pipeline.duration = build.duration;
          
          // Add to pipeline builds history
          pipeline.builds.push(build);
          if (pipeline.builds.length > 50) {
            pipeline.builds.shift(); // Keep last 50 builds
          }
          
          // Вычисляем статус из builds
          pipeline.status = this.calculatePipelineStatus(pipeline);
        }
        
        // Free executor
        this.freeExecutor(buildId);
        
        // Add to history
        this.addBuildToHistory(build);
        
        // Remove from active builds
        this.activeBuilds.delete(buildId);
        }
      } catch (error) {
        console.error(`Error updating build ${buildId}:`, error);
        // Помечаем build как failed при ошибке
        build.status = 'failed';
        this.activeBuilds.delete(buildId);
        this.freeExecutor(buildId);
      }
    }
  }
  
  /**
   * Триггерит новые builds на основе rate и настроенных триггеров
   */
  private triggerBuilds(currentTime: number): void {
    if (!this.config || !this.config.enablePipeline) return;
    
    for (const [pipelineId, pipeline] of this.pipelines.entries()) {
      if (!pipeline.enabled) continue;
      
      const config = (pipeline as any).config || {};
      const triggers = config.triggers || [];
      
      // Проверяем триггеры pipeline
      let shouldTrigger = false;
      
      if (triggers.length === 0) {
        // Если нет триггеров, НЕ запускаем автоматически
        // Автозапуск только если явно настроен buildTriggerRate > 0
        const triggerRate = this.config.buildTriggerRate || 0;
        if (triggerRate > 0) {
          const triggerInterval = (60 * 1000) / triggerRate;
          const lastTrigger = this.lastBuildTrigger.get(pipelineId) || 0;
          const timeSinceLastTrigger = currentTime - lastTrigger;
          
          if (timeSinceLastTrigger >= triggerInterval) {
            shouldTrigger = true;
          }
        }
        // Если triggerRate = 0 или не задан, не запускаем автоматически
      } else {
        // Проверяем каждый триггер
        for (const trigger of triggers) {
          if (!trigger.enabled) continue;
          
          if (trigger.type === 'cron' && trigger.config?.schedule) {
            // Простая симуляция cron триггера (каждую минуту проверяем)
            // В реальности нужен парсер cron выражений
            shouldTrigger = this.shouldTriggerCron(trigger.config.schedule, pipelineId, currentTime);
          } else if (trigger.type === 'scm' && trigger.config?.pollInterval) {
            // SCM polling триггер
            const pollInterval = trigger.config.pollInterval * 60 * 1000; // конвертируем в миллисекунды
            const lastTrigger = this.lastBuildTrigger.get(`${pipelineId}-scm`) || 0;
            if (currentTime - lastTrigger >= pollInterval) {
              shouldTrigger = true;
              this.lastBuildTrigger.set(`${pipelineId}-scm`, currentTime);
            }
          }
          // webhook и manual триггеры обрабатываются отдельно
        }
      }
      
      if (shouldTrigger && this.hasAvailableExecutor()) {
        this.startBuild(pipelineId, currentTime);
        this.lastBuildTrigger.set(pipelineId, currentTime);
      }
    }
  }
  
  /**
   * Проверяет, должен ли сработать cron триггер
   */
  private shouldTriggerCron(schedule: string, pipelineId: string, currentTime: number): boolean {
    // Простая симуляция - проверяем каждую минуту
    // В реальности нужен полный парсер cron
    const lastTrigger = this.lastBuildTrigger.get(`${pipelineId}-cron`) || 0;
    const minuteMs = 60 * 1000;
    
    // Если прошла хотя бы минута, срабатываем (упрощенная логика)
    if (currentTime - lastTrigger >= minuteMs) {
      this.lastBuildTrigger.set(`${pipelineId}-cron`, currentTime);
      return true;
    }
    
    return false;
  }
  
  /**
   * Обрабатывает webhook триггер
   */
  public triggerWebhook(pipelineId: string, branch?: string, commit?: string): { success: boolean; reason?: string } {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      return { success: false, reason: 'Pipeline not found' };
    }
    
    if (!pipeline.enabled) {
      return { success: false, reason: 'Pipeline is disabled' };
    }
    
    const config = (pipeline as any).config || {};
    const triggers = config.triggers || [];
    
    // Проверяем наличие webhook триггера
    const webhookTrigger = triggers.find(t => t.type === 'webhook' && t.enabled);
    if (!webhookTrigger && triggers.length > 0) {
      return { success: false, reason: 'Webhook trigger not configured or disabled' };
    }
    
    // Проверяем branch фильтр
    if (webhookTrigger?.config?.branches && branch) {
      if (!webhookTrigger.config.branches.includes(branch)) {
        return { success: false, reason: `Branch ${branch} not in allowed branches` };
      }
    }
    
    // Проверяем наличие executor
    if (!this.hasAvailableExecutor()) {
      return { success: false, reason: 'No available executors' };
    }
    
    // Запускаем build
    const currentTime = Date.now();
    this.startBuild(pipelineId, currentTime, { branch, commit, triggeredBy: 'webhook' });
    
    return { success: true };
  }
  
  /**
   * Запускает новый build вручную (публичный метод)
   */
  public triggerBuildManually(pipelineId: string): { success: boolean; buildId?: string; reason?: string } {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      return { success: false, reason: 'Pipeline not found' };
    }
    
    if (!pipeline.enabled) {
      return { success: false, reason: 'Pipeline is disabled' };
    }
    
    if (!this.hasAvailableExecutor()) {
      return { success: false, reason: 'No available executors' };
    }
    
    const currentTime = Date.now();
    this.startBuild(pipelineId, currentTime);
    const buildId = `${pipelineId}-${pipeline.nextBuildNumber - 1}`;
    return { success: true, buildId };
  }
  
  /**
   * Запускает новый build
   */
  private startBuild(pipelineId: string, currentTime: number, options?: { branch?: string; commit?: string; triggeredBy?: string; parameters?: Record<string, any> }): void {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return;
    
    const buildNumber = pipeline.nextBuildNumber++;
    const buildId = `${pipelineId}-${buildNumber}`;
    
    const estimatedDuration = this.config?.averageBuildDuration || 120000;
    // Add some randomness to duration (±30%)
    const durationVariation = estimatedDuration * 0.3;
    const actualEstimatedDuration = estimatedDuration + (Math.random() * 2 - 1) * durationVariation;
    
    // Генерируем начальные логи
    const initialLogs = this.generateBuildLogs(buildNumber, pipeline.name, pipeline.branch || 'main');
    
    // Генерируем артефакты (симуляция)
    const artifacts = this.generateArtifacts(pipeline.name, buildNumber);
    
    // Получаем параметры и environment variables из конфига pipeline
    const config = (pipeline as any).config || {};
    const buildParameters = options?.parameters || {};
    // Используем параметры из конфига pipeline, если они не переданы в options
    const pipelineParameters = config.parameters || [];
    const resolvedParameters: Record<string, any> = {};
    for (const param of pipelineParameters) {
      if (param.defaultValue !== undefined) {
        resolvedParameters[param.name] = param.defaultValue;
      }
    }
    // Переданные параметры переопределяют дефолтные
    Object.assign(resolvedParameters, buildParameters);
    const envVars = { ...(config.environmentVariables || {}), ...resolvedParameters };
    
    const build: JenkinsBuild = {
      id: buildId,
      number: buildNumber,
      pipelineId,
      status: 'running',
      startTime: currentTime,
      estimatedDuration: actualEstimatedDuration,
      progress: 0,
      branch: options?.branch || pipeline.branch,
      commit: options?.commit,
      logs: initialLogs,
      artifacts: artifacts.map(a => a.name),
      triggeredBy: options?.triggeredBy || 'system',
      stages: [
        { name: 'Checkout', status: 'running', startTime: currentTime },
        { name: 'Build', status: 'pending' },
        { name: 'Test', status: 'pending' },
        { name: 'Deploy', status: 'pending' },
      ],
    };
    
    // Сохраняем параметры и env vars в build
    (build as any).parameters = resolvedParameters;
    (build as any).environmentVariables = envVars;
    (build as any).postBuildActions = config.postBuildActions || [];
    
    // Сохраняем артефакты для доступа
    for (const artifact of artifacts) {
      this.artifacts.set(`${buildId}-${artifact.name}`, {
        size: artifact.size,
        created: currentTime,
      });
    }
    
    this.activeBuilds.set(buildId, build);
    // Обновляем статус pipeline на основе активных builds
    pipeline.status = this.calculatePipelineStatus(pipeline);
    
    // Allocate executor
    this.allocateExecutor(buildId);
    
    this.jenkinsMetrics.buildsTotal++;
    this.jenkinsMetrics.buildsRunning++;
  }
  
  /**
   * Генерирует логи для build
   */
  private generateBuildLogs(buildNumber: number, pipelineName: string, branch: string): string[] {
    const logs: string[] = [];
    logs.push(`Started by system`);
    logs.push(`Building on master in workspace /var/jenkins_home/workspace/${pipelineName}`);
    logs.push(`[${pipelineName}] $ /usr/bin/git rev-parse --is-inside-work-tree`);
    logs.push(`true`);
    logs.push(`[${pipelineName}] $ /usr/bin/git config remote.origin.url https://github.com/example/${pipelineName}.git`);
    logs.push(`[${pipelineName}] $ /usr/bin/git --version`);
    logs.push(`git version 2.39.0`);
    logs.push(`[${pipelineName}] $ /usr/bin/git fetch --tags --force --progress -- https://github.com/example/${pipelineName}.git +refs/heads/${branch}:refs/remotes/origin/${branch}`);
    logs.push(`From https://github.com/example/${pipelineName}`);
    logs.push(` * [new branch]      ${branch}       -> origin/${branch}`);
    logs.push(`[${pipelineName}] $ /usr/bin/git rev-parse "refs/remotes/origin/${branch}^{commit}"`);
    logs.push(`abc123def456789`);
    logs.push(`[${pipelineName}] $ /usr/bin/git checkout -f abc123def456789`);
    logs.push(`HEAD is now at abc123def456789 Commit message for build #${buildNumber}`);
    logs.push(`[${pipelineName}] $ /usr/bin/git clean -fdx`);
    logs.push(`Removing .gradle/`);
    logs.push(`Removing build/`);
    logs.push(`[Pipeline] Start of Pipeline`);
    logs.push(`[Pipeline] node`);
    logs.push(`Running on Jenkins in /var/jenkins_home/workspace/${pipelineName}`);
    logs.push(`[Pipeline] {`);
    logs.push(`[Pipeline] stage`);
    logs.push(`[Pipeline] { (Checkout)`);
    logs.push(`[Pipeline] checkout`);
    logs.push(`Checking out abc123def456789 from ${branch}`);
    logs.push(`[Pipeline] }`);
    logs.push(`[Pipeline] // stage`);
    logs.push(`[Pipeline] stage`);
    logs.push(`[Pipeline] { (Build)`);
    logs.push(`[Pipeline] sh`);
    logs.push(`+ echo "Building application..."`);
    logs.push(`Building application...`);
    logs.push(`[Pipeline] sh`);
    logs.push(`+ ./gradlew build -x test`);
    logs.push(`> Task :compileJava`);
    logs.push(`> Task :processResources`);
    logs.push(`> Task :classes`);
    logs.push(`> Task :jar`);
    logs.push(`BUILD SUCCESSFUL in 45s`);
    logs.push(`[Pipeline] }`);
    logs.push(`[Pipeline] // stage`);
    logs.push(`[Pipeline] stage`);
    logs.push(`[Pipeline] { (Test)`);
    logs.push(`[Pipeline] sh`);
    logs.push(`+ echo "Running tests..."`);
    logs.push(`Running tests...`);
    logs.push(`[Pipeline] sh`);
    logs.push(`+ ./gradlew test`);
    logs.push(`> Task :test`);
    logs.push(`Test results: 127 passed, 0 failed`);
    logs.push(`BUILD SUCCESSFUL in 30s`);
    logs.push(`[Pipeline] }`);
    logs.push(`[Pipeline] // stage`);
    logs.push(`[Pipeline] stage`);
    logs.push(`[Pipeline] { (Deploy)`);
    logs.push(`[Pipeline] sh`);
    logs.push(`+ echo "Deploying to staging..."`);
    logs.push(`Deploying to staging...`);
    logs.push(`[Pipeline] }`);
    logs.push(`[Pipeline] // stage`);
    logs.push(`[Pipeline] }`);
    logs.push(`[Pipeline] // node`);
    logs.push(`[Pipeline] End of Pipeline`);
    
    return logs;
  }
  
  /**
   * Генерирует артефакты для build
   */
  private generateArtifacts(pipelineName: string, buildNumber: number): Array<{ name: string; size: number }> {
    const artifacts: Array<{ name: string; size: number }> = [];
    
    // Типичные артефакты
    artifacts.push({ name: `app-${buildNumber}.jar`, size: 15 * 1024 * 1024 }); // 15 MB
    artifacts.push({ name: `app-${buildNumber}-sources.jar`, size: 3 * 1024 * 1024 }); // 3 MB
    artifacts.push({ name: `test-results-${buildNumber}.xml`, size: 512 * 1024 }); // 512 KB
    artifacts.push({ name: `coverage-report-${buildNumber}.html`, size: 2 * 1024 * 1024 }); // 2 MB
    
    return artifacts;
  }
  
  /**
   * Отменяет выполняющийся build
   */
  public cancelBuild(buildId: string): { success: boolean; reason?: string } {
    const build = this.activeBuilds.get(buildId);
    if (!build) {
      return { success: false, reason: 'Build not found or already completed' };
    }
    
    if (build.status !== 'running' && build.status !== 'pending') {
      return { success: false, reason: 'Build is not running' };
    }
    
    // Отменяем build
    build.status = 'aborted';
    build.duration = Date.now() - build.startTime;
    build.progress = 0;
    
    // Добавляем логи об отмене
    if (build.logs) {
      build.logs.push('[Pipeline] Aborted by user');
      build.logs.push(`[Pipeline] Terminated`);
    }
    
    // Обновляем stages
    if (build.stages) {
      for (const stage of build.stages) {
        if (stage.status === 'running') {
          stage.status = 'aborted';
        } else if (stage.status === 'pending') {
          stage.status = 'aborted';
        }
      }
    }
    
    // Освобождаем executor
    this.freeExecutor(buildId);
    
    // Обновляем pipeline
    const pipeline = this.pipelines.get(build.pipelineId);
    if (pipeline) {
      // Добавляем aborted build в историю
      pipeline.builds.push(build);
      if (pipeline.builds.length > 50) {
        pipeline.builds.shift();
      }
      // Пересчитываем статус - если есть успешные builds, показываем success, иначе pending
      pipeline.status = this.calculatePipelineStatus(pipeline);
      // Если все builds отменены, сбрасываем статус на pending для возможности нового запуска
      const hasSuccessfulBuilds = pipeline.builds.some(b => b.status === 'success');
      if (!hasSuccessfulBuilds && pipeline.builds.every(b => b.status === 'aborted' || b.status === 'failed')) {
        pipeline.status = 'pending';
      }
    }
    
    // Удаляем из активных
    this.activeBuilds.delete(buildId);
    
    // Обновляем метрики
    this.jenkinsMetrics.buildsRunning--;
    
    return { success: true };
  }
  
  /**
   * Обновляет логи build во время выполнения
   */
  private updateBuildLogs(build: JenkinsBuild, currentTime: number): void {
    if (!build.logs || build.status !== 'running') return;
    
    const elapsed = currentTime - build.startTime;
    const estimatedDuration = build.estimatedDuration || 120000;
    const progress = Math.min(100, Math.floor((elapsed / estimatedDuration) * 100));
    
    // Добавляем логи на разных стадиях прогресса
    const logProgressThresholds = [10, 30, 50, 70, 90];
    
    for (const threshold of logProgressThresholds) {
      if (progress >= threshold && !build.logs.some(log => log.includes(`Progress: ${threshold}%`))) {
        build.logs.push(`[Pipeline] Progress: ${threshold}% completed`);
      }
    }
    
    // Обновляем stages на основе прогресса
    if (build.stages) {
      const stageProgress = Math.floor(progress / (100 / build.stages.length));
      for (let i = 0; i < build.stages.length; i++) {
        if (i < stageProgress && build.stages[i].status === 'pending') {
          build.stages[i].status = 'running';
          build.stages[i].startTime = currentTime;
        } else if (i === stageProgress && build.stages[i].status === 'pending') {
          build.stages[i].status = 'running';
          build.stages[i].startTime = currentTime;
        }
      }
    }
  }
  
  /**
   * Получает логи build
   */
  public getBuildLogs(buildId: string): string[] | undefined {
    const build = this.getBuildById(buildId);
    return build?.logs;
  }
  
  /**
   * Получает артефакты build
   */
  public getBuildArtifacts(buildId: string): Array<{ name: string; size: number }> {
    const build = this.getBuildById(buildId);
    if (!build || !build.artifacts) return [];
    
    const artifacts: Array<{ name: string; size: number }> = [];
    for (const artifactName of build.artifacts) {
      const artifactKey = `${buildId}-${artifactName}`;
      const artifact = this.artifacts.get(artifactKey);
      if (artifact) {
        artifacts.push({ name: artifactName, size: artifact.size });
      }
    }
    
    return artifacts;
  }
  
  /**
   * Выполняет post-build actions
   */
  private executePostBuildActions(build: JenkinsBuild, success: boolean): void {
    const actions = (build as any).postBuildActions || [];
    
    for (const action of actions) {
      if (!action.enabled) continue;
      
      switch (action.type) {
        case 'email':
          // Симулируем отправку email
          if (build.logs) {
            const recipients = action.config?.recipients || ['default@example.com'];
            build.logs.push(`[Post-Build] Sending email notification to: ${recipients.join(', ')}`);
            build.logs.push(`[Post-Build] Email subject: Build ${build.status === 'success' ? 'SUCCESS' : 'FAILED'} - ${build.pipelineId} #${build.number}`);
          }
          break;
        case 'archive':
          // Артефакты уже архивируются, но применяем паттерн если указан
          if (build.logs) {
            const pattern = action.config?.archivePattern || '**/*';
            build.logs.push(`[Post-Build] Archiving artifacts matching pattern: ${pattern}`);
            if (build.artifacts && build.artifacts.length > 0) {
              build.logs.push(`[Post-Build] Archived ${build.artifacts.length} artifact(s)`);
            }
          }
          break;
        case 'publish':
          // Симулируем публикацию результатов
          if (build.logs) {
            const target = action.config?.publishTarget || 'default';
            build.logs.push(`[Post-Build] Publishing test results to: ${target}`);
            build.logs.push(`[Post-Build] Published build metrics and artifacts`);
          }
          break;
        case 'deploy':
          // Симулируем деплой только при успешном билде
          if (success && action.config?.deployEnv) {
            if (build.logs) {
              const env = action.config.deployEnv;
              build.logs.push(`[Post-Build] Deploying to environment: ${env}`);
              build.logs.push(`[Post-Build] Deployment initiated for build #${build.number}`);
              build.logs.push(`[Post-Build] Deployment to ${env} completed successfully`);
            }
          } else if (!success) {
            if (build.logs) {
              build.logs.push(`[Post-Build] Skipping deployment - build failed`);
            }
          }
          break;
      }
    }
  }
  
  /**
   * Получает конфигурацию pipeline
   */
  public getPipelineConfig(pipelineId: string): any {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return null;
    
    return (pipeline as any).config || {};
  }
  
  /**
   * Обновляет конфигурацию pipeline
   */
  public updatePipelineConfig(pipelineId: string, config: any): boolean {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return false;
    
    (pipeline as any).config = { ...((pipeline as any).config || {}), ...config };
    return true;
  }
  
  /**
   * Проверяет наличие свободного executor
   */
  private hasAvailableExecutor(): boolean {
    for (const node of this.nodes.values()) {
      if (node.idleExecutors > 0) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Выделяет executor для build
   */
  private allocateExecutor(buildId: string): void {
    for (const node of this.nodes.values()) {
      if (node.idleExecutors > 0) {
        node.idleExecutors--;
        node.busyExecutors++;
        return;
      }
    }
  }
  
  /**
   * Освобождает executor после завершения build
   */
  private freeExecutor(buildId: string): void {
    for (const node of this.nodes.values()) {
      if (node.busyExecutors > 0) {
        node.busyExecutors--;
        node.idleExecutors++;
        return;
      }
    }
  }
  
  /**
   * Добавляет build в историю
   */
  private addBuildToHistory(build: JenkinsBuild): void {
    if (!build.duration) return;
    
    this.buildHistory.push({
      timestamp: build.startTime,
      duration: build.duration,
      status: build.status,
    });
    
    if (this.buildHistory.length > this.MAX_BUILD_HISTORY) {
      this.buildHistory.shift();
    }
    
    // Update counters
    if (build.status === 'success') {
      this.jenkinsMetrics.buildsSuccess++;
    } else if (build.status === 'failed') {
      this.jenkinsMetrics.buildsFailed++;
    }
    
    this.jenkinsMetrics.buildsRunning--;
  }
  
  /**
   * Очищает старые артефакты
   */
  private cleanupArtifacts(currentTime: number): void {
    if (!this.config) return;
    
    const retentionMs = (this.config.retentionDays || 30) * 24 * 60 * 60 * 1000;
    
    for (const [artifactId, artifact] of this.artifacts.entries()) {
      if (currentTime - artifact.created > retentionMs) {
        this.artifacts.delete(artifactId);
      }
    }
  }
  
  /**
   * Обновляет метрики Jenkins
   */
  private updateMetrics(): void {
    // Build metrics
    this.jenkinsMetrics.buildsRunning = this.activeBuilds.size;
    this.jenkinsMetrics.buildsPending = Array.from(this.activeBuilds.values())
      .filter(b => b.status === 'pending').length;
    
    // Обновляем buildsTotal - это сумма всех завершенных builds (из истории) + активных
    const completedBuilds = this.buildHistory.length;
    this.jenkinsMetrics.buildsTotal = completedBuilds + this.activeBuilds.size;
    
    // Calculate builds per minute
    const oneMinuteAgo = Date.now() - 60000;
    const recentBuilds = this.buildHistory.filter(b => b.timestamp > oneMinuteAgo);
    this.jenkinsMetrics.buildsPerMinute = recentBuilds.length;
    
    // Calculate average build duration
    if (this.buildHistory.length > 0) {
      const recent = this.buildHistory.slice(-100); // Last 100 builds
      const avgDuration = recent.reduce((sum, b) => sum + b.duration, 0) / recent.length;
      this.jenkinsMetrics.averageBuildDuration = avgDuration;
    }
    
    // Executor metrics
    let totalExecutors = 0;
    let totalBusy = 0;
    let totalIdle = 0;
    
    for (const node of this.nodes.values()) {
      totalExecutors += node.numExecutors;
      totalBusy += node.busyExecutors;
      totalIdle += node.idleExecutors;
    }
    
    this.jenkinsMetrics.executorBusy = totalBusy;
    this.jenkinsMetrics.executorIdle = totalIdle;
    this.jenkinsMetrics.executorUtilization = totalExecutors > 0 
      ? (totalBusy / totalExecutors) * 100 
      : 0;
    
    // Pipeline metrics
    this.jenkinsMetrics.pipelinesTotal = this.pipelines.size;
    this.jenkinsMetrics.pipelinesEnabled = Array.from(this.pipelines.values())
      .filter(p => p.enabled).length;
    
    // Node metrics
    this.jenkinsMetrics.nodesTotal = this.nodes.size;
    this.jenkinsMetrics.nodesOnline = Array.from(this.nodes.values())
      .filter(n => n.status === 'online').length;
    
    // Plugin metrics
    this.jenkinsMetrics.pluginsTotal = this.plugins.size;
    this.jenkinsMetrics.pluginsActive = Array.from(this.plugins.values())
      .filter(p => p.active).length;
    
    // Artifact storage
    let totalBytes = 0;
    for (const artifact of this.artifacts.values()) {
      totalBytes += artifact.size;
    }
    this.jenkinsMetrics.artifactStorageBytes = totalBytes;
  }
  
  /**
   * Получает метрики Jenkins
   */
  getJenkinsMetrics(): JenkinsEngineMetrics {
    return { ...this.jenkinsMetrics };
  }
  
  /**
   * Получает все pipelines с актуальными статусами
   */
  getPipelines(): JenkinsPipeline[] {
    // Обновляем статусы всех pipelines перед возвратом
    for (const pipeline of this.pipelines.values()) {
      pipeline.status = this.calculatePipelineStatus(pipeline);
    }
    return Array.from(this.pipelines.values());
  }
  
  /**
   * Получает все активные builds
   */
  getActiveBuilds(): JenkinsBuild[] {
    return Array.from(this.activeBuilds.values());
  }
  
  /**
   * Получает все nodes
   */
  getNodes(): JenkinsNode[] {
    return Array.from(this.nodes.values());
  }
  
  /**
   * Получает все plugins
   */
  getPlugins(): JenkinsPlugin[] {
    return Array.from(this.plugins.values());
  }
  
  /**
   * Получает builds для pipeline (история)
   */
  getPipelineBuilds(pipelineId: string): JenkinsBuild[] {
    const pipeline = this.pipelines.get(pipelineId);
    return pipeline ? pipeline.builds : [];
  }
  
  /**
   * Получает все builds (активные + история из всех pipelines)
   * Оптимизировано для производительности
   */
  getAllBuilds(): JenkinsBuild[] {
    const allBuilds: JenkinsBuild[] = [];
    
    // Активные builds
    allBuilds.push(...Array.from(this.activeBuilds.values()));
    
    // История builds из всех pipelines (ограничиваем для производительности)
    for (const pipeline of this.pipelines.values()) {
      // Берем только последние 50 builds из каждого pipeline
      const recentBuilds = pipeline.builds.slice(-50);
      allBuilds.push(...recentBuilds);
    }
    
    // Сортируем по времени начала (новые сначала)
    return allBuilds.sort((a, b) => {
      const timeA = a.startTime || 0;
      const timeB = b.startTime || 0;
      return timeB - timeA;
    });
  }
  
  /**
   * Получает build по ID
   */
  getBuildById(buildId: string): JenkinsBuild | undefined {
    // Проверяем активные builds
    if (this.activeBuilds.has(buildId)) {
      return this.activeBuilds.get(buildId);
    }
    
    // Проверяем историю builds
    for (const pipeline of this.pipelines.values()) {
      const build = pipeline.builds.find(b => b.id === buildId);
      if (build) return build;
    }
    
    return undefined;
  }
  
  /**
   * Обновляет конфигурацию (вызывается при изменении конфига в UI)
   */
  updateConfig(node: CanvasNode): void {
    const oldConfig = this.config;
    const oldPipelineIds = new Set(this.pipelines.keys());
    
    this.initializeConfig(node);
    
    // Если изменился executorCount, обновляем master node динамически
    const newExecutorCount = this.config?.executorCount || 2;
    if (oldConfig && oldConfig.executorCount !== newExecutorCount) {
      this.updateExecutorCount(newExecutorCount);
    }
    
    // Проверяем изменения в pipelines
    const newPipelineIds = new Set(this.pipelines.keys());
    
    // Удаляем pipelines, которых больше нет в конфиге
    for (const oldId of oldPipelineIds) {
      if (!newPipelineIds.has(oldId)) {
        // Отменяем активные builds для удаленного pipeline
        for (const [buildId, build] of this.activeBuilds.entries()) {
          if (build.pipelineId === oldId) {
            build.status = 'aborted';
            this.freeExecutor(buildId);
            this.activeBuilds.delete(buildId);
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
        // Обновляем базовые свойства
        existingPipeline.name = pipelineConfig.name;
        existingPipeline.branch = pipelineConfig.branch || 'main';
        existingPipeline.enabled = pipelineConfig.enabled !== false;
        
        // Синхронизируем полную конфигурацию pipeline (triggers, parameters, postBuildActions, environmentVariables)
        (existingPipeline as any).config = {
          triggers: pipelineConfig.triggers || [],
          parameters: pipelineConfig.parameters || [],
          environmentVariables: pipelineConfig.environmentVariables || {},
          postBuildActions: pipelineConfig.postBuildActions || [],
        };
        
        // Статус и lastBuild не обновляем - они управляются builds
      }
    }
    
    // Обновляем nodes из конфига
    const configNodes = this.config?.nodes || [];
    const existingNodeIds = new Set(this.nodes.keys());
    
    // Удаляем ноды, которых больше нет в конфиге (кроме master)
    for (const nodeId of existingNodeIds) {
      if (nodeId !== 'master' && !configNodes.find(n => n.id === nodeId)) {
        this.nodes.delete(nodeId);
      }
    }
    
    // Добавляем/обновляем ноды из конфига
    for (const nodeConfig of configNodes) {
      const existingNode = this.nodes.get(nodeConfig.id);
      if (existingNode) {
        // Обновляем существующую ноду
        existingNode.name = nodeConfig.name;
        existingNode.numExecutors = nodeConfig.numExecutors || 1;
        existingNode.labels = nodeConfig.labels || [];
        // Не обновляем busy/idle executors - они управляются builds
        existingNode.idleExecutors = existingNode.numExecutors - existingNode.busyExecutors;
      } else {
        // Создаем новую ноду
        const newNode: JenkinsNode = {
          id: nodeConfig.id,
          name: nodeConfig.name,
          status: 'online',
          numExecutors: nodeConfig.numExecutors || 1,
          busyExecutors: 0,
          idleExecutors: nodeConfig.numExecutors || 1,
          labels: nodeConfig.labels || [],
        };
        this.nodes.set(nodeConfig.id, newNode);
      }
    }
  }
  
  /**
   * Включает/выключает pipeline
   */
  setPipelineEnabled(pipelineId: string, enabled: boolean): boolean {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return false;
    
    pipeline.enabled = enabled;
    return true;
  }
  
  /**
   * Обновляет количество executors на master node
   * Возвращает true если успешно, false если есть конфликт
   */
  updateExecutorCount(newCount: number): boolean {
    const masterNode = this.nodes.get('master');
    if (!masterNode) return false;
    
    // Проверка: нельзя уменьшить меньше busy executors
    if (newCount < masterNode.busyExecutors) {
      return false; // Конфликт - есть builds, использующие больше executors
    }
    
    const oldCount = masterNode.numExecutors;
    masterNode.numExecutors = newCount;
    masterNode.idleExecutors = newCount - masterNode.busyExecutors;
    
    return true;
  }
  
  /**
   * Проверяет, можно ли изменить executor count на новое значение
   */
  canUpdateExecutorCount(newCount: number): { can: boolean; reason?: string } {
    const masterNode = this.nodes.get('master');
    if (!masterNode) {
      return { can: false, reason: 'Master node not found' };
    }
    
    if (newCount < 1 || newCount > 100) {
      return { can: false, reason: 'Executor count must be between 1 and 100' };
    }
    
    if (newCount < masterNode.busyExecutors) {
      return { 
        can: false, 
        reason: `Cannot reduce executors to ${newCount}. Currently ${masterNode.busyExecutors} executors are busy.` 
      };
    }
    
    return { can: true };
  }
  
  /**
   * Включает/выключает pipeline
   */
  setPipelineEnabled(pipelineId: string, enabled: boolean): boolean {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return false;
    
    pipeline.enabled = enabled;
    return true;
  }
  
  /**
   * Рассчитывает метрики компонента на основе метрик Jenkins
   */
  calculateComponentMetrics(): Partial<ComponentMetrics> {
    const metrics = this.getJenkinsMetrics();
    
    // Calculate throughput (requests per second)
    const throughput = metrics.buildsPerMinute / 60;
    
    // Calculate latency (average build duration)
    const latency = metrics.averageBuildDuration;
    
    // Calculate utilization (executor utilization)
    const utilization = metrics.executorUtilization;
    
    // Calculate error rate
    const totalBuilds = metrics.buildsSuccess + metrics.buildsFailed;
    const errorRate = totalBuilds > 0 ? (metrics.buildsFailed / totalBuilds) * 100 : 0;
    
    return {
      throughput,
      latency,
      utilization,
      errorRate,
    };
  }
}


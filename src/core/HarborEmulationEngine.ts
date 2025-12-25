import { CanvasNode } from '@/types';

/**
 * Harbor Project
 */
export interface HarborProject {
  id: string;
  name: string;
  public: boolean;
  repositories: number;
  tags: number;
  vulnerabilityCount?: number;
  storageUsed?: number;
  accessLevel?: 'private' | 'public';
}

/**
 * Harbor Repository
 */
export interface HarborRepository {
  id: string;
  name: string;
  project: string;
  tags: number;
  pullCount: number;
  lastPush?: string;
  size?: number;
}

/**
 * Harbor Image Tag
 */
export interface HarborImageTag {
  id: string;
  name: string;
  repository: string;
  digest: string;
  size: number;
  created?: string;
  vulnerabilityScan?: HarborVulnerabilityScan;
  signed?: boolean;
}

/**
 * Vulnerability Scan
 */
export interface HarborVulnerabilityScan {
  status: 'pending' | 'running' | 'completed' | 'error';
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  totalVulnerabilities?: number;
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  scannedAt?: string;
  scanDuration?: number; // milliseconds
}

/**
 * Replication Policy
 */
export interface HarborReplicationPolicy {
  id: string;
  name: string;
  sourceRegistry: string;
  destinationRegistry: string;
  trigger: 'manual' | 'event-based' | 'scheduled';
  enabled: boolean;
  filters?: string[];
}

/**
 * Harbor User
 */
export interface HarborUser {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'developer' | 'guest';
  enabled: boolean;
}

/**
 * Harbor Configuration
 */
export interface HarborConfig {
  serverUrl?: string;
  adminUsername?: string;
  adminPassword?: string;
  enableVulnerabilityScanning?: boolean;
  enableContentTrust?: boolean;
  enableImageScanning?: boolean;
  projects?: HarborProject[];
  repositories?: HarborRepository[];
  tags?: HarborImageTag[];
  replicationPolicies?: HarborReplicationPolicy[];
  users?: HarborUser[];
  scannerType?: 'trivy' | 'clair';
  enableGarbageCollection?: boolean;
  gcSchedule?: string;
}

/**
 * Harbor Operation Type
 */
export type HarborOperationType = 'push' | 'pull' | 'scan' | 'replication' | 'gc';

/**
 * Harbor Operation
 */
export interface HarborOperation {
  id: string;
  type: HarborOperationType;
  repository?: string;
  tag?: string;
  project?: string;
  startTime: number;
  duration?: number;
  completionTime?: number; // When the operation should complete (replaces setTimeout)
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  size?: number; // For push/pull operations
}

/**
 * Harbor Metrics
 */
export interface HarborMetrics {
  pushOperationsPerSecond: number;
  pullOperationsPerSecond: number;
  scanOperationsPerSecond: number;
  replicationOperationsPerSecond: number;
  averagePushLatency: number; // ms
  averagePullLatency: number; // ms
  averageScanLatency: number; // ms
  storageUsed: number; // GB
  storageTotal: number; // GB
  totalProjects: number;
  totalRepositories: number;
  totalTags: number;
  totalVulnerabilities: number;
  scansCompleted: number;
  scansRunning: number;
  scansFailed: number;
  replicationPoliciesEnabled: number;
  activeReplications: number;
  gcOperationsTotal: number;
  gcStorageFreed: number; // GB
}

/**
 * Harbor Load Metrics (for component metrics calculation)
 */
export interface HarborLoad {
  throughput: number; // Operations per second
  averageLatency: number; // ms
  errorRate: number; // 0-1
  cpuUtilization: number; // 0-1
  memoryUtilization: number; // 0-1
  storageUtilization: number; // 0-1
  networkUtilization: number; // 0-1
}

/**
 * Harbor Emulation Engine
 * Симулирует работу Harbor Registry: push/pull операций, сканирование, репликация, GC
 */
export class HarborEmulationEngine {
  private config: HarborConfig | null = null;
  
  // Active operations
  private activeOperations: Map<string, HarborOperation> = new Map();
  
  // Operation history for metrics calculation
  private operationHistory: HarborOperation[] = [];
  private readonly MAX_HISTORY_SIZE = 1000;
  
  // Latency history for percentile calculations
  private pushLatencyHistory: number[] = [];
  private pullLatencyHistory: number[] = [];
  private scanLatencyHistory: number[] = [];
  private readonly MAX_LATENCY_HISTORY = 500;
  
  // Metrics
  private harborMetrics: HarborMetrics = {
    pushOperationsPerSecond: 0,
    pullOperationsPerSecond: 0,
    scanOperationsPerSecond: 0,
    replicationOperationsPerSecond: 0,
    averagePushLatency: 0,
    averagePullLatency: 0,
    averageScanLatency: 0,
    storageUsed: 0,
    storageTotal: 100, // Default 100GB
    totalProjects: 0,
    totalRepositories: 0,
    totalTags: 0,
    totalVulnerabilities: 0,
    scansCompleted: 0,
    scansRunning: 0,
    scansFailed: 0,
    replicationPoliciesEnabled: 0,
    activeReplications: 0,
    gcOperationsTotal: 0,
    gcStorageFreed: 0,
  };

  // Last GC run time
  private lastGCRun: number = 0;

  /**
   * Инициализирует конфигурацию Harbor из конфига компонента
   */
  initializeConfig(node: CanvasNode): void {
    const config = (node.data.config || {}) as HarborConfig;
    this.config = config;
    
    // Initialize metrics from config
    this.updateMetricsFromConfig();
  }

  /**
   * Обновляет конфигурацию (вызывается при изменении конфига в UI)
   */
  updateConfig(node: CanvasNode): void {
    const newConfig = (node.data.config || {}) as HarborConfig;
    this.config = newConfig;
    this.updateMetricsFromConfig();
  }

  /**
   * Обновляет метрики из конфигурации
   */
  private updateMetricsFromConfig(): void {
    if (!this.config) return;

    // Update counts from config
    this.harborMetrics.totalProjects = this.config.projects?.length || 0;
    this.harborMetrics.totalRepositories = this.config.repositories?.length || 0;
    this.harborMetrics.totalTags = this.config.tags?.length || 0;
    
    // Calculate storage used
    let storageUsed = 0;
    if (this.config.projects) {
      storageUsed = this.config.projects.reduce((sum, p) => sum + (p.storageUsed || 0), 0);
    }
    this.harborMetrics.storageUsed = storageUsed;

    // Count vulnerabilities
    let totalVulnerabilities = 0;
    if (this.config.tags) {
      this.config.tags.forEach(tag => {
        if (tag.vulnerabilityScan?.totalVulnerabilities) {
          totalVulnerabilities += tag.vulnerabilityScan.totalVulnerabilities;
        }
      });
    }
    this.harborMetrics.totalVulnerabilities = totalVulnerabilities;

    // Count enabled replication policies
    this.harborMetrics.replicationPoliciesEnabled = 
      (this.config.replicationPolicies || []).filter(p => p.enabled).length;

    // Count running scans
    this.harborMetrics.scansRunning = 
      (this.config.tags || []).filter(t => t.vulnerabilityScan?.status === 'running').length;
  }

  /**
   * Выполняет один цикл обновления Harbor
   * Должен вызываться периодически в EmulationEngine
   */
  performUpdate(currentTime: number, hasIncomingConnections: boolean = false): void {
    if (!this.config) return;

    // Simulate push/pull operations based on incoming connections
    if (hasIncomingConnections) {
      this.simulatePushPullOperations(currentTime);
    }

    // Simulate vulnerability scans
    if (this.config.enableVulnerabilityScanning || this.config.enableImageScanning) {
      this.simulateVulnerabilityScans(currentTime);
    }

    // Simulate replication
    if (this.config.replicationPolicies && this.config.replicationPolicies.length > 0) {
      this.simulateReplication(currentTime);
    }

    // Simulate garbage collection
    if (this.config.enableGarbageCollection) {
      this.simulateGarbageCollection(currentTime);
    }

    // Update active operations
    this.updateActiveOperations(currentTime);

    // Update metrics
    this.updateMetrics(currentTime);
  }

  /**
   * Симулирует push/pull операции
   */
  private simulatePushPullOperations(currentTime: number): void {
    if (!this.config?.repositories || this.config.repositories.length === 0) return;

    // Base operation rate: 0.1-2 ops/sec depending on number of repositories
    const baseRate = Math.min(2, 0.1 + (this.config.repositories.length / 10));
    
    // Randomly trigger push/pull operations
    if (Math.random() < baseRate / 10) { // Divide by 10 because called ~10 times per second
      const repository = this.config.repositories[Math.floor(Math.random() * this.config.repositories.length)];
      const isPush = Math.random() < 0.3; // 30% push, 70% pull
      
      if (isPush) {
        this.simulatePush(repository, currentTime);
      } else {
        this.simulatePull(repository, currentTime);
      }
    }
  }

  /**
   * Симулирует push операцию
   */
  private simulatePush(repository: HarborRepository, currentTime: number): void {
    const operationId = `push-${currentTime}-${Math.random()}`;
    const size = 50 + Math.random() * 500; // 50-550 MB
    const latency = 500 + Math.random() * 1500; // 500-2000ms
    const completionTime = currentTime + latency;

    const operation: HarborOperation = {
      id: operationId,
      type: 'push',
      repository: repository.name,
      project: repository.project,
      startTime: currentTime,
      status: 'running',
      size,
      completionTime, // Store completion time instead of using setTimeout
    };

    this.activeOperations.set(operationId, operation);
    // Latency will be added to history when operation completes
  }

  /**
   * Симулирует pull операцию
   */
  private simulatePull(repository: HarborRepository, currentTime: number): void {
    const operationId = `pull-${currentTime}-${Math.random()}`;
    const latency = 200 + Math.random() * 800; // 200-1000ms (pull is faster)
    const completionTime = currentTime + latency;

    const operation: HarborOperation = {
      id: operationId,
      type: 'pull',
      repository: repository.name,
      project: repository.project,
      startTime: currentTime,
      status: 'running',
      completionTime, // Store completion time instead of using setTimeout
    };

    this.activeOperations.set(operationId, operation);
    // Latency will be added to history when operation completes
  }

  /**
   * Симулирует сканирование уязвимостей
   */
  private simulateVulnerabilityScans(currentTime: number): void {
    if (!this.config?.tags) return;

    // Find tags that need scanning
    const tagsToScan = this.config.tags.filter(tag => {
      const scan = tag.vulnerabilityScan;
      return !scan || scan.status === 'pending' || (scan.status === 'completed' && this.shouldRescan(tag));
    });

    if (tagsToScan.length === 0) return;

    // Scan one tag at a time (rate limited)
    if (this.harborMetrics.scansRunning < 3 && Math.random() < 0.1) {
      const tag = tagsToScan[Math.floor(Math.random() * tagsToScan.length)];
      this.startVulnerabilityScan(tag.id, currentTime);
    }

    // Complete running scans
    this.completeVulnerabilityScans(currentTime);
  }

  /**
   * Запускает сканирование уязвимостей для тега
   */
  startVulnerabilityScan(tagId: string, currentTime: number): void {
    if (!this.config?.tags) return;

    const tag = this.config.tags.find(t => t.id === tagId);
    if (!tag) return;

    const operationId = `scan-${tagId}-${currentTime}`;
    const scanDuration = 5000 + Math.random() * 15000; // 5-20 seconds
    const completionTime = currentTime + scanDuration;

    const operation: HarborOperation = {
      id: operationId,
      type: 'scan',
      repository: tag.repository,
      tag: tag.name,
      startTime: currentTime,
      status: 'running',
      completionTime, // Store completion time instead of using setTimeout
    };

    this.activeOperations.set(operationId, operation);
    this.harborMetrics.scansRunning++;

    // Update tag scan status
    const updatedTags = this.config.tags.map(t =>
      t.id === tagId
        ? {
            ...t,
            vulnerabilityScan: {
              status: 'running' as const,
              severity: 'none' as const,
              scannedAt: new Date(currentTime).toISOString(),
            },
          }
        : t
    );

    this.config.tags = updatedTags;
  }

  /**
   * Завершает запущенные сканирования (для симуляции)
   * Теперь это обрабатывается через updateActiveOperations
   */
  private completeVulnerabilityScans(currentTime: number): void {
    // Scans are now completed via updateActiveOperations based on completionTime
    // This method is kept for compatibility but no longer needed
  }

  /**
   * Определяет, нужно ли повторное сканирование
   */
  private shouldRescan(tag: HarborImageTag): boolean {
    if (!tag.vulnerabilityScan?.scannedAt) return true;
    
    const scannedAt = new Date(tag.vulnerabilityScan.scannedAt).getTime();
    const age = Date.now() - scannedAt;
    const rescanInterval = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    return age > rescanInterval;
  }

  /**
   * Симулирует репликацию
   */
  private simulateReplication(currentTime: number): void {
    if (!this.config?.replicationPolicies) return;

    const enabledPolicies = this.config.replicationPolicies.filter(p => p.enabled);
    if (enabledPolicies.length === 0) return;

    // Simulate replication based on trigger type
    enabledPolicies.forEach(policy => {
      if (policy.trigger === 'event-based' && Math.random() < 0.05) {
        // Event-based: triggered by new images
        this.simulateReplicationOperation(policy, currentTime);
      } else if (policy.trigger === 'scheduled') {
        // Scheduled: check schedule (simplified - run every hour)
        const lastRun = this.getLastReplicationRun(policy.id);
        if (currentTime - lastRun > 3600000) { // 1 hour
          this.simulateReplicationOperation(policy, currentTime);
          this.setLastReplicationRun(policy.id, currentTime);
        }
      }
    });
  }

  private lastReplicationRuns: Map<string, number> = new Map();

  private getLastReplicationRun(policyId: string): number {
    return this.lastReplicationRuns.get(policyId) || 0;
  }

  private setLastReplicationRun(policyId: string, time: number): void {
    this.lastReplicationRuns.set(policyId, time);
  }

  /**
   * Симулирует операцию репликации
   */
  private simulateReplicationOperation(policy: HarborReplicationPolicy, currentTime: number): void {
    const operationId = `replication-${policy.id}-${currentTime}`;
    const latency = 2000 + Math.random() * 5000; // 2-7 seconds
    const completionTime = currentTime + latency;

    const operation: HarborOperation = {
      id: operationId,
      type: 'replication',
      startTime: currentTime,
      status: 'running',
      completionTime, // Store completion time instead of using setTimeout
    };

    this.activeOperations.set(operationId, operation);
    this.harborMetrics.activeReplications++;
  }

  /**
   * Симулирует garbage collection
   */
  private simulateGarbageCollection(currentTime: number): void {
    if (!this.config?.gcSchedule) return;

    // Parse cron schedule (simplified - check if it's time)
    // For now, run GC every 24 hours
    if (currentTime - this.lastGCRun > 24 * 60 * 60 * 1000) {
      this.runGarbageCollection(currentTime);
      this.lastGCRun = currentTime;
    }
  }

  /**
   * Запускает garbage collection
   */
  private runGarbageCollection(currentTime: number): void {
    const operationId = `gc-${currentTime}`;
    const latency = 30000 + Math.random() * 60000; // 30-90 seconds
    const completionTime = currentTime + latency;
    const storageFreed = Math.random() * 5; // 0-5 GB

    const operation: HarborOperation = {
      id: operationId,
      type: 'gc',
      startTime: currentTime,
      status: 'running',
      completionTime, // Store completion time instead of using setTimeout
      size: storageFreed * 1024, // Store storageFreed in size field (will be converted from MB to GB)
    };

    this.activeOperations.set(operationId, operation);
  }

  /**
   * Обновляет активные операции и завершает те, которые должны быть завершены
   */
  private updateActiveOperations(currentTime: number): void {
    const operationsToComplete: HarborOperation[] = [];

    // Check for operations that should complete
    for (const [id, operation] of this.activeOperations.entries()) {
      if (operation.completionTime && currentTime >= operation.completionTime && operation.status === 'running') {
        operationsToComplete.push(operation);
      }
    }

    // Complete operations
    for (const operation of operationsToComplete) {
      this.completeOperation(operation, currentTime);
    }

    // Clean up old completed operations (older than 1 minute)
    const oneMinuteAgo = currentTime - 60000;
    for (const [id, operation] of this.activeOperations.entries()) {
      if (operation.startTime < oneMinuteAgo && operation.status === 'completed') {
        this.activeOperations.delete(id);
      }
    }
  }

  /**
   * Завершает операцию
   */
  private completeOperation(operation: HarborOperation, currentTime: number): void {
    const duration = operation.completionTime ? operation.completionTime - operation.startTime : 0;
    operation.status = 'completed';
    operation.duration = duration;
    this.activeOperations.delete(operation.id);
    this.addOperationToHistory(operation);

    // Handle operation-specific completion logic
    switch (operation.type) {
      case 'push':
        // Update storage metrics
        if (this.config && operation.size) {
          this.harborMetrics.storageUsed += operation.size / 1024; // Convert MB to GB
        }
        // Add latency to history
        if (duration > 0) {
          this.pushLatencyHistory.push(duration);
          if (this.pushLatencyHistory.length > this.MAX_LATENCY_HISTORY) {
            this.pushLatencyHistory.shift();
          }
        }
        break;

      case 'pull':
        // Add latency to history
        if (duration > 0) {
          this.pullLatencyHistory.push(duration);
          if (this.pullLatencyHistory.length > this.MAX_LATENCY_HISTORY) {
            this.pullLatencyHistory.shift();
          }
        }
        break;

      case 'scan':
        // Complete vulnerability scan
        // Extract tagId from operation.id (format: "scan-{tagId}-{timestamp}")
        if (this.config?.tags && operation.id) {
          const tagIdMatch = operation.id.match(/^scan-(.+?)-/);
          if (tagIdMatch) {
            const tagId = tagIdMatch[1];
            const tag = this.config.tags.find(t => t.id === tagId);
            if (tag) {
            const critical = Math.floor(Math.random() * 3);
            const high = Math.floor(Math.random() * 5);
            const medium = Math.floor(Math.random() * 10);
            const low = Math.floor(Math.random() * 15);
            const total = critical + high + medium + low;
            const severity = critical > 0 ? 'critical' : high > 0 ? 'high' : medium > 0 ? 'medium' : low > 0 ? 'low' : 'none';

            const updatedTags = this.config.tags.map(t =>
              t.id === tagId
                ? {
                    ...t,
                    vulnerabilityScan: {
                      status: 'completed' as const,
                      severity: severity as any,
                      totalVulnerabilities: total,
                      critical,
                      high,
                      medium,
                      low,
                      scannedAt: new Date(currentTime).toISOString(),
                      scanDuration: duration,
                    },
                  }
                : t
            );

            this.config.tags = updatedTags;
            this.harborMetrics.scansRunning = Math.max(0, this.harborMetrics.scansRunning - 1);
            this.harborMetrics.scansCompleted++;
            this.scanLatencyHistory.push(duration);
            if (this.scanLatencyHistory.length > this.MAX_LATENCY_HISTORY) {
              this.scanLatencyHistory.shift();
            }
            }
          }
        }
        break;

      case 'replication':
        this.harborMetrics.activeReplications = Math.max(0, this.harborMetrics.activeReplications - 1);
        break;

      case 'gc':
        if (operation.size) {
          const storageFreed = operation.size / 1024; // Convert MB to GB
          this.harborMetrics.gcOperationsTotal++;
          this.harborMetrics.gcStorageFreed += storageFreed;
          this.harborMetrics.storageUsed = Math.max(0, this.harborMetrics.storageUsed - storageFreed);
        }
        break;
    }
  }

  /**
   * Добавляет операцию в историю
   */
  private addOperationToHistory(operation: HarborOperation): void {
    this.operationHistory.push(operation);
    if (this.operationHistory.length > this.MAX_HISTORY_SIZE) {
      this.operationHistory.shift();
    }
  }

  /**
   * Обновляет метрики
   */
  private updateMetrics(currentTime: number): void {
    // Calculate operations per second from history (last 10 seconds)
    const tenSecondsAgo = currentTime - 10000;
    const recentOperations = this.operationHistory.filter(op => op.startTime > tenSecondsAgo);

    this.harborMetrics.pushOperationsPerSecond = 
      recentOperations.filter(op => op.type === 'push').length / 10;
    this.harborMetrics.pullOperationsPerSecond = 
      recentOperations.filter(op => op.type === 'pull').length / 10;
    this.harborMetrics.scanOperationsPerSecond = 
      recentOperations.filter(op => op.type === 'scan').length / 10;
    this.harborMetrics.replicationOperationsPerSecond = 
      recentOperations.filter(op => op.type === 'replication').length / 10;

    // Calculate average latencies
    if (this.pushLatencyHistory.length > 0) {
      this.harborMetrics.averagePushLatency = 
        this.pushLatencyHistory.reduce((a, b) => a + b, 0) / this.pushLatencyHistory.length;
    }

    if (this.pullLatencyHistory.length > 0) {
      this.harborMetrics.averagePullLatency = 
        this.pullLatencyHistory.reduce((a, b) => a + b, 0) / this.pullLatencyHistory.length;
    }

    if (this.scanLatencyHistory.length > 0) {
      this.harborMetrics.averageScanLatency = 
        this.scanLatencyHistory.reduce((a, b) => a + b, 0) / this.scanLatencyHistory.length;
    }

    // Update config-based metrics
    this.updateMetricsFromConfig();
  }

  /**
   * Вычисляет нагрузку для компонентных метрик
   */
  calculateLoad(): HarborLoad {
    const totalOpsPerSecond = 
      this.harborMetrics.pushOperationsPerSecond +
      this.harborMetrics.pullOperationsPerSecond +
      this.harborMetrics.scanOperationsPerSecond +
      this.harborMetrics.replicationOperationsPerSecond;

    const averageLatency = 
      (this.harborMetrics.averagePushLatency * this.harborMetrics.pushOperationsPerSecond +
       this.harborMetrics.averagePullLatency * this.harborMetrics.pullOperationsPerSecond +
       this.harborMetrics.averageScanLatency * this.harborMetrics.scanOperationsPerSecond) /
      Math.max(1, this.harborMetrics.pushOperationsPerSecond + 
                  this.harborMetrics.pullOperationsPerSecond + 
                  this.harborMetrics.scanOperationsPerSecond);

    // Calculate error rate (failed operations)
    const recentFailedOps = this.operationHistory
      .filter(op => op.status === 'failed')
      .length;
    const errorRate = Math.min(1, recentFailedOps / Math.max(1, this.operationHistory.length));

    // Calculate utilization based on operations
    const cpuUtilization = Math.min(0.95, 0.1 + (totalOpsPerSecond / 10) * 0.4);
    const memoryUtilization = Math.min(0.95, 0.2 + (this.harborMetrics.storageUsed / this.harborMetrics.storageTotal) * 0.5);
    const storageUtilization = this.harborMetrics.storageUsed / this.harborMetrics.storageTotal;
    const networkUtilization = Math.min(0.95, (totalOpsPerSecond / 20) * 0.6);

    return {
      throughput: totalOpsPerSecond,
      averageLatency: averageLatency || 0,
      errorRate,
      cpuUtilization,
      memoryUtilization,
      storageUtilization,
      networkUtilization,
    };
  }

  /**
   * Получает метрики Harbor
   */
  getMetrics(): HarborMetrics {
    return { ...this.harborMetrics };
  }

  /**
   * Получает конфигурацию
   */
  getConfig(): HarborConfig | null {
    return this.config ? { ...this.config } : null;
  }
}


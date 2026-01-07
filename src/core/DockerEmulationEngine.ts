import { CanvasNode } from '@/types';
import { IDockerProvider, ContainerStats as ProviderContainerStats } from './docker/IDockerProvider';
import { DockerAPIAdapter, DockerConnectionConfig } from './docker/DockerAPIAdapter';
import { DockerSimulationProvider } from './docker/DockerSimulationProvider';

/**
 * Docker Container
 */
export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  imageId: string;
  status: 'created' | 'running' | 'paused' | 'restarting' | 'removing' | 'exited' | 'dead';
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  restartCount: number;
  cpuUsage?: number; // Percentage 0-100
  memoryUsage?: number; // Bytes
  memoryLimit?: number; // Bytes
  networkRx?: number; // Bytes received
  networkTx?: number; // Bytes transmitted
  ports?: DockerPort[];
  environment?: Record<string, string>;
  volumes?: string[]; // Volume names
  networks?: string[]; // Network names
  health?: 'healthy' | 'unhealthy' | 'starting' | 'none';
  exitCode?: number;
}

/**
 * Docker Port Mapping
 */
export interface DockerPort {
  containerPort: number;
  hostPort?: number;
  protocol: 'tcp' | 'udp';
}

/**
 * Docker Image
 */
export interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  digest?: string;
  size: number; // Bytes
  createdAt: number;
  pulledAt?: number;
  builtAt?: number;
  layers?: number;
  vulnerabilities?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Docker Network
 */
export interface DockerNetwork {
  id: string;
  name: string;
  driver: 'bridge' | 'host' | 'overlay' | 'macvlan' | 'none';
  scope: 'local' | 'global' | 'swarm';
  subnet?: string;
  gateway?: string;
  containers?: string[]; // Container IDs
  created: number;
  internal: boolean;
  enableIPv6: boolean;
}

/**
 * Docker Volume
 */
export interface DockerVolume {
  id: string;
  name: string;
  driver: 'local' | 'nfs' | 'cifs' | 'tmpfs';
  mountpoint?: string;
  size?: number; // Bytes
  usedBy?: string[]; // Container IDs
  created: number;
  labels?: Record<string, string>;
}

/**
 * Docker Configuration
 */
export interface DockerConfig {
  daemonUrl?: string;
  apiVersion?: string;
  containers?: DockerContainer[];
  images?: DockerImage[];
  networks?: DockerNetwork[];
  volumes?: DockerVolume[];
  dockerfile?: string;
  composeFile?: string;
  enableBuildKit?: boolean;
  enableSwarm?: boolean;
  resourceLimits?: {
    cpu?: string;
    memory?: string;
    disk?: string;
  };
  
  // Режим работы Docker
  mode?: 'simulation' | 'real' | 'hybrid';
  
  // Настройки подключения к реальному Docker
  dockerConnection?: {
    type: 'local' | 'remote';
    url?: string; // unix:///var/run/docker.sock или tcp://host:port
    host?: string;
    port?: number;
    useTLS?: boolean;
    caCert?: string;
    clientCert?: string;
    clientKey?: string;
  };
  
  // Настройки синхронизации
  syncSettings?: {
    enabled: boolean;
    interval?: number; // ms для polling
    useEvents?: boolean; // использовать Docker Events API
  };
}

/**
 * Docker Operation Type
 */
export type DockerOperationType = 'create' | 'start' | 'stop' | 'pause' | 'unpause' | 'restart' | 'remove' | 'pull' | 'push' | 'build';

/**
 * Docker Operation
 */
export interface DockerOperation {
  id: string;
  type: DockerOperationType;
  containerId?: string;
  imageId?: string;
  networkId?: string;
  volumeId?: string;
  startTime: number;
  duration?: number;
  completionTime?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  progress?: number; // 0-100 for long operations
}

/**
 * Docker Metrics
 */
export interface DockerMetrics {
  containersTotal: number;
  containersRunning: number;
  containersStopped: number;
  containersPaused: number;
  imagesTotal: number;
  imagesSize: number; // Bytes
  networksTotal: number;
  volumesTotal: number;
  volumesSize: number; // Bytes
  operationsPerSecond: number;
  averageOperationLatency: number; // ms
  totalCpuUsage: number; // Percentage 0-100
  totalMemoryUsage: number; // Bytes
  totalMemoryLimit: number; // Bytes
  totalNetworkRx: number; // Bytes
  totalNetworkTx: number; // Bytes
  buildOperationsPerSecond: number;
  pullOperationsPerSecond: number;
  pushOperationsPerSecond: number;
}

/**
 * Docker Load Metrics (for component metrics calculation)
 */
export interface DockerLoad {
  throughput: number; // Operations per second
  averageLatency: number; // ms
  errorRate: number; // 0-1
  cpuUtilization: number; // 0-1
  memoryUtilization: number; // 0-1
  networkUtilization: number; // 0-1
  diskUtilization: number; // 0-1
}

/**
 * Docker Emulation Engine
 * Симулирует работу Docker: контейнеры, образы, сети, тома, операции
 * Поддерживает режимы: simulation, real, hybrid
 */
export class DockerEmulationEngine {
  private config: DockerConfig | null = null;
  
  // Mode and providers
  private mode: 'simulation' | 'real' | 'hybrid' = 'simulation';
  private simulationProvider: DockerSimulationProvider | null = null;
  private realProvider: DockerAPIAdapter | null = null;
  private currentProvider: IDockerProvider | null = null;
  
  // Active operations
  private activeOperations: Map<string, DockerOperation> = new Map();
  
  // Operation history for metrics calculation
  private operationHistory: DockerOperation[] = [];
  private readonly MAX_HISTORY_SIZE = 1000;
  
  // Latency history for percentile calculations
  private operationLatencyHistory: number[] = [];
  private readonly MAX_LATENCY_HISTORY = 500;
  
  // Container runtime state (managed by engine, synced with config)
  private containers: Map<string, DockerContainer> = new Map();
  
  // Sync settings
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private syncEnabled: boolean = false;
  private lastSyncTime: number = 0;
  
  // Metrics
  private dockerMetrics: DockerMetrics = {
    containersTotal: 0,
    containersRunning: 0,
    containersStopped: 0,
    containersPaused: 0,
    imagesTotal: 0,
    imagesSize: 0,
    networksTotal: 0,
    volumesTotal: 0,
    volumesSize: 0,
    operationsPerSecond: 0,
    averageOperationLatency: 0,
    totalCpuUsage: 0,
    totalMemoryUsage: 0,
    totalMemoryLimit: 0,
    totalNetworkRx: 0,
    totalNetworkTx: 0,
    buildOperationsPerSecond: 0,
    pullOperationsPerSecond: 0,
    pushOperationsPerSecond: 0,
  };

  // Last update time for resource calculations
  private lastUpdateTime: number = Date.now();

  /**
   * Инициализирует конфигурацию Docker из конфига компонента
   */
  initializeConfig(node: CanvasNode): void {
    const config = (node.data.config || {}) as DockerConfig;
    this.config = config;
    
    // Set mode
    this.mode = config.mode || 'simulation';
    
    // Initialize providers based on mode
    this.initializeProviders();
    
    // Initialize containers from config
    if (config.containers && Array.isArray(config.containers)) {
      for (const container of config.containers) {
        this.containers.set(container.id, { ...container });
      }
    }
    
    // Initialize metrics from config
    this.updateMetricsFromConfig();
    
    // Start sync if enabled
    if (this.mode !== 'simulation' && config.syncSettings?.enabled) {
      this.startSync();
    }
  }

  /**
   * Initialize providers based on mode
   */
  private initializeProviders(): void {
    // Always create simulation provider
    // Ensure arrays are passed (handle cases where config might have non-array values)
    const containers = Array.isArray(this.config?.containers) ? this.config.containers : undefined;
    const images = Array.isArray(this.config?.images) ? this.config.images : undefined;
    const networks = Array.isArray(this.config?.networks) ? this.config.networks : undefined;
    const volumes = Array.isArray(this.config?.volumes) ? this.config.volumes : undefined;
    
    this.simulationProvider = new DockerSimulationProvider(
      containers,
      images,
      networks,
      volumes
    );

    // Create real provider if needed
    if (this.mode === 'real' || this.mode === 'hybrid') {
      if (this.config?.dockerConnection) {
        const connectionConfig: DockerConnectionConfig = {
          type: this.config.dockerConnection.type,
          url: this.config.dockerConnection.url,
          host: this.config.dockerConnection.host,
          port: this.config.dockerConnection.port,
          useTLS: this.config.dockerConnection.useTLS,
          caCert: this.config.dockerConnection.caCert,
          clientCert: this.config.dockerConnection.clientCert,
          clientKey: this.config.dockerConnection.clientKey,
        };
        this.realProvider = new DockerAPIAdapter(connectionConfig);
      }
    }

    // Set current provider
    this.currentProvider = this.mode === 'simulation' 
      ? this.simulationProvider 
      : (this.realProvider || this.simulationProvider);
  }

  /**
   * Set mode and reinitialize providers
   */
  setMode(mode: 'simulation' | 'real' | 'hybrid'): void {
    if (this.mode === mode) return;
    
    this.mode = mode;
    
    // Stop current sync
    this.stopSync();
    
    // Reinitialize providers
    this.initializeProviders();
    
    // Start sync if needed
    if (this.mode !== 'simulation' && this.config?.syncSettings?.enabled) {
      this.startSync();
    }
  }

  /**
   * Get current mode
   */
  getMode(): 'simulation' | 'real' | 'hybrid' {
    return this.mode;
  }

  /**
   * Start synchronization with real Docker
   */
  private startSync(): void {
    if (this.syncInterval) return;
    
    const interval = this.config?.syncSettings?.interval || 2000; // Default 2 seconds
    this.syncEnabled = true;
    
    // Initial sync
    this.syncFromProvider();
    
    // Periodic sync
    this.syncInterval = setInterval(() => {
      this.syncFromProvider();
    }, interval);
    
    // Subscribe to events if enabled
    if (this.config?.syncSettings?.useEvents && this.currentProvider) {
      this.currentProvider.subscribeToEvents((event) => {
        this.handleDockerEvent(event);
      });
    }
  }

  /**
   * Stop synchronization
   */
  private stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.syncEnabled = false;
  }

  /**
   * Sync data from provider
   */
  private async syncFromProvider(): Promise<void> {
    if (!this.currentProvider || !this.currentProvider.isConnected()) {
      return;
    }

    try {
      // Sync containers
      const providerContainers = await this.currentProvider.listContainers();
      this.syncContainers(providerContainers);
      
      // Sync images
      const providerImages = await this.currentProvider.listImages();
      if (this.config) {
        this.config.images = providerImages;
      }
      
      // Sync networks
      const providerNetworks = await this.currentProvider.listNetworks();
      if (this.config) {
        this.config.networks = providerNetworks;
      }
      
      // Sync volumes
      const providerVolumes = await this.currentProvider.listVolumes();
      if (this.config) {
        this.config.volumes = providerVolumes;
      }
      
      this.lastSyncTime = Date.now();
      this.updateMetricsFromConfig();
    } catch (error) {
      console.error('Failed to sync from Docker provider:', error);
    }
  }

  /**
   * Sync containers from provider
   */
  private syncContainers(providerContainers: DockerContainer[]): void {
    // Update existing containers and add new ones
    for (const providerContainer of providerContainers) {
      const existing = this.containers.get(providerContainer.id);
      if (existing) {
        // Update existing container
        Object.assign(existing, providerContainer);
      } else {
        // Add new container
        this.containers.set(providerContainer.id, { ...providerContainer });
      }
    }
    
    // Remove containers that no longer exist in provider
    const providerIds = new Set(providerContainers.map(c => c.id));
    for (const [id] of this.containers.entries()) {
      if (!providerIds.has(id)) {
        this.containers.delete(id);
      }
    }
    
    // Update config
    if (this.config) {
      this.config.containers = Array.from(this.containers.values());
    }
  }

  /**
   * Handle Docker event from provider
   */
  private handleDockerEvent(event: DockerEvent): void {
    // Update local state based on event
    switch (event.type) {
      case 'container':
        this.handleContainerEvent(event);
        break;
      case 'image':
        this.handleImageEvent(event);
        break;
      case 'network':
        this.handleNetworkEvent(event);
        break;
      case 'volume':
        this.handleVolumeEvent(event);
        break;
    }
  }

  private handleContainerEvent(event: DockerEvent): void {
    const containerId = event.actor.id;
    
    if (event.action === 'destroy' || event.action === 'die') {
      this.containers.delete(containerId);
    } else {
      // Refresh container from provider
      if (this.currentProvider) {
        this.currentProvider.getContainer(containerId).then(container => {
          if (container) {
            this.containers.set(containerId, container);
          }
        });
      }
    }
  }

  private handleImageEvent(event: DockerEvent): void {
    // Images are synced periodically, no immediate action needed
  }

  private handleNetworkEvent(event: DockerEvent): void {
    // Networks are synced periodically, no immediate action needed
  }

  private handleVolumeEvent(event: DockerEvent): void {
    // Volumes are synced periodically, no immediate action needed
  }

  /**
   * Обновляет конфигурацию (вызывается при изменении конфига в UI)
   */
  updateConfig(node: CanvasNode): void {
    const newConfig = (node.data.config || {}) as DockerConfig;
    const oldConfig = this.config;
    const oldMode = this.mode;
    this.config = newConfig;
    
    // Check if mode changed
    const newMode = newConfig.mode || 'simulation';
    if (newMode !== oldMode) {
      this.setMode(newMode);
    }
    
    // Sync containers: add new, update existing, remove deleted
    if (newConfig.containers) {
      const configContainerIds = new Set(newConfig.containers.map(c => c.id));
      
      // Remove containers that are no longer in config
      for (const [id, container] of this.containers.entries()) {
        if (!configContainerIds.has(id)) {
          this.containers.delete(id);
        }
      }
      
      // Add or update containers from config
      for (const container of newConfig.containers) {
        const existing = this.containers.get(container.id);
        if (existing) {
          // Update existing container (preserve runtime state like cpuUsage, memoryUsage if running)
          const updatedContainer: DockerContainer = {
            ...existing,
            // Update basic properties from config
            name: container.name,
            image: container.image,
            imageId: container.imageId,
            ports: container.ports,
            environment: container.environment,
            volumes: container.volumes,
            networks: container.networks,
            health: container.health,
            // Preserve runtime metrics if container is running
            cpuUsage: existing.status === 'running' ? existing.cpuUsage : container.cpuUsage,
            memoryUsage: existing.status === 'running' ? existing.memoryUsage : container.memoryUsage,
            memoryLimit: container.memoryLimit || existing.memoryLimit,
            networkRx: existing.status === 'running' ? existing.networkRx : container.networkRx,
            networkTx: existing.status === 'running' ? existing.networkTx : container.networkTx,
            // Update status if changed in config
            status: container.status || existing.status,
            // Preserve timestamps
            createdAt: container.createdAt || existing.createdAt,
            startedAt: container.startedAt || existing.startedAt,
            finishedAt: container.finishedAt || existing.finishedAt,
            restartCount: container.restartCount !== undefined ? container.restartCount : existing.restartCount,
            exitCode: container.exitCode !== undefined ? container.exitCode : existing.exitCode,
          };
          this.containers.set(container.id, updatedContainer);
        } else {
          // Add new container - convert from config format to DockerContainer
          const newContainer: DockerContainer = {
            id: container.id,
            name: container.name,
            image: container.image,
            imageId: container.imageId,
            status: (container.status as DockerContainer['status']) || 'created',
            createdAt: container.createdAt || Date.now(),
            startedAt: container.startedAt,
            finishedAt: container.finishedAt,
            restartCount: container.restartCount || 0,
            cpuUsage: container.cpuUsage,
            memoryUsage: container.memoryUsage,
            memoryLimit: container.memoryLimit,
            networkRx: container.networkRx,
            networkTx: container.networkTx,
            ports: container.ports,
            environment: container.environment,
            volumes: container.volumes,
            networks: container.networks,
            health: container.health,
            exitCode: container.exitCode,
          };
          this.containers.set(container.id, newContainer);
        }
      }
    }
    
    this.updateMetricsFromConfig();
  }

  /**
   * Обновляет метрики из конфигурации
   */
  private updateMetricsFromConfig(): void {
    if (!this.config) return;

    // Update container counts
    this.dockerMetrics.containersTotal = this.containers.size;
    this.dockerMetrics.containersRunning = Array.from(this.containers.values())
      .filter(c => c.status === 'running').length;
    this.dockerMetrics.containersStopped = Array.from(this.containers.values())
      .filter(c => c.status === 'exited' || c.status === 'dead').length;
    this.dockerMetrics.containersPaused = Array.from(this.containers.values())
      .filter(c => c.status === 'paused').length;

    // Update image counts
    this.dockerMetrics.imagesTotal = this.config.images?.length || 0;
    this.dockerMetrics.imagesSize = (this.config.images || [])
      .reduce((sum, img) => sum + img.size, 0);

    // Update network counts
    this.dockerMetrics.networksTotal = this.config.networks?.length || 0;

    // Update volume counts
    this.dockerMetrics.volumesTotal = this.config.volumes?.length || 0;
    this.dockerMetrics.volumesSize = (this.config.volumes || [])
      .reduce((sum, vol) => sum + (vol.size || 0), 0);
  }

  /**
   * Выполняет один цикл обновления Docker
   * Должен вызываться периодически в EmulationEngine
   */
  performUpdate(currentTime: number, hasIncomingConnections: boolean = false): void {
    if (!this.config) return;

    const deltaTime = currentTime - this.lastUpdateTime;
    this.lastUpdateTime = currentTime;

    // In real/hybrid mode, update stats from provider
    if (this.mode !== 'simulation' && this.currentProvider?.isConnected()) {
      this.updateContainerStatsFromProvider();
    }

    // Simulate container operations based on incoming connections (only in simulation mode)
    if (this.mode === 'simulation' && hasIncomingConnections) {
      this.simulateContainerOperations(currentTime);
    }

    // Simulate image operations (pull, push, build) - only in simulation mode
    if (this.mode === 'simulation') {
      this.simulateImageOperations(currentTime, hasIncomingConnections);
    }

    // Update container resource usage (CPU, memory, network)
    // In simulation mode, simulate; in real mode, use provider stats
    if (this.mode === 'simulation') {
      this.updateContainerResources(deltaTime);
    }

    // Update active operations
    this.updateActiveOperations(currentTime);

    // Update metrics
    this.updateMetrics(currentTime);
  }

  /**
   * Update container stats from provider
   */
  private async updateContainerStatsFromProvider(): Promise<void> {
    if (!this.currentProvider) return;

    const runningContainers = Array.from(this.containers.values())
      .filter(c => c.status === 'running');

    for (const container of runningContainers) {
      try {
        const stats = await this.currentProvider.getContainerStats(container.id);
        if (stats) {
          container.cpuUsage = stats.cpuUsage;
          container.memoryUsage = stats.memoryUsage;
          container.memoryLimit = stats.memoryLimit;
          container.networkRx = stats.networkRx;
          container.networkTx = stats.networkTx;
          
          // Update simulation provider if in hybrid mode
          if (this.mode === 'hybrid' && this.simulationProvider) {
            this.simulationProvider.updateContainerStats(container.id, stats);
          }
        }
      } catch (error) {
        console.error(`Failed to get stats for container ${container.id}:`, error);
      }
    }
  }

  /**
   * Симулирует операции с контейнерами
   */
  private simulateContainerOperations(currentTime: number): void {
    if (this.containers.size === 0) return;

    // Base operation rate: 0.1-1 ops/sec depending on number of containers
    const baseRate = Math.min(1, 0.1 + (this.containers.size / 20));
    
    // Randomly trigger container operations
    if (Math.random() < baseRate / 10) { // Divide by 10 because called ~10 times per second
      const containers = Array.from(this.containers.values());
      const container = containers[Math.floor(Math.random() * containers.length)];
      
      // Random operation type based on container status
      let operationType: DockerOperationType;
      if (container.status === 'running') {
        operationType = Math.random() < 0.1 ? 'stop' : 
                        Math.random() < 0.2 ? 'pause' : 
                        Math.random() < 0.3 ? 'restart' : 'create';
      } else if (container.status === 'exited' || container.status === 'dead') {
        operationType = Math.random() < 0.5 ? 'start' : 'create';
      } else if (container.status === 'paused') {
        operationType = Math.random() < 0.5 ? 'unpause' : 'stop';
      } else {
        operationType = 'create';
      }

      this.simulateContainerOperation(container.id, operationType, currentTime);
    }
  }

  /**
   * Симулирует операцию с контейнером
   */
  private simulateContainerOperation(containerId: string, operationType: DockerOperationType, currentTime: number): void {
    const container = this.containers.get(containerId);
    if (!container) return;

    const operationId = `${operationType}-${containerId}-${currentTime}-${Math.random()}`;
    let latency = 100; // Default 100ms

    switch (operationType) {
      case 'create':
        latency = 500 + Math.random() * 1000; // 500-1500ms
        break;
      case 'start':
        latency = 200 + Math.random() * 500; // 200-700ms
        break;
      case 'stop':
        latency = 100 + Math.random() * 300; // 100-400ms
        break;
      case 'pause':
        latency = 50 + Math.random() * 100; // 50-150ms
        break;
      case 'unpause':
        latency = 50 + Math.random() * 100; // 50-150ms
        break;
      case 'restart':
        latency = 300 + Math.random() * 700; // 300-1000ms
        break;
      case 'remove':
        latency = 200 + Math.random() * 400; // 200-600ms
        break;
    }

    const completionTime = currentTime + latency;

    const operation: DockerOperation = {
      id: operationId,
      type: operationType,
      containerId,
      startTime: currentTime,
      status: 'running',
      completionTime,
    };

    this.activeOperations.set(operationId, operation);
  }

  /**
   * Симулирует операции с образами
   */
  private simulateImageOperations(currentTime: number, hasIncomingConnections: boolean): void {
    if (!this.config?.images || this.config.images.length === 0) return;

    // Base operation rate: 0.05-0.5 ops/sec
    const baseRate = Math.min(0.5, 0.05 + (this.config.images.length / 50));
    
    if (hasIncomingConnections && Math.random() < baseRate / 10) {
      const image = this.config.images[Math.floor(Math.random() * this.config.images.length)];
      const operationType = Math.random() < 0.7 ? 'pull' : 
                            Math.random() < 0.9 ? 'build' : 'push';
      
      this.simulateImageOperation(image.id, operationType, currentTime);
    }
  }

  /**
   * Симулирует операцию с образом
   */
  private simulateImageOperation(imageId: string, operationType: DockerOperationType, currentTime: number): void {
    const operationId = `${operationType}-${imageId}-${currentTime}-${Math.random()}`;
    let latency = 1000; // Default 1s

    switch (operationType) {
      case 'pull':
        latency = 2000 + Math.random() * 8000; // 2-10 seconds
        break;
      case 'push':
        latency = 3000 + Math.random() * 10000; // 3-13 seconds
        break;
      case 'build':
        latency = 5000 + Math.random() * 15000; // 5-20 seconds
        break;
    }

    const completionTime = currentTime + latency;

    const operation: DockerOperation = {
      id: operationId,
      type: operationType,
      imageId,
      startTime: currentTime,
      status: 'running',
      completionTime,
    };

    this.activeOperations.set(operationId, operation);
  }

  /**
   * Обновляет использование ресурсов контейнерами
   */
  private updateContainerResources(deltaTime: number): void {
    const runningContainers = Array.from(this.containers.values())
      .filter(c => c.status === 'running');

    let totalCpu = 0;
    let totalMemory = 0;
    let totalMemoryLimit = 0;
    let totalNetworkRx = 0;
    let totalNetworkTx = 0;

    for (const container of runningContainers) {
      // Simulate CPU usage (5-80% with some variation)
      const baseCpu = 10 + Math.random() * 70;
      const variation = (Math.random() - 0.5) * 10;
      container.cpuUsage = Math.max(0, Math.min(100, baseCpu + variation));

      // Simulate memory usage (grow over time, but within limits)
      const memoryLimit = container.memoryLimit || 512 * 1024 * 1024; // Default 512MB
      container.memoryLimit = memoryLimit;
      
      if (!container.memoryUsage) {
        container.memoryUsage = memoryLimit * 0.3; // Start at 30%
      } else {
        // Gradually increase memory usage with some randomness
        const growthRate = 1 + (Math.random() - 0.4) * 0.1; // 0.96-1.04
        container.memoryUsage = Math.min(memoryLimit * 0.95, container.memoryUsage * growthRate);
      }

      // Simulate network I/O (bytes per second)
      const networkRate = 1000 + Math.random() * 9000; // 1-10 KB/s
      const bytesDelta = (networkRate * deltaTime) / 1000;
      container.networkRx = (container.networkRx || 0) + bytesDelta;
      container.networkTx = (container.networkTx || 0) + bytesDelta * 0.8; // TX slightly less

      totalCpu += container.cpuUsage;
      totalMemory += container.memoryUsage;
      totalMemoryLimit += memoryLimit;
      totalNetworkRx += container.networkRx || 0;
      totalNetworkTx += container.networkTx || 0;
    }

    this.dockerMetrics.totalCpuUsage = runningContainers.length > 0 
      ? totalCpu / runningContainers.length 
      : 0;
    this.dockerMetrics.totalMemoryUsage = totalMemory;
    this.dockerMetrics.totalMemoryLimit = totalMemoryLimit;
    this.dockerMetrics.totalNetworkRx = totalNetworkRx;
    this.dockerMetrics.totalNetworkTx = totalNetworkTx;
  }

  /**
   * Обновляет активные операции и завершает те, которые должны быть завершены
   */
  private updateActiveOperations(currentTime: number): void {
    const operationsToComplete: DockerOperation[] = [];

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
  private completeOperation(operation: DockerOperation, currentTime: number): void {
    const duration = operation.completionTime ? operation.completionTime - operation.startTime : 0;
    operation.status = 'completed';
    operation.duration = duration;
    this.activeOperations.delete(operation.id);
    this.addOperationToHistory(operation);

    // Handle operation-specific completion logic
    switch (operation.type) {
      case 'create':
      case 'start':
        if (operation.containerId) {
          const container = this.containers.get(operation.containerId);
          if (container) {
            container.status = 'running';
            container.startedAt = currentTime;
            container.restartCount = container.restartCount || 0;
          }
        }
        break;

      case 'stop':
        if (operation.containerId) {
          const container = this.containers.get(operation.containerId);
          if (container) {
            container.status = 'exited';
            container.finishedAt = currentTime;
            container.cpuUsage = 0;
            container.memoryUsage = 0;
          }
        }
        break;

      case 'pause':
        if (operation.containerId) {
          const container = this.containers.get(operation.containerId);
          if (container) {
            container.status = 'paused';
          }
        }
        break;

      case 'unpause':
        if (operation.containerId) {
          const container = this.containers.get(operation.containerId);
          if (container) {
            container.status = 'running';
          }
        }
        break;

      case 'restart':
        if (operation.containerId) {
          const container = this.containers.get(operation.containerId);
          if (container) {
            container.status = 'running';
            container.startedAt = currentTime;
            container.restartCount = (container.restartCount || 0) + 1;
          }
        }
        break;

      case 'remove':
        if (operation.containerId) {
          this.containers.delete(operation.containerId);
        }
        break;

      case 'pull':
      case 'push':
      case 'build':
        // Image operations don't change container state
        break;
    }

    // Add latency to history
    if (duration > 0) {
      this.operationLatencyHistory.push(duration);
      if (this.operationLatencyHistory.length > this.MAX_LATENCY_HISTORY) {
        this.operationLatencyHistory.shift();
      }
    }
  }

  /**
   * Добавляет операцию в историю
   */
  private addOperationToHistory(operation: DockerOperation): void {
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

    this.dockerMetrics.operationsPerSecond = recentOperations.length / 10;
    this.dockerMetrics.buildOperationsPerSecond = 
      recentOperations.filter(op => op.type === 'build').length / 10;
    this.dockerMetrics.pullOperationsPerSecond = 
      recentOperations.filter(op => op.type === 'pull').length / 10;
    this.dockerMetrics.pushOperationsPerSecond = 
      recentOperations.filter(op => op.type === 'push').length / 10;

    // Calculate average latency
    if (this.operationLatencyHistory.length > 0) {
      this.dockerMetrics.averageOperationLatency = 
        this.operationLatencyHistory.reduce((a, b) => a + b, 0) / this.operationLatencyHistory.length;
    }

    // Update config-based metrics
    this.updateMetricsFromConfig();
  }

  /**
   * Вычисляет нагрузку для компонентных метрик
   */
  calculateLoad(): DockerLoad {
    const totalOpsPerSecond = this.dockerMetrics.operationsPerSecond;

    const averageLatency = this.dockerMetrics.averageOperationLatency;

    // Calculate error rate (failed operations)
    const recentFailedOps = this.operationHistory
      .filter(op => op.status === 'failed')
      .length;
    const errorRate = Math.min(1, recentFailedOps / Math.max(1, this.operationHistory.length));

    // Calculate utilization based on containers and operations
    const cpuUtilization = Math.min(0.95, this.dockerMetrics.totalCpuUsage / 100);
    const memoryUtilization = this.dockerMetrics.totalMemoryLimit > 0
      ? Math.min(0.95, this.dockerMetrics.totalMemoryUsage / this.dockerMetrics.totalMemoryLimit)
      : 0.1;
    
    // Network utilization (based on network I/O)
    const networkBandwidth = 1000 * 1024 * 1024; // Assume 1 Gbps
    const networkUtilization = Math.min(0.95, 
      ((this.dockerMetrics.totalNetworkRx + this.dockerMetrics.totalNetworkTx) / networkBandwidth) * 8
    );

    // Disk utilization (based on images and volumes)
    const diskTotal = 100 * 1024 * 1024 * 1024; // Assume 100 GB
    const diskUsed = this.dockerMetrics.imagesSize + this.dockerMetrics.volumesSize;
    const diskUtilization = Math.min(0.95, diskUsed / diskTotal);

    return {
      throughput: totalOpsPerSecond,
      averageLatency: averageLatency || 0,
      errorRate,
      cpuUtilization,
      memoryUtilization,
      networkUtilization,
      diskUtilization,
    };
  }

  /**
   * Получает метрики Docker
   */
  getMetrics(): DockerMetrics {
    return { ...this.dockerMetrics };
  }

  /**
   * Получает конфигурацию
   */
  getConfig(): DockerConfig | null {
    return this.config ? { ...this.config } : null;
  }

  /**
   * Получает все контейнеры
   */
  getContainers(): DockerContainer[] {
    return Array.from(this.containers.values());
  }

  /**
   * Получает контейнер по ID
   */
  getContainer(containerId: string): DockerContainer | undefined {
    return this.containers.get(containerId);
  }

  /**
   * Получает все образы
   */
  getImages(): DockerImage[] {
    return this.config?.images || [];
  }

  /**
   * Получает все сети
   */
  getNetworks(): DockerNetwork[] {
    return this.config?.networks || [];
  }

  /**
   * Получает все тома
   */
  getVolumes(): DockerVolume[] {
    return this.config?.volumes || [];
  }

  /**
   * Get current provider
   */
  getProvider(): IDockerProvider | null {
    return this.currentProvider;
  }

  /**
   * Test connection to Docker daemon
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.currentProvider) {
      return { success: false, error: 'No provider available' };
    }
    return await this.currentProvider.testConnection();
  }

  /**
   * Connect to Docker daemon
   */
  async connect(): Promise<boolean> {
    if (!this.currentProvider) {
      return false;
    }
    const connected = await this.currentProvider.connect();
    if (connected && this.config?.syncSettings?.enabled) {
      this.startSync();
    }
    return connected;
  }

  /**
   * Disconnect from Docker daemon
   */
  async disconnect(): Promise<void> {
    this.stopSync();
    if (this.currentProvider) {
      await this.currentProvider.disconnect();
    }
  }

  /**
   * Check if connected to Docker daemon
   */
  isConnected(): boolean {
    return this.currentProvider?.isConnected() || false;
  }

  /**
   * Create container via provider
   */
  async createContainerViaProvider(config: {
    name?: string;
    image: string;
    command?: string[];
    env?: Record<string, string>;
    ports?: Array<{ containerPort: number; hostPort?: number; protocol?: 'tcp' | 'udp' }>;
    volumes?: string[];
    networks?: string[];
    memoryLimit?: number;
    cpuLimit?: string;
  }): Promise<DockerContainer> {
    if (!this.currentProvider) {
      throw new Error('No provider available');
    }

    const containerCreateConfig = {
      name: config.name,
      image: config.image,
      command: config.command,
      env: config.env,
      ports: config.ports,
      volumes: config.volumes,
      networks: config.networks,
      memoryLimit: config.memoryLimit,
      cpuLimit: config.cpuLimit,
    };

    const container = await this.currentProvider.createContainer(containerCreateConfig);
    this.containers.set(container.id, container);
    
    if (this.config) {
      this.config.containers = Array.from(this.containers.values());
    }

    return container;
  }

  /**
   * Start container via provider
   */
  async startContainerViaProvider(id: string): Promise<void> {
    if (!this.currentProvider) {
      throw new Error('No provider available');
    }

    await this.currentProvider.startContainer(id);
    const container = this.containers.get(id);
    if (container) {
      container.status = 'running';
      container.startedAt = Date.now();
    }
  }

  /**
   * Stop container via provider
   */
  async stopContainerViaProvider(id: string): Promise<void> {
    if (!this.currentProvider) {
      throw new Error('No provider available');
    }

    await this.currentProvider.stopContainer(id);
    const container = this.containers.get(id);
    if (container) {
      container.status = 'exited';
      container.finishedAt = Date.now();
    }
  }

  /**
   * Remove container via provider
   */
  async removeContainerViaProvider(id: string, force: boolean = false): Promise<void> {
    if (!this.currentProvider) {
      throw new Error('No provider available');
    }

    await this.currentProvider.removeContainer(id, force);
    this.containers.delete(id);
    
    if (this.config) {
      this.config.containers = Array.from(this.containers.values());
    }
  }

  /**
   * Pull image via provider
   */
  async pullImageViaProvider(repository: string, tag: string = 'latest'): Promise<DockerImage> {
    if (!this.currentProvider) {
      throw new Error('No provider available');
    }

    const image = await this.currentProvider.pullImage(repository, tag);
    
    if (this.config) {
      if (!this.config.images) {
        this.config.images = [];
      }
      const existingIndex = this.config.images.findIndex(img => img.id === image.id);
      if (existingIndex >= 0) {
        this.config.images[existingIndex] = image;
      } else {
        this.config.images.push(image);
      }
    }

    return image;
  }

  /**
   * Get system info from provider
   */
  async getSystemInfo(): Promise<import('./docker/IDockerProvider').DockerSystemInfo | null> {
    if (!this.currentProvider) {
      return null;
    }
    return await this.currentProvider.getSystemInfo();
  }
}


import { IDockerProvider, ContainerStats, DockerSystemInfo, DockerEvent, ContainerCreateConfig, BuildImageConfig, NetworkCreateConfig, VolumeCreateConfig } from './IDockerProvider';
import { DockerContainer, DockerImage, DockerNetwork, DockerVolume } from '../DockerEmulationEngine';

/**
 * Docker Connection Configuration
 */
export interface DockerConnectionConfig {
  type: 'local' | 'remote';
  url?: string; // unix:///var/run/docker.sock or tcp://host:port
  host?: string;
  port?: number;
  useTLS?: boolean;
  caCert?: string;
  clientCert?: string;
  clientKey?: string;
  timeout?: number; // ms
}

/**
 * Docker API Adapter
 * Connects to real Docker daemon via HTTP API
 * 
 * Note: In browser environment, this requires a backend proxy to access Docker daemon
 * For now, this is a placeholder that can be extended with actual HTTP client
 */
export class DockerAPIAdapter implements IDockerProvider {
  private config: DockerConnectionConfig;
  private connected: boolean = false;
  private eventSubscribers: Set<(event: DockerEvent) => void> = new Set();
  private eventStream: EventSource | null = null;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private reconnectTimeout: number = 3000; // 3 seconds

  constructor(config: DockerConnectionConfig) {
    this.config = config;
  }

  /**
   * Get Docker API base URL
   */
  private getBaseUrl(): string {
    if (this.config.type === 'local') {
      // For local socket, we need a proxy endpoint
      // In production, this would be handled by a backend service
      return '/api/docker';
    } else {
      // For remote TCP
      const protocol = this.config.useTLS ? 'https' : 'http';
      const host = this.config.host || 'localhost';
      const port = this.config.port || 2376;
      return `${protocol}://${host}:${port}`;
    }
  }

  /**
   * Make HTTP request to Docker API
   */
  private async request<T>(
    method: string,
    path: string,
    body?: any,
    options?: { timeout?: number }
  ): Promise<T> {
    const url = `${this.getBaseUrl()}${path}`;
    const timeout = options?.timeout || this.config.timeout || 30000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add TLS certificates if provided
      if (this.config.useTLS && this.config.clientCert && this.config.clientKey) {
        // In browser, certificates are handled by the backend proxy
        headers['X-Client-Cert'] = this.config.clientCert;
        headers['X-Client-Key'] = this.config.clientKey;
      }

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Docker API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return {} as T;
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Connect to Docker daemon
   */
  async connect(): Promise<boolean> {
    try {
      const info = await this.getSystemInfo();
      if (info) {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.startEventStream();
        return true;
      }
      return false;
    } catch (error) {
      this.connected = false;
      console.error('Failed to connect to Docker daemon:', error);
      return false;
    }
  }

  /**
   * Disconnect from Docker daemon
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    this.stopEventStream();
    this.eventSubscribers.clear();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const info = await this.getSystemInfo();
      return { success: !!info };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Start Docker Events stream
   */
  private startEventStream(): void {
    if (this.eventSubscribers.size === 0) return;

    try {
      const url = `${this.getBaseUrl()}/events`;
      // In browser, use EventSource or fetch with streaming
      // For now, we'll use polling as fallback
      this.pollEvents();
    } catch (error) {
      console.error('Failed to start event stream:', error);
    }
  }

  /**
   * Stop Docker Events stream
   */
  private stopEventStream(): void {
    if (this.eventStream) {
      this.eventStream.close();
      this.eventStream = null;
    }
  }

  /**
   * Poll for events (fallback when EventSource not available)
   */
  private async pollEvents(): Promise<void> {
    // This would be implemented with periodic polling
    // For now, it's a placeholder
  }

  /**
   * List containers
   */
  async listContainers(): Promise<DockerContainer[]> {
    const response = await this.request<any[]>('GET', '/containers/json?all=true');
    return response.map(this.mapContainerFromAPI);
  }

  /**
   * Get container by ID
   */
  async getContainer(id: string): Promise<DockerContainer | null> {
    try {
      const response = await this.request<any>('GET', `/containers/${id}/json`);
      return this.mapContainerFromAPI(response);
    } catch (error: any) {
      if (error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create container
   */
  async createContainer(config: ContainerCreateConfig): Promise<DockerContainer> {
    const apiConfig = this.mapContainerConfigToAPI(config);
    const response = await this.request<{ Id: string }>('POST', '/containers/create', apiConfig);
    return await this.getContainer(response.Id) || this.createContainerFromConfig(config, response.Id);
  }

  /**
   * Start container
   */
  async startContainer(id: string): Promise<void> {
    await this.request('POST', `/containers/${id}/start`);
  }

  /**
   * Stop container
   */
  async stopContainer(id: string): Promise<void> {
    await this.request('POST', `/containers/${id}/stop`);
  }

  /**
   * Pause container
   */
  async pauseContainer(id: string): Promise<void> {
    await this.request('POST', `/containers/${id}/pause`);
  }

  /**
   * Unpause container
   */
  async unpauseContainer(id: string): Promise<void> {
    await this.request('POST', `/containers/${id}/unpause`);
  }

  /**
   * Restart container
   */
  async restartContainer(id: string): Promise<void> {
    await this.request('POST', `/containers/${id}/restart`);
  }

  /**
   * Remove container
   */
  async removeContainer(id: string, force: boolean = false): Promise<void> {
    await this.request('DELETE', `/containers/${id}?force=${force}`);
  }

  /**
   * List images
   */
  async listImages(): Promise<DockerImage[]> {
    const response = await this.request<any[]>('GET', '/images/json');
    return response.map(this.mapImageFromAPI);
  }

  /**
   * Pull image
   */
  async pullImage(repository: string, tag: string = 'latest'): Promise<DockerImage> {
    // Pull is a long-running operation, would need streaming
    await this.request('POST', `/images/create?fromImage=${repository}&tag=${tag}`);
    // After pull, get the image
    const images = await this.listImages();
    const image = images.find(img => 
      img.repository === repository && img.tag === tag
    );
    if (!image) {
      throw new Error(`Failed to find pulled image ${repository}:${tag}`);
    }
    return image;
  }

  /**
   * Build image
   */
  async buildImage(config: BuildImageConfig): Promise<DockerImage> {
    // Build is a long-running operation, would need streaming
    // This is a simplified version
    throw new Error('Build image not fully implemented - requires streaming support');
  }

  /**
   * Remove image
   */
  async removeImage(id: string, force: boolean = false): Promise<void> {
    await this.request('DELETE', `/images/${id}?force=${force}`);
  }

  /**
   * List networks
   */
  async listNetworks(): Promise<DockerNetwork[]> {
    const response = await this.request<any[]>('GET', '/networks');
    return response.map(this.mapNetworkFromAPI);
  }

  /**
   * Create network
   */
  async createNetwork(config: NetworkCreateConfig): Promise<DockerNetwork> {
    const apiConfig = this.mapNetworkConfigToAPI(config);
    const response = await this.request<{ Id: string }>('POST', '/networks/create', apiConfig);
    const networks = await this.listNetworks();
    const network = networks.find(n => n.id === response.Id);
    if (!network) {
      throw new Error(`Failed to find created network ${response.Id}`);
    }
    return network;
  }

  /**
   * Remove network
   */
  async removeNetwork(id: string): Promise<void> {
    await this.request('DELETE', `/networks/${id}`);
  }

  /**
   * List volumes
   */
  async listVolumes(): Promise<DockerVolume[]> {
    const response = await this.request<{ Volumes: any[] }>('GET', '/volumes');
    return response.Volumes.map(this.mapVolumeFromAPI);
  }

  /**
   * Create volume
   */
  async createVolume(config: VolumeCreateConfig): Promise<DockerVolume> {
    const apiConfig = this.mapVolumeConfigToAPI(config);
    const response = await this.request<{ Name: string }>('POST', '/volumes/create', apiConfig);
    const volumes = await this.listVolumes();
    const volume = volumes.find(v => v.name === response.Name);
    if (!volume) {
      throw new Error(`Failed to find created volume ${response.Name}`);
    }
    return volume;
  }

  /**
   * Remove volume
   */
  async removeVolume(id: string): Promise<void> {
    await this.request('DELETE', `/volumes/${id}`);
  }

  /**
   * Get container stats
   */
  async getContainerStats(id: string): Promise<ContainerStats | null> {
    try {
      const response = await this.request<any>('GET', `/containers/${id}/stats?stream=false`);
      return this.mapStatsFromAPI(response, id);
    } catch (error: any) {
      if (error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get system info
   */
  async getSystemInfo(): Promise<DockerSystemInfo | null> {
    try {
      const info = await this.request<any>('GET', '/info');
      const version = await this.request<any>('GET', '/version');
      return this.mapSystemInfoFromAPI(info, version);
    } catch (error) {
      console.error('Failed to get system info:', error);
      return null;
    }
  }

  /**
   * Subscribe to Docker events
   */
  subscribeToEvents(callback: (event: DockerEvent) => void): () => void {
    this.eventSubscribers.add(callback);
    if (this.connected && !this.eventStream) {
      this.startEventStream();
    }
    return () => {
      this.eventSubscribers.delete(callback);
      if (this.eventSubscribers.size === 0) {
        this.stopEventStream();
      }
    };
  }

  // Mapping functions from Docker API format to our format

  private mapContainerFromAPI(api: any): DockerContainer {
    const names = api.Names || [];
    const name = names[0]?.replace(/^\//, '') || api.Id?.substring(0, 12) || 'unknown';
    
    return {
      id: api.Id || api.ID || '',
      name,
      image: api.Image || '',
      imageId: api.ImageID || '',
      status: this.mapContainerStatus(api.Status || api.State || 'unknown'),
      createdAt: api.Created ? new Date(api.Created).getTime() : Date.now(),
      startedAt: api.StartedAt ? new Date(api.StartedAt).getTime() : undefined,
      finishedAt: api.FinishedAt ? new Date(api.FinishedAt).getTime() : undefined,
      restartCount: api.RestartCount || 0,
      ports: this.mapPortsFromAPI(api.Ports),
      environment: api.Env ? this.parseEnvVars(api.Env) : undefined,
      volumes: api.Mounts ? api.Mounts.map((m: any) => m.Name || m.Source) : undefined,
      networks: api.NetworkSettings ? Object.keys(api.NetworkSettings.Networks || {}) : undefined,
      health: this.mapHealthStatus(api.Health),
    };
  }

  private mapContainerStatus(status: string): DockerContainer['status'] {
    const lower = status.toLowerCase();
    if (lower.includes('running')) return 'running';
    if (lower.includes('paused')) return 'paused';
    if (lower.includes('restarting')) return 'restarting';
    if (lower.includes('removing')) return 'removing';
    if (lower.includes('exited') || lower.includes('stopped')) return 'exited';
    if (lower.includes('dead')) return 'dead';
    return 'created';
  }

  private mapPortsFromAPI(ports: any[]): DockerContainer['ports'] {
    if (!ports) return undefined;
    return ports.map(p => ({
      containerPort: p.PrivatePort || p.ContainerPort || 0,
      hostPort: p.PublicPort || p.HostPort,
      protocol: (p.Type || 'tcp').toLowerCase() as 'tcp' | 'udp',
    }));
  }

  private parseEnvVars(env: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const e of env) {
      const [key, ...valueParts] = e.split('=');
      if (key) {
        result[key] = valueParts.join('=');
      }
    }
    return result;
  }

  private mapHealthStatus(health: any): DockerContainer['health'] {
    if (!health) return 'none';
    const status = health.Status || health.status || '';
    if (status === 'healthy') return 'healthy';
    if (status === 'unhealthy') return 'unhealthy';
    if (status === 'starting') return 'starting';
    return 'none';
  }

  private mapImageFromAPI(api: any): DockerImage {
    const repoTag = (api.RepoTags && api.RepoTags[0]) || '<none>:<none>';
    const [repository, tag] = repoTag.split(':');
    
    return {
      id: api.Id || api.ID || '',
      repository: repository || '<none>',
      tag: tag || 'latest',
      digest: api.RepoDigests?.[0]?.split('@')[1],
      size: api.Size || 0,
      createdAt: api.Created ? new Date(api.Created * 1000).getTime() : Date.now(),
      layers: api.Layers?.length,
    };
  }

  private mapNetworkFromAPI(api: any): DockerNetwork {
    return {
      id: api.Id || api.ID || '',
      name: api.Name || '',
      driver: (api.Driver || 'bridge') as DockerNetwork['driver'],
      scope: (api.Scope || 'local') as DockerNetwork['scope'],
      subnet: api.IPAM?.Config?.[0]?.Subnet,
      gateway: api.IPAM?.Config?.[0]?.Gateway,
      containers: api.Containers ? Object.keys(api.Containers) : undefined,
      created: api.Created ? new Date(api.Created).getTime() : Date.now(),
      internal: api.Internal || false,
      enableIPv6: api.EnableIPv6 || false,
    };
  }

  private mapVolumeFromAPI(api: any): DockerVolume {
    return {
      id: api.Name || api.Driver || '',
      name: api.Name || '',
      driver: (api.Driver || 'local') as DockerVolume['driver'],
      mountpoint: api.Mountpoint,
      size: api.UsageData?.Size,
      usedBy: api.UsageData?.RefCount ? [api.UsageData.RefCount] : undefined,
      created: api.CreatedAt ? new Date(api.CreatedAt).getTime() : Date.now(),
      labels: api.Labels,
    };
  }

  private mapStatsFromAPI(api: any, containerId: string): ContainerStats {
    const cpuDelta = api.cpu_stats?.cpu_usage?.total_usage - (api.precpu_stats?.cpu_usage?.total_usage || 0);
    const systemDelta = api.cpu_stats?.system_cpu_usage - (api.precpu_stats?.system_cpu_usage || 0);
    const numCpus = api.cpu_stats?.online_cpus || 1;
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * numCpus * 100 : 0;

    const memoryUsage = api.memory_stats?.usage || 0;
    const memoryLimit = api.memory_stats?.limit || 0;

    const networkRx = api.networks ? Object.values(api.networks).reduce((sum: number, net: any) => sum + (net.rx_bytes || 0), 0) : 0;
    const networkTx = api.networks ? Object.values(api.networks).reduce((sum: number, net: any) => sum + (net.tx_bytes || 0), 0) : 0;

    return {
      id: containerId,
      name: api.name || '',
      cpuUsage: Math.min(100, Math.max(0, cpuPercent)),
      memoryUsage,
      memoryLimit,
      networkRx,
      networkTx,
      timestamp: Date.now(),
    };
  }

  private mapSystemInfoFromAPI(info: any, version: any): DockerSystemInfo {
    return {
      version: version.Version || 'unknown',
      apiVersion: version.ApiVersion || 'unknown',
      os: info.OperatingSystem || 'unknown',
      arch: info.Architecture || 'unknown',
      kernelVersion: info.KernelVersion || 'unknown',
      totalMemory: info.MemTotal || 0,
      totalCpus: info.NCPU || 0,
      containers: info.Containers || 0,
      containersRunning: info.ContainersRunning || 0,
      containersPaused: info.ContainersPaused || 0,
      containersStopped: info.ContainersStopped || 0,
      images: info.Images || 0,
      imagesSize: 0, // Would need to calculate from images list
    };
  }

  private mapContainerConfigToAPI(config: ContainerCreateConfig): any {
    const apiConfig: any = {
      Image: config.image,
      Cmd: config.command,
      Env: config.env ? Object.entries(config.env).map(([k, v]) => `${k}=${v}`) : undefined,
      HostConfig: {},
    };

    if (config.ports) {
      apiConfig.ExposedPorts = {};
      apiConfig.HostConfig.PortBindings = {};
      for (const port of config.ports) {
        const key = `${port.containerPort}/${port.protocol || 'tcp'}`;
        apiConfig.ExposedPorts[key] = {};
        if (port.hostPort) {
          apiConfig.HostConfig.PortBindings[key] = [{ HostPort: port.hostPort.toString() }];
        }
      }
    }

    if (config.volumes) {
      apiConfig.Volumes = {};
      apiConfig.HostConfig.Binds = config.volumes;
    }

    if (config.memoryLimit) {
      apiConfig.HostConfig.Memory = config.memoryLimit;
    }

    if (config.cpuLimit) {
      // Convert CPU limit to nano CPUs
      const cpuLimit = parseFloat(config.cpuLimit);
      if (!isNaN(cpuLimit)) {
        apiConfig.HostConfig.CpuQuota = Math.floor(cpuLimit * 100000);
        apiConfig.HostConfig.CpuPeriod = 100000;
      }
    }

    if (config.restartPolicy) {
      apiConfig.HostConfig.RestartPolicy = { Name: config.restartPolicy };
    }

    if (config.healthCheck) {
      apiConfig.Healthcheck = {
        Test: config.healthCheck.test,
        Interval: config.healthCheck.interval || 30000000000, // nanoseconds
        Timeout: config.healthCheck.timeout || 5000000000,
        Retries: config.healthCheck.retries || 3,
        StartPeriod: config.healthCheck.startPeriod || 0,
      };
    }

    return apiConfig;
  }

  private createContainerFromConfig(config: ContainerCreateConfig, id: string): DockerContainer {
    return {
      id,
      name: config.name || id.substring(0, 12),
      image: config.image,
      imageId: '',
      status: 'created',
      createdAt: Date.now(),
      restartCount: 0,
      ports: config.ports,
      environment: config.env,
      volumes: config.volumes,
      networks: config.networks,
      health: 'none',
    };
  }

  private mapNetworkConfigToAPI(config: NetworkCreateConfig): any {
    return {
      Name: config.name,
      Driver: config.driver || 'bridge',
      IPAM: config.subnet || config.gateway ? {
        Config: [{
          Subnet: config.subnet,
          Gateway: config.gateway,
        }],
      } : undefined,
      Internal: config.internal || false,
      EnableIPv6: config.enableIPv6 || false,
      Labels: config.labels,
    };
  }

  private mapVolumeConfigToAPI(config: VolumeCreateConfig): any {
    return {
      Name: config.name,
      Driver: config.driver || 'local',
      Labels: config.labels,
      DriverOpts: config.options,
    };
  }
}


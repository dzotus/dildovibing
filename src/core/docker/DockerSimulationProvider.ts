import { IDockerProvider, ContainerStats, DockerSystemInfo, DockerEvent, ContainerCreateConfig, BuildImageConfig, NetworkCreateConfig, VolumeCreateConfig } from './IDockerProvider';
import { DockerContainer, DockerImage, DockerNetwork, DockerVolume } from '../DockerEmulationEngine';

/**
 * Docker Simulation Provider
 * Implements IDockerProvider interface for simulation mode
 * Uses the existing DockerEmulationEngine logic
 */
export class DockerSimulationProvider implements IDockerProvider {
  private containers: Map<string, DockerContainer> = new Map();
  private images: Map<string, DockerImage> = new Map();
  private networks: Map<string, DockerNetwork> = new Map();
  private volumes: Map<string, DockerVolume> = new Map();
  private eventSubscribers: Set<(event: DockerEvent) => void> = new Set();
  private statsCache: Map<string, ContainerStats> = new Map();
  private systemInfo: DockerSystemInfo | null = null;

  constructor(
    initialContainers?: DockerContainer[],
    initialImages?: DockerImage[],
    initialNetworks?: DockerNetwork[],
    initialVolumes?: DockerVolume[]
  ) {
    // Initialize with provided data
    if (initialContainers) {
      for (const container of initialContainers) {
        this.containers.set(container.id, { ...container });
      }
    }
    if (initialImages) {
      for (const image of initialImages) {
        this.images.set(image.id, { ...image });
      }
    }
    if (initialNetworks) {
      for (const network of initialNetworks) {
        this.networks.set(network.id, { ...network });
      }
    }
    if (initialVolumes) {
      for (const volume of initialVolumes) {
        this.volumes.set(volume.id, { ...volume });
      }
    }

    // Initialize system info
    this.systemInfo = {
      version: '24.0.0',
      apiVersion: '1.43',
      os: 'linux',
      arch: 'amd64',
      kernelVersion: '5.15.0',
      totalMemory: 16 * 1024 * 1024 * 1024, // 16 GB
      totalCpus: 8,
      containers: this.containers.size,
      containersRunning: Array.from(this.containers.values()).filter(c => c.status === 'running').length,
      containersPaused: Array.from(this.containers.values()).filter(c => c.status === 'paused').length,
      containersStopped: Array.from(this.containers.values()).filter(c => c.status === 'exited' || c.status === 'dead').length,
      images: this.images.size,
      imagesSize: Array.from(this.images.values()).reduce((sum, img) => sum + img.size, 0),
    };
  }

  async connect(): Promise<boolean> {
    return true; // Always connected in simulation
  }

  async disconnect(): Promise<void> {
    this.eventSubscribers.clear();
  }

  isConnected(): boolean {
    return true;
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  async listContainers(): Promise<DockerContainer[]> {
    return Array.from(this.containers.values());
  }

  async getContainer(id: string): Promise<DockerContainer | null> {
    return this.containers.get(id) || null;
  }

  async createContainer(config: ContainerCreateConfig): Promise<DockerContainer> {
    const id = `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const container: DockerContainer = {
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
      memoryLimit: config.memoryLimit,
    };
    this.containers.set(id, container);
    this.emitEvent('container', 'create', id, {});
    return container;
  }

  async startContainer(id: string): Promise<void> {
    const container = this.containers.get(id);
    if (!container) throw new Error(`Container ${id} not found`);
    container.status = 'running';
    container.startedAt = Date.now();
    this.emitEvent('container', 'start', id, {});
  }

  async stopContainer(id: string): Promise<void> {
    const container = this.containers.get(id);
    if (!container) throw new Error(`Container ${id} not found`);
    container.status = 'exited';
    container.finishedAt = Date.now();
    container.cpuUsage = 0;
    container.memoryUsage = 0;
    this.emitEvent('container', 'stop', id, {});
  }

  async pauseContainer(id: string): Promise<void> {
    const container = this.containers.get(id);
    if (!container) throw new Error(`Container ${id} not found`);
    container.status = 'paused';
    this.emitEvent('container', 'pause', id, {});
  }

  async unpauseContainer(id: string): Promise<void> {
    const container = this.containers.get(id);
    if (!container) throw new Error(`Container ${id} not found`);
    container.status = 'running';
    this.emitEvent('container', 'unpause', id, {});
  }

  async restartContainer(id: string): Promise<void> {
    const container = this.containers.get(id);
    if (!container) throw new Error(`Container ${id} not found`);
    container.status = 'running';
    container.startedAt = Date.now();
    container.restartCount = (container.restartCount || 0) + 1;
    this.emitEvent('container', 'restart', id, {});
  }

  async removeContainer(id: string, force: boolean = false): Promise<void> {
    const container = this.containers.get(id);
    if (!container) throw new Error(`Container ${id} not found`);
    if (container.status === 'running' && !force) {
      throw new Error('Cannot remove running container without force');
    }
    this.containers.delete(id);
    this.statsCache.delete(id);
    this.emitEvent('container', 'destroy', id, {});
  }

  async listImages(): Promise<DockerImage[]> {
    return Array.from(this.images.values());
  }

  async pullImage(repository: string, tag: string = 'latest'): Promise<DockerImage> {
    // Simulate pull delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const id = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const image: DockerImage = {
      id,
      repository,
      tag,
      size: 100 * 1024 * 1024 + Math.random() * 500 * 1024 * 1024, // 100-600 MB
      createdAt: Date.now(),
      pulledAt: Date.now(),
    };
    this.images.set(id, image);
    this.emitEvent('image', 'pull', id, { repository, tag });
    return image;
  }

  async buildImage(config: BuildImageConfig): Promise<DockerImage> {
    // Simulate build delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const id = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const [repository, tag] = config.tag.split(':');
    const image: DockerImage = {
      id,
      repository: repository || config.tag,
      tag: tag || 'latest',
      size: 200 * 1024 * 1024 + Math.random() * 800 * 1024 * 1024, // 200-1000 MB
      createdAt: Date.now(),
      builtAt: Date.now(),
    };
    this.images.set(id, image);
    this.emitEvent('image', 'build', id, { tag: config.tag });
    return image;
  }

  async removeImage(id: string, force: boolean = false): Promise<void> {
    const image = this.images.get(id);
    if (!image) throw new Error(`Image ${id} not found`);
    this.images.delete(id);
    this.emitEvent('image', 'delete', id, {});
  }

  async listNetworks(): Promise<DockerNetwork[]> {
    return Array.from(this.networks.values());
  }

  async createNetwork(config: NetworkCreateConfig): Promise<DockerNetwork> {
    const id = `net-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const network: DockerNetwork = {
      id,
      name: config.name,
      driver: config.driver || 'bridge',
      scope: 'local',
      subnet: config.subnet,
      gateway: config.gateway,
      created: Date.now(),
      internal: config.internal || false,
      enableIPv6: config.enableIPv6 || false,
    };
    this.networks.set(id, network);
    this.emitEvent('network', 'create', id, { name: config.name });
    return network;
  }

  async removeNetwork(id: string): Promise<void> {
    const network = this.networks.get(id);
    if (!network) throw new Error(`Network ${id} not found`);
    this.networks.delete(id);
    this.emitEvent('network', 'destroy', id, {});
  }

  async listVolumes(): Promise<DockerVolume[]> {
    return Array.from(this.volumes.values());
  }

  async createVolume(config: VolumeCreateConfig): Promise<DockerVolume> {
    const id = `vol-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const volume: DockerVolume = {
      id,
      name: config.name,
      driver: config.driver || 'local',
      created: Date.now(),
      labels: config.labels,
    };
    this.volumes.set(id, volume);
    this.emitEvent('volume', 'create', id, { name: config.name });
    return volume;
  }

  async removeVolume(id: string): Promise<void> {
    const volume = this.volumes.get(id);
    if (!volume) throw new Error(`Volume ${id} not found`);
    this.volumes.delete(id);
    this.emitEvent('volume', 'destroy', id, {});
  }

  async getContainerStats(id: string): Promise<ContainerStats | null> {
    const container = this.containers.get(id);
    if (!container || container.status !== 'running') {
      return null;
    }

    // Return cached stats or generate new ones
    let stats = this.statsCache.get(id);
    if (!stats) {
      stats = {
        id,
        name: container.name,
        cpuUsage: container.cpuUsage || 10 + Math.random() * 70,
        memoryUsage: container.memoryUsage || (container.memoryLimit || 512 * 1024 * 1024) * 0.3,
        memoryLimit: container.memoryLimit || 512 * 1024 * 1024,
        networkRx: container.networkRx || 0,
        networkTx: container.networkTx || 0,
        timestamp: Date.now(),
      };
      this.statsCache.set(id, stats);
    }

    // Update stats with current container data
    stats.cpuUsage = container.cpuUsage || stats.cpuUsage;
    stats.memoryUsage = container.memoryUsage || stats.memoryUsage;
    stats.networkRx = container.networkRx || stats.networkRx;
    stats.networkTx = container.networkTx || stats.networkTx;
    stats.timestamp = Date.now();

    return stats;
  }

  async getSystemInfo(): Promise<DockerSystemInfo | null> {
    if (!this.systemInfo) return null;
    
    // Update with current counts
    this.systemInfo.containers = this.containers.size;
    this.systemInfo.containersRunning = Array.from(this.containers.values())
      .filter(c => c.status === 'running').length;
    this.systemInfo.containersPaused = Array.from(this.containers.values())
      .filter(c => c.status === 'paused').length;
    this.systemInfo.containersStopped = Array.from(this.containers.values())
      .filter(c => c.status === 'exited' || c.status === 'dead').length;
    this.systemInfo.images = this.images.size;
    this.systemInfo.imagesSize = Array.from(this.images.values())
      .reduce((sum, img) => sum + img.size, 0);

    return { ...this.systemInfo };
  }

  subscribeToEvents(callback: (event: DockerEvent) => void): () => void {
    this.eventSubscribers.add(callback);
    return () => {
      this.eventSubscribers.delete(callback);
    };
  }

  private emitEvent(type: DockerEvent['type'], action: string, id: string, attributes: Record<string, any>): void {
    const event: DockerEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      action,
      actor: {
        id,
        attributes,
      },
      time: Math.floor(Date.now() / 1000),
      timeNano: Date.now() * 1000000,
    };

    for (const callback of this.eventSubscribers) {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in event callback:', error);
      }
    }
  }

  // Helper methods for updating container stats (called by DockerEmulationEngine)
  updateContainerStats(id: string, stats: Partial<ContainerStats>): void {
    const container = this.containers.get(id);
    if (container) {
      if (stats.cpuUsage !== undefined) container.cpuUsage = stats.cpuUsage;
      if (stats.memoryUsage !== undefined) container.memoryUsage = stats.memoryUsage;
      if (stats.memoryLimit !== undefined) container.memoryLimit = stats.memoryLimit;
      if (stats.networkRx !== undefined) container.networkRx = stats.networkRx;
      if (stats.networkTx !== undefined) container.networkTx = stats.networkTx;
    }
  }
}


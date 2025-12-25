import { DockerContainer, DockerImage, DockerNetwork, DockerVolume } from '../DockerEmulationEngine';

/**
 * Container Statistics from Docker API
 */
export interface ContainerStats {
  id: string;
  name: string;
  cpuUsage: number; // Percentage 0-100
  memoryUsage: number; // Bytes
  memoryLimit: number; // Bytes
  networkRx: number; // Bytes received
  networkTx: number; // Bytes transmitted
  timestamp: number;
}

/**
 * Docker System Information
 */
export interface DockerSystemInfo {
  version: string;
  apiVersion: string;
  os: string;
  arch: string;
  kernelVersion: string;
  totalMemory: number; // Bytes
  totalCpus: number;
  containers: number;
  containersRunning: number;
  containersPaused: number;
  containersStopped: number;
  images: number;
  imagesSize: number; // Bytes
}

/**
 * Docker Event
 */
export interface DockerEvent {
  id: string;
  type: 'container' | 'image' | 'network' | 'volume';
  action: string;
  actor: {
    id: string;
    attributes: Record<string, string>;
  };
  time: number;
  timeNano: number;
}

/**
 * Container Create Configuration
 */
export interface ContainerCreateConfig {
  name?: string;
  image: string;
  command?: string[];
  env?: Record<string, string>;
  ports?: Array<{
    containerPort: number;
    hostPort?: number;
    protocol?: 'tcp' | 'udp';
  }>;
  volumes?: string[];
  networks?: string[];
  memoryLimit?: number; // Bytes
  cpuLimit?: string; // e.g., "0.5" or "500m"
  restartPolicy?: 'no' | 'always' | 'on-failure' | 'unless-stopped';
  healthCheck?: {
    test: string[];
    interval?: number;
    timeout?: number;
    retries?: number;
    startPeriod?: number;
  };
}

/**
 * Build Image Configuration
 */
export interface BuildImageConfig {
  dockerfile?: string;
  context?: string;
  tag: string;
  buildArgs?: Record<string, string>;
  labels?: Record<string, string>;
}

/**
 * Network Create Configuration
 */
export interface NetworkCreateConfig {
  name: string;
  driver?: 'bridge' | 'host' | 'overlay' | 'macvlan' | 'none';
  subnet?: string;
  gateway?: string;
  internal?: boolean;
  enableIPv6?: boolean;
  labels?: Record<string, string>;
}

/**
 * Volume Create Configuration
 */
export interface VolumeCreateConfig {
  name: string;
  driver?: 'local' | 'nfs' | 'cifs' | 'tmpfs';
  labels?: Record<string, string>;
  options?: Record<string, string>;
}

/**
 * Docker Provider Interface
 * Unified interface for both simulation and real Docker API
 */
export interface IDockerProvider {
  // Connection
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  testConnection(): Promise<{ success: boolean; error?: string }>;

  // Containers
  listContainers(): Promise<DockerContainer[]>;
  getContainer(id: string): Promise<DockerContainer | null>;
  createContainer(config: ContainerCreateConfig): Promise<DockerContainer>;
  startContainer(id: string): Promise<void>;
  stopContainer(id: string): Promise<void>;
  pauseContainer(id: string): Promise<void>;
  unpauseContainer(id: string): Promise<void>;
  restartContainer(id: string): Promise<void>;
  removeContainer(id: string, force?: boolean): Promise<void>;

  // Images
  listImages(): Promise<DockerImage[]>;
  pullImage(repository: string, tag?: string): Promise<DockerImage>;
  buildImage(config: BuildImageConfig): Promise<DockerImage>;
  removeImage(id: string, force?: boolean): Promise<void>;

  // Networks
  listNetworks(): Promise<DockerNetwork[]>;
  createNetwork(config: NetworkCreateConfig): Promise<DockerNetwork>;
  removeNetwork(id: string): Promise<void>;

  // Volumes
  listVolumes(): Promise<DockerVolume[]>;
  createVolume(config: VolumeCreateConfig): Promise<DockerVolume>;
  removeVolume(id: string): Promise<void>;

  // Metrics
  getContainerStats(id: string): Promise<ContainerStats | null>;
  getSystemInfo(): Promise<DockerSystemInfo | null>;

  // Events
  subscribeToEvents(callback: (event: DockerEvent) => void): () => void;
}


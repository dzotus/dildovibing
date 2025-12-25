import { CanvasNode } from '@/types';

/**
 * Kubernetes Pod Status
 */
export type PodStatus = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown' | 'CrashLoopBackOff' | 'ImagePullBackOff' | 'ErrImagePull';

/**
 * Kubernetes Pod Phase
 */
export type PodPhase = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';

/**
 * Kubernetes Pod Condition Type
 */
export type PodConditionType = 'PodScheduled' | 'Ready' | 'Initialized' | 'ContainersReady' | 'PodReadyToStartContainers';

/**
 * Kubernetes Pod Condition
 */
export interface PodCondition {
  type: PodConditionType;
  status: 'True' | 'False' | 'Unknown';
  lastProbeTime?: number;
  lastTransitionTime?: number;
  reason?: string;
  message?: string;
}

/**
 * Kubernetes Container Status
 */
export interface ContainerStatus {
  name: string;
  state: 'waiting' | 'running' | 'terminated';
  ready: boolean;
  restartCount: number;
  image: string;
  imageID?: string;
  containerID?: string;
  started?: boolean;
  startedAt?: number;
  finishedAt?: number;
  exitCode?: number;
  reason?: string;
  message?: string;
  cpuUsage?: number; // Percentage 0-100
  memoryUsage?: number; // Bytes
  memoryLimit?: number; // Bytes
}

/**
 * Kubernetes Pod
 */
export interface KubernetesPod {
  id: string;
  name: string;
  namespace: string;
  uid?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  phase: PodPhase;
  status: PodStatus;
  conditions?: PodCondition[];
  containers?: ContainerStatus[];
  nodeName?: string;
  hostIP?: string;
  podIP?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  restartPolicy?: 'Always' | 'OnFailure' | 'Never';
  restartCount?: number;
  deletionTimestamp?: number;
  deletionGracePeriodSeconds?: number;
  qosClass?: 'Guaranteed' | 'Burstable' | 'BestEffort';
  totalCpuUsage?: number; // Percentage 0-100 (sum of all containers)
  totalMemoryUsage?: number; // Bytes (sum of all containers)
  totalMemoryLimit?: number; // Bytes (sum of all containers)
}

/**
 * Kubernetes Deployment Strategy
 */
export type DeploymentStrategyType = 'RollingUpdate' | 'Recreate';

/**
 * Kubernetes Deployment
 */
export interface KubernetesDeployment {
  id: string;
  name: string;
  namespace: string;
  uid?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  replicas: number;
  readyReplicas: number;
  availableReplicas: number;
  unavailableReplicas: number;
  updatedReplicas: number;
  strategy: DeploymentStrategyType;
  selector?: Record<string, string>;
  template?: {
    labels?: Record<string, string>;
    containers?: Array<{
      name: string;
      image: string;
      imagePullPolicy?: 'Always' | 'IfNotPresent' | 'Never';
      ports?: Array<{ containerPort: number; protocol?: 'TCP' | 'UDP' }>;
      resources?: {
        requests?: { cpu?: string; memory?: string };
        limits?: { cpu?: string; memory?: string };
      };
      env?: Array<{ name: string; value?: string; valueFrom?: any }>;
      volumeMounts?: Array<{ name: string; mountPath: string }>;
    }>;
    volumes?: Array<{ name: string; configMap?: { name: string }; secret?: { secretName: string } }>;
  };
  createdAt: number;
  updatedAt?: number;
  paused: boolean;
  progressDeadlineSeconds?: number;
  minReadySeconds?: number;
  revisionHistoryLimit?: number;
  rolloutStatus?: {
    revision?: number;
    updatedAt?: number;
    status?: 'progressing' | 'complete' | 'failed';
  };
}

/**
 * Kubernetes Service Type
 */
export type ServiceType = 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';

/**
 * Kubernetes Service
 */
export interface KubernetesService {
  id: string;
  name: string;
  namespace: string;
  uid?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  type: ServiceType;
  clusterIP?: string;
  externalIPs?: string[];
  loadBalancerIP?: string;
  ports?: Array<{
    name?: string;
    port: number;
    targetPort: number | string;
    protocol?: 'TCP' | 'UDP';
    nodePort?: number;
  }>;
  selector?: Record<string, string>;
  sessionAffinity?: 'None' | 'ClientIP';
  sessionAffinityConfig?: {
    clientIP?: { timeoutSeconds?: number };
  };
  createdAt: number;
  endpoints?: Array<{
    addresses?: string[];
    ports?: Array<{ port: number; protocol?: string }>;
  }>;
}

/**
 * Kubernetes ConfigMap
 */
export interface KubernetesConfigMap {
  id: string;
  name: string;
  namespace: string;
  uid?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  data: Record<string, string>;
  binaryData?: Record<string, string>;
  createdAt: number;
  immutable?: boolean;
}

/**
 * Kubernetes Secret Type
 */
export type SecretType = 'Opaque' | 'kubernetes.io/dockerconfigjson' | 'kubernetes.io/tls' | 'kubernetes.io/service-account-token' | 'bootstrap.kubernetes.io/token';

/**
 * Kubernetes Secret
 */
export interface KubernetesSecret {
  id: string;
  name: string;
  namespace: string;
  uid?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  type: SecretType;
  data: Record<string, string>; // Base64 encoded
  stringData?: Record<string, string>; // Plain text (will be base64 encoded)
  createdAt: number;
  immutable?: boolean;
}

/**
 * Kubernetes Namespace
 */
export interface KubernetesNamespace {
  id: string;
  name: string;
  uid?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  phase: 'Active' | 'Terminating';
  createdAt: number;
  deletionTimestamp?: number;
  resourceQuota?: {
    cpu?: { requests?: string; limits?: string };
    memory?: { requests?: string; limits?: string };
    pods?: string;
    persistentVolumeClaims?: string;
  };
}

/**
 * Kubernetes Node Condition Type
 */
export type NodeConditionType = 'Ready' | 'MemoryPressure' | 'DiskPressure' | 'PIDPressure' | 'NetworkUnavailable';

/**
 * Kubernetes Node
 */
export interface KubernetesNode {
  id: string;
  name: string;
  uid?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  roles?: string[]; // master, worker, etc.
  conditions?: Array<{
    type: NodeConditionType;
    status: 'True' | 'False' | 'Unknown';
    lastHeartbeatTime?: number;
    lastTransitionTime?: number;
    reason?: string;
    message?: string;
  }>;
  addresses?: Array<{
    type: 'Hostname' | 'ExternalIP' | 'InternalIP';
    address: string;
  }>;
  allocatable?: {
    cpu?: string;
    memory?: string;
    pods?: string;
    'ephemeral-storage'?: string;
  };
  capacity?: {
    cpu?: string;
    memory?: string;
    pods?: string;
    'ephemeral-storage'?: string;
  };
  nodeInfo?: {
    machineID?: string;
    systemUUID?: string;
    bootID?: string;
    kernelVersion?: string;
    osImage?: string;
    containerRuntimeVersion?: string;
    kubeletVersion?: string;
    kubeProxyVersion?: string;
    operatingSystem?: string;
    architecture?: string;
  };
  createdAt: number;
  taints?: Array<{
    key: string;
    value?: string;
    effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
  }>;
  unschedulable?: boolean;
  podCount?: number;
  cpuUsage?: number; // Percentage 0-100
  memoryUsage?: number; // Bytes
  memoryCapacity?: number; // Bytes
  diskUsage?: number; // Bytes
  diskCapacity?: number; // Bytes
}

/**
 * Kubernetes Event Type
 */
export type EventType = 'Normal' | 'Warning';

/**
 * Kubernetes Event
 */
export interface KubernetesEvent {
  id: string;
  name: string;
  namespace: string;
  type: EventType;
  reason: string;
  message: string;
  involvedObject: {
    kind: string;
    name: string;
    namespace?: string;
    uid?: string;
  };
  firstTimestamp: number;
  lastTimestamp: number;
  count: number;
  source?: {
    component?: string;
    host?: string;
  };
  reportingController?: string;
  reportingInstance?: string;
}

/**
 * Kubernetes PersistentVolumeClaim
 */
export interface KubernetesPersistentVolumeClaim {
  id: string;
  name: string;
  namespace: string;
  uid?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  status: 'Pending' | 'Bound' | 'Lost';
  phase: 'Pending' | 'Bound' | 'Lost';
  accessModes: Array<'ReadWriteOnce' | 'ReadOnlyMany' | 'ReadWriteMany'>;
  storageClassName?: string;
  volumeName?: string;
  capacity?: {
    storage?: string;
  };
  createdAt: number;
  requestedStorage?: string;
}

/**
 * Kubernetes Configuration
 */
export interface KubernetesConfig {
  // Cluster settings
  apiServer?: string;
  namespace?: string;
  context?: string;
  
  // Resources
  pods?: KubernetesPod[];
  deployments?: KubernetesDeployment[];
  services?: KubernetesService[];
  configMaps?: KubernetesConfigMap[];
  secrets?: KubernetesSecret[];
  namespaces?: KubernetesNamespace[];
  nodes?: KubernetesNode[];
  events?: KubernetesEvent[];
  persistentVolumeClaims?: KubernetesPersistentVolumeClaim[];
  
  // Settings
  defaultNamespace?: string;
  resourceQuotas?: boolean;
  limitRanges?: boolean;
  
  // YAML manifests
  yamlManifests?: string[];
  yaml?: string; // YAML editor content
}

/**
 * Kubernetes Metrics
 */
export interface KubernetesMetrics {
  // Pod metrics
  podsTotal: number;
  podsRunning: number;
  podsPending: number;
  podsFailed: number;
  podsSucceeded: number;
  
  // Deployment metrics
  deploymentsTotal: number;
  deploymentsReady: number;
  deploymentsNotReady: number;
  
  // Service metrics
  servicesTotal: number;
  servicesClusterIP: number;
  servicesNodePort: number;
  servicesLoadBalancer: number;
  
  // Node metrics
  nodesTotal: number;
  nodesReady: number;
  nodesNotReady: number;
  
  // Resource usage
  totalCpuRequests: number; // millicores
  totalCpuLimits: number; // millicores
  totalMemoryRequests: number; // bytes
  totalMemoryLimits: number; // bytes
  totalCpuUsage: number; // Percentage 0-100
  totalMemoryUsage: number; // bytes
  totalMemoryCapacity: number; // bytes
  
  // Namespace metrics
  namespacesTotal: number;
  
  // ConfigMap and Secret metrics
  configMapsTotal: number;
  secretsTotal: number;
}

/**
 * Kubernetes Load Metrics (for component metrics calculation)
 */
export interface KubernetesLoad {
  throughput: number; // Pod operations per second
  averageLatency: number; // ms (scheduling, pod creation latency)
  errorRate: number; // 0-1 (failed pods / total pods)
  cpuUtilization: number; // 0-1 (cluster CPU usage)
  memoryUtilization: number; // 0-1 (cluster memory usage)
  podUtilization: number; // 0-1 (running pods / total pod capacity)
  networkUtilization: number; // 0-1
  diskUtilization: number; // 0-1
}

/**
 * Kubernetes Emulation Engine
 * Симулирует работу Kubernetes: Pods, Deployments, Services, ConfigMaps, Secrets, Namespaces, Nodes
 */
export class KubernetesEmulationEngine {
  private config: KubernetesConfig | null = null;
  
  // Resources (managed by engine, synced with config)
  private pods: Map<string, KubernetesPod> = new Map();
  private deployments: Map<string, KubernetesDeployment> = new Map();
  private services: Map<string, KubernetesService> = new Map();
  private configMaps: Map<string, KubernetesConfigMap> = new Map();
  private secrets: Map<string, KubernetesSecret> = new Map();
  private namespaces: Map<string, KubernetesNamespace> = new Map();
  private nodes: Map<string, KubernetesNode> = new Map();
  private events: KubernetesEvent[] = [];
  private persistentVolumeClaims: Map<string, KubernetesPersistentVolumeClaim> = new Map();
  
  // Metrics
  private kubernetesMetrics: KubernetesMetrics = {
    podsTotal: 0,
    podsRunning: 0,
    podsPending: 0,
    podsFailed: 0,
    podsSucceeded: 0,
    deploymentsTotal: 0,
    deploymentsReady: 0,
    deploymentsNotReady: 0,
    servicesTotal: 0,
    servicesClusterIP: 0,
    servicesNodePort: 0,
    servicesLoadBalancer: 0,
    nodesTotal: 0,
    nodesReady: 0,
    nodesNotReady: 0,
    totalCpuRequests: 0,
    totalCpuLimits: 0,
    totalMemoryRequests: 0,
    totalMemoryLimits: 0,
    totalCpuUsage: 0,
    totalMemoryUsage: 0,
    totalMemoryCapacity: 0,
    namespacesTotal: 0,
    configMapsTotal: 0,
    secretsTotal: 0,
  };
  
  // Last update time for resource calculations
  private lastUpdateTime: number = Date.now();
  
  // Update interval for metrics
  private updateInterval: number = 1000; // 1 second
  
  /**
   * Инициализирует конфигурацию Kubernetes из конфига компонента
   */
  initializeConfig(node: CanvasNode): void {
    const config = (node.data.config || {}) as KubernetesConfig;
    this.config = config;
    
    // Set default namespace
    if (!this.config.defaultNamespace) {
      this.config.defaultNamespace = 'default';
    }
    
    // Initialize default namespace if not exists
    if (!this.config.namespaces) {
      this.config.namespaces = [];
    }
    
    const defaultNsExists = this.config.namespaces.some(ns => ns.name === (this.config?.defaultNamespace || 'default'));
    if (!defaultNsExists) {
      this.config.namespaces.push({
        id: this.generateId(),
        name: this.config.defaultNamespace,
        phase: 'Active',
        createdAt: Date.now(),
      });
    }
    
    // Initialize default node if not exists
    if (!this.config.nodes || this.config.nodes.length === 0) {
      this.config.nodes = [{
        id: this.generateId(),
        name: 'node-1',
        roles: ['worker'],
        conditions: [{
          type: 'Ready',
          status: 'True',
          lastTransitionTime: Date.now(),
        }],
        allocatable: {
          cpu: '4',
          memory: '8Gi',
          pods: '110',
        },
        capacity: {
          cpu: '4',
          memory: '8Gi',
          pods: '110',
        },
        createdAt: Date.now(),
        unschedulable: false,
        podCount: 0,
      }];
    }
    
    // Initialize resources from config
    this.initializeResources();
    
    // Update metrics from config
    this.updateMetricsFromResources();
  }
  
  /**
   * Initialize resources from config
   */
  private initializeResources(): void {
    if (!this.config) return;
    
    // Initialize pods
    this.pods.clear();
    if (this.config.pods) {
      for (const pod of this.config.pods) {
        this.pods.set(pod.id, { ...pod });
      }
    }
    
    // Initialize deployments
    this.deployments.clear();
    if (this.config.deployments) {
      for (const deployment of this.config.deployments) {
        this.deployments.set(deployment.id, { ...deployment });
      }
    }
    
    // Initialize services
    this.services.clear();
    if (this.config.services) {
      for (const service of this.config.services) {
        this.services.set(service.id, { ...service });
      }
    }
    
    // Initialize configmaps
    this.configMaps.clear();
    if (this.config.configMaps) {
      for (const configMap of this.config.configMaps) {
        this.configMaps.set(configMap.id, { ...configMap });
      }
    }
    
    // Initialize secrets
    this.secrets.clear();
    if (this.config.secrets) {
      for (const secret of this.config.secrets) {
        this.secrets.set(secret.id, { ...secret });
      }
    }
    
    // Initialize namespaces
    this.namespaces.clear();
    if (this.config.namespaces) {
      for (const namespace of this.config.namespaces) {
        this.namespaces.set(namespace.id, { ...namespace });
      }
    }
    
    // Initialize nodes
    this.nodes.clear();
    if (this.config.nodes) {
      for (const node of this.config.nodes) {
        this.nodes.set(node.id, { ...node });
      }
    }
    
    // Initialize persistent volume claims
    this.persistentVolumeClaims.clear();
    if (this.config.persistentVolumeClaims) {
      for (const pvc of this.config.persistentVolumeClaims) {
        this.persistentVolumeClaims.set(pvc.id, { ...pvc });
      }
    }
    
    // Initialize events
    this.events = this.config.events || [];
  }
  
  /**
   * Обновляет конфигурацию (вызывается при изменении конфига в UI)
   */
  updateConfig(node: CanvasNode): void {
    const newConfig = (node.data.config || {}) as KubernetesConfig;
    const oldConfig = this.config;
    this.config = newConfig;
    
    // Sync resources: add new, update existing, remove deleted
    this.syncResources();
    
    // Update metrics
    this.updateMetricsFromResources();
  }
  
  /**
   * Sync resources with config
   */
  private syncResources(): void {
    if (!this.config) return;
    
    // Sync pods
    if (this.config.pods) {
      const configPodIds = new Set(this.config.pods.map(p => p.id));
      for (const [id] of this.pods.entries()) {
        if (!configPodIds.has(id)) {
          this.pods.delete(id);
        }
      }
      for (const pod of this.config.pods) {
        const existing = this.pods.get(pod.id);
        if (existing) {
          // Update existing pod (preserve runtime state)
          this.pods.set(pod.id, {
            ...existing,
            ...pod,
            // Preserve runtime metrics if pod is running
            totalCpuUsage: existing.phase === 'Running' ? existing.totalCpuUsage : pod.totalCpuUsage,
            totalMemoryUsage: existing.phase === 'Running' ? existing.totalMemoryUsage : pod.totalMemoryUsage,
            startedAt: pod.startedAt || existing.startedAt,
          });
        } else {
          this.pods.set(pod.id, { ...pod });
        }
      }
    }
    
    // Sync other resources similarly...
    // (deployments, services, configmaps, secrets, namespaces, nodes, pvcs)
    this.initializeResources();
  }
  
  /**
   * Обновляет метрики из ресурсов
   */
  private updateMetricsFromResources(): void {
    // Calculate pod metrics
    this.kubernetesMetrics.podsTotal = this.pods.size;
    this.kubernetesMetrics.podsRunning = Array.from(this.pods.values()).filter(p => p.phase === 'Running').length;
    this.kubernetesMetrics.podsPending = Array.from(this.pods.values()).filter(p => p.phase === 'Pending').length;
    this.kubernetesMetrics.podsFailed = Array.from(this.pods.values()).filter(p => p.phase === 'Failed').length;
    this.kubernetesMetrics.podsSucceeded = Array.from(this.pods.values()).filter(p => p.phase === 'Succeeded').length;
    
    // Calculate deployment metrics
    this.kubernetesMetrics.deploymentsTotal = this.deployments.size;
    this.kubernetesMetrics.deploymentsReady = Array.from(this.deployments.values())
      .filter(d => d.readyReplicas === d.replicas && d.replicas > 0).length;
    this.kubernetesMetrics.deploymentsNotReady = Array.from(this.deployments.values())
      .filter(d => d.readyReplicas !== d.replicas || d.replicas === 0).length;
    
    // Calculate service metrics
    this.kubernetesMetrics.servicesTotal = this.services.size;
    this.kubernetesMetrics.servicesClusterIP = Array.from(this.services.values())
      .filter(s => s.type === 'ClusterIP').length;
    this.kubernetesMetrics.servicesNodePort = Array.from(this.services.values())
      .filter(s => s.type === 'NodePort').length;
    this.kubernetesMetrics.servicesLoadBalancer = Array.from(this.services.values())
      .filter(s => s.type === 'LoadBalancer').length;
    
    // Calculate node metrics
    this.kubernetesMetrics.nodesTotal = this.nodes.size;
    this.kubernetesMetrics.nodesReady = Array.from(this.nodes.values())
      .filter(n => n.conditions?.some(c => c.type === 'Ready' && c.status === 'True')).length;
    this.kubernetesMetrics.nodesNotReady = this.kubernetesMetrics.nodesTotal - this.kubernetesMetrics.nodesReady;
    
    // Calculate resource usage
    let totalCpuUsage = 0;
    let totalMemoryUsage = 0;
    let totalMemoryCapacity = 0;
    
    for (const pod of this.pods.values()) {
      if (pod.totalCpuUsage) {
        totalCpuUsage += pod.totalCpuUsage;
      }
      if (pod.totalMemoryUsage) {
        totalMemoryUsage += pod.totalMemoryUsage;
      }
    }
    
    for (const node of this.nodes.values()) {
      if (node.memoryCapacity) {
        totalMemoryCapacity += node.memoryCapacity;
      }
    }
    
    this.kubernetesMetrics.totalCpuUsage = totalCpuUsage;
    this.kubernetesMetrics.totalMemoryUsage = totalMemoryUsage;
    this.kubernetesMetrics.totalMemoryCapacity = totalMemoryCapacity;
    
    // Calculate namespace metrics
    this.kubernetesMetrics.namespacesTotal = this.namespaces.size;
    
    // Calculate configmap and secret metrics
    this.kubernetesMetrics.configMapsTotal = this.configMaps.size;
    this.kubernetesMetrics.secretsTotal = this.secrets.size;
  }
  
  /**
   * Simulate Kubernetes operations and update metrics
   */
  simulateStep(): void {
    const now = Date.now();
    const deltaTime = now - this.lastUpdateTime;
    this.lastUpdateTime = now;
    
    // Simulate pod lifecycle
    this.simulatePodLifecycle(deltaTime);
    
    // Simulate deployment reconciliation
    this.simulateDeploymentReconciliation(deltaTime);
    
    // Simulate node metrics
    this.simulateNodeMetrics(deltaTime);
    
    // Update overall metrics
    this.updateMetricsFromResources();
  }
  
  /**
   * Simulate pod lifecycle
   */
  private simulatePodLifecycle(deltaTime: number): void {
    for (const pod of this.pods.values()) {
      // Simulate pod CPU and memory usage
      if (pod.phase === 'Running') {
        // Simulate varying CPU usage (20-80% range)
        if (!pod.totalCpuUsage) {
          pod.totalCpuUsage = 20 + Math.random() * 60;
        } else {
          // Add some variation
          pod.totalCpuUsage = Math.max(0, Math.min(100, pod.totalCpuUsage + (Math.random() - 0.5) * 5));
        }
        
        // Simulate memory usage (based on requested resources)
        if (!pod.totalMemoryUsage) {
          // Estimate memory usage (512Mi - 2Gi range)
          pod.totalMemoryUsage = 512 * 1024 * 1024 + Math.random() * (2 * 1024 * 1024 * 1024);
        } else {
          // Add some variation
          pod.totalMemoryUsage = Math.max(0, pod.totalMemoryUsage + (Math.random() - 0.5) * 100 * 1024 * 1024);
        }
        
        if (!pod.totalMemoryLimit) {
          pod.totalMemoryLimit = pod.totalMemoryUsage * 1.5; // Limit is 1.5x usage
        }
      }
    }
  }
  
  /**
   * Simulate deployment reconciliation
   */
  private simulateDeploymentReconciliation(deltaTime: number): void {
    for (const deployment of this.deployments.values()) {
      // Count matching pods
      const matchingPods = Array.from(this.pods.values()).filter(pod => {
        if (pod.namespace !== deployment.namespace) return false;
        if (deployment.selector) {
          return Object.entries(deployment.selector).every(([key, value]) => 
            pod.labels?.[key] === value
          );
        }
        return false;
      });
      
      const runningPods = matchingPods.filter(p => p.phase === 'Running');
      const readyPods = runningPods.filter(p => {
        const readyCondition = p.conditions?.find(c => c.type === 'Ready');
        return readyCondition?.status === 'True';
      });
      
      // Update deployment status
      deployment.readyReplicas = readyPods.length;
      deployment.availableReplicas = runningPods.length;
      deployment.updatedReplicas = runningPods.length;
      deployment.unavailableReplicas = Math.max(0, deployment.replicas - deployment.availableReplicas);
      
      // Create pods if needed
      if (matchingPods.length < deployment.replicas && !deployment.paused) {
        // Create new pod (simplified - in real k8s this is handled by ReplicaSet)
        // This is just simulation, so we'll create pods gradually
        const podsToCreate = deployment.replicas - matchingPods.length;
        if (podsToCreate > 0 && Math.random() > 0.7) { // 30% chance per step
          this.createPodForDeployment(deployment);
        }
      }
    }
  }
  
  /**
   * Create a pod for deployment
   */
  private createPodForDeployment(deployment: KubernetesDeployment): void {
    const podName = `${deployment.name}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const podId = this.generateId();
    
    const newPod: KubernetesPod = {
      id: podId,
      name: podName,
      namespace: deployment.namespace || this.config?.defaultNamespace || 'default',
      labels: deployment.template?.labels || deployment.selector,
      phase: 'Pending',
      status: 'Pending',
      createdAt: Date.now(),
      restartPolicy: 'Always',
      restartCount: 0,
    };
    
    this.pods.set(podId, newPod);
    
    // Update config
    if (this.config && this.config.pods) {
      this.config.pods.push(newPod);
    } else if (this.config) {
      this.config.pods = [newPod];
    }
    
    // Simulate pod startup (will transition to Running after a delay)
    setTimeout(() => {
      const pod = this.pods.get(podId);
      if (pod) {
        pod.phase = 'Running';
        pod.status = 'Running';
        pod.startedAt = Date.now();
        pod.podIP = `10.244.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
        pod.conditions = [
          {
            type: 'Ready',
            status: 'True',
            lastTransitionTime: Date.now(),
          },
          {
            type: 'PodScheduled',
            status: 'True',
            lastTransitionTime: Date.now(),
          },
        ];
      }
    }, 1000 + Math.random() * 2000); // 1-3 seconds startup time
  }
  
  /**
   * Simulate node metrics
   */
  private simulateNodeMetrics(deltaTime: number): void {
    for (const node of this.nodes.values()) {
      // Count pods on node
      const nodePods = Array.from(this.pods.values()).filter(p => p.nodeName === node.name);
      node.podCount = nodePods.length;
      
      // Calculate node CPU and memory usage from pods
      let nodeCpuUsage = 0;
      let nodeMemoryUsage = 0;
      
      for (const pod of nodePods) {
        if (pod.totalCpuUsage) {
          nodeCpuUsage += pod.totalCpuUsage;
        }
        if (pod.totalMemoryUsage) {
          nodeMemoryUsage += pod.totalMemoryUsage;
        }
      }
      
      node.cpuUsage = Math.min(100, nodeCpuUsage);
      
      // Convert memory capacity string to bytes
      if (node.capacity?.memory && !node.memoryCapacity) {
        node.memoryCapacity = this.parseMemoryString(node.capacity.memory);
      }
      
      if (node.memoryCapacity) {
        node.memoryUsage = Math.min(node.memoryCapacity, nodeMemoryUsage);
      }
    }
  }
  
  /**
   * Parse memory string (e.g., "8Gi", "512Mi") to bytes
   */
  private parseMemoryString(memory: string): number {
    const match = memory.match(/^(\d+)([KMGT]?i?)$/);
    if (!match) return 0;
    
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    
    const multipliers: Record<string, number> = {
      '': 1,
      'k': 1024,
      'ki': 1024,
      'm': 1024 * 1024,
      'mi': 1024 * 1024,
      'g': 1024 * 1024 * 1024,
      'gi': 1024 * 1024 * 1024,
      't': 1024 * 1024 * 1024 * 1024,
      'ti': 1024 * 1024 * 1024 * 1024,
    };
    
    return value * (multipliers[unit] || 1);
  }
  
  /**
   * Create a new event
   */
  private createEvent(type: EventType, reason: string, message: string, involvedObject: {
    kind: string;
    name: string;
    namespace?: string;
    uid?: string;
  }): void {
    const event: KubernetesEvent = {
      id: this.generateId(),
      name: `${involvedObject.name}.${Date.now()}`,
      namespace: involvedObject.namespace || this.config?.defaultNamespace || 'default',
      type,
      reason,
      message,
      involvedObject,
      firstTimestamp: Date.now(),
      lastTimestamp: Date.now(),
      count: 1,
    };
    
    this.events.push(event);
    
    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
    
    // Update config
    if (this.config) {
      this.config.events = [...this.events];
    }
  }
  
  /**
   * Sync resources to config
   */
  private syncResourcesToConfig(): void {
    if (!this.config) return;
    
    this.config.pods = Array.from(this.pods.values());
    this.config.deployments = Array.from(this.deployments.values());
    this.config.services = Array.from(this.services.values());
    this.config.configMaps = Array.from(this.configMaps.values());
    this.config.secrets = Array.from(this.secrets.values());
    this.config.namespaces = Array.from(this.namespaces.values());
    this.config.nodes = Array.from(this.nodes.values());
    this.config.events = this.events;
    this.config.persistentVolumeClaims = Array.from(this.persistentVolumeClaims.values());
  }
  
  // ==================== POD CRUD ====================
  
  /**
   * Create a pod
   */
  createPod(pod: Omit<KubernetesPod, 'id' | 'createdAt'>): KubernetesPod {
    if (!this.config) {
      throw new Error('Engine not initialized');
    }
    
    // Verify namespace exists
    const namespace = this.namespaces.get(pod.namespace);
    if (!namespace || namespace.phase !== 'Active') {
      throw new Error(`Namespace "${pod.namespace}" does not exist or is not active`);
    }
    
    const newPod: KubernetesPod = {
      ...pod,
      id: this.generateId(),
      createdAt: Date.now(),
      phase: pod.phase || 'Pending',
      status: pod.status || 'Pending',
    };
    
    this.pods.set(newPod.id, newPod);
    this.syncResourcesToConfig();
    this.updateMetricsFromResources();
    
    this.createEvent('Normal', 'Created', `Pod ${newPod.name} created`, {
      kind: 'Pod',
      name: newPod.name,
      namespace: newPod.namespace,
      uid: newPod.id,
    });
    
    return newPod;
  }
  
  /**
   * Update a pod
   */
  updatePod(id: string, updates: Partial<KubernetesPod>): KubernetesPod {
    const pod = this.pods.get(id);
    if (!pod) {
      throw new Error(`Pod with id "${id}" not found`);
    }
    
    const updatedPod = { ...pod, ...updates, id: pod.id };
    this.pods.set(id, updatedPod);
    this.syncResourcesToConfig();
    this.updateMetricsFromResources();
    
    this.createEvent('Normal', 'Updated', `Pod ${pod.name} updated`, {
      kind: 'Pod',
      name: pod.name,
      namespace: pod.namespace,
      uid: pod.id,
    });
    
    return updatedPod;
  }
  
  /**
   * Delete a pod
   */
  deletePod(id: string): void {
    const pod = this.pods.get(id);
    if (!pod) {
      throw new Error(`Pod with id "${id}" not found`);
    }
    
    this.pods.delete(id);
    this.syncResourcesToConfig();
    this.updateMetricsFromResources();
    
    this.createEvent('Normal', 'Deleted', `Pod ${pod.name} deleted`, {
      kind: 'Pod',
      name: pod.name,
      namespace: pod.namespace,
      uid: pod.id,
    });
  }
  
  // ==================== DEPLOYMENT CRUD ====================
  
  /**
   * Create a deployment
   */
  createDeployment(deployment: Omit<KubernetesDeployment, 'id' | 'createdAt' | 'readyReplicas' | 'availableReplicas' | 'updatedReplicas' | 'unavailableReplicas' | 'paused'>): KubernetesDeployment {
    if (!this.config) {
      throw new Error('Engine not initialized');
    }
    
    // Verify namespace exists
    const namespace = this.namespaces.get(deployment.namespace);
    if (!namespace || namespace.phase !== 'Active') {
      throw new Error(`Namespace "${deployment.namespace}" does not exist or is not active`);
    }
    
    const newDeployment: KubernetesDeployment = {
      ...deployment,
      id: this.generateId(),
      createdAt: Date.now(),
      readyReplicas: 0,
      availableReplicas: 0,
      updatedReplicas: 0,
      unavailableReplicas: deployment.replicas,
      paused: false,
    };
    
    this.deployments.set(newDeployment.id, newDeployment);
    this.syncResourcesToConfig();
    this.updateMetricsFromResources();
    
    // Create pods for deployment if replicas > 0
    if (newDeployment.replicas > 0) {
      for (let i = 0; i < newDeployment.replicas; i++) {
        this.createPodForDeployment(newDeployment);
      }
    }
    
    this.createEvent('Normal', 'Created', `Deployment ${newDeployment.name} created`, {
      kind: 'Deployment',
      name: newDeployment.name,
      namespace: newDeployment.namespace,
      uid: newDeployment.id,
    });
    
    return newDeployment;
  }
  
  /**
   * Update a deployment
   */
  updateDeployment(id: string, updates: Partial<KubernetesDeployment>): KubernetesDeployment {
    const deployment = this.deployments.get(id);
    if (!deployment) {
      throw new Error(`Deployment with id "${id}" not found`);
    }
    
    const oldReplicas = deployment.replicas;
    const updatedDeployment = { ...deployment, ...updates, id: deployment.id };
    
    // Handle replica scaling
    if (updates.replicas !== undefined && updates.replicas !== oldReplicas) {
      const replicaDiff = updates.replicas - oldReplicas;
      
      if (replicaDiff > 0) {
        // Scale up - create new pods
        for (let i = 0; i < replicaDiff; i++) {
          this.createPodForDeployment(updatedDeployment);
        }
      } else if (replicaDiff < 0) {
        // Scale down - delete pods (simplified: delete random pods matching deployment)
        const matchingPods = Array.from(this.pods.values()).filter(pod => {
          if (pod.namespace !== deployment.namespace) return false;
          if (deployment.selector) {
            return Object.entries(deployment.selector).every(([key, value]) => 
              pod.labels?.[key] === value
            );
          }
          return false;
        });
        
        const podsToDelete = matchingPods.slice(0, Math.abs(replicaDiff));
        for (const pod of podsToDelete) {
          this.deletePod(pod.id);
        }
      }
    }
    
    this.deployments.set(id, updatedDeployment);
    this.syncResourcesToConfig();
    this.updateMetricsFromResources();
    
    this.createEvent('Normal', 'Updated', `Deployment ${deployment.name} updated`, {
      kind: 'Deployment',
      name: deployment.name,
      namespace: deployment.namespace,
      uid: deployment.id,
    });
    
    return updatedDeployment;
  }
  
  /**
   * Delete a deployment
   */
  deleteDeployment(id: string): void {
    const deployment = this.deployments.get(id);
    if (!deployment) {
      throw new Error(`Deployment with id "${id}" not found`);
    }
    
    // Delete associated pods (simplified)
    const matchingPods = Array.from(this.pods.values()).filter(pod => {
      if (pod.namespace !== deployment.namespace) return false;
      if (deployment.selector) {
        return Object.entries(deployment.selector).every(([key, value]) => 
          pod.labels?.[key] === value
        );
      }
      return false;
    });
    
    for (const pod of matchingPods) {
      this.deletePod(pod.id);
    }
    
    this.deployments.delete(id);
    this.syncResourcesToConfig();
    this.updateMetricsFromResources();
    
    this.createEvent('Normal', 'Deleted', `Deployment ${deployment.name} deleted`, {
      kind: 'Deployment',
      name: deployment.name,
      namespace: deployment.namespace,
      uid: deployment.id,
    });
  }
  
  // ==================== SERVICE CRUD ====================
  
  /**
   * Create a service
   */
  createService(service: Omit<KubernetesService, 'id' | 'createdAt'>): KubernetesService {
    if (!this.config) {
      throw new Error('Engine not initialized');
    }
    
    // Verify namespace exists
    const namespace = this.namespaces.get(service.namespace);
    if (!namespace || namespace.phase !== 'Active') {
      throw new Error(`Namespace "${service.namespace}" does not exist or is not active`);
    }
    
    const newService: KubernetesService = {
      ...service,
      id: this.generateId(),
      createdAt: Date.now(),
      type: service.type || 'ClusterIP',
      clusterIP: service.clusterIP || `10.96.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    };
    
    // Find matching pods for endpoints
    if (newService.selector) {
      const matchingPods = Array.from(this.pods.values()).filter(pod => {
        if (pod.namespace !== newService.namespace) return false;
        return Object.entries(newService.selector!).every(([key, value]) => 
          pod.labels?.[key] === value
        );
      });
      
      newService.endpoints = [{
        addresses: matchingPods.filter(p => p.podIP).map(p => p.podIP!),
        ports: newService.ports?.map(p => ({ port: typeof p.targetPort === 'number' ? p.targetPort : parseInt(p.targetPort as string, 10), protocol: p.protocol || 'TCP' })),
      }];
    }
    
    this.services.set(newService.id, newService);
    this.syncResourcesToConfig();
    this.updateMetricsFromResources();
    
    this.createEvent('Normal', 'Created', `Service ${newService.name} created`, {
      kind: 'Service',
      name: newService.name,
      namespace: newService.namespace,
      uid: newService.id,
    });
    
    return newService;
  }
  
  /**
   * Update a service
   */
  updateService(id: string, updates: Partial<KubernetesService>): KubernetesService {
    const service = this.services.get(id);
    if (!service) {
      throw new Error(`Service with id "${id}" not found`);
    }
    
    const updatedService = { ...service, ...updates, id: service.id };
    
    // Update endpoints if selector changed
    if (updates.selector && updatedService.selector) {
      const matchingPods = Array.from(this.pods.values()).filter(pod => {
        if (pod.namespace !== service.namespace) return false;
        return Object.entries(updatedService.selector!).every(([key, value]) => 
          pod.labels?.[key] === value
        );
      });
      
      updatedService.endpoints = [{
        addresses: matchingPods.filter(p => p.podIP).map(p => p.podIP!),
        ports: updatedService.ports?.map(p => ({ port: typeof p.targetPort === 'number' ? p.targetPort : parseInt(p.targetPort as string, 10), protocol: p.protocol || 'TCP' })),
      }];
    }
    
    this.services.set(id, updatedService);
    this.syncResourcesToConfig();
    this.updateMetricsFromResources();
    
    this.createEvent('Normal', 'Updated', `Service ${service.name} updated`, {
      kind: 'Service',
      name: service.name,
      namespace: service.namespace,
      uid: service.id,
    });
    
    return updatedService;
  }
  
  /**
   * Delete a service
   */
  deleteService(id: string): void {
    const service = this.services.get(id);
    if (!service) {
      throw new Error(`Service with id "${id}" not found`);
    }
    
    this.services.delete(id);
    this.syncResourcesToConfig();
    this.updateMetricsFromResources();
    
    this.createEvent('Normal', 'Deleted', `Service ${service.name} deleted`, {
      kind: 'Service',
      name: service.name,
      namespace: service.namespace,
      uid: service.id,
    });
  }
  
  // ==================== CONFIGMAP CRUD ====================
  
  /**
   * Create a configmap
   */
  createConfigMap(configMap: Omit<KubernetesConfigMap, 'id' | 'createdAt'>): KubernetesConfigMap {
    if (!this.config) {
      throw new Error('Engine not initialized');
    }
    
    // Verify namespace exists
    const namespace = this.namespaces.get(configMap.namespace);
    if (!namespace || namespace.phase !== 'Active') {
      throw new Error(`Namespace "${configMap.namespace}" does not exist or is not active`);
    }
    
    const newConfigMap: KubernetesConfigMap = {
      ...configMap,
      id: this.generateId(),
      createdAt: Date.now(),
      data: configMap.data || {},
    };
    
    this.configMaps.set(newConfigMap.id, newConfigMap);
    this.syncResourcesToConfig();
    this.updateMetricsFromResources();
    
    this.createEvent('Normal', 'Created', `ConfigMap ${newConfigMap.name} created`, {
      kind: 'ConfigMap',
      name: newConfigMap.name,
      namespace: newConfigMap.namespace,
      uid: newConfigMap.id,
    });
    
    return newConfigMap;
  }
  
  /**
   * Update a configmap
   */
  updateConfigMap(id: string, updates: Partial<KubernetesConfigMap>): KubernetesConfigMap {
    const configMap = this.configMaps.get(id);
    if (!configMap) {
      throw new Error(`ConfigMap with id "${id}" not found`);
    }
    
    if (configMap.immutable) {
      throw new Error(`ConfigMap "${configMap.name}" is immutable`);
    }
    
    const updatedConfigMap = { ...configMap, ...updates, id: configMap.id };
    this.configMaps.set(id, updatedConfigMap);
    this.syncResourcesToConfig();
    this.updateMetricsFromResources();
    
    this.createEvent('Normal', 'Updated', `ConfigMap ${configMap.name} updated`, {
      kind: 'ConfigMap',
      name: configMap.name,
      namespace: configMap.namespace,
      uid: configMap.id,
    });
    
    return updatedConfigMap;
  }
  
  /**
   * Delete a configmap
   */
  deleteConfigMap(id: string): void {
    const configMap = this.configMaps.get(id);
    if (!configMap) {
      throw new Error(`ConfigMap with id "${id}" not found`);
    }
    
    this.configMaps.delete(id);
    this.syncResourcesToConfig();
    this.updateMetricsFromResources();
    
    this.createEvent('Normal', 'Deleted', `ConfigMap ${configMap.name} deleted`, {
      kind: 'ConfigMap',
      name: configMap.name,
      namespace: configMap.namespace,
      uid: configMap.id,
    });
  }
  
  // ==================== SECRET CRUD ====================
  
  /**
   * Create a secret
   */
  createSecret(secret: Omit<KubernetesSecret, 'id' | 'createdAt' | 'data'> & { data?: Record<string, string>; stringData?: Record<string, string> }): KubernetesSecret {
    if (!this.config) {
      throw new Error('Engine not initialized');
    }
    
    // Verify namespace exists
    const namespace = this.namespaces.get(secret.namespace);
    if (!namespace || namespace.phase !== 'Active') {
      throw new Error(`Namespace "${secret.namespace}" does not exist or is not active`);
    }
    
    // Convert stringData to base64 data if provided
    const data: Record<string, string> = secret.data || {};
    if (secret.stringData) {
      for (const [key, value] of Object.entries(secret.stringData)) {
        data[key] = btoa(value);
      }
    }
    
    const newSecret: KubernetesSecret = {
      ...secret,
      id: this.generateId(),
      createdAt: Date.now(),
      type: secret.type || 'Opaque',
      data,
    };
    
    this.secrets.set(newSecret.id, newSecret);
    this.syncResourcesToConfig();
    this.updateMetricsFromResources();
    
    this.createEvent('Normal', 'Created', `Secret ${newSecret.name} created`, {
      kind: 'Secret',
      name: newSecret.name,
      namespace: newSecret.namespace,
      uid: newSecret.id,
    });
    
    return newSecret;
  }
  
  /**
   * Update a secret
   */
  updateSecret(id: string, updates: Partial<KubernetesSecret> & { stringData?: Record<string, string> }): KubernetesSecret {
    const secret = this.secrets.get(id);
    if (!secret) {
      throw new Error(`Secret with id "${id}" not found`);
    }
    
    if (secret.immutable) {
      throw new Error(`Secret "${secret.name}" is immutable`);
    }
    
    const updatedSecret = { ...secret, ...updates, id: secret.id };
    
    // Handle stringData conversion
    if (updates.stringData) {
      updatedSecret.data = { ...updatedSecret.data };
      for (const [key, value] of Object.entries(updates.stringData)) {
        updatedSecret.data[key] = btoa(value);
      }
    }
    
    this.secrets.set(id, updatedSecret);
    this.syncResourcesToConfig();
    this.updateMetricsFromResources();
    
    this.createEvent('Normal', 'Updated', `Secret ${secret.name} updated`, {
      kind: 'Secret',
      name: secret.name,
      namespace: secret.namespace,
      uid: secret.id,
    });
    
    return updatedSecret;
  }
  
  /**
   * Delete a secret
   */
  deleteSecret(id: string): void {
    const secret = this.secrets.get(id);
    if (!secret) {
      throw new Error(`Secret with id "${id}" not found`);
    }
    
    this.secrets.delete(id);
    this.syncResourcesToConfig();
    this.updateMetricsFromResources();
    
    this.createEvent('Normal', 'Deleted', `Secret ${secret.name} deleted`, {
      kind: 'Secret',
      name: secret.name,
      namespace: secret.namespace,
      uid: secret.id,
    });
  }
  
  // ==================== NAMESPACE CRUD ====================
  
  /**
   * Create a namespace
   */
  createNamespace(namespace: Omit<KubernetesNamespace, 'id' | 'createdAt' | 'phase'>): KubernetesNamespace {
    if (!this.config) {
      throw new Error('Engine not initialized');
    }
    
    // Check if namespace already exists
    const existing = Array.from(this.namespaces.values()).find(ns => ns.name === namespace.name);
    if (existing) {
      throw new Error(`Namespace "${namespace.name}" already exists`);
    }
    
    const newNamespace: KubernetesNamespace = {
      ...namespace,
      id: this.generateId(),
      createdAt: Date.now(),
      phase: 'Active',
    };
    
    this.namespaces.set(newNamespace.id, newNamespace);
    this.syncResourcesToConfig();
    this.updateMetricsFromResources();
    
    this.createEvent('Normal', 'Created', `Namespace ${newNamespace.name} created`, {
      kind: 'Namespace',
      name: newNamespace.name,
      uid: newNamespace.id,
    });
    
    return newNamespace;
  }
  
  /**
   * Delete a namespace
   */
  deleteNamespace(id: string): void {
    const namespace = this.namespaces.get(id);
    if (!namespace) {
      throw new Error(`Namespace with id "${id}" not found`);
    }
    
    // Prevent deletion of default namespace
    if (namespace.name === 'default' || namespace.name === this.config?.defaultNamespace) {
      throw new Error('Cannot delete default namespace');
    }
    
    // Check if namespace has resources
    const hasPods = Array.from(this.pods.values()).some(p => p.namespace === namespace.name);
    const hasDeployments = Array.from(this.deployments.values()).some(d => d.namespace === namespace.name);
    const hasServices = Array.from(this.services.values()).some(s => s.namespace === namespace.name);
    
    if (hasPods || hasDeployments || hasServices) {
      throw new Error(`Namespace "${namespace.name}" contains resources and cannot be deleted`);
    }
    
    this.namespaces.delete(id);
    this.syncResourcesToConfig();
    this.updateMetricsFromResources();
    
    this.createEvent('Normal', 'Deleted', `Namespace ${namespace.name} deleted`, {
      kind: 'Namespace',
      name: namespace.name,
      uid: namespace.id,
    });
  }
  
  /**
   * Get all pods
   */
  getPods(): KubernetesPod[] {
    return Array.from(this.pods.values());
  }
  
  /**
   * Get pods by namespace
   */
  getPodsByNamespace(namespace: string): KubernetesPod[] {
    return Array.from(this.pods.values()).filter(p => p.namespace === namespace);
  }
  
  /**
   * Get all deployments
   */
  getDeployments(): KubernetesDeployment[] {
    return Array.from(this.deployments.values());
  }
  
  /**
   * Get deployments by namespace
   */
  getDeploymentsByNamespace(namespace: string): KubernetesDeployment[] {
    return Array.from(this.deployments.values()).filter(d => d.namespace === namespace);
  }
  
  /**
   * Get all services
   */
  getServices(): KubernetesService[] {
    return Array.from(this.services.values());
  }
  
  /**
   * Get services by namespace
   */
  getServicesByNamespace(namespace: string): KubernetesService[] {
    return Array.from(this.services.values()).filter(s => s.namespace === namespace);
  }
  
  /**
   * Get all configmaps
   */
  getConfigMaps(): KubernetesConfigMap[] {
    return Array.from(this.configMaps.values());
  }
  
  /**
   * Get configmaps by namespace
   */
  getConfigMapsByNamespace(namespace: string): KubernetesConfigMap[] {
    return Array.from(this.configMaps.values()).filter(cm => cm.namespace === namespace);
  }
  
  /**
   * Get all secrets
   */
  getSecrets(): KubernetesSecret[] {
    return Array.from(this.secrets.values());
  }
  
  /**
   * Get secrets by namespace
   */
  getSecretsByNamespace(namespace: string): KubernetesSecret[] {
    return Array.from(this.secrets.values()).filter(s => s.namespace === namespace);
  }
  
  /**
   * Get all namespaces
   */
  getNamespaces(): KubernetesNamespace[] {
    return Array.from(this.namespaces.values());
  }
  
  /**
   * Get all nodes
   */
  getNodes(): KubernetesNode[] {
    return Array.from(this.nodes.values());
  }
  
  /**
   * Get all events
   */
  getEvents(): KubernetesEvent[] {
    return [...this.events];
  }
  
  /**
   * Get events by namespace
   */
  getEventsByNamespace(namespace: string): KubernetesEvent[] {
    return this.events.filter(e => e.namespace === namespace);
  }
  
  /**
   * Get all persistent volume claims
   */
  getPersistentVolumeClaims(): KubernetesPersistentVolumeClaim[] {
    return Array.from(this.persistentVolumeClaims.values());
  }
  
  /**
   * Get metrics
   */
  getMetrics(): KubernetesMetrics {
    return { ...this.kubernetesMetrics };
  }
  
  /**
   * Get load metrics for component metrics calculation
   */
  getLoad(): KubernetesLoad {
    const totalCpuCapacity = Array.from(this.nodes.values()).reduce((sum, node) => {
      if (node.capacity?.cpu) {
        const cpuCores = parseFloat(node.capacity.cpu);
        return sum + cpuCores * 1000; // Convert to millicores
      }
      return sum;
    }, 0);
    
    const totalCpuUsage = this.kubernetesMetrics.totalCpuUsage;
    const cpuUtilization = totalCpuCapacity > 0 ? totalCpuUsage / totalCpuCapacity : 0;
    
    const memoryUtilization = this.kubernetesMetrics.totalMemoryCapacity > 0
      ? this.kubernetesMetrics.totalMemoryUsage / this.kubernetesMetrics.totalMemoryCapacity
      : 0;
    
    const totalPodCapacity = Array.from(this.nodes.values()).reduce((sum, node) => {
      if (node.capacity?.pods) {
        return sum + parseInt(node.capacity.pods, 10);
      }
      return sum;
    }, 0);
    
    const podUtilization = totalPodCapacity > 0
      ? this.kubernetesMetrics.podsTotal / totalPodCapacity
      : 0;
    
    const errorRate = this.kubernetesMetrics.podsTotal > 0
      ? this.kubernetesMetrics.podsFailed / this.kubernetesMetrics.podsTotal
      : 0;
    
    return {
      throughput: this.kubernetesMetrics.podsRunning * 10, // Pod operations per second estimate
      averageLatency: 100 + Math.random() * 200, // Scheduling and pod creation latency (ms)
      errorRate,
      cpuUtilization: Math.min(1, cpuUtilization),
      memoryUtilization: Math.min(1, memoryUtilization),
      podUtilization: Math.min(1, podUtilization),
      networkUtilization: 0.1 + Math.random() * 0.3, // 10-40%
      diskUtilization: 0.2 + Math.random() * 0.2, // 20-40%
    };
  }
  
  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get config for saving
   */
  getConfig(): KubernetesConfig | null {
    if (!this.config) return null;
    
    // Sync resources back to config
    this.syncResourcesToConfig();
    
    return { ...this.config };
  }
}


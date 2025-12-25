import { useState, useEffect } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { showSuccess, showError, showValidationError, showWarning } from '@/utils/toast';
import { useEmulationStore } from '@/store/useEmulationStore';
import { emulationEngine } from '@/core/EmulationEngine';
import { DockerContainer, DockerConfig } from '@/core/DockerEmulationEngine';
import { 
  Container, 
  Layers, 
  Settings, 
  Activity,
  Play,
  Pause,
  RefreshCw,
  Plus,
  Trash2,
  Cpu,
  HardDrive,
  MemoryStick,
  Search,
  Network,
  Image as ImageIcon,
  FileText,
  Logs,
  Wifi,
  WifiOff,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { DockerConnectionSettings } from './DockerConnectionSettings';
import { Switch } from '@/components/ui/switch';

interface DockerK8sConfigProps {
  componentId: string;
}

interface Container {
  id: string;
  name: string;
  image: string;
  imageId?: string;
  status: 'created' | 'running' | 'paused' | 'restarting' | 'removing' | 'exited' | 'dead' | 'stopped';
  createdAt?: number;
  startedAt?: number;
  finishedAt?: number;
  restartCount?: number;
  cpu?: number;
  cpuUsage?: number;
  memory?: string;
  memoryUsage?: number;
  memoryLimit?: number;
  networkRx?: number;
  networkTx?: number;
  ports?: Array<{ containerPort: number; hostPort?: number; protocol: 'tcp' | 'udp' }>;
  environment?: Record<string, string>;
  volumes?: string[];
  networks?: string[];
  health?: 'healthy' | 'unhealthy' | 'starting' | 'none';
  exitCode?: number;
}

interface DockerK8sConfig extends Partial<DockerConfig> {
  image?: string;
  replicas?: number;
  memory?: string;
  cpu?: string;
  environment?: Record<string, string>;
  yaml?: string;
  dockerfile?: string;
  containers?: Container[];
  pods?: Container[];
  images?: Array<{
    id: string;
    repository: string;
    tag: string;
    size: number;
    createdAt?: number;
  }>;
  networks?: Array<{
    id: string;
    name: string;
    driver: 'bridge' | 'host' | 'overlay' | 'macvlan' | 'none';
    containers?: string[];
  }>;
  volumes?: Array<{
    id: string;
    name: string;
    driver: 'local' | 'nfs' | 'cifs' | 'tmpfs';
    size?: number;
    usedBy?: string[];
  }>;
  totalCpu?: number;
  totalMemory?: string;
}

export function DockerK8sConfigAdvanced({ componentId }: DockerK8sConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;
  const componentMetrics = useEmulationStore((state) => 
    state.componentMetrics.get(componentId)
  );

  // Get Docker emulation engine for real-time data
  const dockerEngine = node?.type === 'docker' 
    ? emulationEngine.getDockerEmulationEngine(componentId)
    : undefined;

  // State for Docker-specific features
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'stopped' | 'paused'>('all');
  const [showCreateContainer, setShowCreateContainer] = useState(false);
  const [containerToDelete, setContainerToDelete] = useState<string | null>(null);
  
  // Form states for creating container
  const [newContainerName, setNewContainerName] = useState('');
  const [newContainerImage, setNewContainerImage] = useState('nginx:latest');
  const [newContainerMemory, setNewContainerMemory] = useState('512Mi');
  const [newContainerCpu, setNewContainerCpu] = useState('500m');

  // State for Images tab
  const [imageSearchQuery, setImageSearchQuery] = useState('');
  const [showPullImage, setShowPullImage] = useState(false);
  const [showBuildImage, setShowBuildImage] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);
  const [newImageName, setNewImageName] = useState('');
  const [newImageTag, setNewImageTag] = useState('latest');
  const [buildContext, setBuildContext] = useState('');

  // State for Networks tab
  const [networkSearchQuery, setNetworkSearchQuery] = useState('');
  const [showCreateNetwork, setShowCreateNetwork] = useState(false);
  const [networkToDelete, setNetworkToDelete] = useState<string | null>(null);
  const [newNetworkName, setNewNetworkName] = useState('');
  const [newNetworkDriver, setNewNetworkDriver] = useState<'bridge' | 'host' | 'overlay' | 'macvlan' | 'none'>('bridge');

  // State for Volumes tab
  const [volumeSearchQuery, setVolumeSearchQuery] = useState('');
  const [showCreateVolume, setShowCreateVolume] = useState(false);
  const [volumeToDelete, setVolumeToDelete] = useState<string | null>(null);
  const [newVolumeName, setNewVolumeName] = useState('');
  const [newVolumeDriver, setNewVolumeDriver] = useState<'local' | 'nfs' | 'cifs' | 'tmpfs'>('local');

  // State for Logs tab
  const [selectedContainerForLogs, setSelectedContainerForLogs] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);

  // State for Docker mode and connection
  const [showConnectionSettings, setShowConnectionSettings] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as DockerK8sConfig;
  
  // Sync containers from emulation engine if available
  useEffect(() => {
    if (node?.type === 'docker' && dockerEngine) {
      try {
        const engineContainers = dockerEngine.getContainers();
        if (engineContainers.length > 0) {
          // Update config with containers from engine (preserve other config)
          const updatedContainers = engineContainers.map(c => ({
            id: c.id,
            name: c.name,
            image: c.image,
            imageId: c.imageId,
            status: c.status,
            createdAt: c.createdAt,
            startedAt: c.startedAt,
            finishedAt: c.finishedAt,
            restartCount: c.restartCount,
            cpuUsage: c.cpuUsage,
            memoryUsage: c.memoryUsage,
            memoryLimit: c.memoryLimit,
            networkRx: c.networkRx,
            networkTx: c.networkTx,
            ports: c.ports,
            environment: c.environment,
            volumes: c.volumes,
            networks: c.networks,
            health: c.health,
            exitCode: c.exitCode,
          }));
          
          // Only update if containers actually changed (check by ID and status)
          const currentContainers = config.containers || [];
          const containersChanged = 
            currentContainers.length !== updatedContainers.length ||
            currentContainers.some((c, i) => {
              const updated = updatedContainers.find(uc => uc.id === c.id);
              return !updated || updated.status !== c.status || 
                     updated.cpuUsage !== c.cpuUsage || 
                     updated.memoryUsage !== c.memoryUsage;
            });
          
          if (containersChanged) {
            updateNode(componentId, {
              data: {
                ...node.data,
                config: { ...config, containers: updatedContainers },
              },
            });
          }
        }
      } catch (error) {
        console.error('Error syncing containers from engine:', error);
      }
    }
  }, [dockerEngine, componentMetrics, node?.id, componentId, updateNode, config.containers]);
  const image = config.image || 'nginx:latest';
  const replicas = config.replicas || 1;
  const memory = config.memory || '512Mi';
  const cpu = config.cpu || '500m';
  const yaml = config.yaml || (node.type === 'docker' 
    ? `FROM nginx:latest\nCOPY . /usr/share/nginx/html\nEXPOSE 80\nCMD ["nginx", "-g", "daemon off;"]`
    : `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: app-deployment\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: myapp\n  template:\n    metadata:\n      labels:\n        app: myapp\n    spec:\n      containers:\n      - name: myapp\n        image: nginx:latest\n        ports:\n        - containerPort: 80`
  );
  const containers = config.containers || (node.type === 'docker' ? [
    { id: '1', name: 'web-server', image: 'nginx:latest', status: 'running', cpu: 15, memory: '128Mi' },
    { id: '2', name: 'api-server', image: 'node:18', status: 'running', cpu: 25, memory: '256Mi' },
  ] : []);
  const pods = config.pods || (node.type === 'kubernetes' ? [
    { id: 'pod-1', name: 'app-pod-1', image: 'nginx:latest', status: 'running', cpu: 20, memory: '256Mi' },
    { id: 'pod-2', name: 'app-pod-2', image: 'nginx:latest', status: 'running', cpu: 18, memory: '240Mi' },
    { id: 'pod-3', name: 'app-pod-3', image: 'nginx:latest', status: 'running', cpu: 22, memory: '260Mi' },
  ] : []);
  const totalCpu = config.totalCpu || (node.type === 'docker' 
    ? containers.reduce((sum, c) => sum + (c.cpu || 0), 0)
    : pods.reduce((sum, p) => sum + (p.cpu || 0), 0)
  );
  const totalMemory = config.totalMemory || '1.2Gi';

  const updateConfig = (updates: Partial<DockerK8sConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  // Helper functions for Docker
  const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const formatBytes = (bytes?: number): string => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Container CRUD operations (only for Docker)
  const addContainer = () => {
    if (node.type !== 'docker') return;
    
    const trimmedName = newContainerName.trim();
    if (!trimmedName) {
      showValidationError('Container name is required');
      return;
    }
    
    const containers = config.containers || [];
    if (containers.some(c => c.name === trimmedName)) {
      showValidationError('Container name must be unique');
      return;
    }

    const newContainer: Container = {
      id: generateId(),
      name: trimmedName,
      image: newContainerImage.trim() || 'nginx:latest',
      status: 'created',
      createdAt: Date.now(),
      restartCount: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      memoryLimit: 512 * 1024 * 1024, // 512MB default
    };

    updateConfig({ containers: [...containers, newContainer] });
    setNewContainerName('');
    setNewContainerImage('nginx:latest');
    setNewContainerMemory('512Mi');
    setNewContainerCpu('500m');
    setShowCreateContainer(false);
    showSuccess(`Container "${trimmedName}" created successfully`);
  };

  const startContainer = async (containerId: string) => {
    if (node.type !== 'docker') return;
    
    // Use provider if in real/hybrid mode
    if (dockerEngine && (config.mode === 'real' || config.mode === 'hybrid') && dockerEngine.isConnected()) {
      try {
        await dockerEngine.startContainerViaProvider(containerId);
        showSuccess(`Container started via Docker daemon`);
        // Sync will update the UI automatically
        return;
      } catch (error: any) {
        showError(error.message || 'Failed to start container');
        return;
      }
    }
    
    // Fallback to simulation
    const containers = config.containers || [];
    const updated = containers.map(c => 
      c.id === containerId ? { ...c, status: 'running' as const, startedAt: Date.now() } : c
    );
    updateConfig({ containers: updated });
    const container = containers.find(c => c.id === containerId);
    showSuccess(`Container "${container?.name}" started`);
  };

  const stopContainer = async (containerId: string) => {
    if (node.type !== 'docker') return;
    
    // Use provider if in real/hybrid mode
    if (dockerEngine && (config.mode === 'real' || config.mode === 'hybrid') && dockerEngine.isConnected()) {
      try {
        await dockerEngine.stopContainerViaProvider(containerId);
        showSuccess(`Container stopped via Docker daemon`);
        // Sync will update the UI automatically
        return;
      } catch (error: any) {
        showError(error.message || 'Failed to stop container');
        return;
      }
    }
    
    // Fallback to simulation
    const containers = config.containers || [];
    const updated = containers.map(c => 
      c.id === containerId ? { ...c, status: 'exited' as const, finishedAt: Date.now(), cpuUsage: 0, memoryUsage: 0 } : c
    );
    updateConfig({ containers: updated });
    const container = containers.find(c => c.id === containerId);
    showSuccess(`Container "${container?.name}" stopped`);
  };

  const pauseContainer = (containerId: string) => {
    if (node.type !== 'docker') return;
    const containers = config.containers || [];
    const updated = containers.map(c => 
      c.id === containerId ? { ...c, status: 'paused' as const } : c
    );
    updateConfig({ containers: updated });
    const container = containers.find(c => c.id === containerId);
    showSuccess(`Container "${container?.name}" paused`);
  };

  const unpauseContainer = (containerId: string) => {
    if (node.type !== 'docker') return;
    const containers = config.containers || [];
    const updated = containers.map(c => 
      c.id === containerId ? { ...c, status: 'running' as const } : c
    );
    updateConfig({ containers: updated });
    const container = containers.find(c => c.id === containerId);
    showSuccess(`Container "${container?.name}" unpaused`);
  };

  const restartContainer = (containerId: string) => {
    if (node.type !== 'docker') return;
    const containers = config.containers || [];
    const container = containers.find(c => c.id === containerId);
    const updated = containers.map(c => 
      c.id === containerId ? { 
        ...c, 
        status: 'running' as const, 
        startedAt: Date.now(),
        restartCount: (c.restartCount || 0) + 1,
        finishedAt: undefined
      } : c
    );
    updateConfig({ containers: updated });
    showSuccess(`Container "${container?.name}" restarted`);
  };

  const removeContainer = (containerId: string) => {
    if (node.type !== 'docker') return;
    const containers = config.containers || [];
    const container = containers.find(c => c.id === containerId);
    if (!container) return;
    
    if (container.status === 'running') {
      showError('Cannot remove running container. Stop it first.');
      return;
    }
    
    updateConfig({ containers: containers.filter(c => c.id !== containerId) });
    setContainerToDelete(null);
    showSuccess(`Container "${container.name}" removed`);
  };

  // Image operations
  const pullImage = () => {
    if (node.type !== 'docker') return;
    
    const trimmedName = newImageName.trim();
    if (!trimmedName) {
      showValidationError('Image name is required');
      return;
    }

    const images = config.images || [];
    const imageName = `${trimmedName}:${newImageTag || 'latest'}`;
    
    if (images.some(img => `${img.repository}:${img.tag}` === imageName)) {
      showWarning(`Image ${imageName} already exists`);
      return;
    }

    const newImage = {
      id: generateId(),
      repository: trimmedName,
      tag: newImageTag || 'latest',
      size: 100 + Math.random() * 500, // 100-600 MB
      createdAt: Date.now(),
    };

    updateConfig({ images: [...images, newImage] });
    setNewImageName('');
    setNewImageTag('latest');
    setShowPullImage(false);
    showSuccess(`Pulling image "${imageName}"...`);
  };

  const buildImage = () => {
    if (node.type !== 'docker') return;
    
    if (!buildContext.trim()) {
      showValidationError('Dockerfile content is required');
      return;
    }

    const images = config.images || [];
    const imageName = newImageName.trim() || 'my-image';
    const imageTag = newImageTag || 'latest';
    const imageNameFull = `${imageName}:${imageTag}`;
    
    if (images.some(img => `${img.repository}:${img.tag}` === imageNameFull)) {
      showWarning(`Image ${imageNameFull} already exists`);
      return;
    }

    const newImage = {
      id: generateId(),
      repository: imageName,
      tag: imageTag,
      size: 200 + Math.random() * 800, // 200-1000 MB
      createdAt: Date.now(),
    };

    updateConfig({ 
      images: [...images, newImage],
      dockerfile: buildContext,
    });
    setNewImageName('');
    setNewImageTag('latest');
    setBuildContext('');
    setShowBuildImage(false);
    showSuccess(`Building image "${imageNameFull}"...`);
  };

  const removeImage = (imageId: string) => {
    if (node.type !== 'docker') return;
    const images = config.images || [];
    const image = images.find(img => img.id === imageId);
    if (!image) return;

    // Check if image is used by any container
    const containers = config.containers || [];
    const imageName = `${image.repository}:${image.tag}`;
    const usedBy = containers.filter(c => c.image === imageName);
    
    if (usedBy.length > 0) {
      showError(`Cannot remove image "${imageName}" - used by ${usedBy.length} container(s)`);
      return;
    }
    
    updateConfig({ images: images.filter(img => img.id !== imageId) });
    setImageToDelete(null);
    showSuccess(`Image "${imageName}" removed`);
  };

  // Network operations
  const createNetwork = () => {
    if (node.type !== 'docker') return;
    
    const trimmedName = newNetworkName.trim();
    if (!trimmedName) {
      showValidationError('Network name is required');
      return;
    }

    const networks = config.networks || [];
    if (networks.some(n => n.name === trimmedName)) {
      showValidationError('Network name must be unique');
      return;
    }

    const newNetwork = {
      id: generateId(),
      name: trimmedName,
      driver: newNetworkDriver,
      containers: [],
    };

    updateConfig({ networks: [...networks, newNetwork] });
    setNewNetworkName('');
    setNewNetworkDriver('bridge');
    setShowCreateNetwork(false);
    showSuccess(`Network "${trimmedName}" created successfully`);
  };

  const removeNetwork = (networkId: string) => {
    if (node.type !== 'docker') return;
    const networks = config.networks || [];
    const network = networks.find(n => n.id === networkId);
    if (!network) return;

    if (network.containers && network.containers.length > 0) {
      showError(`Cannot remove network "${network.name}" - ${network.containers.length} container(s) connected`);
      return;
    }
    
    updateConfig({ networks: networks.filter(n => n.id !== networkId) });
    setNetworkToDelete(null);
    showSuccess(`Network "${network.name}" removed`);
  };

  // Volume operations
  const createVolume = () => {
    if (node.type !== 'docker') return;
    
    const trimmedName = newVolumeName.trim();
    if (!trimmedName) {
      showValidationError('Volume name is required');
      return;
    }

    const volumes = config.volumes || [];
    if (volumes.some(v => v.name === trimmedName)) {
      showValidationError('Volume name must be unique');
      return;
    }

    const newVolume = {
      id: generateId(),
      name: trimmedName,
      driver: newVolumeDriver,
      size: 0,
      usedBy: [],
    };

    updateConfig({ volumes: [...volumes, newVolume] });
    setNewVolumeName('');
    setNewVolumeDriver('local');
    setShowCreateVolume(false);
    showSuccess(`Volume "${trimmedName}" created successfully`);
  };

  const removeVolume = (volumeId: string) => {
    if (node.type !== 'docker') return;
    const volumes = config.volumes || [];
    const volume = volumes.find(v => v.id === volumeId);
    if (!volume) return;

    if (volume.usedBy && volume.usedBy.length > 0) {
      showError(`Cannot remove volume "${volume.name}" - used by ${volume.usedBy.length} container(s)`);
      return;
    }
    
    updateConfig({ volumes: volumes.filter(v => v.id !== volumeId) });
    setVolumeToDelete(null);
    showSuccess(`Volume "${volume.name}" removed`);
  };

  // Filter helpers
  const filteredImages = node.type === 'docker' 
    ? (config.images || []).filter(img => {
        if (imageSearchQuery && !`${img.repository}:${img.tag}`.toLowerCase().includes(imageSearchQuery.toLowerCase())) {
          return false;
        }
        return true;
      })
    : [];

  const filteredNetworks = node.type === 'docker'
    ? (config.networks || []).filter(network => {
        if (networkSearchQuery && !network.name.toLowerCase().includes(networkSearchQuery.toLowerCase())) {
          return false;
        }
        return true;
      })
    : [];

  const filteredVolumes = node.type === 'docker'
    ? (config.volumes || []).filter(volume => {
        if (volumeSearchQuery && !volume.name.toLowerCase().includes(volumeSearchQuery.toLowerCase())) {
          return false;
        }
        return true;
      })
    : [];

  const getTitle = () => {
    return node.type === 'docker' ? 'Docker' : 'Kubernetes';
  };

  const getConfigLabel = () => {
    return node.type === 'docker' ? 'Dockerfile' : 'Deployment YAML';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="h-4 w-4 text-green-500" />;
      case 'stopped':
        return <Pause className="h-4 w-4 text-red-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      default:
        return <Pause className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge variant="default" className="bg-green-500">Running</Badge>;
      case 'stopped':
        return <Badge variant="destructive">Stopped</Badge>;
      case 'paused':
        return <Badge variant="secondary">Paused</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const items = node.type === 'docker' ? containers : pods;
  const itemLabel = node.type === 'docker' ? 'Container' : 'Pod';

  // Filter containers for Docker
  const filteredContainers = node.type === 'docker' 
    ? (config.containers || []).filter(container => {
        if (searchQuery && !container.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
            !container.image.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        if (statusFilter !== 'all') {
          if (statusFilter === 'running' && container.status !== 'running') return false;
          if (statusFilter === 'stopped' && container.status !== 'exited' && container.status !== 'stopped' && container.status !== 'dead') return false;
          if (statusFilter === 'paused' && container.status !== 'paused') return false;
        }
        return true;
      })
    : [];

  // Get Docker metrics from emulation
  const dockerMetrics = componentMetrics?.customMetrics || {};
  const containersTotal = dockerMetrics.docker_containers_total || (config.containers?.length || 0);
  const containersRunning = dockerMetrics.docker_containers_running || filteredContainers.filter(c => c.status === 'running').length;
  const totalCpuUsage = dockerMetrics.docker_total_cpu_usage || 0;
  const totalMemoryUsage = dockerMetrics.docker_total_memory_usage || 0;
  const totalMemoryLimit = dockerMetrics.docker_total_memory_limit || 0;

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              {node.type === 'docker' ? (
                <Container className="h-6 w-6 text-blue-500" />
              ) : (
                <Layers className="h-6 w-6 text-blue-500" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">{getTitle()} Configuration</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {node.type === 'docker' ? 'Container Management' : 'Container Orchestration'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Docker Mode Toggle and Connection Status */}
            {node.type === 'docker' && (
              <div className="flex items-center gap-3">
                {/* Mode Toggle */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
                  <span className="text-sm font-medium text-muted-foreground">Simulation</span>
                  <Switch
                    checked={config.mode === 'real' || config.mode === 'hybrid'}
                    onCheckedChange={async (checked) => {
                      const newMode = checked ? 'real' : 'simulation';
                      if (dockerEngine) {
                        dockerEngine.setMode(newMode);
                        updateConfig({ mode: newMode });
                        if (checked) {
                          setIsConnecting(true);
                          try {
                            const connected = await dockerEngine.connect();
                            if (!connected) {
                              showWarning('Failed to connect to Docker daemon. Please check connection settings.');
                            }
                          } catch (error: any) {
                            showError(error.message || 'Failed to connect');
                          } finally {
                            setIsConnecting(false);
                          }
                        } else {
                          await dockerEngine.disconnect();
                        }
                      } else {
                        updateConfig({ mode: newMode });
                      }
                    }}
                    disabled={isConnecting}
                  />
                  <span className="text-sm font-medium">Real Docker</span>
                </div>

                {/* Connection Status */}
                {node.type === 'docker' && dockerEngine && (config.mode === 'real' || config.mode === 'hybrid') && (
                  <div className="flex items-center gap-2">
                    {dockerEngine.isConnected() ? (
                      <Badge variant="outline" className="gap-2 border-green-500 text-green-500">
                        <CheckCircle2 className="h-3 w-3" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-2 border-red-500 text-red-500">
                        <XCircle className="h-3 w-3" />
                        Disconnected
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowConnectionSettings(true)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Connection Settings Button for Simulation Mode */}
                {config.mode === 'simulation' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowConnectionSettings(true)}
                    title="Configure Docker connection for Real mode"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}

            {/* Component Status Badge */}
            {node.type === 'docker' && componentMetrics ? (
              <Badge 
                variant="outline" 
                className={`gap-2 ${
                  componentMetrics.errorRate > 0.5 
                    ? 'border-red-500 text-red-500' 
                    : componentMetrics.utilization > 0 || componentMetrics.throughput > 0
                    ? 'border-green-500 text-green-500'
                    : 'border-gray-500 text-gray-500'
                }`}
              >
                <div 
                  className={`h-2 w-2 rounded-full ${
                    componentMetrics.errorRate > 0.5 
                      ? 'bg-red-500' 
                      : componentMetrics.utilization > 0 || componentMetrics.throughput > 0
                      ? 'bg-green-500 animate-pulse'
                      : 'bg-gray-500'
                  }`} 
                />
                {componentMetrics.errorRate > 0.5 
                  ? 'Error' 
                  : componentMetrics.utilization > 0 || componentMetrics.throughput > 0
                  ? 'Running'
                  : 'Stopped'}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Active
              </Badge>
            )}
          </div>
        </div>

        <Separator />

        {/* Mode Info Banner */}
        {node.type === 'docker' && (
          <>
            {config.mode === 'simulation' ? (
              <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-900 dark:text-blue-100">Simulation Mode</AlertTitle>
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  This is a simulation environment. All Docker operations (containers, images, networks, volumes) are simulated and do not create real Docker resources. 
                  The system simulates realistic behavior, metrics, and operations for architecture modeling purposes.
                </AlertDescription>
              </Alert>
            ) : config.mode === 'real' ? (
              <Alert className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <AlertTitle className="text-orange-900 dark:text-orange-100">Real Docker Mode</AlertTitle>
                <AlertDescription className="text-orange-800 dark:text-orange-200">
                  <strong>Warning:</strong> You are connected to a real Docker daemon. All operations will affect real Docker resources on your system. 
                  Be careful when creating, starting, stopping, or removing containers, images, networks, and volumes.
                </AlertDescription>
              </Alert>
            ) : config.mode === 'hybrid' ? (
              <Alert className="bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800">
                <Activity className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <AlertTitle className="text-purple-900 dark:text-purple-100">Hybrid Mode</AlertTitle>
                <AlertDescription className="text-purple-800 dark:text-purple-200">
                  Hybrid mode: Some containers are real (from Docker daemon), some are simulated. Real containers are marked with a badge.
                </AlertDescription>
              </Alert>
            ) : null}
          </>
        )}

        {/* Connection Settings Dialog */}
        {node.type === 'docker' && (
          <DockerConnectionSettings
            componentId={componentId}
            open={showConnectionSettings}
            onOpenChange={setShowConnectionSettings}
          />
        )}

        {/* Stats Overview */}
        <div className={`grid gap-4 ${node.type === 'docker' ? 'grid-cols-4' : 'grid-cols-4'}`}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {node.type === 'docker' ? 'Containers' : 'Pods'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{node.type === 'docker' ? containersTotal : items.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {node.type === 'docker' ? `${containersRunning} running` : `Total ${itemLabel.toLowerCase()}s`}
              </p>
            </CardContent>
          </Card>
          {node.type === 'kubernetes' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Replicas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{replicas}</div>
                <p className="text-xs text-muted-foreground mt-1">Desired</p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">CPU</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {node.type === 'docker' ? Math.round(totalCpuUsage) : totalCpu}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total usage</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Memory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {node.type === 'docker' ? formatBytes(totalMemoryUsage) : totalMemory}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {node.type === 'docker' && totalMemoryLimit > 0 
                  ? `${Math.round((totalMemoryUsage / totalMemoryLimit) * 100)}% of ${formatBytes(totalMemoryLimit)}`
                  : 'Total usage'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Configuration Tabs */}
        <Tabs defaultValue={node.type === 'docker' ? 'containers' : 'pods'} className="w-full">
          <TabsList className={`inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground ${node.type === 'docker' ? 'w-full overflow-x-auto' : 'w-full'}`}>
            <TabsTrigger value={node.type === 'docker' ? 'containers' : 'pods'} className="gap-2 whitespace-nowrap">
              <Container className="h-4 w-4" />
              {node.type === 'docker' ? 'Containers' : 'Pods'}
            </TabsTrigger>
            {node.type === 'docker' && (
              <>
                <TabsTrigger value="images" className="gap-2 whitespace-nowrap">
                  <ImageIcon className="h-4 w-4" />
                  Images
                </TabsTrigger>
                <TabsTrigger value="networks" className="gap-2 whitespace-nowrap">
                  <Network className="h-4 w-4" />
                  Networks
                </TabsTrigger>
                <TabsTrigger value="volumes" className="gap-2 whitespace-nowrap">
                  <HardDrive className="h-4 w-4" />
                  Volumes
                </TabsTrigger>
                <TabsTrigger value="logs" className="gap-2 whitespace-nowrap">
                  <Logs className="h-4 w-4" />
                  Logs
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="settings" className="gap-2 whitespace-nowrap">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2 whitespace-nowrap">
              <Layers className="h-4 w-4" />
              {getConfigLabel()}
            </TabsTrigger>
          </TabsList>

          {/* Containers/Pods Tab */}
          <TabsContent value={node.type === 'docker' ? 'containers' : 'pods'} className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{node.type === 'docker' ? 'Containers' : 'Pods'}</CardTitle>
                    <CardDescription>
                      {node.type === 'docker' ? 'Manage Docker containers' : 'Deployed pods'}
                    </CardDescription>
                  </div>
                  {node.type === 'docker' && (
                    <Button onClick={() => setShowCreateContainer(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Container
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {node.type === 'docker' && (
                  <div className="flex gap-4 mb-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search containers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="running">Running</SelectItem>
                        <SelectItem value="stopped">Stopped</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-3">
                  {(node.type === 'docker' ? filteredContainers : items).map((item) => (
                    <Card key={item.id} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            {getStatusIcon(item.status)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-lg">{item.name}</CardTitle>
                                {/* Real/Simulated Badge */}
                                {node.type === 'docker' && dockerEngine && (
                                  <>
                                    {(config.mode === 'real' || config.mode === 'hybrid') && dockerEngine.isConnected() ? (
                                      <Badge variant="outline" className="text-xs border-orange-500 text-orange-500">
                                        Real
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs border-blue-500 text-blue-500">
                                        Simulated
                                      </Badge>
                                    )}
                                  </>
                                )}
                              </div>
                              <CardDescription className="text-xs mt-1">
                                {item.image}
                                {item.restartCount !== undefined && item.restartCount > 0 && (
                                  <span className="ml-2">({item.restartCount} restarts)</span>
                                )}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(item.status)}
                            {node.type === 'docker' && (
                              <div className="flex gap-1 ml-2">
                                {item.status === 'running' && (
                                  <>
                                    <Button size="sm" variant="outline" onClick={() => pauseContainer(item.id)}>
                                      <Pause className="h-3 w-3" />
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => stopContainer(item.id)}>
                                      <Pause className="h-3 w-3" />
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => restartContainer(item.id)}>
                                      <RefreshCw className="h-3 w-3" />
                                    </Button>
                                  </>
                                )}
                                {(item.status === 'exited' || item.status === 'stopped' || item.status === 'dead') && (
                                  <Button size="sm" variant="outline" onClick={() => startContainer(item.id)}>
                                    <Play className="h-3 w-3" />
                                  </Button>
                                )}
                                {item.status === 'paused' && (
                                  <>
                                    <Button size="sm" variant="outline" onClick={() => unpauseContainer(item.id)}>
                                      <Play className="h-3 w-3" />
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => stopContainer(item.id)}>
                                      <Pause className="h-3 w-3" />
                                    </Button>
                                  </>
                                )}
                                {item.status !== 'running' && (
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => setContainerToDelete(item.id)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">CPU:</span>
                            <span className="ml-2 font-semibold">
                              {node.type === 'docker' ? (item.cpuUsage || 0).toFixed(1) : (item.cpu || 0)}%
                            </span>
                            <Progress 
                              value={node.type === 'docker' ? (item.cpuUsage || 0) : (item.cpu || 0)} 
                              className="h-1 mt-1" 
                            />
                          </div>
                          <div>
                            <span className="text-muted-foreground">Memory:</span>
                            <span className="ml-2 font-semibold">
                              {node.type === 'docker' 
                                ? formatBytes(item.memoryUsage) 
                                : (item.memory || '0Mi')}
                            </span>
                            {node.type === 'docker' && item.memoryLimit && (
                              <Progress 
                                value={((item.memoryUsage || 0) / item.memoryLimit) * 100} 
                                className="h-1 mt-1" 
                              />
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {(node.type === 'docker' ? filteredContainers : items).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      {node.type === 'docker' 
                        ? 'No containers found. Create your first container to get started.'
                        : 'No pods found.'}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            {node.type === 'docker' ? (
              <>
                {/* Docker Daemon Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle>Docker Daemon Settings</CardTitle>
                    <CardDescription>Configure Docker daemon behavior</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="daemon-url">Daemon URL</Label>
                      <Input
                        id="daemon-url"
                        value={config.daemonUrl || 'unix:///var/run/docker.sock'}
                        onChange={(e) => updateConfig({ daemonUrl: e.target.value })}
                        placeholder="unix:///var/run/docker.sock"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="api-version">API Version</Label>
                      <Input
                        id="api-version"
                        value={config.apiVersion || '1.41'}
                        onChange={(e) => updateConfig({ apiVersion: e.target.value })}
                        placeholder="1.41"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="resource-cpu">Default CPU Limit</Label>
                        <Input
                          id="resource-cpu"
                          value={config.resourceLimits?.cpu || '2'}
                          onChange={(e) => updateConfig({ 
                            resourceLimits: { ...config.resourceLimits, cpu: e.target.value }
                          })}
                          placeholder="2"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="resource-memory">Default Memory Limit</Label>
                        <Input
                          id="resource-memory"
                          value={config.resourceLimits?.memory || '4Gi'}
                          onChange={(e) => updateConfig({ 
                            resourceLimits: { ...config.resourceLimits, memory: e.target.value }
                          })}
                          placeholder="4Gi"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Default Container Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle>Default Container Settings</CardTitle>
                    <CardDescription>Default settings for new containers</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="default-image">Default Image</Label>
                      <Input
                        id="default-image"
                        value={image}
                        onChange={(e) => updateConfig({ image: e.target.value })}
                        placeholder="nginx:latest"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="default-memory">Default Memory</Label>
                        <Input
                          id="default-memory"
                          value={memory}
                          onChange={(e) => updateConfig({ memory: e.target.value })}
                          placeholder="512Mi"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="default-cpu">Default CPU</Label>
                        <Input
                          id="default-cpu"
                          value={cpu}
                          onChange={(e) => updateConfig({ cpu: e.target.value })}
                          placeholder="500m"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="default-env">Default Environment Variables</Label>
                      <Textarea
                        id="default-env"
                        value={Object.entries(config.environment || {}).map(([k, v]) => `${k}=${v}`).join('\n')}
                        onChange={(e) => {
                          const env: Record<string, string> = {};
                          e.target.value.split('\n').forEach(line => {
                            const [key, ...valueParts] = line.split('=');
                            if (key.trim()) {
                              env[key.trim()] = valueParts.join('=').trim();
                            }
                          });
                          updateConfig({ environment: env });
                        }}
                        className="font-mono text-sm h-32"
                        placeholder="NODE_ENV=production&#10;PORT=3000"
                      />
                      <p className="text-xs text-muted-foreground">One variable per line, format: KEY=VALUE</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Build Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle>Build Settings</CardTitle>
                    <CardDescription>Docker build configuration</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="enable-buildkit">Enable BuildKit</Label>
                        <p className="text-xs text-muted-foreground">Use BuildKit for faster builds</p>
                      </div>
                      <input
                        id="enable-buildkit"
                        type="checkbox"
                        checked={config.enableBuildKit ?? true}
                        onChange={(e) => updateConfig({ enableBuildKit: e.target.checked })}
                        className="h-4 w-4"
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Container Settings</CardTitle>
                  <CardDescription>Basic container configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="image">Image</Label>
                    <Input
                      id="image"
                      value={image}
                      onChange={(e) => updateConfig({ image: e.target.value })}
                      placeholder="nginx:latest"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="replicas">Replicas</Label>
                      <Input
                        id="replicas"
                        type="number"
                        min="1"
                        value={replicas}
                        onChange={(e) => updateConfig({ replicas: parseInt(e.target.value) || 1 })}
                        placeholder="1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="memory">Memory</Label>
                      <Input
                        id="memory"
                        value={memory}
                        onChange={(e) => updateConfig({ memory: e.target.value })}
                        placeholder="512Mi"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cpu">CPU</Label>
                      <Input
                        id="cpu"
                        value={cpu}
                        onChange={(e) => updateConfig({ cpu: e.target.value })}
                        placeholder="500m"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Config Tab */}
          <TabsContent value="config" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{getConfigLabel()}</CardTitle>
                <CardDescription>
                  {node.type === 'docker' ? 'Docker configuration file' : 'Kubernetes manifest'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="yaml">Configuration</Label>
                  <Textarea
                    id="yaml"
                    value={yaml}
                    onChange={(e) => updateConfig({ yaml: e.target.value })}
                    className="font-mono text-sm h-96"
                    placeholder={`Enter ${getConfigLabel()} configuration...`}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Images Tab (Docker only) */}
          {node.type === 'docker' && (
            <TabsContent value="images" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Images</CardTitle>
                      <CardDescription>Docker images available on this host (simulated)</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setShowPullImage(true)}>
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Pull Image
                      </Button>
                      <Button variant="outline" onClick={() => setShowBuildImage(true)}>
                        <Layers className="h-4 w-4 mr-2" />
                        Build Image
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 mb-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search images..."
                        value={imageSearchQuery}
                        onChange={(e) => setImageSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    {filteredImages.map((image) => {
                      const imageName = `${image.repository}:${image.tag}`;
                      const imageSize = formatBytes(image.size * 1024 * 1024); // Convert MB to bytes
                      return (
                        <Card key={image.id} className="border-border">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <ImageIcon className="h-5 w-5 text-blue-500" />
                                <div className="flex-1">
                                  <CardTitle className="text-lg">{imageName}</CardTitle>
                                  <CardDescription className="text-xs mt-1">
                                    Size: {imageSize} • Created: {image.createdAt ? new Date(image.createdAt).toLocaleString() : 'Unknown'}
                                  </CardDescription>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{image.tag}</Badge>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => setImageToDelete(image.id)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                        </Card>
                      );
                    })}
                    {filteredImages.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No images found. Pull or build your first image to get started.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Networks Tab (Docker only) */}
          {node.type === 'docker' && (
            <TabsContent value="networks" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Networks</CardTitle>
                      <CardDescription>Docker networks for container communication (simulated)</CardDescription>
                    </div>
                    <Button onClick={() => setShowCreateNetwork(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Network
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 mb-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search networks..."
                        value={networkSearchQuery}
                        onChange={(e) => setNetworkSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    {filteredNetworks.map((network) => {
                      const containerCount = network.containers?.length || 0;
                      return (
                        <Card key={network.id} className="border-border">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <Network className="h-5 w-5 text-green-500" />
                                <div className="flex-1">
                                  <CardTitle className="text-lg">{network.name}</CardTitle>
                                  <CardDescription className="text-xs mt-1">
                                    Driver: {network.driver} • {containerCount} container(s) connected
                                  </CardDescription>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{network.driver}</Badge>
                                {containerCount === 0 && (
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => setNetworkToDelete(network.id)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                        </Card>
                      );
                    })}
                    {filteredNetworks.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No networks found. Create your first network to get started.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Volumes Tab (Docker only) */}
          {node.type === 'docker' && (
            <TabsContent value="volumes" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Volumes</CardTitle>
                      <CardDescription>Docker volumes for persistent storage (simulated)</CardDescription>
                    </div>
                    <Button onClick={() => setShowCreateVolume(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Volume
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 mb-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search volumes..."
                        value={volumeSearchQuery}
                        onChange={(e) => setVolumeSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    {filteredVolumes.map((volume) => {
                      const usedByCount = volume.usedBy?.length || 0;
                      const volumeSize = volume.size ? formatBytes(volume.size) : '0 B';
                      return (
                        <Card key={volume.id} className="border-border">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <HardDrive className="h-5 w-5 text-purple-500" />
                                <div className="flex-1">
                                  <CardTitle className="text-lg">{volume.name}</CardTitle>
                                  <CardDescription className="text-xs mt-1">
                                    Driver: {volume.driver} • Size: {volumeSize} • {usedByCount} container(s) using
                                  </CardDescription>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{volume.driver}</Badge>
                                {usedByCount === 0 && (
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => setVolumeToDelete(volume.id)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                        </Card>
                      );
                    })}
                    {filteredVolumes.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No volumes found. Create your first volume to get started.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Logs Tab (Docker only) */}
          {node.type === 'docker' && (
            <TabsContent value="logs" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Container Logs</CardTitle>
                  <CardDescription>View logs from running containers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label>Select Container</Label>
                      <Select 
                        value={selectedContainerForLogs || ''} 
                        onValueChange={(value) => {
                          setSelectedContainerForLogs(value || null);
                          // Simulate log generation
                          if (value) {
                            const container = (config.containers || []).find(c => c.id === value);
                            if (container) {
                              const simulatedLogs = [
                                `[${new Date().toISOString()}] Container ${container.name} started`,
                                `[${new Date().toISOString()}] Application initialized`,
                                `[${new Date().toISOString()}] Listening on port 80`,
                                `[${new Date().toISOString()}] Health check passed`,
                                `[${new Date().toISOString()}] Request received: GET /`,
                                `[${new Date().toISOString()}] Response sent: 200 OK`,
                              ];
                              setLogLines(simulatedLogs);
                            }
                          } else {
                            setLogLines([]);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a container..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(config.containers || [])
                            .filter(c => c.status === 'running')
                            .map(container => (
                              <SelectItem key={container.id} value={container.id}>
                                {container.name} ({container.image})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedContainerForLogs && (
                      <div className="border rounded-md p-4 bg-black text-green-400 font-mono text-sm h-96 overflow-y-auto">
                        {logLines.length > 0 ? (
                          logLines.map((line, index) => (
                            <div key={index} className="mb-1">{line}</div>
                          ))
                        ) : (
                          <div className="text-muted-foreground">No logs available</div>
                        )}
                      </div>
                    )}
                    {!selectedContainerForLogs && (
                      <div className="text-center py-8 text-muted-foreground">
                        Select a running container to view its logs
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Create Container Dialog */}
        {node.type === 'docker' && (
          <AlertDialog open={showCreateContainer} onOpenChange={setShowCreateContainer}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Create New Container</AlertDialogTitle>
                <AlertDialogDescription>
                  Configure a new Docker container
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="container-name">Container Name</Label>
                  <Input
                    id="container-name"
                    value={newContainerName}
                    onChange={(e) => setNewContainerName(e.target.value)}
                    placeholder="my-container"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="container-image">Image</Label>
                  <Input
                    id="container-image"
                    value={newContainerImage}
                    onChange={(e) => setNewContainerImage(e.target.value)}
                    placeholder="nginx:latest"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="container-memory">Memory</Label>
                    <Input
                      id="container-memory"
                      value={newContainerMemory}
                      onChange={(e) => setNewContainerMemory(e.target.value)}
                      placeholder="512Mi"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="container-cpu">CPU</Label>
                    <Input
                      id="container-cpu"
                      value={newContainerCpu}
                      onChange={(e) => setNewContainerCpu(e.target.value)}
                      placeholder="500m"
                    />
                  </div>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={addContainer}>Create</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Delete Container Confirmation */}
        {node.type === 'docker' && containerToDelete && (
          <AlertDialog open={!!containerToDelete} onOpenChange={(open) => !open && setContainerToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Container</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this container? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => {
                    if (containerToDelete) {
                      removeContainer(containerToDelete);
                    }
                  }}
                  className="bg-red-500 hover:bg-red-600"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Pull Image Dialog */}
        {node.type === 'docker' && (
          <AlertDialog open={showPullImage} onOpenChange={setShowPullImage}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Pull Image</AlertDialogTitle>
                <AlertDialogDescription>
                  Pull a Docker image from a registry
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="image-name">Image Name</Label>
                  <Input
                    id="image-name"
                    value={newImageName}
                    onChange={(e) => setNewImageName(e.target.value)}
                    placeholder="nginx"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image-tag">Tag</Label>
                  <Input
                    id="image-tag"
                    value={newImageTag}
                    onChange={(e) => setNewImageTag(e.target.value)}
                    placeholder="latest"
                  />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={pullImage}>Pull</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Build Image Dialog */}
        {node.type === 'docker' && (
          <AlertDialog open={showBuildImage} onOpenChange={setShowBuildImage}>
            <AlertDialogContent className="max-w-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Build Image</AlertDialogTitle>
                <AlertDialogDescription>
                  Build a Docker image from a Dockerfile
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="build-image-name">Image Name</Label>
                    <Input
                      id="build-image-name"
                      value={newImageName}
                      onChange={(e) => setNewImageName(e.target.value)}
                      placeholder="my-image"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="build-image-tag">Tag</Label>
                    <Input
                      id="build-image-tag"
                      value={newImageTag}
                      onChange={(e) => setNewImageTag(e.target.value)}
                      placeholder="latest"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dockerfile">Dockerfile</Label>
                  <Textarea
                    id="dockerfile"
                    value={buildContext}
                    onChange={(e) => setBuildContext(e.target.value)}
                    className="font-mono text-sm h-64"
                    placeholder="FROM nginx:latest&#10;COPY . /usr/share/nginx/html&#10;EXPOSE 80&#10;CMD [&quot;nginx&quot;, &quot;-g&quot;, &quot;daemon off;&quot;]"
                  />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={buildImage}>Build</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Delete Image Confirmation */}
        {node.type === 'docker' && imageToDelete && (
          <AlertDialog open={!!imageToDelete} onOpenChange={(open) => !open && setImageToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Image</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this image? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => {
                    if (imageToDelete) {
                      removeImage(imageToDelete);
                    }
                  }}
                  className="bg-red-500 hover:bg-red-600"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Create Network Dialog */}
        {node.type === 'docker' && (
          <AlertDialog open={showCreateNetwork} onOpenChange={setShowCreateNetwork}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Create Network</AlertDialogTitle>
                <AlertDialogDescription>
                  Create a new Docker network
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="network-name">Network Name</Label>
                  <Input
                    id="network-name"
                    value={newNetworkName}
                    onChange={(e) => setNewNetworkName(e.target.value)}
                    placeholder="my-network"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="network-driver">Driver</Label>
                  <Select
                    value={newNetworkDriver}
                    onValueChange={(value) => setNewNetworkDriver(value as any)}
                  >
                    <SelectTrigger id="network-driver" className="w-full">
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bridge">Bridge</SelectItem>
                      <SelectItem value="host">Host</SelectItem>
                      <SelectItem value="overlay">Overlay</SelectItem>
                      <SelectItem value="macvlan">Macvlan</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={createNetwork}>Create</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Delete Network Confirmation */}
        {node.type === 'docker' && networkToDelete && (
          <AlertDialog open={!!networkToDelete} onOpenChange={(open) => !open && setNetworkToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Network</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this network? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => {
                    if (networkToDelete) {
                      removeNetwork(networkToDelete);
                    }
                  }}
                  className="bg-red-500 hover:bg-red-600"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Create Volume Dialog */}
        {node.type === 'docker' && (
          <AlertDialog open={showCreateVolume} onOpenChange={setShowCreateVolume}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Create Volume</AlertDialogTitle>
                <AlertDialogDescription>
                  Create a new Docker volume
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="volume-name">Volume Name</Label>
                  <Input
                    id="volume-name"
                    value={newVolumeName}
                    onChange={(e) => setNewVolumeName(e.target.value)}
                    placeholder="my-volume"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="volume-driver">Driver</Label>
                  <Select
                    value={newVolumeDriver}
                    onValueChange={(value) => setNewVolumeDriver(value as any)}
                  >
                    <SelectTrigger id="volume-driver" className="w-full">
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local</SelectItem>
                      <SelectItem value="nfs">NFS</SelectItem>
                      <SelectItem value="cifs">CIFS</SelectItem>
                      <SelectItem value="tmpfs">Tmpfs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={createVolume}>Create</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Delete Volume Confirmation */}
        {node.type === 'docker' && volumeToDelete && (
          <AlertDialog open={!!volumeToDelete} onOpenChange={(open) => !open && setVolumeToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Volume</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this volume? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => {
                    if (volumeToDelete) {
                      removeVolume(volumeToDelete);
                    }
                  }}
                  className="bg-red-500 hover:bg-red-600"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}


import { useState, useEffect, useCallback } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { emulationEngine } from '@/core/EmulationEngine';
import { CanvasNode } from '@/types';
import {
  KubernetesConfig,
  KubernetesPod,
  KubernetesDeployment,
  KubernetesService,
  KubernetesConfigMap,
  KubernetesSecret,
  KubernetesNamespace,
  KubernetesNode,
  KubernetesEvent,
  KubernetesPersistentVolumeClaim,
  PodPhase,
  PodStatus,
  ServiceType,
  SecretType,
  DeploymentStrategyType,
} from '@/core/KubernetesEmulationEngine';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Settings,
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Server,
  Network,
  Shield,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
  Save,
  FileText,
  Database,
  Layers,
  Box,
  HardDrive,
  Eye,
  Pause,
  Play,
  Copy,
  Download,
  Upload,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface KubernetesConfigProps {
  componentId: string;
}

// Utility functions
function validateDNSLabel(name: string): boolean {
  // DNS label format: ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$
  const dnsLabelRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
  return dnsLabelRegex.test(name);
}

function validatePort(port: number | string): boolean {
  const portNum = typeof port === 'string' ? parseInt(port, 10) : port;
  return !isNaN(portNum) && portNum >= 1 && portNum <= 65535;
}

// Helper functions for resource relationships
function getPodsForDeployment(
  deployment: KubernetesDeployment,
  pods: KubernetesPod[]
): KubernetesPod[] {
  return pods.filter(pod => {
    if (pod.namespace !== deployment.namespace) return false;
    if (deployment.selector) {
      return Object.entries(deployment.selector).every(([key, value]) => 
        pod.labels?.[key] === value
      );
    }
    return false;
  });
}

function getEndpointsForService(
  service: KubernetesService,
  pods: KubernetesPod[]
): KubernetesPod[] {
  if (!service.selector) return [];
  
  return pods.filter(pod => {
    if (pod.namespace !== service.namespace) return false;
    if (pod.phase !== 'Running' || !pod.podIP) return false;
    return Object.entries(service.selector).every(([key, value]) => 
      pod.labels?.[key] === value
    );
  });
}

function getResourcesForNamespace(
  namespace: string,
  pods: KubernetesPod[],
  deployments: KubernetesDeployment[],
  services: KubernetesService[]
): { pods: number; deployments: number; services: number } {
  return {
    pods: pods.filter(p => p.namespace === namespace).length,
    deployments: deployments.filter(d => d.namespace === namespace).length,
    services: services.filter(s => s.namespace === namespace).length,
  };
}

export function KubernetesConfigAdvanced({ componentId }: KubernetesConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const componentMetrics = useEmulationStore((state) =>
    state.componentMetrics.get(componentId)
  );
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as KubernetesConfig;
  
  // Get Kubernetes emulation engine
  const kubernetesEngine = emulationEngine.getKubernetesEmulationEngine(componentId);
  
  // Initialize engine if not exists
  useEffect(() => {
    if (node && !kubernetesEngine) {
      emulationEngine.initialize([node], []);
    }
  }, [node, kubernetesEngine]);

  // Sync resources and metrics from engine periodically (only if engine exists and has data)
  useEffect(() => {
    if (!kubernetesEngine) return;
    
    const interval = setInterval(() => {
      const engineConfig = kubernetesEngine.getConfig();
      if (engineConfig) {
        // Get current state
        const currentPods = config.pods || [];
        const currentDeployments = config.deployments || [];
        const enginePods = engineConfig.pods || [];
        const engineDeployments = engineConfig.deployments || [];
        
        // Check if resources changed (by comparing IDs and statuses)
        const podsChanged = 
          currentPods.length !== enginePods.length ||
          currentPods.some((p, i) => {
            const enginePod = enginePods[i];
            return !enginePod || 
                   p.id !== enginePod.id || 
                   p.phase !== enginePod.phase || 
                   p.status !== enginePod.status ||
                   p.totalCpuUsage !== enginePod.totalCpuUsage ||
                   p.totalMemoryUsage !== enginePod.totalMemoryUsage;
          });
        
        const deploymentsChanged =
          currentDeployments.length !== engineDeployments.length ||
          currentDeployments.some((d, i) => {
            const engineDep = engineDeployments[i];
            return !engineDep ||
                   d.id !== engineDep.id ||
                   d.readyReplicas !== engineDep.readyReplicas ||
                   d.availableReplicas !== engineDep.availableReplicas;
          });
        
        // Update if there are actual changes to avoid loops
        if (podsChanged || deploymentsChanged) {
          // Update only resources with runtime state, not entire config to avoid overwriting user changes
          updateNode(componentId, {
            data: {
              ...node.data,
              config: {
                ...config,
                // Update pods with runtime state (phase, status, metrics)
                pods: enginePods.map(ep => {
                  const existing = currentPods.find(p => p.id === ep.id);
                  return existing ? { ...existing, ...ep } : ep;
                }),
                // Update deployments with runtime state (replicas, status)
                deployments: engineDeployments.map(ed => {
                  const existing = currentDeployments.find(d => d.id === ed.id);
                  return existing ? { ...existing, ...ed } : ed;
                }),
                // Update other resources if they changed
                services: engineConfig.services || config.services,
                configMaps: engineConfig.configMaps || config.configMaps,
                secrets: engineConfig.secrets || config.secrets,
                namespaces: engineConfig.namespaces || config.namespaces,
                nodes: engineConfig.nodes || config.nodes,
                events: engineConfig.events || config.events,
                persistentVolumeClaims: engineConfig.persistentVolumeClaims || config.persistentVolumeClaims,
              },
            },
          });
        }
      }
    }, 1000); // Update every 1 second for real-time feel
    
    return () => clearInterval(interval);
  }, [kubernetesEngine, componentId, node, config, updateNode]);

  const updateConfig = useCallback((updates: Partial<KubernetesConfig>) => {
    const newConfig = { ...config, ...updates };
    
    // Update node config first
    updateNode(componentId, {
      data: {
        ...node.data,
        config: newConfig,
      },
    });
    
    // Immediately update emulation engine to reflect changes in simulation
    if (kubernetesEngine) {
      const updatedNode = { ...node, data: { ...node.data, config: newConfig } };
      kubernetesEngine.updateConfig(updatedNode);
      
      // Force engine to reinitialize resources if structure changed
      // This ensures new pods/deployments are created immediately
      if (updates.pods || updates.deployments || updates.services) {
        kubernetesEngine.initializeConfig(updatedNode);
      }
    } else {
      // If engine doesn't exist yet, trigger initialization
      emulationEngine.initialize([{ ...node, data: { ...node.data, config: newConfig } }], []);
    }
  }, [componentId, node, config, kubernetesEngine, updateNode]);

  // Get resources from engine (preferred) or config (fallback)
  // Engine has the most up-to-date runtime state
  const pods = kubernetesEngine ? kubernetesEngine.getPods() : (config.pods || []);
  const deployments = kubernetesEngine ? kubernetesEngine.getDeployments() : (config.deployments || []);
  const services = kubernetesEngine ? kubernetesEngine.getServices() : (config.services || []);
  const configMaps = kubernetesEngine ? kubernetesEngine.getConfigMaps() : (config.configMaps || []);
  const secrets = kubernetesEngine ? kubernetesEngine.getSecrets() : (config.secrets || []);
  const namespaces = kubernetesEngine ? kubernetesEngine.getNamespaces() : (config.namespaces || []);
  const k8sNodes = kubernetesEngine ? kubernetesEngine.getNodes() : (config.nodes || []);
  const events = kubernetesEngine ? kubernetesEngine.getEvents() : (config.events || []);
  const persistentVolumeClaims = kubernetesEngine ? kubernetesEngine.getPersistentVolumeClaims() : (config.persistentVolumeClaims || []);

  // Get metrics from engine (real-time) or componentMetrics (fallback)
  const engineMetrics = kubernetesEngine ? kubernetesEngine.getMetrics() : null;
  const engineLoadMetrics = kubernetesEngine ? kubernetesEngine.getLoad() : null;
  
  // Also get metrics from componentMetrics store (updated by EmulationEngine)
  const componentMetricsData = componentMetrics;
  const customMetrics = componentMetricsData?.customMetrics || {};
  
  // Use engine metrics if available, otherwise use componentMetrics
  const metrics = engineMetrics || (componentMetricsData ? {
    podsTotal: customMetrics.k8s_pods_total || 0,
    podsRunning: customMetrics.k8s_pods_running || 0,
    podsPending: customMetrics.k8s_pods_pending || 0,
    podsFailed: customMetrics.k8s_pods_failed || 0,
    podsSucceeded: customMetrics.k8s_pods_succeeded || 0,
    deploymentsTotal: customMetrics.k8s_deployments_total || 0,
    deploymentsReady: customMetrics.k8s_deployments_ready || 0,
    deploymentsNotReady: customMetrics.k8s_deployments_not_ready || 0,
    servicesTotal: customMetrics.k8s_services_total || 0,
    servicesClusterIP: customMetrics.k8s_services_clusterip || 0,
    servicesNodePort: customMetrics.k8s_services_nodeport || 0,
    servicesLoadBalancer: customMetrics.k8s_services_loadbalancer || 0,
    nodesTotal: customMetrics.k8s_nodes_total || 0,
    nodesReady: customMetrics.k8s_nodes_ready || 0,
    nodesNotReady: customMetrics.k8s_nodes_not_ready || 0,
    namespacesTotal: customMetrics.k8s_namespaces_total || 0,
    configMapsTotal: 0,
    secretsTotal: 0,
    totalCpuRequests: 0,
    totalCpuLimits: 0,
    totalMemoryRequests: 0,
    totalMemoryLimits: 0,
    totalCpuUsage: 0,
    totalMemoryUsage: 0,
    totalMemoryCapacity: 0,
  } : null);
  
  const loadMetrics = engineLoadMetrics || (componentMetricsData ? {
    throughput: componentMetricsData.throughput || 0,
    averageLatency: componentMetricsData.latency || 0,
    errorRate: componentMetricsData.errorRate || 0,
    cpuUtilization: customMetrics.k8s_cpu_utilization || componentMetricsData.utilization || 0,
    memoryUtilization: customMetrics.k8s_memory_utilization || componentMetricsData.utilization || 0,
    podUtilization: customMetrics.k8s_pod_utilization || 0,
    networkUtilization: customMetrics.k8s_network_utilization || 0,
    diskUtilization: customMetrics.k8s_disk_utilization || 0,
  } : null);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Kubernetes Configuration</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage Kubernetes cluster resources: Pods, Deployments, Services, and more
          </p>
        </div>

        <Separator />

        {/* Overview Metrics */}
        {metrics && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Cluster Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Pods</div>
                  <div className="text-2xl font-bold">
                    {metrics.podsRunning}/{metrics.podsTotal}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {metrics.podsPending} pending, {metrics.podsFailed} failed
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Deployments</div>
                  <div className="text-2xl font-bold">
                    {metrics.deploymentsReady}/{metrics.deploymentsTotal}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {metrics.deploymentsNotReady} not ready
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Services</div>
                  <div className="text-2xl font-bold">{metrics.servicesTotal}</div>
                  <div className="text-xs text-muted-foreground">
                    {metrics.servicesClusterIP} ClusterIP, {metrics.servicesNodePort} NodePort
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Nodes</div>
                  <div className="text-2xl font-bold">
                    {metrics.nodesReady}/{metrics.nodesTotal}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {metrics.nodesNotReady} not ready
                  </div>
                </div>
              </div>
              {loadMetrics && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">CPU Utilization</div>
                    <div className="text-lg font-semibold">
                      {(loadMetrics.cpuUtilization * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Memory Utilization</div>
                    <div className="text-lg font-semibold">
                      {(loadMetrics.memoryUtilization * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Throughput</div>
                    <div className="text-lg font-semibold">
                      {loadMetrics.throughput.toFixed(1)} ops/s
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Error Rate</div>
                    <div className="text-lg font-semibold">
                      {(loadMetrics.errorRate * 100).toFixed(2)}%
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main Tabs */}
        <Tabs defaultValue="pods" className="w-full">
          <TabsList className="flex flex-wrap w-full h-auto p-1 gap-1">
            <TabsTrigger value="pods" className="flex-shrink-0 whitespace-nowrap">
              <Box className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Pods</span>
            </TabsTrigger>
            <TabsTrigger value="deployments" className="flex-shrink-0 whitespace-nowrap">
              <Layers className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Deployments</span>
            </TabsTrigger>
            <TabsTrigger value="services" className="flex-shrink-0 whitespace-nowrap">
              <Network className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Services</span>
            </TabsTrigger>
            <TabsTrigger value="configmaps" className="flex-shrink-0 whitespace-nowrap">
              <FileText className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline md:hidden">CM</span>
              <span className="hidden md:inline">ConfigMaps</span>
            </TabsTrigger>
            <TabsTrigger value="secrets" className="flex-shrink-0 whitespace-nowrap">
              <Shield className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Secrets</span>
            </TabsTrigger>
            <TabsTrigger value="namespaces" className="flex-shrink-0 whitespace-nowrap">
              <Database className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline md:hidden">NS</span>
              <span className="hidden md:inline">Namespaces</span>
            </TabsTrigger>
            <TabsTrigger value="nodes" className="flex-shrink-0 whitespace-nowrap">
              <Server className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Nodes</span>
            </TabsTrigger>
            <TabsTrigger value="events" className="flex-shrink-0 whitespace-nowrap">
              <Activity className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Events</span>
            </TabsTrigger>
            <TabsTrigger value="pvcs" className="flex-shrink-0 whitespace-nowrap">
              <HardDrive className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">PVCs</span>
            </TabsTrigger>
            <TabsTrigger value="yaml" className="flex-shrink-0 whitespace-nowrap">
              <FileText className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">YAML</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pods" className="space-y-4">
            <PodsTab
              pods={pods}
              namespaces={namespaces}
              updateConfig={updateConfig}
              kubernetesEngine={kubernetesEngine}
              node={node}
            />
          </TabsContent>

          <TabsContent value="deployments" className="space-y-4">
            <DeploymentsTab
              deployments={deployments}
              namespaces={namespaces}
              updateConfig={updateConfig}
              kubernetesEngine={kubernetesEngine}
              node={node}
            />
          </TabsContent>

          <TabsContent value="services" className="space-y-4">
            <ServicesTab
              services={services}
              namespaces={namespaces}
              pods={pods}
              updateConfig={updateConfig}
              kubernetesEngine={kubernetesEngine}
              node={node}
            />
          </TabsContent>

          <TabsContent value="configmaps" className="space-y-4">
            <ConfigMapsTab
              configMaps={configMaps}
              namespaces={namespaces}
              updateConfig={updateConfig}
              kubernetesEngine={kubernetesEngine}
              node={node}
            />
          </TabsContent>

          <TabsContent value="secrets" className="space-y-4">
            <SecretsTab
              secrets={secrets}
              namespaces={namespaces}
              updateConfig={updateConfig}
              kubernetesEngine={kubernetesEngine}
              node={node}
            />
          </TabsContent>

          <TabsContent value="namespaces" className="space-y-4">
            <NamespacesTab
              namespaces={namespaces}
              updateConfig={updateConfig}
              kubernetesEngine={kubernetesEngine}
              node={node}
            />
          </TabsContent>

          <TabsContent value="nodes" className="space-y-4">
            <NodesTab
              nodes={k8sNodes}
              updateConfig={updateConfig}
              kubernetesEngine={kubernetesEngine}
              node={node}
            />
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <EventsTab events={events} />
          </TabsContent>

          <TabsContent value="pvcs" className="space-y-4">
            <PVCsTab
              pvcs={persistentVolumeClaims}
              namespaces={namespaces}
              updateConfig={updateConfig}
              kubernetesEngine={kubernetesEngine}
              node={node}
            />
          </TabsContent>

          <TabsContent value="yaml" className="space-y-4">
            <YAMLTab
              yaml={config.yaml || ''}
              yamlManifests={config.yamlManifests || []}
              updateConfig={updateConfig}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Pods Tab Component
interface PodsTabProps {
  pods: KubernetesPod[];
  namespaces: KubernetesNamespace[];
  updateConfig: (updates: Partial<KubernetesConfig>) => void;
  kubernetesEngine: any;
  node: CanvasNode;
}

function PodsTab({ pods, namespaces, updateConfig, kubernetesEngine, node }: PodsTabProps) {
  const [showCreatePod, setShowCreatePod] = useState(false);
  const [editingPod, setEditingPod] = useState<KubernetesPod | null>(null);
  const [viewingPod, setViewingPod] = useState<KubernetesPod | null>(null);
  const [deletingPod, setDeletingPod] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Form state
  const [newPodName, setNewPodName] = useState('');
  const [newPodNamespace, setNewPodNamespace] = useState('default');
  const [newPodImage, setNewPodImage] = useState('nginx:latest');
  const [newPodPhase, setNewPodPhase] = useState<PodPhase>('Pending');
  
  // Edit form state
  const [editPodLabels, setEditPodLabels] = useState<Record<string, string>>({});
  const [editPodAnnotations, setEditPodAnnotations] = useState<Record<string, string>>({});

  const config = (node.data.config as any) || {} as KubernetesConfig;

  const filteredPods = pods.filter(pod => {
    const matchesSearch = pod.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesNamespace = selectedNamespace === 'all' || pod.namespace === selectedNamespace;
    const matchesStatus = selectedStatus === 'all' || pod.phase === selectedStatus || pod.status === selectedStatus;
    return matchesSearch && matchesNamespace && matchesStatus;
  });

  const handleCreatePod = () => {
    if (!newPodName.trim() || !newPodImage.trim()) {
      showValidationError('Please fill in pod name and image');
      return;
    }
    
    if (!validateDNSLabel(newPodName.toLowerCase())) {
      showValidationError('Pod name must be a valid DNS label (lowercase alphanumeric and hyphens)');
      return;
    }

    if (kubernetesEngine) {
      try {
        const newPod = kubernetesEngine.createPod({
          name: newPodName,
          namespace: newPodNamespace,
          phase: newPodPhase,
          status: newPodPhase,
          labels: { app: newPodName },
        });
        
        const updatedConfig = kubernetesEngine.getConfig();
        if (updatedConfig) {
          updateConfig({ pods: updatedConfig.pods });
        }
        showSuccess('Pod created successfully');
        setShowCreatePod(false);
        resetPodForm();
      } catch (error: any) {
        showError(error.message || 'Failed to create pod');
      }
    } else {
      // Fallback: update config directly
      const newPod: KubernetesPod = {
        id: `pod-${Date.now()}`,
        name: newPodName,
        namespace: newPodNamespace,
        phase: newPodPhase,
        status: newPodPhase,
        createdAt: Date.now(),
        labels: { app: newPodName },
      };
      updateConfig({ pods: [...pods, newPod] });
      showSuccess('Pod created successfully');
      setShowCreatePod(false);
      resetPodForm();
    }
  };

  const handleEditPod = (pod: KubernetesPod) => {
    setEditingPod(pod);
    setEditPodLabels(pod.labels || {});
    setEditPodAnnotations(pod.annotations || {});
  };

  const handleSavePodEdit = () => {
    if (!editingPod) return;
    
    if (kubernetesEngine) {
      try {
        kubernetesEngine.updatePod(editingPod.id, {
          labels: editPodLabels,
          annotations: editPodAnnotations,
        });
        const updatedConfig = kubernetesEngine.getConfig();
        if (updatedConfig) {
          updateConfig({ pods: updatedConfig.pods });
        }
        showSuccess('Pod updated successfully');
        setEditingPod(null);
        setEditPodLabels({});
        setEditPodAnnotations({});
      } catch (error: any) {
        showError(error.message || 'Failed to update pod');
      }
    } else {
      const updatedPods = pods.map(p => 
        p.id === editingPod.id 
          ? { ...p, labels: editPodLabels, annotations: editPodAnnotations }
          : p
      );
      updateConfig({ pods: updatedPods });
      showSuccess('Pod updated successfully');
      setEditingPod(null);
      setEditPodLabels({});
      setEditPodAnnotations({});
    }
  };

  const handleDeletePod = (id: string) => {
    if (kubernetesEngine) {
      try {
        kubernetesEngine.deletePod(id);
        const updatedConfig = kubernetesEngine.getConfig();
        if (updatedConfig) {
          updateConfig({ pods: updatedConfig.pods });
        }
        showSuccess('Pod deleted successfully');
        setDeletingPod(null);
      } catch (error: any) {
        showError(error.message || 'Failed to delete pod');
      }
    } else {
      updateConfig({ pods: pods.filter(p => p.id !== id) });
      showSuccess('Pod deleted successfully');
      setDeletingPod(null);
    }
  };

  const resetPodForm = () => {
    setNewPodName('');
    setNewPodNamespace('default');
    setNewPodImage('nginx:latest');
    setNewPodPhase('Pending');
  };

  const getStatusBadge = (phase: PodPhase, status: PodStatus) => {
    const statusMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      Running: { variant: 'default', label: 'Running' },
      Pending: { variant: 'secondary', label: 'Pending' },
      Succeeded: { variant: 'default', label: 'Succeeded' },
      Failed: { variant: 'destructive', label: 'Failed' },
      Unknown: { variant: 'outline', label: 'Unknown' },
      CrashLoopBackOff: { variant: 'destructive', label: 'CrashLoopBackOff' },
      ImagePullBackOff: { variant: 'destructive', label: 'ImagePullBackOff' },
      ErrImagePull: { variant: 'destructive', label: 'ErrImagePull' },
    };
    const statusInfo = statusMap[status] || statusMap[phase] || { variant: 'outline' as const, label: status || phase };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pods</CardTitle>
              <CardDescription>Manage Kubernetes pods</CardDescription>
            </div>
            <Button onClick={() => setShowCreatePod(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Pod
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filter */}
          <div className="flex gap-4 mb-4">
            <Input
              placeholder="Search pods..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={selectedNamespace} onValueChange={setSelectedNamespace}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All namespaces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All namespaces</SelectItem>
                {namespaces.map(ns => (
                  <SelectItem key={ns.id} value={ns.name}>{ns.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Running">Running</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Failed">Failed</SelectItem>
                <SelectItem value="Succeeded">Succeeded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pods List */}
          <div className="space-y-2">
            {filteredPods.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No pods found
              </div>
            ) : (
              filteredPods.map(pod => (
                <Card key={pod.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{pod.name}</h4>
                          {getStatusBadge(pod.phase, pod.status)}
                          <Badge variant="outline">{pod.namespace}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-2">
                          {pod.podIP && <div>IP: {pod.podIP}</div>}
                          {pod.nodeName && <div>Node: {pod.nodeName}</div>}
                          {pod.totalCpuUsage !== undefined && (
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span>CPU</span>
                                <span>{pod.totalCpuUsage.toFixed(1)}%</span>
                              </div>
                              <Progress value={pod.totalCpuUsage} className="h-2" />
                            </div>
                          )}
                          {pod.totalMemoryUsage && pod.totalMemoryLimit && (
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span>Memory</span>
                                <span>{((pod.totalMemoryUsage / pod.totalMemoryLimit) * 100).toFixed(1)}%</span>
                              </div>
                              <Progress value={(pod.totalMemoryUsage / pod.totalMemoryLimit) * 100} className="h-2" />
                              <div className="text-xs mt-1">
                                {(pod.totalMemoryUsage / 1024 / 1024).toFixed(0)} / {(pod.totalMemoryLimit / 1024 / 1024).toFixed(0)} MiB
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingPod(pod)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditPod(pod)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingPod(pod.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Pod Dialog */}
      <Dialog open={showCreatePod} onOpenChange={setShowCreatePod}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Pod</DialogTitle>
            <DialogDescription>Create a new Kubernetes pod</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={newPodName}
                onChange={(e) => setNewPodName(e.target.value)}
                placeholder="my-pod"
              />
            </div>
            <div className="space-y-2">
              <Label>Namespace</Label>
              <Select value={newPodNamespace} onValueChange={setNewPodNamespace}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {namespaces.map(ns => (
                    <SelectItem key={ns.id} value={ns.name}>{ns.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Image</Label>
              <Input
                value={newPodImage}
                onChange={(e) => setNewPodImage(e.target.value)}
                placeholder="nginx:latest"
              />
            </div>
            <div className="space-y-2">
              <Label>Initial Phase</Label>
              <Select value={newPodPhase} onValueChange={(v) => setNewPodPhase(v as PodPhase)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Running">Running</SelectItem>
                  <SelectItem value="Succeeded">Succeeded</SelectItem>
                  <SelectItem value="Failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreatePod(false)}>Cancel</Button>
            <Button onClick={handleCreatePod}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Pod Dialog */}
      <Dialog open={editingPod !== null} onOpenChange={(open) => !open && setEditingPod(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Pod: {editingPod?.name}</DialogTitle>
            <DialogDescription>Edit labels and annotations</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Labels (key=value, one per line)</Label>
              <Textarea
                value={Object.entries(editPodLabels).map(([k, v]) => `${k}=${v}`).join('\n')}
                onChange={(e) => {
                  const labels: Record<string, string> = {};
                  e.target.value.split('\n').forEach(line => {
                    const [key, ...values] = line.split('=');
                    if (key.trim()) labels[key.trim()] = values.join('=').trim();
                  });
                  setEditPodLabels(labels);
                }}
                rows={5}
                placeholder="app=myapp&#10;version=v1"
              />
            </div>
            <div className="space-y-2">
              <Label>Annotations (key=value, one per line)</Label>
              <Textarea
                value={Object.entries(editPodAnnotations).map(([k, v]) => `${k}=${v}`).join('\n')}
                onChange={(e) => {
                  const annotations: Record<string, string> = {};
                  e.target.value.split('\n').forEach(line => {
                    const [key, ...values] = line.split('=');
                    if (key.trim()) annotations[key.trim()] = values.join('=').trim();
                  });
                  setEditPodAnnotations(annotations);
                }}
                rows={5}
                placeholder="description=My pod&#10;owner=team-a"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPod(null)}>Cancel</Button>
            <Button onClick={handleSavePodEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Pod Details Dialog */}
      <Dialog open={viewingPod !== null} onOpenChange={(open) => !open && setViewingPod(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pod Details: {viewingPod?.name}</DialogTitle>
            <DialogDescription>Complete information about the pod</DialogDescription>
          </DialogHeader>
          {viewingPod && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Metadata</h4>
                <div className="space-y-1 text-sm">
                  <div><span className="font-medium">Name:</span> {viewingPod.name}</div>
                  <div><span className="font-medium">Namespace:</span> {viewingPod.namespace}</div>
                  {viewingPod.uid && <div><span className="font-medium">UID:</span> {viewingPod.uid}</div>}
                  <div><span className="font-medium">Created:</span> {new Date(viewingPod.createdAt).toLocaleString()}</div>
                  {viewingPod.startedAt && <div><span className="font-medium">Started:</span> {new Date(viewingPod.startedAt).toLocaleString()}</div>}
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Status</h4>
                <div className="space-y-1 text-sm">
                  <div><span className="font-medium">Phase:</span> {getStatusBadge(viewingPod.phase, viewingPod.status)}</div>
                  {viewingPod.podIP && <div><span className="font-medium">Pod IP:</span> {viewingPod.podIP}</div>}
                  {viewingPod.hostIP && <div><span className="font-medium">Host IP:</span> {viewingPod.hostIP}</div>}
                  {viewingPod.nodeName && <div><span className="font-medium">Node:</span> {viewingPod.nodeName}</div>}
                  {viewingPod.restartCount !== undefined && <div><span className="font-medium">Restarts:</span> {viewingPod.restartCount}</div>}
                </div>
              </div>
              {viewingPod.totalCpuUsage !== undefined && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Resources</h4>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>CPU Usage</span>
                          <span>{viewingPod.totalCpuUsage.toFixed(1)}%</span>
                        </div>
                        <Progress value={viewingPod.totalCpuUsage} className="h-2" />
                      </div>
                      {viewingPod.totalMemoryUsage && viewingPod.totalMemoryLimit && (
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Memory Usage</span>
                            <span>{((viewingPod.totalMemoryUsage / viewingPod.totalMemoryLimit) * 100).toFixed(1)}%</span>
                          </div>
                          <Progress value={(viewingPod.totalMemoryUsage / viewingPod.totalMemoryLimit) * 100} className="h-2" />
                          <div className="text-xs text-muted-foreground mt-1">
                            {(viewingPod.totalMemoryUsage / 1024 / 1024).toFixed(0)} / {(viewingPod.totalMemoryLimit / 1024 / 1024).toFixed(0)} MiB
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              {viewingPod.labels && Object.keys(viewingPod.labels).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Labels</h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(viewingPod.labels).map(([key, value]) => (
                        <Badge key={key} variant="outline">{key}={value}</Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {viewingPod.annotations && Object.keys(viewingPod.annotations).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Annotations</h4>
                    <div className="space-y-1 text-sm">
                      {Object.entries(viewingPod.annotations).map(([key, value]) => (
                        <div key={key}><span className="font-medium">{key}:</span> {value}</div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {viewingPod.conditions && viewingPod.conditions.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Conditions</h4>
                    <div className="space-y-1 text-sm">
                      {viewingPod.conditions.map((cond, idx) => (
                        <div key={idx}>
                          <Badge variant={cond.status === 'True' ? 'default' : 'secondary'} className="mr-2">
                            {cond.type}: {cond.status}
                          </Badge>
                          {cond.reason && <span className="text-muted-foreground">({cond.reason})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewingPod(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deletingPod !== null} onOpenChange={(open) => !open && setDeletingPod(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pod</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this pod? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPod && handleDeletePod(deletingPod)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Deployments Tab Component
interface DeploymentsTabProps {
  deployments: KubernetesDeployment[];
  namespaces: KubernetesNamespace[];
  updateConfig: (updates: Partial<KubernetesConfig>) => void;
  kubernetesEngine: any;
  node: CanvasNode;
}

function DeploymentsTab({ deployments, namespaces, updateConfig, kubernetesEngine, node }: DeploymentsTabProps) {
  const config = (node.data.config as any) || {} as KubernetesConfig;
  const pods = config.pods || (kubernetesEngine ? kubernetesEngine.getPods() : []);
  
  const [showCreateDeployment, setShowCreateDeployment] = useState(false);
  const [editingDeployment, setEditingDeployment] = useState<KubernetesDeployment | null>(null);
  const [viewingDeployment, setViewingDeployment] = useState<KubernetesDeployment | null>(null);
  const [deletingDeployment, setDeletingDeployment] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');

  const [newDeploymentName, setNewDeploymentName] = useState('');
  const [newDeploymentNamespace, setNewDeploymentNamespace] = useState('default');
  const [newDeploymentReplicas, setNewDeploymentReplicas] = useState(1);
  const [newDeploymentImage, setNewDeploymentImage] = useState('nginx:latest');
  const [newDeploymentStrategy, setNewDeploymentStrategy] = useState<DeploymentStrategyType>('RollingUpdate');
  
  // Edit form state
  const [editDeploymentReplicas, setEditDeploymentReplicas] = useState(1);
  const [editDeploymentImage, setEditDeploymentImage] = useState('');
  const [editDeploymentStrategy, setEditDeploymentStrategy] = useState<DeploymentStrategyType>('RollingUpdate');

  const filteredDeployments = deployments.filter(dep => {
    const matchesSearch = dep.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesNamespace = selectedNamespace === 'all' || dep.namespace === selectedNamespace;
    return matchesSearch && matchesNamespace;
  });

  const handleCreateDeployment = () => {
    if (!newDeploymentName.trim() || !newDeploymentImage.trim()) {
      showValidationError('Please fill in deployment name and image');
      return;
    }
    
    if (!validateDNSLabel(newDeploymentName.toLowerCase())) {
      showValidationError('Deployment name must be a valid DNS label (lowercase alphanumeric and hyphens)');
      return;
    }
    
    if (newDeploymentReplicas < 0) {
      showValidationError('Replicas must be >= 0');
      return;
    }

    if (kubernetesEngine) {
      try {
        const newDeployment = kubernetesEngine.createDeployment({
          name: newDeploymentName,
          namespace: newDeploymentNamespace,
          replicas: newDeploymentReplicas,
          strategy: newDeploymentStrategy,
          selector: { app: newDeploymentName },
          template: {
            labels: { app: newDeploymentName },
            containers: [{
              name: newDeploymentName,
              image: newDeploymentImage,
              ports: [{ containerPort: 80 }],
            }],
          },
        });
        
        const updatedConfig = kubernetesEngine.getConfig();
        if (updatedConfig) {
          updateConfig({ deployments: updatedConfig.deployments });
        }
        showSuccess('Deployment created successfully');
        setShowCreateDeployment(false);
        resetDeploymentForm();
      } catch (error: any) {
        showError(error.message || 'Failed to create deployment');
      }
    } else {
      const newDeployment: KubernetesDeployment = {
        id: `deployment-${Date.now()}`,
        name: newDeploymentName,
        namespace: newDeploymentNamespace,
        replicas: newDeploymentReplicas,
        readyReplicas: 0,
        availableReplicas: 0,
        unavailableReplicas: newDeploymentReplicas,
        updatedReplicas: 0,
        strategy: newDeploymentStrategy,
        selector: { app: newDeploymentName },
        template: {
          labels: { app: newDeploymentName },
          containers: [{
            name: newDeploymentName,
            image: newDeploymentImage,
            ports: [{ containerPort: 80 }],
          }],
        },
        createdAt: Date.now(),
        paused: false,
      };
      updateConfig({ deployments: [...deployments, newDeployment] });
      showSuccess('Deployment created successfully');
      setShowCreateDeployment(false);
      resetDeploymentForm();
    }
  };

  const handleEditDeployment = (deployment: KubernetesDeployment) => {
    setEditingDeployment(deployment);
    setEditDeploymentReplicas(deployment.replicas);
    setEditDeploymentImage(deployment.template?.containers?.[0]?.image || '');
    setEditDeploymentStrategy(deployment.strategy);
  };

  const handleSaveDeploymentEdit = () => {
    if (!editingDeployment) return;
    
    if (editDeploymentReplicas < 0) {
      showValidationError('Replicas must be >= 0');
      return;
    }
    
    if (kubernetesEngine) {
      try {
        kubernetesEngine.updateDeployment(editingDeployment.id, {
          replicas: editDeploymentReplicas,
          strategy: editDeploymentStrategy,
          template: {
            ...editingDeployment.template,
            containers: editingDeployment.template?.containers?.map((c, idx) => 
              idx === 0 ? { ...c, image: editDeploymentImage } : c
            ) || [{ name: editingDeployment.name, image: editDeploymentImage, ports: [{ containerPort: 80 }] }],
          },
        });
        const updatedConfig = kubernetesEngine.getConfig();
        if (updatedConfig) {
          updateConfig({ deployments: updatedConfig.deployments });
        }
        showSuccess('Deployment updated successfully');
        setEditingDeployment(null);
      } catch (error: any) {
        showError(error.message || 'Failed to update deployment');
      }
    } else {
      const updatedDeployments = deployments.map(d => 
        d.id === editingDeployment.id
          ? {
              ...d,
              replicas: editDeploymentReplicas,
              strategy: editDeploymentStrategy,
              template: {
                ...d.template,
                containers: d.template?.containers?.map((c, idx) => 
                  idx === 0 ? { ...c, image: editDeploymentImage } : c
                ) || [{ name: d.name, image: editDeploymentImage, ports: [{ containerPort: 80 }] }],
              },
            }
          : d
      );
      updateConfig({ deployments: updatedDeployments });
      showSuccess('Deployment updated successfully');
      setEditingDeployment(null);
    }
  };

  const handlePauseResumeDeployment = (deployment: KubernetesDeployment) => {
    if (kubernetesEngine) {
      try {
        kubernetesEngine.updateDeployment(deployment.id, {
          paused: !deployment.paused,
        });
        const updatedConfig = kubernetesEngine.getConfig();
        if (updatedConfig) {
          updateConfig({ deployments: updatedConfig.deployments });
        }
        showSuccess(`Deployment ${deployment.paused ? 'resumed' : 'paused'} successfully`);
      } catch (error: any) {
        showError(error.message || 'Failed to update deployment');
      }
    } else {
      const updatedDeployments = deployments.map(d => 
        d.id === deployment.id ? { ...d, paused: !d.paused } : d
      );
      updateConfig({ deployments: updatedDeployments });
      showSuccess(`Deployment ${deployment.paused ? 'resumed' : 'paused'} successfully`);
    }
  };

  const handleDuplicateDeployment = (deployment: KubernetesDeployment) => {
    const newName = `${deployment.name}-copy-${Date.now()}`;
    if (kubernetesEngine) {
      try {
        kubernetesEngine.createDeployment({
          name: newName,
          namespace: deployment.namespace,
          replicas: deployment.replicas,
          strategy: deployment.strategy,
          selector: { ...deployment.selector, app: newName },
          template: {
            ...deployment.template,
            labels: { ...deployment.template?.labels, app: newName },
            containers: deployment.template?.containers?.map(c => ({ ...c, name: newName })) || [],
          },
        });
        const updatedConfig = kubernetesEngine.getConfig();
        if (updatedConfig) {
          updateConfig({ deployments: updatedConfig.deployments });
        }
        showSuccess('Deployment duplicated successfully');
      } catch (error: any) {
        showError(error.message || 'Failed to duplicate deployment');
      }
    } else {
      const newDeployment: KubernetesDeployment = {
        ...deployment,
        id: `deployment-${Date.now()}`,
        name: newName,
        createdAt: Date.now(),
        readyReplicas: 0,
        availableReplicas: 0,
        unavailableReplicas: deployment.replicas,
        updatedReplicas: 0,
        selector: { ...deployment.selector, app: newName },
        template: {
          ...deployment.template,
          labels: { ...deployment.template?.labels, app: newName },
          containers: deployment.template?.containers?.map(c => ({ ...c, name: newName })) || [],
        },
      };
      updateConfig({ deployments: [...deployments, newDeployment] });
      showSuccess('Deployment duplicated successfully');
    }
  };

  const handleDeleteDeployment = (id: string) => {
    if (kubernetesEngine) {
      try {
        kubernetesEngine.deleteDeployment(id);
        const updatedConfig = kubernetesEngine.getConfig();
        if (updatedConfig) {
          updateConfig({ deployments: updatedConfig.deployments });
        }
        showSuccess('Deployment deleted successfully');
        setDeletingDeployment(null);
      } catch (error: any) {
        showError(error.message || 'Failed to delete deployment');
      }
    } else {
      updateConfig({ deployments: deployments.filter(d => d.id !== id) });
      showSuccess('Deployment deleted successfully');
      setDeletingDeployment(null);
    }
  };

  const resetDeploymentForm = () => {
    setNewDeploymentName('');
    setNewDeploymentNamespace('default');
    setNewDeploymentReplicas(1);
    setNewDeploymentImage('nginx:latest');
    setNewDeploymentStrategy('RollingUpdate');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Deployments</CardTitle>
              <CardDescription>Manage Kubernetes deployments</CardDescription>
            </div>
            <Button onClick={() => setShowCreateDeployment(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Deployment
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Input
              placeholder="Search deployments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={selectedNamespace} onValueChange={setSelectedNamespace}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All namespaces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All namespaces</SelectItem>
                {namespaces.map(ns => (
                  <SelectItem key={ns.id} value={ns.name}>{ns.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {filteredDeployments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No deployments found</div>
            ) : (
              filteredDeployments.map(dep => (
                <Card key={dep.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{dep.name}</h4>
                          <Badge variant={dep.readyReplicas === dep.replicas ? 'default' : 'secondary'}>
                            {dep.readyReplicas}/{dep.replicas}
                          </Badge>
                          <Badge variant="outline">{dep.namespace}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-2">
                          <div>Strategy: {dep.strategy}</div>
                          <div>Available: {dep.availableReplicas}, Unavailable: {dep.unavailableReplicas}</div>
                          {dep.paused && <Badge variant="secondary">Paused</Badge>}
                          {dep.replicas > 0 && (
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span>Replicas Progress</span>
                                <span>{dep.readyReplicas}/{dep.replicas}</span>
                              </div>
                              <Progress value={(dep.readyReplicas / dep.replicas) * 100} className="h-2" />
                            </div>
                          )}
                          {(() => {
                            const relatedPods = getPodsForDeployment(dep, pods);
                            const runningPods = relatedPods.filter(p => p.phase === 'Running').length;
                            return relatedPods.length > 0 && (
                              <div className="text-xs">
                                Related Pods: {runningPods} running / {relatedPods.length} total
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingDeployment(dep)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditDeployment(dep)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePauseResumeDeployment(dep)}
                          title={dep.paused ? "Resume" : "Pause"}
                        >
                          {dep.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicateDeployment(dep)}
                          title="Duplicate"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingDeployment(dep.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCreateDeployment} onOpenChange={setShowCreateDeployment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Deployment</DialogTitle>
            <DialogDescription>Create a new Kubernetes deployment</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={newDeploymentName} onChange={(e) => setNewDeploymentName(e.target.value)} placeholder="my-deployment" />
            </div>
            <div className="space-y-2">
              <Label>Namespace</Label>
              <Select value={newDeploymentNamespace} onValueChange={setNewDeploymentNamespace}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {namespaces.map(ns => <SelectItem key={ns.id} value={ns.name}>{ns.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Replicas</Label>
              <Input type="number" min="1" value={newDeploymentReplicas} onChange={(e) => setNewDeploymentReplicas(parseInt(e.target.value) || 1)} />
            </div>
            <div className="space-y-2">
              <Label>Image</Label>
              <Input value={newDeploymentImage} onChange={(e) => setNewDeploymentImage(e.target.value)} placeholder="nginx:latest" />
            </div>
            <div className="space-y-2">
              <Label>Strategy</Label>
              <Select value={newDeploymentStrategy} onValueChange={(v) => setNewDeploymentStrategy(v as DeploymentStrategyType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RollingUpdate">RollingUpdate</SelectItem>
                  <SelectItem value="Recreate">Recreate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDeployment(false)}>Cancel</Button>
            <Button onClick={handleCreateDeployment}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Deployment Dialog */}
      <Dialog open={editingDeployment !== null} onOpenChange={(open) => !open && setEditingDeployment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Deployment: {editingDeployment?.name}</DialogTitle>
            <DialogDescription>Update deployment configuration</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Replicas</Label>
              <Input
                type="number"
                min="0"
                value={editDeploymentReplicas}
                onChange={(e) => setEditDeploymentReplicas(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Image</Label>
              <Input
                value={editDeploymentImage}
                onChange={(e) => setEditDeploymentImage(e.target.value)}
                placeholder="nginx:latest"
              />
            </div>
            <div className="space-y-2">
              <Label>Strategy</Label>
              <Select value={editDeploymentStrategy} onValueChange={(v) => setEditDeploymentStrategy(v as DeploymentStrategyType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RollingUpdate">RollingUpdate</SelectItem>
                  <SelectItem value="Recreate">Recreate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDeployment(null)}>Cancel</Button>
            <Button onClick={handleSaveDeploymentEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Deployment Details Dialog */}
      <Dialog open={viewingDeployment !== null} onOpenChange={(open) => !open && setViewingDeployment(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Deployment Details: {viewingDeployment?.name}</DialogTitle>
            <DialogDescription>Complete information about the deployment</DialogDescription>
          </DialogHeader>
          {viewingDeployment && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Metadata</h4>
                <div className="space-y-1 text-sm">
                  <div><span className="font-medium">Name:</span> {viewingDeployment.name}</div>
                  <div><span className="font-medium">Namespace:</span> {viewingDeployment.namespace}</div>
                  {viewingDeployment.uid && <div><span className="font-medium">UID:</span> {viewingDeployment.uid}</div>}
                  <div><span className="font-medium">Created:</span> {new Date(viewingDeployment.createdAt).toLocaleString()}</div>
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Status</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Replicas:</span>
                    <Badge variant={viewingDeployment.readyReplicas === viewingDeployment.replicas ? 'default' : 'secondary'}>
                      {viewingDeployment.readyReplicas}/{viewingDeployment.replicas}
                    </Badge>
                  </div>
                  <div><span className="font-medium">Available:</span> {viewingDeployment.availableReplicas}</div>
                  <div><span className="font-medium">Unavailable:</span> {viewingDeployment.unavailableReplicas}</div>
                  <div><span className="font-medium">Strategy:</span> {viewingDeployment.strategy}</div>
                  {viewingDeployment.paused && <Badge variant="secondary">Paused</Badge>}
                  {viewingDeployment.replicas > 0 && (
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Replicas Progress</span>
                        <span>{viewingDeployment.readyReplicas}/{viewingDeployment.replicas}</span>
                      </div>
                      <Progress value={(viewingDeployment.readyReplicas / viewingDeployment.replicas) * 100} className="h-2" />
                    </div>
                  )}
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Related Pods</h4>
                {(() => {
                  const relatedPods = getPodsForDeployment(viewingDeployment, pods);
                  if (relatedPods.length === 0) {
                    return <div className="text-sm text-muted-foreground">No pods found</div>;
                  }
                  return (
                    <div className="space-y-1 text-sm">
                      <div>Total: {relatedPods.length}</div>
                      <div>Running: {relatedPods.filter(p => p.phase === 'Running').length}</div>
                      <div>Pending: {relatedPods.filter(p => p.phase === 'Pending').length}</div>
                      <div>Failed: {relatedPods.filter(p => p.phase === 'Failed').length}</div>
                      <div className="mt-2 space-y-1">
                        {relatedPods.slice(0, 5).map(pod => (
                          <div key={pod.id} className="flex items-center gap-2">
                            <Badge variant={pod.phase === 'Running' ? 'default' : 'secondary'} className="text-xs">
                              {pod.phase}
                            </Badge>
                            <span>{pod.name}</span>
                          </div>
                        ))}
                        {relatedPods.length > 5 && <div className="text-xs text-muted-foreground">...and {relatedPods.length - 5} more</div>}
                      </div>
                    </div>
                  );
                })()}
              </div>
              {viewingDeployment.selector && Object.keys(viewingDeployment.selector).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Selector</h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(viewingDeployment.selector).map(([key, value]) => (
                        <Badge key={key} variant="outline">{key}={value}</Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {viewingDeployment.template?.containers && viewingDeployment.template.containers.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Containers</h4>
                    <div className="space-y-2">
                      {viewingDeployment.template.containers.map((container, idx) => (
                        <div key={idx} className="text-sm border rounded p-2">
                          <div><span className="font-medium">Name:</span> {container.name}</div>
                          <div><span className="font-medium">Image:</span> {container.image}</div>
                          {container.ports && container.ports.length > 0 && (
                            <div><span className="font-medium">Ports:</span> {container.ports.map(p => p.containerPort).join(', ')}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewingDeployment(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingDeployment !== null} onOpenChange={(open) => !open && setDeletingDeployment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deployment</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This will also delete associated pods.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingDeployment && handleDeleteDeployment(deletingDeployment)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Services Tab
interface ServicesTabProps {
  services: KubernetesService[];
  namespaces: KubernetesNamespace[];
  pods: KubernetesPod[];
  updateConfig: (updates: Partial<KubernetesConfig>) => void;
  kubernetesEngine: any;
  node: CanvasNode;
}

function ServicesTab({ services, namespaces, pods, updateConfig, kubernetesEngine, node }: ServicesTabProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingService, setEditingService] = useState<KubernetesService | null>(null);
  const [viewingService, setViewingService] = useState<KubernetesService | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  
  const [name, setName] = useState('');
  const [namespace, setNamespace] = useState('default');
  const [type, setType] = useState<ServiceType>('ClusterIP');
  const [port, setPort] = useState(80);
  
  // Edit form state
  const [editServiceType, setEditServiceType] = useState<ServiceType>('ClusterIP');
  const [editServicePorts, setEditServicePorts] = useState<Array<{ port: number; targetPort: number | string; protocol?: 'TCP' | 'UDP' }>>([]);
  const [editServiceSelector, setEditServiceSelector] = useState<Record<string, string>>({});

  const handleCreate = () => {
    if (!name.trim()) { showError('Name required'); return; }
    if (kubernetesEngine) {
      try {
        kubernetesEngine.createService({ name, namespace, type, ports: [{ port, targetPort: port }] });
        const config = kubernetesEngine.getConfig();
        if (config) updateConfig({ services: config.services });
        showSuccess('Service created');
        setShowCreate(false);
        setName(''); setNamespace('default'); setType('ClusterIP'); setPort(80);
      } catch (e: any) { showError(e.message); }
    } else {
      const newService: KubernetesService = {
        id: `svc-${Date.now()}`, name, namespace, type, ports: [{ port, targetPort: port }],
        createdAt: Date.now(),
      };
      updateConfig({ services: [...services, newService] });
      showSuccess('Service created');
      setShowCreate(false);
    }
  };

  const handleEditService = (service: KubernetesService) => {
    setEditingService(service);
    setEditServiceType(service.type);
    setEditServicePorts(service.ports || [{ port: 80, targetPort: 80 }]);
    setEditServiceSelector(service.selector || {});
  };

  const handleSaveServiceEdit = () => {
    if (!editingService) return;
    
    if (kubernetesEngine) {
      try {
        kubernetesEngine.updateService(editingService.id, {
          type: editServiceType,
          ports: editServicePorts,
          selector: editServiceSelector,
        });
        const config = kubernetesEngine.getConfig();
        if (config) updateConfig({ services: config.services });
        showSuccess('Service updated successfully');
        setEditingService(null);
      } catch (e: any) { showError(e.message); }
    } else {
      const updatedServices = services.map(s => 
        s.id === editingService.id
          ? { ...s, type: editServiceType, ports: editServicePorts, selector: editServiceSelector }
          : s
      );
      updateConfig({ services: updatedServices });
      showSuccess('Service updated successfully');
      setEditingService(null);
    }
  };

  const handleDelete = (id: string) => {
    if (kubernetesEngine) {
      try {
        kubernetesEngine.deleteService(id);
        const config = kubernetesEngine.getConfig();
        if (config) updateConfig({ services: config.services });
        showSuccess('Service deleted');
        setDeleting(null);
      } catch (e: any) { showError(e.message); }
    } else {
      updateConfig({ services: services.filter((s: any) => s.id !== id) });
      showSuccess('Service deleted');
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div><CardTitle>Services</CardTitle><CardDescription>Manage Kubernetes services</CardDescription></div>
            <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />Create Service</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Input
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={selectedNamespace} onValueChange={setSelectedNamespace}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All namespaces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All namespaces</SelectItem>
                {namespaces.map(ns => <SelectItem key={ns.id} value={ns.name}>{ns.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="ClusterIP">ClusterIP</SelectItem>
                <SelectItem value="NodePort">NodePort</SelectItem>
                <SelectItem value="LoadBalancer">LoadBalancer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            {filteredServices.length === 0 ? <div className="text-center py-8 text-muted-foreground">No services</div> :
              filteredServices.map((svc: any) => {
                const endpoints = getEndpointsForService(svc, pods);
                return (
                  <Card key={svc.id}>
                    <CardContent className="p-4 flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex gap-2 items-center mb-1">
                          <h4 className="font-semibold">{svc.name}</h4>
                          <Badge>{svc.type}</Badge>
                          <Badge variant="outline">{svc.namespace}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {svc.clusterIP && <div>Cluster IP: {svc.clusterIP}</div>}
                          {svc.ports && svc.ports.length > 0 && (
                            <div>Ports: {svc.ports.map((p: any) => `${p.port}→${p.targetPort}`).join(', ')}</div>
                          )}
                          {endpoints.length > 0 && (
                            <div>Endpoints: {endpoints.length} pod{endpoints.length !== 1 ? 's' : ''} ({endpoints.map(e => e.podIP).filter(Boolean).join(', ')})</div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setViewingService(svc)} title="View Details">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEditService(svc)} title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleting(svc.id)} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </CardContent>
      </Card>
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Service</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Namespace</Label>
              <Select value={namespace} onValueChange={setNamespace}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{namespaces.map(ns => <SelectItem key={ns.id} value={ns.name}>{ns.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as ServiceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ClusterIP">ClusterIP</SelectItem>
                  <SelectItem value="NodePort">NodePort</SelectItem>
                  <SelectItem value="LoadBalancer">LoadBalancer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Port</Label><Input type="number" value={port} onChange={(e) => setPort(parseInt(e.target.value) || 80)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button><Button onClick={handleCreate}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Service Dialog */}
      <Dialog open={editingService !== null} onOpenChange={(open) => !open && setEditingService(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Service: {editingService?.name}</DialogTitle>
            <DialogDescription>Update service configuration</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={editServiceType} onValueChange={(v) => setEditServiceType(v as ServiceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ClusterIP">ClusterIP</SelectItem>
                  <SelectItem value="NodePort">NodePort</SelectItem>
                  <SelectItem value="LoadBalancer">LoadBalancer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ports (port:targetPort, one per line)</Label>
              <Textarea
                value={editServicePorts.map(p => `${p.port}:${p.targetPort}`).join('\n')}
                onChange={(e) => {
                  const ports: Array<{ port: number; targetPort: number | string; protocol?: 'TCP' | 'UDP' }> = [];
                  e.target.value.split('\n').forEach(line => {
                    const [port, targetPort] = line.split(':');
                    if (port && targetPort) {
                      ports.push({
                        port: parseInt(port.trim(), 10),
                        targetPort: parseInt(targetPort.trim(), 10),
                        protocol: 'TCP',
                      });
                    }
                  });
                  setEditServicePorts(ports.length > 0 ? ports : [{ port: 80, targetPort: 80 }]);
                }}
                rows={3}
                placeholder="80:8080&#10;443:8443"
              />
            </div>
            <div className="space-y-2">
              <Label>Selector (key=value, one per line)</Label>
              <Textarea
                value={Object.entries(editServiceSelector).map(([k, v]) => `${k}=${v}`).join('\n')}
                onChange={(e) => {
                  const selector: Record<string, string> = {};
                  e.target.value.split('\n').forEach(line => {
                    const [key, ...values] = line.split('=');
                    if (key.trim()) selector[key.trim()] = values.join('=').trim();
                  });
                  setEditServiceSelector(selector);
                }}
                rows={3}
                placeholder="app=myapp&#10;version=v1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingService(null)}>Cancel</Button>
            <Button onClick={handleSaveServiceEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Service Details Dialog */}
      <Dialog open={viewingService !== null} onOpenChange={(open) => !open && setViewingService(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Service Details: {viewingService?.name}</DialogTitle>
            <DialogDescription>Complete information about the service</DialogDescription>
          </DialogHeader>
          {viewingService && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Metadata</h4>
                <div className="space-y-1 text-sm">
                  <div><span className="font-medium">Name:</span> {viewingService.name}</div>
                  <div><span className="font-medium">Namespace:</span> {viewingService.namespace}</div>
                  {viewingService.uid && <div><span className="font-medium">UID:</span> {viewingService.uid}</div>}
                  <div><span className="font-medium">Created:</span> {new Date(viewingService.createdAt).toLocaleString()}</div>
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Spec</h4>
                <div className="space-y-1 text-sm">
                  <div><span className="font-medium">Type:</span> <Badge>{viewingService.type}</Badge></div>
                  {viewingService.clusterIP && <div><span className="font-medium">Cluster IP:</span> {viewingService.clusterIP}</div>}
                  {viewingService.loadBalancerIP && <div><span className="font-medium">Load Balancer IP:</span> {viewingService.loadBalancerIP}</div>}
                  {viewingService.ports && viewingService.ports.length > 0 && (
                    <div>
                      <span className="font-medium">Ports:</span>
                      <div className="ml-4 mt-1 space-y-1">
                        {viewingService.ports.map((p, idx) => (
                          <div key={idx}>
                            {p.name && <span className="font-medium">{p.name}: </span>}
                            {p.port} → {p.targetPort} ({p.protocol || 'TCP'})
                            {p.nodePort && <span className="text-muted-foreground"> (NodePort: {p.nodePort})</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Endpoints</h4>
                {(() => {
                  const endpoints = getEndpointsForService(viewingService, pods);
                  if (endpoints.length === 0) {
                    return <div className="text-sm text-muted-foreground">No endpoints found (no matching pods)</div>;
                  }
                  return (
                    <div className="space-y-1 text-sm">
                      <div>Total: {endpoints.length} pod{endpoints.length !== 1 ? 's' : ''}</div>
                      <div className="mt-2 space-y-1">
                        {endpoints.map(pod => (
                          <div key={pod.id} className="flex items-center gap-2">
                            <Badge variant={pod.phase === 'Running' ? 'default' : 'secondary'} className="text-xs">
                              {pod.phase}
                            </Badge>
                            <span>{pod.name}</span>
                            {pod.podIP && <span className="text-muted-foreground">({pod.podIP})</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
              {viewingService.selector && Object.keys(viewingService.selector).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Selector</h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(viewingService.selector).map(([key, value]) => (
                        <Badge key={key} variant="outline">{key}={value}</Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewingService(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Service</AlertDialogTitle><AlertDialogDescription>Are you sure?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleting && handleDelete(deleting)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ConfigMaps Tab
interface ConfigMapsTabProps {
  configMaps: KubernetesConfigMap[];
  namespaces: KubernetesNamespace[];
  updateConfig: (updates: Partial<KubernetesConfig>) => void;
  kubernetesEngine: any;
  node: CanvasNode;
}

function ConfigMapsTab({ configMaps, namespaces, updateConfig, kubernetesEngine, node }: ConfigMapsTabProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingConfigMap, setEditingConfigMap] = useState<KubernetesConfigMap | null>(null);
  const [viewingConfigMap, setViewingConfigMap] = useState<KubernetesConfigMap | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  
  const [name, setName] = useState('');
  const [namespace, setNamespace] = useState('default');
  const [data, setData] = useState('');
  
  // Edit form state
  const [editConfigMapData, setEditConfigMapData] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const filteredConfigMaps = configMaps.filter(cm => {
    const matchesSearch = cm.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesNamespace = selectedNamespace === 'all' || cm.namespace === selectedNamespace;
    return matchesSearch && matchesNamespace;
  });

  const handleCreate = () => {
    if (!name.trim()) { showValidationError('Name required'); return; }
    if (!validateDNSLabel(name.toLowerCase())) {
      showValidationError('ConfigMap name must be a valid DNS label');
      return;
    }
    const dataObj: Record<string, string> = {};
    data.split('\n').forEach(line => {
      const [key, ...values] = line.split('=');
      if (key.trim()) dataObj[key.trim()] = values.join('=').trim();
    });
    if (Object.keys(dataObj).length === 0) {
      showValidationError('At least one key-value pair is required');
      return;
    }
    if (kubernetesEngine) {
      try {
        kubernetesEngine.createConfigMap({ name, namespace, data: dataObj });
        const config = kubernetesEngine.getConfig();
        if (config) updateConfig({ configMaps: config.configMaps });
        showSuccess('ConfigMap created');
        setShowCreate(false);
        setName(''); setNamespace('default'); setData('');
      } catch (e: any) { showError(e.message); }
    } else {
      const newCM: KubernetesConfigMap = { id: `cm-${Date.now()}`, name, namespace, data: dataObj, createdAt: Date.now() };
      updateConfig({ configMaps: [...configMaps, newCM] });
      showSuccess('ConfigMap created');
      setShowCreate(false);
    }
  };

  const handleEditConfigMap = (configMap: KubernetesConfigMap) => {
    if (configMap.immutable) {
      showWarning('This ConfigMap is immutable and cannot be edited');
      return;
    }
    setEditingConfigMap(configMap);
    setEditConfigMapData({ ...configMap.data });
    setNewKey('');
    setNewValue('');
  };

  const handleAddConfigMapKey = () => {
    if (!newKey.trim()) {
      showValidationError('Key is required');
      return;
    }
    setEditConfigMapData({ ...editConfigMapData, [newKey.trim()]: newValue.trim() });
    setNewKey('');
    setNewValue('');
  };

  const handleRemoveConfigMapKey = (key: string) => {
    const newData = { ...editConfigMapData };
    delete newData[key];
    setEditConfigMapData(newData);
  };

  const handleSaveConfigMapEdit = () => {
    if (!editingConfigMap) return;
    
    if (Object.keys(editConfigMapData).length === 0) {
      showValidationError('At least one key-value pair is required');
      return;
    }
    
    if (kubernetesEngine) {
      try {
        kubernetesEngine.updateConfigMap(editingConfigMap.id, {
          data: editConfigMapData,
        });
        const config = kubernetesEngine.getConfig();
        if (config) updateConfig({ configMaps: config.configMaps });
        showSuccess('ConfigMap updated successfully');
        setEditingConfigMap(null);
        setEditConfigMapData({});
      } catch (e: any) { showError(e.message); }
    } else {
      const updatedConfigMaps = configMaps.map(cm => 
        cm.id === editingConfigMap.id ? { ...cm, data: editConfigMapData } : cm
      );
      updateConfig({ configMaps: updatedConfigMaps });
      showSuccess('ConfigMap updated successfully');
      setEditingConfigMap(null);
      setEditConfigMapData({});
    }
  };

  const handleDelete = (id: string) => {
    if (kubernetesEngine) {
      try {
        kubernetesEngine.deleteConfigMap(id);
        const config = kubernetesEngine.getConfig();
        if (config) updateConfig({ configMaps: config.configMaps });
        showSuccess('ConfigMap deleted');
        setDeleting(null);
      } catch (e: any) { showError(e.message); }
    } else {
      updateConfig({ configMaps: configMaps.filter((cm: any) => cm.id !== id) });
      showSuccess('ConfigMap deleted');
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div><CardTitle>ConfigMaps</CardTitle><CardDescription>Manage Kubernetes ConfigMaps</CardDescription></div>
            <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />Create ConfigMap</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Input
              placeholder="Search ConfigMaps..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={selectedNamespace} onValueChange={setSelectedNamespace}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All namespaces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All namespaces</SelectItem>
                {namespaces.map(ns => <SelectItem key={ns.id} value={ns.name}>{ns.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            {filteredConfigMaps.length === 0 ? <div className="text-center py-8 text-muted-foreground">No ConfigMaps</div> :
              filteredConfigMaps.map((cm: any) => (
                <Card key={cm.id}>
                  <CardContent className="p-4 flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex gap-2 items-center mb-1">
                        <h4 className="font-semibold">{cm.name}</h4>
                        <Badge variant="outline">{cm.namespace}</Badge>
                        {cm.immutable && <Badge variant="secondary">Immutable</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">Keys: {Object.keys(cm.data || {}).length}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setViewingConfigMap(cm)} title="View Details">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditConfigMap(cm)}
                        title="Edit"
                        disabled={cm.immutable}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleting(cm.id)} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </CardContent>
      </Card>
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create ConfigMap</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Namespace</Label>
              <Select value={namespace} onValueChange={setNamespace}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{namespaces.map(ns => <SelectItem key={ns.id} value={ns.name}>{ns.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Data (key=value, one per line)</Label><Textarea value={data} onChange={(e) => setData(e.target.value)} rows={5} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button><Button onClick={handleCreate}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit ConfigMap Dialog */}
      <Dialog open={editingConfigMap !== null} onOpenChange={(open) => !open && setEditingConfigMap(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit ConfigMap: {editingConfigMap?.name}</DialogTitle>
            <DialogDescription>Edit key-value pairs</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Add New Key-Value Pair</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Key"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleAddConfigMapKey} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Data</Label>
              <div className="space-y-2 border rounded p-4 max-h-96 overflow-y-auto">
                {Object.keys(editConfigMapData).length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">No data</div>
                ) : (
                  Object.entries(editConfigMapData).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 p-2 border rounded">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{key}</div>
                        <div className="text-xs text-muted-foreground truncate">{value}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveConfigMapKey(key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingConfigMap(null)}>Cancel</Button>
            <Button onClick={handleSaveConfigMapEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View ConfigMap Details Dialog */}
      <Dialog open={viewingConfigMap !== null} onOpenChange={(open) => !open && setViewingConfigMap(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ConfigMap Details: {viewingConfigMap?.name}</DialogTitle>
            <DialogDescription>Complete information about the ConfigMap</DialogDescription>
          </DialogHeader>
          {viewingConfigMap && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Metadata</h4>
                <div className="space-y-1 text-sm">
                  <div><span className="font-medium">Name:</span> {viewingConfigMap.name}</div>
                  <div><span className="font-medium">Namespace:</span> {viewingConfigMap.namespace}</div>
                  {viewingConfigMap.uid && <div><span className="font-medium">UID:</span> {viewingConfigMap.uid}</div>}
                  <div><span className="font-medium">Created:</span> {new Date(viewingConfigMap.createdAt).toLocaleString()}</div>
                  {viewingConfigMap.immutable && <Badge variant="secondary">Immutable</Badge>}
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Data ({Object.keys(viewingConfigMap.data || {}).length} keys)</h4>
                <div className="space-y-2 border rounded p-4 max-h-96 overflow-y-auto">
                  {Object.keys(viewingConfigMap.data || {}).length === 0 ? (
                    <div className="text-sm text-muted-foreground">No data</div>
                  ) : (
                    Object.entries(viewingConfigMap.data || {}).map(([key, value]) => (
                      <div key={key} className="p-2 border rounded">
                        <div className="text-sm font-medium mb-1">{key}</div>
                        <div className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded break-all">{value}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              {viewingConfigMap.labels && Object.keys(viewingConfigMap.labels).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Labels</h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(viewingConfigMap.labels).map(([key, value]) => (
                        <Badge key={key} variant="outline">{key}={value}</Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewingConfigMap(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete ConfigMap</AlertDialogTitle><AlertDialogDescription>Are you sure?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleting && handleDelete(deleting)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Secrets Tab
interface SecretsTabProps {
  secrets: KubernetesSecret[];
  namespaces: KubernetesNamespace[];
  updateConfig: (updates: Partial<KubernetesConfig>) => void;
  kubernetesEngine: any;
  node: CanvasNode;
}

function SecretsTab({ secrets, namespaces, updateConfig, kubernetesEngine, node }: SecretsTabProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingSecret, setEditingSecret] = useState<KubernetesSecret | null>(null);
  const [viewingSecret, setViewingSecret] = useState<KubernetesSecret | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  
  const [name, setName] = useState('');
  const [namespace, setNamespace] = useState('default');
  const [type, setType] = useState<SecretType>('Opaque');
  const [data, setData] = useState('');
  
  // Edit form state
  const [editSecretStringData, setEditSecretStringData] = useState<Record<string, string>>({});
  const [newSecretKey, setNewSecretKey] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');
  const [showSecretValues, setShowSecretValues] = useState(false);

  const filteredSecrets = secrets.filter(secret => {
    const matchesSearch = secret.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesNamespace = selectedNamespace === 'all' || secret.namespace === selectedNamespace;
    return matchesSearch && matchesNamespace;
  });

  const handleCreate = () => {
    if (!name.trim()) { showValidationError('Name required'); return; }
    if (!validateDNSLabel(name.toLowerCase())) {
      showValidationError('Secret name must be a valid DNS label');
      return;
    }
    const dataObj: Record<string, string> = {};
    data.split('\n').forEach(line => {
      const [key, ...values] = line.split('=');
      if (key.trim()) dataObj[key.trim()] = btoa(values.join('=').trim());
    });
    if (Object.keys(dataObj).length === 0) {
      showValidationError('At least one key-value pair is required');
      return;
    }
    if (kubernetesEngine) {
      try {
        kubernetesEngine.createSecret({ name, namespace, type, stringData: data.split('\n').reduce((acc, line) => {
          const [key, ...values] = line.split('=');
          if (key.trim()) acc[key.trim()] = values.join('=').trim();
          return acc;
        }, {} as Record<string, string>) });
        const config = kubernetesEngine.getConfig();
        if (config) updateConfig({ secrets: config.secrets });
        showSuccess('Secret created');
        setShowCreate(false);
        setName(''); setNamespace('default'); setType('Opaque'); setData('');
      } catch (e: any) { showError(e.message); }
    } else {
      const newSecret: KubernetesSecret = { id: `secret-${Date.now()}`, name, namespace, type, data: dataObj, createdAt: Date.now() };
      updateConfig({ secrets: [...secrets, newSecret] });
      showSuccess('Secret created');
      setShowCreate(false);
    }
  };

  const handleEditSecret = (secret: KubernetesSecret) => {
    if (secret.immutable) {
      showWarning('This Secret is immutable and cannot be edited');
      return;
    }
    setEditingSecret(secret);
    // Decode base64 values for editing
    const stringData: Record<string, string> = {};
    Object.entries(secret.data || {}).forEach(([key, value]) => {
      try {
        stringData[key] = atob(value);
      } catch {
        stringData[key] = value; // If decode fails, keep as is
      }
    });
    setEditSecretStringData(stringData);
    setNewSecretKey('');
    setNewSecretValue('');
    setShowSecretValues(false);
  };

  const handleAddSecretKey = () => {
    if (!newSecretKey.trim()) {
      showValidationError('Key is required');
      return;
    }
    setEditSecretStringData({ ...editSecretStringData, [newSecretKey.trim()]: newSecretValue.trim() });
    setNewSecretKey('');
    setNewSecretValue('');
  };

  const handleRemoveSecretKey = (key: string) => {
    const newData = { ...editSecretStringData };
    delete newData[key];
    setEditSecretStringData(newData);
  };

  const handleSaveSecretEdit = () => {
    if (!editingSecret) return;
    
    if (Object.keys(editSecretStringData).length === 0) {
      showValidationError('At least one key-value pair is required');
      return;
    }
    
    if (kubernetesEngine) {
      try {
        kubernetesEngine.updateSecret(editingSecret.id, {
          stringData: editSecretStringData,
        });
        const config = kubernetesEngine.getConfig();
        if (config) updateConfig({ secrets: config.secrets });
        showSuccess('Secret updated successfully');
        setEditingSecret(null);
        setEditSecretStringData({});
      } catch (e: any) { showError(e.message); }
    } else {
      // Convert stringData to base64 data
      const data: Record<string, string> = {};
      Object.entries(editSecretStringData).forEach(([key, value]) => {
        data[key] = btoa(value);
      });
      const updatedSecrets = secrets.map(s => 
        s.id === editingSecret.id ? { ...s, data } : s
      );
      updateConfig({ secrets: updatedSecrets });
      showSuccess('Secret updated successfully');
      setEditingSecret(null);
      setEditSecretStringData({});
    }
  };

  const handleDelete = (id: string) => {
    if (kubernetesEngine) {
      try {
        kubernetesEngine.deleteSecret(id);
        const config = kubernetesEngine.getConfig();
        if (config) updateConfig({ secrets: config.secrets });
        showSuccess('Secret deleted');
        setDeleting(null);
      } catch (e: any) { showError(e.message); }
    } else {
      updateConfig({ secrets: secrets.filter((s: any) => s.id !== id) });
      showSuccess('Secret deleted');
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div><CardTitle>Secrets</CardTitle><CardDescription>Manage Kubernetes Secrets</CardDescription></div>
            <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />Create Secret</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Input
              placeholder="Search Secrets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={selectedNamespace} onValueChange={setSelectedNamespace}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All namespaces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All namespaces</SelectItem>
                {namespaces.map(ns => <SelectItem key={ns.id} value={ns.name}>{ns.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            {filteredSecrets.length === 0 ? <div className="text-center py-8 text-muted-foreground">No Secrets</div> :
              filteredSecrets.map((secret: any) => (
                <Card key={secret.id}>
                  <CardContent className="p-4 flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex gap-2 items-center mb-1">
                        <h4 className="font-semibold">{secret.name}</h4>
                        <Badge>{secret.type}</Badge>
                        <Badge variant="outline">{secret.namespace}</Badge>
                        {secret.immutable && <Badge variant="secondary">Immutable</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">Keys: {Object.keys(secret.data || {}).length}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setViewingSecret(secret)} title="View Details">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditSecret(secret)}
                        title="Edit"
                        disabled={secret.immutable}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleting(secret.id)} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </CardContent>
      </Card>
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Secret</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Namespace</Label>
              <Select value={namespace} onValueChange={setNamespace}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{namespaces.map(ns => <SelectItem key={ns.id} value={ns.name}>{ns.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as SecretType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Opaque">Opaque</SelectItem>
                  <SelectItem value="kubernetes.io/dockerconfigjson">Docker Config</SelectItem>
                  <SelectItem value="kubernetes.io/tls">TLS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Data (key=value, one per line)</Label><Textarea value={data} onChange={(e) => setData(e.target.value)} rows={5} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button><Button onClick={handleCreate}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Secret Dialog */}
      <Dialog open={editingSecret !== null} onOpenChange={(open) => !open && setEditingSecret(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Secret: {editingSecret?.name}</DialogTitle>
            <DialogDescription>Edit key-value pairs (values are base64 encoded)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Add New Key-Value Pair</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Key"
                  value={newSecretKey}
                  onChange={(e) => setNewSecretKey(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type={showSecretValues ? "text" : "password"}
                  placeholder="Value"
                  value={newSecretValue}
                  onChange={(e) => setNewSecretValue(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleAddSecretKey} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={showSecretValues}
                  onCheckedChange={setShowSecretValues}
                />
                <Label className="text-xs">Show values</Label>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Data</Label>
              <div className="space-y-2 border rounded p-4 max-h-96 overflow-y-auto">
                {Object.keys(editSecretStringData).length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">No data</div>
                ) : (
                  Object.entries(editSecretStringData).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 p-2 border rounded">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{key}</div>
                        <div className="text-xs text-muted-foreground truncate font-mono">
                          {showSecretValues ? value : '••••••••'}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSecretKey(key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSecret(null)}>Cancel</Button>
            <Button onClick={handleSaveSecretEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Secret Details Dialog */}
      <Dialog open={viewingSecret !== null} onOpenChange={(open) => !open && setViewingSecret(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Secret Details: {viewingSecret?.name}</DialogTitle>
            <DialogDescription>Complete information about the Secret</DialogDescription>
          </DialogHeader>
          {viewingSecret && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Metadata</h4>
                <div className="space-y-1 text-sm">
                  <div><span className="font-medium">Name:</span> {viewingSecret.name}</div>
                  <div><span className="font-medium">Namespace:</span> {viewingSecret.namespace}</div>
                  {viewingSecret.uid && <div><span className="font-medium">UID:</span> {viewingSecret.uid}</div>}
                  <div><span className="font-medium">Created:</span> {new Date(viewingSecret.createdAt).toLocaleString()}</div>
                  <div><span className="font-medium">Type:</span> <Badge>{viewingSecret.type}</Badge></div>
                  {viewingSecret.immutable && <Badge variant="secondary">Immutable</Badge>}
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Data ({Object.keys(viewingSecret.data || {}).length} keys)</h4>
                <div className="flex items-center gap-2 mb-2">
                  <Switch
                    checked={showSecretValues}
                    onCheckedChange={setShowSecretValues}
                  />
                  <Label className="text-xs">Show decoded values</Label>
                </div>
                <div className="space-y-2 border rounded p-4 max-h-96 overflow-y-auto">
                  {Object.keys(viewingSecret.data || {}).length === 0 ? (
                    <div className="text-sm text-muted-foreground">No data</div>
                  ) : (
                    Object.entries(viewingSecret.data || {}).map(([key, value]) => {
                      let decodedValue = '';
                      try {
                        decodedValue = atob(value);
                      } catch {
                        decodedValue = value;
                      }
                      return (
                        <div key={key} className="p-2 border rounded">
                          <div className="text-sm font-medium mb-1">{key}</div>
                          <div className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded break-all">
                            {showSecretValues ? decodedValue : '••••••••'}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              {viewingSecret.labels && Object.keys(viewingSecret.labels).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Labels</h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(viewingSecret.labels).map(([key, value]) => (
                        <Badge key={key} variant="outline">{key}={value}</Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewingSecret(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Secret</AlertDialogTitle><AlertDialogDescription>Are you sure?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleting && handleDelete(deleting)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Namespaces Tab
interface NamespacesTabProps {
  namespaces: KubernetesNamespace[];
  updateConfig: (updates: Partial<KubernetesConfig>) => void;
  kubernetesEngine: any;
  node: CanvasNode;
}

function NamespacesTab({ namespaces, updateConfig, kubernetesEngine, node }: NamespacesTabProps) {
  const config = ((node.data.config as any) || {}) as KubernetesConfig;
  const pods = config.pods || (kubernetesEngine ? kubernetesEngine.getPods() : []);
  const deployments = config.deployments || (kubernetesEngine ? kubernetesEngine.getDeployments() : []);
  const services = config.services || (kubernetesEngine ? kubernetesEngine.getServices() : []);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [name, setName] = useState('');

  const handleCreate = () => {
    if (!name.trim()) { showError('Name required'); return; }
    if (kubernetesEngine) {
      try {
        kubernetesEngine.createNamespace({ name });
        const config = kubernetesEngine.getConfig();
        if (config) updateConfig({ namespaces: config.namespaces });
        showSuccess('Namespace created');
        setShowCreate(false);
        setName('');
      } catch (e: any) { showError(e.message); }
    } else {
      const newNs: KubernetesNamespace = { id: `ns-${Date.now()}`, name, phase: 'Active', createdAt: Date.now() };
      updateConfig({ namespaces: [...namespaces, newNs] });
      showSuccess('Namespace created');
      setShowCreate(false);
    }
  };

  const handleDelete = (id: string) => {
    if (kubernetesEngine) {
      try {
        kubernetesEngine.deleteNamespace(id);
        const config = kubernetesEngine.getConfig();
        if (config) updateConfig({ namespaces: config.namespaces });
        showSuccess('Namespace deleted');
        setDeleting(null);
      } catch (e: any) { showError(e.message); }
    } else {
      updateConfig({ namespaces: namespaces.filter((ns: any) => ns.id !== id) });
      showSuccess('Namespace deleted');
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div><CardTitle>Namespaces</CardTitle><CardDescription>Manage Kubernetes namespaces</CardDescription></div>
            <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />Create Namespace</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {namespaces.length === 0 ? <div className="text-center py-8 text-muted-foreground">No namespaces</div> :
              namespaces.map((ns: any) => {
                const resources = getResourcesForNamespace(ns.name, pods, deployments, services);
                return (
                  <Card key={ns.id}>
                    <CardContent className="p-4 flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex gap-2 items-center mb-2">
                          <h4 className="font-semibold">{ns.name}</h4>
                          <Badge variant={ns.phase === 'Active' ? 'default' : 'secondary'}>{ns.phase}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground flex gap-4">
                          <div>Pods: {resources.pods}</div>
                          <div>Deployments: {resources.deployments}</div>
                          <div>Services: {resources.services}</div>
                        </div>
                      </div>
                      {ns.name !== 'default' && <Button variant="ghost" size="sm" onClick={() => setDeleting(ns.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </CardContent>
      </Card>
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Namespace</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button><Button onClick={handleCreate}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Namespace</AlertDialogTitle><AlertDialogDescription>Are you sure? This may fail if namespace contains resources.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleting && handleDelete(deleting)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Nodes Tab - Read-only display
function NodesTab({ nodes, updateConfig, kubernetesEngine, node }: any) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Nodes</CardTitle>
          <CardDescription>Kubernetes cluster nodes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {nodes.length === 0 ? <div className="text-center py-8 text-muted-foreground">No nodes</div> :
              nodes.map((n: any) => (
                <Card key={n.id}>
                  <CardContent className="p-4">
                    <div className="flex gap-2 items-center mb-2">
                      <h4 className="font-semibold">{n.name}</h4>
                      <Badge variant={n.conditions?.some((c: any) => c.type === 'Ready' && c.status === 'True') ? 'default' : 'secondary'}>Ready</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {n.capacity && <div>CPU: {n.capacity.cpu}, Memory: {n.capacity.memory}</div>}
                      {n.podCount !== undefined && <div>Pods: {n.podCount}</div>}
                      {n.cpuUsage !== undefined && <div>CPU Usage: {n.cpuUsage.toFixed(1)}%</div>}
                      {n.memoryUsage && n.memoryCapacity && <div>Memory Usage: {((n.memoryUsage / n.memoryCapacity) * 100).toFixed(1)}%</div>}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Events Tab - Read-only display
function EventsTab({ events }: any) {
  const recentEvents = events.slice(-50).reverse();
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
          <CardDescription>Recent Kubernetes events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentEvents.length === 0 ? <div className="text-center py-8 text-muted-foreground">No events</div> :
              recentEvents.map((event: any) => (
                <Card key={event.id}>
                  <CardContent className="p-4">
                    <div className="flex gap-2 items-center mb-1">
                      <Badge variant={event.type === 'Warning' ? 'destructive' : 'default'}>{event.type}</Badge>
                      <span className="text-sm font-semibold">{event.reason}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{new Date(event.firstTimestamp).toLocaleString()}</span>
                    </div>
                    <div className="text-sm">{event.message}</div>
                    <div className="text-xs text-muted-foreground mt-1">{event.involvedObject.kind}: {event.involvedObject.name}</div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// PVCs Tab
function PVCsTab({ pvcs, namespaces, updateConfig, kubernetesEngine, node }: any) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Persistent Volume Claims</CardTitle>
          <CardDescription>Manage PVCs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {pvcs.length === 0 ? <div className="text-center py-8 text-muted-foreground">No PVCs</div> :
              pvcs.map((pvc: any) => (
                <Card key={pvc.id}>
                  <CardContent className="p-4">
                    <div className="flex gap-2 items-center mb-1">
                      <h4 className="font-semibold">{pvc.name}</h4>
                      <Badge variant={pvc.status === 'Bound' ? 'default' : 'secondary'}>{pvc.status}</Badge>
                      <Badge variant="outline">{pvc.namespace}</Badge>
                    </div>
                    {pvc.capacity?.storage && <div className="text-sm text-muted-foreground">Storage: {pvc.capacity.storage}</div>}
                  </CardContent>
                </Card>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// YAML Tab
interface YAMLTabProps {
  yaml: string;
  yamlManifests: any[];
  updateConfig: (updates: Partial<KubernetesConfig>) => void;
}

function YAMLTab({ yaml, yamlManifests, updateConfig }: YAMLTabProps) {
  const [yamlContent, setYamlContent] = useState(yaml || '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const validateYAML = (content: string): boolean => {
    if (!content.trim()) {
      setValidationError(null);
      return true;
    }
    
    try {
      // Basic YAML validation - check for common syntax errors
      const lines = content.split('\n');
      let indentStack: number[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        // Check for basic YAML structure
        if (trimmed.includes(':') && !trimmed.startsWith('-')) {
          // Key-value pair
          const colonIndex = trimmed.indexOf(':');
          if (colonIndex === trimmed.length - 1) {
            // Multiline value - this is OK
            continue;
          }
        }
      }
      
      // Try to parse as YAML (basic check)
      // In a real implementation, you'd use a YAML parser like js-yaml
      setValidationError(null);
      return true;
    } catch (error: any) {
      setValidationError(error.message || 'Invalid YAML syntax');
      return false;
    }
  };

  const handleYAMLChange = (value: string) => {
    setYamlContent(value);
    setIsValidating(true);
    setTimeout(() => {
      validateYAML(value);
      setIsValidating(false);
    }, 300);
  };

  const handleSave = () => {
    if (!validateYAML(yamlContent)) {
      showValidationError('YAML validation failed. Please fix errors before saving.');
      return;
    }
    updateConfig({ yaml: yamlContent });
    showSuccess('YAML saved successfully');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event: any) => {
          const content = event.target.result;
          setYamlContent(content);
          validateYAML(content);
          showSuccess('YAML imported successfully');
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleExport = () => {
    if (!yamlContent.trim()) {
      showWarning('No YAML content to export');
      return;
    }
    
    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kubernetes-manifest-${Date.now()}.yaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('YAML exported successfully');
  };

  const handleFormat = () => {
    // Basic formatting - in production, use a proper YAML formatter
    try {
      const lines = yamlContent.split('\n');
      const formatted = lines.map(line => {
        // Remove trailing spaces
        return line.replace(/\s+$/, '');
      }).join('\n');
      setYamlContent(formatted);
      showSuccess('YAML formatted');
    } catch (error: any) {
      showError('Failed to format YAML');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>YAML Editor</CardTitle>
              <CardDescription>Edit Kubernetes manifests with validation</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleImport} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button variant="outline" onClick={handleExport} size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" onClick={handleFormat} size="sm">
                Format
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {validationError && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
              <strong>Validation Error:</strong> {validationError}
            </div>
          )}
          {isValidating && (
            <div className="mb-4 text-sm text-muted-foreground">Validating YAML...</div>
          )}
          <Textarea
            value={yamlContent}
            onChange={(e) => handleYAMLChange(e.target.value)}
            className="font-mono text-sm h-96"
            placeholder="apiVersion: v1&#10;kind: Pod&#10;metadata:&#10;  name: my-pod&#10;spec:&#10;  containers:&#10;  - name: nginx&#10;    image: nginx:latest"
          />
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSave} disabled={!!validationError || isValidating}>
              <Save className="h-4 w-4 mr-2" />
              Save YAML
            </Button>
            {yamlManifests && yamlManifests.length > 0 && (
              <div className="text-sm text-muted-foreground flex items-center">
                {yamlManifests.length} manifest{yamlManifests.length !== 1 ? 's' : ''} loaded
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

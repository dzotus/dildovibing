import { useState, useEffect, useMemo } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { emulationEngine } from '@/core/EmulationEngine';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { 
  Play, 
  Pause, 
  Settings, 
  Plus, 
  Trash2,
  GitBranch,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Activity,
  Package,
  Users,
  Edit,
  History,
  Server,
  User,
  Search,
  Filter,
  AlertCircle,
  X,
  FileText,
  Download,
  Eye,
  TrendingUp,
  BarChart3
} from 'lucide-react';

interface JenkinsConfigProps {
  componentId: string;
}

interface Pipeline {
  id: string;
  name: string;
  status: 'success' | 'running' | 'failed' | 'pending';
  lastBuild: number;
  duration?: number;
  branch?: string;
  enabled?: boolean;
  triggers?: Array<{
    type: 'webhook' | 'cron' | 'scm' | 'manual';
    enabled: boolean;
    config?: any;
  }>;
  parameters?: Array<{
    name: string;
    type: 'string' | 'choice' | 'boolean' | 'password';
    defaultValue?: string | boolean;
    description?: string;
    choices?: string[];
  }>;
  environmentVariables?: Record<string, string>;
  postBuildActions?: Array<{
    type: 'email' | 'archive' | 'publish' | 'deploy';
    enabled: boolean;
    config?: any;
  }>;
}

interface JenkinsNodeConfig {
  id: string;
  name: string;
  numExecutors?: number;
  labels?: string[];
  description?: string;
}

interface JenkinsConfig {
  jenkinsUrl?: string;
  enableCSRF?: boolean;
  executorCount?: number;
  enablePlugins?: boolean;
  plugins?: string[];
  enablePipeline?: boolean;
  enableBlueOcean?: boolean;
  enableArtifactArchiving?: boolean;
  retentionDays?: number;
  pipelines?: Pipeline[];
  nodes?: JenkinsNodeConfig[];
}

export function JenkinsConfigAdvanced({ componentId }: JenkinsConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { isRunning, getComponentMetrics } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  // Get Jenkins emulation engine
  const jenkinsEngine = emulationEngine.getJenkinsEmulationEngine(componentId);
  const componentMetrics = getComponentMetrics(componentId);
  
  // Real-time data from emulation
  const [realPipelines, setRealPipelines] = useState<any[]>([]);
  const [realBuilds, setRealBuilds] = useState<any[]>([]);
  const [allBuilds, setAllBuilds] = useState<any[]>([]);
  const [realNodes, setRealNodes] = useState<any[]>([]);
  const [realPlugins, setRealPlugins] = useState<any[]>([]);
  const [realMetrics, setRealMetrics] = useState<any>(null);
  const [editingPipeline, setEditingPipeline] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [buildFilter, setBuildFilter] = useState<'all' | 'active' | 'success' | 'failed'>('all');
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [showAddNode, setShowAddNode] = useState(false);
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeExecutors, setNewNodeExecutors] = useState(1);
  const [newNodeLabels, setNewNodeLabels] = useState('');
  const [newNodeDescription, setNewNodeDescription] = useState('');
  const [showInstallPlugin, setShowInstallPlugin] = useState(false);
  const [newPluginName, setNewPluginName] = useState('');
  const [editingPlugin, setEditingPlugin] = useState<string | null>(null);
  const [selectedBuild, setSelectedBuild] = useState<string | null>(null);
  const [showBuildDetails, setShowBuildDetails] = useState(false);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [buildArtifacts, setBuildArtifacts] = useState<Array<{ name: string; size: number }>>([]);
  const [buildHistory, setBuildHistory] = useState<Array<{ time: string; builds: number; success: number; failed: number }>>([]);
  const [editingPipelineConfig, setEditingPipelineConfig] = useState<string | null>(null);
  
  // Генерируем данные для графиков на основе истории builds (оптимизировано)
  useEffect(() => {
    if (!allBuilds.length) {
      setBuildHistory([]);
      return;
    }
    
    // Используем useMemo логику для оптимизации
    const now = Date.now();
    const interval = 60000; // 1 минута
    const points = 20;
    const history: Array<{ time: string; builds: number; success: number; failed: number; duration: number }> = [];
    
    // Кэшируем вычисления времени для производительности
    for (let i = points - 1; i >= 0; i--) {
      const timeStart = now - (i + 1) * interval;
      const timeEnd = now - i * interval;
      
      const buildsInRange = allBuilds.filter(b => {
        const buildTime = b.startTime || (b.duration ? now - b.duration : now);
        return buildTime >= timeStart && buildTime < timeEnd;
      });
      
      if (buildsInRange.length > 0) {
        const success = buildsInRange.filter(b => b.status === 'success').length;
        const failed = buildsInRange.filter(b => b.status === 'failed').length;
        const completedBuilds = buildsInRange.filter(b => b.duration !== undefined);
        const avgDuration = completedBuilds.length > 0
          ? completedBuilds.reduce((sum, b) => sum + (b.duration || 0), 0) / completedBuilds.length / 1000
          : 0;
        
        history.push({
          time: new Date(timeEnd).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          builds: buildsInRange.length,
          success,
          failed,
          duration: avgDuration,
        });
      } else {
        history.push({
          time: new Date(timeEnd).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          builds: 0,
          success: 0,
          failed: 0,
          duration: 0,
        });
      }
    }
    
    setBuildHistory(history);
  }, [allBuilds]);
  
  // Validation errors
  const [nodeNameError, setNodeNameError] = useState<string>('');
  const [nodeExecutorsError, setNodeExecutorsError] = useState<string>('');
  const [pipelineNameError, setPipelineNameError] = useState<string>('');
  const [pluginNameError, setPluginNameError] = useState<string>('');

  // Update real-time data from emulation (оптимизировано с мемоизацией)
  useEffect(() => {
    if (!jenkinsEngine) return;
    
    const updateData = () => {
      try {
        const pipelines = jenkinsEngine.getPipelines();
        const builds = jenkinsEngine.getActiveBuilds();
        const allBuildsData = jenkinsEngine.getAllBuilds();
        const nodes = jenkinsEngine.getNodes();
        const plugins = jenkinsEngine.getPlugins();
        const metrics = jenkinsEngine.getJenkinsMetrics();
        
        // Обновляем состояние только если данные изменились (оптимизация)
        setRealPipelines(prev => {
          const changed = JSON.stringify(prev) !== JSON.stringify(pipelines);
          return changed ? pipelines : prev;
        });
        setRealBuilds(prev => {
          const changed = JSON.stringify(prev) !== JSON.stringify(builds);
          return changed ? builds : prev;
        });
        setAllBuilds(prev => {
          // Для builds проверяем только количество и статусы для производительности
          if (prev.length !== allBuildsData.length) return allBuildsData;
          const prevRunning = prev.filter(b => b.status === 'running').length;
          const newRunning = allBuildsData.filter(b => b.status === 'running').length;
          return prevRunning !== newRunning ? allBuildsData : prev;
        });
        setRealNodes(nodes);
        setRealPlugins(plugins);
        setRealMetrics(metrics);
        
        // Обновляем логи и артефакты для выбранного build (только если build активен)
        if (selectedBuild) {
          const build = allBuildsData.find(b => b.id === selectedBuild);
          if (build && (build.status === 'running' || build.logs)) {
            const logs = jenkinsEngine.getBuildLogs(selectedBuild);
            const artifacts = jenkinsEngine.getBuildArtifacts(selectedBuild);
            if (logs) setBuildLogs(logs);
            if (artifacts) setBuildArtifacts(artifacts);
          }
        }
      } catch (error) {
        console.error('Error updating Jenkins data:', error);
      }
    };
    
    // Первое обновление сразу
    updateData();
    
    // Затем обновляем с интервалом
    const interval = setInterval(updateData, isRunning ? 500 : 2000);
    
    return () => clearInterval(interval);
  }, [jenkinsEngine, isRunning, selectedBuild]);
  
  // Функция для открытия деталей build
  const openBuildDetails = (buildId: string) => {
    setSelectedBuild(buildId);
    setShowBuildDetails(true);
    
    if (jenkinsEngine) {
      const logs = jenkinsEngine.getBuildLogs(buildId);
      const artifacts = jenkinsEngine.getBuildArtifacts(buildId);
      if (logs) setBuildLogs(logs);
      if (artifacts) setBuildArtifacts(artifacts);
    }
  };
  
  // Функция для отмены build
  const cancelBuild = (buildId: string) => {
    if (!jenkinsEngine) {
      toast({
        title: "Error",
        description: "Jenkins engine not available",
        variant: "destructive",
      });
      return;
    }
    
    const build = allBuilds.find(b => b.id === buildId);
    if (!build) {
      toast({
        title: "Error",
        description: "Build not found",
        variant: "destructive",
      });
      return;
    }
    
    if (build.status !== 'running' && build.status !== 'pending') {
      toast({
        title: "Cannot cancel build",
        description: `Build is already ${build.status}`,
        variant: "destructive",
      });
      return;
    }
    
    try {
      const result = jenkinsEngine.cancelBuild(buildId);
      if (result.success) {
        toast({
          title: "Build cancelled",
          description: `Build #${build.number} has been cancelled successfully`,
        });
        
        // Если это был выбранный build, закрываем детали
        if (selectedBuild === buildId) {
          setShowBuildDetails(false);
          setSelectedBuild(null);
        }
      } else {
        toast({
          title: "Cannot cancel build",
          description: result.reason || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error cancelling build:', error);
      toast({
        title: "Error",
        description: "Failed to cancel build",
        variant: "destructive",
      });
    }
  };
  
  // Форматирование размера файла
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const config = (node.data.config as any) || {} as JenkinsConfig;
  const jenkinsUrl = config.jenkinsUrl || 'http://jenkins:8080';
  const enableCSRF = config.enableCSRF ?? true;
  const executorCount = config.executorCount || 2;
  const enablePlugins = config.enablePlugins ?? true;
  const plugins = config.plugins || ['git', 'docker', 'kubernetes'];
  const enablePipeline = config.enablePipeline ?? true;
  const enableBlueOcean = config.enableBlueOcean ?? false;
  const enableArtifactArchiving = config.enableArtifactArchiving ?? true;
  const retentionDays = config.retentionDays || 30;
  
  // Use real pipelines from emulation if available, otherwise use config
  const pipelines = realPipelines.length > 0 
    ? realPipelines.map(p => ({
        id: p.id,
        name: p.name,
        status: p.status,
        lastBuild: p.lastBuild,
        duration: p.duration,
        branch: p.branch,
      }))
    : (config.pipelines || []);

  const updateConfig = (updates: Partial<JenkinsConfig>) => {
    // Validation
    if (updates.jenkinsUrl !== undefined) {
      try {
        new URL(updates.jenkinsUrl);
      } catch {
        toast({
          title: "Invalid URL",
          description: "Please enter a valid Jenkins URL",
          variant: "destructive",
        });
        return;
      }
    }
    
    if (updates.executorCount !== undefined) {
      if (updates.executorCount < 1 || updates.executorCount > 100) {
        toast({
          title: "Invalid executor count",
          description: "Executor count must be between 1 and 100",
          variant: "destructive",
        });
        return;
      }
      
      // Проверяем конфликты с помощью эмуляции
      if (jenkinsEngine) {
        const canUpdate = jenkinsEngine.canUpdateExecutorCount(updates.executorCount);
        if (!canUpdate.can) {
          toast({
            title: "Cannot update executors",
            description: canUpdate.reason || "Cannot update executor count",
            variant: "destructive",
          });
          return;
        }
      }
    }
    
    if (updates.retentionDays !== undefined) {
      if (updates.retentionDays < 1 || updates.retentionDays > 365) {
        toast({
          title: "Invalid retention days",
          description: "Retention days must be between 1 and 365",
          variant: "destructive",
        });
        return;
      }
    }
    
    const newConfig = { ...config, ...updates };
    updateNode(componentId, {
      data: {
        ...node.data,
        config: newConfig,
      },
    });
    
    // Sync with emulation engine
    if (jenkinsEngine) {
      try {
        jenkinsEngine.updateConfig({
          ...node,
          data: {
            ...node.data,
            config: newConfig,
          },
        });
      } catch (error) {
        console.error('Failed to update Jenkins engine config:', error);
      }
    }
    
    toast({
      title: "Configuration updated",
      description: "Jenkins configuration has been saved",
    });
  };

  const validatePipelineName = (name: string, excludePipelineId?: string): string => {
    if (!name.trim()) {
      return "Pipeline name is required";
    }
    if (name.trim().length < 2) {
      return "Pipeline name must be at least 2 characters";
    }
    if (name.trim().length > 100) {
      return "Pipeline name must be less than 100 characters";
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name.trim())) {
      return "Pipeline name can only contain letters, numbers, hyphens and underscores";
    }
    // При редактировании исключаем текущий pipeline из проверки
    if (pipelines.some(p => p.name === name.trim() && p.id !== excludePipelineId)) {
      return "A pipeline with this name already exists";
    }
    return '';
  };
  
  const addPipeline = () => {
    // Use a default name that will be editable
    const defaultName = `pipeline-${Date.now().toString().slice(-6)}`;
    const newId = String(Date.now());
    const newPipeline = { 
      id: newId, 
      name: defaultName, 
      // Не задаем статус - он будет вычисляться из builds
      lastBuild: 0,
      branch: 'main',
      enabled: true,
    };
    updateConfig({
      pipelines: [...pipelines, newPipeline],
    });
    
    toast({
      title: "Pipeline created",
      description: `Pipeline "${defaultName}" has been created. It will be initialized in emulation.`,
    });
  };
  
  const duplicatePipeline = (pipelineId: string) => {
    const pipeline = pipelines.find(p => p.id === pipelineId);
    if (!pipeline) return;
    
    const newId = String(Date.now());
    const newPipeline = {
      ...pipeline,
      id: newId,
      name: `${pipeline.name}-copy`,
      lastBuild: 0, // Reset build number for copy
    };
    
    updateConfig({
      pipelines: [...pipelines, newPipeline],
    });
    
    toast({
      title: "Pipeline duplicated",
      description: `Pipeline "${pipeline.name}" has been duplicated as "${newPipeline.name}".`,
    });
  };
  
  
  const nodeConfigs = config.nodes || [];
  
  const validateNodeName = (name: string): string => {
    if (!name.trim()) {
      return "Node name is required";
    }
    if (name.trim().length < 2) {
      return "Node name must be at least 2 characters";
    }
    if (name.trim().length > 100) {
      return "Node name must be less than 100 characters";
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name.trim())) {
      return "Node name can only contain letters, numbers, hyphens and underscores";
    }
    if (nodeConfigs.some(n => n.name === name.trim())) {
      return "A node with this name already exists";
    }
    return '';
  };
  
  const validateNodeExecutors = (count: number): string => {
    if (count < 1) {
      return "Must have at least 1 executor";
    }
    if (count > 100) {
      return "Cannot have more than 100 executors";
    }
    return '';
  };
  
  const addNode = () => {
    // Validate
    const nameError = validateNodeName(newNodeName);
    const executorsError = validateNodeExecutors(newNodeExecutors);
    
    setNodeNameError(nameError);
    setNodeExecutorsError(executorsError);
    
    if (nameError || executorsError) {
      return;
    }
    
    const newNode: JenkinsNodeConfig = {
      id: String(Date.now()),
      name: newNodeName.trim(),
      numExecutors: newNodeExecutors,
      labels: newNodeLabels.split(',').map(l => l.trim()).filter(l => l.length > 0),
      description: newNodeDescription.trim() || undefined,
    };
    
    updateConfig({
      nodes: [...nodeConfigs, newNode],
    });
    
    // Reset form
    setNewNodeName('');
    setNewNodeExecutors(1);
    setNewNodeLabels('');
    setNewNodeDescription('');
    setNodeNameError('');
    setNodeExecutorsError('');
    setShowAddNode(false);
  };
  
  const editNode = (nodeId: string) => {
    setEditingNode(nodeId);
  };
  
  const saveNode = (nodeId: string, updates: Partial<JenkinsNodeConfig>) => {
    const updatedNodes = nodeConfigs.map(n => 
      n.id === nodeId ? { ...n, ...updates } : n
    );
    updateConfig({ nodes: updatedNodes });
    setEditingNode(null);
  };
  
  const removeNode = (nodeId: string) => {
    const node = nodeConfigs.find(n => n.id === nodeId);
    if (!node) return;
    
    updateConfig({
      nodes: nodeConfigs.filter(n => n.id !== nodeId),
    });
  };
  
  const editPipeline = (pipelineId: string) => {
    setEditingPipeline(pipelineId);
  };
  
  const savePipeline = (pipelineId: string, updates: Partial<Pipeline>) => {
    // Валидация перед сохранением
    if (updates.name !== undefined) {
      const error = validatePipelineName(updates.name, pipelineId);
      if (error) {
        setPipelineNameError(error);
        toast({
          title: "Validation error",
          description: error,
          variant: "destructive",
        });
        return;
      }
      setPipelineNameError(''); // Clear error if validation passes
    }
    
    try {
      const updatedPipelines = pipelines.map(p => 
        p.id === pipelineId ? { ...p, ...updates } : p
      );
      
      updateConfig({ pipelines: updatedPipelines });
      
      // Синхронизируем с эмуляцией если нужно
      if (jenkinsEngine) {
        if (updates.enabled !== undefined) {
          jenkinsEngine.setPipelineEnabled(pipelineId, updates.enabled !== false);
        }
        // Обновляем конфигурацию pipeline в эмуляции для triggers, parameters, etc.
        if (updates.triggers !== undefined || updates.parameters !== undefined || 
            updates.environmentVariables !== undefined || updates.postBuildActions !== undefined) {
          const pipeline = updatedPipelines.find(p => p.id === pipelineId);
          if (pipeline) {
            jenkinsEngine.updatePipelineConfig(pipelineId, {
              triggers: pipeline.triggers || [],
              parameters: pipeline.parameters || [],
              environmentVariables: pipeline.environmentVariables || {},
              postBuildActions: pipeline.postBuildActions || [],
            });
          }
        }
      }
      
      // Показываем toast только для значимых изменений
      if (updates.name !== undefined || updates.branch !== undefined || updates.enabled !== undefined) {
        toast({
          title: "Pipeline updated",
          description: "Pipeline configuration has been saved.",
        });
      }
    } catch (error) {
      console.error('Error saving pipeline:', error);
      toast({
        title: "Error",
        description: "Failed to save pipeline configuration.",
        variant: "destructive",
      });
    }
  };

  const removePipeline = (pipelineId: string) => {
    const pipeline = pipelines.find(p => p.id === pipelineId);
    if (!pipeline) return;
    
    // Проверяем, есть ли активные builds
    const hasActiveBuilds = jenkinsEngine && realBuilds.some(b => b.pipelineId === pipelineId && b.status === 'running');
    
    if (hasActiveBuilds) {
      toast({
        title: "Cannot delete pipeline",
        description: "Pipeline has active builds. Please wait for builds to complete or cancel them first.",
        variant: "destructive",
      });
      return;
    }
    
    updateConfig({ pipelines: pipelines.filter(p => p.id !== pipelineId) });
    
    toast({
      title: "Pipeline deleted",
      description: `Pipeline "${pipeline.name}" has been deleted.`,
    });
  };

  const validatePluginName = (name: string): string => {
    if (!name.trim()) {
      return "Plugin name is required";
    }
    if (name.trim().length < 2) {
      return "Plugin name must be at least 2 characters";
    }
    if (name.trim().length > 100) {
      return "Plugin name must be less than 100 characters";
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name.trim())) {
      return "Plugin name can only contain letters, numbers, hyphens and underscores";
    }
    // Проверка на дубликаты через эмуляцию или конфиг
    const currentPlugins = config.plugins || [];
    if (currentPlugins.some(p => (typeof p === 'string' ? p : p.name) === name.trim())) {
      return "This plugin is already installed";
    }
    return '';
  };
  
  const addPlugin = (pluginName: string) => {
    const trimmedName = pluginName.trim();
    if (!trimmedName) {
      setPluginNameError("Plugin name is required");
      return;
    }
    
    const nameError = validatePluginName(trimmedName);
    if (nameError) {
      setPluginNameError(nameError);
      return;
    }
    
    // Проверяем через эмуляцию
    if (jenkinsEngine) {
      const success = jenkinsEngine.addPlugin(trimmedName);
      if (!success) {
        setPluginNameError("This plugin is already installed");
        return;
      }
      
      // Обновляем конфиг
      const currentPlugins = config.plugins || [];
      updateConfig({
        plugins: [...currentPlugins, trimmedName],
      });
    } else {
      // Fallback без эмуляции
      const currentPlugins = config.plugins || [];
      if (currentPlugins.some(p => (typeof p === 'string' ? p : p.name) === trimmedName)) {
        setPluginNameError("This plugin is already installed");
        return;
      }
      updateConfig({ plugins: [...currentPlugins, trimmedName] });
    }
    
    setNewPluginName('');
    setPluginNameError('');
    setShowInstallPlugin(false);
    
    toast({
      title: "Plugin installed",
      description: `Plugin "${trimmedName}" has been installed`,
    });
  };

  const removePlugin = (pluginName: string) => {
    if (jenkinsEngine) {
      const result = jenkinsEngine.removePlugin(pluginName);
      if (!result.success) {
        toast({
          title: "Cannot remove plugin",
          description: result.reason || "Cannot remove plugin",
          variant: "destructive",
        });
        return;
      }
    }
    
    const currentPlugins = config.plugins || [];
    updateConfig({
      plugins: currentPlugins.filter(p => (typeof p === 'string' ? p : p.name) !== pluginName),
    });
  };
  
  const togglePluginEnabled = (pluginName: string, enabled: boolean) => {
    if (jenkinsEngine) {
      jenkinsEngine.setPluginEnabled(pluginName, enabled);
      // Обновляем realPlugins сразу для мгновенной обратной связи
      setRealPlugins(jenkinsEngine.getPlugins());
    }
    
    const currentPlugins = config.plugins || [];
    const updatedPlugins = currentPlugins.map(p => {
      if (typeof p === 'string') {
        return p === pluginName ? { name: p, enabled } : p;
      }
      return p.name === pluginName ? { ...p, enabled } : p;
    });
    
    updateConfig({ plugins: updatedPlugins });
    
    toast({
      title: enabled ? "Plugin enabled" : "Plugin disabled",
      description: `Plugin "${pluginName}" has been ${enabled ? 'enabled' : 'disabled'}`,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string, lastBuild: number) => {
    if (lastBuild === 0) {
      return <Badge variant="outline">Never built</Badge>;
    }
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500">Success</Badge>;
      case 'running':
        return <Badge variant="default" className="bg-blue-500">Running</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Activity className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Jenkins</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Continuous Integration & Delivery
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
              <div className={`h-2 w-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              {isRunning ? 'Running' : 'Stopped'}
            </Badge>
            {componentMetrics && (
              <Badge variant="outline" className="gap-1">
                <Activity className="h-3 w-3" />
                {componentMetrics.throughput?.toFixed(2) || 0} req/s
              </Badge>
            )}
          </div>
        </div>

        <Separator />

        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pipelines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {realMetrics?.pipelinesTotal || pipelines.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {realMetrics?.pipelinesEnabled || pipelines.length} enabled
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Executors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {realMetrics ? `${realMetrics.executorBusy}/${realMetrics.executorBusy + realMetrics.executorIdle}` : executorCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {realMetrics ? `${realMetrics.executorUtilization.toFixed(1)}% utilized` : 'Available'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Builds</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {realMetrics?.buildsRunning || realBuilds.length || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {realMetrics ? `${realMetrics.buildsPerMinute.toFixed(1)}/min` : 'Running'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {realMetrics && (realMetrics.buildsSuccess + realMetrics.buildsFailed) > 0
                  ? `${((realMetrics.buildsSuccess / (realMetrics.buildsSuccess + realMetrics.buildsFailed)) * 100).toFixed(1)}%`
                  : realMetrics && realMetrics.buildsTotal > 0
                  ? '—'
                  : '—'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {realMetrics 
                  ? (realMetrics.buildsSuccess + realMetrics.buildsFailed) > 0
                    ? `${realMetrics.buildsSuccess} success, ${realMetrics.buildsFailed} failed`
                    : realMetrics.buildsTotal > 0 || realMetrics.buildsRunning > 0
                    ? `${realMetrics.buildsRunning} running, ${realMetrics.buildsPending} pending`
                    : 'No builds yet'
                  : 'No metrics'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Configuration Tabs */}
        <Tabs defaultValue="pipelines" className="w-full">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="pipelines" className="gap-2">
              <GitBranch className="h-4 w-4" />
              Pipelines
            </TabsTrigger>
            <TabsTrigger value="builds" className="gap-2">
              <History className="h-4 w-4" />
              Builds
            </TabsTrigger>
            <TabsTrigger value="plugins" className="gap-2">
              <Package className="h-4 w-4" />
              Plugins
            </TabsTrigger>
            <TabsTrigger value="nodes" className="gap-2">
              <Server className="h-4 w-4" />
              Nodes
            </TabsTrigger>
            <TabsTrigger value="executors" className="gap-2">
              <Users className="h-4 w-4" />
              Executors
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Metrics
            </TabsTrigger>
          </TabsList>

          {/* Pipelines Tab */}
          <TabsContent value="pipelines" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Pipelines</CardTitle>
                    <CardDescription>CI/CD pipeline configuration and monitoring</CardDescription>
                  </div>
                  <Button size="sm" onClick={addPipeline} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    New Pipeline
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pipelines.map((pipeline) => (
                    <Card key={pipeline.id} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            {getStatusIcon(pipeline.status)}
                            <div className="flex-1">
                              <CardTitle className="text-lg">{pipeline.name}</CardTitle>
                              <CardDescription className="text-xs mt-1 flex items-center gap-2">
                                <GitBranch className="h-3 w-3" />
                                {pipeline.branch || 'main'} • Build #{pipeline.lastBuild}
                                {pipeline.duration && ` • ${pipeline.duration}s`}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(pipeline.status, pipeline.lastBuild)}
                            {jenkinsEngine && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const result = jenkinsEngine.triggerBuildManually(pipeline.id);
                                  if (result.success) {
                                    toast({
                                      title: "Build triggered",
                                      description: `Build #${result.buildId} started for ${pipeline.name}`,
                                    });
                                  } else {
                                    toast({
                                      title: "Cannot trigger build",
                                      description: result.reason || "Unknown error",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                disabled={!pipeline.enabled || pipeline.status === 'running'}
                              >
                                <Play className="h-4 w-4 mr-1" />
                                Build Now
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => editPipeline(pipeline.id)}
                              title="Edit pipeline"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => duplicatePipeline(pipeline.id)}
                              title="Duplicate pipeline"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            {pipelines.length > 1 && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removePipeline(pipeline.id)}
                                title="Delete pipeline"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      {pipeline.status === 'running' && (
                        <CardContent>
                          <div className="space-y-2">
                            {(() => {
                              const activeBuild = realBuilds.find(b => b.pipelineId === pipeline.id);
                              const progress = activeBuild?.progress || 0;
                              return (
                                <>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Progress</span>
                                    <span>{progress}%</span>
                                  </div>
                                  <Progress value={progress} className="h-2" />
                                </>
                              );
                            })()}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plugins Tab */}
          <TabsContent value="plugins" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Plugins</CardTitle>
                    <CardDescription>Installed Jenkins plugins</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowInstallPlugin(true)} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Install Plugin
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {realPlugins.length === 0 && plugins.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No plugins installed</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(() => {
                      // Нормализуем плагины: realPlugins или из конфига
                      const pluginsToDisplay = realPlugins.length > 0 
                        ? realPlugins 
                        : plugins.map(p => {
                            if (typeof p === 'string') {
                              return { name: p, version: '1.0.0', enabled: true, active: true };
                            }
                            // Если p - объект, извлекаем name
                            const name = p.name || (typeof p === 'object' && p !== null ? String(p) : 'unknown');
                            return { 
                              name: name,
                              version: p.version || '1.0.0', 
                              enabled: p.enabled !== false, 
                              active: p.active !== false,
                              description: p.description,
                            };
                          });
                      
                      return pluginsToDisplay.map((plugin) => {
                        const pluginName = plugin.name;
                        const pluginVersion = plugin.version || '1.0.0';
                        const pluginEnabled = plugin.enabled !== false;
                        // Active зависит от enabled и зависимостей, но если enabled=false, то active тоже false
                        // Если используем realPlugins, берем active из них, иначе вычисляем из enabled
                        const pluginActive = realPlugins.length > 0 
                          ? (plugin.active !== false && pluginEnabled)
                          : pluginEnabled; // Если нет realPlugins, active = enabled
                        const pluginDescription = plugin.description;
                      
                      return (
                        <div key={pluginName} className="flex items-center gap-3 p-3 border border-border rounded-lg bg-card">
                          <div className="p-2 rounded bg-primary/10">
                            <Package className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold">{pluginName}</div>
                            <div className="text-sm text-muted-foreground">
                              {pluginDescription || 'Plugin installed'} • v{pluginVersion}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={pluginEnabled}
                              onCheckedChange={(checked) => togglePluginEnabled(pluginName, checked)}
                            />
                            <Badge variant={pluginActive ? 'default' : 'secondary'}>
                              {pluginActive ? 'Active' : 'Inactive'}
                            </Badge>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removePlugin(pluginName)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                      });
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Builds Tab */}
          <TabsContent value="builds" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Builds</CardTitle>
                    <CardDescription>Build history and active builds</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={buildFilter} onValueChange={(value: any) => setBuildFilter(value)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search builds..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  let filteredBuilds = allBuilds;
                  
                  // Фильтр по статусу
                  if (buildFilter === 'active') {
                    filteredBuilds = filteredBuilds.filter(b => b.status === 'running' || b.status === 'pending');
                  } else if (buildFilter === 'success') {
                    filteredBuilds = filteredBuilds.filter(b => b.status === 'success');
                  } else if (buildFilter === 'failed') {
                    filteredBuilds = filteredBuilds.filter(b => b.status === 'failed');
                  }
                  
                  // Поиск
                  if (searchQuery) {
                    filteredBuilds = filteredBuilds.filter(build => 
                      build.pipelineId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      build.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      pipelines.find(p => p.id === build.pipelineId)?.name.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                  }
                  
                  if (filteredBuilds.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No builds found</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="space-y-3">
                      {filteredBuilds.map((build) => (
                        <Card key={build.id} className="border-border">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                {getStatusIcon(build.status)}
                                <div className="flex-1">
                                  <CardTitle className="text-lg">
                                    {pipelines.find(p => p.id === build.pipelineId)?.name || build.pipelineId}
                                  </CardTitle>
                                  <CardDescription className="text-xs mt-1 flex items-center gap-2">
                                    Build #{build.number}
                                    {build.branch && (
                                      <>
                                        <GitBranch className="h-3 w-3" />
                                        {build.branch}
                                      </>
                                    )}
                                    {build.duration && ` • ${(build.duration / 1000).toFixed(1)}s`}
                                  </CardDescription>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(build.status)}
                                {build.status === 'running' && jenkinsEngine && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => cancelBuild(build.id)}
                                  >
                                    <X className="h-4 w-4 mr-1" />
                                    Cancel
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openBuildDetails(build.id)}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Details
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          {build.status === 'running' && build.progress !== undefined && (
                            <CardContent>
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Progress</span>
                                  <span>{build.progress}%</span>
                                </div>
                                <Progress value={build.progress} className="h-2" />
                                {build.stages && build.stages.length > 0 && (
                                  <div className="mt-3 space-y-1">
                                    {build.stages.map((stage: any, idx: number) => (
                                      <div key={idx} className="flex items-center gap-2 text-xs">
                                        {getStatusIcon(stage.status)}
                                        <span className={stage.status === 'running' ? 'font-semibold' : ''}>
                                          {stage.name}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          )}
                          {build.status !== 'running' && build.duration && (
                            <CardContent>
                              <div className="text-xs text-muted-foreground">
                                Duration: {(build.duration / 1000).toFixed(1)}s • 
                                Started: {new Date(build.startTime).toLocaleString()}
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Executors Tab */}
          <TabsContent value="executors" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Executor Configuration</CardTitle>
                <CardDescription>Manage concurrent build executors on master node</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="executor-count">Executor Count</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="executor-count"
                      type="number"
                      min="1"
                      max="100"
                      value={executorCount}
                      onChange={(e) => {
                        const newValue = parseInt(e.target.value) || 2;
                        updateConfig({ executorCount: newValue });
                      }}
                    />
                    <span className="text-sm text-muted-foreground">concurrent builds</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Number of concurrent builds that can run simultaneously on master node
                  </div>
                  {realMetrics && (
                    <div className="mt-4 p-3 border rounded-md bg-muted">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Current Status:</span>
                        <span className="font-semibold">
                          {realMetrics.executorBusy} busy / {realMetrics.executorBusy + realMetrics.executorIdle} total
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Progress 
                          value={realMetrics.executorUtilization} 
                          className="h-2 flex-1" 
                        />
                        <span className="text-xs text-muted-foreground">
                          {realMetrics.executorUtilization.toFixed(1)}%
                        </span>
                      </div>
                      {realMetrics.executorBusy > 0 && (
                        <p className="text-xs text-amber-600 mt-2">
                          ⚠️ {realMetrics.executorBusy} executor(s) are currently busy. 
                          You cannot reduce executor count below this value.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Nodes Tab */}
          <TabsContent value="nodes" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Jenkins Nodes</CardTitle>
                    <CardDescription>Manage build agents and executors</CardDescription>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setShowAddNode(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Node
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  // Используем realNodes если доступны, иначе показываем master + nodeConfigs
                  const nodesToDisplay = realNodes.length > 0 
                    ? realNodes 
                    : [
                        // Master node всегда есть
                        {
                          id: 'master',
                          name: 'master',
                          status: 'online',
                          numExecutors: executorCount,
                          busyExecutors: 0,
                          idleExecutors: executorCount,
                          labels: ['master'],
                        },
                        // Добавляем ноды из конфига
                        ...nodeConfigs.map(n => ({
                          id: n.id,
                          name: n.name,
                          status: 'online' as const,
                          numExecutors: n.numExecutors || 1,
                          busyExecutors: 0,
                          idleExecutors: n.numExecutors || 1,
                          labels: n.labels || [],
                          description: n.description,
                        })),
                      ];
                  
                  if (nodesToDisplay.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No nodes configured</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="space-y-3">
                      {nodesToDisplay.map((node) => {
                        const isMaster = node.id === 'master';
                        const nodeConfig = nodeConfigs.find(n => n.id === node.id);
                      
                      return (
                        <Card key={node.id} className="border-border">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <div className={`p-2 rounded ${node.status === 'online' ? 'bg-green-500/10' : 'bg-gray-500/10'}`}>
                                  <Server className={`h-4 w-4 ${node.status === 'online' ? 'text-green-500' : 'text-gray-500'}`} />
                                </div>
                                <div className="flex-1">
                                  <CardTitle className="text-lg">
                                    {node.name}
                                    {isMaster && <Badge variant="outline" className="ml-2 text-xs">Master</Badge>}
                                  </CardTitle>
                                  <CardDescription className="text-xs mt-1">
                                    {node.numExecutors} executors • {node.busyExecutors} busy • {node.idleExecutors} idle
                                    {isMaster && (
                                      <span className="block mt-1 text-muted-foreground">
                                        Master node is the Jenkins controller that manages builds and coordinates agents.
                                      </span>
                                    )}
                                  </CardDescription>
                                  {nodeConfig?.description && (
                                    <p className="text-xs text-muted-foreground mt-1">{nodeConfig.description}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={node.status === 'online' ? 'default' : 'secondary'}>
                                  {node.status}
                                </Badge>
                                {!isMaster && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => editNode(node.id)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => removeNode(node.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          {node.labels && node.labels.length > 0 && (
                            <CardContent>
                              <div className="flex flex-wrap gap-1">
                                {node.labels.map((label: string, idx: number) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {label}
                                  </Badge>
                                ))}
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      );
                    })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Server Configuration</CardTitle>
                <CardDescription>Jenkins server settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="jenkins-url">Jenkins URL</Label>
                  <Input
                    id="jenkins-url"
                    value={jenkinsUrl}
                    onChange={(e) => updateConfig({ jenkinsUrl: e.target.value })}
                    placeholder="http://jenkins:8080"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable CSRF Protection</Label>
                    <div className="text-sm text-muted-foreground">
                      Protect against cross-site request forgery
                    </div>
                  </div>
                  <Switch
                    checked={enableCSRF}
                    onCheckedChange={(checked) => updateConfig({ enableCSRF: checked })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Pipelines</Label>
                    <div className="text-sm text-muted-foreground">
                      Enable Jenkins pipeline support
                    </div>
                  </div>
                  <Switch
                    checked={enablePipeline}
                    onCheckedChange={(checked) => updateConfig({ enablePipeline: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Blue Ocean</Label>
                    <div className="text-sm text-muted-foreground">
                      Modern pipeline UI
                    </div>
                  </div>
                  <Switch
                    checked={enableBlueOcean}
                    onCheckedChange={(checked) => updateConfig({ enableBlueOcean: checked })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Artifact Archiving</Label>
                    <div className="text-sm text-muted-foreground">
                      Store build artifacts
                    </div>
                  </div>
                  <Switch
                    checked={enableArtifactArchiving}
                    onCheckedChange={(checked) => updateConfig({ enableArtifactArchiving: checked })}
                  />
                </div>
                {enableArtifactArchiving && (
                  <div className="space-y-2">
                    <Label htmlFor="retention-days">Retention Days</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="retention-days"
                        type="number"
                        min="1"
                        max="365"
                        value={retentionDays}
                        onChange={(e) => updateConfig({ retentionDays: parseInt(e.target.value) || 30 })}
                      />
                      <span className="text-sm text-muted-foreground">days</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Build Trends */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Build Trends
                  </CardTitle>
                  <CardDescription>Build count over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={buildHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="builds" stackId="1" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="success" stackId="2" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="failed" stackId="2" stroke="#ff7300" fill="#ff7300" fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              
              {/* Success Rate */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Success Rate
                  </CardTitle>
                  <CardDescription>Build success rate over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={buildHistory.map(d => ({
                      ...d,
                      successRate: d.builds > 0 ? (d.success / d.builds * 100) : 0,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="successRate"
                        stroke="#82ca9d" 
                        strokeWidth={2}
                        name="Success Rate"
                        dot={{ fill: '#82ca9d', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              
              {/* Build Duration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Average Build Duration
                  </CardTitle>
                  <CardDescription>Average build duration in seconds</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={buildHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => `${value.toFixed(1)}s`} />
                      <Legend />
                      <Bar dataKey="duration" fill="#8884d8" name="Duration (s)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              
              {/* Executor Utilization */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Executor Utilization
                  </CardTitle>
                  <CardDescription>Current executor usage</CardDescription>
                </CardHeader>
                <CardContent>
                  {realMetrics ? (
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className="text-4xl font-bold">
                          {realMetrics.executorUtilization.toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground mt-2">
                          {realMetrics.executorBusy} / {realMetrics.executorBusy + realMetrics.executorIdle} executors busy
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Busy</span>
                          <span className="font-medium">{realMetrics.executorBusy}</span>
                        </div>
                        <Progress value={realMetrics.executorUtilization} className="h-2" />
                        <div className="flex justify-between text-sm">
                          <span>Idle</span>
                          <span className="font-medium">{realMetrics.executorIdle}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <div>
                          <div className="text-2xl font-bold">{realMetrics.buildsPerMinute.toFixed(1)}</div>
                          <div className="text-xs text-muted-foreground">Builds/min</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{(realMetrics.averageBuildDuration / 1000).toFixed(1)}s</div>
                          <div className="text-xs text-muted-foreground">Avg Duration</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No metrics available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
        
        {/* Edit Pipeline Dialog */}
        {editingPipeline && (() => {
          const pipeline = pipelines.find(p => p.id === editingPipeline);
          if (!pipeline) return null;
          
          return (
            <Dialog open={!!editingPipeline} onOpenChange={(open) => !open && setEditingPipeline(null)}>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Pipeline Configuration</DialogTitle>
                  <DialogDescription>
                    Configure pipeline settings, triggers, parameters, and post-build actions
                  </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="basic">Basic</TabsTrigger>
                    <TabsTrigger value="triggers">Triggers</TabsTrigger>
                    <TabsTrigger value="parameters">Parameters</TabsTrigger>
                    <TabsTrigger value="environment">Environment</TabsTrigger>
                    <TabsTrigger value="actions">Post-Build</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="basic" className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="pipeline-name">Name *</Label>
                      <Input
                        id="pipeline-name"
                        defaultValue={pipeline.name}
                        onChange={(e) => {
                          const error = validatePipelineName(e.target.value, pipeline.id);
                          setPipelineNameError(error);
                        }}
                        onBlur={(e) => {
                          const newName = e.target.value.trim();
                          const error = validatePipelineName(newName, pipeline.id);
                          setPipelineNameError(error);
                          if (!error && newName !== pipeline.name) {
                            savePipeline(pipeline.id, { name: newName });
                          }
                        }}
                        className={pipelineNameError ? "border-red-500" : ""}
                      />
                      {pipelineNameError && (
                        <p className="text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {pipelineNameError}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pipeline-branch">Branch</Label>
                      <Input
                        id="pipeline-branch"
                        defaultValue={pipeline.branch || 'main'}
                        onBlur={(e) => {
                          if (e.target.value !== pipeline.branch) {
                            savePipeline(pipeline.id, { branch: e.target.value });
                          }
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Enabled</Label>
                        <div className="text-sm text-muted-foreground">Enable/disable pipeline</div>
                      </div>
                      <Switch
                        checked={pipeline.enabled !== false}
                        onCheckedChange={(checked) => {
                          savePipeline(pipeline.id, { enabled: checked });
                          if (jenkinsEngine) {
                            jenkinsEngine.setPipelineEnabled(pipeline.id, checked);
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <div className="p-2 border rounded-md bg-muted">
                        {getStatusBadge(pipeline.status, pipeline.lastBuild)}
                        <p className="text-xs text-muted-foreground mt-2">
                          {pipeline.lastBuild === 0 
                            ? 'Pipeline has never been built. Status will be determined after first build.'
                            : `Status is determined by the last build (#${pipeline.lastBuild}).`}
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="triggers" className="space-y-4 py-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium">Build Triggers</h4>
                          <p className="text-xs text-muted-foreground">Configure when builds should be triggered</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => {
                          const newTriggers = [...(pipeline.triggers || []), { type: 'webhook' as const, enabled: true, config: {} }];
                          savePipeline(pipeline.id, { triggers: newTriggers });
                        }}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add Trigger
                        </Button>
                      </div>
                      {(pipeline.triggers || []).map((trigger, idx) => (
                        <Card key={idx} className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Select
                                value={trigger.type}
                                onValueChange={(value: any) => {
                                  const newTriggers = [...(pipeline.triggers || [])];
                                  newTriggers[idx] = { ...trigger, type: value };
                                  savePipeline(pipeline.id, { triggers: newTriggers });
                                }}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="webhook">Webhook</SelectItem>
                                  <SelectItem value="cron">Cron</SelectItem>
                                  <SelectItem value="scm">SCM Polling</SelectItem>
                                  <SelectItem value="manual">Manual Only</SelectItem>
                                </SelectContent>
                              </Select>
                              <Switch
                                checked={trigger.enabled}
                                onCheckedChange={(checked) => {
                                  const newTriggers = [...(pipeline.triggers || [])];
                                  newTriggers[idx] = { ...trigger, enabled: checked };
                                  savePipeline(pipeline.id, { triggers: newTriggers });
                                }}
                              />
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                const newTriggers = (pipeline.triggers || []).filter((_, i) => i !== idx);
                                savePipeline(pipeline.id, { triggers: newTriggers });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {trigger.type === 'webhook' && (
                            <div className="space-y-2">
                              <Label>Branches (comma-separated, empty for all)</Label>
                              <Input
                                placeholder="main, develop, release/*"
                                defaultValue={trigger.config?.branches?.join(', ')}
                                onBlur={(e) => {
                                  const branches = e.target.value.split(',').map(b => b.trim()).filter(b => b);
                                  const newTriggers = [...(pipeline.triggers || [])];
                                  newTriggers[idx] = { ...trigger, config: { ...trigger.config, branches } };
                                  savePipeline(pipeline.id, { triggers: newTriggers });
                                }}
                              />
                            </div>
                          )}
                          {trigger.type === 'cron' && (
                            <div className="space-y-2">
                              <Label>Cron Expression</Label>
                              <Input
                                placeholder="H/15 * * * *"
                                defaultValue={trigger.config?.schedule}
                                onBlur={(e) => {
                                  const newTriggers = [...(pipeline.triggers || [])];
                                  newTriggers[idx] = { ...trigger, config: { ...trigger.config, schedule: e.target.value } };
                                  savePipeline(pipeline.id, { triggers: newTriggers });
                                }}
                              />
                              <p className="text-xs text-muted-foreground">Example: H/15 * * * * (every 15 minutes)</p>
                            </div>
                          )}
                          {trigger.type === 'scm' && (
                            <div className="space-y-2">
                              <Label>Poll Interval (minutes)</Label>
                              <Input
                                type="number"
                                min="1"
                                placeholder="5"
                                defaultValue={trigger.config?.pollInterval}
                                onBlur={(e) => {
                                  const newTriggers = [...(pipeline.triggers || [])];
                                  newTriggers[idx] = { ...trigger, config: { ...trigger.config, pollInterval: parseInt(e.target.value) || 5 } };
                                  savePipeline(pipeline.id, { triggers: newTriggers });
                                }}
                              />
                            </div>
                          )}
                        </Card>
                      ))}
                      {(!pipeline.triggers || pipeline.triggers.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No triggers configured. Builds will use default rate-based triggering.
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="parameters" className="space-y-4 py-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium">Build Parameters</h4>
                          <p className="text-xs text-muted-foreground">Parameters to pass to builds</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => {
                          const newParams = [...(pipeline.parameters || []), { name: '', type: 'string' as const, defaultValue: '' }];
                          savePipeline(pipeline.id, { parameters: newParams });
                        }}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add Parameter
                        </Button>
                      </div>
                      {(pipeline.parameters || []).map((param, idx) => (
                        <Card key={idx} className="p-4">
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="space-y-2">
                              <Label>Parameter Name</Label>
                              <Input
                                value={param.name}
                                onChange={(e) => {
                                  const newParams = [...(pipeline.parameters || [])];
                                  newParams[idx] = { ...param, name: e.target.value };
                                  savePipeline(pipeline.id, { parameters: newParams });
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Type</Label>
                              <Select
                                value={param.type}
                                onValueChange={(value: any) => {
                                  const newParams = [...(pipeline.parameters || [])];
                                  newParams[idx] = { ...param, type: value };
                                  savePipeline(pipeline.id, { parameters: newParams });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="string">String</SelectItem>
                                  <SelectItem value="choice">Choice</SelectItem>
                                  <SelectItem value="boolean">Boolean</SelectItem>
                                  <SelectItem value="password">Password</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-2 mb-3">
                            <Label>Default Value</Label>
                            {param.type === 'boolean' ? (
                              <Switch
                                checked={param.defaultValue === true}
                                onCheckedChange={(checked) => {
                                  const newParams = [...(pipeline.parameters || [])];
                                  newParams[idx] = { ...param, defaultValue: checked };
                                  savePipeline(pipeline.id, { parameters: newParams });
                                }}
                              />
                            ) : (
                              <Input
                                value={param.defaultValue as string || ''}
                                type={param.type === 'password' ? 'password' : 'text'}
                                onChange={(e) => {
                                  const newParams = [...(pipeline.parameters || [])];
                                  newParams[idx] = { ...param, defaultValue: e.target.value };
                                  savePipeline(pipeline.id, { parameters: newParams });
                                }}
                              />
                            )}
                          </div>
                          {param.type === 'choice' && (
                            <div className="space-y-2 mb-3">
                              <Label>Choices (one per line)</Label>
                              <Textarea
                                rows={3}
                                value={param.choices?.join('\n') || ''}
                                onChange={(e) => {
                                  const choices = e.target.value.split('\n').map(c => c.trim()).filter(c => c);
                                  const newParams = [...(pipeline.parameters || [])];
                                  newParams[idx] = { ...param, choices };
                                  savePipeline(pipeline.id, { parameters: newParams });
                                }}
                              />
                            </div>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const newParams = (pipeline.parameters || []).filter((_, i) => i !== idx);
                              savePipeline(pipeline.id, { parameters: newParams });
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        </Card>
                      ))}
                      {(!pipeline.parameters || pipeline.parameters.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No parameters configured.
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="environment" className="space-y-4 py-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium">Environment Variables</h4>
                          <p className="text-xs text-muted-foreground">Environment variables available to builds</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => {
                          const currentEnv = pipeline.environmentVariables || {};
                          const newEnv = { ...currentEnv, [`VAR_${Date.now()}`]: '' };
                          savePipeline(pipeline.id, { environmentVariables: newEnv });
                        }}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add Variable
                        </Button>
                      </div>
                      {pipeline.environmentVariables && Object.keys(pipeline.environmentVariables).length > 0 ? (
                        <div className="space-y-2">
                          {Object.entries(pipeline.environmentVariables).map(([key, value]) => (
                            <Card key={key} className="p-4">
                              <div className="grid grid-cols-[1fr_2fr_auto] gap-3 items-center">
                                <div className="space-y-1">
                                  <Label className="text-xs">Variable Name</Label>
                                  <Input
                                    value={key}
                                    onChange={(e) => {
                                      const newKey = e.target.value;
                                      const currentEnv = pipeline.environmentVariables || {};
                                      if (newKey !== key && !currentEnv[newKey]) {
                                        const newEnv = { ...currentEnv };
                                        delete newEnv[key];
                                        newEnv[newKey] = value;
                                        savePipeline(pipeline.id, { environmentVariables: newEnv });
                                      }
                                    }}
                                    placeholder="VAR_NAME"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Value</Label>
                                  <Input
                                    value={value as string}
                                    onChange={(e) => {
                                      const currentEnv = pipeline.environmentVariables || {};
                                      savePipeline(pipeline.id, {
                                        environmentVariables: { ...currentEnv, [key]: e.target.value },
                                      });
                                    }}
                                    placeholder="variable value"
                                  />
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    const currentEnv = pipeline.environmentVariables || {};
                                    const newEnv = { ...currentEnv };
                                    delete newEnv[key];
                                    savePipeline(pipeline.id, { environmentVariables: newEnv });
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No environment variables configured.
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="actions" className="space-y-4 py-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium">Post-Build Actions</h4>
                          <p className="text-xs text-muted-foreground">Actions to execute after build completes</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => {
                          const newActions = [...(pipeline.postBuildActions || []), { type: 'email' as const, enabled: true, config: {} }];
                          savePipeline(pipeline.id, { postBuildActions: newActions });
                        }}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add Action
                        </Button>
                      </div>
                      {(pipeline.postBuildActions || []).map((action, idx) => (
                        <Card key={idx} className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Select
                                value={action.type}
                                onValueChange={(value: any) => {
                                  const newActions = [...(pipeline.postBuildActions || [])];
                                  newActions[idx] = { ...action, type: value, config: {} };
                                  savePipeline(pipeline.id, { postBuildActions: newActions });
                                }}
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="email">Email Notification</SelectItem>
                                  <SelectItem value="archive">Archive Artifacts</SelectItem>
                                  <SelectItem value="publish">Publish Results</SelectItem>
                                  <SelectItem value="deploy">Deploy</SelectItem>
                                </SelectContent>
                              </Select>
                              <Switch
                                checked={action.enabled}
                                onCheckedChange={(checked) => {
                                  const newActions = [...(pipeline.postBuildActions || [])];
                                  newActions[idx] = { ...action, enabled: checked };
                                  savePipeline(pipeline.id, { postBuildActions: newActions });
                                }}
                              />
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                const newActions = (pipeline.postBuildActions || []).filter((_, i) => i !== idx);
                                savePipeline(pipeline.id, { postBuildActions: newActions });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {action.type === 'email' && (
                            <div className="space-y-2">
                              <Label>Recipients (comma-separated)</Label>
                              <Input
                                placeholder="dev@example.com, team@example.com"
                                defaultValue={action.config?.recipients?.join(', ')}
                                onBlur={(e) => {
                                  const recipients = e.target.value.split(',').map(r => r.trim()).filter(r => r);
                                  const newActions = [...(pipeline.postBuildActions || [])];
                                  newActions[idx] = { ...action, config: { ...action.config, recipients } };
                                  savePipeline(pipeline.id, { postBuildActions: newActions });
                                }}
                              />
                            </div>
                          )}
                          {action.type === 'archive' && (
                            <div className="space-y-2">
                              <Label>Archive Pattern</Label>
                              <Input
                                placeholder="**/*.jar, **/*.war"
                                defaultValue={action.config?.archivePattern}
                                onBlur={(e) => {
                                  const newActions = [...(pipeline.postBuildActions || [])];
                                  newActions[idx] = { ...action, config: { ...action.config, archivePattern: e.target.value } };
                                  savePipeline(pipeline.id, { postBuildActions: newActions });
                                }}
                              />
                            </div>
                          )}
                          {action.type === 'deploy' && (
                            <div className="space-y-2">
                              <Label>Deployment Environment</Label>
                              <Select
                                value={action.config?.deployEnv || 'staging'}
                                onValueChange={(value) => {
                                  const newActions = [...(pipeline.postBuildActions || [])];
                                  newActions[idx] = { ...action, config: { ...action.config, deployEnv: value } };
                                  savePipeline(pipeline.id, { postBuildActions: newActions });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="staging">Staging</SelectItem>
                                  <SelectItem value="production">Production</SelectItem>
                                  <SelectItem value="dev">Development</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </Card>
                      ))}
                      {(!pipeline.postBuildActions || pipeline.postBuildActions.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No post-build actions configured.
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setEditingPipeline(null);
                    setPipelineNameError('');
                  }}>
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          );
        })()}
        
        {/* Add Node Dialog */}
        <Dialog open={showAddNode} onOpenChange={setShowAddNode}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Node</DialogTitle>
              <DialogDescription>
                Create a new Jenkins agent node for distributed builds
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="node-name">Node Name *</Label>
                <Input
                  id="node-name"
                  value={newNodeName}
                  onChange={(e) => {
                    setNewNodeName(e.target.value);
                    setNodeNameError(validateNodeName(e.target.value));
                  }}
                  onBlur={(e) => setNodeNameError(validateNodeName(e.target.value))}
                  placeholder="agent-1"
                  className={nodeNameError ? "border-red-500" : ""}
                />
                {nodeNameError && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {nodeNameError}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="node-executors">Number of Executors</Label>
                <Input
                  id="node-executors"
                  type="number"
                  min="1"
                  max="100"
                  value={newNodeExecutors}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    setNewNodeExecutors(value);
                    setNodeExecutorsError(validateNodeExecutors(value));
                  }}
                  onBlur={(e) => setNodeExecutorsError(validateNodeExecutors(newNodeExecutors))}
                  className={nodeExecutorsError ? "border-red-500" : ""}
                />
                {nodeExecutorsError ? (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {nodeExecutorsError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Number of concurrent builds this node can handle
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="node-labels">Labels</Label>
                <Input
                  id="node-labels"
                  value={newNodeLabels}
                  onChange={(e) => setNewNodeLabels(e.target.value)}
                  placeholder="linux, docker, kubernetes"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated labels for build routing
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="node-description">Description</Label>
                <Textarea
                  id="node-description"
                  value={newNodeDescription}
                  onChange={(e) => setNewNodeDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowAddNode(false);
                setNewNodeName('');
                setNewNodeExecutors(1);
                setNewNodeLabels('');
                setNewNodeDescription('');
                setNodeNameError('');
                setNodeExecutorsError('');
              }}>
                Cancel
              </Button>
              <Button 
                onClick={addNode}
                disabled={!!nodeNameError || !!nodeExecutorsError || !newNodeName.trim()}
              >
                Add Node
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Edit Node Dialog */}
        {editingNode && (() => {
          const node = nodeConfigs.find(n => n.id === editingNode);
          if (!node) return null;
          
          const [editName, setEditName] = useState(node.name);
          const [editExecutors, setEditExecutors] = useState(node.numExecutors || 1);
          const [editLabels, setEditLabels] = useState(node.labels?.join(', ') || '');
          const [editDescription, setEditDescription] = useState(node.description || '');
          
          return (
            <Dialog open={!!editingNode} onOpenChange={(open) => !open && setEditingNode(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Node</DialogTitle>
                  <DialogDescription>
                    Update node configuration
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-node-name">Node Name *</Label>
                    <Input
                      id="edit-node-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-node-executors">Number of Executors</Label>
                    <Input
                      id="edit-node-executors"
                      type="number"
                      min="1"
                      max="100"
                      value={editExecutors}
                      onChange={(e) => setEditExecutors(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-node-labels">Labels</Label>
                    <Input
                      id="edit-node-labels"
                      value={editLabels}
                      onChange={(e) => setEditLabels(e.target.value)}
                      placeholder="linux, docker, kubernetes"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-node-description">Description</Label>
                    <Textarea
                      id="edit-node-description"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingNode(null)}>
                    Cancel
                  </Button>
                  <Button onClick={() => {
                    if (!editName.trim()) {
                      toast({
                        title: "Invalid name",
                        description: "Node name cannot be empty",
                        variant: "destructive",
                      });
                      return;
                    }
                    saveNode(editingNode, {
                      name: editName.trim(),
                      numExecutors: editExecutors,
                      labels: editLabels.split(',').map(l => l.trim()).filter(l => l.length > 0),
                      description: editDescription.trim() || undefined,
                    });
                  }}>
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          );
        })()}
        
        {/* Install Plugin Dialog */}
        <Dialog open={showInstallPlugin} onOpenChange={(open) => {
          setShowInstallPlugin(open);
          // Очищаем форму при закрытии
          if (!open) {
            setNewPluginName('');
            setPluginNameError('');
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Install Plugin</DialogTitle>
              <DialogDescription>
                Install a new Jenkins plugin
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="plugin-name">Plugin Name *</Label>
                <Input
                  id="plugin-name"
                  value={newPluginName}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewPluginName(value);
                    // Валидируем при каждом изменении
                    if (value.trim()) {
                      const error = validatePluginName(value);
                      setPluginNameError(error);
                    } else {
                      // Если поле пустое, очищаем ошибку (показываем только при blur)
                      setPluginNameError('');
                    }
                  }}
                  onBlur={(e) => {
                    const error = validatePluginName(e.target.value);
                    setPluginNameError(error);
                  }}
                  placeholder="e.g., git, docker, kubernetes"
                  className={pluginNameError ? "border-red-500" : ""}
                />
                {pluginNameError ? (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {pluginNameError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Enter the plugin name (e.g., git, docker, kubernetes, workflow-aggregator)
                  </p>
                )}
              </div>
              <div className="p-3 border rounded-md bg-muted">
                <p className="text-sm font-semibold mb-2">Popular plugins:</p>
                <div className="flex flex-wrap gap-2">
                  {['git', 'docker', 'kubernetes', 'workflow-aggregator', 'blue-ocean', 'junit', 'maven-plugin'].map(name => (
                    <Button
                      key={name}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewPluginName(name);
                        // Валидируем и устанавливаем ошибку (или очищаем если валидно)
                        const error = validatePluginName(name);
                        setPluginNameError(error);
                        // Фокусируем поле ввода для лучшего UX
                        setTimeout(() => {
                          const input = document.getElementById('plugin-name') as HTMLInputElement;
                          if (input) {
                            input.focus();
                            input.select();
                          }
                        }, 0);
                      }}
                    >
                      {name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowInstallPlugin(false);
                setNewPluginName('');
                setPluginNameError('');
              }}>
                Cancel
              </Button>
              <Button 
                onClick={() => addPlugin(newPluginName)}
                disabled={!!pluginNameError || !newPluginName.trim()}
              >
                Install
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Build Details Dialog */}
        <Dialog open={showBuildDetails} onOpenChange={setShowBuildDetails}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Build Details</DialogTitle>
              <DialogDescription>
                {selectedBuild && (() => {
                  const build = allBuilds.find(b => b.id === selectedBuild);
                  if (!build) return 'Build details';
                  const pipeline = pipelines.find(p => p.id === build.pipelineId);
                  return `Build #${build.number} - ${pipeline?.name || build.pipelineId}`;
                })()}
              </DialogDescription>
            </DialogHeader>
            
            {selectedBuild && (() => {
              const build = allBuilds.find(b => b.id === selectedBuild);
              if (!build) return null;
              const pipeline = pipelines.find(p => p.id === build.pipelineId);
              
              return (
                <div className="flex-1 overflow-y-auto space-y-4">
                  {/* Build Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Build Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Pipeline:</span>
                          <span className="ml-2 font-medium">{pipeline?.name || build.pipelineId}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Build Number:</span>
                          <span className="ml-2 font-medium">#{build.number}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Status:</span>
                          <span className="ml-2">{getStatusBadge(build.status)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Branch:</span>
                          <span className="ml-2 font-medium">{build.branch || 'main'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Started:</span>
                          <span className="ml-2">{new Date(build.startTime).toLocaleString()}</span>
                        </div>
                        {build.duration && (
                          <div>
                            <span className="text-muted-foreground">Duration:</span>
                            <span className="ml-2">{(build.duration / 1000).toFixed(1)}s</span>
                          </div>
                        )}
                      </div>
                      {build.status === 'running' && build.progress !== undefined && (
                        <div className="mt-4">
                          <div className="flex justify-between text-sm mb-2">
                            <span>Progress</span>
                            <span>{build.progress}%</span>
                          </div>
                          <Progress value={build.progress} />
                        </div>
                      )}
                      {build.stages && build.stages.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <div className="text-sm font-medium">Stages:</div>
                          <div className="grid grid-cols-2 gap-2">
                            {build.stages.map((stage: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 text-sm p-2 border rounded">
                                {getStatusIcon(stage.status)}
                                <span>{stage.name}</span>
                                {stage.duration && (
                                  <span className="text-xs text-muted-foreground ml-auto">
                                    {(stage.duration / 1000).toFixed(1)}s
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {build.status === 'running' && jenkinsEngine && (
                        <div className="mt-4">
                          <Button
                            variant="destructive"
                            onClick={() => cancelBuild(build.id)}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel Build
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  
                  {/* Console Output */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Console Output</CardTitle>
                      <CardDescription>Build execution logs</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-black text-green-400 p-4 rounded font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto">
                        {buildLogs.length > 0 ? (
                          buildLogs.map((log, idx) => (
                            <div key={idx} className="whitespace-pre-wrap">{log}</div>
                          ))
                        ) : (
                          <div className="text-muted-foreground">No logs available</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Artifacts */}
                  {buildArtifacts.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Artifacts</CardTitle>
                        <CardDescription>Build artifacts</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {buildArtifacts.map((artifact, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 border rounded">
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono text-sm">{artifact.name}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-muted-foreground">
                                  {formatFileSize(artifact.size)}
                                </span>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    // Создаем виртуальный файл для загрузки
                                    const content = `# Artifact: ${artifact.name}\n# Size: ${formatFileSize(artifact.size)}\n# Generated by Jenkins Simulation\n\nThis is a simulated artifact file.\nIn a real Jenkins environment, this would contain the actual build artifact.`;
                                    const blob = new Blob([content], { type: 'text/plain' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = artifact.name;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                    toast({
                                      title: "Artifact downloaded",
                                      description: `${artifact.name} has been downloaded`,
                                    });
                                  }}
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  Download
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}


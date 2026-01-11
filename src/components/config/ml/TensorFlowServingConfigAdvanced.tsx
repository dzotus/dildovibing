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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  Edit,
  RefreshCcw,
  Play,
  Brain,
  CheckCircle,
  XCircle,
  Zap,
  Database,
  Cpu,
  Search,
  Filter,
  X,
  AlertCircle,
  Info,
  BarChart3,
  Download,
  Upload
} from 'lucide-react';
import { 
  LineChart, Line, AreaChart, Area, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

interface TensorFlowServingConfigProps {
  componentId: string;
}

interface Model {
  name: string;
  version: string;
  status: 'serving' | 'loading' | 'unavailable' | 'error';
  platform: string;
  inputs?: Array<{ name: string; dtype: string; shape: string }>;
  outputs?: Array<{ name: string; dtype: string; shape: string }>;
  requests?: number;
  avgLatency?: number;
  totalPredictions?: number;
  successfulPredictions?: number;
  failedPredictions?: number;
}

interface Prediction {
  id: string;
  model: string;
  version: string;
  input?: string;
  output?: string;
  status: 'success' | 'error' | 'timeout';
  timestamp: string;
  latency?: number;
}

interface TensorFlowServingConfig {
  enabled?: boolean;
  endpoint?: string;
  modelBasePath?: string;
  enableBatching?: boolean;
  batchSize?: number;
  maxBatchSize?: number;
  maxBatchWaitTime?: number;
  enableGPU?: boolean;
  gpuMemoryFraction?: number;
  enableMonitoring?: boolean;
  monitoringPort?: number;
  numThreads?: number;
  interOpParallelismThreads?: number;
  intraOpParallelismThreads?: number;
  models?: Model[];
  predictions?: Prediction[];
  totalModels?: number;
  totalPredictions?: number;
  averageLatency?: number;
  errorRate?: number;
  enableErrorSimulation?: boolean;
  timeoutMs?: number;
  versioningPolicy?: 'latest' | 'specific' | 'all';
  enableABTesting?: boolean;
  abTestConfig?: Array<{
    modelName: string;
    versions: Array<{
      version: string;
      trafficPercentage: number;
    }>;
  }>;
  enablePrometheusExport?: boolean;
  prometheusPort?: number;
  enableGRPC?: boolean;
  grpcPort?: number;
}

export function TensorFlowServingConfigAdvanced({ componentId }: TensorFlowServingConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { getComponentMetrics } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  // Get TensorFlow Serving emulation engine for real-time metrics
  const tfEngine = emulationEngine.getTensorFlowServingEmulationEngine(componentId);
  const componentMetrics = getComponentMetrics(componentId);
  const customMetrics = componentMetrics?.customMetrics || {};

  const config = (node.data.config as any) || {} as TensorFlowServingConfig;
  const models = config.models || [];
  const predictions = config.predictions || [];
  const endpoint = config.endpoint || 'localhost:8501';
  
  // Get real-time metrics from emulation engine or fallback to config
  const tfMetrics = tfEngine?.getMetrics();
  const totalModels = tfMetrics?.totalModels ?? config.totalModels ?? models.length;
  const servingModels = tfMetrics?.servingModels ?? models.filter((m: Model) => m.status === 'serving').length;
  const totalPredictions = tfMetrics?.totalPredictions ?? config.totalPredictions ?? predictions.length;
  const averageLatency = tfMetrics?.averageLatency ?? config.averageLatency ?? (models.length > 0 ? models.reduce((sum: number, m: Model) => sum + (m.avgLatency || 0), 0) / models.length : 0);
  const requestsPerSecond = tfMetrics?.requestsPerSecond ?? customMetrics.requestsPerSecond ?? 0;
  const errorRate = tfMetrics?.errorRate ?? customMetrics.errorRate ?? 0;
  const batchUtilization = tfMetrics?.batchUtilization ?? customMetrics.batchUtilization ?? 0;
  const gpuUtilization = tfMetrics?.gpuUtilization ?? customMetrics.gpuUtilization ?? 0;
  const memoryUsage = tfMetrics?.memoryUsage ?? customMetrics.memoryUsage ?? 0;
  const cpuUtilization = tfMetrics?.cpuUtilization ?? customMetrics.cpuUtilization ?? 0;

  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<{ name: string; version: string } | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 10;
  
  // Metrics history for charts
  const [metricsHistory, setMetricsHistory] = useState<Array<{
    timestamp: number;
    latency: number;
    rps: number;
    errorRate: number;
    throughput: number;
    batchUtilization: number;
    gpuUtilization?: number;
    cpuUtilization: number;
  }>>([]);

  // Form state for model dialog
  const [modelForm, setModelForm] = useState<{
    name: string;
    version: string;
    platform: string;
    status: 'serving' | 'loading' | 'unavailable' | 'error';
    inputs: Array<{ name: string; dtype: string; shape: string }>;
    outputs: Array<{ name: string; dtype: string; shape: string }>;
  }>({
    name: '',
    version: '1',
    platform: 'tensorflow',
    status: 'serving',
    inputs: [],
    outputs: [],
  });

  // Sync models from emulation engine
  useEffect(() => {
    if (tfEngine) {
      const engineModels = tfEngine.getModels();
      if (engineModels.length > 0) {
        // Update config with models from engine
        const updatedModels = engineModels.map(m => ({
          name: m.name,
          version: m.version,
          status: m.status,
          platform: m.platform,
          inputs: m.inputs,
          outputs: m.outputs,
          requests: m.requests,
          avgLatency: m.avgLatency,
          totalPredictions: m.totalPredictions,
          successfulPredictions: m.successfulPredictions,
          failedPredictions: m.failedPredictions,
        }));
        updateConfig({ models: updatedModels });
      }
    }
  }, [tfEngine]);

  // Sync predictions from emulation engine
  useEffect(() => {
    if (tfEngine) {
      const recentPredictions = tfEngine.getRecentPredictions(100);
      if (recentPredictions.length > 0) {
        const updatedPredictions = recentPredictions.map(p => ({
          id: p.id,
          model: p.model,
          version: p.version,
          input: p.input,
          output: p.output,
          status: p.status,
          timestamp: new Date(p.timestamp).toISOString(),
          latency: p.latency,
        }));
        updateConfig({ predictions: updatedPredictions });
      }
    }
  }, [tfEngine]);

  // Auto-refresh metrics every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (tfEngine) {
        // Trigger sync
        tfEngine.syncModelsFromConfig();
        // Update metrics history
        const history = tfEngine.getMetricsHistory(60); // Last 60 data points
        setMetricsHistory(history);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [tfEngine]);
  
  // Format metrics history for charts
  const chartData = useMemo(() => {
    return metricsHistory.map(item => ({
      time: new Date(item.timestamp).toLocaleTimeString(),
      latency: item.latency.toFixed(1),
      rps: item.rps.toFixed(1),
      errorRate: (item.errorRate * 100).toFixed(2),
      throughput: item.throughput.toFixed(1),
      batchUtilization: (item.batchUtilization * 100).toFixed(1),
      gpuUtilization: item.gpuUtilization ? (item.gpuUtilization * 100).toFixed(1) : 0,
      cpuUtilization: (item.cpuUtilization * 100).toFixed(1),
    }));
  }, [metricsHistory]);

  const updateConfig = (updates: Partial<TensorFlowServingConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
    
    // Sync with emulation engine
    if (tfEngine) {
      tfEngine.initializeConfig(node);
      tfEngine.syncModelsFromConfig();
    }
  };

  const executePrediction = async () => {
    if (!selectedModel || !selectedVersion) {
      toast({
        title: 'Error',
        description: 'Please select a model and version',
        variant: 'destructive',
      });
      return;
    }

    try {
      const input = inputText ? JSON.parse(inputText) : { instances: [[Math.random(), Math.random(), Math.random()]] };
      
      if (tfEngine) {
        const result = await tfEngine.processPrediction(selectedModel, selectedVersion, input);
        if (result.success) {
          setOutputText(JSON.stringify(result.output, null, 2));
          toast({
            title: 'Success',
            description: `Prediction completed in ${result.latency}ms`,
          });
        } else {
          setOutputText('');
          toast({
            title: 'Error',
            description: result.error || 'Prediction failed',
            variant: 'destructive',
          });
        }
      } else {
        // Fallback simulation
        const newPrediction: Prediction = {
          id: `pred-${Date.now()}`,
          model: selectedModel,
          version: selectedVersion,
          input: inputText,
          output: JSON.stringify({ predictions: [[0.8, 0.1, 0.1]] }, null, 2),
          status: 'success',
          timestamp: new Date().toISOString(),
          latency: Math.floor(Math.random() * 50) + 20,
        };
        setOutputText(newPrediction.output || '');
        updateConfig({ predictions: [...predictions, newPrediction] });
        toast({
          title: 'Success',
          description: `Prediction completed in ${newPrediction.latency}ms`,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Invalid JSON input',
        variant: 'destructive',
      });
    }
  };

  const openAddModelDialog = () => {
    setEditingModel(null);
    setModelForm({
      name: '',
      version: '1',
      platform: 'tensorflow',
      status: 'serving',
      inputs: [],
      outputs: [],
    });
    setModelDialogOpen(true);
  };

  const openEditModelDialog = (model: Model) => {
    setEditingModel(model);
    setModelForm({
      name: model.name,
      version: model.version,
      platform: model.platform,
      status: model.status,
      inputs: model.inputs || [],
      outputs: model.outputs || [],
    });
    setModelDialogOpen(true);
  };

  const handleSaveModel = () => {
    if (!modelForm.name || !modelForm.version) {
      toast({
        title: 'Error',
        description: 'Model name and version are required',
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicate
    const existingModel = models.find(
      (m: Model) => m.name === modelForm.name && m.version === modelForm.version && 
      (!editingModel || (m.name !== editingModel.name || m.version !== editingModel.version))
    );
    if (existingModel) {
      toast({
        title: 'Error',
        description: 'Model with this name and version already exists',
        variant: 'destructive',
      });
      return;
    }

    const updatedModels = editingModel
      ? models.map((m: Model) => 
          m.name === editingModel.name && m.version === editingModel.version
            ? { ...modelForm, requests: m.requests, avgLatency: m.avgLatency }
            : m
        )
      : [...models, { ...modelForm, requests: 0, avgLatency: 0 }];

    updateConfig({ models: updatedModels });
    setModelDialogOpen(false);
    toast({
      title: 'Success',
      description: editingModel ? 'Model updated' : 'Model added',
    });
  };

  const handleDeleteModel = (model: Model) => {
    setModelToDelete({ name: model.name, version: model.version });
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteModel = () => {
    if (modelToDelete) {
      const updatedModels = models.filter(
        (m: Model) => !(m.name === modelToDelete.name && m.version === modelToDelete.version)
      );
      updateConfig({ models: updatedModels });
      setDeleteConfirmOpen(false);
      setModelToDelete(null);
      toast({
        title: 'Success',
        description: 'Model deleted',
      });
    }
  };

  const handleExportModels = () => {
    try {
      const exportData = {
        models: models,
        exportDate: new Date().toISOString(),
        version: '1.0',
      };
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tensorflow-serving-models-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        title: 'Success',
        description: `Exported ${models.length} model(s)`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export models',
        variant: 'destructive',
      });
    }
  };

  const handleImportModels = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const importData = JSON.parse(content);
          
          if (!importData.models || !Array.isArray(importData.models)) {
            throw new Error('Invalid import format: models array not found');
          }
          
          // Merge with existing models (avoid duplicates)
          const existingKeys = new Set(models.map((m: Model) => `${m.name}:${m.version}`));
          const newModels = importData.models.filter((m: Model) => {
            const key = `${m.name}:${m.version}`;
            return !existingKeys.has(key);
          });
          
          if (newModels.length === 0) {
            toast({
              title: 'Info',
              description: 'No new models to import (all models already exist)',
            });
            return;
          }
          
          const updatedModels = [...models, ...newModels];
          updateConfig({ models: updatedModels });
          toast({
            title: 'Success',
            description: `Imported ${newModels.length} model(s)`,
          });
        } catch (error) {
          toast({
            title: 'Error',
            description: error instanceof Error ? error.message : 'Failed to import models',
            variant: 'destructive',
          });
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const addInputOutput = (type: 'input' | 'output') => {
    const field = {
      name: '',
      dtype: 'float32',
      shape: '[1,1]',
    };
    if (type === 'input') {
      setModelForm({ ...modelForm, inputs: [...modelForm.inputs, field] });
    } else {
      setModelForm({ ...modelForm, outputs: [...modelForm.outputs, field] });
    }
  };

  const removeInputOutput = (type: 'input' | 'output', index: number) => {
    if (type === 'input') {
      setModelForm({ ...modelForm, inputs: modelForm.inputs.filter((_, i) => i !== index) });
    } else {
      setModelForm({ ...modelForm, outputs: modelForm.outputs.filter((_, i) => i !== index) });
    }
  };

  const updateInputOutput = (type: 'input' | 'output', index: number, field: string, value: string) => {
    if (type === 'input') {
      const updated = [...modelForm.inputs];
      updated[index] = { ...updated[index], [field]: value };
      setModelForm({ ...modelForm, inputs: updated });
    } else {
      const updated = [...modelForm.outputs];
      updated[index] = { ...updated[index], [field]: value };
      setModelForm({ ...modelForm, outputs: updated });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'serving':
        return 'bg-green-500';
      case 'loading':
        return 'bg-yellow-500';
      case 'unavailable':
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Filter models
  const filteredModels = useMemo(() => {
    return models.filter((model: Model) => {
      const matchesSearch = !searchQuery || 
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.version.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || model.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [models, searchQuery, statusFilter]);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">TensorFlow Serving</p>
            <h2 className="text-2xl font-bold text-foreground">Model Serving</h2>
            <p className="text-sm text-muted-foreground mt-1">
              High-performance serving system for machine learning models
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              if (tfEngine) {
                tfEngine.syncModelsFromConfig();
                toast({
                  title: 'Refreshed',
                  description: 'Metrics updated',
                });
              }
            }}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Models</CardTitle>
                <Brain className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalModels}</span>
                <span className="text-xs text-muted-foreground">total</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {servingModels} serving
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Predictions</CardTitle>
                <Activity className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalPredictions}</span>
                <span className="text-xs text-muted-foreground">total</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {requestsPerSecond.toFixed(1)} req/s
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Latency</CardTitle>
                <Zap className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{averageLatency.toFixed(0)}</span>
                <span className="text-xs text-muted-foreground">ms</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Error: {(errorRate * 100).toFixed(1)}%
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Endpoint</CardTitle>
                <Database className="h-4 w-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 truncate">{endpoint}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Port: {endpoint.split(':')[1] || '8501'}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="test" className="space-y-4">
          <TabsList className="flex flex-wrap w-full gap-1 p-1 bg-muted rounded-lg">
            <TabsTrigger value="test" className="flex items-center gap-2 flex-1 min-w-[120px]">
              <Play className="h-4 w-4" />
              <span className="hidden sm:inline">Test Prediction</span>
              <span className="sm:hidden">Test</span>
            </TabsTrigger>
            <TabsTrigger value="models" className="flex items-center gap-2 flex-1 min-w-[120px]">
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">Models ({models.length})</span>
              <span className="sm:hidden">Models</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2 flex-1 min-w-[120px]">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">History ({predictions.length})</span>
              <span className="sm:hidden">History</span>
            </TabsTrigger>
            <TabsTrigger value="metrics" className="flex items-center gap-2 flex-1 min-w-[120px]">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Metrics</span>
              <span className="sm:hidden">Metrics</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2 flex-1 min-w-[120px]">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
              <span className="sm:hidden">Config</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="test" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Model Prediction</CardTitle>
                <CardDescription>Test model inference</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Select value={selectedModel} onValueChange={(value) => {
                      setSelectedModel(value);
                      const model = models.find((m: Model) => m.name === value);
                      if (model) {
                        setSelectedVersion(model.version);
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {models.filter((m: Model) => m.status === 'serving').map((m: Model) => (
                          <SelectItem key={m.name} value={m.name}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Version</Label>
                    <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select version" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedModel && models.find((m: Model) => m.name === selectedModel) && (
                          <SelectItem value={models.find((m: Model) => m.name === selectedModel)!.version}>
                            {models.find((m: Model) => m.name === selectedModel)!.version}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Input (JSON)</Label>
                    <Textarea
                      value={inputText}
                      onChange={(e) => {
                        setInputText(e.target.value);
                        // Real-time JSON validation
                        if (e.target.value.trim()) {
                          try {
                            JSON.parse(e.target.value);
                            // Valid JSON - no error shown
                          } catch (error) {
                            // Invalid JSON - error will be shown on execute
                          }
                        }
                      }}
                      className="font-mono text-sm min-h-[200px]"
                      placeholder='{ "instances": [[0.1, 0.2, 0.3]] }'
                    />
                    {inputText.trim() && (() => {
                      try {
                        JSON.parse(inputText);
                        return null;
                      } catch (error) {
                        return (
                          <p className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Invalid JSON format
                          </p>
                        );
                      }
                    })()}
                  </div>
                  <div className="space-y-2">
                    <Label>Output</Label>
                    <Textarea
                      value={outputText}
                      readOnly
                      className="font-mono text-sm min-h-[200px] bg-muted"
                      placeholder="Prediction result will appear here..."
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={executePrediction} disabled={!selectedModel || !selectedVersion}>
                    <Play className="h-4 w-4 mr-2" />
                    Run Prediction
                  </Button>
                  <Button variant="outline" onClick={() => { setInputText(''); setOutputText(''); }}>
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="models" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Models</CardTitle>
                    <CardDescription>Deployed TensorFlow models</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExportModels} disabled={models.length === 0}>
                      <Upload className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button variant="outline" onClick={handleImportModels}>
                      <Download className="h-4 w-4 mr-2" />
                      Import
                    </Button>
                    <Button onClick={openAddModelDialog}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Model
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search models..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="serving">Serving</SelectItem>
                      <SelectItem value="loading">Loading</SelectItem>
                      <SelectItem value="unavailable">Unavailable</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-4">
                  {filteredModels.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {models.length === 0 ? 'No models deployed' : 'No models match your filters'}
                    </div>
                  ) : (
                    filteredModels.map((model: Model) => (
                      <Card key={`${model.name}-${model.version}`} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={`p-2 rounded-lg ${getStatusColor(model.status)}/20`}>
                                <Brain className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="flex-1">
                                <CardTitle className="text-lg font-semibold">{model.name}</CardTitle>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <Badge variant="outline" className={getStatusColor(model.status)}>
                                    {model.status}
                                  </Badge>
                                  <Badge variant="outline">v{model.version}</Badge>
                                  <Badge variant="outline">{model.platform}</Badge>
                                  {model.requests !== undefined && (
                                    <Badge variant="outline">{model.requests} requests</Badge>
                                  )}
                                  {model.avgLatency !== undefined && (
                                    <Badge variant="outline">{model.avgLatency.toFixed(0)}ms avg</Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openEditModelDialog(model)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteModel(model)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {model.inputs && model.inputs.length > 0 && (
                            <div className="space-y-2">
                              <Label>Inputs</Label>
                              {model.inputs.map((input: { name: string; dtype: string; shape: string }, idx: number) => (
                                <div key={idx} className="p-2 border rounded text-sm">
                                  <span className="font-mono font-semibold">{input.name}</span>
                                  <Badge variant="outline" className="ml-2 text-xs">{input.dtype}</Badge>
                                  <Badge variant="outline" className="ml-2 text-xs">{input.shape}</Badge>
                                </div>
                              ))}
                            </div>
                          )}
                          {model.outputs && model.outputs.length > 0 && (
                            <div className="space-y-2 mt-4">
                              <Label>Outputs</Label>
                              {model.outputs.map((output: { name: string; dtype: string; shape: string }, idx: number) => (
                                <div key={idx} className="p-2 border rounded text-sm">
                                  <span className="font-mono font-semibold">{output.name}</span>
                                  <Badge variant="outline" className="ml-2 text-xs">{output.dtype}</Badge>
                                  <Badge variant="outline" className="ml-2 text-xs">{output.shape}</Badge>
                                </div>
                              ))}
                            </div>
                          )}
                          {model.totalPredictions !== undefined && (
                            <div className="mt-4 text-sm space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Predictions:</span>
                                <span className="font-semibold">{model.totalPredictions}</span>
                              </div>
                              {model.successfulPredictions !== undefined && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Successful:</span>
                                  <span className="font-semibold text-green-600">{model.successfulPredictions}</span>
                                </div>
                              )}
                              {model.failedPredictions !== undefined && model.failedPredictions > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Failed:</span>
                                  <span className="font-semibold text-red-600">{model.failedPredictions}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Prediction History</CardTitle>
                    <CardDescription>Previously executed predictions</CardDescription>
                  </div>
                  {predictions.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Showing {((historyPage - 1) * historyPageSize) + 1}-{Math.min(historyPage * historyPageSize, predictions.length)} of {predictions.length}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {predictions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No predictions yet</div>
                  ) : (
                    predictions.slice().reverse().slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize).map((pred: Prediction) => (
                      <Card key={pred.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-card">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${pred.status === 'success' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                                {pred.status === 'success' ? (
                                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                )}
                              </div>
                              <div>
                                <CardTitle className="text-lg font-semibold">{pred.model} v{pred.version}</CardTitle>
                                <div className="flex items-center gap-2 mt-2">
                                  {pred.latency && (
                                    <Badge variant="outline">{pred.latency}ms</Badge>
                                  )}
                                  <Badge variant={pred.status === 'success' ? 'default' : 'destructive'}>
                                    {pred.status}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {pred.input && (
                              <div className="space-y-2">
                                <Label>Input</Label>
                                <pre className="p-3 bg-muted rounded text-xs font-mono overflow-x-auto max-h-40 overflow-y-auto">{pred.input}</pre>
                              </div>
                            )}
                            {pred.output && (
                              <div className="space-y-2">
                                <Label>Output</Label>
                                <pre className="p-3 bg-muted rounded text-xs font-mono overflow-x-auto max-h-40 overflow-y-auto">{pred.output}</pre>
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-2">
                            {new Date(pred.timestamp).toLocaleString()}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
                {predictions.length > historyPageSize && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                      disabled={historyPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="text-sm text-muted-foreground">
                      Page {historyPage} of {Math.ceil(predictions.length / historyPageSize)}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPage(p => Math.min(Math.ceil(predictions.length / historyPageSize), p + 1))}
                      disabled={historyPage >= Math.ceil(predictions.length / historyPageSize)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Real-time metrics visualization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {chartData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No metrics data available yet. Metrics will appear as predictions are processed.
                  </div>
                ) : (
                  <>
                    {/* Latency Chart */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Latency Over Time</Label>
                        <Badge variant="outline">{averageLatency.toFixed(0)}ms avg</Badge>
                      </div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" />
                            <YAxis label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Legend />
                            <Area 
                              type="monotone" 
                              dataKey="latency" 
                              stroke="#8884d8" 
                              fill="#8884d8" 
                              fillOpacity={0.3}
                              name="Latency (ms)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* RPS Chart */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Requests Per Second</Label>
                        <Badge variant="outline">{requestsPerSecond.toFixed(1)} req/s</Badge>
                      </div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" />
                            <YAxis label={{ value: 'RPS', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Legend />
                            <Line 
                              type="monotone" 
                              dataKey="rps" 
                              stroke="#82ca9d" 
                              strokeWidth={2}
                              name="Requests/sec"
                            />
                            <Line 
                              type="monotone" 
                              dataKey="throughput" 
                              stroke="#ffc658" 
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              name="Throughput"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Error Rate Chart */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Error Rate</Label>
                        <Badge variant="outline" className={errorRate > 0.1 ? "bg-red-500" : ""}>
                          {(errorRate * 100).toFixed(1)}%
                        </Badge>
                      </div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" />
                            <YAxis label={{ value: 'Error Rate (%)', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Legend />
                            <Area 
                              type="monotone" 
                              dataKey="errorRate" 
                              stroke="#ff7300" 
                              fill="#ff7300" 
                              fillOpacity={0.3}
                              name="Error Rate (%)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Utilization Chart */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Resource Utilization</Label>
                      </div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" />
                            <YAxis label={{ value: 'Utilization (%)', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Legend />
                            <Line 
                              type="monotone" 
                              dataKey="cpuUtilization" 
                              stroke="#00ff00" 
                              strokeWidth={2}
                              name="CPU (%)"
                            />
                            {config.enableGPU && (
                              <Line 
                                type="monotone" 
                                dataKey="gpuUtilization" 
                                stroke="#ff00ff" 
                                strokeWidth={2}
                                name="GPU (%)"
                              />
                            )}
                            {config.enableBatching && (
                              <Line 
                                type="monotone" 
                                dataKey="batchUtilization" 
                                stroke="#0088fe" 
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                name="Batch (%)"
                              />
                            )}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>TensorFlow Serving Settings</CardTitle>
                <CardDescription>Server configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Endpoint</Label>
                  <Input
                    value={endpoint}
                    onChange={(e) => updateConfig({ endpoint: e.target.value })}
                    placeholder="localhost:8501"
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Model Base Path</Label>
                  <Input
                    value={config.modelBasePath || '/models'}
                    onChange={(e) => updateConfig({ modelBasePath: e.target.value })}
                    placeholder="/models"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Batching</Label>
                    <p className="text-xs text-muted-foreground">Batch multiple requests for better throughput</p>
                  </div>
                  <Switch
                    checked={config.enableBatching !== false}
                    onCheckedChange={(checked) => updateConfig({ enableBatching: checked })}
                  />
                </div>
                {config.enableBatching !== false && (
                  <>
                    <div className="space-y-2">
                      <Label>Batch Size</Label>
                      <Input
                        type="number"
                        value={config.batchSize || 32}
                        onChange={(e) => updateConfig({ batchSize: parseInt(e.target.value) || 32 })}
                        min={1}
                        max={1000}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Batch Size</Label>
                      <Input
                        type="number"
                        value={config.maxBatchSize || 128}
                        onChange={(e) => updateConfig({ maxBatchSize: parseInt(e.target.value) || 128 })}
                        min={1}
                        max={10000}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Batch Wait Time (ms)</Label>
                      <Input
                        type="number"
                        value={config.maxBatchWaitTime || 100}
                        onChange={(e) => updateConfig({ maxBatchWaitTime: parseInt(e.target.value) || 100 })}
                        min={1}
                      />
                    </div>
                    {batchUtilization > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <Label>Batch Utilization</Label>
                          <span className="text-muted-foreground">{(batchUtilization * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all"
                            style={{ width: `${batchUtilization * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable GPU</Label>
                    <p className="text-xs text-muted-foreground">Use GPU acceleration for inference</p>
                  </div>
                  <Switch
                    checked={config.enableGPU || false}
                    onCheckedChange={(checked) => updateConfig({ enableGPU: checked })}
                  />
                </div>
                {config.enableGPU && (
                  <>
                    <div className="space-y-2">
                      <Label>GPU Memory Fraction</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={config.gpuMemoryFraction || 0.5}
                        onChange={(e) => updateConfig({ gpuMemoryFraction: parseFloat(e.target.value) || 0.5 })}
                        min={0.1}
                        max={1.0}
                      />
                    </div>
                    {gpuUtilization > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <Label>GPU Utilization</Label>
                          <span className="text-muted-foreground">{(gpuUtilization * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 transition-all"
                            style={{ width: `${gpuUtilization * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Monitoring</Label>
                    <p className="text-xs text-muted-foreground">Enable metrics collection</p>
                  </div>
                  <Switch
                    checked={config.enableMonitoring !== false}
                    onCheckedChange={(checked) => updateConfig({ enableMonitoring: checked })}
                  />
                </div>
                {config.enableMonitoring !== false && (
                  <div className="space-y-2">
                    <Label>Monitoring Port</Label>
                    <Input
                      type="number"
                      value={config.monitoringPort || 8501}
                      onChange={(e) => updateConfig({ monitoringPort: parseInt(e.target.value) || 8501 })}
                      min={1}
                      max={65535}
                    />
                  </div>
                )}
                <Separator />
                <div className="space-y-2">
                  <Label>Number of Threads</Label>
                  <Input
                    type="number"
                    value={config.numThreads || 4}
                    onChange={(e) => updateConfig({ numThreads: parseInt(e.target.value) || 4 })}
                    min={1}
                    max={32}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Inter-Op Parallelism Threads</Label>
                  <Input
                    type="number"
                    value={config.interOpParallelismThreads || 2}
                    onChange={(e) => updateConfig({ interOpParallelismThreads: parseInt(e.target.value) || 2 })}
                    min={1}
                    max={16}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Intra-Op Parallelism Threads</Label>
                  <Input
                    type="number"
                    value={config.intraOpParallelismThreads || 2}
                    onChange={(e) => updateConfig({ intraOpParallelismThreads: parseInt(e.target.value) || 2 })}
                    min={1}
                    max={16}
                  />
                </div>
                {memoryUsage > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <Label>Memory Usage</Label>
                      <span className="text-muted-foreground">{(memoryUsage / 1024).toFixed(2)} GB</span>
                    </div>
                  </div>
                )}
                {cpuUtilization > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <Label>CPU Utilization</Label>
                      <span className="text-muted-foreground">{(cpuUtilization * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${cpuUtilization * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Error Simulation</Label>
                    <p className="text-xs text-muted-foreground">Simulate errors for testing error handling</p>
                  </div>
                  <Switch
                    checked={config.enableErrorSimulation || false}
                    onCheckedChange={(checked) => updateConfig({ enableErrorSimulation: checked })}
                  />
                </div>
                {config.enableErrorSimulation && (
                  <>
                    <div className="space-y-2">
                      <Label>Error Rate (0-1)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={config.errorRate || 0}
                        onChange={(e) => updateConfig({ errorRate: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)) })}
                        min={0}
                        max={1}
                      />
                      <p className="text-xs text-muted-foreground">
                        Probability of error: {(config.errorRate || 0) * 100}%
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Request Timeout (ms)</Label>
                      <Input
                        type="number"
                        value={config.timeoutMs || 30000}
                        onChange={(e) => updateConfig({ timeoutMs: parseInt(e.target.value) || 30000 })}
                        min={1000}
                        max={300000}
                      />
                    </div>
                  </>
                )}
                <Separator />
                <div className="space-y-2">
                  <Label>Model Versioning Policy</Label>
                  <Select 
                    value={config.versioningPolicy || 'latest'} 
                    onValueChange={(value: 'latest' | 'specific' | 'all') => updateConfig({ versioningPolicy: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="latest">Latest - Use latest version</SelectItem>
                      <SelectItem value="specific">Specific - Use specified version</SelectItem>
                      <SelectItem value="all">All - Load balance across all versions</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    How to select model version when multiple versions are available
                  </p>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable A/B Testing</Label>
                    <p className="text-xs text-muted-foreground">Distribute traffic across model versions</p>
                  </div>
                  <Switch
                    checked={config.enableABTesting || false}
                    onCheckedChange={(checked) => updateConfig({ enableABTesting: checked })}
                  />
                </div>
                {config.enableABTesting && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">A/B Test Configuration</Label>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const modelNames = Array.from(new Set(models.map((m: Model) => m.name)));
                          if (modelNames.length === 0) {
                            toast({
                              title: 'Error',
                              description: 'No models available for A/B testing',
                              variant: 'destructive',
                            });
                            return;
                          }
                          const newConfig = config.abTestConfig || [];
                          const modelName = modelNames[0];
                          const modelVersions = models.filter((m: Model) => m.name === modelName);
                          if (modelVersions.length < 2) {
                            toast({
                              title: 'Error',
                              description: `Model "${modelName}" needs at least 2 versions for A/B testing`,
                              variant: 'destructive',
                            });
                            return;
                          }
                          const trafficPerVersion = Math.floor(100 / modelVersions.length);
                          newConfig.push({
                            modelName,
                            versions: modelVersions.map((m: Model) => ({
                              version: m.version,
                              trafficPercentage: trafficPerVersion,
                            })),
                          });
                          updateConfig({ abTestConfig: newConfig });
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add A/B Test
                      </Button>
                    </div>
                    {(config.abTestConfig || []).map((abTest: { modelName: string; versions: Array<{ version: string; trafficPercentage: number }> }, idx: number) => (
                      <Card key={idx} className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="font-semibold">{abTest.modelName}</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newConfig = (config.abTestConfig || []).filter((_: any, i: number) => i !== idx);
                              updateConfig({ abTestConfig: newConfig });
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {abTest.versions.map((v: { version: string; trafficPercentage: number }, vIdx: number) => (
                            <div key={vIdx} className="flex items-center gap-2">
                              <Badge variant="outline">v{v.version}</Badge>
                              <Input
                                type="number"
                                value={v.trafficPercentage}
                                onChange={(e) => {
                                  const newConfig = [...(config.abTestConfig || [])];
                                  newConfig[idx].versions[vIdx].trafficPercentage = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                                  updateConfig({ abTestConfig: newConfig });
                                }}
                                className="w-24"
                                min={0}
                                max={100}
                              />
                              <span className="text-sm text-muted-foreground">%</span>
                            </div>
                          ))}
                          <div className="text-xs text-muted-foreground mt-2">
                            Total: {abTest.versions.reduce((sum: number, v: { version: string; trafficPercentage: number }) => sum + v.trafficPercentage, 0)}%
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Prometheus Metrics Export</Label>
                    <p className="text-xs text-muted-foreground">Export metrics in Prometheus format</p>
                  </div>
                  <Switch
                    checked={config.enablePrometheusExport || false}
                    onCheckedChange={(checked) => updateConfig({ enablePrometheusExport: checked })}
                  />
                </div>
                {config.enablePrometheusExport && (
                  <>
                    <div className="space-y-2">
                      <Label>Prometheus Port</Label>
                      <Input
                        type="number"
                        value={config.prometheusPort || 8502}
                        onChange={(e) => updateConfig({ prometheusPort: parseInt(e.target.value) || 8502 })}
                        min={1}
                        max={65535}
                      />
                    </div>
                    {tfEngine && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Prometheus Metrics Endpoint</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const metrics = tfEngine.getPrometheusMetrics();
                              navigator.clipboard.writeText(metrics);
                              toast({
                                title: 'Copied',
                                description: 'Prometheus metrics copied to clipboard',
                              });
                            }}
                          >
                            Copy Metrics
                          </Button>
                        </div>
                        <div className="p-3 bg-muted rounded text-xs font-mono max-h-40 overflow-auto">
                          <pre>{tfEngine.getPrometheusMetrics()}</pre>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable gRPC API</Label>
                    <p className="text-xs text-muted-foreground">Enable gRPC API for efficient data transfer</p>
                  </div>
                  <Switch
                    checked={config.enableGRPC || false}
                    onCheckedChange={(checked) => updateConfig({ enableGRPC: checked })}
                  />
                </div>
                {config.enableGRPC && (
                  <div className="space-y-2">
                    <Label>gRPC Port</Label>
                    <Input
                      type="number"
                      value={config.grpcPort || 8500}
                      onChange={(e) => updateConfig({ grpcPort: parseInt(e.target.value) || 8500 })}
                      min={1}
                      max={65535}
                    />
                    {tfEngine && (
                      <div className="p-2 bg-muted rounded text-xs">
                        <div className="font-semibold">gRPC Endpoint:</div>
                        <div className="text-muted-foreground mt-1">
                          {tfEngine.getGRPCInfo()?.endpoint || `${endpoint.split(':')[0]}:${config.grpcPort || 8500}`}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <Separator />
                <div className="space-y-2">
                  <Label>Model Status API</Label>
                  <p className="text-xs text-muted-foreground">
                    REST API endpoint: GET /v1/models/{'{model}'}/versions/{'{version}'}
                  </p>
                  {tfEngine && models.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {models.slice(0, 3).map((model: Model) => {
                        const status = tfEngine.getModelStatus(model.name, model.version);
                        return (
                          <div key={`${model.name}-${model.version}`} className="p-2 border rounded text-xs">
                            <div className="font-semibold">{model.name}:{model.version}</div>
                            <div className="text-muted-foreground mt-1">
                              Status: {model.status}
                            </div>
                            {status && (
                              <div className="text-muted-foreground mt-1">
                                API State: {status.model_version_status[0]?.state}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add/Edit Model Dialog */}
      <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingModel ? 'Edit Model' : 'Add Model'}</DialogTitle>
            <DialogDescription>
              {editingModel ? 'Update model configuration' : 'Add a new TensorFlow model to the serving system'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Model Name *</Label>
                <Input
                  value={modelForm.name}
                  onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })}
                  placeholder="my-model"
                />
              </div>
              <div className="space-y-2">
                <Label>Version *</Label>
                <Input
                  value={modelForm.version}
                  onChange={(e) => setModelForm({ ...modelForm, version: e.target.value })}
                  placeholder="1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={modelForm.platform} onValueChange={(value) => setModelForm({ ...modelForm, platform: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tensorflow">TensorFlow</SelectItem>
                    <SelectItem value="tensorflow-lite">TensorFlow Lite</SelectItem>
                    <SelectItem value="savedmodel">SavedModel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={modelForm.status} onValueChange={(value: 'serving' | 'loading' | 'unavailable' | 'error') => setModelForm({ ...modelForm, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="serving">Serving</SelectItem>
                    <SelectItem value="loading">Loading</SelectItem>
                    <SelectItem value="unavailable">Unavailable</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Inputs</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => addInputOutput('input')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Input
                </Button>
              </div>
              {modelForm.inputs.map((input, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-2 items-end">
                  <Input
                    placeholder="Name"
                    value={input.name}
                    onChange={(e) => updateInputOutput('input', idx, 'name', e.target.value)}
                  />
                  <Input
                    placeholder="dtype"
                    value={input.dtype}
                    onChange={(e) => updateInputOutput('input', idx, 'dtype', e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="shape"
                      value={input.shape}
                      onChange={(e) => updateInputOutput('input', idx, 'shape', e.target.value)}
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeInputOutput('input', idx)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Outputs</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => addInputOutput('output')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Output
                </Button>
              </div>
              {modelForm.outputs.map((output, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-2 items-end">
                  <Input
                    placeholder="Name"
                    value={output.name}
                    onChange={(e) => updateInputOutput('output', idx, 'name', e.target.value)}
                  />
                  <Input
                    placeholder="dtype"
                    value={output.dtype}
                    onChange={(e) => updateInputOutput('output', idx, 'dtype', e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="shape"
                      value={output.shape}
                      onChange={(e) => updateInputOutput('output', idx, 'shape', e.target.value)}
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeInputOutput('output', idx)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModelDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveModel}>
              {editingModel ? 'Update' : 'Add'} Model
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Model</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete model "{modelToDelete?.name}" version "{modelToDelete?.version}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteModel}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { showSuccess, showError } from '@/utils/toast';
import { useState, useMemo, useEffect } from 'react';
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
  Flame,
  Search,
  Filter,
  X
} from 'lucide-react';

interface PyTorchServeConfigProps {
  componentId: string;
}

interface Model {
  name: string;
  version: string;
  status: 'serving' | 'loading' | 'unavailable' | 'error';
  handler: string;
  inputs?: Array<{ name: string; dtype: string; shape: string }>;
  outputs?: Array<{ name: string; dtype: string; shape: string }>;
  requests?: number;
  avgLatency?: number;
}

interface Prediction {
  id: string;
  model: string;
  version: string;
  input?: string;
  output?: string;
  status: 'success' | 'error';
  timestamp: string;
  latency?: number;
}

interface PyTorchServeConfig {
  enabled?: boolean;
  models?: Model[];
  predictions?: Prediction[];
  endpoint?: string;
  modelStore?: string;
  enableWorkers?: boolean;
  numWorkers?: number;
  enableBatching?: boolean;
  batchSize?: number;
  maxBatchDelay?: number;
  enableGPU?: boolean;
  enableMetrics?: boolean;
  metricsPort?: number;
  totalModels?: number;
  totalPredictions?: number;
  averageLatency?: number;
}

export function PyTorchServeConfigAdvanced({ componentId }: PyTorchServeConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { getComponentMetrics } = useEmulationStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  // Get PyTorch Serve emulation engine for real-time metrics
  const pytorchEngine = emulationEngine.getPyTorchServeEmulationEngine(componentId);
  const componentMetrics = getComponentMetrics(componentId);
  const customMetrics = componentMetrics?.customMetrics || {};

  const config = (node.data.config as any) || {} as PyTorchServeConfig;
  const models = config.models || [];
  const predictions = config.predictions || [];
  const endpoint = config.endpoint || 'localhost:8080';
  const modelStore = config.modelStore || '/models';
  const enableWorkers = config.enableWorkers !== false;
  const numWorkers = config.numWorkers || 1;
  const enableBatching = config.enableBatching !== false;
  const batchSize = config.batchSize || 1;
  const maxBatchDelay = config.maxBatchDelay || 100;
  const enableGPU = config.enableGPU || false;
  const enableMetrics = config.enableMetrics !== false;
  const metricsPort = config.metricsPort || 8082;
  
  // Get real-time metrics from emulation engine or fallback to config
  const pytorchMetrics = pytorchEngine?.getMetrics();
  const totalModels = pytorchMetrics?.totalModels ?? config.totalModels ?? models.length;
  const servingModels = pytorchMetrics?.servingModels ?? models.filter((m: Model) => m.status === 'serving').length;
  const totalPredictions = pytorchMetrics?.totalPredictions ?? config.totalPredictions ?? predictions.length;
  const averageLatency = pytorchMetrics?.averageLatency ?? config.averageLatency ?? (models.length > 0 ? models.reduce((sum: number, m: Model) => sum + (m.avgLatency || 0), 0) / models.length : 0);
  const requestsPerSecond = pytorchMetrics?.requestsPerSecond ?? customMetrics.requestsPerSecond ?? 0;
  const errorRate = pytorchMetrics?.errorRate ?? customMetrics.errorRate ?? 0;

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
  
  // Form state for model dialog
  const [modelForm, setModelForm] = useState<{
    name: string;
    version: string;
    status: 'serving' | 'loading' | 'unavailable' | 'error';
    handler: string;
    inputs: Array<{ name: string; dtype: string; shape: string }>;
    outputs: Array<{ name: string; dtype: string; shape: string }>;
  }>({
    name: '',
    version: '1.0',
    status: 'serving',
    handler: 'image_classifier',
    inputs: [],
    outputs: [],
  });
  
  // Filtered models
  const filteredModels = useMemo(() => {
    return models.filter((model) => {
      const matchesSearch = !searchQuery || 
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.version.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.handler.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || model.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [models, searchQuery, statusFilter]);

  const updateConfig = (updates: Partial<PyTorchServeConfig>) => {
    const newConfig = { ...config, ...updates };
    updateNode(componentId, {
      data: {
        ...node.data,
        config: newConfig,
      },
    });
    
    // Sync with emulation engine (async to avoid blocking)
    setTimeout(() => {
      const engine = emulationEngine.getPyTorchServeEmulationEngine(componentId);
      if (engine) {
        // Update config in engine first, then sync models
        engine.initializeConfig(node);
        engine.syncModelsFromConfig();
      }
    }, 0);
  };

  // Sync models from emulation engine to UI (only when engine changes, not on every render)
  useEffect(() => {
    if (pytorchEngine && models.length === 0) {
      // Only sync if we have no models in config but engine has models
      const engineModels = pytorchEngine.getModels();
      if (engineModels.length > 0) {
        const updatedModels = engineModels.map(m => ({
          name: m.name,
          version: m.version,
          status: m.status,
          handler: m.handler || 'image_classifier',
          inputs: m.inputs || [],
          outputs: m.outputs || [],
          requests: m.requests,
          avgLatency: m.avgLatency,
        }));
        updateConfig({ models: updatedModels });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pytorchEngine]);

  // Auto-refresh metrics every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (pytorchEngine) {
        // Trigger sync to update metrics
        pytorchEngine.syncModelsFromConfig();
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [pytorchEngine]);

  const executePrediction = async () => {
    if (!selectedModel || !selectedVersion) {
      showError('Please select a model and version');
      return;
    }
    
    if (!inputText.trim()) {
      showError('Please provide input data');
      return;
    }
    
    try {
      let inputData;
      try {
        inputData = JSON.parse(inputText);
      } catch (e) {
        showError('Invalid JSON input');
        return;
      }
      
      if (pytorchEngine) {
        // Use real emulation engine
        const result = await pytorchEngine.processPrediction(selectedModel, selectedVersion, inputData);
        
        if (result.success && result.output) {
          const newPrediction: Prediction = {
            id: `pred-${Date.now()}`,
            model: selectedModel,
            version: selectedVersion,
            input: inputText,
            output: JSON.stringify(result.output, null, 2),
            status: 'success',
            timestamp: new Date().toISOString(),
            latency: result.latency,
          };
          setOutputText(newPrediction.output);
          updateConfig({ predictions: [...predictions.slice(-99), newPrediction] }); // Keep last 100
          showSuccess(`Prediction completed in ${result.latency}ms`);
        } else {
          const newPrediction: Prediction = {
            id: `pred-${Date.now()}`,
            model: selectedModel,
            version: selectedVersion,
            input: inputText,
            output: undefined,
            status: 'error',
            timestamp: new Date().toISOString(),
            latency: result.latency,
          };
          setOutputText(JSON.stringify({ error: result.error }, null, 2));
          updateConfig({ predictions: [...predictions.slice(-99), newPrediction] });
          showError(result.error || 'Prediction failed');
        }
      } else {
        // Fallback to mock
        const newPrediction: Prediction = {
          id: `pred-${Date.now()}`,
          model: selectedModel,
          version: selectedVersion,
          input: inputText,
          output: JSON.stringify({ predictions: [[0.85, 0.1, 0.05]] }, null, 2),
          status: 'success',
          timestamp: new Date().toISOString(),
          latency: Math.floor(Math.random() * 40) + 20,
        };
        setOutputText(newPrediction.output || '');
        updateConfig({ predictions: [...predictions.slice(-99), newPrediction] });
        showSuccess('Prediction completed (mock)');
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Prediction failed');
    }
  };
  
  const openAddModelDialog = () => {
    setEditingModel(null);
    setModelForm({
      name: '',
      version: '1.0',
      status: 'serving',
      handler: 'image_classifier',
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
      status: model.status,
      handler: model.handler,
      inputs: model.inputs || [],
      outputs: model.outputs || [],
    });
    setModelDialogOpen(true);
  };

  const handleSaveModel = () => {
    if (!modelForm.name || !modelForm.version) {
      showError('Model name and version are required');
      return;
    }

    // Check for duplicate
    const existingModel = models.find(
      (m: Model) => m.name === modelForm.name && m.version === modelForm.version && 
      (!editingModel || (m.name !== editingModel.name || m.version !== editingModel.version))
    );
    if (existingModel) {
      showError('Model with this name and version already exists');
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
    showSuccess(editingModel ? 'Model updated' : 'Model added');
  };

  const handleDeleteModel = (model: Model) => {
    setModelToDelete({ name: model.name, version: model.version });
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteModel = () => {
    if (modelToDelete) {
      const updatedModels = models.filter(m => !(m.name === modelToDelete.name && m.version === modelToDelete.version));
      updateConfig({ models: updatedModels });
      setDeleteConfirmOpen(false);
      setModelToDelete(null);
      showSuccess('Model deleted');
    }
  };

  const addInputOutput = (type: 'input' | 'output') => {
    if (type === 'input') {
      setModelForm({
        ...modelForm,
        inputs: [...modelForm.inputs, { name: '', dtype: 'float32', shape: '[1,1]' }],
      });
    } else {
      setModelForm({
        ...modelForm,
        outputs: [...modelForm.outputs, { name: '', dtype: 'float32', shape: '[1,1]' }],
      });
    }
  };

  const updateInputOutput = (
    type: 'input' | 'output',
    index: number,
    field: 'name' | 'dtype' | 'shape',
    value: string
  ) => {
    if (type === 'input') {
      const newInputs = [...modelForm.inputs];
      newInputs[index] = { ...newInputs[index], [field]: value };
      setModelForm({ ...modelForm, inputs: newInputs });
    } else {
      const newOutputs = [...modelForm.outputs];
      newOutputs[index] = { ...newOutputs[index], [field]: value };
      setModelForm({ ...modelForm, outputs: newOutputs });
    }
  };

  const removeInputOutput = (type: 'input' | 'output', index: number) => {
    if (type === 'input') {
      const newInputs = modelForm.inputs.filter((_, i) => i !== index);
      setModelForm({ ...modelForm, inputs: newInputs });
    } else {
      const newOutputs = modelForm.outputs.filter((_, i) => i !== index);
      setModelForm({ ...modelForm, outputs: newOutputs });
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

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">PyTorch Serve</p>
            <h2 className="text-2xl font-bold text-foreground">Model Serving</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Flexible and easy-to-use serving for PyTorch models
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                if (pytorchEngine) {
                  pytorchEngine.syncModelsFromConfig();
                  showSuccess('Configuration refreshed');
                }
              }}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-orange-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Models</CardTitle>
                <Flame className="h-4 w-4 text-orange-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-orange-600 dark:text-orange-400">{totalModels}</span>
                <span className="text-xs text-muted-foreground">total</span>
              </div>
              {servingModels > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {servingModels} serving
                </div>
              )}
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
              {requestsPerSecond > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {requestsPerSecond.toFixed(1)} req/s
                </div>
              )}
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
              {errorRate > 0 && (
                <div className="text-xs text-destructive mt-1">
                  {(errorRate * 100).toFixed(1)}% errors
                </div>
              )}
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
              <Flame className="h-4 w-4" />
              <span className="hidden sm:inline">Models ({models.length})</span>
              <span className="sm:hidden">Models</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2 flex-1 min-w-[120px]">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">History ({predictions.length})</span>
              <span className="sm:hidden">History</span>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Select value={selectedModel} onValueChange={(value) => {
                      setSelectedModel(value);
                      const model = models.find((m) => m.name === value);
                      if (model) {
                        setSelectedVersion(model.version);
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((m) => (
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
                        {selectedModel && models.find((m) => m.name === selectedModel) && (
                          <SelectItem value={models.find((m) => m.name === selectedModel)!.version}>
                            {models.find((m) => m.name === selectedModel)!.version}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Input (JSON)</Label>
                    <Textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="font-mono text-sm min-h-[200px]"
                      placeholder='{ "data": [...] }'
                    />
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
                    <CardDescription>Deployed PyTorch models</CardDescription>
                  </div>
                  <Button onClick={openAddModelDialog} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Model
                  </Button>
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
                      {models.length === 0 ? (
                        <>
                          <Flame className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No models deployed</p>
                          <Button onClick={openAddModelDialog} variant="outline" size="sm" className="mt-4">
                            <Plus className="h-4 w-4 mr-2" />
                            Add First Model
                          </Button>
                        </>
                      ) : (
                        <p>No models match your filters</p>
                      )}
                    </div>
                  ) : (
                    filteredModels.map((model) => (
                      <Card key={`${model.name}-${model.version}`} className="border-l-4 border-l-orange-500 hover:shadow-md transition-shadow bg-card">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={`p-2 rounded-lg ${getStatusColor(model.status)}/20`}>
                                <Flame className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                              </div>
                              <div className="flex-1">
                                <CardTitle className="text-lg font-semibold">{model.name}</CardTitle>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <Badge variant="outline" className={getStatusColor(model.status)}>
                                    {model.status}
                                  </Badge>
                                  <Badge variant="outline">v{model.version}</Badge>
                                  <Badge variant="outline">{model.handler}</Badge>
                                  {model.requests && (
                                    <Badge variant="outline">{model.requests} requests</Badge>
                                  )}
                                  {model.avgLatency && (
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
                              {model.inputs.map((input, idx) => (
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
                              {model.outputs.map((output, idx) => (
                                <div key={idx} className="p-2 border rounded text-sm">
                                  <span className="font-mono font-semibold">{output.name}</span>
                                  <Badge variant="outline" className="ml-2 text-xs">{output.dtype}</Badge>
                                  <Badge variant="outline" className="ml-2 text-xs">{output.shape}</Badge>
                                </div>
                              ))}
                            </div>
                          )}
                          {model.avgLatency && (
                            <div className="mt-4 text-sm">
                              <span className="text-muted-foreground">Avg Latency:</span>
                              <span className="ml-2 font-semibold">{model.avgLatency.toFixed(0)}ms</span>
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
                <CardTitle>Prediction History</CardTitle>
                <CardDescription>Previously executed predictions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {predictions.map((pred) => (
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
                        <div className="grid grid-cols-2 gap-4">
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
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>PyTorch Serve Settings</CardTitle>
                <CardDescription>Server configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Endpoint</Label>
                  <Input
                    value={endpoint}
                    onChange={(e) => updateConfig({ endpoint: e.target.value })}
                    placeholder="localhost:8080"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable GPU</Label>
                    <p className="text-xs text-muted-foreground">Use GPU acceleration for inference</p>
                  </div>
                  <Switch 
                    checked={enableGPU} 
                    onCheckedChange={(checked) => {
                      updateConfig({ enableGPU: checked });
                      showSuccess(checked ? 'GPU enabled' : 'GPU disabled');
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Batching</Label>
                    <p className="text-xs text-muted-foreground">Batch multiple requests together</p>
                  </div>
                  <Switch 
                    checked={enableBatching} 
                    onCheckedChange={(checked) => {
                      updateConfig({ enableBatching: checked });
                      showSuccess(checked ? 'Batching enabled' : 'Batching disabled');
                    }}
                  />
                </div>
                {enableBatching && (
                  <>
                    <div className="space-y-2">
                      <Label>Batch Size</Label>
                      <Input 
                        type="number" 
                        value={batchSize} 
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 1;
                          if (value >= 1 && value <= 1000) {
                            updateConfig({ batchSize: value });
                          }
                        }}
                        min={1}
                        max={1000}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Batch Wait Time (ms)</Label>
                      <Input 
                        type="number" 
                        value={maxBatchDelay} 
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 100;
                          if (value >= 1 && value <= 10000) {
                            updateConfig({ maxBatchDelay: value });
                          }
                        }}
                        min={1}
                        max={10000}
                      />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label>Model Store</Label>
                  <Input 
                    value={modelStore} 
                    onChange={(e) => updateConfig({ modelStore: e.target.value })}
                    placeholder="/models"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Workers</Label>
                    <p className="text-xs text-muted-foreground">Use worker processes for parallel processing</p>
                  </div>
                  <Switch 
                    checked={enableWorkers} 
                    onCheckedChange={(checked) => {
                      updateConfig({ enableWorkers: checked });
                      showSuccess(checked ? 'Workers enabled' : 'Workers disabled');
                    }}
                  />
                </div>
                {enableWorkers && (
                  <div className="space-y-2">
                    <Label>Number of Workers</Label>
                    <Input 
                      type="number" 
                      value={numWorkers} 
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1;
                        if (value >= 1 && value <= 100) {
                          updateConfig({ numWorkers: value });
                        }
                      }}
                      min={1}
                      max={100}
                    />
                  </div>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Metrics</Label>
                    <p className="text-xs text-muted-foreground">Export metrics for monitoring</p>
                  </div>
                  <Switch 
                    checked={enableMetrics} 
                    onCheckedChange={(checked) => {
                      updateConfig({ enableMetrics: checked });
                      showSuccess(checked ? 'Metrics enabled' : 'Metrics disabled');
                    }}
                  />
                </div>
                {enableMetrics && (
                  <div className="space-y-2">
                    <Label>Metrics Port</Label>
                    <Input 
                      type="number" 
                      value={metricsPort} 
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 8082;
                        if (value >= 1024 && value <= 65535) {
                          updateConfig({ metricsPort: value });
                        }
                      }}
                      min={1024}
                      max={65535}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add/Edit Model Dialog */}
        <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingModel ? 'Edit Model' : 'Add Model'}</DialogTitle>
              <DialogDescription>
                {editingModel ? 'Update model configuration' : 'Add a new PyTorch model to the serving system'}
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
                    placeholder="1.0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Handler</Label>
                  <Select value={modelForm.handler} onValueChange={(value) => setModelForm({ ...modelForm, handler: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image_classifier">Image Classifier</SelectItem>
                      <SelectItem value="object_detector">Object Detector</SelectItem>
                      <SelectItem value="text_classifier">Text Classifier</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={modelForm.status} onValueChange={(value: 'serving' | 'loading' | 'unavailable') => setModelForm({ ...modelForm, status: value })}>
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
    </div>
  );
}


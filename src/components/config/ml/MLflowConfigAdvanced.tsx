import { useState } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
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
import { Textarea } from '@/components/ui/textarea';
import {
  FlaskConical,
  Package,
  TrendingUp,
  FileText,
  Settings,
  Plus,
  Trash2,
  Search,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3
} from 'lucide-react';

interface MLflowConfigProps {
  componentId: string;
}

interface Experiment {
  id: string;
  name: string;
  runs: number;
  lastRun?: string;
  status?: 'active' | 'archived';
  tags?: Record<string, string>;
}

interface Run {
  id: string;
  name: string;
  experiment: string;
  status: 'running' | 'finished' | 'failed' | 'killed';
  startTime: string;
  endTime?: string;
  duration?: number;
  metrics?: Metric[];
  parameters?: Parameter[];
  tags?: Record<string, string>;
  artifacts?: string[];
}

interface Metric {
  key: string;
  value: number;
  step?: number;
  timestamp: number;
}

interface Parameter {
  key: string;
  value: string;
}

interface Model {
  id: string;
  name: string;
  version: number;
  stage: 'None' | 'Staging' | 'Production' | 'Archived';
  runId: string;
  registeredAt: string;
  tags?: Record<string, string>;
  description?: string;
}

interface MLflowConfig {
  trackingUri?: string;
  experiments?: Experiment[];
  runs?: Run[];
  models?: Model[];
  selectedExperiment?: string;
  enableModelRegistry?: boolean;
  enableArtifactStore?: boolean;
  artifactStorePath?: string;
}

export function MLflowConfigAdvanced({ componentId }: MLflowConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as MLflowConfig;
  const trackingUri = config.trackingUri || 'http://mlflow:5000';
  const enableModelRegistry = config.enableModelRegistry ?? true;
  const enableArtifactStore = config.enableArtifactStore ?? true;
  const artifactStorePath = config.artifactStorePath || '/mlflow/artifacts';
  const experiments = config.experiments || [];
  const runs = config.runs || [];
  const models = config.models || [];
  const selectedExperiment = config.selectedExperiment || experiments[0]?.name || '';

  const [showCreateExperiment, setShowCreateExperiment] = useState(false);
  const [showCreateRun, setShowCreateRun] = useState(false);
  const [selectedRun, setSelectedRun] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const updateConfig = (updates: Partial<MLflowConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addExperiment = () => {
    const newExperiment: Experiment = {
      id: String(experiments.length + 1),
      name: 'new-experiment',
      runs: 0,
      status: 'active'
    };
    updateConfig({ experiments: [...experiments, newExperiment] });
    setShowCreateExperiment(false);
  };

  const removeExperiment = (index: number) => {
    updateConfig({ experiments: experiments.filter((_, i) => i !== index) });
  };

  const updateExperiment = (index: number, field: keyof Experiment, value: any) => {
    const updated = [...experiments];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ experiments: updated });
  };

  const addRun = () => {
    const newRun: Run = {
      id: `run-${Date.now()}`,
      name: `run-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}`,
      experiment: selectedExperiment || experiments[0]?.name || '',
      status: 'running',
      startTime: new Date().toISOString(),
      metrics: [],
      parameters: [],
      tags: {}
    };
    updateConfig({ runs: [...runs, newRun] });
    setShowCreateRun(false);
  };

  const removeRun = (index: number) => {
    updateConfig({ runs: runs.filter((_, i) => i !== index) });
  };

  const updateRunStatus = (runId: string, status: Run['status']) => {
    const updated = runs.map(r => r.id === runId ? { ...r, status, endTime: status !== 'running' ? new Date().toISOString() : undefined } : r);
    updateConfig({ runs: updated });
  };

  const addModel = (runId: string) => {
    const run = runs.find(r => r.id === runId);
    if (!run) return;

    const modelName = run.tags?.model_name || 'model';
    const existingVersions = models.filter(m => m.name === modelName).map(m => m.version);
    const nextVersion = existingVersions.length > 0 ? Math.max(...existingVersions) + 1 : 1;

    const newModel: Model = {
      id: `model-${Date.now()}`,
      name: modelName,
      version: nextVersion,
      stage: 'None',
      runId: runId,
      registeredAt: new Date().toISOString(),
      tags: run.tags || {}
    };
    updateConfig({ models: [...models, newModel] });
  };

  const removeModel = (index: number) => {
    updateConfig({ models: models.filter((_, i) => i !== index) });
  };

  const updateModelStage = (index: number, stage: Model['stage']) => {
    const updated = [...models];
    updated[index] = { ...updated[index], stage };
    updateConfig({ models: updated });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'finished':
      case 'active':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'running':
        return <Play className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'killed':
        return <XCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'finished':
      case 'active':
        return <Badge variant="default" className="bg-green-500">Finished</Badge>;
      case 'running':
        return <Badge variant="default" className="bg-blue-500">Running</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'killed':
        return <Badge variant="outline" className="border-orange-500 text-orange-500">Killed</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const filteredRuns = runs.filter(run => {
    if (selectedExperiment && run.experiment !== selectedExperiment) return false;
    if (searchQuery && !run.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FlaskConical className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">MLflow</h2>
              <p className="text-sm text-muted-foreground mt-1">ML lifecycle management & experiment tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">v2.8</Badge>
            <Badge variant="secondary" className="gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Running
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Connection Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Connection Settings</CardTitle>
            <CardDescription>Configure MLflow tracking server</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tracking URI</Label>
                <Input
                  value={trackingUri}
                  onChange={(e) => updateConfig({ trackingUri: e.target.value })}
                  placeholder="http://mlflow:5000"
                />
              </div>
              <div className="space-y-2">
                <Label>Artifact Store Path</Label>
                <Input
                  value={artifactStorePath}
                  onChange={(e) => updateConfig({ artifactStorePath: e.target.value })}
                  placeholder="/mlflow/artifacts"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Enable Model Registry</Label>
                <p className="text-sm text-muted-foreground">Enable model versioning and staging</p>
              </div>
              <Switch
                checked={enableModelRegistry}
                onCheckedChange={(checked) => updateConfig({ enableModelRegistry: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Enable Artifact Store</Label>
                <p className="text-sm text-muted-foreground">Store model artifacts and files</p>
              </div>
              <Switch
                checked={enableArtifactStore}
                onCheckedChange={(checked) => updateConfig({ enableArtifactStore: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="experiments" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="experiments" className="gap-2">
              <FlaskConical className="h-4 w-4" />
              Experiments
            </TabsTrigger>
            <TabsTrigger value="runs" className="gap-2">
              <Play className="h-4 w-4" />
              Runs
            </TabsTrigger>
            <TabsTrigger value="models" className="gap-2">
              <Package className="h-4 w-4" />
              Models
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Metrics
            </TabsTrigger>
          </TabsList>

          {/* Experiments Tab */}
          <TabsContent value="experiments" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Experiments</CardTitle>
                  <CardDescription>Manage ML experiments</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowCreateExperiment(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Experiment
                </Button>
              </CardHeader>
              {showCreateExperiment && (
                <CardContent className="border-b pb-4 mb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Experiment Name</Label>
                      <Input placeholder="new-experiment" />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addExperiment}>Create Experiment</Button>
                      <Button variant="outline" onClick={() => setShowCreateExperiment(false)}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-3">
                {experiments.map((experiment, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold">{experiment.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {experiment.runs} runs
                          {experiment.lastRun && ` • Last run: ${experiment.lastRun}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={experiment.status === 'active' ? 'default' : 'secondary'}>
                          {experiment.status || 'active'}
                        </Badge>
                        <Button variant="ghost" size="icon" onClick={() => removeExperiment(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {experiment.tags && Object.keys(experiment.tags).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(experiment.tags).map(([key, value]) => (
                          <Badge key={key} variant="outline" className="text-xs">
                            {key}: {value}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Runs Tab */}
          <TabsContent value="runs" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Runs</CardTitle>
                  <CardDescription>Training runs and their metrics</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedExperiment} onValueChange={(value) => updateConfig({ selectedExperiment: value })}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="All Experiments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Experiments</SelectItem>
                      {experiments.map((exp, idx) => (
                        <SelectItem key={idx} value={exp.name}>{exp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-8 w-64"
                      placeholder="Search runs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowCreateRun(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Run
                  </Button>
                </div>
              </CardHeader>
              {showCreateRun && (
                <CardContent className="border-b pb-4 mb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Experiment</Label>
                      <Select value={selectedExperiment} onValueChange={(value) => updateConfig({ selectedExperiment: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {experiments.map((exp, idx) => (
                            <SelectItem key={idx} value={exp.name}>{exp.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addRun}>Start Run</Button>
                      <Button variant="outline" onClick={() => setShowCreateRun(false)}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-3">
                {filteredRuns.map((run, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold font-mono">{run.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {run.experiment} • Started: {new Date(run.startTime).toLocaleString()}
                          {run.duration && ` • Duration: ${Math.floor(run.duration / 60)}m ${run.duration % 60}s`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(run.status)}
                        {run.status === 'running' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateRunStatus(run.id, 'killed')}
                          >
                            <Pause className="h-4 w-4 mr-2" />
                            Stop
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRun(selectedRun === run.id ? '' : run.id)}
                        >
                          {selectedRun === run.id ? 'Hide' : 'View'}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeRun(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {selectedRun === run.id && (
                      <div className="pt-3 border-t space-y-4">
                        {/* Metrics */}
                        {run.metrics && run.metrics.length > 0 && (
                          <div className="space-y-2">
                            <Label>Metrics</Label>
                            <div className="grid grid-cols-3 gap-2">
                              {run.metrics.map((metric, metricIdx) => (
                                <div key={metricIdx} className="p-2 border rounded bg-muted/50">
                                  <div className="text-xs text-muted-foreground">{metric.key}</div>
                                  <div className="font-semibold">{metric.value.toFixed(4)}</div>
                                  {metric.step !== undefined && (
                                    <div className="text-xs text-muted-foreground">Step: {metric.step}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Parameters */}
                        {run.parameters && run.parameters.length > 0 && (
                          <div className="space-y-2">
                            <Label>Parameters</Label>
                            <div className="grid grid-cols-3 gap-2">
                              {run.parameters.map((param, paramIdx) => (
                                <div key={paramIdx} className="p-2 border rounded bg-muted/50">
                                  <div className="text-xs text-muted-foreground">{param.key}</div>
                                  <div className="font-mono text-sm">{param.value}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Tags */}
                        {run.tags && Object.keys(run.tags).length > 0 && (
                          <div className="space-y-2">
                            <Label>Tags</Label>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(run.tags).map(([key, value]) => (
                                <Badge key={key} variant="outline" className="text-xs">
                                  {key}: {value}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Artifacts */}
                        {run.artifacts && run.artifacts.length > 0 && (
                          <div className="space-y-2">
                            <Label>Artifacts</Label>
                            <div className="flex flex-wrap gap-1">
                              {run.artifacts.map((artifact, artifactIdx) => (
                                <Badge key={artifactIdx} variant="secondary" className="text-xs">
                                  <FileText className="h-3 w-3 mr-1" />
                                  {artifact}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Register Model */}
                        {run.status === 'finished' && enableModelRegistry && (
                          <div className="pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addModel(run.id)}
                            >
                              <Package className="h-4 w-4 mr-2" />
                              Register Model
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Models Tab */}
          <TabsContent value="models" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Model Registry</CardTitle>
                <CardDescription>Registered models and versions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {models.map((model, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold">{model.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Version {model.version} • Run: {model.runId}
                          {model.registeredAt && ` • Registered: ${new Date(model.registeredAt).toLocaleDateString()}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={model.stage}
                          onValueChange={(value) => updateModelStage(index, value as Model['stage'])}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="None">None</SelectItem>
                            <SelectItem value="Staging">Staging</SelectItem>
                            <SelectItem value="Production">Production</SelectItem>
                            <SelectItem value="Archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" onClick={() => removeModel(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {model.description && (
                      <p className="text-sm text-muted-foreground">{model.description}</p>
                    )}
                    {model.tags && Object.keys(model.tags).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(model.tags).map(([key, value]) => (
                          <Badge key={key} variant="outline" className="text-xs">
                            {key}: {value}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Metrics Comparison</CardTitle>
                <CardDescription>Compare metrics across runs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {runs.filter(r => r.metrics && r.metrics.length > 0).map((run, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-3">
                    <div className="font-semibold font-mono text-sm">{run.name}</div>
                    <div className="grid grid-cols-4 gap-4">
                      {run.metrics?.map((metric, metricIdx) => (
                        <div key={metricIdx} className="space-y-2">
                          <div className="text-xs text-muted-foreground">{metric.key}</div>
                          <div className="text-2xl font-bold">{metric.value.toFixed(4)}</div>
                          {metric.step !== undefined && (
                            <div className="text-xs text-muted-foreground">Step {metric.step}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {runs.filter(r => r.metrics && r.metrics.length > 0).length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No metrics available. Start a run to see metrics.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


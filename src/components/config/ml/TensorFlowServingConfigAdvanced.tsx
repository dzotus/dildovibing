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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Play,
  Brain,
  CheckCircle,
  XCircle,
  Zap,
  Database,
  Cpu
} from 'lucide-react';

interface TensorFlowServingConfigProps {
  componentId: string;
}

interface Model {
  name: string;
  version: string;
  status: 'serving' | 'loading' | 'unavailable';
  platform: string;
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

interface TensorFlowServingConfig {
  models?: Model[];
  predictions?: Prediction[];
  endpoint?: string;
  totalModels?: number;
  totalPredictions?: number;
  averageLatency?: number;
}

export function TensorFlowServingConfigAdvanced({ componentId }: TensorFlowServingConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as TensorFlowServingConfig;
  const models = config.models || [];
  const predictions = config.predictions || [];
  const endpoint = config.endpoint || 'localhost:8501';
  const totalModels = config.totalModels || models.length;
  const totalPredictions = config.totalPredictions || predictions.length;
  const averageLatency = config.averageLatency || (models.length > 0 ? models.reduce((sum, m) => sum + (m.avgLatency || 0), 0) / models.length : 0);

  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');

  const updateConfig = (updates: Partial<TensorFlowServingConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const executePrediction = () => {
    if (!selectedModel || !selectedVersion) return;
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
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'serving':
        return 'bg-green-500';
      case 'loading':
        return 'bg-yellow-500';
      case 'unavailable':
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
            <p className="text-xs uppercase text-muted-foreground tracking-wide">TensorFlow Serving</p>
            <h2 className="text-2xl font-bold text-foreground">Model Serving</h2>
            <p className="text-sm text-muted-foreground mt-1">
              High-performance serving system for machine learning models
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-4 gap-4">
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
                <span className="text-xs text-muted-foreground">serving</span>
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
          <TabsList>
            <TabsTrigger value="test">
              <Play className="h-4 w-4 mr-2" />
              Test Prediction
            </TabsTrigger>
            <TabsTrigger value="models">
              <Brain className="h-4 w-4 mr-2" />
              Models ({models.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              <Activity className="h-4 w-4 mr-2" />
              Prediction History ({predictions.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
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
                      placeholder='{ "instances": [...] }'
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
                <CardTitle>Models</CardTitle>
                <CardDescription>Deployed TensorFlow models</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {models.map((model) => (
                    <Card key={`${model.name}-${model.version}`} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${getStatusColor(model.status)}/20`}>
                            <Brain className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <CardTitle className="text-lg font-semibold">{model.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className={getStatusColor(model.status)}>
                                {model.status}
                              </Badge>
                              <Badge variant="outline">v{model.version}</Badge>
                              <Badge variant="outline">{model.platform}</Badge>
                              {model.requests && (
                                <Badge variant="outline">{model.requests} requests</Badge>
                              )}
                            </div>
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
                            <span className="ml-2 font-semibold">{model.avgLatency}ms</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
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
                <div className="flex items-center justify-between">
                  <Label>Enable GPU</Label>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Batching</Label>
                  <Switch defaultChecked />
                </div>
                <div className="space-y-2">
                  <Label>Batch Size</Label>
                  <Input type="number" defaultValue={32} min={1} />
                </div>
                <div className="space-y-2">
                  <Label>Max Batch Wait Time (ms)</Label>
                  <Input type="number" defaultValue={100} min={1} />
                </div>
                <div className="space-y-2">
                  <Label>Model Base Path</Label>
                  <Input defaultValue="/models" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


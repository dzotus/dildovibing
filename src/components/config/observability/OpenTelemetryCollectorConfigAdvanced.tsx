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
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Network,
  ArrowRightLeft,
  Database,
  Zap,
  Layers
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface OpenTelemetryCollectorConfigProps {
  componentId: string;
}

interface Receiver {
  id: string;
  type: 'otlp' | 'prometheus' | 'jaeger' | 'zipkin' | 'kafka' | 'filelog';
  enabled: boolean;
  endpoint?: string;
  config?: Record<string, any>;
}

interface Processor {
  id: string;
  type: 'batch' | 'memory_limiter' | 'filter' | 'transform' | 'resource' | 'attributes';
  enabled: boolean;
  config?: Record<string, any>;
}

interface Exporter {
  id: string;
  type: 'otlp' | 'prometheus' | 'jaeger' | 'zipkin' | 'logging' | 'file';
  enabled: boolean;
  endpoint?: string;
  config?: Record<string, any>;
}

interface Pipeline {
  id: string;
  name: string;
  type: 'traces' | 'metrics' | 'logs';
  receivers: string[];
  processors: string[];
  exporters: string[];
}

interface OpenTelemetryCollectorConfig {
  receivers?: Receiver[];
  processors?: Processor[];
  exporters?: Exporter[];
  pipelines?: Pipeline[];
  metricsReceived?: number;
  tracesReceived?: number;
  logsReceived?: number;
  metricsExported?: number;
  tracesExported?: number;
  logsExported?: number;
}

export function OpenTelemetryCollectorConfigAdvanced({ componentId }: OpenTelemetryCollectorConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as OpenTelemetryCollectorConfig;
  const receivers = config.receivers || [
    { id: '1', type: 'otlp', enabled: true, endpoint: '0.0.0.0:4317' },
    { id: '2', type: 'prometheus', enabled: true, endpoint: '0.0.0.0:8888' },
  ];
  const processors = config.processors || [
    { id: '1', type: 'batch', enabled: true, config: { timeout: '1s', send_batch_size: 8192 } },
    { id: '2', type: 'memory_limiter', enabled: true, config: { limit_mib: 512 } },
  ];
  const exporters = config.exporters || [
    { id: '1', type: 'otlp', enabled: true, endpoint: 'http://backend:4317' },
    { id: '2', type: 'prometheus', enabled: true, endpoint: 'http://prometheus:9090' },
  ];
  const pipelines = config.pipelines || [
    {
      id: '1',
      name: 'traces-pipeline',
      type: 'traces',
      receivers: ['1'],
      processors: ['1', '2'],
      exporters: ['1'],
    },
    {
      id: '2',
      name: 'metrics-pipeline',
      type: 'metrics',
      receivers: ['2'],
      processors: ['1'],
      exporters: ['2'],
    },
  ];
  const metricsReceived = config.metricsReceived || 0;
  const tracesReceived = config.tracesReceived || 0;
  const logsReceived = config.logsReceived || 0;
  const metricsExported = config.metricsExported || 0;
  const tracesExported = config.tracesExported || 0;
  const logsExported = config.logsExported || 0;

  const [editingReceiverIndex, setEditingReceiverIndex] = useState<number | null>(null);
  const [editingProcessorIndex, setEditingProcessorIndex] = useState<number | null>(null);
  const [editingExporterIndex, setEditingExporterIndex] = useState<number | null>(null);
  const [showCreatePipeline, setShowCreatePipeline] = useState(false);

  const updateConfig = (updates: Partial<OpenTelemetryCollectorConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addReceiver = () => {
    const newReceiver: Receiver = {
      id: `rec-${Date.now()}`,
      type: 'otlp',
      enabled: true,
      endpoint: '0.0.0.0:4317',
    };
    updateConfig({ receivers: [...receivers, newReceiver] });
  };

  const removeReceiver = (id: string) => {
    updateConfig({ receivers: receivers.filter((r) => r.id !== id) });
  };

  const updateReceiver = (id: string, field: string, value: any) => {
    const newReceivers = receivers.map((r) =>
      r.id === id ? { ...r, [field]: value } : r
    );
    updateConfig({ receivers: newReceivers });
  };

  const addProcessor = () => {
    const newProcessor: Processor = {
      id: `proc-${Date.now()}`,
      type: 'batch',
      enabled: true,
      config: {},
    };
    updateConfig({ processors: [...processors, newProcessor] });
  };

  const removeProcessor = (id: string) => {
    updateConfig({ processors: processors.filter((p) => p.id !== id) });
  };

  const updateProcessor = (id: string, field: string, value: any) => {
    const newProcessors = processors.map((p) =>
      p.id === id ? { ...p, [field]: value } : p
    );
    updateConfig({ processors: newProcessors });
  };

  const addExporter = () => {
    const newExporter: Exporter = {
      id: `exp-${Date.now()}`,
      type: 'otlp',
      enabled: true,
      endpoint: 'http://backend:4317',
    };
    updateConfig({ exporters: [...exporters, newExporter] });
  };

  const removeExporter = (id: string) => {
    updateConfig({ exporters: exporters.filter((e) => e.id !== id) });
  };

  const updateExporter = (id: string, field: string, value: any) => {
    const newExporters = exporters.map((e) =>
      e.id === id ? { ...e, [field]: value } : e
    );
    updateConfig({ exporters: newExporters });
  };

  const addPipeline = () => {
    const newPipeline: Pipeline = {
      id: `pipe-${Date.now()}`,
      name: 'new-pipeline',
      type: 'traces',
      receivers: [],
      processors: [],
      exporters: [],
    };
    updateConfig({ pipelines: [...pipelines, newPipeline] });
    setShowCreatePipeline(false);
  };

  const removePipeline = (id: string) => {
    updateConfig({ pipelines: pipelines.filter((p) => p.id !== id) });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">OpenTelemetry Collector</p>
            <h2 className="text-2xl font-bold text-foreground">Telemetry Pipeline</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure receivers, processors, exporters and pipelines
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

        <div className="grid grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Metrics Received</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{metricsReceived.toLocaleString()}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Traces Received</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{tracesReceived.toLocaleString()}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Logs Received</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{logsReceived.toLocaleString()}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Metrics Exported</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{metricsExported.toLocaleString()}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Traces Exported</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{tracesExported.toLocaleString()}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Logs Exported</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{logsExported.toLocaleString()}</span>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pipelines" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pipelines">
              <Layers className="h-4 w-4 mr-2" />
              Pipelines ({pipelines.length})
            </TabsTrigger>
            <TabsTrigger value="receivers">
              <Network className="h-4 w-4 mr-2" />
              Receivers ({receivers.length})
            </TabsTrigger>
            <TabsTrigger value="processors">
              <Zap className="h-4 w-4 mr-2" />
              Processors ({processors.length})
            </TabsTrigger>
            <TabsTrigger value="exporters">
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Exporters ({exporters.length})
            </TabsTrigger>
            <TabsTrigger value="monitoring">
              <Activity className="h-4 w-4 mr-2" />
              Monitoring
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pipelines" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Pipelines</CardTitle>
                    <CardDescription>Configure telemetry data pipelines</CardDescription>
                  </div>
                  <Button onClick={addPipeline} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Pipeline
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pipelines.map((pipeline) => (
                    <Card key={pipeline.id} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">{pipeline.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline">{pipeline.type}</Badge>
                              <Badge variant="outline">
                                {pipeline.receivers.length} receivers
                              </Badge>
                              <Badge variant="outline">
                                {pipeline.processors.length} processors
                              </Badge>
                              <Badge variant="outline">
                                {pipeline.exporters.length} exporters
                              </Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removePipeline(pipeline.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Pipeline Type</Label>
                            <Select
                              value={pipeline.type}
                              onValueChange={(value: 'traces' | 'metrics' | 'logs') => {
                                const newPipelines = pipelines.map((p) =>
                                  p.id === pipeline.id ? { ...p, type: value } : p
                                );
                                updateConfig({ pipelines: newPipelines });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="traces">Traces</SelectItem>
                                <SelectItem value="metrics">Metrics</SelectItem>
                                <SelectItem value="logs">Logs</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Receivers</Label>
                          <div className="flex flex-wrap gap-2">
                            {receivers
                              .filter((r) => pipeline.receivers.includes(r.id))
                              .map((r) => (
                                <Badge key={r.id} variant="outline">{r.type}</Badge>
                              ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Processors</Label>
                          <div className="flex flex-wrap gap-2">
                            {processors
                              .filter((p) => pipeline.processors.includes(p.id))
                              .map((p) => (
                                <Badge key={p.id} variant="outline">{p.type}</Badge>
                              ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Exporters</Label>
                          <div className="flex flex-wrap gap-2">
                            {exporters
                              .filter((e) => pipeline.exporters.includes(e.id))
                              .map((e) => (
                                <Badge key={e.id} variant="outline">{e.type}</Badge>
                              ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receivers" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Receivers</CardTitle>
                    <CardDescription>Configure data collection receivers</CardDescription>
                  </div>
                  <Button onClick={addReceiver} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Receiver
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {receivers.map((receiver) => (
                    <Card key={receiver.id} className="border-l-4 border-l-green-500">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{receiver.type}</Badge>
                              {receiver.enabled ? (
                                <Badge variant="default">Enabled</Badge>
                              ) : (
                                <Badge variant="outline">Disabled</Badge>
                              )}
                              {receiver.endpoint && (
                                <Badge variant="outline">{receiver.endpoint}</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={receiver.enabled}
                              onCheckedChange={(checked) => updateReceiver(receiver.id, 'enabled', checked)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeReceiver(receiver.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="processors" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Processors</CardTitle>
                    <CardDescription>Configure data transformation processors</CardDescription>
                  </div>
                  <Button onClick={addProcessor} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Processor
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {processors.map((processor) => (
                    <Card key={processor.id} className="border-l-4 border-l-purple-500">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{processor.type}</Badge>
                              {processor.enabled ? (
                                <Badge variant="default">Enabled</Badge>
                              ) : (
                                <Badge variant="outline">Disabled</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={processor.enabled}
                              onCheckedChange={(checked) => updateProcessor(processor.id, 'enabled', checked)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeProcessor(processor.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exporters" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Exporters</CardTitle>
                    <CardDescription>Configure data export destinations</CardDescription>
                  </div>
                  <Button onClick={addExporter} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Exporter
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {exporters.map((exporter) => (
                    <Card key={exporter.id} className="border-l-4 border-l-orange-500">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{exporter.type}</Badge>
                              {exporter.enabled ? (
                                <Badge variant="default">Enabled</Badge>
                              ) : (
                                <Badge variant="outline">Disabled</Badge>
                              )}
                              {exporter.endpoint && (
                                <Badge variant="outline">{exporter.endpoint}</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={exporter.enabled}
                              onCheckedChange={(checked) => updateExporter(exporter.id, 'enabled', checked)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeExporter(exporter.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pipeline Monitoring</CardTitle>
                <CardDescription>Monitor telemetry data flow</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Metrics Received</p>
                      <p className="text-2xl font-bold">{metricsReceived.toLocaleString()}</p>
                      <Progress
                        value={Math.min((metricsReceived / 1000000) * 100, 100)}
                        className="h-2 mt-2"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Traces Received</p>
                      <p className="text-2xl font-bold">{tracesReceived.toLocaleString()}</p>
                      <Progress
                        value={Math.min((tracesReceived / 100000) * 100, 100)}
                        className="h-2 mt-2"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Logs Received</p>
                      <p className="text-2xl font-bold">{logsReceived.toLocaleString()}</p>
                      <Progress
                        value={Math.min((logsReceived / 1000000) * 100, 100)}
                        className="h-2 mt-2"
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Metrics Exported</p>
                      <p className="text-2xl font-bold">{metricsExported.toLocaleString()}</p>
                      <Progress
                        value={Math.min((metricsExported / 1000000) * 100, 100)}
                        className="h-2 mt-2"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Traces Exported</p>
                      <p className="text-2xl font-bold">{tracesExported.toLocaleString()}</p>
                      <Progress
                        value={Math.min((tracesExported / 100000) * 100, 100)}
                        className="h-2 mt-2"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Logs Exported</p>
                      <p className="text-2xl font-bold">{logsExported.toLocaleString()}</p>
                      <Progress
                        value={Math.min((logsExported / 1000000) * 100, 100)}
                        className="h-2 mt-2"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


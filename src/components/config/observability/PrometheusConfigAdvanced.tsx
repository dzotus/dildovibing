import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { Activity, CloudUpload, HardDrive, AlertTriangle, Plus, Trash2, FileText, Search, Settings, Edit } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showError } from '@/utils/toast';
import { PageTitle, Description } from '@/components/ui/typography';

interface PrometheusConfigProps {
  componentId: string;
}

interface ScrapeTarget {
  job: string;
  endpoint: string;
  interval: string;
  metricsPath?: string;
  scrapeTimeout?: string;
  labels?: Record<string, string>;
  status?: 'up' | 'down';
}

interface RemoteWriteEndpoint {
  url: string;
  auth?: string;
}

interface AlertingRule {
  name: string;
  expr: string;
  for?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  severity?: 'critical' | 'warning' | 'info';
}

interface RecordingRule {
  name: string;
  expr: string;
  labels?: Record<string, string>;
}

interface ServiceDiscovery {
  type: 'kubernetes' | 'consul' | 'static' | 'file' | 'dns';
  config: Record<string, any>;
}

interface PrometheusConfig {
  scrapeInterval?: string;
  evaluationInterval?: string;
  retentionTime?: string;
  storagePath?: string;
  enableRemoteWrite?: boolean;
  remoteWrite?: RemoteWriteEndpoint[];
  alertmanagerUrl?: string;
  enableAlertmanager?: boolean;
  targets?: ScrapeTarget[];
  alertingRules?: AlertingRule[];
  recordingRules?: RecordingRule[];
  serviceDiscovery?: ServiceDiscovery[];
}

export function PrometheusConfigAdvanced({ componentId }: PrometheusConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) {
    return <div className="p-4 text-muted-foreground">Component not found</div>;
  }

  const config = (node.data.config as any) || ({} as PrometheusConfig);
  const scrapeInterval = config.scrapeInterval || '15s';
  const evaluationInterval = config.evaluationInterval || '15s';
  const retentionTime = config.retentionTime || '15d';
  const storagePath = config.storagePath || '/prometheus';
  const enableRemoteWrite = config.enableRemoteWrite ?? false;
  const remoteWrite = config.remoteWrite || [{ url: 'https://remote-metrics.example.com/api/v1/write' }];
  const enableAlertmanager = config.enableAlertmanager ?? true;
  const alertmanagerUrl = config.alertmanagerUrl || 'http://alertmanager:9093';
  const targets = config.targets || [
    { job: 'kubernetes-nodes', endpoint: 'https://kube-nodes:9100', interval: '30s', status: 'up' },
    { job: 'istio-mesh', endpoint: 'http://istio-telemetry:15014', interval: '15s', status: 'up' },
    { job: 'custom-app', endpoint: 'http://app:8080/metrics', interval: '10s', status: 'down' },
  ];
  const alertingRules = config.alertingRules || [
    {
      name: 'HighCPUUsage',
      expr: 'rate(process_cpu_seconds_total[5m]) > 0.8',
      for: '5m',
      labels: { severity: 'warning' },
      annotations: { summary: 'High CPU usage detected', description: 'CPU usage is above 80%' },
      severity: 'warning'
    },
    {
      name: 'InstanceDown',
      expr: 'up == 0',
      for: '1m',
      labels: { severity: 'critical' },
      annotations: { summary: 'Instance is down', description: 'Target instance is not responding' },
      severity: 'critical'
    }
  ];
  const recordingRules = config.recordingRules || [
    {
      name: 'cpu:usage:rate5m',
      expr: 'rate(process_cpu_seconds_total[5m])',
      labels: { job: 'node-exporter' }
    }
  ];
  const serviceDiscovery = config.serviceDiscovery || [
    { type: 'kubernetes', config: { role: 'pod', namespaces: { names: ['default', 'production'] } } },
    { type: 'consul', config: { server: 'consul:8500', services: ['web', 'api'] } }
  ];

  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [editingRecordingRuleIndex, setEditingRecordingRuleIndex] = useState<number | null>(null);
  const [showCreateAlertRule, setShowCreateAlertRule] = useState(false);
  const [showCreateRecordingRule, setShowCreateRecordingRule] = useState(false);
  const [showCreateServiceDiscovery, setShowCreateServiceDiscovery] = useState(false);

  const updateConfig = (updates: Partial<PrometheusConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addTarget = () => {
    updateConfig({
      targets: [
        ...targets,
        { job: 'new-job', endpoint: 'http://service:port/metrics', interval: scrapeInterval, status: 'up' },
      ],
    });
  };

  const removeTarget = (index: number) => {
    updateConfig({ targets: targets.filter((_, i) => i !== index) });
  };

  const updateTarget = (index: number, field: keyof ScrapeTarget, value: string) => {
    const updated = [...targets];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ targets: updated });
  };

  const addRemoteWrite = () => {
    updateConfig({
      remoteWrite: [...remoteWrite, { url: 'https://remote-storage.example.com/write' }],
    });
  };

  const removeRemoteWrite = (index: number) => {
    updateConfig({ remoteWrite: remoteWrite.filter((_, i) => i !== index) });
  };

  const updateRemoteWrite = (index: number, value: RemoteWriteEndpoint) => {
    const updated = [...remoteWrite];
    updated[index] = value;
    updateConfig({ remoteWrite: updated });
  };

  const addAlertingRule = () => {
    const newRule: AlertingRule = {
      name: 'New Alert Rule',
      expr: 'up == 0',
      for: '5m',
      labels: {},
      annotations: {},
      severity: 'warning'
    };
    updateConfig({ alertingRules: [...alertingRules, newRule] });
    setShowCreateAlertRule(false);
  };

  const removeAlertingRule = (index: number) => {
    updateConfig({ alertingRules: alertingRules.filter((_, i) => i !== index) });
  };

  const updateAlertingRule = (index: number, field: keyof AlertingRule, value: any) => {
    const updated = [...alertingRules];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ alertingRules: updated });
  };

  const addRecordingRule = () => {
    const newRule: RecordingRule = {
      name: 'new:metric:name',
      expr: 'rate(metric_name[5m])',
      labels: {}
    };
    updateConfig({ recordingRules: [...recordingRules, newRule] });
    setShowCreateRecordingRule(false);
  };

  const removeRecordingRule = (index: number) => {
    updateConfig({ recordingRules: recordingRules.filter((_, i) => i !== index) });
  };

  const updateRecordingRule = (index: number, field: keyof RecordingRule, value: any) => {
    const updated = [...recordingRules];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ recordingRules: updated });
  };

  const addServiceDiscovery = () => {
    const newSD: ServiceDiscovery = {
      type: 'static',
      config: {}
    };
    updateConfig({ serviceDiscovery: [...serviceDiscovery, newSD] });
    setShowCreateServiceDiscovery(false);
  };

  const removeServiceDiscovery = (index: number) => {
    updateConfig({ serviceDiscovery: serviceDiscovery.filter((_, i) => i !== index) });
  };

  const updateServiceDiscovery = (index: number, field: keyof ServiceDiscovery, value: any) => {
    const updated = [...serviceDiscovery];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ serviceDiscovery: updated });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div>
              <PageTitle>Prometheus</PageTitle>
              <Description>Metrics collection & rule evaluation</Description>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">v2.48.0</Badge>
            <Badge variant="secondary" className="gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Healthy
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Tabs */}
        <Tabs defaultValue="scraping" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="scraping" className="gap-2">
              <Activity className="h-4 w-4" />
              Scraping
            </TabsTrigger>
            <TabsTrigger value="service-discovery" className="gap-2">
              <Search className="h-4 w-4" />
              Service Discovery
            </TabsTrigger>
            <TabsTrigger value="alerting-rules" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alerting Rules
            </TabsTrigger>
            <TabsTrigger value="recording-rules" className="gap-2">
              <FileText className="h-4 w-4" />
              Recording Rules
            </TabsTrigger>
            <TabsTrigger value="storage" className="gap-2">
              <HardDrive className="h-4 w-4" />
              Storage
            </TabsTrigger>
            <TabsTrigger value="remote" className="gap-2">
              <CloudUpload className="h-4 w-4" />
              Remote Write
            </TabsTrigger>
          </TabsList>

          {/* Scraping Tab */}
          <TabsContent value="scraping" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Global Settings</CardTitle>
                <CardDescription>Intervals for scraping targets and evaluating rules</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Scrape Interval</Label>
                  <Input
                    value={scrapeInterval}
                    onChange={(e) => updateConfig({ scrapeInterval: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Evaluation Interval</Label>
                  <Input
                    value={evaluationInterval}
                    onChange={(e) => updateConfig({ evaluationInterval: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Retention Time</Label>
                  <Input value={retentionTime} onChange={(e) => updateConfig({ retentionTime: e.target.value })} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Scrape Targets</CardTitle>
                  <CardDescription>Endpoints Prometheus scrapes for metrics</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={addTarget}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Target
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {targets.map((target, index) => (
                  <div key={`${target.job}-${index}`} className="p-4 border border-border rounded-lg bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Input
                          value={target.job}
                          className="font-semibold"
                          onChange={(e) => updateTarget(index, 'job', e.target.value)}
                        />
                        <div className="text-xs text-muted-foreground">Job Name</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={target.status === 'up' ? 'secondary' : 'destructive'}>
                          {target.status === 'up' ? 'UP' : 'DOWN'}
                        </Badge>
                        <Button variant="ghost" size="icon" onClick={() => removeTarget(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Endpoint</Label>
                      <Input
                        value={target.endpoint}
                        onChange={(e) => updateTarget(index, 'endpoint', e.target.value)}
                        placeholder="http://service:port/metrics"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Scrape Interval</Label>
                      <Input
                        value={target.interval}
                        onChange={(e) => updateTarget(index, 'interval', e.target.value)}
                        placeholder="15s"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Storage Tab */}
          <TabsContent value="storage" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Local Storage</CardTitle>
                <CardDescription>TSDB configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Storage Path</Label>
                  <Input value={storagePath} onChange={(e) => updateConfig({ storagePath: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Compaction Log</Label>
                  <Textarea
                    className="font-mono text-xs"
                    rows={4}
                    value={`level=info ts=${Date.now()} caller=compact.go:516 msg="compact blocks" count=3 mint=0 maxt=3600000`}
                    readOnly
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Remote Write Tab */}
          <TabsContent value="remote" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Remote Write</CardTitle>
                  <CardDescription>Ship metrics to long-term storage</CardDescription>
                </div>
                <Switch
                  checked={enableRemoteWrite}
                  onCheckedChange={(checked) => updateConfig({ enableRemoteWrite: checked })}
                />
              </CardHeader>
              {enableRemoteWrite && (
                <CardContent className="space-y-4">
                  {remoteWrite.map((endpoint, index) => (
                    <div key={index} className="p-4 border border-border rounded-lg space-y-3 bg-card">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-sm">Endpoint #{index + 1}</div>
                        <Button variant="ghost" size="icon" onClick={() => removeRemoteWrite(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label>Remote URL</Label>
                        <Input
                          value={endpoint.url}
                          onChange={(e) => updateRemoteWrite(index, { ...endpoint, url: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Authorization Header</Label>
                        <Input
                          placeholder="Bearer ..."
                          value={endpoint.auth || ''}
                          onChange={(e) => updateRemoteWrite(index, { ...endpoint, auth: e.target.value })}
                        />
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addRemoteWrite} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Endpoint
                  </Button>
                </CardContent>
              )}
            </Card>
          </TabsContent>

          {/* Service Discovery Tab */}
          <TabsContent value="service-discovery" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Service Discovery</CardTitle>
                  <CardDescription>Configure automatic target discovery</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={addServiceDiscovery}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service Discovery
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {serviceDiscovery.map((sd, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Select
                          value={sd.type}
                          onValueChange={(value) => updateServiceDiscovery(index, 'type', value)}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="kubernetes">Kubernetes</SelectItem>
                            <SelectItem value="consul">Consul</SelectItem>
                            <SelectItem value="static">Static</SelectItem>
                            <SelectItem value="file">File</SelectItem>
                            <SelectItem value="dns">DNS</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="text-xs text-muted-foreground">Discovery Type</div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeServiceDiscovery(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label>Configuration (JSON)</Label>
                      <Textarea
                        className="font-mono text-xs"
                        rows={4}
                        value={JSON.stringify(sd.config, null, 2)}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value);
                            updateServiceDiscovery(index, 'config', parsed);
                          } catch (error) {
                            showError(`Неверный формат JSON: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
                          }
                        }}
                        placeholder='{"role": "pod", "namespaces": {"names": ["default"]}}'
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alerting Rules Tab */}
          <TabsContent value="alerting-rules" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Alerting Rules</CardTitle>
                  <CardDescription>Define PromQL expressions that trigger alerts</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowCreateAlertRule(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Alert Rule
                </Button>
              </CardHeader>
              {showCreateAlertRule && (
                <CardContent className="border-b pb-4 mb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Rule Name</Label>
                      <Input placeholder="HighCPUUsage" />
                    </div>
                    <div className="space-y-2">
                      <Label>PromQL Expression</Label>
                      <Textarea
                        className="font-mono text-sm"
                        rows={2}
                        placeholder="rate(process_cpu_seconds_total[5m]) > 0.8"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addAlertingRule}>Create Rule</Button>
                      <Button variant="outline" onClick={() => setShowCreateAlertRule(false)}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-3">
                {alertingRules.map((rule, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold">{rule.name}</div>
                        <Badge variant={rule.severity === 'critical' ? 'destructive' : rule.severity === 'warning' ? 'default' : 'secondary'}>
                          {rule.severity || 'info'}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeAlertingRule(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label>PromQL Expression</Label>
                      <Textarea
                        className="font-mono text-xs"
                        rows={2}
                        value={rule.expr}
                        onChange={(e) => updateAlertingRule(index, 'expr', e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>For Duration</Label>
                        <Input
                          value={rule.for || ''}
                          onChange={(e) => updateAlertingRule(index, 'for', e.target.value)}
                          placeholder="5m"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Severity</Label>
                        <Select
                          value={rule.severity || 'warning'}
                          onValueChange={(value) => updateAlertingRule(index, 'severity', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="critical">Critical</SelectItem>
                            <SelectItem value="warning">Warning</SelectItem>
                            <SelectItem value="info">Info</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Labels (JSON)</Label>
                      <Textarea
                        className="font-mono text-xs"
                        rows={2}
                        value={JSON.stringify(rule.labels || {}, null, 2)}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value);
                            updateAlertingRule(index, 'labels', parsed);
                          } catch (error) {
                            showError(`Неверный формат JSON: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
                          }
                        }}
                        placeholder='{"severity": "warning"}'
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Annotations (JSON)</Label>
                      <Textarea
                        className="font-mono text-xs"
                        rows={2}
                        value={JSON.stringify(rule.annotations || {}, null, 2)}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value);
                            updateAlertingRule(index, 'annotations', parsed);
                          } catch (error) {
                            showError(`Неверный формат JSON: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
                          }
                        }}
                        placeholder='{"summary": "Alert summary", "description": "Alert description"}'
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Alertmanager Integration</CardTitle>
                <CardDescription>Configure alert notifications pipeline</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Enable Alertmanager</Label>
                    <p className="text-sm text-muted-foreground">Forward firing alerts to Alertmanager</p>
                  </div>
                  <Switch
                    checked={enableAlertmanager}
                    onCheckedChange={(checked) => updateConfig({ enableAlertmanager: checked })}
                  />
                </div>
                {enableAlertmanager && (
                  <div className="space-y-2">
                    <Label>Alertmanager URL</Label>
                    <Input value={alertmanagerUrl} onChange={(e) => updateConfig({ alertmanagerUrl: e.target.value })} />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recording Rules Tab */}
          <TabsContent value="recording-rules" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Recording Rules</CardTitle>
                  <CardDescription>Pre-compute frequently used or expensive queries</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowCreateRecordingRule(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Recording Rule
                </Button>
              </CardHeader>
              {showCreateRecordingRule && (
                <CardContent className="border-b pb-4 mb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Rule Name</Label>
                      <Input placeholder="cpu:usage:rate5m" />
                    </div>
                    <div className="space-y-2">
                      <Label>PromQL Expression</Label>
                      <Textarea
                        className="font-mono text-sm"
                        rows={2}
                        placeholder="rate(process_cpu_seconds_total[5m])"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addRecordingRule}>Create Rule</Button>
                      <Button variant="outline" onClick={() => setShowCreateRecordingRule(false)}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-3">
                {recordingRules.map((rule, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold font-mono">{rule.name}</div>
                      <Button variant="ghost" size="icon" onClick={() => removeRecordingRule(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label>PromQL Expression</Label>
                      <Textarea
                        className="font-mono text-xs"
                        rows={2}
                        value={rule.expr}
                        onChange={(e) => updateRecordingRule(index, 'expr', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Labels (JSON)</Label>
                      <Textarea
                        className="font-mono text-xs"
                        rows={2}
                        value={JSON.stringify(rule.labels || {}, null, 2)}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value);
                            updateRecordingRule(index, 'labels', parsed);
                          } catch (error) {
                            showError(`Неверный формат JSON: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
                          }
                        }}
                        placeholder='{"job": "node-exporter"}'
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


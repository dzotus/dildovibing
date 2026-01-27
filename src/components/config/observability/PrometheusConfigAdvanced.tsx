import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
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
import { Activity, CloudUpload, HardDrive, AlertTriangle, Plus, Trash2, FileText, Search, Settings, Edit, Download, Upload } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showError, showSuccess } from '@/utils/toast';
import { PageTitle, Description } from '@/components/ui/typography';
import { exportPrometheusConfig, exportAlertingRules, exportRecordingRules } from '@/utils/prometheusYamlExporter';
import { migrateConfigIfNeeded, needsMigration } from '@/utils/prometheusConfigMigrator';
import { PrometheusTargetsView } from './PrometheusTargetsView';

interface PrometheusConfigProps {
  componentId: string;
}

// Старый интерфейс для миграции (deprecated)
interface ScrapeTarget {
  job: string;
  endpoint: string;
  interval: string;
  metricsPath?: string;
  scrapeTimeout?: string;
  labels?: Record<string, string>;
  status?: 'up' | 'down';
}

// Новая структура, соответствующая реальному Prometheus формату
interface StaticConfig {
  targets: string[]; // ['host:port', ...] без протокола
  labels?: Record<string, string>;
}

interface ScrapeConfig {
  job_name: string;
  scrape_interval?: string;
  scrape_timeout?: string;
  metrics_path?: string;
  static_configs: StaticConfig[];
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
  version?: string;
  scrapeInterval?: string; // Global scrape interval
  evaluationInterval?: string;
  retentionTime?: string;
  storagePath?: string;
  enableRemoteWrite?: boolean;
  remoteWrite?: RemoteWriteEndpoint[];
  alertmanagerUrl?: string;
  enableAlertmanager?: boolean;
  // Новая структура (приоритет)
  scrape_configs?: ScrapeConfig[];
  // Старая структура (для миграции, deprecated)
  targets?: ScrapeTarget[];
  alertingRules?: AlertingRule[];
  recordingRules?: RecordingRule[];
  serviceDiscovery?: ServiceDiscovery[];
}

export function PrometheusConfigAdvanced({ componentId }: PrometheusConfigProps) {
  const { nodes, updateNode, connections } = useCanvasStore();
  const { getComponentMetrics, isRunning } = useEmulationStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) {
    return <div className="p-4 text-muted-foreground">Component not found</div>;
  }

  let config = (node.data.config as any) || ({} as PrometheusConfig);
  
  // Автоматическая миграция старой структуры в новую
  if (needsMigration(config)) {
    config = migrateConfigIfNeeded(config);
    // Сохраняем мигрированный конфиг
    updateNode(componentId, {
      data: {
        ...node.data,
        config,
      },
    });
  }
  
  const version = config.version || '2.48.0';
  const scrapeInterval = config.scrapeInterval || '15s';
  const evaluationInterval = config.evaluationInterval || '15s';
  const retentionTime = config.retentionTime || '15d';
  const storagePath = config.storagePath || '/prometheus';
  const enableRemoteWrite = config.enableRemoteWrite ?? false;
  const remoteWrite = config.remoteWrite || [];
  const enableAlertmanager = config.enableAlertmanager ?? true;
  const alertmanagerUrl = config.alertmanagerUrl || 'http://alertmanager:9093';
  const scrapeConfigs = config.scrape_configs || [];
  const alertingRules = config.alertingRules || [];
  const recordingRules = config.recordingRules || [];
  const serviceDiscovery = config.serviceDiscovery || [];

  // Вычисляем статус Prometheus на основе реальных данных
  const getPrometheusStatus = () => {
    // Если нет scrape_configs - статус "Idle"
    const totalTargets = scrapeConfigs.reduce((sum, sc) => 
      sum + (sc.static_configs?.reduce((s, stc) => s + (stc.targets?.length || 0), 0) || 0), 0
    );
    
    if (totalTargets === 0) {
      return { status: 'idle', label: 'Idle', color: 'bg-gray-500' };
    }

    // Если эмуляция работает, пытаемся получить реальные метрики
    if (isRunning) {
      const metrics = getComponentMetrics(componentId);
      if (metrics?.customMetrics) {
        const targetsUp = metrics.customMetrics.targets_up || 0;
        const targetsDown = metrics.customMetrics.targets_down || 0;
        const scrapeErrors = metrics.customMetrics.scrape_errors_total || 0;
        
        if (targetsDown > 0 || scrapeErrors > 0) {
          return { status: 'degraded', label: 'Degraded', color: 'bg-yellow-500' };
        }
        if (targetsUp > 0) {
          return { status: 'healthy', label: 'Healthy', color: 'bg-green-500' };
        }
      }
    }

    // Если эмуляция не работает, проверяем наличие конфигов
    // Есть конфиги, но неизвестен статус - показываем "Configured"
    return { status: 'configured', label: 'Configured', color: 'bg-blue-500' };
  };

  const prometheusStatus = getPrometheusStatus();

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

  // Функции управления scrape_configs
  const addScrapeConfig = () => {
    updateConfig({
      scrape_configs: [
        ...scrapeConfigs,
        {
          job_name: 'new-job',
          static_configs: [{
            targets: [],
          }],
        },
      ],
    });
  };

  const removeScrapeConfig = (index: number) => {
    updateConfig({ 
      scrape_configs: scrapeConfigs.filter((_, i) => i !== index) 
    });
  };

  const updateScrapeConfig = (index: number, field: keyof ScrapeConfig, value: any) => {
    const updated = [...scrapeConfigs];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ scrape_configs: updated });
  };

  const addStaticConfigToJob = (jobIndex: number) => {
    const updated = [...scrapeConfigs];
    const job = updated[jobIndex];
    updated[jobIndex] = {
      ...job,
      static_configs: [
        ...(job.static_configs || []),
        { targets: [] },
      ],
    };
    updateConfig({ scrape_configs: updated });
  };

  const removeStaticConfigFromJob = (jobIndex: number, configIndex: number) => {
    const updated = [...scrapeConfigs];
    const job = updated[jobIndex];
    updated[jobIndex] = {
      ...job,
      static_configs: job.static_configs.filter((_, i) => i !== configIndex),
    };
    updateConfig({ scrape_configs: updated });
  };

  const addTargetToStaticConfig = (jobIndex: number, configIndex: number, target: string) => {
    const updated = [...scrapeConfigs];
    const job = updated[jobIndex];
    const staticConfig = job.static_configs[configIndex];
    updated[jobIndex] = {
      ...job,
      static_configs: job.static_configs.map((sc, i) => 
        i === configIndex 
          ? { ...sc, targets: [...(sc.targets || []), target] }
          : sc
      ),
    };
    updateConfig({ scrape_configs: updated });
  };

  const removeTargetFromStaticConfig = (jobIndex: number, configIndex: number, targetIndex: number) => {
    const updated = [...scrapeConfigs];
    const job = updated[jobIndex];
    updated[jobIndex] = {
      ...job,
      static_configs: job.static_configs.map((sc, i) => 
        i === configIndex 
          ? { ...sc, targets: sc.targets.filter((_, ti) => ti !== targetIndex) }
          : sc
      ),
    };
    updateConfig({ scrape_configs: updated });
  };

  const updateTargetInStaticConfig = (jobIndex: number, configIndex: number, targetIndex: number, newTarget: string) => {
    const updated = [...scrapeConfigs];
    const job = updated[jobIndex];
    updated[jobIndex] = {
      ...job,
      static_configs: job.static_configs.map((sc, i) => 
        i === configIndex 
          ? { ...sc, targets: sc.targets.map((t, ti) => ti === targetIndex ? newTarget : t) }
          : sc
      ),
    };
    updateConfig({ scrape_configs: updated });
  };

  const updateStaticConfigLabels = (jobIndex: number, configIndex: number, labels: Record<string, string>) => {
    const updated = [...scrapeConfigs];
    const job = updated[jobIndex];
    updated[jobIndex] = {
      ...job,
      static_configs: job.static_configs.map((sc, i) => 
        i === configIndex 
          ? { ...sc, labels: Object.keys(labels).length > 0 ? labels : undefined }
          : sc
      ),
    };
    updateConfig({ scrape_configs: updated });
  };

  const addRemoteWrite = () => {
    updateConfig({
      remoteWrite: [...remoteWrite, { url: '' }],
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

  const exportConfig = () => {
    try {
      const prometheusYaml = exportPrometheusConfig(config);
      const alertingYaml = config.alertingRules && config.alertingRules.length > 0 
        ? exportAlertingRules(config.alertingRules)
        : '';
      const recordingYaml = config.recordingRules && config.recordingRules.length > 0
        ? exportRecordingRules(config.recordingRules)
        : '';

      // Создаем blob и скачиваем
      const blob = new Blob([prometheusYaml], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'prometheus.yml';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (alertingYaml) {
        const alertBlob = new Blob([alertingYaml], { type: 'text/yaml' });
        const alertUrl = URL.createObjectURL(alertBlob);
        const alertA = document.createElement('a');
        alertA.href = alertUrl;
        alertA.download = 'alerts.yml';
        document.body.appendChild(alertA);
        alertA.click();
        document.body.removeChild(alertA);
        URL.revokeObjectURL(alertUrl);
      }

      if (recordingYaml) {
        const recBlob = new Blob([recordingYaml], { type: 'text/yaml' });
        const recUrl = URL.createObjectURL(recBlob);
        const recA = document.createElement('a');
        recA.href = recUrl;
        recA.download = 'recording_rules.yml';
        document.body.appendChild(recA);
        recA.click();
        document.body.removeChild(recA);
        URL.revokeObjectURL(recUrl);
      }

      showSuccess('Configuration exported successfully');
    } catch (error) {
      showError(`Failed to export configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
            <Badge variant="secondary" className="gap-2">
              <div className={`h-2 w-2 rounded-full ${prometheusStatus.color} ${isRunning && prometheusStatus.status === 'healthy' ? 'animate-pulse' : ''}`} />
              {prometheusStatus.label}
            </Badge>
            <Button variant="outline" size="sm" onClick={exportConfig}>
              <Upload className="h-4 w-4 mr-2" />
              Export YAML
            </Button>
          </div>
        </div>

        <Separator />

        {/* Tabs */}
        <Tabs defaultValue="targets" className="w-full">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="targets" className="gap-2">
              <Activity className="h-4 w-4" />
              Targets
            </TabsTrigger>
            <TabsTrigger value="scraping" className="gap-2">
              <Settings className="h-4 w-4" />
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

          {/* Targets Tab */}
          <TabsContent value="targets" className="mt-4">
            <PrometheusTargetsView componentId={componentId} />
          </TabsContent>

          {/* Scraping Tab */}
          <TabsContent value="scraping" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Global Settings</CardTitle>
                <CardDescription>Intervals for scraping targets and evaluating rules</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Version</Label>
                  <Input
                    value={version}
                    onChange={(e) => updateConfig({ version: e.target.value })}
                    placeholder="2.48.0"
                  />
                </div>
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
                  <CardTitle>Scrape Configs</CardTitle>
                  <CardDescription>Scrape configurations for Prometheus (matches real Prometheus format)</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={addScrapeConfig}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Scrape Config
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {scrapeConfigs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No scrape configurations</p>
                    <p className="text-xs mt-2">Add scrape configs manually or connect components to automatically add them</p>
                  </div>
                )}
                {scrapeConfigs.map((scrapeConfig, jobIndex) => (
                  <div key={`${scrapeConfig.job_name}-${jobIndex}`} className="p-4 border border-border rounded-lg bg-card space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-2">
                        <div>
                          <Label>Job Name</Label>
                          <Input
                            value={scrapeConfig.job_name}
                            className="font-semibold"
                            onChange={(e) => updateScrapeConfig(jobIndex, 'job_name', e.target.value)}
                            placeholder="my-job"
                          />
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeScrapeConfig(jobIndex)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Scrape Interval</Label>
                        <Input
                          value={scrapeConfig.scrape_interval || scrapeInterval}
                          onChange={(e) => updateScrapeConfig(jobIndex, 'scrape_interval', e.target.value || undefined)}
                          placeholder={scrapeInterval}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Metrics Path</Label>
                        <Input
                          value={scrapeConfig.metrics_path || '/metrics'}
                          onChange={(e) => updateScrapeConfig(jobIndex, 'metrics_path', e.target.value || undefined)}
                          placeholder="/metrics"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Scrape Timeout</Label>
                        <Input
                          value={scrapeConfig.scrape_timeout || ''}
                          onChange={(e) => updateScrapeConfig(jobIndex, 'scrape_timeout', e.target.value || undefined)}
                          placeholder="10s"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Static Configs</Label>
                        <Button variant="outline" size="sm" onClick={() => addStaticConfigToJob(jobIndex)}>
                          <Plus className="h-3 w-3 mr-1" />
                          Add Static Config
                        </Button>
                      </div>
                      {scrapeConfig.static_configs.map((staticConfig, configIndex) => (
                        <div key={configIndex} className="p-3 border border-border rounded bg-muted/50 space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Static Config #{configIndex + 1}</Label>
                            {scrapeConfig.static_configs.length > 1 && (
                              <Button variant="ghost" size="icon" onClick={() => removeStaticConfigFromJob(jobIndex, configIndex)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-xs">Targets (host:port)</Label>
                            <div className="space-y-2">
                              {staticConfig.targets.map((target, targetIndex) => (
                                <div key={targetIndex} className="flex gap-2">
                                  <Input
                                    value={target}
                                    onChange={(e) => updateTargetInStaticConfig(jobIndex, configIndex, targetIndex, e.target.value)}
                                    placeholder="host:port"
                                  />
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => removeTargetFromStaticConfig(jobIndex, configIndex, targetIndex)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => addTargetToStaticConfig(jobIndex, configIndex, '')}
                                className="w-full"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Target
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs">Labels (JSON)</Label>
                            <Textarea
                              className="font-mono text-xs"
                              rows={2}
                              value={JSON.stringify(staticConfig.labels || {}, null, 2)}
                              onChange={(e) => {
                                try {
                                  const parsed = JSON.parse(e.target.value);
                                  updateStaticConfigLabels(jobIndex, configIndex, parsed);
                                } catch (error) {
                                  showError(`Неверный формат JSON: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
                                }
                              }}
                              placeholder='{"env": "prod", "region": "us-east-1"}'
                            />
                          </div>
                        </div>
                      ))}
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
                {serviceDiscovery.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No service discovery configured</p>
                    <p className="text-xs mt-2">Configure automatic target discovery for Kubernetes, Consul, etc.</p>
                  </div>
                )}
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
                {alertingRules.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No alerting rules configured</p>
                    <p className="text-xs mt-2">Create rules to monitor your system and trigger alerts</p>
                  </div>
                )}
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
                {recordingRules.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No recording rules configured</p>
                    <p className="text-xs mt-2">Create rules to pre-compute frequently used queries</p>
                  </div>
                )}
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


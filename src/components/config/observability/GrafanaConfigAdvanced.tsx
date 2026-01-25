import { useState } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { CanvasNode } from '@/types';
import { logError } from '@/utils/logger';
import { OBSERVABILITY_PROFILES } from './profiles';
import { GrafanaDashboardViewer } from './GrafanaDashboardViewer';
import { GrafanaDashboardPreview } from './GrafanaDashboardPreview';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  BarChart3,
  LineChart,
  PieChart,
  Gauge,
  Database,
  Settings,
  Plus,
  Trash2,
  Eye,
  Link as LinkIcon,
  Activity,
  AlertTriangle,
  Edit
} from 'lucide-react';

interface GrafanaConfigProps {
  componentId: string;
}

interface Panel {
  id: string;
  title: string;
  type: 'graph' | 'table' | 'stat' | 'gauge' | 'piechart' | 'bargraph';
  datasource: string;
  queries: Array<{
    refId: string;
    expr: string; // PromQL or LogQL query
    legendFormat?: string;
    step?: string;
  }>;
  gridPos: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  targets?: any[];
}

interface DashboardVariable {
  name: string;
  type: 'query' | 'custom' | 'constant';
  query?: string;
  current: {
    value: string;
    text: string;
  };
  options?: Array<{ value: string; text: string }>;
}

interface Dashboard {
  id: string;
  name: string;
  panels: Panel[];
  tags: string[];
  variables?: DashboardVariable[];
  refresh?: string;
  timeRange?: {
    from: string;
    to: string;
  };
}

interface AlertRule {
  id: string;
  name: string;
  condition: {
    query: string; // PromQL query
    evaluator: {
      type: 'gt' | 'lt' | 'eq' | 'ne';
      params: number[];
    };
    reducer: {
      type: 'avg' | 'sum' | 'min' | 'max' | 'last';
      params: string[];
    };
  };
  for: string; // Duration like "5m"
  annotations: {
    summary: string;
    description?: string;
  };
  labels?: Record<string, string>;
  notificationChannels: string[];
}

interface DataSource {
  name: string;
  type: 'prometheus' | 'loki' | 'influxdb' | 'elasticsearch' | 'postgres' | 'mysql';
  url: string;
  access: 'proxy' | 'direct';
  isDefault?: boolean;
  basicAuth?: boolean;
  basicAuthUser?: string;
  basicAuthPassword?: string;
  jsonData?: Record<string, any>;
}

interface GrafanaConfig {
  adminUser?: string;
  adminPassword?: string;
  datasources?: DataSource[];
  dashboards?: Dashboard[];
  alerts?: AlertRule[];
  defaultDashboard?: string;
  enableAuth?: boolean;
  authProvider?: string;
  enableAlerting?: boolean;
  alertNotificationChannels?: string[];
  theme?: string;
}

export function GrafanaConfigAdvanced({ componentId }: GrafanaConfigProps) {
  // Hooks must be at the top level
  const [editingDashboard, setEditingDashboard] = useState<string | null>(null);
  const [editingPanel, setEditingPanel] = useState<{ dashboardId: string; panelId: string } | null>(null);
  const [showCreateDashboard, setShowCreateDashboard] = useState(false);
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [showCreateDatasource, setShowCreateDatasource] = useState(false);
  const [showDashboardViewer, setShowDashboardViewer] = useState(false);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | undefined>(undefined);

  try {
    const { nodes, updateNode } = useCanvasStore();
    const { isRunning } = useEmulationStore();
    const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

    if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

    const config = (node.data.config as any) || {} as GrafanaConfig;
    
    // Получаем значения по умолчанию из профиля
    const profileDefaults = OBSERVABILITY_PROFILES.grafana.defaults;
    const adminUser = config.adminUser || profileDefaults.adminUser;
    const adminPassword = config.adminPassword || profileDefaults.adminPassword;
    
    // Safe migration: handle old format where datasources could be strings
    let datasources: DataSource[] = [];
    if (Array.isArray(config.datasources)) {
      if (config.datasources.length > 0 && typeof config.datasources[0] === 'string') {
        // Old format: array of strings
        datasources = config.datasources.map((ds: string) => ({
          name: ds,
          type: 'prometheus' as const,
          url: 'http://localhost:9090',
          access: 'proxy' as const,
          isDefault: ds === config.datasources[0]
        }));
      } else {
        // New format: array of DataSource objects
        datasources = config.datasources.filter((ds: any) => ds && typeof ds === 'object' && ds.name);
      }
    }
    if (datasources.length === 0) {
      // Используем значения из профиля (если есть) или дефолтные
      const defaultDatasourceName = Array.isArray(profileDefaults.datasources) && profileDefaults.datasources.length > 0
        ? (typeof profileDefaults.datasources[0] === 'string' ? profileDefaults.datasources[0] : 'Prometheus')
        : 'Prometheus';
      datasources = [
        { name: defaultDatasourceName, type: 'prometheus' as const, url: 'http://localhost:9090', access: 'proxy' as const, isDefault: true },
      ];
    }
    
    // Safe migration: handle old format where dashboards.panels could be a number
    let dashboards: Dashboard[] = [];
    if (Array.isArray(config.dashboards)) {
      dashboards = config.dashboards.map((d: any) => {
        if (d && typeof d === 'object') {
          // Check if panels is a number (old format) or array (new format)
          if (typeof d.panels === 'number') {
            // Old format: convert to array
            return {
              ...d,
              panels: [] as Panel[],
              tags: Array.isArray(d.tags) ? d.tags : [],
            };
          } else if (Array.isArray(d.panels)) {
            // New format: ensure all panels have required fields
            return {
              ...d,
              panels: d.panels.map((p: any) => ({
                id: p.id || `panel-${Date.now()}`,
                title: p.title || 'Panel',
                type: p.type || 'graph',
                datasource: p.datasource || datasources[0]?.name || 'Prometheus',
                queries: Array.isArray(p.queries) ? p.queries : [{ refId: 'A', expr: 'up' }],
                gridPos: p.gridPos || { x: 0, y: 0, w: 12, h: 8 }
              })),
              tags: Array.isArray(d.tags) ? d.tags : [],
            };
          }
        }
        return d;
      }).filter((d: any) => d && typeof d === 'object' && d.id);
    }
    if (dashboards.length === 0) {
      // Если нет dashboards, не создаем дефолтный - пользователь должен создать сам
      // Это соответствует принципу отсутствия хардкода
      dashboards = [];
    }
    
    const alerts: AlertRule[] = Array.isArray(config.alerts) ? config.alerts.filter((a: any) => a && typeof a === 'object' && a.id) : [];
    const defaultDashboard = config.defaultDashboard || profileDefaults.defaultDashboard;
    const enableAuth = config.enableAuth ?? profileDefaults.enableAuth;
    const authProvider = config.authProvider || profileDefaults.authProvider;
    const enableAlerting = config.enableAlerting ?? profileDefaults.enableAlerting;
    const alertNotificationChannels = Array.isArray(config.alertNotificationChannels) 
      ? config.alertNotificationChannels 
      : (Array.isArray(profileDefaults.alertNotificationChannels) ? profileDefaults.alertNotificationChannels : ['email', 'slack']);
    const theme = config.theme || profileDefaults.theme;

  const updateConfig = (updates: Partial<GrafanaConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addDatasource = () => {
    const newDs: DataSource = {
      name: 'New Data Source',
      type: 'prometheus',
      url: 'http://localhost:9090',
      access: 'proxy',
    };
    updateConfig({ datasources: [...datasources, newDs] });
    setShowCreateDatasource(false);
  };

  const removeDatasource = (index: number) => {
    updateConfig({ datasources: datasources.filter((_, i) => i !== index) });
  };

  const updateDatasource = (index: number, field: keyof DataSource, value: any) => {
    const newDs = [...datasources];
    newDs[index] = { ...newDs[index], [field]: value };
    updateConfig({ datasources: newDs });
  };

  const addDashboard = () => {
    const newDashboard: Dashboard = {
      id: String(Date.now()),
      name: 'New Dashboard',
      panels: [],
      tags: [],
      refresh: '30s',
    };
    updateConfig({ dashboards: [...dashboards, newDashboard] });
    setShowCreateDashboard(false);
  };

  const removeDashboard = (index: number) => {
    updateConfig({ dashboards: dashboards.filter((_, i) => i !== index) });
  };

  const addPanelToDashboard = (dashboardId: string) => {
    const defaultDatasourceName = datasources && datasources.length > 0 ? datasources[0].name : 'Prometheus';
    const newPanel: Panel = {
      id: `panel-${Date.now()}`,
      title: 'New Panel',
      type: 'graph',
      datasource: defaultDatasourceName,
      queries: [
        { refId: 'A', expr: 'up', legendFormat: '{{instance}}' }
      ],
      gridPos: { x: 0, y: 0, w: 12, h: 8 }
    };
    const newDashboards = dashboards.map(d => 
      d.id === dashboardId 
        ? { ...d, panels: [...d.panels, newPanel] }
        : d
    );
    updateConfig({ dashboards: newDashboards });
  };

  const removePanelFromDashboard = (dashboardId: string, panelId: string) => {
    const newDashboards = dashboards.map(d =>
      d.id === dashboardId
        ? { ...d, panels: d.panels.filter(p => p.id !== panelId) }
        : d
    );
    updateConfig({ dashboards: newDashboards });
  };

  const updatePanel = (dashboardId: string, panelId: string, field: keyof Panel, value: any) => {
    const newDashboards = dashboards.map(d =>
      d.id === dashboardId
        ? {
            ...d,
            panels: d.panels.map(p =>
              p.id === panelId ? { ...p, [field]: value } : p
            )
          }
        : d
    );
    updateConfig({ dashboards: newDashboards });
  };

  const addQueryToPanel = (dashboardId: string, panelId: string) => {
    const newDashboards = dashboards.map(d =>
      d.id === dashboardId
        ? {
            ...d,
            panels: d.panels.map(p => {
              if (p.id === panelId) {
                const currentQueries = Array.isArray(p.queries) ? p.queries : [];
                return {
                  ...p,
                  queries: [...currentQueries, { refId: String.fromCharCode(65 + currentQueries.length), expr: '', legendFormat: '' }]
                };
              }
              return p;
            })
          }
        : d
    );
    updateConfig({ dashboards: newDashboards });
  };

  const updateQuery = (dashboardId: string, panelId: string, queryIndex: number, field: string, value: string) => {
    const newDashboards = dashboards.map(d =>
      d.id === dashboardId
        ? {
            ...d,
            panels: d.panels.map(p => {
              if (p.id === panelId) {
                const currentQueries = Array.isArray(p.queries) ? p.queries : [];
                return {
                  ...p,
                  queries: currentQueries.map((q, idx) =>
                    idx === queryIndex ? { ...q, [field]: value } : q
                  )
                };
              }
              return p;
            })
          }
        : d
    );
    updateConfig({ dashboards: newDashboards });
  };

  const addAlert = () => {
    const newAlert: AlertRule = {
      id: `alert-${Date.now()}`,
      name: 'New Alert',
      condition: {
        query: 'up == 0',
        evaluator: { type: 'gt', params: [0] },
        reducer: { type: 'last', params: [] }
      },
      for: '5m',
      annotations: {
        summary: 'Alert triggered',
        description: 'Service is down'
      },
      notificationChannels: alertNotificationChannels.slice(0, 1)
    };
    updateConfig({ alerts: [...alerts, newAlert] });
    setShowCreateAlert(false);
  };

  const removeAlert = (id: string) => {
    updateConfig({ alerts: alerts.filter(a => a.id !== id) });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <BarChart3 className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Grafana</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Analytics & Monitoring Platform
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
              <div className={`h-2 w-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              {isRunning ? 'Running' : 'Stopped'}
            </Badge>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                setSelectedDashboardId(defaultDashboard === 'overview' ? dashboards[0]?.id : dashboards.find(d => d.id === defaultDashboard)?.id);
                setShowDashboardViewer(true);
              }}
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Open Dashboard
            </Button>
          </div>
        </div>

        <Separator />

        {/* Live Dashboard Preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Live Dashboard Preview</CardTitle>
                <CardDescription>Real-time metrics from configured dashboards</CardDescription>
              </div>
              {dashboards.length > 0 && (
                <Select
                  value={selectedDashboardId || dashboards[0]?.id}
                  onValueChange={(value) => setSelectedDashboardId(value)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dashboards.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {dashboards.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No dashboards configured</p>
                <p className="text-sm mt-2">Create a dashboard to see live metrics here</p>
              </div>
            ) : (
              <GrafanaDashboardPreview
                componentId={componentId}
                dashboardId={selectedDashboardId || dashboards[0]?.id}
              />
            )}
          </CardContent>
        </Card>

        {/* Main Configuration Tabs */}
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="datasources" className="gap-2">
              <Database className="h-4 w-4" />
              Data Sources
            </TabsTrigger>
            <TabsTrigger value="dashboards" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboards
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2">
              <Eye className="h-4 w-4" />
              Alerts
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab - Full Dashboard View */}
          <TabsContent value="dashboard" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Live Dashboard</CardTitle>
                    <CardDescription>Real-time metrics visualization</CardDescription>
                  </div>
                  {dashboards.length > 0 && (
                    <Select
                      value={selectedDashboardId || dashboards[0]?.id}
                      onValueChange={(value) => setSelectedDashboardId(value)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dashboards.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {dashboards.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>No dashboards configured</p>
                    <p className="text-sm mt-2">Create a dashboard in the "Dashboards" tab</p>
                  </div>
                ) : (
                  <div className="h-[600px] border rounded-lg overflow-hidden">
                    <GrafanaDashboardViewer
                      componentId={componentId}
                      dashboardId={selectedDashboardId || dashboards[0]?.id}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Sources Tab */}
          <TabsContent value="datasources" className="space-y-4 mt-4">
            {showCreateDatasource && (
              <Card className="mb-4 border-primary">
                <CardHeader>
                  <CardTitle>Create Data Source</CardTitle>
                  <CardDescription>Configure connection to metrics/logs database</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input placeholder="Prometheus" />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select defaultValue="prometheus">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="prometheus">Prometheus</SelectItem>
                          <SelectItem value="loki">Loki</SelectItem>
                          <SelectItem value="influxdb">InfluxDB</SelectItem>
                          <SelectItem value="elasticsearch">Elasticsearch</SelectItem>
                          <SelectItem value="postgres">PostgreSQL</SelectItem>
                          <SelectItem value="mysql">MySQL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>URL</Label>
                    <Input placeholder="http://localhost:9090" />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={addDatasource}>Create Data Source</Button>
                    <Button variant="outline" onClick={() => setShowCreateDatasource(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Data Sources</CardTitle>
                    <CardDescription>Configure data sources for metrics and logs</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowCreateDatasource(true)} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Data Source
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {datasources.map((ds, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-primary/10">
                              <Database className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{ds.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {ds.type} • {ds.url}
                                {ds.isDefault && <Badge variant="outline" className="ml-2">Default</Badge>}
                              </CardDescription>
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeDatasource(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                              value={ds.name}
                              onChange={(e) => updateDatasource(index, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Type</Label>
                            <Select
                              value={ds.type}
                              onValueChange={(value: any) => updateDatasource(index, 'type', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="prometheus">Prometheus</SelectItem>
                                <SelectItem value="loki">Loki</SelectItem>
                                <SelectItem value="influxdb">InfluxDB</SelectItem>
                                <SelectItem value="elasticsearch">Elasticsearch</SelectItem>
                                <SelectItem value="postgres">PostgreSQL</SelectItem>
                                <SelectItem value="mysql">MySQL</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>URL</Label>
                          <Input
                            value={ds.url}
                            onChange={(e) => updateDatasource(index, 'url', e.target.value)}
                            placeholder="http://localhost:9090"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={ds.isDefault || false}
                            onCheckedChange={(checked) => updateDatasource(index, 'isDefault', checked)}
                          />
                          <Label>Set as default</Label>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dashboards Tab */}
          <TabsContent value="dashboards" className="space-y-4 mt-4">
            {showCreateDashboard && (
              <Card className="mb-4 border-primary">
                <CardHeader>
                  <CardTitle>Create Dashboard</CardTitle>
                  <CardDescription>Configure dashboard settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Dashboard Name</Label>
                    <Input placeholder="My Dashboard" />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={addDashboard}>Create Dashboard</Button>
                    <Button variant="outline" onClick={() => setShowCreateDashboard(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Dashboards</CardTitle>
                    <CardDescription>Manage and configure dashboards</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowCreateDashboard(true)} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Dashboard
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {dashboards.map((dashboard, index) => (
                    <Card key={index} className="border-border hover:border-primary/50 transition-colors cursor-pointer">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-muted-foreground" />
                            <CardTitle className="text-base">{dashboard.name}</CardTitle>
                          </div>
                          {dashboards.length > 1 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => removeDashboard(index)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Panels:</span>
                            <span className="font-semibold">{Array.isArray(dashboard.panels) ? dashboard.panels.length : 0}</span>
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {dashboard.tags.map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => setEditingDashboard(editingDashboard === dashboard.id ? null : dashboard.id)}
                            >
                              <Edit className="h-3 w-3 mr-2" />
                              {editingDashboard === dashboard.id ? 'Hide' : 'Edit'}
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              className="flex-1"
                              onClick={() => {
                                setSelectedDashboardId(dashboard.id);
                                setShowDashboardViewer(true);
                              }}
                            >
                              <Eye className="h-3 w-3 mr-2" />
                              View
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                      {editingDashboard === dashboard.id && (
                        <CardContent className="pt-0 border-t">
                          <div className="space-y-3 mt-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-semibold">Panels</Label>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addPanelToDashboard(dashboard.id)}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Panel
                              </Button>
                            </div>
                            {(!Array.isArray(dashboard.panels) || dashboard.panels.length === 0) ? (
                              <div className="text-center py-4 text-muted-foreground text-sm">
                                No panels. Click "Add Panel" to create one.
                              </div>
                            ) : (
                              dashboard.panels.map((panel) => (
                                <Card key={panel.id} className="border-border">
                                  <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline">{panel.type}</Badge>
                                        <Input
                                          value={panel.title}
                                          onChange={(e) => updatePanel(dashboard.id, panel.id, 'title', e.target.value)}
                                          className="h-7 flex-1"
                                        />
                                      </div>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        onClick={() => removePanelFromDashboard(dashboard.id, panel.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="space-y-1">
                                        <Label className="text-xs">Type</Label>
                                        <Select
                                          value={panel.type}
                                          onValueChange={(value: any) => updatePanel(dashboard.id, panel.id, 'type', value)}
                                        >
                                          <SelectTrigger className="h-7">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="graph">Graph</SelectItem>
                                            <SelectItem value="table">Table</SelectItem>
                                            <SelectItem value="stat">Stat</SelectItem>
                                            <SelectItem value="gauge">Gauge</SelectItem>
                                            <SelectItem value="piechart">Pie Chart</SelectItem>
                                            <SelectItem value="bargraph">Bar Graph</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Data Source</Label>
                                        <Select
                                          value={panel.datasource}
                                          onValueChange={(value) => updatePanel(dashboard.id, panel.id, 'datasource', value)}
                                        >
                                          <SelectTrigger className="h-7">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {datasources.map((ds) => (
                                              <SelectItem key={ds.name} value={ds.name}>{ds.name}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <Label className="text-xs">Queries (PromQL/LogQL)</Label>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6"
                                          onClick={() => addQueryToPanel(dashboard.id, panel.id)}
                                        >
                                          <Plus className="h-3 w-3 mr-1" />
                                          Add Query
                                        </Button>
                                      </div>
                                      {Array.isArray(panel.queries) && panel.queries.length > 0 ? (
                                        panel.queries.map((query, qIdx) => (
                                          <div key={qIdx} className="space-y-1 p-2 border rounded">
                                            <div className="flex items-center gap-2">
                                              <Badge variant="secondary" className="text-xs">{query.refId || 'A'}</Badge>
                                              <Input
                                                value={query.expr || ''}
                                                onChange={(e) => updateQuery(dashboard.id, panel.id, qIdx, 'expr', e.target.value)}
                                                placeholder="up or {job='api'} |= 'error'"
                                                className="h-7 text-xs font-mono"
                                              />
                                            </div>
                                            <Input
                                              value={query.legendFormat || ''}
                                              onChange={(e) => updateQuery(dashboard.id, panel.id, qIdx, 'legendFormat', e.target.value)}
                                              placeholder="Legend format: {{instance}}"
                                              className="h-6 text-xs"
                                            />
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-center py-2 text-xs text-muted-foreground">
                                          No queries. Click "Add Query" to add one.
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              ))
                            )}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4 mt-4">
            {showCreateAlert && (
              <Card className="mb-4 border-primary">
                <CardHeader>
                  <CardTitle>Create Alert Rule</CardTitle>
                  <CardDescription>Configure alert conditions and notifications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Alert Name</Label>
                    <Input placeholder="High CPU Usage" />
                  </div>
                  <div className="space-y-2">
                    <Label>PromQL Query</Label>
                    <Textarea placeholder="rate(process_cpu_seconds_total[5m]) > 0.8" className="font-mono text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Condition</Label>
                      <Select defaultValue="gt">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gt">Greater Than</SelectItem>
                          <SelectItem value="lt">Less Than</SelectItem>
                          <SelectItem value="eq">Equal</SelectItem>
                          <SelectItem value="ne">Not Equal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Threshold</Label>
                      <Input type="number" placeholder="0.8" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={addAlert}>Create Alert</Button>
                    <Button variant="outline" onClick={() => setShowCreateAlert(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Alert Rules</CardTitle>
                    <CardDescription>Configure alert conditions and notifications</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={enableAlerting}
                      onCheckedChange={(checked) => updateConfig({ enableAlerting: checked })}
                    />
                    <Button size="sm" onClick={() => setShowCreateAlert(true)} variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Alert
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!enableAlerting ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Alerting is disabled. Enable it to create alert rules.</p>
                  </div>
                ) : alerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No alert rules configured. Click "Create Alert" to add one.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alerts.map((alert) => (
                      <Card key={alert.id} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-lg">{alert.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                For: {alert.for} • Channels: {alert.notificationChannels.join(', ')}
                              </CardDescription>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeAlert(alert.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-2">
                            <Label className="text-xs">PromQL Query</Label>
                            <div className="p-2 bg-muted rounded font-mono text-sm">
                              {alert.condition.query}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Evaluator</Label>
                              <Badge variant="outline">{alert.condition.evaluator.type}</Badge>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Threshold</Label>
                              <Badge variant="outline">{alert.condition.evaluator.params.join(', ')}</Badge>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Reducer</Label>
                              <Badge variant="outline">{alert.condition.reducer.type}</Badge>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Summary</Label>
                            <div className="text-sm">{alert.annotations.summary}</div>
                            {alert.annotations.description && (
                              <div className="text-xs text-muted-foreground">{alert.annotations.description}</div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Administration</CardTitle>
                <CardDescription>Grafana server configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-user">Admin Username</Label>
                    <Input
                      id="admin-user"
                      value={adminUser}
                      onChange={(e) => updateConfig({ adminUser: e.target.value })}
                      placeholder="admin"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Admin Password</Label>
                    <Input
                      id="admin-password"
                      type="password"
                      value={adminPassword}
                      onChange={(e) => updateConfig({ adminPassword: e.target.value })}
                      placeholder="admin"
                    />
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Authentication</Label>
                    <div className="text-sm text-muted-foreground">
                      Require login to access Grafana
                    </div>
                  </div>
                  <Switch
                    checked={enableAuth}
                    onCheckedChange={(checked) => updateConfig({ enableAuth: checked })}
                  />
                </div>
                {enableAuth && (
                  <div className="space-y-2">
                    <Label>Auth Provider</Label>
                    <Select value={authProvider} onValueChange={(value) => updateConfig({ authProvider: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ldap">LDAP</SelectItem>
                        <SelectItem value="oauth">OAuth</SelectItem>
                        <SelectItem value="saml">SAML</SelectItem>
                        <SelectItem value="jwt">JWT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dashboard Viewer Dialog */}
      <Dialog open={showDashboardViewer} onOpenChange={setShowDashboardViewer}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Grafana Dashboard</DialogTitle>
          </DialogHeader>
          <div className="h-full">
            <GrafanaDashboardViewer
              componentId={componentId}
              dashboardId={selectedDashboardId}
              onClose={() => setShowDashboardViewer(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
  } catch (error) {
    logError('Error rendering GrafanaConfigAdvanced', error instanceof Error ? error : new Error(String(error)));
    return (
      <div className="p-4 text-destructive">
        <p>Error loading Grafana configuration</p>
        <p className="text-sm text-muted-foreground mt-2">{String(error)}</p>
      </div>
    );
  }
}


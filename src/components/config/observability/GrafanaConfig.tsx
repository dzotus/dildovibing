import { useState, useEffect } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Layout, BarChart3, LineChart, Gauge, PieChart, Settings, Database, Play } from 'lucide-react';
import { CanvasNode } from '@/types';
import { prometheusExporter } from '@/core/PrometheusMetricsExporter';

interface Panel {
  id: string;
  title: string;
  type: 'graph' | 'singlestat' | 'table' | 'gauge' | 'piechart';
  query: string;
  datasource?: string;
  gridPos?: { x: number; y: number; w: number; h: number };
}

interface Dashboard {
  name: string;
  panels: Panel[];
  refreshInterval?: string;
}

interface DataSource {
  name: string;
  type: 'prometheus' | 'loki' | 'jaeger' | 'elasticsearch';
  url: string;
}

interface GrafanaConfigData {
  serverUrl?: string;
  dashboards?: Dashboard[];
  datasources?: DataSource[];
}

export function GrafanaConfig({ componentId }: { componentId: string }) {
  const { nodes, updateNode } = useCanvasStore();
  const { isRunning, componentMetrics, connectionMetrics } = useEmulationStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;
  const [activeTab, setActiveTab] = useState('dashboards');
  const [panelResults, setPanelResults] = useState<Record<string, number | null>>({});

  // Update Prometheus exporter when emulation runs
  useEffect(() => {
    if (isRunning) {
      prometheusExporter.updateMetrics(componentMetrics, connectionMetrics, nodes);
      
      // Auto-update panel results every second
      const interval = setInterval(() => {
        prometheusExporter.updateMetrics(componentMetrics, connectionMetrics, nodes);
        updatePanelResults();
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      setPanelResults({});
    }
  }, [isRunning, componentMetrics, connectionMetrics, nodes]);

  const updatePanelResults = () => {
    if (!node) return;
    const config = (node.data.config as any) || {} as GrafanaConfigData;
    const dashboards = config.dashboards || [];
    const newResults: Record<string, number | null> = {};
    
    dashboards.forEach((dashboard, dashboardIndex) => {
      dashboard.panels?.forEach((panel, panelIndex) => {
        if (panel.query && isRunning) {
          const panelId = `${dashboardIndex}-${panelIndex}`;
          newResults[panelId] = prometheusExporter.query(panel.query);
        }
      });
    });
    
    setPanelResults(newResults);
  };

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as GrafanaConfigData;
  const dashboards = config.dashboards || [];
  const datasources = config.datasources || [];

  const updateConfig = (updates: Partial<GrafanaConfigData>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addDashboard = () => {
    // Create a dashboard with example panels
    const examplePanels: Panel[] = [
      {
        id: `panel-${Date.now()}-1`,
        title: 'Average Latency',
        type: 'graph',
        query: 'avg(component_latency)',
        gridPos: { x: 0, y: 0, w: 12, h: 8 },
      },
      {
        id: `panel-${Date.now()}-2`,
        title: 'Total Throughput',
        type: 'singlestat',
        query: 'sum(component_throughput)',
        gridPos: { x: 0, y: 8, w: 6, h: 4 },
      },
      {
        id: `panel-${Date.now()}-3`,
        title: 'Error Rate',
        type: 'gauge',
        query: 'avg(component_error_rate)',
        gridPos: { x: 6, y: 8, w: 6, h: 4 },
      },
    ];
    
    updateConfig({
      dashboards: [...dashboards, { name: 'System Overview', panels: examplePanels }],
    });
  };

  const updateDashboard = (index: number, updates: Partial<Dashboard>) => {
    const updated = [...dashboards];
    updated[index] = { ...updated[index], ...updates };
    updateConfig({ dashboards: updated });
  };

  const removeDashboard = (index: number) => {
    updateConfig({ dashboards: dashboards.filter((_, i) => i !== index) });
  };

  const addPanel = (dashboardIndex: number) => {
    const dashboard = dashboards[dashboardIndex];
    const panelCount = (dashboard.panels || []).length;
    
    // Default queries based on panel type
    const defaultQueries: Record<Panel['type'], string> = {
      graph: 'avg(component_latency)',
      singlestat: 'sum(component_throughput)',
      table: 'component_throughput',
      gauge: 'avg(component_utilization)',
      piechart: 'component_error_rate',
    };
    
    const newPanel: Panel = {
      id: `panel-${Date.now()}`,
      title: `Panel ${panelCount + 1}`,
      type: 'graph',
      query: defaultQueries.graph,
      gridPos: { x: 0, y: 0, w: 12, h: 8 },
    };
    updateDashboard(dashboardIndex, {
      panels: [...(dashboard.panels || []), newPanel],
    });
  };

  const updatePanel = (dashboardIndex: number, panelIndex: number, updates: Partial<Panel>) => {
    const dashboard = dashboards[dashboardIndex];
    const updatedPanels = [...(dashboard.panels || [])];
    updatedPanels[panelIndex] = { ...updatedPanels[panelIndex], ...updates };
    updateDashboard(dashboardIndex, { panels: updatedPanels });
  };

  const removePanel = (dashboardIndex: number, panelIndex: number) => {
    const dashboard = dashboards[dashboardIndex];
    updateDashboard(dashboardIndex, {
      panels: (dashboard.panels || []).filter((_, i) => i !== panelIndex),
    });
  };

  const addDataSource = () => {
    updateConfig({
      datasources: [...datasources, { name: 'Prometheus', type: 'prometheus', url: 'http://prometheus:9090' }],
    });
  };

  const updateDataSource = (index: number, updates: Partial<DataSource>) => {
    const updated = [...datasources];
    updated[index] = { ...updated[index], ...updates };
    updateConfig({ datasources: updated });
  };

  const removeDataSource = (index: number) => {
    updateConfig({ datasources: datasources.filter((_, i) => i !== index) });
  };

  const getPanelIcon = (type: Panel['type']) => {
    switch (type) {
      case 'graph':
        return <LineChart className="h-4 w-4" />;
      case 'singlestat':
        return <Gauge className="h-4 w-4" />;
      case 'table':
        return <BarChart3 className="h-4 w-4" />;
      case 'gauge':
        return <Gauge className="h-4 w-4" />;
      case 'piechart':
        return <PieChart className="h-4 w-4" />;
      default:
        return <BarChart3 className="h-4 w-4" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Layout className="h-6 w-6" />
              Grafana Configuration
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure dashboards, panels, and data sources
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border px-4">
          <TabsList className="bg-transparent">
            <TabsTrigger value="dashboards" className="flex items-center gap-2">
              <Layout className="h-4 w-4" />
              Dashboards
            </TabsTrigger>
            <TabsTrigger value="datasources" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Data Sources
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6">
            <TabsContent value="dashboards" className="space-y-4 mt-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Dashboards</h3>
                  <p className="text-sm text-muted-foreground">Create and manage dashboards with panels</p>
                </div>
                <Button onClick={addDashboard} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Dashboard
                </Button>
              </div>

              <div className="space-y-6">
                {dashboards.map((dashboard, dashboardIndex) => (
                  <div key={dashboardIndex} className="border border-border rounded-lg p-4 space-y-4 bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layout className="h-5 w-5" />
                        <Input
                          value={dashboard.name}
                          onChange={(e) => updateDashboard(dashboardIndex, { name: e.target.value })}
                          placeholder="Dashboard Name"
                          className="font-semibold text-lg border-0 bg-transparent p-0 h-auto"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addPanel(dashboardIndex)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Panel
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeDashboard(dashboardIndex)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      {dashboard.panels && dashboard.panels.length > 0 ? (
                        dashboard.panels.map((panel, panelIndex) => (
                          <div key={panel.id} className="border border-border rounded p-3 space-y-3 bg-secondary/30">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {getPanelIcon(panel.type)}
                                <Input
                                  value={panel.title}
                                  onChange={(e) =>
                                    updatePanel(dashboardIndex, panelIndex, { title: e.target.value })
                                  }
                                  placeholder="Panel Title"
                                  className="font-semibold border-0 bg-transparent p-0 h-auto"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{panel.type}</Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removePanel(dashboardIndex, panelIndex)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>Panel Type</Label>
                                <select
                                  value={panel.type}
                                  onChange={(e) => {
                                    const newType = e.target.value as Panel['type'];
                                    const defaultQueries: Record<Panel['type'], string> = {
                                      graph: 'avg(component_latency)',
                                      singlestat: 'sum(component_throughput)',
                                      table: 'component_throughput',
                                      gauge: 'avg(component_utilization)',
                                      piechart: 'component_error_rate',
                                    };
                                    updatePanel(dashboardIndex, panelIndex, {
                                      type: newType,
                                      query: panel.query || defaultQueries[newType],
                                    });
                                  }}
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                  <option value="graph">Graph</option>
                                  <option value="singlestat">Single Stat</option>
                                  <option value="table">Table</option>
                                  <option value="gauge">Gauge</option>
                                  <option value="piechart">Pie Chart</option>
                                </select>
                              </div>
                              <div className="space-y-2">
                                <Label>Data Source</Label>
                                <select
                                  value={panel.datasource || ''}
                                  onChange={(e) =>
                                    updatePanel(dashboardIndex, panelIndex, { datasource: e.target.value })
                                  }
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                  <option value="">Select data source</option>
                                  {datasources.map((ds) => (
                                    <option key={ds.name} value={ds.name}>
                                      {ds.name} ({ds.type})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Query</Label>
                              <div className="space-y-1">
                                <Input
                                  value={panel.query}
                                  onChange={(e) =>
                                    updatePanel(dashboardIndex, panelIndex, { query: e.target.value })
                                  }
                                  placeholder="avg(component_latency)"
                                  className="font-mono text-sm"
                                />
                                <div className="text-xs text-muted-foreground">
                                  Examples: <code className="bg-secondary px-1 rounded">avg(component_latency)</code>,{' '}
                                  <code className="bg-secondary px-1 rounded">sum(component_throughput)</code>,{' '}
                                  <code className="bg-secondary px-1 rounded">component_error_rate</code>
                                </div>
                              </div>
                            </div>

                            <div className="bg-background/50 rounded p-2 border border-border/50">
                              <div className="flex items-center justify-between mb-1">
                                <div className="text-xs text-muted-foreground">Preview</div>
                                {isRunning && panel.query && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => updatePanelResults()}
                                    title="Refresh"
                                  >
                                    <Play className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                              <div className="h-24 bg-background rounded border border-border flex items-center justify-center relative">
                                {isRunning && panel.query ? (
                                  <div className="text-center">
                                    {getPanelIcon(panel.type)}
                                    <div className="text-xs mt-1 font-semibold">{panel.title || 'Panel'}</div>
                                    {panelResults[`${dashboardIndex}-${panelIndex}`] !== undefined && (
                                      <div className="text-lg font-mono font-bold mt-1">
                                        {panelResults[`${dashboardIndex}-${panelIndex}`] !== null
                                          ? panelResults[`${dashboardIndex}-${panelIndex}`]?.toFixed(2)
                                          : 'N/A'}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-center text-muted-foreground">
                                    {getPanelIcon(panel.type)}
                                    <div className="text-xs mt-1">{panel.title || 'Panel Preview'}</div>
                                    {!isRunning && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        Start emulation to see data
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded">
                          <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No panels in this dashboard. Click "Add Panel" to create one.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {dashboards.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Layout className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No dashboards defined. Click "Add Dashboard" to create one.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="datasources" className="space-y-4 mt-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Data Sources</h3>
                  <p className="text-sm text-muted-foreground">Configure data sources for dashboards</p>
                </div>
                <Button onClick={addDataSource} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Data Source
                </Button>
              </div>

              <div className="space-y-4">
                {datasources.map((ds, index) => (
                  <div key={index} className="border border-border rounded-lg p-4 space-y-3 bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        <Label className="text-base font-semibold">{ds.name || 'Unnamed Data Source'}</Label>
                        <Badge variant="outline">{ds.type}</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDataSource(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={ds.name}
                          onChange={(e) => updateDataSource(index, { name: e.target.value })}
                          placeholder="Prometheus"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <select
                          value={ds.type}
                          onChange={(e) =>
                            updateDataSource(index, { type: e.target.value as DataSource['type'] })
                          }
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="prometheus">Prometheus</option>
                          <option value="loki">Loki</option>
                          <option value="jaeger">Jaeger</option>
                          <option value="elasticsearch">Elasticsearch</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>URL</Label>
                      <Input
                        value={ds.url}
                        onChange={(e) => updateDataSource(index, { url: e.target.value })}
                        placeholder="http://prometheus:9090"
                      />
                    </div>
                  </div>
                ))}

                {datasources.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No data sources defined. Click "Add Data Source" to create one.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-0">
              <div>
                <h3 className="text-lg font-semibold mb-4">Server Settings</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Server URL</Label>
                    <Input
                      value={config.serverUrl || ''}
                      onChange={(e) => updateConfig({ serverUrl: e.target.value })}
                      placeholder="http://localhost:3000"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}


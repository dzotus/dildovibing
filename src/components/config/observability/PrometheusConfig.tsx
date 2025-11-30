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
import { Plus, Trash2, Play, AlertTriangle, BarChart3, Settings, Activity } from 'lucide-react';
import { CanvasNode } from '@/types';
import { prometheusExporter } from '@/core/PrometheusMetricsExporter';

interface Metric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  labels: string[];
  help: string;
}

interface PromQLQuery {
  name: string;
  query: string;
  description?: string;
}

interface AlertRule {
  alert: string;
  expr: string;
  for: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

interface PrometheusConfig {
  serverUrl?: string;
  scrapeInterval?: string;
  metrics?: Metric[];
  queries?: PromQLQuery[];
  alertRules?: AlertRule[];
}

export function PrometheusConfig({ componentId }: { componentId: string }) {
  const { nodes, updateNode } = useCanvasStore();
  const { isRunning, componentMetrics, connectionMetrics } = useEmulationStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;
  const [activeTab, setActiveTab] = useState('metrics');
  const [queryResults, setQueryResults] = useState<Record<number, number | null>>({});
  const [metricsOutput, setMetricsOutput] = useState<string>('');

  // Update Prometheus exporter and metrics output when emulation runs
  useEffect(() => {
    if (isRunning) {
      prometheusExporter.updateMetrics(componentMetrics, connectionMetrics, nodes);
      setMetricsOutput(prometheusExporter.exportPrometheusFormat());
      
      // Auto-update every second
      const interval = setInterval(() => {
        prometheusExporter.updateMetrics(componentMetrics, connectionMetrics, nodes);
        setMetricsOutput(prometheusExporter.exportPrometheusFormat());
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      setMetricsOutput('');
      setQueryResults({});
    }
  }, [isRunning, componentMetrics, connectionMetrics, nodes]);

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as PrometheusConfig;
  const metrics = config.metrics || [];
  const queries = config.queries || [];
  const alertRules = config.alertRules || [];

  const updateConfig = (updates: Partial<PrometheusConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addMetric = () => {
    updateConfig({
      metrics: [...metrics, { name: '', type: 'counter', labels: [], help: '' }],
    });
  };

  const updateMetric = (index: number, updates: Partial<Metric>) => {
    const updated = [...metrics];
    updated[index] = { ...updated[index], ...updates };
    updateConfig({ metrics: updated });
  };

  const removeMetric = (index: number) => {
    updateConfig({ metrics: metrics.filter((_, i) => i !== index) });
  };

  const addQuery = () => {
    // Add example queries
    const exampleQueries: PromQLQuery[] = [
      { name: 'Average Latency', query: 'avg(component_latency)', description: 'Average latency across all components' },
      { name: 'Total Throughput', query: 'sum(component_throughput)', description: 'Total throughput of all components' },
      { name: 'Error Rate', query: 'avg(component_error_rate)', description: 'Average error rate' },
    ];
    
    if (queries.length === 0) {
      // First time - add example queries
      updateConfig({ queries: exampleQueries });
    } else {
      // Add empty query
      updateConfig({
        queries: [...queries, { name: '', query: '' }],
      });
    }
  };

  const updateQuery = (index: number, updates: Partial<PromQLQuery>) => {
    const updated = [...queries];
    updated[index] = { ...updated[index], ...updates };
    updateConfig({ queries: updated });
  };

  const removeQuery = (index: number) => {
    updateConfig({ queries: queries.filter((_, i) => i !== index) });
  };

  const addAlertRule = () => {
    updateConfig({
      alertRules: [...alertRules, { alert: '', expr: '', for: '5m', labels: {}, annotations: {} }],
    });
  };

  const updateAlertRule = (index: number, updates: Partial<AlertRule>) => {
    const updated = [...alertRules];
    updated[index] = { ...updated[index], ...updates };
    updateConfig({ alertRules: updated });
  };

  const removeAlertRule = (index: number) => {
    updateConfig({ alertRules: alertRules.filter((_, i) => i !== index) });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Prometheus Configuration
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure metrics, queries, and alerting rules
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border px-4">
          <TabsList className="bg-transparent">
            <TabsTrigger value="metrics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Metrics
            </TabsTrigger>
            <TabsTrigger value="queries" className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              PromQL Queries
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alert Rules
            </TabsTrigger>
            <TabsTrigger value="live" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Live Metrics
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6">
            <TabsContent value="metrics" className="space-y-4 mt-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Custom Metrics</h3>
                  <p className="text-sm text-muted-foreground">Define metrics with types and labels</p>
                </div>
                <Button onClick={addMetric} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Metric
                </Button>
              </div>

              <div className="space-y-4">
                {metrics.map((metric, index) => (
                  <div key={index} className="border border-border rounded-lg p-4 space-y-3 bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{metric.type || 'counter'}</Badge>
                        <span className="text-sm font-mono text-muted-foreground">
                          {metric.name || 'unnamed_metric'}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMetric(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Metric Name</Label>
                        <Input
                          value={metric.name}
                          onChange={(e) => updateMetric(index, { name: e.target.value })}
                          placeholder="http_requests_total"
                          className="font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <select
                          value={metric.type}
                          onChange={(e) => updateMetric(index, { type: e.target.value as Metric['type'] })}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="counter">Counter</option>
                          <option value="gauge">Gauge</option>
                          <option value="histogram">Histogram</option>
                          <option value="summary">Summary</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Labels (comma-separated)</Label>
                      <Input
                        value={metric.labels.join(', ')}
                        onChange={(e) =>
                          updateMetric(index, {
                            labels: e.target.value.split(',').map((l) => l.trim()).filter(Boolean),
                          })
                        }
                        placeholder="method, status, endpoint"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Help Text</Label>
                      <Input
                        value={metric.help}
                        onChange={(e) => updateMetric(index, { help: e.target.value })}
                        placeholder="Total number of HTTP requests"
                      />
                    </div>
                  </div>
                ))}

                {metrics.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No metrics defined. Click "Add Metric" to create one.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="queries" className="space-y-4 mt-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">PromQL Queries</h3>
                  <p className="text-sm text-muted-foreground">Define queries for monitoring and visualization</p>
                </div>
                <Button onClick={addQuery} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Query
                </Button>
              </div>

              <div className="space-y-4">
                {queries.map((query, index) => (
                  <div key={index} className="border border-border rounded-lg p-4 space-y-3 bg-card">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">{query.name || 'Unnamed Query'}</Label>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeQuery(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Query Name</Label>
                      <Input
                        value={query.name}
                        onChange={(e) => updateQuery(index, { name: e.target.value })}
                        placeholder="Request Rate"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>PromQL Expression</Label>
                      <div className="relative">
                        <Input
                          value={query.query}
                          onChange={(e) => updateQuery(index, { query: e.target.value })}
                          placeholder="rate(http_requests_total[5m])"
                          className="font-mono"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 -translate-y-1/2"
                          title="Execute query"
                          onClick={() => {
                            if (isRunning) {
                              const result = prometheusExporter.query(query.query);
                              setQueryResults({ ...queryResults, [index]: result });
                            }
                          }}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Description (optional)</Label>
                      <Input
                        value={query.description || ''}
                        onChange={(e) => updateQuery(index, { description: e.target.value })}
                        placeholder="Average request rate over 5 minutes"
                      />
                    </div>

                    {isRunning && queryResults[index] !== undefined && (
                      <div className="bg-secondary/50 rounded p-3 border border-border">
                        <div className="text-xs text-muted-foreground mb-1">Query Result</div>
                        <div className="text-lg font-mono font-semibold">
                          {queryResults[index] !== null ? queryResults[index]?.toFixed(2) : 'N/A (Invalid query or no data)'}
                        </div>
                      </div>
                    )}

                    {!isRunning && (
                      <div className="bg-muted/50 rounded p-3 border border-border text-sm text-muted-foreground">
                        Start emulation to execute queries
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="font-semibold">Supported queries:</div>
                      <div>• <code className="bg-secondary px-1 rounded">avg(component_latency)</code> - Average latency</div>
                      <div>• <code className="bg-secondary px-1 rounded">sum(component_throughput)</code> - Total throughput</div>
                      <div>• <code className="bg-secondary px-1 rounded">component_error_rate</code> - Error rate</div>
                      <div>• <code className="bg-secondary px-1 rounded">component_utilization</code> - Utilization</div>
                    </div>
                  </div>
                ))}

                {queries.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No queries defined. Click "Add Query" to create one.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="alerts" className="space-y-4 mt-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Alert Rules</h3>
                  <p className="text-sm text-muted-foreground">Define alerting rules with conditions and notifications</p>
                </div>
                <Button onClick={addAlertRule} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Alert Rule
                </Button>
              </div>

              <div className="space-y-4">
                {alertRules.map((rule, index) => (
                  <div key={index} className="border border-border rounded-lg p-4 space-y-3 bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        <Label className="text-base font-semibold">{rule.alert || 'Unnamed Alert'}</Label>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAlertRule(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Alert Name</Label>
                        <Input
                          value={rule.alert}
                          onChange={(e) => updateAlertRule(index, { alert: e.target.value })}
                          placeholder="HighErrorRate"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>For Duration</Label>
                        <Input
                          value={rule.for}
                          onChange={(e) => updateAlertRule(index, { for: e.target.value })}
                          placeholder="5m"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>PromQL Expression</Label>
                      <Input
                        value={rule.expr}
                        onChange={(e) => updateAlertRule(index, { expr: e.target.value })}
                        placeholder='rate(http_requests_total{status=~"5.."}[5m]) > 0.1'
                        className="font-mono"
                      />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>Labels (JSON)</Label>
                      <Input
                        value={JSON.stringify(rule.labels || {})}
                        onChange={(e) => {
                          try {
                            updateAlertRule(index, { labels: JSON.parse(e.target.value) });
                          } catch (err) {
                            // Invalid JSON, ignore
                          }
                        }}
                        placeholder='{"severity": "critical", "team": "backend"}'
                        className="font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Annotations (JSON)</Label>
                      <Input
                        value={JSON.stringify(rule.annotations || {})}
                        onChange={(e) => {
                          try {
                            updateAlertRule(index, { annotations: JSON.parse(e.target.value) });
                          } catch (err) {
                            // Invalid JSON, ignore
                          }
                        }}
                        placeholder='{"summary": "High error rate detected", "description": "Error rate exceeds 10%"}'
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                ))}

                {alertRules.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No alert rules defined. Click "Add Alert Rule" to create one.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="live" className="space-y-4 mt-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Live Metrics Export</h3>
                  <p className="text-sm text-muted-foreground">
                    Real-time metrics from emulation in Prometheus format
                  </p>
                </div>
                <Badge variant={isRunning ? 'default' : 'secondary'}>
                  {isRunning ? 'Running' : 'Stopped'}
                </Badge>
              </div>

              {isRunning ? (
                <div className="space-y-4">
                  <div className="border border-border rounded-lg p-4 bg-card">
                    <Label className="text-sm font-semibold mb-2 block">Metrics Output (Prometheus Format)</Label>
                    <ScrollArea className="h-96 border border-border rounded bg-background p-4">
                      <pre className="text-xs font-mono whitespace-pre-wrap">
                        {metricsOutput || 'No metrics available yet...'}
                      </pre>
                    </ScrollArea>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-border rounded-lg p-4 bg-card">
                      <div className="text-sm text-muted-foreground mb-1">Total Components</div>
                      <div className="text-2xl font-bold">{componentMetrics.size}</div>
                    </div>
                    <div className="border border-border rounded-lg p-4 bg-card">
                      <div className="text-sm text-muted-foreground mb-1">Total Connections</div>
                      <div className="text-2xl font-bold">{connectionMetrics.size}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Start emulation to see live metrics</p>
                </div>
              )}
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
                      placeholder="http://localhost:9090"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Scrape Interval</Label>
                    <Input
                      value={config.scrapeInterval || ''}
                      onChange={(e) => updateConfig({ scrapeInterval: e.target.value })}
                      placeholder="15s"
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


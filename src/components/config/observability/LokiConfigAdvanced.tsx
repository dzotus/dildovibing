import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, 
  Search, 
  Settings, 
  Activity,
  HardDrive,
  Plus,
  Trash2,
  Play,
  Edit2,
  X
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { OBSERVABILITY_PROFILES } from './profiles';

interface LokiConfigProps {
  componentId: string;
}

interface LogStream {
  name: string;
  labels: Record<string, string>;
  entries: number;
  size: number;
  lastEntry?: string;
}

interface Query {
  id: string;
  query: string;
  duration: number;
  results: number;
}

interface LokiConfig {
  serverUrl?: string;
  streams?: LogStream[];
  queries?: Query[];
  totalEntries?: number;
  totalSize?: number;
  ingestionRate?: number;
  queryLatency?: number;
}

export function LokiConfigAdvanced({ componentId }: LokiConfigProps) {
  const { nodes, updateNode, connections } = useCanvasStore();
  const { componentMetrics } = useEmulationStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  // Check if Loki has incoming connections (is receiving logs)
  const hasIncomingConnections = connections.some(conn => conn.target === componentId);

  // Получаем значения по умолчанию из профиля
  const profileDefaults = OBSERVABILITY_PROFILES.loki?.defaults || {};
  
  const config = (node.data.config as any) || {} as LokiConfig;
  const serverUrl = config.serverUrl || profileDefaults.serverUrl || 'http://loki:3100';
  
  // Получаем реальные метрики из симуляции
  const metrics = componentMetrics.get(componentId);
  const customMetrics = metrics?.customMetrics || {};
  
  // Используем реальные метрики вместо хардкода
  const ingestionRate = customMetrics.ingestion_lines_per_second || 0;
  const queryLatency = customMetrics.average_query_latency || 0;
  const activeStreams = customMetrics.active_streams || 0;
  const totalStorageSize = customMetrics.total_storage_size || 0;
  
  // Получаем streams из конфига (структура) - без хардкода дефолтных значений
  const streams = (config.streams && Array.isArray(config.streams)) ? config.streams : [];
  
  // Получаем queries из конфига (структура) - без хардкода дефолтных значений
  const queries = (config.queries && Array.isArray(config.queries)) ? config.queries : [];
  
  // Рассчитываем totalEntries и totalSize на основе реальных метрик или streams
  const totalEntries = useMemo(() => {
    if (streams.length > 0) {
      return streams.reduce((sum, s) => sum + (s.entries || 0), 0);
    }
    // Если нет streams в конфиге, используем оценку на основе метрик
    return Math.floor(ingestionRate * 60); // Примерная оценка за минуту
  }, [streams, ingestionRate]);
  
  const totalSize = useMemo(() => {
    if (totalStorageSize > 0) {
      // Конвертируем bytes в GB для отображения
      return totalStorageSize / (1024 * 1024 * 1024);
    }
    if (streams.length > 0) {
      return streams.reduce((sum, s) => sum + (s.size || 0), 0);
    }
    return 0;
  }, [streams, totalStorageSize]);

  const [editingStreamIndex, setEditingStreamIndex] = useState<number | null>(null);
  const [editingLabelKey, setEditingLabelKey] = useState<{ streamIndex: number; labelKey: string } | null>(null);
  const [newLabelKey, setNewLabelKey] = useState<{ streamIndex: number; key: string; value: string } | null>(null);
  const [editingQueryId, setEditingQueryId] = useState<string | null>(null);
  const [showAddQuery, setShowAddQuery] = useState(false);
  const [newQuery, setNewQuery] = useState({ query: '', duration: 0, results: 0 });

  const updateConfig = (updates: Partial<LokiConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addStream = () => {
    updateConfig({
      streams: [...streams, { name: 'new-stream', labels: { app: 'new' }, entries: 0, size: 0 }],
    });
  };

  const removeStream = (index: number) => {
    updateConfig({ streams: streams.filter((_, i) => i !== index) });
  };

  const updateStream = (index: number, field: keyof LogStream, value: any) => {
    const newStreams = [...streams];
    newStreams[index] = { ...newStreams[index], [field]: value };
    updateConfig({ streams: newStreams });
  };

  const updateStreamLabel = (streamIndex: number, labelKey: string, labelValue: string) => {
    const newStreams = [...streams];
    const stream = newStreams[streamIndex];
    const newLabels = { ...stream.labels, [labelKey]: labelValue };
    newStreams[streamIndex] = { ...stream, labels: newLabels };
    updateConfig({ streams: newStreams });
  };

  const removeStreamLabel = (streamIndex: number, labelKey: string) => {
    const newStreams = [...streams];
    const stream = newStreams[streamIndex];
    const newLabels = { ...stream.labels };
    delete newLabels[labelKey];
    newStreams[streamIndex] = { ...stream, labels: newLabels };
    updateConfig({ streams: newStreams });
  };

  const addStreamLabel = (streamIndex: number, key: string, value: string) => {
    if (!key || !value) return;
    // Check if label key already exists
    const stream = streams[streamIndex];
    if (stream.labels[key]) {
      // If key exists with the same value, do nothing (no need to update)
      if (stream.labels[key] === value) {
        // Label already exists with the same value - no action needed
        setNewLabelKey(null);
        return;
      }
      // If key exists with different value, update it
      updateStreamLabel(streamIndex, key, value);
    } else {
      // If key doesn't exist, add new label
      updateStreamLabel(streamIndex, key, value);
    }
    setNewLabelKey(null);
  };

  const addQuery = () => {
    if (!newQuery.query.trim()) return;
    const query: Query = {
      id: `query-${Date.now()}`,
      query: newQuery.query,
      duration: newQuery.duration,
      results: newQuery.results,
    };
    updateConfig({ queries: [...queries, query] });
    setNewQuery({ query: '', duration: 0, results: 0 });
    setShowAddQuery(false);
  };

  const removeQuery = (id: string) => {
    updateConfig({ queries: queries.filter(q => q.id !== id) });
  };

  const updateQuery = (id: string, field: keyof Query, value: any) => {
    const newQueries = queries.map(q => 
      q.id === id ? { ...q, [field]: value } : q
    );
    updateConfig({ queries: newQueries });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <FileText className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Loki</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Log Aggregation System
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
              <div className={`h-2 w-2 rounded-full ${hasIncomingConnections ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              {hasIncomingConnections ? 'Running' : 'Idle'}
            </Badge>
          </div>
        </div>

        <Separator />


        {/* Main Configuration Tabs */}
        <Tabs defaultValue="streams" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="streams" className="gap-2">
              <FileText className="h-4 w-4" />
              Log Streams
            </TabsTrigger>
            <TabsTrigger value="queries" className="gap-2">
              <Search className="h-4 w-4" />
              Queries
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Streams Tab */}
          <TabsContent value="streams" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Log Streams</CardTitle>
                    <CardDescription>Log stream configuration and labels</CardDescription>
                  </div>
                  <Button size="sm" onClick={addStream} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Stream
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {streams.map((stream, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="p-2 rounded bg-primary/10">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              {editingStreamIndex === index ? (
                                <div className="space-y-2">
                                  <Input
                                    value={stream.name}
                                    onChange={(e) => updateStream(index, 'name', e.target.value)}
                                    placeholder="stream-name"
                                    className="font-semibold"
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setEditingStreamIndex(null)}
                                    >
                                      <X className="h-3 w-3 mr-1" />
                                      Done
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2">
                                    <CardTitle className="text-lg">{stream.name}</CardTitle>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() => setEditingStreamIndex(index)}
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <CardDescription className="text-xs mt-1">
                                    {stream.entries?.toLocaleString() || 0} entries • {stream.size?.toFixed(2) || 0} GB
                                    {stream.lastEntry && ` • Last: ${stream.lastEntry}`}
                                  </CardDescription>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {streams.length > 1 && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeStream(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm font-semibold">Labels</Label>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                // If already editing a label for this stream, cancel it first
                                if (newLabelKey && newLabelKey.streamIndex === index) {
                                  setNewLabelKey(null);
                                } else {
                                  setNewLabelKey({ streamIndex: index, key: '', value: '' });
                                }
                              }}
                              disabled={editingLabelKey?.streamIndex === index}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              {newLabelKey && newLabelKey.streamIndex === index ? 'Cancel' : 'Add Label'}
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {Object.entries(stream.labels).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-2">
                                {editingLabelKey?.streamIndex === index && editingLabelKey.labelKey === key ? (
                                  <div className="flex items-center gap-2 flex-1">
                                    <Input
                                      value={key}
                                      placeholder="label-key"
                                      className="flex-1"
                                      disabled
                                    />
                                    <Input
                                      value={value}
                                      onChange={(e) => updateStreamLabel(index, key, e.target.value)}
                                      placeholder="label-value"
                                      className="flex-1"
                                      onBlur={() => setEditingLabelKey(null)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') setEditingLabelKey(null);
                                        if (e.key === 'Escape') setEditingLabelKey(null);
                                      }}
                                      autoFocus
                                    />
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={() => {
                                        removeStreamLabel(index, key);
                                        setEditingLabelKey(null);
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={() => setEditingLabelKey(null)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs cursor-pointer hover:bg-accent"
                                    onClick={() => setEditingLabelKey({ streamIndex: index, labelKey: key })}
                                  >
                                    {key}={value}
                                  </Badge>
                                )}
                              </div>
                            ))}
                            {newLabelKey && newLabelKey.streamIndex === index && (() => {
                              const stream = streams[index];
                              const keyExists = stream.labels[newLabelKey.key] !== undefined;
                              const valueMatches = stream.labels[newLabelKey.key] === newLabelKey.value;
                              const isDuplicate = keyExists && valueMatches;
                              
                              return (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={newLabelKey.key}
                                      onChange={(e) => setNewLabelKey({ ...newLabelKey, key: e.target.value })}
                                      placeholder="label-key"
                                      className={`flex-1 ${keyExists ? 'border-yellow-500' : ''}`}
                                    />
                                    <Input
                                      value={newLabelKey.value}
                                      onChange={(e) => setNewLabelKey({ ...newLabelKey, value: e.target.value })}
                                      placeholder="label-value"
                                      className="flex-1"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newLabelKey.key && newLabelKey.value && !isDuplicate) {
                                          addStreamLabel(index, newLabelKey.key, newLabelKey.value);
                                          // Clear form but keep it open for adding more labels
                                          setNewLabelKey({ streamIndex: index, key: '', value: '' });
                                        }
                                      }}
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        if (newLabelKey.key && newLabelKey.value && !isDuplicate) {
                                          addStreamLabel(index, newLabelKey.key, newLabelKey.value);
                                          // Clear form but keep it open for adding more labels
                                          setNewLabelKey({ streamIndex: index, key: '', value: '' });
                                        }
                                      }}
                                      disabled={!newLabelKey.key || !newLabelKey.value || isDuplicate}
                                      title={isDuplicate ? 'Label with this key and value already exists' : keyExists ? 'Will update existing label value' : 'Add new label'}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setNewLabelKey(null)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  {keyExists && (
                                    <p className="text-xs text-muted-foreground">
                                      {isDuplicate 
                                        ? `⚠️ Label "${newLabelKey.key}" already exists with value "${newLabelKey.value}"`
                                        : `ℹ️ Label "${newLabelKey.key}" exists with value "${stream.labels[newLabelKey.key]}". Will be updated.`
                                      }
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Queries Tab */}
          <TabsContent value="queries" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>LogQL Queries</CardTitle>
                    <CardDescription>Query log streams with LogQL</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowAddQuery(true)} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Query
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {showAddQuery && (
                  <Card className="mb-4 border-primary">
                    <CardHeader>
                      <CardTitle className="text-sm">New Query</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <Label>LogQL Query</Label>
                        <Textarea
                          value={newQuery.query}
                          onChange={(e) => setNewQuery({ ...newQuery, query: e.target.value })}
                          placeholder='{app="web"} |= "error"'
                          className="font-mono text-sm"
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Duration (ms)</Label>
                          <Input
                            type="number"
                            value={newQuery.duration}
                            onChange={(e) => setNewQuery({ ...newQuery, duration: parseInt(e.target.value) || 0 })}
                            placeholder="125"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Results</Label>
                          <Input
                            type="number"
                            value={newQuery.results}
                            onChange={(e) => setNewQuery({ ...newQuery, results: parseInt(e.target.value) || 0 })}
                            placeholder="1250"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={addQuery} disabled={!newQuery.query.trim()}>
                          Add
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          setShowAddQuery(false);
                          setNewQuery({ query: '', duration: 0, results: 0 });
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                <div className="space-y-3">
                  {queries.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No queries configured</p>
                      <p className="text-xs mt-2">Click "Add Query" to create a new LogQL query</p>
                    </div>
                  ) : (
                    queries.map((query) => (
                      <Card key={query.id} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              {editingQueryId === query.id ? (
                                <div className="space-y-2">
                                  <Textarea
                                    value={query.query}
                                    onChange={(e) => updateQuery(query.id, 'query', e.target.value)}
                                    placeholder='{app="web"} |= "error"'
                                    className="font-mono text-sm"
                                    rows={2}
                                  />
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label className="text-xs">Duration (ms)</Label>
                                      <Input
                                        type="number"
                                        value={query.duration}
                                        onChange={(e) => updateQuery(query.id, 'duration', parseInt(e.target.value) || 0)}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-xs">Results</Label>
                                      <Input
                                        type="number"
                                        value={query.results}
                                        onChange={(e) => updateQuery(query.id, 'results', parseInt(e.target.value) || 0)}
                                      />
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setEditingQueryId(null)}
                                    >
                                      <X className="h-3 w-3 mr-1" />
                                      Done
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2">
                                    <CardTitle className="text-sm font-mono">{query.query}</CardTitle>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() => setEditingQueryId(query.id)}
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <CardDescription className="text-xs mt-1">
                                    {query.results} results • {query.duration}ms
                                  </CardDescription>
                                </>
                              )}
                            </div>
                            {!editingQueryId && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeQuery(query.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Loki Server</CardTitle>
                <CardDescription>Server configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="server-url">Server URL</Label>
                  <Input
                    id="server-url"
                    type="url"
                    value={serverUrl}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Basic URL validation
                      if (value === '' || value.startsWith('http://') || value.startsWith('https://')) {
                        updateConfig({ serverUrl: value });
                      }
                    }}
                    placeholder={profileDefaults.serverUrl || 'http://loki:3100'}
                    pattern="https?://.*"
                  />
                  <p className="text-xs text-muted-foreground">
                    Server URL is used to identify this Loki instance when connecting from Grafana or other components. 
                    In simulation, logs are received automatically from connected components via data flow connections.
                    The URL is also used by Grafana datasource configuration to find this Loki instance.
                  </p>
                </div>
              </CardContent>
            </Card>
            
            {/* Real-time Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Real-time Metrics</CardTitle>
                <CardDescription>Current metrics from simulation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Ingestion Rate</Label>
                    <div className="text-2xl font-bold">{Math.round(ingestionRate).toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">lines/second</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Query Latency</Label>
                    <div className="text-2xl font-bold">{Math.round(queryLatency)}</div>
                    <p className="text-xs text-muted-foreground">ms (average)</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Active Streams</Label>
                    <div className="text-2xl font-bold">{activeStreams.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">streams</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Storage Size</Label>
                    <div className="text-2xl font-bold">{totalSize.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">GB</p>
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


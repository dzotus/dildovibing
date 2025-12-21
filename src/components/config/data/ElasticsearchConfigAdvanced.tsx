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
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';
import { 
  Search, 
  Database, 
  Settings, 
  Activity,
  Shield,
  HardDrive,
  Plus,
  Trash2,
  FileText,
  Play,
  RefreshCcw,
  Code,
  Layers,
  AlertCircle
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { emulationEngine } from '@/core/EmulationEngine';
import { showSuccess, showError } from '@/utils/toast';

interface ElasticsearchConfigProps {
  componentId: string;
}

interface Index {
  name: string;
  docs: number;
  size: number;
  shards: number;
  replicas: number;
  health: 'green' | 'yellow' | 'red';
  mappings?: Record<string, any>;
  settings?: Record<string, any>;
}

interface Query {
  id: string;
  query: string;
  status: 'running' | 'success' | 'error';
  duration?: number;
  hits?: number;
  took?: number;
}

interface ElasticsearchConfig {
  clusterName?: string;
  nodes?: string[];
  index?: string;
  shards?: number;
  replicas?: number;
  refreshInterval?: string;
  enableSSL?: boolean;
  enableAuth?: boolean;
  username?: string;
  password?: string;
  indices?: Index[];
  totalDocs?: number;
  totalSize?: number;
  queries?: Query[];
  clusterHealth?: 'green' | 'yellow' | 'red';
  activeShards?: number;
  relocatingShards?: number;
  initializingShards?: number;
}

export function ElasticsearchConfigAdvanced({ componentId }: ElasticsearchConfigProps) {
  const { nodes, updateNode, connections } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as ElasticsearchConfig;
  const clusterName = config.clusterName || 'archiphoenix-cluster';
  const nodesList = config.nodes || ['localhost:9200'];
  const index = config.index || 'archiphoenix-index';
  const shards = config.shards || 5;
  const replicas = config.replicas || 1;
  const refreshInterval = config.refreshInterval || '1s';
  const enableSSL = config.enableSSL ?? false;
  const enableAuth = config.enableAuth ?? false;
  const username = config.username || 'elastic';
  const password = config.password || '';
  const indices = config.indices || [];
  const queries = config.queries || [];
  
  // Check if component has connections - if not, show red/yellow health
  const hasConnections = connections.some(conn => conn.source === componentId || conn.target === componentId);
  const elasticsearchEngine = (emulationEngine as any).elasticsearchRoutingEngines?.get(componentId);
  const engineMetrics = elasticsearchEngine?.getMetrics();
  
  // Determine cluster health: use engine metrics if available and connected, otherwise show status based on connections
  let clusterHealth: 'green' | 'yellow' | 'red' = config.clusterHealth || 'green';
  if (engineMetrics) {
    clusterHealth = engineMetrics.clusterHealth;
  } else if (!hasConnections) {
    // If no connections and no engine, show yellow (not fully operational)
    clusterHealth = 'yellow';
  }
  const activeShards = config.activeShards || 10;
  const relocatingShards = config.relocatingShards || 0;
  const initializingShards = config.initializingShards || 0;
  const totalDocs = config.totalDocs || indices.reduce((sum, i) => sum + i.docs, 0);
  const totalSize = config.totalSize || indices.reduce((sum, i) => sum + i.size, 0);
  
  const [editingIndexIndex, setEditingIndexIndex] = useState<number | null>(null);
  const [showQueryEditor, setShowQueryEditor] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [queryError, setQueryError] = useState<string>('');
  const [refreshIntervalError, setRefreshIntervalError] = useState<string>('');

  const handleRefresh = () => {
    const elasticsearchEngine = (emulationEngine as any).elasticsearchRoutingEngines?.get(componentId);
    if (!elasticsearchEngine) {
      showError('Elasticsearch engine not initialized. Please start emulation first.');
      return;
    }
    
    // Get latest metrics and state from engine
    const metrics = elasticsearchEngine.getMetrics();
    const engineIndices = elasticsearchEngine.getIndices();
    const recentQueries = elasticsearchEngine.getRecentQueries(100);
    
    // Update indices in config with runtime state
    const updatedIndices = engineIndices.map((engineIdx: any) => {
      const configIdx = indices.find(i => i.name === engineIdx.name);
      return {
        ...engineIdx,
        // Preserve config settings
        shards: configIdx?.shards ?? engineIdx.shards,
        replicas: configIdx?.replicas ?? engineIdx.replicas,
      };
    });
    
    // Update config with refreshed data
    updateConfig({
      indices: updatedIndices.length > 0 ? updatedIndices : indices,
      queries: recentQueries.map((q: any) => ({
        id: `query-${Date.now()}-${Math.random()}`,
        query: JSON.stringify(q.query || q.queryString || '', null, 2),
        status: q.success ? 'success' : 'error',
        duration: q.latency,
        hits: q.hits,
        took: q.took,
      })).slice(0, 100),
      clusterHealth: metrics.clusterHealth,
      activeShards: metrics.activeShards,
      relocatingShards: metrics.relocatingShards,
      initializingShards: metrics.initializingShards,
      totalDocs: metrics.totalDocs,
      totalSize: metrics.totalSize,
    });
    
    showSuccess('Elasticsearch metrics refreshed');
  };

  const updateConfig = (updates: Partial<ElasticsearchConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
    // Очистка ошибок валидации при успешном обновлении
    if (updates.nodes !== undefined) {
      const newErrors = { ...fieldErrors };
      if (newErrors.nodes) delete newErrors.nodes;
      setFieldErrors(newErrors);
    }
  };
  
  // Валидация обязательных полей
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  const validateNodes = () => {
    if (!nodesList || nodesList.length === 0) {
      setFieldErrors({ ...fieldErrors, nodes: 'Необходимо указать хотя бы один узел' });
      return false;
    }
    // Проверка формата host:port
    const invalidNodes = nodesList.filter(n => {
      if (!n || !n.trim()) return true;
      const parts = n.trim().split(':');
      if (parts.length !== 2) return true;
      const port = parseInt(parts[1]);
      return isNaN(port) || port <= 0 || port > 65535;
    });
    if (invalidNodes.length > 0) {
      setFieldErrors({ ...fieldErrors, nodes: 'Неверный формат узла. Используйте формат host:port' });
      return false;
    }
    const newErrors = { ...fieldErrors };
    if (newErrors.nodes) delete newErrors.nodes;
    setFieldErrors(newErrors);
    return true;
  };
  
  const validateConnectionFields = () => {
    return validateNodes();
  };

  const validateRefreshInterval = (value: string): boolean => {
    if (!value.trim()) {
      setRefreshIntervalError('Refresh interval cannot be empty');
      return false;
    }
    
    // Elasticsearch refresh interval format: number + unit (s, m, h, d)
    // Examples: 1s, 5m, 1h, -1 (disabled)
    const pattern = /^-1$|^\d+[smhd]$/i;
    if (!pattern.test(value.trim())) {
      setRefreshIntervalError('Invalid format. Use format like: 1s, 5m, 1h, or -1 to disable');
      return false;
    }
    
    setRefreshIntervalError('');
    return true;
  };

  const addNode = () => {
    updateConfig({ nodes: [...nodesList, 'localhost:9201'] });
  };

  const removeNode = (index: number) => {
    updateConfig({ nodes: nodesList.filter((_, i) => i !== index) });
  };

  const updateNodeAddress = (index: number, value: string) => {
    const newNodes = [...nodesList];
    newNodes[index] = value;
    updateConfig({ nodes: newNodes });
  };

  const addIndex = () => {
    updateConfig({
      indices: [...indices, { name: 'new-index', docs: 0, size: 0, shards: 1, replicas: 1, health: 'yellow' }],
    });
  };

  const removeIndex = (index: number) => {
    updateConfig({ indices: indices.filter((_, i) => i !== index) });
  };

  const updateIndex = (index: number, field: string, value: any) => {
    const newIndices = [...indices];
    newIndices[index] = { ...newIndices[index], [field]: value };
    updateConfig({ indices: newIndices });
  };

  const validateQuery = (query: string): { valid: boolean; error?: string } => {
    if (!query.trim()) {
      return { valid: false, error: 'Query cannot be empty' };
    }
    
    // Try to parse as JSON if it looks like JSON
    const trimmed = query.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(trimmed);
      } catch (e) {
        return { valid: false, error: 'Invalid JSON format' };
      }
    }
    
    // Check if it's a valid Elasticsearch API call format
    const lines = trimmed.split('\n');
    if (lines.length > 1) {
      const firstLine = lines[0].trim();
      if (!firstLine.match(/^(GET|POST|PUT|DELETE)\s+/)) {
        return { valid: false, error: 'API call format should start with HTTP method (GET, POST, PUT, DELETE)' };
      }
      
      // Try to parse JSON body if present
      if (lines.length > 1) {
        const body = lines.slice(1).join('\n').trim();
        if (body && (body.startsWith('{') || body.startsWith('['))) {
          try {
            JSON.parse(body);
          } catch (e) {
            return { valid: false, error: 'Invalid JSON in request body' };
          }
        }
      }
    }
    
    return { valid: true };
  };

  const executeQuery = () => {
    if (!queryText.trim()) {
      setQueryError('Query cannot be empty');
      return;
    }
    
    const validation = validateQuery(queryText);
    if (!validation.valid) {
      setQueryError(validation.error || 'Invalid query format');
      return;
    }
    
    setQueryError('');
    
    // Try to execute query through engine if available
    let queryResult: Query | null = null;
    if (elasticsearchEngine) {
      try {
        const result = elasticsearchEngine.executeQuery(queryText);
        queryResult = {
          id: `query-${Date.now()}`,
          query: queryText,
          status: result.success ? 'success' : 'error',
          duration: result.latency || result.took || 0,
          hits: result.hits,
          took: result.took,
        };
      } catch (error) {
        queryResult = {
          id: `query-${Date.now()}`,
          query: queryText,
          status: 'error',
          duration: 0,
          hits: 0,
          took: 0,
        };
      }
    } else {
      // If engine not available, just mark as running (simulation)
      queryResult = {
        id: `query-${Date.now()}`,
        query: queryText,
        status: 'running',
        duration: 0,
        hits: 0,
        took: 0,
      };
    }
    
    if (queryResult) {
      updateConfig({ queries: [queryResult, ...queries.slice(0, 99)] });
      setQueryText('');
      setShowQueryEditor(false);
      showSuccess('Query executed');
    }
  };

  const deleteQuery = (queryId: string) => {
    updateConfig({ queries: queries.filter(q => q.id !== queryId) });
    showSuccess('Query deleted');
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'green':
        return 'bg-green-500';
      case 'yellow':
        return 'bg-yellow-500';
      case 'red':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Search className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Elasticsearch</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Distributed Search & Analytics Engine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
              <div className={`h-2 w-2 rounded-full ${
                clusterHealth === 'green' ? 'bg-green-500' :
                clusterHealth === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
              } animate-pulse`} />
              {clusterHealth === 'green' ? 'Healthy' : clusterHealth === 'yellow' ? 'Degraded' : 'Unhealthy'}
            </Badge>
            <Button size="sm" variant="outline" onClick={handleRefresh}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator />

        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Indices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{indices.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Total indices</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(totalDocs / 1000000).toFixed(1)}M</div>
              <p className="text-xs text-muted-foreground mt-1">Total documents</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Size</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSize.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground mt-1">GB</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Nodes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{nodesList.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Cluster nodes</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Configuration Tabs */}
        <Tabs defaultValue="indices" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="indices" className="gap-2">
              <FileText className="h-4 w-4" />
              Indices
            </TabsTrigger>
            <TabsTrigger value="devtools" className="gap-2">
              <Code className="h-4 w-4" />
              Dev Tools
            </TabsTrigger>
            <TabsTrigger value="cluster" className="gap-2">
              <Database className="h-4 w-4" />
              Cluster
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Indices Tab */}
          <TabsContent value="indices" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Indices</CardTitle>
                    <CardDescription>Elasticsearch index configuration</CardDescription>
                  </div>
                  <Button size="sm" onClick={addIndex} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Index
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {indices.map((idx, index) => {
                    // Get health from engine if available, otherwise use config
                    let indexHealth = idx.health;
                    if (elasticsearchEngine) {
                      const engineIndices = elasticsearchEngine.getIndices();
                      const engineIndex = engineIndices.find(ei => ei.name === idx.name);
                      if (engineIndex) {
                        indexHealth = engineIndex.health;
                      }
                    } else if (!hasConnections) {
                      // If no connections, show yellow for indices
                      indexHealth = 'yellow';
                    }
                    
                    return (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`h-3 w-3 rounded-full ${getHealthColor(indexHealth)}`} />
                            <div>
                              <CardTitle className="text-lg">{idx.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {idx.shards} shards • {idx.replicas} replicas • Health: {indexHealth}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={indexHealth === 'green' ? 'default' : indexHealth === 'yellow' ? 'secondary' : 'destructive'}>
                              {indexHealth}
                            </Badge>
                            {indices.length > 1 && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeIndex(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Documents:</span>
                            <span className="ml-2 font-semibold">{idx.docs.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Size:</span>
                            <span className="ml-2 font-semibold">{idx.size} GB</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Shards:</span>
                            <span className="ml-2 font-semibold">{idx.shards}</span>
                          </div>
                        </div>
                        {editingIndexIndex === index && (
                          <div className="pt-4 border-t space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Number of Shards</Label>
                                <Input
                                  type="number"
                                  value={idx.shards}
                                  onChange={(e) => updateIndex(index, 'shards', Number(e.target.value))}
                                  min={1}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Number of Replicas</Label>
                                <Input
                                  type="number"
                                  value={idx.replicas}
                                  onChange={(e) => updateIndex(index, 'replicas', Number(e.target.value))}
                                  min={0}
                                />
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingIndexIndex(null)}
                            >
                              Done
                            </Button>
                          </div>
                        )}
                        {editingIndexIndex !== index && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingIndexIndex(index)}
                          >
                            Edit Settings
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dev Tools Tab */}
          <TabsContent value="devtools" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Dev Tools</CardTitle>
                    <CardDescription>Execute Elasticsearch queries and API calls</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowQueryEditor(true)} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    New Query
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {showQueryEditor && (
                  <Card className="mb-4 border-primary">
                    <CardHeader>
                      <CardTitle>Execute Query</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Query (JSON or Elasticsearch API)</Label>
                        <Textarea
                          value={queryText}
                          onChange={(e) => {
                            setQueryText(e.target.value);
                            if (queryError) setQueryError('');
                          }}
                          onBlur={() => {
                            if (queryText.trim()) {
                              const validation = validateQuery(queryText);
                              if (!validation.valid) {
                                setQueryError(validation.error || 'Invalid query format');
                              }
                            }
                          }}
                          placeholder='GET /_search\n{\n  "query": {\n    "match_all": {}\n  }\n}'
                          rows={8}
                          className={`font-mono text-sm ${queryError ? 'border-destructive' : ''}`}
                        />
                        {queryError && (
                          <div className="flex items-center gap-1 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4" />
                            <span>{queryError}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={executeQuery} disabled={!queryText.trim() || !!queryError}>
                          <Play className="h-4 w-4 mr-2" />
                          Execute
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowQueryEditor(false);
                          setQueryText('');
                          setQueryError('');
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {queries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No queries executed</p>
                ) : (
                  <div className="space-y-2">
                    {queries.map((query) => (
                      <Card key={query.id} className="border-l-4 border-l-blue-500">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={
                                  query.status === 'success' ? 'default' :
                                  query.status === 'error' ? 'destructive' : 'secondary'
                                }>
                                  {query.status}
                                </Badge>
                                {query.took !== undefined && (
                                  <Badge variant="outline">{query.took}ms</Badge>
                                )}
                                {query.hits !== undefined && (
                                  <Badge variant="outline">{query.hits} hits</Badge>
                                )}
                              </div>
                              <pre className="text-xs font-mono bg-muted p-2 rounded overflow-x-auto">
                                {query.query}
                              </pre>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteQuery(query.id)}
                              className="ml-2"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cluster Tab */}
          <TabsContent value="cluster" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Cluster Configuration</CardTitle>
                <CardDescription>Elasticsearch cluster connection and topology</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Cluster Health</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${
                          clusterHealth === 'green' ? 'bg-green-500' :
                          clusterHealth === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                        }`} />
                        <span className="text-lg font-semibold uppercase">{clusterHealth}</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Active Shards</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <span className="text-2xl font-bold">{activeShards}</span>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Relocating</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <span className="text-2xl font-bold">{relocatingShards}</span>
                    </CardContent>
                  </Card>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="cluster-name">Cluster Name</Label>
                  <Input
                    id="cluster-name"
                    value={clusterName}
                    onChange={(e) => updateConfig({ clusterName: e.target.value })}
                    placeholder="my-cluster"
                  />
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>
                      Node Addresses <span className="text-destructive">*</span>
                    </Label>
                    <Button size="sm" onClick={addNode} variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Node
                    </Button>
                  </div>
                  {nodesList.length === 0 && fieldErrors.nodes && (
                    <div className="flex items-center gap-1 text-sm text-destructive p-2 border border-destructive rounded">
                      <AlertCircle className="h-4 w-4" />
                      <span>{fieldErrors.nodes}</span>
                    </div>
                  )}
                  <div className="space-y-2">
                    {nodesList.map((nodeAddr, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={nodeAddr}
                          onChange={(e) => {
                            updateNodeAddress(index, e.target.value);
                            if (fieldErrors.nodes) {
                              validateNodes();
                            }
                          }}
                          onBlur={validateNodes}
                          placeholder="localhost:9200"
                          className={`flex-1 ${fieldErrors.nodes ? 'border-destructive' : ''}`}
                        />
                        {nodesList.length > 1 && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeNode(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  {fieldErrors.nodes && nodesList.length > 0 && (
                    <div className="flex items-center gap-1 text-sm text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      <span>{fieldErrors.nodes}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={() => {
                      if (validateConnectionFields()) {
                        showSuccess('Параметры подключения сохранены');
                      } else {
                        showError('Пожалуйста, укажите хотя бы один корректный узел (host:port)');
                      }
                    }}
                  >
                    Сохранить настройки
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>SSL/TLS and authentication</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable SSL/TLS</Label>
                    <div className="text-sm text-muted-foreground">
                      Encrypt connections to cluster
                    </div>
                  </div>
                  <Switch
                    checked={enableSSL}
                    onCheckedChange={(checked) => updateConfig({ enableSSL: checked })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Authentication</Label>
                    <div className="text-sm text-muted-foreground">
                      Require authentication
                    </div>
                  </div>
                  <Switch
                    checked={enableAuth}
                    onCheckedChange={(checked) => updateConfig({ enableAuth: checked })}
                  />
                </div>
                {enableAuth && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={username}
                          onChange={(e) => updateConfig({ username: e.target.value })}
                          placeholder="elastic"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => updateConfig({ password: e.target.value })}
                          placeholder="password"
                        />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Index Settings</CardTitle>
                <CardDescription>Default index configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="index">Index Name</Label>
                  <Input
                    id="index"
                    value={index}
                    onChange={(e) => updateConfig({ index: e.target.value })}
                    placeholder="my-index"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="shards">Number of Shards</Label>
                    <Input
                      id="shards"
                      type="number"
                      min="1"
                      max="100"
                      value={shards}
                      onChange={(e) => updateConfig({ shards: parseInt(e.target.value) || 5 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="replicas">Number of Replicas</Label>
                    <Input
                      id="replicas"
                      type="number"
                      min="0"
                      max="10"
                      value={replicas}
                      onChange={(e) => updateConfig({ replicas: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="refresh-interval">Refresh Interval</Label>
                  <Input
                    id="refresh-interval"
                    value={refreshInterval}
                    onChange={(e) => {
                      updateConfig({ refreshInterval: e.target.value });
                      if (refreshIntervalError) {
                        validateRefreshInterval(e.target.value);
                      }
                    }}
                    onBlur={(e) => validateRefreshInterval(e.target.value)}
                    placeholder="1s"
                    className={refreshIntervalError ? 'border-destructive' : ''}
                  />
                  {refreshIntervalError && (
                    <div className="flex items-center gap-1 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span>{refreshIntervalError}</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">How often to refresh the index (e.g., 1s, 5m, 1h, or -1 to disable)</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


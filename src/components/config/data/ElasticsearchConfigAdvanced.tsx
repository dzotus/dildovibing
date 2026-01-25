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
import { useState, useEffect, useMemo } from 'react';
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
  AlertCircle,
  BarChart3
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { emulationEngine } from '@/core/EmulationEngine';
import { showSuccess, showError } from '@/utils/toast';
import { ElasticsearchClusterView } from './ElasticsearchClusterView';
import { ElasticsearchOperationsHistory } from './ElasticsearchOperationsHistory';
import { ElasticsearchQueryEditor } from './ElasticsearchQueryEditor';
import {
  DEFAULT_CLUSTER_NAME,
  DEFAULT_INDEX_NAME,
  DEFAULT_NODE_ADDRESS,
  DEFAULT_NUMBER_OF_SHARDS,
  DEFAULT_NUMBER_OF_REPLICAS,
  DEFAULT_REFRESH_INTERVAL,
  DEFAULT_USERNAME,
  MAX_RECENT_QUERIES,
} from '@/core/elasticsearch/constants';

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
  const clusterName = config.clusterName || DEFAULT_CLUSTER_NAME;
  const nodesList = config.nodes || [DEFAULT_NODE_ADDRESS];
  const index = config.index || DEFAULT_INDEX_NAME;
  const shards = config.shards || DEFAULT_NUMBER_OF_SHARDS;
  const replicas = config.replicas || DEFAULT_NUMBER_OF_REPLICAS;
  const refreshInterval = config.refreshInterval || DEFAULT_REFRESH_INTERVAL;
  const enableSSL = config.enableSSL ?? false;
  const enableAuth = config.enableAuth ?? false;
  const username = config.username || DEFAULT_USERNAME;
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
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [metricsHistory, setMetricsHistory] = useState<Array<{
    timestamp: number;
    metrics: typeof engineMetrics;
  }>>([]);
  const [operationHistory, setOperationHistory] = useState<Array<{
    timestamp: number;
    operation: 'index' | 'get' | 'search' | 'delete' | 'bulk' | 'update';
    index?: string;
    id?: string;
    latency: number;
    success: boolean;
    hits?: number;
    items?: number;
    errors?: number;
  }>>([]);

  const handleRefresh = () => {
    const elasticsearchEngine = (emulationEngine as any).elasticsearchRoutingEngines?.get(componentId);
    if (!elasticsearchEngine) {
      showError('Elasticsearch engine not initialized. Please start emulation first.');
      return;
    }
    
    // Get latest metrics and state from engine
    const metrics = elasticsearchEngine.getMetrics();
    const engineIndices = elasticsearchEngine.getIndices();
    const recentQueries = elasticsearchEngine.getRecentQueries(MAX_RECENT_QUERIES);
    
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

  // Query templates
  const queryTemplates = {
    'match_all': `GET /_search
{
  "query": {
    "match_all": {}
  }
}`,
    'match': `GET /_search
{
  "query": {
    "match": {
      "field": "value"
    }
  }
}`,
    'bool': `GET /_search
{
  "query": {
    "bool": {
      "must": [
        { "match": { "field1": "value1" } }
      ],
      "should": [
        { "match": { "field2": "value2" } }
      ],
      "must_not": [
        { "term": { "status": "deleted" } }
      ]
    }
  }
}`,
    'range': `GET /_search
{
  "query": {
    "range": {
      "timestamp": {
        "gte": "2024-01-01",
        "lte": "2024-12-31"
      }
    }
  }
}`,
    'term': `GET /_search
{
  "query": {
    "term": {
      "status": "active"
    }
  }
}`,
    'index_document': `POST /${index}/_doc
{
  "field1": "value1",
  "field2": "value2"
}`,
    'get_document': `GET /${index}/_doc/{id}`,
    'delete_document': `DELETE /${index}/_doc/{id}`,
    'bulk': `POST /_bulk
{ "index": { "_index": "${index}", "_id": "1" } }
{ "field1": "value1" }
{ "index": { "_index": "${index}", "_id": "2" } }
{ "field1": "value2" }`,
    'cluster_health': `GET /_cluster/health`,
    'cluster_stats': `GET /_cluster/stats`,
    'indices_list': `GET /_cat/indices?v`,
    'index_info': `GET /${index}`,
  };

  const applyTemplate = (templateKey: string) => {
    const template = queryTemplates[templateKey as keyof typeof queryTemplates];
    if (template) {
      setQueryText(template);
      setSelectedTemplate(templateKey);
      setQueryError('');
    }
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

  // Update metrics history in real-time
  useEffect(() => {
    if (!elasticsearchEngine || !engineMetrics) return;

    const interval = setInterval(() => {
      const currentMetrics = elasticsearchEngine.getMetrics();
      setMetricsHistory((prev) => {
        const newHistory = [
          ...prev,
          {
            timestamp: Date.now(),
            metrics: currentMetrics,
          },
        ];
        // Keep only last 100 data points
        return newHistory.slice(-100);
      });
      
      // Update operation history
      const history = elasticsearchEngine.getOperationHistory(100);
      setOperationHistory(history);
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [elasticsearchEngine, engineMetrics]);

  // Prepare chart data from metrics history
  const chartData = useMemo(() => {
    return metricsHistory.map((entry) => {
      const m = entry.metrics;
      return {
        time: new Date(entry.timestamp).toLocaleTimeString(),
        indexOps: m?.indexOperationsPerSecond || 0,
        searchOps: m?.searchOperationsPerSecond || 0,
        avgIndexLatency: m?.averageIndexLatency || 0,
        avgSearchLatency: m?.averageSearchLatency || 0,
        avgGetLatency: m?.averageGetLatency || 0,
        totalDocs: m?.totalDocs || 0,
        totalSize: m?.totalSize || 0,
        activeShards: m?.activeShards || 0,
        indexOpsP50: m?.operationMetrics?.index?.p50Latency || 0,
        indexOpsP99: m?.operationMetrics?.index?.p99Latency || 0,
        searchOpsP50: m?.operationMetrics?.search?.p50Latency || 0,
        searchOpsP99: m?.operationMetrics?.search?.p99Latency || 0,
        indexErrorRate: m?.operationMetrics?.index?.errorRate || 0,
        searchErrorRate: m?.operationMetrics?.search?.errorRate || 0,
      };
    });
  }, [metricsHistory]);

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
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="indices" className="gap-2">
              <FileText className="h-4 w-4" />
              Indices
            </TabsTrigger>
            <TabsTrigger value="devtools" className="gap-2">
              <Code className="h-4 w-4" />
              Dev Tools
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Metrics
            </TabsTrigger>
            <TabsTrigger value="cluster" className="gap-2">
              <Database className="h-4 w-4" />
              Cluster
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <Activity className="h-4 w-4" />
              History
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
                      <CardDescription>Use templates or write custom queries</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Query Templates */}
                      <div className="space-y-2">
                        <Label>Query Templates</Label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant={selectedTemplate === 'match_all' ? 'default' : 'outline'}
                            onClick={() => applyTemplate('match_all')}
                          >
                            Match All
                          </Button>
                          <Button
                            size="sm"
                            variant={selectedTemplate === 'match' ? 'default' : 'outline'}
                            onClick={() => applyTemplate('match')}
                          >
                            Match
                          </Button>
                          <Button
                            size="sm"
                            variant={selectedTemplate === 'bool' ? 'default' : 'outline'}
                            onClick={() => applyTemplate('bool')}
                          >
                            Bool
                          </Button>
                          <Button
                            size="sm"
                            variant={selectedTemplate === 'range' ? 'default' : 'outline'}
                            onClick={() => applyTemplate('range')}
                          >
                            Range
                          </Button>
                          <Button
                            size="sm"
                            variant={selectedTemplate === 'term' ? 'default' : 'outline'}
                            onClick={() => applyTemplate('term')}
                          >
                            Term
                          </Button>
                          <Button
                            size="sm"
                            variant={selectedTemplate === 'index_document' ? 'default' : 'outline'}
                            onClick={() => applyTemplate('index_document')}
                          >
                            Index Doc
                          </Button>
                          <Button
                            size="sm"
                            variant={selectedTemplate === 'get_document' ? 'default' : 'outline'}
                            onClick={() => applyTemplate('get_document')}
                          >
                            Get Doc
                          </Button>
                          <Button
                            size="sm"
                            variant={selectedTemplate === 'delete_document' ? 'default' : 'outline'}
                            onClick={() => applyTemplate('delete_document')}
                          >
                            Delete Doc
                          </Button>
                          <Button
                            size="sm"
                            variant={selectedTemplate === 'bulk' ? 'default' : 'outline'}
                            onClick={() => applyTemplate('bulk')}
                          >
                            Bulk
                          </Button>
                          <Button
                            size="sm"
                            variant={selectedTemplate === 'cluster_health' ? 'default' : 'outline'}
                            onClick={() => applyTemplate('cluster_health')}
                          >
                            Cluster Health
                          </Button>
                          <Button
                            size="sm"
                            variant={selectedTemplate === 'cluster_stats' ? 'default' : 'outline'}
                            onClick={() => applyTemplate('cluster_stats')}
                          >
                            Cluster Stats
                          </Button>
                          <Button
                            size="sm"
                            variant={selectedTemplate === 'indices_list' ? 'default' : 'outline'}
                            onClick={() => applyTemplate('indices_list')}
                          >
                            List Indices
                          </Button>
                          <Button
                            size="sm"
                            variant={selectedTemplate === 'index_info' ? 'default' : 'outline'}
                            onClick={() => applyTemplate('index_info')}
                          >
                            Index Info
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Query (JSON or Elasticsearch API)</Label>
                        <ElasticsearchQueryEditor
                          value={queryText}
                          onChange={(value) => {
                            setQueryText(value);
                            setSelectedTemplate('');
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
                          error={queryError}
                          className="min-h-[300px]"
                        />
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
                          setSelectedTemplate('');
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

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-4 mt-4">
            {!engineMetrics ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Metrics will appear when emulation is running</p>
                    <p className="text-sm mt-2">Start emulation to see real-time metrics</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Performance Metrics Charts */}
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                    <CardDescription>Real-time operation metrics and latency</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Operations Per Second */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Operations Per Second</Label>
                        <div className="flex gap-2">
                          <Badge variant="outline">
                            Index: {engineMetrics.indexOperationsPerSecond.toFixed(1)}/s
                          </Badge>
                          <Badge variant="outline">
                            Search: {engineMetrics.searchOperationsPerSecond.toFixed(1)}/s
                          </Badge>
                        </div>
                      </div>
                      {chartData.length > 0 ? (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="time" />
                              <YAxis label={{ value: 'Ops/s', angle: -90, position: 'insideLeft' }} />
                              <Tooltip />
                              <Legend />
                              <Line 
                                type="monotone" 
                                dataKey="indexOps" 
                                stroke="#8884d8" 
                                name="Index Ops/s"
                                strokeWidth={2}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="searchOps" 
                                stroke="#82ca9d" 
                                name="Search Ops/s"
                                strokeWidth={2}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                          No metrics data yet
                        </div>
                      )}
                    </div>

                    {/* Latency Over Time */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Latency Over Time</Label>
                        <div className="flex gap-2">
                          <Badge variant="outline">
                            Index: {engineMetrics.averageIndexLatency.toFixed(1)}ms
                          </Badge>
                          <Badge variant="outline">
                            Search: {engineMetrics.averageSearchLatency.toFixed(1)}ms
                          </Badge>
                          <Badge variant="outline">
                            Get: {engineMetrics.averageGetLatency.toFixed(1)}ms
                          </Badge>
                        </div>
                      </div>
                      {chartData.length > 0 ? (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="time" />
                              <YAxis label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft' }} />
                              <Tooltip />
                              <Legend />
                              <Area 
                                type="monotone" 
                                dataKey="avgIndexLatency" 
                                stroke="#8884d8" 
                                fill="#8884d8" 
                                fillOpacity={0.3}
                                name="Index Latency (ms)"
                              />
                              <Area 
                                type="monotone" 
                                dataKey="avgSearchLatency" 
                                stroke="#82ca9d" 
                                fill="#82ca9d" 
                                fillOpacity={0.3}
                                name="Search Latency (ms)"
                              />
                              <Area 
                                type="monotone" 
                                dataKey="avgGetLatency" 
                                stroke="#ffc658" 
                                fill="#ffc658" 
                                fillOpacity={0.3}
                                name="Get Latency (ms)"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                          No metrics data yet
                        </div>
                      )}
                    </div>

                    {/* Latency Percentiles */}
                    {chartData.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-base font-semibold">Latency Percentiles (P50/P99)</Label>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="time" />
                              <YAxis label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft' }} />
                              <Tooltip />
                              <Legend />
                              <Line 
                                type="monotone" 
                                dataKey="indexOpsP50" 
                                stroke="#8884d8" 
                                name="Index P50"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                              />
                              <Line 
                                type="monotone" 
                                dataKey="indexOpsP99" 
                                stroke="#8884d8" 
                                name="Index P99"
                                strokeWidth={2}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="searchOpsP50" 
                                stroke="#82ca9d" 
                                name="Search P50"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                              />
                              <Line 
                                type="monotone" 
                                dataKey="searchOpsP99" 
                                stroke="#82ca9d" 
                                name="Search P99"
                                strokeWidth={2}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Error Rates */}
                    {chartData.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-base font-semibold">Error Rates</Label>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="time" />
                              <YAxis label={{ value: 'Error Rate (%)', angle: -90, position: 'insideLeft' }} />
                              <Tooltip />
                              <Legend />
                              <Area 
                                type="monotone" 
                                dataKey="indexErrorRate" 
                                stroke="#ef4444" 
                                fill="#ef4444" 
                                fillOpacity={0.3}
                                name="Index Error Rate (%)"
                              />
                              <Area 
                                type="monotone" 
                                dataKey="searchErrorRate" 
                                stroke="#f59e0b" 
                                fill="#f59e0b" 
                                fillOpacity={0.3}
                                name="Search Error Rate (%)"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Operation Type Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle>Operation Type Metrics</CardTitle>
                    <CardDescription>Detailed metrics by operation type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {Object.entries(engineMetrics.operationMetrics || {}).map(([opType, opMetrics]: [string, any]) => (
                        <Card key={opType} className="border-border">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium capitalize">{opType} Operations</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="text-2xl font-bold">{opMetrics.operationsPerSecond.toFixed(1)}</div>
                            <p className="text-xs text-muted-foreground">Ops/s</p>
                            <Separator />
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Avg Latency:</span>
                                <span className="font-semibold">{opMetrics.averageLatency.toFixed(1)}ms</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">P50:</span>
                                <span className="font-semibold">{opMetrics.p50Latency.toFixed(1)}ms</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">P99:</span>
                                <span className="font-semibold">{opMetrics.p99Latency.toFixed(1)}ms</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Error Rate:</span>
                                <span className={`font-semibold ${opMetrics.errorRate > 0 ? 'text-destructive' : ''}`}>
                                  {(opMetrics.errorRate * 100).toFixed(2)}%
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total:</span>
                                <span className="font-semibold">{opMetrics.totalOperations.toLocaleString()}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Index Metrics */}
                {engineMetrics.indexMetrics && engineMetrics.indexMetrics.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Index Metrics</CardTitle>
                      <CardDescription>Metrics per index</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {engineMetrics.indexMetrics.map((idxMetrics: any) => (
                          <Card key={idxMetrics.indexName} className="border-border">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className={`h-2 w-2 rounded-full ${getHealthColor(idxMetrics.health)}`} />
                                  <CardTitle className="text-base">{idxMetrics.indexName}</CardTitle>
                                </div>
                                <Badge variant={idxMetrics.health === 'green' ? 'default' : idxMetrics.health === 'yellow' ? 'secondary' : 'destructive'}>
                                  {idxMetrics.health}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Documents:</span>
                                  <div className="font-semibold">{idxMetrics.docs.toLocaleString()}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Size:</span>
                                  <div className="font-semibold">{(idxMetrics.size / 1024 / 1024 / 1024).toFixed(2)} GB</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Shards:</span>
                                  <div className="font-semibold">{idxMetrics.shards}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Replicas:</span>
                                  <div className="font-semibold">{idxMetrics.replicas}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Index Ops/s:</span>
                                  <div className="font-semibold">{idxMetrics.indexOperationsPerSecond.toFixed(1)}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Search Ops/s:</span>
                                  <div className="font-semibold">{idxMetrics.searchOperationsPerSecond.toFixed(1)}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Avg Index Latency:</span>
                                  <div className="font-semibold">{idxMetrics.averageIndexLatency.toFixed(1)}ms</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Avg Search Latency:</span>
                                  <div className="font-semibold">{idxMetrics.averageSearchLatency.toFixed(1)}ms</div>
                                </div>
                                {idxMetrics.pendingDocuments > 0 && (
                                  <div>
                                    <span className="text-muted-foreground">Pending Docs:</span>
                                    <div className="font-semibold text-yellow-600">{idxMetrics.pendingDocuments}</div>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Shard Metrics */}
                {engineMetrics.shardMetrics && engineMetrics.shardMetrics.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Shard Metrics</CardTitle>
                      <CardDescription>Metrics per shard</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Index</th>
                              <th className="text-left p-2">Shard</th>
                              <th className="text-left p-2">Type</th>
                              <th className="text-left p-2">Node</th>
                              <th className="text-left p-2">State</th>
                              <th className="text-right p-2">Docs</th>
                              <th className="text-right p-2">Size</th>
                              <th className="text-right p-2">Ops/s</th>
                              <th className="text-right p-2">Avg Latency</th>
                            </tr>
                          </thead>
                          <tbody>
                            {engineMetrics.shardMetrics.slice(0, 20).map((shardMetrics: any, idx: number) => (
                              <tr key={idx} className="border-b">
                                <td className="p-2">{shardMetrics.index}</td>
                                <td className="p-2">{shardMetrics.shard}</td>
                                <td className="p-2">
                                  <Badge variant={shardMetrics.primary ? 'default' : 'outline'}>
                                    {shardMetrics.primary ? 'Primary' : 'Replica'}
                                  </Badge>
                                </td>
                                <td className="p-2">{shardMetrics.node}</td>
                                <td className="p-2">
                                  <Badge variant={
                                    shardMetrics.state === 'STARTED' ? 'default' :
                                    shardMetrics.state === 'RELOCATING' ? 'secondary' :
                                    shardMetrics.state === 'INITIALIZING' ? 'secondary' : 'destructive'
                                  }>
                                    {shardMetrics.state}
                                  </Badge>
                                </td>
                                <td className="p-2 text-right">{shardMetrics.docs.toLocaleString()}</td>
                                <td className="p-2 text-right">{(shardMetrics.size / 1024 / 1024).toFixed(2)} MB</td>
                                <td className="p-2 text-right">{shardMetrics.operationsPerSecond.toFixed(1)}</td>
                                <td className="p-2 text-right">{shardMetrics.averageLatency.toFixed(1)}ms</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {engineMetrics.shardMetrics.length > 20 && (
                          <p className="text-xs text-muted-foreground mt-2 text-center">
                            Showing first 20 of {engineMetrics.shardMetrics.length} shards
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Node Metrics */}
                {engineMetrics.nodeMetrics && engineMetrics.nodeMetrics.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Node Metrics</CardTitle>
                      <CardDescription>Metrics per cluster node</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {engineMetrics.nodeMetrics.map((nodeMetrics: any) => (
                          <Card key={nodeMetrics.address} className="border-border">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base">{nodeMetrics.address}</CardTitle>
                                <Badge variant={nodeMetrics.status === 'up' ? 'default' : 'destructive'}>
                                  {nodeMetrics.status}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Load:</span>
                                  <div className="font-semibold">{(nodeMetrics.load * 100).toFixed(1)}%</div>
                                  <Progress value={nodeMetrics.load * 100} className="h-2 mt-1" />
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Shards:</span>
                                  <div className="font-semibold">{nodeMetrics.shards}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Ops/s:</span>
                                  <div className="font-semibold">{nodeMetrics.operationsPerSecond.toFixed(1)}</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Avg Latency:</span>
                                  <div className="font-semibold">{nodeMetrics.averageLatency.toFixed(1)}ms</div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Memory:</span>
                                  <div className="font-semibold">{(nodeMetrics.memoryUsage * 100).toFixed(1)}%</div>
                                  <Progress value={nodeMetrics.memoryUsage * 100} className="h-2 mt-1" />
                                </div>
                                <div>
                                  <span className="text-muted-foreground">CPU:</span>
                                  <div className="font-semibold">{(nodeMetrics.cpuUsage * 100).toFixed(1)}%</div>
                                  <Progress value={nodeMetrics.cpuUsage * 100} className="h-2 mt-1" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Cluster Tab */}
          <TabsContent value="cluster" className="space-y-4 mt-4">
            {elasticsearchEngine ? (
              <>
                <ElasticsearchClusterView
                  nodes={Array.from((elasticsearchEngine as any).nodes?.values() || [])}
                  shards={Array.from((elasticsearchEngine as any).shards?.values() || []).flat()}
                  metrics={engineMetrics}
                  clusterHealth={clusterHealth}
                />
                <Card>
                  <CardHeader>
                    <CardTitle>Cluster Configuration</CardTitle>
                    <CardDescription>Elasticsearch cluster connection settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
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
                              placeholder={DEFAULT_NODE_ADDRESS}
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
              </>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8 text-muted-foreground">
                    <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Cluster visualization will appear when emulation is running</p>
                    <p className="text-sm mt-2">Start emulation to see cluster topology</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4 mt-4">
            <ElasticsearchOperationsHistory
              operationHistory={operationHistory}
              onRefresh={() => {
                if (elasticsearchEngine) {
                  const history = elasticsearchEngine.getOperationHistory(100);
                  setOperationHistory(history);
                }
              }}
              autoRefresh={true}
              refreshInterval={1000}
            />
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
                          placeholder={DEFAULT_USERNAME}
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


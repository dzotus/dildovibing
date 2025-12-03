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
  Cloud,
  Code,
  Layers
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const { nodes, updateNode } = useCanvasStore();
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
  const clusterHealth = config.clusterHealth || 'green';
  const activeShards = config.activeShards || 10;
  const relocatingShards = config.relocatingShards || 0;
  const initializingShards = config.initializingShards || 0;
  const totalDocs = config.totalDocs || indices.reduce((sum, i) => sum + i.docs, 0);
  const totalSize = config.totalSize || indices.reduce((sum, i) => sum + i.size, 0);
  
  const [editingIndexIndex, setEditingIndexIndex] = useState<number | null>(null);
  const [showQueryEditor, setShowQueryEditor] = useState(false);
  const [queryText, setQueryText] = useState('');

  const updateConfig = (updates: Partial<ElasticsearchConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
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

  const executeQuery = () => {
    if (!queryText.trim()) return;
    
    const newQuery: Query = {
      id: `query-${Date.now()}`,
      query: queryText,
      status: 'running',
      duration: 0,
      hits: 0,
      took: 0,
    };
    updateConfig({ queries: [newQuery, ...queries.slice(0, 9)] });
    setQueryText('');
    setShowQueryEditor(false);
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
            <Button size="sm" variant="outline">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button size="sm" variant="outline">
              <Cloud className="h-4 w-4 mr-2" />
              Kibana
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
                  {indices.map((idx, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`h-3 w-3 rounded-full ${getHealthColor(idx.health)}`} />
                            <div>
                              <CardTitle className="text-lg">{idx.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {idx.shards} shards • {idx.replicas} replicas • Health: {idx.health}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={idx.health === 'green' ? 'default' : idx.health === 'yellow' ? 'secondary' : 'destructive'}>
                              {idx.health}
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
                  ))}
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
                        <Label>Query (JSON)</Label>
                        <Textarea
                          value={queryText}
                          onChange={(e) => setQueryText(e.target.value)}
                          placeholder='GET /_search\n{\n  "query": {\n    "match_all": {}\n  }\n}'
                          rows={8}
                          className="font-mono text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={executeQuery} disabled={!queryText.trim()}>
                          <Play className="h-4 w-4 mr-2" />
                          Execute
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowQueryEditor(false);
                          setQueryText('');
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
                    <Label>Node Addresses</Label>
                    <Button size="sm" onClick={addNode} variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Node
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {nodesList.map((nodeAddr, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={nodeAddr}
                          onChange={(e) => updateNodeAddress(index, e.target.value)}
                          placeholder="localhost:9200"
                          className="flex-1"
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
                    onChange={(e) => updateConfig({ refreshInterval: e.target.value })}
                    placeholder="1s"
                  />
                  <p className="text-xs text-muted-foreground">How often to refresh the index (e.g., 1s, 5m)</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


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
import { 
  Database, 
  Network, 
  Settings, 
  Activity,
  HardDrive,
  Plus,
  Trash2,
  Server,
  Code,
  RefreshCcw,
  Table,
  Layers
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';

interface CassandraConfigProps {
  componentId: string;
}

interface Keyspace {
  name: string;
  replication: number;
  replicationStrategy?: 'SimpleStrategy' | 'NetworkTopologyStrategy';
  tables: number;
  size: number;
  durableWrites?: boolean;
}

interface Table {
  name: string;
  keyspace: string;
  columns?: Array<{
    name: string;
    type: string;
    primaryKey?: boolean;
  }>;
  rows?: number;
  size?: number;
}

interface Query {
  id: string;
  query: string;
  status: 'running' | 'success' | 'error';
  duration?: number;
  rowsReturned?: number;
}

interface Node {
  address: string;
  status: 'up' | 'down';
  load: number;
  tokens: number;
}

interface CassandraConfig {
  clusterName?: string;
  nodes?: Node[];
  keyspaces?: Keyspace[];
  tables?: Table[];
  queries?: Query[];
  consistencyLevel?: string;
  replicationFactor?: number;
  enableCompaction?: boolean;
  compactionStrategy?: string;
  totalSize?: number;
  readLatency?: number;
  writeLatency?: number;
}

export function CassandraConfigAdvanced({ componentId }: CassandraConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as CassandraConfig;
  const clusterName = config.clusterName || 'archiphoenix-cluster';
  // System keyspace is configuration, not data
  const nodesList = config.nodes || [];
  const keyspaces = config.keyspaces || [
    { name: 'system', replication: 3, replicationStrategy: 'NetworkTopologyStrategy', tables: 0, size: 0, durableWrites: true },
  ];
  const tables = config.tables || [];
  const queries = config.queries || [];
  
  const [editingKeyspaceIndex, setEditingKeyspaceIndex] = useState<number | null>(null);
  const [showQueryEditor, setShowQueryEditor] = useState(false);
  const [queryText, setQueryText] = useState('');
  const consistencyLevel = config.consistencyLevel || 'QUORUM';
  const replicationFactor = config.replicationFactor || 3;
  const enableCompaction = config.enableCompaction ?? true;
  const compactionStrategy = config.compactionStrategy || 'SizeTieredCompactionStrategy';
  const totalSize = config.totalSize || keyspaces.reduce((sum, k) => sum + k.size, 0);
  const readLatency = config.readLatency || 2.5;
  const writeLatency = config.writeLatency || 3.2;

  const updateConfig = (updates: Partial<CassandraConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addKeyspace = () => {
    updateConfig({
      keyspaces: [...keyspaces, { name: 'new_keyspace', replication: replicationFactor, tables: 0, size: 0 }],
    });
  };

  const removeKeyspace = (index: number) => {
    updateConfig({ keyspaces: keyspaces.filter((_, i) => i !== index) });
  };

  const updateKeyspace = (index: number, field: string, value: any) => {
    const newKeyspaces = [...keyspaces];
    newKeyspaces[index] = { ...newKeyspaces[index], [field]: value };
    updateConfig({ keyspaces: newKeyspaces });
  };

  const executeQuery = () => {
    if (!queryText.trim()) return;
    
    const newQuery: Query = {
      id: `query-${Date.now()}`,
      query: queryText,
      status: 'running',
      duration: 0,
      rowsReturned: 0,
    };
    updateConfig({ queries: [newQuery, ...queries.slice(0, 9)] });
    setQueryText('');
    setShowQueryEditor(false);
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Database className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Apache Cassandra</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Distributed NoSQL Database
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Cluster Healthy
            </Badge>
            <Button size="sm" variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              CQL Shell
            </Button>
          </div>
        </div>

        <Separator />

        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Nodes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{nodesList.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Cluster nodes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Keyspaces</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{keyspaces.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Total keyspaces</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Read Latency</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{readLatency}ms</div>
              <p className="text-xs text-muted-foreground mt-1">Average</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Data Size</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSize.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground mt-1">GB</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Configuration Tabs */}
        <Tabs defaultValue="keyspaces" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="keyspaces" className="gap-2">
              <Database className="h-4 w-4" />
              Keyspaces
            </TabsTrigger>
            <TabsTrigger value="tables" className="gap-2">
              <Table className="h-4 w-4" />
              Tables
            </TabsTrigger>
            <TabsTrigger value="cql" className="gap-2">
              <Code className="h-4 w-4" />
              CQL Shell
            </TabsTrigger>
            <TabsTrigger value="cluster" className="gap-2">
              <Network className="h-4 w-4" />
              Cluster
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Keyspaces Tab */}
          <TabsContent value="keyspaces" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Keyspaces</CardTitle>
                    <CardDescription>Cassandra keyspace configuration</CardDescription>
                  </div>
                  <Button size="sm" onClick={addKeyspace} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Keyspace
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {keyspaces.map((ks, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-primary/10">
                              <Database className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{ks.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {ks.tables} tables • Replication: {ks.replication} • Size: {ks.size} GB
                                {ks.replicationStrategy && ` • ${ks.replicationStrategy}`}
                              </CardDescription>
                            </div>
                          </div>
                          {keyspaces.length > 1 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeKeyspace(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      {editingKeyspaceIndex === index && (
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Replication Factor</Label>
                              <Input
                                type="number"
                                value={ks.replication}
                                onChange={(e) => updateKeyspace(index, 'replication', Number(e.target.value))}
                                min={1}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Replication Strategy</Label>
                              <Select
                                value={ks.replicationStrategy || 'NetworkTopologyStrategy'}
                                onValueChange={(value: 'SimpleStrategy' | 'NetworkTopologyStrategy') => updateKeyspace(index, 'replicationStrategy', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="SimpleStrategy">Simple Strategy</SelectItem>
                                  <SelectItem value="NetworkTopologyStrategy">Network Topology Strategy</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingKeyspaceIndex(null)}
                          >
                            Done
                          </Button>
                        </CardContent>
                      )}
                      {editingKeyspaceIndex !== index && (
                        <CardContent>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingKeyspaceIndex(index)}
                          >
                            Edit Settings
                          </Button>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tables Tab */}
          <TabsContent value="tables" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Tables</CardTitle>
                    <CardDescription>Cassandra table configuration</CardDescription>
                  </div>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Table
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {tables.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No tables created</p>
                ) : (
                  <div className="space-y-3">
                    {tables.map((table, index) => (
                      <Card key={index} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Table className="h-4 w-4 text-primary" />
                              <div>
                                <CardTitle className="text-lg">{table.name}</CardTitle>
                                <CardDescription className="text-xs mt-1">
                                  {table.keyspace} • {table.rows || 0} rows • {table.size ? `${table.size} GB` : 'N/A'}
                                </CardDescription>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CQL Shell Tab */}
          <TabsContent value="cql" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>CQL Shell</CardTitle>
                    <CardDescription>Execute CQL queries</CardDescription>
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
                      <CardTitle>Execute CQL Query</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>CQL Query</Label>
                        <Textarea
                          value={queryText}
                          onChange={(e) => setQueryText(e.target.value)}
                          placeholder="SELECT * FROM keyspace.table LIMIT 10;"
                          rows={6}
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
                                {query.duration !== undefined && (
                                  <Badge variant="outline">{query.duration}ms</Badge>
                                )}
                                {query.rowsReturned !== undefined && (
                                  <Badge variant="outline">{query.rowsReturned} rows</Badge>
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
                <CardTitle>Cluster Nodes</CardTitle>
                <CardDescription>Cassandra cluster topology</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {nodesList.map((n, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`h-3 w-3 rounded-full ${n.status === 'up' ? 'bg-green-500' : 'bg-red-500'}`} />
                            <div>
                              <CardTitle className="text-lg">{n.address}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {n.tokens} tokens • Load: {(n.load * 100).toFixed(1)}%
                              </CardDescription>
                            </div>
                          </div>
                          <Badge variant={n.status === 'up' ? 'default' : 'destructive'}>
                            {n.status.toUpperCase()}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Load:</span>
                            <span className="font-semibold">{(n.load * 100).toFixed(1)}%</span>
                          </div>
                          <Progress value={n.load * 100} className="h-2" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Cluster Settings</CardTitle>
                <CardDescription>Cassandra cluster configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Read Latency</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{readLatency}ms</div>
                      <Progress value={Math.min((readLatency / 10) * 100, 100)} className="h-2 mt-2" />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Write Latency</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{writeLatency}ms</div>
                      <Progress value={Math.min((writeLatency / 10) * 100, 100)} className="h-2 mt-2" />
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="replication-factor">Replication Factor</Label>
                    <Input
                      id="replication-factor"
                      type="number"
                      min="1"
                      max="10"
                      value={replicationFactor}
                      onChange={(e) => updateConfig({ replicationFactor: parseInt(e.target.value) || 3 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="consistency-level">Consistency Level</Label>
                    <Input
                      id="consistency-level"
                      value={consistencyLevel}
                      onChange={(e) => updateConfig({ consistencyLevel: e.target.value })}
                      placeholder="QUORUM"
                    />
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Compaction</Label>
                    <div className="text-sm text-muted-foreground">
                      Automatic data compaction
                    </div>
                  </div>
                  <Switch
                    checked={enableCompaction}
                    onCheckedChange={(checked) => updateConfig({ enableCompaction: checked })}
                  />
                </div>
                {enableCompaction && (
                  <div className="space-y-2">
                    <Label htmlFor="compaction-strategy">Compaction Strategy</Label>
                    <Input
                      id="compaction-strategy"
                      value={compactionStrategy}
                      onChange={(e) => updateConfig({ compactionStrategy: e.target.value })}
                      placeholder="SizeTieredCompactionStrategy"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


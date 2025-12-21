import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';
import { 
  Database, 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Snowflake,
  TrendingUp,
  Users,
  Key
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { emulationEngine } from '@/core/EmulationEngine';

interface SnowflakeConfigProps {
  componentId: string;
}

interface Warehouse {
  name: string;
  size: 'X-Small' | 'Small' | 'Medium' | 'Large' | 'X-Large' | '2X-Large' | '3X-Large' | '4X-Large';
  autoSuspend?: number;
  autoResume?: boolean;
  minClusterCount?: number;
  maxClusterCount?: number;
  status?: 'running' | 'suspended';
  runningQueries?: number;
  queuedQueries?: number;
}

interface Database {
  name: string;
  comment?: string;
  retentionTime?: number;
  size?: number;
  schemas?: Schema[];
}

interface Schema {
  name: string;
  tables?: number;
  views?: number;
  functions?: number;
}

interface Query {
  id: string;
  queryText: string;
  status: 'running' | 'queued' | 'success' | 'failed';
  warehouse?: string;
  database?: string;
  schema?: string;
  duration?: number;
  rowsReturned?: number;
}

interface SnowflakeConfig {
  account?: string;
  username?: string;
  password?: string;
  warehouse?: string;
  database?: string;
  schema?: string;
  warehouses?: Warehouse[];
  databases?: Database[];
  queries?: Query[];
  role?: string;
}

export function SnowflakeConfigAdvanced({ componentId }: SnowflakeConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as SnowflakeConfig;
  const accountBase = config.account || 'archiphoenix';
  const region = config.region || 'us-east-1';
  const cloud = 'aws'; // Default to AWS, could be configurable
  // Format: account.region.cloud (e.g., archiphoenix.us-east-1.aws)
  const account = accountBase.includes('.') ? accountBase : `${accountBase}.${region}.${cloud}`;
  const username = config.username || 'admin';
  const password = config.password || '';
  const warehouse = config.warehouse || 'COMPUTE_WH';
  const database = config.database || 'SNOWFLAKE';
  const schema = config.schema || 'PUBLIC';
  const role = config.role || 'ACCOUNTADMIN';
  const warehouses = config.warehouses || [];
  // System database is configuration, not data
  const databases = config.databases || [
    {
      name: 'SNOWFLAKE',
      comment: 'System database',
      retentionTime: 1,
      size: 0,
      schemas: [{ name: 'INFORMATION_SCHEMA', tables: 0, views: 0, functions: 0 }],
    },
  ];
  const queries = config.queries || [];

  const [editingWarehouseIndex, setEditingWarehouseIndex] = useState<number | null>(null);
  const [editingDatabaseIndex, setEditingDatabaseIndex] = useState<number | null>(null);
  const [showCreateQuery, setShowCreateQuery] = useState(false);
  const [queryText, setQueryText] = useState('');
  
  // Get SnowflakeRoutingEngine for real-time metrics
  const snowflakeEngine = emulationEngine.getSnowflakeRoutingEngine(componentId);

  const updateConfig = (updates: Partial<SnowflakeConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addWarehouse = () => {
    const newWarehouse: Warehouse = {
      name: 'NEW_WH',
      size: 'Small',
      autoSuspend: 60,
      autoResume: true,
      minClusterCount: 1,
      maxClusterCount: 1,
      status: 'suspended',
      runningQueries: 0,
      queuedQueries: 0,
    };
    updateConfig({ warehouses: [...warehouses, newWarehouse] });
  };

  const removeWarehouse = (index: number) => {
    updateConfig({ warehouses: warehouses.filter((_, i) => i !== index) });
  };

  const updateWarehouse = (index: number, field: string, value: any) => {
    const newWarehouses = [...warehouses];
    newWarehouses[index] = { ...newWarehouses[index], [field]: value };
    updateConfig({ warehouses: newWarehouses });
  };

  const addDatabase = () => {
    const newDatabase: Database = {
      name: 'NEW_DB',
      retentionTime: 1,
      size: 0,
      schemas: [{ name: 'PUBLIC', tables: 0, views: 0, functions: 0 }],
    };
    updateConfig({ databases: [...databases, newDatabase] });
  };

  const removeDatabase = (index: number) => {
    updateConfig({ databases: databases.filter((_, i) => i !== index) });
  };

  const updateDatabase = (index: number, field: string, value: any) => {
    const newDatabases = [...databases];
    newDatabases[index] = { ...newDatabases[index], [field]: value };
    updateConfig({ databases: newDatabases });
  };

  const executeQuery = () => {
    if (!queryText.trim()) return;
    
    const newQuery: Query = {
      id: `query-${Date.now()}`,
      queryText: queryText,
      status: 'running',
      warehouse,
      database,
      schema,
      duration: 0,
      rowsReturned: 0,
    };
    updateConfig({ queries: [newQuery, ...queries.slice(0, 9)] });
    setQueryText('');
    setShowCreateQuery(false);
  };

  // Get real-time metrics from engine if available
  const engineMetrics = snowflakeEngine?.getMetrics();
  const engineWarehouses = snowflakeEngine?.getWarehouses() || [];
  const engineQueries = snowflakeEngine?.getRecentQueries(10) || [];
  
  // Use engine metrics if available, otherwise fall back to config
  const totalRunningQueries = engineMetrics?.runningQueries ?? warehouses.reduce((sum, w) => sum + (w.runningQueries || 0), 0);
  const totalQueuedQueries = engineMetrics?.queuedQueries ?? warehouses.reduce((sum, w) => sum + (w.queuedQueries || 0), 0);
  
  // Merge engine warehouses with config warehouses (engine takes precedence for runtime state)
  const mergedWarehouses = engineWarehouses.length > 0 
    ? engineWarehouses.map(engineWh => {
        const configWh = warehouses.find(w => w.name === engineWh.name);
        return {
          ...engineWh,
          // Keep config settings like autoSuspend, autoResume from config if not in engine
          autoSuspend: engineWh.autoSuspend ?? configWh?.autoSuspend,
          autoResume: engineWh.autoResume ?? configWh?.autoResume,
          minClusterCount: engineWh.minClusterCount ?? configWh?.minClusterCount ?? 1,
          maxClusterCount: engineWh.maxClusterCount ?? configWh?.maxClusterCount ?? 1,
        };
      })
    : warehouses;
  
  // Use engine queries if available
  const displayQueries = engineQueries.length > 0 ? engineQueries : queries;
  
  const handleRefresh = () => {
    if (!snowflakeEngine) return;
    
    // Get latest metrics and state from engine
    const metrics = snowflakeEngine.getMetrics();
    const engineWarehouses = snowflakeEngine.getWarehouses();
    const recentQueries = snowflakeEngine.getRecentQueries(100);
    
    // Update warehouses in config with runtime state
    const updatedWarehouses = engineWarehouses.map(engineWh => {
      const configWh = warehouses.find(w => w.name === engineWh.name);
      return {
        ...engineWh,
        // Preserve config settings
        autoSuspend: configWh?.autoSuspend ?? engineWh.autoSuspend,
        autoResume: configWh?.autoResume ?? engineWh.autoResume,
        minClusterCount: configWh?.minClusterCount ?? engineWh.minClusterCount,
        maxClusterCount: configWh?.maxClusterCount ?? engineWh.maxClusterCount,
      };
    });
    
    // Update config with refreshed data
    updateConfig({
      warehouses: updatedWarehouses.length > 0 ? updatedWarehouses : warehouses,
      queries: recentQueries.slice(0, 100), // Keep last 100 queries
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Snowflake Data Cloud</p>
            <h2 className="text-2xl font-bold text-foreground">Data Warehouse</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure warehouses, databases, schemas and execute queries
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Account</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm break-words leading-tight">{account}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Warehouses</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{mergedWarehouses.length}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Running Queries</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{totalRunningQueries}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Queued Queries</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{totalQueuedQueries}</span>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="warehouses" className="space-y-4">
          <TabsList>
            <TabsTrigger value="warehouses">
              <Snowflake className="h-4 w-4 mr-2" />
              Warehouses ({mergedWarehouses.length})
            </TabsTrigger>
            <TabsTrigger value="databases">
              <Database className="h-4 w-4 mr-2" />
              Databases ({databases.length})
            </TabsTrigger>
            <TabsTrigger value="queries">
              <Activity className="h-4 w-4 mr-2" />
              Queries ({displayQueries.length})
            </TabsTrigger>
            <TabsTrigger value="connection">
              <Key className="h-4 w-4 mr-2" />
              Connection
            </TabsTrigger>
          </TabsList>

          <TabsContent value="warehouses" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Compute Warehouses</CardTitle>
                    <CardDescription>Configure virtual warehouses for query processing</CardDescription>
                  </div>
                  <Button onClick={addWarehouse} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Warehouse
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mergedWarehouses.map((wh, index) => (
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Snowflake className="h-5 w-5 text-blue-500" />
                            <div>
                              <CardTitle className="text-base">{wh.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant={wh.status === 'running' ? 'default' : 'outline'}>
                                  {wh.status || 'suspended'}
                                </Badge>
                                <Badge variant="outline">{wh.size}</Badge>
                                <Badge variant="outline">
                                  {wh.runningQueries || 0} running
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeWarehouse(index)}
                            disabled={warehouses.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Running Queries</p>
                            <p className="text-lg font-semibold">{wh.runningQueries || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Queued Queries</p>
                            <p className="text-lg font-semibold">{wh.queuedQueries || 0}</p>
                          </div>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Warehouse Name</Label>
                            <Input
                              value={wh.name}
                              onChange={(e) => updateWarehouse(index, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Size</Label>
                            <Select
                              value={wh.size}
                              onValueChange={(value: any) => updateWarehouse(index, 'size', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="X-Small">X-Small</SelectItem>
                                <SelectItem value="Small">Small</SelectItem>
                                <SelectItem value="Medium">Medium</SelectItem>
                                <SelectItem value="Large">Large</SelectItem>
                                <SelectItem value="X-Large">X-Large</SelectItem>
                                <SelectItem value="2X-Large">2X-Large</SelectItem>
                                <SelectItem value="3X-Large">3X-Large</SelectItem>
                                <SelectItem value="4X-Large">4X-Large</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Auto Suspend (seconds)</Label>
                            <Input
                              type="number"
                              value={wh.autoSuspend || 60}
                              onChange={(e) => updateWarehouse(index, 'autoSuspend', Number(e.target.value))}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Auto Resume</Label>
                            <Switch
                              checked={wh.autoResume ?? true}
                              onCheckedChange={(checked) => updateWarehouse(index, 'autoResume', checked)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Min Clusters</Label>
                            <Input
                              type="number"
                              value={wh.minClusterCount || 1}
                              onChange={(e) => updateWarehouse(index, 'minClusterCount', Number(e.target.value))}
                              min={1}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Max Clusters</Label>
                            <Input
                              type="number"
                              value={wh.maxClusterCount || 1}
                              onChange={(e) => updateWarehouse(index, 'maxClusterCount', Number(e.target.value))}
                              min={1}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="databases" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Databases</CardTitle>
                    <CardDescription>Manage databases and schemas</CardDescription>
                  </div>
                  <Button onClick={addDatabase} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Database
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {databases.map((db, index) => (
                    <Card key={index} className="border-l-4 border-l-green-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Database className="h-5 w-5 text-green-500" />
                            <div>
                              <CardTitle className="text-base">{db.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline">
                                  {db.schemas?.length || 0} schemas
                                </Badge>
                                {db.size !== undefined && (
                                  <Badge variant="outline">
                                    {db.size.toLocaleString()} bytes
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeDatabase(index)}
                            disabled={databases.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Database Name</Label>
                            <Input
                              value={db.name}
                              onChange={(e) => updateDatabase(index, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Retention Time (days)</Label>
                            <Input
                              type="number"
                              value={db.retentionTime || 1}
                              onChange={(e) => updateDatabase(index, 'retentionTime', Number(e.target.value))}
                            />
                          </div>
                        </div>
                        {db.comment && (
                          <div className="space-y-2">
                            <Label>Comment</Label>
                            <Input
                              value={db.comment}
                              onChange={(e) => updateDatabase(index, 'comment', e.target.value)}
                            />
                          </div>
                        )}
                        {db.schemas && db.schemas.length > 0 && (
                          <div>
                            <Label className="mb-2 block">Schemas</Label>
                            <div className="space-y-2">
                              {db.schemas.map((schema, sIndex) => (
                                <Card key={sIndex} className="p-3">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-medium">{schema.name}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline">{schema.tables || 0} tables</Badge>
                                        <Badge variant="outline">{schema.views || 0} views</Badge>
                                        <Badge variant="outline">{schema.functions || 0} functions</Badge>
                                      </div>
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="queries" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Query History</CardTitle>
                    <CardDescription>Execute and monitor SQL queries</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateQuery(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New Query
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {showCreateQuery && (
                  <Card className="mb-4 border-primary">
                    <CardHeader>
                      <CardTitle>Execute Query</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>SQL Query</Label>
                        <Textarea
                          value={queryText}
                          onChange={(e) => setQueryText(e.target.value)}
                          placeholder="SELECT * FROM table_name LIMIT 10;"
                          rows={6}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={executeQuery} disabled={!queryText.trim()}>
                          Execute
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowCreateQuery(false);
                          setQueryText('');
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {displayQueries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No queries executed</p>
                ) : (
                  <div className="space-y-2">
                    {displayQueries.map((query) => (
                      <Card key={query.id} className="border-l-4 border-l-purple-500">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={
                                  query.status === 'success' ? 'default' :
                                  query.status === 'failed' ? 'destructive' :
                                  query.status === 'running' ? 'secondary' : 'outline'
                                }>
                                  {query.status}
                                </Badge>
                                {query.warehouse && <Badge variant="outline">{query.warehouse}</Badge>}
                                {query.duration !== undefined && (
                                  <Badge variant="outline">{query.duration}ms</Badge>
                                )}
                              </div>
                              <p className="text-sm font-mono bg-muted p-2 rounded text-xs">
                                {query.queryText}
                              </p>
                              {query.rowsReturned !== undefined && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  Rows returned: {query.rowsReturned}
                                </p>
                              )}
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

          <TabsContent value="connection" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Connection Settings</CardTitle>
                <CardDescription>Configure Snowflake connection parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Account</Label>
                    <Input
                      value={account}
                      onChange={(e) => updateConfig({ account: e.target.value })}
                      placeholder="account.region.cloud"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      value={username}
                      onChange={(e) => updateConfig({ username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => updateConfig({ password: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Input
                      value={role}
                      onChange={(e) => updateConfig({ role: e.target.value })}
                      placeholder="ACCOUNTADMIN"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Warehouse</Label>
                    <Select
                      value={warehouse}
                      onValueChange={(value) => updateConfig({ warehouse: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {mergedWarehouses.map((wh) => (
                          <SelectItem key={wh.name} value={wh.name}>{wh.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Database</Label>
                    <Select
                      value={database}
                      onValueChange={(value) => updateConfig({ database: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {databases.map((db) => (
                          <SelectItem key={db.name} value={db.name}>{db.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Schema</Label>
                    <Input
                      value={schema}
                      onChange={(e) => updateConfig({ schema: e.target.value })}
                      placeholder="PUBLIC"
                    />
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


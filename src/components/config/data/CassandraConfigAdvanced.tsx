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
  Layers,
  Play
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { emulationEngine } from '@/core/EmulationEngine';
import { validateNode, validateNodeAddress, validateNodeTokens } from '@/utils/cassandraValidation';
import { Pencil } from 'lucide-react';
import { CassandraTokenRingVisualization } from './CassandraTokenRingVisualization';
import { CassandraDatacenterMetrics } from './CassandraDatacenterMetrics';
import { CassandraReplicationVisualization } from './CassandraReplicationVisualization';

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
  datacenter?: string;
  rack?: string;
}

interface CassandraConfig {
  clusterName?: string;
  nodes?: Node[];
  keyspaces?: Keyspace[];
  tables?: Table[];
  queries?: Query[];
  consistencyLevel?: string;
  replicationFactor?: number;
  totalSize?: number;
  readLatency?: number;
  writeLatency?: number;
  compactionStrategy?: string;
  enableCompaction?: boolean;
  datacenter?: string;
}

export function CassandraConfigAdvanced({ componentId }: CassandraConfigProps) {
  const { nodes, connections, updateNode } = useCanvasStore();
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
  const [showCreateTableDialog, setShowCreateTableDialog] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableKeyspace, setNewTableKeyspace] = useState(keyspaces[0]?.name || 'system');
  const [queryText, setQueryText] = useState('');
  const consistencyLevel = config.consistencyLevel || 'QUORUM';
  const replicationFactor = config.replicationFactor || 3;
  
  // Node management state
  const [showCreateNodeDialog, setShowCreateNodeDialog] = useState(false);
  const [editingNodeIndex, setEditingNodeIndex] = useState<number | null>(null);
  const [newNodeAddress, setNewNodeAddress] = useState('');
  const [newNodeTokens, setNewNodeTokens] = useState(256);
  const [newNodeDatacenter, setNewNodeDatacenter] = useState(config.datacenter || 'dc1');
  const [newNodeRack, setNewNodeRack] = useState('rack1');
  const [newNodeStatus, setNewNodeStatus] = useState<'up' | 'down'>('up');
  const [nodeValidationError, setNodeValidationError] = useState<string | null>(null);
  
  // Real-time metrics from CassandraRoutingEngine
  const [realMetrics, setRealMetrics] = useState<{
    readLatency: number;
    writeLatency: number;
    totalNodes: number;
    healthyNodes: number;
    totalKeyspaces: number;
    totalTables: number;
    totalRows: number;
    totalSize: number;
    hintedHandoffs?: number;
    pendingCompactions?: number;
  } | null>(null);
  
  // Runtime keyspaces and tables from engine
  const [runtimeKeyspaces, setRuntimeKeyspaces] = useState<Keyspace[]>(keyspaces);
  const [runtimeTables, setRuntimeTables] = useState<Table[]>(tables);
  const [runtimeNodes, setRuntimeNodes] = useState<Node[]>(nodesList);
  
  // Token ring and replication data
  const [tokenRingData, setTokenRingData] = useState<{
    tokenRanges: Array<{ start: number; end: number; nodeAddress: string }>;
    sortedTokens: Array<{ token: number; nodeAddress: string }>;
    nodeTokens: Array<{ address: string; tokens: number[]; datacenter?: string; rack?: string }>;
  } | null>(null);
  const [datacenterMetrics, setDatacenterMetrics] = useState<Map<string, any>>(new Map());
  const [selectedPartitionKey, setSelectedPartitionKey] = useState<string>('');
  const [replicaInfo, setReplicaInfo] = useState<any>(null);
  
  // Update metrics, keyspaces, and tables from runtime
  useEffect(() => {
    if (!node) return;
    
    const interval = setInterval(() => {
      const cassandraEngine = emulationEngine.getCassandraRoutingEngine(componentId);
      if (cassandraEngine) {
        const metrics = cassandraEngine.getMetrics();
        const engineKeyspaces = cassandraEngine.getKeyspaces();
        const engineTables = cassandraEngine.getTables();
        const engineNodes = cassandraEngine.getNodes();
        
        setRealMetrics({
          readLatency: metrics.readLatency,
          writeLatency: metrics.writeLatency,
          totalNodes: metrics.totalNodes,
          healthyNodes: metrics.healthyNodes,
          totalKeyspaces: metrics.totalKeyspaces,
          totalTables: metrics.totalTables,
          totalRows: metrics.totalRows,
          totalSize: metrics.totalSize,
          hintedHandoffs: metrics.hintedHandoffs,
          pendingCompactions: metrics.pendingCompactions,
        });
        
        // Update runtime nodes from engine (for simulation)
        setRuntimeNodes(engineNodes);
        
        // Get token ring data
        const tokenRingData = cassandraEngine.getTokenRingData();
        setTokenRingData(tokenRingData);
        
        // Get datacenter metrics
        const dcMetrics = cassandraEngine.getDatacenterMetrics();
        setDatacenterMetrics(dcMetrics);
        
        // Get replica info if partition key is selected
        if (selectedPartitionKey) {
          const parts = selectedPartitionKey.split(':');
          if (parts.length >= 2) {
            const keyspaceName = parts[0];
            const partitionKey = parts.slice(1).join(':');
            const replicaInfo = cassandraEngine.getReplicaInfo(keyspaceName, partitionKey);
            setReplicaInfo(replicaInfo);
          }
        }
        
        // Merge runtime keyspaces with config
        const configKeyspaceMap = new Map(keyspaces.map(k => [k.name, k]));
        const mergedKeyspaces = engineKeyspaces.map(engineKs => {
          const configKs = configKeyspaceMap.get(engineKs.name);
          return {
            ...engineKs,
            // Keep config metadata (size, tables count) if exists, otherwise use engine values
            size: configKs?.size ?? engineKs.size ?? 0,
            tables: engineTables.filter(t => t.keyspace === engineKs.name).length,
          };
        });
        setRuntimeKeyspaces(mergedKeyspaces);
        
        // Merge runtime tables with config
        const configTableMap = new Map(tables.map(t => [`${t.keyspace}.${t.name}`, t]));
        const mergedTables = engineTables.map(engineTable => {
          const configTable = configTableMap.get(`${engineTable.keyspace}.${engineTable.name}`);
          return {
            ...engineTable,
            // Keep config metadata if exists
            ...(configTable && {
              columns: configTable.columns,
            }),
          };
        });
        setRuntimeTables(mergedTables);
        
        // Don't sync back to config automatically to avoid loops
        // Config is updated only when user actions or CQL commands change structure
      } else {
        // Engine not initialized, clear runtime metrics
        setRealMetrics(null);
        setRuntimeKeyspaces(keyspaces);
        setRuntimeTables(tables);
        setRuntimeNodes(nodesList);
      }
    }, 500); // Update every 500ms
    
    return () => clearInterval(interval);
  }, [componentId, node, keyspaces, tables, selectedPartitionKey]); // Include keyspaces and tables to update when config changes
  
  const totalSize = realMetrics?.totalSize ? realMetrics.totalSize / (1024 * 1024 * 1024) : (config.totalSize || keyspaces.reduce((sum, k) => sum + k.size, 0));
  // Show latencies only if engine is active and has operations
  const readLatency = realMetrics && (realMetrics.readOperationsPerSecond > 0 || realMetrics.totalRows > 0)
    ? realMetrics.readLatency
    : null;
  const writeLatency = realMetrics && (realMetrics.writeOperationsPerSecond > 0 || realMetrics.totalRows > 0)
    ? realMetrics.writeLatency
    : null;
  
  // Use runtime data if available, fallback to config
  const displayKeyspaces = runtimeKeyspaces.length > 0 ? runtimeKeyspaces : keyspaces;
  const displayTables = runtimeTables.length > 0 ? runtimeTables : tables;
  const displayNodes = runtimeNodes.length > 0 ? runtimeNodes : nodesList;

  const updateConfig = (updates: Partial<CassandraConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
    
    // Sync with CassandraRoutingEngine if available
    const cassandraEngine = emulationEngine.getCassandraRoutingEngine(componentId);
    if (cassandraEngine) {
      cassandraEngine.syncFromConfig({ ...config, ...updates });
    }
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
    
    const queryId = `query-${Date.now()}`;
    const startTime = Date.now();
    
    const newQuery: Query = {
      id: queryId,
      query: queryText,
      status: 'running',
      duration: 0,
      rowsReturned: 0,
    };
    
    // Execute query through CassandraRoutingEngine
    const cassandraEngine = emulationEngine.getCassandraRoutingEngine(componentId);
    let resultQuery: Query = newQuery;
    
    if (cassandraEngine) {
      try {
        const result = cassandraEngine.executeCQL(queryText, consistencyLevel as any);
        const duration = Date.now() - startTime;
        
        resultQuery = {
          id: queryId,
          query: queryText,
          status: result.success ? 'success' : 'error',
          duration,
          rowsReturned: result.rowCount || 0,
        };
        
        // If CREATE TABLE or CREATE KEYSPACE succeeded, sync tables/keyspaces from engine
        if (result.success) {
          const normalizedQuery = queryText.trim().toUpperCase();
          if (normalizedQuery.startsWith('CREATE TABLE') || normalizedQuery.startsWith('CREATE KEYSPACE') || 
              normalizedQuery.startsWith('DROP TABLE') || normalizedQuery.startsWith('DROP KEYSPACE')) {
            // Force sync from engine
            const engineKeyspaces = cassandraEngine.getKeyspaces();
            const engineTables = cassandraEngine.getTables();
            
            // Merge with existing config to preserve metadata
            const configKeyspaceMap = new Map(keyspaces.map(k => [k.name, k]));
            const mergedKeyspaces = engineKeyspaces.map(ks => {
              const configKs = configKeyspaceMap.get(ks.name);
              return {
                ...ks,
                size: configKs?.size || ks.size || 0,
                tables: engineTables.filter(t => t.keyspace === ks.name).length,
              };
            });
            
            // Update config to trigger re-render
            updateConfig({
              keyspaces: mergedKeyspaces,
              tables: engineTables,
            });
            
            // Force refresh runtime keyspaces/tables state
            setRuntimeKeyspaces(mergedKeyspaces);
            setRuntimeTables(engineTables);
          }
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        resultQuery = {
          id: queryId,
          query: queryText,
          status: 'error',
          duration,
          rowsReturned: 0,
        };
      }
    } else {
      // No engine available, just mark as running (simulated)
      resultQuery.status = 'success';
      resultQuery.duration = Date.now() - startTime;
    }
    
    updateConfig({ queries: [resultQuery, ...queries.slice(0, 9)] });
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
            <Badge 
              variant="outline" 
              className="gap-2"
            >
              <div 
                className={`h-2 w-2 rounded-full animate-pulse ${
                  realMetrics && realMetrics.healthyNodes > 0 && realMetrics.healthyNodes === realMetrics.totalNodes
                    ? 'bg-green-500'
                    : realMetrics && realMetrics.healthyNodes > 0
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`} 
              />
              {realMetrics && realMetrics.totalNodes > 0
                ? `Cluster ${realMetrics.healthyNodes === realMetrics.totalNodes ? 'Healthy' : 'Degraded'}`
                : 'Cluster Not Initialized'}
            </Badge>
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
              <div className="text-2xl font-bold">{realMetrics?.totalNodes ?? displayNodes.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Cluster nodes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Keyspaces</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{realMetrics?.totalKeyspaces ?? keyspaces.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Total keyspaces</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Read Latency</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {readLatency !== null ? `${readLatency}ms` : '—'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {readLatency !== null ? 'Average' : 'No activity'}
              </p>
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
                  {displayKeyspaces.map((ks, index) => (
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
                          {displayKeyspaces.length > 1 && (
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
                  <Button size="sm" variant="outline" onClick={() => setShowCreateTableDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Table
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Create Table Dialog */}
                {showCreateTableDialog && (
                  <Card className="mb-4 border-primary">
                    <CardHeader>
                      <CardTitle>Create New Table</CardTitle>
                      <CardDescription>Create a table in a keyspace</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Keyspace</Label>
                        <Select value={newTableKeyspace} onValueChange={setNewTableKeyspace}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {displayKeyspaces.map(ks => (
                              <SelectItem key={ks.name} value={ks.name}>{ks.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Table Name</Label>
                        <Input
                          value={newTableName}
                          onChange={(e) => setNewTableName(e.target.value)}
                          placeholder="users"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={async () => {
                            if (!newTableName.trim() || !newTableKeyspace) return;
                            
                            // Create table (compaction strategy will be set by default in engine)
                            const cql = `CREATE TABLE ${newTableKeyspace}.${newTableName.trim()} (id UUID PRIMARY KEY, data TEXT)`;
                            
                            // Execute directly through engine
                            let cassandraEngine = emulationEngine.getCassandraRoutingEngine(componentId);
                            
                            // If engine doesn't exist, initialize it
                            if (!cassandraEngine && node) {
                              emulationEngine.initialize(nodes, connections || []);
                              cassandraEngine = emulationEngine.getCassandraRoutingEngine(componentId);
                            }
                            
                            if (cassandraEngine) {
                              try {
                                console.log('Executing CREATE TABLE:', cql);
                                const result = cassandraEngine.executeCQL(cql, consistencyLevel as any);
                                console.log('CREATE TABLE result:', result);
                                
                                if (result.success) {
                                  // Sync tables and keyspaces from engine
                                  const engineKeyspaces = cassandraEngine.getKeyspaces();
                                  const engineTables = cassandraEngine.getTables();
                                  
                                  console.log('Engine keyspaces:', engineKeyspaces);
                                  console.log('Engine tables:', engineTables);
                                  
                                  const configKeyspaceMap = new Map(keyspaces.map(k => [k.name, k]));
                                  const mergedKeyspaces = engineKeyspaces.map(ks => {
                                    const configKs = configKeyspaceMap.get(ks.name);
                                    return {
                                      ...ks,
                                      size: configKs?.size || 0,
                                      tables: engineTables.filter(t => t.keyspace === ks.name).length,
                                    };
                                  });
                                  
                                  console.log('Merged keyspaces:', mergedKeyspaces);
                                  console.log('Merged tables:', engineTables);
                                  
                                  updateConfig({
                                    keyspaces: mergedKeyspaces,
                                    tables: engineTables,
                                  });
                                  
                                  // Force update runtime state immediately for UI refresh
                                  setRuntimeKeyspaces(mergedKeyspaces);
                                  setRuntimeTables(engineTables);
                                  
                                  setNewTableName('');
                                  setNewTableKeyspace(keyspaces[0]?.name || 'system');
                                  setShowCreateTableDialog(false);
                                } else {
                                  console.error('CREATE TABLE failed:', result.error);
                                  alert(`Failed to create table: ${result.error || 'Unknown error'}`);
                                }
                              } catch (error) {
                                console.error('CREATE TABLE error:', error);
                                alert(`Error creating table: ${error instanceof Error ? error.message : 'Unknown error'}`);
                              }
                            } else {
                              console.warn('Cassandra engine not available, using CQL Shell fallback');
                              // Fallback: use CQL Shell
                              setQueryText(cql);
                              setShowCreateTableDialog(false);
                              setShowQueryEditor(true);
                            }
                          }}
                          disabled={!newTableName.trim() || !newTableKeyspace}
                        >
                          Create Table
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowCreateTableDialog(false);
                          setNewTableName('');
                          setNewTableKeyspace(keyspaces[0]?.name || 'system');
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {displayTables.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No tables created</p>
                ) : (
                  <div className="space-y-3">
                    {displayTables.map((table, index) => (
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
            
            {/* Replication Visualization */}
            <CassandraReplicationVisualization
              replicaInfo={replicaInfo}
              nodes={displayNodes}
              keyspaces={displayKeyspaces}
              onPartitionKeyChange={(partitionKey) => {
                setSelectedPartitionKey(partitionKey);
                const parts = partitionKey.split(':');
                if (parts.length >= 2) {
                  const keyspaceName = parts[0];
                  const pk = parts.slice(1).join(':');
                  const cassandraEngine = emulationEngine.getCassandraRoutingEngine(componentId);
                  if (cassandraEngine) {
                    const info = cassandraEngine.getReplicaInfo(keyspaceName, pk);
                    setReplicaInfo(info);
                  }
                }
              }}
            />
            
            {/* TTL Information for Tables */}
            {displayTables.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>TTL Information</CardTitle>
                  <CardDescription>Time To Live statistics for tables</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {displayTables.map((table) => {
                      const cassandraEngine = emulationEngine.getCassandraRoutingEngine(componentId);
                      const ttlInfo = cassandraEngine?.getTTLInfo(`${table.keyspace}.${table.name}`);
                      
                      if (!ttlInfo || ttlInfo.totalRows === 0) {
                        return null;
                      }
                      
                      return (
                        <div key={`${table.keyspace}.${table.name}`} className="p-3 rounded-lg border">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Table className="h-4 w-4" />
                              <span className="font-medium">{table.keyspace}.{table.name}</span>
                            </div>
                            <Badge variant="outline">
                              {ttlInfo.rowsWithTTL} / {ttlInfo.totalRows} with TTL
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Total Rows</span>
                              <p className="font-semibold">{ttlInfo.totalRows}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Rows with TTL</span>
                              <p className="font-semibold">{ttlInfo.rowsWithTTL}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Expired Rows</span>
                              <p className="font-semibold text-destructive">{ttlInfo.expiredRows}</p>
                            </div>
                          </div>
                          {ttlInfo.averageTTL > 0 && (
                            <div className="mt-2 text-sm">
                              <span className="text-muted-foreground">Average TTL: </span>
                              <span className="font-semibold">{ttlInfo.averageTTL.toFixed(0)} seconds</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
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
                        <Button 
                          onClick={executeQuery} 
                          disabled={!queryText.trim()}
                          title={!queryText.trim() ? 'Enter a CQL query to execute' : 'Execute CQL query'}
                        >
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Cluster Nodes</CardTitle>
                    <CardDescription>Cassandra cluster topology</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => {
                    setShowCreateNodeDialog(true);
                    setNewNodeAddress('');
                    setNewNodeTokens(256);
                    setNewNodeDatacenter(config.datacenter || 'dc1');
                    setNewNodeRack('rack1');
                    setNewNodeStatus('up');
                    setNodeValidationError(null);
                  }} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Node
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Create/Edit Node Dialog */}
                {(showCreateNodeDialog || editingNodeIndex !== null) && (
                  <Card className="mb-4 border-primary">
                    <CardHeader>
                      <CardTitle>
                        {editingNodeIndex !== null ? 'Edit Node' : 'Add New Node'}
                      </CardTitle>
                      <CardDescription>Configure Cassandra cluster node</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="node-address">Address (host:port)</Label>
                        <Input
                          id="node-address"
                          value={editingNodeIndex !== null ? displayNodes[editingNodeIndex]?.address : newNodeAddress}
                          onChange={(e) => {
                            if (editingNodeIndex !== null) {
                              const updatedNodes = [...displayNodes];
                              updatedNodes[editingNodeIndex] = { ...updatedNodes[editingNodeIndex], address: e.target.value };
                              updateConfig({ nodes: updatedNodes });
                            } else {
                              setNewNodeAddress(e.target.value);
                            }
                            setNodeValidationError(null);
                          }}
                          placeholder="localhost:9042"
                        />
                        {nodeValidationError && (
                          <p className="text-sm text-destructive">{nodeValidationError}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="node-tokens">Tokens (vnodes)</Label>
                          <Input
                            id="node-tokens"
                            type="number"
                            min="1"
                            max="10000"
                            value={editingNodeIndex !== null ? displayNodes[editingNodeIndex]?.tokens : newNodeTokens}
                            onChange={(e) => {
                              const tokens = parseInt(e.target.value) || 256;
                              if (editingNodeIndex !== null) {
                                const updatedNodes = [...displayNodes];
                                updatedNodes[editingNodeIndex] = { ...updatedNodes[editingNodeIndex], tokens };
                                updateConfig({ nodes: updatedNodes });
                              } else {
                                setNewNodeTokens(tokens);
                              }
                              setNodeValidationError(null);
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="node-status">Initial Status</Label>
                          <Select
                            value={editingNodeIndex !== null ? displayNodes[editingNodeIndex]?.status : newNodeStatus}
                            onValueChange={(value: 'up' | 'down') => {
                              if (editingNodeIndex !== null) {
                                const updatedNodes = [...displayNodes];
                                updatedNodes[editingNodeIndex] = { ...updatedNodes[editingNodeIndex], status: value };
                                updateConfig({ nodes: updatedNodes });
                              } else {
                                setNewNodeStatus(value);
                              }
                            }}
                          >
                            <SelectTrigger id="node-status">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="up">Up</SelectItem>
                              <SelectItem value="down">Down</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="node-datacenter">Datacenter</Label>
                          <Input
                            id="node-datacenter"
                            value={editingNodeIndex !== null ? (displayNodes[editingNodeIndex]?.datacenter || config.datacenter || 'dc1') : newNodeDatacenter}
                            onChange={(e) => {
                              if (editingNodeIndex !== null) {
                                const updatedNodes = [...displayNodes];
                                updatedNodes[editingNodeIndex] = { ...updatedNodes[editingNodeIndex], datacenter: e.target.value };
                                updateConfig({ nodes: updatedNodes });
                              } else {
                                setNewNodeDatacenter(e.target.value);
                              }
                            }}
                            placeholder="dc1"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="node-rack">Rack</Label>
                          <Input
                            id="node-rack"
                            value={editingNodeIndex !== null ? (displayNodes[editingNodeIndex]?.rack || 'rack1') : newNodeRack}
                            onChange={(e) => {
                              if (editingNodeIndex !== null) {
                                const updatedNodes = [...displayNodes];
                                updatedNodes[editingNodeIndex] = { ...updatedNodes[editingNodeIndex], rack: e.target.value };
                                updateConfig({ nodes: updatedNodes });
                              } else {
                                setNewNodeRack(e.target.value);
                              }
                            }}
                            placeholder="rack1"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            const address = editingNodeIndex !== null ? displayNodes[editingNodeIndex]?.address : newNodeAddress;
                            const tokens = editingNodeIndex !== null ? displayNodes[editingNodeIndex]?.tokens : newNodeTokens;
                            const datacenter = editingNodeIndex !== null ? (displayNodes[editingNodeIndex]?.datacenter || config.datacenter || 'dc1') : newNodeDatacenter;
                            const rack = editingNodeIndex !== null ? (displayNodes[editingNodeIndex]?.rack || 'rack1') : newNodeRack;
                            const status = editingNodeIndex !== null ? displayNodes[editingNodeIndex]?.status : newNodeStatus;
                            
                            // Validate
                            const existingAddresses = displayNodes
                              .map((n, idx) => idx === editingNodeIndex ? '' : n.address)
                              .filter(Boolean);
                            
                            const validation = validateNode(
                              { address, tokens, datacenter, rack },
                              existingAddresses
                            );
                            
                            if (!validation.valid) {
                              setNodeValidationError(validation.errors.join(', '));
                              return;
                            }
                            
                            if (editingNodeIndex !== null) {
                              // Update existing node
                              const updatedNodes = [...displayNodes];
                              updatedNodes[editingNodeIndex] = {
                                address,
                                tokens,
                                datacenter,
                                rack,
                                status,
                                load: displayNodes[editingNodeIndex].load,
                              };
                              updateConfig({ nodes: updatedNodes });
                              setEditingNodeIndex(null);
                            } else {
                              // Add new node
                              const newNodes = [
                                ...displayNodes,
                                {
                                  address,
                                  tokens,
                                  datacenter,
                                  rack,
                                  status,
                                  load: 0.0,
                                },
                              ];
                              updateConfig({ nodes: newNodes });
                              setShowCreateNodeDialog(false);
                              setNewNodeAddress('');
                              setNewNodeTokens(256);
                              setNewNodeDatacenter(config.datacenter || 'dc1');
                              setNewNodeRack('rack1');
                            }
                            setNodeValidationError(null);
                          }}
                          disabled={!newNodeAddress.trim() && editingNodeIndex === null}
                        >
                          {editingNodeIndex !== null ? 'Save Changes' : 'Add Node'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowCreateNodeDialog(false);
                            setEditingNodeIndex(null);
                            setNewNodeAddress('');
                            setNewNodeTokens(256);
                            setNewNodeDatacenter(config.datacenter || 'dc1');
                            setNewNodeRack('rack1');
                            setNodeValidationError(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {displayNodes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No nodes configured. Add a node to start.</p>
                ) : (
                  <div className="space-y-3">
                    {displayNodes.map((n, index) => (
                      <Card key={index} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`h-3 w-3 rounded-full ${n.status === 'up' ? 'bg-green-500' : 'bg-red-500'}`} />
                              <div>
                                <CardTitle className="text-lg">{n.address}</CardTitle>
                                <CardDescription className="text-xs mt-1">
                                  {n.tokens} tokens • Load: {(n.load * 100).toFixed(1)}%
                                  {n.datacenter && ` • ${n.datacenter}`}
                                  {n.rack && `/${n.rack}`}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={n.status === 'up' ? 'default' : 'destructive'}>
                                {n.status.toUpperCase()}
                              </Badge>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setEditingNodeIndex(index);
                                  setShowCreateNodeDialog(false);
                                  setNodeValidationError(null);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  const updatedNodes = displayNodes.filter((_, i) => i !== index);
                                  updateConfig({ nodes: updatedNodes });
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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
                )}
              </CardContent>
            </Card>
            
            {/* Token Ring Visualization */}
            {tokenRingData && (
              <CassandraTokenRingVisualization
                tokenRanges={tokenRingData.tokenRanges}
                sortedTokens={tokenRingData.sortedTokens}
                nodeTokens={tokenRingData.nodeTokens}
                nodes={displayNodes}
                selectedPartitionKey={selectedPartitionKey}
                onPartitionKeySelect={setSelectedPartitionKey}
              />
            )}
            
            {/* Datacenter Metrics */}
            {datacenterMetrics.size > 0 && (
              <CassandraDatacenterMetrics datacenterMetrics={datacenterMetrics} />
            )}
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
                      <div className="text-2xl font-bold">{readLatency !== null ? `${readLatency}ms` : '—'}</div>
                      {readLatency !== null && (
                        <Progress value={Math.min((readLatency / 10) * 100, 100)} className="h-2 mt-2" />
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Write Latency</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{writeLatency !== null ? `${writeLatency}ms` : '—'}</div>
                      {writeLatency !== null && (
                        <Progress value={Math.min((writeLatency / 10) * 100, 100)} className="h-2 mt-2" />
                      )}
                    </CardContent>
                  </Card>
                </div>
                {(realMetrics?.hintedHandoffs !== undefined || realMetrics?.pendingCompactions !== undefined) && (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {realMetrics.hintedHandoffs !== undefined && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium">Hinted Handoffs</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{realMetrics.hintedHandoffs}</div>
                          <p className="text-xs text-muted-foreground mt-1">Pending hints</p>
                        </CardContent>
                      </Card>
                    )}
                    {realMetrics.pendingCompactions !== undefined && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium">Pending Compactions</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{realMetrics.pendingCompactions}</div>
                          <p className="text-xs text-muted-foreground mt-1">SSTable compactions</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
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
                <div className="space-y-2">
                  <Label htmlFor="replication-factor">Default Replication Factor</Label>
                  <Input
                    id="replication-factor"
                    type="number"
                    min="1"
                    max="10"
                    value={replicationFactor}
                    onChange={(e) => updateConfig({ replicationFactor: parseInt(e.target.value) || 3 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Default replication factor for new keyspaces. Can be overridden per keyspace.
                  </p>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="compaction-strategy">Compaction Strategy</Label>
                  <Select
                    value={config.compactionStrategy || 'SizeTieredCompactionStrategy'}
                    onValueChange={(value) => {
                      updateConfig({ compactionStrategy: value });
                      // Sync with engine
                      const cassandraEngine = emulationEngine.getCassandraRoutingEngine(componentId);
                      if (cassandraEngine) {
                        cassandraEngine.syncFromConfig({ ...config, compactionStrategy: value });
                      }
                    }}
                  >
                    <SelectTrigger id="compaction-strategy">
                      <SelectValue placeholder="Select compaction strategy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SizeTieredCompactionStrategy">Size-Tiered Compaction Strategy</SelectItem>
                      <SelectItem value="LeveledCompactionStrategy">Leveled Compaction Strategy</SelectItem>
                      <SelectItem value="TimeWindowCompactionStrategy">Time-Window Compaction Strategy</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Compaction strategy affects how SSTables are merged. SizeTiered is default for most workloads.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="enable-compaction">Enable Compaction</Label>
                    <Switch
                      id="enable-compaction"
                      checked={config.enableCompaction !== false}
                      onCheckedChange={(checked) => {
                        updateConfig({ enableCompaction: checked });
                        const cassandraEngine = emulationEngine.getCassandraRoutingEngine(componentId);
                        if (cassandraEngine) {
                          cassandraEngine.syncFromConfig({ ...config, enableCompaction: checked });
                        }
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    When enabled, SSTables are periodically compacted to improve read performance.
                  </p>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="default-consistency-level">Default Consistency Level</Label>
                  <Select
                    value={consistencyLevel}
                    onValueChange={(value) => updateConfig({ consistencyLevel: value })}
                  >
                    <SelectTrigger id="default-consistency-level">
                      <SelectValue placeholder="Select consistency level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ONE">ONE</SelectItem>
                      <SelectItem value="TWO">TWO</SelectItem>
                      <SelectItem value="THREE">THREE</SelectItem>
                      <SelectItem value="QUORUM">QUORUM</SelectItem>
                      <SelectItem value="ALL">ALL</SelectItem>
                      <SelectItem value="LOCAL_ONE">LOCAL_ONE</SelectItem>
                      <SelectItem value="LOCAL_QUORUM">LOCAL_QUORUM</SelectItem>
                      <SelectItem value="EACH_QUORUM">EACH_QUORUM</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Default consistency level for CQL queries. Can be overridden per query using CONSISTENCY command or in CQL Shell.
                  </p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 p-3">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>Note:</strong> In real Apache Cassandra, consistency level is specified per query/session, not as a global cluster setting. 
                    This is a default value used when not explicitly specified in queries.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


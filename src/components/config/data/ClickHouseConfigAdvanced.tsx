import { useCanvasStore } from '@/store/useCanvasStore';
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
  Database, 
  BarChart3, 
  Settings, 
  Activity,
  HardDrive,
  Zap,
  Plus,
  Trash2,
  Play,
  Code,
  RefreshCcw,
  Table,
  Layers
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { usePortValidation } from '@/hooks/usePortValidation';
import { AlertCircle } from 'lucide-react';
import { validateRequiredFields, type RequiredField } from '@/utils/requiredFields';
import { showSuccess, showError } from '@/utils/toast';
import { emulationEngine } from '@/core/EmulationEngine';

interface ClickHouseConfigProps {
  componentId: string;
}

interface Table {
  name: string;
  engine: string;
  rows: number;
  size: number;
  partitions: number;
  columns?: Array<{
    name: string;
    type: string;
  }>;
}

interface Query {
  id: string;
  query: string;
  duration: number;
  status: 'running' | 'completed' | 'failed';
}

interface ClickHouseConfig {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  tables?: Table[];
  queries?: Query[];
  totalRows?: number;
  totalSize?: number;
  queryThroughput?: number;
  avgQueryTime?: number;
}

export function ClickHouseConfigAdvanced({ componentId }: ClickHouseConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as ClickHouseConfig;
  const host = config.host || 'localhost';
  const port = config.port || 8123;
  const database = config.database || 'default';
  const username = config.username || 'default';
  const password = config.password || '';
  const tables = config.tables || [];
  const queries = config.queries || [];
  
  const [editingTableIndex, setEditingTableIndex] = useState<number | null>(null);
  const [showQueryEditor, setShowQueryEditor] = useState(false);
  const [queryText, setQueryText] = useState('');
  // Get real-time metrics from ClickHouseRoutingEngine
  const clickHouseEngine = emulationEngine.getClickHouseRoutingEngine(componentId);
  const realMetrics = clickHouseEngine?.getMetrics();
  
  const totalRows = realMetrics?.totalRows || config.totalRows || tables.reduce((sum, t) => sum + t.rows, 0);
  const totalSize = realMetrics?.totalSize || config.totalSize || tables.reduce((sum, t) => sum + t.size, 0);
  const queryThroughput = realMetrics?.queryThroughput || config.queryThroughput || 1250;
  const avgQueryTime = realMetrics?.avgQueryTime || config.avgQueryTime || 45;

  // Валидация портов и хостов
  const { portError, hostError, portConflict } = usePortValidation(nodes, componentId, host, port);

  const updateConfig = (updates: Partial<ClickHouseConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
    // Очистка ошибок валидации при успешном обновлении
    if (Object.keys(updates).some(key => ['host', 'port', 'database'].includes(key))) {
      const newErrors = { ...fieldErrors };
      Object.keys(updates).forEach(key => {
        if (newErrors[key]) delete newErrors[key];
      });
      setFieldErrors(newErrors);
    }
  };
  
  // Валидация обязательных полей
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  const requiredFields: RequiredField[] = [
    { field: 'host', label: 'Host' },
    { field: 'port', label: 'Port', validator: (v) => typeof v === 'number' && v > 0 && v <= 65535 },
    { field: 'database', label: 'Database' },
  ];
  
  const validateConnectionFields = () => {
    const result = validateRequiredFields(
      { host, port, database },
      requiredFields
    );
    setFieldErrors(result.errors);
    return result.isValid;
  };

  const addTable = () => {
    const tableName = 'new_table';
    
    // Проверка на дубликаты и генерация уникального имени
    let finalName = tableName;
    let counter = 1;
    while (tables.some(t => t.name === finalName)) {
      finalName = `${tableName}_${counter}`;
      counter++;
    }
    
    updateConfig({
      tables: [...tables, { name: finalName, engine: 'MergeTree', rows: 0, size: 0, partitions: 0 }],
    });
  };

  const removeTable = (index: number) => {
    updateConfig({ tables: tables.filter((_, i) => i !== index) });
  };

  const updateTable = (index: number, field: string, value: any) => {
    const newTables = [...tables];
    newTables[index] = { ...newTables[index], [field]: value };
    updateConfig({ tables: newTables });
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
    };
    
    // Execute query through ClickHouseRoutingEngine
    const clickHouseEngine = emulationEngine.getClickHouseRoutingEngine(componentId);
    let resultQuery: Query = newQuery;
    
    if (clickHouseEngine) {
      try {
        const result = clickHouseEngine.executeQuery(queryText);
        const duration = Date.now() - startTime;
        
        resultQuery = {
          id: queryId,
          query: queryText,
          status: result.success ? 'completed' : 'failed',
          duration: result.latency || duration,
        };
        
        // If CREATE TABLE or DROP TABLE succeeded, sync tables from engine
        if (result.success) {
          const normalizedQuery = queryText.trim().toUpperCase();
          if (normalizedQuery.startsWith('CREATE TABLE') || normalizedQuery.startsWith('DROP TABLE')) {
            // Force sync from config (tables are managed in UI config)
            // This will be handled by syncFromConfig in EmulationEngine
          }
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        resultQuery = {
          id: queryId,
          query: queryText,
          status: 'failed',
          duration,
        };
      }
    } else {
      // No engine available, just mark as completed (simulated)
      resultQuery.status = 'completed';
      resultQuery.duration = Date.now() - startTime;
    }
    
    updateConfig({ queries: [resultQuery, ...queries.slice(0, 9)] });
    setQueryText('');
    setShowQueryEditor(false);
    
    if (resultQuery.status === 'failed') {
      showError('Query execution failed');
    } else {
      showSuccess('Query executed successfully');
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <BarChart3 className="h-6 w-6 text-yellow-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">ClickHouse</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Column-Oriented Analytics Database
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Running
            </Badge>
            <Button size="sm" variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Query Console
            </Button>
          </div>
        </div>

        <Separator />


        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Tables</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tables.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Total tables</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Rows</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(totalRows / 1000000).toFixed(1)}M</div>
              <p className="text-xs text-muted-foreground mt-1">Rows across all tables</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Size</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSize.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground mt-1">GB</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Query Throughput</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{queryThroughput}</div>
              <p className="text-xs text-muted-foreground mt-1">queries/sec</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Configuration Tabs */}
        <Tabs defaultValue="tables" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tables" className="gap-2">
              <Database className="h-4 w-4" />
              Tables
            </TabsTrigger>
            <TabsTrigger value="queries" className="gap-2">
              <Code className="h-4 w-4" />
              Query Console
            </TabsTrigger>
            <TabsTrigger value="performance" className="gap-2">
              <Activity className="h-4 w-4" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Tables Tab */}
          <TabsContent value="tables" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Tables</CardTitle>
                    <CardDescription>ClickHouse table configuration</CardDescription>
                  </div>
                  <Button size="sm" onClick={addTable} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Table
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tables.map((table, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-primary/10">
                              <Database className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{table.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {table.engine} • {table.partitions} partitions • {table.rows.toLocaleString()} rows • {table.size} GB
                              </CardDescription>
                            </div>
                          </div>
                          {tables.length > 1 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeTable(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      {editingTableIndex === index && (
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Table Engine</Label>
                              <Select
                                value={table.engine}
                                onValueChange={(value) => updateTable(index, 'engine', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="MergeTree">MergeTree</SelectItem>
                                  <SelectItem value="SummingMergeTree">SummingMergeTree</SelectItem>
                                  <SelectItem value="ReplacingMergeTree">ReplacingMergeTree</SelectItem>
                                  <SelectItem value="AggregatingMergeTree">AggregatingMergeTree</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Partitions</Label>
                              <Input
                                type="number"
                                value={table.partitions}
                                onChange={(e) => updateTable(index, 'partitions', Number(e.target.value))}
                                min={0}
                              />
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingTableIndex(null)}
                          >
                            Done
                          </Button>
                        </CardContent>
                      )}
                      {editingTableIndex !== index && (
                        <CardContent>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingTableIndex(index)}
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

          {/* Queries Tab */}
          <TabsContent value="queries" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Query Console</CardTitle>
                    <CardDescription>Execute ClickHouse SQL queries</CardDescription>
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
                        <Label>SQL Query</Label>
                        <Textarea
                          value={queryText}
                          onChange={(e) => setQueryText(e.target.value)}
                          placeholder="SELECT count() FROM events WHERE date = today();"
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
                                {query.status === 'running' && (
                                  <Play className="h-4 w-4 text-blue-500 animate-pulse" />
                                )}
                                <Badge variant={
                                  query.status === 'completed' ? 'default' :
                                  query.status === 'failed' ? 'destructive' : 'secondary'
                                }>
                                  {query.status}
                                </Badge>
                                {query.duration > 0 && (
                                  <Badge variant="outline">{query.duration}ms</Badge>
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

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Query throughput and latency</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Query Throughput</span>
                      <span className="font-semibold">{queryThroughput.toLocaleString()} qps</span>
                    </div>
                    <Progress value={Math.min((queryThroughput / 5000) * 100, 100)} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Avg Query Time</span>
                      <span className="font-semibold">{avgQueryTime}ms</span>
                    </div>
                    <Progress value={Math.min((avgQueryTime / 200) * 100, 100)} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Connection Settings</CardTitle>
                <CardDescription>ClickHouse server configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="host">
                      Host <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="host"
                      value={host}
                      onChange={(e) => {
                        updateConfig({ host: e.target.value });
                        if (fieldErrors.host) {
                          validateConnectionFields();
                        }
                      }}
                      onBlur={validateConnectionFields}
                      placeholder="localhost"
                      className={hostError || fieldErrors.host ? 'border-destructive' : ''}
                    />
                    {hostError && (
                      <div className="flex items-center gap-1 text-sm text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        <span>{hostError}</span>
                      </div>
                    )}
                    {!hostError && fieldErrors.host && (
                      <div className="flex items-center gap-1 text-sm text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        <span>{fieldErrors.host}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">
                      Port <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="port"
                      type="number"
                      value={port}
                      onChange={(e) => {
                        updateConfig({ port: parseInt(e.target.value) || 8123 });
                        if (fieldErrors.port) {
                          validateConnectionFields();
                        }
                      }}
                      onBlur={validateConnectionFields}
                      placeholder="8123"
                      className={portError || portConflict.hasConflict || fieldErrors.port ? 'border-destructive' : ''}
                    />
                    {portError && (
                      <div className="flex items-center gap-1 text-sm text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        <span>{portError}</span>
                      </div>
                    )}
                    {!portError && fieldErrors.port && (
                      <div className="flex items-center gap-1 text-sm text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        <span>{fieldErrors.port}</span>
                      </div>
                    )}
                    {!portError && !fieldErrors.port && portConflict.hasConflict && portConflict.conflictingNode && (
                      <div className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
                        <AlertCircle className="h-3 w-3" />
                        <span>
                          Конфликт порта: компонент "{portConflict.conflictingNode.data.label || portConflict.conflictingNode.type}" 
                          уже использует {host}:{port}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="database">
                    Database <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="database"
                    value={database}
                    onChange={(e) => {
                      updateConfig({ database: e.target.value });
                      if (fieldErrors.database) {
                        validateConnectionFields();
                      }
                    }}
                    onBlur={validateConnectionFields}
                    placeholder="default"
                    className={fieldErrors.database ? 'border-destructive' : ''}
                  />
                  {fieldErrors.database && (
                    <div className="flex items-center gap-1 text-sm text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      <span>{fieldErrors.database}</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => updateConfig({ username: e.target.value })}
                      placeholder="default"
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
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={() => {
                      if (validateConnectionFields()) {
                        showSuccess('Параметры подключения сохранены');
                      } else {
                        showError('Пожалуйста, заполните все обязательные поля');
                      }
                    }}
                  >
                    Сохранить настройки
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (validateConnectionFields()) {
                        showSuccess('Параметры подключения валидны');
                      } else {
                        showError('Пожалуйста, заполните все обязательные поля');
                      }
                    }}
                  >
                    Проверить подключение
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


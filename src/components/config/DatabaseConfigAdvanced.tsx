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
  Table, 
  Settings, 
  Activity,
  Users,
  HardDrive,
  Zap
} from 'lucide-react';

interface DatabaseConfigProps {
  componentId: string;
}

interface TableInfo {
  name: string;
  rows: number;
  size: number;
  indexes: number;
}

interface DatabaseConfig {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  maxConnections?: number;
  schema?: string;
  tables?: TableInfo[];
  activeConnections?: number;
  queryLatency?: number;
}

export function DatabaseConfigAdvanced({ componentId }: DatabaseConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as DatabaseConfig;
  const host = config.host || 'localhost';
  const port = config.port || (node.type === 'postgres' ? 5432 : node.type === 'mongodb' ? 27017 : 6379);
  const database = config.database || 'default_db';
  const username = config.username || 'admin';
  const password = config.password || '';
  const maxConnections = config.maxConnections || 100;
  const schema = config.schema || '';
  const tables = config.tables || [
    { name: 'users', rows: 1250, size: 2.5, indexes: 3 },
    { name: 'orders', rows: 5430, size: 8.2, indexes: 5 },
    { name: 'products', rows: 890, size: 1.8, indexes: 2 },
  ];
  const activeConnections = config.activeConnections || 15;
  const queryLatency = config.queryLatency || 12;

  const updateConfig = (updates: Partial<DatabaseConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const getDbName = () => {
    switch (node.type) {
      case 'postgres':
        return 'PostgreSQL';
      case 'mongodb':
        return 'MongoDB';
      case 'redis':
        return 'Redis';
      default:
        return 'Database';
    }
  };

  const getDbIcon = () => {
    switch (node.type) {
      case 'postgres':
        return '🐘';
      case 'mongodb':
        return '🍃';
      case 'redis':
        return '🔴';
      default:
        return '🗄️';
    }
  };

  const totalRows = tables.reduce((sum, t) => sum + t.rows, 0);
  const totalSize = tables.reduce((sum, t) => sum + t.size, 0);

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
              <h2 className="text-2xl font-bold text-foreground">{getDbName()} Configuration</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Database connection and management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Connected
            </Badge>
            <Button size="sm" variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Admin Panel
            </Button>
          </div>
        </div>

        <Separator />


        {/* Main Configuration Tabs */}
        <Tabs defaultValue="connection" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="connection" className="gap-2">
              <Database className="h-4 w-4" />
              Connection
            </TabsTrigger>
            <TabsTrigger value="tables" className="gap-2">
              <Table className="h-4 w-4" />
              Tables
            </TabsTrigger>
            {node.type === 'postgres' && (
              <TabsTrigger value="schema" className="gap-2">
                <Zap className="h-4 w-4" />
                Schema
              </TabsTrigger>
            )}
          </TabsList>

          {/* Connection Tab */}
          <TabsContent value="connection" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Connection Settings</CardTitle>
                <CardDescription>Database server connection details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="host">Host</Label>
                    <Input
                      id="host"
                      value={host}
                      onChange={(e) => updateConfig({ host: e.target.value })}
                      placeholder="localhost"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="number"
                      value={port}
                      onChange={(e) => updateConfig({ port: parseInt(e.target.value) || port })}
                      placeholder={port.toString()}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="database">Database Name</Label>
                    <Input
                      id="database"
                      value={database}
                      onChange={(e) => updateConfig({ database: e.target.value })}
                      placeholder="default_db"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => updateConfig({ username: e.target.value })}
                      placeholder="admin"
                    />
                  </div>
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
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="max-connections">Max Connections</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="max-connections"
                      type="number"
                      min="1"
                      value={maxConnections}
                      onChange={(e) => updateConfig({ maxConnections: parseInt(e.target.value) || 100 })}
                      placeholder="100"
                    />
                    <span className="text-sm text-muted-foreground">connections</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tables Tab */}
          <TabsContent value="tables" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Database Tables</CardTitle>
                <CardDescription>Table information and statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tables.map((table, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-primary/10">
                              <Table className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{table.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {table.indexes} indexes
                              </CardDescription>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schema Tab (PostgreSQL only) */}
          {node.type === 'postgres' && (
            <TabsContent value="schema" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>SQL Schema</CardTitle>
                  <CardDescription>Database schema definition (SQL)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="schema">Schema Definition</Label>
                    <Textarea
                      id="schema"
                      value={schema}
                      onChange={(e) => updateConfig({ schema: e.target.value })}
                      placeholder="CREATE TABLE users (&#10;  id SERIAL PRIMARY KEY,&#10;  username VARCHAR(50),&#10;  email VARCHAR(100)&#10;);"
                      className="font-mono text-sm h-96"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

        </Tabs>
      </div>
    </div>
  );
}


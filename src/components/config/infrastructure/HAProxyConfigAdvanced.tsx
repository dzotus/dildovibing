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
import { useState } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Server,
  Network,
  Shield,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface HAProxyConfigProps {
  componentId: string;
}

interface BackendServer {
  id: string;
  name: string;
  address: string;
  port: number;
  weight?: number;
  check?: boolean;
  status: 'up' | 'down' | 'maint';
  sessions?: number;
  bytesIn?: number;
  bytesOut?: number;
  errors?: number;
}

interface Frontend {
  id: string;
  name: string;
  bind: string;
  mode: 'http' | 'tcp';
  backends: string[];
  ssl?: boolean;
  requests?: number;
  responses?: number;
}

interface Backend {
  id: string;
  name: string;
  mode: 'http' | 'tcp';
  balance: 'roundrobin' | 'leastconn' | 'source' | 'uri';
  servers: BackendServer[];
  healthCheck?: {
    enabled: boolean;
    interval?: number;
    timeout?: number;
    path?: string;
  };
}

interface HAProxyConfig {
  frontends?: Frontend[];
  backends?: Backend[];
  totalRequests?: number;
  totalResponses?: number;
  activeConnections?: number;
  totalBytesIn?: number;
  totalBytesOut?: number;
}

export function HAProxyConfigAdvanced({ componentId }: HAProxyConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as HAProxyConfig;
  const frontends = config.frontends || [
    {
      id: '1',
      name: 'http_frontend',
      bind: '0.0.0.0:80',
      mode: 'http',
      backends: ['web_backend'],
      requests: 125000,
      responses: 124500,
    },
  ];
  const backends = config.backends || [
    {
      id: '1',
      name: 'web_backend',
      mode: 'http',
      balance: 'roundrobin',
      servers: [
        {
          id: '1',
          name: 'web1',
          address: '192.168.1.10',
          port: 8080,
          weight: 100,
          check: true,
          status: 'up',
          sessions: 45,
          bytesIn: 1024000,
          bytesOut: 2048000,
          errors: 0,
        },
        {
          id: '2',
          name: 'web2',
          address: '192.168.1.11',
          port: 8080,
          weight: 100,
          check: true,
          status: 'up',
          sessions: 38,
          bytesIn: 890000,
          bytesOut: 1780000,
          errors: 0,
        },
      ],
      healthCheck: {
        enabled: true,
        interval: 2000,
        timeout: 1000,
        path: '/health',
      },
    },
  ];
  const totalRequests = config.totalRequests || frontends.reduce((sum, f) => sum + (f.requests || 0), 0);
  const totalResponses = config.totalResponses || frontends.reduce((sum, f) => sum + (f.responses || 0), 0);
  const activeConnections = config.activeConnections || backends.reduce((sum, b) => 
    sum + b.servers.reduce((s, server) => s + (server.sessions || 0), 0), 0
  );
  const totalBytesIn = config.totalBytesIn || backends.reduce((sum, b) => 
    sum + b.servers.reduce((s, server) => s + (server.bytesIn || 0), 0), 0
  );
  const totalBytesOut = config.totalBytesOut || backends.reduce((sum, b) => 
    sum + b.servers.reduce((s, server) => s + (server.bytesOut || 0), 0), 0
  );

  const [editingBackendIndex, setEditingBackendIndex] = useState<number | null>(null);
  const [showCreateBackend, setShowCreateBackend] = useState(false);

  const updateConfig = (updates: Partial<HAProxyConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addBackend = () => {
    const newBackend: Backend = {
      id: `backend-${Date.now()}`,
      name: 'new-backend',
      mode: 'http',
      balance: 'roundrobin',
      servers: [],
      healthCheck: {
        enabled: true,
        interval: 2000,
        timeout: 1000,
        path: '/health',
      },
    };
    updateConfig({ backends: [...backends, newBackend] });
    setShowCreateBackend(false);
  };

  const removeBackend = (id: string) => {
    updateConfig({ backends: backends.filter((b) => b.id !== id) });
  };

  const updateBackend = (id: string, field: string, value: any) => {
    const newBackends = backends.map((b) =>
      b.id === id ? { ...b, [field]: value } : b
    );
    updateConfig({ backends: newBackends });
  };

  const addServer = (backendId: string) => {
    const backend = backends.find((b) => b.id === backendId);
    if (!backend) return;

    const newServer: BackendServer = {
      id: `server-${Date.now()}`,
      name: 'new-server',
      address: '192.168.1.100',
      port: 8080,
      weight: 100,
      check: true,
      status: 'up',
      sessions: 0,
      bytesIn: 0,
      bytesOut: 0,
      errors: 0,
    };
    updateBackend(backendId, 'servers', [...backend.servers, newServer]);
  };

  const removeServer = (backendId: string, serverId: string) => {
    const backend = backends.find((b) => b.id === backendId);
    if (!backend) return;
    updateBackend(backendId, 'servers', backend.servers.filter((s) => s.id !== serverId));
  };

  const updateServer = (backendId: string, serverId: string, field: string, value: any) => {
    const backend = backends.find((b) => b.id === backendId);
    if (!backend) return;
    const newServers = backend.servers.map((s) =>
      s.id === serverId ? { ...s, [field]: value } : s
    );
    updateBackend(backendId, 'servers', newServers);
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">HAProxy</p>
            <h2 className="text-2xl font-bold text-foreground">Load Balancer</h2>
            <p className="text-sm text-muted-foreground mt-1">
              High-performance load balancer and proxy server
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh Stats
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-5 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Requests</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalRequests.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Responses</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">{totalResponses.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Connections</CardTitle>
                <Network className="h-4 w-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{activeConnections}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Bytes In</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{(totalBytesIn / 1024 / 1024).toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">MB</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Bytes Out</CardTitle>
                <TrendingUp className="h-4 w-4 text-orange-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{(totalBytesOut / 1024 / 1024).toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">MB</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="backends" className="space-y-4">
          <TabsList>
            <TabsTrigger value="backends">
              <Server className="h-4 w-4 mr-2" />
              Backends ({backends.length})
            </TabsTrigger>
            <TabsTrigger value="frontends">
              <Network className="h-4 w-4 mr-2" />
              Frontends ({frontends.length})
            </TabsTrigger>
            <TabsTrigger value="stats">
              <Activity className="h-4 w-4 mr-2" />
              Statistics
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="backends" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Backends</CardTitle>
                    <CardDescription>Configure backend server pools</CardDescription>
                  </div>
                  <Button onClick={addBackend} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Backend
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {backends.map((backend) => (
                    <Card key={backend.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                              <Server className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{backend.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline">{backend.mode.toUpperCase()}</Badge>
                                <Badge variant="outline">{backend.balance}</Badge>
                                <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20">
                                  {backend.servers.length} servers
                                </Badge>
                                <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20">
                                  {backend.servers.filter((s) => s.status === 'up').length} up
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addServer(backend.id)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Server
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeBackend(backend.id)}
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Backend Name</Label>
                            <Input
                              value={backend.name}
                              onChange={(e) => updateBackend(backend.id, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Mode</Label>
                            <Select
                              value={backend.mode}
                              onValueChange={(value: 'http' | 'tcp') => updateBackend(backend.id, 'mode', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="http">HTTP</SelectItem>
                                <SelectItem value="tcp">TCP</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Balance Algorithm</Label>
                            <Select
                              value={backend.balance}
                              onValueChange={(value: 'roundrobin' | 'leastconn' | 'source' | 'uri') => updateBackend(backend.id, 'balance', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="roundrobin">Round Robin</SelectItem>
                                <SelectItem value="leastconn">Least Connections</SelectItem>
                                <SelectItem value="source">Source</SelectItem>
                                <SelectItem value="uri">URI</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                          <Label>Servers</Label>
                          <div className="space-y-2">
                            {backend.servers.map((server) => (
                              <Card key={server.id} className="p-3 border-l-2 border-l-green-500">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className={`p-1.5 rounded ${
                                      server.status === 'up' ? 'bg-green-100 dark:bg-green-900/30' :
                                      server.status === 'down' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-900/30'
                                    }`}>
                                      {server.status === 'up' ? (
                                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                      ) : server.status === 'down' ? (
                                        <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                      ) : (
                                        <AlertCircle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                                      )}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{server.name}</span>
                                        <Badge variant="outline" className="text-xs">
                                          {server.address}:{server.port}
                                        </Badge>
                                        <Badge variant={server.status === 'up' ? 'default' : 'destructive'}>
                                          {server.status}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                        <span>Weight: {server.weight}</span>
                                        <span>Sessions: {server.sessions || 0}</span>
                                        {server.errors && server.errors > 0 && (
                                          <span className="text-red-500">Errors: {server.errors}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      value={server.weight || 100}
                                      onChange={(e) => updateServer(backend.id, server.id, 'weight', Number(e.target.value))}
                                      className="w-20"
                                      min={1}
                                      max={256}
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeServer(backend.id, server.id)}
                                      className="hover:bg-destructive/10 hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="frontends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Frontends</CardTitle>
                <CardDescription>Configure frontend listeners</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {frontends.map((frontend) => (
                    <Card key={frontend.id} className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow bg-gradient-to-r from-purple-50/50 to-transparent dark:from-purple-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                              <Network className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{frontend.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline">{frontend.bind}</Badge>
                                <Badge variant="outline">{frontend.mode.toUpperCase()}</Badge>
                                {frontend.ssl && (
                                  <Badge variant="default" className="bg-green-500">
                                    <Shield className="h-3 w-3 mr-1" />
                                    SSL
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Requests:</span>
                            <span className="ml-2 font-semibold">{frontend.requests?.toLocaleString() || 0}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Responses:</span>
                            <span className="ml-2 font-semibold">{frontend.responses?.toLocaleString() || 0}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Backends:</span>
                            <span className="ml-2 font-semibold">{frontend.backends.length}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Real-time Statistics</CardTitle>
                <CardDescription>Live server and connection statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {backends.map((backend) => (
                    <Card key={backend.id} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{backend.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {backend.servers.map((server) => (
                            <div key={server.id} className="flex items-center justify-between p-2 border rounded">
                              <div className="flex items-center gap-3">
                                <Badge variant={server.status === 'up' ? 'default' : 'destructive'}>
                                  {server.status}
                                </Badge>
                                <span className="font-medium">{server.name}</span>
                                <span className="text-sm text-muted-foreground">{server.address}:{server.port}</span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>Sessions: {server.sessions || 0}</span>
                                <span>In: {(server.bytesIn || 0) / 1024} KB</span>
                                <span>Out: {(server.bytesOut || 0) / 1024} KB</span>
                                {server.errors && server.errors > 0 && (
                                  <span className="text-red-500">Errors: {server.errors}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>HAProxy Settings</CardTitle>
                <CardDescription>Global configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Stats UI</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Logging</Label>
                  <Switch defaultChecked />
                </div>
                <div className="space-y-2">
                  <Label>Max Connections</Label>
                  <Input type="number" defaultValue={4096} min={1} />
                </div>
                <div className="space-y-2">
                  <Label>Timeout Connect (ms)</Label>
                  <Input type="number" defaultValue={5000} min={1} />
                </div>
                <div className="space-y-2">
                  <Label>Timeout Server (ms)</Label>
                  <Input type="number" defaultValue={50000} min={1} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


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
  Network,
  Server,
  CheckCircle,
  XCircle,
  Zap,
  Globe,
  Shield
} from 'lucide-react';

interface EnvoyConfigProps {
  componentId: string;
}

interface Cluster {
  name: string;
  type: 'STATIC_DNS' | 'STRICT_DNS' | 'LOGICAL_DNS' | 'EDS' | 'ORIGINAL_DST';
  hosts: Array<{ address: string; port: number }>;
  healthChecks?: boolean;
  connectTimeout?: number;
  requests?: number;
  errors?: number;
}

interface Listener {
  name: string;
  address: string;
  port: number;
  filters: string[];
  activeConnections?: number;
  requests?: number;
}

interface Route {
  name: string;
  match: string;
  cluster: string;
  priority?: number;
  requests?: number;
}

interface EnvoyConfig {
  clusters?: Cluster[];
  listeners?: Listener[];
  routes?: Route[];
  totalClusters?: number;
  totalListeners?: number;
  totalRoutes?: number;
  totalRequests?: number;
  totalErrors?: number;
  enableAdminInterface?: boolean;
  enableAccessLogging?: boolean;
  enableStats?: boolean;
  adminPort?: number;
  drainTime?: number;
  maxConnections?: number;
  metrics?: {
    enabled?: boolean;
    prometheusPath?: string;
  };
}

export function EnvoyConfigAdvanced({ componentId }: EnvoyConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as EnvoyConfig;
  const clusters = config.clusters || [
    {
      name: 'backend-cluster',
      type: 'STRICT_DNS',
      hosts: [
        { address: 'backend-1', port: 8080 },
        { address: 'backend-2', port: 8080 },
      ],
      healthChecks: true,
      connectTimeout: 5000,
      requests: 12500,
      errors: 25,
    },
    {
      name: 'database-cluster',
      type: 'STATIC_DNS',
      hosts: [
        { address: 'db-primary', port: 5432 },
      ],
      healthChecks: true,
      connectTimeout: 3000,
      requests: 8900,
      errors: 5,
    },
  ];
  const listeners = config.listeners || [
    {
      name: 'http-listener',
      address: '0.0.0.0',
      port: 80,
      filters: ['http_connection_manager'],
      activeConnections: 45,
      requests: 12500,
    },
    {
      name: 'https-listener',
      address: '0.0.0.0',
      port: 443,
      filters: ['http_connection_manager', 'tls_inspector'],
      activeConnections: 38,
      requests: 9800,
    },
  ];
  const routes = config.routes || [
    {
      name: 'api-route',
      match: '/api/*',
      cluster: 'backend-cluster',
      priority: 1,
      requests: 8500,
    },
    {
      name: 'default-route',
      match: '*',
      cluster: 'backend-cluster',
      priority: 0,
      requests: 4000,
    },
  ];
  const totalClusters = config.totalClusters || clusters.length;
  const totalListeners = config.totalListeners || listeners.length;
  const totalRoutes = config.totalRoutes || routes.length;
  const totalRequests = config.totalRequests || listeners.reduce((sum, l) => sum + (l.requests || 0), 0);
  const totalErrors = config.totalErrors || clusters.reduce((sum, c) => sum + (c.errors || 0), 0);

  const [showCreateCluster, setShowCreateCluster] = useState(false);

  const updateConfig = (updates: Partial<EnvoyConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addCluster = () => {
    const newCluster: Cluster = {
      name: 'new-cluster',
      type: 'STRICT_DNS',
      hosts: [{ address: 'localhost', port: 8080 }],
      healthChecks: true,
      connectTimeout: 5000,
    };
    updateConfig({ clusters: [...clusters, newCluster] });
    setShowCreateCluster(false);
  };

  const removeCluster = (name: string) => {
    updateConfig({ clusters: clusters.filter((c) => c.name !== name) });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Envoy Proxy</p>
            <h2 className="text-2xl font-bold text-foreground">Service Proxy</h2>
            <p className="text-sm text-muted-foreground mt-1">
              High-performance edge and service proxy
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Globe className="h-4 w-4 mr-2" />
              Admin UI
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-5 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Clusters</CardTitle>
                <Server className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalClusters}</span>
                <span className="text-xs text-muted-foreground">configured</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Listeners</CardTitle>
                <Network className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalListeners}</span>
                <span className="text-xs text-muted-foreground">active</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Routes</CardTitle>
                <Globe className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{totalRoutes}</span>
                <span className="text-xs text-muted-foreground">defined</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Requests</CardTitle>
                <Activity className="h-4 w-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{totalRequests.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Errors</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-red-600 dark:text-red-400">{totalErrors}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="clusters" className="space-y-4">
          <TabsList>
            <TabsTrigger value="clusters">
              <Server className="h-4 w-4 mr-2" />
              Clusters ({clusters.length})
            </TabsTrigger>
            <TabsTrigger value="listeners">
              <Network className="h-4 w-4 mr-2" />
              Listeners ({listeners.length})
            </TabsTrigger>
            <TabsTrigger value="routes">
              <Globe className="h-4 w-4 mr-2" />
              Routes ({routes.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clusters" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Clusters</CardTitle>
                    <CardDescription>Backend service clusters</CardDescription>
                  </div>
                  <Button onClick={addCluster} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Cluster
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {clusters.map((cluster) => (
                    <Card key={cluster.name} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                              <Server className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{cluster.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline">{cluster.type}</Badge>
                                <Badge variant="outline">{cluster.hosts.length} hosts</Badge>
                                {cluster.healthChecks && (
                                  <Badge variant="default" className="bg-green-500">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Health Checks
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeCluster(cluster.name)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <Label>Hosts</Label>
                          {cluster.hosts.map((host, idx) => (
                            <div key={idx} className="p-2 border rounded text-sm">
                              <span className="font-mono">{host.address}:{host.port}</span>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm mt-4">
                          {cluster.requests && (
                            <div>
                              <span className="text-muted-foreground">Requests:</span>
                              <span className="ml-2 font-semibold">{cluster.requests.toLocaleString()}</span>
                            </div>
                          )}
                          {cluster.errors && cluster.errors > 0 && (
                            <div>
                              <span className="text-muted-foreground">Errors:</span>
                              <span className="ml-2 font-semibold text-red-500">{cluster.errors}</span>
                            </div>
                          )}
                          {cluster.connectTimeout && (
                            <div>
                              <span className="text-muted-foreground">Timeout:</span>
                              <span className="ml-2 font-semibold">{cluster.connectTimeout}ms</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="listeners" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Listeners</CardTitle>
                <CardDescription>Network listeners and ports</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {listeners.map((listener) => (
                    <Card key={listener.name} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                            <Network className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <CardTitle className="text-lg font-semibold">{listener.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="font-mono">{listener.address}:{listener.port}</Badge>
                              {listener.activeConnections && (
                                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
                                  {listener.activeConnections} connections
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <Label>Filters</Label>
                          <div className="flex flex-wrap gap-2">
                            {listener.filters.map((filter, idx) => (
                              <Badge key={idx} variant="outline">{filter}</Badge>
                            ))}
                          </div>
                        </div>
                        {listener.requests && (
                          <div className="text-sm mt-4">
                            <span className="text-muted-foreground">Requests:</span>
                            <span className="ml-2 font-semibold">{listener.requests.toLocaleString()}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="routes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Routes</CardTitle>
                <CardDescription>Request routing rules</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {routes.map((route) => (
                    <Card key={route.name} className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                            <Globe className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <CardTitle className="text-lg font-semibold">{route.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="font-mono text-xs">{route.match}</Badge>
                              <Badge variant="outline">→ {route.cluster}</Badge>
                              {route.priority !== undefined && (
                                <Badge variant="outline">Priority: {route.priority}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      {route.requests && (
                        <CardContent>
                          <div className="text-sm">
                            <span className="text-muted-foreground">Requests:</span>
                            <span className="ml-2 font-semibold">{route.requests.toLocaleString()}</span>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Envoy Settings</CardTitle>
                <CardDescription>Proxy configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Admin Interface</Label>
                  <Switch 
                    checked={config.enableAdminInterface ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableAdminInterface: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Access Logging</Label>
                  <Switch 
                    checked={config.enableAccessLogging ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableAccessLogging: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Stats</Label>
                  <Switch 
                    checked={config.enableStats ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableStats: checked })}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Admin Port</Label>
                  <Input 
                    type="number" 
                    value={config.adminPort ?? 9901}
                    onChange={(e) => updateConfig({ adminPort: parseInt(e.target.value) || 9901 })}
                    min={1} 
                    max={65535} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Drain Time (seconds)</Label>
                  <Input 
                    type="number" 
                    value={config.drainTime ?? 600}
                    onChange={(e) => updateConfig({ drainTime: parseInt(e.target.value) || 600 })}
                    min={1} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Connections</Label>
                  <Input 
                    type="number" 
                    value={config.maxConnections ?? 1024}
                    onChange={(e) => updateConfig({ maxConnections: parseInt(e.target.value) || 1024 })}
                    min={1} 
                  />
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Prometheus Metrics</Label>
                      <p className="text-xs text-muted-foreground mt-1">Export metrics for Prometheus scraping via /stats/prometheus</p>
                    </div>
                    <Switch 
                      checked={config.metrics?.enabled ?? true}
                      onCheckedChange={(checked) => updateConfig({ 
                        metrics: { 
                          ...config.metrics, 
                          enabled: checked,
                          prometheusPath: config.metrics?.prometheusPath || '/stats/prometheus'
                        } 
                      })}
                    />
                  </div>
                  {config.metrics?.enabled !== false && (
                    <div className="space-y-2">
                      <Label>Prometheus Stats Path</Label>
                      <Input 
                        type="text" 
                        value={config.metrics?.prometheusPath ?? '/stats/prometheus'}
                        onChange={(e) => updateConfig({ 
                          metrics: { 
                            ...config.metrics, 
                            prometheusPath: e.target.value || '/stats/prometheus'
                          } 
                        })}
                        placeholder="/stats/prometheus"
                      />
                      <p className="text-xs text-muted-foreground">
                        Metrics available at: {config.adminPort ?? 9901}{config.metrics?.prometheusPath || '/stats/prometheus'}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}





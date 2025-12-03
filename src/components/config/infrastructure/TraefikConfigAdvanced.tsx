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
  Route,
  Shield,
  Globe,
  CheckCircle,
  AlertCircle,
  Network
} from 'lucide-react';

interface TraefikConfigProps {
  componentId: string;
}

interface Router {
  id: string;
  name: string;
  rule: string;
  service: string;
  entryPoints: string[];
  middlewares?: string[];
  tls?: boolean;
  priority?: number;
  requests?: number;
  responses?: number;
}

interface Service {
  id: string;
  name: string;
  url?: string;
  servers?: Array<{
    url: string;
    weight?: number;
  }>;
  loadBalancer?: 'roundrobin' | 'wrr' | 'drr';
  healthCheck?: {
    enabled: boolean;
    path?: string;
    interval?: number;
  };
}

interface Middleware {
  id: string;
  name: string;
  type: 'auth' | 'rateLimit' | 'headers' | 'redirect' | 'stripPrefix';
  config?: Record<string, any>;
}

interface TraefikConfig {
  routers?: Router[];
  services?: Service[];
  middlewares?: Middleware[];
  entryPoints?: string[];
  totalRequests?: number;
  totalResponses?: number;
  activeRouters?: number;
}

export function TraefikConfigAdvanced({ componentId }: TraefikConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as TraefikConfig;
  const routers = config.routers || [
    {
      id: '1',
      name: 'web-router',
      rule: 'Host(`example.com`)',
      service: 'web-service',
      entryPoints: ['web'],
      tls: true,
      priority: 1,
      requests: 45000,
      responses: 44800,
    },
  ];
  const services = config.services || [
    {
      id: '1',
      name: 'web-service',
      servers: [
        { url: 'http://192.168.1.10:8080', weight: 1 },
        { url: 'http://192.168.1.11:8080', weight: 1 },
      ],
      loadBalancer: 'roundrobin',
      healthCheck: {
        enabled: true,
        path: '/health',
        interval: 10,
      },
    },
  ];
  const middlewares = config.middlewares || [
    {
      id: '1',
      name: 'auth-middleware',
      type: 'auth',
      config: { headerField: 'X-User' },
    },
    {
      id: '2',
      name: 'rate-limit',
      type: 'rateLimit',
      config: { average: 100, burst: 50 },
    },
  ];
  const entryPoints = config.entryPoints || ['web', 'websecure'];
  const totalRequests = config.totalRequests || routers.reduce((sum, r) => sum + (r.requests || 0), 0);
  const totalResponses = config.totalResponses || routers.reduce((sum, r) => sum + (r.responses || 0), 0);
  const activeRouters = config.activeRouters || routers.length;

  const [editingRouterIndex, setEditingRouterIndex] = useState<number | null>(null);
  const [showCreateRouter, setShowCreateRouter] = useState(false);
  const [showCreateService, setShowCreateService] = useState(false);
  const [showCreateMiddleware, setShowCreateMiddleware] = useState(false);

  const updateConfig = (updates: Partial<TraefikConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addRouter = () => {
    const newRouter: Router = {
      id: `router-${Date.now()}`,
      name: 'new-router',
      rule: 'Host(`example.com`)',
      service: services[0]?.name || '',
      entryPoints: ['web'],
      priority: 1,
    };
    updateConfig({ routers: [...routers, newRouter] });
    setShowCreateRouter(false);
  };

  const removeRouter = (id: string) => {
    updateConfig({ routers: routers.filter((r) => r.id !== id) });
  };

  const updateRouter = (id: string, field: string, value: any) => {
    const newRouters = routers.map((r) =>
      r.id === id ? { ...r, [field]: value } : r
    );
    updateConfig({ routers: newRouters });
  };

  const addService = () => {
    const newService: Service = {
      id: `service-${Date.now()}`,
      name: 'new-service',
      servers: [{ url: 'http://localhost:8080', weight: 1 }],
      loadBalancer: 'roundrobin',
    };
    updateConfig({ services: [...services, newService] });
    setShowCreateService(false);
  };

  const removeService = (id: string) => {
    updateConfig({ services: services.filter((s) => s.id !== id) });
  };

  const updateService = (id: string, field: string, value: any) => {
    const newServices = services.map((s) =>
      s.id === id ? { ...s, [field]: value } : s
    );
    updateConfig({ services: newServices });
  };

  const addMiddleware = () => {
    const newMiddleware: Middleware = {
      id: `middleware-${Date.now()}`,
      name: 'new-middleware',
      type: 'headers',
      config: {},
    };
    updateConfig({ middlewares: [...middlewares, newMiddleware] });
    setShowCreateMiddleware(false);
  };

  const removeMiddleware = (id: string) => {
    updateConfig({ middlewares: middlewares.filter((m) => m.id !== id) });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Traefik</p>
            <h2 className="text-2xl font-bold text-foreground">Dynamic Reverse Proxy</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Modern HTTP reverse proxy and load balancer
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Routers</CardTitle>
                <Route className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{activeRouters}</span>
                <span className="text-xs text-muted-foreground">active</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Services</CardTitle>
                <Network className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{services.length}</span>
                <span className="text-xs text-muted-foreground">configured</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Requests</CardTitle>
                <Activity className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{totalRequests.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Responses</CardTitle>
                <CheckCircle className="h-4 w-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{totalResponses.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="routers" className="space-y-4">
          <TabsList>
            <TabsTrigger value="routers">
              <Route className="h-4 w-4 mr-2" />
              Routers ({routers.length})
            </TabsTrigger>
            <TabsTrigger value="services">
              <Network className="h-4 w-4 mr-2" />
              Services ({services.length})
            </TabsTrigger>
            <TabsTrigger value="middlewares">
              <Shield className="h-4 w-4 mr-2" />
              Middlewares ({middlewares.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="routers" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Routers</CardTitle>
                    <CardDescription>Configure routing rules</CardDescription>
                  </div>
                  <Button onClick={addRouter} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Router
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {routers.map((router) => (
                    <Card key={router.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                              <Route className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{router.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="font-mono text-xs">{router.rule}</Badge>
                                {router.tls && (
                                  <Badge variant="default" className="bg-green-500">
                                    <Shield className="h-3 w-3 mr-1" />
                                    TLS
                                  </Badge>
                                )}
                                <Badge variant="outline">Priority: {router.priority || 1}</Badge>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRouter(router.id)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Router Name</Label>
                            <Input
                              value={router.name}
                              onChange={(e) => updateRouter(router.id, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Service</Label>
                            <Select
                              value={router.service}
                              onValueChange={(value) => updateRouter(router.id, 'service', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {services.map((s) => (
                                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 col-span-2">
                            <Label>Rule</Label>
                            <Input
                              value={router.rule}
                              onChange={(e) => updateRouter(router.id, 'rule', e.target.value)}
                              placeholder="Host(`example.com`)"
                              className="font-mono text-sm"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Enable TLS</Label>
                            <Switch
                              checked={router.tls ?? false}
                              onCheckedChange={(checked) => updateRouter(router.id, 'tls', checked)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Priority</Label>
                            <Input
                              type="number"
                              value={router.priority || 1}
                              onChange={(e) => updateRouter(router.id, 'priority', Number(e.target.value))}
                              min={1}
                            />
                          </div>
                        </div>
                        {router.requests !== undefined && (
                          <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t">
                            <div>
                              <span className="text-muted-foreground">Requests:</span>
                              <span className="ml-2 font-semibold">{router.requests.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Responses:</span>
                              <span className="ml-2 font-semibold">{router.responses?.toLocaleString() || 0}</span>
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

          <TabsContent value="services" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Services</CardTitle>
                    <CardDescription>Configure backend services</CardDescription>
                  </div>
                  <Button onClick={addService} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Service
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {services.map((service) => (
                    <Card key={service.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                              <Network className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{service.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline">{service.loadBalancer || 'roundrobin'}</Badge>
                                {service.servers && (
                                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20">
                                    {service.servers.length} servers
                                  </Badge>
                                )}
                                {service.healthCheck?.enabled && (
                                  <Badge variant="default" className="bg-green-500">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Health Check
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeService(service.id)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Service Name</Label>
                            <Input
                              value={service.name}
                              onChange={(e) => updateService(service.id, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Load Balancer</Label>
                            <Select
                              value={service.loadBalancer || 'roundrobin'}
                              onValueChange={(value: 'roundrobin' | 'wrr' | 'drr') => updateService(service.id, 'loadBalancer', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="roundrobin">Round Robin</SelectItem>
                                <SelectItem value="wrr">Weighted Round Robin</SelectItem>
                                <SelectItem value="drr">Dynamic Round Robin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {service.servers && service.servers.length > 0 && (
                          <div className="space-y-2">
                            <Label>Servers</Label>
                            <div className="space-y-2">
                              {service.servers.map((server, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <Input
                                    value={server.url}
                                    onChange={(e) => {
                                      const newServers = [...service.servers!];
                                      newServers[idx] = { ...newServers[idx], url: e.target.value };
                                      updateService(service.id, 'servers', newServers);
                                    }}
                                    className="flex-1"
                                  />
                                  <Input
                                    type="number"
                                    value={server.weight || 1}
                                    onChange={(e) => {
                                      const newServers = [...service.servers!];
                                      newServers[idx] = { ...newServers[idx], weight: Number(e.target.value) };
                                      updateService(service.id, 'servers', newServers);
                                    }}
                                    className="w-20"
                                    min={1}
                                  />
                                </div>
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

          <TabsContent value="middlewares" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Middlewares</CardTitle>
                    <CardDescription>Configure request/response middleware</CardDescription>
                  </div>
                  <Button onClick={addMiddleware} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Middleware
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {middlewares.map((middleware) => (
                    <Card key={middleware.id} className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow bg-gradient-to-r from-purple-50/50 to-transparent dark:from-purple-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                              <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{middleware.name}</CardTitle>
                              <Badge variant="outline" className="mt-2">{middleware.type}</Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMiddleware(middleware.id)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Traefik Settings</CardTitle>
                <CardDescription>Global configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Entry Points</Label>
                  <div className="flex flex-wrap gap-2">
                    {entryPoints.map((ep, idx) => (
                      <Badge key={idx} variant="outline">{ep}</Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Enable Dashboard</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable API</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Auto Discover Services</Label>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


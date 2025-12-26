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
import { useState, useEffect } from 'react';
import { useEmulationStore } from '@/store/useEmulationStore';
import { emulationEngine } from '@/core/EmulationEngine';
import { showSuccess, showError } from '@/utils/toast';
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
  Network,
  Edit,
  X
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
  type: 'auth' | 'rateLimit' | 'headers' | 'redirect' | 'stripPrefix' | 'addPrefix' | 
        'compress' | 'retry' | 'circuitBreaker' | 'ipAllowList' | 'ipWhiteList' |
        'basicAuth' | 'digestAuth' | 'forwardAuth' | 'chain';
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
  enableDashboard?: boolean;
  enableAPI?: boolean;
  autoDiscoverServices?: boolean;
}

export function TraefikConfigAdvanced({ componentId }: TraefikConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const componentMetrics = useEmulationStore((state) => 
    state.componentMetrics.get(componentId)
  );
  
  const config = (node.data.config as any) || {} as TraefikConfig;
  const routers = config.routers || [];
  const services = config.services || [];
  const middlewares = config.middlewares || [];
  const entryPoints = config.entryPoints || ['web', 'websecure'];
  
  // Get metrics from emulation engine
  const traefikEngine = emulationEngine.getTraefikEmulationEngine(componentId);
  const stats = traefikEngine?.getStats();
  const totalRequests = stats?.totalRequests || config.totalRequests || 0;
  const totalResponses = stats?.totalResponses || config.totalResponses || 0;
  const activeRouters = stats?.activeRouters || config.activeRouters || routers.length;


  const updateConfig = (updates: Partial<TraefikConfig>) => {
    const newConfig = { ...config, ...updates };
    updateNode(componentId, {
      data: {
        ...node.data,
        config: newConfig,
      },
    });
    
    // Update emulation engine if it exists
    if (traefikEngine) {
      const updatedNode = { ...node, data: { ...node.data, config: newConfig } };
      traefikEngine.updateConfig(updatedNode);
    }
  };

  const addRouter = () => {
    const newRouter: Router = {
      id: `router-${Date.now()}`,
      name: `router-${routers.length + 1}`,
      rule: 'Host(`example.com`)',
      service: services[0]?.name || '',
      entryPoints: ['web'],
      priority: 1,
    };
    updateConfig({ routers: [...routers, newRouter] });
    showSuccess('Router created successfully');
  };

  const removeRouter = (id: string) => {
    updateConfig({ routers: routers.filter((r) => r.id !== id) });
    showSuccess('Router removed successfully');
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
      name: `service-${services.length + 1}`,
      servers: [{ url: 'http://localhost:8080', weight: 1 }],
      loadBalancer: 'roundrobin',
    };
    updateConfig({ services: [...services, newService] });
    showSuccess('Service created successfully');
  };
  
  const addServerToService = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    
    const newServers = [...(service.servers || []), { url: 'http://localhost:8080', weight: 1 }];
    updateService(serviceId, 'servers', newServers);
    showSuccess('Server added successfully');
  };
  
  const removeServerFromService = (serviceId: string, serverIndex: number) => {
    const service = services.find(s => s.id === serviceId);
    if (!service || !service.servers) return;
    
    const newServers = service.servers.filter((_, idx) => idx !== serverIndex);
    updateService(serviceId, 'servers', newServers);
    showSuccess('Server removed successfully');
  };

  const removeService = (id: string) => {
    // Check if service is used by any router
    const usedBy = routers.filter(r => r.service === services.find(s => s.id === id)?.name);
    if (usedBy.length > 0) {
      showError(`Cannot remove service: used by ${usedBy.length} router(s)`);
      return;
    }
    updateConfig({ services: services.filter((s) => s.id !== id) });
    showSuccess('Service removed successfully');
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
      name: `middleware-${middlewares.length + 1}`,
      type: 'headers',
      config: {},
    };
    updateConfig({ middlewares: [...middlewares, newMiddleware] });
    showSuccess('Middleware created successfully');
  };
  
  const updateMiddleware = (id: string, field: string, value: any) => {
    const newMiddlewares = middlewares.map((m) =>
      m.id === id ? { ...m, [field]: value } : m
    );
    updateConfig({ middlewares: newMiddlewares });
  };
  
  const updateMiddlewareConfig = (id: string, configKey: string, value: any) => {
    const middleware = middlewares.find(m => m.id === id);
    if (!middleware) return;
    
    const newConfig = { ...(middleware.config || {}), [configKey]: value };
    updateMiddleware(id, 'config', newConfig);
  };

  const removeMiddleware = (id: string) => {
    // Check if middleware is used by any router
    const usedBy = routers.filter(r => r.middlewares?.includes(middlewares.find(m => m.id === id)?.name || ''));
    if (usedBy.length > 0) {
      showError(`Cannot remove middleware: used by ${usedBy.length} router(s)`);
      return;
    }
    updateConfig({ middlewares: middlewares.filter((m) => m.id !== id) });
    showSuccess('Middleware removed successfully');
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
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                if (traefikEngine) {
                  const updatedNode = nodes.find(n => n.id === componentId);
                  if (updatedNode) {
                    traefikEngine.updateConfig(updatedNode);
                    showSuccess('Configuration refreshed');
                  }
                }
              }}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-card">
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
          <Card className="border-l-4 border-l-green-500 bg-card">
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
          <Card className="border-l-4 border-l-purple-500 bg-card">
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
          <Card className="border-l-4 border-l-cyan-500 bg-card">
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
                    <Card key={router.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
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
                          <div className="space-y-2 col-span-2">
                            <Label>Entry Points</Label>
                            <div className="flex flex-wrap gap-2">
                              {['web', 'websecure'].map((ep) => (
                                <Badge
                                  key={ep}
                                  variant={router.entryPoints.includes(ep) ? 'default' : 'outline'}
                                  className="cursor-pointer"
                                  onClick={() => {
                                    const current = router.entryPoints || [];
                                    const updated = current.includes(ep)
                                      ? current.filter(e => e !== ep)
                                      : [...current, ep];
                                    updateRouter(router.id, 'entryPoints', updated);
                                  }}
                                >
                                  {ep}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2 col-span-2">
                            <Label>Middlewares</Label>
                            <div className="flex flex-wrap gap-2">
                              {middlewares.map((mw) => (
                                <Badge
                                  key={mw.id}
                                  variant={(router.middlewares || []).includes(mw.name) ? 'default' : 'outline'}
                                  className="cursor-pointer"
                                  onClick={() => {
                                    const current = router.middlewares || [];
                                    const updated = current.includes(mw.name)
                                      ? current.filter(m => m !== mw.name)
                                      : [...current, mw.name];
                                    updateRouter(router.id, 'middlewares', updated);
                                  }}
                                >
                                  {mw.name}
                                </Badge>
                              ))}
                              {middlewares.length === 0 && (
                                <span className="text-sm text-muted-foreground">No middlewares available</span>
                              )}
                            </div>
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
                    <Card key={service.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-card">
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
                                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
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
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Servers</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addServerToService(service.id)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Server
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {(service.servers && service.servers.length > 0) ? (
                              service.servers.map((server, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <Input
                                    value={server.url}
                                    onChange={(e) => {
                                      const newServers = [...service.servers!];
                                      newServers[idx] = { ...newServers[idx], url: e.target.value };
                                      updateService(service.id, 'servers', newServers);
                                    }}
                                    className="flex-1"
                                    placeholder="http://localhost:8080"
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
                                    placeholder="Weight"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeServerFromService(service.id, idx)}
                                    className="hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-muted-foreground py-2">
                                No servers configured. Click "Add Server" to add one.
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Health Check</Label>
                            <Switch
                              checked={service.healthCheck?.enabled ?? false}
                              onCheckedChange={(checked) => {
                                updateService(service.id, 'healthCheck', {
                                  enabled: checked,
                                  path: service.healthCheck?.path || '/health',
                                  interval: service.healthCheck?.interval || 10,
                                });
                              }}
                            />
                          </div>
                          {service.healthCheck?.enabled && (
                            <div className="grid grid-cols-2 gap-4 pl-6">
                              <div className="space-y-2">
                                <Label>Path</Label>
                                <Input
                                  value={service.healthCheck.path || '/health'}
                                  onChange={(e) => {
                                    updateService(service.id, 'healthCheck', {
                                      ...service.healthCheck,
                                      path: e.target.value,
                                    });
                                  }}
                                  placeholder="/health"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Interval (seconds)</Label>
                                <Input
                                  type="number"
                                  value={service.healthCheck.interval || 10}
                                  onChange={(e) => {
                                    updateService(service.id, 'healthCheck', {
                                      ...service.healthCheck,
                                      interval: Number(e.target.value),
                                    });
                                  }}
                                  min={1}
                                />
                              </div>
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
                    <Card key={middleware.id} className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                              <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Input
                                  value={middleware.name}
                                  onChange={(e) => updateMiddleware(middleware.id, 'name', e.target.value)}
                                  className="font-semibold border-0 p-0 h-auto"
                                />
                                <Select
                                  value={middleware.type}
                                  onValueChange={(value: Middleware['type']) => updateMiddleware(middleware.id, 'type', value)}
                                >
                                  <SelectTrigger className="w-40">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="headers">Headers</SelectItem>
                                    <SelectItem value="rateLimit">Rate Limit</SelectItem>
                                    <SelectItem value="auth">Auth</SelectItem>
                                    <SelectItem value="basicAuth">Basic Auth</SelectItem>
                                    <SelectItem value="digestAuth">Digest Auth</SelectItem>
                                    <SelectItem value="forwardAuth">Forward Auth</SelectItem>
                                    <SelectItem value="redirect">Redirect</SelectItem>
                                    <SelectItem value="stripPrefix">Strip Prefix</SelectItem>
                                    <SelectItem value="addPrefix">Add Prefix</SelectItem>
                                    <SelectItem value="compress">Compress</SelectItem>
                                    <SelectItem value="retry">Retry</SelectItem>
                                    <SelectItem value="circuitBreaker">Circuit Breaker</SelectItem>
                                    <SelectItem value="ipAllowList">IP Allow List</SelectItem>
                                    <SelectItem value="ipWhiteList">IP White List</SelectItem>
                                    <SelectItem value="chain">Chain</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
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
                      <CardContent className="space-y-4">
                        {/* Middleware configuration based on type */}
                        {middleware.type === 'rateLimit' && (
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Average</Label>
                              <Input
                                type="number"
                                value={middleware.config?.average || 100}
                                onChange={(e) => updateMiddlewareConfig(middleware.id, 'average', Number(e.target.value))}
                                min={1}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Burst</Label>
                              <Input
                                type="number"
                                value={middleware.config?.burst || 50}
                                onChange={(e) => updateMiddlewareConfig(middleware.id, 'burst', Number(e.target.value))}
                                min={1}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Period</Label>
                              <Input
                                value={middleware.config?.period || '1s'}
                                onChange={(e) => updateMiddlewareConfig(middleware.id, 'period', e.target.value)}
                                placeholder="1s"
                              />
                            </div>
                          </div>
                        )}
                        {middleware.type === 'auth' && (
                          <div className="space-y-2">
                            <Label>Header Field</Label>
                            <Input
                              value={middleware.config?.headerField || 'X-User'}
                              onChange={(e) => updateMiddlewareConfig(middleware.id, 'headerField', e.target.value)}
                              placeholder="X-User"
                            />
                          </div>
                        )}
                        {middleware.type === 'redirect' && (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Scheme</Label>
                              <Input
                                value={middleware.config?.scheme || 'https'}
                                onChange={(e) => updateMiddlewareConfig(middleware.id, 'scheme', e.target.value)}
                                placeholder="https"
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label>Permanent</Label>
                              <Switch
                                checked={middleware.config?.permanent ?? false}
                                onCheckedChange={(checked) => updateMiddlewareConfig(middleware.id, 'permanent', checked)}
                              />
                            </div>
                          </div>
                        )}
                        {(middleware.type === 'stripPrefix' || middleware.type === 'addPrefix') && (
                          <div className="space-y-2">
                            <Label>Prefix</Label>
                            <Input
                              value={middleware.config?.prefix || ''}
                              onChange={(e) => updateMiddlewareConfig(middleware.id, 'prefix', e.target.value)}
                              placeholder="/api"
                            />
                          </div>
                        )}
                        {middleware.type === 'ipAllowList' || middleware.type === 'ipWhiteList' ? (
                          <div className="space-y-2">
                            <Label>Source Ranges (one per line)</Label>
                            <textarea
                              className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={Array.isArray(middleware.config?.sourceRange) ? middleware.config.sourceRange.join('\n') : ''}
                              onChange={(e) => {
                                const ranges = e.target.value.split('\n').filter(line => line.trim());
                                updateMiddlewareConfig(middleware.id, 'sourceRange', ranges);
                              }}
                              placeholder="192.168.1.0/24&#10;10.0.0.0/8"
                            />
                          </div>
                        ) : null}
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
                <CardTitle>Traefik Settings</CardTitle>
                <CardDescription>Global configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Entry Points</Label>
                    <div className="flex gap-2">
                      {['web', 'websecure'].map((ep) => (
                        <Badge
                          key={ep}
                          variant={entryPoints.includes(ep) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            const updated = entryPoints.includes(ep)
                              ? entryPoints.filter(e => e !== ep)
                              : [...entryPoints, ep];
                            updateConfig({ entryPoints: updated });
                          }}
                        >
                          {ep}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Click on entry points to toggle them. 'web' is HTTP (port 80), 'websecure' is HTTPS (port 443).
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Global Settings</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <Label>Max Connections</Label>
                      <Input
                        type="number"
                        value={config.maxConnections || 10000}
                        onChange={(e) => updateConfig({ maxConnections: Number(e.target.value) })}
                        className="w-32"
                        min={1}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Response Timeout (ms)</Label>
                      <Input
                        type="number"
                        value={config.responseTimeout || 30000}
                        onChange={(e) => updateConfig({ responseTimeout: Number(e.target.value) })}
                        className="w-32"
                        min={1000}
                      />
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Enable Dashboard</Label>
                  <Switch 
                    checked={config.enableDashboard ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableDashboard: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable API</Label>
                  <Switch 
                    checked={config.enableAPI ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableAPI: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Auto Discover Services</Label>
                  <Switch 
                    checked={config.autoDiscoverServices ?? true}
                    onCheckedChange={(checked) => updateConfig({ autoDiscoverServices: checked })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';
import { 
  Network, 
  Route as RouteIcon, 
  Settings, 
  Activity,
  Shield,
  Zap,
  Plus,
  Trash2,
  ArrowRightLeft,
  Lock,
  Users,
  Server,
  Gauge,
  Edit
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface KongConfigProps {
  componentId: string;
}

interface Service {
  id: string;
  name: string;
  url: string;
  routes: number;
  enabled: boolean;
  upstream?: string;
}

interface KongRoute {
  id: string;
  path: string;
  method: string;
  service: string;
  stripPath: boolean;
  protocols?: string[];
}

interface Upstream {
  id: string;
  name: string;
  algorithm?: 'round-robin' | 'consistent-hashing' | 'least-connections';
  healthchecks?: {
    active?: boolean;
    passive?: boolean;
  };
  targets?: UpstreamTarget[];
}

interface UpstreamTarget {
  target: string;
  weight?: number;
  health?: 'healthy' | 'unhealthy' | 'draining';
}

interface Consumer {
  id: string;
  username: string;
  customId?: string;
  tags?: string[];
  credentials?: ConsumerCredential[];
}

interface ConsumerCredential {
  type: 'key-auth' | 'jwt' | 'oauth2' | 'basic-auth';
  key?: string;
  secret?: string;
  algorithm?: string;
  rsaPublicKey?: string;
}

interface Plugin {
  id: string;
  name: string;
  enabled: boolean;
  service?: string;
  route?: string;
  consumer?: string;
  config?: Record<string, any>;
}

interface KongConfig {
  adminUrl?: string;
  serviceName?: string;
  upstreamUrl?: string;
  routePaths?: string[];
  stripPath?: boolean;
  authPlugin?: string;
  rateLimitPerMinute?: number;
  enableLogging?: boolean;
  loggingTarget?: string;
  services?: Service[];
  routes?: KongRoute[];
  upstreams?: Upstream[];
  consumers?: Consumer[];
  plugins?: Plugin[];
  requestsPerSecond?: number;
}

export function KongConfigAdvanced({ componentId }: KongConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as KongConfig;
  const adminUrl = config.adminUrl || 'http://kong:8001';
  const serviceName = config.serviceName || 'core-service';
  const upstreamUrl = config.upstreamUrl || 'http://core:8080';
  const routePaths = config.routePaths || ['/api', '/v1'];
  const stripPath = config.stripPath ?? true;
  const authPlugin = config.authPlugin || 'key-auth';
  const rateLimitPerMinute = config.rateLimitPerMinute || 1000;
  const enableLogging = config.enableLogging ?? true;
  const loggingTarget = config.loggingTarget || 'loki';
  const services = config.services || [];
  const routes = config.routes || [];
  const upstreams = config.upstreams || [];
  const consumers = config.consumers || [];
  const plugins = config.plugins || [
    {
      id: '1',
      name: 'rate-limiting',
      enabled: true,
      config: { minute: 1000, hour: 10000 }
    },
    {
      id: '2',
      name: 'key-auth',
      enabled: true,
      config: { key_names: ['apikey'] }
    },
    {
      id: '3',
      name: 'cors',
      enabled: true,
      config: { origins: ['*'], methods: ['GET', 'POST', 'PUT', 'DELETE'] }
    }
  ];
  const requestsPerSecond = config.requestsPerSecond || 450;

  const [showCreateUpstream, setShowCreateUpstream] = useState(false);
  const [showCreateConsumer, setShowCreateConsumer] = useState(false);
  const [showCreatePlugin, setShowCreatePlugin] = useState(false);
  const [editingUpstreamIndex, setEditingUpstreamIndex] = useState<number | null>(null);
  const [editingConsumerIndex, setEditingConsumerIndex] = useState<number | null>(null);
  const [editingPluginIndex, setEditingPluginIndex] = useState<number | null>(null);

  const updateConfig = (updates: Partial<KongConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addService = () => {
    updateConfig({
      services: [...services, { id: String(services.length + 1), name: 'new-service', url: 'http://service:8080', routes: 0, enabled: true }],
    });
  };

  const removeService = (index: number) => {
    updateConfig({ services: services.filter((_, i) => i !== index) });
  };

  const addRoute = () => {
    updateConfig({
      routes: [...routes, { id: String(routes.length + 1), path: '/new-path', method: 'GET', service: services[0]?.name || '', stripPath: true }],
    });
  };

  const removeRoute = (index: number) => {
    updateConfig({ routes: routes.filter((_, i) => i !== index) });
  };

  const updateRoute = (index: number, field: string, value: string | boolean) => {
    const newRoutes = [...routes];
    newRoutes[index] = { ...newRoutes[index], [field]: value };
    updateConfig({ routes: newRoutes });
  };

  const addUpstream = () => {
    const newUpstream: Upstream = {
      id: String(upstreams.length + 1),
      name: 'new-upstream',
      algorithm: 'round-robin',
      healthchecks: { active: true, passive: true },
      targets: [{ target: 'server:8080', weight: 100, health: 'healthy' }]
    };
    updateConfig({ upstreams: [...upstreams, newUpstream] });
    setShowCreateUpstream(false);
  };

  const removeUpstream = (index: number) => {
    updateConfig({ upstreams: upstreams.filter((_, i) => i !== index) });
  };

  const updateUpstream = (index: number, field: keyof Upstream, value: any) => {
    const updated = [...upstreams];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ upstreams: updated });
  };

  const addUpstreamTarget = (upstreamIndex: number) => {
    const updated = [...upstreams];
    if (!updated[upstreamIndex].targets) {
      updated[upstreamIndex].targets = [];
    }
    updated[upstreamIndex].targets = [
      ...updated[upstreamIndex].targets,
      { target: 'server:8080', weight: 100, health: 'healthy' }
    ];
    updateConfig({ upstreams: updated });
  };

  const removeUpstreamTarget = (upstreamIndex: number, targetIndex: number) => {
    const updated = [...upstreams];
    updated[upstreamIndex].targets = updated[upstreamIndex].targets?.filter((_, i) => i !== targetIndex);
    updateConfig({ upstreams: updated });
  };

  const addConsumer = () => {
    const newConsumer: Consumer = {
      id: String(consumers.length + 1),
      username: 'new-consumer',
      credentials: []
    };
    updateConfig({ consumers: [...consumers, newConsumer] });
    setShowCreateConsumer(false);
  };

  const removeConsumer = (index: number) => {
    updateConfig({ consumers: consumers.filter((_, i) => i !== index) });
  };

  const updateConsumer = (index: number, field: keyof Consumer, value: any) => {
    const updated = [...consumers];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ consumers: updated });
  };

  const addConsumerCredential = (consumerIndex: number, type: ConsumerCredential['type']) => {
    const updated = [...consumers];
    if (!updated[consumerIndex].credentials) {
      updated[consumerIndex].credentials = [];
    }
    const newCred: ConsumerCredential = {
      type,
      key: type === 'key-auth' ? `key-${Date.now()}` : undefined,
      secret: type === 'jwt' ? 'secret' : undefined
    };
    updated[consumerIndex].credentials = [...updated[consumerIndex].credentials, newCred];
    updateConfig({ consumers: updated });
  };

  const removeConsumerCredential = (consumerIndex: number, credIndex: number) => {
    const updated = [...consumers];
    updated[consumerIndex].credentials = updated[consumerIndex].credentials?.filter((_, i) => i !== credIndex);
    updateConfig({ consumers: updated });
  };

  const addPlugin = () => {
    const newPlugin: Plugin = {
      id: String(plugins.length + 1),
      name: 'rate-limiting',
      enabled: true,
      config: {}
    };
    updateConfig({ plugins: [...plugins, newPlugin] });
    setShowCreatePlugin(false);
  };

  const removePlugin = (index: number) => {
    updateConfig({ plugins: plugins.filter((_, i) => i !== index) });
  };

  const updatePlugin = (index: number, field: keyof Plugin, value: any) => {
    const updated = [...plugins];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ plugins: updated });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Network className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Kong API Gateway</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Service Mesh & API Gateway
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
              Admin API
            </Button>
          </div>
        </div>

        <Separator />


        {/* Main Configuration Tabs */}
        <Tabs defaultValue="services" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="services" className="gap-2">
              <Network className="h-4 w-4" />
              Services
            </TabsTrigger>
            <TabsTrigger value="upstreams" className="gap-2">
              <Server className="h-4 w-4" />
              Upstreams
            </TabsTrigger>
            <TabsTrigger value="routes" className="gap-2">
              <RouteIcon className="h-4 w-4" />
              Routes
            </TabsTrigger>
            <TabsTrigger value="consumers" className="gap-2">
              <Users className="h-4 w-4" />
              Consumers
            </TabsTrigger>
            <TabsTrigger value="plugins" className="gap-2">
              <Zap className="h-4 w-4" />
              Plugins
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Services Tab */}
          <TabsContent value="services" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Services</CardTitle>
                    <CardDescription>Upstream services managed by Kong</CardDescription>
                  </div>
                  <Button size="sm" onClick={addService} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Service
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {services.map((service, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-primary/10">
                              <Network className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{service.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {service.url} • {service.routes} routes
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {service.enabled ? (
                              <Badge variant="default" className="bg-green-500">Enabled</Badge>
                            ) : (
                              <Badge variant="secondary">Disabled</Badge>
                            )}
                            {services.length > 1 && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeService(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Routes Tab */}
          <TabsContent value="routes" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Routes</CardTitle>
                    <CardDescription>API route configuration</CardDescription>
                  </div>
                  <Button size="sm" onClick={addRoute} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Route
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {routes.map((route, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-primary/10">
                              <RouteIcon className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{route.path}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {route.method} → {route.service}
                              </CardDescription>
                            </div>
                          </div>
                          {routes.length > 1 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeRoute(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Path</Label>
                            <Input
                              value={route.path}
                              onChange={(e) => updateRoute(index, 'path', e.target.value)}
                              placeholder="/api"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Method</Label>
                            <Input
                              value={route.method}
                              onChange={(e) => updateRoute(index, 'method', e.target.value)}
                              placeholder="GET"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>Strip Path</Label>
                          <Switch
                            checked={route.stripPath}
                            onCheckedChange={(checked) => updateRoute(index, 'stripPath', checked)}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Upstreams Tab */}
          <TabsContent value="upstreams" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Upstreams</CardTitle>
                  <CardDescription>Load balancing upstream targets</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowCreateUpstream(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Upstream
                </Button>
              </CardHeader>
              {showCreateUpstream && (
                <CardContent className="border-b pb-4 mb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Upstream Name</Label>
                      <Input placeholder="backend-upstream" />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addUpstream}>Create Upstream</Button>
                      <Button variant="outline" onClick={() => setShowCreateUpstream(false)}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-4">
                {upstreams.map((upstream, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold font-mono">{upstream.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {upstream.targets?.length || 0} target(s) • Algorithm: {upstream.algorithm || 'round-robin'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingUpstreamIndex(editingUpstreamIndex === index ? null : index)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          {editingUpstreamIndex === index ? 'Hide' : 'Edit'}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeUpstream(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {editingUpstreamIndex === index && (
                      <div className="space-y-4 pt-3 border-t">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Upstream Name</Label>
                            <Input
                              value={upstream.name}
                              onChange={(e) => updateUpstream(index, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Algorithm</Label>
                            <Select
                              value={upstream.algorithm || 'round-robin'}
                              onValueChange={(value) => updateUpstream(index, 'algorithm', value as any)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="round-robin">Round Robin</SelectItem>
                                <SelectItem value="consistent-hashing">Consistent Hashing</SelectItem>
                                <SelectItem value="least-connections">Least Connections</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Targets</Label>
                            <Button variant="outline" size="sm" onClick={() => addUpstreamTarget(index)}>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Target
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {upstream.targets?.map((target, targetIndex) => (
                              <div key={targetIndex} className="p-3 border rounded bg-muted/50 flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                  <span className="font-mono text-sm">{target.target}</span>
                                  <Badge variant={target.health === 'healthy' ? 'default' : 'destructive'}>
                                    {target.health || 'healthy'}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">Weight: {target.weight || 100}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeUpstreamTarget(index, targetIndex)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Consumers Tab */}
          <TabsContent value="consumers" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Consumers</CardTitle>
                  <CardDescription>API consumers and authentication credentials</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowCreateConsumer(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Consumer
                </Button>
              </CardHeader>
              {showCreateConsumer && (
                <CardContent className="border-b pb-4 mb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input placeholder="new-consumer" />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addConsumer}>Create Consumer</Button>
                      <Button variant="outline" onClick={() => setShowCreateConsumer(false)}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-4">
                {consumers.map((consumer, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold">{consumer.username}</div>
                        {consumer.customId && (
                          <div className="text-sm text-muted-foreground">ID: {consumer.customId}</div>
                        )}
                        {consumer.credentials && consumer.credentials.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {consumer.credentials.length} credential(s)
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingConsumerIndex(editingConsumerIndex === index ? null : index)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          {editingConsumerIndex === index ? 'Hide' : 'Edit'}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeConsumer(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {editingConsumerIndex === index && (
                      <div className="space-y-4 pt-3 border-t">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Username</Label>
                            <Input
                              value={consumer.username}
                              onChange={(e) => updateConsumer(index, 'username', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Custom ID</Label>
                            <Input
                              value={consumer.customId || ''}
                              onChange={(e) => updateConsumer(index, 'customId', e.target.value)}
                              placeholder="custom-id"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Credentials</Label>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => addConsumerCredential(index, 'key-auth')}>
                                <Plus className="h-4 w-4 mr-2" />
                                Key Auth
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => addConsumerCredential(index, 'jwt')}>
                                <Plus className="h-4 w-4 mr-2" />
                                JWT
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => addConsumerCredential(index, 'oauth2')}>
                                <Plus className="h-4 w-4 mr-2" />
                                OAuth2
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {consumer.credentials?.map((cred, credIndex) => (
                              <div key={credIndex} className="p-3 border rounded bg-muted/50 space-y-2">
                                <div className="flex items-center justify-between">
                                  <Badge>{cred.type}</Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeConsumerCredential(index, credIndex)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                {cred.key && (
                                  <div className="space-y-1">
                                    <Label className="text-xs">Key</Label>
                                    <Input
                                      className="font-mono text-xs"
                                      value={cred.key}
                                      readOnly
                                    />
                                  </div>
                                )}
                                {cred.secret && (
                                  <div className="space-y-1">
                                    <Label className="text-xs">Secret</Label>
                                    <Input
                                      className="font-mono text-xs"
                                      type="password"
                                      value={cred.secret}
                                      readOnly
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plugins Tab */}
          <TabsContent value="plugins" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Plugins</CardTitle>
                  <CardDescription>Configure plugins for services, routes, and consumers</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowCreatePlugin(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Plugin
                </Button>
              </CardHeader>
              {showCreatePlugin && (
                <CardContent className="border-b pb-4 mb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Plugin Name</Label>
                      <Select defaultValue="rate-limiting">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rate-limiting">Rate Limiting</SelectItem>
                          <SelectItem value="key-auth">Key Auth</SelectItem>
                          <SelectItem value="jwt">JWT</SelectItem>
                          <SelectItem value="cors">CORS</SelectItem>
                          <SelectItem value="request-transformer">Request Transformer</SelectItem>
                          <SelectItem value="response-transformer">Response Transformer</SelectItem>
                          <SelectItem value="ip-restriction">IP Restriction</SelectItem>
                          <SelectItem value="file-log">File Log</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addPlugin}>Add Plugin</Button>
                      <Button variant="outline" onClick={() => setShowCreatePlugin(false)}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-3">
                {plugins.map((plugin, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold">{plugin.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {plugin.service && `Service: ${plugin.service}`}
                          {plugin.route && `Route: ${plugin.route}`}
                          {plugin.consumer && `Consumer: ${plugin.consumer}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={plugin.enabled}
                          onCheckedChange={(checked) => updatePlugin(index, 'enabled', checked)}
                        />
                        <Button variant="ghost" size="icon" onClick={() => removePlugin(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingPluginIndex(editingPluginIndex === index ? null : index)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      {editingPluginIndex === index ? 'Hide Config' : 'Edit Config'}
                    </Button>
                    {editingPluginIndex === index && (
                      <div className="space-y-2 pt-2 border-t">
                        <Label>Configuration (JSON)</Label>
                        <Textarea
                          className="font-mono text-xs"
                          rows={6}
                          value={JSON.stringify(plugin.config || {}, null, 2)}
                          onChange={(e) => {
                            try {
                              const parsed = JSON.parse(e.target.value);
                              updatePlugin(index, 'config', parsed);
                            } catch {}
                          }}
                          placeholder='{"minute": 1000, "hour": 10000}'
                        />
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Service & Upstream</CardTitle>
                <CardDescription>Default service configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="service-name">Service Name</Label>
                  <Input
                    id="service-name"
                    value={serviceName}
                    onChange={(e) => updateConfig({ serviceName: e.target.value })}
                    placeholder="core-service"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upstream-url">Upstream URL</Label>
                  <Input
                    id="upstream-url"
                    value={upstreamUrl}
                    onChange={(e) => updateConfig({ upstreamUrl: e.target.value })}
                    placeholder="http://service:port"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-url">Admin API URL</Label>
                  <Input
                    id="admin-url"
                    value={adminUrl}
                    onChange={(e) => updateConfig({ adminUrl: e.target.value })}
                    placeholder="http://kong:8001"
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


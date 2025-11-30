import { useState } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Route, Shield, Settings, Activity, Server } from 'lucide-react';
import { CanvasNode } from '@/types';

interface Route {
  id: string;
  path: string;
  methods: string[];
  stripPath: boolean;
  preserveHost: boolean;
}

interface Plugin {
  id: string;
  name: string;
  enabled: boolean;
  config: Record<string, any>;
}

interface Service {
  id: string;
  name: string;
  url: string;
  protocol: 'http' | 'https';
  host: string;
  port: number;
  path: string;
  connectTimeout: number;
  writeTimeout: number;
  readTimeout: number;
  routes: Route[];
  plugins: Plugin[];
}

interface KongConfig {
  adminUrl?: string;
  services?: Service[];
}

export function KongConfig({ componentId }: { componentId: string }) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;
  const [activeTab, setActiveTab] = useState('services');

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as KongConfig;
  const services = config.services || [];

  const updateConfig = (updates: Partial<KongConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addService = () => {
    const newService: Service = {
      id: `service-${Date.now()}`,
      name: 'New Service',
      url: 'http://localhost:8080',
      protocol: 'http',
      host: 'localhost',
      port: 8080,
      path: '/',
      connectTimeout: 60000,
      writeTimeout: 60000,
      readTimeout: 60000,
      routes: [],
      plugins: [],
    };
    updateConfig({ services: [...services, newService] });
  };

  const updateService = (index: number, updates: Partial<Service>) => {
    const updated = [...services];
    updated[index] = { ...updated[index], ...updates };
    updateConfig({ services: updated });
  };

  const removeService = (index: number) => {
    updateConfig({ services: services.filter((_, i) => i !== index) });
  };

  const addRoute = (serviceIndex: number) => {
    const service = services[serviceIndex];
    const newRoute: Route = {
      id: `route-${Date.now()}`,
      path: '/api',
      methods: ['GET'],
      stripPath: false,
      preserveHost: false,
    };
    updateService(serviceIndex, {
      routes: [...(service.routes || []), newRoute],
    });
  };

  const updateRoute = (serviceIndex: number, routeIndex: number, updates: Partial<Route>) => {
    const service = services[serviceIndex];
    const updatedRoutes = [...(service.routes || [])];
    updatedRoutes[routeIndex] = { ...updatedRoutes[routeIndex], ...updates };
    updateService(serviceIndex, { routes: updatedRoutes });
  };

  const removeRoute = (serviceIndex: number, routeIndex: number) => {
    const service = services[serviceIndex];
    updateService(serviceIndex, {
      routes: (service.routes || []).filter((_, i) => i !== routeIndex),
    });
  };

  const addPlugin = (serviceIndex: number) => {
    const service = services[serviceIndex];
    const newPlugin: Plugin = {
      id: `plugin-${Date.now()}`,
      name: 'rate-limiting',
      enabled: true,
      config: {},
    };
    updateService(serviceIndex, {
      plugins: [...(service.plugins || []), newPlugin],
    });
  };

  const updatePlugin = (serviceIndex: number, pluginIndex: number, updates: Partial<Plugin>) => {
    const service = services[serviceIndex];
    const updatedPlugins = [...(service.plugins || [])];
    updatedPlugins[pluginIndex] = { ...updatedPlugins[pluginIndex], ...updates };
    updateService(serviceIndex, { plugins: updatedPlugins });
  };

  const removePlugin = (serviceIndex: number, pluginIndex: number) => {
    const service = services[serviceIndex];
    updateService(serviceIndex, {
      plugins: (service.plugins || []).filter((_, i) => i !== pluginIndex),
    });
  };

  const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
  const pluginTypes = [
    { name: 'rate-limiting', label: 'Rate Limiting' },
    { name: 'key-auth', label: 'Key Authentication' },
    { name: 'jwt', label: 'JWT' },
    { name: 'oauth2', label: 'OAuth2' },
    { name: 'cors', label: 'CORS' },
    { name: 'request-transformer', label: 'Request Transformer' },
    { name: 'response-transformer', label: 'Response Transformer' },
    { name: 'ip-restriction', label: 'IP Restriction' },
  ];

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Server className="h-6 w-6" />
              Kong API Gateway
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure services, routes, and plugins
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border px-4">
          <TabsList className="bg-transparent">
            <TabsTrigger value="services" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              Services
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6">
            <TabsContent value="services" className="space-y-4 mt-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Services</h3>
                  <p className="text-sm text-muted-foreground">Configure upstream services and their routes</p>
                </div>
                <Button onClick={addService} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Button>
              </div>

              <div className="space-y-6">
                {services.map((service, serviceIndex) => (
                  <div key={service.id} className="border border-border rounded-lg p-4 space-y-4 bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Server className="h-5 w-5" />
                        <Input
                          value={service.name}
                          onChange={(e) => updateService(serviceIndex, { name: e.target.value })}
                          placeholder="Service Name"
                          className="font-semibold text-lg border-0 bg-transparent p-0 h-auto"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeService(serviceIndex)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Service URL</Label>
                        <Input
                          value={service.url}
                          onChange={(e) => updateService(serviceIndex, { url: e.target.value })}
                          placeholder="http://localhost:8080"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Protocol</Label>
                        <select
                          value={service.protocol}
                          onChange={(e) => updateService(serviceIndex, { protocol: e.target.value as 'http' | 'https' })}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="http">HTTP</option>
                          <option value="https">HTTPS</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Host</Label>
                        <Input
                          value={service.host}
                          onChange={(e) => updateService(serviceIndex, { host: e.target.value })}
                          placeholder="localhost"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Port</Label>
                        <Input
                          type="number"
                          value={service.port}
                          onChange={(e) => updateService(serviceIndex, { port: parseInt(e.target.value) || 8080 })}
                          placeholder="8080"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Path</Label>
                        <Input
                          value={service.path}
                          onChange={(e) => updateService(serviceIndex, { path: e.target.value })}
                          placeholder="/"
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Routes Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Route className="h-4 w-4" />
                          <Label className="text-base font-semibold">Routes</Label>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addRoute(serviceIndex)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Route
                        </Button>
                      </div>

                      {service.routes && service.routes.length > 0 ? (
                        <div className="space-y-3">
                          {service.routes.map((route, routeIndex) => (
                            <div key={route.id} className="border border-border rounded p-3 space-y-3 bg-secondary/30">
                              <div className="flex items-center justify-between">
                                <Input
                                  value={route.path}
                                  onChange={(e) => updateRoute(serviceIndex, routeIndex, { path: e.target.value })}
                                  placeholder="/api/users"
                                  className="font-mono border-0 bg-transparent p-0 h-auto font-semibold"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeRoute(serviceIndex, routeIndex)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="space-y-2">
                                <Label className="text-xs">HTTP Methods</Label>
                                <div className="flex flex-wrap gap-2">
                                  {httpMethods.map((method) => (
                                    <Badge
                                      key={method}
                                      variant={route.methods.includes(method) ? 'default' : 'outline'}
                                      className="cursor-pointer"
                                      onClick={() => {
                                        const methods = route.methods.includes(method)
                                          ? route.methods.filter((m) => m !== method)
                                          : [...route.methods, method];
                                        updateRoute(serviceIndex, routeIndex, { methods });
                                      }}
                                    >
                                      {method}
                                    </Badge>
                                  ))}
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={route.stripPath}
                                    onCheckedChange={(checked) =>
                                      updateRoute(serviceIndex, routeIndex, { stripPath: checked })
                                    }
                                  />
                                  <Label className="text-xs">Strip Path</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={route.preserveHost}
                                    onCheckedChange={(checked) =>
                                      updateRoute(serviceIndex, routeIndex, { preserveHost: checked })
                                    }
                                  />
                                  <Label className="text-xs">Preserve Host</Label>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground border border-dashed border-border rounded text-sm">
                          No routes configured. Click "Add Route" to create one.
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Plugins Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          <Label className="text-base font-semibold">Plugins</Label>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addPlugin(serviceIndex)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Plugin
                        </Button>
                      </div>

                      {service.plugins && service.plugins.length > 0 ? (
                        <div className="space-y-3">
                          {service.plugins.map((plugin, pluginIndex) => (
                            <div key={plugin.id} className="border border-border rounded p-3 space-y-3 bg-secondary/30">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <select
                                    value={plugin.name}
                                    onChange={(e) =>
                                      updatePlugin(serviceIndex, pluginIndex, { name: e.target.value })
                                    }
                                    className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-semibold"
                                  >
                                    {pluginTypes.map((pt) => (
                                      <option key={pt.name} value={pt.name}>
                                        {pt.label}
                                      </option>
                                    ))}
                                  </select>
                                  <Switch
                                    checked={plugin.enabled}
                                    onCheckedChange={(checked) =>
                                      updatePlugin(serviceIndex, pluginIndex, { enabled: checked })
                                    }
                                  />
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removePlugin(serviceIndex, pluginIndex)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              {plugin.name === 'rate-limiting' && (
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label className="text-xs">Minute</Label>
                                    <Input
                                      type="number"
                                      value={plugin.config.minute || ''}
                                      onChange={(e) =>
                                        updatePlugin(serviceIndex, pluginIndex, {
                                          config: { ...plugin.config, minute: parseInt(e.target.value) || 0 },
                                        })
                                      }
                                      placeholder="1000"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">Hour</Label>
                                    <Input
                                      type="number"
                                      value={plugin.config.hour || ''}
                                      onChange={(e) =>
                                        updatePlugin(serviceIndex, pluginIndex, {
                                          config: { ...plugin.config, hour: parseInt(e.target.value) || 0 },
                                        })
                                      }
                                      placeholder="10000"
                                    />
                                  </div>
                                </div>
                              )}

                              {plugin.name === 'key-auth' && (
                                <div className="space-y-2">
                                  <Label className="text-xs">Key Names (comma-separated)</Label>
                                  <Input
                                    value={plugin.config.key_names || ''}
                                    onChange={(e) =>
                                      updatePlugin(serviceIndex, pluginIndex, {
                                        config: { ...plugin.config, key_names: e.target.value },
                                      })
                                    }
                                    placeholder="apikey, x-api-key"
                                  />
                                </div>
                              )}

                              {plugin.name === 'cors' && (
                                <div className="space-y-2">
                                  <Label className="text-xs">Allowed Origins</Label>
                                  <Input
                                    value={plugin.config.origins || ''}
                                    onChange={(e) =>
                                      updatePlugin(serviceIndex, pluginIndex, {
                                        config: { ...plugin.config, origins: e.target.value },
                                      })
                                    }
                                    placeholder="*"
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground border border-dashed border-border rounded text-sm">
                          No plugins configured. Click "Add Plugin" to create one.
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {services.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No services defined. Click "Add Service" to create one.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-0">
              <div>
                <h3 className="text-lg font-semibold mb-4">Gateway Settings</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Admin API URL</Label>
                    <Input
                      value={config.adminUrl || ''}
                      onChange={(e) => updateConfig({ adminUrl: e.target.value })}
                      placeholder="http://kong:8001"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}


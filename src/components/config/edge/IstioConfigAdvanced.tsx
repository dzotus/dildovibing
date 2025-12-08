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
  Shield,
  Route,
  Globe,
  CheckCircle,
  AlertTriangle,
  Layers
} from 'lucide-react';

interface IstioConfigProps {
  componentId: string;
}

interface Service {
  id: string;
  name: string;
  namespace: string;
  version?: string;
  pods?: number;
  healthyPods?: number;
  requests?: number;
  errors?: number;
  latency?: number;
}

interface VirtualService {
  id: string;
  name: string;
  hosts: string[];
  gateways?: string[];
  http?: Array<{
    match?: Array<{ uri?: { prefix?: string } }>;
    route?: Array<{ destination: { host: string; subset?: string }; weight?: number }>;
  }>;
}

interface DestinationRule {
  id: string;
  name: string;
  host: string;
  subsets?: Array<{
    name: string;
    labels?: Record<string, string>;
  }>;
  trafficPolicy?: {
    loadBalancer?: { simple?: 'ROUND_ROBIN' | 'LEAST_CONN' | 'RANDOM' };
  };
}

interface Gateway {
  id: string;
  name: string;
  selector?: Record<string, string>;
  servers?: Array<{
    port: { number: number; protocol: string; name: string };
    hosts: string[];
  }>;
}

interface IstioConfig {
  services?: Service[];
  virtualServices?: VirtualService[];
  destinationRules?: DestinationRule[];
  gateways?: Gateway[];
  totalServices?: number;
  totalRequests?: number;
  totalErrors?: number;
  averageLatency?: number;
  enableMTLS?: boolean;
  enableTracing?: boolean;
  enableMetrics?: boolean;
  defaultLoadBalancer?: 'ROUND_ROBIN' | 'LEAST_CONN' | 'RANDOM';
}

export function IstioConfigAdvanced({ componentId }: IstioConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as IstioConfig;
  const services = config.services || [
    {
      id: '1',
      name: 'frontend',
      namespace: 'default',
      version: 'v1',
      pods: 3,
      healthyPods: 3,
      requests: 125000,
      errors: 25,
      latency: 45,
    },
    {
      id: '2',
      name: 'backend',
      namespace: 'default',
      version: 'v1',
      pods: 2,
      healthyPods: 2,
      requests: 98000,
      errors: 12,
      latency: 120,
    },
  ];
  const virtualServices = config.virtualServices || [
    {
      id: '1',
      name: 'frontend-vs',
      hosts: ['frontend.example.com'],
      http: [
        {
          route: [
            { destination: { host: 'frontend', subset: 'v1' }, weight: 90 },
            { destination: { host: 'frontend', subset: 'v2' }, weight: 10 },
          ],
        },
      ],
    },
  ];
  const destinationRules = config.destinationRules || [
    {
      id: '1',
      name: 'frontend-dr',
      host: 'frontend',
      subsets: [
        { name: 'v1', labels: { version: 'v1' } },
        { name: 'v2', labels: { version: 'v2' } },
      ],
      trafficPolicy: {
        loadBalancer: { simple: 'ROUND_ROBIN' },
      },
    },
  ];
  const gateways = config.gateways || [
    {
      id: '1',
      name: 'istio-gateway',
      selector: { istio: 'ingressgateway' },
      servers: [
        {
          port: { number: 80, protocol: 'HTTP', name: 'http' },
          hosts: ['*'],
        },
      ],
    },
  ];
  const totalServices = config.totalServices || services.length;
  const totalRequests = config.totalRequests || services.reduce((sum, s) => sum + (s.requests || 0), 0);
  const totalErrors = config.totalErrors || services.reduce((sum, s) => sum + (s.errors || 0), 0);
  const averageLatency = config.averageLatency || Math.round(services.reduce((sum, s) => sum + (s.latency || 0), 0) / services.length);

  const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);
  const [showCreateVirtualService, setShowCreateVirtualService] = useState(false);
  const [showCreateDestinationRule, setShowCreateDestinationRule] = useState(false);

  const updateConfig = (updates: Partial<IstioConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addVirtualService = () => {
    const newVS: VirtualService = {
      id: `vs-${Date.now()}`,
      name: 'new-virtual-service',
      hosts: ['example.com'],
      http: [
        {
          route: [{ destination: { host: 'service' }, weight: 100 }],
        },
      ],
    };
    updateConfig({ virtualServices: [...virtualServices, newVS] });
    setShowCreateVirtualService(false);
  };

  const removeVirtualService = (id: string) => {
    updateConfig({ virtualServices: virtualServices.filter((vs) => vs.id !== id) });
  };

  const addDestinationRule = () => {
    const newDR: DestinationRule = {
      id: `dr-${Date.now()}`,
      name: 'new-destination-rule',
      host: 'service',
      subsets: [{ name: 'v1', labels: { version: 'v1' } }],
    };
    updateConfig({ destinationRules: [...destinationRules, newDR] });
    setShowCreateDestinationRule(false);
  };

  const removeDestinationRule = (id: string) => {
    updateConfig({ destinationRules: destinationRules.filter((dr) => dr.id !== id) });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Istio Service Mesh</p>
            <h2 className="text-2xl font-bold text-foreground">Traffic Management</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Service mesh for microservices traffic management and security
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Globe className="h-4 w-4 mr-2" />
              Kiali
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Services</CardTitle>
                <Network className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalServices}</span>
                <span className="text-xs text-muted-foreground">registered</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Requests</CardTitle>
                <Activity className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalRequests.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Errors</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-red-600 dark:text-red-400">{totalErrors}</span>
                <span className="text-xs text-muted-foreground">total</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Latency</CardTitle>
                <Activity className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{averageLatency}</span>
                <span className="text-xs text-muted-foreground">ms</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="services" className="space-y-4">
          <TabsList>
            <TabsTrigger value="services">
              <Network className="h-4 w-4 mr-2" />
              Services ({services.length})
            </TabsTrigger>
            <TabsTrigger value="virtual-services">
              <Route className="h-4 w-4 mr-2" />
              Virtual Services ({virtualServices.length})
            </TabsTrigger>
            <TabsTrigger value="destination-rules">
              <Layers className="h-4 w-4 mr-2" />
              Destination Rules ({destinationRules.length})
            </TabsTrigger>
            <TabsTrigger value="gateways">
              <Globe className="h-4 w-4 mr-2" />
              Gateways ({gateways.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="services" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Services</CardTitle>
                <CardDescription>Registered services in the mesh</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {services.map((service) => (
                    <Card key={service.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                              <Network className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{service.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline">{service.namespace}</Badge>
                                {service.version && (
                                  <Badge variant="outline">{service.version}</Badge>
                                )}
                                <Badge variant={service.healthyPods === service.pods ? 'default' : 'destructive'}>
                                  {service.healthyPods || 0}/{service.pods || 0} pods
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Requests:</span>
                            <span className="ml-2 font-semibold">{service.requests?.toLocaleString() || 0}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Errors:</span>
                            <span className={`ml-2 font-semibold ${service.errors && service.errors > 0 ? 'text-red-500' : ''}`}>
                              {service.errors || 0}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Latency:</span>
                            <span className="ml-2 font-semibold">{service.latency || 0}ms</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Error Rate:</span>
                            <span className={`ml-2 font-semibold ${service.requests && service.errors && (service.errors / service.requests) > 0.01 ? 'text-red-500' : ''}`}>
                              {service.requests && service.errors ? ((service.errors / service.requests) * 100).toFixed(2) : 0}%
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="virtual-services" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Virtual Services</CardTitle>
                    <CardDescription>Configure traffic routing rules</CardDescription>
                  </div>
                  <Button onClick={addVirtualService} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Virtual Service
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {virtualServices.map((vs) => (
                    <Card key={vs.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                              <Route className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{vs.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                {vs.hosts.map((host, idx) => (
                                  <Badge key={idx} variant="outline" className="font-mono text-xs">
                                    {host}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeVirtualService(vs.id)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {vs.http && vs.http.length > 0 && (
                          <div className="space-y-2">
                            {vs.http.map((http, idx) => (
                              <div key={idx} className="p-3 border rounded">
                                {http.route && (
                                  <div className="space-y-1">
                                    {http.route.map((route, rIdx) => (
                                      <div key={rIdx} className="text-sm">
                                        <span className="text-muted-foreground">→</span>
                                        <span className="ml-2 font-medium">{route.destination.host}</span>
                                        {route.destination.subset && (
                                          <Badge variant="outline" className="ml-2">{route.destination.subset}</Badge>
                                        )}
                                        {route.weight && (
                                          <Badge variant="outline" className="ml-2">{route.weight}%</Badge>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="destination-rules" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Destination Rules</CardTitle>
                    <CardDescription>Configure traffic policies and subsets</CardDescription>
                  </div>
                  <Button onClick={addDestinationRule} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Destination Rule
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {destinationRules.map((dr) => (
                    <Card key={dr.id} className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                              <Layers className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{dr.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="font-mono text-xs">{dr.host}</Badge>
                                {dr.trafficPolicy?.loadBalancer?.simple && (
                                  <Badge variant="outline">{dr.trafficPolicy.loadBalancer.simple}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeDestinationRule(dr.id)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {dr.subsets && dr.subsets.length > 0 && (
                          <div className="space-y-2">
                            <Label>Subsets</Label>
                            {dr.subsets.map((subset, idx) => (
                              <div key={idx} className="p-2 border rounded">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{subset.name}</Badge>
                                  {subset.labels && Object.entries(subset.labels).map(([key, value]) => (
                                    <Badge key={key} variant="outline" className="text-xs">
                                      {key}={value}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gateways" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gateways</CardTitle>
                <CardDescription>Configure ingress and egress gateways</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {gateways.map((gateway) => (
                    <Card key={gateway.id} className="border-l-4 border-l-cyan-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                            <Globe className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                          </div>
                          <div>
                            <CardTitle className="text-lg font-semibold">{gateway.name}</CardTitle>
                            {gateway.servers && gateway.servers.length > 0 && (
                              <div className="flex items-center gap-2 mt-2">
                                {gateway.servers.map((server, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {server.port.protocol}:{server.port.number}
                                  </Badge>
                                ))}
                              </div>
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

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Istio Settings</CardTitle>
                <CardDescription>Service mesh configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable mTLS</Label>
                  <Switch 
                    checked={config.enableMTLS ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableMTLS: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Tracing</Label>
                  <Switch 
                    checked={config.enableTracing ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableTracing: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Metrics</Label>
                  <Switch 
                    checked={config.enableMetrics ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableMetrics: checked })}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Default Load Balancer</Label>
                  <Select 
                    value={config.defaultLoadBalancer ?? 'ROUND_ROBIN'}
                    onValueChange={(value: 'ROUND_ROBIN' | 'LEAST_CONN' | 'RANDOM') => updateConfig({ defaultLoadBalancer: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
                      <SelectItem value="LEAST_CONN">Least Connections</SelectItem>
                      <SelectItem value="RANDOM">Random</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


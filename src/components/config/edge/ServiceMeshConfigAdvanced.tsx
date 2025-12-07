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
  Shield,
  Zap,
  Globe
} from 'lucide-react';

interface ServiceMeshConfigProps {
  componentId: string;
}

interface Service {
  id: string;
  name: string;
  namespace: string;
  pods: number;
  healthyPods: number;
  requests?: number;
  errors?: number;
  latency?: number;
}

interface Policy {
  id: string;
  name: string;
  type: 'traffic' | 'security' | 'observability';
  enabled: boolean;
  services: string[];
}

interface ServiceMeshConfig {
  services?: Service[];
  policies?: Policy[];
  totalServices?: number;
  activePolicies?: number;
  totalRequests?: number;
  averageLatency?: number;
  enableMTLS?: boolean;
  enableTracing?: boolean;
  enableMetrics?: boolean;
  defaultLoadBalancer?: 'ROUND_ROBIN' | 'LEAST_CONN' | 'RANDOM';
  metrics?: {
    enabled?: boolean;
    controlPlanePort?: number;
    sidecarPort?: number;
    gatewayPort?: number;
  };
}

export function ServiceMeshConfigAdvanced({ componentId }: ServiceMeshConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as ServiceMeshConfig;
  const services = config.services || [
    {
      id: 'svc-1',
      name: 'frontend',
      namespace: 'default',
      pods: 3,
      healthyPods: 3,
      requests: 12500,
      errors: 25,
      latency: 45,
    },
    {
      id: 'svc-2',
      name: 'backend',
      namespace: 'default',
      pods: 2,
      healthyPods: 2,
      requests: 9800,
      errors: 12,
      latency: 120,
    },
  ];
  const policies = config.policies || [
    {
      id: 'policy-1',
      name: 'mTLS Policy',
      type: 'security',
      enabled: true,
      services: ['frontend', 'backend'],
    },
    {
      id: 'policy-2',
      name: 'Traffic Splitting',
      type: 'traffic',
      enabled: true,
      services: ['frontend'],
    },
  ];
  const totalServices = config.totalServices || services.length;
  const activePolicies = config.activePolicies || policies.filter((p) => p.enabled).length;
  const totalRequests = config.totalRequests || services.reduce((sum, s) => sum + (s.requests || 0), 0);
  const averageLatency = config.averageLatency || services.reduce((sum, s) => sum + (s.latency || 0), 0) / services.length;

  const [showCreatePolicy, setShowCreatePolicy] = useState(false);

  const updateConfig = (updates: Partial<ServiceMeshConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addPolicy = () => {
    const newPolicy: Policy = {
      id: `policy-${Date.now()}`,
      name: 'New Policy',
      type: 'traffic',
      enabled: true,
      services: [],
    };
    updateConfig({ policies: [...policies, newPolicy] });
    setShowCreatePolicy(false);
  };

  const removePolicy = (id: string) => {
    updateConfig({ policies: policies.filter((p) => p.id !== id) });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'security':
        return 'bg-red-500';
      case 'traffic':
        return 'bg-blue-500';
      case 'observability':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Service Mesh</p>
            <h2 className="text-2xl font-bold text-foreground">Service Mesh</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Service-to-service communication and management
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Services</CardTitle>
                <Server className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalServices}</span>
                <span className="text-xs text-muted-foreground">registered</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Policies</CardTitle>
                <Shield className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{activePolicies}</span>
                <span className="text-xs text-muted-foreground">active</span>
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Latency</CardTitle>
                <Zap className="h-4 w-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{averageLatency.toFixed(0)}</span>
                <span className="text-xs text-muted-foreground">ms</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="services" className="space-y-4">
          <TabsList>
            <TabsTrigger value="services">
              <Server className="h-4 w-4 mr-2" />
              Services ({services.length})
            </TabsTrigger>
            <TabsTrigger value="policies">
              <Shield className="h-4 w-4 mr-2" />
              Policies ({policies.length})
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
                    <Card key={service.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                            <Server className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <CardTitle className="text-lg font-semibold">{service.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline">{service.namespace}</Badge>
                              <Badge variant={service.healthyPods === service.pods ? 'default' : 'destructive'}>
                                {service.healthyPods}/{service.pods} pods
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          {service.requests && (
                            <div>
                              <span className="text-muted-foreground">Requests:</span>
                              <span className="ml-2 font-semibold">{service.requests.toLocaleString()}</span>
                            </div>
                          )}
                          {service.errors && service.errors > 0 && (
                            <div>
                              <span className="text-muted-foreground">Errors:</span>
                              <span className="ml-2 font-semibold text-red-500">{service.errors}</span>
                            </div>
                          )}
                          {service.latency && (
                            <div>
                              <span className="text-muted-foreground">Latency:</span>
                              <span className="ml-2 font-semibold">{service.latency}ms</span>
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

          <TabsContent value="policies" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Mesh Policies</CardTitle>
                    <CardDescription>Traffic, security, and observability policies</CardDescription>
                  </div>
                  <Button onClick={addPolicy} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Policy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {policies.map((policy) => (
                    <Card key={policy.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getTypeColor(policy.type)}/20`}>
                              <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{policy.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className={getTypeColor(policy.type)}>
                                  {policy.type}
                                </Badge>
                                <Badge variant={policy.enabled ? 'default' : 'outline'}>
                                  {policy.enabled ? 'Enabled' : 'Disabled'}
                                </Badge>
                                <Badge variant="outline">{policy.services.length} services</Badge>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removePolicy(policy.id)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {policy.services.length > 0 && (
                          <div className="space-y-1">
                            <Label className="text-xs">Applied to Services</Label>
                            <div className="flex flex-wrap gap-2">
                              {policy.services.map((svc, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">{svc}</Badge>
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

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Service Mesh Settings</CardTitle>
                <CardDescription>Mesh configuration</CardDescription>
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
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Metrics Export</Label>
                      <p className="text-xs text-muted-foreground mt-1">Export Istio metrics for Prometheus scraping</p>
                    </div>
                    <Switch 
                      checked={config.metrics?.enabled ?? true}
                      onCheckedChange={(checked) => updateConfig({ 
                        metrics: { 
                          ...config.metrics, 
                          enabled: checked,
                          controlPlanePort: config.metrics?.controlPlanePort || 15014,
                          sidecarPort: config.metrics?.sidecarPort || 15090,
                          gatewayPort: config.metrics?.gatewayPort || 15020
                        } 
                      })}
                    />
                  </div>
                  {config.metrics?.enabled !== false && (
                    <>
                      <div className="space-y-2">
                        <Label>Control Plane Metrics Port (istiod)</Label>
                        <Input 
                          type="number" 
                          value={config.metrics?.controlPlanePort ?? 15014}
                          onChange={(e) => updateConfig({ 
                            metrics: { 
                              ...config.metrics, 
                              controlPlanePort: parseInt(e.target.value) || 15014,
                              sidecarPort: config.metrics?.sidecarPort || 15090,
                              gatewayPort: config.metrics?.gatewayPort || 15020
                            } 
                          })}
                          min={1024} 
                          max={65535} 
                        />
                        <p className="text-xs text-muted-foreground">Istio control plane metrics endpoint: :15014/metrics</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Sidecar Metrics Port (Envoy)</Label>
                        <Input 
                          type="number" 
                          value={config.metrics?.sidecarPort ?? 15090}
                          onChange={(e) => updateConfig({ 
                            metrics: { 
                              ...config.metrics, 
                              sidecarPort: parseInt(e.target.value) || 15090,
                              controlPlanePort: config.metrics?.controlPlanePort || 15014,
                              gatewayPort: config.metrics?.gatewayPort || 15020
                            } 
                          })}
                          min={1024} 
                          max={65535} 
                        />
                        <p className="text-xs text-muted-foreground">Envoy sidecar metrics endpoint: :15090/stats/prometheus</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Gateway Metrics Port</Label>
                        <Input 
                          type="number" 
                          value={config.metrics?.gatewayPort ?? 15020}
                          onChange={(e) => updateConfig({ 
                            metrics: { 
                              ...config.metrics, 
                              gatewayPort: parseInt(e.target.value) || 15020,
                              controlPlanePort: config.metrics?.controlPlanePort || 15014,
                              sidecarPort: config.metrics?.sidecarPort || 15090
                            } 
                          })}
                          min={1024} 
                          max={65535} 
                        />
                        <p className="text-xs text-muted-foreground">Istio gateway metrics endpoint: :15020/stats/prometheus</p>
                      </div>
                    </>
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





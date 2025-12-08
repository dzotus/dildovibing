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
  Layers,
  Network,
  CheckCircle,
  Zap,
  Code
} from 'lucide-react';

interface BFFServiceConfigProps {
  componentId: string;
}

interface Backend {
  id: string;
  name: string;
  endpoint: string;
  protocol: 'http' | 'grpc' | 'graphql';
  status: 'connected' | 'disconnected' | 'error';
  requests?: number;
  avgLatency?: number;
}

interface Endpoint {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  backends: string[];
  aggregator?: 'merge' | 'sequential' | 'parallel';
  requests?: number;
}

interface BFFServiceConfig {
  backends?: Backend[];
  endpoints?: Endpoint[];
  totalBackends?: number;
  totalEndpoints?: number;
  totalRequests?: number;
  averageLatency?: number;
  enableCaching?: boolean;
  enableRequestBatching?: boolean;
  enableResponseCompression?: boolean;
  defaultTimeout?: number;
  maxConcurrentRequests?: number;
}

export function BFFServiceConfigAdvanced({ componentId }: BFFServiceConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as BFFServiceConfig;
  const backends = config.backends || [];
  const endpoints = config.endpoints || [
    {
      id: 'endpoint-1',
      path: '/api/user-profile',
      method: 'GET',
      backends: ['user-service', 'order-service'],
      aggregator: 'merge',
      requests: 1250,
    },
    {
      id: 'endpoint-2',
      path: '/api/dashboard',
      method: 'GET',
      backends: ['user-service', 'order-service', 'product-service'],
      aggregator: 'parallel',
      requests: 980,
    },
  ];
  const totalBackends = config.totalBackends || backends.length;
  const totalEndpoints = config.totalEndpoints || endpoints.length;
  const totalRequests = config.totalRequests || endpoints.reduce((sum, e) => sum + (e.requests || 0), 0);
  const averageLatency = config.averageLatency || backends.reduce((sum, b) => sum + (b.avgLatency || 0), 0) / backends.length;

  const [showCreateBackend, setShowCreateBackend] = useState(false);
  const [showCreateEndpoint, setShowCreateEndpoint] = useState(false);

  const updateConfig = (updates: Partial<BFFServiceConfig>) => {
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
      endpoint: 'http://localhost:8080',
      protocol: 'http',
      status: 'disconnected',
    };
    updateConfig({ backends: [...backends, newBackend] });
    setShowCreateBackend(false);
  };

  const removeBackend = (id: string) => {
    updateConfig({ backends: backends.filter((b) => b.id !== id) });
  };

  const addEndpoint = () => {
    const newEndpoint: Endpoint = {
      id: `endpoint-${Date.now()}`,
      path: '/api/new-endpoint',
      method: 'GET',
      backends: [],
      aggregator: 'merge',
    };
    updateConfig({ endpoints: [...endpoints, newEndpoint] });
    setShowCreateEndpoint(false);
  };

  const removeEndpoint = (id: string) => {
    updateConfig({ endpoints: endpoints.filter((e) => e.id !== id) });
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'disconnected':
        return 'bg-muted';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-muted';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500 text-white';
      case 'disconnected':
        return 'bg-muted text-foreground';
      case 'error':
        return 'bg-red-500 text-white';
      default:
        return 'bg-muted text-foreground';
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">BFF Service</p>
            <h2 className="text-2xl font-bold text-foreground">Backend for Frontend</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Aggregated API service for frontend applications
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
          <Card className="border-l-4 border-l-blue-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Backends</CardTitle>
                <Network className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalBackends}</span>
                <span className="text-xs text-muted-foreground">connected</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Endpoints</CardTitle>
                <Layers className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalEndpoints}</span>
                <span className="text-xs text-muted-foreground">defined</span>
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

        <Tabs defaultValue="endpoints" className="space-y-4">
          <TabsList>
            <TabsTrigger value="endpoints">
              <Layers className="h-4 w-4 mr-2" />
              Endpoints ({endpoints.length})
            </TabsTrigger>
            <TabsTrigger value="backends">
              <Network className="h-4 w-4 mr-2" />
              Backends ({backends.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="endpoints" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>API Endpoints</CardTitle>
                    <CardDescription>Aggregated endpoints</CardDescription>
                  </div>
                  <Button onClick={addEndpoint} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Endpoint
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {endpoints.map((endpoint) => (
                    <Card key={endpoint.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                              <Layers className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{endpoint.method} {endpoint.path}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline">{endpoint.aggregator || 'merge'}</Badge>
                                <Badge variant="outline">{endpoint.backends.length} backends</Badge>
                                {endpoint.requests && (
                                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
                                    {endpoint.requests} requests
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeEndpoint(endpoint.id)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <Label>Backends</Label>
                          <div className="flex flex-wrap gap-2">
                            {endpoint.backends.map((backendId, idx) => {
                              const backend = backends.find((b) => b.id === backendId);
                              return (
                                <Badge key={idx} variant="outline">
                                  {backend?.name || backendId}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backends" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Backend Services</CardTitle>
                    <CardDescription>Connected backend services</CardDescription>
                  </div>
                  <Button onClick={addBackend} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Backend
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {backends.map((backend) => (
                    <Card key={backend.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getStatusBgColor(backend.status)}/20`}>
                              <Network className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{backend.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className={`${getStatusBadgeColor(backend.status)} border-0`}>
                                  {backend.status}
                                </Badge>
                                <Badge variant="outline">{backend.protocol.toUpperCase()}</Badge>
                                <Badge variant="outline" className="font-mono text-xs">{backend.endpoint}</Badge>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeBackend(backend.id)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {backend.requests && (
                            <div>
                              <span className="text-muted-foreground">Requests:</span>
                              <span className="ml-2 font-semibold">{backend.requests.toLocaleString()}</span>
                            </div>
                          )}
                          {backend.avgLatency && (
                            <div>
                              <span className="text-muted-foreground">Avg Latency:</span>
                              <span className="ml-2 font-semibold">{backend.avgLatency}ms</span>
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

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>BFF Service Settings</CardTitle>
                <CardDescription>Service configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Caching</Label>
                  <Switch 
                    checked={config.enableCaching ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableCaching: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Request Batching</Label>
                  <Switch 
                    checked={config.enableRequestBatching ?? false}
                    onCheckedChange={(checked) => updateConfig({ enableRequestBatching: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Response Compression</Label>
                  <Switch 
                    checked={config.enableResponseCompression ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableResponseCompression: checked })}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Default Timeout (ms)</Label>
                  <Input 
                    type="number" 
                    value={config.defaultTimeout ?? 5000}
                    onChange={(e) => updateConfig({ defaultTimeout: parseInt(e.target.value) || 5000 })}
                    min={1} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Concurrent Requests</Label>
                  <Input 
                    type="number" 
                    value={config.maxConcurrentRequests ?? 100}
                    onChange={(e) => updateConfig({ maxConcurrentRequests: parseInt(e.target.value) || 100 })}
                    min={1} 
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


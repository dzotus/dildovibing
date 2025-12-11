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
  Network,
  CheckCircle,
  Globe
} from 'lucide-react';

interface GraphQLGatewayConfigProps {
  componentId: string;
}

interface Service {
  id: string;
  name: string;
  endpoint: string;
  schema?: string;
  status: 'connected' | 'disconnected' | 'error';
  requests?: number;
  errors?: number;
}

interface Federation {
  enabled: boolean;
  services: string[];
  supergraph?: string;
}

interface GraphQLGatewayConfig {
  services?: Service[];
  federation?: Federation;
  totalServices?: number;
  totalRequests?: number;
  totalErrors?: number;
  endpoint?: string;
  enableIntrospection?: boolean;
  enableQueryComplexityAnalysis?: boolean;
  enableRateLimiting?: boolean;
  maxQueryDepth?: number;
  maxQueryComplexity?: number;
}

export function GraphQLGatewayConfigAdvanced({ componentId }: GraphQLGatewayConfigProps) {
  const { nodes, updateNode, connections } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as GraphQLGatewayConfig;
  const services = config.services || [];
  const federation = config.federation || {
    enabled: false,
    services: [],
  };
  const endpoint = config.endpoint || '/graphql';
  const totalServices = config.totalServices || services.length;
  const totalRequests = config.totalRequests || services.reduce((sum, s) => sum + (s.requests || 0), 0);
  const totalErrors = config.totalErrors || services.reduce((sum, s) => sum + (s.errors || 0), 0);

  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'name' | 'endpoint' | null>(null);

  const updateConfig = (updates: Partial<GraphQLGatewayConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addService = () => {
    const newService: Service = {
      id: `svc-${Date.now()}`,
      name: 'new-service',
      endpoint: 'http://localhost:4000/graphql',
      status: 'disconnected',
    };
    updateConfig({ services: [...services, newService] });
    setShowCreateService(false);
  };

  const removeService = (id: string) => {
    updateConfig({ services: services.filter((s) => s.id !== id) });
  };

  const updateService = (id: string, field: 'name' | 'endpoint', value: string) => {
    const updatedServices = services.map((s) =>
      s.id === id ? { ...s, [field]: value } : s
    );
    updateConfig({ services: updatedServices });
  };

  // Determine service status based on connections
  const getServiceStatus = (service: Service): 'connected' | 'disconnected' | 'error' => {
    // If service explicitly has error status, keep it
    if (service.status === 'error') {
      return 'error';
    }

    // Check if there's a connection to a graphql service
    const hasConnection = connections.some((conn) => {
      if (conn.source !== componentId) return false;
      const targetNode = nodes.find((n) => n.id === conn.target);
      if (!targetNode || targetNode.type !== 'graphql') return false;
      
      // Match by name (most reliable) or by endpoint pattern
      const targetLabel = targetNode.data.label || targetNode.type;
      const nameMatches = service.name === targetLabel || service.name === targetNode.id;
      
      // Try to match endpoint - extract host:port from endpoint
      const endpointMatch = service.endpoint && targetNode.id 
        ? service.endpoint.includes(targetNode.id) || service.name === targetLabel
        : false;
      
      return nameMatches || endpointMatch;
    });

    // If connection exists, service is connected (unless explicitly error)
    if (hasConnection) {
      return 'connected';
    }

    // No connection - check if service was manually added (might be disconnected)
    // If service has explicit disconnected status, use it
    return service.status === 'disconnected' ? 'disconnected' : 'disconnected';
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
            <p className="text-xs uppercase text-muted-foreground tracking-wide">GraphQL Gateway</p>
            <h2 className="text-2xl font-bold text-foreground">Federated GraphQL Gateway</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Unified GraphQL API gateway with federation support
            </p>
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
                <CheckCircle className="h-4 w-4 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-red-600 dark:text-red-400">{totalErrors}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Federation</CardTitle>
                <Globe className="h-4 w-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">
                  {federation.enabled ? 'ON' : 'OFF'}
                </span>
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
            <TabsTrigger value="federation">
              <Globe className="h-4 w-4 mr-2" />
              Federation
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="services" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>GraphQL Services</CardTitle>
                    <CardDescription>Registered GraphQL backend services</CardDescription>
                  </div>
                  <Button onClick={addService} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Service
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {services.map((service) => {
                    const serviceStatus = getServiceStatus(service);
                    const isEditingName = editingServiceId === service.id && editingField === 'name';
                    const isEditingEndpoint = editingServiceId === service.id && editingField === 'endpoint';
                    
                    return (
                      <Card key={service.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={`p-2 rounded-lg ${getStatusBgColor(serviceStatus)}/20`}>
                                <Network className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="flex-1 space-y-2">
                                {isEditingName ? (
                                  <Input
                                    value={service.name}
                                    onChange={(e) => updateService(service.id, 'name', e.target.value)}
                                    onBlur={() => {
                                      setEditingServiceId(null);
                                      setEditingField(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        setEditingServiceId(null);
                                        setEditingField(null);
                                      }
                                    }}
                                    className="font-semibold text-lg"
                                    autoFocus
                                  />
                                ) : (
                                  <CardTitle 
                                    className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => {
                                      setEditingServiceId(service.id);
                                      setEditingField('name');
                                    }}
                                  >
                                    {service.name}
                                  </CardTitle>
                                )}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className={`${getStatusBadgeColor(serviceStatus)} border-0`}>
                                    {serviceStatus}
                                  </Badge>
                                  {isEditingEndpoint ? (
                                    <Input
                                      value={service.endpoint}
                                      onChange={(e) => updateService(service.id, 'endpoint', e.target.value)}
                                      onBlur={() => {
                                        setEditingServiceId(null);
                                        setEditingField(null);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          setEditingServiceId(null);
                                          setEditingField(null);
                                        }
                                      }}
                                      className="font-mono text-xs h-6"
                                      autoFocus
                                    />
                                  ) : (
                                    <Badge 
                                      variant="outline" 
                                      className="font-mono text-xs cursor-pointer hover:bg-accent transition-colors"
                                      onClick={() => {
                                        setEditingServiceId(service.id);
                                        setEditingField('endpoint');
                                      }}
                                    >
                                      {service.endpoint}
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
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {service.requests !== undefined && (
                              <div>
                                <span className="text-muted-foreground">Requests:</span>
                                <span className="ml-2 font-semibold">{service.requests.toLocaleString()}</span>
                              </div>
                            )}
                            {service.errors !== undefined && service.errors > 0 && (
                              <div>
                                <span className="text-muted-foreground">Errors:</span>
                                <span className="ml-2 font-semibold text-red-500">{service.errors}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="federation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>GraphQL Federation</CardTitle>
                <CardDescription>Federated schema configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Federation</Label>
                  <Switch
                    checked={federation.enabled}
                    onCheckedChange={(checked) => updateConfig({ federation: { ...federation, enabled: checked } })}
                  />
                </div>
                {federation.enabled && (
                  <>
                    <div className="space-y-2">
                      <Label>Federated Services</Label>
                      <div className="flex flex-wrap gap-2">
                        {federation.services.map((svc, idx) => (
                          <Badge key={idx} variant="outline">{svc}</Badge>
                        ))}
                      </div>
                    </div>
                    {federation.supergraph && (
                      <div className="space-y-2">
                        <Label>Supergraph Schema</Label>
                        <div className="p-3 bg-muted rounded text-xs font-mono overflow-x-auto">
                          {federation.supergraph}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gateway Settings</CardTitle>
                <CardDescription>Gateway configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Gateway Endpoint</Label>
                  <Input
                    value={endpoint}
                    onChange={(e) => updateConfig({ endpoint: e.target.value })}
                    placeholder="/graphql"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Enable Introspection</Label>
                  <Switch 
                    checked={config.enableIntrospection ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableIntrospection: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Query Complexity Analysis</Label>
                  <Switch 
                    checked={config.enableQueryComplexityAnalysis ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableQueryComplexityAnalysis: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Rate Limiting</Label>
                  <Switch 
                    checked={config.enableRateLimiting ?? false}
                    onCheckedChange={(checked) => updateConfig({ enableRateLimiting: checked })}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Max Query Depth</Label>
                  <Input 
                    type="number" 
                    value={config.maxQueryDepth ?? 15}
                    onChange={(e) => updateConfig({ maxQueryDepth: parseInt(e.target.value) || 15 })}
                    min={1} 
                    max={50} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Query Complexity</Label>
                  <Input 
                    type="number" 
                    value={config.maxQueryComplexity ?? 1000}
                    onChange={(e) => updateConfig({ maxQueryComplexity: parseInt(e.target.value) || 1000 })}
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


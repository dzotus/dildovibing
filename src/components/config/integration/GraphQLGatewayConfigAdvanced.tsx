import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { emulationEngine } from '@/core/EmulationEngine';
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
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Activity,
  Trash2,
  Network,
  Globe,
  Zap,
  Shield,
  BarChart3,
  AlertTriangle,
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
  version?: '1' | '2';
  supergraphVersion?: string;
  lastCompositionAt?: string;
  compositionStatus?: 'ok' | 'error' | 'degraded';
  compositionIssues?: string[];
}

interface GraphQLGatewayConfig {
  services?: Service[];
  federation?: Federation;
  endpoint?: string;
  enableIntrospection?: boolean;
  enableQueryComplexityAnalysis?: boolean;
  enableRateLimiting?: boolean;
  enableQueryBatching?: boolean;
  supportsSubscriptions?: boolean;
  maxQueryDepth?: number;
  maxQueryComplexity?: number;
  globalRateLimitPerMinute?: number;
  cacheTtl?: number;
  persistQueries?: boolean;
  subscriptions?: boolean;
  variability?: {
    latencyJitterMultiplier?: number;
    baseRandomErrorRate?: number;
    federationOverheadMs?: number;
  };
}

export function GraphQLGatewayConfigAdvanced({ componentId }: GraphQLGatewayConfigProps) {
  const { nodes, updateNode, connections } = useCanvasStore();
  const { isRunning, getComponentMetrics } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data?.config || {}) as GraphQLGatewayConfig;
  const services = Array.isArray(config.services) ? config.services : [];
  const federation = config.federation || {
    enabled: false,
    services: [],
  };
  const endpoint = config.endpoint || '/graphql';


  // Получаем метрики из эмуляции
  const componentMetrics = getComponentMetrics(componentId);
  const customMetrics = componentMetrics?.customMetrics || {};
  
  const gatewayMetrics = useMemo(() => ({
    requestsTotal: customMetrics.gatewayRequestsTotal || 0,
    errorsTotal: customMetrics.gatewayErrorsTotal || 0,
    rateLimitedTotal: customMetrics.gatewayRateLimitedTotal || 0,
    complexityRejectedTotal: customMetrics.gatewayComplexityRejectedTotal || 0,
    federatedRequestCount: customMetrics.gatewayFederatedRequests || 0,
    cacheHitCount: customMetrics.gatewayCacheHitCount || 0,
    cacheMissCount: customMetrics.gatewayCacheMissCount || 0,
    cacheSize: customMetrics.gatewayCacheSize || 0,
    latencyP50: componentMetrics?.latencyP50 || 0,
    latencyP95: 0, // TODO: добавить в customMetrics
    latencyP99: componentMetrics?.latencyP99 || 0,
    averageLatency: componentMetrics?.latency || 0,
    errorRate: componentMetrics?.errorRate || 0,
    requestsPerSecond: componentMetrics?.throughput || 0,
  }), [componentMetrics, customMetrics]);

  // Список доступных GraphQL нод для выбора
  const availableGraphQLNodes = useMemo(() => {
    return nodes.filter((n) => n.type === 'graphql' && n.id !== componentId);
  }, [nodes, componentId]);

  // GraphQL ноды, которые уже подключены (есть связь)
  const connectedGraphQLNodes = useMemo(() => {
    return connections
      .filter((conn) => conn.source === componentId)
      .map((conn) => nodes.find((n) => n.id === conn.target))
      .filter((n): n is CanvasNode => n !== undefined && n.type === 'graphql');
  }, [connections, componentId, nodes]);

  // GraphQL ноды, которые доступны для подключения (еще нет связи)
  const availableForConnection = useMemo(() => {
    const connectedIds = new Set(connectedGraphQLNodes.map((n) => n.id));
    return availableGraphQLNodes.filter((n) => !connectedIds.has(n.id));
  }, [availableGraphQLNodes, connectedGraphQLNodes]);

  const updateConfig = useCallback((updates: Partial<GraphQLGatewayConfig>) => {
    const newConfig = { ...config, ...updates };
    updateNode(componentId, {
      data: {
        ...node.data,
        config: newConfig,
      },
    });

    // Синхронизация с эмуляцией (если нужно)
    try {
      // EmulationEngine автоматически подхватит изменения через updateNodesAndConnections
    } catch (error) {
      console.error('Failed to update GraphQL Gateway config:', error);
      toast({
        title: 'Update Error',
        description: 'Failed to synchronize configuration',
        variant: 'destructive',
      });
    }
  }, [componentId, node, config, updateNode, toast]);

  // Синхронизация метрик сервисов из ServiceRegistry
  useEffect(() => {
    if (!isRunning) return;

    const routingEngine = emulationEngine.getGraphQLGatewayRoutingEngine(componentId);
    if (!routingEngine) return;

    const interval = setInterval(() => {
      const serviceRegistry = routingEngine.getServiceRegistry();
      const runtimeServices = serviceRegistry.getAllServices();

      const updatedServices = services.map((svc: Service) => {
        const runtimeService = runtimeServices.find((rs) => rs.id === svc.id || rs.name === svc.name);
        if (runtimeService) {
          return {
            ...svc,
            requests: Math.floor(runtimeService.rollingLatency.length),
            errors: runtimeService.rollingErrors.length,
            status: runtimeService.status,
          };
        }
        return svc;
      });

      // Проверяем изменения перед обновлением
      const hasChanges = updatedServices.some((svc: Service, idx: number) => {
        const old = services[idx];
        return (
          svc.requests !== old?.requests ||
          svc.errors !== old?.errors ||
          svc.status !== old?.status
        );
      });

      if (hasChanges) {
        updateConfig({ services: updatedServices });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [componentId, isRunning, services, updateConfig]);


  const removeService = useCallback((id: string) => {
    const service = services.find((s) => s.id === id);
    updateConfig({ services: services.filter((s) => s.id !== id) });
    toast({
      title: 'Service Removed',
      description: service ? `Service "${service.name}" has been removed` : 'Service removed',
    });
  }, [services, updateConfig, toast]);


  // Определение статуса сервиса на основе connections
  // Сервис считается connected, если есть реальная связь к GraphQL ноде на канвасе
  const getServiceStatus = useCallback((service: Service): 'connected' | 'disconnected' | 'error' => {
    if (service.status === 'error') {
      return 'error';
    }

    // Проверяем, есть ли связь от gateway к GraphQL ноде, которая соответствует этому сервису
    const hasConnection = connections.some((conn) => {
      if (conn.source !== componentId) return false;
      const targetNode = nodes.find((n) => n.id === conn.target);
      if (!targetNode || targetNode.type !== 'graphql') return false;
      
      const targetLabel = (targetNode.data as any)?.label || targetNode.id;
      // Сервис соответствует ноде, если имя совпадает или endpoint содержит id ноды
      const nameMatches = service.name === targetLabel || service.name === targetNode.id;
      const endpointMatches = service.endpoint && targetNode.id 
        ? service.endpoint.includes(targetNode.id) || service.endpoint.includes(targetLabel)
        : false;
      
      return nameMatches || endpointMatches;
    });

    return hasConnection ? 'connected' : 'disconnected';
  }, [connections, componentId, nodes]);

  // Найти GraphQL ноду, соответствующую сервису
  const findNodeForService = useCallback((service: Service): CanvasNode | undefined => {
    return nodes.find((n) => {
      if (n.type !== 'graphql') return false;
      const targetLabel = (n.data as any)?.label || n.id;
      const nameMatches = service.name === targetLabel || service.name === n.id;
      const endpointMatches = service.endpoint && n.id 
        ? service.endpoint.includes(n.id) || service.endpoint.includes(targetLabel)
        : false;
      return nameMatches || endpointMatches;
    });
  }, [nodes]);

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

  const cacheHitRate = gatewayMetrics.cacheHitCount + gatewayMetrics.cacheMissCount > 0
    ? (gatewayMetrics.cacheHitCount / (gatewayMetrics.cacheHitCount + gatewayMetrics.cacheMissCount) * 100).toFixed(1)
    : '0';

  const connectedServicesCount = services.filter((s) => getServiceStatus(s) === 'connected').length;

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

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Services</CardTitle>
                <Network className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{services.length}</span>
                <span className="text-xs text-muted-foreground">
                  {connectedServicesCount} connected
                </span>
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
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {gatewayMetrics.requestsTotal.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">
                  {gatewayMetrics.requestsPerSecond.toFixed(1)}/s
                </span>
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
                <span className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {gatewayMetrics.errorsTotal}
                </span>
                <span className="text-xs text-muted-foreground">
                  {(gatewayMetrics.errorRate * 100).toFixed(1)}%
                </span>
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
                {federation.enabled && (
                  <span className="text-xs text-muted-foreground">
                    {gatewayMetrics.federatedRequestCount} requests
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="services">
              <Network className="h-4 w-4 mr-2" />
              Services ({services.length})
            </TabsTrigger>
            <TabsTrigger value="federation">
              <Globe className="h-4 w-4 mr-2" />
              Federation
            </TabsTrigger>
            <TabsTrigger value="performance">
              <Zap className="h-4 w-4 mr-2" />
              Performance & Cache
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="h-4 w-4 mr-2" />
              Security & Limits
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Gateway Status</CardTitle>
                  <CardDescription>Current gateway configuration and status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Endpoint</Label>
                    <div className="font-mono text-sm bg-muted p-2 rounded">{endpoint}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Federation</Label>
                    <Badge variant={federation.enabled ? 'default' : 'secondary'}>
                      {federation.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Connected Services</Label>
                    <Badge variant="outline">{connectedServicesCount} / {services.length}</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                  <CardDescription>Real-time gateway performance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Average Latency</span>
                      <span className="font-semibold">{gatewayMetrics.averageLatency.toFixed(1)}ms</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">P50 Latency</span>
                      <span className="font-semibold">{gatewayMetrics.latencyP50.toFixed(1)}ms</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">P99 Latency</span>
                      <span className="font-semibold">{gatewayMetrics.latencyP99.toFixed(1)}ms</span>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Error Rate</span>
                      <span className="font-semibold text-red-500">
                        {(gatewayMetrics.errorRate * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Requests/sec</span>
                      <span className="font-semibold">{gatewayMetrics.requestsPerSecond.toFixed(1)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>GraphQL Backend Services</CardTitle>
                    <CardDescription>
                      Services are automatically registered when you connect GraphQL Gateway to GraphQL nodes on the canvas
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {services.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="font-medium mb-2">No services connected</p>
                      <p className="text-sm mb-4">
                        To connect a service, create a connection from this GraphQL Gateway to a GraphQL node on the canvas
                      </p>
                      {availableGraphQLNodes.length > 0 && (
                        <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                          <p className="text-sm font-medium mb-2">Available GraphQL nodes:</p>
                          <div className="flex flex-wrap gap-2 justify-center">
                            {availableGraphQLNodes.map((n) => (
                              <Badge key={n.id} variant="outline">
                                {(n.data as any)?.label || n.id}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    services.map((service) => {
                      const serviceStatus = getServiceStatus(service);
                      const correspondingNode = findNodeForService(service);
                      
                      return (
                        <Card key={service.id} className={`border-l-4 hover:shadow-md transition-shadow bg-card ${
                          serviceStatus === 'connected' ? 'border-l-green-500' :
                          serviceStatus === 'error' ? 'border-l-red-500' : 'border-l-muted'
                        }`}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                <div className={`p-2 rounded-lg ${
                                  serviceStatus === 'connected' ? 'bg-green-500/20' :
                                  serviceStatus === 'error' ? 'bg-red-500/20' : 'bg-muted/20'
                                }`}>
                                  <Network className={`h-5 w-5 ${
                                    serviceStatus === 'connected' ? 'text-green-600' :
                                    serviceStatus === 'error' ? 'text-red-600' : 'text-muted-foreground'
                                  }`} />
                                </div>
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <CardTitle className="text-lg font-semibold">
                                      {service.name}
                                    </CardTitle>
                                    <Badge variant="outline" className={`${getStatusBadgeColor(serviceStatus)} border-0`}>
                                      {serviceStatus}
                                    </Badge>
                                    {correspondingNode && (
                                      <Badge variant="outline" className="text-xs">
                                        {(correspondingNode.data as any)?.label || correspondingNode.id}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge 
                                      variant="outline" 
                                      className="font-mono text-xs"
                                    >
                                      {service.endpoint}
                                    </Badge>
                                    {serviceStatus === 'disconnected' && (
                                      <span className="text-xs text-muted-foreground">
                                        Connect on canvas to activate
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeService(service.id)}
                                className="hover:bg-destructive/10 hover:text-destructive"
                                title="Remove service (disconnect on canvas to remove automatically)"
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
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Available GraphQL Nodes Section */}
            {availableForConnection.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Available GraphQL Nodes</CardTitle>
                  <CardDescription>
                    Connect these nodes on the canvas to add them as services
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {availableForConnection.map((node) => {
                      const nodeLabel = (node.data as any)?.label || node.id;
                      return (
                        <div
                          key={node.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Network className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{nodeLabel}</span>
                            <Badge variant="outline" className="text-xs">
                              {node.id}
                            </Badge>
                          </div>
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Not connected
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      <strong>Tip:</strong> To connect a service, drag a connection from this GraphQL Gateway node to a GraphQL node on the canvas. The service will be automatically registered.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Federation Tab */}
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
                    onCheckedChange={(checked) => {
                      updateConfig({ 
                        federation: { 
                          ...federation, 
                          enabled: checked,
                          version: checked ? (federation.version || '2') : undefined,
                        } 
                      });
                      toast({
                        title: checked ? 'Federation Enabled' : 'Federation Disabled',
                        description: checked 
                          ? 'Federation has been enabled' 
                          : 'Federation has been disabled',
                      });
                    }}
                  />
                </div>
                {federation.enabled && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label>Federation Version</Label>
                      <Select
                        value={federation.version || '2'}
                        onValueChange={(value: '1' | '2') => {
                          updateConfig({ 
                            federation: { ...federation, version: value } 
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Federation v1</SelectItem>
                          <SelectItem value="2">Federation v2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Federated Services</Label>
                      <div className="flex flex-wrap gap-2">
                        {federation.services.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No federated services configured</p>
                        ) : (
                          federation.services.map((svc, idx) => (
                            <Badge key={idx} variant="outline" className="flex items-center gap-1">
                              {svc}
                              <button
                                onClick={() => {
                                  const updated = federation.services.filter((_, i) => i !== idx);
                                  updateConfig({ federation: { ...federation, services: updated } });
                                  toast({
                                    title: 'Service Removed',
                                    description: `Service "${svc}" removed from federation`,
                                  });
                                }}
                                className="ml-1 hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))
                        )}
                      </div>
                      <Select
                        value=""
                        onValueChange={(value) => {
                          if (value && !federation.services.includes(value)) {
                            updateConfig({ 
                              federation: { 
                                ...federation, 
                                services: [...federation.services, value] 
                              } 
                            });
                            toast({
                              title: 'Service Added',
                              description: `Service "${value}" added to federation`,
                            });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Add service to federation" />
                        </SelectTrigger>
                        <SelectContent>
                          {services
                            .filter((s) => !federation.services.includes(s.name))
                            .map((s) => (
                              <SelectItem key={s.id} value={s.name}>
                                {s.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {federation.supergraph && (
                      <div className="space-y-2">
                        <Label>Supergraph Schema</Label>
                        <div className="p-3 bg-muted rounded text-xs font-mono overflow-x-auto max-h-48">
                          {federation.supergraph}
                        </div>
                      </div>
                    )}
                    {federation.compositionStatus && (
                      <div className="space-y-2">
                        <Label>Composition Status</Label>
                        <Badge 
                          variant={
                            federation.compositionStatus === 'ok' ? 'default' :
                            federation.compositionStatus === 'error' ? 'destructive' : 'secondary'
                          }
                        >
                          {federation.compositionStatus}
                        </Badge>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance & Cache Tab */}
          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance & Cache</CardTitle>
                <CardDescription>Cache configuration and performance metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Cache TTL (seconds)</Label>
                  <Input 
                    type="number" 
                    value={config.cacheTtl || 0}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      if (value < 0) {
                        toast({
                          title: 'Validation Error',
                          description: 'Cache TTL must be non-negative',
                          variant: 'destructive',
                        });
                        return;
                      }
                      updateConfig({ cacheTtl: value });
                    }}
                    min={0}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Persist Queries</Label>
                  <Switch 
                    checked={config.persistQueries ?? false}
                    onCheckedChange={(checked) => updateConfig({ persistQueries: checked })}
                  />
                </div>
                <Separator />
                <div className="space-y-4">
                  <div>
                    <Label>Cache Metrics</Label>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <div className="text-sm text-muted-foreground">Cache Hits</div>
                        <div className="text-2xl font-bold">{gatewayMetrics.cacheHitCount}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Cache Misses</div>
                        <div className="text-2xl font-bold">{gatewayMetrics.cacheMissCount}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Hit Rate</div>
                        <div className="text-2xl font-bold">{cacheHitRate}%</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Cache Size</div>
                        <div className="text-2xl font-bold">{gatewayMetrics.cacheSize}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security & Limits Tab */}
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Security & Limits</CardTitle>
                <CardDescription>Gateway security and rate limiting configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 15;
                      if (value < 1 || value > 50) {
                        toast({
                          title: 'Validation Error',
                          description: 'Max query depth must be between 1 and 50',
                          variant: 'destructive',
                        });
                        return;
                      }
                      updateConfig({ maxQueryDepth: value });
                    }}
                    min={1} 
                    max={50} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Query Complexity</Label>
                  <Input 
                    type="number" 
                    value={config.maxQueryComplexity ?? 1000}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1000;
                      if (value < 1) {
                        toast({
                          title: 'Validation Error',
                          description: 'Max query complexity must be positive',
                          variant: 'destructive',
                        });
                        return;
                      }
                      updateConfig({ maxQueryComplexity: value });
                    }}
                    min={1} 
                  />
                </div>
                {config.enableRateLimiting && (
                  <div className="space-y-2">
                    <Label>Global Rate Limit (requests/minute)</Label>
                    <Input 
                      type="number" 
                      value={config.globalRateLimitPerMinute || 100}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 100;
                        if (value < 1) {
                          toast({
                            title: 'Validation Error',
                            description: 'Rate limit must be positive',
                            variant: 'destructive',
                          });
                          return;
                        }
                        updateConfig({ globalRateLimitPerMinute: value });
                      }}
                      min={1} 
                    />
                  </div>
                )}
                <Separator />
                <div className="space-y-2">
                  <Label>Rate Limited Requests</Label>
                  <div className="text-2xl font-bold">{gatewayMetrics.rateLimitedTotal}</div>
                </div>
                <div className="space-y-2">
                  <Label>Complexity Rejected Requests</Label>
                  <div className="text-2xl font-bold">{gatewayMetrics.complexityRejectedTotal}</div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

    </div>
  );
}

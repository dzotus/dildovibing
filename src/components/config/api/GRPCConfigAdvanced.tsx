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
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState, useEffect, useCallback } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Play,
  Code,
  FileText,
  CheckCircle,
  XCircle,
  Zap,
  Network,
  Server,
  Edit,
  Loader2
} from 'lucide-react';
import { showSuccess, showError, showValidationError } from '@/utils/toast';

interface GRPCConfigProps {
  componentId: string;
}

interface Service {
  name: string;
  methods: Array<{
    name: string;
    inputType: string;
    outputType: string;
    streaming?: 'unary' | 'client-streaming' | 'server-streaming' | 'bidirectional';
    enabled?: boolean;
    timeout?: number;
    rateLimit?: number;
    retryPolicy?: {
      maxAttempts?: number;
      initialBackoff?: number;
      maxBackoff?: number;
      backoffMultiplier?: number;
    };
  }>;
  enabled?: boolean;
}

interface Call {
  id: string;
  service: string;
  method: string;
  request?: string;
  response?: string;
  status: 'success' | 'error';
  timestamp: string;
  duration?: number;
}

interface GRPCConfig {
  services?: Service[];
  calls?: Call[];
  endpoint?: string;
  reflectionEnabled?: boolean;
  enableTLS?: boolean;
  enableCompression?: boolean;
  maxMessageSize?: number;
  keepAliveTime?: number;
  keepAliveTimeout?: number;
  maxConnectionIdle?: number;
  maxConnectionAge?: number;
  maxConnectionAgeGrace?: number;
  authentication?: {
    type: 'none' | 'tls' | 'mtls' | 'jwt' | 'apiKey';
    token?: string;
    apiKey?: string;
  };
  rateLimit?: {
    enabled: boolean;
    requestsPerSecond?: number;
    burst?: number;
  };
  loadBalancing?: {
    policy: 'round_robin' | 'pick_first' | 'least_request';
    enabled: boolean;
  };
  totalCalls?: number;
  successRate?: number;
  averageLatency?: number;
}

export function GRPCConfigAdvanced({ componentId }: GRPCConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const componentMetrics = useEmulationStore((state) => state.componentMetrics.get(componentId));
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as GRPCConfig;
  const services = config.services || [];
  const calls = config.calls || [];
  const endpoint = config.endpoint || 'localhost:50051';
  const reflectionEnabled = config.reflectionEnabled ?? true;

  // Get metrics from emulation engine
  const routingEngine = emulationEngine.getGRPCRoutingEngine(componentId);
  const [methodStats, setMethodStats] = useState<Record<string, any>>({});
  const [connectionState, setConnectionState] = useState<any>(null);

  useEffect(() => {
    if (routingEngine) {
      const stats = routingEngine.getStats();
      const allMethodStats = routingEngine.getAllMethodStats();
      const connState = routingEngine.getConnectionState();
      
      setMethodStats(allMethodStats);
      setConnectionState(connState);
    }
  }, [routingEngine, componentMetrics]);

  // Calculate metrics from emulation or fallback to config
  const totalCalls = componentMetrics?.customMetrics?.total_requests || config.totalCalls || calls.length || 0;
  const successRate = componentMetrics?.customMetrics?.total_requests 
    ? ((componentMetrics.customMetrics.total_requests - (componentMetrics.customMetrics.total_errors || 0)) / componentMetrics.customMetrics.total_requests) * 100
    : (calls.length > 0 ? (calls.filter((c) => c.status === 'success').length / calls.length) * 100 : 0);
  const averageLatency = componentMetrics?.latency || config.averageLatency || (calls.length > 0 ? calls.reduce((sum, c) => sum + (c.duration || 0), 0) / calls.length : 0);

  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [requestText, setRequestText] = useState('{}');
  const [responseText, setResponseText] = useState('');
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingMethod, setEditingMethod] = useState<{ service: Service; method: Service['methods'][0]; methodIndex: number } | null>(null);
  const [deletingService, setDeletingService] = useState<string | null>(null);
  const [deletingMethod, setDeletingMethod] = useState<{ serviceName: string; methodName: string } | null>(null);

  const updateConfig = useCallback((updates: Partial<GRPCConfig>) => {
    const newConfig = { ...config, ...updates };
    updateNode(componentId, {
      data: {
        ...node.data,
        config: newConfig,
      },
    });
    
    // Immediately update emulation engine to reflect changes
    const updatedNode = { ...node, data: { ...node.data, config: newConfig } };
    emulationEngine.updateNodesAndConnections([updatedNode], []);
  }, [componentId, node, config, updateNode]);

  const executeCall = () => {
    if (!selectedService || !selectedMethod) return;
    const newCall: Call = {
      id: `call-${Date.now()}`,
      service: selectedService,
      method: selectedMethod,
      request: requestText,
      response: JSON.stringify({ success: true, data: {} }, null, 2),
      status: 'success',
      timestamp: new Date().toISOString(),
      duration: Math.floor(Math.random() * 50) + 10,
    };
    setResponseText(newCall.response);
    updateConfig({ calls: [...calls, newCall] });
  };

  const addService = () => {
    setEditingService({
      name: '',
      methods: [],
      enabled: true,
    });
  };

  const editService = (service: Service) => {
    setEditingService({ ...service });
  };

  const saveService = () => {
    if (!editingService) return;
    
    if (!editingService.name || editingService.name.trim() === '') {
      showValidationError('Service name is required');
      return;
    }

    const existingIndex = services.findIndex(s => s.name === editingService.name);
    if (existingIndex >= 0 && services[existingIndex] !== editingService) {
      // Update existing
      const updated = services.map((s, i) => i === existingIndex ? editingService : s);
      updateConfig({ services: updated });
      showSuccess(`Service "${editingService.name}" updated`);
    } else if (existingIndex < 0) {
      // Add new
      updateConfig({ services: [...services, editingService] });
      showSuccess(`Service "${editingService.name}" added`);
    }
    
    setEditingService(null);
  };

  const deleteService = (serviceName: string) => {
    updateConfig({ services: services.filter(s => s.name !== serviceName) });
    showSuccess(`Service "${serviceName}" deleted`);
    setDeletingService(null);
  };

  const addMethod = (service: Service) => {
    setEditingMethod({
      service,
      method: {
        name: '',
        inputType: 'google.protobuf.Empty',
        outputType: 'google.protobuf.Empty',
        streaming: 'unary',
        enabled: true,
      },
      methodIndex: -1,
    });
  };

  const editMethod = (service: Service, method: Service['methods'][0], methodIndex: number) => {
    setEditingMethod({
      service,
      method: { ...method },
      methodIndex,
    });
  };

  const saveMethod = () => {
    if (!editingMethod) return;
    
    if (!editingMethod.method.name || editingMethod.method.name.trim() === '') {
      showValidationError('Method name is required');
      return;
    }

    const serviceIndex = services.findIndex(s => s.name === editingMethod.service.name);
    if (serviceIndex < 0) return;

    const service = services[serviceIndex];
    const updatedMethods = [...service.methods];
    
    if (editingMethod.methodIndex >= 0) {
      // Update existing
      updatedMethods[editingMethod.methodIndex] = editingMethod.method;
    } else {
      // Add new
      updatedMethods.push(editingMethod.method);
    }

    const updatedServices = services.map((s, i) => 
      i === serviceIndex ? { ...s, methods: updatedMethods } : s
    );
    
    updateConfig({ services: updatedServices });
    showSuccess(`Method "${editingMethod.method.name}" ${editingMethod.methodIndex >= 0 ? 'updated' : 'added'}`);
    setEditingMethod(null);
  };

  const deleteMethod = (serviceName: string, methodName: string) => {
    const serviceIndex = services.findIndex(s => s.name === serviceName);
    if (serviceIndex < 0) return;

    const service = services[serviceIndex];
    const updatedMethods = service.methods.filter(m => m.name !== methodName);
    const updatedServices = services.map((s, i) => 
      i === serviceIndex ? { ...s, methods: updatedMethods } : s
    );
    
    updateConfig({ services: updatedServices });
    showSuccess(`Method "${methodName}" deleted`);
    setDeletingMethod(null);
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">gRPC</p>
            <h2 className="text-2xl font-bold text-foreground">gRPC Service</h2>
            <p className="text-sm text-muted-foreground mt-1">
              High-performance RPC framework
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Services</CardTitle>
                <Server className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {routingEngine ? (routingEngine.getStats().enabledServices || services.length) : services.length}
                </span>
                <span className="text-xs text-muted-foreground">registered</span>
              </div>
              {routingEngine && (
                <div className="text-xs text-muted-foreground mt-1">
                  {routingEngine.getStats().totalMethods} methods
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Calls</CardTitle>
                <Activity className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalCalls}</span>
                <span className="text-xs text-muted-foreground">total</span>
              </div>
              {componentMetrics?.throughput && (
                <div className="text-xs text-muted-foreground mt-1">
                  {componentMetrics.throughput.toFixed(1)} req/s
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{successRate.toFixed(1)}%</span>
              </div>
              {componentMetrics?.errorRate !== undefined && (
                <div className="text-xs text-muted-foreground mt-1">
                  Error rate: {(componentMetrics.errorRate * 100).toFixed(2)}%
                </div>
              )}
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
              {componentMetrics?.latencyP99 && (
                <div className="text-xs text-muted-foreground mt-1">
                  P99: {componentMetrics.latencyP99.toFixed(0)}ms
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="test" className="space-y-4">
          <TabsList className="flex-wrap gap-1 w-full justify-start">
            <TabsTrigger value="test" className="flex-shrink-0">
              <Play className="h-4 w-4 mr-2" />
              Test Client
            </TabsTrigger>
            <TabsTrigger value="services" className="flex-shrink-0">
              <Server className="h-4 w-4 mr-2" />
              Services ({services.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-shrink-0">
              <Activity className="h-4 w-4 mr-2" />
              Call History ({calls.length})
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-shrink-0">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="test" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>gRPC Test Client</CardTitle>
                <CardDescription>Test gRPC methods and services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {services.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 rounded-full bg-muted">
                        <Play className="h-12 w-12 text-muted-foreground" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold">No Services Available</h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                          To test gRPC methods, you need to register at least one service with methods. 
                          Go to the Services tab to add your first service and methods.
                        </p>
                      </div>
                      <Button onClick={addService} className="mt-4">
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Service
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Service</Label>
                        <Select value={selectedService} onValueChange={(value) => {
                          setSelectedService(value);
                          const service = services.find((s) => s.name === value);
                          if (service && service.methods.length > 0) {
                            setSelectedMethod(service.methods[0].name);
                          } else {
                            setSelectedMethod('');
                          }
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select service" />
                          </SelectTrigger>
                          <SelectContent>
                            {services.filter(s => s.enabled !== false).map((s) => (
                              <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Method</Label>
                        <Select value={selectedMethod} onValueChange={setSelectedMethod} disabled={!selectedService}>
                          <SelectTrigger>
                            <SelectValue placeholder={selectedService ? "Select method" : "Select service first"} />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedService && services.find((s) => s.name === selectedService)?.methods
                              .filter(m => m.enabled !== false)
                              .map((m) => (
                                <SelectItem key={m.name} value={m.name}>
                                  {m.name} ({m.streaming || 'unary'})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {selectedService && services.find((s) => s.name === selectedService)?.methods.length === 0 && (
                      <div className="p-4 border border-yellow-200 dark:border-yellow-800 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          The selected service "{selectedService}" has no methods. Add methods in the Services tab.
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Request (JSON)</Label>
                        <Textarea
                          value={requestText}
                          onChange={(e) => setRequestText(e.target.value)}
                          className="font-mono text-sm min-h-[200px]"
                          placeholder='{ "id": "1" }'
                          disabled={!selectedService || !selectedMethod}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Response</Label>
                        <Textarea
                          value={responseText}
                          readOnly
                          className="font-mono text-sm min-h-[200px] bg-muted"
                          placeholder="Response will appear here..."
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={executeCall} disabled={!selectedService || !selectedMethod}>
                        <Play className="h-4 w-4 mr-2" />
                        Execute Call
                      </Button>
                      <Button variant="outline" onClick={() => { setRequestText('{}'); setResponseText(''); }}>
                        Clear
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Services</CardTitle>
                    <CardDescription>Registered gRPC services and methods</CardDescription>
                  </div>
                  <Button onClick={addService} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Service
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {services.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No services registered</p>
                      <Button onClick={addService} variant="outline" size="sm" className="mt-4">
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Service
                      </Button>
                    </div>
                  ) : (
                    services.map((service) => {
                      const serviceStats = routingEngine?.getStats();
                      const serviceMethodCount = service.methods.length;
                      const enabledMethodCount = service.methods.filter(m => m.enabled !== false).length;
                      
                      return (
                        <Card key={service.name} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                  <Server className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <CardTitle className="text-lg font-semibold">{service.name}</CardTitle>
                                    {service.enabled === false && (
                                      <Badge variant="secondary" className="text-xs">Disabled</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="outline" className="text-xs">
                                      {enabledMethodCount}/{serviceMethodCount} methods
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => editService(service)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeletingService(service.name)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {service.methods.length === 0 ? (
                                <div className="text-center py-4 text-muted-foreground text-sm">
                                  No methods in this service
                                </div>
                              ) : (
                                service.methods.map((method, methodIndex) => {
                                  const methodKey = `${service.name}.${method.name}`;
                                  const stats = methodStats[methodKey];
                                  
                                  return (
                                    <div key={method.name} className="p-3 border rounded">
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <span className="font-mono font-semibold">{method.name}</span>
                                            <Badge variant="outline" className="text-xs">{method.streaming || 'unary'}</Badge>
                                            {method.enabled === false && (
                                              <Badge variant="secondary" className="text-xs">Disabled</Badge>
                                            )}
                                            {stats && (
                                              <Badge variant="outline" className="text-xs">
                                                {stats.requestCount} calls
                                              </Badge>
                                            )}
                                          </div>
                                          <div className="text-xs text-muted-foreground mt-1">
                                            <span className="font-mono">{method.inputType}</span>
                                            <span className="mx-2">→</span>
                                            <span className="font-mono">{method.outputType}</span>
                                          </div>
                                          {stats && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                              Avg latency: {stats.averageLatency.toFixed(0)}ms | 
                                              Errors: {stats.errorCount}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex gap-2">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => editMethod(service, method, methodIndex)}
                                          >
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setDeletingMethod({ serviceName: service.name, methodName: method.name })}
                                          >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full mt-2"
                                onClick={() => addMethod(service)}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Method
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Call History</CardTitle>
                <CardDescription>Previously executed gRPC calls</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {calls.map((call) => (
                    <Card key={call.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${call.status === 'success' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                              {call.status === 'success' ? (
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                              )}
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{call.service}.{call.method}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                {call.duration && (
                                  <Badge variant="outline">{call.duration}ms</Badge>
                                )}
                                <Badge variant={call.status === 'success' ? 'default' : 'destructive'}>
                                  {call.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          {call.request && (
                            <div className="space-y-2">
                              <Label>Request</Label>
                              <pre className="p-3 bg-muted rounded text-xs font-mono overflow-x-auto">{call.request}</pre>
                            </div>
                          )}
                          {call.response && (
                            <div className="space-y-2">
                              <Label>Response</Label>
                              <pre className="p-3 bg-muted rounded text-xs font-mono overflow-x-auto">{call.response}</pre>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          {new Date(call.timestamp).toLocaleString()}
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
                <CardTitle>gRPC Settings</CardTitle>
                <CardDescription>Service configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Endpoint</Label>
                  <Input
                    value={endpoint}
                    onChange={(e) => updateConfig({ endpoint: e.target.value })}
                    placeholder="localhost:50051"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Enable Reflection</Label>
                  <Switch
                    checked={reflectionEnabled}
                    onCheckedChange={(checked) => updateConfig({ reflectionEnabled: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable TLS</Label>
                  <Switch 
                    checked={config.enableTLS ?? false}
                    onCheckedChange={(checked) => updateConfig({ enableTLS: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Compression</Label>
                  <Switch 
                    checked={config.enableCompression ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableCompression: checked })}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Max Message Size (MB)</Label>
                  <Input 
                    type="number" 
                    value={config.maxMessageSize ?? 4}
                    onChange={(e) => updateConfig({ maxMessageSize: parseInt(e.target.value) || 4 })}
                    min={1} 
                    max={100} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Keep Alive Time (seconds)</Label>
                  <Input 
                    type="number" 
                    value={config.keepAliveTime ?? 30}
                    onChange={(e) => updateConfig({ keepAliveTime: parseInt(e.target.value) || 30 })}
                    min={1} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Keep Alive Timeout (seconds)</Label>
                  <Input 
                    type="number" 
                    value={config.keepAliveTimeout ?? 5}
                    onChange={(e) => updateConfig({ keepAliveTimeout: parseInt(e.target.value) || 5 })}
                    min={1} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Connection Idle (seconds)</Label>
                  <Input 
                    type="number" 
                    value={config.maxConnectionIdle ?? 300}
                    onChange={(e) => updateConfig({ maxConnectionIdle: parseInt(e.target.value) || 300 })}
                    min={1} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Connection Age (seconds)</Label>
                  <Input 
                    type="number" 
                    value={config.maxConnectionAge ?? 3600}
                    onChange={(e) => updateConfig({ maxConnectionAge: parseInt(e.target.value) || 3600 })}
                    min={1} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Connection Age Grace (seconds)</Label>
                  <Input 
                    type="number" 
                    value={config.maxConnectionAgeGrace ?? 5}
                    onChange={(e) => updateConfig({ maxConnectionAgeGrace: parseInt(e.target.value) || 5 })}
                    min={1} 
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Authentication Type</Label>
                  <Select
                    value={config.authentication?.type || 'none'}
                    onValueChange={(value: any) => updateConfig({ authentication: { ...config.authentication, type: value } })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="tls">TLS</SelectItem>
                      <SelectItem value="mtls">mTLS</SelectItem>
                      <SelectItem value="jwt">JWT</SelectItem>
                      <SelectItem value="apiKey">API Key</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(config.authentication?.type === 'jwt' || config.authentication?.type === 'apiKey') && (
                  <div className="space-y-2">
                    <Label>{config.authentication.type === 'jwt' ? 'JWT Token' : 'API Key'}</Label>
                    <Input
                      type="password"
                      value={config.authentication.token || config.authentication.apiKey || ''}
                      onChange={(e) => updateConfig({ 
                        authentication: { 
                          ...config.authentication, 
                          [config.authentication?.type === 'jwt' ? 'token' : 'apiKey']: e.target.value 
                        } 
                      })}
                      placeholder={config.authentication.type === 'jwt' ? 'Bearer token' : 'API key'}
                    />
                  </div>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Enable Rate Limiting</Label>
                  <Switch
                    checked={config.rateLimit?.enabled ?? false}
                    onCheckedChange={(checked) => updateConfig({ 
                      rateLimit: { 
                        ...config.rateLimit, 
                        enabled: checked,
                        requestsPerSecond: config.rateLimit?.requestsPerSecond || 1000,
                        burst: config.rateLimit?.burst || 100,
                      } 
                    })}
                  />
                </div>
                {config.rateLimit?.enabled && (
                  <>
                    <div className="space-y-2">
                      <Label>Requests Per Second</Label>
                      <Input
                        type="number"
                        value={config.rateLimit.requestsPerSecond || 1000}
                        onChange={(e) => updateConfig({ 
                          rateLimit: { 
                            ...config.rateLimit, 
                            requestsPerSecond: parseInt(e.target.value) || 1000 
                          } 
                        })}
                        min={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Burst</Label>
                      <Input
                        type="number"
                        value={config.rateLimit.burst || 100}
                        onChange={(e) => updateConfig({ 
                          rateLimit: { 
                            ...config.rateLimit, 
                            burst: parseInt(e.target.value) || 100 
                          } 
                        })}
                        min={1}
                      />
                    </div>
                  </>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Enable Load Balancing</Label>
                  <Switch
                    checked={config.loadBalancing?.enabled ?? false}
                    onCheckedChange={(checked) => updateConfig({ 
                      loadBalancing: { 
                        ...config.loadBalancing, 
                        enabled: checked,
                        policy: config.loadBalancing?.policy || 'round_robin',
                      } 
                    })}
                  />
                </div>
                {config.loadBalancing?.enabled && (
                  <div className="space-y-2">
                    <Label>Load Balancing Policy</Label>
                    <Select
                      value={config.loadBalancing.policy || 'round_robin'}
                      onValueChange={(value: any) => updateConfig({ 
                        loadBalancing: { 
                          ...config.loadBalancing, 
                          policy: value 
                        } 
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="round_robin">Round Robin</SelectItem>
                        <SelectItem value="pick_first">Pick First</SelectItem>
                        <SelectItem value="least_request">Least Request</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {connectionState && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label>Connection Pool</Label>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>Active: {connectionState.activeConnections}</div>
                        <div>Idle: {connectionState.idleConnections}</div>
                        <div>Total: {connectionState.totalConnections}</div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Service Dialog */}
        <Dialog open={!!editingService} onOpenChange={(open) => !open && setEditingService(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingService?.name ? 'Edit Service' : 'Add Service'}</DialogTitle>
              <DialogDescription>
                Configure gRPC service name and methods
              </DialogDescription>
            </DialogHeader>
            {editingService && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Service Name</Label>
                  <Input
                    value={editingService.name}
                    onChange={(e) => setEditingService({ ...editingService, name: e.target.value })}
                    placeholder="com.example.Service"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enabled</Label>
                  <Switch
                    checked={editingService.enabled !== false}
                    onCheckedChange={(checked) => setEditingService({ ...editingService, enabled: checked })}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingService(null)}>Cancel</Button>
              <Button onClick={saveService}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Method Dialog */}
        <Dialog open={!!editingMethod} onOpenChange={(open) => !open && setEditingMethod(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingMethod?.methodIndex >= 0 ? 'Edit Method' : 'Add Method'}</DialogTitle>
              <DialogDescription>
                Configure gRPC method for {editingMethod?.service.name}
              </DialogDescription>
            </DialogHeader>
            {editingMethod && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Method Name</Label>
                  <Input
                    value={editingMethod.method.name}
                    onChange={(e) => setEditingMethod({ ...editingMethod, method: { ...editingMethod.method, name: e.target.value } })}
                    placeholder="GetUser"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Input Type</Label>
                    <Input
                      value={editingMethod.method.inputType}
                      onChange={(e) => setEditingMethod({ ...editingMethod, method: { ...editingMethod.method, inputType: e.target.value } })}
                      placeholder="google.protobuf.Empty"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Output Type</Label>
                    <Input
                      value={editingMethod.method.outputType}
                      onChange={(e) => setEditingMethod({ ...editingMethod, method: { ...editingMethod.method, outputType: e.target.value } })}
                      placeholder="google.protobuf.Empty"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Streaming Type</Label>
                  <Select
                    value={editingMethod.method.streaming || 'unary'}
                    onValueChange={(value: any) => setEditingMethod({ ...editingMethod, method: { ...editingMethod.method, streaming: value } })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unary">Unary</SelectItem>
                      <SelectItem value="client-streaming">Client Streaming</SelectItem>
                      <SelectItem value="server-streaming">Server Streaming</SelectItem>
                      <SelectItem value="bidirectional">Bidirectional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enabled</Label>
                  <Switch
                    checked={editingMethod.method.enabled !== false}
                    onCheckedChange={(checked) => setEditingMethod({ ...editingMethod, method: { ...editingMethod.method, enabled: checked } })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timeout (ms)</Label>
                  <Input
                    type="number"
                    value={editingMethod.method.timeout || ''}
                    onChange={(e) => setEditingMethod({ ...editingMethod, method: { ...editingMethod.method, timeout: e.target.value ? parseInt(e.target.value) : undefined } })}
                    placeholder="30000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rate Limit (requests/sec)</Label>
                  <Input
                    type="number"
                    value={editingMethod.method.rateLimit || ''}
                    onChange={(e) => setEditingMethod({ ...editingMethod, method: { ...editingMethod.method, rateLimit: e.target.value ? parseInt(e.target.value) : undefined } })}
                    placeholder="1000"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingMethod(null)}>Cancel</Button>
              <Button onClick={saveMethod}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Service Confirmation */}
        <AlertDialog open={!!deletingService} onOpenChange={(open) => !open && setDeletingService(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Service</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete service "{deletingService}"? This will also delete all methods in this service.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deletingService && deleteService(deletingService)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Method Confirmation */}
        <AlertDialog open={!!deletingMethod} onOpenChange={(open) => !open && setDeletingMethod(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Method</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete method "{deletingMethod?.methodName}" from service "{deletingMethod?.serviceName}"?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deletingMethod && deleteMethod(deletingMethod.serviceName, deletingMethod.methodName)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}


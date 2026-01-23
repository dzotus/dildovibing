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
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect, useRef } from 'react';
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
  Code,
  Edit2,
  X,
  AlertTriangle,
  Save,
  Loader2
} from 'lucide-react';
import { emulationEngine } from '@/core/EmulationEngine';
import { useToast } from '@/hooks/use-toast';
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

interface BFFServiceConfigProps {
  componentId: string;
}

interface Backend {
  id: string;
  name: string;
  endpoint: string;
  protocol: 'http' | 'grpc' | 'graphql';
  status: 'connected' | 'disconnected' | 'error';
  timeout?: number;
  retries?: number;
  retryBackoff?: 'exponential' | 'linear' | 'constant';
  circuitBreaker?: {
    enabled: boolean;
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
  };
  requests?: number;
  avgLatency?: number;
}

interface Endpoint {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  backends: string[];
  aggregator?: 'merge' | 'sequential' | 'parallel';
  cacheTtl?: number;
  timeout?: number;
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
  audience?: 'mobile' | 'web' | 'partner';
  fallbackEnabled?: boolean;
  fallbackComponent?: string;
}

export function BFFServiceConfigAdvanced({ componentId }: BFFServiceConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as BFFServiceConfig;
  const backends = config.backends || [];
  const endpoints = config.endpoints || [];
  
  // Calculate metrics dynamically
  const totalBackends = backends.length;
  const totalEndpoints = endpoints.length;
  const totalRequests = endpoints.reduce((sum, e) => sum + (e.requests || 0), 0);
  const averageLatency = backends.length > 0
    ? backends.reduce((sum, b) => sum + (b.avgLatency || 0), 0) / backends.length
    : 0;

  const [editingEndpointId, setEditingEndpointId] = useState<string | null>(null);
  const [editingBackendId, setEditingBackendId] = useState<string | null>(null);
  const [expandedEndpointId, setExpandedEndpointId] = useState<string | null>(null);
  const [expandedBackendId, setExpandedBackendId] = useState<string | null>(null);
  const [deleteEndpointId, setDeleteEndpointId] = useState<string | null>(null);
  const [deleteBackendId, setDeleteBackendId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [endpointFormData, setEndpointFormData] = useState<Record<string, Partial<Endpoint>>>({});
  const [backendFormData, setBackendFormData] = useState<Record<string, Partial<Backend & { circuitBreakerEnabled: boolean; failureThreshold: number; successThreshold: number; circuitBreakerTimeout: number }>>>({});
  const { toast } = useToast();
  const configRef = useRef(config);
  configRef.current = config;

  // Sync configuration with routing engine when config changes
  useEffect(() => {
    try {
      emulationEngine.updateBFFRoutingEngine(componentId);
    } catch (error) {
      console.error('Failed to update BFF routing engine:', error);
    }
  }, [componentId, config.backends, config.endpoints, config.enableCaching, config.enableRequestBatching, config.enableResponseCompression, config.defaultTimeout, config.maxConcurrentRequests, config.audience, config.fallbackEnabled, config.fallbackComponent]);

  // Validation functions
  const validateEndpointPath = (path: string): string | null => {
    if (!path) return 'Path is required';
    if (!path.startsWith('/')) return 'Path must start with /';
    if (path.length < 2) return 'Path must be at least 2 characters';
    return null;
  };

  const validateBackendEndpoint = (endpoint: string): string | null => {
    if (!endpoint) return 'Endpoint is required';
    try {
      new URL(endpoint);
      return null;
    } catch {
      return 'Endpoint must be a valid URL';
    }
  };

  const validateTimeout = (timeout: number): string | null => {
    if (!timeout || timeout <= 0) return 'Timeout must be a positive number';
    if (timeout > 300000) return 'Timeout must be less than 300000ms';
    return null;
  };

  const validateRetries = (retries: number): string | null => {
    if (retries < 0 || retries > 10) return 'Retries must be between 0 and 10';
    return null;
  };

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
      timeout: 5000,
      retries: 3,
      retryBackoff: 'exponential',
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000,
      },
    };
    updateConfig({ backends: [...backends, newBackend] });
    setEditingBackendId(newBackend.id);
    toast({
      title: 'Backend added',
      description: 'New backend has been added. Please configure it.',
    });
  };

  const removeBackend = (id: string) => {
    const backend = backends.find(b => b.id === id);
    if (!backend) return;
    
    setDeleteBackendId(id);
  };

  const confirmRemoveBackend = () => {
    if (!deleteBackendId) return;
    
    // Remove backend from all endpoints
    const updatedEndpoints = endpoints.map(e => ({
      ...e,
      backends: e.backends.filter(bId => bId !== deleteBackendId),
    }));
    updateConfig({ 
      backends: backends.filter((b) => b.id !== deleteBackendId),
      endpoints: updatedEndpoints,
    });
    
    toast({
      title: 'Backend removed',
      description: 'Backend has been successfully removed.',
    });
    
    setDeleteBackendId(null);
  };

  const updateBackend = (id: string, updates: Partial<Backend>) => {
    const updatedBackends = backends.map(b => 
      b.id === id ? { ...b, ...updates } : b
    );
    updateConfig({ backends: updatedBackends });
  };

  const addEndpoint = () => {
    const newEndpoint: Endpoint = {
      id: `endpoint-${Date.now()}`,
      path: '/api/new-endpoint',
      method: 'GET',
      backends: [],
      aggregator: 'merge',
      cacheTtl: 5,
      timeout: 5000,
    };
    updateConfig({ endpoints: [...endpoints, newEndpoint] });
    setEditingEndpointId(newEndpoint.id);
    toast({
      title: 'Endpoint added',
      description: 'New endpoint has been added. Please configure it.',
    });
  };

  const removeEndpoint = (id: string) => {
    setDeleteEndpointId(id);
  };

  const confirmRemoveEndpoint = () => {
    if (!deleteEndpointId) return;
    
    updateConfig({ endpoints: endpoints.filter((e) => e.id !== deleteEndpointId) });
    
    toast({
      title: 'Endpoint removed',
      description: 'Endpoint has been successfully removed.',
    });
    
    setDeleteEndpointId(null);
  };

  const updateEndpoint = (id: string, updates: Partial<Endpoint>) => {
    const updatedEndpoints = endpoints.map(e => 
      e.id === id ? { ...e, ...updates } : e
    );
    updateConfig({ endpoints: updatedEndpoints });
  };

  const handleSaveEndpoint = (endpointId: string, formData: Partial<Endpoint>) => {
    const errors: Record<string, string> = {};
    if (formData.path) {
      const pathError = validateEndpointPath(formData.path);
      if (pathError) errors.path = pathError;
    }
    if (formData.timeout !== undefined) {
      const timeoutError = validateTimeout(formData.timeout);
      if (timeoutError) errors.timeout = timeoutError;
    }
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast({
        title: 'Validation error',
        description: 'Please fix the validation errors before saving.',
        variant: 'destructive',
      });
      return;
    }
    
    updateEndpoint(endpointId, formData);
    setEditingEndpointId(null);
    setValidationErrors({});
    toast({
      title: 'Endpoint saved',
      description: 'Endpoint configuration has been saved successfully.',
    });
  };

  const handleCancelEditEndpoint = (endpointId: string) => {
    setEditingEndpointId(null);
    setValidationErrors({});
    // Remove form data for this endpoint
    const newFormData = { ...endpointFormData };
    delete newFormData[endpointId];
    setEndpointFormData(newFormData);
  };

  const handleSaveBackend = (backendId: string, formData: Partial<Backend & { circuitBreakerEnabled: boolean; failureThreshold: number; successThreshold: number; circuitBreakerTimeout: number }>) => {
    const errors: Record<string, string> = {};
    if (formData.endpoint) {
      const endpointError = validateBackendEndpoint(formData.endpoint);
      if (endpointError) errors.endpoint = endpointError;
    }
    if (formData.timeout !== undefined) {
      const timeoutError = validateTimeout(formData.timeout);
      if (timeoutError) errors.timeout = timeoutError;
    }
    if (formData.retries !== undefined) {
      const retriesError = validateRetries(formData.retries);
      if (retriesError) errors.retries = retriesError;
    }
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast({
        title: 'Validation error',
        description: 'Please fix the validation errors before saving.',
        variant: 'destructive',
      });
      return;
    }
    
    const backendData: Partial<Backend> = {
      name: formData.name,
      endpoint: formData.endpoint,
      protocol: formData.protocol,
      timeout: formData.timeout,
      retries: formData.retries,
      retryBackoff: formData.retryBackoff,
      circuitBreaker: formData.circuitBreakerEnabled ? {
        enabled: true,
        failureThreshold: formData.failureThreshold || 5,
        successThreshold: formData.successThreshold || 2,
        timeout: formData.circuitBreakerTimeout || 60000,
      } : undefined,
    };
    
    updateBackend(backendId, backendData);
    setEditingBackendId(null);
    setValidationErrors({});
    toast({
      title: 'Backend saved',
      description: 'Backend configuration has been saved successfully.',
    });
  };

  const handleCancelEditBackend = (backendId: string) => {
    setEditingBackendId(null);
    setValidationErrors({});
    // Remove form data for this backend
    const newFormData = { ...backendFormData };
    delete newFormData[backendId];
    setBackendFormData(newFormData);
  };

  const toggleBackendInEndpoint = (endpointId: string, backendId: string) => {
    const endpoint = endpoints.find(e => e.id === endpointId);
    if (!endpoint) return;
    
    const hasBackend = endpoint.backends.includes(backendId);
    const updatedBackends = hasBackend
      ? endpoint.backends.filter(id => id !== backendId)
      : [...endpoint.backends, backendId];
    
    updateEndpoint(endpointId, { backends: updatedBackends });
  };

  const handleRefresh = () => {
    // Get routing engine stats and update backend metrics
    const routingEngine = emulationEngine.getBFFRoutingEngine(componentId);
    if (routingEngine) {
      const stats = routingEngine.getStats();
      const backendStats = stats.backendStats;
      
      // Update backend metrics
      const updatedBackends = backends.map(backend => {
        const metrics = backendStats[backend.id];
        if (metrics) {
          return {
            ...backend,
            requests: metrics.requestCount,
            avgLatency: Math.round(metrics.averageLatency),
          };
        }
        return backend;
      });
      
      // Update endpoint requests from stats
      const updatedEndpoints = endpoints.map(endpoint => {
        const endpointRequests = endpoint.backends.reduce((sum, backendId) => {
          const metrics = backendStats[backendId];
          return sum + (metrics?.requestCount || 0);
        }, 0);
        return {
          ...endpoint,
          requests: endpointRequests,
        };
      });
      
      updateConfig({ 
        backends: updatedBackends,
        endpoints: updatedEndpoints,
      });
    }
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
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh Metrics
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
          <TabsList className="flex-wrap">
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
                  {endpoints.map((endpoint) => {
                    const isEditing = editingEndpointId === endpoint.id;
                    const formData = endpointFormData[endpoint.id] || {
                      path: endpoint.path,
                      method: endpoint.method,
                      aggregator: endpoint.aggregator || 'merge',
                      cacheTtl: endpoint.cacheTtl || 5,
                      timeout: endpoint.timeout || 5000,
                      backends: endpoint.backends || [],
                    };

                    const updateFormData = (updates: Partial<Endpoint>) => {
                      setEndpointFormData({
                        ...endpointFormData,
                        [endpoint.id]: { ...formData, ...updates },
                      });
                    };

                    return (
                      <Card key={endpoint.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-card">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            {isEditing ? (
                              <div className="flex-1 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Path</Label>
                                    <Input
                                      value={formData.path || ''}
                                      onChange={(e) => updateFormData({ path: e.target.value })}
                                      placeholder="/api/endpoint"
                                    />
                                    {validationErrors.path && (
                                      <p className="text-xs text-destructive">{validationErrors.path}</p>
                                    )}
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Method</Label>
                                    <Select 
                                      value={formData.method || 'GET'} 
                                      onValueChange={(value: any) => updateFormData({ method: value })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="GET">GET</SelectItem>
                                        <SelectItem value="POST">POST</SelectItem>
                                        <SelectItem value="PUT">PUT</SelectItem>
                                        <SelectItem value="DELETE">DELETE</SelectItem>
                                        <SelectItem value="PATCH">PATCH</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Aggregator</Label>
                                    <Select 
                                      value={formData.aggregator || 'merge'} 
                                      onValueChange={(value: any) => updateFormData({ aggregator: value })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="merge">Merge</SelectItem>
                                        <SelectItem value="parallel">Parallel</SelectItem>
                                        <SelectItem value="sequential">Sequential</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Cache TTL (seconds)</Label>
                                    <Input
                                      type="number"
                                      value={formData.cacheTtl || 5}
                                      onChange={(e) => updateFormData({ cacheTtl: parseInt(e.target.value) || 5 })}
                                      min={0}
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label>Timeout (ms)</Label>
                                    <Input
                                      type="number"
                                      value={formData.timeout || 5000}
                                      onChange={(e) => updateFormData({ timeout: parseInt(e.target.value) || 5000 })}
                                      min={1}
                                    />
                                  {validationErrors.timeout && (
                                    <p className="text-xs text-destructive">{validationErrors.timeout}</p>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <Label>Backends</Label>
                                  <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-4">
                                    {backends.length === 0 ? (
                                      <p className="text-sm text-muted-foreground">No backends available</p>
                                    ) : (
                                      backends.map((backend) => (
                                        <div key={backend.id} className="flex items-center space-x-2">
                                          <Checkbox
                                            checked={(formData.backends || []).includes(backend.id)}
                                            onCheckedChange={(checked) => {
                                              const currentBackends = formData.backends || [];
                                              if (checked) {
                                                updateFormData({
                                                  backends: [...currentBackends, backend.id],
                                                });
                                              } else {
                                                updateFormData({
                                                  backends: currentBackends.filter(id => id !== backend.id),
                                                });
                                              }
                                            }}
                                          />
                                          <Label className="flex-1 cursor-pointer">
                                            {backend.name} ({backend.protocol.toUpperCase()})
                                          </Label>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>
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
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingEndpointId(endpoint.id);
                                      // Initialize form data
                                      setEndpointFormData({
                                        ...endpointFormData,
                                        [endpoint.id]: {
                                          path: endpoint.path,
                                          method: endpoint.method,
                                          aggregator: endpoint.aggregator || 'merge',
                                          cacheTtl: endpoint.cacheTtl || 5,
                                          timeout: endpoint.timeout || 5000,
                                          backends: endpoint.backends || [],
                                        },
                                      });
                                    }}
                                    className="hover:bg-primary/10 hover:text-primary"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeEndpoint(endpoint.id)}
                                    className="hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        </CardHeader>
                        {isEditing && (
                          <CardContent>
                            <div className="flex justify-end gap-2 pt-4 border-t">
                              <Button variant="outline" onClick={() => handleCancelEditEndpoint(endpoint.id)}>
                                Cancel
                              </Button>
                              <Button onClick={() => handleSaveEndpoint(endpoint.id, formData)}>
                                <Save className="h-4 w-4 mr-2" />
                                Save
                              </Button>
                            </div>
                          </CardContent>
                        )}
                        {!isEditing && (
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
                        )}
                      </Card>
                    );
                  })}
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
                  {backends.map((backend) => {
                    const isEditing = editingBackendId === backend.id;
                    const formData = backendFormData[backend.id] || {
                      name: backend.name,
                      endpoint: backend.endpoint,
                      protocol: backend.protocol,
                      timeout: backend.timeout || 5000,
                      retries: backend.retries || 3,
                      retryBackoff: backend.retryBackoff || 'exponential',
                      circuitBreakerEnabled: backend.circuitBreaker?.enabled ?? true,
                      failureThreshold: backend.circuitBreaker?.failureThreshold || 5,
                      successThreshold: backend.circuitBreaker?.successThreshold || 2,
                      circuitBreakerTimeout: backend.circuitBreaker?.timeout || 60000,
                    };

                    const updateFormData = (updates: Partial<typeof formData>) => {
                      setBackendFormData({
                        ...backendFormData,
                        [backend.id]: { ...formData, ...updates },
                      });
                    };

                    return (
                      <Card key={backend.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            {isEditing ? (
                              <div className="flex-1 space-y-4">
                                <div className="space-y-2">
                                  <Label>Name</Label>
                                  <Input
                                    value={formData.name || ''}
                                    onChange={(e) => updateFormData({ name: e.target.value })}
                                    placeholder="backend-name"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Endpoint URL</Label>
                                  <Input
                                    value={formData.endpoint || ''}
                                    onChange={(e) => updateFormData({ endpoint: e.target.value })}
                                    placeholder="http://localhost:8080"
                                  />
                                  {validationErrors.endpoint && (
                                    <p className="text-xs text-destructive">{validationErrors.endpoint}</p>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <Label>Protocol</Label>
                                  <Select 
                                    value={formData.protocol || 'http'} 
                                    onValueChange={(value: any) => updateFormData({ protocol: value })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="http">HTTP</SelectItem>
                                      <SelectItem value="grpc">gRPC</SelectItem>
                                      <SelectItem value="graphql">GraphQL</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Timeout (ms)</Label>
                                    <Input
                                      type="number"
                                      value={formData.timeout || 5000}
                                      onChange={(e) => updateFormData({ timeout: parseInt(e.target.value) || 5000 })}
                                      min={1}
                                    />
                                    {validationErrors.timeout && (
                                      <p className="text-xs text-destructive">{validationErrors.timeout}</p>
                                    )}
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Retries</Label>
                                    <Input
                                      type="number"
                                      value={formData.retries || 3}
                                      onChange={(e) => updateFormData({ retries: parseInt(e.target.value) || 3 })}
                                      min={0}
                                      max={10}
                                    />
                                    {validationErrors.retries && (
                                      <p className="text-xs text-destructive">{validationErrors.retries}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label>Retry Backoff Strategy</Label>
                                  <Select 
                                    value={formData.retryBackoff || 'exponential'} 
                                    onValueChange={(value: any) => updateFormData({ retryBackoff: value })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="exponential">Exponential</SelectItem>
                                      <SelectItem value="linear">Linear</SelectItem>
                                      <SelectItem value="constant">Constant</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Separator />
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                      <Label>Circuit Breaker</Label>
                                      <p className="text-xs text-muted-foreground">
                                        Automatically stop requests to failing backends
                                      </p>
                                    </div>
                                    <Switch 
                                      checked={formData.circuitBreakerEnabled ?? true}
                                      onCheckedChange={(checked) => updateFormData({ circuitBreakerEnabled: checked })}
                                    />
                                  </div>
                                  {formData.circuitBreakerEnabled && (
                                    <div className="grid grid-cols-2 gap-4 pl-4 border-l-2">
                                      <div className="space-y-2">
                                        <Label>Failure Threshold</Label>
                                        <Input
                                          type="number"
                                          value={formData.failureThreshold || 5}
                                          onChange={(e) => updateFormData({ failureThreshold: parseInt(e.target.value) || 5 })}
                                          min={1}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Success Threshold</Label>
                                        <Input
                                          type="number"
                                          value={formData.successThreshold || 2}
                                          onChange={(e) => updateFormData({ successThreshold: parseInt(e.target.value) || 2 })}
                                          min={1}
                                        />
                                      </div>
                                      <div className="space-y-2 col-span-2">
                                        <Label>Circuit Breaker Timeout (ms)</Label>
                                        <Input
                                          type="number"
                                          value={formData.circuitBreakerTimeout || 60000}
                                          onChange={(e) => updateFormData({ circuitBreakerTimeout: parseInt(e.target.value) || 60000 })}
                                          min={1000}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <>
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
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingBackendId(backend.id);
                                      // Initialize form data
                                      setBackendFormData({
                                        ...backendFormData,
                                        [backend.id]: {
                                          name: backend.name,
                                          endpoint: backend.endpoint,
                                          protocol: backend.protocol,
                                          timeout: backend.timeout || 5000,
                                          retries: backend.retries || 3,
                                          retryBackoff: backend.retryBackoff || 'exponential',
                                          circuitBreakerEnabled: backend.circuitBreaker?.enabled ?? true,
                                          failureThreshold: backend.circuitBreaker?.failureThreshold || 5,
                                          successThreshold: backend.circuitBreaker?.successThreshold || 2,
                                          circuitBreakerTimeout: backend.circuitBreaker?.timeout || 60000,
                                        },
                                      });
                                    }}
                                    className="hover:bg-primary/10 hover:text-primary"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeBackend(backend.id)}
                                    className="hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        </CardHeader>
                        {isEditing && (
                          <CardContent>
                            <div className="flex justify-end gap-2 pt-4 border-t">
                              <Button variant="outline" onClick={() => handleCancelEditBackend(backend.id)}>
                                Cancel
                              </Button>
                              <Button onClick={() => handleSaveBackend(backend.id, formData)}>
                                <Save className="h-4 w-4 mr-2" />
                                Save
                              </Button>
                            </div>
                          </CardContent>
                        )}
                        {!isEditing && (
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
                        )}
                      </Card>
                    );
                  })}
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
                <Separator />
                <div className="space-y-2">
                  <Label>Audience</Label>
                  <Select 
                    value={config.audience || 'web'} 
                    onValueChange={(value: 'mobile' | 'web' | 'partner') => updateConfig({ audience: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mobile">Mobile</SelectItem>
                      <SelectItem value="web">Web</SelectItem>
                      <SelectItem value="partner">Partner</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Target audience for this BFF service. Affects response size and format.
                  </p>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Fallback</Label>
                    <p className="text-xs text-muted-foreground">
                      Use fallback component when all backends fail
                    </p>
                  </div>
                  <Switch 
                    checked={config.fallbackEnabled ?? false}
                    onCheckedChange={(checked) => updateConfig({ fallbackEnabled: checked })}
                  />
                </div>
                {config.fallbackEnabled && (
                  <div className="space-y-2">
                    <Label>Fallback Component</Label>
                    <Input 
                      placeholder="Component ID for fallback"
                      value={config.fallbackComponent || ''}
                      onChange={(e) => updateConfig({ fallbackComponent: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      ID of the component to use as fallback when all backends fail
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Endpoint Confirmation */}
      <AlertDialog open={!!deleteEndpointId} onOpenChange={(open) => !open && setDeleteEndpointId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Endpoint</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this endpoint? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveEndpoint}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Backend Confirmation */}
      <AlertDialog open={!!deleteBackendId} onOpenChange={(open) => !open && setDeleteBackendId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Backend</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this backend? It will be removed from all endpoints. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveBackend}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


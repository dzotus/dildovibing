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
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  Database,
  Network,
  AlertTriangle,
  CheckCircle,
  GitBranch,
  Pencil,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface MuleSoftConfigProps {
  componentId: string;
}

interface MuleFlow {
  id: string;
  name: string;
  source?: MuleSource | string;
  processors?: MuleProcessor[];
  target?: MuleTarget | string;
  errorHandlers?: MuleErrorHandler[];
  async?: boolean;
}

interface MuleSource {
  type: 'http-listener' | 'scheduler' | 'file-reader' | 'connector';
  config: Record<string, any>;
}

interface MuleTarget {
  type: 'http-request' | 'database' | 'file-writer' | 'connector';
  config: Record<string, any>;
}

interface MuleProcessor {
  id: string;
  type: 'transform' | 'validate' | 'filter' | 'enrich' | 'logger' | 
        'choice' | 'try' | 'set-variable' | 'set-payload' | 'async';
  config?: Record<string, any>;
  dataweave?: string;
  children?: MuleProcessor[];
  when?: string;
}

interface MuleErrorHandler {
  type: 'on-error-continue' | 'on-error-propagate';
  errorType?: string;
  processors: MuleProcessor[];
}

interface Application {
  name: string;
  runtimeVersion: string;
  workerCount: number;
  status?: 'running' | 'stopped' | 'deploying';
  connectors?: string[];
  errorStrategy?: 'continue' | 'rollback' | 'propagate';
  reconnectionStrategy?: 'exponential' | 'linear' | 'none';
  auditLogging?: boolean;
  requestCount?: number;
  errorCount?: number;
  avgResponseTime?: number;
  flows?: MuleFlow[];
}

interface Connector {
  name: string;
  type: 'database' | 'api' | 'file' | 'messaging' | 'custom';
  enabled: boolean;
  config?: {
    // Database connector
    connectionString?: string;
    connectionPoolSize?: number;
    queryTimeout?: number;
    retryPolicy?: {
      maxRetries?: number;
      retryInterval?: number;
      exponentialBackoff?: boolean;
    };
    // API connector
    baseUrl?: string;
    authentication?: {
      type?: 'oauth' | 'basic' | 'apikey' | 'none';
      credentials?: Record<string, any>;
    };
    headers?: Record<string, string>;
    timeout?: number;
    // Messaging connector
    brokerUrl?: string;
    queueName?: string;
    topicName?: string;
    connectionFactory?: string;
    acknowledgmentMode?: 'auto' | 'manual';
    // File connector
    path?: string;
    pattern?: string;
    encoding?: string;
    bufferSize?: number;
    // Common
    retryPolicy?: {
      maxRetries?: number;
      retryInterval?: number;
      exponentialBackoff?: boolean;
    };
  };
  // Health monitoring
  healthStatus?: 'connected' | 'disconnected' | 'error';
  lastOperationTime?: number;
  errorCount?: number;
  latency?: number;
}

interface MuleSoftConfig {
  organization?: string;
  environment?: string;
  applications?: Application[];
  connectors?: Connector[];
  apiKey?: string;
}

export function MuleSoftConfigAdvanced({ componentId }: MuleSoftConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { isRunning } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as MuleSoftConfig;
  const organization = config.organization || 'archiphoenix-org';
  const environment = config.environment || 'production';
  const applications = config.applications || [];
  const connectors = config.connectors || [];
  const apiKey = config.apiKey || '';

  const [editingAppIndex, setEditingAppIndex] = useState<number | null>(null);
  const [editingConnectorIndex, setEditingConnectorIndex] = useState<number | null>(null);
  const [showCreateConnector, setShowCreateConnector] = useState(false);
  const [expandedFlowId, setExpandedFlowId] = useState<string | null>(null);
  const [expandedConnectorIndex, setExpandedConnectorIndex] = useState<number | null>(null);
  const [editingFlowAppIndex, setEditingFlowAppIndex] = useState<number | null>(null);
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);

  const updateConfig = useCallback((updates: Partial<MuleSoftConfig>) => {
    const newConfig = { ...config, ...updates };
    updateNode(componentId, {
      data: {
        ...node.data,
        config: newConfig,
      },
    });

    // Sync with emulation engine
    try {
      emulationEngine.updateMuleSoftRoutingEngine(componentId);
    } catch (error) {
      console.error('Failed to update MuleSoft routing engine:', error);
      toast({
        title: 'Update Error',
        description: 'Failed to synchronize configuration with simulation engine',
        variant: 'destructive',
      });
    }
  }, [componentId, node, config, updateNode, toast]);

  // Sync metrics from routing engine to UI
  useEffect(() => {
    if (!isRunning) return;

    const routingEngine = emulationEngine.getMuleSoftRoutingEngine(componentId);
    if (!routingEngine) return;

    const interval = setInterval(() => {
      // Update application metrics
      const updatedApplications = applications.map((app: Application) => {
        const metrics = routingEngine.getApplicationMetrics(app.name);
        if (metrics) {
          return {
            ...app,
            requestCount: metrics.requestCount,
            errorCount: metrics.errorCount,
            avgResponseTime: metrics.avgLatency,
          };
        }
        return app;
      });

      // Update connector metrics and health status
      const updatedConnectors = connectors.map((connector: Connector) => {
        const metrics = routingEngine.getConnectorMetrics(connector.name);
        if (metrics) {
          // Determine health status based on metrics
          let healthStatus: 'connected' | 'disconnected' | 'error' = 'connected';
          if (metrics.errorCount > 0 && metrics.errorCount / metrics.requestCount > 0.1) {
            healthStatus = 'error';
          } else if (metrics.requestCount === 0 || Date.now() - metrics.lastRequestTime > 60000) {
            healthStatus = 'disconnected';
          }

          return {
            ...connector,
            errorCount: metrics.errorCount,
            latency: metrics.avgLatency,
            healthStatus,
            lastOperationTime: metrics.lastRequestTime,
          };
        }
        return connector;
      });

      // Only update if metrics changed
      const appHasChanges = updatedApplications.some((app: Application, i: number) => 
        app.requestCount !== applications[i]?.requestCount ||
        app.errorCount !== applications[i]?.errorCount ||
        app.avgResponseTime !== applications[i]?.avgResponseTime
      );

      const connectorHasChanges = updatedConnectors.some((conn: Connector, i: number) => 
        conn.errorCount !== connectors[i]?.errorCount ||
        conn.latency !== connectors[i]?.latency ||
        conn.healthStatus !== connectors[i]?.healthStatus
      );

      if (appHasChanges || connectorHasChanges) {
        updateConfig({ 
          applications: updatedApplications,
          connectors: updatedConnectors,
        });
      }
    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, [componentId, isRunning, applications, connectors, updateConfig]);

  const addApplication = () => {
    const newApp: Application = {
      name: 'new-application',
      runtimeVersion: '4.6.0',
      workerCount: 2,
      status: 'stopped',
      connectors: [],
      errorStrategy: 'continue',
      reconnectionStrategy: 'exponential',
      auditLogging: false,
      requestCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
    };
    updateConfig({ applications: [...applications, newApp] });
  };

  const removeApplication = (index: number) => {
    updateConfig({ applications: applications.filter((_, i) => i !== index) });
  };

  const updateApplication = (index: number, field: string, value: any) => {
    const newApps = [...applications];
    newApps[index] = { ...newApps[index], [field]: value };
    updateConfig({ applications: newApps });
  };

  const addConnector = () => {
    const newConnector: Connector = {
      name: 'new-connector',
      type: 'api',
      enabled: true,
    };
    updateConfig({ connectors: [...connectors, newConnector] });
    setShowCreateConnector(false);
  };

  const removeConnector = (index: number) => {
    updateConfig({ connectors: connectors.filter((_, i) => i !== index) });
  };

  const updateConnector = (index: number, field: string, value: any) => {
    const newConnectors = [...connectors];
    newConnectors[index] = { ...newConnectors[index], [field]: value };
    updateConfig({ connectors: newConnectors });
  };

  // Flow management functions
  const addFlow = (appIndex: number) => {
    const app = applications[appIndex];
    if (!app) return;

    const newFlow: MuleFlow = {
      id: `flow-${Date.now()}`,
      name: 'new-flow',
      processors: [],
      errorHandlers: [],
    };

    const newApps = [...applications];
    newApps[appIndex] = {
      ...app,
      flows: [...(app.flows || []), newFlow],
    };

    updateConfig({ applications: newApps });
    setEditingFlowAppIndex(appIndex);
    setEditingFlowId(newFlow.id);
    setShowFlowEditor(true);
  };

  const removeFlow = (appIndex: number, flowId: string) => {
    const app = applications[appIndex];
    if (!app) return;

    const newApps = [...applications];
    newApps[appIndex] = {
      ...app,
      flows: (app.flows || []).filter(f => f.id !== flowId),
    };

    updateConfig({ applications: newApps });
    toast({
      title: 'Flow Deleted',
      description: 'Flow has been deleted',
    });
  };

  const updateFlow = (appIndex: number, flowId: string, updates: Partial<MuleFlow>) => {
    const app = applications[appIndex];
    if (!app) return;

    const newApps = [...applications];
    newApps[appIndex] = {
      ...app,
      flows: (app.flows || []).map(f => 
        f.id === flowId ? { ...f, ...updates } : f
      ),
    };

    updateConfig({ applications: newApps });
  };

  const addProcessor = (appIndex: number, flowId: string, processorType: MuleProcessor['type']) => {
    const app = applications[appIndex];
    if (!app) return;

    const newProcessor: MuleProcessor = {
      id: `processor-${Date.now()}`,
      type: processorType,
      config: {},
    };

    const newApps = [...applications];
    newApps[appIndex] = {
      ...app,
      flows: (app.flows || []).map(f => 
        f.id === flowId 
          ? { ...f, processors: [...(f.processors || []), newProcessor] }
          : f
      ),
    };

    updateConfig({ applications: newApps });
  };

  const removeProcessor = (appIndex: number, flowId: string, processorId: string) => {
    const app = applications[appIndex];
    if (!app) return;

    const newApps = [...applications];
    newApps[appIndex] = {
      ...app,
      flows: (app.flows || []).map(f => 
        f.id === flowId 
          ? { ...f, processors: (f.processors || []).filter(p => p.id !== processorId) }
          : f
      ),
    };

    updateConfig({ applications: newApps });
  };

  const updateProcessor = (
    appIndex: number,
    flowId: string,
    processorId: string,
    updates: Partial<MuleProcessor>
  ) => {
    const app = applications[appIndex];
    if (!app) return;

    const newApps = [...applications];
    newApps[appIndex] = {
      ...app,
      flows: (app.flows || []).map(f => 
        f.id === flowId 
          ? {
              ...f,
              processors: (f.processors || []).map(p =>
                p.id === processorId ? { ...p, ...updates } : p
              ),
            }
          : f
      ),
    };

    updateConfig({ applications: newApps });
  };

  const totalRequests = applications.reduce((sum, app) => sum + (app.requestCount || 0), 0);
  const totalErrors = applications.reduce((sum, app) => sum + (app.errorCount || 0), 0);
  const avgResponseTime = applications.length > 0
    ? applications.reduce((sum, app) => sum + (app.avgResponseTime || 0), 0) / applications.length
    : 0;

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">MuleSoft Anypoint Platform</p>
            <h2 className="text-2xl font-bold text-foreground">Integration Applications</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure Mule applications, connectors and runtime settings
            </p>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Organization</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{organization}</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{applications.length}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{totalRequests.toLocaleString()}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{avgResponseTime.toFixed(0)}</span>
              <p className="text-xs text-muted-foreground mt-1">ms</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="applications" className="space-y-4">
          <TabsList>
            <TabsTrigger value="applications">
              <Database className="h-4 w-4 mr-2" />
              Applications ({applications.length})
            </TabsTrigger>
            <TabsTrigger value="connectors">
              <Network className="h-4 w-4 mr-2" />
              Connectors ({connectors.length})
            </TabsTrigger>
            <TabsTrigger value="monitoring">
              <Activity className="h-4 w-4 mr-2" />
              Monitoring
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="applications" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Mule Applications</CardTitle>
                    <CardDescription>Configure and manage integration applications</CardDescription>
                  </div>
                  <Button onClick={addApplication} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Application
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {applications.map((app, index) => (
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <Database className="h-5 w-5 text-blue-500" />
                            <div className="flex-1">
                              {editingAppIndex === index ? (
                                <Input
                                  value={app.name}
                                  onChange={(e) => updateApplication(index, 'name', e.target.value)}
                                  onBlur={() => setEditingAppIndex(null)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      setEditingAppIndex(null);
                                    }
                                  }}
                                  className="text-base font-semibold"
                                  autoFocus
                                />
                              ) : (
                                <CardTitle 
                                  className="text-base cursor-pointer hover:text-primary transition-colors"
                                  onClick={() => setEditingAppIndex(index)}
                                >
                                  {app.name}
                                </CardTitle>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                {app.status === 'running' ? (
                                  <Badge variant="default" className="gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    Running
                                  </Badge>
                                ) : app.status === 'deploying' ? (
                                  <Badge variant="outline" className="gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Deploying
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">Stopped</Badge>
                                )}
                                <Badge variant="outline">v{app.runtimeVersion}</Badge>
                                <Badge variant="outline">{app.workerCount} workers</Badge>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeApplication(index)}
                            disabled={applications.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Requests</p>
                            <p className="text-lg font-semibold">{(app.requestCount || 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Errors</p>
                            <p className="text-lg font-semibold text-red-500">{(app.errorCount || 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Response Time</p>
                            <p className="text-lg font-semibold">{(app.avgResponseTime || 0).toFixed(0)} ms</p>
                          </div>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Runtime Version</Label>
                            <Input
                              value={app.runtimeVersion}
                              onChange={(e) => updateApplication(index, 'runtimeVersion', e.target.value)}
                              placeholder="4.6.0"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Worker Count</Label>
                            <Input
                              type="number"
                              value={app.workerCount}
                              onChange={(e) => updateApplication(index, 'workerCount', Number(e.target.value))}
                              min={1}
                              max={16}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                              value={app.status || 'stopped'}
                              onValueChange={(value: 'running' | 'stopped' | 'deploying') => updateApplication(index, 'status', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="running">Running</SelectItem>
                                <SelectItem value="stopped">Stopped</SelectItem>
                                <SelectItem value="deploying">Deploying</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Error Strategy</Label>
                            <Select
                              value={app.errorStrategy || 'continue'}
                              onValueChange={(value: 'continue' | 'rollback' | 'propagate') => updateApplication(index, 'errorStrategy', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="continue">Continue</SelectItem>
                                <SelectItem value="rollback">Rollback</SelectItem>
                                <SelectItem value="propagate">Propagate</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Reconnection Strategy</Label>
                            <Select
                              value={app.reconnectionStrategy || 'exponential'}
                              onValueChange={(value: 'exponential' | 'linear' | 'none') => updateApplication(index, 'reconnectionStrategy', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="exponential">Exponential</SelectItem>
                                <SelectItem value="linear">Linear</SelectItem>
                                <SelectItem value="none">None</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Audit Logging</Label>
                            <Switch
                              checked={app.auditLogging || false}
                              onCheckedChange={(checked) => updateApplication(index, 'auditLogging', checked)}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Enabled Connectors</Label>
                          <div className="flex flex-wrap gap-2">
                            {app.connectors?.map((conn, i) => (
                              <Badge key={i} variant="outline">{conn}</Badge>
                            ))}
                            {(!app.connectors || app.connectors.length === 0) && (
                              <span className="text-sm text-muted-foreground">No connectors</span>
                            )}
                          </div>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Flows</Label>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addFlow(index)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Flow
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {app.flows && app.flows.length > 0 ? (
                              app.flows.map((flow) => {
                                const isExpanded = expandedFlowId === flow.id;
                                return (
                                  <Card key={flow.id} className="border-l-2 border-l-blue-400">
                                    <CardContent className="pt-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 flex-1">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setExpandedFlowId(isExpanded ? null : flow.id)}
                                            className="h-6 w-6 p-0"
                                          >
                                            {isExpanded ? (
                                              <ChevronUp className="h-4 w-4" />
                                            ) : (
                                              <ChevronDown className="h-4 w-4" />
                                            )}
                                          </Button>
                                          <GitBranch className="h-4 w-4 text-blue-400" />
                                          {editingFlowAppIndex === index && editingFlowId === flow.id ? (
                                            <Input
                                              value={flow.name}
                                              onChange={(e) => updateFlow(index, flow.id, { name: e.target.value })}
                                              onBlur={() => {
                                                setEditingFlowAppIndex(null);
                                                setEditingFlowId(null);
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  setEditingFlowAppIndex(null);
                                                  setEditingFlowId(null);
                                                }
                                              }}
                                              className="font-medium h-7"
                                              autoFocus
                                            />
                                          ) : (
                                            <span 
                                              className="font-medium cursor-pointer hover:text-primary transition-colors"
                                              onClick={() => {
                                                setEditingFlowAppIndex(index);
                                                setEditingFlowId(flow.id);
                                              }}
                                            >
                                              {flow.name}
                                            </span>
                                          )}
                                          <Badge variant="outline" className="text-xs">
                                            {flow.processors?.length || 0} processors
                                          </Badge>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => removeFlow(index, flow.id)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                      
                                      {isExpanded && (
                                        <div className="mt-4 space-y-4 pt-4 border-t">
                                          <div className="space-y-2">
                                            <Label>Source</Label>
                                            <Select
                                              value={typeof flow.source === 'string' ? flow.source : flow.source?.type || 'none'}
                                              onValueChange={(value) => {
                                                if (value === 'none') {
                                                  updateFlow(index, flow.id, { source: undefined });
                                                } else {
                                                  updateFlow(index, flow.id, {
                                                    source: {
                                                      type: value as MuleSource['type'],
                                                      config: {},
                                                    },
                                                  });
                                                }
                                              }}
                                            >
                                              <SelectTrigger>
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="none">None</SelectItem>
                                                <SelectItem value="http-listener">HTTP Listener</SelectItem>
                                                <SelectItem value="scheduler">Scheduler</SelectItem>
                                                <SelectItem value="file-reader">File Reader</SelectItem>
                                                <SelectItem value="connector">Connector</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>

                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                              <Label>Processors</Label>
                                              <Select
                                                onValueChange={(value) => addProcessor(index, flow.id, value as MuleProcessor['type'])}
                                              >
                                                <SelectTrigger className="w-[200px]">
                                                  <SelectValue placeholder="Add Processor" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="transform">Transform</SelectItem>
                                                  <SelectItem value="validate">Validate</SelectItem>
                                                  <SelectItem value="filter">Filter</SelectItem>
                                                  <SelectItem value="enrich">Enrich</SelectItem>
                                                  <SelectItem value="logger">Logger</SelectItem>
                                                  <SelectItem value="choice">Choice Router</SelectItem>
                                                  <SelectItem value="try">Try Scope</SelectItem>
                                                  <SelectItem value="set-variable">Set Variable</SelectItem>
                                                  <SelectItem value="set-payload">Set Payload</SelectItem>
                                                  <SelectItem value="async">Async</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                            
                                            <div className="space-y-2">
                                              {flow.processors && flow.processors.length > 0 ? (
                                                flow.processors.map((processor) => (
                                                  <Card key={processor.id} className="border-l-2 border-l-purple-400">
                                                    <CardContent className="pt-4">
                                                      <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                          <Badge variant="outline">{processor.type}</Badge>
                                                          {processor.when && (
                                                            <Badge variant="secondary">when: {processor.when}</Badge>
                                                          )}
                                                        </div>
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          onClick={() => removeProcessor(index, flow.id, processor.id)}
                                                        >
                                                          <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                      </div>
                                                      
                                                      {processor.type === 'transform' && (
                                                        <div className="space-y-2">
                                                          <Label>DataWeave Expression</Label>
                                                          <Textarea
                                                            value={processor.dataweave || ''}
                                                            onChange={(e) => updateProcessor(
                                                              index,
                                                              flow.id,
                                                              processor.id,
                                                              { dataweave: e.target.value }
                                                            )}
                                                            placeholder="%dw 2.0&#10;output application/json&#10;---&#10;payload"
                                                            className="font-mono text-sm"
                                                            rows={6}
                                                          />
                                                        </div>
                                                      )}
                                                      
                                                      {processor.type === 'choice' && processor.when && (
                                                        <div className="space-y-2">
                                                          <Label>Condition (when)</Label>
                                                          <Input
                                                            value={processor.when}
                                                            onChange={(e) => updateProcessor(
                                                              index,
                                                              flow.id,
                                                              processor.id,
                                                              { when: e.target.value }
                                                            )}
                                                            placeholder="payload.status == 'active'"
                                                          />
                                                        </div>
                                                      )}
                                                      
                                                      {processor.type === 'logger' && (
                                                        <div className="space-y-2">
                                                          <Label>Log Message</Label>
                                                          <Input
                                                            value={processor.config?.message || ''}
                                                            onChange={(e) => updateProcessor(
                                                              index,
                                                              flow.id,
                                                              processor.id,
                                                              { config: { ...processor.config, message: e.target.value } }
                                                            )}
                                                            placeholder="Processing request..."
                                                          />
                                                        </div>
                                                      )}
                                                      
                                                      {processor.type === 'enrich' && (
                                                        <div className="space-y-2">
                                                          <Label>Enrichment Source</Label>
                                                          <Select
                                                            value={processor.config?.source || 'connector'}
                                                            onValueChange={(value) => updateProcessor(
                                                              index,
                                                              flow.id,
                                                              processor.id,
                                                              { config: { ...processor.config, source: value } }
                                                            )}
                                                          >
                                                            <SelectTrigger>
                                                              <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                              <SelectItem value="connector">Connector</SelectItem>
                                                              <SelectItem value="variable">Variable</SelectItem>
                                                              <SelectItem value="payload">Payload</SelectItem>
                                                            </SelectContent>
                                                          </Select>
                                                          {processor.config?.source === 'connector' && (
                                                            <>
                                                              <Label>Connector Name</Label>
                                                              <Input
                                                                value={processor.config?.connectorName || ''}
                                                                onChange={(e) => updateProcessor(
                                                                  index,
                                                                  flow.id,
                                                                  processor.id,
                                                                  { config: { ...processor.config, connectorName: e.target.value } }
                                                                )}
                                                                placeholder="connector-name"
                                                              />
                                                            </>
                                                          )}
                                                          <Label>Target Variable</Label>
                                                          <Input
                                                            value={processor.config?.targetVariable || ''}
                                                            onChange={(e) => updateProcessor(
                                                              index,
                                                              flow.id,
                                                              processor.id,
                                                              { config: { ...processor.config, targetVariable: e.target.value } }
                                                            )}
                                                            placeholder="enrichedData"
                                                          />
                                                          <Label>DataWeave Expression (optional)</Label>
                                                          <Textarea
                                                            value={processor.dataweave || ''}
                                                            onChange={(e) => updateProcessor(
                                                              index,
                                                              flow.id,
                                                              processor.id,
                                                              { dataweave: e.target.value }
                                                            )}
                                                            placeholder="%dw 2.0&#10;output application/json&#10;---&#10;payload"
                                                            className="font-mono text-sm"
                                                            rows={4}
                                                          />
                                                        </div>
                                                      )}
                                                      
                                                      {processor.type === 'set-variable' && (
                                                        <div className="space-y-2">
                                                          <Label>Variable Name</Label>
                                                          <Input
                                                            value={processor.config?.name || ''}
                                                            onChange={(e) => updateProcessor(
                                                              index,
                                                              flow.id,
                                                              processor.id,
                                                              { config: { ...processor.config, name: e.target.value } }
                                                            )}
                                                            placeholder="myVariable"
                                                          />
                                                          <Label>Variable Value</Label>
                                                          <Input
                                                            value={processor.config?.value || ''}
                                                            onChange={(e) => updateProcessor(
                                                              index,
                                                              flow.id,
                                                              processor.id,
                                                              { config: { ...processor.config, value: e.target.value } }
                                                            )}
                                                            placeholder="variable value or DataWeave expression"
                                                          />
                                                        </div>
                                                      )}
                                                      
                                                      {processor.type === 'set-payload' && (
                                                        <div className="space-y-2">
                                                          <Label>Payload Value</Label>
                                                          <Textarea
                                                            value={processor.config?.value || ''}
                                                            onChange={(e) => updateProcessor(
                                                              index,
                                                              flow.id,
                                                              processor.id,
                                                              { config: { ...processor.config, value: e.target.value } }
                                                            )}
                                                            placeholder="Payload value or DataWeave expression"
                                                            className="font-mono text-sm"
                                                            rows={4}
                                                          />
                                                          <Label>DataWeave Expression (optional, overrides value)</Label>
                                                          <Textarea
                                                            value={processor.dataweave || ''}
                                                            onChange={(e) => updateProcessor(
                                                              index,
                                                              flow.id,
                                                              processor.id,
                                                              { dataweave: e.target.value }
                                                            )}
                                                            placeholder="%dw 2.0&#10;output application/json&#10;---&#10;payload"
                                                            className="font-mono text-sm"
                                                            rows={4}
                                                          />
                                                        </div>
                                                      )}
                                                    </CardContent>
                                                  </Card>
                                                ))
                                              ) : (
                                                <p className="text-sm text-muted-foreground">No processors configured</p>
                                              )}
                                            </div>
                                          </div>

                                          <Separator />

                                          <div className="space-y-2">
                                            <Label>Target</Label>
                                            <Select
                                              value={typeof flow.target === 'string' ? flow.target : flow.target?.type || 'none'}
                                              onValueChange={(value) => {
                                                if (value === 'none') {
                                                  updateFlow(index, flow.id, { target: undefined });
                                                } else {
                                                  updateFlow(index, flow.id, {
                                                    target: {
                                                      type: value as MuleTarget['type'],
                                                      config: {},
                                                    },
                                                  });
                                                }
                                              }}
                                            >
                                              <SelectTrigger>
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="none">None</SelectItem>
                                                <SelectItem value="http-request">HTTP Request</SelectItem>
                                                <SelectItem value="database">Database</SelectItem>
                                                <SelectItem value="file-writer">File Writer</SelectItem>
                                                <SelectItem value="connector">Connector</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>

                                          <div className="flex items-center space-x-2">
                                            <Switch
                                              checked={flow.async || false}
                                              onCheckedChange={(checked) => updateFlow(index, flow.id, { async: checked })}
                                            />
                                            <Label>Async Processing</Label>
                                          </div>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                );
                              })
                            ) : (
                              <p className="text-sm text-muted-foreground">No flows configured</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="connectors" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Connectors</CardTitle>
                    <CardDescription>Manage integration connectors</CardDescription>
                  </div>
                  <Button onClick={addConnector} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Connector
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {connectors.map((connector, index) => (
                    <Card key={index} className="border-l-4 border-l-green-500">
                      <CardContent className="pt-4">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <Network className="h-5 w-5 text-green-500" />
                              <div className="flex-1">
                                {editingConnectorIndex === index ? (
                                  <Input
                                    value={connector.name}
                                    onChange={(e) => updateConnector(index, 'name', e.target.value)}
                                    onBlur={() => setEditingConnectorIndex(null)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        setEditingConnectorIndex(null);
                                      }
                                    }}
                                    className="font-medium"
                                    autoFocus
                                  />
                                ) : (
                                  <p 
                                    className="font-medium cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => setEditingConnectorIndex(index)}
                                  >
                                    {connector.name}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline">{connector.type}</Badge>
                                  {connector.enabled ? (
                                    <Badge variant="default">Enabled</Badge>
                                  ) : (
                                    <Badge variant="outline">Disabled</Badge>
                                  )}
                                  {connector.healthStatus && (
                                    <Badge 
                                      variant={connector.healthStatus === 'connected' ? 'default' : 'destructive'}
                                    >
                                      {connector.healthStatus === 'connected' ? (
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                      ) : (
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                      )}
                                      {connector.healthStatus}
                                    </Badge>
                                  )}
                                </div>
                                {/* Health monitoring info */}
                                {(connector.errorCount !== undefined || connector.latency !== undefined) && (
                                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                    {connector.errorCount !== undefined && (
                                      <span>Errors: {connector.errorCount}</span>
                                    )}
                                    {connector.latency !== undefined && (
                                      <span>Latency: {connector.latency.toFixed(0)}ms</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setExpandedConnectorIndex(expandedConnectorIndex === index ? null : index)}
                                className="h-6 w-6 p-0"
                              >
                                {expandedConnectorIndex === index ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                              <Switch
                                checked={connector.enabled}
                                onCheckedChange={(checked) => updateConnector(index, 'enabled', checked)}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeConnector(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          {expandedConnectorIndex === index && (
                            <div className="mt-4 space-y-4 pt-4 border-t">
                              {connector.type === 'database' && (
                                <>
                                  <div className="space-y-2">
                                    <Label>Connection String</Label>
                                    <Input
                                      value={connector.config?.connectionString || ''}
                                      onChange={(e) => {
                                        const newConnectors = [...connectors];
                                        newConnectors[index] = {
                                          ...newConnectors[index],
                                          config: {
                                            ...newConnectors[index].config,
                                            connectionString: e.target.value,
                                          },
                                        };
                                        updateConfig({ connectors: newConnectors });
                                      }}
                                      placeholder="jdbc:postgresql://localhost:5432/mydb"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label>Connection Pool Size</Label>
                                      <Input
                                        type="number"
                                        value={connector.config?.connectionPoolSize || 10}
                                        onChange={(e) => {
                                          const newConnectors = [...connectors];
                                          newConnectors[index] = {
                                            ...newConnectors[index],
                                            config: {
                                              ...newConnectors[index].config,
                                              connectionPoolSize: parseInt(e.target.value) || 10,
                                            },
                                          };
                                          updateConfig({ connectors: newConnectors });
                                        }}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Query Timeout (ms)</Label>
                                      <Input
                                        type="number"
                                        value={connector.config?.queryTimeout || 30000}
                                        onChange={(e) => {
                                          const newConnectors = [...connectors];
                                          newConnectors[index] = {
                                            ...newConnectors[index],
                                            config: {
                                              ...newConnectors[index].config,
                                              queryTimeout: parseInt(e.target.value) || 30000,
                                            },
                                          };
                                          updateConfig({ connectors: newConnectors });
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Retry Policy</Label>
                                    <div className="grid grid-cols-3 gap-4">
                                      <div className="space-y-2">
                                        <Label className="text-xs">Max Retries</Label>
                                        <Input
                                          type="number"
                                          value={connector.config?.retryPolicy?.maxRetries || 3}
                                          onChange={(e) => {
                                            const newConnectors = [...connectors];
                                            newConnectors[index] = {
                                              ...newConnectors[index],
                                              config: {
                                                ...newConnectors[index].config,
                                                retryPolicy: {
                                                  ...newConnectors[index].config?.retryPolicy,
                                                  maxRetries: parseInt(e.target.value) || 3,
                                                },
                                              },
                                            };
                                            updateConfig({ connectors: newConnectors });
                                          }}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Retry Interval (ms)</Label>
                                        <Input
                                          type="number"
                                          value={connector.config?.retryPolicy?.retryInterval || 1000}
                                          onChange={(e) => {
                                            const newConnectors = [...connectors];
                                            newConnectors[index] = {
                                              ...newConnectors[index],
                                              config: {
                                                ...newConnectors[index].config,
                                                retryPolicy: {
                                                  ...newConnectors[index].config?.retryPolicy,
                                                  retryInterval: parseInt(e.target.value) || 1000,
                                                },
                                              },
                                            };
                                            updateConfig({ connectors: newConnectors });
                                          }}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Exponential Backoff</Label>
                                        <Switch
                                          checked={connector.config?.retryPolicy?.exponentialBackoff || false}
                                          onCheckedChange={(checked) => {
                                            const newConnectors = [...connectors];
                                            newConnectors[index] = {
                                              ...newConnectors[index],
                                              config: {
                                                ...newConnectors[index].config,
                                                retryPolicy: {
                                                  ...newConnectors[index].config?.retryPolicy,
                                                  exponentialBackoff: checked,
                                                },
                                              },
                                            };
                                            updateConfig({ connectors: newConnectors });
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </>
                              )}

                              {connector.type === 'api' && (
                                <>
                                  <div className="space-y-2">
                                    <Label>Base URL</Label>
                                    <Input
                                      value={connector.config?.baseUrl || ''}
                                      onChange={(e) => {
                                        const newConnectors = [...connectors];
                                        newConnectors[index] = {
                                          ...newConnectors[index],
                                          config: {
                                            ...newConnectors[index].config,
                                            baseUrl: e.target.value,
                                          },
                                        };
                                        updateConfig({ connectors: newConnectors });
                                      }}
                                      placeholder="https://api.example.com"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Authentication Type</Label>
                                    <Select
                                      value={connector.config?.authentication?.type || 'none'}
                                      onValueChange={(value) => {
                                        const newConnectors = [...connectors];
                                        newConnectors[index] = {
                                          ...newConnectors[index],
                                          config: {
                                            ...newConnectors[index].config,
                                            authentication: {
                                              ...newConnectors[index].config?.authentication,
                                              type: value as 'oauth' | 'basic' | 'apikey' | 'none',
                                            },
                                          },
                                        };
                                        updateConfig({ connectors: newConnectors });
                                      }}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        <SelectItem value="oauth">OAuth</SelectItem>
                                        <SelectItem value="basic">Basic Auth</SelectItem>
                                        <SelectItem value="apikey">API Key</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Timeout (ms)</Label>
                                    <Input
                                      type="number"
                                      value={connector.config?.timeout || 30000}
                                      onChange={(e) => {
                                        const newConnectors = [...connectors];
                                        newConnectors[index] = {
                                          ...newConnectors[index],
                                          config: {
                                            ...newConnectors[index].config,
                                            timeout: parseInt(e.target.value) || 30000,
                                          },
                                        };
                                        updateConfig({ connectors: newConnectors });
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Retry Policy</Label>
                                    <div className="grid grid-cols-3 gap-4">
                                      <div className="space-y-2">
                                        <Label className="text-xs">Max Retries</Label>
                                        <Input
                                          type="number"
                                          value={connector.config?.retryPolicy?.maxRetries || 3}
                                          onChange={(e) => {
                                            const newConnectors = [...connectors];
                                            newConnectors[index] = {
                                              ...newConnectors[index],
                                              config: {
                                                ...newConnectors[index].config,
                                                retryPolicy: {
                                                  ...newConnectors[index].config?.retryPolicy,
                                                  maxRetries: parseInt(e.target.value) || 3,
                                                },
                                              },
                                            };
                                            updateConfig({ connectors: newConnectors });
                                          }}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Retry Interval (ms)</Label>
                                        <Input
                                          type="number"
                                          value={connector.config?.retryPolicy?.retryInterval || 1000}
                                          onChange={(e) => {
                                            const newConnectors = [...connectors];
                                            newConnectors[index] = {
                                              ...newConnectors[index],
                                              config: {
                                                ...newConnectors[index].config,
                                                retryPolicy: {
                                                  ...newConnectors[index].config?.retryPolicy,
                                                  retryInterval: parseInt(e.target.value) || 1000,
                                                },
                                              },
                                            };
                                            updateConfig({ connectors: newConnectors });
                                          }}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Exponential Backoff</Label>
                                        <Switch
                                          checked={connector.config?.retryPolicy?.exponentialBackoff || false}
                                          onCheckedChange={(checked) => {
                                            const newConnectors = [...connectors];
                                            newConnectors[index] = {
                                              ...newConnectors[index],
                                              config: {
                                                ...newConnectors[index].config,
                                                retryPolicy: {
                                                  ...newConnectors[index].config?.retryPolicy,
                                                  exponentialBackoff: checked,
                                                },
                                              },
                                            };
                                            updateConfig({ connectors: newConnectors });
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </>
                              )}

                              {connector.type === 'messaging' && (
                                <>
                                  <div className="space-y-2">
                                    <Label>Broker URL</Label>
                                    <Input
                                      value={connector.config?.brokerUrl || ''}
                                      onChange={(e) => {
                                        const newConnectors = [...connectors];
                                        newConnectors[index] = {
                                          ...newConnectors[index],
                                          config: {
                                            ...newConnectors[index].config,
                                            brokerUrl: e.target.value,
                                          },
                                        };
                                        updateConfig({ connectors: newConnectors });
                                      }}
                                      placeholder="tcp://localhost:61616"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label>Queue Name</Label>
                                      <Input
                                        value={connector.config?.queueName || ''}
                                        onChange={(e) => {
                                          const newConnectors = [...connectors];
                                          newConnectors[index] = {
                                            ...newConnectors[index],
                                            config: {
                                              ...newConnectors[index].config,
                                              queueName: e.target.value,
                                            },
                                          };
                                          updateConfig({ connectors: newConnectors });
                                        }}
                                        placeholder="my-queue"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Topic Name</Label>
                                      <Input
                                        value={connector.config?.topicName || ''}
                                        onChange={(e) => {
                                          const newConnectors = [...connectors];
                                          newConnectors[index] = {
                                            ...newConnectors[index],
                                            config: {
                                              ...newConnectors[index].config,
                                              topicName: e.target.value,
                                            },
                                          };
                                          updateConfig({ connectors: newConnectors });
                                        }}
                                        placeholder="my-topic"
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Acknowledgment Mode</Label>
                                    <Select
                                      value={connector.config?.acknowledgmentMode || 'auto'}
                                      onValueChange={(value) => {
                                        const newConnectors = [...connectors];
                                        newConnectors[index] = {
                                          ...newConnectors[index],
                                          config: {
                                            ...newConnectors[index].config,
                                            acknowledgmentMode: value as 'auto' | 'manual',
                                          },
                                        };
                                        updateConfig({ connectors: newConnectors });
                                      }}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="auto">Auto</SelectItem>
                                        <SelectItem value="manual">Manual</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </>
                              )}

                              {connector.type === 'file' && (
                                <>
                                  <div className="space-y-2">
                                    <Label>Path</Label>
                                    <Input
                                      value={connector.config?.path || ''}
                                      onChange={(e) => {
                                        const newConnectors = [...connectors];
                                        newConnectors[index] = {
                                          ...newConnectors[index],
                                          config: {
                                            ...newConnectors[index].config,
                                            path: e.target.value,
                                          },
                                        };
                                        updateConfig({ connectors: newConnectors });
                                      }}
                                      placeholder="/path/to/files"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label>Pattern</Label>
                                      <Input
                                        value={connector.config?.pattern || ''}
                                        onChange={(e) => {
                                          const newConnectors = [...connectors];
                                          newConnectors[index] = {
                                            ...newConnectors[index],
                                            config: {
                                              ...newConnectors[index].config,
                                              pattern: e.target.value,
                                            },
                                          };
                                          updateConfig({ connectors: newConnectors });
                                        }}
                                        placeholder="*.txt"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Encoding</Label>
                                      <Input
                                        value={connector.config?.encoding || 'UTF-8'}
                                        onChange={(e) => {
                                          const newConnectors = [...connectors];
                                          newConnectors[index] = {
                                            ...newConnectors[index],
                                            config: {
                                              ...newConnectors[index].config,
                                              encoding: e.target.value,
                                            },
                                          };
                                          updateConfig({ connectors: newConnectors });
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Buffer Size (bytes)</Label>
                                    <Input
                                      type="number"
                                      value={connector.config?.bufferSize || 8192}
                                      onChange={(e) => {
                                        const newConnectors = [...connectors];
                                        newConnectors[index] = {
                                          ...newConnectors[index],
                                          config: {
                                            ...newConnectors[index].config,
                                            bufferSize: parseInt(e.target.value) || 8192,
                                          },
                                        };
                                        updateConfig({ connectors: newConnectors });
                                      }}
                                    />
                                  </div>
                                </>
                              )}
                              
                              <div className="flex justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    toast({
                                      title: 'Connection Test',
                                      description: 'Connection test completed successfully',
                                    });
                                  }}
                                >
                                  Test Connection
                                </Button>
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

          <TabsContent value="monitoring" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Application Monitoring</CardTitle>
                <CardDescription>Monitor application performance and health</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {applications.map((app, index) => (
                    <Card key={index} className="border-l-4 border-l-purple-500">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{app.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Total Requests</p>
                            <p className="text-2xl font-bold">{(app.requestCount || 0).toLocaleString()}</p>
                            <Progress
                              value={Math.min(((app.requestCount || 0) / 10000) * 100, 100)}
                              className="h-2 mt-2"
                            />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Errors</p>
                            <p className="text-2xl font-bold text-red-500">{(app.errorCount || 0).toLocaleString()}</p>
                            <Progress
                              value={Math.min(((app.errorCount || 0) / 100) * 100, 100)}
                              className="h-2 mt-2"
                            />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Avg Response Time</p>
                            <p className="text-2xl font-bold">{(app.avgResponseTime || 0).toFixed(0)} ms</p>
                            <Progress
                              value={Math.min(((app.avgResponseTime || 0) / 1000) * 100, 100)}
                              className="h-2 mt-2"
                            />
                          </div>
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
                <CardTitle>Anypoint Platform Settings</CardTitle>
                <CardDescription>Configure organization and API access</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Organization</Label>
                  <Input
                    value={organization}
                    onChange={(e) => updateConfig({ organization: e.target.value })}
                    placeholder="my-organization"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Environment</Label>
                  <Input
                    value={environment}
                    onChange={(e) => updateConfig({ environment: e.target.value })}
                    placeholder="production"
                  />
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => updateConfig({ apiKey: e.target.value })}
                    placeholder="Enter Anypoint API key"
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


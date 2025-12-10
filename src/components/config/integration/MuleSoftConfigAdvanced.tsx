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
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  Database,
  Network,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface MuleSoftConfigProps {
  componentId: string;
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
}

interface Connector {
  name: string;
  type: 'database' | 'api' | 'file' | 'messaging' | 'custom';
  enabled: boolean;
  config?: Record<string, any>;
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

  const updateConfig = (updates: Partial<MuleSoftConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

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
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
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


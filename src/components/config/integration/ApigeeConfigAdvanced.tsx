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
  Network, 
  Settings, 
  Activity,
  Shield,
  Plus,
  Trash2,
  Lock,
  TrendingUp,
  RefreshCcw,
  Cloud,
  Zap
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface ApigeeConfigProps {
  componentId: string;
}

interface APIProxy {
  name: string;
  environment: 'dev' | 'stage' | 'prod';
  basePath: string;
  targetEndpoint: string;
  revision?: number;
  status?: 'deployed' | 'undeployed';
  quota?: number;
  quotaInterval?: number;
  spikeArrest?: number;
  enableOAuth?: boolean;
  jwtIssuer?: string;
  requestCount?: number;
  errorCount?: number;
  avgResponseTime?: number;
}

interface Policy {
  id: string;
  name: string;
  type: 'quota' | 'spike-arrest' | 'oauth' | 'jwt' | 'verify-api-key' | 'cors' | 'xml-to-json';
  enabled: boolean;
  config?: Record<string, any>;
}

interface ApigeeConfig {
  organization?: string;
  environment?: string;
  proxies?: APIProxy[];
  policies?: Policy[];
  apiKey?: string;
}

export function ApigeeConfigAdvanced({ componentId }: ApigeeConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as ApigeeConfig;
  const organization = config.organization || 'archiphoenix-org';
  const environment = config.environment || 'prod';
  const proxies = config.proxies || [];
  const policies = config.policies || [
    {
      id: '1',
      name: 'Quota Policy',
      type: 'quota',
      enabled: true,
      config: { quota: 5000, interval: 60 },
    },
    {
      id: '2',
      name: 'Spike Arrest',
      type: 'spike-arrest',
      enabled: true,
      config: { rate: 100 },
    },
  ];
  const apiKey = config.apiKey || '';

  const [editingProxyIndex, setEditingProxyIndex] = useState<number | null>(null);
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);

  const updateConfig = (updates: Partial<ApigeeConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addProxy = () => {
    const newProxy: APIProxy = {
      name: 'new-proxy',
      environment: 'prod',
      basePath: '/api',
      targetEndpoint: 'https://api.internal',
      revision: 1,
      status: 'undeployed',
      quota: 1000,
      quotaInterval: 60,
      spikeArrest: 50,
      enableOAuth: false,
      requestCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
    };
    updateConfig({ proxies: [...proxies, newProxy] });
  };

  const removeProxy = (index: number) => {
    updateConfig({ proxies: proxies.filter((_, i) => i !== index) });
  };

  const updateProxy = (index: number, field: string, value: any) => {
    const newProxies = [...proxies];
    newProxies[index] = { ...newProxies[index], [field]: value };
    updateConfig({ proxies: newProxies });
  };

  const addPolicy = () => {
    const newPolicy: Policy = {
      id: `policy-${Date.now()}`,
      name: 'New Policy',
      type: 'quota',
      enabled: true,
      config: {},
    };
    updateConfig({ policies: [...policies, newPolicy] });
    setShowCreatePolicy(false);
  };

  const removePolicy = (id: string) => {
    updateConfig({ policies: policies.filter((p) => p.id !== id) });
  };

  const updatePolicy = (id: string, field: string, value: any) => {
    const newPolicies = policies.map((p) =>
      p.id === id ? { ...p, [field]: value } : p
    );
    updateConfig({ policies: newPolicies });
  };

  const totalRequests = proxies.reduce((sum, p) => sum + (p.requestCount || 0), 0);
  const totalErrors = proxies.reduce((sum, p) => sum + (p.errorCount || 0), 0);
  const avgResponseTime = proxies.length > 0
    ? proxies.reduce((sum, p) => sum + (p.avgResponseTime || 0), 0) / proxies.length
    : 0;

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Apigee API Platform</p>
            <h2 className="text-2xl font-bold text-foreground">API Proxy Management</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure API proxies, policies, quotas and security
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Cloud className="h-4 w-4 mr-2" />
              Apigee Console
            </Button>
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
              <CardTitle className="text-sm font-medium">API Proxies</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{proxies.length}</span>
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

        <Tabs defaultValue="proxies" className="space-y-4">
          <TabsList>
            <TabsTrigger value="proxies">
              <Network className="h-4 w-4 mr-2" />
              Proxies ({proxies.length})
            </TabsTrigger>
            <TabsTrigger value="policies">
              <Shield className="h-4 w-4 mr-2" />
              Policies ({policies.length})
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

          <TabsContent value="proxies" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>API Proxies</CardTitle>
                    <CardDescription>Configure and manage API proxies</CardDescription>
                  </div>
                  <Button onClick={addProxy} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Proxy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {proxies.map((proxy, index) => (
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Network className="h-5 w-5 text-blue-500" />
                            <div>
                              <CardTitle className="text-base">{proxy.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant={proxy.status === 'deployed' ? 'default' : 'outline'}>
                                  {proxy.status || 'undeployed'}
                                </Badge>
                                <Badge variant="outline">{proxy.environment}</Badge>
                                <Badge variant="outline">Rev {proxy.revision || 1}</Badge>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeProxy(index)}
                            disabled={proxies.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Requests</p>
                            <p className="text-lg font-semibold">{(proxy.requestCount || 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Errors</p>
                            <p className="text-lg font-semibold text-red-500">{(proxy.errorCount || 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Response Time</p>
                            <p className="text-lg font-semibold">{(proxy.avgResponseTime || 0).toFixed(0)} ms</p>
                          </div>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Proxy Name</Label>
                            <Input
                              value={proxy.name}
                              onChange={(e) => updateProxy(index, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Environment</Label>
                            <Select
                              value={proxy.environment}
                              onValueChange={(value: 'dev' | 'stage' | 'prod') => updateProxy(index, 'environment', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="dev">Development</SelectItem>
                                <SelectItem value="stage">Staging</SelectItem>
                                <SelectItem value="prod">Production</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Base Path</Label>
                            <Input
                              value={proxy.basePath}
                              onChange={(e) => updateProxy(index, 'basePath', e.target.value)}
                              placeholder="/api"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Target Endpoint</Label>
                            <Input
                              value={proxy.targetEndpoint}
                              onChange={(e) => updateProxy(index, 'targetEndpoint', e.target.value)}
                              placeholder="https://api.internal"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Quota (requests)</Label>
                            <Input
                              type="number"
                              value={proxy.quota || 0}
                              onChange={(e) => updateProxy(index, 'quota', Number(e.target.value))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Quota Interval (seconds)</Label>
                            <Input
                              type="number"
                              value={proxy.quotaInterval || 60}
                              onChange={(e) => updateProxy(index, 'quotaInterval', Number(e.target.value))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Spike Arrest (req/sec)</Label>
                            <Input
                              type="number"
                              value={proxy.spikeArrest || 0}
                              onChange={(e) => updateProxy(index, 'spikeArrest', Number(e.target.value))}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Enable OAuth</Label>
                            <Switch
                              checked={proxy.enableOAuth || false}
                              onCheckedChange={(checked) => updateProxy(index, 'enableOAuth', checked)}
                            />
                          </div>
                        </div>
                        {proxy.enableOAuth && (
                          <div className="space-y-2">
                            <Label>JWT Issuer</Label>
                            <Input
                              value={proxy.jwtIssuer || ''}
                              onChange={(e) => updateProxy(index, 'jwtIssuer', e.target.value)}
                              placeholder="auth.archi"
                            />
                          </div>
                        )}
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
                    <CardTitle>Policies</CardTitle>
                    <CardDescription>Configure API proxy policies</CardDescription>
                  </div>
                  <Button onClick={addPolicy} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Policy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {policies.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No policies configured</p>
                ) : (
                  <div className="space-y-2">
                    {policies.map((policy) => (
                      <Card key={policy.id} className="border-l-4 border-l-green-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{policy.type}</Badge>
                                <span className="font-medium">{policy.name}</span>
                                {policy.enabled ? (
                                  <Badge variant="default">Enabled</Badge>
                                ) : (
                                  <Badge variant="outline">Disabled</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={policy.enabled}
                                onCheckedChange={(checked) => updatePolicy(policy.id, 'enabled', checked)}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removePolicy(policy.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>API Analytics</CardTitle>
                <CardDescription>Monitor API proxy performance and usage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {proxies.map((proxy, index) => (
                    <Card key={index} className="border-l-4 border-l-purple-500">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{proxy.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Total Requests</p>
                            <p className="text-2xl font-bold">{(proxy.requestCount || 0).toLocaleString()}</p>
                            <Progress
                              value={Math.min(((proxy.requestCount || 0) / 10000) * 100, 100)}
                              className="h-2 mt-2"
                            />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Errors</p>
                            <p className="text-2xl font-bold text-red-500">{(proxy.errorCount || 0).toLocaleString()}</p>
                            <Progress
                              value={Math.min(((proxy.errorCount || 0) / 100) * 100, 100)}
                              className="h-2 mt-2"
                            />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Avg Response Time</p>
                            <p className="text-2xl font-bold">{(proxy.avgResponseTime || 0).toFixed(0)} ms</p>
                            <Progress
                              value={Math.min(((proxy.avgResponseTime || 0) / 1000) * 100, 100)}
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
                <CardTitle>Apigee Settings</CardTitle>
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
                  <Label>Default Environment</Label>
                  <Select
                    value={environment}
                    onValueChange={(value) => updateConfig({ environment: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dev">Development</SelectItem>
                      <SelectItem value="stage">Staging</SelectItem>
                      <SelectItem value="prod">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => updateConfig({ apiKey: e.target.value })}
                    placeholder="Enter Apigee API key"
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


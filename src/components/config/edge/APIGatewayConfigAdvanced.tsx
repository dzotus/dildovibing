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
  Globe,
  Route,
  CheckCircle,
  Shield,
  Zap,
  TrendingUp,
  Network
} from 'lucide-react';

interface APIGatewayConfigProps {
  componentId: string;
}

interface API {
  id: string;
  name: string;
  path: string;
  backend: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'ALL';
  rateLimit?: number;
  requests?: number;
  errors?: number;
  enabled: boolean;
}

interface Key {
  id: string;
  name: string;
  key: string;
  apis: string[];
  rateLimit?: number;
  enabled: boolean;
}

interface APIGatewayConfig {
  apis?: API[];
  keys?: Key[];
  totalAPIs?: number;
  totalKeys?: number;
  totalRequests?: number;
  successRate?: number;
}

export function APIGatewayConfigAdvanced({ componentId }: APIGatewayConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as APIGatewayConfig;
  const apis = config.apis || [
    {
      id: 'api-1',
      name: 'User API',
      path: '/api/users',
      backend: 'http://user-service:8080',
      method: 'ALL',
      rateLimit: 1000,
      requests: 12500,
      errors: 25,
      enabled: true,
    },
    {
      id: 'api-2',
      name: 'Product API',
      path: '/api/products',
      backend: 'http://product-service:8080',
      method: 'GET',
      rateLimit: 2000,
      requests: 9800,
      errors: 12,
      enabled: true,
    },
  ];
  const keys = config.keys || [
    {
      id: 'key-1',
      name: 'Mobile App Key',
      key: 'ak_live_***',
      apis: ['api-1', 'api-2'],
      rateLimit: 100,
      enabled: true,
    },
    {
      id: 'key-2',
      name: 'Web App Key',
      key: 'ak_live_***',
      apis: ['api-1'],
      rateLimit: 500,
      enabled: true,
    },
  ];
  const totalAPIs = config.totalAPIs || apis.length;
  const totalKeys = config.totalKeys || keys.length;
  const totalRequests = config.totalRequests || apis.reduce((sum, a) => sum + (a.requests || 0), 0);
  const successRate = config.successRate || (apis.reduce((sum, a) => sum + (a.requests || 0) - (a.errors || 0), 0) / apis.reduce((sum, a) => sum + (a.requests || 0), 0)) * 100;

  const [showCreateAPI, setShowCreateAPI] = useState(false);
  const [showCreateKey, setShowCreateKey] = useState(false);

  const updateConfig = (updates: Partial<APIGatewayConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addAPI = () => {
    const newAPI: API = {
      id: `api-${Date.now()}`,
      name: 'New API',
      path: '/api/new',
      backend: 'http://backend:8080',
      method: 'GET',
      enabled: true,
    };
    updateConfig({ apis: [...apis, newAPI] });
    setShowCreateAPI(false);
  };

  const removeAPI = (id: string) => {
    updateConfig({ apis: apis.filter((a) => a.id !== id) });
  };

  const toggleAPI = (id: string) => {
    const newAPIs = apis.map((a) =>
      a.id === id ? { ...a, enabled: !a.enabled } : a
    );
    updateConfig({ apis: newAPIs });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">API Gateway</p>
            <h2 className="text-2xl font-bold text-foreground">Cloud API Gateway</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Unified API management and routing
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
                <CardTitle className="text-sm font-medium text-muted-foreground">APIs</CardTitle>
                <Globe className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalAPIs}</span>
                <span className="text-xs text-muted-foreground">registered</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">API Keys</CardTitle>
                <Shield className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalKeys}</span>
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{successRate.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="apis" className="space-y-4">
          <TabsList>
            <TabsTrigger value="apis">
              <Globe className="h-4 w-4 mr-2" />
              APIs ({apis.length})
            </TabsTrigger>
            <TabsTrigger value="keys">
              <Shield className="h-4 w-4 mr-2" />
              API Keys ({keys.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="apis" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>API Routes</CardTitle>
                    <CardDescription>Registered API endpoints</CardDescription>
                  </div>
                  <Button onClick={addAPI} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create API
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {apis.map((api) => (
                    <Card key={api.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                              <Route className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{api.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="font-mono text-xs">{api.method}</Badge>
                                <Badge variant="outline" className="font-mono text-xs">{api.path}</Badge>
                                {api.rateLimit && (
                                  <Badge variant="outline">{api.rateLimit}/min</Badge>
                                )}
                                {api.requests && (
                                  <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20">
                                    {api.requests} requests
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={api.enabled}
                              onCheckedChange={() => toggleAPI(api.id)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeAPI(api.id)}
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Backend:</span>
                          <span className="ml-2 font-mono text-xs">{api.backend}</span>
                        </div>
                        {api.errors && api.errors > 0 && (
                          <div className="text-sm mt-2">
                            <span className="text-muted-foreground">Errors:</span>
                            <span className="ml-2 font-semibold text-red-500">{api.errors}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="keys" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>API Keys</CardTitle>
                    <CardDescription>API authentication keys</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateKey(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Key
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {keys.map((key) => (
                    <Card key={key.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                            <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <CardTitle className="text-lg font-semibold">{key.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="font-mono text-xs">{key.key}</Badge>
                              <Badge variant={key.enabled ? 'default' : 'outline'}>
                                {key.enabled ? 'Enabled' : 'Disabled'}
                              </Badge>
                              {key.rateLimit && (
                                <Badge variant="outline">{key.rateLimit}/min</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {key.apis.length > 0 && (
                          <div className="space-y-1">
                            <Label className="text-xs">Authorized APIs</Label>
                            <div className="flex flex-wrap gap-2">
                              {key.apis.map((apiId, idx) => {
                                const api = apis.find((a) => a.id === apiId);
                                return (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {api?.name || apiId}
                                  </Badge>
                                );
                              })}
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
                <CardTitle>API Gateway Settings</CardTitle>
                <CardDescription>Gateway configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable API Key Authentication</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Rate Limiting</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Request Logging</Label>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Default Rate Limit (requests/min)</Label>
                  <Input type="number" defaultValue={1000} min={1} />
                </div>
                <div className="space-y-2">
                  <Label>Request Timeout (seconds)</Label>
                  <Input type="number" defaultValue={30} min={1} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


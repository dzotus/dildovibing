import { useState } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Globe, Shield, Settings, Code, Zap } from 'lucide-react';
import { CanvasNode } from '@/types';

interface Endpoint {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  description?: string;
  requestBody?: string;
  responseSchema?: string;
  requiresAuth: boolean;
  rateLimit?: number;
}

interface RestApiConfig {
  baseUrl?: string;
  port?: number;
  protocol?: 'http' | 'https';
  enableCORS?: boolean;
  corsOrigins?: string[];
  enableAuthentication?: boolean;
  authType?: 'bearer' | 'basic' | 'api-key' | 'oauth2';
  apiKey?: string;
  endpoints?: Endpoint[];
  rateLimitPerMinute?: number;
}

export function RestApiConfig({ componentId }: { componentId: string }) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;
  const [activeTab, setActiveTab] = useState('endpoints');

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as RestApiConfig;
  const endpoints = config.endpoints || [];

  const updateConfig = (updates: Partial<RestApiConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addEndpoint = () => {
    const newEndpoint: Endpoint = {
      id: `endpoint-${Date.now()}`,
      path: '/api/resource',
      method: 'GET',
      requiresAuth: false,
    };
    updateConfig({ endpoints: [...endpoints, newEndpoint] });
  };

  const updateEndpoint = (index: number, updates: Partial<Endpoint>) => {
    const updated = [...endpoints];
    updated[index] = { ...updated[index], ...updates };
    updateConfig({ endpoints: updated });
  };

  const removeEndpoint = (index: number) => {
    updateConfig({ endpoints: endpoints.filter((_, i) => i !== index) });
  };

  const httpMethods: Endpoint['method'][] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

  const getMethodColor = (method: Endpoint['method']) => {
    switch (method) {
      case 'GET':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'POST':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'PUT':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'DELETE':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'PATCH':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Globe className="h-6 w-6" />
              REST API
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure API endpoints, authentication, and CORS
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border px-4">
          <TabsList className="bg-transparent">
            <TabsTrigger value="endpoints" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Endpoints
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6">
            <TabsContent value="endpoints" className="space-y-4 mt-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">API Endpoints</h3>
                  <p className="text-sm text-muted-foreground">Define REST API endpoints and their configurations</p>
                </div>
                <Button onClick={addEndpoint} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Endpoint
                </Button>
              </div>

              <div className="space-y-4">
                {endpoints.map((endpoint, index) => (
                  <div key={endpoint.id} className="border border-border rounded-lg p-4 space-y-3 bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <Badge
                          className={`font-mono font-semibold ${getMethodColor(endpoint.method)}`}
                        >
                          {endpoint.method}
                        </Badge>
                        <Input
                          value={endpoint.path}
                          onChange={(e) => updateEndpoint(index, { path: e.target.value })}
                          placeholder="/api/resource"
                          className="font-mono border-0 bg-transparent p-0 h-auto font-semibold flex-1"
                        />
                        {endpoint.requiresAuth && (
                          <Badge variant="outline" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            Auth
                          </Badge>
                        )}
                        {endpoint.rateLimit && (
                          <Badge variant="secondary" className="text-xs">
                            <Zap className="h-3 w-3 mr-1" />
                            {endpoint.rateLimit}/min
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeEndpoint(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>HTTP Method</Label>
                        <select
                          value={endpoint.method}
                          onChange={(e) =>
                            updateEndpoint(index, { method: e.target.value as Endpoint['method'] })
                          }
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono font-semibold"
                        >
                          {httpMethods.map((method) => (
                            <option key={method} value={method}>
                              {method}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          value={endpoint.description || ''}
                          onChange={(e) => updateEndpoint(index, { description: e.target.value })}
                          placeholder="Endpoint description"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={endpoint.requiresAuth}
                          onCheckedChange={(checked) => updateEndpoint(index, { requiresAuth: checked })}
                        />
                        <Label className="text-sm">Requires Authentication</Label>
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <Label className="text-sm">Rate Limit (per minute):</Label>
                        <Input
                          type="number"
                          value={endpoint.rateLimit || ''}
                          onChange={(e) =>
                            updateEndpoint(index, { rateLimit: parseInt(e.target.value) || undefined })
                          }
                          placeholder="Unlimited"
                          className="w-24"
                        />
                      </div>
                    </div>

                    {(endpoint.method === 'POST' || endpoint.method === 'PUT' || endpoint.method === 'PATCH') && (
                      <div className="space-y-2">
                        <Label>Request Body Schema (JSON)</Label>
                        <textarea
                          value={endpoint.requestBody || ''}
                          onChange={(e) => updateEndpoint(index, { requestBody: e.target.value })}
                          placeholder='{"id": "string", "name": "string", "email": "string"}'
                          className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                          rows={4}
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Response Schema (JSON)</Label>
                      <textarea
                        value={endpoint.responseSchema || ''}
                        onChange={(e) => updateEndpoint(index, { responseSchema: e.target.value })}
                        placeholder='{"id": "string", "name": "string", "createdAt": "timestamp"}'
                        className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                        rows={4}
                      />
                    </div>
                  </div>
                ))}

                {endpoints.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No endpoints defined. Click "Add Endpoint" to create one.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="security" className="space-y-4 mt-0">
              <div>
                <h3 className="text-lg font-semibold mb-4">Security & Authentication</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.enableCORS !== false}
                      onCheckedChange={(checked) => updateConfig({ enableCORS: checked })}
                    />
                    <Label>Enable CORS</Label>
                  </div>

                  {config.enableCORS && (
                    <div className="space-y-2">
                      <Label>Allowed Origins (one per line)</Label>
                      <textarea
                        value={(config.corsOrigins || []).join('\n')}
                        onChange={(e) =>
                          updateConfig({
                            corsOrigins: e.target.value.split('\n').filter((origin) => origin.trim()),
                          })
                        }
                        placeholder="http://localhost:3000&#10;https://app.example.com"
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                        rows={3}
                      />
                    </div>
                  )}

                  <Separator />

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.enableAuthentication || false}
                      onCheckedChange={(checked) => updateConfig({ enableAuthentication: checked })}
                    />
                    <Label>Enable Authentication</Label>
                  </div>

                  {config.enableAuthentication && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Authentication Type</Label>
                        <select
                          value={config.authType || 'bearer'}
                          onChange={(e) =>
                            updateConfig({ authType: e.target.value as RestApiConfig['authType'] })
                          }
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="bearer">Bearer Token</option>
                          <option value="basic">Basic Auth</option>
                          <option value="api-key">API Key</option>
                          <option value="oauth2">OAuth 2.0</option>
                        </select>
                      </div>

                      {config.authType === 'api-key' && (
                        <div className="space-y-2">
                          <Label>API Key</Label>
                          <Input
                            type="password"
                            value={config.apiKey || ''}
                            onChange={(e) => updateConfig({ apiKey: e.target.value })}
                            placeholder="••••••••"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-2">
                    <Label>Global Rate Limit (requests per minute)</Label>
                    <Input
                      type="number"
                      value={config.rateLimitPerMinute || ''}
                      onChange={(e) => updateConfig({ rateLimitPerMinute: parseInt(e.target.value) || undefined })}
                      placeholder="1000"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-0">
              <div>
                <h3 className="text-lg font-semibold mb-4">API Settings</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Base URL</Label>
                      <Input
                        value={config.baseUrl || ''}
                        onChange={(e) => updateConfig({ baseUrl: e.target.value })}
                        placeholder="/api"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Port</Label>
                      <Input
                        type="number"
                        value={config.port || ''}
                        onChange={(e) => updateConfig({ port: parseInt(e.target.value) || undefined })}
                        placeholder="8080"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Protocol</Label>
                    <select
                      value={config.protocol || 'http'}
                      onChange={(e) => updateConfig({ protocol: e.target.value as 'http' | 'https' })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="http">HTTP</option>
                      <option value="https">HTTPS</option>
                    </select>
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}


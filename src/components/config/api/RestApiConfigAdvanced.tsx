import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  Globe, 
  Code, 
  Settings, 
  Activity,
  Plus,
  Trash2,
  Play
} from 'lucide-react';

interface RestApiConfigProps {
  componentId: string;
}

interface Endpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  summary?: string;
  tags?: string[];
  requestBody?: string;
  responseExample?: string;
  parameters?: Array<{
    name: string;
    in: 'query' | 'path' | 'header';
    type: string;
    required: boolean;
  }>;
  requests?: number;
  avgResponseTime?: number;
  statusCode?: number;
}

interface RestApiConfig {
  baseUrl?: string;
  version?: string;
  title?: string;
  description?: string;
  endpoints?: Endpoint[];
  authentication?: {
    type: 'none' | 'bearer' | 'apiKey' | 'oauth2';
    token?: string;
  };
  openApiSpec?: string;
}

export function RestApiConfigAdvanced({ componentId }: RestApiConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as RestApiConfig;
  const baseUrl = config.baseUrl || 'https://api.example.com';
  const version = config.version || 'v1';
  const title = config.title || 'REST API';
  const description = config.description || 'RESTful API service';
  const endpoints = config.endpoints || [];
  const authentication = config.authentication || { type: 'none' };
  const openApiSpec = config.openApiSpec || `openapi: 3.0.0
info:
  title: ${title}
  version: ${version}
  description: ${description}
servers:
  - url: ${baseUrl}
paths:
  /users:
    get:
      summary: List users
      tags: [users]
      responses:
        '200':
          description: Successful response`;

  const updateConfig = (updates: Partial<RestApiConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addEndpoint = () => {
    updateConfig({
      endpoints: [...endpoints, { path: '/new-endpoint', method: 'GET', description: 'New endpoint', requests: 0, avgResponseTime: 0, statusCode: 200 }],
    });
  };

  const removeEndpoint = (index: number) => {
    updateConfig({ endpoints: endpoints.filter((_, i) => i !== index) });
  };

  const updateEndpoint = (index: number, field: string, value: string | number) => {
    const newEndpoints = [...endpoints];
    newEndpoints[index] = { ...newEndpoints[index], [field]: value };
    updateConfig({ endpoints: newEndpoints });
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-blue-500';
      case 'POST':
        return 'bg-green-500';
      case 'PUT':
        return 'bg-yellow-500';
      case 'DELETE':
        return 'bg-red-500';
      case 'PATCH':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Globe className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">REST API</h2>
              <p className="text-sm text-muted-foreground mt-1">
                RESTful API Service
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Active
            </Badge>
            <Button size="sm" variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              OpenAPI
            </Button>
          </div>
        </div>

        <Separator />

        {/* API Info */}
        <Card>
          <CardHeader>
            <CardTitle>API Information</CardTitle>
            <CardDescription>{baseUrl}/{version}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Base URL</Label>
                <Input value={baseUrl} onChange={(e) => updateConfig({ baseUrl: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Version</Label>
                <Input value={version} onChange={(e) => updateConfig({ version: e.target.value })} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Configuration Tabs */}
        <Tabs defaultValue="endpoints" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="endpoints" className="gap-2">
              <Code className="h-4 w-4" />
              Endpoints
            </TabsTrigger>
            <TabsTrigger value="auth" className="gap-2">
              <Settings className="h-4 w-4" />
              Authentication
            </TabsTrigger>
            <TabsTrigger value="openapi" className="gap-2">
              <Globe className="h-4 w-4" />
              OpenAPI Spec
            </TabsTrigger>
          </TabsList>

          {/* Endpoints Tab */}
          <TabsContent value="endpoints" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>API Endpoints</CardTitle>
                    <CardDescription>REST API endpoint configuration</CardDescription>
                  </div>
                  <Button size="sm" onClick={addEndpoint} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Endpoint
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {endpoints.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Code className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No endpoints configured</p>
                    <p className="text-xs mt-2">Click "Add Endpoint" to create a new endpoint</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {endpoints.map((endpoint, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge className={getMethodColor(endpoint.method)}>
                              {endpoint.method}
                            </Badge>
                            <div>
                              <CardTitle className="text-lg">{endpoint.path}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {endpoint.description} • {(endpoint.requests || 0).toLocaleString()} requests • {endpoint.avgResponseTime || 0}ms avg
                              </CardDescription>
                            </div>
                          </div>
                          {endpoints.length > 1 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeEndpoint(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Method</Label>
                            <Select
                              value={endpoint.method}
                              onValueChange={(value) => updateEndpoint(index, 'method', value)}
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
                          <div className="space-y-2">
                            <Label>Path</Label>
                            <Input
                              value={endpoint.path}
                              onChange={(e) => updateEndpoint(index, 'path', e.target.value)}
                              placeholder="/users"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Summary</Label>
                          <Input
                            value={endpoint.summary || ''}
                            onChange={(e) => updateEndpoint(index, 'summary', e.target.value)}
                            placeholder="Brief summary"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea
                            value={endpoint.description}
                            onChange={(e) => updateEndpoint(index, 'description', e.target.value)}
                            placeholder="Detailed endpoint description"
                            rows={2}
                          />
                        </div>
                        {endpoint.parameters && endpoint.parameters.length > 0 && (
                          <div className="space-y-2">
                            <Label>Parameters</Label>
                            <div className="space-y-2">
                              {endpoint.parameters.map((param, pIndex) => (
                                <div key={pIndex} className="flex items-center gap-2 p-2 border rounded">
                                  <Badge variant="outline">{param.in}</Badge>
                                  <span className="text-sm font-mono">{param.name}</span>
                                  <span className="text-xs text-muted-foreground">({param.type})</span>
                                  {param.required && <Badge variant="destructive" className="text-xs">required</Badge>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {endpoint.requestBody && (
                          <div className="space-y-2">
                            <Label>Request Body Example</Label>
                            <Textarea
                              value={endpoint.requestBody}
                              onChange={(e) => updateEndpoint(index, 'requestBody', e.target.value)}
                              className="font-mono text-sm"
                              rows={6}
                            />
                          </div>
                        )}
                        {endpoint.responseExample && (
                          <div className="space-y-2">
                            <Label>Response Example</Label>
                            <Textarea
                              value={endpoint.responseExample}
                              onChange={(e) => updateEndpoint(index, 'responseExample', e.target.value)}
                              className="font-mono text-sm"
                              rows={6}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Authentication Tab */}
          <TabsContent value="auth" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Authentication</CardTitle>
                <CardDescription>API authentication configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Authentication Type</Label>
                  <Select
                    value={authentication.type}
                    onValueChange={(value) => updateConfig({ authentication: { ...authentication, type: value as any } })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="bearer">Bearer Token</SelectItem>
                      <SelectItem value="apiKey">API Key</SelectItem>
                      <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {authentication.type !== 'none' && (
                  <div className="space-y-2">
                    <Label>Token / API Key</Label>
                    <Input
                      type="password"
                      value={authentication.token || ''}
                      onChange={(e) => updateConfig({ authentication: { ...authentication, token: e.target.value } })}
                      placeholder="Enter token or API key"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* OpenAPI Spec Tab */}
          <TabsContent value="openapi" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>OpenAPI Specification</CardTitle>
                <CardDescription>OpenAPI 3.0 specification document</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>OpenAPI YAML</Label>
                  <Textarea
                    value={openApiSpec}
                    onChange={(e) => updateConfig({ openApiSpec: e.target.value })}
                    className="font-mono text-sm h-96"
                    placeholder="openapi: 3.0.0..."
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


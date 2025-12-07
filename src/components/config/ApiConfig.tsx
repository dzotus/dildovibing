import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface ApiConfigProps {
  componentId: string;
}

interface Endpoint {
  path: string;
  method: string;
  description: string;
}

interface ApiConfig {
  baseUrl?: string;
  port?: number;
  protocol?: string;
  endpoints?: Endpoint[];
}

export function ApiConfig({ componentId }: ApiConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as ApiConfig;
  const baseUrl = config.baseUrl || '/api';
  const port = config.port || 8080;
  const protocol = config.protocol || 'http';
  const endpoints = config.endpoints || [
    { path: '/users', method: 'GET', description: 'List users' },
  ];

  const updateConfig = (updates: Partial<ApiConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addEndpoint = () => {
    updateConfig({
      endpoints: [
        ...endpoints,
        { path: '/new-endpoint', method: 'GET', description: 'New endpoint' },
      ],
    });
  };

  const removeEndpoint = (index: number) => {
    updateConfig({ endpoints: endpoints.filter((_, i) => i !== index) });
  };

  const updateEndpoint = (index: number, field: string, value: string) => {
    const newEndpoints = [...endpoints];
    newEndpoints[index] = { ...newEndpoints[index], [field]: value };
    updateConfig({ endpoints: newEndpoints });
  };

  const getApiType = () => {
    switch (node.type) {
      case 'rest':
        return 'REST API';
      case 'grpc':
        return 'gRPC API';
      case 'websocket':
        return 'WebSocket API';
      default:
        return 'API';
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{getApiType()} Configuration</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure API endpoints and connection settings
          </p>
        </div>

        <Separator />

        {/* Connection Settings */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Connection</h3>
            <p className="text-sm text-muted-foreground">API server connection details</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="protocol">Protocol</Label>
              <Select
                value={protocol}
                onValueChange={(value) => updateConfig({ protocol: value })}
              >
                <SelectTrigger id="protocol">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="http">HTTP</SelectItem>
                  <SelectItem value="https">HTTPS</SelectItem>
                  <SelectItem value="ws">WebSocket</SelectItem>
                  <SelectItem value="wss">WebSocket Secure</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                value={port}
                onChange={(e) => updateConfig({ port: parseInt(e.target.value) || 8080 })}
                placeholder="8080"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="base-url">Base URL</Label>
              <Input
                id="base-url"
                value={baseUrl}
                onChange={(e) => updateConfig({ baseUrl: e.target.value })}
                placeholder="/api"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Endpoints Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Endpoints</h3>
              <p className="text-sm text-muted-foreground">API endpoint definitions</p>
            </div>
            <Button size="sm" onClick={addEndpoint} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Endpoint
            </Button>
          </div>

          <div className="space-y-4">
            {endpoints.map((endpoint, index) => (
              <div key={index} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Endpoint {index + 1}</Label>
                  {endpoints.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeEndpoint(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`method-${index}`}>Method</Label>
                    <Select
                      value={endpoint.method}
                      onValueChange={(value) => updateEndpoint(index, 'method', value)}
                    >
                      <SelectTrigger id={`method-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="PATCH">PATCH</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor={`path-${index}`}>Path</Label>
                    <Input
                      id={`path-${index}`}
                      value={endpoint.path}
                      onChange={(e) => updateEndpoint(index, 'path', e.target.value)}
                      placeholder="/endpoint"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`description-${index}`}>Description</Label>
                  <Textarea
                    id={`description-${index}`}
                    value={endpoint.description}
                    onChange={(e) => updateEndpoint(index, 'description', e.target.value)}
                    placeholder="Endpoint description"
                    rows={2}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

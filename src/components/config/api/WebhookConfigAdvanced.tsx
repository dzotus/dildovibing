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
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Webhook,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Shield,
  Send
} from 'lucide-react';

interface WebhookConfigProps {
  componentId: string;
}

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  secret?: string;
  enabled: boolean;
  events: string[];
  headers?: Record<string, string>;
}

interface Delivery {
  id: string;
  endpointId: string;
  event: string;
  payload: string;
  status: 'pending' | 'success' | 'failed';
  timestamp: string;
  attempts?: number;
  responseCode?: number;
  responseBody?: string;
}

interface WebhookConfig {
  endpoints?: WebhookEndpoint[];
  deliveries?: Delivery[];
  totalEndpoints?: number;
  totalDeliveries?: number;
  successRate?: number;
}

export function WebhookConfigAdvanced({ componentId }: WebhookConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as WebhookConfig;
  const endpoints = config.endpoints || [];
  const deliveries = config.deliveries || [];
  const totalEndpoints = config.totalEndpoints || endpoints.length;
  const totalDeliveries = config.totalDeliveries || deliveries.length;
  const successRate = config.successRate || (deliveries.length > 0 ? (deliveries.filter((d) => d.status === 'success').length / deliveries.length) * 100 : 0);

  const [showCreateEndpoint, setShowCreateEndpoint] = useState(false);

  const updateConfig = (updates: Partial<WebhookConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addEndpoint = () => {
    const newEndpoint: WebhookEndpoint = {
      id: `wh-${Date.now()}`,
      name: 'New Webhook',
      url: 'https://api.example.com/webhooks/new',
      method: 'POST',
      enabled: true,
      events: [],
    };
    updateConfig({ endpoints: [...endpoints, newEndpoint] });
    setShowCreateEndpoint(false);
  };

  const removeEndpoint = (id: string) => {
    updateConfig({ endpoints: endpoints.filter((e) => e.id !== id) });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'pending':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Webhook</p>
            <h2 className="text-2xl font-bold text-foreground">Webhook Endpoint</h2>
            <p className="text-sm text-muted-foreground mt-1">
              HTTP callback endpoint for event notifications
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

        <div className="grid grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Endpoints</CardTitle>
                <Webhook className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalEndpoints}</span>
                <span className="text-xs text-muted-foreground">configured</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Deliveries</CardTitle>
                <Send className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalDeliveries}</span>
                <span className="text-xs text-muted-foreground">total</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
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
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="endpoints" className="space-y-4">
          <TabsList>
            <TabsTrigger value="endpoints">
              <Webhook className="h-4 w-4 mr-2" />
              Endpoints ({endpoints.length})
            </TabsTrigger>
            <TabsTrigger value="deliveries">
              <Activity className="h-4 w-4 mr-2" />
              Deliveries ({deliveries.length})
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
                    <CardTitle>Webhook Endpoints</CardTitle>
                    <CardDescription>Configure webhook endpoints</CardDescription>
                  </div>
                  <Button onClick={addEndpoint} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Endpoint
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {endpoints.map((endpoint) => (
                    <Card key={endpoint.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                              <Webhook className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{endpoint.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant={endpoint.enabled ? 'default' : 'outline'}>
                                  {endpoint.enabled ? 'Enabled' : 'Disabled'}
                                </Badge>
                                <Badge variant="outline" className="font-mono text-xs">{endpoint.method}</Badge>
                                <Badge variant="outline" className="font-mono text-xs truncate max-w-xs">{endpoint.url}</Badge>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeEndpoint(endpoint.id)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {endpoint.events && endpoint.events.length > 0 && (
                          <div className="space-y-2">
                            <Label>Events</Label>
                            <div className="flex flex-wrap gap-2">
                              {endpoint.events.map((event, idx) => (
                                <Badge key={idx} variant="outline">{event}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {endpoint.secret && (
                          <div className="mt-2">
                            <Label>Secret</Label>
                            <div className="text-xs font-mono text-muted-foreground">{endpoint.secret}</div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deliveries" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Delivery History</CardTitle>
                <CardDescription>Webhook delivery attempts and results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {deliveries.map((delivery) => (
                    <Card key={delivery.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getStatusColor(delivery.status)}/20`}>
                              {delivery.status === 'success' ? (
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                              ) : delivery.status === 'failed' ? (
                                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                              ) : (
                                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                              )}
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{delivery.event}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className={getStatusColor(delivery.status)}>
                                  {delivery.status}
                                </Badge>
                                {delivery.attempts && (
                                  <Badge variant="outline">Attempts: {delivery.attempts}</Badge>
                                )}
                                {delivery.responseCode && (
                                  <Badge variant="outline">HTTP {delivery.responseCode}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <Label>Payload</Label>
                          <pre className="p-3 bg-muted rounded text-xs font-mono overflow-x-auto max-h-40 overflow-y-auto">{delivery.payload}</pre>
                        </div>
                        {delivery.responseBody && (
                          <div className="space-y-2 mt-2">
                            <Label>Response</Label>
                            <pre className="p-3 bg-muted rounded text-xs font-mono overflow-x-auto max-h-40 overflow-y-auto">{delivery.responseBody}</pre>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-2">
                          {new Date(delivery.timestamp).toLocaleString()}
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
                <CardTitle>Webhook Settings</CardTitle>
                <CardDescription>Global configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Retry on Failure</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Signature Verification</Label>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Max Retry Attempts</Label>
                  <Input type="number" defaultValue={3} min={1} max={10} />
                </div>
                <div className="space-y-2">
                  <Label>Retry Delay (seconds)</Label>
                  <Input type="number" defaultValue={5} min={1} />
                </div>
                <div className="space-y-2">
                  <Label>Timeout (seconds)</Label>
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


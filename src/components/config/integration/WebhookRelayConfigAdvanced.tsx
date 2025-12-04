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
  Webhook,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Network
} from 'lucide-react';

interface WebhookRelayConfigProps {
  componentId: string;
}

interface Relay {
  id: string;
  name: string;
  sourceUrl: string;
  targetUrl: string;
  enabled: boolean;
  events?: string[];
  requests?: number;
  successRate?: number;
}

interface Delivery {
  id: string;
  relayId: string;
  event: string;
  payload: string;
  status: 'pending' | 'success' | 'failed';
  timestamp: string;
  attempts?: number;
  responseCode?: number;
}

interface WebhookRelayConfig {
  relays?: Relay[];
  deliveries?: Delivery[];
  totalRelays?: number;
  totalDeliveries?: number;
  successRate?: number;
}

export function WebhookRelayConfigAdvanced({ componentId }: WebhookRelayConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as WebhookRelayConfig;
  const relays = config.relays || [];
  const deliveries = config.deliveries || [];
  const totalRelays = config.totalRelays || relays.length;
  const totalDeliveries = config.totalDeliveries || deliveries.length;
  const successRate = config.successRate || (deliveries.length > 0 ? (deliveries.filter((d) => d.status === 'success').length / deliveries.length) * 100 : 0);

  const [showCreateRelay, setShowCreateRelay] = useState(false);

  const updateConfig = (updates: Partial<WebhookRelayConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addRelay = () => {
    const newRelay: Relay = {
      id: `relay-${Date.now()}`,
      name: 'New Webhook Relay',
      sourceUrl: 'https://source.example.com/webhooks',
      targetUrl: 'https://target.example.com/webhooks',
      enabled: true,
      events: [],
    };
    updateConfig({ relays: [...relays, newRelay] });
    setShowCreateRelay(false);
  };

  const removeRelay = (id: string) => {
    updateConfig({ relays: relays.filter((r) => r.id !== id) });
  };

  const toggleRelay = (id: string) => {
    const newRelays = relays.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    updateConfig({ relays: newRelays });
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
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Webhook Relay</p>
            <h2 className="text-2xl font-bold text-foreground">Webhook Relay Service</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Relay and forward webhook events between services
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Relays</CardTitle>
                <Webhook className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalRelays}</span>
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

        <Tabs defaultValue="relays" className="space-y-4">
          <TabsList>
            <TabsTrigger value="relays">
              <Webhook className="h-4 w-4 mr-2" />
              Relays ({relays.length})
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

          <TabsContent value="relays" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Webhook Relays</CardTitle>
                    <CardDescription>Configure webhook relay rules</CardDescription>
                  </div>
                  <Button onClick={addRelay} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Relay
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {relays.map((relay) => (
                    <Card key={relay.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                              <Webhook className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{relay.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant={relay.enabled ? 'default' : 'outline'}>
                                  {relay.enabled ? 'Enabled' : 'Disabled'}
                                </Badge>
                                {relay.successRate && (
                                  <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20">
                                    {relay.successRate.toFixed(1)}% success
                                  </Badge>
                                )}
                                {relay.requests && (
                                  <Badge variant="outline">{relay.requests} requests</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={relay.enabled}
                              onCheckedChange={() => toggleRelay(relay.id)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeRelay(relay.id)}
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Source:</span>
                            <span className="ml-2 font-mono text-xs">{relay.sourceUrl}</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">Target:</span>
                            <span className="ml-2 font-mono text-xs">{relay.targetUrl}</span>
                          </div>
                        </div>
                        {relay.events && relay.events.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <Label className="text-xs">Events</Label>
                            <div className="flex flex-wrap gap-2">
                              {relay.events.map((event, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">{event}</Badge>
                              ))}
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
                <CardTitle>Webhook Relay Settings</CardTitle>
                <CardDescription>Relay configuration</CardDescription>
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
                <div className="flex items-center justify-between">
                  <Label>Enable Request Logging</Label>
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


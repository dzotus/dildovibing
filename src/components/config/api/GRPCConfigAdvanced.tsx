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
  Play,
  Code,
  FileText,
  CheckCircle,
  XCircle,
  Zap,
  Network,
  Server
} from 'lucide-react';

interface GRPCConfigProps {
  componentId: string;
}

interface Service {
  name: string;
  methods: Array<{
    name: string;
    inputType: string;
    outputType: string;
    streaming?: 'unary' | 'client-streaming' | 'server-streaming' | 'bidirectional';
  }>;
}

interface Call {
  id: string;
  service: string;
  method: string;
  request?: string;
  response?: string;
  status: 'success' | 'error';
  timestamp: string;
  duration?: number;
}

interface GRPCConfig {
  services?: Service[];
  calls?: Call[];
  endpoint?: string;
  reflectionEnabled?: boolean;
  totalCalls?: number;
  successRate?: number;
  averageLatency?: number;
}

export function GRPCConfigAdvanced({ componentId }: GRPCConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as GRPCConfig;
  const services = config.services || [];
  const calls = config.calls || [];
  const endpoint = config.endpoint || 'localhost:50051';
  const reflectionEnabled = config.reflectionEnabled ?? true;
  const totalCalls = config.totalCalls || calls.length;
  const successRate = config.successRate || (calls.length > 0 ? (calls.filter((c) => c.status === 'success').length / calls.length) * 100 : 0);
  const averageLatency = config.averageLatency || (calls.length > 0 ? calls.reduce((sum, c) => sum + (c.duration || 0), 0) / calls.length : 0);

  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [requestText, setRequestText] = useState('{}');
  const [responseText, setResponseText] = useState('');

  const updateConfig = (updates: Partial<GRPCConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const executeCall = () => {
    if (!selectedService || !selectedMethod) return;
    const newCall: Call = {
      id: `call-${Date.now()}`,
      service: selectedService,
      method: selectedMethod,
      request: requestText,
      response: JSON.stringify({ success: true, data: {} }, null, 2),
      status: 'success',
      timestamp: new Date().toISOString(),
      duration: Math.floor(Math.random() * 50) + 10,
    };
    setResponseText(newCall.response);
    updateConfig({ calls: [...calls, newCall] });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">gRPC</p>
            <h2 className="text-2xl font-bold text-foreground">gRPC Service</h2>
            <p className="text-sm text-muted-foreground mt-1">
              High-performance RPC framework
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Services</CardTitle>
                <Server className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{services.length}</span>
                <span className="text-xs text-muted-foreground">registered</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Calls</CardTitle>
                <Activity className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalCalls}</span>
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
          <Card className="border-l-4 border-l-cyan-500 bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-950/20 dark:to-background">
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

        <Tabs defaultValue="test" className="space-y-4">
          <TabsList>
            <TabsTrigger value="test">
              <Play className="h-4 w-4 mr-2" />
              Test Client
            </TabsTrigger>
            <TabsTrigger value="services">
              <Server className="h-4 w-4 mr-2" />
              Services ({services.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              <Activity className="h-4 w-4 mr-2" />
              Call History ({calls.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="test" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>gRPC Test Client</CardTitle>
                <CardDescription>Test gRPC methods and services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Service</Label>
                    <Select value={selectedService} onValueChange={(value) => {
                      setSelectedService(value);
                      const service = services.find((s) => s.name === value);
                      if (service && service.methods.length > 0) {
                        setSelectedMethod(service.methods[0].name);
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select service" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((s) => (
                          <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Method</Label>
                    <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedService && services.find((s) => s.name === selectedService)?.methods.map((m) => (
                          <SelectItem key={m.name} value={m.name}>
                            {m.name} ({m.streaming || 'unary'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Request (JSON)</Label>
                    <Textarea
                      value={requestText}
                      onChange={(e) => setRequestText(e.target.value)}
                      className="font-mono text-sm min-h-[200px]"
                      placeholder='{ "id": "1" }'
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Response</Label>
                    <Textarea
                      value={responseText}
                      readOnly
                      className="font-mono text-sm min-h-[200px] bg-muted"
                      placeholder="Response will appear here..."
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={executeCall} disabled={!selectedService || !selectedMethod}>
                    <Play className="h-4 w-4 mr-2" />
                    Execute Call
                  </Button>
                  <Button variant="outline" onClick={() => { setRequestText('{}'); setResponseText(''); }}>
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Services</CardTitle>
                <CardDescription>Registered gRPC services and methods</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {services.map((service) => (
                    <Card key={service.name} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                            <Server className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <CardTitle className="text-lg font-semibold">{service.name}</CardTitle>
                            <Badge variant="outline" className="mt-2">{service.methods.length} methods</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {service.methods.map((method) => (
                            <div key={method.name} className="p-3 border rounded">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold">{method.name}</span>
                                <Badge variant="outline" className="text-xs">{method.streaming || 'unary'}</Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                <span className="font-mono">{method.inputType}</span>
                                <span className="mx-2">→</span>
                                <span className="font-mono">{method.outputType}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Call History</CardTitle>
                <CardDescription>Previously executed gRPC calls</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {calls.map((call) => (
                    <Card key={call.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${call.status === 'success' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                              {call.status === 'success' ? (
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                              )}
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{call.service}.{call.method}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                {call.duration && (
                                  <Badge variant="outline">{call.duration}ms</Badge>
                                )}
                                <Badge variant={call.status === 'success' ? 'default' : 'destructive'}>
                                  {call.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          {call.request && (
                            <div className="space-y-2">
                              <Label>Request</Label>
                              <pre className="p-3 bg-muted rounded text-xs font-mono overflow-x-auto">{call.request}</pre>
                            </div>
                          )}
                          {call.response && (
                            <div className="space-y-2">
                              <Label>Response</Label>
                              <pre className="p-3 bg-muted rounded text-xs font-mono overflow-x-auto">{call.response}</pre>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          {new Date(call.timestamp).toLocaleString()}
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
                <CardTitle>gRPC Settings</CardTitle>
                <CardDescription>Service configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Endpoint</Label>
                  <Input
                    value={endpoint}
                    onChange={(e) => updateConfig({ endpoint: e.target.value })}
                    placeholder="localhost:50051"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Enable Reflection</Label>
                  <Switch
                    checked={reflectionEnabled}
                    onCheckedChange={(checked) => updateConfig({ reflectionEnabled: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable TLS</Label>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Compression</Label>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Max Message Size (MB)</Label>
                  <Input type="number" defaultValue={4} min={1} max={100} />
                </div>
                <div className="space-y-2">
                  <Label>Keep Alive Time (seconds)</Label>
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


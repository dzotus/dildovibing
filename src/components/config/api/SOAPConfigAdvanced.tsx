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
  FileText,
  CheckCircle,
  XCircle,
  Code,
  Zap,
  Server
} from 'lucide-react';

interface SOAPConfigProps {
  componentId: string;
}

interface Operation {
  name: string;
  inputMessage?: string;
  outputMessage?: string;
  faults?: string[];
}

interface Service {
  name: string;
  port: string;
  operations: Operation[];
  wsdlUrl?: string;
}

interface Request {
  id: string;
  operation: string;
  requestBody: string;
  responseBody?: string;
  status: 'success' | 'error';
  timestamp: string;
  duration?: number;
}

interface SOAPConfig {
  services?: Service[];
  requests?: Request[];
  endpoint?: string;
  wsdlUrl?: string;
  totalRequests?: number;
  successRate?: number;
  averageLatency?: number;
  enableWSSecurity?: boolean;
  enableWSAddressing?: boolean;
  soapVersion?: '1.1' | '1.2';
}

export function SOAPConfigAdvanced({ componentId }: SOAPConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as SOAPConfig;
  const services = config.services || [];
  const requests = config.requests || [];
  const endpoint = config.endpoint || 'http://localhost:8080/soap';
  const wsdlUrl = config.wsdlUrl || services[0]?.wsdlUrl || '';
  const totalRequests = config.totalRequests || requests.length;
  const successRate = config.successRate || (requests.length > 0 ? (requests.filter((r) => r.status === 'success').length / requests.length) * 100 : 0);
  const averageLatency = config.averageLatency || (requests.length > 0 ? requests.reduce((sum, r) => sum + (r.duration || 0), 0) / requests.length : 0);

  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedOperation, setSelectedOperation] = useState<string>('');
  const [requestBody, setRequestBody] = useState('');
  const [responseBody, setResponseBody] = useState('');

  const updateConfig = (updates: Partial<SOAPConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const executeRequest = () => {
    if (!selectedOperation) return;
    const newRequest: Request = {
      id: `req-${Date.now()}`,
      operation: selectedOperation,
      requestBody: requestBody || `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${selectedOperation}Request>
      <!-- Request data -->
    </${selectedOperation}Request>
  </soap:Body>
</soap:Envelope>`,
      responseBody: `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${selectedOperation}Response>
      <!-- Response data -->
    </${selectedOperation}Response>
  </soap:Body>
</soap:Envelope>`,
      status: 'success',
      timestamp: new Date().toISOString(),
      duration: Math.floor(Math.random() * 200) + 50,
    };
    setResponseBody(newRequest.responseBody || '');
    updateConfig({ requests: [...requests, newRequest] });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">SOAP</p>
            <h2 className="text-2xl font-bold text-foreground">SOAP Web Service</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Simple Object Access Protocol web service
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Requests</CardTitle>
                <Activity className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalRequests}</span>
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
              Request History ({requests.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="test" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>SOAP Test Client</CardTitle>
                <CardDescription>Test SOAP operations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Service</Label>
                    <Select value={selectedService} onValueChange={(value) => {
                      setSelectedService(value);
                      const service = services.find((s) => s.name === value);
                      if (service && service.operations.length > 0) {
                        setSelectedOperation(service.operations[0].name);
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
                    <Label>Operation</Label>
                    <Select value={selectedOperation} onValueChange={setSelectedOperation}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select operation" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedService && services.find((s) => s.name === selectedService)?.operations.map((op) => (
                          <SelectItem key={op.name} value={op.name}>{op.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>SOAP Request (XML)</Label>
                    <Textarea
                      value={requestBody}
                      onChange={(e) => setRequestBody(e.target.value)}
                      className="font-mono text-sm min-h-[300px]"
                      placeholder="&lt;soap:Envelope&gt;..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SOAP Response</Label>
                    <Textarea
                      value={responseBody}
                      readOnly
                      className="font-mono text-sm min-h-[300px] bg-muted"
                      placeholder="Response will appear here..."
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={executeRequest} disabled={!selectedOperation}>
                    <Play className="h-4 w-4 mr-2" />
                    Execute Request
                  </Button>
                  <Button variant="outline" onClick={() => { setRequestBody(''); setResponseBody(''); }}>
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>SOAP Services</CardTitle>
                <CardDescription>Registered services and operations</CardDescription>
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
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline">{service.port}</Badge>
                              <Badge variant="outline">{service.operations.length} operations</Badge>
                            </div>
                            {service.wsdlUrl && (
                              <div className="text-xs text-muted-foreground mt-1">
                                WSDL: {service.wsdlUrl}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {service.operations.map((op) => (
                            <div key={op.name} className="p-3 border rounded">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold">{op.name}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {op.inputMessage && <span>Input: {op.inputMessage}</span>}
                                {op.outputMessage && (
                                  <>
                                    <span className="mx-2">→</span>
                                    <span>Output: {op.outputMessage}</span>
                                  </>
                                )}
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
                <CardTitle>Request History</CardTitle>
                <CardDescription>Previously executed SOAP requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {requests.map((req) => (
                    <Card key={req.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${req.status === 'success' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                              {req.status === 'success' ? (
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                              )}
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{req.operation}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                {req.duration && (
                                  <Badge variant="outline">{req.duration}ms</Badge>
                                )}
                                <Badge variant={req.status === 'success' ? 'default' : 'destructive'}>
                                  {req.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Request</Label>
                            <pre className="p-3 bg-muted rounded text-xs font-mono overflow-x-auto max-h-40 overflow-y-auto">{req.requestBody}</pre>
                          </div>
                          {req.responseBody && (
                            <div className="space-y-2">
                              <Label>Response</Label>
                              <pre className="p-3 bg-muted rounded text-xs font-mono overflow-x-auto max-h-40 overflow-y-auto">{req.responseBody}</pre>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          {new Date(req.timestamp).toLocaleString()}
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
                <CardTitle>SOAP Settings</CardTitle>
                <CardDescription>Service configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Endpoint URL</Label>
                  <Input
                    value={endpoint}
                    onChange={(e) => updateConfig({ endpoint: e.target.value })}
                    placeholder="http://localhost:8080/soap"
                  />
                </div>
                <div className="space-y-2">
                  <Label>WSDL URL</Label>
                  <Input
                    value={wsdlUrl}
                    onChange={(e) => updateConfig({ wsdlUrl: e.target.value })}
                    placeholder="http://localhost:8080/wsdl/service.wsdl"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Enable WS-Security</Label>
                  <Switch 
                    checked={config.enableWSSecurity ?? false}
                    onCheckedChange={(checked) => updateConfig({ enableWSSecurity: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable WS-Addressing</Label>
                  <Switch 
                    checked={config.enableWSAddressing ?? false}
                    onCheckedChange={(checked) => updateConfig({ enableWSAddressing: checked })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>SOAP Version</Label>
                  <Select 
                    value={config.soapVersion ?? '1.1'}
                    onValueChange={(value: '1.1' | '1.2') => updateConfig({ soapVersion: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.1">SOAP 1.1</SelectItem>
                      <SelectItem value="1.2">SOAP 1.2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { emulationEngine } from '@/core/EmulationEngine';
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
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  Server,
  Shield,
  Network,
  Download,
  Upload,
  Edit
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
  const { getComponentMetrics } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  // Get SOAP emulation engine for real-time metrics
  const soapEngine = emulationEngine.getSOAPEmulationEngine(componentId);
  const componentMetrics = getComponentMetrics(componentId);
  const customMetrics = componentMetrics?.customMetrics || {};

  const config = (node.data.config as any) || {} as SOAPConfig;
  const services = config.services || [];
  const requests = config.requests || [];
  const endpoint = config.endpoint || 'http://localhost:8080/soap';
  const wsdlUrl = config.wsdlUrl || services[0]?.wsdlUrl || '';
  
  // Get real-time metrics from emulation engine or fallback to config
  const soapMetrics = soapEngine?.getSOAPMetrics();
  const totalRequests = soapMetrics?.totalRequests ?? config.totalRequests ?? requests.length;
  const successRate = soapMetrics?.successRate ?? config.successRate ?? (requests.length > 0 ? (requests.filter((r) => r.status === 'success').length / requests.length) * 100 : 0);
  const averageLatency = soapMetrics?.averageLatency ?? config.averageLatency ?? (requests.length > 0 ? requests.reduce((sum, r) => sum + (r.duration || 0), 0) / requests.length : 0);
  const requestsPerSecond = soapMetrics?.requestsPerSecond ?? customMetrics.requests_per_second ?? 0;
  const errorRate = soapMetrics?.errorRate ?? customMetrics.error_rate ?? 0;

  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedOperation, setSelectedOperation] = useState<string>('');
  const [requestBody, setRequestBody] = useState('');
  const [responseBody, setResponseBody] = useState('');
  const [wsdlXml, setWSDLXml] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // CRUD states for services
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePort, setNewServicePort] = useState('default');
  const [newServiceWSDLUrl, setNewServiceWSDLUrl] = useState('');
  
  // CRUD states for operations
  const [showOperationDialog, setShowOperationDialog] = useState(false);
  const [editingOperation, setEditingOperation] = useState<{ service: Service; operation: Operation } | null>(null);
  const [operationServiceName, setOperationServiceName] = useState('');
  const [newOperationName, setNewOperationName] = useState('');
  const [newOperationInput, setNewOperationInput] = useState('');
  const [newOperationOutput, setNewOperationOutput] = useState('');

  // Auto-refresh metrics every 2 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      // Force re-render by updating state
      setWSDLXml(wsdlXml); // Trigger re-render
    }, 2000);
    return () => clearInterval(interval);
  }, [autoRefresh, wsdlXml]);

  const updateConfig = (updates: Partial<SOAPConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };
  
  // CRUD functions for services
  const addService = () => {
    if (!newServiceName.trim()) {
      toast({
        title: 'Error',
        description: 'Service name is required',
        variant: 'destructive',
      });
      return;
    }
    
    if (services.find(s => s.name === newServiceName)) {
      toast({
        title: 'Error',
        description: 'Service with this name already exists',
        variant: 'destructive',
      });
      return;
    }
    
    const newService: Service = {
      name: newServiceName,
      port: newServicePort,
      operations: [],
      wsdlUrl: newServiceWSDLUrl || undefined,
    };
    
    updateConfig({ services: [...services, newService] });
    toast({
      title: 'Success',
      description: `Service "${newServiceName}" added successfully`,
    });
    
    setNewServiceName('');
    setNewServicePort('default');
    setNewServiceWSDLUrl('');
    setShowServiceDialog(false);
  };
  
  const editService = (service: Service) => {
    setEditingService(service);
    setNewServiceName(service.name);
    setNewServicePort(service.port);
    setNewServiceWSDLUrl(service.wsdlUrl || '');
    setShowServiceDialog(true);
  };
  
  const saveService = () => {
    if (!newServiceName.trim() || !editingService) return;
    
    const updatedServices = services.map(s => 
      s.name === editingService.name
        ? { ...s, name: newServiceName, port: newServicePort, wsdlUrl: newServiceWSDLUrl || undefined }
        : s
    );
    
    updateConfig({ services: updatedServices });
    toast({
      title: 'Success',
      description: `Service "${newServiceName}" updated successfully`,
    });
    
    setEditingService(null);
    setNewServiceName('');
    setNewServicePort('default');
    setNewServiceWSDLUrl('');
    setShowServiceDialog(false);
  };
  
  const deleteService = (serviceName: string) => {
    if (services.find(s => s.name === serviceName)?.operations.length > 0) {
      toast({
        title: 'Error',
        description: 'Cannot delete service with operations. Delete operations first.',
        variant: 'destructive',
      });
      return;
    }
    
    updateConfig({ services: services.filter(s => s.name !== serviceName) });
    toast({
      title: 'Success',
      description: `Service "${serviceName}" deleted successfully`,
    });
  };
  
  // CRUD functions for operations
  const addOperation = () => {
    if (!operationServiceName || !newOperationName.trim()) {
      toast({
        title: 'Error',
        description: 'Service and operation name are required',
        variant: 'destructive',
      });
      return;
    }
    
    const service = services.find(s => s.name === operationServiceName);
    if (!service) return;
    
    if (service.operations.find(op => op.name === newOperationName)) {
      toast({
        title: 'Error',
        description: 'Operation with this name already exists in this service',
        variant: 'destructive',
      });
      return;
    }
    
    const newOperation: Operation = {
      name: newOperationName,
      inputMessage: newOperationInput || undefined,
      outputMessage: newOperationOutput || undefined,
    };
    
    const updatedServices = services.map(s =>
      s.name === operationServiceName
        ? { ...s, operations: [...s.operations, newOperation] }
        : s
    );
    
    updateConfig({ services: updatedServices });
    toast({
      title: 'Success',
      description: `Operation "${newOperationName}" added to service "${operationServiceName}"`,
    });
    
    setNewOperationName('');
    setNewOperationInput('');
    setNewOperationOutput('');
    setShowOperationDialog(false);
  };
  
  const editOperation = (service: Service, operation: Operation) => {
    setEditingOperation({ service, operation });
    setOperationServiceName(service.name);
    setNewOperationName(operation.name);
    setNewOperationInput(operation.inputMessage || '');
    setNewOperationOutput(operation.outputMessage || '');
    setShowOperationDialog(true);
  };
  
  const saveOperation = () => {
    if (!operationServiceName || !newOperationName.trim() || !editingOperation) return;
    
    const updatedServices = services.map(s =>
      s.name === operationServiceName
        ? {
            ...s,
            operations: s.operations.map(op =>
              op.name === editingOperation.operation.name
                ? {
                    ...op,
                    name: newOperationName,
                    inputMessage: newOperationInput || undefined,
                    outputMessage: newOperationOutput || undefined,
                  }
                : op
            ),
          }
        : s
    );
    
    updateConfig({ services: updatedServices });
    toast({
      title: 'Success',
      description: `Operation "${newOperationName}" updated successfully`,
    });
    
    setEditingOperation(null);
    setNewOperationName('');
    setNewOperationInput('');
    setNewOperationOutput('');
    setShowOperationDialog(false);
  };
  
  const deleteOperation = (serviceName: string, operationName: string) => {
    const updatedServices = services.map(s =>
      s.name === serviceName
        ? { ...s, operations: s.operations.filter(op => op.name !== operationName) }
        : s
    );
    
    updateConfig({ services: updatedServices });
    toast({
      title: 'Success',
      description: `Operation "${operationName}" deleted from service "${serviceName}"`,
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
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setAutoRefresh(!autoRefresh);
              }}
            >
              <RefreshCcw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto Refresh' : 'Manual'}
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-card">
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
          <Card className="border-l-4 border-l-green-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Requests/sec</CardTitle>
                <Activity className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{requestsPerSecond.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">per second</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total: {totalRequests}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-card">
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
          <Card className="border-l-4 border-l-cyan-500 bg-card">
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
              {soapMetrics?.throughputTrends && (
                <div className="mt-2 text-xs">
                  <span className={`inline-flex items-center gap-1 ${
                    soapMetrics.throughputTrends.trend === 'increasing' ? 'text-green-600' :
                    soapMetrics.throughputTrends.trend === 'decreasing' ? 'text-red-600' :
                    'text-muted-foreground'
                  }`}>
                    {soapMetrics.throughputTrends.trend === 'increasing' ? '↑' :
                     soapMetrics.throughputTrends.trend === 'decreasing' ? '↓' : '→'}
                    {soapMetrics.throughputTrends.changePercent > 0 ? '+' : ''}
                    {soapMetrics.throughputTrends.changePercent.toFixed(1)}%
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Throughput Trends */}
        {soapMetrics?.throughputTrends && (
          <Card>
            <CardHeader>
              <CardTitle>Throughput Trends</CardTitle>
              <CardDescription>Request rate changes over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Current RPS</p>
                  <p className="text-2xl font-bold">{soapMetrics.throughputTrends.current.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Previous RPS</p>
                  <p className="text-2xl font-bold">{soapMetrics.throughputTrends.previous.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Peak RPS</p>
                  <p className="text-2xl font-bold">{soapMetrics.throughputTrends.peak.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Trend</p>
                  <p className={`text-2xl font-bold ${
                    soapMetrics.throughputTrends.trend === 'increasing' ? 'text-green-600' :
                    soapMetrics.throughputTrends.trend === 'decreasing' ? 'text-red-600' :
                    'text-muted-foreground'
                  }`}>
                    {soapMetrics.throughputTrends.trend === 'increasing' ? '↑ Increasing' :
                     soapMetrics.throughputTrends.trend === 'decreasing' ? '↓ Decreasing' : '→ Stable'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Latency Percentiles */}
        {soapMetrics?.latencyP50 !== undefined && (
          <Card>
            <CardHeader>
              <CardTitle>Latency Percentiles</CardTitle>
              <CardDescription>Response time distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">P50 (Median)</p>
                  <p className="text-2xl font-bold">{soapMetrics.latencyP50.toFixed(0)}ms</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">P95</p>
                  <p className="text-2xl font-bold">{soapMetrics.latencyP95?.toFixed(0) || 'N/A'}ms</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">P99</p>
                  <p className="text-2xl font-bold">{soapMetrics.latencyP99?.toFixed(0) || 'N/A'}ms</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="test" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="test">
              <Play className="h-4 w-4 mr-2" />
              Test Client
            </TabsTrigger>
            <TabsTrigger value="services">
              <Server className="h-4 w-4 mr-2" />
              Services ({services.length})
            </TabsTrigger>
            <TabsTrigger value="operations">
              <Network className="h-4 w-4 mr-2" />
              Operations
            </TabsTrigger>
            <TabsTrigger value="wsdl">
              <FileText className="h-4 w-4 mr-2" />
              WSDL
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
            <TabsTrigger value="history">
              <Activity className="h-4 w-4 mr-2" />
              History ({requests.length})
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>SOAP Services</CardTitle>
                    <CardDescription>Manage services and operations. Services are defined in the component configuration.</CardDescription>
                  </div>
                  <Button onClick={() => {
                    setEditingService(null);
                    setNewServiceName('');
                    setNewServicePort('default');
                    setNewServiceWSDLUrl('');
                    setShowServiceDialog(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Service
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {services.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No services configured</p>
                    <p className="text-sm mt-2">Click "Add Service" to create your first service</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {services.map((service) => (
                      <Card key={service.name} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
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
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editService(service)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm(`Delete service "${service.name}"?`)) {
                                    deleteService(service.name);
                                  }
                                }}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between mb-4">
                            <Label>Operations</Label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingOperation(null);
                                setOperationServiceName(service.name);
                                setNewOperationName('');
                                setNewOperationInput('');
                                setNewOperationOutput('');
                                setShowOperationDialog(true);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Operation
                            </Button>
                          </div>
                          {service.operations.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                              No operations. Click "Add Operation" to add one.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {service.operations.map((op) => (
                                <div key={op.name} className="p-3 border rounded flex items-center justify-between">
                                  <div className="flex-1">
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
                                  <div className="flex gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => editOperation(service, op)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        if (confirm(`Delete operation "${op.name}"?`)) {
                                          deleteOperation(service.name, op.name);
                                        }
                                      }}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
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

          <TabsContent value="operations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Operation Metrics</CardTitle>
                <CardDescription>Performance metrics per operation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {soapMetrics?.operationMetrics && soapMetrics.operationMetrics.length > 0 ? (
                    soapMetrics.operationMetrics.map((opMetric) => (
                      <Card key={`${opMetric.serviceName}:${opMetric.operationName}`} className="border-l-4 border-l-blue-500">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-lg font-semibold">{opMetric.operationName}</CardTitle>
                              <p className="text-sm text-muted-foreground mt-1">Service: {opMetric.serviceName}</p>
                            </div>
                            <Badge variant={opMetric.errorRate > 5 ? 'destructive' : 'default'}>
                              {opMetric.errorRate.toFixed(1)}% errors
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Total Calls</p>
                              <p className="text-2xl font-bold">{opMetric.totalCalls}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Avg Latency</p>
                              <p className="text-2xl font-bold">{opMetric.averageLatency.toFixed(0)}ms</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Calls/sec</p>
                              <p className="text-2xl font-bold">{opMetric.callsPerSecond.toFixed(1)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Errors</p>
                              <p className="text-2xl font-bold text-red-600">{opMetric.totalErrors}</p>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Min Latency</p>
                              <p className="text-lg font-semibold">{opMetric.minLatency === Infinity ? 'N/A' : `${opMetric.minLatency.toFixed(0)}ms`}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Max Latency</p>
                              <p className="text-lg font-semibold">{opMetric.maxLatency.toFixed(0)}ms</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No operation metrics available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wsdl" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>WSDL Definition</CardTitle>
                    <CardDescription>Web Service Description Language</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (services.length === 0) {
                          toast({
                            title: 'Error',
                            description: 'No services configured. Add services first to generate WSDL.',
                            variant: 'destructive',
                          });
                          return;
                        }
                        const wsdl = soapEngine?.getWSDLXML();
                        if (wsdl) {
                          setWSDLXml(wsdl);
                          toast({
                            title: 'Success',
                            description: 'WSDL generated successfully',
                          });
                        } else {
                          toast({
                            title: 'Error',
                            description: 'Failed to generate WSDL. Check service configuration.',
                            variant: 'destructive',
                          });
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Generate WSDL
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!wsdlXml.trim()) {
                          toast({
                            title: 'Error',
                            description: 'WSDL XML is empty',
                            variant: 'destructive',
                          });
                          return;
                        }
                        try {
                          const parsed = soapEngine?.parseWSDL(wsdlXml);
                          if (parsed) {
                            const validation = soapEngine?.validateWSDL(parsed);
                            if (validation && !validation.valid) {
                              toast({
                                title: 'Warning',
                                description: `WSDL validation errors: ${validation.errors?.join(', ')}`,
                                variant: 'destructive',
                              });
                            }
                            soapEngine?.setWSDL(parsed);
                            updateConfig({ wsdl: parsed });
                            toast({
                              title: 'Success',
                              description: 'WSDL loaded and parsed successfully',
                            });
                          } else {
                            toast({
                              title: 'Error',
                              description: 'Failed to parse WSDL. Check XML format.',
                              variant: 'destructive',
                            });
                          }
                        } catch (error) {
                          toast({
                            title: 'Error',
                            description: `Failed to load WSDL: ${error instanceof Error ? error.message : 'Unknown error'}`,
                            variant: 'destructive',
                          });
                        }
                      }}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Load WSDL
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>WSDL XML</Label>
                  <Textarea
                    value={wsdlXml || soapEngine?.getWSDLXML() || ''}
                    onChange={(e) => setWSDLXml(e.target.value)}
                    className="font-mono text-sm min-h-[400px]"
                    placeholder="WSDL XML will appear here..."
                  />
                </div>
                {soapEngine?.getWSDL() && (
                  <div className="space-y-2">
                    <Label>WSDL Info</Label>
                    <div className="p-4 bg-muted rounded">
                      <p className="text-sm">
                        <strong>Target Namespace:</strong> {soapEngine.getWSDL()?.targetNamespace || 'N/A'}
                      </p>
                      <p className="text-sm mt-2">
                        <strong>Services:</strong> {soapEngine.getWSDL()?.services?.length || 0}
                      </p>
                      <p className="text-sm mt-2">
                        <strong>Messages:</strong> {soapEngine.getWSDL()?.messages?.length || 0}
                      </p>
                      <p className="text-sm mt-2">
                        <strong>Port Types:</strong> {soapEngine.getWSDL()?.portTypes?.length || 0}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>WS-Security Metrics</CardTitle>
                <CardDescription>Security validation statistics</CardDescription>
              </CardHeader>
              <CardContent>
                {soapMetrics?.wsSecurityMetrics ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Validations</p>
                      <p className="text-2xl font-bold">{soapMetrics.wsSecurityMetrics.totalValidations}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Success Rate</p>
                      <p className="text-2xl font-bold text-green-600">{soapMetrics.wsSecurityMetrics.validationSuccessRate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Signatures Processed</p>
                      <p className="text-2xl font-bold">{soapMetrics.wsSecurityMetrics.signaturesProcessed}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Encryptions Processed</p>
                      <p className="text-2xl font-bold">{soapMetrics.wsSecurityMetrics.encryptionsProcessed}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Failed Validations</p>
                      <p className="text-2xl font-bold text-red-600">{soapMetrics.wsSecurityMetrics.failedValidations}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">WS-Security metrics not available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>WS-Addressing Metrics</CardTitle>
                <CardDescription>Addressing usage statistics</CardDescription>
              </CardHeader>
              <CardContent>
                {soapMetrics?.wsAddressingMetrics ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Messages</p>
                      <p className="text-2xl font-bold">{soapMetrics.wsAddressingMetrics.totalMessages}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">With Addressing</p>
                      <p className="text-2xl font-bold">{soapMetrics.wsAddressingMetrics.messagesWithAddressing}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Async Responses</p>
                      <p className="text-2xl font-bold">{soapMetrics.wsAddressingMetrics.asyncResponses}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Usage Rate</p>
                      <p className="text-2xl font-bold">{soapMetrics.wsAddressingMetrics.addressingUsageRate.toFixed(1)}%</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">WS-Addressing metrics not available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>MTOM Metrics</CardTitle>
                <CardDescription>Message Transmission Optimization Mechanism</CardDescription>
              </CardHeader>
              <CardContent>
                {soapMetrics?.mtomMetrics ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Messages</p>
                      <p className="text-2xl font-bold">{soapMetrics.mtomMetrics.totalMessages}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">With MTOM</p>
                      <p className="text-2xl font-bold">{soapMetrics.mtomMetrics.messagesWithMTOM}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Attachments</p>
                      <p className="text-2xl font-bold">{soapMetrics.mtomMetrics.totalAttachments}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Avg Attachments</p>
                      <p className="text-2xl font-bold">{soapMetrics.mtomMetrics.averageAttachmentsPerMessage.toFixed(1)}</p>
                    </div>
                    <div className="col-span-2 md:col-span-4">
                      <p className="text-xs text-muted-foreground">MTOM Usage Rate</p>
                      <p className="text-2xl font-bold">{soapMetrics.mtomMetrics.mtomUsageRate.toFixed(1)}%</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">MTOM metrics not available</p>
                )}
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
                    <Card key={req.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-card">
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
                <div className="flex items-center justify-between">
                  <Label>Enable MTOM</Label>
                  <Switch 
                    checked={config.enableMTOM ?? false}
                    onCheckedChange={(checked) => updateConfig({ enableMTOM: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Validation</Label>
                  <Switch 
                    checked={config.enableValidation ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableValidation: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Caching</Label>
                  <Switch 
                    checked={config.enableCaching ?? false}
                    onCheckedChange={(checked) => updateConfig({ enableCaching: checked })}
                  />
                </div>
                <Separator />
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
                {config.enableCaching && (
                  <div className="space-y-2">
                    <Label>Cache TTL (seconds)</Label>
                    <Input
                      type="number"
                      value={config.cacheTTL ?? 300}
                      onChange={(e) => updateConfig({ cacheTTL: parseInt(e.target.value) || 300 })}
                      placeholder="300"
                    />
                  </div>
                )}
                <Separator />
                <div className="space-y-2">
                  <Label>Requests Per Second</Label>
                  <Input
                    type="number"
                    value={config.requestsPerSecond ?? 100}
                    onChange={(e) => updateConfig({ requestsPerSecond: parseInt(e.target.value) || 100 })}
                    placeholder="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Response Latency (ms)</Label>
                  <Input
                    type="number"
                    value={config.responseLatency ?? 50}
                    onChange={(e) => updateConfig({ responseLatency: parseInt(e.target.value) || 50 })}
                    placeholder="50"
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Max Request Size (bytes)</Label>
                  <Input
                    type="number"
                    value={config.maxRequestSize ?? 10 * 1024 * 1024}
                    onChange={(e) => updateConfig({ maxRequestSize: parseInt(e.target.value) || 10 * 1024 * 1024 })}
                    placeholder="10485760"
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum size of SOAP request in bytes (default: 10MB)
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* Service Dialog */}
        <Dialog open={showServiceDialog} onOpenChange={setShowServiceDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingService ? 'Edit Service' : 'Add Service'}</DialogTitle>
              <DialogDescription>
                {editingService 
                  ? 'Update service configuration'
                  : 'Create a new SOAP service. Services contain operations that can be called by clients.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Service Name *</Label>
                <Input
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="MyService"
                />
              </div>
              <div className="space-y-2">
                <Label>Port Name</Label>
                <Input
                  value={newServicePort}
                  onChange={(e) => setNewServicePort(e.target.value)}
                  placeholder="default"
                />
              </div>
              <div className="space-y-2">
                <Label>WSDL URL (optional)</Label>
                <Input
                  value={newServiceWSDLUrl}
                  onChange={(e) => setNewServiceWSDLUrl(e.target.value)}
                  placeholder="http://example.com/service.wsdl"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowServiceDialog(false);
                setEditingService(null);
                setNewServiceName('');
                setNewServicePort('default');
                setNewServiceWSDLUrl('');
              }}>
                Cancel
              </Button>
              <Button onClick={editingService ? saveService : addService}>
                {editingService ? 'Save' : 'Add'} Service
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Operation Dialog */}
        <Dialog open={showOperationDialog} onOpenChange={setShowOperationDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingOperation ? 'Edit Operation' : 'Add Operation'}</DialogTitle>
              <DialogDescription>
                {editingOperation
                  ? 'Update operation configuration'
                  : 'Create a new SOAP operation. Operations define the methods available in a service.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Service *</Label>
                <Select
                  value={operationServiceName}
                  onValueChange={setOperationServiceName}
                  disabled={!!editingOperation}
                >
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
                <Label>Operation Name *</Label>
                <Input
                  value={newOperationName}
                  onChange={(e) => setNewOperationName(e.target.value)}
                  placeholder="GetData"
                />
              </div>
              <div className="space-y-2">
                <Label>Input Message (optional)</Label>
                <Input
                  value={newOperationInput}
                  onChange={(e) => setNewOperationInput(e.target.value)}
                  placeholder="GetDataRequest"
                />
              </div>
              <div className="space-y-2">
                <Label>Output Message (optional)</Label>
                <Input
                  value={newOperationOutput}
                  onChange={(e) => setNewOperationOutput(e.target.value)}
                  placeholder="GetDataResponse"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowOperationDialog(false);
                setEditingOperation(null);
                setOperationServiceName('');
                setNewOperationName('');
                setNewOperationInput('');
                setNewOperationOutput('');
              }}>
                Cancel
              </Button>
              <Button onClick={editingOperation ? saveOperation : addOperation}>
                {editingOperation ? 'Save' : 'Add'} Operation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}


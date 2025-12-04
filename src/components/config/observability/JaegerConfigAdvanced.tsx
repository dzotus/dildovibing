import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  GitBranch, 
  Search, 
  Settings, 
  Activity,
  Clock,
  Plus,
  Trash2,
  Eye
} from 'lucide-react';

interface JaegerConfigProps {
  componentId: string;
}

interface Trace {
  id: string;
  service: string;
  operation: string;
  duration: number;
  spans: number;
  status: 'success' | 'error';
  timestamp: string;
}

interface Service {
  name: string;
  traces: number;
  errors: number;
  avgDuration: number;
}

interface JaegerConfig {
  serverUrl?: string;
  traces?: Trace[];
  services?: Service[];
  totalTraces?: number;
  errorRate?: number;
  avgTraceDuration?: number;
}

export function JaegerConfigAdvanced({ componentId }: JaegerConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as JaegerConfig;
  const serverUrl = config.serverUrl || 'http://jaeger:16686';
  const traces = config.traces || [
    { id: 'abc123', service: 'web-api', operation: 'GET /users', duration: 125, spans: 8, status: 'success', timestamp: '2m ago' },
    { id: 'def456', service: 'auth-service', operation: 'POST /login', duration: 89, spans: 5, status: 'success', timestamp: '5m ago' },
    { id: 'ghi789', service: 'payment-service', operation: 'POST /charge', duration: 450, spans: 12, status: 'error', timestamp: '10m ago' },
  ];
  const services = config.services || [
    { name: 'web-api', traces: 1250, errors: 45, avgDuration: 125 },
    { name: 'auth-service', traces: 890, errors: 12, avgDuration: 89 },
    { name: 'payment-service', traces: 450, errors: 23, avgDuration: 234 },
  ];
  const totalTraces = config.totalTraces || traces.length;
  const errorRate = config.errorRate || 2.5;
  const avgTraceDuration = config.avgTraceDuration || 156;

  const updateConfig = (updates: Partial<JaegerConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <GitBranch className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Jaeger</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Distributed Tracing System
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Running
            </Badge>
            <Button size="sm" variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              UI
            </Button>
          </div>
        </div>

        <Separator />


        {/* Main Configuration Tabs */}
        <Tabs defaultValue="traces" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="traces" className="gap-2">
              <GitBranch className="h-4 w-4" />
              Traces
            </TabsTrigger>
            <TabsTrigger value="services" className="gap-2">
              <Activity className="h-4 w-4" />
              Services
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Traces Tab */}
          <TabsContent value="traces" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Traces</CardTitle>
                <CardDescription>Distributed trace information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {traces.map((trace) => (
                    <Card key={trace.id} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-primary/10">
                              <GitBranch className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{trace.operation}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                Service: {trace.service} • {trace.spans} spans • {trace.duration}ms • {trace.timestamp}
                              </CardDescription>
                            </div>
                          </div>
                          <Badge variant={trace.status === 'success' ? 'default' : 'destructive'}>
                            {trace.status}
                          </Badge>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Services</CardTitle>
                <CardDescription>Service trace statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {services.map((service) => (
                    <Card key={service.name} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{service.name}</CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {service.traces} traces • {service.errors} errors • Avg: {service.avgDuration}ms
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Error Rate</span>
                            <span className="font-semibold">{((service.errors / service.traces) * 100).toFixed(1)}%</span>
                          </div>
                          <Progress value={(service.errors / service.traces) * 100} className="h-2" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Jaeger Server</CardTitle>
                <CardDescription>Server configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="server-url">Server URL</Label>
                  <Input
                    id="server-url"
                    value={serverUrl}
                    onChange={(e) => updateConfig({ serverUrl: e.target.value })}
                    placeholder="http://jaeger:16686"
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


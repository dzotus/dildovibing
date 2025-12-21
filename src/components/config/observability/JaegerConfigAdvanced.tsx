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
import { emulationEngine } from '@/core/EmulationEngine';
import { useEmulationStore } from '@/store/useEmulationStore';
import { useEffect, useState, useMemo } from 'react';

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
  const { isRunning } = useEmulationStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as JaegerConfig;
  const serverUrl = config.serverUrl || 'http://jaeger:16686';
  
  // Получаем Jaeger engine для реальных данных
  const jaegerEngine = emulationEngine.getJaegerEmulationEngine(componentId);
  
  // Получаем реальные трассировки и статистику
  const [realTraces, setRealTraces] = useState<Trace[]>([]);
  const [realServices, setRealServices] = useState<Service[]>([]);
  const [realMetrics, setRealMetrics] = useState<{
    totalTraces: number;
    errorRate: number;
    avgTraceDuration: number;
  }>({
    totalTraces: 0,
    errorRate: 0,
    avgTraceDuration: 0,
  });

  // Обновляем данные из Jaeger engine
  useEffect(() => {
    if (!jaegerEngine) {
      // Если engine не инициализирован, показываем пустые данные
      setRealTraces([]);
      setRealServices([]);
      setRealMetrics({
        totalTraces: 0,
        errorRate: 0,
        avgTraceDuration: 0,
      });
      return;
    }

    const updateData = () => {
      // Получаем последние трассировки
      const traces = jaegerEngine.getRecentTraces(20);
      const convertedTraces: Trace[] = traces.map(trace => {
        const rootSpan = trace.spans.find(s => !s.parentSpanId) || trace.spans[0];
        const durationMs = trace.duration / 1000; // convert from microseconds to ms
        const timestamp = new Date(trace.startTime / 1000).toISOString(); // convert from microseconds to ms
        const timeAgo = getTimeAgo(trace.startTime / 1000);
        
        return {
          id: trace.traceId,
          service: rootSpan?.serviceName || 'unknown',
          operation: rootSpan?.operationName || 'unknown',
          duration: Math.round(durationMs),
          spans: trace.spanCount,
          status: trace.hasErrors ? 'error' : 'success',
          timestamp: timeAgo,
        };
      });
      setRealTraces(convertedTraces);

      // Получаем статистику сервисов
      const serviceStats = jaegerEngine.getServiceStats();
      const convertedServices: Service[] = serviceStats.map(stats => ({
        name: stats.name,
        traces: stats.tracesTotal,
        errors: stats.errorsTotal,
        avgDuration: Math.round(stats.avgDuration / 1000), // convert from microseconds to ms
      }));
      setRealServices(convertedServices);

      // Получаем метрики
      const metrics = jaegerEngine.getJaegerMetrics();
      const load = jaegerEngine.calculateLoad();
      const totalTraces = traces.length;
      const errorCount = traces.filter(t => t.hasErrors).length;
      const errorRate = totalTraces > 0 ? (errorCount / totalTraces) * 100 : 0;
      const avgDuration = traces.length > 0 
        ? traces.reduce((sum, t) => sum + (t.duration / 1000), 0) / traces.length 
        : 0;

      setRealMetrics({
        totalTraces,
        errorRate,
        avgTraceDuration: Math.round(avgDuration),
      });
    };

    updateData();
    
    // Обновляем данные периодически если симуляция запущена
    if (isRunning) {
      const interval = setInterval(updateData, 2000); // каждые 2 секунды
      return () => clearInterval(interval);
    }
  }, [jaegerEngine, isRunning, componentId]);

  // Используем только реальные данные (без fallback к конфигу)
  const traces = realTraces;
  const services = realServices;
  const totalTraces = realMetrics.totalTraces;
  const errorRate = realMetrics.errorRate;
  const avgTraceDuration = realMetrics.avgTraceDuration;

  // Функция для форматирования времени
  function getTimeAgo(timestampMs: number): string {
    const now = Date.now();
    const diff = now - timestampMs;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

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
              <div className={`h-2 w-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              {isRunning ? 'Running' : 'Stopped'}
            </Badge>
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
                {traces.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No traces available</p>
                    <p className="text-xs mt-1">Traces will appear here when simulation is running</p>
                  </div>
                ) : (
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
                )}
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
                {services.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No services available</p>
                    <p className="text-xs mt-1">Service statistics will appear here when traces are collected</p>
                  </div>
                ) : (
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
                )}
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


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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  GitBranch, 
  Search, 
  Settings, 
  Activity,
  Clock,
  Plus,
  Trash2,
  Eye,
  Server,
  Database,
  Gauge,
  Filter,
  X
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TraceTreeViewer } from './TraceTreeViewer';
import { JaegerTrace } from '@/core/JaegerEmulationEngine';
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
  agentEndpoint?: string;
  collectorEndpoint?: string;
  queryEndpoint?: string;
  samplingType?: 'probabilistic' | 'ratelimiting' | 'peroperation';
  samplingParam?: number;
  storageBackend?: 'elasticsearch' | 'cassandra' | 'kafka' | 'memory';
  storageUrl?: string;
  maxTraces?: number;
  traceTTL?: number;
  enableMetrics?: boolean;
  metricsBackend?: 'prometheus' | 'statsd';
  metricsUrl?: string;
  traces?: Trace[];
  services?: Service[];
  totalTraces?: number;
  errorRate?: number;
  avgTraceDuration?: number;
}

export function JaegerConfigAdvanced({ componentId }: JaegerConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { isRunning, getComponentMetrics } = useEmulationStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as JaegerConfig;
  const serverUrl = config.serverUrl || 'http://jaeger:16686';
  const agentEndpoint = config.agentEndpoint || 'http://jaeger-agent:6831';
  const collectorEndpoint = config.collectorEndpoint || 'http://jaeger-collector:14268';
  const queryEndpoint = config.queryEndpoint || 'http://jaeger-query:16686';
  const samplingType = config.samplingType || 'probabilistic';
  const samplingParam = config.samplingParam ?? 0.001;
  const storageBackend = config.storageBackend || 'memory';
  const storageUrl = config.storageUrl || '';
  const maxTraces = config.maxTraces || 10000;
  const traceTTL = config.traceTTL || 86400000; // 24 hours
  const enableMetrics = config.enableMetrics ?? true;
  const metricsBackend = config.metricsBackend || 'prometheus';
  const metricsUrl = config.metricsUrl || 'http://prometheus:9090';
  
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

  // Фильтрация и поиск
  const [traceSearchQuery, setTraceSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [operationFilter, setOperationFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | '1h' | '24h' | '7d'>('all');
  const [viewingTrace, setViewingTrace] = useState<JaegerTrace | null>(null);

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

  // Фильтрация traces
  const filteredTraces = useMemo(() => {
    let filtered = realTraces;

    // Поиск по trace ID
    if (traceSearchQuery) {
      filtered = filtered.filter(trace =>
        trace.id.toLowerCase().includes(traceSearchQuery.toLowerCase()) ||
        trace.service.toLowerCase().includes(traceSearchQuery.toLowerCase()) ||
        trace.operation.toLowerCase().includes(traceSearchQuery.toLowerCase())
      );
    }

    // Фильтр по service
    if (serviceFilter !== 'all') {
      filtered = filtered.filter(trace => trace.service === serviceFilter);
    }

    // Фильтр по operation
    if (operationFilter !== 'all') {
      filtered = filtered.filter(trace => trace.operation === operationFilter);
    }

    // Фильтр по статусу
    if (statusFilter !== 'all') {
      filtered = filtered.filter(trace => trace.status === statusFilter);
    }

    // Фильтр по времени
    if (timeFilter !== 'all' && jaegerEngine) {
      const now = Date.now();
      let startTime: number | undefined;
      
      switch (timeFilter) {
        case '1h':
          startTime = now - 3600000; // 1 hour
          break;
        case '24h':
          startTime = now - 86400000; // 24 hours
          break;
        case '7d':
          startTime = now - 604800000; // 7 days
          break;
      }

      if (startTime) {
        // Используем queryTraces для фильтрации по времени
        const queryResult = jaegerEngine.queryTraces({
          startTime: startTime,
          limit: 1000,
        });
        const traceIds = new Set(queryResult.traces.map(t => t.traceId));
        filtered = filtered.filter(trace => traceIds.has(trace.id));
      }
    }

    return filtered;
  }, [realTraces, traceSearchQuery, serviceFilter, operationFilter, statusFilter, timeFilter, jaegerEngine]);

  // Используем только реальные данные (без fallback к конфигу)
  const traces = filteredTraces;
  const services = realServices;
  const totalTraces = realMetrics.totalTraces;
  const errorRate = realMetrics.errorRate;
  const avgTraceDuration = realMetrics.avgTraceDuration;

  // Получаем уникальные services и operations для фильтров
  const availableServices = useMemo(() => {
    const serviceSet = new Set(realTraces.map(t => t.service));
    return Array.from(serviceSet).sort();
  }, [realTraces]);

  const availableOperations = useMemo(() => {
    const operationSet = new Set(realTraces.map(t => t.operation));
    return Array.from(operationSet).sort();
  }, [realTraces]);

  // Обработчик просмотра trace
  const handleViewTrace = (traceId: string) => {
    if (jaegerEngine) {
      const trace = jaegerEngine.getTraceById(traceId);
      if (trace) {
        setViewingTrace(trace);
      }
    }
  };

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
          <TabsList className="grid w-full grid-cols-4">
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
            <TabsTrigger value="metrics" className="gap-2">
              <Gauge className="h-4 w-4" />
              Metrics
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
                {/* Фильтры и поиск */}
                <div className="space-y-4 mb-4">
                  {/* Поиск */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by trace ID, service, or operation..."
                      value={traceSearchQuery}
                      onChange={(e) => setTraceSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                    {traceSearchQuery && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                        onClick={() => setTraceSearchQuery('')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Фильтры */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        <Filter className="h-3 w-3" />
                        Service
                      </Label>
                      <Select value={serviceFilter} onValueChange={setServiceFilter}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Services</SelectItem>
                          {availableServices.map(service => (
                            <SelectItem key={service} value={service}>
                              {service}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        <Filter className="h-3 w-3" />
                        Operation
                      </Label>
                      <Select value={operationFilter} onValueChange={setOperationFilter}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Operations</SelectItem>
                          {availableOperations.map(operation => (
                            <SelectItem key={operation} value={operation}>
                              {operation}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        <Filter className="h-3 w-3" />
                        Status
                      </Label>
                      <Select value={statusFilter} onValueChange={(value: 'all' | 'success' | 'error') => setStatusFilter(value)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="success">Success</SelectItem>
                          <SelectItem value="error">Error</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Time
                      </Label>
                      <Select value={timeFilter} onValueChange={(value: 'all' | '1h' | '24h' | '7d') => setTimeFilter(value)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Time</SelectItem>
                          <SelectItem value="1h">Last Hour</SelectItem>
                          <SelectItem value="24h">Last 24 Hours</SelectItem>
                          <SelectItem value="7d">Last 7 Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Результаты */}
                  <div className="text-xs text-muted-foreground">
                    Showing {traces.length} of {realTraces.length} traces
                  </div>
                </div>

                {traces.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No traces available</p>
                    <p className="text-xs mt-1">
                      {realTraces.length === 0
                        ? 'Traces will appear here when simulation is running'
                        : 'No traces match the current filters'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {traces.map((trace) => (
                    <Card key={trace.id} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="p-2 rounded bg-primary/10">
                              <GitBranch className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg">{trace.operation}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                Service: {trace.service} • {trace.spans} spans • {trace.duration}ms • {trace.timestamp}
                              </CardDescription>
                              <div className="mt-1 text-xs font-mono text-muted-foreground">
                                Trace ID: {trace.id.substring(0, 16)}...
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={trace.status === 'success' ? 'default' : 'destructive'}>
                              {trace.status}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewTrace(trace.id)}
                              className="gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              View Trace
                            </Button>
                          </div>
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
            {/* Endpoints Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Endpoints
                </CardTitle>
                <CardDescription>Jaeger service endpoints configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="server-url">Server URL (UI)</Label>
                  <Input
                    id="server-url"
                    value={serverUrl}
                    onChange={(e) => updateConfig({ serverUrl: e.target.value })}
                    placeholder="http://jaeger:16686"
                  />
                  <p className="text-xs text-muted-foreground">Query UI endpoint (HTTP, port 16686)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agent-endpoint">Agent Endpoint</Label>
                  <Input
                    id="agent-endpoint"
                    value={agentEndpoint}
                    onChange={(e) => updateConfig({ agentEndpoint: e.target.value })}
                    placeholder="http://jaeger-agent:6831"
                  />
                  <p className="text-xs text-muted-foreground">Agent endpoint (UDP 6831/gRPC 14250)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="collector-endpoint">Collector Endpoint</Label>
                  <Input
                    id="collector-endpoint"
                    value={collectorEndpoint}
                    onChange={(e) => updateConfig({ collectorEndpoint: e.target.value })}
                    placeholder="http://jaeger-collector:14268"
                  />
                  <p className="text-xs text-muted-foreground">Collector endpoint (HTTP 14268/gRPC 14250)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="query-endpoint">Query Endpoint</Label>
                  <Input
                    id="query-endpoint"
                    value={queryEndpoint}
                    onChange={(e) => updateConfig({ queryEndpoint: e.target.value })}
                    placeholder="http://jaeger-query:16686"
                  />
                  <p className="text-xs text-muted-foreground">Query service endpoint (HTTP 16686/gRPC 16685)</p>
                </div>
              </CardContent>
            </Card>

            {/* Sampling Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Sampling
                </CardTitle>
                <CardDescription>Trace sampling configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sampling-type">Sampling Type</Label>
                  <Select
                    value={samplingType}
                    onValueChange={(value: 'probabilistic' | 'ratelimiting' | 'peroperation') => 
                      updateConfig({ samplingType: value })
                    }
                  >
                    <SelectTrigger id="sampling-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="probabilistic">Probabilistic</SelectItem>
                      <SelectItem value="ratelimiting">Rate Limiting</SelectItem>
                      <SelectItem value="peroperation">Per Operation</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {samplingType === 'probabilistic' && 'Sample traces with fixed probability (0-1)'}
                    {samplingType === 'ratelimiting' && 'Sample up to N traces per second'}
                    {samplingType === 'peroperation' && 'Sample per operation with rate limit'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sampling-param">
                    Sampling Parameter
                    {samplingType === 'probabilistic' && ' (Probability 0-1)'}
                    {samplingType === 'ratelimiting' && ' (Traces/sec)'}
                    {samplingType === 'peroperation' && ' (Default Traces/sec)'}
                  </Label>
                  <Input
                    id="sampling-param"
                    type="number"
                    min={samplingType === 'probabilistic' ? 0 : 1}
                    max={samplingType === 'probabilistic' ? 1 : undefined}
                    step={samplingType === 'probabilistic' ? 0.001 : 1}
                    value={samplingParam}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value)) {
                        updateConfig({ samplingParam: value });
                      }
                    }}
                    placeholder={samplingType === 'probabilistic' ? '0.001' : '10'}
                  />
                  {jaegerEngine && (
                    <div className="text-xs text-muted-foreground">
                      Current sampling rate: {(jaegerEngine.calculateLoad().samplingRate * 100).toFixed(2)}%
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Storage Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Storage
                </CardTitle>
                <CardDescription>Storage backend configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="storage-backend">Storage Backend</Label>
                  <Select
                    value={storageBackend}
                    onValueChange={(value: 'elasticsearch' | 'cassandra' | 'kafka' | 'memory') => 
                      updateConfig({ storageBackend: value })
                    }
                  >
                    <SelectTrigger id="storage-backend">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="memory">In-Memory</SelectItem>
                      <SelectItem value="elasticsearch">Elasticsearch</SelectItem>
                      <SelectItem value="cassandra">Cassandra</SelectItem>
                      <SelectItem value="kafka">Kafka</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {storageBackend !== 'memory' && (
                  <div className="space-y-2">
                    <Label htmlFor="storage-url">Storage URL</Label>
                    <Input
                      id="storage-url"
                      value={storageUrl}
                      onChange={(e) => updateConfig({ storageUrl: e.target.value })}
                      placeholder={
                        storageBackend === 'elasticsearch' ? 'http://elasticsearch:9200' :
                        storageBackend === 'cassandra' ? 'cassandra:9042' :
                        'kafka:9092'
                      }
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="max-traces">Max Traces</Label>
                  <Input
                    id="max-traces"
                    type="number"
                    min={1}
                    value={maxTraces}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value) && value > 0) {
                        updateConfig({ maxTraces: value });
                      }
                    }}
                    placeholder="10000"
                  />
                  <p className="text-xs text-muted-foreground">Maximum number of traces to store</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trace-ttl">Trace TTL (ms)</Label>
                  <Input
                    id="trace-ttl"
                    type="number"
                    min={1000}
                    value={traceTTL}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value) && value >= 1000) {
                        updateConfig({ traceTTL: value });
                      }
                    }}
                    placeholder="86400000"
                  />
                  <p className="text-xs text-muted-foreground">Time to live for traces in milliseconds (default: 24 hours)</p>
                </div>
              </CardContent>
            </Card>

            {/* Metrics Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-5 w-5" />
                  Metrics Export
                </CardTitle>
                <CardDescription>Metrics export configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enable-metrics">Enable Metrics Export</Label>
                    <p className="text-xs text-muted-foreground">Export Jaeger metrics to external backend</p>
                  </div>
                  <Switch
                    id="enable-metrics"
                    checked={enableMetrics}
                    onCheckedChange={(checked) => updateConfig({ enableMetrics: checked })}
                  />
                </div>
                {enableMetrics && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="metrics-backend">Metrics Backend</Label>
                      <Select
                        value={metricsBackend}
                        onValueChange={(value: 'prometheus' | 'statsd') => 
                          updateConfig({ metricsBackend: value })
                        }
                      >
                        <SelectTrigger id="metrics-backend">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="prometheus">Prometheus</SelectItem>
                          <SelectItem value="statsd">StatsD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="metrics-url">Metrics URL</Label>
                      <Input
                        id="metrics-url"
                        value={metricsUrl}
                        onChange={(e) => updateConfig({ metricsUrl: e.target.value })}
                        placeholder="http://prometheus:9090"
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Jaeger Metrics</CardTitle>
                <CardDescription>Real-time metrics from Jaeger engine</CardDescription>
              </CardHeader>
              <CardContent>
                {jaegerEngine ? (
                  <div className="space-y-4">
                    {(() => {
                      const load = jaegerEngine.calculateLoad();
                      const metrics = jaegerEngine.getJaegerMetrics();
                      const componentMetrics = getComponentMetrics(componentId);
                      
                      return (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Spans/sec</span>
                                <span className="font-semibold">{load.spansPerSecond.toFixed(2)}</span>
                              </div>
                              <Progress value={Math.min(100, (load.spansPerSecond / 1000) * 100)} className="h-2" />
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Traces/sec</span>
                                <span className="font-semibold">{load.tracesPerSecond.toFixed(2)}</span>
                              </div>
                              <Progress value={Math.min(100, (load.tracesPerSecond / 100) * 100)} className="h-2" />
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Sampling Rate</span>
                                <span className="font-semibold">{(load.samplingRate * 100).toFixed(2)}%</span>
                              </div>
                              <Progress value={load.samplingRate * 100} className="h-2" />
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Storage Utilization</span>
                                <span className="font-semibold">{(load.storageUtilization * 100).toFixed(2)}%</span>
                              </div>
                              <Progress value={load.storageUtilization * 100} className="h-2" />
                            </div>
                          </div>
                          <Separator />
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Spans Received:</span>
                              <span className="ml-2 font-semibold">{metrics.spansReceivedTotal.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Spans Dropped:</span>
                              <span className="ml-2 font-semibold">{metrics.spansDroppedTotal.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Traces Stored:</span>
                              <span className="ml-2 font-semibold">{metrics.tracesStoredTotal.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Query Latency:</span>
                              <span className="ml-2 font-semibold">{load.queryLatency.toFixed(2)}ms</span>
                            </div>
                            {componentMetrics && (
                              <>
                                <div>
                                  <span className="text-muted-foreground">Throughput:</span>
                                  <span className="ml-2 font-semibold">{componentMetrics.throughput.toFixed(2)}/s</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Error Rate:</span>
                                  <span className="ml-2 font-semibold">{(componentMetrics.errorRate * 100).toFixed(2)}%</span>
                                </div>
                              </>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">Jaeger engine not initialized</p>
                    <p className="text-xs mt-1">Start simulation to see metrics</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Trace Viewer Dialog */}
        <Dialog open={viewingTrace !== null} onOpenChange={(open) => !open && setViewingTrace(null)}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Trace Details</DialogTitle>
              <DialogDescription>
                View trace tree and span details
              </DialogDescription>
            </DialogHeader>
            {viewingTrace && (
              <TraceTreeViewer trace={viewingTrace} />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}


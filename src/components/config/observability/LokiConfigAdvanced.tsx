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
import { Progress } from '@/components/ui/progress';
import { 
  FileText, 
  Search, 
  Settings, 
  Activity,
  HardDrive,
  Plus,
  Trash2,
  Play
} from 'lucide-react';

interface LokiConfigProps {
  componentId: string;
}

interface LogStream {
  name: string;
  labels: Record<string, string>;
  entries: number;
  size: number;
  lastEntry?: string;
}

interface Query {
  id: string;
  query: string;
  duration: number;
  results: number;
}

interface LokiConfig {
  serverUrl?: string;
  streams?: LogStream[];
  queries?: Query[];
  totalEntries?: number;
  totalSize?: number;
  ingestionRate?: number;
  queryLatency?: number;
}

export function LokiConfigAdvanced({ componentId }: LokiConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as LokiConfig;
  const serverUrl = config.serverUrl || 'http://loki:3100';
  const streams = config.streams || [
    { name: 'app-logs', labels: { app: 'web', env: 'prod' }, entries: 1250000, size: 2.5, lastEntry: '2s ago' },
    { name: 'error-logs', labels: { level: 'error', app: 'api' }, entries: 45000, size: 0.8, lastEntry: '5s ago' },
    { name: 'access-logs', labels: { type: 'access', app: 'nginx' }, entries: 890000, size: 1.8, lastEntry: '1s ago' },
  ];
  const queries = config.queries || [
    { id: '1', query: '{app="web"} |= "error"', duration: 125, results: 1250 },
    { id: '2', query: 'rate({level="error"}[5m])', duration: 89, results: 45 },
  ];
  const totalEntries = config.totalEntries || streams.reduce((sum, s) => sum + s.entries, 0);
  const totalSize = config.totalSize || streams.reduce((sum, s) => sum + s.size, 0);
  const ingestionRate = config.ingestionRate || 12500;
  const queryLatency = config.queryLatency || 95;

  const updateConfig = (updates: Partial<LokiConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addStream = () => {
    updateConfig({
      streams: [...streams, { name: 'new-stream', labels: { app: 'new' }, entries: 0, size: 0 }],
    });
  };

  const removeStream = (index: number) => {
    updateConfig({ streams: streams.filter((_, i) => i !== index) });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <FileText className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Loki</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Log Aggregation System
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
              Query
            </Button>
          </div>
        </div>

        <Separator />


        {/* Main Configuration Tabs */}
        <Tabs defaultValue="streams" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="streams" className="gap-2">
              <FileText className="h-4 w-4" />
              Log Streams
            </TabsTrigger>
            <TabsTrigger value="queries" className="gap-2">
              <Search className="h-4 w-4" />
              Queries
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Streams Tab */}
          <TabsContent value="streams" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Log Streams</CardTitle>
                    <CardDescription>Log stream configuration and labels</CardDescription>
                  </div>
                  <Button size="sm" onClick={addStream} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Stream
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {streams.map((stream, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-primary/10">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{stream.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {stream.entries.toLocaleString()} entries • {stream.size} GB
                                {stream.lastEntry && ` • Last: ${stream.lastEntry}`}
                              </CardDescription>
                              <div className="flex gap-1 mt-1">
                                {Object.entries(stream.labels).map(([key, value]) => (
                                  <Badge key={key} variant="outline" className="text-xs">
                                    {key}={value}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                          {streams.length > 1 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeStream(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Queries Tab */}
          <TabsContent value="queries" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>LogQL Queries</CardTitle>
                <CardDescription>Query log streams with LogQL</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {queries.map((query) => (
                    <Card key={query.id} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-sm font-mono">{query.query}</CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {query.results} results • {query.duration}ms
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
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
                <CardTitle>Loki Server</CardTitle>
                <CardDescription>Server configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="server-url">Server URL</Label>
                  <Input
                    id="server-url"
                    value={serverUrl}
                    onChange={(e) => updateConfig({ serverUrl: e.target.value })}
                    placeholder="http://loki:3100"
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


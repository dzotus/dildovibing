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
  Globe,
  Server,
  TrendingUp,
  Zap,
  CheckCircle,
  MapPin
} from 'lucide-react';

interface CDNConfigProps {
  componentId: string;
}

interface Distribution {
  id: string;
  domain: string;
  origin: string;
  status: 'deployed' | 'deploying' | 'failed';
  edgeLocations?: number;
  requests?: number;
  cacheHitRate?: number;
  bandwidth?: number;
}

interface EdgeLocation {
  id: string;
  region: string;
  city: string;
  requests?: number;
  cacheHits?: number;
  bandwidth?: number;
  status: 'active' | 'inactive';
}

interface CDNConfig {
  distributions?: Distribution[];
  edgeLocations?: EdgeLocation[];
  totalDistributions?: number;
  totalEdgeLocations?: number;
  totalRequests?: number;
  totalBandwidth?: number;
  averageCacheHitRate?: number;
  enableCompression?: boolean;
  enableHTTP2?: boolean;
  enableHTTPS?: boolean;
  defaultTTL?: number;
  maxTTL?: number;
  cachePolicy?: 'cache-first' | 'origin-first' | 'bypass';
  metrics?: {
    enabled?: boolean;
    port?: number;
    path?: string;
  };
}

export function CDNConfigAdvanced({ componentId }: CDNConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as CDNConfig;
  const distributions = config.distributions || [
    {
      id: 'dist-1',
      domain: 'cdn.example.com',
      origin: 'https://origin.example.com',
      status: 'deployed',
      edgeLocations: 15,
      requests: 1250000,
      cacheHitRate: 92.5,
      bandwidth: 102400000000,
    },
    {
      id: 'dist-2',
      domain: 'static.example.com',
      origin: 'https://s3.example.com',
      status: 'deployed',
      edgeLocations: 12,
      requests: 890000,
      cacheHitRate: 88.3,
      bandwidth: 76800000000,
    },
  ];
  const edgeLocations = config.edgeLocations || [
    {
      id: 'edge-1',
      region: 'us-east-1',
      city: 'New York',
      requests: 125000,
      cacheHits: 115000,
      bandwidth: 10240000000,
      status: 'active',
    },
    {
      id: 'edge-2',
      region: 'eu-west-1',
      city: 'London',
      requests: 98000,
      cacheHits: 90000,
      bandwidth: 8192000000,
      status: 'active',
    },
    {
      id: 'edge-3',
      region: 'ap-southeast-1',
      city: 'Singapore',
      requests: 75000,
      cacheHits: 68000,
      bandwidth: 6144000000,
      status: 'active',
    },
  ];
  const totalDistributions = config.totalDistributions || distributions.length;
  const totalEdgeLocations = config.totalEdgeLocations || edgeLocations.length;
  const totalRequests = config.totalRequests || distributions.reduce((sum, d) => sum + (d.requests || 0), 0);
  const totalBandwidth = config.totalBandwidth || distributions.reduce((sum, d) => sum + (d.bandwidth || 0), 0);
  const averageCacheHitRate = config.averageCacheHitRate || distributions.reduce((sum, d) => sum + (d.cacheHitRate || 0), 0) / distributions.length;

  const [showCreateDistribution, setShowCreateDistribution] = useState(false);

  const updateConfig = (updates: Partial<CDNConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addDistribution = () => {
    const newDistribution: Distribution = {
      id: `dist-${Date.now()}`,
      domain: 'cdn-new.example.com',
      origin: 'https://origin.example.com',
      status: 'deploying',
      edgeLocations: 0,
    };
    updateConfig({ distributions: [...distributions, newDistribution] });
    setShowCreateDistribution(false);
  };

  const removeDistribution = (id: string) => {
    updateConfig({ distributions: distributions.filter((d) => d.id !== id) });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'deployed':
      case 'active':
        return 'bg-green-500';
      case 'deploying':
        return 'bg-yellow-500';
      case 'failed':
      case 'inactive':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">CDN Edge</p>
            <h2 className="text-2xl font-bold text-foreground">Content Delivery Network</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Global content distribution and caching
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Distributions</CardTitle>
                <Globe className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalDistributions}</span>
                <span className="text-xs text-muted-foreground">active</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Edge Locations</CardTitle>
                <MapPin className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalEdgeLocations}</span>
                <span className="text-xs text-muted-foreground">global</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Requests</CardTitle>
                <Activity className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{(totalRequests / 1000).toFixed(0)}K</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cache Hit Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{averageCacheHitRate.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="distributions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="distributions">
              <Globe className="h-4 w-4 mr-2" />
              Distributions ({distributions.length})
            </TabsTrigger>
            <TabsTrigger value="edge-locations">
              <MapPin className="h-4 w-4 mr-2" />
              Edge Locations ({edgeLocations.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="distributions" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>CDN Distributions</CardTitle>
                    <CardDescription>Content distribution configurations</CardDescription>
                  </div>
                  <Button onClick={addDistribution} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Distribution
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {distributions.map((dist) => (
                    <Card key={dist.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getStatusColor(dist.status)}/20`}>
                              <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{dist.domain}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className={getStatusColor(dist.status)}>
                                  {dist.status}
                                </Badge>
                                <Badge variant="outline" className="font-mono text-xs">{dist.origin}</Badge>
                                {dist.edgeLocations && (
                                  <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20">
                                    {dist.edgeLocations} edges
                                  </Badge>
                                )}
                                {dist.cacheHitRate && (
                                  <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/20">
                                    {dist.cacheHitRate.toFixed(1)}% cache
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeDistribution(dist.id)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          {dist.requests && (
                            <div>
                              <span className="text-muted-foreground">Requests:</span>
                              <span className="ml-2 font-semibold">{dist.requests.toLocaleString()}</span>
                            </div>
                          )}
                          {dist.bandwidth && (
                            <div>
                              <span className="text-muted-foreground">Bandwidth:</span>
                              <span className="ml-2 font-semibold">{formatBytes(dist.bandwidth)}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="edge-locations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Edge Locations</CardTitle>
                <CardDescription>Global CDN edge servers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {edgeLocations.map((location) => (
                    <Card key={location.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${getStatusColor(location.status)}/20`}>
                            <MapPin className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <CardTitle className="text-lg font-semibold">{location.city}</CardTitle>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className={getStatusColor(location.status)}>
                                {location.status}
                              </Badge>
                              <Badge variant="outline">{location.region}</Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          {location.requests && (
                            <div>
                              <span className="text-muted-foreground">Requests:</span>
                              <span className="ml-2 font-semibold">{location.requests.toLocaleString()}</span>
                            </div>
                          )}
                          {location.cacheHits && (
                            <div>
                              <span className="text-muted-foreground">Cache Hits:</span>
                              <span className="ml-2 font-semibold">{location.cacheHits.toLocaleString()}</span>
                            </div>
                          )}
                          {location.bandwidth && (
                            <div>
                              <span className="text-muted-foreground">Bandwidth:</span>
                              <span className="ml-2 font-semibold">{formatBytes(location.bandwidth)}</span>
                            </div>
                          )}
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
                <CardTitle>CDN Settings</CardTitle>
                <CardDescription>CDN configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Compression</Label>
                  <Switch 
                    checked={config.enableCompression ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableCompression: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable HTTP/2</Label>
                  <Switch 
                    checked={config.enableHTTP2 ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableHTTP2: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable HTTPS</Label>
                  <Switch 
                    checked={config.enableHTTPS ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableHTTPS: checked })}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Default TTL (seconds)</Label>
                  <Input 
                    type="number" 
                    value={config.defaultTTL ?? 3600}
                    onChange={(e) => updateConfig({ defaultTTL: parseInt(e.target.value) || 3600 })}
                    min={1} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max TTL (seconds)</Label>
                  <Input 
                    type="number" 
                    value={config.maxTTL ?? 86400}
                    onChange={(e) => updateConfig({ maxTTL: parseInt(e.target.value) || 86400 })}
                    min={1} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cache Policy</Label>
                  <Select 
                    value={config.cachePolicy ?? 'cache-first'}
                    onValueChange={(value: 'cache-first' | 'origin-first' | 'bypass') => updateConfig({ cachePolicy: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cache-first">Cache First</SelectItem>
                      <SelectItem value="origin-first">Origin First</SelectItem>
                      <SelectItem value="bypass">Cache Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Metrics Export</Label>
                      <p className="text-xs text-muted-foreground mt-1">Export CDN metrics for Prometheus scraping</p>
                    </div>
                    <Switch 
                      checked={config.metrics?.enabled ?? true}
                      onCheckedChange={(checked) => updateConfig({ 
                        metrics: { 
                          ...config.metrics, 
                          enabled: checked,
                          port: config.metrics?.port || 9101,
                          path: config.metrics?.path || '/metrics'
                        } 
                      })}
                    />
                  </div>
                  {config.metrics?.enabled !== false && (
                    <>
                      <div className="space-y-2">
                        <Label>Metrics Port</Label>
                        <Input 
                          type="number" 
                          value={config.metrics?.port ?? 9101}
                          onChange={(e) => updateConfig({ 
                            metrics: { 
                              ...config.metrics, 
                              port: parseInt(e.target.value) || 9101,
                              path: config.metrics?.path || '/metrics'
                            } 
                          })}
                          min={1024} 
                          max={65535} 
                        />
                        <p className="text-xs text-muted-foreground">Port for Prometheus metrics endpoint</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Metrics Path</Label>
                        <Input 
                          type="text" 
                          value={config.metrics?.path ?? '/metrics'}
                          onChange={(e) => updateConfig({ 
                            metrics: { 
                              ...config.metrics, 
                              path: e.target.value || '/metrics',
                              port: config.metrics?.port || 9101
                            } 
                          })}
                          placeholder="/metrics"
                        />
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


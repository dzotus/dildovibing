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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { 
  Globe, 
  Server, 
  Settings, 
  Activity,
  Shield,
  Zap,
  ArrowRightLeft,
  Plus,
  Trash2,
  Network,
  Gauge,
  FileKey
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface NginxConfigProps {
  componentId: string;
}

interface Location {
  path: string;
  proxyPass: string;
  method: string;
  rateLimit?: RateLimit;
}

interface Upstream {
  name: string;
  servers: UpstreamServer[];
  method?: 'round-robin' | 'least_conn' | 'ip_hash' | 'hash';
  keepalive?: number;
}

interface UpstreamServer {
  address: string;
  weight?: number;
  maxFails?: number;
  failTimeout?: string;
  backup?: boolean;
  down?: boolean;
}

interface SSLCertificate {
  name: string;
  certPath: string;
  keyPath: string;
  domain?: string;
}

interface RateLimit {
  zone: string;
  rate: string;
  burst?: number;
  nodelay?: boolean;
}

interface RateLimitZone {
  name: string;
  size: string;
  rate: string;
}

/**
 * Generate NGINX configuration from structured settings
 */
function generateNginxConfig(config: {
  port: number;
  serverName: string;
  locations: Location[];
  upstreams: Upstream[];
  sslCertificates: SSLCertificate[];
  rateLimitZones: RateLimitZone[];
  enableSSL: boolean;
  sslPort: number;
  enableGzip: boolean;
  enableCache: boolean;
  maxWorkers: number;
}): string {
  let nginxConfig = `# NGINX Configuration\n`;
  nginxConfig += `# Generated from structured settings\n\n`;
  
  // Upstream blocks
  if (config.upstreams && config.upstreams.length > 0) {
    nginxConfig += `# Upstream blocks\n`;
    for (const upstream of config.upstreams) {
      nginxConfig += `upstream ${upstream.name} {\n`;
      if (upstream.method && upstream.method !== 'round-robin') {
        nginxConfig += `    ${upstream.method};\n`;
      }
      if (upstream.keepalive) {
        nginxConfig += `    keepalive ${upstream.keepalive};\n`;
      }
      for (const server of upstream.servers || []) {
        let serverLine = `    server ${server.address}`;
        if (server.weight && server.weight !== 1) {
          serverLine += ` weight=${server.weight}`;
        }
        if (server.maxFails) {
          serverLine += ` max_fails=${server.maxFails}`;
        }
        if (server.failTimeout) {
          serverLine += ` fail_timeout=${server.failTimeout}`;
        }
        if (server.backup) {
          serverLine += ` backup`;
        }
        if (server.down) {
          serverLine += ` down`;
        }
        serverLine += `;`;
        nginxConfig += `    ${serverLine}\n`;
      }
      nginxConfig += `}\n\n`;
    }
  }
  
  // Rate limit zones
  if (config.rateLimitZones && config.rateLimitZones.length > 0) {
    nginxConfig += `# Rate limit zones\n`;
    for (const zone of config.rateLimitZones) {
      nginxConfig += `limit_req_zone $binary_remote_addr zone=${zone.name}:${zone.size} rate=${zone.rate};\n`;
    }
    nginxConfig += `\n`;
  }
  
  // Server block
  nginxConfig += `server {\n`;
  if (config.enableSSL) {
    nginxConfig += `    listen ${config.sslPort} ssl;\n`;
    if (config.sslCertificates && config.sslCertificates.length > 0) {
      const cert = config.sslCertificates[0];
      nginxConfig += `    ssl_certificate ${cert.certPath};\n`;
      nginxConfig += `    ssl_certificate_key ${cert.keyPath};\n`;
    }
  } else {
    nginxConfig += `    listen ${config.port};\n`;
  }
  nginxConfig += `    server_name ${config.serverName};\n\n`;
  
  // Gzip
  if (config.enableGzip) {
    nginxConfig += `    gzip on;\n`;
    nginxConfig += `    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;\n\n`;
  }
  
  // Cache
  if (config.enableCache) {
    nginxConfig += `    proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=10g inactive=60m use_temp_path=off;\n\n`;
  }
  
  // Location blocks
  if (config.locations && config.locations.length > 0) {
    for (const location of config.locations) {
      nginxConfig += `    location ${location.path} {\n`;
      
      if (location.rateLimit) {
        nginxConfig += `        limit_req zone=${location.rateLimit.zone} rate=${location.rateLimit.rate}`;
        if (location.rateLimit.burst) {
          nginxConfig += ` burst=${location.rateLimit.burst}`;
        }
        if (location.rateLimit.nodelay) {
          nginxConfig += ` nodelay`;
        }
        nginxConfig += `;\n`;
      }
      
      if (location.method === 'proxy' && location.proxyPass) {
        nginxConfig += `        proxy_pass ${location.proxyPass};\n`;
        nginxConfig += `        proxy_set_header Host $host;\n`;
        nginxConfig += `        proxy_set_header X-Real-IP $remote_addr;\n`;
        nginxConfig += `        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n`;
        nginxConfig += `        proxy_set_header X-Forwarded-Proto $scheme;\n`;
      } else if (location.method === 'static') {
        nginxConfig += `        root /usr/share/nginx/html;\n`;
        nginxConfig += `        try_files $uri $uri/ =404;\n`;
      }
      
      if (location.cache?.enabled) {
        nginxConfig += `        proxy_cache my_cache;\n`;
        nginxConfig += `        proxy_cache_valid ${location.cache.valid || '200 1h'};\n`;
      }
      
      nginxConfig += `    }\n\n`;
    }
  } else {
    // Default location
    nginxConfig += `    location / {\n`;
    if (config.upstreams && config.upstreams.length > 0) {
      nginxConfig += `        proxy_pass http://${config.upstreams[0].name};\n`;
    } else {
      nginxConfig += `        proxy_pass http://backend:8080;\n`;
    }
    nginxConfig += `        proxy_set_header Host $host;\n`;
    nginxConfig += `        proxy_set_header X-Real-IP $remote_addr;\n`;
    nginxConfig += `    }\n\n`;
  }
  
  nginxConfig += `}\n`;
  
  return nginxConfig;
}

interface NginxConfig {
  port?: number;
  serverName?: string;
  maxWorkers?: number;
  config?: string;
  locations?: Location[];
  upstreams?: Upstream[];
  sslCertificates?: SSLCertificate[];
  rateLimitZones?: RateLimitZone[];
  enableSSL?: boolean;
  sslPort?: number;
  enableGzip?: boolean;
  enableCache?: boolean;
  requestsPerSecond?: number;
  activeConnections?: number;
}

export function NginxConfigAdvanced({ componentId }: NginxConfigProps) {
  const { nodes, updateNode, connections } = useCanvasStore();
  const { getComponentMetrics, isRunning } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  // Get real-time metrics from emulation
  const metrics = getComponentMetrics(componentId);
  const hasConnections = connections.some(c => c.source === componentId || c.target === componentId);
  const isActive = isRunning && hasConnections && metrics && (metrics.throughput > 0 || metrics.utilization > 0);

  const config = (node.data.config as any) || {} as NginxConfig;
  const port = config.port || 80;
  const serverName = config.serverName || 'localhost';
  const maxWorkers = config.maxWorkers || 4;
  const nginxConfig = config.config || `server {
  listen 80;
  server_name localhost;

  location / {
    proxy_pass http://backend:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}`;
  const locations = config.locations || [
    { path: '/', proxyPass: 'http://backend:8080', method: 'proxy' },
    { path: '/api', proxyPass: 'http://api:3000', method: 'proxy' },
  ];
  const upstreams = config.upstreams || [
    {
      name: 'backend',
      servers: [
        { address: 'backend1:8080', weight: 1 },
        { address: 'backend2:8080', weight: 1 },
        { address: 'backend3:8080', weight: 2 }
      ],
      method: 'round-robin',
      keepalive: 32
    }
  ];
  const sslCertificates = config.sslCertificates || [
    {
      name: 'default',
      certPath: '/etc/nginx/ssl/cert.pem',
      keyPath: '/etc/nginx/ssl/key.pem',
      domain: 'example.com'
    }
  ];
  const rateLimitZones = config.rateLimitZones || [
    { name: 'api_limit', size: '10m', rate: '10r/s' },
    { name: 'login_limit', size: '5m', rate: '5r/m' }
  ];
  const enableSSL = config.enableSSL ?? false;
  const sslPort = config.sslPort || 443;
  const enableGzip = config.enableGzip ?? true;
  const enableCache = config.enableCache ?? true;
  const requestsPerSecond = config.requestsPerSecond || 1250;
  const activeConnections = config.activeConnections || 45;

  const [showCreateUpstream, setShowCreateUpstream] = useState(false);
  const [showCreateSSL, setShowCreateSSL] = useState(false);
  const [showCreateRateLimit, setShowCreateRateLimit] = useState(false);
  const [editingUpstreamIndex, setEditingUpstreamIndex] = useState<number | null>(null);
  const [newUpstreamName, setNewUpstreamName] = useState('');
  const [newSSLName, setNewSSLName] = useState('');
  const [newRateLimitName, setNewRateLimitName] = useState('');

  // Sync routing engine when config changes
  useEffect(() => {
    if (node) {
      const routingEngine = emulationEngine.getNginxRoutingEngine(componentId);
      if (routingEngine) {
        routingEngine.initialize({
          locations: config.locations || [],
          upstreams: config.upstreams || [],
          rateLimitZones: config.rateLimitZones || [],
          sslCertificates: config.sslCertificates || [],
          enableSSL: config.enableSSL,
          sslPort: config.sslPort,
          enableGzip: config.enableGzip,
          enableCache: config.enableCache,
          maxWorkers: config.maxWorkers,
        });
      }
    }
  }, [config, componentId, node]);

  const updateConfig = (updates: Partial<NginxConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addLocation = () => {
    updateConfig({
      locations: [...locations, { path: '/new-path', proxyPass: 'http://service:8080', method: 'proxy' }],
    });
  };

  const removeLocation = (index: number) => {
    updateConfig({ locations: locations.filter((_, i) => i !== index) });
  };

  const updateLocation = (index: number, field: string, value: string) => {
    const newLocations = [...locations];
    newLocations[index] = { ...newLocations[index], [field]: value };
    updateConfig({ locations: newLocations });
  };

  const addUpstream = () => {
    if (!newUpstreamName.trim()) {
      toast({
        title: 'Error',
        description: 'Upstream name is required',
        variant: 'destructive',
      });
      return;
    }
    const newUpstream: Upstream = {
      name: newUpstreamName.trim(),
      servers: [{ address: 'server1:8080', weight: 1 }],
      method: 'round-robin'
    };
    updateConfig({ upstreams: [...upstreams, newUpstream] });
    setShowCreateUpstream(false);
    setNewUpstreamName('');
    toast({
      title: 'Success',
      description: `Upstream "${newUpstream.name}" added`,
    });
  };

  const removeUpstream = (index: number) => {
    updateConfig({ upstreams: upstreams.filter((_, i) => i !== index) });
  };

  const updateUpstream = (index: number, field: keyof Upstream, value: any) => {
    const updated = [...upstreams];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ upstreams: updated });
  };

  const addUpstreamServer = (upstreamIndex: number) => {
    const updated = [...upstreams];
    if (!updated[upstreamIndex].servers) {
      updated[upstreamIndex].servers = [];
    }
    updated[upstreamIndex].servers = [
      ...updated[upstreamIndex].servers,
      { address: 'server:8080', weight: 1 }
    ];
    updateConfig({ upstreams: updated });
  };

  const removeUpstreamServer = (upstreamIndex: number, serverIndex: number) => {
    const updated = [...upstreams];
    updated[upstreamIndex].servers = updated[upstreamIndex].servers.filter((_, i) => i !== serverIndex);
    updateConfig({ upstreams: updated });
  };

  const updateUpstreamServer = (upstreamIndex: number, serverIndex: number, field: keyof UpstreamServer, value: any) => {
    const updated = [...upstreams];
    updated[upstreamIndex].servers[serverIndex] = {
      ...updated[upstreamIndex].servers[serverIndex],
      [field]: value
    };
    updateConfig({ upstreams: updated });
  };

  const addSSLCertificate = () => {
    if (!newSSLName.trim()) {
      toast({
        title: 'Error',
        description: 'Certificate name is required',
        variant: 'destructive',
      });
      return;
    }
    const newCert: SSLCertificate = {
      name: newSSLName.trim(),
      certPath: '/etc/nginx/ssl/cert.pem',
      keyPath: '/etc/nginx/ssl/key.pem',
      domain: 'example.com'
    };
    updateConfig({ sslCertificates: [...sslCertificates, newCert] });
    setShowCreateSSL(false);
    setNewSSLName('');
    toast({
      title: 'Success',
      description: `SSL certificate "${newCert.name}" added`,
    });
  };

  const removeSSLCertificate = (index: number) => {
    updateConfig({ sslCertificates: sslCertificates.filter((_, i) => i !== index) });
  };

  const updateSSLCertificate = (index: number, field: keyof SSLCertificate, value: string) => {
    const updated = [...sslCertificates];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ sslCertificates: updated });
  };

  const addRateLimitZone = () => {
    if (!newRateLimitName.trim()) {
      toast({
        title: 'Error',
        description: 'Zone name is required',
        variant: 'destructive',
      });
      return;
    }
    const newZone: RateLimitZone = {
      name: newRateLimitName.trim(),
      size: '10m',
      rate: '10r/s'
    };
    updateConfig({ rateLimitZones: [...rateLimitZones, newZone] });
    setShowCreateRateLimit(false);
    setNewRateLimitName('');
    toast({
      title: 'Success',
      description: `Rate limit zone "${newZone.name}" added`,
    });
  };

  const removeRateLimitZone = (index: number) => {
    updateConfig({ rateLimitZones: rateLimitZones.filter((_, i) => i !== index) });
  };

  const updateRateLimitZone = (index: number, field: keyof RateLimitZone, value: string) => {
    const updated = [...rateLimitZones];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ rateLimitZones: updated });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Globe className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">NGINX</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Web Server & Reverse Proxy
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
              <div className={`h-2 w-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              {isActive ? 'Running' : 'Idle'}
            </Badge>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                const routingEngine = emulationEngine.getNginxRoutingEngine(componentId);
                if (routingEngine) {
                  routingEngine.initialize({
                    locations: config.locations || [],
                    upstreams: config.upstreams || [],
                    rateLimitZones: config.rateLimitZones || [],
                    sslCertificates: config.sslCertificates || [],
                    enableSSL: config.enableSSL,
                    sslPort: config.sslPort,
                    enableGzip: config.enableGzip,
                    enableCache: config.enableCache,
                    maxWorkers: config.maxWorkers,
                  });
                  toast({
                    title: 'Success',
                    description: 'NGINX configuration reloaded',
                  });
                }
              }}
            >
              <Settings className="h-4 w-4 mr-2" />
              Reload Config
            </Button>
          </div>
        </div>

        <Separator />

        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Throughput</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics ? Math.round(metrics.throughput) : '0'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">req/s</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Latency</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics ? Math.round(metrics.latency) : '0'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">ms (avg)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cache Hit Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.customMetrics?.cache_hit_rate ? 
                  `${Math.round(metrics.customMetrics.cache_hit_rate * 100)}%` : 
                  '0%'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics?.customMetrics?.cache_hits || 0} hits / {metrics?.customMetrics?.cache_misses || 0} misses
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Utilization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics ? Math.round(metrics.utilization * 100) : '0'}%
              </div>
              <Progress value={metrics ? metrics.utilization * 100 : 0} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">SSL</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{enableSSL ? 'Enabled' : 'Disabled'}</div>
              <p className="text-xs text-muted-foreground mt-1">TLS/SSL status</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Workers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{maxWorkers}</div>
              <p className="text-xs text-muted-foreground mt-1">Worker processes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Locations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{locations.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Configured</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Port</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{port}</div>
              <p className="text-xs text-muted-foreground mt-1">Listening port</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Configuration Tabs */}
        <Tabs defaultValue="server" className="w-full">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="server" className="gap-2">
              <Server className="h-4 w-4" />
              Server
            </TabsTrigger>
            <TabsTrigger value="upstreams" className="gap-2">
              <Network className="h-4 w-4" />
              Upstreams
            </TabsTrigger>
            <TabsTrigger value="locations" className="gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Locations
            </TabsTrigger>
            <TabsTrigger value="ssl" className="gap-2">
              <Shield className="h-4 w-4" />
              SSL/TLS
            </TabsTrigger>
            <TabsTrigger value="rate-limiting" className="gap-2">
              <Gauge className="h-4 w-4" />
              Rate Limit
            </TabsTrigger>
            <TabsTrigger value="performance" className="gap-2">
              <Zap className="h-4 w-4" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-2">
              <Activity className="h-4 w-4" />
              Metrics
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2">
              <Settings className="h-4 w-4" />
              Config
            </TabsTrigger>
          </TabsList>

          {/* Server Tab */}
          <TabsContent value="server" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Server Configuration</CardTitle>
                <CardDescription>Basic server settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="number"
                      value={port}
                      onChange={(e) => updateConfig({ port: parseInt(e.target.value) || 80 })}
                      placeholder="80"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="server-name">Server Name</Label>
                    <Input
                      id="server-name"
                      value={serverName}
                      onChange={(e) => updateConfig({ serverName: e.target.value })}
                      placeholder="localhost"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-workers">Worker Processes</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="max-workers"
                      type="number"
                      min="1"
                      value={maxWorkers}
                      onChange={(e) => updateConfig({ maxWorkers: parseInt(e.target.value) || 4 })}
                      placeholder="4"
                    />
                    <span className="text-sm text-muted-foreground">processes</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Upstreams Tab */}
          <TabsContent value="upstreams" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Upstream Servers</CardTitle>
                  <CardDescription>Configure load balancing backends</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowCreateUpstream(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Upstream
                </Button>
              </CardHeader>
              {showCreateUpstream && (
                <CardContent className="border-b pb-4 mb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Upstream Name</Label>
                      <Input 
                        placeholder="backend" 
                        value={newUpstreamName}
                        onChange={(e) => setNewUpstreamName(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addUpstream}>Create Upstream</Button>
                      <Button variant="outline" onClick={() => {
                        setShowCreateUpstream(false);
                        setNewUpstreamName('');
                      }}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-4">
                {upstreams.map((upstream, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold font-mono">{upstream.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {upstream.servers.length} server(s) • Method: {upstream.method || 'round-robin'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingUpstreamIndex(editingUpstreamIndex === index ? null : index)}
                        >
                          {editingUpstreamIndex === index ? 'Hide' : 'Edit'}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeUpstream(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {editingUpstreamIndex === index && (
                      <div className="space-y-4 pt-3 border-t">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Upstream Name</Label>
                            <Input
                              value={upstream.name}
                              onChange={(e) => updateUpstream(index, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Load Balancing Method</Label>
                            <Select
                              value={upstream.method || 'round-robin'}
                              onValueChange={(value) => updateUpstream(index, 'method', value as any)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="round-robin">Round Robin</SelectItem>
                                <SelectItem value="least_conn">Least Connections</SelectItem>
                                <SelectItem value="ip_hash">IP Hash</SelectItem>
                                <SelectItem value="hash">Hash</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Servers</Label>
                            <Button variant="outline" size="sm" onClick={() => addUpstreamServer(index)}>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Server
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {upstream.servers.map((server, serverIndex) => (
                              <div key={serverIndex} className="p-3 border rounded bg-muted/50 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="grid grid-cols-4 gap-2 flex-1">
                                    <Input
                                      value={server.address}
                                      onChange={(e) => updateUpstreamServer(index, serverIndex, 'address', e.target.value)}
                                      placeholder="server:8080"
                                    />
                                    <Input
                                      type="number"
                                      value={server.weight || 1}
                                      onChange={(e) => updateUpstreamServer(index, serverIndex, 'weight', parseInt(e.target.value) || 1)}
                                      placeholder="Weight"
                                    />
                                    <Input
                                      type="number"
                                      value={server.maxFails || 3}
                                      onChange={(e) => updateUpstreamServer(index, serverIndex, 'maxFails', parseInt(e.target.value) || 3)}
                                      placeholder="Max Fails"
                                    />
                                    <Input
                                      value={server.failTimeout || '10s'}
                                      onChange={(e) => updateUpstreamServer(index, serverIndex, 'failTimeout', e.target.value)}
                                      placeholder="Fail Timeout"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={server.backup || false}
                                      onCheckedChange={(checked) => updateUpstreamServer(index, serverIndex, 'backup', checked)}
                                    />
                                    <Label className="text-xs">Backup</Label>
                                    <Switch
                                      checked={server.down || false}
                                      onCheckedChange={(checked) => updateUpstreamServer(index, serverIndex, 'down', checked)}
                                    />
                                    <Label className="text-xs">Down</Label>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeUpstreamServer(index, serverIndex)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Keepalive Connections</Label>
                          <Input
                            type="number"
                            value={upstream.keepalive || 32}
                            onChange={(e) => updateUpstream(index, 'keepalive', parseInt(e.target.value) || 32)}
                            placeholder="32"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Locations Tab */}
          <TabsContent value="locations" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Location Blocks</CardTitle>
                    <CardDescription>Configure routing and proxying</CardDescription>
                  </div>
                  <Button size="sm" onClick={addLocation} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Location
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {locations.map((location, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-primary/10">
                              <ArrowRightLeft className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{location.path}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {location.method} → {location.proxyPass}
                              </CardDescription>
                            </div>
                          </div>
                          {locations.length > 1 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeLocation(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Path</Label>
                            <Input
                              value={location.path}
                              onChange={(e) => updateLocation(index, 'path', e.target.value)}
                              placeholder="/"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Method</Label>
                            <Input
                              value={location.method}
                              onChange={(e) => updateLocation(index, 'method', e.target.value)}
                              placeholder="proxy"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Proxy Pass</Label>
                          <Input
                            value={location.proxyPass}
                            onChange={(e) => updateLocation(index, 'proxyPass', e.target.value)}
                            placeholder="http://backend:8080"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SSL Tab */}
          <TabsContent value="ssl" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>SSL/TLS Configuration</CardTitle>
                  <CardDescription>Secure connections and certificates</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowCreateSSL(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Certificate
                </Button>
              </CardHeader>
              {showCreateSSL && (
                <CardContent className="border-b pb-4 mb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Certificate Name</Label>
                      <Input 
                        placeholder="default" 
                        value={newSSLName}
                        onChange={(e) => setNewSSLName(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addSSLCertificate}>Add Certificate</Button>
                      <Button variant="outline" onClick={() => {
                        setShowCreateSSL(false);
                        setNewSSLName('');
                      }}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable SSL</Label>
                    <div className="text-sm text-muted-foreground">
                      Enable HTTPS support
                    </div>
                  </div>
                  <Switch
                    checked={enableSSL}
                    onCheckedChange={(checked) => updateConfig({ enableSSL: checked })}
                  />
                </div>
                {enableSSL && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="ssl-port">SSL Port</Label>
                      <Input
                        id="ssl-port"
                        type="number"
                        value={sslPort}
                        onChange={(e) => updateConfig({ sslPort: parseInt(e.target.value) || 443 })}
                        placeholder="443"
                      />
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <Label>SSL Certificates</Label>
                      {sslCertificates.map((cert, index) => (
                        <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="font-semibold">{cert.name}</div>
                            <Button variant="ghost" size="icon" onClick={() => removeSSLCertificate(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Certificate Path</Label>
                              <Input
                                value={cert.certPath}
                                onChange={(e) => updateSSLCertificate(index, 'certPath', e.target.value)}
                                placeholder="/etc/nginx/ssl/cert.pem"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Private Key Path</Label>
                              <Input
                                value={cert.keyPath}
                                onChange={(e) => updateSSLCertificate(index, 'keyPath', e.target.value)}
                                placeholder="/etc/nginx/ssl/key.pem"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Domain</Label>
                            <Input
                              value={cert.domain || ''}
                              onChange={(e) => updateSSLCertificate(index, 'domain', e.target.value)}
                              placeholder="example.com"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rate Limiting Tab */}
          <TabsContent value="rate-limiting" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Rate Limiting</CardTitle>
                  <CardDescription>Configure request rate limiting zones</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowCreateRateLimit(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Zone
                </Button>
              </CardHeader>
              {showCreateRateLimit && (
                <CardContent className="border-b pb-4 mb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Zone Name</Label>
                      <Input 
                        placeholder="api_limit" 
                        value={newRateLimitName}
                        onChange={(e) => setNewRateLimitName(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addRateLimitZone}>Add Zone</Button>
                      <Button variant="outline" onClick={() => {
                        setShowCreateRateLimit(false);
                        setNewRateLimitName('');
                      }}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-3">
                {rateLimitZones.map((zone, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold font-mono">{zone.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Size: {zone.size} • Rate: {zone.rate}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeRateLimitZone(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Zone Name</Label>
                        <Input
                          value={zone.name}
                          onChange={(e) => updateRateLimitZone(index, 'name', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Size</Label>
                        <Input
                          value={zone.size}
                          onChange={(e) => updateRateLimitZone(index, 'size', e.target.value)}
                          placeholder="10m"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Rate</Label>
                        <Input
                          value={zone.rate}
                          onChange={(e) => updateRateLimitZone(index, 'rate', e.target.value)}
                          placeholder="10r/s"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {rateLimitZones.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No rate limit zones configured. Add a zone to get started.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Settings</CardTitle>
                <CardDescription>Optimization and caching</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Gzip</Label>
                    <div className="text-sm text-muted-foreground">
                      Compress responses
                    </div>
                  </div>
                  <Switch
                    checked={enableGzip}
                    onCheckedChange={(checked) => updateConfig({ enableGzip: checked })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Cache</Label>
                    <div className="text-sm text-muted-foreground">
                      Cache static content
                    </div>
                  </div>
                  <Switch
                    checked={enableCache}
                    onCheckedChange={(checked) => updateConfig({ enableCache: checked })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Real-time Metrics</CardTitle>
                <CardDescription>Live performance metrics from NGINX simulation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {metrics ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Requests Per Second</Label>
                        <div className="text-3xl font-bold">{Math.round(metrics.throughput)}</div>
                        <p className="text-sm text-muted-foreground">Current throughput</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Average Latency</Label>
                        <div className="text-3xl font-bold">{Math.round(metrics.latency)}ms</div>
                        <p className="text-sm text-muted-foreground">Response time</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Error Rate</Label>
                        <div className="text-3xl font-bold">{(metrics.errorRate * 100).toFixed(2)}%</div>
                        <p className="text-sm text-muted-foreground">Failed requests</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Utilization</Label>
                        <div className="text-3xl font-bold">{Math.round(metrics.utilization * 100)}%</div>
                        <Progress value={metrics.utilization * 100} className="mt-2" />
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cache Hit Rate</Label>
                        <div className="text-2xl font-bold">
                          {metrics.customMetrics?.cache_hit_rate ? 
                            `${Math.round(metrics.customMetrics.cache_hit_rate * 100)}%` : 
                            '0%'}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Hits: {metrics.customMetrics?.cache_hits || 0} | 
                          Misses: {metrics.customMetrics?.cache_misses || 0}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Active Connections</Label>
                        <div className="text-2xl font-bold">
                          {metrics.customMetrics?.active_connections || 0}
                        </div>
                        <p className="text-sm text-muted-foreground">Current connections</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Rate Limit Blocks</Label>
                        <div className="text-2xl font-bold">
                          {metrics.customMetrics?.rate_limit_blocks || 0}
                        </div>
                        <p className="text-sm text-muted-foreground">Blocked requests</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Worker Threads</Label>
                        <div className="text-2xl font-bold">
                          {metrics.customMetrics?.worker_threads || maxWorkers}
                        </div>
                        <p className="text-sm text-muted-foreground">Active workers</p>
                      </div>
                    </div>
                    {metrics.latencyP50 !== undefined && (
                      <>
                        <Separator />
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Latency P50</Label>
                            <div className="text-2xl font-bold">{Math.round(metrics.latencyP50)}ms</div>
                            <p className="text-sm text-muted-foreground">Median latency</p>
                          </div>
                          {metrics.latencyP99 !== undefined && (
                            <div className="space-y-2">
                              <Label>Latency P99</Label>
                              <div className="text-2xl font-bold">{Math.round(metrics.latencyP99)}ms</div>
                              <p className="text-sm text-muted-foreground">99th percentile</p>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No metrics available. Start the simulation to see real-time metrics.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Config Tab */}
          <TabsContent value="config" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Server Block Configuration</CardTitle>
                    <CardDescription>NGINX server block configuration (read-only view)</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      // Generate config from structured data
                      const generatedConfig = generateNginxConfig({
                        port,
                        serverName,
                        locations,
                        upstreams,
                        sslCertificates,
                        rateLimitZones,
                        enableSSL,
                        sslPort,
                        enableGzip,
                        enableCache,
                        maxWorkers,
                      });
                      updateConfig({ config: generatedConfig });
                      toast({
                        title: 'Success',
                        description: 'Configuration regenerated from structured settings',
                      });
                    }}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Regenerate from Settings
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="config">Configuration</Label>
                  <Textarea
                    id="config"
                    value={nginxConfig}
                    onChange={(e) => updateConfig({ config: e.target.value })}
                    className="font-mono text-sm h-96"
                    placeholder="Enter NGINX configuration..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Note: This is a read-only view. Use the structured tabs (Server, Locations, Upstreams, etc.) to configure NGINX.
                    Changes here are saved but do not affect simulation. Click "Regenerate from Settings" to sync with current configuration.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


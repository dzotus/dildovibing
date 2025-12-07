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
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';
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
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

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
    const newUpstream: Upstream = {
      name: 'new_upstream',
      servers: [{ address: 'server1:8080', weight: 1 }],
      method: 'round-robin'
    };
    updateConfig({ upstreams: [...upstreams, newUpstream] });
    setShowCreateUpstream(false);
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
    const newCert: SSLCertificate = {
      name: 'new_cert',
      certPath: '/etc/nginx/ssl/cert.pem',
      keyPath: '/etc/nginx/ssl/key.pem',
      domain: 'example.com'
    };
    updateConfig({ sslCertificates: [...sslCertificates, newCert] });
    setShowCreateSSL(false);
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
    const newZone: RateLimitZone = {
      name: 'new_limit',
      size: '10m',
      rate: '10r/s'
    };
    updateConfig({ rateLimitZones: [...rateLimitZones, newZone] });
    setShowCreateRateLimit(false);
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
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Running
            </Badge>
            <Button size="sm" variant="outline">
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
          <TabsList className="grid w-full grid-cols-7">
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
                      <Input placeholder="backend" />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addUpstream}>Create Upstream</Button>
                      <Button variant="outline" onClick={() => setShowCreateUpstream(false)}>Cancel</Button>
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
                      <Input placeholder="default" />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addSSLCertificate}>Add Certificate</Button>
                      <Button variant="outline" onClick={() => setShowCreateSSL(false)}>Cancel</Button>
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
                      <Input placeholder="api_limit" />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addRateLimitZone}>Add Zone</Button>
                      <Button variant="outline" onClick={() => setShowCreateRateLimit(false)}>Cancel</Button>
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

          {/* Config Tab */}
          <TabsContent value="config" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Server Block Configuration</CardTitle>
                <CardDescription>NGINX server block configuration</CardDescription>
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


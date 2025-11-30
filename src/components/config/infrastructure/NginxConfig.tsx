import { useState } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Server, Globe, Shield, Settings, Code } from 'lucide-react';
import { CanvasNode } from '@/types';

interface Location {
  id: string;
  path: string;
  proxyPass: string;
  proxySetHeader: Record<string, string>;
  methods: string[];
}

interface ServerBlock {
  id: string;
  listen: number;
  serverName: string;
  sslEnabled: boolean;
  sslCertificate?: string;
  sslCertificateKey?: string;
  locations: Location[];
  accessLog?: string;
  errorLog?: string;
}

interface Upstream {
  id: string;
  name: string;
  servers: string[];
  method: 'round-robin' | 'least-conn' | 'ip-hash';
  keepalive: number;
}

interface NginxConfig {
  workerProcesses?: number;
  workerConnections?: number;
  serverBlocks?: ServerBlock[];
  upstreams?: Upstream[];
  enableGzip?: boolean;
  enableCaching?: boolean;
  cachePath?: string;
  cacheSize?: string;
}

export function NginxConfig({ componentId }: { componentId: string }) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;
  const [activeTab, setActiveTab] = useState('servers');

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as NginxConfig;
  const serverBlocks = config.serverBlocks || [];
  const upstreams = config.upstreams || [];

  const updateConfig = (updates: Partial<NginxConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addServerBlock = () => {
    const newServer: ServerBlock = {
      id: `server-${Date.now()}`,
      listen: 80,
      serverName: 'example.com',
      sslEnabled: false,
      locations: [],
    };
    updateConfig({ serverBlocks: [...serverBlocks, newServer] });
  };

  const updateServerBlock = (index: number, updates: Partial<ServerBlock>) => {
    const updated = [...serverBlocks];
    updated[index] = { ...updated[index], ...updates };
    updateConfig({ serverBlocks: updated });
  };

  const removeServerBlock = (index: number) => {
    updateConfig({ serverBlocks: serverBlocks.filter((_, i) => i !== index) });
  };

  const addLocation = (serverIndex: number) => {
    const server = serverBlocks[serverIndex];
    const newLocation: Location = {
      id: `location-${Date.now()}`,
      path: '/',
      proxyPass: 'http://localhost:8080',
      proxySetHeader: {},
      methods: ['GET'],
    };
    updateServerBlock(serverIndex, {
      locations: [...(server.locations || []), newLocation],
    });
  };

  const updateLocation = (serverIndex: number, locationIndex: number, updates: Partial<Location>) => {
    const server = serverBlocks[serverIndex];
    const updatedLocations = [...(server.locations || [])];
    updatedLocations[locationIndex] = { ...updatedLocations[locationIndex], ...updates };
    updateServerBlock(serverIndex, { locations: updatedLocations });
  };

  const removeLocation = (serverIndex: number, locationIndex: number) => {
    const server = serverBlocks[serverIndex];
    updateServerBlock(serverIndex, {
      locations: (server.locations || []).filter((_, i) => i !== locationIndex),
    });
  };

  const addUpstream = () => {
    const newUpstream: Upstream = {
      id: `upstream-${Date.now()}`,
      name: 'backend',
      servers: ['localhost:8080'],
      method: 'round-robin',
      keepalive: 32,
    };
    updateConfig({ upstreams: [...upstreams, newUpstream] });
  };

  const updateUpstream = (index: number, updates: Partial<Upstream>) => {
    const updated = [...upstreams];
    updated[index] = { ...updated[index], ...updates };
    updateConfig({ upstreams: updated });
  };

  const removeUpstream = (index: number) => {
    updateConfig({ upstreams: upstreams.filter((_, i) => i !== index) });
  };

  const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Server className="h-6 w-6" />
              NGINX Configuration
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure server blocks, locations, and upstreams
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border px-4">
          <TabsList className="bg-transparent">
            <TabsTrigger value="servers" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Server Blocks
            </TabsTrigger>
            <TabsTrigger value="upstreams" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              Upstreams
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6">
            <TabsContent value="servers" className="space-y-4 mt-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Server Blocks</h3>
                  <p className="text-sm text-muted-foreground">Configure virtual hosts and locations</p>
                </div>
                <Button onClick={addServerBlock} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Server Block
                </Button>
              </div>

              <div className="space-y-6">
                {serverBlocks.map((server, serverIndex) => (
                  <div key={server.id} className="border border-border rounded-lg p-4 space-y-4 bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5" />
                        <Input
                          value={server.serverName}
                          onChange={(e) => updateServerBlock(serverIndex, { serverName: e.target.value })}
                          placeholder="Server Name"
                          className="font-semibold text-lg border-0 bg-transparent p-0 h-auto"
                        />
                        {server.sslEnabled && <Badge variant="default">SSL</Badge>}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeServerBlock(serverIndex)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Listen Port</Label>
                        <Input
                          type="number"
                          value={server.listen}
                          onChange={(e) => updateServerBlock(serverIndex, { listen: parseInt(e.target.value) || 80 })}
                          placeholder="80"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Server Name</Label>
                        <Input
                          value={server.serverName}
                          onChange={(e) => updateServerBlock(serverIndex, { serverName: e.target.value })}
                          placeholder="example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>SSL</Label>
                        <div className="flex items-center gap-2 pt-2">
                          <Switch
                            checked={server.sslEnabled}
                            onCheckedChange={(checked) => updateServerBlock(serverIndex, { sslEnabled: checked })}
                          />
                          <Label className="text-sm">Enable SSL</Label>
                        </div>
                      </div>
                    </div>

                    {server.sslEnabled && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>SSL Certificate</Label>
                          <Input
                            value={server.sslCertificate || ''}
                            onChange={(e) => updateServerBlock(serverIndex, { sslCertificate: e.target.value })}
                            placeholder="/etc/ssl/certs/cert.pem"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>SSL Certificate Key</Label>
                          <Input
                            value={server.sslCertificateKey || ''}
                            onChange={(e) => updateServerBlock(serverIndex, { sslCertificateKey: e.target.value })}
                            placeholder="/etc/ssl/private/key.pem"
                          />
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* Locations Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Code className="h-4 w-4" />
                          <Label className="text-base font-semibold">Locations</Label>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addLocation(serverIndex)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Location
                        </Button>
                      </div>

                      {server.locations && server.locations.length > 0 ? (
                        <div className="space-y-3">
                          {server.locations.map((location, locationIndex) => (
                            <div key={location.id} className="border border-border rounded p-3 space-y-3 bg-secondary/30">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={location.path}
                                    onChange={(e) => updateLocation(serverIndex, locationIndex, { path: e.target.value })}
                                    placeholder="/api"
                                    className="font-mono border-0 bg-transparent p-0 h-auto font-semibold"
                                  />
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeLocation(serverIndex, locationIndex)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="space-y-2">
                                <Label className="text-xs">Proxy Pass</Label>
                                <Input
                                  value={location.proxyPass}
                                  onChange={(e) =>
                                    updateLocation(serverIndex, locationIndex, { proxyPass: e.target.value })
                                  }
                                  placeholder="http://localhost:8080"
                                  className="font-mono text-sm"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-xs">HTTP Methods</Label>
                                <div className="flex flex-wrap gap-2">
                                  {httpMethods.map((method) => (
                                    <Badge
                                      key={method}
                                      variant={location.methods.includes(method) ? 'default' : 'outline'}
                                      className="cursor-pointer"
                                      onClick={() => {
                                        const methods = location.methods.includes(method)
                                          ? location.methods.filter((m) => m !== method)
                                          : [...location.methods, method];
                                        updateLocation(serverIndex, locationIndex, { methods });
                                      }}
                                    >
                                      {method}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground border border-dashed border-border rounded text-sm">
                          No locations configured. Click "Add Location" to create one.
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {serverBlocks.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No server blocks defined. Click "Add Server Block" to create one.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="upstreams" className="space-y-4 mt-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Upstream Servers</h3>
                  <p className="text-sm text-muted-foreground">Configure load balancing upstreams</p>
                </div>
                <Button onClick={addUpstream} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Upstream
                </Button>
              </div>

              <div className="space-y-4">
                {upstreams.map((upstream, index) => (
                  <div key={upstream.id} className="border border-border rounded-lg p-4 space-y-3 bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Server className="h-5 w-5" />
                        <Input
                          value={upstream.name}
                          onChange={(e) => updateUpstream(index, { name: e.target.value })}
                          placeholder="Upstream Name"
                          className="font-semibold text-lg border-0 bg-transparent p-0 h-auto"
                        />
                        <Badge variant="outline">{upstream.method}</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeUpstream(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Load Balancing Method</Label>
                        <select
                          value={upstream.method}
                          onChange={(e) =>
                            updateUpstream(index, { method: e.target.value as Upstream['method'] })
                          }
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="round-robin">Round Robin</option>
                          <option value="least-conn">Least Connections</option>
                          <option value="ip-hash">IP Hash</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Keepalive Connections</Label>
                        <Input
                          type="number"
                          value={upstream.keepalive}
                          onChange={(e) => updateUpstream(index, { keepalive: parseInt(e.target.value) || 32 })}
                          placeholder="32"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Servers (one per line)</Label>
                      <textarea
                        value={upstream.servers.join('\n')}
                        onChange={(e) =>
                          updateUpstream(index, {
                            servers: e.target.value.split('\n').filter((s) => s.trim()),
                          })
                        }
                        placeholder="localhost:8080&#10;localhost:8081&#10;localhost:8082"
                        className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                        rows={4}
                      />
                    </div>
                  </div>
                ))}

                {upstreams.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No upstreams defined. Click "Add Upstream" to create one.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-0">
              <div>
                <h3 className="text-lg font-semibold mb-4">NGINX Settings</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Worker Processes</Label>
                      <Input
                        type="number"
                        value={config.workerProcesses || ''}
                        onChange={(e) => updateConfig({ workerProcesses: parseInt(e.target.value) || undefined })}
                        placeholder="auto"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Worker Connections</Label>
                      <Input
                        type="number"
                        value={config.workerConnections || ''}
                        onChange={(e) => updateConfig({ workerConnections: parseInt(e.target.value) || undefined })}
                        placeholder="1024"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={config.enableGzip !== false}
                        onCheckedChange={(checked) => updateConfig({ enableGzip: checked })}
                      />
                      <Label>Enable Gzip Compression</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={config.enableCaching || false}
                        onCheckedChange={(checked) => updateConfig({ enableCaching: checked })}
                      />
                      <Label>Enable Caching</Label>
                    </div>
                  </div>

                  {config.enableCaching && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cache Path</Label>
                        <Input
                          value={config.cachePath || ''}
                          onChange={(e) => updateConfig({ cachePath: e.target.value })}
                          placeholder="/var/cache/nginx"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cache Size</Label>
                        <Input
                          value={config.cacheSize || ''}
                          onChange={(e) => updateConfig({ cacheSize: e.target.value })}
                          placeholder="10m"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}


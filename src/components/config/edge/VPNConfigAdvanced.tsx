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
  Shield,
  Users,
  Network,
  CheckCircle,
  Zap,
  Lock,
  Clock
} from 'lucide-react';

interface VPNConfigProps {
  componentId: string;
}

interface Connection {
  id: string;
  username: string;
  remoteIP: string;
  localIP?: string;
  status: 'connected' | 'disconnected' | 'connecting';
  connectedAt?: string;
  bytesIn?: number;
  bytesOut?: number;
  duration?: number;
}

interface Tunnel {
  id: string;
  name: string;
  type: 'site-to-site' | 'remote-access';
  remoteEndpoint: string;
  status: 'up' | 'down';
  connections?: number;
  bytesIn?: number;
  bytesOut?: number;
}

interface VPNConfig {
  connections?: Connection[];
  tunnels?: Tunnel[];
  totalConnections?: number;
  activeConnections?: number;
  totalTunnels?: number;
  totalBytes?: number;
  vpnProtocol?: 'openvpn' | 'ipsec' | 'wireguard';
  encryptionAlgorithm?: 'aes-128' | 'aes-256' | 'chacha20-poly1305';
  enableCompression?: boolean;
  enableKeepAlive?: boolean;
  maxConnections?: number;
  connectionTimeout?: number;
}

export function VPNConfigAdvanced({ componentId }: VPNConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as VPNConfig;
  const connections = config.connections || [
    {
      id: 'conn-1',
      username: 'user1',
      remoteIP: '203.0.113.10',
      localIP: '10.8.0.5',
      status: 'connected',
      connectedAt: new Date(Date.now() - 3600000).toISOString(),
      bytesIn: 1024000000,
      bytesOut: 512000000,
      duration: 3600,
    },
    {
      id: 'conn-2',
      username: 'user2',
      remoteIP: '203.0.113.11',
      localIP: '10.8.0.6',
      status: 'connected',
      connectedAt: new Date(Date.now() - 1800000).toISOString(),
      bytesIn: 512000000,
      bytesOut: 256000000,
      duration: 1800,
    },
  ];
  const tunnels = config.tunnels || [
    {
      id: 'tunnel-1',
      name: 'HQ to Branch',
      type: 'site-to-site',
      remoteEndpoint: '192.168.100.1',
      status: 'up',
      connections: 1,
      bytesIn: 2048000000,
      bytesOut: 1024000000,
    },
    {
      id: 'tunnel-2',
      name: 'Remote Access',
      type: 'remote-access',
      remoteEndpoint: 'vpn.example.com',
      status: 'up',
      connections: 2,
      bytesIn: 1536000000,
      bytesOut: 768000000,
    },
  ];
  const totalConnections = config.totalConnections || connections.length;
  const activeConnections = config.activeConnections || connections.filter((c) => c.status === 'connected').length;
  const totalTunnels = config.totalTunnels || tunnels.length;
  const totalBytes = config.totalBytes || connections.reduce((sum, c) => sum + (c.bytesIn || 0) + (c.bytesOut || 0), 0);

  const updateConfig = (updates: Partial<VPNConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'up':
        return 'bg-green-500';
      case 'disconnected':
      case 'down':
        return 'bg-gray-500';
      case 'connecting':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">VPN Concentrator</p>
            <h2 className="text-2xl font-bold text-foreground">Virtual Private Network</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Secure remote access and site-to-site connectivity
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
          <Card className="border-l-4 border-l-blue-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Connections</CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{activeConnections}</span>
                <span className="text-xs text-muted-foreground">/ {totalConnections} total</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tunnels</CardTitle>
                <Network className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalTunnels}</span>
                <span className="text-xs text-muted-foreground">active</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Data Transferred</CardTitle>
                <Zap className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{(totalBytes / 1024 / 1024 / 1024).toFixed(2)}</span>
                <span className="text-xs text-muted-foreground">GB</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Encryption</CardTitle>
                <Lock className="h-4 w-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-semibold text-cyan-600 dark:text-cyan-400">AES-256</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="connections" className="space-y-4">
          <TabsList>
            <TabsTrigger value="connections">
              <Users className="h-4 w-4 mr-2" />
              Connections ({connections.length})
            </TabsTrigger>
            <TabsTrigger value="tunnels">
              <Network className="h-4 w-4 mr-2" />
              Tunnels ({tunnels.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connections" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Connections</CardTitle>
                <CardDescription>VPN client connections</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {connections.map((conn) => (
                    <Card key={conn.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getStatusColor(conn.status)}/20`}>
                              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{conn.username}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className={getStatusColor(conn.status)}>
                                  {conn.status}
                                </Badge>
                                <Badge variant="outline" className="font-mono text-xs">{conn.remoteIP}</Badge>
                                {conn.localIP && (
                                  <Badge variant="outline" className="font-mono text-xs">{conn.localIP}</Badge>
                                )}
                                {conn.duration && (
                                  <Badge variant="outline">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {formatDuration(conn.duration)}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Bytes In:</span>
                            <span className="ml-2 font-semibold">{formatBytes(conn.bytesIn)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Bytes Out:</span>
                            <span className="ml-2 font-semibold">{formatBytes(conn.bytesOut)}</span>
                          </div>
                        </div>
                        {conn.connectedAt && (
                          <div className="text-xs text-muted-foreground mt-2">
                            Connected: {new Date(conn.connectedAt).toLocaleString()}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tunnels" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>VPN Tunnels</CardTitle>
                <CardDescription>Site-to-site and remote access tunnels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tunnels.map((tunnel) => (
                    <Card key={tunnel.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${getStatusColor(tunnel.status)}/20`}>
                            <Network className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <CardTitle className="text-lg font-semibold">{tunnel.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className={getStatusColor(tunnel.status)}>
                                {tunnel.status}
                              </Badge>
                              <Badge variant="outline">{tunnel.type}</Badge>
                              <Badge variant="outline" className="font-mono text-xs">{tunnel.remoteEndpoint}</Badge>
                              {tunnel.connections && (
                                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
                                  {tunnel.connections} connections
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Bytes In:</span>
                            <span className="ml-2 font-semibold">{formatBytes(tunnel.bytesIn)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Bytes Out:</span>
                            <span className="ml-2 font-semibold">{formatBytes(tunnel.bytesOut)}</span>
                          </div>
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
                <CardTitle>VPN Settings</CardTitle>
                <CardDescription>VPN concentrator configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>VPN Protocol</Label>
                  <Select 
                    value={config.vpnProtocol ?? 'openvpn'}
                    onValueChange={(value: 'openvpn' | 'ipsec' | 'wireguard') => updateConfig({ vpnProtocol: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openvpn">OpenVPN</SelectItem>
                      <SelectItem value="ipsec">IPsec</SelectItem>
                      <SelectItem value="wireguard">WireGuard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Encryption Algorithm</Label>
                  <Select 
                    value={config.encryptionAlgorithm ?? 'aes-256'}
                    onValueChange={(value: 'aes-128' | 'aes-256' | 'chacha20-poly1305') => updateConfig({ encryptionAlgorithm: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aes-256">AES-256</SelectItem>
                      <SelectItem value="aes-128">AES-128</SelectItem>
                      <SelectItem value="chacha20-poly1305">ChaCha20</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Enable Compression</Label>
                  <Switch 
                    checked={config.enableCompression ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableCompression: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Keep-Alive</Label>
                  <Switch 
                    checked={config.enableKeepAlive ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableKeepAlive: checked })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Connections</Label>
                  <Input 
                    type="number" 
                    value={config.maxConnections ?? 100}
                    onChange={(e) => updateConfig({ maxConnections: parseInt(e.target.value) || 100 })}
                    min={1} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Connection Timeout (seconds)</Label>
                  <Input 
                    type="number" 
                    value={config.connectionTimeout ?? 120}
                    onChange={(e) => updateConfig({ connectionTimeout: parseInt(e.target.value) || 120 })}
                    min={1} 
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





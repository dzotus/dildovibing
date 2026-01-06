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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useState, useEffect } from 'react';
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
  Clock,
  Edit,
  X,
  Search,
  Filter
} from 'lucide-react';
import { useEmulationStore } from '@/store/useEmulationStore';
import { emulationEngine } from '@/core/EmulationEngine';
import { showSuccess, showError, showInfo } from '@/utils/toast';

interface VPNConfigProps {
  componentId: string;
}

interface Connection {
  id: string;
  username: string;
  remoteIP: string;
  localIP?: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'disconnecting';
  protocol?: 'openvpn' | 'ipsec' | 'wireguard' | 'l2tp' | 'pptp';
  connectedAt?: string;
  bytesIn?: number;
  bytesOut?: number;
  packetsIn?: number;
  packetsOut?: number;
  duration?: number;
  encryptionAlgorithm?: 'aes-128' | 'aes-256' | 'chacha20-poly1305';
  compressionEnabled?: boolean;
}

interface Tunnel {
  id: string;
  name: string;
  type: 'site-to-site' | 'remote-access';
  protocol?: 'openvpn' | 'ipsec' | 'wireguard';
  localEndpoint?: string;
  remoteEndpoint: string;
  status: 'up' | 'down' | 'connecting' | 'disconnecting';
  connections?: string[];
  bytesIn?: number;
  bytesOut?: number;
  packetsIn?: number;
  packetsOut?: number;
  encryptionAlgorithm?: 'aes-128' | 'aes-256' | 'chacha20-poly1305';
  compressionEnabled?: boolean;
  keepAliveEnabled?: boolean;
  keepAliveInterval?: number;
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
  enableSSL?: boolean;
  sslPort?: number;
  enableIPSec?: boolean;
  ipsecPort?: number;
  enableL2TP?: boolean;
  enablePPTP?: boolean;
  enableRadius?: boolean;
  radiusServer?: string;
  enableMFA?: boolean;
  mfaProvider?: 'totp' | 'sms' | 'email';
}

export function VPNConfigAdvanced({ componentId }: VPNConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { getComponentMetrics, isRunning } = useEmulationStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [editingTunnel, setEditingTunnel] = useState<Tunnel | null>(null);
  const [deletingConnection, setDeletingConnection] = useState<string | null>(null);
  const [deletingTunnel, setDeletingTunnel] = useState<string | null>(null);
  const [connectionSearch, setConnectionSearch] = useState('');
  const [tunnelSearch, setTunnelSearch] = useState('');
  const [connectionFilter, setConnectionFilter] = useState<'all' | 'connected' | 'disconnected'>('all');
  const [tunnelFilter, setTunnelFilter] = useState<'all' | 'up' | 'down'>('all');

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as VPNConfig;
  
  // Get VPN engine for real-time metrics
  const vpnEngine = emulationEngine.getVPNEmulationEngine(componentId);
  const componentMetrics = getComponentMetrics(componentId);
  
  // Get connections and tunnels from config or engine
  const getConnections = (): Connection[] => {
    if (vpnEngine && isRunning) {
      const engineConnections = vpnEngine.getConnections();
      return engineConnections.map(conn => ({
        id: conn.id,
        username: conn.username,
        remoteIP: conn.remoteIP,
        localIP: conn.localIP,
        status: conn.status,
        protocol: conn.protocol,
        connectedAt: conn.connectedAt ? new Date(conn.connectedAt).toISOString() : undefined,
        bytesIn: conn.bytesIn,
        bytesOut: conn.bytesOut,
        packetsIn: conn.packetsIn,
        packetsOut: conn.packetsOut,
        duration: conn.connectedAt ? Math.floor((Date.now() - conn.connectedAt) / 1000) : undefined,
        encryptionAlgorithm: conn.encryptionAlgorithm,
        compressionEnabled: conn.compressionEnabled,
      }));
    }
    return config.connections || [];
  };

  const getTunnels = (): Tunnel[] => {
    if (vpnEngine && isRunning) {
      const engineTunnels = vpnEngine.getTunnels();
      return engineTunnels.map(tunnel => ({
        id: tunnel.id,
        name: tunnel.name,
        type: tunnel.type,
        protocol: tunnel.protocol,
        localEndpoint: tunnel.localEndpoint,
        remoteEndpoint: tunnel.remoteEndpoint,
        status: tunnel.status,
        connections: tunnel.connections,
        bytesIn: tunnel.bytesIn,
        bytesOut: tunnel.bytesOut,
        packetsIn: tunnel.packetsIn,
        packetsOut: tunnel.packetsOut,
        encryptionAlgorithm: tunnel.encryptionAlgorithm,
        compressionEnabled: tunnel.compressionEnabled,
        keepAliveEnabled: tunnel.keepAliveEnabled,
        keepAliveInterval: tunnel.keepAliveInterval,
      }));
    }
    return config.tunnels || [];
  };

  const connections = getConnections();
  const tunnels = getTunnels();

  // Calculate stats from connections and tunnels
  const activeConnections = connections.filter((c) => c.status === 'connected').length;
  const totalConnections = connections.length;
  const activeTunnels = tunnels.filter((t) => t.status === 'up').length;
  const totalTunnels = tunnels.length;
  const totalBytes = connections.reduce((sum, c) => sum + (c.bytesIn || 0) + (c.bytesOut || 0), 0) +
                     tunnels.reduce((sum, t) => sum + (t.bytesIn || 0) + (t.bytesOut || 0), 0);

  // Filter connections
  const filteredConnections = connections.filter(conn => {
    const matchesSearch = !connectionSearch || 
      conn.username.toLowerCase().includes(connectionSearch.toLowerCase()) ||
      conn.remoteIP.includes(connectionSearch) ||
      (conn.localIP && conn.localIP.includes(connectionSearch));
    const matchesFilter = connectionFilter === 'all' || conn.status === connectionFilter;
    return matchesSearch && matchesFilter;
  });

  // Filter tunnels
  const filteredTunnels = tunnels.filter(tunnel => {
    const matchesSearch = !tunnelSearch ||
      tunnel.name.toLowerCase().includes(tunnelSearch.toLowerCase()) ||
      tunnel.remoteEndpoint.includes(tunnelSearch);
    const matchesFilter = tunnelFilter === 'all' || tunnel.status === tunnelFilter;
    return matchesSearch && matchesFilter;
  });

  const updateConfig = (updates: Partial<VPNConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
    
    // Reinitialize engine with new config
    if (vpnEngine) {
      const updatedNode = { ...node, data: { ...node.data, config: { ...config, ...updates } } };
      vpnEngine.initializeConfig(updatedNode);
      emulationEngine.initialize([updatedNode], []);
    }
  };

  const handleAddConnection = () => {
    const newConnection: Connection = {
      id: `conn-${Date.now()}`,
      username: '',
      remoteIP: '',
      status: 'disconnected',
      protocol: config.vpnProtocol || 'openvpn',
      bytesIn: 0,
      bytesOut: 0,
      packetsIn: 0,
      packetsOut: 0,
      encryptionAlgorithm: config.encryptionAlgorithm,
      compressionEnabled: config.enableCompression,
    };
    setEditingConnection(newConnection);
  };

  const handleEditConnection = (connection: Connection) => {
    setEditingConnection({ ...connection });
  };

  const handleSaveConnection = () => {
    if (!editingConnection) return;

    // Validation
    if (!editingConnection.username.trim()) {
      showError('Username is required');
      return;
    }
    if (!editingConnection.remoteIP.trim()) {
      showError('Remote IP is required');
      return;
    }

    const updatedConnections = editingConnection.id && connections.find(c => c.id === editingConnection.id)
      ? connections.map(c => c.id === editingConnection.id ? editingConnection : c)
      : [...connections, editingConnection];

    updateConfig({ connections: updatedConnections });

    // Update engine if running
    if (vpnEngine) {
      try {
        if (editingConnection.id && connections.find(c => c.id === editingConnection.id)) {
          // Update existing
          vpnEngine.updateConnectionStatus(editingConnection.id, editingConnection.status);
        } else {
          // Create new
          vpnEngine.createConnection({
            id: editingConnection.id,
            username: editingConnection.username,
            remoteIP: editingConnection.remoteIP,
            localIP: editingConnection.localIP,
            status: editingConnection.status,
            protocol: editingConnection.protocol || config.vpnProtocol || 'openvpn',
            bytesIn: editingConnection.bytesIn || 0,
            bytesOut: editingConnection.bytesOut || 0,
            packetsIn: editingConnection.packetsIn || 0,
            packetsOut: editingConnection.packetsOut || 0,
            encryptionAlgorithm: editingConnection.encryptionAlgorithm,
            compressionEnabled: editingConnection.compressionEnabled,
          });
        }
        showSuccess(editingConnection.id && connections.find(c => c.id === editingConnection.id) 
          ? 'Connection updated successfully' 
          : 'Connection created successfully');
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Failed to update connection');
      }
    } else {
      showSuccess(editingConnection.id && connections.find(c => c.id === editingConnection.id) 
        ? 'Connection updated successfully' 
        : 'Connection created successfully');
    }

    setEditingConnection(null);
  };

  const handleDeleteConnection = (connectionId: string) => {
    const updatedConnections = connections.filter(c => c.id !== connectionId);
    updateConfig({ connections: updatedConnections });

    // Update engine if running
    if (vpnEngine) {
      try {
        vpnEngine.removeConnection(connectionId);
        showSuccess('Connection deleted successfully');
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Failed to delete connection');
      }
    } else {
      showSuccess('Connection deleted successfully');
    }

    setDeletingConnection(null);
  };

  const handleAddTunnel = () => {
    const newTunnel: Tunnel = {
      id: `tunnel-${Date.now()}`,
      name: '',
      type: 'site-to-site',
      protocol: config.vpnProtocol || 'openvpn',
      remoteEndpoint: '',
      status: 'down',
      connections: [],
      bytesIn: 0,
      bytesOut: 0,
      packetsIn: 0,
      packetsOut: 0,
      encryptionAlgorithm: config.encryptionAlgorithm,
      compressionEnabled: config.enableCompression,
      keepAliveEnabled: config.enableKeepAlive,
      keepAliveInterval: 30,
    };
    setEditingTunnel(newTunnel);
  };

  const handleEditTunnel = (tunnel: Tunnel) => {
    setEditingTunnel({ ...tunnel });
  };

  const handleSaveTunnel = () => {
    if (!editingTunnel) return;

    // Validation
    if (!editingTunnel.name.trim()) {
      showError('Tunnel name is required');
      return;
    }
    if (!editingTunnel.remoteEndpoint.trim()) {
      showError('Remote endpoint is required');
      return;
    }

    const updatedTunnels = editingTunnel.id && tunnels.find(t => t.id === editingTunnel.id)
      ? tunnels.map(t => t.id === editingTunnel.id ? editingTunnel : t)
      : [...tunnels, editingTunnel];

    updateConfig({ tunnels: updatedTunnels });

    // Update engine if running
    if (vpnEngine) {
      try {
        if (editingTunnel.id && tunnels.find(t => t.id === editingTunnel.id)) {
          // Update existing
          vpnEngine.updateTunnelStatus(editingTunnel.id, editingTunnel.status);
        } else {
          // Create new
          vpnEngine.createTunnel({
            id: editingTunnel.id,
            name: editingTunnel.name,
            type: editingTunnel.type,
            protocol: editingTunnel.protocol || config.vpnProtocol || 'openvpn',
            localEndpoint: editingTunnel.localEndpoint || '',
            remoteEndpoint: editingTunnel.remoteEndpoint,
            status: editingTunnel.status,
            connections: editingTunnel.connections || [],
            bytesIn: editingTunnel.bytesIn || 0,
            bytesOut: editingTunnel.bytesOut || 0,
            packetsIn: editingTunnel.packetsIn || 0,
            packetsOut: editingTunnel.packetsOut || 0,
            encryptionAlgorithm: editingTunnel.encryptionAlgorithm,
            compressionEnabled: editingTunnel.compressionEnabled,
            keepAliveEnabled: editingTunnel.keepAliveEnabled,
            keepAliveInterval: editingTunnel.keepAliveInterval || 30,
          });
        }
        showSuccess(editingTunnel.id && tunnels.find(t => t.id === editingTunnel.id) 
          ? 'Tunnel updated successfully' 
          : 'Tunnel created successfully');
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Failed to update tunnel');
      }
    } else {
      showSuccess(editingTunnel.id && tunnels.find(t => t.id === editingTunnel.id) 
        ? 'Tunnel updated successfully' 
        : 'Tunnel created successfully');
    }

    setEditingTunnel(null);
  };

  const handleDeleteTunnel = (tunnelId: string) => {
    const updatedTunnels = tunnels.filter(t => t.id !== tunnelId);
    updateConfig({ tunnels: updatedTunnels });

    // Update engine if running
    if (vpnEngine) {
      try {
        vpnEngine.removeTunnel(tunnelId);
        showSuccess('Tunnel deleted successfully');
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Failed to delete tunnel');
      }
    } else {
      showSuccess('Tunnel deleted successfully');
    }

    setDeletingTunnel(null);
  };

  const handleRefresh = () => {
    if (vpnEngine && isRunning) {
      // Reinitialize engine to sync with config
      vpnEngine.initializeConfig(node);
      emulationEngine.initialize([node], []);
      showInfo('VPN metrics refreshed');
    } else {
      showInfo('VPN metrics refreshed');
    }
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
      case 'disconnecting':
        return 'bg-yellow-500';
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

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  // Get encryption algorithm from config or metrics
  const encryptionAlgorithm = config.encryptionAlgorithm || 'aes-256';

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
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              {componentMetrics?.customMetrics?.vpn_active_connections !== undefined && (
                <div className="text-xs text-muted-foreground mt-1">
                  From simulation: {componentMetrics.customMetrics.vpn_active_connections}
                </div>
              )}
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
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{activeTunnels}</span>
                <span className="text-xs text-muted-foreground">/ {totalTunnels} total</span>
              </div>
              {componentMetrics?.customMetrics?.vpn_active_tunnels !== undefined && (
                <div className="text-xs text-muted-foreground mt-1">
                  From simulation: {componentMetrics.customMetrics.vpn_active_tunnels}
                </div>
              )}
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
              {componentMetrics?.customMetrics?.vpn_bytes_per_second !== undefined && (
                <div className="text-xs text-muted-foreground mt-1">
                  {formatBytes(componentMetrics.customMetrics.vpn_bytes_per_second)}/s
                </div>
              )}
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
              <div className="text-sm font-semibold text-cyan-600 dark:text-cyan-400">
                {encryptionAlgorithm.toUpperCase().replace('-', '-')}
              </div>
              {componentMetrics?.customMetrics?.vpn_encryption_operations !== undefined && (
                <div className="text-xs text-muted-foreground mt-1">
                  {componentMetrics.customMetrics.vpn_encryption_operations.toLocaleString()} operations
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="connections" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="connections" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Connections</span>
              <Badge variant="secondary" className="ml-1">{connections.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="tunnels" className="flex items-center gap-2">
              <Network className="h-4 w-4" />
              <span>Tunnels</span>
              <Badge variant="secondary" className="ml-1">{tunnels.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connections" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Active Connections</CardTitle>
                    <CardDescription>VPN client connections</CardDescription>
                  </div>
                  <Button onClick={handleAddConnection} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Connection
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Search and Filter */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search connections..."
                        value={connectionSearch}
                        onChange={(e) => setConnectionSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <Select value={connectionFilter} onValueChange={(v: any) => setConnectionFilter(v)}>
                      <SelectTrigger className="w-[180px]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="connected">Connected</SelectItem>
                        <SelectItem value="disconnected">Disconnected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {filteredConnections.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {connections.length === 0 ? 'No connections configured' : 'No connections match your filters'}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredConnections.map((conn) => (
                        <Card key={conn.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                <div className={`p-2 rounded-lg ${getStatusColor(conn.status)}/20`}>
                                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex-1">
                                  <CardTitle className="text-lg font-semibold">{conn.username}</CardTitle>
                                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <Badge variant="outline" className={getStatusColor(conn.status)}>
                                      {conn.status}
                                    </Badge>
                                    <Badge variant="outline" className="font-mono text-xs">{conn.remoteIP}</Badge>
                                    {conn.localIP && (
                                      <Badge variant="outline" className="font-mono text-xs">{conn.localIP}</Badge>
                                    )}
                                    {conn.protocol && (
                                      <Badge variant="outline">{conn.protocol}</Badge>
                                    )}
                                    {conn.duration !== undefined && (
                                      <Badge variant="outline">
                                        <Clock className="h-3 w-3 mr-1" />
                                        {formatDuration(conn.duration)}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditConnection(conn)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeletingConnection(conn.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
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
                              {conn.packetsIn !== undefined && (
                                <div>
                                  <span className="text-muted-foreground">Packets In:</span>
                                  <span className="ml-2 font-semibold">{conn.packetsIn.toLocaleString()}</span>
                                </div>
                              )}
                              {conn.packetsOut !== undefined && (
                                <div>
                                  <span className="text-muted-foreground">Packets Out:</span>
                                  <span className="ml-2 font-semibold">{conn.packetsOut.toLocaleString()}</span>
                                </div>
                              )}
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
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tunnels" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>VPN Tunnels</CardTitle>
                    <CardDescription>Site-to-site and remote access tunnels</CardDescription>
                  </div>
                  <Button onClick={handleAddTunnel} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tunnel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Search and Filter */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search tunnels..."
                        value={tunnelSearch}
                        onChange={(e) => setTunnelSearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <Select value={tunnelFilter} onValueChange={(v: any) => setTunnelFilter(v)}>
                      <SelectTrigger className="w-[180px]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="up">Up</SelectItem>
                        <SelectItem value="down">Down</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {filteredTunnels.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {tunnels.length === 0 ? 'No tunnels configured' : 'No tunnels match your filters'}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredTunnels.map((tunnel) => (
                        <Card key={tunnel.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-card">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                <div className={`p-2 rounded-lg ${getStatusColor(tunnel.status)}/20`}>
                                  <Network className="h-5 w-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div className="flex-1">
                                  <CardTitle className="text-lg font-semibold">{tunnel.name}</CardTitle>
                                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <Badge variant="outline" className={getStatusColor(tunnel.status)}>
                                      {tunnel.status}
                                    </Badge>
                                    <Badge variant="outline">{tunnel.type}</Badge>
                                    {tunnel.protocol && (
                                      <Badge variant="outline">{tunnel.protocol}</Badge>
                                    )}
                                    <Badge variant="outline" className="font-mono text-xs">{tunnel.remoteEndpoint}</Badge>
                                    {tunnel.connections && tunnel.connections.length > 0 && (
                                      <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
                                        {tunnel.connections.length} connections
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditTunnel(tunnel)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeletingTunnel(tunnel.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
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
                              {tunnel.packetsIn !== undefined && (
                                <div>
                                  <span className="text-muted-foreground">Packets In:</span>
                                  <span className="ml-2 font-semibold">{tunnel.packetsIn.toLocaleString()}</span>
                                </div>
                              )}
                              {tunnel.packetsOut !== undefined && (
                                <div>
                                  <span className="text-muted-foreground">Packets Out:</span>
                                  <span className="ml-2 font-semibold">{tunnel.packetsOut.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                            {tunnel.localEndpoint && (
                              <div className="text-xs text-muted-foreground mt-2">
                                Local: {tunnel.localEndpoint}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
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
                      <SelectItem value="chacha20-poly1305">ChaCha20-Poly1305</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Compression</Label>
                    <p className="text-xs text-muted-foreground">Compress VPN traffic</p>
                  </div>
                  <Switch 
                    checked={config.enableCompression ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableCompression: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Keep-Alive</Label>
                    <p className="text-xs text-muted-foreground">Keep connections alive</p>
                  </div>
                  <Switch 
                    checked={config.enableKeepAlive ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableKeepAlive: checked })}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Max Connections</Label>
                  <Input 
                    type="number" 
                    value={config.maxConnections ?? 1000}
                    onChange={(e) => updateConfig({ maxConnections: parseInt(e.target.value) || 1000 })}
                    min={1}
                    max={10000}
                  />
                  <p className="text-xs text-muted-foreground">Maximum concurrent VPN connections</p>
                </div>
                <div className="space-y-2">
                  <Label>Connection Timeout (seconds)</Label>
                  <Input 
                    type="number" 
                    value={config.connectionTimeout ?? 300}
                    onChange={(e) => updateConfig({ connectionTimeout: parseInt(e.target.value) || 300 })}
                    min={1}
                    max={3600}
                  />
                  <p className="text-xs text-muted-foreground">Timeout for inactive connections</p>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Protocol Settings</Label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable SSL VPN</Label>
                      <p className="text-xs text-muted-foreground">Enable SSL-based VPN</p>
                    </div>
                    <Switch 
                      checked={config.enableSSL ?? true}
                      onCheckedChange={(checked) => updateConfig({ enableSSL: checked })}
                    />
                  </div>
                  {config.enableSSL && (
                    <div className="space-y-2">
                      <Label>SSL Port</Label>
                      <Input 
                        type="number" 
                        value={config.sslPort ?? 443}
                        onChange={(e) => updateConfig({ sslPort: parseInt(e.target.value) || 443 })}
                        min={1}
                        max={65535}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable IPSec</Label>
                      <p className="text-xs text-muted-foreground">Enable IPSec protocol</p>
                    </div>
                    <Switch 
                      checked={config.enableIPSec ?? true}
                      onCheckedChange={(checked) => updateConfig({ enableIPSec: checked })}
                    />
                  </div>
                  {config.enableIPSec && (
                    <div className="space-y-2">
                      <Label>IPSec Port</Label>
                      <Input 
                        type="number" 
                        value={config.ipsecPort ?? 500}
                        onChange={(e) => updateConfig({ ipsecPort: parseInt(e.target.value) || 500 })}
                        min={1}
                        max={65535}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable L2TP</Label>
                      <p className="text-xs text-muted-foreground">Enable L2TP protocol</p>
                    </div>
                    <Switch 
                      checked={config.enableL2TP ?? false}
                      onCheckedChange={(checked) => updateConfig({ enableL2TP: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable PPTP</Label>
                      <p className="text-xs text-muted-foreground">Enable PPTP protocol (not recommended)</p>
                    </div>
                    <Switch 
                      checked={config.enablePPTP ?? false}
                      onCheckedChange={(checked) => updateConfig({ enablePPTP: checked })}
                    />
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Authentication</Label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable RADIUS</Label>
                      <p className="text-xs text-muted-foreground">Use RADIUS for authentication</p>
                    </div>
                    <Switch 
                      checked={config.enableRadius ?? false}
                      onCheckedChange={(checked) => updateConfig({ enableRadius: checked })}
                    />
                  </div>
                  {config.enableRadius && (
                    <div className="space-y-2">
                      <Label>RADIUS Server</Label>
                      <Input 
                        type="text" 
                        value={config.radiusServer ?? ''}
                        onChange={(e) => updateConfig({ radiusServer: e.target.value })}
                        placeholder="radius.example.com"
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable MFA</Label>
                      <p className="text-xs text-muted-foreground">Multi-factor authentication</p>
                    </div>
                    <Switch 
                      checked={config.enableMFA ?? false}
                      onCheckedChange={(checked) => updateConfig({ enableMFA: checked })}
                    />
                  </div>
                  {config.enableMFA && (
                    <div className="space-y-2">
                      <Label>MFA Provider</Label>
                      <Select 
                        value={config.mfaProvider ?? 'totp'}
                        onValueChange={(value: 'totp' | 'sms' | 'email') => updateConfig({ mfaProvider: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="totp">TOTP</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Connection Edit Dialog */}
        <Dialog open={editingConnection !== null} onOpenChange={(open) => !open && setEditingConnection(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingConnection?.id && connections.find(c => c.id === editingConnection.id) ? 'Edit Connection' : 'Add Connection'}</DialogTitle>
              <DialogDescription>
                Configure VPN connection settings
              </DialogDescription>
            </DialogHeader>
            {editingConnection && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Username *</Label>
                  <Input
                    value={editingConnection.username}
                    onChange={(e) => setEditingConnection({ ...editingConnection, username: e.target.value })}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Remote IP *</Label>
                  <Input
                    value={editingConnection.remoteIP}
                    onChange={(e) => setEditingConnection({ ...editingConnection, remoteIP: e.target.value })}
                    placeholder="203.0.113.10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Local IP</Label>
                  <Input
                    value={editingConnection.localIP || ''}
                    onChange={(e) => setEditingConnection({ ...editingConnection, localIP: e.target.value })}
                    placeholder="10.8.0.5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={editingConnection.status}
                      onValueChange={(value: Connection['status']) => setEditingConnection({ ...editingConnection, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="connected">Connected</SelectItem>
                        <SelectItem value="disconnected">Disconnected</SelectItem>
                        <SelectItem value="connecting">Connecting</SelectItem>
                        <SelectItem value="disconnecting">Disconnecting</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Protocol</Label>
                    <Select
                      value={editingConnection.protocol || 'openvpn'}
                      onValueChange={(value: Connection['protocol']) => setEditingConnection({ ...editingConnection, protocol: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openvpn">OpenVPN</SelectItem>
                        <SelectItem value="ipsec">IPsec</SelectItem>
                        <SelectItem value="wireguard">WireGuard</SelectItem>
                        <SelectItem value="l2tp">L2TP</SelectItem>
                        <SelectItem value="pptp">PPTP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Encryption Algorithm</Label>
                  <Select
                    value={editingConnection.encryptionAlgorithm || 'aes-256'}
                    onValueChange={(value: Connection['encryptionAlgorithm']) => setEditingConnection({ ...editingConnection, encryptionAlgorithm: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aes-256">AES-256</SelectItem>
                      <SelectItem value="aes-128">AES-128</SelectItem>
                      <SelectItem value="chacha20-poly1305">ChaCha20-Poly1305</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Compression</Label>
                  <Switch
                    checked={editingConnection.compressionEnabled ?? true}
                    onCheckedChange={(checked) => setEditingConnection({ ...editingConnection, compressionEnabled: checked })}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingConnection(null)}>Cancel</Button>
              <Button onClick={handleSaveConnection}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Tunnel Edit Dialog */}
        <Dialog open={editingTunnel !== null} onOpenChange={(open) => !open && setEditingTunnel(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTunnel?.id && tunnels.find(t => t.id === editingTunnel.id) ? 'Edit Tunnel' : 'Add Tunnel'}</DialogTitle>
              <DialogDescription>
                Configure VPN tunnel settings
              </DialogDescription>
            </DialogHeader>
            {editingTunnel && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tunnel Name *</Label>
                  <Input
                    value={editingTunnel.name}
                    onChange={(e) => setEditingTunnel({ ...editingTunnel, name: e.target.value })}
                    placeholder="HQ to Branch"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tunnel Type</Label>
                    <Select
                      value={editingTunnel.type}
                      onValueChange={(value: Tunnel['type']) => setEditingTunnel({ ...editingTunnel, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="site-to-site">Site-to-Site</SelectItem>
                        <SelectItem value="remote-access">Remote Access</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={editingTunnel.status}
                      onValueChange={(value: Tunnel['status']) => setEditingTunnel({ ...editingTunnel, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="up">Up</SelectItem>
                        <SelectItem value="down">Down</SelectItem>
                        <SelectItem value="connecting">Connecting</SelectItem>
                        <SelectItem value="disconnecting">Disconnecting</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Remote Endpoint *</Label>
                  <Input
                    value={editingTunnel.remoteEndpoint}
                    onChange={(e) => setEditingTunnel({ ...editingTunnel, remoteEndpoint: e.target.value })}
                    placeholder="192.168.100.1 or vpn.example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Local Endpoint</Label>
                  <Input
                    value={editingTunnel.localEndpoint || ''}
                    onChange={(e) => setEditingTunnel({ ...editingTunnel, localEndpoint: e.target.value })}
                    placeholder="192.168.1.1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Protocol</Label>
                  <Select
                    value={editingTunnel.protocol || 'openvpn'}
                    onValueChange={(value: Tunnel['protocol']) => setEditingTunnel({ ...editingTunnel, protocol: value })}
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
                    value={editingTunnel.encryptionAlgorithm || 'aes-256'}
                    onValueChange={(value: Tunnel['encryptionAlgorithm']) => setEditingTunnel({ ...editingTunnel, encryptionAlgorithm: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aes-256">AES-256</SelectItem>
                      <SelectItem value="aes-128">AES-128</SelectItem>
                      <SelectItem value="chacha20-poly1305">ChaCha20-Poly1305</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Compression</Label>
                  <Switch
                    checked={editingTunnel.compressionEnabled ?? true}
                    onCheckedChange={(checked) => setEditingTunnel({ ...editingTunnel, compressionEnabled: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Keep-Alive</Label>
                  <Switch
                    checked={editingTunnel.keepAliveEnabled ?? true}
                    onCheckedChange={(checked) => setEditingTunnel({ ...editingTunnel, keepAliveEnabled: checked })}
                  />
                </div>
                {editingTunnel.keepAliveEnabled && (
                  <div className="space-y-2">
                    <Label>Keep-Alive Interval (seconds)</Label>
                    <Input
                      type="number"
                      value={editingTunnel.keepAliveInterval || 30}
                      onChange={(e) => setEditingTunnel({ ...editingTunnel, keepAliveInterval: parseInt(e.target.value) || 30 })}
                      min={1}
                      max={300}
                    />
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingTunnel(null)}>Cancel</Button>
              <Button onClick={handleSaveTunnel}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Connection Confirmation */}
        <AlertDialog open={deletingConnection !== null} onOpenChange={(open) => !open && setDeletingConnection(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Connection</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete connection "{connections.find(c => c.id === deletingConnection)?.username}"? 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingConnection && handleDeleteConnection(deletingConnection)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Tunnel Confirmation */}
        <AlertDialog open={deletingTunnel !== null} onOpenChange={(open) => !open && setDeletingTunnel(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Tunnel</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete tunnel "{tunnels.find(t => t.id === deletingTunnel)?.name}"? 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingTunnel && handleDeleteTunnel(deletingTunnel)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

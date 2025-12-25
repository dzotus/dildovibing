import { useState, useEffect } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { DockerConfig } from '@/core/DockerEmulationEngine';
import { emulationEngine } from '@/core/EmulationEngine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, CheckCircle2, XCircle, Settings, Wifi, WifiOff } from 'lucide-react';

interface DockerConnectionSettingsProps {
  componentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DockerConnectionSettings({ componentId, open, onOpenChange }: DockerConnectionSettingsProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return null;

  const config = (node.data.config || {}) as DockerConfig;
  const dockerEngine = emulationEngine.getDockerEmulationEngine(componentId);

  // Connection settings state
  const [connectionType, setConnectionType] = useState<'local' | 'remote'>(
    config.dockerConnection?.type || 'local'
  );
  const [dockerUrl, setDockerUrl] = useState(
    config.dockerConnection?.url || 'unix:///var/run/docker.sock'
  );
  const [remoteHost, setRemoteHost] = useState(config.dockerConnection?.host || 'localhost');
  const [remotePort, setRemotePort] = useState(config.dockerConnection?.port || 2376);
  const [useTLS, setUseTLS] = useState(config.dockerConnection?.useTLS || false);
  const [caCert, setCaCert] = useState(config.dockerConnection?.caCert || '');
  const [clientCert, setClientCert] = useState(config.dockerConnection?.clientCert || '');
  const [clientKey, setClientKey] = useState(config.dockerConnection?.clientKey || '');

  // Sync settings state
  const [syncEnabled, setSyncEnabled] = useState(config.syncSettings?.enabled || false);
  const [syncInterval, setSyncInterval] = useState(config.syncSettings?.interval || 2000);
  const [useEvents, setUseEvents] = useState(config.syncSettings?.useEvents || false);

  // Connection status
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'disconnected' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState<string>('');

  // Check connection status on mount
  useEffect(() => {
    if (dockerEngine) {
      const isConnected = dockerEngine.isConnected();
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
    }
  }, [dockerEngine, open]);

  const handleTestConnection = async () => {
    if (!dockerEngine) {
      showError('Docker engine not initialized');
      return;
    }

    setIsTesting(true);
    setConnectionError('');

    try {
      const result = await dockerEngine.testConnection();
      if (result.success) {
        setConnectionStatus('connected');
        showSuccess('Connection test successful');
      } else {
        setConnectionStatus('error');
        setConnectionError(result.error || 'Connection failed');
        showError(result.error || 'Connection test failed');
      }
    } catch (error: any) {
      setConnectionStatus('error');
      setConnectionError(error.message || 'Connection test failed');
      showError(error.message || 'Connection test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    const dockerConnection = {
      type: connectionType,
      url: connectionType === 'local' ? dockerUrl : undefined,
      host: connectionType === 'remote' ? remoteHost : undefined,
      port: connectionType === 'remote' ? remotePort : undefined,
      useTLS: connectionType === 'remote' ? useTLS : false,
      caCert: useTLS ? caCert : undefined,
      clientCert: useTLS ? clientCert : undefined,
      clientKey: useTLS ? clientKey : undefined,
    };

    const syncSettings = {
      enabled: syncEnabled,
      interval: syncInterval,
      useEvents: useEvents,
    };

    updateNode(componentId, {
      data: {
        ...node.data,
        config: {
          ...config,
          dockerConnection,
          syncSettings,
        },
      },
    });

    // Reinitialize engine with new config
    if (dockerEngine && node) {
      const updatedNode = {
        ...node,
        data: {
          ...node.data,
          config: {
            ...config,
            dockerConnection,
            syncSettings,
          },
        },
      };
      dockerEngine.initializeConfig(updatedNode);
      if (syncEnabled && config.mode !== 'simulation') {
        await dockerEngine.connect();
      }
    }

    showSuccess('Connection settings saved');
    onOpenChange(false);
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'disconnected':
        return <WifiOff className="h-4 w-4 text-gray-500" />;
      default:
        return <Wifi className="h-4 w-4 text-gray-400" />;
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'error':
        return 'Connection Error';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Docker Connection Settings
          </DialogTitle>
          <DialogDescription>
            Configure connection to Docker daemon for real Docker mode
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              {getConnectionStatusIcon()}
              <span className="font-medium">Status: {getConnectionStatusText()}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={isTesting}
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>
          </div>

          {connectionError && (
            <Alert variant="destructive">
              <AlertDescription>{connectionError}</AlertDescription>
            </Alert>
          )}

          {/* Connection Type */}
          <div className="space-y-2">
            <Label>Connection Type</Label>
            <Select value={connectionType} onValueChange={(value: 'local' | 'remote') => setConnectionType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local Socket</SelectItem>
                <SelectItem value="remote">Remote TCP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Local Socket Settings */}
          {connectionType === 'local' && (
            <div className="space-y-2">
              <Label>Docker Socket URL</Label>
              <Input
                value={dockerUrl}
                onChange={(e) => setDockerUrl(e.target.value)}
                placeholder="unix:///var/run/docker.sock"
              />
              <p className="text-sm text-muted-foreground">
                Note: In browser environment, this requires a backend proxy to access the socket
              </p>
            </div>
          )}

          {/* Remote TCP Settings */}
          {connectionType === 'remote' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Host</Label>
                  <Input
                    value={remoteHost}
                    onChange={(e) => setRemoteHost(e.target.value)}
                    placeholder="localhost"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={remotePort}
                    onChange={(e) => setRemotePort(parseInt(e.target.value) || 2376)}
                    placeholder="2376"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="use-tls"
                  checked={useTLS}
                  onCheckedChange={setUseTLS}
                />
                <Label htmlFor="use-tls">Use TLS</Label>
              </div>

              {useTLS && (
                <div className="space-y-4 p-4 bg-muted rounded-lg">
                  <div className="space-y-2">
                    <Label>CA Certificate</Label>
                    <Textarea
                      value={caCert}
                      onChange={(e) => setCaCert(e.target.value)}
                      placeholder="Paste CA certificate"
                      className="font-mono text-xs min-h-[100px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Client Certificate</Label>
                    <Textarea
                      value={clientCert}
                      onChange={(e) => setClientCert(e.target.value)}
                      placeholder="Paste client certificate"
                      className="font-mono text-xs min-h-[100px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Client Key</Label>
                    <Textarea
                      value={clientKey}
                      onChange={(e) => setClientKey(e.target.value)}
                      placeholder="Paste client key"
                      className="font-mono text-xs min-h-[100px]"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sync Settings */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold">Synchronization Settings</h3>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="sync-enabled"
                checked={syncEnabled}
                onCheckedChange={setSyncEnabled}
              />
              <Label htmlFor="sync-enabled">Enable automatic synchronization</Label>
            </div>

            {syncEnabled && (
              <div className="space-y-4 pl-6">
                <div className="space-y-2">
                  <Label>Sync Interval (ms)</Label>
                  <Input
                    type="number"
                    value={syncInterval}
                    onChange={(e) => setSyncInterval(parseInt(e.target.value) || 2000)}
                    min={1000}
                    step={1000}
                  />
                  <p className="text-sm text-muted-foreground">
                    How often to poll Docker daemon for updates
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="use-events"
                    checked={useEvents}
                    onCheckedChange={setUseEvents}
                  />
                  <Label htmlFor="use-events">Use Docker Events API (real-time updates)</Label>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


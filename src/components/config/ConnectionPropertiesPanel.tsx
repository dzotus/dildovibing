import { CanvasConnection, ConnectionConfig } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useDataFlowStore } from '@/store/useDataFlowStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { useState, useEffect } from 'react';
import { Activity, Database, FileText, AlertCircle } from 'lucide-react';

interface ConnectionPropertiesPanelProps {
  connection: CanvasConnection;
  onUpdate: (id: string, updates: Partial<CanvasConnection>) => void;
}

export function ConnectionPropertiesPanel({ connection, onUpdate }: ConnectionPropertiesPanelProps) {
  const config = connection.data || {};
  const { isRunning } = useEmulationStore();
  const { getConnectionMessages, getMessageHistory } = useDataFlowStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [messageHistory, setMessageHistory] = useState<any[]>([]);
  
  useEffect(() => {
    if (!isRunning) {
      setMessages([]);
      setMessageHistory([]);
      return;
    }
    
    const interval = setInterval(() => {
      const connMessages = getConnectionMessages(connection.id);
      const history = getMessageHistory(50).filter(m => m.connectionId === connection.id);
      setMessages(connMessages);
      setMessageHistory(history);
    }, 200);
    
    return () => clearInterval(interval);
  }, [isRunning, connection.id, getConnectionMessages, getMessageHistory]);

  const updateConfig = (updates: Partial<ConnectionConfig>) => {
    const newData = { ...config, ...updates };
    onUpdate(connection.id, {
      data: newData,
    });
  };

  const handleLatencyChange = (value: number) => {
    updateConfig({ latencyMs: Math.max(0, value) });
  };

  const handleBandwidthChange = (value: number) => {
    updateConfig({ bandwidthMbps: Math.max(1, value) });
  };

  const handlePacketLossChange = (value: number) => {
    updateConfig({ packetLossPercent: Math.max(0, Math.min(100, value)) });
  };

  const handleJitterChange = (value: number) => {
    updateConfig({ jitterMs: Math.max(0, value) });
  };

  const handleRetryCountChange = (value: number) => {
    updateConfig({ retryCount: Math.max(0, value) });
  };

  const handleTimeoutChange = (value: number) => {
    updateConfig({ timeoutMs: Math.max(1000, value) });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <h3 className="text-xs font-semibold text-foreground">Connection</h3>
        <div className="text-[10px] text-muted-foreground space-y-0.5">
          <div>From: {connection.source}</div>
          <div>To: {connection.target}</div>
          <div>Type: {connection.type}</div>
        </div>
      </div>

      <div className="border-t border-border pt-3 space-y-3">
        {/* Network Parameters Section */}
        <div>
          <h4 className="text-[10px] font-semibold text-foreground mb-2 uppercase opacity-70">Network Parameters</h4>

          {/* Latency */}
          <div className="space-y-1.5 mb-3">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Latency (ms)</Label>
              <span className="text-[10px] font-mono text-primary">{config.latencyMs ?? 0}</span>
            </div>
            <Slider
              value={[config.latencyMs ?? 0]}
              onValueChange={(value) => handleLatencyChange(value[0])}
              min={0}
              max={5000}
              step={10}
              className="w-full"
            />
            <Input
              type="number"
              value={config.latencyMs ?? 0}
              onChange={(e) => handleLatencyChange(parseInt(e.target.value) || 0)}
              placeholder="0-5000"
              className="h-8 text-xs"
            />
          </div>

          {/* Bandwidth */}
          <div className="space-y-1.5 mb-3">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Bandwidth (Mbps)</Label>
              <span className="text-[10px] font-mono text-primary">{config.bandwidthMbps ?? 1000}</span>
            </div>
            <Slider
              value={[config.bandwidthMbps ?? 1000]}
              onValueChange={(value) => handleBandwidthChange(value[0])}
              min={1}
              max={100000}
              step={10}
              className="w-full"
            />
            <Input
              type="number"
              value={config.bandwidthMbps ?? 1000}
              onChange={(e) => handleBandwidthChange(parseInt(e.target.value) || 1000)}
              placeholder="1-100000"
              className="h-8 text-xs"
            />
          </div>

          {/* Packet Loss */}
          <div className="space-y-1.5 mb-3">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Packet Loss (%)</Label>
              <span className="text-[10px] font-mono text-primary">{config.packetLossPercent ?? 0}</span>
            </div>
            <Slider
              value={[config.packetLossPercent ?? 0]}
              onValueChange={(value) => handlePacketLossChange(value[0])}
              min={0}
              max={100}
              step={0.1}
              className="w-full"
            />
            <Input
              type="number"
              step="0.1"
              value={config.packetLossPercent ?? 0}
              onChange={(e) => handlePacketLossChange(parseFloat(e.target.value) || 0)}
              placeholder="0-100"
              className="h-8 text-xs"
            />
          </div>

          {/* Jitter */}
          <div className="space-y-1.5 mb-3">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Jitter (ms)</Label>
              <span className="text-[10px] font-mono text-primary">{config.jitterMs ?? 0}</span>
            </div>
            <Slider
              value={[config.jitterMs ?? 0]}
              onValueChange={(value) => handleJitterChange(value[0])}
              min={0}
              max={1000}
              step={5}
              className="w-full"
            />
            <Input
              type="number"
              value={config.jitterMs ?? 0}
              onChange={(e) => handleJitterChange(parseInt(e.target.value) || 0)}
              placeholder="0-1000"
              className="h-8 text-xs"
            />
          </div>
        </div>

        {/* Traffic Characteristics Section */}
        <div className="border-t border-border pt-3">
          <h4 className="text-[10px] font-semibold text-foreground mb-2 uppercase opacity-70">Traffic Characteristics</h4>

          {/* Priority Level */}
          <div className="space-y-1.5 mb-3">
            <Label className="text-xs">Priority Level</Label>
            <Select
              value={config.priorityLevel || 'medium'}
              onValueChange={(value) => updateConfig({ priorityLevel: value as any })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Retry Count */}
          <div className="space-y-1.5 mb-3">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Retry Count</Label>
              <span className="text-[10px] font-mono text-primary">{config.retryCount ?? 3}</span>
            </div>
            <Slider
              value={[config.retryCount ?? 3]}
              onValueChange={(value) => handleRetryCountChange(value[0])}
              min={0}
              max={10}
              step={1}
              className="w-full"
            />
            <Input
              type="number"
              value={config.retryCount ?? 3}
              onChange={(e) => handleRetryCountChange(parseInt(e.target.value) || 0)}
              placeholder="0-10"
              className="h-8 text-xs"
            />
          </div>

          {/* Timeout */}
          <div className="space-y-1.5 mb-3">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Timeout (ms)</Label>
              <span className="text-[10px] font-mono text-primary">{config.timeoutMs ?? 30000}</span>
            </div>
            <Slider
              value={[config.timeoutMs ?? 30000]}
              onValueChange={(value) => handleTimeoutChange(value[0])}
              min={1000}
              max={120000}
              step={1000}
              className="w-full"
            />
            <Input
              type="number"
              value={config.timeoutMs ?? 30000}
              onChange={(e) => handleTimeoutChange(parseInt(e.target.value) || 30000)}
              placeholder="1000-120000"
              className="h-8 text-xs"
            />
          </div>
        </div>

        {/* Monitoring Section */}
        <div className="border-t border-border pt-3">
          <h4 className="text-[10px] font-semibold text-foreground mb-2 uppercase opacity-70">Monitoring</h4>

          <div className="flex items-center justify-between p-2 bg-accent/20 rounded-md">
            <Label className="text-xs cursor-pointer">Enable Monitoring</Label>
            <Switch
              checked={config.enableMonitoring ?? false}
              onCheckedChange={(value) => updateConfig({ enableMonitoring: value })}
            />
          </div>
        </div>

        {/* Stats */}
        <Card className="bg-card/50 border-border/50 p-2 mt-3">
          <div className="text-[10px] space-y-0.5 text-muted-foreground">
            <div className="flex justify-between">
              <span>Effective Bandwidth:</span>
              <span className="font-mono">
                {Math.max(1, (config.bandwidthMbps ?? 1000) * (1 - (config.packetLossPercent ?? 0) / 100)).toFixed(2)} Mbps
              </span>
            </div>
            <div className="flex justify-between">
              <span>Effective Latency:</span>
              <span className="font-mono">{((config.latencyMs ?? 0) + (config.jitterMs ?? 0) / 2).toFixed(0)} ms</span>
            </div>
          </div>
        </Card>

        {/* Data Flow Section */}
        {isRunning && (
          <div className="border-t border-border pt-3 mt-3">
            <Tabs defaultValue="active" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-7">
                <TabsTrigger value="active" className="text-[10px] px-1.5">
                  <Activity className="h-3 w-3 mr-1" />
                  Active ({messages.length})
                </TabsTrigger>
                <TabsTrigger value="history" className="text-[10px] px-1.5">
                  <FileText className="h-3 w-3 mr-1" />
                  History ({messageHistory.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="mt-2 space-y-1.5">
                {messages.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-[10px]">
                    <Activity className="h-6 w-6 mx-auto mb-1.5 opacity-50" />
                    <p>No active messages</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {messages.map((msg, idx) => (
                      <Card key={msg.id || idx} className="p-1.5 border-border/50">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                {msg.format}
                              </Badge>
                              <Badge 
                                variant={
                                  msg.status === 'delivered' ? 'default' :
                                  msg.status === 'failed' ? 'destructive' :
                                  msg.status === 'transformed' ? 'secondary' :
                                  'outline'
                                }
                                className="text-[10px] px-1 py-0"
                              >
                                {msg.status}
                              </Badge>
                            </div>
                            <div className="text-[10px] text-muted-foreground space-y-0.5">
                              <div>Size: {(msg.size / 1024).toFixed(2)} KB</div>
                              {msg.latency && (
                                <div>Latency: {msg.latency.toFixed(0)} ms</div>
                              )}
                            </div>
                            {msg.error && (
                              <div className="text-xs text-destructive mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {msg.error}
                              </div>
                            )}
                          </div>
                        </div>
                        {msg.payload && (
                          <details className="mt-2">
                            <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                              Show Data
                            </summary>
                            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto max-h-32 overflow-y-auto">
                              {JSON.stringify(msg.payload, null, 2)}
                            </pre>
                          </details>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-2 space-y-1.5">
                {messageHistory.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-[10px]">
                    <FileText className="h-6 w-6 mx-auto mb-1.5 opacity-50" />
                    <p>History is empty</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {messageHistory.map((msg, idx) => (
                      <Card key={msg.id || idx} className="p-1.5 border-border/50">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {msg.format}
                              </Badge>
                              <Badge 
                                variant={
                                  msg.status === 'delivered' ? 'default' :
                                  msg.status === 'failed' ? 'destructive' :
                                  'outline'
                                }
                                className="text-xs"
                              >
                                {msg.status}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(msg.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground space-y-0.5">
                              <div>Size: {(msg.size / 1024).toFixed(2)} KB</div>
                              {msg.latency && (
                                <div>Latency: {msg.latency.toFixed(0)} ms</div>
                              )}
                            </div>
                            {msg.error && (
                              <div className="text-xs text-destructive mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {msg.error}
                              </div>
                            )}
                          </div>
                        </div>
                        {msg.payload && (
                          <details className="mt-2">
                            <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                              Show Data
                            </summary>
                            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto max-h-32 overflow-y-auto">
                              {JSON.stringify(msg.payload, null, 2)}
                            </pre>
                          </details>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}

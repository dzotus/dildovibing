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
import { Heading, Text, PanelTitle } from '@/components/ui/typography';

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

  // Protocol handling
  const currentProtocol = connection.type || config.protocol || 'http';
  const protocolConfig = config.protocolConfig || {};

  const handleProtocolChange = (protocol: string) => {
    // Update both connection.type and config.protocol
    const updates: Partial<CanvasConnection> = {
      type: protocol as any,
      data: {
        ...config,
        protocol: protocol as any,
      },
    };
    onUpdate(connection.id, updates);
  };

  const handleProtocolConfigChange = (updates: Partial<typeof protocolConfig>) => {
    updateConfig({
      protocolConfig: {
        ...protocolConfig,
        ...updates,
      },
    });
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <PanelTitle>Connection</PanelTitle>
        <div className="space-y-0.5">
          <Text size="micro" muted>From: {connection.source}</Text>
          <Text size="micro" muted>To: {connection.target}</Text>
          <Text size="micro" muted>Type: {connection.type}</Text>
        </div>
      </div>

      <div className="border-t border-border pt-2 space-y-2">
        {/* Network Parameters Section */}
        <div>
          <Heading level={5} className="mb-1.5 opacity-70">Network Parameters</Heading>

          {/* Latency */}
          <div className="space-y-1 mb-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Latency (ms)</Label>
              <Text mono size="micro" className="text-primary">{config.latencyMs ?? 0}</Text>
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
              className="h-7 text-xs"
            />
          </div>

          {/* Bandwidth */}
          <div className="space-y-1 mb-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Bandwidth (Mbps)</Label>
              <Text mono size="micro" className="text-primary">{config.bandwidthMbps ?? 1000}</Text>
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
              className="h-7 text-xs"
            />
          </div>

          {/* Packet Loss */}
          <div className="space-y-1 mb-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Packet Loss (%)</Label>
              <Text mono size="micro" className="text-primary">{config.packetLossPercent ?? 0}</Text>
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
              className="h-7 text-xs"
            />
          </div>

          {/* Jitter */}
          <div className="space-y-1 mb-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Jitter (ms)</Label>
              <Text mono size="micro" className="text-primary">{config.jitterMs ?? 0}</Text>
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
              className="h-7 text-xs"
            />
          </div>
        </div>

        {/* Protocol Section */}
        <div className="border-t border-border pt-2">
          <Heading level={5} className="mb-1.5 opacity-70">Protocol</Heading>

          {/* Protocol Selection */}
          <div className="space-y-1 mb-2">
            <Label className="text-xs">Protocol</Label>
            <Select
              value={currentProtocol}
              onValueChange={handleProtocolChange}
            >
              <SelectTrigger className="h-7 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rest">REST</SelectItem>
                <SelectItem value="graphql">GraphQL</SelectItem>
                <SelectItem value="soap">SOAP</SelectItem>
                <SelectItem value="grpc">gRPC</SelectItem>
                <SelectItem value="websocket">WebSocket</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="http">HTTP (legacy)</SelectItem>
                <SelectItem value="sync">Sync</SelectItem>
                <SelectItem value="async">Async</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Protocol-specific settings */}
          {currentProtocol === 'rest' && (
            <div className="space-y-2 mt-2">
              <div className="space-y-1">
                <Label className="text-xs">HTTP Method</Label>
                <Select
                  value={protocolConfig.httpMethod || 'POST'}
                  onValueChange={(value) => handleProtocolConfigChange({ httpMethod: value as any })}
                >
                  <SelectTrigger className="h-7 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Content Type</Label>
                <Select
                  value={protocolConfig.contentType || 'json'}
                  onValueChange={(value) => handleProtocolConfigChange({ contentType: value as any })}
                >
                  <SelectTrigger className="h-7 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="xml">XML</SelectItem>
                    <SelectItem value="form-data">Form Data</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {currentProtocol === 'graphql' && (
            <div className="space-y-2 mt-2">
              <div className="space-y-1">
                <Label className="text-xs">Operation Name</Label>
                <Input
                  value={protocolConfig.operationName || ''}
                  onChange={(e) => handleProtocolConfigChange({ operationName: e.target.value })}
                  placeholder="query/mutation name"
                  className="h-7 text-xs"
                />
              </div>
            </div>
          )}

          {currentProtocol === 'soap' && (
            <div className="space-y-2 mt-2">
              <div className="space-y-1">
                <Label className="text-xs">SOAP Action</Label>
                <Input
                  value={protocolConfig.soapAction || ''}
                  onChange={(e) => handleProtocolConfigChange({ soapAction: e.target.value })}
                  placeholder="SOAP action URI"
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">WSDL URL</Label>
                <Input
                  value={protocolConfig.wsdlUrl || ''}
                  onChange={(e) => handleProtocolConfigChange({ wsdlUrl: e.target.value })}
                  placeholder="http://example.com/service.wsdl"
                  className="h-7 text-xs"
                />
              </div>
            </div>
          )}

          {currentProtocol === 'grpc' && (
            <div className="space-y-2 mt-2">
              <div className="space-y-1">
                <Label className="text-xs">Service Name</Label>
                <Input
                  value={protocolConfig.serviceName || ''}
                  onChange={(e) => handleProtocolConfigChange({ serviceName: e.target.value })}
                  placeholder="com.example.Service"
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Method Name</Label>
                <Input
                  value={protocolConfig.methodName || ''}
                  onChange={(e) => handleProtocolConfigChange({ methodName: e.target.value })}
                  placeholder="GetUser"
                  className="h-7 text-xs"
                />
              </div>
            </div>
          )}

          {currentProtocol === 'websocket' && (
            <div className="space-y-2 mt-2">
              <div className="space-y-1">
                <Label className="text-xs">Subprotocol</Label>
                <Input
                  value={protocolConfig.wsProtocol || ''}
                  onChange={(e) => handleProtocolConfigChange({ wsProtocol: e.target.value })}
                  placeholder="chat, echo, etc."
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Binary Type</Label>
                <Select
                  value={protocolConfig.binaryType || 'blob'}
                  onValueChange={(value) => handleProtocolConfigChange({ binaryType: value as any })}
                >
                  <SelectTrigger className="h-7 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blob">Blob</SelectItem>
                    <SelectItem value="arraybuffer">ArrayBuffer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {currentProtocol === 'webhook' && (
            <div className="space-y-2 mt-2">
              <div className="space-y-1">
                <Label className="text-xs">Event Type</Label>
                <Input
                  value={protocolConfig.webhookEvent || ''}
                  onChange={(e) => handleProtocolConfigChange({ webhookEvent: e.target.value })}
                  placeholder="push, pull_request, etc."
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Signature Header</Label>
                <Input
                  value={protocolConfig.signatureHeader || 'X-Signature'}
                  onChange={(e) => handleProtocolConfigChange({ signatureHeader: e.target.value })}
                  placeholder="X-Signature"
                  className="h-7 text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Traffic Characteristics Section */}
        <div className="border-t border-border pt-2">
          <h4 className="text-[9px] font-semibold text-foreground mb-1.5 uppercase opacity-70">Traffic Characteristics</h4>

          {/* Priority Level */}
          <div className="space-y-1 mb-2">
            <Label className="text-xs">Priority Level</Label>
            <Select
              value={config.priorityLevel || 'medium'}
              onValueChange={(value) => updateConfig({ priorityLevel: value as any })}
            >
              <SelectTrigger className="h-7 text-[11px]">
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
          <div className="space-y-1 mb-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Retry Count</Label>
              <Text mono size="micro" className="text-primary">{config.retryCount ?? 3}</Text>
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
              className="h-7 text-xs"
            />
          </div>

          {/* Timeout */}
          <div className="space-y-1 mb-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Timeout (ms)</Label>
              <Text mono size="micro" className="text-primary">{config.timeoutMs ?? 30000}</Text>
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
              className="h-7 text-xs"
            />
          </div>
        </div>

        {/* Monitoring Section */}
        <div className="border-t border-border pt-2">
          <Heading level={5} className="mb-1.5 opacity-70">Monitoring</Heading>

          <div className="flex items-center justify-between p-1.5 bg-accent/20 rounded-md">
            <Label className="text-xs cursor-pointer">Enable Monitoring</Label>
            <Switch
              checked={config.enableMonitoring ?? false}
              onCheckedChange={(value) => updateConfig({ enableMonitoring: value })}
            />
          </div>
        </div>

        {/* Stats */}
        <Card className="bg-card/50 border-border/50 p-1.5 mt-2">
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <Text size="micro" muted>Effective Bandwidth:</Text>
              <Text mono size="micro">
                {Math.max(1, (config.bandwidthMbps ?? 1000) * (1 - (config.packetLossPercent ?? 0) / 100)).toFixed(2)} Mbps
              </Text>
            </div>
            <div className="flex justify-between">
              <Text size="micro" muted>Effective Latency:</Text>
              <Text mono size="micro">{((config.latencyMs ?? 0) + (config.jitterMs ?? 0) / 2).toFixed(0)} ms</Text>
            </div>
          </div>
        </Card>

        {/* Data Flow Section */}
        {isRunning && (
          <div className="border-t border-border pt-2 mt-2">
            <Tabs defaultValue="active" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-7">
                <TabsTrigger value="active" className="text-xs px-2">
                  <Activity className="h-3 w-3 mr-1" />
                  Active ({messages.length})
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs px-2">
                  <FileText className="h-3 w-3 mr-1" />
                  History ({messageHistory.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="mt-1.5 space-y-1">
                {messages.length === 0 ? (
                  <div className="text-center py-3">
                    <Activity className="h-5 w-5 mx-auto mb-1 opacity-50" />
                    <Text size="micro" muted>No active messages</Text>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {messages.map((msg, idx) => (
                      <Card key={msg.id || idx} className="p-1 border-border/50">
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 mb-0.5">
                              <Badge variant="outline" className="text-xs px-0.5 py-0">
                                {msg.format}
                              </Badge>
                              <Badge 
                                variant={
                                  msg.status === 'delivered' ? 'default' :
                                  msg.status === 'failed' ? 'destructive' :
                                  msg.status === 'transformed' ? 'secondary' :
                                  'outline'
                                }
                                className="text-xs px-0.5 py-0"
                              >
                                {msg.status}
                              </Badge>
                            </div>
                            <div className="text-[9px] text-muted-foreground space-y-0.5">
                              <div>Size: {(msg.size / 1024).toFixed(2)} KB</div>
                              {msg.latency && (
                                <div>Latency: {msg.latency.toFixed(0)} ms</div>
                              )}
                            </div>
                            {msg.error && (
                              <div className="text-[10px] text-destructive mt-0.5 flex items-center gap-0.5">
                                <AlertCircle className="h-2.5 w-2.5" />
                                {msg.error}
                              </div>
                            )}
                          </div>
                        </div>
                        {msg.payload && (
                          <details className="mt-1">
                            <summary className="text-[9px] cursor-pointer text-muted-foreground hover:text-foreground">
                              Show Data
                            </summary>
                            <pre className="mt-1 p-1 bg-muted rounded text-[9px] overflow-x-auto max-h-32 overflow-y-auto">
                              {JSON.stringify(msg.payload, null, 2)}
                            </pre>
                          </details>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-1.5 space-y-1">
                {messageHistory.length === 0 ? (
                  <div className="text-center py-3">
                    <FileText className="h-5 w-5 mx-auto mb-1 opacity-50" />
                    <Text size="micro" muted>History is empty</Text>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {messageHistory.map((msg, idx) => (
                      <Card key={msg.id || idx} className="p-1 border-border/50">
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 mb-0.5">
                              <Badge variant="outline" className="text-xs px-0.5 py-0">
                                {msg.format}
                              </Badge>
                              <Badge 
                                variant={
                                  msg.status === 'delivered' ? 'default' :
                                  msg.status === 'failed' ? 'destructive' :
                                  'outline'
                                }
                                className="text-xs px-0.5 py-0"
                              >
                                {msg.status}
                              </Badge>
                              <span className="text-[9px] text-muted-foreground">
                                {new Date(msg.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="text-[9px] text-muted-foreground space-y-0.5">
                              <div>Size: {(msg.size / 1024).toFixed(2)} KB</div>
                              {msg.latency && (
                                <div>Latency: {msg.latency.toFixed(0)} ms</div>
                              )}
                            </div>
                            {msg.error && (
                              <div className="text-[10px] text-destructive mt-0.5 flex items-center gap-0.5">
                                <AlertCircle className="h-2.5 w-2.5" />
                                {msg.error}
                              </div>
                            )}
                          </div>
                        </div>
                        {msg.payload && (
                          <details className="mt-1">
                            <summary className="text-[9px] cursor-pointer text-muted-foreground hover:text-foreground">
                              Show Data
                            </summary>
                            <pre className="mt-1 p-1 bg-muted rounded text-[9px] overflow-x-auto max-h-32 overflow-y-auto">
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

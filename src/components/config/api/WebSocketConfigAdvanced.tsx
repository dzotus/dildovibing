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
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Send,
  Code,
  CheckCircle,
  XCircle,
  Zap,
  Network,
  Users,
  MessageSquare
} from 'lucide-react';

interface WebSocketConfigProps {
  componentId: string;
}

interface Connection {
  id: string;
  status: 'connected' | 'disconnected' | 'connecting';
  connectedAt?: string;
  messagesSent?: number;
  messagesReceived?: number;
  lastMessage?: string;
}

interface Message {
  id: string;
  type: 'sent' | 'received';
  content: string;
  timestamp: string;
}

interface WebSocketConfig {
  connections?: Connection[];
  messages?: Message[];
  endpoint?: string;
  protocol?: string;
  totalConnections?: number;
  activeConnections?: number;
  totalMessages?: number;
}

export function WebSocketConfigAdvanced({ componentId }: WebSocketConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as WebSocketConfig;
  const connections = config.connections || [];
  const messages = config.messages || [];
  const endpoint = config.endpoint || 'ws://localhost:8080/ws';
  const protocol = config.protocol || 'ws';
  const totalConnections = config.totalConnections || connections.length;
  const activeConnections = config.activeConnections || connections.filter((c) => c.status === 'connected').length;
  const totalMessages = config.totalMessages || messages.length;

  const [messageText, setMessageText] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  const updateConfig = (updates: Partial<WebSocketConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const sendMessage = () => {
    if (!messageText.trim()) return;
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      type: 'sent',
      content: messageText,
      timestamp: new Date().toISOString(),
    };
    updateConfig({ messages: [...messages, newMessage] });
    setMessageText('');
  };

  const toggleConnection = () => {
    setIsConnected(!isConnected);
    if (!isConnected) {
      const newConnection: Connection = {
        id: `conn-${Date.now()}`,
        status: 'connected',
        connectedAt: new Date().toISOString(),
        messagesSent: 0,
        messagesReceived: 0,
      };
      updateConfig({ connections: [...connections, newConnection] });
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">WebSocket</p>
            <h2 className="text-2xl font-bold text-foreground">WebSocket Server</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time bidirectional communication
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Connections</CardTitle>
                <Network className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{activeConnections}</span>
                <span className="text-xs text-muted-foreground">/ {totalConnections} total</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Messages</CardTitle>
                <MessageSquare className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalMessages}</span>
                <span className="text-xs text-muted-foreground">exchanged</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Sent</CardTitle>
                <Send className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {connections.reduce((sum, c) => sum + (c.messagesSent || 0), 0)}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Received</CardTitle>
                <MessageSquare className="h-4 w-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">
                  {connections.reduce((sum, c) => sum + (c.messagesReceived || 0), 0)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="client" className="space-y-4">
          <TabsList>
            <TabsTrigger value="client">
              <Send className="h-4 w-4 mr-2" />
              Test Client
            </TabsTrigger>
            <TabsTrigger value="connections">
              <Network className="h-4 w-4 mr-2" />
              Connections ({connections.length})
            </TabsTrigger>
            <TabsTrigger value="messages">
              <MessageSquare className="h-4 w-4 mr-2" />
              Messages ({messages.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="client" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>WebSocket Test Client</CardTitle>
                <CardDescription>Connect and send messages</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Endpoint</Label>
                  <Input
                    value={endpoint}
                    onChange={(e) => updateConfig({ endpoint: e.target.value })}
                    placeholder="ws://localhost:8080/ws"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={toggleConnection}
                    variant={isConnected ? 'destructive' : 'default'}
                  >
                    {isConnected ? 'Disconnect' : 'Connect'}
                  </Button>
                  <Badge variant={isConnected ? 'default' : 'outline'}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Send Message</Label>
                  <Textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="font-mono text-sm min-h-[100px]"
                    placeholder='{ "type": "message", "data": "Hello" }'
                    disabled={!isConnected}
                  />
                </div>
                <Button onClick={sendMessage} disabled={!isConnected || !messageText.trim()}>
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="connections" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Connections</CardTitle>
                <CardDescription>WebSocket client connections</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {connections.map((conn) => (
                    <Card key={conn.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${
                              conn.status === 'connected' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-900/30'
                            }`}>
                              {conn.status === 'connected' ? (
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                              ) : (
                                <XCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                              )}
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{conn.id}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant={conn.status === 'connected' ? 'default' : 'outline'}>
                                  {conn.status}
                                </Badge>
                                {conn.connectedAt && (
                                  <Badge variant="outline">
                                    Connected {new Date(conn.connectedAt).toLocaleString()}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Sent:</span>
                            <span className="ml-2 font-semibold">{conn.messagesSent || 0}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Received:</span>
                            <span className="ml-2 font-semibold">{conn.messagesReceived || 0}</span>
                          </div>
                          {conn.lastMessage && (
                            <div>
                              <span className="text-muted-foreground">Last:</span>
                              <span className="ml-2 font-semibold truncate">{conn.lastMessage}</span>
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

          <TabsContent value="messages" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Message History</CardTitle>
                <CardDescription>Sent and received messages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <Card key={msg.id} className={`border-l-4 ${
                      msg.type === 'sent' ? 'border-l-green-500 bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/10' :
                      'border-l-blue-500 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10'
                    } hover:shadow-md transition-shadow`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${
                              msg.type === 'sent' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                            }`}>
                              {msg.type === 'sent' ? (
                                <Send className="h-5 w-5 text-green-600 dark:text-green-400" />
                              ) : (
                                <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              )}
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold capitalize">{msg.type}</CardTitle>
                              <Badge variant="outline" className="mt-2">
                                {new Date(msg.timestamp).toLocaleString()}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <pre className="p-3 bg-muted rounded text-xs font-mono overflow-x-auto">{msg.content}</pre>
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
                <CardTitle>WebSocket Settings</CardTitle>
                <CardDescription>Server configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Endpoint URL</Label>
                  <Input
                    value={endpoint}
                    onChange={(e) => updateConfig({ endpoint: e.target.value })}
                    placeholder="ws://localhost:8080/ws"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Protocol</Label>
                  <Select value={protocol} onValueChange={(value) => updateConfig({ protocol: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ws">WS (WebSocket)</SelectItem>
                      <SelectItem value="wss">WSS (Secure WebSocket)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Enable Compression</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Ping/Pong</Label>
                  <Switch defaultChecked />
                </div>
                <div className="space-y-2">
                  <Label>Ping Interval (seconds)</Label>
                  <Input type="number" defaultValue={30} min={1} />
                </div>
                <div className="space-y-2">
                  <Label>Max Connections</Label>
                  <Input type="number" defaultValue={1000} min={1} />
                </div>
                <div className="space-y-2">
                  <Label>Max Message Size (KB)</Label>
                  <Input type="number" defaultValue={1024} min={1} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


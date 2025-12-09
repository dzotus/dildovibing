import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
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
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';
import { 
  MessageSquare, 
  Database, 
  Activity, 
  Settings, 
  Plus, 
  Trash2,
  Users,
  TrendingUp,
  ArrowRightLeft,
  Shield,
  Key,
  Network,
  Play,
  Pause,
  RefreshCcw
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, CheckCircle2, ArrowRight, Link2 } from 'lucide-react';

interface ActiveMQConfigProps {
  componentId: string;
}

interface Queue {
  name: string;
  queueSize?: number;
  consumerCount?: number;
  enqueueCount?: number;
  dequeueCount?: number;
  memoryUsage?: number;
  memoryPercent?: number;
}

interface Topic {
  name: string;
  subscriberCount?: number;
  enqueueCount?: number;
  dequeueCount?: number;
  memoryUsage?: number;
  memoryPercent?: number;
}

interface Connection {
  id: string;
  remoteAddress?: string;
  clientId?: string;
  userName?: string;
  connectedSince?: string;
  messageCount?: number;
  protocol?: 'OpenWire' | 'AMQP' | 'MQTT' | 'STOMP' | 'WebSocket';
}

interface Subscription {
  id: string;
  destination: string;
  clientId: string;
  selector?: string;
  pendingQueueSize?: number;
  dispatchedQueueSize?: number;
  dispatchedCounter?: number;
  enqueueCounter?: number;
  dequeueCounter?: number;
}

interface ActiveMQConfig {
  brokerName?: string;
  brokerUrl?: string;
  protocol?: 'amqp' | 'openwire' | 'mqtt' | 'stomp' | 'ws';
  port?: number;
  username?: string;
  password?: string;
  queues?: Queue[];
  topics?: Topic[];
  connections?: Connection[];
  subscriptions?: Subscription[];
  persistenceEnabled?: boolean;
  maxConnections?: number;
  memoryLimit?: number;
  storeUsage?: number;
  tempUsage?: number;
  acls?: Array<{
    principal: string;
    resource: string;
    operation: string;
    permission: 'allow' | 'deny';
  }>;
}

export function ActiveMQConfigAdvanced({ componentId }: ActiveMQConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { isRunning, start, stop, updateMetrics } = useEmulationStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as ActiveMQConfig;
  const brokerName = config.brokerName || 'localhost';
  const brokerUrl = config.brokerUrl || 'tcp://localhost:61616';
  const protocol = config.protocol || 'openwire';
  const port = config.port || 61616;
  const username = config.username || 'admin';
  const password = config.password || 'admin';
  const queues = config.queues || [];
  const topics = config.topics || [];
  // Connections and subscriptions are runtime data - they are created automatically
  // when other components connect to this broker during simulation
  const connections = config.connections || []; // Created dynamically from canvas connections
  const subscriptions = config.subscriptions || []; // Created dynamically when clients subscribe to topics
  const persistenceEnabled = config.persistenceEnabled ?? true;
  const maxConnections = config.maxConnections || 1000;
  const memoryLimit = config.memoryLimit || 1024;
  const storeUsage = config.storeUsage || 0;
  const tempUsage = config.tempUsage || 0;
  const acls = config.acls || [];

  const [showCreateAcl, setShowCreateAcl] = useState(false);
  const [aclForm, setAclForm] = useState({
    principal: '',
    resource: '',
    operation: 'read' as 'read' | 'write' | 'admin' | 'create',
    permission: 'allow' as 'allow' | 'deny',
  });

  const updateConfig = (updates: Partial<ActiveMQConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addQueue = () => {
    const queueName = `queue-${Date.now()}`;
    updateConfig({
      queues: [
        ...queues,
        { name: queueName, queueSize: 0, consumerCount: 0, enqueueCount: 0, dequeueCount: 0, memoryUsage: 0, memoryPercent: 0 },
      ],
    });
  };

  const removeQueue = (index: number) => {
    updateConfig({ queues: queues.filter((_, i) => i !== index) });
  };

  // Queues can only be added/removed, not edited
  // Name editing is not allowed - queues are identified by name

  const addTopic = () => {
    const topicName = `topic-${Date.now()}`;
    updateConfig({
      topics: [
        ...topics,
        { name: topicName, subscriberCount: 0, enqueueCount: 0, dequeueCount: 0, memoryUsage: 0, memoryPercent: 0 },
      ],
    });
  };

  const removeTopic = (index: number) => {
    updateConfig({ topics: topics.filter((_, i) => i !== index) });
  };

  // Topics can only be added/removed, not edited
  // Name editing is not allowed - topics are identified by name

  // Connections and subscriptions are created dynamically by clients at runtime
  // They cannot be manually added/removed through the UI

  const addAcl = () => {
    if (!aclForm.principal || !aclForm.resource) {
      return; // Don't add if required fields are empty
    }
    const newAcl = {
      principal: aclForm.principal,
      resource: aclForm.resource,
      operation: aclForm.operation,
      permission: aclForm.permission,
    };
    updateConfig({ acls: [...acls, newAcl] });
    setShowCreateAcl(false);
    // Reset form
    setAclForm({
      principal: '',
      resource: '',
      operation: 'read',
      permission: 'allow',
    });
  };

  const removeAcl = (index: number) => {
    updateConfig({ acls: acls.filter((_, i) => i !== index) });
  };

  const totalMessages = queues.reduce((sum, q) => sum + (q.queueSize || 0), 0);
  const totalConsumers = queues.reduce((sum, q) => sum + (q.consumerCount || 0), 0);
  const totalSubscribers = topics.reduce((sum, t) => sum + (t.subscriberCount || 0), 0);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">ActiveMQ Broker</p>
            <h2 className="text-2xl font-bold text-foreground">Broker Management</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure ActiveMQ broker, queues, topics, connections and security
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => updateMetrics()}
              title="Manually refresh broker metrics (metrics update automatically during simulation)"
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh Metrics
            </Button>
          </div>
        </div>

        <Separator />

        {/* Setup Instructions */}
        {queues.length === 0 && topics.length === 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Getting Started</AlertTitle>
            <AlertDescription className="space-y-2 mt-2">
              <p>To start using ActiveMQ broker, follow these steps:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Configure at least one <strong>Queue</strong> or <strong>Topic</strong> in the tabs below</li>
                <li>Connect other components (producers/consumers) to this broker</li>
                <li>Start the simulation from the Emulation Panel to see metrics</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Note:</strong> Queues and Topics are configuration - they define what destinations are available. 
                Connections and Subscriptions are created automatically by clients at runtime.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Overview Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Broker Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${isRunning ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                <span className="text-lg font-semibold">{isRunning ? 'Running' : 'Stopped'}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{brokerName}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{totalMessages.toLocaleString()}</span>
              <p className="text-xs text-muted-foreground mt-1">Across all queues</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{connections.length}</span>
              <p className="text-xs text-muted-foreground mt-1">Connected clients</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Store: {storeUsage} MB</span>
                  <span>Temp: {tempUsage} MB</span>
                </div>
                <Progress value={(storeUsage + tempUsage) / memoryLimit * 100} className="h-2" />
                <p className="text-xs text-muted-foreground">Limit: {memoryLimit} MB</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="broker" className="space-y-4">
          <TabsList>
            <TabsTrigger value="broker">
              <Settings className="h-4 w-4 mr-2" />
              Broker
            </TabsTrigger>
            <TabsTrigger value="queues">
              <MessageSquare className="h-4 w-4 mr-2" />
              Queues ({queues.length})
            </TabsTrigger>
            <TabsTrigger value="topics">
              <Database className="h-4 w-4 mr-2" />
              Topics ({topics.length})
            </TabsTrigger>
            <TabsTrigger value="connections">
              <Network className="h-4 w-4 mr-2" />
              Connections ({connections.length})
            </TabsTrigger>
            <TabsTrigger value="subscriptions">
              <Users className="h-4 w-4 mr-2" />
              Subscriptions ({subscriptions.length})
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Broker Configuration */}
          <TabsContent value="broker" className="space-y-4">
            <Alert className="mb-4">
              <Info className="h-4 w-4" />
              <AlertTitle>Broker Configuration</AlertTitle>
              <AlertDescription className="text-sm">
                Configure connection settings, protocols, and broker limits. These settings affect how clients connect to the broker and how messages are processed.
              </AlertDescription>
            </Alert>
            <Card>
              <CardHeader>
                <CardTitle>Broker Configuration</CardTitle>
                <CardDescription>Basic broker settings and connection parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="brokerName">Broker Name</Label>
                    <Input
                      id="brokerName"
                      value={brokerName}
                      onChange={(e) => updateConfig({ brokerName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brokerUrl">Broker URL</Label>
                    <Input
                      id="brokerUrl"
                      value={brokerUrl}
                      onChange={(e) => updateConfig({ brokerUrl: e.target.value })}
                      placeholder="tcp://localhost:61616"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="protocol">Protocol</Label>
                    <Select value={protocol} onValueChange={(value: any) => updateConfig({ protocol: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openwire">OpenWire</SelectItem>
                        <SelectItem value="amqp">AMQP</SelectItem>
                        <SelectItem value="mqtt">MQTT</SelectItem>
                        <SelectItem value="stomp">STOMP</SelectItem>
                        <SelectItem value="ws">WebSocket</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="number"
                      value={port}
                      onChange={(e) => updateConfig({ port: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => updateConfig({ username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => updateConfig({ password: e.target.value })}
                    />
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="persistenceEnabled">Persistence Enabled</Label>
                      <p className="text-xs text-muted-foreground">Persist messages to disk</p>
                    </div>
                    <Switch
                      id="persistenceEnabled"
                      checked={persistenceEnabled}
                      onCheckedChange={(checked) => updateConfig({ persistenceEnabled: checked })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxConnections">Max Connections</Label>
                      <Input
                        id="maxConnections"
                        type="number"
                        value={maxConnections}
                        onChange={(e) => updateConfig({ maxConnections: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="memoryLimit">Memory Limit (MB)</Label>
                      <Input
                        id="memoryLimit"
                        type="number"
                        value={memoryLimit}
                        onChange={(e) => updateConfig({ memoryLimit: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Queues */}
          <TabsContent value="queues" className="space-y-4">
            <Alert className="mb-4">
              <Info className="h-4 w-4" />
              <AlertTitle>Queue Configuration</AlertTitle>
              <AlertDescription className="text-sm space-y-1">
                <p>Configure queues for point-to-point messaging. Each queue represents a destination where producers send messages and consumers receive them.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>Tip:</strong> To send messages to a queue, connect a producer component and specify the queue name in the connection settings.
                </p>
              </AlertDescription>
            </Alert>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Queues</CardTitle>
                    <CardDescription>Configure message queues (queues are created dynamically by clients at runtime)</CardDescription>
                  </div>
                  <Button onClick={addQueue} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Queue Config
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {queues.map((queue, index) => (
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-blue-500" />
                            <CardTitle className="text-base">
                              {queue.name}
                            </CardTitle>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeQueue(index)}
                            disabled={queues.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Queue Size</p>
                            <p className="text-lg font-semibold">{queue.queueSize || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Consumers</p>
                            <p className="text-lg font-semibold">{queue.consumerCount || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Enqueued</p>
                            <p className="text-lg font-semibold">{(queue.enqueueCount || 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Dequeued</p>
                            <p className="text-lg font-semibold">{(queue.dequeueCount || 0).toLocaleString()}</p>
                          </div>
                        </div>
                        {queue.memoryUsage !== undefined && (
                          <div className="mt-4">
                            <div className="flex justify-between text-xs mb-1">
                              <span>Memory Usage</span>
                              <span>{queue.memoryUsage} MB ({queue.memoryPercent || 0}%)</span>
                            </div>
                            <Progress value={queue.memoryPercent || 0} className="h-2" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Topics */}
          <TabsContent value="topics" className="space-y-4">
            <Alert className="mb-4">
              <Info className="h-4 w-4" />
              <AlertTitle>Topic Configuration</AlertTitle>
              <AlertDescription className="text-sm space-y-1">
                <p>Configure topics for publish-subscribe messaging. Publishers send messages to topics, and all subscribers receive copies of the messages.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>Tip:</strong> To publish messages, connect a producer component and specify the topic name. Multiple consumers can subscribe to the same topic.
                </p>
              </AlertDescription>
            </Alert>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Topics</CardTitle>
                    <CardDescription>Configure publish-subscribe topics (topics are created dynamically by clients at runtime)</CardDescription>
                  </div>
                  <Button onClick={addTopic} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Topic Config
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topics.map((topic, index) => (
                    <Card key={index} className="border-l-4 border-l-green-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Database className="h-5 w-5 text-green-500" />
                            <CardTitle className="text-base">
                              {topic.name}
                            </CardTitle>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTopic(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Subscribers</p>
                            <p className="text-lg font-semibold">{topic.subscriberCount || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Enqueued</p>
                            <p className="text-lg font-semibold">{(topic.enqueueCount || 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Dequeued</p>
                            <p className="text-lg font-semibold">{(topic.dequeueCount || 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Memory</p>
                            <p className="text-lg font-semibold">{topic.memoryUsage || 0} MB</p>
                          </div>
                        </div>
                        {topic.memoryPercent !== undefined && (
                          <div className="mt-4">
                            <div className="flex justify-between text-xs mb-1">
                              <span>Memory Usage</span>
                              <span>{topic.memoryPercent}%</span>
                            </div>
                            <Progress value={topic.memoryPercent} className="h-2" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Connections */}
          <TabsContent value="connections" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Connections</CardTitle>
                    <CardDescription>Active client connections to the broker (read-only, connections are created by clients)</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {connections.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No active connections</p>
                ) : (
                  <div className="space-y-2">
                    {connections.map((conn) => (
                      <Card key={conn.id} className="border-l-4 border-l-purple-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 grid grid-cols-4 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Client ID</p>
                                <p className="text-sm font-medium">{conn.clientId}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">User</p>
                                <p className="text-sm font-medium">{conn.userName || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Protocol</p>
                                <Badge variant="outline">{conn.protocol || 'OpenWire'}</Badge>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Messages</p>
                                <p className="text-sm font-medium">{conn.messageCount || 0}</p>
                              </div>
                            </div>
                          </div>
                          {conn.remoteAddress && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Remote: {conn.remoteAddress}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscriptions */}
          <TabsContent value="subscriptions" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Subscriptions</CardTitle>
                    <CardDescription>Active topic subscriptions (read-only, subscriptions are created by clients)</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {subscriptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No active subscriptions</p>
                ) : (
                  <div className="space-y-2">
                    {subscriptions.map((sub) => (
                      <Card key={sub.id} className="border-l-4 border-l-orange-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 grid grid-cols-4 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Destination</p>
                                <p className="text-sm font-medium">{sub.destination}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Client ID</p>
                                <p className="text-sm font-medium">{sub.clientId}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Pending</p>
                                <p className="text-sm font-medium">{sub.pendingQueueSize || 0}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Dispatched</p>
                                <p className="text-sm font-medium">{sub.dispatchedQueueSize || 0}</p>
                              </div>
                            </div>
                          </div>
                          {sub.selector && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Selector: {sub.selector}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security */}
          <TabsContent value="security" className="space-y-4">
            <Alert className="mb-4">
              <Info className="h-4 w-4" />
              <AlertTitle>Access Control Lists (ACLs)</AlertTitle>
              <AlertDescription className="text-sm space-y-1">
                <p>Configure permissions to control access to queues and topics. ACLs are enforced during simulation.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>Format:</strong> Resource should be in format <code>queue://name</code> or <code>topic://name</code> (wildcard <code>*</code> supported). 
                  Operations: <code>read</code>, <code>write</code>, <code>admin</code>, <code>create</code>. 
                  <strong>Deny</strong> takes precedence over <strong>Allow</strong>.
                </p>
              </AlertDescription>
            </Alert>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Access Control Lists (ACLs)</CardTitle>
                    <CardDescription>Configure permissions for users and resources</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateAcl(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add ACL
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {showCreateAcl && (
                  <Card className="mb-4 border-primary">
                    <CardHeader>
                      <CardTitle>Create ACL Rule</CardTitle>
                      <CardDescription>Configure access control for queues and topics</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="acl-principal">Principal (User/Group)</Label>
                          <Input
                            id="acl-principal"
                            value={aclForm.principal}
                            onChange={(e) => setAclForm({ ...aclForm, principal: e.target.value })}
                            placeholder="user1 or * for all"
                          />
                          <p className="text-xs text-muted-foreground">User or group name, use * for all</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="acl-resource">Resource</Label>
                          <Input
                            id="acl-resource"
                            value={aclForm.resource}
                            onChange={(e) => setAclForm({ ...aclForm, resource: e.target.value })}
                            placeholder="queue://orders or topic://events"
                          />
                          <p className="text-xs text-muted-foreground">Format: queue://name or topic://name (use * for all)</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="acl-operation">Operation</Label>
                          <Select
                            value={aclForm.operation}
                            onValueChange={(value: 'read' | 'write' | 'admin' | 'create') => 
                              setAclForm({ ...aclForm, operation: value })
                            }
                          >
                            <SelectTrigger id="acl-operation">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="read">Read</SelectItem>
                              <SelectItem value="write">Write</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="create">Create</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="acl-permission">Permission</Label>
                          <Select
                            value={aclForm.permission}
                            onValueChange={(value: 'allow' | 'deny') => 
                              setAclForm({ ...aclForm, permission: value })
                            }
                          >
                            <SelectTrigger id="acl-permission">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="allow">Allow</SelectItem>
                              <SelectItem value="deny">Deny</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={addAcl} disabled={!aclForm.principal || !aclForm.resource}>
                          Create ACL
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowCreateAcl(false);
                          setAclForm({
                            principal: '',
                            resource: '',
                            operation: 'read',
                            permission: 'allow',
                          });
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {acls.length === 0 && !showCreateAcl ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No ACLs configured</p>
                ) : (
                  <div className="space-y-2">
                    {acls.map((acl, index) => (
                      <Card key={index} className="border-l-4 border-l-red-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 grid grid-cols-4 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Principal</p>
                                <p className="text-sm font-medium">{acl.principal}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Resource</p>
                                <p className="text-sm font-medium">{acl.resource}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Operation</p>
                                <Badge variant="outline">{acl.operation}</Badge>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Permission</p>
                                <Badge variant={acl.permission === 'allow' ? 'default' : 'destructive'}>
                                  {acl.permission}
                                </Badge>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeAcl(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


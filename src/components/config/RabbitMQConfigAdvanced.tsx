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
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';
import { 
  Rabbit, 
  Database, 
  Activity, 
  Settings, 
  Plus, 
  Trash2,
  MessageSquare,
  Users,
  TrendingUp,
  ArrowRightLeft,
  Shield,
  Key
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { usePortValidation } from '@/hooks/usePortValidation';
import { AlertCircle } from 'lucide-react';
import { validateRequiredFields, type RequiredField } from '@/utils/requiredFields';
import { showSuccess, showError } from '@/utils/toast';

interface RabbitMQConfigProps {
  componentId: string;
}

interface Queue {
  name: string;
  durable: boolean;
  exclusive: boolean;
  autoDelete: boolean;
  messages?: number;
  consumers?: number;
  ready?: number;
  unacked?: number;
  arguments?: Record<string, any>;
  deadLetterExchange?: string;
  deadLetterRoutingKey?: string;
  messageTtl?: number;
  maxLength?: number;
  maxPriority?: number;
}

interface Exchange {
  name: string;
  type: 'direct' | 'topic' | 'fanout' | 'headers';
  durable: boolean;
  autoDelete: boolean;
  internal: boolean;
  arguments?: Record<string, any>;
}

interface Binding {
  id: string;
  source: string; // exchange name
  destination: string; // queue name
  routingKey: string;
  arguments?: Record<string, any>;
}

interface Policy {
  name: string;
  pattern: string;
  definition: Record<string, any>;
  priority: number;
  applyTo: 'queues' | 'exchanges' | 'all';
}

interface RabbitMQConfig {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  vhost?: string;
  queues?: Queue[];
  exchanges?: Exchange[];
  bindings?: Binding[];
  policies?: Policy[];
}

export function RabbitMQConfigAdvanced({ componentId }: RabbitMQConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as RabbitMQConfig;
  const host = config.host || 'localhost';
  const port = config.port || 5672;
  const username = config.username || 'guest';
  const password = config.password || '';
  const vhost = config.vhost || '/';
  const queues = config.queues || [];
  // Standard RabbitMQ system exchanges (configuration, not data)
  const exchanges = config.exchanges || [
    { name: 'amq.direct', type: 'direct', durable: true, autoDelete: false, internal: false },
    { name: 'amq.topic', type: 'topic', durable: true, autoDelete: false, internal: false },
    { name: 'amq.fanout', type: 'fanout', durable: true, autoDelete: false, internal: false },
  ];
  const bindings = config.bindings || [];
  const policies = config.policies || [];
  
  // Валидация портов и хостов
  const { portError, hostError, portConflict } = usePortValidation(nodes, componentId, host, port);
  
  const [editingQueueIndex, setEditingQueueIndex] = useState<number | null>(null);
  const [showCreateExchange, setShowCreateExchange] = useState(false);
  const [showCreateBinding, setShowCreateBinding] = useState(false);
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);

  const updateConfig = (updates: Partial<RabbitMQConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
    // Очистка ошибок валидации при успешном обновлении
    if (Object.keys(updates).some(key => ['host', 'port'].includes(key))) {
      const newErrors = { ...fieldErrors };
      Object.keys(updates).forEach(key => {
        if (newErrors[key]) delete newErrors[key];
      });
      setFieldErrors(newErrors);
    }
  };
  
  // Валидация обязательных полей
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  const requiredFields: RequiredField[] = [
    { field: 'host', label: 'Host' },
    { field: 'port', label: 'Port', validator: (v) => typeof v === 'number' && v > 0 && v <= 65535 },
  ];
  
  const validateConnectionFields = () => {
    const result = validateRequiredFields(
      { host, port },
      requiredFields
    );
    setFieldErrors(result.errors);
    return result.isValid;
  };

  const addQueue = () => {
    updateConfig({
      queues: [
        ...queues,
        { name: 'new-queue', durable: true, exclusive: false, autoDelete: false, messages: 0, consumers: 0, ready: 0, unacked: 0 },
      ],
    });
  };

  const removeQueue = (index: number) => {
    updateConfig({ queues: queues.filter((_, i) => i !== index) });
  };

  const updateQueue = (index: number, field: string, value: string | boolean | number | Record<string, any>) => {
    const newQueues = [...queues];
    newQueues[index] = { ...newQueues[index], [field]: value };
    updateConfig({ queues: newQueues });
  };

  const addExchange = () => {
    const newExchange: Exchange = {
      name: 'new-exchange',
      type: 'direct',
      durable: true,
      autoDelete: false,
      internal: false,
    };
    updateConfig({ exchanges: [...exchanges, newExchange] });
    setShowCreateExchange(false);
  };

  const removeExchange = (index: number) => {
    updateConfig({ exchanges: exchanges.filter((_, i) => i !== index) });
  };

  const updateExchange = (index: number, field: string, value: any) => {
    const newExchanges = [...exchanges];
    newExchanges[index] = { ...newExchanges[index], [field]: value };
    updateConfig({ exchanges: newExchanges });
  };

  const addBinding = () => {
    const newBinding: Binding = {
      id: `binding-${Date.now()}`,
      source: exchanges[0]?.name || '',
      destination: queues[0]?.name || '',
      routingKey: '',
    };
    updateConfig({ bindings: [...bindings, newBinding] });
    setShowCreateBinding(false);
  };

  const removeBinding = (id: string) => {
    updateConfig({ bindings: bindings.filter(b => b.id !== id) });
  };

  const updateBinding = (id: string, field: string, value: string) => {
    const newBindings = bindings.map(b => 
      b.id === id ? { ...b, [field]: value } : b
    );
    updateConfig({ bindings: newBindings });
  };

  const addPolicy = () => {
    const newPolicy: Policy = {
      name: 'new-policy',
      pattern: '.*',
      definition: {},
      priority: 0,
      applyTo: 'all',
    };
    updateConfig({ policies: [...policies, newPolicy] });
    setShowCreatePolicy(false);
  };

  const removePolicy = (index: number) => {
    updateConfig({ policies: policies.filter((_, i) => i !== index) });
  };

  const totalMessages = queues.reduce((sum, q) => sum + (q.messages || 0), 0);
  const totalConsumers = queues.reduce((sum, q) => sum + (q.consumers || 0), 0);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Rabbit className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">RabbitMQ</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Message Broker Management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Connected
            </Badge>
            <Button size="sm" variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Management UI
            </Button>
          </div>
        </div>

        <Separator />


        {/* Main Configuration Tabs */}
        <Tabs defaultValue="queues" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="queues" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Queues
            </TabsTrigger>
            <TabsTrigger value="exchanges" className="gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Exchanges
            </TabsTrigger>
            <TabsTrigger value="bindings" className="gap-2">
              <Key className="h-4 w-4" />
              Bindings
            </TabsTrigger>
            <TabsTrigger value="policies" className="gap-2">
              <Shield className="h-4 w-4" />
              Policies
            </TabsTrigger>
            <TabsTrigger value="connection" className="gap-2">
              <Database className="h-4 w-4" />
              Connection
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="gap-2">
              <Activity className="h-4 w-4" />
              Monitoring
            </TabsTrigger>
          </TabsList>

          {/* Queues Tab */}
          <TabsContent value="queues" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Message Queues</CardTitle>
                    <CardDescription>Configure and monitor RabbitMQ queues</CardDescription>
                  </div>
                  <Button size="sm" onClick={addQueue} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Queue
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {queues.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No queues configured</p>
                    <p className="text-xs mt-2">Click "Add Queue" to create a new queue</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {queues.map((queue, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-primary/10">
                              <MessageSquare className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{queue.name}</CardTitle>
                              <CardDescription className="text-xs mt-1 flex items-center gap-2">
                                {queue.durable && <Badge variant="outline" className="text-xs">Durable</Badge>}
                                {queue.exclusive && <Badge variant="outline" className="text-xs">Exclusive</Badge>}
                                {queue.autoDelete && <Badge variant="outline" className="text-xs">Auto-Delete</Badge>}
                              </CardDescription>
                            </div>
                          </div>
                          {queues.length > 1 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeQueue(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Queue Name</Label>
                            <Input
                              value={queue.name}
                              onChange={(e) => updateQueue(index, 'name', e.target.value)}
                              placeholder="queue-name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Properties</Label>
                            <div className="flex gap-2">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={queue.durable}
                                  onCheckedChange={(checked) => updateQueue(index, 'durable', checked)}
                                />
                                <Label className="text-xs">Durable</Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={queue.exclusive}
                                  onCheckedChange={(checked) => updateQueue(index, 'exclusive', checked)}
                                />
                                <Label className="text-xs">Exclusive</Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={queue.autoDelete}
                                  onCheckedChange={(checked) => updateQueue(index, 'autoDelete', checked)}
                                />
                                <Label className="text-xs">Auto-Delete</Label>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* Advanced Queue Configuration */}
                        {editingQueueIndex === index && (
                          <div className="pt-4 border-t border-border space-y-4">
                            <h4 className="font-semibold text-sm">Advanced Configuration</h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Dead Letter Exchange</Label>
                                <Input
                                  value={queue.deadLetterExchange || ''}
                                  onChange={(e) => updateQueue(index, 'deadLetterExchange', e.target.value)}
                                  placeholder="dlx"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Dead Letter Routing Key</Label>
                                <Input
                                  value={queue.deadLetterRoutingKey || ''}
                                  onChange={(e) => updateQueue(index, 'deadLetterRoutingKey', e.target.value)}
                                  placeholder="routing-key"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Message TTL (ms)</Label>
                                <Input
                                  type="number"
                                  value={queue.messageTtl || ''}
                                  onChange={(e) => updateQueue(index, 'messageTtl', parseInt(e.target.value) || undefined)}
                                  placeholder="60000"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Max Length</Label>
                                <Input
                                  type="number"
                                  value={queue.maxLength || ''}
                                  onChange={(e) => updateQueue(index, 'maxLength', parseInt(e.target.value) || undefined)}
                                  placeholder="10000"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Max Priority</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="255"
                                  value={queue.maxPriority || ''}
                                  onChange={(e) => updateQueue(index, 'maxPriority', parseInt(e.target.value) || undefined)}
                                  placeholder="10"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Queue Stats */}
                        <div className="pt-3 border-t border-border">
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Messages:</span>
                              <span className="ml-2 font-semibold">{(queue.messages || 0).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Ready:</span>
                              <span className="ml-2 font-semibold">{(queue.ready || 0).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Unacked:</span>
                              <span className="ml-2 font-semibold">{(queue.unacked || 0).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Consumers:</span>
                              <span className="ml-2 font-semibold">{queue.consumers || 0}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Exchanges Tab */}
          <TabsContent value="exchanges" className="space-y-4 mt-4">
            {showCreateExchange && (
              <Card className="mb-4 border-primary">
                <CardHeader>
                  <CardTitle>Create Exchange</CardTitle>
                  <CardDescription>Configure exchange settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Exchange Name</Label>
                      <Input placeholder="my-exchange" />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select defaultValue="direct">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="direct">Direct</SelectItem>
                          <SelectItem value="topic">Topic</SelectItem>
                          <SelectItem value="fanout">Fanout</SelectItem>
                          <SelectItem value="headers">Headers</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={addExchange}>Create Exchange</Button>
                    <Button variant="outline" onClick={() => setShowCreateExchange(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Exchanges</CardTitle>
                    <CardDescription>Message routing exchanges</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowCreateExchange(true)} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Exchange
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {exchanges.map((exchange, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-primary/10">
                              <ArrowRightLeft className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{exchange.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                <Badge variant="outline">{exchange.type}</Badge>
                                {exchange.durable && <Badge variant="outline" className="ml-1">Durable</Badge>}
                                {exchange.internal && <Badge variant="outline" className="ml-1">Internal</Badge>}
                              </CardDescription>
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeExchange(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Exchange Name</Label>
                            <Input
                              value={exchange.name}
                              onChange={(e) => updateExchange(index, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Type</Label>
                            <Select
                              value={exchange.type}
                              onValueChange={(value: 'direct' | 'topic' | 'fanout' | 'headers') => updateExchange(index, 'type', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="direct">Direct</SelectItem>
                                <SelectItem value="topic">Topic</SelectItem>
                                <SelectItem value="fanout">Fanout</SelectItem>
                                <SelectItem value="headers">Headers</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={exchange.durable}
                              onCheckedChange={(checked) => updateExchange(index, 'durable', checked)}
                            />
                            <Label className="text-xs">Durable</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={exchange.autoDelete}
                              onCheckedChange={(checked) => updateExchange(index, 'autoDelete', checked)}
                            />
                            <Label className="text-xs">Auto-Delete</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={exchange.internal}
                              onCheckedChange={(checked) => updateExchange(index, 'internal', checked)}
                            />
                            <Label className="text-xs">Internal</Label>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bindings Tab */}
          <TabsContent value="bindings" className="space-y-4 mt-4">
            {showCreateBinding && (
              <Card className="mb-4 border-primary">
                <CardHeader>
                  <CardTitle>Create Binding</CardTitle>
                  <CardDescription>Bind exchange to queue</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Source Exchange</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select exchange" />
                        </SelectTrigger>
                        <SelectContent>
                          {exchanges.map((ex) => (
                            <SelectItem key={ex.name} value={ex.name}>{ex.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Destination Queue</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select queue" />
                        </SelectTrigger>
                        <SelectContent>
                          {queues.map((q) => (
                            <SelectItem key={q.name} value={q.name}>{q.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Routing Key</Label>
                    <Input placeholder="routing.key" />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={addBinding}>Create Binding</Button>
                    <Button variant="outline" onClick={() => setShowCreateBinding(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Bindings</CardTitle>
                    <CardDescription>Exchange to queue bindings</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowCreateBinding(true)} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Binding
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {bindings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Key className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No bindings configured</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bindings.map((binding) => (
                      <Card key={binding.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-semibold">{binding.source}</div>
                              <div className="text-xs text-muted-foreground">
                                → {binding.destination} • Key: {binding.routingKey || '(none)'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select
                              value={binding.source}
                              onValueChange={(value) => updateBinding(binding.id, 'source', value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {exchanges.map((ex) => (
                                  <SelectItem key={ex.name} value={ex.name}>{ex.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              className="w-32"
                              value={binding.routingKey}
                              onChange={(e) => updateBinding(binding.id, 'routingKey', e.target.value)}
                              placeholder="routing key"
                            />
                            <Button size="icon" variant="ghost" onClick={() => removeBinding(binding.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Policies Tab */}
          <TabsContent value="policies" className="space-y-4 mt-4">
            {showCreatePolicy && (
              <Card className="mb-4 border-primary">
                <CardHeader>
                  <CardTitle>Create Policy</CardTitle>
                  <CardDescription>Configure queue/exchange policies</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Policy Name</Label>
                    <Input placeholder="ha-policy" />
                  </div>
                  <div className="space-y-2">
                    <Label>Pattern</Label>
                    <Input placeholder=".*" />
                  </div>
                  <div className="space-y-2">
                    <Label>Apply To</Label>
                    <Select defaultValue="all">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="queues">Queues</SelectItem>
                        <SelectItem value="exchanges">Exchanges</SelectItem>
                        <SelectItem value="all">All</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={addPolicy}>Create Policy</Button>
                    <Button variant="outline" onClick={() => setShowCreatePolicy(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Policies</CardTitle>
                    <CardDescription>Queue and exchange policies</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowCreatePolicy(true)} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Policy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {policies.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No policies configured</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {policies.map((policy, index) => (
                      <Card key={index} className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{policy.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Pattern: {policy.pattern} • Apply to: {policy.applyTo} • Priority: {policy.priority}
                            </div>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => removePolicy(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Connection Tab */}
          <TabsContent value="connection" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Connection Settings</CardTitle>
                <CardDescription>RabbitMQ server connection details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="host">
                      Host <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="host"
                      value={host}
                      onChange={(e) => {
                        updateConfig({ host: e.target.value });
                        if (fieldErrors.host) {
                          validateConnectionFields();
                        }
                      }}
                      onBlur={validateConnectionFields}
                      placeholder="localhost"
                      className={hostError || fieldErrors.host ? 'border-destructive' : ''}
                    />
                    {hostError && (
                      <div className="flex items-center gap-1 text-sm text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        <span>{hostError}</span>
                      </div>
                    )}
                    {!hostError && fieldErrors.host && (
                      <div className="flex items-center gap-1 text-sm text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        <span>{fieldErrors.host}</span>
                      </div>
                    )}
              {!hostError && fieldErrors.host && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{fieldErrors.host}</span>
                </div>
              )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="number"
                      value={port}
                      onChange={(e) => updateConfig({ port: parseInt(e.target.value) || 5672 })}
                      placeholder="5672"
                      className={portError || portConflict.hasConflict ? 'border-destructive' : ''}
                    />
                    {portError && (
                      <div className="flex items-center gap-1 text-sm text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        <span>{portError}</span>
                      </div>
                    )}
              {!portError && !fieldErrors.port && portConflict.hasConflict && portConflict.conflictingNode && (
                <div className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3 w-3" />
                  <span>
                    Конфликт порта: компонент "{portConflict.conflictingNode.data.label || portConflict.conflictingNode.type}" 
                    уже использует {host}:{port}
                  </span>
                </div>
              )}
              {!portError && fieldErrors.port && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{fieldErrors.port}</span>
                </div>
              )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => updateConfig({ username: e.target.value })}
                      placeholder="guest"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => updateConfig({ password: e.target.value })}
                      placeholder="password"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vhost">Virtual Host</Label>
                  <Input
                    id="vhost"
                    value={vhost}
                    onChange={(e) => updateConfig({ vhost: e.target.value })}
                    placeholder="/"
              />
            </div>
            <div className="flex gap-2 pt-4 border-t">
              <Button
                onClick={() => {
                  if (validateConnectionFields()) {
                    showSuccess('Параметры подключения сохранены');
                  } else {
                    showError('Пожалуйста, заполните все обязательные поля');
                  }
                }}
              >
                Сохранить настройки
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (validateConnectionFields()) {
                    showSuccess('Параметры подключения валидны');
                  } else {
                    showError('Пожалуйста, заполните все обязательные поля');
                  }
                }}
              >
                Проверить подключение
              </Button>
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          {/* Monitoring Tab */}
          <TabsContent value="monitoring" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Queue Monitoring</CardTitle>
                <CardDescription>Real-time queue statistics and metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {queues.map((queue, index) => (
                    <div key={index} className="p-4 border border-border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-semibold">{queue.name}</div>
                        <Badge variant="secondary">{queue.messages || 0} messages</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Ready Messages</span>
                          <span className="font-semibold">{(queue.ready || 0).toLocaleString()}</span>
                        </div>
                        <Progress value={queue.messages ? ((queue.ready || 0) / queue.messages) * 100 : 0} className="h-2" />
                        <div className="flex justify-between text-sm mt-2">
                          <span className="text-muted-foreground">Consumers</span>
                          <span className="font-semibold">{queue.consumers || 0}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


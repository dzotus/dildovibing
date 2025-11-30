import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RabbitMQConfigProps {
  componentId: string;
}

interface Queue {
  name: string;
  durable: boolean;
  exclusive: boolean;
  autoDelete: boolean;
  routingKey?: string;
  deadLetterExchange?: string;
}

interface Exchange {
  name: string;
  type: 'direct' | 'topic' | 'fanout' | 'headers';
  durable: boolean;
}

interface Binding {
  exchange: string;
  queue: string;
  routingKey: string;
}

interface RabbitMQConfig {
  host?: string;
  port?: number;
  username?: string;
  vhost?: string;
  queues?: Queue[];
  exchanges?: Exchange[];
  bindings?: Binding[];
  messageSchemas?: Array<{ queue: string; schema: string; format: string }>;
  sampleMessages?: Array<{ queue: string; message: string }>;
}

export function RabbitMQConfig({ componentId }: RabbitMQConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as RabbitMQConfig;
  const host = config.host || 'localhost';
  const port = config.port || 5672;
  const username = config.username || 'guest';
  const vhost = config.vhost || '/';
  const queues = config.queues || [
    { name: 'default-queue', durable: true, exclusive: false, autoDelete: false },
  ];
  const exchanges = config.exchanges || [];
  const bindings = config.bindings || [];
  const messageSchemas = config.messageSchemas || [];
  const sampleMessages = config.sampleMessages || [];

  const updateConfig = (updates: Partial<RabbitMQConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addQueue = () => {
    updateConfig({
      queues: [
        ...queues,
        { name: 'new-queue', durable: true, exclusive: false, autoDelete: false },
      ],
    });
  };

  const removeQueue = (index: number) => {
    updateConfig({ queues: queues.filter((_, i) => i !== index) });
  };

  const updateQueue = (index: number, field: string, value: string | boolean) => {
    const newQueues = [...queues];
    newQueues[index] = { ...newQueues[index], [field]: value };
    updateConfig({ queues: newQueues });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">RabbitMQ Configuration</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure RabbitMQ connection and queue settings
          </p>
        </div>

        <Separator />

        {/* Connection Settings */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Connection</h3>
            <p className="text-sm text-muted-foreground">RabbitMQ server connection details</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                value={host}
                onChange={(e) => updateConfig({ host: e.target.value })}
                placeholder="localhost"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                value={port}
                onChange={(e) => updateConfig({ port: parseInt(e.target.value) || 5672 })}
                placeholder="5672"
              />
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
              <Label htmlFor="vhost">Virtual Host</Label>
              <Input
                id="vhost"
                value={vhost}
                onChange={(e) => updateConfig({ vhost: e.target.value })}
                placeholder="/"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Queues Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Queues</h3>
              <p className="text-sm text-muted-foreground">Message queue configuration</p>
            </div>
            <Button size="sm" onClick={addQueue} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Queue
            </Button>
          </div>

          <div className="space-y-4">
            {queues.map((queue, index) => (
              <div key={index} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Queue {index + 1}</Label>
                  {queues.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeQueue(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`queue-name-${index}`}>Name</Label>
                  <Input
                    id={`queue-name-${index}`}
                    value={queue.name}
                    onChange={(e) => updateQueue(index, 'name', e.target.value)}
                    placeholder="queue-name"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`queue-durable-${index}`}>Durable</Label>
                    <Select
                      value={queue.durable ? 'true' : 'false'}
                      onValueChange={(value) => updateQueue(index, 'durable', value === 'true')}
                    >
                      <SelectTrigger id={`queue-durable-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`queue-exclusive-${index}`}>Exclusive</Label>
                    <Select
                      value={queue.exclusive ? 'true' : 'false'}
                      onValueChange={(value) => updateQueue(index, 'exclusive', value === 'true')}
                    >
                      <SelectTrigger id={`queue-exclusive-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`queue-autodelete-${index}`}>Auto Delete</Label>
                    <Select
                      value={queue.autoDelete ? 'true' : 'false'}
                      onValueChange={(value) => updateQueue(index, 'autoDelete', value === 'true')}
                    >
                      <SelectTrigger id={`queue-autodelete-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`queue-routing-key-${index}`}>Routing Key</Label>
                    <Input
                      id={`queue-routing-key-${index}`}
                      value={queue.routingKey || ''}
                      onChange={(e) => updateQueue(index, 'routingKey', e.target.value)}
                      placeholder="orders.*"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`queue-dlx-${index}`}>Dead Letter Exchange</Label>
                    <Input
                      id={`queue-dlx-${index}`}
                      value={queue.deadLetterExchange || ''}
                      onChange={(e) => updateQueue(index, 'deadLetterExchange', e.target.value)}
                      placeholder="dlx-exchange"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Exchanges Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Exchanges</h3>
              <p className="text-sm text-muted-foreground">Message routing exchanges (direct, topic, fanout, headers)</p>
            </div>
            <Button size="sm" onClick={() => updateConfig({ exchanges: [...exchanges, { name: '', type: 'direct', durable: true }] })} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Exchange
            </Button>
          </div>

          <div className="space-y-4">
            {exchanges.map((exchange, index) => (
              <div key={index} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Exchange {index + 1}</Label>
                  <Button size="sm" variant="ghost" onClick={() => updateConfig({ exchanges: exchanges.filter((_, i) => i !== index) })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={exchange.name}
                      onChange={(e) => {
                        const updated = [...exchanges];
                        updated[index].name = e.target.value;
                        updateConfig({ exchanges: updated });
                      }}
                      placeholder="exchange-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={exchange.type}
                      onValueChange={(value: any) => {
                        const updated = [...exchanges];
                        updated[index].type = value;
                        updateConfig({ exchanges: updated });
                      }}
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
                  <div className="space-y-2">
                    <Label>Durable</Label>
                    <Select
                      value={exchange.durable ? 'true' : 'false'}
                      onValueChange={(value) => {
                        const updated = [...exchanges];
                        updated[index].durable = value === 'true';
                        updateConfig({ exchanges: updated });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Bindings Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Bindings</h3>
              <p className="text-sm text-muted-foreground">Route messages from exchanges to queues using routing keys</p>
            </div>
            <Button size="sm" onClick={() => updateConfig({ bindings: [...bindings, { exchange: '', queue: '', routingKey: '' }] })} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Binding
            </Button>
          </div>

          <div className="space-y-4">
            {bindings.map((binding, index) => (
              <div key={index} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Binding {index + 1}</Label>
                  <Button size="sm" variant="ghost" onClick={() => updateConfig({ bindings: bindings.filter((_, i) => i !== index) })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Exchange</Label>
                    <Input
                      value={binding.exchange}
                      onChange={(e) => {
                        const updated = [...bindings];
                        updated[index].exchange = e.target.value;
                        updateConfig({ bindings: updated });
                      }}
                      placeholder="exchange-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Queue</Label>
                    <Input
                      value={binding.queue}
                      onChange={(e) => {
                        const updated = [...bindings];
                        updated[index].queue = e.target.value;
                        updateConfig({ bindings: updated });
                      }}
                      placeholder="queue-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Routing Key</Label>
                    <Input
                      value={binding.routingKey}
                      onChange={(e) => {
                        const updated = [...bindings];
                        updated[index].routingKey = e.target.value;
                        updateConfig({ bindings: updated });
                      }}
                      placeholder="orders.*"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Message Schemas */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Message Schemas</h3>
              <p className="text-sm text-muted-foreground">Define message schemas for queues</p>
            </div>
            <Button size="sm" onClick={() => updateConfig({ messageSchemas: [...messageSchemas, { queue: '', schema: '', format: 'json' }] })} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Schema
            </Button>
          </div>

          <div className="space-y-4">
            {messageSchemas.map((schema, index) => (
              <div key={index} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Schema {index + 1}</Label>
                  <Button size="sm" variant="ghost" onClick={() => updateConfig({ messageSchemas: messageSchemas.filter((_, i) => i !== index) })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Queue</Label>
                    <Input
                      value={schema.queue}
                      onChange={(e) => {
                        const updated = [...messageSchemas];
                        updated[index].queue = e.target.value;
                        updateConfig({ messageSchemas: updated });
                      }}
                      placeholder="queue-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Format</Label>
                    <Select
                      value={schema.format}
                      onValueChange={(value) => {
                        const updated = [...messageSchemas];
                        updated[index].format = value;
                        updateConfig({ messageSchemas: updated });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="avro">Avro</SelectItem>
                        <SelectItem value="protobuf">Protobuf</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Schema Definition</Label>
                  <Textarea
                    value={schema.schema}
                    onChange={(e) => {
                      const updated = [...messageSchemas];
                      updated[index].schema = e.target.value;
                      updateConfig({ messageSchemas: updated });
                    }}
                    placeholder='{"type": "object", "properties": {"id": {"type": "integer"}, "name": {"type": "string"}}}'
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Sample Messages */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Sample Messages</h3>
              <p className="text-sm text-muted-foreground">Example messages for testing and documentation</p>
            </div>
            <Button size="sm" onClick={() => updateConfig({ sampleMessages: [...sampleMessages, { queue: '', message: '' }] })} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Sample
            </Button>
          </div>

          <div className="space-y-4">
            {sampleMessages.map((sample, index) => (
              <div key={index} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Sample {index + 1}</Label>
                  <Button size="sm" variant="ghost" onClick={() => updateConfig({ sampleMessages: sampleMessages.filter((_, i) => i !== index) })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Queue</Label>
                  <Input
                    value={sample.queue}
                    onChange={(e) => {
                      const updated = [...sampleMessages];
                      updated[index].queue = e.target.value;
                      updateConfig({ sampleMessages: updated });
                    }}
                    placeholder="queue-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Message (JSON)</Label>
                  <Textarea
                    value={sample.message}
                    onChange={(e) => {
                      const updated = [...sampleMessages];
                      updated[index].message = e.target.value;
                      updateConfig({ sampleMessages: updated });
                    }}
                    placeholder='{"id": 1, "orderId": "ORD-123", "amount": 99.99}'
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

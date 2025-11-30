import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

interface KafkaConfigProps {
  componentId: string;
}

interface KafkaConfig {
  brokers?: string[];
  topics?: Array<{ 
    name: string; 
    partitions: number; 
    replication: number;
    messageSchema?: string;
    retentionHours?: number;
    compression?: string;
  }>;
  groupId?: string;
  clientId?: string;
  messageSchemas?: Array<{ topic: string; schema: string; format: string }>;
  consumerGroups?: Array<{ groupId: string; topics: string[]; strategy: string }>;
  sampleMessages?: Array<{ topic: string; message: string }>;
}

export function KafkaConfig({ componentId }: KafkaConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as KafkaConfig;
  const brokers = config.brokers || ['localhost:9092'];
  const topics = config.topics || [{ name: 'default-topic', partitions: 3, replication: 1, compression: 'gzip', retentionHours: 168 }];
  const groupId = config.groupId || 'default-group';
  const clientId = config.clientId || 'default-client';
  const messageSchemas = config.messageSchemas || [];
  const consumerGroups = config.consumerGroups || [];
  const sampleMessages = config.sampleMessages || [];

  const updateConfig = (updates: Partial<KafkaConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addBroker = () => {
    updateConfig({ brokers: [...brokers, 'localhost:9093'] });
  };

  const removeBroker = (index: number) => {
    updateConfig({ brokers: brokers.filter((_, i) => i !== index) });
  };

  const updateBroker = (index: number, value: string) => {
    const newBrokers = [...brokers];
    newBrokers[index] = value;
    updateConfig({ brokers: newBrokers });
  };

  const addTopic = () => {
    updateConfig({
      topics: [...topics, { name: 'new-topic', partitions: 3, replication: 1 }],
    });
  };

  const removeTopic = (index: number) => {
    updateConfig({ topics: topics.filter((_, i) => i !== index) });
  };

  const updateTopic = (index: number, field: string, value: string | number) => {
    const newTopics = [...topics];
    newTopics[index] = { ...newTopics[index], [field]: value };
    updateConfig({ topics: newTopics });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Kafka Configuration</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure Kafka broker connections, topics, and client settings
          </p>
        </div>

        <Separator />

        {/* Brokers Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Brokers</h3>
              <p className="text-sm text-muted-foreground">Kafka broker addresses</p>
            </div>
            <Button size="sm" onClick={addBroker} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Broker
            </Button>
          </div>

          <div className="space-y-2">
            {brokers.map((broker, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={broker}
                  onChange={(e) => updateBroker(index, e.target.value)}
                  placeholder="localhost:9092"
                  className="flex-1"
                />
                {brokers.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeBroker(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Topics Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Topics</h3>
              <p className="text-sm text-muted-foreground">Kafka topic configuration</p>
            </div>
            <Button size="sm" onClick={addTopic} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Topic
            </Button>
          </div>

          <div className="space-y-4">
            {topics.map((topic, index) => (
              <div key={index} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Topic {index + 1}</Label>
                  {topics.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeTopic(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`topic-name-${index}`}>Name</Label>
                  <Input
                    id={`topic-name-${index}`}
                    value={topic.name}
                    onChange={(e) => updateTopic(index, 'name', e.target.value)}
                    placeholder="topic-name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`topic-partitions-${index}`}>Partitions</Label>
                    <Input
                      id={`topic-partitions-${index}`}
                      type="number"
                      min="1"
                      value={topic.partitions}
                      onChange={(e) => updateTopic(index, 'partitions', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`topic-replication-${index}`}>Replication</Label>
                    <Input
                      id={`topic-replication-${index}`}
                      type="number"
                      min="1"
                      value={topic.replication}
                      onChange={(e) => updateTopic(index, 'replication', parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`topic-compression-${index}`}>Compression</Label>
                    <Select
                      value={topic.compression || 'none'}
                      onValueChange={(value) => updateTopic(index, 'compression', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="gzip">Gzip</SelectItem>
                        <SelectItem value="snappy">Snappy</SelectItem>
                        <SelectItem value="lz4">LZ4</SelectItem>
                        <SelectItem value="zstd">Zstd</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`topic-retention-${index}`}>Retention (hours)</Label>
                    <Input
                      id={`topic-retention-${index}`}
                      type="number"
                      min="1"
                      value={topic.retentionHours || 168}
                      onChange={(e) => updateTopic(index, 'retentionHours', parseInt(e.target.value) || 168)}
                      placeholder="168"
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
              <p className="text-sm text-muted-foreground">Define message schemas for topics (Avro, JSON Schema, Protobuf)</p>
            </div>
            <Button size="sm" onClick={() => updateConfig({ messageSchemas: [...messageSchemas, { topic: '', schema: '', format: 'avro' }] })} variant="outline">
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
                    <Label>Topic</Label>
                    <Input
                      value={schema.topic}
                      onChange={(e) => {
                        const updated = [...messageSchemas];
                        updated[index].topic = e.target.value;
                        updateConfig({ messageSchemas: updated });
                      }}
                      placeholder="topic-name"
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
                        <SelectItem value="avro">Avro</SelectItem>
                        <SelectItem value="json-schema">JSON Schema</SelectItem>
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
                    placeholder='{"type": "record", "name": "User", "fields": [{"name": "id", "type": "int"}]}'
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Consumer Groups */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Consumer Groups</h3>
              <p className="text-sm text-muted-foreground">Configure consumer groups and their processing strategies</p>
            </div>
            <Button size="sm" onClick={() => updateConfig({ consumerGroups: [...consumerGroups, { groupId: '', topics: [], strategy: 'earliest' }] })} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Group
            </Button>
          </div>

          <div className="space-y-4">
            {consumerGroups.map((group, index) => (
              <div key={index} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Consumer Group {index + 1}</Label>
                  <Button size="sm" variant="ghost" onClick={() => updateConfig({ consumerGroups: consumerGroups.filter((_, i) => i !== index) })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Group ID</Label>
                    <Input
                      value={group.groupId}
                      onChange={(e) => {
                        const updated = [...consumerGroups];
                        updated[index].groupId = e.target.value;
                        updateConfig({ consumerGroups: updated });
                      }}
                      placeholder="consumer-group-1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Offset Strategy</Label>
                    <Select
                      value={group.strategy}
                      onValueChange={(value) => {
                        const updated = [...consumerGroups];
                        updated[index].strategy = value;
                        updateConfig({ consumerGroups: updated });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="earliest">Earliest</SelectItem>
                        <SelectItem value="latest">Latest</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Subscribed Topics</Label>
                  <Input
                    value={group.topics.join(', ')}
                    onChange={(e) => {
                      const updated = [...consumerGroups];
                      updated[index].topics = e.target.value.split(',').map(t => t.trim()).filter(t => t);
                      updateConfig({ consumerGroups: updated });
                    }}
                    placeholder="topic1, topic2, topic3"
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
            <Button size="sm" onClick={() => updateConfig({ sampleMessages: [...sampleMessages, { topic: '', message: '' }] })} variant="outline">
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
                  <Label>Topic</Label>
                  <Input
                    value={sample.topic}
                    onChange={(e) => {
                      const updated = [...sampleMessages];
                      updated[index].topic = e.target.value;
                      updateConfig({ sampleMessages: updated });
                    }}
                    placeholder="topic-name"
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
                    placeholder='{"id": 1, "name": "John Doe", "email": "john@example.com"}'
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Client Settings */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Client Settings</h3>
            <p className="text-sm text-muted-foreground">Consumer group and client configuration</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-id">Consumer Group ID</Label>
              <Input
                id="group-id"
                value={groupId}
                onChange={(e) => updateConfig({ groupId: e.target.value })}
                placeholder="default-group"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-id">Client ID</Label>
              <Input
                id="client-id"
                value={clientId}
                onChange={(e) => updateConfig({ clientId: e.target.value })}
                placeholder="default-client"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

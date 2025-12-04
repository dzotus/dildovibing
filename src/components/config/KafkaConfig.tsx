import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2 } from 'lucide-react';

interface KafkaConfigProps {
  componentId: string;
}

interface KafkaConfig {
  brokers?: string[];
  topics?: Array<{ name: string; partitions: number; replication: number }>;
  groupId?: string;
  clientId?: string;
}

export function KafkaConfig({ componentId }: KafkaConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as KafkaConfig;
  const brokers = config.brokers || ['localhost:9092'];
  const topics = config.topics || [{ name: 'default-topic', partitions: 3, replication: 1 }];
  const groupId = config.groupId || 'default-group';
  const clientId = config.clientId || 'default-client';

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

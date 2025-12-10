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
  MessageSquare, 
  Activity, 
  Settings, 
  Plus, 
  Trash2,
  Shield,
  Key,
  Users
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface AzureServiceBusConfigProps {
  componentId: string;
}

interface Queue {
  name: string;
  namespace: string;
  maxSizeInMegabytes: number;
  defaultMessageTimeToLive: number;
  lockDuration: number;
  maxDeliveryCount: number;
  enablePartitioning: boolean;
  enableDeadLetteringOnMessageExpiration: boolean;
  enableSessions: boolean;
  activeMessageCount?: number;
  deadLetterMessageCount?: number;
  scheduledMessageCount?: number;
}

interface Topic {
  name: string;
  namespace: string;
  maxSizeInMegabytes: number;
  defaultMessageTimeToLive: number;
  enablePartitioning: boolean;
  subscriptions?: Array<{
    name: string;
    maxDeliveryCount: number;
    lockDuration: number;
    enableDeadLetteringOnMessageExpiration: boolean;
    activeMessageCount?: number;
  }>;
}

interface AzureServiceBusConfig {
  namespace?: string;
  connectionString?: string;
  queues?: Queue[];
  topics?: Topic[];
}

export function AzureServiceBusConfigAdvanced({ componentId }: AzureServiceBusConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as AzureServiceBusConfig;
  const namespace = config.namespace || 'archiphoenix.servicebus.windows.net';
  const connectionString = config.connectionString || '';
  const queues = config.queues || [];
  const topics = config.topics || [];

  const [editingQueueIndex, setEditingQueueIndex] = useState<number | null>(null);
  const [editingTopicIndex, setEditingTopicIndex] = useState<number | null>(null);

  const updateConfig = (updates: Partial<AzureServiceBusConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addQueue = () => {
    const newQueue: Queue = {
      name: 'new-queue',
      namespace,
      maxSizeInMegabytes: 1024,
      defaultMessageTimeToLive: 2592000,
      lockDuration: 30,
      maxDeliveryCount: 10,
      enablePartitioning: false,
      enableDeadLetteringOnMessageExpiration: true,
      enableSessions: false,
      activeMessageCount: 0,
      deadLetterMessageCount: 0,
      scheduledMessageCount: 0,
    };
    updateConfig({ queues: [...queues, newQueue] });
  };

  const removeQueue = (index: number) => {
    updateConfig({ queues: queues.filter((_, i) => i !== index) });
  };

  const updateQueue = (index: number, field: string, value: any) => {
    const newQueues = [...queues];
    newQueues[index] = { ...newQueues[index], [field]: value };
    updateConfig({ queues: newQueues });
  };

  const addTopic = () => {
    const newTopic: Topic = {
      name: 'new-topic',
      namespace,
      maxSizeInMegabytes: 1024,
      defaultMessageTimeToLive: 2592000,
      enablePartitioning: false,
      subscriptions: [],
    };
    updateConfig({ topics: [...topics, newTopic] });
  };

  const removeTopic = (index: number) => {
    updateConfig({ topics: topics.filter((_, i) => i !== index) });
  };

  const updateTopic = (index: number, field: string, value: any) => {
    const newTopics = [...topics];
    newTopics[index] = { ...newTopics[index], [field]: value };
    updateConfig({ topics: newTopics });
  };

  const addSubscription = (topicIndex: number) => {
    const topic = topics[topicIndex];
    if (topic) {
      const newSub = {
        name: 'new-subscription',
        maxDeliveryCount: 10,
        lockDuration: 30,
        enableDeadLetteringOnMessageExpiration: true,
        activeMessageCount: 0,
      };
      const updatedSubs = [...(topic.subscriptions || []), newSub];
      updateTopic(topicIndex, 'subscriptions', updatedSubs);
    }
  };

  const removeSubscription = (topicIndex: number, subIndex: number) => {
    const topic = topics[topicIndex];
    if (topic && topic.subscriptions) {
      const updatedSubs = topic.subscriptions.filter((_, i) => i !== subIndex);
      updateTopic(topicIndex, 'subscriptions', updatedSubs);
    }
  };

  const updateSubscription = (topicIndex: number, subIndex: number, field: string, value: any) => {
    const topic = topics[topicIndex];
    if (topic && topic.subscriptions) {
      const updatedSubs = [...topic.subscriptions];
      updatedSubs[subIndex] = { ...updatedSubs[subIndex], [field]: value };
      updateTopic(topicIndex, 'subscriptions', updatedSubs);
    }
  };

  const totalMessages = queues.reduce((sum, q) => sum + (q.activeMessageCount || 0), 0) +
    topics.reduce((sum, t) => sum + (t.subscriptions?.reduce((s, sub) => s + (sub.activeMessageCount || 0), 0) || 0), 0);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Azure Service Bus</p>
            <h2 className="text-2xl font-bold text-foreground">Service Bus Namespace</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure queues, topics and subscriptions with sessions and dead-lettering
            </p>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Namespace</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="truncate max-w-full">{namespace}</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Queues</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{queues.length}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Topics</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{topics.length}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{totalMessages.toLocaleString()}</span>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="queues" className="space-y-4">
          <TabsList>
            <TabsTrigger value="queues">
              <MessageSquare className="h-4 w-4 mr-2" />
              Queues ({queues.length})
            </TabsTrigger>
            <TabsTrigger value="topics">
              <MessageSquare className="h-4 w-4 mr-2" />
              Topics ({topics.length})
            </TabsTrigger>
            <TabsTrigger value="connection">
              <Key className="h-4 w-4 mr-2" />
              Connection
            </TabsTrigger>
          </TabsList>

          <TabsContent value="queues" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Queues</CardTitle>
                    <CardDescription>Configure Service Bus queues</CardDescription>
                  </div>
                  <Button onClick={addQueue} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Queue
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {queues.map((queue, index) => (
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 space-y-2">
                            <Label>Queue Name</Label>
                            <Input
                              value={queue.name}
                              onChange={(e) => updateQueue(index, 'name', e.target.value)}
                              placeholder="queue-name"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeQueue(index)}
                            disabled={queues.length === 1}
                            className="ml-4"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Active Messages</p>
                            <p className="text-lg font-semibold">{queue.activeMessageCount || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Dead Letter</p>
                            <p className="text-lg font-semibold">{queue.deadLetterMessageCount || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Scheduled</p>
                            <p className="text-lg font-semibold">{queue.scheduledMessageCount || 0}</p>
                          </div>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Max Size (MB)</Label>
                            <Input
                              type="number"
                              value={queue.maxSizeInMegabytes}
                              onChange={(e) => updateQueue(index, 'maxSizeInMegabytes', Number(e.target.value))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Message TTL (seconds)</Label>
                            <Input
                              type="number"
                              value={queue.defaultMessageTimeToLive}
                              onChange={(e) => updateQueue(index, 'defaultMessageTimeToLive', Number(e.target.value))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Lock Duration (seconds)</Label>
                            <Input
                              type="number"
                              value={queue.lockDuration}
                              onChange={(e) => updateQueue(index, 'lockDuration', Number(e.target.value))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Max Delivery Count</Label>
                            <Input
                              type="number"
                              value={queue.maxDeliveryCount}
                              onChange={(e) => updateQueue(index, 'maxDeliveryCount', Number(e.target.value))}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Enable Sessions</Label>
                            <Switch
                              checked={queue.enableSessions}
                              onCheckedChange={(checked) => updateQueue(index, 'enableSessions', checked)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Enable Partitioning</Label>
                            <Switch
                              checked={queue.enablePartitioning}
                              onCheckedChange={(checked) => updateQueue(index, 'enablePartitioning', checked)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Dead Letter on Expiration</Label>
                            <Switch
                              checked={queue.enableDeadLetteringOnMessageExpiration}
                              onCheckedChange={(checked) => updateQueue(index, 'enableDeadLetteringOnMessageExpiration', checked)}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="topics" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Topics</CardTitle>
                    <CardDescription>Configure publish-subscribe topics with subscriptions</CardDescription>
                  </div>
                  <Button onClick={addTopic} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Topic
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topics.map((topic, index) => (
                    <Card key={index} className="border-l-4 border-l-green-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 space-y-2">
                            <Label>Topic Name</Label>
                            <Input
                              value={topic.name}
                              onChange={(e) => updateTopic(index, 'name', e.target.value)}
                              placeholder="topic-name"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTopic(index)}
                            disabled={topics.length === 1}
                            className="ml-4"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Max Size (MB)</Label>
                            <Input
                              type="number"
                              value={topic.maxSizeInMegabytes}
                              onChange={(e) => updateTopic(index, 'maxSizeInMegabytes', Number(e.target.value))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Message TTL (seconds)</Label>
                            <Input
                              type="number"
                              value={topic.defaultMessageTimeToLive}
                              onChange={(e) => updateTopic(index, 'defaultMessageTimeToLive', Number(e.target.value))}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Enable Partitioning</Label>
                            <Switch
                              checked={topic.enablePartitioning}
                              onCheckedChange={(checked) => updateTopic(index, 'enablePartitioning', checked)}
                            />
                          </div>
                        </div>
                        <Separator />
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label>Subscriptions ({topic.subscriptions?.length || 0})</Label>
                            <Button size="sm" variant="outline" onClick={() => addSubscription(index)}>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Subscription
                            </Button>
                          </div>
                          {topic.subscriptions && topic.subscriptions.length > 0 ? (
                            <div className="space-y-4">
                              {topic.subscriptions.map((sub, subIndex) => (
                                <Card key={subIndex} className="p-4 border-l-4 border-l-purple-500">
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1 space-y-2">
                                        <Label>Subscription Name</Label>
                                        <Input
                                          value={sub.name}
                                          onChange={(e) => updateSubscription(index, subIndex, 'name', e.target.value)}
                                          placeholder="subscription-name"
                                        />
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeSubscription(index, subIndex)}
                                        className="ml-4"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Active Messages</p>
                                        <p className="text-lg font-semibold">{sub.activeMessageCount || 0}</p>
                                      </div>
                                    </div>
                                    <Separator />
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label>Lock Duration (seconds)</Label>
                                        <Input
                                          type="number"
                                          value={sub.lockDuration}
                                          onChange={(e) => updateSubscription(index, subIndex, 'lockDuration', Number(e.target.value))}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Max Delivery Count</Label>
                                        <Input
                                          type="number"
                                          value={sub.maxDeliveryCount}
                                          onChange={(e) => updateSubscription(index, subIndex, 'maxDeliveryCount', Number(e.target.value))}
                                        />
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <Label>Dead Letter on Expiration</Label>
                                      <Switch
                                        checked={sub.enableDeadLetteringOnMessageExpiration}
                                        onCheckedChange={(checked) => updateSubscription(index, subIndex, 'enableDeadLetteringOnMessageExpiration', checked)}
                                      />
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">No subscriptions</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="connection" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Connection Settings</CardTitle>
                <CardDescription>Azure Service Bus connection string</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Namespace</Label>
                  <Input
                    value={namespace}
                    onChange={(e) => updateConfig({ namespace: e.target.value })}
                    placeholder="my-namespace.servicebus.windows.net"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Connection String</Label>
                  <Textarea
                    value={connectionString}
                    onChange={(e) => updateConfig({ connectionString: e.target.value })}
                    placeholder="Endpoint=sb://..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


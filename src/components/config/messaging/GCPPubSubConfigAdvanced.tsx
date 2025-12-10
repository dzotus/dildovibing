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
  Key,
  Users,
  Send
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface GCPPubSubConfigProps {
  componentId: string;
}

interface Topic {
  name: string;
  projectId: string;
  messageRetentionDuration?: number;
  labels?: Record<string, string>;
  messageCount?: number;
  byteCount?: number;
}

interface Subscription {
  name: string;
  topic: string;
  projectId: string;
  ackDeadlineSeconds: number;
  messageRetentionDuration?: number;
  enableMessageOrdering: boolean;
  pushEndpoint?: string;
  pushAttributes?: Record<string, string>;
  messageCount?: number;
  unackedMessageCount?: number;
}

interface GCPPubSubConfig {
  projectId?: string;
  credentials?: string;
  topics?: Topic[];
  subscriptions?: Subscription[];
}

export function GCPPubSubConfigAdvanced({ componentId }: GCPPubSubConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as GCPPubSubConfig;
  const projectId = config.projectId || 'archiphoenix-lab';
  const credentials = config.credentials || '';
  const topics = config.topics || [];
  const subscriptions = config.subscriptions || [];

  const [editingTopicIndex, setEditingTopicIndex] = useState<number | null>(null);
  const [editingSubIndex, setEditingSubIndex] = useState<number | null>(null);

  const updateConfig = (updates: Partial<GCPPubSubConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addTopic = () => {
    const newTopic: Topic = {
      name: 'new-topic',
      projectId,
      messageRetentionDuration: 604800,
      messageCount: 0,
      byteCount: 0,
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

  const addSubscription = () => {
    const newSub: Subscription = {
      name: 'new-subscription',
      topic: topics[0]?.name || '',
      projectId,
      ackDeadlineSeconds: 10,
      enableMessageOrdering: false,
      messageCount: 0,
      unackedMessageCount: 0,
    };
    updateConfig({ subscriptions: [...subscriptions, newSub] });
  };

  const removeSubscription = (index: number) => {
    updateConfig({ subscriptions: subscriptions.filter((_, i) => i !== index) });
  };

  const updateSubscription = (index: number, field: string, value: any) => {
    const newSubs = [...subscriptions];
    newSubs[index] = { ...newSubs[index], [field]: value };
    updateConfig({ subscriptions: newSubs });
  };

  const totalMessages = topics.reduce((sum, t) => sum + (t.messageCount || 0), 0);
  const totalUnacked = subscriptions.reduce((sum, s) => sum + (s.unackedMessageCount || 0), 0);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Google Cloud Pub/Sub</p>
            <h2 className="text-2xl font-bold text-foreground">Pub/Sub Service</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure topics and subscriptions with push/pull delivery
            </p>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Project ID</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{projectId}</Badge>
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
              <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{subscriptions.length}</span>
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

        <Tabs defaultValue="topics" className="space-y-4">
          <TabsList>
            <TabsTrigger value="topics">
              <MessageSquare className="h-4 w-4 mr-2" />
              Topics ({topics.length})
            </TabsTrigger>
            <TabsTrigger value="subscriptions">
              <Users className="h-4 w-4 mr-2" />
              Subscriptions ({subscriptions.length})
            </TabsTrigger>
            <TabsTrigger value="credentials">
              <Key className="h-4 w-4 mr-2" />
              Credentials
            </TabsTrigger>
          </TabsList>

          <TabsContent value="topics" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Topics</CardTitle>
                    <CardDescription>Configure Pub/Sub topics</CardDescription>
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
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            {editingTopicIndex === index ? (
                              <Input
                                value={topic.name}
                                onChange={(e) => updateTopic(index, 'name', e.target.value)}
                                onBlur={() => setEditingTopicIndex(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') setEditingTopicIndex(null);
                                }}
                                className="h-7"
                                autoFocus
                              />
                            ) : (
                              <span
                                className="cursor-pointer hover:text-primary"
                                onClick={() => setEditingTopicIndex(index)}
                              >
                                {topic.name}
                              </span>
                            )}
                          </CardTitle>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTopic(index)}
                            disabled={topics.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Messages</p>
                            <p className="text-lg font-semibold">{topic.messageCount || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Bytes</p>
                            <p className="text-lg font-semibold">{(topic.byteCount || 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Topic ID</p>
                            <p className="text-xs font-mono text-muted-foreground truncate">
                              projects/{projectId}/topics/{topic.name}
                            </p>
                          </div>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Message Retention (seconds)</Label>
                            <Input
                              type="number"
                              value={topic.messageRetentionDuration || 604800}
                              onChange={(e) => updateTopic(index, 'messageRetentionDuration', Number(e.target.value))}
                            />
                            <p className="text-xs text-muted-foreground">Default: 7 days (604800)</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscriptions" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Subscriptions</CardTitle>
                    <CardDescription>Configure pull and push subscriptions</CardDescription>
                  </div>
                  <Button onClick={addSubscription} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Subscription
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {subscriptions.map((sub, index) => (
                    <Card key={index} className="border-l-4 border-l-green-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            {editingSubIndex === index ? (
                              <Input
                                value={sub.name}
                                onChange={(e) => updateSubscription(index, 'name', e.target.value)}
                                onBlur={() => setEditingSubIndex(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') setEditingSubIndex(null);
                                }}
                                className="h-7"
                                autoFocus
                              />
                            ) : (
                              <span
                                className="cursor-pointer hover:text-primary"
                                onClick={() => setEditingSubIndex(index)}
                              >
                                {sub.name}
                              </span>
                            )}
                          </CardTitle>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSubscription(index)}
                            disabled={subscriptions.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Messages</p>
                            <p className="text-lg font-semibold">{sub.messageCount || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Unacked</p>
                            <p className="text-lg font-semibold">{sub.unackedMessageCount || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Topic</p>
                            <Badge variant="outline">{sub.topic}</Badge>
                          </div>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Topic</Label>
                            <Select
                              value={sub.topic}
                              onValueChange={(value) => updateSubscription(index, 'topic', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {topics.map((t) => (
                                  <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Ack Deadline (seconds)</Label>
                            <Input
                              type="number"
                              value={sub.ackDeadlineSeconds}
                              onChange={(e) => updateSubscription(index, 'ackDeadlineSeconds', Number(e.target.value))}
                              min={10}
                              max={600}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Push Endpoint URL (optional)</Label>
                            <Input
                              value={sub.pushEndpoint || ''}
                              onChange={(e) => updateSubscription(index, 'pushEndpoint', e.target.value)}
                              placeholder="https://api.service/push"
                            />
                            <p className="text-xs text-muted-foreground">
                              Leave empty for pull subscription
                            </p>
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Enable Message Ordering</Label>
                            <Switch
                              checked={sub.enableMessageOrdering}
                              onCheckedChange={(checked) => updateSubscription(index, 'enableMessageOrdering', checked)}
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

          <TabsContent value="credentials" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>GCP Credentials</CardTitle>
                <CardDescription>Configure Google Cloud Platform credentials</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Project ID</Label>
                  <Input
                    value={projectId}
                    onChange={(e) => updateConfig({ projectId: e.target.value })}
                    placeholder="my-project-id"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Service Account JSON</Label>
                  <Textarea
                    value={credentials}
                    onChange={(e) => updateConfig({ credentials: e.target.value })}
                    placeholder='{"type": "service_account", ...}'
                    rows={8}
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste your GCP service account JSON credentials
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


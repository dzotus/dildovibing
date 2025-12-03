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
  Database, 
  Activity, 
  Settings, 
  Plus, 
  Trash2,
  Shield,
  Key,
  Cloud,
  TrendingUp,
  RefreshCcw,
  Send,
  Download
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface AWSSQSConfigProps {
  componentId: string;
}

interface Queue {
  name: string;
  type: 'standard' | 'fifo';
  region: string;
  visibilityTimeout: number;
  messageRetention: number;
  delaySeconds: number;
  maxReceiveCount?: number;
  deadLetterQueue?: string;
  approximateMessages?: number;
  approximateMessagesNotVisible?: number;
  approximateMessagesDelayed?: number;
  contentBasedDedup?: boolean;
  fifoThroughputLimit?: 'perQueue' | 'perMessageGroupId';
}

interface AWSSQSConfig {
  queues?: Queue[];
  accessKeyId?: string;
  secretAccessKey?: string;
  defaultRegion?: string;
  iamPolicies?: Array<{
    id: string;
    principal: string;
    action: string;
    resource: string;
    effect: 'Allow' | 'Deny';
  }>;
}

export function AWSSQSConfigAdvanced({ componentId }: AWSSQSConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as AWSSQSConfig;
  const queues = config.queues || [];
  const accessKeyId = config.accessKeyId || '';
  const secretAccessKey = config.secretAccessKey || '';
  const defaultRegion = config.defaultRegion || 'us-east-1';
  const iamPolicies = config.iamPolicies || [];

  const [editingQueueIndex, setEditingQueueIndex] = useState<number | null>(null);
  const [showCreateQueue, setShowCreateQueue] = useState(false);
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);
  const [testMessage, setTestMessage] = useState('');

  const updateConfig = (updates: Partial<AWSSQSConfig>) => {
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
      type: 'standard',
      region: defaultRegion,
      visibilityTimeout: 30,
      messageRetention: 4,
      delaySeconds: 0,
      approximateMessages: 0,
      approximateMessagesNotVisible: 0,
      approximateMessagesDelayed: 0,
    };
    updateConfig({ queues: [...queues, newQueue] });
    setShowCreateQueue(false);
  };

  const removeQueue = (index: number) => {
    updateConfig({ queues: queues.filter((_, i) => i !== index) });
  };

  const updateQueue = (index: number, field: string, value: any) => {
    const newQueues = [...queues];
    newQueues[index] = { ...newQueues[index], [field]: value };
    updateConfig({ queues: newQueues });
  };

  const addPolicy = () => {
    const newPolicy = {
      id: `policy-${Date.now()}`,
      principal: '*',
      action: 'sqs:SendMessage',
      resource: '*',
      effect: 'Allow' as const,
    };
    updateConfig({ iamPolicies: [...iamPolicies, newPolicy] });
    setShowCreatePolicy(false);
  };

  const removePolicy = (id: string) => {
    updateConfig({ iamPolicies: iamPolicies.filter((p) => p.id !== id) });
  };

  const sendTestMessage = (queueIndex: number) => {
    const queue = queues[queueIndex];
    if (queue && testMessage) {
      updateQueue(queueIndex, 'approximateMessages', (queue.approximateMessages || 0) + 1);
      setTestMessage('');
      // В реальной системе здесь был бы вызов API
    }
  };

  const totalMessages = queues.reduce((sum, q) => sum + (q.approximateMessages || 0), 0);
  const totalInFlight = queues.reduce((sum, q) => sum + (q.approximateMessagesNotVisible || 0), 0);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Amazon SQS</p>
            <h2 className="text-2xl font-bold text-foreground">Simple Queue Service</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure and manage AWS SQS queues with delivery guarantees
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Cloud className="h-4 w-4 mr-2" />
              AWS Console
            </Button>
          </div>
        </div>

        <Separator />

        {/* Overview Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Queues</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{queues.length}</span>
              <p className="text-xs text-muted-foreground mt-1">Active queues</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{totalMessages.toLocaleString()}</span>
              <p className="text-xs text-muted-foreground mt-1">Approximate count</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">In Flight</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{totalInFlight.toLocaleString()}</span>
              <p className="text-xs text-muted-foreground mt-1">Being processed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Default Region</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{defaultRegion}</Badge>
              <p className="text-xs text-muted-foreground mt-1">AWS Region</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="queues" className="space-y-4">
          <TabsList>
            <TabsTrigger value="queues">
              <MessageSquare className="h-4 w-4 mr-2" />
              Queues ({queues.length})
            </TabsTrigger>
            <TabsTrigger value="credentials">
              <Key className="h-4 w-4 mr-2" />
              Credentials
            </TabsTrigger>
            <TabsTrigger value="policies">
              <Shield className="h-4 w-4 mr-2" />
              IAM Policies ({iamPolicies.length})
            </TabsTrigger>
            <TabsTrigger value="monitoring">
              <Activity className="h-4 w-4 mr-2" />
              Monitoring
            </TabsTrigger>
          </TabsList>

          {/* Queues Tab */}
          <TabsContent value="queues" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Queues</CardTitle>
                    <CardDescription>Manage SQS queues and their configuration</CardDescription>
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
                    <Card key={index} className="border-l-4 border-l-orange-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <MessageSquare className="h-5 w-5 text-orange-500" />
                            <div>
                              <CardTitle className="text-base">
                                {editingQueueIndex === index ? (
                                  <Input
                                    value={queue.name}
                                    onChange={(e) => updateQueue(index, 'name', e.target.value)}
                                    onBlur={() => setEditingQueueIndex(null)}
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') setEditingQueueIndex(null);
                                    }}
                                    className="h-7"
                                    autoFocus
                                  />
                                ) : (
                                  <span
                                    className="cursor-pointer hover:text-primary"
                                    onClick={() => setEditingQueueIndex(index)}
                                  >
                                    {queue.name}
                                  </span>
                                )}
                              </CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant={queue.type === 'fifo' ? 'default' : 'outline'}>
                                  {queue.type === 'fifo' ? 'FIFO' : 'Standard'}
                                </Badge>
                                <Badge variant="outline">{queue.region}</Badge>
                              </div>
                            </div>
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
                      <CardContent className="space-y-4">
                        {/* Queue Stats */}
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Messages Available</p>
                            <p className="text-lg font-semibold">{queue.approximateMessages || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">In Flight</p>
                            <p className="text-lg font-semibold">{queue.approximateMessagesNotVisible || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Delayed</p>
                            <p className="text-lg font-semibold">{queue.approximateMessagesDelayed || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Queue URL</p>
                            <p className="text-xs font-mono text-muted-foreground truncate">
                              https://sqs.{queue.region}.amazonaws.com/.../{queue.name}
                            </p>
                          </div>
                        </div>

                        <Separator />

                        {/* Queue Configuration */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Queue Type</Label>
                            <Select
                              value={queue.type}
                              onValueChange={(value: 'standard' | 'fifo') => updateQueue(index, 'type', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="standard">Standard Queue</SelectItem>
                                <SelectItem value="fifo">FIFO Queue</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Region</Label>
                            <Input
                              value={queue.region}
                              onChange={(e) => updateQueue(index, 'region', e.target.value)}
                              placeholder="us-east-1"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Visibility Timeout (seconds)</Label>
                            <Input
                              type="number"
                              value={queue.visibilityTimeout}
                              onChange={(e) => updateQueue(index, 'visibilityTimeout', Number(e.target.value))}
                              min={0}
                              max={43200}
                            />
                            <p className="text-xs text-muted-foreground">
                              Time a message is hidden after being received
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Message Retention Period (days)</Label>
                            <Input
                              type="number"
                              value={queue.messageRetention}
                              onChange={(e) => updateQueue(index, 'messageRetention', Number(e.target.value))}
                              min={1}
                              max={14}
                            />
                            <p className="text-xs text-muted-foreground">
                              How long messages are kept (1-14 days)
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Delivery Delay (seconds)</Label>
                            <Input
                              type="number"
                              value={queue.delaySeconds}
                              onChange={(e) => updateQueue(index, 'delaySeconds', Number(e.target.value))}
                              min={0}
                              max={900}
                            />
                            <p className="text-xs text-muted-foreground">
                              Delay before messages become available (0-900 seconds)
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Dead Letter Queue</Label>
                            <Input
                              value={queue.deadLetterQueue || ''}
                              onChange={(e) => updateQueue(index, 'deadLetterQueue', e.target.value)}
                              placeholder="dlq-name"
                            />
                            <p className="text-xs text-muted-foreground">
                              Queue for messages that fail processing
                            </p>
                          </div>
                          {queue.type === 'fifo' && (
                            <>
                              <div className="space-y-2">
                                <Label>Max Receive Count</Label>
                                <Input
                                  type="number"
                                  value={queue.maxReceiveCount || 3}
                                  onChange={(e) => updateQueue(index, 'maxReceiveCount', Number(e.target.value))}
                                  min={1}
                                  max={1000}
                                />
                                <p className="text-xs text-muted-foreground">
                                  Messages moved to DLQ after this many receives
                                </p>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label>Content-Based Deduplication</Label>
                                  <Switch
                                    checked={queue.contentBasedDedup || false}
                                    onCheckedChange={(checked) => updateQueue(index, 'contentBasedDedup', checked)}
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Automatically deduplicate messages by content hash
                                </p>
                              </div>
                              <div className="space-y-2">
                                <Label>FIFO Throughput Limit</Label>
                                <Select
                                  value={queue.fifoThroughputLimit || 'perQueue'}
                                  onValueChange={(value: 'perQueue' | 'perMessageGroupId') =>
                                    updateQueue(index, 'fifoThroughputLimit', value)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="perQueue">Per Queue</SelectItem>
                                    <SelectItem value="perMessageGroupId">Per Message Group ID</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </>
                          )}
                        </div>

                        <Separator />

                        {/* Test Message */}
                        <div className="space-y-2">
                          <Label>Send Test Message</Label>
                          <div className="flex gap-2">
                            <Input
                              value={testMessage}
                              onChange={(e) => setTestMessage(e.target.value)}
                              placeholder="Enter test message..."
                            />
                            <Button
                              size="sm"
                              onClick={() => sendTestMessage(index)}
                              disabled={!testMessage}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Send
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Credentials Tab */}
          <TabsContent value="credentials" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AWS Credentials</CardTitle>
                <CardDescription>Configure AWS access credentials for SQS</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="accessKeyId">Access Key ID</Label>
                  <Input
                    id="accessKeyId"
                    value={accessKeyId}
                    onChange={(e) => updateConfig({ accessKeyId: e.target.value })}
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secretAccessKey">Secret Access Key</Label>
                  <Input
                    id="secretAccessKey"
                    type="password"
                    value={secretAccessKey}
                    onChange={(e) => updateConfig({ secretAccessKey: e.target.value })}
                    placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultRegion">Default Region</Label>
                  <Input
                    id="defaultRegion"
                    value={defaultRegion}
                    onChange={(e) => updateConfig({ defaultRegion: e.target.value })}
                    placeholder="us-east-1"
                  />
                </div>
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    <strong>Security Note:</strong> In production, use IAM roles or environment variables instead of hardcoding credentials.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* IAM Policies Tab */}
          <TabsContent value="policies" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>IAM Policies</CardTitle>
                    <CardDescription>Configure access policies for queues</CardDescription>
                  </div>
                  <Button onClick={addPolicy} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Policy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {iamPolicies.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No policies configured</p>
                ) : (
                  <div className="space-y-2">
                    {iamPolicies.map((policy) => (
                      <Card key={policy.id} className="border-l-4 border-l-blue-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 grid grid-cols-4 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Principal</p>
                                <p className="text-sm font-medium">{policy.principal}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Action</p>
                                <Badge variant="outline">{policy.action}</Badge>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Resource</p>
                                <p className="text-sm font-medium truncate">{policy.resource}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Effect</p>
                                <Badge variant={policy.effect === 'Allow' ? 'default' : 'destructive'}>
                                  {policy.effect}
                                </Badge>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removePolicy(policy.id)}
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

          {/* Monitoring Tab */}
          <TabsContent value="monitoring" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Queue Monitoring</CardTitle>
                <CardDescription>Monitor queue metrics and performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {queues.map((queue, index) => (
                    <Card key={index} className="border-l-4 border-l-green-500">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{queue.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Messages Available</p>
                            <p className="text-2xl font-bold">{queue.approximateMessages || 0}</p>
                            <Progress
                              value={Math.min((queue.approximateMessages || 0) / 1000 * 100, 100)}
                              className="h-2 mt-2"
                            />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">In Flight</p>
                            <p className="text-2xl font-bold">{queue.approximateMessagesNotVisible || 0}</p>
                            <Progress
                              value={Math.min((queue.approximateMessagesNotVisible || 0) / 100 * 100, 100)}
                              className="h-2 mt-2"
                            />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Delayed</p>
                            <p className="text-2xl font-bold">{queue.approximateMessagesDelayed || 0}</p>
                            <Progress
                              value={Math.min((queue.approximateMessagesDelayed || 0) / 100 * 100, 100)}
                              className="h-2 mt-2"
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
        </Tabs>
      </div>
    </div>
  );
}


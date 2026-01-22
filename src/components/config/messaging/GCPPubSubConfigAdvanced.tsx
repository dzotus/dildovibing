import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { emulationEngine } from '@/core/EmulationEngine';
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
import { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Activity, 
  Settings, 
  Plus, 
  Trash2,
  Key,
  Users,
  Send,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp
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
  schema?: {
    type: 'AVRO' | 'PROTOCOL_BUFFER' | 'JSON';
    definition?: string;
  };
  validationErrorCount?: number;
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
  payloadFormat?: 'WRAPPED' | 'UNWRAPPED'; // Payload format for push subscriptions
  messageCount?: number;
  unackedMessageCount?: number;
  deadLetterTopic?: string;
  maxDeliveryAttempts?: number;
  retryPolicy?: {
    minimumBackoff?: number;
    maximumBackoff?: number;
  };
  enableExactlyOnceDelivery?: boolean;
  expirationPolicy?: {
    ttl?: number; // Time-to-live in seconds
  };
  // Extended metrics
  deliveredCount?: number;
  acknowledgedCount?: number;
  nackedCount?: number;
  deadLetterCount?: number;
  pushDeliverySuccessRate?: number;
  expiredAckDeadlines?: number;
  avgDeliveryAttempts?: number;
}

interface GCPPubSubConfig {
  projectId?: string;
  credentials?: string;
  topics?: Topic[];
  subscriptions?: Subscription[];
}

export function GCPPubSubConfigAdvanced({ componentId }: GCPPubSubConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { isRunning } = useEmulationStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;
  const nodeRef = useRef(node);

  // Keep node ref updated
  useEffect(() => {
    nodeRef.current = node;
  }, [node]);

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as GCPPubSubConfig;
  const projectId = config.projectId || 'archiphoenix-lab';
  const credentials = config.credentials || '';
  const topics = config.topics || [];
  const subscriptions = config.subscriptions || [];

  const [editingTopicIndex, setEditingTopicIndex] = useState<number | null>(null);
  const [editingSubIndex, setEditingSubIndex] = useState<number | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [newLabelKey, setNewLabelKey] = useState<{ topicIndex: number; key: string; value: string } | null>(null);

  // Sync metrics from routing engine in real-time
  useEffect(() => {
    if (!node || (topics.length === 0 && subscriptions.length === 0) || !isRunning) return;
    
    const interval = setInterval(() => {
      const routingEngine = emulationEngine.getPubSubRoutingEngine(componentId);
      if (!routingEngine) return;

      const allTopicMetrics = routingEngine.getAllTopicMetrics();
      const allSubscriptionMetrics = routingEngine.getAllSubscriptionMetrics();
      const currentConfig = (nodeRef.current?.data.config as any) || {};
      const currentTopics = currentConfig.topics || [];
      const currentSubscriptions = currentConfig.subscriptions || [];
      
      // Update topics with metrics
      const updatedTopics = currentTopics.map((topic: any) => {
        const metrics = allTopicMetrics.get(topic.name);
        if (metrics) {
          return {
            ...topic,
            messageCount: metrics.messageCount,
            byteCount: metrics.byteCount,
            validationErrorCount: metrics.validationErrorCount,
          };
        }
        return topic;
      });

      // Update subscriptions with metrics
      const updatedSubscriptions = currentSubscriptions.map((subscription: any) => {
        const metrics = allSubscriptionMetrics.get(subscription.name);
        if (metrics) {
          return {
            ...subscription,
            messageCount: metrics.messageCount,
            unackedMessageCount: metrics.unackedMessageCount,
            deliveredCount: metrics.deliveredCount,
            acknowledgedCount: metrics.acknowledgedCount,
            nackedCount: metrics.nackedCount,
            deadLetterCount: metrics.deadLetterCount,
            pushDeliverySuccessRate: metrics.pushDeliverySuccessRate,
            expiredAckDeadlines: metrics.expiredAckDeadlines,
            avgDeliveryAttempts: metrics.avgDeliveryAttempts,
          };
        }
        return subscription;
      });

      // Check if metrics changed
      const topicsChanged = updatedTopics.some((t: any, i: number) => 
        t.messageCount !== currentTopics[i]?.messageCount ||
        t.byteCount !== currentTopics[i]?.byteCount ||
        t.validationErrorCount !== currentTopics[i]?.validationErrorCount
      );

      const subscriptionsChanged = updatedSubscriptions.some((s: any, i: number) => 
        s.messageCount !== currentSubscriptions[i]?.messageCount ||
        s.unackedMessageCount !== currentSubscriptions[i]?.unackedMessageCount ||
        s.deliveredCount !== currentSubscriptions[i]?.deliveredCount ||
        s.acknowledgedCount !== currentSubscriptions[i]?.acknowledgedCount ||
        s.nackedCount !== currentSubscriptions[i]?.nackedCount ||
        s.deadLetterCount !== currentSubscriptions[i]?.deadLetterCount ||
        s.pushDeliverySuccessRate !== currentSubscriptions[i]?.pushDeliverySuccessRate ||
        s.expiredAckDeadlines !== currentSubscriptions[i]?.expiredAckDeadlines ||
        s.avgDeliveryAttempts !== currentSubscriptions[i]?.avgDeliveryAttempts
      );

      if ((topicsChanged || subscriptionsChanged) && nodeRef.current) {
        updateNode(componentId, {
          data: {
            ...nodeRef.current.data,
            config: {
              ...currentConfig,
              topics: updatedTopics,
              subscriptions: updatedSubscriptions,
            },
          },
        });
      }
    }, 500); // Update every 500ms

    return () => clearInterval(interval);
  }, [componentId, topics.length, subscriptions.length, node?.id, updateNode, isRunning]);

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
    
    // Validate if updating name or retention
    if (field === 'name') {
      const error = validateTopicName(value);
      if (error) {
        setValidationErrors({ ...validationErrors, [`topic-${index}-name`]: error });
      } else {
        const newErrors = { ...validationErrors };
        delete newErrors[`topic-${index}-name`];
        setValidationErrors(newErrors);
      }
    } else if (field === 'messageRetentionDuration') {
      const error = validateMessageRetention(value);
      if (error) {
        setValidationErrors({ ...validationErrors, [`topic-${index}-retention`]: error });
      } else {
        const newErrors = { ...validationErrors };
        delete newErrors[`topic-${index}-retention`];
        setValidationErrors(newErrors);
      }
    }
    
    updateConfig({ topics: newTopics });
  };

  const updateTopicLabel = (topicIndex: number, labelKey: string, labelValue: string) => {
    const newTopics = [...topics];
    const topic = newTopics[topicIndex];
    const newLabels = { ...(topic.labels || {}), [labelKey]: labelValue };
    newTopics[topicIndex] = { ...topic, labels: newLabels };
    updateConfig({ topics: newTopics });
  };

  const removeTopicLabel = (topicIndex: number, labelKey: string) => {
    const newTopics = [...topics];
    const topic = newTopics[topicIndex];
    const newLabels = { ...(topic.labels || {}) };
    delete newLabels[labelKey];
    newTopics[topicIndex] = { ...topic, labels: newLabels };
    updateConfig({ topics: newTopics });
  };

  const addTopicLabel = (topicIndex: number, key: string, value: string) => {
    if (!key || !value) return;
    updateTopicLabel(topicIndex, key, value);
    setNewLabelKey(null);
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
      maxDeliveryAttempts: 5,
      retryPolicy: {
        minimumBackoff: 10,
        maximumBackoff: 600,
      },
      enableExactlyOnceDelivery: false,
      expirationPolicy: {
        ttl: undefined, // No expiration by default
      },
      flowControl: {
        maxOutstandingMessages: 1000, // Default 1000 messages
        maxOutstandingBytes: 0, // Unlimited by default
      },
    };
    updateConfig({ subscriptions: [...subscriptions, newSub] });
  };

  const removeSubscription = (index: number) => {
    updateConfig({ subscriptions: subscriptions.filter((_, i) => i !== index) });
  };

  const updateSubscription = (index: number, field: string, value: any) => {
    const newSubs = [...subscriptions];
    newSubs[index] = { ...newSubs[index], [field]: value };
    
    // Validate fields
    if (field === 'name') {
      const error = validateSubscriptionName(value);
      if (error) {
        setValidationErrors({ ...validationErrors, [`sub-${index}-name`]: error });
      } else {
        const newErrors = { ...validationErrors };
        delete newErrors[`sub-${index}-name`];
        setValidationErrors(newErrors);
      }
    } else if (field === 'pushEndpoint') {
      const error = validatePushEndpoint(value);
      if (error) {
        setValidationErrors({ ...validationErrors, [`sub-${index}-pushEndpoint`]: error });
      } else {
        const newErrors = { ...validationErrors };
        delete newErrors[`sub-${index}-pushEndpoint`];
        setValidationErrors(newErrors);
      }
    } else if (field === 'ackDeadlineSeconds') {
      const error = validateAckDeadline(value);
      if (error) {
        setValidationErrors({ ...validationErrors, [`sub-${index}-ackDeadline`]: error });
      } else {
        const newErrors = { ...validationErrors };
        delete newErrors[`sub-${index}-ackDeadline`];
        setValidationErrors(newErrors);
      }
    } else if (field === 'messageRetentionDuration') {
      const error = validateMessageRetention(value);
      if (error) {
        setValidationErrors({ ...validationErrors, [`sub-${index}-retention`]: error });
      } else {
        const newErrors = { ...validationErrors };
        delete newErrors[`sub-${index}-retention`];
        setValidationErrors(newErrors);
      }
    }
    
    updateConfig({ subscriptions: newSubs });
  };

  // Validation functions
  const validateTopicName = (name: string): string | null => {
    if (!name || name.length < 3 || name.length > 255) {
      return 'Topic name must be 3-255 characters';
    }
    if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(name)) {
      return 'Topic name must start with lowercase letter, contain only lowercase letters, numbers, and hyphens, and end with alphanumeric';
    }
    if (name.startsWith('goog')) {
      return 'Topic name cannot start with "goog"';
    }
    return null;
  };

  const validateSubscriptionName = (name: string): string | null => {
    if (!name || name.length < 3 || name.length > 255) {
      return 'Subscription name must be 3-255 characters';
    }
    if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(name)) {
      return 'Subscription name must start with lowercase letter, contain only lowercase letters, numbers, and hyphens, and end with alphanumeric';
    }
    if (name.startsWith('goog')) {
      return 'Subscription name cannot start with "goog"';
    }
    return null;
  };

  const validatePushEndpoint = (url: string): string | null => {
    if (!url) return null; // Empty is valid (pull subscription)
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        return 'Push endpoint must use HTTPS';
      }
      return null;
    } catch {
      return 'Invalid URL format';
    }
  };

  const validateAckDeadline = (seconds: number): string | null => {
    if (seconds < 10 || seconds > 600) {
      return 'Ack deadline must be between 10 and 600 seconds';
    }
    return null;
  };

  const validateMessageRetention = (seconds: number): string | null => {
    const minSeconds = 600; // 10 minutes
    const maxSeconds = 2678400; // 31 days
    if (seconds < minSeconds || seconds > maxSeconds) {
      return `Message retention must be between ${minSeconds} seconds (10 minutes) and ${maxSeconds} seconds (31 days)`;
    }
    return null;
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
          <TabsList className="flex flex-wrap gap-2 w-full">
            <TabsTrigger value="topics" className="flex-shrink-0">
              <MessageSquare className="h-4 w-4 mr-2" />
              Topics ({topics.length})
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="flex-shrink-0">
              <Users className="h-4 w-4 mr-2" />
              Subscriptions ({subscriptions.length})
            </TabsTrigger>
            <TabsTrigger value="credentials" className="flex-shrink-0">
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
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Messages</p>
                            <p className="text-lg font-semibold">{topic.messageCount || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Bytes</p>
                            <p className="text-lg font-semibold">{(topic.byteCount || 0).toLocaleString()}</p>
                          </div>
                          {topic.validationErrorCount !== undefined && topic.validationErrorCount > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground">Validation Errors</p>
                              <p className="text-lg font-semibold text-red-600 dark:text-red-400">{topic.validationErrorCount}</p>
                            </div>
                          )}
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
                              className={validationErrors[`topic-${index}-retention`] ? 'border-red-500' : ''}
                            />
                            {validationErrors[`topic-${index}-retention`] && (
                              <p className="text-xs text-red-500">{validationErrors[`topic-${index}-retention`]}</p>
                            )}
                            <p className="text-xs text-muted-foreground">Default: 7 days (604800), Range: 600s - 2678400s</p>
                          </div>
                        </div>

                        {/* Schema Configuration */}
                        <Separator />
                        <div className="space-y-2">
                          <Label>Schema Configuration (optional)</Label>
                          <p className="text-xs text-muted-foreground mb-2">
                            Define a schema to validate messages published to this topic
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Schema Type</Label>
                              <Select
                                value={topic.schema?.type || 'none'}
                                onValueChange={(value) => {
                                  const newTopics = [...topics];
                                  if (value === 'none') {
                                    // Remove schema if "none" is selected
                                    const { schema, ...rest } = newTopics[index];
                                    newTopics[index] = rest;
                                  } else {
                                    newTopics[index] = {
                                      ...newTopics[index],
                                      schema: {
                                        ...newTopics[index].schema,
                                        type: value as 'AVRO' | 'PROTOCOL_BUFFER' | 'JSON',
                                        definition: newTopics[index].schema?.definition || '',
                                      },
                                    };
                                  }
                                  updateConfig({ topics: newTopics });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="No schema" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No schema</SelectItem>
                                  <SelectItem value="AVRO">Avro</SelectItem>
                                  <SelectItem value="PROTOCOL_BUFFER">Protocol Buffer</SelectItem>
                                  <SelectItem value="JSON">JSON Schema</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {topic.schema?.type && (
                            <div className="space-y-2">
                              <Label>Schema Definition</Label>
                              <Textarea
                                value={topic.schema?.definition || ''}
                                onChange={(e) => {
                                  const newTopics = [...topics];
                                  newTopics[index] = {
                                    ...newTopics[index],
                                    schema: {
                                      ...newTopics[index].schema!,
                                      type: newTopics[index].schema!.type,
                                      definition: e.target.value,
                                    },
                                  };
                                  updateConfig({ topics: newTopics });
                                }}
                                placeholder={
                                  topic.schema?.type === 'AVRO'
                                    ? '{"type": "record", "name": "Example", "fields": [...]}'
                                    : topic.schema?.type === 'PROTOCOL_BUFFER'
                                    ? 'syntax = "proto3"; message Example { ... }'
                                    : '{"type": "object", "properties": {...}}'
                                }
                                rows={6}
                                className="font-mono text-xs"
                              />
                              <p className="text-xs text-muted-foreground">
                                {topic.schema?.type === 'AVRO' && 'Avro schema in JSON format'}
                                {topic.schema?.type === 'PROTOCOL_BUFFER' && 'Protocol Buffer .proto file content'}
                                {topic.schema?.type === 'JSON' && 'JSON Schema definition'}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Labels Editor */}
                        <Separator />
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Labels</Label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setNewLabelKey({ topicIndex: index, key: '', value: '' })}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Label
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {topic.labels && Object.entries(topic.labels).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-2">
                                <Input
                                  value={key}
                                  readOnly
                                  className="flex-1 font-mono text-xs"
                                  disabled
                                />
                                <Input
                                  value={value}
                                  onChange={(e) => updateTopicLabel(index, key, e.target.value)}
                                  className="flex-1 font-mono text-xs"
                                  placeholder="value"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeTopicLabel(index, key)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                            {newLabelKey?.topicIndex === index && (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={newLabelKey.key}
                                  onChange={(e) => setNewLabelKey({ ...newLabelKey, key: e.target.value })}
                                  placeholder="key"
                                  className="flex-1 font-mono text-xs"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newLabelKey.key && newLabelKey.value) {
                                      addTopicLabel(index, newLabelKey.key, newLabelKey.value);
                                    } else if (e.key === 'Escape') {
                                      setNewLabelKey(null);
                                    }
                                  }}
                                  autoFocus
                                />
                                <Input
                                  value={newLabelKey.value}
                                  onChange={(e) => setNewLabelKey({ ...newLabelKey, value: e.target.value })}
                                  placeholder="value"
                                  className="flex-1 font-mono text-xs"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newLabelKey.key && newLabelKey.value) {
                                      addTopicLabel(index, newLabelKey.key, newLabelKey.value);
                                    } else if (e.key === 'Escape') {
                                      setNewLabelKey(null);
                                    }
                                  }}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (newLabelKey.key && newLabelKey.value) {
                                      addTopicLabel(index, newLabelKey.key, newLabelKey.value);
                                    }
                                  }}
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setNewLabelKey(null)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                            {(!topic.labels || Object.keys(topic.labels).length === 0) && !newLabelKey && (
                              <p className="text-xs text-muted-foreground">No labels. Click "Add Label" to add one.</p>
                            )}
                          </div>
                        </div>

                        {validationErrors[`topic-${index}-name`] && (
                          <p className="text-xs text-red-500 mt-2">{validationErrors[`topic-${index}-name`]}</p>
                        )}
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
                        {/* Status indicators */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={sub.pushEndpoint ? "default" : "secondary"}>
                            {sub.pushEndpoint ? (
                              <>
                                <Send className="h-3 w-3 mr-1" />
                                Push
                              </>
                            ) : (
                              <>
                                <Activity className="h-3 w-3 mr-1" />
                                Pull
                              </>
                            )}
                          </Badge>
                          {sub.messageCount && sub.messageCount > 0 ? (
                            <Badge variant="outline" className="bg-green-50 dark:bg-green-950">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-50 dark:bg-gray-900">
                              <Clock className="h-3 w-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                          {sub.unackedMessageCount && sub.unackedMessageCount > 0 && (
                            <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              {sub.unackedMessageCount} Unacked
                            </Badge>
                          )}
                          {sub.deadLetterCount && sub.deadLetterCount > 0 && (
                            <Badge variant="destructive">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              {sub.deadLetterCount} Dead Letter
                            </Badge>
                          )}
                        </div>

                        {/* Metrics grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Available</p>
                            <p className="text-lg font-semibold">{sub.messageCount || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Unacked</p>
                            <p className="text-lg font-semibold">{sub.unackedMessageCount || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Delivered</p>
                            <p className="text-lg font-semibold">{sub.deliveredCount || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Acknowledged</p>
                            <p className="text-lg font-semibold">{sub.acknowledgedCount || 0}</p>
                          </div>
                        </div>

                        {/* Extended metrics */}
                        {(sub.pushDeliverySuccessRate !== undefined || sub.avgDeliveryAttempts !== undefined || sub.expiredAckDeadlines !== undefined) && (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2 border-t">
                            {sub.pushEndpoint && sub.pushDeliverySuccessRate !== undefined && (
                              <div>
                                <p className="text-xs text-muted-foreground">Push Success Rate</p>
                                <div className="flex items-center gap-2">
                                  <Progress value={sub.pushDeliverySuccessRate * 100} className="flex-1" />
                                  <span className="text-sm font-medium">{(sub.pushDeliverySuccessRate * 100).toFixed(1)}%</span>
                                </div>
                              </div>
                            )}
                            {sub.avgDeliveryAttempts !== undefined && sub.avgDeliveryAttempts > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground">Avg Delivery Attempts</p>
                                <p className="text-lg font-semibold">{sub.avgDeliveryAttempts.toFixed(1)}</p>
                              </div>
                            )}
                            {sub.expiredAckDeadlines !== undefined && sub.expiredAckDeadlines > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground">Expired Acks</p>
                                <p className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">{sub.expiredAckDeadlines}</p>
                              </div>
                            )}
                          </div>
                        )}

                        <Separator />

                        {/* Basic configuration */}
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
                              className={validationErrors[`sub-${index}-ackDeadline`] ? 'border-red-500' : ''}
                            />
                            {validationErrors[`sub-${index}-ackDeadline`] && (
                              <p className="text-xs text-red-500">{validationErrors[`sub-${index}-ackDeadline`]}</p>
                            )}
                            <p className="text-xs text-muted-foreground">Range: 10-600 seconds</p>
                          </div>
                          <div className="space-y-2">
                            <Label>Push Endpoint URL (optional)</Label>
                            <Input
                              value={sub.pushEndpoint || ''}
                              onChange={(e) => updateSubscription(index, 'pushEndpoint', e.target.value)}
                              placeholder="https://api.service/push"
                              className={validationErrors[`sub-${index}-pushEndpoint`] ? 'border-red-500' : ''}
                            />
                            {validationErrors[`sub-${index}-pushEndpoint`] && (
                              <p className="text-xs text-red-500">{validationErrors[`sub-${index}-pushEndpoint`]}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Leave empty for pull subscription. Must be HTTPS URL.
                            </p>
                          </div>
                          {sub.pushEndpoint && (
                            <div className="space-y-2">
                              <Label>Payload Format</Label>
                              <Select
                                value={sub.payloadFormat || 'WRAPPED'}
                                onValueChange={(value) => updateSubscription(index, 'payloadFormat', value as 'WRAPPED' | 'UNWRAPPED')}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="WRAPPED">Wrapped (Pub/Sub format)</SelectItem>
                                  <SelectItem value="UNWRAPPED">Unwrapped (message data only)</SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                Wrapped: Full Pub/Sub message format with metadata. Unwrapped: Only message data.
                              </p>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <Label>Enable Message Ordering</Label>
                            <Switch
                              checked={sub.enableMessageOrdering}
                              onCheckedChange={(checked) => updateSubscription(index, 'enableMessageOrdering', checked)}
                            />
                          </div>
                        </div>

                        <Separator />

                        {/* Dead Letter Topic and Retry Policy */}
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Dead Letter Topic (optional)</Label>
                            <Select
                              value={sub.deadLetterTopic || 'none'}
                              onValueChange={(value) => updateSubscription(index, 'deadLetterTopic', value === 'none' ? undefined : value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select dead letter topic (optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {topics.map((t) => (
                                  <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Messages that exceed max delivery attempts will be sent to this topic
                            </p>
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Max Delivery Attempts</Label>
                              <Input
                                type="number"
                                value={sub.maxDeliveryAttempts || 5}
                                onChange={(e) => updateSubscription(index, 'maxDeliveryAttempts', Number(e.target.value))}
                                min={1}
                                max={100}
                              />
                              <p className="text-xs text-muted-foreground">Default: 5</p>
                            </div>
                            <div className="space-y-2">
                              <Label>Min Backoff (seconds)</Label>
                              <Input
                                type="number"
                                value={sub.retryPolicy?.minimumBackoff || 10}
                                onChange={(e) => {
                                  const newSubs = [...subscriptions];
                                  newSubs[index] = {
                                    ...newSubs[index],
                                    retryPolicy: {
                                      ...newSubs[index].retryPolicy,
                                      minimumBackoff: Number(e.target.value),
                                      maximumBackoff: newSubs[index].retryPolicy?.maximumBackoff || 600,
                                    },
                                  };
                                  updateConfig({ subscriptions: newSubs });
                                }}
                                min={1}
                                max={600}
                              />
                              <p className="text-xs text-muted-foreground">Default: 10s</p>
                            </div>
                            <div className="space-y-2">
                              <Label>Max Backoff (seconds)</Label>
                              <Input
                                type="number"
                                value={sub.retryPolicy?.maximumBackoff || 600}
                                onChange={(e) => {
                                  const newSubs = [...subscriptions];
                                  newSubs[index] = {
                                    ...newSubs[index],
                                    retryPolicy: {
                                      ...newSubs[index].retryPolicy,
                                      minimumBackoff: newSubs[index].retryPolicy?.minimumBackoff || 10,
                                      maximumBackoff: Number(e.target.value),
                                    },
                                  };
                                  updateConfig({ subscriptions: newSubs });
                                }}
                                min={10}
                                max={3600}
                              />
                              <p className="text-xs text-muted-foreground">Default: 600s</p>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Exactly-once Delivery and Expiration Policy */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label>Enable Exactly-Once Delivery</Label>
                              <p className="text-xs text-muted-foreground">
                                Prevents duplicate message delivery by tracking delivered message IDs
                              </p>
                            </div>
                            <Switch
                              checked={sub.enableExactlyOnceDelivery || false}
                              onCheckedChange={(checked) => updateSubscription(index, 'enableExactlyOnceDelivery', checked)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Expiration Policy TTL (seconds, optional)</Label>
                            <Input
                              type="number"
                              value={sub.expirationPolicy?.ttl || ''}
                              onChange={(e) => {
                                const newSubs = [...subscriptions];
                                const ttlValue = e.target.value === '' ? undefined : Number(e.target.value);
                                newSubs[index] = {
                                  ...newSubs[index],
                                  expirationPolicy: {
                                    ...newSubs[index].expirationPolicy,
                                    ttl: ttlValue,
                                  },
                                };
                                updateConfig({ subscriptions: newSubs });
                              }}
                              placeholder="No expiration"
                              min={1}
                            />
                            <p className="text-xs text-muted-foreground">
                              Subscription will expire if inactive for this duration. Leave empty for no expiration.
                            </p>
                          </div>
                        </div>

                        <Separator />

                        {/* Flow Control Settings */}
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-sm font-medium mb-2">Flow Control (Pull Subscriptions)</h4>
                            <p className="text-xs text-muted-foreground mb-4">
                              Limit the number of outstanding (unacked) messages and bytes to prevent overwhelming the subscriber
                            </p>
                          </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Max Outstanding Messages</Label>
                            <Input
                              type="number"
                              value={sub.flowControl?.maxOutstandingMessages ?? 1000}
                              onChange={(e) => {
                                const newSubs = [...subscriptions];
                                const value = e.target.value === '' ? undefined : Number(e.target.value);
                                newSubs[index] = {
                                  ...newSubs[index],
                                  flowControl: {
                                    ...newSubs[index].flowControl,
                                    maxOutstandingMessages: value ?? 1000,
                                    maxOutstandingBytes: newSubs[index].flowControl?.maxOutstandingBytes ?? 0,
                                  },
                                };
                                updateConfig({ subscriptions: newSubs });
                              }}
                              min={0}
                              placeholder="1000"
                            />
                            <p className="text-xs text-muted-foreground">
                              Maximum unacked messages (0 = unlimited). Default: 1000
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Max Outstanding Bytes</Label>
                            <Input
                              type="number"
                              value={sub.flowControl?.maxOutstandingBytes ?? 0}
                              onChange={(e) => {
                                const newSubs = [...subscriptions];
                                const value = e.target.value === '' ? undefined : Number(e.target.value);
                                newSubs[index] = {
                                  ...newSubs[index],
                                  flowControl: {
                                    ...newSubs[index].flowControl,
                                    maxOutstandingMessages: newSubs[index].flowControl?.maxOutstandingMessages ?? 1000,
                                    maxOutstandingBytes: value ?? 0,
                                  },
                                };
                                updateConfig({ subscriptions: newSubs });
                              }}
                              min={0}
                              placeholder="0 (unlimited)"
                            />
                            <p className="text-xs text-muted-foreground">
                              Maximum unacked bytes (0 = unlimited). Default: 0 (unlimited)
                            </p>
                          </div>
                        </div>
                        </div>

                        {validationErrors[`sub-${index}-name`] && (
                          <p className="text-xs text-red-500 mt-2">{validationErrors[`sub-${index}-name`]}</p>
                        )}
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


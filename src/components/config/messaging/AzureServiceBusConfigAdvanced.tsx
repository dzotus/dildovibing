import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { CanvasNode } from '@/types';
import { emulationEngine } from '@/core/EmulationEngine';
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
  Shield,
  Key,
  Users,
  HelpCircle,
  Eye,
  Search,
  X,
  Check,
  Clock,
  AlertCircle
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { showSuccess, showError } from '@/utils/toast';
import type { ServiceBusMessage } from '@/core/AzureServiceBusRoutingEngine';
import { 
  DEFAULT_AZURE_SERVICE_BUS_NAMESPACE,
  DEFAULT_QUEUE_VALUES,
  DEFAULT_TOPIC_VALUES,
  DEFAULT_SUBSCRIPTION_VALUES,
  NAMING_RULES
} from '@/core/constants/azureServiceBus';

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
  enableDuplicateDetection?: boolean;
  duplicateDetectionHistoryTimeWindow?: number; // seconds
  forwardTo?: string; // queue or topic name to forward messages to
  forwardDeadLetterMessagesTo?: string; // queue or topic name to forward dead letter messages to
}

interface SubscriptionFilter {
  type: 'sql' | 'correlation' | 'none';
  sqlExpression?: string;
  correlationId?: string;
  properties?: Record<string, string>;
}

interface Topic {
  name: string;
  namespace: string;
  maxSizeInMegabytes: number;
  defaultMessageTimeToLive: number;
  enablePartitioning: boolean;
  enableDuplicateDetection?: boolean;
  duplicateDetectionHistoryTimeWindow?: number; // seconds
  forwardTo?: string; // queue or topic name to forward messages to
  forwardDeadLetterMessagesTo?: string; // queue or topic name to forward dead letter messages to
  subscriptions?: Array<{
    name: string;
    maxDeliveryCount: number;
    lockDuration: number;
    enableDeadLetteringOnMessageExpiration: boolean;
    activeMessageCount?: number;
    filter?: SubscriptionFilter;
    forwardTo?: string; // queue or topic name to forward messages to
    forwardDeadLetterMessagesTo?: string; // queue or topic name to forward dead letter messages to
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
  const { isRunning } = useEmulationStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;
  const nodeRef = useRef(node);

  // Update ref when node changes
  useEffect(() => {
    nodeRef.current = node;
  }, [node]);

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as AzureServiceBusConfig;
  const namespace = config.namespace || DEFAULT_AZURE_SERVICE_BUS_NAMESPACE;
  const connectionString = config.connectionString || '';
  const queues = config.queues || [];
  const topics = config.topics || [];

  const [editingQueueIndex, setEditingQueueIndex] = useState<number | null>(null);
  const [editingTopicIndex, setEditingTopicIndex] = useState<number | null>(null);
  const [deleteQueueIndex, setDeleteQueueIndex] = useState<number | null>(null);
  const [deleteTopicIndex, setDeleteTopicIndex] = useState<number | null>(null);
  const [deleteSubscriptionIndex, setDeleteSubscriptionIndex] = useState<{ topicIndex: number; subIndex: number } | null>(null);
  const [viewingMessages, setViewingMessages] = useState<{ type: 'queue' | 'subscription'; queueName?: string; topicName?: string; subscriptionName?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'locked' | 'scheduled' | 'deadLetter' | 'deferred'>('all');
  const [queueSearchQuery, setQueueSearchQuery] = useState<string>('');
  const [topicSearchQuery, setTopicSearchQuery] = useState<string>('');

  const updateConfig = (updates: Partial<AzureServiceBusConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  // Sync metrics from routing engine in real-time
  useEffect(() => {
    if (!node || (queues.length === 0 && topics.length === 0) || !isRunning) return;
    
    const interval = setInterval(() => {
      try {
        const routingEngine = emulationEngine.getAzureServiceBusRoutingEngine(componentId);
        if (!routingEngine) return;

        const allQueueMetrics = routingEngine.getAllQueueMetrics();
        const allSubscriptionMetrics = routingEngine.getAllSubscriptionMetrics();
        
        const currentConfig = (nodeRef.current?.data.config as any) || {};
        const currentQueues = currentConfig.queues || [];
        const currentTopics = currentConfig.topics || [];
        
        let metricsChanged = false;
        
        // Update queue metrics
        const updatedQueues = currentQueues.map((queue: any) => {
          const metrics = allQueueMetrics.get(queue.name);
          if (metrics) {
            const updated = {
              ...queue,
              activeMessageCount: metrics.activeMessageCount,
              deadLetterMessageCount: metrics.deadLetterMessageCount,
              scheduledMessageCount: metrics.scheduledMessageCount,
              sentCount: metrics.sentCount,
              receivedCount: metrics.receivedCount,
              completedCount: metrics.completedCount,
              abandonedCount: metrics.abandonedCount,
            };
            
            // Check if metrics changed
            if (
              updated.activeMessageCount !== queue.activeMessageCount ||
              updated.deadLetterMessageCount !== queue.deadLetterMessageCount ||
              updated.scheduledMessageCount !== queue.scheduledMessageCount
            ) {
              metricsChanged = true;
            }
            
            return updated;
          }
          return queue;
        });
        
        // Update subscription metrics
        const updatedTopics = currentTopics.map((topic: any) => {
          if (!topic.subscriptions) return topic;
          
          const updatedSubs = topic.subscriptions.map((sub: any) => {
            const subscriptionId = `${topic.name}/subscriptions/${sub.name}`;
            const metrics = allSubscriptionMetrics.get(subscriptionId);
            if (metrics) {
              const updated = {
                ...sub,
                activeMessageCount: metrics.activeMessageCount,
                deadLetterMessageCount: metrics.deadLetterMessageCount,
                sentCount: metrics.sentCount,
                receivedCount: metrics.receivedCount,
                completedCount: metrics.completedCount,
                abandonedCount: metrics.abandonedCount,
              };
              
              if (updated.activeMessageCount !== sub.activeMessageCount) {
                metricsChanged = true;
              }
              
              return updated;
            }
            return sub;
          });
          
          return { ...topic, subscriptions: updatedSubs };
        });

        if (metricsChanged && nodeRef.current) {
          updateNode(componentId, {
            data: {
              ...nodeRef.current.data,
              config: {
                ...currentConfig,
                queues: updatedQueues,
                topics: updatedTopics,
              },
            },
          });
        }
      } catch (error) {
        console.error('Error syncing Azure Service Bus metrics:', error);
        // Don't show error toast for background sync errors to avoid spam
      }
    }, 500); // Update every 500ms

    return () => clearInterval(interval);
  }, [componentId, queues.length, topics.length, node?.id, isRunning, updateNode]);

  // Validation functions
  const validateName = (name: string, existingNames: string[], currentIndex?: number): string | null => {
    if (!name || name.trim() === '') {
      return 'Name is required';
    }
    
    if (name.length < NAMING_RULES.MIN_NAME_LENGTH || name.length > NAMING_RULES.MAX_NAME_LENGTH) {
      return `Name must be between ${NAMING_RULES.MIN_NAME_LENGTH} and ${NAMING_RULES.MAX_NAME_LENGTH} characters`;
    }
    
    if (!NAMING_RULES.NAME_PATTERN.test(name)) {
      return 'Name can only contain letters, numbers, periods (.), hyphens (-), and underscores (_)';
    }
    
    // Check for uniqueness
    const otherNames = existingNames.filter((_, i) => i !== currentIndex);
    if (otherNames.includes(name)) {
      return 'Name must be unique';
    }
    
    return null;
  };

  const validateNumericField = (value: number, fieldName: string, min?: number, max?: number): string | null => {
    if (isNaN(value)) {
      return `${fieldName} must be a number`;
    }
    if (min !== undefined && value < min) {
      return `${fieldName} must be at least ${min}`;
    }
    if (max !== undefined && value > max) {
      return `${fieldName} must be at most ${max}`;
    }
    if (value < 0) {
      return `${fieldName} must be positive`;
    }
    return null;
  };

  const addQueue = () => {
    // Generate unique name
    let queueName = 'new-queue';
    let counter = 1;
    const existingNames = queues.map((q: Queue) => q.name);
    while (existingNames.includes(queueName)) {
      queueName = `new-queue-${counter}`;
      counter++;
    }
    
    const newQueue: Queue = {
      name: queueName,
      namespace,
      maxSizeInMegabytes: DEFAULT_QUEUE_VALUES.maxSizeInMegabytes,
      defaultMessageTimeToLive: DEFAULT_QUEUE_VALUES.defaultMessageTimeToLive,
      lockDuration: DEFAULT_QUEUE_VALUES.lockDuration,
      maxDeliveryCount: DEFAULT_QUEUE_VALUES.maxDeliveryCount,
      enablePartitioning: DEFAULT_QUEUE_VALUES.enablePartitioning,
      enableDeadLetteringOnMessageExpiration: DEFAULT_QUEUE_VALUES.enableDeadLetteringOnMessageExpiration,
      enableSessions: DEFAULT_QUEUE_VALUES.enableSessions,
      activeMessageCount: 0,
      deadLetterMessageCount: 0,
      scheduledMessageCount: 0,
    };
    updateConfig({ queues: [...queues, newQueue] });
    showSuccess(`Queue "${queueName}" created successfully`);
  };

  const removeQueue = (index: number) => {
    const queueName = queues[index]?.name || 'queue';
    updateConfig({ queues: queues.filter((_: Queue, i: number) => i !== index) });
    setDeleteQueueIndex(null);
    showSuccess(`Queue "${queueName}" deleted successfully`);
  };

  const updateQueue = (index: number, field: string, value: any) => {
    const newQueues = [...queues];
    newQueues[index] = { ...newQueues[index], [field]: value };
    updateConfig({ queues: newQueues });
  };

  const addTopic = () => {
    // Generate unique name
    let topicName = 'new-topic';
    let counter = 1;
    const existingNames = topics.map((t: Topic) => t.name);
    while (existingNames.includes(topicName)) {
      topicName = `new-topic-${counter}`;
      counter++;
    }
    
    const newTopic: Topic = {
      name: topicName,
      namespace,
      maxSizeInMegabytes: DEFAULT_TOPIC_VALUES.maxSizeInMegabytes,
      defaultMessageTimeToLive: DEFAULT_TOPIC_VALUES.defaultMessageTimeToLive,
      enablePartitioning: DEFAULT_TOPIC_VALUES.enablePartitioning,
      subscriptions: [],
    };
    updateConfig({ topics: [...topics, newTopic] });
    showSuccess(`Topic "${topicName}" created successfully`);
  };

  const removeTopic = (index: number) => {
    const topicName = topics[index]?.name || 'topic';
    updateConfig({ topics: topics.filter((_: Topic, i: number) => i !== index) });
    setDeleteTopicIndex(null);
    showSuccess(`Topic "${topicName}" deleted successfully`);
  };

  const updateTopic = (index: number, field: string, value: any) => {
    // Validate numeric fields
    if (['maxSizeInMegabytes', 'defaultMessageTimeToLive', 'duplicateDetectionHistoryTimeWindow'].includes(field)) {
      const numValue = typeof value === 'string' ? Number(value) : value;
      const fieldName = field === 'maxSizeInMegabytes' ? 'Max Size' : 
                       field === 'defaultMessageTimeToLive' ? 'Message TTL' :
                       'Duplicate Detection History Time Window';
      
      if (field === 'maxSizeInMegabytes') {
        const error = validateNumericField(numValue, fieldName, 1, 5120);
        if (error) {
          showError(error);
          return;
        }
      } else if (field === 'defaultMessageTimeToLive') {
        const error = validateNumericField(numValue, fieldName, 1);
        if (error) {
          showError(error);
          return;
        }
      } else if (field === 'duplicateDetectionHistoryTimeWindow') {
        const error = validateNumericField(numValue, fieldName, 60, 86400);
        if (error) {
          showError(error);
          return;
        }
      }
    }
    
    const newTopics = [...topics];
    newTopics[index] = { ...newTopics[index], [field]: value };
    updateConfig({ topics: newTopics });
  };

  const addSubscription = (topicIndex: number) => {
    const topic = topics[topicIndex];
    if (topic) {
      // Generate unique name
      let subName = 'new-subscription';
      let counter = 1;
      const existingNames = (topic.subscriptions || []).map((s: { name: string }) => s.name);
      while (existingNames.includes(subName)) {
        subName = `new-subscription-${counter}`;
        counter++;
      }
      
      const newSub = {
        name: subName,
        maxDeliveryCount: DEFAULT_SUBSCRIPTION_VALUES.maxDeliveryCount,
        lockDuration: DEFAULT_SUBSCRIPTION_VALUES.lockDuration,
        enableDeadLetteringOnMessageExpiration: DEFAULT_SUBSCRIPTION_VALUES.enableDeadLetteringOnMessageExpiration,
        activeMessageCount: 0,
      };
      const updatedSubs = [...(topic.subscriptions || []), newSub];
      updateTopic(topicIndex, 'subscriptions', updatedSubs);
      showSuccess(`Subscription "${subName}" created successfully`);
    }
  };

  const removeSubscription = (topicIndex: number, subIndex: number) => {
    const topic = topics[topicIndex];
    if (topic && topic.subscriptions) {
      const subName = topic.subscriptions[subIndex]?.name || 'subscription';
      const updatedSubs = topic.subscriptions.filter((_: { name: string }, i: number) => i !== subIndex);
      updateTopic(topicIndex, 'subscriptions', updatedSubs);
      setDeleteSubscriptionIndex(null);
      showSuccess(`Subscription "${subName}" deleted successfully`);
    }
  };

  const updateSubscription = (topicIndex: number, subIndex: number, field: string, value: any) => {
    // Validate numeric fields
    if (['lockDuration', 'maxDeliveryCount'].includes(field)) {
      const numValue = typeof value === 'string' ? Number(value) : value;
      const fieldName = field === 'lockDuration' ? 'Lock Duration' : 'Max Delivery Count';
      
      if (field === 'lockDuration') {
        const error = validateNumericField(numValue, fieldName, 5, 300);
        if (error) {
          showError(error);
          return;
        }
      } else if (field === 'maxDeliveryCount') {
        const error = validateNumericField(numValue, fieldName, 1, 2147483647);
        if (error) {
          showError(error);
          return;
        }
      }
    }
    
    const topic = topics[topicIndex];
    if (topic && topic.subscriptions) {
      const updatedSubs = [...topic.subscriptions];
      updatedSubs[subIndex] = { ...updatedSubs[subIndex], [field]: value };
      updateTopic(topicIndex, 'subscriptions', updatedSubs);
    }
  };

  const totalMessages = queues.reduce((sum: number, q: Queue) => sum + (q.activeMessageCount || 0), 0) +
    topics.reduce((sum: number, t: Topic) => sum + (t.subscriptions?.reduce((s: number, sub: { activeMessageCount?: number }) => s + (sub.activeMessageCount || 0), 0) || 0), 0);

  // Get list of available queues and topics for auto-forwarding
  const getAvailableForwardTargets = (excludeQueueName?: string, excludeTopicName?: string): Array<{ value: string; label: string; type: 'queue' | 'topic' }> => {
    const targets: Array<{ value: string; label: string; type: 'queue' | 'topic' }> = [];
    
    queues.forEach((q: Queue) => {
      if (q.name !== excludeQueueName) {
        targets.push({ value: q.name, label: `${q.name} (Queue)`, type: 'queue' });
      }
    });
    
    topics.forEach((t: Topic) => {
      if (t.name !== excludeTopicName) {
        targets.push({ value: t.name, label: `${t.name} (Topic)`, type: 'topic' });
      }
    });
    
    return targets;
  };

  // Get messages for viewing
  const getMessagesForView = (): {
    active: ServiceBusMessage[];
    locked: ServiceBusMessage[];
    scheduled: ServiceBusMessage[];
    deadLetter: ServiceBusMessage[];
    deferred: ServiceBusMessage[];
  } | null => {
    if (!viewingMessages) return null;
    
    try {
      const routingEngine = emulationEngine.getAzureServiceBusRoutingEngine(componentId);
      if (!routingEngine) {
        showError('Routing engine not available. Please ensure the component is properly configured.');
        return null;
      }

      if (viewingMessages.type === 'queue' && viewingMessages.queueName) {
        return routingEngine.getQueueMessages(viewingMessages.queueName);
      } else if (viewingMessages.type === 'subscription' && viewingMessages.topicName && viewingMessages.subscriptionName) {
        const result = routingEngine.getSubscriptionMessages(viewingMessages.topicName, viewingMessages.subscriptionName);
        return {
          ...result,
          scheduled: [], // Subscriptions don't have scheduled messages directly
        };
      }
    } catch (error) {
      console.error('Error getting messages for view:', error);
      showError('Failed to retrieve messages. Please try again.');
      return null;
    }

    return null;
  };

  // Handle message operations
  const handleCompleteMessage = (lockToken: string) => {
    if (!viewingMessages) return;
    
    try {
      const routingEngine = emulationEngine.getAzureServiceBusRoutingEngine(componentId);
      if (!routingEngine) {
        showError('Routing engine not available. Please ensure the component is properly configured.');
        return;
      }

      const queueOrSubscriptionId = viewingMessages.type === 'queue'
        ? viewingMessages.queueName!
        : `${viewingMessages.topicName}/subscriptions/${viewingMessages.subscriptionName}`;

      const success = routingEngine.completeMessage(queueOrSubscriptionId, lockToken);
      if (success) {
        showSuccess('Message completed successfully');
      } else {
        showError('Failed to complete message. Lock may have expired.');
      }
    } catch (error) {
      console.error('Error completing message:', error);
      showError('Failed to complete message. Please try again.');
    }
  };

  const handleAbandonMessage = (lockToken: string) => {
    if (!viewingMessages) return;
    
    try {
      const routingEngine = emulationEngine.getAzureServiceBusRoutingEngine(componentId);
      if (!routingEngine) {
        showError('Routing engine not available. Please ensure the component is properly configured.');
        return;
      }

      const queueOrSubscriptionId = viewingMessages.type === 'queue'
        ? viewingMessages.queueName!
        : `${viewingMessages.topicName}/subscriptions/${viewingMessages.subscriptionName}`;

      const success = routingEngine.abandonMessage(queueOrSubscriptionId, lockToken);
      if (success) {
        showSuccess('Message abandoned successfully');
      } else {
        showError('Failed to abandon message. Lock may have expired.');
      }
    } catch (error) {
      console.error('Error abandoning message:', error);
      showError('Failed to abandon message. Please try again.');
    }
  };

  const handleDeferMessage = (lockToken: string) => {
    if (!viewingMessages) return;
    
    try {
      const routingEngine = emulationEngine.getAzureServiceBusRoutingEngine(componentId);
      if (!routingEngine) {
        showError('Routing engine not available. Please ensure the component is properly configured.');
        return;
      }

      const queueOrSubscriptionId = viewingMessages.type === 'queue'
        ? viewingMessages.queueName!
        : `${viewingMessages.topicName}/subscriptions/${viewingMessages.subscriptionName}`;

      const success = routingEngine.deferMessage(queueOrSubscriptionId, lockToken);
      if (success) {
        showSuccess('Message deferred successfully');
      } else {
        showError('Failed to defer message. Lock may have expired.');
      }
    } catch (error) {
      console.error('Error deferring message:', error);
      showError('Failed to defer message. Please try again.');
    }
  };

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
          <TabsList className="flex-wrap h-auto min-h-[36px] w-full justify-start gap-1">
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
                {/* Search for queues */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search queues..."
                      value={queueSearchQuery}
                      onChange={(e) => setQueueSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                    {queueSearchQuery && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1 h-7 w-7 p-0"
                        onClick={() => setQueueSearchQuery('')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  {queues
                    .filter((queue: Queue) => 
                      !queueSearchQuery || 
                      queue.name.toLowerCase().includes(queueSearchQuery.toLowerCase())
                    )
                    .map((queue: Queue, index: number) => (
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
                            onClick={() => setDeleteQueueIndex(index)}
                            disabled={queues.length === 1}
                            className="ml-4"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="grid grid-cols-3 gap-4 flex-1">
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingMessages({ type: 'queue', queueName: queue.name })}
                            className="ml-4"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Messages
                          </Button>
                        </div>
                        {(queue as any).sentCount !== undefined && (
                          <div className="grid grid-cols-4 gap-4 pt-2 border-t">
                            <div>
                              <p className="text-xs text-muted-foreground">Sent</p>
                              <p className="text-sm font-medium">{(queue as any).sentCount || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Received</p>
                              <p className="text-sm font-medium">{(queue as any).receivedCount || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Completed</p>
                              <p className="text-sm font-medium">{(queue as any).completedCount || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Abandoned</p>
                              <p className="text-sm font-medium">{(queue as any).abandonedCount || 0}</p>
                            </div>
                          </div>
                        )}
                        <Separator />
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label>Max Size (MB)</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Maximum size of the queue in megabytes</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              type="number"
                              value={queue.maxSizeInMegabytes}
                              onChange={(e) => updateQueue(index, 'maxSizeInMegabytes', Number(e.target.value))}
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label>Message TTL (seconds)</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Default time-to-live for messages in seconds. Messages expire after this time.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              type="number"
                              value={queue.defaultMessageTimeToLive}
                              onChange={(e) => updateQueue(index, 'defaultMessageTimeToLive', Number(e.target.value))}
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label>Lock Duration (seconds)</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Duration for which a message is locked after being received (peek-lock pattern). Must be between 5 and 300 seconds.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              type="number"
                              value={queue.lockDuration}
                              onChange={(e) => updateQueue(index, 'lockDuration', Number(e.target.value))}
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label>Max Delivery Count</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Maximum number of times a message can be delivered. After exceeding this count, the message is moved to dead letter queue.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              type="number"
                              value={queue.maxDeliveryCount}
                              onChange={(e) => updateQueue(index, 'maxDeliveryCount', Number(e.target.value))}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Label>Enable Sessions</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Enable session support for ordered message processing. Messages with the same session ID are processed in order.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Switch
                              checked={queue.enableSessions}
                              onCheckedChange={(checked) => updateQueue(index, 'enableSessions', checked)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Label>Enable Partitioning</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Enable partitioning to improve throughput and availability by distributing messages across multiple message brokers.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Switch
                              checked={queue.enablePartitioning}
                              onCheckedChange={(checked) => updateQueue(index, 'enablePartitioning', checked)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Label>Dead Letter on Expiration</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Automatically move expired messages to the dead letter queue instead of discarding them.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Switch
                              checked={queue.enableDeadLetteringOnMessageExpiration}
                              onCheckedChange={(checked) => updateQueue(index, 'enableDeadLetteringOnMessageExpiration', checked)}
                            />
                          </div>
                          <Separator />
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Label>Enable Duplicate Detection</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Enable duplicate detection to automatically remove duplicate messages based on MessageId within the specified time window.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Switch
                              checked={queue.enableDuplicateDetection || false}
                              onCheckedChange={(checked) => updateQueue(index, 'enableDuplicateDetection', checked)}
                            />
                          </div>
                          {queue.enableDuplicateDetection && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Label>Duplicate Detection History Time Window (seconds)</Label>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Time window (in seconds) during which duplicate messages are detected and removed. Range: 60-86400 seconds (1 minute to 1 day).</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <Input
                                type="number"
                                value={queue.duplicateDetectionHistoryTimeWindow || 300}
                                onChange={(e) => updateQueue(index, 'duplicateDetectionHistoryTimeWindow', Number(e.target.value))}
                                placeholder="300"
                                min={60}
                                max={86400}
                              />
                              <p className="text-xs text-muted-foreground">
                                Time window to detect duplicate messages (60-86400 seconds, default: 300)
                              </p>
                            </div>
                          )}
                          <Separator />
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Label className="text-base font-semibold">Auto-Forwarding</Label>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Automatically forward messages to another queue or topic. Useful for message routing and distribution patterns.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Automatically forward messages to another queue or topic
                              </p>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Label>Forward To</Label>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Messages completed from this queue will be automatically forwarded to the selected queue or topic.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <Select
                                value={queue.forwardTo || '__none__'}
                                onValueChange={(value) => updateQueue(index, 'forwardTo', value === '__none__' ? undefined : value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select queue or topic (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">None (No forwarding)</SelectItem>
                                  {getAvailableForwardTargets(queue.name).map(target => (
                                    <SelectItem key={target.value} value={target.value}>
                                      {target.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                Messages completed from this queue will be forwarded to the selected destination
                              </p>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Label>Forward Dead Letter Messages To</Label>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Dead letter messages will be forwarded to the selected destination instead of being stored in the dead letter queue.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <Select
                                value={queue.forwardDeadLetterMessagesTo || '__none__'}
                                onValueChange={(value) => updateQueue(index, 'forwardDeadLetterMessagesTo', value === '__none__' ? undefined : value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select queue or topic (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">None (Store in DLQ)</SelectItem>
                                  {getAvailableForwardTargets(queue.name).map(target => (
                                    <SelectItem key={target.value} value={target.value}>
                                      {target.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                Dead letter messages will be forwarded to the selected destination instead of being stored in DLQ
                              </p>
                            </div>
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
                {/* Search for topics */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search topics..."
                      value={topicSearchQuery}
                      onChange={(e) => setTopicSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                    {topicSearchQuery && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1 h-7 w-7 p-0"
                        onClick={() => setTopicSearchQuery('')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  {topics
                    .filter((topic: Topic) => 
                      !topicSearchQuery || 
                      topic.name.toLowerCase().includes(topicSearchQuery.toLowerCase())
                    )
                    .map((topic: Topic, index: number) => (
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
                            onClick={() => setDeleteTopicIndex(index)}
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
                            <div className="flex items-center gap-2">
                              <Label>Max Size (MB)</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Maximum size of the topic in megabytes</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              type="number"
                              value={topic.maxSizeInMegabytes}
                              onChange={(e) => updateTopic(index, 'maxSizeInMegabytes', Number(e.target.value))}
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label>Message TTL (seconds)</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Default time-to-live for messages in seconds. Messages expire after this time.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              type="number"
                              value={topic.defaultMessageTimeToLive}
                              onChange={(e) => updateTopic(index, 'defaultMessageTimeToLive', Number(e.target.value))}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Label>Enable Partitioning</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Enable partitioning to improve throughput and availability by distributing messages across multiple message brokers.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Switch
                              checked={topic.enablePartitioning}
                              onCheckedChange={(checked) => updateTopic(index, 'enablePartitioning', checked)}
                            />
                          </div>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Label>Enable Duplicate Detection</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Enable duplicate detection to automatically remove duplicate messages based on MessageId within the specified time window.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Switch
                              checked={topic.enableDuplicateDetection || false}
                              onCheckedChange={(checked) => updateTopic(index, 'enableDuplicateDetection', checked)}
                            />
                          </div>
                          {topic.enableDuplicateDetection && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Label>Duplicate Detection History Time Window (seconds)</Label>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Time window (in seconds) during which duplicate messages are detected and removed. Range: 60-86400 seconds (1 minute to 1 day).</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <Input
                                type="number"
                                value={topic.duplicateDetectionHistoryTimeWindow || 300}
                                onChange={(e) => updateTopic(index, 'duplicateDetectionHistoryTimeWindow', Number(e.target.value))}
                                placeholder="300"
                                min={60}
                                max={86400}
                              />
                              <p className="text-xs text-muted-foreground">
                                Time window to detect duplicate messages (60-86400 seconds, default: 300)
                              </p>
                            </div>
                          )}
                          <Separator />
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Label className="text-base font-semibold">Auto-Forwarding</Label>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Automatically forward messages to another queue or topic. Useful for message routing and distribution patterns.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Automatically forward messages to another queue or topic
                              </p>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Label>Forward To</Label>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Messages published to this topic will be automatically forwarded to the selected queue or topic.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <Select
                                value={topic.forwardTo || '__none__'}
                                onValueChange={(value) => updateTopic(index, 'forwardTo', value === '__none__' ? undefined : value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select queue or topic (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">None (No forwarding)</SelectItem>
                                  {getAvailableForwardTargets(undefined, topic.name).map(target => (
                                    <SelectItem key={target.value} value={target.value}>
                                      {target.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                Messages published to this topic will be forwarded to the selected destination
                              </p>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Label>Forward Dead Letter Messages To</Label>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Dead letter messages will be forwarded to the selected destination instead of being stored in the dead letter queue.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <Select
                                value={topic.forwardDeadLetterMessagesTo || '__none__'}
                                onValueChange={(value) => updateTopic(index, 'forwardDeadLetterMessagesTo', value === '__none__' ? undefined : value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select queue or topic (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">None (Store in DLQ)</SelectItem>
                                  {getAvailableForwardTargets(undefined, topic.name).map(target => (
                                    <SelectItem key={target.value} value={target.value}>
                                      {target.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                Dead letter messages will be forwarded to the selected destination instead of being stored in DLQ
                              </p>
                            </div>
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
                              {topic.subscriptions.map((sub: { name: string; maxDeliveryCount: number; lockDuration: number; enableDeadLetteringOnMessageExpiration: boolean; activeMessageCount?: number; filter?: SubscriptionFilter; forwardTo?: string; forwardDeadLetterMessagesTo?: string }, subIndex: number) => (
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
                                        onClick={() => setDeleteSubscriptionIndex({ topicIndex: index, subIndex })}
                                        className="ml-4"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="grid grid-cols-3 gap-4 flex-1">
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-1">Active Messages</p>
                                          <p className="text-lg font-semibold">{sub.activeMessageCount || 0}</p>
                                        </div>
                                        {(sub as any).deadLetterMessageCount !== undefined && (
                                          <div>
                                            <p className="text-xs text-muted-foreground mb-1">Dead Letter</p>
                                            <p className="text-lg font-semibold">{(sub as any).deadLetterMessageCount || 0}</p>
                                          </div>
                                        )}
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setViewingMessages({ type: 'subscription', topicName: topic.name, subscriptionName: sub.name })}
                                        className="ml-4"
                                      >
                                        <Eye className="h-4 w-4 mr-2" />
                                        View Messages
                                      </Button>
                                    </div>
                                    {(sub as any).sentCount !== undefined && (
                                      <div className="grid grid-cols-4 gap-4 pt-2 border-t">
                                        <div>
                                          <p className="text-xs text-muted-foreground">Sent</p>
                                          <p className="text-sm font-medium">{(sub as any).sentCount || 0}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-muted-foreground">Received</p>
                                          <p className="text-sm font-medium">{(sub as any).receivedCount || 0}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-muted-foreground">Completed</p>
                                          <p className="text-sm font-medium">{(sub as any).completedCount || 0}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-muted-foreground">Abandoned</p>
                                          <p className="text-sm font-medium">{(sub as any).abandonedCount || 0}</p>
                                        </div>
                                      </div>
                                    )}
                                    <Separator />
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Label>Lock Duration (seconds)</Label>
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Duration for which a message is locked after being received (peek-lock pattern). Must be between 5 and 300 seconds.</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </div>
                                        <Input
                                          type="number"
                                          value={sub.lockDuration}
                                          onChange={(e) => updateSubscription(index, subIndex, 'lockDuration', Number(e.target.value))}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Label>Max Delivery Count</Label>
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Maximum number of times a message can be delivered. After exceeding this count, the message is moved to dead letter queue.</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </div>
                                        <Input
                                          type="number"
                                          value={sub.maxDeliveryCount}
                                          onChange={(e) => updateSubscription(index, subIndex, 'maxDeliveryCount', Number(e.target.value))}
                                        />
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Label>Dead Letter on Expiration</Label>
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>Automatically move expired messages to the dead letter queue instead of discarding them.</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      </div>
                                      <Switch
                                        checked={sub.enableDeadLetteringOnMessageExpiration}
                                        onCheckedChange={(checked) => updateSubscription(index, subIndex, 'enableDeadLetteringOnMessageExpiration', checked)}
                                      />
                                    </div>
                                    <Separator />
                                    <div className="space-y-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Label className="text-base font-semibold">Subscription Filter</Label>
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Filter messages that this subscription receives. Use SQL Filter for property-based filtering or Correlation Filter for correlation ID and custom properties.</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Label>Filter Type</Label>
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Select filter type: No Filter (all messages), SQL Filter (property-based expressions), or Correlation Filter (correlation ID and properties).</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </div>
                                        <Select
                                          value={sub.filter?.type || 'none'}
                                          onValueChange={(value) => {
                                            const filter: SubscriptionFilter = {
                                              type: value as 'sql' | 'correlation' | 'none',
                                              ...(value === 'sql' ? { sqlExpression: sub.filter?.sqlExpression || '' } : {}),
                                              ...(value === 'correlation' ? { 
                                                correlationId: sub.filter?.correlationId || '',
                                                properties: sub.filter?.properties || {}
                                              } : {}),
                                            };
                                            updateSubscription(index, subIndex, 'filter', filter);
                                          }}
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select filter type" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">No Filter (All Messages)</SelectItem>
                                            <SelectItem value="sql">SQL Filter</SelectItem>
                                            <SelectItem value="correlation">Correlation Filter</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      {sub.filter?.type === 'sql' && (
                                        <div className="space-y-2">
                                          <div className="flex items-center gap-2">
                                            <Label>SQL Expression</Label>
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p>SQL-like expression to filter messages based on message properties. Supports: =, !=, &gt;, &lt;, &gt;=, &lt;=, AND, OR operators.</p>
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          </div>
                                          <Textarea
                                            value={sub.filter.sqlExpression || ''}
                                            onChange={(e) => {
                                              const filter: SubscriptionFilter = {
                                                ...sub.filter!,
                                                sqlExpression: e.target.value,
                                              };
                                              updateSubscription(index, subIndex, 'filter', filter);
                                            }}
                                            placeholder="user.type = 'premium' AND amount > 100"
                                            rows={3}
                                          />
                                          <p className="text-xs text-muted-foreground">
                                            Supports: =, !=, &gt;, &lt;, &gt;=, &lt;=, AND, OR
                                          </p>
                                        </div>
                                      )}
                                      {sub.filter?.type === 'correlation' && (
                                        <div className="space-y-4">
                                          <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                              <Label>Correlation ID</Label>
                                              <TooltipProvider>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                                  </TooltipTrigger>
                                                  <TooltipContent>
                                                    <p>Filter messages by correlation ID. Only messages with matching correlation ID will be delivered to this subscription.</p>
                                                  </TooltipContent>
                                                </Tooltip>
                                              </TooltipProvider>
                                            </div>
                                            <Input
                                              value={sub.filter.correlationId || ''}
                                              onChange={(e) => {
                                                const filter: SubscriptionFilter = {
                                                  ...sub.filter!,
                                                  correlationId: e.target.value,
                                                };
                                                updateSubscription(index, subIndex, 'filter', filter);
                                              }}
                                              placeholder="correlation-id-value"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                              <Label>Properties (key=value, one per line)</Label>
                                              <TooltipProvider>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                                  </TooltipTrigger>
                                                  <TooltipContent>
                                                    <p>Filter messages by custom properties. Format: key=value, one per line. Messages must match all specified properties.</p>
                                                  </TooltipContent>
                                                </Tooltip>
                                              </TooltipProvider>
                                            </div>
                                            <Textarea
                                              value={sub.filter.properties ? Object.entries(sub.filter.properties).map(([k, v]) => `${k}=${v}`).join('\n') : ''}
                                              onChange={(e) => {
                                                const lines = e.target.value.split('\n').filter(l => l.trim());
                                                const properties: Record<string, string> = {};
                                                for (const line of lines) {
                                                  const [key, ...valueParts] = line.split('=');
                                                  if (key && valueParts.length > 0) {
                                                    properties[key.trim()] = valueParts.join('=').trim();
                                                  }
                                                }
                                                const filter: SubscriptionFilter = {
                                                  ...sub.filter!,
                                                  properties,
                                                };
                                                updateSubscription(index, subIndex, 'filter', filter);
                                              }}
                                              placeholder="key1=value1&#10;key2=value2"
                                              rows={3}
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <Separator />
                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Label className="text-base font-semibold">Auto-Forwarding</Label>
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Automatically forward messages to another queue or topic. Useful for message routing and distribution patterns.</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                          Automatically forward messages to another queue or topic
                                        </p>
                                      </div>
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Label>Forward To</Label>
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Messages completed from this subscription will be automatically forwarded to the selected queue or topic.</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </div>
                                        <Select
                                          value={sub.forwardTo || '__none__'}
                                          onValueChange={(value) => updateSubscription(index, subIndex, 'forwardTo', value === '__none__' ? undefined : value)}
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select queue or topic (optional)" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="__none__">None (No forwarding)</SelectItem>
                                            {getAvailableForwardTargets().map(target => (
                                              <SelectItem key={target.value} value={target.value}>
                                                {target.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">
                                          Messages completed from this subscription will be forwarded to the selected destination
                                        </p>
                                      </div>
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Label>Forward Dead Letter Messages To</Label>
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Dead letter messages will be forwarded to the selected destination instead of being stored in the dead letter queue.</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </div>
                                        <Select
                                          value={sub.forwardDeadLetterMessagesTo || '__none__'}
                                          onValueChange={(value) => updateSubscription(index, subIndex, 'forwardDeadLetterMessagesTo', value === '__none__' ? undefined : value)}
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select queue or topic (optional)" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="__none__">None (Store in DLQ)</SelectItem>
                                            {getAvailableForwardTargets().map(target => (
                                              <SelectItem key={target.value} value={target.value}>
                                                {target.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">
                                          Dead letter messages will be forwarded to the selected destination instead of being stored in DLQ
                                        </p>
                                      </div>
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
                  <div className="flex items-center gap-2">
                    <Label>Namespace</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Azure Service Bus namespace (e.g., my-namespace.servicebus.windows.net). This is the root address for all Service Bus entities.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    value={namespace}
                    onChange={(e) => updateConfig({ namespace: e.target.value })}
                    placeholder="my-namespace.servicebus.windows.net"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Connection String</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Azure Service Bus connection string (SAS or managed identity). Format: Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=...</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
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

        {/* Delete Queue Confirmation Dialog */}
        <AlertDialog open={deleteQueueIndex !== null} onOpenChange={(open) => !open && setDeleteQueueIndex(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Queue</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete queue "{queues[deleteQueueIndex || 0]?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteQueueIndex !== null && removeQueue(deleteQueueIndex)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Topic Confirmation Dialog */}
        <AlertDialog open={deleteTopicIndex !== null} onOpenChange={(open) => !open && setDeleteTopicIndex(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Topic</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete topic "{topics[deleteTopicIndex || 0]?.name}"? This will also delete all subscriptions. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteTopicIndex !== null && removeTopic(deleteTopicIndex)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Subscription Confirmation Dialog */}
        <AlertDialog open={deleteSubscriptionIndex !== null} onOpenChange={(open) => !open && setDeleteSubscriptionIndex(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Subscription</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete subscription "{topics[deleteSubscriptionIndex?.topicIndex || 0]?.subscriptions?.[deleteSubscriptionIndex?.subIndex || 0]?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteSubscriptionIndex && removeSubscription(deleteSubscriptionIndex.topicIndex, deleteSubscriptionIndex.subIndex)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* View Messages Dialog */}
        <Dialog open={viewingMessages !== null} onOpenChange={(open) => !open && setViewingMessages(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Messages: {viewingMessages?.type === 'queue' 
                  ? viewingMessages.queueName 
                  : `${viewingMessages?.topicName}/${viewingMessages?.subscriptionName}`}
              </DialogTitle>
              <DialogDescription>
                View and manage messages in {viewingMessages?.type === 'queue' ? 'queue' : 'subscription'}
              </DialogDescription>
            </DialogHeader>
            
            {(() => {
              const messages = getMessagesForView();
              if (!messages) {
                return <div className="text-center py-8 text-muted-foreground">No messages available</div>;
              }

              // Filter messages based on search and status
              const allMessages = [
                ...messages.active.map(m => ({ ...m, status: 'active' as const })),
                ...messages.locked.map(m => ({ ...m, status: 'locked' as const })),
                ...messages.scheduled.map(m => ({ ...m, status: 'scheduled' as const })),
                ...messages.deadLetter.map(m => ({ ...m, status: 'deadLetter' as const })),
                ...messages.deferred.map(m => ({ ...m, status: 'deferred' as const })),
              ];

              const filteredMessages = allMessages.filter(msg => {
                // Status filter
                if (filterStatus !== 'all' && msg.status !== filterStatus) {
                  return false;
                }

                // Search filter
                if (searchQuery) {
                  const query = searchQuery.toLowerCase();
                  const payloadStr = typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload);
                  return (
                    msg.messageId.toLowerCase().includes(query) ||
                    payloadStr.toLowerCase().includes(query) ||
                    (msg.properties && JSON.stringify(msg.properties).toLowerCase().includes(query))
                  );
                }

                return true;
              });

              return (
                <div className="space-y-4">
                  {/* Search and Filter Controls */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search messages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                      />
                      {searchQuery && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1 h-7 w-7 p-0"
                          onClick={() => setSearchQuery('')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Messages</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="locked">Locked</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="deadLetter">Dead Letter</SelectItem>
                        <SelectItem value="deferred">Deferred</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Messages List */}
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                    {filteredMessages.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {searchQuery || filterStatus !== 'all' ? 'No messages match the filters' : 'No messages available'}
                      </div>
                    ) : (
                      filteredMessages.map((msg, idx) => (
                        <Card key={idx} className="p-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant={
                                  msg.status === 'active' ? 'default' :
                                  msg.status === 'locked' ? 'secondary' :
                                  msg.status === 'scheduled' ? 'outline' :
                                  msg.status === 'deadLetter' ? 'destructive' :
                                  'secondary'
                                }>
                                  {msg.status}
                                </Badge>
                                <span className="text-sm font-mono text-muted-foreground">{msg.messageId}</span>
                              </div>
                              {msg.lockToken && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCompleteMessage(msg.lockToken!)}
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    Complete
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleAbandonMessage(msg.lockToken!)}
                                  >
                                    <X className="h-3 w-3 mr-1" />
                                    Abandon
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeferMessage(msg.lockToken!)}
                                  >
                                    <Clock className="h-3 w-3 mr-1" />
                                    Defer
                                  </Button>
                                </div>
                              )}
                            </div>
                            <div className="text-sm space-y-1">
                              <div><span className="font-medium">Size:</span> {msg.size} bytes</div>
                              <div><span className="font-medium">Enqueued:</span> {new Date(msg.enqueuedTime).toLocaleString()}</div>
                              {msg.lockedUntil && (
                                <div><span className="font-medium">Locked Until:</span> {new Date(msg.lockedUntil).toLocaleString()}</div>
                              )}
                              {msg.deliveryCount > 0 && (
                                <div><span className="font-medium">Delivery Count:</span> {msg.deliveryCount}</div>
                              )}
                            </div>
                            <div className="mt-2">
                              <p className="text-xs font-medium mb-1">Payload:</p>
                              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                {typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload, null, 2)}
                              </pre>
                            </div>
                            {msg.properties && Object.keys(msg.properties).length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium mb-1">Properties:</p>
                                <div className="text-xs bg-muted p-2 rounded">
                                  {Object.entries(msg.properties).map(([key, value]) => (
                                    <div key={key} className="flex gap-2">
                                      <span className="font-medium">{key}:</span>
                                      <span>{String(value)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </Card>
                      ))
                    )}
                  </div>

                  {/* Summary */}
                  <div className="grid grid-cols-5 gap-2 pt-4 border-t text-sm">
                    <div>
                      <p className="text-muted-foreground">Active</p>
                      <p className="font-semibold">{messages.active.length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Locked</p>
                      <p className="font-semibold">{messages.locked.length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Scheduled</p>
                      <p className="font-semibold">{messages.scheduled.length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Dead Letter</p>
                      <p className="font-semibold">{messages.deadLetter.length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Deferred</p>
                      <p className="font-semibold">{messages.deferred.length}</p>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewingMessages(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}


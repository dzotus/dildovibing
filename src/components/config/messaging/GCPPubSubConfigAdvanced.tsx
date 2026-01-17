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
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  MessageSquare, 
  Activity, 
  Settings, 
  Plus, 
  Trash2,
  Key,
  Users,
  Send,
  HelpCircle,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
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
import { showSuccess, showError } from '@/utils/toast';
import { debounce } from '@/utils/debounce';
import {
  DEFAULT_GCP_PROJECT_ID,
  DEFAULT_TOPIC_VALUES,
  DEFAULT_SUBSCRIPTION_VALUES,
  NAMING_RULES,
  VALIDATION_RANGES,
  METRICS_UPDATE_CONFIG
} from '@/core/constants/gcpPubSub';

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
  publishedCount?: number;
}

interface SubscriptionFilter {
  type: 'attributes' | 'none';
  attributes?: Record<string, string>;
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
  filter?: SubscriptionFilter;
  deadLetterTopic?: string;
  maxDeliveryAttempts?: number;
  messageCount?: number;
  unackedMessageCount?: number;
  deliveredCount?: number;
  acknowledgedCount?: number;
  nackedCount?: number;
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

  // Update ref when node changes
  useEffect(() => {
    nodeRef.current = node;
  }, [node]);

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as GCPPubSubConfig;
  const projectId = config.projectId || DEFAULT_GCP_PROJECT_ID;
  const credentials = config.credentials || '';
  const topics = config.topics || [];
  const subscriptions = config.subscriptions || [];
  
  // Performance tuning parameters from config or defaults
  const metricsUpdateInterval = config.metricsUpdateInterval ?? METRICS_UPDATE_CONFIG.SYNC_INTERVAL_MS;
  const metricsDebounceDelay = config.metricsDebounceDelay ?? METRICS_UPDATE_CONFIG.DEBOUNCE_DELAY_MS;

  const [editingTopicIndex, setEditingTopicIndex] = useState<number | null>(null);
  const [editingSubIndex, setEditingSubIndex] = useState<number | null>(null);
  const [deleteTopicIndex, setDeleteTopicIndex] = useState<number | null>(null);
  const [deleteSubIndex, setDeleteSubIndex] = useState<number | null>(null);
  
  // Search and filter state
  const [topicSearchQuery, setTopicSearchQuery] = useState('');
  const [subSearchQuery, setSubSearchQuery] = useState('');
  const [topicFilterStatus, setTopicFilterStatus] = useState<'all' | 'with-messages' | 'empty'>('all');
  const [subFilterStatus, setSubFilterStatus] = useState<'all' | 'with-messages' | 'with-unacked' | 'empty'>('all');
  const [topicSortField, setTopicSortField] = useState<'name' | 'messageCount' | 'publishedCount'>('name');
  const [topicSortDirection, setTopicSortDirection] = useState<'asc' | 'desc'>('asc');
  const [subSortField, setSubSortField] = useState<'name' | 'messageCount' | 'unackedMessageCount'>('name');
  const [subSortDirection, setSubSortDirection] = useState<'asc' | 'desc'>('asc');

  // Validation functions
  const validateProjectId = (value: string): string | null => {
    if (!value) return 'Project ID is required';
    if (value.length < NAMING_RULES.PROJECT_ID.MIN_LENGTH || value.length > NAMING_RULES.PROJECT_ID.MAX_LENGTH) {
      return `Project ID must be ${NAMING_RULES.PROJECT_ID.MIN_LENGTH}-${NAMING_RULES.PROJECT_ID.MAX_LENGTH} characters`;
    }
    if (!NAMING_RULES.PROJECT_ID.PATTERN.test(value)) {
      return 'Project ID can only contain lowercase letters, numbers, and hyphens';
    }
    return null;
  };

  const validateTopicSubscriptionName = (name: string, existingNames: string[], currentIndex?: number): string | null => {
    if (!name) return 'Name is required';
    if (name.length < NAMING_RULES.TOPIC_SUBSCRIPTION.MIN_LENGTH || name.length > NAMING_RULES.TOPIC_SUBSCRIPTION.MAX_LENGTH) {
      return `Name must be ${NAMING_RULES.TOPIC_SUBSCRIPTION.MIN_LENGTH}-${NAMING_RULES.TOPIC_SUBSCRIPTION.MAX_LENGTH} characters`;
    }
    if (!NAMING_RULES.TOPIC_SUBSCRIPTION.PATTERN.test(name)) {
      return 'Name can only contain lowercase letters, numbers, hyphens, and underscores';
    }
    // Check uniqueness
    const duplicateIndex = existingNames.findIndex((n, i) => n === name && i !== currentIndex);
    if (duplicateIndex !== -1) {
      return 'Name must be unique';
    }
    return null;
  };

  const validateNumericField = (value: number, field: 'ackDeadline' | 'retention', fieldName: string): string | null => {
    if (isNaN(value) || value < 0) {
      return `${fieldName} must be a positive number`;
    }
    if (field === 'ackDeadline') {
      if (value < VALIDATION_RANGES.ACK_DEADLINE_SECONDS.MIN || value > VALIDATION_RANGES.ACK_DEADLINE_SECONDS.MAX) {
        return `Ack deadline must be between ${VALIDATION_RANGES.ACK_DEADLINE_SECONDS.MIN} and ${VALIDATION_RANGES.ACK_DEADLINE_SECONDS.MAX} seconds`;
      }
    } else if (field === 'retention') {
      if (value < VALIDATION_RANGES.MESSAGE_RETENTION_DURATION.MIN || value > VALIDATION_RANGES.MESSAGE_RETENTION_DURATION.MAX) {
        return `Message retention must be between ${VALIDATION_RANGES.MESSAGE_RETENTION_DURATION.MIN} and ${VALIDATION_RANGES.MESSAGE_RETENTION_DURATION.MAX} seconds`;
      }
    }
    return null;
  };

  // Debounced update function to prevent excessive updates
  const debouncedUpdateMetrics = useRef(
    debounce((...args: any[]) => {
      const [updatedTopics, updatedSubscriptions, currentConfig] = args;
      if (!nodeRef.current) return;
      
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
    }, metricsDebounceDelay)
  ).current;

  // Sync metrics from routing engine in real-time
  useEffect(() => {
    if (!node || (topics.length === 0 && subscriptions.length === 0) || !isRunning) {
      return;
    }
    
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;
    
    const syncMetrics = () => {
      if (!isMounted) return;
      
      try {
        const routingEngine = emulationEngine.getPubSubRoutingEngine(componentId);
        if (!routingEngine || !nodeRef.current) return;

        const allTopicMetrics = routingEngine.getAllTopicMetrics();
        const allSubscriptionMetrics = routingEngine.getAllSubscriptionMetrics();
        
        const currentConfig = (nodeRef.current.data.config as any) || {};
        const currentTopics = currentConfig.topics || [];
        const currentSubscriptions = currentConfig.subscriptions || [];
        
        // Early exit if no topics or subscriptions
        if (currentTopics.length === 0 && currentSubscriptions.length === 0) return;
        
        let metricsChanged = false;
        
        // Update topic metrics - only update if values actually changed
        const updatedTopics = currentTopics.map((topic: any) => {
          const metrics = allTopicMetrics.get(topic.name);
          if (metrics) {
            // Check if any metric changed before creating new object
            const hasChanges = 
              metrics.messageCount !== (topic.messageCount || 0) ||
              metrics.byteCount !== (topic.byteCount || 0) ||
              metrics.publishedCount !== (topic.publishedCount || 0);
            
            if (hasChanges) {
              metricsChanged = true;
              return {
                ...topic,
                messageCount: metrics.messageCount,
                byteCount: metrics.byteCount,
                publishedCount: metrics.publishedCount,
              };
            }
          }
          return topic;
        });
        
        // Update subscription metrics - only update if values actually changed
        const updatedSubscriptions = currentSubscriptions.map((sub: any) => {
          const metrics = allSubscriptionMetrics.get(sub.name);
          if (metrics) {
            // Check if any metric changed before creating new object
            const hasChanges = 
              metrics.messageCount !== (sub.messageCount || 0) ||
              metrics.unackedMessageCount !== (sub.unackedMessageCount || 0) ||
              metrics.deliveredCount !== (sub.deliveredCount || 0) ||
              metrics.acknowledgedCount !== (sub.acknowledgedCount || 0) ||
              metrics.nackedCount !== (sub.nackedCount || 0);
            
            if (hasChanges) {
              metricsChanged = true;
              return {
                ...sub,
                messageCount: metrics.messageCount,
                unackedMessageCount: metrics.unackedMessageCount,
                deliveredCount: metrics.deliveredCount,
                acknowledgedCount: metrics.acknowledgedCount,
                nackedCount: metrics.nackedCount,
              };
            }
          }
          return sub;
        });

        // Only update if metrics actually changed
        if (metricsChanged && nodeRef.current) {
          debouncedUpdateMetrics(updatedTopics, updatedSubscriptions, currentConfig);
        }
      } catch (error) {
        console.error('Error syncing Pub/Sub metrics:', error);
      }
    };

    // Initial sync
    syncMetrics();
    
    // Set up interval for periodic updates
    intervalId = setInterval(syncMetrics, metricsUpdateInterval);

    return () => {
      isMounted = false;
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [componentId, topics.length, subscriptions.length, node?.id, isRunning, updateNode]);

  const updateConfig = (updates: Partial<GCPPubSubConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addTopic = () => {
    try {
      const topicNames = topics.map((t: Topic) => t.name);
      let topicName = 'new-topic';
      let counter = 1;
      while (topicNames.includes(topicName)) {
        topicName = `new-topic-${counter}`;
        counter++;
      }

      const newTopic: Topic = {
        name: topicName,
        projectId: projectId || DEFAULT_GCP_PROJECT_ID,
        messageRetentionDuration: DEFAULT_TOPIC_VALUES.messageRetentionDuration,
        labels: {},
        messageCount: 0,
        byteCount: 0,
        publishedCount: 0,
      };
      updateConfig({ topics: [...topics, newTopic] });
      showSuccess(`Topic "${topicName}" created successfully`);
    } catch (error) {
      showError(`Failed to create topic: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const removeTopic = (index: number) => {
    try {
      // Validate index
      if (index < 0 || index >= topics.length) {
        showError('Invalid topic index');
        setDeleteTopicIndex(null);
        return;
      }

      const topic = topics[index];
      if (!topic) {
        showError('Topic not found');
        setDeleteTopicIndex(null);
        return;
      }

      // Check if any subscriptions use this topic
      const subscriptionsUsingTopic = subscriptions.filter((s: Subscription) => s.topic === topic.name);
      if (subscriptionsUsingTopic.length > 0) {
        showError(`Cannot delete topic "${topic.name}": ${subscriptionsUsingTopic.length} subscription(s) are using it`);
        setDeleteTopicIndex(null);
        return;
      }

      const newTopics = topics.filter((_: Topic, i: number) => i !== index);
      updateConfig({ topics: newTopics });
      showSuccess(`Topic "${topic.name}" deleted successfully`);
      setDeleteTopicIndex(null);
    } catch (error) {
      showError(`Failed to delete topic: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setDeleteTopicIndex(null);
    }
  };

  const updateTopic = (index: number, field: string, value: any) => {
    try {
      // Validate index
      if (index < 0 || index >= topics.length) {
        showError('Invalid topic index');
        return;
      }

      const topic = topics[index];
      if (!topic) {
        showError('Topic not found');
        return;
      }

      // Validate name
      if (field === 'name') {
        if (!value || typeof value !== 'string' || value.trim().length === 0) {
          showError('Topic name cannot be empty');
          return;
        }
        const topicNames = topics.map((t: Topic) => t.name);
        const error = validateTopicSubscriptionName(value, topicNames, index);
        if (error) {
          showError(error);
          return;
        }
      }

      // Validate retention duration
      if (field === 'messageRetentionDuration') {
        if (value === null || value === undefined || value === '') {
          // Allow empty value (will use default)
          value = undefined;
        } else {
          const error = validateNumericField(value, 'retention', 'Message retention duration');
          if (error) {
            showError(error);
            return;
          }
        }
      }

      // Validate labels
      if (field === 'labels') {
        if (value && typeof value !== 'object') {
          showError('Labels must be an object');
          return;
        }
      }

      const newTopics = [...topics];
      newTopics[index] = { ...newTopics[index], [field]: value };
      updateConfig({ topics: newTopics });
    } catch (error) {
      showError(`Failed to update topic: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const addSubscription = () => {
    try {
      if (topics.length === 0) {
        showError('Cannot create subscription: no topics available');
        return;
      }

      const subNames = subscriptions.map((s: Subscription) => s.name);
      let subName = 'new-subscription';
      let counter = 1;
      while (subNames.includes(subName)) {
        subName = `new-subscription-${counter}`;
        counter++;
      }

      // Ensure we have a valid topic name (not empty string)
      const firstTopicName = topics[0]?.name;
      if (!firstTopicName || firstTopicName.trim() === '') {
        showError('Cannot create subscription: no valid topics available');
        return;
      }

      const newSub: Subscription = {
        name: subName,
        topic: firstTopicName,
        projectId: projectId || DEFAULT_GCP_PROJECT_ID,
        ackDeadlineSeconds: DEFAULT_SUBSCRIPTION_VALUES.ackDeadlineSeconds,
        enableMessageOrdering: DEFAULT_SUBSCRIPTION_VALUES.enableMessageOrdering,
        filter: { type: 'none' },
        messageCount: 0,
        unackedMessageCount: 0,
        deliveredCount: 0,
        acknowledgedCount: 0,
        nackedCount: 0,
      };
      updateConfig({ subscriptions: [...subscriptions, newSub] });
      showSuccess(`Subscription "${subName}" created successfully`);
    } catch (error) {
      showError(`Failed to create subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const removeSubscription = (index: number) => {
    try {
      // Validate index
      if (index < 0 || index >= subscriptions.length) {
        showError('Invalid subscription index');
        setDeleteSubIndex(null);
        return;
      }

      const sub = subscriptions[index];
      if (!sub) {
        showError('Subscription not found');
        setDeleteSubIndex(null);
        return;
      }

      const newSubs = subscriptions.filter((_: Subscription, i: number) => i !== index);
      updateConfig({ subscriptions: newSubs });
      showSuccess(`Subscription "${sub.name}" deleted successfully`);
      setDeleteSubIndex(null);
    } catch (error) {
      showError(`Failed to delete subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setDeleteSubIndex(null);
    }
  };

  const updateSubscription = (index: number, field: string, value: any) => {
    try {
      // Validate index
      if (index < 0 || index >= subscriptions.length) {
        showError('Invalid subscription index');
        return;
      }

      const sub = subscriptions[index];
      if (!sub) {
        showError('Subscription not found');
        return;
      }

      // Validate name
      if (field === 'name') {
        if (!value || typeof value !== 'string' || value.trim().length === 0) {
          showError('Subscription name cannot be empty');
          return;
        }
        const subNames = subscriptions.map((s: Subscription) => s.name);
        const error = validateTopicSubscriptionName(value, subNames, index);
        if (error) {
          showError(error);
          return;
        }
      }

      // Validate topic
      if (field === 'topic') {
        if (!value || typeof value !== 'string' || value.trim().length === 0) {
          showError('Topic cannot be empty');
          return;
        }
        // Filter out invalid topic names
        const validTopics = topics.filter((t: Topic) => t.name && t.name.trim() !== '');
        const topicExists = validTopics.some((t: Topic) => t.name === value);
        if (!topicExists) {
          showError(`Topic "${value}" does not exist`);
          return;
        }
      }

      // Validate ack deadline
      if (field === 'ackDeadlineSeconds') {
        if (value === null || value === undefined || value === '') {
          // Allow empty value (will use default)
          value = DEFAULT_SUBSCRIPTION_VALUES.ackDeadlineSeconds;
        } else {
          const error = validateNumericField(value, 'ackDeadline', 'Ack deadline');
          if (error) {
            showError(error);
            return;
          }
        }
      }

      // Validate max delivery attempts
      if (field === 'maxDeliveryAttempts') {
        if (value !== null && value !== undefined && value !== '') {
          const numValue = Number(value);
          if (isNaN(numValue) || numValue < 1 || numValue > 100) {
            showError('Max delivery attempts must be between 1 and 100');
            return;
          }
        }
      }

      // Validate filter
      if (field === 'filter') {
        if (value && typeof value !== 'object') {
          showError('Filter must be an object');
          return;
        }
        if (value && value.type && !['none', 'attributes'].includes(value.type)) {
          showError('Filter type must be "none" or "attributes"');
          return;
        }
      }

      // Validate push attributes
      if (field === 'pushAttributes') {
        if (value && typeof value !== 'object') {
          showError('Push attributes must be an object');
          return;
        }
      }

      const newSubs = [...subscriptions];
      newSubs[index] = { ...newSubs[index], [field]: value };
      updateConfig({ subscriptions: newSubs });
    } catch (error) {
      showError(`Failed to update subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleProjectIdChange = (value: string) => {
    const error = validateProjectId(value);
    if (error) {
      showError(error);
      return;
    }
    updateConfig({ projectId: value });
  };

  const totalMessages = topics.reduce((sum: number, t: Topic) => sum + (t.messageCount || 0), 0);
  const totalUnacked = subscriptions.reduce((sum: number, s: Subscription) => sum + (s.unackedMessageCount || 0), 0);

  // Filtered and sorted topics
  const filteredAndSortedTopics = useMemo(() => {
    let filtered = topics;

    // Apply search filter
    if (topicSearchQuery) {
      const query = topicSearchQuery.toLowerCase();
      filtered = filtered.filter((t: Topic) => 
        t.name.toLowerCase().includes(query) ||
        (t.projectId && t.projectId.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    if (topicFilterStatus === 'with-messages') {
      filtered = filtered.filter((t: Topic) => (t.messageCount || 0) > 0);
    } else if (topicFilterStatus === 'empty') {
      filtered = filtered.filter((t: Topic) => (t.messageCount || 0) === 0);
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (topicSortField === 'name') {
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
      } else if (topicSortField === 'messageCount') {
        aValue = a.messageCount || 0;
        bValue = b.messageCount || 0;
      } else if (topicSortField === 'publishedCount') {
        aValue = a.publishedCount || 0;
        bValue = b.publishedCount || 0;
      }

      if (aValue < bValue) return topicSortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return topicSortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [topics, topicSearchQuery, topicFilterStatus, topicSortField, topicSortDirection]);

  // Filtered and sorted subscriptions
  const filteredAndSortedSubscriptions = useMemo(() => {
    let filtered = subscriptions;

    // Apply search filter
    if (subSearchQuery) {
      const query = subSearchQuery.toLowerCase();
      filtered = filtered.filter((s: Subscription) => 
        s.name.toLowerCase().includes(query) ||
        s.topic.toLowerCase().includes(query) ||
        (s.projectId && s.projectId.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    if (subFilterStatus === 'with-messages') {
      filtered = filtered.filter((s: Subscription) => (s.messageCount || 0) > 0);
    } else if (subFilterStatus === 'with-unacked') {
      filtered = filtered.filter((s: Subscription) => (s.unackedMessageCount || 0) > 0);
    } else if (subFilterStatus === 'empty') {
      filtered = filtered.filter((s: Subscription) => (s.messageCount || 0) === 0);
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (subSortField === 'name') {
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
      } else if (subSortField === 'messageCount') {
        aValue = a.messageCount || 0;
        bValue = b.messageCount || 0;
      } else if (subSortField === 'unackedMessageCount') {
        aValue = a.unackedMessageCount || 0;
        bValue = b.unackedMessageCount || 0;
      }

      if (aValue < bValue) return subSortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return subSortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [subscriptions, subSearchQuery, subFilterStatus, subSortField, subSortDirection]);

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
          <TabsList className="flex-wrap h-auto min-h-[36px] w-full justify-start gap-1">
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
                {/* Search and Filter Controls */}
                <div className="space-y-4 mb-4">
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search topics by name or project ID..."
                        value={topicSearchQuery}
                        onChange={(e) => setTopicSearchQuery(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <Select value={topicFilterStatus} onValueChange={(value: any) => setTopicFilterStatus(value)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Topics</SelectItem>
                        <SelectItem value="with-messages">With Messages</SelectItem>
                        <SelectItem value="empty">Empty</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={topicSortField} onValueChange={(value: any) => setTopicSortField(value)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Sort by Name</SelectItem>
                        <SelectItem value="messageCount">Sort by Messages</SelectItem>
                        <SelectItem value="publishedCount">Sort by Published</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setTopicSortDirection(topicSortDirection === 'asc' ? 'desc' : 'asc')}
                    >
                      {topicSortDirection === 'asc' ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {filteredAndSortedTopics.length !== topics.length && (
                    <p className="text-xs text-muted-foreground">
                      Showing {filteredAndSortedTopics.length} of {topics.length} topics
                    </p>
                  )}
                </div>
                <div className="space-y-4">
                  {filteredAndSortedTopics.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {topics.length === 0 ? 'No topics created yet' : 'No topics match your search/filter criteria'}
                    </div>
                  ) : (
                    filteredAndSortedTopics.map((topic: Topic) => {
                      const index = topics.findIndex((t: Topic) => t.name === topic.name);
                      return index !== -1 ? (
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
                            onClick={() => setDeleteTopicIndex(index)}
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
                            {topic.messageCount && topic.messageCount > 0 && (
                              <Progress 
                                value={Math.min((topic.messageCount / 1000) * 100, 100)} 
                                className="h-1 mt-1"
                              />
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Bytes</p>
                            <p className="text-lg font-semibold">{(topic.byteCount || 0).toLocaleString()}</p>
                            {topic.byteCount && topic.byteCount > 0 && (
                              <Progress 
                                value={Math.min((topic.byteCount / 1000000) * 100, 100)} 
                                className="h-1 mt-1"
                              />
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Published</p>
                            <p className="text-lg font-semibold">{topic.publishedCount || 0}</p>
                            {topic.publishedCount && topic.publishedCount > 0 && (
                              <Progress 
                                value={Math.min((topic.publishedCount / 1000) * 100, 100)} 
                                className="h-1 mt-1"
                              />
                            )}
                          </div>
                        </div>
                        {topic.publishedCount && topic.publishedCount > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground">Total Published Messages</p>
                            <p className="text-sm font-medium">{topic.publishedCount.toLocaleString()}</p>
                          </div>
                        )}
                        <Separator />
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label>Message Retention (seconds)</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>How long messages are retained in the topic. Default: 7 days (604800 seconds). Range: 10 minutes to 31 days.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              type="number"
                              value={topic.messageRetentionDuration || DEFAULT_TOPIC_VALUES.messageRetentionDuration}
                              onChange={(e) => updateTopic(index, 'messageRetentionDuration', Number(e.target.value))}
                              min={VALIDATION_RANGES.MESSAGE_RETENTION_DURATION.MIN}
                              max={VALIDATION_RANGES.MESSAGE_RETENTION_DURATION.MAX}
                            />
                            <p className="text-xs text-muted-foreground">Default: 7 days (604800)</p>
                          </div>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label>Labels</Label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Key-value pairs for organizing and filtering topics. Labels can be used for billing, monitoring, and resource management.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <div className="space-y-2 p-3 border rounded-md bg-muted/50">
                            {Object.entries(topic.labels || {}).map(([key, value], labelIndex) => (
                              <div key={labelIndex} className="flex gap-2">
                                <Input
                                  placeholder="Label key"
                                  value={key}
                                  onChange={(e) => {
                                    const newLabels = { ...topic.labels };
                                    delete newLabels[key];
                                    newLabels[e.target.value] = value;
                                    updateTopic(index, 'labels', newLabels);
                                  }}
                                  className="flex-1"
                                />
                                <Input
                                  placeholder="Label value"
                                  value={String(value)}
                                  onChange={(e) => {
                                    updateTopic(index, 'labels', {
                                      ...topic.labels,
                                      [key]: e.target.value,
                                    });
                                  }}
                                  className="flex-1"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const newLabels = { ...topic.labels };
                                    delete newLabels[key];
                                    updateTopic(index, 'labels', newLabels);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const newKey = `label${Object.keys(topic.labels || {}).length + 1}`;
                                updateTopic(index, 'labels', {
                                  ...topic.labels,
                                  [newKey]: '',
                                });
                              }}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Label
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                      ) : null;
                    })
                  )}
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
                {/* Search and Filter Controls */}
                <div className="space-y-4 mb-4">
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search subscriptions by name, topic, or project ID..."
                        value={subSearchQuery}
                        onChange={(e) => setSubSearchQuery(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <Select value={subFilterStatus} onValueChange={(value: any) => setSubFilterStatus(value)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Subscriptions</SelectItem>
                        <SelectItem value="with-messages">With Messages</SelectItem>
                        <SelectItem value="with-unacked">With Unacked</SelectItem>
                        <SelectItem value="empty">Empty</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={subSortField} onValueChange={(value: any) => setSubSortField(value)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Sort by Name</SelectItem>
                        <SelectItem value="messageCount">Sort by Messages</SelectItem>
                        <SelectItem value="unackedMessageCount">Sort by Unacked</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSubSortDirection(subSortDirection === 'asc' ? 'desc' : 'asc')}
                    >
                      {subSortDirection === 'asc' ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {filteredAndSortedSubscriptions.length !== subscriptions.length && (
                    <p className="text-xs text-muted-foreground">
                      Showing {filteredAndSortedSubscriptions.length} of {subscriptions.length} subscriptions
                    </p>
                  )}
                </div>
                <div className="space-y-4">
                  {filteredAndSortedSubscriptions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {subscriptions.length === 0 ? 'No subscriptions created yet' : 'No subscriptions match your search/filter criteria'}
                    </div>
                  ) : (
                    filteredAndSortedSubscriptions.map((sub: Subscription) => {
                      const index = subscriptions.findIndex((s: Subscription) => s.name === sub.name);
                      return index !== -1 ? (
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
                            onClick={() => setDeleteSubIndex(index)}
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
                            {sub.messageCount && sub.messageCount > 0 && (
                              <Progress 
                                value={Math.min((sub.messageCount / 1000) * 100, 100)} 
                                className="h-1 mt-1"
                              />
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Unacked</p>
                            <p className="text-lg font-semibold">{sub.unackedMessageCount || 0}</p>
                            {sub.unackedMessageCount && sub.unackedMessageCount > 0 && (
                              <Progress 
                                value={Math.min((sub.unackedMessageCount / 100) * 100, 100)} 
                                className="h-1 mt-1"
                              />
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Topic</p>
                            <Badge variant="outline">{sub.topic}</Badge>
                          </div>
                        </div>
                        {(sub.deliveredCount || sub.acknowledgedCount || sub.nackedCount) && (
                          <div className="mt-2 grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Delivered</p>
                              <p className="text-sm font-medium">{sub.deliveredCount || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Acknowledged</p>
                              <p className="text-sm font-medium">{sub.acknowledgedCount || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Nacked</p>
                              <p className="text-sm font-medium">{sub.nackedCount || 0}</p>
                            </div>
                          </div>
                        )}
                        <Separator />
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label>Topic</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>The topic this subscription is subscribed to. Messages published to the topic will be delivered to this subscription.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Select
                              value={sub.topic && sub.topic.trim() !== '' ? sub.topic : undefined}
                              onValueChange={(value) => updateSubscription(index, 'topic', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a topic" />
                              </SelectTrigger>
                              <SelectContent>
                                {topics
                                  .filter((t: Topic) => t.name && t.name.trim() !== '')
                                  .map((t: Topic) => (
                                    <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label>Ack Deadline (seconds)</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>The maximum time a subscriber has to acknowledge a message. Range: 10-600 seconds.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              type="number"
                              value={sub.ackDeadlineSeconds}
                              onChange={(e) => updateSubscription(index, 'ackDeadlineSeconds', Number(e.target.value))}
                              min={VALIDATION_RANGES.ACK_DEADLINE_SECONDS.MIN}
                              max={VALIDATION_RANGES.ACK_DEADLINE_SECONDS.MAX}
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label>Push Endpoint URL (optional)</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>URL endpoint for push subscriptions. Leave empty for pull subscription.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              value={sub.pushEndpoint || ''}
                              onChange={(e) => updateSubscription(index, 'pushEndpoint', e.target.value)}
                              placeholder="https://api.service/push"
                            />
                            <p className="text-xs text-muted-foreground">
                              Leave empty for pull subscription
                            </p>
                            {sub.pushEndpoint && (
                              <div className="space-y-2 mt-2 p-3 border rounded-md bg-muted/50">
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs">Push Attributes (optional)</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Custom attributes sent with push requests. These attributes are included in the HTTP headers when Pub/Sub delivers messages to the push endpoint.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <div className="space-y-2">
                                  {Object.entries(sub.pushAttributes || {}).map(([key, value], attrIndex) => (
                                    <div key={attrIndex} className="flex gap-2">
                                      <Input
                                        placeholder="Attribute key"
                                        value={key}
                                        onChange={(e) => {
                                          const newAttrs = { ...sub.pushAttributes };
                                          delete newAttrs[key];
                                          newAttrs[e.target.value] = value;
                                          updateSubscription(index, 'pushAttributes', newAttrs);
                                        }}
                                        className="flex-1"
                                      />
                                      <Input
                                        placeholder="Attribute value"
                                        value={String(value)}
                                        onChange={(e) => {
                                          updateSubscription(index, 'pushAttributes', {
                                            ...sub.pushAttributes,
                                            [key]: e.target.value,
                                          });
                                        }}
                                        className="flex-1"
                                      />
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          const newAttrs = { ...sub.pushAttributes };
                                          delete newAttrs[key];
                                          updateSubscription(index, 'pushAttributes', newAttrs);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const newKey = `attr${Object.keys(sub.pushAttributes || {}).length + 1}`;
                                      updateSubscription(index, 'pushAttributes', {
                                        ...sub.pushAttributes,
                                        [newKey]: '',
                                      });
                                    }}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Push Attribute
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Custom attributes sent with push requests
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Label>Enable Message Ordering</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Enable message ordering by ordering key. Messages with the same ordering key are delivered in order.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Switch
                              checked={sub.enableMessageOrdering}
                              onCheckedChange={(checked) => updateSubscription(index, 'enableMessageOrdering', checked)}
                            />
                          </div>
                        </div>
                        <Separator />
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label>Subscription Filter</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Filter messages by attributes. Only messages matching the filter will be delivered to this subscription.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Select
                              value={sub.filter?.type || 'none'}
                              onValueChange={(value) => {
                                const filter: SubscriptionFilter = {
                                  type: value as 'attributes' | 'none',
                                  attributes: value === 'attributes' ? (sub.filter?.attributes || {}) : undefined,
                                };
                                updateSubscription(index, 'filter', filter);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No Filter (All Messages)</SelectItem>
                                <SelectItem value="attributes">Attribute Filter</SelectItem>
                              </SelectContent>
                            </Select>
                            {sub.filter?.type === 'attributes' && (
                              <div className="space-y-2 mt-2 p-3 border rounded-md bg-muted/50">
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs">Filter Attributes (key=value pairs)</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Messages must have all specified attributes with matching values to be delivered to this subscription. Only messages matching all filter attributes will be delivered.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <div className="space-y-2">
                                  {Object.entries(sub.filter.attributes || {}).map(([key, value], attrIndex) => (
                                    <div key={attrIndex} className="flex gap-2">
                                      <Input
                                        placeholder="Attribute key"
                                        value={key}
                                        onChange={(e) => {
                                          const newAttrs = { ...sub.filter?.attributes };
                                          delete newAttrs[key];
                                          newAttrs[e.target.value] = value;
                                          updateSubscription(index, 'filter', {
                                            ...sub.filter,
                                            attributes: newAttrs,
                                          });
                                        }}
                                        className="flex-1"
                                      />
                                      <Input
                                        placeholder="Attribute value"
                                        value={String(value)}
                                        onChange={(e) => {
                                          updateSubscription(index, 'filter', {
                                            ...sub.filter,
                                            attributes: {
                                              ...sub.filter?.attributes,
                                              [key]: e.target.value,
                                            },
                                          });
                                        }}
                                        className="flex-1"
                                      />
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          const newAttrs = { ...sub.filter?.attributes };
                                          delete newAttrs[key];
                                          updateSubscription(index, 'filter', {
                                            ...sub.filter,
                                            attributes: newAttrs,
                                          });
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const newKey = `attr${Object.keys(sub.filter?.attributes || {}).length + 1}`;
                                      updateSubscription(index, 'filter', {
                                        ...sub.filter,
                                        attributes: {
                                          ...sub.filter?.attributes,
                                          [newKey]: '',
                                        },
                                      });
                                    }}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Attribute
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                          <Separator />
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label>Dead Letter Topic (optional)</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Topic where failed messages (exceeding max delivery attempts) will be moved.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Select
                              value={sub.deadLetterTopic || '__none__'}
                              onValueChange={(value) => updateSubscription(index, 'deadLetterTopic', value === '__none__' ? undefined : value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select dead letter topic (optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">None</SelectItem>
                                {topics
                                  .filter((t: Topic) => t.name && t.name.trim() !== '' && t.name !== '__none__')
                                  .map((t: Topic) => (
                                    <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            {sub.deadLetterTopic && (
                              <div className="space-y-2 mt-2">
                                <div className="flex items-center gap-2">
                                  <Label>Max Delivery Attempts</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Maximum number of delivery attempts before moving message to dead letter topic.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <Input
                                  type="number"
                                  value={sub.maxDeliveryAttempts || 5}
                                  onChange={(e) => updateSubscription(index, 'maxDeliveryAttempts', Number(e.target.value) || undefined)}
                                  min={1}
                                  max={100}
                                  placeholder="5"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Default: 5 attempts
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                      ) : null;
                    })
                  )}
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
                  <div className="flex items-center gap-2">
                    <Label>Project ID</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Google Cloud Project ID. Must be 6-30 characters, lowercase letters, numbers, and hyphens only.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    value={projectId}
                    onChange={(e) => handleProjectIdChange(e.target.value)}
                    placeholder="my-project-id"
                  />
                  {!projectId && (
                    <p className="text-xs text-muted-foreground">Project ID is required</p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Service Account JSON</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Google Cloud service account JSON credentials. Used for authentication when connecting to Pub/Sub. Should contain type, project_id, private_key, and client_email fields.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
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

        {/* Delete Topic Confirmation Dialog */}
        <AlertDialog open={deleteTopicIndex !== null} onOpenChange={(open) => !open && setDeleteTopicIndex(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Topic</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete topic "{topics[deleteTopicIndex || 0]?.name}"? This action cannot be undone.
                {subscriptions.filter((s: Subscription) => s.topic === topics[deleteTopicIndex || 0]?.name).length > 0 && (
                  <span className="block mt-2 text-destructive font-medium">
                    Warning: {subscriptions.filter((s: Subscription) => s.topic === topics[deleteTopicIndex || 0]?.name).length} subscription(s) are using this topic.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteTopicIndex !== null && removeTopic(deleteTopicIndex)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Subscription Confirmation Dialog */}
        <AlertDialog open={deleteSubIndex !== null} onOpenChange={(open) => !open && setDeleteSubIndex(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Subscription</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete subscription "{subscriptions[deleteSubIndex || 0]?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteSubIndex !== null && removeSubscription(deleteSubIndex)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}


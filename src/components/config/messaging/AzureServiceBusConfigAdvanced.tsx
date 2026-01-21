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
import { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Settings, 
  Plus, 
  Trash2,
  Shield,
  Key,
  Network
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Eye, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock, 
  RotateCcw,
  Search,
  Send,
  RefreshCw
} from 'lucide-react';
import { ServiceBusMessage } from '@/core/AzureServiceBusRoutingEngine';

interface AzureServiceBusConfigProps {
  componentId: string;
}

interface SubscriptionRule {
  name: string;
  filterType: 'SQL' | 'Correlation';
  sqlFilter?: string;
  correlationFilter?: {
    correlationId?: string;
    properties?: Record<string, unknown>;
  };
  action?: string;
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
  enableDuplicateDetection?: boolean;
  duplicateDetectionHistoryTimeWindow?: number;
  forwardTo?: string;
  enableBatchedOperations?: boolean;
  activeMessageCount?: number;
  deadLetterMessageCount?: number;
  scheduledMessageCount?: number;
  deferredMessageCount?: number;
}

interface Topic {
  name: string;
  namespace: string;
  maxSizeInMegabytes: number;
  defaultMessageTimeToLive: number;
  enablePartitioning: boolean;
  enableDuplicateDetection?: boolean;
  duplicateDetectionHistoryTimeWindow?: number;
  forwardTo?: string;
  enableBatchedOperations?: boolean;
  subscriptions?: Array<{
    name: string;
    maxDeliveryCount: number;
    lockDuration: number;
    enableDeadLetteringOnMessageExpiration: boolean;
    requiresSession?: boolean;
    forwardTo?: string;
    enableBatchedOperations?: boolean;
    rules?: SubscriptionRule[];
    activeMessageCount?: number;
    deadLetterMessageCount?: number;
    deferredMessageCount?: number;
  }>;
}

interface FirewallRule {
  name: string;
  ipRange: string; // CIDR notation, e.g., "10.0.0.0/8"
}

interface VirtualNetworkRule {
  name: string;
  subnetId: string; // Azure subnet resource ID
}

interface PrivateEndpoint {
  name: string;
  subnetId: string; // Azure subnet resource ID
}

interface NetworkingConfig {
  publicNetworkAccess?: 'enabled' | 'disabled';
  minimumTlsVersion?: '1.0' | '1.1' | '1.2';
  firewallRules?: FirewallRule[];
  virtualNetworkRules?: VirtualNetworkRule[];
  privateEndpoints?: PrivateEndpoint[];
}

interface SASAccessPolicy {
  name: string;
  permissions: ('Send' | 'Listen' | 'Manage')[];
  primaryKey?: string;
  secondaryKey?: string;
}

interface RBACAssignment {
  principalId: string; // User/Service Principal ID
  role: 'Owner' | 'Contributor' | 'Reader' | 'Azure Service Bus Data Owner' | 'Azure Service Bus Data Receiver' | 'Azure Service Bus Data Sender';
}

interface ManagedIdentity {
  name: string;
  type: 'SystemAssigned' | 'UserAssigned';
  principalId?: string; // For UserAssigned
}

interface SecurityConfig {
  sasPolicies?: SASAccessPolicy[];
  rbacAssignments?: RBACAssignment[];
  managedIdentities?: ManagedIdentity[];
}

interface AzureServiceBusConfig {
  namespace?: string;
  connectionString?: string;
  pricingTier?: 'basic' | 'standard' | 'premium';
  messagingUnits?: number; // For Premium tier
  consumptionRate?: number; // messages per second
  queues?: Queue[];
  topics?: Topic[];
  networking?: NetworkingConfig;
  security?: SecurityConfig;
}

export function AzureServiceBusConfigAdvanced({ componentId }: AzureServiceBusConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { isRunning } = useEmulationStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;
  const nodeRef = useRef(node);

  // Update node ref when node changes
  useEffect(() => {
    nodeRef.current = node;
  }, [node]);

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as AzureServiceBusConfig;
  const namespace = config.namespace || 'archiphoenix.servicebus.windows.net';
  const connectionString = config.connectionString || '';
  const queues = config.queues || [];
  const topics = config.topics || [];

  const [editingQueueIndex, setEditingQueueIndex] = useState<number | null>(null);
  const [editingTopicIndex, setEditingTopicIndex] = useState<number | null>(null);
  const [queueNameErrors, setQueueNameErrors] = useState<Record<number, string>>({});
  const [topicNameErrors, setTopicNameErrors] = useState<Record<number, string>>({});
  const [subscriptionNameErrors, setSubscriptionNameErrors] = useState<Record<string, string>>({});
  
  // Message Explorer state
  const [selectedEntityType, setSelectedEntityType] = useState<'queue' | 'subscription'>('queue');
  const [selectedQueueName, setSelectedQueueName] = useState<string>('');
  const [selectedTopicName, setSelectedTopicName] = useState<string>('');
  const [selectedSubscriptionName, setSelectedSubscriptionName] = useState<string>('');
  const [showDeadLetterQueue, setShowDeadLetterQueue] = useState<boolean>(false);
  const [showDeferred, setShowDeferred] = useState<boolean>(false);
  const [showScheduled, setShowScheduled] = useState<boolean>(false);
  const [showLocked, setShowLocked] = useState<boolean>(false);
  const [messages, setMessages] = useState<ServiceBusMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sync metrics from routing engine in real-time
  useEffect(() => {
    if (!node || (queues.length === 0 && topics.length === 0) || !isRunning) return;
    
    const interval = setInterval(() => {
      const routingEngine = emulationEngine.getAzureServiceBusRoutingEngine(componentId);
      if (!routingEngine) return;

      // Get current config from node ref to avoid stale closures
      const currentNode = nodeRef.current;
      if (!currentNode) return;
      
      const currentConfig = (currentNode.data.config as any) || {};
      const currentQueues = currentConfig.queues || [];
      const currentTopics = currentConfig.topics || [];
      
      // Get metrics from routing engine
      const allQueueMetrics = routingEngine.getAllQueueMetrics();
      const allSubscriptionMetrics = routingEngine.getAllSubscriptionMetrics();
      
      // Update queue metrics
      const updatedQueues = currentQueues.map((queue: any) => {
        const metrics = allQueueMetrics.get(queue.name);
        if (metrics) {
          return {
            ...queue,
            activeMessageCount: metrics.activeMessageCount,
            deadLetterMessageCount: metrics.deadLetterMessageCount,
            scheduledMessageCount: metrics.scheduledMessageCount,
            deferredMessageCount: metrics.deferredMessageCount || 0,
          };
        }
        return queue;
      });
      
      // Update topic subscription metrics
      const updatedTopics = currentTopics.map((topic: any) => {
        const updatedSubscriptions = (topic.subscriptions || []).map((sub: any) => {
          const subscriptionId = `${topic.name}/subscriptions/${sub.name}`;
          const metrics = allSubscriptionMetrics.get(subscriptionId);
          if (metrics) {
            return {
              ...sub,
              activeMessageCount: metrics.activeMessageCount,
              deadLetterMessageCount: metrics.deadLetterMessageCount || 0,
              deferredMessageCount: metrics.deferredMessageCount || 0,
            };
          }
          return sub;
        });
        
        return {
          ...topic,
          subscriptions: updatedSubscriptions,
        };
      });

      // Check if metrics changed
      const queueMetricsChanged = updatedQueues.some((q: any, i: number) => 
        q.activeMessageCount !== currentQueues[i]?.activeMessageCount ||
        q.deadLetterMessageCount !== currentQueues[i]?.deadLetterMessageCount ||
        q.scheduledMessageCount !== currentQueues[i]?.scheduledMessageCount ||
        q.deferredMessageCount !== (currentQueues[i]?.deferredMessageCount || 0)
      );
      
      const subscriptionMetricsChanged = updatedTopics.some((t: any, ti: number) => {
        const currentTopic = currentTopics[ti];
        if (!currentTopic) return false;
        return (t.subscriptions || []).some((sub: any, si: number) => {
          const currentSub = currentTopic.subscriptions?.[si];
          if (!currentSub) return false;
          return sub.activeMessageCount !== currentSub.activeMessageCount ||
                 sub.deadLetterMessageCount !== (currentSub.deadLetterMessageCount || 0) ||
                 sub.deferredMessageCount !== (currentSub.deferredMessageCount || 0);
        });
      });

      if ((queueMetricsChanged || subscriptionMetricsChanged) && nodeRef.current) {
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
    }, 500); // Update every 500ms

    return () => clearInterval(interval);
  }, [componentId, queues.length, topics.length, node?.id, updateNode, isRunning]);

  // Validate Azure Service Bus entity name (queue/topic/subscription)
  const validateEntityName = (name: string): string | null => {
    if (!name || name.trim() === '') {
      return 'Name cannot be empty';
    }
    if (name.length < 1 || name.length > 260) {
      return 'Name must be between 1 and 260 characters';
    }
    // Azure Service Bus names: letters, numbers, hyphens, underscores, periods
    // Cannot start or end with period or hyphen
    // Cannot contain consecutive periods
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
      return 'Name can only contain letters, numbers, periods, hyphens, and underscores';
    }
    if (name.startsWith('.') || name.endsWith('.')) {
      return 'Name cannot start or end with a period';
    }
    if (name.startsWith('-') || name.endsWith('-')) {
      return 'Name cannot start or end with a hyphen';
    }
    if (name.includes('..')) {
      return 'Name cannot contain consecutive periods';
    }
    return null;
  };

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
      enableDuplicateDetection: false,
      duplicateDetectionHistoryTimeWindow: 600, // 10 minutes default
      forwardTo: undefined,
      enableBatchedOperations: false,
      activeMessageCount: 0,
      deadLetterMessageCount: 0,
      scheduledMessageCount: 0,
    };
    updateConfig({ queues: [...queues, newQueue] });
  };

  const removeQueue = (index: number) => {
    // Remove validation errors for this queue and reindex remaining errors
    const newErrors: Record<number, string> = {};
    for (const [key, value] of Object.entries(queueNameErrors)) {
      const keyNum = Number(key);
      if (keyNum < index) {
        newErrors[keyNum] = value;
      } else if (keyNum > index) {
        newErrors[keyNum - 1] = value;
      }
    }
    setQueueNameErrors(newErrors);
    updateConfig({ queues: queues.filter((_, i) => i !== index) });
  };

  const updateQueue = (index: number, field: string, value: any) => {
    if (field === 'name') {
      const error = validateEntityName(value);
      if (error) {
        setQueueNameErrors({ ...queueNameErrors, [index]: error });
        return;
      } else {
        const newErrors = { ...queueNameErrors };
        delete newErrors[index];
        setQueueNameErrors(newErrors);
      }
    }
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
      enableDuplicateDetection: false,
      duplicateDetectionHistoryTimeWindow: 600, // 10 minutes default
      forwardTo: undefined,
      enableBatchedOperations: false,
      subscriptions: [],
    };
    updateConfig({ topics: [...topics, newTopic] });
  };

  const removeTopic = (index: number) => {
    // Remove validation errors for this topic and its subscriptions, reindex remaining errors
    const newTopicErrors: Record<number, string> = {};
    for (const [key, value] of Object.entries(topicNameErrors)) {
      const keyNum = Number(key);
      if (keyNum < index) {
        newTopicErrors[keyNum] = value;
      } else if (keyNum > index) {
        newTopicErrors[keyNum - 1] = value;
      }
    }
    setTopicNameErrors(newTopicErrors);
    
    // Remove subscription errors for this topic and reindex
    const newSubErrors: Record<string, string> = {};
    for (const [key, value] of Object.entries(subscriptionNameErrors)) {
      const [topicIdx, subIdx] = key.split('-').map(Number);
      if (topicIdx < index) {
        newSubErrors[key] = value;
      } else if (topicIdx > index) {
        newSubErrors[`${topicIdx - 1}-${subIdx}`] = value;
      }
      // topicIdx === index: skip (deleted topic's subscriptions)
    }
    setSubscriptionNameErrors(newSubErrors);
    
    updateConfig({ topics: topics.filter((_, i) => i !== index) });
  };

  const updateTopic = (index: number, field: string, value: any) => {
    if (field === 'name') {
      const error = validateEntityName(value);
      if (error) {
        setTopicNameErrors({ ...topicNameErrors, [index]: error });
        return;
      } else {
        const newErrors = { ...topicNameErrors };
        delete newErrors[index];
        setTopicNameErrors(newErrors);
      }
    }
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
        requiresSession: false,
        forwardTo: undefined,
        enableBatchedOperations: false,
        rules: [],
        activeMessageCount: 0,
      };
      const updatedSubs = [...(topic.subscriptions || []), newSub];
      updateTopic(topicIndex, 'subscriptions', updatedSubs);
    }
  };

  const removeSubscription = (topicIndex: number, subIndex: number) => {
    // Remove validation errors for this subscription and reindex remaining errors
    const newSubErrors: Record<string, string> = {};
    for (const [key, value] of Object.entries(subscriptionNameErrors)) {
      const [topicIdx, subIdx] = key.split('-').map(Number);
      if (topicIdx !== topicIndex) {
        newSubErrors[key] = value;
      } else if (subIdx < subIndex) {
        newSubErrors[key] = value;
      } else if (subIdx > subIndex) {
        newSubErrors[`${topicIndex}-${subIdx - 1}`] = value;
      }
      // subIdx === subIndex: skip (deleted subscription)
    }
    setSubscriptionNameErrors(newSubErrors);
    
    const topic = topics[topicIndex];
    if (topic && topic.subscriptions) {
      const updatedSubs = topic.subscriptions.filter((_, i) => i !== subIndex);
      updateTopic(topicIndex, 'subscriptions', updatedSubs);
    }
  };

  const updateSubscription = (topicIndex: number, subIndex: number, field: string, value: any) => {
    if (field === 'name') {
      const errorKey = `${topicIndex}-${subIndex}`;
      const error = validateEntityName(value);
      if (error) {
        setSubscriptionNameErrors({ ...subscriptionNameErrors, [errorKey]: error });
        return;
      } else {
        const newErrors = { ...subscriptionNameErrors };
        delete newErrors[errorKey];
        setSubscriptionNameErrors(newErrors);
      }
    }
    const topic = topics[topicIndex];
    if (topic && topic.subscriptions) {
      const updatedSubs = [...topic.subscriptions];
      updatedSubs[subIndex] = { ...updatedSubs[subIndex], [field]: value };
      updateTopic(topicIndex, 'subscriptions', updatedSubs);
    }
  };

  const totalMessages = queues.reduce((sum, q) => sum + (q.activeMessageCount || 0), 0) +
    topics.reduce((sum, t) => sum + (t.subscriptions?.reduce((s, sub) => s + (sub.activeMessageCount || 0), 0) || 0), 0);

  // Networking configuration
  const networking = config.networking || {
    publicNetworkAccess: 'enabled' as const,
    minimumTlsVersion: '1.2' as const,
    firewallRules: [],
    virtualNetworkRules: [],
    privateEndpoints: [],
  };

  const updateNetworking = (updates: Partial<NetworkingConfig>) => {
    updateConfig({ networking: { ...networking, ...updates } });
  };

  const addFirewallRule = () => {
    const newRule: FirewallRule = { name: 'new-firewall-rule', ipRange: '0.0.0.0/0' };
    updateNetworking({ firewallRules: [...(networking.firewallRules || []), newRule] });
  };

  const removeFirewallRule = (index: number) => {
    const rules = [...(networking.firewallRules || [])];
    rules.splice(index, 1);
    updateNetworking({ firewallRules: rules });
  };

  const updateFirewallRule = (index: number, field: keyof FirewallRule, value: string) => {
    const rules = [...(networking.firewallRules || [])];
    rules[index] = { ...rules[index], [field]: value };
    updateNetworking({ firewallRules: rules });
  };

  const addVirtualNetworkRule = () => {
    const newRule: VirtualNetworkRule = { name: 'new-vnet-rule', subnetId: '/subscriptions/.../subnets/...' };
    updateNetworking({ virtualNetworkRules: [...(networking.virtualNetworkRules || []), newRule] });
  };

  const removeVirtualNetworkRule = (index: number) => {
    const rules = [...(networking.virtualNetworkRules || [])];
    rules.splice(index, 1);
    updateNetworking({ virtualNetworkRules: rules });
  };

  const updateVirtualNetworkRule = (index: number, field: keyof VirtualNetworkRule, value: string) => {
    const rules = [...(networking.virtualNetworkRules || [])];
    rules[index] = { ...rules[index], [field]: value };
    updateNetworking({ virtualNetworkRules: rules });
  };

  const addPrivateEndpoint = () => {
    const newEndpoint: PrivateEndpoint = { name: 'new-private-endpoint', subnetId: '/subscriptions/.../subnets/...' };
    updateNetworking({ privateEndpoints: [...(networking.privateEndpoints || []), newEndpoint] });
  };

  const removePrivateEndpoint = (index: number) => {
    const endpoints = [...(networking.privateEndpoints || [])];
    endpoints.splice(index, 1);
    updateNetworking({ privateEndpoints: endpoints });
  };

  const updatePrivateEndpoint = (index: number, field: keyof PrivateEndpoint, value: string) => {
    const endpoints = [...(networking.privateEndpoints || [])];
    endpoints[index] = { ...endpoints[index], [field]: value };
    updateNetworking({ privateEndpoints: endpoints });
  };

  // Security configuration
  const security = config.security || {
    sasPolicies: [],
    rbacAssignments: [],
    managedIdentities: [],
  };

  const updateSecurity = (updates: Partial<SecurityConfig>) => {
    updateConfig({ security: { ...security, ...updates } });
  };

  const addSASPolicy = () => {
    const newPolicy: SASAccessPolicy = { name: 'new-sas-policy', permissions: ['Send', 'Listen'] };
    updateSecurity({ sasPolicies: [...(security.sasPolicies || []), newPolicy] });
  };

  const removeSASPolicy = (index: number) => {
    const policies = [...(security.sasPolicies || [])];
    policies.splice(index, 1);
    updateSecurity({ sasPolicies: policies });
  };

  const updateSASPolicy = (index: number, field: keyof SASAccessPolicy, value: any) => {
    const policies = [...(security.sasPolicies || [])];
    policies[index] = { ...policies[index], [field]: value };
    updateSecurity({ sasPolicies: policies });
  };

  const toggleSASPermission = (index: number, permission: 'Send' | 'Listen' | 'Manage') => {
    const policy = security.sasPolicies?.[index];
    if (!policy) return;
    const permissions = [...(policy.permissions || [])];
    const idx = permissions.indexOf(permission);
    if (idx >= 0) {
      permissions.splice(idx, 1);
    } else {
      permissions.push(permission);
    }
    updateSASPolicy(index, 'permissions', permissions);
  };

  const addRBACAssignment = () => {
    const newAssignment: RBACAssignment = { principalId: '', role: 'Reader' };
    updateSecurity({ rbacAssignments: [...(security.rbacAssignments || []), newAssignment] });
  };

  const removeRBACAssignment = (index: number) => {
    const assignments = [...(security.rbacAssignments || [])];
    assignments.splice(index, 1);
    updateSecurity({ rbacAssignments: assignments });
  };

  const updateRBACAssignment = (index: number, field: keyof RBACAssignment, value: any) => {
    const assignments = [...(security.rbacAssignments || [])];
    assignments[index] = { ...assignments[index], [field]: value };
    updateSecurity({ rbacAssignments: assignments });
  };

  const addManagedIdentity = () => {
    const newIdentity: ManagedIdentity = { name: 'new-identity', type: 'SystemAssigned' };
    updateSecurity({ managedIdentities: [...(security.managedIdentities || []), newIdentity] });
  };

  const removeManagedIdentity = (index: number) => {
    const identities = [...(security.managedIdentities || [])];
    identities.splice(index, 1);
    updateSecurity({ managedIdentities: identities });
  };

  const updateManagedIdentity = (index: number, field: keyof ManagedIdentity, value: any) => {
    const identities = [...(security.managedIdentities || [])];
    identities[index] = { ...identities[index], [field]: value };
    updateSecurity({ managedIdentities: identities });
  };

  // Load messages for Message Explorer
  const loadMessages = () => {
    const routingEngine = emulationEngine.getAzureServiceBusRoutingEngine(componentId);
    if (!routingEngine) {
      setMessages([]);
      return;
    }

    let loadedMessages: ServiceBusMessage[] = [];

    if (selectedEntityType === 'queue' && selectedQueueName) {
      if (showDeadLetterQueue) {
        loadedMessages = routingEngine.getDeadLetterQueueMessages(selectedQueueName);
      } else if (showDeferred) {
        loadedMessages = routingEngine.getDeferredQueueMessages(selectedQueueName);
      } else if (showScheduled) {
        loadedMessages = routingEngine.getScheduledQueueMessages(selectedQueueName);
      } else if (showLocked) {
        loadedMessages = routingEngine.getLockedQueueMessages(selectedQueueName);
      } else {
        loadedMessages = routingEngine.peekQueueMessages(selectedQueueName, 100);
      }
    } else if (selectedEntityType === 'subscription' && selectedTopicName && selectedSubscriptionName) {
      const subscriptionId = `${selectedTopicName}/subscriptions/${selectedSubscriptionName}`;
      if (showDeadLetterQueue) {
        loadedMessages = routingEngine.getDeadLetterSubscriptionMessages(selectedTopicName, selectedSubscriptionName);
      } else if (showDeferred) {
        loadedMessages = routingEngine.getDeferredSubscriptionMessages(selectedTopicName, selectedSubscriptionName);
      } else if (showLocked) {
        loadedMessages = routingEngine.getLockedSubscriptionMessages(selectedTopicName, selectedSubscriptionName);
      } else {
        loadedMessages = routingEngine.peekSubscriptionMessages(selectedTopicName, selectedSubscriptionName, 100);
      }
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      loadedMessages = loadedMessages.filter(msg => 
        msg.messageId?.toLowerCase().includes(query) ||
        msg.id?.toLowerCase().includes(query) ||
        JSON.stringify(msg.properties || {}).toLowerCase().includes(query) ||
        JSON.stringify(msg.payload).toLowerCase().includes(query)
      );
    }

    setMessages(loadedMessages);
  };

  // Handle message actions
  const handleCompleteMessage = (lockToken: string) => {
    const routingEngine = emulationEngine.getAzureServiceBusRoutingEngine(componentId);
    if (!routingEngine) return;

    const entityId = selectedEntityType === 'queue' 
      ? selectedQueueName 
      : `${selectedTopicName}/subscriptions/${selectedSubscriptionName}`;
    
    routingEngine.completeMessage(entityId, lockToken);
    loadMessages();
  };

  const handleAbandonMessage = (lockToken: string) => {
    const routingEngine = emulationEngine.getAzureServiceBusRoutingEngine(componentId);
    if (!routingEngine) return;

    const entityId = selectedEntityType === 'queue' 
      ? selectedQueueName 
      : `${selectedTopicName}/subscriptions/${selectedSubscriptionName}`;
    
    routingEngine.abandonMessage(entityId, lockToken);
    loadMessages();
  };

  const handleDeferMessage = (lockToken: string) => {
    const routingEngine = emulationEngine.getAzureServiceBusRoutingEngine(componentId);
    if (!routingEngine) return;

    const entityId = selectedEntityType === 'queue' 
      ? selectedQueueName 
      : `${selectedTopicName}/subscriptions/${selectedSubscriptionName}`;
    
    routingEngine.deferMessage(entityId, lockToken);
    loadMessages();
  };

  const handleSendToDeadLetter = (lockToken: string) => {
    const routingEngine = emulationEngine.getAzureServiceBusRoutingEngine(componentId);
    if (!routingEngine) return;

    const entityId = selectedEntityType === 'queue' 
      ? selectedQueueName 
      : `${selectedTopicName}/subscriptions/${selectedSubscriptionName}`;
    
    routingEngine.sendToDeadLetter(entityId, lockToken);
    loadMessages();
  };

  const handleResubmitMessage = (messageId: string) => {
    const routingEngine = emulationEngine.getAzureServiceBusRoutingEngine(componentId);
    if (!routingEngine) return;

    const entityId = selectedEntityType === 'queue' 
      ? selectedQueueName 
      : `${selectedTopicName}/subscriptions/${selectedSubscriptionName}`;
    
    routingEngine.resubmitMessage(entityId, messageId);
    loadMessages();
  };

  const handleDeleteDeadLetterMessage = (messageId: string) => {
    const routingEngine = emulationEngine.getAzureServiceBusRoutingEngine(componentId);
    if (!routingEngine) return;

    const entityId = selectedEntityType === 'queue' 
      ? selectedQueueName 
      : `${selectedTopicName}/subscriptions/${selectedSubscriptionName}`;
    
    routingEngine.deleteDeadLetterMessage(entityId, messageId);
    loadMessages();
  };

  // Load messages when selection changes
  useEffect(() => {
    if ((selectedEntityType === 'queue' && selectedQueueName) || 
        (selectedEntityType === 'subscription' && selectedTopicName && selectedSubscriptionName)) {
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [selectedEntityType, selectedQueueName, selectedTopicName, selectedSubscriptionName, 
      showDeadLetterQueue, showDeferred, showScheduled, showLocked, searchQuery, componentId]);

  // Auto-refresh messages when simulation is running
  useEffect(() => {
    if (!isRunning) return;
    
    const interval = setInterval(() => {
      if ((selectedEntityType === 'queue' && selectedQueueName) || 
          (selectedEntityType === 'subscription' && selectedTopicName && selectedSubscriptionName)) {
        loadMessages();
      }
    }, 1000); // Refresh every second

    return () => clearInterval(interval);
  }, [isRunning, selectedEntityType, selectedQueueName, selectedTopicName, selectedSubscriptionName, 
      showDeadLetterQueue, showDeferred, showScheduled, showLocked, componentId]);

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
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="namespace" className="flex-shrink-0">
              <Settings className="h-4 w-4 mr-2" />
              Namespace Settings
            </TabsTrigger>
            <TabsTrigger value="queues" className="flex-shrink-0">
              <MessageSquare className="h-4 w-4 mr-2" />
              Queues ({queues.length})
            </TabsTrigger>
            <TabsTrigger value="topics" className="flex-shrink-0">
              <MessageSquare className="h-4 w-4 mr-2" />
              Topics ({topics.length})
            </TabsTrigger>
            <TabsTrigger value="networking" className="flex-shrink-0">
              <Network className="h-4 w-4 mr-2" />
              Networking
            </TabsTrigger>
            <TabsTrigger value="security" className="flex-shrink-0">
              <Shield className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
            <TabsTrigger value="connection" className="flex-shrink-0">
              <Key className="h-4 w-4 mr-2" />
              Connection
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex-shrink-0">
              <Eye className="h-4 w-4 mr-2" />
              Message Explorer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="namespace" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Namespace Settings</CardTitle>
                <CardDescription>Configure Azure Service Bus namespace tier and capacity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Pricing Tier</Label>
                  <Select
                    value={config.pricingTier || 'standard'}
                    onValueChange={(value: 'basic' | 'standard' | 'premium') => updateConfig({ pricingTier: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {config.pricingTier === 'basic' && 'Basic tier: 1000 msg/s, 256KB message size limit'}
                    {config.pricingTier === 'standard' && 'Standard tier: 10000 msg/s, 256KB message size limit'}
                    {config.pricingTier === 'premium' && 'Premium tier: 100000 msg/s per messaging unit, 100MB message size limit'}
                  </p>
                </div>
                {config.pricingTier === 'premium' && (
                  <div className="space-y-2">
                    <Label>Messaging Units</Label>
                    <Input
                      type="number"
                      min={1}
                      max={16}
                      value={config.messagingUnits || 1}
                      onChange={(e) => updateConfig({ messagingUnits: Math.max(1, Math.min(16, Number(e.target.value))) })}
                      placeholder="1"
                    />
                    <p className="text-xs text-muted-foreground">
                      Number of messaging units (1-16). Each unit provides 100000 msg/s throughput.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Consumption Rate (messages/second)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={config.consumptionRate || 10}
                    onChange={(e) => updateConfig({ consumptionRate: Math.max(1, Number(e.target.value)) })}
                    placeholder="10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Rate at which messages are consumed from queues/subscriptions and sent to outgoing connections.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

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
                        <div className="grid grid-cols-4 gap-4">
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
                          <div>
                            <p className="text-xs text-muted-foreground">Deferred</p>
                            <p className="text-lg font-semibold">{queue.deferredMessageCount || 0}</p>
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
                          <div className="flex items-center justify-between">
                            <Label>Enable Duplicate Detection</Label>
                            <Switch
                              checked={queue.enableDuplicateDetection || false}
                              onCheckedChange={(checked) => updateQueue(index, 'enableDuplicateDetection', checked)}
                            />
                          </div>
                          {queue.enableDuplicateDetection && (
                            <div className="space-y-2">
                              <Label>Duplicate Detection Window (seconds)</Label>
                              <Input
                                type="number"
                                value={queue.duplicateDetectionHistoryTimeWindow || 600}
                                onChange={(e) => updateQueue(index, 'duplicateDetectionHistoryTimeWindow', Number(e.target.value))}
                                placeholder="600"
                              />
                            </div>
                          )}
                          <div className="space-y-2">
                            <Label>Forward To (queue/topic name)</Label>
                            <Input
                              value={queue.forwardTo || ''}
                              onChange={(e) => updateQueue(index, 'forwardTo', e.target.value || undefined)}
                              placeholder="destination-queue-or-topic"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Enable Batched Operations</Label>
                            <Switch
                              checked={queue.enableBatchedOperations || false}
                              onCheckedChange={(checked) => updateQueue(index, 'enableBatchedOperations', checked)}
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
                              className={topicNameErrors[index] ? 'border-destructive' : ''}
                            />
                            {topicNameErrors[index] && (
                              <Alert variant="destructive" className="mt-2">
                                <AlertDescription>{topicNameErrors[index]}</AlertDescription>
                              </Alert>
                            )}
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
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Enable Duplicate Detection</Label>
                            <Switch
                              checked={topic.enableDuplicateDetection || false}
                              onCheckedChange={(checked) => updateTopic(index, 'enableDuplicateDetection', checked)}
                            />
                          </div>
                          {topic.enableDuplicateDetection && (
                            <div className="space-y-2">
                              <Label>Duplicate Detection Window (seconds)</Label>
                              <Input
                                type="number"
                                value={topic.duplicateDetectionHistoryTimeWindow || 600}
                                onChange={(e) => updateTopic(index, 'duplicateDetectionHistoryTimeWindow', Number(e.target.value))}
                                placeholder="600"
                              />
                            </div>
                          )}
                          <div className="space-y-2">
                            <Label>Forward To (queue/topic name)</Label>
                            <Input
                              value={topic.forwardTo || ''}
                              onChange={(e) => updateTopic(index, 'forwardTo', e.target.value || undefined)}
                              placeholder="destination-queue-or-topic"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Enable Batched Operations</Label>
                            <Switch
                              checked={topic.enableBatchedOperations || false}
                              onCheckedChange={(checked) => updateTopic(index, 'enableBatchedOperations', checked)}
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
                                          className={subscriptionNameErrors[`${index}-${subIndex}`] ? 'border-destructive' : ''}
                                        />
                                        {subscriptionNameErrors[`${index}-${subIndex}`] && (
                                          <Alert variant="destructive" className="mt-2">
                                            <AlertDescription>{subscriptionNameErrors[`${index}-${subIndex}`]}</AlertDescription>
                                          </Alert>
                                        )}
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
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Dead Letter</p>
                                        <p className="text-lg font-semibold">{sub.deadLetterMessageCount || 0}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Deferred</p>
                                        <p className="text-lg font-semibold">{sub.deferredMessageCount || 0}</p>
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
                                    <div className="flex items-center justify-between">
                                      <Label>Requires Session</Label>
                                      <Switch
                                        checked={sub.requiresSession || false}
                                        onCheckedChange={(checked) => updateSubscription(index, subIndex, 'requiresSession', checked)}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Forward To (queue/topic name)</Label>
                                      <Input
                                        value={sub.forwardTo || ''}
                                        onChange={(e) => updateSubscription(index, subIndex, 'forwardTo', e.target.value || undefined)}
                                        placeholder="destination-queue-or-topic"
                                      />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <Label>Enable Batched Operations</Label>
                                      <Switch
                                        checked={sub.enableBatchedOperations || false}
                                        onCheckedChange={(checked) => updateSubscription(index, subIndex, 'enableBatchedOperations', checked)}
                                      />
                                    </div>
                                    <Separator />
                                    <div>
                                      <div className="flex items-center justify-between mb-2">
                                        <Label>Rules/Filters ({(sub.rules || []).length})</Label>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            const rules = sub.rules || [];
                                            const newRule: SubscriptionRule = {
                                              name: `rule-${rules.length + 1}`,
                                              filterType: 'SQL',
                                              sqlFilter: '',
                                            };
                                            updateSubscription(index, subIndex, 'rules', [...rules, newRule]);
                                          }}
                                        >
                                          <Plus className="h-4 w-4 mr-2" />
                                          Add Rule
                                        </Button>
                                      </div>
                                      {sub.rules && sub.rules.length > 0 ? (
                                        <div className="space-y-2">
                                          {sub.rules.map((rule, ruleIndex) => (
                                            <Card key={ruleIndex} className="p-3">
                                              <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                  <Input
                                                    value={rule.name}
                                                    onChange={(e) => {
                                                      const rules = [...(sub.rules || [])];
                                                      rules[ruleIndex] = { ...rule, name: e.target.value };
                                                      updateSubscription(index, subIndex, 'rules', rules);
                                                    }}
                                                    placeholder="Rule name"
                                                    className="flex-1 mr-2"
                                                  />
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                      const rules = (sub.rules || []).filter((_, i) => i !== ruleIndex);
                                                      updateSubscription(index, subIndex, 'rules', rules);
                                                    }}
                                                  >
                                                    <Trash2 className="h-4 w-4" />
                                                  </Button>
                                                </div>
                                                <Select
                                                  value={rule.filterType}
                                                  onValueChange={(value: 'SQL' | 'Correlation') => {
                                                    const rules = [...(sub.rules || [])];
                                                    rules[ruleIndex] = { ...rule, filterType: value };
                                                    updateSubscription(index, subIndex, 'rules', rules);
                                                  }}
                                                >
                                                  <SelectTrigger>
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="SQL">SQL Filter</SelectItem>
                                                    <SelectItem value="Correlation">Correlation Filter</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                                {rule.filterType === 'SQL' && (
                                                  <Textarea
                                                    value={rule.sqlFilter || ''}
                                                    onChange={(e) => {
                                                      const rules = [...(sub.rules || [])];
                                                      rules[ruleIndex] = { ...rule, sqlFilter: e.target.value };
                                                      updateSubscription(index, subIndex, 'rules', rules);
                                                    }}
                                                    placeholder="SQL filter expression, e.g., user.type = 'premium'"
                                                    rows={2}
                                                  />
                                                )}
                                                {rule.filterType === 'Correlation' && (
                                                  <div className="space-y-2">
                                                    <Input
                                                      value={rule.correlationFilter?.correlationId || ''}
                                                      onChange={(e) => {
                                                        const rules = [...(sub.rules || [])];
                                                        rules[ruleIndex] = {
                                                          ...rule,
                                                          correlationFilter: {
                                                            ...rule.correlationFilter,
                                                            correlationId: e.target.value,
                                                          },
                                                        };
                                                        updateSubscription(index, subIndex, 'rules', rules);
                                                      }}
                                                      placeholder="Correlation ID"
                                                    />
                                                  </div>
                                                )}
                                              </div>
                                            </Card>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-sm text-muted-foreground text-center py-2">No rules (all messages will be delivered)</p>
                                      )}
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

          <TabsContent value="networking" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Networking Settings</CardTitle>
                <CardDescription>Configure network access and firewall rules for Azure Service Bus namespace</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Public Network Access</Label>
                  <Select
                    value={networking.publicNetworkAccess || 'enabled'}
                    onValueChange={(value: 'enabled' | 'disabled') => updateNetworking({ publicNetworkAccess: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enabled">Enabled</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Allow public network access to the Service Bus namespace
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Minimum TLS Version</Label>
                  <Select
                    value={networking.minimumTlsVersion || '1.2'}
                    onValueChange={(value: '1.0' | '1.1' | '1.2') => updateNetworking({ minimumTlsVersion: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.0">TLS 1.0</SelectItem>
                      <SelectItem value="1.1">TLS 1.1</SelectItem>
                      <SelectItem value="1.2">TLS 1.2</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Minimum TLS version required for connections
                  </p>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Firewall Rules</h3>
                      <p className="text-xs text-muted-foreground">IP address ranges allowed to access the namespace</p>
                    </div>
                    <Button onClick={addFirewallRule} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Rule
                    </Button>
                  </div>
                  {networking.firewallRules && networking.firewallRules.length > 0 ? (
                    <div className="space-y-2">
                      {networking.firewallRules.map((rule, index) => (
                        <Card key={index}>
                          <CardContent className="pt-4">
                            <div className="flex items-start gap-4">
                              <div className="flex-1 space-y-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">Name</Label>
                                  <Input
                                    value={rule.name}
                                    onChange={(e) => updateFirewallRule(index, 'name', e.target.value)}
                                    placeholder="rule-name"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">IP Range (CIDR)</Label>
                                  <Input
                                    value={rule.ipRange}
                                    onChange={(e) => updateFirewallRule(index, 'ipRange', e.target.value)}
                                    placeholder="10.0.0.0/8"
                                  />
                                </div>
                              </div>
                              <Button
                                onClick={() => removeFirewallRule(index)}
                                size="sm"
                                variant="ghost"
                                className="mt-6"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No firewall rules configured</p>
                  )}
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Virtual Network Rules</h3>
                      <p className="text-xs text-muted-foreground">Allow access from specific Azure subnets</p>
                    </div>
                    <Button onClick={addVirtualNetworkRule} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Rule
                    </Button>
                  </div>
                  {networking.virtualNetworkRules && networking.virtualNetworkRules.length > 0 ? (
                    <div className="space-y-2">
                      {networking.virtualNetworkRules.map((rule, index) => (
                        <Card key={index}>
                          <CardContent className="pt-4">
                            <div className="flex items-start gap-4">
                              <div className="flex-1 space-y-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">Name</Label>
                                  <Input
                                    value={rule.name}
                                    onChange={(e) => updateVirtualNetworkRule(index, 'name', e.target.value)}
                                    placeholder="vnet-rule-name"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Subnet Resource ID</Label>
                                  <Input
                                    value={rule.subnetId}
                                    onChange={(e) => updateVirtualNetworkRule(index, 'subnetId', e.target.value)}
                                    placeholder="/subscriptions/.../subnets/..."
                                  />
                                </div>
                              </div>
                              <Button
                                onClick={() => removeVirtualNetworkRule(index)}
                                size="sm"
                                variant="ghost"
                                className="mt-6"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No virtual network rules configured</p>
                  )}
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Private Endpoints</h3>
                      <p className="text-xs text-muted-foreground">Private endpoints for secure access from VNets</p>
                    </div>
                    <Button onClick={addPrivateEndpoint} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Endpoint
                    </Button>
                  </div>
                  {networking.privateEndpoints && networking.privateEndpoints.length > 0 ? (
                    <div className="space-y-2">
                      {networking.privateEndpoints.map((endpoint, index) => (
                        <Card key={index}>
                          <CardContent className="pt-4">
                            <div className="flex items-start gap-4">
                              <div className="flex-1 space-y-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">Name</Label>
                                  <Input
                                    value={endpoint.name}
                                    onChange={(e) => updatePrivateEndpoint(index, 'name', e.target.value)}
                                    placeholder="private-endpoint-name"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Subnet Resource ID</Label>
                                  <Input
                                    value={endpoint.subnetId}
                                    onChange={(e) => updatePrivateEndpoint(index, 'subnetId', e.target.value)}
                                    placeholder="/subscriptions/.../subnets/..."
                                  />
                                </div>
                              </div>
                              <Button
                                onClick={() => removePrivateEndpoint(index)}
                                size="sm"
                                variant="ghost"
                                className="mt-6"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No private endpoints configured</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Configure authentication and authorization for Azure Service Bus namespace</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Shared Access Signatures (SAS) Policies</h3>
                      <p className="text-xs text-muted-foreground">SAS policies for connection string authentication</p>
                    </div>
                    <Button onClick={addSASPolicy} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Policy
                    </Button>
                  </div>
                  {security.sasPolicies && security.sasPolicies.length > 0 ? (
                    <div className="space-y-2">
                      {security.sasPolicies.map((policy, index) => (
                        <Card key={index}>
                          <CardContent className="pt-4">
                            <div className="flex items-start gap-4">
                              <div className="flex-1 space-y-4">
                                <div className="space-y-1">
                                  <Label className="text-xs">Policy Name</Label>
                                  <Input
                                    value={policy.name}
                                    onChange={(e) => updateSASPolicy(index, 'name', e.target.value)}
                                    placeholder="policy-name"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Permissions</Label>
                                  <div className="flex gap-4">
                                    <div className="flex items-center space-x-2">
                                      <Switch
                                        checked={policy.permissions?.includes('Send') || false}
                                        onCheckedChange={() => toggleSASPermission(index, 'Send')}
                                      />
                                      <Label className="text-xs">Send</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Switch
                                        checked={policy.permissions?.includes('Listen') || false}
                                        onCheckedChange={() => toggleSASPermission(index, 'Listen')}
                                      />
                                      <Label className="text-xs">Listen</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Switch
                                        checked={policy.permissions?.includes('Manage') || false}
                                        onCheckedChange={() => toggleSASPermission(index, 'Manage')}
                                      />
                                      <Label className="text-xs">Manage</Label>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <Button
                                onClick={() => removeSASPolicy(index)}
                                size="sm"
                                variant="ghost"
                                className="mt-6"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No SAS policies configured</p>
                  )}
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Role-Based Access Control (RBAC)</h3>
                      <p className="text-xs text-muted-foreground">Azure RBAC role assignments</p>
                    </div>
                    <Button onClick={addRBACAssignment} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Assignment
                    </Button>
                  </div>
                  {security.rbacAssignments && security.rbacAssignments.length > 0 ? (
                    <div className="space-y-2">
                      {security.rbacAssignments.map((assignment, index) => (
                        <Card key={index}>
                          <CardContent className="pt-4">
                            <div className="flex items-start gap-4">
                              <div className="flex-1 space-y-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">Principal ID</Label>
                                  <Input
                                    value={assignment.principalId}
                                    onChange={(e) => updateRBACAssignment(index, 'principalId', e.target.value)}
                                    placeholder="User/Service Principal ID"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Role</Label>
                                  <Select
                                    value={assignment.role}
                                    onValueChange={(value: RBACAssignment['role']) => updateRBACAssignment(index, 'role', value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Owner">Owner</SelectItem>
                                      <SelectItem value="Contributor">Contributor</SelectItem>
                                      <SelectItem value="Reader">Reader</SelectItem>
                                      <SelectItem value="Azure Service Bus Data Owner">Data Owner</SelectItem>
                                      <SelectItem value="Azure Service Bus Data Receiver">Data Receiver</SelectItem>
                                      <SelectItem value="Azure Service Bus Data Sender">Data Sender</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <Button
                                onClick={() => removeRBACAssignment(index)}
                                size="sm"
                                variant="ghost"
                                className="mt-6"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No RBAC assignments configured</p>
                  )}
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Managed Identities</h3>
                      <p className="text-xs text-muted-foreground">System-assigned or user-assigned managed identities</p>
                    </div>
                    <Button onClick={addManagedIdentity} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Identity
                    </Button>
                  </div>
                  {security.managedIdentities && security.managedIdentities.length > 0 ? (
                    <div className="space-y-2">
                      {security.managedIdentities.map((identity, index) => (
                        <Card key={index}>
                          <CardContent className="pt-4">
                            <div className="flex items-start gap-4">
                              <div className="flex-1 space-y-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">Name</Label>
                                  <Input
                                    value={identity.name}
                                    onChange={(e) => updateManagedIdentity(index, 'name', e.target.value)}
                                    placeholder="identity-name"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Type</Label>
                                  <Select
                                    value={identity.type}
                                    onValueChange={(value: 'SystemAssigned' | 'UserAssigned') => updateManagedIdentity(index, 'type', value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="SystemAssigned">System Assigned</SelectItem>
                                      <SelectItem value="UserAssigned">User Assigned</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                {identity.type === 'UserAssigned' && (
                                  <div className="space-y-1">
                                    <Label className="text-xs">Principal ID</Label>
                                    <Input
                                      value={identity.principalId || ''}
                                      onChange={(e) => updateManagedIdentity(index, 'principalId', e.target.value)}
                                      placeholder="Principal ID"
                                    />
                                  </div>
                                )}
                              </div>
                              <Button
                                onClick={() => removeManagedIdentity(index)}
                                size="sm"
                                variant="ghost"
                                className="mt-6"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No managed identities configured</p>
                  )}
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

          <TabsContent value="messages" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Message Explorer</CardTitle>
                <CardDescription>View and manage messages in queues and subscriptions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Entity Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Entity Type</Label>
                    <Select
                      value={selectedEntityType}
                      onValueChange={(value: 'queue' | 'subscription') => {
                        setSelectedEntityType(value);
                        setSelectedQueueName('');
                        setSelectedTopicName('');
                        setSelectedSubscriptionName('');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="queue">Queue</SelectItem>
                        <SelectItem value="subscription">Subscription</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {selectedEntityType === 'queue' && (
                    <div className="space-y-2">
                      <Label>Queue</Label>
                      <Select
                        value={selectedQueueName}
                        onValueChange={setSelectedQueueName}
                      >
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
                  )}
                  
                  {selectedEntityType === 'subscription' && (
                    <>
                      <div className="space-y-2">
                        <Label>Topic</Label>
                        <Select
                          value={selectedTopicName}
                          onValueChange={(value) => {
                            setSelectedTopicName(value);
                            setSelectedSubscriptionName('');
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select topic" />
                          </SelectTrigger>
                          <SelectContent>
                            {topics.map((t) => (
                              <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Subscription</Label>
                        <Select
                          value={selectedSubscriptionName}
                          onValueChange={setSelectedSubscriptionName}
                          disabled={!selectedTopicName}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select subscription" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedTopicName && topics.find(t => t.name === selectedTopicName)?.subscriptions?.map((s) => (
                              <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>

                {/* View Options */}
                {(selectedEntityType === 'queue' && selectedQueueName) || 
                 (selectedEntityType === 'subscription' && selectedTopicName && selectedSubscriptionName) ? (
                  <>
                    <Separator />
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={showDeadLetterQueue}
                          onCheckedChange={(checked) => {
                            setShowDeadLetterQueue(checked);
                            if (checked) {
                              setShowDeferred(false);
                              setShowScheduled(false);
                              setShowLocked(false);
                            }
                          }}
                        />
                        <Label>Show Dead Letter Queue</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={showDeferred}
                          onCheckedChange={(checked) => {
                            setShowDeferred(checked);
                            if (checked) {
                              setShowDeadLetterQueue(false);
                              setShowScheduled(false);
                              setShowLocked(false);
                            }
                          }}
                        />
                        <Label>Show Deferred</Label>
                      </div>
                      {selectedEntityType === 'queue' && (
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={showScheduled}
                            onCheckedChange={(checked) => {
                              setShowScheduled(checked);
                              if (checked) {
                                setShowDeadLetterQueue(false);
                                setShowDeferred(false);
                                setShowLocked(false);
                              }
                            }}
                          />
                          <Label>Show Scheduled</Label>
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={showLocked}
                          onCheckedChange={(checked) => {
                            setShowLocked(checked);
                            if (checked) {
                              setShowDeadLetterQueue(false);
                              setShowDeferred(false);
                              setShowScheduled(false);
                            }
                          }}
                        />
                        <Label>Show Locked</Label>
                      </div>
                      <Button size="sm" variant="outline" onClick={loadMessages} className="ml-auto">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                      </Button>
                    </div>

                    {/* Search */}
                    <div className="space-y-2">
                      <Label>Search Messages</Label>
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search by message ID, properties, or body..."
                          className="pl-8"
                        />
                      </div>
                    </div>

                    {/* Messages Table */}
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Message ID</TableHead>
                            <TableHead>Sequence #</TableHead>
                            <TableHead>Enqueued Time</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Delivery Count</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {messages.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                No messages found
                              </TableCell>
                            </TableRow>
                          ) : (
                            messages.map((msg) => (
                              <TableRow key={msg.id || msg.messageId}>
                                <TableCell className="font-mono text-xs">
                                  {msg.messageId || msg.id}
                                </TableCell>
                                <TableCell>{msg.sequenceNumber || '-'}</TableCell>
                                <TableCell>
                                  {new Date(msg.enqueuedTime || msg.timestamp).toLocaleString()}
                                </TableCell>
                                <TableCell>{(msg.size || 0).toLocaleString()} bytes</TableCell>
                                <TableCell>{msg.deliveryCount || 0}</TableCell>
                                <TableCell>
                                  {msg.lockedUntil ? (
                                    <Badge variant="outline" className="text-orange-600">
                                      <Clock className="h-3 w-3 mr-1" />
                                      Locked
                                    </Badge>
                                  ) : msg.isDeferred ? (
                                    <Badge variant="outline" className="text-blue-600">
                                      Deferred
                                    </Badge>
                                  ) : showDeadLetterQueue ? (
                                    <Badge variant="destructive">Dead Letter</Badge>
                                  ) : (
                                    <Badge variant="outline">Active</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    {showDeadLetterQueue ? (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleResubmitMessage(msg.id || msg.messageId)}
                                          title="Resubmit"
                                        >
                                          <RotateCcw className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleDeleteDeadLetterMessage(msg.id || msg.messageId)}
                                          title="Delete"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </>
                                    ) : msg.lockToken ? (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleCompleteMessage(msg.lockToken!)}
                                          title="Complete"
                                        >
                                          <CheckCircle className="h-3 w-3 text-green-600" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleAbandonMessage(msg.lockToken!)}
                                          title="Abandon"
                                        >
                                          <XCircle className="h-3 w-3 text-orange-600" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleDeferMessage(msg.lockToken!)}
                                          title="Defer"
                                        >
                                          <Clock className="h-3 w-3 text-blue-600" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleSendToDeadLetter(msg.lockToken!)}
                                          title="Send to Dead Letter"
                                        >
                                          <AlertCircle className="h-3 w-3 text-red-600" />
                                        </Button>
                                      </>
                                    ) : null}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Showing {messages.length} message{messages.length !== 1 ? 's' : ''}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Select an entity to view messages
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


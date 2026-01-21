import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
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
import { useState, useEffect } from 'react';
import { emulationEngine } from '@/core/EmulationEngine';
import { 
  MessageSquare, 
  Database, 
  Activity, 
  Settings, 
  Plus, 
  Trash2,
  Edit2,
  X,
  Users,
  TrendingUp,
  ArrowRightLeft,
  Shield,
  Key,
  Network,
  Play,
  Pause,
  RefreshCcw
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, CheckCircle2, ArrowRight, Link2, Search, AlertCircle } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ActiveMQConfigProps {
  componentId: string;
}

interface RedeliveryPolicy {
  maxRedeliveries?: number; // Maximum number of redelivery attempts before sending to DLQ (default: 6)
  initialRedeliveryDelay?: number; // Initial delay before redelivery in milliseconds (default: 1000)
  maximumRedeliveryDelay?: number; // Maximum delay before redelivery in milliseconds (default: 60000)
  useExponentialBackOff?: boolean; // Use exponential backoff for redelivery delay (default: false)
  backOffMultiplier?: number; // Multiplier for exponential backoff (default: 2)
}

interface Queue {
  name: string;
  queueSize?: number;
  consumerCount?: number;
  enqueueCount?: number;
  dequeueCount?: number;
  memoryUsage?: number;
  memoryPercent?: number;
  memoryLimit?: number; // Memory limit in MB for this queue
  prefetch?: number; // Prefetch size for consumers
  defaultPriority?: number; // Default message priority (0-9)
  defaultTTL?: number; // Default message TTL in seconds
  maxRedeliveries?: number; // Maximum number of redelivery attempts before sending to DLQ (default: 6) - DEPRECATED: use redeliveryPolicy
  redeliveryPolicy?: RedeliveryPolicy; // Redelivery policy configuration
}

interface Topic {
  name: string;
  subscriberCount?: number;
  enqueueCount?: number;
  dequeueCount?: number;
  memoryUsage?: number;
  memoryPercent?: number;
  memoryLimit?: number; // Memory limit in MB for this topic
  defaultPriority?: number; // Default message priority (0-9)
  defaultTTL?: number; // Default message TTL in seconds
  maxRedeliveries?: number; // Maximum number of redelivery attempts before sending to DLQ (default: 6) - DEPRECATED: use redeliveryPolicy
  redeliveryPolicy?: RedeliveryPolicy; // Redelivery policy configuration
}

interface Connection {
  id: string;
  remoteAddress?: string;
  clientId?: string;
  userName?: string;
  connectedSince?: string;
  messageCount?: number;
  protocol?: 'OpenWire' | 'AMQP' | 'MQTT' | 'STOMP' | 'WebSocket';
}

interface Subscription {
  id: string;
  destination: string;
  clientId: string;
  selector?: string;
  pendingQueueSize?: number;
  dispatchedQueueSize?: number;
  dispatchedCounter?: number;
  enqueueCounter?: number;
  dequeueCounter?: number;
}

interface ActiveMQConfig {
  brokerName?: string;
  brokerUrl?: string;
  protocol?: 'amqp' | 'openwire' | 'mqtt' | 'stomp' | 'ws';
  port?: number;
  username?: string;
  password?: string;
  queues?: Queue[];
  topics?: Topic[];
  connections?: Connection[];
  subscriptions?: Subscription[];
  persistenceEnabled?: boolean;
  maxConnections?: number;
  memoryLimit?: number;
  storeUsage?: number;
  tempUsage?: number;
  consumptionRate?: number;
  avgMessageSize?: number;
  protocolLatencies?: Record<string, number>;
  memoryPressureThreshold?: number;
  queueLatencyBase?: number;
  queueLatencyFactor?: number;
  deadLetterQueue?: string; // Dead Letter Queue name (default: 'DLQ')
  acls?: Array<{
    principal: string;
    resource: string;
    operation: string;
    permission: 'allow' | 'deny';
  }>;
}

export function ActiveMQConfigAdvanced({ componentId }: ActiveMQConfigProps) {
  const { nodes, updateNode, connections } = useCanvasStore();
  const { isRunning, start, stop, updateMetrics } = useEmulationStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as ActiveMQConfig;
  const brokerName = config.brokerName || 'localhost';
  const brokerUrl = config.brokerUrl || 'tcp://localhost:61616';
  const protocol = config.protocol || 'openwire';
  const port = config.port || 61616;
  const username = config.username || 'admin';
  const password = config.password || 'admin';
  const queues = config.queues || [];
  const topics = config.topics || [];
  // Connections and subscriptions are runtime data - they are created automatically
  // when other components connect to this broker during simulation
  const activeMQConnections = config.connections || []; // Created dynamically from canvas connections
  const subscriptions = config.subscriptions || []; // Created dynamically when clients subscribe to topics
  const persistenceEnabled = config.persistenceEnabled ?? true;
  const maxConnections = config.maxConnections || 1000;
  const memoryLimit = config.memoryLimit || 1024;
  const consumptionRate = config.consumptionRate ?? 10;
  const storeUsage = config.storeUsage || 0;
  const tempUsage = config.tempUsage || 0;
  const avgMessageSize = config.avgMessageSize ?? 1024;
  const protocolLatencies = config.protocolLatencies || {
    openwire: 2,
    amqp: 5,
    mqtt: 8,
    stomp: 10,
    ws: 12,
  };
  const memoryPressureThreshold = config.memoryPressureThreshold ?? 0.8;
  const queueLatencyBase = config.queueLatencyBase ?? 0;
  const queueLatencyFactor = config.queueLatencyFactor ?? 1;
  const deadLetterQueue = config.deadLetterQueue || 'DLQ';
  const acls = config.acls || [];

  const [showCreateAcl, setShowCreateAcl] = useState(false);
  const [aclForm, setAclForm] = useState({
    principal: '',
    resource: '',
    operation: 'read' as 'read' | 'write' | 'admin' | 'create',
    permission: 'allow' as 'allow' | 'deny',
  });

  // Sync routing engine when config changes (queues, topics, consumptionRate)
  useEffect(() => {
    if (!node) return;
    
    const routingEngine = emulationEngine.getActiveMQRoutingEngine(componentId);
    if (!routingEngine) return;

    const currentConfig = (node.data.config as any) || {};
    
    // Update routing engine configuration
    routingEngine.initialize({
      queues: currentConfig.queues || [],
      topics: currentConfig.topics || [],
      subscriptions: currentConfig.subscriptions || [],
      consumptionRate: currentConfig.consumptionRate ?? 10,
      deadLetterQueue: currentConfig.deadLetterQueue || 'DLQ',
    });

    // Update nodes and connections to ensure routing engine is properly initialized
    emulationEngine.updateNodesAndConnections(nodes, connections);
  }, [componentId, queues.length, topics.length, consumptionRate, deadLetterQueue, node?.id, nodes, connections]);

  const updateConfig = (updates: Partial<ActiveMQConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addQueue = () => {
    const queueName = `queue-${Date.now()}`;
    updateConfig({
      queues: [
        ...queues,
        { name: queueName, queueSize: 0, consumerCount: 0, enqueueCount: 0, dequeueCount: 0, memoryUsage: 0, memoryPercent: 0 },
      ],
    });
    showSuccess('Queue added successfully');
  };

  const removeQueue = (index: number) => {
    updateConfig({ queues: queues.filter((_, i) => i !== index) });
  };

  const validateQueueName = (name: string): string | null => {
    if (!name || name.trim() === '') {
      return 'Queue name cannot be empty';
    }
    if (name.length > 255) {
      return 'Queue name cannot exceed 255 characters';
    }
    // ActiveMQ queue names should not contain certain characters
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
      return 'Queue name can only contain letters, numbers, dots, underscores, and hyphens';
    }
    if (name.startsWith('.') || name.endsWith('.')) {
      return 'Queue name cannot start or end with a dot';
    }
    return null;
  };

  const updateQueue = (index: number, field: keyof Queue, value: any) => {
    if (field === 'name') {
      const error = validateQueueName(value);
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

  const [editingQueueIndex, setEditingQueueIndex] = useState<number | null>(null);
  const [queueNameErrors, setQueueNameErrors] = useState<Record<number, string>>({});

  const addTopic = () => {
    const topicName = `topic-${Date.now()}`;
    updateConfig({
      topics: [
        ...topics,
        { name: topicName, subscriberCount: 0, enqueueCount: 0, dequeueCount: 0, memoryUsage: 0, memoryPercent: 0 },
      ],
    });
    showSuccess('Topic added successfully');
  };

  const removeTopic = (index: number) => {
    updateConfig({ topics: topics.filter((_, i) => i !== index) });
  };

  const validateTopicName = (name: string): string | null => {
    if (!name || name.trim() === '') {
      return 'Topic name cannot be empty';
    }
    if (name.length > 255) {
      return 'Topic name cannot exceed 255 characters';
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
      return 'Topic name can only contain letters, numbers, dots, underscores, and hyphens';
    }
    if (name.startsWith('.') || name.endsWith('.')) {
      return 'Topic name cannot start or end with a dot';
    }
    return null;
  };

  const updateTopic = (index: number, field: keyof Topic, value: any) => {
    if (field === 'name') {
      const error = validateTopicName(value);
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

  const [editingTopicIndex, setEditingTopicIndex] = useState<number | null>(null);
  const [topicNameErrors, setTopicNameErrors] = useState<Record<number, string>>({});

  // Search and filter states
  const [queueSearchQuery, setQueueSearchQuery] = useState('');
  const [topicSearchQuery, setTopicSearchQuery] = useState('');
  const [connectionSearchQuery, setConnectionSearchQuery] = useState('');
  const [subscriptionSearchQuery, setSubscriptionSearchQuery] = useState('');

  // Delete confirmation dialogs
  const [deleteQueueIndex, setDeleteQueueIndex] = useState<number | null>(null);
  const [deleteTopicIndex, setDeleteTopicIndex] = useState<number | null>(null);

  // ACL validation
  const [aclResourceError, setAclResourceError] = useState<string | null>(null);

  // Subscription editing
  const [editingSelectorIndex, setEditingSelectorIndex] = useState<number | null>(null);
  const [selectorValues, setSelectorValues] = useState<Record<number, string>>({});

  // Topics can only be added/removed, not edited
  // Name editing is not allowed - topics are identified by name

  // Connections and subscriptions are created dynamically by clients at runtime
  // They cannot be manually added/removed through the UI

  // Filter queues, topics, connections, subscriptions
  const filteredQueues = queues.filter(q => 
    q.name.toLowerCase().includes(queueSearchQuery.toLowerCase())
  );
  const filteredTopics = topics.filter(t => 
    t.name.toLowerCase().includes(topicSearchQuery.toLowerCase())
  );
  const filteredConnections = activeMQConnections.filter(c => 
    (c.clientId || '').toLowerCase().includes(connectionSearchQuery.toLowerCase()) ||
    (c.remoteAddress || '').toLowerCase().includes(connectionSearchQuery.toLowerCase())
  );
  const filteredSubscriptions = subscriptions.filter(s => 
    (s.clientId || '').toLowerCase().includes(subscriptionSearchQuery.toLowerCase()) ||
    (s.destination || '').toLowerCase().includes(subscriptionSearchQuery.toLowerCase())
  );

  // Validate ACL resource format
  const validateAclResource = (resource: string): string | null => {
    if (!resource || resource.trim() === '') {
      return 'Resource cannot be empty';
    }
    // Check format: queue://name, topic://name, or wildcard *
    if (resource === '*') {
      return null; // Wildcard is valid
    }
    if (!resource.includes('://')) {
      return 'Resource must be in format queue://name or topic://name (or use * for all)';
    }
    const [prefix, name] = resource.split('://');
    if (prefix !== 'queue' && prefix !== 'topic') {
      return 'Resource prefix must be "queue" or "topic"';
    }
    if (!name || name.trim() === '') {
      return 'Resource name cannot be empty';
    }
    if (name !== '*' && !/^[a-zA-Z0-9._*-]+$/.test(name)) {
      return 'Resource name can only contain letters, numbers, dots, underscores, hyphens, and asterisks';
    }
    return null;
  };

  const addAcl = () => {
    // Validate resource format
    const resourceError = validateAclResource(aclForm.resource);
    if (resourceError) {
      setAclResourceError(resourceError);
      return;
    }
    setAclResourceError(null);
    if (!aclForm.principal || !aclForm.resource) {
      return; // Don't add if required fields are empty
    }
    const newAcl = {
      principal: aclForm.principal,
      resource: aclForm.resource,
      operation: aclForm.operation,
      permission: aclForm.permission,
    };
    updateConfig({ acls: [...acls, newAcl] });
    setShowCreateAcl(false);
    showSuccess('ACL rule added successfully');
    // Reset form
    setAclForm({
      principal: '',
      resource: '',
      operation: 'read',
      permission: 'allow',
    });
  };

  const removeAcl = (index: number) => {
    updateConfig({ acls: acls.filter((_, i) => i !== index) });
    showSuccess('ACL rule removed successfully');
  };

  const handleRemoveQueue = (index: number) => {
    const queue = queues[index];
    if (queue && (queue.queueSize || 0) > 0) {
      setDeleteQueueIndex(index);
    } else {
      confirmRemoveQueue(index);
    }
  };

  const confirmRemoveQueue = (index: number) => {
    updateConfig({ queues: queues.filter((_, i) => i !== index) });
    setDeleteQueueIndex(null);
    showSuccess('Queue removed successfully');
  };

  const handleRemoveTopic = (index: number) => {
    const topic = topics[index];
    // Check if topic has subscriptions
    const hasSubscriptions = subscriptions.some(s => s.destination === topic.name);
    if (hasSubscriptions) {
      setDeleteTopicIndex(index);
    } else {
      confirmRemoveTopic(index);
    }
  };

  const confirmRemoveTopic = (index: number) => {
    updateConfig({ topics: topics.filter((_, i) => i !== index) });
    setDeleteTopicIndex(null);
    showSuccess('Topic removed successfully');
  };

  const totalMessages = queues.reduce((sum, q) => sum + (q.queueSize || 0), 0);
  const totalConsumers = queues.reduce((sum, q) => sum + (q.consumerCount || 0), 0);
  const totalSubscribers = topics.reduce((sum, t) => sum + (t.subscriberCount || 0), 0);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">ActiveMQ Broker</p>
            <h2 className="text-2xl font-bold text-foreground">Broker Management</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure ActiveMQ broker, queues, topics, connections and security
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => updateMetrics()}
              title="Manually refresh broker metrics (metrics update automatically during simulation)"
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh Metrics
            </Button>
          </div>
        </div>

        <Separator />

        {/* Setup Instructions */}
        {queues.length === 0 && topics.length === 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Getting Started</AlertTitle>
            <AlertDescription className="space-y-2 mt-2">
              <p>To start using ActiveMQ broker, follow these steps:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Configure at least one <strong>Queue</strong> or <strong>Topic</strong> in the tabs below</li>
                <li>Connect other components (producers/consumers) to this broker</li>
                <li>Start the simulation from the Emulation Panel to see metrics</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Note:</strong> Queues and Topics are configuration - they define what destinations are available. 
                Connections and Subscriptions are created automatically by clients at runtime.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Overview Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Broker Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${isRunning ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                <span className="text-lg font-semibold">{isRunning ? 'Running' : 'Stopped'}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{brokerName}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{totalMessages.toLocaleString()}</span>
              <p className="text-xs text-muted-foreground mt-1">Across all queues</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{activeMQConnections.length}</span>
              <p className="text-xs text-muted-foreground mt-1">Connected clients</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Store: {storeUsage} MB</span>
                  <span>Temp: {tempUsage} MB</span>
                </div>
                <Progress value={(storeUsage + tempUsage) / memoryLimit * 100} className="h-2" />
                <p className="text-xs text-muted-foreground">Limit: {memoryLimit} MB</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="broker" className="space-y-4">
          <TabsList className="flex w-full flex-wrap gap-1">
            <TabsTrigger value="broker" className="gap-2">
              <Settings className="h-4 w-4" />
              Broker
            </TabsTrigger>
            <TabsTrigger value="queues" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Queues ({queues.length})
            </TabsTrigger>
            <TabsTrigger value="topics" className="gap-2">
              <Database className="h-4 w-4" />
              Topics ({topics.length})
            </TabsTrigger>
            <TabsTrigger value="connections" className="gap-2">
              <Network className="h-4 w-4" />
              Connections ({activeMQConnections.length})
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="gap-2">
              <Users className="h-4 w-4" />
              Subscriptions ({subscriptions.length})
            </TabsTrigger>
            <TabsTrigger value="dlq" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Dead Letter Queue
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Broker Configuration */}
          <TabsContent value="broker" className="space-y-4">
            <Alert className="mb-4">
              <Info className="h-4 w-4" />
              <AlertTitle>Broker Configuration</AlertTitle>
              <AlertDescription className="text-sm">
                Configure connection settings, protocols, and broker limits. These settings affect how clients connect to the broker and how messages are processed.
              </AlertDescription>
            </Alert>
            <Card>
              <CardHeader>
                <CardTitle>Broker Configuration</CardTitle>
                <CardDescription>Basic broker settings and connection parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="brokerName">Broker Name</Label>
                    <Input
                      id="brokerName"
                      value={brokerName}
                      onChange={(e) => updateConfig({ brokerName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brokerUrl">Broker URL</Label>
                    <Input
                      id="brokerUrl"
                      value={brokerUrl}
                      onChange={(e) => updateConfig({ brokerUrl: e.target.value })}
                      placeholder="tcp://localhost:61616"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="protocol">Protocol</Label>
                    <Select value={protocol} onValueChange={(value: any) => updateConfig({ protocol: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openwire">OpenWire</SelectItem>
                        <SelectItem value="amqp">AMQP</SelectItem>
                        <SelectItem value="mqtt">MQTT</SelectItem>
                        <SelectItem value="stomp">STOMP</SelectItem>
                        <SelectItem value="ws">WebSocket</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="number"
                      value={port}
                      onChange={(e) => updateConfig({ port: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => updateConfig({ username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => updateConfig({ password: e.target.value })}
                    />
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="persistenceEnabled">Persistence Enabled</Label>
                      <p className="text-xs text-muted-foreground">Persist messages to disk</p>
                    </div>
                    <Switch
                      id="persistenceEnabled"
                      checked={persistenceEnabled}
                      onCheckedChange={(checked) => updateConfig({ persistenceEnabled: checked })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxConnections">Max Connections</Label>
                      <Input
                        id="maxConnections"
                        type="number"
                        value={maxConnections}
                        onChange={(e) => updateConfig({ maxConnections: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="memoryLimit">Memory Limit (MB)</Label>
                      <Input
                        id="memoryLimit"
                        type="number"
                        value={memoryLimit}
                        onChange={(e) => updateConfig({ memoryLimit: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="consumptionRate">Consumption Rate (msgs/sec per consumer)</Label>
                      <Input
                        id="consumptionRate"
                        type="number"
                        min="1"
                        value={consumptionRate}
                        onChange={(e) => updateConfig({ consumptionRate: Number(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Number of messages per second that each consumer can process
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deadLetterQueue">Dead Letter Queue Name</Label>
                      <Input
                        id="deadLetterQueue"
                        value={deadLetterQueue}
                        onChange={(e) => updateConfig({ deadLetterQueue: e.target.value || 'DLQ' })}
                        placeholder="DLQ"
                      />
                      <p className="text-xs text-muted-foreground">
                        Name of the Dead Letter Queue for failed messages (default: DLQ)
                      </p>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Advanced Performance Settings</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="avgMessageSize">Average Message Size (bytes)</Label>
                      <Input
                        id="avgMessageSize"
                        type="number"
                        min="1"
                        value={avgMessageSize}
                        onChange={(e) => updateConfig({ avgMessageSize: Number(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Average size of messages in bytes (used for throughput calculation)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="memoryPressureThreshold">Memory Pressure Threshold</Label>
                      <Input
                        id="memoryPressureThreshold"
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={memoryPressureThreshold}
                        onChange={(e) => updateConfig({ memoryPressureThreshold: Number(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Memory usage threshold (0.0-1.0) that triggers additional latency
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="queueLatencyBase">Queue Latency Base (ms)</Label>
                      <Input
                        id="queueLatencyBase"
                        type="number"
                        min="0"
                        value={queueLatencyBase}
                        onChange={(e) => updateConfig({ queueLatencyBase: Number(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Base latency in milliseconds added to queue latency calculation
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="queueLatencyFactor">Queue Latency Factor</Label>
                      <Input
                        id="queueLatencyFactor"
                        type="number"
                        min="0"
                        step="0.1"
                        value={queueLatencyFactor}
                        onChange={(e) => updateConfig({ queueLatencyFactor: Number(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Factor for calculating latency based on queue depth (ms per 1000 messages)
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Protocol Latencies (ms)</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Configure base latency for each protocol
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      {(['openwire', 'amqp', 'mqtt', 'stomp', 'ws'] as const).map((proto) => (
                        <div key={proto} className="space-y-2">
                          <Label htmlFor={`protocol-${proto}`} className="text-xs capitalize">
                            {proto === 'ws' ? 'WebSocket' : proto.toUpperCase()}
                          </Label>
                          <Input
                            id={`protocol-${proto}`}
                            type="number"
                            min="0"
                            value={protocolLatencies[proto] || 5}
                            onChange={(e) => {
                              const newLatencies = { ...protocolLatencies };
                              newLatencies[proto] = Number(e.target.value);
                              updateConfig({ protocolLatencies: newLatencies });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Queues */}
          <TabsContent value="queues" className="space-y-4">
            <Alert className="mb-4">
              <Info className="h-4 w-4" />
              <AlertTitle>Queue Configuration</AlertTitle>
              <AlertDescription className="text-sm space-y-1">
                <p>Configure queues for point-to-point messaging. Each queue represents a destination where producers send messages and consumers receive them.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>Tip:</strong> To send messages to a queue, connect a producer component and specify the queue name in the connection settings.
                </p>
              </AlertDescription>
            </Alert>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Queues</CardTitle>
                    <CardDescription>Configure message queues (queues are created dynamically by clients at runtime)</CardDescription>
                  </div>
                  <Button onClick={addQueue} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Queue Config
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search queues..."
                      value={queueSearchQuery}
                      onChange={(e) => setQueueSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {queueSearchQuery && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Showing {filteredQueues.length} of {queues.length} queues
                    </p>
                  )}
                </div>
                <div className="space-y-4">
                  {filteredQueues.map((queue, index) => {
                    const originalIndex = queues.findIndex(q => q.name === queue.name);
                    const queueSize = queue.queueSize || 0;
                    const consumerCount = queue.consumerCount || 0;
                    // Determine queue status
                    let queueStatus: 'empty' | 'normal' | 'warning' | 'full' = 'empty';
                    let statusColor = 'bg-gray-500';
                    if (queueSize === 0) {
                      queueStatus = 'empty';
                      statusColor = 'bg-gray-500';
                    } else if (queueSize < 100) {
                      queueStatus = 'normal';
                      statusColor = 'bg-green-500';
                    } else if (queueSize < 1000) {
                      queueStatus = 'warning';
                      statusColor = 'bg-yellow-500';
                    } else {
                      queueStatus = 'full';
                      statusColor = 'bg-red-500';
                    }
                    return (
                    <Card key={originalIndex} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <MessageSquare className="h-5 w-5 text-blue-500" />
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={statusColor}>
                                {queueStatus.charAt(0).toUpperCase() + queueStatus.slice(1)}
                              </Badge>
                            </div>
                            {editingQueueIndex === originalIndex ? (
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={queue.name}
                                    onChange={(e) => updateQueue(originalIndex, 'name', e.target.value)}
                                    placeholder="queue-name"
                                    className={`flex-1 ${queueNameErrors[originalIndex] ? 'border-red-500' : ''}`}
                                    onBlur={() => {
                                      if (!queueNameErrors[originalIndex]) {
                                        setEditingQueueIndex(null);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !queueNameErrors[originalIndex]) {
                                        setEditingQueueIndex(null);
                                      }
                                      if (e.key === 'Escape') {
                                        setEditingQueueIndex(null);
                                        const newErrors = { ...queueNameErrors };
                                        delete newErrors[originalIndex];
                                        setQueueNameErrors(newErrors);
                                      }
                                    }}
                                    autoFocus
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      if (!queueNameErrors[originalIndex]) {
                                        setEditingQueueIndex(null);
                                      }
                                    }}
                                    disabled={!!queueNameErrors[originalIndex]}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                                {queueNameErrors[originalIndex] && (
                                  <p className="text-xs text-red-500">{queueNameErrors[originalIndex]}</p>
                                )}
                              </div>
                            ) : (
                              <>
                                <CardTitle className="text-base">
                                  {queue.name}
                                </CardTitle>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => setEditingQueueIndex(originalIndex)}
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                          {editingQueueIndex !== originalIndex && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveQueue(originalIndex)}
                              disabled={queues.length === 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Queue Size Progress */}
                          {queueSize > 0 && (
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-muted-foreground">Queue Size</span>
                                <span className="font-medium">{queueSize} messages</span>
                              </div>
                              <Progress 
                                value={Math.min(100, (queueSize / 1000) * 100)} 
                                className="h-2"
                              />
                            </div>
                          )}
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Queue Size</p>
                              <p className="text-lg font-semibold">{queue.queueSize || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Consumers</p>
                              <p className="text-lg font-semibold">{queue.consumerCount || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Enqueued</p>
                              <p className="text-lg font-semibold">{(queue.enqueueCount || 0).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Dequeued</p>
                              <p className="text-lg font-semibold">{(queue.dequeueCount || 0).toLocaleString()}</p>
                            </div>
                          </div>
                          <Separator />
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor={`queue-memory-limit-${originalIndex}`} className="text-xs">
                                Memory Limit (MB)
                              </Label>
                              <Input
                                id={`queue-memory-limit-${originalIndex}`}
                                type="number"
                                min="0"
                                value={queue.memoryLimit || ''}
                                onChange={(e) => updateQueue(originalIndex, 'memoryLimit', e.target.value ? Number(e.target.value) : undefined)}
                                placeholder="Unlimited"
                              />
                              <p className="text-xs text-muted-foreground">
                                Maximum memory usage for this queue (0 = unlimited)
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`queue-prefetch-${originalIndex}`} className="text-xs">
                                Prefetch Size
                              </Label>
                              <Input
                                id={`queue-prefetch-${originalIndex}`}
                                type="number"
                                min="0"
                                value={queue.prefetch || ''}
                                onChange={(e) => updateQueue(originalIndex, 'prefetch', e.target.value ? Number(e.target.value) : undefined)}
                                placeholder="Default"
                              />
                              <p className="text-xs text-muted-foreground">
                                Number of messages to prefetch per consumer (0 = default)
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`queue-priority-${originalIndex}`} className="text-xs">
                                Default Priority (0-9)
                              </Label>
                              <Input
                                id={`queue-priority-${originalIndex}`}
                                type="number"
                                min="0"
                                max="9"
                                value={queue.defaultPriority !== undefined ? queue.defaultPriority : ''}
                                onChange={(e) => updateQueue(originalIndex, 'defaultPriority', e.target.value ? Number(e.target.value) : undefined)}
                                placeholder="Default"
                              />
                              <p className="text-xs text-muted-foreground">
                                Default message priority for this queue (0 = lowest, 9 = highest)
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`queue-ttl-${originalIndex}`} className="text-xs">
                                Default TTL (seconds)
                              </Label>
                              <Input
                                id={`queue-ttl-${originalIndex}`}
                                type="number"
                                min="0"
                                value={queue.defaultTTL !== undefined ? queue.defaultTTL : ''}
                                onChange={(e) => updateQueue(originalIndex, 'defaultTTL', e.target.value ? Number(e.target.value) : undefined)}
                                placeholder="Unlimited"
                              />
                              <p className="text-xs text-muted-foreground">
                                Default message time-to-live in seconds (0 = unlimited)
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`queue-max-redeliveries-${originalIndex}`} className="text-xs">
                                Max Redeliveries
                              </Label>
                              <Input
                                id={`queue-max-redeliveries-${originalIndex}`}
                                type="number"
                                min="0"
                                value={queue.redeliveryPolicy?.maxRedeliveries !== undefined 
                                  ? queue.redeliveryPolicy.maxRedeliveries 
                                  : (queue.maxRedeliveries !== undefined ? queue.maxRedeliveries : '')}
                                onChange={(e) => {
                                  const value = e.target.value ? Number(e.target.value) : undefined;
                                  const currentPolicy = queue.redeliveryPolicy || {};
                                  updateQueue(originalIndex, 'redeliveryPolicy', {
                                    ...currentPolicy,
                                    maxRedeliveries: value,
                                  });
                                  // Also update deprecated field for backward compatibility
                                  if (!queue.redeliveryPolicy) {
                                    updateQueue(originalIndex, 'maxRedeliveries', value);
                                  }
                                }}
                                placeholder="6 (default)"
                              />
                              <p className="text-xs text-muted-foreground">
                                Maximum number of redelivery attempts before sending to DLQ (default: 6)
                              </p>
                            </div>
                          </div>
                          <Separator />
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <Label className="text-sm font-semibold">Redelivery Policy</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Info className="h-4 w-4 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Configure how failed messages are redelivered</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor={`queue-initial-redelivery-delay-${originalIndex}`} className="text-xs">
                                  Initial Redelivery Delay (ms)
                                </Label>
                                <Input
                                  id={`queue-initial-redelivery-delay-${originalIndex}`}
                                  type="number"
                                  min="0"
                                  value={queue.redeliveryPolicy?.initialRedeliveryDelay !== undefined 
                                    ? queue.redeliveryPolicy.initialRedeliveryDelay 
                                    : ''}
                                  onChange={(e) => {
                                    const value = e.target.value ? Number(e.target.value) : undefined;
                                    const currentPolicy = queue.redeliveryPolicy || {};
                                    updateQueue(originalIndex, 'redeliveryPolicy', {
                                      ...currentPolicy,
                                      initialRedeliveryDelay: value,
                                    });
                                  }}
                                  placeholder="1000 (default)"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Initial delay before redelivery in milliseconds (default: 1000)
                                </p>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`queue-maximum-redelivery-delay-${originalIndex}`} className="text-xs">
                                  Maximum Redelivery Delay (ms)
                                </Label>
                                <Input
                                  id={`queue-maximum-redelivery-delay-${originalIndex}`}
                                  type="number"
                                  min="0"
                                  value={queue.redeliveryPolicy?.maximumRedeliveryDelay !== undefined 
                                    ? queue.redeliveryPolicy.maximumRedeliveryDelay 
                                    : ''}
                                  onChange={(e) => {
                                    const value = e.target.value ? Number(e.target.value) : undefined;
                                    const currentPolicy = queue.redeliveryPolicy || {};
                                    updateQueue(originalIndex, 'redeliveryPolicy', {
                                      ...currentPolicy,
                                      maximumRedeliveryDelay: value,
                                    });
                                  }}
                                  placeholder="60000 (default)"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Maximum delay before redelivery in milliseconds (default: 60000)
                                </p>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`queue-backoff-multiplier-${originalIndex}`} className="text-xs">
                                  Backoff Multiplier
                                </Label>
                                <Input
                                  id={`queue-backoff-multiplier-${originalIndex}`}
                                  type="number"
                                  min="1"
                                  step="0.1"
                                  value={queue.redeliveryPolicy?.backOffMultiplier !== undefined 
                                    ? queue.redeliveryPolicy.backOffMultiplier 
                                    : ''}
                                  onChange={(e) => {
                                    const value = e.target.value ? Number(e.target.value) : undefined;
                                    const currentPolicy = queue.redeliveryPolicy || {};
                                    updateQueue(originalIndex, 'redeliveryPolicy', {
                                      ...currentPolicy,
                                      backOffMultiplier: value,
                                    });
                                  }}
                                  placeholder="2 (default)"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Multiplier for exponential backoff (default: 2)
                                </p>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2 pt-6">
                                  <Switch
                                    id={`queue-use-exponential-backoff-${originalIndex}`}
                                    checked={queue.redeliveryPolicy?.useExponentialBackOff ?? false}
                                    onCheckedChange={(checked) => {
                                      const currentPolicy = queue.redeliveryPolicy || {};
                                      updateQueue(originalIndex, 'redeliveryPolicy', {
                                        ...currentPolicy,
                                        useExponentialBackOff: checked,
                                      });
                                    }}
                                  />
                                  <Label htmlFor={`queue-use-exponential-backoff-${originalIndex}`} className="text-xs cursor-pointer">
                                    Use Exponential Backoff
                                  </Label>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Enable exponential backoff for redelivery delay (default: false)
                                </p>
                              </div>
                            </div>
                          </div>
                          {queue.memoryUsage !== undefined && (
                            <div className="mt-4">
                              <div className="flex justify-between text-xs mb-1">
                                <span>Memory Usage</span>
                                <span>{queue.memoryUsage} MB ({queue.memoryPercent || 0}%)</span>
                              </div>
                              <Progress value={queue.memoryPercent || 0} className="h-2" />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Topics */}
          <TabsContent value="topics" className="space-y-4">
            <Alert className="mb-4">
              <Info className="h-4 w-4" />
              <AlertTitle>Topic Configuration</AlertTitle>
              <AlertDescription className="text-sm space-y-1">
                <p>Configure topics for publish-subscribe messaging. Publishers send messages to topics, and all subscribers receive copies of the messages.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>Tip:</strong> To publish messages, connect a producer component and specify the topic name. Multiple consumers can subscribe to the same topic.
                </p>
              </AlertDescription>
            </Alert>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Topics</CardTitle>
                    <CardDescription>Configure publish-subscribe topics (topics are created dynamically by clients at runtime)</CardDescription>
                  </div>
                  <Button onClick={addTopic} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Topic Config
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search topics..."
                      value={topicSearchQuery}
                      onChange={(e) => setTopicSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {topicSearchQuery && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Showing {filteredTopics.length} of {topics.length} topics
                    </p>
                  )}
                </div>
                <div className="space-y-4">
                  {filteredTopics.map((topic, index) => {
                    const originalIndex = topics.findIndex(t => t.name === topic.name);
                    const subscriberCount = topic.subscriberCount || 0;
                    return (
                    <Card key={originalIndex} className="border-l-4 border-l-green-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <Database className="h-5 w-5 text-green-500" />
                            {editingTopicIndex === originalIndex ? (
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={topic.name}
                                    onChange={(e) => updateTopic(originalIndex, 'name', e.target.value)}
                                    placeholder="topic-name"
                                    className={`flex-1 ${topicNameErrors[originalIndex] ? 'border-red-500' : ''}`}
                                    onBlur={() => {
                                      if (!topicNameErrors[originalIndex]) {
                                        setEditingTopicIndex(null);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !topicNameErrors[originalIndex]) {
                                        setEditingTopicIndex(null);
                                      }
                                      if (e.key === 'Escape') {
                                        setEditingTopicIndex(null);
                                        const newErrors = { ...topicNameErrors };
                                        delete newErrors[originalIndex];
                                        setTopicNameErrors(newErrors);
                                      }
                                    }}
                                    autoFocus
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      if (!topicNameErrors[originalIndex]) {
                                        setEditingTopicIndex(null);
                                      }
                                    }}
                                    disabled={!!topicNameErrors[originalIndex]}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                                {topicNameErrors[originalIndex] && (
                                  <p className="text-xs text-red-500">{topicNameErrors[originalIndex]}</p>
                                )}
                              </div>
                            ) : (
                              <>
                                <CardTitle className="text-base">
                                  {topic.name}
                                </CardTitle>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => setEditingTopicIndex(originalIndex)}
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                          {editingTopicIndex !== originalIndex && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveTopic(originalIndex)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Subscribers</p>
                            <p className="text-lg font-semibold">{topic.subscriberCount || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Enqueued</p>
                            <p className="text-lg font-semibold">{(topic.enqueueCount || 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Dequeued</p>
                            <p className="text-lg font-semibold">{(topic.dequeueCount || 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Memory</p>
                            <p className="text-lg font-semibold">{topic.memoryUsage || 0} MB</p>
                          </div>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`topic-memory-limit-${originalIndex}`} className="text-xs">
                              Memory Limit (MB)
                            </Label>
                            <Input
                              id={`topic-memory-limit-${originalIndex}`}
                              type="number"
                              min="0"
                              value={topic.memoryLimit || ''}
                              onChange={(e) => updateTopic(originalIndex, 'memoryLimit', e.target.value ? Number(e.target.value) : undefined)}
                              placeholder="Unlimited"
                            />
                            <p className="text-xs text-muted-foreground">
                              Maximum memory usage for this topic (0 = unlimited)
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`topic-priority-${originalIndex}`} className="text-xs">
                              Default Priority (0-9)
                            </Label>
                            <Input
                              id={`topic-priority-${originalIndex}`}
                              type="number"
                              min="0"
                              max="9"
                              value={topic.defaultPriority !== undefined ? topic.defaultPriority : ''}
                              onChange={(e) => updateTopic(originalIndex, 'defaultPriority', e.target.value ? Number(e.target.value) : undefined)}
                              placeholder="Default"
                            />
                            <p className="text-xs text-muted-foreground">
                              Default message priority for this topic (0 = lowest, 9 = highest)
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`topic-ttl-${originalIndex}`} className="text-xs">
                              Default TTL (seconds)
                            </Label>
                            <Input
                              id={`topic-ttl-${originalIndex}`}
                              type="number"
                              min="0"
                              value={topic.defaultTTL !== undefined ? topic.defaultTTL : ''}
                              onChange={(e) => updateTopic(originalIndex, 'defaultTTL', e.target.value ? Number(e.target.value) : undefined)}
                              placeholder="Unlimited"
                            />
                            <p className="text-xs text-muted-foreground">
                              Default message time-to-live in seconds (0 = unlimited)
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`topic-max-redeliveries-${originalIndex}`} className="text-xs">
                              Max Redeliveries
                            </Label>
                            <Input
                              id={`topic-max-redeliveries-${originalIndex}`}
                              type="number"
                              min="0"
                              value={topic.redeliveryPolicy?.maxRedeliveries !== undefined 
                                ? topic.redeliveryPolicy.maxRedeliveries 
                                : (topic.maxRedeliveries !== undefined ? topic.maxRedeliveries : '')}
                              onChange={(e) => {
                                const value = e.target.value ? Number(e.target.value) : undefined;
                                const currentPolicy = topic.redeliveryPolicy || {};
                                updateTopic(originalIndex, 'redeliveryPolicy', {
                                  ...currentPolicy,
                                  maxRedeliveries: value,
                                });
                                // Also update deprecated field for backward compatibility
                                if (!topic.redeliveryPolicy) {
                                  updateTopic(originalIndex, 'maxRedeliveries', value);
                                }
                              }}
                              placeholder="6 (default)"
                            />
                            <p className="text-xs text-muted-foreground">
                              Maximum number of redelivery attempts before sending to DLQ (default: 6)
                            </p>
                          </div>
                        </div>
                        <Separator />
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm font-semibold">Redelivery Policy</Label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-4 w-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Configure how failed messages are redelivered</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor={`topic-initial-redelivery-delay-${originalIndex}`} className="text-xs">
                                Initial Redelivery Delay (ms)
                              </Label>
                              <Input
                                id={`topic-initial-redelivery-delay-${originalIndex}`}
                                type="number"
                                min="0"
                                value={topic.redeliveryPolicy?.initialRedeliveryDelay !== undefined 
                                  ? topic.redeliveryPolicy.initialRedeliveryDelay 
                                  : ''}
                                onChange={(e) => {
                                  const value = e.target.value ? Number(e.target.value) : undefined;
                                  const currentPolicy = topic.redeliveryPolicy || {};
                                  updateTopic(originalIndex, 'redeliveryPolicy', {
                                    ...currentPolicy,
                                    initialRedeliveryDelay: value,
                                  });
                                }}
                                placeholder="1000 (default)"
                              />
                              <p className="text-xs text-muted-foreground">
                                Initial delay before redelivery in milliseconds (default: 1000)
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`topic-maximum-redelivery-delay-${originalIndex}`} className="text-xs">
                                Maximum Redelivery Delay (ms)
                              </Label>
                              <Input
                                id={`topic-maximum-redelivery-delay-${originalIndex}`}
                                type="number"
                                min="0"
                                value={topic.redeliveryPolicy?.maximumRedeliveryDelay !== undefined 
                                  ? topic.redeliveryPolicy.maximumRedeliveryDelay 
                                  : ''}
                                onChange={(e) => {
                                  const value = e.target.value ? Number(e.target.value) : undefined;
                                  const currentPolicy = topic.redeliveryPolicy || {};
                                  updateTopic(originalIndex, 'redeliveryPolicy', {
                                    ...currentPolicy,
                                    maximumRedeliveryDelay: value,
                                  });
                                }}
                                placeholder="60000 (default)"
                              />
                              <p className="text-xs text-muted-foreground">
                                Maximum delay before redelivery in milliseconds (default: 60000)
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`topic-backoff-multiplier-${originalIndex}`} className="text-xs">
                                Backoff Multiplier
                              </Label>
                              <Input
                                id={`topic-backoff-multiplier-${originalIndex}`}
                                type="number"
                                min="1"
                                step="0.1"
                                value={topic.redeliveryPolicy?.backOffMultiplier !== undefined 
                                  ? topic.redeliveryPolicy.backOffMultiplier 
                                  : ''}
                                onChange={(e) => {
                                  const value = e.target.value ? Number(e.target.value) : undefined;
                                  const currentPolicy = topic.redeliveryPolicy || {};
                                  updateTopic(originalIndex, 'redeliveryPolicy', {
                                    ...currentPolicy,
                                    backOffMultiplier: value,
                                  });
                                }}
                                placeholder="2 (default)"
                              />
                              <p className="text-xs text-muted-foreground">
                                Multiplier for exponential backoff (default: 2)
                              </p>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2 pt-6">
                                <Switch
                                  id={`topic-use-exponential-backoff-${originalIndex}`}
                                  checked={topic.redeliveryPolicy?.useExponentialBackOff ?? false}
                                  onCheckedChange={(checked) => {
                                    const currentPolicy = topic.redeliveryPolicy || {};
                                    updateTopic(originalIndex, 'redeliveryPolicy', {
                                      ...currentPolicy,
                                      useExponentialBackOff: checked,
                                    });
                                  }}
                                />
                                <Label htmlFor={`topic-use-exponential-backoff-${originalIndex}`} className="text-xs cursor-pointer">
                                  Use Exponential Backoff
                                </Label>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Enable exponential backoff for redelivery delay (default: false)
                              </p>
                            </div>
                          </div>
                        </div>
                        {topic.memoryPercent !== undefined && (
                          <div className="mt-4">
                            <div className="flex justify-between text-xs mb-1">
                              <span>Memory Usage</span>
                              <span>{topic.memoryPercent}%</span>
                            </div>
                            <Progress value={topic.memoryPercent} className="h-2" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Connections */}
          <TabsContent value="connections" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Connections</CardTitle>
                    <CardDescription>Active client connections to the broker (read-only, connections are created by clients)</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search connections..."
                      value={connectionSearchQuery}
                      onChange={(e) => setConnectionSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {connectionSearchQuery && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Showing {filteredConnections.length} of {activeMQConnections.length} connections
                    </p>
                  )}
                </div>
                {filteredConnections.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {activeMQConnections.length === 0 ? 'No active connections' : 'No connections match your search'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredConnections.map((conn) => (
                      <Card key={conn.id} className="border-l-4 border-l-purple-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 grid grid-cols-4 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Client ID</p>
                                <p className="text-sm font-medium">{conn.clientId}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">User</p>
                                <p className="text-sm font-medium">{conn.userName || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Protocol</p>
                                <Badge variant="outline">{conn.protocol || 'OpenWire'}</Badge>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Messages</p>
                                <p className="text-sm font-medium">{conn.messageCount || 0}</p>
                              </div>
                            </div>
                          </div>
                          {conn.remoteAddress && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Remote: {conn.remoteAddress}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscriptions */}
          <TabsContent value="subscriptions" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Subscriptions</CardTitle>
                    <CardDescription>Active topic subscriptions (read-only, subscriptions are created by clients)</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search subscriptions..."
                      value={subscriptionSearchQuery}
                      onChange={(e) => setSubscriptionSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {subscriptionSearchQuery && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Showing {filteredSubscriptions.length} of {subscriptions.length} subscriptions
                    </p>
                  )}
                </div>
                {filteredSubscriptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {subscriptions.length === 0 ? 'No active subscriptions' : 'No subscriptions match your search'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredSubscriptions
                      .filter((sub) => subscriptions.findIndex(s => s.id === sub.id) !== -1)
                      .map((sub) => {
                      const originalIndex = subscriptions.findIndex(s => s.id === sub.id);
                      
                      const updateSubscription = (field: keyof Subscription, value: any) => {
                        const newSubscriptions = [...subscriptions];
                        newSubscriptions[originalIndex] = { ...newSubscriptions[originalIndex], [field]: value };
                        updateConfig({ subscriptions: newSubscriptions });
                      };
                      
                      const selectorValue = selectorValues[originalIndex] !== undefined 
                        ? selectorValues[originalIndex] 
                        : (sub.selector || '');
                      
                      return (
                        <Card key={sub.id} className="border-l-4 border-l-orange-500">
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 grid grid-cols-4 gap-4">
                                <div>
                                  <p className="text-xs text-muted-foreground">Destination</p>
                                  <p className="text-sm font-medium">{sub.destination}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Client ID</p>
                                  <p className="text-sm font-medium">{sub.clientId}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Pending</p>
                                  <p className="text-sm font-medium">{sub.pendingQueueSize || 0}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Dispatched</p>
                                  <p className="text-sm font-medium">{sub.dispatchedQueueSize || 0}</p>
                                </div>
                              </div>
                            </div>
                            <Separator className="my-3" />
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <Label htmlFor={`sub-selector-${originalIndex}`} className="text-xs">
                                  Message Selector
                                </Label>
                                {editingSelectorIndex === originalIndex ? (
                                  <div className="flex gap-2">
                                    <Input
                                      id={`sub-selector-${originalIndex}`}
                                      value={selectorValue}
                                      onChange={(e) => {
                                        setSelectorValues({ ...selectorValues, [originalIndex]: e.target.value });
                                      }}
                                      placeholder="e.g., priority > 5 OR type = 'order'"
                                      className="flex-1"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          updateSubscription('selector', selectorValue || undefined);
                                          setEditingSelectorIndex(null);
                                        }
                                        if (e.key === 'Escape') {
                                          setSelectorValues({ ...selectorValues, [originalIndex]: sub.selector || '' });
                                          setEditingSelectorIndex(null);
                                        }
                                      }}
                                      autoFocus
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        updateSubscription('selector', selectorValue || undefined);
                                        setEditingSelectorIndex(null);
                                      }}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={sub.selector || '(no selector)'}
                                      readOnly
                                      className="flex-1 bg-muted"
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setSelectorValues({ ...selectorValues, [originalIndex]: sub.selector || '' });
                                        setEditingSelectorIndex(originalIndex);
                                      }}
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  SQL-like selector to filter messages (e.g., &quot;priority &gt; 5&quot;, &quot;type = &apos;order&apos;&quot;)
                                </p>
                              </div>
                              <div className="flex items-center justify-between">
                                <div>
                                  <Label htmlFor={`sub-durable-${originalIndex}`} className="text-xs">
                                    Durable Subscription
                                  </Label>
                                  <p className="text-xs text-muted-foreground">
                                    Subscription survives client disconnection
                                  </p>
                                </div>
                                <Switch
                                  id={`sub-durable-${originalIndex}`}
                                  checked={sub.durable || false}
                                  onCheckedChange={(checked) => updateSubscription('durable', checked)}
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dead Letter Queue */}
          <TabsContent value="dlq" className="space-y-4">
            <Alert className="mb-4">
              <Info className="h-4 w-4" />
              <AlertTitle>Dead Letter Queue (DLQ)</AlertTitle>
              <AlertDescription className="text-sm space-y-1">
                <p>Messages that fail delivery after exceeding the maximum redelivery attempts are moved to the Dead Letter Queue.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>Note:</strong> Configure maxRedeliveries for queues and topics to control when messages are sent to DLQ.
                </p>
              </AlertDescription>
            </Alert>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Dead Letter Queue</CardTitle>
                    <CardDescription>Messages that failed delivery after max redeliveries</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="dlq-name" className="text-xs">DLQ Name:</Label>
                    <Input
                      id="dlq-name"
                      value={deadLetterQueue}
                      onChange={(e) => updateConfig({ deadLetterQueue: e.target.value || 'DLQ' })}
                      className="w-32"
                      placeholder="DLQ"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const routingEngine = emulationEngine.getActiveMQRoutingEngine(componentId);
                        if (routingEngine) {
                          routingEngine.clearDeadLetterQueue();
                          showSuccess('Dead Letter Queue cleared');
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear DLQ
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const routingEngine = emulationEngine.getActiveMQRoutingEngine(componentId);
                  const dlqMessages = routingEngine ? routingEngine.getDeadLetterQueueMessages() : [];
                  const dlqSize = routingEngine ? routingEngine.getDeadLetterQueueSize() : 0;
                  
                  return (
                    <>
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">DLQ Size</span>
                          <span className="text-lg font-bold">{dlqSize}</span>
                        </div>
                        <Progress value={Math.min(100, (dlqSize / 1000) * 100)} className="h-2" />
                      </div>
                      {dlqSize === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No messages in Dead Letter Queue
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {dlqMessages.slice(0, 100).map((msg) => (
                            <Card key={msg.id} className="border-l-4 border-l-red-500">
                              <CardContent className="pt-4">
                                <div className="grid grid-cols-4 gap-4">
                                  <div>
                                    <p className="text-xs text-muted-foreground">Message ID</p>
                                    <p className="text-sm font-mono">{msg.id.slice(0, 20)}...</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Original Destination</p>
                                    <p className="text-sm font-medium">{msg.headers?.originalDestination as string || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Reason</p>
                                    <Badge variant="destructive">{msg.headers?.reason as string || 'unknown'}</Badge>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Delivery Count</p>
                                    <p className="text-sm font-medium">{msg.deliveryCount || 0}</p>
                                  </div>
                                </div>
                                {msg.headers?.movedToDLQAt && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Moved to DLQ: {new Date(msg.headers.movedToDLQAt as number).toLocaleString()}
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                          {dlqSize > 100 && (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              Showing first 100 of {dlqSize} messages
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security */}
          <TabsContent value="security" className="space-y-4">
            <Alert className="mb-4">
              <Info className="h-4 w-4" />
              <AlertTitle>Access Control Lists (ACLs)</AlertTitle>
              <AlertDescription className="text-sm space-y-1">
                <p>Configure permissions to control access to queues and topics. ACLs are enforced during simulation.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>Format:</strong> Resource should be in format <code>queue://name</code> or <code>topic://name</code> (wildcard <code>*</code> supported). 
                  Operations: <code>read</code>, <code>write</code>, <code>admin</code>, <code>create</code>. 
                  <strong>Deny</strong> takes precedence over <strong>Allow</strong>.
                </p>
              </AlertDescription>
            </Alert>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Access Control Lists (ACLs)</CardTitle>
                    <CardDescription>Configure permissions for users and resources</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateAcl(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add ACL
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {showCreateAcl && (
                  <Card className="mb-4 border-primary">
                    <CardHeader>
                      <CardTitle>Create ACL Rule</CardTitle>
                      <CardDescription>Configure access control for queues and topics</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="acl-principal">Principal (User/Group)</Label>
                          <Input
                            id="acl-principal"
                            value={aclForm.principal}
                            onChange={(e) => setAclForm({ ...aclForm, principal: e.target.value })}
                            placeholder="user1 or * for all"
                          />
                          <p className="text-xs text-muted-foreground">User or group name, use * for all</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="acl-resource">Resource</Label>
                          <Input
                            id="acl-resource"
                            value={aclForm.resource}
                            onChange={(e) => {
                              setAclForm({ ...aclForm, resource: e.target.value });
                              // Validate on change
                              const error = validateAclResource(e.target.value);
                              setAclResourceError(error);
                            }}
                            placeholder="queue://orders or topic://events"
                            className={aclResourceError ? 'border-red-500' : ''}
                          />
                          {aclResourceError ? (
                            <p className="text-xs text-red-500">{aclResourceError}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Format: queue://name or topic://name (use * for all)</p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="acl-operation">Operation</Label>
                          <Select
                            value={aclForm.operation}
                            onValueChange={(value: 'read' | 'write' | 'admin' | 'create') => 
                              setAclForm({ ...aclForm, operation: value })
                            }
                          >
                            <SelectTrigger id="acl-operation">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="read">Read</SelectItem>
                              <SelectItem value="write">Write</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="create">Create</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="acl-permission">Permission</Label>
                          <Select
                            value={aclForm.permission}
                            onValueChange={(value: 'allow' | 'deny') => 
                              setAclForm({ ...aclForm, permission: value })
                            }
                          >
                            <SelectTrigger id="acl-permission">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="allow">Allow</SelectItem>
                              <SelectItem value="deny">Deny</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={addAcl} disabled={!aclForm.principal || !aclForm.resource}>
                          Create ACL
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowCreateAcl(false);
                          setAclForm({
                            principal: '',
                            resource: '',
                            operation: 'read',
                            permission: 'allow',
                          });
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {acls.length === 0 && !showCreateAcl ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No ACLs configured</p>
                ) : (
                  <div className="space-y-2">
                    {acls.map((acl, index) => (
                      <Card key={index} className="border-l-4 border-l-red-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 grid grid-cols-4 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Principal</p>
                                <p className="text-sm font-medium">{acl.principal}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Resource</p>
                                <p className="text-sm font-medium">{acl.resource}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Operation</p>
                                <Badge variant="outline">{acl.operation}</Badge>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Permission</p>
                                <Badge variant={acl.permission === 'allow' ? 'default' : 'destructive'}>
                                  {acl.permission}
                                </Badge>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeAcl(index)}
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
        </Tabs>
      </div>

      {/* Delete Queue Confirmation Dialog */}
      <Dialog open={deleteQueueIndex !== null} onOpenChange={(open) => !open && setDeleteQueueIndex(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Queue</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the queue "{queues[deleteQueueIndex || 0]?.name}"?
              {queues[deleteQueueIndex || 0] && (queues[deleteQueueIndex || 0].queueSize || 0) > 0 && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    This queue contains {queues[deleteQueueIndex || 0].queueSize} messages. All messages will be lost.
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteQueueIndex(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteQueueIndex !== null && confirmRemoveQueue(deleteQueueIndex)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Topic Confirmation Dialog */}
      <Dialog open={deleteTopicIndex !== null} onOpenChange={(open) => !open && setDeleteTopicIndex(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Topic</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the topic "{topics[deleteTopicIndex || 0]?.name}"?
              {topics[deleteTopicIndex || 0] && subscriptions.some(s => s.destination === topics[deleteTopicIndex || 0]?.name) && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    This topic has active subscriptions. Subscribers will lose access to this topic.
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTopicIndex(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteTopicIndex !== null && confirmRemoveTopic(deleteTopicIndex)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


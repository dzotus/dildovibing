import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { emulationEngine } from '@/core/EmulationEngine';
import { SQSRoutingEngine } from '@/core/SQSRoutingEngine';
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
import { useState, useEffect, useMemo } from 'react';
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
  Download,
  Search,
  Edit,
  X
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { showSuccess, showError } from '@/utils/toast';
import { CreateQueueDialog } from './CreateQueueDialog';
import { EditQueueDialog } from './EditQueueDialog';

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
  highThroughputFifo?: boolean;
  accountId?: string;
  redrivePolicy?: {
    deadLetterTargetArn?: string;
    maxReceiveCount: number;
  };
  redriveAllowPolicy?: {
    sourceQueueArns?: string[];
  };
}

interface AWSSQSConfig {
  queues?: Queue[];
  accessKeyId?: string;
  secretAccessKey?: string;
  defaultRegion?: string;
  defaultAccountId?: string;
  iamPolicies?: Array<{
    id: string;
    principal: string;
    action: string;
    resource: string;
    effect: 'Allow' | 'Deny';
  }>;
  metrics?: {
    enabled?: boolean;
    port?: number;
    path?: string;
  };
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
  const defaultAccountId = config.defaultAccountId || '123456789012';
  const iamPolicies = config.iamPolicies || [];

  const [editingQueueIndex, setEditingQueueIndex] = useState<number | null>(null);
  const [showCreateQueue, setShowCreateQueue] = useState(false);
  const [showEditQueue, setShowEditQueue] = useState(false);
  const [editingQueue, setEditingQueue] = useState<Queue | null>(null);
  const [queueToDelete, setQueueToDelete] = useState<number | null>(null);
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'standard' | 'fifo'>('all');

  // Initialize routing engine when component mounts or queues change
  useEffect(() => {
    if (!node || queues.length === 0) return;
    
    // Ensure routing engine is initialized
    const { nodes, connections } = useCanvasStore.getState();
    emulationEngine.updateNodesAndConnections(nodes, connections);
  }, [componentId, queues.length, node?.id]);

  // Update queue metrics from routing engine periodically
  useEffect(() => {
    if (!node || queues.length === 0) return;
    
    const interval = setInterval(() => {
      const routingEngine = emulationEngine.getSQSRoutingEngine(componentId);
      if (!routingEngine) return;

      const allQueueMetrics = routingEngine.getAllQueueMetrics();
      const currentQueues = (node.data.config as any)?.queues || [];
      
      const updatedQueues = currentQueues.map((queue: any) => {
        const metrics = allQueueMetrics.get(queue.name);
        if (metrics) {
          return {
            ...queue,
            approximateMessages: metrics.approximateMessages,
            approximateMessagesNotVisible: metrics.approximateMessagesNotVisible,
            approximateMessagesDelayed: metrics.approximateMessagesDelayed,
          };
        }
        return queue;
      });

      // Check if metrics changed
      const metricsChanged = updatedQueues.some((q: any, i: number) => 
        q.approximateMessages !== currentQueues[i]?.approximateMessages ||
        q.approximateMessagesNotVisible !== currentQueues[i]?.approximateMessagesNotVisible ||
        q.approximateMessagesDelayed !== currentQueues[i]?.approximateMessagesDelayed
      );

      if (metricsChanged) {
        updateNode(componentId, {
          data: {
            ...node.data,
            config: {
              ...(node.data.config as any),
              queues: updatedQueues,
            },
          },
        });
      }
    }, 500); // Update every 500ms

    return () => clearInterval(interval);
  }, [componentId, queues.length, node?.id, updateNode]);

  const updateConfig = (updates: Partial<AWSSQSConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  // Filtered queues based on search and filter
  const filteredQueues = useMemo(() => {
    return queues.filter(queue => {
      const matchesSearch = !searchQuery || queue.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || queue.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [queues, searchQuery, filterType]);

  const handleCreateQueue = (newQueue: Queue) => {
    // Ensure routing engine is initialized
    const { nodes, connections } = useCanvasStore.getState();
    emulationEngine.updateNodesAndConnections(nodes, connections);
    
    updateConfig({ queues: [...queues, newQueue] });
    showSuccess(`Queue "${newQueue.name}" created successfully`);
    
    // Re-initialize routing engine
    setTimeout(() => {
      const { nodes, connections } = useCanvasStore.getState();
      emulationEngine.updateNodesAndConnections(nodes, connections);
    }, 100);
  };

  const handleEditQueue = (updatedQueue: Queue, originalName: string) => {
    const queueIndex = queues.findIndex(q => q.name === originalName);
    if (queueIndex === -1) {
      showError('Queue not found');
      return;
    }

    const newQueues = [...queues];
    
    // If queue name changed, update routing engine
    if (updatedQueue.name !== originalName) {
      const routingEngine = emulationEngine.getSQSRoutingEngine(componentId);
      if (routingEngine) {
        routingEngine.updateQueue(originalName, { name: updatedQueue.name });
      }
    }
    
    newQueues[queueIndex] = updatedQueue;
    updateConfig({ queues: newQueues });
    showSuccess(`Queue "${updatedQueue.name}" updated successfully`);
    
    // Re-initialize routing engine
    setTimeout(() => {
      const { nodes, connections } = useCanvasStore.getState();
      emulationEngine.updateNodesAndConnections(nodes, connections);
    }, 100);
  };

  const handleDeleteQueue = (index: number) => {
    const queue = queues[index];
    if (!queue) return;
    
    updateConfig({ queues: queues.filter((_, i) => i !== index) });
    showSuccess(`Queue "${queue.name}" deleted successfully`);
    setQueueToDelete(null);
    
    // Re-initialize routing engine
    setTimeout(() => {
      const { nodes, connections } = useCanvasStore.getState();
      emulationEngine.updateNodesAndConnections(nodes, connections);
    }, 100);
  };

  const openEditQueue = (index: number) => {
    const queue = queues[index];
    if (queue) {
      setEditingQueue({ ...queue });
      setShowEditQueue(true);
    }
  };

  const updateQueue = (index: number, field: string, value: any) => {
    const newQueues = [...queues];
    const updatedQueue = { ...newQueues[index], [field]: value };
    
    // Validate queue name if it's being changed
    if (field === 'name') {
      const validation = SQSRoutingEngine.validateQueueName(value, updatedQueue.type);
      if (!validation.valid) {
        showError(`Queue name validation error: ${validation.error || 'Invalid queue name'}`);
        return; // Don't update if invalid
      }
    }
    
    // Auto-fix FIFO queue name suffix
    if (field === 'type' && value === 'fifo' && !updatedQueue.name.endsWith('.fifo')) {
      updatedQueue.name = updatedQueue.name + '.fifo';
    } else if (field === 'type' && value === 'standard' && updatedQueue.name.endsWith('.fifo')) {
      updatedQueue.name = updatedQueue.name.slice(0, -5);
    }
    
    newQueues[index] = updatedQueue;
    updateConfig({ queues: newQueues });
    
    // Update routing engine if queue name changed
    if (field === 'name' && value !== queues[index].name) {
      const routingEngine = emulationEngine.getSQSRoutingEngine(componentId);
      if (routingEngine) {
        routingEngine.updateQueue(queues[index].name, { name: value });
      }
    }
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
    showSuccess('IAM policy added successfully');
  };

  const removePolicy = (id: string) => {
    updateConfig({ iamPolicies: iamPolicies.filter((p) => p.id !== id) });
    showSuccess('IAM policy removed successfully');
  };

  const sendTestMessage = (queueIndex: number) => {
    const queue = queues[queueIndex];
    if (queue && testMessage) {
      // Ensure routing engine is initialized
      const { nodes, connections } = useCanvasStore.getState();
      emulationEngine.updateNodesAndConnections(nodes, connections);
      
      // Get routing engine and send message through it
      const routingEngine = emulationEngine.getSQSRoutingEngine(componentId);
      
      if (routingEngine) {
        // Send message through routing engine
        const messageId = routingEngine.sendMessage(
          queue.name,
          testMessage,
          new Blob([testMessage]).size,
          undefined, // attributes
          queue.type === 'fifo' ? 'test-group' : undefined, // messageGroupId for FIFO
          queue.type === 'fifo' && queue.contentBasedDedup ? undefined : `test-${Date.now()}` // deduplicationId
        );
        
        if (messageId) {
          // Get updated metrics immediately
          const queueMetrics = routingEngine.getQueueMetrics(queue.name);
          if (queueMetrics) {
            // Update queue metrics in UI immediately
            updateQueue(queueIndex, 'approximateMessages', queueMetrics.approximateMessages);
            updateQueue(queueIndex, 'approximateMessagesNotVisible', queueMetrics.approximateMessagesNotVisible);
            updateQueue(queueIndex, 'approximateMessagesDelayed', queueMetrics.approximateMessagesDelayed);
          }
          
          // Force update emulation engine to sync
          emulationEngine.updateNodesAndConnections(nodes, connections);
          showSuccess(`Test message sent to queue "${queue.name}"`);
        } else {
          showError('Failed to send test message');
        }
      } else {
        // Fallback: just update counter if routing engine not initialized
        updateQueue(queueIndex, 'approximateMessages', (queue.approximateMessages || 0) + 1);
        showSuccess(`Test message sent to queue "${queue.name}"`);
      }
      
      setTestMessage('');
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
              <Progress
                value={Math.min((totalMessages / 100000) * 100, 100)}
                className={`h-2 mt-2 ${
                  totalMessages > 50000 
                    ? 'bg-red-500' 
                    : totalMessages > 10000 
                      ? 'bg-yellow-500' 
                      : 'bg-green-500'
                }`}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">In Flight</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{totalInFlight.toLocaleString()}</span>
              <p className="text-xs text-muted-foreground mt-1">Being processed</p>
              <Progress
                value={Math.min((totalInFlight / 5000) * 100, 100)}
                className="h-2 mt-2"
              />
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
          <TabsList className="flex flex-wrap gap-2">
            <TabsTrigger value="queues" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Queues</span>
              <Badge variant="secondary" className="ml-1">{queues.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="credentials" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              <span className="hidden sm:inline">Credentials</span>
            </TabsTrigger>
            <TabsTrigger value="policies" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">IAM Policies</span>
              <Badge variant="secondary" className="ml-1">{iamPolicies.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Monitoring</span>
            </TabsTrigger>
          </TabsList>

          {/* Queues Tab */}
          <TabsContent value="queues" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Queues</CardTitle>
                    <CardDescription>Manage SQS queues and their configuration</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateQueue(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Queue
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search and Filter */}
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search queues by name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                    {searchQuery && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                        onClick={() => setSearchQuery('')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <Select value={filterType} onValueChange={(value: 'all' | 'standard' | 'fifo') => setFilterType(value)}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="fifo">FIFO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {filteredQueues.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {queues.length === 0 
                      ? 'No queues configured. Create your first queue to get started.'
                      : 'No queues match your search criteria.'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredQueues.map((queue, index) => {
                      const originalIndex = queues.findIndex(q => q.name === queue.name);
                      return (
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
                                    onKeyDown={(e) => {
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
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditQueue(originalIndex)}
                              title="Edit queue"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setQueueToDelete(originalIndex)}
                              disabled={queues.length === 1}
                              title="Delete queue"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Queue Stats with Visual Indicators */}
                        <div className="grid grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">Messages Available</p>
                              {(queue.approximateMessages || 0) > 10000 && (
                                <Badge variant="destructive" className="text-xs">High</Badge>
                              )}
                            </div>
                            <p className="text-2xl font-bold">{queue.approximateMessages?.toLocaleString() || 0}</p>
                            <Progress
                              value={Math.min(((queue.approximateMessages || 0) / 50000) * 100, 100)}
                              className={`h-2 ${
                                (queue.approximateMessages || 0) > 10000 
                                  ? 'bg-red-500' 
                                  : (queue.approximateMessages || 0) > 5000 
                                    ? 'bg-yellow-500' 
                                    : 'bg-green-500'
                              }`}
                            />
                            <p className="text-xs text-muted-foreground">Ready to consume</p>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">In Flight</p>
                              {(queue.approximateMessagesNotVisible || 0) > 1000 && (
                                <Badge variant="outline" className="text-xs">Processing</Badge>
                              )}
                            </div>
                            <p className="text-2xl font-bold">{queue.approximateMessagesNotVisible?.toLocaleString() || 0}</p>
                            <Progress
                              value={Math.min(((queue.approximateMessagesNotVisible || 0) / 2000) * 100, 100)}
                              className="h-2"
                            />
                            <p className="text-xs text-muted-foreground">Being processed</p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">Delayed</p>
                            <p className="text-2xl font-bold">{queue.approximateMessagesDelayed?.toLocaleString() || 0}</p>
                            <Progress
                              value={Math.min(((queue.approximateMessagesDelayed || 0) / 500) * 100, 100)}
                              className="h-2 bg-orange-500"
                            />
                            <p className="text-xs text-muted-foreground">Waiting for delay</p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">Queue URL</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-xs">
                                {queue.region}
                              </Badge>
                            </div>
                            {(() => {
                              const routingEngine = emulationEngine.getSQSRoutingEngine(componentId);
                              const queueUrl = routingEngine?.getQueueUrl(queue.name) || 
                                `https://sqs.${queue.region}.amazonaws.com/${queue.accountId || defaultAccountId}/${queue.name}`;
                              return (
                                <p className="text-xs font-mono text-muted-foreground truncate" title={queueUrl}>
                                  {queueUrl}
                                </p>
                              );
                            })()}
                            <div className="flex items-center gap-1 mt-1">
                              <div className={`h-1.5 w-1.5 rounded-full ${
                                (queue.approximateMessages || 0) === 0 && (queue.approximateMessagesNotVisible || 0) === 0
                                  ? 'bg-gray-400'
                                  : (queue.approximateMessages || 0) < 1000
                                    ? 'bg-green-500'
                                    : (queue.approximateMessages || 0) < 10000
                                      ? 'bg-yellow-500'
                                      : 'bg-red-500'
                              }`}></div>
                              <p className="text-xs text-muted-foreground">
                                {
                                  (queue.approximateMessages || 0) === 0 && (queue.approximateMessagesNotVisible || 0) === 0
                                    ? 'Idle'
                                    : (queue.approximateMessages || 0) < 1000
                                      ? 'Healthy'
                                      : (queue.approximateMessages || 0) < 10000
                                        ? 'Warning'
                                        : 'Critical'
                                }
                              </p>
                            </div>
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
                                <p className="text-xs text-muted-foreground">
                                  Throughput limit mode for FIFO queue
                                </p>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label>High-Throughput FIFO Mode</Label>
                                  <Switch
                                    checked={queue.highThroughputFifo || false}
                                    onCheckedChange={(checked) => updateQueue(index, 'highThroughputFifo', checked)}
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Enable high-throughput mode for better performance with multiple message groups
                                </p>
                              </div>
                            </>
                          )}
                          <div className="space-y-2">
                            <Label>Account ID</Label>
                            <Input
                              value={queue.accountId || defaultAccountId}
                              onChange={(e) => updateQueue(index, 'accountId', e.target.value)}
                              placeholder="123456789012"
                            />
                            <p className="text-xs text-muted-foreground">
                              AWS account ID for queue URLs and ARNs
                            </p>
                          </div>
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
                              onClick={() => sendTestMessage(originalIndex)}
                              disabled={!testMessage}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Send
                            </Button>
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

            {/* Create Queue Dialog */}
            <CreateQueueDialog
              open={showCreateQueue}
              onOpenChange={setShowCreateQueue}
              onSave={handleCreateQueue}
              defaultRegion={defaultRegion}
              defaultAccountId={defaultAccountId}
              existingQueueNames={queues.map(q => q.name)}
            />

            {/* Edit Queue Dialog */}
            <EditQueueDialog
              open={showEditQueue}
              onOpenChange={setShowEditQueue}
              onSave={handleEditQueue}
              queue={editingQueue}
              existingQueueNames={queues.map(q => q.name)}
            />

            {/* Delete Queue Confirmation */}
            <AlertDialog open={queueToDelete !== null} onOpenChange={(open) => !open && setQueueToDelete(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Queue</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete the queue "{queues[queueToDelete || 0]?.name}"? 
                    This action cannot be undone and all messages in the queue will be lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => queueToDelete !== null && handleDeleteQueue(queueToDelete)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
                <div className="space-y-2">
                  <Label htmlFor="defaultAccountId">Default Account ID</Label>
                  <Input
                    id="defaultAccountId"
                    value={defaultAccountId}
                    onChange={(e) => updateConfig({ defaultAccountId: e.target.value })}
                    placeholder="123456789012"
                  />
                  <p className="text-xs text-muted-foreground">
                    AWS account ID used for queue URLs and ARNs
                  </p>
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
                          {editingPolicyId === policy.id ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Principal</Label>
                                  <Input
                                    value={policy.principal}
                                    onChange={(e) => {
                                      const newPolicies = iamPolicies.map(p => 
                                        p.id === policy.id ? { ...p, principal: e.target.value } : p
                                      );
                                      updateConfig({ iamPolicies: newPolicies });
                                    }}
                                    placeholder="* or arn:aws:iam::..."
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Action</Label>
                                  <Select
                                    value={policy.action}
                                    onValueChange={(value) => {
                                      const newPolicies = iamPolicies.map(p => 
                                        p.id === policy.id ? { ...p, action: value } : p
                                      );
                                      updateConfig({ iamPolicies: newPolicies });
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="sqs:SendMessage">SendMessage</SelectItem>
                                      <SelectItem value="sqs:ReceiveMessage">ReceiveMessage</SelectItem>
                                      <SelectItem value="sqs:DeleteMessage">DeleteMessage</SelectItem>
                                      <SelectItem value="sqs:GetQueueAttributes">GetQueueAttributes</SelectItem>
                                      <SelectItem value="sqs:*">All Actions (*)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Resource</Label>
                                  <Input
                                    value={policy.resource}
                                    onChange={(e) => {
                                      const newPolicies = iamPolicies.map(p => 
                                        p.id === policy.id ? { ...p, resource: e.target.value } : p
                                      );
                                      updateConfig({ iamPolicies: newPolicies });
                                    }}
                                    placeholder="* or queue name"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Effect</Label>
                                  <Select
                                    value={policy.effect}
                                    onValueChange={(value: 'Allow' | 'Deny') => {
                                      const newPolicies = iamPolicies.map(p => 
                                        p.id === policy.id ? { ...p, effect: value } : p
                                      );
                                      updateConfig({ iamPolicies: newPolicies });
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Allow">Allow</SelectItem>
                                      <SelectItem value="Deny">Deny</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => setEditingPolicyId(null)}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingPolicyId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
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
                                  <p className="text-sm font-medium truncate" title={policy.resource}>{policy.resource}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Effect</p>
                                  <Badge variant={policy.effect === 'Allow' ? 'default' : 'destructive'}>
                                    {policy.effect}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingPolicyId(policy.id)}
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removePolicy(policy.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
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
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">Messages Available</p>
                              {(queue.approximateMessages || 0) > 10000 && (
                                <Badge variant="destructive" className="text-xs">High</Badge>
                              )}
                            </div>
                            <p className="text-2xl font-bold">{queue.approximateMessages?.toLocaleString() || 0}</p>
                            <Progress
                              value={Math.min(((queue.approximateMessages || 0) / 50000) * 100, 100)}
                              className={`h-2 ${
                                (queue.approximateMessages || 0) > 10000 
                                  ? 'bg-red-500' 
                                  : (queue.approximateMessages || 0) > 5000 
                                    ? 'bg-yellow-500' 
                                    : 'bg-green-500'
                              }`}
                            />
                            <p className="text-xs text-muted-foreground">Ready to consume</p>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">In Flight</p>
                              {(queue.approximateMessagesNotVisible || 0) > 1000 && (
                                <Badge variant="outline" className="text-xs">Processing</Badge>
                              )}
                            </div>
                            <p className="text-2xl font-bold">{queue.approximateMessagesNotVisible?.toLocaleString() || 0}</p>
                            <Progress
                              value={Math.min(((queue.approximateMessagesNotVisible || 0) / 2000) * 100, 100)}
                              className="h-2"
                            />
                            <p className="text-xs text-muted-foreground">Being processed</p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">Delayed</p>
                            <p className="text-2xl font-bold">{queue.approximateMessagesDelayed?.toLocaleString() || 0}</p>
                            <Progress
                              value={Math.min(((queue.approximateMessagesDelayed || 0) / 500) * 100, 100)}
                              className="h-2 bg-orange-500"
                            />
                            <p className="text-xs text-muted-foreground">Waiting for delay</p>
                          </div>
                        </div>
                        
                        {/* Queue Health Status */}
                        <div className="mt-4 p-3 rounded-md border bg-muted/50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${
                                (queue.approximateMessages || 0) === 0 && (queue.approximateMessagesNotVisible || 0) === 0
                                  ? 'bg-gray-400'
                                  : (queue.approximateMessages || 0) < 1000
                                    ? 'bg-green-500 animate-pulse'
                                    : (queue.approximateMessages || 0) < 10000
                                      ? 'bg-yellow-500'
                                      : 'bg-red-500 animate-pulse'
                              }`}></div>
                              <span className="text-sm font-medium">Queue Health</span>
                            </div>
                            <Badge variant={
                              (queue.approximateMessages || 0) === 0 && (queue.approximateMessagesNotVisible || 0) === 0
                                ? 'secondary'
                                : (queue.approximateMessages || 0) < 1000
                                  ? 'default'
                                  : (queue.approximateMessages || 0) < 10000
                                    ? 'outline'
                                    : 'destructive'
                            }>
                              {
                                (queue.approximateMessages || 0) === 0 && (queue.approximateMessagesNotVisible || 0) === 0
                                  ? 'Idle'
                                  : (queue.approximateMessages || 0) < 1000
                                    ? 'Healthy'
                                    : (queue.approximateMessages || 0) < 10000
                                      ? 'Warning'
                                      : 'Critical'
                              }
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {
                              (queue.approximateMessages || 0) === 0 && (queue.approximateMessagesNotVisible || 0) === 0
                                ? 'Queue is idle with no messages'
                                : (queue.approximateMessages || 0) < 1000
                                  ? 'Queue is operating normally'
                                  : (queue.approximateMessages || 0) < 10000
                                    ? 'Queue has high message count, consider scaling consumers'
                                    : 'Queue is critically overloaded, immediate action required'
                            }
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Metrics Export</CardTitle>
                <CardDescription>Configure Prometheus metrics export via CloudWatch exporter</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Metrics Export</Label>
                    <p className="text-xs text-muted-foreground mt-1">Export SQS metrics via CloudWatch exporter for Prometheus scraping</p>
                  </div>
                  <Switch 
                    checked={config.metrics?.enabled ?? true}
                    onCheckedChange={(checked) => updateConfig({ 
                      metrics: { 
                        ...config.metrics, 
                        enabled: checked,
                        port: config.metrics?.port || 9102,
                        path: config.metrics?.path || '/metrics'
                      } 
                    })}
                  />
                </div>
                {config.metrics?.enabled !== false && (
                  <>
                    <div className="space-y-2">
                      <Label>Metrics Port (CloudWatch Exporter)</Label>
                      <Input 
                        type="number" 
                        value={config.metrics?.port ?? 9102}
                        onChange={(e) => updateConfig({ 
                          metrics: { 
                            ...config.metrics, 
                            port: parseInt(e.target.value) || 9102,
                            path: config.metrics?.path || '/metrics'
                          } 
                        })}
                        min={1024} 
                        max={65535} 
                      />
                      <p className="text-xs text-muted-foreground">Port for CloudWatch exporter metrics endpoint</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Metrics Path</Label>
                      <Input 
                        type="text" 
                        value={config.metrics?.path ?? '/metrics'}
                        onChange={(e) => updateConfig({ 
                          metrics: { 
                            ...config.metrics, 
                            path: e.target.value || '/metrics',
                            port: config.metrics?.port || 9102
                          } 
                        })}
                        placeholder="/metrics"
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


import { useCanvasStore } from '@/store/useCanvasStore';
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
import { useState, useEffect } from 'react';
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
import { validateSQSQueueName, validateAWSRegion } from '@/utils/validation';
import { showSuccess, showError } from '@/utils/toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

// SQS UI thresholds
const SQS_THRESHOLDS = {
  MESSAGES_HIGH: 10000,
  MESSAGES_WARNING: 5000,
  MESSAGES_HEALTHY: 1000,
  MESSAGES_MAX_PROGRESS: 50000,
  IN_FLIGHT_MAX_PROGRESS: 5000,
  IN_FLIGHT_WARNING: 1000,
  DELAYED_MAX_PROGRESS: 500,
  TOTAL_MESSAGES_MAX_PROGRESS: 100000,
} as const;

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
  // Long polling wait time per queue (ReceiveMessageWaitTimeSeconds)
  receiveMessageWaitTimeSeconds?: number;
  // Optional tags (key-value) for better simulation of AWS tagging
  tags?: Array<{ key: string; value: string }>;
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
  // Optional AWS account id for building Queue URLs/ARNs
  accountId?: string;
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
  const accountId = config.accountId || '123456789012';
  const iamPolicies = config.iamPolicies || [];

  const [editingQueueIndex, setEditingQueueIndex] = useState<number | null>(null);
  const [showCreateQueue, setShowCreateQueue] = useState(false);
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [queueErrors, setQueueErrors] = useState<Record<number, Record<string, string>>>({});
  const [deleteQueueIndex, setDeleteQueueIndex] = useState<number | null>(null);
  const [deletePolicyId, setDeletePolicyId] = useState<string | null>(null);

  // Initialize routing engine when component mounts or queues change
  useEffect(() => {
    if (!node || queues.length === 0) return;
    
    // Ensure routing engine is initialized
    const { nodes, connections } = useCanvasStore.getState();
    emulationEngine.updateNodesAndConnections(nodes, connections);
  }, [componentId, queues.length, node?.id]);

  // Update queue metrics from routing engine when node config changes
  // Metrics are updated by EmulationEngine.updateSQSQueueMetricsInConfig during simulation
  // This effect only syncs when node config is updated externally (e.g., from simulation)
  useEffect(() => {
    if (!node || queues.length === 0) return;
    
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
  }, [componentId, node?.data.config, queues.length, updateNode]);

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
      receiveMessageWaitTimeSeconds: 0,
      approximateMessages: 0,
      approximateMessagesNotVisible: 0,
      approximateMessagesDelayed: 0,
      tags: [],
    };
    updateConfig({ queues: [...queues, newQueue] });
    setShowCreateQueue(false);
  };

  const removeQueue = (index: number) => {
    setDeleteQueueIndex(index);
  };

  const confirmDeleteQueue = () => {
    if (deleteQueueIndex !== null) {
      const queueName = queues[deleteQueueIndex].name;
      updateConfig({ queues: queues.filter((_, i) => i !== deleteQueueIndex) });
      setDeleteQueueIndex(null);
      showSuccess(`Queue "${queueName}" has been deleted`);
    }
  };

  const updateQueue = (index: number, field: string, value: any) => {
    const newQueues = [...queues];
    const queue = newQueues[index];
    
    // Валидация
    if (field === 'name') {
      const validation = validateSQSQueueName(value, queue.type === 'fifo');
      if (!validation.valid) {
        setQueueErrors({
          ...queueErrors,
          [index]: { ...queueErrors[index], name: validation.error || '' },
        });
        return; // Не обновлять если невалидно
      } else {
        // Очистить ошибку
        const newErrors = { ...queueErrors };
        if (newErrors[index]) {
          delete newErrors[index].name;
        }
        setQueueErrors(newErrors);
      }
    }
    
    if (field === 'region') {
      const validation = validateAWSRegion(value);
      if (!validation.valid) {
        setQueueErrors({
          ...queueErrors,
          [index]: { ...queueErrors[index], region: validation.error || '' },
        });
        return; // Не обновлять если невалидно
      } else {
        // Очистить ошибку
        const newErrors = { ...queueErrors };
        if (newErrors[index]) {
          delete newErrors[index].region;
        }
        setQueueErrors(newErrors);
      }
    }
    
    // Валидация числовых полей
    if (['visibilityTimeout', 'messageRetention', 'delaySeconds', 'maxReceiveCount', 'receiveMessageWaitTimeSeconds'].includes(field)) {
      const numValue = Number(value);
      if (isNaN(numValue) || numValue < 0) {
        setQueueErrors({
          ...queueErrors,
          [index]: { ...queueErrors[index], [field]: `${field} must be a positive number` },
        });
        return;
      } else {
        // Очистить ошибку
        const newErrors = { ...queueErrors };
        if (newErrors[index]) {
          delete newErrors[index][field];
        }
        setQueueErrors(newErrors);
      }
    }
    
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
    setDeletePolicyId(id);
  };

  const confirmDeletePolicy = () => {
    if (deletePolicyId) {
      updateConfig({ iamPolicies: iamPolicies.filter((p) => p.id !== deletePolicyId) });
      setDeletePolicyId(null);
      showSuccess('IAM Policy has been deleted');
    }
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
        // Optional one-off attributes for test messages
        const testAttributes = (queue as any).testAttributes as Record<string, string> | undefined;

        // Send message through routing engine
        const messageId = routingEngine.sendMessage(
          queue.name,
          testMessage,
          new Blob([testMessage]).size,
          testAttributes, // attributes
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
        }
      } else {
        // Fallback: just update counter if routing engine not initialized
        updateQueue(queueIndex, 'approximateMessages', (queue.approximateMessages || 0) + 1);
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
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const { nodes, connections } = useCanvasStore.getState();
                emulationEngine.updateNodesAndConnections(nodes, connections);
                
                const routingEngine = emulationEngine.getSQSRoutingEngine(componentId);
                if (routingEngine) {
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
                  
                  updateNode(componentId, {
                    data: {
                      ...node.data,
                      config: {
                        ...(node.data.config as any),
                        queues: updatedQueues,
                      },
                    },
                  });
                  
                  showSuccess('Metrics refreshed');
                } else {
                  showError('Routing engine not initialized');
                }
              }}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                if (queues.length === 0) {
                  showError('Please create a queue first');
                  return;
                }
                
                const queueName = queues[0].name;
                const region = queues[0].region || defaultRegion;
                const queueUrl = `https://sqs.${region}.amazonaws.com/${accountId}/${queueName}`;
                const consoleUrl = `https://console.aws.amazon.com/sqs/v2/home?region=${region}#/queues/${encodeURIComponent(queueUrl)}`;
                
                window.open(consoleUrl, '_blank');
              }}
            >
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
                value={Math.min((totalMessages / SQS_THRESHOLDS.TOTAL_MESSAGES_MAX_PROGRESS) * 100, 100)}
                className={`h-2 mt-2 ${
                  totalMessages > SQS_THRESHOLDS.MESSAGES_MAX_PROGRESS 
                    ? 'bg-red-500' 
                    : totalMessages > SQS_THRESHOLDS.MESSAGES_HIGH 
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
                value={Math.min((totalInFlight / SQS_THRESHOLDS.IN_FLIGHT_MAX_PROGRESS) * 100, 100)}
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
            <TabsTrigger value="queues" className="flex-shrink-0">
              <MessageSquare className="h-4 w-4 mr-2" />
              Queues ({queues.length})
            </TabsTrigger>
            <TabsTrigger value="credentials" className="flex-shrink-0">
              <Key className="h-4 w-4 mr-2" />
              Credentials
            </TabsTrigger>
            <TabsTrigger value="policies" className="flex-shrink-0">
              <Shield className="h-4 w-4 mr-2" />
              IAM Policies ({iamPolicies.length})
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="flex-shrink-0">
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
                                  <div className="space-y-1">
                                    <Input
                                      value={queue.name}
                                      onChange={(e) => updateQueue(index, 'name', e.target.value)}
                                      onBlur={() => setEditingQueueIndex(null)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') setEditingQueueIndex(null);
                                      }}
                                      className={`h-7 ${queueErrors[index]?.name ? 'border-red-500' : ''}`}
                                      autoFocus
                                    />
                                    {queueErrors[index]?.name && (
                                      <p className="text-xs text-red-500">{queueErrors[index].name}</p>
                                    )}
                                  </div>
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
                        {/* Queue Stats with Visual Indicators */}
                        <div className="grid grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">Messages Available</p>
                              {(queue.approximateMessages || 0) > SQS_THRESHOLDS.MESSAGES_HIGH && (
                                <Badge variant="destructive" className="text-xs">High</Badge>
                              )}
                            </div>
                            <p className="text-2xl font-bold">{queue.approximateMessages?.toLocaleString() || 0}</p>
                            <Progress
                              value={Math.min(((queue.approximateMessages || 0) / SQS_THRESHOLDS.MESSAGES_MAX_PROGRESS) * 100, 100)}
                              className={`h-2 ${
                                (queue.approximateMessages || 0) > SQS_THRESHOLDS.MESSAGES_HIGH 
                                  ? 'bg-red-500' 
                                  : (queue.approximateMessages || 0) > SQS_THRESHOLDS.MESSAGES_WARNING 
                                    ? 'bg-yellow-500' 
                                    : 'bg-green-500'
                              }`}
                            />
                            <p className="text-xs text-muted-foreground">Ready to consume</p>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">In Flight</p>
                              {(queue.approximateMessagesNotVisible || 0) > SQS_THRESHOLDS.IN_FLIGHT_WARNING && (
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
                              value={Math.min(((queue.approximateMessagesDelayed || 0) / SQS_THRESHOLDS.DELAYED_MAX_PROGRESS) * 100, 100)}
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
                          <p
                            className="text-xs font-mono text-muted-foreground truncate"
                            title={`https://sqs.${queue.region}.amazonaws.com/${accountId}/${queue.name}`}
                          >
                            https://sqs.{queue.region}.amazonaws.com/{accountId}/{queue.name}
                          </p>
                            <div className="flex items-center gap-1 mt-1">
                              <div className={`h-1.5 w-1.5 rounded-full ${
                                  (queue.approximateMessages || 0) === 0 && (queue.approximateMessagesNotVisible || 0) === 0
                                    ? 'bg-gray-400'
                                    : (queue.approximateMessages || 0) < SQS_THRESHOLDS.MESSAGES_HEALTHY
                                      ? 'bg-green-500'
                                      : (queue.approximateMessages || 0) < SQS_THRESHOLDS.MESSAGES_HIGH
                                        ? 'bg-yellow-500'
                                        : 'bg-red-500'
                              }`}></div>
                              <p className="text-xs text-muted-foreground">
                                {
                                  (queue.approximateMessages || 0) === 0 && (queue.approximateMessagesNotVisible || 0) === 0
                                    ? 'Idle'
                                    : (queue.approximateMessages || 0) < SQS_THRESHOLDS.MESSAGES_HEALTHY
                                      ? 'Healthy'
                                      : (queue.approximateMessages || 0) < SQS_THRESHOLDS.MESSAGES_HIGH
                                        ? 'Warning'
                                        : 'Critical'
                                }
                              </p>
                            </div>
                          </div>
                          {/* Tags Management */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Tags</Label>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newQueues = [...queues];
                                  if (!newQueues[index].tags) {
                                    newQueues[index].tags = [];
                                  }
                                  newQueues[index].tags!.push({ key: '', value: '' });
                                  updateConfig({ queues: newQueues });
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Tag
                              </Button>
                            </div>
                            {queue.tags && queue.tags.length > 0 ? (
                              <div className="space-y-2">
                                {queue.tags.map((tag, tagIndex) => (
                                  <div key={tagIndex} className="flex gap-2 items-center">
                                    <Input
                                      placeholder="Key"
                                      value={tag.key}
                                      onChange={(e) => {
                                        const newQueues = [...queues];
                                        newQueues[index].tags![tagIndex].key = e.target.value;
                                        updateConfig({ queues: newQueues });
                                      }}
                                      className="flex-1"
                                    />
                                    <Input
                                      placeholder="Value"
                                      value={tag.value}
                                      onChange={(e) => {
                                        const newQueues = [...queues];
                                        newQueues[index].tags![tagIndex].value = e.target.value;
                                        updateConfig({ queues: newQueues });
                                      }}
                                      className="flex-1"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        const newQueues = [...queues];
                                        newQueues[index].tags = newQueues[index].tags!.filter((_, i) => i !== tagIndex);
                                        updateConfig({ queues: newQueues });
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">No tags configured</p>
                            )}
                          </div>
                        </div>

                        <Separator />

                        {/* Queue Configuration */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label>Queue Type</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Standard queues provide at-least-once delivery and best-effort ordering. FIFO queues provide exactly-once processing and strict ordering.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
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
                            <div className="flex items-center gap-2">
                              <Label>Region</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>AWS region where the queue will be created (e.g., us-east-1, eu-west-1). Affects latency and data residency.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              value={queue.region}
                              onChange={(e) => updateQueue(index, 'region', e.target.value)}
                              placeholder="us-east-1"
                              className={queueErrors[index]?.region ? 'border-red-500' : ''}
                            />
                            {queueErrors[index]?.region && (
                              <p className="text-xs text-red-500">{queueErrors[index].region}</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label>Visibility Timeout (seconds)</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Duration (0-43200 seconds) that a message is hidden from other consumers after being received. If not deleted within this time, it becomes visible again.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              type="number"
                              value={queue.visibilityTimeout}
                              onChange={(e) => updateQueue(index, 'visibilityTimeout', Number(e.target.value))}
                              min={0}
                              max={43200}
                              className={queueErrors[index]?.visibilityTimeout ? 'border-red-500' : ''}
                            />
                            {queueErrors[index]?.visibilityTimeout && (
                              <p className="text-xs text-red-500">{queueErrors[index].visibilityTimeout}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Time a message is hidden after being received
                            </p>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label>Message Retention Period (days)</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>How long SQS retains messages that are not deleted (1-14 days). Messages older than this period are automatically deleted.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
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
                            <div className="flex items-center gap-2">
                              <Label>Delivery Delay (seconds)</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Delay (0-900 seconds) before messages become available for consumption. Useful for scheduling message delivery.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
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
                            <div className="flex items-center gap-2">
                              <Label>Dead Letter Queue</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Name of another queue where messages are moved after exceeding maxReceiveCount. Used for handling failed message processing.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              value={queue.deadLetterQueue || ''}
                              onChange={(e) => updateQueue(index, 'deadLetterQueue', e.target.value)}
                              placeholder="dlq-name"
                            />
                            <p className="text-xs text-muted-foreground">
                              Queue for messages that fail processing
                            </p>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label>Long Polling Wait Time (seconds)</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Maximum time (0-20 seconds) to wait for messages when calling ReceiveMessage. Long polling reduces empty responses and API calls.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              type="number"
                              value={queue.receiveMessageWaitTimeSeconds ?? 0}
                              onChange={(e) =>
                                updateQueue(
                                  index,
                                  'receiveMessageWaitTimeSeconds',
                                  Number(e.target.value)
                                )
                              }
                              min={0}
                              max={20}
                              className={queueErrors[index]?.receiveMessageWaitTimeSeconds ? 'border-red-500' : ''}
                            />
                            {queueErrors[index]?.receiveMessageWaitTimeSeconds && (
                              <p className="text-xs text-red-500">
                                {queueErrors[index].receiveMessageWaitTimeSeconds}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Max wait time for ReceiveMessage (0-20 seconds)
                            </p>
                          </div>
                          {queue.type === 'fifo' && (
                            <>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label>Max Receive Count</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Maximum number of times a message can be received before being moved to the Dead Letter Queue (1-1000).</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
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
                                  <div className="flex items-center gap-2">
                                    <Label>Content-Based Deduplication</Label>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Automatically generate deduplication ID from message content hash. Enables deduplication without providing explicit deduplication ID.</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
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
                                <div className="flex items-center gap-2">
                                  <Label>FIFO Throughput Limit</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Per Queue: 3000 messages/sec. Per Message Group ID: 3000 messages/sec per group, unlimited groups. Choose based on your ordering requirements.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
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
                          <div className="flex flex-col gap-2">
                            <Input
                              value={testMessage}
                              onChange={(e) => setTestMessage(e.target.value)}
                              placeholder="Enter test message..."
                            />
                            <div className="space-y-1">
                              <Label className="text-xs">Message Attributes (key=value, comma-separated)</Label>
                              <Input
                                placeholder="env=prod, type=order, priority=high"
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const attributes: Record<string, string> = {};
                                  raw
                                    .split(',')
                                    .map((part) => part.trim())
                                    .filter(Boolean)
                                    .forEach((pair) => {
                                      const [key, value] = pair.split('=').map((p) => p.trim());
                                      if (key && value !== undefined) {
                                        attributes[key] = value;
                                      }
                                    });
                                  // store parsed attributes on the queue instance (non-persistent, only for test send)
                                  updateQueue(index, 'testAttributes', attributes as any);
                                }}
                              />
                            </div>
                            <div className="flex justify-end">
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
                  <div className="flex items-center gap-2">
                    <Label htmlFor="accessKeyId">Access Key ID</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>AWS access key identifier (starts with AKIA). Used for authenticating API requests to AWS SQS.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="accessKeyId"
                    value={accessKeyId}
                    onChange={(e) => updateConfig({ accessKeyId: e.target.value })}
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="secretAccessKey">Secret Access Key</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Secret key paired with Access Key ID. Keep this secure and never commit to version control. In production, use IAM roles instead.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="secretAccessKey"
                    type="password"
                    value={secretAccessKey}
                    onChange={(e) => updateConfig({ secretAccessKey: e.target.value })}
                    placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="defaultRegion">Default Region</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Default AWS region for queues (e.g., us-east-1, eu-west-1). Individual queues can override this setting.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="defaultRegion"
                    value={defaultRegion}
                    onChange={(e) => updateConfig({ defaultRegion: e.target.value })}
                    placeholder="us-east-1"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="accountId">AWS Account ID</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>12-digit AWS account ID used for generating Queue URLs and ARNs in the format: https://sqs.region.amazonaws.com/accountId/queueName</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="accountId"
                    value={accountId}
                    onChange={(e) => updateConfig({ accountId: e.target.value })}
                    placeholder="123456789012"
                  />
                  <p className="text-xs text-muted-foreground">
                    Used for generating Queue URLs and ARNs
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
                                  <div className="flex items-center gap-2">
                                    <Label>Principal</Label>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>IAM principal (user, role, or service) that the policy applies to. Use "*" for all principals or an ARN like "arn:aws:iam::123456789012:user/username".</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
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
                                  <div className="flex items-center gap-2">
                                    <Label>Action</Label>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>SQS API action to allow or deny: SendMessage, ReceiveMessage, DeleteMessage, GetQueueAttributes, or "*" for all actions.</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
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
                                  <div className="flex items-center gap-2">
                                    <Label>Resource</Label>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Queue name or ARN that the policy applies to. Use "*" for all queues, or specify a specific queue name.</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
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
                                  <div className="flex items-center gap-2">
                                    <Label>Effect</Label>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Allow: Grants permission. Deny: Explicitly denies permission (takes precedence over Allow).</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
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
                              {(queue.approximateMessages || 0) > SQS_THRESHOLDS.MESSAGES_HIGH && (
                                <Badge variant="destructive" className="text-xs">High</Badge>
                              )}
                            </div>
                            <p className="text-2xl font-bold">{queue.approximateMessages?.toLocaleString() || 0}</p>
                            <Progress
                              value={Math.min(((queue.approximateMessages || 0) / SQS_THRESHOLDS.MESSAGES_MAX_PROGRESS) * 100, 100)}
                              className={`h-2 ${
                                (queue.approximateMessages || 0) > SQS_THRESHOLDS.MESSAGES_HIGH 
                                  ? 'bg-red-500' 
                                  : (queue.approximateMessages || 0) > SQS_THRESHOLDS.MESSAGES_WARNING 
                                    ? 'bg-yellow-500' 
                                    : 'bg-green-500'
                              }`}
                            />
                            <p className="text-xs text-muted-foreground">Ready to consume</p>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">In Flight</p>
                              {(queue.approximateMessagesNotVisible || 0) > SQS_THRESHOLDS.IN_FLIGHT_WARNING && (
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
                              value={Math.min(((queue.approximateMessagesDelayed || 0) / SQS_THRESHOLDS.DELAYED_MAX_PROGRESS) * 100, 100)}
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
                                  : (queue.approximateMessages || 0) < SQS_THRESHOLDS.MESSAGES_HEALTHY
                                    ? 'bg-green-500 animate-pulse'
                                    : (queue.approximateMessages || 0) < SQS_THRESHOLDS.MESSAGES_HIGH
                                      ? 'bg-yellow-500'
                                      : 'bg-red-500 animate-pulse'
                              }`}></div>
                              <span className="text-sm font-medium">Queue Health</span>
                            </div>
                            <Badge variant={
                              (queue.approximateMessages || 0) === 0 && (queue.approximateMessagesNotVisible || 0) === 0
                                ? 'secondary'
                                : (queue.approximateMessages || 0) < SQS_THRESHOLDS.MESSAGES_HEALTHY
                                  ? 'default'
                                  : (queue.approximateMessages || 0) < SQS_THRESHOLDS.MESSAGES_HIGH
                                    ? 'outline'
                                    : 'destructive'
                            }>
                              {
                                (queue.approximateMessages || 0) === 0 && (queue.approximateMessagesNotVisible || 0) === 0
                                  ? 'Idle'
                                    : (queue.approximateMessages || 0) < SQS_THRESHOLDS.MESSAGES_HEALTHY
                                      ? 'Healthy'
                                      : (queue.approximateMessages || 0) < SQS_THRESHOLDS.MESSAGES_HIGH
                                        ? 'Warning'
                                      : 'Critical'
                              }
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {
                              (queue.approximateMessages || 0) === 0 && (queue.approximateMessagesNotVisible || 0) === 0
                                ? 'Queue is idle with no messages'
                                : (queue.approximateMessages || 0) < SQS_THRESHOLDS.MESSAGES_HEALTHY
                                  ? 'Queue is operating normally'
                                  : (queue.approximateMessages || 0) < SQS_THRESHOLDS.MESSAGES_HIGH
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

      {/* Delete Queue Confirmation Dialog */}
      <AlertDialog open={deleteQueueIndex !== null} onOpenChange={(open) => !open && setDeleteQueueIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Queue?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete queue "{queues[deleteQueueIndex || 0]?.name}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteQueue}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Policy Confirmation Dialog */}
      <AlertDialog open={deletePolicyId !== null} onOpenChange={(open) => !open && setDeletePolicyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete IAM Policy?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this IAM policy? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePolicy}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


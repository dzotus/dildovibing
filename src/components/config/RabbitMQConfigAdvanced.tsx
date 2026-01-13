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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useState, useEffect, useRef } from 'react';
import { 
  Rabbit, 
  Database, 
  Activity, 
  Settings, 
  Plus, 
  Trash2,
  MessageSquare,
  Users,
  TrendingUp,
  ArrowRightLeft,
  Shield,
  Key
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { usePortValidation } from '@/hooks/usePortValidation';
import { AlertCircle } from 'lucide-react';
import { validateRequiredFields, type RequiredField } from '@/utils/requiredFields';
import { showSuccess, showError } from '@/utils/toast';

interface RabbitMQConfigProps {
  componentId: string;
}

interface Queue {
  name: string;
  durable: boolean;
  exclusive: boolean;
  autoDelete: boolean;
  messages?: number;
  consumers?: number;
  ready?: number;
  unacked?: number;
  arguments?: Record<string, any>;
  deadLetterExchange?: string;
  deadLetterRoutingKey?: string;
  messageTtl?: number;
  maxLength?: number;
  maxPriority?: number;
  queueType?: 'classic' | 'quorum' | 'stream'; // x-queue-type
  singleActiveConsumer?: boolean; // x-single-active-consumer
}

interface Exchange {
  name: string;
  type: 'direct' | 'topic' | 'fanout' | 'headers';
  durable: boolean;
  autoDelete: boolean;
  internal: boolean;
  arguments?: Record<string, any>;
  alternateExchange?: string; // Exchange to route messages when no bindings match
}

interface Binding {
  id: string;
  source: string; // exchange name
  destination: string; // queue name
  routingKey: string;
  arguments?: Record<string, any>;
}

interface Policy {
  name: string;
  pattern: string;
  definition: Record<string, any>;
  priority: number;
  applyTo: 'queues' | 'exchanges' | 'all';
}

interface RabbitMQConfig {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  vhost?: string;
  queues?: Queue[];
  exchanges?: Exchange[];
  bindings?: Binding[];
  policies?: Policy[];
  consumptionRate?: number; // messages per second per consumer (default: 10)
  processingTime?: number; // milliseconds per message (default: 100)
}

export function RabbitMQConfigAdvanced({ componentId }: RabbitMQConfigProps) {
  const { nodes, updateNode, connections } = useCanvasStore();
  const { isRunning } = useEmulationStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;
  const nodeRef = useRef(node);

  // Keep node ref updated
  useEffect(() => {
    nodeRef.current = node;
  }, [node]);

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as RabbitMQConfig;
  const host = config.host || 'localhost';
  const port = config.port || 5672;
  const username = config.username || 'guest';
  const password = config.password || '';
  const vhost = config.vhost || '/';
  const queues = config.queues || [];
  const consumptionRate = config.consumptionRate ?? 10; // default 10 msgs/sec per consumer
  const processingTime = config.processingTime ?? 100; // default 100ms per message
  // Standard RabbitMQ system exchanges (configuration, not data)
  const exchanges = config.exchanges || [
    { name: 'amq.direct', type: 'direct', durable: true, autoDelete: false, internal: false },
    { name: 'amq.topic', type: 'topic', durable: true, autoDelete: false, internal: false },
    { name: 'amq.fanout', type: 'fanout', durable: true, autoDelete: false, internal: false },
  ];
  const bindings = config.bindings || [];
  const policies = config.policies || [];
  
  // Валидация портов и хостов
  const { portError, hostError, portConflict } = usePortValidation(nodes, componentId, host, port);
  
  // Проверка наличия connections для статуса
  const hasConnections = connections.some(conn => conn.source === componentId || conn.target === componentId);
  
  const [editingQueueIndex, setEditingQueueIndex] = useState<number | null>(null);
  const [showCreateExchange, setShowCreateExchange] = useState(false);
  const [showCreateBinding, setShowCreateBinding] = useState(false);
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);
  
  // Состояние для форм создания
  const [newExchange, setNewExchange] = useState<{ name: string; type: 'direct' | 'topic' | 'fanout' | 'headers' }>({
    name: '',
    type: 'direct',
  });
  const [newBinding, setNewBinding] = useState<{ source: string; destination: string; routingKey: string; xMatch?: string }>({
    source: exchanges[0]?.name || '',
    destination: queues[0]?.name || '',
    routingKey: '',
    xMatch: 'all',
  });
  const [newPolicy, setNewPolicy] = useState<{ name: string; pattern: string; applyTo: 'queues' | 'exchanges' | 'all' }>({
    name: '',
    pattern: '.*',
    applyTo: 'all',
  });
  const [editingPolicyIndex, setEditingPolicyIndex] = useState<number | null>(null);
  const [queueSearchQuery, setQueueSearchQuery] = useState('');
  const [exchangeSearchQuery, setExchangeSearchQuery] = useState('');
  const [bindingFilterExchange, setBindingFilterExchange] = useState<string>('');
  const [policyFilterApplyTo, setPolicyFilterApplyTo] = useState<string>('');

  // Sync metrics from routing engine in real-time
  useEffect(() => {
    if (!node || queues.length === 0 || !isRunning) return;
    
    const interval = setInterval(() => {
      const routingEngine = emulationEngine.getRabbitMQRoutingEngine(componentId);
      if (!routingEngine) return;

      const allQueueMetrics = routingEngine.getAllQueueMetrics();
      const currentConfig = (nodeRef.current?.data.config as any) || {};
      const currentQueues = currentConfig.queues || [];
      
      const updatedQueues = currentQueues.map((queue: any) => {
        const metrics = allQueueMetrics.get(queue.name);
        if (metrics) {
          return {
            ...queue,
            messages: metrics.messages,
            ready: metrics.ready,
            unacked: metrics.unacked,
            consumers: metrics.consumers,
          };
        }
        return queue;
      });

      // Check if metrics changed
      const metricsChanged = updatedQueues.some((q: any, i: number) => 
        q.messages !== currentQueues[i]?.messages ||
        q.ready !== currentQueues[i]?.ready ||
        q.unacked !== currentQueues[i]?.unacked ||
        q.consumers !== currentQueues[i]?.consumers
      );

      if (metricsChanged && nodeRef.current) {
        updateNode(componentId, {
          data: {
            ...nodeRef.current.data,
            config: {
              ...currentConfig,
              queues: updatedQueues,
            },
          },
        });
      }
    }, 500); // Update every 500ms

    return () => clearInterval(interval);
  }, [componentId, queues.length, node?.id, updateNode, isRunning]);

  // Sync routing engine when config changes (queues, exchanges, bindings, consumptionRate, processingTime)
  useEffect(() => {
    if (!node) return;
    
    const routingEngine = emulationEngine.getRabbitMQRoutingEngine(componentId);
    if (!routingEngine) return;

    const currentConfig = (node.data.config as any) || {};
    
    // Update routing engine configuration
    routingEngine.initialize({
      queues: currentConfig.queues || [],
      exchanges: currentConfig.exchanges || [],
      bindings: currentConfig.bindings || [],
      consumptionRate: currentConfig.consumptionRate ?? 10,
      processingTime: currentConfig.processingTime ?? 100,
    });

    // Update consumption rate and processing time in routing engine if they exist
    if (currentConfig.consumptionRate !== undefined || currentConfig.processingTime !== undefined) {
      // These will be used in processConsumption method
      // We need to update the routing engine to use these values
      // For now, we'll pass them through the config when initializing
    }

    emulationEngine.updateNodesAndConnections(nodes, connections);
  }, [componentId, queues.length, exchanges.length, bindings.length, consumptionRate, processingTime, node?.id, nodes, connections]);

  // Sync consumers from UI to routing engine when changed
  const syncConsumersToRoutingEngine = (queueName: string, consumers: number) => {
    const routingEngine = emulationEngine.getRabbitMQRoutingEngine(componentId);
    if (routingEngine) {
      routingEngine.updateQueue(queueName, { consumers });
    }
  };

  const updateConfig = (updates: Partial<RabbitMQConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
    // Очистка ошибок валидации при успешном обновлении
    if (Object.keys(updates).some(key => ['host', 'port'].includes(key))) {
      const newErrors = { ...fieldErrors };
      Object.keys(updates).forEach(key => {
        if (newErrors[key]) delete newErrors[key];
      });
      setFieldErrors(newErrors);
    }
  };
  
  // Валидация обязательных полей
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  const requiredFields: RequiredField[] = [
    { field: 'host', label: 'Host' },
    { field: 'port', label: 'Port', validator: (v) => typeof v === 'number' && v > 0 && v <= 65535 },
  ];
  
  const validateConnectionFields = () => {
    const result = validateRequiredFields(
      { host, port },
      requiredFields
    );
    setFieldErrors(result.errors);
    return result.isValid;
  };

  const addQueue = () => {
    updateConfig({
      queues: [
        ...queues,
        { name: 'new-queue', durable: true, exclusive: false, autoDelete: false, messages: 0, consumers: 0, ready: 0, unacked: 0 },
      ],
    });
  };

  const removeQueue = (index: number) => {
    updateConfig({ queues: queues.filter((_, i) => i !== index) });
  };

  const updateQueue = (index: number, field: string, value: string | boolean | number | Record<string, any>) => {
    const newQueues = [...queues];
    newQueues[index] = { ...newQueues[index], [field]: value };
    updateConfig({ queues: newQueues });
    
    // Sync consumers to routing engine if consumers field changed
    if (field === 'consumers' && typeof value === 'number') {
      syncConsumersToRoutingEngine(newQueues[index].name, value);
    }
  };

  const addExchange = () => {
    if (!newExchange.name.trim()) {
      showError('Имя exchange не может быть пустым');
      return;
    }
    // Проверка на уникальность имени
    if (exchanges.some(ex => ex.name === newExchange.name.trim())) {
      showError('Exchange с таким именем уже существует');
      return;
    }
    const exchange: Exchange = {
      name: newExchange.name.trim(),
      type: newExchange.type,
      durable: true,
      autoDelete: false,
      internal: false,
    };
    updateConfig({ exchanges: [...exchanges, exchange] });
    setShowCreateExchange(false);
    setNewExchange({ name: '', type: 'direct' });
    showSuccess('Exchange создан');
  };

  const removeExchange = (index: number) => {
    updateConfig({ exchanges: exchanges.filter((_, i) => i !== index) });
  };

  const updateExchange = (index: number, field: string, value: any) => {
    const newExchanges = [...exchanges];
    newExchanges[index] = { ...newExchanges[index], [field]: value };
    updateConfig({ exchanges: newExchanges });
  };

  // Validate routing key for topic exchanges
  const validateTopicRoutingKey = (routingKey: string): { valid: boolean; warning?: string } => {
    if (!routingKey) return { valid: true }; // Empty routing key is valid
    
    // Check for invalid wildcard usage
    if (routingKey.includes('**')) {
      return { valid: false, warning: 'Invalid: consecutive wildcards (**) are not allowed' };
    }
    
    // Check for wildcard at invalid positions
    if (routingKey.startsWith('*') || routingKey.startsWith('#')) {
      return { valid: false, warning: 'Warning: wildcard at the start may not match as expected' };
    }
    
    // Check for # not at the end
    const hashIndex = routingKey.indexOf('#');
    if (hashIndex !== -1 && hashIndex !== routingKey.length - 1) {
      return { valid: false, warning: 'Invalid: # wildcard must be at the end of the pattern' };
    }
    
    // Check for multiple # wildcards
    if ((routingKey.match(/#/g) || []).length > 1) {
      return { valid: false, warning: 'Invalid: only one # wildcard is allowed and must be at the end' };
    }
    
    return { valid: true };
  };

  // Check if binding is valid (queue/exchange exist)
  const validateBinding = (source: string, destination: string): { valid: boolean; error?: string } => {
    const exchange = exchanges.find(e => e.name === source);
    if (!exchange) {
      return { valid: false, error: `Exchange "${source}" does not exist` };
    }
    
    const queue = queues.find(q => q.name === destination);
    if (!queue) {
      return { valid: false, error: `Queue "${destination}" does not exist` };
    }
    
    return { valid: true };
  };

  const addBinding = () => {
    if (!newBinding.source || !newBinding.destination) {
      showError('Необходимо выбрать exchange и queue');
      return;
    }
    
    // Validate binding (check if exchange and queue exist)
    const bindingValidation = validateBinding(newBinding.source, newBinding.destination);
    if (!bindingValidation.valid) {
      showError(bindingValidation.error || 'Invalid binding');
      return;
    }
    
    const selectedExchange = exchanges.find(e => e.name === newBinding.source);
    
    // Validate routing key for topic exchanges
    if (selectedExchange?.type === 'topic' && newBinding.routingKey) {
      const routingKeyValidation = validateTopicRoutingKey(newBinding.routingKey);
      if (!routingKeyValidation.valid) {
        showError(routingKeyValidation.warning || 'Invalid routing key');
        return;
      }
    }
    
    const binding: Binding = {
      id: `binding-${Date.now()}`,
      source: newBinding.source,
      destination: newBinding.destination,
      routingKey: newBinding.routingKey || '',
      arguments: selectedExchange?.type === 'headers' && newBinding.xMatch ? {
        'x-match': newBinding.xMatch,
      } : undefined,
    };
    updateConfig({ bindings: [...bindings, binding] });
    setShowCreateBinding(false);
    setNewBinding({ source: exchanges[0]?.name || '', destination: queues[0]?.name || '', routingKey: '', xMatch: 'all' });
    showSuccess('Binding создан');
  };

  const removeBinding = (id: string) => {
    updateConfig({ bindings: bindings.filter(b => b.id !== id) });
  };

  const updateBinding = (id: string, field: string, value: string) => {
    const newBindings = bindings.map(b => 
      b.id === id ? { ...b, [field]: value } : b
    );
    updateConfig({ bindings: newBindings });
  };

  const addPolicy = () => {
    if (!newPolicy.name.trim()) {
      showError('Имя policy не может быть пустым');
      return;
    }
    // Проверка на уникальность имени
    if (policies.some(p => p.name === newPolicy.name.trim())) {
      showError('Policy с таким именем уже существует');
      return;
    }
    const policy: Policy = {
      name: newPolicy.name.trim(),
      pattern: newPolicy.pattern || '.*',
      definition: {},
      priority: 0,
      applyTo: newPolicy.applyTo,
    };
    updateConfig({ policies: [...policies, policy] });
    setShowCreatePolicy(false);
    setNewPolicy({ name: '', pattern: '.*', applyTo: 'all' });
    showSuccess('Policy создана');
  };
  
  const updatePolicy = (index: number, field: string, value: any) => {
    const newPolicies = [...policies];
    newPolicies[index] = { ...newPolicies[index], [field]: value };
    updateConfig({ policies: newPolicies });
  };

  const removePolicy = (index: number) => {
    updateConfig({ policies: policies.filter((_, i) => i !== index) });
  };

  const totalMessages = queues.reduce((sum, q) => sum + (q.messages || 0), 0);
  const totalConsumers = queues.reduce((sum, q) => sum + (q.consumers || 0), 0);

  // Filter queues by search query
  const filteredQueues = queues.filter(queue => 
    queue.name.toLowerCase().includes(queueSearchQuery.toLowerCase())
  );

  // Filter exchanges by search query
  const filteredExchanges = exchanges.filter(exchange => 
    exchange.name.toLowerCase().includes(exchangeSearchQuery.toLowerCase())
  );

  // Filter bindings
  const filteredBindings = bindings.filter(binding => {
    if (bindingFilterExchange && bindingFilterExchange !== 'all' && binding.source !== bindingFilterExchange) return false;
    return true;
  });

  // Filter policies by applyTo
  const filteredPolicies = policies.filter(policy => {
    if (policyFilterApplyTo && policyFilterApplyTo !== 'all' && policy.applyTo !== policyFilterApplyTo) return false;
    return true;
  });

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Rabbit className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">RabbitMQ</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Message Broker Management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
              <div className={`h-2 w-2 rounded-full ${hasConnections ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              {hasConnections ? 'Connected' : 'Not Connected'}
            </Badge>
          </div>
        </div>

        <Separator />


        {/* Main Configuration Tabs */}
        <Tabs defaultValue="queues" className="w-full">
          <TabsList className="flex w-full flex-wrap gap-1">
            <TabsTrigger value="queues" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Queues
            </TabsTrigger>
            <TabsTrigger value="exchanges" className="gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Exchanges
            </TabsTrigger>
            <TabsTrigger value="bindings" className="gap-2">
              <Key className="h-4 w-4" />
              Bindings
            </TabsTrigger>
            <TabsTrigger value="policies" className="gap-2">
              <Shield className="h-4 w-4" />
              Policies
            </TabsTrigger>
            <TabsTrigger value="connection" className="gap-2">
              <Database className="h-4 w-4" />
              Connection
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="gap-2">
              <Activity className="h-4 w-4" />
              Monitoring
            </TabsTrigger>
          </TabsList>

          {/* Queues Tab */}
          <TabsContent value="queues" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Message Queues</CardTitle>
                    <CardDescription>Configure and monitor RabbitMQ queues</CardDescription>
                  </div>
                  <Button size="sm" onClick={addQueue} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Queue
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {queues.length > 0 && (
                  <div className="mb-4">
                    <Input
                      placeholder="Search queues..."
                      value={queueSearchQuery}
                      onChange={(e) => setQueueSearchQuery(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                )}
                {filteredQueues.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No queues configured</p>
                    <p className="text-xs mt-2">Click "Add Queue" to create a new queue</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredQueues.map((queue, index) => {
                      const originalIndex = queues.findIndex(q => q.name === queue.name);
                      return (
                    <Card key={originalIndex} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-primary/10">
                              <MessageSquare className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{queue.name}</CardTitle>
                              <CardDescription className="text-xs mt-1 flex items-center gap-2">
                                {queue.durable && <Badge variant="outline" className="text-xs">Durable</Badge>}
                                {queue.exclusive && <Badge variant="outline" className="text-xs">Exclusive</Badge>}
                                {queue.autoDelete && <Badge variant="outline" className="text-xs">Auto-Delete</Badge>}
                                {/* Queue status badge */}
                                {queue.maxLength ? (
                                  queue.messages && queue.messages >= queue.maxLength ? (
                                    <Badge variant="destructive" className="text-xs">Full</Badge>
                                  ) : queue.messages && queue.messages >= queue.maxLength * 0.8 ? (
                                    <Badge variant="outline" className="text-xs text-amber-600">Warning</Badge>
                                  ) : queue.messages === 0 ? (
                                    <Badge variant="outline" className="text-xs text-gray-500">Empty</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs text-green-600">Normal</Badge>
                                  )
                                ) : queue.messages === 0 ? (
                                  <Badge variant="outline" className="text-xs text-gray-500">Empty</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs text-green-600">Normal</Badge>
                                )}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditingQueueIndex(editingQueueIndex === originalIndex ? null : originalIndex)}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            {queues.length > 1 && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeQueue(originalIndex)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Queue Name</Label>
                            <Input
                              value={queue.name}
                              onChange={(e) => updateQueue(originalIndex, 'name', e.target.value)}
                              placeholder="queue-name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Properties</Label>
                            <div className="flex gap-2">
                              <div className="flex items-center gap-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center gap-2">
                                        <Switch
                                          checked={queue.durable}
                                          onCheckedChange={(checked) => {
                                            if (checked && queue.exclusive) {
                                              // Exclusive queue cannot be durable
                                              updateQueue(originalIndex, 'exclusive', false);
                                            }
                                            updateQueue(originalIndex, 'durable', checked);
                                          }}
                                          disabled={queue.exclusive}
                                        />
                                        <Label className="text-xs">Durable</Label>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Queue survives broker restart</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <div className="flex items-center gap-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center gap-2">
                                        <Switch
                                          checked={queue.exclusive}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              // Exclusive queue cannot be durable
                                              updateQueue(originalIndex, 'durable', false);
                                            }
                                            updateQueue(originalIndex, 'exclusive', checked);
                                          }}
                                        />
                                        <Label className="text-xs">Exclusive</Label>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Queue can only be used by one connection</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <div className="flex items-center gap-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center gap-2">
                                        <Switch
                                          checked={queue.autoDelete}
                                          onCheckedChange={(checked) => updateQueue(originalIndex, 'autoDelete', checked)}
                                        />
                                        <Label className="text-xs">Auto-Delete</Label>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Queue is deleted when no longer in use</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* Advanced Queue Configuration */}
                        {editingQueueIndex === originalIndex && (
                          <div className="pt-4 border-t border-border space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-sm">Advanced Configuration</h4>
                              <Button size="sm" variant="outline" onClick={() => setEditingQueueIndex(null)}>
                                Done
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Label>Dead Letter Exchange</Label>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Exchange to send rejected/expired messages to</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <Input
                                  value={queue.deadLetterExchange || ''}
                                  onChange={(e) => updateQueue(originalIndex, 'deadLetterExchange', e.target.value)}
                                  placeholder="dlx"
                                />
                              </div>
                              <div className="space-y-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Label>Dead Letter Routing Key</Label>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Routing key for messages sent to DLX</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <Input
                                  value={queue.deadLetterRoutingKey || ''}
                                  onChange={(e) => updateQueue(originalIndex, 'deadLetterRoutingKey', e.target.value)}
                                  placeholder="routing-key"
                                />
                              </div>
                              <div className="space-y-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Label>Message TTL (ms)</Label>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Time to live for messages in milliseconds</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <Input
                                  type="number"
                                  value={queue.messageTtl || ''}
                                  onChange={(e) => updateQueue(originalIndex, 'messageTtl', parseInt(e.target.value) || undefined)}
                                  placeholder="60000"
                                />
                              </div>
                              <div className="space-y-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Label>Max Length</Label>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Maximum number of messages in queue</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <Input
                                  type="number"
                                  value={queue.maxLength || ''}
                                  onChange={(e) => updateQueue(originalIndex, 'maxLength', parseInt(e.target.value) || undefined)}
                                  placeholder="10000"
                                />
                              </div>
                              <div className="space-y-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Label>Max Priority</Label>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Maximum priority level (0-255)</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <Input
                                  type="number"
                                  min="0"
                                  max="255"
                                  value={queue.maxPriority || ''}
                                  onChange={(e) => updateQueue(originalIndex, 'maxPriority', parseInt(e.target.value) || undefined)}
                                  placeholder="10"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Consumers</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={queue.consumers || 0}
                                  onChange={(e) => updateQueue(originalIndex, 'consumers', parseInt(e.target.value) || 0)}
                                  placeholder="0"
                                />
                              </div>
                              <div className="space-y-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Label>Queue Type (x-queue-type)</Label>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>classic: standard queue, quorum: replicated queue, stream: message stream</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <Select
                                  value={queue.queueType || 'classic'}
                                  onValueChange={(value: 'classic' | 'quorum' | 'stream') => updateQueue(originalIndex, 'queueType', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="classic">Classic</SelectItem>
                                    <SelectItem value="quorum">Quorum</SelectItem>
                                    <SelectItem value="stream">Stream</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center gap-2">
                                        <Switch
                                          checked={queue.singleActiveConsumer || false}
                                          onCheckedChange={(checked) => updateQueue(originalIndex, 'singleActiveConsumer', checked)}
                                        />
                                        <Label>Single Active Consumer (x-single-active-consumer)</Label>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Only one consumer receives messages at a time (useful for load balancing)</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Queue Stats */}
                        <div className="pt-3 border-t border-border space-y-3">
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Messages:</span>
                              <span className="ml-2 font-semibold">{(queue.messages || 0).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Ready:</span>
                              <span className="ml-2 font-semibold">{(queue.ready || 0).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Unacked:</span>
                              <span className="ml-2 font-semibold">{(queue.unacked || 0).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Consumers:</span>
                              <span className="ml-2 font-semibold">{queue.consumers || 0}</span>
                            </div>
                          </div>
                          {/* Queue fill progress bar */}
                          {queue.maxLength && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Queue Fill Level</span>
                                <span>{Math.round(((queue.messages || 0) / queue.maxLength) * 100)}%</span>
                              </div>
                              <Progress 
                                value={queue.maxLength ? ((queue.messages || 0) / queue.maxLength) * 100 : 0}
                                className={`h-2 ${
                                  queue.messages && queue.messages >= queue.maxLength ? 'bg-destructive' :
                                  queue.messages && queue.messages >= queue.maxLength * 0.8 ? 'bg-amber-500' :
                                  'bg-primary'
                                }`}
                              />
                            </div>
                          )}
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

          {/* Exchanges Tab */}
          <TabsContent value="exchanges" className="space-y-4 mt-4">
            {showCreateExchange && (
              <Card className="mb-4 border-primary">
                <CardHeader>
                  <CardTitle>Create Exchange</CardTitle>
                  <CardDescription>Configure exchange settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Exchange Name</Label>
                      <Input 
                        placeholder="my-exchange" 
                        value={newExchange.name}
                        onChange={(e) => setNewExchange({ ...newExchange, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select 
                        value={newExchange.type}
                        onValueChange={(value: 'direct' | 'topic' | 'fanout' | 'headers') => 
                          setNewExchange({ ...newExchange, type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="direct">Direct</SelectItem>
                          <SelectItem value="topic">Topic</SelectItem>
                          <SelectItem value="fanout">Fanout</SelectItem>
                          <SelectItem value="headers">Headers</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={addExchange}>Create Exchange</Button>
                    <Button variant="outline" onClick={() => {
                      setShowCreateExchange(false);
                      setNewExchange({ name: '', type: 'direct' });
                    }}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Exchanges</CardTitle>
                    <CardDescription>Message routing exchanges</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowCreateExchange(true)} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Exchange
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {exchanges.length > 0 && (
                  <div className="mb-4">
                    <Input
                      placeholder="Search exchanges..."
                      value={exchangeSearchQuery}
                      onChange={(e) => setExchangeSearchQuery(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                )}
                <div className="space-y-4">
                  {filteredExchanges.map((exchange, index) => {
                    const originalIndex = exchanges.findIndex(e => e.name === exchange.name);
                    return (
                    <Card key={originalIndex} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-primary/10">
                              <ArrowRightLeft className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{exchange.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline">{exchange.type}</Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
                                        {exchange.type === 'direct' && 'Exact routing key match'}
                                        {exchange.type === 'topic' && 'Pattern-based routing with wildcards (*, #)'}
                                        {exchange.type === 'fanout' && 'Broadcast to all bound queues'}
                                        {exchange.type === 'headers' && 'Match based on message headers'}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                {exchange.durable && <Badge variant="outline" className="ml-1">Durable</Badge>}
                                {exchange.internal && <Badge variant="outline" className="ml-1">Internal</Badge>}
                              </CardDescription>
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeExchange(originalIndex)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Exchange Name</Label>
                            <Input
                              value={exchange.name}
                              onChange={(e) => updateExchange(originalIndex, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Type</Label>
                            <Select
                              value={exchange.type}
                              onValueChange={(value: 'direct' | 'topic' | 'fanout' | 'headers') => updateExchange(originalIndex, 'type', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="direct">Direct</SelectItem>
                                <SelectItem value="topic">Topic</SelectItem>
                                <SelectItem value="fanout">Fanout</SelectItem>
                                <SelectItem value="headers">Headers</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={exchange.durable}
                              onCheckedChange={(checked) => updateExchange(originalIndex, 'durable', checked)}
                            />
                            <Label className="text-xs">Durable</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={exchange.autoDelete}
                              onCheckedChange={(checked) => updateExchange(originalIndex, 'autoDelete', checked)}
                            />
                            <Label className="text-xs">Auto-Delete</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={exchange.internal}
                              onCheckedChange={(checked) => updateExchange(originalIndex, 'internal', checked)}
                            />
                            <Label className="text-xs">Internal</Label>
                          </div>
                        </div>
                        <div className="space-y-2 pt-2 border-t border-border">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Label>Alternate Exchange</Label>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Exchange to route messages when no bindings match (messages are dropped if not set)</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Select
                            value={exchange.alternateExchange || 'none'}
                            onValueChange={(value) => updateExchange(originalIndex, 'alternateExchange', value === 'none' ? undefined : value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="None (messages dropped)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None (messages dropped)</SelectItem>
                              {exchanges.filter(e => e.name !== exchange.name).map((ex) => (
                                <SelectItem key={ex.name} value={ex.name}>{ex.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>
                    );
                    })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bindings Tab */}
          <TabsContent value="bindings" className="space-y-4 mt-4">
            {showCreateBinding && (
              <Card className="mb-4 border-primary">
                <CardHeader>
                  <CardTitle>Create Binding</CardTitle>
                  <CardDescription>Bind exchange to queue</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Source Exchange</Label>
                      <Select 
                        value={newBinding.source}
                        onValueChange={(value) => setNewBinding({ ...newBinding, source: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select exchange" />
                        </SelectTrigger>
                        <SelectContent>
                          {exchanges.map((ex) => (
                            <SelectItem key={ex.name} value={ex.name}>{ex.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Destination Queue</Label>
                      <Select 
                        value={newBinding.destination}
                        onValueChange={(value) => setNewBinding({ ...newBinding, destination: value })}
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
                  </div>
                  <div className="space-y-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Label>Routing Key</Label>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {exchanges.find(e => e.name === newBinding.source)?.type === 'topic' 
                              ? 'Use * for single word, # for multiple words. Example: *.error or logs.#'
                              : exchanges.find(e => e.name === newBinding.source)?.type === 'direct'
                              ? 'Exact match required for direct exchange'
                              : 'Routing key for message routing'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Input 
                      placeholder={exchanges.find(e => e.name === newBinding.source)?.type === 'topic' ? "*.error or logs.#" : "routing.key"} 
                      value={newBinding.routingKey}
                      onChange={(e) => setNewBinding({ ...newBinding, routingKey: e.target.value })}
                      className={exchanges.find(e => e.name === newBinding.source)?.type === 'topic' && newBinding.routingKey 
                        ? (validateTopicRoutingKey(newBinding.routingKey).valid ? '' : 'border-amber-500')
                        : ''}
                    />
                    {exchanges.find(e => e.name === newBinding.source)?.type === 'topic' && newBinding.routingKey && (
                      (() => {
                        const validation = validateTopicRoutingKey(newBinding.routingKey);
                        return validation.warning ? (
                          <div className="flex items-center gap-1 text-xs text-amber-600">
                            <AlertCircle className="h-3 w-3" />
                            <span>{validation.warning}</span>
                          </div>
                        ) : null;
                      })()
                    )}
                  </div>
                  {exchanges.find(e => e.name === newBinding.source)?.type === 'headers' && (
                    <div className="space-y-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Label>X-Match</Label>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>all: all headers must match, any: at least one header must match</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Select 
                        value={newBinding.xMatch || 'all'}
                        onValueChange={(value) => setNewBinding({ ...newBinding, xMatch: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All (all headers must match)</SelectItem>
                          <SelectItem value="any">Any (at least one header must match)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button onClick={addBinding}>Create Binding</Button>
                    <Button variant="outline" onClick={() => {
                      setShowCreateBinding(false);
                      setNewBinding({ source: exchanges[0]?.name || '', destination: queues[0]?.name || '', routingKey: '', xMatch: 'all' });
                    }}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Bindings</CardTitle>
                    <CardDescription>Exchange to queue bindings</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowCreateBinding(true)} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Binding
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {bindings.length > 0 && (
                  <div className="mb-4">
                    <Select value={bindingFilterExchange || 'all'} onValueChange={setBindingFilterExchange}>
                      <SelectTrigger className="max-w-sm">
                        <SelectValue placeholder="Filter by exchange..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Exchanges</SelectItem>
                        {exchanges.map((ex) => (
                          <SelectItem key={ex.name} value={ex.name}>{ex.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {filteredBindings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Key className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No bindings configured</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredBindings.map((binding) => {
                      const exchange = exchanges.find(e => e.name === binding.source);
                      const queue = queues.find(q => q.name === binding.destination);
                      const isInvalid = !exchange || !queue;
                      const routingKeyWarning = exchange?.type === 'topic' && binding.routingKey 
                        ? validateTopicRoutingKey(binding.routingKey).warning 
                        : undefined;
                      
                      return (
                      <Card key={binding.id} className={`p-3 ${isInvalid ? 'border-destructive' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{binding.source}</span>
                                {!exchange && (
                                  <Badge variant="destructive" className="text-xs">Exchange not found</Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                → <span className={!queue ? 'text-destructive font-semibold' : ''}>{binding.destination}</span>
                                {!queue && (
                                  <Badge variant="destructive" className="ml-1 text-xs">Queue not found</Badge>
                                )}
                                {queue && (
                                  <>
                                    {' • Key: '}
                                    <span className={routingKeyWarning ? 'text-amber-600' : ''}>
                                      {binding.routingKey || '(none)'}
                                    </span>
                                    {routingKeyWarning && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <AlertCircle className="h-3 w-3 inline ml-1 text-amber-600" />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>{routingKeyWarning}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </>
                                )}
                                {binding.arguments?.['x-match'] && (
                                  <span> • X-Match: {binding.arguments['x-match']}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select
                              value={binding.source}
                              onValueChange={(value) => updateBinding(binding.id, 'source', value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {exchanges.map((ex) => (
                                  <SelectItem key={ex.name} value={ex.name}>{ex.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              className="w-32"
                              value={binding.routingKey}
                              onChange={(e) => updateBinding(binding.id, 'routingKey', e.target.value)}
                              placeholder="routing key"
                            />
                            <Button size="icon" variant="ghost" onClick={() => removeBinding(binding.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Policies Tab */}
          <TabsContent value="policies" className="space-y-4 mt-4">
            {showCreatePolicy && (
              <Card className="mb-4 border-primary">
                <CardHeader>
                  <CardTitle>Create Policy</CardTitle>
                  <CardDescription>Configure queue/exchange policies</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Policy Name</Label>
                    <Input 
                      placeholder="ha-policy" 
                      value={newPolicy.name}
                      onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pattern</Label>
                    <Input 
                      placeholder=".*" 
                      value={newPolicy.pattern}
                      onChange={(e) => setNewPolicy({ ...newPolicy, pattern: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Apply To</Label>
                    <Select 
                      value={newPolicy.applyTo}
                      onValueChange={(value: 'queues' | 'exchanges' | 'all') => 
                        setNewPolicy({ ...newPolicy, applyTo: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="queues">Queues</SelectItem>
                        <SelectItem value="exchanges">Exchanges</SelectItem>
                        <SelectItem value="all">All</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={addPolicy}>Create Policy</Button>
                    <Button variant="outline" onClick={() => {
                      setShowCreatePolicy(false);
                      setNewPolicy({ name: '', pattern: '.*', applyTo: 'all' });
                    }}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Policies</CardTitle>
                    <CardDescription>Queue and exchange policies</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowCreatePolicy(true)} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Policy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {policies.length > 0 && (
                  <div className="mb-4">
                    <Select value={policyFilterApplyTo || 'all'} onValueChange={setPolicyFilterApplyTo}>
                      <SelectTrigger className="max-w-sm">
                        <SelectValue placeholder="Filter by apply to..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Policies</SelectItem>
                        <SelectItem value="queues">Queues Only</SelectItem>
                        <SelectItem value="exchanges">Exchanges Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {filteredPolicies.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>{policies.length === 0 ? 'No policies configured' : 'No policies match the filter'}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredPolicies.map((policy, index) => {
                      const originalIndex = policies.findIndex(p => p.name === policy.name);
                      return (
                      <Card key={originalIndex} className="p-3">
                        {editingPolicyIndex === originalIndex ? (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Policy Name</Label>
                              <Input
                                value={policy.name}
                                onChange={(e) => updatePolicy(originalIndex, 'name', e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Pattern</Label>
                              <Input
                                value={policy.pattern}
                                onChange={(e) => updatePolicy(originalIndex, 'pattern', e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Apply To</Label>
                              <Select
                                value={policy.applyTo}
                                onValueChange={(value: 'queues' | 'exchanges' | 'all') => updatePolicy(originalIndex, 'applyTo', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="queues">Queues</SelectItem>
                                  <SelectItem value="exchanges">Exchanges</SelectItem>
                                  <SelectItem value="all">All</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Priority</Label>
                              <Input
                                type="number"
                                value={policy.priority}
                                onChange={(e) => updatePolicy(originalIndex, 'priority', parseInt(e.target.value) || 0)}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => setEditingPolicyIndex(null)}>Save</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingPolicyIndex(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold">{policy.name}</div>
                              <div className="text-xs text-muted-foreground">
                                Pattern: {policy.pattern} • Apply to: {policy.applyTo} • Priority: {policy.priority}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="icon" variant="ghost" onClick={() => setEditingPolicyIndex(originalIndex)}>
                                <Settings className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => removePolicy(originalIndex)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Connection Tab */}
          <TabsContent value="connection" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Connection Settings</CardTitle>
                <CardDescription>RabbitMQ server connection details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="host">
                      Host <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="host"
                      value={host}
                      onChange={(e) => {
                        updateConfig({ host: e.target.value });
                        if (fieldErrors.host) {
                          validateConnectionFields();
                        }
                      }}
                      onBlur={validateConnectionFields}
                      placeholder="localhost"
                      className={hostError || fieldErrors.host ? 'border-destructive' : ''}
                    />
                    {hostError && (
                      <div className="flex items-center gap-1 text-sm text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        <span>{hostError}</span>
                      </div>
                    )}
                    {!hostError && fieldErrors.host && (
                      <div className="flex items-center gap-1 text-sm text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        <span>{fieldErrors.host}</span>
                      </div>
                    )}
              {!hostError && fieldErrors.host && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{fieldErrors.host}</span>
                </div>
              )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="number"
                      value={port}
                      onChange={(e) => updateConfig({ port: parseInt(e.target.value) || 5672 })}
                      placeholder="5672"
                      className={portError || portConflict.hasConflict ? 'border-destructive' : ''}
                    />
                    {portError && (
                      <div className="flex items-center gap-1 text-sm text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        <span>{portError}</span>
                      </div>
                    )}
              {!portError && !fieldErrors.port && portConflict.hasConflict && portConflict.conflictingNode && (
                <div className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3 w-3" />
                  <span>
                    Конфликт порта: компонент "{portConflict.conflictingNode.data.label || portConflict.conflictingNode.type}" 
                    уже использует {host}:{port}
                  </span>
                </div>
              )}
              {!portError && fieldErrors.port && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{fieldErrors.port}</span>
                </div>
              )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => updateConfig({ username: e.target.value })}
                      placeholder="guest"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => updateConfig({ password: e.target.value })}
                      placeholder="password"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vhost">Virtual Host</Label>
                  <Input
                    id="vhost"
                    value={vhost}
                    onChange={(e) => updateConfig({ vhost: e.target.value })}
                    placeholder="/"
              />
            </div>
            <Separator />
            <div className="space-y-4">
              <h4 className="font-semibold text-sm">Performance Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label>Consumption Rate (msgs/sec per consumer)</Label>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Number of messages consumed per second by each consumer</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Input
                    type="number"
                    min="1"
                    value={consumptionRate}
                    onChange={(e) => updateConfig({ consumptionRate: parseInt(e.target.value) || 10 })}
                    placeholder="10"
                  />
                </div>
                <div className="space-y-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label>Processing Time (ms per message)</Label>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Time to process each message before acknowledgment</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Input
                    type="number"
                    min="1"
                    value={processingTime}
                    onChange={(e) => updateConfig({ processingTime: parseInt(e.target.value) || 100 })}
                    placeholder="100"
                  />
                </div>
              </div>
            </div>
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Параметры подключения сохраняются автоматически при изменении. 
                Эти настройки используются для симуляции работы RabbitMQ брокера.
              </p>
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          {/* Monitoring Tab */}
          <TabsContent value="monitoring" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Queue Monitoring</CardTitle>
                <CardDescription>Real-time queue statistics and metrics</CardDescription>
              </CardHeader>
              <CardContent>
                {queues.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Нет очередей для мониторинга</p>
                    <p className="text-xs mt-2">Создайте очереди во вкладке "Queues" для отслеживания метрик</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {queues.map((queue, index) => (
                      <div key={index} className="p-4 border border-border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="font-semibold">{queue.name}</div>
                          <Badge variant="secondary">{queue.messages || 0} messages</Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Ready Messages</span>
                            <span className="font-semibold">{(queue.ready || 0).toLocaleString()}</span>
                          </div>
                          <Progress value={queue.messages ? ((queue.ready || 0) / queue.messages) * 100 : 0} className="h-2" />
                          <div className="flex justify-between text-sm mt-2">
                            <span className="text-muted-foreground">Unacked Messages</span>
                            <span className="font-semibold">{(queue.unacked || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm mt-2">
                            <span className="text-muted-foreground">Consumers</span>
                            <span className="font-semibold">{queue.consumers || 0}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Как проверить мониторинг
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Запустите симуляцию (кнопка Play в панели управления)</li>
                    <li>Подключите компоненты к RabbitMQ через connections</li>
                    <li>Метрики обновляются автоматически во время симуляции</li>
                    <li>Обратите внимание на значения Ready, Unacked и Consumers</li>
                    <li>Если очередь растет (Ready увеличивается), проверьте количество Consumers</li>
                    <li>Unacked показывает сообщения в обработке у consumers</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { CanvasNode } from '@/types';
import { getTypedConfig } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, Play, Pause, Database, Users, Activity, Settings, Gauge, RefreshCcw, Key, Shield, FileText, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { emulationEngine } from '@/core/EmulationEngine';
import { HelpCircle } from 'lucide-react';

interface KafkaConfigProps {
  componentId: string;
}

interface TopicConfig {
  retentionMs?: number;
  retentionBytes?: number;
  cleanupPolicy?: 'delete' | 'compact' | 'delete,compact';
  compressionType?: 'uncompressed' | 'gzip' | 'snappy' | 'lz4' | 'zstd';
  maxMessageBytes?: number;
  minInsyncReplicas?: number;
  segmentMs?: number;
  segmentBytes?: number;
}

interface PartitionInfo {
  id: number;
  leader: number;
  replicas: number[];
  isr: number[];
}

interface KafkaConfig {
  brokers?: string[];
  topics?: Array<{ 
    name: string; 
    partitions: number; 
    replication: number;
    messages?: number;
    size?: number;
    config?: TopicConfig;
    partitionInfo?: PartitionInfo[];
  }>;
  consumerGroups?: Array<{
    id: string;
    topic: string;
    lag?: number;
    members?: number;
    offsetStrategy?: 'earliest' | 'latest' | 'none';
    autoCommit?: boolean;
  }>;
  groupId?: string;
  clientId?: string;
  schemaRegistry?: {
    url?: string;
    subjects?: Array<{
      name: string;
      version: number;
      schemaType?: 'AVRO' | 'JSON' | 'PROTOBUF';
      schema?: string;
    }>;
  };
  acls?: Array<{
    principal: string;
    resourceType: 'Topic' | 'Group' | 'Cluster' | 'TransactionalId' | 'DelegationToken';
    resourceName: string;
    resourcePatternType?: 'Literal' | 'Prefixed' | 'Match';
    operation: 'Read' | 'Write' | 'Create' | 'Delete' | 'Alter' | 'Describe' | 'AlterConfigs' | 'DescribeConfigs' | 'ClusterAction' | 'IdempotentWrite' | 'All';
    permission: 'Allow' | 'Deny';
    host?: string;
  }>;
}

export function KafkaConfigAdvanced({ componentId }: KafkaConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { componentMetrics, isRunning } = useEmulationStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = getTypedConfig(node.data.config, {} as KafkaConfig);
  const brokers = config.brokers || ['localhost:9092'];
  const topics = config.topics || [];
  const consumerGroups = config.consumerGroups || [];
  const groupId = config.groupId || 'default-group';
  const clientId = config.clientId || 'default-client';
  const schemaRegistry = config.schemaRegistry || { url: 'http://localhost:8081', subjects: [] };
  const acls = config.acls || [];
  
  // Get Kafka routing engine for real-time metrics
  const routingEngine = emulationEngine.getKafkaRoutingEngine(componentId);
  const metrics = componentMetrics.get(componentId);
  const customMetrics = metrics?.customMetrics || {};
  
  // State for real-time partition metrics
  const [partitionMetrics, setPartitionMetrics] = useState<Record<string, Array<{
    partitionId: number;
    messages: number;
    size: number;
    offset: number;
    highWatermark: number;
    leader: number;
    replicas: number[];
    isr: number[];
  }>>>({});
  
  const [editingTopicIndex, setEditingTopicIndex] = useState<number | null>(null);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [showRegisterSchema, setShowRegisterSchema] = useState(false);
  const [showAddACL, setShowAddACL] = useState(false);
  const [editingConsumerGroupIndex, setEditingConsumerGroupIndex] = useState<number | null>(null);
  
  // Use ref to store node reference to avoid infinite loops
  const nodeRef = useRef(node);
  nodeRef.current = node;
  
  // Update metrics from routing engine in real-time
  useEffect(() => {
    if (!routingEngine || !isRunning) {
      setPartitionMetrics({});
      return;
    }
    
    const updateMetrics = () => {
      if (!routingEngine) return;
      
      // Get current topics from node ref (read fresh each time)
      const currentConfig = (nodeRef.current.data.config as any) || {};
      const currentTopics = currentConfig.topics || [];
      
      const newPartitionMetrics: Record<string, Array<{
        partitionId: number;
        messages: number;
        size: number;
        offset: number;
        highWatermark: number;
        leader: number;
        replicas: number[];
        isr: number[];
      }>> = {};
      
      // Get partition metrics for each topic
      currentTopics.forEach((topic: any) => {
        if (topic?.name) {
          const metrics = routingEngine.getAllPartitionMetrics(topic.name);
          if (metrics.length > 0) {
            newPartitionMetrics[topic.name] = metrics;
          }
        }
      });
      
      setPartitionMetrics(prev => {
        // Only update if metrics actually changed
        const prevKeys = Object.keys(prev).sort().join(',');
        const newKeys = Object.keys(newPartitionMetrics).sort().join(',');
        if (prevKeys === newKeys) {
          // Check if values changed
          let changed = false;
          for (const key in newPartitionMetrics) {
            if (JSON.stringify(prev[key]) !== JSON.stringify(newPartitionMetrics[key])) {
              changed = true;
              break;
            }
          }
          if (!changed) return prev;
        }
        return newPartitionMetrics;
      });
    };
    
    updateMetrics();
    const interval = setInterval(updateMetrics, 1000); // Update every second
    
    return () => clearInterval(interval);
  }, [routingEngine, isRunning, componentId]);
  
  // Sync routing engine when config changes (topics, consumer groups, brokers)
  useEffect(() => {
    if (node && routingEngine) {
      // Convert UI format to routing engine format
      const topics = (config.topics || []).map((t: any) => ({
        name: t.name,
        partitions: t.partitions || 1,
        replication: t.replication || 1,
        config: t.config || {},
        partitionInfo: t.partitionInfo || [],
      }));
      
      const consumerGroups = (config.consumerGroups || []).map((group: any) => ({
        id: group.id,
        topic: group.topic,
        members: group.members || 1,
        offsetStrategy: group.offsetStrategy || 'latest',
        autoCommit: group.autoCommit !== false,
      }));
      
      routingEngine.initialize({
        brokers: config.brokers || ['localhost:9092'],
        topics: topics,
        consumerGroups: consumerGroups,
      });
    }
  }, [config.topics, config.consumerGroups, config.brokers, componentId, node, routingEngine]);
  
  // Schema registration form state
  const [schemaForm, setSchemaForm] = useState({
    subjectName: '',
    schemaType: 'AVRO' as 'AVRO' | 'JSON' | 'PROTOBUF',
    schema: '',
  });
  
  // ACL form state
  const [aclForm, setAclForm] = useState({
    principal: 'User:',
    resourceType: 'Topic' as 'Topic' | 'Group' | 'Cluster' | 'TransactionalId' | 'DelegationToken',
    resourceName: '',
    resourcePatternType: 'Literal' as 'Literal' | 'Prefixed' | 'Match',
    operation: 'Read' as 'Read' | 'Write' | 'Create' | 'Delete' | 'Alter' | 'Describe' | 'AlterConfigs' | 'DescribeConfigs' | 'ClusterAction' | 'IdempotentWrite' | 'All',
    permission: 'Allow' as 'Allow' | 'Deny',
    host: '*',
  });

  const updateConfig = (updates: Partial<KafkaConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
    // Очистка ошибок валидации при успешном обновлении
    if (updates.brokers !== undefined) {
      const newErrors = { ...fieldErrors };
      if (newErrors.brokers) delete newErrors.brokers;
      setFieldErrors(newErrors);
    }
  };
  
  // Валидация обязательных полей
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [topicErrors, setTopicErrors] = useState<Record<number, Record<string, string>>>({});
  
  // Валидация имени топика (Kafka topic name rules)
  const validateTopicName = (name: string): string | null => {
    if (!name || name.trim().length === 0) {
      return 'Topic name is required';
    }
    if (name.length > 249) {
      return 'Topic name must be 249 characters or less';
    }
    // Kafka topic names can contain: letters, numbers, dots, underscores, hyphens
    // Cannot start with a dot or underscore
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) {
      return 'Topic name can only contain letters, numbers, dots, underscores, and hyphens. Cannot start with dot or underscore.';
    }
    // Reserved names
    if (name === '__consumer_offsets' || name.startsWith('__')) {
      return 'Topic name cannot start with double underscore (reserved for internal topics)';
    }
    return null;
  };
  
  // Валидация replication factor
  const validateReplicationFactor = (replication: number, topicIndex: number): string | null => {
    if (replication < 1) {
      return 'Replication factor must be at least 1';
    }
    if (replication > brokers.length) {
      return `Replication factor cannot exceed number of brokers (${brokers.length})`;
    }
    return null;
  };
  
  // Валидация partitions
  const validatePartitions = (partitions: number): string | null => {
    if (partitions < 1) {
      return 'Number of partitions must be at least 1';
    }
    if (partitions > 10000) {
      return 'Number of partitions cannot exceed 10000';
    }
    return null;
  };
  
  const validateBrokers = () => {
    if (!brokers || brokers.length === 0) {
      setFieldErrors({ ...fieldErrors, brokers: 'Необходимо указать хотя бы один broker' });
      return false;
    }
    // Проверка формата host:port
    const invalidBrokers = brokers.filter(b => {
      if (!b || !b.trim()) return true;
      const parts = b.trim().split(':');
      if (parts.length !== 2) return true;
      const port = parseInt(parts[1]);
      return isNaN(port) || port <= 0 || port > 65535;
    });
    if (invalidBrokers.length > 0) {
      setFieldErrors({ ...fieldErrors, brokers: 'Неверный формат broker. Используйте формат host:port' });
      return false;
    }
    const newErrors = { ...fieldErrors };
    if (newErrors.brokers) delete newErrors.brokers;
    setFieldErrors(newErrors);
    return true;
  };
  
  const validateConnectionFields = () => {
    return validateBrokers();
  };

  const addBroker = () => {
    updateConfig({ brokers: [...brokers, 'localhost:9093'] });
  };

  const removeBroker = (index: number) => {
    updateConfig({ brokers: brokers.filter((_, i) => i !== index) });
  };

  const updateBroker = (index: number, value: string) => {
    const newBrokers = [...brokers];
    newBrokers[index] = value;
    updateConfig({ brokers: newBrokers });
  };

  const addTopic = () => {
    const newTopic = {
      name: 'new-topic',
      partitions: 3,
      replication: 1,
      messages: 0,
      size: 0,
      config: {
        retentionMs: 604800000,
        cleanupPolicy: 'delete' as const,
        compressionType: 'gzip' as const,
        maxMessageBytes: 1000000,
        minInsyncReplicas: 1,
      },
      partitionInfo: Array.from({ length: 3 }, (_, i) => ({
        id: i,
        leader: 0,
        replicas: [0, 1],
        isr: [0, 1],
      })),
    };
    updateConfig({
      topics: [...topics, newTopic],
    });
    setShowCreateTopic(false);
  };

  const removeTopic = (index: number) => {
    updateConfig({ topics: topics.filter((_, i) => i !== index) });
  };

  const updateTopic = (index: number, field: string, value: string | number) => {
    const newTopics = [...topics];
    newTopics[index] = { ...newTopics[index], [field]: value };
    
    // Validate field
    const errors = { ...topicErrors[index] || {} };
    if (field === 'name') {
      const error = validateTopicName(String(value));
      if (error) {
        errors.name = error;
      } else {
        delete errors.name;
      }
    } else if (field === 'replication') {
      const error = validateReplicationFactor(Number(value), index);
      if (error) {
        errors.replication = error;
      } else {
        delete errors.replication;
      }
    } else if (field === 'partitions') {
      const error = validatePartitions(Number(value));
      if (error) {
        errors.partitions = error;
      } else {
        delete errors.partitions;
      }
    }
    
    if (Object.keys(errors).length > 0) {
      setTopicErrors({ ...topicErrors, [index]: errors });
    } else {
      const newTopicErrors = { ...topicErrors };
      delete newTopicErrors[index];
      setTopicErrors(newTopicErrors);
    }
    
    updateConfig({ topics: newTopics });
  };

  const updateTopicConfig = (index: number, field: keyof TopicConfig, value: unknown) => {
    const newTopics = [...topics];
    if (!newTopics[index].config) {
      newTopics[index].config = {};
    }
    newTopics[index].config = { ...newTopics[index].config, [field]: value };
    updateConfig({ topics: newTopics });
  };

  const addConsumerGroup = () => {
    updateConfig({
      consumerGroups: [...consumerGroups, { 
        id: 'new-group', 
        topic: topics[0]?.name || '', 
        lag: 0, 
        members: 1,
        offsetStrategy: 'latest',
        autoCommit: true
      }],
    });
  };

  const removeConsumerGroup = (index: number) => {
    updateConfig({
      consumerGroups: consumerGroups.filter((_, i) => i !== index),
    });
  };

  const updateConsumerGroup = (index: number, field: string, value: string | number | boolean) => {
    const newGroups = [...consumerGroups];
    newGroups[index] = { ...newGroups[index], [field]: value };
    updateConfig({ consumerGroups: newGroups });
  };

  const registerSchema = () => {
    if (!schemaForm.subjectName.trim() || !schemaForm.schema.trim()) {
      return; // Validation
    }
    const newSubject = {
      name: schemaForm.subjectName.trim(),
      version: 1, // Schema Registry auto-increments versions
      schemaType: schemaForm.schemaType,
      schema: schemaForm.schema.trim(),
    };
    updateConfig({
      schemaRegistry: {
        ...schemaRegistry,
        subjects: [...(schemaRegistry.subjects || []), newSubject],
      },
    });
    setSchemaForm({ subjectName: '', schemaType: 'AVRO', schema: '' });
    setShowRegisterSchema(false);
  };

  const addACL = () => {
    if (!aclForm.principal.trim() || !aclForm.resourceName.trim()) {
      return; // Validation
    }
    const newACL = {
      principal: aclForm.principal.trim(),
      resourceType: aclForm.resourceType,
      resourceName: aclForm.resourceName.trim(),
      resourcePatternType: aclForm.resourcePatternType,
      operation: aclForm.operation,
      permission: aclForm.permission,
      host: aclForm.host || '*',
    };
    updateConfig({
      acls: [...acls, newACL],
    });
    setAclForm({
      principal: 'User:',
      resourceType: 'Topic',
      resourceName: '',
      resourcePatternType: 'Literal',
      operation: 'Read',
      permission: 'Allow',
      host: '*',
    });
    setShowAddACL(false);
  };

  const removeACL = (index: number) => {
    updateConfig({
      acls: acls.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Kafka Cluster</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Apache Kafka Configuration & Management
                </p>
              </div>
            </div>
          </div>
          <Badge variant="outline" className="gap-2">
            <div className="h-2 w-2 rounded-full bg-gray-400" />
            Configured
          </Badge>
        </div>

        <Separator />



        {/* Main Configuration Tabs */}
        <Tabs defaultValue="brokers" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="brokers" className="gap-2">
              <Database className="h-4 w-4" />
              Brokers
            </TabsTrigger>
            <TabsTrigger value="topics" className="gap-2">
              <Activity className="h-4 w-4" />
              Topics
            </TabsTrigger>
            <TabsTrigger value="consumers" className="gap-2">
              <Users className="h-4 w-4" />
              Consumers
            </TabsTrigger>
            <TabsTrigger value="schemas" className="gap-2">
              <FileText className="h-4 w-4" />
              Schemas
            </TabsTrigger>
            <TabsTrigger value="acls" className="gap-2">
              <Shield className="h-4 w-4" />
              ACLs
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Brokers Tab */}
          <TabsContent value="brokers" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Broker Cluster</CardTitle>
                    <CardDescription>Kafka broker endpoints and connection details</CardDescription>
                  </div>
                  <Button size="sm" onClick={addBroker} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Broker
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {brokers.length === 0 && fieldErrors.brokers && (
                    <div className="flex items-center gap-1 text-sm text-destructive p-2 border border-destructive rounded">
                      <AlertCircle className="h-4 w-4" />
                      <span>{fieldErrors.brokers}</span>
                    </div>
                  )}
                  {brokers.map((broker, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 border border-border rounded-lg bg-card">
                      <div className="flex-1 flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <Input
                          value={broker}
                          onChange={(e) => {
                            updateBroker(index, e.target.value);
                            if (fieldErrors.brokers) {
                              validateBrokers();
                            }
                          }}
                          onBlur={validateBrokers}
                          placeholder="localhost:9092"
                          className={`flex-1 ${fieldErrors.brokers ? 'border-destructive' : ''}`}
                        />
                        <Badge variant="secondary">Broker {index + 1}</Badge>
                      </div>
                      {brokers.length > 1 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeBroker(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {fieldErrors.brokers && brokers.length > 0 && (
                    <div className="flex items-center gap-1 text-sm text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      <span>{fieldErrors.brokers}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Topics Tab */}
          <TabsContent value="topics" className="space-y-4 mt-4">
            {/* Create Topic Dialog */}
            {showCreateTopic && (
              <Card className="mb-4 border-primary">
                <CardHeader>
                  <CardTitle>Create New Topic</CardTitle>
                  <CardDescription>Configure topic settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Topic Name</Label>
                      <Input placeholder="my-topic" />
                    </div>
                    <div className="space-y-2">
                      <Label>Partitions</Label>
                      <Input type="number" defaultValue={3} min={1} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Replication Factor</Label>
                    <Input type="number" defaultValue={1} min={1} max={brokers.length} />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={addTopic}>Create Topic</Button>
                    <Button variant="outline" onClick={() => setShowCreateTopic(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Topics</CardTitle>
                    <CardDescription>Kafka topic configuration and monitoring</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowCreateTopic(true)} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Topic
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {topics.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No topics configured</p>
                    <p className="text-xs mt-2">Click "Create Topic" to add a new topic</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {topics.map((topic, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-primary/10">
                              <Activity className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{topic.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {topic.partitions} partitions • {topic.replication} replicas
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingTopicIndex(editingTopicIndex === index ? null : index)}
                            >
                              {editingTopicIndex === index ? 'Hide Config' : 'Show Config'}
                            </Button>
                            {topics.length > 1 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeTopic(index)}
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
                            <div className="flex items-center gap-2">
                              <Label>Topic Name</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Kafka topic name. Can contain letters, numbers, dots, underscores, and hyphens. Cannot start with dot or underscore. Max 249 characters.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              value={topic.name}
                              onChange={(e) => updateTopic(index, 'name', e.target.value)}
                              placeholder="topic-name"
                              className={topicErrors[index]?.name ? 'border-destructive' : ''}
                            />
                            {topicErrors[index]?.name && (
                              <p className="text-xs text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {topicErrors[index].name}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label>Partitions</Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Number of partitions for this topic. More partitions allow higher parallelism but increase overhead. Recommended: 1-10000.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              type="number"
                              min="1"
                              value={topic.partitions}
                              onChange={(e) => updateTopic(index, 'partitions', parseInt(e.target.value) || 1)}
                              className={topicErrors[index]?.partitions ? 'border-destructive' : ''}
                            />
                            {topicErrors[index]?.partitions && (
                              <p className="text-xs text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {topicErrors[index].partitions}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label>Replication Factor</Label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Number of replicas for each partition. Must be between 1 and the number of brokers ({brokers.length}). Higher replication improves durability but uses more storage.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            type="number"
                            min="1"
                            max={brokers.length}
                            value={topic.replication}
                            onChange={(e) => updateTopic(index, 'replication', parseInt(e.target.value) || 1)}
                            className={topicErrors[index]?.replication ? 'border-destructive' : ''}
                          />
                          {topicErrors[index]?.replication && (
                            <p className="text-xs text-destructive flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {topicErrors[index].replication}
                            </p>
                          )}
                        </div>

                        {/* Advanced Topic Configuration */}
                        {editingTopicIndex === index && topic.config && (
                          <div className="pt-4 border-t border-border space-y-4">
                            <h4 className="font-semibold text-sm">Topic Configuration</h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Retention (ms)</Label>
                                <Input
                                  type="number"
                                  value={topic.config.retentionMs || 604800000}
                                  onChange={(e) => updateTopicConfig(index, 'retentionMs', parseInt(e.target.value) || 0)}
                                  placeholder="604800000 (7 days)"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Retention (bytes)</Label>
                                <Input
                                  type="number"
                                  value={topic.config.retentionBytes || -1}
                                  onChange={(e) => updateTopicConfig(index, 'retentionBytes', parseInt(e.target.value) || -1)}
                                  placeholder="-1 (unlimited)"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Cleanup Policy</Label>
                                <Select
                                  value={topic.config.cleanupPolicy || 'delete'}
                                  onValueChange={(value: 'delete' | 'compact' | 'delete,compact') => updateTopicConfig(index, 'cleanupPolicy', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="delete">Delete</SelectItem>
                                    <SelectItem value="compact">Compact</SelectItem>
                                    <SelectItem value="delete,compact">Delete, Compact</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Compression Type</Label>
                                <Select
                                  value={topic.config.compressionType || 'gzip'}
                                  onValueChange={(value: unknown) => updateTopicConfig(index, 'compressionType', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="uncompressed">Uncompressed</SelectItem>
                                    <SelectItem value="gzip">Gzip</SelectItem>
                                    <SelectItem value="snappy">Snappy</SelectItem>
                                    <SelectItem value="lz4">LZ4</SelectItem>
                                    <SelectItem value="zstd">Zstd</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Max Message Bytes</Label>
                                <Input
                                  type="number"
                                  value={topic.config.maxMessageBytes || 1000000}
                                  onChange={(e) => updateTopicConfig(index, 'maxMessageBytes', parseInt(e.target.value) || 1000000)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Min In-Sync Replicas</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={topic.config.minInsyncReplicas || 1}
                                  onChange={(e) => updateTopicConfig(index, 'minInsyncReplicas', parseInt(e.target.value) || 1)}
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Partition Info with Real Metrics */}
                        <div className="pt-4 border-t border-border">
                          <h4 className="font-semibold text-sm mb-3">Partition Details</h4>
                          <div className="space-y-2">
                            {(() => {
                              // Get real partition metrics from routing engine
                              const realPartitionMetrics = partitionMetrics[topic.name] || [];
                              const partitionInfo = topic.partitionInfo || [];
                              
                              // Use real metrics if available, otherwise fall back to partitionInfo
                              if (realPartitionMetrics.length > 0) {
                                return realPartitionMetrics.map((partMetrics) => {
                                  const isUnderReplicated = partMetrics.isr.length < partMetrics.replicas.length;
                                  const lag = partMetrics.highWatermark - partMetrics.offset;
                                  
                                  return (
                                    <div key={partMetrics.partitionId} className="p-3 border rounded-lg bg-card">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono font-semibold">Partition {partMetrics.partitionId}</span>
                                          {isUnderReplicated && (
                                            <Badge variant="destructive" className="text-xs">Under-replicated</Badge>
                                          )}
                                          {!isUnderReplicated && partMetrics.isr.length === partMetrics.replicas.length && (
                                            <Badge variant="default" className="text-xs bg-green-500">Healthy</Badge>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                          <span>Leader: {partMetrics.leader}</span>
                                          <span>Replicas: [{partMetrics.replicas.join(', ')}]</span>
                                          <span>ISR: [{partMetrics.isr.join(', ')}]</span>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-4 gap-4 text-xs mt-2 pt-2 border-t border-border">
                                        <div>
                                          <span className="text-muted-foreground">Messages:</span>
                                          <span className="ml-1 font-semibold">{partMetrics.messages.toLocaleString()}</span>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Size:</span>
                                          <span className="ml-1 font-semibold">{(partMetrics.size / 1024 / 1024).toFixed(2)} MB</span>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Offset:</span>
                                          <span className="ml-1 font-semibold">{partMetrics.offset}</span>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">HW:</span>
                                          <span className="ml-1 font-semibold">{partMetrics.highWatermark}</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                });
                              } else if (partitionInfo.length > 0) {
                                // Fallback to partitionInfo from config
                                return partitionInfo.map((part, partIndex) => (
                                  <div key={partIndex} className="p-2 border rounded text-sm">
                                    <div className="flex items-center justify-between">
                                      <span className="font-mono">Partition {part.id}</span>
                                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <span>Leader: {part.leader}</span>
                                        <span>Replicas: [{part.replicas.join(', ')}]</span>
                                        <span>ISR: [{part.isr.join(', ')}]</span>
                                      </div>
                                    </div>
                                  </div>
                                ));
                              } else {
                                // No partition info available
                                return (
                                  <div className="text-sm text-muted-foreground p-2">
                                    No partition information available
                                  </div>
                                );
                              }
                            })()}
                          </div>
                        </div>

                        {/* Topic Stats with Real Metrics */}
                        <div className="pt-3 border-t border-border">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Messages:</span>
                              <span className="ml-2 font-semibold">
                                {(() => {
                                  // Get real metrics from routing engine
                                  if (routingEngine) {
                                    const topicMetrics = routingEngine.getTopicMetrics(topic.name);
                                    if (topicMetrics) {
                                      return topicMetrics.messages.toLocaleString();
                                    }
                                  }
                                  return (topic.messages || 0).toLocaleString();
                                })()}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Size:</span>
                              <span className="ml-2 font-semibold">
                                {(() => {
                                  // Get real metrics from routing engine
                                  if (routingEngine) {
                                    const topicMetrics = routingEngine.getTopicMetrics(topic.name);
                                    if (topicMetrics) {
                                      return ((topicMetrics.size / 1024 / 1024).toFixed(2)) + ' MB';
                                    }
                                  }
                                  return (((topic.size || 0) / 1024 / 1024).toFixed(2)) + ' MB';
                                })()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Consumers Tab */}
          <TabsContent value="consumers" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Consumer Groups</CardTitle>
                    <CardDescription>Monitor consumer group lag and activity</CardDescription>
                  </div>
                  <Button size="sm" onClick={addConsumerGroup} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Group
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {consumerGroups.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No consumer groups configured</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {consumerGroups.map((group, index) => (
                      <Card key={index} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded bg-primary/10">
                                <Users className="h-4 w-4 text-primary" />
                              </div>
                          <div>
                                <CardTitle className="text-lg">{group.id}</CardTitle>
                                <CardDescription className="text-xs mt-1">
                                  Topic: {group.topic} • {group.members || 0} members
                                </CardDescription>
                          </div>
                            </div>
                            <div className="flex items-center gap-2">
                          <Badge variant={(() => {
                                // Get real lag from routing engine
                                const realLag = routingEngine ? routingEngine.getConsumerGroupLag(group.id, group.topic) : (group.lag || 0);
                                return realLag > 1000 ? 'destructive' : 'secondary';
                              })()}>
                                Lag: {(() => {
                                  // Get real lag from routing engine
                                  if (routingEngine) {
                                    const realLag = routingEngine.getConsumerGroupLag(group.id, group.topic);
                                    return Math.round(realLag);
                                  }
                                  return Math.round(group.lag || 0);
                                })()}
                          </Badge>
                          {routingEngine && (() => {
                            const consumptionRate = routingEngine.getConsumptionRate(group.id, group.topic);
                            return consumptionRate > 0 ? (
                              <Badge variant="outline">
                                {Math.round(consumptionRate)} msg/s
                              </Badge>
                            ) : null;
                          })()}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingConsumerGroupIndex(editingConsumerGroupIndex === index ? null : index)}
                              >
                                {editingConsumerGroupIndex === index ? 'Hide' : 'Edit'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeConsumerGroup(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                        </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {editingConsumerGroupIndex === index ? (
                            <div className="space-y-4 pt-2 border-t border-border">
                              <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                                  <Label>Group ID</Label>
                                  <Input
                                    value={group.id}
                                    onChange={(e) => updateConsumerGroup(index, 'id', e.target.value)}
                                    placeholder="consumer-group-id"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Topic</Label>
                                  <Select
                                    value={group.topic}
                                    onValueChange={(value) => updateConsumerGroup(index, 'topic', value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {topics.map((topic) => (
                                        <SelectItem key={topic.name} value={topic.name}>
                                          {topic.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Members</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={group.members || 1}
                                    onChange={(e) => updateConsumerGroup(index, 'members', parseInt(e.target.value) || 1)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Offset Strategy</Label>
                                  <Select
                                    value={group.offsetStrategy || 'latest'}
                                    onValueChange={(value: 'earliest' | 'latest' | 'none') => updateConsumerGroup(index, 'offsetStrategy', value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="earliest">Earliest</SelectItem>
                                      <SelectItem value="latest">Latest</SelectItem>
                                      <SelectItem value="none">None</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <Label htmlFor={`auto-commit-${index}`}>Auto Commit</Label>
                                  <p className="text-xs text-muted-foreground">
                                    Automatically commit offsets after consuming messages
                                  </p>
                                </div>
                                <Switch
                                  id={`auto-commit-${index}`}
                                  checked={group.autoCommit !== false}
                                  onCheckedChange={(checked) => updateConsumerGroup(index, 'autoCommit', checked)}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                            <span className="text-muted-foreground">Members:</span>
                                  <span className="ml-2 font-semibold">{group.members || 0}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Offset:</span>
                                  <span className="ml-2 font-semibold capitalize">{group.offsetStrategy || 'latest'}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Auto Commit:</span>
                                  <span className="ml-2 font-semibold">{group.autoCommit !== false ? 'Yes' : 'No'}</span>
                                </div>
                                {routingEngine && (() => {
                                  const consumptionRate = routingEngine.getConsumptionRate(group.id, group.topic);
                                  return consumptionRate > 0 ? (
                                    <div>
                                      <span className="text-muted-foreground">Consumption Rate:</span>
                                      <span className="ml-2 font-semibold">{Math.round(consumptionRate)} msg/s</span>
                                    </div>
                                  ) : null;
                                })()}
                          </div>
                          {(() => {
                            // Get real lag from routing engine
                            const realLag = routingEngine ? routingEngine.getConsumerGroupLag(group.id, group.topic) : (group.lag || 0);
                            return (
                              <Progress 
                                value={Math.min((realLag / 10000) * 100, 100)} 
                                className="h-2" 
                              />
                            );
                          })()}
                          
                          {/* Partition Assignment */}
                          {routingEngine && (() => {
                            const groupState = routingEngine.getConsumerGroupState(group.id);
                            const partitionAssignment = groupState?.partitionAssignment;
                            
                            if (partitionAssignment && partitionAssignment.size > 0) {
                              const assignments: Array<{ memberId: number; partitions: number[] }> = [];
                              partitionAssignment.forEach((partitions, memberId) => {
                                assignments.push({ memberId, partitions });
                              });
                              
                              return (
                                <div className="pt-2 border-t border-border mt-2">
                                  <div className="text-xs font-semibold text-muted-foreground mb-2">Partition Assignment:</div>
                                  <div className="space-y-1">
                                    {assignments.map((assignment) => (
                                      <div key={assignment.memberId} className="text-xs">
                                        <span className="font-mono">Member {assignment.memberId}:</span>
                                        <span className="ml-2 text-muted-foreground">
                                          [{assignment.partitions.sort((a, b) => a - b).join(', ')}]
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  {groupState?.isRebalancing && (
                                    <Badge variant="outline" className="mt-2 text-xs">
                                      <RefreshCcw className="h-3 w-3 mr-1 animate-spin" />
                                      Rebalancing...
                                    </Badge>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}
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

          {/* Schemas Tab */}
          <TabsContent value="schemas" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Schema Registry</CardTitle>
                    <CardDescription>Avro/JSON Schema management</CardDescription>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => {
                    setSchemaForm({ subjectName: '', schemaType: 'AVRO', schema: '' });
                    setShowRegisterSchema(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Register Schema
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Schema Registry URL</Label>
                  <Input
                    value={schemaRegistry.url || ''}
                    onChange={(e) => updateConfig({ 
                      schemaRegistry: { ...schemaRegistry, url: e.target.value } 
                    })}
                    placeholder="http://localhost:8081"
                  />
                </div>
                {schemaRegistry.subjects && schemaRegistry.subjects.length > 0 ? (
                  <div className="space-y-2">
                    <Label>Registered Subjects</Label>
                    {schemaRegistry.subjects.map((subject, idx) => (
                      <Card key={idx} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="font-semibold">{subject.name}</div>
                              {subject.schemaType && (
                                <Badge variant="outline" className="text-xs">
                                  {subject.schemaType}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Version {subject.version}
                            </div>
                            {subject.schema && (
                              <div className="text-xs text-muted-foreground mt-1 font-mono truncate max-w-md">
                                {subject.schema.substring(0, 100)}{subject.schema.length > 100 ? '...' : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No schemas registered</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ACLs Tab */}
          <TabsContent value="acls" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Access Control Lists</CardTitle>
                    <CardDescription>Manage topic and consumer group permissions</CardDescription>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => {
                    setAclForm({
                      principal: 'User:',
                      resourceType: 'Topic',
                      resourceName: topics[0]?.name || '',
                      resourcePatternType: 'Literal',
                      operation: 'Read',
                      permission: 'Allow',
                      host: '*',
                    });
                    setShowAddACL(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add ACL
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {acls.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No ACLs configured</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {acls.map((acl, index) => {
                      // Backward compatibility: handle old ACL format
                      const aclRecord = acl as Record<string, unknown>;
                      const resourceType = (aclRecord.resourceType as string) || 'Topic';
                      const resourceName = (aclRecord.resourceName as string) || (aclRecord.resource as string) || 'unknown';
                      const resourcePatternType = (aclRecord.resourcePatternType as string) || 'Literal';
                      const host = (aclRecord.host as string) || '*';
                      
                      return (
                        <Card key={index} className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="font-semibold">{acl.principal}</div>
                                <Badge variant={acl.permission === 'Allow' ? 'default' : 'destructive'} className="text-xs">
                                  {acl.permission}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <div>
                                  <span className="font-medium">{resourceType}:</span> {resourceName}
                                  {resourcePatternType && resourcePatternType !== 'Literal' && (
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      {resourcePatternType}
                                    </Badge>
                                  )}
                                </div>
                                <div>
                                  <span className="font-medium">Operation:</span> {acl.operation}
                                  {host && host !== '*' && (
                                    <span className="ml-2">• Host: {host}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button size="icon" variant="ghost" onClick={() => removeACL(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Client Settings</CardTitle>
                <CardDescription>Consumer group and client configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="group-id">Consumer Group ID</Label>
                  <Input
                    id="group-id"
                    value={groupId}
                    onChange={(e) => updateConfig({ groupId: e.target.value })}
                    placeholder="default-group"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-id">Client ID</Label>
                  <Input
                    id="client-id"
                    value={clientId}
                    onChange={(e) => updateConfig({ clientId: e.target.value })}
                    placeholder="default-client"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Register Schema Dialog */}
        <Dialog open={showRegisterSchema} onOpenChange={setShowRegisterSchema}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Register Schema</DialogTitle>
              <DialogDescription>
                Register a new schema in Schema Registry. The subject name typically follows the pattern: topic-name-value or topic-name-key.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {topics.length > 0 && (
                <div className="space-y-2">
                  <Label>Select Topic (optional)</Label>
                  <Select
                    onValueChange={(topicName) => {
                      setSchemaForm({ ...schemaForm, subjectName: `${topicName}-value` });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a topic to auto-fill subject name" />
                    </SelectTrigger>
                    <SelectContent>
                      {topics.map((topic) => (
                        <SelectItem key={topic.name} value={topic.name}>
                          {topic.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Selecting a topic will set subject name to: topic-name-value
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="subject-name">Subject Name</Label>
                <Input
                  id="subject-name"
                  value={schemaForm.subjectName}
                  onChange={(e) => setSchemaForm({ ...schemaForm, subjectName: e.target.value })}
                  placeholder="my-topic-value"
                />
                <p className="text-xs text-muted-foreground">
                  Subject name (e.g., topic-name-value, topic-name-key). In Schema Registry, subjects are typically named as topic-name-value or topic-name-key.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="schema-type">Schema Type</Label>
                <Select
                  value={schemaForm.schemaType}
                  onValueChange={(value: 'AVRO' | 'JSON' | 'PROTOBUF') => setSchemaForm({ ...schemaForm, schemaType: value })}
                >
                  <SelectTrigger id="schema-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AVRO">AVRO</SelectItem>
                    <SelectItem value="JSON">JSON</SelectItem>
                    <SelectItem value="PROTOBUF">PROTOBUF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="schema-content">Schema Content</Label>
                <Textarea
                  id="schema-content"
                  value={schemaForm.schema}
                  onChange={(e) => setSchemaForm({ ...schemaForm, schema: e.target.value })}
                  placeholder='{"type": "record", "name": "Example", "fields": [{"name": "field1", "type": "string"}]}'
                  className="font-mono text-sm h-48"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the schema definition in JSON format
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRegisterSchema(false)}>
                Cancel
              </Button>
              <Button onClick={registerSchema} disabled={!schemaForm.subjectName.trim() || !schemaForm.schema.trim()}>
                Register Schema
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add ACL Dialog */}
        <Dialog open={showAddACL} onOpenChange={setShowAddACL}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Access Control List (ACL)</DialogTitle>
              <DialogDescription>
                Create a new ACL rule to control access to Kafka resources. Principal format: User:username or Group:groupname
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="principal">Principal</Label>
                <Input
                  id="principal"
                  value={aclForm.principal}
                  onChange={(e) => setAclForm({ ...aclForm, principal: e.target.value })}
                  placeholder="User:alice or Group:developers"
                />
                <p className="text-xs text-muted-foreground">
                  Format: User:username or Group:groupname
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="resource-type">Resource Type</Label>
                  <Select
                    value={aclForm.resourceType}
                    onValueChange={(value: unknown) => setAclForm({ ...aclForm, resourceType: value as string })}
                  >
                    <SelectTrigger id="resource-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Topic">Topic</SelectItem>
                      <SelectItem value="Group">Group</SelectItem>
                      <SelectItem value="Cluster">Cluster</SelectItem>
                      <SelectItem value="TransactionalId">TransactionalId</SelectItem>
                      <SelectItem value="DelegationToken">DelegationToken</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resource-pattern-type">Pattern Type</Label>
                  <Select
                    value={aclForm.resourcePatternType}
                    onValueChange={(value: unknown) => setAclForm({ ...aclForm, resourcePatternType: value as string })}
                  >
                    <SelectTrigger id="resource-pattern-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Literal">Literal</SelectItem>
                      <SelectItem value="Prefixed">Prefixed</SelectItem>
                      <SelectItem value="Match">Match</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="resource-name">Resource Name</Label>
                <Input
                  id="resource-name"
                  value={aclForm.resourceName}
                  onChange={(e) => setAclForm({ ...aclForm, resourceName: e.target.value })}
                  placeholder={aclForm.resourceType === 'Topic' ? 'my-topic' : aclForm.resourceType === 'Group' ? 'my-group' : 'resource-name'}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="operation">Operation</Label>
                  <Select
                    value={aclForm.operation}
                    onValueChange={(value: unknown) => setAclForm({ ...aclForm, operation: value as string })}
                  >
                    <SelectTrigger id="operation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Read">Read</SelectItem>
                      <SelectItem value="Write">Write</SelectItem>
                      <SelectItem value="Create">Create</SelectItem>
                      <SelectItem value="Delete">Delete</SelectItem>
                      <SelectItem value="Alter">Alter</SelectItem>
                      <SelectItem value="Describe">Describe</SelectItem>
                      <SelectItem value="AlterConfigs">AlterConfigs</SelectItem>
                      <SelectItem value="DescribeConfigs">DescribeConfigs</SelectItem>
                      <SelectItem value="ClusterAction">ClusterAction</SelectItem>
                      <SelectItem value="IdempotentWrite">IdempotentWrite</SelectItem>
                      <SelectItem value="All">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="permission">Permission</Label>
                  <Select
                    value={aclForm.permission}
                    onValueChange={(value: 'Allow' | 'Deny') => setAclForm({ ...aclForm, permission: value })}
                  >
                    <SelectTrigger id="permission">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Allow">Allow</SelectItem>
                      <SelectItem value="Deny">Deny</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="host">Host (optional)</Label>
                <Input
                  id="host"
                  value={aclForm.host}
                  onChange={(e) => setAclForm({ ...aclForm, host: e.target.value })}
                  placeholder="* (all hosts)"
                />
                <p className="text-xs text-muted-foreground">
                  IP address or hostname. Use * for all hosts.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddACL(false)}>
                Cancel
              </Button>
              <Button onClick={addACL} disabled={!aclForm.principal.trim() || !aclForm.resourceName.trim()}>
                Add ACL
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}


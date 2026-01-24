import { useState, useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { showWarning, showSuccess, showError } from '@/utils/toast';
import { validateRequiredFields, type RequiredField } from '@/utils/requiredFields';
import { AlertCircle } from 'lucide-react';
import {
  Database,
  Key,
  Terminal,
  Settings,
  Plus,
  Trash2,
  Search,
  Hash,
  List,
  Layers,
  FileText,
  Zap,
  Radio
} from 'lucide-react';

interface RedisConfigProps {
  componentId: string;
}

type RedisDataType = 'string' | 'hash' | 'list' | 'set' | 'zset' | 'stream';

interface RedisKey {
  key: string;
  type: RedisDataType;
  ttl?: number;
  value?: any;
  size?: number;
}

interface RedisCommand {
  command: string;
  args: string[];
  result?: string;
}

interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  database?: number;
  maxMemory?: string;
  maxMemoryPolicy?: 'noeviction' | 'allkeys-lru' | 'allkeys-lfu' | 'volatile-lru' | 'volatile-lfu' | 'volatile-ttl' | 'volatile-random' | 'allkeys-random';
  enablePersistence?: boolean;
  persistenceType?: 'rdb' | 'aof' | 'both';
  rdbSaveInterval?: string;
  aofRewritePolicy?: 'always' | 'everysec' | 'no';
  enableCluster?: boolean;
  clusterNodes?: string[];
  keys?: RedisKey[];
  commands?: RedisCommand[];
  selectedKey?: string;
  metrics?: {
    enabled?: boolean;
    port?: number;
    path?: string;
  };
}

export function RedisConfigAdvanced({ componentId }: RedisConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as RedisConfig;
  const host = config.host || 'localhost';
  const port = config.port || 6379;
  const password = config.password || '';
  const database = config.database || 0;
  const maxMemory = config.maxMemory || '256mb';
  const maxMemoryPolicy = config.maxMemoryPolicy || 'noeviction';
  const enablePersistence = config.enablePersistence ?? true;
  const persistenceType = config.persistenceType || 'rdb';
  const rdbSaveInterval = config.rdbSaveInterval || '900 1 300 10 60 10000';
  const aofRewritePolicy = config.aofRewritePolicy || 'everysec';
  const enableCluster = config.enableCluster ?? false;
  const clusterNodes = config.clusterNodes || ['localhost:6379', 'localhost:6380', 'localhost:6381'];
  const keys = config.keys || [];
  const commands = config.commands || [];
  const selectedKey = config.selectedKey || '';

  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyType, setNewKeyType] = useState<RedisDataType>('string');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyTtl, setNewKeyTtl] = useState<string>('');
  const [searchPattern, setSearchPattern] = useState('*');
  const [commandInput, setCommandInput] = useState('');
  const [editingKeyIndex, setEditingKeyIndex] = useState<number | null>(null);
  
  // Pub/Sub state
  const [pubSubChannel, setPubSubChannel] = useState('');
  const [pubSubMessage, setPubSubMessage] = useState('');
  const [pubSubPattern, setPubSubPattern] = useState('');
  const [pubSubChannelSearch, setPubSubChannelSearch] = useState('');
  const [pubSubInfo, setPubSubInfo] = useState<{
    channels: Array<{ name: string; subscribers: number; messageCount: number; lastMessageAt?: number }>;
    patterns: Array<{ pattern: string; subscribers: number }>;
  } | null>(null);
  
  // Real-time metrics from RedisRoutingEngine
  const [realMetrics, setRealMetrics] = useState<{
    totalKeys: number;
    memoryUsage: number;
    memoryUsagePercent: number;
    operationsPerSecond: number;
    hitRate: number;
    hitCount: number;
    missCount: number;
    slowlog?: Array<{
      id: number;
      timestamp: number;
      duration: number;
      command: string;
      args: string[];
      client: string;
    }>;
    commandStatistics?: Array<{
      command: string;
      calls: number;
      totalDuration: number;
      averageDuration: number;
    }>;
    networkBytesIn?: number;
    networkBytesOut?: number;
    connectedClientsDetail?: Array<{
      id: string;
      addr: string;
      age: number;
      idle: number;
      cmd: string;
    }>;
  } | null>(null);
  
  // Runtime keys from RedisRoutingEngine (merged with config keys)
  const [runtimeKeys, setRuntimeKeys] = useState<RedisKey[]>([]);
  
  // Connection status - real status from engine
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  
  // Update metrics, keys, and connection status from runtime
  useEffect(() => {
    if (!node) {
      setConnectionStatus('disconnected');
      return;
    }
    
    const interval = setInterval(() => {
      const redisEngine = emulationEngine.getRedisRoutingEngine(componentId);
      if (redisEngine) {
        // Engine exists - connected
        setConnectionStatus('connected');
        
        const metrics = redisEngine.getMetrics();
        const allKeys = redisEngine.getAllKeys();
        
        setRealMetrics({
          totalKeys: metrics.totalKeys,
          memoryUsage: metrics.memoryUsage,
          memoryUsagePercent: metrics.memoryUsagePercent,
          operationsPerSecond: metrics.operationsPerSecond,
          hitRate: metrics.hitRate,
          hitCount: metrics.hitCount,
          missCount: metrics.missCount,
          slowlog: metrics.slowlog,
          commandStatistics: metrics.commandStatistics,
          networkBytesIn: metrics.networkBytesIn,
          networkBytesOut: metrics.networkBytesOut,
          connectedClientsDetail: metrics.connectedClientsDetail,
        });
        
        // Merge runtime keys with config keys (runtime takes precedence for values)
        const configKeyMap = new Map(keys.map(k => [k.key, k]));
        const mergedKeys = allKeys.map(runtimeKey => {
          const configKey = configKeyMap.get(runtimeKey.key);
          return {
            ...runtimeKey,
            // Keep config metadata if exists
            ...(configKey && { 
              // Prefer runtime value but keep config structure
            }),
          };
        });
        
        // Add config keys that don't exist in runtime yet
        for (const configKey of keys) {
          if (!allKeys.find(k => k.key === configKey.key)) {
            mergedKeys.push(configKey);
          }
        }
        
        setRuntimeKeys(mergedKeys);
      } else {
        // No engine - disconnected
        setConnectionStatus('disconnected');
        setRealMetrics(null);
        setRuntimeKeys([]);
      }
    }, 500); // Update every 500ms
    
    return () => clearInterval(interval);
  }, [componentId, node, keys]);
  
  // Note: Connection settings are applied when user clicks "Сохранить и применить"
  // This prevents unnecessary reinitializations on every keystroke

  const updateConfig = (updates: Partial<RedisConfig>) => {
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

  const addKey = () => {
    if (!newKeyName.trim()) {
      showError('Имя ключа обязательно');
      return;
    }

    // Проверка на дубликаты
    const keyExists = keys.some(k => k.key === newKeyName.trim());
    if (keyExists) {
      showError(`Ключ "${newKeyName.trim()}" уже существует`);
      return;
    }

    // Валидация TTL
    if (newKeyTtl && (isNaN(parseInt(newKeyTtl)) || parseInt(newKeyTtl) < -1)) {
      showError('TTL должен быть числом >= -1');
      return;
    }

    const newKey: RedisKey = {
      key: newKeyName.trim(),
      type: newKeyType,
      ttl: newKeyTtl ? parseInt(newKeyTtl) : -1,
      value: newKeyValue,
      size: newKeyValue.length || 0
    };

    updateConfig({ keys: [...keys, newKey] });
    setNewKeyName('');
    setNewKeyValue('');
    setNewKeyTtl('');
    setShowCreateKey(false);
    showSuccess(`Ключ "${newKeyName.trim()}" успешно создан`);
  };

  const removeKey = (index: number) => {
    const keyToRemove = displayKeys[index];
    if (keyToRemove) {
      // Delete from runtime
      const redisEngine = emulationEngine.getRedisRoutingEngine(componentId);
      if (redisEngine) {
        redisEngine.executeCommand('DEL', [keyToRemove.key]);
      }
      
      // Remove from config
      updateConfig({ keys: keys.filter(k => k.key !== keyToRemove.key) });
      showSuccess(`Key "${keyToRemove.key}" deleted`);
    }
  };

  const updateKey = (index: number, field: keyof RedisKey, value: any) => {
    const updated = [...keys];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ keys: updated });
  };

  const executeCommand = () => {
    if (!commandInput.trim()) return;

    const parts = commandInput.trim().split(/\s+/);
    const command = parts[0].toUpperCase();
    const args = parts.slice(1);

    // Execute command through RedisRoutingEngine
    const redisEngine = emulationEngine.getRedisRoutingEngine(componentId);
    let result = `OK (simulated)`;
    let error: string | undefined;

    if (redisEngine) {
      const commandResult = redisEngine.executeCommand(command, args);
      if (commandResult.success) {
        if (commandResult.value !== undefined && commandResult.value !== null) {
          result = typeof commandResult.value === 'string' 
            ? commandResult.value 
            : JSON.stringify(commandResult.value, null, 2);
        } else {
          result = 'OK';
        }
      } else {
        error = commandResult.error || 'Command failed';
        result = `ERROR: ${error}`;
      }
    }

    const newCommand: RedisCommand = {
      command,
      args,
      result: error ? `ERROR: ${error}` : result
    };

    updateConfig({ commands: [newCommand, ...commands.slice(0, 49)] }); // Keep last 50 commands
    setCommandInput('');
    
    if (error) {
      showError(`Redis command failed: ${error}`);
    } else {
      showSuccess('Command executed successfully');
    }
  };

  // Pub/Sub handlers
  const handlePublish = () => {
    if (!pubSubChannel || !pubSubMessage) return;

    const redisEngine = emulationEngine.getRedisRoutingEngine(componentId);
    if (!redisEngine) {
      showError('Redis Routing Engine not initialized');
      return;
    }

    const result = redisEngine.executeCommand('PUBLISH', [pubSubChannel, pubSubMessage]);
    if (result.success) {
      const subscribersCount = result.value as number;
      showSuccess(`Message published to ${subscribersCount} subscriber${subscribersCount !== 1 ? 's' : ''}`);
      setPubSubMessage('');
      // Refresh Pub/Sub info
      setPubSubInfo(redisEngine.getPubSubInfo());
    } else {
      showError(result.error || 'Failed to publish message');
    }
  };

  const handleSubscribe = (channel: string) => {
    const redisEngine = emulationEngine.getRedisRoutingEngine(componentId);
    if (!redisEngine) {
      showError('Redis Routing Engine not initialized');
      return;
    }

    const result = redisEngine.executeCommand('SUBSCRIBE', [channel]);
    if (result.success) {
      showSuccess(`Subscribed to channel: ${channel}`);
      setPubSubInfo(redisEngine.getPubSubInfo());
    } else {
      showError(result.error || 'Failed to subscribe');
    }
  };

  const handlePSubscribe = (pattern?: string) => {
    const patternToUse = pattern || pubSubPattern;
    if (!patternToUse) return;

    const redisEngine = emulationEngine.getRedisRoutingEngine(componentId);
    if (!redisEngine) {
      showError('Redis Routing Engine not initialized');
      return;
    }

    const result = redisEngine.executeCommand('PSUBSCRIBE', [patternToUse]);
    if (result.success) {
      showSuccess(`Subscribed to pattern: ${patternToUse}`);
      setPubSubPattern('');
      setPubSubInfo(redisEngine.getPubSubInfo());
    } else {
      showError(result.error || 'Failed to subscribe to pattern');
    }
  };

  // Update Pub/Sub info from RedisRoutingEngine
  useEffect(() => {
    const redisEngine = emulationEngine.getRedisRoutingEngine(componentId);
    if (redisEngine) {
      setPubSubInfo(redisEngine.getPubSubInfo());
    }
  }, [componentId, realMetrics]); // Update when metrics change

  const addClusterNode = () => {
    // Generate next node address based on current port + clusterNodes length
    // If current port is 6379, next nodes will be 6380, 6381, etc.
    const basePort = port || 6379;
    const nextPort = basePort + clusterNodes.length + 1;
    const newNodeAddress = `${host || 'localhost'}:${nextPort}`;
    updateConfig({ clusterNodes: [...clusterNodes, newNodeAddress] });
  };

  const removeClusterNode = (index: number) => {
    updateConfig({ clusterNodes: clusterNodes.filter((_, i) => i !== index) });
  };

  const getTypeIcon = (type: RedisDataType) => {
    switch (type) {
      case 'string': return <FileText className="h-4 w-4" />;
      case 'hash': return <Hash className="h-4 w-4" />;
      case 'list': return <List className="h-4 w-4" />;
      case 'set': return <Layers className="h-4 w-4" />;
      case 'zset': return <Zap className="h-4 w-4" />;
      case 'stream': return <Database className="h-4 w-4" />;
      default: return <Key className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: RedisDataType) => {
    switch (type) {
      case 'string': return 'bg-blue-500/10 text-blue-500';
      case 'hash': return 'bg-purple-500/10 text-purple-500';
      case 'list': return 'bg-green-500/10 text-green-500';
      case 'set': return 'bg-yellow-500/10 text-yellow-500';
      case 'zset': return 'bg-orange-500/10 text-orange-500';
      case 'stream': return 'bg-red-500/10 text-red-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  // Use runtime keys if available, otherwise fall back to config keys
  const displayKeys = runtimeKeys.length > 0 ? runtimeKeys : keys;
  
  const filteredKeys = displayKeys.filter(key => {
    if (searchPattern === '*') return true;
    try {
      const pattern = new RegExp(searchPattern.replace(/\*/g, '.*'));
      return pattern.test(key.key);
    } catch {
      return key.key.includes(searchPattern);
    }
  });

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Database className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Redis</h2>
              <p className="text-sm text-muted-foreground mt-1">In-memory data structure store</p>
            </div>
          </div>
           <div className="flex items-center gap-2">
             {host && port && (
               <Badge variant="outline" className="text-xs">
                 {host}:{port}
               </Badge>
             )}
             <Badge 
               variant={connectionStatus === 'connected' ? 'secondary' : 'outline'} 
               className="gap-2"
             >
               <div className={`h-2 w-2 rounded-full ${
                 connectionStatus === 'connected' 
                   ? 'bg-green-500 animate-pulse' 
                   : 'bg-gray-400'
               }`} />
               {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
             </Badge>
            {realMetrics && (
              <>
                <Badge variant="outline" className="gap-1">
                  <Zap className="h-3 w-3" />
                  {realMetrics.operationsPerSecond.toFixed(0)} ops/s
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Database className="h-3 w-3" />
                  {realMetrics.totalKeys} keys
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Key className="h-3 w-3" />
                  {(realMetrics.hitRate * 100).toFixed(1)}% hit
                </Badge>
              </>
            )}
          </div>
        </div>

        <Separator />

        {/* Connection Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Connection Settings</CardTitle>
            <CardDescription>Configure Redis connection parameters</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>
                Host <span className="text-destructive">*</span>
              </Label>
              <Input
                value={host}
                onChange={(e) => {
                  updateConfig({ host: e.target.value });
                  if (fieldErrors.host) {
                    validateConnectionFields();
                  }
                }}
                onBlur={validateConnectionFields}
                className={fieldErrors.host ? 'border-destructive' : ''}
              />
              {fieldErrors.host && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{fieldErrors.host}</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>
                Port <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                value={port}
                onChange={(e) => {
                  updateConfig({ port: parseInt(e.target.value) || 6379 });
                  if (fieldErrors.port) {
                    validateConnectionFields();
                  }
                }}
                onBlur={validateConnectionFields}
                className={fieldErrors.port ? 'border-destructive' : ''}
              />
              {fieldErrors.port && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{fieldErrors.port}</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => updateConfig({ password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Database</Label>
              <Input
                type="number"
                min="0"
                max="15"
                value={database}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  // Redis supports databases 0-15 by default
                  if (!isNaN(value) && value >= 0 && value <= 15) {
                    updateConfig({ database: value });
                  } else if (e.target.value === '') {
                    // Allow empty to clear
                    updateConfig({ database: 0 });
                  }
                }}
                onBlur={(e) => {
                  // Ensure value is valid on blur
                  const value = parseInt(e.target.value);
                  if (isNaN(value) || value < 0) {
                    updateConfig({ database: 0 });
                  } else if (value > 15) {
                    updateConfig({ database: 15 });
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Redis database number (0-15, default: 0)
              </p>
            </div>
            <div className="flex gap-2 pt-4 border-t col-span-4">
              <Button
                onClick={() => {
                  if (!validateConnectionFields()) {
                    showError('Пожалуйста, исправьте ошибки в полях подключения');
                    return;
                  }
                  
                  // Reinitialize Redis engine with new connection settings
                  const { nodes: allNodes, connections } = useCanvasStore.getState();
                  emulationEngine.initialize(allNodes, connections);
                  showSuccess('Параметры подключения сохранены и применены');
                }}
              >
                Сохранить и применить
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!validateConnectionFields()) {
                    showError('Пожалуйста, исправьте ошибки в полях подключения');
                    return;
                  }
                  
                  // Check if engine exists and can execute commands
                  const redisEngine = emulationEngine.getRedisRoutingEngine(componentId);
                  if (redisEngine) {
                    // Try to execute PING command
                    const result = redisEngine.executeCommand('PING', []);
                    if (result.success) {
                      showSuccess(`Подключение активно: ${host}:${port}`);
                    } else {
                      showError(`Ошибка подключения: ${result.error || 'Unknown error'}`);
                    }
                  } else {
                    // Try to initialize
                    const { nodes: allNodes, connections } = useCanvasStore.getState();
                    emulationEngine.initialize(allNodes, connections);
                    
                    // Check again after initialization
                    setTimeout(() => {
                      const newEngine = emulationEngine.getRedisRoutingEngine(componentId);
                      if (newEngine) {
                        showSuccess(`Подключение установлено: ${host}:${port}`);
                      } else {
                        showError('Не удалось инициализировать подключение');
                      }
                    }, 100);
                  }
                }}
              >
                Проверить подключение
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="keys" className="w-full">
          <TabsList className="flex w-full flex-wrap gap-2">
            <TabsTrigger value="keys" className="gap-2">
              <Key className="h-4 w-4" />
              Keys
            </TabsTrigger>
            <TabsTrigger value="commands" className="gap-2">
              <Terminal className="h-4 w-4" />
              Commands
            </TabsTrigger>
            <TabsTrigger value="pubsub" className="gap-2">
              <Radio className="h-4 w-4" />
              Pub/Sub
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-2">
              <Zap className="h-4 w-4" />
              Metrics
            </TabsTrigger>
            <TabsTrigger value="configuration" className="gap-2">
              <Settings className="h-4 w-4" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="cluster" className="gap-2">
              <Database className="h-4 w-4" />
              Cluster
            </TabsTrigger>
          </TabsList>

          {/* Keys Tab */}
          <TabsContent value="keys" className="mt-4 space-y-4">
            {/* Real-time Metrics */}
            {realMetrics && (
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <CardTitle className="text-base">Real-time Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Memory Usage</div>
                      <div className="text-2xl font-bold">{((realMetrics.memoryUsage / 1024 / 1024)).toFixed(2)} MB</div>
                      <div className="text-xs text-muted-foreground">{realMetrics.memoryUsagePercent.toFixed(1)}% of max</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Operations/sec</div>
                      <div className="text-2xl font-bold">{realMetrics.operationsPerSecond.toFixed(0)}</div>
                      <div className="text-xs text-muted-foreground">Current rate</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Hit Rate</div>
                      <div className="text-2xl font-bold">{(realMetrics.hitRate * 100).toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">{realMetrics.hitCount} hits / {realMetrics.missCount} misses</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Total Keys</div>
                      <div className="text-2xl font-bold">{realMetrics.totalKeys}</div>
                      <div className="text-xs text-muted-foreground">In memory</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Keys</CardTitle>
                  <CardDescription>
                    Manage Redis keys and their values
                    {runtimeKeys.length > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({runtimeKeys.length} keys from runtime)
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Input
                    className="w-48"
                    placeholder="Search pattern (e.g., user:*)"
                    value={searchPattern}
                    onChange={(e) => setSearchPattern(e.target.value)}
                  />
                  <Button variant="outline" size="sm" onClick={() => setShowCreateKey(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Key
                  </Button>
                </div>
              </CardHeader>
              {showCreateKey && (
                <CardContent className="border-b pb-4 mb-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Key Name</Label>
                        <Input
                          value={newKeyName}
                          onChange={(e) => setNewKeyName(e.target.value)}
                          placeholder="user:1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select value={newKeyType} onValueChange={(value) => setNewKeyType(value as RedisDataType)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="string">String</SelectItem>
                            <SelectItem value="hash">Hash</SelectItem>
                            <SelectItem value="list">List</SelectItem>
                            <SelectItem value="set">Set</SelectItem>
                            <SelectItem value="zset">Sorted Set</SelectItem>
                            <SelectItem value="stream">Stream</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>TTL (seconds, -1 for no expiry)</Label>
                        <Input
                          type="number"
                          value={newKeyTtl}
                          onChange={(e) => setNewKeyTtl(e.target.value)}
                          placeholder="-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Value (JSON for complex types)</Label>
                      <Textarea
                        className="font-mono text-sm"
                        rows={3}
                        value={newKeyValue}
                        onChange={(e) => setNewKeyValue(e.target.value)}
                        placeholder={newKeyType === 'string' ? '"value"' : '{"field": "value"}'}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={addKey}
                        disabled={!newKeyName.trim()}
                      >
                        Add Key
                      </Button>
                      <Button variant="outline" onClick={() => {
                        setShowCreateKey(false);
                        setNewKeyName('');
                        setNewKeyValue('');
                        setNewKeyTtl('');
                      }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-2">
                {filteredKeys.map((key, index) => (
                  <div key={index} className="p-3 border border-border rounded-lg bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded ${getTypeColor(key.type)}`}>
                          {getTypeIcon(key.type)}
                        </div>
                        <div className="space-y-1">
                          <div className="font-mono font-semibold">{key.key}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">{key.type}</Badge>
                            {key.ttl && key.ttl > 0 && (
                              <span>TTL: {key.ttl}s</span>
                            )}
                            {key.ttl === -1 && (
                              <span>No expiry</span>
                            )}
                            {key.size && (
                              <span>Size: {key.size} bytes</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingKeyIndex(editingKeyIndex === index ? null : index)}
                        >
                          {editingKeyIndex === index ? 'Hide' : 'View'}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeKey(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {editingKeyIndex === index && (
                      <div className="pt-2 border-t space-y-2">
                        <Label>Value</Label>
                        <Textarea
                          className="font-mono text-xs"
                          rows={4}
                          value={typeof key.value === 'string' ? key.value : JSON.stringify(key.value, null, 2)}
                          onChange={(e) => {
                            try {
                              const parsed = JSON.parse(e.target.value);
                              updateKey(index, 'value', parsed);
                            } catch (error) {
                              // Fallback на строку, если JSON невалиден (нормально для Redis)
                              updateKey(index, 'value', e.target.value);
                              // Показываем предупреждение только если пользователь явно пытался ввести JSON
                              if (e.target.value.trim().startsWith('{') || e.target.value.trim().startsWith('[')) {
                                showWarning('Неверный формат JSON, значение сохранено как строка');
                              }
                            }
                          }}
                        />
                        <div className="flex gap-2">
                          <div className="space-y-2 flex-1">
                            <Label>TTL (seconds)</Label>
                            <Input
                              type="number"
                              value={key.ttl || -1}
                              onChange={(e) => updateKey(index, 'ttl', parseInt(e.target.value) || -1)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {filteredKeys.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No keys found. Add a key to get started.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Commands Tab */}
          <TabsContent value="commands" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Redis Commands</CardTitle>
                <CardDescription>Execute Redis commands directly</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Command</Label>
                  <div className="flex gap-2">
                    <Input
                      className="font-mono"
                      value={commandInput}
                      onChange={(e) => setCommandInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          executeCommand();
                        }
                      }}
                      placeholder="GET user:1"
                    />
                    <Button onClick={executeCommand}>
                      <Terminal className="h-4 w-4 mr-2" />
                      Execute
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Examples: GET key, SET key value, HGETALL hash, LPUSH list value, SADD set member
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Command History</Label>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {commands.map((cmd, index) => (
                      <div key={index} className="p-3 border rounded bg-muted/50 font-mono text-sm">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-primary font-semibold">
                            {cmd.command} {cmd.args.join(' ')}
                          </div>
                        </div>
                        {cmd.result && (
                          <div className="text-muted-foreground text-xs mt-1">
                            → {cmd.result}
                          </div>
                        )}
                      </div>
                    ))}
                    {commands.length === 0 && (
                      <div className="text-center text-muted-foreground py-4">
                        No commands executed yet
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pub/Sub Tab */}
          <TabsContent value="pubsub" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pub/Sub Channels</CardTitle>
                <CardDescription>Manage Redis Pub/Sub channels and subscriptions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Publish Message */}
                <div className="space-y-2">
                  <Label>Publish Message</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Channel name"
                      value={pubSubChannel || ''}
                      onChange={(e) => setPubSubChannel(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Message"
                      value={pubSubMessage || ''}
                      onChange={(e) => setPubSubMessage(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={handlePublish}
                      disabled={!pubSubChannel || !pubSubMessage}
                    >
                      Publish
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Channels List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Active Channels</Label>
                    <Badge variant="secondary">{pubSubInfo?.channels.length || 0} channels</Badge>
                  </div>
                  {/* Search Channels */}
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search channels..."
                      value={pubSubChannelSearch}
                      onChange={(e) => setPubSubChannelSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  {pubSubInfo && pubSubInfo.channels.length > 0 ? (
                    <div className="space-y-2">
                      {pubSubInfo.channels
                        .filter((channel) => {
                          if (!pubSubChannelSearch.trim()) return true;
                          return channel.name.toLowerCase().includes(pubSubChannelSearch.toLowerCase());
                        })
                        .map((channel) => (
                        <Card key={channel.name} className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-semibold">{channel.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {channel.subscribers} subscriber{channel.subscribers !== 1 ? 's' : ''} • {channel.messageCount} messages
                                {channel.lastMessageAt && (
                                  <> • Last: {new Date(channel.lastMessageAt).toLocaleTimeString()}</>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSubscribe(channel.name)}
                            >
                              Subscribe
                            </Button>
                          </div>
                        </Card>
                      ))}
                      {pubSubInfo.channels.filter((channel) => {
                        if (!pubSubChannelSearch.trim()) return true;
                        return channel.name.toLowerCase().includes(pubSubChannelSearch.toLowerCase());
                      }).length === 0 && pubSubChannelSearch.trim() && (
                        <div className="text-center text-muted-foreground py-4">
                          No channels found matching "{pubSubChannelSearch}"
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-4">
                      No active channels. Publish a message to create a channel.
                    </div>
                  )}
                </div>

                <Separator />

                {/* Patterns List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Pattern Subscriptions</Label>
                    <Badge variant="secondary">{pubSubInfo?.patterns.length || 0} patterns</Badge>
                  </div>
                  {pubSubInfo && pubSubInfo.patterns.length > 0 ? (
                    <div className="space-y-2">
                      {pubSubInfo.patterns.map((pattern) => (
                        <Card key={pattern.pattern} className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-semibold font-mono">{pattern.pattern}</div>
                              <div className="text-sm text-muted-foreground">
                                {pattern.subscribers} subscriber{pattern.subscribers !== 1 ? 's' : ''}
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePSubscribe(pattern.pattern)}
                            >
                              Subscribe
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-4">
                      No pattern subscriptions
                    </div>
                  )}
                </div>

                <Separator />

                {/* Subscribe to Pattern */}
                <div className="space-y-2">
                  <Label>Subscribe to Pattern</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Pattern (e.g., news.*)"
                      value={pubSubPattern || ''}
                      onChange={(e) => setPubSubPattern(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={handlePSubscribe}
                      disabled={!pubSubPattern}
                    >
                      PSubscribe
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Use * for wildcard matching (e.g., news.* matches news.sports, news.tech, etc.)
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Command Statistics</CardTitle>
                <CardDescription>Statistics for executed commands</CardDescription>
              </CardHeader>
              <CardContent>
                {realMetrics?.commandStatistics && realMetrics.commandStatistics.length > 0 ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-5 gap-2 p-2 border-b font-semibold text-sm">
                      <div>Command</div>
                      <div className="text-right">Calls</div>
                      <div className="text-right">Total Duration</div>
                      <div className="text-right">Avg Duration</div>
                      <div className="text-right">% of Total</div>
                    </div>
                    {realMetrics.commandStatistics.map((stat, index) => {
                      const totalCalls = realMetrics.commandStatistics!.reduce((sum, s) => sum + s.calls, 0);
                      const percentage = totalCalls > 0 ? ((stat.calls / totalCalls) * 100).toFixed(1) : '0.0';
                      return (
                        <div key={index} className="grid grid-cols-5 gap-2 p-2 border-b text-sm">
                          <div className="font-mono">{stat.command}</div>
                          <div className="text-right">{stat.calls.toLocaleString()}</div>
                          <div className="text-right">{(stat.totalDuration / 1000).toFixed(2)}ms</div>
                          <div className="text-right">{(stat.averageDuration / 1000).toFixed(2)}ms</div>
                          <div className="text-right">{percentage}%</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No command statistics available yet
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Slowlog</CardTitle>
                <CardDescription>Slow commands (threshold: 10ms)</CardDescription>
              </CardHeader>
              <CardContent>
                {realMetrics?.slowlog && realMetrics.slowlog.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {realMetrics.slowlog.slice(0, 20).map((entry) => (
                      <div key={entry.id} className="p-3 border rounded bg-muted/50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-mono text-sm font-semibold">
                            {entry.command} {entry.args.slice(0, 3).join(' ')}
                            {entry.args.length > 3 && '...'}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {(entry.duration / 1000).toFixed(2)}ms
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleString()} • {entry.client}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No slow commands recorded
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Network I/O</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Bytes In</span>
                      <span className="font-mono">
                        {realMetrics?.networkBytesIn 
                          ? (realMetrics.networkBytesIn / 1024).toFixed(2) + ' KB'
                          : '0 KB'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Bytes Out</span>
                      <span className="font-mono">
                        {realMetrics?.networkBytesOut 
                          ? (realMetrics.networkBytesOut / 1024).toFixed(2) + ' KB'
                          : '0 KB'}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-sm font-semibold">Total</span>
                      <span className="font-mono font-semibold">
                        {realMetrics?.networkBytesIn && realMetrics?.networkBytesOut
                          ? ((realMetrics.networkBytesIn + realMetrics.networkBytesOut) / 1024).toFixed(2) + ' KB'
                          : '0 KB'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Connected Clients</CardTitle>
                </CardHeader>
                <CardContent>
                  {realMetrics?.connectedClientsDetail && realMetrics.connectedClientsDetail.length > 0 ? (
                    <div className="space-y-2">
                      {realMetrics.connectedClientsDetail.map((client, index) => (
                        <div key={index} className="p-2 border rounded text-sm">
                          <div className="font-mono">{client.addr}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Age: {client.age}s • Idle: {client.idle}s • Cmd: {client.cmd || 'N/A'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-4">
                      No clients connected
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Configuration Tab */}
          <TabsContent value="configuration" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Redis Configuration</CardTitle>
                <CardDescription>Configure Redis server settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Memory</Label>
                    <Input
                      value={maxMemory}
                      onChange={(e) => updateConfig({ maxMemory: e.target.value })}
                      placeholder="256mb"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Memory Policy</Label>
                    <Select
                      value={maxMemoryPolicy}
                      onValueChange={(value) => updateConfig({ maxMemoryPolicy: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="noeviction">noeviction</SelectItem>
                        <SelectItem value="allkeys-lru">allkeys-lru</SelectItem>
                        <SelectItem value="allkeys-lfu">allkeys-lfu</SelectItem>
                        <SelectItem value="volatile-lru">volatile-lru</SelectItem>
                        <SelectItem value="volatile-lfu">volatile-lfu</SelectItem>
                        <SelectItem value="volatile-ttl">volatile-ttl</SelectItem>
                        <SelectItem value="volatile-random">volatile-random</SelectItem>
                        <SelectItem value="allkeys-random">allkeys-random</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Enable Persistence</Label>
                      <p className="text-sm text-muted-foreground">Save data to disk</p>
                    </div>
                    <Switch
                      checked={enablePersistence}
                      onCheckedChange={(checked) => updateConfig({ enablePersistence: checked })}
                    />
                  </div>
                  {enablePersistence && (
                    <>
                      <div className="space-y-2">
                        <Label>Persistence Type</Label>
                        <Select
                          value={persistenceType}
                          onValueChange={(value) => updateConfig({ persistenceType: value as any })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rdb">RDB</SelectItem>
                            <SelectItem value="aof">AOF</SelectItem>
                            <SelectItem value="both">Both</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {persistenceType === 'rdb' || persistenceType === 'both' && (
                        <div className="space-y-2">
                          <Label>RDB Save Interval</Label>
                          <Input
                            value={rdbSaveInterval}
                            onChange={(e) => updateConfig({ rdbSaveInterval: e.target.value })}
                            placeholder="900 1 300 10 60 10000"
                          />
                          <p className="text-xs text-muted-foreground">
                            Format: save &lt;seconds&gt; &lt;changes&gt;
                          </p>
                        </div>
                      )}
                      {persistenceType === 'aof' || persistenceType === 'both' && (
                        <div className="space-y-2">
                          <Label>AOF Rewrite Policy</Label>
                          <Select
                            value={aofRewritePolicy}
                            onValueChange={(value) => updateConfig({ aofRewritePolicy: value as any })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="always">always</SelectItem>
                              <SelectItem value="everysec">everysec</SelectItem>
                              <SelectItem value="no">no</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Metrics Export (redis_exporter)</Label>
                      <p className="text-xs text-muted-foreground mt-1">Export Redis metrics for Prometheus scraping</p>
                    </div>
                    <Switch 
                      checked={config.metrics?.enabled ?? true}
                      onCheckedChange={(checked) => updateConfig({ 
                        metrics: { 
                          ...config.metrics, 
                          enabled: checked,
                          port: config.metrics?.port || 9121,
                          path: config.metrics?.path || '/metrics'
                        } 
                      })}
                    />
                  </div>
                  {config.metrics?.enabled !== false && (
                    <>
                      <div className="space-y-2">
                        <Label>Metrics Port (redis_exporter)</Label>
                        <Input 
                          type="number" 
                          value={config.metrics?.port ?? 9121}
                          onChange={(e) => updateConfig({ 
                            metrics: { 
                              ...config.metrics, 
                              port: parseInt(e.target.value) || 9121,
                              path: config.metrics?.path || '/metrics'
                            } 
                          })}
                          min={1024} 
                          max={65535} 
                        />
                        <p className="text-xs text-muted-foreground">Default port for redis_exporter: 9121</p>
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
                              port: config.metrics?.port || 9121
                            } 
                          })}
                          placeholder="/metrics"
                        />
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cluster Tab */}
          <TabsContent value="cluster" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Redis Cluster Configuration</CardTitle>
                <CardDescription>Configure Redis cluster for high availability</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Enable Cluster Mode</Label>
                    <p className="text-sm text-muted-foreground">Enable Redis cluster for distributed data</p>
                  </div>
                  <Switch
                    checked={enableCluster}
                    onCheckedChange={(checked) => updateConfig({ enableCluster: checked })}
                  />
                </div>
                {enableCluster && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Cluster Nodes</Label>
                      <Button variant="outline" size="sm" onClick={addClusterNode}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Node
                      </Button>
                    </div>
                    {clusterNodes.map((node, index) => (
                      <div key={index} className="p-3 border rounded bg-muted/50 flex items-center justify-between">
                        <span className="font-mono">{node}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeClusterNode(index)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


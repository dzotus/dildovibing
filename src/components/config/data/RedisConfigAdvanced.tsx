import { useState } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
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
  Zap
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
    updateConfig({ keys: keys.filter((_, i) => i !== index) });
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

    const newCommand: RedisCommand = {
      command,
      args,
      result: `OK (simulated)`
    };

    updateConfig({ commands: [newCommand, ...commands.slice(0, 49)] }); // Keep last 50 commands
    setCommandInput('');
  };

  const addClusterNode = () => {
    updateConfig({ clusterNodes: [...clusterNodes, 'localhost:6382'] });
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

  const filteredKeys = keys.filter(key => {
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
            <Badge variant="outline">v7.2</Badge>
            <Badge variant="secondary" className="gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Connected
            </Badge>
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
                value={database}
                onChange={(e) => updateConfig({ database: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex gap-2 pt-4 border-t col-span-4">
              <Button
                onClick={() => {
                  if (validateConnectionFields()) {
                    showSuccess('Параметры подключения сохранены');
                  } else {
                    showError('Пожалуйста, заполните все обязательные поля');
                  }
                }}
              >
                Сохранить настройки
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (validateConnectionFields()) {
                    showSuccess('Параметры подключения валидны');
                  } else {
                    showError('Пожалуйста, заполните все обязательные поля');
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="keys" className="gap-2">
              <Key className="h-4 w-4" />
              Keys
            </TabsTrigger>
            <TabsTrigger value="commands" className="gap-2">
              <Terminal className="h-4 w-4" />
              Commands
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
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Keys</CardTitle>
                  <CardDescription>Manage Redis keys and their values</CardDescription>
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


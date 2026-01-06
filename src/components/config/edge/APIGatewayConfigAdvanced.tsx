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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useState, useEffect } from 'react';
import { showSuccess, showError, showWarning } from '@/utils/toast';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Globe,
  Route,
  CheckCircle,
  Shield,
  Zap,
  TrendingUp,
  Network,
  Cloud,
  Layers,
  Package,
  FileText,
  Users,
  FileCode,
  Key,
  Server,
  Code
} from 'lucide-react';
import type {
  BaseAPIGatewayConfig,
  GatewayProvider,
  API,
  APIKey,
  AWSGatewayConfig,
  AzureGatewayConfig,
  GCPGatewayConfig,
} from '@/core/api-gateway/types';
import { getDefaultProviderConfig } from '@/core/api-gateway/types';
import { EDGE_PROFILES } from './profiles';

interface APIGatewayConfigProps {
  componentId: string;
}

export function APIGatewayConfigAdvanced({ componentId }: APIGatewayConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { isRunning } = useEmulationStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  // Получаем конфиг и мигрируем старые данные
  const rawConfig = (node.data.config as any) || {} as BaseAPIGatewayConfig;
  
  // Миграция: backend → backendUrl для старых API
  const migratedApis = (rawConfig.apis || []).map((api: any) => {
    if (api.backend && !api.backendUrl) {
      return { ...api, backendUrl: api.backend };
    }
    return api;
  });

  // Инициализация провайдера и дефолтных значений
  const profileDefaults = EDGE_PROFILES['api-gateway']?.defaults || {};
  const provider: GatewayProvider = rawConfig.provider || profileDefaults.gatewayType || 'aws';
  const region = rawConfig.region || profileDefaults.region || 'us-east-1';
  const name = rawConfig.name || node.data.label || 'api-gateway';

  // Определяем текущий providerConfig из сохраненных конфигов или создаем новый
  let currentProviderConfig: AWSGatewayConfig | AzureGatewayConfig | GCPGatewayConfig;
  if (provider === 'aws' && rawConfig.awsConfig) {
    currentProviderConfig = rawConfig.awsConfig;
  } else if (provider === 'azure' && rawConfig.azureConfig) {
    currentProviderConfig = rawConfig.azureConfig;
  } else if (provider === 'gcp' && rawConfig.gcpConfig) {
    currentProviderConfig = rawConfig.gcpConfig;
  } else if (rawConfig.providerConfig && 'provider' in rawConfig.providerConfig && rawConfig.providerConfig.provider === provider) {
    // Используем существующий providerConfig если он соответствует текущему провайдеру
    currentProviderConfig = rawConfig.providerConfig;
  } else {
    // Создаем новый дефолтный конфиг
    currentProviderConfig = getDefaultProviderConfig(provider);
  }

  // Инициализация конфига с дефолтами из профиля
  const config: BaseAPIGatewayConfig = {
    provider,
    region,
    name,
    enableAuthentication: rawConfig.enableAuthentication ?? rawConfig.enableApiKeyAuth ?? profileDefaults.enableAuthentication ?? true,
    authType: rawConfig.authType || profileDefaults.authType || 'api-key',
    enableRateLimiting: rawConfig.enableRateLimiting ?? profileDefaults.enableRateLimiting ?? true,
    defaultRateLimit: rawConfig.defaultRateLimit ?? profileDefaults.rateLimitPerSecond ? (profileDefaults.rateLimitPerSecond * 60) : 1000,
    enableThrottling: rawConfig.enableThrottling ?? profileDefaults.enableThrottling ?? true,
    throttlingBurst: rawConfig.throttlingBurst ?? profileDefaults.throttlingBurst ?? 200,
    enableCaching: rawConfig.enableCaching ?? profileDefaults.enableCaching ?? false,
    cacheTTL: rawConfig.cacheTTL ?? profileDefaults.cacheTTL ?? 300,
    enableLogging: rawConfig.enableLogging ?? profileDefaults.enableLogging ?? true,
    enableRequestLogging: rawConfig.enableRequestLogging ?? profileDefaults.enableLogging ?? true,
    enableMetrics: rawConfig.enableMetrics ?? profileDefaults.enableMetrics ?? true,
    requestTimeout: rawConfig.requestTimeout ?? 30,
    metrics: rawConfig.metrics || {
      enabled: true,
      port: 9100,
      path: '/metrics',
    },
    apis: migratedApis,
    keys: rawConfig.keys || [],
    providerConfig: currentProviderConfig,
    // Сохраняем конфиги всех провайдеров
    awsConfig: rawConfig.awsConfig || (provider === 'aws' ? currentProviderConfig : undefined),
    azureConfig: rawConfig.azureConfig || (provider === 'azure' ? currentProviderConfig : undefined),
    gcpConfig: rawConfig.gcpConfig || (provider === 'gcp' ? currentProviderConfig : undefined),
    ...rawConfig,
  };

  const apis = config.apis || [];
  const keys = config.keys || [];
  const totalAPIs = config.totalAPIs || apis.length;
  const totalKeys = config.totalKeys || keys.length;
  const totalRequests = config.totalRequests || apis.reduce((sum, a) => sum + (a.requests || 0), 0);
  const successRate = isRunning && totalRequests > 0
    ? ((totalRequests - apis.reduce((sum, a) => sum + (a.errors || 0), 0)) / totalRequests) * 100 
    : null;

  const [showCreateAPI, setShowCreateAPI] = useState(false);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newAPIName, setNewAPIName] = useState('');
  const [newAPIPath, setNewAPIPath] = useState('');
  const [newAPIBackend, setNewAPIBackend] = useState('');
  const [newAPIMethod, setNewAPIMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE' | 'ALL'>('GET');
  const [newAPIAuthRequired, setNewAPIAuthRequired] = useState<boolean | undefined>(undefined);
  const [newAPIAuthScopes, setNewAPIAuthScopes] = useState('');
  const [newAPICachingEnabled, setNewAPICachingEnabled] = useState(false);
  const [newAPICacheTTL, setNewAPICacheTTL] = useState<number | undefined>(undefined);
  const [newAPICacheKeys, setNewAPICacheKeys] = useState<string[]>(['method', 'path']);
  
  // API Key creation form state
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyApiIds, setNewKeyApiIds] = useState<string[]>([]);
  const [newKeyRateLimit, setNewKeyRateLimit] = useState<number | undefined>(undefined);
  
  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'api' | 'key' | 'stage' | 'usage-plan' | 'authorizer' | 'product' | 'subscription' | 'policy' | 'backend' | 'service-account' | 'quota';
    id: string;
    name: string;
  } | null>(null);

  const updateConfig = (updates: Partial<BaseAPIGatewayConfig>) => {
    // Если обновляется providerConfig, также сохраняем его в соответствующее поле провайдера
    if (updates.providerConfig && 'provider' in updates.providerConfig) {
      const providerType = updates.providerConfig.provider;
      if (providerType === 'aws') {
        updates.awsConfig = updates.providerConfig as AWSGatewayConfig;
      } else if (providerType === 'azure') {
        updates.azureConfig = updates.providerConfig as AzureGatewayConfig;
      } else if (providerType === 'gcp') {
        updates.gcpConfig = updates.providerConfig as GCPGatewayConfig;
      }
    }
    
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const handleProviderChange = (newProvider: GatewayProvider) => {
    // Сохраняем текущий конфиг провайдера перед переключением
    const currentProviderConfig = config.providerConfig;
    const updates: Partial<BaseAPIGatewayConfig> = {
      provider: newProvider,
    };

    // Сохраняем текущий конфиг в соответствующее поле
    if (provider === 'aws' && currentProviderConfig && 'provider' in currentProviderConfig && currentProviderConfig.provider === 'aws') {
      updates.awsConfig = currentProviderConfig as AWSGatewayConfig;
    } else if (provider === 'azure' && currentProviderConfig && 'provider' in currentProviderConfig && currentProviderConfig.provider === 'azure') {
      updates.azureConfig = currentProviderConfig as AzureGatewayConfig;
    } else if (provider === 'gcp' && currentProviderConfig && 'provider' in currentProviderConfig && currentProviderConfig.provider === 'gcp') {
      updates.gcpConfig = currentProviderConfig as GCPGatewayConfig;
    }

    // Загружаем сохраненный конфиг нового провайдера или создаем новый
    let newProviderConfig: AWSGatewayConfig | AzureGatewayConfig | GCPGatewayConfig;
    if (newProvider === 'aws' && config.awsConfig) {
      newProviderConfig = config.awsConfig;
    } else if (newProvider === 'azure' && config.azureConfig) {
      newProviderConfig = config.azureConfig;
    } else if (newProvider === 'gcp' && config.gcpConfig) {
      newProviderConfig = config.gcpConfig;
    } else {
      newProviderConfig = getDefaultProviderConfig(newProvider);
    }

    updates.providerConfig = newProviderConfig;
    updateConfig(updates);
    showSuccess(`Provider changed to ${newProvider.toUpperCase()}`);
  };

  const addAPI = () => {
    // Валидация обязательных полей
    if (!newAPIName.trim()) {
      showError('Имя API обязательно');
      return;
    }
    if (!newAPIPath.trim()) {
      showError('Путь API обязателен');
      return;
    }
    if (!newAPIPath.startsWith('/')) {
      showError('Путь должен начинаться с /');
      return;
    }
    if (!newAPIBackend.trim()) {
      showError('Backend URL обязателен');
      return;
    }

    // Проверка на дубликаты
    const pathExists = apis.some(api => api.path === newAPIPath.trim() && api.method === newAPIMethod);
    if (pathExists) {
      showError(`API с путем ${newAPIPath.trim()} и методом ${newAPIMethod} уже существует`);
      return;
    }

    const newAPI: API = {
      id: `api-${Date.now()}`,
      name: newAPIName.trim(),
      path: newAPIPath.trim(),
      backendUrl: newAPIBackend.trim(),
      method: newAPIMethod,
      enabled: true,
      authRequired: newAPIAuthRequired,
      authScopes: newAPIAuthScopes.trim() ? newAPIAuthScopes.split(',').map(s => s.trim()).filter(s => s.length > 0) : undefined,
      caching: newAPICachingEnabled ? {
        enabled: true,
        ttl: newAPICacheTTL || config.cacheTTL || 300,
        cacheKey: newAPICacheKeys.length > 0 ? newAPICacheKeys : ['method', 'path']
      } : undefined,
    };
    updateConfig({ apis: [...apis, newAPI] });
    setShowCreateAPI(false);
    setNewAPIName('');
    setNewAPIPath('');
    setNewAPIBackend('');
    setNewAPIMethod('GET');
    setNewAPIAuthRequired(undefined);
    setNewAPIAuthScopes('');
    setNewAPICachingEnabled(false);
    setNewAPICacheTTL(undefined);
    setNewAPICacheKeys(['method', 'path']);
    showSuccess(`API "${newAPIName.trim()}" успешно создан`);
  };

  const removeAPI = (id: string) => {
    const api = apis.find(a => a.id === id);
    if (api) {
      setDeleteConfirm({ type: 'api', id, name: api.name });
    }
  };

  const confirmDeleteAPI = () => {
    if (!deleteConfirm || deleteConfirm.type !== 'api') return;
    
    // Check if any keys reference this API
    const keysUsingAPI = keys.filter(k => k.apiIds.includes(deleteConfirm.id));
    if (keysUsingAPI.length > 0) {
      showWarning(`Cannot delete API: ${keysUsingAPI.length} API key(s) are using it. Remove keys first.`);
      setDeleteConfirm(null);
      return;
    }

    updateConfig({ apis: apis.filter((a) => a.id !== deleteConfirm.id) });
    showSuccess(`API "${deleteConfirm.name}" deleted`);
    setDeleteConfirm(null);
  };

  const toggleAPI = (id: string) => {
    const newAPIs = apis.map((a) =>
      a.id === id ? { ...a, enabled: !a.enabled } : a
    );
    updateConfig({ apis: newAPIs });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">API Gateway</p>
            <h2 className="text-2xl font-bold text-foreground">Cloud API Gateway</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Unified API management and routing
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Provider Selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Cloud Provider</CardTitle>
            <CardDescription className="text-xs">Select your API Gateway provider</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Select value={provider} onValueChange={(value) => handleProviderChange(value as GatewayProvider)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aws">
                      <div className="flex items-center gap-2">
                        <Cloud className="h-4 w-4 text-orange-500" />
                        <span>AWS API Gateway</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="azure">
                      <div className="flex items-center gap-2">
                        <Cloud className="h-4 w-4 text-blue-500" />
                        <span>Azure API Management</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="gcp">
                      <div className="flex items-center gap-2">
                        <Cloud className="h-4 w-4 text-green-500" />
                        <span>GCP Cloud Endpoints</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground">
                <Badge variant="outline" className="font-mono text-xs">
                  {region}
                </Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {provider === 'aws' && 'Regional REST API with stages, deployments, and usage plans'}
              {provider === 'azure' && 'API Management service with products, subscriptions, and policies'}
              {provider === 'gcp' && 'Cloud Endpoints with OpenAPI specs, service accounts, and quotas'}
            </p>
          </CardContent>
        </Card>

        <Separator />

        <div className="grid grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">APIs</CardTitle>
                <Globe className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalAPIs}</span>
                <span className="text-xs text-muted-foreground">registered</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">API Keys</CardTitle>
                <Shield className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalKeys}</span>
                <span className="text-xs text-muted-foreground">active</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Requests</CardTitle>
                <Activity className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{totalRequests.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">
                  {successRate !== null ? `${successRate.toFixed(1)}%` : 'N/A'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="apis" className="space-y-4">
          <div className="w-full">
            <TabsList className="flex-wrap h-auto min-h-[36px] w-full justify-start gap-1">
            <TabsTrigger value="apis">
              <Globe className="h-4 w-4 mr-2" />
              APIs ({apis.length})
            </TabsTrigger>
            <TabsTrigger value="keys">
              <Shield className="h-4 w-4 mr-2" />
              API Keys ({keys.length})
            </TabsTrigger>
            {/* AWS-специфичные табы */}
            {provider === 'aws' && (
              <>
                <TabsTrigger value="stages">
                  <Layers className="h-4 w-4 mr-2" />
                  Stages
                </TabsTrigger>
                <TabsTrigger value="usage-plans">
                  <FileText className="h-4 w-4 mr-2" />
                  Usage Plans
                </TabsTrigger>
                <TabsTrigger value="authorizers">
                  <Shield className="h-4 w-4 mr-2" />
                  Authorizers
                </TabsTrigger>
              </>
            )}
            {/* Azure-специфичные табы */}
            {provider === 'azure' && (
              <>
                <TabsTrigger value="products">
                  <Package className="h-4 w-4 mr-2" />
                  Products
                </TabsTrigger>
                <TabsTrigger value="subscriptions">
                  <Key className="h-4 w-4 mr-2" />
                  Subscriptions
                </TabsTrigger>
                <TabsTrigger value="policies">
                  <FileText className="h-4 w-4 mr-2" />
                  Policies
                </TabsTrigger>
                <TabsTrigger value="backends">
                  <Server className="h-4 w-4 mr-2" />
                  Backends
                </TabsTrigger>
              </>
            )}
            {/* GCP-специфичные табы */}
            {provider === 'gcp' && (
              <>
                <TabsTrigger value="openapi">
                  <FileCode className="h-4 w-4 mr-2" />
                  OpenAPI
                </TabsTrigger>
                <TabsTrigger value="service-accounts">
                  <Users className="h-4 w-4 mr-2" />
                  Service Accounts
                </TabsTrigger>
                <TabsTrigger value="quotas">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Quotas
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>
          </div>

          <TabsContent value="apis" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>API Routes</CardTitle>
                    <CardDescription>Registered API endpoints</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateAPI(true)} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create API
                  </Button>
                </div>
              </CardHeader>
              {showCreateAPI && (
                <CardContent className="border-b pb-4 mb-4 bg-card">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>API Name *</Label>
                        <Input
                          value={newAPIName}
                          onChange={(e) => setNewAPIName(e.target.value)}
                          placeholder="User Service API"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Method *</Label>
                        <Select value={newAPIMethod} onValueChange={(value) => setNewAPIMethod(value as typeof newAPIMethod)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="PUT">PUT</SelectItem>
                            <SelectItem value="DELETE">DELETE</SelectItem>
                            <SelectItem value="ALL">ALL</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Path *</Label>
                      <Input
                        value={newAPIPath}
                        onChange={(e) => setNewAPIPath(e.target.value)}
                        placeholder="/api/users"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Backend URL *</Label>
                      <Input
                        value={newAPIBackend}
                        onChange={(e) => setNewAPIBackend(e.target.value)}
                        placeholder="http://backend:8080"
                      />
                    </div>
                    
                    <Separator />
                    
                    {/* Authentication Settings */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Authentication</Label>
                          <p className="text-xs text-muted-foreground">
                            Override global authentication (leave unchecked to use global setting)
                          </p>
                        </div>
                        <Switch
                          checked={newAPIAuthRequired ?? false}
                          onCheckedChange={(checked) => setNewAPIAuthRequired(checked)}
                        />
                      </div>
                      {newAPIAuthRequired && (
                        <div className="space-y-2 pl-6">
                          <Label className="text-xs">Auth Scopes (comma-separated, optional)</Label>
                          <Input
                            value={newAPIAuthScopes}
                            onChange={(e) => setNewAPIAuthScopes(e.target.value)}
                            placeholder="read, write, admin"
                            className="text-xs"
                          />
                        </div>
                      )}
                    </div>

                    {/* Caching Settings */}
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Caching</Label>
                          <p className="text-xs text-muted-foreground">
                            Enable response caching for this API
                          </p>
                        </div>
                        <Switch
                          checked={newAPICachingEnabled}
                          onCheckedChange={(checked) => {
                            setNewAPICachingEnabled(checked);
                            if (checked && !newAPICacheTTL) {
                              setNewAPICacheTTL(config.cacheTTL || 300);
                            }
                          }}
                        />
                      </div>
                      {newAPICachingEnabled && (
                        <div className="space-y-3 pl-6">
                          <div className="space-y-2">
                            <Label className="text-xs">Cache TTL (seconds)</Label>
                            <Input
                              type="number"
                              value={newAPICacheTTL || config.cacheTTL || 300}
                              onChange={(e) => setNewAPICacheTTL(e.target.value ? parseInt(e.target.value) : undefined)}
                              placeholder="300"
                              min={1}
                              className="text-xs"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Cache Key Parameters</Label>
                            <div className="space-y-2">
                              {['method', 'path', 'query', 'headers'].map((param) => (
                                <div key={param} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`new-cache-${param}`}
                                    checked={newAPICacheKeys.includes(param)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setNewAPICacheKeys([...newAPICacheKeys, param]);
                                      } else {
                                        const filtered = newAPICacheKeys.filter(k => k !== param);
                                        // Ensure at least method and path
                                        setNewAPICacheKeys(filtered.length > 0 ? filtered : ['method', 'path']);
                                      }
                                    }}
                                  />
                                  <label htmlFor={`new-cache-${param}`} className="text-xs cursor-pointer capitalize">
                                    {param}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        onClick={addAPI}
                        disabled={!newAPIName.trim() || !newAPIPath.trim() || !newAPIBackend.trim()}
                      >
                        Create API
                      </Button>
                      <Button variant="outline" onClick={() => {
                        setShowCreateAPI(false);
                        setNewAPIName('');
                        setNewAPIPath('');
                        setNewAPIBackend('');
                        setNewAPIMethod('GET');
                        setNewAPIAuthRequired(undefined);
                        setNewAPIAuthScopes('');
                        setNewAPICachingEnabled(false);
                        setNewAPICacheTTL(undefined);
                        setNewAPICacheKeys(['method', 'path']);
                      }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent>
                <div className="space-y-4">
                  {apis.map((api) => (
                    <Card key={api.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                              <Route className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1 space-y-3">
                              <div className="space-y-2">
                                <Label className="text-xs">API Name</Label>
                                <Input
                                  value={api.name || ''}
                                  onChange={(e) => {
                                    const updatedApis = apis.map(a =>
                                      a.id === api.id ? { ...a, name: e.target.value } : a
                                    );
                                    updateConfig({ apis: updatedApis });
                                  }}
                                  placeholder="API Name"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-2">
                                  <Label className="text-xs">Method</Label>
                                  <Select
                                    value={api.method}
                                    onValueChange={(value) => {
                                      const updatedApis = apis.map(a =>
                                        a.id === api.id ? { ...a, method: value as API['method'] } : a
                                      );
                                      updateConfig({ apis: updatedApis });
                                    }}
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="GET">GET</SelectItem>
                                      <SelectItem value="POST">POST</SelectItem>
                                      <SelectItem value="PUT">PUT</SelectItem>
                                      <SelectItem value="DELETE">DELETE</SelectItem>
                                      <SelectItem value="PATCH">PATCH</SelectItem>
                                      <SelectItem value="ALL">ALL</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Path</Label>
                                  <Input
                                    value={api.path || ''}
                                    onChange={(e) => {
                                      const updatedApis = apis.map(a =>
                                        a.id === api.id ? { ...a, path: e.target.value } : a
                                      );
                                      updateConfig({ apis: updatedApis });
                                    }}
                                    placeholder="/api/users"
                                    className="h-8 font-mono text-xs"
                                  />
                                </div>
                              </div>
                              {api.requests !== undefined && api.requests > 0 && (
                                <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 text-xs">
                                  {api.requests} requests
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col items-end gap-1">
                              <Switch
                                checked={api.enabled}
                                onCheckedChange={() => {
                                  toggleAPI(api.id);
                                  showSuccess(`API "${api.name}" ${api.enabled ? 'disabled' : 'enabled'}`);
                                }}
                              />
                              <Badge 
                                variant={api.enabled ? 'default' : 'outline'} 
                                className="text-[10px]"
                              >
                                {api.enabled ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeAPI(api.id)}
                              className="hover:bg-destructive/10 hover:text-destructive"
                              title="Delete API"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Backend URL</Label>
                          <Input
                            value={api.backendUrl || (api as any).backend || ''}
                            onChange={(e) => {
                              const updatedApis = apis.map(a =>
                                a.id === api.id ? { ...a, backendUrl: e.target.value } : a
                              );
                              updateConfig({ apis: updatedApis });
                            }}
                            placeholder="http://backend:8080"
                            className="font-mono text-xs"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">Rate Limit (req/min, optional)</Label>
                            <Input
                              type="number"
                              value={api.rateLimit || ''}
                              onChange={(e) => {
                                const updatedApis = apis.map(a =>
                                  a.id === api.id ? { ...a, rateLimit: e.target.value ? parseInt(e.target.value) : undefined } : a
                                );
                                updateConfig({ apis: updatedApis });
                              }}
                              placeholder="1000"
                              min={1}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Timeout (seconds, optional)</Label>
                            <Input
                              type="number"
                              value={api.timeout || ''}
                              onChange={(e) => {
                                const updatedApis = apis.map(a =>
                                  a.id === api.id ? { ...a, timeout: e.target.value ? parseInt(e.target.value) : undefined } : a
                                );
                                updateConfig({ apis: updatedApis });
                              }}
                              placeholder="30"
                              min={1}
                            />
                          </div>
                        </div>
                        
                        {/* Authentication Settings */}
                        <Separator />
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="text-xs">Authentication</Label>
                              <p className="text-xs text-muted-foreground">
                                Override global authentication settings for this API
                              </p>
                            </div>
                            <Switch
                              checked={api.authRequired !== undefined ? api.authRequired : config.enableAuthentication ?? false}
                              onCheckedChange={(checked) => {
                                const updatedApis = apis.map(a =>
                                  a.id === api.id ? { ...a, authRequired: checked } : a
                                );
                                updateConfig({ apis: updatedApis });
                              }}
                            />
                          </div>
                          {api.authRequired && (
                            <div className="space-y-2 pl-6">
                              <Label className="text-xs">Auth Scopes (comma-separated, optional)</Label>
                              <Input
                                value={api.authScopes?.join(', ') || ''}
                                onChange={(e) => {
                                  const scopes = e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
                                  const updatedApis = apis.map(a =>
                                    a.id === api.id ? { ...a, authScopes: scopes.length > 0 ? scopes : undefined } : a
                                  );
                                  updateConfig({ apis: updatedApis });
                                }}
                                placeholder="read, write, admin"
                                className="text-xs"
                              />
                              <p className="text-xs text-muted-foreground">
                                OAuth2/JWT scopes or IAM permissions required for this API
                              </p>
                            </div>
                          )}
                          {api.authRequired === false && (
                            <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300">
                              <Globe className="h-3 w-3 mr-1" />
                              Public API (no authentication required)
                            </Badge>
                          )}
                        </div>

                        {/* Caching Settings */}
                        <Separator />
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="text-xs">Caching</Label>
                              <p className="text-xs text-muted-foreground">
                                Enable response caching for this API
                              </p>
                            </div>
                            <Switch
                              checked={api.caching?.enabled ?? false}
                              onCheckedChange={(checked) => {
                                const updatedApis = apis.map(a =>
                                  a.id === api.id ? { 
                                    ...a, 
                                    caching: {
                                      ...a.caching,
                                      enabled: checked,
                                      ttl: a.caching?.ttl || config.cacheTTL || 300,
                                      cacheKey: a.caching?.cacheKey || ['method', 'path']
                                    }
                                  } : a
                                );
                                updateConfig({ apis: updatedApis });
                              }}
                            />
                          </div>
                          {api.caching?.enabled && (
                            <div className="space-y-3 pl-6">
                              <div className="space-y-2">
                                <Label className="text-xs">Cache TTL (seconds)</Label>
                                <Input
                                  type="number"
                                  value={api.caching?.ttl || config.cacheTTL || 300}
                                  onChange={(e) => {
                                    const ttl = e.target.value ? parseInt(e.target.value) : undefined;
                                    const updatedApis = apis.map(a =>
                                      a.id === api.id ? { 
                                        ...a, 
                                        caching: {
                                          ...a.caching,
                                          enabled: true,
                                          ttl: ttl || config.cacheTTL || 300,
                                          cacheKey: a.caching?.cacheKey || ['method', 'path']
                                        }
                                      } : a
                                    );
                                    updateConfig({ apis: updatedApis });
                                  }}
                                  placeholder="300"
                                  min={1}
                                  className="text-xs"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Cache Key Parameters</Label>
                                <p className="text-xs text-muted-foreground mb-2">
                                  Select which request parameters to include in cache key
                                </p>
                                <div className="space-y-2">
                                  {['method', 'path', 'query', 'headers'].map((param) => (
                                    <div key={param} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`cache-${api.id}-${param}`}
                                        checked={api.caching?.cacheKey?.includes(param) ?? (param === 'method' || param === 'path')}
                                        onCheckedChange={(checked) => {
                                          const currentKeys = api.caching?.cacheKey || ['method', 'path'];
                                          const newKeys = checked
                                            ? [...currentKeys.filter(k => k !== param), param]
                                            : currentKeys.filter(k => k !== param);
                                          // Ensure at least method and path are always included
                                          const finalKeys = newKeys.length > 0 ? newKeys : ['method', 'path'];
                                          const updatedApis = apis.map(a =>
                                            a.id === api.id ? { 
                                              ...a, 
                                              caching: {
                                                ...a.caching,
                                                enabled: true,
                                                ttl: a.caching?.ttl || config.cacheTTL || 300,
                                                cacheKey: finalKeys
                                              }
                                            } : a
                                          );
                                          updateConfig({ apis: updatedApis });
                                        }}
                                      />
                                      <label
                                        htmlFor={`cache-${api.id}-${param}`}
                                        className="text-xs cursor-pointer capitalize"
                                      >
                                        {param}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Metrics */}
                        {(api.requests !== undefined || api.errors !== undefined || api.latency) && (
                          <div className="pt-2 border-t space-y-2">
                            {api.requests !== undefined && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Requests:</span>
                                <span className="ml-2 font-semibold text-blue-600 dark:text-blue-400">{api.requests.toLocaleString()}</span>
                              </div>
                            )}
                            {api.errors !== undefined && api.errors > 0 && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Errors:</span>
                                <span className="ml-2 font-semibold text-red-500">{api.errors}</span>
                              </div>
                            )}
                            {api.latency && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Latency:</span>
                                <span className="ml-2">
                                  avg: {api.latency.avg?.toFixed(0)}ms
                                  {api.latency.p95 && `, p95: ${api.latency.p95.toFixed(0)}ms`}
                                  {api.latency.p99 && `, p99: ${api.latency.p99.toFixed(0)}ms`}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="keys" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>API Keys</CardTitle>
                    <CardDescription>API authentication keys</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateKey(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Key
                  </Button>
                </div>
              </CardHeader>
              {showCreateKey && (
                <CardContent className="border-b pb-4 mb-4 bg-card">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Key Name *</Label>
                      <Input
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="Mobile App Key"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Select APIs *</Label>
                      <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                        {apis.map((api) => (
                          <div key={api.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`api-${api.id}`}
                              checked={newKeyApiIds.includes(api.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewKeyApiIds([...newKeyApiIds, api.id]);
                                } else {
                                  setNewKeyApiIds(newKeyApiIds.filter(id => id !== api.id));
                                }
                              }}
                              className="rounded border-gray-300"
                            />
                            <label htmlFor={`api-${api.id}`} className="text-sm cursor-pointer">
                              {api.name} ({api.method} {api.path})
                            </label>
                          </div>
                        ))}
                        {apis.length === 0 && (
                          <p className="text-sm text-muted-foreground">No APIs available. Create an API first.</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Rate Limit (requests/min, optional)</Label>
                      <Input
                        type="number"
                        value={newKeyRateLimit || ''}
                        onChange={(e) => setNewKeyRateLimit(e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="100"
                        min={1}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          if (!newKeyName.trim()) {
                            showError('Key name is required');
                            return;
                          }
                          if (newKeyApiIds.length === 0) {
                            showError('Select at least one API');
                            return;
                          }

                          // Generate API key
                          const keyValue = `ak_${provider}_${Math.random().toString(36).substr(2, 16)}`;
                          const maskedKey = `${keyValue.substring(0, 8)}***${keyValue.substring(keyValue.length - 4)}`;

                          const newKey: APIKey = {
                            id: `key-${Date.now()}`,
                            name: newKeyName.trim(),
                            key: maskedKey,
                            enabled: true,
                            apiIds: newKeyApiIds,
                            rateLimit: newKeyRateLimit,
                            usage: {
                              requests: 0,
                              lastUsed: new Date().toISOString(),
                            },
                          };

                          updateConfig({ keys: [...keys, newKey] });
                          setShowCreateKey(false);
                          setNewKeyName('');
                          setNewKeyApiIds([]);
                          setNewKeyRateLimit(undefined);
                          showSuccess(`API Key "${newKeyName.trim()}" created`);
                        }}
                        disabled={!newKeyName.trim() || newKeyApiIds.length === 0}
                      >
                        Create Key
                      </Button>
                      <Button variant="outline" onClick={() => {
                        setShowCreateKey(false);
                        setNewKeyName('');
                        setNewKeyApiIds([]);
                        setNewKeyRateLimit(undefined);
                      }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent>
                <div className="space-y-4">
                  {keys.length === 0 && !showCreateKey && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No API keys configured. Create a key to grant API access.
                    </div>
                  )}
                  {keys.map((key) => (
                    <Card key={key.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                            <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <CardTitle className="text-lg font-semibold">{key.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant="outline" className="font-mono text-xs">{key.key}</Badge>
                              <Badge variant={key.enabled ? 'default' : 'outline'}>
                                {key.enabled ? 'Enabled' : 'Disabled'}
                              </Badge>
                              {key.rateLimit && (
                                <Badge variant="outline">{key.rateLimit}/min</Badge>
                              )}
                              {key.usage?.requests !== undefined && key.usage.requests > 0 && (
                                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
                                  {key.usage.requests} requests
                                </Badge>
                              )}
                              {key.usage?.lastUsed && (
                                <Badge variant="outline" className="text-xs">
                                  Last used: {new Date(key.usage.lastUsed).toLocaleDateString()}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={key.enabled}
                            onCheckedChange={(checked) => {
                              const newKeys = keys.map(k =>
                                k.id === key.id ? { ...k, enabled: checked } : k
                              );
                              updateConfig({ keys: newKeys });
                              showSuccess(`API Key "${key.name}" ${checked ? 'enabled' : 'disabled'}`);
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirm({ type: 'key', id: key.id, name: key.name })}
                            className="hover:bg-destructive/10 hover:text-destructive"
                            title="Delete API Key"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {key.apiIds.length > 0 ? (
                          <div className="space-y-1">
                            <Label className="text-xs">Authorized APIs</Label>
                            <div className="flex flex-wrap gap-2">
                              {key.apiIds.map((apiId) => {
                                const api = apis.find((a) => a.id === apiId);
                                return (
                                  <Badge key={apiId} variant="outline" className="text-xs">
                                    {api?.name || apiId}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No APIs assigned</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gateway Configuration</CardTitle>
                <CardDescription>Basic gateway settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Region</Label>
                  <Input 
                    type="text" 
                    value={region}
                    onChange={(e) => updateConfig({ region: e.target.value || 'us-east-1' })}
                    placeholder="us-east-1"
                  />
                  <p className="text-xs text-muted-foreground">Cloud provider region</p>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Authentication Type</Label>
                  <Select value={config.authType || 'api-key'} onValueChange={(value) => updateConfig({ authType: value as any })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="api-key">API Key</SelectItem>
                      <SelectItem value="oauth2">OAuth2</SelectItem>
                      <SelectItem value="jwt">JWT</SelectItem>
                      <SelectItem value="iam">IAM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Authentication</Label>
                    <p className="text-xs text-muted-foreground mt-1">Require authentication for API access</p>
                  </div>
                  <Switch 
                    checked={config.enableAuthentication ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableAuthentication: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rate Limiting & Throttling</CardTitle>
                <CardDescription>Traffic control settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Rate Limiting</Label>
                    <p className="text-xs text-muted-foreground mt-1">Limit requests per time period</p>
                  </div>
                  <Switch 
                    checked={config.enableRateLimiting ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableRateLimiting: checked })}
                  />
                </div>
                {config.enableRateLimiting && (
                  <div className="space-y-2">
                    <Label>Default Rate Limit (requests/min)</Label>
                    <Input 
                      type="number" 
                      value={config.defaultRateLimit ?? 1000}
                      onChange={(e) => updateConfig({ defaultRateLimit: parseInt(e.target.value) || 1000 })}
                      min={1} 
                    />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Throttling</Label>
                    <p className="text-xs text-muted-foreground mt-1">Burst capacity control</p>
                  </div>
                  <Switch 
                    checked={config.enableThrottling ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableThrottling: checked })}
                  />
                </div>
                {config.enableThrottling && (
                  <div className="space-y-2">
                    <Label>Throttling Burst</Label>
                    <Input 
                      type="number" 
                      value={config.throttlingBurst ?? 200}
                      onChange={(e) => updateConfig({ throttlingBurst: parseInt(e.target.value) || 200 })}
                      min={1} 
                    />
                    <p className="text-xs text-muted-foreground">Maximum burst capacity</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Caching</CardTitle>
                <CardDescription>Response caching settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Caching</Label>
                    <p className="text-xs text-muted-foreground mt-1">Cache API responses</p>
                  </div>
                  <Switch 
                    checked={config.enableCaching ?? false}
                    onCheckedChange={(checked) => updateConfig({ enableCaching: checked })}
                  />
                </div>
                {config.enableCaching && (
                  <div className="space-y-2">
                    <Label>Cache TTL (seconds)</Label>
                    <Input 
                      type="number" 
                      value={config.cacheTTL ?? 300}
                      onChange={(e) => updateConfig({ cacheTTL: parseInt(e.target.value) || 300 })}
                      min={1} 
                      max={3600}
                    />
                    <p className="text-xs text-muted-foreground">Time-to-live for cached responses</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Observability</CardTitle>
                <CardDescription>Logging and metrics settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Request Logging</Label>
                    <p className="text-xs text-muted-foreground mt-1">Log all API requests</p>
                  </div>
                  <Switch 
                    checked={config.enableRequestLogging ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableRequestLogging: checked })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Request Timeout (seconds)</Label>
                  <Input 
                    type="number" 
                    value={config.requestTimeout ?? 30}
                    onChange={(e) => updateConfig({ requestTimeout: parseInt(e.target.value) || 30 })}
                    min={1} 
                  />
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Metrics Export</Label>
                      <p className="text-xs text-muted-foreground mt-1">Export metrics for Prometheus scraping</p>
                    </div>
                    <Switch 
                      checked={config.metrics?.enabled ?? true}
                      onCheckedChange={(checked) => updateConfig({ 
                        metrics: { 
                          ...config.metrics, 
                          enabled: checked,
                          port: config.metrics?.port || 9100,
                          path: config.metrics?.path || '/metrics'
                        } 
                      })}
                    />
                  </div>
                  {config.metrics?.enabled !== false && (
                    <>
                      <div className="space-y-2">
                        <Label>Metrics Port</Label>
                        <Input 
                          type="number" 
                          value={config.metrics?.port ?? 9100}
                          onChange={(e) => updateConfig({ 
                            metrics: { 
                              ...config.metrics, 
                              port: parseInt(e.target.value) || 9100,
                              path: config.metrics?.path || '/metrics'
                            } 
                          })}
                          min={1024} 
                          max={65535} 
                        />
                        <p className="text-xs text-muted-foreground">Port for Prometheus metrics endpoint</p>
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
                              port: config.metrics?.port || 9100
                            } 
                          })}
                          placeholder="/metrics"
                        />
                        <p className="text-xs text-muted-foreground">Path for metrics endpoint (e.g., /metrics)</p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AWS-специфичные табы */}
          {provider === 'aws' && config.providerConfig && 'provider' in config.providerConfig && config.providerConfig.provider === 'aws' && (
            <>
              <TabsContent value="stages" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Stages & Deployments</CardTitle>
                        <CardDescription>AWS API Gateway stages and deployments</CardDescription>
                      </div>
                      <Button onClick={() => {
                        const awsConfig = config.providerConfig as any;
                        const newStage: any = {
                          id: `stage-${Date.now()}`,
                          name: 'new-stage',
                          cacheClusterEnabled: false,
                        };
                        updateConfig({
                          providerConfig: {
                            ...awsConfig,
                            stages: [...(awsConfig.stages || []), newStage],
                          },
                        });
                        showSuccess('Stage created');
                      }} size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Stage
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {((config.providerConfig as any).stages || []).map((stage: any) => (
                        <Card key={stage.id} className="border-l-4 border-l-orange-500">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="space-y-2">
                                  <Label className="text-xs">Stage Name</Label>
                                  <Input
                                    value={stage.name || ''}
                                    onChange={(e) => {
                                      const awsConfig = config.providerConfig as any;
                                      updateConfig({
                                        providerConfig: {
                                          ...awsConfig,
                                          stages: awsConfig.stages?.map((s: any) =>
                                            s.id === stage.id ? { ...s, name: e.target.value } : s
                                          ) || [],
                                        },
                                      });
                                    }}
                                    placeholder="dev"
                                  />
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="outline">{stage.cacheClusterEnabled ? 'Cached' : 'No Cache'}</Badge>
                                  {stage.cacheClusterSize && (
                                    <Badge variant="outline">{stage.cacheClusterSize}GB</Badge>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirm({ type: 'stage', id: stage.id, name: stage.name })}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs">Cache Cluster</Label>
                                <Switch
                                  checked={stage.cacheClusterEnabled || false}
                                  onCheckedChange={(checked) => {
                                    const awsConfig = config.providerConfig as any;
                                    updateConfig({
                                      providerConfig: {
                                        ...awsConfig,
                                        stages: awsConfig.stages?.map((s: any) =>
                                          s.id === stage.id ? { ...s, cacheClusterEnabled: checked } : s
                                        ) || [],
                                      },
                                    });
                                  }}
                                />
                              </div>
                              {stage.cacheClusterEnabled && (
                                <div className="space-y-2">
                                  <Label className="text-xs">Cache Size</Label>
                                  <Select
                                    value={stage.cacheClusterSize || '0.5'}
                                    onValueChange={(value) => {
                                      const awsConfig = config.providerConfig as any;
                                      updateConfig({
                                        providerConfig: {
                                          ...awsConfig,
                                          stages: awsConfig.stages?.map((s: any) =>
                                            s.id === stage.id ? { ...s, cacheClusterSize: value } : s
                                          ) || [],
                                        },
                                      });
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="0.5">0.5 GB</SelectItem>
                                      <SelectItem value="1.6">1.6 GB</SelectItem>
                                      <SelectItem value="6.1">6.1 GB</SelectItem>
                                      <SelectItem value="13.5">13.5 GB</SelectItem>
                                      <SelectItem value="28.4">28.4 GB</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs">Throttle Rate Limit</Label>
                                <Input
                                  type="number"
                                  value={stage.throttlingRateLimit || ''}
                                  onChange={(e) => {
                                    const awsConfig = config.providerConfig as any;
                                    updateConfig({
                                      providerConfig: {
                                        ...awsConfig,
                                        stages: awsConfig.stages?.map((s: any) =>
                                          s.id === stage.id ? { ...s, throttlingRateLimit: parseInt(e.target.value) || 0 } : s
                                        ) || [],
                                      },
                                    });
                                  }}
                                  placeholder="1000"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Throttle Burst Limit</Label>
                                <Input
                                  type="number"
                                  value={stage.throttlingBurstLimit || ''}
                                  onChange={(e) => {
                                    const awsConfig = config.providerConfig as any;
                                    updateConfig({
                                      providerConfig: {
                                        ...awsConfig,
                                        stages: awsConfig.stages?.map((s: any) =>
                                          s.id === stage.id ? { ...s, throttlingBurstLimit: parseInt(e.target.value) || 0 } : s
                                        ) || [],
                                      },
                                    });
                                  }}
                                  placeholder="2000"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {((config.providerConfig as any).stages || []).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No stages configured. Create a stage to deploy your API.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="usage-plans" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Usage Plans</CardTitle>
                        <CardDescription>Manage API usage plans and quotas</CardDescription>
                      </div>
                      <Button onClick={() => {
                        const awsConfig = config.providerConfig as any;
                        const newPlan: any = {
                          id: `plan-${Date.now()}`,
                          name: 'New Usage Plan',
                          throttle: { burstLimit: 200, rateLimit: 100 },
                        };
                        updateConfig({
                          providerConfig: {
                            ...awsConfig,
                            usagePlans: [...(awsConfig.usagePlans || []), newPlan],
                          },
                        });
                        showSuccess('Usage plan created');
                      }} size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Plan
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {((config.providerConfig as any).usagePlans || []).map((plan: any) => (
                        <Card key={plan.id} className="border-l-4 border-l-orange-500">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="space-y-2">
                                  <Label className="text-xs">Plan Name</Label>
                                  <Input
                                    value={plan.name || ''}
                                    onChange={(e) => {
                                      const awsConfig = config.providerConfig as any;
                                      updateConfig({
                                        providerConfig: {
                                          ...awsConfig,
                                          usagePlans: awsConfig.usagePlans?.map((p: any) =>
                                            p.id === plan.id ? { ...p, name: e.target.value } : p
                                          ) || [],
                                        },
                                      });
                                    }}
                                    placeholder="Basic Plan"
                                  />
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirm({ type: 'usage-plan', id: plan.id, name: plan.name })}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {plan.quota && (
                              <div className="space-y-2">
                                <Label className="text-xs">Quota</Label>
                                <div className="grid grid-cols-2 gap-4">
                                  <Input
                                    type="number"
                                    value={plan.quota.limit || ''}
                                    onChange={(e) => {
                                      const awsConfig = config.providerConfig as any;
                                      updateConfig({
                                        providerConfig: {
                                          ...awsConfig,
                                          usagePlans: awsConfig.usagePlans?.map((p: any) =>
                                            p.id === plan.id ? { ...p, quota: { ...p.quota, limit: parseInt(e.target.value) || 0 } } : p
                                          ) || [],
                                        },
                                      });
                                    }}
                                    placeholder="10000"
                                  />
                                  <Select
                                    value={plan.quota.period || 'DAY'}
                                    onValueChange={(value) => {
                                      const awsConfig = config.providerConfig as any;
                                      updateConfig({
                                        providerConfig: {
                                          ...awsConfig,
                                          usagePlans: awsConfig.usagePlans?.map((p: any) =>
                                            p.id === plan.id ? { ...p, quota: { ...p.quota, period: value } } : p
                                          ) || [],
                                        },
                                      });
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="DAY">Per Day</SelectItem>
                                      <SelectItem value="WEEK">Per Week</SelectItem>
                                      <SelectItem value="MONTH">Per Month</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}
                            {plan.throttle && (
                              <div className="space-y-2">
                                <Label className="text-xs">Throttle</Label>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Rate Limit</Label>
                                    <Input
                                      type="number"
                                      value={plan.throttle.rateLimit || ''}
                                      onChange={(e) => {
                                        const awsConfig = config.providerConfig as any;
                                        updateConfig({
                                          providerConfig: {
                                            ...awsConfig,
                                            usagePlans: awsConfig.usagePlans?.map((p: any) =>
                                              p.id === plan.id ? { ...p, throttle: { ...p.throttle, rateLimit: parseInt(e.target.value) || 0 } } : p
                                            ) || [],
                                          },
                                        });
                                      }}
                                      placeholder="100"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Burst Limit</Label>
                                    <Input
                                      type="number"
                                      value={plan.throttle.burstLimit || ''}
                                      onChange={(e) => {
                                        const awsConfig = config.providerConfig as any;
                                        updateConfig({
                                          providerConfig: {
                                            ...awsConfig,
                                            usagePlans: awsConfig.usagePlans?.map((p: any) =>
                                              p.id === plan.id ? { ...p, throttle: { ...p.throttle, burstLimit: parseInt(e.target.value) || 0 } } : p
                                            ) || [],
                                          },
                                        });
                                      }}
                                      placeholder="200"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                      {((config.providerConfig as any).usagePlans || []).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No usage plans configured. Create a plan to manage API access.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="authorizers" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Lambda Authorizers</CardTitle>
                        <CardDescription>Configure Lambda authorizers for API authentication</CardDescription>
                      </div>
                      <Button onClick={() => {
                        const awsConfig = config.providerConfig as any;
                        const newAuthorizer: any = {
                          id: `auth-${Date.now()}`,
                          name: 'New Authorizer',
                          type: 'TOKEN',
                        };
                        updateConfig({
                          providerConfig: {
                            ...awsConfig,
                            authorizers: [...(awsConfig.authorizers || []), newAuthorizer],
                          },
                        });
                        showSuccess('Authorizer created');
                      }} size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Authorizer
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {((config.providerConfig as any).authorizers || []).map((auth: any) => (
                        <Card key={auth.id} className="border-l-4 border-l-orange-500">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">{auth.name}</CardTitle>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirm({ type: 'authorizer', id: auth.id, name: auth.name })}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="space-y-2">
                              <Label className="text-xs">Type</Label>
                              <Select
                                value={auth.type || 'TOKEN'}
                                onValueChange={(value) => {
                                  const awsConfig = config.providerConfig as any;
                                  updateConfig({
                                    providerConfig: {
                                      ...awsConfig,
                                      authorizers: awsConfig.authorizers?.map((a: any) =>
                                        a.id === auth.id ? { ...a, type: value } : a
                                      ) || [],
                                    },
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="TOKEN">TOKEN</SelectItem>
                                  <SelectItem value="REQUEST">REQUEST</SelectItem>
                                  <SelectItem value="COGNITO_USER_POOLS">Cognito User Pools</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {auth.type !== 'COGNITO_USER_POOLS' && (
                              <div className="space-y-2">
                                <Label className="text-xs">Lambda ARN</Label>
                                <Input
                                  value={auth.authorizerUri || ''}
                                  onChange={(e) => {
                                    const awsConfig = config.providerConfig as any;
                                    updateConfig({
                                      providerConfig: {
                                        ...awsConfig,
                                        authorizers: awsConfig.authorizers?.map((a: any) =>
                                          a.id === auth.id ? { ...a, authorizerUri: e.target.value } : a
                                        ) || [],
                                      },
                                    });
                                  }}
                                  placeholder="arn:aws:lambda:region:account:function:name"
                                />
                              </div>
                            )}
                            {auth.type === 'COGNITO_USER_POOLS' && (
                              <div className="space-y-2">
                                <Label className="text-xs">User Pool ARNs</Label>
                                <Input
                                  value={(auth.providerARNs || []).join(',')}
                                  onChange={(e) => {
                                    const awsConfig = config.providerConfig as any;
                                    updateConfig({
                                      providerConfig: {
                                        ...awsConfig,
                                        authorizers: awsConfig.authorizers?.map((a: any) =>
                                          a.id === auth.id ? { ...a, providerARNs: e.target.value.split(',').filter(Boolean) } : a
                                        ) || [],
                                      },
                                    });
                                  }}
                                  placeholder="arn:aws:cognito-idp:region:account:userpool/id"
                                />
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                      {((config.providerConfig as any).authorizers || []).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No authorizers configured. Create an authorizer to add custom authentication.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}

          {/* Azure-специфичные табы */}
          {provider === 'azure' && config.providerConfig && 'provider' in config.providerConfig && config.providerConfig.provider === 'azure' && (
            <>
              <TabsContent value="products" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Products</CardTitle>
                        <CardDescription>API Management products</CardDescription>
                      </div>
                      <Button onClick={() => {
                        const azureConfig = config.providerConfig as any;
                        const newProduct: any = {
                          id: `product-${Date.now()}`,
                          name: 'new-product',
                          displayName: 'New Product',
                          state: 'notPublished',
                          subscriptionRequired: true,
                        };
                        updateConfig({
                          providerConfig: {
                            ...azureConfig,
                            products: [...(azureConfig.products || []), newProduct],
                          },
                        });
                        showSuccess('Product created');
                      }} size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Product
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {((config.providerConfig as any).products || []).map((product: any) => (
                        <Card key={product.id} className="border-l-4 border-l-blue-500">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-lg">{product.displayName || product.name}</CardTitle>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant={product.state === 'published' ? 'default' : 'outline'}>
                                    {product.state || 'notPublished'}
                                  </Badge>
                                  {product.subscriptionRequired && (
                                    <Badge variant="outline">Subscription Required</Badge>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirm({ type: 'product', id: product.id, name: product.displayName || product.name })}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="space-y-2">
                              <Label className="text-xs">Display Name</Label>
                              <Input
                                value={product.displayName || ''}
                                onChange={(e) => {
                                  const azureConfig = config.providerConfig as any;
                                  updateConfig({
                                    providerConfig: {
                                      ...azureConfig,
                                      products: azureConfig.products?.map((p: any) =>
                                        p.id === product.id ? { ...p, displayName: e.target.value } : p
                                      ) || [],
                                    },
                                  });
                                }}
                                placeholder="Product Display Name"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Description</Label>
                              <Textarea
                                value={product.description || ''}
                                onChange={(e) => {
                                  const azureConfig = config.providerConfig as any;
                                  updateConfig({
                                    providerConfig: {
                                      ...azureConfig,
                                      products: azureConfig.products?.map((p: any) =>
                                        p.id === product.id ? { ...p, description: e.target.value } : p
                                      ) || [],
                                    },
                                  });
                                }}
                                placeholder="Product description"
                                className="min-h-[80px]"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs">State</Label>
                                <Select
                                  value={product.state || 'notPublished'}
                                  onValueChange={(value) => {
                                    const azureConfig = config.providerConfig as any;
                                    updateConfig({
                                      providerConfig: {
                                        ...azureConfig,
                                        products: azureConfig.products?.map((p: any) =>
                                          p.id === product.id ? { ...p, state: value } : p
                                        ) || [],
                                      },
                                    });
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="published">Published</SelectItem>
                                    <SelectItem value="notPublished">Not Published</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Subscription Required</Label>
                                <Switch
                                  checked={product.subscriptionRequired || false}
                                  onCheckedChange={(checked) => {
                                    const azureConfig = config.providerConfig as any;
                                    updateConfig({
                                      providerConfig: {
                                        ...azureConfig,
                                        products: azureConfig.products?.map((p: any) =>
                                          p.id === product.id ? { ...p, subscriptionRequired: checked } : p
                                        ) || [],
                                      },
                                    });
                                  }}
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {((config.providerConfig as any).products || []).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No products configured. Create a product to group APIs.
                        </div>
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
                        <CardDescription>API Management subscriptions</CardDescription>
                      </div>
                      <Button onClick={() => {
                        const azureConfig = config.providerConfig as any;
                        const newSub: any = {
                          id: `sub-${Date.now()}`,
                          name: 'new-subscription',
                          displayName: 'New Subscription',
                          state: 'active',
                          primaryKey: `key-${Math.random().toString(36).substr(2, 9)}`,
                          secondaryKey: `key-${Math.random().toString(36).substr(2, 9)}`,
                          productId: '',
                        };
                        updateConfig({
                          providerConfig: {
                            ...azureConfig,
                            subscriptions: [...(azureConfig.subscriptions || []), newSub],
                          },
                        });
                        showSuccess('Subscription created');
                      }} size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Subscription
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {((config.providerConfig as any).subscriptions || []).map((sub: any) => (
                        <Card key={sub.id} className="border-l-4 border-l-blue-500">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-lg">{sub.displayName || sub.name}</CardTitle>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant={sub.state === 'active' ? 'default' : 'outline'}>
                                    {sub.state || 'active'}
                                  </Badge>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirm({ type: 'subscription', id: sub.id, name: sub.displayName || sub.name })}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="space-y-2">
                              <Label className="text-xs">Display Name</Label>
                              <Input
                                value={sub.displayName || ''}
                                onChange={(e) => {
                                  const azureConfig = config.providerConfig as any;
                                  updateConfig({
                                    providerConfig: {
                                      ...azureConfig,
                                      subscriptions: azureConfig.subscriptions?.map((s: any) =>
                                        s.id === sub.id ? { ...s, displayName: e.target.value } : s
                                      ) || [],
                                    },
                                  });
                                }}
                                placeholder="Subscription Display Name"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Primary Key</Label>
                              <Input
                                value={sub.primaryKey || ''}
                                readOnly
                                className="font-mono text-xs"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">State</Label>
                              <Select
                                value={sub.state || 'active'}
                                onValueChange={(value) => {
                                  const azureConfig = config.providerConfig as any;
                                  updateConfig({
                                    providerConfig: {
                                      ...azureConfig,
                                      subscriptions: azureConfig.subscriptions?.map((s: any) =>
                                        s.id === sub.id ? { ...s, state: value } : s
                                      ) || [],
                                    },
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                  <SelectItem value="expired">Expired</SelectItem>
                                  <SelectItem value="suspended">Suspended</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {((config.providerConfig as any).subscriptions || []).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No subscriptions configured. Create a subscription to grant API access.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="policies" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Policies</CardTitle>
                        <CardDescription>XML-based policies for API Management</CardDescription>
                      </div>
                      <Button onClick={() => {
                        const azureConfig = config.providerConfig as any;
                        const newPolicy: any = {
                          id: `policy-${Date.now()}`,
                          name: 'New Policy',
                          scope: 'Global',
                          policyContent: '<policies><inbound><base /></inbound></policies>',
                        };
                        updateConfig({
                          providerConfig: {
                            ...azureConfig,
                            policies: [...(azureConfig.policies || []), newPolicy],
                          },
                        });
                        showSuccess('Policy created');
                      }} size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Policy
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {((config.providerConfig as any).policies || []).map((policy: any) => (
                        <Card key={policy.id} className="border-l-4 border-l-blue-500">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-lg">{policy.name}</CardTitle>
                                <Badge variant="outline" className="mt-2">{policy.scope || 'Global'}</Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const azureConfig = config.providerConfig as any;
                                  updateConfig({
                                    providerConfig: {
                                      ...azureConfig,
                                      policies: azureConfig.policies?.filter((p: any) => p.id !== policy.id) || [],
                                    },
                                  });
                                  showSuccess('Policy deleted');
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="space-y-2">
                              <Label className="text-xs">Scope</Label>
                              <Select
                                value={policy.scope || 'Global'}
                                onValueChange={(value) => {
                                  const azureConfig = config.providerConfig as any;
                                  updateConfig({
                                    providerConfig: {
                                      ...azureConfig,
                                      policies: azureConfig.policies?.map((p: any) =>
                                        p.id === policy.id ? { ...p, scope: value } : p
                                      ) || [],
                                    },
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Global">Global</SelectItem>
                                  <SelectItem value="Product">Product</SelectItem>
                                  <SelectItem value="API">API</SelectItem>
                                  <SelectItem value="Operation">Operation</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Policy XML</Label>
                              <Textarea
                                className="font-mono text-xs min-h-[200px]"
                                value={policy.policyContent || ''}
                                onChange={(e) => {
                                  const azureConfig = config.providerConfig as any;
                                  updateConfig({
                                    providerConfig: {
                                      ...azureConfig,
                                      policies: azureConfig.policies?.map((p: any) =>
                                        p.id === policy.id ? { ...p, policyContent: e.target.value } : p
                                      ) || [],
                                    },
                                  });
                                }}
                                placeholder="<policies>...</policies>"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {((config.providerConfig as any).policies || []).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No policies configured. Create a policy to customize API behavior.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="backends" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Backends</CardTitle>
                        <CardDescription>Backend service configurations</CardDescription>
                      </div>
                      <Button onClick={() => {
                        const azureConfig = config.providerConfig as any;
                        const newBackend: any = {
                          id: `backend-${Date.now()}`,
                          name: 'new-backend',
                          url: 'http://backend:8080',
                          protocol: 'http',
                        };
                        updateConfig({
                          providerConfig: {
                            ...azureConfig,
                            backends: [...(azureConfig.backends || []), newBackend],
                          },
                        });
                        showSuccess('Backend created');
                      }} size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Backend
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {((config.providerConfig as any).backends || []).map((backend: any) => (
                        <Card key={backend.id} className="border-l-4 border-l-blue-500">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">{backend.name}</CardTitle>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const azureConfig = config.providerConfig as any;
                                  updateConfig({
                                    providerConfig: {
                                      ...azureConfig,
                                      backends: azureConfig.backends?.filter((b: any) => b.id !== backend.id) || [],
                                    },
                                  });
                                  showSuccess('Backend deleted');
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="space-y-2">
                              <Label className="text-xs">URL</Label>
                              <Input
                                value={backend.url || ''}
                                onChange={(e) => {
                                  const azureConfig = config.providerConfig as any;
                                  updateConfig({
                                    providerConfig: {
                                      ...azureConfig,
                                      backends: azureConfig.backends?.map((b: any) =>
                                        b.id === backend.id ? { ...b, url: e.target.value } : b
                                      ) || [],
                                    },
                                  });
                                }}
                                placeholder="http://backend:8080"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Protocol</Label>
                              <Select
                                value={backend.protocol || 'http'}
                                onValueChange={(value) => {
                                  const azureConfig = config.providerConfig as any;
                                  updateConfig({
                                    providerConfig: {
                                      ...azureConfig,
                                      backends: azureConfig.backends?.map((b: any) =>
                                        b.id === backend.id ? { ...b, protocol: value } : b
                                      ) || [],
                                    },
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="http">HTTP</SelectItem>
                                  <SelectItem value="soap">SOAP</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {((config.providerConfig as any).backends || []).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No backends configured. Create a backend to define service endpoints.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}

          {/* GCP-специфичные табы */}
          {provider === 'gcp' && config.providerConfig && 'provider' in config.providerConfig && config.providerConfig.provider === 'gcp' && (
            <>
              <TabsContent value="openapi" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>OpenAPI Specification</CardTitle>
                    <CardDescription>OpenAPI/Swagger spec for Cloud Endpoints</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>OpenAPI Spec URL</Label>
                      <Input
                        value={(config.providerConfig as any).openApiSpecUrl || ''}
                        onChange={(e) => {
                          const gcpConfig = config.providerConfig as any;
                          updateConfig({
                            providerConfig: {
                              ...gcpConfig,
                              openApiSpecUrl: e.target.value,
                            },
                          });
                        }}
                        placeholder="https://example.com/openapi.yaml"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>OpenAPI Spec (YAML/JSON)</Label>
                      <Textarea
                        className="font-mono text-xs min-h-[400px]"
                        value={(config.providerConfig as any).openApiSpec || ''}
                        onChange={(e) => {
                          const gcpConfig = config.providerConfig as any;
                          updateConfig({
                            providerConfig: {
                              ...gcpConfig,
                              openApiSpec: e.target.value,
                            },
                          });
                        }}
                        placeholder="openapi: 3.0.0&#10;info:&#10;  title: My API&#10;..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter OpenAPI 3.0 specification in YAML or JSON format
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="service-accounts" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Service Accounts</CardTitle>
                        <CardDescription>GCP service accounts for authentication</CardDescription>
                      </div>
                      <Button onClick={() => {
                        const gcpConfig = config.providerConfig as any;
                        const newSA: any = {
                          email: `service-account-${Date.now()}@${gcpConfig.projectId || 'my-project'}.iam.gserviceaccount.com`,
                          roles: [],
                        };
                        updateConfig({
                          providerConfig: {
                            ...gcpConfig,
                            serviceAccounts: [...(gcpConfig.serviceAccounts || []), newSA],
                          },
                        });
                        showSuccess('Service account added');
                      }} size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Service Account
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {((config.providerConfig as any).serviceAccounts || []).map((sa: any, idx: number) => (
                        <Card key={idx} className="border-l-4 border-l-green-500">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">{sa.email}</CardTitle>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const gcpConfig = config.providerConfig as any;
                                  updateConfig({
                                    providerConfig: {
                                      ...gcpConfig,
                                      serviceAccounts: gcpConfig.serviceAccounts?.filter((s: any, i: number) => i !== idx) || [],
                                    },
                                  });
                                  showSuccess('Service account removed');
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="space-y-2">
                              <Label className="text-xs">Email</Label>
                              <Input
                                value={sa.email || ''}
                                onChange={(e) => {
                                  const gcpConfig = config.providerConfig as any;
                                  updateConfig({
                                    providerConfig: {
                                      ...gcpConfig,
                                      serviceAccounts: gcpConfig.serviceAccounts?.map((s: any, i: number) =>
                                        i === idx ? { ...s, email: e.target.value } : s
                                      ) || [],
                                    },
                                  });
                                }}
                                placeholder="service-account@project.iam.gserviceaccount.com"
                                className="font-mono text-xs"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Display Name</Label>
                              <Input
                                value={sa.displayName || ''}
                                onChange={(e) => {
                                  const gcpConfig = config.providerConfig as any;
                                  updateConfig({
                                    providerConfig: {
                                      ...gcpConfig,
                                      serviceAccounts: gcpConfig.serviceAccounts?.map((s: any, i: number) =>
                                        i === idx ? { ...s, displayName: e.target.value } : s
                                      ) || [],
                                    },
                                  });
                                }}
                                placeholder="Service Account Display Name"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Roles</Label>
                              <Input
                                value={(sa.roles || []).join(', ')}
                                onChange={(e) => {
                                  const gcpConfig = config.providerConfig as any;
                                  updateConfig({
                                    providerConfig: {
                                      ...gcpConfig,
                                      serviceAccounts: gcpConfig.serviceAccounts?.map((s: any, i: number) =>
                                        i === idx ? { ...s, roles: e.target.value.split(',').map(r => r.trim()).filter(Boolean) } : s
                                      ) || [],
                                    },
                                  });
                                }}
                                placeholder="roles/endpoints.serviceAgent, roles/iam.serviceAccountUser"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {((config.providerConfig as any).serviceAccounts || []).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No service accounts configured. Add service accounts for IAM authentication.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="quotas" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Quotas</CardTitle>
                        <CardDescription>API quotas and limits</CardDescription>
                      </div>
                      <Button onClick={() => {
                        const gcpConfig = config.providerConfig as any;
                        const newQuota: any = {
                          id: `quota-${Date.now()}`,
                          name: 'New Quota',
                          metric: 'requests',
                          limit: 1000,
                          unit: '1/min/{project}',
                        };
                        updateConfig({
                          providerConfig: {
                            ...gcpConfig,
                            quotas: [...(gcpConfig.quotas || []), newQuota],
                          },
                        });
                        showSuccess('Quota created');
                      }} size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Quota
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {((config.providerConfig as any).quotas || []).map((quota: any) => (
                        <Card key={quota.id} className="border-l-4 border-l-green-500">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">{quota.name}</CardTitle>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const gcpConfig = config.providerConfig as any;
                                  updateConfig({
                                    providerConfig: {
                                      ...gcpConfig,
                                      quotas: gcpConfig.quotas?.filter((q: any) => q.id !== quota.id) || [],
                                    },
                                  });
                                  showSuccess('Quota deleted');
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs">Metric</Label>
                                <Input
                                  value={quota.metric || ''}
                                  onChange={(e) => {
                                    const gcpConfig = config.providerConfig as any;
                                    updateConfig({
                                      providerConfig: {
                                        ...gcpConfig,
                                        quotas: gcpConfig.quotas?.map((q: any) =>
                                          q.id === quota.id ? { ...q, metric: e.target.value } : q
                                        ) || [],
                                      },
                                    });
                                  }}
                                  placeholder="requests"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Limit</Label>
                                <Input
                                  type="number"
                                  value={quota.limit || ''}
                                  onChange={(e) => {
                                    const gcpConfig = config.providerConfig as any;
                                    updateConfig({
                                      providerConfig: {
                                        ...gcpConfig,
                                        quotas: gcpConfig.quotas?.map((q: any) =>
                                          q.id === quota.id ? { ...q, limit: parseInt(e.target.value) || 0 } : q
                                        ) || [],
                                      },
                                    });
                                  }}
                                  placeholder="1000"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Unit</Label>
                              <Input
                                value={quota.unit || ''}
                                onChange={(e) => {
                                  const gcpConfig = config.providerConfig as any;
                                  updateConfig({
                                    providerConfig: {
                                      ...gcpConfig,
                                      quotas: gcpConfig.quotas?.map((q: any) =>
                                        q.id === quota.id ? { ...q, unit: e.target.value } : q
                                      ) || [],
                                    },
                                  });
                                }}
                                placeholder="1/min/{project}"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {((config.providerConfig as any).quotas || []).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          No quotas configured. Create quotas to limit API usage.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This action cannot be undone.
                {deleteConfirm?.type === 'api' && ' Any API keys using this API will lose access.'}
                {deleteConfirm?.type === 'key' && ' Applications using this key will lose access.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!deleteConfirm) return;
                  
                  switch (deleteConfirm.type) {
                    case 'api':
                      confirmDeleteAPI();
                      break;
                    case 'key':
                      updateConfig({ keys: keys.filter(k => k.id !== deleteConfirm.id) });
                      showSuccess(`API Key "${deleteConfirm.name}" deleted`);
                      setDeleteConfirm(null);
                      break;
                    case 'stage':
                      const awsConfig = config.providerConfig as any;
                      updateConfig({
                        providerConfig: {
                          ...awsConfig,
                          stages: awsConfig.stages?.filter((s: any) => s.id !== deleteConfirm.id) || [],
                        },
                      });
                      showSuccess('Stage deleted');
                      setDeleteConfirm(null);
                      break;
                    case 'usage-plan':
                      const awsConfig2 = config.providerConfig as any;
                      updateConfig({
                        providerConfig: {
                          ...awsConfig2,
                          usagePlans: awsConfig2.usagePlans?.filter((p: any) => p.id !== deleteConfirm.id) || [],
                        },
                      });
                      showSuccess('Usage plan deleted');
                      setDeleteConfirm(null);
                      break;
                    case 'authorizer':
                      const awsConfig3 = config.providerConfig as any;
                      updateConfig({
                        providerConfig: {
                          ...awsConfig3,
                          authorizers: awsConfig3.authorizers?.filter((a: any) => a.id !== deleteConfirm.id) || [],
                        },
                      });
                      showSuccess('Authorizer deleted');
                      setDeleteConfirm(null);
                      break;
                    case 'product':
                      const azureConfig = config.providerConfig as any;
                      updateConfig({
                        providerConfig: {
                          ...azureConfig,
                          products: azureConfig.products?.filter((p: any) => p.id !== deleteConfirm.id) || [],
                        },
                      });
                      showSuccess('Product deleted');
                      setDeleteConfirm(null);
                      break;
                    case 'subscription':
                      const azureConfig2 = config.providerConfig as any;
                      updateConfig({
                        providerConfig: {
                          ...azureConfig2,
                          subscriptions: azureConfig2.subscriptions?.filter((s: any) => s.id !== deleteConfirm.id) || [],
                        },
                      });
                      showSuccess('Subscription deleted');
                      setDeleteConfirm(null);
                      break;
                    case 'policy':
                      const azureConfig3 = config.providerConfig as any;
                      updateConfig({
                        providerConfig: {
                          ...azureConfig3,
                          policies: azureConfig3.policies?.filter((p: any) => p.id !== deleteConfirm.id) || [],
                        },
                      });
                      showSuccess('Policy deleted');
                      setDeleteConfirm(null);
                      break;
                    case 'backend':
                      const azureConfig4 = config.providerConfig as any;
                      updateConfig({
                        providerConfig: {
                          ...azureConfig4,
                          backends: azureConfig4.backends?.filter((b: any) => b.id !== deleteConfirm.id) || [],
                        },
                      });
                      showSuccess('Backend deleted');
                      setDeleteConfirm(null);
                      break;
                    case 'service-account':
                      const gcpConfig = config.providerConfig as any;
                      const saIndex = gcpConfig.serviceAccounts?.findIndex((s: any, i: number) => 
                        s.email === deleteConfirm.id || i.toString() === deleteConfirm.id
                      );
                      if (saIndex !== undefined && saIndex >= 0) {
                        updateConfig({
                          providerConfig: {
                            ...gcpConfig,
                            serviceAccounts: gcpConfig.serviceAccounts?.filter((s: any, i: number) => i !== saIndex) || [],
                          },
                        });
                        showSuccess('Service account removed');
                      }
                      setDeleteConfirm(null);
                      break;
                    case 'quota':
                      const gcpConfig2 = config.providerConfig as any;
                      updateConfig({
                        providerConfig: {
                          ...gcpConfig2,
                          quotas: gcpConfig2.quotas?.filter((q: any) => q.id !== deleteConfirm.id) || [],
                        },
                      });
                      showSuccess('Quota deleted');
                      setDeleteConfirm(null);
                      break;
                  }
                }}
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





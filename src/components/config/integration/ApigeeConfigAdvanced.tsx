import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { useEmulationStore } from '@/store/useEmulationStore';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Network, 
  Settings, 
  Activity,
  Shield,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Search,
  Filter,
  HelpCircle,
  X,
  Package,
  Users,
  Key,
  Pencil,
  Eye,
  EyeOff
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';

interface ApigeeConfigProps {
  componentId: string;
}

interface APIProxy {
  name: string;
  environment: 'dev' | 'stage' | 'prod';
  basePath: string;
  targetEndpoint: string;
  revision?: number;
  status?: 'deployed' | 'undeployed';
  quota?: number;
  quotaInterval?: number;
  spikeArrest?: number;
  enableOAuth?: boolean;
  jwtIssuer?: string;
  requestCount?: number;
  errorCount?: number;
  avgResponseTime?: number;
}

interface Policy {
  id: string;
  name: string;
  type: 'quota' | 'spike-arrest' | 'oauth' | 'jwt' | 'verify-api-key' | 'cors' | 'xml-to-json';
  enabled: boolean;
  executionFlow?: 'PreFlow' | 'RequestFlow' | 'ResponseFlow' | 'PostFlow' | 'ErrorFlow';
  condition?: string;
  config?: Record<string, any>;
}

interface APIProduct {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  proxies: string[]; // Array of proxy names
  environments?: ('dev' | 'stage' | 'prod')[];
  quota?: number;
  quotaInterval?: number;
  attributes?: Record<string, string>;
  createdAt?: number;
  updatedAt?: number;
}

interface DeveloperAppKey {
  id: string;
  key: string;
  consumerKey?: string;
  consumerSecret?: string;
  status?: 'approved' | 'revoked';
  expiresAt?: number;
  createdAt: number;
  attributes?: Record<string, string>;
  apiProducts?: string[]; // Array of product IDs
}

interface DeveloperApp {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  developerId?: string;
  developerEmail?: string;
  status?: 'approved' | 'pending' | 'revoked';
  apiProducts: string[]; // Array of product IDs
  keys: DeveloperAppKey[]; // Array of API keys
  attributes?: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

interface ApigeeConfig {
  organization?: string;
  environment?: string;
  proxies?: APIProxy[];
  policies?: Policy[];
  products?: APIProduct[];
  developerApps?: DeveloperApp[];
  apiKey?: string;
}

interface ValidationError {
  field: string;
  message: string;
}

export function ApigeeConfigAdvanced({ componentId }: ApigeeConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { isRunning, getComponentMetrics } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;
  
  const metrics = isRunning ? getComponentMetrics(componentId) : undefined;

  const config = (node.data.config as any) || {} as ApigeeConfig;
  const organization = config.organization || 'archiphoenix-org';
  const environment = config.environment || 'prod';
  const proxies = Array.isArray(config.proxies) ? config.proxies : [];
  const policies = Array.isArray(config.policies) ? config.policies : [];
  const products = Array.isArray(config.products) ? config.products : [];
  const developerApps = Array.isArray(config.developerApps) ? config.developerApps : [];
  const apiKey = config.apiKey || '';

  const [editingProxyIndex, setEditingProxyIndex] = useState<number | null>(null);
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);
  const [newPolicyType, setNewPolicyType] = useState<'quota' | 'spike-arrest' | 'oauth' | 'jwt' | 'verify-api-key' | 'cors' | 'xml-to-json'>('quota');
  const [validationErrors, setValidationErrors] = useState<Map<number, ValidationError[]>>(new Map());
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [showCreateApp, setShowCreateApp] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  
  // Search and filter state
  const [proxySearchQuery, setProxySearchQuery] = useState('');
  const [proxyEnvironmentFilter, setProxyEnvironmentFilter] = useState<string>('all');
  const [proxyStatusFilter, setProxyStatusFilter] = useState<string>('all');
  const [policySearchQuery, setPolicySearchQuery] = useState('');
  const [policyTypeFilter, setPolicyTypeFilter] = useState<string>('all');
  const [policyFlowFilter, setPolicyFlowFilter] = useState<string>('all');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState<string>('all');
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  // Generate Apigee API key in correct format (32 characters, alphanumeric)
  // Apigee consumer keys are typically 32 characters, can be up to 255
  const generateApigeeApiKey = useCallback((): string => {
    const routingEngine = emulationEngine.getApigeeRoutingEngine(componentId);
    if (routingEngine) {
      return routingEngine.generateApiKey();
    }
    // Fallback: generate 32-character alphanumeric key (Apigee standard format)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  }, [componentId]);

  // Validate proxy configuration
  const validateProxy = useCallback((proxy: APIProxy, index: number, allProxies: APIProxy[]): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (!proxy.name || proxy.name.trim() === '') {
      errors.push({ field: 'name', message: 'Proxy name is required' });
    } else if (!/^[a-zA-Z0-9_-]+$/.test(proxy.name)) {
      errors.push({ field: 'name', message: 'Proxy name can only contain letters, numbers, hyphens and underscores' });
    } else if (allProxies.some((p, i) => i !== index && p.name === proxy.name)) {
      errors.push({ field: 'name', message: 'Proxy name must be unique' });
    }

    if (!proxy.basePath || !proxy.basePath.startsWith('/')) {
      errors.push({ field: 'basePath', message: 'Base path must start with /' });
    }

    if (!proxy.targetEndpoint || !proxy.targetEndpoint.match(/^https?:\/\/.+/)) {
      errors.push({ field: 'targetEndpoint', message: 'Target endpoint must be a valid URL (http:// or https://)' });
    }

    if (proxy.quota !== undefined && proxy.quota < 0) {
      errors.push({ field: 'quota', message: 'Quota must be a positive number' });
    }

    if (proxy.quotaInterval !== undefined && proxy.quotaInterval <= 0) {
      errors.push({ field: 'quotaInterval', message: 'Quota interval must be greater than 0' });
    }

    if (proxy.spikeArrest !== undefined && proxy.spikeArrest < 0) {
      errors.push({ field: 'spikeArrest', message: 'Spike arrest rate must be a positive number' });
    }

    return errors;
  }, []);

  // Update config with synchronization to emulation engine
  const updateConfig = useCallback((updates: Partial<ApigeeConfig>) => {
    const newConfig = { ...config, ...updates };
    
    updateNode(componentId, {
      data: {
        ...node.data,
        config: newConfig,
      },
    });

    // Immediately update emulation engine
    try {
      emulationEngine.updateApigeeRoutingEngine(componentId);
    } catch (error) {
      console.error('Failed to update Apigee routing engine:', error);
      toast({
        title: 'Update Error',
        description: 'Failed to synchronize configuration with simulation engine',
        variant: 'destructive',
      });
    }
  }, [componentId, node, config, updateNode, toast]);

  // Sync metrics from routing engine to UI
  useEffect(() => {
    if (!isRunning) return;

    const routingEngine = emulationEngine.getApigeeRoutingEngine(componentId);
    if (!routingEngine) return;

    const interval = setInterval(() => {
      const updatedProxies = proxies.map((proxy: APIProxy) => {
        const metrics = routingEngine.getProxyMetrics(proxy.name);
        if (metrics) {
          return {
            ...proxy,
            requestCount: metrics.requestCount,
            errorCount: metrics.errorCount,
            avgResponseTime: metrics.avgResponseTime,
          };
        }
        return proxy;
      });

      // Only update if metrics changed
      const hasChanges = updatedProxies.some((p: APIProxy, i: number) => 
        p.requestCount !== proxies[i]?.requestCount ||
        p.errorCount !== proxies[i]?.errorCount ||
        p.avgResponseTime !== proxies[i]?.avgResponseTime
      );

      if (hasChanges) {
        updateConfig({ proxies: updatedProxies });
      }
    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, [componentId, isRunning, proxies, updateConfig]);

  // Sync configuration changes to emulation engine
  useEffect(() => {
    try {
      emulationEngine.updateApigeeRoutingEngine(componentId);
    } catch (error) {
      console.error('Failed to sync configuration:', error);
    }
  }, [componentId, proxies, policies, products, organization, environment]);

  const addProxy = useCallback(() => {
    const newProxy: APIProxy = {
      name: `proxy-${Date.now()}`,
      environment: environment as 'dev' | 'stage' | 'prod',
      basePath: '/api',
      targetEndpoint: 'https://api.internal',
      revision: 1,
      status: 'undeployed',
      quota: 1000,
      quotaInterval: 60,
      spikeArrest: 50,
      enableOAuth: false,
      requestCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
    };
    
    const errors = validateProxy(newProxy, proxies.length, [...proxies, newProxy]);
    if (errors.length > 0) {
      toast({
        title: 'Validation Error',
        description: errors.map(e => e.message).join(', '),
        variant: 'destructive',
      });
      return;
    }

    updateConfig({ proxies: [...proxies, newProxy] });
    toast({
      title: 'Proxy Created',
      description: `Proxy "${newProxy.name}" has been created in ${environment.toUpperCase()} environment`,
    });
  }, [proxies, validateProxy, updateConfig, toast, environment]);

  const removeProxy = useCallback((index: number) => {
    const proxy = proxies[index];
    if (!proxy) return;

    updateConfig({ proxies: proxies.filter((_: APIProxy, i: number) => i !== index) });
    toast({
      title: 'Proxy Deleted',
      description: `Proxy "${proxy.name}" has been deleted`,
    });
  }, [proxies, updateConfig, toast]);

  const updateProxy = useCallback((index: number, field: string, value: any) => {
    const newProxies = [...proxies];
    const updatedProxy = { ...newProxies[index], [field]: value };
    newProxies[index] = updatedProxy;

    // Validate updated proxy
    const errors = validateProxy(updatedProxy, index, newProxies);
    setValidationErrors(prev => {
      const newMap = new Map(prev);
      if (errors.length > 0) {
        newMap.set(index, errors);
      } else {
        newMap.delete(index);
      }
      return newMap;
    });

    updateConfig({ proxies: newProxies });
  }, [proxies, validateProxy, updateConfig]);

  const toggleProxyStatus = useCallback((index: number) => {
    const proxy = proxies[index];
    if (!proxy) return;

    const newStatus = proxy.status === 'deployed' ? 'undeployed' : 'deployed';
    updateProxy(index, 'status', newStatus);
    toast({
      title: `Proxy ${newStatus === 'deployed' ? 'Deployed' : 'Undeployed'}`,
      description: `Proxy "${proxy.name}" is now ${newStatus}`,
    });
  }, [proxies, updateProxy, toast]);

  const addPolicy = useCallback(() => {
    const defaultNames: Record<string, string> = {
      'quota': 'Quota Policy',
      'spike-arrest': 'Spike Arrest Policy',
      'oauth': 'OAuth Policy',
      'jwt': 'JWT Policy',
      'verify-api-key': 'Verify API Key Policy',
      'cors': 'CORS Policy',
      'xml-to-json': 'XML to JSON Policy',
    };
    
    const defaultFlows: Record<string, 'PreFlow' | 'RequestFlow' | 'ResponseFlow' | 'PostFlow'> = {
      'quota': 'RequestFlow',
      'spike-arrest': 'RequestFlow',
      'oauth': 'PreFlow',
      'jwt': 'PreFlow',
      'verify-api-key': 'PreFlow',
      'cors': 'PostFlow',
      'xml-to-json': 'ResponseFlow',
    };
    
    const newPolicy: Policy = {
      id: `policy-${Date.now()}`,
      name: defaultNames[newPolicyType] || 'New Policy',
      type: newPolicyType,
      enabled: true,
      executionFlow: defaultFlows[newPolicyType],
      config: {},
    };
    
    updateConfig({ policies: [...policies, newPolicy] });
    setShowCreatePolicy(false);
    setNewPolicyType('quota');
    toast({
      title: 'Policy Created',
      description: `Policy "${newPolicy.name}" has been created`,
    });
  }, [policies, newPolicyType, updateConfig, toast]);

  const removePolicy = useCallback((id: string) => {
    const policy = policies.find((p: Policy) => p.id === id);
    updateConfig({ policies: policies.filter((p: Policy) => p.id !== id) });
    if (policy) {
      toast({
        title: 'Policy Deleted',
        description: `Policy "${policy.name}" has been deleted`,
      });
    }
  }, [policies, updateConfig, toast]);

  const updatePolicy = useCallback((id: string, field: string, value: any) => {
    const newPolicies = policies.map((p: Policy) =>
      p.id === id ? { ...p, [field]: value } : p
    );
    updateConfig({ policies: newPolicies });
  }, [policies, updateConfig]);

  // Product management
  const addProduct = useCallback(() => {
    const newProduct: APIProduct = {
      id: `product-${Date.now()}`,
      name: `product-${Date.now()}`,
      displayName: `Product ${Date.now()}`,
      description: '',
      proxies: [],
      environments: ['prod'],
      quota: 1000,
      quotaInterval: 60,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    updateConfig({ products: [...products, newProduct] });
    setEditingProductId(newProduct.id);
    toast({
      title: 'Product Created',
      description: `Product "${newProduct.displayName}" has been created`,
    });
  }, [products, updateConfig, toast]);

  const removeProduct = useCallback((id: string) => {
    const product = products.find((p: APIProduct) => p.id === id);
    updateConfig({ products: products.filter((p: APIProduct) => p.id !== id) });
    if (product) {
      toast({
        title: 'Product Deleted',
        description: `Product "${product.displayName || product.name}" has been deleted`,
      });
    }
  }, [products, updateConfig, toast]);

  const updateProduct = useCallback((id: string, field: string, value: any) => {
    const newProducts = products.map((p: APIProduct) =>
      p.id === id ? { ...p, [field]: value, updatedAt: Date.now() } : p
    );
    updateConfig({ products: newProducts });
  }, [products, updateConfig]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((product: APIProduct) => {
      const matchesSearch = !productSearchQuery || 
        product.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
        (product.displayName && product.displayName.toLowerCase().includes(productSearchQuery.toLowerCase())) ||
        (product.description && product.description.toLowerCase().includes(productSearchQuery.toLowerCase()));
      // Don't filter by environment - show all products for editing
      // Users should be able to see and edit all products regardless of their environment configuration
      return matchesSearch;
    });
  }, [products, productSearchQuery]);

  // Developer App management
  const addDeveloperApp = useCallback(() => {
    const generatedKey = generateApigeeApiKey();
    
    const newApp: DeveloperApp = {
      id: `app-${Date.now()}`,
      name: `app-${Date.now()}`,
      displayName: `Developer App ${Date.now()}`,
      description: '',
      developerId: `dev-${Date.now()}`,
      developerEmail: '',
      status: 'approved',
      apiProducts: [],
      keys: [{
        id: `key-${Date.now()}`,
        key: generatedKey,
        consumerKey: generatedKey,
        status: 'approved',
        createdAt: Date.now(),
        apiProducts: [],
      }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    updateConfig({ developerApps: [...developerApps, newApp] });
    setEditingAppId(newApp.id);
    toast({
      title: 'Developer App Created',
      description: `Developer App "${newApp.displayName}" has been created`,
    });
  }, [developerApps, componentId, updateConfig, toast, generateApigeeApiKey]);

  const removeDeveloperApp = useCallback((id: string) => {
    const app = developerApps.find((a: DeveloperApp) => a.id === id);
    updateConfig({ developerApps: developerApps.filter((a: DeveloperApp) => a.id !== id) });
    if (app) {
      toast({
        title: 'Developer App Deleted',
        description: `Developer App "${app.displayName || app.name}" has been deleted`,
      });
    }
  }, [developerApps, updateConfig, toast]);

  const updateDeveloperApp = useCallback((id: string, field: string, value: any) => {
    const newApps = developerApps.map((a: DeveloperApp) =>
      a.id === id ? { ...a, [field]: value, updatedAt: Date.now() } : a
    );
    updateConfig({ developerApps: newApps });
  }, [developerApps, updateConfig]);

  const addAppKey = useCallback((appId: string) => {
    const generatedKey = generateApigeeApiKey();
    
    const app = developerApps.find((a: DeveloperApp) => a.id === appId);
    if (!app) return;
    
    const newKey: DeveloperAppKey = {
      id: `key-${Date.now()}`,
      key: generatedKey,
      consumerKey: generatedKey,
      status: 'approved',
      createdAt: Date.now(),
      apiProducts: app.apiProducts || [],
    };
    
    updateDeveloperApp(appId, 'keys', [...(app.keys || []), newKey]);
    toast({
      title: 'API Key Created',
      description: 'New API key has been generated for this app',
    });
  }, [developerApps, componentId, updateDeveloperApp, toast, generateApigeeApiKey]);

  const removeAppKey = useCallback((appId: string, keyId: string) => {
    const app = developerApps.find((a: DeveloperApp) => a.id === appId);
    if (!app) return;
    
    updateDeveloperApp(appId, 'keys', (app.keys || []).filter((k: DeveloperAppKey) => k.id !== keyId));
    toast({
      title: 'API Key Deleted',
      description: 'API key has been removed from this app',
    });
  }, [developerApps, updateDeveloperApp, toast]);

  const updateAppKey = useCallback((appId: string, keyId: string, field: string, value: any) => {
    const app = developerApps.find((a: DeveloperApp) => a.id === appId);
    if (!app) return;
    
    const updatedKeys = (app.keys || []).map((k: DeveloperAppKey) =>
      k.id === keyId ? { ...k, [field]: value } : k
    );
    updateDeveloperApp(appId, 'keys', updatedKeys);
  }, [developerApps, updateDeveloperApp]);

  const toggleAppProduct = useCallback((appId: string, productId: string) => {
    const app = developerApps.find((a: DeveloperApp) => a.id === appId);
    if (!app) return;
    
    const currentProducts = app.apiProducts || [];
    const newProducts = currentProducts.includes(productId)
      ? currentProducts.filter((id: string) => id !== productId)
      : [...currentProducts, productId];
    
    // Update app products and keys in one operation
    const updatedKeys = (app.keys || []).map((key: DeveloperAppKey) => ({
      ...key,
      apiProducts: newProducts,
    }));
    
    // Update both apiProducts and keys together
    const newApps = developerApps.map((a: DeveloperApp) =>
      a.id === appId 
        ? { 
            ...a, 
            apiProducts: newProducts, 
            keys: updatedKeys,
            updatedAt: Date.now() 
          } 
        : a
    );
    updateConfig({ developerApps: newApps });
  }, [developerApps, updateConfig]);

  // Filtered developer apps
  const filteredDeveloperApps = useMemo(() => {
    return developerApps.filter((app: DeveloperApp) => {
      const matchesSearch = !appSearchQuery || 
        app.name.toLowerCase().includes(appSearchQuery.toLowerCase()) ||
        (app.displayName && app.displayName.toLowerCase().includes(appSearchQuery.toLowerCase())) ||
        (app.developerEmail && app.developerEmail.toLowerCase().includes(appSearchQuery.toLowerCase()));
      
      const matchesStatus = appStatusFilter === 'all' || app.status === appStatusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [developerApps, appSearchQuery, appStatusFilter]);

  // Get key usage metrics from routing engine
  const getKeyUsageMetrics = useCallback((apiKey: string) => {
    if (!isRunning) return null;
    const routingEngine = emulationEngine.getApigeeRoutingEngine(componentId);
    if (!routingEngine) return null;
    return routingEngine.getKeyUsageMetrics(apiKey);
  }, [componentId, isRunning]);

  // Calculate totals from proxies or use metrics
  const totalRequests = useMemo(() => {
    return metrics?.customMetrics?.total_requests || 
      proxies.reduce((sum: number, p: APIProxy) => sum + (p.requestCount || 0), 0);
  }, [metrics, proxies]);

  const totalErrors = useMemo(() => {
    return metrics?.customMetrics?.total_errors || 
      proxies.reduce((sum: number, p: APIProxy) => sum + (p.errorCount || 0), 0);
  }, [metrics, proxies]);

  const avgResponseTime = useMemo(() => {
    return metrics?.customMetrics?.avg_latency || 
      (proxies.length > 0
        ? proxies.reduce((sum: number, p: APIProxy) => sum + (p.avgResponseTime || 0), 0) / proxies.length
        : 0);
  }, [metrics, proxies]);

  // Filtered proxies
  const filteredProxies = useMemo(() => {
    return proxies.filter((proxy: APIProxy) => {
      const matchesSearch = !proxySearchQuery || 
        proxy.name.toLowerCase().includes(proxySearchQuery.toLowerCase()) ||
        proxy.basePath.toLowerCase().includes(proxySearchQuery.toLowerCase()) ||
        proxy.targetEndpoint.toLowerCase().includes(proxySearchQuery.toLowerCase());
      const matchesEnvironment = proxyEnvironmentFilter === 'all' || proxy.environment === proxyEnvironmentFilter;
      const matchesStatus = proxyStatusFilter === 'all' || 
        (proxyStatusFilter === 'deployed' && (proxy.status === 'deployed' || !proxy.status)) ||
        (proxyStatusFilter === 'undeployed' && proxy.status === 'undeployed');
      return matchesSearch && matchesEnvironment && matchesStatus;
    });
  }, [proxies, proxySearchQuery, proxyEnvironmentFilter, proxyStatusFilter]);

  // Filtered policies
  const filteredPolicies = useMemo(() => {
    return policies.filter((policy: Policy) => {
      const matchesSearch = !policySearchQuery || 
        policy.name.toLowerCase().includes(policySearchQuery.toLowerCase()) ||
        policy.type.toLowerCase().includes(policySearchQuery.toLowerCase()) ||
        (policy.condition && policy.condition.toLowerCase().includes(policySearchQuery.toLowerCase()));
      const matchesType = policyTypeFilter === 'all' || policy.type === policyTypeFilter;
      const matchesFlow = policyFlowFilter === 'all' || policy.executionFlow === policyFlowFilter;
      return matchesSearch && matchesType && matchesFlow;
    });
  }, [policies, policySearchQuery, policyTypeFilter, policyFlowFilter]);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Apigee API Platform</p>
            <h2 className="text-2xl font-bold text-foreground">API Proxy Management</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure API proxies, policies, quotas and security
            </p>
          </div>
        </div>

        <Separator />

        {/* Active Environment Selector */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Active Environment</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Viewing and managing configuration for this environment
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={environment}
                  onValueChange={(value) => {
                    updateConfig({ environment: value });
                    toast({
                      title: 'Environment Switched',
                      description: `Switched to ${value.toUpperCase()} environment`,
                    });
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dev">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-yellow-500" />
                        <span>Development</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="stage">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <span>Staging</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="prod">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span>Production</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Active environment determines which proxies and products are visible. Proxies deployed to this environment will be used for routing.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Organization</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{organization}</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">API Proxies</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{proxies.length}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{totalRequests.toLocaleString()}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{avgResponseTime.toFixed(0)}</span>
              <p className="text-xs text-muted-foreground mt-1">ms</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="proxies" className="space-y-4">
          <TabsList className="flex-wrap h-auto min-h-[36px] w-full justify-start gap-1">
            <TabsTrigger value="proxies">
              <Network className="h-4 w-4 mr-2" />
              Proxies ({proxies.length})
            </TabsTrigger>
            <TabsTrigger value="policies">
              <Shield className="h-4 w-4 mr-2" />
              Policies ({policies.length})
            </TabsTrigger>
            <TabsTrigger value="products">
              <Package className="h-4 w-4 mr-2" />
              Products ({products.length})
            </TabsTrigger>
            <TabsTrigger value="developer-apps">
              <Users className="h-4 w-4 mr-2" />
              Developer Apps ({developerApps.length})
            </TabsTrigger>
            <TabsTrigger value="monitoring" disabled={proxies.filter((p: APIProxy) => p.status === 'deployed' || !p.status).length === 0}>
              <Activity className="h-4 w-4 mr-2" />
              Monitoring ({proxies.filter((p: APIProxy) => p.status === 'deployed' || !p.status).length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="proxies" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>API Proxies</CardTitle>
                    <CardDescription>Configure and manage API proxies</CardDescription>
                  </div>
                  <Button onClick={addProxy} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Proxy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Search and filters */}
                  {proxies.length > 0 && (
                    <div className="space-y-3 pb-4 border-b">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search proxies by name, base path, or endpoint..."
                          value={proxySearchQuery}
                          onChange={(e) => setProxySearchQuery(e.target.value)}
                          className="pl-9"
                        />
                        {proxySearchQuery && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                            onClick={() => setProxySearchQuery('')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Select value={proxyEnvironmentFilter} onValueChange={setProxyEnvironmentFilter}>
                          <SelectTrigger className="w-[150px]">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Environments</SelectItem>
                            <SelectItem value="dev">Development</SelectItem>
                            <SelectItem value="stage">Staging</SelectItem>
                            <SelectItem value="prod">Production</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={proxyStatusFilter} onValueChange={setProxyStatusFilter}>
                          <SelectTrigger className="w-[150px]">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="deployed">Deployed</SelectItem>
                            <SelectItem value="undeployed">Undeployed</SelectItem>
                          </SelectContent>
                        </Select>
                        {(proxySearchQuery || proxyEnvironmentFilter !== 'all' || proxyStatusFilter !== 'all') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setProxySearchQuery('');
                              setProxyEnvironmentFilter('all');
                              setProxyStatusFilter('all');
                            }}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Clear Filters
                          </Button>
                        )}
                      </div>
                      {filteredProxies.length !== proxies.length && (
                        <p className="text-xs text-muted-foreground">
                          Showing {filteredProxies.length} of {proxies.length} proxies
                        </p>
                      )}
                    </div>
                  )}
                  {proxies.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No proxies configured. Create your first proxy to get started.</p>
                  ) : filteredProxies.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {proxySearchQuery || proxyEnvironmentFilter !== 'all' || proxyStatusFilter !== 'all'
                        ? 'No proxies match your filters'
                        : 'No proxies configured'}
                    </p>
                  ) : (
                    filteredProxies.map((proxy: APIProxy) => {
                      const index = proxies.findIndex((p: APIProxy) => p.name === proxy.name);
                      const errors = validationErrors.get(index) || [];
                      return (
                        <Card key={index} className="border-l-4 border-l-blue-500">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Network className="h-5 w-5 text-blue-500" />
                                <div>
                                  {editingProxyIndex === index ? (
                                    <Input
                                      value={proxy.name}
                                      onChange={(e) => updateProxy(index, 'name', e.target.value)}
                                      onBlur={() => setEditingProxyIndex(null)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          setEditingProxyIndex(null);
                                        }
                                      }}
                                      className="font-semibold text-base"
                                      autoFocus
                                    />
                                  ) : (
                                    <CardTitle 
                                      className="text-base cursor-pointer hover:text-primary transition-colors"
                                      onClick={() => setEditingProxyIndex(index)}
                                    >
                                      {proxy.name}
                                    </CardTitle>
                                  )}
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge 
                                      variant={proxy.status === 'deployed' ? 'default' : 'outline'}
                                      className="cursor-pointer"
                                      onClick={() => toggleProxyStatus(index)}
                                    >
                                      {proxy.status || 'undeployed'}
                                    </Badge>
                                    <Badge variant="outline">{proxy.environment}</Badge>
                                    <Badge variant="outline">Rev {proxy.revision || 1}</Badge>
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeProxy(index)}
                                disabled={proxies.length === 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {errors.length > 0 && (
                              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 space-y-1">
                                {errors.map((error, i) => (
                                  <div key={i} className="flex items-center gap-2 text-sm text-destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <span>{error.message}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Requests</p>
                                <p className="text-lg font-semibold">{(proxy.requestCount || 0).toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Errors</p>
                                <p className="text-lg font-semibold text-red-500">{(proxy.errorCount || 0).toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Response Time</p>
                                <p className="text-lg font-semibold">{(proxy.avgResponseTime || 0).toFixed(0)} ms</p>
                              </div>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label>Proxy Name</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Unique identifier for the API proxy. Can only contain letters, numbers, hyphens and underscores.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <Input
                                  value={proxy.name}
                                  onChange={(e) => updateProxy(index, 'name', e.target.value)}
                                  className={errors.some(e => e.field === 'name') ? 'border-destructive' : ''}
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label>Environment</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Deployment environment for this proxy. Determines which environment-specific configurations are applied.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <Select
                                  value={proxy.environment}
                                  onValueChange={(value: 'dev' | 'stage' | 'prod') => updateProxy(index, 'environment', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="dev">Development</SelectItem>
                                    <SelectItem value="stage">Staging</SelectItem>
                                    <SelectItem value="prod">Production</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label>Base Path</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Base URL path for the API proxy. Must start with a forward slash (/). This path is prepended to all API requests.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <Input
                                  value={proxy.basePath}
                                  onChange={(e) => updateProxy(index, 'basePath', e.target.value)}
                                  placeholder="/api"
                                  className={errors.some(e => e.field === 'basePath') ? 'border-destructive' : ''}
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label>Target Endpoint</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Backend service URL where requests are forwarded. Must be a valid HTTP or HTTPS URL.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <Input
                                  value={proxy.targetEndpoint}
                                  onChange={(e) => updateProxy(index, 'targetEndpoint', e.target.value)}
                                  placeholder="https://api.internal"
                                  className={errors.some(e => e.field === 'targetEndpoint') ? 'border-destructive' : ''}
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label>Quota (requests)</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Maximum number of requests allowed per quota interval. Set to 0 to disable quota limiting.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <Input
                                  type="number"
                                  value={proxy.quota || 0}
                                  onChange={(e) => updateProxy(index, 'quota', Number(e.target.value))}
                                  className={errors.some(e => e.field === 'quota') ? 'border-destructive' : ''}
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label>Quota Interval (seconds)</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Time window in seconds for quota calculation. The quota limit applies to this time period.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <Input
                                  type="number"
                                  value={proxy.quotaInterval || 60}
                                  onChange={(e) => updateProxy(index, 'quotaInterval', Number(e.target.value))}
                                  className={errors.some(e => e.field === 'quotaInterval') ? 'border-destructive' : ''}
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label>Spike Arrest (req/sec)</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Maximum requests per second allowed. Prevents traffic spikes by smoothing out request rate. Set to 0 to disable.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <Input
                                  type="number"
                                  value={proxy.spikeArrest || 0}
                                  onChange={(e) => updateProxy(index, 'spikeArrest', Number(e.target.value))}
                                  className={errors.some(e => e.field === 'spikeArrest') ? 'border-destructive' : ''}
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Label>Enable OAuth</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Enable OAuth 2.0 authentication for this proxy. Requires valid OAuth tokens for API access.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <Switch
                                  checked={proxy.enableOAuth || false}
                                  onCheckedChange={(checked) => updateProxy(index, 'enableOAuth', checked)}
                                />
                              </div>
                            </div>
                            {proxy.enableOAuth && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label>JWT Issuer</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>JWT token issuer identifier. Used to validate JWT tokens issued by this OAuth provider.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <Input
                                  value={proxy.jwtIssuer || ''}
                                  onChange={(e) => updateProxy(index, 'jwtIssuer', e.target.value)}
                                  placeholder="auth.archi"
                                />
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
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
                    <CardDescription>Configure API proxy policies</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreatePolicy(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Policy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search and filters */}
                {policies.length > 0 && (
                  <div className="space-y-3 pb-4 border-b mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search policies by name, type, or condition..."
                        value={policySearchQuery}
                        onChange={(e) => setPolicySearchQuery(e.target.value)}
                        className="pl-9"
                      />
                      {policySearchQuery && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                          onClick={() => setPolicySearchQuery('')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Select value={policyTypeFilter} onValueChange={setPolicyTypeFilter}>
                        <SelectTrigger className="w-[180px]">
                          <Filter className="h-4 w-4 mr-2" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="quota">Quota</SelectItem>
                          <SelectItem value="spike-arrest">Spike Arrest</SelectItem>
                          <SelectItem value="verify-api-key">Verify API Key</SelectItem>
                          <SelectItem value="oauth">OAuth</SelectItem>
                          <SelectItem value="jwt">JWT</SelectItem>
                          <SelectItem value="cors">CORS</SelectItem>
                          <SelectItem value="xml-to-json">XML to JSON</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={policyFlowFilter} onValueChange={setPolicyFlowFilter}>
                        <SelectTrigger className="w-[180px]">
                          <Filter className="h-4 w-4 mr-2" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Flows</SelectItem>
                          <SelectItem value="PreFlow">PreFlow</SelectItem>
                          <SelectItem value="RequestFlow">RequestFlow</SelectItem>
                          <SelectItem value="ResponseFlow">ResponseFlow</SelectItem>
                          <SelectItem value="PostFlow">PostFlow</SelectItem>
                          <SelectItem value="ErrorFlow">ErrorFlow</SelectItem>
                        </SelectContent>
                      </Select>
                      {(policySearchQuery || policyTypeFilter !== 'all' || policyFlowFilter !== 'all') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPolicySearchQuery('');
                            setPolicyTypeFilter('all');
                            setPolicyFlowFilter('all');
                          }}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Clear Filters
                        </Button>
                      )}
                    </div>
                    {filteredPolicies.length !== policies.length && (
                      <p className="text-xs text-muted-foreground">
                        Showing {filteredPolicies.length} of {policies.length} policies
                      </p>
                    )}
                  </div>
                )}
                {showCreatePolicy && (
                  <Card className="mb-4 border-l-4 border-l-blue-500">
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Label className="text-sm font-semibold">Policy Type</Label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm">
                                  <p>The policy type determines its functionality and cannot be changed after creation. Each policy type has specific configuration options and execution behavior.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            Select the type of policy to add. The type determines the policy's functionality and cannot be changed after creation.
                          </p>
                          <Select
                            value={newPolicyType}
                            onValueChange={(value: any) => setNewPolicyType(value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="quota">
                                <div>
                                  <div className="font-medium">Quota Policy</div>
                                  <div className="text-xs text-muted-foreground">Limit total requests per time period</div>
                                </div>
                              </SelectItem>
                              <SelectItem value="spike-arrest">
                                <div>
                                  <div className="font-medium">Spike Arrest Policy</div>
                                  <div className="text-xs text-muted-foreground">Smooth traffic spikes by rate limiting</div>
                                </div>
                              </SelectItem>
                              <SelectItem value="verify-api-key">
                                <div>
                                  <div className="font-medium">Verify API Key</div>
                                  <div className="text-xs text-muted-foreground">Validate API keys in requests</div>
                                </div>
                              </SelectItem>
                              <SelectItem value="oauth">
                                <div>
                                  <div className="font-medium">OAuth Policy</div>
                                  <div className="text-xs text-muted-foreground">OAuth 2.0 authentication and authorization</div>
                                </div>
                              </SelectItem>
                              <SelectItem value="jwt">
                                <div>
                                  <div className="font-medium">JWT Policy</div>
                                  <div className="text-xs text-muted-foreground">JWT token validation and verification</div>
                                </div>
                              </SelectItem>
                              <SelectItem value="cors">
                                <div>
                                  <div className="font-medium">CORS Policy</div>
                                  <div className="text-xs text-muted-foreground">Cross-origin resource sharing configuration</div>
                                </div>
                              </SelectItem>
                              <SelectItem value="xml-to-json">
                                <div>
                                  <div className="font-medium">XML to JSON</div>
                                  <div className="text-xs text-muted-foreground">Transform XML responses to JSON format</div>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={addPolicy} size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Create Policy
                          </Button>
                          <Button variant="outline" onClick={() => setShowCreatePolicy(false)} size="sm">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {policies.length === 0 && !showCreatePolicy ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No policies configured</p>
                ) : filteredPolicies.length === 0 && !showCreatePolicy ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {policySearchQuery || policyTypeFilter !== 'all' || policyFlowFilter !== 'all'
                      ? 'No policies match your filters'
                      : 'No policies configured'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredPolicies.map((policy: Policy) => {
                      const isEditing = editingPolicyId === policy.id;
                      const policyConfig = policy.config || {};
                      return (
                        <Card key={policy.id} className="border-l-4 border-l-green-500">
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" title="Policy type - determines functionality and cannot be changed">
                                    {policy.type}
                                  </Badge>
                                  {isEditing ? (
                                    <Input
                                      value={policy.name}
                                      onChange={(e) => updatePolicy(policy.id, 'name', e.target.value)}
                                      className="h-8 font-medium w-48"
                                      placeholder="Policy name"
                                    />
                                  ) : (
                                    <span className="font-medium">{policy.name}</span>
                                  )}
                                  {policy.enabled ? (
                                    <Badge variant="default">Enabled</Badge>
                                  ) : (
                                    <Badge variant="outline">Disabled</Badge>
                                  )}
                                  {policy.executionFlow && (
                                    <Badge variant="secondary" className="text-xs">
                                      {policy.executionFlow}
                                    </Badge>
                                  )}
                                </div>
                                {!isEditing && (
                                  <div className="text-xs text-muted-foreground mb-2">
                                    <span className="font-medium">Type:</span> {policy.type} 
                                    {policy.executionFlow && ` • Execution: ${policy.executionFlow}`}
                                    {policy.condition && ` • Condition: ${policy.condition}`}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={policy.enabled}
                                  onCheckedChange={(checked) => updatePolicy(policy.id, 'enabled', checked)}
                                />
                                {isEditing ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditingPolicyId(null);
                                        toast({
                                          title: 'Policy Updated',
                                          description: `Configuration for "${policy.name}" has been saved`,
                                        });
                                      }}
                                    >
                                      Done
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => {
                                        removePolicy(policy.id);
                                        setEditingPolicyId(null);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setEditingPolicyId(policy.id)}
                                      title="Edit policy configuration"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removePolicy(policy.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="mt-3 pt-3 border-t">
                              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                                <div>
                                  <div className="flex items-center gap-1 mb-1">
                                    <Label className="text-xs">Execution Flow</Label>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <div className="space-y-1 text-xs">
                                            <p><strong>PreFlow:</strong> Authentication policies (OAuth, JWT, API Key)</p>
                                            <p><strong>RequestFlow:</strong> Quota and rate limiting policies</p>
                                            <p><strong>ResponseFlow:</strong> Response transformation policies</p>
                                            <p><strong>PostFlow:</strong> CORS and final transformations</p>
                                            <p><strong>ErrorFlow:</strong> Error handling policies</p>
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                  <Select
                                    value={policy.executionFlow || 'RequestFlow'}
                                    onValueChange={(value) => updatePolicy(policy.id, 'executionFlow', value)}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="PreFlow">PreFlow (Auth)</SelectItem>
                                      <SelectItem value="RequestFlow">RequestFlow (Quota/Rate Limit)</SelectItem>
                                      <SelectItem value="ResponseFlow">ResponseFlow (Response Transform)</SelectItem>
                                      <SelectItem value="PostFlow">PostFlow (Transform/CORS)</SelectItem>
                                      <SelectItem value="ErrorFlow">ErrorFlow (Error Handling)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <div className="flex items-center gap-1 mb-1">
                                    <Label className="text-xs">Condition (optional)</Label>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Conditional expression to determine when this policy executes. Examples: request.path = '/api', request.verb = 'GET'</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                  <Input
                                    value={policy.condition || ''}
                                    onChange={(e) => updatePolicy(policy.id, 'condition', e.target.value)}
                                    placeholder="e.g., request.path = '/api'"
                                    className="h-8 text-xs"
                                  />
                                </div>
                              </div>
                              
                              {/* Policy-specific configuration - shown only when editing */}
                              {isEditing && (
                                <div className="mt-4 pt-4 border-t space-y-4">
                                  {policy.type === 'quota' && (
                                    <>
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Label className="text-xs">Allow Count</Label>
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Maximum number of requests allowed in the time interval.</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </div>
                                        <Input
                                          type="number"
                                          min="1"
                                          value={policyConfig.quota || policyConfig.allowCount || ''}
                                          onChange={(e) => {
                                            const value = parseInt(e.target.value) || 0;
                                            updatePolicy(policy.id, 'config', { ...policyConfig, quota: value, allowCount: value });
                                          }}
                                          placeholder="1000"
                                          className="h-8 text-xs"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Label className="text-xs">Interval (seconds)</Label>
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Time window in seconds for the quota limit.</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </div>
                                        <Input
                                          type="number"
                                          min="1"
                                          value={policyConfig.interval || policyConfig.quotaInterval || ''}
                                          onChange={(e) => {
                                            const value = parseInt(e.target.value) || 0;
                                            updatePolicy(policy.id, 'config', { ...policyConfig, interval: value, quotaInterval: value });
                                          }}
                                          placeholder="60"
                                          className="h-8 text-xs"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Label className="text-xs">Time Unit</Label>
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Time unit for the quota interval (seconds, minutes, hours, days).</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </div>
                                        <Select
                                          value={policyConfig.timeUnit || 'second'}
                                          onValueChange={(value) => updatePolicy(policy.id, 'config', { ...policyConfig, timeUnit: value })}
                                        >
                                          <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="second">Second</SelectItem>
                                            <SelectItem value="minute">Minute</SelectItem>
                                            <SelectItem value="hour">Hour</SelectItem>
                                            <SelectItem value="day">Day</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Switch
                                          checked={policyConfig.distributed || false}
                                          onCheckedChange={(checked) => updatePolicy(policy.id, 'config', { ...policyConfig, distributed: checked })}
                                        />
                                        <Label className="text-xs">Distributed</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Switch
                                          checked={policyConfig.synchronized || false}
                                          onCheckedChange={(checked) => updatePolicy(policy.id, 'config', { ...policyConfig, synchronized: checked })}
                                        />
                                        <Label className="text-xs">Synchronized</Label>
                                      </div>
                                    </>
                                  )}

                                  {policy.type === 'spike-arrest' && (
                                    <>
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Label className="text-xs">Rate (requests per time unit)</Label>
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Maximum number of requests allowed per time unit.</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </div>
                                        <Input
                                          type="number"
                                          min="1"
                                          value={policyConfig.rate || ''}
                                          onChange={(e) => {
                                            const value = parseInt(e.target.value) || 0;
                                            updatePolicy(policy.id, 'config', { ...policyConfig, rate: value });
                                          }}
                                          placeholder="10"
                                          className="h-8 text-xs"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Label className="text-xs">Time Unit</Label>
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Time unit for the rate limit (second, minute).</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </div>
                                        <Select
                                          value={policyConfig.timeUnit || 'second'}
                                          onValueChange={(value) => updatePolicy(policy.id, 'config', { ...policyConfig, timeUnit: value })}
                                        >
                                          <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="second">Per Second</SelectItem>
                                            <SelectItem value="minute">Per Minute</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </>
                                  )}

                                  {policy.type === 'oauth' && (
                                    <>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Token Endpoint</Label>
                                        <Input
                                          value={policyConfig.tokenEndpoint || ''}
                                          onChange={(e) => updatePolicy(policy.id, 'config', { ...policyConfig, tokenEndpoint: e.target.value })}
                                          placeholder="https://oauth.example.com/token"
                                          className="h-8 text-xs"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Client ID</Label>
                                        <Input
                                          value={policyConfig.clientId || ''}
                                          onChange={(e) => updatePolicy(policy.id, 'config', { ...policyConfig, clientId: e.target.value })}
                                          placeholder="client-id"
                                          className="h-8 text-xs"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Client Secret</Label>
                                        <Input
                                          type="password"
                                          value={policyConfig.clientSecret || ''}
                                          onChange={(e) => updatePolicy(policy.id, 'config', { ...policyConfig, clientSecret: e.target.value })}
                                          placeholder="client-secret"
                                          className="h-8 text-xs"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Scopes (comma-separated)</Label>
                                        <Input
                                          value={Array.isArray(policyConfig.scopes) ? policyConfig.scopes.join(', ') : (policyConfig.scopes || '')}
                                          onChange={(e) => {
                                            const scopes = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                                            updatePolicy(policy.id, 'config', { ...policyConfig, scopes });
                                          }}
                                          placeholder="read, write"
                                          className="h-8 text-xs"
                                        />
                                      </div>
                                    </>
                                  )}

                                  {policy.type === 'jwt' && (
                                    <>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Issuer</Label>
                                        <Input
                                          value={policyConfig.issuer || ''}
                                          onChange={(e) => updatePolicy(policy.id, 'config', { ...policyConfig, issuer: e.target.value })}
                                          placeholder="https://jwt.example.com"
                                          className="h-8 text-xs"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Audience</Label>
                                        <Input
                                          value={policyConfig.audience || ''}
                                          onChange={(e) => updatePolicy(policy.id, 'config', { ...policyConfig, audience: e.target.value })}
                                          placeholder="api.example.com"
                                          className="h-8 text-xs"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Public Key</Label>
                                        <Textarea
                                          value={policyConfig.publicKey || ''}
                                          onChange={(e) => updatePolicy(policy.id, 'config', { ...policyConfig, publicKey: e.target.value })}
                                          placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
                                          rows={4}
                                          className="text-xs"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Algorithm</Label>
                                        <Select
                                          value={policyConfig.algorithm || 'RS256'}
                                          onValueChange={(value) => updatePolicy(policy.id, 'config', { ...policyConfig, algorithm: value })}
                                        >
                                          <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="RS256">RS256</SelectItem>
                                            <SelectItem value="HS256">HS256</SelectItem>
                                            <SelectItem value="ES256">ES256</SelectItem>
                                            <SelectItem value="RS384">RS384</SelectItem>
                                            <SelectItem value="HS384">HS384</SelectItem>
                                            <SelectItem value="ES384">ES384</SelectItem>
                                            <SelectItem value="RS512">RS512</SelectItem>
                                            <SelectItem value="HS512">HS512</SelectItem>
                                            <SelectItem value="ES512">ES512</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </>
                                  )}

                                  {policy.type === 'verify-api-key' && (
                                    <>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Key Name</Label>
                                        <Input
                                          value={policyConfig.keyName || 'X-API-Key'}
                                          onChange={(e) => updatePolicy(policy.id, 'config', { ...policyConfig, keyName: e.target.value })}
                                          placeholder="X-API-Key"
                                          className="h-8 text-xs"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Location</Label>
                                        <Select
                                          value={policyConfig.location || 'header'}
                                          onValueChange={(value) => updatePolicy(policy.id, 'config', { ...policyConfig, location: value })}
                                        >
                                          <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="header">Header</SelectItem>
                                            <SelectItem value="query">Query Parameter</SelectItem>
                                            <SelectItem value="headerOrQuery">Header or Query</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </>
                                  )}

                                  {policy.type === 'cors' && (
                                    <>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Allowed Origins (comma-separated)</Label>
                                        <Input
                                          value={Array.isArray(policyConfig.origins) ? policyConfig.origins.join(', ') : (policyConfig.origins || '*')}
                                          onChange={(e) => {
                                            const origins = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                                            updatePolicy(policy.id, 'config', { ...policyConfig, origins });
                                          }}
                                          placeholder="https://example.com"
                                          className="h-8 text-xs"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Allowed Methods (comma-separated)</Label>
                                        <Input
                                          value={Array.isArray(policyConfig.methods) ? policyConfig.methods.join(', ') : (policyConfig.methods || 'GET, POST, PUT, DELETE')}
                                          onChange={(e) => {
                                            const methods = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                                            updatePolicy(policy.id, 'config', { ...policyConfig, methods });
                                          }}
                                          placeholder="GET, POST, PUT, DELETE"
                                          className="h-8 text-xs"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Allowed Headers (comma-separated)</Label>
                                        <Input
                                          value={Array.isArray(policyConfig.headers) ? policyConfig.headers.join(', ') : (policyConfig.headers || 'Content-Type, Authorization')}
                                          onChange={(e) => {
                                            const headers = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                                            updatePolicy(policy.id, 'config', { ...policyConfig, headers });
                                          }}
                                          placeholder="Content-Type, Authorization"
                                          className="h-8 text-xs"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Max Age (seconds)</Label>
                                        <Input
                                          type="number"
                                          min="0"
                                          value={policyConfig.maxAge || '3600'}
                                          onChange={(e) => {
                                            const value = parseInt(e.target.value) || 0;
                                            updatePolicy(policy.id, 'config', { ...policyConfig, maxAge: value });
                                          }}
                                          placeholder="3600"
                                          className="h-8 text-xs"
                                        />
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Switch
                                          checked={policyConfig.allowCredentials || false}
                                          onCheckedChange={(checked) => updatePolicy(policy.id, 'config', { ...policyConfig, allowCredentials: checked })}
                                        />
                                        <Label className="text-xs">Allow Credentials</Label>
                                      </div>
                                    </>
                                  )}

                                  {policy.type === 'xml-to-json' && (
                                    <>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Options</Label>
                                        <Textarea
                                          value={typeof policyConfig.options === 'string' ? policyConfig.options : JSON.stringify(policyConfig.options || {}, null, 2)}
                                          onChange={(e) => {
                                            try {
                                              const parsed = JSON.parse(e.target.value);
                                              updatePolicy(policy.id, 'config', { ...policyConfig, options: parsed });
                                            } catch {
                                              updatePolicy(policy.id, 'config', { ...policyConfig, options: e.target.value });
                                            }
                                          }}
                                          placeholder='{"attributePrefix": "@", "textNode": "$t"}'
                                          rows={4}
                                          className="text-xs"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Attributes</Label>
                                        <Select
                                          value={policyConfig.attributes || 'prefix'}
                                          onValueChange={(value) => updatePolicy(policy.id, 'config', { ...policyConfig, attributes: value })}
                                        >
                                          <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="prefix">Prefix (@attribute)</SelectItem>
                                            <SelectItem value="ignore">Ignore</SelectItem>
                                            <SelectItem value="preserve">Preserve</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs">Namespaces</Label>
                                        <Select
                                          value={policyConfig.namespaces || 'prefix'}
                                          onValueChange={(value) => updatePolicy(policy.id, 'config', { ...policyConfig, namespaces: value })}
                                        >
                                          <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="prefix">Prefix (ns:element)</SelectItem>
                                            <SelectItem value="ignore">Ignore</SelectItem>
                                            <SelectItem value="preserve">Preserve</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </>
                                  )}
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

          <TabsContent value="products" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>API Products</CardTitle>
                    <CardDescription>Group proxies together for access control and quota management</CardDescription>
                  </div>
                  <Button onClick={addProduct} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Product
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Search */}
                  {products.length > 0 && (
                    <div className="space-y-3 pb-4 border-b">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search products by name, display name, or description..."
                          value={productSearchQuery}
                          onChange={(e) => setProductSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                        {productSearchQuery && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                            onClick={() => setProductSearchQuery('')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {filteredProducts.length !== products.length && (
                        <p className="text-xs text-muted-foreground">
                          Showing {filteredProducts.length} of {products.length} products
                        </p>
                      )}
                    </div>
                  )}
                  {products.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No products configured. Create your first product to group proxies together.
                    </p>
                  ) : filteredProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {productSearchQuery ? 'No products match your search' : 'No products configured'}
                    </p>
                  ) : (
                    filteredProducts.map((product: APIProduct) => {
                      const productProxies = proxies.filter((p: APIProxy) => (product.proxies || []).includes(p.name));
                      return (
                        <Card key={product.id} className="border-l-4 border-l-orange-500">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Package className="h-5 w-5 text-orange-500" />
                                  {editingProductId === product.id ? (
                                    <Input
                                      value={product.displayName || product.name}
                                      onChange={(e) => updateProduct(product.id, 'displayName', e.target.value)}
                                      onBlur={() => setEditingProductId(null)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          setEditingProductId(null);
                                        }
                                      }}
                                      className="font-semibold text-base"
                                      autoFocus
                                    />
                                  ) : (
                                    <CardTitle 
                                      className="text-base cursor-pointer hover:text-primary transition-colors"
                                      onClick={() => setEditingProductId(product.id)}
                                    >
                                      {product.displayName || product.name}
                                    </CardTitle>
                                  )}
                                  <Badge variant="outline">{(product.proxies || []).length} {(product.proxies || []).length === 1 ? 'proxy' : 'proxies'}</Badge>
                                </div>
                                {product.description && (
                                  <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeProduct(product.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label>Product Name</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Unique identifier for the API product. Used internally for product identification.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <Input
                                  value={product.name}
                                  onChange={(e) => updateProduct(product.id, 'name', e.target.value)}
                                  placeholder="product-name"
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label>Display Name</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Human-readable name for the API product. Shown in developer portals and dashboards.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <Input
                                  value={product.displayName || ''}
                                  onChange={(e) => updateProduct(product.id, 'displayName', e.target.value)}
                                  placeholder="Product Display Name"
                                />
                              </div>
                              <div className="space-y-2 col-span-2">
                                <div className="flex items-center gap-2">
                                  <Label>Description</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Description of the API product. Helps developers understand what APIs are included in this product.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <Input
                                  value={product.description || ''}
                                  onChange={(e) => updateProduct(product.id, 'description', e.target.value)}
                                  placeholder="Product description"
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label>Quota (requests)</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Product-level quota limit. Maximum requests allowed per quota interval for all proxies in this product.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <Input
                                  type="number"
                                  value={product.quota || 0}
                                  onChange={(e) => updateProduct(product.id, 'quota', Number(e.target.value))}
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label>Quota Interval (seconds)</Label>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Time window in seconds for product-level quota calculation.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <Input
                                  type="number"
                                  value={product.quotaInterval || 60}
                                  onChange={(e) => updateProduct(product.id, 'quotaInterval', Number(e.target.value))}
                                />
                              </div>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Label>Environments</Label>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Environments where this product is available. Proxies in this product must be deployed to these environments.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                {(['dev', 'stage', 'prod'] as const).map((env) => {
                                  const isChecked = product.environments?.includes(env) || false;
                                  return (
                                    <div key={env} className="flex items-center gap-2">
                                      <Checkbox
                                        id={`product-${product.id}-env-${env}`}
                                        checked={isChecked}
                                        onCheckedChange={(checked) => {
                                          const currentEnvs = product.environments || [];
                                          const newEnvs = checked
                                            ? [...currentEnvs, env]
                                            : currentEnvs.filter((e: 'dev' | 'stage' | 'prod') => e !== env);
                                          updateProduct(product.id, 'environments', newEnvs);
                                        }}
                                      />
                                      <Label 
                                        htmlFor={`product-${product.id}-env-${env}`}
                                        className="text-sm font-normal cursor-pointer"
                                      >
                                        {env}
                                      </Label>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Label>Associated Proxies</Label>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Select which API proxies are included in this product. Proxies can belong to multiple products.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              {proxies.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No proxies available. Create proxies first.</p>
                              ) : (
                                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                                  {proxies.map((proxy: APIProxy) => {
                                    const isChecked = (product.proxies || []).includes(proxy.name);
                                    return (
                                      <div key={proxy.name} className="flex items-center gap-2">
                                        <Checkbox
                                          id={`product-${product.id}-proxy-${proxy.name}`}
                                          checked={isChecked}
                                          onCheckedChange={(checked) => {
                                            const currentProxies = product.proxies || [];
                                            const newProxies = checked
                                              ? [...currentProxies, proxy.name]
                                              : currentProxies.filter((p: string) => p !== proxy.name);
                                            updateProduct(product.id, 'proxies', newProxies);
                                          }}
                                        />
                                        <Label 
                                          htmlFor={`product-${product.id}-proxy-${proxy.name}`}
                                          className="text-sm font-normal flex-1 cursor-pointer"
                                        >
                                          {proxy.name}
                                        </Label>
                                        <Badge variant="outline" className="text-xs">{proxy.environment}</Badge>
                                        {proxy.status === 'deployed' || !proxy.status ? (
                                          <Badge variant="default" className="text-xs">Deployed</Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-xs">Undeployed</Badge>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              {productProxies.length > 0 && (
                                <div className="mt-2 p-2 bg-muted rounded-md">
                                  <p className="text-xs text-muted-foreground mb-1">Selected proxies:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {productProxies.map((proxy: APIProxy) => (
                                      <Badge key={proxy.name} variant="secondary" className="text-xs">
                                        {proxy.name}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="developer-apps" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Developer Apps</CardTitle>
                    <CardDescription>Manage developer applications and API keys</CardDescription>
                  </div>
                  <Button onClick={addDeveloperApp} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create App
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Search and filters */}
                  {developerApps.length > 0 && (
                    <div className="space-y-3 pb-4 border-b">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search apps by name, email..."
                          value={appSearchQuery}
                          onChange={(e) => setAppSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <Select value={appStatusFilter} onValueChange={setAppStatusFilter}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="revoked">Revoked</SelectItem>
                          </SelectContent>
                        </Select>
                        {(appSearchQuery || appStatusFilter !== 'all') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAppSearchQuery('');
                              setAppStatusFilter('all');
                            }}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Clear
                          </Button>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Showing {filteredDeveloperApps.length} of {developerApps.length} apps
                      </div>
                    </div>
                  )}

                  {filteredDeveloperApps.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {developerApps.length === 0 ? (
                        <>
                          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No developer apps yet</p>
                          <p className="text-sm mt-2">Create your first developer app to start managing API keys</p>
                        </>
                      ) : (
                        <p>No apps match your search criteria</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredDeveloperApps.map((app: DeveloperApp) => {
                        const isEditing = editingAppId === app.id;
                        const statusColors: Record<string, string> = {
                          approved: 'bg-green-500',
                          pending: 'bg-yellow-500',
                          revoked: 'bg-red-500',
                        };
                        
                        return (
                          <Card key={app.id} className="relative">
                            <CardHeader>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <CardTitle className="text-base">
                                      {isEditing ? (
                                        <Input
                                          value={app.displayName || app.name}
                                          onChange={(e) => updateDeveloperApp(app.id, 'displayName', e.target.value)}
                                          className="h-8 font-semibold"
                                          placeholder="App Display Name"
                                        />
                                      ) : (
                                        app.displayName || app.name
                                      )}
                                    </CardTitle>
                                    <Badge
                                      variant="outline"
                                      className={`${statusColors[app.status || 'pending']} text-white border-0`}
                                    >
                                      {app.status || 'pending'}
                                    </Badge>
                                  </div>
                                  {isEditing && (
                                    <div className="space-y-2 mt-2">
                                      <div>
                                        <Label className="text-xs">App Name</Label>
                                        <Input
                                          value={app.name}
                                          onChange={(e) => updateDeveloperApp(app.id, 'name', e.target.value)}
                                          className="h-8 text-xs"
                                          placeholder="app-name"
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-xs">Developer Email</Label>
                                        <Input
                                          type="email"
                                          value={app.developerEmail || ''}
                                          onChange={(e) => updateDeveloperApp(app.id, 'developerEmail', e.target.value)}
                                          className="h-8 text-xs"
                                          placeholder="developer@example.com"
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-xs">Description</Label>
                                        <Input
                                          value={app.description || ''}
                                          onChange={(e) => updateDeveloperApp(app.id, 'description', e.target.value)}
                                          className="h-8 text-xs"
                                          placeholder="App description"
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-xs">Status</Label>
                                        <Select
                                          value={app.status || 'pending'}
                                          onValueChange={(value) => updateDeveloperApp(app.id, 'status', value)}
                                        >
                                          <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="approved">Approved</SelectItem>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="revoked">Revoked</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  )}
                                  {!isEditing && app.description && (
                                    <CardDescription className="mt-1">{app.description}</CardDescription>
                                  )}
                                  {!isEditing && app.developerEmail && (
                                    <p className="text-sm text-muted-foreground mt-1">{app.developerEmail}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {isEditing ? (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditingAppId(null)}
                                      >
                                        Done
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => {
                                          removeDeveloperApp(app.id);
                                          setEditingAppId(null);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditingAppId(app.id)}
                                      >
                                        Edit
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => removeDeveloperApp(app.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-4">
                                {/* API Products */}
                                <div>
                                  <Label className="text-sm font-medium mb-2 block">API Products</Label>
                                  <div className="space-y-2">
                                    {products.length === 0 ? (
                                      <p className="text-sm text-muted-foreground">No products available</p>
                                    ) : (
                                      products.map((product: APIProduct) => {
                                        const isChecked = (app.apiProducts || []).includes(product.id);
                                        return (
                                          <div key={product.id} className="flex items-center space-x-2">
                                            <Checkbox
                                              id={`app-${app.id}-product-${product.id}`}
                                              checked={isChecked}
                                              onCheckedChange={() => toggleAppProduct(app.id, product.id)}
                                            />
                                            <Label
                                              htmlFor={`app-${app.id}-product-${product.id}`}
                                              className="text-sm font-normal cursor-pointer"
                                            >
                                              {product.displayName || product.name}
                                            </Label>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>

                                <Separator />

                                {/* API Keys */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <Label className="text-sm font-medium">API Keys ({(app.keys || []).length})</Label>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => addAppKey(app.id)}
                                    >
                                      <Key className="h-4 w-4 mr-1" />
                                      Add Key
                                    </Button>
                                  </div>
                                  <div className="space-y-2">
                                    {(app.keys || []).length === 0 ? (
                                      <p className="text-sm text-muted-foreground">No API keys</p>
                                    ) : (
                                      (app.keys || []).map((key: DeveloperAppKey) => {
                                        const usageMetrics = getKeyUsageMetrics(key.key);
                                        const isVisible = visibleKeys.has(key.id);
                                        const toggleVisibility = () => {
                                          setVisibleKeys(prev => {
                                            const newSet = new Set(prev);
                                            if (newSet.has(key.id)) {
                                              newSet.delete(key.id);
                                            } else {
                                              newSet.add(key.id);
                                            }
                                            return newSet;
                                          });
                                        };
                                        const displayKey = isVisible ? key.key : '•'.repeat(Math.min(key.key.length, 20));
                                        return (
                                          <Card key={key.id} className="p-3">
                                            <div className="flex items-start justify-between">
                                              <div className="flex-1 space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all">
                                                      {displayKey}
                                                    </code>
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      className="h-6 w-6 p-0 flex-shrink-0"
                                                      onClick={toggleVisibility}
                                                      title={isVisible ? 'Hide key' : 'Show key'}
                                                    >
                                                      {isVisible ? (
                                                        <EyeOff className="h-4 w-4" />
                                                      ) : (
                                                        <Eye className="h-4 w-4" />
                                                      )}
                                                    </Button>
                                                  </div>
                                                  <Badge
                                                    variant="outline"
                                                    className={key.status === 'approved' ? 'bg-green-500 text-white border-0' : 'bg-red-500 text-white border-0'}
                                                  >
                                                    {key.status || 'approved'}
                                                  </Badge>
                                                </div>
                                                {usageMetrics && (
                                                  <div className="text-xs text-muted-foreground mt-1">
                                                    <span>Requests: {usageMetrics.requestCount.toLocaleString()}</span>
                                                    {usageMetrics.lastUsed > 0 && (
                                                      <span className="ml-2">
                                                        Last used: {new Date(usageMetrics.lastUsed).toLocaleString()}
                                                      </span>
                                                    )}
                                                  </div>
                                                )}
                                                {key.expiresAt && (
                                                  <div className="text-xs text-muted-foreground">
                                                    Expires: {new Date(key.expiresAt).toLocaleDateString()}
                                                  </div>
                                                )}
                                              </div>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => removeAppKey(app.id, key.id)}
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </div>
                                          </Card>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>API Analytics</CardTitle>
                <CardDescription>Monitor API proxy performance and usage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {proxies.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No proxies to monitor</p>
                  ) : (
                    proxies.map((proxy: APIProxy, index: number) => (
                      <Card key={index} className="border-l-4 border-l-purple-500">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">{proxy.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Total Requests</p>
                              <p className="text-2xl font-bold">{(proxy.requestCount || 0).toLocaleString()}</p>
                              <Progress
                                value={Math.min(((proxy.requestCount || 0) / 10000) * 100, 100)}
                                className="h-2 mt-2"
                              />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Errors</p>
                              <p className="text-2xl font-bold text-red-500">{(proxy.errorCount || 0).toLocaleString()}</p>
                              <Progress
                                value={Math.min(((proxy.errorCount || 0) / 100) * 100, 100)}
                                className="h-2 mt-2"
                              />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Avg Response Time</p>
                              <p className="text-2xl font-bold">{(proxy.avgResponseTime || 0).toFixed(0)} ms</p>
                              <Progress
                                value={Math.min(((proxy.avgResponseTime || 0) / 1000) * 100, 100)}
                                className="h-2 mt-2"
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Apigee Settings</CardTitle>
                <CardDescription>Configure organization and API access</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Organization</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Apigee organization name. This identifies your organization in the Apigee platform.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    value={organization}
                    onChange={(e) => updateConfig({ organization: e.target.value })}
                    placeholder="my-organization"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Active Environment</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Active environment for viewing and managing configuration. New proxies will be created in this environment. Use the environment selector at the top to switch environments.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select
                    value={environment}
                    onValueChange={(value) => {
                      updateConfig({ environment: value });
                      toast({
                        title: 'Environment Switched',
                        description: `Switched to ${value.toUpperCase()} environment`,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dev">Development</SelectItem>
                      <SelectItem value="stage">Staging</SelectItem>
                      <SelectItem value="prod">Production</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    This environment is used for viewing configuration and creating new proxies. Proxies can be deployed to different environments.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>API Key</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Apigee API key for authentication. Used to authenticate API calls to Apigee management APIs.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => updateConfig({ apiKey: e.target.value })}
                    placeholder="Enter Apigee API key"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

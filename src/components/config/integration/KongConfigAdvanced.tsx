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
import { Progress } from '@/components/ui/progress';
import { useState, useEffect, useRef } from 'react';
import { 
  Network, 
  Route as RouteIcon, 
  Settings, 
  Activity,
  Shield,
  Zap,
  Plus,
  Trash2,
  ArrowRightLeft,
  Lock,
  Users,
  Server,
  Gauge,
  Edit
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
import { showSuccess, showError } from '@/utils/toast';
import { useEmulationStore } from '@/store/useEmulationStore';
import { useComponentStateStore } from '@/store/useComponentStateStore';
import { useDependencyStore } from '@/store/useDependencyStore';
import { getComponentRuntimeStatus, getStatusBadgeVariant, getStatusDotColor } from '@/utils/componentStatus';
import { emulationEngine } from '@/core/EmulationEngine';
import {
  DEFAULT_KONG_VALUES,
  DEFAULT_SERVICE_VALUES,
  DEFAULT_ROUTE_VALUES,
  DEFAULT_UPSTREAM_VALUES,
  DEFAULT_CONSUMER_VALUES,
  DEFAULT_PLUGIN_VALUES,
  DEFAULT_PLUGINS,
  NAMING_RULES,
  VALIDATION_RANGES,
  METRICS_UPDATE_CONFIG,
} from '@/core/constants/kongGateway';

interface KongConfigProps {
  componentId: string;
}

interface Service {
  id: string;
  name: string;
  url: string;
  routes: number;
  enabled: boolean;
  upstream?: string;
  tags?: string[];
}

interface KongRoute {
  id: string;
  path: string;
  method: string;
  service: string;
  stripPath: boolean;
  protocols?: string[];
  priority?: number;
}

interface Upstream {
  id: string;
  name: string;
  algorithm?: 'round-robin' | 'consistent-hashing' | 'least-connections';
  healthchecks?: {
    active?: boolean;
    passive?: boolean;
    active_interval?: number;
    active_timeout?: number;
    active_http_path?: string;
    active_healthy_threshold?: number;
    active_unhealthy_threshold?: number;
    passive_healthy_status_codes?: number[];
    passive_unhealthy_status_codes?: number[];
    passive_healthy_threshold?: number;
    passive_unhealthy_threshold?: number;
  };
  targets?: UpstreamTarget[];
}

interface UpstreamTarget {
  target: string;
  weight?: number;
  health?: 'healthy' | 'unhealthy' | 'draining';
}

interface Consumer {
  id: string;
  username: string;
  customId?: string;
  tags?: string[];
  credentials?: ConsumerCredential[];
}

interface ConsumerCredential {
  type: 'key-auth' | 'jwt' | 'oauth2' | 'basic-auth';
  key?: string;
  secret?: string;
  algorithm?: string;
  rsaPublicKey?: string;
}

interface Plugin {
  id: string;
  name: string;
  enabled: boolean;
  service?: string;
  route?: string;
  consumer?: string;
  config?: Record<string, any>;
}

interface KongConfig {
  adminUrl?: string;
  serviceName?: string;
  upstreamUrl?: string;
  routePaths?: string[];
  stripPath?: boolean;
  authPlugin?: string;
  rateLimitPerMinute?: number;
  enableLogging?: boolean;
  loggingTarget?: string;
  services?: Service[];
  routes?: KongRoute[];
  upstreams?: Upstream[];
  consumers?: Consumer[];
  plugins?: Plugin[];
  requestsPerSecond?: number;
}

export function KongConfigAdvanced({ componentId }: KongConfigProps) {
  const { nodes, updateNode, connections } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;
  const { isRunning, getComponentMetrics } = useEmulationStore();
  const componentState = useComponentStateStore((state) => state.getComponentState(componentId));
  const dependencyStatus = useDependencyStore((state) => state.getComponentStatus(componentId));
  const metrics = isRunning ? getComponentMetrics(componentId) : undefined;
  const hasConnections = connections.some(conn => conn.source === componentId || conn.target === componentId);

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  // Get component runtime status
  const runtimeStatus = getComponentRuntimeStatus({
    isSimulationRunning: isRunning,
    componentState: componentState?.state,
    metrics,
    dependencyStatus,
    hasConnections,
  });

  const config = (node.data.config as any) || {} as KongConfig;
  const nodeRef = useRef(node);
  nodeRef.current = node;

  // Use constants for default values
  const adminUrl = config.adminUrl || DEFAULT_KONG_VALUES.ADMIN_URL;
  const serviceName = config.serviceName || DEFAULT_KONG_VALUES.SERVICE_NAME;
  const upstreamUrl = config.upstreamUrl || DEFAULT_KONG_VALUES.UPSTREAM_URL;
  const routePaths = config.routePaths || DEFAULT_KONG_VALUES.ROUTE_PATHS;
  const stripPath = config.stripPath ?? true;
  const authPlugin = config.authPlugin || DEFAULT_KONG_VALUES.AUTH_PLUGIN;
  const rateLimitPerMinute = config.rateLimitPerMinute || DEFAULT_KONG_VALUES.RATE_LIMIT_PER_MINUTE;
  const enableLogging = config.enableLogging ?? true;
  const loggingTarget = config.loggingTarget || DEFAULT_KONG_VALUES.LOGGING_TARGET;
  const services = config.services || [];
  const routes = config.routes || [];
  const upstreams = config.upstreams || [];
  const consumers = config.consumers || [];
  const plugins = config.plugins || DEFAULT_PLUGINS;
  const requestsPerSecond = config.requestsPerSecond || DEFAULT_KONG_VALUES.REQUESTS_PER_SECOND;

  const [editingUpstreamIndex, setEditingUpstreamIndex] = useState<number | null>(null);
  const [editingConsumerIndex, setEditingConsumerIndex] = useState<number | null>(null);
  const [editingPluginIndex, setEditingPluginIndex] = useState<number | null>(null);
  const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);
  const [showPluginTypeDialog, setShowPluginTypeDialog] = useState(false);
  
  // Form state for creating new items
  const [newTagInputs, setNewTagInputs] = useState<Record<number, string>>({});
  const [newPluginType, setNewPluginType] = useState('rate-limiting');
  
  // Delete confirmation dialogs
  const [deleteServiceIndex, setDeleteServiceIndex] = useState<number | null>(null);
  const [deleteRouteIndex, setDeleteRouteIndex] = useState<number | null>(null);
  const [deleteUpstreamIndex, setDeleteUpstreamIndex] = useState<number | null>(null);
  const [deleteConsumerIndex, setDeleteConsumerIndex] = useState<number | null>(null);
  const [deletePluginIndex, setDeletePluginIndex] = useState<number | null>(null);

  const updateConfig = (updates: Partial<KongConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  // Validation functions
  const validateName = (name: string, existingNames: string[]): string | null => {
    if (!name || name.trim().length === 0) {
      return 'Name cannot be empty';
    }
    if (name.length < NAMING_RULES.SERVICE_ROUTE_UPSTREAM_CONSUMER.MIN_LENGTH) {
      return `Name must be at least ${NAMING_RULES.SERVICE_ROUTE_UPSTREAM_CONSUMER.MIN_LENGTH} characters`;
    }
    if (name.length > NAMING_RULES.SERVICE_ROUTE_UPSTREAM_CONSUMER.MAX_LENGTH) {
      return `Name must be at most ${NAMING_RULES.SERVICE_ROUTE_UPSTREAM_CONSUMER.MAX_LENGTH} characters`;
    }
    if (!NAMING_RULES.SERVICE_ROUTE_UPSTREAM_CONSUMER.PATTERN.test(name)) {
      return 'Name can only contain alphanumeric characters, hyphens, and underscores';
    }
    if (existingNames.includes(name)) {
      return 'Name must be unique';
    }
    return null;
  };

  const validateUrl = (url: string): string | null => {
    if (!url || url.trim().length === 0) {
      return 'URL cannot be empty';
    }
    if (!NAMING_RULES.URL.PATTERN.test(url)) {
      return 'URL must start with http:// or https://';
    }
    return null;
  };

  const validatePath = (path: string): string | null => {
    if (!path || path.trim().length === 0) {
      return 'Path cannot be empty';
    }
    if (!NAMING_RULES.PATH.PATTERN.test(path)) {
      return 'Path must start with /';
    }
    return null;
  };

  const validateNumericField = (value: number, field: 'weight' | 'priority' | 'rateLimit' | 'requestsPerSecond'): string | null => {
    const range = field === 'weight' ? VALIDATION_RANGES.WEIGHT :
                  field === 'priority' ? VALIDATION_RANGES.PRIORITY :
                  field === 'rateLimit' ? VALIDATION_RANGES.RATE_LIMIT_PER_MINUTE :
                  VALIDATION_RANGES.REQUESTS_PER_SECOND;
    
    if (value < range.MIN || value > range.MAX) {
      return `Value must be between ${range.MIN} and ${range.MAX}`;
    }
    return null;
  };

  const addService = () => {
    // Generate unique name if needed
    let baseName = DEFAULT_SERVICE_VALUES.name;
    let counter = 1;
    let newServiceName = baseName;
    const existingNames = services.map((s: Service) => s.name);
    
    while (existingNames.includes(newServiceName)) {
      newServiceName = `${baseName}-${counter}`;
      counter++;
    }
    
    const validationError = validateName(newServiceName, existingNames);
    
    if (validationError) {
      showError(validationError);
      return;
    }

    const newService = {
      id: String(Date.now()),
      name: newServiceName,
      url: DEFAULT_SERVICE_VALUES.url,
      routes: 0,
      enabled: DEFAULT_SERVICE_VALUES.enabled,
    };
    
    const newServices = [...services, newService];
    updateConfig({
      services: newServices,
    });
    const newIndex = newServices.length - 1;
    setEditingServiceIndex(newIndex);
    showSuccess('Service created successfully');
  };

  const removeService = (index: number) => {
    const service = services[index];
    const routesUsingService = routes.filter((r: KongRoute) => r.service === service.name);
    
    if (routesUsingService.length > 0) {
      showError(`Cannot delete service: ${routesUsingService.length} route(s) are using it`);
      return;
    }
    
    updateConfig({ services: services.filter((_: Service, i: number) => i !== index) });
    showSuccess('Service deleted successfully');
  };

  const updateService = (index: number, field: keyof Service, value: string | boolean | string[] | undefined) => {
    const newServices = [...services];
    newServices[index] = { ...newServices[index], [field]: value };
    updateConfig({ services: newServices });
  };

  const addRoute = () => {
    if (services.length === 0) {
      showError('Please create at least one service before adding a route');
      return;
    }

    const newPath = DEFAULT_ROUTE_VALUES.path;
    const validationError = validatePath(newPath);
    
    if (validationError) {
      showError(validationError);
      return;
    }

    const newRoute = {
      id: String(Date.now()),
      path: newPath,
      method: DEFAULT_ROUTE_VALUES.method,
      service: services[0].name,
      stripPath: DEFAULT_ROUTE_VALUES.stripPath,
      priority: DEFAULT_ROUTE_VALUES.priority,
      protocols: DEFAULT_ROUTE_VALUES.protocols,
    };
    
    updateConfig({
      routes: [...routes, newRoute],
    });
    showSuccess('Route created successfully');
  };

  const removeRoute = (index: number) => {
    updateConfig({ routes: routes.filter((_: KongRoute, i: number) => i !== index) });
    showSuccess('Route deleted successfully');
  };

  const updateRoute = (index: number, field: string, value: string | boolean | number | string[]) => {
    const newRoutes = [...routes];
    newRoutes[index] = { ...newRoutes[index], [field]: value };
    updateConfig({ routes: newRoutes });
  };

  const addUpstream = () => {
    // Generate unique name if needed
    let baseName = DEFAULT_UPSTREAM_VALUES.name;
    let counter = 1;
    let name = baseName;
    const existingNames = upstreams.map((u: Upstream) => u.name);
    
    while (existingNames.includes(name)) {
      name = `${baseName}-${counter}`;
      counter++;
    }
    
    const validationError = validateName(name, existingNames);
    
    if (validationError) {
      showError(validationError);
      return;
    }

    const newUpstream: Upstream = {
      id: String(Date.now()),
      name: name,
      algorithm: DEFAULT_UPSTREAM_VALUES.algorithm,
      healthchecks: DEFAULT_UPSTREAM_VALUES.healthchecks,
      targets: DEFAULT_UPSTREAM_VALUES.targets.map(t => ({ ...t })),
    };
    
    const newUpstreams = [...upstreams, newUpstream];
    updateConfig({ upstreams: newUpstreams });
    const newIndex = newUpstreams.length - 1;
    setEditingUpstreamIndex(newIndex);
    showSuccess('Upstream created successfully');
  };

  const removeUpstream = (index: number) => {
    const upstream = upstreams[index];
    const servicesUsingUpstream = services.filter((s: Service) => s.upstream === upstream.name);
    
    if (servicesUsingUpstream.length > 0) {
      showError(`Cannot delete upstream: ${servicesUsingUpstream.length} service(s) are using it`);
      return;
    }
    
    updateConfig({ upstreams: upstreams.filter((_: Upstream, i: number) => i !== index) });
    showSuccess('Upstream deleted successfully');
  };

  const updateUpstream = (index: number, field: keyof Upstream, value: any) => {
    const updated = [...upstreams];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ upstreams: updated });
  };

  const addUpstreamTarget = (upstreamIndex: number) => {
    const updated = [...upstreams];
    if (!updated[upstreamIndex].targets) {
      updated[upstreamIndex].targets = [];
    }
    const newTarget = {
      target: DEFAULT_UPSTREAM_VALUES.targets[0].target,
      weight: DEFAULT_UPSTREAM_VALUES.targets[0].weight,
      health: DEFAULT_UPSTREAM_VALUES.targets[0].health,
    };
    updated[upstreamIndex].targets = [
      ...updated[upstreamIndex].targets,
      newTarget,
    ];
    updateConfig({ upstreams: updated });
  };

  const removeUpstreamTarget = (upstreamIndex: number, targetIndex: number) => {
    const updated = [...upstreams];
    updated[upstreamIndex].targets = updated[upstreamIndex].targets?.filter((_: UpstreamTarget, i: number) => i !== targetIndex);
    updateConfig({ upstreams: updated });
  };

  const addConsumer = () => {
    // Generate unique username if needed
    let baseUsername = DEFAULT_CONSUMER_VALUES.username;
    let counter = 1;
    let username = baseUsername;
    const existingUsernames = consumers.map((c: Consumer) => c.username);
    
    while (existingUsernames.includes(username)) {
      username = `${baseUsername}-${counter}`;
      counter++;
    }
    
    const validationError = validateName(username, existingUsernames);
    
    if (validationError) {
      showError(validationError);
      return;
    }

    const newConsumer: Consumer = {
      id: String(Date.now()),
      username: username,
      credentials: DEFAULT_CONSUMER_VALUES.credentials,
    };
    
    const newConsumers = [...consumers, newConsumer];
    updateConfig({ consumers: newConsumers });
    const newIndex = newConsumers.length - 1;
    setEditingConsumerIndex(newIndex);
    showSuccess('Consumer created successfully');
  };

  const removeConsumer = (index: number) => {
    updateConfig({ consumers: consumers.filter((_: Consumer, i: number) => i !== index) });
    showSuccess('Consumer deleted successfully');
  };

  const updateConsumer = (index: number, field: keyof Consumer, value: any) => {
    const updated = [...consumers];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ consumers: updated });
  };

  const addConsumerCredential = (consumerIndex: number, type: ConsumerCredential['type']) => {
    const updated = [...consumers];
    if (!updated[consumerIndex].credentials) {
      updated[consumerIndex].credentials = [];
    }
    const newCred: ConsumerCredential = {
      type,
      key: type === 'key-auth' ? `key-${Date.now()}` : undefined,
      secret: type === 'jwt' ? 'secret' : undefined
    };
    updated[consumerIndex].credentials = [...updated[consumerIndex].credentials, newCred];
    updateConfig({ consumers: updated });
  };

  const removeConsumerCredential = (consumerIndex: number, credIndex: number) => {
    const updated = [...consumers];
    updated[consumerIndex].credentials = updated[consumerIndex].credentials?.filter((_: ConsumerCredential, i: number) => i !== credIndex);
    updateConfig({ consumers: updated });
  };

  const addPlugin = (pluginType?: string) => {
    const pluginName = pluginType || newPluginType || DEFAULT_PLUGIN_VALUES.name;
    
    // Set default config based on plugin type
    let defaultConfig: Record<string, any> = {};
    if (pluginName === 'rate-limiting') {
      defaultConfig = { minute: 1000, hour: 10000 };
    } else if (pluginName === 'key-auth') {
      defaultConfig = { key_names: ['apikey'] };
    } else if (pluginName === 'jwt') {
      defaultConfig = { secret: '', key_claim_name: 'iss', algorithm: 'HS256' };
    } else if (pluginName === 'cors') {
      defaultConfig = { origins: ['*'], methods: ['GET', 'POST', 'PUT', 'DELETE'], credentials: false };
    } else if (pluginName === 'ip-restriction') {
      defaultConfig = { whitelist: [], blacklist: [] };
    }
    
    const newPlugin: Plugin = {
      id: String(Date.now()),
      name: pluginName,
      enabled: DEFAULT_PLUGIN_VALUES.enabled,
      config: defaultConfig,
    };
    
    const newPlugins = [...plugins, newPlugin];
    updateConfig({ plugins: newPlugins });
    const newIndex = newPlugins.length - 1;
    setEditingPluginIndex(newIndex);
    setShowPluginTypeDialog(false);
    setNewPluginType('rate-limiting');
    showSuccess('Plugin created successfully');
  };

  const removePlugin = (index: number) => {
    updateConfig({ plugins: plugins.filter((_: Plugin, i: number) => i !== index) });
    showSuccess('Plugin deleted successfully');
  };

  const updatePlugin = (index: number, field: keyof Plugin, value: any) => {
    const updated = [...plugins];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ plugins: updated });
  };

  // Sync configuration with routing engine when it changes
  useEffect(() => {
    if (!node || !isRunning) return;
    
    try {
      const routingEngine = emulationEngine.getKongRoutingEngine(componentId);
      if (!routingEngine) return;
      
      // Convert services, routes, upstreams, consumers, plugins to Kong format
      const kongServices = services.map((s: Service) => ({
        id: s.id,
        name: s.name,
        url: s.url,
        enabled: s.enabled,
        upstream: s.upstream,
      }));
      
      const kongRoutes = routes.map((r: KongRoute) => ({
        id: r.id,
        path: r.path,
        method: r.method,
        service: r.service,
        stripPath: r.stripPath,
        protocols: r.protocols,
        priority: (r as any).priority || 0,
      }));
      
      const kongUpstreams = upstreams.map((u: Upstream) => ({
        id: u.id,
        name: u.name,
        algorithm: u.algorithm,
        healthchecks: u.healthchecks,
        targets: u.targets,
      }));
      
      const kongConsumers = consumers.map((c: Consumer) => ({
        id: c.id,
        username: c.username,
        customId: c.customId,
        credentials: c.credentials?.map((cred: ConsumerCredential) => ({
          type: cred.type,
          key: cred.key,
          secret: cred.secret,
          algorithm: cred.algorithm,
          rsaPublicKey: cred.rsaPublicKey,
        })),
      }));
      
      const kongPlugins = plugins.map((p: Plugin) => ({
        id: p.id,
        name: p.name,
        enabled: p.enabled,
        service: p.service,
        route: p.route,
        consumer: p.consumer,
        config: p.config,
      }));
      
      routingEngine.initialize({
        services: kongServices,
        routes: kongRoutes,
        upstreams: kongUpstreams,
        consumers: kongConsumers,
        plugins: kongPlugins,
      });
    } catch (error) {
      console.error('Error syncing Kong configuration:', error);
    }
  }, [services, routes, upstreams, consumers, plugins, componentId, isRunning, node?.id]);

  // Sync metrics from routing engine in real-time
  useEffect(() => {
    if (!node || (services.length === 0 && routes.length === 0) || !isRunning) return;
    
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;
    
    const syncMetrics = () => {
      if (!isMounted || !nodeRef.current) return;
      
      try {
        const routingEngine = emulationEngine.getKongRoutingEngine(componentId);
        if (!routingEngine) return;

        const allMetrics = routingEngine.getAllMetrics();
        const currentConfig = (nodeRef.current.data.config as any) || {};
        
        let metricsChanged = false;
        
        // Update service metrics
        const updatedServices = (currentConfig.services || []).map((service: any) => {
          const metrics = allMetrics.services.get(service.id);
          if (metrics) {
            const updated = {
              ...service,
              requestCount: metrics.requestCount,
              errorCount: metrics.errorCount,
              avgLatency: metrics.avgLatency,
            };
            
            if (updated.requestCount !== (service.requestCount || 0) ||
                updated.errorCount !== (service.errorCount || 0) ||
                updated.avgLatency !== (service.avgLatency || 0)) {
              metricsChanged = true;
            }
            
            return updated;
          }
          return service;
        });
        
        // Update route metrics
        const updatedRoutes = (currentConfig.routes || []).map((route: any) => {
          const metrics = allMetrics.routes.get(route.id);
          if (metrics) {
            const updated = {
              ...route,
              requestCount: metrics.requestCount,
              errorCount: metrics.errorCount,
              avgLatency: metrics.avgLatency,
            };
            
            if (updated.requestCount !== (route.requestCount || 0) ||
                updated.errorCount !== (route.errorCount || 0) ||
                updated.avgLatency !== (route.avgLatency || 0)) {
              metricsChanged = true;
            }
            
            return updated;
          }
          return route;
        });
        
        // Update upstream metrics
        const updatedUpstreams = (currentConfig.upstreams || []).map((upstream: any) => {
          const metrics = allMetrics.upstreams.get(upstream.name);
          if (metrics) {
            const updated = {
              ...upstream,
              requestCount: metrics.requestCount,
              healthyTargets: metrics.healthyTargets,
              totalTargets: metrics.totalTargets,
            };
            
            if (updated.requestCount !== (upstream.requestCount || 0) ||
                updated.healthyTargets !== (upstream.healthyTargets || 0) ||
                updated.totalTargets !== (upstream.totalTargets || 0)) {
              metricsChanged = true;
            }
            
            return updated;
          }
          return upstream;
        });

        if (metricsChanged && nodeRef.current) {
          updateNode(componentId, {
            data: {
              ...nodeRef.current.data,
              config: {
                ...currentConfig,
                services: updatedServices,
                routes: updatedRoutes,
                upstreams: updatedUpstreams,
              },
            },
          });
        }
      } catch (error) {
        console.error('Error syncing Kong metrics:', error);
      }
    };
    
    syncMetrics();
    intervalId = setInterval(syncMetrics, METRICS_UPDATE_CONFIG.SYNC_INTERVAL_MS);
    
    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [componentId, services.length, routes.length, node?.id, isRunning, updateNode]);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Network className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Kong API Gateway</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Service Mesh & API Gateway
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getStatusBadgeVariant(runtimeStatus)} className="gap-2">
              <div className={`h-2 w-2 rounded-full ${getStatusDotColor(runtimeStatus)} ${runtimeStatus === 'running' ? 'animate-pulse' : ''}`} />
              {runtimeStatus === 'running' ? 'Running' : 
               runtimeStatus === 'stopped' ? 'Stopped' :
               runtimeStatus === 'degraded' ? 'Degraded' :
               runtimeStatus === 'error' ? 'Error' : 'Idle'}
            </Badge>
          </div>
        </div>

        <Separator />


        {/* Main Configuration Tabs */}
        <Tabs defaultValue="services" className="w-full">
          <TabsList className="flex-wrap h-auto min-h-[36px] w-full justify-start gap-1">
            <TabsTrigger value="services" className="gap-2">
              <Network className="h-4 w-4" />
              Services
            </TabsTrigger>
            <TabsTrigger value="upstreams" className="gap-2">
              <Server className="h-4 w-4" />
              Upstreams
            </TabsTrigger>
            <TabsTrigger value="routes" className="gap-2">
              <RouteIcon className="h-4 w-4" />
              Routes
            </TabsTrigger>
            <TabsTrigger value="consumers" className="gap-2">
              <Users className="h-4 w-4" />
              Consumers
            </TabsTrigger>
            <TabsTrigger value="plugins" className="gap-2">
              <Zap className="h-4 w-4" />
              Plugins
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Services Tab */}
          <TabsContent value="services" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Services</CardTitle>
                    <CardDescription>Upstream services managed by Kong</CardDescription>
                  </div>
                  <Button size="sm" onClick={addService} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Service
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {services.map((service: Service, index: number) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-primary/10">
                              <Network className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-lg">{service.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {service.url} • {service.routes} routes
                                {service.tags && service.tags.length > 0 && (
                                  <span> • {service.tags.length} tag(s)</span>
                                )}
                              </CardDescription>
                              {isRunning && (service as any).requestCount !== undefined && (
                                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                  <span>Requests: {(service as any).requestCount || 0}</span>
                                  <span>Errors: {(service as any).errorCount || 0}</span>
                                  <span>Latency: {((service as any).avgLatency || 0).toFixed(0)}ms</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {service.enabled ? (
                              <Badge variant="default" className="bg-green-500">Enabled</Badge>
                            ) : (
                              <Badge variant="secondary">Disabled</Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingServiceIndex(editingServiceIndex === index ? null : index)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              {editingServiceIndex === index ? 'Hide' : 'Edit'}
                            </Button>
                            {services.length > 0 && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeleteServiceIndex(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      {editingServiceIndex === index && (
                        <CardContent className="space-y-3 pt-3 border-t">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Service Name</Label>
                              <Input
                                value={service.name}
                                onChange={(e) => {
                                  const existingNames = services.filter((_: Service, i: number) => i !== index).map((s: Service) => s.name);
                                  const validationError = validateName(e.target.value, existingNames);
                                  if (validationError) {
                                    showError(validationError);
                                    return;
                                  }
                                  updateService(index, 'name', e.target.value);
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Service URL</Label>
                              <Input
                                value={service.url}
                                onChange={(e) => {
                                  const validationError = validateUrl(e.target.value);
                                  if (validationError) {
                                    showError(validationError);
                                    return;
                                  }
                                  updateService(index, 'url', e.target.value);
                                }}
                                placeholder="http://service:8080"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Upstream</Label>
                            <Select
                              value={service.upstream || '__none__'}
                              onValueChange={(value) => {
                                const upstreamValue = value === '__none__' ? undefined : value;
                                if (upstreamValue !== undefined) {
                                  updateService(index, 'upstream', upstreamValue);
                                } else {
                                  updateService(index, 'upstream', undefined);
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select upstream (optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">None</SelectItem>
                                {upstreams.map((upstream: Upstream) => (
                                  <SelectItem key={upstream.id} value={upstream.name}>
                                    {upstream.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Tags</Label>
                            </div>
                            <div className="flex gap-2">
                              <Input
                                placeholder="Enter tag name"
                                value={newTagInputs[index] || ''}
                                onChange={(e) => {
                                  setNewTagInputs({ ...newTagInputs, [index]: e.target.value });
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const newTag = newTagInputs[index]?.trim();
                                    if (newTag) {
                                      const currentTags = service.tags || [];
                                      if (!currentTags.includes(newTag)) {
                                        updateService(index, 'tags', [...currentTags, newTag]);
                                        setNewTagInputs({ ...newTagInputs, [index]: '' });
                                      } else {
                                        showError('Tag already exists');
                                      }
                                    }
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newTag = newTagInputs[index]?.trim();
                                  if (newTag) {
                                    const currentTags = service.tags || [];
                                    if (!currentTags.includes(newTag)) {
                                      updateService(index, 'tags', [...currentTags, newTag]);
                                      setNewTagInputs({ ...newTagInputs, [index]: '' });
                                    } else {
                                      showError('Tag already exists');
                                    }
                                  }
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {service.tags?.map((tag: string, tagIndex: number) => (
                                <Badge key={tagIndex} variant="secondary" className="gap-1">
                                  {tag}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newTags = service.tags?.filter((_: string, i: number) => i !== tagIndex) || [];
                                      updateService(index, 'tags', newTags);
                                    }}
                                    className="ml-1 hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                              {(!service.tags || service.tags.length === 0) && (
                                <span className="text-sm text-muted-foreground">No tags</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Enabled</Label>
                            <Switch
                              checked={service.enabled}
                              onCheckedChange={(checked) => updateService(index, 'enabled', checked)}
                            />
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Routes Tab */}
          <TabsContent value="routes" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Routes</CardTitle>
                    <CardDescription>API route configuration</CardDescription>
                  </div>
                  <Button size="sm" onClick={addRoute} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Route
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {routes.map((route: KongRoute, index: number) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-primary/10">
                              <RouteIcon className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{route.path}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {route.method} → {route.service}
                              </CardDescription>
                              {isRunning && (route as any).requestCount !== undefined && (
                                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                  <span>Requests: {(route as any).requestCount || 0}</span>
                                  <span>Errors: {(route as any).errorCount || 0}</span>
                                  <span>Latency: {((route as any).avgLatency || 0).toFixed(0)}ms</span>
                                </div>
                              )}
                            </div>
                          </div>
                          {routes.length > 0 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeleteRouteIndex(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Path</Label>
                            <Input
                              value={route.path}
                              onChange={(e) => updateRoute(index, 'path', e.target.value)}
                              placeholder="/api"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Method</Label>
                            <Select
                              value={route.method}
                              onValueChange={(value) => updateRoute(index, 'method', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select method" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="GET">GET</SelectItem>
                                <SelectItem value="POST">POST</SelectItem>
                                <SelectItem value="PUT">PUT</SelectItem>
                                <SelectItem value="PATCH">PATCH</SelectItem>
                                <SelectItem value="DELETE">DELETE</SelectItem>
                                <SelectItem value="HEAD">HEAD</SelectItem>
                                <SelectItem value="OPTIONS">OPTIONS</SelectItem>
                                <SelectItem value="TRACE">TRACE</SelectItem>
                                <SelectItem value="CONNECT">CONNECT</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Priority</Label>
                            <Input
                              type="number"
                              value={(route as any).priority ?? DEFAULT_ROUTE_VALUES.priority}
                              onChange={(e) => {
                                const value = parseInt(e.target.value, 10);
                                if (!isNaN(value)) {
                                  const validationError = validateNumericField(value, 'priority');
                                  if (validationError) {
                                    showError(validationError);
                                    return;
                                  }
                                  updateRoute(index, 'priority', value);
                                }
                              }}
                              min={VALIDATION_RANGES.PRIORITY.MIN}
                              max={VALIDATION_RANGES.PRIORITY.MAX}
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Service</Label>
                            <Select
                              value={route.service}
                              onValueChange={(value) => updateRoute(index, 'service', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select service" />
                              </SelectTrigger>
                              <SelectContent>
                                {services.map((service: Service) => (
                                  <SelectItem key={service.id} value={service.name}>
                                    {service.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Protocols</Label>
                          <div className="flex flex-wrap gap-2">
                            {['http', 'https', 'grpc', 'grpcs'].map((protocol: string) => {
                              const protocols = route.protocols || DEFAULT_ROUTE_VALUES.protocols;
                              const isSelected = protocols.includes(protocol);
                              return (
                                <Button
                                  key={protocol}
                                  type="button"
                                  variant={isSelected ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => {
                                    const currentProtocols = route.protocols || DEFAULT_ROUTE_VALUES.protocols;
                                    const newProtocols = isSelected
                                      ? currentProtocols.filter((p: string) => p !== protocol)
                                      : [...currentProtocols, protocol];
                                    updateRoute(index, 'protocols', newProtocols);
                                  }}
                                >
                                  {protocol.toUpperCase()}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>Strip Path</Label>
                          <Switch
                            checked={route.stripPath}
                            onCheckedChange={(checked) => updateRoute(index, 'stripPath', checked)}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Upstreams Tab */}
          <TabsContent value="upstreams" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Upstreams</CardTitle>
                  <CardDescription>Load balancing upstream targets</CardDescription>
                </div>
                <Button size="sm" onClick={addUpstream} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Upstream
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {upstreams.map((upstream: Upstream, index: number) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold font-mono">{upstream.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {upstream.targets?.length || 0} target(s) • Algorithm: {upstream.algorithm || 'round-robin'}
                        </div>
                        {isRunning && (upstream as any).requestCount !== undefined && (
                          <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                            <span>Requests: {(upstream as any).requestCount || 0}</span>
                            <span>Healthy: {(upstream as any).healthyTargets || 0}/{(upstream as any).totalTargets || 0}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingUpstreamIndex(editingUpstreamIndex === index ? null : index)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          {editingUpstreamIndex === index ? 'Hide' : 'Edit'}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteUpstreamIndex(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {editingUpstreamIndex === index && (
                      <div className="space-y-4 pt-3 border-t">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Upstream Name</Label>
                            <Input
                              value={upstream.name}
                              onChange={(e) => updateUpstream(index, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Algorithm</Label>
                            <Select
                              value={upstream.algorithm || 'round-robin'}
                              onValueChange={(value) => updateUpstream(index, 'algorithm', value as any)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="round-robin">Round Robin</SelectItem>
                                <SelectItem value="consistent-hashing">Consistent Hashing</SelectItem>
                                <SelectItem value="least-connections">Least Connections</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Targets</Label>
                            <Button variant="outline" size="sm" onClick={() => addUpstreamTarget(index)}>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Target
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {upstream.targets?.map((target: UpstreamTarget, targetIndex: number) => (
                              <div key={targetIndex} className="p-3 border rounded bg-muted/50 flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                  <span className="font-mono text-sm">{target.target}</span>
                                  <Badge variant={target.health === 'healthy' ? 'default' : 'destructive'}>
                                    {target.health || 'healthy'}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">Weight: {target.weight || 100}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeUpstreamTarget(index, targetIndex)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-4 pt-3 border-t">
                          <Label className="text-base font-semibold">Health Checks</Label>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label>Active Health Checks</Label>
                                <Switch
                                  checked={upstream.healthchecks?.active ?? true}
                                  onCheckedChange={(checked) => {
                                    updateUpstream(index, 'healthchecks', {
                                      ...upstream.healthchecks,
                                      active: checked,
                                    });
                                  }}
                                />
                              </div>
                              {upstream.healthchecks?.active && (
                                <div className="space-y-2 pl-4 border-l-2">
                                  <div className="space-y-2">
                                    <Label className="text-xs">Interval (seconds)</Label>
                                    <Input
                                      type="number"
                                      value={upstream.healthchecks?.active_interval || 10}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value, 10);
                                        if (!isNaN(value)) {
                                          updateUpstream(index, 'healthchecks', {
                                            ...upstream.healthchecks,
                                            active_interval: value,
                                          });
                                        }
                                      }}
                                      min={1}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">Timeout (seconds)</Label>
                                    <Input
                                      type="number"
                                      value={upstream.healthchecks?.active_timeout || 1}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value, 10);
                                        if (!isNaN(value)) {
                                          updateUpstream(index, 'healthchecks', {
                                            ...upstream.healthchecks,
                                            active_timeout: value,
                                          });
                                        }
                                      }}
                                      min={1}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">HTTP Path</Label>
                                    <Input
                                      value={upstream.healthchecks?.active_http_path || '/'}
                                      onChange={(e) => {
                                        updateUpstream(index, 'healthchecks', {
                                          ...upstream.healthchecks,
                                          active_http_path: e.target.value,
                                        });
                                      }}
                                      placeholder="/health"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">Healthy Threshold</Label>
                                    <Input
                                      type="number"
                                      value={upstream.healthchecks?.active_healthy_threshold || 2}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value, 10);
                                        if (!isNaN(value)) {
                                          updateUpstream(index, 'healthchecks', {
                                            ...upstream.healthchecks,
                                            active_healthy_threshold: value,
                                          });
                                        }
                                      }}
                                      min={1}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">Unhealthy Threshold</Label>
                                    <Input
                                      type="number"
                                      value={upstream.healthchecks?.active_unhealthy_threshold || 3}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value, 10);
                                        if (!isNaN(value)) {
                                          updateUpstream(index, 'healthchecks', {
                                            ...upstream.healthchecks,
                                            active_unhealthy_threshold: value,
                                          });
                                        }
                                      }}
                                      min={1}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label>Passive Health Checks</Label>
                                <Switch
                                  checked={upstream.healthchecks?.passive ?? true}
                                  onCheckedChange={(checked) => {
                                    updateUpstream(index, 'healthchecks', {
                                      ...upstream.healthchecks,
                                      passive: checked,
                                    });
                                  }}
                                />
                              </div>
                              {upstream.healthchecks?.passive && (
                                <div className="space-y-2 pl-4 border-l-2">
                                  <div className="space-y-2">
                                    <Label className="text-xs">Healthy Status Codes</Label>
                                    <Input
                                      value={Array.isArray(upstream.healthchecks?.passive_healthy_status_codes)
                                        ? upstream.healthchecks.passive_healthy_status_codes.join(', ')
                                        : '200, 201, 202, 203, 204, 301, 302, 303, 307, 308'}
                                      onChange={(e) => {
                                        const codes = e.target.value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
                                        updateUpstream(index, 'healthchecks', {
                                          ...upstream.healthchecks,
                                          passive_healthy_status_codes: codes,
                                        });
                                      }}
                                      placeholder="200, 201, 202"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">Unhealthy Status Codes</Label>
                                    <Input
                                      value={Array.isArray(upstream.healthchecks?.passive_unhealthy_status_codes)
                                        ? upstream.healthchecks.passive_unhealthy_status_codes.join(', ')
                                        : '429, 500, 503'}
                                      onChange={(e) => {
                                        const codes = e.target.value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
                                        updateUpstream(index, 'healthchecks', {
                                          ...upstream.healthchecks,
                                          passive_unhealthy_status_codes: codes,
                                        });
                                      }}
                                      placeholder="429, 500, 503"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">Healthy Threshold</Label>
                                    <Input
                                      type="number"
                                      value={upstream.healthchecks?.passive_healthy_threshold || 2}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value, 10);
                                        if (!isNaN(value)) {
                                          updateUpstream(index, 'healthchecks', {
                                            ...upstream.healthchecks,
                                            passive_healthy_threshold: value,
                                          });
                                        }
                                      }}
                                      min={1}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">Unhealthy Threshold</Label>
                                    <Input
                                      type="number"
                                      value={upstream.healthchecks?.passive_unhealthy_threshold || 3}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value, 10);
                                        if (!isNaN(value)) {
                                          updateUpstream(index, 'healthchecks', {
                                            ...upstream.healthchecks,
                                            passive_unhealthy_threshold: value,
                                          });
                                        }
                                      }}
                                      min={1}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Consumers Tab */}
          <TabsContent value="consumers" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Consumers</CardTitle>
                  <CardDescription>API consumers and authentication credentials</CardDescription>
                </div>
                <Button size="sm" onClick={addConsumer} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Consumer
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {consumers.map((consumer: Consumer, index: number) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold">{consumer.username}</div>
                        {consumer.customId && (
                          <div className="text-sm text-muted-foreground">ID: {consumer.customId}</div>
                        )}
                        {consumer.credentials && consumer.credentials.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {consumer.credentials.length} credential(s)
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingConsumerIndex(editingConsumerIndex === index ? null : index)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          {editingConsumerIndex === index ? 'Hide' : 'Edit'}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteConsumerIndex(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {editingConsumerIndex === index && (
                      <div className="space-y-4 pt-3 border-t">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Username</Label>
                            <Input
                              value={consumer.username}
                              onChange={(e) => updateConsumer(index, 'username', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Custom ID</Label>
                            <Input
                              value={consumer.customId || ''}
                              onChange={(e) => updateConsumer(index, 'customId', e.target.value)}
                              placeholder="custom-id"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Credentials</Label>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => addConsumerCredential(index, 'key-auth')}>
                                <Plus className="h-4 w-4 mr-2" />
                                Key Auth
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => addConsumerCredential(index, 'jwt')}>
                                <Plus className="h-4 w-4 mr-2" />
                                JWT
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => addConsumerCredential(index, 'oauth2')}>
                                <Plus className="h-4 w-4 mr-2" />
                                OAuth2
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {consumer.credentials?.map((cred: ConsumerCredential, credIndex: number) => (
                              <div key={credIndex} className="p-3 border rounded bg-muted/50 space-y-2">
                                <div className="flex items-center justify-between">
                                  <Badge>{cred.type}</Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeConsumerCredential(index, credIndex)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                {cred.key && (
                                  <div className="space-y-1">
                                    <Label className="text-xs">Key</Label>
                                    <Input
                                      className="font-mono text-xs"
                                      value={cred.key}
                                      readOnly
                                    />
                                  </div>
                                )}
                                {cred.secret && (
                                  <div className="space-y-1">
                                    <Label className="text-xs">Secret</Label>
                                    <Input
                                      className="font-mono text-xs"
                                      type="password"
                                      value={cred.secret}
                                      readOnly
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plugins Tab */}
          <TabsContent value="plugins" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Plugins</CardTitle>
                  <CardDescription>Configure plugins for services, routes, and consumers</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowPluginTypeDialog(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Plugin
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {plugins.map((plugin: Plugin, index: number) => (
                  <div key={index} className="p-4 border border-border rounded-lg bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold">{plugin.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {plugin.service && `Service: ${plugin.service}`}
                          {plugin.route && `Route: ${plugin.route}`}
                          {plugin.consumer && `Consumer: ${plugin.consumer}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={plugin.enabled}
                          onCheckedChange={(checked) => updatePlugin(index, 'enabled', checked)}
                        />
                        <Button variant="ghost" size="icon" onClick={() => setDeletePluginIndex(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingPluginIndex(editingPluginIndex === index ? null : index)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      {editingPluginIndex === index ? 'Hide Config' : 'Edit Config'}
                    </Button>
                    {editingPluginIndex === index && (
                      <div className="space-y-4 pt-2 border-t">
                        <div className="space-y-2">
                          <Label>Plugin Type</Label>
                          <Select
                            value={plugin.name}
                            onValueChange={(value) => {
                              // Reset config when changing plugin type
                              let defaultConfig: Record<string, any> = {};
                              if (value === 'rate-limiting') {
                                defaultConfig = { minute: 1000, hour: 10000 };
                              } else if (value === 'key-auth') {
                                defaultConfig = { key_names: ['apikey'] };
                              } else if (value === 'jwt') {
                                defaultConfig = { secret: '', key_claim_name: 'iss', algorithm: 'HS256' };
                              } else if (value === 'cors') {
                                defaultConfig = { origins: ['*'], methods: ['GET', 'POST', 'PUT', 'DELETE'], credentials: false };
                              } else if (value === 'ip-restriction') {
                                defaultConfig = { whitelist: [], blacklist: [] };
                              }
                              updatePlugin(index, 'name', value);
                              updatePlugin(index, 'config', defaultConfig);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="rate-limiting">Rate Limiting</SelectItem>
                              <SelectItem value="key-auth">Key Auth</SelectItem>
                              <SelectItem value="jwt">JWT</SelectItem>
                              <SelectItem value="cors">CORS</SelectItem>
                              <SelectItem value="request-transformer">Request Transformer</SelectItem>
                              <SelectItem value="response-transformer">Response Transformer</SelectItem>
                              <SelectItem value="ip-restriction">IP Restriction</SelectItem>
                              <SelectItem value="file-log">File Log</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Scope</Label>
                          <div className="grid grid-cols-3 gap-2">
                            <Select
                              value={plugin.service || '__none__'}
                              onValueChange={(value) => updatePlugin(index, 'service', value === '__none__' ? undefined : value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Service (optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">None</SelectItem>
                                {services.map((service: Service) => (
                                  <SelectItem key={service.id} value={service.id}>
                                    {service.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={plugin.route || '__none__'}
                              onValueChange={(value) => updatePlugin(index, 'route', value === '__none__' ? undefined : value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Route (optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">None</SelectItem>
                                {routes.map((route: KongRoute) => (
                                  <SelectItem key={route.id} value={route.id}>
                                    {route.path}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={plugin.consumer || '__none__'}
                              onValueChange={(value) => updatePlugin(index, 'consumer', value === '__none__' ? undefined : value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Consumer (optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">None</SelectItem>
                                {consumers.map((consumer: Consumer) => (
                                  <SelectItem key={consumer.id} value={consumer.id}>
                                    {consumer.username}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {plugin.name === 'rate-limiting' && (
                          <div className="space-y-3">
                            <Label>Rate Limiting Configuration</Label>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Per Minute</Label>
                                <Input
                                  type="number"
                                  value={plugin.config?.minute || 1000}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value, 10);
                                    if (!isNaN(value)) {
                                      updatePlugin(index, 'config', { ...plugin.config, minute: value });
                                    }
                                  }}
                                  min={1}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Per Hour</Label>
                                <Input
                                  type="number"
                                  value={plugin.config?.hour || 10000}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value, 10);
                                    if (!isNaN(value)) {
                                      updatePlugin(index, 'config', { ...plugin.config, hour: value });
                                    }
                                  }}
                                  min={1}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Per Day</Label>
                                <Input
                                  type="number"
                                  value={plugin.config?.day || 0}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value, 10);
                                    if (!isNaN(value)) {
                                      updatePlugin(index, 'config', { ...plugin.config, day: value || undefined });
                                    }
                                  }}
                                  min={0}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Per Second</Label>
                                <Input
                                  type="number"
                                  value={plugin.config?.second || 0}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value, 10);
                                    if (!isNaN(value)) {
                                      updatePlugin(index, 'config', { ...plugin.config, second: value || undefined });
                                    }
                                  }}
                                  min={0}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                        {plugin.name === 'key-auth' && (
                          <div className="space-y-3">
                            <Label>Key Auth Configuration</Label>
                              <div className="space-y-2">
                                <Label>Key Names (comma-separated)</Label>
                                <Input
                                  value={Array.isArray(plugin.config?.key_names) ? plugin.config.key_names.join(', ') : 'apikey'}
                                  onChange={(e) => {
                                    const keyNames = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                                    updatePlugin(index, 'config', { ...plugin.config, key_names: keyNames });
                                  }}
                                  placeholder="apikey, X-API-Key"
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label>Hide Credentials</Label>
                                <Switch
                                  checked={plugin.config?.hide_credentials || false}
                                  onCheckedChange={(checked) => {
                                    updatePlugin(index, 'config', { ...plugin.config, hide_credentials: checked });
                                  }}
                                />
                              </div>
                          </div>
                        )}
                        {plugin.name === 'jwt' && (
                          <div className="space-y-3">
                            <Label>JWT Configuration</Label>
                            <div className="space-y-2">
                              <Label>Secret</Label>
                              <Input
                                value={plugin.config?.secret || ''}
                                onChange={(e) => {
                                  updatePlugin(index, 'config', { ...plugin.config, secret: e.target.value });
                                }}
                                placeholder="JWT secret"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Key Claim Name</Label>
                              <Input
                                value={plugin.config?.key_claim_name || 'iss'}
                                onChange={(e) => {
                                  updatePlugin(index, 'config', { ...plugin.config, key_claim_name: e.target.value });
                                }}
                                placeholder="iss"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Algorithm</Label>
                              <Select
                                value={plugin.config?.algorithm || 'HS256'}
                                onValueChange={(value) => {
                                  updatePlugin(index, 'config', { ...plugin.config, algorithm: value });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="HS256">HS256</SelectItem>
                                  <SelectItem value="HS384">HS384</SelectItem>
                                  <SelectItem value="HS512">HS512</SelectItem>
                                  <SelectItem value="RS256">RS256</SelectItem>
                                  <SelectItem value="RS384">RS384</SelectItem>
                                  <SelectItem value="RS512">RS512</SelectItem>
                                  <SelectItem value="ES256">ES256</SelectItem>
                                  <SelectItem value="ES384">ES384</SelectItem>
                                  <SelectItem value="ES512">ES512</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                        {plugin.name === 'cors' && (
                          <div className="space-y-3">
                            <Label>CORS Configuration</Label>
                            <div className="space-y-2">
                              <Label>Origins (comma-separated, * for all)</Label>
                              <Input
                                value={Array.isArray(plugin.config?.origins) ? plugin.config.origins.join(', ') : '*'}
                                onChange={(e) => {
                                  const origins = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                                  updatePlugin(index, 'config', { ...plugin.config, origins });
                                }}
                                placeholder="*, https://example.com"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Methods (comma-separated)</Label>
                              <Input
                                value={Array.isArray(plugin.config?.methods) ? plugin.config.methods.join(', ') : 'GET, POST, PUT, DELETE'}
                                onChange={(e) => {
                                  const methods = e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
                                  updatePlugin(index, 'config', { ...plugin.config, methods });
                                }}
                                placeholder="GET, POST, PUT, DELETE"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Headers (comma-separated)</Label>
                              <Input
                                value={Array.isArray(plugin.config?.headers) ? plugin.config.headers.join(', ') : ''}
                                onChange={(e) => {
                                  const headers = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                                  updatePlugin(index, 'config', { ...plugin.config, headers: headers.length > 0 ? headers : undefined });
                                }}
                                placeholder="Content-Type, Authorization"
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label>Credentials</Label>
                              <Switch
                                checked={plugin.config?.credentials || false}
                                onCheckedChange={(checked) => {
                                  updatePlugin(index, 'config', { ...plugin.config, credentials: checked });
                                }}
                              />
                            </div>
                          </div>
                        )}
                        {plugin.name === 'ip-restriction' && (
                          <div className="space-y-3">
                            <Label>IP Restriction Configuration</Label>
                            <div className="space-y-2">
                              <Label>Whitelist (comma-separated IPs/CIDR)</Label>
                              <Input
                                value={Array.isArray(plugin.config?.whitelist) ? plugin.config.whitelist.join(', ') : ''}
                                onChange={(e) => {
                                  const whitelist = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                                  updatePlugin(index, 'config', { ...plugin.config, whitelist: whitelist.length > 0 ? whitelist : undefined });
                                }}
                                placeholder="192.168.1.0/24, 10.0.0.1"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Blacklist (comma-separated IPs/CIDR)</Label>
                              <Input
                                value={Array.isArray(plugin.config?.blacklist) ? plugin.config.blacklist.join(', ') : ''}
                                onChange={(e) => {
                                  const blacklist = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                                  updatePlugin(index, 'config', { ...plugin.config, blacklist: blacklist.length > 0 ? blacklist : undefined });
                                }}
                                placeholder="192.168.1.100, 10.0.0.50"
                              />
                            </div>
                          </div>
                        )}
                        {!['rate-limiting', 'key-auth', 'jwt', 'cors', 'ip-restriction'].includes(plugin.name) && (
                          <div className="space-y-2">
                            <Label>Configuration (JSON)</Label>
                            <Textarea
                              className="font-mono text-xs"
                              rows={6}
                              value={JSON.stringify(plugin.config || {}, null, 2)}
                              onChange={(e) => {
                                try {
                                  const parsed = JSON.parse(e.target.value);
                                  updatePlugin(index, 'config', parsed);
                                } catch (error) {
                                  showError(`Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                }
                              }}
                              placeholder='{"key": "value"}'
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Service & Upstream</CardTitle>
                <CardDescription>Default service configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="service-name">Service Name</Label>
                  <Input
                    id="service-name"
                    value={serviceName}
                    onChange={(e) => updateConfig({ serviceName: e.target.value })}
                    placeholder="core-service"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upstream-url">Upstream URL</Label>
                  <Input
                    id="upstream-url"
                    value={upstreamUrl}
                    onChange={(e) => updateConfig({ upstreamUrl: e.target.value })}
                    placeholder="http://service:port"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-url">Admin API URL</Label>
                  <Input
                    id="admin-url"
                    value={adminUrl}
                    onChange={(e) => updateConfig({ adminUrl: e.target.value })}
                    placeholder="http://kong:8001"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Plugin Type Selection Dialog */}
        <AlertDialog open={showPluginTypeDialog} onOpenChange={setShowPluginTypeDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Select Plugin Type</AlertDialogTitle>
              <AlertDialogDescription>
                Choose the type of plugin you want to create
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2 py-4">
              <Select value={newPluginType} onValueChange={setNewPluginType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rate-limiting">Rate Limiting</SelectItem>
                  <SelectItem value="key-auth">Key Auth</SelectItem>
                  <SelectItem value="jwt">JWT</SelectItem>
                  <SelectItem value="cors">CORS</SelectItem>
                  <SelectItem value="request-transformer">Request Transformer</SelectItem>
                  <SelectItem value="response-transformer">Response Transformer</SelectItem>
                  <SelectItem value="ip-restriction">IP Restriction</SelectItem>
                  <SelectItem value="file-log">File Log</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => addPlugin()}>
                Create Plugin
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation Dialogs */}
        <AlertDialog open={deleteServiceIndex !== null} onOpenChange={(open) => !open && setDeleteServiceIndex(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Service</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete service "{services[deleteServiceIndex || 0]?.name}"? 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteServiceIndex !== null) {
                    removeService(deleteServiceIndex);
                    setDeleteServiceIndex(null);
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteRouteIndex !== null} onOpenChange={(open) => !open && setDeleteRouteIndex(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Route</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete route "{routes[deleteRouteIndex || 0]?.path}"? 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteRouteIndex !== null) {
                    removeRoute(deleteRouteIndex);
                    setDeleteRouteIndex(null);
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteUpstreamIndex !== null} onOpenChange={(open) => !open && setDeleteUpstreamIndex(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Upstream</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete upstream "{upstreams[deleteUpstreamIndex || 0]?.name}"? 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteUpstreamIndex !== null) {
                    removeUpstream(deleteUpstreamIndex);
                    setDeleteUpstreamIndex(null);
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteConsumerIndex !== null} onOpenChange={(open) => !open && setDeleteConsumerIndex(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Consumer</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete consumer "{consumers[deleteConsumerIndex || 0]?.username}"? 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteConsumerIndex !== null) {
                    removeConsumer(deleteConsumerIndex);
                    setDeleteConsumerIndex(null);
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deletePluginIndex !== null} onOpenChange={(open) => !open && setDeletePluginIndex(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Plugin</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete plugin "{plugins[deletePluginIndex || 0]?.name}"? 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deletePluginIndex !== null) {
                    removePlugin(deletePluginIndex);
                    setDeletePluginIndex(null);
                  }
                }}
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


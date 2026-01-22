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
import { useState } from 'react';
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
import { showError, showSuccess } from '@/utils/toast';
import { useEmulationStore } from '@/store/useEmulationStore';
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
import { useComponentStateStore } from '@/store/useComponentStateStore';
import { useDependencyStore } from '@/store/useDependencyStore';
import { getComponentRuntimeStatus, getStatusBadgeVariant, getStatusDotColor } from '@/utils/componentStatus';
import { useEffect } from 'react';

interface KongConfigProps {
  componentId: string;
}

interface Service {
  id: string;
  name: string;
  url?: string;
  protocol?: 'http' | 'https' | 'grpc' | 'grpcs';
  host?: string;
  port?: number;
  path?: string;
  connect_timeout?: number;
  write_timeout?: number;
  read_timeout?: number;
  retries?: number;
  enabled?: boolean;
  upstream?: string;
  routes?: string[];
  tags?: string[];
  ca_certificates?: string[];
  client_certificate?: string;
  tls_verify?: boolean;
  tls_verify_depth?: number;
}

interface KongRoute {
  id: string;
  name?: string;
  paths?: string[];
  path?: string; // For backward compatibility
  methods?: string[];
  method?: string; // For backward compatibility
  hosts?: string[];
  snis?: string[];
  sources?: Array<{ ip?: string; port?: number }>;
  destinations?: Array<{ ip?: string; port?: number }>;
  regex_priority?: number;
  priority?: number;
  preserve_host?: boolean;
  request_buffering?: boolean;
  response_buffering?: boolean;
  https_redirect_status_code?: number;
  path_handling?: 'v0' | 'v1';
  strip_path?: boolean;
  stripPath?: boolean; // For backward compatibility
  service: string;
  protocols?: ('http' | 'https' | 'grpc' | 'grpcs')[];
  tags?: string[];
}

interface Upstream {
  id?: string;
  name: string;
  algorithm?: 'round-robin' | 'consistent-hashing' | 'least-connections';
  slots?: number;
  hash_on?: 'none' | 'header' | 'cookie' | 'consumer' | 'ip';
  hash_fallback?: 'none' | 'header' | 'cookie' | 'consumer' | 'ip';
  hash_on_header?: string;
  hash_fallback_header?: string;
  hash_on_cookie?: string;
  hash_on_cookie_path?: string;
  healthchecks?: {
    active?: {
      type?: 'http' | 'https' | 'tcp';
      http_path?: string;
      https_verify_certificate?: boolean;
      https_sni?: string;
      timeout?: number;
      concurrency?: number;
      healthy?: {
        interval?: number;
        successes?: number;
        http_statuses?: number[];
        timeouts?: number;
      };
      unhealthy?: {
        interval?: number;
        timeouts?: number;
        http_statuses?: number[];
        tcp_failures?: number;
        http_failures?: number;
      };
    };
    passive?: {
      type?: 'http' | 'https' | 'tcp';
      healthy?: {
        successes?: number;
        http_statuses?: number[];
        timeouts?: number;
      };
      unhealthy?: {
        timeouts?: number;
        http_statuses?: number[];
        tcp_failures?: number;
        http_failures?: number;
      };
    };
  };
  targets?: UpstreamTarget[];
  tags?: string[];
}

interface UpstreamTarget {
  id?: string;
  target: string;
  weight?: number;
  health?: 'healthy' | 'unhealthy' | 'draining';
  tags?: string[];
  created_at?: number;
}

interface Consumer {
  id: string;
  username?: string;
  customId?: string;
  custom_id?: string; // For backward compatibility with KongRoutingEngine
  tags?: string[];
  credentials?: ConsumerCredential[];
  created_at?: number;
}

interface ConsumerCredential {
  id?: string;
  type: 'key-auth' | 'jwt' | 'oauth2' | 'basic-auth' | 'hmac-auth' | 'ldap-auth' | 'mtls-auth';
  key?: string;
  secret?: string;
  algorithm?: string;
  rsaPublicKey?: string;
  rsa_public_key?: string; // For backward compatibility with KongRoutingEngine
  consumer?: string;
  created_at?: number;
  // Additional fields for different credential types
  [key: string]: any;
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
  const adminUrl = config.adminUrl || 'http://kong:8001';
  const serviceName = config.serviceName || 'core-service';
  const upstreamUrl = config.upstreamUrl || 'http://core:8080';
  const routePaths = config.routePaths || ['/api', '/v1'];
  const stripPath = config.stripPath ?? true;
  const authPlugin = config.authPlugin || 'key-auth';
  const rateLimitPerMinute = config.rateLimitPerMinute || 1000;
  const enableLogging = config.enableLogging ?? true;
  const loggingTarget = config.loggingTarget || 'loki';
  const services = config.services || [];
  const routes = config.routes || [];
  const upstreams = config.upstreams || [];
  const consumers = config.consumers || [];
  const plugins = config.plugins || [];
  const requestsPerSecond = config.requestsPerSecond || 450;

  const { updateKongRoutingEngine } = useEmulationStore();

  // Synchronize configuration with routing engine when it changes
  useEffect(() => {
    updateKongRoutingEngine(componentId);
  }, [componentId, services, routes, upstreams, consumers, plugins, updateKongRoutingEngine]);

  const [showCreateUpstream, setShowCreateUpstream] = useState(false);
  const [showCreateConsumer, setShowCreateConsumer] = useState(false);
  const [showCreatePlugin, setShowCreatePlugin] = useState(false);
  const [editingUpstreamIndex, setEditingUpstreamIndex] = useState<number | null>(null);
  const [editingConsumerIndex, setEditingConsumerIndex] = useState<number | null>(null);
  const [editingPluginIndex, setEditingPluginIndex] = useState<number | null>(null);
  const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);
  const [editingRouteIndex, setEditingRouteIndex] = useState<number | null>(null);
  
  // Delete confirmation state
  const [deleteConsumerConfirm, setDeleteConsumerConfirm] = useState<number | null>(null);
  const [deleteCredentialConfirm, setDeleteCredentialConfirm] = useState<{ consumerIndex: number; credIndex: number } | null>(null);
  const [deleteServiceConfirm, setDeleteServiceConfirm] = useState<number | null>(null);
  const [deleteRouteConfirm, setDeleteRouteConfirm] = useState<number | null>(null);
  const [deleteUpstreamConfirm, setDeleteUpstreamConfirm] = useState<number | null>(null);
  const [deletePluginConfirm, setDeletePluginConfirm] = useState<number | null>(null);
  
  // Form state for creating new items
  const [newUpstreamName, setNewUpstreamName] = useState('');
  const [newConsumerUsername, setNewConsumerUsername] = useState('');
  const [newConsumerCustomId, setNewConsumerCustomId] = useState('');
  const [newConsumerTags, setNewConsumerTags] = useState('');
  const [newPluginName, setNewPluginName] = useState<string>('rate-limiting');
  
  // Search and filter state
  const [serviceSearch, setServiceSearch] = useState('');
  const [routeSearch, setRouteSearch] = useState('');
  const [upstreamSearch, setUpstreamSearch] = useState('');
  const [consumerSearch, setConsumerSearch] = useState('');
  const [pluginSearch, setPluginSearch] = useState('');

  const updateConfig = (updates: Partial<KongConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addService = () => {
    updateConfig({
      services: [...services, { 
        id: String(services.length + 1), 
        name: 'new-service', 
        protocol: 'http',
        host: 'service',
        port: 8080,
        path: '/',
        connect_timeout: 60000,
        write_timeout: 60000,
        read_timeout: 60000,
        retries: 5,
        enabled: true,
        routes: []
      }],
    });
  };

  const removeService = (index: number) => {
    const service = services[index];
    if (service && getServiceRoutes(service.id || service.name).length > 0) {
      showError('Cannot delete service with routes. Please remove routes first.');
      return;
    }
    updateConfig({ services: services.filter((_, i) => i !== index) });
    showSuccess(`Service "${service?.name || 'Unknown'}" deleted successfully`);
  };

  const confirmRemoveService = (index: number) => {
    removeService(index);
    setDeleteServiceConfirm(null);
  };

  const updateService = (index: number, field: keyof Service, value: any) => {
    const newServices = [...services];
    newServices[index] = { ...newServices[index], [field]: value };
    updateConfig({ services: newServices });
  };

  const getServiceRoutesCount = (serviceId: string): number => {
    return routes.filter(r => r.service === serviceId || r.service === services.find(s => s.id === serviceId)?.name).length;
  };

  const getServiceRoutes = (serviceId: string): KongRoute[] => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return [];
    return routes.filter(r => r.service === serviceId || r.service === service.name);
  };

  const addRoute = () => {
    updateConfig({
      routes: [...routes, { 
        id: String(routes.length + 1), 
        paths: ['/new-path'],
        methods: ['GET'],
        service: services[0]?.name || services[0]?.id || '',
        strip_path: true,
        preserve_host: false,
        request_buffering: true,
        response_buffering: true,
        protocols: ['http', 'https']
      }],
    });
  };

  const removeRoute = (index: number) => {
    const route = routes[index];
    updateConfig({ routes: routes.filter((_, i) => i !== index) });
    showSuccess(`Route "${route?.name || route?.paths?.[0] || 'Unknown'}" deleted successfully`);
  };

  const confirmRemoveRoute = (index: number) => {
    removeRoute(index);
    setDeleteRouteConfirm(null);
  };

  const updateRoute = (index: number, field: string, value: any) => {
    const newRoutes = [...routes];
    newRoutes[index] = { ...newRoutes[index], [field]: value };
    updateConfig({ routes: newRoutes });
  };

  const addRouteHost = (routeIndex: number) => {
    const route = routes[routeIndex];
    const newHosts = [...(route.hosts || []), ''];
    updateRoute(routeIndex, 'hosts', newHosts);
  };

  const updateRouteHost = (routeIndex: number, hostIndex: number, value: string) => {
    const route = routes[routeIndex];
    const newHosts = [...(route.hosts || [])];
    newHosts[hostIndex] = value;
    updateRoute(routeIndex, 'hosts', newHosts.filter(h => h.trim()));
  };

  const removeRouteHost = (routeIndex: number, hostIndex: number) => {
    const route = routes[routeIndex];
    const newHosts = [...(route.hosts || [])];
    newHosts.splice(hostIndex, 1);
    updateRoute(routeIndex, 'hosts', newHosts);
  };

  const addUpstream = () => {
    const name = newUpstreamName.trim() || 'new-upstream';
    const newUpstream: Upstream = {
      id: String(upstreams.length + 1),
      name: name,
      algorithm: 'round-robin',
      slots: 10000,
      hash_on: 'none',
      hash_fallback: 'none',
      healthchecks: {
        active: {
          type: 'http',
          http_path: '/',
          timeout: 1,
          concurrency: 10,
          healthy: {
            interval: 0,
            successes: 1,
            http_statuses: [200, 201, 202, 203, 204, 205, 206, 207, 208, 226, 300, 301, 302, 303, 304, 305, 306, 307, 308],
            timeouts: 0,
          },
          unhealthy: {
            interval: 0,
            timeouts: 0,
            http_statuses: [429, 500, 501, 502, 503, 504, 505],
            tcp_failures: 0,
            http_failures: 0,
          },
        },
        passive: {
          type: 'http',
          healthy: {
            successes: 1,
            http_statuses: [200, 201, 202, 203, 204, 205, 206, 207, 208, 226, 300, 301, 302, 303, 304, 305, 306, 307, 308],
            timeouts: 0,
          },
          unhealthy: {
            timeouts: 0,
            http_statuses: [429, 500, 501, 502, 503, 504, 505],
            tcp_failures: 0,
            http_failures: 0,
          },
        },
      },
      targets: [{ target: 'server:8080', weight: 100, health: 'healthy' }]
    };
    updateConfig({ upstreams: [...upstreams, newUpstream] });
    setNewUpstreamName('');
    setShowCreateUpstream(false);
  };

  const removeUpstream = (index: number) => {
    const upstream = upstreams[index];
    // Check if any services use this upstream
    const upstreamServices = services.filter(s => s.upstream === upstream.name);
    if (upstreamServices.length > 0) {
      showError('Cannot delete upstream with associated services. Please remove services first.');
      return;
    }
    updateConfig({ upstreams: upstreams.filter((_, i) => i !== index) });
    showSuccess(`Upstream "${upstream?.name || 'Unknown'}" deleted successfully`);
  };

  const confirmRemoveUpstream = (index: number) => {
    removeUpstream(index);
    setDeleteUpstreamConfirm(null);
  };

  const updateUpstream = (index: number, field: keyof Upstream | string, value: any) => {
    const updated = [...upstreams];
    const upstream = { ...updated[index] };
    
    // Handle nested fields (e.g., 'healthchecks.active.type')
    if (field.includes('.')) {
      const parts = field.split('.');
      let current: any = upstream;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
    } else {
      (upstream as any)[field] = value;
    }
    
    updated[index] = upstream;
    updateConfig({ upstreams: updated });
  };

  const updateUpstreamTarget = (upstreamIndex: number, targetIndex: number, field: keyof UpstreamTarget | string, value: any) => {
    const updated = [...upstreams];
    const upstream = { ...updated[upstreamIndex] };
    if (!upstream.targets) {
      upstream.targets = [];
    }
    const targets = [...upstream.targets];
    targets[targetIndex] = { ...targets[targetIndex], [field]: value };
    upstream.targets = targets;
    updated[upstreamIndex] = upstream;
    updateConfig({ upstreams: updated });
  };

  const addUpstreamTarget = (upstreamIndex: number) => {
    const updated = [...upstreams];
    if (!updated[upstreamIndex].targets) {
      updated[upstreamIndex].targets = [];
    }
    updated[upstreamIndex].targets = [
      ...updated[upstreamIndex].targets,
      { target: 'server:8080', weight: 100, health: 'healthy' }
    ];
    updateConfig({ upstreams: updated });
  };

  const removeUpstreamTarget = (upstreamIndex: number, targetIndex: number) => {
    const updated = [...upstreams];
    updated[upstreamIndex].targets = updated[upstreamIndex].targets?.filter((_, i) => i !== targetIndex);
    updateConfig({ upstreams: updated });
  };

  const addConsumer = () => {
    const username = newConsumerUsername.trim();
    if (!username) {
      showError('Username is required');
      return;
    }
    
    // Check for duplicate username
    if (consumers.some(c => c.username === username)) {
      showError('Consumer with this username already exists');
      return;
    }
    
    const customId = newConsumerCustomId.trim() || undefined;
    if (customId && consumers.some(c => (c.customId || c.custom_id) === customId)) {
      showError('Consumer with this custom ID already exists');
      return;
    }
    
    const tags = newConsumerTags.trim()
      ? newConsumerTags.split(',').map(t => t.trim()).filter(t => t.length > 0)
      : undefined;
    
    const newConsumer: Consumer = {
      id: `consumer-${Date.now()}`,
      username: username,
      customId: customId,
      custom_id: customId, // For compatibility
      tags: tags,
      credentials: []
    };
    updateConfig({ consumers: [...consumers, newConsumer] });
    setNewConsumerUsername('');
    setNewConsumerCustomId('');
    setNewConsumerTags('');
    setShowCreateConsumer(false);
    showSuccess(`Consumer "${username}" created successfully`);
  };

  const removeConsumer = (index: number) => {
    const consumer = consumers[index];
    if (consumer.credentials && consumer.credentials.length > 0) {
      showError('Cannot delete consumer with credentials. Please remove credentials first.');
      return;
    }
    updateConfig({ consumers: consumers.filter((_, i) => i !== index) });
    showSuccess(`Consumer "${consumer.username || consumer.id}" deleted successfully`);
  };

  const confirmRemoveConsumer = (index: number) => {
    const consumer = consumers[index];
    if (consumer.credentials && consumer.credentials.length > 0) {
      showError('Cannot delete consumer with credentials. Please remove credentials first.');
      setDeleteConsumerConfirm(null);
      return;
    }
    updateConfig({ consumers: consumers.filter((_, i) => i !== index) });
    showSuccess(`Consumer "${consumer.username || consumer.id}" deleted successfully`);
    setDeleteConsumerConfirm(null);
  };

  const updateConsumer = (index: number, field: keyof Consumer, value: any) => {
    const updated = [...consumers];
    
    // Validation
    if (field === 'username' && value) {
      const trimmedValue = value.trim();
      if (!trimmedValue) {
        showError('Username cannot be empty');
        return;
      }
      // Check for duplicate username (excluding current consumer)
      if (consumers.some((c, i) => i !== index && c.username === trimmedValue)) {
        showError('Consumer with this username already exists');
        return;
      }
      updated[index] = { ...updated[index], [field]: trimmedValue };
    } else if (field === 'customId' || field === 'custom_id') {
      const trimmedValue = value.trim() || undefined;
      if (trimmedValue && consumers.some((c, i) => i !== index && (c.customId || c.custom_id) === trimmedValue)) {
        showError('Consumer with this custom ID already exists');
        return;
      }
      updated[index] = { 
        ...updated[index], 
        customId: trimmedValue,
        custom_id: trimmedValue // For compatibility
      };
    } else if (field === 'tags') {
      // Handle tags as string (comma-separated) or array
      if (typeof value === 'string') {
        const tagsArray = value.trim()
          ? value.split(',').map(t => t.trim()).filter(t => t.length > 0)
          : undefined;
        updated[index] = { ...updated[index], tags: tagsArray };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    
    updateConfig({ consumers: updated });
  };

  const addConsumerCredential = (consumerIndex: number, type: ConsumerCredential['type']) => {
    const updated = [...consumers];
    if (!updated[consumerIndex].credentials) {
      updated[consumerIndex].credentials = [];
    }
    
    const newCred: ConsumerCredential = {
      id: `cred-${Date.now()}`,
      type,
      created_at: Date.now(),
    };
    
    // Set default values based on type
    switch (type) {
      case 'key-auth':
        newCred.key = `key-${Date.now()}`;
        break;
      case 'jwt':
        newCred.secret = `secret-${Date.now()}`;
        newCred.algorithm = 'HS256';
        break;
      case 'basic-auth':
        newCred.username = '';
        newCred.password = '';
        break;
      case 'hmac-auth':
        newCred.username = '';
        newCred.secret = '';
        break;
      case 'oauth2':
        newCred.name = '';
        newCred.client_id = '';
        newCred.client_secret = '';
        break;
      case 'ldap-auth':
        newCred.ldap_host = '';
        newCred.ldap_port = 389;
        newCred.start_tls = false;
        break;
      case 'mtls-auth':
        newCred.certificate = '';
        break;
    }
    
    updated[consumerIndex].credentials = [...updated[consumerIndex].credentials, newCred];
    updateConfig({ consumers: updated });
    showSuccess(`${type} credential added successfully`);
  };

  const updateConsumerCredential = (
    consumerIndex: number,
    credIndex: number,
    field: string,
    value: any
  ) => {
    const updated = [...consumers];
    if (!updated[consumerIndex].credentials) return;
    
    const cred = updated[consumerIndex].credentials[credIndex];
    if (!cred) return;
    
    updated[consumerIndex].credentials[credIndex] = {
      ...cred,
      [field]: value,
    };
    
    updateConfig({ consumers: updated });
  };

  const removeConsumerCredential = (consumerIndex: number, credIndex: number) => {
    const updated = [...consumers];
    const cred = updated[consumerIndex].credentials?.[credIndex];
    if (cred) {
      updated[consumerIndex].credentials = updated[consumerIndex].credentials?.filter((_, i) => i !== credIndex);
      updateConfig({ consumers: updated });
      showSuccess(`${cred.type} credential removed successfully`);
    }
    setDeleteCredentialConfirm(null);
  };

  const confirmRemoveConsumerCredential = (consumerIndex: number, credIndex: number) => {
    removeConsumerCredential(consumerIndex, credIndex);
  };

  const addPlugin = () => {
    const defaultConfigs: Record<string, any> = {
      'rate-limiting': { minute: 1000, hour: 10000 },
      'key-auth': { key_names: ['apikey'], hide_credentials: false },
      'jwt': { secret_is_base64: false, run_on: 'first' },
      'cors': { origins: ['*'], methods: ['GET', 'POST', 'PUT', 'DELETE'], credentials: false },
      'request-transformer': { http_method: null },
      'response-transformer': {},
      'ip-restriction': { whitelist: [], blacklist: [] },
      'file-log': { path: '/tmp/kong-access.log', reopen: false },
      'http-log': { http_endpoint: 'http://localhost:8080/logs', method: 'POST', timeout: 10000 },
    };

    const newPlugin: Plugin = {
      id: String(plugins.length + 1),
      name: newPluginName,
      enabled: true,
      config: defaultConfigs[newPluginName] || {}
    };
    updateConfig({ plugins: [...plugins, newPlugin] });
    setShowCreatePlugin(false);
    setNewPluginName('rate-limiting');
    showSuccess(`Plugin "${newPluginName}" created successfully`);
  };

  const removePlugin = (index: number) => {
    const plugin = plugins[index];
    updateConfig({ plugins: plugins.filter((_, i) => i !== index) });
    showSuccess(`Plugin "${plugin?.name || 'Unknown'}" deleted successfully`);
  };

  const confirmRemovePlugin = (index: number) => {
    removePlugin(index);
    setDeletePluginConfirm(null);
  };

  const updatePlugin = (index: number, field: keyof Plugin, value: any) => {
    const updated = [...plugins];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ plugins: updated });
  };

  const updatePluginConfig = (index: number, configPath: string, value: any) => {
    const updated = [...plugins];
    const plugin = updated[index];
    if (!plugin.config) plugin.config = {};
    
    const keys = configPath.split('.');
    let current: any = plugin.config;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    
    updateConfig({ plugins: updated });
  };

  // Filter functions
  const filteredServices = services.filter(s => 
    !serviceSearch || 
    s.name?.toLowerCase().includes(serviceSearch.toLowerCase()) ||
    s.host?.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  const filteredRoutes = routes.filter(r =>
    !routeSearch ||
    r.name?.toLowerCase().includes(routeSearch.toLowerCase()) ||
    r.paths?.some(p => p.toLowerCase().includes(routeSearch.toLowerCase())) ||
    r.service?.toLowerCase().includes(routeSearch.toLowerCase())
  );

  const filteredUpstreams = upstreams.filter(u =>
    !upstreamSearch ||
    u.name?.toLowerCase().includes(upstreamSearch.toLowerCase())
  );

  const filteredConsumers = consumers.filter(c =>
    !consumerSearch ||
    c.username?.toLowerCase().includes(consumerSearch.toLowerCase()) ||
    c.customId?.toLowerCase().includes(consumerSearch.toLowerCase()) ||
    c.custom_id?.toLowerCase().includes(consumerSearch.toLowerCase())
  );

  const filteredPlugins = plugins.filter(p =>
    !pluginSearch ||
    p.name?.toLowerCase().includes(pluginSearch.toLowerCase()) ||
    p.service?.toLowerCase().includes(pluginSearch.toLowerCase()) ||
    p.route?.toLowerCase().includes(pluginSearch.toLowerCase()) ||
    p.consumer?.toLowerCase().includes(pluginSearch.toLowerCase())
  );

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
          <TabsList className="flex flex-wrap w-full gap-1">
            <TabsTrigger value="services" className="gap-2 flex-shrink-0">
              <Network className="h-4 w-4" />
              Services
            </TabsTrigger>
            <TabsTrigger value="upstreams" className="gap-2 flex-shrink-0">
              <Server className="h-4 w-4" />
              Upstreams
            </TabsTrigger>
            <TabsTrigger value="routes" className="gap-2 flex-shrink-0">
              <RouteIcon className="h-4 w-4" />
              Routes
            </TabsTrigger>
            <TabsTrigger value="consumers" className="gap-2 flex-shrink-0">
              <Users className="h-4 w-4" />
              Consumers
            </TabsTrigger>
            <TabsTrigger value="plugins" className="gap-2 flex-shrink-0">
              <Zap className="h-4 w-4" />
              Plugins
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2 flex-shrink-0">
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
                <div className="mt-4">
                  <Input
                    placeholder="Search services..."
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredServices.length === 0 && serviceSearch && (
                    <p className="text-sm text-muted-foreground text-center py-4">No services found matching "{serviceSearch}"</p>
                  )}
                  {filteredServices.length === 0 && !serviceSearch && (
                    <p className="text-sm text-muted-foreground text-center py-4">No services configured</p>
                  )}
                  {filteredServices.map((service) => {
                    const originalIndex = services.findIndex(s => s.id === service.id && s.name === service.name);
                    const serviceUrl = service.url || (service.protocol && service.host && service.port 
                      ? `${service.protocol}://${service.host}:${service.port}${service.path || ''}`
                      : 'Not configured');
                    const routesCount = getServiceRoutesCount(service.id);
                    const serviceRoutes = getServiceRoutes(service.id);
                    
                    return (
                      <Card key={originalIndex} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="p-2 rounded bg-primary/10">
                                <Network className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                {editingServiceIndex === originalIndex ? (
                                  <Input
                                    value={service.name}
                                    onChange={(e) => updateService(originalIndex, 'name', e.target.value)}
                                    onBlur={() => setEditingServiceIndex(null)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        setEditingServiceIndex(null);
                                      }
                                    }}
                                    className="font-semibold text-lg"
                                    autoFocus
                                  />
                                ) : (
                                  <>
                                    <CardTitle 
                                      className="text-lg cursor-pointer hover:text-primary transition-colors truncate"
                                      onClick={() => setEditingServiceIndex(originalIndex)}
                                      title={service.name}
                                    >
                                      {service.name}
                                    </CardTitle>
                                    <CardDescription className="text-xs mt-1 truncate" title={serviceUrl}>
                                      {serviceUrl} • {routesCount} route{routesCount !== 1 ? 's' : ''}
                                      {service.upstream && ` • Upstream: ${service.upstream}`}
                                    </CardDescription>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {service.enabled !== false ? (
                                <Badge variant="default" className="bg-green-500">Enabled</Badge>
                              ) : (
                                <Badge variant="secondary">Disabled</Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingServiceIndex(editingServiceIndex === originalIndex ? null : originalIndex)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                {editingServiceIndex === originalIndex ? 'Hide' : 'Edit'}
                              </Button>
                              {services.length > 1 && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setDeleteServiceConfirm(originalIndex)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        {editingServiceIndex === originalIndex && (
                          <CardContent className="space-y-4 pt-3 border-t">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Service Name</Label>
                                <Input
                                  value={service.name}
                                  onChange={(e) => updateService(originalIndex, 'name', e.target.value)}
                                  placeholder="my-service"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Protocol</Label>
                                <Select
                                  value={service.protocol || 'http'}
                                  onValueChange={(value) => updateService(originalIndex, 'protocol', value as any)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="http">HTTP</SelectItem>
                                    <SelectItem value="https">HTTPS</SelectItem>
                                    <SelectItem value="grpc">gRPC</SelectItem>
                                    <SelectItem value="grpcs">gRPCS</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Host</Label>
                                <Input
                                  value={service.host || ''}
                                  onChange={(e) => updateService(originalIndex, 'host', e.target.value)}
                                  placeholder="example.com"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Port</Label>
                                <Input
                                  type="number"
                                  value={service.port || ''}
                                  onChange={(e) => updateService(originalIndex, 'port', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                  placeholder="8080"
                                  min="1"
                                  max="65535"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Path</Label>
                                <Input
                                  value={service.path || ''}
                                  onChange={(e) => updateService(originalIndex, 'path', e.target.value)}
                                  placeholder="/api"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Upstream</Label>
                                <Select
                                  value={service.upstream || '__none__'}
                                  onValueChange={(value) => updateService(originalIndex, 'upstream', value === '__none__' ? undefined : value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select upstream" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">None</SelectItem>
                                    {upstreams.map((up) => {
                                      const upstreamValue = up.name || `upstream-${upstreams.indexOf(up)}`;
                                      return (
                                        <SelectItem key={upstreamValue} value={upstreamValue}>{up.name || 'Unnamed Upstream'}</SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Connect Timeout (ms)</Label>
                                <Input
                                  type="number"
                                  value={service.connect_timeout || ''}
                                  onChange={(e) => updateService(originalIndex, 'connect_timeout', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                  placeholder="60000"
                                  min="1"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Write Timeout (ms)</Label>
                                <Input
                                  type="number"
                                  value={service.write_timeout || ''}
                                  onChange={(e) => updateService(originalIndex, 'write_timeout', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                  placeholder="60000"
                                  min="1"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Read Timeout (ms)</Label>
                                <Input
                                  type="number"
                                  value={service.read_timeout || ''}
                                  onChange={(e) => updateService(originalIndex, 'read_timeout', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                  placeholder="60000"
                                  min="1"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Retries</Label>
                                <Input
                                  type="number"
                                  value={service.retries || ''}
                                  onChange={(e) => updateService(originalIndex, 'retries', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                  placeholder="5"
                                  min="0"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-2">
                              <Label>Enabled</Label>
                              <Switch
                                checked={service.enabled !== false}
                                onCheckedChange={(checked) => updateService(originalIndex, 'enabled', checked)}
                              />
                            </div>
                            {serviceRoutes.length > 0 && (
                              <div className="space-y-2 pt-2 border-t">
                                <Label>Associated Routes ({serviceRoutes.length})</Label>
                                <div className="space-y-1">
                                  {serviceRoutes.map((route, routeIndex) => (
                                    <div key={routeIndex} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                                      <RouteIcon className="h-3 w-3" />
                                      <span className="font-mono">{route.path || route.paths?.[0] || '/'}</span>
                                      <Badge variant="outline" className="text-xs">
                                        {route.method || route.methods?.[0] || 'GET'}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
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
                <div className="mt-4">
                  <Input
                    placeholder="Search routes..."
                    value={routeSearch}
                    onChange={(e) => setRouteSearch(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredRoutes.length === 0 && routeSearch && (
                    <p className="text-sm text-muted-foreground text-center py-4">No routes found matching "{routeSearch}"</p>
                  )}
                  {filteredRoutes.length === 0 && !routeSearch && (
                    <p className="text-sm text-muted-foreground text-center py-4">No routes configured</p>
                  )}
                  {filteredRoutes.map((route) => {
                    const originalIndex = routes.findIndex(r => r.id === route.id || (r.name === route.name && r.service === route.service));
                    const routePath = route.path || route.paths?.[0] || '/';
                    const routeMethod = route.method || route.methods?.[0] || 'GET';
                    const serviceName = services.find(s => s.id === route.service || s.name === route.service)?.name || route.service;
                    
                    return (
                      <Card key={originalIndex} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="p-2 rounded bg-primary/10 flex-shrink-0">
                                <RouteIcon className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-lg truncate" title={route.name || routePath}>
                                  {route.name || routePath}
                                </CardTitle>
                                <CardDescription className="text-xs mt-1 truncate">
                                  {routeMethod} → {serviceName}
                                  {route.hosts && route.hosts.length > 0 && ` • Hosts: ${route.hosts.join(', ')}`}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingRouteIndex(editingRouteIndex === originalIndex ? null : originalIndex)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                {editingRouteIndex === originalIndex ? 'Hide' : 'Edit'}
                              </Button>
                              {routes.length > 1 && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setDeleteRouteConfirm(originalIndex)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        {editingRouteIndex === originalIndex && (
                          <CardContent className="space-y-4 pt-3 border-t">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Route Name</Label>
                                <Input
                                  value={route.name || ''}
                                  onChange={(e) => updateRoute(originalIndex, 'name', e.target.value || undefined)}
                                  placeholder="my-route"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Service</Label>
                                <Select
                                  value={route.service || undefined}
                                  onValueChange={(value) => updateRoute(originalIndex, 'service', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select service" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {services.map((svc) => {
                                      const serviceValue = svc.id || svc.name || `service-${services.indexOf(svc)}`;
                                      return (
                                        <SelectItem key={serviceValue} value={serviceValue}>{svc.name || 'Unnamed Service'}</SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Paths (comma-separated)</Label>
                                <Input
                                  value={route.paths?.join(', ') || route.path || ''}
                                  onChange={(e) => {
                                    const paths = e.target.value.split(',').map(p => p.trim()).filter(p => p);
                                    updateRoute(originalIndex, 'paths', paths.length > 0 ? paths : undefined);
                                    if (paths.length === 0) {
                                      updateRoute(originalIndex, 'path', e.target.value);
                                    }
                                  }}
                                  placeholder="/api, /v1"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Methods</Label>
                                <Select
                                  value={route.methods?.join(',') || route.method || 'GET'}
                                  onValueChange={(value) => {
                                    const methods = value.split(',').map(m => m.trim()).filter(m => m);
                                    updateRoute(originalIndex, 'methods', methods.length > 0 ? methods : undefined);
                                    if (methods.length === 1) {
                                      updateRoute(originalIndex, 'method', methods[0]);
                                    }
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="GET">GET</SelectItem>
                                    <SelectItem value="POST">POST</SelectItem>
                                    <SelectItem value="PUT">PUT</SelectItem>
                                    <SelectItem value="PATCH">PATCH</SelectItem>
                                    <SelectItem value="DELETE">DELETE</SelectItem>
                                    <SelectItem value="HEAD">HEAD</SelectItem>
                                    <SelectItem value="OPTIONS">OPTIONS</SelectItem>
                                    <SelectItem value="GET,POST,PUT,PATCH,DELETE">All Methods</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Protocols</Label>
                                <div className="flex flex-wrap gap-2">
                                  {['http', 'https', 'grpc', 'grpcs'].map((proto) => (
                                    <div key={proto} className="flex items-center space-x-2">
                                      <input
                                        type="checkbox"
                                        id={`route-${originalIndex}-proto-${proto}`}
                                        checked={route.protocols?.includes(proto as any) || false}
                                        onChange={(e) => {
                                          const current = route.protocols || [];
                                          const updated = e.target.checked
                                            ? [...current, proto as any]
                                            : current.filter(p => p !== proto);
                                          updateRoute(originalIndex, 'protocols', updated.length > 0 ? updated : undefined);
                                        }}
                                        className="rounded"
                                      />
                                      <Label htmlFor={`route-${originalIndex}-proto-${proto}`} className="text-sm font-normal cursor-pointer">
                                        {proto.toUpperCase()}
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Regex Priority</Label>
                                <Input
                                  type="number"
                                  value={route.regex_priority || route.priority || ''}
                                  onChange={(e) => {
                                    const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                                    updateRoute(originalIndex, 'regex_priority', val);
                                    updateRoute(originalIndex, 'priority', val);
                                  }}
                                  placeholder="0"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Path Handling</Label>
                                <Select
                                  value={route.path_handling || 'v0'}
                                  onValueChange={(value) => updateRoute(originalIndex, 'path_handling', value as any)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="v0">v0 (Legacy)</SelectItem>
                                    <SelectItem value="v1">v1 (Modern)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>HTTPS Redirect Status Code</Label>
                                <Select
                                  value={String(route.https_redirect_status_code || 426)}
                                  onValueChange={(value) => updateRoute(originalIndex, 'https_redirect_status_code', parseInt(value, 10))}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="426">426 (Upgrade Required)</SelectItem>
                                    <SelectItem value="301">301 (Moved Permanently)</SelectItem>
                                    <SelectItem value="302">302 (Found)</SelectItem>
                                    <SelectItem value="307">307 (Temporary Redirect)</SelectItem>
                                    <SelectItem value="308">308 (Permanent Redirect)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label>Hosts</Label>
                                <Button variant="outline" size="sm" onClick={() => addRouteHost(originalIndex)}>
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Host
                                </Button>
                              </div>
                              <div className="space-y-2">
                                {route.hosts?.map((host, hostIndex) => (
                                  <div key={hostIndex} className="flex items-center gap-2">
                                    <Input
                                      value={host}
                                      onChange={(e) => updateRouteHost(originalIndex, hostIndex, e.target.value)}
                                      placeholder="example.com"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeRouteHost(originalIndex, hostIndex)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                                {(!route.hosts || route.hosts.length === 0) && (
                                  <p className="text-sm text-muted-foreground">No hosts configured</p>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                              <div className="flex items-center justify-between">
                                <Label>Preserve Host</Label>
                                <Switch
                                  checked={route.preserve_host ?? false}
                                  onCheckedChange={(checked) => updateRoute(originalIndex, 'preserve_host', checked)}
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label>Strip Path</Label>
                                <Switch
                                  checked={route.strip_path ?? route.stripPath ?? true}
                                  onCheckedChange={(checked) => {
                                    updateRoute(originalIndex, 'strip_path', checked);
                                    updateRoute(originalIndex, 'stripPath', checked);
                                  }}
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label>Request Buffering</Label>
                                <Switch
                                  checked={route.request_buffering ?? true}
                                  onCheckedChange={(checked) => updateRoute(originalIndex, 'request_buffering', checked)}
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label>Response Buffering</Label>
                                <Switch
                                  checked={route.response_buffering ?? true}
                                  onCheckedChange={(checked) => updateRoute(originalIndex, 'response_buffering', checked)}
                                />
                              </div>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
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
                <Button size="sm" onClick={() => setShowCreateUpstream(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Upstream
                </Button>
              </CardHeader>
              <CardContent className="border-b pb-4">
                <Input
                  placeholder="Search upstreams..."
                  value={upstreamSearch}
                  onChange={(e) => setUpstreamSearch(e.target.value)}
                  className="max-w-sm"
                />
              </CardContent>
              {showCreateUpstream && (
                <CardContent className="border-b pb-4 mb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Upstream Name</Label>
                      <Input 
                        placeholder="backend-upstream" 
                        value={newUpstreamName}
                        onChange={(e) => setNewUpstreamName(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addUpstream}>Create Upstream</Button>
                      <Button variant="outline" onClick={() => {
                        setShowCreateUpstream(false);
                        setNewUpstreamName('');
                      }}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-4">
                {filteredUpstreams.length === 0 && upstreamSearch && (
                  <p className="text-sm text-muted-foreground text-center py-4">No upstreams found matching "{upstreamSearch}"</p>
                )}
                {filteredUpstreams.length === 0 && !upstreamSearch && (
                  <p className="text-sm text-muted-foreground text-center py-4">No upstreams configured</p>
                )}
                {filteredUpstreams.map((upstream) => {
                  const originalIndex = upstreams.findIndex(u => u.name === upstream.name);
                  const upstreamServices = services.filter(s => s.upstream === upstream.name);
                  const healthyTargets = upstream.targets?.filter(t => t.health === 'healthy' || !t.health).length || 0;
                  const totalTargets = upstream.targets?.length || 0;
                  
                  return (
                    <Card key={originalIndex} className="border-border">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="p-2 rounded bg-primary/10 flex-shrink-0">
                            <Server className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg truncate" title={upstream.name}>
                              {upstream.name}
                            </CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {totalTargets} target(s) • {healthyTargets} healthy • Algorithm: {upstream.algorithm || 'round-robin'}
                              {upstreamServices.length > 0 && ` • ${upstreamServices.length} service(s)`}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingUpstreamIndex(editingUpstreamIndex === originalIndex ? null : originalIndex)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            {editingUpstreamIndex === originalIndex ? 'Hide' : 'Edit'}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteUpstreamConfirm(originalIndex)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {editingUpstreamIndex === originalIndex && (
                      <div className="space-y-4 pt-3 border-t">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Upstream Name</Label>
                            <Input
                              value={upstream.name}
                              onChange={(e) => updateUpstream(originalIndex, 'name', e.target.value)}
                              placeholder="backend-upstream"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Algorithm</Label>
                            <Select
                              value={upstream.algorithm || 'round-robin'}
                              onValueChange={(value) => updateUpstream(originalIndex, 'algorithm', value as any)}
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
                          <div className="space-y-2">
                            <Label>Slots</Label>
                            <Input
                              type="number"
                              value={upstream.slots || ''}
                              onChange={(e) => updateUpstream(originalIndex, 'slots', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                              placeholder="10000"
                              min="1"
                            />
                            <p className="text-xs text-muted-foreground">Number of slots for consistent hashing</p>
                          </div>
                          <div className="space-y-2">
                            <Label>Hash On</Label>
                            <Select
                              value={upstream.hash_on || 'none'}
                              onValueChange={(value) => updateUpstream(originalIndex, 'hash_on', value as any)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="header">Header</SelectItem>
                                <SelectItem value="cookie">Cookie</SelectItem>
                                <SelectItem value="consumer">Consumer</SelectItem>
                                <SelectItem value="ip">IP</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Hash Fallback</Label>
                            <Select
                              value={upstream.hash_fallback || 'none'}
                              onValueChange={(value) => updateUpstream(originalIndex, 'hash_fallback', value as any)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="header">Header</SelectItem>
                                <SelectItem value="cookie">Cookie</SelectItem>
                                <SelectItem value="consumer">Consumer</SelectItem>
                                <SelectItem value="ip">IP</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {upstream.hash_on === 'header' && (
                            <div className="space-y-2">
                              <Label>Hash On Header</Label>
                              <Input
                                value={upstream.hash_on_header || ''}
                                onChange={(e) => updateUpstream(originalIndex, 'hash_on_header', e.target.value || undefined)}
                                placeholder="X-Forwarded-For"
                              />
                            </div>
                          )}
                          {upstream.hash_fallback === 'header' && (
                            <div className="space-y-2">
                              <Label>Hash Fallback Header</Label>
                              <Input
                                value={upstream.hash_fallback_header || ''}
                                onChange={(e) => updateUpstream(originalIndex, 'hash_fallback_header', e.target.value || undefined)}
                                placeholder="X-Forwarded-For"
                              />
                            </div>
                          )}
                          {upstream.hash_on === 'cookie' && (
                            <>
                              <div className="space-y-2">
                                <Label>Hash On Cookie</Label>
                                <Input
                                  value={upstream.hash_on_cookie || ''}
                                  onChange={(e) => updateUpstream(originalIndex, 'hash_on_cookie', e.target.value || undefined)}
                                  placeholder="sessionid"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Hash On Cookie Path</Label>
                                <Input
                                  value={upstream.hash_on_cookie_path || ''}
                                  onChange={(e) => updateUpstream(originalIndex, 'hash_on_cookie_path', e.target.value || undefined)}
                                  placeholder="/"
                                />
                              </div>
                            </>
                          )}
                        </div>

                        {/* Health Checks Configuration */}
                        <div className="space-y-4 pt-4 border-t">
                          <div className="flex items-center justify-between">
                            <Label className="text-base font-semibold">Health Checks</Label>
                          </div>
                          
                          {/* Active Health Checks */}
                          <div className="space-y-3 p-4 border rounded bg-muted/30">
                            <Label className="text-sm font-semibold">Active Health Checks</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Type</Label>
                                <Select
                                  value={upstream.healthchecks?.active?.type || 'http'}
                                  onValueChange={(value) => updateUpstream(originalIndex, 'healthchecks.active.type', value as any)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="http">HTTP</SelectItem>
                                    <SelectItem value="https">HTTPS</SelectItem>
                                    <SelectItem value="tcp">TCP</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>HTTP Path</Label>
                                <Input
                                  value={upstream.healthchecks?.active?.http_path || ''}
                                  onChange={(e) => updateUpstream(originalIndex, 'healthchecks.active.http_path', e.target.value || undefined)}
                                  placeholder="/"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Timeout (seconds)</Label>
                                <Input
                                  type="number"
                                  value={upstream.healthchecks?.active?.timeout || ''}
                                  onChange={(e) => updateUpstream(originalIndex, 'healthchecks.active.timeout', e.target.value ? parseFloat(e.target.value) : undefined)}
                                  placeholder="1"
                                  min="0"
                                  step="0.1"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Concurrency</Label>
                                <Input
                                  type="number"
                                  value={upstream.healthchecks?.active?.concurrency || ''}
                                  onChange={(e) => updateUpstream(originalIndex, 'healthchecks.active.concurrency', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                  placeholder="10"
                                  min="1"
                                />
                              </div>
                            </div>
                            
                            {/* Healthy Thresholds */}
                            <div className="space-y-2 pt-2 border-t">
                              <Label className="text-sm">Healthy Thresholds</Label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Interval (seconds)</Label>
                                  <Input
                                    type="number"
                                    value={upstream.healthchecks?.active?.healthy?.interval || ''}
                                    onChange={(e) => updateUpstream(originalIndex, 'healthchecks.active.healthy.interval', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                    placeholder="0"
                                    min="0"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Successes</Label>
                                  <Input
                                    type="number"
                                    value={upstream.healthchecks?.active?.healthy?.successes || ''}
                                    onChange={(e) => updateUpstream(originalIndex, 'healthchecks.active.healthy.successes', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                    placeholder="1"
                                    min="0"
                                  />
                                </div>
                              </div>
                            </div>
                            
                            {/* Unhealthy Thresholds */}
                            <div className="space-y-2 pt-2 border-t">
                              <Label className="text-sm">Unhealthy Thresholds</Label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Interval (seconds)</Label>
                                  <Input
                                    type="number"
                                    value={upstream.healthchecks?.active?.unhealthy?.interval || ''}
                                    onChange={(e) => updateUpstream(originalIndex, 'healthchecks.active.unhealthy.interval', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                    placeholder="0"
                                    min="0"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Timeouts</Label>
                                  <Input
                                    type="number"
                                    value={upstream.healthchecks?.active?.unhealthy?.timeouts || ''}
                                    onChange={(e) => updateUpstream(originalIndex, 'healthchecks.active.unhealthy.timeouts', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                    placeholder="0"
                                    min="0"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>TCP Failures</Label>
                                  <Input
                                    type="number"
                                    value={upstream.healthchecks?.active?.unhealthy?.tcp_failures || ''}
                                    onChange={(e) => updateUpstream(originalIndex, 'healthchecks.active.unhealthy.tcp_failures', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                    placeholder="0"
                                    min="0"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>HTTP Failures</Label>
                                  <Input
                                    type="number"
                                    value={upstream.healthchecks?.active?.unhealthy?.http_failures || ''}
                                    onChange={(e) => updateUpstream(originalIndex, 'healthchecks.active.unhealthy.http_failures', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                    placeholder="0"
                                    min="0"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Passive Health Checks */}
                          <div className="space-y-3 p-4 border rounded bg-muted/30">
                            <Label className="text-sm font-semibold">Passive Health Checks</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Type</Label>
                                <Select
                                  value={upstream.healthchecks?.passive?.type || 'http'}
                                  onValueChange={(value) => updateUpstream(originalIndex, 'healthchecks.passive.type', value as any)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="http">HTTP</SelectItem>
                                    <SelectItem value="https">HTTPS</SelectItem>
                                    <SelectItem value="tcp">TCP</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            
                            {/* Healthy Thresholds */}
                            <div className="space-y-2 pt-2 border-t">
                              <Label className="text-sm">Healthy Thresholds</Label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Successes</Label>
                                  <Input
                                    type="number"
                                    value={upstream.healthchecks?.passive?.healthy?.successes || ''}
                                    onChange={(e) => updateUpstream(originalIndex, 'healthchecks.passive.healthy.successes', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                    placeholder="1"
                                    min="0"
                                  />
                                </div>
                              </div>
                            </div>
                            
                            {/* Unhealthy Thresholds */}
                            <div className="space-y-2 pt-2 border-t">
                              <Label className="text-sm">Unhealthy Thresholds</Label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Timeouts</Label>
                                  <Input
                                    type="number"
                                    value={upstream.healthchecks?.passive?.unhealthy?.timeouts || ''}
                                    onChange={(e) => updateUpstream(originalIndex, 'healthchecks.passive.unhealthy.timeouts', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                    placeholder="0"
                                    min="0"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>TCP Failures</Label>
                                  <Input
                                    type="number"
                                    value={upstream.healthchecks?.passive?.unhealthy?.tcp_failures || ''}
                                    onChange={(e) => updateUpstream(originalIndex, 'healthchecks.passive.unhealthy.tcp_failures', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                    placeholder="0"
                                    min="0"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>HTTP Failures</Label>
                                  <Input
                                    type="number"
                                    value={upstream.healthchecks?.passive?.unhealthy?.http_failures || ''}
                                    onChange={(e) => updateUpstream(originalIndex, 'healthchecks.passive.unhealthy.http_failures', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                    placeholder="0"
                                    min="0"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Targets */}
                        <div className="space-y-2 pt-4 border-t">
                          <div className="flex items-center justify-between">
                            <Label>Targets</Label>
                            <Button variant="outline" size="sm" onClick={() => addUpstreamTarget(originalIndex)}>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Target
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {upstream.targets?.map((target, targetIndex) => (
                              <Card key={targetIndex} className="border">
                                <CardContent className="p-4 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1">
                                      <Badge variant={target.health === 'healthy' ? 'default' : target.health === 'draining' ? 'secondary' : 'destructive'}>
                                        {target.health || 'healthy'}
                                      </Badge>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeUpstreamTarget(originalIndex, targetIndex)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label>Target (host:port)</Label>
                                      <Input
                                        value={target.target}
                                        onChange={(e) => updateUpstreamTarget(originalIndex, targetIndex, 'target', e.target.value)}
                                        placeholder="server:8080"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Weight</Label>
                                      <Input
                                        type="number"
                                        value={target.weight || ''}
                                        onChange={(e) => updateUpstreamTarget(originalIndex, targetIndex, 'weight', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                        placeholder="100"
                                        min="0"
                                      />
                                    </div>
                                  </div>
                                  {target.tags && target.tags.length > 0 && (
                                    <div className="space-y-2">
                                      <Label>Tags</Label>
                                      <div className="flex flex-wrap gap-2">
                                        {target.tags.map((tag, tagIndex) => (
                                          <Badge key={tagIndex} variant="outline">{tag}</Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                            {(!upstream.targets || upstream.targets.length === 0) && (
                              <p className="text-sm text-muted-foreground text-center py-4">No targets configured</p>
                            )}
                          </div>
                        </div>
                        {upstreamServices.length > 0 && (
                          <div className="space-y-2 pt-4 border-t">
                            <Label>Associated Services ({upstreamServices.length})</Label>
                            <div className="space-y-1">
                              {upstreamServices.map((service, serviceIndex) => (
                                <div key={serviceIndex} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                                  <Network className="h-3 w-3" />
                                  <span className="font-mono">{service.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {service.protocol || 'http'}://{service.host || 'localhost'}:{service.port || 80}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                  );
                })}
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
                <Button size="sm" onClick={() => setShowCreateConsumer(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Consumer
                </Button>
              </CardHeader>
              {showCreateConsumer && (
                <CardContent className="border-b pb-4 mb-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Username *</Label>
                        <Input 
                          placeholder="new-consumer" 
                          value={newConsumerUsername}
                          onChange={(e) => setNewConsumerUsername(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Custom ID</Label>
                        <Input 
                          placeholder="custom-id" 
                          value={newConsumerCustomId}
                          onChange={(e) => setNewConsumerCustomId(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Tags (comma-separated)</Label>
                      <Input 
                        placeholder="tag1, tag2, tag3" 
                        value={newConsumerTags}
                        onChange={(e) => setNewConsumerTags(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addConsumer}>Create Consumer</Button>
                      <Button variant="outline" onClick={() => {
                        setShowCreateConsumer(false);
                        setNewConsumerUsername('');
                        setNewConsumerCustomId('');
                        setNewConsumerTags('');
                      }}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent className="space-y-4">
                <div className="mb-4">
                  <Input
                    placeholder="Search consumers..."
                    value={consumerSearch}
                    onChange={(e) => setConsumerSearch(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                {filteredConsumers.length === 0 && consumerSearch && (
                  <p className="text-sm text-muted-foreground text-center py-4">No consumers found matching "{consumerSearch}"</p>
                )}
                {filteredConsumers.length === 0 && !consumerSearch && (
                  <p className="text-sm text-muted-foreground text-center py-8">No consumers configured</p>
                )}
                {filteredConsumers.map((consumer) => {
                  const originalIndex = consumers.findIndex(c => c.id === consumer.id || (c.username === consumer.username && c.customId === consumer.customId));
                  const credentialTypes = consumer.credentials?.map(c => c.type) || [];
                  const uniqueCredentialTypes = [...new Set(credentialTypes)];
                  
                  return (
                    <div key={originalIndex} className="p-4 border border-border rounded-lg bg-card space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="font-semibold">{consumer.username || consumer.id}</div>
                          {(consumer.customId || consumer.custom_id) && (
                            <div className="text-sm text-muted-foreground">
                              Custom ID: {consumer.customId || consumer.custom_id}
                            </div>
                          )}
                          {consumer.tags && consumer.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {consumer.tags.map((tag, tagIndex) => (
                                <Badge key={tagIndex} variant="outline" className="text-xs">{tag}</Badge>
                              ))}
                            </div>
                          )}
                          {consumer.credentials && consumer.credentials.length > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                              <div className="text-xs text-muted-foreground">
                                {consumer.credentials.length} credential(s):
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {uniqueCredentialTypes.map((type, typeIndex) => {
                                  const count = credentialTypes.filter(t => t === type).length;
                                  return (
                                    <Badge key={typeIndex} variant="secondary" className="text-xs">
                                      {type} {count > 1 ? `(${count})` : ''}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingConsumerIndex(editingConsumerIndex === originalIndex ? null : originalIndex)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            {editingConsumerIndex === originalIndex ? 'Hide' : 'Edit'}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setDeleteConsumerConfirm(originalIndex)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {editingConsumerIndex === originalIndex && (
                        <div className="space-y-4 pt-3 border-t">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Username *</Label>
                              <Input
                                value={consumer.username || ''}
                                onChange={(e) => updateConsumer(originalIndex, 'username', e.target.value)}
                                placeholder="consumer-username"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Custom ID</Label>
                              <Input
                                value={consumer.customId || consumer.custom_id || ''}
                                onChange={(e) => updateConsumer(originalIndex, 'customId', e.target.value)}
                                placeholder="custom-id"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Tags (comma-separated)</Label>
                            <Input
                              value={consumer.tags?.join(', ') || ''}
                              onChange={(e) => updateConsumer(originalIndex, 'tags', e.target.value)}
                              placeholder="tag1, tag2, tag3"
                            />
                          </div>
                          <div className="space-y-2 pt-2 border-t">
                            <div className="flex items-center justify-between">
                              <Label>Credentials</Label>
                              <div className="flex gap-2 flex-wrap">
                                <Button variant="outline" size="sm" onClick={() => addConsumerCredential(originalIndex, 'key-auth')}>
                                  <Plus className="h-4 w-4 mr-2" />
                                  Key Auth
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => addConsumerCredential(originalIndex, 'jwt')}>
                                  <Plus className="h-4 w-4 mr-2" />
                                  JWT
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => addConsumerCredential(originalIndex, 'oauth2')}>
                                  <Plus className="h-4 w-4 mr-2" />
                                  OAuth2
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => addConsumerCredential(originalIndex, 'basic-auth')}>
                                  <Plus className="h-4 w-4 mr-2" />
                                  Basic Auth
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => addConsumerCredential(originalIndex, 'hmac-auth')}>
                                  <Plus className="h-4 w-4 mr-2" />
                                  HMAC Auth
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => addConsumerCredential(originalIndex, 'ldap-auth')}>
                                  <Plus className="h-4 w-4 mr-2" />
                                  LDAP Auth
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => addConsumerCredential(originalIndex, 'mtls-auth')}>
                                  <Plus className="h-4 w-4 mr-2" />
                                  mTLS Auth
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-3">
                              {consumer.credentials?.map((cred, credIndex) => (
                                <Card key={credIndex} className="border">
                                  <CardContent className="p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <Badge>{cred.type}</Badge>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setDeleteCredentialConfirm({ consumerIndex: originalIndex, credIndex })}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                    
                                    {/* Key Auth */}
                                    {cred.type === 'key-auth' && (
                                      <div className="space-y-2">
                                        <div className="space-y-1">
                                          <Label className="text-xs">Key</Label>
                                          <Input
                                            className="font-mono text-xs"
                                            value={cred.key || ''}
                                            onChange={(e) => updateConsumerCredential(originalIndex, credIndex, 'key', e.target.value)}
                                            placeholder="api-key"
                                          />
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* JWT */}
                                    {cred.type === 'jwt' && (
                                      <div className="space-y-2">
                                        <div className="space-y-1">
                                          <Label className="text-xs">Secret</Label>
                                          <Input
                                            className="font-mono text-xs"
                                            type="password"
                                            value={cred.secret || ''}
                                            onChange={(e) => updateConsumerCredential(originalIndex, credIndex, 'secret', e.target.value)}
                                            placeholder="jwt-secret"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">Algorithm</Label>
                                          <Select
                                            value={cred.algorithm || 'HS256'}
                                            onValueChange={(value) => updateConsumerCredential(originalIndex, credIndex, 'algorithm', value)}
                                          >
                                            <SelectTrigger className="h-8 text-xs">
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
                                        <div className="space-y-1">
                                          <Label className="text-xs">RSA Public Key</Label>
                                          <Textarea
                                            className="font-mono text-xs"
                                            value={cred.rsa_public_key || cred.rsaPublicKey || ''}
                                            onChange={(e) => updateConsumerCredential(originalIndex, credIndex, 'rsa_public_key', e.target.value)}
                                            placeholder="-----BEGIN PUBLIC KEY-----..."
                                            rows={3}
                                          />
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* OAuth2 */}
                                    {cred.type === 'oauth2' && (
                                      <div className="space-y-2">
                                        <div className="space-y-1">
                                          <Label className="text-xs">Name</Label>
                                          <Input
                                            className="text-xs"
                                            value={cred.name || ''}
                                            onChange={(e) => updateConsumerCredential(originalIndex, credIndex, 'name', e.target.value)}
                                            placeholder="oauth2-app-name"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">Client ID</Label>
                                          <Input
                                            className="font-mono text-xs"
                                            value={cred.client_id || ''}
                                            onChange={(e) => updateConsumerCredential(originalIndex, credIndex, 'client_id', e.target.value)}
                                            placeholder="client-id"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">Client Secret</Label>
                                          <Input
                                            className="font-mono text-xs"
                                            type="password"
                                            value={cred.client_secret || ''}
                                            onChange={(e) => updateConsumerCredential(originalIndex, credIndex, 'client_secret', e.target.value)}
                                            placeholder="client-secret"
                                          />
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Basic Auth */}
                                    {cred.type === 'basic-auth' && (
                                      <div className="space-y-2">
                                        <div className="space-y-1">
                                          <Label className="text-xs">Username</Label>
                                          <Input
                                            className="text-xs"
                                            value={cred.username || ''}
                                            onChange={(e) => updateConsumerCredential(originalIndex, credIndex, 'username', e.target.value)}
                                            placeholder="username"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">Password</Label>
                                          <Input
                                            className="font-mono text-xs"
                                            type="password"
                                            value={cred.password || ''}
                                            onChange={(e) => updateConsumerCredential(originalIndex, credIndex, 'password', e.target.value)}
                                            placeholder="password"
                                          />
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* HMAC Auth */}
                                    {cred.type === 'hmac-auth' && (
                                      <div className="space-y-2">
                                        <div className="space-y-1">
                                          <Label className="text-xs">Username</Label>
                                          <Input
                                            className="text-xs"
                                            value={cred.username || ''}
                                            onChange={(e) => updateConsumerCredential(originalIndex, credIndex, 'username', e.target.value)}
                                            placeholder="username"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">Secret</Label>
                                          <Input
                                            className="font-mono text-xs"
                                            type="password"
                                            value={cred.secret || ''}
                                            onChange={(e) => updateConsumerCredential(originalIndex, credIndex, 'secret', e.target.value)}
                                            placeholder="hmac-secret"
                                          />
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* LDAP Auth */}
                                    {cred.type === 'ldap-auth' && (
                                      <div className="space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                          <div className="space-y-1">
                                            <Label className="text-xs">LDAP Host</Label>
                                            <Input
                                              className="text-xs"
                                              value={cred.ldap_host || ''}
                                              onChange={(e) => updateConsumerCredential(originalIndex, credIndex, 'ldap_host', e.target.value)}
                                              placeholder="ldap.example.com"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">LDAP Port</Label>
                                            <Input
                                              className="text-xs"
                                              type="number"
                                              value={cred.ldap_port || ''}
                                              onChange={(e) => updateConsumerCredential(originalIndex, credIndex, 'ldap_port', e.target.value ? parseInt(e.target.value, 10) : 389)}
                                              placeholder="389"
                                            />
                                          </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          <Switch
                                            checked={cred.start_tls || false}
                                            onCheckedChange={(checked) => updateConsumerCredential(originalIndex, credIndex, 'start_tls', checked)}
                                          />
                                          <Label className="text-xs">Start TLS</Label>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* mTLS Auth */}
                                    {cred.type === 'mtls-auth' && (
                                      <div className="space-y-2">
                                        <div className="space-y-1">
                                          <Label className="text-xs">Certificate</Label>
                                          <Textarea
                                            className="font-mono text-xs"
                                            value={cred.certificate || ''}
                                            onChange={(e) => updateConsumerCredential(originalIndex, credIndex, 'certificate', e.target.value)}
                                            placeholder="-----BEGIN CERTIFICATE-----..."
                                            rows={4}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              ))}
                              {(!consumer.credentials || consumer.credentials.length === 0) && (
                                <p className="text-sm text-muted-foreground text-center py-4">No credentials configured</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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
                <Button size="sm" onClick={() => setShowCreatePlugin(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Plugin
                </Button>
              </CardHeader>
              {showCreatePlugin && (
                <CardContent className="border-b pb-4 mb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Plugin Name</Label>
                      <Select value={newPluginName} onValueChange={setNewPluginName}>
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
                          <SelectItem value="http-log">HTTP Log</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addPlugin}>Add Plugin</Button>
                      <Button variant="outline" onClick={() => {
                        setShowCreatePlugin(false);
                        setNewPluginName('rate-limiting');
                      }}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardContent>
                <div className="mb-4">
                  <Input
                    placeholder="Search plugins..."
                    value={pluginSearch}
                    onChange={(e) => setPluginSearch(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                <div className="space-y-3">
                  {filteredPlugins.length === 0 && pluginSearch && (
                    <p className="text-sm text-muted-foreground text-center py-4">No plugins found matching "{pluginSearch}"</p>
                  )}
                  {filteredPlugins.length === 0 && !pluginSearch && (
                    <p className="text-sm text-muted-foreground text-center py-4">No plugins configured</p>
                  )}
                  {filteredPlugins.map((plugin) => {
                    const originalIndex = plugins.findIndex(p => p.id === plugin.id || (p.name === plugin.name && p.service === plugin.service && p.route === plugin.route));
                    return (
                      <div key={plugin.id || originalIndex} className="p-4 border border-border rounded-lg bg-card space-y-3">
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
                        <Badge variant={plugin.service ? 'default' : plugin.route ? 'secondary' : plugin.consumer ? 'outline' : 'secondary'}>
                          {plugin.service ? 'Service' : plugin.route ? 'Route' : plugin.consumer ? 'Consumer' : 'Global'}
                        </Badge>
                        <Switch
                          checked={plugin.enabled}
                          onCheckedChange={(checked) => updatePlugin(originalIndex, 'enabled', checked)}
                        />
                        <Button variant="ghost" size="icon" onClick={() => setDeletePluginConfirm(originalIndex)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingPluginIndex(editingPluginIndex === originalIndex ? null : originalIndex)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        {editingPluginIndex === originalIndex ? 'Hide Config' : 'Edit Config'}
                      </Button>
                    </div>
                    {editingPluginIndex === originalIndex && (
                      <div className="space-y-4 pt-2 border-t">
                        {/* Plugin-specific UI forms */}
                        {plugin.name === 'rate-limiting' && (
                          <div className="space-y-4">
                            <Label className="text-sm font-semibold">Rate Limiting Configuration</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Minute Limit</Label>
                                <Input
                                  type="number"
                                  value={plugin.config?.minute || ''}
                                  onChange={(e) => updatePluginConfig(originalIndex, 'minute', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                  placeholder="1000"
                                  min="0"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Hour Limit</Label>
                                <Input
                                  type="number"
                                  value={plugin.config?.hour || ''}
                                  onChange={(e) => updatePluginConfig(originalIndex, 'hour', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                  placeholder="10000"
                                  min="0"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Day Limit</Label>
                                <Input
                                  type="number"
                                  value={plugin.config?.day || ''}
                                  onChange={(e) => updatePluginConfig(originalIndex, 'day', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                  placeholder="100000"
                                  min="0"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Limit By</Label>
                                <Select
                                  value={plugin.config?.limit_by || 'consumer'}
                                  onValueChange={(value) => updatePluginConfig(originalIndex, 'limit_by', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="consumer">Consumer</SelectItem>
                                    <SelectItem value="ip">IP</SelectItem>
                                    <SelectItem value="credential">Credential</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Policy</Label>
                                <Select
                                  value={plugin.config?.policy || 'local'}
                                  onValueChange={(value) => updatePluginConfig(originalIndex, 'policy', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="local">Local</SelectItem>
                                    <SelectItem value="redis">Redis</SelectItem>
                                    <SelectItem value="cluster">Cluster</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            {plugin.config?.policy === 'redis' && (
                              <div className="space-y-4 pt-2 border-t">
                                <Label className="text-sm font-semibold">Redis Configuration</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Redis Host</Label>
                                    <Input
                                      value={plugin.config?.redis?.host || ''}
                                      onChange={(e) => updatePluginConfig(originalIndex, 'redis.host', e.target.value)}
                                      placeholder="localhost"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Redis Port</Label>
                                    <Input
                                      type="number"
                                      value={plugin.config?.redis?.port || ''}
                                      onChange={(e) => updatePluginConfig(originalIndex, 'redis.port', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                      placeholder="6379"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Redis Password</Label>
                                    <Input
                                      type="password"
                                      value={plugin.config?.redis?.password || ''}
                                      onChange={(e) => updatePluginConfig(originalIndex, 'redis.password', e.target.value)}
                                      placeholder="password"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Redis Database</Label>
                                    <Input
                                      type="number"
                                      value={plugin.config?.redis?.database || ''}
                                      onChange={(e) => updatePluginConfig(originalIndex, 'redis.database', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                      placeholder="0"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {plugin.name === 'key-auth' && (
                          <div className="space-y-4">
                            <Label className="text-sm font-semibold">Key Auth Configuration</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Key Names (comma-separated)</Label>
                                <Input
                                  value={Array.isArray(plugin.config?.key_names) ? plugin.config.key_names.join(', ') : plugin.config?.key_names || 'apikey'}
                                  onChange={(e) => updatePluginConfig(originalIndex, 'key_names', e.target.value.split(',').map(k => k.trim()))}
                                  placeholder="apikey, X-API-Key"
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <Switch
                                    checked={plugin.config?.hide_credentials || false}
                                    onCheckedChange={(checked) => updatePluginConfig(originalIndex, 'hide_credentials', checked)}
                                  />
                                  <Label>Hide Credentials</Label>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {plugin.name === 'jwt' && (
                          <div className="space-y-4">
                            <Label className="text-sm font-semibold">JWT Configuration</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Secret is Base64</Label>
                                <div className="flex items-center space-x-2">
                                  <Switch
                                    checked={plugin.config?.secret_is_base64 || false}
                                    onCheckedChange={(checked) => updatePluginConfig(originalIndex, 'secret_is_base64', checked)}
                                  />
                                  <Label>Enabled</Label>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Run On</Label>
                                <Select
                                  value={plugin.config?.run_on || 'first'}
                                  onValueChange={(value) => updatePluginConfig(originalIndex, 'run_on', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="first">First</SelectItem>
                                    <SelectItem value="all">All</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {plugin.name === 'cors' && (
                          <div className="space-y-4">
                            <Label className="text-sm font-semibold">CORS Configuration</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Origins (comma-separated, * for all)</Label>
                                <Input
                                  value={Array.isArray(plugin.config?.origins) ? plugin.config.origins.join(', ') : plugin.config?.origins || '*'}
                                  onChange={(e) => updatePluginConfig(originalIndex, 'origins', e.target.value.split(',').map(o => o.trim()))}
                                  placeholder="*, https://example.com"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Methods (comma-separated)</Label>
                                <Input
                                  value={Array.isArray(plugin.config?.methods) ? plugin.config.methods.join(', ') : plugin.config?.methods || 'GET, POST'}
                                  onChange={(e) => updatePluginConfig(originalIndex, 'methods', e.target.value.split(',').map(m => m.trim()))}
                                  placeholder="GET, POST, PUT, DELETE"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Headers</Label>
                                <Input
                                  value={Array.isArray(plugin.config?.headers) ? plugin.config.headers.join(', ') : plugin.config?.headers || ''}
                                  onChange={(e) => updatePluginConfig(originalIndex, 'headers', e.target.value ? e.target.value.split(',').map(h => h.trim()) : undefined)}
                                  placeholder="Content-Type, Authorization"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Exposed Headers</Label>
                                <Input
                                  value={Array.isArray(plugin.config?.exposed_headers) ? plugin.config.exposed_headers.join(', ') : plugin.config?.exposed_headers || ''}
                                  onChange={(e) => updatePluginConfig(originalIndex, 'exposed_headers', e.target.value ? e.target.value.split(',').map(h => h.trim()) : undefined)}
                                  placeholder="X-Custom-Header"
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <Switch
                                    checked={plugin.config?.credentials || false}
                                    onCheckedChange={(checked) => updatePluginConfig(originalIndex, 'credentials', checked)}
                                  />
                                  <Label>Credentials</Label>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Max Age (seconds)</Label>
                                <Input
                                  type="number"
                                  value={plugin.config?.max_age || ''}
                                  onChange={(e) => updatePluginConfig(originalIndex, 'max_age', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                  placeholder="3600"
                                  min="0"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {plugin.name === 'ip-restriction' && (
                          <div className="space-y-4">
                            <Label className="text-sm font-semibold">IP Restriction Configuration</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Whitelist (comma-separated IPs)</Label>
                                <Input
                                  value={Array.isArray(plugin.config?.whitelist) ? plugin.config.whitelist.join(', ') : plugin.config?.whitelist || ''}
                                  onChange={(e) => updatePluginConfig(originalIndex, 'whitelist', e.target.value ? e.target.value.split(',').map(ip => ip.trim()) : [])}
                                  placeholder="192.168.1.1, 10.0.0.0/8"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Blacklist (comma-separated IPs)</Label>
                                <Input
                                  value={Array.isArray(plugin.config?.blacklist) ? plugin.config.blacklist.join(', ') : plugin.config?.blacklist || ''}
                                  onChange={(e) => updatePluginConfig(originalIndex, 'blacklist', e.target.value ? e.target.value.split(',').map(ip => ip.trim()) : [])}
                                  placeholder="192.168.1.100"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {plugin.name === 'file-log' && (
                          <div className="space-y-4">
                            <Label className="text-sm font-semibold">File Log Configuration</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Path</Label>
                                <Input
                                  value={plugin.config?.path || ''}
                                  onChange={(e) => updatePluginConfig(originalIndex, 'path', e.target.value)}
                                  placeholder="/tmp/kong-access.log"
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <Switch
                                    checked={plugin.config?.reopen || false}
                                    onCheckedChange={(checked) => updatePluginConfig(originalIndex, 'reopen', checked)}
                                  />
                                  <Label>Reopen</Label>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {plugin.name === 'http-log' && (
                          <div className="space-y-4">
                            <Label className="text-sm font-semibold">HTTP Log Configuration</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>HTTP Endpoint</Label>
                                <Input
                                  value={plugin.config?.http_endpoint || ''}
                                  onChange={(e) => updatePluginConfig(originalIndex, 'http_endpoint', e.target.value)}
                                  placeholder="http://localhost:8080/logs"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Method</Label>
                                <Select
                                  value={plugin.config?.method || 'POST'}
                                  onValueChange={(value) => updatePluginConfig(originalIndex, 'method', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="POST">POST</SelectItem>
                                    <SelectItem value="PUT">PUT</SelectItem>
                                    <SelectItem value="PATCH">PATCH</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Timeout (ms)</Label>
                                <Input
                                  type="number"
                                  value={plugin.config?.timeout || ''}
                                  onChange={(e) => updatePluginConfig(originalIndex, 'timeout', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                  placeholder="10000"
                                  min="0"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Keepalive (ms)</Label>
                                <Input
                                  type="number"
                                  value={plugin.config?.keepalive || ''}
                                  onChange={(e) => updatePluginConfig(originalIndex, 'keepalive', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                  placeholder="60000"
                                  min="0"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Fallback to JSON editor for unsupported plugins */}
                        {!['rate-limiting', 'key-auth', 'jwt', 'cors', 'ip-restriction', 'file-log', 'http-log'].includes(plugin.name) && (
                          <div className="space-y-2">
                            <Label>Configuration (JSON)</Label>
                            <Textarea
                              className="font-mono text-xs"
                              rows={6}
                              value={JSON.stringify(plugin.config || {}, null, 2)}
                              onChange={(e) => {
                                try {
                                  const parsed = JSON.parse(e.target.value);
                                  updatePlugin(originalIndex, 'config', parsed);
                                } catch (error) {
                                  showError(`Неверный формат JSON: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
                                }
                              }}
                              placeholder='{"key": "value"}'
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                    );
                  })}
                </div>
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
      </div>

      {/* Delete Consumer Confirmation Dialog */}
      <AlertDialog open={deleteConsumerConfirm !== null} onOpenChange={(open) => !open && setDeleteConsumerConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete consumer <strong>{deleteConsumerConfirm !== null ? consumers[deleteConsumerConfirm]?.username || consumers[deleteConsumerConfirm]?.id : ''}</strong>? 
              {deleteConsumerConfirm !== null && consumers[deleteConsumerConfirm]?.credentials && consumers[deleteConsumerConfirm].credentials!.length > 0 && (
                <span className="block mt-2 text-destructive">
                  This consumer has {consumers[deleteConsumerConfirm].credentials!.length} credential(s). Please remove them first.
                </span>
              )}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConsumerConfirm !== null && confirmRemoveConsumer(deleteConsumerConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Credential Confirmation Dialog */}
      <AlertDialog open={deleteCredentialConfirm !== null} onOpenChange={(open) => !open && setDeleteCredentialConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {deleteCredentialConfirm ? consumers[deleteCredentialConfirm.consumerIndex]?.credentials?.[deleteCredentialConfirm.credIndex]?.type : ''} credential? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteCredentialConfirm) {
                  confirmRemoveConsumerCredential(deleteCredentialConfirm.consumerIndex, deleteCredentialConfirm.credIndex);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Service Confirmation Dialog */}
      <AlertDialog open={deleteServiceConfirm !== null} onOpenChange={(open) => !open && setDeleteServiceConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete service <strong>{deleteServiceConfirm !== null ? services[deleteServiceConfirm]?.name || 'Unknown' : ''}</strong>?
              {deleteServiceConfirm !== null && getServiceRoutes(services[deleteServiceConfirm]?.id || services[deleteServiceConfirm]?.name || '').length > 0 && (
                <span className="block mt-2 text-destructive">
                  This service has {getServiceRoutes(services[deleteServiceConfirm]?.id || services[deleteServiceConfirm]?.name || '').length} route(s). Please remove them first.
                </span>
              )}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteServiceConfirm !== null && confirmRemoveService(deleteServiceConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Route Confirmation Dialog */}
      <AlertDialog open={deleteRouteConfirm !== null} onOpenChange={(open) => !open && setDeleteRouteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete route <strong>{deleteRouteConfirm !== null ? routes[deleteRouteConfirm]?.name || routes[deleteRouteConfirm]?.paths?.[0] || 'Unknown' : ''}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteRouteConfirm !== null && confirmRemoveRoute(deleteRouteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Upstream Confirmation Dialog */}
      <AlertDialog open={deleteUpstreamConfirm !== null} onOpenChange={(open) => !open && setDeleteUpstreamConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete upstream <strong>{deleteUpstreamConfirm !== null ? upstreams[deleteUpstreamConfirm]?.name || 'Unknown' : ''}</strong>?
              {deleteUpstreamConfirm !== null && services.filter(s => s.upstream === upstreams[deleteUpstreamConfirm]?.name).length > 0 && (
                <span className="block mt-2 text-destructive">
                  This upstream is used by {services.filter(s => s.upstream === upstreams[deleteUpstreamConfirm]?.name).length} service(s). Please remove them first.
                </span>
              )}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUpstreamConfirm !== null && confirmRemoveUpstream(deleteUpstreamConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Plugin Confirmation Dialog */}
      <AlertDialog open={deletePluginConfirm !== null} onOpenChange={(open) => !open && setDeletePluginConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete plugin <strong>{deletePluginConfirm !== null ? plugins[deletePluginConfirm]?.name || 'Unknown' : ''}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePluginConfirm !== null && confirmRemovePlugin(deletePluginConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


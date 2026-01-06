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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect, useMemo } from 'react';
import { showSuccess, showError, showValidationError } from '@/utils/toast';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Network,
  Shield,
  Route,
  Globe,
  CheckCircle,
  AlertTriangle,
  Layers,
  Search,
  Edit,
  Filter,
  X,
  Info
} from 'lucide-react';

interface ServiceMeshConfigProps {
  componentId: string;
}

interface Service {
  id: string;
  name: string;
  namespace: string;
  version?: string;
  pods?: number;
  healthyPods?: number;
  requests?: number;
  errors?: number;
  latency?: number;
}

interface VirtualService {
  id: string;
  name: string;
  namespace?: string;
  hosts: string[];
  gateways?: string[];
  http?: Array<{
    match?: Array<{ uri?: { prefix?: string } }>;
    route?: Array<{ destination: { host: string; subset?: string }; weight?: number }>;
  }>;
}

interface DestinationRule {
  id: string;
  name: string;
  namespace?: string;
  host: string;
  subsets?: Array<{
    name: string;
    labels?: Record<string, string>;
    trafficPolicy?: {
      loadBalancer?: { simple?: 'ROUND_ROBIN' | 'LEAST_CONN' | 'RANDOM' };
      connectionPool?: {
        tcp?: { maxConnections?: number; connectTimeout?: string };
        http?: { http1MaxPendingRequests?: number; http2MaxRequests?: number; maxRequestsPerConnection?: number; idleTimeout?: string };
      };
      outlierDetection?: {
        consecutiveErrors?: number;
        interval?: string;
        baseEjectionTime?: string;
        maxEjectionPercent?: number;
        minHealthPercent?: number;
      };
    };
  }>;
  trafficPolicy?: {
    loadBalancer?: { simple?: 'ROUND_ROBIN' | 'LEAST_CONN' | 'RANDOM' };
    connectionPool?: {
      tcp?: { maxConnections?: number; connectTimeout?: string };
      http?: { http1MaxPendingRequests?: number; http2MaxRequests?: number; maxRequestsPerConnection?: number; idleTimeout?: string };
    };
    outlierDetection?: {
      consecutiveErrors?: number;
      interval?: string;
      baseEjectionTime?: string;
      maxEjectionPercent?: number;
      minHealthPercent?: number;
    };
    tls?: {
      mode?: 'DISABLE' | 'SIMPLE' | 'MUTUAL' | 'ISTIO_MUTUAL';
    };
  };
}

interface Gateway {
  id: string;
  name: string;
  namespace?: string;
  selector?: Record<string, string>;
  servers?: Array<{
    port: { number: number; protocol: string; name: string };
    hosts: string[];
  }>;
}

interface PeerAuthentication {
  id: string;
  name: string;
  namespace?: string;
  selector?: { matchLabels?: Record<string, string> };
  mtls?: { mode: 'STRICT' | 'PERMISSIVE' | 'DISABLE' };
  portLevelMtls?: Record<number, { mode: 'STRICT' | 'PERMISSIVE' | 'DISABLE' }>;
}

interface AuthorizationPolicy {
  id: string;
  name: string;
  namespace?: string;
  selector?: { matchLabels?: Record<string, string> };
  action?: 'ALLOW' | 'DENY' | 'AUDIT' | 'CUSTOM';
  rules?: Array<{
    from?: Array<{ source?: { principals?: string[]; namespaces?: string[]; ipBlocks?: string[] } }>;
    to?: Array<{ operation?: { hosts?: string[]; methods?: string[]; paths?: string[] } }>;
    when?: Array<{ key: string; values?: string[] }>;
  }>;
}

interface ServiceEntry {
  id: string;
  name: string;
  namespace?: string;
  hosts: string[];
  addresses?: string[];
  ports?: Array<{ number: number; protocol: string; name: string }>;
  location?: 'MESH_EXTERNAL' | 'MESH_INTERNAL';
  resolution?: 'NONE' | 'STATIC' | 'DNS';
  endpoints?: Array<{ address: string; ports?: Record<string, number>; labels?: Record<string, string> }>;
}

interface Sidecar {
  id: string;
  name: string;
  namespace?: string;
  workloadSelector?: { labels?: Record<string, string> };
  egress?: Array<{ hosts: string[]; port?: { number: number; protocol: string } }>;
  ingress?: Array<{ port: { number: number; protocol: string }; defaultEndpoint?: string }>;
}

interface ServiceMeshConfig {
  services?: Service[];
  virtualServices?: VirtualService[];
  destinationRules?: DestinationRule[];
  gateways?: Gateway[];
  peerAuthentications?: PeerAuthentication[];
  authorizationPolicies?: AuthorizationPolicy[];
  serviceEntries?: ServiceEntry[];
  sidecars?: Sidecar[];
  totalServices?: number;
  totalRequests?: number;
  totalErrors?: number;
  averageLatency?: number;
  enableMTLS?: boolean;
  mtlsMode?: 'STRICT' | 'PERMISSIVE' | 'DISABLE';
  enableTracing?: boolean;
  tracingProvider?: 'jaeger' | 'zipkin' | 'datadog';
  enableMetrics?: boolean;
  metricsProvider?: 'prometheus' | 'statsd';
  enableAccessLog?: boolean;
  defaultLoadBalancer?: 'ROUND_ROBIN' | 'LEAST_CONN' | 'RANDOM';
  maxConnections?: number;
  defaultTimeout?: string;
  defaultRetryAttempts?: number;
  metrics?: {
    enabled?: boolean;
    controlPlanePort?: number;
    sidecarPort?: number;
    gatewayPort?: number;
  };
}

export function ServiceMeshConfigAdvanced({ componentId }: ServiceMeshConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { getComponentMetrics } = useEmulationStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as ServiceMeshConfig;
  const componentMetrics = getComponentMetrics(componentId);
  const routingEngine = emulationEngine.getServiceMeshRoutingEngine(componentId);
  
  // Все данные только из конфига или пустые массивы - никаких статических дефолтов
  const services = config.services || [];
  const virtualServices = config.virtualServices || [];
  const destinationRules = config.destinationRules || [];
  const gateways = config.gateways || [];
  const peerAuthentications = config.peerAuthentications || [];
  const authorizationPolicies = config.authorizationPolicies || [];
  const serviceEntries = config.serviceEntries || [];
  const sidecars = config.sidecars || [];
  
  // Метрики только из эмуляции или 0
  const totalServices = services.length;
  const totalRequests = componentMetrics?.customMetrics?.total_requests || routingEngine?.getStats().totalRequests || 0;
  const totalErrors = componentMetrics?.customMetrics?.total_errors || routingEngine?.getStats().totalErrors || 0;
  const averageLatency = Math.round(
    componentMetrics?.customMetrics?.average_latency || 
    routingEngine?.getStats().averageLatency || 
    componentMetrics?.latency || 
    0
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [filterNamespace, setFilterNamespace] = useState<string>('all');
  
  // Modal states
  const [editingVirtualService, setEditingVirtualService] = useState<VirtualService | null>(null);
  const [editingDestinationRule, setEditingDestinationRule] = useState<DestinationRule | null>(null);
  const [editingGateway, setEditingGateway] = useState<Gateway | null>(null);
  const [editingPeerAuth, setEditingPeerAuth] = useState<PeerAuthentication | null>(null);
  const [editingAuthPolicy, setEditingAuthPolicy] = useState<AuthorizationPolicy | null>(null);
  const [editingServiceEntry, setEditingServiceEntry] = useState<ServiceEntry | null>(null);
  const [editingSidecar, setEditingSidecar] = useState<Sidecar | null>(null);
  
  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string; name: string } | null>(null);
  
  // Get unique namespaces for filter
  const namespaces = useMemo(() => {
    const nsSet = new Set<string>();
    services.forEach(s => s.namespace && nsSet.add(s.namespace));
    virtualServices.forEach(vs => vs.namespace && nsSet.add(vs.namespace));
    destinationRules.forEach(dr => dr.namespace && nsSet.add(dr.namespace));
    gateways.forEach(gw => gw.namespace && nsSet.add(gw.namespace));
    peerAuthentications.forEach(pa => pa.namespace && nsSet.add(pa.namespace));
    authorizationPolicies.forEach(ap => ap.namespace && nsSet.add(ap.namespace));
    serviceEntries.forEach(se => se.namespace && nsSet.add(se.namespace));
    sidecars.forEach(sc => sc.namespace && nsSet.add(sc.namespace));
    return Array.from(nsSet).sort();
  }, [services, virtualServices, destinationRules, gateways, peerAuthentications, authorizationPolicies, serviceEntries, sidecars]);
  
  // Filter functions
  const filterBySearch = <T extends { name: string; namespace?: string }>(items: T[]): T[] => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item => 
      item.name.toLowerCase().includes(query) ||
      (item.namespace && item.namespace.toLowerCase().includes(query))
    );
  };
  
  const filterByNamespace = <T extends { namespace?: string }>(items: T[]): T[] => {
    if (filterNamespace === 'all') return items;
    return items.filter(item => item.namespace === filterNamespace);
  };
  
  const filteredServices = useMemo(() => filterByNamespace(filterBySearch(services)), [services, searchQuery, filterNamespace]);
  const filteredVirtualServices = useMemo(() => filterByNamespace(filterBySearch(virtualServices)), [virtualServices, searchQuery, filterNamespace]);
  const filteredDestinationRules = useMemo(() => filterByNamespace(filterBySearch(destinationRules)), [destinationRules, searchQuery, filterNamespace]);
  const filteredGateways = useMemo(() => filterByNamespace(filterBySearch(gateways)), [gateways, searchQuery, filterNamespace]);
  const filteredPeerAuths = useMemo(() => filterByNamespace(filterBySearch(peerAuthentications)), [peerAuthentications, searchQuery, filterNamespace]);
  const filteredAuthPolicies = useMemo(() => filterByNamespace(filterBySearch(authorizationPolicies)), [authorizationPolicies, searchQuery, filterNamespace]);
  const filteredServiceEntries = useMemo(() => filterByNamespace(filterBySearch(serviceEntries)), [serviceEntries, searchQuery, filterNamespace]);
  const filteredSidecars = useMemo(() => filterByNamespace(filterBySearch(sidecars)), [sidecars, searchQuery, filterNamespace]);

  // Sync metrics from emulation engine and update routing engine config
  useEffect(() => {
    if (routingEngine) {
      // Update routing engine with current config
      routingEngine.updateConfig({
        services: services.map(s => ({
          id: s.id,
          name: s.name,
          namespace: s.namespace,
          host: `${s.name}.${s.namespace}.svc.cluster.local`,
          ports: [{ number: 80, protocol: 'HTTP' }],
          labels: {},
          requests: s.requests,
          errors: s.errors,
          latency: s.latency,
          pods: s.pods,
          healthyPods: s.healthyPods,
        })),
        virtualServices: virtualServices,
        destinationRules: destinationRules,
        gateways: gateways,
        peerAuthentications: peerAuthentications,
        authorizationPolicies: authorizationPolicies,
        serviceEntries: serviceEntries,
        sidecars: sidecars,
        globalConfig: {
          enableMTLS: config.enableMTLS,
          mtlsMode: config.mtlsMode,
          enableTracing: config.enableTracing,
          tracingProvider: config.tracingProvider,
          enableMetrics: config.enableMetrics,
          metricsProvider: config.metricsProvider,
          enableAccessLog: config.enableAccessLog,
          maxConnections: config.maxConnections,
          defaultTimeout: config.defaultTimeout,
          defaultRetryAttempts: config.defaultRetryAttempts,
          defaultLoadBalancer: config.defaultLoadBalancer,
        },
      });
    }
  }, [routingEngine, config, services, virtualServices, destinationRules, gateways, peerAuthentications, authorizationPolicies, serviceEntries, sidecars]);

  const updateConfig = (updates: Partial<ServiceMeshConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addVirtualService = () => {
    const newVS: VirtualService = {
      id: `vs-${Date.now()}`,
      name: 'new-virtual-service',
      namespace: 'default',
      hosts: ['example.com'],
      http: [
        {
          route: [{ destination: { host: 'service' }, weight: 100 }],
        },
      ],
    };
    updateConfig({ virtualServices: [...virtualServices, newVS] });
    setEditingVirtualService(newVS);
    showSuccess('Virtual Service created');
  };

  const removeVirtualService = (id: string) => {
    const vs = virtualServices.find(v => v.id === id);
    updateConfig({ virtualServices: virtualServices.filter((vs) => vs.id !== id) });
    showSuccess(`Virtual Service "${vs?.name || id}" deleted`);
  };

  const addDestinationRule = () => {
    const newDR: DestinationRule = {
      id: `dr-${Date.now()}`,
      name: 'new-destination-rule',
      namespace: 'default',
      host: 'service',
      subsets: [{ name: 'v1', labels: { version: 'v1' } }],
    };
    updateConfig({ destinationRules: [...destinationRules, newDR] });
    setEditingDestinationRule(newDR);
    showSuccess('Destination Rule created');
  };

  const removeDestinationRule = (id: string) => {
    const dr = destinationRules.find(d => d.id === id);
    updateConfig({ destinationRules: destinationRules.filter((dr) => dr.id !== id) });
    showSuccess(`Destination Rule "${dr?.name || id}" deleted`);
  };

  const addGateway = () => {
    const newGW: Gateway = {
      id: `gw-${Date.now()}`,
      name: 'new-gateway',
      namespace: 'default',
      selector: { 'service-mesh': 'ingressgateway' },
      servers: [
        {
          port: { number: 80, protocol: 'HTTP', name: 'http' },
          hosts: ['*'],
        },
      ],
    };
    updateConfig({ gateways: [...gateways, newGW] });
    setEditingGateway(newGW);
    showSuccess('Gateway created');
  };

  const removeGateway = (id: string) => {
    const gw = gateways.find(g => g.id === id);
    updateConfig({ gateways: gateways.filter((gw) => gw.id !== id) });
    showSuccess(`Gateway "${gw?.name || id}" deleted`);
  };

  const addPeerAuthentication = () => {
    const newPA: PeerAuthentication = {
      id: `pa-${Date.now()}`,
      name: 'new-peer-authentication',
      namespace: 'default',
      mtls: { mode: 'PERMISSIVE' },
    };
    updateConfig({ peerAuthentications: [...peerAuthentications, newPA] });
    setEditingPeerAuth(newPA);
    showSuccess('Peer Authentication created');
  };

  const removePeerAuthentication = (id: string) => {
    const pa = peerAuthentications.find(p => p.id === id);
    updateConfig({ peerAuthentications: peerAuthentications.filter((pa) => pa.id !== id) });
    showSuccess(`Peer Authentication "${pa?.name || id}" deleted`);
  };

  const addAuthorizationPolicy = () => {
    const newAP: AuthorizationPolicy = {
      id: `ap-${Date.now()}`,
      name: 'new-authorization-policy',
      namespace: 'default',
      action: 'ALLOW',
      rules: [],
    };
    updateConfig({ authorizationPolicies: [...authorizationPolicies, newAP] });
    setEditingAuthPolicy(newAP);
    showSuccess('Authorization Policy created');
  };

  const removeAuthorizationPolicy = (id: string) => {
    const ap = authorizationPolicies.find(a => a.id === id);
    updateConfig({ authorizationPolicies: authorizationPolicies.filter((ap) => ap.id !== id) });
    showSuccess(`Authorization Policy "${ap?.name || id}" deleted`);
  };

  const addServiceEntry = () => {
    const newSE: ServiceEntry = {
      id: `se-${Date.now()}`,
      name: 'new-service-entry',
      namespace: 'default',
      hosts: ['external.example.com'],
      location: 'MESH_EXTERNAL',
      resolution: 'DNS',
    };
    updateConfig({ serviceEntries: [...serviceEntries, newSE] });
    setEditingServiceEntry(newSE);
    showSuccess('Service Entry created');
  };

  const removeServiceEntry = (id: string) => {
    const se = serviceEntries.find(s => s.id === id);
    updateConfig({ serviceEntries: serviceEntries.filter((se) => se.id !== id) });
    showSuccess(`Service Entry "${se?.name || id}" deleted`);
  };

  const addSidecar = () => {
    const newSC: Sidecar = {
      id: `sc-${Date.now()}`,
      name: 'new-sidecar',
      namespace: 'default',
      egress: [],
      ingress: [],
    };
    updateConfig({ sidecars: [...sidecars, newSC] });
    setEditingSidecar(newSC);
    showSuccess('Sidecar created');
  };

  const removeSidecar = (id: string) => {
    const sc = sidecars.find(s => s.id === id);
    updateConfig({ sidecars: sidecars.filter((sc) => sc.id !== id) });
    showSuccess(`Sidecar "${sc?.name || id}" deleted`);
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Service Mesh</p>
            <h2 className="text-2xl font-bold text-foreground">Traffic Management</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Service mesh for microservices traffic management and security
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                if (routingEngine) {
                  routingEngine.resetStats();
                }
              }}
              title="Reset statistics"
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh Stats
            </Button>
          </div>
        </div>

        <Separator />

        {/* Search and Filter */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search services, policies, rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterNamespace} onValueChange={setFilterNamespace}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All namespaces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All namespaces</SelectItem>
                {namespaces.map(ns => (
                  <SelectItem key={ns} value={ns}>{ns}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Services</CardTitle>
                <Network className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalServices}</span>
                <span className="text-xs text-muted-foreground">registered</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Requests</CardTitle>
                <Activity className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalRequests.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Errors</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-red-600 dark:text-red-400">{totalErrors}</span>
                <span className="text-xs text-muted-foreground">total</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Latency</CardTitle>
                <Activity className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{averageLatency}</span>
                <span className="text-xs text-muted-foreground">ms</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="services" className="space-y-4">
          <div className="overflow-x-auto -mx-6 px-6 pb-2">
            <TabsList className="inline-flex w-auto min-w-full sm:flex-wrap sm:min-w-0 gap-1 h-auto py-1">
              <TabsTrigger value="services" className="whitespace-nowrap flex-shrink-0">
                <Network className="h-4 w-4 mr-1.5 sm:mr-2" />
                <span className="hidden sm:inline">Services</span>
                <span className="ml-1">({services.length})</span>
              </TabsTrigger>
              <TabsTrigger value="virtual-services" className="whitespace-nowrap flex-shrink-0">
                <Route className="h-4 w-4 mr-1.5 sm:mr-2" />
                <span className="hidden sm:inline">Virtual Services</span>
                <span className="ml-1">({virtualServices.length})</span>
              </TabsTrigger>
              <TabsTrigger value="destination-rules" className="whitespace-nowrap flex-shrink-0">
                <Layers className="h-4 w-4 mr-1.5 sm:mr-2" />
                <span className="hidden sm:inline">Destination Rules</span>
                <span className="ml-1">({destinationRules.length})</span>
              </TabsTrigger>
              <TabsTrigger value="gateways" className="whitespace-nowrap flex-shrink-0">
                <Globe className="h-4 w-4 mr-1.5 sm:mr-2" />
                <span className="hidden sm:inline">Gateways</span>
                <span className="ml-1">({gateways.length})</span>
              </TabsTrigger>
              <TabsTrigger value="peer-authentication" className="whitespace-nowrap flex-shrink-0">
                <Shield className="h-4 w-4 mr-1.5 sm:mr-2" />
                <span className="hidden sm:inline">Peer Auth</span>
                <span className="ml-1">({peerAuthentications.length})</span>
              </TabsTrigger>
              <TabsTrigger value="authorization-policy" className="whitespace-nowrap flex-shrink-0">
                <Shield className="h-4 w-4 mr-1.5 sm:mr-2" />
                <span className="hidden sm:inline">Auth Policy</span>
                <span className="ml-1">({authorizationPolicies.length})</span>
              </TabsTrigger>
              <TabsTrigger value="service-entry" className="whitespace-nowrap flex-shrink-0">
                <Network className="h-4 w-4 mr-1.5 sm:mr-2" />
                <span className="hidden sm:inline">Service Entry</span>
                <span className="ml-1">({serviceEntries.length})</span>
              </TabsTrigger>
              <TabsTrigger value="sidecar" className="whitespace-nowrap flex-shrink-0">
                <Layers className="h-4 w-4 mr-1.5 sm:mr-2" />
                <span className="hidden sm:inline">Sidecar</span>
                <span className="ml-1">({sidecars.length})</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="whitespace-nowrap flex-shrink-0">
                <Settings className="h-4 w-4 mr-1.5 sm:mr-2" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="services" className="space-y-4 mt-4">
            {/* Info alert about automatic service discovery */}
            <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertTitle className="text-blue-900 dark:text-blue-100">Automatic Service Discovery</AlertTitle>
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                Services are automatically added to the mesh when connections are created. 
                Create a connection from Service Mesh to any service (API, Database, Queue, etc.), 
                and the service will be automatically registered in the mesh with the correct protocol and port.
              </AlertDescription>
            </Alert>
            
            <Card>
              <CardHeader>
                <CardTitle>Services</CardTitle>
                <CardDescription>Registered services in the mesh</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredServices.length === 0 ? (
                    <div className="text-center py-8">
                      <Network className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                      <p className="text-sm text-muted-foreground">
                        {searchQuery || filterNamespace !== 'all' ? 'No services match the filter' : 'No services registered yet'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Создайте соединение от Service Mesh к сервису, чтобы автоматически добавить его в mesh
                      </p>
                    </div>
                  ) : (
                    filteredServices.map((service) => (
                    <Card key={service.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                              <Network className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{service.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline">{service.namespace}</Badge>
                                {service.version && (
                                  <Badge variant="outline">{service.version}</Badge>
                                )}
                                <Badge variant={service.healthyPods === service.pods ? 'default' : 'destructive'}>
                                  {service.healthyPods || 0}/{service.pods || 0} pods
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                // Service editing can be added here if needed
                              }}
                              className="hover:bg-primary/10"
                              disabled
                              title="Service editing coming soon"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteConfirm({ type: 'service', id: service.id, name: service.name })}
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Requests:</span>
                            <span className="ml-2 font-semibold">{service.requests?.toLocaleString() || 0}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Errors:</span>
                            <span className={`ml-2 font-semibold ${service.errors && service.errors > 0 ? 'text-red-500' : ''}`}>
                              {service.errors || 0}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Latency:</span>
                            <span className="ml-2 font-semibold">{service.latency || 0}ms</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Error Rate:</span>
                            <span className={`ml-2 font-semibold ${service.requests && service.errors && (service.errors / service.requests) > 0.01 ? 'text-red-500' : ''}`}>
                              {service.requests && service.errors ? ((service.errors / service.requests) * 100).toFixed(2) : 0}%
                            </span>
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

          <TabsContent value="virtual-services" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Virtual Services</CardTitle>
                    <CardDescription>Configure traffic routing rules</CardDescription>
                  </div>
                  <Button onClick={addVirtualService} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Virtual Service
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredVirtualServices.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {searchQuery || filterNamespace !== 'all' ? 'No virtual services match the filter' : 'No virtual services configured'}
                    </p>
                  ) : (
                    filteredVirtualServices.map((vs) => (
                    <Card key={vs.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                              <Route className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{vs.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                {vs.hosts.map((host, idx) => (
                                  <Badge key={idx} variant="outline" className="font-mono text-xs">
                                    {host}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingVirtualService(vs)}
                              className="hover:bg-primary/10"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteConfirm({ type: 'virtualService', id: vs.id, name: vs.name })}
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {vs.http && vs.http.length > 0 && (
                          <div className="space-y-2">
                            {vs.http.map((http, idx) => {
                              // Calculate total weight for this HTTP route
                              const totalWeight = http.route?.reduce((sum, route) => sum + (route.weight || 0), 0) || 0;
                              const hasMultipleRoutes = (http.route?.length || 0) > 1;
                              const weightsValid = totalWeight === 100 || (hasMultipleRoutes === false && totalWeight <= 100);
                              
                              return (
                                <div key={idx} className="p-3 border rounded">
                                  {hasMultipleRoutes && !weightsValid && (
                                    <Alert className="mb-2 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30">
                                      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                      <AlertTitle className="text-yellow-900 dark:text-yellow-100 text-xs">Invalid Route Weights</AlertTitle>
                                      <AlertDescription className="text-yellow-800 dark:text-yellow-200 text-xs">
                                        Route weights sum to {totalWeight}% (should be 100%)
                                      </AlertDescription>
                                    </Alert>
                                  )}
                                  {http.route && (
                                    <div className="space-y-1">
                                      {http.route.map((route, rIdx) => {
                                        // Calculate normalized weight if multiple routes
                                        const normalizedWeight = hasMultipleRoutes && totalWeight > 0 
                                          ? Math.round((route.weight || 0) / totalWeight * 100) 
                                          : route.weight;
                                        
                                        return (
                                          <div key={rIdx} className="text-sm">
                                            <span className="text-muted-foreground">→</span>
                                            <span className="ml-2 font-medium">{route.destination.host}</span>
                                            {route.destination.subset && (
                                              <Badge variant="outline" className="ml-2">{route.destination.subset}</Badge>
                                            )}
                                            {route.weight !== undefined && (
                                              <Badge 
                                                variant={hasMultipleRoutes && !weightsValid ? "destructive" : "outline"} 
                                                className="ml-2"
                                                title={hasMultipleRoutes && !weightsValid 
                                                  ? `Actual: ${route.weight}%, Normalized: ${normalizedWeight}%` 
                                                  : undefined}
                                              >
                                                {route.weight}%
                                                {hasMultipleRoutes && !weightsValid && normalizedWeight !== route.weight && (
                                                  <span className="ml-1 text-xs opacity-75">({normalizedWeight}%)</span>
                                                )}
                                              </Badge>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="destination-rules" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Destination Rules</CardTitle>
                    <CardDescription>Configure traffic policies and subsets</CardDescription>
                  </div>
                  <Button onClick={addDestinationRule} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Destination Rule
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredDestinationRules.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {searchQuery || filterNamespace !== 'all' ? 'No destination rules match the filter' : 'No destination rules configured'}
                    </p>
                  ) : (
                    filteredDestinationRules.map((dr) => (
                    <Card key={dr.id} className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                              <Layers className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{dr.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="font-mono text-xs">{dr.host}</Badge>
                                {dr.trafficPolicy?.loadBalancer?.simple && (
                                  <Badge variant="outline">{dr.trafficPolicy.loadBalancer.simple}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingDestinationRule(dr)}
                              className="hover:bg-primary/10"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteConfirm({ type: 'destinationRule', id: dr.id, name: dr.name })}
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {dr.subsets && dr.subsets.length > 0 && (
                          <div className="space-y-2">
                            <Label>Subsets</Label>
                            {dr.subsets.map((subset, idx) => (
                              <div key={idx} className="p-2 border rounded">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{subset.name}</Badge>
                                  {subset.labels && Object.entries(subset.labels).map(([key, value]) => (
                                    <Badge key={key} variant="outline" className="text-xs">
                                      {key}={value}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gateways" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Gateways</CardTitle>
                    <CardDescription>Configure ingress and egress gateways</CardDescription>
                  </div>
                  <Button onClick={addGateway} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Gateway
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredGateways.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {searchQuery || filterNamespace !== 'all' ? 'No gateways match the filter' : 'No gateways configured'}
                    </p>
                  ) : (
                    filteredGateways.map((gateway) => (
                    <Card key={gateway.id} className="border-l-4 border-l-cyan-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                            <Globe className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                          </div>
                          <div>
                            <CardTitle className="text-lg font-semibold">{gateway.name}</CardTitle>
                            {gateway.servers && gateway.servers.length > 0 && (
                              <div className="flex items-center gap-2 mt-2">
                                {gateway.servers.map((server, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {server.port.protocol}:{server.port.number}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingGateway(gateway)}
                            className="hover:bg-primary/10"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirm({ type: 'gateway', id: gateway.id, name: gateway.name })}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                    </Card>
                  )))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="peer-authentication" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Peer Authentication</CardTitle>
                    <CardDescription>Configure mTLS authentication policies</CardDescription>
                  </div>
                  <Button onClick={addPeerAuthentication} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Peer Authentication
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredPeerAuths.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {searchQuery || filterNamespace !== 'all' ? 'No peer authentications match the filter' : 'No peer authentications configured'}
                    </p>
                  ) : (
                    filteredPeerAuths.map((pa) => (
                      <Card key={pa.id} className="border-l-4 border-l-orange-500 hover:shadow-md transition-shadow bg-card">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                                <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                              </div>
                              <div>
                                <CardTitle className="text-lg font-semibold">{pa.name}</CardTitle>
                                <div className="flex items-center gap-2 mt-2">
                                  {pa.namespace && <Badge variant="outline">{pa.namespace}</Badge>}
                                  {pa.mtls && (
                                    <Badge variant={pa.mtls.mode === 'STRICT' ? 'default' : 'outline'}>
                                      mTLS: {pa.mtls.mode}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingPeerAuth(pa)}
                                className="hover:bg-primary/10"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirm({ type: 'peerAuthentication', id: pa.id, name: pa.name })}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="authorization-policy" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Authorization Policies</CardTitle>
                    <CardDescription>Configure access control policies</CardDescription>
                  </div>
                  <Button onClick={addAuthorizationPolicy} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Authorization Policy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredAuthPolicies.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {searchQuery || filterNamespace !== 'all' ? 'No authorization policies match the filter' : 'No authorization policies configured'}
                    </p>
                  ) : (
                    filteredAuthPolicies.map((ap) => (
                      <Card key={ap.id} className="border-l-4 border-l-red-500 hover:shadow-md transition-shadow bg-card">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                                <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />
                              </div>
                              <div>
                                <CardTitle className="text-lg font-semibold">{ap.name}</CardTitle>
                                <div className="flex items-center gap-2 mt-2">
                                  {ap.namespace && <Badge variant="outline">{ap.namespace}</Badge>}
                                  {ap.action && (
                                    <Badge variant={ap.action === 'DENY' ? 'destructive' : 'default'}>
                                      {ap.action}
                                    </Badge>
                                  )}
                                  {ap.rules && <Badge variant="outline">{ap.rules.length} rules</Badge>}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingAuthPolicy(ap)}
                                className="hover:bg-primary/10"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirm({ type: 'authorizationPolicy', id: ap.id, name: ap.name })}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="service-entry" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Service Entries</CardTitle>
                    <CardDescription>Configure external services</CardDescription>
                  </div>
                  <Button onClick={addServiceEntry} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Service Entry
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredServiceEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {searchQuery || filterNamespace !== 'all' ? 'No service entries match the filter' : 'No service entries configured'}
                    </p>
                  ) : (
                    filteredServiceEntries.map((se) => (
                      <Card key={se.id} className="border-l-4 border-l-teal-500 hover:shadow-md transition-shadow bg-card">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                                <Network className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                              </div>
                              <div>
                                <CardTitle className="text-lg font-semibold">{se.name}</CardTitle>
                                <div className="flex items-center gap-2 mt-2">
                                  {se.namespace && <Badge variant="outline">{se.namespace}</Badge>}
                                  {se.location && <Badge variant="outline">{se.location}</Badge>}
                                  {se.hosts && se.hosts.length > 0 && (
                                    <Badge variant="outline" className="font-mono text-xs">
                                      {se.hosts[0]}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingServiceEntry(se)}
                                className="hover:bg-primary/10"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirm({ type: 'serviceEntry', id: se.id, name: se.name })}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sidecar" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Sidecars</CardTitle>
                    <CardDescription>Configure sidecar proxy settings</CardDescription>
                  </div>
                  <Button onClick={addSidecar} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Sidecar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredSidecars.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {searchQuery || filterNamespace !== 'all' ? 'No sidecars match the filter' : 'No sidecars configured'}
                    </p>
                  ) : (
                    filteredSidecars.map((sc) => (
                      <Card key={sc.id} className="border-l-4 border-l-indigo-500 hover:shadow-md transition-shadow bg-card">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                                <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                              </div>
                              <div>
                                <CardTitle className="text-lg font-semibold">{sc.name}</CardTitle>
                                <div className="flex items-center gap-2 mt-2">
                                  {sc.namespace && <Badge variant="outline">{sc.namespace}</Badge>}
                                  {sc.egress && <Badge variant="outline">{sc.egress.length} egress</Badge>}
                                  {sc.ingress && <Badge variant="outline">{sc.ingress.length} ingress</Badge>}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingSidecar(sc)}
                                className="hover:bg-primary/10"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirm({ type: 'sidecar', id: sc.id, name: sc.name })}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Service Mesh Settings</CardTitle>
                <CardDescription>Service mesh configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable mTLS</Label>
                  <Switch 
                    checked={config.enableMTLS ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableMTLS: checked })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>mTLS Mode</Label>
                  <Select 
                    value={config.mtlsMode ?? 'PERMISSIVE'}
                    onValueChange={(value: 'STRICT' | 'PERMISSIVE' | 'DISABLE') => updateConfig({ mtlsMode: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STRICT">STRICT - mTLS required</SelectItem>
                      <SelectItem value="PERMISSIVE">PERMISSIVE - mTLS optional</SelectItem>
                      <SelectItem value="DISABLE">DISABLE - no mTLS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Tracing</Label>
                  <Switch 
                    checked={config.enableTracing ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableTracing: checked })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tracing Provider</Label>
                  <Select 
                    value={config.tracingProvider ?? 'jaeger'}
                    onValueChange={(value: 'jaeger' | 'zipkin' | 'datadog') => updateConfig({ tracingProvider: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jaeger">Jaeger</SelectItem>
                      <SelectItem value="zipkin">Zipkin</SelectItem>
                      <SelectItem value="datadog">Datadog</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Metrics</Label>
                  <Switch 
                    checked={config.enableMetrics ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableMetrics: checked })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Metrics Provider</Label>
                  <Select 
                    value={config.metricsProvider ?? 'prometheus'}
                    onValueChange={(value: 'prometheus' | 'statsd') => updateConfig({ metricsProvider: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prometheus">Prometheus</SelectItem>
                      <SelectItem value="statsd">StatsD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Access Log</Label>
                  <Switch 
                    checked={config.enableAccessLog ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableAccessLog: checked })}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Default Load Balancer</Label>
                  <Select 
                    value={config.defaultLoadBalancer ?? 'ROUND_ROBIN'}
                    onValueChange={(value: 'ROUND_ROBIN' | 'LEAST_CONN' | 'RANDOM') => updateConfig({ defaultLoadBalancer: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
                      <SelectItem value="LEAST_CONN">Least Connections</SelectItem>
                      <SelectItem value="RANDOM">Random</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Max Connections</Label>
                  <Input 
                    type="number" 
                    value={config.maxConnections ?? 10000}
                    onChange={(e) => updateConfig({ maxConnections: parseInt(e.target.value) || 10000 })}
                    min={1}
                    max={100000}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Timeout (e.g., "30s")</Label>
                  <Input 
                    value={config.defaultTimeout ?? '30s'}
                    onChange={(e) => updateConfig({ defaultTimeout: e.target.value })}
                    placeholder="30s"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Retry Attempts</Label>
                  <Input 
                    type="number" 
                    value={config.defaultRetryAttempts ?? 3}
                    onChange={(e) => updateConfig({ defaultRetryAttempts: parseInt(e.target.value) || 3 })}
                    min={0}
                    max={10}
                  />
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Metrics Export</Label>
                      <p className="text-xs text-muted-foreground mt-1">Export Service Mesh metrics for Prometheus scraping</p>
                    </div>
                    <Switch 
                      checked={config.metrics?.enabled ?? true}
                      onCheckedChange={(checked) => updateConfig({ 
                        metrics: { 
                          ...config.metrics, 
                          enabled: checked,
                          controlPlanePort: config.metrics?.controlPlanePort || 15014,
                          sidecarPort: config.metrics?.sidecarPort || 15090,
                          gatewayPort: config.metrics?.gatewayPort || 15020
                        } 
                      })}
                    />
                  </div>
                  {config.metrics?.enabled !== false && (
                    <>
                      <div className="space-y-2">
                        <Label>Control Plane Metrics Port</Label>
                        <Input 
                          type="number" 
                          value={config.metrics?.controlPlanePort ?? 15014}
                          onChange={(e) => updateConfig({ 
                            metrics: { 
                              ...config.metrics, 
                              controlPlanePort: parseInt(e.target.value) || 15014,
                              sidecarPort: config.metrics?.sidecarPort || 15090,
                              gatewayPort: config.metrics?.gatewayPort || 15020
                            } 
                          })}
                          min={1024} 
                          max={65535} 
                        />
                        <p className="text-xs text-muted-foreground">Control plane metrics endpoint: :15014/metrics</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Sidecar Metrics Port (Envoy)</Label>
                        <Input 
                          type="number" 
                          value={config.metrics?.sidecarPort ?? 15090}
                          onChange={(e) => updateConfig({ 
                            metrics: { 
                              ...config.metrics, 
                              sidecarPort: parseInt(e.target.value) || 15090,
                              controlPlanePort: config.metrics?.controlPlanePort || 15014,
                              gatewayPort: config.metrics?.gatewayPort || 15020
                            } 
                          })}
                          min={1024} 
                          max={65535} 
                        />
                        <p className="text-xs text-muted-foreground">Envoy sidecar metrics endpoint: :15090/stats/prometheus</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Gateway Metrics Port</Label>
                        <Input 
                          type="number" 
                          value={config.metrics?.gatewayPort ?? 15020}
                          onChange={(e) => updateConfig({ 
                            metrics: { 
                              ...config.metrics, 
                              gatewayPort: parseInt(e.target.value) || 15020,
                              controlPlanePort: config.metrics?.controlPlanePort || 15014,
                              sidecarPort: config.metrics?.sidecarPort || 15090
                            } 
                          })}
                          min={1024} 
                          max={65535} 
                        />
                        <p className="text-xs text-muted-foreground">Gateway metrics endpoint: :15020/stats/prometheus</p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!deleteConfirm) return;
                  switch (deleteConfirm.type) {
                    case 'service':
                      updateConfig({ services: services.filter(s => s.id !== deleteConfirm.id) });
                      break;
                    case 'virtualService':
                      removeVirtualService(deleteConfirm.id);
                      break;
                    case 'destinationRule':
                      removeDestinationRule(deleteConfirm.id);
                      break;
                    case 'gateway':
                      removeGateway(deleteConfirm.id);
                      break;
                    case 'peerAuthentication':
                      removePeerAuthentication(deleteConfirm.id);
                      break;
                    case 'authorizationPolicy':
                      removeAuthorizationPolicy(deleteConfirm.id);
                      break;
                    case 'serviceEntry':
                      removeServiceEntry(deleteConfirm.id);
                      break;
                    case 'sidecar':
                      removeSidecar(deleteConfirm.id);
                      break;
                  }
                  setDeleteConfirm(null);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit VirtualService Dialog */}
        <Dialog open={!!editingVirtualService} onOpenChange={(open) => !open && setEditingVirtualService(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{virtualServices.find(vs => vs.id === editingVirtualService?.id) ? 'Edit Virtual Service' : 'Create Virtual Service'}</DialogTitle>
              <DialogDescription>
                {virtualServices.find(vs => vs.id === editingVirtualService?.id) ? 'Update virtual service configuration' : 'Configure a new virtual service for traffic routing'}
              </DialogDescription>
            </DialogHeader>
            {editingVirtualService && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editingVirtualService.name}
                    onChange={(e) => setEditingVirtualService({ ...editingVirtualService, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Namespace</Label>
                  <Input
                    value={editingVirtualService.namespace || 'default'}
                    onChange={(e) => setEditingVirtualService({ ...editingVirtualService, namespace: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hosts (comma-separated)</Label>
                  <Input
                    value={editingVirtualService.hosts.join(', ')}
                    onChange={(e) => setEditingVirtualService({ 
                      ...editingVirtualService, 
                      hosts: e.target.value.split(',').map(h => h.trim()).filter(h => h) 
                    })}
                    placeholder="example.com, *.example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gateways (comma-separated, optional)</Label>
                  <Input
                    value={editingVirtualService.gateways?.join(', ') || ''}
                    onChange={(e) => setEditingVirtualService({ 
                      ...editingVirtualService, 
                      gateways: e.target.value ? e.target.value.split(',').map(g => g.trim()).filter(g => g) : undefined
                    })}
                    placeholder="gateway-name"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingVirtualService(null)}>Cancel</Button>
              <Button onClick={() => {
                if (editingVirtualService) {
                  // Validation
                  if (!editingVirtualService.name || editingVirtualService.name.trim() === '') {
                    showValidationError('Name is required');
                    return;
                  }
                  if (!editingVirtualService.hosts || editingVirtualService.hosts.length === 0) {
                    showValidationError('At least one host is required');
                    return;
                  }
                  
                  // Validate route weights
                  if (editingVirtualService.http) {
                    for (const httpRule of editingVirtualService.http) {
                      if (httpRule.route && httpRule.route.length > 1) {
                        const totalWeight = httpRule.route.reduce((sum, route) => sum + (route.weight || 0), 0);
                        if (totalWeight !== 100) {
                          showValidationError(`Route weights must sum to 100% (currently ${totalWeight}%)`);
                          return;
                        }
                      }
                    }
                  }
                  
                  const existingIndex = virtualServices.findIndex(vs => vs.id === editingVirtualService.id);
                  if (existingIndex >= 0) {
                    const updated = virtualServices.map(vs => 
                      vs.id === editingVirtualService.id ? editingVirtualService : vs
                    );
                    updateConfig({ virtualServices: updated });
                    showSuccess(`Virtual Service "${editingVirtualService.name}" updated`);
                  } else {
                    updateConfig({ virtualServices: [...virtualServices, editingVirtualService] });
                    showSuccess(`Virtual Service "${editingVirtualService.name}" created`);
                  }
                  setEditingVirtualService(null);
                }
              }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit DestinationRule Dialog */}
        <Dialog open={!!editingDestinationRule} onOpenChange={(open) => !open && setEditingDestinationRule(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{destinationRules.find(dr => dr.id === editingDestinationRule?.id) ? 'Edit Destination Rule' : 'Create Destination Rule'}</DialogTitle>
              <DialogDescription>
                {destinationRules.find(dr => dr.id === editingDestinationRule?.id) ? 'Update destination rule configuration' : 'Configure a new destination rule for traffic policies'}
              </DialogDescription>
            </DialogHeader>
            {editingDestinationRule && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editingDestinationRule.name}
                    onChange={(e) => setEditingDestinationRule({ ...editingDestinationRule, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Namespace</Label>
                  <Input
                    value={editingDestinationRule.namespace || 'default'}
                    onChange={(e) => setEditingDestinationRule({ ...editingDestinationRule, namespace: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Host</Label>
                  <Input
                    value={editingDestinationRule.host}
                    onChange={(e) => setEditingDestinationRule({ ...editingDestinationRule, host: e.target.value })}
                    placeholder="service.namespace.svc.cluster.local"
                  />
                </div>
                <Separator />
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Traffic Policy</Label>
                  
                  <div className="space-y-2">
                    <Label>Load Balancer</Label>
                    <Select
                      value={editingDestinationRule.trafficPolicy?.loadBalancer?.simple || 'ROUND_ROBIN'}
                      onValueChange={(value: 'ROUND_ROBIN' | 'LEAST_CONN' | 'RANDOM') => setEditingDestinationRule({
                        ...editingDestinationRule,
                        trafficPolicy: {
                          ...editingDestinationRule.trafficPolicy,
                          loadBalancer: { simple: value }
                        }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
                        <SelectItem value="LEAST_CONN">Least Connections</SelectItem>
                        <SelectItem value="RANDOM">Random</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <Label className="text-sm font-semibold">Connection Pool</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Max Connections</Label>
                        <Input
                          type="number"
                          value={editingDestinationRule.trafficPolicy?.connectionPool?.tcp?.maxConnections || ''}
                          onChange={(e) => setEditingDestinationRule({
                            ...editingDestinationRule,
                            trafficPolicy: {
                              ...editingDestinationRule.trafficPolicy,
                              connectionPool: {
                                ...editingDestinationRule.trafficPolicy?.connectionPool,
                                tcp: {
                                  ...editingDestinationRule.trafficPolicy?.connectionPool?.tcp,
                                  maxConnections: e.target.value ? parseInt(e.target.value) : undefined
                                }
                              }
                            }
                          })}
                          placeholder="100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Connect Timeout (e.g., "30s")</Label>
                        <Input
                          value={editingDestinationRule.trafficPolicy?.connectionPool?.tcp?.connectTimeout || ''}
                          onChange={(e) => setEditingDestinationRule({
                            ...editingDestinationRule,
                            trafficPolicy: {
                              ...editingDestinationRule.trafficPolicy,
                              connectionPool: {
                                ...editingDestinationRule.trafficPolicy?.connectionPool,
                                tcp: {
                                  ...editingDestinationRule.trafficPolicy?.connectionPool?.tcp,
                                  connectTimeout: e.target.value || undefined
                                }
                              }
                            }
                          })}
                          placeholder="30s"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <Label className="text-sm font-semibold">Outlier Detection (Circuit Breaker)</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Consecutive Errors</Label>
                        <Input
                          type="number"
                          value={editingDestinationRule.trafficPolicy?.outlierDetection?.consecutiveErrors || ''}
                          onChange={(e) => setEditingDestinationRule({
                            ...editingDestinationRule,
                            trafficPolicy: {
                              ...editingDestinationRule.trafficPolicy,
                              outlierDetection: {
                                ...editingDestinationRule.trafficPolicy?.outlierDetection,
                                consecutiveErrors: e.target.value ? parseInt(e.target.value) : undefined
                              }
                            }
                          })}
                          placeholder="5"
                        />
                        <p className="text-xs text-muted-foreground">
                          Number of errors before circuit breaker opens
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Base Ejection Time (e.g., "30s")</Label>
                        <Input
                          value={editingDestinationRule.trafficPolicy?.outlierDetection?.baseEjectionTime || ''}
                          onChange={(e) => setEditingDestinationRule({
                            ...editingDestinationRule,
                            trafficPolicy: {
                              ...editingDestinationRule.trafficPolicy,
                              outlierDetection: {
                                ...editingDestinationRule.trafficPolicy?.outlierDetection,
                                baseEjectionTime: e.target.value || undefined
                              }
                            }
                          })}
                          placeholder="30s"
                        />
                        <p className="text-xs text-muted-foreground">
                          Time before retrying after circuit breaker opens
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Interval (e.g., "10s")</Label>
                        <Input
                          value={editingDestinationRule.trafficPolicy?.outlierDetection?.interval || ''}
                          onChange={(e) => setEditingDestinationRule({
                            ...editingDestinationRule,
                            trafficPolicy: {
                              ...editingDestinationRule.trafficPolicy,
                              outlierDetection: {
                                ...editingDestinationRule.trafficPolicy?.outlierDetection,
                                interval: e.target.value || undefined
                              }
                            }
                          })}
                          placeholder="10s"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Ejection Percent</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={editingDestinationRule.trafficPolicy?.outlierDetection?.maxEjectionPercent || ''}
                          onChange={(e) => setEditingDestinationRule({
                            ...editingDestinationRule,
                            trafficPolicy: {
                              ...editingDestinationRule.trafficPolicy,
                              outlierDetection: {
                                ...editingDestinationRule.trafficPolicy?.outlierDetection,
                                maxEjectionPercent: e.target.value ? parseInt(e.target.value) : undefined
                              }
                            }
                          })}
                          placeholder="50"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingDestinationRule(null)}>Cancel</Button>
              <Button onClick={() => {
                if (editingDestinationRule) {
                  // Validation
                  if (!editingDestinationRule.name || editingDestinationRule.name.trim() === '') {
                    showValidationError('Name is required');
                    return;
                  }
                  if (!editingDestinationRule.host || editingDestinationRule.host.trim() === '') {
                    showValidationError('Host is required');
                    return;
                  }
                  
                  const existingIndex = destinationRules.findIndex(dr => dr.id === editingDestinationRule.id);
                  if (existingIndex >= 0) {
                    const updated = destinationRules.map(dr => 
                      dr.id === editingDestinationRule.id ? editingDestinationRule : dr
                    );
                    updateConfig({ destinationRules: updated });
                    showSuccess(`Destination Rule "${editingDestinationRule.name}" updated`);
                  } else {
                    updateConfig({ destinationRules: [...destinationRules, editingDestinationRule] });
                    showSuccess(`Destination Rule "${editingDestinationRule.name}" created`);
                  }
                  setEditingDestinationRule(null);
                }
              }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Gateway Dialog */}
        <Dialog open={!!editingGateway} onOpenChange={(open) => !open && setEditingGateway(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{gateways.find(gw => gw.id === editingGateway?.id) ? 'Edit Gateway' : 'Create Gateway'}</DialogTitle>
              <DialogDescription>
                {gateways.find(gw => gw.id === editingGateway?.id) ? 'Update gateway configuration' : 'Configure a new gateway for ingress or egress traffic'}
              </DialogDescription>
            </DialogHeader>
            {editingGateway && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editingGateway.name}
                    onChange={(e) => setEditingGateway({ ...editingGateway, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Namespace</Label>
                  <Input
                    value={editingGateway.namespace || 'default'}
                    onChange={(e) => setEditingGateway({ ...editingGateway, namespace: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Selector (JSON format)</Label>
                  <Textarea
                    value={JSON.stringify(editingGateway.selector || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const selector = JSON.parse(e.target.value);
                        setEditingGateway({ ...editingGateway, selector });
                      } catch {
                        // Invalid JSON, ignore
                      }
                    }}
                    placeholder='{"istio": "ingressgateway"}'
                    className="font-mono text-sm"
                  />
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Servers</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newServer = {
                          port: { number: 80, protocol: 'HTTP', name: 'http' },
                          hosts: ['*'],
                        };
                        setEditingGateway({
                          ...editingGateway,
                          servers: [...(editingGateway.servers || []), newServer],
                        });
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Server
                    </Button>
                  </div>
                  {(!editingGateway.servers || editingGateway.servers.length === 0) ? (
                    <p className="text-sm text-muted-foreground">No servers configured. Add a server to define ports and hosts.</p>
                  ) : (
                    <div className="space-y-4">
                      {editingGateway.servers.map((server, idx) => (
                        <Card key={idx} className="p-4">
                          <div className="flex items-center justify-between mb-4">
                            <Label className="text-sm font-semibold">Server {idx + 1}</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const updatedServers = editingGateway.servers?.filter((_, i) => i !== idx) || [];
                                setEditingGateway({ ...editingGateway, servers: updatedServers });
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                              <div className="space-y-2">
                                <Label>Port Number</Label>
                                <Input
                                  type="number"
                                  value={server.port.number}
                                  onChange={(e) => {
                                    const updatedServers = [...(editingGateway.servers || [])];
                                    updatedServers[idx] = {
                                      ...server,
                                      port: { ...server.port, number: parseInt(e.target.value) || 80 },
                                    };
                                    setEditingGateway({ ...editingGateway, servers: updatedServers });
                                  }}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Protocol</Label>
                                <Select
                                  value={server.port.protocol}
                                  onValueChange={(value) => {
                                    const updatedServers = [...(editingGateway.servers || [])];
                                    updatedServers[idx] = {
                                      ...server,
                                      port: { ...server.port, protocol: value },
                                    };
                                    setEditingGateway({ ...editingGateway, servers: updatedServers });
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="HTTP">HTTP</SelectItem>
                                    <SelectItem value="HTTPS">HTTPS</SelectItem>
                                    <SelectItem value="TCP">TCP</SelectItem>
                                    <SelectItem value="TLS">TLS</SelectItem>
                                    <SelectItem value="GRPC">gRPC</SelectItem>
                                    <SelectItem value="HTTP2">HTTP2</SelectItem>
                                    <SelectItem value="MONGO">MongoDB</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Port Name</Label>
                                <Input
                                  value={server.port.name || ''}
                                  onChange={(e) => {
                                    const updatedServers = [...(editingGateway.servers || [])];
                                    updatedServers[idx] = {
                                      ...server,
                                      port: { ...server.port, name: e.target.value },
                                    };
                                    setEditingGateway({ ...editingGateway, servers: updatedServers });
                                  }}
                                  placeholder="http"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Hosts (comma-separated)</Label>
                              <Input
                                value={server.hosts.join(', ')}
                                onChange={(e) => {
                                  const hosts = e.target.value.split(',').map(h => h.trim()).filter(h => h);
                                  const updatedServers = [...(editingGateway.servers || [])];
                                  updatedServers[idx] = { ...server, hosts };
                                  setEditingGateway({ ...editingGateway, servers: updatedServers });
                                }}
                                placeholder="*, example.com, *.example.com"
                              />
                              <p className="text-xs text-muted-foreground">
                                Use * for all hosts, or specify domain names
                              </p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingGateway(null)}>Cancel</Button>
              <Button onClick={() => {
                if (editingGateway) {
                  // Validation
                  if (!editingGateway.name || editingGateway.name.trim() === '') {
                    showValidationError('Name is required');
                    return;
                  }
                  if (!editingGateway.servers || editingGateway.servers.length === 0) {
                    showValidationError('At least one server is required');
                    return;
                  }
                  
                  const existingIndex = gateways.findIndex(gw => gw.id === editingGateway.id);
                  if (existingIndex >= 0) {
                    const updated = gateways.map(gw => 
                      gw.id === editingGateway.id ? editingGateway : gw
                    );
                    updateConfig({ gateways: updated });
                    showSuccess(`Gateway "${editingGateway.name}" updated`);
                  } else {
                    updateConfig({ gateways: [...gateways, editingGateway] });
                    showSuccess(`Gateway "${editingGateway.name}" created`);
                  }
                  setEditingGateway(null);
                }
              }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit PeerAuthentication Dialog */}
        <Dialog open={!!editingPeerAuth} onOpenChange={(open) => !open && setEditingPeerAuth(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{peerAuthentications.find(pa => pa.id === editingPeerAuth?.id) ? 'Edit Peer Authentication' : 'Create Peer Authentication'}</DialogTitle>
              <DialogDescription>
                {peerAuthentications.find(pa => pa.id === editingPeerAuth?.id) ? 'Update mTLS authentication policy' : 'Configure a new mTLS authentication policy'}
              </DialogDescription>
            </DialogHeader>
            {editingPeerAuth && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editingPeerAuth.name}
                    onChange={(e) => setEditingPeerAuth({ ...editingPeerAuth, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Namespace</Label>
                  <Input
                    value={editingPeerAuth.namespace || 'default'}
                    onChange={(e) => setEditingPeerAuth({ ...editingPeerAuth, namespace: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>mTLS Mode</Label>
                  <Select
                    value={editingPeerAuth.mtls?.mode || 'PERMISSIVE'}
                    onValueChange={(value: 'STRICT' | 'PERMISSIVE' | 'DISABLE') => setEditingPeerAuth({
                      ...editingPeerAuth,
                      mtls: { mode: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STRICT">STRICT - mTLS required</SelectItem>
                      <SelectItem value="PERMISSIVE">PERMISSIVE - mTLS optional</SelectItem>
                      <SelectItem value="DISABLE">DISABLE - no mTLS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Selector (JSON format, optional)</Label>
                  <Textarea
                    value={JSON.stringify(editingPeerAuth.selector?.matchLabels || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const matchLabels = JSON.parse(e.target.value);
                        setEditingPeerAuth({ 
                          ...editingPeerAuth, 
                          selector: { matchLabels } 
                        });
                      } catch {
                        // Invalid JSON, ignore
                      }
                    }}
                    placeholder='{"app": "myapp"}'
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingPeerAuth(null)}>Cancel</Button>
              <Button onClick={() => {
                if (editingPeerAuth) {
                  // Validation
                  if (!editingPeerAuth.name || editingPeerAuth.name.trim() === '') {
                    showValidationError('Name is required');
                    return;
                  }
                  
                  const existingIndex = peerAuthentications.findIndex(pa => pa.id === editingPeerAuth.id);
                  if (existingIndex >= 0) {
                    const updated = peerAuthentications.map(pa => 
                      pa.id === editingPeerAuth.id ? editingPeerAuth : pa
                    );
                    updateConfig({ peerAuthentications: updated });
                    showSuccess(`Peer Authentication "${editingPeerAuth.name}" updated`);
                  } else {
                    updateConfig({ peerAuthentications: [...peerAuthentications, editingPeerAuth] });
                    showSuccess(`Peer Authentication "${editingPeerAuth.name}" created`);
                  }
                  setEditingPeerAuth(null);
                }
              }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit AuthorizationPolicy Dialog */}
        <Dialog open={!!editingAuthPolicy} onOpenChange={(open) => !open && setEditingAuthPolicy(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{authorizationPolicies.find(ap => ap.id === editingAuthPolicy?.id) ? 'Edit Authorization Policy' : 'Create Authorization Policy'}</DialogTitle>
              <DialogDescription>
                {authorizationPolicies.find(ap => ap.id === editingAuthPolicy?.id) ? 'Update access control policy' : 'Configure a new access control policy'}
              </DialogDescription>
            </DialogHeader>
            {editingAuthPolicy && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editingAuthPolicy.name}
                    onChange={(e) => setEditingAuthPolicy({ ...editingAuthPolicy, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Namespace</Label>
                  <Input
                    value={editingAuthPolicy.namespace || 'default'}
                    onChange={(e) => setEditingAuthPolicy({ ...editingAuthPolicy, namespace: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Action</Label>
                  <Select
                    value={editingAuthPolicy.action || 'ALLOW'}
                    onValueChange={(value: 'ALLOW' | 'DENY' | 'AUDIT' | 'CUSTOM') => setEditingAuthPolicy({
                      ...editingAuthPolicy,
                      action: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALLOW">ALLOW - Allow access</SelectItem>
                      <SelectItem value="DENY">DENY - Deny access</SelectItem>
                      <SelectItem value="AUDIT">AUDIT - Audit only</SelectItem>
                      <SelectItem value="CUSTOM">CUSTOM - Custom action</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Selector (JSON format, optional)</Label>
                  <Textarea
                    value={JSON.stringify(editingAuthPolicy.selector?.matchLabels || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const matchLabels = JSON.parse(e.target.value);
                        setEditingAuthPolicy({ 
                          ...editingAuthPolicy, 
                          selector: { matchLabels } 
                        });
                      } catch {
                        // Invalid JSON, ignore
                      }
                    }}
                    placeholder='{"app": "myapp"}'
                    className="font-mono text-sm"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Rules can be configured in advanced mode. Basic configuration allows setting action and selector.</p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingAuthPolicy(null)}>Cancel</Button>
              <Button onClick={() => {
                if (editingAuthPolicy) {
                  // Validation
                  if (!editingAuthPolicy.name || editingAuthPolicy.name.trim() === '') {
                    showValidationError('Name is required');
                    return;
                  }
                  
                  const existingIndex = authorizationPolicies.findIndex(ap => ap.id === editingAuthPolicy.id);
                  if (existingIndex >= 0) {
                    const updated = authorizationPolicies.map(ap => 
                      ap.id === editingAuthPolicy.id ? editingAuthPolicy : ap
                    );
                    updateConfig({ authorizationPolicies: updated });
                    showSuccess(`Authorization Policy "${editingAuthPolicy.name}" updated`);
                  } else {
                    updateConfig({ authorizationPolicies: [...authorizationPolicies, editingAuthPolicy] });
                    showSuccess(`Authorization Policy "${editingAuthPolicy.name}" created`);
                  }
                  setEditingAuthPolicy(null);
                }
              }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit ServiceEntry Dialog */}
        <Dialog open={!!editingServiceEntry} onOpenChange={(open) => !open && setEditingServiceEntry(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{serviceEntries.find(se => se.id === editingServiceEntry?.id) ? 'Edit Service Entry' : 'Create Service Entry'}</DialogTitle>
              <DialogDescription>
                {serviceEntries.find(se => se.id === editingServiceEntry?.id) ? 'Update external service configuration' : 'Configure a new external service entry'}
              </DialogDescription>
            </DialogHeader>
            {editingServiceEntry && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editingServiceEntry.name}
                    onChange={(e) => setEditingServiceEntry({ ...editingServiceEntry, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Namespace</Label>
                  <Input
                    value={editingServiceEntry.namespace || 'default'}
                    onChange={(e) => setEditingServiceEntry({ ...editingServiceEntry, namespace: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hosts (comma-separated)</Label>
                  <Input
                    value={editingServiceEntry.hosts?.join(', ') || ''}
                    onChange={(e) => setEditingServiceEntry({ 
                      ...editingServiceEntry, 
                      hosts: e.target.value.split(',').map(h => h.trim()).filter(h => h) 
                    })}
                    placeholder="external.example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select
                    value={editingServiceEntry.location || 'MESH_EXTERNAL'}
                    onValueChange={(value: 'MESH_EXTERNAL' | 'MESH_INTERNAL') => setEditingServiceEntry({
                      ...editingServiceEntry,
                      location: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MESH_EXTERNAL">MESH_EXTERNAL - External to mesh</SelectItem>
                      <SelectItem value="MESH_INTERNAL">MESH_INTERNAL - Internal to mesh</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Resolution</Label>
                  <Select
                    value={editingServiceEntry.resolution || 'DNS'}
                    onValueChange={(value: 'DNS' | 'STATIC' | 'NONE') => setEditingServiceEntry({
                      ...editingServiceEntry,
                      resolution: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DNS">DNS - DNS resolution</SelectItem>
                      <SelectItem value="STATIC">STATIC - Static IPs</SelectItem>
                      <SelectItem value="NONE">NONE - No resolution</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingServiceEntry(null)}>Cancel</Button>
              <Button onClick={() => {
                if (editingServiceEntry) {
                  // Validation
                  if (!editingServiceEntry.name || editingServiceEntry.name.trim() === '') {
                    showValidationError('Name is required');
                    return;
                  }
                  if (!editingServiceEntry.hosts || editingServiceEntry.hosts.length === 0) {
                    showValidationError('At least one host is required');
                    return;
                  }
                  
                  const existingIndex = serviceEntries.findIndex(se => se.id === editingServiceEntry.id);
                  if (existingIndex >= 0) {
                    const updated = serviceEntries.map(se => 
                      se.id === editingServiceEntry.id ? editingServiceEntry : se
                    );
                    updateConfig({ serviceEntries: updated });
                    showSuccess(`Service Entry "${editingServiceEntry.name}" updated`);
                  } else {
                    updateConfig({ serviceEntries: [...serviceEntries, editingServiceEntry] });
                    showSuccess(`Service Entry "${editingServiceEntry.name}" created`);
                  }
                  setEditingServiceEntry(null);
                }
              }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Sidecar Dialog */}
        <Dialog open={!!editingSidecar} onOpenChange={(open) => !open && setEditingSidecar(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{sidecars.find(sc => sc.id === editingSidecar?.id) ? 'Edit Sidecar' : 'Create Sidecar'}</DialogTitle>
              <DialogDescription>
                {sidecars.find(sc => sc.id === editingSidecar?.id) ? 'Update sidecar proxy settings' : 'Configure a new sidecar proxy'}
              </DialogDescription>
            </DialogHeader>
            {editingSidecar && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editingSidecar.name}
                    onChange={(e) => setEditingSidecar({ ...editingSidecar, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Namespace</Label>
                  <Input
                    value={editingSidecar.namespace || 'default'}
                    onChange={(e) => setEditingSidecar({ ...editingSidecar, namespace: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Selector (JSON format, optional)</Label>
                  <Textarea
                    value={JSON.stringify(editingSidecar.workloadSelector?.labels || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const labels = JSON.parse(e.target.value);
                        setEditingSidecar({ 
                          ...editingSidecar, 
                          workloadSelector: { labels } 
                        });
                      } catch {
                        // Invalid JSON, ignore
                      }
                    }}
                    placeholder='{"app": "myapp"}'
                    className="font-mono text-sm"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Egress and Ingress settings can be configured in advanced mode. Basic configuration allows setting selector.</p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingSidecar(null)}>Cancel</Button>
              <Button onClick={() => {
                if (editingSidecar) {
                  // Validation
                  if (!editingSidecar.name || editingSidecar.name.trim() === '') {
                    showValidationError('Name is required');
                    return;
                  }
                  
                  const existingIndex = sidecars.findIndex(sc => sc.id === editingSidecar.id);
                  if (existingIndex >= 0) {
                    const updated = sidecars.map(sc => 
                      sc.id === editingSidecar.id ? editingSidecar : sc
                    );
                    updateConfig({ sidecars: updated });
                    showSuccess(`Sidecar "${editingSidecar.name}" updated`);
                  } else {
                    updateConfig({ sidecars: [...sidecars, editingSidecar] });
                    showSuccess(`Sidecar "${editingSidecar.name}" created`);
                  }
                  setEditingSidecar(null);
                }
              }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

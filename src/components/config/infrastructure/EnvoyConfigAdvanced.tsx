import { useState, useEffect, useCallback } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Network,
  Server,
  CheckCircle,
  XCircle,
  Globe,
  Edit
} from 'lucide-react';

interface EnvoyConfigProps {
  componentId: string;
}

interface ClusterEndpoint {
  address: string;
  port: number;
  weight?: number;
  healthStatus?: 'healthy' | 'unhealthy' | 'degraded' | 'timeout' | 'unknown';
}

interface Cluster {
  name: string;
  type: 'STATIC_DNS' | 'STRICT_DNS' | 'LOGICAL_DNS' | 'EDS' | 'ORIGINAL_DST';
  hosts: Array<{ address: string; port: number; weight?: number }>;
  healthChecks?: boolean;
  healthCheckInterval?: number;
  healthCheckTimeout?: number;
  healthCheckPath?: string;
  healthCheckHealthyThreshold?: number;
  healthCheckUnhealthyThreshold?: number;
  connectTimeout?: number;
  loadBalancingPolicy?: 'ROUND_ROBIN' | 'LEAST_REQUEST' | 'RING_HASH' | 'MAGLEV' | 'RANDOM';
  circuitBreaker?: boolean;
  circuitBreakerMaxConnections?: number;
  circuitBreakerMaxRequests?: number;
  circuitBreakerConsecutiveErrors?: number;
  outlierDetection?: boolean;
  outlierDetectionConsecutiveErrors?: number;
  outlierDetectionInterval?: number;
  outlierDetectionBaseEjectionTime?: number;
  outlierDetectionMaxEjectionPercent?: number;
  requests?: number;
  errors?: number;
  activeConnections?: number;
}

interface Listener {
  name: string;
  address: string;
  port: number;
  protocol?: 'HTTP' | 'HTTPS' | 'TCP' | 'UDP';
  filters: string[];
  activeConnections?: number;
  requests?: number;
  responses?: number;
}

interface Route {
  name: string;
  match: string;
  cluster: string;
  priority?: number;
  timeout?: number;
  retryPolicy?: {
    retryOn?: string[];
    numRetries?: number;
    perTryTimeout?: number;
  };
  requests?: number;
  responses?: number;
  errors?: number;
}

interface EnvoyConfig {
  clusters?: Cluster[];
  listeners?: Listener[];
  routes?: Route[];
  totalClusters?: number;
  totalListeners?: number;
  totalRoutes?: number;
  totalRequests?: number;
  totalErrors?: number;
  totalResponses?: number;
  activeConnections?: number;
  totalBytesIn?: number;
  totalBytesOut?: number;
  enableAdminInterface?: boolean;
  enableAccessLogging?: boolean;
  enableStats?: boolean;
  adminPort?: number;
  drainTime?: number;
  maxConnections?: number;
  connectTimeout?: number;
  requestTimeout?: number;
  enableRateLimiting?: boolean;
  rateLimitPerSecond?: number;
  rateLimitBurst?: number;
  enableTracing?: boolean;
  tracingProvider?: 'jaeger' | 'zipkin' | 'datadog';
  metrics?: {
    enabled?: boolean;
    prometheusPath?: string;
  };
}

export function EnvoyConfigAdvanced({ componentId }: EnvoyConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const componentMetrics = useEmulationStore((state) => 
    state.componentMetrics.get(componentId)
  );
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as EnvoyConfig;
  const clusters = config.clusters || [];
  const listeners = config.listeners || [];
  const routes = config.routes || [];

  // State for modals
  const [showCreateCluster, setShowCreateCluster] = useState(false);
  const [showCreateListener, setShowCreateListener] = useState(false);
  const [showCreateRoute, setShowCreateRoute] = useState(false);
  const [showCreateEndpoint, setShowCreateEndpoint] = useState<string | null>(null);
  const [editingCluster, setEditingCluster] = useState<Cluster | null>(null);
  const [editingListener, setEditingListener] = useState<Listener | null>(null);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [editingEndpoint, setEditingEndpoint] = useState<{ clusterName: string; endpointIndex: number } | null>(null);
  const [deletingCluster, setDeletingCluster] = useState<string | null>(null);
  const [deletingListener, setDeletingListener] = useState<string | null>(null);
  const [deletingRoute, setDeletingRoute] = useState<string | null>(null);
  const [deletingEndpoint, setDeletingEndpoint] = useState<{ clusterName: string; endpointIndex: number } | null>(null);

  // Form states for Cluster
  const [newClusterName, setNewClusterName] = useState('');
  const [newClusterType, setNewClusterType] = useState<'STATIC_DNS' | 'STRICT_DNS' | 'LOGICAL_DNS' | 'EDS' | 'ORIGINAL_DST'>('STRICT_DNS');
  const [newClusterHealthChecks, setNewClusterHealthChecks] = useState(true);
  const [newClusterHealthCheckInterval, setNewClusterHealthCheckInterval] = useState(10000);
  const [newClusterHealthCheckTimeout, setNewClusterHealthCheckTimeout] = useState(5000);
  const [newClusterHealthCheckPath, setNewClusterHealthCheckPath] = useState('/health');
  const [newClusterHealthCheckHealthyThreshold, setNewClusterHealthCheckHealthyThreshold] = useState(1);
  const [newClusterHealthCheckUnhealthyThreshold, setNewClusterHealthCheckUnhealthyThreshold] = useState(2);
  const [newClusterConnectTimeout, setNewClusterConnectTimeout] = useState(5000);
  const [newClusterLoadBalancingPolicy, setNewClusterLoadBalancingPolicy] = useState<'ROUND_ROBIN' | 'LEAST_REQUEST' | 'RING_HASH' | 'MAGLEV' | 'RANDOM'>('ROUND_ROBIN');
  const [newClusterCircuitBreaker, setNewClusterCircuitBreaker] = useState(false);
  const [newClusterCircuitBreakerMaxConnections, setNewClusterCircuitBreakerMaxConnections] = useState(1024);
  const [newClusterCircuitBreakerConsecutiveErrors, setNewClusterCircuitBreakerConsecutiveErrors] = useState(5);
  const [newClusterOutlierDetection, setNewClusterOutlierDetection] = useState(false);
  const [newClusterOutlierDetectionConsecutiveErrors, setNewClusterOutlierDetectionConsecutiveErrors] = useState(5);

  // Form states for Endpoint
  const [newEndpointAddress, setNewEndpointAddress] = useState('192.168.1.100');
  const [newEndpointPort, setNewEndpointPort] = useState(8080);
  const [newEndpointWeight, setNewEndpointWeight] = useState(100);

  // Form states for Listener
  const [newListenerName, setNewListenerName] = useState('');
  const [newListenerAddress, setNewListenerAddress] = useState('0.0.0.0');
  const [newListenerPort, setNewListenerPort] = useState(80);
  const [newListenerProtocol, setNewListenerProtocol] = useState<'HTTP' | 'HTTPS' | 'TCP' | 'UDP'>('HTTP');
  const [newListenerFilters, setNewListenerFilters] = useState<string[]>(['http_connection_manager']);

  // Form states for Route
  const [newRouteName, setNewRouteName] = useState('');
  const [newRouteMatch, setNewRouteMatch] = useState('/');
  const [newRouteCluster, setNewRouteCluster] = useState('');
  const [newRoutePriority, setNewRoutePriority] = useState(0);
  const [newRouteTimeout, setNewRouteTimeout] = useState(15000);

  // Get Envoy routing engine for real-time stats
  const routingEngine = emulationEngine.getEnvoyRoutingEngine(componentId);

  // Sync metrics from emulation engine
  useEffect(() => {
    if (!routingEngine || !componentMetrics) return;

    const stats = routingEngine.getStats();
    const customMetrics = componentMetrics.customMetrics || {};

    // Update config with real metrics from emulation
    const updatedConfig = {
      ...config,
      totalRequests: stats.totalRequests || customMetrics.total_requests || 0,
      totalResponses: stats.totalResponses || customMetrics.total_responses || 0,
      activeConnections: stats.activeConnections || customMetrics.active_connections || 0,
      totalBytesIn: stats.totalBytesIn || customMetrics.total_bytes_in || 0,
      totalBytesOut: stats.totalBytesOut || customMetrics.total_bytes_out || 0,
      totalClusters: stats.clusters || clusters.length,
      totalListeners: stats.listeners || listeners.length,
      totalRoutes: stats.routes || routes.length,
    };

    // Update cluster stats
    if (updatedConfig.clusters) {
      updatedConfig.clusters = updatedConfig.clusters.map(cluster => {
        const clusterStats = routingEngine.getClusterStats(cluster.name);
        return {
          ...cluster,
          requests: clusterStats?.requests || cluster.requests || 0,
          errors: clusterStats?.errors || cluster.errors || 0,
          activeConnections: clusterStats?.activeConnections || cluster.activeConnections || 0,
        };
      });
    }

    // Update listener stats
    if (updatedConfig.listeners) {
      updatedConfig.listeners = updatedConfig.listeners.map(listener => {
        const listenerStats = routingEngine.getListenerStats(listener.name);
        return {
          ...listener,
          activeConnections: listenerStats?.activeConnections || listener.activeConnections || 0,
          requests: listenerStats?.requests || listener.requests || 0,
          responses: listenerStats?.responses || listener.responses || 0,
        };
      });
    }

    // Update route stats
    if (updatedConfig.routes) {
      updatedConfig.routes = updatedConfig.routes.map(route => {
        const routeStats = routingEngine.getRouteStats(route.name);
        return {
          ...route,
          requests: routeStats?.requests || route.requests || 0,
          responses: routeStats?.responses || route.responses || 0,
          errors: routeStats?.errors || route.errors || 0,
        };
      });
    }

    // Only update if there are significant changes to avoid infinite loops
    const hasChanges = 
      updatedConfig.totalRequests !== config.totalRequests ||
      updatedConfig.totalResponses !== config.totalResponses ||
      updatedConfig.activeConnections !== config.activeConnections;

    if (hasChanges) {
      updateNode(componentId, {
        data: {
          ...node.data,
          config: updatedConfig,
        },
      });
    }
  }, [componentMetrics, routingEngine]);

  // Sync routing engine when config changes
  useEffect(() => {
    if (node && routingEngine) {
      const clustersForEngine = (config.clusters || []).map((cluster: any) => ({
        name: cluster.name,
        type: cluster.type || 'STRICT_DNS',
        endpoints: (cluster.hosts || []).map((host: any) => ({
          address: host.address,
          port: host.port,
          weight: host.weight || 1,
          healthStatus: host.healthStatus || 'unknown',
        })),
        connectTimeout: cluster.connectTimeout || 5000,
        healthCheck: cluster.healthChecks ? {
          enabled: true,
          interval: cluster.healthCheckInterval || 10000,
          timeout: cluster.healthCheckTimeout || 5000,
          path: cluster.healthCheckPath || '/health',
          healthyThreshold: cluster.healthCheckHealthyThreshold || 1,
          unhealthyThreshold: cluster.healthCheckUnhealthyThreshold || 2,
        } : undefined,
        circuitBreaker: cluster.circuitBreaker ? {
          enabled: true,
          maxConnections: cluster.circuitBreakerMaxConnections,
          maxRequests: cluster.circuitBreakerMaxRequests,
          consecutiveErrors: cluster.circuitBreakerConsecutiveErrors || 5,
        } : undefined,
        loadBalancingPolicy: cluster.loadBalancingPolicy || 'ROUND_ROBIN',
        outlierDetection: cluster.outlierDetection ? {
          enabled: true,
          consecutiveErrors: cluster.outlierDetectionConsecutiveErrors || 5,
          interval: cluster.outlierDetectionInterval || 10000,
          baseEjectionTime: cluster.outlierDetectionBaseEjectionTime || 30000,
          maxEjectionPercent: cluster.outlierDetectionMaxEjectionPercent || 50,
        } : undefined,
      }));
      
      const listenersForEngine = (config.listeners || []).map((listener: any) => ({
        name: listener.name,
        address: listener.address || '0.0.0.0',
        port: listener.port,
        protocol: listener.protocol || 'HTTP',
        filters: (listener.filters || []).map((filter: string | any) => 
          typeof filter === 'string' ? {
            name: filter,
            type: filter,
          } : filter
        ),
      }));
      
      const routesForEngine = (config.routes || []).map((route: any) => ({
        name: route.name,
        match: {
          prefix: route.match?.startsWith('/') ? route.match : undefined,
          path: route.match && !route.match.includes('*') && !route.match.startsWith('/') ? route.match : undefined,
          regex: route.match?.includes('*') ? route.match.replace(/\*/g, '.*') : undefined,
        },
        cluster: route.cluster,
        priority: route.priority || 0,
        timeout: route.timeout,
        retryPolicy: route.retryPolicy,
      }));
      
      const globalConfig = {
        maxConnections: config.maxConnections || 1024,
        connectTimeout: config.connectTimeout || 5000,
        requestTimeout: config.requestTimeout || 15000,
        drainTime: config.drainTime || 600,
        rateLimit: config.enableRateLimiting ? {
          enabled: true,
          rate: config.rateLimitPerSecond || 100,
          burst: config.rateLimitBurst || 10,
        } : undefined,
        tracing: config.enableTracing ? {
          enabled: true,
          provider: config.tracingProvider || 'jaeger',
        } : undefined,
      };
      
      routingEngine.initialize({ clusters: clustersForEngine, listeners: listenersForEngine, routes: routesForEngine, globalConfig });
    }
  }, [config.clusters, config.listeners, config.routes, componentId, node]);

  const updateConfig = useCallback((updates: Partial<EnvoyConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  }, [componentId, node, config, updateNode]);

  // Cluster operations
  const handleCreateCluster = () => {
    if (!newClusterName.trim()) {
      showError('Please fill in cluster name');
      return;
    }

    if (clusters.some(c => c.name === newClusterName)) {
      showError('Cluster with this name already exists');
      return;
    }

    const newCluster: Cluster = {
      name: newClusterName,
      type: newClusterType,
      hosts: [],
      healthChecks: newClusterHealthChecks,
      healthCheckInterval: newClusterHealthCheckInterval,
      healthCheckTimeout: newClusterHealthCheckTimeout,
      healthCheckPath: newClusterHealthCheckPath,
      healthCheckHealthyThreshold: newClusterHealthCheckHealthyThreshold,
      healthCheckUnhealthyThreshold: newClusterHealthCheckUnhealthyThreshold,
      connectTimeout: newClusterConnectTimeout,
      loadBalancingPolicy: newClusterLoadBalancingPolicy,
      circuitBreaker: newClusterCircuitBreaker,
      circuitBreakerMaxConnections: newClusterCircuitBreakerMaxConnections,
      circuitBreakerConsecutiveErrors: newClusterCircuitBreakerConsecutiveErrors,
      outlierDetection: newClusterOutlierDetection,
      outlierDetectionConsecutiveErrors: newClusterOutlierDetectionConsecutiveErrors,
      requests: 0,
      errors: 0,
      activeConnections: 0,
    };

    updateConfig({ clusters: [...clusters, newCluster] });
    showSuccess('Cluster created successfully');
    setShowCreateCluster(false);
    resetClusterForm();
  };

  const handleEditCluster = (cluster: Cluster) => {
    setEditingCluster(cluster);
    setNewClusterName(cluster.name);
    setNewClusterType(cluster.type);
    setNewClusterHealthChecks(cluster.healthChecks || false);
    setNewClusterHealthCheckInterval(cluster.healthCheckInterval || 10000);
    setNewClusterHealthCheckTimeout(cluster.healthCheckTimeout || 5000);
    setNewClusterHealthCheckPath(cluster.healthCheckPath || '/health');
    setNewClusterHealthCheckHealthyThreshold(cluster.healthCheckHealthyThreshold || 1);
    setNewClusterHealthCheckUnhealthyThreshold(cluster.healthCheckUnhealthyThreshold || 2);
    setNewClusterConnectTimeout(cluster.connectTimeout || 5000);
    setNewClusterLoadBalancingPolicy(cluster.loadBalancingPolicy || 'ROUND_ROBIN');
    setNewClusterCircuitBreaker(cluster.circuitBreaker || false);
    setNewClusterCircuitBreakerMaxConnections(cluster.circuitBreakerMaxConnections || 1024);
    setNewClusterCircuitBreakerConsecutiveErrors(cluster.circuitBreakerConsecutiveErrors || 5);
    setNewClusterOutlierDetection(cluster.outlierDetection || false);
    setNewClusterOutlierDetectionConsecutiveErrors(cluster.outlierDetectionConsecutiveErrors || 5);
  };

  const handleSaveCluster = () => {
    if (!editingCluster || !newClusterName.trim()) {
      showError('Please fill in cluster name');
      return;
    }

    if (clusters.some(c => c.name === newClusterName && c.name !== editingCluster.name)) {
      showError('Cluster with this name already exists');
      return;
    }

    const updatedClusters = clusters.map(c =>
      c.name === editingCluster.name
        ? {
            ...c,
            name: newClusterName,
            type: newClusterType,
            healthChecks: newClusterHealthChecks,
            healthCheckInterval: newClusterHealthCheckInterval,
            healthCheckTimeout: newClusterHealthCheckTimeout,
            healthCheckPath: newClusterHealthCheckPath,
            healthCheckHealthyThreshold: newClusterHealthCheckHealthyThreshold,
            healthCheckUnhealthyThreshold: newClusterHealthCheckUnhealthyThreshold,
            connectTimeout: newClusterConnectTimeout,
            loadBalancingPolicy: newClusterLoadBalancingPolicy,
            circuitBreaker: newClusterCircuitBreaker,
            circuitBreakerMaxConnections: newClusterCircuitBreakerMaxConnections,
            circuitBreakerConsecutiveErrors: newClusterCircuitBreakerConsecutiveErrors,
            outlierDetection: newClusterOutlierDetection,
            outlierDetectionConsecutiveErrors: newClusterOutlierDetectionConsecutiveErrors,
          }
        : c
    );

    updateConfig({ clusters: updatedClusters });
    showSuccess('Cluster updated successfully');
    setEditingCluster(null);
    resetClusterForm();
  };

  const handleDeleteCluster = (name: string) => {
    // Check if cluster is used in routes
    const usedInRoutes = routes.some(r => r.cluster === name);
    if (usedInRoutes) {
      showError('Cannot delete cluster: it is used in routes');
      return;
    }

    updateConfig({ clusters: clusters.filter(c => c.name !== name) });
    showSuccess('Cluster deleted successfully');
    setDeletingCluster(null);
  };

  const resetClusterForm = () => {
    setNewClusterName('');
    setNewClusterType('STRICT_DNS');
    setNewClusterHealthChecks(true);
    setNewClusterHealthCheckInterval(10000);
    setNewClusterHealthCheckTimeout(5000);
    setNewClusterHealthCheckPath('/health');
    setNewClusterHealthCheckHealthyThreshold(1);
    setNewClusterHealthCheckUnhealthyThreshold(2);
    setNewClusterConnectTimeout(5000);
    setNewClusterLoadBalancingPolicy('ROUND_ROBIN');
    setNewClusterCircuitBreaker(false);
    setNewClusterCircuitBreakerMaxConnections(1024);
    setNewClusterCircuitBreakerConsecutiveErrors(5);
    setNewClusterOutlierDetection(false);
    setNewClusterOutlierDetectionConsecutiveErrors(5);
  };

  // Endpoint operations
  const handleCreateEndpoint = (clusterName: string) => {
    if (!newEndpointAddress.trim() || !newEndpointPort) {
      showError('Please fill in endpoint address and port');
      return;
    }

    const cluster = clusters.find(c => c.name === clusterName);
    if (!cluster) return;

    const newHost = {
      address: newEndpointAddress,
      port: newEndpointPort,
      weight: newEndpointWeight,
    };

    const updatedClusters = clusters.map(c =>
      c.name === clusterName
        ? { ...c, hosts: [...c.hosts, newHost] }
        : c
    );

    updateConfig({ clusters: updatedClusters });
    showSuccess('Endpoint added successfully');
    setShowCreateEndpoint(null);
    resetEndpointForm();
  };

  const handleEditEndpoint = (clusterName: string, endpointIndex: number) => {
    const cluster = clusters.find(c => c.name === clusterName);
    if (!cluster || !cluster.hosts[endpointIndex]) return;

    const endpoint = cluster.hosts[endpointIndex];
    setEditingEndpoint({ clusterName, endpointIndex });
    setNewEndpointAddress(endpoint.address);
    setNewEndpointPort(endpoint.port);
    setNewEndpointWeight(endpoint.weight || 100);
  };

  const handleSaveEndpoint = () => {
    if (!editingEndpoint || !newEndpointAddress.trim() || !newEndpointPort) {
      showError('Please fill in endpoint address and port');
      return;
    }

    const updatedClusters = clusters.map(c =>
      c.name === editingEndpoint.clusterName
        ? {
            ...c,
            hosts: c.hosts.map((h, idx) =>
              idx === editingEndpoint.endpointIndex
                ? { address: newEndpointAddress, port: newEndpointPort, weight: newEndpointWeight }
                : h
            ),
          }
        : c
    );

    updateConfig({ clusters: updatedClusters });
    showSuccess('Endpoint updated successfully');
    setEditingEndpoint(null);
    resetEndpointForm();
  };

  const handleDeleteEndpoint = (clusterName: string, endpointIndex: number) => {
    const updatedClusters = clusters.map(c =>
      c.name === clusterName
        ? { ...c, hosts: c.hosts.filter((_, idx) => idx !== endpointIndex) }
        : c
    );

    updateConfig({ clusters: updatedClusters });
    showSuccess('Endpoint deleted successfully');
    setDeletingEndpoint(null);
  };

  const resetEndpointForm = () => {
    setNewEndpointAddress('192.168.1.100');
    setNewEndpointPort(8080);
    setNewEndpointWeight(100);
  };

  // Listener operations
  const handleCreateListener = () => {
    if (!newListenerName.trim() || !newListenerPort) {
      showError('Please fill in listener name and port');
      return;
    }

    if (listeners.some(l => l.name === newListenerName)) {
      showError('Listener with this name already exists');
      return;
    }

    if (listeners.some(l => l.port === newListenerPort)) {
      showError('Port is already in use');
      return;
    }

    const newListener: Listener = {
      name: newListenerName,
      address: newListenerAddress,
      port: newListenerPort,
      protocol: newListenerProtocol,
      filters: newListenerFilters,
      activeConnections: 0,
      requests: 0,
      responses: 0,
    };

    updateConfig({ listeners: [...listeners, newListener] });
    showSuccess('Listener created successfully');
    setShowCreateListener(false);
    resetListenerForm();
  };

  const handleEditListener = (listener: Listener) => {
    setEditingListener(listener);
    setNewListenerName(listener.name);
    setNewListenerAddress(listener.address);
    setNewListenerPort(listener.port);
    setNewListenerProtocol(listener.protocol || 'HTTP');
    setNewListenerFilters(listener.filters);
  };

  const handleSaveListener = () => {
    if (!editingListener || !newListenerName.trim() || !newListenerPort) {
      showError('Please fill in listener name and port');
      return;
    }

    if (listeners.some(l => l.name === newListenerName && l.name !== editingListener.name)) {
      showError('Listener with this name already exists');
      return;
    }

    if (listeners.some(l => l.port === newListenerPort && l.name !== editingListener.name)) {
      showError('Port is already in use');
      return;
    }

    const updatedListeners = listeners.map(l =>
      l.name === editingListener.name
        ? {
            ...l,
            name: newListenerName,
            address: newListenerAddress,
            port: newListenerPort,
            protocol: newListenerProtocol,
            filters: newListenerFilters,
          }
        : l
    );

    updateConfig({ listeners: updatedListeners });
    showSuccess('Listener updated successfully');
    setEditingListener(null);
    resetListenerForm();
  };

  const handleDeleteListener = (name: string) => {
    updateConfig({ listeners: listeners.filter(l => l.name !== name) });
    showSuccess('Listener deleted successfully');
    setDeletingListener(null);
  };

  const resetListenerForm = () => {
    setNewListenerName('');
    setNewListenerAddress('0.0.0.0');
    setNewListenerPort(80);
    setNewListenerProtocol('HTTP');
    setNewListenerFilters(['http_connection_manager']);
  };

  // Route operations
  const handleCreateRoute = () => {
    if (!newRouteName.trim() || !newRouteMatch.trim() || !newRouteCluster) {
      showError('Please fill in route name, match pattern, and cluster');
      return;
    }

    if (routes.some(r => r.name === newRouteName)) {
      showError('Route with this name already exists');
      return;
    }

    if (!clusters.some(c => c.name === newRouteCluster)) {
      showError('Cluster does not exist');
      return;
    }

    const newRoute: Route = {
      name: newRouteName,
      match: newRouteMatch,
      cluster: newRouteCluster,
      priority: newRoutePriority,
      timeout: newRouteTimeout,
      requests: 0,
      responses: 0,
      errors: 0,
    };

    updateConfig({ routes: [...routes, newRoute] });
    showSuccess('Route created successfully');
    setShowCreateRoute(false);
    resetRouteForm();
  };

  const handleEditRoute = (route: Route) => {
    setEditingRoute(route);
    setNewRouteName(route.name);
    setNewRouteMatch(route.match);
    setNewRouteCluster(route.cluster);
    setNewRoutePriority(route.priority || 0);
    setNewRouteTimeout(route.timeout || 15000);
  };

  const handleSaveRoute = () => {
    if (!editingRoute || !newRouteName.trim() || !newRouteMatch.trim() || !newRouteCluster) {
      showError('Please fill in route name, match pattern, and cluster');
      return;
    }

    if (routes.some(r => r.name === newRouteName && r.name !== editingRoute.name)) {
      showError('Route with this name already exists');
      return;
    }

    if (!clusters.some(c => c.name === newRouteCluster)) {
      showError('Cluster does not exist');
      return;
    }

    const updatedRoutes = routes.map(r =>
      r.name === editingRoute.name
        ? {
            ...r,
            name: newRouteName,
            match: newRouteMatch,
            cluster: newRouteCluster,
            priority: newRoutePriority,
            timeout: newRouteTimeout,
          }
        : r
    );

    updateConfig({ routes: updatedRoutes });
    showSuccess('Route updated successfully');
    setEditingRoute(null);
    resetRouteForm();
  };

  const handleDeleteRoute = (name: string) => {
    updateConfig({ routes: routes.filter(r => r.name !== name) });
    showSuccess('Route deleted successfully');
    setDeletingRoute(null);
  };

  const resetRouteForm = () => {
    setNewRouteName('');
    setNewRouteMatch('/');
    setNewRouteCluster('');
    setNewRoutePriority(0);
    setNewRouteTimeout(15000);
  };

  const handleRefreshStats = () => {
    if (routingEngine) {
      const stats = routingEngine.getStats();
      showSuccess(`Stats refreshed: ${stats.totalRequests} requests, ${stats.healthyEndpoints}/${stats.totalEndpoints} endpoints healthy`);
    } else {
      showError('Routing engine not initialized');
    }
  };

  const totalClusters = config.totalClusters || clusters.length;
  const totalListeners = config.totalListeners || listeners.length;
  const totalRoutes = config.totalRoutes || routes.length;
  const totalRequests = config.totalRequests || 0;
  const totalResponses = config.totalResponses || 0;
  const totalErrors = config.totalErrors || 0;
  const activeConnections = config.activeConnections || 0;
  const totalBytesIn = config.totalBytesIn || 0;
  const totalBytesOut = config.totalBytesOut || 0;

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Envoy Proxy</p>
            <h2 className="text-2xl font-bold text-foreground">Service Proxy</h2>
            <p className="text-sm text-muted-foreground mt-1">
              High-performance edge and service proxy
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefreshStats}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-5 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Clusters</CardTitle>
                <Server className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalClusters}</span>
                <span className="text-xs text-muted-foreground">configured</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Listeners</CardTitle>
                <Network className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalListeners}</span>
                <span className="text-xs text-muted-foreground">active</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Routes</CardTitle>
                <Globe className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{totalRoutes}</span>
                <span className="text-xs text-muted-foreground">defined</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Requests</CardTitle>
                <Activity className="h-4 w-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{totalRequests.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Errors</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-red-600 dark:text-red-400">{totalErrors}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="clusters" className="space-y-4">
          <TabsList>
            <TabsTrigger value="clusters">
              <Server className="h-4 w-4 mr-2" />
              Clusters ({clusters.length})
            </TabsTrigger>
            <TabsTrigger value="listeners">
              <Network className="h-4 w-4 mr-2" />
              Listeners ({listeners.length})
            </TabsTrigger>
            <TabsTrigger value="routes">
              <Globe className="h-4 w-4 mr-2" />
              Routes ({routes.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clusters" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Clusters</CardTitle>
                    <CardDescription>Backend service clusters</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateCluster(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Cluster
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {clusters.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No clusters configured</p>
                    <p className="text-sm">Click "Create Cluster" to add one</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {clusters.map((cluster) => (
                      <Card key={cluster.name} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                        <CardHeader className="pb-3">
                          <div className="flex flex-col gap-3">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                <Server className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-lg font-semibold">{cluster.name}</CardTitle>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  <Badge variant="outline">{cluster.type}</Badge>
                                  <Badge variant="outline">{cluster.hosts.length} endpoints</Badge>
                                  {cluster.healthChecks && (
                                    <Badge variant="default" className="bg-green-500">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Health Checks
                                    </Badge>
                                  )}
                                  {cluster.circuitBreaker && (
                                    <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">
                                      Circuit Breaker
                                    </Badge>
                                  )}
                                  {cluster.outlierDetection && (
                                    <Badge variant="default" className="bg-purple-500 hover:bg-purple-600">
                                      Outlier Detection
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 ml-14">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditCluster(cluster)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowCreateEndpoint(cluster.name)}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Endpoint
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingCluster(cluster.name)}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <Label>Endpoints</Label>
                            {cluster.hosts.length === 0 ? (
                              <div className="text-center py-4 text-muted-foreground text-sm">
                                No endpoints configured. Click "Add Endpoint" to add one.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {cluster.hosts.map((host, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-2 border rounded">
                                    <span className="font-mono text-sm">{host.address}:{host.port}</span>
                                    <div className="flex items-center gap-2">
                                      {host.weight && host.weight !== 100 && (
                                        <Badge variant="outline">Weight: {host.weight}</Badge>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEditEndpoint(cluster.name, idx)}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setDeletingEndpoint({ clusterName: cluster.name, endpointIndex: idx })}
                                        className="hover:bg-destructive/10 hover:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm mt-4">
                            {cluster.requests !== undefined && (
                              <div>
                                <span className="text-muted-foreground">Requests:</span>
                                <span className="ml-2 font-semibold">{cluster.requests.toLocaleString()}</span>
                              </div>
                            )}
                            {cluster.errors !== undefined && cluster.errors > 0 && (
                              <div>
                                <span className="text-muted-foreground">Errors:</span>
                                <span className="ml-2 font-semibold text-red-500">{cluster.errors}</span>
                              </div>
                            )}
                            {cluster.connectTimeout && (
                              <div>
                                <span className="text-muted-foreground">Timeout:</span>
                                <span className="ml-2 font-semibold">{cluster.connectTimeout}ms</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="listeners" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Listeners</CardTitle>
                    <CardDescription>Network listeners and ports</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateListener(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Listener
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {listeners.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No listeners configured</p>
                    <p className="text-sm">Click "Create Listener" to add one</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {listeners.map((listener) => (
                      <Card key={listener.name} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-card">
                        <CardHeader className="pb-3">
                          <div className="flex flex-col gap-3">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                                <Network className="h-5 w-5 text-green-600 dark:text-green-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-lg font-semibold">{listener.name}</CardTitle>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  <Badge variant="outline" className="font-mono">{listener.address}:{listener.port}</Badge>
                                  {listener.protocol && (
                                    <Badge variant="outline">{listener.protocol}</Badge>
                                  )}
                                  {listener.activeConnections !== undefined && (
                                    <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
                                      {listener.activeConnections} connections
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 ml-14">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditListener(listener)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingListener(listener.name)}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <Label>Filters</Label>
                            <div className="flex flex-wrap gap-2">
                              {listener.filters.map((filter, idx) => (
                                <Badge key={idx} variant="outline">{filter}</Badge>
                              ))}
                            </div>
                          </div>
                          {listener.requests !== undefined && (
                            <div className="text-sm mt-4">
                              <span className="text-muted-foreground">Requests:</span>
                              <span className="ml-2 font-semibold">{listener.requests.toLocaleString()}</span>
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

          <TabsContent value="routes" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Routes</CardTitle>
                    <CardDescription>Request routing rules</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateRoute(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Route
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {routes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No routes configured</p>
                    <p className="text-sm">Click "Create Route" to add one</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {routes.map((route) => (
                      <Card key={route.name} className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow bg-card">
                        <CardHeader className="pb-3">
                          <div className="flex flex-col gap-3">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                                <Globe className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-lg font-semibold">{route.name}</CardTitle>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  <Badge variant="outline" className="font-mono text-xs">{route.match}</Badge>
                                  <Badge variant="outline">→ {route.cluster}</Badge>
                                  {route.priority !== undefined && (
                                    <Badge variant="outline">Priority: {route.priority}</Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 ml-14">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditRoute(route)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingRoute(route.name)}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        {route.requests !== undefined && (
                          <CardContent>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Requests:</span>
                                <span className="ml-2 font-semibold">{route.requests.toLocaleString()}</span>
                              </div>
                              {route.responses !== undefined && (
                                <div>
                                  <span className="text-muted-foreground">Responses:</span>
                                  <span className="ml-2 font-semibold">{route.responses.toLocaleString()}</span>
                                </div>
                              )}
                              {route.errors !== undefined && route.errors > 0 && (
                                <div>
                                  <span className="text-muted-foreground">Errors:</span>
                                  <span className="ml-2 font-semibold text-red-500">{route.errors}</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Envoy Settings</CardTitle>
                <CardDescription>Proxy configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Admin Interface</Label>
                  <Switch 
                    checked={config.enableAdminInterface ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableAdminInterface: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Access Logging</Label>
                  <Switch 
                    checked={config.enableAccessLogging ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableAccessLogging: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Stats</Label>
                  <Switch 
                    checked={config.enableStats ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableStats: checked })}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Admin Port</Label>
                  <Input 
                    type="number" 
                    value={config.adminPort ?? 9901}
                    onChange={(e) => updateConfig({ adminPort: parseInt(e.target.value) || 9901 })}
                    min={1} 
                    max={65535} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Drain Time (seconds)</Label>
                  <Input 
                    type="number" 
                    value={config.drainTime ?? 600}
                    onChange={(e) => updateConfig({ drainTime: parseInt(e.target.value) || 600 })}
                    min={1} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Connections</Label>
                  <Input 
                    type="number" 
                    value={config.maxConnections ?? 1024}
                    onChange={(e) => updateConfig({ maxConnections: parseInt(e.target.value) || 1024 })}
                    min={1} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Connect Timeout (ms)</Label>
                  <Input 
                    type="number" 
                    value={config.connectTimeout ?? 5000}
                    onChange={(e) => updateConfig({ connectTimeout: parseInt(e.target.value) || 5000 })}
                    min={1} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Request Timeout (ms)</Label>
                  <Input 
                    type="number" 
                    value={config.requestTimeout ?? 15000}
                    onChange={(e) => updateConfig({ requestTimeout: parseInt(e.target.value) || 15000 })}
                    min={1} 
                  />
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Rate Limiting</Label>
                      <p className="text-xs text-muted-foreground mt-1">Limit requests per second</p>
                    </div>
                    <Switch 
                      checked={config.enableRateLimiting ?? false}
                      onCheckedChange={(checked) => updateConfig({ enableRateLimiting: checked })}
                    />
                  </div>
                  {config.enableRateLimiting && (
                    <>
                      <div className="space-y-2">
                        <Label>Rate Limit (requests/second)</Label>
                        <Input 
                          type="number" 
                          value={config.rateLimitPerSecond ?? 100}
                          onChange={(e) => updateConfig({ rateLimitPerSecond: parseInt(e.target.value) || 100 })}
                          min={1} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Burst</Label>
                        <Input 
                          type="number" 
                          value={config.rateLimitBurst ?? 10}
                          onChange={(e) => updateConfig({ rateLimitBurst: parseInt(e.target.value) || 10 })}
                          min={1} 
                        />
                      </div>
                    </>
                  )}
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Tracing</Label>
                      <p className="text-xs text-muted-foreground mt-1">Distributed tracing support</p>
                    </div>
                    <Switch 
                      checked={config.enableTracing ?? false}
                      onCheckedChange={(checked) => updateConfig({ enableTracing: checked })}
                    />
                  </div>
                  {config.enableTracing && (
                    <div className="space-y-2">
                      <Label>Tracing Provider</Label>
                      <Select
                        value={config.tracingProvider || 'jaeger'}
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
                  )}
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Prometheus Metrics</Label>
                      <p className="text-xs text-muted-foreground mt-1">Export metrics for Prometheus scraping via /stats/prometheus</p>
                    </div>
                    <Switch 
                      checked={config.metrics?.enabled ?? true}
                      onCheckedChange={(checked) => updateConfig({ 
                        metrics: { 
                          ...config.metrics, 
                          enabled: checked,
                          prometheusPath: config.metrics?.prometheusPath || '/stats/prometheus'
                        } 
                      })}
                    />
                  </div>
                  {config.metrics?.enabled !== false && (
                    <div className="space-y-2">
                      <Label>Prometheus Stats Path</Label>
                      <Input 
                        type="text" 
                        value={config.metrics?.prometheusPath ?? '/stats/prometheus'}
                        onChange={(e) => updateConfig({ 
                          metrics: { 
                            ...config.metrics, 
                            prometheusPath: e.target.value || '/stats/prometheus'
                          } 
                        })}
                        placeholder="/stats/prometheus"
                      />
                      <p className="text-xs text-muted-foreground">
                        Metrics available at: {config.adminPort ?? 9901}{config.metrics?.prometheusPath || '/stats/prometheus'}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Cluster Dialog */}
      <Dialog open={showCreateCluster} onOpenChange={setShowCreateCluster}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Cluster</DialogTitle>
            <DialogDescription>Configure a new backend service cluster</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cluster Name *</Label>
              <Input
                value={newClusterName}
                onChange={(e) => setNewClusterName(e.target.value)}
                placeholder="backend-cluster"
              />
            </div>
            <div className="space-y-2">
              <Label>Cluster Type</Label>
              <Select value={newClusterType} onValueChange={(value: any) => setNewClusterType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STATIC_DNS">Static DNS</SelectItem>
                  <SelectItem value="STRICT_DNS">Strict DNS</SelectItem>
                  <SelectItem value="LOGICAL_DNS">Logical DNS</SelectItem>
                  <SelectItem value="EDS">EDS</SelectItem>
                  <SelectItem value="ORIGINAL_DST">Original Destination</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Load Balancing Policy</Label>
              <Select value={newClusterLoadBalancingPolicy} onValueChange={(value: any) => setNewClusterLoadBalancingPolicy(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
                  <SelectItem value="LEAST_REQUEST">Least Request</SelectItem>
                  <SelectItem value="RING_HASH">Ring Hash</SelectItem>
                  <SelectItem value="MAGLEV">Maglev</SelectItem>
                  <SelectItem value="RANDOM">Random</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Connect Timeout (ms)</Label>
              <Input
                type="number"
                value={newClusterConnectTimeout}
                onChange={(e) => setNewClusterConnectTimeout(parseInt(e.target.value) || 5000)}
                min={1}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label>Enable Health Checks</Label>
              <Switch checked={newClusterHealthChecks} onCheckedChange={setNewClusterHealthChecks} />
            </div>
            {newClusterHealthChecks && (
              <div className="space-y-4 pl-4 border-l-2">
                <div className="space-y-2">
                  <Label>Health Check Interval (ms)</Label>
                  <Input
                    type="number"
                    value={newClusterHealthCheckInterval}
                    onChange={(e) => setNewClusterHealthCheckInterval(parseInt(e.target.value) || 10000)}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Health Check Timeout (ms)</Label>
                  <Input
                    type="number"
                    value={newClusterHealthCheckTimeout}
                    onChange={(e) => setNewClusterHealthCheckTimeout(parseInt(e.target.value) || 5000)}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Health Check Path</Label>
                  <Input
                    value={newClusterHealthCheckPath}
                    onChange={(e) => setNewClusterHealthCheckPath(e.target.value)}
                    placeholder="/health"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Healthy Threshold</Label>
                    <Input
                      type="number"
                      value={newClusterHealthCheckHealthyThreshold}
                      onChange={(e) => setNewClusterHealthCheckHealthyThreshold(parseInt(e.target.value) || 1)}
                      min={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unhealthy Threshold</Label>
                    <Input
                      type="number"
                      value={newClusterHealthCheckUnhealthyThreshold}
                      onChange={(e) => setNewClusterHealthCheckUnhealthyThreshold(parseInt(e.target.value) || 2)}
                      min={1}
                    />
                  </div>
                </div>
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <Label>Enable Circuit Breaker</Label>
              <Switch checked={newClusterCircuitBreaker} onCheckedChange={setNewClusterCircuitBreaker} />
            </div>
            {newClusterCircuitBreaker && (
              <div className="space-y-4 pl-4 border-l-2">
                <div className="space-y-2">
                  <Label>Max Connections</Label>
                  <Input
                    type="number"
                    value={newClusterCircuitBreakerMaxConnections}
                    onChange={(e) => setNewClusterCircuitBreakerMaxConnections(parseInt(e.target.value) || 1024)}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Consecutive Errors</Label>
                  <Input
                    type="number"
                    value={newClusterCircuitBreakerConsecutiveErrors}
                    onChange={(e) => setNewClusterCircuitBreakerConsecutiveErrors(parseInt(e.target.value) || 5)}
                    min={1}
                  />
                </div>
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <Label>Enable Outlier Detection</Label>
              <Switch checked={newClusterOutlierDetection} onCheckedChange={setNewClusterOutlierDetection} />
            </div>
            {newClusterOutlierDetection && (
              <div className="space-y-2 pl-4 border-l-2">
                <Label>Consecutive Errors</Label>
                <Input
                  type="number"
                  value={newClusterOutlierDetectionConsecutiveErrors}
                  onChange={(e) => setNewClusterOutlierDetectionConsecutiveErrors(parseInt(e.target.value) || 5)}
                  min={1}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateCluster(false)}>Cancel</Button>
            <Button onClick={handleCreateCluster}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Cluster Dialog */}
      <Dialog open={!!editingCluster} onOpenChange={(open) => !open && setEditingCluster(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Cluster</DialogTitle>
            <DialogDescription>Update cluster configuration</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cluster Name *</Label>
              <Input
                value={newClusterName}
                onChange={(e) => setNewClusterName(e.target.value)}
                placeholder="backend-cluster"
              />
            </div>
            <div className="space-y-2">
              <Label>Cluster Type</Label>
              <Select value={newClusterType} onValueChange={(value: any) => setNewClusterType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STATIC_DNS">Static DNS</SelectItem>
                  <SelectItem value="STRICT_DNS">Strict DNS</SelectItem>
                  <SelectItem value="LOGICAL_DNS">Logical DNS</SelectItem>
                  <SelectItem value="EDS">EDS</SelectItem>
                  <SelectItem value="ORIGINAL_DST">Original Destination</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Load Balancing Policy</Label>
              <Select value={newClusterLoadBalancingPolicy} onValueChange={(value: any) => setNewClusterLoadBalancingPolicy(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
                  <SelectItem value="LEAST_REQUEST">Least Request</SelectItem>
                  <SelectItem value="RING_HASH">Ring Hash</SelectItem>
                  <SelectItem value="MAGLEV">Maglev</SelectItem>
                  <SelectItem value="RANDOM">Random</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Connect Timeout (ms)</Label>
              <Input
                type="number"
                value={newClusterConnectTimeout}
                onChange={(e) => setNewClusterConnectTimeout(parseInt(e.target.value) || 5000)}
                min={1}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label>Enable Health Checks</Label>
              <Switch checked={newClusterHealthChecks} onCheckedChange={setNewClusterHealthChecks} />
            </div>
            {newClusterHealthChecks && (
              <div className="space-y-4 pl-4 border-l-2">
                <div className="space-y-2">
                  <Label>Health Check Interval (ms)</Label>
                  <Input
                    type="number"
                    value={newClusterHealthCheckInterval}
                    onChange={(e) => setNewClusterHealthCheckInterval(parseInt(e.target.value) || 10000)}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Health Check Timeout (ms)</Label>
                  <Input
                    type="number"
                    value={newClusterHealthCheckTimeout}
                    onChange={(e) => setNewClusterHealthCheckTimeout(parseInt(e.target.value) || 5000)}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Health Check Path</Label>
                  <Input
                    value={newClusterHealthCheckPath}
                    onChange={(e) => setNewClusterHealthCheckPath(e.target.value)}
                    placeholder="/health"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Healthy Threshold</Label>
                    <Input
                      type="number"
                      value={newClusterHealthCheckHealthyThreshold}
                      onChange={(e) => setNewClusterHealthCheckHealthyThreshold(parseInt(e.target.value) || 1)}
                      min={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unhealthy Threshold</Label>
                    <Input
                      type="number"
                      value={newClusterHealthCheckUnhealthyThreshold}
                      onChange={(e) => setNewClusterHealthCheckUnhealthyThreshold(parseInt(e.target.value) || 2)}
                      min={1}
                    />
                  </div>
                </div>
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <Label>Enable Circuit Breaker</Label>
              <Switch checked={newClusterCircuitBreaker} onCheckedChange={setNewClusterCircuitBreaker} />
            </div>
            {newClusterCircuitBreaker && (
              <div className="space-y-4 pl-4 border-l-2">
                <div className="space-y-2">
                  <Label>Max Connections</Label>
                  <Input
                    type="number"
                    value={newClusterCircuitBreakerMaxConnections}
                    onChange={(e) => setNewClusterCircuitBreakerMaxConnections(parseInt(e.target.value) || 1024)}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Consecutive Errors</Label>
                  <Input
                    type="number"
                    value={newClusterCircuitBreakerConsecutiveErrors}
                    onChange={(e) => setNewClusterCircuitBreakerConsecutiveErrors(parseInt(e.target.value) || 5)}
                    min={1}
                  />
                </div>
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <Label>Enable Outlier Detection</Label>
              <Switch checked={newClusterOutlierDetection} onCheckedChange={setNewClusterOutlierDetection} />
            </div>
            {newClusterOutlierDetection && (
              <div className="space-y-2 pl-4 border-l-2">
                <Label>Consecutive Errors</Label>
                <Input
                  type="number"
                  value={newClusterOutlierDetectionConsecutiveErrors}
                  onChange={(e) => setNewClusterOutlierDetectionConsecutiveErrors(parseInt(e.target.value) || 5)}
                  min={1}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCluster(null)}>Cancel</Button>
            <Button onClick={handleSaveCluster}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Endpoint Dialog */}
      <Dialog open={!!showCreateEndpoint} onOpenChange={(open) => !open && setShowCreateEndpoint(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Endpoint</DialogTitle>
            <DialogDescription>Add a new endpoint to the cluster</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Address *</Label>
              <Input
                value={newEndpointAddress}
                onChange={(e) => setNewEndpointAddress(e.target.value)}
                placeholder="192.168.1.100"
              />
            </div>
            <div className="space-y-2">
              <Label>Port *</Label>
              <Input
                type="number"
                value={newEndpointPort}
                onChange={(e) => setNewEndpointPort(parseInt(e.target.value) || 8080)}
                min={1}
                max={65535}
              />
            </div>
            <div className="space-y-2">
              <Label>Weight</Label>
              <Input
                type="number"
                value={newEndpointWeight}
                onChange={(e) => setNewEndpointWeight(parseInt(e.target.value) || 100)}
                min={1}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateEndpoint(null)}>Cancel</Button>
            <Button onClick={() => showCreateEndpoint && handleCreateEndpoint(showCreateEndpoint)}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Endpoint Dialog */}
      <Dialog open={!!editingEndpoint} onOpenChange={(open) => !open && setEditingEndpoint(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Endpoint</DialogTitle>
            <DialogDescription>Update endpoint configuration</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Address *</Label>
              <Input
                value={newEndpointAddress}
                onChange={(e) => setNewEndpointAddress(e.target.value)}
                placeholder="192.168.1.100"
              />
            </div>
            <div className="space-y-2">
              <Label>Port *</Label>
              <Input
                type="number"
                value={newEndpointPort}
                onChange={(e) => setNewEndpointPort(parseInt(e.target.value) || 8080)}
                min={1}
                max={65535}
              />
            </div>
            <div className="space-y-2">
              <Label>Weight</Label>
              <Input
                type="number"
                value={newEndpointWeight}
                onChange={(e) => setNewEndpointWeight(parseInt(e.target.value) || 100)}
                min={1}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEndpoint(null)}>Cancel</Button>
            <Button onClick={handleSaveEndpoint}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Listener Dialog */}
      <Dialog open={showCreateListener} onOpenChange={setShowCreateListener}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Listener</DialogTitle>
            <DialogDescription>Configure a new network listener</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Listener Name *</Label>
              <Input
                value={newListenerName}
                onChange={(e) => setNewListenerName(e.target.value)}
                placeholder="http-listener"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={newListenerAddress}
                  onChange={(e) => setNewListenerAddress(e.target.value)}
                  placeholder="0.0.0.0"
                />
              </div>
              <div className="space-y-2">
                <Label>Port *</Label>
                <Input
                  type="number"
                  value={newListenerPort}
                  onChange={(e) => setNewListenerPort(parseInt(e.target.value) || 80)}
                  min={1}
                  max={65535}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Protocol</Label>
              <Select value={newListenerProtocol} onValueChange={(value: any) => setNewListenerProtocol(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HTTP">HTTP</SelectItem>
                  <SelectItem value="HTTPS">HTTPS</SelectItem>
                  <SelectItem value="TCP">TCP</SelectItem>
                  <SelectItem value="UDP">UDP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Filters</Label>
              <div className="flex flex-wrap gap-2">
                {['http_connection_manager', 'tls_inspector', 'router', 'cors', 'ratelimit'].map((filter) => (
                  <Badge
                    key={filter}
                    variant={newListenerFilters.includes(filter) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => {
                      if (newListenerFilters.includes(filter)) {
                        setNewListenerFilters(newListenerFilters.filter(f => f !== filter));
                      } else {
                        setNewListenerFilters([...newListenerFilters, filter]);
                      }
                    }}
                  >
                    {filter}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateListener(false)}>Cancel</Button>
            <Button onClick={handleCreateListener}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Listener Dialog */}
      <Dialog open={!!editingListener} onOpenChange={(open) => !open && setEditingListener(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Listener</DialogTitle>
            <DialogDescription>Update listener configuration</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Listener Name *</Label>
              <Input
                value={newListenerName}
                onChange={(e) => setNewListenerName(e.target.value)}
                placeholder="http-listener"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={newListenerAddress}
                  onChange={(e) => setNewListenerAddress(e.target.value)}
                  placeholder="0.0.0.0"
                />
              </div>
              <div className="space-y-2">
                <Label>Port *</Label>
                <Input
                  type="number"
                  value={newListenerPort}
                  onChange={(e) => setNewListenerPort(parseInt(e.target.value) || 80)}
                  min={1}
                  max={65535}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Protocol</Label>
              <Select value={newListenerProtocol} onValueChange={(value: any) => setNewListenerProtocol(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HTTP">HTTP</SelectItem>
                  <SelectItem value="HTTPS">HTTPS</SelectItem>
                  <SelectItem value="TCP">TCP</SelectItem>
                  <SelectItem value="UDP">UDP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Filters</Label>
              <div className="flex flex-wrap gap-2">
                {['http_connection_manager', 'tls_inspector', 'router', 'cors', 'ratelimit'].map((filter) => (
                  <Badge
                    key={filter}
                    variant={newListenerFilters.includes(filter) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => {
                      if (newListenerFilters.includes(filter)) {
                        setNewListenerFilters(newListenerFilters.filter(f => f !== filter));
                      } else {
                        setNewListenerFilters([...newListenerFilters, filter]);
                      }
                    }}
                  >
                    {filter}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingListener(null)}>Cancel</Button>
            <Button onClick={handleSaveListener}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Route Dialog */}
      <Dialog open={showCreateRoute} onOpenChange={setShowCreateRoute}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Route</DialogTitle>
            <DialogDescription>Configure a new routing rule</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Route Name *</Label>
              <Input
                value={newRouteName}
                onChange={(e) => setNewRouteName(e.target.value)}
                placeholder="api-route"
              />
            </div>
            <div className="space-y-2">
              <Label>Match Pattern *</Label>
              <Input
                value={newRouteMatch}
                onChange={(e) => setNewRouteMatch(e.target.value)}
                placeholder="/api/*"
              />
              <p className="text-xs text-muted-foreground">Use * for wildcard, /api/* for prefix match</p>
            </div>
            <div className="space-y-2">
              <Label>Cluster *</Label>
              <Select value={newRouteCluster} onValueChange={setNewRouteCluster}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cluster" />
                </SelectTrigger>
                <SelectContent>
                  {clusters.map((cluster) => (
                    <SelectItem key={cluster.name} value={cluster.name}>
                      {cluster.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={newRoutePriority}
                  onChange={(e) => setNewRoutePriority(parseInt(e.target.value) || 0)}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>Timeout (ms)</Label>
                <Input
                  type="number"
                  value={newRouteTimeout}
                  onChange={(e) => setNewRouteTimeout(parseInt(e.target.value) || 15000)}
                  min={1}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateRoute(false)}>Cancel</Button>
            <Button onClick={handleCreateRoute}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Route Dialog */}
      <Dialog open={!!editingRoute} onOpenChange={(open) => !open && setEditingRoute(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Route</DialogTitle>
            <DialogDescription>Update route configuration</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Route Name *</Label>
              <Input
                value={newRouteName}
                onChange={(e) => setNewRouteName(e.target.value)}
                placeholder="api-route"
              />
            </div>
            <div className="space-y-2">
              <Label>Match Pattern *</Label>
              <Input
                value={newRouteMatch}
                onChange={(e) => setNewRouteMatch(e.target.value)}
                placeholder="/api/*"
              />
              <p className="text-xs text-muted-foreground">Use * for wildcard, /api/* for prefix match</p>
            </div>
            <div className="space-y-2">
              <Label>Cluster *</Label>
              <Select value={newRouteCluster} onValueChange={setNewRouteCluster}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cluster" />
                </SelectTrigger>
                <SelectContent>
                  {clusters.map((cluster) => (
                    <SelectItem key={cluster.name} value={cluster.name}>
                      {cluster.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={newRoutePriority}
                  onChange={(e) => setNewRoutePriority(parseInt(e.target.value) || 0)}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>Timeout (ms)</Label>
                <Input
                  type="number"
                  value={newRouteTimeout}
                  onChange={(e) => setNewRouteTimeout(parseInt(e.target.value) || 15000)}
                  min={1}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRoute(null)}>Cancel</Button>
            <Button onClick={handleSaveRoute}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialogs */}
      <AlertDialog open={!!deletingCluster} onOpenChange={(open) => !open && setDeletingCluster(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cluster</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete cluster "{deletingCluster}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingCluster && handleDeleteCluster(deletingCluster)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingListener} onOpenChange={(open) => !open && setDeletingListener(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Listener</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete listener "{deletingListener}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingListener && handleDeleteListener(deletingListener)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingRoute} onOpenChange={(open) => !open && setDeletingRoute(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Route</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete route "{deletingRoute}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingRoute && handleDeleteRoute(deletingRoute)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingEndpoint} onOpenChange={(open) => !open && setDeletingEndpoint(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Endpoint</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this endpoint? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (deletingEndpoint) {
                handleDeleteEndpoint(deletingEndpoint.clusterName, deletingEndpoint.endpointIndex);
              }
            }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

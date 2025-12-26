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
  Server,
  Network,
  Shield,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
  Save
} from 'lucide-react';

interface HAProxyConfigProps {
  componentId: string;
}

interface BackendServer {
  id: string;
  name: string;
  address: string;
  port: number;
  weight?: number;
  check?: boolean;
  status: 'up' | 'down' | 'maint' | 'drain';
  sessions?: number;
  bytesIn?: number;
  bytesOut?: number;
  errors?: number;
}

interface HAProxyACL {
  id: string;
  name: string;
  criterion: string; // e.g., "hdr(host)", "path_beg", "src", etc.
  value?: string;
  operator?: 'eq' | 'ne' | 'beg' | 'end' | 'sub' | 'gt' | 'lt' | 'gte' | 'lte';
}

interface SSLCertificate {
  id: string;
  name: string;
  certPath: string;
  keyPath: string;
  caPath?: string;
  domain?: string;
}

interface Frontend {
  id: string;
  name: string;
  bind: string;
  mode: 'http' | 'tcp';
  backends: string[];
  ssl?: boolean;
  sslCertificates?: string[]; // IDs of SSL certificates
  acls?: HAProxyACL[];
  requests?: number;
  responses?: number;
  bytesIn?: number;
  bytesOut?: number;
}

interface Backend {
  id: string;
  name: string;
  mode: 'http' | 'tcp';
  balance: 'roundrobin' | 'leastconn' | 'source' | 'uri' | 'hdr' | 'rdp-cookie';
  servers: BackendServer[];
  healthCheck?: {
    enabled: boolean;
    interval?: number;
    timeout?: number;
    path?: string;
    fall?: number;
    rise?: number;
  };
  stickTable?: {
    enabled: boolean;
    type: 'ip' | 'integer' | 'string';
    size?: number;
    expire?: number;
  };
  acls?: HAProxyACL[];
}

interface HAProxyConfig {
  frontends?: Frontend[];
  backends?: Backend[];
  sslCertificates?: SSLCertificate[];
  totalRequests?: number;
  totalResponses?: number;
  activeConnections?: number;
  totalBytesIn?: number;
  totalBytesOut?: number;
  enableStatsUI?: boolean;
  enableLogging?: boolean;
  maxConnections?: number;
  timeoutConnect?: number;
  timeoutServer?: number;
  timeoutClient?: number;
  timeoutHttpRequest?: number;
  timeoutHttpKeepAlive?: number;
  statsPort?: number;
  statsUri?: string;
  statsRefresh?: number;
  rateLimit?: {
    enabled: boolean;
    rate?: string; // e.g., "10r/s"
    burst?: number;
  };
}

export function HAProxyConfigAdvanced({ componentId }: HAProxyConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const componentMetrics = useEmulationStore((state) => 
    state.componentMetrics.get(componentId)
  );
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as HAProxyConfig;
  const frontends = config.frontends || [];
  const backends = config.backends || [];

  // State for modals
  const [showCreateFrontend, setShowCreateFrontend] = useState(false);
  const [showCreateBackend, setShowCreateBackend] = useState(false);
  const [showCreateServer, setShowCreateServer] = useState<string | null>(null);
  const [editingFrontend, setEditingFrontend] = useState<Frontend | null>(null);
  const [editingBackend, setEditingBackend] = useState<Backend | null>(null);
  const [editingServer, setEditingServer] = useState<{ backendId: string; server: BackendServer } | null>(null);
  const [deletingFrontend, setDeletingFrontend] = useState<string | null>(null);
  const [deletingBackend, setDeletingBackend] = useState<string | null>(null);
  const [deletingServer, setDeletingServer] = useState<{ backendId: string; serverId: string } | null>(null);

  // Form states
  const [newFrontendName, setNewFrontendName] = useState('');
  const [newFrontendBind, setNewFrontendBind] = useState('0.0.0.0:80');
  const [newFrontendMode, setNewFrontendMode] = useState<'http' | 'tcp'>('http');
  const [newFrontendSSL, setNewFrontendSSL] = useState(false);
  const [newFrontendBackends, setNewFrontendBackends] = useState<string[]>([]);

  const [newBackendName, setNewBackendName] = useState('');
  const [newBackendMode, setNewBackendMode] = useState<'http' | 'tcp'>('http');
  const [newBackendBalance, setNewBackendBalance] = useState<'roundrobin' | 'leastconn' | 'source' | 'uri' | 'hdr' | 'rdp-cookie'>('roundrobin');
  const [newBackendHealthCheck, setNewBackendHealthCheck] = useState({
        enabled: true,
        interval: 2000,
        timeout: 1000,
        path: '/health',
    fall: 3,
    rise: 2,
  });

  const [newServerName, setNewServerName] = useState('');
  const [newServerAddress, setNewServerAddress] = useState('192.168.1.100');
  const [newServerPort, setNewServerPort] = useState(8080);
  const [newServerWeight, setNewServerWeight] = useState(100);
  const [newServerCheck, setNewServerCheck] = useState(true);

  // ACL state
  const [showCreateACL, setShowCreateACL] = useState<{ type: 'frontend' | 'backend'; id: string } | null>(null);
  const [editingACL, setEditingACL] = useState<{ type: 'frontend' | 'backend'; id: string; acl: HAProxyACL } | null>(null);
  const [deletingACL, setDeletingACL] = useState<{ type: 'frontend' | 'backend'; id: string; aclId: string } | null>(null);
  const [newACLName, setNewACLName] = useState('');
  const [newACLCriterion, setNewACLCriterion] = useState('hdr(host)');
  const [newACLValue, setNewACLValue] = useState('');
  const [newACLOperator, setNewACLOperator] = useState<'eq' | 'ne' | 'beg' | 'end' | 'sub' | 'gt' | 'lt' | 'gte' | 'lte'>('eq');

  // SSL state
  const [showCreateSSL, setShowCreateSSL] = useState(false);
  const [editingSSL, setEditingSSL] = useState<SSLCertificate | null>(null);
  const [deletingSSL, setDeletingSSL] = useState<string | null>(null);
  const [newSSLName, setNewSSLName] = useState('');
  const [newSSLCertPath, setNewSSLCertPath] = useState('');
  const [newSSLKeyPath, setNewSSLKeyPath] = useState('');
  const [newSSLCAPath, setNewSSLCAPath] = useState('');
  const [newSSLDomain, setNewSSLDomain] = useState('');

  const sslCertificates = config.sslCertificates || [];

  // Get HAProxy routing engine for real-time stats
  const routingEngine = emulationEngine.getHAProxyRoutingEngine(componentId);

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
    };

    // Update frontend stats
    if (updatedConfig.frontends) {
      updatedConfig.frontends = updatedConfig.frontends.map(fe => {
        const feStats = routingEngine.getFrontendStats(fe.name);
        return {
          ...fe,
          requests: feStats?.requests || fe.requests || 0,
          responses: feStats?.responses || fe.responses || 0,
          bytesIn: feStats?.bytesIn || fe.bytesIn || 0,
          bytesOut: feStats?.bytesOut || fe.bytesOut || 0,
        };
      });
    }

    // Update backend and server stats
    if (updatedConfig.backends) {
      updatedConfig.backends = updatedConfig.backends.map(be => {
        const beStats = routingEngine.getBackendStats(be.name);
        return {
          ...be,
          servers: be.servers.map(server => {
            // Server stats are updated by routing engine internally
            return server;
          }),
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
      const frontends = (config.frontends || []).map((fe: any) => ({
        id: fe.id,
        name: fe.name,
        bind: fe.bind,
        mode: fe.mode,
        defaultBackend: fe.backends && fe.backends.length > 0 ? fe.backends[0] : undefined,
        backends: fe.backends,
        ssl: fe.ssl,
        acls: fe.acls || [],
        requests: fe.requests || 0,
        responses: fe.responses || 0,
        bytesIn: fe.bytesIn || 0,
        bytesOut: fe.bytesOut || 0,
      }));
      
      const backends = (config.backends || []).map((be: any) => ({
        id: be.id,
        name: be.name,
        mode: be.mode,
        balance: be.balance,
        servers: be.servers || [],
        healthCheck: be.healthCheck,
        stickTable: be.stickTable,
        acls: be.acls || [],
      }));
      
      const globalConfig = {
        maxConnections: config.maxConnections,
        timeoutConnect: config.timeoutConnect,
        timeoutServer: config.timeoutServer,
        timeoutClient: config.timeoutClient,
        timeoutHttpRequest: config.timeoutHttpRequest,
        timeoutHttpKeepAlive: config.timeoutHttpKeepAlive,
        rateLimit: config.rateLimit,
      };
      
      routingEngine.initialize({ frontends, backends, globalConfig });
    }
  }, [config.frontends, config.backends, componentId, node]);

  const updateConfig = useCallback((updates: Partial<HAProxyConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  }, [componentId, node, config, updateNode]);

  // Frontend operations
  const handleCreateFrontend = () => {
    if (!newFrontendName.trim() || !newFrontendBind.trim()) {
      showError('Please fill in all required fields');
      return;
    }

    const newFrontend: Frontend = {
      id: `frontend-${Date.now()}`,
      name: newFrontendName,
      bind: newFrontendBind,
      mode: newFrontendMode,
      backends: newFrontendBackends,
      ssl: newFrontendSSL,
      requests: 0,
      responses: 0,
      bytesIn: 0,
      bytesOut: 0,
    };

    updateConfig({ frontends: [...frontends, newFrontend] });
    showSuccess('Frontend created successfully');
    setShowCreateFrontend(false);
    resetFrontendForm();
  };

  const handleEditFrontend = (frontend: Frontend) => {
    setEditingFrontend(frontend);
    setNewFrontendName(frontend.name);
    setNewFrontendBind(frontend.bind);
    setNewFrontendMode(frontend.mode);
    setNewFrontendSSL(frontend.ssl || false);
    setNewFrontendBackends(frontend.backends || []);
  };

  const handleSaveFrontend = () => {
    if (!editingFrontend || !newFrontendName.trim() || !newFrontendBind.trim()) {
      showError('Please fill in all required fields');
      return;
    }

    const updatedFrontends = frontends.map(fe =>
      fe.id === editingFrontend.id
        ? {
            ...fe,
            name: newFrontendName,
            bind: newFrontendBind,
            mode: newFrontendMode,
            ssl: newFrontendSSL,
            backends: newFrontendBackends,
          }
        : fe
    );

    updateConfig({ frontends: updatedFrontends });
    showSuccess('Frontend updated successfully');
    setEditingFrontend(null);
    resetFrontendForm();
  };

  const handleDeleteFrontend = (id: string) => {
    updateConfig({ frontends: frontends.filter(f => f.id !== id) });
    showSuccess('Frontend deleted successfully');
    setDeletingFrontend(null);
  };

  const resetFrontendForm = () => {
    setNewFrontendName('');
    setNewFrontendBind('0.0.0.0:80');
    setNewFrontendMode('http');
    setNewFrontendSSL(false);
    setNewFrontendBackends([]);
  };

  // Backend operations
  const handleCreateBackend = () => {
    if (!newBackendName.trim()) {
      showError('Please fill in backend name');
      return;
    }

    const newBackend: Backend = {
      id: `backend-${Date.now()}`,
      name: newBackendName,
      mode: newBackendMode,
      balance: newBackendBalance,
      servers: [],
      healthCheck: newBackendHealthCheck.enabled ? newBackendHealthCheck : undefined,
    };

    updateConfig({ backends: [...backends, newBackend] });
    showSuccess('Backend created successfully');
    setShowCreateBackend(false);
    resetBackendForm();
  };

  const handleEditBackend = (backend: Backend) => {
    setEditingBackend(backend);
    setNewBackendName(backend.name);
    setNewBackendMode(backend.mode);
    setNewBackendBalance(backend.balance);
    setNewBackendHealthCheck({
      enabled: backend.healthCheck?.enabled ?? true,
      interval: backend.healthCheck?.interval ?? 2000,
      timeout: backend.healthCheck?.timeout ?? 1000,
      path: backend.healthCheck?.path ?? '/health',
      fall: backend.healthCheck?.fall ?? 3,
      rise: backend.healthCheck?.rise ?? 2,
    });
  };

  const handleSaveBackend = () => {
    if (!editingBackend || !newBackendName.trim()) {
      showError('Please fill in backend name');
      return;
    }

    const updatedBackends = backends.map(be =>
      be.id === editingBackend.id
        ? {
            ...be,
            name: newBackendName,
            mode: newBackendMode,
            balance: newBackendBalance,
            healthCheck: newBackendHealthCheck.enabled ? newBackendHealthCheck : undefined,
          }
        : be
    );

    updateConfig({ backends: updatedBackends });
    showSuccess('Backend updated successfully');
    setEditingBackend(null);
    resetBackendForm();
  };

  const handleDeleteBackend = (id: string) => {
    updateConfig({ backends: backends.filter(b => b.id !== id) });
    showSuccess('Backend deleted successfully');
    setDeletingBackend(null);
  };

  const resetBackendForm = () => {
    setNewBackendName('');
    setNewBackendMode('http');
    setNewBackendBalance('roundrobin');
    setNewBackendHealthCheck({
      enabled: true,
      interval: 2000,
      timeout: 1000,
      path: '/health',
      fall: 3,
      rise: 2,
    });
  };

  // Server operations
  const handleCreateServer = (backendId: string) => {
    if (!newServerName.trim() || !newServerAddress.trim()) {
      showError('Please fill in server name and address');
      return;
    }

    const backend = backends.find(b => b.id === backendId);
    if (!backend) return;

    const newServer: BackendServer = {
      id: `server-${Date.now()}`,
      name: newServerName,
      address: newServerAddress,
      port: newServerPort,
      weight: newServerWeight,
      check: newServerCheck,
      status: 'up',
      sessions: 0,
      bytesIn: 0,
      bytesOut: 0,
      errors: 0,
    };

    const updatedBackends = backends.map(be =>
      be.id === backendId
        ? { ...be, servers: [...be.servers, newServer] }
        : be
    );

    updateConfig({ backends: updatedBackends });
    showSuccess('Server added successfully');
    setShowCreateServer(null);
    resetServerForm();
  };

  const handleEditServer = (backendId: string, server: BackendServer) => {
    setEditingServer({ backendId, server });
    setNewServerName(server.name);
    setNewServerAddress(server.address);
    setNewServerPort(server.port);
    setNewServerWeight(server.weight || 100);
    setNewServerCheck(server.check !== false);
  };

  const handleSaveServer = () => {
    if (!editingServer || !newServerName.trim() || !newServerAddress.trim()) {
      showError('Please fill in server name and address');
      return;
    }

    const updatedBackends = backends.map(be =>
      be.id === editingServer.backendId
        ? {
            ...be,
            servers: be.servers.map(s =>
              s.id === editingServer.server.id
                ? {
                    ...s,
                    name: newServerName,
                    address: newServerAddress,
                    port: newServerPort,
                    weight: newServerWeight,
                    check: newServerCheck,
                  }
                : s
            ),
          }
        : be
    );

    updateConfig({ backends: updatedBackends });
    showSuccess('Server updated successfully');
    setEditingServer(null);
    resetServerForm();
  };

  const handleDeleteServer = (backendId: string, serverId: string) => {
    const updatedBackends = backends.map(be =>
      be.id === backendId
        ? { ...be, servers: be.servers.filter(s => s.id !== serverId) }
        : be
    );

    updateConfig({ backends: updatedBackends });
    showSuccess('Server deleted successfully');
    setDeletingServer(null);
  };

  const resetServerForm = () => {
    setNewServerName('');
    setNewServerAddress('192.168.1.100');
    setNewServerPort(8080);
    setNewServerWeight(100);
    setNewServerCheck(true);
  };

  const handleRefreshStats = () => {
    if (routingEngine) {
      const stats = routingEngine.getStats();
      showSuccess(`Stats refreshed: ${stats.totalRequests} requests, ${stats.upServers}/${stats.totalServers} servers up`);
    } else {
      showError('Routing engine not initialized');
    }
  };

  // ACL operations
  const handleCreateACL = () => {
    if (!showCreateACL || !newACLName.trim() || !newACLCriterion.trim()) {
      showError('Please fill in ACL name and criterion');
      return;
    }

    const newACL: HAProxyACL = {
      id: `acl-${Date.now()}`,
      name: newACLName,
      criterion: newACLCriterion,
      value: newACLValue || undefined,
      operator: newACLValue ? newACLOperator : undefined,
    };

    if (showCreateACL.type === 'frontend') {
      const updatedFrontends = frontends.map(fe =>
        fe.id === showCreateACL.id
          ? { ...fe, acls: [...(fe.acls || []), newACL] }
          : fe
      );
      updateConfig({ frontends: updatedFrontends });
    } else {
      const updatedBackends = backends.map(be =>
        be.id === showCreateACL.id
          ? { ...be, acls: [...(be.acls || []), newACL] }
          : be
      );
      updateConfig({ backends: updatedBackends });
    }

    showSuccess('ACL rule created successfully');
    setShowCreateACL(null);
    resetACLForm();
  };

  const handleEditACL = (type: 'frontend' | 'backend', id: string, acl: HAProxyACL) => {
    setEditingACL({ type, id, acl });
    setNewACLName(acl.name);
    setNewACLCriterion(acl.criterion);
    setNewACLValue(acl.value || '');
    setNewACLOperator(acl.operator || 'eq');
  };

  const handleSaveACL = () => {
    if (!editingACL || !newACLName.trim() || !newACLCriterion.trim()) {
      showError('Please fill in ACL name and criterion');
      return;
    }

    const updatedACL: HAProxyACL = {
      ...editingACL.acl,
      name: newACLName,
      criterion: newACLCriterion,
      value: newACLValue || undefined,
      operator: newACLValue ? newACLOperator : undefined,
    };

    if (editingACL.type === 'frontend') {
      const updatedFrontends = frontends.map(fe =>
        fe.id === editingACL.id
          ? {
              ...fe,
              acls: fe.acls?.map(a => a.id === editingACL.acl.id ? updatedACL : a) || [updatedACL],
            }
          : fe
      );
      updateConfig({ frontends: updatedFrontends });
    } else {
      const updatedBackends = backends.map(be =>
        be.id === editingACL.id
          ? {
              ...be,
              acls: be.acls?.map(a => a.id === editingACL.acl.id ? updatedACL : a) || [updatedACL],
            }
          : be
      );
      updateConfig({ backends: updatedBackends });
    }

    showSuccess('ACL rule updated successfully');
    setEditingACL(null);
    resetACLForm();
  };

  const handleDeleteACL = () => {
    if (!deletingACL) return;

    if (deletingACL.type === 'frontend') {
      const updatedFrontends = frontends.map(fe =>
        fe.id === deletingACL.id
          ? { ...fe, acls: fe.acls?.filter(a => a.id !== deletingACL.aclId) || [] }
          : fe
      );
      updateConfig({ frontends: updatedFrontends });
    } else {
      const updatedBackends = backends.map(be =>
        be.id === deletingACL.id
          ? { ...be, acls: be.acls?.filter(a => a.id !== deletingACL.aclId) || [] }
          : be
      );
      updateConfig({ backends: updatedBackends });
    }

    showSuccess('ACL rule deleted successfully');
    setDeletingACL(null);
  };

  const resetACLForm = () => {
    setNewACLName('');
    setNewACLCriterion('hdr(host)');
    setNewACLValue('');
    setNewACLOperator('eq');
  };

  // SSL operations
  const handleCreateSSL = () => {
    if (!newSSLName.trim() || !newSSLCertPath.trim() || !newSSLKeyPath.trim()) {
      showError('Please fill in certificate name, cert path, and key path');
      return;
    }

    const newCert: SSLCertificate = {
      id: `ssl-${Date.now()}`,
      name: newSSLName,
      certPath: newSSLCertPath,
      keyPath: newSSLKeyPath,
      caPath: newSSLCAPath || undefined,
      domain: newSSLDomain || undefined,
    };

    updateConfig({ sslCertificates: [...sslCertificates, newCert] });
    showSuccess('SSL certificate added successfully');
    setShowCreateSSL(false);
    resetSSLForm();
  };

  const handleSaveSSL = () => {
    if (!editingSSL || !newSSLName.trim() || !newSSLCertPath.trim() || !newSSLKeyPath.trim()) {
      showError('Please fill in certificate name, cert path, and key path');
      return;
    }

    const updatedCerts = sslCertificates.map(cert =>
      cert.id === editingSSL.id
        ? {
            ...cert,
            name: newSSLName,
            certPath: newSSLCertPath,
            keyPath: newSSLKeyPath,
            caPath: newSSLCAPath || undefined,
            domain: newSSLDomain || undefined,
          }
        : cert
    );

    updateConfig({ sslCertificates: updatedCerts });
    showSuccess('SSL certificate updated successfully');
    setEditingSSL(null);
    resetSSLForm();
  };

  const handleDeleteSSL = (id: string) => {
    updateConfig({ sslCertificates: sslCertificates.filter(c => c.id !== id) });
    showSuccess('SSL certificate deleted successfully');
    setDeletingSSL(null);
  };

  const resetSSLForm = () => {
    setNewSSLName('');
    setNewSSLCertPath('');
    setNewSSLKeyPath('');
    setNewSSLCAPath('');
    setNewSSLDomain('');
  };

  // Calculate metrics from config and emulation
  const totalRequests = config.totalRequests || frontends.reduce((sum, f) => sum + (f.requests || 0), 0);
  const totalResponses = config.totalResponses || frontends.reduce((sum, f) => sum + (f.responses || 0), 0);
  const activeConnections = config.activeConnections || (componentMetrics?.customMetrics?.active_connections as number) || 0;
  const totalBytesIn = config.totalBytesIn || (componentMetrics?.customMetrics?.total_bytes_in as number) || 0;
  const totalBytesOut = config.totalBytesOut || (componentMetrics?.customMetrics?.total_bytes_out as number) || 0;

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">HAProxy</p>
            <h2 className="text-2xl font-bold text-foreground">Load Balancer</h2>
            <p className="text-sm text-muted-foreground mt-1">
              High-performance load balancer and proxy server
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefreshStats}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh Stats
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-5 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Requests</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalRequests.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Responses</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">{totalResponses.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Connections</CardTitle>
                <Network className="h-4 w-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{activeConnections}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Bytes In</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{(totalBytesIn / 1024 / 1024).toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">MB</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Bytes Out</CardTitle>
                <TrendingUp className="h-4 w-4 text-orange-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{(totalBytesOut / 1024 / 1024).toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">MB</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="backends" className="space-y-4">
          <TabsList>
            <TabsTrigger value="backends">
              <Server className="h-4 w-4 mr-2" />
              Backends ({backends.length})
            </TabsTrigger>
            <TabsTrigger value="frontends">
              <Network className="h-4 w-4 mr-2" />
              Frontends ({frontends.length})
            </TabsTrigger>
            <TabsTrigger value="stats">
              <Activity className="h-4 w-4 mr-2" />
              Statistics
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="backends" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Backends</CardTitle>
                    <CardDescription>Configure backend server pools</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateBackend(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Backend
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {backends.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No backends configured</p>
                      <p className="text-sm">Click "Create Backend" to add one</p>
                    </div>
                  ) : (
                    backends.map((backend) => (
                    <Card key={backend.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                              <Server className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{backend.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline">{backend.mode.toUpperCase()}</Badge>
                                <Badge variant="outline">{backend.balance}</Badge>
                                <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300">
                                  {backend.servers.length} servers
                                </Badge>
                                <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300">
                                  {backend.servers.filter((s) => s.status === 'up').length} up
                                </Badge>
                                  {backend.healthCheck?.enabled && (
                                    <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
                                      Health Check
                                    </Badge>
                                  )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                                onClick={() => handleEditBackend(backend)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowCreateServer(backend.id)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Server
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                                onClick={() => setDeletingBackend(backend.id)}
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Backend Name</Label>
                            <Input
                              value={backend.name}
                                onChange={(e) => {
                                  const updated = backends.map(b =>
                                    b.id === backend.id ? { ...b, name: e.target.value } : b
                                  );
                                  updateConfig({ backends: updated });
                                }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Mode</Label>
                            <Select
                              value={backend.mode}
                                onValueChange={(value: 'http' | 'tcp') => {
                                  const updated = backends.map(b =>
                                    b.id === backend.id ? { ...b, mode: value } : b
                                  );
                                  updateConfig({ backends: updated });
                                }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="http">HTTP</SelectItem>
                                <SelectItem value="tcp">TCP</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Balance Algorithm</Label>
                            <Select
                              value={backend.balance}
                                onValueChange={(value: 'roundrobin' | 'leastconn' | 'source' | 'uri' | 'hdr' | 'rdp-cookie') => {
                                  const updated = backends.map(b =>
                                    b.id === backend.id ? { ...b, balance: value } : b
                                  );
                                  updateConfig({ backends: updated });
                                }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="roundrobin">Round Robin</SelectItem>
                                <SelectItem value="leastconn">Least Connections</SelectItem>
                                <SelectItem value="source">Source</SelectItem>
                                <SelectItem value="uri">URI</SelectItem>
                                  <SelectItem value="hdr">Header</SelectItem>
                                  <SelectItem value="rdp-cookie">RDP Cookie</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Separator />
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label>Stick Table</Label>
                            <Switch
                              checked={backend.stickTable?.enabled || false}
                              onCheckedChange={(checked) => {
                                const updated = backends.map(b =>
                                  b.id === backend.id
                                    ? {
                                        ...b,
                                        stickTable: checked
                                          ? {
                                              enabled: true,
                                              type: b.stickTable?.type || 'ip',
                                              size: b.stickTable?.size || 10000,
                                              expire: b.stickTable?.expire || 3600,
                                            }
                                          : undefined,
                                      }
                                    : b
                                );
                                updateConfig({ backends: updated });
                              }}
                            />
                          </div>
                          {backend.stickTable?.enabled && (
                            <div className="grid grid-cols-3 gap-4 pl-4 border-l-2">
                              <div className="space-y-2">
                                <Label>Type</Label>
                                <Select
                                  value={backend.stickTable.type || 'ip'}
                                  onValueChange={(value: 'ip' | 'integer' | 'string') => {
                                    const updated = backends.map(b =>
                                      b.id === backend.id
                                        ? {
                                            ...b,
                                            stickTable: b.stickTable
                                              ? { ...b.stickTable, type: value }
                                              : { enabled: true, type: value, size: 10000, expire: 3600 },
                                          }
                                        : b
                                    );
                                    updateConfig({ backends: updated });
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ip">IP Address</SelectItem>
                                    <SelectItem value="integer">Integer</SelectItem>
                                    <SelectItem value="string">String</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Size</Label>
                                <Input
                                  type="number"
                                  value={backend.stickTable.size || 10000}
                                  onChange={(e) => {
                                    const updated = backends.map(b =>
                                      b.id === backend.id
                                        ? {
                                            ...b,
                                            stickTable: b.stickTable
                                              ? { ...b.stickTable, size: parseInt(e.target.value) || 10000 }
                                              : { enabled: true, type: 'ip', size: parseInt(e.target.value) || 10000, expire: 3600 },
                                          }
                                        : b
                                    );
                                    updateConfig({ backends: updated });
                                  }}
                                  min={1}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Expire (seconds)</Label>
                                <Input
                                  type="number"
                                  value={backend.stickTable.expire || 3600}
                                  onChange={(e) => {
                                    const updated = backends.map(b =>
                                      b.id === backend.id
                                        ? {
                                            ...b,
                                            stickTable: b.stickTable
                                              ? { ...b.stickTable, expire: parseInt(e.target.value) || 3600 }
                                              : { enabled: true, type: 'ip', size: 10000, expire: parseInt(e.target.value) || 3600 },
                                          }
                                        : b
                                    );
                                    updateConfig({ backends: updated });
                                  }}
                                  min={1}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                          <Label>Servers</Label>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setShowCreateServer(backend.id)}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Server
                              </Button>
                            </div>
                            {backend.servers.length === 0 ? (
                              <div className="text-center py-4 text-muted-foreground text-sm">
                                No servers configured. Click "Add Server" to add one.
                              </div>
                            ) : (
                          <div className="space-y-2">
                            {backend.servers.map((server) => (
                              <Card key={server.id} className="p-3 border-l-2 border-l-green-500">
                                <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3 flex-1">
                                    <div className={`p-1.5 rounded ${
                                      server.status === 'up' ? 'bg-green-100 dark:bg-green-900/30' :
                                          server.status === 'down' ? 'bg-red-100 dark:bg-red-900/30' : 
                                          server.status === 'maint' ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-gray-100 dark:bg-gray-900/30'
                                    }`}>
                                      {server.status === 'up' ? (
                                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                      ) : server.status === 'down' ? (
                                        <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                      ) : (
                                        <AlertCircle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                                      )}
                                    </div>
                                        <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{server.name}</span>
                                        <Badge variant="outline" className="text-xs">
                                          {server.address}:{server.port}
                                        </Badge>
                                        <Badge variant={server.status === 'up' ? 'default' : 'destructive'}>
                                          {server.status}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                            <span>Weight: {server.weight || 100}</span>
                                        <span>Sessions: {server.sessions || 0}</span>
                                        {server.errors && server.errors > 0 && (
                                          <span className="text-red-500">Errors: {server.errors}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      value={server.weight || 100}
                                          onChange={(e) => {
                                            const updated = backends.map(b =>
                                              b.id === backend.id
                                                ? {
                                                    ...b,
                                                    servers: b.servers.map(s =>
                                                      s.id === server.id
                                                        ? { ...s, weight: Number(e.target.value) }
                                                        : s
                                                    ),
                                                  }
                                                : b
                                            );
                                            updateConfig({ backends: updated });
                                          }}
                                      className="w-20"
                                      min={1}
                                      max={256}
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                          onClick={() => handleEditServer(backend.id, server)}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => setDeletingServer({ backendId: backend.id, serverId: server.id })}
                                      className="hover:bg-destructive/10 hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                            )}
                        </div>
                      </CardContent>
                    </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="frontends" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                <CardTitle>Frontends</CardTitle>
                <CardDescription>Configure frontend listeners</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateFrontend(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Frontend
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {frontends.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No frontends configured</p>
                      <p className="text-sm">Click "Create Frontend" to add one</p>
                    </div>
                  ) : (
                    frontends.map((frontend) => (
                    <Card key={frontend.id} className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                              <Network className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{frontend.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline">{frontend.bind}</Badge>
                                <Badge variant="outline">{frontend.mode.toUpperCase()}</Badge>
                                {frontend.ssl && (
                                  <Badge variant="default" className="bg-green-500">
                                    <Shield className="h-3 w-3 mr-1" />
                                    SSL
                                  </Badge>
                                )}
                                  <Badge variant="outline">
                                    {frontend.backends.length} backend{frontend.backends.length !== 1 ? 's' : ''}
                                  </Badge>
                              </div>
                            </div>
                          </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditFrontend(frontend)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingFrontend(frontend.id)}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Requests:</span>
                            <span className="ml-2 font-semibold">{frontend.requests?.toLocaleString() || 0}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Responses:</span>
                            <span className="ml-2 font-semibold">{frontend.responses?.toLocaleString() || 0}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Backends:</span>
                            <span className="ml-2 font-semibold">{frontend.backends.length}</span>
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

          <TabsContent value="stats" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Real-time Statistics</CardTitle>
                <CardDescription>Live server and connection statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {backends.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No backends configured</p>
                    </div>
                  ) : (
                    backends.map((backend) => {
                      const backendStats = routingEngine?.getBackendStats(backend.name);
                      return (
                    <Card key={backend.id} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{backend.name}</CardTitle>
                            {backendStats && (
                              <CardDescription>
                                {backendStats.upServers}/{backendStats.servers} servers up
                              </CardDescription>
                            )}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                              {backend.servers.length === 0 ? (
                                <div className="text-center py-4 text-muted-foreground text-sm">
                                  No servers configured
                                </div>
                              ) : (
                                backend.servers.map((server) => (
                            <div key={server.id} className="flex items-center justify-between p-2 border rounded">
                              <div className="flex items-center gap-3">
                                <Badge variant={server.status === 'up' ? 'default' : 'destructive'}>
                                  {server.status}
                                </Badge>
                                <span className="font-medium">{server.name}</span>
                                <span className="text-sm text-muted-foreground">{server.address}:{server.port}</span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>Sessions: {server.sessions || 0}</span>
                                      <span>In: {((server.bytesIn || 0) / 1024).toFixed(1)} KB</span>
                                      <span>Out: {((server.bytesOut || 0) / 1024).toFixed(1)} KB</span>
                                {server.errors && server.errors > 0 && (
                                  <span className="text-red-500">Errors: {server.errors}</span>
                                )}
                              </div>
                            </div>
                                ))
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

          <TabsContent value="acl" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Access Control Lists (ACL)</CardTitle>
                <CardDescription>Configure ACL rules for frontends and backends</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Frontend ACLs */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Frontend ACLs</h3>
                  {frontends.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No frontends configured. Create a frontend first.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {frontends.map((frontend) => (
                        <Card key={frontend.id} className="border-l-4 border-l-purple-500">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-base">{frontend.name}</CardTitle>
                                <CardDescription>{frontend.bind}</CardDescription>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowCreateACL({ type: 'frontend', id: frontend.id })}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add ACL
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {frontend.acls && frontend.acls.length > 0 ? (
                              <div className="space-y-2">
                                {frontend.acls.map((acl) => (
                                  <div key={acl.id} className="flex items-center justify-between p-2 border rounded">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline">{acl.name}</Badge>
                                        <span className="text-sm font-mono">{acl.criterion}</span>
                                        {acl.operator && (
                                          <>
                                            <span className="text-muted-foreground">{acl.operator}</span>
                                            {acl.value && <span className="text-sm">{acl.value}</span>}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEditACL('frontend', frontend.id, acl)}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setDeletingACL({ type: 'frontend', id: frontend.id, aclId: acl.id })}
                                        className="hover:bg-destructive/10 hover:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                          ))}
                        </div>
                            ) : (
                              <div className="text-center py-4 text-muted-foreground text-sm">
                                No ACL rules configured
                              </div>
                            )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
                  )}
                </div>

                <Separator />

                {/* Backend ACLs */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Backend ACLs</h3>
                  {backends.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No backends configured. Create a backend first.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {backends.map((backend) => (
                        <Card key={backend.id} className="border-l-4 border-l-blue-500">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-base">{backend.name}</CardTitle>
                                <CardDescription>{backend.mode.toUpperCase()} - {backend.balance}</CardDescription>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowCreateACL({ type: 'backend', id: backend.id })}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add ACL
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {backend.acls && backend.acls.length > 0 ? (
                              <div className="space-y-2">
                                {backend.acls.map((acl) => (
                                  <div key={acl.id} className="flex items-center justify-between p-2 border rounded">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline">{acl.name}</Badge>
                                        <span className="text-sm font-mono">{acl.criterion}</span>
                                        {acl.operator && (
                                          <>
                                            <span className="text-muted-foreground">{acl.operator}</span>
                                            {acl.value && <span className="text-sm">{acl.value}</span>}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEditACL('backend', backend.id, acl)}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setDeletingACL({ type: 'backend', id: backend.id, aclId: acl.id })}
                                        className="hover:bg-destructive/10 hover:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-4 text-muted-foreground text-sm">
                                No ACL rules configured
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ssl" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>SSL/TLS Certificates</CardTitle>
                    <CardDescription>Manage SSL certificates for secure connections</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateSSL(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Certificate
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {sslCertificates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No SSL certificates configured</p>
                    <p className="text-sm">Click "Add Certificate" to add one</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sslCertificates.map((cert) => (
                      <Card key={cert.id} className="border-l-4 border-l-green-500">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-base">{cert.name}</CardTitle>
                              {cert.domain && (
                                <CardDescription>Domain: {cert.domain}</CardDescription>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingSSL(cert);
                                  setNewSSLName(cert.name);
                                  setNewSSLCertPath(cert.certPath);
                                  setNewSSLKeyPath(cert.keyPath);
                                  setNewSSLCAPath(cert.caPath || '');
                                  setNewSSLDomain(cert.domain || '');
                                }}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingSSL(cert.id)}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Cert Path:</span>
                              <span className="ml-2 font-mono text-xs">{cert.certPath}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Key Path:</span>
                              <span className="ml-2 font-mono text-xs">{cert.keyPath}</span>
                            </div>
                            {cert.caPath && (
                              <div>
                                <span className="text-muted-foreground">CA Path:</span>
                                <span className="ml-2 font-mono text-xs">{cert.caPath}</span>
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

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>HAProxy Settings</CardTitle>
                <CardDescription>Global configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Stats UI</Label>
                  <Switch 
                    checked={config.enableStatsUI ?? true}
                    onCheckedChange={(checked) => {
                      updateConfig({ enableStatsUI: checked });
                      showSuccess(`Stats UI ${checked ? 'enabled' : 'disabled'}`);
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Logging</Label>
                  <Switch 
                    checked={config.enableLogging ?? true}
                    onCheckedChange={(checked) => {
                      updateConfig({ enableLogging: checked });
                      showSuccess(`Logging ${checked ? 'enabled' : 'disabled'}`);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Connections</Label>
                  <Input 
                    type="number" 
                    value={config.maxConnections ?? 4096}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 4096;
                      updateConfig({ maxConnections: value });
                      showSuccess(`Max connections set to ${value}`);
                    }}
                    min={1} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timeout Connect (ms)</Label>
                  <Input 
                    type="number" 
                    value={config.timeoutConnect ?? 5000}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 5000;
                      updateConfig({ timeoutConnect: value });
                    }}
                    min={1} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timeout Server (ms)</Label>
                  <Input 
                    type="number" 
                    value={config.timeoutServer ?? 50000}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 50000;
                      updateConfig({ timeoutServer: value });
                    }}
                    min={1} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timeout Client (ms)</Label>
                  <Input 
                    type="number" 
                    value={config.timeoutClient ?? 50000}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 50000;
                      updateConfig({ timeoutClient: value });
                    }}
                    min={1} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timeout HTTP Request (ms)</Label>
                  <Input 
                    type="number" 
                    value={config.timeoutHttpRequest ?? 10000}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 10000;
                      updateConfig({ timeoutHttpRequest: value });
                    }}
                    min={1} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timeout HTTP Keep-Alive (ms)</Label>
                  <Input 
                    type="number" 
                    value={config.timeoutHttpKeepAlive ?? 10000}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 10000;
                      updateConfig({ timeoutHttpKeepAlive: value });
                    }}
                    min={1} 
                  />
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Rate Limiting</Label>
                    <Switch 
                      checked={config.rateLimit?.enabled ?? false}
                      onCheckedChange={(checked) => {
                        updateConfig({ 
                          rateLimit: checked
                            ? {
                                enabled: true,
                                rate: config.rateLimit?.rate || '10r/s',
                                burst: config.rateLimit?.burst || 5,
                              }
                            : { enabled: false }
                        });
                      }}
                    />
                  </div>
                  {config.rateLimit?.enabled && (
                    <div className="grid grid-cols-2 gap-4 pl-4 border-l-2">
                      <div className="space-y-2">
                        <Label>Rate (e.g., 10r/s)</Label>
                        <Input 
                          value={config.rateLimit.rate || '10r/s'}
                          onChange={(e) => {
                            updateConfig({ 
                              rateLimit: {
                                enabled: true,
                                rate: e.target.value,
                                burst: config.rateLimit?.burst || 5,
                              }
                            });
                          }}
                          placeholder="10r/s"
                        />
                        <p className="text-xs text-muted-foreground">Format: number + r/s, r/m, or r/h</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Burst</Label>
                        <Input 
                          type="number"
                          value={config.rateLimit.burst || 5}
                          onChange={(e) => {
                            updateConfig({ 
                              rateLimit: {
                                enabled: true,
                                rate: config.rateLimit?.rate || '10r/s',
                                burst: parseInt(e.target.value) || 5,
                              }
                            });
                          }}
                          min={1}
                        />
                        <p className="text-xs text-muted-foreground">Additional requests allowed beyond rate</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Frontend Dialog */}
      <Dialog open={showCreateFrontend} onOpenChange={setShowCreateFrontend}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Frontend</DialogTitle>
            <DialogDescription>
              Configure a new frontend listener for incoming connections
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Frontend Name *</Label>
              <Input
                value={newFrontendName}
                onChange={(e) => setNewFrontendName(e.target.value)}
                placeholder="http_frontend"
              />
    </div>
            <div className="space-y-2">
              <Label>Bind Address *</Label>
              <Input
                value={newFrontendBind}
                onChange={(e) => setNewFrontendBind(e.target.value)}
                placeholder="0.0.0.0:80"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select value={newFrontendMode} onValueChange={(v: 'http' | 'tcp') => setNewFrontendMode(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="tcp">TCP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-8">
                <Switch
                  id="ssl"
                  checked={newFrontendSSL}
                  onCheckedChange={setNewFrontendSSL}
                />
                <Label htmlFor="ssl">Enable SSL</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Backends</Label>
              <Select
                value={newFrontendBackends[0] || ''}
                onValueChange={(value) => setNewFrontendBackends([value])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select backend" />
                </SelectTrigger>
                <SelectContent>
                  {backends.map(be => (
                    <SelectItem key={be.id} value={be.name}>{be.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateFrontend(false);
              resetFrontendForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateFrontend}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Frontend Dialog */}
      <Dialog open={editingFrontend !== null} onOpenChange={(open) => !open && setEditingFrontend(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Frontend</DialogTitle>
            <DialogDescription>
              Update frontend configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Frontend Name *</Label>
              <Input
                value={newFrontendName}
                onChange={(e) => setNewFrontendName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Bind Address *</Label>
              <Input
                value={newFrontendBind}
                onChange={(e) => setNewFrontendBind(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select value={newFrontendMode} onValueChange={(v: 'http' | 'tcp') => setNewFrontendMode(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="tcp">TCP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-8">
                <Switch
                  id="ssl-edit"
                  checked={newFrontendSSL}
                  onCheckedChange={setNewFrontendSSL}
                />
                <Label htmlFor="ssl-edit">Enable SSL</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Backends</Label>
              <Select
                value={newFrontendBackends[0] || ''}
                onValueChange={(value) => setNewFrontendBackends([value])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select backend" />
                </SelectTrigger>
                <SelectContent>
                  {backends.map(be => (
                    <SelectItem key={be.id} value={be.name}>{be.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingFrontend(null);
              resetFrontendForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveFrontend}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Backend Dialog */}
      <Dialog open={showCreateBackend} onOpenChange={setShowCreateBackend}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Backend</DialogTitle>
            <DialogDescription>
              Configure a new backend server pool
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Backend Name *</Label>
              <Input
                value={newBackendName}
                onChange={(e) => setNewBackendName(e.target.value)}
                placeholder="web_backend"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select value={newBackendMode} onValueChange={(v: 'http' | 'tcp') => setNewBackendMode(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="tcp">TCP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Balance Algorithm</Label>
                <Select value={newBackendBalance} onValueChange={(v: any) => setNewBackendBalance(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="roundrobin">Round Robin</SelectItem>
                    <SelectItem value="leastconn">Least Connections</SelectItem>
                    <SelectItem value="source">Source</SelectItem>
                    <SelectItem value="uri">URI</SelectItem>
                    <SelectItem value="hdr">Header</SelectItem>
                    <SelectItem value="rdp-cookie">RDP Cookie</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Health Check</Label>
                <Switch
                  checked={newBackendHealthCheck.enabled}
                  onCheckedChange={(checked) =>
                    setNewBackendHealthCheck({ ...newBackendHealthCheck, enabled: checked })
                  }
                />
              </div>
              {newBackendHealthCheck.enabled && (
                <div className="grid grid-cols-2 gap-4 pl-4 border-l-2">
                  <div className="space-y-2">
                    <Label>Interval (ms)</Label>
                    <Input
                      type="number"
                      value={newBackendHealthCheck.interval}
                      onChange={(e) =>
                        setNewBackendHealthCheck({
                          ...newBackendHealthCheck,
                          interval: parseInt(e.target.value) || 2000,
                        })
                      }
                      min={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Timeout (ms)</Label>
                    <Input
                      type="number"
                      value={newBackendHealthCheck.timeout}
                      onChange={(e) =>
                        setNewBackendHealthCheck({
                          ...newBackendHealthCheck,
                          timeout: parseInt(e.target.value) || 1000,
                        })
                      }
                      min={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Path</Label>
                    <Input
                      value={newBackendHealthCheck.path}
                      onChange={(e) =>
                        setNewBackendHealthCheck({
                          ...newBackendHealthCheck,
                          path: e.target.value,
                        })
                      }
                      placeholder="/health"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fall (failures)</Label>
                    <Input
                      type="number"
                      value={newBackendHealthCheck.fall}
                      onChange={(e) =>
                        setNewBackendHealthCheck({
                          ...newBackendHealthCheck,
                          fall: parseInt(e.target.value) || 3,
                        })
                      }
                      min={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rise (successes)</Label>
                    <Input
                      type="number"
                      value={newBackendHealthCheck.rise}
                      onChange={(e) =>
                        setNewBackendHealthCheck({
                          ...newBackendHealthCheck,
                          rise: parseInt(e.target.value) || 2,
                        })
                      }
                      min={1}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateBackend(false);
              resetBackendForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateBackend}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Backend Dialog */}
      <Dialog open={editingBackend !== null} onOpenChange={(open) => !open && setEditingBackend(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Backend</DialogTitle>
            <DialogDescription>
              Update backend configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Backend Name *</Label>
              <Input
                value={newBackendName}
                onChange={(e) => setNewBackendName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select value={newBackendMode} onValueChange={(v: 'http' | 'tcp') => setNewBackendMode(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="tcp">TCP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Balance Algorithm</Label>
                <Select value={newBackendBalance} onValueChange={(v: any) => setNewBackendBalance(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="roundrobin">Round Robin</SelectItem>
                    <SelectItem value="leastconn">Least Connections</SelectItem>
                    <SelectItem value="source">Source</SelectItem>
                    <SelectItem value="uri">URI</SelectItem>
                    <SelectItem value="hdr">Header</SelectItem>
                    <SelectItem value="rdp-cookie">RDP Cookie</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Health Check</Label>
                <Switch
                  checked={newBackendHealthCheck.enabled}
                  onCheckedChange={(checked) =>
                    setNewBackendHealthCheck({ ...newBackendHealthCheck, enabled: checked })
                  }
                />
              </div>
              {newBackendHealthCheck.enabled && (
                <div className="grid grid-cols-2 gap-4 pl-4 border-l-2">
                  <div className="space-y-2">
                    <Label>Interval (ms)</Label>
                    <Input
                      type="number"
                      value={newBackendHealthCheck.interval}
                      onChange={(e) =>
                        setNewBackendHealthCheck({
                          ...newBackendHealthCheck,
                          interval: parseInt(e.target.value) || 2000,
                        })
                      }
                      min={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Timeout (ms)</Label>
                    <Input
                      type="number"
                      value={newBackendHealthCheck.timeout}
                      onChange={(e) =>
                        setNewBackendHealthCheck({
                          ...newBackendHealthCheck,
                          timeout: parseInt(e.target.value) || 1000,
                        })
                      }
                      min={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Path</Label>
                    <Input
                      value={newBackendHealthCheck.path}
                      onChange={(e) =>
                        setNewBackendHealthCheck({
                          ...newBackendHealthCheck,
                          path: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fall (failures)</Label>
                    <Input
                      type="number"
                      value={newBackendHealthCheck.fall}
                      onChange={(e) =>
                        setNewBackendHealthCheck({
                          ...newBackendHealthCheck,
                          fall: parseInt(e.target.value) || 3,
                        })
                      }
                      min={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rise (successes)</Label>
                    <Input
                      type="number"
                      value={newBackendHealthCheck.rise}
                      onChange={(e) =>
                        setNewBackendHealthCheck({
                          ...newBackendHealthCheck,
                          rise: parseInt(e.target.value) || 2,
                        })
                      }
                      min={1}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingBackend(null);
              resetBackendForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveBackend}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Server Dialog */}
      <Dialog open={showCreateServer !== null} onOpenChange={(open) => !open && setShowCreateServer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Server</DialogTitle>
            <DialogDescription>
              Add a new server to the backend
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Server Name *</Label>
              <Input
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                placeholder="web1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Address *</Label>
                <Input
                  value={newServerAddress}
                  onChange={(e) => setNewServerAddress(e.target.value)}
                  placeholder="192.168.1.10"
                />
              </div>
              <div className="space-y-2">
                <Label>Port *</Label>
                <Input
                  type="number"
                  value={newServerPort}
                  onChange={(e) => setNewServerPort(parseInt(e.target.value) || 8080)}
                  min={1}
                  max={65535}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Weight</Label>
                <Input
                  type="number"
                  value={newServerWeight}
                  onChange={(e) => setNewServerWeight(parseInt(e.target.value) || 100)}
                  min={1}
                  max={256}
                />
              </div>
              <div className="flex items-center space-x-2 pt-8">
                <Switch
                  id="check"
                  checked={newServerCheck}
                  onCheckedChange={setNewServerCheck}
                />
                <Label htmlFor="check">Health Check</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateServer(null);
              resetServerForm();
            }}>
              Cancel
            </Button>
            <Button onClick={() => showCreateServer && handleCreateServer(showCreateServer)}>
              Add Server
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Server Dialog */}
      <Dialog open={editingServer !== null} onOpenChange={(open) => !open && setEditingServer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Server</DialogTitle>
            <DialogDescription>
              Update server configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Server Name *</Label>
              <Input
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Address *</Label>
                <Input
                  value={newServerAddress}
                  onChange={(e) => setNewServerAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Port *</Label>
                <Input
                  type="number"
                  value={newServerPort}
                  onChange={(e) => setNewServerPort(parseInt(e.target.value) || 8080)}
                  min={1}
                  max={65535}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Weight</Label>
                  <Input
                    type="number"
                    value={newServerWeight}
                    onChange={(e) => setNewServerWeight(parseInt(e.target.value) || 100)}
                    min={1}
                    max={256}
                  />
              </div>
              <div className="flex items-center space-x-2 pt-8">
                <Switch
                  id="check-edit"
                  checked={newServerCheck}
                  onCheckedChange={setNewServerCheck}
                />
                <Label htmlFor="check-edit">Health Check</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingServer(null);
              resetServerForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveServer}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create ACL Dialog */}
      <Dialog open={showCreateACL !== null} onOpenChange={(open) => !open && setShowCreateACL(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create ACL Rule</DialogTitle>
            <DialogDescription>
              Add an access control list rule for {showCreateACL?.type === 'frontend' ? 'frontend' : 'backend'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>ACL Name *</Label>
              <Input
                value={newACLName}
                onChange={(e) => setNewACLName(e.target.value)}
                placeholder="is_api_request"
              />
            </div>
            <div className="space-y-2">
              <Label>Criterion *</Label>
              <Select value={newACLCriterion} onValueChange={setNewACLCriterion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hdr(host)">hdr(host) - Host header</SelectItem>
                  <SelectItem value="path_beg">path_beg - Path begins with</SelectItem>
                  <SelectItem value="path_end">path_end - Path ends with</SelectItem>
                  <SelectItem value="path">path - Exact path match</SelectItem>
                  <SelectItem value="src">src - Source IP address</SelectItem>
                  <SelectItem value="method">method - HTTP method</SelectItem>
                  <SelectItem value="url_param">url_param - URL parameter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                value={newACLValue}
                onChange={(e) => setNewACLValue(e.target.value)}
                placeholder="api.example.com"
              />
              <p className="text-xs text-muted-foreground">Value to match against the criterion</p>
            </div>
            {newACLValue && (
              <div className="space-y-2">
                <Label>Operator</Label>
                <Select value={newACLOperator} onValueChange={(v: any) => setNewACLOperator(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eq">Equals (eq)</SelectItem>
                    <SelectItem value="ne">Not equals (ne)</SelectItem>
                    <SelectItem value="beg">Begins with (beg)</SelectItem>
                    <SelectItem value="end">Ends with (end)</SelectItem>
                    <SelectItem value="sub">Contains (sub)</SelectItem>
                    <SelectItem value="gt">Greater than (gt)</SelectItem>
                    <SelectItem value="lt">Less than (lt)</SelectItem>
                    <SelectItem value="gte">Greater or equal (gte)</SelectItem>
                    <SelectItem value="lte">Less or equal (lte)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateACL(null);
              resetACLForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateACL}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit ACL Dialog */}
      <Dialog open={editingACL !== null} onOpenChange={(open) => !open && setEditingACL(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit ACL Rule</DialogTitle>
            <DialogDescription>
              Update ACL rule configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>ACL Name *</Label>
              <Input
                value={newACLName}
                onChange={(e) => setNewACLName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Criterion *</Label>
              <Select value={newACLCriterion} onValueChange={setNewACLCriterion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hdr(host)">hdr(host) - Host header</SelectItem>
                  <SelectItem value="path_beg">path_beg - Path begins with</SelectItem>
                  <SelectItem value="path_end">path_end - Path ends with</SelectItem>
                  <SelectItem value="path">path - Exact path match</SelectItem>
                  <SelectItem value="src">src - Source IP address</SelectItem>
                  <SelectItem value="method">method - HTTP method</SelectItem>
                  <SelectItem value="url_param">url_param - URL parameter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                value={newACLValue}
                onChange={(e) => setNewACLValue(e.target.value)}
              />
            </div>
            {newACLValue && (
              <div className="space-y-2">
                <Label>Operator</Label>
                <Select value={newACLOperator} onValueChange={(v: any) => setNewACLOperator(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eq">Equals (eq)</SelectItem>
                    <SelectItem value="ne">Not equals (ne)</SelectItem>
                    <SelectItem value="beg">Begins with (beg)</SelectItem>
                    <SelectItem value="end">Ends with (end)</SelectItem>
                    <SelectItem value="sub">Contains (sub)</SelectItem>
                    <SelectItem value="gt">Greater than (gt)</SelectItem>
                    <SelectItem value="lt">Less than (lt)</SelectItem>
                    <SelectItem value="gte">Greater or equal (gte)</SelectItem>
                    <SelectItem value="lte">Less or equal (lte)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingACL(null);
              resetACLForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveACL}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create SSL Certificate Dialog */}
      <Dialog open={showCreateSSL} onOpenChange={setShowCreateSSL}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add SSL Certificate</DialogTitle>
            <DialogDescription>
              Configure SSL/TLS certificate for secure connections
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Certificate Name *</Label>
              <Input
                value={newSSLName}
                onChange={(e) => setNewSSLName(e.target.value)}
                placeholder="example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Certificate Path *</Label>
                <Input
                  value={newSSLCertPath}
                  onChange={(e) => setNewSSLCertPath(e.target.value)}
                  placeholder="/etc/ssl/certs/example.com.crt"
                />
              </div>
              <div className="space-y-2">
                <Label>Private Key Path *</Label>
                <Input
                  value={newSSLKeyPath}
                  onChange={(e) => setNewSSLKeyPath(e.target.value)}
                  placeholder="/etc/ssl/private/example.com.key"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CA Certificate Path</Label>
                <Input
                  value={newSSLCAPath}
                  onChange={(e) => setNewSSLCAPath(e.target.value)}
                  placeholder="/etc/ssl/certs/ca.crt"
                />
              </div>
              <div className="space-y-2">
                <Label>Domain</Label>
                <Input
                  value={newSSLDomain}
                  onChange={(e) => setNewSSLDomain(e.target.value)}
                  placeholder="example.com"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateSSL(false);
              resetSSLForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateSSL}>
              Add Certificate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit SSL Certificate Dialog */}
      <Dialog open={editingSSL !== null} onOpenChange={(open) => !open && setEditingSSL(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit SSL Certificate</DialogTitle>
            <DialogDescription>
              Update SSL certificate configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Certificate Name *</Label>
              <Input
                value={newSSLName}
                onChange={(e) => setNewSSLName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Certificate Path *</Label>
                <Input
                  value={newSSLCertPath}
                  onChange={(e) => setNewSSLCertPath(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Private Key Path *</Label>
                <Input
                  value={newSSLKeyPath}
                  onChange={(e) => setNewSSLKeyPath(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CA Certificate Path</Label>
                <Input
                  value={newSSLCAPath}
                  onChange={(e) => setNewSSLCAPath(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Domain</Label>
                <Input
                  value={newSSLDomain}
                  onChange={(e) => setNewSSLDomain(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingSSL(null);
              resetSSLForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveSSL}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmations */}
      <AlertDialog open={deletingFrontend !== null} onOpenChange={(open) => !open && setDeletingFrontend(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Frontend?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the frontend "{frontends.find(f => f.id === deletingFrontend)?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingFrontend && handleDeleteFrontend(deletingFrontend)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deletingBackend !== null} onOpenChange={(open) => !open && setDeletingBackend(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Backend?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the backend "{backends.find(b => b.id === deletingBackend)?.name}" and all its servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingBackend && handleDeleteBackend(deletingBackend)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deletingServer !== null} onOpenChange={(open) => !open && setDeletingServer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Server?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently remove the server from the backend.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingServer && handleDeleteServer(deletingServer.backendId, deletingServer.serverId)}
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

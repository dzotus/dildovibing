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
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Globe,
  Server,
  TrendingUp,
  Zap,
  CheckCircle,
  MapPin,
  Edit,
  Search,
  X,
  AlertCircle,
  Info,
  Eraser,
  Shield,
  Lock,
  Compress
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CDNConfigProps {
  componentId: string;
}

interface Distribution {
  id: string;
  domain: string;
  origin: string;
  status: 'deployed' | 'deploying' | 'failed';
  edgeLocations?: number;
  requests?: number;
  cacheHitRate?: number;
  bandwidth?: number;
  cachePolicy?: 'cache-first' | 'origin-first' | 'bypass';
  defaultTTL?: number;
  maxTTL?: number;
  enableCompression?: boolean;
  compressionType?: 'gzip' | 'brotli' | 'zstd';
  enableHTTP2?: boolean;
  enableHTTP3?: boolean;
  enableHTTPS?: boolean;
  enableGeoRouting?: boolean;
  enableDDoSProtection?: boolean;
}

interface EdgeLocation {
  id: string;
  region: string;
  city: string;
  requests?: number;
  cacheHits?: number;
  bandwidth?: number;
  status: 'active' | 'inactive';
  capacity?: number;
  latency?: number;
}

interface CDNConfig {
  cdnProvider?: 'cloudflare' | 'cloudfront' | 'fastly' | 'akamai';
  distributions?: Distribution[];
  edgeLocations?: EdgeLocation[];
  totalDistributions?: number;
  totalEdgeLocations?: number;
  totalRequests?: number;
  totalBandwidth?: number;
  averageCacheHitRate?: number;
  enableCaching?: boolean;
  cacheTTL?: number;
  enableCompression?: boolean;
  compressionType?: 'gzip' | 'brotli' | 'zstd';
  enableSSL?: boolean;
  enableHTTP2?: boolean;
  enableHTTP3?: boolean;
  enablePurge?: boolean;
  enableGeoRouting?: boolean;
  enableDDoSProtection?: boolean;
  defaultTTL?: number;
  maxTTL?: number;
  cachePolicy?: 'cache-first' | 'origin-first' | 'bypass';
  metrics?: {
    enabled?: boolean;
    port?: number;
    path?: string;
  };
}

export function CDNConfigAdvanced({ componentId }: CDNConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { getComponentMetrics, isRunning, updateMetrics } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  // Get CDN emulation engine
  const cdnEngine = emulationEngine.getCDNEmulationEngine(componentId);
  const componentMetrics = getComponentMetrics(componentId);

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as CDNConfig;
  
  // State for UI
  const [showDistributionDialog, setShowDistributionDialog] = useState(false);
  const [showEdgeLocationDialog, setShowEdgeLocationDialog] = useState(false);
  const [editingDistribution, setEditingDistribution] = useState<Distribution | null>(null);
  const [editingEdgeLocation, setEditingEdgeLocation] = useState<EdgeLocation | null>(null);
  const [distributionSearch, setDistributionSearch] = useState('');
  const [edgeLocationSearch, setEdgeLocationSearch] = useState('');
  const [showPurgeDialog, setShowPurgeDialog] = useState(false);
  const [purgingDistributionId, setPurgingDistributionId] = useState<string | null>(null);

  // Form state for distribution
  const [distributionForm, setDistributionForm] = useState<Partial<Distribution>>({
    domain: '',
    origin: '',
    status: 'deploying',
    cachePolicy: 'cache-first',
    defaultTTL: 3600,
    maxTTL: 86400,
    enableCompression: true,
    compressionType: 'gzip',
    enableHTTP2: true,
    enableHTTP3: false,
    enableHTTPS: true,
    enableGeoRouting: false,
    enableDDoSProtection: true,
  });

  // Validation errors for distribution form
  const [distributionErrors, setDistributionErrors] = useState<Record<string, string>>({});
  const [distributionTouched, setDistributionTouched] = useState<Record<string, boolean>>({});

  // Form state for edge location
  const [edgeLocationForm, setEdgeLocationForm] = useState<Partial<EdgeLocation>>({
    region: '',
    city: '',
    status: 'active',
    capacity: 10000,
    latency: 50,
  });

  // Validation errors for edge location form
  const [edgeLocationErrors, setEdgeLocationErrors] = useState<Record<string, string>>({});
  const [edgeLocationTouched, setEdgeLocationTouched] = useState<Record<string, boolean>>({});

  // Get distributions and edge locations from config
  const distributions = config.distributions || [];
  const edgeLocations = config.edgeLocations || [];

  // Sync configuration with emulation engine when config changes
  useEffect(() => {
    if (!cdnEngine || !node) return;

    // Update emulation engine with current config
    cdnEngine.initializeConfig(node);
  }, [config.distributions, config.edgeLocations, config.enableCaching, config.cacheTTL, config.enableCompression, config.compressionType, config.enableSSL, config.enableHTTP2, config.enableHTTP3, config.enablePurge, config.enableGeoRouting, config.enableDDoSProtection, config.defaultTTL, config.maxTTL, config.cachePolicy, cdnEngine, node]);

  // Sync metrics from emulation engine
  useEffect(() => {
    if (!cdnEngine || !componentMetrics || !isRunning) return;

    const cdnMetrics = cdnEngine.getMetrics();
    const customMetrics = componentMetrics.customMetrics || {};
    const routingEngine = cdnEngine.getRoutingEngine();
    const engineDistributions = routingEngine.getDistributions();
    const engineEdgeLocations = routingEngine.getEdgeLocations();
    const stats = routingEngine.getStats();

    // Update distributions with real metrics
    const updatedDistributions = distributions.map(dist => {
      const engineDist = engineDistributions.find(d => d.id === dist.id);
      const distStats = stats.distributions.get(dist.id);
      
      return {
        ...dist,
        requests: distStats?.requests || dist.requests || 0,
        cacheHitRate: distStats && distStats.requests > 0
          ? (distStats.cacheHits / distStats.requests) * 100
          : dist.cacheHitRate || 0,
        bandwidth: distStats?.bandwidth || dist.bandwidth || 0,
        edgeLocations: engineDist?.edgeLocations || dist.edgeLocations || 0,
      };
    });

    // Update edge locations with real metrics
    const updatedEdgeLocations = edgeLocations.map(loc => {
      const engineLoc = engineEdgeLocations.find(l => l.id === loc.id);
      const locStats = stats.edgeLocations.get(loc.id);
      
      return {
        ...loc,
        requests: locStats?.requests || loc.requests || 0,
        cacheHits: locStats?.cacheHits || loc.cacheHits || 0,
        bandwidth: locStats?.bandwidth || loc.bandwidth || 0,
      };
    });

    // Calculate totals
    const totalDistributions = updatedDistributions.length;
    const totalEdgeLocations = updatedEdgeLocations.length;
    const totalRequests = customMetrics.cdn_total_requests || cdnMetrics.totalRequests || updatedDistributions.reduce((sum, d) => sum + (d.requests || 0), 0);
    const totalBandwidth = customMetrics.cdn_total_bandwidth || cdnMetrics.totalBandwidth || updatedDistributions.reduce((sum, d) => sum + (d.bandwidth || 0), 0);
    const averageCacheHitRate = customMetrics.cdn_average_cache_hit_rate || cdnMetrics.averageCacheHitRate || (updatedDistributions.length > 0
      ? updatedDistributions.reduce((sum, d) => sum + (d.cacheHitRate || 0), 0) / updatedDistributions.length
      : 0);

    // Only update if there are significant changes
    const hasChanges = 
      JSON.stringify(updatedDistributions) !== JSON.stringify(distributions) ||
      JSON.stringify(updatedEdgeLocations) !== JSON.stringify(edgeLocations) ||
      config.totalRequests !== totalRequests ||
      config.totalBandwidth !== totalBandwidth ||
      config.averageCacheHitRate !== averageCacheHitRate;

    if (hasChanges) {
      updateNode(componentId, {
        data: {
          ...node.data,
          config: {
            ...config,
            distributions: updatedDistributions,
            edgeLocations: updatedEdgeLocations,
            totalDistributions,
            totalEdgeLocations,
            totalRequests,
            totalBandwidth,
            averageCacheHitRate,
          },
        },
      });
    }
  }, [componentMetrics, cdnEngine, isRunning]);

  // Filtered lists
  const filteredDistributions = useMemo(() => {
    if (!distributionSearch) return distributions;
    const search = distributionSearch.toLowerCase();
    return distributions.filter(d => 
      d.domain.toLowerCase().includes(search) ||
      d.origin.toLowerCase().includes(search) ||
      d.status.toLowerCase().includes(search)
    );
  }, [distributions, distributionSearch]);

  const filteredEdgeLocations = useMemo(() => {
    if (!edgeLocationSearch) return edgeLocations;
    const search = edgeLocationSearch.toLowerCase();
    return edgeLocations.filter(l => 
      l.city.toLowerCase().includes(search) ||
      l.region.toLowerCase().includes(search) ||
      l.status.toLowerCase().includes(search)
    );
  }, [edgeLocations, edgeLocationSearch]);

  // Calculate metrics
  const totalDistributions = config.totalDistributions || distributions.filter(d => d.status === 'deployed').length;
  const totalEdgeLocations = config.totalEdgeLocations || edgeLocations.filter(l => l.status === 'active').length;
  const totalRequests = config.totalRequests || distributions.reduce((sum, d) => sum + (d.requests || 0), 0);
  const totalBandwidth = config.totalBandwidth || distributions.reduce((sum, d) => sum + (d.bandwidth || 0), 0);
  const averageCacheHitRate = config.averageCacheHitRate !== undefined
    ? config.averageCacheHitRate
    : (distributions.length > 0
      ? distributions.reduce((sum, d) => sum + (d.cacheHitRate || 0), 0) / distributions.length
      : 0);

  const updateConfig = (updates: Partial<CDNConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const handleRefresh = () => {
    updateMetrics();
    toast({
      title: 'Metrics refreshed',
      description: 'CDN metrics have been updated.',
    });
  };

  const openDistributionDialog = (dist?: Distribution) => {
    if (dist) {
      setEditingDistribution(dist);
      setDistributionForm({ ...dist });
    } else {
      setEditingDistribution(null);
      setDistributionForm({
        domain: '',
        origin: '',
        status: 'deploying',
        cachePolicy: 'cache-first',
        defaultTTL: 3600,
        maxTTL: 86400,
        enableCompression: true,
        compressionType: 'gzip',
        enableHTTP2: true,
        enableHTTP3: false,
        enableHTTPS: true,
        enableGeoRouting: false,
        enableDDoSProtection: true,
      });
    }
    setDistributionErrors({});
    setDistributionTouched({});
    setShowDistributionDialog(true);
  };

  // Validate distribution form
  const validateDistribution = (): boolean => {
    const errors: Record<string, string> = {};

    // Domain validation
    if (!distributionForm.domain || distributionForm.domain.trim() === '') {
      errors.domain = 'Domain is required';
    } else {
      const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      if (!domainRegex.test(distributionForm.domain)) {
        errors.domain = 'Invalid domain format (e.g., cdn.example.com)';
      }
    }

    // Origin validation
    if (!distributionForm.origin || distributionForm.origin.trim() === '') {
      errors.origin = 'Origin URL is required';
    } else {
      try {
        const url = new URL(distributionForm.origin);
        if (!url.protocol.startsWith('http')) {
          errors.origin = 'Origin URL must use http:// or https:// protocol';
        }
      } catch {
        errors.origin = 'Invalid URL format (e.g., https://origin.example.com)';
      }
    }

    // TTL validation
    if (distributionForm.defaultTTL !== undefined) {
      if (distributionForm.defaultTTL < 1) {
        errors.defaultTTL = 'Default TTL must be at least 1 second';
      }
    }

    if (distributionForm.maxTTL !== undefined) {
      if (distributionForm.maxTTL < 1) {
        errors.maxTTL = 'Max TTL must be at least 1 second';
      }
      if (distributionForm.defaultTTL !== undefined && distributionForm.maxTTL < distributionForm.defaultTTL) {
        errors.maxTTL = 'Max TTL must be greater than or equal to Default TTL';
      }
    }

    setDistributionErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveDistribution = () => {
    // Mark all fields as touched
    setDistributionTouched({
      domain: true,
      origin: true,
      defaultTTL: true,
      maxTTL: true,
    });

    // Validate
    if (!validateDistribution()) {
      toast({
        title: 'Validation error',
        description: 'Please fix the errors in the form.',
        variant: 'destructive',
      });
      return;
    }

    if (editingDistribution) {
      // Update existing
      const updated = distributions.map(d => 
        d.id === editingDistribution.id 
          ? { ...editingDistribution, ...distributionForm }
          : d
      );
      updateConfig({ distributions: updated });
      toast({
        title: 'Distribution updated',
        description: `Distribution ${distributionForm.domain} has been updated.`,
      });
    } else {
      // Create new
      const newDistribution: Distribution = {
        id: `dist-${Date.now()}`,
        domain: distributionForm.domain,
        origin: distributionForm.origin,
        status: distributionForm.status || 'deploying',
        cachePolicy: distributionForm.cachePolicy || 'cache-first',
        defaultTTL: distributionForm.defaultTTL || 3600,
        maxTTL: distributionForm.maxTTL || 86400,
        enableCompression: distributionForm.enableCompression ?? true,
        compressionType: distributionForm.compressionType || 'gzip',
        enableHTTP2: distributionForm.enableHTTP2 ?? true,
        enableHTTP3: distributionForm.enableHTTP3 ?? false,
        enableHTTPS: distributionForm.enableHTTPS ?? true,
        enableGeoRouting: distributionForm.enableGeoRouting ?? false,
        enableDDoSProtection: distributionForm.enableDDoSProtection ?? true,
        edgeLocations: 0,
        requests: 0,
        cacheHitRate: 0,
        bandwidth: 0,
      };
      updateConfig({ distributions: [...distributions, newDistribution] });
      toast({
        title: 'Distribution created',
        description: `Distribution ${distributionForm.domain} has been created.`,
      });
    }
    setShowDistributionDialog(false);
  };

  const removeDistribution = (id: string) => {
    const dist = distributions.find(d => d.id === id);
    updateConfig({ distributions: distributions.filter((d) => d.id !== id) });
    toast({
      title: 'Distribution deleted',
      description: `Distribution ${dist?.domain || id} has been deleted.`,
    });
  };

  const openEdgeLocationDialog = (loc?: EdgeLocation) => {
    if (loc) {
      setEditingEdgeLocation(loc);
      setEdgeLocationForm({ ...loc });
    } else {
      setEditingEdgeLocation(null);
      setEdgeLocationForm({
        region: '',
        city: '',
        status: 'active',
        capacity: 10000,
        latency: 50,
      });
    }
    setEdgeLocationErrors({});
    setEdgeLocationTouched({});
    setShowEdgeLocationDialog(true);
  };

  // Validate edge location form
  const validateEdgeLocation = (): boolean => {
    const errors: Record<string, string> = {};

    // City validation
    if (!edgeLocationForm.city || edgeLocationForm.city.trim() === '') {
      errors.city = 'City is required';
    }

    // Region validation
    if (!edgeLocationForm.region || edgeLocationForm.region.trim() === '') {
      errors.region = 'Region is required';
    }

    // Capacity validation
    if (edgeLocationForm.capacity !== undefined) {
      if (edgeLocationForm.capacity < 1) {
        errors.capacity = 'Capacity must be at least 1 req/s';
      }
      if (edgeLocationForm.capacity > 1000000) {
        errors.capacity = 'Capacity cannot exceed 1,000,000 req/s';
      }
    }

    // Latency validation
    if (edgeLocationForm.latency !== undefined) {
      if (edgeLocationForm.latency < 1) {
        errors.latency = 'Latency must be at least 1ms';
      }
      if (edgeLocationForm.latency > 10000) {
        errors.latency = 'Latency cannot exceed 10,000ms';
      }
    }

    setEdgeLocationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveEdgeLocation = () => {
    // Mark all fields as touched
    setEdgeLocationTouched({
      city: true,
      region: true,
      capacity: true,
      latency: true,
    });

    // Validate
    if (!validateEdgeLocation()) {
      toast({
        title: 'Validation error',
        description: 'Please fix the errors in the form.',
        variant: 'destructive',
      });
      return;
    }

    if (editingEdgeLocation) {
      // Update existing
      const updated = edgeLocations.map(l => 
        l.id === editingEdgeLocation.id 
          ? { ...editingEdgeLocation, ...edgeLocationForm }
          : l
      );
      updateConfig({ edgeLocations: updated });
      toast({
        title: 'Edge location updated',
        description: `Edge location ${edgeLocationForm.city} has been updated.`,
      });
    } else {
      // Create new
      const newLocation: EdgeLocation = {
        id: `edge-${Date.now()}`,
        region: edgeLocationForm.region,
        city: edgeLocationForm.city,
        status: edgeLocationForm.status || 'active',
        capacity: edgeLocationForm.capacity || 10000,
        latency: edgeLocationForm.latency || 50,
        requests: 0,
        cacheHits: 0,
        bandwidth: 0,
      };
      updateConfig({ edgeLocations: [...edgeLocations, newLocation] });
      toast({
        title: 'Edge location created',
        description: `Edge location ${edgeLocationForm.city} has been created.`,
      });
    }
    setShowEdgeLocationDialog(false);
  };

  const removeEdgeLocation = (id: string) => {
    const loc = edgeLocations.find(l => l.id === id);
    updateConfig({ edgeLocations: edgeLocations.filter((l) => l.id !== id) });
    toast({
      title: 'Edge location deleted',
      description: `Edge location ${loc?.city || id} has been deleted.`,
    });
  };

  const handlePurgeCache = (distributionId: string) => {
    setPurgingDistributionId(distributionId);
    setShowPurgeDialog(true);
  };

  const confirmPurgeCache = () => {
    if (!cdnEngine || !purgingDistributionId) return;

    const purged = cdnEngine.purgeCache(purgingDistributionId);
    toast({
      title: 'Cache purged',
      description: `Purged ${purged} cache entries for distribution.`,
    });
    setShowPurgeDialog(false);
    setPurgingDistributionId(null);
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'deployed':
      case 'active':
        return 'bg-green-500';
      case 'deploying':
        return 'bg-yellow-500';
      case 'failed':
      case 'inactive':
        return 'bg-red-500';
      default:
        return 'bg-muted';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'deployed':
      case 'active':
        return 'bg-green-500 text-white';
      case 'deploying':
        return 'bg-yellow-500 text-white';
      case 'failed':
      case 'inactive':
        return 'bg-red-500 text-white';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">CDN Edge</p>
            <h2 className="text-2xl font-bold text-foreground">Content Delivery Network</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Global content distribution and caching
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Distributions</CardTitle>
                <Globe className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalDistributions}</span>
                <span className="text-xs text-muted-foreground">active</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Edge Locations</CardTitle>
                <MapPin className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalEdgeLocations}</span>
                <span className="text-xs text-muted-foreground">global</span>
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
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {totalRequests >= 1000000 
                    ? `${(totalRequests / 1000000).toFixed(1)}M`
                    : totalRequests >= 1000
                    ? `${(totalRequests / 1000).toFixed(0)}K`
                    : totalRequests.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cache Hit Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{averageCacheHitRate.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="distributions" className="space-y-4">
          <TabsList className="flex flex-wrap gap-2">
            <TabsTrigger value="distributions" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">Distributions</span>
              <Badge variant="secondary" className="ml-1">{distributions.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="edge-locations" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Edge Locations</span>
              <Badge variant="secondary" className="ml-1">{edgeLocations.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="distributions" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>CDN Distributions</CardTitle>
                    <CardDescription>Content distribution configurations</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1 sm:flex-initial sm:w-64">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search distributions..."
                        value={distributionSearch}
                        onChange={(e) => setDistributionSearch(e.target.value)}
                        className="pl-8"
                      />
                      {distributionSearch && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1 h-6 w-6"
                          onClick={() => setDistributionSearch('')}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <Button onClick={() => openDistributionDialog()} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Create
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredDistributions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {distributionSearch ? 'No distributions found' : 'No distributions configured'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredDistributions.map((dist) => (
                      <Card key={dist.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={`p-2 rounded-lg ${getStatusBgColor(dist.status)}/20`}>
                                <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-lg font-semibold truncate">{dist.domain}</CardTitle>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  <Badge variant="outline" className={`${getStatusBadgeColor(dist.status)} border-0`}>
                                    {dist.status}
                                  </Badge>
                                  <Badge variant="outline" className="font-mono text-xs truncate max-w-[200px]">
                                    {dist.origin}
                                  </Badge>
                                  {dist.edgeLocations !== undefined && (
                                    <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300">
                                      {dist.edgeLocations} edges
                                    </Badge>
                                  )}
                                  {dist.cacheHitRate !== undefined && (
                                    <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300">
                                      {dist.cacheHitRate.toFixed(1)}% cache
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => openDistributionDialog(dist)}
                                      className="hover:bg-blue-50 dark:hover:bg-blue-950/20"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit distribution</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              {config.enablePurge !== false && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handlePurgeCache(dist.id)}
                                        className="hover:bg-orange-50 dark:hover:bg-orange-950/20"
                                      >
                                        <Eraser className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Purge cache</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeDistribution(dist.id)}
                                      className="hover:bg-destructive/10 hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete distribution</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                            {dist.requests !== undefined && (
                              <div>
                                <span className="text-muted-foreground">Requests:</span>
                                <span className="ml-2 font-semibold">{dist.requests.toLocaleString()}</span>
                              </div>
                            )}
                            {dist.bandwidth !== undefined && (
                              <div>
                                <span className="text-muted-foreground">Bandwidth:</span>
                                <span className="ml-2 font-semibold">{formatBytes(dist.bandwidth)}</span>
                              </div>
                            )}
                            {dist.cachePolicy && (
                              <div>
                                <span className="text-muted-foreground">Policy:</span>
                                <span className="ml-2 font-semibold capitalize">{dist.cachePolicy.replace('-', ' ')}</span>
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

          <TabsContent value="edge-locations" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Edge Locations</CardTitle>
                    <CardDescription>Global CDN edge servers</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1 sm:flex-initial sm:w-64">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search locations..."
                        value={edgeLocationSearch}
                        onChange={(e) => setEdgeLocationSearch(e.target.value)}
                        className="pl-8"
                      />
                      {edgeLocationSearch && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1 h-6 w-6"
                          onClick={() => setEdgeLocationSearch('')}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <Button onClick={() => openEdgeLocationDialog()} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Create
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredEdgeLocations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {edgeLocationSearch ? 'No edge locations found' : 'No edge locations configured'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredEdgeLocations.map((location) => (
                      <Card key={location.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-card">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={`p-2 rounded-lg ${getStatusBgColor(location.status)}/20`}>
                                <MapPin className="h-5 w-5 text-green-600 dark:text-green-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-lg font-semibold">{location.city}</CardTitle>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  <Badge variant="outline" className={`${getStatusBadgeColor(location.status)} border-0`}>
                                    {location.status}
                                  </Badge>
                                  <Badge variant="outline">{location.region}</Badge>
                                  {location.capacity && (
                                    <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
                                      {location.capacity.toLocaleString()} req/s
                                    </Badge>
                                  )}
                                  {location.latency && (
                                    <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300">
                                      {location.latency}ms
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => openEdgeLocationDialog(location)}
                                      className="hover:bg-green-50 dark:hover:bg-green-950/20"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit edge location</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeEdgeLocation(location.id)}
                                      className="hover:bg-destructive/10 hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete edge location</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                            {location.requests !== undefined && (
                              <div>
                                <span className="text-muted-foreground">Requests:</span>
                                <span className="ml-2 font-semibold">{location.requests.toLocaleString()}</span>
                              </div>
                            )}
                            {location.cacheHits !== undefined && (
                              <div>
                                <span className="text-muted-foreground">Cache Hits:</span>
                                <span className="ml-2 font-semibold">{location.cacheHits.toLocaleString()}</span>
                              </div>
                            )}
                            {location.bandwidth !== undefined && (
                              <div>
                                <span className="text-muted-foreground">Bandwidth:</span>
                                <span className="ml-2 font-semibold">{formatBytes(location.bandwidth)}</span>
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
                <CardTitle>CDN Provider</CardTitle>
                <CardDescription>Select CDN provider</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select 
                    value={config.cdnProvider || 'cloudflare'}
                    onValueChange={(value: 'cloudflare' | 'cloudfront' | 'fastly' | 'akamai') => updateConfig({ cdnProvider: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cloudflare">Cloudflare</SelectItem>
                      <SelectItem value="cloudfront">AWS CloudFront</SelectItem>
                      <SelectItem value="fastly">Fastly</SelectItem>
                      <SelectItem value="akamai">Akamai</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">CDN provider for content delivery</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Caching</CardTitle>
                <CardDescription>Cache configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Caching</Label>
                    <p className="text-xs text-muted-foreground">Enable content caching at edge locations</p>
                  </div>
                  <Switch 
                    checked={config.enableCaching ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableCaching: checked })}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Cache TTL (seconds)</Label>
                  <Input 
                    type="number" 
                    value={config.cacheTTL ?? 3600}
                    onChange={(e) => updateConfig({ cacheTTL: parseInt(e.target.value) || 3600 })}
                    min={1} 
                    max={86400}
                  />
                  <p className="text-xs text-muted-foreground">Default cache time-to-live</p>
                </div>
                <div className="space-y-2">
                  <Label>Default TTL (seconds)</Label>
                  <Input 
                    type="number" 
                    value={config.defaultTTL ?? 3600}
                    onChange={(e) => updateConfig({ defaultTTL: parseInt(e.target.value) || 3600 })}
                    min={1} 
                  />
                  <p className="text-xs text-muted-foreground">Default TTL for distributions</p>
                </div>
                <div className="space-y-2">
                  <Label>Max TTL (seconds)</Label>
                  <Input 
                    type="number" 
                    value={config.maxTTL ?? 86400}
                    onChange={(e) => updateConfig({ maxTTL: parseInt(e.target.value) || 86400 })}
                    min={1} 
                  />
                  <p className="text-xs text-muted-foreground">Maximum TTL for distributions</p>
                </div>
                <div className="space-y-2">
                  <Label>Cache Policy</Label>
                  <Select 
                    value={config.cachePolicy ?? 'cache-first'}
                    onValueChange={(value: 'cache-first' | 'origin-first' | 'bypass') => updateConfig({ cachePolicy: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cache-first">Cache First</SelectItem>
                      <SelectItem value="origin-first">Origin First</SelectItem>
                      <SelectItem value="bypass">Bypass Cache</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Default cache policy for distributions</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compression</CardTitle>
                <CardDescription>Content compression settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Compression</Label>
                    <p className="text-xs text-muted-foreground">Compress content before delivery</p>
                  </div>
                  <Switch 
                    checked={config.enableCompression ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableCompression: checked })}
                  />
                </div>
                {config.enableCompression !== false && (
                  <div className="space-y-2">
                    <Label>Compression Type</Label>
                    <Select 
                      value={config.compressionType || 'gzip'}
                      onValueChange={(value: 'gzip' | 'brotli' | 'zstd') => updateConfig({ compressionType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gzip">Gzip</SelectItem>
                        <SelectItem value="brotli">Brotli</SelectItem>
                        <SelectItem value="zstd">Zstandard</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Compression algorithm</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Protocols</CardTitle>
                <CardDescription>HTTP/HTTPS protocol settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable SSL/TLS</Label>
                    <p className="text-xs text-muted-foreground">Required for HTTP/2 and HTTP/3</p>
                  </div>
                  <Switch 
                    checked={config.enableSSL ?? true}
                    onCheckedChange={(checked) => {
                      updateConfig({ 
                        enableSSL: checked,
                        // If SSL is disabled, disable HTTP/2 and HTTP/3
                        enableHTTP2: checked ? (config.enableHTTP2 ?? true) : false,
                        enableHTTP3: checked ? (config.enableHTTP3 ?? false) : false,
                      });
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable HTTP/2</Label>
                    <p className="text-xs text-muted-foreground">Requires SSL/TLS</p>
                  </div>
                  <Switch 
                    checked={config.enableHTTP2 ?? true}
                    disabled={!config.enableSSL}
                    onCheckedChange={(checked) => {
                      if (config.enableSSL) {
                        updateConfig({ enableHTTP2: checked });
                      }
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable HTTP/3 (QUIC)</Label>
                    <p className="text-xs text-muted-foreground">Requires SSL/TLS, can work alongside HTTP/2</p>
                  </div>
                  <Switch 
                    checked={config.enableHTTP3 ?? false}
                    disabled={!config.enableSSL}
                    onCheckedChange={(checked) => {
                      if (config.enableSSL) {
                        updateConfig({ enableHTTP3: checked });
                      }
                    }}
                  />
                </div>
                {(config.enableHTTP2 && config.enableHTTP3 && config.enableSSL) && (
                  <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <div className="text-xs text-blue-800 dark:text-blue-200">
                        <p className="font-medium mb-1">Multiple protocols enabled</p>
                        <p>Both HTTP/2 and HTTP/3 are enabled. The CDN will support both protocols and automatically select the best one for each client connection.</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Features</CardTitle>
                <CardDescription>Advanced CDN features</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Cache Purge</Label>
                    <p className="text-xs text-muted-foreground">Allow manual cache purging</p>
                  </div>
                  <Switch 
                    checked={config.enablePurge ?? true}
                    onCheckedChange={(checked) => updateConfig({ enablePurge: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Geo Routing</Label>
                    <p className="text-xs text-muted-foreground">Route requests based on geographic location</p>
                  </div>
                  <Switch 
                    checked={config.enableGeoRouting ?? false}
                    onCheckedChange={(checked) => updateConfig({ enableGeoRouting: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable DDoS Protection</Label>
                    <p className="text-xs text-muted-foreground">Protect against DDoS attacks</p>
                  </div>
                  <Switch 
                    checked={config.enableDDoSProtection ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableDDoSProtection: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Metrics Export</CardTitle>
                <CardDescription>Prometheus metrics configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Metrics Export</Label>
                    <p className="text-xs text-muted-foreground">Export CDN metrics for Prometheus scraping</p>
                  </div>
                  <Switch 
                    checked={config.metrics?.enabled ?? true}
                    onCheckedChange={(checked) => updateConfig({ 
                      metrics: { 
                        ...config.metrics, 
                        enabled: checked,
                        port: config.metrics?.port || 9101,
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
                        value={config.metrics?.port ?? 9101}
                        onChange={(e) => updateConfig({ 
                          metrics: { 
                            ...config.metrics, 
                            port: parseInt(e.target.value) || 9101,
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
                            port: config.metrics?.port || 9101
                          } 
                        })}
                        placeholder="/metrics"
                      />
                      <p className="text-xs text-muted-foreground">Path for Prometheus metrics endpoint</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Distribution Dialog */}
      <Dialog open={showDistributionDialog} onOpenChange={setShowDistributionDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDistribution ? 'Edit Distribution' : 'Create Distribution'}</DialogTitle>
            <DialogDescription>
              {editingDistribution ? 'Update distribution configuration' : 'Create a new CDN distribution'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Domain *</Label>
              <Input
                id="domain"
                value={distributionForm.domain}
                onChange={(e) => {
                  setDistributionForm({ ...distributionForm, domain: e.target.value });
                  setDistributionTouched({ ...distributionTouched, domain: true });
                  // Validate on change if touched
                  if (distributionTouched.domain) {
                    const errors: Record<string, string> = { ...distributionErrors };
                    if (!e.target.value || e.target.value.trim() === '') {
                      errors.domain = 'Domain is required';
                    } else {
                      const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
                      if (!domainRegex.test(e.target.value)) {
                        errors.domain = 'Invalid domain format (e.g., cdn.example.com)';
                      } else {
                        delete errors.domain;
                      }
                    }
                    setDistributionErrors(errors);
                  }
                }}
                onBlur={() => {
                  setDistributionTouched({ ...distributionTouched, domain: true });
                  validateDistribution();
                }}
                placeholder="cdn.example.com"
                className={distributionErrors.domain && distributionTouched.domain ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
              {distributionErrors.domain && distributionTouched.domain && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {distributionErrors.domain}
                </p>
              )}
              {!distributionErrors.domain && (
                <p className="text-xs text-muted-foreground">CDN distribution domain name</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="origin">Origin URL *</Label>
              <Input
                id="origin"
                value={distributionForm.origin}
                onChange={(e) => {
                  setDistributionForm({ ...distributionForm, origin: e.target.value });
                  setDistributionTouched({ ...distributionTouched, origin: true });
                  // Validate on change if touched
                  if (distributionTouched.origin) {
                    const errors: Record<string, string> = { ...distributionErrors };
                    if (!e.target.value || e.target.value.trim() === '') {
                      errors.origin = 'Origin URL is required';
                    } else {
                      try {
                        const url = new URL(e.target.value);
                        if (!url.protocol.startsWith('http')) {
                          errors.origin = 'Origin URL must use http:// or https:// protocol';
                        } else {
                          delete errors.origin;
                        }
                      } catch {
                        errors.origin = 'Invalid URL format (e.g., https://origin.example.com)';
                      }
                    }
                    setDistributionErrors(errors);
                  }
                }}
                onBlur={() => {
                  setDistributionTouched({ ...distributionTouched, origin: true });
                  validateDistribution();
                }}
                placeholder="https://origin.example.com"
                className={distributionErrors.origin && distributionTouched.origin ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
              {distributionErrors.origin && distributionTouched.origin && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {distributionErrors.origin}
                </p>
              )}
              {!distributionErrors.origin && (
                <p className="text-xs text-muted-foreground">Origin server URL</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={distributionForm.status}
                onValueChange={(value: 'deployed' | 'deploying' | 'failed') => setDistributionForm({ ...distributionForm, status: value })}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deployed">Deployed</SelectItem>
                  <SelectItem value="deploying">Deploying</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="cachePolicy">Cache Policy</Label>
              <Select
                value={distributionForm.cachePolicy}
                onValueChange={(value: 'cache-first' | 'origin-first' | 'bypass') => setDistributionForm({ ...distributionForm, cachePolicy: value })}
              >
                <SelectTrigger id="cachePolicy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cache-first">Cache First</SelectItem>
                  <SelectItem value="origin-first">Origin First</SelectItem>
                  <SelectItem value="bypass">Bypass Cache</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="defaultTTL">Default TTL (seconds)</Label>
                <Input
                  id="defaultTTL"
                  type="number"
                  value={distributionForm.defaultTTL}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 3600;
                    setDistributionForm({ ...distributionForm, defaultTTL: value });
                    setDistributionTouched({ ...distributionTouched, defaultTTL: true });
                    // Validate on change if touched
                    if (distributionTouched.defaultTTL) {
                      const errors: Record<string, string> = { ...distributionErrors };
                      if (value < 1) {
                        errors.defaultTTL = 'Default TTL must be at least 1 second';
                      } else {
                        delete errors.defaultTTL;
                      }
                      if (distributionForm.maxTTL !== undefined && distributionForm.maxTTL < value) {
                        errors.maxTTL = 'Max TTL must be greater than or equal to Default TTL';
                      } else if (errors.maxTTL === 'Max TTL must be greater than or equal to Default TTL') {
                        delete errors.maxTTL;
                      }
                      setDistributionErrors(errors);
                    }
                  }}
                  onBlur={() => {
                    setDistributionTouched({ ...distributionTouched, defaultTTL: true });
                    validateDistribution();
                  }}
                  min={1}
                  className={distributionErrors.defaultTTL && distributionTouched.defaultTTL ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {distributionErrors.defaultTTL && distributionTouched.defaultTTL && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {distributionErrors.defaultTTL}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxTTL">Max TTL (seconds)</Label>
                <Input
                  id="maxTTL"
                  type="number"
                  value={distributionForm.maxTTL}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 86400;
                    setDistributionForm({ ...distributionForm, maxTTL: value });
                    setDistributionTouched({ ...distributionTouched, maxTTL: true });
                    // Validate on change if touched
                    if (distributionTouched.maxTTL) {
                      const errors: Record<string, string> = { ...distributionErrors };
                      if (value < 1) {
                        errors.maxTTL = 'Max TTL must be at least 1 second';
                      } else if (distributionForm.defaultTTL !== undefined && value < distributionForm.defaultTTL) {
                        errors.maxTTL = 'Max TTL must be greater than or equal to Default TTL';
                      } else {
                        delete errors.maxTTL;
                      }
                      setDistributionErrors(errors);
                    }
                  }}
                  onBlur={() => {
                    setDistributionTouched({ ...distributionTouched, maxTTL: true });
                    validateDistribution();
                  }}
                  min={1}
                  className={distributionErrors.maxTTL && distributionTouched.maxTTL ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {distributionErrors.maxTTL && distributionTouched.maxTTL && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {distributionErrors.maxTTL}
                  </p>
                )}
              </div>
            </div>
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Compression</Label>
                  <p className="text-xs text-muted-foreground">Compress content before delivery</p>
                </div>
                <Switch
                  checked={distributionForm.enableCompression ?? true}
                  onCheckedChange={(checked) => setDistributionForm({ ...distributionForm, enableCompression: checked })}
                />
              </div>
              {distributionForm.enableCompression !== false && (
                <div className="space-y-2">
                  <Label htmlFor="compressionType">Compression Type</Label>
                  <Select
                    value={distributionForm.compressionType}
                    onValueChange={(value: 'gzip' | 'brotli' | 'zstd') => setDistributionForm({ ...distributionForm, compressionType: value })}
                  >
                    <SelectTrigger id="compressionType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gzip">Gzip</SelectItem>
                      <SelectItem value="brotli">Brotli</SelectItem>
                      <SelectItem value="zstd">Zstandard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable HTTPS</Label>
                  <p className="text-xs text-muted-foreground">Required for HTTP/2 and HTTP/3</p>
                </div>
                <Switch
                  checked={distributionForm.enableHTTPS ?? true}
                  onCheckedChange={(checked) => {
                    setDistributionForm({ 
                      ...distributionForm, 
                      enableHTTPS: checked,
                      // If HTTPS is disabled, disable HTTP/2 and HTTP/3
                      enableHTTP2: checked ? (distributionForm.enableHTTP2 ?? true) : false,
                      enableHTTP3: checked ? (distributionForm.enableHTTP3 ?? false) : false,
                    });
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable HTTP/2</Label>
                  <p className="text-xs text-muted-foreground">Requires HTTPS</p>
                </div>
                <Switch
                  checked={distributionForm.enableHTTP2 ?? true}
                  disabled={!distributionForm.enableHTTPS}
                  onCheckedChange={(checked) => {
                    if (distributionForm.enableHTTPS) {
                      setDistributionForm({ ...distributionForm, enableHTTP2: checked });
                    }
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable HTTP/3 (QUIC)</Label>
                  <p className="text-xs text-muted-foreground">Requires HTTPS, can work with HTTP/2</p>
                </div>
                <Switch
                  checked={distributionForm.enableHTTP3 ?? false}
                  disabled={!distributionForm.enableHTTPS}
                  onCheckedChange={(checked) => {
                    if (distributionForm.enableHTTPS) {
                      setDistributionForm({ ...distributionForm, enableHTTP3: checked });
                    }
                  }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Geo Routing</Label>
                  <p className="text-xs text-muted-foreground">Route requests based on geographic location</p>
                </div>
                <Switch
                  checked={distributionForm.enableGeoRouting ?? false}
                  onCheckedChange={(checked) => setDistributionForm({ ...distributionForm, enableGeoRouting: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable DDoS Protection</Label>
                  <p className="text-xs text-muted-foreground">Protect against DDoS attacks</p>
                </div>
                <Switch
                  checked={distributionForm.enableDDoSProtection ?? true}
                  onCheckedChange={(checked) => setDistributionForm({ ...distributionForm, enableDDoSProtection: checked })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDistributionDialog(false)}>Cancel</Button>
            <Button onClick={saveDistribution}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edge Location Dialog */}
      <Dialog open={showEdgeLocationDialog} onOpenChange={setShowEdgeLocationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEdgeLocation ? 'Edit Edge Location' : 'Create Edge Location'}</DialogTitle>
            <DialogDescription>
              {editingEdgeLocation ? 'Update edge location configuration' : 'Create a new edge location'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={edgeLocationForm.city}
                onChange={(e) => {
                  setEdgeLocationForm({ ...edgeLocationForm, city: e.target.value });
                  setEdgeLocationTouched({ ...edgeLocationTouched, city: true });
                  // Validate on change if touched
                  if (edgeLocationTouched.city) {
                    const errors: Record<string, string> = { ...edgeLocationErrors };
                    if (!e.target.value || e.target.value.trim() === '') {
                      errors.city = 'City is required';
                    } else {
                      delete errors.city;
                    }
                    setEdgeLocationErrors(errors);
                  }
                }}
                onBlur={() => {
                  setEdgeLocationTouched({ ...edgeLocationTouched, city: true });
                  validateEdgeLocation();
                }}
                placeholder="New York"
                className={edgeLocationErrors.city && edgeLocationTouched.city ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
              {edgeLocationErrors.city && edgeLocationTouched.city && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {edgeLocationErrors.city}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Region *</Label>
              <Input
                id="region"
                value={edgeLocationForm.region}
                onChange={(e) => {
                  setEdgeLocationForm({ ...edgeLocationForm, region: e.target.value });
                  setEdgeLocationTouched({ ...edgeLocationTouched, region: true });
                  // Validate on change if touched
                  if (edgeLocationTouched.region) {
                    const errors: Record<string, string> = { ...edgeLocationErrors };
                    if (!e.target.value || e.target.value.trim() === '') {
                      errors.region = 'Region is required';
                    } else {
                      delete errors.region;
                    }
                    setEdgeLocationErrors(errors);
                  }
                }}
                onBlur={() => {
                  setEdgeLocationTouched({ ...edgeLocationTouched, region: true });
                  validateEdgeLocation();
                }}
                placeholder="us-east-1"
                className={edgeLocationErrors.region && edgeLocationTouched.region ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
              {edgeLocationErrors.region && edgeLocationTouched.region && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {edgeLocationErrors.region}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edgeStatus">Status</Label>
              <Select
                value={edgeLocationForm.status}
                onValueChange={(value: 'active' | 'inactive') => setEdgeLocationForm({ ...edgeLocationForm, status: value })}
              >
                <SelectTrigger id="edgeStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity (req/s)</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={edgeLocationForm.capacity}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 10000;
                    setEdgeLocationForm({ ...edgeLocationForm, capacity: value });
                    setEdgeLocationTouched({ ...edgeLocationTouched, capacity: true });
                    // Validate on change if touched
                    if (edgeLocationTouched.capacity) {
                      const errors: Record<string, string> = { ...edgeLocationErrors };
                      if (value < 1) {
                        errors.capacity = 'Capacity must be at least 1 req/s';
                      } else if (value > 1000000) {
                        errors.capacity = 'Capacity cannot exceed 1,000,000 req/s';
                      } else {
                        delete errors.capacity;
                      }
                      setEdgeLocationErrors(errors);
                    }
                  }}
                  onBlur={() => {
                    setEdgeLocationTouched({ ...edgeLocationTouched, capacity: true });
                    validateEdgeLocation();
                  }}
                  min={1}
                  className={edgeLocationErrors.capacity && edgeLocationTouched.capacity ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {edgeLocationErrors.capacity && edgeLocationTouched.capacity && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {edgeLocationErrors.capacity}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="latency">Latency (ms)</Label>
                <Input
                  id="latency"
                  type="number"
                  value={edgeLocationForm.latency}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 50;
                    setEdgeLocationForm({ ...edgeLocationForm, latency: value });
                    setEdgeLocationTouched({ ...edgeLocationTouched, latency: true });
                    // Validate on change if touched
                    if (edgeLocationTouched.latency) {
                      const errors: Record<string, string> = { ...edgeLocationErrors };
                      if (value < 1) {
                        errors.latency = 'Latency must be at least 1ms';
                      } else if (value > 10000) {
                        errors.latency = 'Latency cannot exceed 10,000ms';
                      } else {
                        delete errors.latency;
                      }
                      setEdgeLocationErrors(errors);
                    }
                  }}
                  onBlur={() => {
                    setEdgeLocationTouched({ ...edgeLocationTouched, latency: true });
                    validateEdgeLocation();
                  }}
                  min={1}
                  className={edgeLocationErrors.latency && edgeLocationTouched.latency ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {edgeLocationErrors.latency && edgeLocationTouched.latency && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {edgeLocationErrors.latency}
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdgeLocationDialog(false)}>Cancel</Button>
            <Button onClick={saveEdgeLocation}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purge Cache Dialog */}
      <Dialog open={showPurgeDialog} onOpenChange={setShowPurgeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Purge Cache</DialogTitle>
            <DialogDescription>
              This will purge all cached content for this distribution. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPurgeDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmPurgeCache}>Purge Cache</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

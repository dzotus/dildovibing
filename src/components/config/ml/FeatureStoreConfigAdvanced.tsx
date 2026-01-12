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
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  Edit,
  RefreshCcw,
  Package,
  CheckCircle,
  Database,
  Zap,
  TrendingUp,
  Search,
  Filter,
  X,
  AlertCircle,
  BarChart3,
  Server,
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface FeatureStoreConfigProps {
  componentId: string;
}

interface Feature {
  name: string;
  version: string;
  type: 'numerical' | 'categorical' | 'embedding' | 'timestamp';
  description?: string;
  dataType: string;
  defaultValue?: any;
  tags?: string[];
  usage?: number;
}

interface FeatureSet {
  name: string;
  version: string;
  features: string[];
  description?: string;
  createdAt?: string;
  usage?: number;
}

interface FeatureStoreConfig {
  features?: Feature[];
  featureSets?: FeatureSet[];
  totalFeatures?: number;
  totalFeatureSets?: number;
  totalUsage?: number;
  enableVersioning?: boolean;
  enableFeatureValidation?: boolean;
  enableUsageTracking?: boolean;
  storageBackend?: string;
  defaultTTL?: number;
  featureStoreType?: 'feast' | 'tecton' | 'hopsworks';
  enableOnlineServing?: boolean;
  onlineStoreType?: 'redis' | 'dynamodb' | 'cassandra';
  onlineStoreUrl?: string;
  enableOfflineServing?: boolean;
  offlineStoreType?: 'snowflake' | 'bigquery' | 'redshift';
  enableCaching?: boolean;
  cacheSize?: number;
  cacheTtl?: number;
}

export function FeatureStoreConfigAdvanced({ componentId }: FeatureStoreConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { getComponentMetrics } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  // Get Feature Store emulation engine for real-time metrics
  const featureStoreEngine = emulationEngine.getFeatureStoreEmulationEngine(componentId);
  const componentMetrics = getComponentMetrics(componentId);
  const customMetrics = componentMetrics?.customMetrics || {};

  const config = (node.data.config as any) || {} as FeatureStoreConfig;
  
  // Initialize emulation engine on mount and when config changes
  useEffect(() => {
    if (featureStoreEngine && node) {
      featureStoreEngine.initializeConfig(node);
    }
  }, [node.id, JSON.stringify(node.data.config), featureStoreEngine]);
  
  // Get features from emulation engine if available, otherwise from config
  // Priority: emulation engine > config
  const engineFeatures = featureStoreEngine?.getFeatures() || [];
  const configFeatures = config.features || [];
  
  // Use engine features if available and initialized, otherwise fall back to config
  const features = useMemo(() => {
    if (engineFeatures.length > 0) {
      return engineFeatures.map(f => ({
        name: f.name,
        version: f.version,
        type: f.type,
        description: f.description,
        dataType: f.dataType,
        defaultValue: f.defaultValue,
        tags: f.tags || [],
        usage: f.usageCount,
      }));
    }
    return configFeatures;
  }, [engineFeatures, configFeatures]);
  
  const featureSets = config.featureSets || [];
  
  // Get real-time metrics from emulation engine or fallback to config
  const fsMetrics = featureStoreEngine?.getMetrics();
  const totalFeatures = fsMetrics?.totalFeatures ?? config.totalFeatures ?? features.length;
  const totalFeatureSets = fsMetrics?.totalFeatureSets ?? config.totalFeatureSets ?? featureSets.length;
  const totalUsage = fsMetrics?.totalFeatureUsage ?? config.totalUsage ?? features.reduce((sum, f) => sum + (f.usage || 0), 0);
  const requestsPerSecond = fsMetrics?.requestsPerSecond ?? customMetrics.requestsPerSecond ?? 0;
  const averageLatency = fsMetrics?.averageLatency ?? customMetrics.averageLatency ?? 0;
  const errorRate = fsMetrics?.errorRate ?? customMetrics.errorRate ?? 0;
  const cacheHitRate = fsMetrics?.cacheHitRate ?? customMetrics.cacheHitRate ?? 0;
  const onlineStoreUtilization = fsMetrics?.onlineStoreUtilization ?? customMetrics.onlineStoreUtilization ?? 0;
  const offlineStoreUtilization = fsMetrics?.offlineStoreUtilization ?? customMetrics.offlineStoreUtilization ?? 0;
  
  // Get metrics history for charts
  const metricsHistory = featureStoreEngine?.getMetricsHistory() || [];
  
  // Prepare chart data
  const chartData = useMemo(() => {
    if (metricsHistory.length === 0) return [];
    
    return metricsHistory.map((entry) => ({
      time: new Date(entry.timestamp).toLocaleTimeString(),
      timestamp: entry.timestamp,
      latency: entry.latency,
      rps: entry.rps,
      throughput: entry.throughput,
      errorRate: entry.errorRate * 100, // Convert to percentage
      cacheHitRate: entry.cacheHitRate * 100, // Convert to percentage
    }));
  }, [metricsHistory]);

  // State for dialogs and editing
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [featureSetDialogOpen, setFeatureSetDialogOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
  const [editingFeatureSet, setEditingFeatureSet] = useState<FeatureSet | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  // Feature form state
  const [featureForm, setFeatureForm] = useState<Partial<Feature>>({
    name: '',
    version: '1.0',
    type: 'numerical',
    dataType: 'float64',
    tags: [],
    description: '',
  });
  
  // Feature form validation errors
  const [featureFormErrors, setFeatureFormErrors] = useState<Record<string, string>>({});
  
  // Feature Set form state
  const [featureSetForm, setFeatureSetForm] = useState<Partial<FeatureSet>>({
    name: '',
    version: '1.0',
    features: [],
    description: '',
  });
  
  // Feature Set form validation errors
  const [featureSetFormErrors, setFeatureSetFormErrors] = useState<Record<string, string>>({});

  const updateConfig = (updates: Partial<FeatureStoreConfig>) => {
    const newConfig = { ...config, ...updates };
    updateNode(componentId, {
      data: {
        ...node.data,
        config: newConfig,
      },
    });
    
    // Sync with emulation engine
    if (featureStoreEngine) {
      const updatedNode = {
        ...node,
        data: {
          ...node.data,
          config: newConfig,
        },
      };
      featureStoreEngine.initializeConfig(updatedNode);
    }
    
    toast({
      title: 'Configuration updated',
      description: 'Feature Store configuration has been saved.',
    });
  };

  // Filtered features
  const filteredFeatures = useMemo(() => {
    return features.filter((feature) => {
      const matchesSearch = !searchQuery || 
        feature.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feature.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feature.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = typeFilter === 'all' || feature.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [features, searchQuery, typeFilter]);

  // Open feature dialog for editing
  const openFeatureDialog = (feature?: Feature) => {
    if (feature) {
      setEditingFeature(feature);
      setFeatureForm({
        name: feature.name,
        version: feature.version,
        type: feature.type,
        dataType: feature.dataType,
        defaultValue: feature.defaultValue,
        tags: feature.tags || [],
        description: feature.description || '',
      });
    } else {
      setEditingFeature(null);
      setFeatureForm({
        name: '',
        version: '1.0',
        type: 'numerical',
        dataType: 'float64',
        tags: [],
        description: '',
      });
    }
    setFeatureFormErrors({});
    setFeatureDialogOpen(true);
  };

  // Validate feature form
  const validateFeatureForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!featureForm.name || featureForm.name.trim() === '') {
      errors.name = 'Feature name is required';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(featureForm.name)) {
      errors.name = 'Feature name can only contain letters, numbers, underscores, and hyphens';
    }
    
    if (!featureForm.version || featureForm.version.trim() === '') {
      errors.version = 'Version is required';
    } else if (!/^[0-9]+\.[0-9]+(\.[0-9]+)?$/.test(featureForm.version)) {
      errors.version = 'Version must be in format X.Y or X.Y.Z (e.g., 1.0, 1.2.3)';
    }
    
    if (!featureForm.dataType || featureForm.dataType.trim() === '') {
      errors.dataType = 'Data type is required';
    } else {
      // Validate data type compatibility with feature type
      const validDataTypes = ['int', 'int32', 'int64', 'float', 'float32', 'float64', 'double', 'string', 'bool', 'boolean'];
      if (!validDataTypes.includes(featureForm.dataType.toLowerCase())) {
        errors.dataType = `Data type must be one of: ${validDataTypes.join(', ')}`;
      } else {
        // Check type compatibility
        const numericTypes = ['int', 'int32', 'int64', 'float', 'float32', 'float64', 'double'];
        const stringTypes = ['string'];
        const boolTypes = ['bool', 'boolean'];
        
        if (featureForm.type === 'numerical' && !numericTypes.includes(featureForm.dataType.toLowerCase())) {
          errors.dataType = 'Numerical features require numeric data types (int, float, double, etc.)';
        } else if (featureForm.type === 'categorical' && !stringTypes.includes(featureForm.dataType.toLowerCase()) && !numericTypes.includes(featureForm.dataType.toLowerCase())) {
          errors.dataType = 'Categorical features require string or numeric data types';
        } else if (featureForm.type === 'embedding' && !numericTypes.includes(featureForm.dataType.toLowerCase())) {
          errors.dataType = 'Embedding features require numeric data types (float64, float32)';
        } else if (featureForm.type === 'timestamp' && !numericTypes.includes(featureForm.dataType.toLowerCase()) && !stringTypes.includes(featureForm.dataType.toLowerCase())) {
          errors.dataType = 'Timestamp features require numeric (int64) or string data types';
        }
      }
    }
    
    // Check for duplicate name+version
    if (!editingFeature) {
      const exists = features.some(
        f => f.name === featureForm.name && f.version === featureForm.version
      );
      if (exists) {
        errors.name = 'A feature with this name and version already exists';
      }
    } else {
      // When editing, check if name+version conflicts with another feature
      const conflicts = features.some(
        f => f.name === featureForm.name && 
             f.version === featureForm.version &&
             !(f.name === editingFeature.name && f.version === editingFeature.version)
      );
      if (conflicts) {
        errors.name = 'A feature with this name and version already exists';
      }
    }
    
    setFeatureFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save feature
  const saveFeature = () => {
    if (!validateFeatureForm()) {
      toast({
        title: 'Validation error',
        description: 'Please fix the errors in the form.',
        variant: 'destructive',
      });
      return;
    }

    const updatedFeatures = editingFeature
      ? features.map(f => 
          f.name === editingFeature.name && f.version === editingFeature.version
            ? { ...featureForm, usage: f.usage } as Feature
            : f
        )
      : [...features, { ...featureForm, usage: 0 } as Feature];

    updateConfig({ features: updatedFeatures });
    
    // Update emulation engine if available
    if (featureStoreEngine) {
      if (editingFeature) {
        featureStoreEngine.removeFeature(editingFeature.name, editingFeature.version);
      }
      featureStoreEngine.addFeature({
        name: featureForm.name!,
        version: featureForm.version!,
        type: featureForm.type!,
        dataType: featureForm.dataType!,
        defaultValue: featureForm.defaultValue,
        tags: featureForm.tags || [],
        status: 'active',
        description: featureForm.description,
      });
    }

    setFeatureDialogOpen(false);
    toast({
      title: editingFeature ? 'Feature updated' : 'Feature created',
      description: `Feature ${featureForm.name} has been ${editingFeature ? 'updated' : 'created'}.`,
    });
  };

  // Remove feature
  const removeFeature = (name: string, version: string) => {
    updateConfig({ 
      features: features.filter((f) => !(f.name === name && f.version === version)) 
    });
    
    if (featureStoreEngine) {
      featureStoreEngine.removeFeature(name, version);
    }
    
    toast({
      title: 'Feature removed',
      description: `Feature ${name} v${version} has been removed.`,
    });
  };

  // Open feature set dialog
  const openFeatureSetDialog = (featureSet?: FeatureSet) => {
    if (featureSet) {
      setEditingFeatureSet(featureSet);
      setFeatureSetForm({
        name: featureSet.name,
        version: featureSet.version,
        features: featureSet.features || [],
        description: featureSet.description || '',
      });
    } else {
      setEditingFeatureSet(null);
      setFeatureSetForm({
        name: '',
        version: '1.0',
        features: [],
        description: '',
      });
    }
    setFeatureSetFormErrors({});
    setFeatureSetDialogOpen(true);
  };

  // Validate feature set form
  const validateFeatureSetForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!featureSetForm.name || featureSetForm.name.trim() === '') {
      errors.name = 'Feature Set name is required';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(featureSetForm.name)) {
      errors.name = 'Feature Set name can only contain letters, numbers, underscores, and hyphens';
    }
    
    if (!featureSetForm.version || featureSetForm.version.trim() === '') {
      errors.version = 'Version is required';
    } else if (!/^[0-9]+\.[0-9]+(\.[0-9]+)?$/.test(featureSetForm.version)) {
      errors.version = 'Version must be in format X.Y or X.Y.Z (e.g., 1.0, 1.2.3)';
    }
    
    if (!featureSetForm.features || featureSetForm.features.length === 0) {
      errors.features = 'At least one feature is required';
    } else {
      // Validate that all features exist
      const invalidFeatures = featureSetForm.features.filter(
        featName => !features.some(f => f.name === featName)
      );
      if (invalidFeatures.length > 0) {
        errors.features = `Features not found: ${invalidFeatures.join(', ')}`;
      }
    }
    
    // Check for duplicate name+version
    if (!editingFeatureSet) {
      const exists = featureSets.some(
        fs => fs.name === featureSetForm.name && fs.version === featureSetForm.version
      );
      if (exists) {
        errors.name = 'A feature set with this name and version already exists';
      }
    } else {
      // When editing, check if name+version conflicts with another feature set
      const conflicts = featureSets.some(
        fs => fs.name === featureSetForm.name && 
             fs.version === featureSetForm.version &&
             !(fs.name === editingFeatureSet.name && fs.version === editingFeatureSet.version)
      );
      if (conflicts) {
        errors.name = 'A feature set with this name and version already exists';
      }
    }
    
    setFeatureSetFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save feature set
  const saveFeatureSet = () => {
    if (!validateFeatureSetForm()) {
      toast({
        title: 'Validation error',
        description: 'Please fix the errors in the form.',
        variant: 'destructive',
      });
      return;
    }

    const updatedFeatureSets = editingFeatureSet
      ? featureSets.map(fs => 
          fs.name === editingFeatureSet.name && fs.version === editingFeatureSet.version
            ? { ...featureSetForm, usage: fs.usage, createdAt: fs.createdAt } as FeatureSet
            : fs
        )
      : [...featureSets, { 
          ...featureSetForm, 
          usage: 0, 
          createdAt: new Date().toISOString() 
        } as FeatureSet];

    updateConfig({ featureSets: updatedFeatureSets });
    
    // Update emulation engine if available
    if (featureStoreEngine) {
      if (editingFeatureSet) {
        featureStoreEngine.removeFeatureSet(editingFeatureSet.name, editingFeatureSet.version);
      }
      featureStoreEngine.addFeatureSet({
        name: featureSetForm.name!,
        version: featureSetForm.version!,
        features: featureSetForm.features || [],
        description: featureSetForm.description,
      });
    }

    setFeatureSetDialogOpen(false);
    toast({
      title: editingFeatureSet ? 'Feature Set updated' : 'Feature Set created',
      description: `Feature Set ${featureSetForm.name} has been ${editingFeatureSet ? 'updated' : 'created'}.`,
    });
  };

  // Remove feature set
  const removeFeatureSet = (name: string, version: string) => {
    updateConfig({ 
      featureSets: featureSets.filter((fs) => !(fs.name === name && fs.version === version)) 
    });
    
    if (featureStoreEngine) {
      featureStoreEngine.removeFeatureSet(name, version);
    }
    
    toast({
      title: 'Feature Set removed',
      description: `Feature Set ${name} v${version} has been removed.`,
    });
  };

  // Handle refresh
  const handleRefresh = () => {
    if (featureStoreEngine) {
      featureStoreEngine.initializeConfig(node);
    }
    toast({
      title: 'Refreshed',
      description: 'Feature Store data has been refreshed.',
    });
  };

  // Update settings
  const updateSetting = (key: keyof FeatureStoreConfig, value: any) => {
    updateConfig({ [key]: value });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Feature Store</p>
            <h2 className="text-2xl font-bold text-foreground">Feature Management</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Centralized repository for machine learning features
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

        <div className="grid grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Features</CardTitle>
                <Package className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalFeatures}</span>
                <span className="text-xs text-muted-foreground">registered</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Feature Sets</CardTitle>
                <Database className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalFeatureSets}</span>
                <span className="text-xs text-muted-foreground">defined</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Usage</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{totalUsage.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">requests</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="features" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="features">
              <Package className="h-4 w-4 mr-2" />
              Features ({features.length})
            </TabsTrigger>
            <TabsTrigger value="feature-sets">
              <Database className="h-4 w-4 mr-2" />
              Feature Sets ({featureSets.length})
            </TabsTrigger>
            <TabsTrigger value="serving">
              <Server className="h-4 w-4 mr-2" />
              Serving
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="features" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Features</CardTitle>
                    <CardDescription>Registered features in the store</CardDescription>
                  </div>
                  <Button onClick={() => openFeatureDialog()} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Feature
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search features..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="numerical">Numerical</SelectItem>
                      <SelectItem value="categorical">Categorical</SelectItem>
                      <SelectItem value="embedding">Embedding</SelectItem>
                      <SelectItem value="timestamp">Timestamp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-4">
                  {filteredFeatures.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchQuery || typeFilter !== 'all' ? 'No features match your filters' : 'No features registered yet'}
                    </div>
                  ) : (
                    filteredFeatures.map((feature) => {
                      const engineFeature = featureStoreEngine?.getFeature(feature.name, feature.version);
                      const usage = engineFeature?.usageCount ?? feature.usage ?? 0;
                      
                      return (
                        <Card key={`${feature.name}-${feature.version}`} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                  <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                  <CardTitle className="text-lg font-semibold">{feature.name}</CardTitle>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="outline">v{feature.version}</Badge>
                                    <Badge variant="outline">{feature.type}</Badge>
                                    <Badge variant="outline">{feature.dataType}</Badge>
                                    {usage > 0 && (
                                      <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300">
                                        {usage} uses
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openFeatureDialog(feature)}
                                  className="hover:bg-blue-50 dark:hover:bg-blue-950/20"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeFeature(feature.name, feature.version)}
                                  className="hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {feature.description && (
                              <p className="text-sm text-muted-foreground mb-2">{feature.description}</p>
                            )}
                            {feature.defaultValue !== undefined && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Default:</span>
                                <span className="ml-2 font-mono">{String(feature.defaultValue)}</span>
                              </div>
                            )}
                            {feature.tags && feature.tags.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {feature.tags.map((tag, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">{tag}</Badge>
                                ))}
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

          <TabsContent value="feature-sets" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Feature Sets</CardTitle>
                    <CardDescription>Grouped collections of features</CardDescription>
                  </div>
                  <Button onClick={() => openFeatureSetDialog()} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Feature Set
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {featureSets.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No feature sets defined yet
                    </div>
                  ) : (
                    featureSets.map((set) => {
                      const engineSet = featureStoreEngine?.getFeatureSets().find(
                        fs => fs.name === set.name && fs.version === set.version
                      );
                      const usage = engineSet?.usageCount ?? set.usage ?? 0;
                      
                      return (
                        <Card key={`${set.name}-${set.version}`} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-card">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                                  <Database className="h-5 w-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                  <CardTitle className="text-lg font-semibold">{set.name}</CardTitle>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="outline">v{set.version}</Badge>
                                    <Badge variant="outline">{set.features.length} features</Badge>
                                    {usage > 0 && (
                                      <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
                                        {usage} uses
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openFeatureSetDialog(set)}
                                  className="hover:bg-green-50 dark:hover:bg-green-950/20"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeFeatureSet(set.name, set.version)}
                                  className="hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {set.description && (
                              <p className="text-sm text-muted-foreground mb-2">{set.description}</p>
                            )}
                            <div className="space-y-1">
                              <Label className="text-xs">Features:</Label>
                              <div className="flex flex-wrap gap-2">
                                {set.features.length === 0 ? (
                                  <span className="text-xs text-muted-foreground">No features</span>
                                ) : (
                                  set.features.map((featName, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">{featName}</Badge>
                                  ))
                                )}
                              </div>
                            </div>
                            {set.createdAt && (
                              <div className="text-xs text-muted-foreground mt-2">
                                Created: {new Date(set.createdAt).toLocaleString()}
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

          <TabsContent value="serving" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Online Serving
                  </CardTitle>
                  <CardDescription>Low-latency feature serving</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Status</Label>
                    <Badge variant={config.enableOnlineServing !== false ? "default" : "secondary"}>
                      {config.enableOnlineServing !== false ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Label>Store Type</Label>
                    <Select 
                      value={config.onlineStoreType || 'redis'} 
                      onValueChange={(value) => updateSetting('onlineStoreType', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="redis">Redis</SelectItem>
                        <SelectItem value="dynamodb">DynamoDB</SelectItem>
                        <SelectItem value="cassandra">Cassandra</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Store URL</Label>
                    <Input 
                      value={config.onlineStoreUrl || 'redis://localhost:6379'} 
                      onChange={(e) => updateSetting('onlineStoreUrl', e.target.value)}
                      placeholder="redis://localhost:6379"
                    />
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-sm text-muted-foreground">Utilization</div>
                    <div className="text-2xl font-bold">{Math.round(onlineStoreUtilization * 100)}%</div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-blue-500" />
                    Offline Serving
                  </CardTitle>
                  <CardDescription>Batch feature serving</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Status</Label>
                    <Badge variant={config.enableOfflineServing !== false ? "default" : "secondary"}>
                      {config.enableOfflineServing !== false ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Label>Store Type</Label>
                    <Select 
                      value={config.offlineStoreType || 'snowflake'} 
                      onValueChange={(value) => updateSetting('offlineStoreType', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="snowflake">Snowflake</SelectItem>
                        <SelectItem value="bigquery">BigQuery</SelectItem>
                        <SelectItem value="redshift">Redshift</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-sm text-muted-foreground">Utilization</div>
                    <div className="text-2xl font-bold">{Math.round(offlineStoreUtilization * 100)}%</div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Real-time serving performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div>
                    <div className="text-sm text-muted-foreground">Requests/sec</div>
                    <div className="text-2xl font-bold">{requestsPerSecond.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Avg Latency</div>
                    <div className="text-2xl font-bold">{averageLatency.toFixed(1)}ms</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Cache Hit Rate</div>
                    <div className="text-2xl font-bold">{Math.round(cacheHitRate * 100)}%</div>
                  </div>
                </div>
                
                {chartData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No metrics data available yet. Metrics will appear as requests are processed.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Latency Chart */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Latency Over Time</Label>
                        <Badge variant="outline">{averageLatency.toFixed(0)}ms avg</Badge>
                      </div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" />
                            <YAxis label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Legend />
                            <Area 
                              type="monotone" 
                              dataKey="latency" 
                              stroke="#8884d8" 
                              fill="#8884d8" 
                              fillOpacity={0.3}
                              name="Latency (ms)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Throughput Chart */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Throughput Over Time</Label>
                        <Badge variant="outline">{requestsPerSecond.toFixed(1)} req/s</Badge>
                      </div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" />
                            <YAxis label={{ value: 'Requests/sec', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Legend />
                            <Line 
                              type="monotone" 
                              dataKey="rps" 
                              stroke="#82ca9d" 
                              strokeWidth={2}
                              name="Requests/sec"
                            />
                            <Line 
                              type="monotone" 
                              dataKey="throughput" 
                              stroke="#ffc658" 
                              strokeWidth={2}
                              name="Throughput"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Error Rate and Cache Hit Rate Chart */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Error Rate & Cache Hit Rate</Label>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300">
                            {Math.round(errorRate * 100)}% errors
                          </Badge>
                          <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300">
                            {Math.round(cacheHitRate * 100)}% cache hits
                          </Badge>
                        </div>
                      </div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" />
                            <YAxis label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Legend />
                            <Area 
                              type="monotone" 
                              dataKey="errorRate" 
                              stroke="#ff7300" 
                              fill="#ff7300" 
                              fillOpacity={0.3}
                              name="Error Rate (%)"
                            />
                            <Area 
                              type="monotone" 
                              dataKey="cacheHitRate" 
                              stroke="#00ff00" 
                              fill="#00ff00" 
                              fillOpacity={0.3}
                              name="Cache Hit Rate (%)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Feature Store Settings</CardTitle>
                <CardDescription>Store configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Versioning</Label>
                    <div className="text-xs text-muted-foreground">Track feature versions</div>
                  </div>
                  <Switch 
                    checked={config.enableVersioning !== false} 
                    onCheckedChange={(checked) => updateSetting('enableVersioning', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Feature Validation</Label>
                    <div className="text-xs text-muted-foreground">Validate feature values</div>
                  </div>
                  <Switch 
                    checked={config.enableFeatureValidation !== false} 
                    onCheckedChange={(checked) => updateSetting('enableFeatureValidation', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Usage Tracking</Label>
                    <div className="text-xs text-muted-foreground">Track feature usage statistics</div>
                  </div>
                  <Switch 
                    checked={config.enableUsageTracking !== false} 
                    onCheckedChange={(checked) => updateSetting('enableUsageTracking', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Caching</Label>
                    <div className="text-xs text-muted-foreground">Cache feature values for faster access</div>
                  </div>
                  <Switch 
                    checked={config.enableCaching !== false} 
                    onCheckedChange={(checked) => updateSetting('enableCaching', checked)}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Feature Store Type</Label>
                  <Select 
                    value={config.featureStoreType || 'feast'} 
                    onValueChange={(value) => updateSetting('featureStoreType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feast">Feast</SelectItem>
                      <SelectItem value="tecton">Tecton</SelectItem>
                      <SelectItem value="hopsworks">Hopsworks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Default Feature TTL (days)</Label>
                  <Input 
                    type="number" 
                    value={config.defaultTTL || 30} 
                    onChange={(e) => updateSetting('defaultTTL', parseInt(e.target.value) || 30)}
                    min={1}
                    max={365}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cache Size (MB)</Label>
                  <Input 
                    type="number" 
                    value={config.cacheSize || 100} 
                    onChange={(e) => updateSetting('cacheSize', parseInt(e.target.value) || 100)}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cache TTL (seconds)</Label>
                  <Input 
                    type="number" 
                    value={config.cacheTtl || 3600} 
                    onChange={(e) => updateSetting('cacheTtl', parseInt(e.target.value) || 3600)}
                    min={1}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Feature Dialog */}
        <Dialog open={featureDialogOpen} onOpenChange={setFeatureDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingFeature ? 'Edit Feature' : 'Create Feature'}</DialogTitle>
              <DialogDescription>
                {editingFeature ? 'Update feature configuration' : 'Add a new feature to the store'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Feature Name *</Label>
                  <Input
                    value={featureForm.name}
                    onChange={(e) => setFeatureForm({ ...featureForm, name: e.target.value })}
                    placeholder="user-age"
                    disabled={!!editingFeature}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Version *</Label>
                  <Input
                    value={featureForm.version}
                    onChange={(e) => setFeatureForm({ ...featureForm, version: e.target.value })}
                    placeholder="1.0"
                    disabled={!!editingFeature}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type *</Label>
                  <Select 
                    value={featureForm.type} 
                    onValueChange={(value: any) => {
                      // Reset dataType when type changes to ensure compatibility
                      let defaultDataType = 'float64';
                      if (value === 'categorical') defaultDataType = 'string';
                      else if (value === 'embedding') defaultDataType = 'float64';
                      else if (value === 'timestamp') defaultDataType = 'int64';
                      setFeatureForm({ ...featureForm, type: value, dataType: defaultDataType });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="numerical">Numerical</SelectItem>
                      <SelectItem value="categorical">Categorical</SelectItem>
                      <SelectItem value="embedding">Embedding</SelectItem>
                      <SelectItem value="timestamp">Timestamp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data Type *</Label>
                  <Select
                    value={featureForm.dataType}
                    onValueChange={(value) => setFeatureForm({ ...featureForm, dataType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select data type" />
                    </SelectTrigger>
                    <SelectContent>
                      {featureForm.type === 'numerical' && (
                        <>
                          <SelectItem value="float64">float64</SelectItem>
                          <SelectItem value="float32">float32</SelectItem>
                          <SelectItem value="double">double</SelectItem>
                          <SelectItem value="int64">int64</SelectItem>
                          <SelectItem value="int32">int32</SelectItem>
                          <SelectItem value="int">int</SelectItem>
                        </>
                      )}
                      {featureForm.type === 'categorical' && (
                        <>
                          <SelectItem value="string">string</SelectItem>
                          <SelectItem value="int64">int64 (label encoding)</SelectItem>
                        </>
                      )}
                      {featureForm.type === 'embedding' && (
                        <>
                          <SelectItem value="float64">float64 (array)</SelectItem>
                          <SelectItem value="float32">float32 (array)</SelectItem>
                        </>
                      )}
                      {featureForm.type === 'timestamp' && (
                        <>
                          <SelectItem value="int64">int64 (Unix timestamp)</SelectItem>
                          <SelectItem value="string">string (ISO 8601)</SelectItem>
                        </>
                      )}
                      {!featureForm.type && (
                        <>
                          <SelectItem value="float64">float64</SelectItem>
                          <SelectItem value="float32">float32</SelectItem>
                          <SelectItem value="int64">int64</SelectItem>
                          <SelectItem value="int32">int32</SelectItem>
                          <SelectItem value="int">int</SelectItem>
                          <SelectItem value="string">string</SelectItem>
                          <SelectItem value="bool">bool</SelectItem>
                          <SelectItem value="boolean">boolean</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {featureForm.type === 'numerical' && 'Numeric data types for continuous values'}
                    {featureForm.type === 'categorical' && 'String for categories or int64 for label encoding'}
                    {featureForm.type === 'embedding' && 'Floating point arrays for vector representations'}
                    {featureForm.type === 'timestamp' && 'Numeric or string format for time values'}
                    {!featureForm.type && 'Select feature type first'}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={featureForm.description || ''}
                  onChange={(e) => setFeatureForm({ ...featureForm, description: e.target.value })}
                  placeholder="Feature description..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Default Value</Label>
                <Input
                  value={featureForm.defaultValue !== undefined ? String(featureForm.defaultValue) : ''}
                  onChange={(e) => setFeatureForm({ ...featureForm, defaultValue: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={featureForm.tags?.join(', ') || ''}
                  onChange={(e) => setFeatureForm({ 
                    ...featureForm, 
                    tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) 
                  })}
                  placeholder="ml, production, user"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFeatureDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveFeature}>
                {editingFeature ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Feature Set Dialog */}
        <Dialog open={featureSetDialogOpen} onOpenChange={setFeatureSetDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingFeatureSet ? 'Edit Feature Set' : 'Create Feature Set'}</DialogTitle>
              <DialogDescription>
                {editingFeatureSet ? 'Update feature set configuration' : 'Create a new feature set'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Feature Set Name *</Label>
                  <Input
                    value={featureSetForm.name}
                    onChange={(e) => {
                      setFeatureSetForm({ ...featureSetForm, name: e.target.value });
                      if (featureSetFormErrors.name) {
                        setFeatureSetFormErrors({ ...featureSetFormErrors, name: '' });
                      }
                    }}
                    placeholder="user-features"
                    disabled={!!editingFeatureSet}
                    className={featureSetFormErrors.name ? 'border-destructive' : ''}
                  />
                  {featureSetFormErrors.name && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {featureSetFormErrors.name}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Version *</Label>
                  <Input
                    value={featureSetForm.version}
                    onChange={(e) => {
                      setFeatureSetForm({ ...featureSetForm, version: e.target.value });
                      if (featureSetFormErrors.version) {
                        setFeatureSetFormErrors({ ...featureSetFormErrors, version: '' });
                      }
                    }}
                    placeholder="1.0"
                    disabled={!!editingFeatureSet}
                    className={featureSetFormErrors.version ? 'border-destructive' : ''}
                  />
                  {featureSetFormErrors.version && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {featureSetFormErrors.version}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={featureSetForm.description || ''}
                  onChange={(e) => setFeatureSetForm({ ...featureSetForm, description: e.target.value })}
                  placeholder="Feature set description..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Features (comma-separated feature names) *</Label>
                <Input
                  value={featureSetForm.features?.join(', ') || ''}
                  onChange={(e) => {
                    setFeatureSetForm({ 
                      ...featureSetForm, 
                      features: e.target.value.split(',').map(f => f.trim()).filter(f => f) 
                    });
                    if (featureSetFormErrors.features) {
                      setFeatureSetFormErrors({ ...featureSetFormErrors, features: '' });
                    }
                  }}
                  placeholder="user-age, user-score, user-category"
                  className={featureSetFormErrors.features ? 'border-destructive' : ''}
                />
                {featureSetFormErrors.features && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {featureSetFormErrors.features}
                  </p>
                )}
                <div className="text-xs text-muted-foreground">
                  Available features: {features.map(f => f.name).join(', ') || 'None'}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFeatureSetDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveFeatureSet}>
                {editingFeatureSet ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

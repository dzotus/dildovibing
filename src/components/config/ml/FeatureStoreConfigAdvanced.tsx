import { useCanvasStore } from '@/store/useCanvasStore';
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
import { useState } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Package,
  CheckCircle,
  Database,
  Zap,
  TrendingUp,
  Users
} from 'lucide-react';

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
}

export function FeatureStoreConfigAdvanced({ componentId }: FeatureStoreConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as FeatureStoreConfig;
  const features = config.features || [];
  const featureSets = config.featureSets || [];
  const totalFeatures = config.totalFeatures || features.length;
  const totalFeatureSets = config.totalFeatureSets || featureSets.length;
  const totalUsage = config.totalUsage || features.reduce((sum, f) => sum + (f.usage || 0), 0);

  const [showCreateFeature, setShowCreateFeature] = useState(false);

  const updateConfig = (updates: Partial<FeatureStoreConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addFeature = () => {
    const newFeature: Feature = {
      name: 'new-feature',
      version: '1.0',
      type: 'numerical',
      dataType: 'float64',
      tags: [],
    };
    updateConfig({ features: [...features, newFeature] });
    setShowCreateFeature(false);
  };

  const removeFeature = (name: string, version: string) => {
    updateConfig({ features: features.filter((f) => !(f.name === name && f.version === version)) });
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
            <Button variant="outline" size="sm">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
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
          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
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
          <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
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
          <TabsList>
            <TabsTrigger value="features">
              <Package className="h-4 w-4 mr-2" />
              Features ({features.length})
            </TabsTrigger>
            <TabsTrigger value="feature-sets">
              <Database className="h-4 w-4 mr-2" />
              Feature Sets ({featureSets.length})
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
                  <Button onClick={addFeature} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Feature
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {features.map((feature) => (
                    <Card key={`${feature.name}-${feature.version}`} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10">
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
                                {feature.usage && (
                                  <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20">
                                    {feature.usage} uses
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFeature(feature.name, feature.version)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="feature-sets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Feature Sets</CardTitle>
                <CardDescription>Grouped collections of features</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {featureSets.map((set) => (
                    <Card key={`${set.name}-${set.version}`} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                            <Database className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <CardTitle className="text-lg font-semibold">{set.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline">v{set.version}</Badge>
                              <Badge variant="outline">{set.features.length} features</Badge>
                              {set.usage && (
                                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20">
                                  {set.usage} uses
                                </Badge>
                              )}
                            </div>
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
                            {set.features.map((featName, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">{featName}</Badge>
                            ))}
                          </div>
                        </div>
                        {set.createdAt && (
                          <div className="text-xs text-muted-foreground mt-2">
                            Created: {new Date(set.createdAt).toLocaleString()}
                          </div>
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
                <CardTitle>Feature Store Settings</CardTitle>
                <CardDescription>Store configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Versioning</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Feature Validation</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Usage Tracking</Label>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Storage Backend</Label>
                  <Select defaultValue="redis">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="redis">Redis</SelectItem>
                      <SelectItem value="postgres">PostgreSQL</SelectItem>
                      <SelectItem value="mongodb">MongoDB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Default Feature TTL (hours)</Label>
                  <Input type="number" defaultValue={24} min={1} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


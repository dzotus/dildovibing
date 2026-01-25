import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { CanvasNode } from '@/types';
import { emulationEngine } from '@/core/EmulationEngine';
import { useMemo } from 'react';
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
import { useState } from 'react';
import { 
  Database, 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Cloud,
  Archive,
  Shield,
  Key,
  FileText,
  Folder
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface S3DataLakeConfigProps {
  componentId: string;
}

interface S3Bucket {
  name: string;
  region: string;
  versioning?: boolean;
  encryption?: 'AES256' | 'aws:kms';
  lifecycleEnabled?: boolean;
  lifecycleDays?: number;
  glacierEnabled?: boolean;
  glacierDays?: number;
  publicAccess?: boolean;
  objectCount?: number;
  totalSize?: number;
  folders?: S3Folder[];
}

interface S3Folder {
  name: string;
  path: string;
  objectCount?: number;
  size?: number;
}

interface S3Object {
  key: string;
  size: number;
  lastModified: string;
  storageClass?: 'STANDARD' | 'STANDARD_IA' | 'GLACIER' | 'DEEP_ARCHIVE';
  etag?: string;
}

interface LifecycleRule {
  id: string;
  name: string;
  prefix?: string;
  status: 'Enabled' | 'Disabled';
  transitions?: Array<{
    days: number;
    storageClass: string;
  }>;
  expiration?: {
    days: number;
  };
}

interface S3DataLakeConfig {
  buckets?: S3Bucket[];
  accessKeyId?: string;
  secretAccessKey?: string;
  defaultRegion?: string;
  lifecycleRules?: LifecycleRule[];
}

export function S3DataLakeConfigAdvanced({ componentId }: S3DataLakeConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as S3DataLakeConfig;
  const buckets = config.buckets || [];
  const accessKeyId = config.accessKeyId || '';
  const secretAccessKey = config.secretAccessKey || '';
  const defaultRegion = config.defaultRegion || 'us-east-1';
  const lifecycleRules = config.lifecycleRules || [];

  const [editingBucketIndex, setEditingBucketIndex] = useState<number | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<number | null>(null);
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  
  const { isRunning, getComponentMetrics } = useEmulationStore();

  // Get S3 Emulation Engine for real-time metrics
  const s3Engine = useMemo(() => {
    if (isRunning) {
      return emulationEngine.getS3EmulationEngine(componentId);
    }
    return undefined;
  }, [componentId, isRunning]);

  const componentMetrics = getComponentMetrics(componentId);
  const customMetrics = componentMetrics?.customMetrics || {};

  // Get real-time metrics from emulation engine or fallback to config
  const s3Metrics = s3Engine?.getMetrics();
  const totalBuckets = s3Metrics?.totalBuckets ?? buckets.length;
  const totalObjects = s3Metrics?.totalObjects ?? buckets.reduce((sum, b) => sum + (b.objectCount || 0), 0);
  const totalSize = s3Metrics?.totalSize ?? buckets.reduce((sum, b) => sum + (b.totalSize || 0), 0);
  const throughput = s3Metrics?.throughput ?? customMetrics.estimated_ops_per_sec ?? 0;
  const storageUtilization = s3Metrics?.storageUtilization ?? (customMetrics.storage_utilization ? customMetrics.storage_utilization / 100 : 0);
  const operationsUtilization = s3Metrics?.operationsUtilization ?? (customMetrics.ops_utilization ? customMetrics.ops_utilization / 100 : 0);
  const glacierObjects = s3Metrics?.glacierObjects ?? customMetrics.glacier_objects ?? 0;
  const lifecycleTransitions = s3Metrics?.lifecycleTransitions ?? customMetrics.lifecycle_transitions ?? 0;
  
  const handleRefresh = () => {
    // Force re-render by updating timestamp in config
    updateNode(componentId, {
      data: {
        ...node.data,
        config: {
          ...config,
          _lastRefresh: Date.now(),
        },
      },
    });
  };

  const updateConfig = (updates: Partial<S3DataLakeConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addBucket = () => {
    const newBucket: S3Bucket = {
      name: 'new-bucket',
      region: defaultRegion,
      versioning: false,
      encryption: 'AES256',
      lifecycleEnabled: false,
      publicAccess: false,
      objectCount: 0,
      totalSize: 0,
      folders: [],
    };
    updateConfig({ buckets: [...buckets, newBucket] });
  };

  const removeBucket = (index: number) => {
    updateConfig({ buckets: buckets.filter((_, i) => i !== index) });
  };

  const updateBucket = (index: number, field: string, value: any) => {
    const newBuckets = [...buckets];
    newBuckets[index] = { ...newBuckets[index], [field]: value };
    updateConfig({ buckets: newBuckets });
  };

  const addLifecycleRule = () => {
    const newRule: LifecycleRule = {
      id: `rule-${Date.now()}`,
      name: 'New Lifecycle Rule',
      status: 'Enabled',
      transitions: [],
    };
    updateConfig({ lifecycleRules: [...lifecycleRules, newRule] });
    setEditingRuleId(newRule.id);
  };

  const removeLifecycleRule = (id: string) => {
    updateConfig({ lifecycleRules: lifecycleRules.filter((r) => r.id !== id) });
    if (editingRuleId === id) {
      setEditingRuleId(null);
    }
  };

  const updateLifecycleRule = (id: string, updates: Partial<LifecycleRule>) => {
    const updatedRules = lifecycleRules.map(rule => 
      rule.id === id ? { ...rule, ...updates } : rule
    );
    updateConfig({ lifecycleRules: updatedRules });
  };

  const addTransitionToRule = (ruleId: string) => {
    const rule = lifecycleRules.find(r => r.id === ruleId);
    if (!rule) return;
    
    const newTransition = {
      days: 30,
      storageClass: 'STANDARD_IA',
    };
    updateLifecycleRule(ruleId, {
      transitions: [...(rule.transitions || []), newTransition],
    });
  };

  const removeTransitionFromRule = (ruleId: string, transitionIndex: number) => {
    const rule = lifecycleRules.find(r => r.id === ruleId);
    if (!rule || !rule.transitions) return;
    
    const updatedTransitions = rule.transitions.filter((_, idx) => idx !== transitionIndex);
    updateLifecycleRule(ruleId, { transitions: updatedTransitions });
  };

  const updateTransitionInRule = (ruleId: string, transitionIndex: number, updates: Partial<{ days: number; storageClass: string }>) => {
    const rule = lifecycleRules.find(r => r.id === ruleId);
    if (!rule || !rule.transitions) return;
    
    const updatedTransitions = rule.transitions.map((transition, idx) =>
      idx === transitionIndex ? { ...transition, ...updates } : transition
    );
    updateLifecycleRule(ruleId, { transitions: updatedTransitions });
  };


  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Amazon S3 Data Lake</p>
            <h2 className="text-2xl font-bold text-foreground">Object Storage</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure S3 buckets, lifecycle policies and data lake storage
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefresh}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Objects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalObjects.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across {totalBuckets} {totalBuckets === 1 ? 'bucket' : 'buckets'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatBytes(totalSize)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round(storageUtilization * 100)}% utilized
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Throughput</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(throughput)} ops/s
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round(operationsUtilization * 100)}% capacity
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Archived Objects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{glacierObjects.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                In Glacier/Deep Archive
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="buckets" className="space-y-4">
          <TabsList>
            <TabsTrigger value="buckets">
              <Archive className="h-4 w-4 mr-2" />
              Buckets ({buckets.length})
            </TabsTrigger>
            <TabsTrigger value="lifecycle">
              <Activity className="h-4 w-4 mr-2" />
              Lifecycle Rules ({lifecycleRules.length})
            </TabsTrigger>
            <TabsTrigger value="credentials">
              <Key className="h-4 w-4 mr-2" />
              Credentials
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buckets" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>S3 Buckets</CardTitle>
                    <CardDescription>Configure and manage S3 buckets for data lake storage</CardDescription>
                  </div>
                  <Button onClick={addBucket} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Bucket
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {buckets.map((bucket, index) => (
                    <Card key={index} className="border-l-4 border-l-orange-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Archive className="h-5 w-5 text-orange-500" />
                            <div>
                              <CardTitle className="text-base">{bucket.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline">{bucket.region}</Badge>
                                {bucket.versioning && <Badge variant="default">Versioning</Badge>}
                                {bucket.publicAccess && <Badge variant="destructive">Public</Badge>}
                                <Badge variant="outline">
                                  {bucket.objectCount || 0} objects
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeBucket(index)}
                            disabled={buckets.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {(() => {
                          // Для каждого бакета
                          const bucketMetrics = s3Metrics?.bucketMetrics.get(bucket.name);
                          const bucketObjectCount = bucketMetrics?.objectCount ?? bucket.objectCount ?? 0;
                          const bucketTotalSize = bucketMetrics?.totalSize ?? bucket.totalSize ?? 0;
                          const bucketPutCount = bucketMetrics?.putCount ?? 0;
                          const bucketGetCount = bucketMetrics?.getCount ?? 0;
                          const bucketAverageLatency = bucketMetrics?.averageLatency ?? 0;
                          
                          return (
                            <>
                              <div className="grid grid-cols-3 gap-4">
                                <div>
                                  <p className="text-xs text-muted-foreground">Objects</p>
                                  <p className="text-lg font-semibold">{bucketObjectCount.toLocaleString()}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Total Size</p>
                                  <p className="text-lg font-semibold">{formatBytes(bucketTotalSize)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Bucket URL</p>
                                  <p className="text-xs font-mono text-muted-foreground truncate">
                                    s3://{bucket.name}
                                  </p>
                                </div>
                              </div>
                              {bucketMetrics && (
                                <div className="grid grid-cols-4 gap-4 pt-2 border-t">
                                  <div>
                                    <p className="text-xs text-muted-foreground">PUT ops</p>
                                    <p className="text-sm font-semibold">{bucketPutCount.toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">GET ops</p>
                                    <p className="text-sm font-semibold">{bucketGetCount.toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Avg Latency</p>
                                    <p className="text-sm font-semibold">{Math.round(bucketAverageLatency)}ms</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Errors</p>
                                    <p className="text-sm font-semibold">{bucketMetrics.errorCount.toLocaleString()}</p>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                        <Separator />
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Bucket Name</Label>
                            <Input
                              value={bucket.name}
                              onChange={(e) => updateBucket(index, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Region</Label>
                            <Input
                              value={bucket.region}
                              onChange={(e) => updateBucket(index, 'region', e.target.value)}
                              placeholder="us-east-1"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Versioning</Label>
                            <Switch
                              checked={bucket.versioning || false}
                              onCheckedChange={(checked) => updateBucket(index, 'versioning', checked)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Encryption</Label>
                            <Select
                              value={bucket.encryption || 'AES256'}
                              onValueChange={(value: 'AES256' | 'aws:kms') => updateBucket(index, 'encryption', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AES256">AES256</SelectItem>
                                <SelectItem value="aws:kms">AWS KMS</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Public Access</Label>
                            <Switch
                              checked={bucket.publicAccess || false}
                              onCheckedChange={(checked) => updateBucket(index, 'publicAccess', checked)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Lifecycle Enabled</Label>
                            <Switch
                              checked={bucket.lifecycleEnabled || false}
                              onCheckedChange={(checked) => updateBucket(index, 'lifecycleEnabled', checked)}
                            />
                          </div>
                          {bucket.lifecycleEnabled && (
                            <>
                              <div className="space-y-2">
                                <Label>Lifecycle Transition Days</Label>
                                <Input
                                  type="number"
                                  value={bucket.lifecycleDays || 30}
                                  onChange={(e) => updateBucket(index, 'lifecycleDays', Number(e.target.value))}
                                  min={1}
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label>Enable Glacier Archive</Label>
                                <Switch
                                  checked={bucket.glacierEnabled || false}
                                  onCheckedChange={(checked) => updateBucket(index, 'glacierEnabled', checked)}
                                />
                              </div>
                              {bucket.glacierEnabled && (
                                <div className="space-y-2">
                                  <Label>Glacier Transition Days</Label>
                                  <Input
                                    type="number"
                                    value={bucket.glacierDays || 90}
                                    onChange={(e) => updateBucket(index, 'glacierDays', Number(e.target.value))}
                                    min={90}
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        {bucket.folders && bucket.folders.length > 0 && (
                          <div>
                            <Label className="mb-2 block">Folders</Label>
                            <div className="space-y-2">
                              {bucket.folders.map((folder, fIndex) => (
                                <Card key={fIndex} className="p-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Folder className="h-4 w-4 text-muted-foreground" />
                                      <div>
                                        <p className="font-medium">{folder.name}</p>
                                        <p className="text-xs text-muted-foreground">{folder.path}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline">{folder.objectCount || 0} objects</Badge>
                                      <Badge variant="outline">{formatBytes(folder.size || 0)}</Badge>
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lifecycle" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Lifecycle Rules</CardTitle>
                    <CardDescription>Configure automatic transitions and expiration</CardDescription>
                  </div>
                  <Button onClick={addLifecycleRule} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Rule
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {lifecycleRules.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No lifecycle rules configured</p>
                ) : (
                  <div className="space-y-4">
                    {lifecycleRules.map((rule) => (
                      <Card key={rule.id} className="border-l-4 border-l-green-500">
                        <CardContent className="pt-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={rule.status === 'Enabled' ? 'default' : 'outline'}>
                                  {rule.status}
                                </Badge>
                                {editingRuleId === rule.id ? (
                                  <Input
                                    value={rule.name}
                                    onChange={(e) => updateLifecycleRule(rule.id, { name: e.target.value })}
                                    className="w-48"
                                  />
                                ) : (
                                  <span className="font-medium">{rule.name}</span>
                                )}
                                {rule.prefix && (
                                  <Badge variant="outline">Prefix: {rule.prefix}</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingRuleId(editingRuleId === rule.id ? null : rule.id)}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeLifecycleRule(rule.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {editingRuleId === rule.id && (
                            <div className="space-y-4 pt-4 border-t">
                              {/* Rule Name */}
                              <div className="space-y-2">
                                <Label>Rule Name</Label>
                                <Input
                                  value={rule.name}
                                  onChange={(e) => updateLifecycleRule(rule.id, { name: e.target.value })}
                                />
                              </div>

                              {/* Status */}
                              <div className="flex items-center justify-between">
                                <Label>Status</Label>
                                <Select
                                  value={rule.status}
                                  onValueChange={(value: 'Enabled' | 'Disabled') => 
                                    updateLifecycleRule(rule.id, { status: value })
                                  }
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Enabled">Enabled</SelectItem>
                                    <SelectItem value="Disabled">Disabled</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Prefix */}
                              <div className="space-y-2">
                                <Label>Prefix (optional)</Label>
                                <Input
                                  value={rule.prefix || ''}
                                  onChange={(e) => updateLifecycleRule(rule.id, { prefix: e.target.value || undefined })}
                                  placeholder="logs/"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Apply rule to objects with keys starting with this prefix
                                </p>
                              </div>

                              {/* Transitions */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label>Transitions</Label>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addTransitionToRule(rule.id)}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Transition
                                  </Button>
                                </div>
                                {rule.transitions && rule.transitions.length > 0 ? (
                                  <div className="space-y-2">
                                    {rule.transitions.map((transition, idx) => (
                                      <div key={idx} className="flex gap-2 items-center p-2 border rounded">
                                        <div className="flex-1 grid grid-cols-2 gap-2">
                                          <div>
                                            <Label className="text-xs">Days</Label>
                                            <Input
                                              type="number"
                                              value={transition.days}
                                              onChange={(e) => updateTransitionInRule(rule.id, idx, { days: Number(e.target.value) })}
                                              min={1}
                                            />
                                          </div>
                                          <div>
                                            <Label className="text-xs">Storage Class</Label>
                                            <Select
                                              value={transition.storageClass}
                                              onValueChange={(value) => updateTransitionInRule(rule.id, idx, { storageClass: value })}
                                            >
                                              <SelectTrigger>
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="STANDARD_IA">STANDARD_IA</SelectItem>
                                                <SelectItem value="GLACIER">GLACIER</SelectItem>
                                                <SelectItem value="DEEP_ARCHIVE">DEEP_ARCHIVE</SelectItem>
                                                <SelectItem value="INTELLIGENT_TIERING">INTELLIGENT_TIERING</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => removeTransitionFromRule(rule.id, idx)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">No transitions configured</p>
                                )}
                              </div>

                              {/* Expiration */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label>Expiration</Label>
                                  <Switch
                                    checked={!!rule.expiration}
                                    onCheckedChange={(checked) => 
                                      updateLifecycleRule(rule.id, { 
                                        expiration: checked ? { days: 365 } : undefined 
                                      })
                                    }
                                  />
                                </div>
                                {rule.expiration && (
                                  <div className="flex items-center gap-2">
                                    <Label className="text-xs">Delete after</Label>
                                    <Input
                                      type="number"
                                      value={rule.expiration.days}
                                      onChange={(e) => updateLifecycleRule(rule.id, { 
                                        expiration: { days: Number(e.target.value) }
                                      })}
                                      min={1}
                                      className="w-24"
                                    />
                                    <Label className="text-xs">days</Label>
                                  </div>
                                )}
                              </div>
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

          <TabsContent value="credentials" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AWS Credentials</CardTitle>
                <CardDescription>Configure AWS access credentials for S3</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="accessKeyId">Access Key ID</Label>
                  <Input
                    id="accessKeyId"
                    value={accessKeyId}
                    onChange={(e) => updateConfig({ accessKeyId: e.target.value })}
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secretAccessKey">Secret Access Key</Label>
                  <Input
                    id="secretAccessKey"
                    type="password"
                    value={secretAccessKey}
                    onChange={(e) => updateConfig({ secretAccessKey: e.target.value })}
                    placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultRegion">Default Region</Label>
                  <Input
                    id="defaultRegion"
                    value={defaultRegion}
                    onChange={(e) => updateConfig({ defaultRegion: e.target.value })}
                    placeholder="us-east-1"
                  />
                </div>
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    <strong>Security Note:</strong> In production, use IAM roles or environment variables instead of hardcoding credentials.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {s3Engine && (
            <TabsContent value="lifecycle" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Lifecycle Transitions</CardTitle>
                  <CardDescription>
                    Recent storage class transitions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {s3Engine.getLifecycleTransitionHistory()
                      .slice(-10) // Последние 10
                      .reverse()
                      .map((transition, index) => (
                        <div key={index} className="flex items-center justify-between text-xs p-2 rounded bg-secondary/50">
                          <div>
                            <span className="font-medium">{transition.bucket}/{transition.key}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{transition.fromClass}</Badge>
                            <span>→</span>
                            <Badge variant="outline">{transition.toClass}</Badge>
                            <span className="text-muted-foreground">
                              {new Date(transition.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    {s3Engine.getLifecycleTransitionHistory().length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No lifecycle transitions yet
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}


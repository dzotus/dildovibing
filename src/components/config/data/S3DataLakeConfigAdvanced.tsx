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
    setShowCreateRule(false);
  };

  const removeLifecycleRule = (id: string) => {
    updateConfig({ lifecycleRules: lifecycleRules.filter((r) => r.id !== id) });
  };

  const totalBuckets = buckets.length;
  const totalObjects = buckets.reduce((sum, b) => sum + (b.objectCount || 0), 0);
  const totalSize = buckets.reduce((sum, b) => sum + (b.totalSize || 0), 0);

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
            <Button variant="outline" size="sm">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Cloud className="h-4 w-4 mr-2" />
              AWS Console
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Buckets</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{totalBuckets}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Objects</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{totalObjects.toLocaleString()}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Size</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{formatBytes(totalSize)}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Default Region</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{defaultRegion}</Badge>
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
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Objects</p>
                            <p className="text-lg font-semibold">{(bucket.objectCount || 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Total Size</p>
                            <p className="text-lg font-semibold">{formatBytes(bucket.totalSize || 0)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Bucket URL</p>
                            <p className="text-xs font-mono text-muted-foreground truncate">
                              s3://{bucket.name}
                            </p>
                          </div>
                        </div>
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
                  <div className="space-y-2">
                    {lifecycleRules.map((rule) => (
                      <Card key={rule.id} className="border-l-4 border-l-green-500">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant={rule.status === 'Enabled' ? 'default' : 'outline'}>
                                  {rule.status}
                                </Badge>
                                <span className="font-medium">{rule.name}</span>
                                {rule.prefix && (
                                  <Badge variant="outline">Prefix: {rule.prefix}</Badge>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLifecycleRule(rule.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
        </Tabs>
      </div>
    </div>
  );
}


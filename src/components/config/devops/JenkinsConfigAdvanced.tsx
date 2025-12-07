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
import { 
  Play, 
  Pause, 
  Settings, 
  Plus, 
  Trash2,
  GitBranch,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Activity,
  Package,
  Users
} from 'lucide-react';

interface JenkinsConfigProps {
  componentId: string;
}

interface Pipeline {
  id: string;
  name: string;
  status: 'success' | 'running' | 'failed' | 'pending';
  lastBuild: number;
  duration?: number;
  branch?: string;
}

interface JenkinsConfig {
  jenkinsUrl?: string;
  enableCSRF?: boolean;
  executorCount?: number;
  enablePlugins?: boolean;
  plugins?: string[];
  enablePipeline?: boolean;
  enableBlueOcean?: boolean;
  enableArtifactArchiving?: boolean;
  retentionDays?: number;
  pipelines?: Pipeline[];
}

export function JenkinsConfigAdvanced({ componentId }: JenkinsConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as JenkinsConfig;
  const jenkinsUrl = config.jenkinsUrl || 'http://jenkins:8080';
  const enableCSRF = config.enableCSRF ?? true;
  const executorCount = config.executorCount || 2;
  const enablePlugins = config.enablePlugins ?? true;
  const plugins = config.plugins || ['git', 'docker', 'kubernetes'];
  const enablePipeline = config.enablePipeline ?? true;
  const enableBlueOcean = config.enableBlueOcean ?? false;
  const enableArtifactArchiving = config.enableArtifactArchiving ?? true;
  const retentionDays = config.retentionDays || 30;
  const pipelines = config.pipelines || [
    { id: '1', name: 'main-pipeline', status: 'success', lastBuild: 42, duration: 120, branch: 'main' },
    { id: '2', name: 'deploy-staging', status: 'running', lastBuild: 15, duration: 45, branch: 'develop' },
    { id: '3', name: 'test-suite', status: 'failed', lastBuild: 8, duration: 30, branch: 'feature/test' },
  ];

  const updateConfig = (updates: Partial<JenkinsConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addPipeline = () => {
    updateConfig({
      pipelines: [...pipelines, { id: String(pipelines.length + 1), name: 'new-pipeline', status: 'pending', lastBuild: 0 }],
    });
  };

  const removePipeline = (index: number) => {
    updateConfig({ pipelines: pipelines.filter((_, i) => i !== index) });
  };

  const addPlugin = () => {
    updateConfig({ plugins: [...plugins, 'new-plugin'] });
  };

  const removePlugin = (index: number) => {
    updateConfig({ plugins: plugins.filter((_, i) => i !== index) });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500">Success</Badge>;
      case 'running':
        return <Badge variant="default" className="bg-blue-500">Running</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Activity className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Jenkins</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Continuous Integration & Delivery
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Running
            </Badge>
            <Button size="sm" variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </Button>
          </div>
        </div>

        <Separator />

        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pipelines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pipelines.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Total pipelines</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Executors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{executorCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Available</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Plugins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{plugins.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Installed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Builds</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {pipelines.reduce((sum, p) => sum + p.lastBuild, 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total builds</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Configuration Tabs */}
        <Tabs defaultValue="pipelines" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pipelines" className="gap-2">
              <GitBranch className="h-4 w-4" />
              Pipelines
            </TabsTrigger>
            <TabsTrigger value="plugins" className="gap-2">
              <Package className="h-4 w-4" />
              Plugins
            </TabsTrigger>
            <TabsTrigger value="executors" className="gap-2">
              <Users className="h-4 w-4" />
              Executors
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Pipelines Tab */}
          <TabsContent value="pipelines" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Pipelines</CardTitle>
                    <CardDescription>CI/CD pipeline configuration and monitoring</CardDescription>
                  </div>
                  <Button size="sm" onClick={addPipeline} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    New Pipeline
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pipelines.map((pipeline, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            {getStatusIcon(pipeline.status)}
                            <div className="flex-1">
                              <CardTitle className="text-lg">{pipeline.name}</CardTitle>
                              <CardDescription className="text-xs mt-1 flex items-center gap-2">
                                <GitBranch className="h-3 w-3" />
                                {pipeline.branch || 'main'} • Build #{pipeline.lastBuild}
                                {pipeline.duration && ` • ${pipeline.duration}s`}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(pipeline.status)}
                            {pipelines.length > 1 && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removePipeline(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      {pipeline.status === 'running' && (
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Progress</span>
                              <span>65%</span>
                            </div>
                            <Progress value={65} className="h-2" />
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plugins Tab */}
          <TabsContent value="plugins" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Plugins</CardTitle>
                    <CardDescription>Installed Jenkins plugins</CardDescription>
                  </div>
                  <Button size="sm" onClick={addPlugin} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Install Plugin
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {plugins.map((plugin, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 border border-border rounded-lg bg-card">
                      <div className="p-2 rounded bg-primary/10">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold capitalize">{plugin}</div>
                        <div className="text-sm text-muted-foreground">Plugin installed</div>
                      </div>
                      <Badge variant="secondary">Active</Badge>
                      {plugins.length > 1 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removePlugin(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Executors Tab */}
          <TabsContent value="executors" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Executor Configuration</CardTitle>
                <CardDescription>Manage concurrent build executors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="executor-count">Executor Count</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="executor-count"
                      type="number"
                      min="1"
                      max="100"
                      value={executorCount}
                      onChange={(e) => updateConfig({ executorCount: parseInt(e.target.value) || 2 })}
                    />
                    <span className="text-sm text-muted-foreground">concurrent builds</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Number of concurrent builds that can run simultaneously
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Server Configuration</CardTitle>
                <CardDescription>Jenkins server settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="jenkins-url">Jenkins URL</Label>
                  <Input
                    id="jenkins-url"
                    value={jenkinsUrl}
                    onChange={(e) => updateConfig({ jenkinsUrl: e.target.value })}
                    placeholder="http://jenkins:8080"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable CSRF Protection</Label>
                    <div className="text-sm text-muted-foreground">
                      Protect against cross-site request forgery
                    </div>
                  </div>
                  <Switch
                    checked={enableCSRF}
                    onCheckedChange={(checked) => updateConfig({ enableCSRF: checked })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Pipelines</Label>
                    <div className="text-sm text-muted-foreground">
                      Enable Jenkins pipeline support
                    </div>
                  </div>
                  <Switch
                    checked={enablePipeline}
                    onCheckedChange={(checked) => updateConfig({ enablePipeline: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Blue Ocean</Label>
                    <div className="text-sm text-muted-foreground">
                      Modern pipeline UI
                    </div>
                  </div>
                  <Switch
                    checked={enableBlueOcean}
                    onCheckedChange={(checked) => updateConfig({ enableBlueOcean: checked })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Artifact Archiving</Label>
                    <div className="text-sm text-muted-foreground">
                      Store build artifacts
                    </div>
                  </div>
                  <Switch
                    checked={enableArtifactArchiving}
                    onCheckedChange={(checked) => updateConfig({ enableArtifactArchiving: checked })}
                  />
                </div>
                {enableArtifactArchiving && (
                  <div className="space-y-2">
                    <Label htmlFor="retention-days">Retention Days</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="retention-days"
                        type="number"
                        min="1"
                        max="365"
                        value={retentionDays}
                        onChange={(e) => updateConfig({ retentionDays: parseInt(e.target.value) || 30 })}
                      />
                      <span className="text-sm text-muted-foreground">days</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


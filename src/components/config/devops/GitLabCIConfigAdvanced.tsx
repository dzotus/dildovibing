import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  GitBranch, 
  Play, 
  Settings, 
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Trash2,
  RefreshCw
} from 'lucide-react';

interface GitLabCIConfigProps {
  componentId: string;
}

interface Pipeline {
  id: string;
  name: string;
  status: 'running' | 'success' | 'failed' | 'pending';
  branch: string;
  stages: number;
  duration?: number;
}

interface Runner {
  id: string;
  name: string;
  status: 'online' | 'offline';
  type: 'shared' | 'specific';
  jobs: number;
}

interface GitLabCIConfig {
  projectUrl?: string;
  pipelines?: Pipeline[];
  runners?: Runner[];
  activeJobs?: number;
  successRate?: number;
  avgDuration?: number;
}

export function GitLabCIConfigAdvanced({ componentId }: GitLabCIConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as GitLabCIConfig;
  const projectUrl = config.projectUrl || 'https://gitlab.com/archiphoenix/project';
  const pipelines = config.pipelines || [
    { id: '1', name: 'main', status: 'success', branch: 'main', stages: 4, duration: 1250 },
    { id: '2', name: 'feature/auth', status: 'running', branch: 'feature/auth', stages: 3 },
    { id: '3', name: 'develop', status: 'failed', branch: 'develop', stages: 4, duration: 890 },
  ];
  const runners = config.runners || [
    { id: '1', name: 'docker-runner-1', status: 'online', type: 'shared', jobs: 3 },
    { id: '2', name: 'kubernetes-runner', status: 'online', type: 'specific', jobs: 1 },
    { id: '3', name: 'shell-runner-2', status: 'offline', type: 'shared', jobs: 0 },
  ];
  const activeJobs = config.activeJobs || pipelines.filter(p => p.status === 'running').length;
  const successRate = config.successRate || 87.5;
  const avgDuration = config.avgDuration || 1050;

  const updateConfig = (updates: Partial<GitLabCIConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addPipeline = () => {
    updateConfig({
      pipelines: [...pipelines, { id: String(pipelines.length + 1), name: 'new-pipeline', status: 'pending', branch: 'main', stages: 3 }],
    });
  };

  const removePipeline = (index: number) => {
    updateConfig({ pipelines: pipelines.filter((_, i) => i !== index) });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500">Success</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'running':
        return <Badge variant="default" className="bg-blue-500">Running</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <GitBranch className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">GitLab CI/CD</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Continuous Integration & Deployment
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Active
            </Badge>
            <Button size="sm" variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        <Separator />

        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeJobs}</div>
              <p className="text-xs text-muted-foreground mt-1">Running pipelines</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{successRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Duration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgDuration}s</div>
              <p className="text-xs text-muted-foreground mt-1">Pipeline time</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Runners</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{runners.filter(r => r.status === 'online').length}/{runners.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Online</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Configuration Tabs */}
        <Tabs defaultValue="pipelines" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pipelines" className="gap-2">
              <Play className="h-4 w-4" />
              Pipelines
            </TabsTrigger>
            <TabsTrigger value="runners" className="gap-2">
              <Activity className="h-4 w-4" />
              Runners
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
                    <CardDescription>CI/CD pipeline status and history</CardDescription>
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
                          <div className="flex items-center gap-3">
                            {getStatusIcon(pipeline.status)}
                            <div>
                              <CardTitle className="text-lg">{pipeline.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                Branch: {pipeline.branch} • {pipeline.stages} stages
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
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Runners Tab */}
          <TabsContent value="runners" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>CI/CD Runners</CardTitle>
                <CardDescription>Runner configuration and status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {runners.map((runner) => (
                    <Card key={runner.id} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`h-3 w-3 rounded-full ${runner.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                            <div>
                              <CardTitle className="text-lg">{runner.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {runner.type} runner • {runner.jobs} active jobs
                              </CardDescription>
                            </div>
                          </div>
                          <Badge variant={runner.status === 'online' ? 'default' : 'secondary'}>
                            {runner.status}
                          </Badge>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Project Configuration</CardTitle>
                <CardDescription>GitLab project and CI/CD settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="project-url">Project URL</Label>
                  <Input
                    id="project-url"
                    value={projectUrl}
                    onChange={(e) => updateConfig({ projectUrl: e.target.value })}
                    placeholder="https://gitlab.com/user/project"
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Success Rate</span>
                    <span className="font-semibold">{successRate}%</span>
                  </div>
                  <Progress value={successRate} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


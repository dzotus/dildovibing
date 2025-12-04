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
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Layers,
  Cloud
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface TerraformConfigProps {
  componentId: string;
}

interface Workspace {
  id: string;
  name: string;
  description?: string;
  terraformVersion?: string;
  autoApply?: boolean;
  queueAllRuns?: boolean;
  workingDirectory?: string;
  vcsRepo?: {
    identifier: string;
    branch: string;
    oauthTokenId?: string;
  };
  lastRun?: {
    id: string;
    status: 'pending' | 'planning' | 'planned' | 'applying' | 'applied' | 'errored' | 'canceled';
    createdAt: string;
  };
}

interface Run {
  id: string;
  workspace: string;
  status: 'pending' | 'planning' | 'planned' | 'applying' | 'applied' | 'errored' | 'canceled';
  createdAt: string;
  planOnly?: boolean;
  message?: string;
  duration?: number;
}

interface State {
  id: string;
  workspace: string;
  version: number;
  serial: number;
  lineage?: string;
  resources?: number;
  outputs?: Record<string, any>;
  updatedAt: string;
}

interface TerraformConfig {
  workspaces?: Workspace[];
  runs?: Run[];
  states?: State[];
  totalWorkspaces?: number;
  activeRuns?: number;
  completedRuns?: number;
}

export function TerraformConfigAdvanced({ componentId }: TerraformConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as TerraformConfig;
  const workspaces = config.workspaces || [
    {
      id: '1',
      name: 'production',
      description: 'Production infrastructure',
      terraformVersion: '1.5.0',
      autoApply: false,
      queueAllRuns: true,
      workingDirectory: '/terraform',
      lastRun: {
        id: 'run-1',
        status: 'applied',
        createdAt: new Date().toISOString(),
      },
    },
  ];
  const runs = config.runs || [
    {
      id: '1',
      workspace: 'production',
      status: 'applied',
      createdAt: new Date().toISOString(),
      planOnly: false,
      message: 'Apply completed successfully',
      duration: 120,
    },
  ];
  const states = config.states || [
    {
      id: '1',
      workspace: 'production',
      version: 1,
      serial: 1,
      resources: 15,
      updatedAt: new Date().toISOString(),
    },
  ];
  const totalWorkspaces = config.totalWorkspaces || workspaces.length;
  const activeRuns = config.activeRuns || runs.filter((r) => ['pending', 'planning', 'applying'].includes(r.status)).length;
  const completedRuns = config.completedRuns || runs.filter((r) => r.status === 'applied').length;

  const [editingWorkspaceIndex, setEditingWorkspaceIndex] = useState<number | null>(null);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);

  const updateConfig = (updates: Partial<TerraformConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addWorkspace = () => {
    const newWorkspace: Workspace = {
      id: `workspace-${Date.now()}`,
      name: 'new-workspace',
      terraformVersion: '1.5.0',
      autoApply: false,
      queueAllRuns: true,
    };
    updateConfig({ workspaces: [...workspaces, newWorkspace] });
    setShowCreateWorkspace(false);
  };

  const removeWorkspace = (id: string) => {
    updateConfig({ workspaces: workspaces.filter((w) => w.id !== id) });
  };

  const updateWorkspace = (id: string, field: string, value: any) => {
    const newWorkspaces = workspaces.map((w) =>
      w.id === id ? { ...w, [field]: value } : w
    );
    updateConfig({ workspaces: newWorkspaces });
  };

  const createRun = (workspaceId: string, planOnly: boolean = false) => {
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return;

    const newRun: Run = {
      id: `run-${Date.now()}`,
      workspace: workspace.name,
      status: 'pending',
      createdAt: new Date().toISOString(),
      planOnly,
    };
    updateConfig({ runs: [newRun, ...runs.slice(0, 9)] });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Terraform</p>
            <h2 className="text-2xl font-bold text-foreground">Infrastructure as Code</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage workspaces, runs, and state
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

        {/* Enhanced Stats with Visual Indicators */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Workspaces</CardTitle>
                <Layers className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalWorkspaces}</span>
                <span className="text-xs text-muted-foreground">active</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Runs</CardTitle>
                <Activity className="h-4 w-4 text-cyan-500 animate-pulse" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{activeRuns}</span>
                <span className="text-xs text-muted-foreground">running</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{completedRuns}</span>
                <span className="text-xs text-muted-foreground">success</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">State Versions</CardTitle>
                <FileText className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{states.length}</span>
                <span className="text-xs text-muted-foreground">versions</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="workspaces" className="space-y-4">
          <TabsList>
            <TabsTrigger value="workspaces">
              <Layers className="h-4 w-4 mr-2" />
              Workspaces ({workspaces.length})
            </TabsTrigger>
            <TabsTrigger value="runs">
              <Play className="h-4 w-4 mr-2" />
              Runs ({runs.length})
            </TabsTrigger>
            <TabsTrigger value="state">
              <FileText className="h-4 w-4 mr-2" />
              State ({states.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workspaces" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Workspaces</CardTitle>
                    <CardDescription>Manage Terraform workspaces</CardDescription>
                  </div>
                  <Button onClick={addWorkspace} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workspace
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {workspaces.map((workspace) => (
                    <Card key={workspace.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                              <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{workspace.name}</CardTitle>
                              {workspace.description && (
                                <p className="text-sm text-muted-foreground mt-0.5">{workspace.description}</p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="font-mono text-xs">
                                  <Cloud className="h-3 w-3 mr-1" />
                                  v{workspace.terraformVersion || '1.5.0'}
                                </Badge>
                                {workspace.autoApply && (
                                  <Badge variant="default" className="bg-green-500">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Auto Apply
                                  </Badge>
                                )}
                                {workspace.lastRun && (
                                  <Badge variant={
                                    workspace.lastRun.status === 'applied' ? 'default' :
                                    workspace.lastRun.status === 'errored' ? 'destructive' : 'secondary'
                                  }>
                                    {workspace.lastRun.status === 'applied' && <CheckCircle className="h-3 w-3 mr-1" />}
                                    {workspace.lastRun.status === 'errored' && <XCircle className="h-3 w-3 mr-1" />}
                                    {workspace.lastRun.status}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => createRun(workspace.id, false)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Run Plan
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeWorkspace(workspace.id)}
                              disabled={workspaces.length === 1}
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Workspace Name</Label>
                            <Input
                              value={workspace.name}
                              onChange={(e) => updateWorkspace(workspace.id, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Terraform Version</Label>
                            <Select
                              value={workspace.terraformVersion || '1.5.0'}
                              onValueChange={(value) => updateWorkspace(workspace.id, 'terraformVersion', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1.5.0">1.5.0</SelectItem>
                                <SelectItem value="1.4.0">1.4.0</SelectItem>
                                <SelectItem value="1.3.0">1.3.0</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Working Directory</Label>
                            <Input
                              value={workspace.workingDirectory || ''}
                              onChange={(e) => updateWorkspace(workspace.id, 'workingDirectory', e.target.value)}
                              placeholder="/terraform"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Auto Apply</Label>
                            <Switch
                              checked={workspace.autoApply ?? false}
                              onCheckedChange={(checked) => updateWorkspace(workspace.id, 'autoApply', checked)}
                            />
                          </div>
                        </div>
                        {workspace.description && (
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                              value={workspace.description}
                              onChange={(e) => updateWorkspace(workspace.id, 'description', e.target.value)}
                              rows={2}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="runs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Terraform Runs</CardTitle>
                <CardDescription>Execution history and status</CardDescription>
              </CardHeader>
              <CardContent>
                {runs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No runs executed</p>
                ) : (
                  <div className="space-y-2">
                    {runs.map((run) => (
                      <Card
                        key={run.id}
                        className={`border-l-4 hover:shadow-md transition-all ${
                          run.status === 'applied' ? 'border-l-green-500 bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/10' :
                          run.status === 'errored' ? 'border-l-red-500 bg-gradient-to-r from-red-50/50 to-transparent dark:from-red-950/10' :
                          run.status === 'canceled' ? 'border-l-gray-500 bg-gradient-to-r from-gray-50/50 to-transparent dark:from-gray-950/10' :
                          ['pending', 'planning', 'applying'].includes(run.status) ? 'border-l-blue-500 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10' : 'border-l-yellow-500 bg-gradient-to-r from-yellow-50/50 to-transparent dark:from-yellow-950/10'
                        }`}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${
                              run.status === 'applied' ? 'bg-green-100 dark:bg-green-900/30' :
                              run.status === 'errored' ? 'bg-red-100 dark:bg-red-900/30' :
                              ['pending', 'planning', 'applying'].includes(run.status) ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-900/30'
                            }`}>
                              {run.status === 'applied' && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />}
                              {run.status === 'errored' && <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />}
                              {['pending', 'planning', 'applying'].includes(run.status) && <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-pulse" />}
                              {run.status === 'canceled' && <XCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={
                                  run.status === 'applied' ? 'default' :
                                  run.status === 'errored' ? 'destructive' :
                                  run.status === 'canceled' ? 'outline' : 'secondary'
                                } className="font-medium">
                                  {run.status}
                                </Badge>
                                {run.planOnly && (
                                  <Badge variant="outline" className="text-xs">
                                    <FileText className="h-3 w-3 mr-1" />
                                    Plan Only
                                  </Badge>
                                )}
                                <span className="font-semibold text-base">{run.workspace}</span>
                              </div>
                              {run.message && (
                                <p className="text-sm text-muted-foreground mb-2">{run.message}</p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(run.createdAt).toLocaleString()}
                                </div>
                                {run.duration && (
                                  <div className="flex items-center gap-1">
                                    <Activity className="h-3 w-3" />
                                    {run.duration}s
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="state" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>State Management</CardTitle>
                <CardDescription>Terraform state versions</CardDescription>
              </CardHeader>
              <CardContent>
                {states.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No state versions</p>
                ) : (
                  <div className="space-y-2">
                    {states.map((state) => (
                      <Card key={state.id} className="border-l-4 border-l-purple-500">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline">{state.workspace}</Badge>
                                <Badge variant="outline">v{state.version}</Badge>
                                <Badge variant="outline">Serial: {state.serial}</Badge>
                                {state.resources && (
                                  <Badge variant="outline">{state.resources} resources</Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <p>Updated: {new Date(state.updatedAt).toLocaleString()}</p>
                              </div>
                            </div>
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
                <CardTitle>Terraform Settings</CardTitle>
                <CardDescription>Global configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Default Terraform Version</Label>
                  <Select defaultValue="1.5.0">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.5.0">1.5.0</SelectItem>
                      <SelectItem value="1.4.0">1.4.0</SelectItem>
                      <SelectItem value="1.3.0">1.3.0</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Enable State Locking</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Remote State</Label>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


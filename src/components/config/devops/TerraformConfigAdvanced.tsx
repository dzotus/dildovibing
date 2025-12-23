import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { emulationEngine } from '@/core/EmulationEngine';
import { TerraformEmulationEngine, TerraformWorkspace, TerraformRun, TerraformState } from '@/core/TerraformEmulationEngine';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
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
  Cloud,
  Edit,
  Search,
  Filter,
  X,
  AlertCircle,
  GitBranch,
  Save,
  Ban
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
  const { isRunning, getComponentMetrics } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  // Get Terraform emulation engine
  const terraformEngine = emulationEngine.getTerraformEmulationEngine(componentId);
  const componentMetrics = getComponentMetrics(componentId);

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

  // State declarations
  const [editingWorkspaceIndex, setEditingWorkspaceIndex] = useState<number | null>(null);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [realWorkspaces, setRealWorkspaces] = useState<TerraformWorkspace[]>([]);
  const [realRuns, setRealRuns] = useState<TerraformRun[]>([]);
  const [realStates, setRealStates] = useState<TerraformState[]>([]);
  const [realMetrics, setRealMetrics] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [runFilter, setRunFilter] = useState<'all' | 'active' | 'success' | 'failed'>('all');
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [showRunDetails, setShowRunDetails] = useState(false);

  // Use real data from emulation if available, otherwise fallback to config
  const displayWorkspaces = realWorkspaces.length > 0 ? realWorkspaces : workspaces;
  const displayRuns = realRuns.length > 0 ? realRuns : runs;
  const displayStates = realStates.length > 0 ? realStates : states;

  const totalWorkspaces = realMetrics?.workspacesTotal || displayWorkspaces.length;
  const activeRuns = realMetrics?.runsRunning || displayRuns.filter((r: any) => ['pending', 'planning', 'applying'].includes(r.status)).length;
  const completedRuns = realMetrics?.runsSuccess || displayRuns.filter((r: any) => r.status === 'applied').length;

  // Filtered runs based on search and filter
  const filteredRuns = useMemo(() => {
    let filtered = displayRuns;
    
    if (searchQuery) {
      filtered = filtered.filter((run: any) => 
        run.workspaceName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        run.id?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (runFilter === 'active') {
      filtered = filtered.filter((run: any) => ['pending', 'planning', 'applying'].includes(run.status));
    } else if (runFilter === 'success') {
      filtered = filtered.filter((run: any) => run.status === 'applied');
    } else if (runFilter === 'failed') {
      filtered = filtered.filter((run: any) => run.status === 'errored');
    }
    
    return filtered.sort((a: any, b: any) => {
      const aTime = a.createdAt ? (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : a.createdAt) : 0;
      const bTime = b.createdAt ? (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : b.createdAt) : 0;
      return bTime - aTime;
    });
  }, [displayRuns, searchQuery, runFilter]);

  // Update real-time data from emulation
  useEffect(() => {
    if (!terraformEngine) return;
    
    const updateData = () => {
      try {
        const workspaces = terraformEngine.getWorkspaces();
        const activeRuns = terraformEngine.getActiveRuns();
        // Get runs for all workspaces
        const allRuns: TerraformRun[] = [];
        for (const workspace of workspaces) {
          const workspaceRuns = terraformEngine.getRunsForWorkspace(workspace.id, 100);
          allRuns.push(...workspaceRuns);
        }
        const states = terraformEngine.getStates();
        const metrics = terraformEngine.getMetrics();
        
        setRealWorkspaces(workspaces);
        setRealRuns(allRuns);
        setRealStates(states);
        setRealMetrics(metrics);
      } catch (error) {
        console.error('Error updating Terraform data:', error);
      }
    };
    
    updateData();
    const interval = setInterval(updateData, isRunning ? 500 : 2000);
    return () => clearInterval(interval);
  }, [terraformEngine, isRunning]);

  // Sync config with emulation engine when it changes
  useEffect(() => {
    if (!terraformEngine || !node) return;
    terraformEngine.updateConfig(node);
  }, [config.workspaces?.length, config.runs?.length, config.states?.length, terraformEngine, node]);

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
      terraformVersion: config.defaultTerraformVersion || '1.5.0',
      autoApply: false,
      queueAllRuns: true,
    };
    updateConfig({ workspaces: [...workspaces, newWorkspace] });
    setShowCreateWorkspace(false);
    toast({
      title: 'Workspace created',
      description: 'New workspace has been added',
    });
  };

  const removeWorkspace = (id: string) => {
    if (displayWorkspaces.length === 1) {
      toast({
        title: 'Cannot delete workspace',
        description: 'At least one workspace is required',
        variant: 'destructive',
      });
      return;
    }
    
    const workspace = displayWorkspaces.find(w => w.id === id);
    if (workspace && window.confirm(`Are you sure you want to delete workspace "${workspace.name}"?`)) {
      updateConfig({ workspaces: workspaces.filter((w) => w.id !== id) });
      toast({
        title: 'Workspace deleted',
        description: `Workspace "${workspace.name}" has been removed`,
      });
    }
  };

  const updateWorkspace = (id: string, field: string, value: any) => {
    const newWorkspaces = workspaces.map((w) => {
      if (w.id === id) {
        if (field === 'vcsRepo' && value === undefined) {
          const { vcsRepo, ...rest } = w;
          return rest;
        }
        return { ...w, [field]: value };
      }
      return w;
    });
    updateConfig({ workspaces: newWorkspaces });
  };

  const createRun = (workspaceId: string, planOnly: boolean = false) => {
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) {
      toast({
        title: 'Error',
        description: 'Workspace not found',
        variant: 'destructive',
      });
      return;
    }

    if (terraformEngine) {
      const result = terraformEngine.triggerRun(workspaceId, { planOnly, source: 'api', triggeredBy: 'user' });
      if (result.success) {
        toast({
          title: 'Run triggered',
          description: `Run ${result.runId} created for workspace ${workspace.name}`,
        });
      } else {
        toast({
          title: 'Error',
          description: result.reason || 'Failed to trigger run',
          variant: 'destructive',
        });
      }
    } else {
      // Fallback to config update if engine not available
      const newRun: Run = {
        id: `run-${Date.now()}`,
        workspace: workspace.name,
        status: 'pending',
        createdAt: new Date().toISOString(),
        planOnly,
      };
      updateConfig({ runs: [newRun, ...runs.slice(0, 9)] });
      toast({
        title: 'Run created',
        description: `Run created for workspace ${workspace.name}`,
      });
    }
  };

  const cancelRun = (runId: string) => {
    if (terraformEngine) {
      const result = terraformEngine.cancelRun(runId);
      if (result.success) {
        toast({
          title: 'Run canceled',
          description: `Run ${runId} has been canceled`,
        });
      } else {
        toast({
          title: 'Error',
          description: result.reason || 'Failed to cancel run',
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Error',
        description: 'Terraform engine not available',
        variant: 'destructive',
      });
    }
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
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                if (terraformEngine && node) {
                  terraformEngine.updateConfig(node);
                  toast({
                    title: 'Refreshed',
                    description: 'Configuration has been refreshed',
                  });
                }
              }}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator />

        {/* Enhanced Stats with Visual Indicators */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-card">
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
          <Card className="border-l-4 border-l-cyan-500 bg-card">
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
          <Card className="border-l-4 border-l-green-500 bg-card">
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
          <Card className="border-l-4 border-l-purple-500 bg-card">
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
              Workspaces ({displayWorkspaces.length})
            </TabsTrigger>
            <TabsTrigger value="runs">
              <Play className="h-4 w-4 mr-2" />
              Runs ({filteredRuns.length})
            </TabsTrigger>
            <TabsTrigger value="state">
              <FileText className="h-4 w-4 mr-2" />
              State ({displayStates.length})
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
                  {displayWorkspaces.map((workspace) => (
                    <Card key={workspace.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
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
                                    {typeof workspace.lastRun.status === 'string' ? workspace.lastRun.status : 'unknown'}
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
                              disabled={displayWorkspaces.length === 1}
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
                              value={workspace.terraformVersion || config.defaultTerraformVersion || '1.5.0'}
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
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea
                            value={workspace.description || ''}
                            onChange={(e) => updateWorkspace(workspace.id, 'description', e.target.value)}
                            rows={2}
                            placeholder="Workspace description"
                          />
                        </div>
                        <Separator />
                        <div className="space-y-2">
                          <Label>VCS Repository (Optional)</Label>
                          <div className="grid grid-cols-3 gap-2">
                            <Input
                              placeholder="org/repo"
                              value={workspace.vcsRepo?.identifier || ''}
                              onChange={(e) => {
                                const ws = workspaces.find(w => w.id === workspace.id);
                                if (ws) {
                                  updateWorkspace(workspace.id, 'vcsRepo', {
                                    ...(ws.vcsRepo || {}),
                                    identifier: e.target.value,
                                  });
                                }
                              }}
                            />
                            <Input
                              placeholder="branch"
                              value={workspace.vcsRepo?.branch || ''}
                              onChange={(e) => {
                                const ws = workspaces.find(w => w.id === workspace.id);
                                if (ws) {
                                  updateWorkspace(workspace.id, 'vcsRepo', {
                                    ...(ws.vcsRepo || { identifier: '' }),
                                    branch: e.target.value,
                                  });
                                }
                              }}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const ws = workspaces.find(w => w.id === workspace.id);
                                if (ws) updateWorkspace(workspace.id, 'vcsRepo', undefined);
                              }}
                              disabled={!workspace.vcsRepo}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Terraform Runs</CardTitle>
                    <CardDescription>Execution history and status</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search runs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                    <Select value={runFilter} onValueChange={(value: any) => setRunFilter(value)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No runs found</p>
                ) : (
                  <div className="space-y-2">
                    {filteredRuns.map((run: any) => (
                      <Card
                        key={run.id}
                        className={`border-l-4 hover:shadow-md transition-all ${
                          run.status === 'applied' ? 'border-l-green-500 bg-card' :
                          run.status === 'errored' ? 'border-l-red-500 bg-card' :
                          run.status === 'canceled' ? 'border-l-gray-500 bg-card' :
                          ['pending', 'planning', 'applying'].includes(run.status) ? 'border-l-blue-500 bg-card' : 'border-l-yellow-500 bg-card'
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
                                <span className="font-semibold text-base">{run.workspaceName || run.workspace}</span>
                              </div>
                              {run.message && (
                                <p className="text-sm text-muted-foreground mb-2">{run.message}</p>
                              )}
                              {run.error && (
                                <p className="text-sm text-destructive mb-2">{run.error}</p>
                              )}
                              {run.hasChanges && (
                                <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                                  {run.resourceAdditions !== undefined && run.resourceAdditions > 0 && (
                                    <Badge variant="outline" className="bg-green-50 text-green-700">+{run.resourceAdditions}</Badge>
                                  )}
                                  {run.resourceChanges !== undefined && run.resourceChanges > 0 && (
                                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700">~{run.resourceChanges}</Badge>
                                  )}
                                  {run.resourceDestructions !== undefined && run.resourceDestructions > 0 && (
                                    <Badge variant="outline" className="bg-red-50 text-red-700">-{run.resourceDestructions}</Badge>
                                  )}
                                </div>
                              )}
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {run.createdAt ? (
                                    typeof run.createdAt === 'string' 
                                      ? new Date(run.createdAt).toLocaleString()
                                      : new Date(run.createdAt).toLocaleString()
                                  ) : 'Unknown'}
                                </div>
                                {run.duration !== undefined && (
                                  <div className="flex items-center gap-1">
                                    <Activity className="h-3 w-3" />
                                    {Math.round(run.duration / 1000)}s
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {['pending', 'planning', 'applying'].includes(run.status) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (window.confirm(`Are you sure you want to cancel run ${run.id}?`)) {
                                      cancelRun(run.id);
                                    }
                                  }}
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Cancel
                                </Button>
                              )}
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
                {displayStates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No state versions</p>
                ) : (
                  <div className="space-y-2">
                    {displayStates.map((state: any) => (
                      <Card key={state.id} className="border-l-4 border-l-purple-500">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline">{state.workspaceName || state.workspace}</Badge>
                                <Badge variant="outline">v{state.version}</Badge>
                                <Badge variant="outline">Serial: {state.serial}</Badge>
                                {state.resources !== undefined && (
                                  <Badge variant="outline">{state.resources} resources</Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <p>Updated: {state.updatedAt ? (typeof state.updatedAt === 'string' ? new Date(state.updatedAt).toLocaleString() : new Date(state.updatedAt).toLocaleString()) : 'Unknown'}</p>
                              </div>
                              {state.outputs && Object.keys(state.outputs).length > 0 && (
                                <div className="mt-2">
                                  <p className="text-xs font-semibold text-muted-foreground mb-1">Outputs:</p>
                                  <div className="space-y-1">
                                    {Object.entries(state.outputs).map(([key, value]) => (
                                      <div key={key} className="text-xs font-mono bg-muted p-1 rounded">
                                        <span className="text-blue-600">{key}</span> = <span className="text-green-600">{String(value)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
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
                  <Select
                    value={config.defaultTerraformVersion || '1.5.0'}
                    onValueChange={(value) => updateConfig({ defaultTerraformVersion: value })}
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
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable State Locking</Label>
                    <p className="text-xs text-muted-foreground">Prevents concurrent modifications</p>
                  </div>
                  <Switch
                    checked={config.enableStateLocking !== false}
                    onCheckedChange={(checked) => updateConfig({ enableStateLocking: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Remote State</Label>
                    <p className="text-xs text-muted-foreground">Store state remotely</p>
                  </div>
                  <Switch
                    checked={config.enableRemoteState !== false}
                    onCheckedChange={(checked) => updateConfig({ enableRemoteState: checked })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable VCS Integration</Label>
                    <p className="text-xs text-muted-foreground">Connect to version control</p>
                  </div>
                  <Switch
                    checked={config.enableVCS !== false}
                    onCheckedChange={(checked) => updateConfig({ enableVCS: checked })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


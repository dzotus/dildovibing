import { useState, useEffect, useMemo } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
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
  RefreshCw,
  Eye,
  Database,
  Calendar,
  Globe,
  Search,
  X,
  Server,
  Code
} from 'lucide-react';

interface GitLabCIConfigProps {
  componentId: string;
}

interface GitLabCIConfig {
  gitlabUrl?: string;
  projectUrl?: string;
  enableRunners?: boolean;
  runnerType?: 'docker' | 'kubernetes' | 'shell';
  concurrentJobs?: number;
  enableCache?: boolean;
  cacheType?: 's3' | 'gcs' | 'local';
  enableArtifacts?: boolean;
  artifactsExpiry?: string;
  enableKubernetes?: boolean;
  k8sNamespace?: string;
  pipelines?: Array<{
    id: string;
    ref?: string;
    source?: 'push' | 'web' | 'trigger' | 'schedule' | 'api';
    stages?: Array<{
      name: string;
      jobs?: Array<{
        name: string;
        stage: string;
        script?: string[];
        image?: string;
        tags?: string[];
        when?: 'on_success' | 'on_failure' | 'always' | 'manual';
        allowFailure?: boolean;
      }>;
    }>;
  }>;
  runners?: Array<{
    id: string;
    name: string;
    executor?: 'docker' | 'kubernetes' | 'shell';
    maxJobs?: number;
    tags?: string[];
    isShared?: boolean;
  }>;
  variables?: Array<{
    key: string;
    value: string;
    protected?: boolean;
    masked?: boolean;
    environmentScope?: string;
  }>;
  environments?: Array<{
    id: string;
    name: string;
    externalUrl?: string;
  }>;
  schedules?: Array<{
    id: string;
    description: string;
    ref: string;
    cron: string;
    active?: boolean;
    variables?: Record<string, string>;
  }>;
}

export function GitLabCIConfigAdvanced({ componentId }: GitLabCIConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { isRunning, getComponentMetrics } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  // Get GitLab CI emulation engine
  const gitlabCIEngine = emulationEngine.getGitLabCIEmulationEngine(componentId);
  const componentMetrics = getComponentMetrics(componentId);
  
  const config = (node.data.config as any) || {} as GitLabCIConfig;
  
  // Real-time data from emulation
  const [realPipelines, setRealPipelines] = useState<any[]>([]);
  const [realJobs, setRealJobs] = useState<any[]>([]);
  const [realRunners, setRealRunners] = useState<any[]>([]);
  const [realVariables, setRealVariables] = useState<any[]>([]);
  const [realEnvironments, setRealEnvironments] = useState<any[]>([]);
  const [realSchedules, setRealSchedules] = useState<any[]>([]);
  const [realArtifacts, setRealArtifacts] = useState<any[]>([]);
  const [realMetrics, setRealMetrics] = useState<any>(null);
  
  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'running' | 'success' | 'failed' | 'pending'>('all');
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [jobLogs, setJobLogs] = useState<string[]>([]);
  const [showAddRunner, setShowAddRunner] = useState(false);
  const [showAddVariable, setShowAddVariable] = useState(false);
  const [showAddEnvironment, setShowAddEnvironment] = useState(false);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  
  // Form states
  const [newRunnerName, setNewRunnerName] = useState('');
  const [newRunnerExecutor, setNewRunnerExecutor] = useState<'docker' | 'kubernetes' | 'shell'>('docker');
  const [newRunnerMaxJobs, setNewRunnerMaxJobs] = useState(4);
  const [newRunnerTags, setNewRunnerTags] = useState('');
  const [newRunnerShared, setNewRunnerShared] = useState(false);
  
  const [newVariableKey, setNewVariableKey] = useState('');
  const [newVariableValue, setNewVariableValue] = useState('');
  const [newVariableProtected, setNewVariableProtected] = useState(false);
  const [newVariableMasked, setNewVariableMasked] = useState(false);
  const [newVariableScope, setNewVariableScope] = useState('*');
  
  const [newEnvironmentName, setNewEnvironmentName] = useState('');
  const [newEnvironmentUrl, setNewEnvironmentUrl] = useState('');
  
  const [newScheduleDescription, setNewScheduleDescription] = useState('');
  const [newScheduleRef, setNewScheduleRef] = useState('main');
  const [newScheduleCron, setNewScheduleCron] = useState('0 * * * *');
  const [newScheduleActive, setNewScheduleActive] = useState(true);

  // Update real-time data from emulation
  useEffect(() => {
    if (!gitlabCIEngine) return;
    
    const updateData = () => {
      try {
        const pipelines = gitlabCIEngine.getPipelines();
        const jobs = gitlabCIEngine.getActiveJobs();
        const runners = gitlabCIEngine.getRunners();
        const variables = gitlabCIEngine.getVariables();
        const environments = gitlabCIEngine.getEnvironments();
        const schedules = gitlabCIEngine.getSchedules();
        const artifacts = gitlabCIEngine.getArtifacts();
        const metrics = gitlabCIEngine.getGitLabCIMetrics();
        
        setRealPipelines(pipelines);
        setRealJobs(jobs);
        setRealRunners(runners);
        setRealVariables(variables);
        setRealEnvironments(environments);
        setRealSchedules(schedules);
        setRealArtifacts(artifacts);
        setRealMetrics(metrics);
        
        // Update job logs if viewing job details
        if (selectedJob) {
          const logs = gitlabCIEngine.getJobLogs(selectedJob);
          if (logs) setJobLogs(logs);
        }
      } catch (error) {
        console.error('Error updating GitLab CI data:', error);
      }
    };
    
    updateData();
    const interval = setInterval(updateData, isRunning ? 500 : 2000);
    return () => clearInterval(interval);
  }, [gitlabCIEngine, isRunning, selectedJob]);

  // Sync config with emulation engine when it changes
  useEffect(() => {
    if (gitlabCIEngine && node) {
      gitlabCIEngine.updateConfig(node);
    }
  }, [config, node, gitlabCIEngine]);

  const updateConfig = (updates: Partial<GitLabCIConfig>) => {
    const newConfig = { ...config, ...updates };
    updateNode(componentId, {
      data: {
        ...node.data,
        config: newConfig,
      },
    });
    
    // Sync with emulation engine immediately
    if (gitlabCIEngine) {
      gitlabCIEngine.updateConfig({
        ...node,
        data: {
          ...node.data,
          config: newConfig,
        },
      });
    }
  };

  // Helper functions
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'pending':
      case 'created':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'canceled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
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
      case 'created':
        return <Badge variant="secondary">Pending</Badge>;
      case 'canceled':
        return <Badge variant="secondary">Canceled</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  // Pipeline operations
  const addPipeline = () => {
    const newId = `pipeline-${Date.now()}`;
    const pipelines = config.pipelines || [];
    updateConfig({
      pipelines: [...pipelines, {
        id: newId,
        ref: 'main',
        source: 'push',
        stages: [
          { name: 'build', jobs: [{ name: 'build', stage: 'build' }] },
          { name: 'test', jobs: [{ name: 'test', stage: 'test' }] },
          { name: 'deploy', jobs: [{ name: 'deploy', stage: 'deploy' }] },
        ],
      }],
    });
    toast({
      title: "Pipeline added",
      description: "New pipeline created successfully",
    });
  };

  const removePipeline = (pipelineId: string) => {
    const pipelines = config.pipelines || [];
    updateConfig({
      pipelines: pipelines.filter(p => p.id !== pipelineId),
    });
    toast({
      title: "Pipeline removed",
      description: "Pipeline has been removed",
    });
  };

  const startPipeline = (pipelineId: string) => {
    if (!gitlabCIEngine) {
      toast({
        title: "Error",
        description: "GitLab CI engine not available",
        variant: "destructive",
      });
      return;
    }
    
    const result = gitlabCIEngine.startPipeline(pipelineId, Date.now(), 'web');
    if (result.success) {
      toast({
        title: "Pipeline started",
        description: "Pipeline has been triggered",
      });
    } else {
      toast({
        title: "Error",
        description: result.reason || "Failed to start pipeline",
        variant: "destructive",
      });
    }
  };

  const cancelPipeline = (pipelineId: string) => {
    if (!gitlabCIEngine) {
      toast({
        title: "Error",
        description: "GitLab CI engine not available",
        variant: "destructive",
      });
      return;
    }
    
    const result = gitlabCIEngine.cancelPipeline(pipelineId);
    if (result.success) {
      toast({
        title: "Pipeline canceled",
        description: "Pipeline has been canceled",
      });
    } else {
      toast({
        title: "Error",
        description: result.reason || "Failed to cancel pipeline",
        variant: "destructive",
      });
    }
  };

  // Runner operations
  const addRunner = () => {
    if (!newRunnerName.trim()) {
      toast({
        title: "Error",
        description: "Runner name is required",
        variant: "destructive",
      });
      return;
    }
    
    const runners = config.runners || [];
    const newRunner = {
      id: `runner-${Date.now()}`,
      name: newRunnerName,
      executor: newRunnerExecutor,
      maxJobs: newRunnerMaxJobs,
      tags: newRunnerTags.split(',').map(t => t.trim()).filter(Boolean),
      isShared: newRunnerShared,
    };
    
    updateConfig({
      runners: [...runners, newRunner],
    });
    
    // Reset form
    setNewRunnerName('');
    setNewRunnerExecutor('docker');
    setNewRunnerMaxJobs(4);
    setNewRunnerTags('');
    setNewRunnerShared(false);
    setShowAddRunner(false);
    
    toast({
      title: "Runner added",
      description: "New runner created successfully",
    });
  };

  const removeRunner = (runnerId: string) => {
    const runners = config.runners || [];
    updateConfig({
      runners: runners.filter(r => r.id !== runnerId),
    });
    toast({
      title: "Runner removed",
      description: "Runner has been removed",
    });
  };

  // Variable operations
  const addVariable = () => {
    if (!newVariableKey.trim() || !newVariableValue.trim()) {
      toast({
        title: "Error",
        description: "Variable key and value are required",
        variant: "destructive",
      });
      return;
    }
    
    const variables = config.variables || [];
    updateConfig({
      variables: [...variables, {
        key: newVariableKey,
        value: newVariableValue,
        protected: newVariableProtected,
        masked: newVariableMasked,
        environmentScope: newVariableScope,
      }],
    });
    
    // Reset form
    setNewVariableKey('');
    setNewVariableValue('');
    setNewVariableProtected(false);
    setNewVariableMasked(false);
    setNewVariableScope('*');
    setShowAddVariable(false);
    
    toast({
      title: "Variable added",
      description: "New variable created successfully",
    });
  };

  const removeVariable = (key: string) => {
    const variables = config.variables || [];
    updateConfig({
      variables: variables.filter(v => v.key !== key),
    });
    toast({
      title: "Variable removed",
      description: "Variable has been removed",
    });
  };

  // Environment operations
  const addEnvironment = () => {
    if (!newEnvironmentName.trim()) {
      toast({
        title: "Error",
        description: "Environment name is required",
        variant: "destructive",
      });
      return;
    }
    
    const environments = config.environments || [];
    updateConfig({
      environments: [...environments, {
        id: `env-${Date.now()}`,
        name: newEnvironmentName,
        externalUrl: newEnvironmentUrl || undefined,
      }],
    });
    
    // Reset form
    setNewEnvironmentName('');
    setNewEnvironmentUrl('');
    setShowAddEnvironment(false);
    
    toast({
      title: "Environment added",
      description: "New environment created successfully",
    });
  };

  const removeEnvironment = (envId: string) => {
    const environments = config.environments || [];
    updateConfig({
      environments: environments.filter(e => e.id !== envId),
    });
    toast({
      title: "Environment removed",
      description: "Environment has been removed",
    });
  };

  // Schedule operations
  const addSchedule = () => {
    if (!newScheduleDescription.trim() || !newScheduleCron.trim()) {
      toast({
        title: "Error",
        description: "Schedule description and cron expression are required",
        variant: "destructive",
      });
      return;
    }
    
    const schedules = config.schedules || [];
    updateConfig({
      schedules: [...schedules, {
        id: `schedule-${Date.now()}`,
        description: newScheduleDescription,
        ref: newScheduleRef,
        cron: newScheduleCron,
        active: newScheduleActive,
      }],
    });
    
    // Reset form
    setNewScheduleDescription('');
    setNewScheduleRef('main');
    setNewScheduleCron('0 * * * *');
    setNewScheduleActive(true);
    setShowAddSchedule(false);
    
    toast({
      title: "Schedule added",
      description: "New schedule created successfully",
    });
  };

  const removeSchedule = (scheduleId: string) => {
    const schedules = config.schedules || [];
    updateConfig({
      schedules: schedules.filter(s => s.id !== scheduleId),
    });
    toast({
      title: "Schedule removed",
      description: "Schedule has been removed",
    });
  };

  // Filtered data
  const filteredPipelines = useMemo(() => {
    let filtered = realPipelines;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.ref?.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query)
      );
    }
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(p => p.status === filterStatus);
    }
    
    return filtered;
  }, [realPipelines, searchQuery, filterStatus]);

  // Metrics from emulation
  const activeJobsCount = realMetrics?.jobsRunning || 0;
  const successRate = realMetrics && (realMetrics.pipelinesSuccess + realMetrics.pipelinesFailed) > 0
    ? ((realMetrics.pipelinesSuccess / (realMetrics.pipelinesSuccess + realMetrics.pipelinesFailed)) * 100).toFixed(1)
    : '0';
  const avgDuration = realMetrics?.averagePipelineDuration 
    ? Math.round(realMetrics.averagePipelineDuration / 1000)
    : 0;
  const runnersOnline = realRunners.filter(r => r.status === 'online').length;
  const runnersTotal = realRunners.length;

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
              <div className={`h-2 w-2 rounded-full ${gitlabCIEngine ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              {gitlabCIEngine ? 'Active' : 'Inactive'}
            </Badge>
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
              <div className="text-2xl font-bold">{activeJobsCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Running jobs</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{successRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">Pipeline success</p>
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
              <div className="text-2xl font-bold">{runnersOnline}/{runnersTotal}</div>
              <p className="text-xs text-muted-foreground mt-1">Online</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Configuration Tabs */}
        <Tabs defaultValue="pipelines" className="w-full">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="pipelines" className="gap-2">
              <Play className="h-4 w-4" />
              Pipelines
            </TabsTrigger>
            <TabsTrigger value="jobs" className="gap-2">
              <Code className="h-4 w-4" />
              Jobs
            </TabsTrigger>
            <TabsTrigger value="runners" className="gap-2">
              <Server className="h-4 w-4" />
              Runners
            </TabsTrigger>
            <TabsTrigger value="variables" className="gap-2">
              <Database className="h-4 w-4" />
              Variables
            </TabsTrigger>
            <TabsTrigger value="environments" className="gap-2">
              <Globe className="h-4 w-4" />
              Environments
            </TabsTrigger>
            <TabsTrigger value="schedules" className="gap-2">
              <Calendar className="h-4 w-4" />
              Schedules
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
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search pipelines..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                    <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="running">Running</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={addPipeline} variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      New Pipeline
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredPipelines.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No pipelines found
                    </div>
                  ) : (
                    filteredPipelines.map((pipeline) => (
                      <Card key={pipeline.id} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {getStatusIcon(pipeline.status)}
                              <div>
                                <CardTitle className="text-lg">Pipeline #{pipeline.iid}</CardTitle>
                                <CardDescription className="text-xs mt-1">
                                  Ref: {pipeline.ref} • {pipeline.stages?.length || 0} stages
                                  {pipeline.duration && ` • ${Math.round(pipeline.duration / 1000)}s`}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(pipeline.status)}
                              {pipeline.status === 'running' || pipeline.status === 'pending' ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => cancelPipeline(pipeline.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startPipeline(pipeline.id)}
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                              )}
                              {(config.pipelines || []).length > 1 && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => removePipeline(pipeline.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        {pipeline.stages && pipeline.stages.length > 0 && (
                          <CardContent>
                            <div className="flex gap-2">
                              {pipeline.stages.map((stage: any) => (
                                <Badge
                                  key={stage.name}
                                  variant={
                                    stage.status === 'success' ? 'default' :
                                    stage.status === 'failed' ? 'destructive' :
                                    stage.status === 'running' ? 'default' : 'secondary'
                                  }
                                  className={
                                    stage.status === 'success' ? 'bg-green-500' :
                                    stage.status === 'running' ? 'bg-blue-500' : ''
                                  }
                                >
                                  {stage.name}
                                </Badge>
                              ))}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Jobs Tab */}
          <TabsContent value="jobs" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Jobs</CardTitle>
                <CardDescription>Currently running and pending jobs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {realJobs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No active jobs
                    </div>
                  ) : (
                    realJobs.map((job) => (
                      <Card key={job.id} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {getStatusIcon(job.status)}
                              <div>
                                <CardTitle className="text-lg">{job.name}</CardTitle>
                                <CardDescription className="text-xs mt-1">
                                  Stage: {job.stage} • Pipeline: {job.pipelineId}
                                  {job.duration && ` • ${Math.round(job.duration / 1000)}s`}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(job.status)}
                              {job.progress !== undefined && (
                                <Progress value={job.progress} className="w-24 h-2" />
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedJob(job.id);
                                  setShowJobDetails(true);
                                  if (gitlabCIEngine) {
                                    const logs = gitlabCIEngine.getJobLogs(job.id);
                                    if (logs) setJobLogs(logs);
                                  }
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Runners Tab */}
          <TabsContent value="runners" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>CI/CD Runners</CardTitle>
                    <CardDescription>Runner configuration and status</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowAddRunner(true)} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Runner
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {realRunners.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No runners configured
                    </div>
                  ) : (
                    realRunners.map((runner) => (
                      <Card key={runner.id} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`h-3 w-3 rounded-full ${runner.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                              <div>
                                <CardTitle className="text-lg">{runner.name}</CardTitle>
                                <CardDescription className="text-xs mt-1">
                                  {runner.executor} runner • {runner.currentJobs}/{runner.maxJobs} jobs
                                  {runner.tagList && runner.tagList.length > 0 && ` • Tags: ${runner.tagList.join(', ')}`}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={runner.status === 'online' ? 'default' : 'secondary'}>
                                {runner.status}
                              </Badge>
                              {(config.runners || []).find((r: any) => r.id === runner.id) && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => removeRunner(runner.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Variables Tab */}
          <TabsContent value="variables" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>CI/CD Variables</CardTitle>
                    <CardDescription>Environment variables for pipelines</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowAddVariable(true)} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Variable
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {realVariables.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No variables configured
                    </div>
                  ) : (
                    realVariables.map((variable) => (
                      <Card key={variable.key} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-lg">{variable.key}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {variable.masked ? '••••••••' : variable.value}
                                {variable.environmentScope && ` • Scope: ${variable.environmentScope}`}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              {variable.protected && <Badge variant="outline">Protected</Badge>}
                              {variable.masked && <Badge variant="outline">Masked</Badge>}
                              {(config.variables || []).find((v: any) => v.key === variable.key) && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => removeVariable(variable.key)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Environments Tab */}
          <TabsContent value="environments" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Environments</CardTitle>
                    <CardDescription>Deployment environments</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowAddEnvironment(true)} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Environment
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {realEnvironments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No environments configured
                    </div>
                  ) : (
                    realEnvironments.map((environment) => (
                      <Card key={environment.id} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-lg">{environment.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {environment.externalUrl || 'No external URL'}
                                {environment.deployments && ` • ${environment.deployments.length} deployments`}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={environment.state === 'available' ? 'default' : 'secondary'}>
                                {environment.state}
                              </Badge>
                              {(config.environments || []).find((e: any) => e.id === environment.id) && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => removeEnvironment(environment.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schedules Tab */}
          <TabsContent value="schedules" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Pipeline Schedules</CardTitle>
                    <CardDescription>Scheduled pipeline executions</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowAddSchedule(true)} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Schedule
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {realSchedules.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No schedules configured
                    </div>
                  ) : (
                    realSchedules.map((schedule) => (
                      <Card key={schedule.id} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-lg">{schedule.description}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                Ref: {schedule.ref} • Cron: {schedule.cron}
                                {schedule.nextRunAt && ` • Next run: ${new Date(schedule.nextRunAt).toLocaleString()}`}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={schedule.active ? 'default' : 'secondary'}>
                                {schedule.active ? 'Active' : 'Inactive'}
                              </Badge>
                              {(config.schedules || []).find((s: any) => s.id === schedule.id) && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => removeSchedule(schedule.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))
                  )}
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
                    value={config.projectUrl || ''}
                    onChange={(e) => updateConfig({ projectUrl: e.target.value })}
                    placeholder="https://gitlab.com/user/project"
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="gitlab-url">GitLab URL</Label>
                  <Input
                    id="gitlab-url"
                    value={config.gitlabUrl || ''}
                    onChange={(e) => updateConfig({ gitlabUrl: e.target.value })}
                    placeholder="https://gitlab.com"
                  />
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Runners</Label>
                      <p className="text-sm text-muted-foreground">Enable CI/CD runners</p>
                    </div>
                    <Switch
                      checked={config.enableRunners ?? true}
                      onCheckedChange={(checked) => updateConfig({ enableRunners: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Cache</Label>
                      <p className="text-sm text-muted-foreground">Enable build cache</p>
                    </div>
                    <Switch
                      checked={config.enableCache ?? true}
                      onCheckedChange={(checked) => updateConfig({ enableCache: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Artifacts</Label>
                      <p className="text-sm text-muted-foreground">Enable build artifacts</p>
                    </div>
                    <Switch
                      checked={config.enableArtifacts ?? true}
                      onCheckedChange={(checked) => updateConfig({ enableArtifacts: checked })}
                    />
                  </div>
                </div>
                {realMetrics && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Success Rate</span>
                        <span className="font-semibold">{successRate}%</span>
                      </div>
                      <Progress value={parseFloat(successRate)} className="h-2" />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Job Details Dialog */}
      <Dialog open={showJobDetails} onOpenChange={setShowJobDetails}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Job Details</DialogTitle>
            <DialogDescription>View job logs and artifacts</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {jobLogs.length > 0 && (
              <div>
                <Label>Logs</Label>
                <div className="mt-2 p-4 bg-muted rounded-md font-mono text-sm max-h-96 overflow-y-auto">
                  {jobLogs.map((log, idx) => (
                    <div key={idx}>{log}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Runner Dialog */}
      <Dialog open={showAddRunner} onOpenChange={setShowAddRunner}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Runner</DialogTitle>
            <DialogDescription>Configure a new CI/CD runner</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={newRunnerName}
                onChange={(e) => setNewRunnerName(e.target.value)}
                placeholder="runner-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Executor</Label>
              <Select value={newRunnerExecutor} onValueChange={(v: any) => setNewRunnerExecutor(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="docker">Docker</SelectItem>
                  <SelectItem value="kubernetes">Kubernetes</SelectItem>
                  <SelectItem value="shell">Shell</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Max Jobs</Label>
              <Input
                type="number"
                value={newRunnerMaxJobs}
                onChange={(e) => setNewRunnerMaxJobs(parseInt(e.target.value) || 4)}
                min={1}
                max={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Tags (comma-separated)</Label>
              <Input
                value={newRunnerTags}
                onChange={(e) => setNewRunnerTags(e.target.value)}
                placeholder="docker, linux"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Shared Runner</Label>
              <Switch
                checked={newRunnerShared}
                onCheckedChange={setNewRunnerShared}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRunner(false)}>Cancel</Button>
            <Button onClick={addRunner}>Add Runner</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Variable Dialog */}
      <Dialog open={showAddVariable} onOpenChange={setShowAddVariable}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Variable</DialogTitle>
            <DialogDescription>Add a new CI/CD variable</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Key</Label>
              <Input
                value={newVariableKey}
                onChange={(e) => setNewVariableKey(e.target.value)}
                placeholder="VARIABLE_NAME"
              />
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                value={newVariableValue}
                onChange={(e) => setNewVariableValue(e.target.value)}
                placeholder="variable value"
              />
            </div>
            <div className="space-y-2">
              <Label>Environment Scope</Label>
              <Input
                value={newVariableScope}
                onChange={(e) => setNewVariableScope(e.target.value)}
                placeholder="*"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Protected</Label>
              <Switch
                checked={newVariableProtected}
                onCheckedChange={setNewVariableProtected}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Masked</Label>
              <Switch
                checked={newVariableMasked}
                onCheckedChange={setNewVariableMasked}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddVariable(false)}>Cancel</Button>
            <Button onClick={addVariable}>Add Variable</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Environment Dialog */}
      <Dialog open={showAddEnvironment} onOpenChange={setShowAddEnvironment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Environment</DialogTitle>
            <DialogDescription>Add a new deployment environment</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={newEnvironmentName}
                onChange={(e) => setNewEnvironmentName(e.target.value)}
                placeholder="production"
              />
            </div>
            <div className="space-y-2">
              <Label>External URL (optional)</Label>
              <Input
                value={newEnvironmentUrl}
                onChange={(e) => setNewEnvironmentUrl(e.target.value)}
                placeholder="https://app.example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEnvironment(false)}>Cancel</Button>
            <Button onClick={addEnvironment}>Add Environment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Schedule Dialog */}
      <Dialog open={showAddSchedule} onOpenChange={setShowAddSchedule}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Schedule</DialogTitle>
            <DialogDescription>Schedule a pipeline to run automatically</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={newScheduleDescription}
                onChange={(e) => setNewScheduleDescription(e.target.value)}
                placeholder="Nightly build"
              />
            </div>
            <div className="space-y-2">
              <Label>Ref (branch or tag)</Label>
              <Input
                value={newScheduleRef}
                onChange={(e) => setNewScheduleRef(e.target.value)}
                placeholder="main"
              />
            </div>
            <div className="space-y-2">
              <Label>Cron Expression</Label>
              <Input
                value={newScheduleCron}
                onChange={(e) => setNewScheduleCron(e.target.value)}
                placeholder="0 * * * *"
              />
              <p className="text-xs text-muted-foreground">Format: minute hour day month weekday</p>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={newScheduleActive}
                onCheckedChange={setNewScheduleActive}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSchedule(false)}>Cancel</Button>
            <Button onClick={addSchedule}>Add Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

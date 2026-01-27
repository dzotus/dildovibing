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
  Code,
  Upload,
  FileCode,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { validateGitLabCIConfig, validateCronExpression } from '@/core/GitLabCIValidation';
import { PipelineVisualization } from './PipelineVisualization';
import { GitLabCIStage, GitLabCIJob } from '@/core/GitLabCIEmulationEngine';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

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
  
  const config = (node?.data?.config as GitLabCIConfig) || {};
  
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
  const [filterStatus, setFilterStatus] = useState<'all' | 'running' | 'success' | 'failed' | 'pending' | 'canceled'>('all');
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [jobLogs, setJobLogs] = useState<string[]>([]);
  const [showAddRunner, setShowAddRunner] = useState(false);
  const [showAddVariable, setShowAddVariable] = useState(false);
  const [showAddEnvironment, setShowAddEnvironment] = useState(false);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [selectedPipelineForViz, setSelectedPipelineForViz] = useState<string | null>(null);
  
  // Jobs filters and sorting
  const [jobFilterStatus, setJobFilterStatus] = useState<'all' | 'running' | 'success' | 'failed' | 'pending' | 'manual' | 'canceled'>('all');
  const [jobFilterStage, setJobFilterStage] = useState<string>('all');
  const [jobFilterRunner, setJobFilterRunner] = useState<string>('all');
  const [jobSortBy, setJobSortBy] = useState<'created' | 'duration' | 'status' | 'name'>('created');
  const [jobSortOrder, setJobSortOrder] = useState<'asc' | 'desc'>('desc');
  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  
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
  
  // YAML import state
  const [showYamlImport, setShowYamlImport] = useState(false);
  const [yamlContent, setYamlContent] = useState('');
  const [yamlValidationError, setYamlValidationError] = useState<string | null>(null);

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

  const configPipelines = useMemo(() => {
    const pipelines = Array.isArray(config.pipelines) ? config.pipelines : [];
    return pipelines.map((pipeline, index) => ({
      id: pipeline.id,
      iid: index + 1,
      status: 'created',
      ref: pipeline.ref || 'main',
      source: pipeline.source || 'push',
      stages: (Array.isArray(pipeline.stages) ? pipeline.stages : []).map((stage) => ({
        name: stage.name,
        status: 'pending',
        jobs: (Array.isArray(stage.jobs) ? stage.jobs : []).map((job) => ({
          id: `${pipeline.id}-${stage.name}-${job.name}`,
          name: job.name,
          stage: stage.name,
          status: 'created',
          pipelineId: pipeline.id,
          when: job.when,
          allowFailure: job.allowFailure,
          tags: Array.isArray(job.tags) ? job.tags : [],
          image: job.image,
          script: Array.isArray(job.script) ? job.script : undefined,
        })),
      })),
    }));
  }, [config.pipelines]);

  const configRunners = useMemo(() => {
    const runners = Array.isArray(config.runners) ? config.runners : [];
    return runners.map((runner) => ({
      id: runner.id,
      name: runner.name,
      status: 'offline',
      executor: runner.executor || config.runnerType || 'docker',
      currentJobs: 0,
      maxJobs: runner.maxJobs || config.concurrentJobs || 4,
      tagList: Array.isArray(runner.tags) ? runner.tags : [],
      isShared: runner.isShared ?? false,
    }));
  }, [config.runners, config.runnerType, config.concurrentJobs]);

  const configVariables = useMemo(() => {
    const variables = Array.isArray(config.variables) ? config.variables : [];
    return variables.map((variable) => ({
      key: variable.key,
      value: variable.value,
      protected: variable.protected ?? false,
      masked: variable.masked ?? false,
      environmentScope: variable.environmentScope || '*',
    }));
  }, [config.variables]);

  const configEnvironments = useMemo(() => {
    const environments = Array.isArray(config.environments) ? config.environments : [];
    return environments.map((environment) => ({
      id: environment.id,
      name: environment.name,
      externalUrl: environment.externalUrl,
      state: 'available',
      deployments: [],
    }));
  }, [config.environments]);

  const configSchedules = useMemo(() => {
    const schedules = Array.isArray(config.schedules) ? config.schedules : [];
    return schedules.map((schedule) => ({
      id: schedule.id,
      description: schedule.description,
      ref: schedule.ref,
      cron: schedule.cron,
      active: schedule.active ?? true,
    }));
  }, [config.schedules]);

  const displayPipelines = gitlabCIEngine ? realPipelines : configPipelines;
  const displayJobs = gitlabCIEngine ? realJobs : [];
  const displayRunners = gitlabCIEngine ? realRunners : configRunners;
  const displayVariables = gitlabCIEngine ? realVariables : configVariables;
  const displayEnvironments = gitlabCIEngine ? realEnvironments : configEnvironments;
  const displaySchedules = gitlabCIEngine ? realSchedules : configSchedules;

  // Filtered and sorted jobs
  const filteredAndSortedJobs = useMemo(() => {
    let filtered = [...displayJobs];

    // Filter by status
    if (jobFilterStatus !== 'all') {
      filtered = filtered.filter(job => job.status === jobFilterStatus);
    }

    // Filter by stage
    if (jobFilterStage !== 'all') {
      filtered = filtered.filter(job => job.stage === jobFilterStage);
    }

    // Filter by runner
    if (jobFilterRunner !== 'all') {
      filtered = filtered.filter(job => job.runnerId === jobFilterRunner);
    }

    // Search filter
    if (jobSearchQuery) {
      const query = jobSearchQuery.toLowerCase();
      filtered = filtered.filter(job =>
        job.name.toLowerCase().includes(query) ||
        job.stage.toLowerCase().includes(query) ||
        job.pipelineId.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (jobSortBy) {
        case 'created':
          comparison = (a.startTime || 0) - (b.startTime || 0);
          break;
        case 'duration':
          comparison = (a.duration || 0) - (b.duration || 0);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
      }
      return jobSortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [displayJobs, jobFilterStatus, jobFilterStage, jobFilterRunner, jobSearchQuery, jobSortBy, jobSortOrder]);

  // Get unique stages and runners for filters
  const availableStages = useMemo(() => {
    const stages = new Set<string>();
    displayJobs.forEach(job => {
      if (job.stage) stages.add(job.stage);
    });
    return Array.from(stages).sort();
  }, [displayJobs]);

  const availableRunners = useMemo(() => {
    const runners = new Map<string, string>();
    displayJobs.forEach(job => {
      if (job.runnerId && displayRunners.find(r => r.id === job.runnerId)) {
        const runner = displayRunners.find(r => r.id === job.runnerId);
        if (runner) runners.set(job.runnerId, runner.name);
      }
    });
    return Array.from(runners.entries()).map(([id, name]) => ({ id, name }));
  }, [displayJobs, displayRunners]);

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
        ...(node?.data || {}),
        config: newConfig,
      },
    });
    
    // Sync with emulation engine immediately
    if (gitlabCIEngine && node) {
      gitlabCIEngine.updateConfig({
        ...node,
        data: {
          ...(node?.data || {}),
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

  const startPipeline = (pipelineId: string, isTemplate: boolean = false) => {
    if (!gitlabCIEngine) {
      toast({
        title: "Error",
        description: "GitLab CI engine not available",
        variant: "destructive",
      });
      return;
    }
    
    // Если это execution, нужно получить templateId
    let templateId = pipelineId;
    if (!isTemplate) {
      const execution = gitlabCIEngine.getPipeline(pipelineId);
      if (execution) {
        templateId = execution.templateId;
      }
    }
    
    const result = gitlabCIEngine.startPipeline(templateId, Date.now(), 'web');
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
  
  const retryPipeline = (executionId: string) => {
    if (!gitlabCIEngine) {
      toast({
        title: "Error",
        description: "GitLab CI engine not available",
        variant: "destructive",
      });
      return;
    }
    
    const result = gitlabCIEngine.retryPipeline(executionId, Date.now());
    if (result.success) {
      toast({
        title: "Pipeline retried",
        description: "Pipeline has been retried with the same IID",
      });
    } else {
      toast({
        title: "Error",
        description: result.reason || "Failed to retry pipeline",
        variant: "destructive",
      });
    }
  };
  
  const playManualJob = (jobId: string) => {
    if (!gitlabCIEngine) {
      toast({
        title: "Error",
        description: "GitLab CI engine not available",
        variant: "destructive",
      });
      return;
    }
    
    const result = gitlabCIEngine.playManualJob(jobId, Date.now());
    if (result.success) {
      toast({
        title: "Manual job started",
        description: "Manual job has been triggered",
      });
    } else {
      toast({
        title: "Error",
        description: result.reason || "Failed to start manual job",
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
    let filtered = displayPipelines;
    
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
  }, [displayPipelines, searchQuery, filterStatus]);

  // Metrics from emulation
  const activeJobsCount = gitlabCIEngine ? (realMetrics?.jobsRunning || 0) : displayJobs.length;
  const successRate = realMetrics && (realMetrics.pipelinesSuccess + realMetrics.pipelinesFailed) > 0
    ? ((realMetrics.pipelinesSuccess / (realMetrics.pipelinesSuccess + realMetrics.pipelinesFailed)) * 100).toFixed(1)
    : '0';
  const avgDuration = realMetrics?.averagePipelineDuration 
    ? Math.round(realMetrics.averagePipelineDuration / 1000)
    : 0;
  const runnersOnline = displayRunners.filter((runner) => runner.status === 'online').length;
  const runnersTotal = displayRunners.length;

  // Prepare chart data for metrics
  const metricsChartData = useMemo(() => {
    if (!gitlabCIEngine || !realPipelines.length) return [];
    
    // Group pipelines by time windows (last 20 time points)
    const now = Date.now();
    const timeWindows = 20;
    const windowSize = 60000; // 1 minute per window
    const data: Array<{
      time: string;
      success: number;
      failed: number;
      duration: number;
      running: number;
    }> = [];
    
    for (let i = timeWindows - 1; i >= 0; i--) {
      const windowStart = now - (i + 1) * windowSize;
      const windowEnd = now - i * windowSize;
      const windowPipelines = realPipelines.filter(p => {
        const created = p.createdAt || 0;
        return created >= windowStart && created < windowEnd;
      });
      
      const success = windowPipelines.filter(p => p.status === 'success').length;
      const failed = windowPipelines.filter(p => p.status === 'failed').length;
      const avgDuration = windowPipelines.length > 0
        ? windowPipelines.reduce((sum, p) => sum + (p.duration || 0), 0) / windowPipelines.length / 1000
        : 0;
      const running = windowPipelines.filter(p => p.status === 'running').length;
      
      data.push({
        time: new Date(windowEnd).toLocaleTimeString(),
        success,
        failed,
        duration: Math.round(avgDuration),
        running,
      });
    }
    
    return data;
  }, [gitlabCIEngine, realPipelines]);

  // Calculate percentiles for pipeline duration
  const durationPercentiles = useMemo(() => {
    if (!realPipelines.length) return { p50: 0, p95: 0, p99: 0 };
    
    const durations = realPipelines
      .filter(p => p.duration !== undefined && p.duration > 0)
      .map(p => p.duration!)
      .sort((a, b) => a - b);
    
    if (durations.length === 0) return { p50: 0, p95: 0, p99: 0 };
    
    const p50 = durations[Math.floor(durations.length * 0.5)] / 1000;
    const p95 = durations[Math.floor(durations.length * 0.95)] / 1000;
    const p99 = durations[Math.floor(durations.length * 0.99)] / 1000;
    
    return { p50: Math.round(p50), p95: Math.round(p95), p99: Math.round(p99) };
  }, [realPipelines]);

  // Runner utilization data
  const runnerUtilizationData = useMemo(() => {
    return displayRunners.map(runner => ({
      name: runner.name,
      utilization: runner.status === 'online' 
        ? (runner.currentJobs / runner.maxJobs) * 100 
        : 0,
      currentJobs: runner.currentJobs,
      maxJobs: runner.maxJobs,
    }));
  }, [displayRunners]);

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
          <TabsList className="flex flex-wrap w-full gap-1 p-1 h-auto">
            <TabsTrigger value="pipelines" className="gap-2 flex-shrink-0 whitespace-nowrap">
              <Play className="h-4 w-4 flex-shrink-0" />
              Pipelines
            </TabsTrigger>
            <TabsTrigger value="visualization" className="gap-2 flex-shrink-0 whitespace-nowrap">
              <Activity className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Visualization</span>
              <span className="sm:hidden">Viz</span>
            </TabsTrigger>
            <TabsTrigger value="jobs" className="gap-2 flex-shrink-0 whitespace-nowrap">
              <Code className="h-4 w-4 flex-shrink-0" />
              Jobs
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-2 flex-shrink-0 whitespace-nowrap">
              <Activity className="h-4 w-4 flex-shrink-0" />
              Metrics
            </TabsTrigger>
            <TabsTrigger value="runners" className="gap-2 flex-shrink-0 whitespace-nowrap">
              <Server className="h-4 w-4 flex-shrink-0" />
              Runners
            </TabsTrigger>
            <TabsTrigger value="variables" className="gap-2 flex-shrink-0 whitespace-nowrap">
              <Database className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Variables</span>
              <span className="sm:hidden">Vars</span>
            </TabsTrigger>
            <TabsTrigger value="environments" className="gap-2 flex-shrink-0 whitespace-nowrap">
              <Globe className="h-4 w-4 flex-shrink-0" />
              <span className="hidden md:inline">Environments</span>
              <span className="md:hidden">Envs</span>
            </TabsTrigger>
            <TabsTrigger value="schedules" className="gap-2 flex-shrink-0 whitespace-nowrap">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Schedules</span>
              <span className="sm:hidden">Sched</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2 flex-shrink-0 whitespace-nowrap">
              <Settings className="h-4 w-4 flex-shrink-0" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Pipelines Tab */}
          <TabsContent value="pipelines" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Pipelines</CardTitle>
                    <CardDescription>CI/CD pipeline status and history</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search pipelines..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 w-full sm:w-48 md:w-64"
                      />
                    </div>
                    <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                      <SelectTrigger className="w-full sm:w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="running">Running</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="canceled">Canceled</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => setShowYamlImport(true)} variant="outline" className="flex-shrink-0">
                      <Download className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Import YAML</span>
                    </Button>
                    <Button size="sm" onClick={addPipeline} variant="outline" className="flex-shrink-0">
                      <Plus className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">New Pipeline</span>
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
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {getStatusIcon(pipeline.status)}
                              <div className="min-w-0 flex-1">
                                <CardTitle className="text-lg truncate">
                                  Pipeline #{pipeline.iid}
                                  {pipeline.mergeRequest && ` • MR !${pipeline.mergeRequest.iid}`}
                                  {pipeline.parentPipelineId && ` • Child`}
                                </CardTitle>
                                <CardDescription className="text-xs mt-1 break-words">
                                  {pipeline.mergeRequest ? (
                                    <>
                                      MR: {pipeline.mergeRequest.title} • {pipeline.mergeRequest.sourceBranch} → {pipeline.mergeRequest.targetBranch}
                                      {pipeline.stages?.length > 0 && ` • ${pipeline.stages.length} stages`}
                                    </>
                                  ) : (
                                    <>
                                      Ref: {pipeline.ref} • {pipeline.stages?.length || 0} stages
                                    </>
                                  )}
                                  {pipeline.duration && ` • ${Math.round(pipeline.duration / 1000)}s`}
                                  {pipeline.parentPipelineId && ` • Parent: #${gitlabCIEngine?.getPipeline(pipeline.parentPipelineId)?.iid || 'N/A'}`}
                                  {pipeline.childPipelineIds && pipeline.childPipelineIds.length > 0 && ` • ${pipeline.childPipelineIds.length} child pipeline(s)`}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {getStatusBadge(pipeline.status)}
                              {pipeline.status === 'running' || pipeline.status === 'pending' ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => cancelPipeline(pipeline.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              ) : gitlabCIEngine && (pipeline.status === 'success' || pipeline.status === 'failed') ? (
                                // Для executions показываем Retry
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => retryPipeline(pipeline.id)}
                                  title="Retry pipeline"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              ) : (
                                // Для templates показываем Play
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startPipeline(pipeline.id, !gitlabCIEngine)}
                                  title="Start pipeline"
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                              )}
                              {!gitlabCIEngine && (config.pipelines || []).length > 1 && (
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

          {/* Visualization Tab */}
          <TabsContent value="visualization" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Pipeline Visualization</CardTitle>
                    <CardDescription>Visual representation of pipeline stages and jobs</CardDescription>
                  </div>
                  <Select
                    value={selectedPipelineForViz || ''}
                    onValueChange={(value) => setSelectedPipelineForViz(value || null)}
                  >
                    <SelectTrigger className="w-full sm:w-64">
                      <SelectValue placeholder="Select a pipeline to visualize" />
                    </SelectTrigger>
                    <SelectContent>
                      {realPipelines.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">No pipelines available</div>
                      ) : (
                        realPipelines.map((pipeline) => (
                          <SelectItem key={pipeline.id} value={pipeline.id}>
                            Pipeline #{pipeline.iid} • {pipeline.ref} • {pipeline.status}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {selectedPipelineForViz ? (
                  (() => {
                    const pipeline = realPipelines.find((p) => p.id === selectedPipelineForViz);
                    if (!pipeline) {
                      return (
                        <div className="text-center text-muted-foreground py-8">
                          Pipeline not found
                        </div>
                      );
                    }
                    return (
                      <PipelineVisualization
                        pipeline={pipeline}
                        onStageClick={(stage: GitLabCIStage) => {
                          // Можно добавить логику для показа деталей stage
                          console.log('Stage clicked:', stage);
                        }}
                        onJobClick={(job: GitLabCIJob) => {
                          setSelectedJob(job.id);
                          setShowJobDetails(true);
                          if (gitlabCIEngine) {
                            const logs = gitlabCIEngine.getJobLogs(job.id);
                            if (logs) setJobLogs(logs);
                          }
                        }}
                      />
                    );
                  })()
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    Select a pipeline from the dropdown above to visualize
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Jobs Tab */}
          <TabsContent value="jobs" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Active Jobs</CardTitle>
                    <CardDescription>Currently running and pending jobs</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full sm:w-auto">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search jobs..."
                        value={jobSearchQuery}
                        onChange={(e) => setJobSearchQuery(e.target.value)}
                        className="pl-8 w-full sm:w-48 md:w-64"
                      />
                    </div>
                    <Select value={jobFilterStatus} onValueChange={(v: any) => setJobFilterStatus(v)}>
                      <SelectTrigger className="w-full sm:w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="running">Running</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="canceled">Canceled</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={jobFilterStage} onValueChange={(v: any) => setJobFilterStage(v)}>
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue placeholder="All Stages" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Stages</SelectItem>
                        {availableStages.map(stage => (
                          <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={jobFilterRunner} onValueChange={(v: any) => setJobFilterRunner(v)}>
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue placeholder="All Runners" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Runners</SelectItem>
                        {availableRunners.map(runner => (
                          <SelectItem key={runner.id} value={runner.id}>{runner.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={`${jobSortBy}-${jobSortOrder}`} onValueChange={(v: string) => {
                      const [sortBy, sortOrder] = v.split('-');
                      setJobSortBy(sortBy as any);
                      setJobSortOrder(sortOrder as any);
                    }}>
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="created-desc">Newest First</SelectItem>
                        <SelectItem value="created-asc">Oldest First</SelectItem>
                        <SelectItem value="duration-desc">Longest First</SelectItem>
                        <SelectItem value="duration-asc">Shortest First</SelectItem>
                        <SelectItem value="name-asc">Name A-Z</SelectItem>
                        <SelectItem value="name-desc">Name Z-A</SelectItem>
                        <SelectItem value="status-asc">Status A-Z</SelectItem>
                        <SelectItem value="status-desc">Status Z-A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredAndSortedJobs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {displayJobs.length === 0 ? 'No active jobs' : 'No jobs match the filters'}
                    </div>
                  ) : (
                    filteredAndSortedJobs.map((job) => (
                      <Card key={job.id} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {getStatusIcon(job.status)}
                              <div className="min-w-0 flex-1">
                                <CardTitle className="text-lg truncate">{job.name}</CardTitle>
                                <CardDescription className="text-xs mt-1 break-words">
                                  Stage: {job.stage} • Pipeline: {job.pipelineId}
                                  {job.duration && ` • ${Math.round(job.duration / 1000)}s`}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {getStatusBadge(job.status)}
                              {job.progress !== undefined && (
                                <Progress value={job.progress} className="w-16 sm:w-24 h-2" />
                              )}
                              {job.status === 'manual' && gitlabCIEngine && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => playManualJob(job.id)}
                                  title="Play manual job"
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
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

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-4 mt-4">
            {/* Pipeline Success Rate Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Pipeline Success Rate Over Time</CardTitle>
                <CardDescription>Success and failure trends</CardDescription>
              </CardHeader>
              <CardContent>
                {metricsChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={metricsChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Area type="monotone" dataKey="success" stackId="1" stroke="#22c55e" fill="#22c55e" name="Success" />
                      <Area type="monotone" dataKey="failed" stackId="1" stroke="#ef4444" fill="#ef4444" name="Failed" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No pipeline data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pipeline Duration Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Pipeline Duration Over Time</CardTitle>
                <CardDescription>Average pipeline execution time</CardDescription>
              </CardHeader>
              <CardContent>
                {metricsChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={metricsChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis label={{ value: 'Duration (s)', angle: -90, position: 'insideLeft' }} />
                      <RechartsTooltip formatter={(value: number) => `${value}s`} />
                      <Legend />
                      <Line type="monotone" dataKey="duration" stroke="#3b82f6" name="Duration (s)" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No pipeline data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Duration Percentiles */}
            <Card>
              <CardHeader>
                <CardTitle>Pipeline Duration Percentiles</CardTitle>
                <CardDescription>P50, P95, P99 percentiles for pipeline duration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-500">{durationPercentiles.p50}s</div>
                    <p className="text-sm text-muted-foreground mt-1">P50 (Median)</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-500">{durationPercentiles.p95}s</div>
                    <p className="text-sm text-muted-foreground mt-1">P95</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-500">{durationPercentiles.p99}s</div>
                    <p className="text-sm text-muted-foreground mt-1">P99</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Runner Utilization Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Runner Utilization</CardTitle>
                <CardDescription>Current jobs vs max jobs per runner</CardDescription>
              </CardHeader>
              <CardContent>
                {runnerUtilizationData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={runnerUtilizationData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis label={{ value: 'Utilization (%)', angle: -90, position: 'insideLeft' }} />
                      <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                      <Legend />
                      <Bar dataKey="utilization" fill="#3b82f6" name="Utilization (%)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No runner data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Detailed Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Detailed Metrics</CardTitle>
                <CardDescription>Current system metrics</CardDescription>
              </CardHeader>
              <CardContent>
                {realMetrics ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Pipelines</Label>
                      <div className="mt-1 space-y-1">
                        <div className="flex justify-between">
                          <span>Total:</span>
                          <span className="font-semibold">{realMetrics.pipelinesTotal}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Success:</span>
                          <span className="font-semibold text-green-500">{realMetrics.pipelinesSuccess}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Failed:</span>
                          <span className="font-semibold text-red-500">{realMetrics.pipelinesFailed}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Running:</span>
                          <span className="font-semibold text-blue-500">{realMetrics.pipelinesRunning}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Per Hour:</span>
                          <span className="font-semibold">{realMetrics.pipelinesPerHour.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Jobs</Label>
                      <div className="mt-1 space-y-1">
                        <div className="flex justify-between">
                          <span>Total:</span>
                          <span className="font-semibold">{realMetrics.jobsTotal}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Success:</span>
                          <span className="font-semibold text-green-500">{realMetrics.jobsSuccess}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Failed:</span>
                          <span className="font-semibold text-red-500">{realMetrics.jobsFailed}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Running:</span>
                          <span className="font-semibold text-blue-500">{realMetrics.jobsRunning}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Avg Duration:</span>
                          <span className="font-semibold">{Math.round(realMetrics.averageJobDuration / 1000)}s</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Runners</Label>
                      <div className="mt-1 space-y-1">
                        <div className="flex justify-between">
                          <span>Total:</span>
                          <span className="font-semibold">{realMetrics.runnersTotal}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Online:</span>
                          <span className="font-semibold text-green-500">{realMetrics.runnersOnline}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Busy:</span>
                          <span className="font-semibold text-orange-500">{realMetrics.runnersBusy}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Idle:</span>
                          <span className="font-semibold text-gray-500">{realMetrics.runnersIdle}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Utilization:</span>
                          <span className="font-semibold">{realMetrics.runnerUtilization.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Cache & Artifacts</Label>
                      <div className="mt-1 space-y-1">
                        <div className="flex justify-between">
                          <span>Cache Hits:</span>
                          <span className="font-semibold text-green-500">{realMetrics.cacheHits}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cache Misses:</span>
                          <span className="font-semibold text-red-500">{realMetrics.cacheMisses}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Hit Rate:</span>
                          <span className="font-semibold">{(realMetrics.cacheHitRate * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Artifacts:</span>
                          <span className="font-semibold">{realMetrics.artifactsTotal}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Size:</span>
                          <span className="font-semibold">{(realMetrics.artifactsSizeBytes / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No metrics available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Runners Tab */}
          <TabsContent value="runners" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>CI/CD Runners</CardTitle>
                    <CardDescription>Runner configuration and status</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowAddRunner(true)} variant="outline" className="flex-shrink-0">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Runner
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {displayRunners.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No runners configured
                    </div>
                  ) : (
                    displayRunners.map((runner) => (
                      <Card key={runner.id} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className={`h-3 w-3 rounded-full flex-shrink-0 ${runner.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                              <div className="min-w-0 flex-1">
                                <CardTitle className="text-lg truncate">{runner.name}</CardTitle>
                                <CardDescription className="text-xs mt-1 break-words">
                                  {runner.executor} runner • {runner.currentJobs}/{runner.maxJobs} jobs
                                  {runner.tagList && runner.tagList.length > 0 && ` • Tags: ${runner.tagList.join(', ')}`}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>CI/CD Variables</CardTitle>
                    <CardDescription>Environment variables for pipelines</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowAddVariable(true)} variant="outline" className="flex-shrink-0">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Variable
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {displayVariables.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No variables configured
                    </div>
                  ) : (
                    displayVariables.map((variable) => (
                      <Card key={variable.key} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <CardTitle className="text-lg truncate">{variable.key}</CardTitle>
                              <CardDescription className="text-xs mt-1 break-words">
                                {variable.masked ? '••••••••' : variable.value}
                                {variable.environmentScope && ` • Scope: ${variable.environmentScope}`}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Environments</CardTitle>
                    <CardDescription>Deployment environments</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowAddEnvironment(true)} variant="outline" className="flex-shrink-0">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Environment
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {displayEnvironments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No environments configured
                    </div>
                  ) : (
                    displayEnvironments.map((environment) => (
                      <Card key={environment.id} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <CardTitle className="text-lg truncate">{environment.name}</CardTitle>
                              <CardDescription className="text-xs mt-1 break-words">
                                {environment.externalUrl || 'No external URL'}
                                {environment.deployments && ` • ${environment.deployments.length} deployments`}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Pipeline Schedules</CardTitle>
                    <CardDescription>Scheduled pipeline executions</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowAddSchedule(true)} variant="outline" className="flex-shrink-0">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Schedule
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {displaySchedules.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No schedules configured
                    </div>
                  ) : (
                    displaySchedules.map((schedule) => (
                      <Card key={schedule.id} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <CardTitle className="text-lg truncate">{schedule.description}</CardTitle>
                              <CardDescription className="text-xs mt-1 break-words">
                                Ref: {schedule.ref} • Cron: {schedule.cron}
                                {schedule.nextRunAt && ` • Next run: ${new Date(schedule.nextRunAt).toLocaleString()}`}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
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
                <div className="flex items-center justify-between mb-2">
                  <Label>Logs</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search in logs..."
                        value={logSearchQuery}
                        onChange={(e) => setLogSearchQuery(e.target.value)}
                        className="pl-8 w-48 h-8"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const logsText = jobLogs.join('\n');
                        const blob = new Blob([logsText], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `job-${selectedJob}-logs.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
                <div className="mt-2 p-4 bg-muted rounded-md font-mono text-sm max-h-96 overflow-y-auto">
                  {jobLogs
                    .filter(log => !logSearchQuery || log.toLowerCase().includes(logSearchQuery.toLowerCase()))
                    .map((log, idx) => {
                      // Simple syntax highlighting for common patterns
                      const isError = log.toLowerCase().includes('error') || log.toLowerCase().includes('failed');
                      const isWarning = log.toLowerCase().includes('warning') || log.toLowerCase().includes('warn');
                      const isCommand = log.startsWith('$ ') || log.startsWith('> ');
                      const isInfo = log.toLowerCase().includes('info') || log.toLowerCase().includes('success');
                      
                      let className = '';
                      if (isError) className = 'text-red-500';
                      else if (isWarning) className = 'text-yellow-500';
                      else if (isCommand) className = 'text-blue-500';
                      else if (isInfo) className = 'text-green-500';
                      
                      // Highlight search query
                      let displayLog = log;
                      if (logSearchQuery) {
                        const regex = new RegExp(`(${logSearchQuery})`, 'gi');
                        displayLog = log.replace(regex, '<mark class="bg-yellow-300 dark:bg-yellow-800">$1</mark>');
                      }
                      
                      return (
                        <div
                          key={idx}
                          className={className}
                          dangerouslySetInnerHTML={logSearchQuery ? { __html: displayLog } : undefined}
                        >
                          {!logSearchQuery && log}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
            {jobLogs.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No logs available for this job
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

      {/* YAML Import Dialog */}
      <Dialog open={showYamlImport} onOpenChange={setShowYamlImport}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import GitLab CI YAML</DialogTitle>
            <DialogDescription>Import pipeline configuration from .gitlab-ci.yml file</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>YAML Content</Label>
              <Textarea
                value={yamlContent}
                onChange={(e) => {
                  setYamlContent(e.target.value);
                  setYamlValidationError(null);
                }}
                placeholder="Paste .gitlab-ci.yml content here..."
                className="font-mono text-sm min-h-[300px]"
              />
              {yamlValidationError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                  <strong>Error:</strong> {yamlValidationError}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.yml,.yaml,.gitlab-ci.yml';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const content = event.target?.result as string;
                        setYamlContent(content);
                        setYamlValidationError(null);
                      };
                      reader.readAsText(file);
                    }
                  };
                  input.click();
                }}
              >
                <FileCode className="h-4 w-4 mr-2" />
                Load from File
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowYamlImport(false);
              setYamlContent('');
              setYamlValidationError(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!yamlContent.trim()) {
                  setYamlValidationError('YAML content is required');
                  return;
                }
                
                if (!gitlabCIEngine) {
                  setYamlValidationError('GitLab CI engine not available');
                  return;
                }
                
                try {
                  // Парсим YAML
                  const parsedConfig = gitlabCIEngine.parseGitLabCIYaml(yamlContent);
                  
                  if (!parsedConfig) {
                    setYamlValidationError('Failed to parse YAML. Please check the syntax.');
                    return;
                  }
                  
                  // Валидируем конфигурацию
                  const validation = validateGitLabCIConfig(parsedConfig);
                  
                  if (!validation.valid) {
                    const errors = validation.errors?.map(e => `${e.path}: ${e.message}`).join(', ') || 'Validation failed';
                    setYamlValidationError(`Validation errors: ${errors}`);
                    return;
                  }
                  
                  // Обновляем конфигурацию
                  const currentConfig = config;
                  const mergedConfig = {
                    ...currentConfig,
                    ...parsedConfig,
                    // Объединяем pipelines, variables и т.д.
                    pipelines: [...(currentConfig.pipelines || []), ...(parsedConfig.pipelines || [])],
                    variables: [...(currentConfig.variables || []), ...(parsedConfig.variables || [])],
                  };
                  
                  updateConfig(mergedConfig);
                  
                  setShowYamlImport(false);
                  setYamlContent('');
                  setYamlValidationError(null);
                  
                  toast({
                    title: "YAML imported",
                    description: "Pipeline configuration imported successfully",
                  });
                } catch (error) {
                  setYamlValidationError(error instanceof Error ? error.message : 'Failed to import YAML');
                }
              }}
            >
              Import
            </Button>
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
                onChange={(e) => {
                  const cron = e.target.value;
                  setNewScheduleCron(cron);
                  // Валидация cron в реальном времени
                  if (cron.trim()) {
                    const validation = validateCronExpression(cron);
                    if (!validation.valid) {
                      // Можно показать ошибку, но не блокируем ввод
                    }
                  }
                }}
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

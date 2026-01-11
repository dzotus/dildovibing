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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  Cpu,
  Database,
  Network,
  Zap,
  Code,
  FileText,
  HardDrive,
  Terminal,
  Download,
  Eye,
  X,
  Search,
  Filter,
  Layers,
  BarChart3,
  AlertTriangle
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface SparkConfigProps {
  componentId: string;
}

interface SparkJob {
  id: string;
  name: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'KILLED';
  startTime: number | string;
  endTime?: number | string;
  duration?: number;
  stages?: number;
  tasks?: number;
  executors?: number;
  inputBytes?: number;
  outputBytes?: number;
  shuffleRead?: number;
  shuffleWrite?: number;
  submissionTime?: number;
  completionTime?: number;
}

interface SparkStage {
  id: string;
  jobId: string;
  name: string;
  status: 'ACTIVE' | 'COMPLETE' | 'FAILED' | 'SKIPPED';
  numTasks: number;
  numActiveTasks: number;
  numCompleteTasks: number;
  numFailedTasks: number;
  inputBytes?: number;
  outputBytes?: number;
  shuffleRead?: number;
  shuffleWrite?: number;
  duration?: number;
  submissionTime?: number;
  completionTime?: number;
  // DAG dependencies
  parentStageIds?: string[];
  childStageIds?: string[];
  stageType?: 'map' | 'reduce' | 'shuffle' | 'action';
  // Shuffle network I/O and spill metrics
  shuffleNetworkRead?: number;
  shuffleNetworkWrite?: number;
  shuffleSpillMemory?: number;
  shuffleSpillDisk?: number;
  shuffleFetchWaitTime?: number;
}

interface Executor {
  id: string;
  host: string;
  status: 'ALIVE' | 'DEAD' | 'UNKNOWN';
  cores: number;
  memoryUsed: number;
  memoryMax: number;
  diskUsed: number;
  diskMax: number;
  activeTasks: number;
  totalTasks: number;
  totalInputBytes?: number;
  totalShuffleRead?: number;
  totalShuffleWrite?: number;
  startTime?: number;
  lastHeartbeat?: number;
}

interface SparkSQLQuery {
  id: string;
  query: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  executionTime?: number;
  rowsProcessed?: number;
  startTime?: number;
  endTime?: number;
  explainPlan?: string;
  physicalPlan?: string;
  logicalPlan?: string;
  stages?: string[];
  jobId?: string;
}

interface SparkStreamingJob {
  id: string;
  name: string;
  status: 'ACTIVE' | 'STOPPED' | 'FAILED';
  batchInterval: number;
  startTime: number;
  lastBatchTime?: number;
  nextBatchTime?: number;
  totalBatches: number;
  processedBatches: number;
  failedBatches: number;
  totalRecordsProcessed: number;
  averageProcessingTime: number;
  checkpointDirectory?: string;
  backpressureEnabled: boolean;
  currentBackpressure: number;
  jobId?: string;
}

interface SparkStorageLevel {
  id: string;
  rddId: string;
  name: string;
  storageLevel: 'MEMORY_ONLY' | 'MEMORY_AND_DISK' | 'DISK_ONLY' | 'MEMORY_ONLY_SER' | 'MEMORY_AND_DISK_SER';
  memorySize: number;
  diskSize: number;
  cached: boolean;
}

interface SparkConfig {
  jobs?: SparkJob[];
  stages?: SparkStage[];
  executors?: Executor[];
  totalJobs?: number;
  activeJobs?: number;
  totalExecutors?: number;
  totalCores?: number;
  totalMemory?: number;
  sparkMaster?: string;
  sparkAppName?: string;
  master?: string;
  appName?: string;
  driverMemory?: string;
  executorMemory?: string;
  executorCores?: number;
  enableDynamicAllocation?: boolean;
  minExecutors?: number;
  maxExecutors?: number;
  enableCheckpointing?: boolean;
  checkpointDirectory?: string;
  enableStreaming?: boolean;
  streamingBatchInterval?: number;
  sqlQueries?: SparkSQLQuery[];
  storageLevels?: SparkStorageLevel[];
  environment?: Record<string, string>;
}

export function SparkConfigAdvanced({ componentId }: SparkConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { getComponentMetrics, isRunning } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  // Get Spark emulation engine for real-time metrics
  const sparkEngine = emulationEngine.getSparkEmulationEngine(componentId);
  const componentMetrics = getComponentMetrics(componentId);
  const customMetrics = componentMetrics?.customMetrics || {};

  const config = (node.data.config as any) || {} as SparkConfig;
  
  // Get real-time data from emulation engine or fallback to config
  const engineJobs = sparkEngine ? sparkEngine.getJobs() : [];
  const engineStages = sparkEngine ? sparkEngine.getStages() : [];
  const engineExecutors = sparkEngine ? sparkEngine.getExecutors() : [];
  const sparkMetrics = sparkEngine ? sparkEngine.getMetrics() : null;

  // Use emulation data if available, otherwise use config
  const jobs = engineJobs.length > 0 ? engineJobs.map(j => ({
    ...j,
    startTime: typeof j.startTime === 'number' ? new Date(j.startTime).toISOString() : j.startTime,
    endTime: j.endTime ? (typeof j.endTime === 'number' ? new Date(j.endTime).toISOString() : j.endTime) : undefined,
  })) : (config.jobs || []);
  const stages = engineStages.length > 0 ? engineStages : (config.stages || []);
  const executors = engineExecutors.length > 0 ? engineExecutors : (config.executors || []);
  
  // Get metrics from emulation or config
  const totalJobs = sparkMetrics?.totalJobs ?? customMetrics.totalJobs ?? jobs.length;
  const activeJobs = sparkMetrics?.activeJobs ?? customMetrics.activeJobs ?? jobs.filter((j) => j.status === 'RUNNING').length;
  const totalExecutors = sparkMetrics?.totalExecutors ?? customMetrics.totalExecutors ?? executors.length;
  const aliveExecutors = sparkMetrics?.aliveExecutors ?? customMetrics.aliveExecutors ?? executors.filter((e) => e.status === 'ALIVE').length;
  const totalCores = sparkMetrics?.totalCores ?? customMetrics.totalCores ?? executors.reduce((sum, e) => sum + e.cores, 0);
  const totalMemory = sparkMetrics?.totalMemory ?? customMetrics.totalMemory ?? (executors.reduce((sum, e) => sum + e.memoryMax, 0) / 1024);
  const sparkMaster = config.master || config.sparkMaster || 'local[*]';
  const sparkAppName = config.appName || config.sparkAppName || 'archiphoenix-spark';

  const [selectedJob, setSelectedJob] = useState<string>('');
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [showCreateExecutor, setShowCreateExecutor] = useState(false);
  const [editingJob, setEditingJob] = useState<SparkJob | null>(null);
  const [editingExecutor, setEditingExecutor] = useState<Executor | null>(null);
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const [deleteExecutorId, setDeleteExecutorId] = useState<string | null>(null);
  const [jobSearch, setJobSearch] = useState('');
  const [executorSearch, setExecutorSearch] = useState('');
  const [selectedJobForStages, setSelectedJobForStages] = useState<string>('all');
  const [viewJobDetails, setViewJobDetails] = useState<SparkJob | null>(null);
  const [viewStageDetails, setViewStageDetails] = useState<SparkStage | null>(null);
  const [viewExecutorDetails, setViewExecutorDetails] = useState<Executor | null>(null);
  const [sqlQuery, setSqlQuery] = useState('');
  // Get SQL queries from emulation engine or config
  const engineSqlQueries = sparkEngine ? sparkEngine.getSQLQueries() : [];
  const [sqlQueries, setSqlQueries] = useState<SparkSQLQuery[]>(
    engineSqlQueries.length > 0 ? engineSqlQueries : (config.sqlQueries || [])
  );
  const [storageLevels, setStorageLevels] = useState<SparkStorageLevel[]>(config.storageLevels || []);
  const [editingEnvVar, setEditingEnvVar] = useState<{ key: string; value: string } | null>(null);
  const [customEnvVars, setCustomEnvVars] = useState<Record<string, string>>(config.environment || {});
  const [showAddEnvVar, setShowAddEnvVar] = useState(false);
  const [newEnvVarKey, setNewEnvVarKey] = useState('');
  const [newEnvVarValue, setNewEnvVarValue] = useState('');

  // Sync sqlQueries and storageLevels with config and emulation engine
  useEffect(() => {
    if (sparkEngine) {
      const engineQueries = sparkEngine.getSQLQueries();
      if (engineQueries.length > 0) {
        setSqlQueries(engineQueries);
      } else if (config.sqlQueries) {
        setSqlQueries(config.sqlQueries);
      }
    } else if (config.sqlQueries) {
      setSqlQueries(config.sqlQueries);
    }
    if (config.storageLevels) {
      setStorageLevels(config.storageLevels);
    }
  }, [config.sqlQueries, config.storageLevels, sparkEngine]);

  const updateConfig = (updates: Partial<SparkConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
    
    // Update emulation engine config if available
    if (sparkEngine) {
      const currentNode = nodes.find((n) => n.id === componentId);
      if (currentNode) {
        sparkEngine.updateConfig(currentNode);
      }
    }
  };

  // Sync data from emulation engine to config periodically
  useEffect(() => {
    if (!isRunning || !sparkEngine) return;
    
    const interval = setInterval(() => {
      const currentNode = nodes.find((n) => n.id === componentId);
      if (!currentNode) return;
      
      const engineJobs = sparkEngine.getJobs();
      const engineStages = sparkEngine.getStages();
      const engineExecutors = sparkEngine.getExecutors();
      const engineSqlQueries = sparkEngine.getSQLQueries();
      
      // Update SQL queries state
      if (engineSqlQueries.length > 0) {
        setSqlQueries(engineSqlQueries);
      }
      
      // Update config with emulation data
      updateNode(componentId, {
        data: {
          ...currentNode.data,
          config: {
            ...currentNode.data.config,
            jobs: engineJobs,
            stages: engineStages,
            executors: engineExecutors,
            sqlQueries: engineSqlQueries,
          },
        },
      });
    }, 2000); // Update every 2 seconds
    
    return () => clearInterval(interval);
  }, [isRunning, sparkEngine, componentId, nodes, updateNode]);

  // CRUD operations for Jobs
  const handleCreateJob = (jobData: Partial<SparkJob>) => {
    if (!jobData.name) {
      toast({
        title: 'Error',
        description: 'Job name is required',
        variant: 'destructive',
      });
      return;
    }

    const newJob: SparkJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: jobData.name || `Spark Job ${Date.now()}`,
      status: 'RUNNING',
      startTime: Date.now(),
      stages: jobData.stages || 3,
      tasks: jobData.tasks || 100,
      executors: aliveExecutors,
      inputBytes: 0,
      outputBytes: 0,
      shuffleRead: 0,
      shuffleWrite: 0,
      submissionTime: Date.now(),
    };

    if (sparkEngine) {
      sparkEngine.addJob(newJob);
    }

    const updatedJobs = [...jobs, newJob];
    updateConfig({ jobs: updatedJobs });
    
    toast({
      title: 'Success',
      description: 'Job created successfully',
    });
    
    setShowCreateJob(false);
  };

  const handleDeleteJob = (jobId: string) => {
    if (sparkEngine) {
      sparkEngine.removeJob(jobId);
    }

    const updatedJobs = jobs.filter((j) => j.id !== jobId);
    updateConfig({ jobs: updatedJobs });
    
    toast({
      title: 'Success',
      description: 'Job deleted successfully',
    });
    
    setDeleteJobId(null);
  };

  // CRUD operations for Executors
  const handleCreateExecutor = (executorData: Partial<Executor>) => {
    if (!executorData.id || !executorData.host) {
      toast({
        title: 'Error',
        description: 'Executor ID and host are required',
        variant: 'destructive',
      });
      return;
    }

    const executorMemory = config.executorMemory || '4g';
    const executorMemoryMB = parseMemory(executorMemory);
    const executorCores = config.executorCores || 2;

    const newExecutor: Executor = {
      id: executorData.id,
      host: executorData.host,
      status: 'ALIVE',
      cores: executorData.cores || executorCores,
      memoryUsed: executorMemoryMB * 0.3,
      memoryMax: executorMemoryMB,
      diskUsed: executorMemoryMB * 0.2,
      diskMax: executorMemoryMB * 2,
      activeTasks: 0,
      totalTasks: 0,
      totalInputBytes: 0,
      totalShuffleRead: 0,
      totalShuffleWrite: 0,
      startTime: Date.now(),
      lastHeartbeat: Date.now(),
    };

    if (sparkEngine) {
      sparkEngine.addExecutor(newExecutor);
    }

    const updatedExecutors = [...executors, newExecutor];
    updateConfig({ executors: updatedExecutors });
    
    toast({
      title: 'Success',
      description: 'Executor added successfully',
    });
    
    setShowCreateExecutor(false);
  };

  const handleDeleteExecutor = (executorId: string) => {
    if (sparkEngine) {
      sparkEngine.removeExecutor(executorId);
    }

    const updatedExecutors = executors.map((e) => 
      e.id === executorId ? { ...e, status: 'DEAD' as const } : e
    );
    updateConfig({ executors: updatedExecutors });
    
    toast({
      title: 'Success',
      description: 'Executor removed successfully',
    });
    
    setDeleteExecutorId(null);
  };

  const parseMemory = (memoryStr: string): number => {
    const match = memoryStr.match(/^(\d+)([kmg]?)$/i);
    if (!match) return 4096; // Default 4GB
    
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    
    switch (unit) {
      case 'k':
        return value / 1024; // KB to MB
      case 'm':
        return value; // MB
      case 'g':
        return value * 1024; // GB to MB
      default:
        return value; // Assume MB
    }
  };

  // Filtered lists
  const filteredJobs = useMemo(() => {
    if (!jobSearch) return jobs;
    return jobs.filter((j) => 
      j.name.toLowerCase().includes(jobSearch.toLowerCase()) ||
      j.id.toLowerCase().includes(jobSearch.toLowerCase())
    );
  }, [jobs, jobSearch]);

  const filteredExecutors = useMemo(() => {
    if (!executorSearch) return executors;
    return executors.filter((e) => 
      e.id.toLowerCase().includes(executorSearch.toLowerCase()) ||
      e.host.toLowerCase().includes(executorSearch.toLowerCase())
    );
  }, [executors, executorSearch]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING':
      case 'ACTIVE':
      case 'ALIVE':
        return 'bg-green-500';
      case 'SUCCEEDED':
      case 'COMPLETE':
        return 'bg-blue-500';
      case 'FAILED':
      case 'DEAD':
        return 'bg-red-500';
      case 'KILLED':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const formatDurationFromMs = (ms?: number) => {
    if (!ms) return '0s';
    return formatDuration(Math.floor(ms / 1000));
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Apache Spark</p>
            <h2 className="text-2xl font-bold text-foreground">Spark Application</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Unified analytics engine for large-scale data processing
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const currentNode = nodes.find((n) => n.id === componentId);
                if (currentNode && sparkEngine) {
                  sparkEngine.updateConfig(currentNode);
                }
                toast({
                  title: 'Refreshed',
                  description: 'Spark data refreshed',
                });
              }}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Jobs</CardTitle>
                <Activity className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalJobs}</span>
                <span className="text-xs text-muted-foreground">total</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{activeJobs} active</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Executors</CardTitle>
                <Cpu className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalExecutors}</span>
                <span className="text-xs text-muted-foreground">alive</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cores</CardTitle>
                <Zap className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{totalCores}</span>
                <span className="text-xs text-muted-foreground">total</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Memory</CardTitle>
                <Database className="h-4 w-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{(totalMemory / 1024).toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">GB</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Stages</CardTitle>
                <Network className="h-4 w-4 text-orange-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {sparkMetrics?.activeStages ?? stages.filter(s => s.status === 'ACTIVE').length}
                </span>
                <span className="text-xs text-muted-foreground">active</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {stages.length} total
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="jobs" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="jobs" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Jobs ({jobs.length})
            </TabsTrigger>
            <TabsTrigger value="stages" className="flex items-center gap-2">
              <Network className="h-4 w-4" />
              Stages ({stages.length})
            </TabsTrigger>
            <TabsTrigger value="executors" className="flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              Executors ({executors.length})
            </TabsTrigger>
            <TabsTrigger value="sql" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              SQL
            </TabsTrigger>
            <TabsTrigger value="streaming" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Streaming
            </TabsTrigger>
            <TabsTrigger value="timeline" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="storage" className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Storage
            </TabsTrigger>
            <TabsTrigger value="environment" className="flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              Environment
            </TabsTrigger>
            <TabsTrigger value="metrics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Metrics
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jobs" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Jobs</CardTitle>
                    <CardDescription>Spark application jobs</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateJob(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Job
                  </Button>
                </div>
                <div className="mt-4">
                  <Input
                    placeholder="Search jobs..."
                    value={jobSearch}
                    onChange={(e) => setJobSearch(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredJobs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {jobSearch ? 'No jobs found matching your search' : 'No jobs yet. Create one to get started.'}
                    </div>
                  ) : (
                    filteredJobs.map((job) => (
                    <Card key={job.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getStatusColor(job.status)}/20`}>
                              {job.status === 'RUNNING' ? (
                                <Play className="h-5 w-5 text-green-600 dark:text-green-400" />
                              ) : job.status === 'SUCCEEDED' ? (
                                <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                              )}
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{job.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className={getStatusColor(job.status)}>
                                  {job.status}
                                </Badge>
                                {job.duration && (
                                  <Badge variant="outline">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {formatDurationFromMs(job.duration)}
                                  </Badge>
                                )}
                                {job.stages && (
                                  <Badge variant="outline">{job.stages} stages</Badge>
                                )}
                                {job.tasks && (
                                  <Badge variant="outline">{job.tasks} tasks</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Input:</span>
                            <span className="ml-2 font-semibold">{formatBytes(job.inputBytes)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Output:</span>
                            <span className="ml-2 font-semibold">{formatBytes(job.outputBytes)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Shuffle Read:</span>
                            <span className="ml-2 font-semibold">{formatBytes(job.shuffleRead)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Shuffle Write:</span>
                            <span className="ml-2 font-semibold">{formatBytes(job.shuffleWrite)}</span>
                          </div>
                        </div>
                        {job.startTime && (
                          <div className="text-xs text-muted-foreground mt-2">
                            Started: {new Date(job.startTime).toLocaleString()}
                            {job.endTime && ` • Ended: ${new Date(job.endTime).toLocaleString()}`}
                          </div>
                        )}
                        <div className="flex gap-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewJobDetails(job)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteJobId(job.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stages" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Stages</CardTitle>
                    <CardDescription>Job execution stages</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={selectedJobForStages} onValueChange={setSelectedJobForStages}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Filter by job" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Jobs</SelectItem>
                        {jobs.map((job) => (
                          <SelectItem key={job.id} value={job.id}>
                            {job.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(() => {
                    const filteredStages = selectedJobForStages === 'all' 
                      ? stages 
                      : stages.filter(s => s.jobId === selectedJobForStages);
                    
                    // Group stages by job
                    const groupedStages = filteredStages.reduce((acc, stage) => {
                      if (!acc[stage.jobId]) {
                        acc[stage.jobId] = [];
                      }
                      acc[stage.jobId].push(stage);
                      return acc;
                    }, {} as Record<string, SparkStage[]>);
                    
                    const jobIds = Object.keys(groupedStages);
                    
                    if (jobIds.length === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          No stages found
                        </div>
                      );
                    }
                    
                    return (
                      <Accordion type="multiple" className="w-full">
                        {jobIds.map((jobId) => {
                          const jobStages = groupedStages[jobId];
                          const job = jobs.find(j => j.id === jobId);
                          return (
                            <AccordionItem key={jobId} value={jobId}>
                              <AccordionTrigger>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">{job?.name || jobId}</span>
                                  <Badge variant="outline">{jobStages.length} stages</Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-4 pt-2">
                                  {jobStages.map((stage) => {
                                    const taskProgress = stage.numTasks > 0 
                                      ? (stage.numCompleteTasks / stage.numTasks) * 100 
                                      : 0;
                                    const progressColor = stage.numFailedTasks > 0 
                                      ? 'bg-red-500' 
                                      : taskProgress === 100 
                                        ? 'bg-green-500' 
                                        : 'bg-yellow-500';
                                    
                                    return (
                                      <Card key={stage.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-card">
                                        <CardHeader className="pb-3">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-start gap-3">
                                              <div className={`p-2 rounded-lg ${getStatusColor(stage.status)}/20`}>
                                                {stage.status === 'COMPLETE' ? (
                                                  <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                                ) : stage.status === 'ACTIVE' ? (
                                                  <Play className="h-5 w-5 text-green-600 dark:text-green-400" />
                                                ) : (
                                                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                                )}
                                              </div>
                                              <div className="flex-1">
                                                <CardTitle className="text-lg font-semibold">{stage.name}</CardTitle>
                                                <div className="flex items-center gap-2 mt-2">
                                                  <Badge variant="outline" className={getStatusColor(stage.status)}>
                                                    {stage.status}
                                                  </Badge>
                                                  {stage.stageType && (
                                                    <Badge variant="outline" className="text-xs">
                                                      {stage.stageType}
                                                    </Badge>
                                                  )}
                                                  <Badge variant="outline">
                                                    {stage.numCompleteTasks}/{stage.numTasks} tasks
                                                  </Badge>
                                                  {stage.numFailedTasks > 0 && (
                                                    <Badge variant="outline" className="bg-red-500">
                                                      {stage.numFailedTasks} failed
                                                    </Badge>
                                                  )}
                                                  {stage.duration && (
                                                    <Badge variant="outline">
                                                      <Clock className="h-3 w-3 mr-1" />
                                                      {formatDurationFromMs(stage.duration)}
                                                    </Badge>
                                                  )}
                                                </div>
                                                <div className="mt-3">
                                                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                                    <span>Task Progress</span>
                                                    <span>{stage.numCompleteTasks}/{stage.numTasks} ({taskProgress.toFixed(0)}%)</span>
                                                  </div>
                                                  <Progress value={taskProgress} className="h-2" />
                                                </div>
                                              </div>
                                            </div>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => setViewStageDetails(stage)}
                                            >
                                              <Eye className="h-4 w-4 mr-2" />
                                              Details
                                            </Button>
                                          </div>
                                        </CardHeader>
                                        <CardContent>
                                          <div className="grid grid-cols-4 gap-4 text-sm">
                                            <div>
                                              <span className="text-muted-foreground">Input:</span>
                                              <span className="ml-2 font-semibold">{formatBytes(stage.inputBytes)}</span>
                                            </div>
                                            <div>
                                              <span className="text-muted-foreground">Output:</span>
                                              <span className="ml-2 font-semibold">{formatBytes(stage.outputBytes)}</span>
                                            </div>
                                            <div>
                                              <span className="text-muted-foreground">Shuffle Read:</span>
                                              <span className="ml-2 font-semibold">{formatBytes(stage.shuffleRead)}</span>
                                            </div>
                                            <div>
                                              <span className="text-muted-foreground">Shuffle Write:</span>
                                              <span className="ml-2 font-semibold">{formatBytes(stage.shuffleWrite)}</span>
                                            </div>
                                          </div>
                                          {(stage.shuffleRead && stage.shuffleRead > 0) || (stage.shuffleWrite && stage.shuffleWrite > 0) ? (
                                            <div className="mt-4 p-3 bg-muted rounded-lg">
                                              <div className="flex items-center gap-2 mb-2">
                                                <BarChart3 className="h-4 w-4" />
                                                <span className="font-semibold text-sm">Shuffle Operations</span>
                                              </div>
                                              <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                                                <div>
                                                  <span className="text-muted-foreground">Total Read:</span>
                                                  <span className="ml-2 font-semibold">{formatBytes(stage.shuffleRead)}</span>
                                                </div>
                                                <div>
                                                  <span className="text-muted-foreground">Total Write:</span>
                                                  <span className="ml-2 font-semibold">{formatBytes(stage.shuffleWrite)}</span>
                                                </div>
                                              </div>
                                              {(stage.shuffleNetworkRead && stage.shuffleNetworkRead > 0) || 
                                               (stage.shuffleSpillMemory && stage.shuffleSpillMemory > 0) ? (
                                                <div className="border-t pt-3 mt-3 space-y-2">
                                                  <div className="text-xs font-semibold text-muted-foreground mb-2">Network & Spill Metrics</div>
                                                  <div className="grid grid-cols-2 gap-4 text-xs">
                                                    {stage.shuffleNetworkRead && stage.shuffleNetworkRead > 0 && (
                                                      <div>
                                                        <span className="text-muted-foreground">Network Read:</span>
                                                        <span className="ml-2 font-semibold text-blue-600 dark:text-blue-400">
                                                          {formatBytes(stage.shuffleNetworkRead)}
                                                        </span>
                                                      </div>
                                                    )}
                                                    {stage.shuffleNetworkWrite && stage.shuffleNetworkWrite > 0 && (
                                                      <div>
                                                        <span className="text-muted-foreground">Network Write:</span>
                                                        <span className="ml-2 font-semibold text-blue-600 dark:text-blue-400">
                                                          {formatBytes(stage.shuffleNetworkWrite)}
                                                        </span>
                                                      </div>
                                                    )}
                                                    {stage.shuffleSpillMemory && stage.shuffleSpillMemory > 0 && (
                                                      <div>
                                                        <span className="text-muted-foreground">Memory Spill:</span>
                                                        <span className="ml-2 font-semibold text-orange-600 dark:text-orange-400">
                                                          {formatBytes(stage.shuffleSpillMemory)}
                                                        </span>
                                                      </div>
                                                    )}
                                                    {stage.shuffleSpillDisk && stage.shuffleSpillDisk > 0 && (
                                                      <div>
                                                        <span className="text-muted-foreground">Disk Spill:</span>
                                                        <span className="ml-2 font-semibold text-orange-600 dark:text-orange-400">
                                                          {formatBytes(stage.shuffleSpillDisk)}
                                                        </span>
                                                      </div>
                                                    )}
                                                    {stage.shuffleFetchWaitTime && stage.shuffleFetchWaitTime > 0 && (
                                                      <div>
                                                        <span className="text-muted-foreground">Fetch Wait:</span>
                                                        <span className="ml-2 font-semibold">
                                                          {stage.shuffleFetchWaitTime.toFixed(0)}ms
                                                        </span>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              ) : null}
                                              {stage.shuffleRead && stage.shuffleRead > 104857600 && (
                                                <div className="mt-2 flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-400">
                                                  <AlertTriangle className="h-3 w-3" />
                                                  Large shuffle operation detected
                                                </div>
                                              )}
                                              {stage.shuffleSpillMemory && stage.shuffleSpillMemory > 0 && (
                                                <div className="mt-2 flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400">
                                                  <AlertTriangle className="h-3 w-3" />
                                                  Memory spill detected - consider increasing executor memory
                                                </div>
                                              )}
                                            </div>
                                          ) : null}
                                        </CardContent>
                                      </Card>
                                    );
                                  })}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="executors" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Executors</CardTitle>
                    <CardDescription>Spark executor nodes</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateExecutor(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Executor
                  </Button>
                </div>
                <div className="mt-4">
                  <Input
                    placeholder="Search executors..."
                    value={executorSearch}
                    onChange={(e) => setExecutorSearch(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredExecutors.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {executorSearch ? 'No executors found matching your search' : 'No executors yet. Add one to get started.'}
                    </div>
                  ) : (
                    filteredExecutors.map((executor) => (
                      <Card key={executor.id} className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow bg-card">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${getStatusColor(executor.status)}/20`}>
                                <Cpu className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                              </div>
                              <div>
                                <CardTitle className="text-lg font-semibold">{executor.id}</CardTitle>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="outline" className={getStatusColor(executor.status)}>
                                    {executor.status}
                                  </Badge>
                                  <Badge variant="outline">{executor.host}</Badge>
                                  <Badge variant="outline">{executor.cores} cores</Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Memory:</span>
                              <span className="ml-2 font-semibold">
                                {(executor.memoryUsed / 1024).toFixed(1)} / {(executor.memoryMax / 1024).toFixed(1)} GB
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Disk:</span>
                              <span className="ml-2 font-semibold">
                                {(executor.diskUsed / 1024).toFixed(1)} / {(executor.diskMax / 1024).toFixed(1)} GB
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Tasks:</span>
                              <span className="ml-2 font-semibold">
                                {executor.activeTasks} active / {executor.totalTasks} total
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Shuffle:</span>
                              <span className="ml-2 font-semibold">
                                R: {formatBytes(executor.totalShuffleRead)} W: {formatBytes(executor.totalShuffleWrite)}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setViewExecutorDetails(executor)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteExecutorId(executor.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sql" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>SQL Queries</CardTitle>
                <CardDescription>Execute and monitor SQL queries</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>SQL Query</Label>
                  <Textarea
                    placeholder="SELECT * FROM table WHERE condition..."
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    className="min-h-[120px] font-mono text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        if (!sqlQuery.trim()) {
                          toast({
                            title: 'Error',
                            description: 'Please enter a SQL query',
                            variant: 'destructive',
                          });
                          return;
                        }
                        
                        // Execute query through SparkEmulationEngine
                        if (sparkEngine) {
                          const newQuery = sparkEngine.executeSQL(sqlQuery, Date.now());
                          const updatedQueries = [newQuery, ...sqlQueries];
                          setSqlQueries(updatedQueries);
                          updateConfig({ sqlQueries: updatedQueries });
                          setSqlQuery('');
                          toast({
                            title: 'Query submitted',
                            description: 'SQL query is being executed',
                          });
                        } else {
                          // Fallback if engine not available
                          const newQuery: SparkSQLQuery = {
                            id: `query-${Date.now()}`,
                            query: sqlQuery,
                            status: 'RUNNING',
                            startTime: Date.now(),
                            rowsProcessed: 0,
                          };
                          const updatedQueries = [newQuery, ...sqlQueries];
                          setSqlQueries(updatedQueries);
                          updateConfig({ sqlQueries: updatedQueries });
                          setSqlQuery('');
                          toast({
                            title: 'Query submitted',
                            description: 'SQL query is being executed',
                          });
                        }
                      }}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Execute Query
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setSqlQuery('')}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <CardTitle className="text-lg">Query History</CardTitle>
                    <Badge variant="outline">{sqlQueries.length} queries</Badge>
                  </div>
                  <div className="space-y-3">
                    {sqlQueries.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No queries executed yet
                      </div>
                    ) : (
                      sqlQueries.map((query) => (
                        <Card key={query.id} className="border-l-4 border-l-blue-500">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={getStatusColor(query.status)}>
                                  {query.status}
                                </Badge>
                                {query.executionTime && (
                                  <Badge variant="outline">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {query.executionTime.toFixed(0)}ms
                                  </Badge>
                                )}
                                {query.rowsProcessed !== undefined && (
                                  <Badge variant="outline">
                                    {query.rowsProcessed.toLocaleString()} rows
                                  </Badge>
                                )}
                              </div>
                              {query.startTime && (
                                <span className="text-xs text-muted-foreground">
                                  {new Date(query.startTime).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                              <pre className="whitespace-pre-wrap">{query.query}</pre>
                            </div>
                            {(query.explainPlan || query.physicalPlan || query.logicalPlan) && (
                              <div className="mt-3 space-y-3">
                                {query.logicalPlan && (
                                  <div>
                                    <Label className="text-sm font-semibold">Logical Plan</Label>
                                    <div className="bg-muted p-3 rounded-lg font-mono text-xs mt-1">
                                      <pre className="whitespace-pre-wrap">{query.logicalPlan}</pre>
                                    </div>
                                  </div>
                                )}
                                {query.physicalPlan && (
                                  <div>
                                    <Label className="text-sm font-semibold">Physical Plan</Label>
                                    <div className="bg-muted p-3 rounded-lg font-mono text-xs mt-1">
                                      <pre className="whitespace-pre-wrap">{query.physicalPlan}</pre>
                                    </div>
                                  </div>
                                )}
                                {query.explainPlan && (
                                  <div>
                                    <Label className="text-sm font-semibold">Explain Plan</Label>
                                    <div className="bg-muted p-3 rounded-lg font-mono text-xs mt-1">
                                      <pre className="whitespace-pre-wrap">{query.explainPlan}</pre>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="streaming" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Streaming Jobs</CardTitle>
                    <CardDescription>Real-time data processing with Spark Streaming</CardDescription>
                  </div>
                  {config.enableStreaming && (
                    <Button
                      size="sm"
                      onClick={() => {
                        if (sparkEngine) {
                          const batchInterval = config.streamingBatchInterval || 1000;
                          sparkEngine.createStreamingJob(`Streaming Job ${Date.now()}`, batchInterval, Date.now());
                          toast({
                            title: 'Streaming job created',
                            description: 'New streaming job has been started',
                          });
                        }
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Streaming Job
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!config.enableStreaming ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Streaming is disabled. Enable it in Settings tab to start streaming jobs.</p>
                  </div>
                ) : (() => {
                  const streamingJobs = sparkEngine ? sparkEngine.getStreamingJobs() : [];
                  
                  if (streamingJobs.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        No streaming jobs yet. Create one to get started.
                      </div>
                    );
                  }
                  
                  return (
                    <div className="space-y-4">
                      {streamingJobs.map((streamingJob) => {
                        const successRate = streamingJob.totalBatches > 0
                          ? ((streamingJob.processedBatches / streamingJob.totalBatches) * 100).toFixed(1)
                          : '0';
                        const backpressureColor = streamingJob.currentBackpressure > 0.7
                          ? 'text-red-600 dark:text-red-400'
                          : streamingJob.currentBackpressure > 0.4
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-green-600 dark:text-green-400';
                        
                        return (
                          <Card key={streamingJob.id} className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow bg-card">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-start gap-3">
                                  <div className={`p-2 rounded-lg ${getStatusColor(streamingJob.status)}/20`}>
                                    {streamingJob.status === 'ACTIVE' ? (
                                      <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                    ) : (
                                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                    )}
                                  </div>
                                  <div>
                                    <CardTitle className="text-lg font-semibold">{streamingJob.name}</CardTitle>
                                    <div className="flex items-center gap-2 mt-2">
                                      <Badge variant="outline" className={getStatusColor(streamingJob.status)}>
                                        {streamingJob.status}
                                      </Badge>
                                      <Badge variant="outline">
                                        Batch: {streamingJob.batchInterval}ms
                                      </Badge>
                                      <Badge variant="outline">
                                        {streamingJob.totalBatches} batches
                                      </Badge>
                                      {streamingJob.backpressureEnabled && (
                                        <Badge variant="outline" className={backpressureColor}>
                                          Backpressure: {(streamingJob.currentBackpressure * 100).toFixed(0)}%
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {streamingJob.status === 'ACTIVE' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      if (sparkEngine) {
                                        sparkEngine.stopStreamingJob(streamingJob.id);
                                        toast({
                                          title: 'Streaming job stopped',
                                          description: 'The streaming job has been stopped',
                                        });
                                      }
                                    }}
                                  >
                                    <Pause className="h-4 w-4 mr-2" />
                                    Stop
                                  </Button>
                                )}
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-4 gap-4 text-sm mb-4">
                                <div>
                                  <span className="text-muted-foreground">Processed Batches:</span>
                                  <span className="ml-2 font-semibold">{streamingJob.processedBatches}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Failed Batches:</span>
                                  <span className="ml-2 font-semibold text-red-600 dark:text-red-400">
                                    {streamingJob.failedBatches}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Success Rate:</span>
                                  <span className="ml-2 font-semibold">{successRate}%</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Records Processed:</span>
                                  <span className="ml-2 font-semibold">
                                    {streamingJob.totalRecordsProcessed.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                                <div>
                                  <span className="text-muted-foreground">Avg Processing Time:</span>
                                  <span className="ml-2 font-semibold">
                                    {streamingJob.averageProcessingTime.toFixed(0)}ms
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Next Batch:</span>
                                  <span className="ml-2 font-semibold">
                                    {streamingJob.nextBatchTime 
                                      ? new Date(streamingJob.nextBatchTime).toLocaleTimeString()
                                      : 'N/A'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Checkpoint Dir:</span>
                                  <span className="ml-2 font-semibold text-xs">
                                    {streamingJob.checkpointDirectory || '/checkpoint'}
                                  </span>
                                </div>
                              </div>
                              {streamingJob.currentBackpressure > 0.5 && (
                                <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded text-xs text-yellow-800 dark:text-yellow-200">
                                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                                  High backpressure detected. Consider increasing batch interval or reducing processing time.
                                </div>
                              )}
                              {streamingJob.jobId && (
                                <div className="mt-3">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const job = sparkEngine?.getJob(streamingJob.jobId!);
                                      if (job) {
                                        setViewJobDetails(job);
                                      }
                                    }}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Latest Batch Job
                                  </Button>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Timeline View</CardTitle>
                <CardDescription>Job and stage execution timeline with metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Job Execution Timeline */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Job Execution Timeline</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart
                      data={useMemo(() => {
                        const now = Date.now();
                        const timeWindow = 3600000; // 1 hour
                        const timePoints = 20;
                        const interval = timeWindow / timePoints;
                        
                        const timelineData = [];
                        for (let i = 0; i <= timePoints; i++) {
                          const timestamp = now - (timeWindow - i * interval);
                          const timeLabel = new Date(timestamp).toLocaleTimeString();
                          
                          // Count jobs at this point in time
                          const runningJobs = jobs.filter(j => {
                            const start = typeof j.startTime === 'string' 
                              ? new Date(j.startTime).getTime() 
                              : (typeof j.startTime === 'number' ? j.startTime : 0);
                            const end = j.endTime 
                              ? (typeof j.endTime === 'string' 
                                ? new Date(j.endTime).getTime() 
                                : (typeof j.endTime === 'number' ? j.endTime : Infinity))
                              : Infinity;
                            return start <= timestamp && (end >= timestamp || !j.endTime);
                          }).length;
                          
                          const succeededJobs = jobs.filter(j => {
                            const end = j.endTime 
                              ? (typeof j.endTime === 'string' 
                                ? new Date(j.endTime).getTime() 
                                : (typeof j.endTime === 'number' ? j.endTime : 0))
                              : 0;
                            return j.status === 'SUCCEEDED' && end > 0 && end <= timestamp;
                          }).length;
                          
                          const failedJobs = jobs.filter(j => {
                            const end = j.endTime 
                              ? (typeof j.endTime === 'string' 
                                ? new Date(j.endTime).getTime() 
                                : (typeof j.endTime === 'number' ? j.endTime : 0))
                              : 0;
                            return j.status === 'FAILED' && end > 0 && end <= timestamp;
                          }).length;
                          
                          timelineData.push({
                            time: timeLabel,
                            timestamp,
                            running: runningJobs,
                            succeeded: succeededJobs,
                            failed: failedJobs,
                            total: runningJobs + succeededJobs + failedJobs
                          });
                        }
                        return timelineData;
                      }, [jobs])}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="time" 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '4px'
                        }}
                      />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="running" 
                        stackId="1"
                        stroke="hsl(142 76% 36%)" 
                        fill="hsl(142 76% 36%)"
                        fillOpacity={0.6}
                        name="Running"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="succeeded" 
                        stackId="1"
                        stroke="hsl(217 91% 60%)" 
                        fill="hsl(217 91% 60%)"
                        fillOpacity={0.6}
                        name="Succeeded"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="failed" 
                        stackId="1"
                        stroke="hsl(0 84% 60%)" 
                        fill="hsl(0 84% 60%)"
                        fillOpacity={0.6}
                        name="Failed"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Stage Execution Timeline */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Stage Execution Timeline</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={useMemo(() => {
                        const now = Date.now();
                        const timeWindow = 3600000; // 1 hour
                        const timePoints = 20;
                        const interval = timeWindow / timePoints;
                        
                        const timelineData = [];
                        for (let i = 0; i <= timePoints; i++) {
                          const timestamp = now - (timeWindow - i * interval);
                          const timeLabel = new Date(timestamp).toLocaleTimeString();
                          
                          const activeStages = stages.filter(s => {
                            const start = s.submissionTime || 0;
                            const end = s.completionTime || Infinity;
                            return s.status === 'ACTIVE' && start <= timestamp && end >= timestamp;
                          }).length;
                          
                          const completeStages = stages.filter(s => {
                            const end = s.completionTime || 0;
                            return s.status === 'COMPLETE' && end > 0 && end <= timestamp;
                          }).length;
                          
                          timelineData.push({
                            time: timeLabel,
                            timestamp,
                            active: activeStages,
                            complete: completeStages
                          });
                        }
                        return timelineData;
                      }, [stages])}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="time" 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '4px'
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="active" 
                        stroke="hsl(142 76% 36%)" 
                        strokeWidth={2}
                        name="Active Stages"
                        dot={{ r: 3 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="complete" 
                        stroke="hsl(217 91% 60%)" 
                        strokeWidth={2}
                        name="Complete Stages"
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Metrics Over Time */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Metrics Over Time</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={useMemo(() => {
                        const now = Date.now();
                        const timeWindow = 3600000; // 1 hour
                        const timePoints = 20;
                        const interval = timeWindow / timePoints;
                        
                        const timelineData = [];
                        for (let i = 0; i <= timePoints; i++) {
                          const timestamp = now - (timeWindow - i * interval);
                          const timeLabel = new Date(timestamp).toLocaleTimeString();
                          
                          // Calculate throughput and latency at this point
                          const jobsAtTime = jobs.filter(j => {
                            const start = typeof j.startTime === 'string' 
                              ? new Date(j.startTime).getTime() 
                              : (typeof j.startTime === 'number' ? j.startTime : 0);
                            const end = j.endTime 
                              ? (typeof j.endTime === 'string' 
                                ? new Date(j.endTime).getTime() 
                                : (typeof j.endTime === 'number' ? j.endTime : Infinity))
                              : Infinity;
                            return start <= timestamp && (end >= timestamp || !j.endTime);
                          });
                          
                          const totalInputBytes = jobsAtTime.reduce((sum, j) => sum + (j.inputBytes || 0), 0);
                          const totalOutputBytes = jobsAtTime.reduce((sum, j) => sum + (j.outputBytes || 0), 0);
                          const throughput = (totalInputBytes + totalOutputBytes) / 3600; // bytes per second
                          
                          const avgDuration = jobsAtTime.length > 0
                            ? jobsAtTime.reduce((sum, j) => {
                                const duration = j.duration || 0;
                                return sum + duration;
                              }, 0) / jobsAtTime.length
                            : 0;
                          
                          timelineData.push({
                            time: timeLabel,
                            timestamp,
                            throughput: throughput / 1024 / 1024, // Convert to MB/s
                            latency: avgDuration / 1000 // Convert to seconds
                          });
                        }
                        return timelineData;
                      }, [jobs])}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="time" 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis 
                        yAxisId="left"
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 10 }}
                        label={{ value: 'Throughput (MB/s)', angle: -90, position: 'insideLeft' }}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 10 }}
                        label={{ value: 'Latency (s)', angle: 90, position: 'insideRight' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '4px'
                        }}
                      />
                      <Legend />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="throughput" 
                        stroke="hsl(217 91% 60%)" 
                        strokeWidth={2}
                        name="Throughput (MB/s)"
                        dot={{ r: 3 }}
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="latency" 
                        stroke="hsl(142 76% 36%)" 
                        strokeWidth={2}
                        name="Avg Latency (s)"
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Event Timeline */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Event Timeline</h3>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {useMemo(() => {
                          const events: Array<{
                            id: string;
                            type: 'job' | 'stage' | 'executor';
                            event: 'submission' | 'start' | 'completion' | 'added' | 'heartbeat' | 'removed' | 'failed';
                            timestamp: number;
                            name: string;
                            status?: string;
                          }> = [];
                          
                          // Job events
                          jobs.forEach(job => {
                            const submissionTime = job.submissionTime || (typeof job.startTime === 'string' 
                              ? new Date(job.startTime).getTime() 
                              : (typeof job.startTime === 'number' ? job.startTime : Date.now()));
                            const startTime = typeof job.startTime === 'string' 
                              ? new Date(job.startTime).getTime() 
                              : (typeof job.startTime === 'number' ? job.startTime : Date.now());
                            const completionTime = job.completionTime || (job.endTime 
                              ? (typeof job.endTime === 'string' 
                                ? new Date(job.endTime).getTime() 
                                : (typeof job.endTime === 'number' ? job.endTime : 0))
                              : 0);
                            
                            events.push({
                              id: `${job.id}-submission`,
                              type: 'job',
                              event: 'submission',
                              timestamp: submissionTime,
                              name: job.name,
                              status: job.status
                            });
                            
                            if (startTime !== submissionTime) {
                              events.push({
                                id: `${job.id}-start`,
                                type: 'job',
                                event: 'start',
                                timestamp: startTime,
                                name: job.name,
                                status: job.status
                              });
                            }
                            
                            if (completionTime > 0) {
                              events.push({
                                id: `${job.id}-completion`,
                                type: 'job',
                                event: job.status === 'FAILED' ? 'failed' : 'completion',
                                timestamp: completionTime,
                                name: job.name,
                                status: job.status
                              });
                            }
                          });
                          
                          // Stage events
                          stages.forEach(stage => {
                            const submissionTime = stage.submissionTime || 0;
                            const completionTime = stage.completionTime || 0;
                            
                            if (submissionTime > 0) {
                              events.push({
                                id: `${stage.id}-submission`,
                                type: 'stage',
                                event: 'submission',
                                timestamp: submissionTime,
                                name: stage.name,
                                status: stage.status
                              });
                            }
                            
                            if (completionTime > 0 && completionTime !== submissionTime) {
                              events.push({
                                id: `${stage.id}-completion`,
                                type: 'stage',
                                event: stage.status === 'FAILED' ? 'failed' : 'completion',
                                timestamp: completionTime,
                                name: stage.name,
                                status: stage.status
                              });
                            }
                          });
                          
                          // Executor events
                          executors.forEach(executor => {
                            const startTime = executor.startTime || Date.now();
                            const lastHeartbeat = executor.lastHeartbeat || Date.now();
                            
                            events.push({
                              id: `${executor.id}-added`,
                              type: 'executor',
                              event: 'added',
                              timestamp: startTime,
                              name: executor.id,
                              status: executor.status
                            });
                            
                            if (lastHeartbeat > startTime) {
                              events.push({
                                id: `${executor.id}-heartbeat`,
                                type: 'executor',
                                event: 'heartbeat',
                                timestamp: lastHeartbeat,
                                name: executor.id,
                                status: executor.status
                              });
                            }
                            
                            if (executor.status === 'DEAD') {
                              events.push({
                                id: `${executor.id}-removed`,
                                type: 'executor',
                                event: 'removed',
                                timestamp: lastHeartbeat + 30000, // Assume removed 30s after last heartbeat
                                name: executor.id,
                                status: executor.status
                              });
                            }
                          });
                          
                          // Sort by timestamp (most recent first)
                          events.sort((a, b) => b.timestamp - a.timestamp);
                          
                          return events.slice(0, 50); // Show last 50 events
                        }, [jobs, stages, executors]).map((event) => {
                          const eventIcon = event.type === 'job' 
                            ? <Activity className="h-4 w-4" />
                            : event.type === 'stage'
                            ? <Network className="h-4 w-4" />
                            : <Cpu className="h-4 w-4" />;
                          
                          const eventColor = event.event === 'failed' || event.event === 'removed'
                            ? 'text-red-600 dark:text-red-400'
                            : event.event === 'completion' || event.event === 'start'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-blue-600 dark:text-blue-400';
                          
                          return (
                            <div key={event.id} className="flex items-start gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                              <div className={`mt-0.5 ${eventColor}`}>
                                {eventIcon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm">{event.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {event.type}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {event.event}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {new Date(event.timestamp).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="storage" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Storage & Cache</CardTitle>
                    <CardDescription>RDD persistence and cache management</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newRdd: SparkStorageLevel = {
                          id: `rdd-${Date.now()}`,
                          rddId: `rdd-${Date.now()}`,
                          name: `RDD ${storageLevels.length + 1}`,
                          storageLevel: 'MEMORY_AND_DISK',
                          memorySize: Math.floor(Math.random() * 100 * 1024 * 1024), // Random 0-100 MB
                          diskSize: Math.floor(Math.random() * 200 * 1024 * 1024), // Random 0-200 MB
                          cached: true
                        };
                        const updated = [...storageLevels, newRdd];
                        setStorageLevels(updated);
                        updateConfig({ storageLevels: updated });
                        toast({
                          title: 'RDD persisted',
                          description: 'New RDD has been persisted to cache',
                        });
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Persist RDD
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStorageLevels([]);
                        updateConfig({ storageLevels: [] });
                        toast({
                          title: 'Cache cleared',
                          description: 'All cached RDDs have been cleared',
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear Cache
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {storageLevels.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No cached RDDs
                    </div>
                  ) : (
                    storageLevels.map((level) => (
                      <Card key={level.id} className="border-l-4 border-l-cyan-500">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-lg">{level.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline">{level.storageLevel}</Badge>
                                <Badge variant="outline">{level.rddId}</Badge>
                                {level.cached && (
                                  <Badge variant="outline" className="bg-green-500">
                                    Cached
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {level.cached ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const updated = storageLevels.map(l => 
                                      l.id === level.id ? { ...l, cached: false } : l
                                    );
                                    setStorageLevels(updated);
                                    updateConfig({ storageLevels: updated });
                                    toast({
                                      title: 'RDD unpersisted',
                                      description: `${level.name} has been unpersisted from cache`,
                                    });
                                  }}
                                >
                                  Unpersist
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const updated = storageLevels.map(l => 
                                      l.id === level.id ? { ...l, cached: true } : l
                                    );
                                    setStorageLevels(updated);
                                    updateConfig({ storageLevels: updated });
                                    toast({
                                      title: 'RDD persisted',
                                      description: `${level.name} has been persisted to cache`,
                                    });
                                  }}
                                >
                                  Persist
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const updated = storageLevels.filter(l => l.id !== level.id);
                                  setStorageLevels(updated);
                                  updateConfig({ storageLevels: updated });
                                  toast({
                                    title: 'RDD removed',
                                    description: `${level.name} has been removed`,
                                  });
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                            <div>
                              <span className="text-muted-foreground">Memory Size:</span>
                              <span className="ml-2 font-semibold">{formatBytes(level.memorySize)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Disk Size:</span>
                              <span className="ml-2 font-semibold">{formatBytes(level.diskSize)}</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="text-xs text-muted-foreground">
                              Storage Level: {level.storageLevel}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              RDD ID: {level.rddId}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
                <Separator className="my-4" />
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Cache Statistics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Cached RDDs:</span>
                          <span className="ml-2 font-semibold">{storageLevels.filter(l => l.cached).length}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total Memory:</span>
                          <span className="ml-2 font-semibold">
                            {formatBytes(storageLevels.reduce((sum, l) => sum + l.memorySize, 0))}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total Disk:</span>
                          <span className="ml-2 font-semibold">
                            {formatBytes(storageLevels.reduce((sum, l) => sum + l.diskSize, 0))}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Block Manager Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Block Manager</CardTitle>
                      <CardDescription>Block storage and memory management</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div>
                          <span className="text-muted-foreground">Total Blocks:</span>
                          <span className="ml-2 font-semibold">{storageLevels.length}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Memory Blocks:</span>
                          <span className="ml-2 font-semibold">
                            {storageLevels.filter(l => l.storageLevel.includes('MEMORY')).length}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Disk Blocks:</span>
                          <span className="ml-2 font-semibold">
                            {storageLevels.filter(l => l.storageLevel.includes('DISK')).length}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Memory Usage:</span>
                          <span className="ml-2 font-semibold">
                            {(() => {
                              const totalMemory = executors.reduce((sum, e) => sum + e.memoryMax, 0);
                              const usedMemory = storageLevels.reduce((sum, l) => sum + l.memorySize, 0);
                              return `${((usedMemory / totalMemory) * 100).toFixed(1)}%`;
                            })()}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">
                          Block Locations: Distributed across {executors.length} executors
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Memory Capacity: {formatBytes(executors.reduce((sum, e) => sum + e.memoryMax, 0))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Disk Capacity: {formatBytes(executors.reduce((sum, e) => sum + e.diskMax, 0))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Memory/Disk Usage Over Time */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Storage Usage Over Time</CardTitle>
                      <CardDescription>Memory and disk usage trends</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart
                          data={useMemo(() => {
                            const now = Date.now();
                            const timeWindow = 3600000; // 1 hour
                            const timePoints = 15;
                            const interval = timeWindow / timePoints;
                            
                            const timelineData = [];
                            for (let i = 0; i <= timePoints; i++) {
                              const timestamp = now - (timeWindow - i * interval);
                              const timeLabel = new Date(timestamp).toLocaleString('en-US', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              });
                              
                              // Simulate storage usage over time (in real implementation, this would come from history)
                              const baseMemory = storageLevels.reduce((sum, l) => sum + l.memorySize, 0);
                              const baseDisk = storageLevels.reduce((sum, l) => sum + l.diskSize, 0);
                              const totalMemory = executors.reduce((sum, e) => sum + e.memoryMax, 0);
                              const totalDisk = executors.reduce((sum, e) => sum + e.diskMax, 0);
                              
                              // Add some variation to simulate usage changes
                              const memoryVariation = 1 + (Math.sin(i / timePoints * Math.PI * 2) * 0.1);
                              const diskVariation = 1 + (Math.cos(i / timePoints * Math.PI * 2) * 0.1);
                              
                              timelineData.push({
                                time: timeLabel,
                                memory: (baseMemory * memoryVariation / totalMemory) * 100,
                                disk: (baseDisk * diskVariation / totalDisk) * 100
                              });
                            }
                            return timelineData;
                          }, [storageLevels, executors])}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis 
                            dataKey="time" 
                            stroke="hsl(var(--muted-foreground))"
                            tick={{ fontSize: 10 }}
                          />
                          <YAxis 
                            stroke="hsl(var(--muted-foreground))"
                            tick={{ fontSize: 10 }}
                            domain={[0, 100]}
                            label={{ value: 'Usage %', angle: -90, position: 'insideLeft' }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '4px'
                            }}
                          />
                          <Legend />
                          <Area 
                            type="monotone" 
                            dataKey="memory" 
                            stroke="hsl(217 91% 60%)" 
                            fill="hsl(217 91% 60%)"
                            fillOpacity={0.6}
                            name="Memory Usage %"
                          />
                          <Area 
                            type="monotone" 
                            dataKey="disk" 
                            stroke="hsl(142 76% 36%)" 
                            fill="hsl(142 76% 36%)"
                            fillOpacity={0.6}
                            name="Disk Usage %"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  
                  {/* Storage Level Breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Storage Level Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {['MEMORY_ONLY', 'MEMORY_AND_DISK', 'DISK_ONLY', 'MEMORY_ONLY_SER', 'MEMORY_AND_DISK_SER'].map((level) => {
                          const levels = storageLevels.filter(l => l.storageLevel === level);
                          if (levels.length === 0) return null;
                          
                          const totalMemory = levels.reduce((sum, l) => sum + l.memorySize, 0);
                          const totalDisk = levels.reduce((sum, l) => sum + l.diskSize, 0);
                          
                          return (
                            <div key={level} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <div>
                                <span className="font-semibold text-sm">{level}</span>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {levels.length} RDDs
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm">
                                  Memory: {formatBytes(totalMemory)}
                                </div>
                                <div className="text-sm">
                                  Disk: {formatBytes(totalDisk)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="environment" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Environment Variables</CardTitle>
                    <CardDescription>System and Spark configuration</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddEnvVar(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Variable
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const envData = {
                          SPARK_HOME: config.sparkMaster || '/opt/spark',
                          JAVA_HOME: '/usr/lib/jvm/java-8-openjdk',
                          PYSPARK_PYTHON: '/usr/bin/python3',
                          SPARK_MASTER: config.master || config.sparkMaster || 'local[*]',
                          SPARK_APP_NAME: config.appName || config.sparkAppName || 'archiphoenix-spark',
                          SPARK_DRIVER_MEMORY: config.driverMemory || '2g',
                          SPARK_EXECUTOR_MEMORY: config.executorMemory || '4g',
                          SPARK_EXECUTOR_CORES: String(config.executorCores || 2),
                          ...customEnvVars,
                        };
                        const blob = new Blob([JSON.stringify(envData, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'spark-environment.json';
                        a.click();
                        URL.revokeObjectURL(url);
                        toast({
                          title: 'Exported',
                          description: 'Environment configuration exported',
                        });
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export Environment
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <CardTitle className="text-sm">System Variables</CardTitle>
                  </div>
                  <div className="space-y-2">
                    {[
                      { key: 'SPARK_HOME', value: config.sparkMaster || '/opt/spark', editable: false },
                      { key: 'JAVA_HOME', value: '/usr/lib/jvm/java-8-openjdk', editable: false },
                      { key: 'PYSPARK_PYTHON', value: '/usr/bin/python3', editable: false },
                    ].map((env) => (
                      <div key={env.key} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <span className="font-mono text-sm">{env.key}</span>
                        <div className="flex items-center gap-2">
                          {editingEnvVar?.key === env.key ? (
                            <>
                              <Input
                                value={editingEnvVar.value}
                                onChange={(e) => setEditingEnvVar({ ...editingEnvVar, value: e.target.value })}
                                className="w-64 h-8"
                              />
                              <Button
                                size="sm"
                                onClick={() => {
                                  // System variables are read-only in this implementation
                                  setEditingEnvVar(null);
                                }}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="text-sm text-muted-foreground">{env.value}</span>
                              {env.editable && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingEnvVar({ key: env.key, value: env.value })}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Custom Environment Variables */}
                {Object.keys(customEnvVars).length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <CardTitle className="text-sm">Custom Variables</CardTitle>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(customEnvVars).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <span className="font-mono text-sm">{key}</span>
                            <div className="flex items-center gap-2">
                              {editingEnvVar?.key === key ? (
                                <>
                                  <Input
                                    value={editingEnvVar.value}
                                    onChange={(e) => setEditingEnvVar({ ...editingEnvVar, value: e.target.value })}
                                    className="w-64 h-8"
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      const updated = { ...customEnvVars, [key]: editingEnvVar.value };
                                      setCustomEnvVars(updated);
                                      updateConfig({ environment: updated });
                                      setEditingEnvVar(null);
                                      toast({
                                        title: 'Updated',
                                        description: `Environment variable ${key} updated`,
                                      });
                                    }}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingEnvVar(null)}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <span className="text-sm text-muted-foreground">{value}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingEnvVar({ key, value })}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const updated = { ...customEnvVars };
                                      delete updated[key];
                                      setCustomEnvVars(updated);
                                      updateConfig({ environment: updated });
                                      toast({
                                        title: 'Removed',
                                        description: `Environment variable ${key} removed`,
                                      });
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                
                <Separator />
                <div>
                  <CardTitle className="text-sm mb-3">Spark Configuration</CardTitle>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {[
                      { key: 'spark.master', value: config.master || config.sparkMaster || 'local[*]' },
                      { key: 'spark.app.name', value: config.appName || config.sparkAppName || 'archiphoenix-spark' },
                      { key: 'spark.driver.memory', value: config.driverMemory || '2g' },
                      { key: 'spark.executor.memory', value: config.executorMemory || '4g' },
                      { key: 'spark.executor.cores', value: String(config.executorCores || 2) },
                      { key: 'spark.dynamicAllocation.enabled', value: String(config.enableDynamicAllocation ?? true) },
                      { key: 'spark.dynamicAllocation.minExecutors', value: String(config.minExecutors || 1) },
                      { key: 'spark.dynamicAllocation.maxExecutors', value: String(config.maxExecutors || 10) },
                      { key: 'spark.sql.shuffle.partitions', value: '200' },
                      { key: 'spark.default.parallelism', value: String(totalCores || 2) },
                      { key: 'spark.serializer', value: 'org.apache.spark.serializer.KryoSerializer' },
                      { key: 'spark.sql.adaptive.enabled', value: 'true' },
                      { key: 'spark.sql.adaptive.coalescePartitions.enabled', value: 'true' },
                      { key: 'spark.sql.adaptive.skewJoin.enabled', value: 'true' },
                      { key: 'spark.network.timeout', value: '800s' },
                      { key: 'spark.executor.heartbeatInterval', value: '10s' },
                      { key: 'spark.shuffle.service.enabled', value: String(config.enableDynamicAllocation ?? true) },
                      { key: 'spark.sql.execution.arrow.pyspark.enabled', value: 'true' },
                      { key: 'spark.sql.execution.arrow.maxRecordsPerBatch', value: '10000' },
                    ].map((conf) => (
                      <div key={conf.key} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <span className="font-mono text-sm">{conf.key}</span>
                        <span className="text-sm text-muted-foreground">{conf.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <Separator />
                
                {/* JVM Settings */}
                <div>
                  <CardTitle className="text-sm mb-3">JVM Settings</CardTitle>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Heap Size (Driver)</Label>
                        <div className="p-3 bg-muted rounded-lg mt-1">
                          <span className="text-sm font-semibold">{config.driverMemory || '2g'}</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Heap Size (Executor)</Label>
                        <div className="p-3 bg-muted rounded-lg mt-1">
                          <span className="text-sm font-semibold">{config.executorMemory || '4g'}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">GC Type</Label>
                      <div className="p-3 bg-muted rounded-lg mt-1">
                        <span className="text-sm font-semibold">G1GC</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">GC Options</Label>
                      <div className="p-3 bg-muted rounded-lg mt-1 space-y-1">
                        <div className="text-xs font-mono">-XX:+UseG1GC</div>
                        <div className="text-xs font-mono">-XX:MaxGCPauseMillis=200</div>
                        <div className="text-xs font-mono">-XX:+PrintGCDetails</div>
                        <div className="text-xs font-mono">-XX:+PrintGCTimeStamps</div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">JVM Options</Label>
                      <div className="p-3 bg-muted rounded-lg mt-1 space-y-1">
                        <div className="text-xs font-mono">-XX:+UseCompressedOops</div>
                        <div className="text-xs font-mono">-XX:+UseCompressedClassPointers</div>
                        <div className="text-xs font-mono">-XX:+HeapDumpOnOutOfMemoryError</div>
                        <div className="text-xs font-mono">-XX:HeapDumpPath=/tmp/spark-heap-dump</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <Separator />
                <div>
                  <CardTitle className="text-sm mb-3">Runtime Information</CardTitle>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span>Java Version</span>
                      <span className="text-muted-foreground">1.8.0_312</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span>Scala Version</span>
                      <span className="text-muted-foreground">2.12.15</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span>Python Version</span>
                      <span className="text-muted-foreground">3.9.7</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span>Spark Version</span>
                      <span className="text-muted-foreground">3.3.0</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Dialog for adding new environment variable */}
            <Dialog open={showAddEnvVar} onOpenChange={setShowAddEnvVar}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Environment Variable</DialogTitle>
                  <DialogDescription>
                    Add a custom environment variable to the Spark configuration
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Variable Name</Label>
                    <Input
                      value={newEnvVarKey}
                      onChange={(e) => setNewEnvVarKey(e.target.value)}
                      placeholder="MY_CUSTOM_VAR"
                    />
                  </div>
                  <div>
                    <Label>Variable Value</Label>
                    <Input
                      value={newEnvVarValue}
                      onChange={(e) => setNewEnvVarValue(e.target.value)}
                      placeholder="value"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddEnvVar(false);
                      setNewEnvVarKey('');
                      setNewEnvVarValue('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (!newEnvVarKey || !newEnvVarValue) {
                        toast({
                          title: 'Error',
                          description: 'Variable name and value are required',
                          variant: 'destructive',
                        });
                        return;
                      }
                      const updated = { ...customEnvVars, [newEnvVarKey]: newEnvVarValue };
                      setCustomEnvVars(updated);
                      updateConfig({ environment: updated });
                      setShowAddEnvVar(false);
                      setNewEnvVarKey('');
                      setNewEnvVarValue('');
                      toast({
                        title: 'Added',
                        description: `Environment variable ${newEnvVarKey} added`,
                      });
                    }}
                  >
                    Add
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Additional Metrics</CardTitle>
                <CardDescription>GC, Network, Disk, and JVM metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* GC Metrics */}
                <div>
                  <CardTitle className="text-sm mb-4">GC Metrics</CardTitle>
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xs text-muted-foreground">GC Pause Time</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {sparkMetrics ? `${sparkMetrics.gcPauseTime.toFixed(0)} ms` : '0 ms'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Total pause time</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xs text-muted-foreground">GC Frequency</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {sparkMetrics ? `${sparkMetrics.gcFrequency.toFixed(1)} /hour` : '0 /hour'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">GC events per hour</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xs text-muted-foreground">Memory Before GC</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {sparkMetrics ? `${sparkMetrics.memoryBeforeGC.toFixed(2)} GB` : '0 GB'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Memory before last GC</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xs text-muted-foreground">Memory After GC</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {sparkMetrics ? `${sparkMetrics.memoryAfterGC.toFixed(2)} GB` : '0 GB'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Memory after last GC</div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <Separator />

                {/* Network Metrics */}
                <div>
                  <CardTitle className="text-sm mb-4">Network Metrics</CardTitle>
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xs text-muted-foreground">Total Network I/O</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {sparkMetrics ? formatBytes(sparkMetrics.totalNetworkIO) : '0 B'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Total network traffic</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xs text-muted-foreground">Network Utilization</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {sparkMetrics ? `${sparkMetrics.networkUtilization.toFixed(1)}%` : '0%'}
                        </div>
                        <Progress 
                          value={sparkMetrics?.networkUtilization || 0} 
                          className="mt-2"
                        />
                        <div className="text-xs text-muted-foreground mt-1">Network bandwidth usage</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xs text-muted-foreground">Network Errors</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {sparkMetrics ? sparkMetrics.networkErrors : 0}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Total network errors</div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <Separator />

                {/* Disk Metrics */}
                <div>
                  <CardTitle className="text-sm mb-4">Disk Metrics</CardTitle>
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xs text-muted-foreground">Disk I/O Rate</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {sparkMetrics ? `${(sparkMetrics.diskIORate / 1024 / 1024).toFixed(2)} MB/s` : '0 MB/s'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Disk I/O throughput</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xs text-muted-foreground">Disk Utilization</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {sparkMetrics ? `${sparkMetrics.diskUtilization.toFixed(1)}%` : '0%'}
                        </div>
                        <Progress 
                          value={sparkMetrics?.diskUtilization || 0} 
                          className="mt-2"
                        />
                        <div className="text-xs text-muted-foreground mt-1">Disk space usage</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xs text-muted-foreground">Disk Errors</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {sparkMetrics ? sparkMetrics.diskErrors : 0}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Total disk errors</div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <Separator />

                {/* JVM Metrics */}
                <div>
                  <CardTitle className="text-sm mb-4">JVM Metrics</CardTitle>
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xs text-muted-foreground">Heap Usage</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {sparkMetrics ? `${sparkMetrics.heapUsage.toFixed(2)} GB` : '0 GB'}
                        </div>
                        <Progress 
                          value={sparkMetrics && sparkMetrics.totalMemory > 0 
                            ? (sparkMetrics.heapUsage / sparkMetrics.totalMemory) * 100 
                            : 0} 
                          className="mt-2"
                        />
                        <div className="text-xs text-muted-foreground mt-1">
                          {sparkMetrics && sparkMetrics.totalMemory > 0
                            ? `of ${sparkMetrics.totalMemory.toFixed(2)} GB`
                            : 'Heap memory'}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xs text-muted-foreground">Non-Heap Usage</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {sparkMetrics ? `${sparkMetrics.nonHeapUsage.toFixed(2)} GB` : '0 GB'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Metaspace, code cache, etc.</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xs text-muted-foreground">Thread Count</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {sparkMetrics ? sparkMetrics.threadCount : 0}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Active threads</div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Metrics Over Time Charts */}
                <Separator />
                <div>
                  <CardTitle className="text-sm mb-4">Metrics Over Time</CardTitle>
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-xs">GC Pause Time</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={150}>
                          <AreaChart
                            data={useMemo(() => {
                              // Simulate GC pause time over time
                              const now = Date.now();
                              const timeWindow = 3600000; // 1 hour
                              const timePoints = 15;
                              const interval = timeWindow / timePoints;
                              
                              const timelineData = [];
                              for (let i = 0; i <= timePoints; i++) {
                                const timestamp = now - (timeWindow - i * interval);
                                const timeLabel = new Date(timestamp).toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                });
                                
                                // Simulate GC pause time (would come from history in real implementation)
                                const basePauseTime = sparkMetrics?.gcPauseTime || 0;
                                const variation = 1 + (Math.sin(i / timePoints * Math.PI * 2) * 0.3);
                                
                                timelineData.push({
                                  time: timeLabel,
                                  pauseTime: basePauseTime * variation
                                });
                              }
                              return timelineData;
                            }, [sparkMetrics])}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis 
                              dataKey="time" 
                              stroke="hsl(var(--muted-foreground))"
                              tick={{ fontSize: 10 }}
                            />
                            <YAxis 
                              stroke="hsl(var(--muted-foreground))"
                              tick={{ fontSize: 10 }}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--card))', 
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '4px'
                              }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="pauseTime" 
                              stroke="hsl(0 84% 60%)" 
                              fill="hsl(0 84% 60%)"
                              fillOpacity={0.6}
                              name="GC Pause (ms)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-xs">Network Utilization</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={150}>
                          <LineChart
                            data={useMemo(() => {
                              const now = Date.now();
                              const timeWindow = 3600000;
                              const timePoints = 15;
                              const interval = timeWindow / timePoints;
                              
                              const timelineData = [];
                              for (let i = 0; i <= timePoints; i++) {
                                const timestamp = now - (timeWindow - i * interval);
                                const timeLabel = new Date(timestamp).toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                });
                                
                                const baseUtil = sparkMetrics?.networkUtilization || 0;
                                const variation = 1 + (Math.sin(i / timePoints * Math.PI * 2) * 0.2);
                                
                                timelineData.push({
                                  time: timeLabel,
                                  utilization: Math.min(100, baseUtil * variation)
                                });
                              }
                              return timelineData;
                            }, [sparkMetrics])}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis 
                              dataKey="time" 
                              stroke="hsl(var(--muted-foreground))"
                              tick={{ fontSize: 10 }}
                            />
                            <YAxis 
                              stroke="hsl(var(--muted-foreground))"
                              tick={{ fontSize: 10 }}
                              domain={[0, 100]}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--card))', 
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '4px'
                              }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="utilization" 
                              stroke="hsl(217 91% 60%)" 
                              strokeWidth={2}
                              name="Utilization %"
                              dot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Spark Settings</CardTitle>
                <CardDescription>Application configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Master URL</Label>
                  <Input
                    value={sparkMaster}
                    onChange={(e) => updateConfig({ sparkMaster: e.target.value })}
                    placeholder="spark://master:7077"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Application Name</Label>
                  <Input
                    value={sparkAppName}
                    onChange={(e) => updateConfig({ sparkAppName: e.target.value })}
                    placeholder="Spark Application"
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Driver Memory</Label>
                  <Input 
                    type="text" 
                    value={config.driverMemory || '2g'}
                    onChange={(e) => updateConfig({ driverMemory: e.target.value })}
                    placeholder="2g"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Executor Memory</Label>
                  <Input 
                    type="text" 
                    value={config.executorMemory || '4g'}
                    onChange={(e) => updateConfig({ executorMemory: e.target.value })}
                    placeholder="4g"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Executor Cores</Label>
                  <Input 
                    type="number" 
                    value={config.executorCores || 2}
                    onChange={(e) => updateConfig({ executorCores: parseInt(e.target.value) || 2 })}
                    min={1}
                    max={32}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Min Executors</Label>
                  <Input 
                    type="number" 
                    value={config.minExecutors || 1}
                    onChange={(e) => updateConfig({ minExecutors: parseInt(e.target.value) || 1 })}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Executors</Label>
                  <Input 
                    type="number" 
                    value={config.maxExecutors || 10}
                    onChange={(e) => updateConfig({ maxExecutors: parseInt(e.target.value) || 10 })}
                    min={1}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Dynamic Allocation</Label>
                    <p className="text-sm text-muted-foreground">Dynamically scale executors</p>
                  </div>
                  <Switch
                    checked={config.enableDynamicAllocation ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableDynamicAllocation: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Checkpointing</Label>
                    <p className="text-sm text-muted-foreground">Save state for fault tolerance</p>
                  </div>
                  <Switch
                    checked={config.enableCheckpointing ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableCheckpointing: checked })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Checkpoint Directory</Label>
                  <Input 
                    type="text" 
                    value={config.checkpointDirectory || '/checkpoint'}
                    onChange={(e) => updateConfig({ checkpointDirectory: e.target.value })}
                    placeholder="/checkpoint"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Streaming</Label>
                    <p className="text-sm text-muted-foreground">Enable Spark Streaming</p>
                  </div>
                  <Switch
                    checked={config.enableStreaming ?? false}
                    onCheckedChange={(checked) => updateConfig({ enableStreaming: checked })}
                  />
                </div>
                {config.enableStreaming && (
                  <div className="space-y-2">
                    <Label>Batch Interval (ms)</Label>
                    <Input 
                      type="number" 
                      value={config.streamingBatchInterval || 1000}
                      onChange={(e) => updateConfig({ streamingBatchInterval: parseInt(e.target.value) || 1000 })}
                      min={100}
                      max={60000}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Job Dialog */}
        <Dialog open={showCreateJob} onOpenChange={setShowCreateJob}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Job</DialogTitle>
              <DialogDescription>Create a new Spark job</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Job Name</Label>
                <Input
                  id="job-name"
                  placeholder="My Spark Job"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const input = e.target as HTMLInputElement;
                      handleCreateJob({ name: input.value });
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Stages</Label>
                <Input
                  type="number"
                  defaultValue={3}
                  min={1}
                  id="job-stages"
                />
              </div>
              <div className="space-y-2">
                <Label>Tasks</Label>
                <Input
                  type="number"
                  defaultValue={100}
                  min={1}
                  id="job-tasks"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateJob(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const nameInput = document.getElementById('job-name') as HTMLInputElement;
                  const stagesInput = document.getElementById('job-stages') as HTMLInputElement;
                  const tasksInput = document.getElementById('job-tasks') as HTMLInputElement;
                  handleCreateJob({
                    name: nameInput.value,
                    stages: parseInt(stagesInput.value) || 3,
                    tasks: parseInt(tasksInput.value) || 100,
                  });
                }}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Executor Dialog */}
        <Dialog open={showCreateExecutor} onOpenChange={setShowCreateExecutor}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Executor</DialogTitle>
              <DialogDescription>Add a new Spark executor</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Executor ID</Label>
                <Input
                  id="executor-id"
                  placeholder="executor-1"
                />
              </div>
              <div className="space-y-2">
                <Label>Host</Label>
                <Input
                  id="executor-host"
                  placeholder="host.example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Cores</Label>
                <Input
                  type="number"
                  defaultValue={config.executorCores || 2}
                  min={1}
                  max={32}
                  id="executor-cores"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateExecutor(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const idInput = document.getElementById('executor-id') as HTMLInputElement;
                  const hostInput = document.getElementById('executor-host') as HTMLInputElement;
                  const coresInput = document.getElementById('executor-cores') as HTMLInputElement;
                  handleCreateExecutor({
                    id: idInput.value,
                    host: hostInput.value,
                    cores: parseInt(coresInput.value) || (config.executorCores || 2),
                  });
                }}
              >
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Job Confirmation */}
        <Dialog open={!!deleteJobId} onOpenChange={(open) => !open && setDeleteJobId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Job</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this job? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteJobId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteJobId && handleDeleteJob(deleteJobId)}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Executor Confirmation */}
        <Dialog open={!!deleteExecutorId} onOpenChange={(open) => !open && setDeleteExecutorId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove Executor</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove this executor? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteExecutorId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteExecutorId && handleDeleteExecutor(deleteExecutorId)}
              >
                Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Job Details Dialog */}
        <Dialog open={!!viewJobDetails} onOpenChange={(open) => !open && setViewJobDetails(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Job Details: {viewJobDetails?.name}</DialogTitle>
              <DialogDescription>Detailed information about the Spark job</DialogDescription>
            </DialogHeader>
            {viewJobDetails && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="outline" className={getStatusColor(viewJobDetails.status)}>
                        {viewJobDetails.status}
                      </Badge>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Duration</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <span className="text-sm">{formatDurationFromMs(viewJobDetails.duration)}</span>
                    </CardContent>
                  </Card>
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Stages DAG</CardTitle>
                    <CardDescription>Stage dependencies visualization</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {sparkEngine ? (() => {
                      const dag = sparkEngine.getJobDAG(viewJobDetails.id);
                      const stages = dag.stages;
                      const edges = dag.edges;
                      
                      if (stages.length === 0) {
                        return <div className="text-sm text-muted-foreground">No stages available</div>;
                      }
                      
                      // Simple horizontal layout for DAG
                      const stagePositions = new Map<string, { x: number; y: number }>();
                      const stageLevels = new Map<string, number>();
                      
                      // Calculate levels (BFS)
                      const visited = new Set<string>();
                      const queue: Array<{ id: string; level: number }> = [];
                      
                      // Find root stages (no parents)
                      const rootStages = stages.filter(s => !s.parentStageIds || s.parentStageIds.length === 0);
                      rootStages.forEach(s => {
                        queue.push({ id: s.id, level: 0 });
                        stageLevels.set(s.id, 0);
                      });
                      
                      while (queue.length > 0) {
                        const { id, level } = queue.shift()!;
                        if (visited.has(id)) continue;
                        visited.add(id);
                        
                        const stage = stages.find(s => s.id === id);
                        if (stage?.childStageIds) {
                          for (const childId of stage.childStageIds) {
                            if (!visited.has(childId)) {
                              const childLevel = Math.max(level + 1, stageLevels.get(childId) || 0);
                              stageLevels.set(childId, childLevel);
                              queue.push({ id: childId, level: childLevel });
                            }
                          }
                        }
                      }
                      
                      // Calculate positions
                      const levelGroups = new Map<number, string[]>();
                      stages.forEach(s => {
                        const level = stageLevels.get(s.id) || 0;
                        if (!levelGroups.has(level)) {
                          levelGroups.set(level, []);
                        }
                        levelGroups.get(level)!.push(s.id);
                      });
                      
                      const maxLevel = Math.max(...Array.from(levelGroups.keys()));
                      const width = 800;
                      const height = Math.max(400, (maxLevel + 1) * 120);
                      const levelWidth = width / (maxLevel + 1);
                      
                      levelGroups.forEach((stageIds, level) => {
                        const ySpacing = height / (stageIds.length + 1);
                        stageIds.forEach((stageId, index) => {
                          stagePositions.set(stageId, {
                            x: level * levelWidth + levelWidth / 2,
                            y: (index + 1) * ySpacing
                          });
                        });
                      });
                      
                      return (
                        <div className="overflow-auto border rounded-lg p-4 bg-muted/20">
                          <svg width={width} height={height} className="w-full">
                            {/* Draw edges */}
                            {edges.map((edge, idx) => {
                              const from = stagePositions.get(edge.from);
                              const to = stagePositions.get(edge.to);
                              if (!from || !to) return null;
                              
                              return (
                                <line
                                  key={`edge-${idx}`}
                                  x1={from.x}
                                  y1={from.y}
                                  x2={to.x}
                                  y2={to.y}
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  className="text-muted-foreground"
                                  markerEnd="url(#arrowhead)"
                                />
                              );
                            })}
                            
                            {/* Arrow marker */}
                            <defs>
                              <marker
                                id="arrowhead"
                                markerWidth="10"
                                markerHeight="10"
                                refX="9"
                                refY="3"
                                orient="auto"
                              >
                                <polygon points="0 0, 10 3, 0 6" fill="currentColor" className="text-muted-foreground" />
                              </marker>
                            </defs>
                            
                            {/* Draw stages */}
                            {stages.map((stage) => {
                              const pos = stagePositions.get(stage.id);
                              if (!pos) return null;
                              
                              const statusColor = getStatusColor(stage.status);
                              const isActive = stage.status === 'ACTIVE';
                              
                              return (
                                <g key={stage.id}>
                                  <circle
                                    cx={pos.x}
                                    cy={pos.y}
                                    r={isActive ? 35 : 30}
                                    fill={isActive ? 'currentColor' : 'transparent'}
                                    className={isActive ? `${statusColor} opacity-20` : ''}
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className={`${statusColor} cursor-pointer hover:opacity-80`}
                                  />
                                  <text
                                    x={pos.x}
                                    y={pos.y - 5}
                                    textAnchor="middle"
                                    className="text-xs font-semibold fill-foreground"
                                  >
                                    {stage.name}
                                  </text>
                                  <text
                                    x={pos.x}
                                    y={pos.y + 15}
                                    textAnchor="middle"
                                    className="text-[10px] fill-muted-foreground"
                                  >
                                    {stage.numCompleteTasks}/{stage.numTasks}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>
                        </div>
                      );
                    })() : (
                      <div className="text-sm text-muted-foreground">No stages available</div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Stages List</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {sparkEngine ? (
                        sparkEngine.getStagesForJob(viewJobDetails.id).map((stage) => (
                          <div key={stage.id} className="flex items-center justify-between p-2 bg-muted rounded">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{stage.name}</span>
                              {stage.stageType && (
                                <Badge variant="outline" className="text-xs">
                                  {stage.stageType}
                                </Badge>
                              )}
                            </div>
                            <Badge variant="outline" className={getStatusColor(stage.status)}>
                              {stage.status}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground">No stages available</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Data Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Input Bytes:</span>
                        <span className="ml-2 font-semibold">{formatBytes(viewJobDetails.inputBytes)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Output Bytes:</span>
                        <span className="ml-2 font-semibold">{formatBytes(viewJobDetails.outputBytes)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Shuffle Read:</span>
                        <span className="ml-2 font-semibold">{formatBytes(viewJobDetails.shuffleRead)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Shuffle Write:</span>
                        <span className="ml-2 font-semibold">{formatBytes(viewJobDetails.shuffleWrite)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {sparkEngine && (() => {
                  const stages = sparkEngine.getStagesForJob(viewJobDetails.id);
                  const hasShuffleMetrics = stages.some(s => 
                    (s.shuffleNetworkRead && s.shuffleNetworkRead > 0) || 
                    (s.shuffleSpillMemory && s.shuffleSpillMemory > 0)
                  );
                  
                  if (!hasShuffleMetrics) return null;
                  
                  const totalNetworkRead = stages.reduce((sum, s) => sum + (s.shuffleNetworkRead || 0), 0);
                  const totalNetworkWrite = stages.reduce((sum, s) => sum + (s.shuffleNetworkWrite || 0), 0);
                  const totalSpillMemory = stages.reduce((sum, s) => sum + (s.shuffleSpillMemory || 0), 0);
                  const totalSpillDisk = stages.reduce((sum, s) => sum + (s.shuffleSpillDisk || 0), 0);
                  
                  return (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Shuffle Network & Spill Metrics</CardTitle>
                        <CardDescription>Network I/O and memory spill during shuffle operations</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Network Read:</span>
                            <span className="ml-2 font-semibold text-blue-600 dark:text-blue-400">
                              {formatBytes(totalNetworkRead)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Network Write:</span>
                            <span className="ml-2 font-semibold text-blue-600 dark:text-blue-400">
                              {formatBytes(totalNetworkWrite)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Memory Spill:</span>
                            <span className="ml-2 font-semibold text-orange-600 dark:text-orange-400">
                              {formatBytes(totalSpillMemory)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Disk Spill Read:</span>
                            <span className="ml-2 font-semibold text-orange-600 dark:text-orange-400">
                              {formatBytes(totalSpillDisk)}
                            </span>
                          </div>
                        </div>
                        {totalSpillMemory > 0 && (
                          <div className="mt-3 p-2 bg-orange-50 dark:bg-orange-950/20 rounded text-xs text-orange-800 dark:text-orange-200">
                            <AlertTriangle className="h-3 w-3 inline mr-1" />
                            Memory spill detected. Consider increasing executor memory or reducing shuffle operations.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {viewJobDetails.submissionTime && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Submission:</span>
                          <span>{new Date(viewJobDetails.submissionTime).toLocaleString()}</span>
                        </div>
                      )}
                      {viewJobDetails.startTime && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Start:</span>
                          <span>{new Date(viewJobDetails.startTime).toLocaleString()}</span>
                        </div>
                      )}
                      {viewJobDetails.completionTime && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Completion:</span>
                          <span>{new Date(viewJobDetails.completionTime).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                {viewJobDetails.status === 'RUNNING' && (
                  <DialogFooter>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (sparkEngine && viewJobDetails) {
                          sparkEngine.removeJob(viewJobDetails.id);
                          toast({
                            title: 'Job killed',
                            description: 'The job has been terminated',
                          });
                          setViewJobDetails(null);
                        }
                      }}
                    >
                      Kill Job
                    </Button>
                  </DialogFooter>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Stage Details Dialog */}
        <Dialog open={!!viewStageDetails} onOpenChange={(open) => !open && setViewStageDetails(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Stage Details: {viewStageDetails?.name}</DialogTitle>
              <DialogDescription>Detailed information about the Spark stage</DialogDescription>
            </DialogHeader>
            {viewStageDetails && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="outline" className={getStatusColor(viewStageDetails.status)}>
                        {viewStageDetails.status}
                      </Badge>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Tasks</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 text-sm">
                        <div>Total: {viewStageDetails.numTasks}</div>
                        <div>Complete: {viewStageDetails.numCompleteTasks}</div>
                        <div>Active: {viewStageDetails.numActiveTasks}</div>
                        {viewStageDetails.numFailedTasks > 0 && (
                          <div className="text-red-600">Failed: {viewStageDetails.numFailedTasks}</div>
                        )}
                      </div>
                      <div className="mt-2">
                        <Progress 
                          value={(viewStageDetails.numCompleteTasks / viewStageDetails.numTasks) * 100} 
                          className="h-2"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Data Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Input Bytes:</span>
                        <span className="ml-2 font-semibold">{formatBytes(viewStageDetails.inputBytes)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Output Bytes:</span>
                        <span className="ml-2 font-semibold">{formatBytes(viewStageDetails.outputBytes)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Shuffle Read:</span>
                        <span className="ml-2 font-semibold">{formatBytes(viewStageDetails.shuffleRead)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Shuffle Write:</span>
                        <span className="ml-2 font-semibold">{formatBytes(viewStageDetails.shuffleWrite)}</span>
                      </div>
                      {viewStageDetails.stageType && (
                        <div>
                          <span className="text-muted-foreground">Stage Type:</span>
                          <span className="ml-2 font-semibold">
                            <Badge variant="outline">{viewStageDetails.stageType}</Badge>
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                {(viewStageDetails.shuffleNetworkRead && viewStageDetails.shuffleNetworkRead > 0) ||
                 (viewStageDetails.shuffleSpillMemory && viewStageDetails.shuffleSpillMemory > 0) ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Shuffle Network & Spill Metrics</CardTitle>
                      <CardDescription>Detailed shuffle operation metrics</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {viewStageDetails.shuffleNetworkRead && viewStageDetails.shuffleNetworkRead > 0 && (
                          <div>
                            <span className="text-muted-foreground">Network Read:</span>
                            <span className="ml-2 font-semibold text-blue-600 dark:text-blue-400">
                              {formatBytes(viewStageDetails.shuffleNetworkRead)}
                            </span>
                          </div>
                        )}
                        {viewStageDetails.shuffleNetworkWrite && viewStageDetails.shuffleNetworkWrite > 0 && (
                          <div>
                            <span className="text-muted-foreground">Network Write:</span>
                            <span className="ml-2 font-semibold text-blue-600 dark:text-blue-400">
                              {formatBytes(viewStageDetails.shuffleNetworkWrite)}
                            </span>
                          </div>
                        )}
                        {viewStageDetails.shuffleSpillMemory && viewStageDetails.shuffleSpillMemory > 0 && (
                          <div>
                            <span className="text-muted-foreground">Memory Spill:</span>
                            <span className="ml-2 font-semibold text-orange-600 dark:text-orange-400">
                              {formatBytes(viewStageDetails.shuffleSpillMemory)}
                            </span>
                          </div>
                        )}
                        {viewStageDetails.shuffleSpillDisk && viewStageDetails.shuffleSpillDisk > 0 && (
                          <div>
                            <span className="text-muted-foreground">Disk Spill:</span>
                            <span className="ml-2 font-semibold text-orange-600 dark:text-orange-400">
                              {formatBytes(viewStageDetails.shuffleSpillDisk)}
                            </span>
                          </div>
                        )}
                        {viewStageDetails.shuffleFetchWaitTime && viewStageDetails.shuffleFetchWaitTime > 0 && (
                          <div>
                            <span className="text-muted-foreground">Fetch Wait Time:</span>
                            <span className="ml-2 font-semibold">
                              {viewStageDetails.shuffleFetchWaitTime.toFixed(0)}ms
                            </span>
                          </div>
                        )}
                      </div>
                      {viewStageDetails.shuffleSpillMemory && viewStageDetails.shuffleSpillMemory > 0 && (
                        <div className="mt-3 p-2 bg-orange-50 dark:bg-orange-950/20 rounded text-xs text-orange-800 dark:text-orange-200">
                          <AlertTriangle className="h-3 w-3 inline mr-1" />
                          Memory spill detected. This indicates high memory pressure during shuffle operations.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : null}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Shuffle Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {executors.map((executor) => (
                        <div key={executor.id} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span>{executor.id}</span>
                          <div className="flex gap-4">
                            <span className="text-muted-foreground">
                              R: {formatBytes(executor.totalShuffleRead || 0)}
                            </span>
                            <span className="text-muted-foreground">
                              W: {formatBytes(executor.totalShuffleWrite || 0)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                {viewStageDetails.duration && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Timeline</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        {viewStageDetails.submissionTime && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Submission:</span>
                            <span>{new Date(viewStageDetails.submissionTime).toLocaleString()}</span>
                          </div>
                        )}
                        {viewStageDetails.completionTime && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Completion:</span>
                            <span>{new Date(viewStageDetails.completionTime).toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Duration:</span>
                          <span>{formatDurationFromMs(viewStageDetails.duration)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Executor Details Dialog */}
        <Dialog open={!!viewExecutorDetails} onOpenChange={(open) => !open && setViewExecutorDetails(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Executor Details: {viewExecutorDetails?.id}</DialogTitle>
              <DialogDescription>Detailed information about the Spark executor</DialogDescription>
            </DialogHeader>
            {viewExecutorDetails && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="outline" className={getStatusColor(viewExecutorDetails.status)}>
                        {viewExecutorDetails.status}
                      </Badge>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Host</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <span className="text-sm">{viewExecutorDetails.host}</span>
                    </CardContent>
                  </Card>
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Resources</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Memory</span>
                          <span>
                            {(viewExecutorDetails.memoryUsed / 1024).toFixed(1)} / {(viewExecutorDetails.memoryMax / 1024).toFixed(1)} GB
                          </span>
                        </div>
                        <Progress 
                          value={(viewExecutorDetails.memoryUsed / viewExecutorDetails.memoryMax) * 100} 
                          className="h-2"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Disk</span>
                          <span>
                            {(viewExecutorDetails.diskUsed / 1024).toFixed(1)} / {(viewExecutorDetails.diskMax / 1024).toFixed(1)} GB
                          </span>
                        </div>
                        <Progress 
                          value={(viewExecutorDetails.diskUsed / viewExecutorDetails.diskMax) * 100} 
                          className="h-2"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                        <div>
                          <span className="text-muted-foreground">Cores:</span>
                          <span className="ml-2 font-semibold">{viewExecutorDetails.cores}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Active Tasks:</span>
                          <span className="ml-2 font-semibold">{viewExecutorDetails.activeTasks}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Task Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Total Tasks:</span>
                        <span className="ml-2 font-semibold">{viewExecutorDetails.totalTasks}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Active Tasks:</span>
                        <span className="ml-2 font-semibold">{viewExecutorDetails.activeTasks}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Data Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Input Bytes:</span>
                        <span className="ml-2 font-semibold">{formatBytes(viewExecutorDetails.totalInputBytes)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Shuffle Read:</span>
                        <span className="ml-2 font-semibold">{formatBytes(viewExecutorDetails.totalShuffleRead)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Shuffle Write:</span>
                        <span className="ml-2 font-semibold">{formatBytes(viewExecutorDetails.totalShuffleWrite)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {viewExecutorDetails.startTime && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Start Time:</span>
                          <span>{new Date(viewExecutorDetails.startTime).toLocaleString()}</span>
                        </div>
                      )}
                      {viewExecutorDetails.lastHeartbeat && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Last Heartbeat:</span>
                          <span>{new Date(viewExecutorDetails.lastHeartbeat).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}


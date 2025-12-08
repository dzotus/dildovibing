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
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  Cpu,
  Database,
  Network,
  Zap
} from 'lucide-react';

interface SparkConfigProps {
  componentId: string;
}

interface SparkJob {
  id: string;
  name: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'KILLED';
  startTime: string;
  endTime?: string;
  duration?: number;
  stages?: number;
  tasks?: number;
  executors?: number;
  inputBytes?: number;
  outputBytes?: number;
  shuffleRead?: number;
  shuffleWrite?: number;
}

interface SparkStage {
  id: string;
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
}

export function SparkConfigAdvanced({ componentId }: SparkConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as SparkConfig;
  const jobs = config.jobs || [];
  const stages = config.stages || [];
  const executors = config.executors || [];
  const totalJobs = config.totalJobs || jobs.length;
  const activeJobs = config.activeJobs || jobs.filter((j) => j.status === 'RUNNING').length;
  const totalExecutors = config.totalExecutors || executors.length;
  const totalCores = config.totalCores || executors.reduce((sum, e) => sum + e.cores, 0);
  const totalMemory = config.totalMemory || executors.reduce((sum, e) => sum + e.memoryMax, 0);
  const sparkMaster = config.sparkMaster || 'spark://master:7077';
  const sparkAppName = config.sparkAppName || 'Spark Application';

  const [selectedJob, setSelectedJob] = useState<string>('');

  const updateConfig = (updates: Partial<SparkConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

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
    if (!bytes) return '0 B';
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
            <Button variant="outline" size="sm">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-5 gap-4">
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
                <CardTitle className="text-sm font-medium text-muted-foreground">App Name</CardTitle>
                <Network className="h-4 w-4 text-orange-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-semibold text-orange-600 dark:text-orange-400 truncate">{sparkAppName}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="jobs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="jobs">
              <Activity className="h-4 w-4 mr-2" />
              Jobs ({jobs.length})
            </TabsTrigger>
            <TabsTrigger value="stages">
              <Network className="h-4 w-4 mr-2" />
              Stages ({stages.length})
            </TabsTrigger>
            <TabsTrigger value="executors">
              <Cpu className="h-4 w-4 mr-2" />
              Executors ({executors.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jobs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Jobs</CardTitle>
                <CardDescription>Spark application jobs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {jobs.map((job) => (
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
                                    {formatDuration(job.duration)}
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stages" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Stages</CardTitle>
                <CardDescription>Job execution stages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stages.map((stage) => (
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
                            <div>
                              <CardTitle className="text-lg font-semibold">{stage.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className={getStatusColor(stage.status)}>
                                  {stage.status}
                                </Badge>
                                <Badge variant="outline">
                                  {stage.numCompleteTasks}/{stage.numTasks} tasks
                                </Badge>
                                {stage.duration && (
                                  <Badge variant="outline">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {formatDuration(stage.duration)}
                                  </Badge>
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="executors" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Executors</CardTitle>
                <CardDescription>Spark executor nodes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {executors.map((executor) => (
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
                  <Input type="text" defaultValue="2g" />
                </div>
                <div className="space-y-2">
                  <Label>Executor Memory</Label>
                  <Input type="text" defaultValue="4g" />
                </div>
                <div className="space-y-2">
                  <Label>Executor Cores</Label>
                  <Input type="number" defaultValue={4} min={1} />
                </div>
                <div className="space-y-2">
                  <Label>Max Executors</Label>
                  <Input type="number" defaultValue={10} min={1} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


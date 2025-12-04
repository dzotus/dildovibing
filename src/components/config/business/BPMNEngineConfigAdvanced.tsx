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
  Workflow,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  FileText,
  TrendingUp
} from 'lucide-react';

interface BPMNEngineConfigProps {
  componentId: string;
}

interface ProcessDefinition {
  id: string;
  key: string;
  name: string;
  version: number;
  deployments: number;
  instances?: number;
  activeInstances?: number;
  lastDeployed?: string;
}

interface ProcessInstance {
  id: string;
  processDefinitionKey: string;
  status: 'RUNNING' | 'COMPLETED' | 'SUSPENDED' | 'FAILED';
  startTime: string;
  endTime?: string;
  duration?: number;
  businessKey?: string;
  variables?: Record<string, any>;
}

interface Task {
  id: string;
  name: string;
  processInstanceId: string;
  assignee?: string;
  status: 'CREATED' | 'ASSIGNED' | 'COMPLETED' | 'CANCELLED';
  createdTime: string;
  dueDate?: string;
  priority?: number;
}

interface BPMNEngineConfig {
  processDefinitions?: ProcessDefinition[];
  processInstances?: ProcessInstance[];
  tasks?: Task[];
  totalProcesses?: number;
  activeInstances?: number;
  completedInstances?: number;
  totalTasks?: number;
}

export function BPMNEngineConfigAdvanced({ componentId }: BPMNEngineConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as BPMNEngineConfig;
  const processDefinitions = config.processDefinitions || [];
  const processInstances = config.processInstances || [];
  const tasks = config.tasks || [];
  const totalProcesses = config.totalProcesses || processDefinitions.length;
  const activeInstances = config.activeInstances || processInstances.filter((i) => i.status === 'RUNNING').length;
  const completedInstances = config.completedInstances || processInstances.filter((i) => i.status === 'COMPLETED').length;
  const totalTasks = config.totalTasks || tasks.length;

  const updateConfig = (updates: Partial<BPMNEngineConfig>) => {
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
      case 'ASSIGNED':
        return 'bg-green-500';
      case 'COMPLETED':
        return 'bg-blue-500';
      case 'SUSPENDED':
        return 'bg-yellow-500';
      case 'FAILED':
      case 'CANCELLED':
        return 'bg-red-500';
      case 'CREATED':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">BPMN Engine</p>
            <h2 className="text-2xl font-bold text-foreground">Process Management</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Business process modeling and execution engine
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

        <div className="grid grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Processes</CardTitle>
                <FileText className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalProcesses}</span>
                <span className="text-xs text-muted-foreground">definitions</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Instances</CardTitle>
                <Play className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{activeInstances}</span>
                <span className="text-xs text-muted-foreground">running</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{completedInstances}</span>
                <span className="text-xs text-muted-foreground">instances</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tasks</CardTitle>
                <Workflow className="h-4 w-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{totalTasks}</span>
                <span className="text-xs text-muted-foreground">total</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="processes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="processes">
              <FileText className="h-4 w-4 mr-2" />
              Processes ({processDefinitions.length})
            </TabsTrigger>
            <TabsTrigger value="instances">
              <Activity className="h-4 w-4 mr-2" />
              Instances ({processInstances.length})
            </TabsTrigger>
            <TabsTrigger value="tasks">
              <Workflow className="h-4 w-4 mr-2" />
              Tasks ({tasks.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="processes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Process Definitions</CardTitle>
                <CardDescription>Deployed business processes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {processDefinitions.map((proc) => (
                    <Card key={proc.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{proc.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="font-mono text-xs">{proc.key}</Badge>
                                <Badge variant="outline">v{proc.version}</Badge>
                                <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20">
                                  {proc.activeInstances || 0} active
                                </Badge>
                                <Badge variant="outline">
                                  {proc.instances || 0} total instances
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      {proc.lastDeployed && (
                        <CardContent>
                          <div className="text-xs text-muted-foreground">
                            Last deployed: {new Date(proc.lastDeployed).toLocaleString()}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="instances" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Process Instances</CardTitle>
                <CardDescription>Running and completed process instances</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {processInstances.map((instance) => (
                    <Card key={instance.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getStatusColor(instance.status)}/20`}>
                              {instance.status === 'RUNNING' ? (
                                <Play className="h-5 w-5 text-green-600 dark:text-green-400" />
                              ) : instance.status === 'COMPLETED' ? (
                                <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              ) : instance.status === 'SUSPENDED' ? (
                                <Pause className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                              )}
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{instance.id}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className={getStatusColor(instance.status)}>
                                  {instance.status}
                                </Badge>
                                <Badge variant="outline" className="font-mono text-xs">{instance.processDefinitionKey}</Badge>
                                {instance.businessKey && (
                                  <Badge variant="outline">{instance.businessKey}</Badge>
                                )}
                                {instance.duration && (
                                  <Badge variant="outline">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {formatDuration(instance.duration)}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xs text-muted-foreground">
                          Started: {new Date(instance.startTime).toLocaleString()}
                          {instance.endTime && ` • Ended: ${new Date(instance.endTime).toLocaleString()}`}
                        </div>
                        {instance.variables && Object.keys(instance.variables).length > 0 && (
                          <div className="mt-2 space-y-1">
                            <Label className="text-xs">Variables:</Label>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(instance.variables).map(([key, value]) => (
                                <Badge key={key} variant="outline" className="text-xs">
                                  {key}: {String(value)}
                                </Badge>
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

          <TabsContent value="tasks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tasks</CardTitle>
                <CardDescription>User tasks and activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tasks.map((task) => (
                    <Card key={task.id} className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow bg-gradient-to-r from-purple-50/50 to-transparent dark:from-purple-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getStatusColor(task.status)}/20`}>
                              <Workflow className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{task.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className={getStatusColor(task.status)}>
                                  {task.status}
                                </Badge>
                                {task.assignee && (
                                  <Badge variant="outline">
                                    <Users className="h-3 w-3 mr-1" />
                                    {task.assignee}
                                  </Badge>
                                )}
                                {task.priority && (
                                  <Badge variant="outline">Priority: {task.priority}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xs text-muted-foreground">
                          Created: {new Date(task.createdTime).toLocaleString()}
                          {task.dueDate && ` • Due: ${new Date(task.dueDate).toLocaleString()}`}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Process Instance: {task.processInstanceId}
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
                <CardTitle>BPMN Engine Settings</CardTitle>
                <CardDescription>Engine configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Job Execution</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Metrics</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable History</Label>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Job Execution Thread Pool Size</Label>
                  <Input type="number" defaultValue={10} min={1} />
                </div>
                <div className="space-y-2">
                  <Label>History Level</Label>
                  <Select defaultValue="full">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="activity">Activity</SelectItem>
                      <SelectItem value="audit">Audit</SelectItem>
                      <SelectItem value="full">Full</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


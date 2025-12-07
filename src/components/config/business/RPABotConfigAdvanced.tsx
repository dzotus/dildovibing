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
  Bot,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  TrendingUp
} from 'lucide-react';

interface RPABotConfigProps {
  componentId: string;
}

interface Bot {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  process: string;
  executions?: number;
  successRate?: number;
  avgDuration?: number;
  lastRun?: string;
}

interface Execution {
  id: string;
  botId: string;
  botName: string;
  status: 'success' | 'failed' | 'running';
  startTime: string;
  endTime?: string;
  duration?: number;
  steps?: number;
  errors?: number;
}

interface RPABotConfig {
  bots?: Bot[];
  executions?: Execution[];
  totalBots?: number;
  activeBots?: number;
  totalExecutions?: number;
  successRate?: number;
}

export function RPABotConfigAdvanced({ componentId }: RPABotConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as RPABotConfig;
  const bots = config.bots || [];
  const executions = config.executions || [];
  const totalBots = config.totalBots || bots.length;
  const activeBots = config.activeBots || bots.filter((b) => b.status === 'running').length;
  const totalExecutions = config.totalExecutions || executions.length;
  const successRate = config.successRate || (executions.filter((e) => e.status === 'success').length / executions.length) * 100;

  const [showCreateBot, setShowCreateBot] = useState(false);

  const updateConfig = (updates: Partial<RPABotConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const toggleBot = (id: string) => {
    const newBots = bots.map((b) =>
      b.id === id ? { ...b, status: b.status === 'running' ? 'stopped' : 'running' } : b
    );
    updateConfig({ bots: newBots });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
      case 'success':
        return 'bg-green-500';
      case 'stopped':
        return 'bg-gray-500';
      case 'error':
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0s';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">RPA Bot</p>
            <h2 className="text-2xl font-bold text-foreground">Robotic Process Automation</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Automated business process execution
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Bots</CardTitle>
                <Bot className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{activeBots}</span>
                <span className="text-xs text-muted-foreground">/ {totalBots} total</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Executions</CardTitle>
                <Activity className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalExecutions}</span>
                <span className="text-xs text-muted-foreground">total</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{successRate.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Steps</CardTitle>
                <Zap className="h-4 w-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">
                  {executions.reduce((sum, e) => sum + (e.steps || 0), 0)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="bots" className="space-y-4">
          <TabsList>
            <TabsTrigger value="bots">
              <Bot className="h-4 w-4 mr-2" />
              Bots ({bots.length})
            </TabsTrigger>
            <TabsTrigger value="executions">
              <Activity className="h-4 w-4 mr-2" />
              Executions ({executions.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bots" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>RPA Bots</CardTitle>
                    <CardDescription>Automated process bots</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateBot(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Bot
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {bots.map((bot) => (
                    <Card key={bot.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getStatusColor(bot.status)}/20`}>
                              <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{bot.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className={getStatusColor(bot.status)}>
                                  {bot.status}
                                </Badge>
                                <Badge variant="outline" className="font-mono text-xs">{bot.process}</Badge>
                                {bot.executions && (
                                  <Badge variant="outline">{bot.executions} executions</Badge>
                                )}
                                {bot.successRate && (
                                  <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20">
                                    {bot.successRate.toFixed(1)}% success
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant={bot.status === 'running' ? 'destructive' : 'default'}
                            size="sm"
                            onClick={() => toggleBot(bot.id)}
                          >
                            {bot.status === 'running' ? (
                              <>
                                <Pause className="h-4 w-4 mr-2" />
                                Stop
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-2" />
                                Start
                              </>
                            )}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          {bot.avgDuration && (
                            <div>
                              <span className="text-muted-foreground">Avg Duration:</span>
                              <span className="ml-2 font-semibold">{formatDuration(bot.avgDuration)}</span>
                            </div>
                          )}
                          {bot.lastRun && (
                            <div>
                              <span className="text-muted-foreground">Last Run:</span>
                              <span className="ml-2 font-semibold">{new Date(bot.lastRun).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="executions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Execution History</CardTitle>
                <CardDescription>Bot execution logs and results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {executions.map((exec) => (
                    <Card key={exec.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getStatusColor(exec.status)}/20`}>
                              {exec.status === 'success' ? (
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                              ) : exec.status === 'failed' ? (
                                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                              ) : (
                                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                              )}
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{exec.botName}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className={getStatusColor(exec.status)}>
                                  {exec.status}
                                </Badge>
                                {exec.duration && (
                                  <Badge variant="outline">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {formatDuration(exec.duration)}
                                  </Badge>
                                )}
                                {exec.steps && (
                                  <Badge variant="outline">{exec.steps} steps</Badge>
                                )}
                                {exec.errors && exec.errors > 0 && (
                                  <Badge variant="destructive">{exec.errors} errors</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xs text-muted-foreground">
                          Started: {new Date(exec.startTime).toLocaleString()}
                          {exec.endTime && ` • Ended: ${new Date(exec.endTime).toLocaleString()}`}
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
                <CardTitle>RPA Bot Settings</CardTitle>
                <CardDescription>Automation configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Auto-Retry</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Execution Logging</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Error Notifications</Label>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Max Retry Attempts</Label>
                  <Input type="number" defaultValue={3} min={1} max={10} />
                </div>
                <div className="space-y-2">
                  <Label>Execution Timeout (minutes)</Label>
                  <Input type="number" defaultValue={60} min={1} />
                </div>
                <div className="space-y-2">
                  <Label>Concurrent Bot Limit</Label>
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


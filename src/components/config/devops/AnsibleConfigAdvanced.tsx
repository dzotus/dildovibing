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
  Server,
  FileText,
  Users,
  Layers,
  Clock
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface AnsibleConfigProps {
  componentId: string;
}

interface Inventory {
  id: string;
  name: string;
  type: 'static' | 'dynamic';
  hosts?: Array<{
    name: string;
    groups: string[];
    variables?: Record<string, any>;
  }>;
  groups?: Array<{
    name: string;
    hosts: string[];
    variables?: Record<string, any>;
  }>;
}

interface JobTemplate {
  id: string;
  name: string;
  playbook: string;
  inventory: string;
  enabled: boolean;
  become?: boolean;
  becomeUser?: string;
  forks?: number;
  timeout?: number;
  lastRun?: {
    id: string;
    status: 'running' | 'successful' | 'failed';
    startedAt: string;
    finishedAt?: string;
  };
}

interface Job {
  id: string;
  template: string;
  status: 'running' | 'successful' | 'failed' | 'canceled';
  startedAt: string;
  finishedAt?: string;
  duration?: number;
  hosts?: Array<{
    name: string;
    status: 'ok' | 'changed' | 'failed' | 'skipped' | 'unreachable';
  }>;
}

interface AnsibleConfig {
  inventories?: Inventory[];
  jobTemplates?: JobTemplate[];
  jobs?: Job[];
  totalInventories?: number;
  totalTemplates?: number;
  activeJobs?: number;
  successfulJobs?: number;
}

export function AnsibleConfigAdvanced({ componentId }: AnsibleConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as AnsibleConfig;
  const inventories = config.inventories || [
    {
      id: '1',
      name: 'production',
      type: 'static',
      hosts: [
        { name: 'web1.example.com', groups: ['web'], variables: { ansible_user: 'ubuntu' } },
        { name: 'db1.example.com', groups: ['database'], variables: { ansible_user: 'ubuntu' } },
      ],
      groups: [
        { name: 'web', hosts: ['web1.example.com'], variables: {} },
        { name: 'database', hosts: ['db1.example.com'], variables: {} },
      ],
    },
  ];
  const jobTemplates = config.jobTemplates || [
    {
      id: '1',
      name: 'Deploy Application',
      playbook: 'deploy.yml',
      inventory: 'production',
      enabled: true,
      become: true,
      becomeUser: 'root',
      forks: 5,
      timeout: 3600,
    },
  ];
  const jobs = config.jobs || [
    {
      id: '1',
      template: 'Deploy Application',
      status: 'successful',
      startedAt: new Date().toISOString(),
      finishedAt: new Date(Date.now() + 120000).toISOString(),
      duration: 120,
      hosts: [
        { name: 'web1.example.com', status: 'ok' },
        { name: 'db1.example.com', status: 'ok' },
      ],
    },
  ];
  const totalInventories = config.totalInventories || inventories.length;
  const totalTemplates = config.totalTemplates || jobTemplates.length;
  const activeJobs = config.activeJobs || jobs.filter((j) => j.status === 'running').length;
  const successfulJobs = config.successfulJobs || jobs.filter((j) => j.status === 'successful').length;

  const [editingInventoryIndex, setEditingInventoryIndex] = useState<number | null>(null);
  const [editingTemplateIndex, setEditingTemplateIndex] = useState<number | null>(null);
  const [showCreateInventory, setShowCreateInventory] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);

  const updateConfig = (updates: Partial<AnsibleConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addInventory = () => {
    const newInventory: Inventory = {
      id: `inv-${Date.now()}`,
      name: 'new-inventory',
      type: 'static',
      hosts: [],
      groups: [],
    };
    updateConfig({ inventories: [...inventories, newInventory] });
    setShowCreateInventory(false);
  };

  const removeInventory = (id: string) => {
    updateConfig({ inventories: inventories.filter((i) => i.id !== id) });
  };

  const updateInventory = (id: string, field: string, value: any) => {
    const newInventories = inventories.map((i) =>
      i.id === id ? { ...i, [field]: value } : i
    );
    updateConfig({ inventories: newInventories });
  };

  const addJobTemplate = () => {
    const newTemplate: JobTemplate = {
      id: `template-${Date.now()}`,
      name: 'New Template',
      playbook: 'playbook.yml',
      inventory: inventories[0]?.name || '',
      enabled: true,
      become: false,
      forks: 5,
      timeout: 3600,
    };
    updateConfig({ jobTemplates: [...jobTemplates, newTemplate] });
    setShowCreateTemplate(false);
  };

  const removeJobTemplate = (id: string) => {
    updateConfig({ jobTemplates: jobTemplates.filter((t) => t.id !== id) });
  };

  const updateJobTemplate = (id: string, field: string, value: any) => {
    const newTemplates = jobTemplates.map((t) =>
      t.id === id ? { ...t, [field]: value } : t
    );
    updateConfig({ jobTemplates: newTemplates });
  };

  const launchJob = (templateId: string) => {
    const template = jobTemplates.find((t) => t.id === templateId);
    if (!template) return;

    const newJob: Job = {
      id: `job-${Date.now()}`,
      template: template.name,
      status: 'running',
      startedAt: new Date().toISOString(),
    };
    updateConfig({ jobs: [newJob, ...jobs.slice(0, 9)] });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Ansible</p>
            <h2 className="text-2xl font-bold text-foreground">Configuration Management</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage inventories, job templates, and automation jobs
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Inventories</CardTitle>
                <Server className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalInventories}</span>
                <span className="text-xs text-muted-foreground">configured</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Job Templates</CardTitle>
                <FileText className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{totalTemplates}</span>
                <span className="text-xs text-muted-foreground">available</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Jobs</CardTitle>
                <Activity className="h-4 w-4 text-cyan-500 animate-pulse" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{activeJobs}</span>
                <span className="text-xs text-muted-foreground">running</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Successful</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{successfulJobs}</span>
                <span className="text-xs text-muted-foreground">completed</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="inventories" className="space-y-4">
          <TabsList>
            <TabsTrigger value="inventories">
              <Server className="h-4 w-4 mr-2" />
              Inventories ({inventories.length})
            </TabsTrigger>
            <TabsTrigger value="templates">
              <FileText className="h-4 w-4 mr-2" />
              Job Templates ({jobTemplates.length})
            </TabsTrigger>
            <TabsTrigger value="jobs">
              <Play className="h-4 w-4 mr-2" />
              Jobs ({jobs.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inventories" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Inventories</CardTitle>
                    <CardDescription>Manage host inventories</CardDescription>
                  </div>
                  <Button onClick={addInventory} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Inventory
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {inventories.map((inventory) => (
                    <Card key={inventory.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                              <Server className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{inventory.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="font-medium">
                                  {inventory.type === 'static' ? 'Static' : 'Dynamic'}
                                </Badge>
                                {inventory.hosts && (
                                  <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20">
                                    <Server className="h-3 w-3 mr-1" />
                                    {inventory.hosts.length} hosts
                                  </Badge>
                                )}
                                {inventory.groups && (
                                  <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/20">
                                    <Layers className="h-3 w-3 mr-1" />
                                    {inventory.groups.length} groups
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeInventory(inventory.id)}
                            disabled={inventories.length === 1}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Inventory Name</Label>
                            <Input
                              value={inventory.name}
                              onChange={(e) => updateInventory(inventory.id, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Inventory Type</Label>
                            <Select
                              value={inventory.type}
                              onValueChange={(value: 'static' | 'dynamic') => updateInventory(inventory.id, 'type', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="static">Static</SelectItem>
                                <SelectItem value="dynamic">Dynamic</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {inventory.hosts && inventory.hosts.length > 0 && (
                          <div className="space-y-2">
                            <Label>Hosts</Label>
                            <div className="space-y-1">
                              {inventory.hosts.map((host, idx) => (
                                <Badge key={idx} variant="outline" className="mr-2">
                                  {host.name}
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

          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Job Templates</CardTitle>
                    <CardDescription>Configure automation job templates</CardDescription>
                  </div>
                  <Button onClick={addJobTemplate} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {jobTemplates.map((template) => (
                    <Card key={template.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                              <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{template.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant={template.enabled ? 'default' : 'outline'} className={template.enabled ? 'bg-green-500' : ''}>
                                  {template.enabled ? (
                                    <>
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Enabled
                                    </>
                                  ) : (
                                    'Disabled'
                                  )}
                                </Badge>
                                <Badge variant="outline" className="font-mono text-xs">
                                  <FileText className="h-3 w-3 mr-1" />
                                  {template.playbook}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  <Server className="h-3 w-3 mr-1" />
                                  {template.inventory}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => launchJob(template.id)}
                              disabled={!template.enabled}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Launch
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeJobTemplate(template.id)}
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
                            <Label>Template Name</Label>
                            <Input
                              value={template.name}
                              onChange={(e) => updateJobTemplate(template.id, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Playbook</Label>
                            <Input
                              value={template.playbook}
                              onChange={(e) => updateJobTemplate(template.id, 'playbook', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Inventory</Label>
                            <Select
                              value={template.inventory}
                              onValueChange={(value) => updateJobTemplate(template.id, 'inventory', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {inventories.map((inv) => (
                                  <SelectItem key={inv.id} value={inv.name}>{inv.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Enabled</Label>
                            <Switch
                              checked={template.enabled}
                              onCheckedChange={(checked) => updateJobTemplate(template.id, 'enabled', checked)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Become (sudo)</Label>
                            <Switch
                              checked={template.become ?? false}
                              onCheckedChange={(checked) => updateJobTemplate(template.id, 'become', checked)}
                            />
                          </div>
                          {template.become && (
                            <div className="space-y-2">
                              <Label>Become User</Label>
                              <Input
                                value={template.becomeUser || 'root'}
                                onChange={(e) => updateJobTemplate(template.id, 'becomeUser', e.target.value)}
                              />
                            </div>
                          )}
                          <div className="space-y-2">
                            <Label>Forks</Label>
                            <Input
                              type="number"
                              value={template.forks || 5}
                              onChange={(e) => updateJobTemplate(template.id, 'forks', Number(e.target.value))}
                              min={1}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Timeout (seconds)</Label>
                            <Input
                              type="number"
                              value={template.timeout || 3600}
                              onChange={(e) => updateJobTemplate(template.id, 'timeout', Number(e.target.value))}
                              min={1}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Job History</CardTitle>
                <CardDescription>Execution history and status</CardDescription>
              </CardHeader>
              <CardContent>
                {jobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No jobs executed</p>
                ) : (
                  <div className="space-y-2">
                    {jobs.map((job) => (
                      <Card
                        key={job.id}
                        className={`border-l-4 hover:shadow-md transition-all ${
                          job.status === 'successful' ? 'border-l-green-500 bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/10' :
                          job.status === 'failed' ? 'border-l-red-500 bg-gradient-to-r from-red-50/50 to-transparent dark:from-red-950/10' :
                          job.status === 'running' ? 'border-l-blue-500 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10' : 'border-l-gray-500 bg-gradient-to-r from-gray-50/50 to-transparent dark:from-gray-950/10'
                        }`}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${
                              job.status === 'successful' ? 'bg-green-100 dark:bg-green-900/30' :
                              job.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30' :
                              job.status === 'running' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-900/30'
                            }`}>
                              {job.status === 'successful' && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />}
                              {job.status === 'failed' && <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />}
                              {job.status === 'running' && <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-pulse" />}
                              {job.status === 'canceled' && <XCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={
                                  job.status === 'successful' ? 'default' :
                                  job.status === 'failed' ? 'destructive' :
                                  job.status === 'running' ? 'secondary' : 'outline'
                                } className="font-medium">
                                  {job.status}
                                </Badge>
                                <span className="font-semibold text-base">{job.template}</span>
                              </div>
                              {job.hosts && (
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  {job.hosts.map((host, idx) => (
                                    <Badge key={idx} variant={
                                      host.status === 'ok' ? 'default' :
                                      host.status === 'failed' ? 'destructive' : 'outline'
                                    } className="text-xs">
                                      {host.status === 'ok' && <CheckCircle className="h-3 w-3 mr-1" />}
                                      {host.status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                                      {host.name}: {host.status}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(job.startedAt).toLocaleString()}
                                </div>
                                {job.finishedAt && (
                                  <div className="flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    {new Date(job.finishedAt).toLocaleString()}
                                  </div>
                                )}
                                {job.duration && (
                                  <div className="flex items-center gap-1">
                                    <Activity className="h-3 w-3" />
                                    {job.duration}s
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

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Ansible Settings</CardTitle>
                <CardDescription>Global configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Default Forks</Label>
                  <Input type="number" defaultValue={5} min={1} />
                </div>
                <div className="space-y-2">
                  <Label>Default Timeout (seconds)</Label>
                  <Input type="number" defaultValue={3600} min={1} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Enable Host Key Checking</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Gathering Facts</Label>
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


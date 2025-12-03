import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Rocket, 
  CheckCircle2, 
  Settings, 
  Activity,
  RefreshCw,
  XCircle,
  Clock,
  Plus,
  Trash2,
  GitBranch
} from 'lucide-react';

interface ArgoCDConfigProps {
  componentId: string;
}

interface Application {
  name: string;
  namespace: string;
  status: 'synced' | 'outofsync' | 'progressing' | 'degraded';
  health: 'healthy' | 'degraded' | 'progressing' | 'suspended' | 'missing' | 'unknown';
  syncPolicy: 'auto' | 'manual';
  lastSync?: string;
}

interface ArgoCDConfig {
  serverUrl?: string;
  applications?: Application[];
  syncedApps?: number;
  outOfSyncApps?: number;
  totalApps?: number;
}

export function ArgoCDConfigAdvanced({ componentId }: ArgoCDConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as ArgoCDConfig;
  const serverUrl = config.serverUrl || 'https://argocd.example.com';
  const applications = config.applications || [
    { name: 'web-app', namespace: 'production', status: 'synced', health: 'healthy', syncPolicy: 'auto', lastSync: '2m ago' },
    { name: 'api-service', namespace: 'staging', status: 'outofsync', health: 'healthy', syncPolicy: 'manual', lastSync: '15m ago' },
    { name: 'worker', namespace: 'production', status: 'progressing', health: 'progressing', syncPolicy: 'auto', lastSync: '1m ago' },
  ];
  const syncedApps = config.syncedApps || applications.filter(a => a.status === 'synced').length;
  const outOfSyncApps = config.outOfSyncApps || applications.filter(a => a.status === 'outofsync').length;
  const totalApps = config.totalApps || applications.length;

  const updateConfig = (updates: Partial<ArgoCDConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addApplication = () => {
    updateConfig({
      applications: [...applications, { name: 'new-app', namespace: 'default', status: 'progressing', health: 'progressing', syncPolicy: 'manual' }],
    });
  };

  const removeApplication = (index: number) => {
    updateConfig({ applications: applications.filter((_, i) => i !== index) });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'outofsync':
        return <XCircle className="h-4 w-4 text-yellow-500" />;
      case 'progressing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'degraded':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'healthy':
        return <Badge variant="default" className="bg-green-500">Healthy</Badge>;
      case 'degraded':
        return <Badge variant="destructive">Degraded</Badge>;
      case 'progressing':
        return <Badge variant="default" className="bg-blue-500">Progressing</Badge>;
      default:
        return <Badge variant="secondary">{health}</Badge>;
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Rocket className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Argo CD</h2>
              <p className="text-sm text-muted-foreground mt-1">
                GitOps Continuous Deployment
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Connected
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalApps}</div>
              <p className="text-xs text-muted-foreground mt-1">Total apps</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Synced</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{syncedApps}</div>
              <p className="text-xs text-muted-foreground mt-1">In sync</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Out of Sync</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{outOfSyncApps}</div>
              <p className="text-xs text-muted-foreground mt-1">Needs sync</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sync Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round((syncedApps / totalApps) * 100)}%</div>
              <p className="text-xs text-muted-foreground mt-1">Synced</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Configuration Tabs */}
        <Tabs defaultValue="applications" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="applications" className="gap-2">
              <Rocket className="h-4 w-4" />
              Applications
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Applications Tab */}
          <TabsContent value="applications" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Applications</CardTitle>
                    <CardDescription>GitOps application deployments</CardDescription>
                  </div>
                  <Button size="sm" onClick={addApplication} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    New Application
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {applications.map((app, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(app.status)}
                            <div>
                              <CardTitle className="text-lg">{app.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                Namespace: {app.namespace} • {app.syncPolicy} sync
                                {app.lastSync && ` • Last sync: ${app.lastSync}`}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getHealthBadge(app.health)}
                            {applications.length > 1 && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeApplication(index)}
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

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Argo CD Server</CardTitle>
                <CardDescription>Server configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="server-url">Server URL</Label>
                  <Input
                    id="server-url"
                    value={serverUrl}
                    onChange={(e) => updateConfig({ serverUrl: e.target.value })}
                    placeholder="https://argocd.example.com"
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sync Status</span>
                    <span className="font-semibold">{syncedApps}/{totalApps} synced</span>
                  </div>
                  <Progress value={(syncedApps / totalApps) * 100} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


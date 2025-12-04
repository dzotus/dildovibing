import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  Container, 
  Layers, 
  Settings, 
  Activity,
  Play,
  Pause,
  RefreshCw,
  Plus,
  Trash2,
  Cpu,
  HardDrive,
  MemoryStick
} from 'lucide-react';

interface DockerK8sConfigProps {
  componentId: string;
}

interface Container {
  id: string;
  name: string;
  image: string;
  status: 'running' | 'stopped' | 'paused';
  cpu?: number;
  memory?: string;
}

interface DockerK8sConfig {
  image?: string;
  replicas?: number;
  memory?: string;
  cpu?: string;
  environment?: Record<string, string>;
  yaml?: string;
  containers?: Container[];
  pods?: Container[];
  totalCpu?: number;
  totalMemory?: string;
}

export function DockerK8sConfigAdvanced({ componentId }: DockerK8sConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as DockerK8sConfig;
  const image = config.image || 'nginx:latest';
  const replicas = config.replicas || 1;
  const memory = config.memory || '512Mi';
  const cpu = config.cpu || '500m';
  const yaml = config.yaml || (node.type === 'docker' 
    ? `FROM nginx:latest\nCOPY . /usr/share/nginx/html\nEXPOSE 80\nCMD ["nginx", "-g", "daemon off;"]`
    : `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: app-deployment\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: myapp\n  template:\n    metadata:\n      labels:\n        app: myapp\n    spec:\n      containers:\n      - name: myapp\n        image: nginx:latest\n        ports:\n        - containerPort: 80`
  );
  const containers = config.containers || (node.type === 'docker' ? [
    { id: '1', name: 'web-server', image: 'nginx:latest', status: 'running', cpu: 15, memory: '128Mi' },
    { id: '2', name: 'api-server', image: 'node:18', status: 'running', cpu: 25, memory: '256Mi' },
  ] : []);
  const pods = config.pods || (node.type === 'kubernetes' ? [
    { id: 'pod-1', name: 'app-pod-1', image: 'nginx:latest', status: 'running', cpu: 20, memory: '256Mi' },
    { id: 'pod-2', name: 'app-pod-2', image: 'nginx:latest', status: 'running', cpu: 18, memory: '240Mi' },
    { id: 'pod-3', name: 'app-pod-3', image: 'nginx:latest', status: 'running', cpu: 22, memory: '260Mi' },
  ] : []);
  const totalCpu = config.totalCpu || (node.type === 'docker' 
    ? containers.reduce((sum, c) => sum + (c.cpu || 0), 0)
    : pods.reduce((sum, p) => sum + (p.cpu || 0), 0)
  );
  const totalMemory = config.totalMemory || '1.2Gi';

  const updateConfig = (updates: Partial<DockerK8sConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const getTitle = () => {
    return node.type === 'docker' ? 'Docker' : 'Kubernetes';
  };

  const getConfigLabel = () => {
    return node.type === 'docker' ? 'Dockerfile' : 'Deployment YAML';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="h-4 w-4 text-green-500" />;
      case 'stopped':
        return <Pause className="h-4 w-4 text-red-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      default:
        return <Pause className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge variant="default" className="bg-green-500">Running</Badge>;
      case 'stopped':
        return <Badge variant="destructive">Stopped</Badge>;
      case 'paused':
        return <Badge variant="secondary">Paused</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const items = node.type === 'docker' ? containers : pods;
  const itemLabel = node.type === 'docker' ? 'Container' : 'Pod';

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              {node.type === 'docker' ? (
                <Container className="h-6 w-6 text-blue-500" />
              ) : (
                <Layers className="h-6 w-6 text-blue-500" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">{getTitle()} Configuration</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {node.type === 'docker' ? 'Container Management' : 'Container Orchestration'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Active
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
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {node.type === 'docker' ? 'Containers' : 'Pods'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{items.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Total {itemLabel.toLowerCase()}s</p>
            </CardContent>
          </Card>
          {node.type === 'kubernetes' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Replicas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{replicas}</div>
                <p className="text-xs text-muted-foreground mt-1">Desired</p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">CPU</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCpu}%</div>
              <p className="text-xs text-muted-foreground mt-1">Total usage</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Memory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalMemory}</div>
              <p className="text-xs text-muted-foreground mt-1">Total usage</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Configuration Tabs */}
        <Tabs defaultValue={node.type === 'docker' ? 'containers' : 'pods'} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value={node.type === 'docker' ? 'containers' : 'pods'} className="gap-2">
              <Container className="h-4 w-4" />
              {node.type === 'docker' ? 'Containers' : 'Pods'}
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2">
              <Layers className="h-4 w-4" />
              {getConfigLabel()}
            </TabsTrigger>
          </TabsList>

          {/* Containers/Pods Tab */}
          <TabsContent value={node.type === 'docker' ? 'containers' : 'pods'} className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{node.type === 'docker' ? 'Containers' : 'Pods'}</CardTitle>
                <CardDescription>
                  {node.type === 'docker' ? 'Running containers' : 'Deployed pods'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <Card key={index} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            {getStatusIcon(item.status)}
                            <div className="flex-1">
                              <CardTitle className="text-lg">{item.name}</CardTitle>
                              <CardDescription className="text-xs mt-1">
                                {item.image}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(item.status)}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">CPU:</span>
                            <span className="ml-2 font-semibold">{item.cpu || 0}%</span>
                            <Progress value={item.cpu || 0} className="h-1 mt-1" />
                          </div>
                          <div>
                            <span className="text-muted-foreground">Memory:</span>
                            <span className="ml-2 font-semibold">{item.memory || '0Mi'}</span>
                          </div>
                        </div>
                      </CardContent>
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
                <CardTitle>Container Settings</CardTitle>
                <CardDescription>Basic container configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="image">Image</Label>
                  <Input
                    id="image"
                    value={image}
                    onChange={(e) => updateConfig({ image: e.target.value })}
                    placeholder="nginx:latest"
                  />
                </div>

                {node.type === 'kubernetes' && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="replicas">Replicas</Label>
                      <Input
                        id="replicas"
                        type="number"
                        min="1"
                        value={replicas}
                        onChange={(e) => updateConfig({ replicas: parseInt(e.target.value) || 1 })}
                        placeholder="1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="memory">Memory</Label>
                      <Input
                        id="memory"
                        value={memory}
                        onChange={(e) => updateConfig({ memory: e.target.value })}
                        placeholder="512Mi"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cpu">CPU</Label>
                      <Input
                        id="cpu"
                        value={cpu}
                        onChange={(e) => updateConfig({ cpu: e.target.value })}
                        placeholder="500m"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Config Tab */}
          <TabsContent value="config" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{getConfigLabel()}</CardTitle>
                <CardDescription>
                  {node.type === 'docker' ? 'Docker configuration file' : 'Kubernetes manifest'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="yaml">Configuration</Label>
                  <Textarea
                    id="yaml"
                    value={yaml}
                    onChange={(e) => updateConfig({ yaml: e.target.value })}
                    className="font-mono text-sm h-96"
                    placeholder={`Enter ${getConfigLabel()} configuration...`}
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


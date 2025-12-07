import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

interface InfrastructureConfigProps {
  componentId: string;
}

interface InfrastructureConfig {
  image?: string;
  replicas?: number;
  memory?: string;
  cpu?: string;
  environment?: Record<string, string>;
  yaml?: string;
}

export function InfrastructureConfig({ componentId }: InfrastructureConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as InfrastructureConfig;
  const image = config.image || 'nginx:latest';
  const replicas = config.replicas || 1;
  const memory = config.memory || '512Mi';
  const cpu = config.cpu || '500m';
  const yaml = config.yaml || (node.type === 'docker' 
    ? `FROM nginx:latest\nCOPY . /usr/share/nginx/html\nEXPOSE 80\nCMD ["nginx", "-g", "daemon off;"]`
    : `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: app-deployment\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: myapp\n  template:\n    metadata:\n      labels:\n        app: myapp\n    spec:\n      containers:\n      - name: myapp\n        image: nginx:latest\n        ports:\n        - containerPort: 80`
  );

  const updateConfig = (updates: Partial<InfrastructureConfig>) => {
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

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{getTitle()} Configuration</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure container and orchestration settings
          </p>
        </div>

        <Separator />

        {/* Basic Settings */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Container Settings</h3>
            <p className="text-sm text-muted-foreground">Basic container configuration</p>
          </div>

          <div className="space-y-4">
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
          </div>
        </div>

        <Separator />

        {/* Configuration File */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{getConfigLabel()}</h3>
            <p className="text-sm text-muted-foreground">
              {node.type === 'docker' ? 'Docker configuration file' : 'Kubernetes manifest'}
            </p>
          </div>

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
        </div>
      </div>
    </div>
  );
}

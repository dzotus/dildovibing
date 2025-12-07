import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

interface NginxConfigProps {
  componentId: string;
}

interface NginxConfig {
  port?: number;
  serverName?: string;
  maxWorkers?: number;
  config?: string;
}

export function NginxConfig({ componentId }: NginxConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as NginxConfig;
  const port = config.port || 80;
  const serverName = config.serverName || 'localhost';
  const maxWorkers = config.maxWorkers || 4;
  const nginxConfig = config.config || `server {
  listen 80;
  server_name localhost;

  location / {
    proxy_pass http://backend:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}`;

  const updateConfig = (updates: Partial<NginxConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">NGINX Configuration</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure NGINX web server and reverse proxy settings
          </p>
        </div>

        <Separator />

        {/* Basic Settings */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Basic Settings</h3>
            <p className="text-sm text-muted-foreground">Server configuration parameters</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                value={port}
                onChange={(e) => updateConfig({ port: parseInt(e.target.value) || 80 })}
                placeholder="80"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="server-name">Server Name</Label>
              <Input
                id="server-name"
                value={serverName}
                onChange={(e) => updateConfig({ serverName: e.target.value })}
                placeholder="localhost"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-workers">Worker Processes</Label>
            <Input
              id="max-workers"
              type="number"
              min="1"
              value={maxWorkers}
              onChange={(e) => updateConfig({ maxWorkers: parseInt(e.target.value) || 4 })}
              placeholder="4"
            />
          </div>
        </div>

        <Separator />

        {/* Configuration File */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Server Block Configuration</h3>
            <p className="text-sm text-muted-foreground">NGINX server block configuration</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="config">Configuration</Label>
            <Textarea
              id="config"
              value={nginxConfig}
              onChange={(e) => updateConfig({ config: e.target.value })}
              className="font-mono text-sm h-96"
              placeholder="Enter NGINX configuration..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

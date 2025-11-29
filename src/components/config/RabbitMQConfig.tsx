import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RabbitMQConfigProps {
  componentId: string;
}

interface Queue {
  name: string;
  durable: boolean;
  exclusive: boolean;
  autoDelete: boolean;
}

interface RabbitMQConfig {
  host?: string;
  port?: number;
  username?: string;
  vhost?: string;
  queues?: Queue[];
}

export function RabbitMQConfig({ componentId }: RabbitMQConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as RabbitMQConfig;
  const host = config.host || 'localhost';
  const port = config.port || 5672;
  const username = config.username || 'guest';
  const vhost = config.vhost || '/';
  const queues = config.queues || [
    { name: 'default-queue', durable: true, exclusive: false, autoDelete: false },
  ];

  const updateConfig = (updates: Partial<RabbitMQConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addQueue = () => {
    updateConfig({
      queues: [
        ...queues,
        { name: 'new-queue', durable: true, exclusive: false, autoDelete: false },
      ],
    });
  };

  const removeQueue = (index: number) => {
    updateConfig({ queues: queues.filter((_, i) => i !== index) });
  };

  const updateQueue = (index: number, field: string, value: string | boolean) => {
    const newQueues = [...queues];
    newQueues[index] = { ...newQueues[index], [field]: value };
    updateConfig({ queues: newQueues });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">RabbitMQ Configuration</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure RabbitMQ connection and queue settings
          </p>
        </div>

        <Separator />

        {/* Connection Settings */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Connection</h3>
            <p className="text-sm text-muted-foreground">RabbitMQ server connection details</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                value={host}
                onChange={(e) => updateConfig({ host: e.target.value })}
                placeholder="localhost"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                value={port}
                onChange={(e) => updateConfig({ port: parseInt(e.target.value) || 5672 })}
                placeholder="5672"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => updateConfig({ username: e.target.value })}
                placeholder="guest"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vhost">Virtual Host</Label>
              <Input
                id="vhost"
                value={vhost}
                onChange={(e) => updateConfig({ vhost: e.target.value })}
                placeholder="/"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Queues Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Queues</h3>
              <p className="text-sm text-muted-foreground">Message queue configuration</p>
            </div>
            <Button size="sm" onClick={addQueue} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Queue
            </Button>
          </div>

          <div className="space-y-4">
            {queues.map((queue, index) => (
              <div key={index} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Queue {index + 1}</Label>
                  {queues.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeQueue(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`queue-name-${index}`}>Name</Label>
                  <Input
                    id={`queue-name-${index}`}
                    value={queue.name}
                    onChange={(e) => updateQueue(index, 'name', e.target.value)}
                    placeholder="queue-name"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`queue-durable-${index}`}>Durable</Label>
                    <Select
                      value={queue.durable ? 'true' : 'false'}
                      onValueChange={(value) => updateQueue(index, 'durable', value === 'true')}
                    >
                      <SelectTrigger id={`queue-durable-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`queue-exclusive-${index}`}>Exclusive</Label>
                    <Select
                      value={queue.exclusive ? 'true' : 'false'}
                      onValueChange={(value) => updateQueue(index, 'exclusive', value === 'true')}
                    >
                      <SelectTrigger id={`queue-exclusive-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`queue-autodelete-${index}`}>Auto Delete</Label>
                    <Select
                      value={queue.autoDelete ? 'true' : 'false'}
                      onValueChange={(value) => updateQueue(index, 'autoDelete', value === 'true')}
                    >
                      <SelectTrigger id={`queue-autodelete-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

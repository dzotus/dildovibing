import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

interface DatabaseConfigProps {
  componentId: string;
}

interface DatabaseConfig {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  maxConnections?: number;
  schema?: string;
}

export function DatabaseConfig({ componentId }: DatabaseConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config: DatabaseConfig = node.data.config || {};
  const host = config.host || 'localhost';
  const port = config.port || (node.type === 'postgres' ? 5432 : node.type === 'mongodb' ? 27017 : 6379);
  const database = config.database || 'default_db';
  const username = config.username || 'admin';
  const maxConnections = config.maxConnections || 100;
  const schema = config.schema || '';

  const updateConfig = (updates: Partial<DatabaseConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const getDbName = () => {
    switch (node.type) {
      case 'postgres':
        return 'PostgreSQL';
      case 'mongodb':
        return 'MongoDB';
      case 'redis':
        return 'Redis';
      default:
        return 'Database';
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{getDbName()} Configuration</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure database connection and settings
          </p>
        </div>

        <Separator />

        {/* Connection Settings */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Connection</h3>
            <p className="text-sm text-muted-foreground">Database server connection details</p>
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
                onChange={(e) => updateConfig({ port: parseInt(e.target.value) || port })}
                placeholder={port.toString()}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="database">Database Name</Label>
              <Input
                id="database"
                value={database}
                onChange={(e) => updateConfig({ database: e.target.value })}
                placeholder="default_db"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => updateConfig({ username: e.target.value })}
                placeholder="admin"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Performance Settings */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Performance</h3>
            <p className="text-sm text-muted-foreground">Database performance configuration</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-connections">Max Connections</Label>
            <Input
              id="max-connections"
              type="number"
              min="1"
              value={maxConnections}
              onChange={(e) => updateConfig({ maxConnections: parseInt(e.target.value) || 100 })}
              placeholder="100"
            />
          </div>
        </div>

        {node.type === 'postgres' && (
          <>
            <Separator />
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Schema</h3>
                <p className="text-sm text-muted-foreground">Database schema definition (SQL)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="schema">SQL Schema</Label>
                <Textarea
                  id="schema"
                  value={schema}
                  onChange={(e) => updateConfig({ schema: e.target.value })}
                  placeholder="CREATE TABLE users (&#10;  id SERIAL PRIMARY KEY,&#10;  username VARCHAR(50),&#10;  email VARCHAR(100)&#10;);"
                  className="font-mono text-sm h-48"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/store/useCanvasStore';
import { ConnectionPropertiesPanel } from '@/components/config/ConnectionPropertiesPanel';
import { Settings2, X } from 'lucide-react';

export function PropertiesPanel() {
  const { selectedNodeId, nodes, updateNode, selectNode, connections, updateConnection, selectedConnectionId, selectConnection } = useCanvasStore();
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedConnection = connections.find((c) => c.id === selectedConnectionId);

  if (!selectedNode && !selectedConnection) {
    return (
      <div className="w-80 h-full bg-card border-l border-border flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Properties</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">No element selected</p>
        </div>
      </div>
    );
  }

  // Render connection properties
  if (selectedConnection) {
    return (
      <div className="w-80 h-full bg-card border-l border-border flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Connection</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => selectConnection(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            <ConnectionPropertiesPanel
              connection={selectedConnection}
              onUpdate={(id, updates) => updateConnection(id, updates)}
            />
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="w-80 h-full bg-card border-l border-border flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Properties</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => selectNode(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div>
            <Label htmlFor="label" className="text-xs font-medium">
              Label
            </Label>
            <Input
              id="label"
              value={selectedNode!.data.label}
              onChange={(e) =>
                updateNode(selectedNode!.id, {
                  data: { ...selectedNode!.data, label: e.target.value },
                })
              }
              className="mt-1.5"
            />
          </div>

          <Separator />

          <div>
            <h3 className="text-xs font-semibold mb-2">Position</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="pos-x" className="text-xs text-muted-foreground">
                  X
                </Label>
                <Input
                  id="pos-x"
                  type="number"
                  value={Math.round(selectedNode!.position.x)}
                  onChange={(e) =>
                    updateNode(selectedNode!.id, {
                      position: {
                        ...selectedNode!.position,
                        x: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="pos-y" className="text-xs text-muted-foreground">
                  Y
                </Label>
                <Input
                  id="pos-y"
                  type="number"
                  value={Math.round(selectedNode!.position.y)}
                  onChange={(e) =>
                    updateNode(selectedNode!.id, {
                      position: {
                        ...selectedNode!.position,
                        y: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-xs font-semibold mb-2">Component Type</h3>
            <div className="bg-secondary/50 rounded-md p-3 border border-border">
              <p className="text-sm font-mono">{selectedNode!.type}</p>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-xs font-semibold mb-2">Configuration</h3>
            <Button variant="outline" size="sm" className="w-full">
              Open Configuration Panel
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

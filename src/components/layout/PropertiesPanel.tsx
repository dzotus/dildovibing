import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useCanvasStore } from '@/store/useCanvasStore';
import { ConnectionPropertiesPanel } from '@/components/config/ConnectionPropertiesPanel';
import { ComponentStateControl } from '@/components/config/ComponentStateControl';
import { ProblemFilters } from '@/components/emulation/ProblemFilters';
import { DiagnosticsPanel } from '@/components/emulation/DiagnosticsPanel';
import { AlertsPanel } from '@/components/emulation/AlertsPanel';
import { SystemStatsPanel } from '@/components/emulation/SystemStatsPanel';
import { GroupPropertiesPanel } from '@/components/config/GroupPropertiesPanel';
import { Settings2, X } from 'lucide-react';

export function PropertiesPanel() {
  const { selectedNodeId, nodes, updateNode, selectNode, connections, updateConnection, selectedConnectionId, selectConnection, selectedGroupId, groups, selectGroup } = useCanvasStore();
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedConnection = connections.find((c) => c.id === selectedConnectionId);
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  // Render group properties
  if (selectedGroup) {
    return (
      <div className="w-80 h-full bg-card border-l border-border flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Group Properties</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => selectGroup(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            <GroupPropertiesPanel group={selectedGroup} />
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (!selectedNode && !selectedConnection) {
    return (
      <div className="w-80 h-full bg-card border-l border-border flex flex-col">
        <Tabs defaultValue="stats" className="h-full flex flex-col">
          <div className="p-4 border-b border-border">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="stats">Stats</TabsTrigger>
              <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
              <TabsTrigger value="filters">Filters</TabsTrigger>
              <TabsTrigger value="properties">Properties</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="stats" className="flex-1 m-0 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">
                <SystemStatsPanel />
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="diagnostics" className="flex-1 m-0 p-0 overflow-hidden">
            <DiagnosticsPanel />
          </TabsContent>
          <TabsContent value="alerts" className="flex-1 m-0 p-0 overflow-hidden">
            <AlertsPanel />
          </TabsContent>
          <TabsContent value="filters" className="flex-1 m-0 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">
                <ProblemFilters />
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="properties" className="flex-1 m-0 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-2">Groups ({groups.length})</h3>
                  {groups.length > 0 ? (
                    <div className="space-y-2">
                      {groups.map((group) => (
                        <div
                          key={group.id}
                          className="p-3 bg-secondary/50 rounded border border-border cursor-pointer hover:bg-secondary transition-colors"
                          onClick={() => selectGroup(group.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{group.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {group.nodeIds.length} component{group.nodeIds.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                            <div
                              className="w-4 h-4 rounded border-2 border-border flex-shrink-0"
                              style={{ backgroundColor: group.color || 'hsl(var(--primary))' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No groups created yet
                    </p>
                  )}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
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
          {/* Component State Control */}
          <ComponentStateControl 
            componentId={selectedNode!.id}
            componentLabel={selectedNode!.data.label}
          />

          <Separator />

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

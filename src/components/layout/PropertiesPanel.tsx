import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useTabStore } from '@/store/useTabStore';
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
  const { addTab } = useTabStore();
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedConnection = connections.find((c) => c.id === selectedConnectionId);
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  // Render group properties
  if (selectedGroup) {
    return (
      <div className="w-56 md:w-64 lg:w-72 h-full bg-card border-l border-border flex flex-col">
        <div className="p-2 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-xs font-semibold text-foreground">Group Properties</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => selectGroup(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            <GroupPropertiesPanel group={selectedGroup} />
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (!selectedNode && !selectedConnection) {
    return (
      <div className="w-56 md:w-64 lg:w-72 h-full bg-card border-l border-border flex flex-col">
        <Tabs defaultValue="stats" className="h-full flex flex-col">
          <div className="p-1.5 border-b border-border">
            <TabsList className="grid w-full grid-cols-5 h-6 gap-0.5 p-0.5">
              <TabsTrigger value="stats" className="text-[9px] px-0.5 py-0.5">Stats</TabsTrigger>
              <TabsTrigger value="diagnostics" className="text-[9px] px-0.5 py-0.5">Diag</TabsTrigger>
              <TabsTrigger value="alerts" className="text-[9px] px-0.5 py-0.5">Alerts</TabsTrigger>
              <TabsTrigger value="filters" className="text-[9px] px-0.5 py-0.5">Filter</TabsTrigger>
              <TabsTrigger value="properties" className="text-[9px] px-0.5 py-0.5">Props</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="stats" className="flex-1 m-0 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2">
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
              <div className="p-2">
                <ProblemFilters />
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="properties" className="flex-1 m-0 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-2">
                <div>
                  <h3 className="text-xs font-semibold mb-1.5">Groups ({groups.length})</h3>
                  {groups.length > 0 ? (
                    <div className="space-y-1.5">
                      {groups.map((group) => (
                        <div
                          key={group.id}
                          className="p-2 bg-secondary/50 rounded border border-border cursor-pointer hover:bg-secondary transition-colors"
                          onClick={() => selectGroup(group.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate">{group.name}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {group.nodeIds.length} component{group.nodeIds.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                            <div
                              className="w-3 h-3 rounded border-2 border-border flex-shrink-0 ml-1.5"
                              style={{ backgroundColor: group.color || 'hsl(var(--primary))' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-3">
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
      <div className="w-56 md:w-64 lg:w-72 h-full bg-card border-l border-border flex flex-col">
        <div className="p-2 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-xs font-semibold text-foreground">Connection</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => selectConnection(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
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
    <div className="w-56 md:w-64 lg:w-72 h-full bg-card border-l border-border flex flex-col">
      <div className="p-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-xs font-semibold text-foreground">Properties</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => selectNode(null)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
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
              className="mt-1 h-8 text-xs"
            />
          </div>

          <Separator />

          <div>
            <h3 className="text-xs font-semibold mb-1.5">Position</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="pos-x" className="text-[10px] text-muted-foreground">
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
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="pos-y" className="text-[10px] text-muted-foreground">
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
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-xs font-semibold mb-1.5">Component Type</h3>
            <div className="bg-secondary/50 rounded-md p-2 border border-border">
              <p className="text-xs font-mono">{selectedNode!.type}</p>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-xs font-semibold mb-1.5">Configuration</h3>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full h-8 text-xs"
              onClick={() => {
                addTab({
                  title: `${selectedNode!.data.label} Config`,
                  type: 'component',
                  componentId: selectedNode!.id,
                  componentType: selectedNode!.type,
                });
              }}
            >
              Open Configuration Panel
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

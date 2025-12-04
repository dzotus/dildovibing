import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCanvasStore } from '@/store/useCanvasStore';
import { ComponentGroup } from '@/types';
import { GroupDeleteDialog } from '@/components/ui/alert-dialog-group';
import { GroupNameDialog } from '@/components/ui/group-name-dialog';
import { Trash2, X, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface GroupPropertiesPanelProps {
  group: ComponentGroup;
}

export function GroupPropertiesPanel({ group }: GroupPropertiesPanelProps) {
  const { nodes, updateGroup, deleteGroup, removeNodeFromGroup, addNodeToGroup, selectGroup } = useCanvasStore();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showAddNodeDialog, setShowAddNodeDialog] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());

  const handleRename = () => {
    setShowRenameDialog(true);
  };

  const handleRenameConfirm = (newName: string) => {
    updateGroup(group.id, { name: newName });
    toast.success('Group renamed');
    setShowRenameDialog(false);
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    deleteGroup(group.id);
    selectGroup(null);
    toast.success('Group deleted');
    setShowDeleteDialog(false);
  };

  const handleRemoveNode = (nodeId: string) => {
    removeNodeFromGroup(group.id, nodeId);
    toast.success('Component removed from group');
  };

  const groupNodes = nodes.filter((node) => group.nodeIds.includes(node.id));

  return (
    <div className="space-y-2.5">
      <div>
        <Label htmlFor="group-name" className="text-xs font-medium">
          Group Name
        </Label>
        <div className="flex items-center gap-1.5 mt-1">
          <Input
            id="group-name"
            value={group.name}
            onChange={(e) => updateGroup(group.id, { name: e.target.value })}
            className="flex-1 h-8 text-xs"
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDelete}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      <GroupDeleteDialog
        open={showDeleteDialog}
        groupName={group.name}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteDialog(false)}
      />

      <GroupNameDialog
        open={showRenameDialog}
        initialName={group.name}
        onConfirm={handleRenameConfirm}
        onCancel={() => setShowRenameDialog(false)}
      />

      <Separator />

      <div className="flex items-center space-x-2">
        <Checkbox
          id="show-name"
          checked={group.showName !== false}
          onCheckedChange={(checked) => updateGroup(group.id, { showName: checked !== false })}
        />
        <Label
          htmlFor="show-name"
          className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Show name on canvas
        </Label>
      </div>

      <Separator />

      <div>
        <Label className="text-xs font-medium mb-1.5 block">Color</Label>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={group.color || '#3b82f6'}
            onChange={(e) => updateGroup(group.id, { color: e.target.value })}
            className="w-10 h-8 rounded border border-border cursor-pointer"
          />
          <Input
            value={group.color || '#3b82f6'}
            onChange={(e) => updateGroup(group.id, { color: e.target.value })}
            className="flex-1 font-mono text-xs h-8"
            placeholder="#3b82f6"
          />
        </div>
      </div>

      <Separator />

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs font-medium">
            Components ({group.nodeIds.length})
          </Label>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              const allNodes = useCanvasStore.getState().nodes;
              const availableNodes = allNodes.filter(n => !group.nodeIds.includes(n.id));
              
              if (availableNodes.length === 0) {
                toast.info('All components are already in this group');
                return;
              }
              
              setSelectedNodeIds(new Set());
              setShowAddNodeDialog(true);
            }}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {groupNodes.map((node) => (
            <div
              key={node.id}
              className="flex items-center justify-between p-1.5 bg-secondary/50 rounded border border-border"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{node.data?.label || node.type}</div>
                <div className="text-[10px] text-muted-foreground truncate">{node.type}</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={() => handleRemoveNode(node.id)}
                title="Remove from group"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {groupNodes.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-3">
              No components in group
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Group ID:</span>
        <code className="font-mono bg-secondary/50 px-1.5 py-0.5 rounded text-[10px]">{group.id}</code>
      </div>

      {/* Add Components Dialog */}
      <Dialog open={showAddNodeDialog} onOpenChange={setShowAddNodeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Components to Group</DialogTitle>
            <DialogDescription>
              Select components to add to "{group.name}"
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            <div className="space-y-2 py-2">
              {nodes
                .filter(node => !group.nodeIds.includes(node.id))
                .map((node) => (
                  <div
                    key={node.id}
                    className="flex items-center space-x-2 p-2 rounded border border-border hover:bg-secondary/50 cursor-pointer"
                    onClick={() => {
                      const newSelected = new Set(selectedNodeIds);
                      if (newSelected.has(node.id)) {
                        newSelected.delete(node.id);
                      } else {
                        newSelected.add(node.id);
                      }
                      setSelectedNodeIds(newSelected);
                    }}
                  >
                    <Checkbox
                      checked={selectedNodeIds.has(node.id)}
                      onCheckedChange={(checked) => {
                        const newSelected = new Set(selectedNodeIds);
                        if (checked) {
                          newSelected.add(node.id);
                        } else {
                          newSelected.delete(node.id);
                        }
                        setSelectedNodeIds(newSelected);
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {node.data?.label || node.type}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {node.type}
                      </div>
                    </div>
                  </div>
                ))}
              {nodes.filter(node => !group.nodeIds.includes(node.id)).length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  All components are already in this group
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddNodeDialog(false);
                setSelectedNodeIds(new Set());
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedNodeIds.size === 0) {
                  toast.error('Select at least one component');
                  return;
                }
                selectedNodeIds.forEach(nodeId => {
                  addNodeToGroup(group.id, nodeId);
                });
                toast.success(`${selectedNodeIds.size} component(s) added to group`);
                setShowAddNodeDialog(false);
                setSelectedNodeIds(new Set());
              }}
            >
              Add Selected ({selectedNodeIds.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


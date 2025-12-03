import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useCanvasStore } from '@/store/useCanvasStore';
import { ComponentGroup } from '@/types';
import { GroupDeleteDialog } from '@/components/ui/alert-dialog-group';
import { GroupNameDialog } from '@/components/ui/group-name-dialog';
import { Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

interface GroupPropertiesPanelProps {
  group: ComponentGroup;
}

export function GroupPropertiesPanel({ group }: GroupPropertiesPanelProps) {
  const { nodes, updateGroup, deleteGroup, removeNodeFromGroup, selectGroup } = useCanvasStore();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);

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
    <div className="space-y-4">
      <div>
        <Label htmlFor="group-name" className="text-xs font-medium">
          Group Name
        </Label>
        <div className="flex items-center gap-2 mt-1.5">
          <Input
            id="group-name"
            value={group.name}
            onChange={(e) => updateGroup(group.id, { name: e.target.value })}
            className="flex-1"
          />
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
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

      <div>
        <Label className="text-xs font-medium mb-2 block">Color</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={group.color || '#3b82f6'}
            onChange={(e) => updateGroup(group.id, { color: e.target.value })}
            className="w-12 h-9 rounded border border-border cursor-pointer"
          />
          <Input
            value={group.color || '#3b82f6'}
            onChange={(e) => updateGroup(group.id, { color: e.target.value })}
            className="flex-1 font-mono text-xs"
            placeholder="#3b82f6"
          />
        </div>
      </div>

      <Separator />

      <div>
        <Label className="text-xs font-medium mb-2 block">
          Components ({group.nodeIds.length})
        </Label>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {groupNodes.map((node) => (
            <div
              key={node.id}
              className="flex items-center justify-between p-2 bg-secondary/50 rounded border border-border"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{node.data?.label || node.type}</div>
                <div className="text-xs text-muted-foreground truncate">{node.type}</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0"
                onClick={() => handleRemoveNode(node.id)}
                title="Remove from group"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {groupNodes.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No components in group
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Group ID:</span>
        <code className="font-mono bg-secondary/50 px-2 py-1 rounded">{group.id}</code>
      </div>
    </div>
  );
}

